"""Casos de aceptación del bloque B3, parte 1: compañías y los tres catálogos.

Son pruebas unitarias puras, como `test_catalogos_escritura.py`: **no levantan
base de datos**. Cubren:

- el registro de las dieciséis rutas (R9) con su método;
- el contrato Pydantic de cada cuerpo y sus casos inválidos (R6);
- los caminos de validación que se resuelven **antes** de abrir la conexión, en
  los dos motores;
- el despacho de `store` por operación (R1);
- la diferencia global/por-compañía declarada en la respuesta (R10);
- la estabilidad de las claves de `GET /api/companias` tras la extensión
  aditiva y el respaldo `ADS_DEV_FALLBACK` (R2).

Las lecturas de PostgreSQL se ejercitan con un cursor guionado, de modo que el
mapeo de filas → contrato JSON queda cubierto sin motor. La ejecución real de un
201 contra Advantage o PostgreSQL queda fuera de esta suite.
"""

from decimal import Decimal
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from backend import (
    companias_repository,
    conceptos_retencion_repository,
    postgres_repository,
    postgres_writes,
    renglones_renta_repository,
    store,
    tarifas_iva_repository,
)
from backend import app as app_module
from backend.app import (
    CompanyCreate,
    CompanyWrite,
    IncomeLineCreate,
    IncomeLineWrite,
    RetentionConceptCreate,
    RetentionConceptWrite,
    VatRateCreate,
    VatRateWrite,
    app,
    create_company_endpoint,
    delete_company_endpoint,
    update_company_endpoint,
)
from backend.companias_repository import (
    CompanyAlreadyExists,
    CompanyConflict,
    CompanyValidationError,
    CompanyWriteNotImplemented,
    LEGACY_BRANCH_MESSAGE,
    company_item,
    normalize_company_code,
    normalize_company_create,
    normalize_company_write,
    validate_company_reason,
)
from backend.conceptos_retencion_repository import (
    RetentionConceptAlreadyExists,
    RetentionConceptConflict,
    RetentionConceptNotFound,
    RetentionConceptValidationError,
    _retention_concept_from_row,
    normalize_retention_concept,
)
from backend.renglones_renta_repository import (
    IncomeLineAlreadyExists,
    IncomeLineConflict,
    IncomeLineNotFound,
    IncomeLineValidationError,
    _income_line_from_row,
    normalize_income_line,
)
from backend.tarifas_iva_repository import (
    VatRateAlreadyExists,
    VatRateConflict,
    VatRateNotFound,
    VatRateValidationError,
    _legacy_fraction,
    _legacy_percent,
    _vat_rate_from_row,
    normalize_vat_rate,
)


IVA_ESCRITURA = {"nombre": "IVA 5%", "tarifa": "0.05", "cuenta": "240805"}
IVA_SIN_CUENTA = {"nombre": "IVA 5%", "tarifa": "0.05"}
CONCEPTO_ESCRITURA = {"nombre": "Honorarios", "tarifa": "0.1", "cuenta": "236525", "baseMinima": "0"}
RENGLON_ESCRITURA = {"nombre": "Ingresos brutos", "cuenta": "410505", "signo": 1}
COMPANIA_ESCRITURA = {"nombre": "Filial S.A.S.", "nit": "900123456", "digito": "7"}


def _routes() -> set[tuple[str, str]]:
    return {
        (route.path, method)
        for route in app.routes
        for method in (getattr(route, "methods", None) or [])
    }


class _ScriptedCursor:
    """Cursor mínimo que devuelve una respuesta guionada por cada ``execute``."""

    def __init__(self, responses: list[tuple[list[str], list[tuple]]]) -> None:
        self._responses = list(responses)
        self.description: list[SimpleNamespace] = []
        self._current: tuple[list[str], list[tuple]] = ([], [])

    def execute(self, sql: str, params: object = None) -> None:
        self._current = self._responses.pop(0)
        self.description = [SimpleNamespace(name=name) for name in self._current[0]]

    def fetchall(self) -> list[tuple]:
        return list(self._current[1])

    def fetchone(self) -> tuple | None:
        return self._current[1][0] if self._current[1] else None

    def __enter__(self) -> "_ScriptedCursor":
        return self

    def __exit__(self, *exc: object) -> bool:
        return False


class _ScriptedConnection:
    def __init__(self, cursor: _ScriptedCursor) -> None:
        self._cursor = cursor

    def cursor(self) -> _ScriptedCursor:
        return self._cursor

    def __enter__(self) -> "_ScriptedConnection":
        return self

    def __exit__(self, *exc: object) -> bool:
        return False


