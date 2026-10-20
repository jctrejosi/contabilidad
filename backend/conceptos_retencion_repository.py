"""Mantenimiento de tipos de retención del formulario Harbour RETES.

En Advantage, CONTIRET es global: no tiene CIA. RETES1/DSIGRABA5 editan solo
CODIGO (dos dígitos), NOMBRE (30) y VLRPOR (porcentaje con dos decimales).
TIPO y HIST se dejan vacíos en el alta, igual que DBAPPEND del original. La
cuenta y base mínima pertenecen al modelo PostgreSQL de referencia, no a esta
pantalla; si se envían a Advantage con valor, la operación se rechaza.

La API expresa el porcentaje como fracción: 0.015 ↔ CONTIRET.VLRPOR 1.50.
La eliminación heredada es física y requiere confirmación explícita.
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
from .companias_repository import validate_company_reason
from .lotes_repository import _one
# ``ACCOUNT_CODE`` y ``PERCENT_FACTOR`` son el patrón de cuenta y el factor
# porcentaje→fracción del contrato de configuración: se declaran una vez, en el
# módulo de tarifas de IVA, y los otros dos catálogos los reutilizan.
from .tarifas_iva_repository import ACCOUNT_CODE, PERCENT_FACTOR


RETENTION_CONCEPT_CODE = re.compile(r"^[A-Za-z0-9]{1,10}$")
RETENTION_TYPE_CODE = re.compile(r"^[0-9]{2}$")
RETENTION_CONCEPT_NAME_SIZE = 40
# ``CONTIRET.NOMBRE`` es CHARACTER(30).
RETENTION_CONCEPT_LEGACY_NAME_SIZE = 30
BASE_MINIMA_DECIMALS = Decimal("0.01")
# ``CONTIRET`` es la tabla de retenciones: su columna ``TIPO`` (campo no
# homologado) se llena con la clase del catálogo y el contrato no la expone.
# RETES1/DSIGRABA5 no asignan TIPO ni HIST al crear una fila. DBAPPEND deja
# ambos campos de carácter vacíos; no se debe inventar una clasificación.
RETENTION_CONCEPT_LEGACY_TYPE = ""


class RetentionConceptAlreadyExists(RuntimeError):
    """Ya existe un concepto con el mismo código (el código es la clave)."""


class RetentionConceptNotFound(RuntimeError):
    """No existe el concepto pedido."""


class RetentionConceptConflict(RuntimeError):
    """El concepto está referenciado por acumulados o renglones contabilizados."""


class RetentionConceptValidationError(ValueError):
    """El concepto incumple las reglas de conceptos_retencion/CONTIRET."""


def _tarifa(value: Any) -> Decimal:
    """Tarifa como fracción (``0.1`` es 10 %), con los límites del contrato."""
    try:
        fraccion = Decimal(str(value).strip())
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise RetentionConceptValidationError("La tarifa debe ser numérica.") from exc
    if not Decimal("0") <= fraccion <= Decimal("1"):
        raise RetentionConceptValidationError(
            "La tarifa es una fracción entre 0 y 1: 10 % se envía como 0.1."
        )
    return fraccion


def _base_minima(value: Any) -> Decimal:
    """Base mínima en dinero: no puede ser negativa (422)."""
    if value in (None, ""):
        return Decimal("0")
    try:
        base = Decimal(str(value).strip())
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise RetentionConceptValidationError("La base mínima debe ser numérica.") from exc
    if base < 0:
        raise RetentionConceptValidationError("La base mínima no puede ser negativa.")
    return base.quantize(BASE_MINIMA_DECIMALS)


def normalize_retention_concept(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida y normaliza el contrato de escritura de un concepto (B3, sección 3).

    La cuenta es obligatoria: la tabla la admite opcional, pero la pantalla la
    exige al confirmar y el renglón de retención no se puede construir sin ella.
    """
    codigo = str(payload.get("codigo", "") or "").strip().upper()
    if not RETENTION_CONCEPT_CODE.fullmatch(codigo):
        raise RetentionConceptValidationError(
            "El código del concepto debe tener entre 1 y 10 letras o dígitos."
        )
    nombre = str(payload.get("nombre", "") or "").strip()
    if not nombre:
        raise RetentionConceptValidationError("El nombre del concepto es obligatorio.")
    if len(nombre) > RETENTION_CONCEPT_NAME_SIZE:
        raise RetentionConceptValidationError(
            f"El nombre del concepto admite máximo {RETENTION_CONCEPT_NAME_SIZE} caracteres."
        )
    cuenta = str(payload.get("cuenta", "") or "").strip()
    if not ACCOUNT_CODE.fullmatch(cuenta):
        raise RetentionConceptValidationError("La cuenta debe contener hasta 12 dígitos.")
    if not cuenta:
        raise RetentionConceptValidationError("La cuenta del concepto de retención es obligatoria.")
    return {
        "codigo": codigo,
        "nombre": nombre,
        "tarifa": _tarifa(payload.get("tarifa")),
        "cuenta": cuenta,
        "baseMinima": _base_minima(payload.get("baseMinima")),
    }


