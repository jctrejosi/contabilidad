# Funcionalidades — `budgeting`

Origen funcional (inventario de partida): `account_budget` (Enterprise):
versiones, líneas por cuenta/periodo, control y comparación real vs. presupuesto.

## F-BGT-001 — Versiones de presupuesto

**Debe hacer.** Crear versiones por compañía, año y escenario (base, optimista,
conservador), con estado y responsable.

**Reglas.** Una versión aprobada es inmutable; para cambiar se crea otra versión;
solo una versión puede ser la vigente por escenario; el cambio de versión queda
auditado.

**Datos/API.** `bgt.presupuesto`; `POST /api/v1/budgeting/presupuestos`.

**Aceptación.** No se edita una versión aprobada; la vigente es única; el
histórico se conserva.

---

## F-BGT-002 — Líneas por cuenta, centro y periodo

**Debe hacer.** Cargar importes por cuenta, centro de costo y periodo, con moneda
y observación.

**Reglas.** Única línea por versión/cuenta/centro/periodo; cuenta afectable;
centro de la compañía; importe ≥ 0 (o signo según tipo); validación de
duplicados en carga masiva.

**Datos/API.** `bgt.linea`; `POST /api/v1/budgeting/presupuestos/{id}/lineas`.

**Aceptación.** Línea duplicada se rechaza; la suma por cuenta coincide con la
carga; la importación reporta errores por fila.

---

## F-BGT-003 — Aprobación de presupuesto

**Debe hacer.** Aprobar una versión con usuario autorizado, fecha y acta.

**Reglas.** Requiere todas las líneas cuadradas; segregación creador/aprobador;
una versión aprobada no cambia; el acta queda adjunta.

**Datos/API.** `POST /api/v1/budgeting/presupuestos/{id}/aprobar`.

**Aceptación.** El creador no aprueba su versión; sin acta no se aprueba; la
aprobación es trazable.

---

## F-BGT-004 — Control presupuestal

**Debe hacer.** Configurar modo `ninguno`, `avisar` o `bloquear` y umbral por
cuenta/centro.

**Reglas.** `disponible = presupuesto − ejecutado − comprometido`; el bloqueo
rechaza el documento; el aviso exige aprobación; el umbral se configura.

**Datos/API.** `bgt.control`, `GET /api/v1/budgeting/control`.

**Aceptación.** Un exceso bloqueado se rechaza; el aviso permite con aprobación;
el cálculo coincide con el libro.

---

## F-BGT-005 — Compromisos

**Debe hacer.** Registrar compromisos al validar facturas/compras y liberarlos al
reversar o anular.

**Reglas.** Un compromiso reduce el disponible; no se duplica; al contabilizar se
convierte en ejecución; la liberación es automática al reversar; el compromiso
manual requiere motivo.

**Datos/API.** `bgt.compromiso`; evento `documento.validado`.

**Aceptación.** El disponible baja al comprometer; al reversar se libera; no hay
compromisos duplicados.

---

## F-BGT-006 — Ejecución real

**Debe hacer.** Calcular el ejecutado desde el libro por cuenta, centro y periodo.

**Reglas.** Solo asientos contabilizados; sin digitación; incluye ajustes y
reversiones; se materializa para rendimiento y se reconstruye.

**Datos/API.** `bgt.ejecucion` (vista/materializada);
`GET /api/v1/budgeting/ejecucion`.

**Aceptación.** El ejecutado cuadra con el libro; una reversión reduce la
ejecución; el refresco no duplica.

---

## F-BGT-007 — Comparativo presupuesto vs. real

**Debe hacer.** Mostrar presupuesto, ejecutado, comprometido, disponible y
variación por cuenta/centro/periodo; exportar.

**Reglas.** Misma moneda y periodo; variación absoluta y porcentual; sin división
por cero; filtros por compañía/versión.

**Datos/API.** `GET /api/v1/budgeting/comparativo`.

**Aceptación.** La variación = presupuesto − ejecutado; los totales cuadran; la
exportación coincide con la pantalla.

---

## F-BGT-008 — Cierre de presupuesto

**Debe hacer.** Cerrar una versión al terminar el año y bloquear cambios.

**Reglas.** No se cierra con compromisos abiertos sin justificar; el cierre no
borra historia; la versión cerrada solo se consulta.

**Datos/API.** `POST /api/v1/budgeting/presupuestos/{id}/cerrar`.

**Aceptación.** Después del cierre no se edita; los compromisos se reportan; el
histórico queda disponible.

---

## F-BGT-009 — Escenarios y simulación

**Debe hacer.** Comparar escenarios alternativos sin afectar la contabilidad.

**Reglas.** Los escenarios son versiones independientes; no generan asientos; se
pueden copiar líneas; el escenario aprobado es el único operativo.

**Datos/API.** `bgt.presupuesto.escenario`;
`POST /api/v1/budgeting/presupuestos/{id}/copiar`.

**Aceptación.** Crear un escenario no altera el real; la copia conserva líneas;
el comparativo entre escenarios funciona.

---

## F-BGT-010 — Alertas de ejecución

**Debe hacer.** Generar alertas por umbral de ejecución, desviación y compromisos
excedidos.

**Reglas.** Alertas configurables por cuenta/centro; no modifican documentos;
se registran y notifican; se pueden silenciar con motivo.

**Datos/API.** `bgt.alerta`; `GET /api/v1/budgeting/alertas`.

**Aceptación.** La alerta se genera al superar el umbral; no se duplica cada
consulta; el silencio queda auditado.