def _postgres_script(monkeypatch, responses: list[tuple[list[str], list[tuple]]]) -> None:
    """Hace que ``_connect()`` de PostgreSQL devuelva el cursor guionado."""
    cursor = _ScriptedCursor(responses)
    monkeypatch.setattr(
        postgres_repository, "_connect", lambda: _ScriptedConnection(cursor)
    )


# ---------------------------------------------------------------------------
# Registro de rutas (R1, R9)
# ---------------------------------------------------------------------------
def test_b3_routes_are_registered_with_the_planned_methods() -> None:
    routes = _routes()
    for path in ("/api/tarifas-iva", "/api/conceptos-retencion", "/api/renglones-renta"):
        assert (path, "GET") in routes
        assert (path, "POST") in routes
        assert (f"{path}/{{codigo}}", "PUT") in routes
        assert (f"{path}/{{codigo}}", "DELETE") in routes
    assert ("/api/companias", "POST") in routes
    assert ("/api/companias/{codigo}", "PUT") in routes
    assert ("/api/companias/{codigo}", "DELETE") in routes
    # R2: el GET de compañías sigue ahí con su mismo método.
    assert ("/api/companias", "GET") in routes


def test_new_routes_are_lower_case_with_hyphens() -> None:
    for path, _method in _routes():
        assert path == path.lower(), path


# ---------------------------------------------------------------------------
# H4.1 GET /api/companias: extensión aditiva (R2) y respaldo de demostración
# ---------------------------------------------------------------------------
def test_ads_company_mapper_keeps_its_keys_and_adds_the_two_new_ones() -> None:
    from backend.ads_repository import _company_from_row

    item = _company_from_row({"EMPCOD": 27, "EMPNOM": "Filial", "EMPNIT": "900123456", "HABILITA": True})
    # Claves que ya consumía el selector de ingreso.
    assert {"codigo", "nombre", "nit", "habilitada"} <= set(item)
    # B3: CONEMP no tiene consolidación ni años; el contrato expone los dos en su
    # valor por defecto para que la forma no dependa del motor.
    assert item["soloConsolidacion"] is False
    assert item["anios"] == []


def test_postgres_company_mapper_adds_the_real_consolidation_and_years(monkeypatch) -> None:
    _postgres_script(
        monkeypatch,
        [
            (
                ["codigo", "nombre", "nit", "digito", "estado", "solo_consolidacion", "anios"],
                [
                    ("27", "Demo S.A.S.", "900123456", "7", "Activa", False, [2026, 2025]),
                    ("2", "Consolidadora", "800200300", "", "Inactiva", True, []),
                ],
            )
        ],
    )
    items = postgres_repository.list_companies()
    assert set(items[0]) == {
        "codigo", "nombre", "nit", "habilitada", "soloConsolidacion", "anios",
    }
    assert items[0]["codigo"] == "027"
    assert items[0]["nit"] == "900123456-7"
    assert items[0]["soloConsolidacion"] is False
    assert items[0]["anios"] == [2025, 2026]  # ordenados
    assert items[1]["habilitada"] is False
    assert items[1]["soloConsolidacion"] is True


def test_companies_endpoint_falls_back_to_demo_without_breaking_the_shape(monkeypatch) -> None:
    from backend.ads_repository import AdsConfigurationError

    def _explode() -> list[dict[str, object]]:
        raise AdsConfigurationError("sin ADS")

    monkeypatch.setattr(store, "list_companies", _explode)
    monkeypatch.setattr(store, "is_postgres", lambda: False)
    monkeypatch.setattr(app_module, "_dev_fallback_enabled", lambda: True)

    respuesta = app_module.companies()
    assert respuesta["source"] == "DEMO"
    assert respuesta["count"] == len(app_module.DEMO_COMPANIES)
    primera = respuesta["items"][0]
    assert {"codigo", "nombre", "nit", "habilitada"} <= set(primera)
    assert primera["soloConsolidacion"] is False and primera["anios"] == []


