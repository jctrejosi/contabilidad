"""Impuestos (bloque D1): contract shared by both engines and the Advantage branch.

**Doble motor declarado (R10).** Las veinte rutas del módulo de Impuestos tienen
contrato JSON idéntico en los dos motores. Este módulo concentra:

- el contrato puro que comparten las dos ramas (``normalize_*``, ``*_item``);
- la rama **Advantage** (lecturas de CONIVA/CONRET/CONMAG1/CONMAG2/CONMAG3/
  CONMAGDT y escrituras físicas de los catálogos), con el candado
  ``accounting_write_lock``, ``BeginTrans``/``CommitTrans`` y la bitácora
  ``VISAUDI`` (R7, R8).

La rama de PostgreSQL vive en :mod:`backend.postgres_repository` (lecturas) y
:mod:`backend.postgres_writes` (escrituras), como en B1, B2 y B3; el despacho por
operación está en :mod:`backend.store` (R1).

**Advertencia de alcance (recálculo de acumulados).** La matriz declara que el
recalculo no está resuelto en el modelo (``db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md``
L31-46, P16/P17): ``regenerar_acumulados(Retencion)`` no reconstruye retenciones y
``regenerar_acumulados(Iva)`` no reconstruye ``acumulados_iva`` porque "falta
relación fiscal inequívoca desde el renglón". En el modelo nuevo esa relación sí
existe desde D-MOV-2: ``documento_lineas.clase`` (``IVA``/``Retencion``) más
``documento_lineas.tarifa_iva_id``/``concepto_retencion_id`` y ``base``
(``db/postgresql/schema/04_movimientos.sql`` L155-184). Por eso PostgreSQL **sí**
reconstruye un acumulado fiscal: acumula por tercero y por la tarifa/concepto
histórico del renglón, y **excluye** las filas cuya relación fiscal viene nula,
declarándolas en ``advertencia`` en vez de inventarlas.

En el legado la relación se pierde: ``MOV01.TIVA_RET`` trae la clase (``I``/``R``,
D-MOV-2) pero ``TINCON`` —el concepto— está **vacío en las 5.048.937 filas**
(``db/migration/homologacion/PENDIENTES.md`` D-MOV-1) y ``CONIVA`` no tiene
columnas de acumulación por período. Acumular en Advantage produciría una suma
por cuenta, que la matriz descarta expresamente como acumulado fiscal; por eso la
rama heredada **se declara no implementada** (:class:`TaxLegacyNotSupported`, 503)
en vez de escribir un acumulado plausible y falso.

**Porcentaje ↔ fracción.** El dominio ``porcentaje`` de PostgreSQL es una fracción
(``0.1`` es 10 %, ``db/postgresql/schema/01_dominios.sql`` L17). El legado guarda
porcentaje en ``CONMAG2.MONTO``; la conversión se hace en la lectura y en la
escritura con ``_fraccion``/``_porcentaje`` (§0 del detalle).
"""

from __future__ import annotations

import csv
import re
from decimal import Decimal, InvalidOperation
from io import BytesIO, StringIO
from typing import Any

from openpyxl import Workbook

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_DOUBLE,
    ADO_TYPE_VARCHAR,
    CompanyNotFound,
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
from .auditoria_repository import (
    register_master_creation,
    register_master_deletion,
    register_master_update,
)
from .companias_repository import validate_company_reason
from .lotes_repository import _one


# ---------------------------------------------------------------------------
# Constantes de contrato (R6)
# ---------------------------------------------------------------------------
COMPANY_CODE = re.compile(r"^[0-9]{1,3}$")
FORMAT_CODE = re.compile(r"^[A-Za-z0-9]{1,10}$")
CONCEPT_CODE = re.compile(r"^[A-Za-z0-9]{1,10}$")
ACCOUNT_CODE = re.compile(r"^[0-9]{0,12}$")
NIT_CODE = re.compile(r"^[A-Za-z0-9.-]{1,15}$")
FILTER_CODE = re.compile(r"^[A-Za-z0-9.-]+$")

FORMAT_NAME_SIZE = 60
PERCENT_FACTOR = Decimal("100")
ESTADOS_MEDIO = ("Generado", "Revisado", "Exportado")

# ``CONMAG1.CODFORMA`` y ``CONMAG2.CONCEPTO`` son de 4 posiciones en el legado.
LEGACY_FORMAT_CODE = re.compile(r"^[A-Za-z0-9]{1,4}$")
LEGACY_CONCEPT_CODE = re.compile(r"^[A-Za-z0-9]{1,4}$")


class TaxFormatAlreadyExists(RuntimeError):
    """Ya existe un formato con la misma compañía, código y vigencia."""


class TaxFormatNotFound(RuntimeError):
    """No existe el formato pedido para la compañía y la vigencia."""


class TaxFormatConflict(RuntimeError):
    """El formato no se puede cambiar o retirar en su estado actual."""


class TaxFormatValidationError(ValueError):
    """El formato, sus conceptos o sus asignaciones incumplen el contrato."""


class MediumNotFound(RuntimeError):
    """No existe la generación del medio pedida para la compañía."""


class MediumConflict(RuntimeError):
    """La generación del medio no admite la operación en su estado actual."""


class MediumValidationError(ValueError):
    """La generación, la fila o los topes incumplen el contrato."""


class AccumulationValidationError(ValueError):
    """La solicitud de acumulación incumple el contrato."""


class AccumulationConflict(RuntimeError):
    """La acumulación choca con el estado del ejercicio (año cerrado)."""


class TaxLegacyNotSupported(RuntimeError):
    """La operación no tiene una representación honesta en el legado (R10)."""


