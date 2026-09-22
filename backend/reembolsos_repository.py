"""Bloque E2 · reembolsos de caja menor: contrato y las dos ramas de motor (R10).

**Brecha declarada.** Las tablas del legado ``CONREMAE`` (encabezado) y
``CONREITE`` (detalle) figuran en la matriz de migración como *"Sin estructura,
estructura física no localizada"*: no se pudo leer su forma física, así que no hay
una rutina de reembolsos que reproducir. La rama Advantage **declara** la brecha
con 503 (:class:`RefundLegacyNotSupported`); solo PostgreSQL implementa las cuatro
rutas sobre ``reembolsos`` y ``reembolso_lineas``
(``db/postgresql/schema/11_ampliaciones.sql:33-71``).

**Reglas de negocio.** El ``numero`` es manual y único por compañía y año (409). El
reembolso nace ``Borrador`` y exige cuadre (suma de débitos igual a la de créditos,
422), cuentas y centros existentes (422) y un tercero existente (422). El total
**se calcula sumando las líneas**, nunca desde un campo precalculado. ``update``
solo actúa en ``Borrador`` (409 en ``Aplicado``/``Anulado``), reemplaza las líneas
en bloque y recalcula el período cuando cambia la fecha. ``apply`` crea el lote real
reutilizando ``store.create_lot``/``store.save_lot_line`` (como
``generate_cierre_lot`` en :mod:`backend.postgres_writes`), marca ``Aplicado`` y liga
``lote_id``; aplicar dos veces devuelve 409 con el lote ya creado.

**Toda escritura** deja fila en ``auditoria`` con un INSERT explícito (los
disparadores de ``reembolsos`` son solo BEFORE UPDATE, no cubren el alta de líneas).
"""

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any

# ---------------------------------------------------------------------------
# Constantes de contrato (R6: los códigos se validan con patrón)
# ---------------------------------------------------------------------------
NIT_CODE = re.compile(r"^[0-9]{1,10}$")
ACCOUNT_CODE = re.compile(r"^[0-9]{1,12}$")
# El mismo patrón de período que declara el contrato (§2.2, igual que LotWrite.mes).
PERIOD_CODE = re.compile(r"^(0[0-9]|1[0-8])$")

MIN_REASON = 5
MAX_REASON = 180
MAX_USER = 4

MIN_LINES = 2
MAX_LINES = 200

MAX_NUMBER = 12
MAX_PAGE_SIZE = 200

ESTADOS = ("Borrador", "Aplicado", "Anulado")
LIST_ESTADOS = ("todos", *ESTADOS)

# Prefijo del lote que genera un reembolso: ``RB`` + el período (``RB02``).
REFUND_LOT_PREFIX = "RB"

_MESES = {
    "00": "Saldos Iniciales", "01": "Enero", "02": "Febrero", "03": "Marzo",
    "04": "Abril", "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
    "13": "Ajuste 13", "14": "Ajuste 14", "15": "Ajuste 15", "16": "Ajuste 16",
    "17": "Ajuste 17", "18": "Ajuste 18",
}

# ---------------------------------------------------------------------------
# Mensaje declarado de la rama heredada
# ---------------------------------------------------------------------------
LEGACY_MESSAGE = (
    "Los reembolsos no están implementados en Advantage: CONREMAE y CONREITE "
    "figuran en la matriz de migración como «Sin estructura, estructura física no "
    "localizada», así que no hay una rutina del legado que reproducir. Solo están "
    "implementados con PostgreSQL."
)


# ---------------------------------------------------------------------------
# Excepciones de dominio (R5). El mapeo a HTTP lo hace la capa de servicio.
# ---------------------------------------------------------------------------
class RefundNotFound(RuntimeError):
    """No existe el reembolso pedido para la compañía activa (404)."""


class RefundConflict(RuntimeError):
    """El reembolso choca con su estado, con su unicidad o con un lote ya creado (409)."""


class RefundValidationError(ValueError):
    """El reembolso incumple las reglas del modelo (422)."""


class RefundLegacyNotSupported(RuntimeError):
    """La operación no tiene representación honesta en el legado (503, R10)."""


# ---------------------------------------------------------------------------
# Helpers puros de contrato
# ---------------------------------------------------------------------------
def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _usuario(value: Any, default: str = "WEB") -> str:
    usuario = _text(value).upper() or _text(default).upper() or "WEB"
    if len(usuario) > MAX_USER:
        raise RefundValidationError(f"El usuario admite máximo {MAX_USER} caracteres.")
    return usuario