# ---------------------------------------------------------------------------
# H4.2 POST /api/companias
# ---------------------------------------------------------------------------
def test_company_create_model_requires_a_valid_code_and_year() -> None:
    payload = CompanyCreate(codigo="002", nombre="Filial S.A.S.", nit="900123456", digito="7", anio=2026)
    assert (payload.codigo, payload.anio, payload.soloConsolidacion) == ("002", 2026, False)
    with pytest.raises(ValidationError) as error:
        CompanyCreate(codigo="002", nombre="Filial S.A.S.", nit="900123456")  # sin anio
    assert "anio" in {item["loc"][0] for item in error.value.errors()}
    with pytest.raises(ValidationError):
        CompanyCreate(codigo="0002", nombre="Filial", nit="900123456", anio=2026)
    with pytest.raises(ValidationError):
        CompanyCreate(codigo="AB", nombre="Filial", nit="900123456", anio=2026)
    with pytest.raises(ValidationError):
        CompanyCreate(codigo="002", nombre="Filial", nit="900123456", anio=1800)
    with pytest.raises(ValidationError) as error:
        CompanyCreate(codigo="002", nombre="Filial", nit="9", anio=2026, campana="x")
    assert error.value.errors()[0]["type"] == "extra_forbidden"


def test_company_normalization_is_shared_by_the_two_engines() -> None:
    data = normalize_company_create(
        {"codigo": "027", "nombre": "Filial", "nit": "900123456", "digito": "7", "anio": "2026"}
    )
    assert data["codigo"] == "27"  # se guarda sin ceros, como el resto del modelo
    assert data["anio"] == 2026
    assert normalize_company_code("001") == "1"
    with pytest.raises(CompanyValidationError, match="3 dígitos"):
        normalize_company_code("0000")
    with pytest.raises(CompanyValidationError, match="dígito"):
        normalize_company_create(
            {"codigo": "2", "nombre": "F", "nit": "9", "digito": "77", "anio": 2026}
        )
    with pytest.raises(CompanyValidationError, match="nombre"):
        normalize_company_create({"codigo": "2", "nit": "9", "anio": 2026})
    with pytest.raises(CompanyValidationError, match="1900"):
        normalize_company_create({"codigo": "2", "nombre": "F", "nit": "9", "anio": 1899})


def test_company_item_declares_the_years_and_composes_the_nit() -> None:
    data = normalize_company_create(
        {"codigo": "2", "nombre": "Filial", "nit": "900123456", "digito": "7", "anio": 2026}
    )
    item = company_item(data, anios=[2027], estado="Activa")
    assert item == {
        "codigo": "002",
        "nombre": "Filial",
        "nit": "900123456-7",
        "digito": "7",
        "estado": "Activa",
        "soloConsolidacion": False,
        "anios": [2027],
    }


def test_company_update_and_delete_remain_unavailable_in_advantage(monkeypatch) -> None:
    # Solo la creación fue migrada; modificación y baja siguen pendientes.
    monkeypatch.setattr(store, "is_postgres", lambda: False)
    with pytest.raises(CompanyWriteNotImplemented):
        store.update_company("2", COMPANIA_ESCRITURA)
    with pytest.raises(CompanyWriteNotImplemented):
        store.delete_company("2", reason="sin movimiento")


def test_company_create_endpoint_delegates_to_postgres(monkeypatch) -> None:
    monkeypatch.setattr(store, "is_postgres", lambda: True)
    monkeypatch.setattr(
        store, "create_company", lambda payload, user="WEB": {"codigo": "002", "anios": [2026]}
    )
    payload = CompanyCreate(codigo="002", nombre="Filial S.A.S.", nit="900123456", anio=2026)
    assert create_company_endpoint(payload) == {
        "item": {"codigo": "002", "anios": [2026]},
        "source": "companias",
    }


# ---------------------------------------------------------------------------
# H4.3 PUT /api/companias/{codigo}
# ---------------------------------------------------------------------------
def test_company_write_model_rejects_an_empty_body_and_the_immutable_code() -> None:
    with pytest.raises(ValidationError) as error:
        CompanyWrite()
    assert "nombre" in {item["loc"][0] for item in error.value.errors()}
    with pytest.raises(ValidationError) as error:
        CompanyWrite(codigo="002", **COMPANIA_ESCRITURA)
    assert error.value.errors()[0]["type"] == "extra_forbidden"
    with pytest.raises(ValidationError):
        CompanyWrite(**COMPANIA_ESCRITURA, estado="Activo")


def test_company_update_normalization_validates_state_and_nit() -> None:
    data = normalize_company_write({**COMPANIA_ESCRITURA, "estado": "Inactiva"})
    assert (data["estado"], data["nit"]) == ("Inactiva", "900123456")
    with pytest.raises(CompanyValidationError, match="Activa o Inactiva"):
        normalize_company_write({**COMPANIA_ESCRITURA, "estado": "Suspendida"})
    with pytest.raises(CompanyValidationError, match="obligatorio"):
        normalize_company_write({"nit": "9"})


