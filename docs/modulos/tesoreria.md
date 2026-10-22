# Tesorería y bancos

**Ruta:** `tesoreria`
**Archivo:** `Interface_web/src/pages/finance/Tesoreria.tsx`
**Datos:** `accounts`, `statements`, `statementLines`, `rules`,
`reconciliations`, `transfers`, `checks`, `pettyCashes`, `receipts`,
`payments` y `payables` para la posición proyectada.

## Objetivo

Controlar la posición de dinero, administrar cuentas bancarias y cajas,
importar extractos, conciliar el banco contra el libro, ejecutar
transferencias y cheques y explicar las partidas conciliatorias.

## Pantallas

| Slug | Pantalla | Qué permite |
|---|---|---|
| `panel` | Panel de tesorería | Posición consolidada, movimientos del día, conciliación y alertas |
| `cuentas` | Cuentas bancarias | Catálogo de cuentas, saldos y responsables |
| `extractos` | Extractos bancarios | Consulta, importación y validación |
| `conciliacion` | Conciliación bancaria | Cruce extracto vs. libro, automático y manual |
| `reglas` | Reglas de conciliación | Condiciones, prioridad, simulación y estado |
| `transferencias` | Transferencias | Traslados entre cuentas con comisión |
| `cheques` | Cheques | Emisión, cobro y anulación |
| `caja` | Caja menor | Movimientos, arqueo y cierre |
| `partidas` | Partidas conciliatorias | Pendientes, antigüedad, diferencia y ajustes |

## Funcionalidad implementada

### Panel de tesorería

- Posición total de cuentas activas y desglose por banco/caja.
- Entradas y salidas del día.
- Extractos sin conciliar y porcentaje de avance.
- Cheques emitidos pendientes de cobro.
- Cajas abiertas y saldo disponible.
- Próximos pagos desde las obligaciones abiertas.
- Alertas por saldo bajo y cobertura de pagos.

### Cuentas bancarias

- Alta con banco, tipo, número, moneda, cuenta contable, saldo inicial y
  responsable.
- Número enmascarado en la tabla (`****4589`).
- Activación e inactivación.
- No se elimina una cuenta con saldo o movimientos.
- Saldo actualizado por recibos, pagos y transferencias.

### Extractos

- Lista por cuenta y período con saldo inicial, saldo final, estado y archivo.
- Detalle de líneas con fecha, referencia, descripción, débito, crédito,
  saldo, conciliado y estado.
- Importación simulada con validación de cuadre.
- Validación del extracto y bloqueo cuando queda conciliado.

### Conciliación

- Selector de extracto.
- Vista dividida entre líneas del extracto y partidas del libro.
- Sugerencias por referencia e importe.
- Conciliación automática: toma las líneas con sugerencia, registra la
  conciliación, marca el valor conciliado y actualiza el estado del extracto.
- Conciliación manual: elige línea, referencia de libro, valor y nota.
- Validación de no conciliar por encima del valor de la línea.
- Acción para desconciliar con trazabilidad.

### Reglas

- Tabla con nombre, campo, operador, valor, acción, prioridad, coincidencias y
  estado.
- Creación de reglas por referencia, importe, descripción o tercero.
- Activación/desactivación.
- Simulación sobre las líneas pendientes con conteo de coincidencias.

### Transferencias

- Origen, destino, fecha, valor, comisión, referencia y estado.
- Valida cuentas distintas y saldo suficiente.
- Descuenta valor y comisión del origen y suma el valor al destino.
- Registra la operación en la bitácora.

### Cheques

- Emisión con número, cuenta, beneficiario, fecha, vencimiento y valor.
- Estado Emitido, Cobrado o Anulado.
- Anulación conserva el histórico.
- El cobro queda disponible para conciliación.

### Caja menor

- Tarjetas por caja con responsable, base, saldo y estado.
- Movimientos de ingreso y egreso con concepto, soporte y responsable.
- Actualización del saldo.
- Cierre con arqueo: calcula la diferencia y bloquea nuevos movimientos.

### Partidas conciliatorias

- Reporte de líneas pendientes o con diferencia.
- Cuenta, fecha, descripción, valor, antigüedad y estado.
- Resumen de saldo bancario, saldo contable y diferencia.
- Ajuste conciliatorio con nota.
- Asignación de responsable.
- Exportación CSV.

## Reglas de negocio

- Un extracto no se cierra si su saldo inicial + movimientos no coincide con
  el saldo final.
- Una línea no se concilia por más de su valor.
- Una línea conciliada no se reutiliza.
- La conciliación no edita el recibo ni el pago; solo los enlaza.
- Una transferencia no genera resultado; la comisión se registra aparte.
- Una cuenta con saldo no se elimina.
- Una caja cerrada no acepta movimientos.
- El número de cheque no se reutiliza.

## Cobertura funcional

| Función | Dónde se cubre |
|---|---|
| F-BNK-001 Cuentas bancarias | `cuentas` |
| F-BNK-002 Extractos manuales | `extractos` |
| F-BNK-003 Importación de extractos | `extractos` |
| F-BNK-004 Validación de saldos | `extractos` |
| F-BNK-005 Reglas | `reglas` |
| F-BNK-006 Conciliación automática | `conciliacion` |
| F-BNK-007 Conciliación manual | `conciliacion` |
| F-BNK-008 Diferencias y ajustes | `partidas` |
| F-BNK-009 Transferencias | `transferencias` |
| F-BNK-010 Cheques | `cheques` |
| F-BNK-011 Caja y cierre | `caja` |
| F-BNK-012 Partidas conciliatorias | `partidas` |

## Integración pendiente

- Parseo real de CSV/XLSX/OFX y hash de archivo.
- Integración con APIs bancarias para saldos y movimientos.
- Contabilización de comisiones, rendimientos y diferencias.
- Adjuntar soportes y comprobantes a cada movimiento.
