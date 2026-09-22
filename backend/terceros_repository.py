"""Consultas del maestro global de terceros almacenado en FADCLI.

FADCLI no contiene CIA: el mismo directorio es compartido por todas las
contabilidades. Por su volumen, este repositorio pagina y filtra en Advantage;
nunca carga el archivo completo en memoria ni en el navegador.
"""

from __future__ import annotations

from datetime import date
import re
from typing import Any, Literal

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_DOUBLE,
    ADO_TYPE_INTEGER,
    ADO_TYPE_VARCHAR,
    _execute,
    _number,
    _open_recordset,
    _rows,
    _text,
    ads_connection,
    ads_odbc_connection,
)
from .auditoria_repository import (
    register_third_party_credit_limit,
    register_third_party_deletion,
    register_third_party_import,
    register_third_party_update,
)
from .lotes_repository import _one


ThirdPartyState = Literal["todos", "activo", "bloqueado"]
THIRD_CODE = re.compile(r"^[0-9]{1,10}$")
VERIFICATION_WEIGHTS = (71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3)
# FADCLI.CMOTIVO es CHARACTER(30): el motivo del bloqueo viaja en ese ancho.
THIRD_REASON_SIZE = 30
# FADCLI.CESTADO: `1` activo y los demás estados se presentan como bloqueado
# (docs/maestros/TERCEROS_ADS.md). `2` es el primer bloqueo del legado.
THIRD_PARTY_STATES = {"Activo": 1, "Bloqueado": 2}
# Campos del contrato de escritura de terceros (ThirdPartyCreate más `estado` y
# `motivoBloqueo`). Se declaran aquí —y no en la capa HTTP— para poder validar el
# `mapeo` de la importación sin crear un ciclo de importación con ``app``.
WRITE_FIELDS = frozenset({
    "nit", "digito", "tipoDocumento", "nombre", "nombreComercial", "primerNombre",
    "segundoNombre", "primerApellido", "segundoApellido", "direccion", "codigoCiudad",
    "ciudad", "telefono", "correo", "zona", "cupo", "estado", "motivoBloqueo",
})
# Mínimo que debe cubrir el mapeo para que una fila pueda pasar por GRABCLI2.
IMPORT_REQUIRED_FIELDS = ("nit", "tipoDocumento", "nombre")


class ThirdPartyAlreadyExists(RuntimeError):
    """Se intentó crear una identificación que ya existe en FADCLI."""


class ThirdPartyNotFound(RuntimeError):
    """No existe un tercero con la identificación pedida en el motor activo."""


class ThirdPartyConflict(RuntimeError):
    """La operación choca con los movimientos o el saldo del tercero."""


class ThirdPartyValidationError(ValueError):
    """Los datos del tercero no cumplen las reglas de CLIENTES2/GRABCLI2."""


def _like_literal(value: str) -> str:
    """Escapa texto recibido antes de incorporarlo a una expresión LIKE."""
    return (
        value.replace("'", "''")
        .replace("[", "[[]")
        .replace("%", "[%]")
        .replace("_", "[_]")
    )


def _date_yyyymmdd(value: Any) -> str:
    """Convierte la fecha numérica heredada de FADCLI a ISO para la interfaz."""
    number = int(_number(value))
    text = f"{number:08d}"
    if number <= 0 or len(text) != 8:
        return ""
    return f"{text[:4]}-{text[4:6]}-{text[6:8]}"


def _third_party_from_row(row: dict[str, Any]) -> dict[str, Any]:
    """Mapea únicamente los campos usados por el directorio contable web."""
    document_type = _text(row.get("CTIPDOC"))
    party_type = int(_number(row.get("CTIPOCLI")))
    state = int(_number(row.get("CESTADO")))
    return {
        "nit": _text(row.get("CCODIGO")),
        "digito": _text(row.get("CDIGITO")),
        "nombre": _text(row.get("CNOMBRE")),
        "tipo": "Jurídica" if party_type == 2 or document_type == "31" else "Natural",
        "tipoDoc": document_type,
        "direccion": _text(row.get("CDIREC")),
        "telefono": _text(row.get("CTELEF")),
        "ciudad": _text(row.get("CCIUDAD")),
        "estado": "Activo" if state == 1 else "Bloqueado",
        "motivoBloqueo": _text(row.get("CMOTIVO")) or None,
        "saldo": _number(row.get("CSALDO")),
        "cupo": _number(row.get("CCUPO")),
        "fechaCreacion": _date_yyyymmdd(row.get("CFCHCREA")),
    }


