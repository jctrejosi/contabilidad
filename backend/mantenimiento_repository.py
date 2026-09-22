"""Contratos del bloque D4: reorganización y mantenimiento.

**Solo PostgreSQL (R10, P36).** A diferencia de los bloques D2 (cierres) y D3
(consolidación), donde cada motor tiene su propio repositorio, aquí las cinco
rutas comparten un único módulo porque **el legado no tiene una rama funcional
que replicar**: el mantenimiento de Advantage son índices ``ADI`` y ``COPY
STRUC`` sobre las tablas del diccionario, sustituidos por el DDL versionado y el
mantenimiento de PostgreSQL (``db/old_db/MATRIZ_PROCESOS_Y_OPCIONES.md``, P36).
Con ``CONTABDSI_STORE=ads`` las cinco rutas declaran la brecha con **503** en vez
de simular en silencio; la causa está en :data:`LEGACY_MESSAGE`.

**Representación.** Todo el bloque se apoya en ``procesos``
(``db/postgresql/schema/07_procesos.sql:11-29``):

- el **mantenimiento** es un proceso con ``tipo = 'Mantenimiento'`` y estado
  ``Ejecutando``; hay uno solo abierto por compañía y es el que **bloquea** el
  resto de escrituras (eso es lo que antes solo cambiaba estado en React);
- la **reorganización** es un proceso con ``tipo`` = lo pedido
  (``Reindexar``/``Analizar``/``Compactar``) y estado ``Ejecutando``, que se
  consulta en 3.5; exige mantenimiento activo (es lo que promete la pantalla).
  La operación física corre **fuera de la petición** (hilo con su propia conexión,
  §3.4) y al terminar marca el proceso ``Completado`` con sus conteos reales —o
  ``Fallido`` con el error—, que es lo que permite cerrar el mantenimiento (3.3).
  ``Compactar`` usa ``VACUUM``, que exige conexión en autocommit.

Las respuestas son ``{"item": {...}, "source": "procesos"}``. Toda escritura
exige ``motivo`` y deja fila en ``auditoria``: los disparadores del esquema son
solo ``BEFORE UPDATE``, así que el ``INSERT`` explícito es obligatorio. Con
``dry_run`` la operación se ejecuta y se revierte (``rollback``), de modo que el
informe es el mismo y la base no cambia.

**Punto de integración.** :func:`assert_no_maintenance` es el helper que las
demás escrituras consultan para convertir el modo en efectivo: recibe el cursor
de su propia transacción y lanza :class:`MaintenanceConflict` si hay un
mantenimiento activo.
"""

from __future__ import annotations

import json
import threading
from typing import Any

# ---------------------------------------------------------------------------
# Constantes de contrato
# ---------------------------------------------------------------------------
# Tipo y estado del proceso de mantenimiento (§3.1, §3.2).
MAINTENANCE_TYPE = "Mantenimiento"
# Tipos de una reorganización (§3.4), en el mismo vocabulario que el modelo.
REORGANIZATION_TYPES = ("Reindexar", "Analizar", "Compactar")
# Estados de `procesos` que usa el bloque (`CHECK` del esquema).
ESTADO_EJECUTANDO = "Ejecutando"
ESTADO_COMPLETADO = "Completado"
ESTADO_FALLIDO = "Fallido"

# Tablas del modelo que una reorganización mantiene cuando el ``alcance`` no
# declara ninguna: el núcleo contable (``db/postgresql/schema/03..05``).
DEFAULT_TABLES = (
    "cuentas",
    "terceros",
    "documentos",
    "documento_lineas",
    "lotes",
    "lote_lineas",
    "saldos_cuenta",
    "saldos_cuenta_tercero",
    "acumulados_tercero",
)

# Enunciado del DDL por tipo de reorganización (el nombre se interpola con
# ``sql.Identifier``: nunca llega texto del cuerpo a la sentencia).
_SQL_POR_TIPO = {
    "Reindexar": "REINDEX TABLE {}",
    "Analizar": "ANALYZE {}",
    "Compactar": "VACUUM (ANALYZE) {}",
}

