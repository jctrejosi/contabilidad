# Comprobantes contables conectados a Advantage

## Alcance implementado

La opción **Configuración > Comprobantes** consulta directamente `CONTICOM`.
El catálogo pertenece a cada contabilidad y toda consulta exige la compañía
activa:

```sql
WHERE CIA = <compañía seleccionada>
```

La clave funcional correcta es `(CIA, CODIGO)`. En la base revisada existen 28
comprobantes para la compañía 027; las demás compañías no tienen registros.

## Función en el proceso contable

El comprobante agrupa y clasifica los asientos que llegan a contabilidad. Los
tipos documentales de `VISDOCUM` señalan en `COMPRO` cuál comprobante debe usar
cada operación. Ejemplos actuales son recibos de caja, consignaciones,
comprobantes de egreso, facturas de compra, depreciaciones y causaciones.

No debe confundirse:

- `VISDOCUM`: define el comportamiento del documento, su módulo, tipo,
  consecutivo y reglas de integración.
- `CONTICOM`: define el catálogo de comprobantes contables disponible para una
  compañía.

## Campos reales

| Campo | Uso |
| --- | --- |
| `CIA` | Compañía propietaria; filtro obligatorio y parte de la clave. |
| `CODIGO` | Código del comprobante, actualmente de dos caracteres. |
| `NOMBRE` | Nombre contable del comprobante. |
| `HIST` | Indicador histórico heredado. |
| `CTABDES` | Descripción auxiliar heredada. |

La pantalla anterior incluía `TIPO` y `CONSECUTIVO`, pero esos campos no
existen en `CONTICOM`. Se retiraron para evitar mostrar información ficticia.

## Escrituras pendientes

El programa original permite crear, modificar y eliminar código y nombre. La
nueva interfaz conserva las acciones bloqueadas hasta implementar:

1. Unicidad de `(CIA, CODIGO)`.
2. Validación de referencias desde `VISDOCUM.COMPRO`.
3. Validación de uso en cabeceras, lotes y movimientos contabilizados.
4. Prohibición de cambiar un código que ya tenga referencias o estrategia de
   actualización transaccional.
5. Auditoría equivalente a `AUDIVIS`.
6. Transacción y reversión segura en Advantage.

Mientras se completan esas reglas, la opción ofrece consulta real, búsqueda y
exportación CSV sin almacenar información simulada en el navegador.
