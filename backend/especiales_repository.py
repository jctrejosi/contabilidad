"""Contratos, rama Advantage y rama PostgreSQL del bloque H6: cuentas en cero.

**Doble motor declarado (R10).** Las dos rutas del bloque
(``GET /api/especiales/cuentas-en-cero`` y
``POST /api/especiales/cuentas-en-cero/eliminar``) comparten el mismo contrato JSON
en los dos motores. Este módulo concentra:

- el contrato **puro** que comparten las ramas: la validación del cuerpo
  (año, motivo, confirmación, patrones de cuenta y tope de página), el orden de
  borrado de **abajo hacia arriba** y la causa concreta de cada rechazo;
- la rama **Advantage**, que en este bloque es una **declaración de alcance**: el
  plan de cuentas del legado vive en ``CONMAE`` y el movimiento en ``MOV01``. Las
  dos rutas exigirían recorrer ``MOV01`` cuenta por cuenta para contar renglones y
  una ``delete_account`` sobre ``CONMAE`` que **no existe hoy en ningún
  repositorio** (``backend/auditoria_repository.py`` escribe ``VISAUDI``, no borra
  cuentas). Por eso las dos rutas declaran la brecha con **503** (el mismo patrón de
  ``CONSOLID`` en D3 y de las tablas nuevas de A5);
- la implementación **PostgreSQL**, que **revalida cada cuenta en el servidor** y
  borra en **una sola transacción**, dejando el motivo por cuenta en ``auditoria``
  (``db/postgresql/schema/08_seguridad.sql:56``).

**Por qué el despacho vive aquí.** El bloque H6 todavía no tiene entradas en
:mod:`backend.store`, así que las dos funciones públicas resuelven su rama con
``is_postgres()`` (importado dentro de la función, como pide el proyecto) en vez de
en la fachada.

**Qué es eliminable.** Una cuenta del plan es eliminable si tiene **saldo cero en
el año**, **ningún renglón** en ``documento_lineas`` ni ``lote_lineas``, **ningún
acumulado distinto de cero** y **ningún hijo** en la jerarquía
(``cuentas.parent_id``). La lectura reporta el flag por fila y un resumen; la
escritura vuelve a comprobar la misma regla antes de borrar y rechaza, con su
causa, la cuenta que dejó de cumplirla —sin abortar el resto.
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Any

# ---------------------------------------------------------------------------
# Constantes de contrato (R6: los códigos se validan con patrón)
# ---------------------------------------------------------------------------
COMPANY_CODE = re.compile(r"^[0-9]{1,3}$")
ACCOUNT_CODE = re.compile(r"^[0-9]{1,12}$")

MIN_YEAR = 1900
MAX_YEAR = 2100

# El motivo lo exige la pantalla con un mínimo de 10 caracteres
# (``Especiales.tsx:97-105``) y el contrato lo acota a 180.
MIN_REASON = 10
MAX_REASON = 180
MAX_USER = 4

# Confirmación literal de la baja más destructiva del plan (§4.2).
REMOVAL_CONFIRMATION = "ELIMINAR"

DEFAULT_PAGE_SIZE = 100
MAX_PAGE_SIZE = 500  # ``pageSize`` del contrato (§4.1)

# Tope defensivo de la lista de cuentas de una sola ejecución.
MAX_ACCOUNTS = 5000

SOURCE = "cuentas"
ACCION_BITACORA = "Eliminación de cuenta en cero"
MODULO_BITACORA = "Especiales"

# La rama PostgreSQL conserva el contenido de cada fila borrada en
# ``auditoria.parametros`` (ver ``_delete_zero_accounts_pg``); por eso el informe
# declara ``respaldo`` verdadero. El campo es informativo: el respaldo físico de la
# base sigue siendo responsabilidad del operador (§4.2).
RESPALDO_SOPORTADO = True


# ---------------------------------------------------------------------------
# Mensajes declarados de la rama heredada
# ---------------------------------------------------------------------------
LEGACY_LIST_MESSAGE = (
    "El análisis de cuentas en cero no está implementado en Advantage: exige leer "
    "el plan de cuentas (CONMAE) y contar los renglones de cada cuenta recorriendo "
    "MOV01, y ese recorrido masivo pertenece a un script de migración, no a la ruta "
    "(docs/plan/backend/detalle/impuestos.md §4.1). La ruta solo está implementada "
    "con PostgreSQL."
)

LEGACY_DELETE_MESSAGE = (
    "La eliminación de cuentas en cero no está implementada en Advantage: exige una "
    "delete_account sobre CONMAE —que hoy no existe en ningún repositorio— y, antes "
    "de borrar, recorrer MOV01 para descartar movimientos. La ruta solo está "
    "implementada con PostgreSQL."
)


# ---------------------------------------------------------------------------
# Excepciones de dominio (R5: el llamador las mapea a HTTP)
# ---------------------------------------------------------------------------
class EspecialesNotFound(RuntimeError):
    """No existe la compañía o una cuenta pedida para la compañía activa (404)."""


class EspecialesConflict(RuntimeError):
    """Una cuenta choca con su estado real: dejó de estar en cero o tiene hijos (409)."""


class EspecialesValidationError(ValueError):
    """El cuerpo de la operación incumple las reglas del contrato (422)."""


class EspecialesLegacyNotSupported(RuntimeError):
    """La operación no tiene representación honesta en el legado (503, R10)."""


# ---------------------------------------------------------------------------
# Helpers puros de contrato
# ---------------------------------------------------------------------------
def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value if value is not None else "0")).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0.00")


def _anio(value: Any) -> int:
    try:
        anio = int(value)
    except (TypeError, ValueError) as exc:
        raise EspecialesValidationError("El año es obligatorio y debe ser un número.") from exc
    if not MIN_YEAR <= anio <= MAX_YEAR:
        raise EspecialesValidationError(
            f"El año debe estar entre {MIN_YEAR} y {MAX_YEAR}."
        )
    return anio


def _page(value: Any) -> int:
    try:
        page = int(value)
    except (TypeError, ValueError) as exc:
        raise EspecialesValidationError("La página debe ser un número.") from exc
    if page < 1:
        raise EspecialesValidationError("La página debe ser mayor o igual a 1.")
    return page


def _page_size(value: Any) -> int:
    try:
        page_size = int(value)
    except (TypeError, ValueError) as exc:
        raise EspecialesValidationError("El tamaño de página debe ser un número.") from exc
    if not 1 <= page_size <= MAX_PAGE_SIZE:
        raise EspecialesValidationError(
            f"El tamaño de página debe estar entre 1 y {MAX_PAGE_SIZE}."
        )
    return page_size


def _usuario(value: Any) -> str:
    usuario = _text(value).upper() or "WEB"
    if len(usuario) > MAX_USER:
        raise EspecialesValidationError(f"El usuario admite máximo {MAX_USER} caracteres.")
    return usuario


def _motivo(value: Any) -> str:
    motivo = _text(value)
    if not MIN_REASON <= len(motivo) <= MAX_REASON:
        raise EspecialesValidationError(
            f"El motivo es obligatorio y debe tener entre {MIN_REASON} y {MAX_REASON} caracteres."
        )
    return motivo


def _cuenta_codigo(value: Any, campo: str) -> str:
    codigo = _text(value)
    if not ACCOUNT_CODE.fullmatch(codigo):
        raise EspecialesValidationError(
            f"La cuenta de {campo} debe tener entre 1 y 12 dígitos."
        )
    return codigo


# ---------------------------------------------------------------------------
# Normalización del cuerpo (validación antes de abrir la conexión)
# ---------------------------------------------------------------------------
def normalize_removal(payload: dict[str, Any]) -> dict[str, Any]:
    """Cuerpo de ``ZeroAccountRemoval``: año, cuentas, usuario, motivo y confirmación (§4.2).

    La lista de cuentas es obligatoria (``min_length=1``), cada código cumple el
    patrón de 1 a 12 dígitos y se **depura** conservando su orden, para que una
    misma cuenta repetida no cuente dos veces en ``solicitadas``.
    """
    entrada = payload.get("cuentas")
    if not isinstance(entrada, list) or not entrada:
        raise EspecialesValidationError("La eliminación requiere al menos una cuenta.")
    if len(entrada) > MAX_ACCOUNTS:
        raise EspecialesValidationError(
            f"La eliminación admite máximo {MAX_ACCOUNTS} cuentas por ejecución."
        )

    cuentas: list[str] = []
    vistas: set[str] = set()
    for indice, valor in enumerate(entrada, 1):
        codigo = _cuenta_codigo(valor, f"la posición {indice}")
        if codigo not in vistas:
            vistas.add(codigo)
            cuentas.append(codigo)

    confirmacion = _text(payload.get("confirmacion"))
    if confirmacion != REMOVAL_CONFIRMATION:
        raise EspecialesValidationError(
            f"La confirmación debe ser el texto literal {REMOVAL_CONFIRMATION}."
        )

    return {
        "anio": _anio(payload.get("anio")),
        "cuentas": cuentas,
        "usuario": _usuario(payload.get("usuario")),
        "motivo": _motivo(payload.get("motivo")),
        "confirmacion": confirmacion,
    }


# ---------------------------------------------------------------------------
# Contrato puro de la revalidación y del orden de borrado
# ---------------------------------------------------------------------------
def motivo_rechazo(estado: dict[str, Any]) -> str | None:
    """Causa por la que una cuenta **no** se puede eliminar, o ``None`` si se puede.

    ``estado`` trae lo que se leyó de la base para una cuenta: ``saldo`` del año,
    ``movimientos`` (renglones en el libro y en los lotes), ``acumulados``
    (acumulados distintos de cero) y ``hijos_fuera_lista`` (hijos del plan que no
    vienen en la misma solicitud). Un hijo que **sí** viene en la lista no
    descalifica: la cuenta se borra de abajo hacia arriba.
    """
    saldo = _decimal(estado.get("saldo"))
    if saldo != 0:
        return f"tiene saldo {saldo}"
    movimientos = int(estado.get("movimientos") or 0)
    if movimientos > 0:
        return f"tiene {movimientos} movimientos"
    if int(estado.get("acumulados") or 0) > 0:
        return "tiene acumulados distintos de cero"
    fuera = int(estado.get("hijos_fuera_lista") or 0)
    if fuera > 0:
        return f"tiene {fuera} hijos fuera de la lista"
    return None


def clasificar_rechazos(
    estados: list[dict[str, Any]], solicitadas: list[str]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Separa las cuentas eliminables de las rechazadas, con su causa.

    Devuelve ``(eliminables, rechazadas)``. Las eliminables salen en orden de
    borrado —**de abajo hacia arriba**: nivel descendente y, a igual nivel, código
    descendente—, de modo que un padre con hijos en la lista siempre se borra
    después de ellos. Un padre cuyos hijos vienen en la lista pero alguno fue
    rechazado también se rechaza. Las rechazadas conservan el orden solicitado.
    """
    orden = sorted(
        estados, key=lambda item: (int(item["nivel"]), _text(item["cuenta"])), reverse=True
    )
    causas: dict[str, str] = {}
    for estado in orden:
        codigo = _text(estado["cuenta"])
        causa = motivo_rechazo(estado)
        if causa is None and any(causas.get(_text(hijo)) for hijo in estado.get("hijos_en_lista", [])):
            causa = "tiene hijos que no se pueden eliminar"
        if causa is not None:
            causas[codigo] = causa

    eliminables = [estado for estado in orden if _text(estado["cuenta"]) not in causas]
    rechazadas = [
        {"cuenta": codigo, "detalle": causas[codigo]}
        for codigo in solicitadas
        if codigo in causas
    ]
    return eliminables, rechazadas


