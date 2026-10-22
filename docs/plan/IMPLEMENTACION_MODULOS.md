# Plan de implementación — módulos financieros operativos

**Estado:** aprobado para ejecución  
**Alcance:** Facturación, Cuentas por cobrar, Cuentas por pagar, Tesorería y bancos y Presupuestos  
**Base:** `Interface_web` (React 19 + Vite + Tailwind v4)  
**Referencia funcional:** `docs/plan/suite-financiera/funcionalidades/` y `docs/plan/FIGMA_MAKE_SUITE.md`

## 1. Objetivo

Sustituir la plantilla genérica de módulo por **cinco espacios operativos completos**, cada uno con sus submenús, tablas, filtros, formularios, acciones y estados. La suite debe funcionar como un flujo continuo:

```
Factura de venta → CxC → recibo → aplicación → conciliación bancaria
Factura de compra → CxP → propuesta → aprobación → pago → conciliación
Presupuesto → compromiso → ejecución → alerta
```

## 2. Decisión de arquitectura

La contabilidad general seguirá usando el backend FastAPI/Advantage. Los cinco módulos nuevos se implementan con una **capa de dominio propia en el cliente**, persistida en `localStorage` por compañía, porque:

1. No existen aún tablas ni endpoints para facturación, cartera, CxP, tesorería y presupuesto.
2. Escribir en el libro contable real sin modelo de asientos, resoluciones y conciliación sería inseguro.
3. Permite entregar módulos utilizables y coherentes entre sí, con un contrato de datos explícito para conectar el backend después.

La capa se organiza en:

| Archivo | Responsabilidad |
|---|---|
| `src/finance/types.ts` | Entidades y estados del dominio |
| `src/finance/seed.ts` | Datos iniciales realistas y deterministas |
| `src/finance/store.tsx` | Estado compartido, persistencia y auditoría |
| `src/finance/selectors.ts` | Totales, aging, saldos y KPIs derivados |
| `src/components/finance/ui.tsx` | Tabla, tarjetas, modales, drawer, badges, campos y gráficos |

Toda mutación pasa por `update(draft, etiqueta)`, que clona el estado, aplica el cambio y registra el evento en la bitácora de la suite. El estado se guarda con la llave `contabdsi.finance.v1.<compañía>`.

## 3. Módulos y pantallas

### 3.1 Facturación (`facturacion`)

| Slug | Pantalla | Funciones cubiertas |
|---|---|---|
| `documentos` | Facturas de venta | Bandeja, KPIs, filtros, detalle, creación con líneas e impuestos, contabilización, envío DIAN |
| `compras` | Facturas de compra | Registro de proveedor, retenciones, obligación CxP |
| `notas` | Notas crédito y débito | Referencia a factura, motivo, ajuste de cartera/CxP |
| `dian` | Centro DIAN | Cola, estados, CUFE, eventos, reenvío y contingencia |
| `resoluciones` | Resoluciones y numeración | Rangos, vigencia, consecutivo y alertas de agotamiento |
| `productos` | Productos y servicios | Catálogo, impuesto por defecto, estado |
| `importar` | Importar documentos | Carga simulada, validación, resumen y creación de borradores |

Cubre `F-INV-001` a `F-INV-012` y `D-INV-01` a `D-INV-09`.

### 3.2 Cuentas por cobrar (`cartera`)

| Slug | Pantalla | Funciones cubiertas |
|---|---|---|
| `partidas` | Bandeja de cartera | Aging, filtros, detalle, historial y acciones |
| `recibos` | Recibos de caja | Registro, medio, cuenta, valor y estado |
| `aplicacion` | Aplicación de pagos | Vista dividida recibo/partida, aplicación parcial |
| `edades` | Edades de cartera | Matriz por cliente y rangos, totales |
| `estados-cuenta` | Estado de cuenta | Movimientos, saldo inicial/final, impresión |
| `cobro` | Cobro y promesas | Gestiones, promesas, cumplimiento e incumplimiento |
| `ajustes` | Castigos y ajustes | Solicitud, motivo, efecto en cartera |
| `anticipos` | Anticipos de cliente | Registro, aplicación y saldo |

Cubre `F-AR-001` a `F-AR-012` y `D-AR-01` a `D-AR-09`.

### 3.3 Cuentas por pagar (`cuentas-pagar`)

| Slug | Pantalla | Funciones cubiertas |
|---|---|---|
| `obligaciones` | Bandeja de obligaciones | Valor bruto, retenciones, neto, detalle y prioridad |
| `propuestas` | Propuestas de pago | Selección de CxP, total, aprobación segregada y ejecución |
| `pagos` | Pagos | Registro, aplicación y estado |
| `retenciones` | Retenciones y certificados | Cálculo, certificado y exportación |
| `anticipos` | Anticipos de proveedor | Registro y aplicación |
| `programacion` | Edades y programación | Aging, proyección de caja y prioridades |
| `estados-cuenta` | Estados de cuenta | Documentos, pagos y notas con saldo corrido por proveedor |
| `gastos` | Gastos y reembolsos | Soporte, aprobación, centro de costo y reembolso |
| `notas` | Notas de proveedor | Nota crédito de compra aplicada a CxP |

