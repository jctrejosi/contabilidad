"""Opciones K.1/K.2: diarios por centro según INFOR0K e INFOR0K2.

MOV01 sustituye los MOVxx originales. Las tablas temporales de Harbour solo
ordenaban/filtraban registros; este informe no modifica movimiento ni índices.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, _number, _text, ads_odbc_connection, normalize_company_code
from .informes_terceros_repository import _read


def _code(value: str, label: str, size: int) -> str:
    result = value.strip().upper()
    if result and (len(result) > size or not re.fullmatch(r"[A-Z0-9 -]+", result)):
        raise ValueError(f"{label} no es válido.")
    return result


def build_center_journal(
    report_id: str, cia: str, year: int, month: int, *,
    account_from: str = "", account_to: str = "",
    center_from: str = "", center_to: str = "",
    selected_centers: str = "", order: str = "cuenta",
    detailed: bool = True,
) -> dict[str, Any]:
    """Genera los encabezados, partidas y cortes de los dos diarios originales.

    ``order=cuenta`` reproduce WTIP=1; ``order=centro`` reproduce WTIP=2.
    La opción continua permite WDTA resumido solo en el segundo orden.
    """
    if report_id not in {"diario-rangos-continuos", "diario-rangos-fijos"}:
        raise ValueError("Diario de centro no reconocido.")
    if not 1900 <= year <= 2100 or not 1 <= month <= 18:
        raise ValueError("Seleccione un mes entre 01 y 18.")
    if order not in {"cuenta", "centro"}:
        raise ValueError("Seleccione el orden por cuenta o centro.")
    first = _code(account_from, "Cuenta inicial", 12)
    last = _code(account_to, "Cuenta final", 12)
    if first and last and first > last:
        raise ValueError("Cuenta inicial mayor que cuenta final.")
    fixed = report_id == "diario-rangos-fijos"
    if fixed:
        centers = [_code(part, "Centro de costo", 7) for part in re.split(r"[,;\n]+", selected_centers)]
        centers = list(dict.fromkeys(center for center in centers if center))
        if not centers:
            raise ValueError("Seleccione por lo menos un centro de costo.")
        if len(centers) > 10:
            raise ValueError("El diario original admite hasta diez centros fijos.")
    else:
        lower = _code(center_from, "Centro inicial", 7)
        upper = _code(center_to, "Centro final", 7)
        if lower and upper and lower > upper:
            raise ValueError("Centro inicial mayor que centro final.")
        centers = []
    company = normalize_company_code(cia)
    where = f"CONCIA = {company} AND CONANO = {year} AND CONMES = {month}"
    if first:
        where += f" AND CODIGO >= '{first}'"
    if last:
        where += f" AND CODIGO <= '{last}'"
    if fixed:
        quoted = ", ".join(f"'{center}'" for center in centers)
        where += f" AND TFASE IN ({quoted})"
    else:
        if lower:
            where += f" AND TFASE >= '{lower}'"
        if upper:
            where += f" AND TFASE <= '{upper}'"
    sort = "CODIGO, TFASE" if order == "cuenta" else "TFASE"
    with ads_odbc_connection() as connection:
        companies = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
        if not companies:
            raise ValueError(f"No existe la compañía {company:03d}.")
        movement = _read(connection,
            "SELECT CODIGO, TFASE, NIT, TFECHA, TCOMPR, TIPODOC, TDOCUM, TDETALLE, TVALOR "
            f"FROM MOV01 WHERE {where} ORDER BY {sort}, TFECHA, TDOCUM, TSEC")
        accounts = _read(connection, f"SELECT CODIGO, MNOMBRE FROM CONMAE WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER}")
        cost_centers = _read(connection, f"SELECT CODIGO, NOMBRE FROM CONCECOS WHERE CIA = {company}")
        third_codes = sorted({_text(item.get("NIT")).strip() for item in movement if _text(item.get("NIT")).strip()})
        third_names: dict[str, str] = {}
        # Consultas por bloques: no cargamos todo FADCLI para un diario pequeño.
        for offset in range(0, len(third_codes), 100):
            quoted = ", ".join(f"'{code.replace(chr(39), chr(39) * 2)}'" for code in third_codes[offset:offset + 100])
            for item in _read(connection, f"SELECT CCODIGO, CNOMBRE FROM FADCLI WHERE CCODIGO IN ({quoted})"):
                third_names[_text(item.get("CCODIGO")).strip()] = _text(item.get("CNOMBRE")).strip()

    account_names = {_text(item.get("CODIGO")).strip(): _text(item.get("MNOMBRE")).strip() for item in accounts}
    center_names = {_text(item.get("CODIGO")).strip(): _text(item.get("NOMBRE")).strip() for item in cost_centers}
    columns = [{"label": label, "money": index >= 8} for index, label in enumerate([
        "Cuenta / corte", "Centro", "Tercero", "Nombre tercero", "Fecha", "Comprobante",
        "Tipo documento", "Documento / concepto", "Débitos", "Créditos",
    ])]
    rows: list[list[str | float]] = []
    kinds: list[str] = []
    total = [0.0, 0.0]

    def add(label: str, values: list[float] | None, kind: str, *, center: str = "") -> None:
        rows.append([label, center, "", "", "", "", "", "",
                     round(values[0], 2) if values else "", round(values[1], 2) if values else ""])
        kinds.append(kind)

    def values(items: list[dict[str, Any]]) -> list[float]:
        amounts = [_number(item.get("TVALOR")) for item in items]
        return [float(round(sum(amount for amount in amounts if amount > 0), 2)),
                float(round(sum(amount for amount in amounts if amount < 0), 2))]

    def output_day(day: int, items: list[dict[str, Any]], *, show_items: bool) -> None:
        if show_items:
            for item in items:
                amount = float(_number(item.get("TVALOR")))
                rows.append([_text(item.get("CODIGO")).strip() if order == "centro" else "",
                             _text(item.get("TFASE")).strip(), _text(item.get("NIT")).strip(),
                             third_names.get(_text(item.get("NIT")).strip(), ""),
                             str(day).zfill(8), _text(item.get("TCOMPR")).strip(),
                             _text(item.get("TIPODOC")).strip(),
                             f"{_text(item.get('TDOCUM')).strip()} {_text(item.get('TDETALLE')).strip()}",
                             round(amount, 2) if amount > 0 else "",
                             round(amount, 2) if amount <= 0 else ""])
                kinds.append("detalle")
        add(f"TOTAL DÍA {str(day).zfill(8)}", values(items), "subtotal")

    if order == "cuenta":
        by_account: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for item in movement:
            by_account[_text(item.get("CODIGO")).strip()].append(item)
        for account, account_items in by_account.items():
            add(f"CUENTA {account} — {account_names.get(account, '')}", None, "seccion")
            by_center: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for item in account_items:
                by_center[_text(item.get("TFASE")).strip()].append(item)
            for center, center_items in by_center.items():
                add(f"CENTRO DE COSTO {center} — {center_names.get(center, '')}", None, "seccion", center=center)
                by_day: dict[int, list[dict[str, Any]]] = defaultdict(list)
                for item in center_items:
                    by_day[int(_number(item.get("TFECHA")))].append(item)
                for day, day_items in by_day.items():
                    output_day(day, day_items, show_items=True)
                add(f"TOTAL C. C. {center}", values(center_items), "subtotal")
            add(f"TOTAL CUENTA {account}", values(account_items), "total-cuenta")
            part = values(account_items)
            total[0] += part[0]
            total[1] += part[1]
    else:
        by_center = defaultdict(list)
        for item in movement:
            by_center[_text(item.get("TFASE")).strip()].append(item)
        for center, center_items in by_center.items():
            add(f"CENTRO DE COSTO {center} — {center_names.get(center, '')}", None, "seccion", center=center)
            by_day: dict[int, list[dict[str, Any]]] = defaultdict(list)
            for item in center_items:
                by_day[int(_number(item.get("TFECHA")))].append(item)
            for day, day_items in by_day.items():
                output_day(day, day_items, show_items=fixed or detailed)
            if fixed or detailed:
                add(f"TOTAL C. C. {center}", values(center_items), "subtotal")
            part = values(center_items)
            total[0] += part[0]
            total[1] += part[1]
    add("TOTAL PERÍODO", total, "total-general")
    header = companies[0]
    return {
        "id": report_id,
        "compania": {"codigo": f"{company:03d}", "nombre": _text(header.get("EMPNOM")).strip(),
                     "nit": _text(header.get("EMPNIT")).strip()},
        "anio": year, "mesDesde": month, "mesHasta": month,
        "columnas": columns, "filas": rows, "tipos": kinds, "count": len(rows),
        "source": "MOV01 / CONMAE / CONCECOS / FADCLI",
        "nota": f"Diario por centro · mes {month:02d} · orden por {order}" +
                (" · centros fijos." if fixed else " · centros continuos."),
    }