# ---------------------------------------------------------------------------
# Rama Advantage: declarada no soportada (R10)
# ---------------------------------------------------------------------------
def _list_zero_accounts_ads(
    cia: str, *, anio: int, incluir_no_afectables: bool, page: int, page_size: int
) -> dict[str, Any]:
    """El análisis por cuenta exige recorrer ``MOV01``: declarado no soportado (§4.1)."""
    raise EspecialesLegacyNotSupported(LEGACY_LIST_MESSAGE)


def _delete_zero_accounts_ads(
    cia: str, *, data: dict[str, Any], user: str, dry_run: bool
) -> dict[str, Any]:
    """La baja exige ``delete_account`` sobre ``CONMAE``: declarada no soportada (§4.2)."""
    raise EspecialesLegacyNotSupported(LEGACY_DELETE_MESSAGE)


def delete_account(cia: str, cuenta: str, *, user: str = "WEB") -> dict[str, Any]:
    """Baja física de una cuenta en Advantage (``CONMAE`` + ``MOV01``).

    **Declarada, no implementada.** El legado no tiene ``delete_account`` en ningún
    repositorio; su contraparte obliga a recorrer ``MOV01`` para descartar
    movimientos antes de borrar de ``CONMAE``. Se declara la brecha con **503** en
    vez de simular una baja.
    """
    _cuenta_codigo(cuenta, "la cuenta")
    raise EspecialesLegacyNotSupported(LEGACY_DELETE_MESSAGE)


