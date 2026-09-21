#!/usr/bin/env python3
"""Reconcilia, cuenta por cuenta, el CSV del staging contra la base cargada.

Compara lo que el origen trae (`SUM(TVALOR>0)` como debito y `SUM(|TVALOR<0|)`
como credito, por `CODIGO`) con lo que quedo en `documento_lineas`. Sirve para
comprobar que la carga no movio importes de una cuenta a otra.

Uso:
    python db/migration/cargador/reconciliar_cuentas.py --url "postgres://..."
"""
from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path

HERE = Path(__file__).resolve().parent
STAGING = HERE.parent / "staging"
ARCHIVOS = ("MOV00.csv", "MOV01.csv")
DEFAULT_URL = "postgres://contabdsi:contabdsi@127.0.0.1:5433/contabdsi_datos"


def dec(v: str) -> Decimal:
    t = (v or "").strip()
    if not t:
        return Decimal(0)
    try:
        return Decimal(t)
    except InvalidOperation:
        return Decimal(0)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--top", type=int, default=15)
    args = ap.parse_args()

    import psycopg

    origen: dict[str, list] = defaultdict(lambda: [Decimal(0), Decimal(0), 0])
    for archivo in ARCHIVOS:
        with open(STAGING / archivo, encoding="utf-8-sig", newline="") as fh:
            for fila in csv.DictReader(fh):
                codigo = (fila["CODIGO"] or "").strip()
                v = dec(fila["TVALOR"])
                reg = origen[codigo]
                reg[2] += 1
                if v > 0:
                    reg[0] += v
                elif v < 0:
                    reg[1] += -v

    with psycopg.connect(args.url) as cn, cn.cursor() as cur:
        cur.execute(
            """
            SELECT c.codigo,
                   COALESCE(SUM(l.debito), 0)::numeric,
                   COALESCE(SUM(l.credito), 0)::numeric,
                   count(*)
            FROM documento_lineas l
            JOIN cuentas c ON c.id = l.cuenta_id
            GROUP BY c.codigo
            """
        )
        base = {r[0]: (r[1], r[2], r[3]) for r in cur.fetchall()}

    solo_csv = sorted(set(origen) - set(base))
    desajustes = []
    for codigo, (deb_b, cre_b, n_b) in base.items():
        o = origen.get(codigo)
        if o is None:
            desajustes.append((codigo, "solo en base", None, (deb_b, cre_b, n_b)))
            continue
        if o[0] != deb_b or o[1] != cre_b:
            desajustes.append((codigo, "importe", (o[0], o[1], o[2]), (deb_b, cre_b, n_b)))

    print(f"cuentas en CSV: {len(origen):,} | en base: {len(base):,}")
    print(f"cuentas solo en CSV: {len(solo_csv)} | desajustes de importe: "
          f"{sum(1 for d in desajustes if d[1] == 'importe')}")
    print("\n-- desajustes (codigo, tipo, (deb,cre,filas) origen -> base) --")
    for codigo, tipo, o, b in desajustes[: args.top]:
        print(f"  {codigo:<14} {tipo:<12} origen={o} -> base={b}")

    dif_deb = sum((o[0] if o else Decimal(0)) - b[0] for _, _, o, b in desajustes)
    dif_cre = sum((o[1] if o else Decimal(0)) - b[1] for _, _, o, b in desajustes)
    print(f"\ndiferencia acumulada origen-base: debito {dif_deb:,.2f} | credito {dif_cre:,.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())