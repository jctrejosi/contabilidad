# Funcionalidades — `reporting`

Origen funcional (inventario de partida): `account_reports` (Enterprise) para
estados financieros, mayor, auxiliares, comparativos y reportes fiscales;
`account` (Community) para motor de reportes, impuesto genérico y análisis de
flujo de caja.

## F-RPT-001 — Catálogo de reportes

**Debe hacer.** Registrar reportes por código, nombre, tipo, parámetros, versión
y permisos.

**Reglas.** Código único; cada reporte declara compañía, periodo, moneda y filtros
obligatorios; una versión nueva no altera snapshots anteriores; el catálogo es
extensible sin desplegar lógica nueva.

**Datos/API.** `rpt.reporte`; `GET /api/v1/reporting/reportes`.

**Aceptación.** El catálogo lista solo reportes permitidos; cada uno valida sus
parámetros; una versión nueva conserva la anterior.

---

## F-RPT-002 — Motor de ejecución

**Debe hacer.** Ejecutar un reporte con parámetros, filtros, agrupación,
comparativos y paginación; devolver totales y detalle.

**Reglas.** Solo datos contabilizados; filtros por compañía/periodo/cuenta/
tercero/centro; límite de filas con paginación; tiempos de ejecución acotados;
exportación con el mismo conjunto de datos.

**Datos/API.** `rpt.ejecucion`; `POST /api/v1/reporting/{codigo}/ejecutar`.

**Aceptación.** El detalle suma el total; los filtros no alteran el resultado;
la exportación coincide con la pantalla.

---

## F-RPT-003 — Balance de comprobación

**Debe hacer.** Generar el balance por cuenta y nivel, con saldo inicial,
débitos, créditos y saldo final; incluir terceros/centros si se solicita.

**Reglas.** Derivado del libro; cuentas con movimiento o saldo; cuadre por nivel;
saldo inicial = cierre anterior; exportable a PDF/XLSX/CSV.

**Datos/API.** `GET /api/v1/reporting/comprobacion`.

**Aceptación.** Débitos = créditos; el saldo de la cuenta padre = suma de hijas;
el informe coincide con el mayor.

---

## F-RPT-004 — Balance general

**Debe hacer.** Presentar activo, pasivo y patrimonio a una fecha, con mapeo
PUC→rubro y comparativo con el periodo anterior.

**Reglas.** Solo cuentas de balance; signos según naturaleza; el total activo =
pasivo + patrimonio; el mapeo es versionado; el informe se puede certificar.

**Datos/API.** `GET /api/v1/reporting/balance-general`.

**Aceptación.** La ecuación contable se cumple; el comparativo usa la misma regla;
el snapshot coincide con el informe.

---

## F-RPT-005 — Estado de resultados

**Debe hacer.** Presentar ingresos, costos, gastos y resultado del periodo, con
comparativo y variaciones.

**Reglas.** Solo cuentas de resultado; cierre del periodo; signos según
naturaleza; comparativo con periodo anterior; sin doble conteo por reversiones.

**Datos/API.** `GET /api/v1/reporting/resultados`.

**Aceptación.** El resultado cuadra con el libro; las reversiones netas se
reflejan; el comparativo es consistente.

---

## F-RPT-006 — Mayor y auxiliares

**Debe hacer.** Emitir mayor por cuenta y auxiliares por tercero/centro, con
saldo inicial, movimientos y saldo final.

**Reglas.** Orden cronológico; filtros por periodo; saldo encadenado; incluye
referencia del documento; exportable.

**Datos/API.** `GET /api/v1/reporting/mayor`, `/auxiliares`.

**Aceptación.** El saldo final = inicial + débitos − créditos; el auxiliar suma
el mayor; la exportación no trunca.

---

## F-RPT-007 — Libro diario y comprobantes

**Debe hacer.** Listar asientos por fecha, diario, tipo y número, con detalle de
líneas.

