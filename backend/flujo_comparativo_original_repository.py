"""M. Definiciones CONINF1 y comparativo anual INFORM1/INFORM2.

CONINF1 ahora tiene CIA porque todos los ejercicios comparten un ADD; el
original tenía un archivo privado por compañía. Los acumulados de cuentas
se leen, nunca se escriben de regreso a CONINF1 durante la impresión.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from .ads_repository import (ADO_TYPE_BOOLEAN, ADO_TYPE_DOUBLE, ADO_TYPE_INTEGER,
                             ADO_TYPE_VARCHAR, CATALOG_ACCOUNT_FILTER, _execute,
                             _number, _text, ads_connection, ads_odbc_connection,
                             normalize_company_code)
from .informes_terceros_repository import _read


def list_flow_definitions(cia: str) -> list[dict[str, Any]]:
    company = normalize_company_code(cia)
    with ads_odbc_connection() as connection:
        source = _read(connection, "SELECT NIVEL, CUENTA, NOMBRE, TIPO, PPTO, VLRBASE FROM CONINF1 "
                       f"WHERE CIA = {company} ORDER BY NIVEL")
    return [{"nivel": _text(row.get("NIVEL")).strip(), "cuenta": _text(row.get("CUENTA")).strip(),
             "nombre": _text(row.get("NOMBRE")).strip(), "tipo": _text(row.get("TIPO")).strip(),
             "presupuesto": round(float(_number(row.get("PPTO"))), 2),
             "valorBase": bool(row.get("VLRBASE"))} for row in source]


def save_flow_definition(cia: str, payload: dict[str, Any], *, old_level: str = "") -> dict[str, Any]:
    company = normalize_company_code(cia)
    level = str(payload.get("nivel", "")).strip()
    account = str(payload.get("cuenta", "")).strip()
    name = str(payload.get("nombre", "")).strip()
    kind = str(payload.get("tipo", "+")).strip()
    budget = float(payload.get("presupuesto", 0))
    base = bool(payload.get("valorBase", False))
    if not 1 <= len(level) <= 4 or not re.fullmatch(r"[0-9A-Za-z]+", level):
        raise ValueError("Nivel debe tener de 1 a 4 caracteres alfanuméricos.")
    if not 1 <= len(account) <= 12 or not account.isdigit():
        raise ValueError("Indique una cuenta de hasta 12 dígitos.")
    if not name or len(name) > 30 or kind not in {"+", "-"} or budget < 0:
        raise ValueError("Nombre, operación o presupuesto no válidos.")
    if old_level and old_level != level:
        raise ValueError("El nivel no se modifica; cree una definición nueva.")
    with ads_connection() as connection:
        account_exists = _read(connection, "SELECT TOP 1 CODIGO FROM CONMAE "
            f"WHERE CIA = {company} AND CODIGO = '{account}' AND {CATALOG_ACCOUNT_FILTER}")
        if not account_exists:
            raise ValueError("La cuenta indicada no existe en esta compañía.")
        existing = _read(connection, f"SELECT TOP 1 NIVEL FROM CONINF1 WHERE CIA = {company} AND NIVEL = '{level}'")
        if existing and not old_level:
            raise ValueError("Ese nivel ya existe para la compañía.")
        if old_level and not existing:
            raise ValueError("No existe la definición que intenta modificar.")
        common = [(ADO_TYPE_VARCHAR, 12, account), (ADO_TYPE_VARCHAR, 30, name),
                  (ADO_TYPE_VARCHAR, 1, kind), (ADO_TYPE_DOUBLE, 0, budget),
                  (ADO_TYPE_BOOLEAN, 0, base)]
        connection.BeginTrans()
        try:
            if old_level:
                _execute(connection, "UPDATE CONINF1 SET CUENTA = ?, NOMBRE = ?, TIPO = ?, PPTO = ?, "
                         "VLRBASE = ? WHERE CIA = ? AND NIVEL = ?",
                         common + [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 4, level)])
            else:
                _execute(connection, "INSERT INTO CONINF1 (CIA, NIVEL, CUENTA, NOMBRE, TIPO, PPTO, VLRBASE) "
                         "VALUES (?, ?, ?, ?, ?, ?, ?)",
                         [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 4, level)] + common)
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    return {"nivel": level, "cuenta": account, "nombre": name, "tipo": kind,
            "presupuesto": budget, "valorBase": base}


def delete_flow_definition(cia: str, level: str) -> None:
    company = normalize_company_code(cia)
    if not re.fullmatch(r"[A-Za-z0-9]{1,4}", level):
        raise ValueError("Nivel no válido.")
    with ads_connection() as connection:
        existing = _read(connection, f"SELECT TOP 1 NIVEL FROM CONINF1 WHERE CIA = {company} AND NIVEL = '{level}'")
        if not existing:
            raise ValueError("La definición ya no existe.")
        _execute(connection, "DELETE FROM CONINF1 WHERE CIA = ? AND NIVEL = ?",
                 [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_VARCHAR, 4, level)])


def build_flow_comparison(cia: str, year: int, prior_company: str) -> dict[str, Any]:
    company = normalize_company_code(cia)
    previous = normalize_company_code(prior_company)
    if not 1900 <= year <= 2100:
        raise ValueError("El ejercicio no es válido.")
    fields = ", ".join(f"MACMDEB{m:02d}, MACMCRE{m:02d}" for m in range(1, 13))
    with ads_odbc_connection() as connection:
        companies = _read(connection, f"SELECT EMPCOD, EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD IN ({company}, {previous})")
        indexed = {int(_number(item.get("EMPCOD"))): item for item in companies}
        if company not in indexed or previous not in indexed:
            raise ValueError("La compañía actual o la comparativa no existe.")
        control = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
        available = int(_number(control[0].get("CTANO"))) if control else 0
        if year != available:
            raise ValueError(f"Los acumulados corresponden al ejercicio {available}.")
        definitions = _read(connection, f"SELECT NIVEL, CUENTA, NOMBRE, TIPO, PPTO, VLRBASE FROM CONINF1 WHERE CIA = {company} ORDER BY NIVEL")
        if not definitions:
            raise ValueError("Defina primero las cuentas de este informe.")
        current = {_text(item.get("CODIGO")).strip(): item for item in _read(connection,
            "SELECT CODIGO, MNOMBRE, " + fields + " FROM CONMAE "
            f"WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER}")}
        prior = {_text(item.get("CODIGO")).strip(): item for item in _read(connection,
            "SELECT CODIGO, MNOMBRE, " + fields + " FROM CONMAE "
            f"WHERE CIA = {previous} AND {CATALOG_ACCOUNT_FILTER}")}

    entries: list[dict[str, Any]] = []
    for definition in definitions:
        if len(_text(definition.get("NIVEL")).strip()) != 4:
            continue
        code = _text(definition.get("CUENTA")).strip()
        actual_row, earlier_row = current.get(code, {}), prior.get(code, {})
        sign = 1 if code.startswith(("1", "5", "6", "7", "8", "9")) else -1
        def series(row: dict[str, Any]) -> list[float]:
            # INFORM21 lee MACMDEB03/MACMCRE03 dos veces (marzo y abril).
            # Se conserva para que la impresión coincida con el origen.
            return [round((_number(row.get(f"MACMDEB{3 if m == 4 else m:02d}")) +
                           _number(row.get(f"MACMCRE{3 if m == 4 else m:02d}"))) * sign / 1_000_000, 2)
                    for m in range(1, 13)]
        months = series(actual_row)
        previous_total = round(sum(series(earlier_row)), 2)
        entries.append({"level": _text(definition.get("NIVEL")).strip(),
                        "name": _text(definition.get("NOMBRE")).strip(),
                        "type": _text(definition.get("TIPO")).strip(),
                        "months": months, "actual": round(sum(months), 2),
                        "prior": previous_total, "budget": round(_number(definition.get("PPTO")) / 1_000_000, 2),
                        "base": bool(definition.get("VLRBASE"))})
    base_actual = next((item["actual"] for item in reversed(entries) if item["base"]), 0.0)
    base_prior = next((item["prior"] for item in reversed(entries) if item["base"]), 0.0)
    columns = [{"label": "Nivel / concepto", "money": False}]
    columns.extend({"label": f"Mes {month:02d}", "money": True} for month in range(1, 13))
    columns.extend({"label": label, "money": True} for label in
                   ("Actual", "% actual", "Anterior", "% anterior", "Variación %", "Presupuesto", "Variación ppto %"))
    rows: list[list[str | float]] = []
    kinds: list[str] = []
    totals = [0.0] * 15

    def ratio(numerator: float, denominator: float) -> float:
        return round(numerator * 100 / denominator, 2) if denominator else 0.0

    def values(months: list[float], actual: float, prior_total: float, budget: float) -> list[float]:
        return [*[round(value, 2) for value in months], round(actual, 2), ratio(actual, base_actual),
                round(prior_total, 2), ratio(prior_total, base_prior),
                ratio(actual - prior_total, prior_total), round(budget, 2), ratio(budget - actual, budget)]

    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in entries:
        groups[entry["level"][:2]].append(entry)
    for prefix, group in groups.items():
        group_months = [0.0] * 12
        actual = prior_total = budget = 0.0
        for entry in group:
            rows.append([f"{entry['level']} {entry['name']}", *values(entry["months"], entry["actual"], entry["prior"], entry["budget"])])
            kinds.append("detalle")
            multiplier = 1 if entry["type"] == "+" else -1
            for index, value in enumerate(entry["months"]):
                group_months[index] += value * multiplier
            actual += entry["actual"] * multiplier
            prior_total += entry["prior"] * multiplier
            budget += entry["budget"] * multiplier
        rows.append([group[0]["name"], *values(group_months, actual, prior_total, budget)])
        kinds.append("subtotal")
        multiplier = 1 if group[0]["type"] == "+" else -1
        for index, value in enumerate(group_months):
            totals[index] += value * multiplier
        totals[12] += actual * multiplier
        totals[13] += prior_total * multiplier
        totals[14] += budget * multiplier
    rows.append(["TOTAL GENERAL", *values(totals[:12], totals[12], totals[13], totals[14])])
    kinds.append("total-general")
    header = indexed[company]
    return {"id": "flujo-comparativo", "compania": {"codigo": f"{company:03d}",
                "nombre": _text(header.get("EMPNOM")).strip(), "nit": _text(header.get("EMPNIT")).strip()},
            "anio": year, "mesDesde": 1, "mesHasta": 12,
            "columnas": columns, "filas": rows, "tipos": kinds, "count": len(rows),
            "source": "CONINF1 / CONMAE",
            "nota": f"Comparativo anual con compañía {previous:03d}; cifras en millones."}
