# Cuentas por pagar

**Ruta:** `cuentas-pagar`
**Archivo:** `Interface_web/src/pages/finance/CuentasPagar.tsx`
**Datos:** `payables`, `proposals`, `payments`, `retentions`, `advances`
(dirección `AP`), `expenses`, `invoices` (notas de proveedor) y `accounts`.

## Objetivo

Administrar obligaciones con proveedores, construir propuestas de pago,
aprobar con segregación de funciones, ejecutar pagos, certificar retenciones y
controlar gastos y anticipos.

## Pantallas

| Slug | Pantalla | Qué permite |
|---|---|---|
| `obligaciones` | Bandeja de obligaciones | Ver valor bruto, retenciones, neto, prioridad y estado |
| `propuestas` | Propuestas de pago | Agrupar obligaciones, aprobar y ejecutar el pago |
| `pagos` | Pagos a proveedores | Registrar egresos y aplicarlos a obligaciones |
| `retenciones` | Retenciones y certificados | Consultar, certificar y exportar retenciones |
| `anticipos` | Anticipos a proveedores | Registrar y aplicar anticipos |
| `programacion` | Edades y programación | Aging, proyección semanal y cola priorizada |
| `estados-cuenta` | Estados de cuenta | Documentos, pagos y notas con saldo corrido por proveedor |
| `gastos` | Gastos y reembolsos | Registrar, aprobar y reembolsar gastos |
| `notas` | Notas de proveedor | Crear notas crédito y ajustar la CxP |

## Funcionalidad implementada

### Bandeja de obligaciones

- KPIs de total por pagar, vencido, programado y pagado del mes.
- Filtros por búsqueda, estado, prioridad y proveedor.
- Tabla con documento, proveedor, NIT, emisión, vencimiento, bruto,
  retenciones, neto y estado.
- Drawer con detalle, pagos aplicados, notas y acciones.
- Acciones: pagar total o parcialmente, incluir en propuesta, emitir nota
  crédito de proveedor y abrir programación.

### Propuestas de pago

- Creación con selección múltiple de obligaciones abiertas.
- Total bruto, retenciones y neto en vivo.
- Cuenta de salida y observaciones.
- Estados Borrador, Pendiente aprobación, Aprobada, Rechazada y Pagada.
- Envío a aprobación y aprobación con usuario distinto del creador.
- Rechazo con motivo obligatorio.
- Ejecución: genera un pago, reduce las obligaciones a cero y marca la
  propuesta como Pagada.

### Pagos

- Registro con proveedor, fecha, cuenta, valor, medio, referencia y
  distribución entre una o varias obligaciones.
- Actualiza el saldo de la cuenta bancaria.
- Aplica el pago a las CxP y cambia su estado a Pagada.
- Tabla con número, fecha, proveedor, cuenta, valor, método y estado.
- Conserva el detalle de aplicaciones en el comprobante.

### Retenciones y certificados

- Tabla por proveedor, documento, concepto, base, tarifa, valor, período y
  certificado.
- Filtro por período.
- Certificación con numeración `RET-2026-00XX`.
- Exportación CSV de la consulta.
- KPIs de total retenido y certificado.

### Anticipos a proveedores

- Registro con proveedor, fecha, valor y referencia.
- Saldo disponible por anticipo.
- Aplicación a una obligación del mismo proveedor.
- Actualiza el saldo de la CxP y el aplicado del anticipo.

### Edades y programación

- Aging de CxP por rangos de vencimiento.
- Proyección de pagos por semana con base en vencimientos reales.
- Cola priorizada por prioridad y fecha.
- Disponible de tesorería calculado con las cuentas activas.
- Creación de propuesta desde la selección.

### Estados de cuenta

- Selector de proveedor y período.
- Movimientos de factura de compra (crédito), nota crédito (débito) y pago
  aplicado (débito).
- Saldo inicial, saldo corrido y saldo final.
- Resumen de facturado, pagado/notas y saldo con el proveedor.
- Impresión del estado de cuenta.

### Gastos y reembolsos

- Registro de gasto con empleado, fecha, categoría, centro de costo, valor,
  IVA, soporte y nota.
- Aprobación condicionada a que exista soporte.
- Reembolso que cambia el estado y deja trazabilidad.
- Tabla con estado y valor.

### Notas de proveedor

- Selección de factura de compra contabilizada.
- Motivo y valor máximo igual al total del documento.
- Creación de la nota en `state.invoices` y reducción de la CxP asociada.
- Histórico visible en la bandeja de obligaciones.

## Reglas de negocio

- `payable.balance` nunca es negativo.
- Una obligación pagada no se incluye en nuevas propuestas.
- Una obligación no puede estar dos veces en la misma propuesta.
- El creador de una propuesta no puede aprobarla.
- Una propuesta aprobada no se edita.
- El pago no puede superar el saldo de la obligación ni el disponible de la
  cuenta.
- Un gasto sin soporte no se aprueba.
- La retención certificada es inmutable.

## Cobertura funcional

| Función | Dónde se cubre |
|---|---|
| F-AP-001 Partida desde factura | Creación automática desde Facturación; `obligaciones` |
| F-AP-002 Propuestas de pago | `propuestas` |
| F-AP-003 Aprobación segregada | `propuestas` |
| F-AP-004 Pagos y aplicación | `pagos` + drawer |
| F-AP-005 Retenciones | `retenciones` |
| F-AP-006 Certificados | `retenciones` |
| F-AP-007 Anticipos | `anticipos` |
| F-AP-008 Gastos y reembolsos | `gastos` |
| F-AP-009 Notas de proveedor | `notas` |
| F-AP-010 Programación y priorización | `programacion` |
| F-AP-011 Conciliación de pagos | `pagos` + módulo Tesorería |
| F-AP-012 Edades y estado de cuenta | `programacion` + `estados-cuenta` |

## Integración pendiente

- Aprobación por niveles según monto y política de la compañía.
- Generación de archivo bancario y confirmación del banco.
- Cálculo de retenciones con UVT y conceptos vigentes del año.
- Certificados en PDF y envío al proveedor.
- Asiento contable del pago y de la retención en Advantage.
