# Funcionalidades — `core`

Origen funcional (inventario de partida): Odoo `res.company`, `res.currency`,
`ir.sequence`, configuración de periodos y bloqueos (Community). Lo que sigue es
lo que **debemos implementar**, no una descripción de Odoo.

## F-CORE-001 — Compañías y datos fiscales

**Debe hacer.** Crear y mantener compañías con NIT, dígito de verificación,
razón social, régimen, responsabilidades, dirección, departamento, municipio,
país, moneda funcional, calendario y estado.

**Reglas.** NIT único y DV válido; no se cambia la moneda funcional si existen
asientos; una compañía inactiva no permite operar; los datos fiscales son
obligatorios para facturar y reportar.

**Datos/API.** `core.compania`; `POST/PUT/GET /api/v1/core/companias`.

**Aceptación.** No se crea sin NIT, DV, moneda y municipio; el cambio de moneda
con movimientos se rechaza; la compañía inactiva bloquea posteo y facturación.

---

## F-CORE-002 — Años contables

**Debe hacer.** Registrar cada año con fecha inicial y final, estado y relación
con los periodos.

**Reglas.** Un año no se solapa con otro de la misma compañía; no se abre un año
sin cerrar el anterior; el año cerrado no recibe asientos.

**Datos/API.** `core.compania_anio`; `POST/PUT/GET /api/v1/core/anios`.

**Aceptación.** Solapamiento rechazado; apertura del año siguiente exige cierre
del anterior; asiento en año cerrado rechazado.

---

## F-CORE-003 — Periodos contables

**Debe hacer.** Crear periodos mensuales y de ajuste (13–18), con fecha inicial,
final y estado.

**Reglas.** Sin solapamiento; el periodo debe existir para la fecha del
documento; los periodos de ajuste no reciben operaciones ordinarias sin permiso;
el estado es `abierto`, `cerrado` o `bloqueado`.

**Datos/API.** `core.periodo`; `GET/POST /api/v1/core/periodos`,
`POST /periodos/{id}/abrir`, `POST /periodos/{id}/cerrar`.

**Aceptación.** No se postea en periodo inexistente, cerrado o bloqueado; el
ajuste exige autorización; el cierre deja evidencia de auditoría.

---

## F-CORE-004 — Apertura y cierre de periodos

**Debe hacer.** Ejecutar el cierre con checklist, generar apertura del siguiente
y registrar el acto.

**Reglas.** Cierre idempotente; no se cierra con pendientes sin justificar;
reapertura solo con permiso especial y motivo; el saldo inicial del siguiente
periodo = saldo final del anterior.

**Datos/API.** `core.periodo`, `cls.cierre`;
`POST /api/v1/closing/cierres/{id}/ejecutar`.

**Aceptación.** Repetir el cierre no duplica asientos; la apertura cuadra; la
reapertura queda auditada.

---

## F-CORE-005 — Bloqueos por fecha

**Debe hacer.** Configurar bloqueos fiscal, de impuestos, de ventas, de compras y
duro, con fecha y motivo.

**Reglas.** Ningún asiento, pago o ajuste se registra antes de un bloqueo; el
bloqueo duro solo lo levanta un administrador; todo cambio queda auditado.

**Datos/API.** `core.bloqueo`; `POST/DELETE /api/v1/core/bloqueos`.

**Aceptación.** Posteo anterior al bloqueo rechazado; el bloqueo duro prevalece
sobre permisos de módulo; el levantamiento exige motivo.

---

## F-CORE-006 — Monedas

**Debe hacer.** Mantener monedas ISO con símbolo, decimales y estado.

**Reglas.** La moneda funcional de la compañía no se elimina; una moneda con
movimientos no se inactiva; los importes se guardan con la escala de la moneda.

**Datos/API.** `core.moneda`; `GET/POST/PUT /api/v1/core/monedas`.

**Aceptación.** Moneda con asientos no se inactiva; importes respetan decimales;
la moneda funcional está siempre activa.

---

## F-CORE-007 — Tasas de cambio

**Debe hacer.** Registrar tasas por fecha y par de monedas, con fuente y vigencia.

**Reglas.** Única tasa por fecha/par; si falta, se usa la última anterior y se
advierte; la tasa usada se congela en el documento; la diferencia de cambio se
reconoce al pago o al cierre.

**Datos/API.** `core.tasa_cambio`; `POST/GET /api/v1/core/tasas`.

**Aceptación.** No hay dos tasas para la misma fecha/par; cambiar una tasa no
altera documentos ya contabilizados; el pago en otra moneda genera diferencia.

---

## F-CORE-008 — Secuencias y numeración

**Debe hacer.** Administrar secuencias por compañía, diario, tipo y resolución,
con prefijo, rango, vigencia y siguiente número.

**Reglas.** Sin huecos ni reutilización; reserva con bloqueo de fila en la misma
transacción; una secuencia vencida o agotada no permite postear; la resolución
DIAN tiene prioridad sobre la secuencia interna.

**Datos/API.** `core.secuencia`; `GET/POST /api/v1/core/secuencias`;
reserva interna usada por `ledger`.

**Aceptación.** Dos posteos concurrentes obtienen números distintos y
consecutivos; no se salta un número; secuencia agotada rechaza el documento.

---

## F-CORE-009 — Outbox y eventos

**Debe hacer.** Registrar eventos de dominio en la misma transacción del comando
y publicarlos de forma asíncrona con reintentos.

**Reglas.** El evento no reemplaza la verdad de las tablas; el worker es
idempotente; los fallos quedan en estado fallido con diagnóstico; no se pierde
un evento si el proceso se cae después del commit.

**Datos/API.** `core.outbox`; `GET /api/v1/core/outbox`,
`POST /outbox/{id}/reintentar` (interno).

**Aceptación.** Un fallo del worker no revierte el asiento; el reintento no
duplica el efecto; el evento se publica una sola vez por consumidor.

---

## F-CORE-010 — Parámetros por compañía

**Debe hacer.** Centralizar parámetros operativos: redondeo, tolerancias,
moneda, calendario, formato de fecha, límites de importación y comportamiento de
control.

**Reglas.** Los parámetros son por compañía y versionados; un cambio no altera
documentos históricos; los valores sensibles requieren permiso.

**Datos/API.** `core.parametro`; `GET/PUT /api/v1/core/parametros`.

**Aceptación.** Cambiar un parámetro no reescribe historia; el valor usado queda
registrado en el documento cuando afecta el cálculo.
