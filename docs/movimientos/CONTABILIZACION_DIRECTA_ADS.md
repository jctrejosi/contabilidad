# Contabilización directa en Advantage

## Objetivo

La opción **Movimientos > Captura directa** ya no simula el guardado. El
frontend envía la cabecera y las partidas al backend Python y este abre
Advantage Data Server mediante ADO. El archivo JSON es únicamente el mensaje
HTTP entre React y Python: no se guarda en disco ni reemplaza a la base de
datos.

## Validaciones previas

Antes de iniciar la transacción se comprueba:

1. La compañía existe en `CONEMP`.
2. El año coincide con `CONCTR` y el campo `CTxx` del mes está habilitado.
3. El comprobante pertenece a la compañía en `CONTICOM`.
4. El tipo documental existe en la tabla global `VISDOCUM`.
5. Cada cuenta existe para la compañía en `CONMAE`, corresponde a la fila
   maestra y es afectable (`MTC`).
6. Si `MCTAPAGOS` está activo, el NIT es obligatorio, debe existir en
   `FADCLI` y no puede superar 11 caracteres porque ese es el tamaño físico
   de `CONTERCE.NIT`. Si está inactivo, no se acepta NIT.
7. Si `MCOSTOS` está activo, el centro es obligatorio y debe existir para la
   compañía en `CONCECOS`. Si está inactivo, no se acepta centro.
8. Las cuentas de IVA o retención requieren base.
9. Cada partida tiene débito o crédito, nunca ambos, y el total del documento
   está cuadrado.

La interfaz hace estas validaciones para orientar al usuario y Python vuelve a
hacerlas inmediatamente antes de grabar. La validación del servidor es la que
protege definitivamente los datos.

## Escrituras de la transacción

Todas las operaciones contables siguientes se realizan con una sola conexión
ADO y una transacción de Advantage:

| Orden | Tabla | Operación |
|---:|---|---|
| 1 | `VISDOCUM` | Incrementa `CONSE` si el tipo usa número automático. Si `MODICONSE` permite modificación, exige el número digitado. |
| 2 | `MOV01` | Inserta una fila por partida con `CONCIA`, `CONANO`, `CONMES`, cuenta, NIT, comprobante, centro, tipo, documento, concepto, base y usuario. |
| 3 | `COCENTRO` | Crea o acumula `DEBxx`/`CRExx` para las partidas cuya cuenta maneja centro de costo. |
| 4 | `CONTERCE` | Para cuentas con `MCTAPAGOS`, crea o acumula `MACMDEBxx`/`MACMCRExx` en la combinación exacta compañía + cuenta + NIT. Los padres de la cuenta no se acumulan en esta tabla. |
| 5 | `CONMAE` | Acumula `MACMDEBxx`/`MACMCRExx` en los niveles jerárquicos 1, 2, 4, 6, 9 y 12. También crea o actualiza el auxiliar cuenta + NIT cuando aplica. |
| 6 | `CONDOCUM` | Inserta una cabecera única del documento con compañía, comprobante, tipo, fecha, concepto y total débito. |

En `MOV01`, los débitos se guardan positivos y los créditos negativos, como
en el sistema Harbour. La misma convención se conserva en los acumulados de
crédito.

Si cualquier operación falla se ejecuta `RollbackTrans`: también se revierte
el consecutivo reservado y no quedan partidas parciales. La aplicación impide
duplicar la combinación compañía, documento, comprobante y tipo documental.

## Auditoría

Después del `CommitTrans`, se registra el equivalente de `AUDIVIS` en la tabla
libre `C:\VISADS\VISAUDI.ADT`, con módulo `T` y motivo **Ingreso y
Actualizacion Directa**. Esta tabla usa una conexión ADO independiente porque
no pertenece al diccionario `ADD_CONTAB`.

Si la auditoría falla, el documento no se vuelve a intentar automáticamente:
la respuesta indica que la contabilización fue exitosa y que la auditoría
quedó pendiente. Esto evita duplicar un documento que ya fue confirmado.

## Servicios utilizados

- `GET /api/periodo-operacion?cia=027`: consulta el ejercicio y los meses
  permitidos en `CONCTR`. La pantalla inicia con la fecha local del día y el
  servidor comprueba este control antes de contabilizar.
- `POST /api/movimientos/contabilizar`: realiza la contabilización definitiva.
- `POST /api/movimientos/contabilizar?dryRun=true`: recorre las mismas
  validaciones y escrituras, pero revierte la transacción. Se usa solamente
  para pruebas técnicas.

## Pruebas realizadas

Se validaron documentos balanceados con consecutivo automático, cuentas con
tercero y centro de costo, rechazo de mes cerrado y conexión a la auditoría.
Las pruebas contables se ejecutaron con reversión y se comprobó después que:

- no quedó el documento técnico en `MOV01`;
- no quedó cabecera en `CONDOCUM`;
- `CONTERCE` conservó los acumulados anteriores y no dejó filas nuevas;
- `VISDOCUM.CONSE` conservó su valor anterior;
- no quedó la fila técnica de auditoría en `VISAUDI`.

No se ha creado un documento contable permanente de prueba. El primer `Commit`
real debe hacerse desde la pantalla con un documento válido autorizado por el
usuario.
