"""Construye el contrato campo → destino **de la copia real**.

Historia de este archivo, porque explica por qué está escrito así
-----------------------------------------------------------------

La primera versión tomaba la lista de campos de
`old_db/DICCIONARIO_DEPURADO_CONTABDSI.md`. Ese inventario **no describe esta
copia**: al leer el diccionario real (`PUBLIDATA.add`) resultó que 117 campos
existen en la copia sin figurar en el inventario, y 94 del inventario ya no
existen. Construir el cargador sobre esa lista habría descodificado mal el libro.

Ahora la lista de campos sale de
[`extractor/catalogo_publidata.json`](../extractor/catalogo_publidata.json), que
se lee del `.add` y está **verificado contra el registro físico** de las 17
tablas con datos (`extractor/leer_diccionario.py --validar`).

La **decisión** de a dónde va cada campo sigue en [`reglas.py`](reglas.py). Aquí
sólo se aplica y se audita:

- si un campo del piloto queda sin regla, el script **falla**: un campo sin
  decisión no puede llegar al cargador;
- se anota, por campo, si el inventario viejo lo listaba o no, para poder
  comparar y para no perder la trazabilidad de lo que se retiró.

Uso:
    python db/migration/homologacion/contrato_campos.py [--json salida.json]
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
MIGRATION_DIR = HERE.parent
OLD_DB = MIGRATION_DIR.parent / "old_db"

sys.path.insert(0, str(HERE))

import reglas  # necesita el path insertado arriba

CATALOGO = MIGRATION_DIR / "extractor" / "catalogo_publidata.json"
INVENTARIO_DOC = OLD_DB / "DICCIONARIO_DEPURADO_CONTABDSI.md"
TABLAS_ADT = MIGRATION_DIR.parent / "ADD_CONTAB"

# | 1 | CTCODCIA | SHORTINT | 2 | 0 |
FIELD_ROW = re.compile(r"^\|\s*(\d+)\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|")


def inventario() -> dict[str, list[str]]:
    """Campos que listaba el inventario viejo, por tabla. Sólo para trazabilidad."""
    tablas: dict[str, list[str]] = {}
    actual: str | None = None
    for line in INVENTARIO_DOC.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            actual = line[3:].strip().upper()
            continue
        if line.startswith("### ") or actual is None:
            continue
        match = FIELD_ROW.match(line)
        if match:
            tablas.setdefault(actual, []).append(match.group(2).upper())
    return tablas


def catalogo() -> list[dict]:
    """Tablas y campos reales, en el orden físico del registro."""
    contenido = json.loads(CATALOGO.read_text(encoding="utf-8"))
    return contenido["tablas"]


def archivos_adt() -> dict[str, str]:
    """Nombre de archivo real por tabla, para poder citar la ruta."""
    return {ruta.stem.upper(): ruta.name for ruta in TABLAS_ADT.iterdir() if ruta.suffix.lower() == ".adt"}


def build() -> dict[str, object]:
    viejo = inventario()
    archivos = archivos_adt()
    tablas: list[dict[str, object]] = []
    por_clase: dict[str, int] = {clase: 0 for clase in reglas.CLASES}
    totales = {"campos": 0, "sin_regla": 0, "nuevos_en_la_copia": 0, "retirados": 0}

    for tabla in catalogo():
        nombre = str(tabla["tabla"]).lstrip("_").upper()
        anterior = set(viejo.get(nombre, []))
        # El catálogo de `MOV00`..`MOV18` agrupa variantes bajo `MOVxx`.
        anterior |= set(viejo.get(re.sub(r"\d", "X", nombre), []))

        campos: list[dict[str, object]] = []
        for campo in tabla["campos"]:
            nombre_campo = str(campo["campo"]).upper()
            regla = reglas.resolver(nombre, nombre_campo)
            nuevo = nombre_campo not in anterior
            if nuevo:
                totales["nuevos_en_la_copia"] += 1
            registro = {
                "orden": campo["orden"],
                "campo": nombre_campo,
                "tipo": campo["tipo"],
                "longitud": campo["longitud"],
                "decimales": campo["decimales"],
                "clase": regla.clase if regla else "sin_regla",
                "destino": regla.destino if regla else "",
                "transformacion": regla.transformacion if regla else "",
                "en_inventario": not nuevo,
            }
            if regla:
                por_clase[regla.clase] += 1
            else:
                totales["sin_regla"] += 1
            campos.append(registro)

        totales["campos"] += len(campos)
        retirados = sorted(anterior - {str(c["campo"]).upper() for c in tabla["campos"]})
        totales["retirados"] += len(retirados)
        tablas.append(
            {
                "tabla": nombre,
                "tabla_diccionario": tabla["tabla"],
                "ruta": archivos.get(nombre, f"{nombre}.ADT"),
                "variantes_fisicas": 1,
                "campos": campos,
                "largo_registro": sum(int(c["longitud"]) for c in campos),
                "campos_inventario": len(anterior),
                "campos_retirados_del_inventario": retirados,
            }
        )

    return {
        "resumen": {**totales, "por_clase": por_clase},
        "tablas": tablas,
        "sin_diccionario": sorted({str(t["tabla"]) for t in catalogo() if str(t["tabla"]).startswith("__")}),
        "fuente_campos": "extractor/catalogo_publidata.json (leído de PUBLIDATA.add)",
    }


def report(contract: dict[str, object]) -> int:
    tablas = contract["tablas"]
    totales = contract["resumen"]
    con_campos = [t for t in tablas if t["campos"]]

    print(f"Fuente de campos: {contract['fuente_campos']}")
    print(f"Tablas: {len(tablas)} · con campos: {len(con_campos)} · campos: {totales['campos']}")
    for clase in reglas.CLASES:
        if totales["por_clase"][clase]:
            print(f"  {clase:<12} {totales['por_clase'][clase]:>5}")
    print()
    print(f"Contra el inventario viejo: {totales['nuevos_en_la_copia']} campos nuevos en la copia · "
          f"{totales['retirados']} retirados")
    print()
    print(f"{'tabla':<11}{'campos':>7}{'nuevos':>7}{'retir.':>7}{'bytes':>7}  clases")
    print("-" * 78)
    for tabla in con_campos:
        conteo: dict[str, int] = {}
        for campo in tabla["campos"]:
            conteo[str(campo["clase"])] = conteo.get(str(campo["clase"]), 0) + 1
        nuevos = sum(1 for c in tabla["campos"] if not c["en_inventario"])
        detalle = " ".join(f"{clase}:{n}" for clase, n in sorted(conteo.items()))
        print(f"{tabla['tabla']:<11}{len(tabla['campos']):>7}{nuevos:>7}"
              f"{len(tabla['campos_retirados_del_inventario']):>7}{tabla['largo_registro']:>7}  {detalle}")

    if totales["sin_regla"]:
        print(f"\nERROR: {totales['sin_regla']} campos sin regla en reglas.py")
        for tabla in con_campos:
            huerfanos = [str(c["campo"]) for c in tabla["campos"] if c["clase"] == "sin_regla"]
            if huerfanos:
                print(f"  {tabla['tabla']}: {', '.join(huerfanos)}")
        return 1
    print("\nTodos los campos de la copia tienen decisión.")
    return 0


def main(argv: list[str]) -> int:
    contrato = build()
    codigo = report(contrato)
    if "--json" in argv:
        destino = Path(argv[argv.index("--json") + 1])
        destino.write_text(json.dumps(contrato, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nContrato escrito en {destino}")
    return codigo


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
