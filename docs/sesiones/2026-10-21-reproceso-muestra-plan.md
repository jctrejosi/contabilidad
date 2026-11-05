# Comparar orden real de diferencias e ID

--plan-sample es excluyente con modos anteriores. Usa ejercicio activo de CONCTR
y plan completo de solo lectura del mes solicitado. Si hay errores contables
aborta antes de escribir. Selecciona primeras N third_row_updates (máximo30000)
y compara mismos IDs/importes, primero orden original, después orden ID. No
inventa valores si el plan no tiene diferencias. No limpia ni crea auxiliares.

Cada orden ejecuta CASE1000 en transacción única con verificación previa a
rollback y restauración exacta después. Verifica que snapshot contenga todos
los IDs; rechaza repetidos. Cualquier error detiene; rollback fallido exige
revisar servidor. Se conserva snapshot original, incluyendo NULL. Carga de plan
no entra en tiempo de escritura y se informa separada. Total no representa
reproceso completo ni efecto de escrituras previas o transacción mensual grande.
Orden fijo/caché siguen siendo limitaciones. Logs no exponen NIT ni valores.

Compilar/instalar con servicio detenido, copia respaldada, sin otros escritores.
Ejecutar mismo benchmark con --company026 --month6 --sample10000 --plan-sample
--confirm-test-writes (argumentos separados). Junio es solo ejemplo: elegir un
mes que todavía tenga diferencias, no reprocesarlo previamente. Año automático.
Mes ya corregido devuelve resultados vacíos sin transacción. No borrar saldos.
No se modifica método real del reproceso ni se ha ejecutado prueba remota aquí.

Pruebas: ambos órdenes conservan IDs/importes, sin cambios no escribe y error
revierte sin probar siguiente orden. Se ejecutan además suites previas.