# Módulo con el que las filas de auditoría del bloque se etiquetan.
AUDIT_MODULE = "Mantenimiento"

# El origen que viaja en el JSON: la tabla del modelo que respalda el bloque.
SOURCE = "procesos"

# Mismo contrato de texto que los bloques anteriores (R6).
MIN_REASON = 5
MAX_REASON = 180
MAX_USER = 4

# ---------------------------------------------------------------------------
# Mensaje declarado de la rama heredada
# ---------------------------------------------------------------------------
LEGACY_MESSAGE = (
    "El mantenimiento y la reorganización de Advantage son índices ADI y COPY "
    "STRUC sobre las tablas del diccionario, sustituidos por el DDL versionado "
    "y el mantenimiento de PostgreSQL (decisión P36). Las cinco rutas del bloque "
    "D4 solo están implementadas con PostgreSQL."
)

# ---------------------------------------------------------------------------
# Excepciones de dominio (R5)
# ---------------------------------------------------------------------------
class MaintenanceNotFound(RuntimeError):
    """No existe el mantenimiento o la reorganización pedidos (404)."""


class MaintenanceConflict(RuntimeError):
    """El estado del bloqueo choca con la operación pedida (409)."""


class MaintenanceValidationError(ValueError):
    """La operación de mantenimiento incumple las reglas del modelo (422)."""


class MaintenanceLegacyNotSupported(RuntimeError):
    """El mantenimiento del legado no es representable aquí (503, R10/P36)."""


# ---------------------------------------------------------------------------
# Helpers puros de contrato
# ---------------------------------------------------------------------------
def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _usuario(value: Any) -> str:
    usuario = _text(value).upper() or "WEB"
    if len(usuario) > MAX_USER:
        raise MaintenanceValidationError(
            f"El usuario admite máximo {MAX_USER} caracteres."
        )
    return usuario


def _motivo(value: Any) -> str:
    motivo = _text(value)
    if not MIN_REASON <= len(motivo) <= MAX_REASON:
        raise MaintenanceValidationError(
            f"El motivo es obligatorio y debe tener entre {MIN_REASON} y "
            f"{MAX_REASON} caracteres."
        )
    return motivo


def _proceso(value: Any) -> int:
    try:
        proceso = int(value)
    except (TypeError, ValueError) as exc:
        raise MaintenanceValidationError(
            "El proceso es obligatorio y debe ser un número entero."
        ) from exc
    if proceso < 1:
        raise MaintenanceValidationError("El proceso debe ser mayor o igual a 1.")
    return proceso


def _alcance(value: Any) -> dict[str, Any]:
    """Normaliza el ``alcance`` opcional a un objeto jsonb.

    El contrato acepta un objeto (``{"tablas": [...]}``) o directamente la lista
    de tablas; cualquier otra forma se rechaza en vez de guardarse como texto.
    """
    if value is None or value == "":
        return {}
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, list):
        return {"tablas": list(value)}
    raise MaintenanceValidationError(
        "El alcance debe ser un objeto (jsonb) o una lista de tablas."
    )


def _alcance_con_motivo(alcance: dict[str, Any], motivo: str) -> dict[str, Any]:
    """El jsonb que se persiste: el alcance pedido más el motivo de la auditoría.

    ``procesos`` no tiene columna ``motivo``; se guarda dentro de ``alcance`` para
    que :func:`get_maintenance` pueda devolverlo en 3.1.
    """
    base = dict(alcance or {})
    base["motivo"] = motivo
    return base


def _iso(value: Any) -> str | None:
    """Marca temporal del modelo a texto ISO, tolerando ``NULL``."""
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


# ---------------------------------------------------------------------------
# Normalización de los cuerpos (validación antes de abrir la conexión)
# ---------------------------------------------------------------------------
def normalize_maintenance_start(payload: dict[str, Any]) -> dict[str, Any]:
    """Cuerpo de ``POST /api/mantenimiento``: usuario, motivo, respaldo y alcance (§3.2)."""
    respaldo = payload.get("respaldoRealizado")
    if respaldo is not True:
        raise MaintenanceValidationError(
            "El mantenimiento exige confirmar el respaldo de la base "
            "(respaldoRealizado = true)."
        )
    return {
        "usuario": _usuario(payload.get("usuario")),
        "motivo": _motivo(payload.get("motivo")),
        "respaldo_realizado": True,
        "alcance": _alcance(payload.get("alcance")),
    }


