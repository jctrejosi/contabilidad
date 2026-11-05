# Prueba comparativa de cursor ADO editable

Flag exclusivo --cursor-test en benchmark-reproceso. Muestra 1..10000,
primera prueba1000. Usa plan real y compara mismos IDs/importes pendientes:
CASE1000 vs Recordset servidor/keyset/optimista sobre la misma conexión ODBC.
No inserta, limpia, crea tablas ni cambia escritor de reproceso.

Consulta limitada CIA e IDs por bloque1000, columnas CIA/ID/importes del mes.
Supports(adUpdate) obligatorio. Update usa tuplas de nombres/valores, sin mover
cursor con edición pendiente. Valida IDs sin repetidos/ausentes. Cierra cada
cursor antes de lectura verificadora y rollback. Si falla, intenta CancelUpdate
antes de Close; nunca hace CommitTrans ni cambia conexión transaccional.
Verifica valores escritos y restauración exacta tras rollback en cada método.

Mide lectura/apertura/recorrido/Update/cierre dentro del tiempo del cursor.
No presenta ese tiempo como CPU del motor. ADO puede traducir Update a SQL por
fila: soporte y rendimiento del proveedor deben comprobarse en servidor real.
Si es más lento no se incorpora. Cualquier error detiene; no fallback silencioso.
No diferencias pendientes => no escribe; elegir mes aún sin corregir.

Referencia de constantes y soporte:
https://learn.microsoft.com/en-us/office/client-developer/access/desktop-database-reference/cursoroptionenum
https://learn.microsoft.com/en-us/office/client-developer/access/desktop-database-reference/cursortype-property-ado

Compilar/instalar detenido. Base de pruebas respaldada sin otras escrituras.
Reutiliza credenciales DPAPI y comprobación de puerto. No se ejecuta esta prueba
contra servidor remoto desde desarrollo.

    $instalacionContable = Get-Content 'C:\ProgramData\DSI\CONTABDSI27\installation.json' -Raw | ConvertFrom-Json
    & $instalacionContable.executable benchmark-reproceso --config $instalacionContable.configuration --company 026 --month 7 --sample 1000 --cursor-test --confirm-test-writes

Si julio ya se confirmó, elegir otro mes con diferencias. No borrar acumulados.
Pruebas unitarias de mismos importes/conexión, read-only, IDs faltantes/repetidos,
cierre, rollback global tras error cursor, límites y flags excluyentes.
