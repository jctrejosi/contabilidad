"""Contabilización directa en Advantage Data Server mediante ADO.

Este módulo reproduce el efecto de ``GRAVADIRE``/``ACTUALIZAR(9)`` del
proyecto Harbour sobre el diccionario consolidado actual:

* ``VISDOCUM`` reserva el consecutivo del tipo documental.
* ``MOV01`` recibe una fila por partida y conserva compañía/año/mes.
* ``CONMAE`` acumula débitos y créditos en la cuenta y sus padres.
* ``CONTERCE`` acumula la cuenta exacta por NIT cuando maneja tercero.
* ``COCENTRO`` acumula los movimientos que manejan centro de costo.
* ``CONDOCUM`` recibe una cabecera por documento contabilizado.

Las seis operaciones se ejecutan en una única transacción ADO. El modo de
prueba recorre exactamente el mismo flujo, pero finaliza con ``RollbackTrans``
para poder verificar una instalación sin dejar asientos contables.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Iterable

import win32com.client

from .ads_repository import (
    ADO_COMMAND_TEXT,
    ADO_PARAMETER_INPUT,
    ADO_TYPE_BOOLEAN,
    ADO_TYPE_DOUBLE,
    ADO_TYPE_INTEGER,
    ADO_TYPE_VARCHAR,
    CATALOG_ACCOUNT_FILTER,
    CompanyNotFound,
    _boolean,
    _execute,
    _number,
    _rows,
    _text,
    ads_connection,
    normalize_company_code,
)
from .auditoria_repository import register_direct_posting
from .accounting_lock import accounting_write_lock


MONEY = Decimal("0.01")
ACCOUNT_LEVELS = (1, 2, 4, 6, 9, 12)


class PostingConflict(RuntimeError):
    """El documento ya fue contabilizado o compite por el mismo número."""


class PostingValidationError(ValueError):
    """Los datos no cumplen una regla contable del sistema original."""


def get_accounting_period(company_code: str) -> dict[str, Any]:
    """Devuelve el ejercicio y los meses abiertos que controla ``CONCTR``.

    ``CONCTR`` conserva una sola configuración para el diccionario contable,
    pero primero validamos la compañía solicitada para evitar que la interfaz
    use un período si la sesión perdió o cambió su empresa activa.
    """
    company = normalize_company_code(company_code)
    month_fields = ", ".join(f"CT{month:02d}" for month in range(13))
    with ads_connection() as connection:
        company_row = _one(
            connection,
            "SELECT TOP 1 EMPCOD FROM CONEMP WHERE EMPCOD = ?",
            [(ADO_TYPE_INTEGER, 0, company)],
        )
        if company_row is None:
            raise CompanyNotFound(f"No existe la compañía {company:03d}.")
        control = _one(connection, f"SELECT TOP 1 CTANO, {month_fields} FROM CONCTR", [])

    if control is None:
        raise PostingValidationError("No existe configuración contable en CONCTR.")
    year = int(_number(control.get("CTANO")))
    enabled_months = [
        month for month in range(1, 13) if _boolean(control.get(f"CT{month:02d}"))
    ]
    if not enabled_months:
        raise PostingValidationError(f"CONCTR no tiene meses habilitados para el ejercicio {year}.")
    suggested_month = enabled_months[-1]
    return {
        "anio": year,
        "mesesHabilitados": enabled_months,
        "periodoSugerido": f"{year:04d}-{suggested_month:02d}",
        "fechaSugerida": f"{year:04d}-{suggested_month:02d}-01",
    }


def _money(value: Any) -> Decimal:
    """Normaliza importes a dos decimales antes de comparar o grabar."""
    try:
        result = Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)
    except Exception as exc:
        raise PostingValidationError("Los valores contables deben ser numéricos.") from exc
    if result < 0:
        raise PostingValidationError("Débitos, créditos y bases no pueden ser negativos.")
    return result


def _parameters(command: Any, values: Iterable[tuple[int, int, Any]]) -> None:
    for index, (ado_type, size, value) in enumerate(values):
        command.Parameters.Append(
            command.CreateParameter(f"p{index}", ado_type, ADO_PARAMETER_INPUT, size, value)
        )


def _query_rows(
    connection: Any,
    sql: str,
    parameters: list[tuple[int, int, Any]],
) -> list[dict[str, Any]]:
    """Ejecuta una lectura parametrizada y materializa el Recordset ADO."""
    command = win32com.client.Dispatch("ADODB.Command")
    command.ActiveConnection = connection
    command.CommandType = ADO_COMMAND_TEXT
    command.CommandText = sql
    _parameters(command, parameters)
    recordset, _ = command.Execute()
    try:
        return list(_rows(recordset))
    finally:
        recordset.Close()


def _one(
    connection: Any,
    sql: str,
    parameters: list[tuple[int, int, Any]],
) -> dict[str, Any] | None:
    rows = _query_rows(connection, sql, parameters)
    return rows[0] if rows else None


def _normalize_line(raw: dict[str, Any], number: int, concept: str) -> dict[str, Any]:
    account = str(raw.get("cuenta", "")).strip()
    third_party = str(raw.get("nit", "")).strip()
    cost_center = str(raw.get("centro", "")).strip()
    affected_document = str(raw.get("documentoAfectado", raw.get("docAfectado", ""))).strip()
    debit = _money(raw.get("debito"))
    credit = _money(raw.get("credito"))
    base = _money(raw.get("base"))

    if not account.isdigit() or not 1 <= len(account) <= 12:
        raise PostingValidationError(f"Línea {number}: la cuenta debe tener entre 1 y 12 dígitos.")
    if len(third_party) > 15:
        raise PostingValidationError(f"Línea {number}: el tercero supera 15 caracteres.")
    if len(cost_center) > 7:
        raise PostingValidationError(f"Línea {number}: el centro supera 7 caracteres.")
    if len(affected_document) > 12:
        raise PostingValidationError(f"Línea {number}: el documento afectado supera 12 caracteres.")
    if debit > 0 and credit > 0:
        raise PostingValidationError(f"Línea {number}: no puede tener débito y crédito simultáneamente.")
    if debit == 0 and credit == 0:
        raise PostingValidationError(f"Línea {number}: debe tener un débito o un crédito.")
    return {
        "numero": number,
        "cuenta": account,
        "nit": third_party,
        "centro": cost_center,
        "debito": debit,
        "credito": credit,
        "base": base,
        "documentoAfectado": affected_document,
        # Harbour graba el concepto de cada renglón. En Captura directa la
        # cabecera se replica en todas las partidas para mantener coherencia.
        "concepto": concept,
    }


def _normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    company = normalize_company_code(str(payload.get("cia", "")))
    movement_date = payload.get("fecha")
    if isinstance(movement_date, str):
        try:
            movement_date = date.fromisoformat(movement_date)
        except ValueError as exc:
            raise PostingValidationError("La fecha contable no es válida.") from exc
    if not isinstance(movement_date, date):
        raise PostingValidationError("La fecha contable es obligatoria.")

    voucher = str(payload.get("comprobante", "")).strip().upper()
    document_type = str(payload.get("tipoDocumento", "")).strip().upper()
    document = str(payload.get("numeroDocumento", "")).strip().upper()
    concept = str(payload.get("concepto", "")).strip()
    user = str(payload.get("usuario", "WEB")).strip().upper() or "WEB"
    if not 1 <= len(voucher) <= 2:
        raise PostingValidationError("El comprobante debe tener uno o dos caracteres.")
    if not 1 <= len(document_type) <= 2:
        raise PostingValidationError("El tipo de documento debe tener uno o dos caracteres.")
    if len(document) > 12:
        raise PostingValidationError("El número de documento supera 12 caracteres.")
    if not concept:
        raise PostingValidationError("El concepto general es obligatorio.")
    if len(concept) > 50:
        raise PostingValidationError("El concepto general no puede superar 50 caracteres.")
    if len(user) > 4:
        raise PostingValidationError("El código de usuario no puede superar 4 caracteres.")

    raw_lines = payload.get("lineas")
    if not isinstance(raw_lines, list) or len(raw_lines) < 2:
        raise PostingValidationError("El documento debe contener al menos dos partidas.")
    lines = [_normalize_line(raw, index, concept) for index, raw in enumerate(raw_lines, 1)]
    total_debit = sum((line["debito"] for line in lines), Decimal(0))
    total_credit = sum((line["credito"] for line in lines), Decimal(0))
    if total_debit <= 0 or total_debit != total_credit:
        raise PostingValidationError(
            f"El documento está descuadrado: débitos {total_debit} y créditos {total_credit}."
        )
    return {
        "cia": company,
        "fecha": movement_date,
        "anio": movement_date.year,
        "mes": movement_date.month,
        "comprobante": voucher,
        "tipoDocumento": document_type,
        "numeroDocumento": document,
        "concepto": concept,
        "usuario": user,
        "lineas": lines,
        "totalDebito": total_debit,
        "totalCredito": total_credit,
    }


def _validate_company_and_period(connection: Any, data: dict[str, Any]) -> None:
    company = _one(
        connection,
        "SELECT TOP 1 EMPCOD FROM CONEMP WHERE EMPCOD = ?",
        [(ADO_TYPE_INTEGER, 0, data["cia"])],
    )
    if company is None:
        raise CompanyNotFound(f"No existe la compañía {data['cia']:03d}.")

    # CONCTR es la configuración del ejercicio actualmente abierto en este
    # diccionario. Al igual que HABIMES() en Harbour, CTxx controla cada mes.
    month_field = f"CT{data['mes']:02d}"
    control = _one(connection, f"SELECT TOP 1 CTANO, {month_field} AS HABILITADO FROM CONCTR", [])
    if control is None:
        raise PostingValidationError("No existe configuración contable en CONCTR.")
    configured_year = int(_number(control.get("CTANO")))
    if configured_year != data["anio"]:
        raise PostingValidationError(
            f"El ejercicio configurado en CONCTR es {configured_year}; no se puede contabilizar en {data['anio']}."
        )
    if not _boolean(control.get("HABILITADO")):
        raise PostingValidationError(
            f"El mes {data['mes']:02d}/{data['anio']} no está habilitado en CONCTR."
        )


def _validate_masters(connection: Any, data: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    voucher = _one(
        connection,
        "SELECT TOP 1 CODIGO FROM CONTICOM WHERE CIA = ? AND CODIGO = ?",
        [(ADO_TYPE_INTEGER, 0, data["cia"]), (ADO_TYPE_VARCHAR, 2, data["comprobante"])],
    )
    if voucher is None:
        raise PostingValidationError("El comprobante no existe en CONTICOM para la compañía activa.")

    document_type = _one(
        connection,
        "SELECT TOP 1 CODIGO, CONSE, MODICONSE, PREFIJO FROM VISDOCUM WHERE CODIGO = ?",
        [(ADO_TYPE_VARCHAR, 2, data["tipoDocumento"])],
    )
    if document_type is None:
        raise PostingValidationError("El tipo de documento no existe en VISDOCUM.")

    validated_lines: list[dict[str, Any]] = []
    for line in data["lineas"]:
        account = _one(
            connection,
            "SELECT TOP 1 CODIGO, MNOMBRE, MTC, MCTAPAGOS, MCOSTOS, MIVA_RET "
            f"FROM CONMAE WHERE CIA = ? AND CODIGO = ? AND {CATALOG_ACCOUNT_FILTER}",
            [(ADO_TYPE_INTEGER, 0, data["cia"]), (ADO_TYPE_VARCHAR, 12, line["cuenta"])],
        )
        if account is None:
            raise PostingValidationError(
                f"Línea {line['numero']}: la cuenta {line['cuenta']} no existe para la compañía."
            )
        if not _boolean(account.get("MTC")):
            raise PostingValidationError(f"Línea {line['numero']}: la cuenta no es afectable.")

        requires_third_party = _boolean(account.get("MCTAPAGOS"))
        requires_cost_center = _boolean(account.get("MCOSTOS"))
        fiscal_type = _text(account.get("MIVA_RET")).upper() or "O"
        third_party_name = ""
        if requires_third_party and not line["nit"]:
            raise PostingValidationError(f"Línea {line['numero']}: la cuenta requiere tercero.")
        if requires_third_party and len(line["nit"]) > 11:
            raise PostingValidationError(
                f"Línea {line['numero']}: CONTERCE admite NIT de máximo 11 caracteres."
            )
        if not requires_third_party and line["nit"]:
            raise PostingValidationError(f"Línea {line['numero']}: la cuenta no maneja tercero.")
        if line["nit"]:
            third_party = _one(
                connection,
                "SELECT TOP 1 CCODIGO, CNOMBRE FROM FADCLI WHERE CCODIGO = ?",
                [(ADO_TYPE_VARCHAR, 15, line["nit"])],
            )
            if third_party is None:
                raise PostingValidationError(f"Línea {line['numero']}: el tercero no existe en FADCLI.")
            third_party_name = _text(third_party.get("CNOMBRE"))

        if requires_cost_center and not line["centro"]:
            raise PostingValidationError(f"Línea {line['numero']}: la cuenta requiere centro de costo.")
        if not requires_cost_center and line["centro"]:
            raise PostingValidationError(f"Línea {line['numero']}: la cuenta no maneja centro de costo.")
        if line["centro"]:
            center = _one(
                connection,
                "SELECT TOP 1 CODIGO FROM CONCECOS WHERE CIA = ? AND CODIGO = ?",
                [(ADO_TYPE_INTEGER, 0, data["cia"]), (ADO_TYPE_VARCHAR, 7, line["centro"])],
            )
            if center is None:
                raise PostingValidationError(f"Línea {line['numero']}: el centro no existe en CONCECOS.")
        if fiscal_type in {"I", "R"} and line["base"] <= 0:
            raise PostingValidationError(f"Línea {line['numero']}: la cuenta fiscal requiere base.")

        validated_lines.append({
            **line,
            "nombreCuenta": _text(account.get("MNOMBRE")),
            "requiereTercero": requires_third_party,
            "requiereCentro": requires_cost_center,
            "tipoFiscal": fiscal_type,
            "nombreTercero": third_party_name,
        })
    return document_type, validated_lines


def _document_number(connection: Any, data: dict[str, Any], document_type: dict[str, Any]) -> str:
    manual = _boolean(document_type.get("MODICONSE"))
    supplied = data["numeroDocumento"]
    if manual:
        if not supplied:
            raise PostingValidationError("VISDOCUM permite consecutivo manual; el número es obligatorio.")
        return supplied

    # UPDATE primero obtiene el bloqueo de escritura de la fila dentro de la
    # transacción. La lectura posterior recibe el consecutivo ya reservado.
    _execute(
        connection,
        "UPDATE VISDOCUM SET CONSE = CONSE + 1 WHERE CODIGO = ?",
        [(ADO_TYPE_VARCHAR, 2, data["tipoDocumento"])],
    )
    updated = _one(
        connection,
        "SELECT TOP 1 CONSE, PREFIJO FROM VISDOCUM WHERE CODIGO = ?",
        [(ADO_TYPE_VARCHAR, 2, data["tipoDocumento"])],
    )
    if updated is None:
        raise PostingValidationError("No fue posible reservar el consecutivo de VISDOCUM.")
    sequence = str(int(_number(updated.get("CONSE"))))
    prefix = _text(updated.get("PREFIJO")).strip()
    if prefix:
        document = prefix + sequence.zfill(12 - len(prefix))
    else:
        document = data["tipoDocumento"] + sequence.zfill(10)
    if len(document) > 12:
        raise PostingValidationError("El consecutivo generado supera la longitud de TDOCUM.")
    return document


def _assert_document_is_new(connection: Any, data: dict[str, Any], document: str) -> None:
    existing = _one(
        connection,
        "SELECT TOP 1 ID FROM CONDOCUM WHERE CIA = ? AND DDOCUM = ? "
        "AND DCOMPRO = ? AND DTIPODOC = ?",
        [
            (ADO_TYPE_INTEGER, 0, data["cia"]),
            (ADO_TYPE_VARCHAR, 12, document),
            (ADO_TYPE_VARCHAR, 2, data["comprobante"]),
            (ADO_TYPE_VARCHAR, 2, data["tipoDocumento"]),
        ],
    )
    if existing is not None:
        raise PostingConflict(f"El documento {document} ya fue contabilizado.")


def _account_prefixes(account: str) -> list[str]:
    """Devuelve los niveles existentes que ACTUMAEXX acumula en CONMAE."""
    return [account[:length] for length in ACCOUNT_LEVELS if length <= len(account)]


def _update_account_balances(connection: Any, data: dict[str, Any], line: dict[str, Any]) -> None:
    month = data["mes"]
    field = f"MACMDEB{month:02d}" if line["debito"] > 0 else f"MACMCRE{month:02d}"
    amount = line["debito"] if line["debito"] > 0 else -line["credito"]
    for account in _account_prefixes(line["cuenta"]):
        _execute(
            connection,
            f"UPDATE CONMAE SET {field} = COALESCE({field}, 0) + ? "
            f"WHERE CIA = ? AND CODIGO = ? AND {CATALOG_ACCOUNT_FILTER}",
            [
                (ADO_TYPE_DOUBLE, 0, float(amount)),
                (ADO_TYPE_INTEGER, 0, data["cia"]),
                (ADO_TYPE_VARCHAR, 12, account),
            ],
        )


def _update_cost_center(connection: Any, data: dict[str, Any], line: dict[str, Any]) -> None:
    if not line["requiereCentro"]:
        return
    field = f"DEB{data['mes']:02d}" if line["debito"] > 0 else f"CRE{data['mes']:02d}"
    amount = line["debito"] if line["debito"] > 0 else -line["credito"]
    existing = _one(
        connection,
        "SELECT TOP 1 ID FROM COCENTRO WHERE CIA = ? AND CODIGO = ? "
        "AND (NIT IS NULL OR NIT = ?) AND CENTRO = ?",
        [
            (ADO_TYPE_INTEGER, 0, data["cia"]),
            (ADO_TYPE_VARCHAR, 12, line["cuenta"]),
            (ADO_TYPE_VARCHAR, 15, " " * 15),
            (ADO_TYPE_VARCHAR, 7, line["centro"]),
        ],
    )
    if existing is None:
        _execute(
            connection,
            f"INSERT INTO COCENTRO (CIA, CODIGO, NIT, CENTRO, {field}) VALUES (?, ?, ?, ?, ?)",
            [
                (ADO_TYPE_INTEGER, 0, data["cia"]),
                (ADO_TYPE_VARCHAR, 12, line["cuenta"]),
                (ADO_TYPE_VARCHAR, 15, " " * 15),
                (ADO_TYPE_VARCHAR, 7, line["centro"]),
                (ADO_TYPE_DOUBLE, 0, float(amount)),
            ],
        )
    else:
        _execute(
            connection,
            f"UPDATE COCENTRO SET {field} = COALESCE({field}, 0) + ? "
            "WHERE CIA = ? AND CODIGO = ? AND (NIT IS NULL OR NIT = ?) AND CENTRO = ?",
            [
                (ADO_TYPE_DOUBLE, 0, float(amount)),
                (ADO_TYPE_INTEGER, 0, data["cia"]),
                (ADO_TYPE_VARCHAR, 12, line["cuenta"]),
                (ADO_TYPE_VARCHAR, 15, " " * 15),
                (ADO_TYPE_VARCHAR, 7, line["centro"]),
            ],
        )


def _update_third_party_balances(connection: Any, data: dict[str, Any], line: dict[str, Any]) -> None:
    """Crea o acumula ``CONTERCE`` para la cuenta exacta y el NIT.

    El reproceso Harbour construye esta tabla agrupando MOVxx por
    ``CODIGO + NIT`` exclusivamente para cuentas con ``MCTAPAGOS``. Por eso
    aquí no se actualizan padres: cada fila representa un auxiliar de tercero.
    """
    if not line["requiereTercero"]:
        return
    field = f"MACMDEB{data['mes']:02d}" if line["debito"] > 0 else f"MACMCRE{data['mes']:02d}"
    amount = line["debito"] if line["debito"] > 0 else -line["credito"]
    existing = _one(
        connection,
        "SELECT TOP 1 ID FROM CONTERCE WHERE CIA = ? AND CODIGO = ? AND NIT = ?",
        [
            (ADO_TYPE_INTEGER, 0, data["cia"]),
            (ADO_TYPE_VARCHAR, 12, line["cuenta"]),
            (ADO_TYPE_VARCHAR, 11, line["nit"]),
        ],
    )
    if existing is None:
        _execute(
            connection,
            f"INSERT INTO CONTERCE (CIA, CODIGO, NIT, MNOMBRE, MCOSTOS, {field}) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            [
                (ADO_TYPE_INTEGER, 0, data["cia"]),
                (ADO_TYPE_VARCHAR, 12, line["cuenta"]),
                (ADO_TYPE_VARCHAR, 11, line["nit"]),
                (ADO_TYPE_VARCHAR, 40, line["nombreTercero"][:40]),
                (ADO_TYPE_BOOLEAN, 0, line["requiereCentro"]),
                (ADO_TYPE_DOUBLE, 0, float(amount)),
            ],
        )
    else:
        _execute(
            connection,
            f"UPDATE CONTERCE SET {field} = COALESCE({field}, 0) + ? "
            "WHERE CIA = ? AND CODIGO = ? AND NIT = ?",
            [
                (ADO_TYPE_DOUBLE, 0, float(amount)),
                (ADO_TYPE_INTEGER, 0, data["cia"]),
                (ADO_TYPE_VARCHAR, 12, line["cuenta"]),
                (ADO_TYPE_VARCHAR, 11, line["nit"]),
            ],
        )


def _insert_movement(connection: Any, data: dict[str, Any], line: dict[str, Any], document: str) -> None:
    numeric_date = int(data["fecha"].strftime("%Y%m%d"))
    value = line["debito"] if line["debito"] > 0 else -line["credito"]
    _execute(
        connection,
        "INSERT INTO MOV01 "
        "(CONCIA, CONANO, CONMES, CODIGO, NIT, NITN, TFECHA, TCOMPR, TFASE, "
        "TIPODOC, TDOCUM, TDOCUM2, TDETALLE, TFECDOC, TVALOR, TBASE, TIVA_RET, TUSUA) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (ADO_TYPE_INTEGER, 0, data["cia"]),
            (ADO_TYPE_DOUBLE, 0, float(data["anio"])),
            (ADO_TYPE_DOUBLE, 0, float(data["mes"])),
            (ADO_TYPE_VARCHAR, 12, line["cuenta"]),
            (ADO_TYPE_VARCHAR, 15, line["nit"]),
            (ADO_TYPE_VARCHAR, 15, line["nit"]),
            (ADO_TYPE_INTEGER, 0, numeric_date),
            (ADO_TYPE_VARCHAR, 6, data["comprobante"]),
            (ADO_TYPE_VARCHAR, 7, line["centro"]),
            (ADO_TYPE_VARCHAR, 2, data["tipoDocumento"]),
            (ADO_TYPE_VARCHAR, 12, document),
            (ADO_TYPE_VARCHAR, 12, line["documentoAfectado"]),
            (ADO_TYPE_VARCHAR, 105, line["concepto"]),
            (ADO_TYPE_INTEGER, 0, numeric_date),
            (ADO_TYPE_DOUBLE, 0, float(value)),
            (ADO_TYPE_DOUBLE, 0, float(line["base"])),
            (ADO_TYPE_VARCHAR, 1, line["tipoFiscal"]),
            (ADO_TYPE_VARCHAR, 4, data["usuario"]),
        ],
    )


def _insert_header(connection: Any, data: dict[str, Any], document: str, lines: list[dict[str, Any]]) -> None:
    numeric_date = int(data["fecha"].strftime("%Y%m%d"))
    header_nit = next((line["nit"] for line in lines if line["nit"]), "")[:11]
    affected = next((line["documentoAfectado"] for line in lines if line["documentoAfectado"]), "")
    _execute(
        connection,
        "INSERT INTO CONDOCUM "
        "(CIA, DDOCUM, DDOCUMI, DNIT, DCOMPRO, DTIPODOC, DFECHA, DDETALLE, DVALOR, DMODULO, DDOCUM2) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (ADO_TYPE_INTEGER, 0, data["cia"]),
            (ADO_TYPE_VARCHAR, 12, document),
            (ADO_TYPE_VARCHAR, 12, document),
            (ADO_TYPE_VARCHAR, 11, header_nit),
            (ADO_TYPE_VARCHAR, 2, data["comprobante"]),
            (ADO_TYPE_VARCHAR, 2, data["tipoDocumento"]),
            (ADO_TYPE_INTEGER, 0, numeric_date),
            (ADO_TYPE_VARCHAR, 50, data["concepto"]),
            (ADO_TYPE_DOUBLE, 0, float(data["totalDebito"])),
            (ADO_TYPE_INTEGER, 0, 9),
            (ADO_TYPE_VARCHAR, 12, affected),
        ],
    )


def post_direct_movement(payload: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
    """Valida y contabiliza un documento de Captura directa en Advantage."""
    data = _normalize_payload(payload)
    # El candado complementa el bloqueo transaccional de ADS en el despliegue
    # actual de un solo proceso y evita carreras al reservar VISDOCUM.CONSE.
    with accounting_write_lock, ads_connection() as connection:
        _validate_company_and_period(connection, data)
        document_type, lines = _validate_masters(connection, data)
        connection.BeginTrans()
        try:
            document = _document_number(connection, data, document_type)
            _assert_document_is_new(connection, data, document)
            for line in lines:
                _insert_movement(connection, data, line, document)
                _update_cost_center(connection, data, line)
                _update_third_party_balances(connection, data, line)
                _update_account_balances(connection, data, line)
            _insert_header(connection, data, document, lines)
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

    audit_status = "No aplica en prueba"
    audit_warning = ""
    if not dry_run:
        try:
            register_direct_posting(data["usuario"], document)
            audit_status = "Registrada"
        except Exception as exc:
            # El original llama AUDIVIS después del COMMIT. No informamos que
            # la contabilización falló porque el documento ya quedó definitivo
            # y un reintento podría duplicarlo; devolvemos una advertencia.
            audit_status = "Pendiente"
            audit_warning = f"El documento quedó contabilizado, pero VISAUDI no pudo actualizarse: {exc}"

    return {
        "documento": document,
        "comprobante": data["comprobante"],
        "tipoDocumento": data["tipoDocumento"],
        "fecha": data["fecha"].isoformat(),
        "lineas": len(lines),
        "debito": float(data["totalDebito"]),
        "credito": float(data["totalCredito"]),
        "estado": "Validado sin grabar" if dry_run else "Contabilizado",
        "dryRun": dry_run,
        "auditoria": audit_status,
        "advertencia": audit_warning,
    }
