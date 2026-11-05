# Diagnóstico de escritura del reproceso mensual

La ejecución observada c73a0602c8cd preparó el plan en unos 33 segundos y no
registró final de reemplazo. Eso no permite distinguir demora de bloqueo.

Se agregan eventos SQL inicio/fin/fallo con referencia de operación y duración
para limpieza CONMAE por mes, limpieza CONTERCE por bloque de IDs, cada cuenta,
cada inserción y recuperación de ID, y cada bloque CASE de terceros. Los rótulos
contienen ordinal/total y mes, no NIT ni texto SQL. Se registra resumen de
compañía, rango y cantidades previstas; los ordinales no son filas afectadas.
Fin de sentencia significa llamada retornada, no transacción confirmada.

BeginTrans, CommitTrans y RollbackTrans también dejan inicio/fin/error. Si la
reversión falla se registra explícitamente, sin ocultar el error original.
No se agregan consultas al motor, reintentos ni cambios en cálculo o SQL.

Esta instrumentación es temporal y genera dos eventos por llamada: puede
incrementar E/S de logs con muchos auxiliares nuevos. Tras identificar el cuello
se debe reducir la verbosidad. No se guarda cada llamada en tiemposEtapas para
evitar una respuesta JSON masiva. Los detalles se consultan en servicio.log y
sus rotaciones; no son progreso en vivo en el navegador.

Para probar: recompilar y desplegar con la ejecución anterior finalizada y
recuperación del motor concluida. Usar copia representativa y respaldo. Ejecutar
un mes una sola vez. Observar servicio.log con Get-Content -Tail 40 -Wait. El
último SQL inicio sin fin identifica la llamada pendiente, no demuestra bloqueo.
Comparar tiempos repetidos y ordinales permite ver avance lento. Conservar logs
rotados si se excede el límite del archivo. No desconectar conexiones para medir.

Validación local sin Advantage: pruebas de propagación de argumentos/retorno,
error sin reintento ni falso fin, escritura con conexión simulada y conservación
de SQL/transacción, más pruebas contables y de instrumentación previas.
