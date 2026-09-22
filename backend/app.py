"""API HTTP de CONTABDSI para la función Plan de cuentas.

La capa HTTP valida el contrato recibido desde React y delega toda operación
con Advantage Data Server a ``ads_repository``. Aquí no se escriben consultas
SQL ni se conocen credenciales.
"""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Annotated, Any, Literal

from fastapi import Depends, FastAPI, File, HTTPException, Path, Query, Response, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, model_validator

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
    ThirdPartyConflict,
    ThirdPartyNotFound,
    ThirdPartyValidationError,
)
from .centros_repository import (
    CostCenterAlreadyExists,
    CostCenterNotFound,
    CostCenterValidationError,
)
from .comprobantes_repository import (
    VoucherAlreadyExists,
    VoucherNotFound,
    VoucherValidationError,
)
from .tipos_documento_repository import (
    DocumentTypeAlreadyExists,
    DocumentTypeNotFound,
    DocumentTypeValidationError,
)
from .companias_repository import (
    CompanyAlreadyExists,
    CompanyConflict,
    CompanyValidationError,
    CompanyWriteNotImplemented,
)
from .tarifas_iva_repository import (
    VatRateAlreadyExists,
    VatRateConflict,
    VatRateNotFound,
    VatRateValidationError,
)
from .conceptos_retencion_repository import (
    RetentionConceptAlreadyExists,
    RetentionConceptConflict,
    RetentionConceptNotFound,
    RetentionConceptValidationError,
)
from .renglones_renta_repository import (
    IncomeLineAlreadyExists,
    IncomeLineConflict,
    IncomeLineNotFound,
    IncomeLineValidationError,
)
from .plantillas_contables_repository import (
    TemplateAlreadyExists,
    TemplateConflict,
    TemplateNotFound,
    TemplateValidationError,
)
from .formatos_documentales_repository import (
    DocumentFormatAlreadyExists,
    DocumentFormatNotFound,
    DocumentFormatValidationError,
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
from .informes_adicionales_repository import export_additional_report
from .reproceso_mensual_repository import (
    MonthlyReprocessValidationError,
)
from .parametros_operacion_repository import (
    OperationParametersValidationError,
)
from .impuestos_repository import (
    AccumulationConflict,
    AccumulationValidationError,
    MediumConflict,
    MediumNotFound,
    MediumValidationError,
    TaxFormatAlreadyExists,
    TaxFormatConflict,
    TaxFormatNotFound,
    TaxFormatValidationError,
    TaxLegacyNotSupported,
    build_acumulado_export,
)
from .consolidacion_repository import (
    ConsolidacionConflict,
    ConsolidacionLegacyNotSupported,
    ConsolidacionNotFound,
    ConsolidacionPendiente,
    ConsolidacionValidationError,
)
from .flujo_caja_niif_repository import (
    CashFlowConflict,
    CashFlowLegacyNotSupported,
    CashFlowValidationError,
    NiifConflict,
    NiifLegacyNotSupported,
    NiifValidationError,
)
from .cierres_repository import (
    CierreConflict,
    CierreNotFound,
    CierreValidationError,
    CierresLegacyNotSupported,
)
from .administracion_repository import (
    AdminConflict,
    AdminLegacyNotSupported,
    AdminNotFound,
    AdminValidationError,
)
from .mantenimiento_repository import (
    MaintenanceConflict,
    MaintenanceLegacyNotSupported,
    MaintenanceNotFound,
    MaintenanceValidationError,
)
from .especiales_repository import (
    EspecialesConflict,
    EspecialesLegacyNotSupported,
    EspecialesNotFound,
    EspecialesValidationError,
)
from .reembolsos_repository import (
    RefundConflict,
    RefundLegacyNotSupported,
    RefundNotFound,
    RefundValidationError,
)
from .reasignacion_repository import (
    ReassignmentConflict,
    ReassignmentLegacyNotSupported,
    ReassignmentNotFound,
    ReassignmentValidationError,
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
    clasificacionCorriente: str | None = Field(
        None,
        max_length=30,
        description=(
            "Clasificación corriente/no corriente de la cuenta "
            "(cuentas.clasificacion_corriente, CONMAE.CTCTABASE). Aditivo y opcional: "
            "omitirlo conserva la clasificación vigente."
        ),
    )
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


class ThirdPartyWrite(BaseModel):
    """Campos de la ficha del tercero autorizados a modificar (B1.1).

    Son los mismos de ``ThirdPartyCreate`` menos ``nit`` —que es la clave y llega
    por la ruta, no por el cuerpo—, más ``estado`` y ``motivoBloqueo``. El NIT
    inmutable se garantiza con ``extra="forbid"``: enviarlo devuelve 422.
    """

    model_config = ConfigDict(extra="forbid")

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
    estado: Literal["Activo", "Bloqueado"] = Field(
        "Activo", description="Bloqueado exige motivoBloqueo (FADCLI.CESTADO/CMOTIVO)."
    )
    motivoBloqueo: str = Field("", max_length=30, description="FADCLI.CMOTIVO.")

    @model_validator(mode="after")
    def _blocked_requires_reason(self) -> "ThirdPartyWrite":
        """Un bloqueo sin causa no es auditable: se rechaza antes de escribir."""
        if self.estado == "Bloqueado" and not self.motivoBloqueo.strip():
            raise ValueError("Indique el motivo del bloqueo.")
        return self


class ThirdPartyImportRow(ThirdPartyWrite):
    """Fila de la importación: el contrato de escritura más la identificación.

    B1.4 nombra ``ThirdPartyWrite`` para ``filas``, pero ese modelo excluye
    ``nit`` por definición (es el cuerpo del ``PUT``, donde la clave va en la
    ruta) y ``normalize_third_party`` lo exige para poder dar el alta, así que la
    fila vuelve a traerlo.
    """

    nit: str = Field(pattern=r"^[0-9]{1,10}$")


class ThirdPartyCreditLimit(BaseModel):
    """Cupo de cartera del tercero y motivo opcional del cambio (B1.3)."""

    model_config = ConfigDict(extra="forbid")

    cupo: Decimal = Field(Decimal("0"), ge=0, decimal_places=2)
    motivo: str = Field("", max_length=180)


class ThirdPartyImportRequest(BaseModel):
    """Archivo ya leído, mapeo confirmado y filas interpretadas (B1.4).

    Reproduce la forma de ``ImportLotRequest``: la interfaz lee el archivo con
    `POST /api/importaciones/leer`, el usuario confirma el mapeo y este contrato
    recibe las filas ya normalizadas más el mapeo usado, para la bitácora.
    """

    model_config = ConfigDict(extra="forbid")

    archivo: str = Field(min_length=1, max_length=255)
    hoja: str = Field("", max_length=100)
    mapeo: dict[str, str] = Field(min_length=1, description="Columna del archivo contra campo del contrato.")
    filas: list[ThirdPartyImportRow] = Field(min_length=1, max_length=5000)


class CostCenterCreate(BaseModel):
    """Alta de un centro de costo de la compañía activa (B2.1).

    ``codigo`` respeta el ancho de ``CONCECOS.CODIGO`` y ``centroPadre`` la
    jerarquía derivada del prefijo de dos caracteres. La parametrización
    reproduce los campos que la pantalla ``CentroJerarquico`` ya declara.
    """

    model_config = ConfigDict(extra="forbid")

    codigo: str = Field(pattern=r"^[A-Za-z0-9]{1,7}$")
    nombre: str = Field(min_length=1, max_length=40)
    centroPadre: str = Field("", pattern=r"^[A-Za-z0-9]{1,7}$|^$")
    hist: str = Field("", max_length=10)
    tipo: int = Field(0, ge=0, le=99)
    valor: Decimal = Field(Decimal("0"), ge=0, decimal_places=2)
    porcentaje: Decimal = Field(Decimal("0"), ge=0, decimal_places=6)
    codigoItem: str = Field("", max_length=20)
    cuenta: str = Field("", pattern=r"^[0-9]{0,12}$")
    concepto: str = Field("", max_length=60)


class VoucherCreate(BaseModel):
    """Alta de un comprobante de la compañía activa (B2.2).

    ``codigo`` usa el ancho real de ``CONTICOM`` (dos caracteres) y
    ``descripcionAuxiliar`` es ``CONTICOM.CTABDES``.
    """

    model_config = ConfigDict(extra="forbid")

    codigo: str = Field(pattern=r"^[A-Za-z0-9]{1,2}$")
    nombre: str = Field(min_length=1, max_length=40)
    descripcionAuxiliar: str = Field("", max_length=40)


class DocumentTypeCreate(BaseModel):
    """Alta de un tipo de documento de la compañía activa (B2.3).

    ``numeracion`` es la única llave de estado que afecta la contabilización;
    el resto reproduce los atributos que ``13_campos_contrato.sql`` modela sobre
    ``VISDOCUM``.
    """

    model_config = ConfigDict(extra="forbid")

    codigo: str = Field(pattern=r"^[A-Za-z0-9]{1,2}$")
    nombre: str = Field(min_length=1, max_length=40)
    numeracion: Literal["Manual", "Automatica"] = "Manual"
    terceroObligatorio: bool = False
    centroObligatorio: bool = False
    modulo: int | None = Field(None, ge=0, le=99)
    naturaleza: str = Field("", max_length=10)
    prefijo: str = Field("", max_length=10)
    comprobante: str = Field("", pattern=r"^[A-Za-z0-9]{0,2}$")
    generaContabilizacion: bool = True
    permiteConversion: bool = False
    conversionCodigo: str = Field("", max_length=10)


class CompanyCreate(BaseModel):
    """Alta de una compañía con su primer año de operación (B3.1).

    ``codigo`` usa las 3 posiciones de ``EMPCOD`` y ``anio`` el rango de
    ``compania_anios``. El código viaja sin ceros: el modelo lo guarda así y el
    ``GET`` lo vuelve a presentar con 3 posiciones.
    """

    model_config = ConfigDict(extra="forbid")

    codigo: str = Field(pattern=r"^[0-9]{1,3}$", description="EMPCOD de 3 posiciones.")
    nombre: str = Field(min_length=1, max_length=40)
    nit: str = Field(min_length=1, max_length=15)
    digito: str = Field("", pattern=r"^[0-9]?$", max_length=1)
    soloConsolidacion: bool = Field(False, description="Destino de consolidación.")
    anio: int = Field(ge=1900, le=2999, description="Primer año de operación.")
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field("", max_length=180)


class CompanyWrite(BaseModel):
    """Modificación de la ficha de la compañía (B3.3).

    El código no forma parte del cuerpo: es la clave inmutable de la ruta, y
    ``extra="forbid"`` hace que enviarlo devuelva 422.
    """

    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(min_length=1, max_length=40)
    nit: str = Field(min_length=1, max_length=15)
    digito: str = Field("", pattern=r"^[0-9]?$", max_length=1)
    estado: Literal["Activa", "Inactiva"] = "Activa"
    soloConsolidacion: bool = False
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field("", max_length=180)


class VatRateWrite(BaseModel):
    """Campos de ``tarifas_iva`` que comparten el alta y la modificación (B3).

    ``tarifa`` viaja como **fracción** con los límites del dominio ``porcentaje``:
    19 % es ``0.19``. Enviar ``19`` devuelve 422.
    """

    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(min_length=1, max_length=40)
    tarifa: Decimal = Field(ge=0, le=1, decimal_places=6)
    cuenta: str = Field("", pattern=r"^[0-9]{0,12}$")
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field("", max_length=180)


class VatRateCreate(VatRateWrite):
    """Alta de una tarifa; agrega el código, que es la clave inmutable."""

    codigo: str = Field(pattern=r"^[A-Za-z0-9]{1,10}$")


class RetentionConceptWrite(BaseModel):
    """Campos de ``conceptos_retencion`` comunes al alta y a la modificación (B3).

    ``cuenta`` llega opcional, como en la tabla, pero la pantalla la exige al
    confirmar: sin cuenta la operación responde 422 (regla de B3, sección 3.2).
    """

    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(min_length=1, max_length=40)
    tarifa: Decimal = Field(ge=0, le=1, decimal_places=6)
    cuenta: str = Field("", pattern=r"^[0-9]{0,12}$")
    baseMinima: Decimal = Field(Decimal("0"), ge=0, decimal_places=2)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field("", max_length=180)


class RetentionConceptCreate(RetentionConceptWrite):
    """Alta de un concepto de retención; agrega el código inmutable."""

    codigo: str = Field(pattern=r"^[A-Za-z0-9]{1,10}$")


class IncomeLineWrite(BaseModel):
    """Campos de ``renglones_renta`` comunes al alta y a la modificación (B3).

    ``signo`` es 1 o -1 y ``cuenta`` es obligatoria: sin cuenta el renglón no se
    puede calcular.
    """

    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(min_length=1, max_length=60)
    cuenta: str = Field(pattern=r"^[0-9]{1,12}$")
    signo: Literal[1, -1] = 1
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field("", max_length=180)


class IncomeLineCreate(IncomeLineWrite):
    """Alta de un renglón de renta; agrega el código inmutable."""

    codigo: str = Field(pattern=r"^[A-Za-z0-9]{1,10}$")


class TemplateLineWrite(BaseModel):
    """Pareja de cuentas de una plantilla contable (B3, sección 5).

    Cada línea son **dos cuentas** (débito y crédito), no un importe fijo: es la
    corrección B09 del modelo y lo que guarda cada posición de ``VISDOCUM``
    (``db/postgresql/schema/03_maestros.sql:234-237``).
    """

    model_config = ConfigDict(extra="forbid")

    orden: int = Field(1, ge=1, le=999)
    cuentaDebito: str = Field(pattern=r"^[0-9]{1,12}$")
    cuentaCredito: str = Field(pattern=r"^[0-9]{1,12}$")
    concepto: str = Field("", max_length=60)


class TemplateWrite(BaseModel):
    """Campos de ``plantillas_contables`` comunes al alta y a la modificación (B3).

    ``lineas`` exige **dos** como mínimo: una plantilla de una sola línea no puede
    cuadrar (regla de B3, sección 5.2).
    """

    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(min_length=1, max_length=40)
    tipoDocumento: str = Field(pattern=r"^[A-Za-z0-9]{1,2}$")
    lineas: list[TemplateLineWrite] = Field(min_length=2, max_length=80)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field("", max_length=180)


class TemplateCreate(TemplateWrite):
    """Alta de una plantilla; agrega el código, que es la clave inmutable."""

    codigo: str = Field(pattern=r"^[A-Za-z0-9]{1,10}$")


class FormatElementWrite(BaseModel):
    """Elemento del editor visual de impresión (B3, sección 6).

    ``tipo`` es uno de los ocho del ``CHECK`` de ``formato_elementos`` y ``x``/``y``
    van en la unidad del editor, decimal de dos posiciones
    (``db/postgresql/schema/03_maestros.sql:280-293``).
    """

    model_config = ConfigDict(extra="forbid")

    tipo: Literal[
        "Leyenda", "Imagen", "Rectangulo", "Linea",
        "CampoComprobante", "CampoDocumento", "CampoFecha", "CampoTotal",
    ]
    contenido: str = Field("", max_length=200)
    x: Decimal = Field(Decimal("0"), ge=0, le=Decimal("99999999.99"), decimal_places=2)
    y: Decimal = Field(Decimal("0"), ge=0, le=Decimal("99999999.99"), decimal_places=2)
    ancho: Decimal | None = Field(None, ge=0, le=Decimal("99999999.99"), decimal_places=2)
    alto: Decimal | None = Field(None, ge=0, le=Decimal("99999999.99"), decimal_places=2)
    fuente: str = Field("", max_length=40)
    orden: int = Field(0, ge=0, le=9999)


class DocumentFormatWrite(BaseModel):
    """Campos de ``formatos_documentales`` comunes al alta y a la modificación (B3)."""

    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(min_length=1, max_length=40)
    comprobante: str = Field("", pattern=r"^[A-Za-z0-9]{0,2}$")
    elementos: list[FormatElementWrite] = Field(min_length=1, max_length=200)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field("", max_length=180)


class DocumentFormatCreate(DocumentFormatWrite):
    """Alta de un formato; agrega el código, que es la clave inmutable."""

    codigo: str = Field(pattern=r"^[A-Za-z0-9]{1,10}$")


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


# ---------------------------------------------------------------------------
# Bloque D1 · Impuestos (R6: extra="forbid", límites, alias camelCase)
# ---------------------------------------------------------------------------
class AccumulationRequest(BaseModel):
    """Rango y trazabilidad de la acumulación de IVA o de retenciones (1.2 y 1.5).

    ``motivo`` es obligatorio porque la acumulación reescribe la base de una
    declaración (R7); ``dryRun`` viaja como consulta, no en el cuerpo.
    """

    model_config = ConfigDict(extra="forbid")

    anio: int = Field(ge=1900, le=2100)
    mesDesde: int = Field(ge=1, le=12)
    mesHasta: int = Field(ge=1, le=12)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)

    @model_validator(mode="after")
    def _rango(self) -> "AccumulationRequest":
        if self.mesDesde > self.mesHasta:
            raise ValueError("El mes inicial no puede ser mayor que el mes final.")
        return self


class ExogenousFormatWrite(BaseModel):
    """Nombre, vigencia y estado de un formato de exógena (2.2)."""

    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(min_length=1, max_length=60)
    vigencia: int = Field(ge=1900, le=2100)
    activo: bool = True
    usuario: str = Field("WEB", min_length=1, max_length=4)


class ExogenousFormatCreate(ExogenousFormatWrite):
    """Alta de un formato: agrega el código, que es la clave inmutable."""

    codigo: str = Field(pattern=r"^[A-Za-z0-9]{1,10}$")


class ExogenousFormatUpdate(BaseModel):
    """Modificación de un formato (2.3): el código y la vigencia son la clave.

    ``vigencia`` es opcional; si llega y no coincide con la de la consulta, la
    operación responde 409 (la vigencia no se puede cambiar desde esta ruta).
    """

    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(min_length=1, max_length=60)
    activo: bool = True
    vigencia: int | None = Field(None, ge=1900, le=2100)
    usuario: str = Field("WEB", min_length=1, max_length=4)


class FormatConceptWrite(BaseModel):
    """Un concepto de exógena con su tarifa (fracción) y su cuenta (2.5)."""

    model_config = ConfigDict(extra="forbid")

    codigo: str = Field(pattern=r"^[A-Za-z0-9]{1,10}$")
    nombre: str = Field(min_length=1, max_length=60)
    tarifa: Decimal = Field(Decimal("0"), ge=0, le=1, decimal_places=6)
    cuenta: str = Field("", pattern=r"^[0-9]{0,12}$")


class FormatConceptList(BaseModel):
    """Reemplazo en bloque de los conceptos de un formato (2.5)."""

    model_config = ConfigDict(extra="forbid")

    conceptos: list[FormatConceptWrite] = Field(max_length=200)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)


