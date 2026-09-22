"""Casos de aceptación del bloque D2: las cuatro rutas de Cierres.

Son pruebas unitarias puras, como `test_consolidacion_escritura.py`: **no levantan
base de datos**. Cubren:

- el registro de las cuatro rutas (R9) con su método y su minúscula;
- el contrato Pydantic de cada cuerpo y sus casos inválidos (R6);
- las validaciones que se resuelven **antes** de abrir la conexión (motivo, mes,
  cuenta de resultado, confirmación, matriz cuadrada);
- el checklist calculado y la bandera ``puedeCerrar`` (§1.1);
- el cálculo puro de las partidas del lote de cierre (§1.3);
- el despacho de `store` por operación (R1);
- el mapeo de las excepciones de dominio nuevas en `_service_error` (R5),
  incluidos el 409 de cierre ya abierto y el 422 de la confirmación;
- las diferencias declaradas entre motores (R10): la rama Advantage responde 503
  declarado con su causa, no un error genérico.

La ejecución real de un 201/200 contra PostgreSQL queda fuera de esta suite:
requiere un motor disponible.
"""

from fastapi import HTTPException
import pytest
from pydantic import ValidationError

from backend import cierres_repository, postgres_repository, postgres_writes, store
from backend import app as app_module
from backend.app import (
    CloseRequest,
    CloseTransferRequest,
    CierreLotActionRequest,
    TransferLine,
    abrir_cierre,
    app,
    cierre_lote,
    cierre_traslado,
    cierres as cierres_endpoint,
)
from backend.cierres_repository import (
    CierreConflict,
    CierreNotFound,
    CierreValidationError,
    CierresLegacyNotSupported,
    build_checklist,
    calcular_lineas_cierre,
    normalize_close,
    normalize_lot_action,
    normalize_transfer,
    puede_cerrar,
    totales_de_lineas,
)

RUTAS_ESPERADAS: set[tuple[str, str]] = {
    ("/api/cierres", "GET"),
    ("/api/cierres", "POST"),
    ("/api/cierres/{id}/lote", "POST"),
    ("/api/cierres/{id}/traslado", "POST"),
}

MOTIVO = "Cierre del ejercicio contable"
TRASLADO = {
    "traslados": [
        {"origenPeriodo": "13", "destinoPeriodo": "01", "cuenta": "510506", "debito": 0, "credito": 100000},
        {"origenPeriodo": "13", "destinoPeriodo": "01", "cuenta": "110505", "debito": 100000, "credito": 0},
    ],
    "usuario": "JPG",
    "motivo": MOTIVO,
    "confirmacion": "TRASLADAR",
}


def _routes() -> set[tuple[str, str]]:
    return {
        (route.path, method)
        for route in app.routes
        for method in (getattr(route, "methods", None) or [])
    }


def _signals(**overrides) -> dict:
    base = {
        "lotes_con_datos": True,
        "lotes_pendientes": 0,
        "lotes_detalle": "todos los lotes contabilizados",
        "balance_con_datos": True,
        "balance_cuadrado": True,
        "balance_detalle": "debito = credito",
        "retencion_al_dia": True,
        "retencion_detalle": "ultimo periodo 12",
        "iva_al_dia": True,
        "iva_detalle": "ultimo periodo 12",
        "respaldo": True,
        "respaldo_detalle": "respaldo registrado",
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Registro de rutas (R9)
# ---------------------------------------------------------------------------
def test_d2_registers_the_four_planned_routes_with_their_methods() -> None:
    rutas = _routes()
    for ruta, metodo in RUTAS_ESPERADAS:
        assert (ruta, metodo) in rutas
    assert len(RUTAS_ESPERADAS) == 4


def test_d2_routes_are_lower_case() -> None:
    for ruta, _metodo in RUTAS_ESPERADAS:
        assert ruta == ruta.lower(), ruta


# ---------------------------------------------------------------------------
# Despacho por operación en store (R1)
# ---------------------------------------------------------------------------
def test_store_dispatches_every_d2_operation() -> None:
    for nombre in ("list_cierres", "create_cierre", "generate_cierre_lot", "transfer_cierre"):
        assert callable(getattr(store, nombre))


def test_store_d2_resolves_each_engine(monkeypatch) -> None:
    llamadas: list[str] = []

    def _make(engine: str, nombre: str):
        def _implementation(*args, **kwargs):
            llamadas.append(f"{engine}:{nombre}")
            return {}

        return _implementation

    operaciones = [
        ("list_cierres", postgres_repository, cierres_repository, ("027", 2026), {}),
        ("create_cierre", postgres_writes, cierres_repository, ("027", {}), {"user": "WEB", "dry_run": False}),
        ("generate_cierre_lot", postgres_writes, cierres_repository, ("027", 7, {}), {"user": "WEB", "dry_run": False}),
        ("transfer_cierre", postgres_writes, cierres_repository, ("027", 7, {}), {"user": "WEB", "dry_run": False}),
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
        (CierreConflict("conf"), 409),
        (CierreNotFound("no"), 404),
        (CierreValidationError("invalido"), 422),
        (CierresLegacyNotSupported("rama declarada"), 503),
    ],
)
def test_service_error_maps_the_new_domain_exceptions(excepcion: Exception, codigo: int) -> None:
    assert app_module._service_error(excepcion).status_code == codigo


