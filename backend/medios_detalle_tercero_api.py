"""Consulta MEDMAG06 con instantánea para exportar el mismo resultado completo."""
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Response

from . import report_snapshots as snapshots
from .ads_repository import normalize_company_code
from .medios_revision_api import _run
from .medios_detalle_tercero_repository import consultar_detalle_tercero, export_detalle_tercero

router = APIRouter(prefix='/api/medios/detalle-tercero', tags=['Medios: detalle por tercero'])
CIA = Query(pattern=r'^[0-9]{1,3}$')


def _snapshot(cia: str, token: str, page: int | None = None):
    try:
        result = snapshots.load(token, page=page)
    except snapshots.SnapshotNotFound as exc:
        raise HTTPException(410, 'El resultado venció. Consulte nuevamente.') from exc
    if result.get('id') != 'medios-detalle-tercero' or result.get('cia') != f'{normalize_company_code(cia):03d}':
        raise HTTPException(404, 'El resultado no pertenece a esta compañía.')
    return result


@router.get('')
def consultar(cia: str = CIA, tercero: str = Query(min_length=1, max_length=15), modo: Literal['detallado', 'resumido'] = 'detallado'):
    def generate():
        report = consultar_detalle_tercero(cia, tercero, modo)
        report['totalFilas'] = len(report['filas'])
        token = snapshots.save(report)
        result = _snapshot(cia, token, 0)
        return {**result, 'page': 0, 'pageSize': snapshots.PAGE_SIZE}
    return _run(generate)


@router.get('/pagina')
def pagina(cia: str = CIA, token: str = Query(pattern=r'^[0-9a-f]{32}$'), page: int = Query(ge=0)):
    return {**_snapshot(cia, token, page), 'page': page, 'pageSize': snapshots.PAGE_SIZE}


@router.get('/exportar')
def exportar(cia: str = CIA, token: str = Query(pattern=r'^[0-9a-f]{32}$'), salida: Literal['pdf', 'xlsx'] = 'pdf'):
    report = _snapshot(cia, token)
    content = _run(lambda: export_detalle_tercero(report, salida))
    return Response(content, media_type='application/pdf' if salida == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    headers={'Content-Disposition': f'attachment; filename="medios-detalle-tercero.{salida}"', 'Cache-Control': 'no-store'})
