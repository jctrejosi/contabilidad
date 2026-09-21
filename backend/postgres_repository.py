"""Acceso a PostgreSQL para el modelo nuevo (``db/postgresql``).

Implementa el mismo contrato JSON que la capa de Advantage, de modo que los
endpoints no cambien al alternar de motor (``CONTABDSI_STORE=postgres``).

Solo cubre las operaciones ya migradas; el resto sigue resolviéndose en
``ads_repository`` hasta que se complete la transición (ver
``db/migration/04_transicion_del_backend.md``).
"""

from __future__ import annotations

from typing import Any

from .store import database_url


class PostgresConfigurationError(RuntimeError):
    """Falta el driver de PostgreSQL o la conexión no es posible."""

    pass


# Sin timeout, un puerto medio abierto (p. ej. el reenviador de Docker cuando el
# motor está caído) deja la petición colgada en vez de responder con un error.
CONNECT_TIMEOUT_SECONDS = 5


def _connect() -> Any:
    """Abre una conexión nueva. El driver se importa aquí para que el módulo
    pueda importarse (y la API arrancar) aunque psycopg no esté instalado."""
    try:
        import psycopg
    except ImportError as exc:  # pragma: no cover - depende del entorno
        raise PostgresConfigurationError(
            "Falta el driver psycopg; instala backend/requirements.txt."
        ) from exc

    try:
        return psycopg.connect(database_url(), connect_timeout=CONNECT_TIMEOUT_SECONDS)
    except Exception as exc:
        raise PostgresConfigurationError(
            f"No fue posible conectar con PostgreSQL ({database_url()}): {exc}"
        ) from exc


def list_companies() -> list[dict[str, Any]]:
    """Compañías de ``companias`` con el contrato que consume el login.

    En el legado el NIT viaja en un solo campo (``CONEMP.EMPNIT``); en el modelo
    nuevo está separado del dígito de verificación, así que se vuelven a
    componer para no cambiar la interfaz. El orden imita al de ``CONEMP``:
    primero la compañía vigente y después por código descendente.
    """
    sql = (
        "SELECT codigo, nombre, nit, digito, estado FROM companias "
        "ORDER BY (estado = 'Activa') DESC, codigo DESC"
    )
    with _connect() as connection, connection.cursor() as cursor:
        cursor.execute(sql)
        rows = cursor.fetchall()

    companies: list[dict[str, Any]] = []
    for codigo, nombre, nit, digito, estado in rows:
        check_digit = str(digito or "").strip()
        companies.append(
            {
                "codigo": str(codigo),
                "nombre": str(nombre),
                "nit": f"{nit}-{check_digit}" if check_digit else str(nit),
                "habilitada": str(estado) == "Activa",
            }
        )
    return companies


def check_connection() -> None:
    """Comprueba que el modelo nuevo responde (equivale a leer CONMAE)."""
    with _connect() as connection, connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM companias LIMIT 1")
        cursor.fetchone()