class FormatAssignmentList(BaseModel):
    """Reemplazo en bloque de las cuentas asignadas a un formato (2.6)."""

    model_config = ConfigDict(extra="forbid")

    cuentas: list[str] = Field(max_length=2000)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)


class FormatCopyRequest(BaseModel):
    """Copia de definiciones de exógena de otra compañía (2.7)."""

    model_config = ConfigDict(extra="forbid")

    ciaOrigen: str = Field(pattern=r"^[0-9]{1,3}$")
    vigenciaOrigen: int = Field(ge=1900, le=2100)
    vigenciaDestino: int = Field(ge=1900, le=2100)
    formatos: list[str] | None = Field(None, max_length=200)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)
    reemplazar: bool = False


class MediumGenerationRequest(BaseModel):
    """Generación del medio magnético del año (3.2)."""

    model_config = ConfigDict(extra="forbid")

    anio: int = Field(ge=1900, le=2100)
    vigencia: int = Field(ge=1900, le=2100)
    formatos: list[str] | None = Field(None, max_length=200)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)


class MediumRowWrite(BaseModel):
    """Ajuste de una fila revisada del medio (3.4); el motivo es obligatorio."""

    model_config = ConfigDict(extra="forbid")

    valor: Decimal | None = Field(None, ge=0, decimal_places=2)
    base: Decimal | None = Field(None, ge=0, decimal_places=2)
    concepto: str | None = Field(None, max_length=10)
    motivo: str = Field(min_length=5, max_length=180)
    usuario: str = Field("WEB", min_length=1, max_length=4)


class MediumCapWrite(BaseModel):
    """Un tope por formato y concepto (3.6)."""

    model_config = ConfigDict(extra="forbid")

    formato: str = Field(pattern=r"^[A-Za-z0-9]{1,10}$")
    concepto: str = Field("", max_length=10)
    tope: Decimal = Field(ge=0, decimal_places=2)


class MediumCapList(BaseModel):
    """Reemplazo en bloque de los topes del año (3.6)."""

    model_config = ConfigDict(extra="forbid")

    anio: int = Field(ge=1900, le=2100)
    topes: list[MediumCapWrite] = Field(max_length=500)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)


# ---------------------------------------------------------------------------
# Bloque D3 · Consolidación (R6: extra="forbid", límites, alias camelCase)
# ---------------------------------------------------------------------------
class CiaInclude(BaseModel):
    """Compañía origen de una consolidación y si entra en ella (2.2)."""

    model_config = ConfigDict(extra="forbid")

    cia: str = Field(pattern=r"^[0-9]{1,3}$", description="Código EMPCOD del origen.")
    incluida: bool = Field(True, description="El origen entra en la consolidación.")


