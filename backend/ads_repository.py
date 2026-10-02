"""Acceso ADO a Advantage Data Server para el Plan de cuentas.

Este módulo concentra la lógica de persistencia de la primera función migrada
de CONTABDSI. Traduce las filas físicas de ``CONMAE`` al modelo que consume la
interfaz web y protege las operaciones de alta/modificación con transacciones.

Regla heredada esencial: la instalación actual identifica el auxiliar de
tercero mediante ``CONMAE.NITN`` (15 caracteres). Las cuentas del catálogo
maestro pueden guardar este campo como espacios o como ``NULL``; por eso todas
las consultas y escrituras admiten ambas representaciones.
"""

from __future__ import annotations

import os
import re
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from ._win32com import pythoncom, win32com


DEFAULT_ENV_FILE = Path(__file__).with_name(".env")
# Valor físico de NITN usado por esta versión de CONMAE para una cuenta sin
# auxiliar. Advantage también devuelve NULL en algunos registros históricos.
CATALOG_NIT = " " * 15
CATALOG_ACCOUNT_FILTER = f"(NITN IS NULL OR NITN = '{CATALOG_NIT}')"
VALID_LEVELS = {1, 2, 4, 6, 9, 12}
PARENT_LENGTH = {2: 1, 4: 2, 6: 4, 9: 6, 12: 9}
ACCOUNT_CODE = re.compile(r"^[0-9]{1,12}$")
COMPANY_CODE = re.compile(r"^[0-9]{1,3}$")

# Constantes de ADODB. Se nombran aquí para evitar números COM sin contexto.
ADO_OPEN_FORWARD_ONLY = 0
ADO_LOCK_READ_ONLY = 1
ADO_COMMAND_TEXT = 1
ADO_PARAMETER_INPUT = 1
ADO_TYPE_BOOLEAN = 11
ADO_TYPE_DOUBLE = 5
ADO_TYPE_INTEGER = 3
ADO_TYPE_VARCHAR = 200


class AdsConfigurationError(RuntimeError):
    """La configuración local no permite construir una conexión ADS válida."""

    pass


class AccountAlreadyExists(RuntimeError):
    """Se intentó registrar un código que ya existe como cuenta maestra."""

    pass


class AccountNotFound(RuntimeError):
    """No existe una cuenta maestra para el código solicitado."""

    pass


class CompanyNotFound(RuntimeError):
    """El código seleccionado no existe en la tabla maestra CONEMP."""

    pass


def _read_env_file(path: Path) -> dict[str, str]:
    """Lee un archivo KEY=VALUE sencillo sin modificar ``os.environ``."""
    if not path.is_file():
        return {}
    try:
        lines = path.read_text(encoding="utf-8-sig").splitlines()
    except OSError as exc:
        raise AdsConfigurationError("No fue posible leer la configuracion local de ADS.") from exc

    values: dict[str, str] = {}
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        values[key.strip()] = value
    return values


def read_local_env() -> dict[str, str]:
    """Expone los valores de ``backend/.env`` sin tocar ``os.environ``.

    Permite a la capa HTTP consultar banderas locales con la misma precedencia
    que ADS (el entorno del proceso manda sobre el archivo).
    """
    return _read_env_file(DEFAULT_ENV_FILE)


def load_connection_string(
    env_path: Path | None = None,
    environ: dict[str, str] | None = None,
) -> str:
    """Construye la cadena ADO desde la configuración propia del proyecto.

    Las variables del proceso tienen precedencia sobre ``backend/.env``. Esto
    permite usar el mismo código localmente y en un servidor sin almacenar
    credenciales en el repositorio.
    """
    values = _read_env_file(env_path or DEFAULT_ENV_FILE)
    values.update(dict(os.environ) if environ is None else environ)

    full_connection = values.get("ADS_CONNECTION_STRING", "").strip()
    if full_connection:
        if "Advantage.OLEDB" not in full_connection:
            raise AdsConfigurationError("ADS_CONNECTION_STRING no usa el proveedor Advantage OLE DB.")
        return full_connection

    provider = values.get("ADS_PROVIDER", "Advantage.OLEDB.1").strip()
    data_source = values.get("ADS_DATA_SOURCE", "").strip()
    user_id = values.get("ADS_USER_ID", "").strip()
    password = values.get("ADS_PASSWORD", "")
    server_type = values.get("ADS_SERVER_TYPE", "ADS_REMOTE_SERVER").strip()
    required = {
        "ADS_DATA_SOURCE": data_source,
        "ADS_USER_ID": user_id,
        "ADS_PASSWORD": password,
    }
    missing = [key for key, value in required.items() if not value]
    if missing:
        raise AdsConfigurationError(
            "Falta configurar " + ", ".join(missing) + " en backend/.env o en variables de entorno."
        )
    components = [provider, data_source, user_id, password, server_type]
    if any(";" in value or "\r" in value or "\n" in value for value in components):
        raise AdsConfigurationError("La configuracion ADS contiene caracteres no permitidos.")
    return (
        f"Provider={provider};"
        f"Data Source={data_source};"
        f"User ID={user_id};"
        f"Password={password};"
        f"ServerType={server_type};"
    )


