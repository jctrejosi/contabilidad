# Actualizar existentes antes de crear nuevos

Cambio del escritor real: después de CONMAE, aplica CASE1000 diferencial de
CONTERCE existente y luego INSERT con acumulados de nuevos auxiliares. No altera
SQL, importes, IDs, defaults, selección, duplicados/obsoletos ni cálculo. El
llamador mantiene una única transacción y auditoría posterior. Si falla creación,
se revierte también actualización previa. No se confirman bloques parcialmente.

Hipótesis pendiente de validar en servidor: evitar que muchas inserciones previas
degraden actualización de existentes. No se afirma causa ni mejora demostrada.
Prueba real del usuario mostró orden actual 5.5189s vs ordenID5.6408s/10000;
no se aplicó ordenID. Junio tiene260609 diferencias físicas y28641 nuevos; el
benchmark no incluía inserciones. Plan real calculó en67.4434s.

Nueva etapa separada en resultado: Actualizar auxiliares existentes antes de
insertar nuevos. Crear auxiliares ya tiene tiempo separado. Logs de avance por
bloque dan construcciónSQL, llamada_con_log y acumulado de actualización. Tiempo
llamada incluye logging/COM/red/esperas; no es CPU aislada del motor.

Compilar/instalar detenido. Base de pruebas respaldada sin escritores externos.
Ejecutar desde formulario un mes con diferencias reales, no solo benchmark. Si
junio sigue pendiente, es candidato; no asumirlo sin consultar. Conservar resumen
diferencial, tiempos inicio/final de bloques, inserción, COMMIT y total. Comparar
importes finales y meses/compañías no seleccionados. No borrar saldos para medir.
No extrapolar contra otro mes como porcentaje exacto. Si no mejora, conservar
evidencia de carga transaccional; no quitar rollback para ganar tiempo.

Pruebas nuevas verifican orden, ausencia de COMMIT parcial, no insertar tras
error UPDATE, y rollback global tras error INSERT. Suites anteriores validan
valores, bloques1000, última fracción y escritura diferencial. No se ejecutó
reproceso contra datos reales desde desarrollo.