def _where_clause(search: str, state: ThirdPartyState) -> str:
    conditions: list[str] = []
    if search:
        term = _like_literal(search.strip())
        conditions.append(
            f"(CCODIGO LIKE '%{term}%' OR CNOMBRE LIKE '%{term}%' "
            f"OR CCIUDAD LIKE '%{term}%')"
        )
    if state == "activo":
        conditions.append("CESTADO = 1")
    elif state == "bloqueado":
        conditions.append("(CESTADO IS NULL OR CESTADO <> 1)")
    return f" WHERE {' AND '.join(conditions)}" if conditions else ""


def list_third_parties(
    *,
    page: int = 1,
    page_size: int = 100,
    search: str = "",
    state: ThirdPartyState = "todos",
) -> dict[str, Any]:
    """Devuelve una página ordenada por CCODIGO y el total de coincidencias."""
    if page < 1:
        raise ValueError("La página debe ser mayor o igual a 1.")
    if not 1 <= page_size <= 200:
        raise ValueError("El tamaño de página debe estar entre 1 y 200.")
    search = search.strip()
    if len(search) > 60:
        raise ValueError("La búsqueda no puede superar 60 caracteres.")
    if state not in {"todos", "activo", "bloqueado"}:
        raise ValueError("El estado solicitado no es válido.")

    where = _where_clause(search, state)
    start_at = (page - 1) * page_size + 1
    columns = (
        "CCODIGO, CDIGITO, CTIPOCLI, CTIPDOC, CNOMBRE, CDIREC, CTELEF, "
        "CCIUDAD, CESTADO, CMOTIVO, CSALDO, CCUPO, CFCHCREA"
    )
    data_sql = (
        f"SELECT TOP {page_size} START AT {start_at} {columns} "
        f"FROM FADCLI{where} ORDER BY CCODIGO"
    )
    count_sql = f"SELECT COUNT(*) AS TOTAL FROM FADCLI{where}"

    with ads_connection() as connection:
        count_recordset = _open_recordset(connection, count_sql)
        try:
            total_row = next(_rows(count_recordset), {"TOTAL": 0})
            total = int(_number(total_row.get("TOTAL")))
        finally:
            count_recordset.Close()

        data_recordset = _open_recordset(connection, data_sql)
        try:
            items = [_third_party_from_row(row) for row in _rows(data_recordset)]
        finally:
            data_recordset.Close()

    return {
        "items": items,
        "page": page,
        "pageSize": page_size,
        "total": total,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


def _field(payload: dict[str, Any], key: str, label: str, size: int, *, required: bool = False) -> str:
    value = str(payload.get(key, "")).strip()
    if required and not value:
        raise ThirdPartyValidationError(f"{label} es obligatorio.")
    if len(value) > size:
        raise ThirdPartyValidationError(f"{label} admite máximo {size} caracteres.")
    return value


def calculate_verification_digit(code: str) -> str:
    """Replica DIGITOK(): completa a 15 posiciones y aplica sus 15 pesos."""
    if not THIRD_CODE.fullmatch(code):
        raise ThirdPartyValidationError("La identificación debe contener entre 1 y 10 dígitos.")
    weighted_sum = sum(int(digit) * weight for digit, weight in zip(code.zfill(15), VERIFICATION_WEIGHTS))
    remainder = weighted_sum % 11
    return str(remainder if remainder in {0, 1} else 11 - remainder)


def normalize_third_party(payload: dict[str, Any]) -> dict[str, Any]:
    """Normaliza los campos que GRABCLI2 asignaba al crear un tercero."""
    code = _field(payload, "nit", "La identificación", 10, required=True)
    if not THIRD_CODE.fullmatch(code):
        raise ThirdPartyValidationError("La identificación debe contener entre 1 y 10 dígitos.")
    # El usuario no digita este dato: se calcula siempre como DIGITOK() para
    # evitar que una petición externa pueda guardar un dígito inconsistente.
    digit = calculate_verification_digit(code)
    document_type = _field(payload, "tipoDocumento", "El tipo de documento", 2, required=True)
    if document_type not in {"13", "31"}:
        raise ThirdPartyValidationError("El tipo de documento debe ser cédula o NIT.")
    try:
        credit_limit = float(payload.get("cupo") or 0)
    except (TypeError, ValueError) as exc:
        raise ThirdPartyValidationError("El cupo debe ser numérico.") from exc
    if credit_limit < 0:
        raise ThirdPartyValidationError("El cupo no puede ser negativo.")
    name = _field(payload, "nombre", "El nombre o razón social", 60, required=True)
    first_name = _field(payload, "primerNombre", "El primer nombre", 20)
    second_name = _field(payload, "segundoNombre", "El segundo nombre", 20)
    first_surname = _field(payload, "primerApellido", "El primer apellido", 20)
    second_surname = _field(payload, "segundoApellido", "El segundo apellido", 20)
    if document_type != "31":
        if not first_name:
            raise ThirdPartyValidationError("El primer nombre es obligatorio para una persona natural.")
        if not first_surname:
            raise ThirdPartyValidationError("El primer apellido es obligatorio para una persona natural.")
        if not second_surname:
            raise ThirdPartyValidationError("El segundo apellido es obligatorio para una persona natural.")
    email = _field(payload, "correo", "El correo electrónico", 60)
    # H18: el formato se valida en el modelo del backend y no sólo en el modal. El
    # correo, si viene, debe tener un solo `@` y un punto después de él.
    if email and (
        email.count("@") != 1
        or email.startswith("@")
        or email.endswith("@")
        or "." not in email.split("@", 1)[1]
    ):
        raise ThirdPartyValidationError(
            "Ingrese un correo electrónico válido que contenga @ y un punto después."
        )
    return {
        "nit": code,
        "digito": digit,
        "codigoCiudad": _field(payload, "codigoCiudad", "El código de ciudad", 5),
        "nombre": name,
        # En CLIENTES2, NOMOK2 copia la razón social a WSOCIAL cuando el
        # usuario no informa un nombre comercial distinto.
        "nombreComercial": _field(payload, "nombreComercial", "El nombre comercial", 60) or name,
        "primerNombre": first_name,
        "segundoNombre": second_name,
        "primerApellido": first_surname,
        "segundoApellido": second_surname,
        "direccion": _field(payload, "direccion", "La dirección", 25),
        "ciudad": _field(payload, "ciudad", "La ciudad", 12),
        "telefono": _field(payload, "telefono", "El teléfono", 15),
        "correo": email,
        "zona": _field(payload, "zona", "La zona", 2),
        "cupo": credit_limit,
        "tipoDocumento": document_type,
        "tipoPersona": 2 if document_type == "31" else 1,
    }


def _party_code(value: str) -> str:
    """Valida la identificación recibida por la ruta (FADCLI.CCODIGO)."""
    code = str(value or "").strip()
    if not THIRD_CODE.fullmatch(code):
        raise ThirdPartyValidationError("La identificación debe contener entre 1 y 10 dígitos.")
    return code


def _third_party_detail(row: dict[str, Any]) -> dict[str, Any]:
    """Elemento del directorio más los campos que sólo usa la ficha del tercero.

    El `GET` del directorio no expone el correo ni la zona, pero el modal de
    edición los necesita para precargar el formulario que el `PUT` recibe, así
    que viajan en el item de las rutas de escritura sin tocar el listado.
    """
    item = _third_party_from_row(row)
    item["correo"] = _text(row.get("CEMAIL"))
    item["zona"] = _text(row.get("CZONA"))
    return item


def _party_state_and_reason(payload: dict[str, Any]) -> tuple[str, str]:
    """Estado y motivo del contrato de escritura, validados.

    `Bloqueado` exige motivo (es la vía para un tercero que no se puede retirar,
    ver B1.2 de `docs/plan/backend/detalle/maestros.md`). `Activo` limpia el motivo: un
    tercero activo no conserva la causa de un bloqueo anterior.
    """
    estado = str(payload.get("estado") or "Activo").strip()
    motivo = str(payload.get("motivoBloqueo") or "").strip()
    if estado not in THIRD_PARTY_STATES:
        raise ThirdPartyValidationError("El estado debe ser Activo o Bloqueado.")
    if len(motivo) > THIRD_REASON_SIZE:
        raise ThirdPartyValidationError(
            f"El motivo del bloqueo admite máximo {THIRD_REASON_SIZE} caracteres."
        )
    if estado == "Bloqueado" and not motivo:
        raise ThirdPartyValidationError("Indique el motivo del bloqueo.")
    return estado, motivo if estado == "Bloqueado" else ""


def _credit_limit(payload: dict[str, Any]) -> float:
    """Cupo de cartera validado (mismo contrato de ``ThirdPartyCreate.cupo``)."""
    try:
        cupo = float(payload.get("cupo") or 0)
    except (TypeError, ValueError) as exc:
        raise ThirdPartyValidationError("El cupo debe ser numérico.") from exc
    if cupo < 0:
        raise ThirdPartyValidationError("El cupo no puede ser negativo.")
    return round(cupo, 2)


def validate_import_mapping(mapeo: dict[str, str]) -> None:
    """Comprueba que el mapeo confirmado en pantalla cubre el contrato.

    La importación recibe las filas ya normalizadas; el `mapeo` deja en la
    bitácora qué columna del archivo alimentó cada campo. Un mapeo que no cubra
    los campos obligatorios, o que apunte a campos ajenos al contrato, no puede
    producir altas: se rechaza con 422 antes de escribir.
    """
    if not mapeo:
        raise ThirdPartyValidationError("El mapeo de columnas es obligatorio.")
    destinos = {str(destino).strip() for destino in mapeo.values()}
    desconocidos = sorted(destino for destino in destinos if destino and destino not in WRITE_FIELDS)
    if desconocidos:
        raise ThirdPartyValidationError(
            "El mapeo usa campos que no pertenecen al contrato: " + ", ".join(desconocidos) + "."
        )
    faltantes = [campo for campo in IMPORT_REQUIRED_FIELDS if campo not in destinos]
    if faltantes:
        raise ThirdPartyValidationError(
            "El mapeo debe cubrir " + ", ".join(faltantes) + "."
        )


def prepare_import_rows(filas: list[dict[str, Any]]) -> tuple[list[tuple[int, dict[str, Any]]], list[dict[str, Any]]]:
    """Normaliza la importación fila por fila, sin detener el lote.

    Devuelve `(validas, errores)`: cada válida conserva su número de fila en el
    archivo y cada error viaja con la causa y ese mismo número, como pide B1.4.
    El NIT repetido dentro del archivo se rechaza aquí; el que ya existe en el
    motor lo detecta cada implementación, que es la que consulta la tabla.
    """
    if not filas:
        raise ThirdPartyValidationError("La importación debe incluir al menos una fila.")
    validas: list[tuple[int, dict[str, Any]]] = []
    errores: list[dict[str, Any]] = []
    vistos: set[str] = set()
    for fila_numero, fila in enumerate(filas, start=1):
        try:
            data = normalize_third_party(dict(fila))
            estado, motivo = _party_state_and_reason(fila)
        except (ThirdPartyValidationError, TypeError) as exc:
            errores.append({"fila": fila_numero, "detalle": str(exc)})
            continue
        if data["nit"] in vistos:
            errores.append({"fila": fila_numero, "detalle": f"NIT duplicado {data['nit']}"})
            continue
        vistos.add(data["nit"])
        data["estado"] = estado
        data["motivoBloqueo"] = motivo
        validas.append((fila_numero, data))
    return validas, errores


# Columnas que la ficha del tercero lee y escribe en FADCLI.
_PARTY_SELECT = (
    "CCODIGO, CDIGITO, CTIPOCLI, CTIPDOC, CNOMBRE, CDIREC, CTELEF, CCIUDAD, "
    "CESTADO, CMOTIVO, CSALDO, CCUPO, CFCHCREA, CEMAIL, CZONA"
)


def _read_third_party(connection: Any, code: str) -> dict[str, Any]:
    """Fila de la ficha o ``ThirdPartyNotFound`` si no existe."""
    row = _one(
        connection,
        f"SELECT TOP 1 {_PARTY_SELECT} FROM FADCLI WHERE CCODIGO = ?",
        [(ADO_TYPE_VARCHAR, 10, code)],
    )
    if row is None:
        raise ThirdPartyNotFound(f"No existe el tercero {code}.")
    return row


def _third_party_movement_count(connection: Any, code: str) -> int:
    """Partidas del tercero en toda la contabilidad (MOV01 y CONLOTES).

    FADCLI es común a todas las compañías, así que la baja no puede filtrar por
    CIA: un tercero con historia en cualquier contabilidad no se retira.

    El tercero aparece en ``NITN`` en los registros nuevos y en ``NIT`` en parte
    del histórico; por eso se cuentan las dos columnas, como hacen el resto de
    lecturas del libro (``documentos_repository.document_movements``,
    ``informes_adicionales_repository._movement_where``). Mirar solo ``NIT``
    dejaría retirar un tercero con historia real y colgaría su referencia.
    """
    total = 0
    for table in ("MOV01", "CONLOTES"):
        row = _one(
            connection,
            f"SELECT COUNT(*) AS N FROM {table} WHERE NIT = ? OR NITN = ?",
            [(ADO_TYPE_VARCHAR, 15, code), (ADO_TYPE_VARCHAR, 15, code)],
        )
        total += int(_number(row.get("N")) if row else 0)
    return total


def _insert_third_party(
    connection: Any,
    data: dict[str, Any],
    estado: str,
    motivo: str,
    row_id: int,
    created_at: int,
) -> None:
    """Inserta la fila completa de la ficha, como GRABCLI2 en el legado."""
    _execute(
        connection,
        "INSERT INTO FADCLI (CCODIGO, CDIGITO, CCODCIU, CNOMBRE, CSOCIAL, "
        "CNOM1, CNOM2, CAPE1, CAPE2, CDIREC, CCIUDAD, CTELEF, CEMAIL, "
        "CZONA, CCUPO, CTIPDOC, CTIPOCLI, CESTADO, CMOTIVO, CSALDO, CFCHCREA, ID) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (ADO_TYPE_VARCHAR, 10, data["nit"]),
            (ADO_TYPE_VARCHAR, 1, data["digito"]),
            (ADO_TYPE_VARCHAR, 5, data["codigoCiudad"]),
            (ADO_TYPE_VARCHAR, 60, data["nombre"]),
            (ADO_TYPE_VARCHAR, 60, data["nombreComercial"]),
            (ADO_TYPE_VARCHAR, 20, data["primerNombre"]),
            (ADO_TYPE_VARCHAR, 20, data["segundoNombre"]),
            (ADO_TYPE_VARCHAR, 20, data["primerApellido"]),
            (ADO_TYPE_VARCHAR, 20, data["segundoApellido"]),
            (ADO_TYPE_VARCHAR, 25, data["direccion"]),
            (ADO_TYPE_VARCHAR, 12, data["ciudad"]),
            (ADO_TYPE_VARCHAR, 15, data["telefono"]),
            (ADO_TYPE_VARCHAR, 60, data["correo"]),
            (ADO_TYPE_VARCHAR, 2, data["zona"]),
            (ADO_TYPE_DOUBLE, 0, data["cupo"]),
            (ADO_TYPE_VARCHAR, 2, data["tipoDocumento"]),
            (ADO_TYPE_INTEGER, 0, data["tipoPersona"]),
            (ADO_TYPE_INTEGER, 0, THIRD_PARTY_STATES[estado]),
            (ADO_TYPE_VARCHAR, THIRD_REASON_SIZE, motivo),
            (ADO_TYPE_DOUBLE, 0, 0.0),
            (ADO_TYPE_INTEGER, 0, created_at),
            (ADO_TYPE_INTEGER, 0, row_id),
        ],
    )


