# Balance de comprobación acumulado

## Propósito contable

El informe permite comprobar los saldos y movimientos acumulados del plan de
cuentas de la compañía activa. Presenta por cuenta:

- saldo anterior al rango solicitado;
- débitos acumulados entre el mes inicial y el mes final;
- créditos acumulados entre el mes inicial y el mes final;
- saldo actual después de incorporar esos movimientos.

También muestra totales de control para comparar débitos y créditos. Una
diferencia distinta de cero se presenta al usuario y no se corrige ni se
oculta automáticamente.

## Correspondencia con Harbour

La implementación toma como referencia las funciones `INFOR02(1)`,
`INFOR21A`, `INFOR21B`, `MOVMENSU` y `CONSALDO` de
`C:\Xedit4\CONTABDSI\Source\CONINFOR.PRG` y
`C:\Xedit4\CONTABDSI\Source\CONSULTA.PRG`.

La equivalencia es:

| Concepto | Campo o cálculo en Advantage |
|---|---|
| Saldo inicial del ejercicio | `CONMAE.MSALDO` |
| Saldo anterior | `MSALDO` + débitos y créditos de los meses anteriores al rango |
| Débitos del período | Suma de `MACMDEBxx` desde el mes inicial al final |
| Créditos del período | Suma de `MACMCRExx`, almacenados negativos y presentados positivos |
| Saldo actual | Saldo anterior + débitos + créditos almacenados negativos |

Para pasivos, patrimonio e ingresos, clases 2, 3 y 4, el saldo se presenta con
el signo de su naturaleza, igual que en el informe original.

## Alcance y filtros

- La compañía se valida en `CONEMP` y todas las cuentas se filtran por
  `CONMAE.CIA`.
- El ejercicio se valida contra `CONCTR.CTANO`, porque los campos acumulados de
  `CONMAE` corresponden al año de trabajo activo.
- Se consultan solamente las filas maestras sin `NITN`, evitando duplicar los
  auxiliares por tercero.
- Los niveles disponibles conservan los del programa original: Cuenta (4),
  Subcuenta (6), Auxiliar 1 (9) y Auxiliar 2 (12).
- Por defecto se excluyen cuentas totalmente en cero. El usuario puede incluirlas.

## Servicios

- `GET /api/informes/balance-comprobacion`: genera la vista previa con datos
  reales de `CONMAE`.
- `GET /api/informes/balance-comprobacion/exportar?formato=xlsx`: descarga el
  Excel con valores numéricos, filtros, encabezado fijo y formato contable.
- `GET /api/informes/balance-comprobacion/exportar?formato=pdf`: descarga el
  PDF horizontal, paginado y con encabezados repetidos.

Los dos archivos exportados usan exactamente los mismos parámetros y registros
que la vista previa.
