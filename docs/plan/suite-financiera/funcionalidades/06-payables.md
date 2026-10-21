# Funcionalidades — `payables` (CxP y pagos)

Origen funcional (inventario de partida): facturas de proveedor y pagos de
`account` y `account_payment` (Community); propuestas/batch de pago, aging y
programación de `account_reports` y `account_accountant` (Enterprise); gastos de
`hr_expense` (Community).

## F-AP-001 — Partida por pagar desde factura

**Debe hacer.** Crear una CxP por cada factura de compra contabilizada, con
tercero, cuenta, vencimiento, moneda, importe original y saldo.

**Reglas.** Nace del posteo; el saldo = total − retenciones − anticipos; la
partida pertenece a la compañía; no se crea a mano.

**Datos/API.** `ap.cxp`; creado por `ledger.post`; `GET /api/v1/payables/cxp`.

**Aceptación.** Toda factura contabilizada tiene CxP; el saldo cuadra con el
asiento; no existe CxP sin documento.

---

## F-AP-002 — Propuestas de pago

**Debe hacer.** Seleccionar CxP por fecha de corte, vencimiento, tercero,
prioridad y disponible de tesorería; generar una propuesta con líneas.

**Reglas.** Solo CxP abiertas/parciales; una CxP no se incluye dos veces en la
misma propuesta; el total = suma de líneas; la propuesta es editable en borrador.

**Datos/API.** `ap.propuesta_pago`, `ap.propuesta_linea`;
`POST /api/v1/payables/propuestas`.

**Aceptación.** La propuesta no paga nada hasta aprobarse; no duplica CxP; el
total cuadra con las líneas.

---

## F-AP-003 — Aprobación segregada

**Debe hacer.** Aprobar o rechazar propuestas con usuario distinto al creador y
registro de motivo.

**Reglas.** Segregación de funciones; una propuesta aprobada no se edita; el
rechazo exige motivo; la aprobación queda auditada; montos altos pueden requerir
doble aprobación.

**Datos/API.** `POST /api/v1/payables/propuestas/{id}/aprobar`.

**Aceptación.** El creador no puede aprobar su propia propuesta; una propuesta
aprobada no cambia; el rechazo es trazable.

---

## F-AP-004 — Pagos y aplicación

**Debe hacer.** Registrar pagos totales o parciales, aplicar a CxP y contabilizar
el asiento de pago.

**Reglas.** Pago ≤ saldo de CxP; medio y cuenta válidos; retenciones y anticipos
se descuentan; aplicación bloquea la partida; el pago puede cubrir varias CxP.

**Datos/API.** `ap.pago`, `ap.aplicacion_pago`;
`POST /api/v1/payables/pagos`, `POST /pagos/{id}/aplicar`.

**Aceptación.** La CxP queda parcial/pagada según corresponda; el asiento cuadra;
revertir el pago reabre el saldo.

---

## F-AP-005 — Retenciones en la fuente, IVA e ICA

**Debe hacer.** Calcular retenciones por concepto, base, tarifa, UVT y momento
(causación o pago), y registrarlas como pasivo.

**Reglas.** Concepto vigente; base mínima en UVT; tarifa parametrizada; se
calcula por línea o documento según concepto; el pago neto descuenta la
retención; no se edita un certificado emitido.

**Datos/API.** `tax.concepto_retencion`, `ap.retencion`.

**Aceptación.** La retención cuadra con la base; el pasivo queda registrado; el
pago neto es correcto; el cambio de tarifa no altera historia.

---

## F-AP-006 — Certificados de retención

**Debe hacer.** Emitir certificados con número, fecha, tercero, base, concepto y
valor; consultar y exportar.

**Reglas.** Un certificado por periodo/tercero/concepto; inmutable una vez
emitido; numeración propia; se cruza con la declaración y la exógena.

**Datos/API.** `ap.retencion.certificado_numero`;
`GET /api/v1/payables/retenciones/certificados`.

**Aceptación.** El certificado cuadra con las retenciones del periodo; no se
emite dos veces; la exportación coincide con la consulta.

---

## F-AP-007 — Anticipos a proveedores

**Debe hacer.** Registrar anticipos, aplicarlos a facturas y controlar saldo por
tercero/moneda.

**Reglas.** El anticipo es un activo; se aplica total o parcialmente; no se
aplica a otro tercero; el remanente se refleja en el estado de cuenta.

**Datos/API.** `ap.anticipo`; `POST /api/v1/payables/anticipos`.

**Aceptación.** La factura reduce su CxP por el anticipo; el remanente es
trazable; no se aplica a una compañía distinta.

---

## F-AP-008 — Gastos y reembolsos

**Debe hacer.** Registrar gastos con soporte, aprobación, centro de costo y
asiento; reembolsar al empleado/tercero.

**Reglas.** Gasto exige soporte y categoría; aprobación según monto; contabiliza
contra la cuenta del gasto; el reembolso genera pago; el IVA descontable se
valida.

**Datos/API.** `ap.gasto`, `ap.gasto_linea`; `POST /api/v1/payables/gastos`.

**Aceptación.** Un gasto sin soporte no se aprueba; el asiento usa la cuenta
correcta; el reembolso cierra la CxP del empleado.

---

## F-AP-009 — Notas crédito de proveedor

**Debe hacer.** Registrar notas crédito de proveedor, aplicarlas a la CxP y
ajustar IVA/retenciones.

**Reglas.** Referencia a factura de compra; importe ≤ saldo; genera asiento;
reduce CxP y IVA; si genera saldo a favor, se aplica o se reclama.

**Datos/API.** `inv.documento` tipo NC compra + `ap.cxp`.

**Aceptación.** La CxP baja por la nota; el IVA se ajusta; el saldo a favor es
trazable.

---

## F-AP-010 — Programación y priorización de pagos

**Debe hacer.** Priorizar CxP por vencimiento, descuento por pronto pago, crítica
y saldo; proyectar flujo de pagos.

**Reglas.** La prioridad es configurable y auditable; un descuento por pronto
pago se reconoce como ingreso financiero; la proyección usa saldos reales; no se
programan CxP en disputa.

**Datos/API.** `ap.propuesta_pago`, `ap.prioridad`;
`GET /api/v1/payables/proyeccion`.

**Aceptación.** La proyección cuadra con CxP; el descuento se contabiliza; una
CxP en disputa no se paga por error.

---

## F-AP-011 — Conciliación bancaria de pagos

**Debe hacer.** Enlazar pagos con líneas del extracto y marcar la CxP como
conciliada.

**Reglas.** La conciliación no edita el pago; suma de líneas = importe del pago;
diferencias bancarias se contabilizan aparte; una conciliación revertida devuelve
el estado.

**Datos/API.** `bnk.conciliacion`; evento `extracto.conciliado`.

**Aceptación.** El pago conciliado no se reutiliza; la diferencia queda explicada;
la CxP queda consistente.

---

## F-AP-012 — Edades de CxP y estado de cuenta

**Debe hacer.** Calcular antigüedad de CxP y emitir estado de cuenta por
proveedor.

**Reglas.** Por vencimiento; incluye saldo en moneda funcional; excluye partidas
revertidas; el saldo final = suma de partidas abiertas; exportable.

**Datos/API.** `GET /api/v1/payables/aging`,
`GET /api/v1/payables/estado-cuenta/{tercero}`.

**Aceptación.** La suma del aging = saldo de CxP; el estado de cuenta cuadra;
los filtros por fecha y moneda funcionan.