# ---------------------------------------------------------------------------
# Rama PostgreSQL · lectura (4.1)
# ---------------------------------------------------------------------------
# Universo del análisis: el plan vivo de la compañía y, salvo que se pidan, solo
# las cuentas afectables. El saldo del año se arma con la misma convención del
# balance: la apertura (``saldo_inicial``, período ``00``) y los movimientos;
# sobre ``credito`` se toma el valor absoluto porque el cargador volcó los créditos
# del legado en negativo (``build_trial_balance``), mientras que las escrituras
# nuevas los guardan positivos —``abs`` es la lectura fiel en los dos casos.
ZERO_ACCOUNTS_SQL = (
    "SELECT u.codigo, u.nombre, u.nivel, u.afectable, "
    "COALESCE(sa.saldo, 0) AS saldo, "
    "COALESCE(mv.movimientos, 0) AS movimientos, "
    "COALESCE(hj.hijos, 0) AS hijos, "
    "(ac.cuenta_id IS NOT NULL) AS acumulados "
    "FROM ("
    "    SELECT cu.id, cu.codigo, cu.nombre, cu.nivel, cu.afectable "
    "    FROM cuentas cu "
    "    WHERE cu.compania_id = %s AND cu.eliminado_en IS NULL AND (%s OR cu.afectable)"
    ") u "
    "LEFT JOIN ("
    "    SELECT s.cuenta_id, "
    "           COALESCE(SUM(s.saldo_inicial), 0) + COALESCE(SUM(s.debito), 0) "
    "           - COALESCE(SUM(abs(s.credito)), 0) AS saldo "
    "    FROM saldos_cuenta s "
    "    WHERE s.compania_id = %s AND s.anio = %s GROUP BY s.cuenta_id"
    ") sa ON sa.cuenta_id = u.id "
    "LEFT JOIN ("
    "    SELECT cuenta_id, COUNT(*) AS movimientos FROM ("
    "        SELECT cuenta_id FROM documento_lineas WHERE compania_id = %s "
    "        UNION ALL "
    "        SELECT cuenta_id FROM lote_lineas WHERE compania_id = %s"
    "    ) m GROUP BY cuenta_id"
    ") mv ON mv.cuenta_id = u.id "
    "LEFT JOIN ("
    "    SELECT parent_id AS cuenta_id, COUNT(*) AS hijos FROM cuentas "
    "    WHERE compania_id = %s AND parent_id IS NOT NULL AND eliminado_en IS NULL "
    "    GROUP BY parent_id"
    ") hj ON hj.cuenta_id = u.id "
    "LEFT JOIN ("
    "    SELECT cuenta_id FROM ("
    "        SELECT cuenta_id FROM acumulados_tercero "
    "        WHERE compania_id = %s AND (debito <> 0 OR credito <> 0) "
    "        UNION ALL "
    "        SELECT cuenta_id FROM acumulados_centro "
    "        WHERE compania_id = %s AND (debito <> 0 OR credito <> 0)"
    "    ) a GROUP BY cuenta_id"
    ") ac ON ac.cuenta_id = u.id "
    "ORDER BY u.codigo"
)


