"""Construye el contrato campo a campo de las tablas del legado.

El plan de migración exige, como **condición de entrada**, un contrato
«campo → destino → transformación» completo y aprobado. Hoy está repartido en
dos documentos de `old_db/`:

- `DICCIONARIO_DEPURADO_CONTABDSI.md` — el inventario **físico**: orden, tipo,
  longitud y decimales de cada campo de cada tabla (con la ruta del `.ADT`).
- `HOMOLOGACION_CAMPOS.md` — el **destino**: tabla/columna propuesta, estado
  (`Candidato explícito`, `Pendiente…`, `Sin destino definido`) y la
  transformación anotada.

Este script los cruza, se queda con las tablas que existen en `ADD_CONTAB/`
(según `extractor/informe_cabeceras.json`) y escribe `contrato_campos.json` con
el detalle por campo más un resumen de cobertura. Es la entrada del cargador y
el insumo para cerrar los pendientes.

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

DICTIONARY_DOC = OLD_DB / "DICCIONARIO_DEPURADO_CONTABDSI.md"
HOMOLOGATION_DOC = OLD_DB / "HOMOLOGACION_CAMPOS.md"
HEADERS_JSON = MIGRATION_DIR / "extractor" / "informe_cabeceras.json"

# | 1 | CTCODCIA | SHORTINT | 2 | 0 |
FIELD_ROW = re.compile(r"^\|\s*(\d+)\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|")
# | MOVxx | TVALOR | … | … | … |   (el nombre de tabla puede traer minúsculas o
# corchetes angulares: MC<lote>, MOVxx)
HOMOLOGATION_ROW = re.compile(r"^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|(.*?)\|(.*?)\|(.*?)\|\s*$")

STATE_WITH_DESTINATION = "Candidato explícito"
STATE_WITHOUT_DESTINATION = "Sin destino definido"


def parse_dictionary(source: Path) -> dict[str, list[dict[str, object]]]:
    """Tabla lógica → variantes físicas, cada una con sus campos en orden."""
    tables: dict[str, list[dict[str, object]]] = {}
    current_table: str | None = None
    current_path: str | None = None
    fields: list[dict[str, object]] = []

    def flush() -> None:
        if current_table and current_path:
            tables.setdefault(current_table, []).append({"ruta": current_path, "campos": list(fields)})

    for line in source.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            flush()
            current_table, current_path, fields = line[3:].strip().upper(), None, []
            continue
        if line.startswith("### "):
            flush()
            current_path, fields = line[4:].strip(), []
            continue
        match = FIELD_ROW.match(line)
        if match and current_path:
            order, name, kind, length, decimals = match.groups()
            fields.append(
                {
                    "orden": int(order),
                    "campo": name,
                    "tipo": kind,
                    "longitud": int(length),
                    "decimales": int(decimals),
                }
            )
    flush()
    return tables


def parse_homologation(source: Path) -> dict[tuple[str, str], dict[str, str]]:
    """(tabla, campo) → destino, estado y transformación anotada."""
    entries: dict[tuple[str, str], dict[str, str]] = {}
    for line in source.read_text(encoding="utf-8").splitlines():
        match = HOMOLOGATION_ROW.match(line)
        if not match:
            continue
        table, field, destination, state, transformation = (part.strip() for part in match.groups())
        entries[(table.upper(), field.upper())] = {
            "destino": destination,
            "estado": state,
            "transformacion": transformation,
        }
    return entries


def source_tables() -> list[str]:
    """Tablas presentes en ADD_CONTAB/, según el informe de cabeceras."""
    if not HEADERS_JSON.is_file():
        return []
    rows = json.loads(HEADERS_JSON.read_text(encoding="utf-8"))
    return sorted({Path(row["archivo"]).stem.upper() for row in rows if row["tipo"] == "tabla"})


def build() -> dict[str, object]:
    dictionary = parse_dictionary(DICTIONARY_DOC)
    homologation = parse_homologation(HOMOLOGATION_DOC)
    tables: list[dict[str, object]] = []
    totals = {"campos": 0, "con_destino": 0, "pendientes": 0, "sin_destino": 0, "propuesta": 0}

    for name in source_tables():
        # El diccionario agrupa variantes bajo un nombre genérico (MOV00..MOV18 →
        # «MOVxx»), así que si no hay coincidencia exacta se prueba la forma
        # genérica sustituyendo los dígitos por X.
        variants = dictionary.get(name) or dictionary.get(re.sub(r"\d", "X", name)) or []
        # Se prefiere la variante de CONTAB cuando la tabla aparece en varias carpetas.
        chosen = next((v for v in variants if "CONTAB" in str(v["ruta"]).upper()), variants[0] if variants else None)
        if chosen is None:
            tables.append({"tabla": name, "variantes_fisicas": 0, "campos": [], "sin_catalogo": True})
            continue

        catalog_key = next(
            (key for key in (name, re.sub(r"\d", "X", name)) if key in dictionary), name
        )
        fields: list[dict[str, object]] = []
        for field in chosen["campos"]:  # type: ignore[union-attr]
            field_name = str(field["campo"]).upper()
            entry = (
                homologation.get((name, field_name))
                or homologation.get((catalog_key, field_name))
                or {}
            )
            destination = entry.get("destino", "")
            state = entry.get("estado", "")
            record = {
                **field,
                "destino": destination,
                "estado": state or "no figura en HOMOLOGACION_CAMPOS",
                "transformacion": entry.get("transformacion", ""),
                "propuesta": False,
            }
            if state == STATE_WITHOUT_DESTINATION:
                totals["sin_destino"] += 1
            elif state.startswith(STATE_WITH_DESTINATION):
                totals["con_destino"] += 1
            elif state:
                totals["pendientes"] += 1
            else:
                totals["pendientes"] += 1
            if "PROPUESTO" in destination.upper():
                record["propuesta"] = True
                totals["propuesta"] += 1
            fields.append(record)

        totals["campos"] += len(fields)
        tables.append(
            {
                "tabla": name,
                "ruta": chosen["ruta"],
                "clave_catalogo": catalog_key,
                "variantes_fisicas": len(variants),
                "campos": fields,
                "largo_registro": sum(int(f["longitud"]) for f in fields),
            }
        )

    return {"resumen": totals, "tablas": tables}


def report(contract: dict[str, object]) -> None:
    tables = contract["tablas"]
    totals = contract["resumen"]
    present = [t for t in tables if not t.get("sin_catalogo")]
    missing = [t["tabla"] for t in tables if t.get("sin_catalogo")]

    print(f"Tablas en ADD_CONTAB/: {len(tables)} · con catálogo de campos: {len(present)}")
    print(
        f"Campos: {totals['campos']} · con candidato explícito: {totals['con_destino']} · "
        f"pendientes: {totals['pendientes']} · sin destino: {totals['sin_destino']} "
        f"· con columna PROPUESTA: {totals['propuesta']}"
    )
    print()
    print(f"{'tabla':<14} {'campos':>6} {'bytes':>7} {'destino':>8} {'pend.':>6} {'sd':>4}  variantes")
    print("-" * 66)
    for table in present:
        fields = table["campos"]
        with_destination = sum(1 for f in fields if str(f["estado"]).startswith(STATE_WITH_DESTINATION))
        no_destination = sum(1 for f in fields if f["estado"] == STATE_WITHOUT_DESTINATION)
        pending = len(fields) - with_destination - no_destination
        print(
            f"{table['tabla']:<14} {len(fields):>6} {table['largo_registro']:>7} "
            f"{with_destination:>8} {pending:>6} {no_destination:>4}  {table['variantes_fisicas']}"
        )
    if missing:
        print(f"\nSin catálogo de campos en el diccionario (solo están en el .add): {', '.join(missing)}")


def main(argv: list[str]) -> int:
    contract = build()
    report(contract)
    if "--json" in argv:
        destination = Path(argv[argv.index("--json") + 1])
        destination.write_text(json.dumps(contract, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nContrato escrito en {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
