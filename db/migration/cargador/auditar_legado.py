"""Auditoría del `legado`: contrato, CSV del staging y base cargada.

Comprobación permanente de la **etapa A** de
[`../08_plan_para_culminar.md`](../08_plan_para_culminar.md): los campos del
contrato cuyo destino es `<tabla>.legado` —los que no tienen columna propia—
tienen que llegar a la base. El cargador los lee del contrato (`cargar.py`
§`campos_legado`) y los guarda con su nombre físico; aquí se comprueba que el
número de valores que traía el origen se conserva en el destino.

Para cada tabla del contrato que el cargador vuelca (`CONEMP`, `CONPUC`,
`CONCTR`, `CONMAE`, `CONCECOS`, `CONTICOM`, `CONDOCUM`, `MOV00`, `MOV01`,
`FADCLI`, `VISDOCUM`) y cada campo con destino `<tabla>.legado`:

  * cuenta en `../staging/<TABLA>.csv` las celdas con valor —vacía es la que
    sigue vacía tras quitar `\\x00` y espacios, la misma regla que el cargador—;
  * cuenta en la base las filas del destino donde `legado ? 'CAMPO'`.

`faltan` (csv − base) es lo que el cargador **fusionó o rechazó** por las
razones que deja escritas en `migracion_filas`; no es una pérdida silenciosa.
Lo que sí lo sería es un campo con `csv > 0` y `base = 0`: por eso el script
termina con código de salida 1 si aparece alguno.

Uso:

    backend/.venv/Scripts/python.exe db/migration/cargador/auditar_legado.py
    backend/.venv/Scripts/python.exe db/migration/cargador/auditar_legado.py --url "postgres://..."

Sólo imprime conteos: no trae filas al terminal. La salida es **ASCII** a
propósito, porque la consola de Windows (cp1252) no admite todo lo que admite
el `encoding="utf-8"` con el que se leen estos archivos.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections.abc import Iterable
from pathlib import Path

import psycopg

HERE = Path(__file__).resolve().parent
MIGRATION_DIR = HERE.parent
STAGING = MIGRATION_DIR / "staging"
CONTRATO = MIGRATION_DIR / "homologacion" / "contrato_campos.json"

# Tablas del contrato que el cargador carga en la base de la migración.
TABLAS_CARGADAS = (
    "CONEMP", "CONPUC", "CONCTR", "CONMAE", "CONCECOS", "CONTICOM",
    "CONDOCUM", "MOV00", "MOV01", "FADCLI", "VISDOCUM",
)

# Por defecto se audita la base de la **migración**, no la de desarrollo: la del
# backend (`contabdsi`) tiene el seed y daría ceros que parecerían una pérdida.
URL_POR_DEFECTO = "postgres://contabdsi:contabdsi@127.0.0.1:5433/contabdsi_datos"


def campos_legado() -> dict[str, list[tuple[str, str]]]:
    """`{tabla del origen: [(campo del origen, tabla destino), ...]}`.

    Se lee del contrato, no de una lista escrita a mano: así no puede quedarse
    un campo fuera cuando el contrato cambie.
    """
    contrato = json.loads(CONTRATO.read_text(encoding="utf-8"))
    por_tabla: dict[str, list[tuple[str, str]]] = {}
    for tabla in contrato["tablas"]:
        nombre = str(tabla["tabla"])
        if nombre not in TABLAS_CARGADAS:
            continue
        pares = []
        for campo in tabla["campos"]:
            destino = str(campo["destino"]).strip()
            if destino.endswith(".legado"):
                pares.append((str(campo["campo"]), destino.rsplit(".", 1)[0]))
        if pares:
            por_tabla[nombre] = pares
    return por_tabla


def contar_csv(tabla: str, campos: Iterable[str]) -> dict[str, int]:
    """Celdas con valor por campo, en `../staging/<tabla>.csv`."""
    ruta = STAGING / f"{tabla}.csv"
    if not ruta.is_file():
        raise SystemExit(f"Falta {ruta}. Genera el staging con exportar_csv.py.")
    conteos = dict.fromkeys(campos, 0)
    with ruta.open("r", encoding="utf-8", newline="") as archivo:
        lector = csv.reader(archivo)
        cabecera = next(lector)
        ausentes = [campo for campo in conteos if campo not in cabecera]
        if ausentes:
            raise SystemExit(f"{ruta}: no están las columnas {', '.join(ausentes)}.")
        indices = [(cabecera.index(campo), campo) for campo in conteos]
        for fila in lector:
            for indice, campo in indices:
                # Las filas vienen cortas cuando las últimas columnas van vacías.
                if indice < len(fila) and fila[indice].replace("\x00", "").strip():
                    conteos[campo] += 1
    return conteos


def contar_base(cur: psycopg.Cursor, tabla: str, campos: list[str]) -> dict[str, int]:
    """Filas del destino que traen cada clave en `legado`, en una sola pasada."""
    agregados = ", ".join(f"count(*) FILTER (WHERE legado ? %s::text) AS f{orden}"
                          for orden in range(len(campos)))
    cur.execute(f"SELECT {agregados} FROM {tabla}", campos)
    return dict(zip(campos, cur.fetchone()))


def main() -> int:
    analizador = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    analizador.add_argument("--url", default=URL_POR_DEFECTO,
                            help=f"base a auditar (por defecto {URL_POR_DEFECTO})")
    argumentos = analizador.parse_args()

    por_tabla = campos_legado()
    huerfanas = [tabla for tabla in TABLAS_CARGADAS if tabla not in por_tabla]

    # Los conteos se piden por tabla **destino**: `MOV00` y `MOV01` comparten
    # `documento_lineas`, así que sus campos se resuelven en una sola consulta.
    campos_por_destino: dict[str, set[str]] = {}
    for pares in por_tabla.values():
        for campo, destino in pares:
            campos_por_destino.setdefault(destino, set()).add(campo)

    base: dict[str, dict[str, int]] = {}
    with psycopg.connect(argumentos.url, autocommit=True) as conexion:
        with conexion.cursor() as cur:
            for destino in sorted(campos_por_destino):
                base[destino] = contar_base(cur, destino, sorted(campos_por_destino[destino]))

    print("legado: campos del contrato sin columna propia (origen -> destino)")
    campos_con_dato = 0
    en_csv = 0
    en_base = 0
    perdidos: list[str] = []
    for tabla, pares in por_tabla.items():
        csv_tabla = contar_csv(tabla, {campo for campo, _ in pares})
        for campo, destino in pares:
            valores_csv = csv_tabla[campo]
            valores_base = base[destino][campo]
            # Los campos vacíos en el origen y en la base no son un hallazgo:
            # el cargador no guarda claves sin valor, ni el origen las traía.
            if not valores_csv and not valores_base:
                continue
            campos_con_dato += 1
            en_csv += valores_csv
            en_base += valores_base
            print(f"{tabla}.{campo}  csv={valores_csv}  base={valores_base}  "
                  f"faltan={valores_csv - valores_base}")
            if valores_csv and not valores_base:
                perdidos.append(f"{tabla}.{campo}")

    if huerfanas:
        print(f"sin campos con destino .legado en el contrato: {', '.join(huerfanas)}")
    print(f"\ncampos con dato: {campos_con_dato} | valores en el CSV: {en_csv} | "
          f"valores en la base: {en_base}")
    if perdidos:
        print(f"perdidos por completo (csv > 0 y base = 0): {len(perdidos)} -> "
              f"{', '.join(perdidos)}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