def load_odbc_connection_string(
    env_path: Path | None = None,
    environ: dict[str, str] | None = None,
) -> str:
    """Construye ADO sobre el controlador ODBC de Advantage.

    Se usa para operaciones masivas que disparan un defecto conocido de
    ``adsoledb64.dll`` 11.10.0.24. La aplicación continúa utilizando ADODB;
    únicamente cambia el proveedor nativo subyacente de OLE DB a MSDASQL/ODBC.
    """
    values = _read_env_file(env_path or DEFAULT_ENV_FILE)
    values.update(dict(os.environ) if environ is None else environ)
    data_source = values.get("ADS_DATA_SOURCE", "").strip()
    user_id = values.get("ADS_USER_ID", "").strip()
    password = values.get("ADS_PASSWORD", "")
    driver = values.get("ADS_ODBC_DRIVER", "Advantage StreamlineSQL ODBC").strip()
    configured_type = values.get("ADS_SERVER_TYPE", "ADS_REMOTE_SERVER").strip().upper()
    server_types = {
        "ADS_LOCAL_SERVER": "1",
        "ADS_REMOTE_SERVER": "2",
        "ADS_INTERNET_SERVER": "4",
    }.get(configured_type)
    if not data_source or not user_id or not password:
        raise AdsConfigurationError(
            "Falta configurar ADS_DATA_SOURCE, ADS_USER_ID o ADS_PASSWORD para ODBC."
        )
    if server_types is None:
        raise AdsConfigurationError("ADS_SERVER_TYPE no es compatible con Advantage ODBC.")
    if any(";" in value or "\r" in value or "\n" in value for value in (data_source, user_id, password, driver)):
        raise AdsConfigurationError("La configuracion ADS ODBC contiene caracteres no permitidos.")
    return (
        "Provider=MSDASQL.1;"
        f"Driver={{{driver}}};"
        f"DataDirectory={data_source};"
        f"UID={user_id};PWD={password};"
        f"ServerTypes={server_types};DefaultType=Advantage;"
    )


@contextmanager
def ads_connection() -> Iterator[Any]:
    """Abre y cierra una conexión ADODB válida para el hilo actual.

    FastAPI puede ejecutar solicitudes en distintos hilos. COM exige inicializar
    cada hilo con ``CoInitialize`` antes de crear objetos ADODB.
    """
    pythoncom.CoInitialize()
    connection = None
    try:
        connection = win32com.client.Dispatch("ADODB.Connection")
        connection.Open(load_connection_string())
        yield connection
    finally:
        if connection is not None:
            try:
                if connection.State:
                    connection.Close()
            except Exception:
                pass
        pythoncom.CoUninitialize()


@contextmanager
def ads_odbc_connection(*, no_table_cache: bool = False) -> Iterator[Any]:
    """Abre Advantage mediante ADODB + ODBC para escrituras masivas estables.

    El mantenimiento de índices requiere acceso exclusivo a cada tabla. Con
    ``no_table_cache`` el controlador no conserva tablas cerradas por SELECT,
    evitando que nuestras propias verificaciones bloqueen ``sp_Reindex``.
    Las demás operaciones conservan la configuración habitual.
    """
    pythoncom.CoInitialize()
    connection = None
    try:
        connection = win32com.client.Dispatch("ADODB.Connection")
        connection_string = load_odbc_connection_string()
        if no_table_cache:
            connection_string += "MaxTableCloseCache=0;"
        connection.Open(connection_string)
        yield connection
    finally:
        if connection is not None:
            try:
                if connection.State:
                    connection.Close()
            except Exception:
                pass
        pythoncom.CoUninitialize()


def _text(value: Any) -> str:
    if value is None:
        return ""
    # Algunos textos antiguos mezclan dos caracteres OEM con su lectura ANSI.
    return str(value).rstrip().translate({0xA1: "í", 0xA2: "ó"})