def _es_eliminable(fila: dict[str, Any]) -> bool:
    return (
        _decimal(fila.get("saldo")) == 0
        and int(fila.get("movimientos") or 0) == 0
        and not bool(fila.get("acumulados"))
        and int(fila.get("hijos") or 0) == 0
    )


def _list_item(fila: dict[str, Any]) -> dict[str, Any]:
    return {
        "cuenta": _text(fila.get("codigo")),
        "nombre": _text(fila.get("nombre")),
        "nivel": int(fila.get("nivel") or 0),
        "afectable": bool(fila.get("afectable")),
        "saldo": float(_decimal(fila.get("saldo"))),
        "movimientos": int(fila.get("movimientos") or 0),
        "tieneHijos": int(fila.get("hijos") or 0) > 0,
        "eliminable": _es_eliminable(fila),
    }


def _list_zero_accounts_pg(
    cia: str, *, anio: int, incluir_no_afectables: bool, page: int, page_size: int
) -> dict[str, Any]:
    from .ads_repository import CompanyNotFound
    from .postgres_repository import _compania, _compania_id, _connect, _filas

    with _connect() as connection, connection.cursor() as cursor:
        try:
            codigo = _compania(cursor, cia)
        except CompanyNotFound as exc:
            raise EspecialesNotFound(str(exc)) from exc
        compania_id = _compania_id(cursor, codigo)
        cursor.execute(
            ZERO_ACCOUNTS_SQL,
            (
                compania_id, incluir_no_afectables,
                compania_id, anio,
                compania_id, compania_id,
                compania_id,
                compania_id, compania_id,
            ),
        )
        filas = _filas(cursor)

    revisadas = len(filas)
    en_cero = [fila for fila in filas if _decimal(fila.get("saldo")) == 0]
    con_hijos = sum(1 for fila in en_cero if int(fila.get("hijos") or 0) > 0)
    eliminables = sum(1 for fila in en_cero if _es_eliminable(fila))

    inicio = (page - 1) * page_size
    items = [_list_item(fila) for fila in en_cero[inicio : inicio + page_size]]
    return {
        "items": items,
        "count": len(items),
        "resumen": {
            "revisadas": revisadas,
            "enCero": len(en_cero),
            "eliminables": eliminables,
            "conHijos": con_hijos,
        },
        "source": SOURCE,
    }


