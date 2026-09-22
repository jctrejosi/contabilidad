"""Tarifas de IVA (bloque B3, pantalla ConfigIVA): contrato y rama Advantage.

**Doble motor declarado (R10).** En el modelo nuevo la tabla es ``tarifas_iva`` y
es **por compañía** (``UNIQUE (compania_id, codigo)``); en el legado la tabla es
``CONTIIVA`` y es **global**: no tiene ``CIA`` y su clave funcional es el código
completo. La ruta acepta siempre ``cia``, valida con ella las referencias y
declara la diferencia con ``sharedAcrossCompanies`` en la respuesta.

**Diferencias del legado que se declaran, no se suplen** (no se inventan
columnas, ``db/old_db/DICCIONARIO_DEPURADO_CONTABDSI.md`` L2600-2616):

- ``CONTIIVA`` no tiene cuenta: ``cuenta`` y ``nombreCuenta`` viajan vacíos en el
  ``GET`` y una tarifa con cuenta se rechaza en Advantage, porque su columna de
  cuenta no existe. Lo mismo se aplica al código: ``CONTIIVA.CODIGO`` es de 2
  posiciones, así que un código más largo se rechaza en el motor heredado.
- ``CONTIIVA`` no tiene ``eliminado_en``: la baja en Advantage es física (el
  ``BORRAR("cCONTIIVA", …)`` del propio legado,
  ``db/old_db/TRAZABILIDAD_FUNCIONES_Y_BOTONES.md`` L1230) y no reserva el
  código; en PostgreSQL es lógica y lo reserva.

**Porcentaje ↔ fracción.** ``CONTIIVA.VLRPOR`` está guardado como porcentaje
(19.00) y el contrato viaja como fracción (0.19); la conversión se hace en la
lectura y en la escritura de este repositorio. La matriz lo pedía para CONTIIVA
(``db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`` L417-427) y el diccionario declara la
misma escala (``db/advantage/01_tablas.sql``).
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_DOUBLE,
    ADO_TYPE_VARCHAR,
    CompanyNotFound,
    _company_exists,
    _execute,
    _number,
    _open_recordset,
    _rows,
    _text,
    ads_connection,
    ads_odbc_connection,
    normalize_company_code,
)
from .auditoria_repository import (
    register_master_creation,
    register_master_deletion,
    register_master_update,
)
from .lotes_repository import _one


# ``CONTIIVA.CODIGO`` ocupa 2 posiciones en el legado; el contrato del modelo
# nuevo admite hasta 10 (``tarifas_iva.codigo`` es ``text``).
VAT_RATE_CODE = re.compile(r"^[A-Za-z0-9]{1,10}$")
VAT_RATE_LEGACY_CODE = re.compile(r"^[A-Za-z0-9]{1,2}$")
VAT_RATE_NAME_SIZE = 40
# ``CONTIIVA.NOMBRE`` es CHARACTER(30).
VAT_RATE_LEGACY_NAME_SIZE = 30
# ``CONTIIVA`` es la tabla de IVA: su columna ``TIPO`` (campo no homologado,
# ``db/old_db/HOMOLOGACION_CAMPOS.md`` L942) se llena con la clase del catálogo
# para que la fila tenga valor en esa columna real; el contrato no la expone.
VAT_RATE_LEGACY_TYPE = "I"
ACCOUNT_CODE = re.compile(r"^[0-9]{0,12}$")
PERCENT_FACTOR = Decimal("100")


class VatRateAlreadyExists(RuntimeError):
    """Ya existe una tarifa con el mismo código (el código es la clave)."""


class VatRateNotFound(RuntimeError):
    """No existe la tarifa pedida."""


class VatRateConflict(RuntimeError):
    """La tarifa está referenciada por renglones contabilizados."""


class VatRateValidationError(ValueError):
    """La tarifa incumple las reglas de tarifas_iva/CONTIIVA."""


def _tarifa(value: Any) -> Decimal:
    """Tarifa como fracción (``0.19`` es 19 %), con los límites del contrato."""
    try:
        fraccion = Decimal(str(value).strip())
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise VatRateValidationError("La tarifa debe ser numérica.") from exc
    if not Decimal("0") <= fraccion <= Decimal("1"):
        raise VatRateValidationError(
            "La tarifa es una fracción entre 0 y 1: 19 % se envía como 0.19."
        )
    return fraccion


def normalize_vat_rate(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida y normaliza el contrato de escritura de una tarifa (B3, sección 2)."""
    codigo = str(payload.get("codigo", "") or "").strip().upper()
    if not VAT_RATE_CODE.fullmatch(codigo):
        raise VatRateValidationError("El código de la tarifa debe tener entre 1 y 10 letras o dígitos.")
    nombre = str(payload.get("nombre", "") or "").strip()
    if not nombre:
        raise VatRateValidationError("El nombre de la tarifa es obligatorio.")
    if len(nombre) > VAT_RATE_NAME_SIZE:
        raise VatRateValidationError(
            f"El nombre de la tarifa admite máximo {VAT_RATE_NAME_SIZE} caracteres."
        )
    cuenta = str(payload.get("cuenta", "") or "").strip()
    if not ACCOUNT_CODE.fullmatch(cuenta):
        raise VatRateValidationError("La cuenta debe contener hasta 12 dígitos.")
    return {
        "codigo": codigo,
        "nombre": nombre,
        "tarifa": _tarifa(payload.get("tarifa")),
        "cuenta": cuenta,
    }


