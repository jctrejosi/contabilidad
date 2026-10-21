"""Rutas propias de MEDMAG05; no reutilizan la rama PostgreSQL de impuestos."""
import logging
from decimal import Decimal
from typing import Any, Callable, Literal

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field

from . import medios_revision_repository as repo
from .medios_revision_export import export_revision

router = APIRouter(prefix='/api/medios/revision', tags=['Medios: revisión'])
CIA = Query(pattern=r'^[0-9]{1,3}$')
FORM = Query(min_length=1, max_length=4)


def _run(call: Callable[[], Any]) -> Any:
    try:
        return call()
    except repo.RevisionConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        logging.getLogger(__name__).exception('Falló revisión de medios')
        raise HTTPException(503, 'No fue posible completar la operación. Revise la conexión y el registro del servicio.') from exc


class Registro(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    id: str = Field('', max_length=64)
    revision: str = Field('', max_length=64)
    concepto: str = Field(min_length=1, max_length=4)
    tercero: str = Field(min_length=1, max_length=15)
    digito: str = Field('', pattern=r'^[0-9]?$')
    valor1: Decimal = Field(Decimal('0'), gt=-100000000000, lt=100000000000, decimal_places=2)
    valor2: Decimal = Field(Decimal('0'), gt=-100000000000, lt=100000000000, decimal_places=2)


class Seleccion(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str = Field(min_length=1, max_length=64)
    revision: str = Field(min_length=64, max_length=64)


class Reasignacion(BaseModel):
    model_config = ConfigDict(extra='forbid')
    token: str = Field('', max_length=64)


@router.get('')
def listar(cia: str = CIA, formato: str = FORM):
    return _run(lambda: repo.list_revision(cia, formato))


@router.post('/registro')
def guardar(payload: Registro, cia: str = CIA, formato: str = FORM):
    return _run(lambda: repo.save_revision(cia, formato, payload.model_dump()))


@router.post('/eliminar')
def eliminar(payload: Seleccion, cia: str = CIA, formato: str = FORM):
    return _run(lambda: repo.delete_revision(cia, formato, payload.id, payload.revision))


@router.get('/detalle')
def detalle(cia: str = CIA, formato: str = FORM, id: str = Query(min_length=1, max_length=64), revision: str = Query(min_length=64, max_length=64)):
    return _run(lambda: repo.detail_revision(cia, formato, id, revision))


@router.post('/identificaciones')
def reasignar(payload: Reasignacion, cia: str = CIA, formato: str = FORM):
    return _run(lambda: repo.reassign_ids(cia, formato, payload.token))


@router.get('/exportar')
def exportar(cia: str = CIA, formato: str = FORM,
             salida: Literal['xlsx', 'pdf'] = 'xlsx', modo: Literal['revision', 'detalle', 'archivo'] = 'revision',
             identificacion: Literal['codigo', 'identificacion', 'beneficiario'] = 'codigo',
             id: str = Query(default='', max_length=64), revision: str = Query(default='', max_length=64)):
    content = _run(lambda: export_revision(cia, formato, salida, modo, identificacion, id, revision))
    return Response(content, media_type='application/pdf' if salida == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    headers={'Content-Disposition': f'attachment; filename="medios-{modo}.{salida}"', 'Cache-Control': 'no-store'})
