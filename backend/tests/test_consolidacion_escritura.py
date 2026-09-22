"""Casos de aceptación del bloque D3: las cinco rutas de Consolidación.

Son pruebas unitarias puras, como `test_impuestos_escritura.py`: **no levantan
base de datos**. Cubren:

- el registro de las cinco rutas (R9) con su método;
- el contrato Pydantic de cada cuerpo y sus casos inválidos (R6);
- los caminos de validación que se resuelven **antes** de abrir la conexión;
- el cálculo puro de la simulación y su ``comparacion`` por grupo;
- el despacho de `store` por operación (R1);
- las diferencias declaradas entre motores (R10): la rama Advantage responde 503
  declarado con su causa, no un error genérico;
- el mapeo de las excepciones de dominio nuevas en `_service_error` (R5).

La ejecución real de un 201/200 contra PostgreSQL queda fuera de esta suite:
requiere un motor disponible.
"""

from fastapi import HTTPException
import pytest
from pydantic import ValidationError

from backend import consolidacion_repository, postgres_repository, postgres_writes, store
from backend import app as app_module
from backend.app import (
    ConsolidationAction,
    ConsolidationExecution,
    ConsolidationWrite,
    app,
    consolidacion_simular,
)
from backend.consolidacion_repository import (
    ConsolidacionConflict,
    ConsolidacionLegacyNotSupported,
    ConsolidacionNotFound,
    ConsolidacionPendiente,
    ConsolidacionValidationError,
    calcular_simulacion,
    es_compatible,
    normalize_consolidation,
    normalize_consolidation_action,
    normalize_consolidation_execution,
)

RUTAS_ESPERADAS: set[tuple[str, str]] = {
    ("/api/consolidaciones", "GET"),
    ("/api/consolidaciones", "POST"),
    ("/api/consolidaciones/{id}", "GET"),
    ("/api/consolidaciones/{id}/simular", "POST"),
    ("/api/consolidaciones/{id}/ejecutar", "POST"),
}

MOTIVO = "Simulacion de la consolidacion del ano"
CUENTA = {
    "ciaOrigen": "002", "cuentaOrigen": "110505", "cuentaDestino": "110505", "signo": 1,
}
CENTRO = {"ciaOrigen": "002", "centroOrigen": "ADM", "centroDestino": "ADM"}
ESCRITURA = {
    "anio": 2026,
    "origenes": [{"cia": "002"}, {"cia": "003", "incluida": True}],
    "cuentas": [CUENTA],
    "centros": [CENTRO],
    "usuario": "JPG",
    "motivo": MOTIVO,
}


def _routes() -> set[tuple[str, str]]:
    return {
        (route.path, method)
        for route in app.routes
        for method in (getattr(route, "methods", None) or [])
    }


# ---------------------------------------------------------------------------
# Registro de rutas (R9)
# ---------------------------------------------------------------------------
def test_d3_registers_the_five_planned_routes_with_their_methods() -> None:
    rutas = _routes()
    for ruta, metodo in RUTAS_ESPERADAS:
        assert (ruta, metodo) in rutas
    assert len(RUTAS_ESPERADAS) == 5


def test_d3_does_not_register_the_cierres_or_reorganizacion_routes() -> None:
    # Las secciones 1 (D2) y 3 (D4) son otros bloques y otro agente.
    rutas = _routes()
    assert not any("cierres" in ruta for ruta, _ in rutas)
    assert not any("reorganizacion" in ruta for ruta, _ in rutas)


def test_d3_new_paths_are_lower_case_with_hyphens() -> None:
    for ruta, _metodo in RUTAS_ESPERADAS:
        assert ruta == ruta.lower(), ruta


# ---------------------------------------------------------------------------
# Despacho por operación en store (R1)
# ---------------------------------------------------------------------------
def test_store_dispatches_every_d3_operation() -> None:
    for nombre in (
        "list_consolidaciones", "create_consolidation", "get_consolidation",
        "simulate_consolidation", "execute_consolidation",
    ):
        assert callable(getattr(store, nombre))


