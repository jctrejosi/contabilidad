"""Selección del motor de datos del backend.

La API puede operar contra el legado (Advantage, valor por defecto) o contra el
modelo nuevo (PostgreSQL) **sin tocar los endpoints**: cada operación resuelve su
implementación según ``CONTABDSI_STORE``.

Variables (en ``backend/.env`` o en el proceso; el proceso tiene precedencia):

- ``CONTABDSI_STORE``: ``ads`` (por defecto) o ``postgres``.
- ``DATABASE_URL``: cadena de conexión de PostgreSQL.

Este módulo es el punto único de decisión: los repositorios de cada motor no
saben que existen entre sí.
"""

from __future__ import annotations

import os
from typing import Any

from .ads_repository import read_local_env

STORE_ADS = "ads"
STORE_POSTGRES = "postgres"

STORE_LABELS = {
    STORE_ADS: "Advantage Data Server",
    STORE_POSTGRES: "PostgreSQL",
}

# Etiqueta de origen que viaja en el JSON: mantiene trazabilidad de dónde salió
# cada respuesta sin cambiar la forma del contrato.
STORE_SOURCES = {
    STORE_ADS: "CONEMP",
    STORE_POSTGRES: "companias",
}

DEFAULT_DATABASE_URL = "postgres://contabdsi:contabdsi@127.0.0.1:5433/contabdsi"


def configuration() -> dict[str, str]:
    """Valores de ``backend/.env`` con el entorno del proceso por encima."""
    values = read_local_env()
    values.update(dict(os.environ))
    return values


def current_store() -> str:
    """Motor activo. Cualquier valor desconocido cae en Advantage."""
    value = configuration().get("CONTABDSI_STORE", STORE_ADS).strip().lower()
    return value if value in STORE_LABELS else STORE_ADS


def is_postgres() -> bool:
    """¿El motor activo es el modelo nuevo?"""
    return current_store() == STORE_POSTGRES


def store_label() -> str:
    return STORE_LABELS[current_store()]


def source_label() -> str:
    """Tabla de origen que se informa en las respuestas del motor activo."""
    return STORE_SOURCES[current_store()]


def database_url() -> str:
    value = configuration().get("DATABASE_URL", "").strip()
    return value or DEFAULT_DATABASE_URL


def list_companies() -> list[dict[str, Any]]:
    """Compañías del motor activo, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_companies as implementation
    else:
        from .ads_repository import list_companies as implementation
    return implementation()


def check_connection() -> None:
    """Verifica que el motor activo responde. Lanza si no."""
    if is_postgres():
        from .postgres_repository import check_connection as implementation
    else:
        from .ads_repository import check_connection as implementation
    implementation()


def list_cost_centers(company_code: str) -> list[dict[str, Any]]:
    """Centros de costo del motor activo, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_cost_centers as implementation
    else:
        from .centros_repository import list_cost_centers as implementation
    return implementation(company_code)


def get_operation_parameters(cia: str) -> dict[str, Any]:
    """Parámetros de operación del motor activo, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import get_operation_parameters as implementation
    else:
        from .parametros_operacion_repository import get_operation_parameters as implementation
    return implementation(cia)


def get_accounting_period(company_code: str) -> dict[str, Any]:
    """Período de operación del motor activo, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import get_accounting_period as implementation
    else:
        from .contabilizacion_repository import get_accounting_period as implementation
    return implementation(company_code)


def list_vouchers(company_code: str) -> list[dict[str, Any]]:
    """Comprobantes del motor activo, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_vouchers as implementation
    else:
        from .comprobantes_repository import list_vouchers as implementation
    return implementation(company_code)


def list_document_types() -> list[dict[str, Any]]:
    """Tipos de documento del motor activo, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_document_types as implementation
    else:
        from .tipos_documento_repository import list_document_types as implementation
    return implementation()


def list_accounts(company_code: str) -> list[dict[str, Any]]:
    """Plan de cuentas del motor activo, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_accounts as implementation
    else:
        from .ads_repository import list_accounts as implementation
    return implementation(company_code)


def list_third_parties(
    *,
    page: int = 1,
    page_size: int = 100,
    search: str = "",
    state: str = "todos",
) -> dict[str, Any]:
    """Directorio de terceros del motor activo, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_third_parties as implementation
    else:
        from .terceros_repository import list_third_parties as implementation
    return implementation(page=page, page_size=page_size, search=search, state=state)


def list_monthly_movements(
    cia: str, year: int, month: int, **filtros: Any
) -> dict[str, Any]:
    """Movimiento mensual del motor activo, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_monthly_movements as implementation
    else:
        from .movimiento_mensual_repository import list_monthly_movements as implementation
    return implementation(cia, year, month, **filtros)


def list_documents(cia: str, **filtros: Any) -> dict[str, Any]:
    """Cabeceras de documentos del motor activo, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_documents as implementation
    else:
        from .documentos_repository import list_documents as implementation
    return implementation(cia, **filtros)


def document_movements(cia: str, **filtros: Any) -> list[dict[str, Any]]:
    """Partidas de un documento del motor activo, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import document_movements as implementation
    else:
        from .documentos_repository import document_movements as implementation
    return implementation(cia, **filtros)


def build_trial_balance(
    cia: str,
    year: int,
    month_from: int,
    month_to: int,
    *,
    level: int = 6,
    include_zero: bool = False,
) -> dict[str, Any]:
    """Balance de comprobación acumulado del motor activo, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import build_trial_balance as implementation
    else:
        from .balance_comprobacion_repository import build_trial_balance as implementation
    return implementation(
        cia, year, month_from, month_to, level=level, include_zero=include_zero
    )


