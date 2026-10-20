"""Generación anual de medios (MEDMAG04) sobre tablas compartidas de Advantage.

El ejercicio procede de CONCTR.CTANO. La salida es una única generación vigente
por compañía: CONMAGIT conserva partidas y CONMAGDT suma formato/concepto/tercero.
No se altera MOV01 ni CONTERCE. La sustitución se hace en una transacción y
únicamente para CIA, para no afectar a otras compañías.
"""

from __future__ import annotations

from collections import defaultdict
from time import perf_counter
from typing import Any, Iterator

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_DOUBLE, ADO_TYPE_INTEGER, ADO_TYPE_VARCHAR, CompanyNotFound,
    _boolean, _execute, _number, _open_recordset, _rows, _text,
    ads_odbc_connection, normalize_company_code,
)
from .medios_cuentas_repository import _check_references, _normalize, _row_to_item


class MediosGeneracionError(ValueError):
    """La generación no puede ejecutarse sin perder fidelidad o seguridad."""


def _read(connection: Any, sql: str) -> list[dict[str, Any]]:
    rs = _open_recordset(connection, sql)
    try:
        return list(_rows(rs))
    finally:
        rs.Close()


def _stream(connection: Any, sql: str) -> Iterator[dict[str, Any]]:
    rs = _open_recordset(connection, sql)
    try:
        names = [rs.Fields.Item(i).Name for i in range(rs.Fields.Count)]
        while not rs.EOF:
            columns = rs.GetRows(1000)
            if not columns or not columns[0]:
                break
            yield from (dict(zip(names, values)) for values in zip(*columns))
    finally:
        rs.Close()


def _schema(connection: Any, table: str, required: set[str]) -> None:
    try:
        rs = _open_recordset(connection, f"SELECT TOP 0 * FROM {table}")
        try:
            actual = {rs.Fields.Item(i).Name.upper() for i in range(rs.Fields.Count)}
        finally:
            rs.Close()
    except Exception as exc:
        raise MediosGeneracionError(f"Falta {table} en el diccionario activo.") from exc
    missing = required - actual
    if missing:
        raise MediosGeneracionError(f"{table} necesita los campos {', '.join(sorted(missing))}.")


def _s(row: dict[str, Any], field: str) -> str:
    return _text(row.get(field)).strip()


def _n(row: dict[str, Any], field: str) -> float:
    return _number(row.get(field))


def _key(row: dict[str, Any]) -> tuple[str, str, str, str, str]:
    return (_s(row, "NIT"), _s(row, "TDOCUM"), _s(row, "TIPODOC"),
            _s(row, "TCOMPR"), str(row.get("TFECHA") or ""))


def _sign(value: float, account: str, natural: bool = False) -> float:
    signed = value if account[:1] in "156789" else -value
    return -signed if natural else signed


def _annual_balance(row: dict[str, Any]) -> float:
    """CONSALDO('12'): los créditos ya tienen signo negativo en Advantage."""
    return _n(row, "MSALDO") + sum(
        _n(row, f"MACMDEB{month:02d}") + _n(row, f"MACMCRE{month:02d}")
        for month in range(1, 13)
    )


def _literal(value: str) -> str:
    """Literal SQL escapado para llaves documentales leídas de tablas antiguas."""
    return "'" + value.replace("'", "''") + "'"


def _parameters(values: list[Any]) -> list[tuple[int, int, Any]]:
    result: list[tuple[int, int, Any]] = []
    for value in values:
        if isinstance(value, float):
            result.append((ADO_TYPE_DOUBLE, 0, value))
        elif isinstance(value, int):
            result.append((ADO_TYPE_INTEGER, 0, value))
        else:
            result.append((ADO_TYPE_VARCHAR, max(1, len(str(value))), str(value)))
    return result


def generation_status(cia: str) -> dict[str, Any]:
    company = normalize_company_code(cia)
    with ads_odbc_connection() as connection:
        if not _read(connection, f"SELECT TOP 1 EMPCOD FROM CONEMP WHERE EMPCOD = {company}"):
            raise CompanyNotFound(f"No existe la compañía {company:03d}.")
        year = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
        if not year:
            raise MediosGeneracionError("Configure el año contable activo antes de generar medios.")
        assignments = _read(connection, f"SELECT COUNT(*) AS TOTAL FROM CONMAG3 WHERE CIA = {company}")
        detail = _read(connection, f"SELECT COUNT(*) AS TOTAL FROM CONMAGIT WHERE CIA = {company}")
        totals = _read(connection, f"SELECT COUNT(*) AS TOTAL FROM CONMAGDT WHERE CIA = {company}")
    return {"anio": int(_n(year[0], "CTANO")),
            "asignaciones": int(_n(assignments[0], "TOTAL")),
            "partidas": int(_n(detail[0], "TOTAL")),
            "acumulados": int(_n(totals[0], "TOTAL"))}