def _motivo(value: Any) -> str:
    motivo = _text(value)
    if not MIN_REASON <= len(motivo) <= MAX_REASON:
        raise RefundValidationError(
            f"El motivo es obligatorio y debe tener entre {MIN_REASON} y {MAX_REASON} caracteres."
        )
    return motivo


def _anio(value: Any) -> int:
    try:
        anio = int(value)
    except (TypeError, ValueError) as exc:
        raise RefundValidationError("El año es obligatorio y debe ser un número.") from exc
    if not 1900 <= anio <= 2100:
        raise RefundValidationError("El año debe estar entre 1900 y 2100.")
    return anio


def _entero(value: Any, campo: str) -> int:
    try:
        numero = int(value)
    except (TypeError, ValueError) as exc:
        raise RefundValidationError(f"El {campo} debe ser un número entero.") from exc
    if numero < 1:
        raise RefundValidationError(f"El {campo} debe ser mayor que cero.")
    return numero


def _numero(value: Any) -> str:
    numero = _text(value)
    if not 1 <= len(numero) <= MAX_NUMBER:
        raise RefundValidationError(
            f"El número del reembolso es obligatorio y admite máximo {MAX_NUMBER} caracteres."
        )
    return numero


def _nit(value: Any, campo: str = "tercero") -> str:
    nit = _text(value)
    if not NIT_CODE.fullmatch(nit):
        raise RefundValidationError(f"El NIT de {campo} debe tener entre 1 y 10 dígitos.")
    return nit


def _cuenta(value: Any, campo: str) -> str:
    cuenta = _text(value)
    if not ACCOUNT_CODE.fullmatch(cuenta):
        raise RefundValidationError(f"La cuenta de {campo} debe tener entre 1 y 12 dígitos.")
    return cuenta


def _centro(value: Any) -> str:
    centro = _text(value).upper()
    if len(centro) > 7:
        raise RefundValidationError("El centro de costo admite máximo 7 caracteres.")
    return centro


def _periodo(value: Any, campo: str) -> str:
    periodo = _text(value).zfill(2)
    if not PERIOD_CODE.fullmatch(periodo):
        raise RefundValidationError(f"El período de {campo} debe estar entre 00 y 18.")
    return periodo


def _periodo_de_fecha(fecha: date) -> str:
    """Período contable que corresponde a una fecha (mes de dos dígitos)."""
    return f"{fecha.month:02d}"


