# Reproceso: escribir solo diferencias

Se conserva el recálculo completo desde MOV01 y la transacción única. La lectura
de CONTERCE construye ahora cambios por ID físico y mes. Un ID principal recibe
el acumulado calculado y los duplicados reciben cero solo si su valor difiere.
Claves sin movimiento con saldo previo también reciben cero. Los auxiliares
nuevos conservan INSERT con importes incluidos. No hay limpieza general previa
de CONTERCE ni reescritura de filas correctas.

CONMAE compara cuentas del catálogo por mes, incluyendo cuentas cuyo movimiento
desapareció (esperado cero). La limpieza heredada queda restringida a filas no
catálogo con saldos no cero. Se detecta su existencia antes de devolver Sin
cambios. No se alteran campos de otros meses, CIA, MSALDO ni importes calculados.

El total de diferencias impide omitir trabajo cuando sumas correctas ocultan
duplicados o falta una clave nueva de importe neto cero. En esos casos incorpora
una medida de filas/auxiliares pendientes, no solo campos de sumas diferentes.

El log incluye `escritura diferencial cuentas-mes=... terceros-fila-mes=...`;
los totales por bloques posteriores se refieren a filas que requieren escritura,
no al total de auxiliares leídos. Los valores NULL se comparan como cero, como
en la lógica previa; ya no se convierten a cero físico solo por reprocesar.
No se agregaron tablas o índices. No hay mejoras prometidas si todos los
acumulados del rango son distintos: el CASE para esas filas sigue vigente.

Prueba local sin Advantage: equivalencia con limpiar/reconstruir en 50 conjuntos
deterministas con duplicados y claves obsoletas; casos de igualdad, NULL/cero,
signos, auxiliares nuevos, cuentas obsoletas, instrumentación y fallos. La
equivalencia completa en el motor real sigue pendiente.

Compilar con proyecto actualizado y probar en base de pruebas. Comparar un mes
con diferencias conocidas, conservar resumen de escrituras y tiempo. Si el mes
ya coincide es válido Sin cambios; no demuestra velocidad en reconstrucción.
No borrar acumulados solo para medir: usar copia equivalente del estado previo.
Verificar también ausencia de cambios en otras compañías/meses y conservación
de saldos iniciales. No se ejecutó reproceso real desde este cambio.