**Reglas.** Solo contabilizados; orden por fecha/número; filtros por diario/tipo;
incluye referencia y tercero; exportable.

**Datos/API.** `GET /api/v1/reporting/diario`.

**Aceptación.** Los asientos listados cuadran; no se omiten reversiones; el
detalle coincide con el asiento.

---

## F-RPT-008 — Cartera por edades

**Debe hacer.** Reportar CxC por vencimiento, tercero, moneda y rango de mora.

**Reglas.** Calculado desde partidas abiertas; por vencimiento; excluye
castigadas; total = saldo de cartera; exportable.

**Datos/API.** `GET /api/v1/reporting/cartera`.

**Aceptación.** La suma = saldo de CxC; los rangos son configurables; el detalle
por tercero cuadra.

---

## F-RPT-009 — CxP por edades y programación

**Debe hacer.** Reportar CxP por vencimiento y proyectar pagos.

**Reglas.** Desde partidas abiertas; excluye revertidas; total = saldo de CxP;
incluye prioridad y descuentos; exportable.

**Datos/API.** `GET /api/v1/reporting/cxp`.

**Aceptación.** La suma = saldo de CxP; la proyección usa saldos reales; el
detalle por proveedor cuadra.

---

## F-RPT-010 — Comparativos

**Debe hacer.** Comparar periodos, compañías, versiones de presupuesto o
escenarios, con variaciones absolutas y porcentuales.

**Reglas.** Misma regla de cálculo; moneda comparable; sin división por cero;
filtros explícitos; exportable.

**Datos/API.** `GET /api/v1/reporting/comparativos`.

**Aceptación.** La variación es correcta; los totales cuadran; el cambio de base
se refleja.

---

## F-RPT-011 — Flujo de caja

**Debe hacer.** Generar el flujo de caja por método directo o indirecto, con
renglones configurables y comparativo.

**Reglas.** Mapeo PUC→renglón versionado; solo movimientos de efectivo y
equivalentes; signos consistentes; exportable; snapshot certificable.

**Datos/API.** `GET /api/v1/reporting/flujo-caja`.

**Aceptación.** El saldo final de caja coincide con el libro; el mapeo sin
renglón se advierte; el comparativo es consistente.

---

## F-RPT-012 — ESFA y NIIF

**Debe hacer.** Generar el estado de situación financiera de apertura, estados
NIIF y notas estructuradas con mapeo PUC→rubro.

**Reglas.** Mapeo por año; activo = pasivo + patrimonio; revelaciones como texto
estructurado; el informe es certificable; los cambios de mapeo no alteran
snapshots.

**Datos/API.** `rpt.mapeo_niif`; `GET /api/v1/reporting/niif/esfa`.

**Aceptación.** El ESFA cuadra; las notas referencian cifras reales; el snapshot
se conserva.

---

## F-RPT-013 — Snapshots certificables

**Debe hacer.** Congelar un informe con sus líneas, parámetros, hash, fecha y
firma del contador/revisor.

**Reglas.** Inmutable; hash encadenado; no cambia si el libro cambia; se puede
comparar con versiones anteriores; el acceso requiere permiso.

**Datos/API.** `rpt.snapshot`, `rpt.snapshot_linea`;
`POST /api/v1/reporting/{codigo}/snapshot`.

**Aceptación.** El snapshot coincide con la ejecución; una alteración se detecta;
postear después no lo modifica.

---

## F-RPT-014 — Exportación y programación

**Debe hacer.** Exportar PDF/XLSX/CSV y programar reportes periódicos por correo
o carpeta.

**Reglas.** Misma data que la pantalla; nombre con periodo y hash; programación
con zona horaria; reintentos; permisos por reporte.

**Datos/API.** `POST /api/v1/reporting/{codigo}/exportar`,
`POST /reporting/programaciones`.

**Aceptación.** El archivo exportado coincide con la consulta; la programación se
ejecuta una vez por periodo; el fallo se alerta.