def normalize_maintenance_stop(payload: dict[str, Any]) -> dict[str, Any]:
    """Cuerpo de ``DELETE /api/mantenimiento``: usuario, motivo y proceso (§3.3)."""
    return {
        "usuario": _usuario(payload.get("usuario")),
        "motivo": _motivo(payload.get("motivo")),
        "proceso": _proceso(payload.get("proceso")),
    }


def normalize_reorganization(payload: dict[str, Any]) -> dict[str, Any]:
    """Cuerpo de ``POST /api/reorganizaciones``: tipo, motivo y alcance (§3.4)."""
    tipo = _text(payload.get("tipo"))
    if tipo not in REORGANIZATION_TYPES:
        raise MaintenanceValidationError(
            "El tipo de reorganización debe ser uno de: "
            f"{', '.join(REORGANIZATION_TYPES)}."
        )
    return {
        "usuario": _usuario(payload.get("usuario")),
        "motivo": _motivo(payload.get("motivo")),
        "tipo": tipo,
        "alcance": _alcance(payload.get("alcance")),
    }


def tablas_afectadas(alcance: dict[str, Any]) -> list[str]:
    """Tablas declaradas en ``alcance["tablas"]`` (contrato puro de 3.4 ``dryRun``)."""
    tablas = alcance.get("tablas") if isinstance(alcance, dict) else None
    if not isinstance(tablas, list):
        return []
    return [_text(tabla) for tabla in tablas if _text(tabla)]


def tablas_a_reorganizar(cursor: Any, alcance: dict[str, Any]) -> list[str]:
    """Tablas efectivas, resueltas contra el catálogo.

    Si el alcance declara tablas se usan las que además existan; si no declara
    ninguna, se usan las :data:`DEFAULT_TABLES` que existan. Los nombres se toman
    de ``pg_class`` —no del cuerpo— para que el DDL pueda interpolarlos con
    seguridad.
    """
    cursor.execute(
        "SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace "
        "AND relkind = 'r'"
    )
    existentes = {_text(fila[0]) for fila in cursor.fetchall()}
    declaradas = [tabla for tabla in tablas_afectadas(alcance) if tabla in existentes]
    if declaradas:
        return declaradas
    return [tabla for tabla in DEFAULT_TABLES if tabla in existentes]


# ---------------------------------------------------------------------------
# Ejecución fuera de la petición (§3.4) — el proceso se completa solo
# ---------------------------------------------------------------------------
_INFLIGHT: dict[int, threading.Thread] = {}
_INFLIGHT_LOCK = threading.Lock()


def _tamano_total(cursor: Any, tablas: list[str]) -> int:
    """Suma de ``pg_total_relation_size`` de las tablas (bytes)."""
    cursor.execute(
        "SELECT COALESCE(sum(pg_total_relation_size(c.oid)), 0) FROM pg_class c "
        "WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY(%s)",
        (list(tablas),),
    )
    return int(cursor.fetchone()[0])


def _conteos_reales(cursor: Any, tablas: list[str]) -> dict[str, int]:
    """Índices y filas reales de las tablas, que es el ``resultado`` que lee 3.5."""
    indices = 0
    filas = 0
    for tabla in tablas:
        cursor.execute(
            "SELECT count(*) FROM pg_indexes "
            "WHERE schemaname = 'public' AND tablename = %s",
            (tabla,),
        )
        indices += int(cursor.fetchone()[0])
        # ``tabla`` viene del catálogo (``tablas_a_reorganizar``), no del cuerpo.
        cursor.execute(f'SELECT count(*) FROM "{tabla}"')
        filas += int(cursor.fetchone()[0])
    return {"indices": indices, "filas": filas}


