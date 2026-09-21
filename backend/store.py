"""Selección del motor de datos del backend.

La API puede operar contra el legado (Advantage, valor por defecto) o contra el
modelo nuevo (PostgreSQL) **sin tocar los endpoints**: cada operación resuelve su
implementación según ``CONTABDSI_STORE``.

Variables (en ``backend/.env`` o en el proceso; el proceso tiene precedencia):

- ``CONTABDSI_STORE``: ``ads`` (por defecto) o ``postgres``.
- ``DATABASE_URL``: cadena de conexión de PostgreSQL.

Este módulo es el punto único de decisión: los repositorios de cada motor no
saben que existen entre sí.
"""

from __future__ import annotations

import os
from typing import Any

from .ads_repository import read_local_env

STORE_ADS = "ads"
STORE_POSTGRES = "postgres"

STORE_LABELS = {
    STORE_ADS: "Advantage Data Server",
    STORE_POSTGRES: "PostgreSQL",
}

# Etiqueta de origen que viaja en el JSON: mantiene trazabilidad de dónde salió
# cada respuesta sin cambiar la forma del contrato.
STORE_SOURCES = {
    STORE_ADS: "CONEMP",
    STORE_POSTGRES: "companias",
}

DEFAULT_DATABASE_URL = "postgres://contabdsi:contabdsi@127.0.0.1:5433/contabdsi"


def configuration() -> dict[str, str]:
    """Valores de ``backend/.env`` con el entorno del proceso por encima."""
    values = read_local_env()
    values.update(dict(os.environ))
    return values


def current_store() -> str:
    """Motor activo. Cualquier valor desconocido cae en Advantage."""
    value = configuration().get("CONTABDSI_STORE", STORE_ADS).strip().lower()
    return value if value in STORE_LABELS else STORE_ADS


def is_postgres() -> bool:
    """¿El motor activo es el modelo nuevo?"""
    return current_store() == STORE_POSTGRES


def store_label() -> str:
    return STORE_LABELS[current_store()]


def source_label() -> str:
    """Tabla de origen que se informa en las respuestas del motor activo."""
    return STORE_SOURCES[current_store()]


def database_url() -> str:
    value = configuration().get("DATABASE_URL", "").strip()
    return value or DEFAULT_DATABASE_URL


def list_companies() -> list[dict[str, Any]]:
    """Compañías del motor activo, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_companies as implementation
    else:
        from .ads_repository import list_companies as implementation
    return implementation()


def check_connection() -> None:
    """Verifica que el motor activo responde. Lanza si no."""
    if is_postgres():
        from .postgres_repository import check_connection as implementation
    else:
        from .ads_repository import check_connection as implementation
    implementation()
