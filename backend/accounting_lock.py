"""Sincronización de las escrituras que recalculan saldos contables.

La captura directa y el reproceso mensual modifican los mismos acumulados de
CONMAE y CONTERCE. Este candado evita que ambas operaciones se intercalen
dentro del mismo proceso de la API; la transacción de Advantage sigue siendo
la protección definitiva frente a errores de base de datos.
"""

from threading import Lock


accounting_write_lock = Lock()
