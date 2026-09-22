"""Casos de aceptación del bloque D4: mantenimiento y reorganización.

Son pruebas unitarias puras, como `test_cierres_escritura.py`: **no levantan base
de datos**. Cubren:

- las validaciones que se resuelven **antes** de abrir la conexión: motivo,
  usuario, respaldo, tipo de reorganización, proceso y alcance;
- los normalizadores puros de los tres cuerpos de escritura;
- el helper `tablas_afectadas` del `dryRun` de 3.4;
- el helper `assert_no_maintenance` con un cursor simulado, que es el punto por
  el que las demás escrituras consultan el bloqueo;
- las diferencias declaradas entre motores (R10/P36): con el motor heredado las
  cinco rutas responden 503 declarado con su causa, no un error genérico.

La ejecución real de un 201/200/204 contra PostgreSQL queda fuera de esta suite
(requiere un motor disponible) y el registro de las rutas y el despacho de
`store` los cablea el integrador; aquí solo se verifica el contrato del módulo.
"""

import pytest

from backend import mantenimiento_repository as mant
from backend import store
from backend.mantenimiento_repository import (
    ESTADO_COMPLETADO,
    ESTADO_EJECUTANDO,
    ESTADO_FALLIDO,
    MAINTENANCE_TYPE,
    REORGANIZATION_TYPES,
    MaintenanceConflict,
    MaintenanceLegacyNotSupported,
    MaintenanceNotFound,
    MaintenanceValidationError,
    assert_no_maintenance,
    get_maintenance,
    get_reorganization,
    normalize_maintenance_start,
    normalize_maintenance_stop,
    normalize_reorganization,
    start_maintenance,
    start_reorganization,
    stop_maintenance,
    tablas_a_reorganizar,
    tablas_afectadas,
)

MOTIVO = "Reindexacion mensual planificada"
START = {"usuario": "ADMI", "motivo": MOTIVO, "respaldoRealizado": True}
STOP = {"usuario": "ADMI", "motivo": "Fin del mantenimiento mensual", "proceso": 12}
REORG = {
    "usuario": "ADMI",
    "motivo": MOTIVO,
    "tipo": "Reindexar",
    "alcance": {"tablas": ["documento_lineas", "lote_lineas"]},
}


@pytest.fixture
def ads(monkeypatch):
    """Fuerza el motor heredado: las funciones importan `is_postgres` en la llamada."""
    monkeypatch.setattr(store, "is_postgres", lambda: False)


@pytest.fixture
def pg(monkeypatch):
    monkeypatch.setattr(store, "is_postgres", lambda: True)


class _FakeCursor:
    """Cursor mínimo: devuelve las filas preparadas en orden y recuerda la consulta."""

    def __init__(self, filas: list[tuple] | None = None) -> None:
        self._filas = list(filas or [])
        self.consultas: list[tuple[str, tuple]] = []

    def execute(self, sql: str, params: tuple = ()) -> None:
        self.consultas.append((sql, params))

    def fetchone(self):
        return self._filas.pop(0) if self._filas else None

    def fetchall(self):
        filas = self._filas
        self._filas = []
        return filas


# ---------------------------------------------------------------------------
# Contrato expuesto (nombres exactos)
# ---------------------------------------------------------------------------
def test_d4_exposes_the_five_routes_and_the_lock_helper() -> None:
    for nombre in (
        "get_maintenance",
        "start_maintenance",
        "stop_maintenance",
        "start_reorganization",
        "get_reorganization",
        "assert_no_maintenance",
    ):
        assert callable(getattr(mant, nombre))


def test_d4_constants() -> None:
    assert MAINTENANCE_TYPE == "Mantenimiento"
    assert REORGANIZATION_TYPES == ("Reindexar", "Analizar", "Compactar")
    assert ESTADO_EJECUTANDO == "Ejecutando"
    assert ESTADO_COMPLETADO == "Completado"


def test_d4_domain_exceptions_have_the_expected_base() -> None:
    assert issubclass(MaintenanceNotFound, RuntimeError)
    assert issubclass(MaintenanceConflict, RuntimeError)
    assert issubclass(MaintenanceLegacyNotSupported, RuntimeError)
    assert issubclass(MaintenanceValidationError, ValueError)


# ---------------------------------------------------------------------------
# R10/P36: la rama Advantage declara su brecha (503), no la simula en silencio
# ---------------------------------------------------------------------------
def test_legacy_branch_declares_the_gap_with_its_cause(ads) -> None:
    with pytest.raises(MaintenanceLegacyNotSupported, match="PostgreSQL"):
        get_maintenance("027")
    with pytest.raises(MaintenanceLegacyNotSupported, match="P36"):
        start_maintenance("027", START)
    with pytest.raises(MaintenanceLegacyNotSupported):
        stop_maintenance("027", STOP)
    with pytest.raises(MaintenanceLegacyNotSupported):
        start_reorganization("027", REORG)
    with pytest.raises(MaintenanceLegacyNotSupported):
        get_reorganization("027", 7)


# ---------------------------------------------------------------------------
# 3.2 Entrar en mantenimiento: respaldo, motivo y alcance
# ---------------------------------------------------------------------------
def test_start_requires_the_backup_confirmation() -> None:
    with pytest.raises(MaintenanceValidationError, match="respaldo"):
        start_maintenance("027", {**START, "respaldoRealizado": False})
    sin_respaldo = {clave: valor for clave, valor in START.items() if clave != "respaldoRealizado"}
    with pytest.raises(MaintenanceValidationError, match="respaldo"):
        start_maintenance("027", sin_respaldo)