def _fecha(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(_text(value))
    except ValueError as exc:
        raise RefundValidationError("La fecha del reembolso no es válida.") from exc


def _monto(value: Any, campo: str) -> Decimal:
    try:
        monto = Decimal(str(value if value not in (None, "") else 0)).quantize(Decimal("0.01"))
    except Exception as exc:
        raise RefundValidationError(f"El {campo} debe ser un valor numérico.") from exc
    if monto < 0:
        raise RefundValidationError(f"El {campo} no puede ser negativo.")
    return monto


# ---------------------------------------------------------------------------
# Normalización de los cuerpos (validación antes de abrir la conexión)
# ---------------------------------------------------------------------------
def _lineas(value: Any) -> list[dict[str, Any]]:
    """Líneas de ``RefundLineWrite`` con su forma y su lado único validados.

    Cada línea admite un solo lado: el modelo prohíbe débito y crédito a la vez
    (``reembolso_lineas_sin_doble_valor``) y una línea sin ninguno de los dos no
    aporta nada, así que también se rechaza (§2.2, criterio vacío).
    """
    if not isinstance(value, list) or not MIN_LINES <= len(value) <= MAX_LINES:
        raise RefundValidationError(
            f"El reembolso requiere entre {MIN_LINES} y {MAX_LINES} líneas."
        )
    lineas: list[dict[str, Any]] = []
    for indice, item in enumerate(value, 1):
        if not isinstance(item, dict):
            raise RefundValidationError(f"La línea {indice} no tiene el formato esperado.")
        debito = _monto(item.get("debito"), f"débito de la línea {indice}")
        credito = _monto(item.get("credito"), f"crédito de la línea {indice}")
        if debito > 0 and credito > 0:
            raise RefundValidationError(
                f"La línea {indice} no puede tener débito y crédito a la vez."
            )
        if debito == 0 and credito == 0:
            raise RefundValidationError(
                f"La línea {indice} debe tener un valor débito o crédito."
            )
        lineas.append(
            {
                "numero_linea": _entero(item.get("numeroLinea"), f"número de línea {indice}"),
                "cuenta": _cuenta(item.get("cuenta"), f"la línea {indice}"),
                "centro": _centro(item.get("centro")),
                "concepto": _text(item.get("concepto")),
                "documento_soporte": _text(item.get("documentoSoporte")),
                "debito": debito,
                "credito": credito,
            }
        )
    return lineas


def totales_de_lineas(lineas: list[dict[str, Any]]) -> dict[str, Any]:
    """Conteo, totales y cuadre de un conjunto de líneas de reembolso (contrato puro)."""
    debito = sum((Decimal(str(linea.get("debito") or 0)) for linea in lineas), Decimal("0"))
    credito = sum((Decimal(str(linea.get("credito") or 0)) for linea in lineas), Decimal("0"))
    return {
        "lineas": len(lineas),
        "debito": float(debito),
        "credito": float(credito),
        "cuadrado": debito == credito,
    }


def _cuerpo(payload: dict[str, Any], default_user: str = "WEB") -> dict[str, Any]:
    """Campos de ``RefundWrite`` salvo ``numero``, con el cuadre ya resuelto (§2.2)."""
    fecha = _fecha(payload.get("fecha"))
    lineas = _lineas(payload.get("lineas"))
    total_debito = sum((linea["debito"] for linea in lineas), Decimal("0"))
    total_credito = sum((linea["credito"] for linea in lineas), Decimal("0"))
    if total_debito != total_credito:
        raise RefundValidationError(
            "El reembolso no cuadra: el total de débitos debe igualar el de créditos."
        )
    return {
        "fecha": fecha,
        "periodo": _periodo(payload.get("periodo"), "el reembolso"),
        "tercero": _nit(payload.get("tercero")),
        "caja_menor": _text(payload.get("cajaMenor")),
        "usuario": _usuario(payload.get("usuario"), default_user),
        "lineas": lineas,
        "total_debito": total_debito,
        "total_credito": total_credito,
        "cuadrado": True,
    }


def normalize_reimbursement(payload: dict[str, Any], default_user: str = "WEB") -> dict[str, Any]:
    """Cuerpo de ``RefundWrite``: número manual más el resto del contrato (§2.2)."""
    return {"numero": _numero(payload.get("numero")), **_cuerpo(payload, default_user)}


def normalize_refund_update(payload: dict[str, Any], default_user: str = "WEB") -> dict[str, Any]:
    """Cuerpo de ``PUT /api/reembolsos/{numero}``: igual que el alta, sin número."""
    return _cuerpo(payload, default_user)


def normalize_refund_query(
    *, anio: Any, estado: str = "todos", page: int = 1, page_size: int = 50
) -> dict[str, Any]:
    """Consulta de ``GET /api/reembolsos``: año, estado y paginación (§2.1)."""
    estado = _text(estado) or "todos"
    if estado not in LIST_ESTADOS:
        raise RefundValidationError(
            f"El estado debe ser uno de: {', '.join(LIST_ESTADOS)}."
        )
    tamano = _entero(page_size, "pageSize")
    if tamano > MAX_PAGE_SIZE:
        raise RefundValidationError(f"pageSize admite máximo {MAX_PAGE_SIZE}.")
    return {
        "anio": _anio(anio),
        "estado": estado,
        "page": _entero(page, "page"),
        "page_size": tamano,
    }


def normalize_refund_action(payload: dict[str, Any], default_user: str = "WEB") -> dict[str, Any]:
    """Cuerpo de ``LotActionRequest`` para aplicar el reembolso (§2.4)."""
    return {
        "usuario": _usuario(payload.get("usuario"), default_user),
        "motivo": _motivo(payload.get("motivo")),
    }


# ---------------------------------------------------------------------------
# Respuestas de contrato
# ---------------------------------------------------------------------------
def _item(reembolso: dict[str, Any]) -> dict[str, Any]:
    return {
        "numero": reembolso["numero"],
        "fecha": reembolso["fecha"],
        "periodo": reembolso["periodo"],
        "tercero": reembolso["tercero"],
        "nombreTercero": reembolso["nombreTercero"],
        "cajaMenor": reembolso["cajaMenor"],
        "estado": reembolso["estado"],
        "lote": reembolso["lote"],
        "total": reembolso["total"],
    }


def _item_escritura(numero: str, data: dict[str, Any], *, estado: str, dry_run: bool) -> dict[str, Any]:
    return {
        "numero": numero,
        "estado": estado,
        "debito": float(data["total_debito"]),
        "credito": float(data["total_credito"]),
        "lineas": len(data["lineas"]),
        "cuadrado": data["cuadrado"],
        "dryRun": dry_run,
    }


# ---------------------------------------------------------------------------
# Rama Advantage: declarada no soportada (R10)
# ---------------------------------------------------------------------------
def list_reimbursements(
    cia: str, *, anio: int, estado: str = "todos", page: int = 1, page_size: int = 50
) -> dict[str, Any]:
    """Lista los reembolsos de la compañía con su estado y su total (§2.1)."""
    from .store import is_postgres

    data = normalize_refund_query(anio=anio, estado=estado, page=page, page_size=page_size)
    if not is_postgres():
        raise RefundLegacyNotSupported(LEGACY_MESSAGE)
    return _list_postgres(cia, data)


def create_reimbursement(
    cia: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Crea el reembolso y sus líneas en estado ``Borrador`` (§2.2)."""
    from .store import is_postgres

    data = normalize_reimbursement(payload, user)
    if not is_postgres():
        raise RefundLegacyNotSupported(LEGACY_MESSAGE)
    return _create_postgres(cia, data, payload, dry_run=dry_run)


def update_reimbursement(
    cia: str,
    numero: str,
    payload: dict[str, Any],
    *,
    user: str = "WEB",
    dry_run: bool = False,
) -> dict[str, Any]:
    """Modifica el borrador y reemplaza sus líneas en bloque (§2.3)."""
    from .store import is_postgres

    numero = _numero(numero)
    data = normalize_refund_update(payload, user)
    if not is_postgres():
        raise RefundLegacyNotSupported(LEGACY_MESSAGE)
    return _update_postgres(cia, numero, data, payload, dry_run=dry_run)


def apply_reimbursement(
    cia: str, numero: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Aplica el reembolso creando el lote real y ligándolo (§2.4)."""
    from .store import is_postgres

    numero = _numero(numero)
    data = normalize_refund_action(payload, user)
    if not is_postgres():
        raise RefundLegacyNotSupported(LEGACY_MESSAGE)
    return _apply_postgres(cia, numero, data, dry_run=dry_run)


# ---------------------------------------------------------------------------
# Helpers de motor (PostgreSQL)
# ---------------------------------------------------------------------------
def _asegurar_periodo(cursor: Any, compania_id: int, anio: int, periodo: str) -> None:
    """Abre la fila de ``periodos_contables`` si falta (decisión de escrituras)."""
    cursor.execute(
        "INSERT INTO periodos_contables (compania_id, anio, periodo, nombre, estado) "
        "VALUES (%s, %s, %s, %s, 'Abierto') "
        "ON CONFLICT (compania_id, anio, periodo) DO NOTHING",
        (compania_id, anio, periodo, _MESES.get(periodo, periodo)),
    )


def _tercero_id(cursor: Any, compania_id: int, nit: str) -> int:
    cursor.execute(
        "SELECT id FROM terceros WHERE compania_id = %s AND (nit = %s OR codigo_legado = %s) "
        "ORDER BY id LIMIT 1",
        (compania_id, nit, nit),
    )
    fila = cursor.fetchone()
    if fila is None:
        raise RefundValidationError(f"El tercero {nit} no existe para la compañía activa.")
    return int(fila[0])


def _cuentas_de(cursor: Any, compania_id: int, codigos: list[str]) -> dict[str, int]:
    """`codigo` de cuenta → `id`, verificando que existan en la compañía (422)."""
    ids: dict[str, int] = {}
    for codigo in dict.fromkeys(codigos):
        cursor.execute(
            "SELECT id FROM cuentas WHERE compania_id = %s AND codigo = %s",
            (compania_id, codigo),
        )
        fila = cursor.fetchone()
        if fila is None:
            raise RefundValidationError(f"La cuenta {codigo} no existe para la compañía activa.")
        ids[codigo] = int(fila[0])
    return ids


def _centros_de(cursor: Any, compania_id: int, codigos: list[str]) -> dict[str, int]:
    """`codigo` de centro → `id`, verificando que existan cuando llegan (422)."""
    ids: dict[str, int] = {}
    for codigo in dict.fromkeys(codigo for codigo in codigos if codigo):
        cursor.execute(
            "SELECT id FROM centros_costos WHERE compania_id = %s AND codigo = %s",
            (compania_id, codigo),
        )
        fila = cursor.fetchone()
        if fila is None:
            raise RefundValidationError(
                f"El centro de costo {codigo} no existe para la compañía activa."
            )
        ids[codigo] = int(fila[0])
    return ids


def _insertar_lineas(
    cursor: Any,
    reembolso_id: int,
    compania_id: int,
    lineas: list[dict[str, Any]],
    cuentas: dict[str, int],
    centros: dict[str, int],
) -> None:
    for linea in lineas:
        cursor.execute(
            "INSERT INTO reembolso_lineas (reembolso_id, compania_id, numero_linea, cuenta_id, "
            "centro_costo_id, concepto, debito, credito, documento_soporte) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (
                reembolso_id,
                compania_id,
                linea["numero_linea"],
                cuentas[linea["cuenta"]],
                centros.get(linea["centro"]) if linea["centro"] else None,
                linea["concepto"] or None,
                linea["debito"],
                linea["credito"],
                linea["documento_soporte"] or None,
            ),
        )


def _numero_existe(cursor: Any, compania_id: int, anio: int, numero: str) -> bool:
    cursor.execute(
        "SELECT 1 FROM reembolsos WHERE compania_id = %s AND anio = %s AND numero = %s",
        (compania_id, anio, numero),
    )
    return cursor.fetchone() is not None


def _reembolso_actual(cursor: Any, compania_id: int, numero: str) -> dict[str, Any] | None:
    """Cabecera editable del reembolso, bloqueada para actualizar.

    El contrato de ``PUT``/``apply`` identifica el reembolso solo por ``numero``
    (sin año); como el número es único por compañía y año, se toma el ejercicio más
    reciente cuando hubiera más de uno.
    """
    cursor.execute(
        "SELECT r.id, r.numero, r.estado, r.anio, r.periodo, r.fecha, r.lote_id, t.nit "
        "FROM reembolsos r JOIN terceros t ON t.id = r.tercero_id "
        "WHERE r.compania_id = %s AND r.numero = %s "
        "ORDER BY r.anio DESC, r.id DESC LIMIT 1 FOR UPDATE",
        (compania_id, numero),
    )
    fila = cursor.fetchone()
    if fila is None:
        return None
    return {
        "id": int(fila[0]),
        "numero": _text(fila[1]),
        "estado": _text(fila[2]),
        "anio": int(fila[3]),
        "periodo": _text(fila[4]),
        "fecha": fila[5],
        "lote_id": int(fila[6]) if fila[6] is not None else None,
        "tercero_nit": _text(fila[7]),
    }


def _lineas_de(cursor: Any, compania_id: int, reembolso_id: int) -> list[dict[str, Any]]:
    from .postgres_repository import _filas

    cursor.execute(
        "SELECT rl.numero_linea, c.codigo AS cuenta, cc.codigo AS centro, rl.concepto, "
        "rl.debito, rl.credito, rl.documento_soporte "
        "FROM reembolso_lineas rl "
        "JOIN cuentas c ON c.id = rl.cuenta_id "
        "LEFT JOIN centros_costos cc ON cc.id = rl.centro_costo_id "
        "WHERE rl.reembolso_id = %s AND rl.compania_id = %s ORDER BY rl.numero_linea",
        (reembolso_id, compania_id),
    )
    return _filas(cursor)


def _lote_de(cursor: Any, compania_id: int, lote_id: int | None) -> str:
    if lote_id is None:
        return ""
    cursor.execute(
        "SELECT codigo FROM lotes WHERE id = %s AND compania_id = %s", (lote_id, compania_id)
    )
    fila = cursor.fetchone()
    return _text(fila[0]) if fila else ""


def _masters_de_reembolso(cursor: Any, compania_id: int) -> dict[str, str]:
    """Comprobante y tipo de documento para armar las partidas del lote (§2.4).

    El reembolso no guarda comprobante ni tipo documental: se eligen los de la
    compañía (prefiriendo un recibo de caja) y un tipo que quepa en la partida
    (máximo dos caracteres, como ``VISDOCUM.CODIGO``), ligado al comprobante si
    existe. Sin los dos maestros no se puede armar una partida de lote.
    """
    cursor.execute(
        "SELECT id, codigo FROM comprobantes WHERE compania_id = %s "
        "AND eliminado_en IS NULL AND activo ORDER BY (codigo IN ('RC', 'CE', 'NI')) DESC, id "
        "LIMIT 1",
        (compania_id,),
    )
    comprobante = cursor.fetchone()
    comprobante_id = int(comprobante[0]) if comprobante is not None else None
    cursor.execute(
        "SELECT codigo FROM tipos_documento WHERE compania_id = %s AND char_length(codigo) <= 2 "
        "ORDER BY (comprobante_id = %s) DESC NULLS LAST, id LIMIT 1",
        (compania_id, comprobante_id),
    )
    tipo = cursor.fetchone()
    if comprobante is None or tipo is None:
        raise RefundValidationError(
            "La compañía no tiene comprobantes ni tipos de documento de máximo dos "
            "caracteres configurados para armar las partidas del reembolso."
        )
    return {"comprobante": _text(comprobante[1]), "tipo_documento": _text(tipo[0])}


def _partidas_de_lote(
    cursor: Any, compania_id: int, reembolso: dict[str, Any], lineas: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Traduce las líneas del reembolso al contrato de ``save_lot_line``.

    El tercero del encabezado solo viaja en las cuentas que lo controlan y el centro
    solo en las que controlan centro: ``_ids_de_maestros`` rechaza ambas cosas al
    revés. Se valida antes de crear el lote para no dejar un lote a medias.
    """
    masters = _masters_de_reembolso(cursor, compania_id)
    partidas: list[dict[str, Any]] = []
    for linea in lineas:
        cursor.execute(
            "SELECT afectable, controla_tercero, controla_centro FROM cuentas "
            "WHERE compania_id = %s AND codigo = %s",
            (compania_id, linea["cuenta"]),
        )
        fila = cursor.fetchone()
        if fila is None:
            raise RefundValidationError(
                f"La cuenta {linea['cuenta']} no existe para la compañía activa."
            )
        afectable, controla_tercero, controla_centro = fila
        if not afectable:
            raise RefundValidationError(
                f"La cuenta {linea['cuenta']} no permite movimiento contable."
            )
        centro = _text(linea["centro"]) if controla_centro else ""
        if controla_centro and not centro:
            raise RefundValidationError(
                f"La cuenta {linea['cuenta']} requiere centro de costo para armar el lote."
            )
        partidas.append(
            {
                "cuenta": linea["cuenta"],
                "nit": _text(reembolso["tercero_nit"]) if controla_tercero else "",
                "centro": centro,
                "comprobante": masters["comprobante"],
                "tipoDocumento": masters["tipo_documento"],
                "documento": reembolso["numero"],
                "documentoAfectado": "",
                "concepto": (linea["concepto"] or f"Reembolso {reembolso['numero']}")[:50],
                "fecha": reembolso["fecha"],
                "debito": float(linea["debito"]),
                "credito": float(linea["credito"]),
                "base": 0,
            }
        )
    return partidas


# ---------------------------------------------------------------------------
# Implementaciones PostgreSQL
# ---------------------------------------------------------------------------
def _list_postgres(cia: str, data: dict[str, Any]) -> dict[str, Any]:
    from .postgres_repository import _compania, _compania_id, _connect, _filas

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, cia)
            compania_id = _compania_id(cursor, codigo)
            condiciones = ["r.compania_id = %s", "r.anio = %s"]
            parametros: list[Any] = [compania_id, data["anio"]]
            if data["estado"] == "todos":
                condiciones.append("r.estado <> 'Anulado'")
            else:
                condiciones.append("r.estado = %s")
                parametros.append(data["estado"])
            where = " AND ".join(condiciones)

            cursor.execute(f"SELECT count(*) FROM reembolsos r WHERE {where}", tuple(parametros))
            count = int(cursor.fetchone()[0])

            cursor.execute(
                "SELECT r.numero AS numero, to_char(r.fecha, 'YYYY-MM-DD') AS fecha, "
                "r.periodo AS periodo, t.nit AS tercero, t.nombre AS \"nombreTercero\", "
                "r.caja_menor AS \"cajaMenor\", r.estado AS estado, lt.codigo AS lote, "
                "COALESCE((SELECT sum(rl.debito) FROM reembolso_lineas rl "
                "WHERE rl.reembolso_id = r.id), 0) AS total "
                "FROM reembolsos r JOIN terceros t ON t.id = r.tercero_id "
                "LEFT JOIN lotes lt ON lt.id = r.lote_id "
                f"WHERE {where} ORDER BY r.fecha DESC, r.id DESC LIMIT %s OFFSET %s",
                tuple(parametros + [data["page_size"], (data["page"] - 1) * data["page_size"]]),
            )
            filas = _filas(cursor)
    finally:
        connection.close()

    items = [
        _item(
            {
                "numero": _text(fila["numero"]),
                "fecha": _text(fila["fecha"]),
                "periodo": _text(fila["periodo"]),
                "tercero": _text(fila["tercero"]),
                "nombreTercero": _text(fila["nombreTercero"]),
                "cajaMenor": _text(fila["cajaMenor"]) or None,
                "estado": _text(fila["estado"]),
                "lote": _text(fila["lote"]) or None,
                "total": float(fila["total"]),
            }
        )
        for fila in filas
    ]
    return {"items": items, "count": count, "source": "reembolsos"}


def _create_postgres(
    cia: str, data: dict[str, Any], payload: dict[str, Any], *, dry_run: bool
) -> dict[str, Any]:
    from .postgres_repository import _compania, _compania_id, _connect
    from .postgres_writes import _auditar, _commit, _usuario_id

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, cia)
            compania_id = _compania_id(cursor, codigo)
            anio = data["fecha"].year
            tercero_id = _tercero_id(cursor, compania_id, data["tercero"])
            cuentas = _cuentas_de(cursor, compania_id, [linea["cuenta"] for linea in data["lineas"]])
            centros = _centros_de(cursor, compania_id, [linea["centro"] for linea in data["lineas"]])
            if _numero_existe(cursor, compania_id, anio, data["numero"]):
                raise RefundConflict(
                    f"El reembolso {data['numero']} ya existe para la compañía "
                    f"en el año {anio}."
                )
            reembolso_id = None
            if not dry_run:
                _asegurar_periodo(cursor, compania_id, anio, data["periodo"])
                usuario_id = _usuario_id(cursor, data["usuario"])
                cursor.execute(
                    "INSERT INTO reembolsos (compania_id, anio, numero, fecha, periodo, "
                    "tercero_id, caja_menor, estado, usuario_id) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, 'Borrador', %s) RETURNING id",
                    (
                        compania_id, anio, data["numero"], data["fecha"], data["periodo"],
                        tercero_id, data["caja_menor"] or None, usuario_id,
                    ),
                )
                reembolso_id = int(cursor.fetchone()[0])
                _insertar_lineas(cursor, reembolso_id, compania_id, data["lineas"], cuentas, centros)
                motivo = _text(payload.get("motivo")) or f"Reembolso {data['numero']}"
                _auditar(
                    cursor, compania_id, usuario_id, "Creación de reembolso", "Reembolsos",
                    f"Reembolso {data['numero']} ({data['periodo']}) con "
                    f"{len(data['lineas'])} líneas por {float(data['total_debito']):.2f}.",
                    motivo,
                    {"numero": data["numero"], "lineas": len(data["lineas"]),
                     "total": float(data["total_debito"])},
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    item = _item_escritura(data["numero"], data, estado="Borrador", dry_run=dry_run)
    item["id"] = reembolso_id
    return {"item": item, "source": "reembolsos"}


def _update_postgres(
    cia: str, numero: str, data: dict[str, Any], payload: dict[str, Any], *, dry_run: bool
) -> dict[str, Any]:
    from .postgres_repository import _compania, _compania_id, _connect
    from .postgres_writes import _auditar, _commit, _usuario_id

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, cia)
            compania_id = _compania_id(cursor, codigo)
            actual = _reembolso_actual(cursor, compania_id, numero)
            if actual is None:
                raise RefundNotFound(f"No existe el reembolso {numero} para la compañía activa.")
            if actual["estado"] != "Borrador":
                raise RefundConflict(
                    f"El reembolso {numero} está {actual['estado']}: solo se modifica en Borrador."
                )
            tercero_id = _tercero_id(cursor, compania_id, data["tercero"])
            cuentas = _cuentas_de(cursor, compania_id, [linea["cuenta"] for linea in data["lineas"]])
            centros = _centros_de(cursor, compania_id, [linea["centro"] for linea in data["lineas"]])

            anio = data["fecha"].year
            periodo = _periodo_de_fecha(data["fecha"])
            if not dry_run:
                if (anio, periodo) != (actual["anio"], actual["periodo"]):
                    _asegurar_periodo(cursor, compania_id, anio, periodo)
                usuario_id = _usuario_id(cursor, data["usuario"])
                cursor.execute(
                    "UPDATE reembolsos SET anio = %s, fecha = %s, periodo = %s, tercero_id = %s, "
                    "caja_menor = %s WHERE id = %s AND compania_id = %s",
                    (
                        anio, data["fecha"], periodo, tercero_id, data["caja_menor"] or None,
                        actual["id"], compania_id,
                    ),
                )
                cursor.execute(
                    "DELETE FROM reembolso_lineas WHERE reembolso_id = %s AND compania_id = %s",
                    (actual["id"], compania_id),
                )
                _insertar_lineas(cursor, actual["id"], compania_id, data["lineas"], cuentas, centros)
                motivo = _text(payload.get("motivo")) or f"Reembolso {numero}"
                _auditar(
                    cursor, compania_id, usuario_id, "Modificación de reembolso", "Reembolsos",
                    f"Reembolso {numero} ({periodo}) con {len(data['lineas'])} líneas.",
                    motivo,
                    {"numero": numero, "lineas": len(data["lineas"]),
                     "total": float(data["total_debito"])},
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "item": _item_escritura(numero, data, estado="Borrador", dry_run=dry_run),
        "source": "reembolsos",
    }


def _apply_postgres(cia: str, numero: str, data: dict[str, Any], *, dry_run: bool) -> dict[str, Any]:
    from . import store
    from .postgres_repository import _compania, _compania_id, _connect
    from .postgres_writes import _auditar, _commit, _usuario_id

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, cia)
            compania_id = _compania_id(cursor, codigo)
            actual = _reembolso_actual(cursor, compania_id, numero)
            if actual is None:
                raise RefundNotFound(f"No existe el reembolso {numero} para la compañía activa.")
            if actual["estado"] == "Aplicado":
                lote = _lote_de(cursor, compania_id, actual["lote_id"]) or (
                    f"{REFUND_LOT_PREFIX}{actual['periodo']}"
                )
                raise RefundConflict(
                    f"El reembolso {numero} ya está Aplicado: el lote {lote} ya fue creado."
                )
            if actual["estado"] != "Borrador":
                raise RefundConflict(
                    f"El reembolso {numero} está {actual['estado']}: no se puede aplicar."
                )
            lineas = _lineas_de(cursor, compania_id, actual["id"])
            if not lineas:
                raise RefundValidationError("El reembolso no tiene líneas para aplicar.")
            totales = totales_de_lineas(lineas)
            if not totales["cuadrado"]:
                raise RefundValidationError(
                    "El reembolso no cuadra: el total de débitos debe igualar el de créditos."
                )
            partidas = _partidas_de_lote(cursor, compania_id, actual, lineas)
            reembolso_id = actual["id"]
    finally:
        connection.close()

    lote = f"{REFUND_LOT_PREFIX}{actual['periodo']}"
    if dry_run:
        return {
            "item": {
                "numero": numero, "estado": "Borrador", "lote": lote,
                "lineas": len(partidas), "cuadrado": True, "dryRun": True,
            },
            "source": "reembolsos",
        }

    # El lote se crea con las rutas de lote existentes (cada una con su propia
    # transacción); si algo posterior falla se retira para no dejar un reembolso a
    # medias —la misma decisión de ``generate_cierre_lot`` en postgres_writes.
    lote_creado = store.create_lot(
        codigo,
        {
            "lote": lote,
            "nombre": f"Reembolso {numero}",
            "mes": actual["periodo"],
            "usuario": data["usuario"],
        },
    )
    try:
        for partida in partidas:
            store.save_lot_line(codigo, lote, partida)

        connection = _connect()
        try:
            with connection.cursor() as cursor:
                compania_id = _compania_id(cursor, _compania(cursor, codigo))
                usuario_id = _usuario_id(cursor, data["usuario"])
                cursor.execute(
                    "UPDATE reembolsos SET estado = 'Aplicado', lote_id = %s "
                    "WHERE id = %s AND compania_id = %s",
                    (lote_creado["id"], reembolso_id, compania_id),
                )
                _auditar(
                    cursor, compania_id, usuario_id, "Aplicación de reembolso", "Reembolsos",
                    f"Reembolso {numero}: lote {lote} con {len(partidas)} partidas.",
                    data["motivo"],
                    {"numero": numero, "lote": lote, "lineas": len(partidas),
                     "cuadrado": True},
                )
            _commit(connection, False)
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()
    except Exception:
        try:
            store.delete_lot(codigo, lote, force=True)
        except Exception:  # pragma: no cover - la compensación no oculta el fallo original
            pass
        raise

    return {
        "item": {
            "numero": numero, "estado": "Aplicado", "lote": lote,
            "lineas": len(partidas), "cuadrado": True, "dryRun": False,
        },
        "source": "reembolsos",
    }
