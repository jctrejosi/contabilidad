"""Salidas de MEDMAG05: GENEMAG2, GENEMAGXLS2 e IMPREDET.

El archivo de entrega no lleva encabezados: su posición de columnas viene de
CONMAG1 y CONMAG2. Los informes de revisión sí llevan títulos y estilo DSI.
No se supone conformidad con una resolución fiscal distinta del programa fuente.
"""
from collections import OrderedDict
from decimal import Decimal
from datetime import date
from io import BytesIO
from typing import Any
from xml.sax.saxutils import escape

from .ads_repository import _boolean, _number, _text, ads_odbc_connection
from .medios_revision_repository import VALUES, _context, _read, _rows, _thirds, detail_revision


def _rounded(value: Any) -> int:
    # Harbour INT(x + .5): truncamiento hacia cero, también para negativos.
    return int(Decimal(str(value or 0)) + Decimal('.5'))


def _digit(code: str) -> str:
    if not code.isdigit() or len(code) > 15:
        return ''
    weights = (71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3)
    remainder = sum(int(d) * w for d, w in zip(code.zfill(15), weights)) % 11
    return str(remainder if remainder < 2 else 11 - remainder)


def build_delivery_rows(form: dict[str, Any], definitions: dict[str, dict[str, Any]],
                        rows: list[dict[str, Any]], thirds: dict[str, dict[str, Any]],
                        identification: str) -> list[list[Any]]:
    """GENEMAGXLS2: agrupar, redondear, mapear columnas y seleccionar identificación."""
    groups: OrderedDict[tuple[str, str], dict[str, Any]] = OrderedDict()
    for row in rows:
        key = (_text(row['CONCEPTO']).strip(), _text(row['TERCERO']).strip())
        if key not in groups:
            groups[key] = {**row, **{field: Decimal('0') for field in VALUES}}
        for field in VALUES:
            groups[key][field] += Decimal(str(row.get(field) or 0))
    result = []
    for (concept, third_code), row in groups.items():
        config = definitions.get(concept)
        if config is None:
            raise ValueError(f'El concepto {concept} ya no tiene definición. Restáurela antes de generar el archivo.')
        third = thirds.get(third_code)
        if third is None:
            raise ValueError(f'No se encuentra el tercero {third_code}. Corríjalo antes de generar el archivo.')
        kind = _text(third.get('CTIPDOC')).strip()
        code = third_code
        if identification == 'identificacion':
            code = _text(third.get('CNIT')).strip() or third_code
        elif identification == 'beneficiario':
            code = _text(third.get('CCODBE')).strip() or third_code
        values = [_rounded(row[field]) for field in VALUES]
        cells: list[Any] = []
        if _boolean(form.get('CONCEPTO')): cells.append(concept)
        if _boolean(form.get('TIPODOC')): cells.append(kind)
        if _boolean(form.get('NIT')): cells.append(code)
        if _boolean(form.get('DIGITO')):
            # Se calcula a partir del identificador exportado, sin depender de
            # la posición del cursor tras la agrupación como ocurría en Harbour.
            cells.append('' if kind in {'12', '13'} else _digit(code))
        if _boolean(form.get('NOMBRE')):
            cells.extend([_text(third.get(f)) for f in ('CAPE1', 'CAPE2', 'CNOM1', 'CNOM2')]
                         + [_text(third.get('CNOMBRE')) if kind == '31' else '']
                         if kind in {'12', '13', '31'} else ['', '', '', '', _text(third.get('CNOMBRE'))])
        if _boolean(form.get('DIRECCION')): cells.append(_text(third.get('CDIREC')))
        if _boolean(form.get('MUNICIPIO')):
            city = _text(third.get('CCODCIU'))
            cells.extend([city[:2], city[2:5]])
        if _boolean(form.get('PAIS')): cells.append('169')
        base = len(cells)
        if _boolean(row.get('MODCXP')):
            for field, value in [('COLBASE', values[1]), ('COLIVA', values[0])]:
                position = int(_number(row.get(field)))
                if not 1 <= position <= 30:
                    raise ValueError(f'Concepto {concept}: posición de base/IVA no válida.')
                while len(cells) < base + position: cells.append('')
                cells[base + position - 1] = value
            # En Harbour COL permanece en base: los COMBO siguientes se
            # escriben desde ahí y pueden reemplazar posiciones de CxP.
            column = base
        else:
            if _boolean(config.get('VALOR1')): cells.append(values[0])
            if _boolean(config.get('VALOR2')): cells.append(values[1])
            column = len(cells)
        for index in range(1, 8):
            option = _text(config.get(f'COMBO{index}')).strip()
            if not option or option == 'No Reporta': continue
            if option == 'Cero': value = 0
            elif option == 'Blanco': value = ''
            elif option == 'Informacion Tercero': value = third_code
            elif option.startswith('Valor ') and option[6:].isdigit() and 1 <= int(option[6:]) <= 11:
                value = values[int(option[6:]) - 1]
            else: raise ValueError(f'Concepto {concept}: columna adicional no válida ({option}).')
            while len(cells) <= column: cells.append('')
            cells[column] = value
            column += 1
        result.append(cells)
    return result