def test_store_d3_resolves_each_engine(monkeypatch) -> None:
    llamadas: list[str] = []

    def _make(engine: str, nombre: str):
        def _implementation(*args, **kwargs):
            llamadas.append(f"{engine}:{nombre}")
            return {}

        return _implementation

    # (nombre público, módulo PG, módulo ADS, args, kwargs)
    operaciones = [
        ("list_consolidaciones", postgres_repository, consolidacion_repository, ("027", 2026), {}),
        ("create_consolidation", postgres_writes, consolidacion_repository, ("027", {}), {"user": "WEB"}),
        ("get_consolidation", postgres_repository, consolidacion_repository, ("027", 1), {}),
        ("simulate_consolidation", postgres_writes, consolidacion_repository, ("027", 1, {}), {"user": "WEB", "dry_run": True}),
        ("execute_consolidation", postgres_writes, consolidacion_repository, ("027", 1, {}), {"user": "WEB", "dry_run": False}),
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
# Mapeo de errores de dominio nuevos (R5)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "excepcion, codigo",
    [
        (ConsolidacionConflict("conf"), 409),
        (ConsolidacionNotFound("no"), 404),
        (ConsolidacionValidationError("invalido"), 422),
        (ConsolidacionLegacyNotSupported("rama declarada"), 503),
        (ConsolidacionPendiente("decision pendiente"), 503),
    ],
)
def test_service_error_maps_the_new_domain_exceptions(excepcion: Exception, codigo: int) -> None:
    assert app_module._service_error(excepcion).status_code == codigo


# ---------------------------------------------------------------------------
# 2.2 Configurar: modelo y validaciones previas a la conexión
# ---------------------------------------------------------------------------
def test_consolidation_write_accepts_the_declared_contract() -> None:
    payload = ConsolidationWrite(**ESCRITURA)
    assert payload.anio == 2026
    assert len(payload.origenes) == 2
    assert payload.cuentas[0].signo == 1


def test_consolidation_write_rejects_empty_origins_and_short_reason() -> None:
    with pytest.raises(ValidationError):
        ConsolidationWrite(**{**ESCRITURA, "origenes": []})
    with pytest.raises(ValidationError):
        ConsolidationWrite(**{**ESCRITURA, "motivo": "abc"})


def test_consolidation_write_forbids_unknown_keys_and_bad_codes() -> None:
    with pytest.raises(ValidationError) as error:
        ConsolidationWrite(**{**ESCRITURA, "extra": 1})
    assert error.value.errors()[0]["type"] == "extra_forbidden"
    with pytest.raises(ValidationError):
        ConsolidationWrite(**{**ESCRITURA, "origenes": [{"cia": "00X"}]})
    with pytest.raises(ValidationError):
        ConsolidationWrite(**{**ESCRITURA, "cuentas": [{**CUENTA, "cuentaOrigen": "11A"}]})
    with pytest.raises(ValidationError):
        ConsolidationWrite(**{**ESCRITURA, "cuentas": [{**CUENTA, "signo": 2}]})


def test_consolidation_write_rejects_a_repeated_origin() -> None:
    with pytest.raises(ValidationError, match="dos veces"):
        ConsolidationWrite(**{**ESCRITURA, "origenes": [{"cia": "002"}, {"cia": "002"}]})


def test_execution_model_requires_the_backup_flag() -> None:
    # ``respaldoRealizado`` no tiene valor por defecto: omitirlo es 422.
    with pytest.raises(ValidationError):
        ConsolidationExecution(usuario="WEB", motivo=MOTIVO, confirmacionVaciado=True)
    payload = ConsolidationExecution(
        usuario="WEB", motivo=MOTIVO, respaldoRealizado=True, confirmacionVaciado=True
    )
    assert payload.respaldoRealizado is True


def test_normalize_consolidation_validates_before_connecting() -> None:
    data = normalize_consolidation(ESCRITURA)
    assert (data["anio"], len(data["origenes"]), data["motivo"]) == (2026, 2, MOTIVO)
    with pytest.raises(ConsolidacionValidationError, match="al menos un origen"):
        normalize_consolidation({**ESCRITURA, "origenes": []})
    with pytest.raises(ConsolidacionValidationError, match="repetido"):
        normalize_consolidation({**ESCRITURA, "origenes": [{"cia": "002"}, {"cia": "002"}]})


