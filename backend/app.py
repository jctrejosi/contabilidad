"""API HTTP de CONTABDSI para la función Plan de cuentas.

La capa HTTP valida el contrato recibido desde React y delega toda operación
con Advantage Data Server a ``ads_repository``. Aquí no se escriben consultas
SQL ni se conocen credenciales.
"""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import Depends, FastAPI, File, HTTPException, Path, Query, Response, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field

from . import store
from .ads_repository import (
    AccountAlreadyExists,
    AccountNotFound,
    AdsConfigurationError,
    CompanyNotFound,
)
from .postgres_repository import PostgresConfigurationError
from .terceros_repository import (
    ThirdPartyAlreadyExists,
    ThirdPartyValidationError,
)
from .anulacion_repository import (
    AnnulmentConflict,
    AnnulmentValidationError,
)
from .lotes_repository import (
    LotConflict,
    LotValidationError,
)
from .importaciones_repository import read_import_file
from .saldos_anuales_repository import list_annual_balances
from .movimiento_anual_cuenta_repository import annual_account_detail, annual_account_summary
from .movimiento_anual_tercero_repository import annual_third_party_detail, annual_third_party_summary
from .movimiento_anual_centro_repository import annual_cost_center_detail, annual_cost_center_summary
from .saldos_cuenta_centro_repository import list_account_balances, list_centers_for_account
from .documento_especifico_repository import specific_document
from .comparativos_repository import compare_values
from .contabilizacion_repository import (
    PostingConflict,
    PostingValidationError,
)
from .balance_comprobacion_repository import (
    export_trial_balance_pdf,
    export_trial_balance_xlsx,
)
from .informes_adicionales_repository import build_additional_report, export_additional_report
from .reproceso_mensual_repository import (
    MonthlyReprocessValidationError,
)
from .parametros_operacion_repository import (
    OperationParametersValidationError,
)


logger = logging.getLogger("contabdsi.backend")
app = FastAPI(
    title="CONTABDSI - Advantage API",
    description="API de transición para consultar y mantener el Plan de cuentas en CONMAE.",
    version="1.0.0",
)


class AccountWrite(BaseModel):
    """Campos de CONMAE autorizados para alta y modificación desde la web."""

    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(description="Nombre de la cuenta (CONMAE.MNOMBRE).", min_length=1, max_length=30)
    afectable: bool = Field(False, description="Permite recibir movimientos (CONMAE.MTC).")
    requiereTercero: bool = Field(False, description="Exige tercero al contabilizar (CONMAE.MCTAPAGOS).")
    requiereCentro: bool = Field(False, description="Exige centro de costo (CONMAE.MCOSTOS).")
    ajuste: bool = Field(False, description="Participa en ajustes por inflación (CONMAE.MAJUSTE).")
    tipoFiscal: Literal["O", "I", "R"] = Field(
        "O",
        description="Clasificación MIVA_RET: O=otra, I=IVA, R=retención.",
    )


class AccountCreate(AccountWrite):
    """Contrato de creación; agrega el código jerárquico inmutable."""

    codigo: str = Field(
        description="Código CONMAE.CODIGO de 1, 2, 4, 6, 9 o 12 dígitos.",
        pattern=r"^[0-9]{1,12}$",
    )


class ThirdPartyCreate(BaseModel):
    """Datos básicos usados por CLIENTES2 para crear un tercero activo."""

    model_config = ConfigDict(extra="forbid")

    nit: str = Field(pattern=r"^[0-9]{1,10}$")
    digito: str = Field("", pattern=r"^[0-9]?$", max_length=1)
    tipoDocumento: Literal["13", "31"]
    nombre: str = Field(min_length=1, max_length=60)
    nombreComercial: str = Field("", max_length=60)
    primerNombre: str = Field("", max_length=20)
    segundoNombre: str = Field("", max_length=20)
    primerApellido: str = Field("", max_length=20)
    segundoApellido: str = Field("", max_length=20)
    direccion: str = Field("", max_length=25)
    codigoCiudad: str = Field("", max_length=5)
    ciudad: str = Field("", max_length=12)
    telefono: str = Field("", max_length=15)
    correo: str = Field("", max_length=60)
    zona: str = Field("", max_length=2)
    cupo: Decimal = Field(Decimal("0"), ge=0, decimal_places=2)


class DirectMovementLine(BaseModel):
    """Partida recibida desde Captura directa antes de escribir MOV01."""

    model_config = ConfigDict(extra="forbid")

    cuenta: str = Field(pattern=r"^[0-9]{1,12}$")
    nit: str = Field("", max_length=15)
    centro: str = Field("", max_length=7)
    debito: Decimal = Field(Decimal("0"), ge=0, decimal_places=2)
    credito: Decimal = Field(Decimal("0"), ge=0, decimal_places=2)
    base: Decimal = Field(Decimal("0"), ge=0, decimal_places=2)
    documentoAfectado: str = Field("", max_length=12)