def test_company_update_endpoint_maps_not_found_and_conflict(monkeypatch) -> None:
    from backend.ads_repository import CompanyNotFound

    payload = CompanyWrite(**COMPANIA_ESCRITURA)
    monkeypatch.setattr(
        store, "update_company", lambda *a, **k: (_ for _ in ()).throw(CompanyNotFound("no está"))
    )
    with pytest.raises(app_module.HTTPException) as error:
        update_company_endpoint(payload, codigo="999")
    assert error.value.status_code == 404

    monkeypatch.setattr(
        store, "update_company", lambda *a, **k: (_ for _ in ()).throw(CompanyConflict("con documentos"))
    )
    with pytest.raises(app_module.HTTPException) as error:
        update_company_endpoint(payload, codigo="002")
    assert error.value.status_code == 409


# ---------------------------------------------------------------------------
# H4.4 DELETE /api/companias/{codigo}
# ---------------------------------------------------------------------------
def test_company_reason_is_required_between_five_and_180_characters() -> None:
    assert validate_company_reason("  baja sin movimiento ") == "baja sin movimiento"
    with pytest.raises(CompanyValidationError, match="entre 5 y 180"):
        validate_company_reason("baja")
    with pytest.raises(CompanyValidationError, match="entre 5 y 180"):
        validate_company_reason("x" * 181)


def test_company_delete_endpoint_is_204_and_reports_on_dry_run(monkeypatch) -> None:
    monkeypatch.setattr(
        store,
        "delete_company",
        lambda *a, **k: {"codigo": "002", "documentos": 0, "lotes": 0, "saldos": 0,
                         "bloqueada": False, "eliminada": k.get("dry_run", False) is False,
                         "bajaLogica": True},
    )
    ejecutada = delete_company_endpoint(
        response=SimpleNamespace(), codigo="002", motivo="sin movimiento", dry_run=False
    )
    assert isinstance(ejecutada, app_module.Response)
    assert ejecutada.status_code == 204

    dry = delete_company_endpoint(
        response=SimpleNamespace(), codigo="002", motivo="sin movimiento", dry_run=True
    )
    assert dry["dryRun"] is True
    assert dry["source"] == "companias"
    assert dry["item"]["documentos"] == 0


def test_company_delete_is_declared_as_logical_and_blocks_with_history(monkeypatch) -> None:
    # Con documentos, lotes o saldos la baja responde 409 (vía _service_error).
    monkeypatch.setattr(
        store,
        "delete_company",
        lambda *a, **k: (_ for _ in ()).throw(CompanyConflict("tiene 3 documento(s)")),
    )
    with pytest.raises(app_module.HTTPException) as error:
        delete_company_endpoint(response=SimpleNamespace(), codigo="002", motivo="sin movimiento")
    assert error.value.status_code == 409


# ---------------------------------------------------------------------------
# 2/3/4. Los tres catálogos de configuración
# ---------------------------------------------------------------------------
def test_vat_rate_model_rejects_a_percentage_and_a_negative_tariff() -> None:
    assert VatRateCreate(codigo="IV05", **IVA_ESCRITURA).tarifa == Decimal("0.05")
    with pytest.raises(ValidationError, match="less than or equal to 1"):
        VatRateCreate(codigo="IV19", nombre="IVA 19%", tarifa="19")  # el error típico
    with pytest.raises(ValidationError):
        VatRateCreate(codigo="IV05", nombre="IVA", tarifa="-0.05")
    with pytest.raises(ValidationError):
        VatRateCreate(codigo="", nombre="IVA", tarifa="0.05")
    with pytest.raises(ValidationError):
        VatRateCreate(codigo="IV05", **IVA_SIN_CUENTA, cuenta="ABC")
    with pytest.raises(ValidationError) as error:
        VatRateCreate(codigo="IV05", **IVA_ESCRITURA, extra="x")
    assert error.value.errors()[0]["type"] == "extra_forbidden"


def test_vat_rate_update_model_forbids_the_immutable_code() -> None:
    assert VatRateWrite(**IVA_ESCRITURA).cuenta == "240805"
    with pytest.raises(ValidationError) as error:
        VatRateWrite(codigo="IV05", **IVA_ESCRITURA)
    assert error.value.errors()[0]["type"] == "extra_forbidden"