def test_normalize_consolidation_rejects_cross_class_accounts_and_bad_sign() -> None:
    # La homologación debe referenciar un origen declarado.
    with pytest.raises(ConsolidacionValidationError, match="orígenes declarados"):
        normalize_consolidation(
            {**ESCRITURA, "cuentas": [{**CUENTA, "ciaOrigen": "099"}]}
        )
    # Una cuenta de origen repetida rompería la clave de la tabla.
    with pytest.raises(ConsolidacionValidationError, match="repetida"):
        normalize_consolidation({**ESCRITURA, "cuentas": [CUENTA, CUENTA]})
    # El signo solo admite 1 o -1.
    with pytest.raises(ConsolidacionValidationError, match="1 o -1"):
        normalize_consolidation({**ESCRITURA, "cuentas": [{**CUENTA, "signo": 0}]})
    # Un centro de homologación también debe existir en el origen declarado.
    with pytest.raises(ConsolidacionValidationError, match="orígenes declarados"):
        normalize_consolidation({**ESCRITURA, "centros": [{**CENTRO, "ciaOrigen": "099"}]})


def test_normalize_action_and_execution_validate_the_reason() -> None:
    assert normalize_consolidation_action({"usuario": "WEB", "motivo": MOTIVO})["motivo"] == MOTIVO
    with pytest.raises(ConsolidacionValidationError):
        normalize_consolidation_action({"usuario": "WEB", "motivo": "ab"})
    with pytest.raises(ConsolidacionValidationError, match="respaldoRealizado"):
        normalize_consolidation_execution(
            {"usuario": "WEB", "motivo": MOTIVO, "respaldoRealizado": False, "confirmacionVaciado": True}
        )
    with pytest.raises(ConsolidacionValidationError, match="confirmacionVaciado"):
        normalize_consolidation_execution(
            {"usuario": "WEB", "motivo": MOTIVO, "respaldoRealizado": True, "confirmacionVaciado": False}
        )
    ok = normalize_consolidation_execution(
        {"usuario": "WEB", "motivo": MOTIVO, "respaldoRealizado": True, "confirmacionVaciado": True}
    )
    assert ok["respaldoRealizado"] is True and ok["confirmacionVaciado"] is True


# ---------------------------------------------------------------------------
# 2.4 Simular: dryRun y cálculo puro
# ---------------------------------------------------------------------------
def test_simulate_route_rejects_dry_run_false() -> None:
    payload = ConsolidationAction(usuario="WEB", motivo=MOTIVO)
    with pytest.raises(HTTPException) as error:
        consolidacion_simular(payload, id=4, cia="027", dry_run=False)
    assert error.value.status_code == 422


def test_calcular_simulacion_explains_the_difference_by_group() -> None:
    movimientos = [
        {
            "cia": "002",
            "companiaId": 5,
            "cuentas": [(1, "110505", 1000.0), (2, "413505", -1000.0), (3, "530505", 250.0)],
        }
    ]
    homologaciones = {(5, 1): (101, 1, "110505"), (5, 2): (102, 1, "413505")}
    nombres = {"1": "Activo", "4": "Ingresos", "5": "Gastos"}
    resultado = calcular_simulacion(movimientos, homologaciones, nombres)

    grupos = {fila["grupo"]: fila for fila in resultado["comparacion"]}
    assert grupos["Activo"] == {"grupo": "Activo", "origen": 1000.0, "destino": 1000.0, "diferencia": 0.0}
    assert grupos["Gastos"]["origen"] == 250.0
    assert grupos["Gastos"]["destino"] == 0.0
    # La suma por grupo explica el total: solo la cuenta sin homologar deja diferencia.
    assert resultado["diferencia"] == -250.0
    assert resultado["cuentasSinHomologar"] == 1
    assert resultado["sinHomologar"] == [{"cia": "002", "cuenta": "530505"}]
    assert resultado["filas"] == 2
    assert resultado["cuadra"] is False


