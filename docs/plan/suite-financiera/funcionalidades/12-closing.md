# Funcionalidades — `closing`

Origen funcional (inventario de partida): bloqueos de fecha, cierre de ejercicio
y secure entries de `account` (Community); consolidación de
`account_consolidation` (Enterprise).

## F-CLS-001 — Checklist de cierre

**Debe hacer.** Definir y ejecutar el checklist del periodo: facturas, lotes,
extractos, depreciaciones, impuestos, diferencias de cambio, provisiones y
ajustes.

**Reglas.** Cada ítem tiene estado, responsable y evidencia; no se cierra con
ítems pendientes sin justificación; el checklist queda adjunto al cierre.

**Datos/API.** `cls.cierre.checklist`; `POST /api/v1/closing/cierres/{id}/checklist`.

**Aceptación.** El cierre bloquea si hay pendientes sin justificar; cada ítem
queda auditado; el acta se conserva.

---

## F-CLS-002 — Cierre mensual

**Debe hacer.** Ejecutar el cierre del periodo, bloquearlo y generar el snapshot
de estados financieros.

**Reglas.** Idempotente; no se cierra con asientos en borrador; el bloqueo impide
posteos posteriores; el snapshot se conserva; la reapertura exige permiso.

**Datos/API.** `POST /api/v1/closing/cierres/mensual`.

**Aceptación.** Repetir el cierre no duplica asientos; el periodo queda
bloqueado; el snapshot coincide con el informe.

---

## F-CLS-003 — Cierre anual

**Debe hacer.** Cerrar el ejercicio, calcular el resultado, trasladarlo al
patrimonio y generar la apertura del año siguiente.

**Reglas.** Requiere todos los meses cerrados; el resultado se calcula del libro;
el asiento de cierre es único; la apertura = cierre; el año cerrado no recibe
movimientos.

**Datos/API.** `POST /api/v1/closing/cierres/anual`.

**Aceptación.** El resultado cuadra con el estado de resultados; la apertura
cuadra con el cierre; no se duplica el asiento.

---

## F-CLS-004 — Asientos de cierre y ajuste

**Debe hacer.** Generar asientos de ajuste (provisiones, diferencias de cambio,
depreciaciones, impuestos) antes del cierre.

**Reglas.** Cada ajuste tiene concepto, soporte y responsable; se postea por el
servicio de contabilización; no se edita después; el ajuste se refleja en el
cierre.

**Datos/API.** `cls.cierre_linea`, `led.asiento`;
`POST /api/v1/closing/cierres/{id}/ajustes`.

**Aceptación.** El ajuste cuadra; el cierre lo incluye; el asiento queda
inmutable.

---

## F-CLS-005 — Apertura de periodos y años

**Debe hacer.** Abrir el siguiente periodo/año con saldos iniciales y periodos
disponibles.

**Reglas.** Solo tras cierre; saldo inicial = cierre anterior; no se solapan
periodos; la apertura es auditable; el año no se abre dos veces.

**Datos/API.** `cls.apertura`, `core.periodo`;
`POST /api/v1/closing/aperturas`.

**Aceptación.** Los saldos iniciales cuadran; no se duplica la apertura; el
periodo queda disponible para posteo.

---

## F-CLS-006 — Reapertura controlada

**Debe hacer.** Reabrir un periodo cerrado con autorización, motivo y registro.

**Reglas.** Solo rol autorizado; motivo obligatorio; se conserva el snapshot
anterior; se informa el impacto; el cierre posterior es obligatorio.

**Datos/API.** `POST /api/v1/closing/cierres/{id}/reabrir`.

**Aceptación.** Sin permiso se rechaza; la reapertura queda auditada; el snapshot
anterior no se borra.

---

## F-CLS-007 — Configuración de consolidación

**Debe hacer.** Definir compañía destino, orígenes, periodo y reglas de
homologación.

**Reglas.** Orígenes con la misma moneda funcional o tasa; no se consolida una
compañía consigo misma; la configuración se versiona; el destino no comparte
secuencias con orígenes.

**Datos/API.** `cls.consolidacion`, `cls.consolidacion_origen`;
`POST /api/v1/closing/consolidaciones`.

**Aceptación.** La configuración es válida; los orígenes están cerrados; la
versión queda auditada.

---

## F-CLS-008 — Homologación de cuentas y centros

**Debe hacer.** Mapear cuentas y centros de cada origen al plan del destino.

**Reglas.** Toda cuenta con saldo debe tener mapeo; cuentas sin mapeo bloquean la
ejecución; el mapeo es versionado; se puede simular.

**Datos/API.** `cls.homologacion_cuenta`, `cls.homologacion_centro`.

**Aceptación.** Sin cuentas huérfanas; la simulación cuadra; el cambio de mapeo no
altera consolidaciones ejecutadas.

---

## F-CLS-009 — Eliminaciones intercompañía

**Debe hacer.** Identificar y eliminar ventas/compras, CxC/CxP, préstamos y
saldos recíprocos entre compañías.

**Reglas.** Las eliminaciones son asientos explícitos; deben cuadrar; referencian
el origen; se revisan antes de ejecutar; no eliminan historia operativa.

**Datos/API.** `cls.eliminacion`.

**Aceptación.** El saldo consolidado no incluye operaciones internas; las
eliminaciones cuadran; el detalle es auditable.

---

## F-CLS-010 — Simulación y ejecución de consolidación

**Debe hacer.** Simular la consolidación, revisar diferencias y ejecutarla en un
libro consolidado separado.

**Reglas.** Solo orígenes cerrados; simulación reproducible; ejecución
idempotente; libro consolidado separado; reporte de diferencias; anulación con
motivo.

**Datos/API.** `POST /api/v1/closing/consolidaciones/{id}/simular`,
`POST /consolidaciones/{id}/ejecutar`.

**Aceptación.** La simulación cuadra; ejecutar dos veces no duplica; los estados
consolidados coinciden con el libro.

---

## F-CLS-011 — Reportes consolidados

**Debe hacer.** Generar balance, resultados, flujo y comparativos del libro
consolidado, con detalle por origen.

**Reglas.** Solo consolidaciones ejecutadas; moneda del destino; eliminaciones
reflejadas; snapshot certificable; exportable.

**Datos/API.** `GET /api/v1/closing/consolidaciones/{id}/reportes`.

**Aceptación.** Los estados cuadran; las eliminaciones se reflejan; el snapshot
es inmutable.
