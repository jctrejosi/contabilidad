"""Contratos y rama Advantage del bloque D2: cierres.

**Doble motor declarado (R10).** Las cuatro rutas del bloque tienen el mismo
contrato JSON en los dos motores. Este módulo concentra:

- el contrato **puro** que comparten las ramas (``normalize_*``, el armado del
  checklist y el cálculo de las partidas del cierre), de modo que el resultado no
  pueda divergir entre motores;
- la rama **Advantage**, que en este bloque es una **declaración de alcance**:
  ``cierres`` y ``cierre_traslados`` son tablas nuevas
  (``db/postgresql/schema/07_procesos.sql:34-64``) y el legado no tiene el cierre
  como fila ni contraparte de ninguna de las dos. Por eso las cuatro rutas
  declaran la brecha con **503** (el mismo patrón de ``CONSOLID`` en D3 y de las
  tablas nuevas de A5).

La rama de PostgreSQL vive en :mod:`backend.postgres_repository` (lecturas y el
checklist calculado) y :mod:`backend.postgres_writes` (apertura, lote y traslado);
el despacho por operación está en :mod:`backend.store` (R1).

**Alcance declarado.** La parte funcional del cierre (el algoritmo de resultado y
la apertura del año siguiente) está pendiente en
``db/migration/03_plan_de_carga.md:156-162``. Este bloque implementa el estado, el
checklist y la **generación del lote** a partir de los saldos del año; **no** cierra
el año ni abre el siguiente. Los períodos ``13``..``18`` no existen en toda la copia
(decisión P-5, ``db/migration/homologacion/PENDIENTES.md``): el traslado los exige
**consultando** ``periodos_contables`` y declara 422 cuando el motor no los tiene
sembrados, sin inventarlos.
"""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Any

# ---------------------------------------------------------------------------
# Constantes de contrato (R6: los códigos se validan con patrón)
# ---------------------------------------------------------------------------
COMPANY_CODE = re.compile(r"^[0-9]{1,3}$")
ACCOUNT_CODE = re.compile(r"^[0-9]{1,12}$")
# El mismo patrón de período que declara el detalle (§1.3, §1.4).
PERIOD_CODE = re.compile(r"^(0[0-9]|1[0-8])$")

MIN_REASON = 5
MAX_REASON = 180
MAX_USER = 4

# Confirmación literal del asistente de traslado (§1.4).
TRANSFER_CONFIRMATION = "TRASLADAR"

# Prefijo del lote de cierre: ``CI`` + dos dígitos del año (``CI26``).
CLOSING_LOT_PREFIX = "CI"
# Prefijo del lote de un traslado: ``TR`` + el período destino (``TR01``).
TRANSFER_LOT_PREFIX = "TR"

# Las cuentas de resultado del PUC son las clases 4 (ingresos), 5 (gastos),
# 6 (costos de venta) y 7 (costos de produccion): son las que **se cancelan**. El
# modelo nuevo no marca las cuentas con una columna "es de resultado".
RESULT_ACCOUNT_CLASSES = ("4", "5", "6", "7")
# La cuenta que **recibe** el cierre no es una cuenta de resultado sino una cuenta
# patrimonial del ejercicio (clase 3: grupo 36 "Resultados del ejercicio" en el
# PUC). El prototipo lo confirma: cancela las clases 4 a 7 "contra la cuenta de
# resultados del ejercicio" y su campo viene con una cuenta de clase 3
# (``Cierres.tsx:88-91``).
RECEIVER_ACCOUNT_CLASSES = ("3",)

MAX_TRANSFER_LINES = 5000

# ---------------------------------------------------------------------------
# Mensajes declarados de la rama heredada
# ---------------------------------------------------------------------------
LEGACY_MESSAGE = (
    "Los cierres requieren la tabla nueva ``cierres`` (y ``cierre_traslados`` "
    "para el traslado de períodos): el legado Advantage no tiene el cierre como "
    "fila ni contraparte de esas tablas "
    "(db/postgresql/schema/07_procesos.sql:34-64). Las cuatro rutas del bloque D2 "
    "solo están implementadas con PostgreSQL."
)

# ---------------------------------------------------------------------------
# Excepciones de dominio (R5)
# ---------------------------------------------------------------------------
class CierreNotFound(RuntimeError):
    """No existe el cierre pedido para la compañía activa (404)."""