class AccountEquivalence(BaseModel):
    """Correspondencia cuenta origen → cuenta destino, con su signo (2.2)."""

    model_config = ConfigDict(extra="forbid")

    ciaOrigen: str = Field(pattern=r"^[0-9]{1,3}$")
    cuentaOrigen: str = Field(pattern=r"^[0-9]{1,12}$")
    cuentaDestino: str = Field(pattern=r"^[0-9]{1,12}$")
    signo: Literal[-1, 1] = Field(1, description="1 conserva el signo; -1 lo invierte.")


class CenterEquivalence(BaseModel):
    """Correspondencia centro de costo origen → destino (2.2)."""

    model_config = ConfigDict(extra="forbid")

    ciaOrigen: str = Field(pattern=r"^[0-9]{1,3}$")
    centroOrigen: str = Field(pattern=r"^[A-Za-z0-9]{1,7}$")
    centroDestino: str = Field(pattern=r"^[A-Za-z0-9]{1,7}$")


class ConsolidationWrite(BaseModel):
    """Configuración de una consolidación: destino, orígenes y homologaciones (2.2).

    ``destino`` es la compañía de la consulta (``cia``); el año y las listas van
    en el cuerpo. ``origenes`` exige al menos uno (``min_length=1``) y ``motivo``
    es obligatorio porque la configuración se audita (R7).
    """

    model_config = ConfigDict(extra="forbid")

    anio: int = Field(ge=1900, le=2999)
    origenes: list[CiaInclude] = Field(min_length=1, max_length=50)
    cuentas: list[AccountEquivalence] = Field(default_factory=list, max_length=5000)
    centros: list[CenterEquivalence] = Field(default_factory=list, max_length=2000)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)

    @model_validator(mode="after")
    def _origenes_sin_repetir(self) -> "ConsolidationWrite":
        """Un origen repetido no es una consolidación válida: se rechaza antes de escribir."""
        numeros = [int(origen.cia) for origen in self.origenes]
        if len(numeros) != len(set(numeros)):
            raise ValueError("Una compañía origen no puede aparecer dos veces.")
        return self


class ConsolidationAction(BaseModel):
    """Usuario y motivo de una acción de proceso sobre la consolidación (2.4)."""

    model_config = ConfigDict(extra="forbid")

    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)


class ConsolidationExecution(BaseModel):
    """Respaldo y confirmación de vaciado de la ejecución (2.5)."""

    model_config = ConfigDict(extra="forbid")

    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)
    respaldoRealizado: bool = Field(
        description="El respaldo se realizó antes de ejecutar (07_procesos.sql:77)."
    )
    confirmacionVaciado: bool = Field(
        False, description="Se confirma el vaciado del destino (07_procesos.sql:78)."
    )


# ---------------------------------------------------------------------------
# Bloque A5 · Informes: flujo de caja y rubros NIIF (R6: extra="forbid", límites)
# ---------------------------------------------------------------------------
AccountCode = Annotated[str, Field(pattern=r"^[0-9]{1,12}$")]
NiifType = Literal[
    "Activo Corriente", "Activo No Corriente", "Pasivo Corriente", "Pasivo No Corriente",
    "Patrimonio", "Ingreso", "Costo", "Gasto", "Orden",
]


class CashFlowLine(BaseModel):
    """Un renglón de la definición del flujo de caja (§2).

    ``signo`` usa la convención de ``renglones_renta.signo``: 1 suma y -1 resta
    al total del grupo. El ``orden`` fija la presentación dentro del grupo.
    """

    model_config = ConfigDict(extra="forbid")

    codigo: str = Field(pattern=r"^[A-Za-z0-9]{1,10}$")
    nombre: str = Field(min_length=1, max_length=60)
    grupo: Literal["Operacion", "Inversion", "Financiacion"]
    orden: int = Field(0, ge=0, le=9999)
    cuenta: AccountCode
    signo: Literal[-1, 1]


class CashFlowDefinition(BaseModel):
    """Reemplazo completo de la definición del flujo de caja (§2)."""

    model_config = ConfigDict(extra="forbid")

    anio: int = Field(ge=1900, le=2100)
    renglones: list[CashFlowLine] = Field(min_length=1, max_length=200)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)


class NiifGroup(BaseModel):
    """Un rubro NIIF con las cuentas del plan asignadas (§4)."""

    model_config = ConfigDict(extra="forbid")

    codigo: str = Field(pattern=r"^[A-Za-z0-9-]{1,10}$")
    nombre: str = Field(min_length=1, max_length=60)
    informe: Literal["ESFA", "ER"]
    tipo: NiifType
    orden: int = Field(0, ge=0, le=9999)
    cuentas: list[AccountCode] = Field(default_factory=list, max_length=5000)


class NiifClassification(BaseModel):
    """Reemplazo completo de los rubros NIIF y sus asignaciones (§4)."""

    model_config = ConfigDict(extra="forbid")

    anio: int = Field(ge=1900, le=2100)
    rubros: list[NiifGroup] = Field(min_length=1, max_length=200)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)


# ---------------------------------------------------------------------------
# Bloque D2 · Cierres (R6: extra="forbid", alias camelCase y límites)
# ---------------------------------------------------------------------------
class CloseRequest(BaseModel):
    """Cuerpo de la apertura del cierre (1.2)."""

    model_config = ConfigDict(extra="forbid")

    anio: int = Field(ge=1900, le=2100)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)


class CierreLotActionRequest(BaseModel):
    """Cuerpo del lote de cierre (1.3): período y cuenta de resultado."""

    model_config = ConfigDict(extra="forbid")

    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)
    mes: str = Field(
        pattern=r"^(0[0-9]|1[0-8])$",
        description="Período del asiento de cierre (00..18).",
    )
    cuentaResultado: str = Field(
        pattern=r"^[0-9]{1,12}$",
        description="Cuenta de resultado que recibe el cierre (07_procesos.sql:42).",
    )


class TransferLine(BaseModel):
    """Una línea del asistente de traslado de períodos (1.4)."""

    model_config = ConfigDict(extra="forbid")

    origenPeriodo: str = Field(pattern=r"^(0[0-9]|1[0-8])$")
    destinoPeriodo: str = Field(pattern=r"^(0[0-9]|1[0-8])$")
    cuenta: str = Field(pattern=r"^[0-9]{1,12}$")
    nit: str = Field("", max_length=11, description="Tercero, si la cuenta lo controla.")
    centro: str = Field("", max_length=7, description="Centro de costo, si la cuenta lo controla.")
    debito: float = Field(0, ge=0)
    credito: float = Field(0, ge=0)


class CloseTransferRequest(BaseModel):
    """Cuerpo del traslado de períodos (1.4)."""

    model_config = ConfigDict(extra="forbid")

    traslados: list[TransferLine] = Field(min_length=1, max_length=5000)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)
    confirmacion: str = Field(
        min_length=1, max_length=20,
        description="Debe ser el texto literal TRASLADAR.",
    )


def _service_error(exc: Exception) -> HTTPException:
    """Convierte errores de dominio/ADS en respuestas HTTP estables y seguras."""
    if isinstance(
        exc,
        (
            AccountAlreadyExists,
            ThirdPartyAlreadyExists,
            CostCenterAlreadyExists,
            VoucherAlreadyExists,
            DocumentTypeAlreadyExists,
            CompanyAlreadyExists,
            VatRateAlreadyExists,
            RetentionConceptAlreadyExists,
            IncomeLineAlreadyExists,
            TemplateAlreadyExists,
            DocumentFormatAlreadyExists,
            TaxFormatAlreadyExists,
            MediumConflict,
            TaxFormatConflict,
            AccumulationConflict,
            ConsolidacionConflict,
            CashFlowConflict,
            NiifConflict,
            CierreConflict,
            AdminConflict,
            MaintenanceConflict,
            EspecialesConflict,
            RefundConflict,
            ReassignmentConflict,
        ),
    ):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(
        exc,
        (
            PostingConflict, LotConflict, AnnulmentConflict, ThirdPartyConflict,
            CompanyConflict, VatRateConflict, RetentionConceptConflict, IncomeLineConflict,
            TemplateConflict,
        ),
    ):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(
        exc,
        (
            AccountNotFound,
            CompanyNotFound,
            ThirdPartyNotFound,
            CostCenterNotFound,
            VoucherNotFound,
            DocumentTypeNotFound,
            VatRateNotFound,
            RetentionConceptNotFound,
            IncomeLineNotFound,
            TemplateNotFound,
            DocumentFormatNotFound,
            TaxFormatNotFound,
            MediumNotFound,
            ConsolidacionNotFound,
            CierreNotFound,
            AdminNotFound,
            MaintenanceNotFound,
            EspecialesNotFound,
            RefundNotFound,
            ReassignmentNotFound,
        ),
    ):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(
        exc,
        (
            ValueError,
            PostingValidationError,
            LotValidationError,
            OperationParametersValidationError,
            ThirdPartyValidationError,
            AnnulmentValidationError,
            MonthlyReprocessValidationError,
            CostCenterValidationError,
            VoucherValidationError,
            DocumentTypeValidationError,
            CompanyValidationError,
            VatRateValidationError,
            RetentionConceptValidationError,
            IncomeLineValidationError,
            TemplateValidationError,
            DocumentFormatValidationError,
            TaxFormatValidationError,
            MediumValidationError,
            AccumulationValidationError,
            ConsolidacionValidationError,
            CashFlowValidationError,
            NiifValidationError,
            CierreValidationError,
            AdminValidationError,
            MaintenanceValidationError,
            EspecialesValidationError,
            RefundValidationError,
            ReassignmentValidationError,
        ),
    ):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    if isinstance(
        exc,
        (CompanyWriteNotImplemented, TaxLegacyNotSupported,
         ConsolidacionLegacyNotSupported, ConsolidacionPendiente,
         CashFlowLegacyNotSupported, NiifLegacyNotSupported, CierresLegacyNotSupported,
         AdminLegacyNotSupported, MaintenanceLegacyNotSupported,
         EspecialesLegacyNotSupported, RefundLegacyNotSupported,
         ReassignmentLegacyNotSupported),
    ):
        # R5/R10: rama no implementada declarada, con su causa y no con el mensaje
        # genérico de motor no disponible.
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
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
# la respuesta se marca con source="DEMO" y queda un aviso en el log. Con la
# extensión aditiva de B3 llevan también las dos claves nuevas, en su valor por
# defecto: ``CONEMP`` no tiene consolidación ni años contables.
DEMO_COMPANIES: tuple[dict[str, object], ...] = (
    {"codigo": "001", "nombre": "Compañía Demo S.A.S.", "nit": "900.123.456-7", "habilitada": True, "soloConsolidacion": False, "anios": []},
    {"codigo": "002", "nombre": "Inversiones Beta Ltda.", "nit": "800.200.300-1", "habilitada": False, "soloConsolidacion": False, "anios": []},
    {"codigo": "003", "nombre": "Comercial Gamma S.A.", "nit": "830.400.500-2", "habilitada": True, "soloConsolidacion": False, "anios": []},
    {"codigo": "004", "nombre": "Servicios Delta S.A.S.", "nit": "901.600.700-3", "habilitada": False, "soloConsolidacion": False, "anios": []},
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


def _config_catalog(table_postgres: str, table_ads: str) -> dict[str, object]:
    """Origen y alcance de un catálogo de configuración (R10).

    En el legado ``CONTIIVA``, ``CONTIRET`` y ``CONDECLA`` son globales (no tienen
    ``CIA``) mientras en el modelo nuevo son por compañía; la diferencia se declara
    en la respuesta, como en ``POST /api/tipos-documento``.
    """
    postgres = store.is_postgres()
    return {
        "source": table_postgres if postgres else table_ads,
        "sharedAcrossCompanies": not postgres,
    }


@app.post("/api/companias", status_code=status.HTTP_201_CREATED, summary="Crear compañía")
def create_company_endpoint(payload: CompanyCreate) -> dict[str, object]:
    """Crea la compañía con su primer año; en Advantage devuelve 503 declarado."""
    try:
        item = store.create_company(payload.model_dump(), user=payload.usuario)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, "source": "companias"}


