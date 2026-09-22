"""Forma acordada del ``payload`` de datos del asistente (fase 0).

Es el contrato que declara el paso 2 del punto 5 de
``docs/catalogo/HERRAMIENTAS_PRIORIZADAS.md``: se parte de la forma que el
frontend ya pinta en la tabla de informes (``InformeAdicional``) y se agregan los
campos de trazabilidad ``count``, ``hasMore``, ``truncado``, ``origen``,
``filtros`` y ``nota``.

La fase 0 lo declara y las herramientas lo llenan desde ya (en ``ctx["payload"]``,
que ``/chat`` devuelve tal cual); el render en el widget es la fase 2 y no debe
cambiar este contrato.

Reglas del contrato:

- ``tipo`` es ``"tabla"`` (varias filas) o ``"item"`` (un solo registro).
- ``columnas`` usa la forma que consume la tabla de informes:
  ``[{"label": "Fecha", "money": false}]``.
- ``origen`` copia el campo ``source`` de la respuesta del backend (``MOV01``,
  ``CONMAE``, ``CONCTR``...); no se inventa.
- ``filtros`` devuelve exactamente los parámetros enviados al backend, para poder
  reproducir la consulta.
- ``truncado`` se informa cuando el handler cortó la salida, y ``hasMore`` cuando
  la consulta tiene más filas de las devueltas.
"""
from __future__ import annotations


def columna(label: str, money: bool = False) -> dict:
    """Columna en el formato que consume la tabla de informes del frontend."""
    return {"label": label, "money": money}


def tabla(
    *,
    titulo: str,
    columnas: list[dict],
    filas: list[list],
    origen: str,
    totales: list | None = None,
    count: int | None = None,
    has_more: bool = False,
    truncado: bool = False,
    filtros: dict | None = None,
    nota: str = "",
) -> dict:
    """Payload de tipo tabla: las filas completas que pinta el frontend."""
    return {
        "tipo": "tabla",
        "titulo": titulo,
        "columnas": list(columnas),
        "filas": [list(fila) for fila in filas],
        "totales": list(totales) if totales else [],
        "count": len(filas) if count is None else int(count),
        "hasMore": bool(has_more),
        "truncado": bool(truncado),
        "origen": origen or "",
        "filtros": dict(filtros or {}),
        "nota": nota,
    }


def registro(
    *,
    titulo: str,
    campos: list[list],
    origen: str,
    filtros: dict | None = None,
    nota: str = "",
) -> dict:
    """Payload de un solo registro; ``campos`` es una lista ``[etiqueta, valor]``."""
    return {
        "tipo": "item",
        "titulo": titulo,
        "columnas": [columna("Campo"), columna("Valor")],
        "filas": [[etiqueta, valor] for etiqueta, valor in campos],
        "totales": [],
        "count": 1,
        "hasMore": False,
        "truncado": False,
        "origen": origen or "",
        "filtros": dict(filtros or {}),
        "nota": nota,
    }


def guardar(ctx: dict, contenido: dict) -> dict:
    """Guarda el payload en el contexto de la conversación y lo devuelve."""
    ctx["payload"] = contenido
    return contenido
