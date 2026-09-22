"""Plantillas contables (bloque B3, pantalla Plantillas): contrato y rama Advantage.

**Doble motor declarado (R10).** En PostgreSQL la plantilla es propia
(``plantillas_contables`` con ``UNIQUE (compania_id, codigo)``) y sus líneas son
parejas de cuentas en ``plantilla_lineas``; en el legado la plantilla **es** el
bloque de parejas de una fila de ``VISDOCUM`` — el mismo maestro global de tipos
documentales que consume ``/api/tipos-documento``. La ruta acepta ``cia``, la usa
para validar las cuentas contra ``CONMAE`` y declara el alcance con
``sharedAcrossCompanies``.

**Mapeo real, no simulado** (``db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md``
L22-23 y L165-175; ``db/old_db/PLAN_MIGRACION_POSTGRESQL.md`` L130-131, B09):

- ``PLANTICO`` y ``GRABAPLA`` (``DSITAB.PRG:7,157``) son las funciones del legado
  que mantienen las parejas; la tabla es ``VISDOCUM``, que guarda NOM01..NOM08 /
  DEB01..DEB08 / CRE01..CRE08 y además DEB09 / CRE09. El modelo declara la misma
  corrección (``db/postgresql/schema/03_maestros.sql:234-237``): son **parejas de
  cuentas**, no importes fijos.
- ``CONTIDOC`` aparece en la tabla del plan junto a ``VISDOCUM`` porque también es
  configuración documental del legado, pero sus ocho columnas son CODIGO, NOMBRE,
  CONCILIA, HIST, MANEJOC, CONSE, LEEDOC y DCOSTO: **no tiene cuentas**, así que no
  puede guardar líneas. La lectura y la escritura usan ``VISDOCUM``.

**Diferencias del legado que se declaran** (``DICCIONARIO_DEPURADO_CONTABDSI.md``
L388-458), porque no hay columna donde representarlas:

- El legado no tiene catálogo de plantillas propio: ``codigo`` y ``nombre`` son el
  ``CODIGO`` y el ``NOMBRE`` del tipo documental, así que ``tipoDocumento`` siempre
  es igual a ``codigo``, el código ocupa 2 posiciones y el nombre 25. Una petición
  que separe ``codigo`` de ``tipoDocumento`` se rechaza con esa causa, y un código
  ya usado por un tipo documental responde 409 (el espacio de códigos es el mismo).
- El legado guarda **hasta 9 parejas** y no tiene columna de orden: la posición
  (01..09) es el orden. ``NOM09`` no existe, de modo que la novena línea no admite
  ``concepto``; ``NOMxx`` son 20 caracteres.
- ``VISDOCUM`` no tiene ``eliminado_en``: la baja **vacía el bloque de parejas** y
  la fila del tipo documental permanece, que es la razón por la que el código queda
  reservado; se declara con ``bajaLogica: False``.
- El 409 de "plantilla en uso" no se puede reproducir: el legado no persiste de qué
  plantilla salió un lote (``CONMOVI`` y ``MC<lote>`` no referencian el bloque de
  parejas), igual que declaró la parte 1 para tarifas y renglones.
"""

from __future__ import annotations

import re
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_INTEGER,
    ADO_TYPE_VARCHAR,
    CATALOG_ACCOUNT_FILTER,
    CompanyNotFound,
    _boolean,
    _company_exists,
    _execute,
    _open_recordset,
    _rows,
    _text,
    ads_connection,
    ads_odbc_connection,
    normalize_company_code,
)
from .auditoria_repository import (
    register_master_creation,
    register_master_deletion,
    register_master_update,
)
from .companias_repository import validate_company_reason
from .lotes_repository import _one
# Patrón de cuenta del contrato de configuración, declarado en el módulo de
# tarifas de IVA y reutilizado por los demás catálogos de B3.
from .tarifas_iva_repository import ACCOUNT_CODE


