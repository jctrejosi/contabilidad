# Comparación acotada de escritura en Advantage

Comando compilable: benchmark-reproceso. Usa credenciales DPAPI existentes y
ADO/ODBC. No abre puerto ni inicia aplicación. No cambia método del reproceso.
Requiere --company, --month y --confirm-test-writes. --sample predeterminado
250, máximo 1000. Runtime rechaza puerto local de Contabilidad abierto.
Esto no detecta aplicaciones externas: operador debe garantizar base de pruebas,
respaldo y ausencia de escrituras concurrentes o transacciones anteriores.

Lee inventario real system.indexes de CONTERCE; no garantiza uso del índice.
Lee primeras N filas de CIA por ID, compara CASE 250, comando preparado
reutilizable por ID, CASE 25 y CASE 100. Cada método añade 0,01 al débito de la
muestra temporalmente y conserva crédito numérico. Verifica valor escrito,
ROLLBACK obligatorio y restauración exacta, incluidos NULL originales. No hay
COMMIT ni tablas nuevas. Error detiene prueba; fallo de rollback requiere
revisión del servidor, no se asume reversión por desconexión.

Salida JSON por etapa con flush, sin cuentas/NIT/contraseñas. Duración de escritura
incluye apertura de transacción/preparación; verificación de lectura queda fuera.
Duración de rollback separada. Muestra pequeña, mismos IDs, orden fijo y caché
caliente afectan resultados: no extrapolar a todo el mes como garantía. El
comando preparado puede no estar soportado por el proveedor; se revierte y
detiene, no adopta alternativa silenciosa.

En PowerShell elevado, después de recompilar/instalar y detener Contabilidad:

    $instalacionContable = Get-Content 'C:\ProgramData\DSI\CONTABDSI27\installation.json' -Raw | ConvertFrom-Json
    & $instalacionContable.executable benchmark-reproceso --config $instalacionContable.configuration --company 026 --month 3 --sample 250 --confirm-test-writes

La compañía 026 debe reemplazarse si es otra. Compartir salida completa y
conservar estado del reproceso anterior. Si cualquier restauración falla no
reiniciar prueba. Si todos los métodos son lentos, investigar servidor/índices
antes de integrar otro escritor. Si hay ganador, validar más muestras y luego
equivalencia contable y rollback integrado. No usar staging sin validar SQL y
permisos del motor real.

Pruebas locales: confirmación obligatoria, límites, cuatro rollback sin commit,
verificación de importes/restauración y fallo sin continuar. Suite runtime 9
pruebas existente correcta. No se accedió al servidor remoto ni se hizo una
escritura real de benchmark en esta entrega.
