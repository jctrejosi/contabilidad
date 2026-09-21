#!/usr/bin/env python3
"""Etapa B · Conciliacion por renglon con TSALDO.

Objetivo (ver `../08_plan_para_culminar.md`, etapa B): comprobar si
`MOVxx.TSALDO` —el saldo corrido que llevaba el legado— se puede reconstruir
acumulando `TVALOR` renglon a renglon, para asi validar importe y cuenta en cada
linea y no solo por cuenta y periodo.

El plan propone recorrer en orden fisico (`_archivo`, `_loc`) **por cuenta** y
comparar el saldo acumulado con el que traia el origen. Este script mide esa
hipotesis y varias alternativas de orden, y separa las cuentas que mantienen
saldo de las que lo dejan siempre en cero:

  * cuentas que **mantienen** saldo: alguna fila con `TSALDO <> 0`
    (en la copia: 243 de 2.362; 545.554 filas con valor, como anticipa el plan);
  * cuentas **siempre cero**: el legado no llevaba saldo corrido en ellas.

Para cada orden candidato imprime dos metricas:

  * `saldo == acumulado`: el saldo de la fila es igual al acumulado de la cuenta
    hasta esa fila (lo que pide el plan);
  * `delta(saldo) == TVALOR`: la variacion del saldo respecto de la fila anterior
    de la misma cuenta es igual al movimiento de la fila (tolera un saldo de
    apertura distinto de cero, que la copia no trae).

Uso:

    python db/migration/cargador/conciliar_tsaldo.py
    python db/migration/cargador/conciliar_tsaldo.py --cuenta 240801005
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
CERO = Decimal(0)

ORDENES = {
    "fisico (_archivo, _loc)": lambda r: (r["orden"], r["loc"]),
    "fecha (TFECHA)": lambda r: (r["fecha"], r["orden"], r["loc"]),
    "fecha, comprobante, documento": lambda r: (r["fecha"], r["compr"], r["docum"], r["loc"]),
}


def dec(valor: str) -> Decimal:
    texto = (valor or "").strip()
    if not texto:
        return CERO
    try:
        return Decimal(texto)
    except InvalidOperation:
        return CERO


def texto(valor: str) -> str:
    return (valor or "").strip()


def leer():
    for orden, archivo in enumerate(ARCHIVOS):
        with open(STAGING / archivo, encoding="utf-8-sig", newline="") as fh:
            for fila in csv.DictReader(fh):
                yield dict(
                    archivo=archivo,
                    orden=orden,
                    loc=int(texto(fila["_loc"])),
                    cuenta=texto(fila["CODIGO"]),
                    mes=texto(fila["CONMES"]),
                    fecha=texto(fila["TFECHA"]),
                    compr=texto(fila["TCOMPR"]),
                    docum=texto(fila["TDOCUM"]),
                    nit=texto(fila["NIT"]),
                    valor=dec(fila["TVALOR"]),
                    saldo=dec(fila["TSALDO"]),
                )


def agrupar(filas, filtro=None):
    grupos: dict[str, list] = defaultdict(list)
    for f in filas:
        if filtro is None or filtro(f):
            grupos[f["cuenta"]].append(f)
    return grupos


def medir(grupos, etiqueta):
    print(f"\n=== {etiqueta} ===")
    filas = sum(len(v) for v in grupos.values())
    print(f"  cuentas: {len(grupos):,} | filas: {filas:,}")
    for nombre, clave in ORDENES.items():
        iguales = delta = 0
        for registros in grupos.values():
            acum = CERO
            anterior = None
            for r in sorted(registros, key=clave):
                acum += r["valor"]
                if r["saldo"] == acum:
                    iguales += 1
                if anterior is not None and r["saldo"] - anterior == r["valor"]:
                    delta += 1
                anterior = r["saldo"]
        n = max(filas, 1)
        print(f"    {nombre:<32} saldo==acum {100 * iguales / n:5.1f}% | "
              f"delta==TVALOR {100 * delta / n:5.1f}%")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cuenta", help="limita la medicion a una cuenta")
    args = parser.parse_args()

    filas = list(leer())
    filtro = (lambda f: f["cuenta"] == args.cuenta) if args.cuenta else None

    # 1. Totales de control (el plan anticipa 545.554 filas con saldo != 0).
    con_saldo = [f for f in filas if f["saldo"] != CERO]
    print(f"filas totales: {len(filas):,}")
    print(f"filas con TSALDO != 0: {len(con_saldo):,} "
          f"({100 * len(con_saldo) / len(filas):.2f}%)")
    print(f"suma TVALOR (global): {sum(f['valor'] for f in filas):,.2f}")

    grupos = agrupar(filas, filtro)
    mantienen = {c: rs for c, rs in grupos.items() if any(r["saldo"] != CERO for r in rs)}
    ceros = {c: rs for c, rs in grupos.items() if all(r["saldo"] == CERO for r in rs)}
    print(f"cuentas que mantienen saldo: {len(mantienen):,} | "
          f"siempre cero: {len(ceros):,}")

    medir(grupos, "TODAS las cuentas")
    medir(mantienen, "cuentas que mantienen saldo")
    medir(ceros, "cuentas siempre cero")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())