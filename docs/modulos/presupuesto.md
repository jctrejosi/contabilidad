# Presupuestos

**Ruta:** `presupuesto`
**Archivo:** `Interface_web/src/pages/finance/Presupuesto.tsx`
**Datos:** `budgets` (versiones y líneas) y `budgetAlerts`.

## Objetivo

Construir versiones presupuestales por año y escenario, distribuir el valor
anual por mes, aprobar con acta, controlar compromisos y ejecución y generar
alertas por desviación.

## Pantallas

| Slug | Pantalla | Qué permite |
|---|---|---|
| `versiones` | Bandeja de presupuestos | Versiones, escenarios, estado y versión vigente |
| `editor` | Editor de presupuesto | Grilla cuenta/centro/mes editable con totales |
| `distribucion` | Distribución mensual | Reparto uniforme, porcentual o manual |
| `aprobacion` | Aprobación | Acta, aprobador y rechazo motivado |
| `ejecucion` | Ejecución y compromisos | Disponible, comprometido, ejecutado y semáforo |
| `comparativo` | Comparativo y escenarios | Variaciones entre versiones y gráfico |
| `alertas` | Alertas presupuestales | Umbrales, silencio y reactivación |

## Funcionalidad implementada

### Versiones

- KPIs de número de versiones, presupuesto vigente, ejecutado y disponible.
- Tabla con año, nombre, escenario, estado, responsable, total, ejecutado y
  disponible.
- Creación de versión con año, escenario y nombre.
- Duplicado de versión con copia de líneas.
- Marcado como vigente (solo versiones aprobadas).
- Cierre de una versión aprobada con motivo, siempre que no tenga
  compromisos abiertos; la versión cerrada queda solo para consulta.
- Acceso directo al editor y al comparativo.

### Editor

- Selector de versión.
- Grilla con cuenta, nombre, centro y doce meses editables.
- Totales por fila, por columna y anual.
- Panel lateral con presupuesto, ejecutado, comprometido y disponible.
- Indicador de cambios sin guardar.
- Guardar cambios, agregar línea y eliminar línea.
- Las versiones Aprobada o Cerrada son de solo lectura.

### Distribución

- Selección de versión y línea.
- Valor anual y métodos uniforme, porcentual y manual.
- Doce inputs mensuales y porcentajes.
- Validación de suma 100 %.
- Aplicación a una línea o a todas las líneas de la versión.
- Vista previa de totales y comparación con la versión vigente.

### Aprobación

- Lista de versiones en Borrador o En revisión.
- Detalle con totales, variación contra la versión vigente, justificación y
  comentarios.
- Aprobación con acta obligatoria y usuario aprobador distinto del
  responsable.
- Rechazo con motivo obligatorio.
- Historial de aprobación y estado.

### Ejecución y compromisos

- Tabla por cuenta y centro con presupuesto, comprometido, ejecutado,
  disponible y porcentaje de ejecución.
- Semáforo por consumo.
- Filtros por cuenta y centro.
- Registro de compromiso con validación de disponible.
- Liberación de compromiso.
- Exportación CSV.
- Recalculo desde el estado de la versión.

### Comparativo y escenarios

- Selección de dos versiones o escenarios.
- Tabla con presupuesto, ejecutado, comprometido, disponible y variación
  absoluta y porcentual.
- Totales y gráfico de barras por cuenta.
- Exportación CSV.
- Los escenarios no generan asientos ni afectan la contabilidad.

### Alertas

- Tabla con cuenta, centro, tipo, mensaje, severidad, fecha y estado.
- Filtros por severidad y estado.
- Silencio con motivo obligatorio y reactivación.
- Resumen por severidad.
- Configuración de umbral que crea una alerta o muestra el resultado.

## Reglas de negocio

- Una versión aprobada o cerrada no se edita.
- Solo una versión puede estar vigente.
- El total de una línea es la suma de sus doce meses.
- `disponible = presupuesto − ejecutado − comprometido`.
- Un compromiso no puede exceder el disponible.
- La distribución porcentual debe sumar 100 %.
- La aprobación exige acta y aprobador distinto del responsable.
- Los escenarios son versiones independientes y no contabilizan.

## Cobertura funcional

| Función | Dónde se cubre |
|---|---|
| F-BGT-001 Versiones | `versiones` |
| F-BGT-002 Líneas por cuenta, centro y periodo | `editor` |
| F-BGT-003 Aprobación | `aprobacion` |
| F-BGT-004 Control presupuestal | `ejecucion` |
| F-BGT-005 Compromisos | `ejecucion` |
| F-BGT-006 Ejecución real | `ejecucion` |
| F-BGT-007 Comparativo | `comparativo` |
| F-BGT-008 Cierre | Botón Cerrar en `versiones`, con motivo y bloqueo de edición |
| F-BGT-009 Escenarios | `versiones` + `comparativo` |
| F-BGT-010 Alertas | `alertas` |

## Integración pendiente

- Alimentar la ejecución desde los asientos contabilizados del libro.
- Congelar versiones aprobadas en base de datos.
- Adjuntar acta y documentos de soporte.
- Notificar alertas por correo o centro de notificaciones.
- Importar/exportar plantillas Excel.