def vat_rate_item(data: dict[str, Any]) -> dict[str, Any]:
    """Elemento devuelto por las rutas de escritura; ecoa el contrato de escritura.

    ``nombreCuenta`` es un enriquecimiento del ``GET`` (sale del plan de cuentas),
    no del contrato de escritura, así que no viaja en el eco del alta ni de la
    modificación; tampoco lo tiene el legado, que no guarda la cuenta.
    """
    return {
        "codigo": data["codigo"],
        "nombre": data["nombre"],
        "tarifa": float(data["tarifa"]),
        "cuenta": data.get("cuenta", ""),
    }


def _codigo_legado(value: Any) -> str:
    """Código recibido por la ruta, validado contra el ancho real del legado."""
    codigo = str(value or "").strip().upper()
    if not VAT_RATE_CODE.fullmatch(codigo):
        raise VatRateValidationError("El código de la tarifa debe tener entre 1 y 10 letras o dígitos.")
    if not VAT_RATE_LEGACY_CODE.fullmatch(codigo):
        raise VatRateValidationError(
            "CONTIIVA admite códigos de máximo 2 caracteres: el código largo solo se "
            "puede usar con PostgreSQL."
        )
    return codigo


def _legacy_percent(tarifa: Any) -> float:
    """Fracción del contrato (``0.19``) → porcentaje del legado (``19.0``)."""
    return float(Decimal(str(tarifa)) * PERCENT_FACTOR)


def _legacy_fraction(vlrpor: Any) -> float:
    """Porcentaje del legado (``VLRPOR = 19.0``) → fracción del contrato (``0.19``)."""
    return round(_number(vlrpor) / float(PERCENT_FACTOR), 6)


def _reject_unsupported(data: dict[str, Any]) -> None:
    """Declara lo que ``CONTIIVA`` no puede representar, en vez de perderlo."""
    if not VAT_RATE_LEGACY_CODE.fullmatch(data["codigo"]):
        raise VatRateValidationError(
            "CONTIIVA admite códigos de máximo 2 caracteres: el código largo solo se "
            "puede usar con PostgreSQL."
        )
    if data["cuenta"]:
        raise VatRateValidationError(
            "CONTIIVA no tiene columna de cuenta: la cuenta de la tarifa solo se "
            "puede fijar en PostgreSQL."
        )
    if len(data["nombre"]) > VAT_RATE_LEGACY_NAME_SIZE:
        raise VatRateValidationError(
            f"CONTIIVA.NOMBRE admite máximo {VAT_RATE_LEGACY_NAME_SIZE} caracteres."
        )


def _vat_rate_from_row(row: dict[str, Any]) -> dict[str, Any]:
    """Traduce ``CONTIIVA`` al contrato del ``GET`` (sin cuenta: no existe)."""
    return {
        "codigo": _text(row.get("CODIGO")),
        "nombre": _text(row.get("NOMBRE")),
        "tarifa": _legacy_fraction(row.get("VLRPOR")),
        "cuenta": "",
        "nombreCuenta": "",
    }


def list_tarifas_iva(cia: str) -> list[dict[str, Any]]:
    """Tarifas del catálogo global ``CONTIIVA``.

    La compañía se valida contra ``CONEMP`` aunque la tabla no tenga ``CIA``: es
    la referencia con la que el contrato declara el alcance global del catálogo.
    """
    company_id = normalize_company_code(cia)
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        recordset = _open_recordset(
            connection,
            "SELECT CODIGO, NOMBRE, VLRPOR FROM CONTIIVA ORDER BY CODIGO",
        )
        try:
            return [_vat_rate_from_row(row) for row in _rows(recordset)]
        finally:
            recordset.Close()