def test_vat_rate_normalization_and_percentage_conversion() -> None:
    data = normalize_vat_rate({"codigo": "iv05", **IVA_ESCRITURA})
    assert (data["codigo"], data["tarifa"]) == ("IV05", Decimal("0.05"))
    with pytest.raises(VatRateValidationError, match="obligatorio"):
        normalize_vat_rate({"codigo": "IV05", "tarifa": "0.05"})
    with pytest.raises(VatRateValidationError, match="fracción"):
        normalize_vat_rate({"codigo": "IV05", "nombre": "IVA", "tarifa": "19"})
    # El legado guarda el porcentaje (VLRPOR): la conversión es explícita.
    assert _legacy_percent(Decimal("0.19")) == pytest.approx(19.0)
    assert _legacy_fraction(19.0) == pytest.approx(0.19)
    assert _legacy_fraction(5) == pytest.approx(0.05)


def test_vat_rate_row_maps_to_the_contract_without_inventing_a_cuenta() -> None:
    item = _vat_rate_from_row({"CODIGO": "IV19", "NOMBRE": "IVA 19%", "VLRPOR": 19.0})
    assert item == {"codigo": "IV19", "nombre": "IVA 19%", "tarifa": 0.19, "cuenta": "", "nombreCuenta": ""}


def test_catalog_write_items_echo_only_the_write_contract() -> None:
    from backend.conceptos_retencion_repository import retention_concept_item
    from backend.renglones_renta_repository import income_line_item
    from backend.tarifas_iva_repository import vat_rate_item

    assert set(vat_rate_item(normalize_vat_rate({"codigo": "IV05", **IVA_ESCRITURA}))) == {
        "codigo", "nombre", "tarifa", "cuenta",
    }
    assert set(retention_concept_item(normalize_retention_concept({"codigo": "HON", **CONCEPTO_ESCRITURA}))) == {
        "codigo", "nombre", "tarifa", "baseMinima", "cuenta",
    }
    assert set(income_line_item(normalize_income_line({"codigo": "R01", **RENGLON_ESCRITURA}))) == {
        "codigo", "nombre", "cuenta", "signo",
    }


def test_ads_vat_rate_rejects_what_contiiva_cannot_store_before_connecting() -> None:
    # La cuenta y el código largo no tienen columna/ancho en CONTIIVA (declarado).
    with pytest.raises(VatRateValidationError, match="CONTIIVA no tiene columna de cuenta"):
        tarifas_iva_repository.create_tarifa_iva("027", {"codigo": "IV", "nombre": "IVA", "tarifa": 0.19, "cuenta": "240805"})
    with pytest.raises(VatRateValidationError, match="máximo 2 caracteres"):
        tarifas_iva_repository.create_tarifa_iva("027", {"codigo": "IV19", "nombre": "IVA", "tarifa": 0.19})
    with pytest.raises(VatRateValidationError, match="obligatorio"):
        tarifas_iva_repository.create_tarifa_iva("027", {"codigo": "IV", "tarifa": 0.19})
    # La baja del legado no tiene ancho para un código largo ni motivo corto: ambas
    # validaciones ocurren antes de la conexión.
    with pytest.raises(VatRateValidationError, match="máximo 2 caracteres"):
        tarifas_iva_repository.delete_tarifa_iva("027", "IV19", reason="sin uso")
    with pytest.raises(CompanyValidationError, match="entre 5 y 180"):
        tarifas_iva_repository.delete_tarifa_iva("027", "IV", reason="x")


def test_pg_vat_rate_rejects_invalid_payload_before_connecting() -> None:
    with pytest.raises(VatRateValidationError, match="obligatorio"):
        postgres_writes.create_tarifa_iva("027", {"codigo": "IV05", "tarifa": 0.05})
    with pytest.raises(VatRateValidationError, match="fracción"):
        postgres_writes.update_tarifa_iva("027", "IV05", {"nombre": "IVA", "tarifa": 19, "cuenta": ""})
    with pytest.raises(CompanyValidationError, match="entre 5 y 180"):
        postgres_writes.delete_tarifa_iva("027", "IV05", reason="mal")


def test_postgres_vat_rate_listing_maps_cuenta_and_name(monkeypatch) -> None:
    _postgres_script(
        monkeypatch,
        [
            (["codigo"], [("27",)]),
            (["id"], [(5,)]),
            (
                ["CODIGO", "NOMBRE", "TARIFA", "CUENTA", "NOMBRE_CUENTA"],
                [("IV19", "IVA 19%", Decimal("0.190000"), "240805", "IVA por pagar")],
            ),
        ],
    )
    items = postgres_repository.list_tarifas_iva("027")
    assert items == [
        {"codigo": "IV19", "nombre": "IVA 19%", "tarifa": 0.19, "cuenta": "240805",
         "nombreCuenta": "IVA por pagar"}
    ]


