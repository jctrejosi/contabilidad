"""Lectura de documentos MOV01 para reutilizar exclusivamente sus partidas.

No depende de CONDOCUM y nunca modifica el documento original. La identidad
incluye compañía, año, mes, comprobante, tipo, número y fecha para no mezclar
documentos que reutilizan numeración. Todos los filtros son parámetros ADO.
"""
from typing import Any

from .ads_repository import (
    ADO_TYPE_INTEGER, ADO_TYPE_VARCHAR, CompanyNotFound, _company_exists,
    _number, _text, ads_connection, normalize_company_code,
)
from .documentos_repository import (
    DOCUMENT_CODE, SIMPLE_CODE, _code, _iso_date, _query_rows, _third_party_names,
)


def buscar_documento_origen(cia: str, anio: int, mes: int, documento: str,
                           comprobante: str = '', tipo_documento: str = '') -> list[dict[str, Any]]:
    company = normalize_company_code(cia)
    document = _code(documento, 'documento', 12, DOCUMENT_CODE)
    voucher = _code(comprobante, 'comprobante', 6, SIMPLE_CODE)
    doc_type = _code(tipo_documento, 'tipo documental', 2, SIMPLE_CODE)
    if not document or not 1900 <= anio <= 9999 or not 1 <= mes <= 18:
        raise ValueError('Indique documento, año y mes válidos para buscar.')
    conditions = ['CONCIA = ?', 'CONANO = ?', 'CONMES = ?', 'TDOCUM = ?']
    params = [(ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_INTEGER, 0, anio),
              (ADO_TYPE_INTEGER, 0, mes), (ADO_TYPE_VARCHAR, 12, document)]
    for field, value, size in [('TCOMPR', voucher, 6), ('TIPODOC', doc_type, 2)]:
        if value:
            conditions.append(f'{field} = ?')
            params.append((ADO_TYPE_VARCHAR, size, value))
    with ads_connection() as connection:
        if not _company_exists(connection, company):
            raise CompanyNotFound('La compañía seleccionada no existe.')
        rows = _query_rows(connection,
            'SELECT ID, TFECHA, TCOMPR, TIPODOC, TDOCUM, TSEC, CODIGO, NIT, NITN, '
            'TFASE, TVALOR, TBASE, TDETALLE, TDOCUM2 FROM MOV01 WHERE ' + ' AND '.join(conditions)
            + ' ORDER BY TCOMPR, TIPODOC, TFECHA, TSEC, ID', params)
        nits = {_text(row.get('NITN')) or _text(row.get('NIT')) for row in rows}
        names = _third_party_names(connection, nits)
    documents: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    for row in rows:
        key = (_text(row.get('TCOMPR')), _text(row.get('TIPODOC')),
               _text(row.get('TDOCUM')), _iso_date(row.get('TFECHA')))
        doc = documents.setdefault(key, {
            'comprobante': key[0], 'tipoDocumento': key[1], 'documento': key[2],
            'fecha': key[3], 'partidas': [],
        })
        value = _number(row.get('TVALOR'))
        nit = _text(row.get('NITN')) or _text(row.get('NIT'))
        doc['partidas'].append({
            'cuenta': _text(row.get('CODIGO')), 'nit': nit,
            'tercero': names.get(nit, ''), 'terceroValidado': nit in names,
            'centro': _text(row.get('TFASE')), 'concepto': _text(row.get('TDETALLE')),
            'debito': max(value, 0), 'credito': max(-value, 0),
            'base': _number(row.get('TBASE')),
            'documentoAfectado': _text(row.get('TDOCUM2')),
        })
    return list(documents.values())
