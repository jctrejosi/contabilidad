"""Inspección física de `ADD_CONTAB/` (solo lectura).

Lee la **cabecera** de cada archivo del diccionario del legado y reporta lo que
se puede verificar sin el motor de Advantage: firma, archivo de diccionario al
que apunta y tamaño.

No decodifica registros: las tablas están ligadas a diccionario (su cabecera
referencia `PUBLIDATA.add`), así que el mapa de campos vive en el `.add`. El
decodificador de filas es la pieza pendiente — ver `README.md`.

Uso:
    python db/migration/extractor/inspect_adt.py [carpeta] [--json salida.json]
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Firma de las tablas de Advantage: "Advantage Table\0" en los primeros 16 bytes.
ADT_SIGNATURE = b"Advantage Table"
HEADER_BYTES = 512

# Referencia al diccionario dentro de la cabecera (p. ej. "\PUBLIDATA.add").
DICTIONARY_REFERENCE = re.compile(rb"[\\/][A-Za-z0-9_\-]{1,64}\.add", re.IGNORECASE)

# Sufijos que el legado usa para índice y memo de cada tabla.
INDEX_SUFFIXES = {".adi", ".ai", ".idx", ".cdx", ".ntx"}
MEMO_SUFFIXES = {".adm", ".am", ".dbt", ".fpt"}

DEFAULT_DIRECTORY = Path(__file__).resolve().parents[3] / "ADD_CONTAB"


def classify(path: Path, header: bytes) -> str:
    """Tipo probable del archivo según su firma y su extensión."""
    if header.startswith(ADT_SIGNATURE):
        return "tabla"
    suffix = path.suffix.lower()
    if suffix == ".add":
        return "diccionario"
    if suffix in INDEX_SUFFIXES:
        return "indice"
    if suffix in MEMO_SUFFIXES:
        return "memo"
    if suffix == ".prg":
        return "fuente"
    return "otro"


def describe(path: Path) -> dict[str, object]:
    """Lee la cabecera de un archivo y devuelve lo observable."""
    with path.open("rb") as handle:
        header = handle.read(HEADER_BYTES)

    found = DICTIONARY_REFERENCE.search(header)
    return {
        "archivo": path.name,
        "bytes": path.stat().st_size,
        "tipo": classify(path, header),
        "firma_ok": header.startswith(ADT_SIGNATURE),
        "diccionario": found.group(0).lstrip(b"\\/").decode("ascii", "replace") if found else None,
        "cabecera": header[:16].hex(" "),
    }


def inspect(directory: Path) -> list[dict[str, object]]:
    if not directory.is_dir():
        raise SystemExit(f"No existe la carpeta {directory}.")
    return [describe(path) for path in sorted(directory.iterdir()) if path.is_file()]


def report(rows: list[dict[str, object]]) -> None:
    tables = [row for row in rows if row["tipo"] == "tabla"]
    print(f"Carpeta analizada: {len(rows)} archivos · {len(tables)} tablas .ADT\n")
    print(f"{'archivo':<22} {'tipo':<12} {'MB':>8}  diccionario")
    print("-" * 68)
    for row in rows:
        megabytes = f"{int(row['bytes']) / 1_048_576:.3f}" if row["bytes"] else "-"
        mark = "" if row["tipo"] != "tabla" or row["firma_ok"] else "  <-- SIN FIRMA ADT"
        print(
            f"{row['archivo']:<22} {row['tipo']:<12} {megabytes:>8}  "
            f"{row['diccionario'] or ''}{mark}"
        )

    sin_diccionario = [row["archivo"] for row in tables if not row["diccionario"]]
    if sin_diccionario:
        print(f"\nTablas sin referencia a diccionario en la cabecera: {', '.join(sin_diccionario)}")


def main(argv: list[str]) -> int:
    arguments = list(argv)
    destination = None
    if "--json" in arguments:
        index = arguments.index("--json")
        if index + 1 < len(arguments):
            destination = Path(arguments[index + 1])
        del arguments[index : index + 2]

    directory = Path(arguments[0]) if arguments else DEFAULT_DIRECTORY
    rows = inspect(directory)
    report(rows)

    if destination is not None:
        destination.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nInforme JSON: {destination} ({len(rows)} archivos)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
