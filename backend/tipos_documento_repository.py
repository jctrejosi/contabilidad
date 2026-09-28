"""Consulta del maestro global de tipos de documento VISDOCUM.

VISDOCUM no contiene CIA. Sus códigos y reglas operativas se comparten entre
compañías, pero cada lectura y escritura se restringe a SUC=1 mientras no haya
selección de sucursal en la aplicación.
"""

from __future__ import annotations

import re
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_BOOLEAN,
    ADO_TYPE_INTEGER,
    ADO_TYPE_VARCHAR,
    CompanyNotFound,
    _boolean,
    _company_exists,
    _execute,
    _number,
    _open_recordset,
    _rows,
    _text,
    ads_connection,
    ads_odbc_connection,
    normalize_company_code,
)
from .auditoria_repository import register_master_creation
from .lotes_repository import _one
from .visdocum_sucursal import VISDOCUM_SUCURSAL


MODULE_NAMES = {
    1: "Cartera",
    2: "Inventarios",
    3: "Cuentas por pagar",
    9: "Contabilidad",
}

# VISDOCUM.CODIGO (y COMPRO/DOCCONVER) usan códigos cortos de hasta dos caracteres.
DOCUMENT_TYPE_CODE = re.compile(r"^[A-Za-z0-9]{1,2}$")
DOCUMENT_TYPE_NAME_SIZE = 40
NUMERACION_VALUES = ("Manual", "Automatica")


class DocumentTypeAlreadyExists(RuntimeError):
    """Ya existe un tipo de documento con el mismo código."""


class DocumentTypeNotFound(RuntimeError):
    """No existe el tipo de documento pedido."""


class DocumentTypeValidationError(ValueError):
    """El tipo de documento incumple las reglas de VISDOCUM/tipos_documento."""


