"""Progreso en memoria del único proceso servidor; nunca consulta Advantage.

No es cola de trabajos ni almacenamiento durable. ID aleatorio generado por
cliente y compañía delimitan consulta. Las entradas activas no caducan a mitad
de escritura; terminadas expiran tras una hora. Reiniciar pierde seguimiento.
"""
from contextlib import contextmanager
from contextvars import ContextVar
from threading import Lock
from time import monotonic

_entries = {}
_lock = Lock()
_current = ContextVar("monthly_progress", default=None)


@contextmanager
def tracking(identity, company):
    if not identity:
        yield
        return
    now = monotonic()
    with _lock:
        expired = [key for key, item in _entries.items()
                   if item["estado"] != "activo" and now - item["updated"] > 3600]
        for key in expired:
            del _entries[key]
        if identity in _entries:
            raise ValueError("Esta referencia ya fue utilizada; no repita la solicitud.")
        if len(_entries) >= 200:
            raise ValueError("Seguimiento ocupado; intente más tarde.")
        _entries[identity] = dict(company=int(company), estado="activo", etapa="Preparando operación",
                                  procesados=0, total=None, started=now, updated=now)
    token = _current.set(identity)
    try:
        yield
    except BaseException:
        _set(estado="error", etapa="Operación interrumpida; revise el resultado", total=None)
        raise
    else:
        _set(estado="finalizado", etapa="Operación finalizada")
    finally:
        _current.reset(token)


def _set(**values):
    identity = _current.get()
    if identity is None:
        return
    with _lock:
        _entries[identity].update(values, updated=monotonic())


def stage(label, total=None):
    _set(etapa=label, procesados=0, total=total)


def advance(count):
    identity = _current.get()
    if identity is None:
        return
    with _lock:
        item = _entries[identity]
        item["procesados"] += count
        item["updated"] = monotonic()


def snapshot(identity, company):
    with _lock:
        item = _entries.get(identity)
        if item is None or item["company"] != int(company):
            return None
        if item["estado"] != "activo" and monotonic() - item["updated"] > 3600:
            del _entries[identity]
            return None
        return {"estado": item["estado"], "etapa": item["etapa"],
                "procesados": item["procesados"], "total": item["total"],
                "segundos": round((monotonic() if item["estado"] == "activo" else item["updated"]) - item["started"], 1)}
