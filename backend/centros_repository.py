"""Consulta de centros de costo almacenados en CONCECOS.

CONCECOS pertenece a cada contabilidad: un código solo es único dentro de su
compañía. Por eso la clave funcional es ``(CIA, CODIGO)`` y toda lectura debe
recibir la compañía activa de la sesión.

La tabla heredada no tiene un campo padre. Para presentar una lista ordenada
se reconoce como hijo únicamente un código de tres caracteres cuyo prefijo de
dos caracteres exista en la misma compañía. Los demás códigos se conservan
como raíces; así la API no inventa relaciones que no estén respaldadas por
los datos.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_DOUBLE,
    ADO_TYPE_INTEGER,
    ADO_TYPE_VARCHAR,
    CompanyNotFound,
    _boolean,
    _catalog_account_exists,
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
from .auditoria_repository import register_master_creation
from .lotes_repository import _one


# CONCECOS.CODIGO admite 7 caracteres; los códigos heredados usan letras mayúsculas.
COST_CENTER_CODE = re.compile(r"^[A-Za-z0-9]{1,7}$")
# CONMAE.CODIGO: 1, 2, 4, 6, 9 o 12 dígitos.
ACCOUNT_CODE = re.compile(r"^[0-9]{1,12}$")
COST_CENTER_NAME_SIZE = 40


class CostCenterAlreadyExists(RuntimeError):
    """Ya existe un centro con el mismo código dentro de la compañía."""


class CostCenterNotFound(RuntimeError):
    """No existe el centro de costo pedido en la compañía."""


class CostCenterValidationError(ValueError):
    """El centro de costo incumple las reglas de CONCECOS/centros_costos."""


def _decimal(value: Any, places: int, label: str) -> Decimal:
    """Importe o porcentaje validado y cuantizado a la precisión de la columna."""
    try:
        amount = Decimal(str(value if value not in (None, "") else 0))
    except (InvalidOperation, ValueError) as exc:
        raise CostCenterValidationError(f"{label} debe ser numérico.") from exc
    if amount < 0:
        raise CostCenterValidationError(f"{label} no puede ser negativo.")
    return amount.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)


def normalize_cost_center(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida y normaliza el alta de un centro (B2.1) antes de tocar el motor."""
    codigo = str(payload.get("codigo", "")).strip().upper()
    if not COST_CENTER_CODE.fullmatch(codigo):
        raise CostCenterValidationError(
            "El código del centro debe tener entre 1 y 7 letras o dígitos."
        )
    nombre = str(payload.get("nombre", "")).strip()
    if not nombre:
        raise CostCenterValidationError("El nombre del centro es obligatorio.")
    if len(nombre) > COST_CENTER_NAME_SIZE:
        raise CostCenterValidationError(
            f"El nombre del centro admite máximo {COST_CENTER_NAME_SIZE} caracteres."
        )
    centro_padre = str(payload.get("centroPadre", "") or "").strip().upper()
    if centro_padre and not COST_CENTER_CODE.fullmatch(centro_padre):
        raise CostCenterValidationError("El código del centro padre no es válido.")
    if centro_padre and centro_padre == codigo:
        raise CostCenterValidationError("El centro no puede ser su propio padre.")
    cuenta = str(payload.get("cuenta", "") or "").strip()
    if cuenta and not ACCOUNT_CODE.fullmatch(cuenta):
        raise CostCenterValidationError("La cuenta debe tener entre 1 y 12 dígitos.")
    hist = str(payload.get("hist", "") or "").strip()
    if len(hist) > 10:
        raise CostCenterValidationError("El indicador histórico admite máximo 10 caracteres.")
    codigo_item = str(payload.get("codigoItem", "") or "").strip()
    if len(codigo_item) > 20:
        raise CostCenterValidationError("El código de ítem admite máximo 20 caracteres.")
    concepto = str(payload.get("concepto", "") or "").strip()
    if len(concepto) > 60:
        raise CostCenterValidationError("El concepto admite máximo 60 caracteres.")
    try:
        tipo = int(payload.get("tipo") or 0)
    except (TypeError, ValueError) as exc:
        raise CostCenterValidationError("El tipo del centro debe ser numérico.") from exc
    if tipo < 0:
        raise CostCenterValidationError("El tipo del centro no puede ser negativo.")
    return {
        "codigo": codigo,
        "nombre": nombre,
        "centroPadre": centro_padre,
        "hist": hist,
        "tipo": tipo,
        "valor": _decimal(payload.get("valor"), 2, "El valor"),
        "porcentaje": _decimal(payload.get("porcentaje"), 6, "El porcentaje"),
        "codigoItem": codigo_item,
        "cuenta": cuenta,
        "concepto": concepto,
    }


def cost_center_item(data: dict[str, Any], parent: str) -> dict[str, Any]:
    """Elemento devuelto por el alta, con el campo de entrada ``centroPadre``.

    No es el mismo objeto del ``GET`` (que expone ``padre``): aquel contrato no se
    toca (R2), mientras el alta ecoa los campos que el cliente envió.
    """
    return {
        "codigo": data["codigo"],
        "nombre": data["nombre"],
        "centroPadre": parent,
        "nivel": 2 if parent else 1,
        "hist": data["hist"],
        "tipo": data["tipo"],
        "valor": float(data["valor"]),
        "porcentaje": float(data["porcentaje"]),
        "codigoItem": data["codigoItem"],
        "cuenta": data["cuenta"],
        "concepto": data["concepto"],
    }


