# Carga actual e inversa sobre mismas diferencias

--reverse-load excluye otros modos. --sample es límite por recorrido, entre
10000 y300000 múltiplo1000; recomendado100000. Usa plan real del ejercicio
activo y mes solicitado. Si hay menos de10000 diferencias no escribe. Si hay
fracción final, reduce al múltiplo1000 inferior para conservar grupos idénticos
al invertir filas. Dos transacciones largas, una por recorrido; ambas rollback.
Hasta600000 modificaciones temporales entre dos recorridos al máximo permitido.
No confundir esta prueba con una prueba instantánea: puede tardar varios minutos.

Primer orden igual a escritor real; segundo reverso exacto. Mantiene mismos
IDs/importes y grupos1000. grupoOriginal identifica grupo por ordinal en ambos
recorridos sin exponer identificaciones contables. Resultado incluye promedios
primeros5 y últimos5 llamadas. No afirmar causa: caché, distribución y orden fijo
siguen siendo variables. No se aplican limpiezas, inserciones ni carga mensual
completa; objetivo acotado es relacionar grupo con posición de la transacción.

Solo base de pruebas respaldada sin escritores. Finalizar transacción anterior,
compilar/instalar y detener Contabilidad desde Fortuner. Credenciales DPAPI y
guardia de puerto del comando permanecen. Verificar valores escritos, rollback,
y restauración exacta antes del recorrido siguiente. Cualquier fallo detiene.
No cambios al escritor real. No tablas/índices nuevos ni confirmaciones parciales.

    $instalacionContable = Get-Content 'C:\ProgramData\DSI\CONTABDSI27\installation.json' -Raw | ConvertFrom-Json
    & $instalacionContable.executable benchmark-reproceso --config $instalacionContable.configuration --company 026 --month 7 --sample 100000 --reverse-load --confirm-test-writes

Mes7 es ejemplo no confirmado: elegir mes con diferencias y no corregirlo antes.
Junio ya confirmado no sirve. Si salida indica insuficientes diferencias no
borrar saldos. Guardar salida con Tee-Object en archivo si se quiere conservar.
No requiere volver a correr todos los modos de diagnóstico anteriores.

Validación local: límites, modos excluyentes, mismos registros en reverso,
fracción omitida simétricamente, ordinales correspondientes, dos rollback sin
commit y no escribir al no haber muestra. Pendiente medición en servidor real.
