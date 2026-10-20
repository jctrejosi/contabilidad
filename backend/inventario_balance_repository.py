"""Informe B: Inventario y balance, según INFOR09/INFOR21B_3 de Harbour.

El original clasifica el saldo final de cada cuenta de seis dígitos por
RENGLON y lo acumula en los prefijos 1, 2, 4 y 6. Aquí ese cálculo se hace
en memoria: generar un informe nunca debe alterar SALCORRI/SALNOCO de CONMAE.
"""

from __future__ import annotations

from typing import Any

from .ads_repository import CATALOG_ACCOUNT_FILTER, _open_recordset, _rows, _text, ads_connection, normalize_company_code
from .balance_comprobacion_repository import build_trial_balance


def _classification_by_prefix(
    items: list[dict[str, Any]], renglones: dict[str, int]
) -> dict[str, tuple[float, float]]:
    """Equivalente no destructivo de ASIGNA_CORRI para cuentas de 6 dígitos."""
    amounts: dict[str, list[float]] = {}
    for item in items:
        code = _text(item.get("cuenta")).strip()
        if item.get("tipo") != "cuenta" or len(code) != 6 or code not in renglones:
            continue
        # El balance presenta 2/3/4 con signo invertido; ASIGNA_CORRI usa
        # el saldo contable bruto antes de invertirlo para la impresión.
        raw_closing = float(item["saldoActual"]) * (-1 if code[0] in "234" else 1)
        column = 0 if renglones[code] == 1 else 1
        for length in (1, 2, 4, 6):
            bucket = amounts.setdefault(code[:length], [0.0, 0.0])
            bucket[column] += raw_closing
    return {code: (round(values[0], 2), round(values[1], 2)) for code, values in amounts.items()}


def build_inventory_balance(
    cia: str, year: int, month: int, *, include_results: bool = True,
    include_zero: bool = False,
) -> dict[str, Any]:
    """Genera las dos secciones y los nueve campos del informe original."""
    if not 1 <= month <= 18:
        raise ValueError("Seleccione un mes válido entre 01 y 18.")
    company = normalize_company_code(cia)
    # Nivel seis permite obtener los saldos que ASIGNA_CORRI distribuye;
    # solo se imprimen los niveles 1, 2 y 4, como WNIVEL='Cuenta'.
    balance = build_trial_balance(
        cia, year, month, month, level=6,
        include_zero=True, include_results=include_results,
    )
    with ads_connection() as connection:
        rs = _open_recordset(
            connection,
            "SELECT CODIGO, RENGLON FROM CONMAE "
            f"WHERE CIA = {company} AND {CATALOG_ACCOUNT_FILTER}",
        )
        try:
            renglones = {
                _text(row.get("CODIGO")).strip(): int(float(row.get("RENGLON") or 0))
                for row in _rows(rs)
                if len(_text(row.get("CODIGO")).strip()) == 6
            }
        finally:
            rs.Close()

    classified = _classification_by_prefix(balance["items"], renglones)
    rows: list[list[Any]] = []
    kinds: list[str] = []
    for item in balance["items"]:
        code = _text(item.get("cuenta")).strip()
        kind = item["tipo"]
        if kind == "cuenta":
            if len(code) > 4:
                continue
            if not include_zero and not any(item[key] for key in ("saldoAnterior", "debito", "credito")):
                continue
        current, noncurrent = classified.get(code, (0.0, 0.0)) if kind == "cuenta" else (None, None)
        if kind == "cuenta" and code[:1] in "234":
            current, noncurrent = -current, -noncurrent
        rows.append([
            code, item.get("nit", ""), item["nombre"], item["saldoAnterior"],
            item["debito"], item["credito"], item["saldoActual"], current, noncurrent,
        ])
        kinds.append(kind)

    labels = ["Código", "Nit", "Cuenta", "Saldo anterior", "Débitos", "Créditos",
              "Saldo actual", "Saldo corriente", "Saldo no corriente"]
    return {
        "id": "inventario-bal", "compania": balance["compania"], "anio": year,
        "mesDesde": month, "mesHasta": month,
        "columnas": [{"label": label, "money": index >= 3} for index, label in enumerate(labels)],
        "filas": rows, "tipos": kinds, "count": len(rows), "source": "CONMAE",
        "nota": "Inventario y balance",
    }
