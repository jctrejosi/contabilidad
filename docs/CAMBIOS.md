# Registro de cambios

Cambios que alteran el comportamiento del aplicativo y conviene poder revertir.

## 2026-10-21 — Acceso: se retira temporalmente `AccessGate`

**Motivo.** Fortuner27 no está en ejecución, así que `AccessGate` bloqueaba la
interfaz completa con «Ejecución incorrecta del programa» (fail-closed). Para
poder usar el módulo mientras se restablece Fortuner, se deja de montar el gate.

**Cambio.** `Interface_web/src/main.tsx` renderiza `<App />` directamente. El
componente `Interface_web/src/components/AccessGate.tsx` y el router
`backend/access_session.py` **se conservan sin cambios**; solo se quitó el
envoltorio en el punto de entrada.

**Estado.** Aplicado en producción el 2026-10-21: imagen `contabdsi/app`
reconstruida y `contabdsi_app` recreado. Verificado en
`https://contabilidad.jcti.xyz`: `/api/health` responde 200 y el bundle servido
ya no contiene `access/session` ni el texto del gate.

**Alcance.** Es una desactivación **solo de interfaz**: la API no exige la
sesión de acceso (los endpoints de datos no la validan). Al volver a montar
`AccessGate`, la aplicación recupera el modelo fail-closed sin tocar el backend.

**Para restaurarlo.** En `Interface_web/src/main.tsx`, volver a importar
`AccessGate` y envolver `<App />`:

```tsx
import AccessGate from './components/AccessGate'

<AccessGate>
  <App />
</AccessGate>
```

Requiere Fortuner27 escuchando en `FORTUNER_API_URL` (por defecto
`http://127.0.0.1:8004`; en el contenedor, `http://host.docker.internal:8004`) y
la clave administrativa configurada allí.

**Riesgo asumido.** Sin el gate, cualquiera que alcance la URL entra a la
interfaz. El despliegue conserva TLS, CSP y cabeceras de seguridad, y los datos
siguen en PostgreSQL. Si el sitio queda expuesto a internet sin Fortuner,
evaluar `PROTECT_APP=true` (Basic Auth) como barrera temporal.

## 2026-10-22 — Suite financiera: Costos, Financiación e Indicadores

**Motivo.** El panel financiero no cubría distribución de costos, deuda ni
proyecciones gerenciales. Se agregan tres módulos independientes, sin fusionar
los seis existentes.

**Cambio.** Nuevos `FinancialModuleId`: `costos`, `financiacion` e
`indicadores`. Cada uno tiene su carpeta en
`Interface_web/src/pages/finance/`, su submenú y sus entidades en
`src/finance/types.ts`:

- **Costos:** centros y conductores, distribución de CIF, costeo estándar con
  variaciones de precio y cantidad, costeo ABC y costos por proyecto.
- **Financiación y deuda:** préstamos, calendario de amortización por sistema
  francés, intereses, cupos de crédito y leasing.
- **Indicadores y proyecciones:** tablero gerencial, catálogo de indicadores,
  proyecciones mensuales y comparación de escenarios.

Se agregaron 19 pantallas (total 68 en la suite) y 13 colecciones nuevas a
`FinanceState` (total 45). El sidebar pasa de 6 a 9 módulos.

**Alcance.** Solo interfaz. No se agregaron endpoints ni migraciones; los datos
viven en `localStorage` y la migración de `loadState` rellena las colecciones
nuevas en compañías ya creadas.

**Cómo revertir.** Quitar los tres IDs de `MODULE_ORDER` y
`FINANCIAL_MODULES` en `src/data/finance.ts`, retirar las tres entradas de
`FinanceModulePage.tsx` y eliminar las carpetas `costos/`, `financiacion/` e
`indicadores/`. Los campos extra de `FinanceState` son inocuos si se dejan.

**Verificación.** `tsc --noEmit` limpio, `npm run build` correcto,
`test:assets` 11/11 y `verify-finance.mjs` con 68/68 pantallas y flujos en
verde. El detalle funcional está en `docs/modulos/costos.md`,
`docs/modulos/financiacion.md`, `docs/modulos/indicadores.md` y
`docs/plan/SUITE_FINANCIERA_FASE2.md`.

## 2026-10-22 — Tesorería: flujo de caja real, proyectado y liquidez

**Motivo.** El módulo de Tesorería registraba y conciliaba movimientos, pero no
explicaba la generación de caja ni anticipaba faltantes de liquidez.

**Cambio.** Tres pantallas nuevas en el submenú de Tesorería:

- `flujo` — flujo de caja real por mes con detalle de recibos, pagos, cheques
  cobrados y caja menor.
