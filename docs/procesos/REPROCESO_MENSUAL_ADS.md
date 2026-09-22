# Reproceso mensual en Advantage

## Objetivo contable

La opción **REPROCESO MENSUAL** reconstruye los acumulados mensuales cuando el
libro de movimientos es correcto, pero los saldos auxiliares dejaron de
coincidir. No crea, elimina ni cambia comprobantes en MOV01.

## Correspondencia con CONTABDSI Harbour

El programa original (`REPRO02`, `REPRO21`, `REPRO25` y `REPROMES`) limpiaba el
mes elegido, recorría la tabla física `MOV01` a `MOV12` y acumulaba cada partida
en la cuenta y sus padres de longitudes 1, 2, 4, 6, 9 y 12. También guardaba el
detalle cuenta–NIT como filas auxiliares de `CONMAE`.

La versión web aplica dos cambios de modelo:

- Lee exclusivamente `MOV01`, filtrando obligatoriamente `CONCIA`, `CONANO` y
  `CONMES`, porque esta tabla contiene todos los meses.
- Conserva en `CONMAE` únicamente los acumulados de la cuenta maestra y sus
  padres. Los acumulados por cuenta–NIT se reconstruyen en `CONTERCE`.

Los débitos se guardan positivos en `MACMDEBxx`; los créditos mantienen el signo
negativo de `MOV01` en `MACMCRExx`, igual que en la contabilización directa.

## Flujo implementado

1. La pantalla obtiene el ejercicio activo desde `CONCTR` y toma la compañía de
   la sesión.
2. **Simular proceso** agrupa MOV01 sin escribir y compara el resultado con los
   campos actuales de CONMAE y CONTERCE.
3. Se bloquea la ejecución si MOV01 contiene una cuenta inexistente, una cuenta
   que exige tercero sin NIT o un NIT mayor a 11 caracteres. Si existen filas
   cuenta–NIT repetidas en CONTERCE, la simulación lo advierte y el reproceso
   deja el saldo en una fila principal sin borrar el historial duplicado.
4. Con un motivo obligatorio, **Confirmar y ejecutar** vuelve a leer MOV01,
   inicia una transacción ADO, pone en cero únicamente los meses seleccionados y
   escribe los importes recalculados.
5. Ante cualquier error se ejecuta `RollbackTrans`; si todo termina bien se
   ejecuta `CommitTrans` y se registra la intervención en `VISAUDI`.

La captura directa y el reproceso comparten un candado de escritura dentro del
servicio Python para que no modifiquen simultáneamente los mismos acumulados.
La simulación usa el proveedor OLE DB habitual. La escritura masiva usa ADODB
sobre el controlador Advantage ODBC (`MSDASQL`), porque el proveedor
`adsoledb64.dll` 11.10.0.24 instalado presenta una excepción nativa C0000005 en
operaciones SQL largas de 64 bits. Los auxiliares con saldo se limpian en lotes
de 500 IDs para evitar una sentencia larga y no recorrer filas que ya están en
cero. Si la simulación no encuentra diferencias, el backend responde **Sin
cambios** y no inicia otra transacción ni duplica la auditoría.

## Tablas afectadas

| Tabla | Uso |
| --- | --- |
| `MOV01` | Fuente de verdad; solo lectura. |
| `CONEMP` | Validación y nombre de la compañía. |
| `CONCTR` | Validación del ejercicio activo. |
| `CONMAE` | Reemplazo de débitos/créditos mensuales de cuentas y padres. |
| `CONTERCE` | Reemplazo/creación de acumulados mensuales por cuenta y NIT. |
| `FADCLI` | Nombre del tercero al crear un auxiliar nuevo. |
| `VISAUDI` | Bitácora posterior a la confirmación. |

`COCENTRO` no se recalcula aquí: en Harbour la llamada `ACTUCOS` dentro de este
proceso estaba comentada y la generación de acumulados por centro de costo era
una opción independiente.
