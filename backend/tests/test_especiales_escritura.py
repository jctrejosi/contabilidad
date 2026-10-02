"""Casos de aceptación del bloque H6: las dos rutas de Especiales (cuentas en cero).

Son pruebas unitarias puras, como `test_cierres_escritura.py`: **no levantan base
de datos**. Cubren:

- el contrato del cuerpo de ``ZeroAccountRemoval`` y sus casos inválidos (R6):
  el motivo (10..180), la confirmación literal ``ELIMINAR``, los patrones de cuenta
  y la lista obligatoria;
- el tope de página del análisis (``pageSize`` ≤ 500) y el rango del año, que se
  resuelven **antes** de abrir la conexión;
- el contrato puro de la revalidación (causa de cada rechazo) y el orden de borrado
  **de abajo hacia arriba**;
- las diferencias declaradas entre motores (R10): la rama Advantage responde 503
  declarado con su causa (``CONMAE`` + recorrido de ``MOV01``), no un error genérico,
  y valida el cuerpo antes de declararlo;
- el ``delete_account`` que Advantage no tiene, declarado en vez de simulado.

La ejecución real de un 200 contra PostgreSQL queda fuera de esta suite: requiere un
motor disponible.
"""

import pytest

from backend import especiales_repository as repo
from backend import store
from backend.especiales_repository import (
    EspecialesConflict,
    EspecialesLegacyNotSupported,
    EspecialesNotFound,
    EspecialesValidationError,
    clasificar_rechazos,
    delete_account,
    delete_zero_accounts,
    list_zero_accounts,
    motivo_rechazo,
    normalize_removal,
)

MOTIVO = "Limpieza del plan de cuentas sin movimiento"

REMOCION = {
    "anio": 2026,
    "cuentas": ["529595", "110505"],
    "usuario": "JPG",
    "motivo": MOTIVO,
    "confirmacion": "ELIMINAR",
}


# ---------------------------------------------------------------------------
# Contrato del cuerpo (§4.2)
# ---------------------------------------------------------------------------
def test_normalize_removal_accepts_the_contract_and_depurates_the_list() -> None:
    data = normalize_removal({**REMOCION, "cuentas": ["529595", "529595", "110505"]})
    assert data["anio"] == 2026
    assert data["usuario"] == "JPG"
    assert data["motivo"] == MOTIVO
    assert data["confirmacion"] == "ELIMINAR"
    # La misma cuenta repetida no cuenta dos veces en ``solicitadas``.
    assert data["cuentas"] == ["529595", "110505"]


def test_normalize_removal_rejects_a_short_or_long_reason() -> None:
    with pytest.raises(EspecialesValidationError, match="motivo"):
        normalize_removal({**REMOCION, "motivo": "corto"})
    with pytest.raises(EspecialesValidationError, match="motivo"):
        normalize_removal({**REMOCION, "motivo": "x" * 181})
    # El mínimo literal de la pantalla es 10 caracteres.
    assert normalize_removal({**REMOCION, "motivo": "x" * 10})["motivo"] == "x" * 10


def test_normalize_removal_requires_the_literal_confirmation() -> None:
    with pytest.raises(EspecialesValidationError, match="ELIMINAR"):
        normalize_removal({**REMOCION, "confirmacion": "eliminar"})
    with pytest.raises(EspecialesValidationError, match="ELIMINAR"):
        normalize_removal({k: v for k, v in REMOCION.items() if k != "confirmacion"})


def test_normalize_removal_rejects_an_empty_list_and_bad_account_patterns() -> None:
    with pytest.raises(EspecialesValidationError, match="al menos una cuenta"):
        normalize_removal({**REMOCION, "cuentas": []})
    with pytest.raises(EspecialesValidationError, match="cuenta"):
        normalize_removal({**REMOCION, "cuentas": ["5105A"]})
    with pytest.raises(EspecialesValidationError, match="cuenta"):
        normalize_removal({**REMOCION, "cuentas": ["1" * 13]})
    with pytest.raises(EspecialesValidationError, match="cuenta"):
        normalize_removal({**REMOCION, "cuentas": [""]})
    with pytest.raises(EspecialesValidationError, match="cuenta"):
        normalize_removal({**REMOCION, "cuentas": "529595"})


def test_normalize_removal_validates_the_year_range() -> None:
    assert normalize_removal({**REMOCION, "anio": 1900})["anio"] == 1900
    assert normalize_removal({**REMOCION, "anio": 2100})["anio"] == 2100
    with pytest.raises(EspecialesValidationError, match="año"):
        normalize_removal({**REMOCION, "anio": 1899})
    with pytest.raises(EspecialesValidationError, match="año"):
        normalize_removal({**REMOCION, "anio": 2101})


def test_normalize_removal_rejects_a_long_user() -> None:
    with pytest.raises(EspecialesValidationError, match="usuario"):
        normalize_removal({**REMOCION, "usuario": "JPGSX"})


# ---------------------------------------------------------------------------
# Validación antes de tocar el motor (§4.1)
# ---------------------------------------------------------------------------
def test_list_zero_accounts_enforces_the_page_cap_before_connecting(monkeypatch) -> None:
    # El tope de página y el rango del año se resuelven antes de importar el motor.
    called: list[str] = []
    monkeypatch.setattr(store, "is_postgres", lambda: called.append("store") or False)

    with pytest.raises(EspecialesValidationError, match="tamaño de página"):
        list_zero_accounts("027", anio=2026, page_size=501)
    with pytest.raises(EspecialesValidationError, match="página"):
        list_zero_accounts("027", anio=2026, page=0)
    with pytest.raises(EspecialesValidationError, match="año"):
        list_zero_accounts("027", anio=1800)
    assert called == []  # ninguna validación llegó al motor