def _number(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    return float(value)


def _boolean(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    return str(value).strip().upper() not in {"", "0", "F", "FALSE", "N", "NO"}


def _rows(recordset: Any) -> Iterator[dict[str, Any]]:
    """Convierte un Recordset completo evitando una llamada COM por celda.

    ``Fields.Item(...).Value`` dentro de un ciclo resulta muy costoso: para el
    Plan de cuentas generaba más de cien mil cruces Python/COM. ``GetRows``
    entrega todas las columnas en una sola llamada y devuelve una matriz con
    orientación columna-fila; ``zip`` la transpone al contrato por registro.
    """
    field_names = [recordset.Fields.Item(index).Name for index in range(recordset.Fields.Count)]
    if recordset.EOF:
        return
    columns = recordset.GetRows()
    for values in zip(*columns):
        yield dict(zip(field_names, values))


def _open_recordset(connection: Any, sql: str) -> Any:
    """Abre una consulta de solo lectura y recorrido hacia adelante."""
    recordset = win32com.client.Dispatch("ADODB.Recordset")
    recordset.Open(sql, connection, ADO_OPEN_FORWARD_ONLY, ADO_LOCK_READ_ONLY)
    return recordset


def _execute(connection: Any, sql: str, parameters: list[tuple[int, int, Any]]) -> None:
    """Ejecuta INSERT/UPDATE con parámetros ADODB para no concatenar valores."""
    command = win32com.client.Dispatch("ADODB.Command")
    command.ActiveConnection = connection
    command.CommandType = ADO_COMMAND_TEXT
    command.CommandText = sql
    for index, (ado_type, size, value) in enumerate(parameters):
        parameter = command.CreateParameter(
            f"p{index}", ado_type, ADO_PARAMETER_INPUT, size, value
        )
        command.Parameters.Append(parameter)
    command.Execute()


def normalize_account(payload: dict[str, Any], *, include_code: bool) -> dict[str, Any]:
    """Normaliza y valida los controles editables de una cuenta contable."""
    normalized = {
        "nombre": str(payload.get("nombre", "")).strip(),
        "afectable": bool(payload.get("afectable", False)),
        "requiereTercero": bool(payload.get("requiereTercero", False)),
        "requiereCentro": bool(payload.get("requiereCentro", False)),
        "ajuste": bool(payload.get("ajuste", False)),
        "tipoFiscal": str(payload.get("tipoFiscal", "O")).strip().upper() or "O",
    }
    if "clasificacionCorriente" in payload:
        from .flujo_caja_niif_repository import (
            CashFlowValidationError, normalize_clasificacion_corriente,
        )

        normalized["clasificacionCorriente"] = normalize_clasificacion_corriente(
            payload.get("clasificacionCorriente"), CashFlowValidationError
        )
    if not normalized["nombre"]:
        raise ValueError("El nombre es obligatorio.")
    if len(normalized["nombre"]) > 30:
        raise ValueError("El nombre no puede superar 30 caracteres.")
    if normalized["tipoFiscal"] not in {"O", "I", "R"}:
        raise ValueError("La clasificacion fiscal debe ser O, I o R.")

    if include_code:
        code = str(payload.get("codigo", "")).strip()
        if not ACCOUNT_CODE.fullmatch(code):
            raise ValueError("El codigo debe tener entre 1 y 12 digitos.")
        if len(code) not in VALID_LEVELS:
            raise ValueError("El codigo debe tener 1, 2, 4, 6, 9 o 12 digitos.")
        normalized["codigo"] = code
    return normalized


def parent_code(code: str) -> str | None:
    """Obtiene el código padre de acuerdo con los niveles 1, 2, 4, 6, 9 y 12."""
    length = PARENT_LENGTH.get(len(code))
    return code[:length] if length is not None else None


def normalize_company_code(code: str) -> int:
    """Valida el código visible (por ejemplo 027) y devuelve el CIA numérico."""
    normalized = str(code).strip()
    if not COMPANY_CODE.fullmatch(normalized) or int(normalized) <= 0:
        raise ValueError("El código de compañía debe contener entre 1 y 3 dígitos.")
    return int(normalized)


def _company_from_row(row: dict[str, Any]) -> dict[str, Any]:
    """Mapea CONEMP al contrato usado durante la selección de compañía.

    B3 (R2): se conservan las claves y se **añaden** ``soloConsolidacion`` y
    ``anios``. ``CONEMP`` no tiene columna de consolidación ni tabla de años
    (la compañía es una carpeta de tablas): viajan en su valor por defecto para
    que la forma del JSON no dependa del motor.
    """
    company_id = int(_number(row.get("EMPCOD")))
    return {
        "codigo": f"{company_id:03d}",
        "nombre": _text(row.get("EMPNOM")),
        "nit": _text(row.get("EMPNIT")),
        "habilitada": _boolean(row.get("HABILITA")),
        "soloConsolidacion": False,
        "anios": [],
    }


def list_companies() -> list[dict[str, Any]]:
    """Consulta las compañías disponibles en CONEMP, priorizando la vigente."""
    sql = (
        "SELECT EMPCOD, EMPNOM, EMPNIT, HABILITA FROM CONEMP "
        "ORDER BY HABILITA DESC, EMPCOD DESC"
    )
    with ads_connection() as connection:
        recordset = _open_recordset(connection, sql)
        try:
            return [_company_from_row(row) for row in _rows(recordset)]
        finally:
            recordset.Close()


def _company_exists(connection: Any, company_id: int) -> bool:
    """Evita usar un valor CIA que no tenga registro correspondiente en CONEMP."""
    recordset = _open_recordset(
        connection,
        f"SELECT TOP 1 EMPCOD FROM CONEMP WHERE EMPCOD = {company_id}",
    )
    try:
        return not recordset.EOF
    finally:
        recordset.Close()


def _account_from_row(row: dict[str, Any]) -> dict[str, Any]:
    """Mapea una fila heredada de CONMAE al contrato JSON usado por React."""
    fiscal_type = _text(row.get("MIVA_RET")).upper() or "O"
    movements = []
    for month in range(1, 13):
        suffix = f"{month:02d}"
        movements.append(
            {
                "mes": month,
                "debito": _number(row.get(f"MACMDEB{suffix}")),
                # En Advantage los creditos historicos se almacenan negativos.
                "credito": abs(_number(row.get(f"MACMCRE{suffix}"))),
            }
        )
    code = _text(row.get("CODIGO"))
    return {
        "codigo": code,
        "nombre": _text(row.get("MNOMBRE")),
        "nivel": len(code),
        "afectable": _boolean(row.get("MTC")),
        "requiereTercero": _boolean(row.get("MCTAPAGOS")),
        "requiereCentro": _boolean(row.get("MCOSTOS")),
        "requiereBase": fiscal_type in {"I", "R"},
        "ajuste": _boolean(row.get("MAJUSTE")),
        "clasificacionCorriente": _text(row.get("CTCTABASE")).strip(),
        "claseIVA": "IVA" if fiscal_type == "I" else None,
        "claseRetencion": "Retencion" if fiscal_type == "R" else None,
        "saldoInicial": _number(row.get("MSALDO")),
        "movimientos": movements,
    }


def list_accounts(company_code: str) -> list[dict[str, Any]]:
    """Consulta las cuentas maestras de una CIA y sus acumulados mensuales."""
    company_id = normalize_company_code(company_code)
    monthly_columns = ", ".join(
        f"MACMDEB{month:02d}, MACMCRE{month:02d}" for month in range(1, 13)
    )
    sql = (
        "SELECT CODIGO, MNOMBRE, MTC, MCTAPAGOS, MCOSTOS, MAJUSTE, "
        f"MIVA_RET, MSALDO, CTCTABASE, {monthly_columns} "
        f"FROM CONMAE WHERE CIA = {company_id} AND {CATALOG_ACCOUNT_FILTER} ORDER BY CODIGO"
    )
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {company_code}.")
        recordset = _open_recordset(connection, sql)
        try:
            return [_account_from_row(row) for row in _rows(recordset)]
        finally:
            recordset.Close()


def _catalog_account_exists(connection: Any, company_id: int, code: str) -> bool:
    """Comprueba un código dentro del catálogo maestro de una compañía."""
    # code ya fue validado como numerico, por lo que no puede alterar la consulta.
    recordset = _open_recordset(
        connection,
        f"SELECT TOP 1 CODIGO FROM CONMAE WHERE CIA = {company_id} "
        f"AND CODIGO = '{code}' AND {CATALOG_ACCOUNT_FILTER}",
    )
    try:
        return not recordset.EOF
    finally:
        recordset.Close()


def create_account(company_code: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Crea una cuenta maestra después de validar duplicado y jerarquía."""
    company_id = normalize_company_code(company_code)
    data = normalize_account(payload, include_code=True)
    code = data["codigo"]
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {company_code}.")
        if _catalog_account_exists(connection, company_id, code):
            raise AccountAlreadyExists(f"Ya existe la cuenta {code}.")
        parent = parent_code(code)
        if parent is not None and not _catalog_account_exists(connection, company_id, parent):
            raise ValueError(f"Primero debe existir la cuenta padre {parent}.")
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "INSERT INTO CONMAE "
                "(CIA, CODIGO, NITN, MNOMBRE, MTC, MCTAPAGOS, MCOSTOS, MAJUSTE, MIVA_RET, "
                "CTCTABASE, MSALDO) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (ADO_TYPE_INTEGER, 0, company_id),
                    (ADO_TYPE_VARCHAR, 12, code),
                    (ADO_TYPE_VARCHAR, 15, CATALOG_NIT),
                    (ADO_TYPE_VARCHAR, 30, data["nombre"]),
                    (ADO_TYPE_BOOLEAN, 0, data["afectable"]),
                    (ADO_TYPE_BOOLEAN, 0, data["requiereTercero"]),
                    (ADO_TYPE_BOOLEAN, 0, data["requiereCentro"]),
                    (ADO_TYPE_BOOLEAN, 0, data["ajuste"]),
                    (ADO_TYPE_VARCHAR, 1, data["tipoFiscal"]),
                    (ADO_TYPE_VARCHAR, 30, data.get("clasificacionCorriente") or ""),
                    (ADO_TYPE_DOUBLE, 0, 0.0),
                ],
            )
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    return get_account(company_code, code)


def get_account(company_code: str, code: str) -> dict[str, Any]:
    """Recupera una cuenta maestra y devuelve el mismo contrato que el listado."""
    company_id = normalize_company_code(company_code)
    if not ACCOUNT_CODE.fullmatch(code):
        raise AccountNotFound(f"No existe la cuenta {code}.")
    monthly_columns = ", ".join(
        f"MACMDEB{month:02d}, MACMCRE{month:02d}" for month in range(1, 13)
    )
    sql = (
        "SELECT CODIGO, MNOMBRE, MTC, MCTAPAGOS, MCOSTOS, MAJUSTE, "
        f"MIVA_RET, MSALDO, CTCTABASE, {monthly_columns} FROM CONMAE "
        f"WHERE CIA = {company_id} AND CODIGO = '{code}' AND {CATALOG_ACCOUNT_FILTER}"
    )
    with ads_connection() as connection:
        recordset = _open_recordset(connection, sql)
        try:
            if recordset.EOF:
                raise AccountNotFound(f"No existe la cuenta {code}.")
            return _account_from_row(next(_rows(recordset)))
        finally:
            recordset.Close()


def update_account(company_code: str, code: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Modifica controles de una cuenta sin alterar código, saldos ni acumulados."""
    company_id = normalize_company_code(company_code)
    if not ACCOUNT_CODE.fullmatch(code):
        raise AccountNotFound(f"No existe la cuenta {code}.")
    data = normalize_account(payload, include_code=False)
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {company_code}.")
        if not _catalog_account_exists(connection, company_id, code):
            raise AccountNotFound(f"No existe la cuenta {code}.")
        connection.BeginTrans()
        try:
            # ``clasificacionCorriente`` es aditivo y opcional: cuando no llega
            # (``None``) el UPDATE no toca CTCTABASE y conserva lo que tenía.
            columnas = "MNOMBRE = ?, MTC = ?, MCTAPAGOS = ?, MCOSTOS = ?, MAJUSTE = ?, MIVA_RET = ?"
            parametros = [
                (ADO_TYPE_VARCHAR, 30, data["nombre"]),
                (ADO_TYPE_BOOLEAN, 0, data["afectable"]),
                (ADO_TYPE_BOOLEAN, 0, data["requiereTercero"]),
                (ADO_TYPE_BOOLEAN, 0, data["requiereCentro"]),
                (ADO_TYPE_BOOLEAN, 0, data["ajuste"]),
                (ADO_TYPE_VARCHAR, 1, data["tipoFiscal"]),
            ]
            if data.get("clasificacionCorriente") is not None:
                columnas += ", CTCTABASE = ?"
                parametros.append(
                    (ADO_TYPE_VARCHAR, 30, data["clasificacionCorriente"])
                )
            _execute(
                connection,
                f"UPDATE CONMAE SET {columnas} "
                f"WHERE CIA = {company_id} AND CODIGO = '{code}' AND {CATALOG_ACCOUNT_FILTER}",
                parametros,
            )
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    return get_account(company_code, code)


def check_connection() -> None:
    """Ejecuta una consulta mínima usada por el endpoint de salud."""
    with ads_connection() as connection:
        recordset = _open_recordset(connection, "SELECT TOP 1 CODIGO FROM CONMAE")
        recordset.Close()
