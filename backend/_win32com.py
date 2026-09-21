"""Dependencias COM de Windows (pywin32), cargadas de forma opcional.

El backend puede operar contra PostgreSQL **sin** pywin32. Este módulo intenta
importar ``pythoncom`` y ``win32com.client`` y, cuando no están disponibles (por
ejemplo en Linux), expone sustitutos que fallan con un mensaje claro **sólo si
se usan**. Así importar los repositorios de Advantage deja de exigir Windows, y
la capa PostgreSQL se puede probar y ejecutar en cualquier plataforma.

Los módulos que hablan con ADO cambian ``import pythoncom`` / ``import
win32com.client`` por ``from ._win32com import pythoncom, win32com``; el uso
(``win32com.client.Dispatch(...)``, ``pythoncom.CoInitialize()``) no cambia.
"""

from __future__ import annotations

from typing import Any

__all__ = ["COM_DISPONIBLE", "ComNoDisponibleError", "pythoncom", "win32com"]


class ComNoDisponibleError(RuntimeError):
    """Se intentó usar COM/ADO en una plataforma sin pywin32."""


try:  # pragma: no cover - depende de la plataforma
    import pythoncom  # type: ignore[import-not-found]
    import win32com.client as _win32com_client  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - el caso Linux/macOS
    COM_DISPONIBLE = False

    class _ModuloNoDisponible:
        """Sustituto que explica el motivo en el primer acceso real."""

        def __init__(self, nombre: str) -> None:
            self._nombre = nombre

        def __getattr__(self, atributo: str) -> Any:
            raise ComNoDisponibleError(
                f"'{self._nombre}' requiere pywin32, que sólo existe en Windows. "
                "El motor Advantage no está disponible en esta plataforma: usa "
                "CONTABDSI_STORE=postgres, o ejecuta el backend en Windows si "
                "necesitas operar contra el legado."
            ) from None

    pythoncom: Any = _ModuloNoDisponible("pythoncom")
    win32com: Any = _ModuloNoDisponible("win32com.client")
else:
    COM_DISPONIBLE = True

    class _Win32Com:
        """Fachada mínima para conservar el uso ``win32com.client.…``."""

        client = _win32com_client

    win32com: Any = _Win32Com()
