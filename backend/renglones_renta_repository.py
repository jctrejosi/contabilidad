"""Renglones de renta (bloque B3, pantalla RenglonesRenta).

**Doble motor declarado (R10).** En PostgreSQL la tabla es ``renglones_renta`` y
es por compañía (``UNIQUE (compania_id, codigo)``); en el legado es ``CONDECLA``,
global (sin ``CIA``). La ruta acepta ``cia``, la usa para validar y declara el
alcance con ``sharedAcrossCompanies``.

**Diferencias que se declaran** (``db/old_db/DICCIONARIO_DEPURADO_CONTABDSI.md``
L2636-2651): ``CONDECLA`` solo tiene CODIGO, NOMBRE, FORMULA y CONCEPTO. Por eso,
en Advantage:

- ``cuenta`` (obligatoria en el contrato) y ``signo`` (``1``/``-1``) se rechazan
  con la causa declarada: no hay columna donde guardarlos. ``FORMULA`` es una
  fórmula del legado, no el signo (``db/old_db/HOMOLOGACION_CAMPOS.md`` L954), y
  su ejecución no se replica;
- la baja es física: ``CONDECLA`` no tiene bandera de baja ni el legado persiste
  el uso del renglón en una declaración, así que el 409 de "en uso" y la reserva
  del código solo existen en PostgreSQL.
"""

from __future__ import annotations

import re
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_VARCHAR,
    CompanyNotFound,
    _company_exists,
    _execute,
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
# Patrón de cuenta del contrato de configuración, declarado en el módulo de
# tarifas de IVA y reutilizado por los otros dos catálogos.
from .tarifas_iva_repository import ACCOUNT_CODE


INCOME_LINE_CODE = re.compile(r"^[A-Za-z0-9]{1,10}$")
INCOME_LINE_LEGACY_CODE = re.compile(r"^[A-Za-z0-9]{1,3}$")
INCOME_LINE_NAME_SIZE = 60
# ``CONDECLA.NOMBRE`` es CHARACTER(60): admite el nombre completo del contrato.
INCOME_LINE_LEGACY_NAME_SIZE = 60
# ``CONDECLA`` no guarda signo: el ``GET`` lo presenta con el positivo implícito
# del legado, que es el valor con el que se calcularía el renglón sin fórmula.
INCOME_LINE_LEGACY_SIGN = 1
INCOME_LINE_SIGNS = (1, -1)


class IncomeLineAlreadyExists(RuntimeError):
    """Ya existe un renglón con el mismo código (el código es la clave)."""


class IncomeLineNotFound(RuntimeError):
    """No existe el renglón pedido."""


class IncomeLineConflict(RuntimeError):
    """El renglón choca con una definición vigente o con una declaración presentada."""


class IncomeLineValidationError(ValueError):
    """El renglón incumple las reglas de renglones_renta/CONDECLA."""


def _signo(value: Any) -> int:
    """Signo del renglón: solo ``1`` o ``-1`` (422 con cualquier otro, ``0`` incluido)."""
    try:
        signo = int(value)
    except (TypeError, ValueError) as exc:
        raise IncomeLineValidationError("El signo del renglón debe ser 1 o -1.") from exc
    if signo not in INCOME_LINE_SIGNS:
        raise IncomeLineValidationError("El signo del renglón debe ser 1 o -1.")
    return signo


