"""Escrituras contra PostgreSQL (etapa D de ``db/migration/08_plan_para_culminar.md``).

Implementa el mismo contrato JSON que la capa de Advantage para las operaciones
que **escriben**, de modo que los endpoints no cambien al alternar de motor.

**Dónde vive cada regla.** Las reglas de negocio de lotes, contabilización y
anulación están en las funciones del esquema (`validar_lote`,
`contabilizar_lote`, `anular_documento`, `regenerar_acumulados`, en
`db/postgresql/funciones.sql`). Aquí se hace la traducción de contrato (payload de
la web → filas del modelo nuevo) y se invocan esas funciones dentro de **una sola
transacción**, que es lo que sustituye al candado `accounting_write_lock` del
motor viejo: dos operaciones que tocan los mismos acumulados chocan en la fila
(`FOR UPDATE` dentro de las funciones) en vez de serializarse en el proceso.

**Diferencias de texto.** Los mensajes de error pueden diferir del legado en la
redacción exacta, pero conservan el **tipo** (que es lo que fija el código HTTP)
y el significado. Las diferencias de fondo están en
`db/migration/12_escrituras.md`.
"""

from __future__ import annotations

import json
from datetime import date
from decimal import Decimal
from typing import Any

from .ads_repository import CompanyNotFound, _text, normalize_company_code
from .postgres_repository import (
    CUENTA_SELECT,
    _compania,
    _compania_id,
    _connect,
    _cuentas_desde_filas,
)


MESES = {
    "00": "Saldos Iniciales", "01": "Enero", "02": "Febrero", "03": "Marzo",
    "04": "Abril", "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
    "13": "Ajuste 13", "14": "Ajuste 14", "15": "Ajuste 15", "16": "Ajuste 16",
    "17": "Ajuste 17", "18": "Ajuste 18",
}


def _anio_operacion(cursor: Any, compania_id: int) -> int:
    """Ejercicio activo de ``parametros_operacion`` (equivale a ``CONCTR.CTANO``)."""
    cursor.execute(
        "SELECT anio_operacion FROM parametros_operacion WHERE compania_id = %s",
        (compania_id,),
    )
    fila = cursor.fetchone()
    if fila is None or not _text(fila[0]).strip():
        raise ValueError("No existe configuración contable en CONCTR.")
    return int(float(_text(fila[0])))


def _asegurar_periodo(cursor: Any, compania_id: int, anio: int, periodo: str) -> None:
    """Garantiza que exista la fila de ``periodos_contables``.

    El cargador sólo creó los períodos que traían movimientos; el legado no tenía
    esta tabla y habilitaba los meses con ``CONCTR.CTxx``. Para poder operar un
    período nuevo, el destino tiene que tener su fila, así que se abre si falta
    (estado ``Abierto``). Decisión registrada en `db/migration/12_escrituras.md`.
    """
    cursor.execute(
        "INSERT INTO periodos_contables (compania_id, anio, periodo, nombre, estado) "
        "VALUES (%s, %s, %s, %s, 'Abierto') "
        "ON CONFLICT (compania_id, anio, periodo) DO NOTHING",
        (compania_id, anio, periodo, MESES.get(periodo, periodo)),
    )


def _usuario_id(cursor: Any, iniciales: str) -> int:
    """Resuelve las iniciales de usuario del legado a ``usuarios.id``.

    El legado guardaba iniciales en texto libre; el modelo nuevo normaliza con
    ``usuarios``. Se busca por iniciales; si no existen, se usa el primer usuario
    activo y, si no hay ninguno, se crea con el primer rol disponible.
    """
    texto = (iniciales or "").strip().upper()
    if texto:
        cursor.execute(
            "SELECT id FROM usuarios WHERE upper(iniciales) = %s "
            "AND eliminado_en IS NULL ORDER BY id LIMIT 1",
            (texto,),
        )
        fila = cursor.fetchone()
        if fila:
            return int(fila[0])
    cursor.execute(
        "SELECT id FROM usuarios WHERE activo AND eliminado_en IS NULL ORDER BY id LIMIT 1"
    )
    fila = cursor.fetchone()
    if fila:
        return int(fila[0])
    cursor.execute(
        "INSERT INTO usuarios (nombre, iniciales, rol_id, activo) "
        "VALUES (%s, %s, (SELECT id FROM roles ORDER BY id LIMIT 1), true) RETURNING id",
        (texto or "WEB", texto or None),
    )
    return int(cursor.fetchone()[0])


def _commit(connection: Any, dry_run: bool) -> None:
    """Confirma o revierte según el modo, sin ambigüedad."""
    if dry_run:
        connection.rollback()
    else:
        connection.commit()


# ---------------------------------------------------------------------------
# Terceros (etapa D)
# ---------------------------------------------------------------------------
def _compania_para_tercero(cursor: Any, cia: str, accion: str = "crear") -> int:
    """Compañía destino de un tercero nuevo.

    El legado tenía un directorio **global** (`FADCLI`), mientras el modelo nuevo
    es **por compañía** (`terceros.compania_id NOT NULL`). La ruta web no envía la
    compañía; si llega, se usa; si no, se resuelve cuando hay **una sola**
    compañía activa y, si hay más, se exige explícitamente.
    """
    if cia.strip():
        return _compania_id(cursor, _compania(cursor, cia))
    cursor.execute("SELECT id FROM companias WHERE estado = 'Activa' ORDER BY codigo")
    filas = cursor.fetchall()
    if len(filas) == 1:
        return int(filas[0][0])
    raise ValueError(f"Indique la compañía activa (cia) para {accion} el tercero.")


def create_third_party(payload: dict[str, Any], *, cia: str = "") -> dict[str, Any]:
    """Crea un tercero activo y con saldo cero, como ``GRABCLI2`` en el legado."""
    from .terceros_repository import ThirdPartyAlreadyExists, normalize_third_party

    data = normalize_third_party(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_para_tercero(cursor, cia)
            cursor.execute(
                "SELECT 1 FROM terceros WHERE compania_id = %s AND nit = %s",
                (compania_id, data["nit"]),
            )
            if cursor.fetchone() is not None:
                raise ThirdPartyAlreadyExists(f"El tercero {data['nit']} ya existe.")
            tipo = "Juridica" if data["tipoPersona"] == 2 else "Natural"
            cursor.execute(
                "INSERT INTO terceros (compania_id, nit, digito, nombre, tipo, tipo_documento, "
                "direccion, telefono, ciudad, codigo_ciudad, zona, correo, estado, saldo, cupo, "
                "nombre_comercial, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, "
                "codigo_legado, fecha_creacion) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Activo', 0, %s, "
                "%s, %s, %s, %s, %s, %s, %s) RETURNING id",
                (
                    compania_id, data["nit"], data["digito"], data["nombre"], tipo,
                    "NIT" if data["tipoDocumento"] == "31" else "CC",
                    data["direccion"], data["telefono"], data["ciudad"],
                    data["codigoCiudad"], data["zona"], data["correo"], data["cupo"],
                    data["nombreComercial"], data["primerNombre"], data["segundoNombre"],
                    data["primerApellido"], data["segundoApellido"], data["nit"], date.today(),
                ),
            )
            cursor.fetchone()
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "nit": data["nit"],
        "digito": data["digito"],
        "nombre": data["nombre"],
        "tipo": "Jurídica" if data["tipoPersona"] == 2 else "Natural",
        "tipoDoc": data["tipoDocumento"],
        "direccion": data["direccion"],
        "telefono": data["telefono"],
        "ciudad": data["ciudad"],
        "estado": "Activo",
        "motivoBloqueo": None,
        "saldo": 0.0,
        "cupo": data["cupo"],
        "fechaCreacion": date.today().isoformat(),
    }


# ---------------------------------------------------------------------------
# Terceros: modificación, baja, cupo e importación (etapa B1)
# ---------------------------------------------------------------------------
# Columna del destino para cada campo del contrato de escritura. Los campos que
# no aparezcan aquí viajan al jsonb `legado` (ver `_tercero_legado_extra`).
_TERCERO_COLUMNAS = {
    "digito": "digito",
    "tipoDocumento": "tipo_documento",
    "nombre": "nombre",
    "nombreComercial": "nombre_comercial",
    "primerNombre": "primer_nombre",
    "segundoNombre": "segundo_nombre",
    "primerApellido": "primer_apellido",
    "segundoApellido": "segundo_apellido",
    "direccion": "direccion",
    "codigoCiudad": "codigo_ciudad",
    "ciudad": "ciudad",
    "telefono": "telefono",
    "correo": "correo",
    "zona": "zona",
    "cupo": "cupo",
    "estado": "estado",
    "motivoBloqueo": "motivo_bloqueo",
}

# El contrato del directorio usa las mismas claves que `FADCLI` para que el JSON
# no dependa del motor (R1): el mapeador de la API es `_third_party_from_row`.
_TERCERO_CONTRATO_SELECT = (
    'SELECT codigo_legado AS "CCODIGO", digito AS "CDIGITO", '
    'CASE WHEN tipo = \'Juridica\' THEN 2 ELSE 1 END AS "CTIPOCLI", '
    'tipo_documento AS "CTIPDOC", nombre AS "CNOMBRE", direccion AS "CDIREC", '
    'telefono AS "CTELEF", ciudad AS "CCIUDAD", '
    'CASE WHEN estado = \'Activo\' THEN 1 ELSE 0 END AS "CESTADO", '
    'motivo_bloqueo AS "CMOTIVO", saldo AS "CSALDO", cupo AS "CCUPO", '
    'correo AS "CEMAIL", zona AS "CZONA", '
    'to_char(fecha_creacion, \'YYYYMMDD\')::int AS "CFCHCREA" '
    "FROM terceros WHERE compania_id = %s AND nit = %s AND eliminado_en IS NULL"
)


def _tercero_contrato(cursor: Any, compania_id: int, nit: str) -> dict[str, Any]:
    """Elemento de la ficha del tercero o ``ThirdPartyNotFound`` si no existe."""
    from .terceros_repository import ThirdPartyNotFound, _third_party_detail

    cursor.execute(_TERCERO_CONTRATO_SELECT, (compania_id, nit))
    fila = cursor.fetchone()
    if fila is None:
        raise ThirdPartyNotFound(f"No existe el tercero {nit}.")
    columnas = [descripcion.name for descripcion in cursor.description]
    return _third_party_detail(dict(zip(columnas, fila)))


def _tercero_id_y_saldo(cursor: Any, compania_id: int, nit: str) -> tuple[int, float]:
    """Identidad interna y saldo de un tercero vivo de la compañía."""
    from .terceros_repository import ThirdPartyNotFound

    cursor.execute(
        "SELECT id, saldo FROM terceros WHERE compania_id = %s AND nit = %s "
        "AND eliminado_en IS NULL",
        (compania_id, nit),
    )
    fila = cursor.fetchone()
    if fila is None:
        raise ThirdPartyNotFound(f"No existe el tercero {nit}.")
    return int(fila[0]), float(fila[1])


def _tercero_movimientos(cursor: Any, compania_id: int, tercero_id: int) -> int:
    """Partidas del tercero en el libro y en los lotes de la compañía."""
    cursor.execute(
        "SELECT (SELECT count(*) FROM documento_lineas WHERE compania_id = %s AND tercero_id = %s) "
        "+ (SELECT count(*) FROM lote_lineas WHERE compania_id = %s AND tercero_id = %s)",
        (compania_id, tercero_id, compania_id, tercero_id),
    )
    return int(cursor.fetchone()[0])


def _auditar(
    cursor: Any,
    compania_id: int | None,
    usuario_id: int,
    accion: str,
    modulo: str,
    detalle: str,
    motivo: str = "",
    parametros: dict[str, Any] | None = None,
) -> None:
    """Inserta la fila de bitácora de una acción de negocio sobre maestros.

    El disparador `trg_terceros_auditoria` deja `actualizado_en` y `version`; el
    motivo de una operación destructiva lo registra la acción, como pide R8.
    `anio` queda nulo: la ficha del tercero no pertenece a un ejercicio.
    """
    cursor.execute(
        "INSERT INTO auditoria (compania_id, usuario_id, accion, modulo, detalle, motivo, "
        "parametros, resultado) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, 'EXITO')",
        (
            compania_id, usuario_id, accion, modulo, detalle,
            motivo.strip() or None, json.dumps(parametros or {}),
        ),
    )


def _tercero_legado_extra(payload: dict[str, Any]) -> dict[str, Any]:
    """Campos del contrato de escritura que no tienen columna propia.

    Hoy todos los campos de `ThirdPartyWrite` tienen columna en `terceros`, así
    que el diccionario sale vacío. La regla queda escrita para que un campo nuevo
    del contrato caiga en el jsonb `legado` en vez de perderse (03_maestros.sql).
    """
    return {
        campo: valor
        for campo, valor in payload.items()
        if campo not in _TERCERO_COLUMNAS and valor not in ("", None)
    }


def _actualizar_tercero(
    cursor: Any, tercero_id: int, data: dict[str, Any], estado: str, motivo: str,
    payload: dict[str, Any],
) -> None:
    """Aplica los campos del contrato de escritura a la fila del tercero."""
    valores: dict[str, Any] = {
        "digito": data["digito"],
        "tipo_documento": "NIT" if data["tipoDocumento"] == "31" else "CC",
        "nombre": data["nombre"],
        "tipo": "Juridica" if data["tipoPersona"] == 2 else "Natural",
        "nombre_comercial": data["nombreComercial"],
        "primer_nombre": data["primerNombre"],
        "segundo_nombre": data["segundoNombre"],
        "primer_apellido": data["primerApellido"],
        "segundo_apellido": data["segundoApellido"],
        "direccion": data["direccion"],
        "codigo_ciudad": data["codigoCiudad"],
        "ciudad": data["ciudad"],
        "telefono": data["telefono"],
        "correo": data["correo"],
        "zona": data["zona"],
        "cupo": data["cupo"],
        "estado": estado,
        # `Activo` limpia la causa de un bloqueo anterior (ver B1.1).
        "motivo_bloqueo": motivo or None,
    }
    asignaciones = ", ".join(f"{columna} = %s" for columna in valores)
    parametros: list[Any] = list(valores.values())
    extra = _tercero_legado_extra(payload)
    if extra:
        # Se **fusiona** con el jsonb existente: `legado` conserva los campos
        # crudos del origen y no puede perderlos al editar la ficha.
        asignaciones += ", legado = coalesce(legado, '{}'::jsonb) || %s::jsonb"
        parametros.append(json.dumps(extra))
    cursor.execute(
        f"UPDATE terceros SET {asignaciones} WHERE id = %s", [*parametros, tercero_id]
    )