TEMPLATE_CODE = re.compile(r"^[A-Za-z0-9]{1,10}$")
# ``VISDOCUM.CODIGO`` ocupa 2 posiciones: el código de la plantilla es el mismo
# del tipo documental.
TEMPLATE_LEGACY_CODE = re.compile(r"^[A-Za-z0-9]{1,2}$")
TEMPLATE_DOCUMENT_TYPE = re.compile(r"^[A-Za-z0-9]{1,2}$")
TEMPLATE_NAME_SIZE = 40
# ``VISDOCUM.NOMBRE`` es CHARACTER(25).
TEMPLATE_LEGACY_NAME_SIZE = 25
TEMPLATE_CONCEPT_SIZE = 60
# ``VISDOCUM.NOMxx`` es CHARACTER(20) y sólo existe hasta NOM08.
TEMPLATE_LEGACY_CONCEPT_SIZE = 20
TEMPLATE_MIN_LINES = 2
TEMPLATE_MAX_LINES = 80
# Parejas DEB/CRE01..09; NOM01..08 dan el concepto de la pareja.
TEMPLATE_LEGACY_MAX_LINES = 9
TEMPLATE_LEGACY_NAMED_LINES = 8

TEMPLATE_LEGACY_ORDERS = tuple(range(1, TEMPLATE_LEGACY_MAX_LINES + 1))
TEMPLATE_LEGACY_DEBIT_COLUMNS = tuple(f"DEB{orden:02d}" for orden in TEMPLATE_LEGACY_ORDERS)
TEMPLATE_LEGACY_CREDIT_COLUMNS = tuple(f"CRE{orden:02d}" for orden in TEMPLATE_LEGACY_ORDERS)
TEMPLATE_LEGACY_CONCEPT_COLUMNS = tuple(
    f"NOM{orden:02d}" for orden in range(1, TEMPLATE_LEGACY_NAMED_LINES + 1)
)
TEMPLATE_LEGACY_COLUMNS = (
    "CODIGO",
    "NOMBRE",
    *TEMPLATE_LEGACY_DEBIT_COLUMNS,
    *TEMPLATE_LEGACY_CREDIT_COLUMNS,
    *TEMPLATE_LEGACY_CONCEPT_COLUMNS,
)
TEMPLATE_LEGACY_SELECT = ", ".join(TEMPLATE_LEGACY_COLUMNS)


class TemplateAlreadyExists(RuntimeError):
    """Ya existe una plantilla con el mismo código (el código es la clave)."""


class TemplateNotFound(RuntimeError):
    """No existe la plantilla pedida."""


class TemplateConflict(RuntimeError):
    """La plantilla ya produjo documentos contabilizados."""


class TemplateValidationError(ValueError):
    """La plantilla incumple las reglas de plantillas_contables/VISDOCUM."""


def _orden(value: Any, numero: int) -> int:
    """Orden de la línea: entero no negativo; si falta, el de la posición."""
    if value in (None, ""):
        return numero
    try:
        orden = int(value)
    except (TypeError, ValueError) as exc:
        raise TemplateValidationError(
            f"Línea {numero}: el orden debe ser un entero."
        ) from exc
    if orden < 0:
        raise TemplateValidationError(f"Línea {numero}: el orden no puede ser negativo.")
    return orden


def _template_line(value: Any, numero: int) -> dict[str, Any]:
    """Una pareja de cuentas del contrato: débito, crédito y concepto."""
    if not isinstance(value, dict):
        raise TemplateValidationError(f"Línea {numero}: se esperaba un objeto de línea.")
    debito = str(value.get("cuentaDebito", "") or "").strip()
    credito = str(value.get("cuentaCredito", "") or "").strip()
    if not ACCOUNT_CODE.fullmatch(debito):
        raise TemplateValidationError(
            f"Línea {numero}: la cuenta de débito debe contener hasta 12 dígitos."
        )
    if not debito:
        raise TemplateValidationError(f"Línea {numero}: la cuenta de débito es obligatoria.")
    if not ACCOUNT_CODE.fullmatch(credito):
        raise TemplateValidationError(
            f"Línea {numero}: la cuenta de crédito debe contener hasta 12 dígitos."
        )
    if not credito:
        raise TemplateValidationError(f"Línea {numero}: la cuenta de crédito es obligatoria.")
    concepto = str(value.get("concepto", "") or "").strip()
    if len(concepto) > TEMPLATE_CONCEPT_SIZE:
        raise TemplateValidationError(
            f"Línea {numero}: el concepto admite máximo {TEMPLATE_CONCEPT_SIZE} caracteres."
        )
    return {
        "orden": _orden(value.get("orden"), numero),
        "cuentaDebito": debito,
        "cuentaCredito": credito,
        "concepto": concepto,
    }


