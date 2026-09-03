"""Consulta del maestro global de tipos de documento VISDOCUM.

VISDOCUM no contiene CIA. Sus códigos y reglas operativas son compartidos por
todas las compañías/contabilidades, por lo que este repositorio nunca recibe
ni aplica un filtro de compañía.
"""

from __future__ import annotations

from typing import Any

from .ads_repository import _boolean, _number, _open_recordset, _rows, _text, ads_connection


MODULE_NAMES = {
    1: "Cartera",
    2: "Inventarios",
    3: "Cuentas por pagar",
    9: "Contabilidad",
}


def _nullable_boolean(value: Any) -> bool | None:
    """Conserva los NULL heredados para no convertirlos silenciosamente en No."""
    return None if value is None else _boolean(value)


def _document_type_from_row(row: dict[str, Any]) -> dict[str, Any]:
    """Traduce los controles principales usados por DOCUMVIS/TRAB_DOC."""
    module = int(_number(row.get("MODULO")))
    return {
        "id": int(_number(row.get("ID"))),
        "codigo": _text(row.get("CODIGO")),
        "nombre": _text(row.get("NOMBRE")),
        "modulo": module,
        "nombreModulo": MODULE_NAMES.get(module, f"No reconocido ({module})"),
        "tipo": _text(row.get("TIPO")),
        "consecutivo": int(_number(row.get("CONSE"))),
        "permiteModificarConsecutivo": _nullable_boolean(row.get("MODICONSE")),
        "prefijo": _text(row.get("PREFIJO")),
        "comprobante": _text(row.get("COMPRO")),
        "contabiliza": _nullable_boolean(row.get("ICONTAB")),
        "generaCuentasPorPagar": _nullable_boolean(row.get("ICXP")),
        "afectaBancos": _nullable_boolean(row.get("BANCOS")),
        "convierteDocumento": _nullable_boolean(row.get("CONVER")),
        "documentoConversion": _text(row.get("DOCCONVER")),
        "formaPago": _nullable_boolean(row.get("FPAGO")),
        "documentoOficial": _nullable_boolean(row.get("DOCOFI")),
        "modificaCostos": _nullable_boolean(row.get("MODICOS")),
        "esTraslado": _nullable_boolean(row.get("TRASLADO")),
        "permiteRepetir": _nullable_boolean(row.get("REPETI")),
        "grabaSaldo": _nullable_boolean(row.get("GRABASAL")),
        "validaDian": _nullable_boolean(row.get("VALDIAN")),
    }


def list_document_types() -> list[dict[str, Any]]:
    """Devuelve el catálogo global completo, ordenado por CODIGO."""
    sql = (
        "SELECT ID, CODIGO, NOMBRE, MODULO, TIPO, CONSE, MODICONSE, PREFIJO, "
        "COMPRO, ICONTAB, ICXP, BANCOS, CONVER, DOCCONVER, FPAGO, DOCOFI, "
        "MODICOS, TRASLADO, REPETI, GRABASAL, VALDIAN "
        "FROM VISDOCUM ORDER BY CODIGO"
    )
    with ads_connection() as connection:
        recordset = _open_recordset(connection, sql)
        try:
            return [_document_type_from_row(row) for row in _rows(recordset)]
        finally:
            recordset.Close()
