"""Consulta paginada del movimiento contable mensual almacenado en MOV01.

MOV01 puede contener miles de asientos. Por esa razón este módulo nunca lee la
tabla completa: exige compañía, año y mes, aplica los filtros en Advantage y
trae como máximo una página. Un registro con ``TVALOR`` positivo es débito y
uno con valor negativo es crédito, tal como lo maneja CONTABDSI original.
"""

from __future__ import annotations

import re
from typing import Any

from .ads_repository import (
    CompanyNotFound,
    _company_exists,
    _number,
    _open_recordset,
    _rows,
    _text,
    ads_odbc_connection,
    normalize_company_code,
)


ACCOUNT_CODE = re.compile(r"^[0-9]{1,12}$")
FILTER_CODE = re.compile(r"^[A-Za-z0-9.-]+$")


def _date_yyyymmdd(value: Any) -> str:
    """Convierte la fecha numérica heredada (AAAAMMDD) al formato ISO."""
    number = int(_number(value))
    text = str(number)
    if number <= 0 or len(text) != 8:
        return ""
    return f"{text[:4]}-{text[4:6]}-{text[6:8]}"


def _movement_from_row(row: dict[str, Any]) -> dict[str, Any]:
    """Traduce una fila MOV01 sin completar datos con maestros externos."""
    value = _number(row.get("TVALOR"))
    year = int(_number(row.get("CONANO")))
    month = int(_number(row.get("CONMES")))
    movement_nit = _text(row.get("NIT"))
    third_party_nit = _text(row.get("NITN"))
    return {
        "periodo": f"{year:04d}-{month:02d}",
        "fecha": _date_yyyymmdd(row.get("TFECHA")),
        "cuenta": _text(row.get("CODIGO")),
        "nit": third_party_nit or movement_nit,
        "nitMovimiento": movement_nit,
        "nitTercero": third_party_nit,
        "comprobante": _text(row.get("TCOMPR")),
        "centro": _text(row.get("TFASE")),
        "tipoDoc": _text(row.get("TIPODOC")),
        "documento": _text(row.get("TDOCUM")),
        "docAfectado": _text(row.get("TDOCUM2")),
        "concepto": _text(row.get("TDETALLE")),
        "debito": value if value > 0 else 0.0,
        "credito": abs(value) if value < 0 else 0.0,
        "valor": value,
        "base": _number(row.get("TBASE")),
        "claseFiscal": _text(row.get("TIVA_RET")),
        "saldo": _number(row.get("TSALDO")),
        "secuencia": int(_number(row.get("TSEC"))),
        "usuario": _text(row.get("TUSUA")),
    }


def _validated_filter(value: str, label: str, max_length: int) -> str:
    """Acepta códigos simples y rechaza texto que pueda alterar el SQL."""
    value = value.strip()
    if not value:
        return ""
    if len(value) > max_length or not FILTER_CODE.fullmatch(value):
        raise ValueError(f"El filtro {label} contiene caracteres no válidos.")
    return value


def _where_clause(
    company_id: int,
    year: int,
    month: int,
    *,
    account_from: str = "",
    account_to: str = "",
    third_party: str = "",
    voucher: str = "",
    cost_center: str = "",
    document: str = "",
) -> str:
    """Construye las condiciones que se ejecutarán directamente en ADS."""
    account_from = account_from.strip()
    account_to = account_to.strip()
    for value, label in ((account_from, "cuenta desde"), (account_to, "cuenta hasta")):
        if value and not ACCOUNT_CODE.fullmatch(value):
            raise ValueError(f"El filtro {label} debe contener entre 1 y 12 dígitos.")
    third_party = _validated_filter(third_party, "tercero", 15)
    voucher = _validated_filter(voucher, "comprobante", 6)
    cost_center = _validated_filter(cost_center, "centro de costo", 7)
    document = _validated_filter(document, "documento", 12)

    conditions = [f"CONCIA = {company_id}", f"CONANO = {year}", f"CONMES = {month}"]
    if account_from:
        conditions.append(f"CODIGO >= '{account_from}'")
    if account_to:
        conditions.append(f"CODIGO <= '{account_to}'")
    if third_party:
        conditions.append(f"(NIT = '{third_party}' OR NITN = '{third_party}')")
    if voucher:
        conditions.append(f"TCOMPR = '{voucher}'")
    if cost_center:
        conditions.append(f"TFASE = '{cost_center}'")
    if document:
        conditions.append(f"TDOCUM = '{document}'")
    return " WHERE " + " AND ".join(conditions)