# ---------------------------------------------------------------------------
# Rama PostgreSQL · escritura (4.2)
# ---------------------------------------------------------------------------
def _estados_de_cuentas(
    cursor: Any, compania_id: int, codigos: list[str], anio: int
) -> list[dict[str, Any]]:
    """Lee el estado real de cada cuenta pedida para revalidarla en el servidor.

    Una sola pasada por cuenta y consultas por lote con ``= ANY`` evitan el N+1.
    Una cuenta que no existe en el plan activo detiene la operación con
    :class:`EspecialesNotFound` (404): la lista apunta a algo que no está.
    """
    from .postgres_repository import _text as _pg_text

    cursor.execute(
        "SELECT id, codigo, nombre, nivel, afectable FROM cuentas "
        "WHERE compania_id = %s AND codigo = ANY(%s) AND eliminado_en IS NULL",
        (compania_id, codigos),
    )
    por_codigo = {
        _pg_text(fila[1]): fila for fila in cursor.fetchall()
    }
    faltantes = [codigo for codigo in codigos if codigo not in por_codigo]
    if faltantes:
        raise EspecialesNotFound(
            f"No existe la cuenta {faltantes[0]} en el plan de la compañía."
        )
    ids = [int(fila[0]) for fila in por_codigo.values()]

    cursor.execute(
        "SELECT s.cuenta_id, COALESCE(SUM(s.saldo_inicial), 0) + COALESCE(SUM(s.debito), 0) "
        "- COALESCE(SUM(abs(s.credito)), 0) FROM saldos_cuenta s "
        "WHERE s.compania_id = %s AND s.anio = %s AND s.cuenta_id = ANY(%s) GROUP BY s.cuenta_id",
        (compania_id, anio, ids),
    )
    saldos = {int(fila[0]): _decimal(fila[1]) for fila in cursor.fetchall()}

    cursor.execute(
        "SELECT cuenta_id, COUNT(*) FROM ("
        "  SELECT cuenta_id FROM documento_lineas WHERE compania_id = %s AND cuenta_id = ANY(%s)"
        "  UNION ALL"
        "  SELECT cuenta_id FROM lote_lineas WHERE compania_id = %s AND cuenta_id = ANY(%s)"
        ") m GROUP BY cuenta_id",
        (compania_id, ids, compania_id, ids),
    )
    movimientos = {int(fila[0]): int(fila[1]) for fila in cursor.fetchall()}

    cursor.execute(
        "SELECT cuenta_id, COUNT(*) FROM ("
        "  SELECT cuenta_id FROM acumulados_tercero WHERE compania_id = %s AND cuenta_id = ANY(%s) "
        "  AND (debito <> 0 OR credito <> 0)"
        "  UNION ALL"
        "  SELECT cuenta_id FROM acumulados_centro WHERE compania_id = %s AND cuenta_id = ANY(%s) "
        "  AND (debito <> 0 OR credito <> 0)"
        ") a GROUP BY cuenta_id",
        (compania_id, ids, compania_id, ids),
    )
    acumulados = {int(fila[0]): int(fila[1]) for fila in cursor.fetchall()}

    cursor.execute(
        "SELECT c.parent_id, c.codigo FROM cuentas c "
        "WHERE c.compania_id = %s AND c.parent_id = ANY(%s) AND c.eliminado_en IS NULL",
        (compania_id, ids),
    )
    hijos: dict[int, list[str]] = {}
    for parent_id, codigo_hijo in cursor.fetchall():
        hijos.setdefault(int(parent_id), []).append(_pg_text(codigo_hijo))

    solicitadas = set(codigos)
    estados: list[dict[str, Any]] = []
    for codigo in codigos:
        fila = por_codigo[codigo]
        cuenta_id = int(fila[0])
        codigos_hijos = hijos.get(cuenta_id, [])
        estados.append(
            {
                "id": cuenta_id,
                "cuenta": codigo,
                "nombre": _pg_text(fila[2]),
                "nivel": int(fila[3]),
                "afectable": bool(fila[4]),
                "saldo": saldos.get(cuenta_id, Decimal("0.00")),
                "movimientos": movimientos.get(cuenta_id, 0),
                "acumulados": acumulados.get(cuenta_id, 0),
                "hijos_fuera_lista": sum(1 for hijo in codigos_hijos if hijo not in solicitadas),
                "hijos_en_lista": [hijo for hijo in codigos_hijos if hijo in solicitadas],
            }
        )
    return estados