# ---------------------------------------------------------------------------
# R10: la rama Advantage declara su brecha (503), no la simula en silencio
# ---------------------------------------------------------------------------
def test_ads_list_zero_accounts_is_a_declared_unsupported_branch(monkeypatch) -> None:
    monkeypatch.setattr(store, "is_postgres", lambda: False)
    with pytest.raises(EspecialesLegacyNotSupported, match="CONMAE"):
        list_zero_accounts("027", anio=2026)
    with pytest.raises(EspecialesLegacyNotSupported, match="MOV01"):
        list_zero_accounts("027", anio=2026, page_size=500)


def test_ads_delete_zero_accounts_is_a_declared_unsupported_branch(monkeypatch) -> None:
    monkeypatch.setattr(store, "is_postgres", lambda: False)
    with pytest.raises(EspecialesLegacyNotSupported, match="CONMAE"):
        delete_zero_accounts("027", REMOCION)


def test_ads_delete_validates_the_body_then_declares_the_503(monkeypatch) -> None:
    # Sin la confirmación literal es 422 (regla decidida), aunque la rama esté declarada.
    monkeypatch.setattr(store, "is_postgres", lambda: False)
    with pytest.raises(EspecialesValidationError, match="ELIMINAR"):
        delete_zero_accounts("027", {**REMOCION, "confirmacion": "NO"})
    with pytest.raises(EspecialesLegacyNotSupported):
        delete_zero_accounts("027", REMOCION)


def test_ads_delete_account_is_declared_not_simulated() -> None:
    with pytest.raises(EspecialesLegacyNotSupported, match="CONMAE"):
        delete_account("027", "529595")
    with pytest.raises(EspecialesValidationError):
        delete_account("027", "52A595")


# ---------------------------------------------------------------------------
# Contrato puro de la revalidación y del orden de borrado (§4.2)
# ---------------------------------------------------------------------------
def _estado(cuenta: str, nivel: int, **overrides) -> dict:
    base = {
        "id": int(cuenta) if cuenta.isdigit() else 0,
        "cuenta": cuenta,
        "nombre": f"CUENTA {cuenta}",
        "nivel": nivel,
        "afectable": True,
        "saldo": 0,
        "movimientos": 0,
        "acumulados": 0,
        "hijos_fuera_lista": 0,
        "hijos_en_lista": [],
    }
    base.update(overrides)
    return base


def test_motivo_rechazo_describes_each_blocking_cause() -> None:
    assert motivo_rechazo(_estado("529595", 6)) is None
    assert motivo_rechazo(_estado("529595", 6, saldo=10)) == "tiene saldo 10.00"
    assert motivo_rechazo(_estado("529595", 6, movimientos=3)) == "tiene 3 movimientos"
    assert (
        motivo_rechazo(_estado("529595", 6, acumulados=2))
        == "tiene acumulados distintos de cero"
    )
    assert (
        motivo_rechazo(_estado("529595", 6, hijos_fuera_lista=1))
        == "tiene 1 hijos fuera de la lista"
    )


def test_clasificar_rechazos_orders_the_deletion_from_the_bottom_up() -> None:
    padre = _estado("51", 4, hijos_en_lista=["5105"])
    hijo = _estado("5105", 6)
    eliminables, rechazadas = clasificar_rechazos([padre, hijo], ["5105", "51"])
    assert [estado["cuenta"] for estado in eliminables] == ["5105", "51"]
    assert rechazadas == []


def test_clasificar_rechazos_rejects_a_parent_when_a_child_cannot_be_removed() -> None:
    padre = _estado("51", 4, hijos_en_lista=["5105"])
    hijo = _estado("5105", 6, movimientos=2)
    eliminables, rechazadas = clasificar_rechazos([padre, hijo], ["51", "5105"])
    assert eliminables == []
    # Las rechazadas conservan el orden solicitado y cada una lleva su causa.
    assert rechazadas == [
        {"cuenta": "51", "detalle": "tiene hijos que no se pueden eliminar"},
        {"cuenta": "5105", "detalle": "tiene 2 movimientos"},
    ]


def test_clasificar_rechazos_rejects_a_parent_with_children_outside_the_list() -> None:
    padre = _estado("51", 4, hijos_fuera_lista=2, hijos_en_lista=["5105"])
    hijo = _estado("5105", 6)
    eliminables, rechazadas = clasificar_rechazos([padre, hijo], ["51", "5105"])
    assert [estado["cuenta"] for estado in eliminables] == ["5105"]
    assert rechazadas == [{"cuenta": "51", "detalle": "tiene 2 hijos fuera de la lista"}]


# ---------------------------------------------------------------------------
# Contrato declarado del módulo
# ---------------------------------------------------------------------------
def test_exceptions_are_distinct_domain_types() -> None:
    assert issubclass(EspecialesNotFound, RuntimeError)
    assert issubclass(EspecialesConflict, RuntimeError)
    assert issubclass(EspecialesLegacyNotSupported, RuntimeError)
    assert issubclass(EspecialesValidationError, ValueError)


def test_declared_constants_match_the_contract() -> None:
    assert repo.REMOVAL_CONFIRMATION == "ELIMINAR"
    assert repo.MAX_PAGE_SIZE == 500
    assert repo.DEFAULT_PAGE_SIZE == 100
    assert (repo.MIN_REASON, repo.MAX_REASON) == (10, 180)
    assert repo.SOURCE == "cuentas"
