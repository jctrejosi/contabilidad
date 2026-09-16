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
from .lotes_repository import _one


ThirdPartyState = Literal["todos", "activo", "bloqueado"]
THIRD_CODE = re.compile(r"^[0-9]{1,10}$")
VERIFICATION_WEIGHTS = (71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3)


class ThirdPartyAlreadyExists(RuntimeError):
    """Se intentó crear una identificación que ya existe en FADCLI."""


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
    if email and (email.count("@") != 1 or email.startswith("@") or email.endswith("@")):
        raise ThirdPartyValidationError("Ingrese un correo electrónico válido que contenga @.")
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