Cubre `F-AP-001` a `F-AP-012` y `D-AP-01` a `D-AP-08`.

### 3.4 Tesorería y bancos (`tesoreria`)

| Slug | Pantalla | Funciones cubiertas |
|---|---|---|
| `panel` | Panel de tesorería | Posición, entradas/salidas, próximos pagos y alertas |
| `cuentas` | Cuentas bancarias | Catálogo, saldo, cuenta contable y estado |
| `extractos` | Extractos | Listado, detalle, importación y validación |
| `conciliacion` | Conciliación | Extracto vs. libro, sugerencias, automática y manual |
| `reglas` | Reglas | Condiciones, prioridad, simulación y activación |
| `transferencias` | Transferencias | Origen, destino, comisión y afectación de saldos |
| `cheques` | Cheques | Emisión, cobro y anulación |
| `caja` | Caja menor | Movimientos, arqueo y cierre |
| `partidas` | Partidas conciliatorias | Pendientes, antigüedad y diferencia explicada |

Cubre `F-BNK-001` a `F-BNK-012` y `D-BNK-01` a `D-BNK-10`.

### 3.5 Presupuestos (`presupuesto`)

| Slug | Pantalla | Funciones cubiertas |
|---|---|---|
| `versiones` | Bandeja de presupuestos | Versiones, escenario, estado, vigente y duplicado |
| `editor` | Editor | Grilla cuenta/centro/mes editable, totales y guardado |
| `distribucion` | Distribución | Reparto anual, plantillas y validación de 100 % |
| `aprobacion` | Aprobación | Acta, segregación, aprobar/rechazar |
| `ejecucion` | Ejecución y compromisos | Presupuesto, comprometido, ejecutado y disponible |
| `comparativo` | Comparativo y escenarios | Variaciones absolutas/porcentuales y gráfico |
| `alertas` | Alertas | Umbral, severidad y silenciamiento |

Cubre `F-BGT-001` a `F-BGT-010` y `D-BGT-01` a `D-BGT-07`.

## 4. Flujo del dato

1. **Facturación** crea el documento y calcula base, IVA, retención y total.
2. Al contabilizar una venta nace una **CxC**; una compra neta de retenciones nace como **CxP**.
3. **Cartera** aplica recibos y anticipos; cada aplicación reduce el saldo y cambia el estado.
4. **CxP** agrupa obligaciones en propuestas; la aprobación habilita el pago y el pago reduce la obligación.
5. **Tesorería** mueve saldos entre cuentas, importa extractos, cruza líneas y explica diferencias.
6. **Presupuesto** compara el presupuesto aprobado contra ejecutado/comprometido y genera alertas.
7. Toda acción relevante deja un registro en la **bitácora de la suite**.

## 5. Criterios de aceptación

- Cada submenú abre una pantalla propia; no queda ninguna plantilla genérica.
- Los formularios validan campos obligatorios y montos.
- Las acciones modifican el estado y se reflejan en los demás módulos.
- Los totales de tablas, KPIs y drawers coinciden con las entidades.
- La interfaz conserva la identidad visual: sidebar `#001F4C`, acento `#0073C0`, tarjetas blancas, Inter + JetBrains Mono.
- `tsc`, `build` y `smoke` pasan sin errores.
- Cada módulo queda documentado en `docs/modulos/`.

## 6. Fases

1. Plan y capa de dominio.
2. Componentes compartidos e integración del router.
3. Facturación.
4. Cartera.
5. Cuentas por pagar.
6. Tesorería.
7. Presupuesto.
8. Documentación y validación integral.

## 7. Resultado de la ejecución

Implementado en `Interface_web/src/pages/finance/`:

- `Facturacion.tsx` (7 pantallas).
- `Cartera.tsx` (8 pantallas).
- `CuentasPagar.tsx` (8 pantallas).
- `Tesoreria.tsx` (9 pantallas).
- `Presupuesto.tsx` (7 pantallas).
- `FinanceModulePage.tsx` conecta el módulo y el submenú al router.

La capa de estado vive en `src/finance/` y los componentes compartidos en
`src/components/finance/ui.tsx`. El sidebar muestra badges calculados desde el
estado real y la plantilla genérica anterior fue retirada.

Documentación por módulo: [`docs/modulos/`](../modulos/README.md).

Validación ejecutada: `tsc`, `build`, `scripts/smoke.mjs` y
`scripts/verify-finance.mjs` (40 pantallas y flujo Facturación → Cartera).
