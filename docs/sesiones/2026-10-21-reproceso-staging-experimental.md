# Comparación experimental: temporal + UPDATE JOIN

Se añade --staging al comando benchmark-reproceso. Es incompatible con
--extended. Muestra 1..10000; primera prueba recomendada 1000. Usa mismas
credenciales DPAPI, ADO/ODBC y restricción de servicio detenido del arnés actual.
No se activa en ejecución del reproceso mensual ni cambia sus cálculos.

Compara CASE1000 contra CREATE TABLE #DSIRP<uuid> con RID/DEBITO/CREDITO e
índice único en RID; carga parametrizada con un INSERT por fila y luego UPDATE
CONTERCE FROM CONTERCE INNER JOIN temporal por ID, restringido a CIA. La carga
por inserción individual podría anular la ganancia del JOIN: se mide completa.
No hay promesa de carga masiva ni uso probado del optimizador.

Temporal y su índice se crean antes de BeginTrans sobre destino. El UPDATE
usa transacción; verifica importes calculados (+0.01 al débito original), revierte
y verifica restauración exacta, incluidos NULL. DROP ocurre después de rollback,
nunca con transacción incierta. Ante rollback fallido no emite DROP ni asume
restauración. Error aborta; no hay fallback ni COMMIT ni DDL en tablas contables.
Los nombres generados no derivan de entrada libre. Solo meses 1..12.

Compatibilidad: no fue posible acceder al manual remoto del fabricante ni
extraer el CHM instalado durante esta sesión. Por ello CREATE temporal, índice
y UPDATE FROM son candidatos experimentales que debe validar el motor real,
no sintaxis ya certificada en ese servidor. Fallo de creación/carga aborta antes
de abrir transacción destino; fallo de UPDATE intenta rollback y detiene prueba.
Salida incluye etapa y tipo de error sin volcar credenciales ni cadena COM.

Referencia real 93a5d74607c8: total669.349s, reemplazo603.076s, commit10.930s;
258410 filas mes05. Últimos bloques1000 ~2.5s, último410 ~2.46s. No atribuir a
índice sin plan; prueba pequeña anterior CASE1000 ~1.5s por3000 es incomparable
con toda la transacción/distribución mensual.

Compilar/instalar, detener Contabilidad y otras escrituras en copia respaldada.
No cancelar transacción activa para instalar. En PowerShell elevado:

    $instalacionContable = Get-Content 'C:\ProgramData\DSI\CONTABDSI27\installation.json' -Raw | ConvertFrom-Json
    & $instalacionContable.executable benchmark-reproceso --config $instalacionContable.configuration --company 026 --month 5 --sample 1000 --staging --confirm-test-writes

Comparar cargaMasEscrituraSegundos y restauracionVerificada. Solo si es compatible
y prometedor, ampliar muestras/zonas/carga y validar equivalencia completa antes
de integrar. Cambiaría el escritor, nunca la fuente de cálculos ni reglas de
duplicados, obsoletos, compañías, meses o rollback.

Validación: 31 pruebas backend relacionadas y 9 runtime correctas. Incluye
reversión por fallo JOIN, no escribir destino ante CREATE incompatible,
eliminación temporal fuera de transacción y omitir DDL ante rollback fallido.
No se realizó prueba de escritura real contra el servidor remoto desde aquí.