def normalize_income_line(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida y normaliza el contrato de escritura de un renglón (B3, sección 4)."""
    codigo = str(payload.get("codigo", "") or "").strip().upper()
    if not INCOME_LINE_CODE.fullmatch(codigo):
        raise IncomeLineValidationError(
            "El código del renglón debe tener entre 1 y 10 letras o dígitos."
        )
    nombre = str(payload.get("nombre", "") or "").strip()
    if not nombre:
        raise IncomeLineValidationError("El nombre del renglón es obligatorio.")
    if len(nombre) > INCOME_LINE_NAME_SIZE:
        raise IncomeLineValidationError(
            f"El nombre del renglón admite máximo {INCOME_LINE_NAME_SIZE} caracteres."
        )
    cuenta = str(payload.get("cuenta", "") or "").strip()
    if not ACCOUNT_CODE.fullmatch(cuenta):
        raise IncomeLineValidationError("La cuenta debe contener hasta 12 dígitos.")
    if not cuenta:
        raise IncomeLineValidationError("La cuenta del renglón es obligatoria.")
    return {
        "codigo": codigo,
        "nombre": nombre,
        "cuenta": cuenta,
        "signo": _signo(payload.get("signo")),
    }


def income_line_item(data: dict[str, Any]) -> dict[str, Any]:
    """Elemento devuelto por las rutas de escritura; ecoa el contrato de escritura.

    ``nombreCuenta`` solo lo añade el ``GET`` (sale del plan de cuentas).
    """
    return {
        "codigo": data["codigo"],
        "nombre": data["nombre"],
        "cuenta": data.get("cuenta", ""),
        "signo": int(data.get("signo", INCOME_LINE_LEGACY_SIGN)),
    }


def _codigo_legado(value: Any) -> str:
    """Código recibido por la ruta, validado contra el ancho real del legado."""
    codigo = str(value or "").strip().upper()
    if not INCOME_LINE_CODE.fullmatch(codigo):
        raise IncomeLineValidationError(
            "El código del renglón debe tener entre 1 y 10 letras o dígitos."
        )
    if not INCOME_LINE_LEGACY_CODE.fullmatch(codigo):
        raise IncomeLineValidationError(
            "CONDECLA admite códigos de máximo 3 caracteres: el código largo solo se "
            "puede usar con PostgreSQL."
        )
    return codigo


def _reject_unsupported(data: dict[str, Any]) -> None:
    """Declara lo que ``CONDECLA`` no puede representar, en vez de perderlo."""
    if not INCOME_LINE_LEGACY_CODE.fullmatch(data["codigo"]):
        raise IncomeLineValidationError(
            "CONDECLA admite códigos de máximo 3 caracteres: el código largo solo se "
            "puede usar con PostgreSQL."
        )
    if data["cuenta"]:
        raise IncomeLineValidationError(
            "CONDECLA no tiene columna de cuenta: la cuenta del renglón solo se "
            "puede fijar en PostgreSQL."
        )
    if data["signo"] != INCOME_LINE_LEGACY_SIGN:
        raise IncomeLineValidationError(
            "CONDECLA no tiene columna de signo: el signo del renglón solo se "
            "puede fijar en PostgreSQL."
        )
    if len(data["nombre"]) > INCOME_LINE_LEGACY_NAME_SIZE:
        raise IncomeLineValidationError(
            f"CONDECLA.NOMBRE admite máximo {INCOME_LINE_LEGACY_NAME_SIZE} caracteres."
        )


def _income_line_from_row(row: dict[str, Any]) -> dict[str, Any]:
    """Traduce ``CONDECLA`` al contrato del ``GET`` (sin cuenta ni signo: no existen)."""
    return {
        "codigo": _text(row.get("CODIGO")),
        "nombre": _text(row.get("NOMBRE")),
        "cuenta": "",
        "nombreCuenta": "",
        "signo": INCOME_LINE_LEGACY_SIGN,
    }


def list_renglones_renta(cia: str) -> list[dict[str, Any]]:
    """Renglones del catálogo global ``CONDECLA``."""
    company_id = normalize_company_code(cia)
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        recordset = _open_recordset(
            connection,
            "SELECT CODIGO, NOMBRE FROM CONDECLA ORDER BY CODIGO",
        )
        try:
            return [_income_line_from_row(row) for row in _rows(recordset)]
        finally:
            recordset.Close()


def create_renglon_renta(
    cia: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un renglón en ``CONDECLA`` (B3.2 de la sección 4).

    La cuenta es obligatoria en el contrato, así que en Advantage el alta queda
    rechazada con la causa declarada: ``CONDECLA`` no tiene esa columna.
    """
    data = normalize_income_line(payload)
    _reject_unsupported(data)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _one(
            connection,
            "SELECT TOP 1 CODIGO FROM CONDECLA WHERE CODIGO = ?",
            [(ADO_TYPE_VARCHAR, 3, data["codigo"])],
        ) is not None:
            raise IncomeLineAlreadyExists(f"Ya existe el renglón de renta {data['codigo']}.")
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "INSERT INTO CONDECLA (CODIGO, NOMBRE, FORMULA, CONCEPTO) VALUES (?, ?, ?, ?)",
                [
                    (ADO_TYPE_VARCHAR, 3, data["codigo"]),
                    (ADO_TYPE_VARCHAR, INCOME_LINE_LEGACY_NAME_SIZE, data["nombre"]),
                    # FORMULA es una fórmula del legado, no el signo: nace vacía y el
                    # motor nuevo no ejecuta expresiones heredadas.
                    (ADO_TYPE_VARCHAR, 1, ""),
                    (ADO_TYPE_VARCHAR, 25, ""),
                ],
            )
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    item = income_line_item(data)
    try:
        register_master_creation(user, "CONDECLA", data["codigo"], "Alta de renglón de renta")
    except Exception as exc:
        item["advertencia"] = (
            f"El renglón se creó, pero no fue posible registrar la bitácora: {exc}"
        )
    return item