def _xlsx(rows: list[list[Any]], title: str, headers: list[str] | None = None) -> bytes:
    from openpyxl import Workbook
    from openpyxl.cell import WriteOnlyCell
    from openpyxl.styles import Font, PatternFill
    workbook = Workbook(write_only=True)
    sheet = None
    for index, row in enumerate(rows or [[]]):
        # Mismo fraccionamiento de GENEMAGXLS2; ahora hojas de un solo XLSX.
        if index % 65500 == 0:
            sheet = workbook.create_sheet(f'Hoja {index // 65500 + 1}')
            if headers:
                sheet.append([title])
                head = []
                for label in headers:
                    cell = WriteOnlyCell(sheet, value=label)
                    cell.font = Font(bold=True, color='FFFFFF')
                    cell.fill = PatternFill('solid', fgColor='001F4C')
                    head.append(cell)
                sheet.append(head)
        cells = []
        for value in row:
            cell = WriteOnlyCell(sheet, value=value)
            # NIT y códigos siempre texto; no ejecutar fórmulas de datos ajenos.
            if isinstance(value, str): cell.data_type = 's'
            cells.append(cell)
        sheet.append(cells)
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _pdf(rows: list[list[Any]], title: str, headers: list[str]) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A3, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import LongTable, Paragraph, SimpleDocTemplate, TableStyle
    buffer = BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=landscape(A3), leftMargin=25, rightMargin=25, topMargin=25, bottomMargin=25)
    styles = getSampleStyleSheet()
    styles['Title'].textColor = colors.HexColor('#001F4C')
    styles['Normal'].fontSize = 8
    styles['Normal'].leading = 10
    data = [[Paragraph(escape(str(value)), styles['Normal']) for value in row] for row in [headers] + rows]
    table = LongTable(data, repeatRows=1, colWidths=[document.width / len(headers)] * len(headers))
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#C8F0FD')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5FBFF')]),
        ('GRID', (0, 0), (-1, -1), .2, colors.lightgrey), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    def footer(canvas, doc):
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.HexColor('#0073C0'))
        canvas.drawRightString(doc.pagesize[0] - 25, 12, f'DSI · Página {doc.page}')
    document.build([Paragraph(escape(title), styles['Title']), table], onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()


def export_revision(cia: str, formato: str, output: str, mode: str,
                    identification: str = 'codigo', row_id: str = '', revision: str = '') -> bytes:
    if output not in {'xlsx', 'pdf'} or mode not in {'revision', 'detalle', 'archivo'}:
        raise ValueError('Salida de informe no válida.')
    if identification not in {'codigo', 'identificacion', 'beneficiario'}:
        raise ValueError('Seleccione el tipo de identificación.')
    if mode == 'archivo' and output != 'xlsx':
        raise ValueError('El archivo de medios se genera en Excel.')
    with ads_odbc_connection() as connection:
        company, form = _context(connection, cia, formato)
        code = _text(form['CODFORMA']).strip()
        companies = _read(connection, 'SELECT EMPNOM, EMPNIT FROM CONEMP WHERE EMPCOD = ?', company)
        company_title = f"{_text(companies[0]['EMPNOM'])} · NIT {_text(companies[0]['EMPNIT'])}" if companies else f'Compañía {cia}'
        rows = _rows(connection, company, code) if mode != 'detalle' else []
        thirds = _thirds(connection, {_text(row['TERCERO']).strip() for row in rows}, fallback=mode == 'archivo')
        configs = _read(connection, 'SELECT * FROM CONMAG2 WHERE FORMATO = ?', code) if mode == 'archivo' else []
    title = f'{company_title} · Revisión de medios · {code} · {_text(form["NOMFORMA"])} · {date.today().isoformat()}'
    if mode == 'archivo':
        if not rows:
            raise ValueError('No hay registros del formato para generar el archivo.')
        data = build_delivery_rows(form, {_text(row['CONCEPTO']).strip(): row for row in configs}, rows, thirds, identification)
        return _xlsx(data, title)  # Sin títulos ni encabezados fiscales inventados.
    if mode == 'detalle':
        detail = detail_revision(cia, formato, row_id, revision)
        items = detail['items']
        headers = ['Cuenta', 'Tipo', 'Documento', 'Compr.', 'Centro', 'Fecha', 'Valor', 'Base', 'Detalle', 'Columna']
        fields = ['CODIGO', 'TIPODOC', 'TDOCUM', 'TCOMPR', 'TFASE', 'TFECHA', 'TVALOR', 'TBASE', 'TDETALLE', 'TINCON']
        data = [[float(item[f] or 0) if f in {'TVALOR', 'TBASE'} else item[f] for f in fields] for item in items]
        total_value = float(sum(Decimal(item['TVALOR'] or '0') for item in items))
        total_base = float(sum(Decimal(item['TBASE'] or '0') for item in items))
        data.append(['TOTALES', '', '', '', '', '', total_value, total_base, '', ''])
        title += f" · Detalle · Concepto {detail['concepto']} · Tercero {detail['tercero']} · {detail['nombre']}"
    else:
        # GENEMAG2 tiene once columnas fijas; los indicadores dejan la celda
        # vacía, no desplazan el resto como en el archivo GENEMAGXLS2.
        headers = ['Concepto', 'Tipo doc.', 'NIT', 'DV', 'Nombre', 'Dirección', 'Depto', 'Municipio', 'País', 'Valor 2', 'Valor 1']
        data = []
        for row in rows:
            third = thirds.get(_text(row['TERCERO']).strip(), {})
            kind = _text(third.get('CTIPDOC')).strip()
            name = ' '.join(_text(third.get(f)).strip() for f in ['CAPE1', 'CAPE2', 'CNOM1', 'CNOM2']).strip() if kind in {'12', '13'} else _text(third.get('CNOMBRE'))
            city = _text(third.get('CCODCIU'))
            values = [row['CONCEPTO'], kind, row['TERCERO'], '' if kind in {'12', '13'} else row['DIGITO'], name, _text(third.get('CDIREC')), city[:2], city[2:5], '169', _number(row['VALOR2']), _number(row['VALOR1'])]
            flags = ['CONCEPTO', 'TIPODOC', 'NIT', 'DIGITO', 'NOMBRE', 'DIRECCION', 'MUNICIPIO', 'MUNICIPIO', 'PAIS', 'VALOR2', 'VALOR1']
            data.append([value if _boolean(form.get(flag)) else '' for flag, value in zip(flags, values)])
    return _xlsx(data, title, headers) if output == 'xlsx' else _pdf(data, title, headers)
