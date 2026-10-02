"""Casos de aceptación del bloque D1: las veinte rutas del módulo de Impuestos.

Son pruebas unitarias puras, como `test_configuracion_escritura.py`: **no levantan
base de datos**. Cubren:

- el registro de las veinte rutas (R9) con su método;
- el contrato Pydantic de cada cuerpo y sus casos inválidos (R6);
- los caminos de validación que se resuelven **antes** de abrir la conexión;
- el despacho de `store` por operación (R1);
- las diferencias declaradas entre motores (R10): la rama Advantage que no tiene
  representación honesta responde 503 declarado, no un error genérico;
- el mapeo de las excepciones de dominio nuevas en `_service_error` (R5).

La ejecución real de un 201/200 contra Advantage o PostgreSQL queda fuera de esta
suite: requiere un motor disponible.
"""

from decimal import Decimal

import pytest
from pydantic import ValidationError

from backend import impuestos_repository, store
from backend import app as app_module
from backend.app import (
    AccumulationRequest,
    ExogenousFormatCreate,
    ExogenousFormatUpdate,
    FormatAssignmentList,
    FormatConceptList,
    FormatConceptWrite,
    FormatCopyRequest,
    MediumCapList,
    MediumCapWrite,
    MediumGenerationRequest,
    MediumRowWrite,
    app,
)
from backend.impuestos_repository import (
    AccumulationConflict,
    AccumulationValidationError,
    MediumConflict,
    MediumValidationError,
    TaxFormatAlreadyExists,
    TaxFormatConflict,
    TaxFormatNotFound,
    TaxFormatValidationError,
    TaxLegacyNotSupported,
    build_acumulado_export,
    build_medio_export,
    normalize_accumulation,
    normalize_format,
    normalize_format_asignaciones,
    normalize_format_conceptos,
    normalize_format_copy,
    normalize_medium_generation,
    normalize_medium_row,
    normalize_medium_topes,
    periodo_de_mes,
)

RUTAS_ESPERADAS: set[tuple[str, str]] = {
    ("/api/impuestos/acumulados-iva", "GET"),
    ("/api/impuestos/acumulados-iva/acumular", "POST"),
    ("/api/impuestos/acumulados-iva/exportar", "GET"),
    ("/api/impuestos/acumulados-retenciones", "GET"),
    ("/api/impuestos/acumulados-retenciones/acumular", "POST"),
    ("/api/impuestos/acumulados-retenciones/exportar", "GET"),
    ("/api/impuestos/formatos", "GET"),
    ("/api/impuestos/formatos", "POST"),
    ("/api/impuestos/formatos/{codigo}", "PUT"),
    ("/api/impuestos/formatos/{codigo}", "DELETE"),
    ("/api/impuestos/formatos/{codigo}/conceptos", "PUT"),
    ("/api/impuestos/formatos/{codigo}/asignaciones", "PUT"),
    ("/api/impuestos/formatos/copiar", "POST"),
    ("/api/impuestos/medios", "GET"),
    ("/api/impuestos/medios", "POST"),
    ("/api/impuestos/medios/{id}", "GET"),
    ("/api/impuestos/medios/{id}/filas/{fila_id}", "PUT"),
    ("/api/impuestos/medios/{id}/conciliacion", "GET"),
    ("/api/impuestos/topes", "PUT"),
    ("/api/impuestos/medios/{id}/exportar", "GET"),
}

FORMATO = {"codigo": "F1001", "nombre": "Pagos o abonos en cuenta", "vigencia": 2026, "activo": True}
CONCEPTO = {"codigo": "HON", "nombre": "Honorarios", "tarifa": "0.1", "cuenta": "236525"}
MOTIVO = "Recalculo del periodo para la declaracion"
COPIA = {
    "ciaOrigen": "002", "vigenciaOrigen": 2026, "vigenciaDestino": 2026,
    "usuario": "WEB", "motivo": MOTIVO,
}
GENERACION = {"anio": 2026, "vigencia": 2026, "usuario": "WEB", "motivo": MOTIVO}
TOPE = {"formato": "F1001", "concepto": "HON", "tope": "1800000"}


def _routes() -> set[tuple[str, str]]:
    return {
        (route.path, method)
        for route in app.routes
        for method in (getattr(route, "methods", None) or [])
    }


# ---------------------------------------------------------------------------
# Registro de rutas (R9)
# ---------------------------------------------------------------------------
def test_d1_registers_the_twenty_planned_routes_with_their_methods() -> None:
    rutas = _routes()
    for ruta, metodo in RUTAS_ESPERADAS:
        assert (ruta, metodo) in rutas
    assert len(RUTAS_ESPERADAS) == 20


