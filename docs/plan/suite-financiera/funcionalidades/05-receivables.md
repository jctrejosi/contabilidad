# Funcionalidades — `receivables` (cartera / CxC)

Origen funcional (inventario de partida): partidas abiertas y aplicación de
pagos de `account` (Community); aging, mayor por tercero y recordatorios de
`account_reports` y `account_followup` (Enterprise).

## F-AR-001 — Partida por cobrar desde factura

**Debe hacer.** Crear una partida abierta por cada factura de venta contabilizada,
con tercero, cuenta, fecha, vencimiento, moneda, importe original y saldo.

**Reglas.** Nace del posteo, no se crea a mano; el saldo inicial = total de la
factura; una factura de contado puede nacer vencida y pagada; la partida pertenece
a la compañía del documento.

**Datos/API.** `ar.cxc`; creado por `ledger.post`; `GET /api/v1/receivables/cxc`.

**Aceptación.** Toda factura contabilizada tiene su CxC; el saldo inicial cuadra
con el documento; no existe CxC sin asiento.

---

## F-AR-002 — Recibos de caja

**Debe hacer.** Registrar recibos con tercero, fecha, medio de pago, cuenta
bancaria/caja, moneda, tasa, importe y referencia.

**Reglas.** Importe > 0; cuenta bancaria de la compañía; medio de pago válido;
contabiliza en el libro; puede aplicar a una o varias CxC; si no se aplica, queda
como anticipo.

**Datos/API.** `ar.recibo`; `POST /api/v1/receivables/recibos`.

**Aceptación.** El recibo genera asiento y disponible; no se registra en cuenta
de otra compañía; el sobrante queda como anticipo.

---

## F-AR-003 — Aplicación de pagos

**Debe hacer.** Aplicar un recibo a una o varias CxC, parcial o totalmente.

**Reglas.** Aplicación ≤ saldo de la CxC y ≤ disponible del recibo; moneda
compatible o conversión con diferencia de cambio; bloqueo de la partida al
aplicar; actualización de estados.

**Datos/API.** `ar.aplicacion_pago`;
`POST /api/v1/receivables/recibos/{id}/aplicar`.

**Aceptación.** La suma aplicada no supera el recibo; el saldo de la CxC se
reduce; la aplicación repetida no duplica.

---

## F-AR-004 — Pagos parciales y múltiples

**Debe hacer.** Permitir varias aplicaciones por CxC y varias CxC por recibo,
con estados `parcial` y `pagada`.

**Reglas.** El estado se deriva del saldo; una CxC pagada no recibe más
aplicaciones; una aplicación revertida devuelve el saldo; el histórico se
conserva.

**Datos/API.** `ar.aplicacion_pago`, `ar.cxc.estado`.

**Aceptación.** Dos pagos parciales cierran la CxC; revertir uno reabre el saldo;
el estado coincide con la suma de aplicaciones.

---

## F-AR-005 — Edades de cartera (aging)

**Debe hacer.** Calcular la antigüedad de las partidas abiertas por rangos de
vencimiento (corriente, 1–30, 31–60, 61–90, +90).

**Reglas.** Se calcula por fecha de vencimiento, no de emisión; incluye saldo en
moneda funcional; excluye partidas castigadas; parámetros de rangos configurables.

**Datos/API.** `GET /api/v1/receivables/aging`.

**Aceptación.** La suma del aging = saldo de cartera; una partida cambia de rango
al pasar la fecha; el filtro por tercero/moneda funciona.

---

## F-AR-006 — Estado de cuenta por tercero

**Debe hacer.** Emitir el estado de cuenta con facturas, notas, recibos,
aplicaciones y saldo, en un rango de fechas.

**Reglas.** Solo documentos de la compañía; incluye saldo inicial y final; el
saldo final = suma de partidas abiertas; exportable a PDF/XLSX.

**Datos/API.** `GET /api/v1/receivables/estado-cuenta/{tercero}`.

**Aceptación.** El saldo final cuadra con cartera; los pagos aparecen aplicados;
el PDF coincide con la consulta.

---

## F-AR-007 — Gestión de cobro y recordatorios

**Debe hacer.** Registrar llamadas, correos, visitas y niveles de recordatorio;
generar cartas de cobro por nivel.

**Reglas.** Cada gestión tiene fecha, canal, resultado y usuario; los niveles se
configuran por días de mora; una carta no cambia el saldo; la promesa de pago es
una gestión con fecha/importe.

**Datos/API.** `ar.gestion_cobro`; `POST /api/v1/receivables/cxc/{id}/gestion`.

**Aceptación.** El historial de cobro es completo; el nivel se calcula por mora;
la carta generada refleja el saldo real.

---

## F-AR-008 — Promesas de pago

**Debe hacer.** Registrar promesas con fecha e importe y hacer seguimiento.

**Reglas.** La promesa no modifica la CxC; si se cumple, se aplica el pago; si se
incumple, se registra y escala; el reporte muestra promesas vencidas.

**Datos/API.** `ar.gestion_cobro` (tipo promesa) o `ar.promesa`.

**Aceptación.** La promesa aparece en el reporte; cumplirla no duplica el pago;
el incumplimiento genera alerta.

---

## F-AR-009 — Castigo de cartera

**Debe hacer.** Castigar una partida incobrable con motivo y aprobación,
generando el asiento de gasto/pérdida.

**Reglas.** Requiere permiso y motivo; el importe ≤ saldo; genera asiento; la
partida queda `castigada`; no se borra; se conserva para recuperación posterior.

**Datos/API.** `ar.castigo`; `POST /api/v1/receivables/cxc/{id}/castigar`.

**Aceptación.** El asiento cuadra; la cartera baja; la partida no admite pagos
posteriores sin reactivación auditada.

---

## F-AR-010 — Anticipos de cliente

**Debe hacer.** Registrar anticipos sin factura y aplicarlos a facturas futuras.

**Reglas.** El anticipo es un pasivo; se aplica total o parcialmente; al aplicar
se reduce el saldo de la factura; si sobra, permanece como anticipo; se identifica
por tercero y moneda.

**Datos/API.** `ar.anticipo`; `POST /api/v1/receivables/anticipos`.

**Aceptación.** El anticipo aplicado reduce la CxC; el remanente queda
disponible; no se aplica a otro tercero.

---

## F-AR-011 — Conciliación bancaria de recibos

**Debe hacer.** Enlazar recibos con líneas del extracto bancario y marcar la CxC
como conciliada.

**Reglas.** La conciliación no edita el recibo; suma de líneas = importe del
recibo; diferencias bancarias se contabilizan aparte; una conciliación revertida
devuelve el estado.

**Datos/API.** `bnk.conciliacion`; evento `extracto.conciliado`.

**Aceptación.** Un recibo conciliado no se reutiliza; la diferencia queda
explicada; el estado de la CxC es consistente.

---

## F-AR-012 — Notas crédito y ajustes de cartera

**Debe hacer.** Aplicar notas crédito a la CxC, reducir saldo y, si corresponde,
generar saldo a favor.

**Reglas.** La nota referencia la factura; el importe ≤ saldo; el saldo a favor
puede aplicarse a otra factura o devolverse; no se genera CxC negativa sin
autorización.

**Datos/API.** `inv.documento` tipo NC + `ar.cxc`;
`POST /api/v1/receivables/cxc/{id}/aplicar-nota`.

**Aceptación.** La cartera baja por el valor de la nota; el saldo a favor es
trazable; la factura original conserva su histórico.
