"""Balances L desde COCENTRO, equivalente compartido de los CCxxxx Harbour.

La tabla nueva guarda detalle cuenta/centro/tercero; el código original abría
un archivo CC por centro con niveles padres ya acumulados. Aquí se reconstruyen
esos padres una sola vez desde cuentas hoja, evitando duplicar auxiliares.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, _number, _text, ads_odbc_connection, normalize_company_code
from .balance_comprobacion_repository import _assemble_report
from .informes_terceros_repository import _read

REPORT_IDS = {"balance-acumulado", "balance-mensual-centro", "clasificacion-centros",
              "clasificacion-centro-tercero", "discriminados-mes"}
PREFIX_LENGTHS = (1, 2, 4, 6, 9, 12)


def _centers(raw: str) -> list[str]:
    selected = list(dict.fromkeys(part.strip().upper() for part in re.split(r"[,;\n]+", raw) if part.strip()))
    if any(len(part) > 7 or not re.fullmatch(r"[A-Z0-9 -]+", part) for part in selected):
        raise ValueError("La selección de centros contiene un código inválido.")
    return selected


def _months(row: dict[str, Any]) -> list[float]:
    result = []
    for month in range(19):
        result.extend((float(_number(row.get(f"DEB{month:02d}"))),
                       float(_number(row.get(f"CRE{month:02d}")))))
    return result


def build_center_trial_balance(
    report_id: str, cia: str, year: int, month: int, *,
    center: str = "", selected_centers: str = "", level: int = 4,
    include_results: bool = True, include_zero: bool = False,
    include_thirds: bool = False,
) -> dict[str, Any]:
    if report_id not in REPORT_IDS:
        raise ValueError("Balance de centros no reconocido.")
    if report_id == "discriminados-mes":
        level = 12
        # INFOR9L6 agrega por cuenta; a diferencia de INFOR9L6_2 no crea
        # registros por NIT, aunque INFOR2AJ fuerce WTERCE=.T.
        include_thirds = False
    if not 1900 <= year <= 2100 or not 1 <= month <= 18 or level not in (4, 6, 9, 12):
        raise ValueError("Indique un mes 01–18 y nivel válido.")
    single = report_id in {"balance-acumulado", "balance-mensual-centro"}
    chosen = _centers(center if single else selected_centers)
    if single and len(chosen) != 1:
        raise ValueError("Seleccione un centro de costo.")
    if not single and not chosen:
        raise ValueError("Seleccione los centros de costo que desea clasificar.")
    company = normalize_company_code(cia)
    quoted = ", ".join(f"'{code}'" for code in chosen)
    with ads_odbc_connection() as connection:
        companies = _read(connection, f"SELECT TOP 1 EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = {company}")
        if not companies:
            raise ValueError(f"No existe la compañía {company:03d}.")
        control = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
        available = int(_number(control[0].get("CTANO"))) if control else 0
        if year != available:
            raise ValueError(f"COCENTRO contiene los acumulados del ejercicio {available}.")
        valid = {_text(row.get("CODIGO")).strip() for row in _read(connection,
            f"SELECT CODIGO FROM CONCECOS WHERE CIA = {company} AND CODIGO IN ({quoted})")}
        if missing := set(chosen) - valid:
            raise ValueError("No existen estos centros en la compañía: " + ", ".join(sorted(missing)))
        month_fields = ", ".join(f"DEB{m:02d}, CRE{m:02d}" for m in range(19))
        raw = _read(connection, "SELECT CODIGO, CENTRO, NIT, " + month_fields +
                    f" FROM COCENTRO WHERE CIA = {company} AND CENTRO IN ({quoted}) ORDER BY CODIGO, CENTRO, NIT")
        account_names = {_text(row.get("CODIGO")).strip(): _text(row.get("MNOMBRE")).strip()
                         for row in _read(connection, "SELECT CODIGO, MNOMBRE FROM CONMAE "
                            f"WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER}")}
        third_codes = sorted({_text(row.get("NIT")).strip() for row in raw if _text(row.get("NIT")).strip()}) if include_thirds else []
        third_names: dict[str, str] = {}
        for offset in range(0, len(third_codes), 100):
            batch = ", ".join(f"'{code.replace(chr(39), chr(39) * 2)}'" for code in third_codes[offset:offset + 100])
            for row in _read(connection, f"SELECT CCODIGO, CNOMBRE FROM FADCLI WHERE CCODIGO IN ({batch})"):
                third_names[_text(row.get("CCODIGO")).strip()] = _text(row.get("CNOMBRE")).strip()

    codes = sorted({_text(row.get("CODIGO")).strip() for row in raw if _text(row.get("CODIGO")).strip()})
    # Si existe una cuenta hija, el registro padre ya representa su acumulado
    # en algunas copias: solo se suman cuentas hoja para no duplicarlo.
    leaves = {code for code in codes if not any(other != code and other.startswith(code) for other in codes)}
    by_code: dict[str, list[float]] = defaultdict(lambda: [0.0] * 38)
    by_third: dict[tuple[str, str], list[float]] = defaultdict(lambda: [0.0] * 38)
    for row in raw:
        code = _text(row.get("CODIGO")).strip()
        if code not in leaves:
            continue
        amounts = _months(row)
        nit = _text(row.get("NIT")).strip()
        for size in PREFIX_LENGTHS:
            if size > len(code):
                break
            prefix = code[:size]
            accum = by_code[prefix]
            for index, amount in enumerate(amounts):
                accum[index] += amount
            if include_thirds and nit and size <= level:
                detail = by_third[(prefix, nit)]
                for index, amount in enumerate(amounts):
                    detail[index] += amount

    if include_zero:
        for code in account_names:
            if len(code) <= level:
                by_code.setdefault(code, [0.0] * 38)

    def as_balance_row(code: str, amounts: list[float], *, nit: str = "") -> dict[str, Any]:
        data: dict[str, Any] = {"CODIGO": code, "MNOMBRE": third_names.get(nit, "") if nit else account_names.get(code, ""),
                                "MSALDO": round(amounts[0] + amounts[1], 2)}
        if nit:
            data["NIT"] = nit
        for m in range(1, 19):
            data[f"MACMDEB{m:02d}"] = round(amounts[2 * m], 2)
            data[f"MACMCRE{m:02d}"] = round(amounts[2 * m + 1], 2)
        return data

    source_rows = [as_balance_row(code, amounts) for code, amounts in sorted(by_code.items())]
    third_rows = [as_balance_row(code, amounts, nit=nit) for (code, nit), amounts in sorted(by_third.items())] if include_thirds else None
    # INFOR9L(3) tiene un nombre que sugiere columnas mensuales, pero el
    # Harbour original llama INFOR21J(1) -> INFOR2AJ: imprime el balance
    # acumulado. No inventamos una matriz que el programa no genera.
    first = 1 if report_id != "balance-mensual-centro" else month
    report = _assemble_report(company, companies[0], year, first, month, level, include_zero,
                              source_rows, include_results=include_results, third_rows=third_rows)
    columns = [{"label": label, "money": index >= 3} for index, label in enumerate(
        ["Cuenta / sección", "Tercero", "Nombre", "Saldo anterior", "Débitos", "Créditos", "Saldo actual"])]
    rows = [[item["cuenta"], item["nit"], item["nombre"], item["saldoAnterior"], item["debito"],
             item["credito"], item["saldoActual"]] for item in report["items"]]
    if report_id == "balance-mensual-centro":
        columns.pop(3)
        rows = [row[:3] + row[4:] for row in rows]
    return {"id": report_id, "compania": report["compania"], "anio": year,
            "mesDesde": first, "mesHasta": month, "columnas": columns,
            "filas": rows, "tipos": [item["tipo"] for item in report["items"]],
            "count": len(rows), "source": "COCENTRO / CONMAE",
            "nota": f"Balance por centro · {', '.join(chosen)} · mes {month:02d}."}
