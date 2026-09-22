"""Casos de aceptación del bloque A5: flujo de caja, rubros NIIF y los cinco informes.

Son pruebas unitarias puras, como `test_consolidacion_escritura.py`: **no levantan
base de datos**. Cubren:

- el registro de las cuatro rutas (R9) con su método;
- el contrato Pydantic de los dos cuerpos y sus casos normal, vacío e inválido (R6);
- los caminos de validación que se resuelven **antes** de abrir la conexión;
- el ensamblado puro de los cinco informes y su compatibilidad con el exportador;
- el despacho de `store` por operación y, sobre todo, que **los ids de informe
  existentes conservan su despacho al repositorio de Advantage** (R2) mientras los
  cinco ids nuevos eligen rama por motor (R1);
- las diferencias declaradas entre motores (R10): las cuatro rutas de configuración
  responden 503 con su causa y los cinco informes declaran la carencia con 422;
- el mapeo de las excepciones de dominio nuevas en `_service_error` (R5);
- la extensión aditiva `clasificacionCorriente` de `PUT /api/cuentas/{codigo}` (R2).

La ejecución real contra PostgreSQL o Advantage queda fuera de esta suite.
"""

from fastapi import HTTPException
import pytest
from pydantic import ValidationError

from backend import (
    flujo_caja_niif_repository,
    informes_adicionales_repository,
    postgres_repository,
    postgres_writes,
    store,
)
from backend import app as app_module
from backend.ads_repository import normalize_account
from backend.app import (
    AccountWrite,
    CashFlowDefinition,
    NiifClassification,
    app,
    flujo_caja_renglones,
    reemplazar_flujo_caja_renglones,
    reemplazar_rubros_niif,
    rubros_niif,
)
from backend.flujo_caja_niif_repository import (
    CARENCIA_MESSAGES,
    NUEVOS_INFORME_IDS,
    CashFlowConflict,
    CashFlowLegacyNotSupported,
    CashFlowValidationError,
    NiifConflict,
    NiifLegacyNotSupported,
    NiifValidationError,
    build_cash_flow_report,
    build_corriente_report,
    build_niif_report,
    cuentas_sin_rubro,
    cuentas_tesoreria_sin_uso,
    normalize_cash_flow_definition,
    normalize_niif_classification,
)

RUTAS_ESPERADAS: set[tuple[str, str]] = {
    ("/api/flujo-caja-renglones", "GET"),
    ("/api/flujo-caja-renglones", "PUT"),
    ("/api/rubros-niif", "GET"),
    ("/api/rubros-niif", "PUT"),
}

MOTIVO = "Configuracion de los informes del periodo"
FLUJO = {
    "anio": 2026,
    "renglones": [
        {"codigo": "OP01", "nombre": "Efectivo de operacion", "grupo": "Operacion",
         "orden": 1, "cuenta": "110505", "signo": 1},
        {"codigo": "OP02", "nombre": "Pagos a proveedores", "grupo": "Operacion",
         "orden": 2, "cuenta": "110510", "signo": -1},
    ],
    "usuario": "JPG",
    "motivo": MOTIVO,
}
NIIF = {
    "anio": 2026,
    "rubros": [
        {"codigo": "AC-P1", "nombre": "Efectivo y equivalentes", "informe": "ESFA",
         "tipo": "Activo Corriente", "orden": 1, "cuentas": ["110505"]},
        {"codigo": "ING-01", "nombre": "Ingresos operacionales", "informe": "ER",
         "tipo": "Ingreso", "orden": 1, "cuentas": ["410505"]},
    ],
    "usuario": "JPG",
    "motivo": MOTIVO,
}
SALDOS = {
    "110505": {"CODIGO": "110505", "MNOMBRE": "Caja", "MSALDO": 100.0,
               "MACMDEB01": 50.0, "MACMCRE01": -20.0},
    "110510": {"CODIGO": "110510", "MNOMBRE": "Bancos", "MSALDO": 40.0,
               "MACMDEB01": 0.0, "MACMCRE01": -10.0},
    "410505": {"CODIGO": "410505", "MNOMBRE": "Ingresos", "MSALDO": 0.0,
               "MACMDEB01": 0.0, "MACMCRE01": -300.0},
}
COMPANIA = {"codigo": "027", "nombre": "Empresa de prueba", "nit": "900123456-7"}