def _borrar_cuenta(cursor: Any, compania_id: int, cuenta_id: int) -> None:
    """Borra la cuenta y sus derivados.

    ``saldos_cuenta`` (y sus vistas por tercero y centro) y los acumulados en cero
    son **regenerables** y sus claves foráneas apuntan a ``cuentas``: sin borrarlos
    la baja física no pasa. Los acumulados distintos de cero ya se rechazaron antes
    de llegar aquí, así que solo se retiran los que están en cero.
    """
    for tabla in ("saldos_cuenta", "saldos_cuenta_tercero", "saldos_cuenta_centro"):
        cursor.execute(
            f"DELETE FROM {tabla} WHERE compania_id = %s AND cuenta_id = %s",
            (compania_id, cuenta_id),
        )
    for tabla in ("acumulados_tercero", "acumulados_centro"):
        cursor.execute(
            f"DELETE FROM {tabla} WHERE compania_id = %s AND cuenta_id = %s "
            "AND debito = 0 AND credito = 0",
            (compania_id, cuenta_id),
        )
    cursor.execute(
        "DELETE FROM cuentas WHERE compania_id = %s AND id = %s",
        (compania_id, cuenta_id),
    )


def _causa_borrado(exc: Exception) -> str:
    detalle = _text(exc) or type(exc).__name__
    return f"no se pudo eliminar: {detalle[:160]}"