def test_get_endpoint_returns_the_checklist_item(monkeypatch) -> None:
    esperado = {"item": {"id": None, "anio": 2026, "estado": "Pendiente"}, "source": "cierres"}
    monkeypatch.setattr(store, "list_cierres", lambda cia, anio: esperado)
    assert cierres_endpoint(cia="027", anio=2026) == esperado


# ---------------------------------------------------------------------------
# 1.2 Abrir el cierre: modelos y el 409 de cierre ya abierto
# ---------------------------------------------------------------------------
def test_close_request_accepts_the_contract_and_forbids_unknown_keys() -> None:
    payload = CloseRequest(anio=2026, usuario="JPG", motivo=MOTIVO)
    assert (payload.anio, payload.usuario) == (2026, "JPG")
    with pytest.raises(ValidationError) as error:
        CloseRequest(**{"anio": 2026, "motivo": MOTIVO, "extra": 1})
    assert error.value.errors()[0]["type"] == "extra_forbidden"


def test_close_request_rejects_a_short_reason_and_a_bad_user() -> None:
    with pytest.raises(ValidationError):
        CloseRequest(anio=2026, usuario="JPG", motivo="abc")
    with pytest.raises(ValidationError):
        CloseRequest(anio=2026, usuario="JPGSX", motivo=MOTIVO)


def test_abrir_cierre_maps_the_open_cierre_conflict_to_409(monkeypatch) -> None:
    def _boom(*_args, **_kwargs):
        raise CierreConflict("El año 2026 ya tiene un cierre Pendiente (id 7).")

    monkeypatch.setattr(store, "create_cierre", _boom)
    payload = CloseRequest(anio=2026, usuario="JPG", motivo=MOTIVO)
    with pytest.raises(HTTPException) as error:
        abrir_cierre(payload, cia="027", dry_run=False)
    assert error.value.status_code == 409
    assert "Pendiente" in error.value.detail


def test_normalize_close_validates_before_connecting() -> None:
    data = normalize_close({"anio": 2026, "usuario": "JPG", "motivo": MOTIVO})
    assert (data["anio"], data["usuario"], data["motivo"]) == (2026, "JPG", MOTIVO)
    with pytest.raises(CierreValidationError):
        normalize_close({"anio": 1800, "usuario": "JPG", "motivo": MOTIVO})
    with pytest.raises(CierreValidationError):
        normalize_close({"anio": 2026, "usuario": "JPG", "motivo": "ab"})


# ---------------------------------------------------------------------------
# 1.3 Lote de cierre: modelo, cálculo de partidas y dryRun
# ---------------------------------------------------------------------------
def test_lot_action_request_requires_the_period_and_the_result_account() -> None:
    payload = CierreLotActionRequest(
        usuario="JPG", motivo=MOTIVO, mes="13", cuentaResultado="3605"
    )
    assert (payload.mes, payload.cuentaResultado) == ("13", "3605")
    with pytest.raises(ValidationError):
        CierreLotActionRequest(usuario="JPG", motivo=MOTIVO, mes="19", cuentaResultado="3605")
    with pytest.raises(ValidationError):
        CierreLotActionRequest(usuario="JPG", motivo=MOTIVO, mes="13", cuentaResultado="59A5")
    with pytest.raises(ValidationError):
        CierreLotActionRequest(usuario="JPG", mes="13", cuentaResultado="3605")  # sin motivo


def test_normalize_lot_action_validates_the_period_before_connecting() -> None:
    data = normalize_lot_action(
        {"usuario": "JPG", "motivo": MOTIVO, "mes": "5", "cuentaResultado": "3605"}
    )
    assert data["mes"] == "05"  # zfill como el resto del contrato
    with pytest.raises(CierreValidationError):
        normalize_lot_action(
            {"usuario": "JPG", "motivo": MOTIVO, "mes": "19", "cuentaResultado": "3605"}
        )