def _routes() -> set[tuple[str, str]]:
    return {
        (route.path, method)
        for route in app.routes
        for method in (getattr(route, "methods", None) or [])
    }


# ---------------------------------------------------------------------------
# Registro de rutas (R9)
# ---------------------------------------------------------------------------
def test_a5_registers_the_four_configuration_routes() -> None:
    rutas = _routes()
    for ruta, metodo in RUTAS_ESPERADAS:
        assert (ruta, metodo) in rutas
    assert len(RUTAS_ESPERADAS) == 4


def test_a5_new_paths_are_lower_case_with_hyphens() -> None:
    for ruta, _metodo in RUTAS_ESPERADAS:
        assert ruta == ruta.lower(), ruta
    for ruta, _metodo in _routes():
        assert ruta == ruta.lower(), ruta


def test_a5_does_not_implement_the_personalized_generator() -> None:
    # §6: queda fuera de alcance y no entra en la rama por motor.
    assert "generador-personalizado" not in NUEVOS_INFORME_IDS
    assert NUEVOS_INFORME_IDS == {
        "def-cuentas-flujo", "flujo-comparativo", "acum-corriente",
        "esfa-apertura", "nic-saldos",
    }


# ---------------------------------------------------------------------------
# Contrato Pydantic: normal, vacío e inválido (R6)
# ---------------------------------------------------------------------------
def test_cash_flow_model_accepts_the_declared_contract() -> None:
    payload = CashFlowDefinition(**FLUJO)
    assert payload.anio == 2026
    assert len(payload.renglones) == 2
    assert payload.renglones[0].signo == 1
    assert payload.renglones[1].grupo == "Operacion"


def test_cash_flow_model_rejects_empty_lines_and_short_reason() -> None:
    with pytest.raises(ValidationError):
        CashFlowDefinition(**{**FLUJO, "renglones": []})
    with pytest.raises(ValidationError):
        CashFlowDefinition(**{**FLUJO, "motivo": "abc"})
    with pytest.raises(ValidationError):
        CashFlowDefinition(**{**FLUJO, "usuario": "LARGO"})


def test_cash_flow_model_forbids_unknown_keys_and_bad_values() -> None:
    with pytest.raises(ValidationError) as error:
        CashFlowDefinition(**{**FLUJO, "extra": 1})
    assert error.value.errors()[0]["type"] == "extra_forbidden"
    for cambio in (
        {"grupo": "Otro"},
        {"signo": 0},
        {"signo": 2},
        {"cuenta": "11A"},
        {"codigo": "OP 1"},
        {"nombre": ""},
    ):
        linea = {**FLUJO["renglones"][0], **cambio}
        with pytest.raises(ValidationError):
            CashFlowDefinition(**{**FLUJO, "renglones": [linea]})


def test_niif_model_accepts_the_declared_contract() -> None:
    payload = NiifClassification(**NIIF)
    assert payload.rubros[0].informe == "ESFA"
    assert payload.rubros[0].tipo == "Activo Corriente"
    assert payload.rubros[1].cuentas == ["410505"]


def test_niif_model_rejects_empty_rubros_and_unknown_keys() -> None:
    with pytest.raises(ValidationError):
        NiifClassification(**{**NIIF, "rubros": []})
    with pytest.raises(ValidationError) as error:
        NiifClassification(**{**NIIF, "extra": 1})
    assert error.value.errors()[0]["type"] == "extra_forbidden"


def test_niif_model_rejects_bad_informe_tipo_and_account() -> None:
    for cambio in (
        {"informe": "NIIF"},
        {"tipo": "Activo"},
        {"cuentas": ["11A"]},
        {"codigo": "AC P1"},
    ):
        rubro = {**NIIF["rubros"][0], **cambio}
        with pytest.raises(ValidationError):
            NiifClassification(**{**NIIF, "rubros": [rubro]})