def test_retention_concept_model_and_rules() -> None:
    payload = RetentionConceptCreate(codigo="HON", **CONCEPTO_ESCRITURA)
    assert payload.baseMinima == Decimal("0")
    with pytest.raises(ValidationError, match="greater than or equal to 0"):
        RetentionConceptCreate(codigo="HON", **{**CONCEPTO_ESCRITURA, "baseMinima": "-1"})
    with pytest.raises(ValidationError, match="less than or equal to 1"):
        RetentionConceptCreate(codigo="HON", **{**CONCEPTO_ESCRITURA, "tarifa": "1.5"})
    with pytest.raises(ValidationError) as error:
        RetentionConceptWrite(codigo="HON", **CONCEPTO_ESCRITURA)
    assert error.value.errors()[0]["type"] == "extra_forbidden"

    data = normalize_retention_concept({"codigo": "hon", **CONCEPTO_ESCRITURA})
    assert (data["codigo"], data["baseMinima"]) == ("HON", Decimal("0"))
    # Vacio: sin cuenta, 422 (la pantalla la exige aunque la tabla la admita).
    with pytest.raises(RetentionConceptValidationError, match="cuenta del concepto"):
        normalize_retention_concept({"codigo": "HON", "nombre": "Honorarios", "tarifa": "0.1"})
    with pytest.raises(RetentionConceptValidationError, match="negativa"):
        normalize_retention_concept({**CONCEPTO_ESCRITURA, "codigo": "HON", "baseMinima": "-0.01"})


def test_ads_retention_concept_rejects_the_unsupported_columns_before_connecting() -> None:
    with pytest.raises(RetentionConceptValidationError, match="CONTIRET no tiene columna de cuenta"):
        conceptos_retencion_repository.create_concepto_retencion("027", {"codigo": "01", **CONCEPTO_ESCRITURA})
    with pytest.raises(RetentionConceptValidationError, match="dos dígitos"):
        conceptos_retencion_repository.create_concepto_retencion("027", {"codigo": "HON", **CONCEPTO_ESCRITURA})
    with pytest.raises(RetentionConceptValidationError, match="obligatorio"):
        conceptos_retencion_repository.create_concepto_retencion("027", {"codigo": "01", "tarifa": 0.1})


def test_retention_concept_row_and_pg_listing_share_the_contract(monkeypatch) -> None:
    assert _retention_concept_from_row({"CODIGO": "HON", "NOMBRE": "Honorarios", "VLRPOR": 10.0}) == {
        "codigo": "HON", "nombre": "Honorarios", "tarifa": 0.1, "baseMinima": 0.0,
        "cuenta": "", "nombreCuenta": "",
    }
    _postgres_script(
        monkeypatch,
        [
            (["codigo"], [("27",)]),
            (["id"], [(5,)]),
            (
                ["CODIGO", "NOMBRE", "TARIFA", "BASE_MINIMA", "CUENTA", "NOMBRE_CUENTA"],
                [("HON", "Honorarios", Decimal("0.100000"), Decimal("1500.00"), "236525", "Retención honorarios")],
            ),
        ],
    )
    assert postgres_repository.list_conceptos_retencion("027") == [
        {"codigo": "HON", "nombre": "Honorarios", "tarifa": 0.1, "baseMinima": 1500.0,
         "cuenta": "236525", "nombreCuenta": "Retención honorarios"}
    ]


def test_pg_retention_concept_rejects_invalid_payload_before_connecting() -> None:
    with pytest.raises(RetentionConceptValidationError, match="cuenta del concepto"):
        postgres_writes.create_concepto_retencion("027", {"codigo": "HON", "nombre": "H", "tarifa": 0.1})


