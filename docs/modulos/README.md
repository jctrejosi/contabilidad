# Módulos financieros operativos

Esta carpeta documenta los nueve módulos de la suite que se montaron sobre
`Interface_web`:

- [Facturación](facturacion.md)
- [Cuentas por cobrar](cartera.md)
- [Cuentas por pagar](cuentas-por-pagar.md)
- [Tesorería y bancos](tesoreria.md)
- [Presupuestos](presupuesto.md)
- [Activos fijos](activos-fijos.md)
- [Costos](costos.md)
- [Financiación y deuda](financiacion.md)
- [Indicadores y proyecciones](indicadores.md)
- [Aprobaciones](aprobaciones.md)
- [Auditoría y control](auditoria.md)
- [Consolidación](consolidacion.md)

La contabilidad general (legado) no es un módulo de la suite, pero su cierre
mensual ya tiene motor de interfaz propio:

- [Cierre y apertura de períodos](cierres.md)

## Arquitectura

| Capa | Ubicación |
|---|---|
| Entidades y estados | `Interface_web/src/finance/types.ts` |
| Datos iniciales | `Interface_web/src/finance/seed.ts` |
| Estado compartido y persistencia | `Interface_web/src/finance/store.tsx` |
| Cálculos y formato | `Interface_web/src/finance/selectors.ts` |
| Componentes de interfaz | `Interface_web/src/components/finance/ui.tsx` |
| Pantallas | `Interface_web/src/pages/finance/` |
| Router de módulos | `Interface_web/src/pages/finance/FinanceModulePage.tsx` |
| Activos fijos | `Interface_web/src/pages/finance/activos-fijos/` |
| Costos | `Interface_web/src/pages/finance/costos/` |
| Financiación y deuda | `Interface_web/src/pages/finance/financiacion/` |
| Indicadores y proyecciones | `Interface_web/src/pages/finance/indicadores/` |
| Flujo de caja y liquidez | `Interface_web/src/pages/finance/tesoreria/` |
| Aprobaciones | `Interface_web/src/pages/finance/aprobaciones/` |
| Auditoría y control | `Interface_web/src/pages/finance/auditoria/` |
| Consolidación | `Interface_web/src/pages/finance/consolidacion/` |

Cada módulo recibe `page` (por ejemplo `facturacion/documentos`) y
`onNavigate`. El primer segmento identifica el módulo y el segundo el
submenú. Los submenús vienen de `src/data/finance.ts`, por lo que el sidebar y
el contenido siempre coinciden.

## Estado y persistencia

`FinanceProvider` envuelve el `Shell` en `App.tsx`. Expone:

```tsx
const { state, update, reset } = useFinance();

update(draft => {
  // mutación inmutable sobre una copia
}, 'Acción visible en la bitácora', 'facturacion');
```

- `update` clona el estado, aplica la mutación y agrega una entrada a
  `state.audit` con usuario, fecha y módulo.
- El estado se guarda en `localStorage` con la llave
  `contabdsi.finance.v1.<código de compañía>`.
- Para reiniciar una compañía: en la consola del navegador,
  `localStorage.removeItem('contabdsi.finance.v1.001')` y recargar.
- Los datos iniciales son deterministas y están descritos en `seed.ts`.

## Flujo entre módulos

```text
Factura de venta contabilizada ──► partida CxC ──► recibo ──► aplicación
Factura de compra contabilizada ─► obligación CxP ─► propuesta ─► pago
Recibo / pago ───────────────────► línea de extracto ─► conciliación
Partida vencida ─────────────────► provisión por deterioro ─► aprobación
Cliente ─────────────────────────► estado de cuenta ─► conciliación
Obligación CxP ──────────────────► descuento / nota débito ─► conciliación con proveedor
Presupuesto aprobado ────────────► compromiso ─► ejecución ─► alerta
Presupuesto ─────────────────────► proyecto ─► avance ─► proyección anual
Adquisición de activo ───────────► depreciación ─► revalorización ─► baja
Activo ──────────────────────────► traslado ─► nuevo centro y responsable
Depreciación / revalorización ───► movimiento contable ─► conciliación con el mayor
Costo indirecto (CIF) ───────────► distribución por inductor ─► centro ─► objeto de costo
Préstamo ────────────────────────► calendario de amortización ─► cuota ─► intereses
Indicador ───────────────────────► cumplimiento ─► proyección ─► escenario ─► decisión
Solicitud ───────────────────────► regla ─► nivel 1 ─► nivel 2 ─► aprobación
Acción de cualquier módulo ──────► bitácora ─► revisión ─► auditoría
Compañías del grupo ─────────────► perímetro ─► suma ─► eliminaciones ─► consolidado
```

