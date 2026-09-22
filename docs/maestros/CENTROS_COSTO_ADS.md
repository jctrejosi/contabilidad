# Centros de costo conectados a Advantage

## Alcance implementado

La opción **Configuración > Centros de costo** consulta directamente la tabla
`CONCECOS`. El usuario no puede ver datos de otra contabilidad: la interfaz
envía la compañía activa y el servidor aplica siempre `WHERE CIA = ...`.

La clave funcional no es solamente `CODIGO`; es la combinación `(CIA, CODIGO)`.
En la base revisada existen 222 registros para la compañía 027. Las demás
compañías disponibles no tienen centros registrados y la pantalla informa el
catálogo vacío sin mezclar datos de la 027.

## Campos conservados

| Campo CONCECOS | Uso contable en la aplicación |
| --- | --- |
| `CIA` | Compañía propietaria del centro; filtro obligatorio. |
| `CODIGO` | Identificador del centro dentro de la compañía. |
| `NOMBRE` | Descripción visible para seleccionar y consultar el centro. |
| `CARPETA` | Agrupación definida por el sistema original. |
| `TIPO` | Clasificación numérica heredada del formulario original. |
| `HABILITA` | Estado habilitado, no habilitado o sin definir. |
| `HIST` | Indicador histórico conservado para procesos posteriores. |
| `VALOR` | Valor asociado al centro. |
| `PORCEN` | Porcentaje asociado. |
| `VLRPOR` | Valor asociado al porcentaje. |
| `CODITEM` | Código de ítem relacionado. |
| `CUENTA` | Cuenta contable relacionada. |
| `CONCEPTO` | Concepto descriptivo relacionado. |

## Jerarquía mostrada

`CONCECOS` no posee un campo padre. La relación visual se deriva de forma
conservadora:

- Un código de tres caracteres es hijo si sus dos primeros caracteres existen
  como otro `CODIGO` en la misma compañía.
- Si el prefijo no existe, el centro se muestra como raíz. No se crean padres
  ficticios ni se ocultan filas anómalas.
- La lista permanece expandida y sin controles para contraer.

Esta jerarquía sirve para lectura y navegación; no cambia los datos físicos.

## Escrituras pendientes

El programa original permitía crear, modificar y borrar, y editaba `CODIGO`,
`NOMBRE`, `CARPETA` y `TIPO`. La nueva pantalla mantiene **Crear** y las
acciones de fila deshabilitadas temporalmente. Antes de escribir en Advantage
se debe comprobar:

1. Duplicidad de `(CIA, CODIGO)` y formato heredado del código.
2. Uso del centro en acumulados (`COCENTRO`) y tablas de movimientos.
3. Reglas para cambiar el código sin dejar referencias huérfanas.
4. Política para `HABILITA`, especialmente los registros actuales en `NULL`.
5. Auditoría equivalente a la rutina `AUDIVIS` del sistema original.
6. Transacción y reversión completa ante cualquier error ADO.

Hasta completar esas validaciones, la opción funciona como consulta real y
exportación CSV, sin guardar datos simulados en el navegador.