def _delete_zero_accounts_pg(
    cia: str, *, data: dict[str, Any], user: str, dry_run: bool
) -> dict[str, Any]:
    from .ads_repository import CompanyNotFound
    from .postgres_repository import _compania, _compania_id, _connect
    from .postgres_writes import _auditar, _commit, _usuario_id

    codigos = data["cuentas"]
    actor = data["usuario"] or user
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            try:
                codigo = _compania(cursor, cia)
            except CompanyNotFound as exc:
                raise EspecialesNotFound(str(exc)) from exc
            compania_id = _compania_id(cursor, codigo)
            estados = _estados_de_cuentas(cursor, compania_id, codigos, data["anio"])
            eliminables, rechazadas = clasificar_rechazos(estados, codigos)

            if not dry_run and eliminables:
                usuario_id = _usuario_id(cursor, actor)
                for estado in list(eliminables):
                    cuenta_id = int(estado["id"])
                    codigo_cuenta = _text(estado["cuenta"])
                    # Un punto de guardado por cuenta: si un derivado imprevisto
                    # bloquea la baja, se revierte esa sola cuenta y se informa su
                    # causa sin abortar el resto.
                    cursor.execute("SAVEPOINT especial_cuenta")
                    try:
                        _borrar_cuenta(cursor, compania_id, cuenta_id)
                        cursor.execute("RELEASE SAVEPOINT especial_cuenta")
                    except Exception as exc:  # noqa: BLE001 - se informa como rechazo
                        cursor.execute("ROLLBACK TO SAVEPOINT especial_cuenta")
                        rechazadas.append({"cuenta": codigo_cuenta, "detalle": _causa_borrado(exc)})
                        eliminables = [e for e in eliminables if _text(e["cuenta"]) != codigo_cuenta]
                        continue
                    _auditar(
                        cursor,
                        compania_id,
                        usuario_id,
                        ACCION_BITACORA,
                        MODULO_BITACORA,
                        f"Cuenta {codigo_cuenta} — {_text(estado['nombre'])} eliminada por estar en cero.",
                        data["motivo"],
                        {
                            "cuenta": codigo_cuenta,
                            "nombre": _text(estado["nombre"]),
                            "nivel": int(estado["nivel"]),
                            "afectable": bool(estado["afectable"]),
                            "anio": data["anio"],
                            "saldo": float(_decimal(estado["saldo"])),
                            "respaldo": RESPALDO_SOPORTADO,
                        },
                    )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "item": {
            "solicitadas": len(codigos),
            "eliminadas": len(eliminables),
            "rechazadas": rechazadas,
            "respaldo": RESPALDO_SOPORTADO,
            "dryRun": bool(dry_run),
        },
        "source": SOURCE,
    }


# ---------------------------------------------------------------------------
# Contrato público: resuelve la rama y valida antes de tocar el motor
# ---------------------------------------------------------------------------
def list_zero_accounts(
    cia: str,
    *,
    anio: int,
    incluir_no_afectables: bool = False,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    """Analiza las cuentas del plan sin saldo ni movimiento (§4.1). Solo lectura."""
    anio = _anio(anio)
    page = _page(page)
    page_size = _page_size(page_size)
    incluir = bool(incluir_no_afectables)

    from .store import is_postgres

    if not is_postgres():
        return _list_zero_accounts_ads(
            cia, anio=anio, incluir_no_afectables=incluir, page=page, page_size=page_size
        )
    return _list_zero_accounts_pg(
        cia, anio=anio, incluir_no_afectables=incluir, page=page, page_size=page_size
    )


def delete_zero_accounts(
    cia: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Elimina las cuentas en cero confirmadas, con revalidación y bitácora (§4.2).

    Valida el cuerpo **antes** de abrir la conexión; ``dry_run`` devuelve el mismo
    informe sin borrar nada y sin escribir bitácora.
    """
    data = normalize_removal(payload)

    from .store import is_postgres

    if not is_postgres():
        return _delete_zero_accounts_ads(cia, data=data, user=user, dry_run=dry_run)
    return _delete_zero_accounts_pg(cia, data=data, user=user, dry_run=dry_run)