def test_calcular_simulacion_cuadra_without_unmapped_accounts() -> None:
    movimientos = [
        {"cia": "002", "companiaId": 5, "cuentas": [(1, "110505", 0.0), (2, "413505", -1000.0)]}
    ]
    # El saldo cero no genera fila ni grupo.
    resultado = calcular_simulacion(movimientos, {(5, 2): (102, 1, "413505")}, {"4": "Ingresos"})
    assert resultado["filas"] == 1
    assert resultado["cuadra"] is True
    assert resultado["diferencia"] == 0.0
    assert resultado["comparacion"] == [
        {"grupo": "Ingresos", "origen": -1000.0, "destino": -1000.0, "diferencia": 0.0}
    ]


def test_es_compatible_requires_no_unmapped_balance_in_included_origins() -> None:
    # (a) todos los incluidos con cero cuentas sin homologar → compatible.
    assert es_compatible(
        [{"incluida": True, "sinHomologar": 0}, {"incluida": True, "sinHomologar": 0}]
    ) is True
    # (b) un incluido con una cuenta con saldo sin homologar → incompatible.
    assert es_compatible(
        [{"incluida": True, "sinHomologar": 0}, {"incluida": True, "sinHomologar": 1}]
    ) is False
    # (c) incluido sin ninguna cuenta homologada: todas sus cuentas con saldo
    # quedan sin homologar → incompatible.
    assert es_compatible([{"incluida": True, "homologadas": 0, "sinHomologar": 4}]) is False
    # (d) un origen no incluido con cuentas sin homologar no afecta el resultado.
    assert es_compatible(
        [{"incluida": True, "sinHomologar": 0}, {"incluida": False, "sinHomologar": 9}]
    ) is True
    # Sin orígenes incluidos no hay consolidación compatible.
    assert es_compatible([]) is False
    assert es_compatible([{"incluida": False, "sinHomologar": 0}]) is False


# ---------------------------------------------------------------------------
# R10: la rama Advantage declara su brecha (503), no la simula en silencio
# ---------------------------------------------------------------------------
def test_ads_consolidation_is_a_declared_unsupported_branch() -> None:
    with pytest.raises(ConsolidacionLegacyNotSupported, match="CONSOLID"):
        consolidacion_repository.list_consolidaciones("027", 2026)
    with pytest.raises(ConsolidacionLegacyNotSupported, match="CONSOLID"):
        consolidacion_repository.get_consolidation("027", 4)
    with pytest.raises(ConsolidacionLegacyNotSupported, match="correspondencias"):
        consolidacion_repository.create_consolidation("027", ESCRITURA)
    with pytest.raises(ConsolidacionLegacyNotSupported, match="correspondencias"):
        consolidacion_repository.simulate_consolidation(
            "027", 4, {"usuario": "WEB", "motivo": MOTIVO}
        )


def test_ads_execution_validates_then_declares_the_503() -> None:
    # Sin respaldo es 422 (regla decidida), aunque la rama esté declarada.
    with pytest.raises(ConsolidacionValidationError, match="respaldoRealizado"):
        consolidacion_repository.execute_consolidation(
            "027", 4,
            {"usuario": "WEB", "motivo": MOTIVO, "respaldoRealizado": False, "confirmacionVaciado": True},
        )
    with pytest.raises(ConsolidacionLegacyNotSupported, match="tabla nueva"):
        consolidacion_repository.execute_consolidation(
            "027", 4,
            {"usuario": "WEB", "motivo": MOTIVO, "respaldoRealizado": True, "confirmacionVaciado": True},
        )


def test_postgres_execution_validates_the_backup_before_connecting() -> None:
    # ``execute_consolidation`` normaliza antes de ``_connect``: sin base de datos
    # disponible el 422 igual tiene que salir.
    with pytest.raises(ConsolidacionValidationError, match="respaldoRealizado"):
        postgres_writes.execute_consolidation(
            "027", 4,
            {"usuario": "WEB", "motivo": MOTIVO, "respaldoRealizado": False, "confirmacionVaciado": True},
        )