# ---------------------------------------------------------------------------
# Validaciones previas a la conexión
# ---------------------------------------------------------------------------
def test_cash_flow_normalization_is_shared_and_validates_before_connecting() -> None:
    data = normalize_cash_flow_definition(FLUJO)
    assert data["anio"] == 2026
    assert data["renglones"][0]["codigo"] == "OP01"
    assert data["usuario"] == "JPG"
    with pytest.raises(CashFlowValidationError, match="al menos un renglón"):
        normalize_cash_flow_definition({**FLUJO, "renglones": []})
    with pytest.raises(CashFlowValidationError, match="grupo"):
        normalize_cash_flow_definition(
            {**FLUJO, "renglones": [{**FLUJO["renglones"][0], "grupo": "Otro"}]}
        )
    with pytest.raises(CashFlowValidationError, match="repetido"):
        normalize_cash_flow_definition(
            {**FLUJO, "renglones": [FLUJO["renglones"][0], {**FLUJO["renglones"][0], "orden": 2}]}
        )


def test_cash_flow_rejects_a_repeated_account_with_different_signs() -> None:
    definir = [
        {**FLUJO["renglones"][0], "codigo": "OP01", "signo": 1},
        {**FLUJO["renglones"][0], "codigo": "OP02", "signo": -1},
    ]
    with pytest.raises(CashFlowConflict, match="signos distintos"):
        normalize_cash_flow_definition({**FLUJO, "renglones": definir})


def test_niif_normalization_validates_before_connecting() -> None:
    data = normalize_niif_classification(NIIF)
    assert data["rubros"][0]["codigo"] == "AC-P1"
    with pytest.raises(NiifValidationError, match="al menos un rubro"):
        normalize_niif_classification({**NIIF, "rubros": []})
    with pytest.raises(NiifValidationError, match="informe"):
        normalize_niif_classification(
            {**NIIF, "rubros": [{**NIIF["rubros"][0], "informe": "NIIF"}]}
        )
    with pytest.raises(NiifValidationError, match="tipo"):
        normalize_niif_classification(
            {**NIIF, "rubros": [{**NIIF["rubros"][0], "tipo": "Activo"}]}
        )


def test_niif_rejects_an_account_in_two_rubros_of_the_same_informe() -> None:
    repetido = [
        {**NIIF["rubros"][0], "codigo": "AC-P1", "cuentas": ["110505"]},
        {**NIIF["rubros"][0], "codigo": "AC-P2", "cuentas": ["110505"]},
    ]
    with pytest.raises(NiifConflict, match="dos rubros"):
        normalize_niif_classification({**NIIF, "rubros": repetido})
    # La misma cuenta en un rubro del ESFA y en uno del ER sí es válida.
    permitido = [
        {**NIIF["rubros"][0], "codigo": "AC-P1", "informe": "ESFA", "cuentas": ["110505"]},
        {**NIIF["rubros"][0], "codigo": "ER-P1", "informe": "ER", "cuentas": ["110505"]},
    ]
    assert len(normalize_niif_classification({**NIIF, "rubros": permitido})["rubros"]) == 2


def test_coverage_counters_are_pure() -> None:
    plan = [("11", False), ("1105", False), ("110505", True), ("110510", True), ("410505", True)]
    assert cuentas_tesoreria_sin_uso(plan, {"110505"}) == 1
    assert cuentas_tesoreria_sin_uso(plan, {"110505", "110510"}) == 0
    assert cuentas_sin_rubro(plan, {"110505", "410505"}) == 1


# ---------------------------------------------------------------------------
# Ensamblado puro de los cinco informes
# ---------------------------------------------------------------------------
def test_cash_flow_report_uses_the_definition_and_the_saldos() -> None:
    renglones = normalize_cash_flow_definition(FLUJO)["renglones"]
    report = build_cash_flow_report("def-cuentas-flujo", COMPANIA, 2026, 1, 1, renglones, SALDOS)
    # 110505 varia 30 (50 - 20) y 110510 varia -10 (0 - 10); con signo -1 queda +10.
    valores = {fila[0]: fila[-1] for fila in report["filas"]}
    assert valores == {"OP01": 30.0, "OP02": 10.0}
    assert report["totales"][-1] == 40.0
    assert report["count"] == 2
    assert report["source"] == "flujo_caja_renglones"


def test_cash_flow_comparative_uses_the_two_months() -> None:
    renglones = normalize_cash_flow_definition(FLUJO)["renglones"]
    report = build_cash_flow_report("flujo-comparativo", COMPANIA, 2026, 1, 1, renglones, SALDOS)
    assert [columna["label"] for columna in report["columnas"]][-1] == "Variación"
    assert report["count"] == 2