def test_income_line_model_and_rules() -> None:
    payload = IncomeLineCreate(codigo="R01", **RENGLON_ESCRITURA)
    assert payload.signo == 1
    with pytest.raises(ValidationError):
        IncomeLineCreate(codigo="R01", **{**RENGLON_ESCRITURA, "signo": 0})
    with pytest.raises(ValidationError):
        IncomeLineCreate(codigo="R01", nombre="Ingresos", signo=1)  # sin cuenta
    with pytest.raises(ValidationError):
        IncomeLineCreate(codigo="R01", **{**RENGLON_ESCRITURA, "cuenta": "ABC"})
    with pytest.raises(ValidationError) as error:
        IncomeLineWrite(codigo="R01", **RENGLON_ESCRITURA)
    assert error.value.errors()[0]["type"] == "extra_forbidden"

    data = normalize_income_line({"codigo": "r02", **RENGLON_ESCRITURA, "signo": -1})
    assert (data["codigo"], data["signo"]) == ("R02", -1)
    with pytest.raises(IncomeLineValidationError, match="cuenta del renglón"):
        normalize_income_line({"codigo": "R01", "nombre": "Ingresos", "signo": 1})
    with pytest.raises(IncomeLineValidationError, match="1 o -1"):
        normalize_income_line({**RENGLON_ESCRITURA, "codigo": "R01", "signo": 0})


def test_ads_income_line_rejects_the_unsupported_columns_before_connecting() -> None:
    with pytest.raises(IncomeLineValidationError, match="CONDECLA no tiene columna de cuenta"):
        renglones_renta_repository.create_renglon_renta("027", {"codigo": "R01", **RENGLON_ESCRITURA})
    with pytest.raises(IncomeLineValidationError, match="máximo 3 caracteres"):
        renglones_renta_repository.create_renglon_renta("027", {"codigo": "RENTA1", **RENGLON_ESCRITURA})


def test_income_line_row_and_pg_listing_share_the_contract(monkeypatch) -> None:
    assert _income_line_from_row({"CODIGO": "R01", "NOMBRE": "Ingresos brutos"}) == {
        "codigo": "R01", "nombre": "Ingresos brutos", "cuenta": "", "nombreCuenta": "", "signo": 1,
    }
    _postgres_script(
        monkeypatch,
        [
            (["codigo"], [("27",)]),
            (["id"], [(5,)]),
            (
                ["CODIGO", "NOMBRE", "SIGNO", "CUENTA", "NOMBRE_CUENTA"],
                [("R02", "Devoluciones", -1, "417505", "Devoluciones en ventas")],
            ),
        ],
    )
    assert postgres_repository.list_renglones_renta("027") == [
        {"codigo": "R02", "nombre": "Devoluciones", "cuenta": "417505",
         "nombreCuenta": "Devoluciones en ventas", "signo": -1}
    ]


def test_pg_income_line_rejects_invalid_payload_before_connecting() -> None:
    with pytest.raises(IncomeLineValidationError, match="cuenta del renglón"):
        postgres_writes.create_renglon_renta("027", {"codigo": "R01", "nombre": "I", "signo": 1})
    with pytest.raises(IncomeLineValidationError, match="1 o -1"):
        postgres_writes.update_renglon_renta(
            "027", "R01", {"nombre": "I", "cuenta": "410505", "signo": 0}
        )


# ---------------------------------------------------------------------------
# R10: diferencia global / por compañía declarada en el contrato
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "endpoint_name, table_pg, table_ads",
    [
        ("vat_rates", "tarifas_iva", "CONTIIVA"),
        ("retention_concepts", "conceptos_retencion", "CONTIRET"),
        ("income_lines", "renglones_renta", "CONDECLA"),
    ],
)
def test_catalog_reads_declare_the_scope_per_engine(
    monkeypatch, endpoint_name: str, table_pg: str, table_ads: str
) -> None:
    endpoint = getattr(app_module, endpoint_name)
    monkeypatch.setattr(store, "list_tarifas_iva", lambda cia: [{"codigo": "X"}])
    monkeypatch.setattr(store, "list_conceptos_retencion", lambda cia: [{"codigo": "X"}])
    monkeypatch.setattr(store, "list_renglones_renta", lambda cia: [{"codigo": "X"}])

    monkeypatch.setattr(store, "is_postgres", lambda: False)
    respuesta_ads = endpoint(cia="027")
    assert respuesta_ads["source"] == table_ads
    assert respuesta_ads["sharedAcrossCompanies"] is True
    assert respuesta_ads["count"] == 1

    monkeypatch.setattr(store, "is_postgres", lambda: True)
    respuesta_pg = endpoint(cia="027")
    assert respuesta_pg["source"] == table_pg
    assert respuesta_pg["sharedAcrossCompanies"] is False