Las acciones de facturación crean cartera/CxP; las de cartera y CxP reducen
saldos; las de tesorería mueven cuentas; presupuesto consume el estado
existente. No hay datos mock por pantalla: todas las vistas leen el mismo
estado.

## Alcance de integración

La suite se implementó con una **capa de dominio local** porque el backend
actual solo cubre contabilidad general (Advantage). Los contratos de datos
están separados en `types.ts` y las mutaciones están centralizadas en
`update`, de modo que sustituir el almacenamiento local por endpoints es un
cambio acotado a `store.tsx` y a los adaptadores de cada acción.

Quedan fuera de esta entrega, por depender de infraestructura externa:

- Firma y transmisión real a la DIAN (hoy simulada con estados y CUFE).
- Conexión bancaria y parseo real de CSV/XLSX/OFX (hoy carga simulada).
- Posteo automático en el libro Advantage desde facturación/cartera/CxP.
- Autenticación por rol y segregación de funciones a nivel de servidor.
- Contabilización automática de CIF, depreciación y cuotas de deuda en el libro
  mayor: los módulos de Costos y Financiación calculan y documentan el asiento,
  pero no lo escriben en el libro legado.

## Módulos agregados en la fase 2

Los módulos **Costos**, **Financiación y deuda** e **Indicadores y
proyecciones** se agregaron como espacios independientes del sidebar. No se
fusionaron con Cartera, Cuentas por pagar, Activos fijos ni Presupuestos; cada
uno conserva su propio `FinancialModuleId`, sus rutas y su submenú.

El detalle funcional de la fase 2 está en
[`docs/plan/SUITE_FINANCIERA_FASE2.md`](../plan/SUITE_FINANCIERA_FASE2.md).

## Cierre y apertura de períodos (fase 3.2)

El cierre mensual dejó de ser un checklist en memoria. Ahora genera el
comprobante `NO-YYYY-MM`, bloquea el período, crea el período siguiente con el
asiento `AP-YYYY-MM`, registra historial y permite reapertura controlada. El
motor vive en `Interface_web/src/data/cierres.ts` y la pantalla en
`Interface_web/src/pages/Cierres.tsx`. Detalle en
[`cierres.md`](cierres.md).

## Brechas operativas cerradas (fase 3.3)

Se agregaron seis pantallas sin fusionar módulos: provisión por deterioro y
conciliación con clientes en Cartera; descuentos y notas débito y conciliación
con proveedores en Cuentas por pagar; traslados en Activos fijos; y proyección
por proyecto en Presupuestos. Detalle en los documentos de cada módulo y en la
sección 10 de [`SUITE_FINANCIERA_FASE2.md`](../plan/SUITE_FINANCIERA_FASE2.md).

## Tributación (fase 3.4)

Facturación incorpora los formularios 300 (IVA), 350 (retención) y 110 (renta),
la declaración electrónica con checklist y acuse, y la exógena anual. Los
formularios se calculan desde las facturas y retenciones del estado local; la
presentación es simulada. Detalle en [`facturacion.md`](facturacion.md) y en la
sección 11 del plan.

## Transversales (fase 3.5)

Se agregaron tres módulos independientes: **Aprobaciones** (bandeja y reglas),
**Auditoría y control** (bitácora y permisos) y **Consolidación** (panel y
eliminaciones). Costos incorpora la distribución secundaria de centros de
servicio. Detalle en sus documentos y en la sección 12 del plan.

## Verificación

- `npx tsc --noEmit`
- `npm run build`
- `npm run test:assets`
- `node scripts/smoke.mjs` (flujo general de la aplicación)
- `node scripts/verify-finance.mjs` (89 pantallas de la suite, flujo
  Facturación → Cartera, flujo de Activos fijos, flujo de caja, cierre de
  períodos, brechas operativas, tributación y transversales)
