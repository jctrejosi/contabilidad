"""MEDMAG06 / DETALLE1N / DETALLE2N: lectura de partidas por tercero.

La selección original solo solicita tercero; no agrega año, mes ni formato.
El detalle vigente sale de CONMAGIT, no de CONMAGDT ni del movimiento bruto.
El nuevo modelo añade exclusivamente el aislamiento por CIA.
"""
from collections import OrderedDict
from datetime import date
from decimal import Decimal
import re
from typing import Any

from .ads_repository import _number, _text, ads_odbc_connection, normalize_company_code
from .medios_generacion_repository import _schema
from .medios_revision_repository import _read
from .medios_revision_export import _pdf, _xlsx

DETAIL_COLUMNS = ['Formato', 'Concepto', 'Cuenta', 'Tipo doc.', 'Documento', 'Compr.', 'Centro', 'Fecha', 'Valor', 'Base']
SUMMARY_COLUMNS = ['Formato', 'Concepto', 'Nombre concepto', 'Valor', 'Base']


def build_report(rows: list[dict[str, Any]], concepts: dict[tuple[str, str], str],
                 formats: dict[str, str], mode: str) -> dict[str, Any]:
    """Mismos cortes y sumas Harbour, sin sumar subtotales por segunda vez.

    Los subtotales de concepto/formato solo muestran VALOR, como el fuente;
    BASE se presenta en cada partida/resumen y en el total general.
    """
    if mode not in {'detallado', 'resumido'}:
        raise ValueError('Seleccione informe detallado o resumido.')
    groups: OrderedDict[str, OrderedDict[str, list[dict[str, Any]]]] = OrderedDict()
    for row in sorted(rows, key=lambda item: (_text(item['FORMATO']), _text(item['CONCEPTO']))):
        form = _text(row['FORMATO']).strip()
        concept = _text(row['CONCEPTO']).strip()
        groups.setdefault(form, OrderedDict()).setdefault(concept, []).append(row)
    cells: list[list[Any]] = []
    kinds: list[str] = []
    total = Decimal(0); base = Decimal(0)
    def add(values, kind):
        cells.append(values); kinds.append(kind)
    for form, definitions in groups.items():
        form_total = Decimal(0)
        for concept, movements in definitions.items():
            concept_total = sum((Decimal(str(row.get('TVALOR') or 0)) for row in movements), Decimal(0))
            concept_base = sum((Decimal(str(row.get('TBASE') or 0)) for row in movements), Decimal(0))
            total += concept_total; base += concept_base; form_total += concept_total
            if mode == 'detallado':
                for row in movements:
                    raw_date = _text(row.get('TFECHA')).split('.')[0]
                    display_date = f'{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}' if len(raw_date) == 8 else raw_date
                    add([form, concept, _text(row.get('CODIGO')), _text(row.get('TIPODOC')),
                         _text(row.get('TDOCUM')), _text(row.get('TCOMPR')), _text(row.get('TFASE')),
                         display_date, _number(row.get('TVALOR')), _number(row.get('TBASE'))], 'movimiento')
                add([form, concept, '** Total Concepto', '', '', '', '', '', float(concept_total), ''], 'subtotal-concepto')
            else:
                add([form, concept, concepts.get((form, concept), ''), float(concept_total), float(concept_base)], 'resumen')
        add([form, '', '* Total Formato' + (f' : {formats.get(form, "")}' if mode == 'resumido' else ''),
             *([''] * 5 if mode == 'detallado' else []), float(form_total), ''], 'subtotal-formato')
    if mode == 'detallado':
        add(['TOTALES GENERALES EN MEDIOS', '', '', '', '', '', '', '', float(total), float(base)], 'total-general')
    else:
        add(['TOTALES GENERALES EN MEDIOS', '', '', float(total), float(base)], 'total-general')
    return dict(columnas=DETAIL_COLUMNS if mode == 'detallado' else SUMMARY_COLUMNS,
                filas=cells, tipos=kinds, totalValor=float(total), totalBase=float(base), movimientos=len(rows))


def consultar_detalle_tercero(cia: str, tercero: str, modo: str) -> dict[str, Any]:
    company = normalize_company_code(cia)
    code = tercero.strip()
    if not re.fullmatch(r'[A-Za-z0-9.-]{1,15}', code):
        raise ValueError('Seleccione un tercero válido.')
    if modo not in {'detallado', 'resumido'}:
        raise ValueError('Seleccione informe detallado o resumido.')
    with ads_odbc_connection() as connection:
        companies = _read(connection, 'SELECT EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = ?', company)
        if not companies:
            raise ValueError('La compañía seleccionada no existe.')
        # NITOKL con TM=2 acepta terceros inactivos: no aplicar filtro de estado.
        thirds = _read(connection, 'SELECT CCODIGO, CNOMBRE FROM FADCLI WHERE CCODIGO = ?', code)
        if not thirds:
            raise ValueError('El tercero no existe. Búsquelo por código o nombre.')
        _schema(connection, 'CONMAGIT', {'CIA', 'NIT', 'FORMATO', 'CONCEPTO', 'CODIGO', 'TCOMPR', 'TFASE', 'TIPODOC', 'TDOCUM', 'TFECHA', 'TVALOR', 'TBASE'})
        rows = _read(connection,
                     'SELECT FORMATO, CONCEPTO, CODIGO, TCOMPR, TFASE, TIPODOC, TDOCUM, TFECHA, TVALOR, TBASE '
                     'FROM CONMAGIT WHERE CIA = ? AND NIT = ? '
                     'ORDER BY FORMATO, CONCEPTO, TFECHA, TCOMPR, TIPODOC, TDOCUM, CODIGO', company, code)
        # Catálogos separados: un JOIN no debe duplicar importes si un catálogo
        # contiene registros repetidos. Una lectura por catálogo, no por partida.
        definitions = _read(connection, 'SELECT FORMATO, CONCEPTO, NOMCONCEP FROM CONMAG2') if rows else []
        names = _read(connection, 'SELECT CODFORMA, NOMFORMA FROM CONMAG1') if rows else []
    concepts: dict[tuple[str, str], str] = {}
    formats: dict[str, str] = {}
    for row in definitions:
        concepts.setdefault((_text(row['FORMATO']).strip(), _text(row['CONCEPTO']).strip()), _text(row['NOMCONCEP']))
    for row in names:
        formats.setdefault(_text(row['CODFORMA']).strip(), _text(row['NOMFORMA']))
    report = build_report(rows, concepts, formats, modo)
    report.update(id='medios-detalle-tercero', cia=f'{company:03d}', tercero=code,
                  nombre=_text(thirds[0]['CNOMBRE']), modo=modo,
                  titulo=f"{_text(companies[0]['EMPNOM'])} · NIT {_text(companies[0]['EMPNIT'])} · "
                         f"Detalle medios por tercero · {modo} · {code} · {_text(thirds[0]['CNOMBRE'])} · {date.today().isoformat()}")
    return report


def export_detalle_tercero(report: dict[str, Any], salida: str) -> bytes:
    if salida == 'xlsx':
        return _xlsx(report['filas'], report['titulo'], report['columnas'])
    if salida == 'pdf':
        return _pdf(report['filas'], report['titulo'], report['columnas'])
    raise ValueError('Seleccione PDF o Excel.')
