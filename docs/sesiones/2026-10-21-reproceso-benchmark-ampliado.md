# Benchmark ampliado: tamaños y bloques consecutivos

Nuevo flag --extended en benchmark-reproceso. Mantiene modo anterior sin flag.
Ejemplo: --company 026 --month 3 --sample 3000 --extended --confirm-test-writes.
3000 es cantidad por zona, no tamaño de bloque. Mínimo 3000 y máximo 10000.

Zonas: primeras filas por ID, primeras filas desde el punto medio numérico entre
MIN/MAX ID, últimas filas por ID. No son percentiles ni garantizan disjunción.
Salida avisa muestras reducidas. Cada zona compara exactamente las mismas filas
para CASE 250, 500 y 1000. Orden rotado por zona para reducir sesgo de caché.
Son nueve transacciones independientes, cada una con múltiples bloques seguidos,
no una transacción por bloque. No incluye comando preparado, ya descartado por
medición. No cambia la escritura del reproceso mensual.

Verifica importes escritos antes de rollback y restauración exacta después,
incluyendo NULL originales. Listas de verificación limitadas a 500 IDs. Nunca
COMMIT. Error de escritura/verificación/rollback detiene pruebas siguientes.
Se registran inicio/fin por bloque, tiempo total de escritura, rollback y zona.
El tiempo total incluye generación SQL y salida de diagnóstico; tiempos de bloque
incluyen generación SQL/Execute. No atribuir todo a CPU del motor.

Máximo 3 zonas x 10000 filas x 3 tamaños = 90000 modificaciones temporales
acumuladas entre transacciones; cada transacción toca a lo sumo 10000 filas.
Primera prueba recomendada 3000. No reproduce el volumen transaccional de todo
un mes. Si más bloques son necesarios, decidirlo tras medir; no extrapolar
garantías. Bloques de mil podrían fallar por límites del motor/proveedor: se
revierte y reporta, no se modifica automáticamente el reproceso.

Preparación: compilar/instalar nueva versión, transacción anterior finalizada,
respaldo y copia de pruebas sin escrituras de usuarios. Detener servicio desde
Fortuner. Runtime rechaza puerto de Contabilidad abierto, pero no puede detectar
otras aplicaciones contables. Ejecutar desde PowerShell con acceso al DPAPI.

    $instalacionContable = Get-Content 'C:\ProgramData\DSI\CONTABDSI27\installation.json' -Raw | ConvertFrom-Json
    & $instalacionContable.executable benchmark-reproceso --config $instalacionContable.configuration --company 026 --month 3 --sample 3000 --extended --confirm-test-writes

Compartir JSON completo; no repetir el mes como benchmark. Ninguna prueba de
escritura real contra servidor remoto se ejecutó desde desarrollo. Pruebas
locales de límites, rotación, bloques, errores y reversión con motor simulado.