def _ddl(tipo: str, tabla: str) -> Any:
    """Sentencia del tipo pedido con el nombre de tabla citado por el driver."""
    from psycopg import sql

    return sql.SQL(_SQL_POR_TIPO[tipo]).format(sql.Identifier(tabla))


def _cerrar_proceso(
    cursor: Any,
    compania_id: int,
    proceso: int,
    estado: str,
    resultado: dict[str, Any],
) -> None:
    cursor.execute(
        "UPDATE procesos SET estado = %s, resultado = %s::jsonb, actualizado_en = now() "
        "WHERE id = %s AND compania_id = %s",
        (estado, json.dumps(resultado), proceso, compania_id),
    )


def _ejecutar_reorganizacion(
    *,
    compania_id: int,
    proceso: int,
    tipo: str,
    tablas: list[str],
    usuario_id: int,
    motivo: str,
) -> None:
    """Corre el DDL declarado y marca el proceso ``Completado`` o ``Fallido``.

    Usa su propia conexión en autocommit (``VACUUM`` no admite transacción). Si la
    operación falla, el proceso queda ``Fallido`` con el error para que 3.3 pueda
    cerrar el mantenimiento en vez de quedar bloqueado para siempre.
    """
    from .postgres_repository import _connect
    from .postgres_writes import _auditar

    resultado: dict[str, Any] = {"tipo": tipo, "tablas": list(tablas)}
    estado = ESTADO_COMPLETADO
    connection = _connect()
    try:
        connection.autocommit = True
        with connection.cursor() as cursor:
            resultado["tamanoAntes"] = _tamano_total(cursor, tablas)
            for tabla in tablas:
                cursor.execute(_ddl(tipo, tabla))
            resultado.update(_conteos_reales(cursor, tablas))
            resultado["tablasProcesadas"] = len(tablas)
            resultado["tamanoDespues"] = _tamano_total(cursor, tablas)
            _cerrar_proceso(cursor, compania_id, proceso, ESTADO_COMPLETADO, resultado)
            _auditar(
                cursor,
                compania_id,
                usuario_id,
                "Reorganización completada",
                AUDIT_MODULE,
                f"Reorganización {proceso} ({tipo}) completada sobre "
                f"{len(tablas)} tabla(s).",
                motivo,
                {"proceso": proceso, **resultado},
            )
    except Exception as exc:  # noqa: BLE001 - el error se persiste, no se propaga
        estado = ESTADO_FALLIDO
        resultado["error"] = f"{type(exc).__name__}: {exc}"
        try:
            with connection.cursor() as cursor:
                _cerrar_proceso(cursor, compania_id, proceso, ESTADO_FALLIDO, resultado)
                _auditar(
                    cursor,
                    compania_id,
                    usuario_id,
                    "Reorganización fallida",
                    AUDIT_MODULE,
                    f"Reorganización {proceso} ({tipo}) falló: {resultado['error']}",
                    motivo,
                    {"proceso": proceso, **resultado},
                )
        except Exception:  # noqa: BLE001 - no se puede reportar el fallo del fallo
            pass
    finally:
        connection.close()
        with _INFLIGHT_LOCK:
            _INFLIGHT.pop(proceso, None)


def _lanzar_reorganizacion(
    *,
    compania_id: int,
    proceso: int,
    tipo: str,
    tablas: list[str],
    usuario_id: int,
    motivo: str,
) -> None:
    """Arranca la ejecución en un hilo daemon y la registra como en vuelo."""
    hilo = threading.Thread(
        target=_ejecutar_reorganizacion,
        kwargs={
            "compania_id": compania_id,
            "proceso": proceso,
            "tipo": tipo,
            "tablas": tablas,
            "usuario_id": usuario_id,
            "motivo": motivo,
        },
        name=f"reorganizacion-{proceso}",
        daemon=True,
    )
    with _INFLIGHT_LOCK:
        _INFLIGHT[proceso] = hilo
    hilo.start()


