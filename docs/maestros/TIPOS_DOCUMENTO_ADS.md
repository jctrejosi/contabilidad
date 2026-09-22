# Tipos de documento conectados a Advantage

## Naturaleza del catálogo

La opción **Configuración > Tipos de documento** consulta directamente
`VISDOCUM`. Esta tabla no tiene campo `CIA`: sus 127 registros se comparten
entre todas las compañías y el servicio no recibe un código de compañía.

La clave funcional actual es `CODIGO`, de dos caracteres. La tabla también
posee `ID`, pero el sistema original busca y relaciona los documentos mediante
`CODIGO`.

## Función dentro del proceso contable

Un tipo de documento determina cómo se comporta una operación antes de generar
movimientos. Entre otras reglas, establece:

- El módulo que lo origina: Cartera (1), Inventarios (2), Cuentas por pagar
  (3) o Contabilidad (9).
- Si el movimiento es débito, crédito, neutro, entrada, salida o factura.
- El consecutivo vigente y si el usuario puede modificarlo (`MODICONSE`).
- El prefijo y el tipo de comprobante contable relacionado.
- Si contabiliza, afecta bancos, genera cuentas por pagar o modifica costos.
- Si convierte el documento en otro tipo y cuál es ese documento destino.
- Reglas de pagos, traslados, repetición, DIAN, retenciones y contabilización.
- Hasta nueve parejas débito/crédito usadas como plantillas automáticas.

Por eso `VISDOCUM` no es solo una lista: es un maestro operativo usado por
ventas, inventarios, cartera, pagos y generación de asientos contables.

## Campos presentados en la primera vista

| Campo | Interpretación correcta |
| --- | --- |
| `CODIGO` | Código global del documento. |
| `NOMBRE` | Denominación visible. |
| `MODULO` | Proceso que administra el documento. |
| `TIPO` | Naturaleza del movimiento según el módulo. |
| `CONSE` | Consecutivo vigente. |
| `MODICONSE` | Permite modificar el consecutivo al operar. |
| `PREFIJO` | Prefijo documental. |
| `COMPRO` | Comprobante contable relacionado. |
| `ICONTAB` | Indica si genera contabilización. |
| `CONVER` / `DOCCONVER` | Conversión hacia otro tipo documental. |

La exportación CSV agrega controles de cuentas por pagar y bancos. El contrato
del servidor conserva además otros indicadores operativos para ampliar la
pantalla sin reinterpretar los datos.

## Diferencias frente a la maqueta inicial

La maqueta suponía numeración Manual/Automática y campos llamados “tercero
obligatorio” y “centro obligatorio”. Esas columnas no existen así en la tabla.
La nueva pantalla utiliza la semántica comprobada en `DOCUMVIS`, `TRAB_DOC` y
`GRABADOC` del proyecto original.

## Escrituras pendientes

El sistema original permite crear, modificar y eliminar, pero una escritura
puede afectar 89 columnas y múltiples procesos. Antes de habilitarla se debe:

1. Validar la unicidad global de `CODIGO`.
2. Aplicar formularios diferentes para cada módulo.
3. Validar `COMPRO` contra comprobantes y `DOCCONVER` contra `VISDOCUM`.
4. Validar todas las cuentas de las plantillas débito/crédito.
5. Impedir eliminación si el código está usado en documentos o movimientos.
6. Proteger el consecutivo frente a escrituras concurrentes.
7. Registrar una auditoría equivalente a `AUDIVIS`.

Hasta completar estas reglas, la pantalla ofrece consulta, filtros y
exportación real, sin guardar datos simulados en el navegador.