LEGACY_ACCUMULATION_MESSAGE = (
    "Advantage no puede reconstruir un acumulado fiscal: la relación concepto/"
    "tarifa del renglón no existe en el legado (MOV01.TINCON está vacío y CONIVA "
    "no tiene columnas de acumulación por período; "
    "db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md P16/P17). El recálculo solo está "
    "implementado con PostgreSQL. En Advantage la consulta sigue disponible."
)
LEGACY_MEDIA_MESSAGE = (
    "CONMAGDT es un acumulado sin número de generación, versión ni estado "
    "(db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md P20), así que la generación y la "
    "revisión del medio magnético solo están implementadas con PostgreSQL."
)
LEGACY_COPY_MESSAGE = (
    "La copia de definiciones entre compañías no tiene destino en el legado: "
    "CONMAG1/CONMAG2/CONMAG3 no tienen columna de compañía (son globales). "
    "La operación solo está implementada con PostgreSQL."
)


# ---------------------------------------------------------------------------
# Helpers puros de contrato y conversión de porcentaje
# ---------------------------------------------------------------------------
def periodo_de_mes(month: int) -> str:
    """Mes de la ruta (1..12) → período del modelo (``'02'``)."""
    return f"{int(month):02d}"


def _fraccion(value: Any, *, campo: str = "tarifa") -> Decimal:
    """Porcentaje del contrato como fracción (10 % es ``0.1``)."""
    try:
        fraccion = Decimal(str(value if value is not None else "0").strip())
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise TaxFormatValidationError(f"La {campo} debe ser numérica.") from exc
    if not Decimal("0") <= fraccion <= Decimal("1"):
        raise TaxFormatValidationError(
            "La tarifa es una fracción entre 0 y 1: 10 % se envía como 0.1."
        )
    return fraccion


def _porcentaje(value: Any) -> float:
    """Fracción del contrato (``0.1``) → porcentaje del legado (``10.0``)."""
    return float(_fraccion(value) * PERCENT_FACTOR)


def _fraccion_desde_legado(value: Any) -> float:
    """Porcentaje del legado (``MONTO = 10.0``) → fracción del contrato (``0.1``)."""
    return round(_number(value) / float(PERCENT_FACTOR), 6)


def _money(value: Any) -> float:
    """Importe del modelo a ``float`` estable (dos decimales)."""
    return round(float(Decimal(str(value if value is not None else "0"))), 2)


def _safe(value: str, label: str, pattern: re.Pattern[str], length: int) -> str:
    """Valida un filtro antes de interpolarlo en el SQL del legado."""
    text = str(value or "").strip()
    if len(text) > length or not pattern.fullmatch(text):
        raise ValueError(f"El filtro {label} contiene caracteres no válidos.")
    return text


# ---------------------------------------------------------------------------
# Formularios y vigencias (contrato puro)
# ---------------------------------------------------------------------------
def normalize_format(payload: dict[str, Any], *, include_codigo: bool) -> dict[str, Any]:
    """Valida el contrato de escritura de un formato de exógena (2.2 y 2.3)."""
    data: dict[str, Any] = {}
    if include_codigo:
        codigo = str(payload.get("codigo", "") or "").strip().upper()
        if not FORMAT_CODE.fullmatch(codigo):
            raise TaxFormatValidationError(
                "El código del formato debe tener entre 1 y 10 letras o dígitos."
            )
        data["codigo"] = codigo
    nombre = str(payload.get("nombre", "") or "").strip()
    if not nombre:
        raise TaxFormatValidationError("El nombre del formato es obligatorio.")
    if len(nombre) > FORMAT_NAME_SIZE:
        raise TaxFormatValidationError(
            f"El nombre del formato admite máximo {FORMAT_NAME_SIZE} caracteres."
        )
    try:
        vigencia = int(payload.get("vigencia"))
    except (TypeError, ValueError) as exc:
        raise TaxFormatValidationError("La vigencia del formato es obligatoria.") from exc
    if not 1900 <= vigencia <= 2100:
        raise TaxFormatValidationError("La vigencia debe estar entre 1900 y 2100.")
    data["nombre"] = nombre
    data["vigencia"] = vigencia
    data["activo"] = bool(payload.get("activo", True))
    return data


def format_item(data: dict[str, Any]) -> dict[str, Any]:
    """Elemento del ``GET``/``POST`` de formatos (contrato de 2.1 y 2.2)."""
    return {
        "codigo": str(data.get("codigo") or "").upper(),
        "nombre": str(data.get("nombre") or ""),
        "vigencia": data.get("vigencia"),
        "activo": bool(data.get("activo", True)),
        "conceptos": int(data.get("conceptos") or 0),
        "cuentasAsignadas": int(data.get("cuentasAsignadas") or 0),
    }