def test_d1_registers_the_especiales_routes_once_implemented() -> None:
    # §4 (Especiales) se implementó en su propio bloque; aquí solo se verifica
    # que las rutas quedaron registradas con sus métodos.
    rutas = _routes()
    assert ("/api/especiales/cuentas-en-cero", "GET") in rutas
    assert ("/api/especiales/cuentas-en-cero/eliminar", "POST") in rutas


# ---------------------------------------------------------------------------
# Despacho por operación en store (R1)
# ---------------------------------------------------------------------------
def test_store_dispatches_every_d1_operation() -> None:
    for nombre in (
        "list_acumulados_iva", "acumular_iva",
        "list_acumulados_retencion", "acumular_retencion",
        "list_impuestos_formatos", "create_formato", "update_formato", "delete_formato",
        "replace_formato_conceptos", "replace_formato_asignaciones", "copy_formatos",
        "list_medios", "create_medio", "get_medio", "update_medio_fila",
        "get_medio_conciliacion", "replace_topes", "export_medio",
    ):
        assert callable(getattr(store, nombre))


# ---------------------------------------------------------------------------
# Mapeo de errores de dominio nuevos (R5)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "excepcion, codigo",
    [
        (TaxFormatAlreadyExists("dup"), 409),
        (TaxFormatConflict("conf"), 409),
        (MediumConflict("conf"), 409),
        (AccumulationConflict("conf"), 409),
        (TaxFormatNotFound("no"), 404),
        (impuestos_repository.MediumNotFound("no"), 404),
        (TaxFormatValidationError("invalido"), 422),
        (MediumValidationError("invalido"), 422),
        (AccumulationValidationError("invalido"), 422),
        (TaxLegacyNotSupported("rama declarada"), 503),
    ],
)
def test_service_error_maps_the_new_domain_exceptions(excepcion: Exception, codigo: int) -> None:
    assert app_module._service_error(excepcion).status_code == codigo


# ---------------------------------------------------------------------------
# 1. Acumulados: modelos y validaciones previas a la conexión
# ---------------------------------------------------------------------------
def test_accumulation_model_accepts_the_declared_contract() -> None:
    payload = AccumulationRequest(
        anio=2026, mesDesde=1, mesHasta=2, usuario="JPG", motivo=MOTIVO
    )
    assert (payload.mesDesde, payload.mesHasta) == (1, 2)


def test_accumulation_model_rejects_inverted_range_and_short_reason() -> None:
    with pytest.raises(ValidationError):
        AccumulationRequest(anio=2026, mesDesde=3, mesHasta=1, motivo=MOTIVO)
    with pytest.raises(ValidationError):
        AccumulationRequest(anio=2026, mesDesde=1, mesHasta=2, motivo="ab")


def test_accumulation_model_forbids_unknown_keys() -> None:
    with pytest.raises(ValidationError) as error:
        AccumulationRequest(anio=2026, mesDesde=1, mesHasta=2, motivo=MOTIVO, extra=1)
    assert error.value.errors()[0]["type"] == "extra_forbidden"


def test_normalize_accumulation_validates_before_connecting() -> None:
    data = normalize_accumulation(
        {"anio": 2026, "mesDesde": 2, "mesHasta": 4, "motivo": MOTIVO}
    )
    assert (data["anio"], data["mesDesde"], data["mesHasta"]) == (2026, 2, 4)
    with pytest.raises(AccumulationValidationError, match="mayor"):
        normalize_accumulation({"anio": 2026, "mesDesde": 4, "mesHasta": 2, "motivo": MOTIVO})
    with pytest.raises(AccumulationValidationError):
        normalize_accumulation({"anio": 2026, "mesDesde": 1, "mesHasta": 2, "motivo": "x"})
    with pytest.raises(AccumulationValidationError):
        normalize_accumulation({"anio": 1800, "mesDesde": 1, "mesHasta": 2, "motivo": MOTIVO})


def test_periodo_from_month_is_zero_padded() -> None:
    assert periodo_de_mes(2) == "02"
    assert periodo_de_mes(12) == "12"


def test_ads_accumulation_is_a_declared_unsupported_branch() -> None:
    # El legado no puede reconstruir un acumulado fiscal (matriz P16/P17).
    with pytest.raises(TaxLegacyNotSupported, match="Advantage"):
        impuestos_repository.acumular_iva("27", {})
    with pytest.raises(TaxLegacyNotSupported, match="Advantage"):
        impuestos_repository.acumular_retencion("27", {})


