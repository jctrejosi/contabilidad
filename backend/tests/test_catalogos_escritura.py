"""Casos de aceptación del bloque B2: el alta de los tres catálogos compartidos.

Son pruebas unitarias puras, como `test_terceros_escritura.py`: no levantan base
de datos. Cubren el contrato de la capa HTTP (Pydantic y registro de rutas) y los
caminos de validación/normalización de los dos motores que se resuelven **antes**
de abrir la conexión. La ejecución real de un `201` contra Advantage o PostgreSQL
requiere un motor disponible y queda fuera de esta suite.
"""

from decimal import Decimal

import pytest
from pydantic import ValidationError

from backend import (
    centros_repository,
    comprobantes_repository,
    postgres_writes,
    store,
    tipos_documento_repository,
)
from backend.app import (
    CostCenterCreate,
    DocumentTypeCreate,
    VoucherCreate,
    app,
)
from backend.centros_repository import (
    CostCenterValidationError,
    cost_center_item,
    normalize_cost_center,
)
from backend.comprobantes_repository import (
    VoucherValidationError,
    normalize_voucher,
    voucher_item,
)
from backend.tipos_documento_repository import (
    DocumentTypeValidationError,
    document_type_item,
    normalize_document_type,
)

CENTRO = {"codigo": "COM", "nombre": "Comercial"}
COMPROBANTE = {"codigo": "CE", "nombre": "Comprobante de egreso"}
TIPO = {"codigo": "NC", "nombre": "Nota crédito"}


def _routes() -> set[tuple[str, str]]:
    return {
        (route.path, method)
        for route in app.routes
        for method in (getattr(route, "methods", None) or [])
    }


# ---------------------------------------------------------------------------
# Registro de rutas (R1, R9)
# ---------------------------------------------------------------------------
def test_b2_routes_are_registered_with_the_planned_methods() -> None:
    routes = _routes()
    assert ("/api/centros", "POST") in routes
    assert ("/api/comprobantes", "POST") in routes
    assert ("/api/tipos-documento", "POST") in routes
    # R2: los GET existentes siguen ahí con su mismo método.
    assert ("/api/centros", "GET") in routes
    assert ("/api/comprobantes", "GET") in routes
    assert ("/api/tipos-documento", "GET") in routes


# ---------------------------------------------------------------------------
# B2.1 POST /api/centros
# ---------------------------------------------------------------------------
def test_cost_center_model_accepts_the_declared_contract() -> None:
    payload = CostCenterCreate(**CENTRO, centroPadre="CO", valor="10.50", porcentaje="0.5")
    assert payload.codigo == "COM"
    assert payload.centroPadre == "CO"
    assert payload.valor == Decimal("10.50")
    assert payload.tipo == 0


def test_cost_center_model_rejects_empty_code_and_name() -> None:
    with pytest.raises(ValidationError):
        CostCenterCreate(codigo="", nombre="Comercial")
    with pytest.raises(ValidationError):
        CostCenterCreate(codigo="COM", nombre="")


def test_cost_center_model_rejects_unknown_and_wide_values() -> None:
    with pytest.raises(ValidationError) as error:
        CostCenterCreate(**CENTRO, campoFuturo="x")
    assert error.value.errors()[0]["type"] == "extra_forbidden"
    with pytest.raises(ValidationError):
        CostCenterCreate(codigo="COMERCIAL", nombre="Comercial")  # 9 > 7
    with pytest.raises(ValidationError):
        CostCenterCreate(**CENTRO, valor=-1)
    with pytest.raises(ValidationError):
        CostCenterCreate(**CENTRO, cuenta="AB12")  # solo dígitos


def test_cost_center_normalize_validates_before_connecting() -> None:
    data = normalize_cost_center({**CENTRO, "cuenta": "110505"})
    assert (data["codigo"], data["cuenta"]) == ("COM", "110505")
    with pytest.raises(CostCenterValidationError, match="nombre"):
        normalize_cost_center({"codigo": "COM"})
    with pytest.raises(CostCenterValidationError, match="padre"):
        normalize_cost_center({**CENTRO, "centroPadre": "COM"})
    with pytest.raises(CostCenterValidationError, match="12 dígitos"):
        normalize_cost_center({**CENTRO, "cuenta": "ABC"})


def test_ads_cost_center_rejects_invalid_payload_before_connection() -> None:
    from backend.centros_repository import create_cost_center

    with pytest.raises(CostCenterValidationError, match="obligatorio"):
        create_cost_center("27", {"codigo": "COM"})