def _insertar_tercero(cursor: Any, compania_id: int, data: dict[str, Any]) -> None:
    """Inserta una ficha completa: es la base de la importación masiva."""
    cursor.execute(
        "INSERT INTO terceros (compania_id, nit, digito, nombre, tipo, tipo_documento, "
        "direccion, telefono, ciudad, codigo_ciudad, zona, correo, estado, motivo_bloqueo, "
        "saldo, cupo, nombre_comercial, primer_nombre, segundo_nombre, primer_apellido, "
        "segundo_apellido, codigo_legado, fecha_creacion) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0, %s, %s, %s, %s, %s, %s, %s, %s)",
        (
            compania_id, data["nit"], data["digito"], data["nombre"],
            "Juridica" if data["tipoPersona"] == 2 else "Natural",
            "NIT" if data["tipoDocumento"] == "31" else "CC",
            data["direccion"], data["telefono"], data["ciudad"], data["codigoCiudad"],
            data["zona"], data["correo"], data["estado"], data["motivoBloqueo"] or None,
            data["cupo"], data["nombreComercial"], data["primerNombre"], data["segundoNombre"],
            data["primerApellido"], data["segundoApellido"], data["nit"], date.today(),
        ),
    )


def update_third_party(
    nit: str, payload: dict[str, Any], *, cia: str = "", user: str = "WEB"
) -> dict[str, Any]:
    """Modifica la ficha del tercero conservando su clave (B1.1).

    El NIT es inmutable: llega por la ruta y no por el cuerpo. `digito` se
    recalcula con `normalize_third_party`, igual que en el alta.
    """
    from .terceros_repository import _party_code, _party_state_and_reason, normalize_third_party

    code = _party_code(nit)
    data = normalize_third_party({**payload, "nit": code})
    estado, motivo = _party_state_and_reason(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_para_tercero(cursor, cia, "modificar")
            tercero_id, _ = _tercero_id_y_saldo(cursor, compania_id, code)
            _actualizar_tercero(cursor, tercero_id, data, estado, motivo, payload)
            contrato = _tercero_contrato(cursor, compania_id, code)
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return contrato


def delete_third_party(
    nit: str, *, reason: str, user: str = "WEB", cia: str = "", dry_run: bool = False
) -> dict[str, Any]:
    """Baja lógica del tercero: marca `eliminado_en` si no tiene historia (B1.2).

    Se rechaza con 409 cuando el tercero tiene partidas en `documento_lineas` o
    `lote_lineas`, o saldo distinto de cero: el libro no puede perder la
    referencia, y el camino en ese caso es bloquear con B1.1.
    """
    from .terceros_repository import ThirdPartyConflict, ThirdPartyValidationError, _party_code

    code = _party_code(nit)
    motivo = str(reason or "").strip()
    if not 5 <= len(motivo) <= 180:
        raise ThirdPartyValidationError("Indique un motivo de baja entre 5 y 180 caracteres.")
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_para_tercero(cursor, cia, "retirar")
            tercero_id, saldo = _tercero_id_y_saldo(cursor, compania_id, code)
            movimientos = _tercero_movimientos(cursor, compania_id, tercero_id)
            if movimientos or round(saldo, 2) != 0:
                raise ThirdPartyConflict(
                    f"El tercero {code} tiene {movimientos} movimiento(s) y saldo {saldo:.2f}; "
                    "no se puede retirar del directorio. Bloquéelo en su lugar."
                )
            if not dry_run:
                cursor.execute(
                    "UPDATE terceros SET eliminado_en = now() WHERE id = %s", (tercero_id,)
                )
                _auditar(
                    cursor, compania_id, _usuario_id(cursor, user),
                    "Baja de tercero", "Terceros", code, motivo,
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "nit": code,
        "eliminado": not dry_run,
        "movimientos": movimientos,
        "saldo": round(saldo, 2),
    }


def update_third_party_credit_limit(
    nit: str, payload: dict[str, Any], *, cia: str = "", user: str = "WEB"
) -> dict[str, Any]:
    """Fija el cupo de cartera sin tocar el resto de la ficha (B1.3).

    El cupo no se puede reducir por debajo del saldo: es la regla de crédito que
    la ventana de cupos ya insinúa al mostrar saldo y cupo juntos.
    """
    from .terceros_repository import (
        ThirdPartyConflict, ThirdPartyValidationError, _credit_limit, _party_code,
    )

    code = _party_code(nit)
    cupo = _credit_limit(payload)
    motivo = str(payload.get("motivo") or "").strip()
    if len(motivo) > 180:
        raise ThirdPartyValidationError("El motivo admite máximo 180 caracteres.")
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_para_tercero(cursor, cia, "modificar")
            tercero_id, saldo = _tercero_id_y_saldo(cursor, compania_id, code)
            if cupo < saldo:
                raise ThirdPartyConflict(
                    f"El cupo {cupo:.2f} no puede ser menor que el saldo {saldo:.2f} "
                    f"del tercero {code}."
                )
            cursor.execute("UPDATE terceros SET cupo = %s WHERE id = %s", (cupo, tercero_id))
            _auditar(
                cursor, compania_id, _usuario_id(cursor, user),
                "Cambio de cupo de tercero", "Terceros", f"{code}: cupo {cupo:.2f}", motivo,
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {"nit": code, "cupo": cupo, "saldo": round(saldo, 2)}


def import_third_parties(
    payload: dict[str, Any], *, cia: str = "", user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Alta masiva desde filas ya leídas y mapeadas (B1.4).

    La fila que falla no detiene el lote: se rechaza con su causa y su número de
    fila. No hace `upsert` silencioso: el NIT repetido en el archivo o ya
    existente se rechaza. Todo el lote viaja en una sola transacción.
    """
    from .terceros_repository import (
        ThirdPartyValidationError, prepare_import_rows, validate_import_mapping,
    )

    archivo = str(payload.get("archivo") or "").strip()
    if not archivo:
        raise ThirdPartyValidationError("Indique el nombre del archivo importado.")
    mapeo = payload.get("mapeo") or {}
    validate_import_mapping(mapeo)
    validas, errores = prepare_import_rows(payload.get("filas") or [])
    creados = 0
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_para_tercero(cursor, cia, "importar")
            for fila_numero, data in validas:
                cursor.execute(
                    "SELECT 1 FROM terceros WHERE compania_id = %s AND nit = %s",
                    (compania_id, data["nit"]),
                )
                if cursor.fetchone() is not None:
                    errores.append(
                        {"fila": fila_numero, "detalle": f"NIT duplicado {data['nit']}"}
                    )
                    continue
                _insertar_tercero(cursor, compania_id, data)
                creados += 1
            errores.sort(key=lambda error: error["fila"])
            if not dry_run:
                _auditar(
                    cursor, compania_id, _usuario_id(cursor, user),
                    "Importación de terceros", "Terceros",
                    f"{archivo}: {creados} creados, {len(errores)} rechazados", "",
                    {"archivo": archivo, "hoja": payload.get("hoja", ""), "mapeo": mapeo},
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {"creados": creados, "rechazados": len(errores), "errores": errores}


# ---------------------------------------------------------------------------
# Catálogos compartidos: centros, comprobantes y tipos de documento (etapa B2)
# ---------------------------------------------------------------------------
def _centro_padre(cursor: Any, compania_id: int, codigo: str) -> tuple[int, int]:
    """Identidad y nivel del centro padre, o ``CostCenterValidationError`` (422)."""
    from .centros_repository import CostCenterValidationError

    cursor.execute(
        "SELECT id, nivel FROM centros_costos "
        "WHERE compania_id = %s AND codigo = %s AND eliminado_en IS NULL",
        (compania_id, codigo),
    )
    fila = cursor.fetchone()
    if fila is None:
        raise CostCenterValidationError(f"No existe el centro padre {codigo}.")
    return int(fila[0]), int(fila[1])


def _sin_ciclos(cursor: Any, compania_id: int, parent_id: int, codigo: str) -> None:
    """Sube por ``parent_id`` y rechaza una jerarquía de centros circular."""
    from .centros_repository import CostCenterValidationError

    vistos = {int(parent_id)}
    actual: int | None = int(parent_id)
    while actual is not None:
        cursor.execute(
            "SELECT codigo, parent_id FROM centros_costos WHERE id = %s AND compania_id = %s",
            (actual, compania_id),
        )
        fila = cursor.fetchone()
        if fila is None:
            break
        if _text(fila[0]) == codigo:
            raise CostCenterValidationError(
                "La jerarquía de centros de costo no puede tener ciclos."
            )
        siguiente = fila[1]
        if siguiente is None:
            break
        siguiente = int(siguiente)
        if siguiente in vistos:
            raise CostCenterValidationError(
                "La jerarquía de centros de costo no puede tener ciclos."
            )
        vistos.add(siguiente)
        actual = siguiente


def _cuenta_id(cursor: Any, compania_id: int, codigo: str) -> int:
    """Identidad de la cuenta del plan, o ``CostCenterValidationError`` (422)."""
    from .centros_repository import CostCenterValidationError

    cursor.execute(
        "SELECT id FROM cuentas WHERE compania_id = %s AND codigo = %s",
        (compania_id, codigo),
    )
    fila = cursor.fetchone()
    if fila is None:
        raise CostCenterValidationError(
            f"No existe la cuenta {codigo} en el plan de la compañía."
        )
    return int(fila[0])


def create_cost_center(
    company_code: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un centro de costo de la compañía (B2.1) en ``centros_costos``."""
    from .centros_repository import (
        CostCenterAlreadyExists, cost_center_item, normalize_cost_center,
    )

    data = normalize_cost_center(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT 1 FROM centros_costos WHERE compania_id = %s AND codigo = %s "
                "AND eliminado_en IS NULL",
                (compania_id, data["codigo"]),
            )
            if cursor.fetchone() is not None:
                raise CostCenterAlreadyExists(
                    f"Ya existe el centro {data['codigo']} en la compañía {company_code}."
                )
            parent_id: int | None = None
            nivel = 1
            if data["centroPadre"]:
                parent_id, nivel_padre = _centro_padre(cursor, compania_id, data["centroPadre"])
                _sin_ciclos(cursor, compania_id, parent_id, data["codigo"])
                nivel = nivel_padre + 1
            cuenta_id = None
            if data["cuenta"]:
                cuenta_id = _cuenta_id(cursor, compania_id, data["cuenta"])
            cursor.execute(
                "INSERT INTO centros_costos (compania_id, codigo, nombre, nivel, parent_id, "
                "hist, tipo, valor, porcentaje, codigo_item, cuenta_id, concepto) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    compania_id, data["codigo"], data["nombre"], nivel, parent_id,
                    data["hist"] or None, data["tipo"], data["valor"], data["porcentaje"],
                    data["codigoItem"] or None, cuenta_id, data["concepto"] or None,
                ),
            )
            _auditar(
                cursor, compania_id, _usuario_id(cursor, user),
                "Alta de centro de costo", "Centros", data["codigo"], "",
                {"centroPadre": data["centroPadre"], "cuenta": data["cuenta"]},
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return cost_center_item(data, data["centroPadre"])


def create_voucher(
    company_code: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un comprobante de la compañía (B2.2) en ``comprobantes``.

    No crea ``consecutivos_comprobantes``: lo inicializa la primera
    contabilización, como en el legado.
    """
    from .comprobantes_repository import VoucherAlreadyExists, normalize_voucher, voucher_item

    data = normalize_voucher(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT 1 FROM comprobantes WHERE compania_id = %s AND codigo = %s "
                "AND eliminado_en IS NULL",
                (compania_id, data["codigo"]),
            )
            if cursor.fetchone() is not None:
                raise VoucherAlreadyExists(
                    f"Ya existe el comprobante {data['codigo']} en la compañía {company_code}."
                )
            cursor.execute(
                "INSERT INTO comprobantes (compania_id, codigo, nombre, descripcion_auxiliar) "
                "VALUES (%s, %s, %s, %s)",
                (
                    compania_id, data["codigo"], data["nombre"],
                    data["descripcionAuxiliar"] or None,
                ),
            )
            _auditar(
                cursor, compania_id, _usuario_id(cursor, user),
                "Alta de comprobante", "Comprobantes", data["codigo"], "",
                {"nombre": data["nombre"]},
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return voucher_item(data)


def create_document_type(
    company_code: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un tipo de documento de la compañía (B2.3) en ``tipos_documento``.

    En el modelo nuevo el catálogo es por compañía (el legado ``VISDOCUM`` era
    global); la ruta declara esa diferencia con ``sharedAcrossCompanies``.
    """
    from .tipos_documento_repository import (
        DocumentTypeAlreadyExists, DocumentTypeValidationError,
        document_type_item, normalize_document_type,
    )

    data = normalize_document_type(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT 1 FROM tipos_documento WHERE compania_id = %s AND codigo = %s "
                "AND eliminado_en IS NULL",
                (compania_id, data["codigo"]),
            )
            if cursor.fetchone() is not None:
                raise DocumentTypeAlreadyExists(
                    f"Ya existe el tipo de documento {data['codigo']} en la compañía {company_code}."
                )
            comprobante_id = None
            if data["comprobante"]:
                cursor.execute(
                    "SELECT id FROM comprobantes WHERE compania_id = %s AND codigo = %s "
                    "AND eliminado_en IS NULL",
                    (compania_id, data["comprobante"]),
                )
                fila = cursor.fetchone()
                if fila is None:
                    raise DocumentTypeValidationError(
                        f"No existe el comprobante {data['comprobante']} en la compañía."
                    )
                comprobante_id = int(fila[0])
            cursor.execute(
                "INSERT INTO tipos_documento (compania_id, codigo, nombre, numeracion, "
                "tercero_obligatorio, centro_obligatorio, modulo, naturaleza, prefijo, "
                "comprobante_id, genera_contabilizacion, permite_conversion, conversion_codigo) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    compania_id, data["codigo"], data["nombre"], data["numeracion"],
                    data["terceroObligatorio"], data["centroObligatorio"], data["modulo"],
                    data["naturaleza"] or None, data["prefijo"] or None, comprobante_id,
                    data["generaContabilizacion"], data["permiteConversion"],
                    data["conversionCodigo"] or None,
                ),
            )
            _auditar(
                cursor, compania_id, _usuario_id(cursor, user),
                "Alta de tipo de documento", "Tipos de documento", data["codigo"], "",
                {"numeracion": data["numeracion"], "comprobante": data["comprobante"]},
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return document_type_item(data)


# ---------------------------------------------------------------------------
# Plan de cuentas (etapa D)
# ---------------------------------------------------------------------------
# Clasificación fiscal del legado (`MIVA_RET`) → columnas del destino.
_CLASE_IVA_FISCAL = "Generado"
_CLASE_RETENCION_FISCAL = {"R": "Renta", "V": "IVA", "C": "ICA"}


def _get_cuenta(cursor: Any, compania_id: int, codigo: str) -> dict[str, Any]:
    """Contrato de una sola cuenta, con sus acumulados (mismo que el listado)."""
    from .ads_repository import AccountNotFound

    cursor.execute(CUENTA_SELECT + " AND cu.codigo = %s", (compania_id, codigo))
    cuentas = _cuentas_desde_filas(cursor.fetchall())
    if not cuentas:
        raise AccountNotFound(f"No existe la cuenta {codigo}.")
    return cuentas[0]


def create_account(company_code: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Crea una cuenta maestra después de validar duplicado y jerarquía.

    Espeja ``ads_repository.create_account``: no toca saldos (la cuenta nace en
    cero) y exige que exista la cuenta padre del nivel anterior.
    """
    from .ads_repository import AccountAlreadyExists, normalize_account, parent_code

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            data = normalize_account(payload, include_code=True)
            code = data["codigo"]
            cursor.execute(
                "SELECT 1 FROM cuentas WHERE compania_id = %s AND codigo = %s",
                (compania_id, code),
            )
            if cursor.fetchone() is not None:
                raise AccountAlreadyExists(f"Ya existe la cuenta {code}.")

            padre = parent_code(code)
            padre_id = None
            if padre is not None:
                cursor.execute(
                    "SELECT id FROM cuentas WHERE compania_id = %s AND codigo = %s",
                    (compania_id, padre),
                )
                fila = cursor.fetchone()
                if fila is None:
                    raise ValueError(f"Primero debe existir la cuenta padre {padre}.")
                padre_id = int(fila[0])

            # `path` encadena los ancestros **existentes** y el código nuevo, igual
            # que el cargador; así una cuenta creada en caliente queda ordenada como
            # las migradas.
            ancestros = []
            for largo in (1, 2, 4, 6, 9, 12):
                if largo >= len(code):
                    break
                cursor.execute(
                    "SELECT 1 FROM cuentas WHERE compania_id = %s AND codigo = %s",
                    (compania_id, code[:largo]),
                )
                if cursor.fetchone() is not None:
                    ancestros.append(code[:largo])

            cursor.execute(
                "INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, "
                "controla_tercero, controla_centro, ajuste, clase_iva, clase_retencion, "
                "parent_id, path) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    compania_id, code, data["nombre"], len(code), data["afectable"],
                    data["requiereTercero"], data["requiereCentro"], data["ajuste"],
                    _CLASE_IVA_FISCAL if data["tipoFiscal"] == "I" else None,
                    _CLASE_RETENCION_FISCAL.get(data["tipoFiscal"]),
                    padre_id, "/" + "/".join([*ancestros, code]),
                ),
            )
            contrato = _get_cuenta(cursor, compania_id, code)
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return contrato


def update_account(company_code: str, code: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Modifica controles de una cuenta sin alterar código, saldos ni acumulados."""
    from .ads_repository import AccountNotFound, normalize_account

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            data = normalize_account(payload, include_code=False)
            cursor.execute(
                "SELECT id FROM cuentas WHERE compania_id = %s AND codigo = %s",
                (compania_id, code),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise AccountNotFound(f"No existe la cuenta {code}.")
            cursor.execute(
                "UPDATE cuentas SET nombre = %s, afectable = %s, controla_tercero = %s, "
                "controla_centro = %s, ajuste = %s, clase_iva = %s, clase_retencion = %s "
                "WHERE id = %s",
                (
                    data["nombre"], data["afectable"], data["requiereTercero"],
                    data["requiereCentro"], data["ajuste"],
                    _CLASE_IVA_FISCAL if data["tipoFiscal"] == "I" else None,
                    _CLASE_RETENCION_FISCAL.get(data["tipoFiscal"]), int(fila[0]),
                ),
            )
            contrato = _get_cuenta(cursor, compania_id, code)
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return contrato


# ---------------------------------------------------------------------------
# Parámetros de operación (etapa D)
# ---------------------------------------------------------------------------
def update_operation_parameters(cia: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Graba en ``parametros_operacion`` los mismos controles de ``DSIGRABA6``."""
    from .parametros_operacion_repository import (
        OperationParametersValidationError,
        _normalize,
    )
    from .postgres_repository import get_operation_parameters

    data = _normalize(payload)
    # Las claves del jsonb son los códigos de período sin prefijo (`00`..`12`): son
    # las que lee `PERIODOS_ALIASES` al reconstruir `CT00`..`CT12` para el mapeador.
    periodos = {code: bool(value) for code, value in data["periodosHabilitados"].items()}
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, cia)
            cursor.execute(
                "SELECT count(*) FROM parametros_operacion p JOIN companias co ON co.id = p.compania_id "
                "WHERE co.codigo = %s",
                (codigo,),
            )
            if int(cursor.fetchone()[0]) != 1:
                raise OperationParametersValidationError(
                    "CONCTR debe contener exactamente un registro para modificar sus parámetros."
                )
            cursor.execute(
                "UPDATE parametros_operacion p SET nombre_empresa = %s, nit = %s, direccion = %s, "
                "ciudad = %s, directorio_contabilidad = %s, anio_operacion = %s, "
                "contabilidad_conciliacion = %s, verifica_documentos_lotes = %s, "
                "terceros_documentos_propios = %s, controla_usuario_lotes = %s, "
                "comentario_certificado = %s, periodos_habilitados = %s::jsonb "
                "WHERE p.compania_id = (SELECT id FROM companias WHERE codigo = %s)",
                (
                    data["nombreEmpresa"], data["nit"], data["direccion"], data["ciudad"],
                    data["directorioContabilidad"], str(data["anioOperacion"]),
                    data["contabilidadConciliacion"], data["verificaDocumentosLotes"],
                    data["tercerosDocumentosPropios"], data["controlaUsuarioLotes"],
                    data["comentarioCertificado"], json.dumps(periodos), codigo,
                ),
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return get_operation_parameters(cia)


# ---------------------------------------------------------------------------
# Anulación de documentos (etapa D)
# ---------------------------------------------------------------------------
def annul_document(
    cia: str,
    *,
    header_id: int,
    document: str,
    voucher: str,
    document_type: str,
    movement_date: str,
    user: str,
    reason: str,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Anula un documento creando su reversión, vía ``anular_documento``.

    A diferencia del legado —que **borraba** cabecera y partidas— el modelo nuevo
    conserva el original (estado ``Anulado``) y crea el documento de reversión,
    de modo que la pista de auditoría no se pierde. Los acumulados fiscales se
    recalculan con ``regenerar_acumulados``, como hacía el motor viejo con
    ``CONMAE``/``CONTERCE``/``COCENTRO``.
    """
    from .anulacion_repository import AnnulmentConflict, AnnulmentValidationError

    documento = document.strip()
    comprobante = voucher.strip()
    tipo = document_type.strip()
    if not documento or len(documento) > 12:
        raise AnnulmentValidationError("El numero de documento no es valido.")
    if not comprobante or len(comprobante) > 6:
        raise AnnulmentValidationError("El comprobante no es valido.")
    if not tipo or len(tipo) > 2:
        raise AnnulmentValidationError("El tipo de documento no es valido.")
    try:
        fecha = date.fromisoformat(movement_date.strip())
    except ValueError as exc:
        raise AnnulmentValidationError("La fecha del documento no es valida.") from exc
    motivo = reason.strip()
    if not 5 <= len(motivo) <= 180:
        raise AnnulmentValidationError("Indique un motivo de anulacion entre 5 y 180 caracteres.")
    usuario = user.strip().upper()[:4] or "WEB"

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, cia)
            compania_id = _compania_id(cursor, codigo)
            cursor.execute(
                "SELECT d.id, d.periodo, d.estado, d.comprobante_id, "
                "coalesce(sum(l.debito), 0) AS debito, coalesce(sum(l.credito), 0) AS credito, "
                "count(l.id) AS partidas, count(DISTINCT l.cuenta_id) AS cuentas, "
                "count(DISTINCT l.tercero_id) AS terceros, count(DISTINCT l.centro_costo_id) AS centros "
                "FROM documentos d "
                "LEFT JOIN documento_lineas l ON l.documento_id = d.id "
                "WHERE d.id = %s AND d.compania_id = %s "
                "GROUP BY d.id, d.periodo, d.estado, d.comprobante_id",
                (header_id, compania_id),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise AnnulmentConflict("El documento ya no existe o fue modificado.")
            doc_id, periodo, estado, comprobante_id, debito, credito, partidas, cuentas, terceros, centros = fila
            if int(partidas) == 0:
                raise AnnulmentConflict("El documento no tiene partidas para anular.")
            if abs(float(debito) - float(credito)) > 0.01:
                raise AnnulmentConflict(
                    "El documento esta descuadrado y no puede anularse automaticamente."
                )
            if str(estado) == "Anulado":
                raise AnnulmentConflict("El documento ya esta anulado.")

            cursor.execute(
                "SELECT estado FROM periodos_contables WHERE compania_id = %s AND anio = %s AND periodo = %s",
                (compania_id, fecha.year, periodo),
            )
            control = cursor.fetchone()
            if control is not None and str(control[0]) == "Cerrado":
                raise AnnulmentValidationError("El periodo del documento esta cerrado.")

            usuario_id = _usuario_id(cursor, usuario)
            cursor.execute(
                "SELECT anular_documento(%s, %s, %s, %s, %s, %s, %s)",
                (doc_id, usuario_id, motivo, "", comprobante_id, fecha, periodo),
            )
            cursor.fetchone()
            for tipo_acumulado in ("Terceros", "Centros", "Retencion", "Iva"):
                cursor.execute(
                    "SELECT regenerar_acumulados(%s, %s, %s)",
                    (compania_id, fecha.year, tipo_acumulado),
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "documento": documento,
        "partidasRetiradas": int(partidas),
        "totalDebito": round(float(debito), 2),
        "totalCredito": round(abs(float(credito)), 2),
        "cuentasRecalculadas": int(cuentas),
        "tercerosRecalculados": int(terceros),
        "centrosRecalculados": int(centros),
        "dryRun": dry_run,
        "advertencia": "",
    }


# ---------------------------------------------------------------------------
# Lotes (etapa D)
#
# Las reglas viven en `validar_lote` y `contabilizar_lote` (funciones.sql):
# validación por documento, periodo cerrado, idempotencia y avance de
# consecutivos. Aquí se mantiene la cabecera (`lotes`), las partidas
# (`lote_lineas`) y la traducción del contrato.
# ---------------------------------------------------------------------------
def _lote_editable(cursor: Any, compania_id: int, codigo: str) -> dict[str, Any]:
    """Cabecera editable del lote, con los mensajes del motor viejo.

    El legado nunca permitía tocar un lote contabilizado, anulado o histórico;
    en el modelo nuevo ese estado vive en `lotes.estado`, así que se rechazan
    `Contabilizado` y `Anulado` (no hay columna histórica separada).
    """
    from .lotes_repository import LotConflict, LotValidationError

    cursor.execute(
        "SELECT id, codigo, nombre, periodo, estado, anio FROM lotes "
        "WHERE compania_id = %s AND codigo = %s FOR UPDATE",
        (compania_id, codigo),
    )
    fila = cursor.fetchone()
    if fila is None:
        raise LotConflict(f"El lote {codigo} no existe para la compañía activa.")
    if str(fila[4]) in ("Contabilizado", "Anulado"):
        raise LotValidationError(
            "El lote está contabilizado, anulado o histórico y no se puede modificar."
        )
    return {
        "id": int(fila[0]), "codigo": fila[1], "nombre": fila[2],
        "periodo": fila[3], "estado": fila[4], "anio": int(fila[5]),
    }


def _ids_de_maestros(cursor: Any, compania_id: int, data: dict[str, Any]) -> dict[str, Any]:
    """Resuelve y valida los maestros de una partida (equivalente a ``_validate_line_masters``)."""
    from .lotes_repository import LotValidationError

    cursor.execute(
        "SELECT id, afectable, controla_tercero, controla_centro, controla_base, clase_iva, clase_retencion "
        "FROM cuentas WHERE compania_id = %s AND codigo = %s",
        (compania_id, data["cuenta"]),
    )
    cuenta = cursor.fetchone()
    if cuenta is None:
        raise LotValidationError("La cuenta no existe para la compañía activa.")
    cuenta_id, afectable, controla_tercero, controla_centro, controla_base, clase_iva, clase_ret = cuenta
    if not afectable:
        raise LotValidationError("La cuenta no permite movimiento contable.")

    requiere_tercero = bool(controla_tercero) or bool(clase_iva) or bool(clase_ret)
    if requiere_tercero and not data["nit"]:
        raise LotValidationError("La cuenta seleccionada requiere tercero.")
    if not requiere_tercero and data["nit"]:
        raise LotValidationError("La cuenta seleccionada no maneja tercero.")
    if requiere_tercero and len(data["nit"]) > 11:
        raise LotValidationError("El NIT admite máximo 11 caracteres en CONLOTES.")

    tercero_id = None
    if data["nit"]:
        cursor.execute(
            "SELECT id FROM terceros WHERE compania_id = %s AND (codigo_legado = %s OR nit = %s) LIMIT 1",
            (compania_id, data["nit"], data["nit"]),
        )
        fila = cursor.fetchone()
        if fila is None:
            raise LotValidationError("El tercero no existe en FADCLI.")
        tercero_id = int(fila[0])

    if bool(controla_centro) and not data["centro"]:
        raise LotValidationError("La cuenta seleccionada requiere centro de costo.")
    if not bool(controla_centro) and data["centro"]:
        raise LotValidationError("La cuenta seleccionada no maneja centro de costo.")
    centro_id = None
    if data["centro"]:
        cursor.execute(
            "SELECT id FROM centros_costos WHERE compania_id = %s AND codigo = %s",
            (compania_id, data["centro"]),
        )
        fila = cursor.fetchone()
        if fila is None:
            raise LotValidationError("El centro de costo no existe para la compañía activa.")
        centro_id = int(fila[0])

    if not data["comprobante"] or len(data["comprobante"]) > 2:
        raise LotValidationError("El comprobante es obligatorio y admite máximo 2 caracteres.")
    cursor.execute(
        "SELECT 1 FROM comprobantes WHERE compania_id = %s AND codigo = %s",
        (compania_id, data["comprobante"]),
    )
    if cursor.fetchone() is None:
        raise LotValidationError("El comprobante no existe para la compañía activa.")

    if not data["tipoDocumento"] or len(data["tipoDocumento"]) > 2:
        raise LotValidationError("El tipo de documento es obligatorio y admite máximo 2 caracteres.")
    cursor.execute(
        "SELECT id FROM tipos_documento WHERE compania_id = %s AND codigo = %s",
        (compania_id, data["tipoDocumento"]),
    )
    fila = cursor.fetchone()
    if fila is None:
        raise LotValidationError("El tipo de documento no existe en VISDOCUM.")
    tipo_documento_id = int(fila[0])

    if (bool(controla_base) or bool(clase_iva) or bool(clase_ret)) and data["base"] <= 0:
        raise LotValidationError("La cuenta de IVA o retención requiere una base.")

    return {
        "cuenta_id": int(cuenta_id),
        "tercero_id": tercero_id,
        "centro_costo_id": centro_id,
        "tipo_documento_id": tipo_documento_id,
    }


def _insertar_linea(
    cursor: Any, lote_id: int, compania_id: int, numero_linea: int, data: dict[str, Any], ids: dict[str, Any]
) -> int:
    cursor.execute(
        "INSERT INTO lote_lineas (lote_id, compania_id, numero_linea, cuenta_id, tercero_id, "
        "centro_costo_id, tipo_documento_id, comprobante, documento, fecha, fecha_documento, "
        "debito, credito, base, clase, documento_afectado, concepto, nit_alterno, origen) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Manual') "
        "RETURNING id",
        (
            lote_id, compania_id, numero_linea, ids["cuenta_id"], ids["tercero_id"],
            ids["centro_costo_id"], ids["tipo_documento_id"], data["comprobante"],
            data["documento"], data["fecha"], data["fecha"], data["debito"], data["credito"],
            data["base"], _clase_desde_cuenta(cursor, compania_id, data["cuenta"]),
            data["documentoAfectado"], data["concepto"], data["nit"],
        ),
    )
    return int(cursor.fetchone()[0])


def _clase_desde_cuenta(cursor: Any, compania_id: int, codigo: str) -> str:
    """Traduce el tipo fiscal de la cuenta (`MIVA_RET`) a la clase del destino."""
    cursor.execute(
        "SELECT CASE WHEN clase_iva IS NOT NULL THEN 'IVA' "
        "WHEN clase_retencion IS NOT NULL THEN 'Retencion' ELSE '' END "
        "FROM cuentas WHERE compania_id = %s AND codigo = %s",
        (compania_id, codigo),
    )
    fila = cursor.fetchone()
    return _text(fila[0]) if fila else ""


def _refrescar_totales(cursor: Any, lote_id: int, compania_id: int, codigo: str) -> None:
    """Recalcula los controles del lote y lo devuelve a Borrador, como el legado."""
    cursor.execute(
        "UPDATE lotes SET estado = 'Borrador' WHERE compania_id = %s AND id = %s",
        (compania_id, lote_id),
    )


def _totales_lote(cursor: Any, lote_id: int) -> tuple[int, float, float]:
    cursor.execute(
        "SELECT count(*), coalesce(sum(debito), 0), coalesce(sum(credito), 0) "
        "FROM lote_lineas WHERE lote_id = %s",
        (lote_id,),
    )
    items, debito, credito = cursor.fetchone()
    return int(items), float(debito), float(credito)


def create_lot(cia: str, payload: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
    """Crea la cabecera de un lote, como ``CREALOT2``/``GRABALOT``."""
    from .lotes_repository import LotConflict, _normalize_lot

    codigo = str(normalize_company_code(cia))
    data = _normalize_lot(payload, creating=True)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            anio = _anio_operacion(cursor, compania_id)
            cursor.execute(
                "SELECT 1 FROM lotes WHERE compania_id = %s AND anio = %s AND codigo = %s",
                (compania_id, anio, data["lote"]),
            )
            if cursor.fetchone() is not None:
                raise LotConflict(f"El lote {data['lote']} ya existe para la compañía activa.")
            _asegurar_periodo(cursor, compania_id, anio, data["mes"])
            usuario_id = _usuario_id(cursor, data["usuario"])
            cursor.execute(
                "INSERT INTO lotes (compania_id, anio, periodo, codigo, nombre, usuario_id, "
                "origen, fecha, estado) VALUES (%s, %s, %s, %s, %s, %s, 'Manual', %s, 'Borrador') "
                "RETURNING id",
                (compania_id, anio, data["mes"], data["lote"], data["nombre"], usuario_id, date.today()),
            )
            lote_id = int(cursor.fetchone()[0])
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {"id": lote_id, **data, "estado": "Borrador", "items": 0, "debito": 0, "credito": 0}


def update_lot(cia: str, lot: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Modifica descripción, mes y responsable sin cambiar código ni compañía."""
    from .lotes_repository import _normalize_lot, _validate_lot_code

    codigo = str(normalize_company_code(cia))
    codigo_lote = _validate_lot_code(lot)
    data = _normalize_lot({**payload, "lote": codigo_lote}, creating=False)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            lote = _lote_editable(cursor, compania_id, codigo_lote)
            _asegurar_periodo(cursor, compania_id, lote["anio"], data["mes"])
            usuario_id = _usuario_id(cursor, data["usuario"])
            cursor.execute(
                "UPDATE lotes SET nombre = %s, periodo = %s, usuario_id = %s, estado = 'Borrador' "
                "WHERE id = %s",
                (data["nombre"], data["mes"], usuario_id, lote["id"]),
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {**data, "estado": "Borrador"}


def save_lot_line(
    cia: str,
    lot: str,
    payload: dict[str, Any],
    *,
    line_id: int | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Crea o modifica una partida del lote, como ``EDITACELDA``/``GRABAMOV1``."""
    from .lotes_repository import LotConflict, _normalize_lot_line, _validate_lot_code

    codigo = str(normalize_company_code(cia))
    codigo_lote = _validate_lot_code(lot)
    data = _normalize_lot_line(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            lote = _lote_editable(cursor, compania_id, codigo_lote)
            ids = _ids_de_maestros(cursor, compania_id, data)
            if line_id is not None:
                cursor.execute(
                    "SELECT 1 FROM lote_lineas WHERE lote_id = %s AND id = %s",
                    (lote["id"], line_id),
                )
                if cursor.fetchone() is None:
                    raise LotConflict("La partida ya no existe en el lote.")
                clase = _clase_desde_cuenta(cursor, compania_id, data["cuenta"])
                cursor.execute(
                    "UPDATE lote_lineas SET cuenta_id = %s, tercero_id = %s, centro_costo_id = %s, "
                    "tipo_documento_id = %s, comprobante = %s, documento = %s, fecha = %s, "
                    "fecha_documento = %s, debito = %s, credito = %s, base = %s, clase = %s, "
                    "documento_afectado = %s, concepto = %s, nit_alterno = %s WHERE id = %s",
                    (
                        ids["cuenta_id"], ids["tercero_id"], ids["centro_costo_id"],
                        ids["tipo_documento_id"], data["comprobante"], data["documento"],
                        data["fecha"], data["fecha"], data["debito"], data["credito"],
                        data["base"], clase, data["documentoAfectado"], data["concepto"],
                        data["nit"], line_id,
                    ),
                )
                actual = int(line_id)
            else:
                cursor.execute(
                    "SELECT coalesce(max(numero_linea), 0) + 1 FROM lote_lineas WHERE lote_id = %s",
                    (lote["id"],),
                )
                numero = int(cursor.fetchone()[0])
                actual = _insertar_linea(cursor, lote["id"], compania_id, numero, data, ids)
            _refrescar_totales(cursor, lote["id"], compania_id, codigo_lote)
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "id": actual,
        "cuenta": data["cuenta"],
        "nit": data["nit"],
        "centro": data["centro"],
        "comprobante": data["comprobante"],
        "tipoDocumento": data["tipoDocumento"],
        "documento": data["documento"],
        "documentoAfectado": data["documentoAfectado"],
        "concepto": data["concepto"],
        "fecha": data["fecha"].isoformat(),
        "debito": float(data["debito"]),
        "credito": float(data["credito"]),
        "base": float(data["base"]),
    }


def delete_lot_line(cia: str, lot: str, line_id: int) -> None:
    """Elimina una partida del lote editable."""
    from .lotes_repository import LotConflict, _validate_lot_code

    codigo = str(normalize_company_code(cia))
    codigo_lote = _validate_lot_code(lot)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            lote = _lote_editable(cursor, compania_id, codigo_lote)
            cursor.execute(
                "SELECT 1 FROM lote_lineas WHERE lote_id = %s AND id = %s",
                (lote["id"], line_id),
            )
            if cursor.fetchone() is None:
                raise LotConflict("La partida ya no existe en el lote.")
            cursor.execute("DELETE FROM lote_lineas WHERE id = %s", (line_id,))
            _refrescar_totales(cursor, lote["id"], compania_id, codigo_lote)
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def delete_lot(cia: str, lot: str, *, force: bool = False) -> dict[str, Any]:
    """Elimina el lote y sus partidas.

    ``force`` no aplica: la protección del legado vivía en ``CONMOVI.BORRAR``, que
    el modelo nuevo no conserva; se acepta por compatibilidad de firma.
    """
    from .lotes_repository import _validate_lot_code

    codigo = str(normalize_company_code(cia))
    codigo_lote = _validate_lot_code(lot)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            lote = _lote_editable(cursor, compania_id, codigo_lote)
            cursor.execute("SELECT count(*) FROM lote_lineas WHERE lote_id = %s", (lote["id"],))
            partidas = int(cursor.fetchone()[0])
            cursor.execute("DELETE FROM lote_lineas WHERE lote_id = %s", (lote["id"],))
            cursor.execute("DELETE FROM lotes WHERE id = %s", (lote["id"],))
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {"lote": codigo_lote, "partidasEliminadas": partidas, "eliminado": True}


def verify_lot(cia: str, lot: str, *, persist: bool = True) -> dict[str, Any]:
    """Verifica la consistencia del lote con ``validar_lote`` y su contrato."""
    from .lotes_repository import _validate_lot_code

    codigo = str(normalize_company_code(cia))
    codigo_lote = _validate_lot_code(lot)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            lote = _lote_editable(cursor, compania_id, codigo_lote)
            cursor.execute("SELECT validar_lote(%s)", (lote["id"],))
            valido = bool(cursor.fetchone()[0])
            cursor.execute("SELECT estado FROM lotes WHERE id = %s", (lote["id"],))
            estado = str(cursor.fetchone()[0])
            items, debito, credito = _totales_lote(cursor, lote["id"])
            cursor.execute(
                "SELECT count(*) FROM (SELECT DISTINCT comprobante, documento, tipo_documento_id "
                "FROM lote_lineas WHERE lote_id = %s) x",
                (lote["id"],),
            )
            documentos = int(cursor.fetchone()[0])
            cursor.execute(
                "SELECT v.linea_id, v.ambito, v.tipo, v.mensaje, l.documento "
                "FROM lote_validaciones v LEFT JOIN lote_lineas l ON l.id = v.linea_id "
                "WHERE v.lote_id = %s ORDER BY v.id",
                (lote["id"],),
            )
            filas = cursor.fetchall()
            errores = [
                {
                    "categoria": _text(fila[1]),
                    "lineaId": int(fila[0]) if fila[0] is not None else None,
                    "documento": _text(fila[4]),
                    "mensaje": _text(fila[3]),
                }
                for fila in filas
            ]
            duplicados = sum(1 for fila in filas if _text(fila[2]) == "Ya contabilizado")
        _commit(connection, not persist)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "lote": codigo_lote,
        "valido": valido,
        "estado": estado,
        "items": items,
        "documentos": documentos,
        "documentosDuplicados": duplicados,
        "debito": debito,
        "credito": credito,
        "diferencia": round(debito - credito, 2),
        "errores": errores,
    }


def post_lot(cia: str, lot: str, *, user: str = "WEB", dry_run: bool = False) -> dict[str, Any]:
    """Contabiliza un lote verificado con ``contabilizar_lote`` (un documento por grupo)."""
    from .lotes_repository import LotValidationError, _validate_lot_code

    codigo = str(normalize_company_code(cia))
    codigo_lote = _validate_lot_code(lot)
    usuario = (user or "WEB").strip().upper() or "WEB"
    if len(usuario) > 4:
        raise LotValidationError("El código de usuario admite máximo 4 caracteres.")
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            lote = _lote_editable(cursor, compania_id, codigo_lote)
            items, debito, credito = _totales_lote(cursor, lote["id"])
            usuario_id = _usuario_id(cursor, usuario)

            # El flujo web va de Verificado a contabilizado; el modelo nuevo exige
            # el estado Aprobado como paso explícito, así que se promueve aquí.
            cursor.execute("SELECT validar_lote(%s)", (lote["id"],))
            if not bool(cursor.fetchone()[0]):
                cursor.execute(
                    "SELECT count(*) FROM lote_validaciones WHERE lote_id = %s AND severidad = 'Error'",
                    (lote["id"],),
                )
                total = int(cursor.fetchone()[0])
                raise LotValidationError(
                    f"El lote tiene {total} inconsistencia(s). Verifíquelo antes de actualizar."
                )
            cursor.execute("UPDATE lotes SET estado = 'Aprobado' WHERE id = %s", (lote["id"],))
            cursor.execute("SELECT contabilizar_lote(%s, %s)", (lote["id"], usuario_id))
            ids = cursor.fetchone()[0] or []
            documentos = len(ids)
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "lote": codigo_lote,
        "estado": "Validado sin grabar" if dry_run else "Actualizado",
        "documentos": documentos,
        "partidas": items,
        "debito": debito,
        "credito": credito,
        "dryRun": dry_run,
        "advertencias": [],
    }


def import_lot(cia: str, payload: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
    """Crea cabecera y partidas importadas como una unidad atómica (Borrador)."""
    from .lotes_repository import LotConflict, LotValidationError, _normalize_lot, _normalize_lot_line

    codigo = str(normalize_company_code(cia))
    raw_lines = payload.get("lineas")
    if not isinstance(raw_lines, list) or not raw_lines:
        raise LotValidationError("La importación no contiene partidas.")
    if len(raw_lines) > 5000:
        raise LotValidationError("La importación admite máximo 5.000 partidas por lote.")
    data = _normalize_lot(payload, creating=True)
    lineas = []
    for index, cruda in enumerate(raw_lines, start=1):
        if not isinstance(cruda, dict):
            raise LotValidationError(f"Fila {index}: el contenido no es válido.")
        try:
            lineas.append(_normalize_lot_line(cruda))
        except LotValidationError as exc:
            raise LotValidationError(f"Fila {index}: {exc}") from exc

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            anio = _anio_operacion(cursor, compania_id)
            cursor.execute(
                "SELECT 1 FROM lotes WHERE compania_id = %s AND anio = %s AND codigo = %s",
                (compania_id, anio, data["lote"]),
            )
            if cursor.fetchone() is not None:
                raise LotConflict(f"El lote {data['lote']} ya existe para la compañía activa.")
            _asegurar_periodo(cursor, compania_id, anio, data["mes"])
            usuario_id = _usuario_id(cursor, data["usuario"])
            cursor.execute(
                "INSERT INTO lotes (compania_id, anio, periodo, codigo, nombre, usuario_id, "
                "origen, fecha, estado) VALUES (%s, %s, %s, %s, %s, %s, 'Importacion', %s, 'Borrador') "
                "RETURNING id",
                (compania_id, anio, data["mes"], data["lote"], data["nombre"], usuario_id, date.today()),
            )
            lote_id = int(cursor.fetchone()[0])
            for numero, linea in enumerate(lineas, start=1):
                ids = _ids_de_maestros(cursor, compania_id, linea)
                _insertar_linea(cursor, lote_id, compania_id, numero, linea, ids)
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    debito = round(sum(float(linea["debito"]) for linea in lineas), 2)
    credito = round(sum(float(linea["credito"]) for linea in lineas), 2)
    documentos = len({(l["documento"], l["tipoDocumento"], l["comprobante"]) for l in lineas})
    return {
        "lote": data["lote"],
        "valido": False,
        "estado": "Validado sin grabar" if dry_run else "Borrador",
        "items": len(lineas),
        "documentos": documentos,
        "documentosDuplicados": 0,
        "debito": debito,
        "credito": credito,
        "diferencia": round(debito - credito, 2),
        "errores": [],
        "nombre": data["nombre"],
        "mes": data["mes"],
        "creado": not dry_run,
    }


# ---------------------------------------------------------------------------
# Captura directa (etapa D)
# ---------------------------------------------------------------------------
def _siguiente_consecutivo(cursor: Any, compania_id: int, anio: int, comprobante_id: int) -> int:
    """Reserva el consecutivo del comprobante con la fila bloqueada (``FOR UPDATE``)."""
    cursor.execute(
        "SELECT consecutivo_actual FROM consecutivos_comprobantes "
        "WHERE compania_id = %s AND anio = %s AND comprobante_id = %s FOR UPDATE",
        (compania_id, anio, comprobante_id),
    )
    fila = cursor.fetchone()
    if fila is None:
        cursor.execute(
            "INSERT INTO consecutivos_comprobantes (compania_id, anio, comprobante_id, consecutivo_actual) "
            "VALUES (%s, %s, %s, 2) ON CONFLICT (compania_id, anio, comprobante_id) "
            "DO UPDATE SET consecutivo_actual = consecutivos_comprobantes.consecutivo_actual + 1",
            (compania_id, anio, comprobante_id),
        )
        return 1
    cursor.execute(
        "UPDATE consecutivos_comprobantes SET consecutivo_actual = consecutivo_actual + 1 "
        "WHERE compania_id = %s AND anio = %s AND comprobante_id = %s",
        (compania_id, anio, comprobante_id),
    )
    return int(fila[0])


def _aplicar_saldos(
    cursor: Any, compania_id: int, anio: int, periodo: str, cuenta_id: int,
    tercero_id: int | None, centro_id: int | None, debito: Any, credito: Any,
) -> None:
    """Upsert de los saldos por cuenta, tercero y centro (mismo efecto que ``contabilizar_lote``)."""
    cursor.execute(
        "INSERT INTO saldos_cuenta (compania_id, anio, periodo, cuenta_id, debito, credito) "
        "VALUES (%s, %s, %s, %s, %s, %s) "
        "ON CONFLICT (compania_id, anio, periodo, cuenta_id) "
        "DO UPDATE SET debito = saldos_cuenta.debito + EXCLUDED.debito, "
        "credito = saldos_cuenta.credito + EXCLUDED.credito",
        (compania_id, anio, periodo, cuenta_id, debito, credito),
    )
    if tercero_id is not None:
        cursor.execute(
            "INSERT INTO saldos_cuenta_tercero (compania_id, anio, periodo, cuenta_id, tercero_id, debito, credito) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (compania_id, anio, periodo, cuenta_id, tercero_id) "
            "DO UPDATE SET debito = saldos_cuenta_tercero.debito + EXCLUDED.debito, "
            "credito = saldos_cuenta_tercero.credito + EXCLUDED.credito",
            (compania_id, anio, periodo, cuenta_id, tercero_id, debito, credito),
        )
    if centro_id is not None:
        cursor.execute(
            "INSERT INTO saldos_cuenta_centro (compania_id, anio, periodo, cuenta_id, centro_costo_id, debito, credito) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (compania_id, anio, periodo, cuenta_id, centro_costo_id) "
            "DO UPDATE SET debito = saldos_cuenta_centro.debito + EXCLUDED.debito, "
            "credito = saldos_cuenta_centro.credito + EXCLUDED.credito",
            (compania_id, anio, periodo, cuenta_id, centro_id, debito, credito),
        )


def post_direct_movement(payload: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
    """Contabiliza una captura directa: un documento con sus partidas y saldos.

    Es el equivalente de la escritura de ``MOV01``/``CONDOCUM``/``CONMAE`` del
    legado. El consecutivo sale de ``consecutivos_comprobantes`` —el mismo que usa
    ``contabilizar_lote``—, no de ``VISDOCUM.CONSE``: es la numeración del modelo
    nuevo. Decisión en `db/migration/12_escrituras.md`.
    """
    from .contabilizacion_repository import PostingValidationError, _normalize_payload

    data = _normalize_payload(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, str(data["cia"]))
            compania_id = _compania_id(cursor, codigo)
            periodo = f"{data['mes']:02d}"
            cursor.execute(
                "SELECT estado FROM periodos_contables WHERE compania_id = %s AND anio = %s AND periodo = %s",
                (compania_id, data["anio"], periodo),
            )
            control = cursor.fetchone()
            if control is not None and str(control[0]) == "Cerrado":
                raise PostingValidationError(f"El período {data['mes']:02d}/{data['anio']} está cerrado.")
            _asegurar_periodo(cursor, compania_id, data["anio"], periodo)

            cursor.execute(
                "SELECT id FROM comprobantes WHERE compania_id = %s AND codigo = %s",
                (compania_id, data["comprobante"]),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise PostingValidationError(
                    "El comprobante no existe en CONTICOM para la compañía activa."
                )
            comprobante_id = int(fila[0])

            cursor.execute(
                "SELECT id, numeracion, prefijo FROM tipos_documento "
                "WHERE compania_id = %s AND codigo = %s",
                (compania_id, data["tipoDocumento"]),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise PostingValidationError("El tipo de documento no existe en VISDOCUM.")
            tipo_documento_id, numeracion, prefijo = int(fila[0]), _text(fila[1]), _text(fila[2])

            numero = _siguiente_consecutivo(cursor, compania_id, data["anio"], comprobante_id)
            if numeracion == "Manual":
                if not data["numeroDocumento"]:
                    raise PostingValidationError(
                        "VISDOCUM permite consecutivo manual; el número es obligatorio."
                    )
                documento = data["numeroDocumento"]
            elif prefijo:
                documento = prefijo + str(numero).zfill(max(1, 12 - len(prefijo)))
            else:
                documento = data["tipoDocumento"] + str(numero).zfill(10)
            if len(documento) > 12:
                raise PostingValidationError("El consecutivo generado supera la longitud de TDOCUM.")

            # Resolver maestros de cada partida (mensajes con el número de línea).
            for linea in data["lineas"]:
                marcador = {
                    "cuenta": linea["cuenta"], "nit": linea["nit"], "centro": linea["centro"],
                    "comprobante": data["comprobante"], "tipoDocumento": data["tipoDocumento"],
                    "base": linea["base"],
                }
                linea.update(_ids_de_maestros(cursor, compania_id, marcador))

            usuario_id = _usuario_id(cursor, data["usuario"])
            primer_tercero = next((l["tercero_id"] for l in data["lineas"] if l["tercero_id"]), None)
            cursor.execute(
                "INSERT INTO documentos (compania_id, anio, comprobante_id, numero, documento, "
                "tipo_documento_id, fecha, fecha_documento, periodo, tercero_id, concepto, estado, "
                "usuario_id, origen) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, "
                "'Contabilizado', %s, 'Manual') RETURNING id",
                (
                    compania_id, data["anio"], comprobante_id, numero, documento,
                    tipo_documento_id, data["fecha"], data["fecha"], periodo,
                    primer_tercero, data["concepto"], usuario_id,
                ),
            )
            documento_id = int(cursor.fetchone()[0])

            for linea in data["lineas"]:
                cursor.execute(
                    "INSERT INTO documento_lineas (documento_id, compania_id, numero_linea, cuenta_id, "
                    "tercero_id, centro_costo_id, tipo_documento_id, debito, credito, base, clase, "
                    "fecha_documento, nit_alterno, documento_afectado, concepto, origen) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Manual')",
                    (
                        documento_id, compania_id, linea["numero"], linea["cuenta_id"],
                        linea["tercero_id"], linea["centro_costo_id"], linea["tipo_documento_id"],
                        linea["debito"], linea["credito"], linea["base"],
                        _clase_desde_cuenta(cursor, compania_id, linea["cuenta"]),
                        data["fecha"], linea["nit"], linea["documentoAfectado"], linea["concepto"],
                    ),
                )
                _aplicar_saldos(
                    cursor, compania_id, data["anio"], periodo, linea["cuenta_id"],
                    linea["tercero_id"], linea["centro_costo_id"], linea["debito"], linea["credito"],
                )

            for tipo_acumulado in ("Terceros", "Centros", "Retencion", "Iva"):
                cursor.execute(
                    "SELECT regenerar_acumulados(%s, %s, %s)",
                    (compania_id, data["anio"], tipo_acumulado),
                )
            cursor.execute(
                "INSERT INTO auditoria (compania_id, anio, usuario_id, accion, modulo, detalle, resultado) "
                "VALUES (%s, %s, %s, 'Contabilización directa', 'Captura directa', %s, 'EXITO')",
                (compania_id, data["anio"], usuario_id, documento),
            )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "documento": documento,
        "comprobante": data["comprobante"],
        "tipoDocumento": data["tipoDocumento"],
        "fecha": data["fecha"].isoformat(),
        "lineas": len(data["lineas"]),
        "debito": float(data["totalDebito"]),
        "credito": float(data["totalCredito"]),
        "estado": "Validado sin grabar" if dry_run else "Contabilizado",
        "dryRun": dry_run,
        "auditoria": "No aplica en prueba" if dry_run else "Registrada",
        "advertencia": "",
    }


# ---------------------------------------------------------------------------
# Reproceso mensual (etapa D)
# ---------------------------------------------------------------------------
def _comparar_rango(
    cursor: Any, compania_id: int, anio: int, mes_desde: int, mes_hasta: int
) -> dict[str, Any]:
    """Compara el libro contra los acumulados por cuenta y por tercero."""
    desde, hasta = f"{mes_desde:02d}", f"{mes_hasta:02d}"
    cursor.execute(
        "SELECT d.periodo, l.cuenta_id, coalesce(sum(l.debito), 0), coalesce(sum(l.credito), 0), count(*) "
        "FROM documento_lineas l JOIN documentos d ON d.id = l.documento_id "
        "WHERE l.compania_id = %s AND d.anio = %s AND d.periodo BETWEEN %s AND %s "
        "GROUP BY d.periodo, l.cuenta_id",
        (compania_id, anio, desde, hasta),
    )
    libro = {(fila[0], int(fila[1])): (float(fila[2]), float(fila[3]), int(fila[4])) for fila in cursor.fetchall()}

    cursor.execute(
        "SELECT periodo, cuenta_id, coalesce(debito, 0), coalesce(credito, 0) FROM saldos_cuenta "
        "WHERE compania_id = %s AND anio = %s AND periodo BETWEEN %s AND %s",
        (compania_id, anio, desde, hasta),
    )
    saldos = {(fila[0], int(fila[1])): (float(fila[2]), float(fila[3])) for fila in cursor.fetchall()}

    claves = set(libro) | set(saldos)
    diferencia_cuenta = 0.0
    for clave in claves:
        deb_libro, cre_libro, _ = libro.get(clave, (0.0, 0.0, 0))
        deb_saldo, cre_saldo = saldos.get(clave, (0.0, 0.0))
        diferencia_cuenta += abs(deb_libro - deb_saldo) + abs(cre_libro - cre_saldo)

    cursor.execute(
        "SELECT d.periodo, l.cuenta_id, l.tercero_id, coalesce(sum(l.debito), 0), coalesce(sum(l.credito), 0) "
        "FROM documento_lineas l JOIN documentos d ON d.id = l.documento_id "
        "WHERE l.compania_id = %s AND d.anio = %s AND d.periodo BETWEEN %s AND %s "
        "AND l.tercero_id IS NOT NULL GROUP BY d.periodo, l.cuenta_id, l.tercero_id",
        (compania_id, anio, desde, hasta),
    )
    libro_t = {(f[0], int(f[1]), int(f[2])): (float(f[3]), float(f[4])) for f in cursor.fetchall()}
    cursor.execute(
        "SELECT periodo, cuenta_id, tercero_id, coalesce(debito, 0), coalesce(credito, 0) "
        "FROM saldos_cuenta_tercero WHERE compania_id = %s AND anio = %s AND periodo BETWEEN %s AND %s",
        (compania_id, anio, desde, hasta),
    )
    saldos_t = {(f[0], int(f[1]), int(f[2])): (float(f[3]), float(f[4])) for f in cursor.fetchall()}
    diferencia_tercero = 0.0
    for clave in set(libro_t) | set(saldos_t):
        deb_libro, cre_libro = libro_t.get(clave, (0.0, 0.0))
        deb_saldo, cre_saldo = saldos_t.get(clave, (0.0, 0.0))
        diferencia_tercero += abs(deb_libro - deb_saldo) + abs(cre_libro - cre_saldo)

    return {
        "libro": libro,
        "libro_terceros": libro_t,
        "diferencia_cuenta": round(diferencia_cuenta, 2),
        "diferencia_tercero": round(diferencia_tercero, 2),
    }


def simulate_monthly_reprocess(
    company_code: str, year: int, month_from: int, month_to: int
) -> dict[str, Any]:
    """Compara el libro contra los acumulados del rango, sin escribir."""
    import time

    from .reproceso_mensual_repository import _validate_range

    inicio = time.monotonic()
    _validate_range(year, month_from, month_to)
    codigo = str(normalize_company_code(company_code))
    with _connect() as connection, connection.cursor() as cursor:
        compania_id = _compania_id(cursor, _compania(cursor, codigo))
        cursor.execute("SELECT nombre FROM companias WHERE id = %s", (compania_id,))
        nombre = _text(cursor.fetchone()[0])
        comparacion = _comparar_rango(cursor, compania_id, year, month_from, month_to)

    libro = comparacion["libro"]
    registros = sum(valor[2] for valor in libro.values())
    debito = round(sum(valor[0] for valor in libro.values()), 2)
    credito = round(sum(valor[1] for valor in libro.values()), 2)
    total = round(comparacion["diferencia_cuenta"] + comparacion["diferencia_tercero"], 2)
    advertencias = []
    if total == 0 and libro:
        advertencias.append(
            "Los acumulados ya coinciden con el libro; no es necesario ejecutar nuevamente."
        )
    return {
        "compania": {"codigo": f"{int(codigo):03d}", "nombre": nombre},
        "anio": year,
        "mesDesde": month_from,
        "mesHasta": month_to,
        "registrosMovimiento": registros,
        "cuentasProcesadas": len({clave[1] for clave in libro}),
        "auxiliaresTercero": len(comparacion["libro_terceros"]),
        "debito": debito,
        "credito": credito,
        "diferencias": {
            "conmae": comparacion["diferencia_cuenta"],
            "conterce": comparacion["diferencia_tercero"],
            "total": total,
        },
        "advertencias": advertencias,
        "errores": [],
        "puedeEjecutar": total > 0,
        "estado": "Simulación completada",
        "duracionSegundos": round(time.monotonic() - inicio, 2),
        "auditoria": "No aplica",
        "advertenciaAuditoria": "",
        "fuente": "MOV01",
        "destinos": ["CONMAE", "CONTERCE"],
    }


def execute_monthly_reprocess(
    company_code: str,
    year: int,
    month_from: int,
    month_to: int,
    *,
    user: str,
    reason: str,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Simula el reproceso; **no** reescribe los acumulados (ver docstring).

    En el legado el reproceso reemplazaba ``CONMAE``/``CONTERCE`` desde ``MOV01``.
    En el modelo nuevo, ``saldos_cuenta`` conserva la **instantánea fiel de
    ``CONMAE``** (decisión de la etapa C5) y la copia migrada **no tiene el libro
    completo** (faltan ``MOV02``..``MOV18``, etapa F). Reescribir los acumulados
    desde un libro parcial destruiría esa fidelidad, así que la ejecución real
    queda **bloqueada** hasta que el libro esté completo; ``dryRun`` devuelve la
    simulación. Decisión en `db/migration/12_escrituras.md`.
    """
    from .reproceso_mensual_repository import MonthlyReprocessValidationError, _validate_range

    _validate_range(year, month_from, month_to)
    motivo = str(reason).strip()
    if not dry_run and not motivo:
        raise MonthlyReprocessValidationError("El motivo del reproceso es obligatorio.")
    if len(motivo) > 180:
        raise MonthlyReprocessValidationError("El motivo no puede superar 180 caracteres.")

    reporte = simulate_monthly_reprocess(company_code, year, month_from, month_to)
    if dry_run:
        reporte["estado"] = "Validado sin grabar"
        reporte["auditoria"] = "No aplica en prueba"
        return reporte
    raise MonthlyReprocessValidationError(
        "El reproceso no se ejecuta sobre la copia migrada: el libro está incompleto "
        "(faltan MOV02..MOV18) y saldos_cuenta conserva la instantánea fiel de CONMAE. "
        "Queda condicionado a la etapa F."
    )


# ---------------------------------------------------------------------------
# Configuración por compañía (bloque B3)
# ---------------------------------------------------------------------------
# Los 19 períodos de un año contable: '00' (saldos iniciales), '01'..'12' (meses)
# y '13'..'18' (ajustes). Es el juego que siembra `db/postgresql/seed.sql`.
PERIODOS_CONTABLES = tuple(f"{indice:02d}" for indice in range(19))


def _cuenta_de_plan(cursor: Any, compania_id: int, codigo: str, error: type[ValueError]) -> int:
    """Identidad de la cuenta del plan, o el error de validación de la ruta."""
    cursor.execute(
        "SELECT id FROM cuentas WHERE compania_id = %s AND codigo = %s",
        (compania_id, codigo),
    )
    fila = cursor.fetchone()
    if fila is None:
        raise error(f"No existe la cuenta {codigo} en el plan de la compañía.")
    return int(fila[0])


def _compania_anios(cursor: Any, compania_id: int) -> list[int]:
    """Años contables registrados para la compañía, en orden."""
    cursor.execute(
        "SELECT anio FROM compania_anios WHERE compania_id = %s ORDER BY anio",
        (compania_id,),
    )
    return [int(fila[0]) for fila in cursor.fetchall()]


def _compania_movimiento(cursor: Any, compania_id: int) -> dict[str, int]:
    """Documentos, lotes y saldos que bloquean la baja o el cambio de NIT (B3.4)."""
    cursor.execute(
        "SELECT (SELECT count(*) FROM documentos WHERE compania_id = %s), "
        "(SELECT count(*) FROM documentos WHERE compania_id = %s AND estado = 'Contabilizado'), "
        "(SELECT count(*) FROM lotes WHERE compania_id = %s), "
        "(SELECT count(*) FROM saldos_cuenta WHERE compania_id = %s "
        "AND (saldo_inicial <> 0 OR debito <> 0 OR credito <> 0))",
        (compania_id, compania_id, compania_id, compania_id),
    )
    documentos, contabilizados, lotes, saldos = cursor.fetchone()
    return {
        "documentos": int(documentos),
        "contabilizados": int(contabilizados),
        "lotes": int(lotes),
        "saldos": int(saldos),
    }


def create_company(payload: dict[str, Any], *, user: str = "WEB") -> dict[str, Any]:
    """Crea una compañía con su primer año de operación (B3, ``POST /api/companias``).

    Solo PostgreSQL: en Advantage una compañía es una carpeta de tablas por
    empresa, así que esa rama devuelve la causa declarada (503). Aquí se crea la
    fila de ``companias``, su año en ``compania_anios`` y los 19 períodos
    ``00``..``18`` en ``periodos_contables``, que es el primer año completo que
    siembra el propio modelo.
    """
    from .companias_repository import (
        CompanyAlreadyExists, company_display_code, company_item, normalize_company_create,
    )

    data = normalize_company_create(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            usuario_id = _usuario_id(cursor, user)
            cursor.execute("SELECT codigo FROM companias WHERE codigo = %s", (data["codigo"],))
            if cursor.fetchone() is not None:
                raise CompanyAlreadyExists(
                    f"Ya existe la compañía {company_display_code(data['codigo'])}."
                )
            cursor.execute(
                "SELECT codigo FROM companias WHERE nit = %s AND digito = %s",
                (data["nit"], data["digito"]),
            )
            existente = cursor.fetchone()
            if existente is not None:
                # Brecha de CONEMP que la matriz declara (UNIQUE(nit, digito)).
                raise CompanyAlreadyExists(
                    f"El NIT {data['nit']} con dígito {data['digito']} ya está registrado "
                    f"en la compañía {company_display_code(_text(existente[0]))}."
                )
            cursor.execute(
                "INSERT INTO companias (codigo, nombre, nit, digito, estado, "
                "solo_consolidacion, creado_por, actualizado_por) "
                "VALUES (%s, %s, %s, %s, 'Activa', %s, %s, %s) RETURNING id",
                (
                    data["codigo"], data["nombre"], data["nit"], data["digito"],
                    data["soloConsolidacion"], usuario_id, usuario_id,
                ),
            )
            compania_id = int(cursor.fetchone()[0])
            cursor.execute(
                "INSERT INTO compania_anios (compania_id, anio, creado_por) VALUES (%s, %s, %s)",
                (compania_id, data["anio"], usuario_id),
            )
            for periodo in PERIODOS_CONTABLES:
                cursor.execute(
                    "INSERT INTO periodos_contables "
                    "(compania_id, anio, periodo, nombre, estado, creado_por) "
                    "VALUES (%s, %s, %s, %s, 'Abierto', %s)",
                    (compania_id, data["anio"], periodo, MESES[periodo], usuario_id),
                )
            _auditar(
                cursor, compania_id, usuario_id, "Alta de compañía", "Compañías",
                company_display_code(data["codigo"]), "",
                {"anio": data["anio"], "soloConsolidacion": data["soloConsolidacion"]},
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return company_item(data, anios=[data["anio"]], estado="Activa")


def update_company(
    codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica nombre, NIT, dígito y estado de la compañía (B3, ``PUT``).

    El NIT no se puede cambiar si la compañía ya tiene documentos
    contabilizados: la identidad fiscal de lo contabilizado no se reescribe desde
    la configuración (409). Pasar a ``Inactiva`` solo la retira del selector.
    """
    from .companias_repository import (
        CompanyAlreadyExists, CompanyConflict, company_display_code, company_item,
        normalize_company_code, normalize_company_write,
    )

    code = normalize_company_code(codigo)
    data = normalize_company_write(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            usuario_id = _usuario_id(cursor, user)
            cursor.execute("SELECT id, nit, digito FROM companias WHERE codigo = %s", (code,))
            fila = cursor.fetchone()
            if fila is None:
                raise CompanyNotFound(f"No existe la compañía {company_display_code(code)}.")
            compania_id = int(fila[0])
            cambia_nit = (_text(fila[1]), _text(fila[2])) != (data["nit"], data["digito"])
            if cambia_nit:
                conteo = _compania_movimiento(cursor, compania_id)
                if conteo["contabilizados"]:
                    raise CompanyConflict(
                        f"La compañía {company_display_code(code)} tiene "
                        f"{conteo['contabilizados']} documento(s) contabilizado(s): "
                        "el NIT no se puede cambiar."
                    )
                cursor.execute(
                    "SELECT codigo FROM companias WHERE nit = %s AND digito = %s AND id <> %s",
                    (data["nit"], data["digito"], compania_id),
                )
                otra = cursor.fetchone()
                if otra is not None:
                    raise CompanyAlreadyExists(
                        f"El NIT {data['nit']} con dígito {data['digito']} ya está "
                        f"registrado en la compañía {company_display_code(_text(otra[0]))}."
                    )
            cursor.execute(
                "UPDATE companias SET nombre = %s, nit = %s, digito = %s, estado = %s, "
                "solo_consolidacion = %s, actualizado_por = %s WHERE id = %s",
                (
                    data["nombre"], data["nit"], data["digito"], data["estado"],
                    data["soloConsolidacion"], usuario_id, compania_id,
                ),
            )
            anios = _compania_anios(cursor, compania_id)
            _auditar(
                cursor, compania_id, usuario_id, "Modificación de compañía", "Compañías",
                company_display_code(code), str(payload.get("motivo") or ""),
                {"estado": data["estado"], "cambiaNit": cambia_nit},
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return company_item({"codigo": code, **data}, anios=anios)


def delete_company(
    codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Baja lógica de una compañía sin movimiento (B3, ``DELETE``).

    ``companias`` no tiene ``eliminado_en``: la baja deja ``estado = 'Inactiva'``,
    que la retira del selector sin perder la identidad fiscal de sus documentos.
    Se rechaza con 409 si la compañía tiene documentos, lotes o saldos; con
    ``dryRun`` se informa el conteo sin ejecutar la baja.
    """
    from .companias_repository import (
        CompanyConflict, company_display_code, normalize_company_code, validate_company_reason,
    )

    code = normalize_company_code(codigo)
    motivo = validate_company_reason(reason)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            usuario_id = _usuario_id(cursor, user)
            cursor.execute("SELECT id FROM companias WHERE codigo = %s", (code,))
            fila = cursor.fetchone()
            if fila is None:
                raise CompanyNotFound(f"No existe la compañía {company_display_code(code)}.")
            compania_id = int(fila[0])
            conteo = _compania_movimiento(cursor, compania_id)
            bloqueada = any(conteo[clave] for clave in ("documentos", "lotes", "saldos"))
            if bloqueada and not dry_run:
                raise CompanyConflict(
                    f"La compañía {company_display_code(code)} tiene {conteo['documentos']} "
                    f"documento(s), {conteo['lotes']} lote(s) y {conteo['saldos']} saldo(s): "
                    "no se puede dar de baja."
                )
            if not dry_run:
                cursor.execute(
                    "UPDATE companias SET estado = 'Inactiva', actualizado_por = %s WHERE id = %s",
                    (usuario_id, compania_id),
                )
                _auditar(
                    cursor, compania_id, usuario_id, "Baja de compañía", "Compañías",
                    company_display_code(code), motivo, conteo,
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        **conteo,
        "codigo": company_display_code(code),
        "bloqueada": bloqueada,
        "eliminada": not dry_run,
        "bajaLogica": True,
    }


def _de_baja(fila: Any, cia: str, codigo: str, clase: type[RuntimeError]) -> None:
    """Código ya existente: distingue la fila vigente de la reservada por una baja."""
    if fila[0] is not None:
        raise clase(
            f"El código {codigo} está reservado por un registro dado de baja en la "
            f"compañía {cia}: el código no se puede reutilizar."
        )
    raise clase(f"Ya existe el registro {codigo} en la compañía {cia}.")


def _periodos_de_uso(cursor: Any, compania_id: int, columna: str, tabla: str, valor: int) -> list[str]:
    """Períodos en que una tarifa o un concepto se usó en renglones o acumulados."""
    cursor.execute(
        "SELECT DISTINCT d.anio, d.periodo FROM documento_lineas dl "
        "JOIN documentos d ON d.id = dl.documento_id "
        f"WHERE dl.compania_id = %s AND dl.{columna} = %s "
        f"UNION SELECT DISTINCT a.anio, a.periodo FROM {tabla} a "
        f"WHERE a.compania_id = %s AND a.{columna} = %s ORDER BY 1, 2",
        (compania_id, valor, compania_id, valor),
    )
    return [f"{int(anio):04d}-{_text(periodo)}" for anio, periodo in cursor.fetchall()]


def _referencias(cursor: Any, compania_id: int, columna: str, tabla: str, valor: int) -> int:
    """Renglones y acumulados que referencian una tarifa o un concepto."""
    cursor.execute(
        "SELECT (SELECT count(*) FROM documento_lineas WHERE compania_id = %s AND "
        f"{columna} = %s) + (SELECT count(*) FROM lote_lineas WHERE compania_id = %s AND "
        f"{columna} = %s) + (SELECT count(*) FROM {tabla} WHERE compania_id = %s AND "
        f"{columna} = %s)",
        (compania_id, valor, compania_id, valor, compania_id, valor),
    )
    return int(cursor.fetchone()[0])


def create_tarifa_iva(
    company_code: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea una tarifa de IVA de la compañía (B3.2) en ``tarifas_iva``.

    ``tarifa`` viaja como fracción (0.19) y en el modelo nuevo se guarda igual:
    el dominio ``porcentaje`` es ``numeric(9,6)`` de fracción, no de porcentaje.
    """
    from .tarifas_iva_repository import (
        VatRateAlreadyExists, VatRateValidationError, normalize_vat_rate, vat_rate_item,
    )

    data = normalize_vat_rate(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT eliminado_en FROM tarifas_iva WHERE compania_id = %s AND codigo = %s",
                (compania_id, data["codigo"]),
            )
            existente = cursor.fetchone()
            if existente is not None:
                _de_baja(existente, codigo_cia, data["codigo"], VatRateAlreadyExists)
            cuenta_id = None
            if data["cuenta"]:
                cuenta_id = _cuenta_de_plan(
                    cursor, compania_id, data["cuenta"], VatRateValidationError
                )
            cursor.execute(
                "INSERT INTO tarifas_iva (compania_id, codigo, nombre, tarifa, cuenta_id) "
                "VALUES (%s, %s, %s, %s, %s)",
                (compania_id, data["codigo"], data["nombre"], data["tarifa"], cuenta_id),
            )
            _auditar(
                cursor, compania_id, _usuario_id(cursor, user),
                "Alta de tarifa de IVA", "Configuración", data["codigo"], "",
                {"tarifa": str(data["tarifa"]), "cuenta": data["cuenta"]},
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return vat_rate_item(data)


def update_tarifa_iva(
    company_code: str, codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica una tarifa de IVA (B3.3) sin tocar la historia contabilizada.

    El renglón guarda su tarifa histórica (``documento_lineas.tarifa_iva_id``), así
    que cambiar la vigente no reescribe lo contabilizado; si la tarifa ya se usó,
    la respuesta informa los períodos para que la interfaz lo advierta.
    """
    from .tarifas_iva_repository import (
        VatRateNotFound, VatRateValidationError, normalize_vat_rate, vat_rate_item,
    )

    data = normalize_vat_rate({**payload, "codigo": codigo})
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT id, tarifa FROM tarifas_iva WHERE compania_id = %s AND codigo = %s "
                "AND eliminado_en IS NULL",
                (compania_id, data["codigo"]),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise VatRateNotFound(
                    f"No existe la tarifa de IVA {codigo} en la compañía {codigo_cia}."
                )
            tarifa_id = int(fila[0])
            cambia_tarifa = Decimal(str(fila[1])) != Decimal(str(data["tarifa"]))
            cuenta_id = None
            if data["cuenta"]:
                cuenta_id = _cuenta_de_plan(
                    cursor, compania_id, data["cuenta"], VatRateValidationError
                )
            cursor.execute(
                "UPDATE tarifas_iva SET nombre = %s, tarifa = %s, cuenta_id = %s WHERE id = %s",
                (data["nombre"], data["tarifa"], cuenta_id, tarifa_id),
            )
            periodos = _periodos_de_uso(
                cursor, compania_id, "tarifa_iva_id", "acumulados_iva", tarifa_id
            ) if cambia_tarifa else []
            _auditar(
                cursor, compania_id, _usuario_id(cursor, user),
                "Modificación de tarifa de IVA", "Configuración", data["codigo"],
                str(payload.get("motivo") or ""),
                {"tarifa": str(data["tarifa"]), "periodosUso": periodos},
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    item = vat_rate_item(data)
    if periodos:
        item["advertencia"] = (
            "La tarifa se usó en los períodos " + ", ".join(periodos) +
            "; el cambio aplica a lo que se capture, no a lo contabilizado."
        )
    return item


def delete_tarifa_iva(
    company_code: str, codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Baja lógica de una tarifa de IVA (B3.4): marca ``eliminado_en``.

    El código queda reservado (la ``UNIQUE (compania_id, codigo)`` no excluye las
    filas de baja) y el ``GET`` la excluye. Se rechaza con 409 si la tarifa está
    referenciada por un renglón contabilizado o un acumulado de IVA.
    """
    from .tarifas_iva_repository import VatRateConflict, VatRateNotFound

    # Se valida antes de conectar, igual que la rama Advantage: código y motivo
    # son contrato, no consulta.
    from .companias_repository import validate_company_reason

    codigo_limpio = str(codigo or "").strip().upper()
    validate_company_reason(reason)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT id FROM tarifas_iva WHERE compania_id = %s AND codigo = %s "
                "AND eliminado_en IS NULL",
                (compania_id, codigo_limpio),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise VatRateNotFound(
                    f"No existe la tarifa de IVA {codigo} en la compañía {codigo_cia}."
                )
            tarifa_id = int(fila[0])
            referencias = _referencias(
                cursor, compania_id, "tarifa_iva_id", "acumulados_iva", tarifa_id
            )
            if referencias and not dry_run:
                raise VatRateConflict(
                    f"La tarifa {codigo} está referenciada por {referencias} renglón(es) "
                    "contabilizado(s): déjela inactiva en su lugar."
                )
            if not dry_run:
                cursor.execute(
                    "UPDATE tarifas_iva SET eliminado_en = now() WHERE id = %s", (tarifa_id,)
                )
                _auditar(
                    cursor, compania_id, _usuario_id(cursor, user),
                    "Baja de tarifa de IVA", "Configuración", codigo, reason,
                    {"referencias": referencias},
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "codigo": codigo_limpio,
        "eliminada": not dry_run,
        "bajaLogica": True,
        "referencias": referencias,
    }


def create_concepto_retencion(
    company_code: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un concepto de retención de la compañía (B3.2) en ``conceptos_retencion``."""
    from .conceptos_retencion_repository import (
        RetentionConceptAlreadyExists, RetentionConceptValidationError,
        normalize_retention_concept, retention_concept_item,
    )

    data = normalize_retention_concept(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT eliminado_en FROM conceptos_retencion WHERE compania_id = %s "
                "AND codigo = %s",
                (compania_id, data["codigo"]),
            )
            existente = cursor.fetchone()
            if existente is not None:
                _de_baja(
                    existente, codigo_cia, data["codigo"],
                    RetentionConceptAlreadyExists,
                )
            cuenta_id = _cuenta_de_plan(
                cursor, compania_id, data["cuenta"], RetentionConceptValidationError
            )
            cursor.execute(
                "INSERT INTO conceptos_retencion "
                "(compania_id, codigo, nombre, tarifa, cuenta_id, base_minima) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (
                    compania_id, data["codigo"], data["nombre"], data["tarifa"],
                    cuenta_id, data["baseMinima"],
                ),
            )
            _auditar(
                cursor, compania_id, _usuario_id(cursor, user),
                "Alta de concepto de retención", "Configuración", data["codigo"], "",
                {
                    "tarifa": str(data["tarifa"]),
                    "baseMinima": str(data["baseMinima"]),
                    "cuenta": data["cuenta"],
                },
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return retention_concept_item(data)


def update_concepto_retencion(
    company_code: str, codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica un concepto de retención (B3.3) sin tocar los acumulados ya causados."""
    from .conceptos_retencion_repository import (
        RetentionConceptNotFound, RetentionConceptValidationError,
        normalize_retention_concept, retention_concept_item,
    )

    data = normalize_retention_concept({**payload, "codigo": codigo})
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT id FROM conceptos_retencion WHERE compania_id = %s AND codigo = %s "
                "AND eliminado_en IS NULL",
                (compania_id, data["codigo"]),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise RetentionConceptNotFound(
                    f"No existe el concepto de retención {codigo} en la compañía {codigo_cia}."
                )
            concepto_id = int(fila[0])
            cuenta_id = _cuenta_de_plan(
                cursor, compania_id, data["cuenta"], RetentionConceptValidationError
            )
            cursor.execute(
                "UPDATE conceptos_retencion SET nombre = %s, tarifa = %s, cuenta_id = %s, "
                "base_minima = %s WHERE id = %s",
                (
                    data["nombre"], data["tarifa"], cuenta_id, data["baseMinima"],
                    concepto_id,
                ),
            )
            _auditar(
                cursor, compania_id, _usuario_id(cursor, user),
                "Modificación de concepto de retención", "Configuración", data["codigo"],
                str(payload.get("motivo") or ""),
                {"tarifa": str(data["tarifa"]), "baseMinima": str(data["baseMinima"])},
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return retention_concept_item(data)


def delete_concepto_retencion(
    company_code: str, codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Baja lógica de un concepto de retención (B3.4): marca ``eliminado_en``.

    Se rechaza con 409 si el concepto aparece en ``acumulados_retencion`` o en un
    renglón contabilizado: la matriz pide preservar bases, período y concepto
    (``db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md``, CONRET).
    """
    from .conceptos_retencion_repository import RetentionConceptConflict, RetentionConceptNotFound
    from .companias_repository import validate_company_reason

    codigo_limpio = str(codigo or "").strip().upper()
    validate_company_reason(reason)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT id FROM conceptos_retencion WHERE compania_id = %s AND codigo = %s "
                "AND eliminado_en IS NULL",
                (compania_id, codigo_limpio),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise RetentionConceptNotFound(
                    f"No existe el concepto de retención {codigo} en la compañía {codigo_cia}."
                )
            concepto_id = int(fila[0])
            referencias = _referencias(
                cursor, compania_id, "concepto_retencion_id", "acumulados_retencion", concepto_id
            )
            if referencias and not dry_run:
                raise RetentionConceptConflict(
                    f"El concepto {codigo} está referenciado por {referencias} registro(s) "
                    "de retención: déjelo inactivo en su lugar."
                )
            if not dry_run:
                cursor.execute(
                    "UPDATE conceptos_retencion SET eliminado_en = now() WHERE id = %s",
                    (concepto_id,),
                )
                _auditar(
                    cursor, compania_id, _usuario_id(cursor, user),
                    "Baja de concepto de retención", "Configuración", codigo, reason,
                    {"referencias": referencias},
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "codigo": codigo_limpio,
        "eliminada": not dry_run,
        "bajaLogica": True,
        "referencias": referencias,
    }


def create_renglon_renta(
    company_code: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un renglón de renta de la compañía (B3.2) en ``renglones_renta``.

    Una misma cuenta no puede entrar en dos renglones con signos distintos: eso
    partiría su saldo en la declaración (409).
    """
    from .renglones_renta_repository import (
        IncomeLineAlreadyExists, IncomeLineConflict, IncomeLineValidationError,
        income_line_item, normalize_income_line,
    )

    data = normalize_income_line(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT eliminado_en FROM renglones_renta WHERE compania_id = %s AND codigo = %s",
                (compania_id, data["codigo"]),
            )
            existente = cursor.fetchone()
            if existente is not None:
                _de_baja(existente, codigo_cia, data["codigo"], IncomeLineAlreadyExists)
            cuenta_id = _cuenta_de_plan(
                cursor, compania_id, data["cuenta"], IncomeLineValidationError
            )
            cursor.execute(
                "SELECT codigo, signo FROM renglones_renta WHERE compania_id = %s "
                "AND cuenta_id = %s AND eliminado_en IS NULL AND signo <> %s",
                (compania_id, cuenta_id, data["signo"]),
            )
            otro = cursor.fetchone()
            if otro is not None:
                raise IncomeLineConflict(
                    f"La cuenta {data['cuenta']} ya está en el renglón "
                    f"{_text(otro[0])} con el signo {int(otro[1])}: una cuenta no puede "
                    "estar en dos renglones con signos distintos."
                )
            cursor.execute(
                "INSERT INTO renglones_renta (compania_id, codigo, nombre, cuenta_id, signo) "
                "VALUES (%s, %s, %s, %s, %s)",
                (compania_id, data["codigo"], data["nombre"], cuenta_id, data["signo"]),
            )
            _auditar(
                cursor, compania_id, _usuario_id(cursor, user),
                "Alta de renglón de renta", "Configuración", data["codigo"], "",
                {"cuenta": data["cuenta"], "signo": data["signo"]},
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return income_line_item(data)


def update_renglon_renta(
    company_code: str, codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica un renglón de renta (B3.3): es una definición vigente.

    Cambiar signo o cuenta no reescribe declaraciones anteriores; se conserva la
    regla de que una cuenta no puede estar en dos renglones con signos distintos.
    """
    from .renglones_renta_repository import (
        IncomeLineConflict, IncomeLineNotFound, IncomeLineValidationError,
        income_line_item, normalize_income_line,
    )

    data = normalize_income_line({**payload, "codigo": codigo})
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT id FROM renglones_renta WHERE compania_id = %s AND codigo = %s "
                "AND eliminado_en IS NULL",
                (compania_id, data["codigo"]),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise IncomeLineNotFound(
                    f"No existe el renglón de renta {codigo} en la compañía {codigo_cia}."
                )
            renglon_id = int(fila[0])
            cuenta_id = _cuenta_de_plan(
                cursor, compania_id, data["cuenta"], IncomeLineValidationError
            )
            cursor.execute(
                "SELECT codigo, signo FROM renglones_renta WHERE compania_id = %s "
                "AND cuenta_id = %s AND eliminado_en IS NULL AND signo <> %s AND id <> %s",
                (compania_id, cuenta_id, data["signo"], renglon_id),
            )
            otro = cursor.fetchone()
            if otro is not None:
                raise IncomeLineConflict(
                    f"La cuenta {data['cuenta']} ya está en el renglón "
                    f"{_text(otro[0])} con el signo {int(otro[1])}: una cuenta no puede "
                    "estar en dos renglones con signos distintos."
                )
            cursor.execute(
                "UPDATE renglones_renta SET nombre = %s, cuenta_id = %s, signo = %s "
                "WHERE id = %s",
                (data["nombre"], cuenta_id, data["signo"], renglon_id),
            )
            _auditar(
                cursor, compania_id, _usuario_id(cursor, user),
                "Modificación de renglón de renta", "Configuración", data["codigo"],
                str(payload.get("motivo") or ""),
                {"cuenta": data["cuenta"], "signo": data["signo"]},
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return income_line_item(data)


def delete_renglon_renta(
    company_code: str, codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Baja lógica de un renglón de renta (B3.4): marca ``eliminado_en``.

    Un renglón cuya cuenta ya tiene movimientos contabilizados no se retira
    (409): CONDECLA necesita reproducir las declaraciones y la baja no puede
    romper esa reproducción.
    """
    from .renglones_renta_repository import IncomeLineConflict, IncomeLineNotFound
    from .companias_repository import validate_company_reason

    codigo_limpio = str(codigo or "").strip().upper()
    validate_company_reason(reason)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT id, cuenta_id FROM renglones_renta WHERE compania_id = %s "
                "AND codigo = %s AND eliminado_en IS NULL",
                (compania_id, codigo_limpio),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise IncomeLineNotFound(
                    f"No existe el renglón de renta {codigo} en la compañía {codigo_cia}."
                )
            renglon_id = int(fila[0])
            cuenta_id = int(fila[1]) if fila[1] is not None else None
            referencias = 0
            if cuenta_id is not None:
                cursor.execute(
                    "SELECT count(*) FROM documento_lineas WHERE compania_id = %s AND cuenta_id = %s",
                    (compania_id, cuenta_id),
                )
                referencias = int(cursor.fetchone()[0])
            if referencias and not dry_run:
                raise IncomeLineConflict(
                    f"El renglón {codigo} usa una cuenta con {referencias} renglón(es) "
                    "contabilizado(s): no se puede retirar porque CONDECLA reproduce "
                    "resultados sobre esa definición."
                )
            if not dry_run:
                cursor.execute(
                    "UPDATE renglones_renta SET eliminado_en = now() WHERE id = %s",
                    (renglon_id,),
                )
                _auditar(
                    cursor, compania_id, _usuario_id(cursor, user),
                    "Baja de renglón de renta", "Configuración", codigo, reason,
                    {"referencias": referencias},
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "codigo": codigo_limpio,
        "eliminada": not dry_run,
        "bajaLogica": True,
        "referencias": referencias,
    }


def _tipo_documento_de_plan(
    cursor: Any, compania_id: int, codigo: str, error: type[ValueError]
) -> int:
    """Identidad del tipo de documento de la compañía, o el error de la ruta (422)."""
    cursor.execute(
        "SELECT id FROM tipos_documento WHERE compania_id = %s AND codigo = %s "
        "AND eliminado_en IS NULL",
        (compania_id, codigo),
    )
    fila = cursor.fetchone()
    if fila is None:
        raise error(f"No existe el tipo de documento {codigo} en la compañía.")
    return int(fila[0])


def _comprobante_de_plan(
    cursor: Any, compania_id: int, codigo: str, error: type[ValueError]
) -> int:
    """Identidad del comprobante de la compañía, o el error de la ruta (422)."""
    cursor.execute(
        "SELECT id FROM comprobantes WHERE compania_id = %s AND codigo = %s "
        "AND eliminado_en IS NULL",
        (compania_id, codigo),
    )
    fila = cursor.fetchone()
    if fila is None:
        raise error(f"No existe el comprobante {codigo} en la compañía.")
    return int(fila[0])


def _cuenta_afectable_de_plan(
    cursor: Any, compania_id: int, codigo: str, posicion: int, error: type[ValueError]
) -> int:
    """Cuenta del plan que además permite recibir movimientos (422 con su línea)."""
    cursor.execute(
        "SELECT id, afectable FROM cuentas WHERE compania_id = %s AND codigo = %s",
        (compania_id, codigo),
    )
    fila = cursor.fetchone()
    if fila is None:
        raise error(f"Línea {posicion}: no existe la cuenta {codigo} en el plan de la compañía.")
    if not fila[1]:
        raise error(f"Línea {posicion}: la cuenta {codigo} no es afectable.")
    return int(fila[0])


def _documentos_con_tipo(cursor: Any, compania_id: int, tipo_documento_id: int | None) -> int:
    """Documentos contabilizados con ese tipo documental.

    El modelo nuevo no persiste de qué plantilla salió un lote (``lotes`` y
    ``documentos`` no guardan ``plantilla_id``), así que la comprobación más fuerte
    disponible es el tipo documental de la plantilla, que es lo que
    ``documentos.tipo_documento_id`` conserva del renglón capturado.
    """
    if tipo_documento_id is None:
        return 0
    cursor.execute(
        "SELECT count(*) FROM documentos WHERE compania_id = %s AND tipo_documento_id = %s",
        (compania_id, tipo_documento_id),
    )
    return int(cursor.fetchone()[0])


def _insertar_elementos(cursor: Any, formato_id: int, elementos: list[dict[str, Any]]) -> None:
    """Inserta el bloque completo de elementos de un formato."""
    cursor.executemany(
        "INSERT INTO formato_elementos "
        "(formato_id, tipo, contenido, x, y, ancho, alto, fuente, orden) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
        [
            (
                formato_id, elemento["tipo"], elemento["contenido"], elemento["x"],
                elemento["y"], elemento["ancho"], elemento["alto"], elemento["fuente"],
                elemento["orden"],
            )
            for elemento in elementos
        ],
    )


def create_plantilla_contable(
    company_code: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea una plantilla con sus parejas de cuentas (B3.2) en ``plantillas_contables``.

    El alta es una sola transacción: cabecera y líneas, con las cuentas validadas
    contra el plan de la compañía (existentes y afectables) y el tipo documental
    resuelto en la misma compañía.
    """
    from .plantillas_contables_repository import (
        TemplateAlreadyExists, TemplateValidationError, normalize_template, template_item,
    )

    data = normalize_template(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT eliminado_en FROM plantillas_contables WHERE compania_id = %s "
                "AND codigo = %s",
                (compania_id, data["codigo"]),
            )
            existente = cursor.fetchone()
            if existente is not None:
                _de_baja(existente, codigo_cia, data["codigo"], TemplateAlreadyExists)
            tipo_documento_id = _tipo_documento_de_plan(
                cursor, compania_id, data["tipoDocumento"], TemplateValidationError
            )
            cuentas = [
                (
                    linea["orden"],
                    _cuenta_afectable_de_plan(
                        cursor, compania_id, linea["cuentaDebito"], posicion,
                        TemplateValidationError,
                    ),
                    _cuenta_afectable_de_plan(
                        cursor, compania_id, linea["cuentaCredito"], posicion,
                        TemplateValidationError,
                    ),
                    linea["concepto"],
                )
                for posicion, linea in enumerate(data["lineas"], start=1)
            ]
            cursor.execute(
                "INSERT INTO plantillas_contables "
                "(compania_id, codigo, nombre, tipo_documento_id) VALUES (%s, %s, %s, %s) "
                "RETURNING id",
                (compania_id, data["codigo"], data["nombre"], tipo_documento_id),
            )
            plantilla_id = int(cursor.fetchone()[0])
            cursor.executemany(
                "INSERT INTO plantilla_lineas "
                "(plantilla_id, orden, cuenta_debito_id, cuenta_credito_id, concepto) "
                "VALUES (%s, %s, %s, %s, %s)",
                [(plantilla_id, *cuenta) for cuenta in cuentas],
            )
            _auditar(
                cursor, compania_id, _usuario_id(cursor, user),
                "Alta de plantilla contable", "Configuración", data["codigo"], "",
                {"tipoDocumento": data["tipoDocumento"], "lineas": len(cuentas)},
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return template_item(data)


def update_plantilla_contable(
    company_code: str, codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica la plantilla y **reemplaza sus líneas en bloque** (B3.3).

    El reemplazo en bloque dentro de la transacción es el kardex de reglas: borrar
    y reinsertar, nunca dejar ids huérfanos. Si la plantilla ya produjo documentos
    contabilizados de su tipo documental, la definición vigente no cambia (409).
    """
    from .plantillas_contables_repository import (
        TemplateConflict, TemplateNotFound, TemplateValidationError, normalize_template,
        template_item,
    )

    data = normalize_template({**payload, "codigo": codigo})
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT id, tipo_documento_id FROM plantillas_contables "
                "WHERE compania_id = %s AND codigo = %s AND eliminado_en IS NULL",
                (compania_id, data["codigo"]),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise TemplateNotFound(
                    f"No existe la plantilla contable {codigo} en la compañía {codigo_cia}."
                )
            plantilla_id = int(fila[0])
            documentos = _documentos_con_tipo(
                cursor, compania_id, int(fila[1]) if fila[1] is not None else None
            )
            if documentos:
                raise TemplateConflict(
                    f"La plantilla {codigo} tiene {documentos} documento(s) contabilizado(s) "
                    "de su tipo documental: la definición no puede cambiar lo ya capturado."
                )
            tipo_documento_id = _tipo_documento_de_plan(
                cursor, compania_id, data["tipoDocumento"], TemplateValidationError
            )
            cuentas = [
                (
                    linea["orden"],
                    _cuenta_afectable_de_plan(
                        cursor, compania_id, linea["cuentaDebito"], posicion,
                        TemplateValidationError,
                    ),
                    _cuenta_afectable_de_plan(
                        cursor, compania_id, linea["cuentaCredito"], posicion,
                        TemplateValidationError,
                    ),
                    linea["concepto"],
                )
                for posicion, linea in enumerate(data["lineas"], start=1)
            ]
            cursor.execute(
                "UPDATE plantillas_contables SET nombre = %s, tipo_documento_id = %s "
                "WHERE id = %s",
                (data["nombre"], tipo_documento_id, plantilla_id),
            )
            # Kardex de reglas: el bloque se reemplaza completo, nunca por id huérfano.
            cursor.execute("DELETE FROM plantilla_lineas WHERE plantilla_id = %s", (plantilla_id,))
            cursor.executemany(
                "INSERT INTO plantilla_lineas "
                "(plantilla_id, orden, cuenta_debito_id, cuenta_credito_id, concepto) "
                "VALUES (%s, %s, %s, %s, %s)",
                [(plantilla_id, *cuenta) for cuenta in cuentas],
            )
            _auditar(
                cursor, compania_id, _usuario_id(cursor, user),
                "Modificación de plantilla contable", "Configuración", data["codigo"],
                str(payload.get("motivo") or ""),
                {"tipoDocumento": data["tipoDocumento"], "lineas": len(cuentas)},
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return template_item(data)


def delete_plantilla_contable(
    company_code: str, codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Baja lógica de la plantilla (B3.4): marca ``eliminado_en`` y conserva sus líneas.

    El ``ON DELETE CASCADE`` del modelo es para el borrado físico y aquí no se usa:
    las líneas se conservan. Un lote creado desde la plantilla no se toca, así que la
    baja no comprueba dependencias; solo informa los documentos de su tipo documental.
    """
    from .plantillas_contables_repository import TemplateNotFound
    from .companias_repository import validate_company_reason

    codigo_limpio = str(codigo or "").strip().upper()
    validate_company_reason(reason)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT id, tipo_documento_id FROM plantillas_contables "
                "WHERE compania_id = %s AND codigo = %s AND eliminado_en IS NULL",
                (compania_id, codigo_limpio),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise TemplateNotFound(
                    f"No existe la plantilla contable {codigo} en la compañía {codigo_cia}."
                )
            plantilla_id = int(fila[0])
            referencias = _documentos_con_tipo(
                cursor, compania_id, int(fila[1]) if fila[1] is not None else None
            )
            if not dry_run:
                cursor.execute(
                    "UPDATE plantillas_contables SET eliminado_en = now() WHERE id = %s",
                    (plantilla_id,),
                )
                _auditar(
                    cursor, compania_id, _usuario_id(cursor, user),
                    "Baja de plantilla contable", "Configuración", codigo, reason,
                    {"referencias": referencias},
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "codigo": codigo_limpio,
        "eliminada": not dry_run,
        "bajaLogica": True,
        "referencias": referencias,
    }


def create_formato_documental(
    company_code: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un formato de impresión con sus elementos (B3.2).

    ``tipo`` ya viene validado contra las ocho clases del ``CHECK`` por el
    normalizador; el ``comprobante`` se resuelve en la compañía, que es lo que el
    legado no tiene.
    """
    from .formatos_documentales_repository import (
        DocumentFormatAlreadyExists, DocumentFormatValidationError,
        document_format_item, normalize_document_format,
    )

    data = normalize_document_format(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT eliminado_en FROM formatos_documentales WHERE compania_id = %s "
                "AND codigo = %s",
                (compania_id, data["codigo"]),
            )
            existente = cursor.fetchone()
            if existente is not None:
                _de_baja(existente, codigo_cia, data["codigo"], DocumentFormatAlreadyExists)
            comprobante_id = None
            if data["comprobante"]:
                comprobante_id = _comprobante_de_plan(
                    cursor, compania_id, data["comprobante"], DocumentFormatValidationError
                )
            cursor.execute(
                "INSERT INTO formatos_documentales "
                "(compania_id, codigo, nombre, comprobante_id) VALUES (%s, %s, %s, %s) "
                "RETURNING id",
                (compania_id, data["codigo"], data["nombre"], comprobante_id),
            )
            formato_id = int(cursor.fetchone()[0])
            _insertar_elementos(cursor, formato_id, data["elementos"])
            _auditar(
                cursor, compania_id, _usuario_id(cursor, user),
                "Alta de formato documental", "Configuración", data["codigo"], "",
                {"comprobante": data["comprobante"], "elementos": len(data["elementos"])},
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return document_format_item(data)


def update_formato_documental(
    company_code: str, codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica el formato y **reemplaza sus elementos en bloque** (B3.3).

    No hay 409 por uso: el formato es presentación, no dato contable, y reimprimir
    un documento histórico con la geometría vigente no reescribe lo contabilizado.
    """
    from .formatos_documentales_repository import (
        DocumentFormatNotFound, DocumentFormatValidationError, document_format_item,
        normalize_document_format,
    )

    data = normalize_document_format({**payload, "codigo": codigo})
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT id FROM formatos_documentales WHERE compania_id = %s AND codigo = %s "
                "AND eliminado_en IS NULL",
                (compania_id, data["codigo"]),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise DocumentFormatNotFound(
                    f"No existe el formato {codigo} en la compañía {codigo_cia}."
                )
            formato_id = int(fila[0])
            comprobante_id = None
            if data["comprobante"]:
                comprobante_id = _comprobante_de_plan(
                    cursor, compania_id, data["comprobante"], DocumentFormatValidationError
                )
            cursor.execute(
                "UPDATE formatos_documentales SET nombre = %s, comprobante_id = %s WHERE id = %s",
                (data["nombre"], comprobante_id, formato_id),
            )
            # Kardex de reglas: el bloque se reemplaza completo dentro de la transacción.
            cursor.execute("DELETE FROM formato_elementos WHERE formato_id = %s", (formato_id,))
            _insertar_elementos(cursor, formato_id, data["elementos"])
            _auditar(
                cursor, compania_id, _usuario_id(cursor, user),
                "Modificación de formato documental", "Configuración", data["codigo"],
                str(payload.get("motivo") or ""),
                {"comprobante": data["comprobante"], "elementos": len(data["elementos"])},
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return document_format_item(data)


def delete_formato_documental(
    company_code: str, codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Baja lógica del formato (B3.4): marca ``eliminado_en`` y conserva sus elementos.

    Los elementos se conservan por si hay que reimprimir un documento histórico con
    el formato vigente en su fecha; el ``GET`` excluye la cabecera dada de baja.
    """
    from .formatos_documentales_repository import DocumentFormatNotFound
    from .companias_repository import validate_company_reason

    codigo_limpio = str(codigo or "").strip().upper()
    validate_company_reason(reason)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            cursor.execute(
                "SELECT id FROM formatos_documentales WHERE compania_id = %s AND codigo = %s "
                "AND eliminado_en IS NULL",
                (compania_id, codigo_limpio),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise DocumentFormatNotFound(
                    f"No existe el formato {codigo} en la compañía {codigo_cia}."
                )
            formato_id = int(fila[0])
            if not dry_run:
                cursor.execute(
                    "UPDATE formatos_documentales SET eliminado_en = now() WHERE id = %s",
                    (formato_id,),
                )
                _auditar(
                    cursor, compania_id, _usuario_id(cursor, user),
                    "Baja de formato documental", "Configuración", codigo, reason, {},
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "codigo": codigo_limpio,
        "eliminada": not dry_run,
        "bajaLogica": True,
        "referencias": None,
    }
