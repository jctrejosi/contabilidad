# Módulos financieros operativos

Esta carpeta documenta los cinco módulos de la suite que se montaron sobre
`Interface_web`:

- [Facturación](facturacion.md)
- [Cuentas por cobrar](cartera.md)
- [Cuentas por pagar](cuentas-por-pagar.md)
- [Tesorería y bancos](tesoreria.md)
- [Presupuestos](presupuesto.md)

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
Presupuesto aprobado ────────────► compromiso ─► ejecución ─► alerta
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

## Verificación

- `npx tsc --noEmit`
- `npm run build`
- `node scripts/smoke.mjs` (flujo general de la aplicación)
- `node scripts/verify-finance.mjs` (40 pantallas + flujo Facturación → Cartera)
