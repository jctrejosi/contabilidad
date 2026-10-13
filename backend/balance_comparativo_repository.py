"""Opción H: INFOR14, comparación de dos meses contables."""

from __future__ import annotations

from typing import Any

from .balance_comprobacion_repository import build_trial_balance


def _value(item: dict[str, Any], mode: str) -> float:
    if mode == "saldo":
        return round(float(item["saldoActual"]), 2)
    code = str(item.get("cuenta") or "")
    sign = -1 if code[:1] in "234" else 1
    return round((float(item["debito"]) - float(item["credito"])) * sign, 2)


def build_monthly_comparison(
    cia: str, year: int, first: int, second: int, *, level: int = 4,
    include_results: bool = True, include_zero: bool = False,
    include_thirds: bool = False, value_mode: str = "saldo",
    operation: str = "diferencia",
) -> dict[str, Any]:
    if not 1 <= first <= second <= 18:
        raise ValueError("Seleccione meses válidos y en orden (01–18).")
    if value_mode not in {"saldo", "movimiento"}:
        raise ValueError("La modalidad debe ser saldo o movimiento.")
    if operation not in {"diferencia", "sumatoria"}:
        raise ValueError("La operación debe ser diferencia o sumatoria.")
    kwargs = dict(level=level, include_zero=True, include_results=include_results,
                  include_thirds=include_thirds, detail_limit=None)
    earlier = build_trial_balance(cia, year, first, first, **kwargs)
    later = build_trial_balance(cia, year, second, second, **kwargs)
    key = lambda item: (item["seccion"], item["tipo"], item["cuenta"], item["nit"])
    later_items = {key(item): item for item in later["items"]}
    rows: list[list[Any]] = []
    kinds: list[str] = []
    for item in earlier["items"]:
        mate = later_items.get(key(item))
        if mate is None:
            continue
        if item["tipo"] in {"cuenta", "tercero"} and not include_zero:
            if not any(item[field] or mate[field]
                       for field in ("saldoAnterior", "debito", "credito")):
                continue
        left, right = _value(item, value_mode), _value(mate, value_mode)
        result = left - right if operation == "diferencia" else left + right
        rows.append([item["cuenta"], item["nit"], item["nombre"], left, right,
                     round(result, 2)])
        kinds.append(item["tipo"])
    title = "Saldo" if value_mode == "saldo" else "Movimiento"
    return {
        "id": "bal-comparativo-mensual", "compania": earlier["compania"],
        "anio": year, "mesDesde": first, "mesHasta": second,
        "columnas": [{"label": label, "money": index >= 3} for index, label in enumerate(
            ["Código", "NIT", "Cuenta", f"{title} mes {first:02d}",
             f"{title} mes {second:02d}", operation.capitalize()])],
        "filas": rows, "tipos": kinds, "count": len(rows), "source": "CONMAE / CONTERCE",
        "nota": f"Balance comparativo · meses {first:02d} y {second:02d} de {year}",
    }
