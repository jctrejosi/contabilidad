"""Parte el staging completo en un staging por compañía.

El cargador está escrito para una sola contabilidad: copia los CSV a tablas
temporales y resuelve las claves por compañía. En vez de reescribir ese camino ya
verificado, se le entrega un staging que ya trae sólo la compañía pedida y un
manifiesto propio (con sus años, períodos y hashes).

Uso:
    python dividir_por_compania.py --origen staging/completa \
        --destino staging/cia26 --compania 26

Reglas:
- Tablas con columna de compañía (`CIA` o `CONCIA`): se filtran.
- `CONCTR` es el control **de la instalación**, no de la compañía: sólo se copia
  para `--control-compania` (por omisión 27); para el resto queda sólo cabecera,
  porque el legado no guarda parámetros de operación por contabilidad.
- `CONEMP`, `CONTICOM`, `FADCLI` y `VISDOCUM` no se filtran: `CONEMP` porque el
  cargador necesita encontrar su fila; `FADCLI` y `VISDOCUM` porque no traen
  compañía (catálogos compartidos); `CONTICOM` porque la copia sólo lista los
  comprobantes de la contabilidad activa y las dos compañías usan los mismos
  códigos (ver el comentario en `SIN_CIA`).
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
import time
from collections import Counter
from pathlib import Path

CIA = {
    "CONCECOS": "CIA",
    "CONMAE": "CIA",
    "CONDOCUM": "CIA",
    "MOV00": "CONCIA",
    "MOV01": "CONCIA",
}
# `CONTICOM` lleva columna `CIA`, pero la copia sólo trae los 28 comprobantes de la
# contabilidad activa (27). Los documentos de la 26 usan 25 de esos mismos códigos
# (00..26 y 50): en la práctica es el catálogo de comprobantes de la instalación,
# no una lista por compañía. Se copia entero; si se filtrara, 551.488 cabeceras de
# la 26 se rechazarían por «sin comprobante».
SIN_CIA = ("CONEMP", "CONTICOM", "FADCLI", "VISDOCUM")
CON_CONTROL = "CONCTR"


def sha256(ruta: Path) -> str:
    digest = hashlib.sha256()
    with ruta.open("rb") as handle:
        for bloque in iter(lambda: handle.read(1 << 20), b""):
            digest.update(bloque)
    return digest.hexdigest()


def filtrar(origen: Path, destino: Path, columna: str, compania: str) -> tuple[int, Counter]:
    """Copia las filas de `compania` y devuelve (filas, {(año, mes)})."""
    periodos: Counter = Counter()
    filas = 0
    with origen.open("r", encoding="utf-8", newline="") as entrada, \
            destino.open("w", encoding="utf-8", newline="") as salida:
        lector = csv.DictReader(entrada)
        escritor = csv.DictWriter(salida, fieldnames=lector.fieldnames)
        escritor.writeheader()
        for fila in lector:
            if (fila.get(columna) or "").strip() != compania:
                continue
            escritor.writerow(fila)
            filas += 1
            if "CONANO" in fila and "CONMES" in fila:
                periodos[(int(fila["CONANO"]), f"{int(fila['CONMES']):02d}")] += 1
    return filas, periodos


def copiar(origen: Path, destino: Path) -> int:
    shutil.copyfile(origen, destino)
    with destino.open("r", encoding="utf-8", newline="") as archivo:
        return sum(1 for _ in archivo) - 1


def solo_cabecera(origen: Path, destino: Path) -> None:
    with origen.open("r", encoding="utf-8", newline="") as archivo:
        cabecera = archivo.readline()
    destino.write_text(cabecera, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--origen", type=Path, default=Path("db/migration/staging/completa"))
    parser.add_argument("--destino", type=Path, required=True)
    parser.add_argument("--compania", required=True)
    parser.add_argument("--control-compania", default="27",
                        help="compañía a la que se le copia CONCTR (el control de la instalación)")
    argumentos = parser.parse_args(argv)

    origen = argumentos.origen.resolve()
    destino = argumentos.destino.resolve()
    destino.mkdir(parents=True, exist_ok=True)

    catalogo = json.loads((origen / "manifiesto.json").read_text(encoding="utf-8"))
    previas = {entrada["tabla"]: entrada for entrada in catalogo["tablas"]}

    entradas = []
    inicio = time.monotonic()
    for nombre, columna in CIA.items():
        archivo_origen = origen / f"{nombre}.csv"
        if not archivo_origen.is_file():
            continue
        archivo_destino = destino / f"{nombre}.csv"
        filas, periodos = filtrar(archivo_origen, archivo_destino, columna, argumentos.compania)
        anio = Counter({a: 0 for a, _ in periodos})
        for (a, _), cuantas in periodos.items():
            anio[a] += cuantas
        entradas.append({
            "tabla": nombre,
            "archivo_origen": previas.get(nombre, {}).get("archivo_origen", f"{nombre}.ADT"),
            "archivo_csv": f"{nombre}.csv",
            "filas_leidas": filas,
            "filas_descartadas": 0,
            "columnas": len(next(csv.reader(archivo_destino.open(encoding="utf-8")))),
            "bytes_csv": archivo_destino.stat().st_size,
            "sha256_csv": sha256(archivo_destino),
            "anio": [anio.most_common(1)[0][0]] if anio else [],
            "periodos": sorted({p for a, p in periodos if anio and a == anio.most_common(1)[0][0]}),
            "contabilidad": [argumentos.compania],
            "filtro": f"{columna} = {argumentos.compania}",
        })
        print(f"{nombre:<10} {filas:>10,} filas · períodos {entradas[-1]['periodos']}")

    for nombre in SIN_CIA:
        archivo_origen = origen / f"{nombre}.csv"
        if not archivo_origen.is_file():
            continue
        archivo_destino = destino / f"{nombre}.csv"
        filas = copiar(archivo_origen, archivo_destino)
        entradas.append({
            "tabla": nombre,
            "archivo_origen": previas.get(nombre, {}).get("archivo_origen", f"{nombre}.ADT"),
            "archivo_csv": f"{nombre}.csv",
            "filas_leidas": filas,
            "filas_descartadas": 0,
            "columnas": len(next(csv.reader(archivo_destino.open(encoding="utf-8")))),
            "bytes_csv": archivo_destino.stat().st_size,
            "sha256_csv": sha256(archivo_destino),
            "anio": previas.get(nombre, {}).get("anio"),
            "periodos": [],
            "contabilidad": [argumentos.compania],
            "filtro": "catálogo compartido (sin columna de compañía)",
        })
        print(f"{nombre:<10} {filas:>10,} filas · catálogo compartido")

    if (origen / f"{CON_CONTROL}.csv").is_file():
        archivo_destino = destino / f"{CON_CONTROL}.csv"
        if argumentos.compania == argumentos.control_compania:
            filas = copiar(origen / f"{CON_CONTROL}.csv", archivo_destino)
            nota = "control de la instalación"
        else:
            solo_cabecera(origen / f"{CON_CONTROL}.csv", archivo_destino)
            filas = 0
            nota = "el legado no trae control por compañía"
        entradas.append({
            "tabla": CON_CONTROL,
            "archivo_origen": previas.get(CON_CONTROL, {}).get("archivo_origen", f"{CON_CONTROL}.ADT"),
            "archivo_csv": f"{CON_CONTROL}.csv",
            "filas_leidas": filas,
            "filas_descartadas": 0,
            "columnas": len(next(csv.reader(archivo_destino.open(encoding="utf-8")))),
            "bytes_csv": archivo_destino.stat().st_size,
            "sha256_csv": sha256(archivo_destino),
            "anio": None,
            "periodos": [],
            "contabilidad": [argumentos.compania],
            "filtro": nota,
        })
        print(f"{CON_CONTROL:<10} {filas:>10,} filas · {nota}")

    manifiesto = {
        "generado_en": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "origen": str(destino),
        "diccionario": catalogo.get("diccionario"),
        "limite": None,
        "compania": argumentos.compania,
        "tablas": entradas,
        "totales": {
            "tablas": len(entradas),
            "filas": sum(e["filas_leidas"] for e in entradas),
            "bytes_csv": sum(e["bytes_csv"] for e in entradas),
        },
    }
    (destino / "manifiesto.json").write_text(
        json.dumps(manifiesto, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n{destino} · {len(entradas)} tablas · "
          f"{manifiesto['totales']['filas']:,} filas · {time.monotonic() - inicio:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