class DirectMovementPost(BaseModel):
    """Cabecera y partidas necesarias para contabilizar directamente en ADS."""

    model_config = ConfigDict(extra="forbid")

    cia: str = Field(pattern=r"^[0-9]{1,3}$")
    fecha: date
    comprobante: str = Field(min_length=1, max_length=2)
    tipoDocumento: str = Field(min_length=1, max_length=2)
    numeroDocumento: str = Field("", max_length=12)
    concepto: str = Field(min_length=1, max_length=50)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    lineas: list[DirectMovementLine] = Field(min_length=2, max_length=5000)


class MonthlyReprocessRequest(BaseModel):
    """Rango y trazabilidad del reproceso mensual consolidado."""

    model_config = ConfigDict(extra="forbid")

    cia: str = Field(pattern=r"^[0-9]{1,3}$")
    anio: int = Field(ge=1900, le=2100)
    mesDesde: int = Field(ge=1, le=12)
    mesHasta: int = Field(ge=1, le=12)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field("", max_length=180)


class DocumentAnnulmentRequest(BaseModel):
    """Identidad inmutable y trazabilidad requeridas para retirar un documento."""

    model_config = ConfigDict(extra="forbid")

    cia: str = Field(pattern=r"^[0-9]{1,3}$")
    id: int = Field(ge=1)
    documento: str = Field(min_length=1, max_length=12)
    comprobante: str = Field(min_length=1, max_length=6)
    tipoDocumento: str = Field(min_length=1, max_length=2)
    fecha: date
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)


class LotWrite(BaseModel):
    """Cabecera editable de CONMOVI según CREALOT2/GRABALOT."""

    model_config = ConfigDict(extra="forbid")

    lote: str = Field(pattern=r"^[A-Za-z0-9]{4}$")
    nombre: str = Field(min_length=1, max_length=25)
    mes: str = Field(pattern=r"^(0[0-9]|1[0-8])$")
    usuario: str = Field("WEB", min_length=1, max_length=4)


class LotActionRequest(BaseModel):
    """Identifica al usuario que confirma una actualización de lote."""

    model_config = ConfigDict(extra="forbid")

    usuario: str = Field("WEB", min_length=1, max_length=4)


class LotLineWrite(BaseModel):
    """Partida editable de CONLOTES según EDITACELDA/GRABAMOV1."""

    model_config = ConfigDict(extra="forbid")

    cuenta: str = Field(pattern=r"^[0-9]{1,12}$")
    nit: str = Field("", max_length=11)
    centro: str = Field("", max_length=7)
    comprobante: str = Field(min_length=1, max_length=2)
    tipoDocumento: str = Field(min_length=1, max_length=2)
    documento: str = Field(min_length=1, max_length=12)
    documentoAfectado: str = Field("", max_length=12)
    fecha: date
    debito: Decimal = Field(Decimal("0"), ge=0, decimal_places=2)
    credito: Decimal = Field(Decimal("0"), ge=0, decimal_places=2)
    base: Decimal = Field(Decimal("0"), ge=0, decimal_places=2)
    concepto: str = Field(min_length=1, max_length=50)


class ImportLotRequest(BaseModel):
    """Cabecera y partidas interpretadas antes de crear el lote de revisión."""

    model_config = ConfigDict(extra="forbid")

    lote: str = Field(pattern=r"^[A-Za-z0-9]{4}$")
    nombre: str = Field(min_length=1, max_length=25)
    mes: str = Field(pattern=r"^(0[1-9]|1[0-8])$")
    usuario: str = Field("WEB", min_length=1, max_length=4)
    lineas: list[LotLineWrite] = Field(min_length=2, max_length=5000)


class OperationParametersWrite(BaseModel):
    """Campos editables de CONCTR según PARAMS/DSIGRABA6 del sistema original."""

    model_config = ConfigDict(extra="forbid")

    nombreEmpresa: str = Field(min_length=1, max_length=40)
    nit: str = Field(min_length=1, max_length=15)
    direccion: str = Field("", max_length=30)
    ciudad: str = Field("", max_length=20)
    directorioContabilidad: str = Field(min_length=1, max_length=40)
    anioOperacion: str = Field(pattern=r"^[0-9]{4}$")
    contabilidadConciliacion: str = Field("", max_length=3)
    verificaDocumentosLotes: bool
    tercerosDocumentosPropios: bool
    controlaUsuarioLotes: bool
    comentarioCertificado: str = Field("", max_length=120)
    periodosHabilitados: dict[str, bool]


def _service_error(exc: Exception) -> HTTPException:
    """Convierte errores de dominio/ADS en respuestas HTTP estables y seguras."""
    if isinstance(exc, AccountAlreadyExists):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, ThirdPartyAlreadyExists):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, (PostingConflict, LotConflict, AnnulmentConflict)):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, (AccountNotFound, CompanyNotFound)):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (ValueError, PostingValidationError, LotValidationError, OperationParametersValidationError, ThirdPartyValidationError, AnnulmentValidationError, MonthlyReprocessValidationError)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    if isinstance(exc, AdsConfigurationError):
        logger.error("Configuracion ADS no disponible: %s", exc)
        detail = "No fue posible comunicarse con Advantage Data Server."
    elif isinstance(exc, PostgresConfigurationError):
        logger.error("Configuracion PostgreSQL no disponible: %s", exc)
        detail = "No fue posible comunicarse con PostgreSQL."
    else:
        logger.exception("Fallo al operar con el motor de datos")
        detail = "No fue posible comunicarse con Advantage Data Server."
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=detail,
    )