def list_lots(cia: str, *, page: int = 1, page_size: int = 100) -> dict[str, Any]:
    """Lotes de la compañía del motor activo, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_lots as implementation
    else:
        from .lotes_repository import list_lots as implementation
    return implementation(cia, page=page, page_size=page_size)


def list_lot_lines(
    cia: str, lot: str, *, page: int = 1, page_size: int = 200
) -> dict[str, Any]:
    """Partidas de un lote del motor activo, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_lot_lines as implementation
    else:
        from .lotes_repository import list_lot_lines as implementation
    return implementation(cia, lot, page=page, page_size=page_size)


# ---------------------------------------------------------------------------
# Escrituras (etapa D) — mismo contrato JSON en los dos motores
# ---------------------------------------------------------------------------
def create_third_party(payload: dict[str, Any], *, cia: str = "") -> dict[str, Any]:
    """Crea un tercero. En PostgreSQL hace falta la compañía (el legado era global)."""
    if is_postgres():
        from .postgres_writes import create_third_party as implementation
        return implementation(payload, cia=cia)
    from .terceros_repository import create_third_party as implementation
    return implementation(payload)


def create_account(cia: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Crea una cuenta maestra en el motor activo."""
    if is_postgres():
        from .postgres_writes import create_account as implementation
    else:
        from .ads_repository import create_account as implementation
    return implementation(cia, payload)


def update_account(cia: str, codigo: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Modifica los controles de una cuenta maestra del motor activo."""
    if is_postgres():
        from .postgres_writes import update_account as implementation
    else:
        from .ads_repository import update_account as implementation
    return implementation(cia, codigo, payload)


def update_operation_parameters(cia: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Graba los parámetros de operación del motor activo."""
    if is_postgres():
        from .postgres_writes import update_operation_parameters as implementation
    else:
        from .parametros_operacion_repository import update_operation_parameters as implementation
    return implementation(cia, payload)


def annul_document(cia: str, **filtros: Any) -> dict[str, Any]:
    """Anula un documento contabilizado del motor activo."""
    if is_postgres():
        from .postgres_writes import annul_document as implementation
    else:
        from .anulacion_repository import annul_document as implementation
    return implementation(cia, **filtros)


def create_lot(cia: str, payload: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
    if is_postgres():
        from .postgres_writes import create_lot as implementation
    else:
        from .lotes_repository import create_lot as implementation
    return implementation(cia, payload, dry_run=dry_run)


def update_lot(cia: str, lot: str, payload: dict[str, Any]) -> dict[str, Any]:
    if is_postgres():
        from .postgres_writes import update_lot as implementation
    else:
        from .lotes_repository import update_lot as implementation
    return implementation(cia, lot, payload)


def delete_lot(cia: str, lot: str, *, force: bool = False) -> dict[str, Any]:
    if is_postgres():
        from .postgres_writes import delete_lot as implementation
    else:
        from .lotes_repository import delete_lot as implementation
    return implementation(cia, lot, force=force)


def save_lot_line(
    cia: str, lot: str, payload: dict[str, Any], *, line_id: int | None = None
) -> dict[str, Any]:
    if is_postgres():
        from .postgres_writes import save_lot_line as implementation
    else:
        from .lotes_repository import save_lot_line as implementation
    return implementation(cia, lot, payload, line_id=line_id)


def delete_lot_line(cia: str, lot: str, line_id: int) -> None:
    if is_postgres():
        from .postgres_writes import delete_lot_line as implementation
    else:
        from .lotes_repository import delete_lot_line as implementation
    return implementation(cia, lot, line_id)


def verify_lot(cia: str, lot: str, *, persist: bool = True) -> dict[str, Any]:
    if is_postgres():
        from .postgres_writes import verify_lot as implementation
    else:
        from .lotes_repository import verify_lot as implementation
    return implementation(cia, lot, persist=persist)


def post_lot(cia: str, lot: str, *, user: str = "WEB", dry_run: bool = False) -> dict[str, Any]:
    if is_postgres():
        from .postgres_writes import post_lot as implementation
    else:
        from .lotes_repository import post_lot as implementation
    return implementation(cia, lot, user=user, dry_run=dry_run)


def import_lot(cia: str, payload: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
    if is_postgres():
        from .postgres_writes import import_lot as implementation
    else:
        from .lotes_repository import import_lot as implementation
    return implementation(cia, payload, dry_run=dry_run)


def post_direct_movement(payload: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
    """Contabiliza una captura directa del motor activo."""
    if is_postgres():
        from .postgres_writes import post_direct_movement as implementation
    else:
        from .contabilizacion_repository import post_direct_movement as implementation
    return implementation(payload, dry_run=dry_run)


def simulate_monthly_reprocess(
    cia: str, year: int, month_from: int, month_to: int
) -> dict[str, Any]:
    """Simula el reproceso mensual del motor activo."""
    if is_postgres():
        from .postgres_writes import simulate_monthly_reprocess as implementation
    else:
        from .reproceso_mensual_repository import simulate_monthly_reprocess as implementation
    return implementation(cia, year, month_from, month_to)


def execute_monthly_reprocess(
    cia: str, year: int, month_from: int, month_to: int, *, user: str, reason: str,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Ejecuta (o simula) el reproceso mensual del motor activo."""
    if is_postgres():
        from .postgres_writes import execute_monthly_reprocess as implementation
    else:
        from .reproceso_mensual_repository import execute_monthly_reprocess as implementation
    return implementation(
        cia, year, month_from, month_to, user=user, reason=reason, dry_run=dry_run
    )