def retention_concept_item(data: dict[str, Any]) -> dict[str, Any]:
    """Elemento devuelto por las rutas de escritura; ecoa el contrato de escritura.

    ``nombreCuenta`` solo lo añade el ``GET`` (sale del plan de cuentas).
    """
    return {
        "codigo": data["codigo"],
        "nombre": data["nombre"],
        "tarifa": float(data["tarifa"]),
        "baseMinima": float(data["baseMinima"]),
        "cuenta": data.get("cuenta", ""),
    }


def _codigo_legado(value: Any) -> str:
    """Código recibido por la ruta, validado contra el ancho real del legado."""
    codigo = str(value or "").strip()
    if not RETENTION_TYPE_CODE.fullmatch(codigo):
        raise RetentionConceptValidationError("El código debe tener exactamente dos dígitos.")
    return codigo


def _legacy_percent(tarifa: Any) -> float:
    """Fracción del contrato (``0.1``) → porcentaje del legado (``10.0``)."""
    return float(Decimal(str(tarifa)) * PERCENT_FACTOR)


def _legacy_fraction(vlrpor: Any) -> float:
    """Porcentaje del legado (``VLRPOR = 10.0``) → fracción del contrato (``0.1``)."""
    return round(_number(vlrpor) / float(PERCENT_FACTOR), 6)


def normalize_legacy_retention_type(payload: dict[str, Any]) -> dict[str, Any]:
    """Contrato exacto de RETES1: código 99, nombre(30) y porcentaje 99.99.

    La API histórica de conceptos admite cuenta y base para PostgreSQL, pero
    esos atributos no existen en CONTIRET. Se rechazan si llegan con valor y
    nunca se exige una cuenta para crear un tipo de retención en Advantage.
    """
    codigo = str(payload.get("codigo", "") or "").strip()
    if not RETENTION_TYPE_CODE.fullmatch(codigo):
        raise RetentionConceptValidationError("El código debe tener exactamente dos dígitos.")
    nombre = str(payload.get("nombre", "") or "").strip()
    if not nombre:
        raise RetentionConceptValidationError("El nombre es obligatorio.")
    if len(nombre) > RETENTION_CONCEPT_LEGACY_NAME_SIZE:
        raise RetentionConceptValidationError("El nombre admite máximo 30 caracteres.")
    if str(payload.get("cuenta", "") or "").strip():
        raise RetentionConceptValidationError("CONTIRET no tiene columna de cuenta.")
    base = _base_minima(payload.get("baseMinima"))
    if base:
        raise RetentionConceptValidationError("CONTIRET no tiene columna de base mínima.")
    tarifa = _tarifa(payload.get("tarifa"))
    if tarifa > Decimal("0.9999"):
        raise RetentionConceptValidationError("El porcentaje no puede superar 99,99 %.")
    if tarifa * PERCENT_FACTOR != (tarifa * PERCENT_FACTOR).quantize(Decimal("0.01")):
        raise RetentionConceptValidationError("El porcentaje admite máximo dos decimales.")
    return {"codigo": codigo, "nombre": nombre, "tarifa": tarifa,
            "cuenta": "", "baseMinima": Decimal("0")}


def _retention_concept_from_row(row: dict[str, Any]) -> dict[str, Any]:
    """Traduce ``CONTIRET`` al contrato del ``GET`` (sin cuenta ni base: no existen)."""
    return {
        "codigo": _text(row.get("CODIGO")),
        "nombre": _text(row.get("NOMBRE")),
        "tarifa": _legacy_fraction(row.get("VLRPOR")),
        "baseMinima": 0.0,
        "cuenta": "",
        "nombreCuenta": "",
    }