@app.put("/api/companias/{codigo}", summary="Modificar compañía")
def update_company_endpoint(
    payload: CompanyWrite,
    codigo: str = Path(description="Código EMPCOD de la compañía.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Modifica nombre, NIT, dígito y estado; el código llega por la ruta."""
    try:
        item = store.update_company(codigo, payload.model_dump(), user=payload.usuario)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, "source": "companias"}


@app.delete(
    "/api/companias/{codigo}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Dar de baja una compañía",
)
def delete_company_endpoint(
    response: Response,
    codigo: str = Path(description="Código EMPCOD de la compañía.", pattern=r"^[0-9]{1,3}$"),
    motivo: str = Query(min_length=5, max_length=180),
    usuario: str = Query("WEB", min_length=1, max_length=4),
    dry_run: bool = Query(False, alias="dryRun", description="Informa la baja sin ejecutarla."),
) -> dict[str, object] | Response:
    """Retira la compañía del selector si no tiene documentos, lotes ni saldos."""
    try:
        item = store.delete_company(codigo, reason=motivo, user=usuario, dry_run=dry_run)
    except Exception as exc:
        raise _service_error(exc) from exc
    if not dry_run:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    response.status_code = status.HTTP_200_OK
    return {"item": item, "source": "companias", "dryRun": True}


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


@app.put("/api/terceros/{nit}", summary="Modificar los datos de un tercero")
def update_third(
    payload: ThirdPartyWrite,
    nit: str = Path(description="NIT del tercero.", pattern=r"^[0-9]{1,10}$"),
    cia: str = Query("", description="Compañía activa (requerida en PostgreSQL).", pattern=r"^[0-9]{0,3}$"),
    usuario: str = Query("WEB", min_length=1, max_length=4),
) -> dict[str, object]:
    """Modifica la ficha del tercero: el NIT viaja en la ruta y es inmutable."""
    try:
        item = store.update_third_party(nit, payload.model_dump(), cia=cia, user=usuario)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, "source": "FADCLI", "sharedAcrossCompanies": True}