def test_calcular_lineas_cierre_cancels_each_result_unit_against_the_result() -> None:
    lineas = calcular_lineas_cierre(
        [
            {"cuenta": "510506", "saldo": 250.0, "centro": "ADM"},
            {"cuenta": "413505", "saldo": -1000.0},
        ],
        "3605",
    )
    # El gasto (débito) se cancela con crédito; el ingreso (crédito) con débito. La
    # unidad conserva su centro para no descuadrar el auxiliar.
    por_clave = {(linea["cuenta"], linea["centro"]): linea for linea in lineas}
    assert por_clave[("510506", "ADM")] == {
        "cuenta": "510506", "nit": "", "centro": "ADM", "debito": 0.0, "credito": 250.0,
    }
    assert por_clave[("413505", "")] == {
        "cuenta": "413505", "nit": "", "centro": "", "debito": 1000.0, "credito": 0.0,
    }
    # El neto (crédito 750) llega a la cuenta patrimonial sin dimensiones.
    assert por_clave[("3605", "")] == {
        "cuenta": "3605", "nit": "", "centro": "", "debito": 0.0, "credito": 750.0,
    }
    totales = totales_de_lineas(lineas)
    assert totales == {"lineas": 3, "debito": 1000.0, "credito": 1000.0, "cuadrado": True}


def test_calcular_lineas_cierre_without_a_result_account_when_it_is_balanced() -> None:
    lineas = calcular_lineas_cierre(
        [{"cuenta": "413505", "saldo": -1000.0}, {"cuenta": "510506", "saldo": 1000.0}], "3605"
    )
    assert [linea["cuenta"] for linea in lineas] == ["413505", "510506"]
    assert totales_de_lineas(lineas)["cuadrado"] is True


def test_result_and_receiver_classes_are_distinct() -> None:
    """Se cancelan las clases 4 a 7; el neto va a una cuenta patrimonial (clase 3)."""
    assert cierres_repository.RESULT_ACCOUNT_CLASSES == ("4", "5", "6", "7")
    assert cierres_repository.RECEIVER_ACCOUNT_CLASSES == ("3",)


def test_cierre_lote_maps_the_already_generated_conflict_to_409(monkeypatch) -> None:
    def _boom(*_args, **_kwargs):
        raise CierreConflict("El cierre 7 ya generó el lote CI26.")

    monkeypatch.setattr(store, "generate_cierre_lot", _boom)
    payload = CierreLotActionRequest(usuario="JPG", motivo=MOTIVO, mes="13", cuentaResultado="3605")
    with pytest.raises(HTTPException) as error:
        cierre_lote(payload, id=7, cia="027", dry_run=False)
    assert error.value.status_code == 409
    assert "CI26" in error.value.detail


# ---------------------------------------------------------------------------
# 1.4 Traslado: modelo, confirmación literal y matriz cuadrada
# ---------------------------------------------------------------------------
def test_transfer_request_accepts_the_matrix_and_forbids_unknown_keys() -> None:
    payload = CloseTransferRequest(**TRASLADO)
    assert len(payload.traslados) == 2
    with pytest.raises(ValidationError) as error:
        CloseTransferRequest(**{**TRASLADO, "extra": 1})
    assert error.value.errors()[0]["type"] == "extra_forbidden"


def test_transfer_request_rejects_an_empty_matrix_and_a_bad_line() -> None:
    with pytest.raises(ValidationError):
        CloseTransferRequest(**{**TRASLADO, "traslados": []})
    with pytest.raises(ValidationError):
        TransferLine(origenPeriodo="13", destinoPeriodo="01", cuenta="510506", debito=-1)
    with pytest.raises(ValidationError):
        TransferLine(origenPeriodo="19", destinoPeriodo="01", cuenta="510506", debito=1)


def test_normalize_transfer_requires_the_literal_confirmation() -> None:
    with pytest.raises(CierreValidationError, match="TRASLADAR"):
        normalize_transfer({**TRASLADO, "confirmacion": "trasladar"})
    with pytest.raises(CierreValidationError, match="TRASLADAR"):
        normalize_transfer({k: v for k, v in TRASLADO.items() if k != "confirmacion"})
    data = normalize_transfer(TRASLADO)
    assert len(data["traslados"]) == 2


