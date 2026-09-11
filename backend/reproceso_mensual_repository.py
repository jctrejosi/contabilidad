"""Revalorización/reproceso mensual sobre el modelo consolidado de Advantage.

La versión Harbour recorría una tabla física MOV01..MOV12 por cada período y
reconstruía en CONMAE tanto la jerarquía de cuentas como los auxiliares por
tercero. El modelo web conserva todos los meses en una sola tabla MOV01:
``CONCIA``, ``CONANO`` y ``CONMES`` identifican el período. Además, los
auxiliares por cuenta y NIT pertenecen ahora a CONTERCE.

Por seguridad el módulo expone dos operaciones: ``simulate_monthly_reprocess``
compara sin escribir, y ``execute_monthly_reprocess`` vuelve a calcular la
fuente y reemplaza los acumulados dentro de una única transacción ADO.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from time import perf_counter
from typing import Any, Iterable

import win32com.client

from .accounting_lock import accounting_write_lock
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
    _open_recordset,
    _rows,
    _text,
    ads_connection,
    ads_odbc_connection,
    normalize_company_code,
)
from .auditoria_repository import register_monthly_reprocess


MONEY = Decimal("0.01")
ACCOUNT_LEVELS = (1, 2, 4, 6, 9, 12)
CONTERCE_ID_CHUNK = 500
CONTERCE_UPDATE_CHUNK = 250
LOOKUP_CHUNK = 500


class MonthlyReprocessValidationError(ValueError):
    """MOV01 o los maestros no permiten reconstruir acumulados confiables."""


@dataclass(frozen=True)
class AccountMaster:
    code: str
    name: str
    requires_third: bool
    requires_cost_center: bool
    current: dict[int, tuple[Decimal, Decimal]]


@dataclass(frozen=True)
class MovementAggregate:
    month: int
    account: str
    nit: str
    debit: Decimal
    credit: Decimal
    records: int


@dataclass
class ReprocessPlan:
    company: int
    company_name: str
    year: int
    month_from: int
    month_to: int
    accounts: dict[str, AccountMaster]
    account_values: dict[tuple[int, str], list[Decimal]]
    third_values: dict[tuple[int, str, str], list[Decimal]]
    third_nonzero_ids: dict[int, list[int]]
    third_existing_ids: dict[tuple[str, str], int]
    third_names: dict[str, str]
    movement_records: int
    debit: Decimal
    credit: Decimal
    differences_conmae: int
    differences_conterce: int
    warnings: list[str]
    errors: list[str]


def _money(value: Any) -> Decimal:
    """Convierte valores ADS a centavos y conserva el signo del crédito."""
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def _sql_money_literal(value: Decimal) -> str:
    """Representa un valor calculado como literal SQL decimal seguro."""
    return format(value.quantize(MONEY, rounding=ROUND_HALF_UP), "f")


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
    """Ejecuta una lectura parametrizada y materializa el Recordset COM."""
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


def _validate_range(year: int, month_from: int, month_to: int) -> None:
    if not 1900 <= int(year) <= 2100:
        raise MonthlyReprocessValidationError("El año del reproceso no es válido.")
    if not 1 <= int(month_from) <= 12 or not 1 <= int(month_to) <= 12:
        raise MonthlyReprocessValidationError("Los meses deben estar entre enero y diciembre.")
    if int(month_from) > int(month_to):
        raise MonthlyReprocessValidationError(
            "El período inicial no puede ser posterior al período final."
        )


def _load_context(
    connection: Any, company: int, year: int, month_from: int, month_to: int,
) -> tuple[str, dict[str, AccountMaster]]:
    company_row = _one(
        connection,
        "SELECT TOP 1 EMPCOD, EMPNOM FROM CONEMP WHERE EMPCOD = ?",
        [(ADO_TYPE_INTEGER, 0, company)],
    )
    if company_row is None:
        raise CompanyNotFound(f"No existe la compañía {company:03d}.")

    control = _one(connection, "SELECT TOP 1 CTANO FROM CONCTR", [])
    if control is None:
        raise MonthlyReprocessValidationError("No existe configuración contable en CONCTR.")
    control_year = int(_number(control.get("CTANO")))
    if control_year != year:
        raise MonthlyReprocessValidationError(
            f"El ejercicio activo en CONCTR es {control_year}; no se puede reprocesar {year}."
        )

    fields = ", ".join(
        field
        for month in range(month_from, month_to + 1)
        for field in (f"MACMDEB{month:02d}", f"MACMCRE{month:02d}")
    )
    rows = _query_rows(
        connection,
        "SELECT CODIGO, MNOMBRE, MCTAPAGOS, MCOSTOS, " + fields + " "
        "FROM CONMAE WHERE CIA = ? AND " + CATALOG_ACCOUNT_FILTER + " ORDER BY CODIGO",
        [(ADO_TYPE_INTEGER, 0, company)],
    )
    accounts: dict[str, AccountMaster] = {}
    for row in rows:
        code = _text(row.get("CODIGO")).strip()
        if not code:
            continue
        accounts[code] = AccountMaster(
            code=code,
            name=_text(row.get("MNOMBRE")).strip(),
            requires_third=_boolean(row.get("MCTAPAGOS")),
            requires_cost_center=_boolean(row.get("MCOSTOS")),
            current={
                month: (
                    _money(row.get(f"MACMDEB{month:02d}")),
                    _money(row.get(f"MACMCRE{month:02d}")),
                )
                for month in range(month_from, month_to + 1)
            },
        )
    return _text(company_row.get("EMPNOM")).strip(), accounts


def _load_aggregates(
    connection: Any, company: int, year: int, month_from: int, month_to: int,
) -> list[MovementAggregate]:
    """Lee el rango indexable de MOV01 y agrupa en memoria.

    Advantage resolvió muy lentamente el GROUP BY parametrizado sobre esta
    instalación. Los filtros son enteros previamente validados y se escriben
    como literales para que ADS aproveche sus índices; ``GetRows`` cruza COM
    una sola vez y Python agrupa únicamente las filas del rango solicitado.
    """
    sql = (
        "SELECT CONMES, CODIGO, NIT, TVALOR FROM MOV01 "
        f"WHERE CONCIA = {company} AND CONANO = {year} "
        f"AND CONMES >= {month_from} AND CONMES <= {month_to} AND TVALOR <> 0"
    )
    recordset = _open_recordset(connection, sql)
    try:
        rows = list(_rows(recordset))
    finally:
        recordset.Close()
    combined: dict[tuple[int, str, str], list[Any]] = {}
    for row in rows:
        key = (
            int(_number(row.get("CONMES"))),
            _text(row.get("CODIGO")).strip(),
            _text(row.get("NIT")).strip(),
        )
        target = combined.setdefault(key, [Decimal("0.00"), Decimal("0.00"), 0])
        amount = _money(row.get("TVALOR"))
        if amount > 0:
            target[0] += amount
        else:
            # Advantage y CONMAE conservan el crédito con signo negativo.
            target[1] += amount
        target[2] += 1

    return [
        MovementAggregate(month, account, nit, values[0], values[1], values[2])
        for (month, account, nit), values in sorted(combined.items())
    ]


def _build_expected_values(
    accounts: dict[str, AccountMaster], aggregates: list[MovementAggregate],
) -> tuple[
    dict[tuple[int, str], list[Decimal]],
    dict[tuple[int, str, str], list[Decimal]],
    list[str],
    list[str],
]:
    """Replica REPROMES: acumula cada movimiento en la cuenta y sus padres."""
    account_values: dict[tuple[int, str], list[Decimal]] = {}
    third_values: dict[tuple[int, str, str], list[Decimal]] = {}
    warnings: set[str] = set()
    errors: set[str] = set()

    for aggregate in aggregates:
        master = accounts.get(aggregate.account)
        if master is None:
            errors.add(f"MOV01 contiene la cuenta {aggregate.account or '(vacía)'} que no existe en CONMAE.")
            continue
        if len(aggregate.account) not in ACCOUNT_LEVELS:
            errors.add(f"La cuenta {aggregate.account} tiene una longitud jerárquica no permitida.")
            continue

        for length in ACCOUNT_LEVELS:
            if length > len(aggregate.account):
                break
            parent = aggregate.account[:length]
            if parent not in accounts:
                warnings.add(
                    f"No existe el nivel {parent} de la cuenta {aggregate.account}; ese padre no se actualizará."
                )
                continue
            value = account_values.setdefault(
                (aggregate.month, parent), [Decimal("0.00"), Decimal("0.00")]
            )
            value[0] += aggregate.debit
            value[1] += aggregate.credit

        if master.requires_third:
            if not aggregate.nit:
                errors.add(f"La cuenta {aggregate.account} exige tercero y MOV01 contiene un NIT vacío.")
            elif len(aggregate.nit) > 11:
                errors.add(
                    f"El NIT {aggregate.nit} de la cuenta {aggregate.account} supera los 11 caracteres de CONTERCE."
                )
            else:
                value = third_values.setdefault(
                    (aggregate.month, aggregate.account, aggregate.nit),
                    [Decimal("0.00"), Decimal("0.00")],
                )
                value[0] += aggregate.debit
                value[1] += aggregate.credit

    return account_values, third_values, sorted(warnings), sorted(errors)


def _load_third_context(
    connection: Any,
    company: int,
    month_from: int,
    month_to: int,
    third_values: dict[tuple[int, str, str], list[Decimal]],
) -> tuple[
    dict[tuple[str, str], dict[int, tuple[Decimal, Decimal]]],
    dict[str, str],
    list[str],
    dict[int, list[int]],
    dict[tuple[str, str], int],
]:
    fields = ", ".join(
        field
        for month in range(month_from, month_to + 1)
        for field in (f"MACMDEB{month:02d}", f"MACMCRE{month:02d}")
    )
    nonzero = " OR ".join(
        condition
        for month in range(month_from, month_to + 1)
        for condition in (
            f"COALESCE(MACMDEB{month:02d}, 0) <> 0",
            f"COALESCE(MACMCRE{month:02d}, 0) <> 0",
        )
    )
    expected_keys = {(account, nit) for _, account, nit in third_values}
    expected_accounts = sorted({account for account, _ in expected_keys})
    account_condition = ""
    if expected_accounts:
        # Los códigos provienen del maestro, pero aun así se escapan antes de
        # formar la lista SQL para no depender de que sean solo numéricos.
        quoted = ",".join(
            "'" + account.replace("'", "''") + "'" for account in expected_accounts
        )
        account_condition = f" OR CODIGO IN ({quoted})"
    recordset = _open_recordset(
        connection,
        "SELECT ID, CODIGO, NIT, MNOMBRE, " + fields
        + f" FROM CONTERCE WHERE CIA = {company} AND (({nonzero}){account_condition})",
    )
    try:
        rows = list(_rows(recordset))
    finally:
        recordset.Close()
    current: dict[tuple[str, str], dict[int, tuple[Decimal, Decimal]]] = {}
    duplicate_counts: dict[tuple[str, str], int] = {}
    existing_ids: dict[tuple[str, str], int] = {}
    nonzero_ids: dict[int, list[int]] = {
        month: [] for month in range(month_from, month_to + 1)
    }
    for row in rows:
        key = (_text(row.get("CODIGO")).strip(), _text(row.get("NIT")).strip())
        row_id = int(_number(row.get("ID")))
        if key in existing_ids and key in expected_keys:
            duplicate_counts[key] = duplicate_counts.get(key, 1) + 1
        if key in expected_keys:
            existing_ids[key] = min(existing_ids.get(key, row_id), row_id)
        row_values: dict[int, tuple[Decimal, Decimal]] = {}
        for month in range(month_from, month_to + 1):
            row_debit = _money(row.get(f"MACMDEB{month:02d}"))
            row_credit = _money(row.get(f"MACMCRE{month:02d}"))
            row_values[month] = (row_debit, row_credit)
            if row_debit != 0 or row_credit != 0:
                nonzero_ids[month].append(row_id)
        if any(debit != 0 or credit != 0 for debit, credit in row_values.values()):
            values = current.setdefault(
                key,
                {month: (Decimal("0.00"), Decimal("0.00")) for month in range(month_from, month_to + 1)},
            )
            for month, (row_debit, row_credit) in row_values.items():
                prior = values[month]
                values[month] = (
                    prior[0] + row_debit,
                    prior[1] + row_credit,
                )

    third_names: dict[str, str] = {}
    for row in rows:
        key = (_text(row.get("CODIGO")).strip(), _text(row.get("NIT")).strip())
        name = _text(row.get("MNOMBRE")).strip()
        if key in expected_keys and name:
            third_names.setdefault(key[1], name)
    missing_nits = {
        nit for account, nit in expected_keys
        if (account, nit) not in existing_ids and nit not in third_names
    }
    # En una instalación nueva pueden faltar miles de auxiliares en CONTERCE.
    # Resolverlos uno por uno contra FADCLI reproduce el principal cuello de
    # botella anterior; se consultan en bloques y cada bloque cruza COM una vez.
    ordered_missing_nits = sorted(missing_nits)
    for offset in range(0, len(ordered_missing_nits), LOOKUP_CHUNK):
        chunk = ordered_missing_nits[offset:offset + LOOKUP_CHUNK]
        quoted = ",".join("'" + nit.replace("'", "''") + "'" for nit in chunk)
        recordset = _open_recordset(
            connection,
            "SELECT CCODIGO, CNOMBRE FROM FADCLI WHERE CCODIGO IN (" + quoted + ")",
        )
        try:
            for row in _rows(recordset):
                third_names[_text(row.get("CCODIGO")).strip()] = _text(
                    row.get("CNOMBRE")
                ).strip()
        finally:
            recordset.Close()
    for nit in ordered_missing_nits:
        third_names.setdefault(nit, "")
    warnings: list[str] = []
    if duplicate_counts:
        warnings.append(
            f"CONTERCE tiene {len(duplicate_counts)} claves cuenta–NIT repetidas con saldo; "
            "el reproceso dejará el acumulado en una sola fila y pondrá las demás en cero."
        )
    return current, third_names, warnings, nonzero_ids, existing_ids


def _difference_counts(
    plan_accounts: dict[str, AccountMaster],
    account_values: dict[tuple[int, str], list[Decimal]],
    current_thirds: dict[tuple[str, str], dict[int, tuple[Decimal, Decimal]]],
    third_values: dict[tuple[int, str, str], list[Decimal]],
    month_from: int,
    month_to: int,
) -> tuple[int, int]:
    account_differences = 0
    for code, master in plan_accounts.items():
        for month in range(month_from, month_to + 1):
            expected = account_values.get((month, code), [Decimal("0.00"), Decimal("0.00")])
            current = master.current[month]
            account_differences += int(current[0] != expected[0])
            account_differences += int(current[1] != expected[1])

    third_differences = 0
    all_third_keys = set(current_thirds) | {(account, nit) for _, account, nit in third_values}
    for account, nit in all_third_keys:
        current_by_month = current_thirds.get((account, nit), {})
        for month in range(month_from, month_to + 1):
            current = current_by_month.get(month, (Decimal("0.00"), Decimal("0.00")))
            expected = third_values.get(
                (month, account, nit), [Decimal("0.00"), Decimal("0.00")]
            )
            third_differences += int(current[0] != expected[0])
            third_differences += int(current[1] != expected[1])
    return account_differences, third_differences


def _build_plan(
    connection: Any, company: int, year: int, month_from: int, month_to: int,
) -> ReprocessPlan:
    company_name, accounts = _load_context(
        connection, company, year, month_from, month_to
    )
    aggregates = _load_aggregates(connection, company, year, month_from, month_to)
    account_values, third_values, warnings, errors = _build_expected_values(accounts, aggregates)
    current_thirds, third_names, third_warnings, third_nonzero_ids, third_existing_ids = _load_third_context(
        connection, company, month_from, month_to, third_values
    )
    warnings.extend(third_warnings)
    if not aggregates:
        warnings.append("MOV01 no contiene movimientos distintos de cero para el rango seleccionado.")
    missing_names = sorted(nit for nit, name in third_names.items() if not name)
    if missing_names:
        warnings.append(
            "No se encontró nombre en FADCLI para: " + ", ".join(missing_names[:10])
        )

    diff_account, diff_third = _difference_counts(
        accounts, account_values, current_thirds, third_values, month_from, month_to
    )
    return ReprocessPlan(
        company=company,
        company_name=company_name,
        year=year,
        month_from=month_from,
        month_to=month_to,
        accounts=accounts,
        account_values=account_values,
        third_values=third_values,
        third_nonzero_ids=third_nonzero_ids,
        third_existing_ids=third_existing_ids,
        third_names=third_names,
        movement_records=sum(item.records for item in aggregates),
        debit=sum((item.debit for item in aggregates), Decimal("0.00")),
        credit=sum((item.credit for item in aggregates), Decimal("0.00")),
        differences_conmae=diff_account,
        differences_conterce=diff_third,
        warnings=warnings,
        errors=sorted(set(errors)),
    )


def _result(
    plan: ReprocessPlan,
    *,
    status: str,
    duration_seconds: float,
    audit: str = "No aplica",
    warning: str = "",
) -> dict[str, Any]:
    account_codes = {code for _, code in plan.account_values}
    third_keys = {(code, nit) for _, code, nit in plan.third_values}
    total_differences = plan.differences_conmae + plan.differences_conterce
    warnings = list(plan.warnings)
    if total_differences == 0 and not plan.errors:
        warnings.append("Los acumulados ya coinciden con MOV01; no es necesario ejecutar nuevamente.")
    return {
        "compania": {"codigo": f"{plan.company:03d}", "nombre": plan.company_name},
        "anio": plan.year,
        "mesDesde": plan.month_from,
        "mesHasta": plan.month_to,
        "registrosMovimiento": plan.movement_records,
        "cuentasProcesadas": len(account_codes),
        "auxiliaresTercero": len(third_keys),
        "debito": float(plan.debit),
        "credito": float(-plan.credit),
        "diferencias": {
            "conmae": plan.differences_conmae,
            "conterce": plan.differences_conterce,
            "total": total_differences,
        },
        "advertencias": warnings,
        "errores": plan.errors,
        "puedeEjecutar": not plan.errors and total_differences > 0,
        "estado": status,
        "duracionSegundos": round(duration_seconds, 2),
        "auditoria": audit,
        "advertenciaAuditoria": warning,
        "fuente": "MOV01",
        "destinos": ["CONMAE", "CONTERCE"],
    }


def simulate_monthly_reprocess(
    company_code: str, year: int, month_from: int, month_to: int,
) -> dict[str, Any]:
    """Compara MOV01 con los acumulados actuales sin modificar Advantage."""
    started_at = perf_counter()
    company = normalize_company_code(company_code)
    _validate_range(year, month_from, month_to)
    with ads_connection() as connection:
        plan = _build_plan(connection, company, int(year), int(month_from), int(month_to))
    return _result(
        plan,
        status="Simulación completada",
        duration_seconds=perf_counter() - started_at,
    )


def _replace_balances(connection: Any, plan: ReprocessPlan) -> None:
    """Reemplaza, no suma, los campos mensuales calculados desde MOV01."""
    for month in range(plan.month_from, plan.month_to + 1):
        debit_field = f"MACMDEB{month:02d}"
        credit_field = f"MACMCRE{month:02d}"
        # Se limpian también auxiliares heredados de CONMAE: en el modelo nuevo
        # la única fuente de acumulados por tercero es CONTERCE.
        _execute(
            connection,
            f"UPDATE CONMAE SET {debit_field} = 0, {credit_field} = 0 WHERE CIA = ?",
            [(ADO_TYPE_INTEGER, 0, plan.company)],
        )
        # Solo se limpian IDs que la simulación encontró con saldo. Agruparlos
        # en listas pequeñas usa el índice primario y evita recorrer las
        # 765.000+ filas históricas de CONTERCE en cada sentencia.
        ids = sorted(set(plan.third_nonzero_ids.get(month, [])))
        for offset in range(0, len(ids), CONTERCE_ID_CHUNK):
            id_list = ",".join(str(row_id) for row_id in ids[offset:offset + CONTERCE_ID_CHUNK])
            connection.Execute(
                f"UPDATE CONTERCE SET {debit_field} = 0, {credit_field} = 0 "
                f"WHERE CIA = {plan.company} AND ID IN ({id_list})"
            )

    for (month, code), (debit, credit) in sorted(plan.account_values.items()):
        _execute(
            connection,
            f"UPDATE CONMAE SET MACMDEB{month:02d} = ?, MACMCRE{month:02d} = ? "
            "WHERE CIA = ? AND CODIGO = ? AND " + CATALOG_ACCOUNT_FILTER,
            [
                (ADO_TYPE_DOUBLE, 0, float(debit)),
                (ADO_TYPE_DOUBLE, 0, float(credit)),
                (ADO_TYPE_INTEGER, 0, plan.company),
                (ADO_TYPE_VARCHAR, 12, code),
            ],
        )

    unique_thirds = sorted({(code, nit) for _, code, nit in plan.third_values})
    third_ids = dict(plan.third_existing_ids)
    for code, nit in unique_thirds:
        if (code, nit) not in third_ids:
            master = plan.accounts[code]
            _execute(
                connection,
                "INSERT INTO CONTERCE (CIA, CODIGO, NIT, MNOMBRE, MCOSTOS) VALUES (?, ?, ?, ?, ?)",
                [
                    (ADO_TYPE_INTEGER, 0, plan.company),
                    (ADO_TYPE_VARCHAR, 12, code),
                    (ADO_TYPE_VARCHAR, 11, nit),
                    (ADO_TYPE_VARCHAR, 40, plan.third_names.get(nit, "")[:40]),
                    (ADO_TYPE_BOOLEAN, 0, master.requires_cost_center),
                ],
            )
            existing = _one(
                connection,
                "SELECT TOP 1 ID FROM CONTERCE WHERE CIA = ? AND CODIGO = ? AND NIT = ? ORDER BY ID",
                [
                    (ADO_TYPE_INTEGER, 0, plan.company),
                    (ADO_TYPE_VARCHAR, 12, code),
                    (ADO_TYPE_VARCHAR, 11, nit),
                ],
            )
            if existing is None:
                raise RuntimeError(f"No fue posible localizar CONTERCE para {code} / {nit}.")
            third_ids[(code, nit)] = int(_number(existing.get("ID")))

    # Un UPDATE individual por auxiliar producía cientos de miles de llamadas
    # ADO y sometía al cliente ACE a una carga que podía terminar en C0000005.
    # CASE permite enviar 250 auxiliares por sentencia conservando el valor
    # particular de cada ID. Los valores son Decimal calculados internamente y
    # los identificadores provienen de CONTERCE, por lo que no se concatena
    # ninguna entrada libre del usuario.
    updates_by_month: dict[int, list[tuple[int, Decimal, Decimal]]] = {}
    for (month, code, nit), (debit, credit) in sorted(plan.third_values.items()):
        updates_by_month.setdefault(month, []).append(
            (third_ids[(code, nit)], debit, credit)
        )
    for month, updates in updates_by_month.items():
        debit_field = f"MACMDEB{month:02d}"
        credit_field = f"MACMCRE{month:02d}"
        for offset in range(0, len(updates), CONTERCE_UPDATE_CHUNK):
            chunk = updates[offset:offset + CONTERCE_UPDATE_CHUNK]
            ids = ",".join(str(row_id) for row_id, _, _ in chunk)
            debit_cases = " ".join(
                f"WHEN {row_id} THEN {_sql_money_literal(debit)}"
                for row_id, debit, _ in chunk
            )
            credit_cases = " ".join(
                f"WHEN {row_id} THEN {_sql_money_literal(credit)}"
                for row_id, _, credit in chunk
            )
            connection.Execute(
                f"UPDATE CONTERCE SET {debit_field} = CASE ID {debit_cases} "
                f"ELSE {debit_field} END, {credit_field} = CASE ID {credit_cases} "
                f"ELSE {credit_field} END WHERE CIA = {plan.company} AND ID IN ({ids})"
            )


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
    """Reconstruye CONMAE/CONTERCE en una transacción o rollback de prueba."""
    started_at = perf_counter()
    company = normalize_company_code(company_code)
    _validate_range(year, month_from, month_to)
    normalized_user = str(user).strip().upper()[:4] or "WEB"
    normalized_reason = str(reason).strip()
    if not dry_run and not normalized_reason:
        raise MonthlyReprocessValidationError("El motivo del reproceso es obligatorio.")
    if len(normalized_reason) > 180:
        raise MonthlyReprocessValidationError("El motivo no puede superar 180 caracteres.")

    # Advantage OLE DB 11.10.0.24 de 64 bits puede mostrar una excepción
    # C0000005 al procesar UPDATE extensos. ADO sobre el driver ODBC instalado
    # evita ese callback defectuoso sin cambiar las reglas ni la transacción.
    with accounting_write_lock, ads_odbc_connection() as connection:
        # Se reconstruye el plan al ejecutar; así no se aplican cifras antiguas
        # si MOV01 cambió después de la simulación mostrada al usuario.
        plan = _build_plan(connection, company, int(year), int(month_from), int(month_to))
        if plan.errors:
            raise MonthlyReprocessValidationError(
                "No se puede ejecutar: " + " ".join(plan.errors[:5])
            )
        if plan.differences_conmae + plan.differences_conterce == 0:
            return _result(
                plan,
                status="Sin cambios",
                duration_seconds=perf_counter() - started_at,
            )
        connection.BeginTrans()
        try:
            _replace_balances(connection, plan)
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
            register_monthly_reprocess(
                normalized_user, year, month_from, month_to, normalized_reason
            )
            audit_status = "Registrada"
        except Exception as exc:
            audit_status = "Pendiente"
            audit_warning = (
                "El reproceso quedó confirmado, pero VISAUDI no pudo actualizarse: " + str(exc)
            )
    return _result(
        plan,
        status="Validado sin grabar" if dry_run else "Reproceso completado",
        duration_seconds=perf_counter() - started_at,
        audit=audit_status,
        warning=audit_warning,
    )