def test_pg_cost_center_rejects_invalid_payload_before_connection() -> None:
    with pytest.raises(CostCenterValidationError, match="obligatorio"):
        postgres_writes.create_cost_center("27", {"codigo": "COM"})


def test_cost_center_item_echoes_the_request_and_the_effective_parent() -> None:
    data = normalize_cost_center({**CENTRO, "centroPadre": "CO"})
    item = cost_center_item(data, "CO")
    assert item["centroPadre"] == "CO"
    assert item["nivel"] == 2
    assert set(cost_center_item(data, "")) >= {"codigo", "nombre", "centroPadre"}


# ---------------------------------------------------------------------------
# B2.2 POST /api/comprobantes
# ---------------------------------------------------------------------------
def test_voucher_model_accepts_the_declared_contract() -> None:
    payload = VoucherCreate(**COMPROBANTE, descripcionAuxiliar="Egresos")
    assert payload.codigo == "CE"
    assert payload.descripcionAuxiliar == "Egresos"


def test_voucher_model_rejects_empty_code_and_wide_code() -> None:
    with pytest.raises(ValidationError):
        VoucherCreate(codigo="", nombre="Comprobante")
    with pytest.raises(ValidationError):
        VoucherCreate(codigo="CEX", nombre="Comprobante")  # 3 > 2
    with pytest.raises(ValidationError) as error:
        VoucherCreate(**COMPROBANTE, otra="x")
    assert error.value.errors()[0]["type"] == "extra_forbidden"


def test_voucher_normalize_validates_before_connecting() -> None:
    assert normalize_voucher(COMPROBANTE)["codigo"] == "CE"
    with pytest.raises(VoucherValidationError, match="obligatorio"):
        normalize_voucher({"codigo": "CE"})
    with pytest.raises(VoucherValidationError, match="2 letras"):
        normalize_voucher({"codigo": "CEX", "nombre": "Comprobante"})


def test_ads_voucher_rejects_empty_code_before_connection() -> None:
    from backend.comprobantes_repository import create_voucher

    with pytest.raises(VoucherValidationError, match="entre 1 y 2"):
        create_voucher("27", {"codigo": "", "nombre": "Comprobante"})


def test_pg_voucher_rejects_empty_code_before_connection() -> None:
    with pytest.raises(VoucherValidationError, match="entre 1 y 2"):
        postgres_writes.create_voucher("27", {"codigo": "", "nombre": "Comprobante"})


def test_voucher_item_is_the_write_contract() -> None:
    assert voucher_item(normalize_voucher(COMPROBANTE)) == {
        "codigo": "CE",
        "nombre": "Comprobante de egreso",
        "descripcionAuxiliar": "",
    }


# ---------------------------------------------------------------------------
# B2.3 POST /api/tipos-documento
# ---------------------------------------------------------------------------
def test_document_type_model_defaults_match_the_destination() -> None:
    payload = DocumentTypeCreate(**TIPO)
    assert payload.numeracion == "Manual"
    assert payload.terceroObligatorio is False
    assert payload.centroObligatorio is False
    assert payload.generaContabilizacion is True
    assert payload.permiteConversion is False


def test_document_type_model_rejects_empty_and_invalid_numeracion() -> None:
    with pytest.raises(ValidationError):
        DocumentTypeCreate(codigo="", nombre="Nota")
    with pytest.raises(ValidationError):
        DocumentTypeCreate(**TIPO, numeracion="Automatico")  # 'o', no 'a'
    with pytest.raises(ValidationError) as error:
        DocumentTypeCreate(**TIPO, desconocido="x")
    assert error.value.errors()[0]["type"] == "extra_forbidden"


def test_document_type_normalize_validates_before_connecting() -> None:
    data = normalize_document_type({**TIPO, "numeracion": "Automatica", "comprobante": "CE"})
    assert (data["numeracion"], data["comprobante"]) == ("Automatica", "CE")
    with pytest.raises(DocumentTypeValidationError, match="obligatorio"):
        normalize_document_type({"codigo": "NC"})
    with pytest.raises(DocumentTypeValidationError, match="Manual"):
        normalize_document_type({**TIPO, "numeracion": "Mixta"})
    with pytest.raises(DocumentTypeValidationError, match="comprobante"):
        normalize_document_type({**TIPO, "comprobante": "CEE"})