class CierreConflict(RuntimeError):
    """El cierre choca con su estado, con otro cierre del año o con un lote ya generado (409)."""


class CierreValidationError(ValueError):
    """La operación de cierre incumple las reglas del modelo (422)."""


class CierresLegacyNotSupported(RuntimeError):
    """La operación no tiene representación honesta en el legado (503, R10)."""


# ---------------------------------------------------------------------------
# Helpers puros de contrato
# ---------------------------------------------------------------------------
def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _anio(value: Any, error: type[ValueError] = CierreValidationError) -> int:
    try:
        anio = int(value)
    except (TypeError, ValueError) as exc:
        raise error("El año del cierre es obligatorio y debe ser un número.") from exc
    if not 1900 <= anio <= 2100:
        raise error("El año del cierre debe estar entre 1900 y 2100.")
    return anio


def _periodo(value: Any, campo: str) -> str:
    periodo = _text(value).zfill(2)
    if not PERIOD_CODE.fullmatch(periodo):
        raise CierreValidationError(
            f"El período de {campo} debe estar entre 00 y 18."
        )
    return periodo


def _cuenta(value: Any, campo: str) -> str:
    codigo = _text(value)
    if not ACCOUNT_CODE.fullmatch(codigo):
        raise CierreValidationError(f"La cuenta de {campo} debe tener entre 1 y 12 dígitos.")
    return codigo


def _monto(value: Any, campo: str) -> Decimal:
    try:
        monto = Decimal(str(value if value not in (None, "") else 0)).quantize(Decimal("0.01"))
    except Exception as exc:
        raise CierreValidationError(f"El {campo} debe ser un valor numérico.") from exc
    if monto < 0:
        raise CierreValidationError(f"El {campo} no puede ser negativo.")
    return monto


def _usuario(value: Any) -> str:
    usuario = _text(value).upper() or "WEB"
    if len(usuario) > MAX_USER:
        raise CierreValidationError(f"El usuario admite máximo {MAX_USER} caracteres.")
    return usuario


def _motivo(value: Any) -> str:
    motivo = _text(value)
    if not MIN_REASON <= len(motivo) <= MAX_REASON:
        raise CierreValidationError(
            f"El motivo es obligatorio y debe tener entre {MIN_REASON} y {MAX_REASON} caracteres."
        )
    return motivo


# ---------------------------------------------------------------------------
# Normalización de los cuerpos (validación antes de abrir la conexión)
# ---------------------------------------------------------------------------
def normalize_close(payload: dict[str, Any]) -> dict[str, Any]:
    """Cuerpo de ``CloseRequest``: año, usuario y motivo (§1.2)."""
    return {
        "anio": _anio(payload.get("anio")),
        "usuario": _usuario(payload.get("usuario")),
        "motivo": _motivo(payload.get("motivo")),
    }


def normalize_lot_action(payload: dict[str, Any]) -> dict[str, Any]:
    """Cuerpo de ``LotActionRequest``: usuario, motivo, mes y cuenta de resultado (§1.3)."""
    return {
        "usuario": _usuario(payload.get("usuario")),
        "motivo": _motivo(payload.get("motivo")),
        "mes": _periodo(payload.get("mes"), "mes"),
        "cuenta_resultado": _cuenta(payload.get("cuentaResultado"), "resultado"),
    }