@app.get("/api/health", summary="Validar la conexión con el motor de datos")
def health() -> dict[str, str]:
    """Comprueba el motor activo: Advantage (CONMAE) o PostgreSQL (companias)."""
    try:
        store.check_connection()
    except Exception as exc:
        raise _service_error(exc) from exc
    return {
        "status": "ok",
        "store": store.current_store(),
        "database": store.store_label(),
        "table": "companias" if store.is_postgres() else "CONMAE",
    }


# Compañías de ejemplo para poder entrar a la interfaz cuando Advantage no está
# configurado (ver ADS_DEV_FALLBACK). No sustituyen a CONEMP de forma silenciosa:
# la respuesta se marca con source="DEMO" y queda un aviso en el log.
DEMO_COMPANIES: tuple[dict[str, object], ...] = (
    {"codigo": "001", "nombre": "Compañía Demo S.A.S.", "nit": "900.123.456-7", "habilitada": True},
    {"codigo": "002", "nombre": "Inversiones Beta Ltda.", "nit": "800.200.300-1", "habilitada": False},
    {"codigo": "003", "nombre": "Comercial Gamma S.A.", "nit": "830.400.500-2", "habilitada": True},
    {"codigo": "004", "nombre": "Servicios Delta S.A.S.", "nit": "901.600.700-3", "habilitada": False},
)


def _dev_fallback_enabled() -> bool:
    """Bandera explícita (entorno o backend/.env) para trabajar sin Advantage."""
    values = store.configuration()
    return values.get("ADS_DEV_FALLBACK", "").strip().lower() in {"1", "true", "yes", "si", "sí"}


@app.get("/api/companias", summary="Listar compañías disponibles")
def companies() -> dict[str, object]:
    """Compañías del motor activo para elegir la de la sesión.

    Con ``CONTABDSI_STORE=postgres`` salen de ``companias``; con Advantage, de
    ``CONEMP``. El respaldo ``ADS_DEV_FALLBACK`` solo aplica al motor heredado.
    """
    try:
        items = store.list_companies()
    except Exception as exc:
        if not store.is_postgres() and _dev_fallback_enabled():
            logger.warning(
                "ADS no disponible; /api/companias responde con companias de demostracion "
                "(ADS_DEV_FALLBACK activo)."
            )
            return {"items": list(DEMO_COMPANIES), "count": len(DEMO_COMPANIES), "source": "DEMO"}
        raise _service_error(exc) from exc
    return {"items": items, "count": len(items), "source": store.source_label()}


@app.get("/api/terceros", summary="Consultar el directorio global de terceros")
def third_parties(
    page: int = Query(1, ge=1, description="Página solicitada."),
    page_size: int = Query(100, alias="pageSize", ge=1, le=200),
    q: str = Query("", max_length=60, description="Código, nombre o ciudad."),
    estado: Literal["todos", "activo", "bloqueado"] = Query("todos"),
) -> dict[str, object]:
    """Pagina FADCLI en Advantage; el maestro es común a todas las compañías."""
    try:
        result = store.list_third_parties(page=page, page_size=page_size, search=q, state=estado)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {**result, "source": "FADCLI", "sharedAcrossCompanies": True}


@app.post("/api/terceros", status_code=status.HTTP_201_CREATED, summary="Crear tercero")
def create_third(
    payload: ThirdPartyCreate,
    cia: str = Query("", description="Compañía activa (requerida en PostgreSQL).", pattern=r"^[0-9]{0,3}$"),
) -> dict[str, object]:
    """Crea un tercero activo para usarlo inmediatamente en movimientos."""
    try:
        item = store.create_third_party(payload.model_dump(), cia=cia)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, "source": "FADCLI", "sharedAcrossCompanies": True}


