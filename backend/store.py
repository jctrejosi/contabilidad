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


def update_third_party(
    nit: str, payload: dict[str, Any], *, cia: str = "", user: str = "WEB"
) -> dict[str, Any]:
    """Modifica la ficha de un tercero. El NIT es la clave y no se modifica."""
    if is_postgres():
        from .postgres_writes import update_third_party as implementation
        return implementation(nit, payload, cia=cia, user=user)
    from .terceros_repository import update_third_party as implementation
    return implementation(nit, payload, user=user)


def delete_third_party(
    nit: str, *, reason: str, user: str = "WEB", cia: str = "", dry_run: bool = False
) -> dict[str, Any]:
    """Retira un tercero del directorio. En PostgreSQL es baja lógica."""
    if is_postgres():
        from .postgres_writes import delete_third_party as implementation
        return implementation(nit, reason=reason, user=user, cia=cia, dry_run=dry_run)
    from .terceros_repository import delete_third_party as implementation
    return implementation(nit, reason=reason, user=user, dry_run=dry_run)


def update_third_party_credit_limit(
    nit: str, payload: dict[str, Any], *, cia: str = "", user: str = "WEB"
) -> dict[str, Any]:
    """Fija el cupo de cartera de un tercero sin tocar el resto de la ficha."""
    if is_postgres():
        from .postgres_writes import update_third_party_credit_limit as implementation
        return implementation(nit, payload, cia=cia, user=user)
    from .terceros_repository import update_third_party_credit_limit as implementation
    return implementation(nit, payload, user=user)


