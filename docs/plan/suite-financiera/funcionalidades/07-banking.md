# Funcionalidades — `banking`

Origen funcional (inventario de partida): diarios bancarios y extractos de
`account` (Community); conciliación asistida, reglas y diferencias de
`account_accountant` (Enterprise).

## F-BNK-001 — Cuentas bancarias

**Debe hacer.** Registrar cuentas con banco, tipo, número, moneda, cuenta
contable, saldo inicial y estado.

**Reglas.** Número único por compañía; cuenta contable de la compañía; moneda
compatible con el diario; una cuenta con movimientos no se elimina; el número se
enmascara según rol.

**Datos/API.** `bnk.cuenta_bancaria`; CRUD en `/api/v1/banking/cuentas`.

**Aceptación.** No se crea sin cuenta contable; cuenta con movimientos no se
elimina; el saldo inicial se refleja en el libro.

---

## F-BNK-002 — Extractos manuales

**Debe hacer.** Capturar un extracto con fecha desde/hasta, saldo inicial,
movimientos y saldo final.

**Reglas.** Saldo inicial + movimientos = saldo final; no se acepta descuadre;
cada línea tiene fecha, referencia, descripción, débito/crédito y saldo; el
extracto nace `abierto`.

**Datos/API.** `bnk.extracto`, `bnk.extracto_linea`;
`POST /api/v1/banking/extractos`.

**Aceptación.** Extracto descuadrado se rechaza; las líneas son editables
mientras esté abierto; al conciliar se bloquea.

---

## F-BNK-003 — Importación de extractos

**Debe hacer.** Importar CSV, XLSX y OFX con mapeo de columnas, vista previa y
detección de duplicados.

**Reglas.** Hash de archivo evita reimportar; se valida formato, moneda, fechas e
importes; se rechazan filas inválidas con número y causa; `dryRun` disponible;
carga idempotente.

**Datos/API.** `POST /api/v1/banking/extractos/importar`.

**Aceptación.** Reimportar el mismo archivo no duplica; un archivo inválido no
deja líneas parciales; el resumen informa importadas/rechazadas.

---

## F-BNK-004 — Validación de saldos

**Debe hacer.** Verificar saldo inicial, movimientos y saldo final, y comparar
con el saldo contable de la cuenta.

**Reglas.** La diferencia debe ser explicada o quedar como partida conciliatoria;
no se cierra el extracto con descuadre; la validación es reproducible.

**Datos/API.** `POST /api/v1/banking/extractos/{id}/validar`.

**Aceptación.** Extracto descuadrado no se cierra; la diferencia se reporta; la
validación no altera el libro.

---

## F-BNK-005 — Reglas de conciliación

**Debe hacer.** Configurar reglas por referencia, importe, fecha, tercero/NIT,
descripción y tolerancia, con prioridad.

**Reglas.** Reglas ordenadas por prioridad; una regla no aplica dos veces a la
misma línea; se puede simular; cambios auditados.

**Datos/API.** `bnk.regla`; CRUD en `/api/v1/banking/reglas`.

**Aceptación.** La simulación muestra los matches; la prioridad se respeta; una
regla inactiva no se aplica.

---

## F-BNK-006 — Conciliación automática

**Debe hacer.** Ejecutar las reglas y proponer matches entre líneas de extracto y
líneas del libro.

**Reglas.** Match exacto por importe/referencia; fuzzy por fecha/tercero; un
match no puede usar la misma línea dos veces; el resultado se revisa antes de
confirmar; se registra el criterio.

**Datos/API.** `POST /api/v1/banking/conciliaciones/automaticas`.

**Aceptación.** Un match exacto se propone; la misma línea no se reutiliza; el
usuario puede aceptar/rechazar; el criterio queda auditado.

---

## F-BNK-007 — Conciliación manual

**Debe hacer.** Seleccionar líneas del extracto y del libro y enlazarlas total o
parcialmente.

**Reglas.** Suma conciliada ≤ importe de la línea de extracto; una línea de libro
puede conciliarse con varias de extracto y viceversa; el usuario ve el saldo
pendiente; se exige motivo si hay diferencia.

**Datos/API.** `bnk.conciliacion`; `POST /api/v1/banking/conciliaciones`.

**Aceptación.** No se concilia de más; el pendiente se actualiza; la conciliación
se puede revertir con auditoría.

---

## F-BNK-008 — Diferencias y ajustes

**Debe hacer.** Contabilizar comisiones, intereses, diferencias de cambio y
partidas no identificadas.

**Reglas.** La diferencia se explica con un asiento nuevo; no se ajusta el saldo
a mano; la cuenta de gasto/ingreso es configurable; la partida no identificada
queda pendiente con seguimiento.

**Datos/API.** `led.asiento` vía `ledger.post`; `bnk.conciliacion.diferencia`.

**Aceptación.** La diferencia queda con asiento; el extracto cuadra; la partida
conciliatoria se reporta.

---

## F-BNK-009 — Transferencias entre cuentas

**Debe hacer.** Registrar transferencias entre cuentas bancarias/caja con fecha,
importe, referencia y asiento único.

**Reglas.** Origen y destino de la misma compañía; moneda compatible o conversión;
no afecta resultados; comisión se contabiliza aparte; estado
`registrada`/`conciliada`.

**Datos/API.** `bnk.transferencia`; `POST /api/v1/banking/transferencias`.

**Aceptación.** El asiento debita destino y acredita origen; no hay doble
contabilización; la comisión se registra.

---

## F-BNK-010 — Cheques

**Debe hacer.** Registrar cheques emitidos con número, beneficiario, importe,
fecha y estado; controlar cobro y anulación.

**Reglas.** Número único por cuenta; importe > 0; un cheque anulado conserva
histórico; el cobro se concilia con el extracto; no se reutiliza número.

**Datos/API.** `bnk.cheque`; `POST /api/v1/banking/cheques`.

**Aceptación.** Cheque anulado no afecta el saldo dos veces; el cobro concilia;
el número no se repite.

---

## F-BNK-011 — Caja y cierre de caja

**Debe hacer.** Administrar cajas con responsable, movimientos de ingreso/egreso,
arqueo y cierre.

**Reglas.** Movimiento exige concepto y responsable; el saldo de caja = ingresos −
egresos; el cierre cuadra contra el arqueo; la diferencia se explica; la caja
cerrada no recibe movimientos.

**Datos/API.** `bnk.caja`, `bnk.caja_movimiento`;
`POST /api/v1/banking/caja/{id}/cerrar`.

**Aceptación.** El cierre cuadra; la diferencia queda auditada; no se mueve una
caja cerrada.

---

## F-BNK-012 — Reporte de partidas conciliatorias

**Debe hacer.** Listar extractos, líneas pendientes, conciliaciones y diferencias
por cuenta y periodo.

**Reglas.** Incluye saldo bancario, saldo contable y diferencia; las partidas
antiguas se destacan; exportable; no trunca.

**Datos/API.** `GET /api/v1/banking/conciliacion/pendientes`,
`GET /api/v1/banking/conciliacion/reporte`.

**Aceptación.** El reporte explica el 100 % de la diferencia; el saldo bancario
cuadra con el extracto; las partidas antiguas se identifican.