# ---------------------------------------------------------------------------
# 2. Formatos, conceptos y asignaciones
# ---------------------------------------------------------------------------
def test_format_model_accepts_and_rejects_the_declared_contract() -> None:
    creado = ExogenousFormatCreate(**FORMATO)
    assert creado.codigo == "F1001"
    with pytest.raises(ValidationError):
        ExogenousFormatCreate(codigo="F1001", nombre="x")  # sin vigencia
    with pytest.raises(ValidationError):
        ExogenousFormatCreate(**{**FORMATO, "codigo": "con guion"})
    with pytest.raises(ValidationError):
        ExogenousFormatCreate(**{**FORMATO, "vigencia": 1800})
    actualizado = ExogenousFormatUpdate(nombre="Nuevo nombre")
    assert actualizado.vigencia is None


def test_normalize_format_validates_before_connecting() -> None:
    data = normalize_format(FORMATO, include_codigo=True)
    assert (data["codigo"], data["vigencia"], data["activo"]) == ("F1001", 2026, True)
    with pytest.raises(TaxFormatValidationError, match="vigencia"):
        normalize_format({"codigo": "F1", "nombre": "x"}, include_codigo=True)
    with pytest.raises(TaxFormatValidationError, match="nombre"):
        normalize_format({"codigo": "F1", "vigencia": 2026}, include_codigo=True)


def test_concept_list_rejects_duplicates_and_tariff_above_one() -> None:
    ok = normalize_format_conceptos({"conceptos": [CONCEPTO], "motivo": MOTIVO})
    assert ok["conceptos"][0]["tarifa"] == Decimal("0.1")
    with pytest.raises(TaxFormatValidationError, match="repetido"):
        normalize_format_conceptos({"conceptos": [CONCEPTO, CONCEPTO], "motivo": MOTIVO})
    with pytest.raises(TaxFormatValidationError, match="fracción"):
        normalize_format_conceptos(
            {"conceptos": [{**CONCEPTO, "tarifa": "10"}], "motivo": MOTIVO}
        )
    vacio = normalize_format_conceptos({"conceptos": [], "motivo": MOTIVO})
    assert vacio["conceptos"] == []


def test_format_concept_write_model_caps_the_fraction() -> None:
    assert FormatConceptWrite(**CONCEPTO).tarifa == Decimal("0.1")
    with pytest.raises(ValidationError):
        FormatConceptWrite(**{**CONCEPTO, "tarifa": "19"})


def test_concept_list_model_requires_reason() -> None:
    assert FormatConceptList(conceptos=[CONCEPTO], motivo=MOTIVO).conceptos
    with pytest.raises(ValidationError):
        FormatConceptList(conceptos=[CONCEPTO], motivo="x")


def test_assignment_list_rejects_duplicates_and_bad_codes() -> None:
    data = normalize_format_asignaciones({"cuentas": ["110505", "236525"], "motivo": MOTIVO})
    assert data["cuentas"] == ["110505", "236525"]
    with pytest.raises(TaxFormatValidationError, match="repetida"):
        normalize_format_asignaciones({"cuentas": ["110505", "110505"], "motivo": MOTIVO})
    with pytest.raises(TaxFormatValidationError, match="dígitos"):
        normalize_format_asignaciones({"cuentas": ["AB12"], "motivo": MOTIVO})
    vacio = normalize_format_asignaciones({"cuentas": [], "motivo": MOTIVO})
    assert vacio["cuentas"] == []
    assert FormatAssignmentList(cuentas=[], motivo=MOTIVO).cuentas == []


def test_copy_request_rejects_same_origin_and_destination() -> None:
    data = normalize_format_copy(COPIA, cia_destino="001")
    assert data["ciaOrigen"] == "002"
    with pytest.raises(TaxFormatValidationError, match="distinta"):
        normalize_format_copy({**COPIA, "ciaOrigen": "001"}, cia_destino="001")
    with pytest.raises(ValidationError):
        FormatCopyRequest(**{**COPIA, "ciaOrigen": "00A"})


def test_copy_is_a_declared_unsupported_branch_in_advantage() -> None:
    with pytest.raises(TaxLegacyNotSupported, match="compañía"):
        impuestos_repository.copy_formatos("001", COPIA)


def test_ads_writes_reject_fields_the_legacy_cannot_represent() -> None:
    # CONMAG1 no tiene vigencia: el código de 4 posiciones se declara.
    with pytest.raises(TaxFormatValidationError, match="4 caracteres"):
        impuestos_repository.create_formato("27", {**FORMATO, "codigo": "F10010"})
    # CONMAG2 no tiene cuenta por concepto.
    with pytest.raises(TaxFormatValidationError, match="cuenta"):
        impuestos_repository.replace_formato_conceptos(
            "27", "F100", 2026,
            {"conceptos": [CONCEPTO], "motivo": MOTIVO},
        )