def test_start_validates_the_payload_before_the_engine_branch(ads) -> None:
    # Sin respaldo, en el motor heredado, gana la validación (422), no el 503.
    with pytest.raises(MaintenanceValidationError):
        start_maintenance("027", {**START, "respaldoRealizado": False})


def test_every_write_requires_a_reason(ads) -> None:
    with pytest.raises(MaintenanceValidationError, match="motivo"):
        start_maintenance("027", {**START, "motivo": "no"})
    with pytest.raises(MaintenanceValidationError, match="motivo"):
        stop_maintenance("027", {**STOP, "motivo": ""})
    with pytest.raises(MaintenanceValidationError, match="motivo"):
        start_reorganization("027", {**REORG, "motivo": "x"})


def test_normalize_maintenance_start_keeps_the_contract() -> None:
    data = normalize_maintenance_start(START)
    assert data["usuario"] == "ADMI"
    assert data["motivo"] == MOTIVO
    assert data["respaldo_realizado"] is True
    assert data["alcance"] == {}


def test_normalize_maintenance_start_defaults_the_user_to_web() -> None:
    data = normalize_maintenance_start({**START, "usuario": "  "})
    assert data["usuario"] == "WEB"


def test_normalize_maintenance_start_rejects_a_long_user() -> None:
    with pytest.raises(MaintenanceValidationError, match="usuario"):
        normalize_maintenance_start({**START, "usuario": "DEMASIADO"})


# ---------------------------------------------------------------------------
# 3.3 Volver al estado normal: el proceso se identifica
# ---------------------------------------------------------------------------
def test_stop_requires_the_process_id() -> None:
    sin_proceso = {clave: valor for clave, valor in STOP.items() if clave != "proceso"}
    with pytest.raises(MaintenanceValidationError, match="proceso"):
        stop_maintenance("027", sin_proceso)
    with pytest.raises(MaintenanceValidationError, match="proceso"):
        stop_maintenance("027", {**STOP, "proceso": 0})


def test_normalize_maintenance_stop_returns_the_process() -> None:
    data = normalize_maintenance_stop(STOP)
    assert data["proceso"] == 12
    assert data["usuario"] == "ADMI"


# ---------------------------------------------------------------------------
# 3.4 Reorganización: tipo y alcance
# ---------------------------------------------------------------------------
def test_reorganization_type_is_validated() -> None:
    with pytest.raises(MaintenanceValidationError, match="Reindexar"):
        normalize_reorganization({**REORG, "tipo": "Vacuum"})
    with pytest.raises(MaintenanceValidationError, match="Reindexar"):
        normalize_reorganization({**REORG, "tipo": None})


def test_normalize_reorganization_keeps_type_and_scope() -> None:
    data = normalize_reorganization(REORG)
    assert data["tipo"] == "Reindexar"
    assert data["alcance"] == REORG["alcance"]


def test_normalize_reorganization_accepts_a_list_of_tables() -> None:
    data = normalize_reorganization({**REORG, "alcance": ["documento_lineas"]})
    assert data["alcance"] == {"tablas": ["documento_lineas"]}


def test_scope_rejects_a_scalar() -> None:
    with pytest.raises(MaintenanceValidationError, match="alcance"):
        normalize_reorganization({**REORG, "alcance": "documento_lineas"})


def test_tablas_afectadas_reads_the_dry_run_scope() -> None:
    assert tablas_afectadas({"tablas": ["documento_lineas", " lote_lineas ", ""]}) == [
        "documento_lineas",
        "lote_lineas",
    ]
    assert tablas_afectadas({}) == []
    assert tablas_afectadas({"tablas": "no"}) == []


def test_tablas_a_reorganizar_keeps_only_the_declared_tables_that_exist() -> None:
    cursor = _FakeCursor([("cuentas",), ("terceros",), ("documentos",)])
    assert tablas_a_reorganizar(cursor, {"tablas": ["cuentas", "inexistente"]}) == ["cuentas"]


def test_tablas_a_reorganizar_falls_back_to_the_default_tables() -> None:
    cursor = _FakeCursor([("cuentas",), ("documentos",), ("otra_cosa",)])
    assert tablas_a_reorganizar(cursor, {}) == ["cuentas", "documentos"]


def test_reorganization_has_a_failed_state() -> None:
    assert ESTADO_FALLIDO == "Fallido"
    assert ESTADO_FALLIDO not in REORGANIZATION_TYPES


def test_get_reorganization_validates_the_id_before_connecting(pg) -> None:
    with pytest.raises(MaintenanceValidationError, match="proceso"):
        get_reorganization("027", 0)


# ---------------------------------------------------------------------------
# El bloqueo: `assert_no_maintenance` con un cursor simulado
# ---------------------------------------------------------------------------
def test_assert_no_maintenance_passes_when_the_company_is_free() -> None:
    cursor = _FakeCursor()
    assert assert_no_maintenance(cursor, 7) is None
    assert cursor.consultas, "el helper debe consultar el estado del proceso"
    _sql, params = cursor.consultas[-1]
    assert params[0] == 7
    assert MAINTENANCE_TYPE in params[1]
    assert params[2] == ESTADO_EJECUTANDO


def test_assert_no_maintenance_conflicts_while_one_is_open() -> None:
    cursor = _FakeCursor([(12,)])
    with pytest.raises(MaintenanceConflict, match="12"):
        assert_no_maintenance(cursor, 7)
