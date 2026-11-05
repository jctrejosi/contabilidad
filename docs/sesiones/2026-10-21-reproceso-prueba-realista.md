# Benchmark realista acotado

Flag --realistic, excluyente con --extended/--staging. Muestra por zona entre
3000 y 30000; recomendado 10000. No cambia escritor mensual CASE1000. No DDL.
Dos transacciones con rollback y verificación: primera con IDs consecutivos,
segunda con diez ventanas de IDs por rango numérico MIN/MAX. Deduplica ventanas
solapadas, informa filas reales; no son percentiles ni muestreo uniforme.
Cada una ejecuta todos sus bloques de mil dentro de la misma transacción.

Importes distintos por ID: débito original + (ID%97+1)/100 y crédito original
- (ID%89+1)/100. Verifica importes antes de revertir y restauración exacta
(incluido NULL) después. Nunca COMMIT. Error interrumpe pruebas, rollback fallido
requiere revisar servidor. No representa un cálculo contable: solo prueba.

CASE mide por separado construcción SQL y llamada Execute, además de duración
acumulada por bloque. Execute incluye COM, red, esperas y motor: no confundir
con CPU pura de Advantage. Lecturas de verificación fuera del tiempo escritura;
rollback separado. Comparación mantiene caché y orden fijo como limitaciones.
10000 filas no equivalen a toda la carga de una transacción de 300000 filas.

Base de pruebas respaldada, sin escrituras concurrentes y Contabilidad detenida.
Compilar/instalar antes de usar. El runtime reutiliza DPAPI y comprueba puerto.

    $instalacionContable = Get-Content 'C:\ProgramData\DSI\CONTABDSI27\installation.json' -Raw | ConvertFrom-Json
    & $instalacionContable.executable benchmark-reproceso --config $instalacionContable.configuration --company 026 --month 5 --sample 10000 --realistic --confirm-test-writes

Compartir resultados completos. No aumentar muestra ni cambiar reproceso hasta
revisar distribución, importes y tiempo de llamada. No se probó escritura remota
desde desarrollo. Pruebas unitarias usan motor simulado.