def test_normalize_transfer_rejects_an_empty_or_unbalanced_matrix() -> None:
    with pytest.raises(CierreValidationError, match="al menos una línea"):
        normalize_transfer({**TRASLADO, "traslados": []})
    with pytest.raises(CierreValidationError, match="un solo lado|a la vez"):
        normalize_transfer(
            {
                **TRASLADO,
                "traslados": [
                    {"origenPeriodo": "13", "destinoPeriodo": "01", "cuenta": "510506",
                     "debito": 10, "credito": 10},
                ],
            }
        )
    with pytest.raises(CierreValidationError, match="no cuadra"):
        normalize_transfer(
            {
                **TRASLADO,
                "traslados": [
                    {"origenPeriodo": "13", "destinoPeriodo": "01", "cuenta": "510506",
                     "debito": 100, "credito": 0},
                    {"origenPeriodo": "13", "destinoPeriodo": "01", "cuenta": "110505",
                     "debito": 0, "credito": 50},
                ],
            }
        )


def test_cierre_traslado_endpoint_maps_the_validation_to_422(monkeypatch) -> None:
    def _boom(*_args, **_kwargs):
        raise CierreValidationError("La confirmación debe ser el texto literal TRASLADAR.")

    monkeypatch.setattr(store, "transfer_cierre", _boom)
    payload = CloseTransferRequest(**TRASLADO)
    with pytest.raises(HTTPException) as error:
        cierre_traslado(payload, id=7, cia="027", dry_run=False)
    assert error.value.status_code == 422


# ---------------------------------------------------------------------------
# Checklist calculado (§1.1)
# ---------------------------------------------------------------------------
def test_build_checklist_returns_the_seven_items_and_blocks_on_pending_lots() -> None:
    checklist = build_checklist(_signals(lotes_pendientes=3, lotes_detalle="3 en Borrador"))
    ids = [item["id"] for item in checklist]
    assert ids == ["c1", "c2", "c3", "c4", "c5", "c6", "c7"]
    c1 = next(item for item in checklist if item["id"] == "c1")
    assert c1["bloqueante"] is True and c1["cumplido"] is False
    assert c1["detalle"] == "3 en Borrador"
    assert puede_cerrar(checklist) is False


def test_puede_cerrar_is_false_only_for_blocking_items() -> None:
    # Los no bloqueantes (c3, c4, c5, c7) no impiden cerrar.
    assert puede_cerrar(build_checklist(_signals())) is True
    for clave in ("balance_cuadrado", "respaldo"):
        assert puede_cerrar(build_checklist(_signals(**{clave: False}))) is False


def test_empty_year_checklist_has_every_item_unfulfilled() -> None:
    # Criterio de aceptación 1.1-2: año sin movimiento => items en falso.
    checklist = build_checklist(
        _signals(
            lotes_con_datos=False,
            lotes_detalle="sin lotes en el ejercicio",
            balance_con_datos=False,
            balance_cuadrado=False,
            balance_detalle="sin saldos en el ejercicio",
            retencion_al_dia=False,
            iva_al_dia=False,
            respaldo=False,
        )
    )
    assert all(item["cumplido"] is False for item in checklist)
    assert puede_cerrar(checklist) is False


# ---------------------------------------------------------------------------
# R10: la rama Advantage declara su brecha (503), no la simula en silencio
# ---------------------------------------------------------------------------
def test_ads_cierres_are_a_declared_unsupported_branch() -> None:
    with pytest.raises(CierresLegacyNotSupported, match="cierres"):
        cierres_repository.list_cierres("027", 2026)
    with pytest.raises(CierresLegacyNotSupported, match="cierre_traslados"):
        cierres_repository.create_cierre("027", {"anio": 2026, "usuario": "JPG", "motivo": MOTIVO})
    with pytest.raises(CierresLegacyNotSupported, match="cierres"):
        cierres_repository.generate_cierre_lot(
            "027", 7, {"usuario": "JPG", "motivo": MOTIVO, "mes": "13", "cuentaResultado": "3605"}
        )
    with pytest.raises(CierresLegacyNotSupported, match="cierre_traslados"):
        cierres_repository.transfer_cierre("027", 7, TRASLADO)


def test_ads_transfer_validates_the_confirmation_then_declares_the_503() -> None:
    # Sin la confirmación literal es 422 (regla decidida), aunque la rama esté declarada.
    with pytest.raises(CierreValidationError, match="TRASLADAR"):
        cierres_repository.transfer_cierre("027", 7, {**TRASLADO, "confirmacion": "NO"})
    with pytest.raises(CierresLegacyNotSupported):
        cierres_repository.transfer_cierre("027", 7, TRASLADO)


def test_ads_lot_action_validates_the_period_then_declares_the_503() -> None:
    with pytest.raises(CierreValidationError, match="período"):
        cierres_repository.generate_cierre_lot(
            "027", 7, {"usuario": "JPG", "motivo": MOTIVO, "mes": "19", "cuentaResultado": "3605"}
        )
