# Cuentas por cobrar

**Ruta:** `cartera`
**Archivo:** `Interface_web/src/pages/finance/Cartera.tsx`
**Datos:** `receivables`, `receipts`, `applications`, `collections`,
`writeOffs`, `advances` (dirección `AR`), `impairmentProvisions`,
`customerReconciliations`.

## Objetivo

Controlar las partidas abiertas por cliente, aplicar recaudos, medir la
antigüedad de la cartera, gestionar promesas de pago y dar salida controlada a
partidas incobrables.

## Pantallas

| Slug | Pantalla | Qué permite |
|---|---|---|
| `partidas` | Bandeja de cartera | Ver saldos, vencimientos, días de mora y abrir el detalle de cada partida |
| `recibos` | Recibos de caja | Registrar recaudos y consultar su disponibilidad |
| `aplicacion` | Aplicación de pagos | Cruzar un recibo con una o varias partidas del mismo cliente |
| `edades` | Edades de cartera | Matriz por cliente y rangos de vencimiento |
| `estados-cuenta` | Estados de cuenta | Documentos, notas, recibos y saldo corrido por cliente |
| `cobro` | Cobro y promesas | Gestiones, compromisos y cumplimiento |
| `ajustes` | Castigos y ajustes | Solicitud, aprobación y rechazo de castigos |
| `anticipos` | Anticipos de clientes | Registro y aplicación de dineros recibidos sin factura |
| `deterioro` | Provisión por deterioro | Cálculo por edades, aprobación y contabilización de la pérdida esperada |
| `conciliacion` | Conciliación con clientes | Auxiliar contra estado de cuenta y confirmación del cliente |

## Funcionalidad implementada

### Bandeja de cartera

- KPIs de saldo total, vencido, por vencer en 15 días y recaudo del mes.
- Aging compacto con los cinco rangos.
- Filtros por texto y estado.
- Tabla con documento, cliente, NIT, emisión, vencimiento, días vencidos,
  saldo y estado.
- Drawer con historial de gestiones, promesas, notas y acciones de cobro.
- Acciones: registrar gestión, crear promesa, castigar, aplicar anticipo,
  ir al estado de cuenta.

### Recibos de caja

- Registro con cliente, fecha, medio de pago, cuenta bancaria, valor y
  referencia.
- El recibo nace `Sin aplicar` y queda disponible para cruce.
- Al registrarse aumenta el saldo de la cuenta de tesorería asociada.
- Tabla con valor, aplicado, saldo y estado.

### Aplicación de pagos

- Vista dividida: recibos con saldo disponible a la izquierda y partidas
  abiertas del mismo cliente a la derecha.
- Aplicación parcial por partida con diferencia en vivo.
- Bloquea valores superiores al disponible del recibo o al saldo de la
  partida.
- Actualiza `receipt.applied`, `receipt.status`, `receivable.balance` y
  `receivable.status`; agrega la aplicación al histórico.

### Edades de cartera

- Matriz por cliente con columnas Corriente, 1–30, 31–60, 61–90 y +90.
- Totales por columna y por cliente.
- Barra de composición y filtro por cliente.

### Estados de cuenta

- Selector de cliente y período.
- Documentos, notas crédito y recibos con débitos, créditos y saldo corrido.
- Resumen de vencido y por vencer.
- Impresión del estado de cuenta.

### Cobro y promesas

- KPIs de promesas pendientes, vencidas y cumplidas.
- Lista de gestiones con cliente, canal, resultado, fecha, promesa y estado.
- Registro de llamada, correo, visita o WhatsApp.
- Promesa con fecha y valor; se refleja en la partida.
- Acciones para marcar la promesa como cumplida o incumplida.

### Castigos y ajustes

- Solicitud de castigo con partida, valor, motivo y solicitante.
- Aprobación o rechazo con trazabilidad.
- Al aprobar, la partida baja a cero y queda en estado `Castigada`; no se
  elimina y conserva su histórico.

### Anticipos de clientes

- Registro de anticipo con cliente, fecha, valor y referencia.
- Saldo disponible por anticipo.
- Aplicación a una factura del mismo cliente, total o parcial.
- El remanente permanece disponible.

### Provisión por deterioro

- Calcula la cartera abierta por los cinco rangos de edad (`AGING_BUCKETS`).
- Aplica la política NIIF 9 por tramo: Corriente 0 %, 1–30 1 %, 31–60 5 %,
  61–90 15 % y +90 35 %.
- Muestra provisión requerida, provisión registrada, cobertura y variación del
  período (cargo o recuperación).
- Genera el registro del período con apertura, cargo, recuperación y cierre.
- Flujo de estados: `Calculada` → `Aprobada` → `Contabilizada`.
- El cargo es `max(0, requerido − apertura)` y la recuperación
  `max(0, apertura − requerido)`.
- Historial por período con aprobador y nota.

### Conciliación con clientes

- Compara el saldo del auxiliar (`1305`) contra el estado de cuenta del cliente.
- KPIs de clientes conciliados, diferencias, saldo auxiliar y diferencia total.
- Marca la cuenta como conciliada con nota y usuario; si hay diferencia, ajusta
  el saldo auxiliar al estado de cuenta y deja el soporte en la nota.
- Registra confirmación del cliente y fecha de revisión.
- Acción para enviar el estado de cuenta y dejar la solicitud en la nota.

## Reglas de negocio

- Una aplicación no puede exceder el saldo del recibo ni el de la partida.
- Una partida pagada no admite aplicaciones adicionales.
- El estado de la partida se deriva del saldo y de la gestión.
- Las promesas no modifican el saldo; solo documentan el compromiso.
- El castigo requiere motivo y aprobación; conserva la partida.
- Un anticipo solo se aplica al mismo cliente.
- La provisión se calcula sobre partidas con saldo mayor a cero.
- La provisión contabilizada no se recalcula hasta que se apruebe un nuevo
  cálculo del período.
- Conciliar con diferencia exige nota y deja el saldo auxiliar igual al estado
  de cuenta.
- Los importes se normalizan a pesos sin decimales.

## Cobertura funcional

| Función | Dónde se cubre |
|---|---|
| F-AR-001 Partida desde factura | Creación automática desde Facturación; `partidas` |
| F-AR-002 Recibos de caja | `recibos` |
| F-AR-003 Aplicación de pagos | `aplicacion` |
| F-AR-004 Pagos parciales y múltiples | `aplicacion` + historial |
| F-AR-005 Edades de cartera | `edades` |
| F-AR-006 Estado de cuenta | `estados-cuenta` |
| F-AR-007 Gestión de cobro | `cobro` |
| F-AR-008 Promesas de pago | `cobro` |
| F-AR-009 Castigo de cartera | `ajustes` |
| F-AR-010 Anticipos de cliente | `anticipos` |
| F-AR-011 Conciliación de recibos | `recibos` + módulo Tesorería |
| F-AR-012 Notas crédito | Notas de Facturación + `partidas` |
| F-AR-013 Provisión por deterioro | `deterioro` |
| F-AR-014 Conciliación con clientes | `conciliacion` |

## Integración pendiente

- Aplicar automáticamente el recibo contra la partida sugerida por el banco.
- Enviar recordatorios reales por correo o mensajería.
- Generar el asiento contable del recibo y del castigo en Advantage.
- Contabilizar la provisión por deterioro en el libro legado (hoy solo cambia
  el estado de la provisión).
- Sincronizar la conciliación con el estado de cuenta emitido al cliente.
- Exportar estado de cuenta a PDF/XLSX con plantilla corporativa.