def create_tarifa_iva(cia: str, payload: dict[str, Any], *, user: str = "WEB") -> dict[str, Any]:
    """Crea una tarifa en ``CONTIIVA`` (B3.2).

    La unicidad es global: ``CONTIIVA`` no tiene compañía y su código no se puede
    repetir en ninguna contabilidad.
    """
    data = normalize_vat_rate(payload)
    _reject_unsupported(data)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _one(
            connection,
            "SELECT TOP 1 CODIGO FROM CONTIIVA WHERE CODIGO = ?",
            [(ADO_TYPE_VARCHAR, 2, data["codigo"])],
        ) is not None:
            raise VatRateAlreadyExists(f"Ya existe la tarifa de IVA {data['codigo']}.")
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "INSERT INTO CONTIIVA (TIPO, CODIGO, NOMBRE, VLRPOR, HIST) VALUES (?, ?, ?, ?, ?)",
                [
                    (ADO_TYPE_VARCHAR, 1, VAT_RATE_LEGACY_TYPE),
                    (ADO_TYPE_VARCHAR, 2, data["codigo"]),
                    (ADO_TYPE_VARCHAR, VAT_RATE_LEGACY_NAME_SIZE, data["nombre"]),
                    # Fracción del contrato → porcentaje del legado (0.19 → 19.0).
                    (ADO_TYPE_DOUBLE, 0, _legacy_percent(data["tarifa"])),
                    (ADO_TYPE_VARCHAR, 1, ""),
                ],
            )
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    item = vat_rate_item(data)
    try:
        register_master_creation(user, "CONTIIVA", data["codigo"], "Alta de tarifa de IVA")
    except Exception as exc:
        item["advertencia"] = (
            f"La tarifa se creó, pero no fue posible registrar la bitácora: {exc}"
        )
    return item


def update_tarifa_iva(
    cia: str, codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica nombre y tarifa de una tarifa (B3.3) en ``CONTIIVA``.

    Cambiar la tarifa no reescribe lo contabilizado: en el legado ``MOVxx`` solo
    guarda la clase fiscal (``TIVA_RET`` = ``I``/``R``/``O``,
    ``db/migration/06_referencia_campos.md`` L603) y no el código de la tarifa,
    así que la advertencia de períodos de uso solo puede construirla PostgreSQL.
    """
    code = _codigo_legado(codigo)
    data = normalize_vat_rate({**payload, "codigo": code})
    _reject_unsupported(data)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        row = _one(
            connection,
            "SELECT TOP 1 CODIGO, VLRPOR FROM CONTIIVA WHERE CODIGO = ?",
            [(ADO_TYPE_VARCHAR, 2, code)],
        )
        if row is None:
            raise VatRateNotFound(f"No existe la tarifa de IVA {code}.")
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "UPDATE CONTIIVA SET NOMBRE = ?, VLRPOR = ? WHERE CODIGO = ?",
                [
                    (ADO_TYPE_VARCHAR, VAT_RATE_LEGACY_NAME_SIZE, data["nombre"]),
                    (ADO_TYPE_DOUBLE, 0, _legacy_percent(data["tarifa"])),
                    (ADO_TYPE_VARCHAR, 2, code),
                ],
            )
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    item = vat_rate_item(data)
    try:
        register_master_update(user, "CONTIIVA", code, "Modificación de tarifa de IVA")
    except Exception as exc:
        item["advertencia"] = (
            f"La tarifa se modificó, pero no fue posible registrar la bitácora: {exc}"
        )
    return item


def delete_tarifa_iva(
    cia: str, codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Retira una tarifa de ``CONTIIVA`` (B3.4).

    ``CONTIIVA`` no tiene bandera de baja, así que en Advantage la baja es física
    (como el ``BORRAR`` del legado) y el código no queda reservado. Tampoco se
    puede comprobar si la tarifa está en uso: el legado no persiste el vínculo
    entre el renglón y el código de la tarifa, por lo que esa validación (409)
    solo existe en PostgreSQL. Ambas diferencias se declaran en la respuesta con
    ``bajaLogica`` y ``referencias`` nulo.
    """
    from .companias_repository import validate_company_reason

    code = _codigo_legado(codigo)
    motivo = validate_company_reason(reason)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _one(
            connection,
            "SELECT TOP 1 CODIGO FROM CONTIIVA WHERE CODIGO = ?",
            [(ADO_TYPE_VARCHAR, 2, code)],
        ) is None:
            raise VatRateNotFound(f"No existe la tarifa de IVA {code}.")
        if not dry_run:
            connection.BeginTrans()
            try:
                _execute(
                    connection,
                    "DELETE FROM CONTIIVA WHERE CODIGO = ?",
                    [(ADO_TYPE_VARCHAR, 2, code)],
                )
                connection.CommitTrans()
            except Exception:
                try:
                    connection.RollbackTrans()
                except Exception:
                    pass
                raise
    if not dry_run:
        try:
            register_master_deletion(user, "CONTIIVA", code, motivo)
        except Exception:
            pass
    return {
        "codigo": code,
        "eliminada": not dry_run,
        "bajaLogica": False,
        "referencias": None,
    }