def _movement_totals(connection: Any, where: str) -> tuple[float, float]:
    """Debitos y creditos de TODO el periodo filtrado, no solo de la pagina.

    MOV01 guarda el neto de cada renglon en ``TVALOR`` (positivo = debito); con
    eso el total sale de un agregado sobre el mismo ``WHERE`` de la pagina. Es el
    equivalente del agregado que arma el modelo nuevo en PostgreSQL, para que
    ambas herramientas reporten las mismas cifras.
    """
    sql = (
        "SELECT SUM(CASE WHEN TVALOR > 0 THEN TVALOR ELSE 0 END) AS TDEBITO, "
        "SUM(CASE WHEN TVALOR < 0 THEN -TVALOR ELSE 0 END) AS TCREDITO "
        "FROM MOV01" + where
    )
    recordset = _open_recordset(connection, sql)
    try:
        row = next(_rows(recordset), {})
    finally:
        recordset.Close()

    debito = row.get("TDEBITO")
    credito = row.get("TCREDITO")
    if debito is None or credito is None:
        # Algunos proveedores ADO no conservan el alias de una columna calculada;
        # ``_rows`` mantiene el orden de la proyeccion, asi que se cae a el.
        values = list(row.values())
        if debito is None and values:
            debito = values[0]
        if credito is None and len(values) > 1:
            credito = values[1]
    return _number(debito), _number(credito)


def list_monthly_movements(
    cia: str,
    year: int,
    month: int,
    *,
    page: int = 1,
    page_size: int = 100,
    account_from: str = "",
    account_to: str = "",
    third_party: str = "",
    voucher: str = "",
    cost_center: str = "",
    document: str = "",
) -> dict[str, Any]:
    """Consulta una página de MOV01 para los filtros confirmados por el usuario.

    Se solicita una fila adicional para saber si existe página siguiente. Así
    se evita un COUNT completo, costoso sobre el archivo de movimientos.
    """
    company_id = normalize_company_code(cia)
    if not 1900 <= year <= 2100:
        raise ValueError("El año consultado no es válido.")
    if not 1 <= month <= 18:
        raise ValueError("El período consultado debe estar entre 1 y 18.")
    if page < 1:
        raise ValueError("La página debe ser mayor o igual a 1.")
    if not 1 <= page_size <= 200:
        raise ValueError("El tamaño de página debe estar entre 1 y 200.")

    where = _where_clause(
        company_id,
        year,
        month,
        account_from=account_from,
        account_to=account_to,
        third_party=third_party,
        voucher=voucher,
        cost_center=cost_center,
        document=document,
    )
    start_at = (page - 1) * page_size + 1
    columns = (
        "CONANO, CONMES, CODIGO, NIT, NITN, TFECHA, TCOMPR, TFASE, "
        "TIPODOC, TDOCUM, TDOCUM2, TDETALLE, TVALOR, TBASE, TIVA_RET, "
        "TSALDO, TSEC, TUSUA"
    )
    sql = (
        f"SELECT TOP {page_size + 1} START AT {start_at} {columns} FROM MOV01"
        f"{where}"
    )

    # El panel solicita los totales al abrir. ODBC evita el callback nativo
    # C0000005 del proveedor OLE DB sin cambiar filtros ni importes.
    with ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"La compañía {cia} no existe en CONEMP.")
        recordset = _open_recordset(connection, sql)
        try:
            rows = list(_rows(recordset))
        finally:
            recordset.Close()
        debito_total, credito_total = _movement_totals(connection, where)

    has_more = len(rows) > page_size
    items = [_movement_from_row(row) for row in rows[:page_size]]
    return {
        "items": items,
        "page": page,
        "pageSize": page_size,
        "hasMore": has_more,
        "pageDebit": sum(item["debito"] for item in items),
        "pageCredit": sum(item["credito"] for item in items),
        "periodDebit": debito_total,
        "periodCredit": credito_total,
        "periodSaldo": debito_total - credito_total,
    }
