"""API HTTP de CONTABDSI para la función Plan de cuentas.

La capa HTTP valida el contrato recibido desde React y delega toda operación
con Advantage Data Server a ``ads_repository``. Aquí no se escriben consultas
SQL ni se conocen credenciales.
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import FastAPI, HTTPException, Path, Query, status
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


def _service_error(exc: Exception) -> HTTPException:
    """Convierte errores de dominio/ADS en respuestas HTTP estables y seguras."""
    if isinstance(exc, AccountAlreadyExists):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, (AccountNotFound, CompanyNotFound)):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, ValueError):
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
