"""Bloque E1 · reasignación de NIT: contrato puro y las dos ramas de motor (R10).

**Brecha declarada.** La auditoría del legado no encontró una rutina de
reasignación de terceros: ``FADCLI`` y ``CONEMP`` solo *conservan* los campos del
tercero (``db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`` FADCLI y CONEMP) y no existe el
cambio masivo de la referencia contable. Por eso la rama Advantage **declara** la
brecha con 503 (:class:`ReassignmentLegacyNotSupported`) y no la simula; solo la
rama PostgreSQL reescribe el libro.

**Qué reescribe PostgreSQL.** Únicamente la referencia al tercero (``tercero_id``)
en las cinco tablas que la guardan:

- ``documento_lineas`` (el libro),
- ``lote_lineas`` (los lotes editables),
- ``saldos_cuenta_tercero`` y ``acumulados_tercero`` (derivados, por eso se
  **fusionan** si el destino ya tenía una fila con la misma clave, en vez de violar
  su restricción única),
- ``reembolsos`` (``db/postgresql/schema/11_ampliaciones.sql``).

No toca consecutivos ni numeración: el número de documento no cambia porque el
documento no cambia, solo el tercero al que apunta. Todo va en una transacción y
respeta ``dryRun``. Después de reescribir, recalcula los acumulados con
``regenerar_acumulados(compania_id, anio, tipo)`` del esquema
(``db/postgresql/funciones.sql:475``) para cada año afectado, y deja una fila por
tabla tocada en ``auditoria`` con el conteo y el motivo.
"""

from __future__ import annotations

import re
from datetime import date
from typing import Any

# ---------------------------------------------------------------------------
# Constantes de contrato (R6: los códigos se validan con patrón)
# ---------------------------------------------------------------------------
# El NIT del path y del destino comparten el patrón declarado en el detalle
# (§1.1 ``r"^[0-9]{1,10}$"``), igual que el resto de las rutas de terceros.
NIT_CODE = re.compile(r"^[0-9]{1,10}$")

MIN_REASON = 5
MAX_REASON = 180
MAX_USER = 4

# Los dos alcances declarados en ``ThirdPartyReassignment`` (§1.1).
SCOPE_ALL = "todo"
SCOPE_FROM_DATE = "desdeFecha"
SCOPES = (SCOPE_ALL, SCOPE_FROM_DATE)

# Orden del conteo en la respuesta, tal como lo publica el contrato (§1.1).
TABLAS = (
    "documento_lineas",
    "lote_lineas",
    "saldos_cuenta_tercero",
    "acumulados_tercero",
    "reembolsos",
)

# Tipos de ``regenerar_acumulados`` que dependen del tercero. ``Centros`` no se
# toca porque la reasignación no cambia el centro de costo de ninguna partida.
TIPOS_ACUMULADO = ("Terceros", "Retencion", "Iva")

# ---------------------------------------------------------------------------
# Mensaje declarado de la rama heredada
# ---------------------------------------------------------------------------
LEGACY_MESSAGE = (
    "La reasignación de NIT no está implementada en Advantage: la auditoría del "
    "legado no encontró una rutina de reasignación de terceros (FADCLI/CONEMP solo "
    "conservan los campos, db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md). Solo está "
    "implementada con PostgreSQL."
)


# ---------------------------------------------------------------------------
# Excepciones de dominio (R5). El mapeo a HTTP lo hace la capa de servicio.
# ---------------------------------------------------------------------------
class ReassignmentNotFound(RuntimeError):
    """No existe el tercero de origen o de destino en la compañía activa (404)."""


class ReassignmentConflict(RuntimeError):
    """La reasignación choca con el estado del libro (409)."""


class ReassignmentValidationError(ValueError):
    """El cuerpo o el alcance de la reasignación incumplen el contrato (422)."""


class ReassignmentLegacyNotSupported(RuntimeError):
    """La operación no tiene representación honesta en el legado (503, R10)."""


# ---------------------------------------------------------------------------
# Helpers puros de contrato
# ---------------------------------------------------------------------------
def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _nit(value: Any, campo: str = "NIT") -> str:
    nit = _text(value)
    if not NIT_CODE.fullmatch(nit):
        raise ReassignmentValidationError(f"El {campo} debe tener entre 1 y 10 dígitos.")
    return nit


def _usuario(value: Any) -> str:
    usuario = _text(value).upper() or "WEB"
    if len(usuario) > MAX_USER:
        raise ReassignmentValidationError(f"El usuario admite máximo {MAX_USER} caracteres.")
    return usuario