# ---------------------------------------------------------------------------
# 3. Medios magnéticos
# ---------------------------------------------------------------------------
def test_medium_generation_model_and_normalizer() -> None:
    assert MediumGenerationRequest(**GENERACION).vigencia == 2026
    with pytest.raises(ValidationError):
        MediumGenerationRequest(**{**GENERACION, "anio": 1800})
    data = normalize_medium_generation(GENERACION)
    assert (data["anio"], data["formatos"]) == (2026, None)


def test_medium_row_model_and_normalizer() -> None:
    assert MediumRowWrite(valor="1400000", motivo=MOTIVO).valor == Decimal("1400000")
    with pytest.raises(ValidationError):
        MediumRowWrite(valor="-1", motivo=MOTIVO)
    with pytest.raises(ValidationError):
        MediumRowWrite(valor="1", motivo="x")
    data = normalize_medium_row({"valor": "1400000", "motivo": MOTIVO})
    assert data["valor"] == Decimal("1400000")
    with pytest.raises(MediumValidationError, match="negativo"):
        normalize_medium_row({"valor": "-1", "motivo": MOTIVO})
    with pytest.raises(MediumValidationError, match="al menos"):
        normalize_medium_row({"motivo": MOTIVO})


def test_medium_top_list_model_and_normalizer() -> None:
    assert MediumCapWrite(**TOPE).tope == Decimal("1800000")
    with pytest.raises(ValidationError):
        MediumCapWrite(**{**TOPE, "tope": "-1"})
    data = normalize_medium_topes({"anio": 2026, "topes": [TOPE], "motivo": MOTIVO})
    assert data["topes"][0]["tope"] == Decimal("1800000")
    with pytest.raises(MediumValidationError, match="repetido"):
        normalize_medium_topes({"anio": 2026, "topes": [TOPE, TOPE], "motivo": MOTIVO})
    with pytest.raises(MediumValidationError, match="negativo"):
        normalize_medium_topes(
            {"anio": 2026, "topes": [{**TOPE, "tope": "-1"}], "motivo": MOTIVO}
        )
    vacio = normalize_medium_topes({"anio": 2026, "topes": [], "motivo": MOTIVO})
    assert vacio["topes"] == []
    assert MediumCapList(anio=2026, topes=[], motivo=MOTIVO).topes == []


def test_medium_operations_are_a_declared_unsupported_branch_in_advantage() -> None:
    for funcion in (
        impuestos_repository.create_medio,
        impuestos_repository.get_medio,
        impuestos_repository.update_medio_fila,
        impuestos_repository.get_medio_conciliacion,
        impuestos_repository.export_medio,
    ):
        with pytest.raises(TaxLegacyNotSupported, match="CONMAGDT"):
            funcion("27")


# ---------------------------------------------------------------------------
# R10 · diferencias declaradas y exportación
# ---------------------------------------------------------------------------
def test_ads_reads_declare_their_gaps() -> None:
    # Sin motor no se puede leer; el contrato se comprueba por los normalizadores
    # de salida, que aquí no aplican. Se comprueba el mensaje declarado de medios.
    assert "CONMAGDT" in impuestos_repository.LEGACY_MEDIA_MESSAGE
    assert "TINCON" in impuestos_repository.LEGACY_ACCUMULATION_MESSAGE


def test_accumulated_export_reuses_the_informe_exporter() -> None:
    content = build_acumulado_export(
        titulo="Acumulado de IVA 2026",
        headers=["NIT", "Periodo", "Base"],
        rows=[["800100200", "02", 15000000.0]],
        cia="001", anio=2026, mes_desde=2, mes_hasta=2,
        source="acumulados_iva", formato="csv",
    )
    assert isinstance(content, bytes) and b"NIT" in content
    xlsx = build_acumulado_export(
        titulo="Acumulado de IVA 2026", headers=["NIT"], rows=[],
        cia="001", anio=2026, mes_desde=2, mes_hasta=2,
        source="acumulados_iva", formato="xlsx",
    )
    assert isinstance(xlsx, bytes) and xlsx[:2] == b"PK"


def test_medium_export_writes_xml_csv_and_xlsx() -> None:
    medio = {"anio": 2026, "numeroGeneracion": 2, "estado": "Exportado"}
    filas = [{
        "formato": "F1001", "nit": "800100200", "nombre": "Empresa",
        "concepto": "HON", "cuenta": "236525", "base": 15000000.0,
        "tarifa": 0.1, "valor": 1500000.0, "ajustado": False,
    }]
    xml = build_medio_export(medio, filas, "xml")
    assert b"<medio" in xml and b"F1001" in xml
    csv_bytes = build_medio_export(medio, filas, "csv")
    assert b"formato" in csv_bytes
    xlsx = build_medio_export(medio, [], "xlsx")
    assert xlsx[:2] == b"PK"