def test_reports_without_definition_declare_the_carencia() -> None:
    with pytest.raises(ValueError, match="definición de cuentas"):
        build_cash_flow_report("def-cuentas-flujo", COMPANIA, 2026, 1, 1, [], SALDOS)
    with pytest.raises(ValueError, match="clasificación corriente"):
        build_corriente_report(COMPANIA, 2026, 1, 1, [], SALDOS)
    with pytest.raises(ValueError, match="NIC/NIIF"):
        build_niif_report("esfa-apertura", COMPANIA, 2026, 1, 1, [], SALDOS)


def test_corriente_report_groups_by_classification() -> None:
    cuentas = [
        {"codigo": "110505", "nombre": "Caja", "clasificacion": "Corriente"},
        {"codigo": "110510", "nombre": "Bancos", "clasificacion": "Corriente"},
    ]
    report = build_corriente_report(COMPANIA, 2026, 1, 1, cuentas, SALDOS)
    assert report["count"] == 2
    assert report["totales"][2] == "TOTALES"
    assert report["clasificaciones"]["Corriente"][3] == 160.0  # 130 + 30 saldo final


def test_niif_report_shows_a_rubro_without_accounts_in_zero() -> None:
    rubros = [
        {"codigo": "AC-P1", "nombre": "Efectivo", "informe": "ESFA",
         "tipo": "Activo Corriente", "orden": 1, "cuentas": ["110505"]},
        {"codigo": "AC-P2", "nombre": "Inversiones", "informe": "ESFA",
         "tipo": "Activo Corriente", "orden": 2, "cuentas": []},
    ]
    report = build_niif_report("esfa-apertura", COMPANIA, 2026, 1, 1, rubros, SALDOS)
    por_codigo = {fila[0]: fila[-1] for fila in report["filas"]}
    assert por_codigo == {"AC-P1": 100.0, "AC-P2": 0.0}  # apertura de 110505
    # nic-saldos usa el cierre del Rango sobre el informe ER.
    er = [
        {"codigo": "ING-01", "nombre": "Ingresos", "informe": "ER",
         "tipo": "Ingreso", "orden": 1, "cuentas": ["410505"]},
    ]
    nic = build_niif_report("nic-saldos", COMPANIA, 2026, 1, 1, er, SALDOS)
    assert {fila[0]: fila[-1] for fila in nic["filas"]} == {"ING-01": 300.0}


def test_report_contract_can_be_exported() -> None:
    renglones = normalize_cash_flow_definition(FLUJO)["renglones"]
    report = build_cash_flow_report("def-cuentas-flujo", COMPANIA, 2026, 1, 1, renglones, SALDOS)
    contenido = informes_adicionales_repository.export_additional_report(report, "csv")
    assert contenido.decode("utf-8-sig").splitlines()[0].startswith("Código;Renglón")


# ---------------------------------------------------------------------------
# R10: la rama Advantage declara la brecha (503) y la carencia (422)
# ---------------------------------------------------------------------------
def test_ads_configuration_routes_declare_503() -> None:
    with pytest.raises(CashFlowLegacyNotSupported, match="flujo_caja_renglones"):
        flujo_caja_niif_repository.list_flujo_caja_renglones("027")
    with pytest.raises(CashFlowLegacyNotSupported, match="flujo_caja_renglones"):
        flujo_caja_niif_repository.replace_flujo_caja_renglones("027", FLUJO)
    with pytest.raises(NiifLegacyNotSupported, match="rubros_niif"):
        flujo_caja_niif_repository.list_rubros_niif("027")
    with pytest.raises(NiifLegacyNotSupported, match="rubros_niif"):
        flujo_caja_niif_repository.replace_rubros_niif("027", NIIF)


def test_ads_write_validates_the_contract_before_declaring_the_503() -> None:
    with pytest.raises(CashFlowValidationError, match="al menos un renglón"):
        flujo_caja_niif_repository.replace_flujo_caja_renglones(
            "027", {**FLUJO, "renglones": []}
        )
    with pytest.raises(NiifValidationError, match="al menos un rubro"):
        flujo_caja_niif_repository.replace_rubros_niif("027", {**NIIF, "rubros": []})


@pytest.mark.parametrize("report_id", sorted(NUEVOS_INFORME_IDS))
def test_ads_reports_declare_the_carencia_with_422(report_id: str) -> None:
    with pytest.raises(ValueError) as error:
        flujo_caja_niif_repository.build_additional_report(report_id, "027", 2026, 1, 1)
    assert str(error.value) == CARENCIA_MESSAGES[report_id]