def normalize_document_type(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida y normaliza el alta de un tipo de documento (B2.3) antes del motor."""
    codigo = str(payload.get("codigo", "")).strip().upper()
    if not DOCUMENT_TYPE_CODE.fullmatch(codigo):
        raise DocumentTypeValidationError(
            "El código del tipo de documento debe tener entre 1 y 2 letras o dígitos."
        )
    nombre = str(payload.get("nombre", "")).strip()
    if not nombre:
        raise DocumentTypeValidationError("El nombre del tipo de documento es obligatorio.")
    if len(nombre) > DOCUMENT_TYPE_NAME_SIZE:
        raise DocumentTypeValidationError(
            f"El nombre del tipo de documento admite máximo {DOCUMENT_TYPE_NAME_SIZE} caracteres."
        )
    numeracion = str(payload.get("numeracion") or "Manual").strip()
    if numeracion not in NUMERACION_VALUES:
        raise DocumentTypeValidationError(
            "La numeración debe ser Manual o Automatica."
        )
    comprobante = str(payload.get("comprobante", "") or "").strip().upper()
    if comprobante and not DOCUMENT_TYPE_CODE.fullmatch(comprobante):
        raise DocumentTypeValidationError("El código del comprobante no es válido.")
    modulo = payload.get("modulo")
    if modulo in (None, ""):
        modulo = None
    else:
        try:
            modulo = int(modulo)
        except (TypeError, ValueError) as exc:
            raise DocumentTypeValidationError("El módulo debe ser numérico.") from exc
        if not 0 <= modulo <= 99:
            raise DocumentTypeValidationError("El módulo debe estar entre 0 y 99.")
    naturaleza = str(payload.get("naturaleza", "") or "").strip()
    if len(naturaleza) > 10:
        raise DocumentTypeValidationError("La naturaleza admite máximo 10 caracteres.")
    prefijo = str(payload.get("prefijo", "") or "").strip()
    if len(prefijo) > 10:
        raise DocumentTypeValidationError("El prefijo admite máximo 10 caracteres.")
    conversion = str(payload.get("conversionCodigo", "") or "").strip().upper()
    if len(conversion) > 10:
        raise DocumentTypeValidationError("El documento de conversión admite máximo 10 caracteres.")
    return {
        "codigo": codigo,
        "nombre": nombre,
        "numeracion": numeracion,
        "terceroObligatorio": bool(payload.get("terceroObligatorio", False)),
        "centroObligatorio": bool(payload.get("centroObligatorio", False)),
        "modulo": modulo,
        "naturaleza": naturaleza,
        "prefijo": prefijo,
        "comprobante": comprobante,
        "generaContabilizacion": bool(payload.get("generaContabilizacion", True)),
        "permiteConversion": bool(payload.get("permiteConversion", False)),
        "conversionCodigo": conversion,
    }


def document_type_item(data: dict[str, Any]) -> dict[str, Any]:
    """Elemento devuelto por el alta; ecoa el contrato de ``DocumentTypeCreate``."""
    return {
        "codigo": data["codigo"],
        "nombre": data["nombre"],
        "numeracion": data["numeracion"],
        "terceroObligatorio": data["terceroObligatorio"],
        "centroObligatorio": data["centroObligatorio"],
        "modulo": data["modulo"],
        "naturaleza": data["naturaleza"],
        "prefijo": data["prefijo"],
        "comprobante": data["comprobante"],
        "generaContabilizacion": data["generaContabilizacion"],
        "permiteConversion": data["permiteConversion"],
        "conversionCodigo": data["conversionCodigo"],
    }


def create_document_type(
    company_code: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un tipo de documento (B2.3) en el legado (``VISDOCUM``).

    ``VISDOCUM`` no tiene ``CIA``: la unicidad de ``CODIGO`` se comprueba dentro
    de la sucursal predeterminada. La compañía activa se usa para validar la
    referencia a ``CONTICOM.COMPRO``, que sí es por contabilidad. La numeración
    se guarda en ``MODICONSE`` (``Manual`` permite modificar el consecutivo).
    """
    data = normalize_document_type(payload)
    if data["terceroObligatorio"] or data["centroObligatorio"]:
        raise DocumentTypeValidationError(
            "VISDOCUM no tiene columnas de tercero o centro obligatorio: esa diferencia "
            "del modelo nuevo solo se puede fijar en PostgreSQL."
        )
    company_id = normalize_company_code(company_code)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {company_code}.")
        if _one(
            connection,
            f"SELECT TOP 1 CODIGO FROM VISDOCUM WHERE SUC = {VISDOCUM_SUCURSAL} AND CODIGO = ?",
            [(ADO_TYPE_VARCHAR, 2, data["codigo"])],
        ) is not None:
            raise DocumentTypeAlreadyExists(
                f"Ya existe el tipo de documento {data['codigo']}."
            )
        if data["comprobante"] and _one(
            connection,
            "SELECT TOP 1 CODIGO FROM CONTICOM WHERE CIA = ? AND CODIGO = ?",
            [(ADO_TYPE_INTEGER, 0, company_id), (ADO_TYPE_VARCHAR, 2, data["comprobante"])],
        ) is None:
            raise DocumentTypeValidationError(
                f"No existe el comprobante {data['comprobante']} en la compañía."
            )
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "INSERT INTO VISDOCUM "
                f"(SUC, CODIGO, NOMBRE, MODULO, TIPO, CONSE, MODICONSE, PREFIJO, COMPRO, "
                "ICONTAB, CONVER, DOCCONVER) "
                f"VALUES ({VISDOCUM_SUCURSAL}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (ADO_TYPE_VARCHAR, 2, data["codigo"]),
                    (ADO_TYPE_VARCHAR, DOCUMENT_TYPE_NAME_SIZE, data["nombre"]),
                    (ADO_TYPE_INTEGER, 0, data["modulo"] or 0),
                    (ADO_TYPE_VARCHAR, 10, data["naturaleza"]),
                    (ADO_TYPE_INTEGER, 0, 1),
                    (ADO_TYPE_BOOLEAN, 0, data["numeracion"] == "Manual"),
                    (ADO_TYPE_VARCHAR, 10, data["prefijo"]),
                    (ADO_TYPE_VARCHAR, 2, data["comprobante"]),
                    (ADO_TYPE_BOOLEAN, 0, data["generaContabilizacion"]),
                    (ADO_TYPE_BOOLEAN, 0, data["permiteConversion"]),
                    (ADO_TYPE_VARCHAR, 10, data["conversionCodigo"]),
                ],
            )
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    item = document_type_item(data)
    try:
        register_master_creation(user, "VISDOCUM", data["codigo"], "Alta de tipo de documento")
    except Exception as exc:
        item["advertencia"] = (
            f"El tipo de documento se creó, pero no fue posible registrar la bitácora: {exc}"
        )
    return item


def _nullable_boolean(value: Any) -> bool | None:
    """Conserva los NULL heredados para no convertirlos silenciosamente en No."""
    return None if value is None else _boolean(value)


def _document_type_from_row(row: dict[str, Any]) -> dict[str, Any]:
    """Traduce los controles principales usados por DOCUMVIS/TRAB_DOC."""
    module = int(_number(row.get("MODULO")))
    return {
        # El diccionario Advantage actual no define ID en VISDOCUM. CODIGO es
        # el identificador estable del catálogo global y sirve como clave UI.
        "id": _text(row.get("CODIGO")),
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
    """Devuelve todos los tipos de la sucursal, sin filtrar CIA ni MODULO.

    Contabilidad usa este catálogo en captura directa, lotes y reembolsos,
    incluidos los tipos que otros módulos crearon o administran.
    """
    sql = (
        "SELECT CODIGO, NOMBRE, MODULO, TIPO, CONSE, MODICONSE, PREFIJO, "
        "COMPRO, ICONTAB, ICXP, BANCOS, CONVER, DOCCONVER, FPAGO, DOCOFI, "
        "MODICOS, TRASLADO, REPETI, GRABASAL, VALDIAN "
        f"FROM VISDOCUM WHERE SUC = {VISDOCUM_SUCURSAL} ORDER BY CODIGO"
    )
    with ads_connection() as connection:
        recordset = _open_recordset(connection, sql)
        try:
            return [_document_type_from_row(row) for row in _rows(recordset)]
        finally:
            recordset.Close()