def test_ads_document_type_rejects_global_only_fields_before_connection() -> None:
    from backend.tipos_documento_repository import create_document_type

    with pytest.raises(DocumentTypeValidationError, match="VISDOCUM"):
        create_document_type("27", {**TIPO, "terceroObligatorio": True})
    with pytest.raises(DocumentTypeValidationError, match="obligatorio"):
        create_document_type("27", {"codigo": "NC"})


def test_pg_document_type_rejects_invalid_numeracion_before_connection() -> None:
    with pytest.raises(DocumentTypeValidationError, match="Manual"):
        postgres_writes.create_document_type("27", {**TIPO, "numeracion": "Mixta"})


def test_document_type_item_is_the_write_contract() -> None:
    item = document_type_item(normalize_document_type({**TIPO, "comprobante": "CE"}))
    assert item["codigo"] == "NC"
    assert item["numeracion"] == "Manual"
    assert item["comprobante"] == "CE"


# ---------------------------------------------------------------------------
# R10: diferencia global / por compañía declarada en el contrato
# ---------------------------------------------------------------------------
def test_store_dispatch_resolves_each_catalog_in_both_engines(monkeypatch) -> None:
    llamadas: list[str] = []

    def _make(engine: str):
        def _implementation(company_code, payload, *, user="WEB"):
            llamadas.append(f"{engine}:{payload['codigo']}")
            return {"codigo": payload["codigo"]}

        return _implementation

    monkeypatch.setattr(centros_repository, "create_cost_center", _make("ads-centros"))
    monkeypatch.setattr(postgres_writes, "create_cost_center", _make("pg-centros"))
    monkeypatch.setattr(comprobantes_repository, "create_voucher", _make("ads-comprobantes"))
    monkeypatch.setattr(postgres_writes, "create_voucher", _make("pg-comprobantes"))
    monkeypatch.setattr(tipos_documento_repository, "create_document_type", _make("ads-tipos"))
    monkeypatch.setattr(postgres_writes, "create_document_type", _make("pg-tipos"))

    monkeypatch.setattr(store, "is_postgres", lambda: False)
    store.create_cost_center("27", {"codigo": "COM"})
    store.create_voucher("27", {"codigo": "CE"})
    store.create_document_type("27", {"codigo": "NC"})
    monkeypatch.setattr(store, "is_postgres", lambda: True)
    store.create_cost_center("27", {"codigo": "COM"})
    store.create_voucher("27", {"codigo": "CE"})
    store.create_document_type("27", {"codigo": "NC"})

    assert llamadas == [
        "ads-centros:COM",
        "ads-comprobantes:CE",
        "ads-tipos:NC",
        "pg-centros:COM",
        "pg-comprobantes:CE",
        "pg-tipos:NC",
    ]


def test_document_type_endpoint_declares_the_engine_difference(monkeypatch) -> None:
    from backend.app import create_document_type_endpoint

    monkeypatch.setattr(
        store, "create_document_type", lambda *a, **k: {"codigo": "NC"}, raising=True
    )
    payload = DocumentTypeCreate(**TIPO)
    monkeypatch.setattr(store, "is_postgres", lambda: False)
    respuesta_ads = create_document_type_endpoint(payload, cia="027", usuario="WEB")
    assert respuesta_ads["sharedAcrossCompanies"] is True
    monkeypatch.setattr(store, "is_postgres", lambda: True)
    respuesta_pg = create_document_type_endpoint(payload, cia="027", usuario="WEB")
    assert respuesta_pg["sharedAcrossCompanies"] is False
    assert respuesta_ads["source"] == respuesta_pg["source"] == "VISDOCUM"


# ---------------------------------------------------------------------------
# R2: los GET existentes no cambian de forma
# ---------------------------------------------------------------------------
def test_existing_catalog_reads_keep_their_keys() -> None:
    from backend.centros_repository import _cost_centers_from_rows
    from backend.comprobantes_repository import _voucher_from_row

    centro = _cost_centers_from_rows([{"CODIGO": "01", "NOMBRE": "Adm", "TIPO": 0}])[0]
    assert set(centro) == {
        "codigo", "nombre", "nivel", "padre", "carpeta", "tipo", "habilita",
        "hist", "valor", "porcentaje", "valorPorcentaje", "codigoItem", "cuenta",
        "concepto",
    }
    comprobante = _voucher_from_row({"CODIGO": "CE", "NOMBRE": "Egreso", "HIST": "S", "CTABDES": "E"})
    assert set(comprobante) == {"codigo", "nombre", "hist", "historico", "descripcionAuxiliar"}