def normalize_transfer(payload: dict[str, Any]) -> dict[str, Any]:
    """Cuerpo de ``CloseTransferRequest``: matriz origen/destino y confirmación (§1.4).

    Valida lo que no necesita el motor: que haya al menos una línea, que cada
    período y cuenta tengan forma, que cada línea tenga un solo lado y que la
    matriz cuadre. Cada línea puede llevar ``nit`` y ``centro`` —los documentos del
    período destino los conservan— para las cuentas que controlan tercero o centro;
    la matriz ``cierre_traslados`` los descarta porque su clave es la cuenta. La
    existencia real de los períodos se consulta contra ``periodos_contables`` en el
    repositorio (P-5).
    """
    entrada = payload.get("traslados")
    if not isinstance(entrada, list) or not entrada:
        raise CierreValidationError("El traslado requiere al menos una línea.")
    if len(entrada) > MAX_TRANSFER_LINES:
        raise CierreValidationError(f"El traslado admite máximo {MAX_TRANSFER_LINES} líneas.")

    traslados: list[dict[str, Any]] = []
    for indice, item in enumerate(entrada, 1):
        if not isinstance(item, dict):
            raise CierreValidationError(f"La línea {indice} del traslado no tiene el formato esperado.")
        debito = _monto(item.get("debito"), f"débito de la línea {indice}")
        credito = _monto(item.get("credito"), f"crédito de la línea {indice}")
        if debito > 0 and credito > 0:
            raise CierreValidationError(
                f"La línea {indice} del traslado no puede tener débito y crédito a la vez."
            )
        if debito == 0 and credito == 0:
            raise CierreValidationError(
                f"La línea {indice} del traslado debe tener un valor débito o crédito."
            )
        traslados.append(
            {
                "origen": _periodo(item.get("origenPeriodo"), f"origen de la línea {indice}"),
                "destino": _periodo(item.get("destinoPeriodo"), f"destino de la línea {indice}"),
                "cuenta": _cuenta(item.get("cuenta"), f"la línea {indice}"),
                "nit": _text(item.get("nit")),
                "centro": _text(item.get("centro")).upper(),
                "debito": debito,
                "credito": credito,
            }
        )

    total_debito = sum((linea["debito"] for linea in traslados), Decimal("0"))
    total_credito = sum((linea["credito"] for linea in traslados), Decimal("0"))
    if total_debito != total_credito:
        raise CierreValidationError(
            "El traslado no cuadra: el total de débitos debe igualar el de créditos."
        )

    confirmacion = _text(payload.get("confirmacion"))
    if confirmacion != TRANSFER_CONFIRMATION:
        raise CierreValidationError(
            f"La confirmación debe ser el texto literal {TRANSFER_CONFIRMATION}."
        )
    return {
        "traslados": traslados,
        "usuario": _usuario(payload.get("usuario")),
        "motivo": _motivo(payload.get("motivo")),
        "confirmacion": confirmacion,
    }


# ---------------------------------------------------------------------------
# Checklist calculado (contrato puro que comparten los motores)
# ---------------------------------------------------------------------------
def build_checklist(signals: dict[str, Any]) -> list[dict[str, Any]]:
    """Los siete items del checklist de ``Cierres.tsx``, con su cálculo.

    ``signals`` trae lo que se leyó de la base (lotes pendientes, cuadre del
    balance, estado de los acumulados y respaldo). Un item solo se declara
    **cumplido** cuando hay evidencia en el libro: un año sin lotes o sin saldos
    no "cuadra" por vacío (§1.1, criterio vacío). Los dos items sin fuente en el
    modelo disponible (``c3`` conciliaciones bancarias y ``c7`` usuarios
    informados) se declaran **no cumplidos** con su causa: no se inventa un valor
    fijo como en ``INITIAL_CHECKS``.
    """
    return [
        {
            "id": "c1",
            "label": "Todos los lotes contabilizados",
            "bloqueante": True,
            "cumplido": bool(signals.get("lotes_con_datos", False))
            and int(signals.get("lotes_pendientes", 0)) == 0,
            "detalle": signals.get("lotes_detalle", ""),
        },
        {
            "id": "c2",
            "label": "Balance cuadrado (dif = 0)",
            "bloqueante": True,
            "cumplido": bool(signals.get("balance_con_datos", False))
            and bool(signals.get("balance_cuadrado", False)),
            "detalle": signals.get("balance_detalle", ""),
        },
        {
            "id": "c3",
            "label": "Conciliaciones bancarias completas",
            "bloqueante": False,
            "cumplido": False,
            "detalle": "Sin tabla de conciliaciones bancarias en el modelo disponible.",
        },
        {
            "id": "c4",
            "label": "Retenciones acumuladas",
            "bloqueante": False,
            "cumplido": bool(signals.get("retencion_al_dia", False)),
            "detalle": signals.get("retencion_detalle", ""),
        },
        {
            "id": "c5",
            "label": "IVA acumulado",
            "bloqueante": False,
            "cumplido": bool(signals.get("iva_al_dia", False)),
            "detalle": signals.get("iva_detalle", ""),
        },
        {
            "id": "c6",
            "label": "Respaldo de base de datos realizado",
            "bloqueante": True,
            "cumplido": bool(signals.get("respaldo", False)),
            "detalle": signals.get("respaldo_detalle", ""),
        },
        {
            "id": "c7",
            "label": "Usuarios informados del cierre",
            "bloqueante": False,
            "cumplido": False,
            "detalle": "Sin registro de notificación a usuarios en el modelo disponible.",
        },
    ]