def list_conceptos_retencion(cia: str) -> list[dict[str, Any]]:
    """Conceptos del catálogo global ``CONTIRET``."""
    company_id = normalize_company_code(cia)
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        recordset = _open_recordset(
            connection,
            "SELECT CODIGO, NOMBRE, VLRPOR FROM CONTIRET ORDER BY CODIGO",
        )
        try:
            return [_retention_concept_from_row(row) for row in _rows(recordset)]
        finally:
            recordset.Close()


def create_concepto_retencion(
    cia: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea el tipo que RETES1 graba en CONTIRET, sin cuentas ni base mínima."""
    data = normalize_legacy_retention_type(payload)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _one(
            connection,
            "SELECT TOP 1 CODIGO FROM CONTIRET WHERE CODIGO = ?",
            [(ADO_TYPE_VARCHAR, 2, data["codigo"])],
        ) is not None:
            raise RetentionConceptAlreadyExists(
                f"Ya existe el concepto de retención {data['codigo']}."
            )
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "INSERT INTO CONTIRET (TIPO, CODIGO, NOMBRE, VLRPOR, HIST) VALUES (?, ?, ?, ?, ?)",
                [
                    (ADO_TYPE_VARCHAR, 1, RETENTION_CONCEPT_LEGACY_TYPE),
                    (ADO_TYPE_VARCHAR, 2, data["codigo"]),
                    (ADO_TYPE_VARCHAR, RETENTION_CONCEPT_LEGACY_NAME_SIZE, data["nombre"]),
                    # Fracción del contrato → porcentaje del legado (0.1 → 10.0).
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
    item = retention_concept_item(data)
    try:
        register_master_creation(user, "CONTIRET", data["codigo"], "Alta de concepto de retención")
    except Exception as exc:
        item["advertencia"] = (
            f"El concepto se creó, pero no fue posible registrar la bitácora: {exc}"
        )
    return item


def update_concepto_retencion(
    cia: str, codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica nombre y tarifa de un concepto (B3.3 de la sección 3).

    El cambio de tarifa aplica a lo que se capture: los acumulados
    (``acumulados_retencion``) conservan la base y el concepto ya causados.
    """
    code = _codigo_legado(codigo)
    data = normalize_legacy_retention_type({**payload, "codigo": code})
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _one(
            connection,
            "SELECT TOP 1 CODIGO FROM CONTIRET WHERE CODIGO = ?",
            [(ADO_TYPE_VARCHAR, 2, code)],
        ) is None:
            raise RetentionConceptNotFound(f"No existe el concepto de retención {code}.")
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "UPDATE CONTIRET SET NOMBRE = ?, VLRPOR = ? WHERE CODIGO = ?",
                [
                    (ADO_TYPE_VARCHAR, RETENTION_CONCEPT_LEGACY_NAME_SIZE, data["nombre"]),
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
    item = retention_concept_item(data)
    try:
        register_master_update(user, "CONTIRET", code, "Modificación de concepto de retención")
    except Exception as exc:
        item["advertencia"] = (
            f"El concepto se modificó, pero no fue posible registrar la bitácora: {exc}"
        )
    return item


def delete_concepto_retencion(
    cia: str, codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Retira un concepto de ``CONTIRET`` (B3.4 de la sección 3).

    Baja física y sin comprobación de uso, por las mismas razones que
    ``tarifas_iva_repository.delete_tarifa_iva``: el legado no tiene
    ``eliminado_en`` ni persiste el vínculo renglón↔concepto. El 409 de uso y la
    reserva del código solo existen en PostgreSQL.
    """
    code = _codigo_legado(codigo)
    motivo = validate_company_reason(reason)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _one(
            connection,
            "SELECT TOP 1 CODIGO FROM CONTIRET WHERE CODIGO = ?",
            [(ADO_TYPE_VARCHAR, 2, code)],
        ) is None:
            raise RetentionConceptNotFound(f"No existe el concepto de retención {code}.")
        if not dry_run:
            connection.BeginTrans()
            try:
                _execute(
                    connection,
                    "DELETE FROM CONTIRET WHERE CODIGO = ?",
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
            register_master_deletion(user, "CONTIRET", code, motivo)
        except Exception:
            pass
    return {
        "codigo": code,
        "eliminada": not dry_run,
        "bajaLogica": False,
        "referencias": None,
    }