- `proyectado` — horizonte de seis meses con recaudos de cartera, CxP, cuotas de
  deuda, leasing y reembolsos aprobados.
- `liquidez` — cobertura de pagos a 30 días, posición semanal y calendarios de
  recaudo y pago.

No se agregaron entidades: los cálculos se derivan del estado existente en
`src/pages/finance/tesoreria/cashflow.ts`.

**Alcance.** Solo interfaz. Las transferencias entre cuentas se excluyen del
flujo por ser movimientos internos; depreciación y provisiones no se incluyen
porque no generan efectivo.

**Cómo revertir.** Quitar los slugs `flujo`, `proyectado` y `liquidez` de
`FINANCIAL_MODULES.tesoreria` y las tres ramas de render en `Tesoreria.tsx`;
la carpeta `tesoreria/` puede eliminarse sin afectar el resto.

**Verificación.** `tsc --noEmit` limpio, `npm run build` correcto,
`test:assets` 11/11 y `verify-finance.mjs` con 71/71 pantallas y flujos en
verde. Detalle en `docs/modulos/tesoreria.md`.

## 2026-10-22 — Contabilidad: cierre y apertura real de períodos

**Motivo.** La pantalla de Cierres era un checklist en memoria: no generaba
comprobante, no bloqueaba el período, no abría el siguiente y no dejaba
historial. El cierre contable era decorativo.

**Cambio.** Nuevo motor de dominio en `Interface_web/src/data/cierres.ts`:
modelo de períodos, snapshot contable de `2026-02`, siete verificaciones (tres
bloqueantes), generación del comprobante `NO-YYYY-MM`, construcción del asiento
de apertura `AP-YYYY-MM`, cierre, reapertura y bitácora. Persiste en
`localStorage` con la llave `contabdsi:cierres:v1:<código de compañía>`.

`Interface_web/src/pages/Cierres.tsx` se reescribió: cuatro indicadores, tres
pestañas (período actual, historial y apertura), checklist interactivo, vista
previa del comprobante y confirmación escrita (`CIERRE` / `REABRIR`).

**Alcance.** Solo interfaz. El snapshot es estático y no se recalcula desde el
libro legado; el backend no valida el bloqueo ni registra el cierre.

**Cómo revertir.** Eliminar `Interface_web/src/data/cierres.ts` y restaurar la
versión anterior de `Interface_web/src/pages/Cierres.tsx` (checklist en
memoria). El `localStorage` de la llave `contabdsi:cierres:v1:001` se puede
borrar sin afectar la suite.

**Verificación.** `tsc --noEmit` limpio, `npm run build` correcto,
`test:assets` 11/11 y `verify-finance.mjs` con 71/71 pantallas y flujos en
verde, incluida la sección 11 de cierre y reapertura. Detalle en
`docs/modulos/cierres.md`.

## 2026-10-22 — Fase 3.3: deterioro, conciliaciones, traslados y proyección por proyecto

**Motivo.** Quedaban seis brechas operativas de la fase 3: riesgo de cartera,
conciliación con terceros, ajustes de proveedor, traslados de activos y
proyección presupuestal por proyecto.

**Cambio.** Seis pantallas nuevas, sin fusionar módulos ni mover el sidebar:

- Cartera → `deterioro` (provisión NIIF 9 por edades) y `conciliacion` (auxiliar
  contra estado de cuenta del cliente).
- Cuentas por pagar → `descuentos` (pronto pago, notas débito/crédito y
  devoluciones) y `conciliacion` (auxiliar contra estado del proveedor).
- Activos fijos → `traslados` (ubicación, centro de costo y responsable).
- Presupuestos → `proyectos` (presupuesto, ejecución y cierre estimado).

Se agregaron las entidades `ImpairmentProvision`, `CustomerReconciliation`,
`SupplierAdjustment`, `SupplierReconciliation`, `AssetTransfer` y
`BudgetProjection`, con migración retrocompatible en `loadState`.

**Alcance.** Solo interfaz. No se agregaron endpoints ni migraciones. La
conciliación ajusta el saldo en el estado local; el traslado actualiza el activo
y crea un movimiento tipo `Traslado` sin efecto neto en el mayor; el deterioro se
registra como provisión aprobada/contabilizada, no como asiento del backend.

**Cómo revertir.** Quitar los slugs `deterioro` y `conciliacion` de
`FINANCIAL_MODULES.cartera`; `descuentos` y `conciliacion` de
`cuentas-pagar`; `traslados` de `activos-fijos`; y `proyectos` de
`presupuesto`. Retirar las ramas de render y las carpetas
`pages/finance/cartera/`, `cuentas-pagar/`, `presupuesto/Proyectos.tsx` y
`activos-fijos/Traslados.tsx`. Las colecciones nuevas son inocuas si se dejan.

