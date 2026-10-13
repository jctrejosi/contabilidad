"""Auditoría mensual de MOV01, adaptada de MOVDOCK/MOVDOCK2.

El original suma partidas por número de documento y modifica NIT/TFASE
silenciosamente. Esta versión separa documentos por su identidad completa y
solo informa anomalías: jamás escribe en Advantage.
"""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Any, Iterable

from .ads_repository import (
    CATALOG_ACCOUNT_FILTER, _boolean, _number, _open_recordset, _rows, _text,
    ads_odbc_connection, normalize_company_code,
)


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _stream(connection: Any, sql: str) -> Iterable[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try:
        yield from _rows(recordset)
    finally:
        recordset.Close()


def _identity(row: dict[str, Any]) -> tuple[str, str, str, str]:
    return tuple(_text(row.get(field)).strip() for field in
                 ("TCOMPR", "TIPODOC", "TDOCUM", "TFECHA"))  # type: ignore[return-value]


def _issue(kind: str, key: tuple[str, str, str, str], row: dict[str, Any] | None,
           message: str, *, balance: float | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {
        "tipo": kind, "comprobante": key[0], "tipoDocumento": key[1],
        "documento": key[2], "fecha": key[3],
        "cuenta": _text(row.get("CODIGO")).strip() if row else "",
        "tercero": _text(row.get("NIT")).strip() if row else "",
        "centro": _text(row.get("TFASE")).strip() if row else "",
        "secuencia": _text(row.get("TSEC")).strip() if row else "",
        "mensaje": message,
    }
    if balance is not None:
        result["diferencia"] = balance
    return result


def analyze_movement(
    rows: Iterable[dict[str, Any]], accounts: dict[str, dict[str, Any]],
    centers: set[str], valid_thirds: set[str],
) -> dict[str, Any]:
    """Evalúa las partidas en memoria; aislada para pruebas de regresión."""
    documents: dict[tuple[str, str, str, str], Decimal] = defaultdict(Decimal)
    samples: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    issues: list[dict[str, Any]] = []
    count = 0
    for row in rows:
        count += 1
        key = _identity(row)
        samples.setdefault(key, row)
        documents[key] += Decimal(str(_number(row.get("TVALOR"))))
        code = _text(row.get("CODIGO")).strip()
        nit = _text(row.get("NIT")).strip()
        center = _text(row.get("TFASE")).strip()
        account = accounts.get(code)
        if account is None:
            issues.append(_issue("cuenta_inexistente", key, row, "La cuenta no existe en el plan de la compañía."))
            continue
        requires_third = _boolean(account.get("MCTAPAGOS")) or _text(account.get("MIVA_RET")).strip().upper() in {"I", "R"}
        requires_center = _boolean(account.get("MCOSTOS"))
        if requires_third and not nit:
            issues.append(_issue("tercero_faltante", key, row, "La cuenta exige un tercero."))
        elif requires_third and nit not in valid_thirds:
            issues.append(_issue("tercero_inexistente", key, row, "El tercero no existe."))
        elif not requires_third and nit:
            issues.append(_issue("tercero_inesperado", key, row, "La cuenta no maneja terceros."))
        if requires_center and not center:
            issues.append(_issue("centro_faltante", key, row, "La cuenta exige un centro de costo."))
        elif requires_center and center not in centers:
            issues.append(_issue("centro_inexistente", key, row, "El centro de costo no existe en la compañía."))
        elif not requires_center and center:
            issues.append(_issue("centro_inesperado", key, row, "La cuenta no maneja centros de costo."))
    for key, amount in sorted(documents.items()):
        rounded = amount.quantize(Decimal("0.01"))
        if rounded:
            issues.append(_issue("documento_descuadrado", key, samples[key],
                                 "Los débitos y créditos del documento no suman cero.",
                                 balance=float(rounded)))
    by_type: dict[str, int] = defaultdict(int)
    for item in issues:
        by_type[item["tipo"]] += 1
    return {"partidas": count, "documentos": len(documents),
            "documentosDescuadrados": by_type.get("documento_descuadrado", 0),
            "incidencias": issues, "conteos": dict(by_type)}


def audit_documents_movement(cia: str, year: int, month: int) -> dict[str, Any]:
    """Consulta compañía/ejercicio/mes y devuelve incidencias sin escrituras."""
    if not 1900 <= year <= 2100 or not 1 <= month <= 12:
        raise ValueError("Indique un año y un mes entre 01 y 12.")
    company = normalize_company_code(cia)
    with ads_odbc_connection() as connection:
        if not _read(connection, f"SELECT TOP 1 EMPCOD FROM CONEMP WHERE EMPCOD = {company}"):
            raise ValueError(f"No existe la compañía {company:03d}.")
        account_rows = _read(connection,
            "SELECT CODIGO, MCTAPAGOS, MCOSTOS, MIVA_RET FROM CONMAE "
            f"WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER}")
        accounts = {_text(item.get("CODIGO")).strip(): item for item in account_rows}
        centers = {_text(item.get("CODIGO")).strip() for item in _read(connection,
            f"SELECT CODIGO FROM CONCECOS WHERE CIA = {company}")}
        sql = ("SELECT TCOMPR, TIPODOC, TDOCUM, TFECHA, TSEC, CODIGO, NIT, TFASE, TVALOR "
               f"FROM MOV01 WHERE CONCIA = {company} AND CONANO = {year} AND CONMES = {month} "
               "ORDER BY TCOMPR, TIPODOC, TDOCUM, TFECHA, TSEC")
        # Primero se obtienen solo los NIT distintos; las partidas se analizan
        # secuencialmente para no cargar todo el movimiento del mes en memoria.
        nits = sorted({_text(row.get("NIT")).strip() for row in _stream(connection,
            "SELECT DISTINCT NIT FROM MOV01 "
            f"WHERE CONCIA = {company} AND CONANO = {year} AND CONMES = {month}")
            if _text(row.get("NIT")).strip()})
        valid_thirds: set[str] = set()
        for offset in range(0, len(nits), 100):
            quoted = ", ".join("'" + nit.replace("'", "''") + "'" for nit in nits[offset:offset + 100])
            valid_thirds.update(_text(item.get("CCODIGO")).strip() for item in
                _read(connection, f"SELECT CCODIGO FROM FADCLI WHERE CCODIGO IN ({quoted})"))
        result = analyze_movement(_stream(connection, sql), accounts, centers, valid_thirds)
    return {"compania": f"{company:03d}", "anio": year, "mes": month,
            "soloLectura": True, **result}