def generate_medios(cia: str, mes_inicial: int, mes_final: int) -> dict[str, Any]:
    """Reproduce MEDMAG04G/41/42NN/44 sin borrar resultados de otras CIA.

    Las definiciones se comprueban antes de comenzar la transacción. En
    particular, MODCXP=2 exige XADMAE: jamás se omite esa rama en silencio.
    """
    company = normalize_company_code(cia)
    if not 1 <= mes_inicial <= mes_final <= 12:
        raise MediosGeneracionError("Seleccione un rango de meses entre 01 y 12.")
    started = perf_counter()
    with accounting_write_lock, ads_odbc_connection(no_table_cache=True) as connection:
        if not _read(connection, f"SELECT TOP 1 EMPCOD FROM CONEMP WHERE EMPCOD = {company}"):
            raise CompanyNotFound(f"No existe la compañía {company:03d}.")
        control = _read(connection, "SELECT TOP 1 CTANO FROM CONCTR")
        year = int(_n(control[0], "CTANO")) if control else 0
        if year < 1900:
            raise MediosGeneracionError("Configure el año contable activo antes de generar medios.")
        _schema(connection, "CONMAGIT", {"CIA", "FORMATO", "CONCEPTO", "NIT", "TVALOR", "TINCON"})
        _schema(connection, "CONMAGDT", {"CIA", "FORMATO", "CONCEPTO", "TERCERO", "TERCERO2", "VALOR1"})
        definitions = _read(connection, f"SELECT * FROM CONMAG3 WHERE CIA = {company} ORDER BY CUENTA, FORMATO, CONCEPTO, CUENTA2")
        if not definitions:
            raise MediosGeneracionError("No hay cuentas asignadas a medios para esta compañía.")
        for definition in definitions:
            normalized = _normalize(_s(definition, "CUENTA"), _row_to_item(definition))
            _check_references(connection, company, normalized)
            column = int(_n(definition, "COLVALOR")) or (1 if int(_n(definition, "TIPOMED")) == 4 else 0)
            if not 1 <= column <= 11:
                raise MediosGeneracionError(f"Revise la columna de la cuenta {_s(definition, 'CUENTA')}.")
            for field in ("COLBASE", "COLUMNA2"):
                value = int(_n(definition, field))
                if value and not 1 <= value <= 11:
                    raise MediosGeneracionError(f"Revise {field} de la cuenta {_s(definition, 'CUENTA')}.")
            if int(_n(definition, "MODCXP")) not in (1, 2, 3) and int(_n(definition, "TIPOMED")) != 4:
                raise MediosGeneracionError(f"La cuenta {_s(definition, 'CUENTA')} tiene una modalidad sin cálculo original.")
            if int(_n(definition, "MODCXP")) == 1 and int(_n(definition, "TIPOMED")) != 4:
                if _s(definition, "CUENTA2") and int(_n(definition, "MOVTIPO")) != 2:
                    raise MediosGeneracionError(f"Seleccione movimiento tipo 2 para cruzar la segunda cuenta de {_s(definition, 'CUENTA')}.")
            if int(_n(definition, "COLUMNA2")) and any(_n(definition, f"PMED{n}") for n in range(1, 7)):
                if not _s(definition, "FORMATO2") or not _s(definition, "CONCEPTO2"):
                    raise MediosGeneracionError(f"Complete el segundo formato y concepto de la cuenta {_s(definition, 'CUENTA')}.")
        if any(int(_n(d, "MODCXP")) == 2 and int(_n(d, "TIPOMED")) != 4 for d in definitions):
            _schema(connection, "XADMAE", {"CCODIGO", "CFACTURA", "CFECFAC", "CVLRBRU", "CVLRIVA"})

        digits = {_s(r, "CCODIGO"): _s(r, "CDIGITO") for r in _stream(connection, "SELECT CCODIGO, CDIGITO FROM FADCLI")}
        cache: dict[tuple[int, str], list[dict[str, Any]]] = {}

        def moves(month: int, account: str) -> list[dict[str, Any]]:
            key = month, account
            if key not in cache:
                # MOV01L: CONCIA, CONANO, CONMES, CODIGO, NIT.
                cache[key] = list(_stream(connection,
                    f"SELECT CODIGO, NIT, TFECHA, TCOMPR, TFASE, TIPODOC, TDOCUM, TDOCUM2, "
                    f"TDETALLE, TVALOR, TBASE FROM MOV01 WHERE CONCIA = {company} "
                    f"AND CONANO = {year} AND CONMES = {month} AND CODIGO = '{account}'"))
            return cache[key]

        xad_cache: dict[tuple[str, str, str], tuple[float, float]] = {}
        detail: list[dict[str, Any]] = []
        totals: dict[tuple[str, str, str, str], dict[str, Any]] = {}

        def add(definition: dict[str, Any], move: dict[str, Any], amount: float,
                column: int, *, second: bool = False, label: str = "",
                detail_column: int | None = None) -> None:
            fmt = _s(definition, "FORMATO2") if second else _s(definition, "FORMATO")
            concept = _s(definition, "CONCEPTO2") if second else _s(definition, "CONCEPTO")
            nit = _s(move, "NIT")
            aggregate_key = fmt, concept, nit, nit
            if aggregate_key not in totals:
                totals[aggregate_key] = {"formato": fmt, "concepto": concept,
                                         "tercero": nit, "tercero2": nit,
                                         "digito": digits.get(nit, "")[:1],
                                         "valores": [0.0] * 11}
            totals[aggregate_key]["valores"][column - 1] += amount
            detail.append({"codigo": _s(move, "CODIGO"), "formato": fmt,
                           "concepto": concept, "nit": nit,
                           "tfecha": int(_n(move, "TFECHA")),
                           "tcompr": _s(move, "TCOMPR"), "tfase": _s(move, "TFASE"),
                           "tipodoc": _s(move, "TIPODOC"), "tdocum": _s(move, "TDOCUM"),
                           "tdocum2": _s(move, "TDOCUM2"),
                           "tdetalle": (label + _s(move, "TDETALLE"))[:105],
                           "tvalor": amount, "tbase": 0.0,
                           "tincon": column if detail_column is None else detail_column})

        for month in range(mes_inicial, mes_final + 1):
            # Harbour marca TTIME por registro, no por documento: dos partidas
            # de la misma factura deben conservarse. Compartimos esta marca
            # entre asignaciones del mes, sin modificar el movimiento original.
            consumed: set[int] = set()
            percentage_field = f"PMED{(month + 1) // 2}"
            for definition in definitions:
                if int(_n(definition, "TIPOMED")) == 4:
                    continue
                account, account2 = _s(definition, "CUENTA"), _s(definition, "CUENTA2")
                mode = int(_n(definition, "MODCXP"))
                movtype = int(_n(definition, "MOVTIPO"))
                column = int(_n(definition, "COLVALOR"))
                base_column = int(_n(definition, "COLBASE")) or 1
                allowed_docs = {_s(definition, f) for f in ("DOCX", "DOCX2", "DOCX3")} - {""}
                primary = moves(month, account)
                secondary = moves(month, account2) if account2 else []
                by_key = defaultdict(list)
                for row in secondary:
                    by_key[_key(row)].append(row)
                if mode == 1 and movtype == 2 and account2:
                    # MOVMEDIOS/MOVTIPO=2: emite la segunda cuenta solo si hay
                    # un movimiento de la primera con la misma llave documental.
                    primary_keys = {_key(row) for row in primary}
                    for row in secondary:
                        key = _key(row)
                        if key not in primary_keys or id(row) in consumed:
                            continue
                        consumed.add(id(row))
                        add(definition, row, _sign(_n(row, "TVALOR"), account2,
                                                   _boolean(definition.get("NATURAL"))), column,
                            detail_column=0)
                    continue
                if mode == 1:
                    percentage = _n(definition, percentage_field)
                    for row in primary:
                        if allowed_docs and _s(row, "TIPODOC") not in allowed_docs:
                            continue
                        value = _sign(_n(row, "TVALOR"), account)
                        if percentage:
                            value = -value
                            main = value * percentage
                            remainder = value - main
                        else:
                            main, remainder = value, 0.0
                        add(definition, row, main, column)
                        if remainder and int(_n(definition, "COLUMNA2")):
                            add(definition, row, remainder,
                                int(_n(definition, "COLUMNA2")), second=True)
                elif mode == 3:
                    for row in primary:
                        if allowed_docs and _s(row, "TIPODOC") not in allowed_docs:
                            continue
                        match = by_key.get(_key(row), [])
                        base = abs(_n(match[0], "TBASE")) if match else 0.0
                        value = _sign(_n(row, "TVALOR"), account)
                        add(definition, row, base, column, label="BASE DESDE RET ")
                        if value != base:
                            add(definition, row, value - base, base_column, label="IVA DESDE RET ")
                else:
                    for row in primary:
                        key = (_s(row, "NIT")[:10], _s(row, "TDOCUM")[:12], str(row.get("TFECHA") or ""))
                        if key not in xad_cache:
                            customer, invoice, _date = key
                            date_int = int(_n(row, "TFECHA"))
                            invoices = _read(connection,
                                f"SELECT CVLRBRU, CVLRIVA FROM XADMAE WHERE CCODIGO = {_literal(customer)} "
                                f"AND CFACTURA = {_literal(invoice)} AND CFECFAC = {date_int}")
                            # MOVMEDCXP sigue buscando mientras el IVA sea cero.
                            invoice_row = next((r for r in invoices if _n(r, "CVLRIVA") != 0), invoices[-1] if invoices else {})
                            xad_cache[key] = _n(invoice_row, "CVLRBRU"), _n(invoice_row, "CVLRIVA")
                        gross, iva = xad_cache[key]
                        value = _sign(_n(row, "TVALOR"), account)
                        if iva and gross + iva == 0:
                            raise MediosGeneracionError(f"La factura {_s(row, 'TDOCUM')} tiene base más IVA igual a cero; revise sus valores antes de generar.")
                        iva_value = value * iva / (gross + iva) if iva else 0.0
                        add(definition, row, value - iva_value, column, label="BASE DESDE CXP ")
                        if iva_value:
                            add(definition, row, iva_value, base_column, label="IVA DESDE CXP ")

        # MEDMAG44/45: saldo de diciembre por tercero. CONTERCE pertenece al
        # ejercicio activo de cada compañía, confirmado por el usuario.
        for definition in definitions:
            if int(_n(definition, "TIPOMED")) != 4:
                continue
            account = _s(definition, "CUENTA")
            column = int(_n(definition, "COLVALOR")) or 1
            fields = [f"MACMDEB{m:02d}" for m in range(1, 13)] + [f"MACMCRE{m:02d}" for m in range(1, 13)]
            for row in _stream(connection, f"SELECT CODIGO, NIT, MSALDO, {', '.join(fields)} FROM CONTERCE WHERE CIA = {company} AND CODIGO = '{account}'"):
                if not _s(row, "NIT"):
                    continue
                balance = _annual_balance(row)
                if balance:
                    add(definition, row, _sign(balance, account), column,
                        detail_column=int(_n(definition, "COLVALOR")))

        # Ninguna escritura ocurre hasta que termina todo el cálculo. El
        # reemplazo de ambas tablas sucede en una misma transacción.
        connection.BeginTrans()
        try:
            _execute(connection, "DELETE FROM CONMAGIT WHERE CIA = ?", _parameters([company]))
            _execute(connection, "DELETE FROM CONMAGDT WHERE CIA = ?", _parameters([company]))
            item_fields = ("CIA", "CODIGO", "FORMATO", "CONCEPTO", "NIT", "TFECHA", "TCOMPR", "TFASE", "TIPODOC", "TDOCUM", "TDOCUM2", "TDETALLE", "TVALOR", "TBASE", "TINCON")
            item_sql = f"INSERT INTO CONMAGIT ({', '.join(item_fields)}) VALUES ({', '.join('?' for _ in item_fields)})"
            for row in detail:
                _execute(connection, item_sql, _parameters([company] + [row[field.lower()] for field in item_fields[1:]]))
            total_fields = ("CIA", "FORMATO", "CONCEPTO", "TERCERO", "TERCERO2", "DIGITO") + tuple(f"VALOR{n}" for n in range(1, 12))
            total_sql = f"INSERT INTO CONMAGDT ({', '.join(total_fields)}) VALUES ({', '.join('?' for _ in total_fields)})"
            for row in totals.values():
                _execute(connection, total_sql, _parameters([company, row["formato"], row["concepto"], row["tercero"], row["tercero2"], row["digito"], *row["valores"]]))
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    return {"anio": year, "mesInicial": mes_inicial, "mesFinal": mes_final,
            "partidas": len(detail), "acumulados": len(totals),
            "segundos": round(perf_counter() - started, 2)}
