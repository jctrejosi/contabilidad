# Apertura contable 00 y reconstrucción de MSALDO

## Regla implementada

Un lote cuyo MES es 00 representa saldos iniciales, como ACTUMES0 del
proyecto Harbour. Al actualizarlo se guarda en MOV01 con CONMES=0, CONCIA
de la compañía activa y CONANO del ejercicio de su fecha. TFECHA conserva
la fecha válida digitada; no se inventa una fecha con mes cero.

La verificación y la contabilización exigen CT00 habilitado y el ejercicio
activo de CONCTR. Crear/modificar partidas de apertura también verifica CT00;
no exige abrir enero si la apertura tiene fecha de enero.

- CONMAE.MSALDO acumula débito menos crédito en la cuenta y sus padres.
- CONTERCE.MSALDO acumula el importe firmado en la cuenta y el tercero.
- COCENTRO mantiene DEB00 y CRE00 al contabilizar cuentas con centro.
- Los meses normales conservan MACMDEBxx/MACMCRExx y DEBxx/CRExx.
- Se conservan ADO sobre ODBC, el bloqueo de escritura y la transacción única.

La interfaz de lotes denomina 00 «Saldos iniciales» (antes «Multiperíodo»).
No utilizar 00 para documentos ordinarios de varios meses.

## Reproceso

La API y el formulario admiten desde 00 hasta 12. Para 00 se lee el movimiento
consolidado MOV01 filtrado por compañía, ejercicio y CONMES=0. Se reconstruye
el saldo firmado en MSALDO; no existen ni se solicitan MACMDEB00/MACMCRE00.
Puede elegirse solo 00 o incluirlo en un rango junto con meses normales.

Se conserva la escritura diferencial optimizada: un campo por cuenta para
apertura y CASE por ID para auxiliares existentes; los nuevos auxiliares nacen
con el saldo correcto. Los duplicados de CONTERCE se consolidan en el ID menor
y los demás se dejan en cero solo en los períodos seleccionados. Repetir el
reproceso con los mismos datos deja los mismos valores.

Un reproceso 01–12 no altera MSALDO. Un reproceso 00 reemplaza también saldos
obsoletos por cero cuando no tienen respaldo en el movimiento de apertura.
No deduce saldos del año anterior ni del movimiento ordinario. No se convierte
automáticamente información histórica mal contabilizada en enero: hace falta
identificar y corregir sus documentos de origen antes de reconstruir.

El alcance de este reproceso sigue siendo CONMAE y CONTERCE. La reconstrucción
general de COCENTRO no se incorpora en este cambio; su apertura sí se actualiza
al contabilizar y al anular el documento.

## Anulación

El período real se consulta en MOV01 por compañía, ejercicio, documento,
comprobante, tipo y fecha. Si es 00, se valida CT00 y se recalculan MSALDO
de cuentas y terceros y DEB00/CRE00 de los centros afectados después de retirar
el movimiento. Si una identidad documental aparece en varios períodos se
rechaza la anulación automática para evitar retirar un conjunto ambiguo.

## Prueba de aceptación

1. En una compañía de pruebas, habilitar el período 00 y comprobar el año activo.
2. Crear un lote 00 cuadrado, con una cuenta que maneje tercero y otra contrapartida;
   añadir un centro cuando la cuenta lo requiera. Usar una fecha real del ejercicio.
3. Verificar y actualizar. Comprobar MOV01.CONMES=0, MSALDO firmado de cuenta,
   padres y tercero; los acumulados mensuales deben conservarse.
4. Ejecutar reproceso 00–00. Debe reconstruir la apertura desde MOV01.
5. Repetirlo: debe informar sin cambios si no hubo otras operaciones.
6. Anular el documento: comprobar la reversión de apertura y la conservación
   del movimiento de enero y demás meses.

## Validación realizada

92 pruebas automatizadas de reproceso, contabilización, lotes, anulación y apertura
correctas; compilación Vite correcta. Las pruebas interceptan ADO y no escriben
en Advantage. No se ejecutó contabilización ni reproceso contra la base activa.
La prueba de aceptación en el servidor queda por realizar con la nueva compilación.

Este cambio no genera por sí solo un lote desde otra compañía ni migra saldos
históricos; implementa la actualización y reconstrucción solicitadas.