@app.get("/api/centros", summary="Consultar centros de costo por compañía")
def cost_centers(
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Lee CONCECOS usando siempre la compañía activa como parte de la clave."""
    try:
        items = store.list_cost_centers(cia)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {
        "items": items,
        "count": len(items),
        "source": "CONCECOS",
        "sharedAcrossCompanies": False,
    }


@app.get("/api/tipos-documento", summary="Consultar tipos de documento globales")
def document_types() -> dict[str, object]:
    """Lee VISDOCUM sin CIA porque el catálogo se comparte entre compañías."""
    try:
        items = store.list_document_types()
    except Exception as exc:
        raise _service_error(exc) from exc
    return {
        "items": items,
        "count": len(items),
        "source": "VISDOCUM",
        "sharedAcrossCompanies": True,
    }


@app.get("/api/comprobantes", summary="Consultar comprobantes por compañía")
def vouchers(
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Lee CONTICOM usando siempre la compañía activa como parte de la clave."""
    try:
        items = store.list_vouchers(cia)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {
        "items": items,
        "count": len(items),
        "source": "CONTICOM",
        "sharedAcrossCompanies": False,
    }


@app.get("/api/periodo-operacion", summary="Consultar el período contable habilitado")
def accounting_period(
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Lee CONCTR para inicializar fecha y período de Captura directa."""
    try:
        item = store.get_accounting_period(cia)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, "source": "CONCTR"}


@app.get("/api/parametros-operacion", summary="Consultar parámetros de operación")
def operation_parameters(
    cia: str = Query(description="Compañía activa validada contra CONEMP.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Lee el registro real de CONCTR según PARAMS de DSITAB.PRG."""
    try:
        item = store.get_operation_parameters(cia)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, "source": "CONCTR"}


@app.put("/api/parametros-operacion", summary="Actualizar parámetros de operación")
def save_operation_parameters(
    payload: OperationParametersWrite,
    cia: str = Query(description="Compañía activa validada contra CONEMP.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Graba en CONCTR los mismos controles persistidos por DSIGRABA6."""
    try:
        item = store.update_operation_parameters(cia, payload.model_dump())
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, "source": "CONCTR"}


@app.get("/api/movimiento-mensual", summary="Consultar movimientos contables de un mes")
def monthly_movements(
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
    anio: int = Query(ge=1900, le=2100),
    mes: int = Query(ge=1, le=12),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, alias="pageSize", ge=1, le=200),
    cuenta_desde: str = Query("", alias="cuentaDesde", max_length=12),
    cuenta_hasta: str = Query("", alias="cuentaHasta", max_length=12),
    tercero: str = Query("", max_length=15),
    comprobante: str = Query("", max_length=6),
    centro: str = Query("", max_length=7),
    documento: str = Query("", max_length=12),
) -> dict[str, object]:
    """Lee MOV01 solamente después de recibir compañía, período y filtros."""
    try:
        result = store.list_monthly_movements(
            cia,
            anio,
            mes,
            page=page,
            page_size=page_size,
            account_from=cuenta_desde,
            account_to=cuenta_hasta,
            third_party=tercero,
            voucher=comprobante,
            cost_center=centro,
            document=documento,
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    return {**result, "source": "MOV01", "sharedAcrossCompanies": False}


@app.get("/api/consultas/saldos-anuales", summary="Saldos y comportamiento anual")
def annual_balances(
    cia: str = Query(pattern=r"^[0-9]{1,3}$"), anio: int = Query(ge=1900, le=2100),
    mes: int = Query(ge=1, le=18),
    filtro: Literal["generales", "todos", "retenciones", "iva"] = Query("generales"),
    cuenta: str = Query("", max_length=30), page: int = Query(1, ge=1),
    page_size: int = Query(100, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    """CONSUL_2 y CONSUL_21: acumulados de CONMAE y CONTERCE."""
    try:
        return list_annual_balances(cia, anio, mes, filter_type=filtro, account_search=cuenta, page=page, page_size=page_size)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/consultas/movimiento-anual-cuenta", summary="Movimiento anual por cuenta")
def annual_movement_by_account(
    cia: str = Query(pattern=r"^[0-9]{1,3}$"), anio: int = Query(ge=1900, le=2100),
    cuenta: str = Query(min_length=1, max_length=12, pattern=r"^[0-9]+$"),
    nit_desde: str = Query("", alias="nitDesde", max_length=15),
    nit_hasta: str = Query("", alias="nitHasta", max_length=15),
) -> dict[str, object]:
    """CONSUL_3: saldos y meses de la cuenta, con rango opcional de NIT."""
    try:
        return annual_account_summary(cia, anio, cuenta, nit_from=nit_desde, nit_to=nit_hasta)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/consultas/movimiento-anual-cuenta/detalle", summary="Detalle mensual de cuenta")
def annual_movement_by_account_detail(
    cia: str = Query(pattern=r"^[0-9]{1,3}$"), anio: int = Query(ge=1900, le=2100),
    mes: int = Query(ge=1, le=12), cuenta: str = Query(pattern=r"^[0-9]{1,12}$"),
    nit_desde: str = Query("", alias="nitDesde", max_length=15),
    nit_hasta: str = Query("", alias="nitHasta", max_length=15),
    page: int = Query(1, ge=1), page_size: int = Query(100, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    try:
        return annual_account_detail(cia, anio, mes, cuenta, nit_from=nit_desde, nit_to=nit_hasta, page=page, page_size=page_size)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/consultas/movimiento-anual-tercero", summary="Movimiento anual por tercero")
def annual_movement_by_third_party(
    cia: str = Query(pattern=r"^[0-9]{1,3}$"), anio: int = Query(ge=1900, le=2100),
    tercero: str = Query(min_length=1, max_length=15, pattern=r"^[0-9]+$"),
    cuenta_desde: str = Query("", alias="cuentaDesde", max_length=12),
    cuenta_hasta: str = Query("", alias="cuentaHasta", max_length=12),
) -> dict[str, object]:
    """CONSUL_4: movimiento de FADCLI/CONTERCE/MOV01."""
    try:
        return annual_third_party_summary(cia, anio, tercero, account_from=cuenta_desde, account_to=cuenta_hasta)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/consultas/movimiento-anual-tercero/detalle", summary="Detalle mensual de tercero")
def annual_movement_by_third_party_detail(
    cia: str = Query(pattern=r"^[0-9]{1,3}$"), anio: int = Query(ge=1900, le=2100),
    mes: int = Query(ge=1, le=12), tercero: str = Query(pattern=r"^[0-9]{1,15}$"),
    cuenta_desde: str = Query("", alias="cuentaDesde", max_length=12),
    cuenta_hasta: str = Query("", alias="cuentaHasta", max_length=12),
    page: int = Query(1, ge=1), page_size: int = Query(100, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    try:
        return annual_third_party_detail(cia, anio, mes, tercero, account_from=cuenta_desde, account_to=cuenta_hasta, page=page, page_size=page_size)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/consultas/movimiento-anual-centro", summary="Movimiento anual por centro de costo")
def annual_movement_by_cost_center(
    cia: str = Query(pattern=r"^[0-9]{1,3}$"), anio: int = Query(ge=1900, le=2100),
    centro: str = Query(min_length=1, max_length=7),
    cuenta_desde: str = Query("", alias="cuentaDesde", max_length=12),
    cuenta_hasta: str = Query("", alias="cuentaHasta", max_length=12),
) -> dict[str, object]:
    """CONSUL_5: saldos y meses del centro de costo."""
    try:
        return annual_cost_center_summary(cia, anio, centro, account_from=cuenta_desde, account_to=cuenta_hasta)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/consultas/movimiento-anual-centro/detalle", summary="Detalle mensual de centro de costo")
def annual_movement_by_cost_center_detail(
    cia: str = Query(pattern=r"^[0-9]{1,3}$"), anio: int = Query(ge=1900, le=2100),
    mes: int = Query(ge=1, le=12), centro: str = Query(min_length=1, max_length=7),
    cuenta_desde: str = Query("", alias="cuentaDesde", max_length=12),
    cuenta_hasta: str = Query("", alias="cuentaHasta", max_length=12),
    page: int = Query(1, ge=1), page_size: int = Query(100, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    try:
        return annual_cost_center_detail(cia, anio, mes, centro, account_from=cuenta_desde, account_to=cuenta_hasta, page=page, page_size=page_size)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/consultas/saldos-cuenta-centro/cuentas", summary="Saldos de cuentas por centro")
def account_cost_center_balances(
    cia: str = Query(pattern=r"^[0-9]{1,3}$"), anio: int = Query(ge=1900, le=2100),
    mes: int = Query(ge=1, le=18), buscar: str = Query("", max_length=60),
    page: int = Query(1, ge=1), page_size: int = Query(100, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    """CONSUL_7: saldos por cuenta y búsqueda por nombre o código."""
    try:
        return list_account_balances(cia, anio, mes, search=buscar, page=page, page_size=page_size)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/consultas/saldos-cuenta-centro/centros", summary="Centros de una cuenta")
def cost_centers_for_account(
    cia: str = Query(pattern=r"^[0-9]{1,3}$"), anio: int = Query(ge=1900, le=2100),
    mes: int = Query(ge=1, le=18), cuenta: str = Query(pattern=r"^[0-9]{1,12}$"),
) -> dict[str, object]:
    try:
        return list_centers_for_account(cia, anio, mes, cuenta)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/consultas/saldos-cuenta-centro/detalle", summary="Partidas por cuenta y centro")
def account_cost_center_detail(
    cia: str = Query(pattern=r"^[0-9]{1,3}$"), anio: int = Query(ge=1900, le=2100),
    mes: int = Query(ge=1, le=18), cuenta: str = Query(pattern=r"^[0-9]{1,12}$"),
    centro: str = Query(max_length=7), page: int = Query(1, ge=1),
    page_size: int = Query(100, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    try:
        return store.list_monthly_movements(cia, anio, mes, page=page, page_size=page_size, account_from=cuenta, account_to=cuenta, cost_center=centro)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/consultas/documento-especifico", summary="Documento propio o afectado")
def specific_document_endpoint(
    cia: str = Query(pattern=r"^[0-9]{1,3}$"), anio: int = Query(ge=1900, le=2100),
    mes: int = Query(ge=1, le=18), tipo_documento: str = Query(alias="tipoDocumento", min_length=1, max_length=2),
    documento: str = Query(min_length=1, max_length=12),
    buscar_por: Literal["propio", "afectado"] = Query("propio", alias="buscarPor"),
) -> dict[str, object]:
    """CONSUL_8: localiza el documento según TDOCUM o TDOCUM2."""
    try:
        return specific_document(cia, anio, mes, tipo_documento, documento, search_by=buscar_por)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/consultas/comparativos", summary="Comparar compañías, centros o meses")
def comparisons_endpoint(
    tipo: Literal["companias", "centros", "meses"], cia: str = Query(pattern=r"^[0-9]{1,3}$"),
    anio: int = Query(ge=1900, le=2100), mes_a: int = Query(alias="mesA", ge=1, le=12),
    cia_b: str = Query("", alias="ciaB", max_length=3), mes_b: int = Query(0, alias="mesB", ge=0, le=12),
    modo: Literal["saldo", "movimiento"] = Query("saldo"),
    cuenta_desde: str = Query("", alias="cuentaDesde", max_length=12),
    cuenta_hasta: str = Query("", alias="cuentaHasta", max_length=12),
    nit_desde: str = Query("", alias="nitDesde", max_length=15),
    nit_hasta: str = Query("", alias="nitHasta", max_length=15),
    centro_desde: str = Query("", alias="centroDesde", max_length=7),
    centro_hasta: str = Query("", alias="centroHasta", max_length=7),
    buscar: str = Query("", max_length=60), page: int = Query(1, ge=1),
    page_size: int = Query(100, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    """CONSULCO, CONSULCO2 y CONSULME con los filtros del legado."""
    try:
        return compare_values(tipo, cia, anio, mes_a, cia_b=cia_b, month_b=mes_b, mode=modo, account_from=cuenta_desde, account_to=cuenta_hasta, nit_from=nit_desde, nit_to=nit_hasta, center_from=centro_desde, center_to=centro_hasta, search=buscar, page=page, page_size=page_size)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/documentos", summary="Consultar cabeceras de documentos contabilizados")
def documents(
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, alias="pageSize", ge=1, le=100),
    periodo: str = Query("", max_length=7),
    comprobante: str = Query("", max_length=2),
    tipo_documento: str = Query("", alias="tipoDocumento", max_length=2),
    nit: str = Query("", max_length=15),
    fecha_desde: str = Query("", alias="fechaDesde", max_length=10),
    fecha_hasta: str = Query("", alias="fechaHasta", max_length=10),
    documento: str = Query("", max_length=12),
) -> dict[str, object]:
    """Lee CONDOCUM únicamente al recibir filtros confirmados por el usuario."""
    try:
        result = store.list_documents(
            cia,
            page=page,
            page_size=page_size,
            period=periodo,
            voucher=comprobante,
            document_type=tipo_documento,
            nit=nit,
            date_from=fecha_desde,
            date_to=fecha_hasta,
            document=documento,
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    return {**result, "source": "CONDOCUM", "sharedAcrossCompanies": False}


@app.get("/api/documentos/detalle", summary="Consultar las partidas de un documento")
def document_detail(
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
    documento: str = Query(min_length=1, max_length=12),
    comprobante: str = Query(min_length=1, max_length=6),
    tipo_documento: str = Query(alias="tipoDocumento", min_length=1, max_length=2),
    fecha: str = Query(min_length=10, max_length=10),
) -> dict[str, object]:
    """Relaciona la cabecera seleccionada con sus renglones almacenados en MOV01."""
    try:
        items = store.document_movements(
            cia,
            document=documento,
            voucher=comprobante,
            document_type=tipo_documento,
            movement_date=fecha,
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    return {
        "items": items,
        "count": len(items),
        "source": "MOV01",
        "sharedAcrossCompanies": False,
    }


@app.post("/api/documentos/anular", summary="Anular un documento contabilizado")
def annul_document_endpoint(
    request: DocumentAnnulmentRequest,
    dry_run: bool = Query(False, alias="dryRun"),
) -> dict[str, object]:
    """Retira cabecera y partidas, y reconstruye los acumulados afectados."""
    try:
        result = store.annul_document(
            request.cia,
            header_id=request.id,
            document=request.documento,
            voucher=request.comprobante,
            document_type=request.tipoDocumento,
            movement_date=request.fecha.isoformat(),
            user=request.usuario,
            reason=request.motivo,
            dry_run=dry_run,
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": result, "source": "Advantage Data Server", "dryRun": dry_run}


@app.get("/api/lotes", summary="Consultar lotes de la compañía activa")
def lots(
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    """Lista CONMOVI usando CIA como condición obligatoria."""
    try:
        result = store.list_lots(cia, page=page, page_size=page_size)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {**result, "source": "CONMOVI", "sharedAcrossCompanies": False}


@app.post("/api/importaciones/leer", summary="Leer un archivo de movimientos")
async def read_import_endpoint(
    archivo: UploadFile = File(...),
    hoja: str = Query("", max_length=100),
) -> dict[str, object]:
    """Lee XLSX, CSV o TXT y devuelve datos neutros para mapear en pantalla."""
    try:
        content = await archivo.read()
        item = read_import_file(archivo.filename or "", content, sheet_name=hoja)
    except Exception as exc:
        raise _service_error(exc) from exc
    finally:
        await archivo.close()
    return {"item": item}


@app.post("/api/importaciones/lote", summary="Validar o crear un lote desde una importación")
def import_lot_endpoint(
    request: ImportLotRequest,
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
    dry_run: bool = Query(False, alias="dryRun"),
) -> dict[str, object]:
    """Usa rollback al validar y conserva un Borrador únicamente al confirmar."""
    try:
        result = store.import_lot(cia, request.model_dump(), dry_run=dry_run)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": result, "dryRun": dry_run}


@app.get("/api/lotes/detalle", summary="Consultar las partidas de un lote")
def lot_detail(
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
    lote: str = Query(min_length=1, max_length=10),
    page: int = Query(1, ge=1),
    page_size: int = Query(200, alias="pageSize", ge=1, le=500),
) -> dict[str, object]:
    """Lee CONLOTES relacionando simultáneamente CIA y LOTE."""
    try:
        result = store.list_lot_lines(cia, lote, page=page, page_size=page_size)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {**result, "source": "CONLOTES", "sharedAcrossCompanies": False}


@app.post("/api/lotes", status_code=status.HTTP_201_CREATED, summary="Crear un lote contable")
def create_lot_endpoint(
    payload: LotWrite,
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Crea en CONMOVI un lote vacío listo para capturar partidas."""
    try:
        item = store.create_lot(cia, payload.model_dump())
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, "source": "CONMOVI"}


@app.put("/api/lotes/{lote}", summary="Modificar la cabecera de un lote")
def update_lot_endpoint(
    payload: LotWrite,
    lote: str = Path(min_length=1, max_length=10),
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    try:
        item = store.update_lot(cia, lote, payload.model_dump())
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, "source": "CONMOVI"}


@app.delete("/api/lotes/{lote}", summary="Eliminar un lote y sus partidas")
def delete_lot_endpoint(
    lote: str = Path(min_length=1, max_length=10),
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
    force: bool = Query(False, description="Segunda confirmación para lotes protegidos."),
) -> dict[str, object]:
    try:
        result = store.delete_lot(cia, lote, force=force)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": result}


@app.post("/api/lotes/{lote}/verificar", summary="Verificar consistencia de un lote")
def verify_lot_endpoint(
    lote: str = Path(min_length=1, max_length=10),
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    try:
        result = store.verify_lot(cia, lote)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": result}


@app.post("/api/lotes/{lote}/actualizar", summary="Contabilizar un lote verificado")
def post_lot_endpoint(
    payload: LotActionRequest,
    lote: str = Path(min_length=1, max_length=10),
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
    dry_run: bool = Query(False, alias="dryRun"),
) -> dict[str, object]:
    try:
        result = store.post_lot(cia, lote, user=payload.usuario, dry_run=dry_run)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": result}


@app.post(
    "/api/lotes/{lote}/detalle",
    status_code=status.HTTP_201_CREATED,
    summary="Agregar movimiento a un lote",
)
def create_lot_line_endpoint(
    payload: LotLineWrite,
    lote: str = Path(min_length=1, max_length=10),
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    try:
        item = store.save_lot_line(cia, lote, payload.model_dump())
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, "source": "CONLOTES"}


@app.put("/api/lotes/{lote}/detalle/{line_id}", summary="Modificar movimiento del lote")
def update_lot_line_endpoint(
    payload: LotLineWrite,
    lote: str = Path(min_length=1, max_length=10),
    line_id: int = Path(ge=1),
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    try:
        item = store.save_lot_line(cia, lote, payload.model_dump(), line_id=line_id)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, "source": "CONLOTES"}


@app.delete("/api/lotes/{lote}/detalle/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lot_line_endpoint(
    lote: str = Path(min_length=1, max_length=10),
    line_id: int = Path(ge=1),
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
) -> Response:
    try:
        store.delete_lot_line(cia, lote, line_id)
    except Exception as exc:
        raise _service_error(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/movimientos/contabilizar", summary="Contabilizar una captura directa en Advantage")
def post_movement(
    movement: DirectMovementPost,
    dry_run: bool = Query(
        False,
        alias="dryRun",
        description="Ejecuta todas las escrituras y finalmente hace rollback.",
    ),
) -> dict[str, object]:
    """Graba VISDOCUM, MOV01, CONMAE, CONTERCE, COCENTRO y CONDOCUM atómicamente."""
    try:
        result = store.post_direct_movement(movement.model_dump(), dry_run=dry_run)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": result, "source": "Advantage Data Server"}


@app.post("/api/reprocesos/mensual/simular", summary="Simular el reproceso mensual")
def simulate_monthly_reprocess_endpoint(request: MonthlyReprocessRequest) -> dict[str, object]:
    """Compara MOV01 contra CONMAE/CONTERCE sin efectuar escrituras."""
    try:
        result = store.simulate_monthly_reprocess(
            request.cia, request.anio, request.mesDesde, request.mesHasta
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": result, "source": "MOV01", "dryRun": True}


@app.post("/api/reprocesos/mensual/ejecutar", summary="Ejecutar el reproceso mensual")
def execute_monthly_reprocess_endpoint(
    request: MonthlyReprocessRequest,
    dry_run: bool = Query(False, alias="dryRun"),
) -> dict[str, object]:
    """Reemplaza acumulados mensuales en CONMAE y CONTERCE atómicamente."""
    try:
        result = store.execute_monthly_reprocess(
            request.cia,
            request.anio,
            request.mesDesde,
            request.mesHasta,
            user=request.usuario,
            reason=request.motivo,
            dry_run=dry_run,
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": result, "source": "Advantage Data Server", "dryRun": dry_run}


@app.get("/api/informes/balance-comprobacion", summary="Generar balance de comprobación acumulado")
def trial_balance(
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
    anio: int = Query(ge=1900, le=2100),
    mes_desde: int = Query(1, alias="mesDesde", ge=1, le=12),
    mes_hasta: int = Query(alias="mesHasta", ge=1, le=12),
    nivel: int = Query(6, ge=4, le=12),
    incluir_ceros: bool = Query(False, alias="incluirCeros"),
) -> dict[str, object]:
    """Lee los acumulados de CONMAE aplicando la lógica del informe Harbour."""
    try:
        return store.build_trial_balance(
            cia, anio, mes_desde, mes_hasta, level=nivel, include_zero=incluir_ceros,
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/informes/balance-comprobacion/exportar", summary="Exportar balance acumulado")
def export_trial_balance(
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
    anio: int = Query(ge=1900, le=2100),
    mes_desde: int = Query(1, alias="mesDesde", ge=1, le=12),
    mes_hasta: int = Query(alias="mesHasta", ge=1, le=12),
    nivel: int = Query(6, ge=4, le=12),
    incluir_ceros: bool = Query(False, alias="incluirCeros"),
    formato: Literal["xlsx", "pdf"] = Query(),
) -> Response:
    """Descarga el mismo resultado presentado en pantalla como XLSX o PDF."""
    try:
        report = store.build_trial_balance(
            cia, anio, mes_desde, mes_hasta, level=nivel, include_zero=incluir_ceros,
        )
        if formato == "xlsx":
            content = export_trial_balance_xlsx(report)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        else:
            content = export_trial_balance_pdf(report)
            media_type = "application/pdf"
    except Exception as exc:
        raise _service_error(exc) from exc
    filename = f"balance_comprobacion_{int(cia):03d}_{anio}_{mes_desde:02d}_{mes_hasta:02d}.{formato}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/informes/adicionales/{report_id}", summary="Generar informe contable adicional")
def additional_report_endpoint(
    report_id: str = Path(pattern=r"^[a-z0-9-]{1,50}$"),
    cia: str = Query(pattern=r"^[0-9]{1,3}$"),
    anio: int = Query(ge=1900, le=2100),
    mes_desde: int = Query(1, alias="mesDesde", ge=1, le=12),
    mes_hasta: int = Query(alias="mesHasta", ge=1, le=12),
    cuenta_desde: str = Query("", alias="cuentaDesde", max_length=12),
    cuenta_hasta: str = Query("", alias="cuentaHasta", max_length=12),
    nit: str = Query("", max_length=15),
      centro: str = Query("", max_length=7),
      comprobante: str = Query("", max_length=2),
      comprobante_hasta: str = Query("", alias="comprobanteHasta", max_length=2),
      tipo_documento: str = Query("", alias="tipoDocumento", max_length=2),
      tipo_documento_hasta: str = Query("", alias="tipoDocumentoHasta", max_length=2),
    documento_desde: str = Query("", alias="documentoDesde", max_length=12),
    documento_hasta: str = Query("", alias="documentoHasta", max_length=12),
    buscar: str = Query("", max_length=60),
    nivel: int = Query(6, ge=4, le=12),
    incluir_ceros: bool = Query(False, alias="incluirCeros"),
) -> dict[str, object]:
    """Lee Advantage con los parámetros originales; no modifica tablas."""
    try:
        return build_additional_report(
            report_id, cia, anio, mes_desde, mes_hasta,
            account_from=cuenta_desde, account_to=cuenta_hasta, nit=nit,
              center=centro, voucher=comprobante, voucher_to=comprobante_hasta,
              document_type=tipo_documento, document_type_to=tipo_documento_hasta,
            document_from=documento_desde, document_to=documento_hasta,
            search=buscar, level=nivel, include_zero=incluir_ceros,
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/informes/adicionales/{report_id}/exportar", summary="Exportar informe contable adicional")
def export_additional_report_endpoint(
    report_id: str = Path(pattern=r"^[a-z0-9-]{1,50}$"),
    formato: Literal["pdf", "xlsx", "csv"] = Query(),
    report: dict[str, object] = Depends(additional_report_endpoint),
) -> Response:
    """Reutiliza exactamente los filtros y datos de la consulta visible."""
    try:
        content = export_additional_report(report, formato)
    except Exception as exc:
        raise _service_error(exc) from exc
    media = {
        "pdf": "application/pdf",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "csv": "text/csv; charset=utf-8",
    }[formato]
    return Response(
        content=content, media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{report_id}_{report["anio"]}.{formato}"'},
    )


@app.get("/api/cuentas", summary="Listar cuentas maestras")
def accounts(
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Devuelve el catálogo, saldos y acumulados exclusivos de la CIA."""
    try:
        items = store.list_accounts(cia)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"items": items, "count": len(items), "source": "CONMAE"}


@app.post(
    "/api/cuentas",
    status_code=status.HTTP_201_CREATED,
    summary="Crear una cuenta maestra",
)
def add_account(
    account: AccountCreate,
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Registra una fila CONMAE con NIT maestro, saldo inicial cero y controles."""
    try:
        item = store.create_account(cia, account.model_dump())
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item}


@app.put("/api/cuentas/{codigo}", summary="Modificar una cuenta maestra")
def edit_account(
    account: AccountWrite,
    codigo: str = Path(pattern=r"^[0-9]{1,12}$"),
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Actualiza nombre y controles; el código y los saldos permanecen intactos."""
    try:
        item = store.update_account(cia, codigo, account.model_dump())
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item}
