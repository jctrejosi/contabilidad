# Importaciones contables hacia lotes

## Objetivo

La opción **Movimientos → Importaciones** convierte un archivo externo en un
lote contable de revisión. Importar no contabiliza ni modifica saldos. El lote
queda en estado **Borrador** y debe pasar posteriormente por las acciones
**Verificar** y **Actualizar** de la opción Lotes.

## Flujo funcional

1. El usuario selecciona un archivo XLSX, CSV, TXT o ADT de máximo 10 MB.
2. El servidor lee hasta 5.000 filas y devuelve las hojas, columnas y valores.
3. El usuario relaciona las columnas del archivo con los campos contables.
4. La pantalla normaliza fechas, importes y códigos y presenta todas las filas.
5. **Crear lote para revisión** confirma directamente la cabecera y las
   partidas en estado Borrador. No se escribe movimiento mensual en esta etapa.
6. El usuario abre Lotes, revisa o edita las partidas y ejecuta **Verificar**.
   En este punto se aplican las reglas contables completas y se muestran las
   inconsistencias encontradas.
7. Cuando el lote quede verificado, el usuario ejecuta **Actualizar** para
   contabilizarlo.

## Destino en Advantage

- `CONMOVI`: cabecera del lote, compañía, código, nombre, mes, responsable,
  estado, fecha, totales y número de partidas.
- `CONLOTES`: cuenta, tercero, centro de costo, comprobante, tipo y número de
  documento, fecha, débito, crédito, base, concepto y documento afectado.

La creación usa una sola transacción ADO por ODBC. Un error en cualquier fila
revierte la cabecera y todo el detalle, evitando lotes parciales.

## Controles al importar

- Código de lote de cuatro letras o números y único para la compañía.
- Fecha y campos con formato y longitud aptos para almacenar la partida.
- Una partida tiene débito o crédito, nunca ambos.

La existencia y configuración de cuentas, terceros, centros, comprobantes y
tipos documentales, el período, las bases fiscales, los documentos duplicados
y los balances se comprueban posteriormente con **Verificar** en Lotes.
**Actualizar** vuelve a ejecutar esos controles y no contabiliza un lote con
inconsistencias.

## API

- `POST /api/importaciones/leer`: interpreta el archivo sin grabar información.
- `POST /api/importaciones/lote?dryRun=false`: crea el lote Borrador.

La API conserva `dryRun=true` como recurso de diagnóstico técnico, pero la
interfaz normal de Importaciones no lo ejecuta antes de crear el lote.

El procesamiento definitivo del lote continúa usando las funciones existentes
de verificación y actualización; por tanto, una importación no dispone de una
ruta alternativa para saltarse los controles contables.