def puede_cerrar(checklist: list[dict[str, Any]]) -> bool:
    """Falso si algún item **bloqueante** no está cumplido (§1.1)."""
    return not any(item["bloqueante"] and not item["cumplido"] for item in checklist)


# ---------------------------------------------------------------------------
# Cálculo de las partidas del lote de cierre (contrato puro)
# ---------------------------------------------------------------------------
def calcular_lineas_cierre(
    saldos: list[dict[str, Any]], cuenta_resultado: str
) -> list[dict[str, Any]]:
    """Cancela cada saldo de resultado contra ``cuenta_resultado`` (§1.3).

    ``saldos`` son unidades ``{"cuenta", "saldo", "nit", "centro"}``. El ``saldo``
    usa la convención del libro (positivo de naturaleza débito, negativo de
    naturaleza crédito). Cada unidad se cancela con el signo contrario y el neto se
    lleva a la cuenta de resultado, de modo que el lote nace cuadrado. La unidad
    conserva su tercero y su centro —la expansión la hace la lectura, que los saca
    de los saldos por tercero y por centro— para que el cierre deje en cero también
    los auxiliares; la partida del neto va sin dimensiones. Las unidades con saldo
    cero no generan partida.
    """
    lineas: list[dict[str, Any]] = []
    total = Decimal("0")
    for unidad in saldos:
        codigo = _text(unidad.get("cuenta"))
        valor = Decimal(str(unidad.get("saldo") or 0))
        if valor == 0:
            continue
        partida = {
            "cuenta": codigo,
            "nit": _text(unidad.get("nit")),
            "centro": _text(unidad.get("centro")),
        }
        if valor > 0:
            lineas.append({**partida, "debito": 0.0, "credito": float(valor)})
        else:
            lineas.append({**partida, "debito": float(-valor), "credito": 0.0})
        total += valor
    if total != 0:
        neto = {"cuenta": cuenta_resultado, "nit": "", "centro": ""}
        if total > 0:
            lineas.append({**neto, "debito": float(total), "credito": 0.0})
        else:
            lineas.append({**neto, "debito": 0.0, "credito": float(-total)})
    return lineas


def totales_de_lineas(lineas: list[dict[str, Any]]) -> dict[str, Any]:
    """Conteo, totales y cuadre de un conjunto de partidas (contrato del lote)."""
    debito = sum((Decimal(str(linea.get("debito") or 0)) for linea in lineas), Decimal("0"))
    credito = sum((Decimal(str(linea.get("credito") or 0)) for linea in lineas), Decimal("0"))
    return {
        "lineas": len(lineas),
        "debito": float(debito),
        "credito": float(credito),
        "cuadrado": debito == credito,
    }


# ---------------------------------------------------------------------------
# Rama Advantage: declarada no soportada (R10)
# ---------------------------------------------------------------------------
def list_cierres(cia: str, anio: int) -> dict[str, Any]:
    """Estado y checklist del cierre: sin representación en el legado (§1.1)."""
    _anio(anio)
    raise CierresLegacyNotSupported(LEGACY_MESSAGE)


def create_cierre(
    cia: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Apertura del cierre: no hay tabla ``cierres`` en el legado (§1.2)."""
    normalize_close(payload)
    raise CierresLegacyNotSupported(LEGACY_MESSAGE)


def generate_cierre_lot(
    cia: str, cierre_id: int, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Lote de cierre: depende de la tabla ``cierres`` (§1.3)."""
    normalize_lot_action(payload)
    raise CierresLegacyNotSupported(LEGACY_MESSAGE)


def transfer_cierre(
    cia: str, cierre_id: int, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Traslado de períodos: no existe ``cierre_traslados`` en el legado (§1.4)."""
    normalize_transfer(payload)
    raise CierresLegacyNotSupported(LEGACY_MESSAGE)