# ---------------------------------------------------------------------------
# Consulta del bloqueo (el punto que vuelve efectivo el modo mantenimiento)
# ---------------------------------------------------------------------------
def _activo(
    cursor: Any, compania_id: int, tipos: tuple[str, ...]
) -> int | None:
    """``id`` del proceso abierto (``Ejecutando``) de alguno de ``tipos``, o ``None``."""
    cursor.execute(
        "SELECT id FROM procesos WHERE compania_id = %s AND tipo = ANY(%s) "
        "AND estado = %s ORDER BY id DESC LIMIT 1",
        (compania_id, list(tipos), ESTADO_EJECUTANDO),
    )
    fila = cursor.fetchone()
    return None if fila is None else int(fila[0])


def assert_no_maintenance(cursor: Any, compania_id: int) -> None:
    """Lanza :class:`MaintenanceConflict` si la compañía está en mantenimiento.

    Es el helper que consultan las demás escrituras dentro de su propia
    transacción: mientras exista un proceso ``Mantenimiento`` en estado
    ``Ejecutando``, la operación que excluye a los demás usuarios está en curso.
    """
    proceso = _activo(cursor, compania_id, (MAINTENANCE_TYPE,))
    if proceso is not None:
        raise MaintenanceConflict(
            f"La compañía tiene un mantenimiento activo (proceso {proceso}): "
            "las escrituras están bloqueadas hasta cerrarlo."
        )


# ---------------------------------------------------------------------------
# 3.1 GET /api/mantenimiento
# ---------------------------------------------------------------------------
def get_maintenance(cia: str) -> dict[str, Any]:
    """Consulta si hay mantenimiento en curso y quién lo inició."""
    from .store import is_postgres

    if not is_postgres():
        raise MaintenanceLegacyNotSupported(LEGACY_MESSAGE)
    from .postgres_repository import _compania, _compania_id, _connect, _filas, _text

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, cia)
            compania_id = _compania_id(cursor, codigo)
            cursor.execute(
                "SELECT p.id AS \"proceso\", p.creado_en AS \"iniciadoEn\", "
                "p.respaldo_realizado AS \"respaldo\", p.alcance AS \"alcance\", "
                "u.iniciales AS \"usuario\" "
                "FROM procesos p LEFT JOIN usuarios u ON u.id = p.usuario_id "
                "WHERE p.compania_id = %s AND p.tipo = %s AND p.estado = %s "
                "ORDER BY p.id DESC LIMIT 1",
                (compania_id, MAINTENANCE_TYPE, ESTADO_EJECUTANDO),
            )
            filas = _filas(cursor)
    finally:
        connection.close()

    if not filas:
        return {
            "item": {
                "activo": False, "proceso": None, "iniciadoEn": None,
                "usuario": None, "motivo": None, "respaldo": False, "bloquea": False,
            },
            "source": SOURCE,
        }

    fila = filas[0]
    alcance = fila["alcance"] or {}
    return {
        "item": {
            "activo": True,
            "proceso": int(fila["proceso"]),
            "iniciadoEn": _iso(fila["iniciadoEn"]),
            "usuario": _text(fila["usuario"]) or None,
            "motivo": _text(alcance.get("motivo")) or None,
            "respaldo": bool(fila["respaldo"]),
            "bloquea": True,
        },
        "source": SOURCE,
    }