def normalize_format_conceptos(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida la lista de conceptos de un formato (2.5)."""
    conceptos = payload.get("conceptos")
    if conceptos is None:
        raise TaxFormatValidationError("La lista de conceptos es obligatoria.")
    if not isinstance(conceptos, list) or len(conceptos) > 200:
        raise TaxFormatValidationError("La lista de conceptos admite máximo 200 filas.")
    normalizados: list[dict[str, Any]] = []
    vistos: set[str] = set()
    for concepto in conceptos:
        codigo = str(concepto.get("codigo", "") or "").strip().upper()
        if not CONCEPT_CODE.fullmatch(codigo):
            raise TaxFormatValidationError(
                "El código del concepto debe tener entre 1 y 10 letras o dígitos."
            )
        if codigo in vistos:
            raise TaxFormatValidationError(
                f"El concepto {codigo} está repetido en la lista: los códigos no pueden duplicarse."
            )
        vistos.add(codigo)
        nombre = str(concepto.get("nombre", "") or "").strip()
        if not nombre:
            raise TaxFormatValidationError(f"El concepto {codigo} requiere nombre.")
        cuenta = str(concepto.get("cuenta", "") or "").strip()
        if not ACCOUNT_CODE.fullmatch(cuenta):
            raise TaxFormatValidationError("La cuenta debe contener hasta 12 dígitos.")
        normalizados.append({
            "codigo": codigo,
            "nombre": nombre,
            "tarifa": _fraccion(concepto.get("tarifa"), campo="tarifa del concepto"),
            "cuenta": cuenta,
        })
    motivo = validate_company_reason(payload.get("motivo", ""))
    return {"conceptos": normalizados, "motivo": motivo}


def normalize_format_asignaciones(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida la lista de cuentas asignadas a un formato (2.6)."""
    cuentas = payload.get("cuentas")
    if cuentas is None:
        raise TaxFormatValidationError("La lista de cuentas es obligatoria.")
    if not isinstance(cuentas, list) or len(cuentas) > 2000:
        raise TaxFormatValidationError("La lista de cuentas admite máximo 2.000 filas.")
    normalizadas: list[str] = []
    vistos: set[str] = set()
    for cuenta in cuentas:
        codigo = str(cuenta or "").strip()
        if not re.fullmatch(r"[0-9]{1,12}", codigo):
            raise TaxFormatValidationError(
                "Cada cuenta asignada debe tener entre 1 y 12 dígitos."
            )
        if codigo in vistos:
            raise TaxFormatValidationError(
                f"La cuenta {codigo} está repetida en la lista."
            )
        vistos.add(codigo)
        normalizadas.append(codigo)
    motivo = validate_company_reason(payload.get("motivo", ""))
    return {"cuentas": normalizadas, "motivo": motivo}


def normalize_format_copy(payload: dict[str, Any], *, cia_destino: str) -> dict[str, Any]:
    """Valida la copia de definiciones entre compañías (2.7)."""
    origen = str(payload.get("ciaOrigen", "") or "").strip()
    destino = str(cia_destino or "").strip()
    if not COMPANY_CODE.fullmatch(origen):
        raise TaxFormatValidationError("El código de la compañía de origen no es válido.")
    if normalize_company_code(origen) == normalize_company_code(destino):
        raise TaxFormatValidationError(
            "La compañía de origen debe ser distinta de la de destino."
        )
    vigencias: dict[str, int] = {}
    for clave in ("vigenciaOrigen", "vigenciaDestino"):
        try:
            valor = int(payload.get(clave))
        except (TypeError, ValueError) as exc:
            raise TaxFormatValidationError(f"{clave} es obligatoria.") from exc
        if not 1900 <= valor <= 2100:
            raise TaxFormatValidationError(f"{clave} debe estar entre 1900 y 2100.")
        vigencias[clave] = valor
    formatos = payload.get("formatos")
    if formatos is not None:
        if not isinstance(formatos, list) or len(formatos) > 200:
            raise TaxFormatValidationError("La lista de formatos admite máximo 200 códigos.")
        formatos = [str(codigo).strip().upper() for codigo in formatos]
        if any(not FORMAT_CODE.fullmatch(codigo) for codigo in formatos):
            raise TaxFormatValidationError("Algún código de formato no es válido.")
    motivo = validate_company_reason(payload.get("motivo", ""))
    return {
        "ciaOrigen": origen,
        "vigenciaOrigen": vigencias["vigenciaOrigen"],
        "vigenciaDestino": vigencias["vigenciaDestino"],
        "formatos": formatos,
        "reemplazar": bool(payload.get("reemplazar", False)),
        "motivo": motivo,
    }


# ---------------------------------------------------------------------------
# Medios magnéticos (contrato puro)
# ---------------------------------------------------------------------------
def normalize_accumulation(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida la solicitud de acumulación de IVA o de retenciones (1.2 y 1.5)."""
    try:
        anio = int(payload.get("anio"))
        mes_desde = int(payload.get("mesDesde"))
        mes_hasta = int(payload.get("mesHasta"))
    except (TypeError, ValueError) as exc:
        raise AccumulationValidationError(
            "El año y el rango de meses son obligatorios."
        ) from exc
    if not 1900 <= anio <= 2100:
        raise AccumulationValidationError("El año debe estar entre 1900 y 2100.")
    if not 1 <= mes_desde <= 12 or not 1 <= mes_hasta <= 12:
        raise AccumulationValidationError("Los meses deben estar entre 1 y 12.")
    if mes_desde > mes_hasta:
        raise AccumulationValidationError(
            "El mes inicial no puede ser mayor que el mes final."
        )
    try:
        motivo = validate_company_reason(payload.get("motivo", ""))
    except ValueError as exc:
        raise AccumulationValidationError(str(exc)) from exc
    return {
        "anio": anio,
        "mesDesde": mes_desde,
        "mesHasta": mes_hasta,
        "motivo": motivo,
    }


def normalize_medium_generation(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida la generación del medio magnético (3.2)."""
    try:
        anio = int(payload.get("anio"))
        vigencia = int(payload.get("vigencia"))
    except (TypeError, ValueError) as exc:
        raise MediumValidationError("El año y la vigencia son obligatorios.") from exc
    for valor, etiqueta in ((anio, "año"), (vigencia, "vigencia")):
        if not 1900 <= valor <= 2100:
            raise MediumValidationError(f"El {etiqueta} debe estar entre 1900 y 2100.")
    formatos = payload.get("formatos")
    if formatos is not None:
        if not isinstance(formatos, list) or len(formatos) > 200:
            raise MediumValidationError("La lista de formatos admite máximo 200 códigos.")
        formatos = [str(codigo).strip().upper() for codigo in formatos]
        if any(not FORMAT_CODE.fullmatch(codigo) for codigo in formatos):
            raise MediumValidationError("Algún código de formato no es válido.")
    motivo = validate_company_reason(payload.get("motivo", ""))
    return {"anio": anio, "vigencia": vigencia, "formatos": formatos, "motivo": motivo}


def normalize_medium_row(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida el ajuste de una fila revisada (3.4)."""
    data: dict[str, Any] = {}
    for clave in ("valor", "base"):
        if payload.get(clave) is not None:
            try:
                numero = Decimal(str(payload[clave]).strip())
            except (InvalidOperation, TypeError, ValueError) as exc:
                raise MediumValidationError(f"El {clave} de la fila debe ser numérico.") from exc
            if numero < 0:
                raise MediumValidationError(f"El {clave} de la fila no puede ser negativo.")
            data[clave] = numero
    concepto = payload.get("concepto")
    if concepto is not None:
        codigo = str(concepto).strip().upper()
        if len(codigo) > 10:
            raise MediumValidationError("El concepto de la fila admite máximo 10 caracteres.")
        data["concepto"] = codigo
    if not data:
        raise MediumValidationError(
            "Indique al menos el valor, la base o el concepto que se va a ajustar."
        )
    data["motivo"] = validate_company_reason(payload.get("motivo", ""))
    return data


def normalize_medium_topes(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida el reemplazo de topes del año (3.6)."""
    try:
        anio = int(payload.get("anio"))
    except (TypeError, ValueError) as exc:
        raise MediumValidationError("El año de los topes es obligatorio.") from exc
    if not 1900 <= anio <= 2100:
        raise MediumValidationError("El año de los topes debe estar entre 1900 y 2100.")
    topes = payload.get("topes")
    if topes is None:
        raise MediumValidationError("La lista de topes es obligatoria.")
    if not isinstance(topes, list) or len(topes) > 500:
        raise MediumValidationError("La lista de topes admite máximo 500 filas.")
    normalizados: list[dict[str, Any]] = []
    vistos: set[tuple[str, str]] = set()
    for tope in topes:
        formato = str(tope.get("formato", "") or "").strip().upper()
        if not FORMAT_CODE.fullmatch(formato):
            raise MediumValidationError("Algún código de formato no es válido.")
        concepto = str(tope.get("concepto", "") or "").strip().upper()
        if len(concepto) > 10:
            raise MediumValidationError("El concepto admite máximo 10 caracteres.")
        try:
            valor = Decimal(str(tope.get("tope", "0")).strip())
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise MediumValidationError("El tope debe ser numérico.") from exc
        if valor < 0:
            raise MediumValidationError("El tope no puede ser negativo.")
        clave = (formato, concepto)
        if clave in vistos:
            raise MediumValidationError(
                f"El tope de {formato}/{concepto or 'sin concepto'} está repetido."
            )
        vistos.add(clave)
        normalizados.append({"formato": formato, "concepto": concepto, "tope": valor})
    motivo = validate_company_reason(payload.get("motivo", ""))
    return {"anio": anio, "topes": normalizados, "motivo": motivo}


def medio_item(data: dict[str, Any]) -> dict[str, Any]:
    """Elemento del ``GET``/``POST`` de generaciones de medios (3.1 y 3.2)."""
    return {
        "id": int(data.get("id") or 0),
        "numeroGeneracion": int(data.get("numeroGeneracion") or 0),
        "anio": int(data.get("anio") or 0),
        "estado": str(data.get("estado") or "Generado"),
        "generadoEn": str(data.get("generadoEn") or ""),
        "formatos": int(data.get("formatos") or 0),
        "registros": int(data.get("registros") or 0),
        "cuadrado": bool(data.get("cuadrado", True)),
    }


# ---------------------------------------------------------------------------
# Exportación (misma forma que el resto de la API)
# ---------------------------------------------------------------------------
def build_acumulado_export(
    *,
    titulo: str,
    headers: list[str],
    rows: list[list[Any]],
    cia: str,
    anio: int,
    mes_desde: int,
    mes_hasta: int,
    source: str,
    formato: str,
) -> bytes:
    """Reutiliza el exportador de informes para servir el acumulado filtrado."""
    from .informes_adicionales_repository import export_additional_report

    report = {
        "id": "impuestos-acumulados",
        "compania": {"codigo": cia, "nombre": titulo, "nit": ""},
        "anio": anio,
        "mesDesde": mes_desde,
        "mesHasta": mes_hasta,
        "columnas": [{"label": label, "money": False} for label in headers],
        "filas": rows,
        "count": len(rows),
        "source": source,
        "nota": "",
    }
    return export_additional_report(report, formato)


def build_medio_export(
    medio: dict[str, Any], filas: list[dict[str, Any]], formato: str
) -> bytes:
    """Serializa el medio magnético como XML, CSV o XLSX (3.7)."""
    headers = [
        "formato", "nit", "nombre", "concepto", "cuenta", "base", "tarifa", "valor", "ajustado",
    ]
    if formato == "csv":
        output = StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(headers)
        for fila in filas:
            writer.writerow([fila.get(columna, "") for columna in headers])
        return ("\ufeff" + output.getvalue()).encode("utf-8")
    if formato == "xlsx":
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Medio magnético"
        sheet.append([f"Medio magnético {medio['anio']} · generación {medio['numeroGeneracion']}"])
        sheet.append(headers)
        for fila in filas:
            sheet.append([fila.get(columna, "") for columna in headers])
        output = BytesIO()
        workbook.save(output)
        return output.getvalue()
    # XML: estructura simple y versionada, sin inventar columnas del formato.
    from xml.sax.saxutils import escape

    partes = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<medio anio="{int(medio["anio"])}" generacion="{int(medio["numeroGeneracion"])}" '
        f'estado="{escape(str(medio["estado"]))}">',
    ]
    for fila in filas:
        partes.append(
            "<registro>"
            f"<formato>{escape(str(fila.get('formato', '')))}</formato>"
            f"<nit>{escape(str(fila.get('nit', '')))}</nit>"
            f"<concepto>{escape(str(fila.get('concepto', '')))}</concepto>"
            f"<cuenta>{escape(str(fila.get('cuenta', '')))}</cuenta>"
            f"<base>{fila.get('base', 0)}</base>"
            f"<valor>{fila.get('valor', 0)}</valor>"
            "</registro>"
        )
    partes.append("</medio>")
    return "".join(partes).encode("utf-8")


# ---------------------------------------------------------------------------
# Rama Advantage: lecturas
# ---------------------------------------------------------------------------
def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    """``_open_recordset`` + cierre, como el resto de los repositorios ADS."""
    recordset = _open_recordset(connection, sql)
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _periodo_de_fecha(value: Any) -> str:
    """Mes de la fecha numérica heredada (``AAAMMDD``) como período ``'MM'``."""
    numero = int(_number(value))
    texto = str(numero)
    if numero <= 0 or len(texto) != 8:
        return ""
    mes = int(texto[4:6])
    return f"{mes:02d}" if 1 <= mes <= 12 else ""


def list_acumulados_iva(
    cia: str,
    anio: int,
    mes_desde: int,
    mes_hasta: int,
    *,
    nit: str = "",
    page: int = 1,
    page_size: int = 100,
) -> dict[str, Any]:
    """IVA acumulado por tercero y período leído de ``CONIVA`` (1.1)."""
    company_id = normalize_company_code(cia)
    nit = _safe(nit, "nit", NIT_CODE, 15) if nit else ""
    min_fecha = anio * 10000 + mes_desde * 100 + 1
    max_fecha = anio * 10000 + mes_hasta * 100 + 31
    condiciones = [f"TFECHA >= {min_fecha}", f"TFECHA <= {max_fecha}"]
    if nit:
        condiciones.append(f"NIT = '{nit}'")
    sql = (
        "SELECT NIT, TFECHA, TBASE, TVALOR FROM CONIVA WHERE "
        + " AND ".join(condiciones)
    )
    agrupado: dict[tuple[str, str], dict[str, float]] = {}
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        for fila in _read(connection, sql):
            periodo = _periodo_de_fecha(fila.get("TFECHA"))
            if not periodo:
                continue
            clave = (_text(fila.get("NIT")), periodo)
            acumulado = agrupado.setdefault(clave, {"base": 0.0, "valor": 0.0})
            acumulado["base"] += _number(fila.get("TBASE"))
            acumulado["valor"] += _number(fila.get("TVALOR"))
    items = [
        {
            "nit": tercero,
            "nombre": "",
            "periodo": periodo,
            "base": round(datos["base"], 2),
            "ivaGenerado": round(datos["valor"], 2),
            # CONIVA no distingue IVA generado de descontable: se declara, no se inventa.
            "ivaDescontable": 0.0,
            "neto": round(datos["valor"], 2),
        }
        for (tercero, periodo), datos in sorted(agrupado.items())
    ]
    return {
        "items": items[(page - 1) * page_size: (page - 1) * page_size + page_size],
        "count": len(items),
        "totales": {
            "base": round(sum(item["base"] for item in items), 2),
            "ivaGenerado": round(sum(item["ivaGenerado"] for item in items), 2),
            "ivaDescontable": round(sum(item["ivaDescontable"] for item in items), 2),
            "neto": round(sum(item["neto"] for item in items), 2),
        },
        # El legado no tiene ``estado_acumulaciones``: no hay fecha de actualización.
        "ultimaActualizacion": None,
        "source": "CONIVA",
        "sharedAcrossCompanies": True,
        "advertencia": (
            "CONIVA es una tabla de trabajo por documento sin columna de IVA generado/"
            "descontable ni fecha de última acumulación: se declara en vez de simularlo "
            "(db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md P17)."
        ),
    }


def list_acumulados_retencion(
    cia: str,
    anio: int,
    mes_desde: int,
    mes_hasta: int,
    *,
    nit: str = "",
    concepto: str = "",
    page: int = 1,
    page_size: int = 100,
) -> dict[str, Any]:
    """Retenciones acumuladas por tercero y período leídas de ``CONRET`` (1.4)."""
    company_id = normalize_company_code(cia)
    nit = _safe(nit, "nit", NIT_CODE, 15) if nit else ""
    concepto = _safe(concepto, "concepto", FILTER_CODE, 12) if concepto else ""
    meses = list(range(mes_desde, mes_hasta + 1))
    columnas = ", ".join(
        f"BASE{mes:02d}, VALOR{mes:02d}" for mes in meses
    )
    condiciones = []
    if nit:
        condiciones.append(f"NIT = '{nit}'")
    if concepto:
        condiciones.append(f"CODIGO = '{concepto}'")
    sql = f"SELECT NIT, CODIGO, {columnas} FROM CONRET"
    if condiciones:
        sql += " WHERE " + " AND ".join(condiciones)
    items: list[dict[str, Any]] = []
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        for fila in _read(connection, sql):
            tercero = _text(fila.get("NIT"))
            codigo = _text(fila.get("CODIGO"))
            for mes in meses:
                base = _number(fila.get(f"BASE{mes:02d}"))
                valor = _number(fila.get(f"VALOR{mes:02d}"))
                if base == 0 and valor == 0:
                    continue
                items.append({
                    "nit": tercero,
                    "nombre": "",
                    "concepto": codigo,
                    # CONMAG1/CONTIRET no dan el nombre del concepto por código de
                    # 12 posiciones; se declara vacío en vez de inventarlo.
                    "nombreConcepto": "",
                    "periodo": f"{mes:02d}",
                    "base": round(base, 2),
                    # CONRET no guarda la tarifa del acumulado: el campo viaja nulo.
                    "tarifa": None,
                    "valor": round(valor, 2),
                })
    items.sort(key=lambda item: (item["nit"], item["concepto"], item["periodo"]))
    return {
        "items": items[(page - 1) * page_size: (page - 1) * page_size + page_size],
        "count": len(items),
        "totales": {
            "base": round(sum(item["base"] for item in items), 2),
            "valor": round(sum(item["valor"] for item in items), 2),
        },
        "ultimaActualizacion": None,
        "source": "CONRET",
        "sharedAcrossCompanies": True,
        "advertencia": (
            "CONRET no tiene columna de tarifa ni nombre de concepto por fila: la "
            "tarifa viaja nula (no se rellena con la de hoy) y el nombre no se simula."
        ),
    }


def list_formatos(cia: str, *, anio: int | None = None) -> dict[str, Any]:
    """Formatos de exógena de ``CONMAG1`` con sus conteos (2.1)."""
    company_id = normalize_company_code(cia)
    sql = (
        "SELECT f.CODFORMA, f.NOMFORMA, "
        "(SELECT COUNT(*) FROM CONMAG2 c WHERE c.FORMATO = f.CODFORMA) AS CONCEPTOS, "
        "(SELECT COUNT(*) FROM CONMAG3 a WHERE a.FORMATO = f.CODFORMA) AS CUENTAS "
        "FROM CONMAG1 f ORDER BY f.CODFORMA"
    )
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        filas = _read(connection, sql)
    items = [
        format_item({
            "codigo": _text(fila.get("CODFORMA")),
            "nombre": _text(fila.get("NOMFORMA")),
            # CONMAG1 no tiene vigencia: se declara nula, no se inventa.
            "vigencia": None,
            # CONMAG1 no tiene estado: los formatos del legado son activos.
            "activo": True,
            "conceptos": _number(fila.get("CONCEPTOS")),
            "cuentasAsignadas": _number(fila.get("CUENTAS")),
        })
        for fila in filas
    ]
    return {
        "items": items,
        "count": len(items),
        # CONMAG1 es global (no tiene columna de compañía), como CONTIIVA/VISDOCUM.
        "source": "CONMAG1",
        "sharedAcrossCompanies": True,
        "advertencia": (
            "CONMAG1 no tiene columnas de vigencia ni de estado: la vigencia viaja nula "
            "y todos los formatos se consideran activos "
            "(db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md P19)."
        ),
    }


def list_medios(cia: str, anio: int) -> dict[str, Any]:
    """Generaciones de medios: el legado no las conserva como recurso (3.1)."""
    company_id = normalize_company_code(cia)
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
    return {
        "items": [],
        "count": 0,
        "source": "CONMAGDT",
        "sharedAcrossCompanies": True,
        "advertencia": LEGACY_MEDIA_MESSAGE,
    }


# ---------------------------------------------------------------------------
# Rama Advantage: escrituras de catálogos
# ---------------------------------------------------------------------------
def _legacy_format_code(codigo: str) -> str:
    """Código de formato validado contra el ancho real de ``CONMAG1.CODFORMA``."""
    code = str(codigo or "").strip().upper()
    if not FORMAT_CODE.fullmatch(code):
        raise TaxFormatValidationError(
            "El código del formato debe tener entre 1 y 10 letras o dígitos."
        )
    if not LEGACY_FORMAT_CODE.fullmatch(code):
        raise TaxFormatValidationError(
            "CONMAG1 admite códigos de máximo 4 caracteres: el código largo solo se "
            "puede usar con PostgreSQL."
        )
    return code


def _audit(
    item: dict[str, Any], user: str, table: str, code: str, accion: str, detail: str = ""
) -> None:
    """Bitácora VISAUDI sin deshacer la operación ya confirmada (R8)."""
    try:
        if accion == "alta":
            register_master_creation(user, table, code, f"Impuestos: alta de {table}")
        elif accion == "baja":
            register_master_deletion(user, table, code, detail or "Baja de formato de exógena")
        else:
            register_master_update(user, table, code, f"Impuestos: {accion} de {table}")
    except Exception as exc:  # pragma: no cover - depende de VISAUDI disponible
        item["advertencia"] = (
            f"La operación se aplicó, pero no fue posible registrar la bitácora: {exc}"
        )


def create_formato(cia: str, payload: dict[str, Any], *, user: str = "WEB") -> dict[str, Any]:
    """Crea un formato de exógena en ``CONMAG1`` (2.2)."""
    data = normalize_format(payload, include_codigo=True)
    data["codigo"] = _legacy_format_code(data["codigo"])
    if not data["activo"]:
        raise TaxFormatValidationError(
            "CONMAG1 no tiene columna de estado: un formato nuevo solo puede nacer "
            "activo en Advantage."
        )
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _one(
            connection,
            "SELECT TOP 1 CODFORMA FROM CONMAG1 WHERE CODFORMA = ?",
            [(ADO_TYPE_VARCHAR, 4, data["codigo"])],
        ) is not None:
            raise TaxFormatAlreadyExists(f"Ya existe el formato {data['codigo']}.")
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "INSERT INTO CONMAG1 (CODFORMA, NOMFORMA) VALUES (?, ?)",
                [
                    (ADO_TYPE_VARCHAR, 4, data["codigo"]),
                    (ADO_TYPE_VARCHAR, FORMAT_NAME_SIZE, data["nombre"]),
                ],
            )
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    item = format_item({**data, "vigencia": None, "activo": True})
    item["advertencia"] = (
        "CONMAG1 no tiene columna de vigencia: el formato quedó sin vigencia (solo el "
        "modelo nuevo la conserva)."
    )
    _audit(item, user, "CONMAG1", data["codigo"], "alta")
    return item


def update_formato(
    cia: str, codigo: str, vigencia: int | None, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica el nombre de un formato de ``CONMAG1`` (2.3)."""
    code = _legacy_format_code(codigo)
    data = normalize_format(
        {**payload, "codigo": code, "vigencia": vigencia}, include_codigo=True
    )
    if not data["activo"]:
        raise TaxFormatValidationError(
            "CONMAG1 no tiene columna de estado: la baja de un formato en Advantage es física."
        )
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _one(
            connection,
            "SELECT TOP 1 CODFORMA FROM CONMAG1 WHERE CODFORMA = ?",
            [(ADO_TYPE_VARCHAR, 4, code)],
        ) is None:
            raise TaxFormatNotFound(f"No existe el formato {code}.")
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "UPDATE CONMAG1 SET NOMFORMA = ? WHERE CODFORMA = ?",
                [
                    (ADO_TYPE_VARCHAR, FORMAT_NAME_SIZE, data["nombre"]),
                    (ADO_TYPE_VARCHAR, 4, code),
                ],
            )
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    item = format_item({**data, "vigencia": None, "activo": True})
    item["advertencia"] = "CONMAG1 no tiene columna de vigencia ni de estado en el legado."
    _audit(item, user, "CONMAG1", code, "modificacion")
    return item


def delete_formato(
    cia: str,
    codigo: str,
    *,
    vigencia: int | None = None,
    reason: str,
    user: str = "WEB",
    dry_run: bool = False,
) -> dict[str, Any]:
    """Baja física de un formato de ``CONMAG1`` (2.4)."""
    code = _legacy_format_code(codigo)
    motivo = validate_company_reason(reason)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _one(
            connection,
            "SELECT TOP 1 CODFORMA FROM CONMAG1 WHERE CODFORMA = ?",
            [(ADO_TYPE_VARCHAR, 4, code)],
        ) is None:
            raise TaxFormatNotFound(f"No existe el formato {code}.")
        if not dry_run:
            connection.BeginTrans()
            try:
                _execute(
                    connection,
                    "DELETE FROM CONMAG1 WHERE CODFORMA = ?",
                    [(ADO_TYPE_VARCHAR, 4, code)],
                )
                connection.CommitTrans()
            except Exception:
                try:
                    connection.RollbackTrans()
                except Exception:
                    pass
                raise
    item = {
        "codigo": code,
        "vigencia": None,
        "eliminado": not dry_run,
        # CONMAG1 no tiene bandera de baja ni relación con un medio exportado.
        "bajaLogica": False,
        "referencias": None,
    }
    if not dry_run:
        _audit(item, user, "CONMAG1", code, "baja", motivo)
    return item


def replace_formato_conceptos(
    cia: str,
    codigo: str,
    vigencia: int | None,
    payload: dict[str, Any],
    *,
    user: str = "WEB",
    dry_run: bool = False,
) -> dict[str, Any]:
    """Reemplaza los conceptos de un formato en ``CONMAG2`` (2.5)."""
    code = _legacy_format_code(codigo)
    data = normalize_format_conceptos(payload)
    if any(concepto["cuenta"] for concepto in data["conceptos"]):
        raise TaxFormatValidationError(
            "CONMAG2 no tiene columna de cuenta: la cuenta por concepto solo se puede "
            "fijar en PostgreSQL (la relación cuenta/formato vive en CONMAG3)."
        )
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _one(
            connection,
            "SELECT TOP 1 CODFORMA FROM CONMAG1 WHERE CODFORMA = ?",
            [(ADO_TYPE_VARCHAR, 4, code)],
        ) is None:
            raise TaxFormatNotFound(f"No existe el formato {code}.")
        existentes = {
            _text(fila.get("CONCEPTO")): fila
            for fila in _read(connection, f"SELECT CONCEPTO FROM CONMAG2 WHERE FORMATO = '{code}'")
        }
        entrantes = {concepto["codigo"]: concepto for concepto in data["conceptos"]}
        if not dry_run:
            connection.BeginTrans()
            try:
                _execute(
                    connection,
                    "DELETE FROM CONMAG2 WHERE FORMATO = ?",
                    [(ADO_TYPE_VARCHAR, 4, code)],
                )
                for concepto in data["conceptos"]:
                    _execute(
                        connection,
                        "INSERT INTO CONMAG2 (FORMATO, CONCEPTO, NOMCONCEP, MONTO) "
                        "VALUES (?, ?, ?, ?)",
                        [
                            (ADO_TYPE_VARCHAR, 4, code),
                            (ADO_TYPE_VARCHAR, 4, concepto["codigo"]),
                            (ADO_TYPE_VARCHAR, 40, concepto["nombre"]),
                            # Fracción del contrato → porcentaje del legado (§0).
                            (ADO_TYPE_DOUBLE, 0, _porcentaje(concepto["tarifa"])),
                        ],
                    )
                connection.CommitTrans()
            except Exception:
                try:
                    connection.RollbackTrans()
                except Exception:
                    pass
                raise
    creados = len([cod for cod in entrantes if cod not in existentes])
    actualizados = len([cod for cod in entrantes if cod in existentes])
    retirados = len([cod for cod in existentes if cod not in entrantes])
    item = {
        "codigo": code,
        "vigencia": None,
        "conceptos": len(data["conceptos"]),
        "creados": creados,
        "actualizados": actualizados,
        "retirados": retirados,
        "dryRun": dry_run,
        "advertencia": (
            "CONMAG2 no tiene vigencia ni cuenta por concepto: la lista se reemplazó sin "
            "vigencia y la cuenta debe asignarse por CONMAG3."
        ),
    }
    if not dry_run:
        _audit(item, user, "CONMAG2", code, "reemplazo de conceptos")
    return item


def replace_formato_asignaciones(
    cia: str,
    codigo: str,
    vigencia: int | None,
    payload: dict[str, Any],
    *,
    user: str = "WEB",
    dry_run: bool = False,
) -> dict[str, Any]:
    """Reemplaza las cuentas asignadas a un formato en ``CONMAG3`` (2.6)."""
    code = _legacy_format_code(codigo)
    data = normalize_format_asignaciones(payload)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _one(
            connection,
            "SELECT TOP 1 CODFORMA FROM CONMAG1 WHERE CODFORMA = ?",
            [(ADO_TYPE_VARCHAR, 4, code)],
        ) is None:
            raise TaxFormatNotFound(f"No existe el formato {code}.")
        existentes = {
            _text(fila.get("CUENTA"))
            for fila in _read(connection, f"SELECT CUENTA FROM CONMAG3 WHERE FORMATO = '{code}'")
        }
        if not dry_run:
            connection.BeginTrans()
            try:
                _execute(
                    connection,
                    "DELETE FROM CONMAG3 WHERE FORMATO = ?",
                    [(ADO_TYPE_VARCHAR, 4, code)],
                )
                for cuenta in data["cuentas"]:
                    _execute(
                        connection,
                        "INSERT INTO CONMAG3 (CUENTA, FORMATO, CONCEPTO, TIPO) VALUES (?, ?, ?, ?)",
                        [
                            (ADO_TYPE_VARCHAR, 12, cuenta),
                            (ADO_TYPE_VARCHAR, 4, code),
                            (ADO_TYPE_VARCHAR, 4, ""),
                            (ADO_TYPE_VARCHAR, 1, "C"),
                        ],
                    )
                connection.CommitTrans()
            except Exception:
                try:
                    connection.RollbackTrans()
                except Exception:
                    pass
                raise
    entrantes = set(data["cuentas"])
    item = {
        "codigo": code,
        "vigencia": None,
        "asignadas": len(entrantes),
        "creadas": len(entrantes - existentes),
        "retiradas": len(existentes - entrantes),
        "dryRun": dry_run,
        "advertencia": (
            "CONMAG3 no tiene columna de compañía ni rango CUENTA..CUENTA2 en el "
            "contrato: cada cuenta se guarda como una fila y no se valida contra el "
            "plan como hace la FK de PostgreSQL "
            "(db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md P19)."
        ),
    }
    if not dry_run:
        _audit(item, user, "CONMAG3", code, "reemplazo de asignaciones")
    return item


def copy_formatos(
    cia: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Copia de definiciones: declarada no implementada en el legado (2.7)."""
    normalize_format_copy(payload, cia_destino=cia)
    raise TaxLegacyNotSupported(LEGACY_COPY_MESSAGE)


def replace_topes(
    cia: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Reemplaza los topes del año en ``CONMAG2.MONTO`` (3.6)."""
    data = normalize_medium_topes(payload)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        existentes = {
            (_text(fila.get("FORMATO")), _text(fila.get("CONCEPTO")))
            for fila in _read(connection, "SELECT FORMATO, CONCEPTO FROM CONMAG2")
        }
        definiciones = {
            (_text(fila.get("FORMATO")), _text(fila.get("CONCEPTO")))
            for fila in _read(connection, "SELECT FORMATO, CONCEPTO FROM CONMAG2")
        }
        for tope in data["topes"]:
            if (tope["formato"], tope["concepto"]) not in definiciones:
                raise MediumValidationError(
                    f"No existe el formato/concepto {tope['formato']}/"
                    f"{tope['concepto'] or 'sin concepto'} en CONMAG2."
                )
        if not dry_run:
            connection.BeginTrans()
            try:
                for tope in data["topes"]:
                    _execute(
                        connection,
                        "UPDATE CONMAG2 SET MONTO = ? WHERE FORMATO = ? AND CONCEPTO = ?",
                        [
                            (ADO_TYPE_DOUBLE, 0, float(tope["tope"])),
                            (ADO_TYPE_VARCHAR, 4, tope["formato"]),
                            (ADO_TYPE_VARCHAR, 4, tope["concepto"]),
                        ],
                    )
                connection.CommitTrans()
            except Exception:
                try:
                    connection.RollbackTrans()
                except Exception:
                    pass
                raise
    entrantes = {(tope["formato"], tope["concepto"]) for tope in data["topes"]}
    item = {
        "anio": data["anio"],
        "creados": len(entrantes - existentes),
        "actualizados": len(entrantes & existentes),
        "retirados": 0,
        "dryRun": dry_run,
        "advertencia": (
            "CONMAG2 no tiene columna de año: el tope se guarda en MONTO y rige la "
            "próxima generación. El legado no conserva el histórico de topes por año."
        ),
    }
    if not dry_run:
        _audit(item, user, "CONMAG2", "topes", "reemplazo de topes")
    return item


# ---------------------------------------------------------------------------
# Rama Advantage: operaciones sin representación honesta
# ---------------------------------------------------------------------------
def acumular_iva(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
    """Recálculo de IVA: declarado no implementado en el legado (1.2)."""
    raise TaxLegacyNotSupported(LEGACY_ACCUMULATION_MESSAGE)


def acumular_retencion(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
    """Recálculo de retenciones: declarado no implementado en el legado (1.5)."""
    raise TaxLegacyNotSupported(LEGACY_ACCUMULATION_MESSAGE)


def create_medio(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
    """Generación del medio: declarada no implementada en el legado (3.2)."""
    raise TaxLegacyNotSupported(LEGACY_MEDIA_MESSAGE)


def get_medio(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
    """Filas del medio: declaradas no implementadas en el legado (3.3)."""
    raise TaxLegacyNotSupported(LEGACY_MEDIA_MESSAGE)


def update_medio_fila(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
    """Ajuste de fila: declarado no implementado en el legado (3.4)."""
    raise TaxLegacyNotSupported(LEGACY_MEDIA_MESSAGE)


def get_medio_conciliacion(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
    """Cuadre del medio: declarado no implementado en el legado (3.5)."""
    raise TaxLegacyNotSupported(LEGACY_MEDIA_MESSAGE)


def export_medio(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
    """Exportación del medio: declarada no implementada en el legado (3.7)."""
    raise TaxLegacyNotSupported(LEGACY_MEDIA_MESSAGE)