@app.delete("/api/terceros/{nit}", summary="Retirar un tercero del directorio")
def delete_third(
    nit: str = Path(description="NIT del tercero.", pattern=r"^[0-9]{1,10}$"),
    motivo: str = Query(min_length=5, max_length=180),
    cia: str = Query("", description="Compañía activa (requerida en PostgreSQL).", pattern=r"^[0-9]{0,3}$"),
    usuario: str = Query("WEB", min_length=1, max_length=4),
    dry_run: bool = Query(False, alias="dryRun", description="Informa la baja sin ejecutarla."),
) -> dict[str, object]:
    """Da de baja un tercero sin historia contable; con movimientos, 409."""
    try:
        item = store.delete_third_party(
            nit, reason=motivo, user=usuario, cia=cia, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    return {
        "item": item,
        "source": "FADCLI",
        "sharedAcrossCompanies": True,
        "dryRun": dry_run,
    }


@app.put("/api/terceros/{nit}/cupo", summary="Fijar el cupo de cartera de un tercero")
def update_third_credit_limit(
    payload: ThirdPartyCreditLimit,
    nit: str = Path(description="NIT del tercero.", pattern=r"^[0-9]{1,10}$"),
    cia: str = Query("", description="Compañía activa (requerida en PostgreSQL).", pattern=r"^[0-9]{0,3}$"),
    usuario: str = Query("WEB", min_length=1, max_length=4),
) -> dict[str, object]:
    """Cambia sólo el cupo: la ventana de cupos encadena una llamada por tercero."""
    try:
        item = store.update_third_party_credit_limit(
            nit, payload.model_dump(), cia=cia, user=usuario
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, "source": "FADCLI"}


@app.post(
    "/api/terceros/importar",
    status_code=status.HTTP_201_CREATED,
    summary="Importar terceros desde un archivo ya leído",
)
def import_third_parties_endpoint(
    request: ThirdPartyImportRequest,
    response: Response,
    cia: str = Query("", description="Compañía activa (requerida en PostgreSQL).", pattern=r"^[0-9]{0,3}$"),
    usuario: str = Query("WEB", min_length=1, max_length=4),
    dry_run: bool = Query(False, alias="dryRun", description="Valida y devuelve el informe sin escribir."),
) -> dict[str, object]:
    """Da de alta varias filas; el `dryRun` responde 200 con el mismo informe."""
    try:
        item = store.import_third_parties(
            request.model_dump(), cia=cia, user=usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    if dry_run:
        response.status_code = status.HTTP_200_OK
    return {"item": item, "source": "FADCLI", "dryRun": dry_run}


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


@app.post("/api/centros", status_code=status.HTTP_201_CREATED, summary="Crear centro de costo")
def create_cost_center_endpoint(
    payload: CostCenterCreate,
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
    usuario: str = Query("WEB", min_length=1, max_length=4),
) -> dict[str, object]:
    """Crea un centro de la compañía activa; el padre, si viene, debe existir."""
    try:
        item = store.create_cost_center(cia, payload.model_dump(), user=usuario)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, "source": "CONCECOS", "sharedAcrossCompanies": False}


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


@app.post(
    "/api/tipos-documento",
    status_code=status.HTTP_201_CREATED,
    summary="Crear tipo de documento",
)
def create_document_type_endpoint(
    payload: DocumentTypeCreate,
    cia: str = Query(description="Compañía activa para validar el comprobante.", pattern=r"^[0-9]{1,3}$"),
    usuario: str = Query("WEB", min_length=1, max_length=4),
) -> dict[str, object]:
    """Crea un tipo de documento; en PostgreSQL es por compañía, en ADS global."""
    try:
        item = store.create_document_type(cia, payload.model_dump(), user=usuario)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {
        "item": item,
        "source": "VISDOCUM",
        # R10: VISDOCUM no tiene CIA (global); tipos_documento sí es por compañía.
        "sharedAcrossCompanies": not store.is_postgres(),
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


@app.post("/api/comprobantes", status_code=status.HTTP_201_CREATED, summary="Crear comprobante")
def create_voucher_endpoint(
    payload: VoucherCreate,
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
    usuario: str = Query("WEB", min_length=1, max_length=4),
) -> dict[str, object]:
    """Crea un comprobante de la compañía activa; no crea consecutivo."""
    try:
        item = store.create_voucher(cia, payload.model_dump(), user=usuario)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, "source": "CONTICOM", "sharedAcrossCompanies": False}


@app.get("/api/tarifas-iva", summary="Consultar tarifas de IVA por compañía")
def vat_rates(
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Lee ``tarifas_iva`` (o ``CONTIIVA`` en el legado), sin las filas dadas de baja."""
    try:
        items = store.list_tarifas_iva(cia)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {
        "items": items,
        "count": len(items),
        **_config_catalog("tarifas_iva", "CONTIIVA"),
    }


@app.post("/api/tarifas-iva", status_code=status.HTTP_201_CREATED, summary="Crear tarifa de IVA")
def create_vat_rate(
    payload: VatRateCreate,
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Crea la tarifa; la cuenta, si viene, debe existir en el plan de la compañía."""
    try:
        item = store.create_tarifa_iva(cia, payload.model_dump(), user=payload.usuario)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, **_config_catalog("tarifas_iva", "CONTIIVA")}


@app.put("/api/tarifas-iva/{codigo}", summary="Modificar tarifa de IVA")
def update_vat_rate(
    payload: VatRateWrite,
    codigo: str = Path(description="Código de la tarifa.", pattern=r"^[A-Za-z0-9]{1,10}$"),
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Modifica la tarifa vigente sin reescribir lo contabilizado."""
    try:
        item = store.update_tarifa_iva(cia, codigo, payload.model_dump(), user=payload.usuario)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, **_config_catalog("tarifas_iva", "CONTIIVA")}


@app.delete(
    "/api/tarifas-iva/{codigo}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Dar de baja una tarifa de IVA",
)
def delete_vat_rate(
    response: Response,
    codigo: str = Path(description="Código de la tarifa.", pattern=r"^[A-Za-z0-9]{1,10}$"),
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
    motivo: str = Query(min_length=5, max_length=180),
    usuario: str = Query("WEB", min_length=1, max_length=4),
    dry_run: bool = Query(False, alias="dryRun", description="Informa la baja sin ejecutarla."),
) -> dict[str, object] | Response:
    """Da de baja la tarifa; con renglones contabilizados que la usan, 409."""
    try:
        item = store.delete_tarifa_iva(
            cia, codigo, reason=motivo, user=usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    if not dry_run:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    response.status_code = status.HTTP_200_OK
    return {"item": item, **_config_catalog("tarifas_iva", "CONTIIVA"), "dryRun": True}


@app.get("/api/conceptos-retencion", summary="Consultar conceptos de retención")
def retention_concepts(
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Lee ``conceptos_retencion`` (o ``CONTIRET``), sin las filas dadas de baja."""
    try:
        items = store.list_conceptos_retencion(cia)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {
        "items": items,
        "count": len(items),
        **_config_catalog("conceptos_retencion", "CONTIRET"),
    }


@app.post(
    "/api/conceptos-retencion",
    status_code=status.HTTP_201_CREATED,
    summary="Crear concepto de retención",
)
def create_retention_concept(
    payload: RetentionConceptCreate,
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Crea el concepto; sin cuenta responde 422 (regla de la pantalla)."""
    try:
        item = store.create_concepto_retencion(cia, payload.model_dump(), user=payload.usuario)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, **_config_catalog("conceptos_retencion", "CONTIRET")}


@app.put("/api/conceptos-retencion/{codigo}", summary="Modificar concepto de retención")
def update_retention_concept(
    payload: RetentionConceptWrite,
    codigo: str = Path(description="Código del concepto.", pattern=r"^[A-Za-z0-9]{1,10}$"),
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Modifica el concepto; el cambio de tarifa aplica a lo que se capture."""
    try:
        item = store.update_concepto_retencion(
            cia, codigo, payload.model_dump(), user=payload.usuario
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, **_config_catalog("conceptos_retencion", "CONTIRET")}


@app.delete(
    "/api/conceptos-retencion/{codigo}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Dar de baja un concepto de retención",
)
def delete_retention_concept(
    response: Response,
    codigo: str = Path(description="Código del concepto.", pattern=r"^[A-Za-z0-9]{1,10}$"),
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
    motivo: str = Query(min_length=5, max_length=180),
    usuario: str = Query("WEB", min_length=1, max_length=4),
    dry_run: bool = Query(False, alias="dryRun", description="Informa la baja sin ejecutarla."),
) -> dict[str, object] | Response:
    """Da de baja el concepto; con acumulados o renglones que lo usan, 409."""
    try:
        item = store.delete_concepto_retencion(
            cia, codigo, reason=motivo, user=usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    if not dry_run:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    response.status_code = status.HTTP_200_OK
    return {"item": item, **_config_catalog("conceptos_retencion", "CONTIRET"), "dryRun": True}


@app.get("/api/renglones-renta", summary="Consultar renglones de renta")
def income_lines(
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Lee ``renglones_renta`` (o ``CONDECLA``), sin las filas dadas de baja."""
    try:
        items = store.list_renglones_renta(cia)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {
        "items": items,
        "count": len(items),
        **_config_catalog("renglones_renta", "CONDECLA"),
    }


@app.post(
    "/api/renglones-renta", status_code=status.HTTP_201_CREATED, summary="Crear renglón de renta"
)
def create_income_line(
    payload: IncomeLineCreate,
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Crea el renglón; la cuenta es obligatoria y debe existir en el plan."""
    try:
        item = store.create_renglon_renta(cia, payload.model_dump(), user=payload.usuario)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, **_config_catalog("renglones_renta", "CONDECLA")}


@app.put("/api/renglones-renta/{codigo}", summary="Modificar renglón de renta")
def update_income_line(
    payload: IncomeLineWrite,
    codigo: str = Path(description="Código del renglón.", pattern=r"^[A-Za-z0-9]{1,10}$"),
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Modifica el renglón vigente; no reescribe declaraciones anteriores."""
    try:
        item = store.update_renglon_renta(cia, codigo, payload.model_dump(), user=payload.usuario)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, **_config_catalog("renglones_renta", "CONDECLA")}


@app.delete(
    "/api/renglones-renta/{codigo}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Dar de baja un renglón de renta",
)
def delete_income_line(
    response: Response,
    codigo: str = Path(description="Código del renglón.", pattern=r"^[A-Za-z0-9]{1,10}$"),
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
    motivo: str = Query(min_length=5, max_length=180),
    usuario: str = Query("WEB", min_length=1, max_length=4),
    dry_run: bool = Query(False, alias="dryRun", description="Informa la baja sin ejecutarla."),
) -> dict[str, object] | Response:
    """Da de baja el renglón; si su cuenta tiene declaraciones, 409."""
    try:
        item = store.delete_renglon_renta(
            cia, codigo, reason=motivo, user=usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    if not dry_run:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    response.status_code = status.HTTP_200_OK
    return {"item": item, **_config_catalog("renglones_renta", "CONDECLA"), "dryRun": True}


@app.get("/api/plantillas-contables", summary="Consultar plantillas contables")
def templates(
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Lee ``plantillas_contables`` (o el bloque de parejas de ``VISDOCUM``)."""
    try:
        items = store.list_plantillas_contables(cia)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {
        "items": items,
        "count": len(items),
        **_config_catalog("plantillas_contables", "VISDOCUM"),
    }


@app.post(
    "/api/plantillas-contables",
    status_code=status.HTTP_201_CREATED,
    summary="Crear plantilla contable",
)
def create_template(
    payload: TemplateCreate,
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Crea la plantilla; cada cuenta de cada pareja debe existir y ser afectable."""
    try:
        item = store.create_plantilla_contable(cia, payload.model_dump(), user=payload.usuario)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, **_config_catalog("plantillas_contables", "VISDOCUM")}


@app.put("/api/plantillas-contables/{codigo}", summary="Modificar plantilla contable")
def update_template(
    payload: TemplateWrite,
    codigo: str = Path(description="Código de la plantilla.", pattern=r"^[A-Za-z0-9]{1,10}$"),
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Modifica la plantilla y reemplaza sus parejas de cuentas en bloque."""
    try:
        item = store.update_plantilla_contable(
            cia, codigo, payload.model_dump(), user=payload.usuario
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, **_config_catalog("plantillas_contables", "VISDOCUM")}


@app.delete(
    "/api/plantillas-contables/{codigo}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Dar de baja una plantilla contable",
)
def delete_template(
    response: Response,
    codigo: str = Path(description="Código de la plantilla.", pattern=r"^[A-Za-z0-9]{1,10}$"),
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
    motivo: str = Query(min_length=5, max_length=180),
    usuario: str = Query("WEB", min_length=1, max_length=4),
    dry_run: bool = Query(False, alias="dryRun", description="Informa la baja sin ejecutarla."),
) -> dict[str, object] | Response:
    """Da de baja la plantilla; sus líneas se conservan y los lotes no se tocan."""
    try:
        item = store.delete_plantilla_contable(
            cia, codigo, reason=motivo, user=usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    if not dry_run:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    response.status_code = status.HTTP_200_OK
    return {"item": item, **_config_catalog("plantillas_contables", "VISDOCUM"), "dryRun": True}


@app.get("/api/formatos-documentales", summary="Consultar formatos documentales")
def document_formats(
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Lee ``formatos_documentales`` (o ``CONGENF`` con las posiciones de ``CONFORMA``)."""
    try:
        items = store.list_formatos_documentales(cia)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {
        "items": items,
        "count": len(items),
        **_config_catalog("formatos_documentales", "CONGENF"),
    }


@app.post(
    "/api/formatos-documentales",
    status_code=status.HTTP_201_CREATED,
    summary="Crear formato documental",
)
def create_document_format(
    payload: DocumentFormatCreate,
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Crea el formato; el ``tipo`` debe ser una de las ocho clases del editor."""
    try:
        item = store.create_formato_documental(cia, payload.model_dump(), user=payload.usuario)
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, **_config_catalog("formatos_documentales", "CONGENF")}


@app.put("/api/formatos-documentales/{codigo}", summary="Modificar formato documental")
def update_document_format(
    payload: DocumentFormatWrite,
    codigo: str = Path(description="Código del formato.", pattern=r"^[A-Za-z0-9]{1,10}$"),
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
) -> dict[str, object]:
    """Modifica el formato y reemplaza sus elementos en bloque."""
    try:
        item = store.update_formato_documental(
            cia, codigo, payload.model_dump(), user=payload.usuario
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    return {"item": item, **_config_catalog("formatos_documentales", "CONGENF")}


@app.delete(
    "/api/formatos-documentales/{codigo}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Dar de baja un formato documental",
)
def delete_document_format(
    response: Response,
    codigo: str = Path(description="Código del formato.", pattern=r"^[A-Za-z0-9]{1,10}$"),
    cia: str = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$"),
    motivo: str = Query(min_length=5, max_length=180),
    usuario: str = Query("WEB", min_length=1, max_length=4),
    dry_run: bool = Query(False, alias="dryRun", description="Informa la baja sin ejecutarla."),
) -> dict[str, object] | Response:
    """Da de baja el formato; sus elementos se conservan para reimprimir."""
    try:
        item = store.delete_formato_documental(
            cia, codigo, reason=motivo, user=usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    if not dry_run:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    response.status_code = status.HTTP_200_OK
    return {"item": item, **_config_catalog("formatos_documentales", "CONGENF"), "dryRun": True}


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
    """Lee el motor activo con los parámetros originales; no modifica tablas.

    El despacho por motor y por id vive en ``store`` (R1): los ids que ya
    funcionaban siguen yendo al repositorio de Advantage (R2) y solo los cinco
    informes de A5 eligen rama según el motor.
    """
    try:
        return store.build_additional_report(
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


# ===========================================================================
# Bloque D1 · Impuestos: acumulados, formatos y medios magnéticos (20 rutas)
# ===========================================================================
_ACCUMULATED_MEDIA = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv; charset=utf-8",
}
_MEDIUM_MEDIA = {
    "xml": "application/xml",
    "csv": "text/csv; charset=utf-8",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
_CIA_QUERY = Query(description="Código EMPCOD/CIA seleccionado.", pattern=r"^[0-9]{1,3}$")


def _validate_month_range(mes_desde: int, mes_hasta: int) -> None:
    if mes_desde > mes_hasta:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El mes inicial no puede ser mayor que el mes final.",
        )


# --- 1. Acumulados ---------------------------------------------------------
@app.get("/api/impuestos/acumulados-iva", summary="Consultar el IVA acumulado")
def impuestos_acumulados_iva(
    cia: str = _CIA_QUERY,
    anio: int = Query(ge=1900, le=2100),
    mes_desde: int = Query(1, alias="mesDesde", ge=1, le=12),
    mes_hasta: int = Query(alias="mesHasta", ge=1, le=12),
    nit: str = Query("", max_length=15),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    """Solo lectura: el acumulado por tercero y período, sin recalcular (1.1)."""
    _validate_month_range(mes_desde, mes_hasta)
    try:
        return store.list_acumulados_iva(
            cia, anio, mes_desde, mes_hasta, nit=nit, page=page, page_size=page_size
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post("/api/impuestos/acumulados-iva/acumular", summary="Recalcular el IVA acumulado")
def impuestos_acumular_iva(
    payload: AccumulationRequest,
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Recalcula el período indicado; ``dryRun`` devuelve el informe sin escribir (1.2)."""
    try:
        return store.acumular_iva(
            cia, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/impuestos/acumulados-iva/exportar", summary="Exportar el IVA acumulado")
def impuestos_exportar_acumulados_iva(
    cia: str = _CIA_QUERY,
    anio: int = Query(ge=1900, le=2100),
    mes_desde: int = Query(1, alias="mesDesde", ge=1, le=12),
    mes_hasta: int = Query(alias="mesHasta", ge=1, le=12),
    nit: str = Query("", max_length=15),
    formato: Literal["xlsx", "csv"] = Query(),
) -> Response:
    """Exporta exactamente las filas del ``GET``, con los mismos filtros (1.3)."""
    _validate_month_range(mes_desde, mes_hasta)
    try:
        result = store.list_acumulados_iva(
            cia, anio, mes_desde, mes_hasta, nit=nit, page=1, page_size=1_000_000
        )
        headers = ["NIT", "Nombre", "Periodo", "Base", "IVA generado", "IVA descontable", "Neto"]
        rows = [
            [item["nit"], item["nombre"], item["periodo"], item["base"],
             item["ivaGenerado"], item["ivaDescontable"], item["neto"]]
            for item in result["items"]
        ]
        content = build_acumulado_export(
            titulo=f"Acumulado de IVA {anio}", headers=headers, rows=rows, cia=cia,
            anio=anio, mes_desde=mes_desde, mes_hasta=mes_hasta,
            source=str(result.get("source", "acumulados_iva")), formato=formato,
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    return Response(
        content=content, media_type=_ACCUMULATED_MEDIA[formato],
        headers={
            "Content-Disposition":
                f'attachment; filename="acumulado_iva_{int(cia):03d}_{anio}.{formato}"'
        },
    )


@app.get("/api/impuestos/acumulados-retenciones", summary="Consultar las retenciones acumuladas")
def impuestos_acumulados_retenciones(
    cia: str = _CIA_QUERY,
    anio: int = Query(ge=1900, le=2100),
    mes_desde: int = Query(1, alias="mesDesde", ge=1, le=12),
    mes_hasta: int = Query(alias="mesHasta", ge=1, le=12),
    nit: str = Query("", max_length=15),
    concepto: str = Query("", max_length=10),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    """Retenciones por tercero, concepto y período (1.4)."""
    _validate_month_range(mes_desde, mes_hasta)
    try:
        return store.list_acumulados_retencion(
            cia, anio, mes_desde, mes_hasta, nit=nit, concepto=concepto,
            page=page, page_size=page_size,
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post("/api/impuestos/acumulados-retenciones/acumular", summary="Recalcular las retenciones acumuladas")
def impuestos_acumular_retenciones(
    payload: AccumulationRequest,
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Recalcula el período indicado dentro de una transacción (1.5)."""
    try:
        return store.acumular_retencion(
            cia, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get(
    "/api/impuestos/acumulados-retenciones/exportar",
    summary="Exportar las retenciones acumuladas",
)
def impuestos_exportar_acumulados_retenciones(
    cia: str = _CIA_QUERY,
    anio: int = Query(ge=1900, le=2100),
    mes_desde: int = Query(1, alias="mesDesde", ge=1, le=12),
    mes_hasta: int = Query(alias="mesHasta", ge=1, le=12),
    nit: str = Query("", max_length=15),
    concepto: str = Query("", max_length=10),
    formato: Literal["xlsx", "csv"] = Query(),
) -> Response:
    """Exporta exactamente las filas del ``GET`` de retenciones (1.6)."""
    _validate_month_range(mes_desde, mes_hasta)
    try:
        result = store.list_acumulados_retencion(
            cia, anio, mes_desde, mes_hasta, nit=nit, concepto=concepto,
            page=1, page_size=1_000_000,
        )
        headers = ["NIT", "Nombre", "Concepto", "Nombre concepto", "Periodo", "Base", "Tarifa", "Valor"]
        rows = [
            [item["nit"], item["nombre"], item["concepto"], item["nombreConcepto"],
             item["periodo"], item["base"], item["tarifa"], item["valor"]]
            for item in result["items"]
        ]
        content = build_acumulado_export(
            titulo=f"Acumulado de retenciones {anio}", headers=headers, rows=rows, cia=cia,
            anio=anio, mes_desde=mes_desde, mes_hasta=mes_hasta,
            source=str(result.get("source", "acumulados_retencion")), formato=formato,
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    return Response(
        content=content, media_type=_ACCUMULATED_MEDIA[formato],
        headers={
            "Content-Disposition":
                f'attachment; filename="acumulado_retenciones_{int(cia):03d}_{anio}.{formato}"'
        },
    )


# --- 2. Formatos, conceptos y asignaciones ---------------------------------
@app.get("/api/impuestos/formatos", summary="Listar formatos de exógena")
def impuestos_formatos(
    cia: str = _CIA_QUERY,
    anio: int | None = Query(None, ge=1900, le=2100, description="Filtra por vigencia."),
) -> dict[str, object]:
    """Formatos con su vigencia, su estado y sus conteos calculados (2.1)."""
    try:
        return store.list_impuestos_formatos(cia, anio=anio)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post(
    "/api/impuestos/formatos",
    status_code=status.HTTP_201_CREATED,
    summary="Crear un formato de exógena",
)
def impuestos_crear_formato(
    payload: ExogenousFormatCreate,
    cia: str = _CIA_QUERY,
) -> dict[str, object]:
    """Crea el formato; la unicidad es compañía, código y vigencia (2.2)."""
    try:
        return store.create_formato(cia, payload.model_dump(), user=payload.usuario)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.put("/api/impuestos/formatos/{codigo}", summary="Modificar un formato de exógena")
def impuestos_actualizar_formato(
    payload: ExogenousFormatUpdate,
    codigo: str = Path(pattern=r"^[A-Za-z0-9]{1,10}$"),
    cia: str = _CIA_QUERY,
    vigencia: int = Query(ge=1900, le=2100, description="Vigencia de la fila (clave)."),
) -> dict[str, object]:
    """Modifica nombre, estado o vigencia; la vigencia forma parte de la clave (2.3)."""
    try:
        return store.update_formato(
            cia, codigo, vigencia, payload.model_dump(), user=payload.usuario
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.delete(
    "/api/impuestos/formatos/{codigo}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Dar de baja un formato de exógena",
)
def impuestos_eliminar_formato(
    response: Response,
    codigo: str = Path(pattern=r"^[A-Za-z0-9]{1,10}$"),
    cia: str = _CIA_QUERY,
    vigencia: int = Query(ge=1900, le=2100),
    motivo: str = Query(min_length=5, max_length=180),
    usuario: str = Query("WEB", min_length=1, max_length=4),
    dry_run: bool = Query(False, alias="dryRun", description="Informa la baja sin ejecutarla."),
) -> dict[str, object] | Response:
    """Baja lógica; con una generación exportada responde 409 (2.4)."""
    try:
        item = store.delete_formato(
            cia, codigo, vigencia, reason=motivo, user=usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    if not dry_run:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    response.status_code = status.HTTP_200_OK
    return {"item": item, "source": "formatos_exogenos", "dryRun": True}


@app.put(
    "/api/impuestos/formatos/{codigo}/conceptos",
    summary="Reemplazar los conceptos de un formato",
)
def impuestos_reemplazar_conceptos(
    payload: FormatConceptList,
    codigo: str = Path(pattern=r"^[A-Za-z0-9]{1,10}$"),
    cia: str = _CIA_QUERY,
    vigencia: int = Query(ge=1900, le=2100),
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Reemplazo en bloque, con conteos de creados, actualizados y retirados (2.5)."""
    try:
        return store.replace_formato_conceptos(
            cia, codigo, vigencia, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.put(
    "/api/impuestos/formatos/{codigo}/asignaciones",
    summary="Reemplazar las cuentas asignadas a un formato",
)
def impuestos_reemplazar_asignaciones(
    payload: FormatAssignmentList,
    codigo: str = Path(pattern=r"^[A-Za-z0-9]{1,10}$"),
    cia: str = _CIA_QUERY,
    vigencia: int = Query(ge=1900, le=2100),
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """El árbol manda la lista completa, que evita interpretar altas y bajas (2.6)."""
    try:
        return store.replace_formato_asignaciones(
            cia, codigo, vigencia, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post("/api/impuestos/formatos/copiar", summary="Copiar definiciones de otra compañía")
def impuestos_copiar_formatos(
    payload: FormatCopyRequest,
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Copia definiciones (no datos) traduciendo las cuentas por código (2.7)."""
    try:
        return store.copy_formatos(
            cia, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


# --- 3. Generación y revisión del medio magnético --------------------------
@app.get("/api/impuestos/medios", summary="Listar las generaciones de medios")
def impuestos_medios(
    cia: str = _CIA_QUERY,
    anio: int = Query(ge=1900, le=2100),
) -> dict[str, object]:
    """Generaciones del año con su número, su estado y su cuadre (3.1)."""
    try:
        return store.list_medios(cia, anio)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post(
    "/api/impuestos/medios",
    status_code=status.HTTP_201_CREATED,
    summary="Generar el medio magnético del año",
)
def impuestos_generar_medio(
    payload: MediumGenerationRequest,
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Genera las filas y el cuadre en una transacción (3.2)."""
    try:
        return store.create_medio(
            cia, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/impuestos/medios/{id}", summary="Filas del medio para revisión")
def impuestos_medio_detalle(
    id: int = Path(ge=1),
    cia: str = _CIA_QUERY,
    formato: str = Query("", max_length=10),
    nit: str = Query("", max_length=15),
    page: int = Query(1, ge=1),
    page_size: int = Query(200, alias="pageSize", ge=1, le=500),
) -> dict[str, object]:
    """Filas paginadas de una generación; ``ajustado`` marca la corregida (3.3)."""
    try:
        return store.get_medio(
            cia, id, formato=formato, nit=nit, page=page, page_size=page_size
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.put(
    "/api/impuestos/medios/{id}/filas/{fila_id}",
    summary="Ajustar una fila revisada del medio",
)
def impuestos_ajustar_fila(
    payload: MediumRowWrite,
    id: int = Path(ge=1),
    fila_id: int = Path(ge=1),
    cia: str = _CIA_QUERY,
) -> dict[str, object]:
    """Solo se ajusta mientras la generación no esté exportada (3.4)."""
    try:
        return store.update_medio_fila(
            cia, id, fila_id, payload.model_dump(), user=payload.usuario
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get(
    "/api/impuestos/medios/{id}/conciliacion",
    summary="Cuadre del medio magnético",
)
def impuestos_medio_conciliacion(
    id: int = Path(ge=1),
    cia: str = _CIA_QUERY,
) -> dict[str, object]:
    """Los cinco valores del cuadre, calculados al generar y no recalculados (3.5)."""
    try:
        return store.get_medio_conciliacion(cia, id)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.put("/api/impuestos/topes", summary="Reemplazar los topes del año")
def impuestos_reemplazar_topes(
    payload: MediumCapList,
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Reemplazo en bloque de los topes por formato y concepto (3.6)."""
    try:
        return store.replace_topes(
            cia, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/impuestos/medios/{id}/exportar", summary="Exportar el medio magnético")
def impuestos_exportar_medio(
    id: int = Path(ge=1),
    cia: str = _CIA_QUERY,
    formato: Literal["xml", "csv", "xlsx"] = Query(),
    formato_exogeno: str = Query("", alias="formatoExogeno", max_length=10),
) -> Response:
    """Exporta el medio; marca la generación como ``Exportado`` y avisa el cuadre (3.7)."""
    try:
        result = store.export_medio(
            cia, id, formato=formato, formato_exogeno=formato_exogeno
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    return Response(
        content=result["content"], media_type=result["media_type"],
        headers={
            "Content-Disposition": f'attachment; filename="{result["filename"]}"',
            "X-Conciliacion-Cuadrado": "true" if result["cuadrado"] else "false",
        },
    )


# ---------------------------------------------------------------------------
# Bloque D3 · Consolidación
# ---------------------------------------------------------------------------
@app.get("/api/consolidaciones", summary="Listar las consolidaciones del año")
def consolidaciones(
    cia: str = _CIA_QUERY,
    anio: int = Query(ge=1900, le=2999),
) -> dict[str, object]:
    """Consolidaciones del año destino con el conteo de orígenes (2.1)."""
    try:
        return store.list_consolidaciones(cia, anio)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post(
    "/api/consolidaciones",
    status_code=status.HTTP_201_CREATED,
    summary="Configurar una consolidación",
)
def crear_consolidacion(
    payload: ConsolidationWrite,
    cia: str = _CIA_QUERY,
) -> dict[str, object]:
    """Configura destino, orígenes y homologaciones en una transacción (2.2)."""
    try:
        return store.create_consolidation(cia, payload.model_dump(), user=payload.usuario)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/consolidaciones/{id}", summary="Ver una consolidación")
def consolidacion_detalle(
    id: int = Path(ge=1),
    cia: str = _CIA_QUERY,
) -> dict[str, object]:
    """Orígenes, homologaciones, simulación y comparación por grupo (2.3)."""
    try:
        return store.get_consolidation(cia, id)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post("/api/consolidaciones/{id}/simular", summary="Simular una consolidación")
def consolidacion_simular(
    payload: ConsolidationAction,
    id: int = Path(ge=1),
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(
        True, alias="dryRun", description="La simulación ya es una simulación."
    ),
) -> dict[str, object]:
    """Simula sin escribir el asiento; persiste el resultado y pasa a ``Simulado`` (2.4).

    ``dryRun`` solo admite verdadero: forzarlo a falso sería incoherente y se
    rechaza con 422.
    """
    if not dry_run:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La simulación ya es una simulación: dryRun=false es incoherente.",
        )
    try:
        return store.simulate_consolidation(
            cia, id, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post("/api/consolidaciones/{id}/ejecutar", summary="Ejecutar una consolidación")
def consolidacion_ejecutar(
    payload: ConsolidationExecution,
    id: int = Path(ge=1),
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Exige respaldo y confirmación (422) y simulación previa (409); hoy responde 503.

    El algoritmo de consolidación está pendiente de decisión
    (``db/migration/03_plan_de_carga.md`` L156-162): la ruta queda especificada y
    devuelve 503 con esa causa, no una simulación presentada como ejecución (2.5).
    """
    try:
        return store.execute_consolidation(
            cia, id, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


# ===========================================================================
# Bloque A5 · Configuración de informes: flujo de caja y rubros NIIF
#
# Cuatro rutas de configuración solo PostgreSQL; en Advantage declaran la brecha
# (503). R9: rutas minúsculas con guiones y listas ``{"items", "count", "source"}``.
# ===========================================================================
@app.get("/api/flujo-caja-renglones", summary="Consultar la definición del flujo de caja")
def flujo_caja_renglones(
    cia: str = _CIA_QUERY,
    anio: int | None = Query(None, ge=1900, le=2100, description="Ejercicio de la definición."),
) -> dict[str, object]:
    """Definición de cuentas del flujo de caja de la compañía (§1)."""
    try:
        return store.list_flujo_caja_renglones(cia, anio=anio)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.put("/api/flujo-caja-renglones", summary="Reemplazar la definición del flujo de caja")
def reemplazar_flujo_caja_renglones(
    payload: CashFlowDefinition,
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Reemplazo en bloque de la definición completa del flujo (§2)."""
    try:
        return store.replace_flujo_caja_renglones(
            cia, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/rubros-niif", summary="Consultar los rubros NIIF y sus cuentas")
def rubros_niif(
    cia: str = _CIA_QUERY,
    anio: int | None = Query(None, ge=1900, le=2100, description="Ejercicio de la clasificación."),
    informe: Literal["todos", "ESFA", "ER"] = Query("todos", description="Informe a listar."),
) -> dict[str, object]:
    """Rubros NIIF de la compañía, filtrados por informe (§3)."""
    try:
        return store.list_rubros_niif(cia, anio=anio, informe=informe)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.put("/api/rubros-niif", summary="Reemplazar los rubros NIIF y sus asignaciones")
def reemplazar_rubros_niif(
    payload: NiifClassification,
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Reemplazo en bloque de los rubros NIIF y sus asignaciones (§4)."""
    try:
        return store.replace_rubros_niif(
            cia, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


# ===========================================================================
# Bloque D2 · Cierres (R9: rutas minúsculas; R10: la brecha de ADS se declara)
# ===========================================================================
@app.get("/api/cierres", summary="Consultar el estado del cierre del año")
def cierres(
    cia: str = _CIA_QUERY,
    anio: int = Query(ge=1900, le=2100),
) -> dict[str, object]:
    """Estado del cierre y checklist **calculado**; sin fila devuelve ``id: null`` (1.1)."""
    try:
        return store.list_cierres(cia, anio)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post(
    "/api/cierres",
    status_code=status.HTTP_201_CREATED,
    summary="Abrir el cierre del año",
)
def abrir_cierre(
    payload: CloseRequest,
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Abre el cierre con la foto del checklist; un año admite uno abierto (1.2)."""
    try:
        return store.create_cierre(
            cia, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post("/api/cierres/{id}/lote", summary="Generar el lote de cierre")
def cierre_lote(
    payload: CierreLotActionRequest,
    id: int = Path(ge=1),
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Genera el lote de cierre desde los saldos del año, reutilizando Lotes (1.3)."""
    try:
        return store.generate_cierre_lot(
            cia, id, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post("/api/cierres/{id}/traslado", summary="Trasladar períodos de ajuste")
def cierre_traslado(
    payload: CloseTransferRequest,
    id: int = Path(ge=1),
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Persiste la matriz en ``cierre_traslados`` y crea los documentos del destino (1.4)."""
    try:
        return store.transfer_cierre(
            cia, id, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


# ===========================================================================
# Bloques D5, D6 y D7 · Administración: usuarios y permisos, bitácora e
# integraciones. Rutas minúsculas (R9); la brecha de ADS se declara (R10).
# ===========================================================================
class UserWrite(BaseModel):
    """Alta de usuario (D5 §1.2). Sin clave: el modelo no guarda contraseña."""

    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(min_length=1, max_length=60)
    email: str = Field(min_length=1, max_length=60)
    rol: str = Field(min_length=1, max_length=20)
    iniciales: str = Field("", max_length=4)
    activo: bool = True
    companias: list[str] = Field(min_length=1, max_length=50)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)


class UserUpdate(BaseModel):
    """Modificación de usuario sin compañías, que tienen su propia ruta (D5 §1.3)."""

    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(min_length=1, max_length=60)
    email: str = Field(min_length=1, max_length=60)
    rol: str = Field(min_length=1, max_length=20)
    iniciales: str = Field("", max_length=4)
    activo: bool = True
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)


class RolePermissionList(BaseModel):
    """Reemplazo completo de los permisos de un rol (D5 §1.6)."""

    model_config = ConfigDict(extra="forbid")

    permisos: list[str] = Field(max_length=200)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)


class UserCompanyList(BaseModel):
    """Compañías a las que accede el usuario (D5 §1.7)."""

    model_config = ConfigDict(extra="forbid")

    companias: list[str] = Field(min_length=1, max_length=50)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)


class IntegrationWrite(BaseModel):
    """Estado y configuración declarada de una integración (D7 §3.2)."""

    model_config = ConfigDict(extra="forbid")

    estado: Literal["Conectado", "Desconectado", "Bloqueado"]
    configuracion: dict[str, Any] = Field(default_factory=dict)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)


@app.get("/api/usuarios", summary="Listar usuarios con rol y compañías")
def usuarios_listar(
    q: str = Query("", max_length=60),
    estado: Literal["todos", "activo", "inactivo"] = Query("todos"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    """Usuarios con su rol, estado y compañías (1.1)."""
    try:
        return store.list_users(q=q, estado=estado, page=page, page_size=page_size)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post("/api/usuarios", status_code=status.HTTP_201_CREATED, summary="Crear usuario")
def usuario_crear(payload: UserWrite) -> dict[str, object]:
    """Alta de usuario con rol existente y al menos una compañía (1.2)."""
    try:
        return store.create_user(payload.model_dump(), user=payload.usuario)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.put("/api/usuarios/{id}", summary="Modificar usuario")
def usuario_actualizar(payload: UserUpdate, id: int = Path(ge=1)) -> dict[str, object]:
    """Modifica nombre, correo, rol, iniciales o estado (1.3)."""
    try:
        return store.update_user(id, payload.model_dump(), user=payload.usuario)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.delete(
    "/api/usuarios/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Dar de baja al usuario",
)
def usuario_baja(
    id: int = Path(ge=1),
    motivo: str = Query(min_length=5, max_length=180),
    usuario: str = Query("WEB", min_length=1, max_length=4),
) -> None:
    """Baja lógica: la bitácora del usuario no se toca (1.4)."""
    try:
        store.delete_user(id, user=usuario, motivo=motivo)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/roles", summary="Listar roles y el catálogo de permisos")
def roles_listar() -> dict[str, object]:
    """Roles con sus permisos más el catálogo completo (1.5)."""
    try:
        return store.list_roles()
    except Exception as exc:
        raise _service_error(exc) from exc


@app.put("/api/roles/{codigo}/permisos", summary="Reemplazar los permisos de un rol")
def rol_permisos(
    payload: RolePermissionList,
    codigo: str = Path(min_length=1, max_length=20),
) -> dict[str, object]:
    """Reemplazo en bloque de los permisos del rol (1.6)."""
    try:
        return store.replace_role_permissions(codigo, payload.model_dump(), user=payload.usuario)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.put("/api/usuarios/{id}/companias", summary="Fijar las compañías del usuario")
def usuario_companias(payload: UserCompanyList, id: int = Path(ge=1)) -> dict[str, object]:
    """Aislamiento por empresa: reemplazo en bloque de `usuario_companias` (1.7)."""
    try:
        return store.replace_user_companies(id, payload.model_dump(), user=payload.usuario)
    except Exception as exc:
        raise _service_error(exc) from exc


_AUDIT_RESULT = Literal["todos", "EXITO", "FALLO", "INFO"]
_AUDIT_FORMAT = Literal["xlsx", "csv"]
_AUDIT_QUERY = Query("", description="Compañía del registro; admite nulo (auditoría global).", pattern=r"^[0-9]{1,3}$")


@app.get("/api/auditoria", summary="Consultar la bitácora")
def auditoria_listar(
    cia: str = _AUDIT_QUERY,
    fecha_desde: str = Query("", alias="fechaDesde", max_length=10),
    fecha_hasta: str = Query("", alias="fechaHasta", max_length=10),
    modulo: str = Query("", max_length=40),
    usuario: str = Query("", max_length=60),
    resultado: _AUDIT_RESULT = Query("todos"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    """Publica la bitácora real que el sistema ya escribe (2.1)."""
    try:
        return store.list_audit_log(
            cia=cia, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta, modulo=modulo,
            usuario=usuario, resultado=resultado, page=page, page_size=page_size,
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/auditoria/exportar", summary="Exportar la bitácora filtrada")
def auditoria_exportar(
    cia: str = _AUDIT_QUERY,
    fecha_desde: str = Query("", alias="fechaDesde", max_length=10),
    fecha_hasta: str = Query("", alias="fechaHasta", max_length=10),
    modulo: str = Query("", max_length=40),
    usuario: str = Query("", max_length=60),
    resultado: _AUDIT_RESULT = Query("todos"),
    formato: _AUDIT_FORMAT = Query(...),
):
    """Descarga el filtro visible; exportar también deja fila en la bitácora (2.2)."""
    try:
        resultado_export = store.export_audit_log(
            cia=cia, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta, modulo=modulo,
            usuario=usuario, resultado=resultado, formato=formato,
        )
    except Exception as exc:
        raise _service_error(exc) from exc
    return Response(
        content=resultado_export["content"],
        media_type=resultado_export["media_type"],
        headers={"Content-Disposition": f'attachment; filename="{resultado_export["filename"]}"'},
    )


@app.get("/api/integraciones", summary="Estado real de las integraciones")
def integraciones_listar(cia: str = _CIA_QUERY) -> dict[str, object]:
    """Filas de integración de la compañía con estado y fecha reales (3.1)."""
    try:
        return store.list_integrations(cia)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.put("/api/integraciones/{modulo}", summary="Declarar el estado de una integración")
def integracion_actualizar(
    payload: IntegrationWrite,
    modulo: str = Path(min_length=1, max_length=40),
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Persiste estado, configuración y motivo; no prueba la conexión (3.2)."""
    try:
        return store.replace_integration(
            cia, modulo, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


# ===========================================================================
# Bloque D4 · Reorganización y mantenimiento (solo PostgreSQL; P36)
# ===========================================================================
class MaintenanceStart(BaseModel):
    """Entrada en modo mantenimiento (D4 §3.2)."""

    model_config = ConfigDict(extra="forbid")

    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)
    respaldoRealizado: bool
    alcance: dict[str, Any] = Field(default_factory=dict)


class ReorganizationWrite(BaseModel):
    """Compactación o reindexación declarada (D4 §3.4)."""

    model_config = ConfigDict(extra="forbid")

    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)
    tipo: Literal["Reindexar", "Analizar", "Compactar"]
    alcance: dict[str, Any] = Field(default_factory=dict)


@app.get("/api/mantenimiento", summary="Consultar el mantenimiento en curso")
def mantenimiento_estado(cia: str = _CIA_QUERY) -> dict[str, object]:
    """Estado del modo mantenimiento y su actor (3.1)."""
    try:
        return store.get_maintenance(cia)
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post(
    "/api/mantenimiento",
    status_code=status.HTTP_201_CREATED,
    summary="Entrar en modo mantenimiento",
)
def mantenimiento_iniciar(
    payload: MaintenanceStart,
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Un solo mantenimiento abierto por compañía; exige respaldo (3.2)."""
    try:
        return store.start_maintenance(
            cia, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.delete(
    "/api/mantenimiento",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Volver al estado normal",
)
def mantenimiento_cerrar(
    cia: str = _CIA_QUERY,
    proceso: int = Query(ge=1),
    motivo: str = Query(min_length=5, max_length=180),
    usuario: str = Query("WEB", min_length=1, max_length=4),
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> None:
    """Cierra el proceso de mantenimiento y deja de bloquear (3.3)."""
    try:
        store.stop_maintenance(
            cia, {"proceso": proceso, "motivo": motivo, "usuario": usuario},
            user=usuario, dry_run=dry_run,
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post(
    "/api/reorganizaciones",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ejecutar la reorganización",
)
def reorg_ejecutar(
    payload: ReorganizationWrite,
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Exige mantenimiento activo; una sola reorganización en curso (3.4)."""
    try:
        return store.start_reorganization(
            cia, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.get("/api/reorganizaciones/{id}", summary="Consultar una reorganización")
def reorg_detalle(id: int = Path(ge=1), cia: str = _CIA_QUERY) -> dict[str, object]:
    """Resultado y conteos de la ejecución (3.5)."""
    try:
        return store.get_reorganization(cia, id)
    except Exception as exc:
        raise _service_error(exc) from exc


# ===========================================================================
# Especiales · cuentas en cero (H6). La eliminación es la operación más
# destructiva del plan y exige confirmación literal.
# ===========================================================================
class ZeroAccountRemoval(BaseModel):
    """Eliminación de cuentas en cero confirmada (Especiales §4.2)."""

    model_config = ConfigDict(extra="forbid")

    anio: int = Field(ge=1900, le=2100)
    cuentas: list[AccountCode] = Field(min_length=1, max_length=5000)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=10, max_length=180)
    confirmacion: str = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def _confirmacion_literal(self) -> "ZeroAccountRemoval":
        if self.confirmacion != "ELIMINAR":
            raise ValueError("La confirmación debe ser el texto literal ELIMINAR.")
        return self


@app.get("/api/especiales/cuentas-en-cero", summary="Analizar cuentas en cero")
def especiales_cuentas_cero(
    cia: str = _CIA_QUERY,
    anio: int = Query(ge=1900, le=2100),
    incluir_no_afectables: bool = Query(False, alias="incluirNoAfectables"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, alias="pageSize", ge=1, le=500),
) -> dict[str, object]:
    """Cuentas sin saldo ni movimiento, con `eliminable` y el resumen (4.1)."""
    try:
        return store.list_zero_accounts(
            cia, anio=anio, incluir_no_afectables=incluir_no_afectables,
            page=page, page_size=page_size,
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post("/api/especiales/cuentas-en-cero/eliminar", summary="Eliminar cuentas en cero")
def especiales_cuentas_cero_eliminar(
    payload: ZeroAccountRemoval,
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Revalida cada cuenta en el servidor y registra el motivo en la bitácora (4.2)."""
    try:
        return store.delete_zero_accounts(
            cia, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


# ===========================================================================
# Bloque E1 · Reasignación de NIT (solo PostgreSQL; el legado no tiene rutina)
# ===========================================================================
class ThirdPartyReassignment(BaseModel):
    """Reescritura de las referencias contables de un NIT (E1)."""

    model_config = ConfigDict(extra="forbid")

    nitNuevo: str = Field(pattern=r"^[0-9]{1,10}$")
    motivo: str = Field(min_length=5, max_length=180)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    alcance: Literal["todo", "desdeFecha"] = "todo"
    fecha: date | None = None

    @model_validator(mode="after")
    def _fecha_si_desde_fecha(self) -> "ThirdPartyReassignment":
        if self.alcance == "desdeFecha" and self.fecha is None:
            raise ValueError("El alcance 'desdeFecha' exige la fecha.")
        return self


@app.post("/api/terceros/{nit}/reasignar", summary="Reasignar las referencias de un NIT")
def tercero_reasignar(
    payload: ThirdPartyReassignment,
    nit: str = Path(pattern=r"^[0-9]{1,10}$"),
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Reescribe el libro del NIT origen al destino, con informe de impacto (E1)."""
    try:
        return store.reassign_third_party(
            cia, nit, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


# ===========================================================================
# Bloque E2 · Reembolsos (solo PostgreSQL: CONREMAE/CONREITE sin estructura)
# ===========================================================================
class RefundLineWrite(BaseModel):
    """Partida de un reembolso (E2)."""

    model_config = ConfigDict(extra="forbid")

    numeroLinea: int = Field(1, ge=1)
    cuenta: str = Field(pattern=r"^[0-9]{1,12}$")
    centro: str = Field("", max_length=7)
    concepto: str = Field("", max_length=50)
    debito: float = Field(0, ge=0)
    credito: float = Field(0, ge=0)
    documentoSoporte: str = Field("", max_length=12)


class RefundWrite(BaseModel):
    """Alta del reembolso con sus líneas (E2 §2.2)."""

    model_config = ConfigDict(extra="forbid")

    numero: str = Field(min_length=1, max_length=12)
    fecha: date
    periodo: str = Field(pattern=r"^(0[0-9]|1[0-8])$")
    tercero: str = Field(min_length=1, max_length=15)
    cajaMenor: str = Field("", max_length=60)
    lineas: list[RefundLineWrite] = Field(min_length=2, max_length=200)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field("", max_length=180)


class RefundUpdate(BaseModel):
    """Modificación del borrador: `RefundWrite` sin `numero` (E2 §2.3)."""

    model_config = ConfigDict(extra="forbid")

    fecha: date
    periodo: str = Field(pattern=r"^(0[0-9]|1[0-8])$")
    tercero: str = Field(min_length=1, max_length=15)
    cajaMenor: str = Field("", max_length=60)
    lineas: list[RefundLineWrite] = Field(min_length=2, max_length=200)
    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field("", max_length=180)


class RefundApply(BaseModel):
    """Confirmación del usuario que aplica el reembolso (E2 §2.4)."""

    model_config = ConfigDict(extra="forbid")

    usuario: str = Field("WEB", min_length=1, max_length=4)
    motivo: str = Field(min_length=5, max_length=180)


@app.get("/api/reembolsos", summary="Listar reembolsos con su estado")
def reembolsos_listar(
    cia: str = _CIA_QUERY,
    anio: int = Query(ge=1900, le=2100),
    estado: Literal["todos", "Borrador", "Aplicado", "Anulado"] = Query("todos"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    """Reembolsos con su total calculado sumando líneas (2.1)."""
    try:
        return store.list_reimbursements(
            cia, anio=anio, estado=estado, page=page, page_size=page_size
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post("/api/reembolsos", status_code=status.HTTP_201_CREATED, summary="Crear reembolso")
def reembolso_crear(
    payload: RefundWrite,
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Nace `Borrador`, exige cuadre y numero unico por compania y ano (2.2)."""
    try:
        return store.create_reimbursement(
            cia, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.put("/api/reembolsos/{numero}", summary="Modificar el borrador")
def reembolso_actualizar(
    payload: RefundUpdate,
    numero: str = Path(min_length=1, max_length=12),
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Solo en `Borrador`; reemplaza las líneas en bloque (2.3)."""
    try:
        return store.update_reimbursement(
            cia, numero, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc


@app.post("/api/reembolsos/{numero}/aplicar", summary="Aplicar el reembolso")
def reembolso_aplicar(
    payload: RefundApply,
    numero: str = Path(min_length=1, max_length=12),
    cia: str = _CIA_QUERY,
    dry_run: bool = Query(False, alias="dryRun", description="Informa sin escribir."),
) -> dict[str, object]:
    """Crea el lote real con sus líneas y liga `lote_id`; idempotente (2.4)."""
    try:
        return store.apply_reimbursement(
            cia, numero, payload.model_dump(), user=payload.usuario, dry_run=dry_run
        )
    except Exception as exc:
        raise _service_error(exc) from exc