UPDATABLE_COLUMNS = (
    "CDIGITO", "CNOMBRE", "CSOCIAL", "CNOM1", "CNOM2", "CAPE1", "CAPE2",
    "CDIREC", "CCODCIU", "CCIUDAD", "CTELEF", "CEMAIL", "CZONA", "CCUPO",
    "CTIPDOC", "CTIPOCLI", "CESTADO", "CMOTIVO",
)


def _registration_warning(register: Any, *args: Any) -> str:
    """Ejecuta el registro de la bitácora y devuelve la advertencia si falla.

    La bitácora no puede deshacer una escritura ya confirmada, así que su fallo
    se informa como advertencia en la respuesta (mismo criterio que
    ``anulacion_repository.annul_document``).
    """
    try:
        register(*args)
    except Exception as exc:
        return f"La operación se completó, pero no fue posible registrar la bitácora: {exc}"
    return ""


def update_third_party(
    nit: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica la ficha del tercero conservando su clave (B1.1)."""
    code = _party_code(nit)
    data = normalize_third_party({**payload, "nit": code})
    estado, motivo = _party_state_and_reason(payload)
    with accounting_write_lock, ads_odbc_connection() as connection:
        _read_third_party(connection, code)
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "UPDATE FADCLI SET "
                + ", ".join(f"{column} = ?" for column in UPDATABLE_COLUMNS)
                + " WHERE CCODIGO = ?",
                [
                    (ADO_TYPE_VARCHAR, 1, data["digito"]),
                    (ADO_TYPE_VARCHAR, 60, data["nombre"]),
                    (ADO_TYPE_VARCHAR, 60, data["nombreComercial"]),
                    (ADO_TYPE_VARCHAR, 20, data["primerNombre"]),
                    (ADO_TYPE_VARCHAR, 20, data["segundoNombre"]),
                    (ADO_TYPE_VARCHAR, 20, data["primerApellido"]),
                    (ADO_TYPE_VARCHAR, 20, data["segundoApellido"]),
                    (ADO_TYPE_VARCHAR, 25, data["direccion"]),
                    (ADO_TYPE_VARCHAR, 5, data["codigoCiudad"]),
                    (ADO_TYPE_VARCHAR, 12, data["ciudad"]),
                    (ADO_TYPE_VARCHAR, 15, data["telefono"]),
                    (ADO_TYPE_VARCHAR, 60, data["correo"]),
                    (ADO_TYPE_VARCHAR, 2, data["zona"]),
                    (ADO_TYPE_DOUBLE, 0, data["cupo"]),
                    (ADO_TYPE_VARCHAR, 2, data["tipoDocumento"]),
                    (ADO_TYPE_INTEGER, 0, data["tipoPersona"]),
                    (ADO_TYPE_INTEGER, 0, THIRD_PARTY_STATES[estado]),
                    (ADO_TYPE_VARCHAR, THIRD_REASON_SIZE, motivo),
                    (ADO_TYPE_VARCHAR, 10, code),
                ],
            )
            row = _read_third_party(connection, code)
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    advertencia = _registration_warning(register_third_party_update, user, code)
    item = _third_party_detail(row)
    if advertencia:
        item["advertencia"] = advertencia
    return item


def delete_third_party(
    nit: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Retira el tercero del directorio cuando no tiene historia contable (B1.2).

    En el legado `FADCLI` no tiene bandera de baja: la fila se retira físicamente,
    y por eso mismo la operación exige que el tercero no tenga movimiento en
    **ninguna** contabilidad (el maestro es común a todas).
    """
    code = _party_code(nit)
    motivo = str(reason or "").strip()
    if not 5 <= len(motivo) <= 180:
        raise ThirdPartyValidationError("Indique un motivo de baja entre 5 y 180 caracteres.")
    with accounting_write_lock, ads_odbc_connection() as connection:
        row = _read_third_party(connection, code)
        saldo = round(_number(row.get("CSALDO")), 2)
        movimientos = _third_party_movement_count(connection, code)
        if movimientos or saldo != 0:
            raise ThirdPartyConflict(
                f"El tercero {code} tiene {movimientos} movimiento(s) y saldo {saldo:.2f}; "
                "no se puede retirar del directorio. Bloquéelo en su lugar."
            )
        if not dry_run:
            connection.BeginTrans()
            try:
                _execute(
                    connection,
                    "DELETE FROM FADCLI WHERE CCODIGO = ?",
                    [(ADO_TYPE_VARCHAR, 10, code)],
                )
                connection.CommitTrans()
            except Exception:
                try:
                    connection.RollbackTrans()
                except Exception:
                    pass
                raise
    advertencia = (
        "" if dry_run else _registration_warning(register_third_party_deletion, user, code, motivo)
    )
    item: dict[str, Any] = {
        "nit": code,
        "eliminado": not dry_run,
        "movimientos": movimientos,
        "saldo": saldo,
    }
    if advertencia:
        item["advertencia"] = advertencia
    return item


def update_third_party_credit_limit(
    nit: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Fija el cupo de cartera sin tocar el resto de la ficha (B1.3)."""
    code = _party_code(nit)
    cupo = _credit_limit(payload)
    motivo = str(payload.get("motivo") or "").strip()
    if len(motivo) > 180:
        raise ThirdPartyValidationError("El motivo admite máximo 180 caracteres.")
    with accounting_write_lock, ads_odbc_connection() as connection:
        row = _read_third_party(connection, code)
        saldo = round(_number(row.get("CSALDO")), 2)
        if cupo < saldo:
            raise ThirdPartyConflict(
                f"El cupo {cupo:.2f} no puede ser menor que el saldo {saldo:.2f} del tercero {code}."
            )
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "UPDATE FADCLI SET CCUPO = ? WHERE CCODIGO = ?",
                [(ADO_TYPE_DOUBLE, 0, cupo), (ADO_TYPE_VARCHAR, 10, code)],
            )
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    advertencia = _registration_warning(register_third_party_credit_limit, user, code, cupo, motivo)
    item: dict[str, Any] = {"nit": code, "cupo": cupo, "saldo": saldo}
    if advertencia:
        item["advertencia"] = advertencia
    return item


def import_third_parties(
    payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Alta masiva desde filas ya leídas y mapeadas (B1.4).

    La fila que falla no detiene el lote: se rechaza con su causa y su número de
    fila. Nada se escribe si `dryRun` es verdadero o si ninguna fila es válida.
    """
    archivo = str(payload.get("archivo") or "").strip()
    if not archivo:
        raise ThirdPartyValidationError("Indique el nombre del archivo importado.")
    mapeo = payload.get("mapeo") or {}
    validate_import_mapping(mapeo)
    validas, errores = prepare_import_rows(payload.get("filas") or [])
    creados = 0
    created_at = int(date.today().strftime("%Y%m%d"))
    if validas:
        with accounting_write_lock, ads_odbc_connection() as connection:
            next_row = _one(connection, "SELECT MAX(ID) AS MAX_ID FROM FADCLI", [])
            next_id = int(_number(next_row.get("MAX_ID"))) + 1 if next_row else 1
            connection.BeginTrans()
            try:
                for fila_numero, data in validas:
                    if _one(
                        connection,
                        "SELECT TOP 1 CCODIGO FROM FADCLI WHERE CCODIGO = ?",
                        [(ADO_TYPE_VARCHAR, 10, data["nit"])],
                    ) is not None:
                        errores.append(
                            {"fila": fila_numero, "detalle": f"NIT duplicado {data['nit']}"}
                        )
                        continue
                    _insert_third_party(
                        connection, data, data["estado"], data["motivoBloqueo"], next_id, created_at
                    )
                    next_id += 1
                    creados += 1
                if dry_run:
                    connection.RollbackTrans()
                else:
                    connection.CommitTrans()
            except Exception:
                try:
                    connection.RollbackTrans()
                except Exception:
                    pass
                raise
    errores.sort(key=lambda error: error["fila"])
    advertencia = ""
    if not dry_run:
        detalle = f"{creados} creados y {len(errores)} rechazados desde {archivo}"
        if mapeo:
            detalle += ". Mapeo: " + ", ".join(
                f"{columna}->{campo}" for columna, campo in mapeo.items()
            )
        advertencia = _registration_warning(register_third_party_import, user, archivo, detalle)
    item: dict[str, Any] = {"creados": creados, "rechazados": len(errores), "errores": errores}
    if advertencia:
        item["advertencia"] = advertencia
    return item


def create_third_party(payload: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
    """Crea el tercero activo y con saldo cero como GRABCLI2 en el legado."""
    data = normalize_third_party(payload)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if _one(
            connection,
            "SELECT TOP 1 CCODIGO FROM FADCLI WHERE CCODIGO = ?",
            [(ADO_TYPE_VARCHAR, 10, data["nit"])],
        ) is not None:
            raise ThirdPartyAlreadyExists(f"El tercero {data['nit']} ya existe.")
        next_row = _one(connection, "SELECT MAX(ID) AS MAX_ID FROM FADCLI", [])
        next_id = int(_number(next_row.get("MAX_ID"))) + 1 if next_row else 1
        created_at = int(date.today().strftime("%Y%m%d"))
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "INSERT INTO FADCLI (CCODIGO, CDIGITO, CCODCIU, CNOMBRE, CSOCIAL, "
                "CNOM1, CNOM2, CAPE1, CAPE2, CDIREC, CCIUDAD, CTELEF, CEMAIL, "
                "CZONA, CCUPO, CTIPDOC, CTIPOCLI, CESTADO, CSALDO, CFCHCREA, ID) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (ADO_TYPE_VARCHAR, 10, data["nit"]),
                    (ADO_TYPE_VARCHAR, 1, data["digito"]),
                    (ADO_TYPE_VARCHAR, 5, data["codigoCiudad"]),
                    (ADO_TYPE_VARCHAR, 60, data["nombre"]),
                    (ADO_TYPE_VARCHAR, 60, data["nombreComercial"]),
                    (ADO_TYPE_VARCHAR, 20, data["primerNombre"]),
                    (ADO_TYPE_VARCHAR, 20, data["segundoNombre"]),
                    (ADO_TYPE_VARCHAR, 20, data["primerApellido"]),
                    (ADO_TYPE_VARCHAR, 20, data["segundoApellido"]),
                    (ADO_TYPE_VARCHAR, 25, data["direccion"]),
                    (ADO_TYPE_VARCHAR, 12, data["ciudad"]),
                    (ADO_TYPE_VARCHAR, 15, data["telefono"]),
                    (ADO_TYPE_VARCHAR, 60, data["correo"]),
                    (ADO_TYPE_VARCHAR, 2, data["zona"]),
                    (ADO_TYPE_DOUBLE, 0, data["cupo"]),
                    (ADO_TYPE_VARCHAR, 2, data["tipoDocumento"]),
                    (ADO_TYPE_INTEGER, 0, data["tipoPersona"]),
                    (ADO_TYPE_INTEGER, 0, 1),
                    (ADO_TYPE_DOUBLE, 0, 0.0),
                    (ADO_TYPE_INTEGER, 0, created_at),
                    (ADO_TYPE_INTEGER, 0, next_id),
                ],
            )
            if dry_run:
                connection.RollbackTrans()
            else:
                connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise

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