# ---------------------------------------------------------------------------
# 3.2 POST /api/mantenimiento
# ---------------------------------------------------------------------------
def start_maintenance(
    cia: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Entra en modo mantenimiento abriendo un proceso ``Mantenimiento``."""
    data = normalize_maintenance_start(payload)
    from .store import is_postgres

    if not is_postgres():
        raise MaintenanceLegacyNotSupported(LEGACY_MESSAGE)
    from .postgres_repository import _compania, _compania_id, _connect
    from .postgres_writes import _anio_operacion, _auditar, _commit, _usuario_id

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, cia)
            compania_id = _compania_id(cursor, codigo)
            activo = _activo(cursor, compania_id, (MAINTENANCE_TYPE,))
            if activo is not None:
                raise MaintenanceConflict(
                    f"La compañía {codigo} ya tiene un mantenimiento activo "
                    f"(proceso {activo})."
                )
            usuario_id = _usuario_id(cursor, data["usuario"])
            anio = _anio_operacion(cursor, compania_id)
            alcance = _alcance_con_motivo(data["alcance"], data["motivo"])
            cursor.execute(
                "INSERT INTO procesos (compania_id, anio, tipo, estado, alcance, "
                "respaldo_realizado, usuario_id, creado_en, actualizado_en) "
                "VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s, now(), now()) "
                "RETURNING id, creado_en",
                (
                    compania_id, anio, MAINTENANCE_TYPE, ESTADO_EJECUTANDO,
                    json.dumps(alcance), data["respaldo_realizado"], usuario_id,
                ),
            )
            proceso, creado_en = cursor.fetchone()
            _auditar(
                cursor, compania_id, usuario_id, "Inicio de mantenimiento",
                AUDIT_MODULE,
                f"Mantenimiento {int(proceso)} iniciado con respaldo confirmado.",
                data["motivo"],
                {"proceso": int(proceso), "respaldo": True},
            )
            proceso = int(proceso)
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "item": {
            "proceso": proceso, "estado": ESTADO_EJECUTANDO, "respaldo": True,
            "bloquea": True, "iniciadoEn": _iso(creado_en), "dryRun": dry_run,
        },
        "source": SOURCE,
    }


# ---------------------------------------------------------------------------
# 3.3 DELETE /api/mantenimiento
# ---------------------------------------------------------------------------
def stop_maintenance(
    cia: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Vuelve al estado normal cerrando el proceso de mantenimiento."""
    data = normalize_maintenance_stop(payload)
    from .store import is_postgres

    if not is_postgres():
        raise MaintenanceLegacyNotSupported(LEGACY_MESSAGE)
    from .postgres_repository import _compania, _compania_id, _connect
    from .postgres_writes import _auditar, _commit, _usuario_id

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, cia)
            compania_id = _compania_id(cursor, codigo)
            activo = _activo(cursor, compania_id, (MAINTENANCE_TYPE,))
            if activo is None or activo != data["proceso"]:
                raise MaintenanceNotFound(
                    f"No hay un mantenimiento activo {data['proceso']} en la "
                    f"compañía {codigo}."
                )
            en_curso = _activo(cursor, compania_id, REORGANIZATION_TYPES)
            if en_curso is not None:
                raise MaintenanceConflict(
                    f"La reorganización {en_curso} sigue en curso: espere a que "
                    "termine antes de cerrar el mantenimiento."
                )
            usuario_id = _usuario_id(cursor, data["usuario"])
            cursor.execute(
                "UPDATE procesos SET estado = %s, actualizado_en = now() "
                "WHERE id = %s AND compania_id = %s",
                (ESTADO_COMPLETADO, activo, compania_id),
            )
            _auditar(
                cursor, compania_id, usuario_id, "Cierre de mantenimiento",
                AUDIT_MODULE, f"Mantenimiento {activo} cerrado.", data["motivo"],
                {"proceso": activo},
            )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "item": {
            "proceso": activo, "estado": ESTADO_COMPLETADO, "bloquea": False,
            "dryRun": dry_run,
        },
        "source": SOURCE,
    }