def update_renglon_renta(
    cia: str, codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica el nombre del renglón (B3.3 de la sección 4).

    Cambiar el signo o la cuenta no reescribe declaraciones anteriores: el
    renglón es una definición vigente, y eso solo lo puede expresar PostgreSQL.
    """
    code = _codigo_legado(codigo)
    data = normalize_income_line({**payload, "codigo": code})
    _reject_unsupported(data)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _one(
            connection,
            "SELECT TOP 1 CODIGO FROM CONDECLA WHERE CODIGO = ?",
            [(ADO_TYPE_VARCHAR, 3, code)],
        ) is None:
            raise IncomeLineNotFound(f"No existe el renglón de renta {code}.")
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "UPDATE CONDECLA SET NOMBRE = ? WHERE CODIGO = ?",
                [
                    (ADO_TYPE_VARCHAR, INCOME_LINE_LEGACY_NAME_SIZE, data["nombre"]),
                    (ADO_TYPE_VARCHAR, 3, code),
                ],
            )
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    item = income_line_item(data)
    try:
        register_master_update(user, "CONDECLA", code, "Modificación de renglón de renta")
    except Exception as exc:
        item["advertencia"] = (
            f"El renglón se modificó, pero no fue posible registrar la bitácora: {exc}"
        )
    return item


def delete_renglon_renta(
    cia: str, codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Retira un renglón de ``CONDECLA`` (B3.4 de la sección 4).

    Baja física: ``CONDECLA`` no tiene bandera de baja ni el legado persiste el
    uso del renglón en una declaración, así que no se puede reproducir el 409 de
    "renglón en uso" que sí exige PostgreSQL.
    """
    code = _codigo_legado(codigo)
    motivo = validate_company_reason(reason)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _one(
            connection,
            "SELECT TOP 1 CODIGO FROM CONDECLA WHERE CODIGO = ?",
            [(ADO_TYPE_VARCHAR, 3, code)],
        ) is None:
            raise IncomeLineNotFound(f"No existe el renglón de renta {code}.")
        if not dry_run:
            connection.BeginTrans()
            try:
                _execute(
                    connection,
                    "DELETE FROM CONDECLA WHERE CODIGO = ?",
                    [(ADO_TYPE_VARCHAR, 3, code)],
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
            register_master_deletion(user, "CONDECLA", code, motivo)
        except Exception:
            pass
    return {
        "codigo": code,
        "eliminada": not dry_run,
        "bajaLogica": False,
        "referencias": None,
    }