**Verificación.** `tsc --noEmit` limpio, `npm run build` correcto,
`test:assets` 11/11 y `verify-finance.mjs` con **77/77 pantallas y flujos en
verde**. Detalle en `docs/plan/SUITE_FINANCIERA_FASE2.md` (sección 10) y en los
documentos de cada módulo.

## 2026-10-22 — Fase 3.4: tributación, declaración electrónica y exógena

**Motivo.** Faltaban los formularios tributarios y el flujo de presentación
ante la DIAN, además de la exógena anual.

**Cambio.** Cinco pantallas nuevas en Facturación:

- `formulario-300` — IVA bimestral calculado desde las facturas contabilizadas
  (IVA generado − IVA descontable − retenciones).
- `formulario-350` — retención en la fuente y ReteICA del período.
- `formulario-110` — renta anual con renta líquida, presuntiva e impuesto.
- `declaracion` — checklist, validación, presentación con confirmación escrita
  y acuse DIAN simulado.
- `exogena` — formatos anuales, terceros, corrección de incidencias y acuse.

Se agregaron `TaxFiling`, `TaxBox`, `ExogenousReport` y `ExogenousRow`, con
migración retrocompatible en `loadState`, y el motor de cálculo en
`Interface_web/src/finance/tax.ts`.

**Alcance.** Solo interfaz. No hay XML UBL, firma electrónica ni transmisión
real a la DIAN. La presentación genera un acuse local y cambia el estado a
`Aceptada`; los valores del formulario 110 son un cierre de referencia.

**Cómo revertir.** Quitar los cinco slugs de `FINANCIAL_MODULES.facturacion`,
las ramas de render y la carpeta `pages/finance/facturacion/`; eliminar
`src/finance/tax.ts`. Las colecciones nuevas son inocuas si se dejan.

**Verificación.** `tsc --noEmit` limpio, `npm run build` correcto,
`test:assets` 11/11 y `verify-finance.mjs` con **82/82 pantallas y flujos en
verde**. Detalle en `docs/plan/SUITE_FINANCIERA_FASE2.md` (sección 11) y en
`docs/modulos/facturacion.md`.

## 2026-10-22 — Fase 3.5: aprobaciones, auditoría, consolidación y distribución secundaria

**Motivo.** Faltaban las capacidades transversales de la suite: flujo de
aprobaciones configurable, control de acceso y bitácora, consolidación del grupo
y redistribución de costos de servicio.

**Cambio.** Tres módulos nuevos en el sidebar y una pantalla en Costos, sin
fusionar los existentes:

- **Aprobaciones** (`bandeja`, `reglas`): solicitudes por módulo con niveles y
  umbrales, decisión con nota y trazabilidad.
- **Auditoría y control** (`bitacora`, `permisos`): bitácora de eventos y matriz
  rol × módulo con cinco niveles de acceso.
- **Consolidación** (`panel`, `eliminaciones`): perímetro de compañías, totales y
  eliminaciones intercompañía con aplicación y revisión.
- **Costos** (`secundaria`): redistribución de centros de servicio a producción
  por horas máquina.

Se agregaron `ApprovalRule`, `ApprovalRequest`, `ApprovalStep`, `Role`,
`RolePermission`, `ConsolidationCompany`, `EliminationEntry` y
`CostSecondaryAllocation`, con migración retrocompatible en `loadState`. El
`FinancialModuleId` de `src/data/finance.ts` ahora se reexporta desde
`src/finance/types.ts` para evitar dos definiciones divergentes.

**Alcance.** Solo interfaz. Los permisos no bloquean el backend, la bitácora
vive en `localStorage` (máximo 80 eventos) y la consolidación no ejecuta
homologación contable ni cálculo de minoritarios desde el libro.

**Cómo revertir.** Quitar `aprobaciones`, `auditoria` y `consolidacion` de
`MODULE_ORDER`, de `FINANCIAL_MODULES` y de `FinanceModulePage.tsx`; eliminar
sus carpetas en `pages/finance/`. Quitar `secundaria` de
`FINANCIAL_MODULES.costos` y `Costos/Secundaria.tsx`. Las colecciones nuevas son
inocuas si se dejan.

**Verificación.** `tsc --noEmit` limpio, `npm run build` correcto,
`test:assets` 11/11 y `verify-finance.mjs` con **89/89 pantallas y flujos en
verde**. Detalle en `docs/plan/SUITE_FINANCIERA_FASE2.md` (sección 12) y en los
documentos de cada módulo.
