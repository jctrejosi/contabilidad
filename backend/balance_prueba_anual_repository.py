"""Opción J: INFOR02(4), balance de prueba del año y mes de ajuste 13."""

from __future__ import annotations

from typing import Any

from .balance_comprobacion_repository import build_trial_balance


def build_annual_trial_balance(
    cia: str, year: int, *, level: int = 4, include_results: bool = True,
    include_zero: bool = False, include_thirds: bool = False,
    include_centers: bool = False,
) -> dict[str, Any]:
    # MOVANUAL del original suma MACMDEB/MACMCRE 01..13, no solo 01..12.
    balance = build_trial_balance(
        cia, year, 1, 13, level=level,
        include_zero=include_zero, include_results=include_results,
        include_thirds=include_thirds, include_centers=include_centers,
        detail_limit=None,
    )
    labels = ["Código", "NIT / centro", "Cuenta", "Saldo anterior", "Débitos",
              "Créditos", "Saldo actual"]
    rows: list[list[Any]] = []
    kinds: list[str] = []
    for item in balance["items"]:
        rows.append([item["cuenta"], item["nit"], item["nombre"],
                     item["saldoAnterior"], item["debito"], item["credito"],
                     item["saldoActual"]])
        kinds.append(item["tipo"])
    return {
        "id": "balance-prueba-anual", "compania": balance["compania"],
        "anio": year, "mesDesde": 1, "mesHasta": 13,
        "nivel": level,
        "columnas": [{"label": label, "money": index >= 3} for index, label in enumerate(labels)],
        "filas": rows, "tipos": kinds, "count": len(rows), "source": "CONMAE / MOV01",
        "nota": f"Balance de prueba anual {year}",
    }
