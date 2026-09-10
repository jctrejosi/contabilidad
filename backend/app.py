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

from fastapi import FastAPI, HTTPException, Path, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field

from .ads_repository import (
    AccountAlreadyExists,
    AccountNotFound,
    AdsConfigurationError,
    CompanyNotFound,
    check_connection,
    create_account,
    list_companies,
    list_accounts,
    update_account,
)
from .terceros_repository import list_third_parties
from .centros_repository import list_cost_centers
from .tipos_documento_repository import list_document_types
from .comprobantes_repository import list_vouchers
from .movimiento_mensual_repository import list_monthly_movements
from .documentos_repository import document_movements, list_documents
from .lotes_repository import list_lot_lines, list_lots
from .contabilizacion_repository import (
    PostingConflict,
    PostingValidationError,
    get_accounting_period,
    post_direct_movement,
)
from .balance_comprobacion_repository import (
    build_trial_balance,
    export_trial_balance_pdf,
    export_trial_balance_xlsx,
)
from .reproceso_mensual_repository import (
    execute_monthly_reprocess,
    simulate_monthly_reprocess,
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


def _service_error(exc: Exception) -> HTTPException:
    """Convierte errores de dominio/ADS en respuestas HTTP estables y seguras."""
    if isinstance(exc, AccountAlreadyExists):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, PostingConflict):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, (AccountNotFound, CompanyNotFound)):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (ValueError, PostingValidationError)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    if isinstance(exc, AdsConfigurationError):
        logger.error("Configuracion ADS no disponible: %s", exc)
    else:
        logger.exception("Fallo al operar con Advantage Data Server")
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="No fue posible comunicarse con Advantage Data Server.",
    )


@app.get("/api/health", summary="Validar conexión con Advantage")
def health() -> dict[str, str]:
    """Comprueba que ADO puede abrir ADS y leer la tabla CONMAE."""
    try:
        check_connection()
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"status": "ok", "database": "Advantage Data Server", "table": "CONMAE"}


@app.get("/api/companias", summary="Listar compañías disponibles")
def companies() -> dict[str, object]:
    """Devuelve CONEMP para que el usuario elija la compañía de la sesión."""
    try:
        items = list_companies()
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"items": items, "count": len(items), "source": "CONEMP"}


@app.get("/api/terceros", summary="Consultar el directorio global de terceros")
def third_parties(
    page: int = Query(1, ge=1, description="Página solicitada."),
    page_size: int = Query(100, alias="pageSize", ge=1, le=200),
    q: str = Query("", max_length=60, description="Código, nombre o ciudad."),
    estado: Literal["todos", "activo", "bloqueado"] = Query("todos"),
) -> dict[str, object]:
    """Pagina FADCLI en Advantage; el maestro es común a todas las compañías."""
    try:
        result = list_third_parties(page=page, page_size=page_size, search=q, state=estado)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {**result, "source": "FADCLI", "sharedAcrossCompanies": True}


@app.get("/api/centros", summary="Consultar centros de costo por compañía")
def cost_centers(
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Lee CONCECOS usando siempre la compañía activa como parte de la clave."""
    try:
        items = list_cost_centers(cia)
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
        items = list_document_types()
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
        items = list_vouchers(cia)
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
        item = get_accounting_period(cia)
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
        result = list_monthly_movements(
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
        result = list_documents(
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
        items = document_movements(
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


@app.get("/api/lotes", summary="Consultar lotes de la compañía activa")
def lots(
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    """Lista CONMOVI usando CIA como condición obligatoria."""
    try:
        result = list_lots(cia, page=page, page_size=page_size)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {**result, "source": "CONMOVI", "sharedAcrossCompanies": False}


@app.get("/api/lotes/detalle", summary="Consultar las partidas de un lote")
def lot_detail(
    cia: str = Query(description="Compañía activa.", pattern=r"^[0-9]{1,3}$"),
    lote: str = Query(min_length=1, max_length=10),
    page: int = Query(1, ge=1),
    page_size: int = Query(200, alias="pageSize", ge=1, le=500),
) -> dict[str, object]:
    """Lee CONLOTES relacionando simultáneamente CIA y LOTE."""
    try:
        result = list_lot_lines(cia, lote, page=page, page_size=page_size)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {**result, "source": "CONLOTES", "sharedAcrossCompanies": False}


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
        result = post_direct_movement(movement.model_dump(), dry_run=dry_run)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": result, "source": "Advantage Data Server"}


@app.post("/api/reprocesos/mensual/simular", summary="Simular el reproceso mensual")
def simulate_monthly_reprocess_endpoint(request: MonthlyReprocessRequest) -> dict[str, object]:
    """Compara MOV01 contra CONMAE/CONTERCE sin efectuar escrituras."""
    try:
        result = simulate_monthly_reprocess(
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
        result = execute_monthly_reprocess(
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
        return build_trial_balance(
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
        report = build_trial_balance(
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


@app.get("/api/cuentas", summary="Listar cuentas maestras")
def accounts(
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Devuelve el catálogo, saldos y acumulados exclusivos de la CIA."""
    try:
        items = list_accounts(cia)
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
        item = create_account(cia, account.model_dump())
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
        item = update_account(cia, codigo, account.model_dump())
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item}
