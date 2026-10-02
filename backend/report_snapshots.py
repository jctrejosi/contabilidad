"""Instantáneas temporales de informes extensos para vista previa y exportación.

El libro se calcula una vez contra Advantage. Sus filas se guardan en SQLite
local para paginar la vista previa sin enviarlas todas al navegador y para
exportar exactamente el mismo resultado sin repetir la consulta contable.
"""

from __future__ import annotations

import json
import re
import sqlite3
import tempfile
import time
from contextlib import closing
from pathlib import Path
from secrets import token_hex
from typing import Any


CACHE_DIR = Path(tempfile.gettempdir()) / "contabdsi27-report-snapshots"
MAX_AGE_SECONDS = 30 * 60
PAGE_SIZE = 8
_TOKEN = re.compile(r"[0-9a-f]{32}\Z")


class SnapshotNotFound(Exception):
    """La instantánea expiró o no existe en este servidor."""


def _path(token: str) -> Path:
    if not _TOKEN.fullmatch(token):
        raise SnapshotNotFound()
    return CACHE_DIR / f"{token}.sqlite3"


def _clean_expired() -> None:
    """Retira solo instantáneas propias antiguas, nunca archivos ajenos."""
    if not CACHE_DIR.exists():
        return
    cutoff = time.time() - MAX_AGE_SECONDS
    for path in CACHE_DIR.glob("*.sqlite3"):
        if not _TOKEN.fullmatch(path.stem):
            continue
        try:
            if path.stat().st_mtime < cutoff:
                path.unlink()
        except OSError:
            pass


def save(report: dict[str, Any]) -> str:
    """Guarda el resultado ya calculado sin alterar filas ni tipos del informe."""
    CACHE_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    _clean_expired()
    token = token_hex(16)
    path = _path(token)
    metadata = {key: value for key, value in report.items() if key not in {"filas", "tipos"}}
    try:
        with closing(sqlite3.connect(path)) as database:
            with database:
                database.execute("CREATE TABLE metadata (value TEXT NOT NULL)")
                database.execute("CREATE TABLE rows (position INTEGER PRIMARY KEY, cells TEXT NOT NULL, kind TEXT)")
                database.execute("INSERT INTO metadata(value) VALUES (?)", (json.dumps(metadata, ensure_ascii=False),))
                kinds = report.get("tipos", [])
                database.executemany(
                    "INSERT INTO rows(position, cells, kind) VALUES (?, ?, ?)",
                    ((position, json.dumps(row, ensure_ascii=False),
                      kinds[position] if position < len(kinds) else None)
                     for position, row in enumerate(report["filas"])),
                )
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return token


def load(token: str, *, page: int | None = None) -> dict[str, Any]:
    """Lee una página o todas las filas para crear el archivo exportado."""
    path = _path(token)
    try:
        if time.time() - path.stat().st_mtime > MAX_AGE_SECONDS:
            raise SnapshotNotFound()
        with closing(sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)) as database:
            metadata_row = database.execute("SELECT value FROM metadata").fetchone()
            if metadata_row is None:
                raise SnapshotNotFound()
            report = json.loads(metadata_row[0])
            if page is None:
                rows = database.execute("SELECT cells, kind FROM rows ORDER BY position")
            else:
                if page < 0:
                    raise ValueError("La página no puede ser negativa.")
                rows = database.execute(
                    "SELECT cells, kind FROM rows ORDER BY position LIMIT ? OFFSET ?",
                    (PAGE_SIZE, page * PAGE_SIZE),
                )
            pairs = rows.fetchall()
    except (FileNotFoundError, sqlite3.DatabaseError) as exc:
        raise SnapshotNotFound() from exc
    report["filas"] = [json.loads(cells) for cells, _ in pairs]
    report["tipos"] = [kind for _, kind in pairs]
    report["snapshotId"] = token
    return report
