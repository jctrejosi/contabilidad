"""Consultas del maestro global de terceros almacenado en FADCLI.

FADCLI no contiene CIA: el mismo directorio es compartido por todas las
contabilidades. Por su volumen, este repositorio pagina y filtra en Advantage;
nunca carga el archivo completo en memoria ni en el navegador.
"""

from __future__ import annotations

from typing import Any, Literal

from .ads_repository import _number, _open_recordset, _rows, _text, ads_connection


ThirdPartyState = Literal["todos", "activo", "bloqueado"]


def _like_literal(value: str) -> str:
    """Escapa texto recibido antes de incorporarlo a una expresión LIKE."""
    return (
        value.replace("'", "''")
        .replace("[", "[[]")
        .replace("%", "[%]")
        .replace("_", "[_]")
    )


def _date_yyyymmdd(value: Any) -> str:
    """Convierte la fecha numérica heredada de FADCLI a ISO para la interfaz."""
    number = int(_number(value))
    text = f"{number:08d}"
    if number <= 0 or len(text) != 8:
        return ""
    return f"{text[:4]}-{text[4:6]}-{text[6:8]}"


def _third_party_from_row(row: dict[str, Any]) -> dict[str, Any]:
    """Mapea únicamente los campos usados por el directorio contable web."""
    document_type = _text(row.get("CTIPDOC"))
    party_type = int(_number(row.get("CTIPOCLI")))
    state = int(_number(row.get("CESTADO")))
    return {
        "nit": _text(row.get("CCODIGO")),
        "digito": _text(row.get("CDIGITO")),
        "nombre": _text(row.get("CNOMBRE")),
        "tipo": "Jurídica" if party_type == 2 or document_type == "31" else "Natural",
        "tipoDoc": document_type,
        "direccion": _text(row.get("CDIREC")),
        "telefono": _text(row.get("CTELEF")),
        "ciudad": _text(row.get("CCIUDAD")),
        "estado": "Activo" if state == 1 else "Bloqueado",
        "motivoBloqueo": _text(row.get("CMOTIVO")) or None,
        "saldo": _number(row.get("CSALDO")),
        "cupo": _number(row.get("CCUPO")),
        "fechaCreacion": _date_yyyymmdd(row.get("CFCHCREA")),
    }


def _where_clause(search: str, state: ThirdPartyState) -> str:
    conditions: list[str] = []
    if search:
        term = _like_literal(search.strip())
        conditions.append(
            f"(CCODIGO LIKE '%{term}%' OR CNOMBRE LIKE '%{term}%' "
            f"OR CCIUDAD LIKE '%{term}%')"
        )
    if state == "activo":
        conditions.append("CESTADO = 1")
    elif state == "bloqueado":
        conditions.append("(CESTADO IS NULL OR CESTADO <> 1)")
    return f" WHERE {' AND '.join(conditions)}" if conditions else ""


def list_third_parties(
    *,
    page: int = 1,
    page_size: int = 100,
    search: str = "",
    state: ThirdPartyState = "todos",
) -> dict[str, Any]:
    """Devuelve una página ordenada por CCODIGO y el total de coincidencias."""
    if page < 1:
        raise ValueError("La página debe ser mayor o igual a 1.")
    if not 1 <= page_size <= 200:
        raise ValueError("El tamaño de página debe estar entre 1 y 200.")
    search = search.strip()
    if len(search) > 60:
        raise ValueError("La búsqueda no puede superar 60 caracteres.")
    if state not in {"todos", "activo", "bloqueado"}:
        raise ValueError("El estado solicitado no es válido.")

    where = _where_clause(search, state)
    start_at = (page - 1) * page_size + 1
    columns = (
        "CCODIGO, CDIGITO, CTIPOCLI, CTIPDOC, CNOMBRE, CDIREC, CTELEF, "
        "CCIUDAD, CESTADO, CMOTIVO, CSALDO, CCUPO, CFCHCREA"
    )
    data_sql = (
        f"SELECT TOP {page_size} START AT {start_at} {columns} "
        f"FROM FADCLI{where} ORDER BY CCODIGO"
    )
    count_sql = f"SELECT COUNT(*) AS TOTAL FROM FADCLI{where}"

    with ads_connection() as connection:
        count_recordset = _open_recordset(connection, count_sql)
        try:
            total_row = next(_rows(count_recordset), {"TOTAL": 0})
            total = int(_number(total_row.get("TOTAL")))
        finally:
            count_recordset.Close()

        data_recordset = _open_recordset(connection, data_sql)
        try:
            items = [_third_party_from_row(row) for row in _rows(data_recordset)]
        finally:
            data_recordset.Close()

    return {
        "items": items,
        "page": page,
        "pageSize": page_size,
        "total": total,
        "pages": max(1, (total + page_size - 1) // page_size),
    }