# ---------------------------------------------------------------------------
# R5: mapeo de las excepciones de dominio nuevas
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "excepcion, codigo",
    [
        (CashFlowConflict("x"), 409),
        (NiifConflict("x"), 409),
        (CashFlowValidationError("x"), 422),
        (NiifValidationError("x"), 422),
        (CashFlowLegacyNotSupported("x"), 503),
        (NiifLegacyNotSupported("x"), 503),
    ],
)
def test_service_error_maps_the_new_domain_exceptions(excepcion: Exception, codigo: int) -> None:
    assert app_module._service_error(excepcion).status_code == codigo


# ---------------------------------------------------------------------------
# R1: despacho por operación en store
# ---------------------------------------------------------------------------
def test_store_dispatches_every_a5_operation() -> None:
    for nombre in (
        "list_flujo_caja_renglones", "replace_flujo_caja_renglones",
        "list_rubros_niif", "replace_rubros_niif", "build_additional_report",
    ):
        assert callable(getattr(store, nombre))


def test_store_a5_configuration_resolves_each_engine(monkeypatch) -> None:
    llamadas: list[str] = []

    def _make(engine: str, nombre: str):
        def _implementation(*args, **kwargs):
            llamadas.append(f"{engine}:{nombre}")
            return {}

        return _implementation

    operaciones = [
        ("list_flujo_caja_renglones", postgres_repository, flujo_caja_niif_repository, ("027",), {}),
        ("replace_flujo_caja_renglones", postgres_writes, flujo_caja_niif_repository, ("027", FLUJO), {}),
        ("list_rubros_niif", postgres_repository, flujo_caja_niif_repository, ("027",), {}),
        ("replace_rubros_niif", postgres_writes, flujo_caja_niif_repository, ("027", NIIF), {}),
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


# ---------------------------------------------------------------------------
# R2/R1: los ids de informe existentes conservan su despacho
# ---------------------------------------------------------------------------
def test_store_keeps_existing_report_ids_on_the_advantage_repository(monkeypatch) -> None:
    llamadas: list[str] = []
    monkeypatch.setattr(
        informes_adicionales_repository, "build_additional_report",
        lambda *args, **kwargs: llamadas.append("ads") or {"id": args[0]},
    )
    monkeypatch.setattr(
        postgres_repository, "build_additional_report",
        lambda *args, **kwargs: llamadas.append("pg") or {},
    )
    monkeypatch.setattr(
        flujo_caja_niif_repository, "build_additional_report",
        lambda *args, **kwargs: llamadas.append("ads-declarado") or {},
    )
    # Tanto con PostgreSQL como con Advantage, los ids que ya funcionaban siguen
    # yendo al repositorio de Advantage (R2).
    for es_postgres in (False, True):
        monkeypatch.setattr(store, "is_postgres", lambda valor=es_postgres: valor)
        store.build_additional_report("balance-mensual", "027", 2026, 1, 1)
        store.build_additional_report("tercero-general", "027", 2026, 1, 1)
    assert llamadas == ["ads", "ads", "ads", "ads"]


def test_store_branches_the_five_new_report_ids_by_engine(monkeypatch) -> None:
    llamadas: list[str] = []
    monkeypatch.setattr(
        informes_adicionales_repository, "build_additional_report",
        lambda *args, **kwargs: llamadas.append("ads-legado") or {},
    )
    monkeypatch.setattr(
        postgres_repository, "build_additional_report",
        lambda *args, **kwargs: llamadas.append("pg") or {},
    )
    monkeypatch.setattr(
        flujo_caja_niif_repository, "build_additional_report",
        lambda *args, **kwargs: llamadas.append("ads-carencia") or {},
    )
    monkeypatch.setattr(store, "is_postgres", lambda: True)
    for report_id in sorted(NUEVOS_INFORME_IDS):
        store.build_additional_report(report_id, "027", 2026, 1, 1)
    monkeypatch.setattr(store, "is_postgres", lambda: False)
    for report_id in sorted(NUEVOS_INFORME_IDS):
        store.build_additional_report(report_id, "027", 2026, 1, 1)
    # En PostgreSQL los genera el modelo nuevo; en Advantage declaran la carencia.
    assert llamadas[:5] == ["pg"] * 5
    assert llamadas[5:] == ["ads-carencia"] * 5


# ---------------------------------------------------------------------------
# Rutas: delegan en store y devuelven el contrato de lista (R9)
# ---------------------------------------------------------------------------
def test_get_routes_delegate_to_store(monkeypatch) -> None:
    monkeypatch.setattr(
        store, "list_flujo_caja_renglones",
        lambda cia, *, anio=None: {"items": [], "count": 0, "source": "flujo_caja_renglones",
                                   "anio": anio},
    )
    monkeypatch.setattr(
        store, "list_rubros_niif",
        lambda cia, *, anio=None, informe="todos": {"items": [], "count": 0,
                                                    "source": "rubros_niif", "informe": informe},
    )
    flujo = flujo_caja_renglones(cia="027", anio=2026)
    assert flujo["count"] == 0 and flujo["source"] == "flujo_caja_renglones"
    rubros = rubros_niif(cia="027", anio=None, informe="ESFA")
    assert rubros["source"] == "rubros_niif" and rubros["informe"] == "ESFA"


def test_put_routes_delegate_to_store_and_pass_the_dry_run(monkeypatch) -> None:
    recibido: dict[str, object] = {}

    def _capturar(cia, payload, *, user, dry_run):
        recibido.update(cia=cia, user=user, dry_run=dry_run)
        return {"item": {}, "source": "flujo_caja_renglones"}

    monkeypatch.setattr(store, "replace_flujo_caja_renglones", _capturar)
    monkeypatch.setattr(
        store, "replace_rubros_niif",
        lambda cia, payload, *, user, dry_run: {"item": {}, "source": "rubros_niif"},
    )
    respuesta = reemplazar_flujo_caja_renglones(CashFlowDefinition(**FLUJO), cia="027", dry_run=True)
    assert respuesta["source"] == "flujo_caja_renglones"
    assert recibido == {"cia": "027", "user": "JPG", "dry_run": True}
    assert reemplazar_rubros_niif(NiifClassification(**NIIF), cia="027", dry_run=False)["item"] == {}


def test_put_body_models_cannot_express_an_empty_collection() -> None:
    # ``min_length=1`` de las dos listas: vaciar la colección es 422 antes de
    # tocar el motor.
    with pytest.raises(ValidationError):
        CashFlowDefinition(**{**FLUJO, "renglones": []})
    with pytest.raises(ValidationError):
        NiifClassification(**{**NIIF, "rubros": []})


def test_put_route_maps_the_declared_carencia_to_503(monkeypatch) -> None:
    def _declarar(*args, **kwargs):
        raise CashFlowLegacyNotSupported("tabla nueva")

    monkeypatch.setattr(store, "replace_flujo_caja_renglones", _declarar)
    # El endpoint delega y traduce la excepción con `_service_error`.
    with pytest.raises(HTTPException) as error:
        reemplazar_flujo_caja_renglones(CashFlowDefinition(**FLUJO), cia="027", dry_run=False)
    assert error.value.status_code == 503


# ---------------------------------------------------------------------------
# R2: extensión aditiva `clasificacionCorriente` de PUT /api/cuentas/{codigo}
# ---------------------------------------------------------------------------
def test_account_write_accepts_the_optional_classification() -> None:
    con = AccountWrite(nombre="Caja", clasificacionCorriente="Corriente")
    assert con.clasificacionCorriente == "Corriente"
    sin = AccountWrite(nombre="Caja")
    assert sin.clasificacionCorriente is None


def test_account_write_forbids_unknown_keys_and_long_classification() -> None:
    with pytest.raises(ValidationError) as error:
        AccountWrite(nombre="Caja", extra=1)
    assert error.value.errors()[0]["type"] == "extra_forbidden"
    with pytest.raises(ValidationError):
        AccountWrite(nombre="Caja", clasificacionCorriente="x" * 31)


def test_normalize_account_only_overwrites_the_classification_when_sent() -> None:
    # Omitirla conserva lo que la cuenta ya tenía (R2): viaja como None.
    assert normalize_account({"nombre": "Caja"}, include_code=False).get("clasificacionCorriente") is None
    con = normalize_account(
        {"nombre": "Caja", "clasificacionCorriente": " Corriente "}, include_code=False
    )
    assert con["clasificacionCorriente"] == "Corriente"
