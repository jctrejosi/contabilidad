# Funcionalidades — `ledger`

Origen funcional (inventario de partida): Odoo `account.move`,
`account.move.line`, `account.journal`, `ir.sequence`, `account_reports`
(libros y mayor, Enterprise) y `account` (bloqueos y audit trail, Community).

## F-LED-001 — Asiento manual

**Debe hacer.** Crear un asiento con fecha, diario, tipo, moneda, tasa,
descripción, tercero y líneas; guardarlo en borrador y contabilizarlo.

**Reglas.** Fecha dentro de periodo abierto; diario y tipo válidos; compañía
correcta; descripción obligatoria; no se contabiliza sin cuadre; el asiento
manual no puede usar cuentas de módulos automáticos si la política lo prohíbe.

**Datos/API.** `led.asiento`; `POST /api/v1/ledger/asientos`,
`POST /asientos/{id}/contabilizar`.

**Aceptación.** Asiento descuadrado rechazado; fecha bloqueada rechazada; el
asiento contabilizado queda inmutable.

---

## F-LED-002 — Líneas, naturaleza y cuadre

**Debe hacer.** Registrar líneas con cuenta, tercero, centro, débito, crédito,
base, impuesto, referencia y vencimiento.

**Reglas.** Cada línea tiene débito XOR crédito, mayor que cero; débitos =
créditos en moneda funcional; cuenta afectable; tercero/centro según flags;
importes con dos decimales.

**Datos/API.** `led.asiento_linea`; validación en el servicio de posteo.

**Aceptación.** Línea con débito y crédito se rechaza; el cuadre se valida antes
de reservar secuencia; los flags de cuenta se respetan.

---

## F-LED-003 — Lotes de contabilización

**Debe hacer.** Crear lotes con código, descripción y líneas; guardarlos en
borrador sin afectar el libro.

**Reglas.** Código único por compañía; una línea pertenece a un solo lote; el
lote no contabiliza hasta validarse; se puede editar mientras esté en borrador.

**Datos/API.** `led.lote`, `led.lote_linea`;
`POST /api/v1/ledger/lotes`, `POST /lotes/{id}/lineas`.

**Aceptación.** Un lote borrador no afecta saldos; código duplicado se rechaza;
editar una línea no altera el libro.

---

## F-LED-004 — Validación de lote

**Debe hacer.** Ejecutar todas las reglas contables sobre el lote y devolver
errores por línea antes de contabilizar.

**Reglas.** Valida cuentas, terceros, centros, comprobantes, periodo, bases,
duplicados y cuadre; un solo error bloquea la contabilización completa; la
validación es reproducible.

**Datos/API.** `POST /api/v1/ledger/lotes/{id}/validar`.

**Aceptación.** Lote con descuadre no avanza; los errores indican línea y causa;
corregir y revalidar permite continuar.

---

## F-LED-005 — Contabilización y secuencia

**Debe hacer.** Convertir un lote validado o un asiento manual en asiento
contabilizado, reservando número y actualizando efectos.

**Reglas.** Una transacción; secuencia con bloqueo; estado pasa a
`contabilizado`; se crean CxC/CxP o compromisos si el origen lo requiere; se
audita y se publica evento.

**Datos/API.** `POST /api/v1/ledger/asientos/{id}/contabilizar` (interno para
módulos); `ledger.post`.

**Aceptación.** Si falla un efecto, no se reserva número; no se contabiliza dos
veces; el evento se emite después del commit.

---

## F-LED-006 — Reversión

**Debe hacer.** Revertir un asiento contabilizado con asiento espejo, motivo y
referencia al original.

**Reglas.** No se edita ni borra el original; el espejo invierte débitos y
créditos; el periodo debe estar abierto o existir permiso; se reabren/ajustan
partidas y compromisos; la reversión es única por asiento.

**Datos/API.** `POST /api/v1/ledger/asientos/{id}/revertir`;
`led.asiento.reversal_of_id`.

**Aceptación.** Revertir dos veces no duplica; el original queda `revertido`; el
motivo es obligatorio y auditado.

---

## F-LED-007 — Multimoneda

**Debe hacer.** Registrar importes en moneda del documento y funcional, con tasa
congelada y diferencia de cambio.

**Reglas.** La tasa se toma al crear el documento; la moneda funcional manda en
el cuadre; la diferencia se reconoce al pago o al cierre; no se recalcula historia
al cambiar la tasa.

**Datos/API.** `led.asiento.moneda/tasa`; `asiento_linea.debito_moneda`.

**Aceptación.** Asiento en USD cuadra en COP; el pago en otra fecha genera
diferencia; cambiar la tasa no altera el asiento.

---

## F-LED-008 — Impuestos en el asiento

**Debe hacer.** Registrar base, impuesto y cuenta por línea, con la determinación
del módulo `taxes`.

**Reglas.** La base y la cuota se guardan; la cuenta del impuesto coincide con la
configuración; no se reparte un total a mano; la posición fiscal se aplica antes
de postear.

**Datos/API.** `led.asiento_linea.base/impuesto_id/retencion_id`.

**Aceptación.** La suma de impuestos del asiento = reporte fiscal; cambiar la
cuenta de impuesto exige configuración; una línea gravada sin base se rechaza.

---

## F-LED-009 — Asientos intercompañía

**Debe hacer.** Registrar operaciones entre compañías con cuentas de enlace y
referencia recíproca.

**Reglas.** Cada compañía ve su asiento; se usan cuentas de enlace; el par
debe cuadrar; requiere aprobación; la consolidación elimina el efecto.

**Datos/API.** `led.asiento_relacion`; comando específico
`POST /api/v1/ledger/intercompania`.

**Aceptación.** El asiento de enlace cuadra en ambas compañías; no se mezclan
compañías en una línea; la eliminación se genera en consolidación.

---

## F-LED-010 — Mayor y auxiliares

**Debe hacer.** Consultar movimientos por cuenta, tercero, centro y periodo, con
saldo inicial, débitos, créditos y saldo final.

**Reglas.** Solo asientos contabilizados; filtros por compañía y periodo;
orden cronológico; saldo inicial = saldo final del periodo anterior; exportación
con el mismo conjunto de datos.

**Datos/API.** `GET /api/v1/ledger/mayor`, `/auxiliares`.

**Aceptación.** El mayor cuadra con los asientos; el saldo inicial encadena; la
exportación no trunca filas.

---

## F-LED-011 — Saldos y balance de comprobación

**Debe hacer.** Calcular saldos por cuenta y generar el balance de comprobación
por periodo, con y sin terceros/centros.

**Reglas.** Derivado del libro; no editable; incluye cuentas con movimiento o
saldo; muestra débitos, créditos y saldo; cuadra por nivel.

**Datos/API.** `led.saldo_*` (derivadas); `GET /api/v1/reporting/comprobacion`.

**Aceptación.** La suma de débitos = créditos; el saldo por cuenta padre = suma
de hijas; el informe coincide con el mayor.

---

## F-LED-012 — Inmutabilidad y auditoría del libro

**Debe hacer.** Bloquear edición/borrado de asientos contabilizados y registrar
cada operación con actor, fecha, motivo y hash.

**Reglas.** Sin `UPDATE`/`DELETE` sobre asientos posteados; el hash encadena; la
auditoría es append-only; una corrección es una reversión.

**Datos/API.** `sec.auditoria`; triggers/constraints en `led.asiento`.

**Aceptación.** Un intento de edición directa falla; la auditoría detecta
alteración; toda reversión queda trazada.
