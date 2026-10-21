"""MEDMAG05: revisión de la liquidación, CREAMAG, BORRAMAG y DETAMAG.

CONMAGDT no tiene ID: se usa ROWID de Advantage y una revisión del contenido.
Las escrituras se limitan por CIA y FORMATO, con transacción y comprobación
optimista. Nunca se altera CONMAGIT ni MOV01 al corregir un acumulado manual.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
from decimal import Decimal, InvalidOperation
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_BOOLEAN, ADO_TYPE_DOUBLE, ADO_TYPE_INTEGER, ADO_TYPE_VARCHAR,
    _boolean, _company_exists, _execute, _number, _text, ads_odbc_connection,
    normalize_company_code,
)
from .auditoria_repository import register_master_update
from .documentos_repository import _query_rows
from .medios_conceptos_repository import _code
from .medios_generacion_repository import _schema

VALUES = tuple(f'VALOR{i}' for i in range(1, 12))
FIELDS = ('FORMATO', 'CONCEPTO', 'CUENTA', 'TERCERO', 'TERCERO2', 'DIGITO',
          'SALE', 'MODCXP', 'COLBASE', 'COLIVA', 'CIA') + VALUES
THIRD_FIELDS = 'CCODIGO, CNIT, CNOMBRE, CTIPDOC, CAPE1, CAPE2, CNOM1, CNOM2, CDIREC, CCODCIU, CCODBE'
LOG = logging.getLogger(__name__)


class RevisionConflict(RuntimeError):
    pass


def _params(*values: Any) -> list[tuple[int, int, Any]]:
    return [(ADO_TYPE_INTEGER, 0, value) if isinstance(value, int)
            else (ADO_TYPE_VARCHAR, max(1, len(str(value))), str(value)) for value in values]


def _read(connection: Any, sql: str, *values: Any) -> list[dict[str, Any]]:
    return _query_rows(connection, sql, _params(*values))


def _revision(row: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(row, sort_keys=True, default=str).encode()).hexdigest()


def _context(connection: Any, cia: str, formato: str) -> tuple[int, dict[str, Any]]:
    company = normalize_company_code(cia)
    code = _code(formato, 'El formato')
    if not _company_exists(connection, company):
        raise ValueError('No existe la compañía seleccionada.')
    _schema(connection, 'CONMAGDT', set(FIELDS))
    forms = _read(connection, 'SELECT * FROM CONMAG1 WHERE CODFORMA = ?', code)
    if not forms:
        raise ValueError('El formato seleccionado no existe.')
    return company, forms[0]


def _rows(connection: Any, company: int, formato: str) -> list[dict[str, Any]]:
    return _read(connection, 'SELECT ROWID AS RID, ' + ', '.join(FIELDS)
                 + ' FROM CONMAGDT WHERE CIA = ? AND FORMATO = ? '
                 'ORDER BY CONCEPTO, TERCERO, TERCERO2, ROWID', company, formato)


def _thirds(connection: Any, codes: set[str], *, fallback: bool = False) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    codes.discard('')
    # Una consulta por bloque, no una conexión por cada tercero del informe.
    ordered = sorted(codes)
    for start in range(0, len(ordered), 150):
        chunk = ordered[start:start + 150]
        if not chunk:
            continue
        marks = ','.join('?' for _ in chunk)
        rows = _read(connection, f'SELECT {THIRD_FIELDS} FROM FADCLI WHERE CCODIGO IN ({marks})', *chunk)
        result.update({_text(row.get('CCODIGO')).strip(): row for row in rows})
    if fallback:
        missing = sorted(codes - result.keys())
        for start in range(0, len(missing), 150):
            chunk = missing[start:start + 150]
            marks = ','.join('?' for _ in chunk)
            rows = _read(connection, f'SELECT {THIRD_FIELDS} FROM FADCLI WHERE CNIT IN ({marks}) ORDER BY CCODIGO', *chunk)
            for row in rows:
                result.setdefault(_text(row.get('CNIT')).strip(), row)
    return result


def _item(row: dict[str, Any], third: dict[str, Any]) -> dict[str, Any]:
    return dict(id=_text(row['RID']), revision=_revision(row),
                concepto=_text(row['CONCEPTO']).strip(), tercero=_text(row['TERCERO']).strip(),
                tercero2=_text(row['TERCERO2']).strip(), digito=_text(row['DIGITO']).strip(),
                nombre=_text(third.get('CNOMBRE')).strip(), sale=_boolean(row['SALE']),
                valores=[_number(row[field]) for field in VALUES])


def list_revision(cia: str, formato: str) -> dict[str, Any]:
    with ads_odbc_connection() as connection:
        company, form = _context(connection, cia, formato)
        code = _text(form['CODFORMA']).strip()
        rows = _rows(connection, company, code)
        names = _thirds(connection, {_text(row['TERCERO']).strip() for row in rows})
    return dict(formato=code, nombre=_text(form['NOMFORMA']),
                items=[_item(row, names.get(_text(row['TERCERO']).strip(), {})) for row in rows],
                totalValor1=float(sum(Decimal(str(row.get('VALOR1') or 0)) for row in rows)))


def _selected(connection: Any, company: int, formato: str, row_id: str, revision: str) -> dict[str, Any]:
    rows = _read(connection, 'SELECT ROWID AS RID, ' + ', '.join(FIELDS)
                 + ' FROM CONMAGDT WHERE CIA = ? AND FORMATO = ? AND ROWID = ?', company, formato, row_id)
    if len(rows) != 1 or _revision(rows[0]) != revision:
        raise RevisionConflict('El registro cambió o ya no existe. Consulte nuevamente antes de continuar.')
    return rows[0]


def _guard(row: dict[str, Any], company: int, formato: str) -> tuple[str, list[tuple[int, int, Any]]]:
    # Además de ROWID, comprobar el contenido leído: evita sobrescribir cambios
    # de otra sesión ocurridos entre SELECT y UPDATE/DELETE (mismo proceso o no).
    conditions = ['CIA = ?', 'FORMATO = ?', 'ROWID = ?']
    params = _params(company, formato, row['RID'])
    for field in FIELDS:
        if field in {'CIA', 'FORMATO'}:
            continue
        value = row.get(field)
        if value is None:
            conditions.append(f'{field} IS NULL')
        else:
            conditions.append(f'{field} = ?')
            if field in VALUES or field in {'COLBASE', 'COLIVA'}:
                params.append((ADO_TYPE_DOUBLE, 0, float(value)))
            elif field in {'SALE', 'MODCXP'}:
                params.append((ADO_TYPE_BOOLEAN, 0, _boolean(value)))
            else:
                params.extend(_params(value))
    return ' AND '.join(conditions), params


def _change(connection: Any, sql: str, params: list[tuple[int, int, Any]]) -> None:
    # RecordsAffected de ADODB permite detectar un conflicto sin tocar otra fila.
    from ._win32com import win32com
    from .ads_repository import ADO_COMMAND_TEXT, ADO_PARAMETER_INPUT
    command = win32com.client.Dispatch('ADODB.Command')
    command.ActiveConnection = connection
    command.CommandType = ADO_COMMAND_TEXT
    command.CommandText = sql
    for index, (kind, size, value) in enumerate(params):
        command.Parameters.Append(command.CreateParameter(f'p{index}', kind, ADO_PARAMETER_INPUT, size, value))
    _, affected = command.Execute()
    if affected != 1:
        raise RevisionConflict('No se pudo confirmar el registro: cambió durante la operación. Consulte nuevamente.')


def _money(value: Any) -> Decimal:
    try:
        result = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError('Ingrese valores monetarios válidos.') from exc
    if not result.is_finite() or abs(result) >= Decimal('100000000000') or result != result.quantize(Decimal('.01')):
        raise ValueError('El valor debe tener máximo dos decimales y estar dentro del rango permitido.')
    return result


def _audit(company: int, formato: str, action: str) -> str:
    try:
        register_master_update('WEB', 'CONMAGDT', formato, f'CIA {company}: {action}')
        return ''
    except Exception:
        LOG.warning('Medios: escritura confirmada con auditoría pendiente', exc_info=True)
        return 'Operación guardada; el registro de auditoría está pendiente.'


def save_revision(cia: str, formato: str, payload: dict[str, Any]) -> dict[str, Any]:
    concept = _code(payload.get('concepto', ''), 'El concepto')
    third = str(payload.get('tercero', '')).strip()
    digit = str(payload.get('digito', '')).strip()
    if not re.fullmatch(r'[A-Za-z0-9.-]{1,15}', third) or not re.fullmatch(r'[0-9]?', digit):
        raise ValueError('Ingrese un tercero válido y un dígito de verificación de un carácter.')
    amounts = [_money(payload.get('valor1', 0)), _money(payload.get('valor2', 0))]
    with accounting_write_lock, ads_odbc_connection() as connection:
        company, form = _context(connection, cia, formato)
        code = _text(form['CODFORMA']).strip()
        if not _read(connection, 'SELECT CONCEPTO FROM CONMAG2 WHERE FORMATO = ? AND CONCEPTO = ?', code, concept):
            raise ValueError('El concepto no pertenece al formato seleccionado.')
        if not _read(connection, 'SELECT CCODIGO FROM FADCLI WHERE CCODIGO = ?', third):
            raise ValueError('El tercero no existe. Créelo o seleccione uno existente.')
        connection.BeginTrans()
        try:
            values = _params(concept, third, digit) + [(ADO_TYPE_DOUBLE, 0, float(v)) for v in amounts]
            if payload.get('id'):
                old = _selected(connection, company, code, payload['id'], payload.get('revision', ''))
                where, params = _guard(old, company, code)
                _change(connection, 'UPDATE CONMAGDT SET CONCEPTO = ?, TERCERO = ?, DIGITO = ?, VALOR1 = ?, VALOR2 = ? WHERE ' + where, values + params)
            else:
                # CREAMAG2 permite registros de igual concepto/tercero. No
                # consolidarlos aquí: GENEMAGXLS2 realiza esa suma al exportar.
                columns = ('CIA', 'FORMATO', 'CONCEPTO', 'TERCERO', 'DIGITO', 'VALOR1', 'VALOR2', 'CUENTA', 'TERCERO2', 'SALE', 'MODCXP', 'COLBASE', 'COLIVA') + VALUES[2:]
                params = _params(company, code) + values + _params('', '')
                params += [(ADO_TYPE_BOOLEAN, 0, False)] * 2 + [(ADO_TYPE_DOUBLE, 0, 0)] * 11
                _execute(connection, f"INSERT INTO CONMAGDT ({', '.join(columns)}) VALUES ({', '.join('?' for _ in columns)})", params)
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    return {'mensaje': 'Registro guardado.', 'advertencia': _audit(company, code, 'Mantenimiento de liquidación de medios')}


def delete_revision(cia: str, formato: str, row_id: str, revision: str) -> dict[str, Any]:
    with accounting_write_lock, ads_odbc_connection() as connection:
        company, form = _context(connection, cia, formato)
        code = _text(form['CODFORMA']).strip()
        connection.BeginTrans()
        try:
            row = _selected(connection, company, code, row_id, revision)
            where, params = _guard(row, company, code)
            _change(connection, 'DELETE FROM CONMAGDT WHERE ' + where, params)
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    return {'mensaje': 'Registro eliminado.', 'advertencia': _audit(company, code, 'Eliminación manual de acumulado')}


def detail_revision(cia: str, formato: str, row_id: str, revision: str) -> dict[str, Any]:
    with ads_odbc_connection() as connection:
        company, form = _context(connection, cia, formato)
        code = _text(form['CODFORMA']).strip()
        row = _selected(connection, company, code, row_id, revision)
        _schema(connection, 'CONMAGIT', {'CIA', 'FORMATO', 'CONCEPTO', 'NIT', 'CODIGO', 'TVALOR', 'TBASE'})
        third_code = _text(row['TERCERO']).strip()
        third = _thirds(connection, {third_code}).get(third_code, {})
        items = _read(connection, 'SELECT CODIGO, TIPODOC, TDOCUM, TCOMPR, TFASE, TFECHA, TVALOR, TBASE, TDETALLE, TINCON '
                      'FROM CONMAGIT WHERE CIA = ? AND FORMATO = ? AND CONCEPTO = ? AND NIT = ? '
                      'ORDER BY TFECHA, TCOMPR, TIPODOC, TDOCUM', company, code, row['CONCEPTO'], row['TERCERO'])
    return {'concepto': _text(row['CONCEPTO']), 'tercero': third_code,
            'nombre': _text(third.get('CNOMBRE')),
            'items': [{k: str(v) if v is not None else '' for k, v in item.items()} for item in items]}


def reassign_ids(cia: str, formato: str, confirmation: str = '') -> dict[str, Any]:
    """GENERAID: reemplaza TERCERO por FADCLI.CNIT; nunca toca CONMAGIT.

    La vista previa es obligatoria. Su hash incluye las filas y sus mapeos;
    cambia si otra sesión genera/corrige los datos antes de confirmar.
    """
    with accounting_write_lock, ads_odbc_connection() as connection:
        company, form = _context(connection, cia, formato)
        code = _text(form['CODFORMA']).strip()
        connection.BeginTrans()
        try:
            rows = _rows(connection, company, code)
            thirds = _thirds(connection, {_text(row['TERCERO']).strip() for row in rows})
            changes = [(row, _text(thirds.get(_text(row['TERCERO']).strip(), {}).get('CNIT')).strip()) for row in rows]
            changes = [(row, nit) for row, nit in changes if nit and nit != _text(row['TERCERO']).strip()]
            if any(len(nit) > 15 for _, nit in changes):
                raise ValueError('Una identificación supera el tamaño permitido; revise los terceros.')
            token = _revision({'company': company, 'formato': code, 'rows': rows, 'changes': changes})
            if confirmation:
                if confirmation != token:
                    raise RevisionConflict('La vista previa cambió. Revise los cambios nuevamente.')
                for row, nit in changes:
                    where, params = _guard(row, company, code)
                    _change(connection, 'UPDATE CONMAGDT SET TERCERO = ? WHERE ' + where, _params(nit) + params)
            connection.CommitTrans()
        except Exception:
            connection.RollbackTrans()
            raise
    return {'token': token, 'cantidad': len(changes),
            'cambios': [{'anterior': _text(row['TERCERO']).strip(), 'nuevo': nit, 'concepto': _text(row['CONCEPTO'])} for row, nit in changes],
            'advertencia': _audit(company, code, 'Reasignación de identificaciones') if confirmation else ''}