# ---------------------------------------------------------------------------
# 3.4 POST /api/reorganizaciones
# ---------------------------------------------------------------------------
def start_reorganization(
    cia: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Ejecuta (o valida, con ``dryRun``) la reorganización declarada.

    Con PostgreSQL crea el proceso ``Ejecutando`` y **lanza la operación fuera de
    la petición** (§3.4): la respuesta 202 trae las tablas efectivas y el proceso,
    que se sigue en 3.5 hasta que quede ``Completado``. Con ``dryRun`` no se
    escribe ni se lanza nada.
    """
    data = normalize_reorganization(payload)
    from .store import is_postgres

    if not is_postgres():
        raise MaintenanceLegacyNotSupported(LEGACY_MESSAGE)
    from .postgres_repository import _compania, _compania_id, _connect
    from .postgres_writes import _anio_operacion, _auditar, _commit, _usuario_id

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, cia)
            compania_id = _compania_id(cursor, codigo)
            activo = _activo(cursor, compania_id, (MAINTENANCE_TYPE,))
            if activo is None:
                raise MaintenanceConflict(
                    f"No hay mantenimiento activo en la compañía {codigo}: "
                    "inícielo antes de reorganizar."
                )
            en_curso = _activo(cursor, compania_id, REORGANIZATION_TYPES)
            if en_curso is not None:
                raise MaintenanceConflict(
                    f"Ya hay una reorganización en curso (proceso {en_curso})."
                )
            alcance = _alcance_con_motivo(data["alcance"], data["motivo"])
            tablas = tablas_a_reorganizar(cursor, data["alcance"])
            usuario_id = _usuario_id(cursor, data["usuario"])
            anio = _anio_operacion(cursor, compania_id)
            cursor.execute(
                "INSERT INTO procesos (compania_id, anio, tipo, estado, alcance, "
                "usuario_id, creado_en, actualizado_en) "
                "VALUES (%s, %s, %s, %s, %s::jsonb, %s, now(), now()) "
                "RETURNING id, creado_en",
                (
                    compania_id, anio, data["tipo"], ESTADO_EJECUTANDO,
                    json.dumps(alcance), usuario_id,
                ),
            )
            proceso, creado_en = cursor.fetchone()
            _auditar(
                cursor, compania_id, usuario_id, "Reorganización", AUDIT_MODULE,
                f"Reorganización {int(proceso)} ({data['tipo']}) iniciada sobre "
                f"{len(tablas)} tabla(s).",
                data["motivo"],
                {"proceso": int(proceso), "tipo": data["tipo"], "tablas": tablas},
            )
            proceso = int(proceso)
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    if not dry_run:
        _lanzar_reorganizacion(
            compania_id=compania_id,
            proceso=int(proceso),
            tipo=data["tipo"],
            tablas=tablas,
            usuario_id=usuario_id,
            motivo=data["motivo"],
        )

    return {
        "item": {
            "proceso": proceso, "tipo": data["tipo"], "estado": ESTADO_EJECUTANDO,
            "iniciadoEn": _iso(creado_en), "tablas": tablas, "dryRun": dry_run,
        },
        "source": SOURCE,
    }


# ---------------------------------------------------------------------------
# 3.5 GET /api/reorganizaciones/{id}
# ---------------------------------------------------------------------------
def get_reorganization(cia: str, reorg_id: int) -> dict[str, Any]:
    """Consulta el estado y los conteos reales de una reorganización."""
    reorg_id = _proceso(reorg_id)
    from .store import is_postgres

    if not is_postgres():
        raise MaintenanceLegacyNotSupported(LEGACY_MESSAGE)
    from .postgres_repository import _compania, _compania_id, _connect, _filas, _text

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, cia)
            compania_id = _compania_id(cursor, codigo)
            cursor.execute(
                "SELECT p.id AS \"proceso\", p.tipo AS \"tipo\", "
                "p.estado AS \"estado\", p.resultado AS \"resultado\", "
                "p.creado_en AS \"iniciadoEn\", p.actualizado_en AS \"terminadoEn\" "
                "FROM procesos p WHERE p.id = %s AND p.compania_id = %s "
                "AND p.tipo = ANY(%s)",
                (reorg_id, compania_id, list(REORGANIZATION_TYPES)),
            )
            filas = _filas(cursor)
    finally:
        connection.close()

    if not filas:
        raise MaintenanceNotFound(
            f"No existe la reorganización {reorg_id} en la compañía {cia}."
        )

    fila = filas[0]
    estado = _text(fila["estado"])
    duracion = None
    inicio, fin = fila["iniciadoEn"], fila["terminadoEn"]
    if estado == ESTADO_COMPLETADO and inicio is not None and fin is not None:
        duracion = int((fin - inicio).total_seconds())
    return {
        "item": {
            "proceso": int(fila["proceso"]),
            "estado": estado,
            "tipo": _text(fila["tipo"]),
            "duracionSegundos": duracion,
            "resultado": fila["resultado"] or {},
        },
        "source": SOURCE,
    }