def _cost_center_exists(connection: Any, company_id: int, code: str) -> bool:
    """¿Existe el código de centro dentro de la compañía en CONCECOS?"""
    return _one(
        connection,
        "SELECT TOP 1 CODIGO FROM CONCECOS WHERE CIA = ? AND CODIGO = ?",
        [(ADO_TYPE_INTEGER, 0, company_id), (ADO_TYPE_VARCHAR, 7, code)],
    ) is not None


def _ads_parent(connection: Any, company_id: int, data: dict[str, Any]) -> str:
    """Padre efectivo del centro en CONCECOS.

    La tabla no tiene columna padre: la jerarquía se deriva del prefijo de dos
    caracteres de un código de tres (``_cost_centers_from_rows``). Por eso un
    ``centroPadre`` explícito solo puede coincidir con ese prefijo; de lo
    contrario el legado no podría representarlo y se rechaza con 422.
    """
    codigo = data["codigo"]
    derivado = codigo[:2] if len(codigo) == 3 else ""
    padre = data["centroPadre"]
    if padre:
        if not _cost_center_exists(connection, company_id, padre):
            raise CostCenterValidationError(f"No existe el centro padre {padre}.")
        if padre != derivado:
            raise CostCenterValidationError(
                "CONCECOS no guarda un campo padre: la jerarquía se deriva del prefijo "
                f"de dos caracteres, así que el padre de {codigo} solo puede ser "
                f"{derivado or '(ninguno)'}."
            )
        return padre
    if derivado and _cost_center_exists(connection, company_id, derivado):
        return derivado
    return ""


def _nullable_boolean(value: Any) -> bool | None:
    """Mantiene NULL separado de False para no alterar el estado heredado."""
    return None if value is None else _boolean(value)


def _cost_centers_from_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convierte filas CONCECOS y deriva la jerarquía solo por prefijos válidos."""
    codes = {_text(row.get("CODIGO")) for row in rows}
    items: list[dict[str, Any]] = []
    for row in rows:
        code = _text(row.get("CODIGO"))
        parent = code[:2] if len(code) == 3 and code[:2] in codes else ""
        items.append(
            {
                "codigo": code,
                "nombre": _text(row.get("NOMBRE")),
                "nivel": 2 if parent else 1,
                "padre": parent,
                "carpeta": _text(row.get("CARPETA")),
                "tipo": int(_number(row.get("TIPO"))),
                "habilita": _nullable_boolean(row.get("HABILITA")),
                "hist": _text(row.get("HIST")),
                "valor": _number(row.get("VALOR")),
                "porcentaje": _number(row.get("PORCEN")),
                "valorPorcentaje": _number(row.get("VLRPOR")),
                "codigoItem": _text(row.get("CODITEM")),
                "cuenta": _text(row.get("CUENTA")),
                "concepto": _text(row.get("CONCEPTO")),
            }
        )
    return items


def list_cost_centers(company_code: str) -> list[dict[str, Any]]:
    """Lista los centros exclusivos de una CIA, ordenados por su código."""
    company_id = normalize_company_code(company_code)
    sql = (
        "SELECT CODIGO, NOMBRE, HIST, VALOR, PORCEN, VLRPOR, CODITEM, "
        "CUENTA, CONCEPTO, CARPETA, TIPO, HABILITA FROM CONCECOS "
        f"WHERE CIA = {company_id} ORDER BY CODIGO"
    )
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {company_code}.")
        recordset = _open_recordset(connection, sql)
        try:
            return _cost_centers_from_rows(list(_rows(recordset)))
        finally:
            recordset.Close()


def create_cost_center(
    company_code: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un centro de costo de la compañía activa (B2.1).

    Escribe en ``CONCECOS`` con ``CIA`` como parte de la clave. No hay columna
    padre: la jerarquía queda determinada por el prefijo de dos caracteres, así
    que no puede formarse un ciclo (ver ``_ads_parent``).
    """
    data = normalize_cost_center(payload)
    company_id = normalize_company_code(company_code)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {company_code}.")
        if _cost_center_exists(connection, company_id, data["codigo"]):
            raise CostCenterAlreadyExists(
                f"Ya existe el centro {data['codigo']} en la compañía {company_code}."
            )
        parent = _ads_parent(connection, company_id, data)
        if data["cuenta"] and not _catalog_account_exists(
            connection, company_id, data["cuenta"]
        ):
            raise CostCenterValidationError(
                f"No existe la cuenta {data['cuenta']} en el plan de la compañía."
            )
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "INSERT INTO CONCECOS "
                "(CIA, CODIGO, NOMBRE, HIST, TIPO, VALOR, PORCEN, CODITEM, CUENTA, CONCEPTO) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (ADO_TYPE_INTEGER, 0, company_id),
                    (ADO_TYPE_VARCHAR, 7, data["codigo"]),
                    (ADO_TYPE_VARCHAR, COST_CENTER_NAME_SIZE, data["nombre"]),
                    (ADO_TYPE_VARCHAR, 10, data["hist"]),
                    (ADO_TYPE_INTEGER, 0, data["tipo"]),
                    (ADO_TYPE_DOUBLE, 0, float(data["valor"])),
                    (ADO_TYPE_DOUBLE, 0, float(data["porcentaje"])),
                    (ADO_TYPE_VARCHAR, 20, data["codigoItem"]),
                    (ADO_TYPE_VARCHAR, 12, data["cuenta"]),
                    (ADO_TYPE_VARCHAR, 60, data["concepto"]),
                ],
            )
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    item = cost_center_item(data, parent)
    try:
        register_master_creation(user, "CONCECOS", data["codigo"], "Alta de centro de costo")
    except Exception as exc:
        item["advertencia"] = (
            f"El centro se creó, pero no fue posible registrar la bitácora: {exc}"
        )
    return item
