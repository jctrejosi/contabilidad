"""Mantenimiento de índices de las tablas contables del ADD de Advantage.

El programa Harbour borraba archivos ADI, hacía PACK y creaba índices con
expresiones codificadas. Aquí el diccionario existente es la fuente de verdad:
``sp_Reindex`` reconstruye sus índices auto-open sin cambiar nombres, claves,
condiciones ni tamaño de página (0 = conservar el actual). La creación de un
índice nuevo es una operación separada, explícita y verificada. No se ejecuta PACK.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from .ads_repository import _open_recordset, _rows, ads_odbc_connection, read_local_env

# Tablas referenciadas por funciones del backend contable. Las que no estén
# registradas en este ADD se informan, pero nunca se abren por ruta física.
TABLAS_CONTABLES = (
    "COCENTRO", "CONCECOS", "CONCTR", "CONDECLA", "CONDOCUM",
    "CONEMP", "CONFORMA", "CONGENF", "CONIVA", "CONLOTES",
    "CONMAE", "CONMAG1", "CONMAG2", "CONMAG3", "CONMAGDT",
    "CONMOVI", "CONRET", "CONTERCE", "CONTICOM", "CONTIIVA",
    "CONTIRET", "FADCLI", "MOV01", "VISDOCUM",
)

_lock = threading.Lock()
_job: dict[str, Any] | None = None


class ReorganizationConflict(RuntimeError):
    """El plan cambió o ya hay una reindexación en ejecución."""


class ReorganizationValidationError(ValueError):
    """No se cumplió una condición necesaria para iniciar el mantenimiento."""


_IDENTIFIER = re.compile(r"^[A-Z][A-Z0-9_]{0,127}$")


def _identifier(value: str, label: str) -> str:
    """Solo admite identificadores simples; nunca SQL libre desde el navegador."""
    normalized = value.strip().upper()
    if not _IDENTIFIER.fullmatch(normalized):
        raise ReorganizationValidationError(f"{label} debe contener solo letras, números o guion bajo y empezar por una letra.")
    return normalized


def _index_columns(expression: str) -> list[str]:
    """Interpreta las claves simples registradas por SQL en el diccionario."""
    parts = re.split(r"[;,]", expression.upper())
    return [part.strip().strip('"') for part in parts if part.strip()]


def get_index_catalog() -> dict[str, Any]:
    """Tablas contables y campos reales del ADD para el selector de índices."""
    with ads_odbc_connection(no_table_cache=True) as connection:
        registered = {
            str(row["Name"]).strip().upper()
            for row in _select_rows(connection, "SELECT Name FROM system.tables")
        }
        rows = _select_rows(connection, "SELECT Parent, Name FROM system.columns")
    tables = []
    for table in TABLAS_CONTABLES:
        if table in registered:
            columns = [
                str(row["Name"]).strip().upper() for row in rows
                if str(row["Parent"]).strip().upper() == table
                and _IDENTIFIER.fullmatch(str(row["Name"]).strip().upper())
            ]
            tables.append({"tabla": table, "campos": columns})
    return {"tablas": tables}


def _creation_plan(connection: Any, table: str, name: str, columns: list[str]) -> dict[str, Any]:
    table = _identifier(table, "La tabla")
    name = _identifier(name, "El nombre del índice")
    columns = [_identifier(column, "El campo") for column in columns]
    if not 1 <= len(columns) <= 8 or len(set(columns)) != len(columns):
        raise ReorganizationValidationError("Seleccione de 1 a 8 campos diferentes, en el orden requerido.")
    if table not in TABLAS_CONTABLES:
        raise ReorganizationValidationError("La tabla no pertenece a las tablas contables administradas.")
    registered = {
        str(row["Name"]).strip().upper()
        for row in _select_rows(connection, "SELECT Name FROM system.tables")
    }
    if table not in registered:
        raise ReorganizationValidationError(f"{table} no está registrada en el diccionario actual.")
    valid_columns = {
        str(row["Name"]).strip().upper() for row in
        _select_rows(connection, "SELECT Parent, Name FROM system.columns")
        if str(row["Parent"]).strip().upper() == table
    }
    invalid = [column for column in columns if column not in valid_columns]
    if invalid:
        raise ReorganizationValidationError(f"Campos inexistentes en {table}: {', '.join(invalid)}.")
    indexes = _select_rows(connection, "SELECT Parent, Name, Index_Expression FROM system.indexes")
    same_name = next((row for row in indexes if str(row["Name"]).strip().upper() == name), None)
    same_definition = next((row for row in indexes if
        str(row["Parent"]).strip().upper() == table
        and _index_columns(str(row["Index_Expression"])) == columns), None)
    if same_name:
        if str(same_name["Parent"]).strip().upper() == table and _index_columns(str(same_name["Index_Expression"])) == columns:
            state = "existente"
            reason = "Este índice ya existe con los mismos campos. No se creará de nuevo."
        else:
            state = "conflicto"
            reason = "El nombre ya está registrado con otra definición. Revíselo antes de continuar."
    elif same_definition:
        state = "conflicto"
        reason = f"Ya existe un índice equivalente llamado {str(same_definition['Name']).strip()}."
    else:
        state = "pendiente"
        reason = "El índice no existe y se puede crear."
    signature = hashlib.sha256(json.dumps({
        "tabla": table, "nombre": name, "campos": columns,
        "indices": sorted((str(row["Parent"]).strip().upper(), str(row["Name"]).strip().upper(),
                           str(row["Index_Expression"]).strip().upper()) for row in indexes),
    }, sort_keys=True).encode("utf-8")).hexdigest()
    return {"tabla": table, "nombre": name, "campos": columns,
            "estado": state, "motivo": reason, "huella": signature}


def get_index_creation_plan(*, table: str, name: str, columns: list[str]) -> dict[str, Any]:
    """Vista previa sin cambios; comprueba campos y duplicados en el ADD activo."""
    with ads_odbc_connection(no_table_cache=True) as connection:
        return _creation_plan(connection, table, name, columns)


def _run_index_creation(plan: dict[str, Any]) -> None:
    started = time.monotonic()
    try:
        with ads_odbc_connection(no_table_cache=True) as connection:
            connection.CommandTimeout = 3600
            current = _creation_plan(connection, plan["tabla"], plan["nombre"], plan["campos"])
            if current["huella"] != plan["huella"] or current["estado"] != "pendiente":
                raise ReorganizationConflict("El diccionario cambió; actualice la vista previa.")
            if _check_tables_openable(connection, {"tablas": [{"tabla": plan["tabla"], "indices": [{}]}]}):
                raise ReorganizationConflict(f"Advantage no puede abrir {plan['tabla']}. Reorganice o revise sus archivos primero.")
            # Los tres identificadores proceden de _identifier y los campos se
            # comprobaron contra system.columns; no hay SQL arbitrario.
            sql = f"CREATE INDEX {plan['nombre']} ON {plan['tabla']} ({', '.join(plan['campos'])})"
            response = connection.Execute(sql)
            recordset = response[0] if isinstance(response, tuple) else response
            if recordset is not None and getattr(recordset, "State", 0):
                recordset.Close()
        # Reabrir la conexión verifica que la definición quedó en el ADD y no
        # fue solo un índice temporal de esta sesión.
        verification = get_index_creation_plan(
            table=plan["tabla"], name=plan["nombre"], columns=plan["campos"]
        )
        if verification["estado"] != "existente":
            raise ReorganizationConflict("Advantage ejecutó la orden, pero el índice no quedó registrado en el ADD. Verifique que la conexión tenga permisos de administración.")
        _set_job(estado="Completada", fin=_utc_now(), segundos=round(time.monotonic() - started, 2))
    except Exception as exc:
        _set_job(estado="Fallida", fin=_utc_now(), segundos=round(time.monotonic() - started, 2), error=f"{type(exc).__name__}: {exc}")


def start_index_creation(*, table: str, name: str, columns: list[str], huella: str,
                         respaldo: bool, confirmacion: str) -> dict[str, Any]:
    """Crea un solo índice en segundo plano tras confirmación explícita."""
    global _job
    if not respaldo or confirmacion != "CREAR INDICE":
        raise ReorganizationValidationError("Confirme el respaldo y escriba CREAR INDICE.")
    with _lock:
        if _job and _job["estado"] == "Ejecutando":
            raise ReorganizationConflict("Ya hay un mantenimiento de índices en curso.")
        plan = get_index_creation_plan(table=table, name=name, columns=columns)
        if plan["huella"] != huella:
            raise ReorganizationConflict("El diccionario cambió; actualice la vista previa.")
        if plan["estado"] != "pendiente":
            raise ReorganizationConflict(plan["motivo"])
        _job = {"id": str(uuid4()), "tipo": "crearIndice", "estado": "Ejecutando",
                "inicio": _utc_now(), "fin": None, "segundos": None,
                "tablaActual": plan["tabla"], "nombreIndice": plan["nombre"],
                "totalTablas": 1, "totalIndices": 1, "resultados": [], "error": None}
        response = json.loads(json.dumps(_job))
    threading.Thread(target=_run_index_creation, args=(plan,), name="ads-create-index", daemon=True).start()
    return response


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _select_rows(connection: Any, sql: str) -> list[dict[str, Any]]:
    recordset = _open_recordset(connection, sql)
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _inventory(connection: Any) -> dict[str, Any]:
    """Lee exclusivamente las tablas e índices que pertenecen al ADD activo."""
    table_rows = _select_rows(connection, "SELECT Name FROM system.tables")
    index_rows = _select_rows(
        connection,
        "SELECT Parent, Name, Index_File_Name, Index_Expression, "
        "Index_Condition, Index_Options, Index_Key_Length "
        "FROM system.indexes",
    )
    registered = {str(row["Name"]).strip().upper() for row in table_rows}
    listed: list[dict[str, Any]] = []
    missing: list[str] = []
    for table in TABLAS_CONTABLES:
        if table not in registered:
            missing.append(table)
            continue
        indexes = sorted(
            (
                {
                    "nombre": str(row["Name"]).strip(),
                    "archivo": str(row["Index_File_Name"]).strip(),
                    "expresion": str(row["Index_Expression"]).strip(),
                    "condicion": str(row["Index_Condition"] or "").strip(),
                    "opciones": int(row["Index_Options"] or 0),
                    "longitud": int(row["Index_Key_Length"] or 0),
                }
                for row in index_rows
                if str(row["Parent"]).strip().upper() == table
            ),
            key=lambda item: (item["archivo"].upper(), item["nombre"].upper()),
        )
        listed.append({"tabla": table, "indices": indexes})
    signature = hashlib.sha256(
        json.dumps({"tablas": listed, "ausentes": missing}, sort_keys=True).encode("utf-8")
    ).hexdigest()
    return {
        "tablas": listed,
        "ausentes": missing,
        "totalIndices": sum(len(item["indices"]) for item in listed),
        "huella": signature,
    }


def _check_tables_openable(connection: Any, plan: dict[str, Any]) -> list[dict[str, str]]:
    """Detecta índices/archivos ausentes antes de reindexar una sola tabla.

    Leer una fila obliga a Advantage a abrir la tabla y sus índices auto-open.
    Consultar únicamente system.indexes no detecta un ADI que falta en disco.
    """
    failures: list[dict[str, str]] = []
    for item in plan["tablas"]:
        if not item["indices"]:
            continue
        table = item["tabla"]  # Lista fija corroborada contra system.tables.
        try:
            recordset = _open_recordset(connection, f"SELECT TOP 1 * FROM {table}")
            recordset.Close()
        except Exception as exc:
            message = str(exc)
            if "7041" in message:
                message = "Advantage no encuentra un archivo de la tabla o de sus índices."
            failures.append({"tabla": table, "motivo": message})
    return failures


def _missing_index_files(connection: Any, table: str) -> list[Path]:
    """Identifica ADI ausentes solo si la ADT y las rutas son locales al ADD.

    No se intenta reparar un 7041 causado por tabla ausente, permisos o por
    archivos en otro servidor cuya ruta física no se pueda verificar aquí.
    """
    source = os.environ.get("ADS_DATA_SOURCE") or read_local_env().get("ADS_DATA_SOURCE", "")
    dictionary = Path(source).resolve()
    if not dictionary.is_file() or dictionary.suffix.lower() != ".add":
        return []
    base = dictionary.parent
    tables = _select_rows(connection, "SELECT Name, Table_Relative_Path FROM system.tables")
    table_row = next((row for row in tables if str(row["Name"]).strip().upper() == table), None)
    if table_row is None:
        return []

    def local_path(value: Any, suffix: str) -> Path | None:
        candidate = (base / str(value).strip().replace("\\", "/")).resolve()
        if candidate.suffix.lower() != suffix or not candidate.is_relative_to(base):
            return None
        return candidate

    data_path = local_path(table_row["Table_Relative_Path"], ".adt")
    if data_path is None or not data_path.is_file():
        return []
    files = _select_rows(connection, "SELECT Parent, Index_File_Path FROM system.indexfiles")
    registered = [
        local_path(row["Index_File_Path"], ".adi")
        for row in files if str(row["Parent"]).strip().upper() == table
    ]
    if not registered or any(path is None for path in registered):
        return []
    return [path for path in registered if path is not None and not path.exists()]


def _auto_create_enabled(connection: Any, table: str) -> bool:
    rows = _select_rows(connection, "SELECT Name, Table_Auto_Create FROM system.tables")
    row = next((entry for entry in rows if str(entry["Name"]).strip().upper() == table), None)
    if row is None:
        raise ReorganizationConflict(f"La tabla {table} ya no existe en el diccionario.")
    return str(row["Table_Auto_Create"]).strip().upper() in {"TRUE", "1", "T"}


def _modify_auto_create(connection: Any, table: str, enabled: bool) -> None:
    value = "True" if enabled else "False"
    response = connection.Execute(
        f"EXECUTE PROCEDURE sp_ModifyTableProperty('{table}', "
        f"'TABLE_AUTO_CREATE', '{value}', NULL, NULL)"
    )
    recordset = response[0] if isinstance(response, tuple) else response
    if recordset is not None and getattr(recordset, "State", 0):
        recordset.Close()


def _rebuild_missing_index_file(connection: Any, table: str) -> bool:
    """Permite a Advantage recrear un ADI faltante usando las claves del ADD.

    El cambio temporal de TABLE_AUTO_CREATE se restaura incluso si falla la
    apertura. No se mueve/copía el ADI renombrado ni se inventan expresiones.
    """
    missing = _missing_index_files(connection, table)
    if not missing:
        return False
    original = _auto_create_enabled(connection, table)
    changed = False
    try:
        if not original:
            _modify_auto_create(connection, table, True)
            changed = True
        # La apertura por una conexión nueva activa la reconstrucción desde el
        # diccionario; puede tardar más que una consulta normal.
        with ads_odbc_connection(no_table_cache=True) as reopening:
            reopening.CommandTimeout = 3600
            recordset = _open_recordset(reopening, f"SELECT TOP 1 * FROM {table}")
            recordset.Close()
        if any(not path.is_file() for path in missing):
            raise ReorganizationConflict(f"Advantage no recreó todos los índices de {table}.")
    finally:
        if changed:
            _modify_auto_create(connection, table, False)
    return True


def get_plan() -> dict[str, Any]:
    """Vista previa real; no escribe en el diccionario."""
    with ads_odbc_connection(no_table_cache=True) as connection:
        plan = _inventory(connection)
        plan["inaccesibles"] = _check_tables_openable(connection, plan)
        for failure in plan["inaccesibles"]:
            missing = _missing_index_files(connection, failure["tabla"])
            failure["reconstruible"] = bool(missing)
            failure["archivosFaltantes"] = [path.name for path in missing]
        return plan


def get_status() -> dict[str, Any] | None:
    with _lock:
        return json.loads(json.dumps(_job)) if _job else None


def _set_job(**changes: Any) -> None:
    global _job
    with _lock:
        if _job is not None:
            _job.update(changes)


def _run(plan: dict[str, Any]) -> None:
    """Ejecuta una tabla por vez; Advantage exige acceso exclusivo por tabla."""
    started = time.monotonic()
    finished: list[dict[str, Any]] = []
    try:
        with ads_odbc_connection(no_table_cache=True) as connection:
            # Una tabla con muchos movimientos puede tardar más que el límite
            # de 30 segundos que ADO aplica por defecto a cada comando.
            connection.CommandTimeout = 3600
            if _inventory(connection)["huella"] != plan["huella"]:
                raise ReorganizationConflict("Los índices cambiaron después de confirmar el plan.")
            # Los SELECT de comprobación pueden dejar cursores en caché en la
            # conexión ODBC. Se cierran antes de pedir acceso exclusivo.
            with ads_odbc_connection(no_table_cache=True) as probe:
                failures = _check_tables_openable(probe, plan)
            unrecoverable = [
                item["tabla"] for item in failures
                if not _missing_index_files(connection, item["tabla"])
            ]
            if unrecoverable:
                raise ReorganizationConflict(
                    f"No se pueden abrir ni reconstruir estas tablas: {', '.join(unrecoverable)}."
                )
            to_rebuild = {item["tabla"] for item in failures}
            # Los ADI ausentes se atienden primero: así un posible fallo de
            # reconstrucción no llega después de reindexar tablas grandes.
            ordered_tables = sorted(plan["tablas"], key=lambda item: item["tabla"] not in to_rebuild)
            for item in ordered_tables:
                table = item["tabla"]
                if not item["indices"]:
                    finished.append({"tabla": table, "estado": "Sin índices", "indices": 0})
                    _set_job(resultados=list(finished))
                    continue
                _set_job(tablaActual=table)
                table_started = time.monotonic()
                rebuilt = table in to_rebuild and _rebuild_missing_index_file(connection, table)
                # El nombre procede de la lista fija y se corroboró en
                # system.tables; no se aceptan identificadores del navegador.
                # Auto-create acaba de construir todos los índices del ADD.
                # Reindexar otra vez en el mismo instante puede devolver 7008
                # por el cursor que Advantage conserva temporalmente.
                if not rebuilt:
                    response = connection.Execute(f"EXECUTE PROCEDURE sp_Reindex('{table}', 0)")
                    recordset = response[0] if isinstance(response, tuple) else response
                    if recordset is not None and getattr(recordset, "State", 0):
                        recordset.Close()
                current = next(
                    (entry for entry in _inventory(connection)["tablas"] if entry["tabla"] == table),
                    None,
                )
                if current is None or current["indices"] != item["indices"]:
                    raise RuntimeError(f"La definición de índices de {table} cambió al reindexar.")
                finished.append({
                    "tabla": table, "estado": "Completada", "indices": len(item["indices"]),
                    "segundos": round(time.monotonic() - table_started, 2),
                    "reconstruido": rebuilt,
                })
                _set_job(resultados=list(finished))
        _set_job(
            estado="Completada", tablaActual=None, fin=_utc_now(),
            segundos=round(time.monotonic() - started, 2),
        )
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
        if "7008" in error:
            error = (
                "Advantage no pudo abrir la tabla o su índice para reindexar (7008). "
                "Verifique que ningún otro usuario o proceso mantenga abierto el archivo "
                "y revise el registro de errores de Advantage si persiste."
            )
        _set_job(
            estado="Fallida", fin=_utc_now(),
            segundos=round(time.monotonic() - started, 2),
            error=error,
        )


def start_reorganization(*, huella: str, respaldo: bool, confirmacion: str) -> dict[str, Any]:
    """Lanza el trabajo solo si el operador confirmó el plan vigente y respaldo."""
    global _job
    if not respaldo or confirmacion != "REORGANIZAR":
        raise ReorganizationValidationError("Confirme el respaldo y escriba REORGANIZAR.")
    with _lock:
        if _job and _job["estado"] == "Ejecutando":
            raise ReorganizationConflict("Ya existe una reindexación en curso.")
        # Se mantiene el bloqueo hasta registrar el proceso, evitando dos
        # solicitudes simultáneas que reindexen las mismas tablas.
        plan = get_plan()
        if plan["huella"] != huella:
            raise ReorganizationConflict("El diccionario cambió; actualice la vista previa.")
        unrecoverable = [item["tabla"] for item in plan["inaccesibles"] if not item["reconstruible"]]
        if unrecoverable:
            raise ReorganizationConflict(
                f"No se puede iniciar: Advantage no logra abrir ni reconstruir "
                f"{', '.join(unrecoverable)}. Revise los archivos."
            )
        if plan["totalIndices"] == 0:
            raise ReorganizationValidationError("El diccionario no contiene índices para reindexar.")
        _job = {
            "id": str(uuid4()), "estado": "Ejecutando", "inicio": _utc_now(),
            "fin": None, "segundos": None, "tablaActual": None,
            "totalTablas": len(plan["tablas"]), "totalIndices": plan["totalIndices"],
            "resultados": [], "error": None,
        }
        response = json.loads(json.dumps(_job))
    threading.Thread(target=_run, args=(plan,), name="ads-reindex", daemon=True).start()
    return response