def _motivo(value: Any) -> str:
    motivo = _text(value)
    if not MIN_REASON <= len(motivo) <= MAX_REASON:
        raise ReassignmentValidationError(
            f"El motivo es obligatorio y debe tener entre {MIN_REASON} y {MAX_REASON} caracteres."
        )
    return motivo


def _fecha(value: Any, campo: str = "fecha") -> date:
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(_text(value))
    except ValueError as exc:
        raise ReassignmentValidationError(f"La {campo} del alcance no es una fecha válida.") from exc


# ---------------------------------------------------------------------------
# Normalización del cuerpo (validación antes de abrir la conexión)
# ---------------------------------------------------------------------------
def normalize_reassignment(nit: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Cuerpo de ``ThirdPartyReassignment`` (§1.1), resuelto sin motor.

    Valida el patrón de los dos NIT, el motivo, el usuario y el alcance. El destino
    igual al origen es **422** y se decide en el contrato: no hace falta consultar
    el motor para saber que reescribir un NIT hacia sí mismo es un error. Con
    ``alcance: "desdeFecha"`` la ``fecha`` es obligatoria; con ``"todo"`` no se usa.
    """
    origen = _nit(nit, "NIT de origen")
    destino = _nit(payload.get("nitNuevo"), "NIT de destino")
    if destino == origen:
        raise ReassignmentValidationError(
            "El NIT de destino debe ser distinto del NIT de origen."
        )

    alcance = _text(payload.get("alcance"))
    if alcance not in SCOPES:
        raise ReassignmentValidationError(
            "El alcance debe ser «todo» o «desdeFecha»."
        )

    fecha: date | None = None
    if alcance == SCOPE_FROM_DATE:
        if not _text(payload.get("fecha")):
            raise ReassignmentValidationError(
                "El alcance «desdeFecha» exige la fecha desde la cual reescribir."
            )
        fecha = _fecha(payload.get("fecha"))

    return {
        "nit_origen": origen,
        "nit_nuevo": destino,
        "motivo": _motivo(payload.get("motivo")),
        "usuario": _usuario(payload.get("usuario")),
        "alcance": alcance,
        "fecha": fecha,
    }


# ---------------------------------------------------------------------------
# Filtro de alcance por tabla (contrato puro reutilizable)
# ---------------------------------------------------------------------------
def scope_filter(tabla: str, fecha: date | None) -> tuple[str, list[Any]]:
    """Fragmento ``AND ...`` que restringe el alcance ``desdeFecha`` por tabla.

    Cada tabla guarda la fecha de distinta forma: el libro por la fecha del
    documento (``d.fecha``), ``lote_lineas`` en su propia columna, los derivados
    por año/período y ``reembolsos`` por su ``fecha``. Con ``fecha`` nula (alcance
    ``todo``) no se filtra nada.
    """
    if fecha is None:
        return "", []
    if tabla == "documento_lineas":
        return " AND d.fecha >= %s", [fecha]
    if tabla == "lote_lineas":
        return " AND l.fecha >= %s", [fecha]
    if tabla == "saldos_cuenta_tercero":
        return " AND (s.anio, s.periodo) >= (%s, %s)", [fecha.year, f"{fecha.month:02d}"]
    if tabla == "acumulados_tercero":
        return " AND a.anio >= %s", [fecha.year]
    if tabla == "reembolsos":
        return " AND r.fecha >= %s", [fecha]
    raise ReassignmentValidationError(f"Tabla de reasignación desconocida: {tabla}.")


_COUNT_SQL = {
    "documento_lineas": (
        "SELECT count(*) FROM documento_lineas l "
        "JOIN documentos d ON d.id = l.documento_id "
        "WHERE l.compania_id = %s AND l.tercero_id = %s"
    ),
    "lote_lineas": (
        "SELECT count(*) FROM lote_lineas l "
        "WHERE l.compania_id = %s AND l.tercero_id = %s"
    ),
    "saldos_cuenta_tercero": (
        "SELECT count(*) FROM saldos_cuenta_tercero s "
        "WHERE s.compania_id = %s AND s.tercero_id = %s"
    ),
    "acumulados_tercero": (
        "SELECT count(*) FROM acumulados_tercero a "
        "WHERE a.compania_id = %s AND a.tercero_id = %s"
    ),
    "reembolsos": (
        "SELECT count(*) FROM reembolsos r "
        "WHERE r.compania_id = %s AND r.tercero_id = %s"
    ),
}

_UPDATE_SQL = {
    "documento_lineas": (
        "UPDATE documento_lineas l SET tercero_id = %s FROM documentos d "
        "WHERE d.id = l.documento_id AND l.compania_id = %s AND l.tercero_id = %s"
    ),
    "lote_lineas": (
        "UPDATE lote_lineas l SET tercero_id = %s "
        "WHERE l.compania_id = %s AND l.tercero_id = %s"
    ),
    "reembolsos": (
        "UPDATE reembolsos r SET tercero_id = %s "
        "WHERE r.compania_id = %s AND r.tercero_id = %s"
    ),
}

# Tablas derivadas con clave única que incluye ``tercero_id``: un UPDATE directo
# podría chocar con una fila del destino, así que se **fusionan** (se pliegan sobre
# el destino y luego se retiran las del origen).
_MERGE_SQL = {
    "saldos_cuenta_tercero": (
        (
            "INSERT INTO saldos_cuenta_tercero "
            "(compania_id, anio, periodo, cuenta_id, tercero_id, debito, credito) "
            "SELECT s.compania_id, s.anio, s.periodo, s.cuenta_id, %s, s.debito, s.credito "
            "FROM saldos_cuenta_tercero s "
            "WHERE s.compania_id = %s AND s.tercero_id = %s"
        ),
        (
            "DELETE FROM saldos_cuenta_tercero s "
            "WHERE s.compania_id = %s AND s.tercero_id = %s"
        ),
    ),
    "acumulados_tercero": (
        (
            "INSERT INTO acumulados_tercero "
            "(compania_id, anio, tercero_id, cuenta_id, debito, credito) "
            "SELECT a.compania_id, a.anio, %s, a.cuenta_id, a.debito, a.credito "
            "FROM acumulados_tercero a "
            "WHERE a.compania_id = %s AND a.tercero_id = %s"
        ),
        (
            "DELETE FROM acumulados_tercero a "
            "WHERE a.compania_id = %s AND a.tercero_id = %s"
        ),
    ),
}

# Destino del ON CONFLICT por tabla derivada (su clave única).
_CONFLICT_TARGET = {
    "saldos_cuenta_tercero": "(compania_id, anio, periodo, cuenta_id, tercero_id)",
    "acumulados_tercero": "(compania_id, anio, tercero_id, cuenta_id)",
}


# ---------------------------------------------------------------------------
# Respuesta de contrato
# ---------------------------------------------------------------------------
def _respuesta(
    data: dict[str, Any], reescrito: dict[str, int], dry_run: bool
) -> dict[str, Any]:
    item: dict[str, Any] = {
        "nitOrigen": data["nit_origen"],
        "nitDestino": data["nit_nuevo"],
        "reescrito": {tabla: reescrito.get(tabla, 0) for tabla in TABLAS},
        "dryRun": dry_run,
    }
    if not any(item["reescrito"].values()):
        item["aviso"] = "El NIT no tiene referencias contables que reasignar."
    return {"item": item, "source": "terceros"}


# ---------------------------------------------------------------------------
# Rama Advantage: declarada no soportada (R10)
# ---------------------------------------------------------------------------
def reassign_third_party(
    cia: str, nit: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Reasigna las referencias de un NIT a otro (§1.1).

    Valida el contrato y, en Advantage, **declara** la brecha con 503: no hay
    rutina de reasignación en el legado. Con PostgreSQL delega en la
    implementación transaccional de este mismo módulo.
    """
    from .store import is_postgres

    data = normalize_reassignment(nit, payload)
    if not is_postgres():
        raise ReassignmentLegacyNotSupported(LEGACY_MESSAGE)
    return _reassign_postgres(cia, data, user=user, dry_run=dry_run)


# ---------------------------------------------------------------------------
# Rama PostgreSQL
# ---------------------------------------------------------------------------
def _tercero_de(cursor: Any, compania_id: int, nit: str, papel: str) -> dict[str, Any]:
    """Tercero de la compañía por NIT o por su identidad legada (``codigo_legado``)."""
    cursor.execute(
        "SELECT id, nit, codigo_legado, nombre FROM terceros "
        "WHERE compania_id = %s AND (nit = %s OR codigo_legado = %s) ORDER BY id LIMIT 1",
        (compania_id, nit, nit),
    )
    fila = cursor.fetchone()
    if fila is None:
        raise ReassignmentNotFound(f"El {papel} {nit} no existe en la compañía activa.")
    return {"id": int(fila[0]), "nit": _text(fila[1]), "codigo_legado": _text(fila[2]), "nombre": _text(fila[3])}


def _contar(cursor: Any, tabla: str, compania_id: int, origen_id: int, fecha: date | None) -> int:
    frag, params = scope_filter(tabla, fecha)
    cursor.execute(_COUNT_SQL[tabla] + frag, (compania_id, origen_id, *params))
    return int(cursor.fetchone()[0])


def _anios_afectados(cursor: Any, compania_id: int, origen_id: int, fecha: date | None) -> list[int]:
    """Años del libro que pierden partidas del origen (para recalcular acumulados)."""
    frag, params = scope_filter("documento_lineas", fecha)
    cursor.execute(
        "SELECT DISTINCT d.anio FROM documento_lineas l "
        "JOIN documentos d ON d.id = l.documento_id "
        "WHERE l.compania_id = %s AND l.tercero_id = %s" + frag,
        (compania_id, origen_id, *params),
    )
    return [int(fila[0]) for fila in cursor.fetchall()]


def _reescribir(
    cursor: Any, tabla: str, compania_id: int, origen_id: int, destino_id: int, fecha: date | None
) -> int:
    """Reescribe la referencia en una tabla y devuelve cuántas filas movió."""
    frag, params = scope_filter(tabla, fecha)
    if tabla in _MERGE_SQL:
        insert_sql, delete_sql = _MERGE_SQL[tabla]
        target = _CONFLICT_TARGET[tabla]
        cursor.execute(
            insert_sql + frag + f" ON CONFLICT {target} DO UPDATE SET "
            "debito = EXCLUDED.debito + "
            f"{tabla}.debito, credito = EXCLUDED.credito + {tabla}.credito",
            (destino_id, compania_id, origen_id, *params),
        )
        cursor.execute(delete_sql + frag, (compania_id, origen_id, *params))
        return int(cursor.rowcount)
    cursor.execute(_UPDATE_SQL[tabla] + frag, (destino_id, compania_id, origen_id, *params))
    return int(cursor.rowcount)


def _regenerar(cursor: Any, compania_id: int, anios: list[int]) -> bool:
    """Recalcula los acumulados del tercero con la función del esquema, si existe."""
    cursor.execute(
        "SELECT 1 FROM pg_proc WHERE proname = 'regenerar_acumulados' LIMIT 1"
    )
    if cursor.fetchone() is None:
        return False
    for anio in anios:
        for tipo in TIPOS_ACUMULADO:
            cursor.execute(
                "SELECT regenerar_acumulados(%s, %s, %s)", (compania_id, anio, tipo)
            )
    return True


def _reassign_postgres(
    cia: str, data: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Reescritura transaccional de las cinco tablas y recálculo de acumulados."""
    from .postgres_repository import _compania, _compania_id, _connect
    from .postgres_writes import _auditar, _commit, _usuario_id

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, cia)
            compania_id = _compania_id(cursor, codigo)
            origen = _tercero_de(cursor, compania_id, data["nit_origen"], "NIT de origen")
            destino = _tercero_de(cursor, compania_id, data["nit_nuevo"], "NIT de destino")
            if origen["id"] == destino["id"]:
                raise ReassignmentValidationError(
                    "El NIT de origen y el de destino apuntan al mismo tercero."
                )

            fecha = data["fecha"]
            reescrito = {
                tabla: _contar(cursor, tabla, compania_id, origen["id"], fecha) for tabla in TABLAS
            }

            if not dry_run:
                anios = _anios_afectados(cursor, compania_id, origen["id"], fecha)
                movidas: dict[str, int] = {}
                for tabla in TABLAS:
                    if reescrito[tabla]:
                        movidas[tabla] = _reescribir(
                            cursor, tabla, compania_id, origen["id"], destino["id"], fecha
                        )
                _regenerar(cursor, compania_id, anios)

                usuario_id = _usuario_id(cursor, data["usuario"] or user)
                for tabla in TABLAS:
                    conteo = movidas.get(tabla, 0)
                    if not conteo:
                        continue
                    _auditar(
                        cursor,
                        compania_id,
                        usuario_id,
                        "Reasignación de NIT",
                        "Terceros",
                        f"{tabla}: {conteo} referencia(s) del NIT {data['nit_origen']} "
                        f"reasignada(s) al NIT {data['nit_nuevo']}.",
                        data["motivo"],
                        {
                            "tabla": tabla,
                            "conteo": conteo,
                            "nitOrigen": data["nit_origen"],
                            "nitDestino": data["nit_nuevo"],
                            "alcance": data["alcance"],
                        },
                    )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return _respuesta(data, reescrito, dry_run)