def normalize_template(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida y normaliza el contrato de escritura de una plantilla (B3, sección 5)."""
    codigo = str(payload.get("codigo", "") or "").strip().upper()
    if not TEMPLATE_CODE.fullmatch(codigo):
        raise TemplateValidationError(
            "El código de la plantilla debe tener entre 1 y 10 letras o dígitos."
        )
    nombre = str(payload.get("nombre", "") or "").strip()
    if not nombre:
        raise TemplateValidationError("El nombre de la plantilla es obligatorio.")
    if len(nombre) > TEMPLATE_NAME_SIZE:
        raise TemplateValidationError(
            f"El nombre de la plantilla admite máximo {TEMPLATE_NAME_SIZE} caracteres."
        )
    tipo_documento = str(payload.get("tipoDocumento", "") or "").strip().upper()
    if not TEMPLATE_DOCUMENT_TYPE.fullmatch(tipo_documento):
        raise TemplateValidationError(
            "El tipo de documento de la plantilla debe tener entre 1 y 2 letras o dígitos."
        )
    lineas = payload.get("lineas")
    if not isinstance(lineas, (list, tuple)):
        raise TemplateValidationError("La plantilla debe traer su lista de líneas.")
    if not TEMPLATE_MIN_LINES <= len(lineas) <= TEMPLATE_MAX_LINES:
        raise TemplateValidationError(
            f"La plantilla debe tener entre {TEMPLATE_MIN_LINES} y {TEMPLATE_MAX_LINES} "
            "líneas: una sola línea no puede cuadrar."
        )
    return {
        "codigo": codigo,
        "nombre": nombre,
        "tipoDocumento": tipo_documento,
        "lineas": [
            _template_line(linea, numero) for numero, linea in enumerate(lineas, start=1)
        ],
    }


def _sorted_lines(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Líneas en el orden que usará la posición del legado (01..09)."""
    return sorted(data["lineas"], key=lambda linea: linea["orden"])


def template_item(data: dict[str, Any]) -> dict[str, Any]:
    """Elemento devuelto por las rutas de escritura; ecoa el contrato de escritura."""
    return {
        "codigo": data["codigo"],
        "nombre": data["nombre"],
        "tipoDocumento": data["tipoDocumento"],
        "lineas": [
            {
                "orden": linea["orden"],
                "cuentaDebito": linea["cuentaDebito"],
                "cuentaCredito": linea["cuentaCredito"],
                "concepto": linea["concepto"],
            }
            for linea in data["lineas"]
        ],
    }


def _reject_unsupported(data: dict[str, Any]) -> None:
    """Declara lo que el bloque de parejas de ``VISDOCUM`` no puede representar."""
    lineas = _sorted_lines(data)
    if not TEMPLATE_LEGACY_CODE.fullmatch(data["codigo"]):
        raise TemplateValidationError(
            "VISDOCUM admite códigos de máximo 2 caracteres: el código largo solo se "
            "puede usar con PostgreSQL."
        )
    if data["tipoDocumento"] != data["codigo"]:
        raise TemplateValidationError(
            "En el legado la plantilla es el bloque de parejas del tipo documental "
            "(VISDOCUM.CODIGO), así que tipoDocumento debe ser igual a codigo: la "
            "separación entre código de plantilla y tipo documental solo existe en "
            "PostgreSQL."
        )
    if len(data["nombre"]) > TEMPLATE_LEGACY_NAME_SIZE:
        raise TemplateValidationError(
            f"VISDOCUM.NOMBRE admite máximo {TEMPLATE_LEGACY_NAME_SIZE} caracteres."
        )
    if len(lineas) > TEMPLATE_LEGACY_MAX_LINES:
        raise TemplateValidationError(
            f"VISDOCUM guarda máximo {TEMPLATE_LEGACY_MAX_LINES} parejas (DEB/CRE01..09): "
            "una plantilla más larga solo se puede guardar en PostgreSQL."
        )
    for posicion, linea in enumerate(lineas, start=1):
        if len(linea["concepto"]) > TEMPLATE_LEGACY_CONCEPT_SIZE:
            raise TemplateValidationError(
                f"Línea {posicion}: VISDOCUM.NOMxx admite máximo "
                f"{TEMPLATE_LEGACY_CONCEPT_SIZE} caracteres."
            )
        if posicion > TEMPLATE_LEGACY_NAMED_LINES and linea["concepto"]:
            raise TemplateValidationError(
                f"Línea {posicion}: VISDOCUM no tiene NOM09, así que la novena pareja "
                "viaja sin concepto."
            )


def _pairs_from_row(row: dict[str, Any]) -> list[dict[str, Any]]:
    """Parejas ordenadas de una fila de ``VISDOCUM`` (posiciones 01..09)."""
    lineas: list[dict[str, Any]] = []
    for orden in TEMPLATE_LEGACY_ORDERS:
        debito = _text(row.get(f"DEB{orden:02d}"))
        credito = _text(row.get(f"CRE{orden:02d}"))
        concepto = _text(row.get(f"NOM{orden:02d}"))
        if not (debito or credito):
            continue
        lineas.append(
            {
                "orden": orden,
                "cuentaDebito": debito,
                "cuentaCredito": credito,
                "concepto": concepto,
            }
        )
    return lineas


def _template_from_row(row: dict[str, Any]) -> dict[str, Any] | None:
    """Traduce una fila de ``VISDOCUM`` al contrato; ``None`` si no es plantilla.

    Una fila sin parejas es un tipo documental sin plantilla, no una plantilla
    vacía: el legado no distingue las dos cosas y el contrato sí.
    """
    lineas = _pairs_from_row(row)
    if not lineas:
        return None
    codigo = _text(row.get("CODIGO"))
    return {
        "codigo": codigo,
        "nombre": _text(row.get("NOMBRE")),
        # El legado no tiene tipo documental separado: la plantilla es su fila.
        "tipoDocumento": codigo,
        "lineas": lineas,
    }


def _cuenta_afectable(connection: Any, company_id: int, codigo: str, posicion: int) -> None:
    """Cada cuenta de la pareja debe existir y ser afectable (422 con su línea)."""
    cuenta = _one(
        connection,
        "SELECT TOP 1 CODIGO, MTC FROM CONMAE WHERE CIA = ? AND CODIGO = ? "
        f"AND {CATALOG_ACCOUNT_FILTER}",
        [(ADO_TYPE_INTEGER, 0, company_id), (ADO_TYPE_VARCHAR, 12, codigo)],
    )
    if cuenta is None:
        raise TemplateValidationError(
            f"Línea {posicion}: la cuenta {codigo} no existe en el plan de la compañía."
        )
    if not _boolean(cuenta.get("MTC")):
        raise TemplateValidationError(
            f"Línea {posicion}: la cuenta {codigo} no es afectable."
        )


def _validate_accounts(connection: Any, company_id: int, data: dict[str, Any]) -> None:
    """Valida las dos cuentas de cada pareja, en el orden de las posiciones."""
    for posicion, linea in enumerate(_sorted_lines(data), start=1):
        _cuenta_afectable(connection, company_id, linea["cuentaDebito"], posicion)
        _cuenta_afectable(connection, company_id, linea["cuentaCredito"], posicion)


def _pair_values(data: dict[str, Any]) -> dict[str, str]:
    """Bloque de parejas para las columnas DEB/CRE/NOM de ``VISDOCUM``."""
    valores = {columna: "" for columna in TEMPLATE_LEGACY_COLUMNS if columna not in {"CODIGO", "NOMBRE"}}
    for posicion, linea in enumerate(_sorted_lines(data), start=1):
        valores[f"DEB{posicion:02d}"] = linea["cuentaDebito"]
        valores[f"CRE{posicion:02d}"] = linea["cuentaCredito"]
        if posicion <= TEMPLATE_LEGACY_NAMED_LINES:
            valores[f"NOM{posicion:02d}"] = linea["concepto"]
    return valores


def _legacy_parameters(data: dict[str, Any]) -> list[tuple[int, int, Any]]:
    """Parámetros ADODB del bloque completo, en el orden de ``TEMPLATE_LEGACY_COLUMNS``."""
    valores = _pair_values(data)
    sizes = {"CODIGO": 2, "NOMBRE": TEMPLATE_LEGACY_NAME_SIZE}
    for columna in TEMPLATE_LEGACY_DEBIT_COLUMNS + TEMPLATE_LEGACY_CREDIT_COLUMNS:
        sizes[columna] = 12
    for columna in TEMPLATE_LEGACY_CONCEPT_COLUMNS:
        sizes[columna] = TEMPLATE_LEGACY_CONCEPT_SIZE
    parametros: list[tuple[int, int, Any]] = []
    for columna in TEMPLATE_LEGACY_COLUMNS:
        if columna == "CODIGO":
            valor: Any = data["codigo"]
        elif columna == "NOMBRE":
            valor = data["nombre"]
        else:
            valor = valores[columna]
        parametros.append((ADO_TYPE_VARCHAR, sizes[columna], valor))
    return parametros


def _legacy_pair_row(connection: Any, codigo: str) -> dict[str, Any] | None:
    """Fila de ``VISDOCUM`` del código, o ``None`` si no existe."""
    return _one(
        connection,
        f"SELECT TOP 1 {TEMPLATE_LEGACY_SELECT} FROM VISDOCUM WHERE CODIGO = ?",
        [(ADO_TYPE_VARCHAR, 2, codigo)],
    )


def _plantilla_existente(connection: Any, codigo: str) -> dict[str, Any]:
    """Fila de ``VISDOCUM`` que sí es una plantilla (tiene al menos una pareja)."""
    row = _legacy_pair_row(connection, codigo)
    if row is None or _template_from_row(row) is None:
        raise TemplateNotFound(f"No existe la plantilla contable {codigo}.")
    return row


def list_plantillas_contables(cia: str) -> list[dict[str, Any]]:
    """Plantillas del maestro global ``VISDOCUM`` (las filas con parejas)."""
    company_id = normalize_company_code(cia)
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        recordset = _open_recordset(
            connection,
            f"SELECT {TEMPLATE_LEGACY_SELECT} FROM VISDOCUM ORDER BY CODIGO",
        )
        try:
            filas = [_template_from_row(row) for row in _rows(recordset)]
        finally:
            recordset.Close()
    return [fila for fila in filas if fila is not None]


def create_plantilla_contable(
    cia: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea una plantilla en el bloque de parejas de ``VISDOCUM`` (B3.2).

    En el legado la plantilla nace con su tipo documental, porque es la misma fila:
    el código debe estar libre y ser igual a ``tipoDocumento`` (diferencia
    declarada).
    """
    data = normalize_template(payload)
    _reject_unsupported(data)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _legacy_pair_row(connection, data["codigo"]) is not None:
            raise TemplateAlreadyExists(
                f"El código {data['codigo']} ya está usado en VISDOCUM: en el legado la "
                "plantilla comparte el espacio de códigos de los tipos documentales."
            )
        _validate_accounts(connection, company_id, data)
        connection.BeginTrans()
        try:
            _execute(
                connection,
                f"INSERT INTO VISDOCUM ({', '.join(TEMPLATE_LEGACY_COLUMNS)}) "
                f"VALUES ({', '.join('?' for _ in TEMPLATE_LEGACY_COLUMNS)})",
                _legacy_parameters(data),
            )
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    item = template_item(data)
    try:
        register_master_creation(user, "VISDOCUM", data["codigo"], "Alta de plantilla contable")
    except Exception as exc:
        item["advertencia"] = (
            f"La plantilla se creó, pero no fue posible registrar la bitácora: {exc}"
        )
    return item


def update_plantilla_contable(
    cia: str, codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica la plantilla y reemplaza sus parejas en bloque (B3.3).

    El reemplazo en bloque es el mismo kardex que PostgreSQL: se reescribe el
    bloque de parejas completo dentro de la transacción, no posición por posición.
    """
    code = str(codigo or "").strip().upper()
    if not TEMPLATE_CODE.fullmatch(code):
        raise TemplateValidationError(
            "El código de la plantilla debe tener entre 1 y 10 letras o dígitos."
        )
    data = normalize_template({**payload, "codigo": code})
    _reject_unsupported(data)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        _plantilla_existente(connection, code)
        _validate_accounts(connection, company_id, data)
        connection.BeginTrans()
        try:
            _execute(
                connection,
                f"UPDATE VISDOCUM SET {', '.join(f'{column} = ?' for column in TEMPLATE_LEGACY_COLUMNS if column != 'CODIGO')} "
                "WHERE CODIGO = ?",
                [
                    *_legacy_parameters(data)[1:],
                    (ADO_TYPE_VARCHAR, 2, code),
                ],
            )
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    item = template_item(data)
    try:
        register_master_update(user, "VISDOCUM", code, "Modificación de plantilla contable")
    except Exception as exc:
        item["advertencia"] = (
            f"La plantilla se modificó, pero no fue posible registrar la bitácora: {exc}"
        )
    return item


def delete_plantilla_contable(
    cia: str, codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Retira la plantilla vaciando el bloque de parejas de ``VISDOCUM`` (B3.4).

    ``VISDOCUM`` no tiene ``eliminado_en``: la baja vacía DEB/CRE/NOM y la fila del
    tipo documental permanece, de modo que el código sigue reservado. El 409 de
    "plantilla en uso" solo existe en PostgreSQL (diferencia declarada).
    """
    code = str(codigo or "").strip().upper()
    if not TEMPLATE_CODE.fullmatch(code):
        raise TemplateValidationError(
            "El código de la plantilla debe tener entre 1 y 10 letras o dígitos."
        )
    motivo = validate_company_reason(reason)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        _plantilla_existente(connection, code)
        if not dry_run:
            vacio = {columna: "" for columna in TEMPLATE_LEGACY_COLUMNS if columna not in {"CODIGO", "NOMBRE"}}
            sizes = {}
            for columna in TEMPLATE_LEGACY_DEBIT_COLUMNS + TEMPLATE_LEGACY_CREDIT_COLUMNS:
                sizes[columna] = 12
            for columna in TEMPLATE_LEGACY_CONCEPT_COLUMNS:
                sizes[columna] = TEMPLATE_LEGACY_CONCEPT_SIZE
            connection.BeginTrans()
            try:
                _execute(
                    connection,
                    f"UPDATE VISDOCUM SET {', '.join(f'{column} = ?' for column in vacio)} "
                    "WHERE CODIGO = ?",
                    [
                        *((ADO_TYPE_VARCHAR, sizes[columna], "") for columna in vacio),
                        (ADO_TYPE_VARCHAR, 2, code),
                    ],
                )
                connection.CommitTrans()
            except Exception:
                try:
                    connection.RollbackTrans()
                except Exception:
                    pass
                raise
    if not dry_run:
        try:
            register_master_deletion(user, "VISDOCUM", code, motivo)
        except Exception:
            pass
    return {
        "codigo": code,
        "eliminada": not dry_run,
        "bajaLogica": False,
        "referencias": None,
    }
