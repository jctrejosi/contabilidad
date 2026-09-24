"""Sucursal temporal usada en todas las operaciones Advantage sobre VISDOCUM.

VISDOCUM no pertenece a una compañía (no tiene CIA), pero sí distingue
sucursales mediante SUC. Hasta que el producto permita seleccionar sucursal,
solo se leen, crean y modifican filas de la sucursal 1. Mantener el valor en
un único lugar evita mezclar consecutivos y plantillas de otras sucursales.
"""

VISDOCUM_SUCURSAL = 1