def import_third_parties(
    payload: dict[str, Any], *, cia: str = "", user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Alta masiva de terceros desde filas ya leídas y mapeadas."""
    if is_postgres():
        from .postgres_writes import import_third_parties as implementation
        return implementation(payload, cia=cia, user=user, dry_run=dry_run)
    from .terceros_repository import import_third_parties as implementation
    return implementation(payload, user=user, dry_run=dry_run)


def create_cost_center(
    company_code: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un centro de costo de la compañía en el motor activo."""
    if is_postgres():
        from .postgres_writes import create_cost_center as implementation
    else:
        from .centros_repository import create_cost_center as implementation
    return implementation(company_code, payload, user=user)


def create_voucher(
    company_code: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un comprobante de la compañía en el motor activo."""
    if is_postgres():
        from .postgres_writes import create_voucher as implementation
    else:
        from .comprobantes_repository import create_voucher as implementation
    return implementation(company_code, payload, user=user)


def create_document_type(
    company_code: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un tipo de documento en el motor activo.

    El catálogo es global en el legado (``VISDOCUM``) y por compañía en
    PostgreSQL; ambos reciben la compañía activa para validar el comprobante.
    """
    if is_postgres():
        from .postgres_writes import create_document_type as implementation
    else:
        from .tipos_documento_repository import create_document_type as implementation
    return implementation(company_code, payload, user=user)


def list_tarifas_iva(cia: str) -> list[dict[str, Any]]:
    """Tarifas de IVA de la compañía, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_tarifas_iva as implementation
    else:
        from .tarifas_iva_repository import list_tarifas_iva as implementation
    return implementation(cia)


def create_tarifa_iva(cia: str, payload: dict[str, Any], *, user: str = "WEB") -> dict[str, Any]:
    """Crea una tarifa de IVA.

    ``CONTIIVA`` es global en el legado y ``tarifas_iva`` es por compañía en
    PostgreSQL: ambos reciben la compañía activa para validarla y para resolver
    la cuenta de la tarifa.
    """
    if is_postgres():
        from .postgres_writes import create_tarifa_iva as implementation
    else:
        from .tarifas_iva_repository import create_tarifa_iva as implementation
    return implementation(cia, payload, user=user)


def update_tarifa_iva(
    cia: str, codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica una tarifa de IVA; el código es la clave y no se cambia."""
    if is_postgres():
        from .postgres_writes import update_tarifa_iva as implementation
    else:
        from .tarifas_iva_repository import update_tarifa_iva as implementation
    return implementation(cia, codigo, payload, user=user)


def delete_tarifa_iva(
    cia: str, codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Da de baja una tarifa de IVA (lógica en PostgreSQL)."""
    if is_postgres():
        from .postgres_writes import delete_tarifa_iva as implementation
    else:
        from .tarifas_iva_repository import delete_tarifa_iva as implementation
    return implementation(cia, codigo, reason=reason, user=user, dry_run=dry_run)


def list_conceptos_retencion(cia: str) -> list[dict[str, Any]]:
    """Conceptos de retención de la compañía, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_conceptos_retencion as implementation
    else:
        from .conceptos_retencion_repository import list_conceptos_retencion as implementation
    return implementation(cia)


def create_concepto_retencion(
    cia: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un concepto de retención (``CONTIRET`` global; por compañía en PG)."""
    if is_postgres():
        from .postgres_writes import create_concepto_retencion as implementation
    else:
        from .conceptos_retencion_repository import create_concepto_retencion as implementation
    return implementation(cia, payload, user=user)


def update_concepto_retencion(
    cia: str, codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica un concepto de retención; el código es la clave y no se cambia."""
    if is_postgres():
        from .postgres_writes import update_concepto_retencion as implementation
    else:
        from .conceptos_retencion_repository import update_concepto_retencion as implementation
    return implementation(cia, codigo, payload, user=user)


def delete_concepto_retencion(
    cia: str, codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Da de baja un concepto de retención (lógica en PostgreSQL)."""
    if is_postgres():
        from .postgres_writes import delete_concepto_retencion as implementation
    else:
        from .conceptos_retencion_repository import delete_concepto_retencion as implementation
    return implementation(cia, codigo, reason=reason, user=user, dry_run=dry_run)


def list_renglones_renta(cia: str) -> list[dict[str, Any]]:
    """Renglones de renta de la compañía, con el mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_renglones_renta as implementation
    else:
        from .renglones_renta_repository import list_renglones_renta as implementation
    return implementation(cia)


def create_renglon_renta(
    cia: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un renglón de renta (``CONDECLA`` global; por compañía en PG)."""
    if is_postgres():
        from .postgres_writes import create_renglon_renta as implementation
    else:
        from .renglones_renta_repository import create_renglon_renta as implementation
    return implementation(cia, payload, user=user)


def update_renglon_renta(
    cia: str, codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica un renglón de renta; el código es la clave y no se cambia."""
    if is_postgres():
        from .postgres_writes import update_renglon_renta as implementation
    else:
        from .renglones_renta_repository import update_renglon_renta as implementation
    return implementation(cia, codigo, payload, user=user)


def delete_renglon_renta(
    cia: str, codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Da de baja un renglón de renta (lógica en PostgreSQL)."""
    if is_postgres():
        from .postgres_writes import delete_renglon_renta as implementation
    else:
        from .renglones_renta_repository import delete_renglon_renta as implementation
    return implementation(cia, codigo, reason=reason, user=user, dry_run=dry_run)


def list_plantillas_contables(cia: str) -> list[dict[str, Any]]:
    """Plantillas contables con sus parejas de cuentas, mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_plantillas_contables as implementation
    else:
        from .plantillas_contables_repository import list_plantillas_contables as implementation
    return implementation(cia)


def create_plantilla_contable(
    cia: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea una plantilla con sus líneas (``VISDOCUM`` global; por compañía en PG)."""
    if is_postgres():
        from .postgres_writes import create_plantilla_contable as implementation
    else:
        from .plantillas_contables_repository import create_plantilla_contable as implementation
    return implementation(cia, payload, user=user)


def update_plantilla_contable(
    cia: str, codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica una plantilla y reemplaza sus líneas en bloque; el código es la clave."""
    if is_postgres():
        from .postgres_writes import update_plantilla_contable as implementation
    else:
        from .plantillas_contables_repository import update_plantilla_contable as implementation
    return implementation(cia, codigo, payload, user=user)


def delete_plantilla_contable(
    cia: str, codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Da de baja una plantilla (lógica en PostgreSQL)."""
    if is_postgres():
        from .postgres_writes import delete_plantilla_contable as implementation
    else:
        from .plantillas_contables_repository import delete_plantilla_contable as implementation
    return implementation(cia, codigo, reason=reason, user=user, dry_run=dry_run)


def list_formatos_documentales(cia: str) -> list[dict[str, Any]]:
    """Formatos documentales con sus elementos, mismo contrato JSON."""
    if is_postgres():
        from .postgres_repository import list_formatos_documentales as implementation
    else:
        from .formatos_documentales_repository import list_formatos_documentales as implementation
    return implementation(cia)


def create_formato_documental(
    cia: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un formato con sus elementos (``CONGENF`` global; por compañía en PG)."""
    if is_postgres():
        from .postgres_writes import create_formato_documental as implementation
    else:
        from .formatos_documentales_repository import create_formato_documental as implementation
    return implementation(cia, payload, user=user)


def update_formato_documental(
    cia: str, codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica un formato y reemplaza sus elementos en bloque; el código es la clave."""
    if is_postgres():
        from .postgres_writes import update_formato_documental as implementation
    else:
        from .formatos_documentales_repository import update_formato_documental as implementation
    return implementation(cia, codigo, payload, user=user)


def delete_formato_documental(
    cia: str, codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Da de baja un formato (lógica en PostgreSQL)."""
    if is_postgres():
        from .postgres_writes import delete_formato_documental as implementation
    else:
        from .formatos_documentales_repository import delete_formato_documental as implementation
    return implementation(cia, codigo, reason=reason, user=user, dry_run=dry_run)


def create_company(payload: dict[str, Any], *, user: str = "WEB") -> dict[str, Any]:
    """Crea una compañía con su primer año (solo PostgreSQL; 503 en Advantage).

    El legado no tiene fila de compañía: en Advantage la rama declarada lanza
    ``CompanyWriteNotImplemented``, que la capa HTTP traduce a 503 con su causa.
    """
    if is_postgres():
        from .postgres_writes import create_company as implementation
    else:
        from .companias_repository import create_company as implementation
    return implementation(payload, user=user)


def update_company(codigo: str, payload: dict[str, Any], *, user: str = "WEB") -> dict[str, Any]:
    """Modifica la ficha de una compañía (solo PostgreSQL; 503 en Advantage)."""
    if is_postgres():
        from .postgres_writes import update_company as implementation
    else:
        from .companias_repository import update_company as implementation
    return implementation(codigo, payload, user=user)


def delete_company(
    codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Da de baja una compañía sin movimiento (solo PostgreSQL; 503 en Advantage)."""
    if is_postgres():
        from .postgres_writes import delete_company as implementation
    else:
        from .companias_repository import delete_company as implementation
    return implementation(codigo, reason=reason, user=user, dry_run=dry_run)


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


# ---------------------------------------------------------------------------
# Bloque D1 · Impuestos — mismo contrato JSON en los dos motores (R1, R10)
# ---------------------------------------------------------------------------
def list_acumulados_iva(
    cia: str, anio: int, mes_desde: int, mes_hasta: int,
    *, nit: str = "", page: int = 1, page_size: int = 100,
) -> dict[str, Any]:
    """IVA acumulado por tercero y período (``acumulados_iva`` o ``CONIVA``)."""
    if is_postgres():
        from .postgres_repository import list_acumulados_iva as implementation
    else:
        from .impuestos_repository import list_acumulados_iva as implementation
    return implementation(
        cia, anio, mes_desde, mes_hasta, nit=nit, page=page, page_size=page_size
    )


def acumular_iva(
    cia: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Recalcula el acumulado de IVA del período (1.2)."""
    if is_postgres():
        from .postgres_writes import acumular_iva as implementation
    else:
        from .impuestos_repository import acumular_iva as implementation
    return implementation(cia, payload, user=user, dry_run=dry_run)


def list_acumulados_retencion(
    cia: str, anio: int, mes_desde: int, mes_hasta: int,
    *, nit: str = "", concepto: str = "", page: int = 1, page_size: int = 100,
) -> dict[str, Any]:
    """Retenciones acumuladas por tercero, concepto y período (1.4)."""
    if is_postgres():
        from .postgres_repository import list_acumulados_retencion as implementation
    else:
        from .impuestos_repository import list_acumulados_retencion as implementation
    return implementation(
        cia, anio, mes_desde, mes_hasta,
        nit=nit, concepto=concepto, page=page, page_size=page_size,
    )


def acumular_retencion(
    cia: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Recalcula las retenciones acumuladas del período (1.5)."""
    if is_postgres():
        from .postgres_writes import acumular_retencion as implementation
    else:
        from .impuestos_repository import acumular_retencion as implementation
    return implementation(cia, payload, user=user, dry_run=dry_run)


def list_impuestos_formatos(cia: str, *, anio: int | None = None) -> dict[str, Any]:
    """Formatos de exógena con sus conteos (``formatos_exogenos`` o ``CONMAG1``)."""
    if is_postgres():
        from .postgres_repository import list_impuestos_formatos as implementation
    else:
        from .impuestos_repository import list_formatos as implementation
    return implementation(cia, anio=anio)


def create_formato(
    cia: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un formato de exógena de la compañía (2.2)."""
    if is_postgres():
        from .postgres_writes import create_formato as implementation
    else:
        from .impuestos_repository import create_formato as implementation
    return implementation(cia, payload, user=user)


def update_formato(
    cia: str, codigo: str, vigencia: int, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica un formato; el código y la vigencia son su clave (2.3)."""
    if is_postgres():
        from .postgres_writes import update_formato as implementation
    else:
        from .impuestos_repository import update_formato as implementation
    return implementation(cia, codigo, vigencia, payload, user=user)


def delete_formato(
    cia: str, codigo: str, vigencia: int, *, reason: str,
    user: str = "WEB", dry_run: bool = False,
) -> dict[str, Any]:
    """Da de baja lógica un formato (2.4)."""
    if is_postgres():
        from .postgres_writes import delete_formato as implementation
    else:
        from .impuestos_repository import delete_formato as implementation
    return implementation(
        cia, codigo, vigencia=vigencia, reason=reason, user=user, dry_run=dry_run
    )


def replace_formato_conceptos(
    cia: str, codigo: str, vigencia: int, payload: dict[str, Any],
    *, user: str = "WEB", dry_run: bool = False,
) -> dict[str, Any]:
    """Reemplaza en bloque los conceptos de un formato (2.5)."""
    if is_postgres():
        from .postgres_writes import replace_formato_conceptos as implementation
    else:
        from .impuestos_repository import replace_formato_conceptos as implementation
    return implementation(cia, codigo, vigencia, payload, user=user, dry_run=dry_run)


def replace_formato_asignaciones(
    cia: str, codigo: str, vigencia: int, payload: dict[str, Any],
    *, user: str = "WEB", dry_run: bool = False,
) -> dict[str, Any]:
    """Reemplaza en bloque las cuentas asignadas a un formato (2.6)."""
    if is_postgres():
        from .postgres_writes import replace_formato_asignaciones as implementation
    else:
        from .impuestos_repository import replace_formato_asignaciones as implementation
    return implementation(cia, codigo, vigencia, payload, user=user, dry_run=dry_run)


def copy_formatos(
    cia: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Copia las definiciones de exógena de otra compañía (2.7)."""
    if is_postgres():
        from .postgres_writes import copy_formatos as implementation
    else:
        from .impuestos_repository import copy_formatos as implementation
    return implementation(cia, payload, user=user, dry_run=dry_run)


def list_medios(cia: str, anio: int) -> dict[str, Any]:
    """Generaciones de medios con su estado (3.1)."""
    if is_postgres():
        from .postgres_repository import list_medios as implementation
    else:
        from .impuestos_repository import list_medios as implementation
    return implementation(cia, anio)


def create_medio(
    cia: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Genera el medio magnético del año (3.2)."""
    if is_postgres():
        from .postgres_writes import create_medio as implementation
    else:
        from .impuestos_repository import create_medio as implementation
    return implementation(cia, payload, user=user, dry_run=dry_run)


def get_medio(
    cia: str, medio_id: int, *, formato: str = "", nit: str = "",
    page: int = 1, page_size: int = 200,
) -> dict[str, Any]:
    """Filas de una generación del medio para revisión (3.3)."""
    if is_postgres():
        from .postgres_repository import get_medio as implementation
    else:
        from .impuestos_repository import get_medio as implementation
    return implementation(
        cia, medio_id, formato=formato, nit=nit, page=page, page_size=page_size
    )


def update_medio_fila(
    cia: str, medio_id: int, fila_id: int, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Ajusta una fila revisada del medio (3.4)."""
    if is_postgres():
        from .postgres_writes import update_medio_fila as implementation
    else:
        from .impuestos_repository import update_medio_fila as implementation
    return implementation(cia, medio_id, fila_id, payload, user=user)


def get_medio_conciliacion(cia: str, medio_id: int) -> dict[str, Any]:
    """Topes, exclusiones y cuadre del medio (3.5)."""
    if is_postgres():
        from .postgres_repository import get_medio_conciliacion as implementation
    else:
        from .impuestos_repository import get_medio_conciliacion as implementation
    return implementation(cia, medio_id)


def replace_topes(
    cia: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Reemplaza los topes por formato y concepto del año (3.6)."""
    if is_postgres():
        from .postgres_writes import replace_topes as implementation
    else:
        from .impuestos_repository import replace_topes as implementation
    return implementation(cia, payload, user=user, dry_run=dry_run)


def export_medio(
    cia: str, medio_id: int, *, formato: str, formato_exogeno: str = "", user: str = "WEB"
) -> dict[str, Any]:
    """Exporta el medio magnético y marca la generación (3.7)."""
    if is_postgres():
        from .postgres_writes import export_medio as implementation
    else:
        from .impuestos_repository import export_medio as implementation
    return implementation(
        cia, medio_id, formato=formato, formato_exogeno=formato_exogeno, user=user
    )


# ---------------------------------------------------------------------------
# Bloque D3 · Consolidación — mismo contrato JSON en los dos motores (R1, R10)
#
# Las homologaciones solo existen en PostgreSQL; en Advantage la rama declara la
# brecha (503), porque CONSOLID no tiene columnas para año, estado ni
# correspondencias (db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md, CONSOLID/P27).
# ---------------------------------------------------------------------------
def list_consolidaciones(cia: str, anio: int) -> dict[str, Any]:
    """Consolidaciones del año destino (``consolidaciones`` o ``CONSOLID``)."""
    if is_postgres():
        from .postgres_repository import list_consolidaciones as implementation
    else:
        from .consolidacion_repository import list_consolidaciones as implementation
    return implementation(cia, anio)


def create_consolidation(
    cia: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Configura destino, orígenes y homologaciones de una consolidación (2.2)."""
    if is_postgres():
        from .postgres_writes import create_consolidation as implementation
    else:
        from .consolidacion_repository import create_consolidation as implementation
    return implementation(cia, payload, user=user)


def get_consolidation(cia: str, consolidacion_id: int) -> dict[str, Any]:
    """Orígenes, homologaciones, simulación y totales comparados (2.3)."""
    if is_postgres():
        from .postgres_repository import get_consolidation as implementation
    else:
        from .consolidacion_repository import get_consolidation as implementation
    return implementation(cia, consolidacion_id)


def simulate_consolidation(
    cia: str, consolidacion_id: int, payload: dict[str, Any],
    *, user: str = "WEB", dry_run: bool = True,
) -> dict[str, Any]:
    """Simula la consolidación sin escribir en el libro (2.4)."""
    if is_postgres():
        from .postgres_writes import simulate_consolidation as implementation
    else:
        from .consolidacion_repository import simulate_consolidation as implementation
    return implementation(cia, consolidacion_id, payload, user=user, dry_run=dry_run)


def execute_consolidation(
    cia: str, consolidacion_id: int, payload: dict[str, Any],
    *, user: str = "WEB", dry_run: bool = False,
) -> dict[str, Any]:
    """Ejecuta la consolidación: 503 declarado hasta que se decida el algoritmo (2.5)."""
    if is_postgres():
        from .postgres_writes import execute_consolidation as implementation
    else:
        from .consolidacion_repository import execute_consolidation as implementation
    return implementation(cia, consolidacion_id, payload, user=user, dry_run=dry_run)