# ---------------------------------------------------------------------------
# R1: el despacho resuelve cada operación en los dos motores
# ---------------------------------------------------------------------------
def test_store_dispatch_resolves_every_b3_operation(monkeypatch) -> None:
    llamadas: list[str] = []

    def _make(engine: str, nombre: str):
        def _implementation(*args, **kwargs):
            llamadas.append(f"{engine}:{nombre}")
            return {}

        return _implementation

    # (nombre público, módulo PG, módulo ADS, argumentos, kwargs)
    operaciones = [
        ("list_tarifas_iva", postgres_repository, tarifas_iva_repository, ("027",), {}),
        ("create_tarifa_iva", postgres_writes, tarifas_iva_repository, ("027", {"codigo": "X"}), {}),
        ("update_tarifa_iva", postgres_writes, tarifas_iva_repository, ("027", "X", {"codigo": "X"}), {}),
        ("delete_tarifa_iva", postgres_writes, tarifas_iva_repository, ("027", "X"), {"reason": "motivo de prueba"}),
        ("list_conceptos_retencion", postgres_repository, conceptos_retencion_repository, ("027",), {}),
        ("create_concepto_retencion", postgres_writes, conceptos_retencion_repository, ("027", {"codigo": "X"}), {}),
        ("update_concepto_retencion", postgres_writes, conceptos_retencion_repository, ("027", "X", {"codigo": "X"}), {}),
        ("delete_concepto_retencion", postgres_writes, conceptos_retencion_repository, ("027", "X"), {"reason": "motivo de prueba"}),
        ("list_renglones_renta", postgres_repository, renglones_renta_repository, ("027",), {}),
        ("create_renglon_renta", postgres_writes, renglones_renta_repository, ("027", {"codigo": "X"}), {}),
        ("update_renglon_renta", postgres_writes, renglones_renta_repository, ("027", "X", {"codigo": "X"}), {}),
        ("delete_renglon_renta", postgres_writes, renglones_renta_repository, ("027", "X"), {"reason": "motivo de prueba"}),
    ]
    for nombre, modulo_pg, modulo_ads, _args, _kwargs in operaciones:
        monkeypatch.setattr(modulo_ads, nombre, _make("ads", nombre))
        monkeypatch.setattr(modulo_pg, nombre, _make("pg", nombre))

    monkeypatch.setattr(store, "is_postgres", lambda: False)
    for nombre, _pg, _ads, args, kwargs in operaciones:
        getattr(store, nombre)(*args, **kwargs)
    monkeypatch.setattr(store, "is_postgres", lambda: True)
    for nombre, _pg, _ads, args, kwargs in operaciones:
        getattr(store, nombre)(*args, **kwargs)

    assert len(llamadas) == len(operaciones) * 2
    assert sum(1 for llamada in llamadas if llamada.startswith("ads:")) == len(operaciones)
    assert sum(1 for llamada in llamadas if llamada.startswith("pg:")) == len(operaciones)


def test_store_company_writes_are_resolved_by_engine(monkeypatch) -> None:
    llamadas: list[str] = []

    def _make(engine: str):
        def _implementation(*args, **kwargs):
            llamadas.append(engine)
            return {}

        return _implementation

    monkeypatch.setattr(postgres_writes, "create_company", _make("pg"))
    monkeypatch.setattr(companias_repository, "create_company", _make("ads"))

    monkeypatch.setattr(store, "is_postgres", lambda: True)
    store.create_company({"codigo": "2"})
    monkeypatch.setattr(store, "is_postgres", lambda: False)
    store.create_company({"codigo": "2"})
    assert llamadas == ["pg", "ads"]


# ---------------------------------------------------------------------------
# R5: errores estables de las excepciones de dominio nuevas
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "excepcion, esperado",
    [
        (CompanyAlreadyExists("x"), 409),
        (CompanyConflict("x"), 409),
        (VatRateAlreadyExists("x"), 409),
        (VatRateConflict("x"), 409),
        (RetentionConceptAlreadyExists("x"), 409),
        (RetentionConceptConflict("x"), 409),
        (IncomeLineAlreadyExists("x"), 409),
        (IncomeLineConflict("x"), 409),
        (VatRateNotFound("x"), 404),
        (RetentionConceptNotFound("x"), 404),
        (IncomeLineNotFound("x"), 404),
        (CompanyValidationError("x"), 422),
        (VatRateValidationError("x"), 422),
        (RetentionConceptValidationError("x"), 422),
        (IncomeLineValidationError("x"), 422),
        (CompanyWriteNotImplemented("x"), 503),
    ],
)
def test_service_error_mapping_is_stable(excepcion: Exception, esperado: int) -> None:
    error = app_module._service_error(excepcion)
    assert error.status_code == esperado
    assert error.detail == "x"
