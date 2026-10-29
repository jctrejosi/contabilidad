# Tipos de documentos de todos los módulos en Contabilidad

Revisión: catálogo backend tipos_documento_repository ya lee VISDOCUM de SUC1
sin filtro CIA, MODULO o ICONTAB. Captura directa/lotes/reembolsos consumen ese
catálogo completo. Validaciones de documento en contabilizacion_repository,
lotes_repository y reembolsos_ads_repository usan sucursal y código, no módulo.
Consultas CONDOCUM no restringen por DMODULO. No fue necesario modificar SQL ni
alterar los indicadores/consecutivos de los tipos documentales.

Única restricción visual encontrada: filtro opcional por módulo en la pantalla
TiposDocumento. Se elimina selector y sus condiciones para que solo la búsqueda
textual pueda acotar registros. Columna de módulo sigue siendo informativa,
incluidos módulos0/no reconocidos. Se mantiene sucursal predeterminada1 y las
validaciones contables, cuentas, terceros, centros, fecha y numeración.

Pruebas sin ADS real: catálogo incluye módulos0/1/2/3/9/99 aunque ICONTAB seaFalse,
mantiene SUC1, y validación reembolso no usa MODULO. No se graban movimientos ni
se modifica diccionario desde desarrollo. Compilar/desplegar para prueba remota.
Si un tipo sigue faltando, verificar que esté en SUC1, sin reasignar su módulo a9.
