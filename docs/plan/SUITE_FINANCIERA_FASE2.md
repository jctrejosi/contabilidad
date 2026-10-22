# Plan de la suite financiera — Fase 2

**Fecha:** 2026-10-22
**Alcance:** módulos **Costos**, **Financiación y deuda** e **Indicadores y
proyecciones**, más el cierre de brechas identificadas en la evaluación.
**Naturaleza de la entrega:** solo interfaz. Toda la persistencia vive en
`localStorage` a través de `FinanceProvider`; no se agregaron endpoints ni
migraciones.

## 1. Decisiones de arquitectura

| Decisión | Resolución |
|---|---|
| Agrupación del sidebar | **No fusionar.** Cada módulo conserva su propio `FinancialModuleId`, su ruta y su submenú |
| Módulos existentes | Facturación, Cartera, Cuentas por pagar, Tesorería, Presupuestos y Activos fijos quedan intactos |
| Módulos nuevos | `costos`, `financiacion`, `indicadores` se agregan al final de `MODULE_ORDER` |
| Backend | Fuera de alcance en esta fase |
| Costos | Se implementan **costeo estándar con variaciones**, **ABC** y **distribución de CIF** |
| Nómina, inventario, multimoneda | Fuera de alcance: la fase se limita a finanzas |

### Consecuencia en navegación

El sidebar pasa de 6 a 9 módulos:

```text
Contabilidad general
Facturación
Cartera
Cuentas por pagar
Tesorería
Presupuestos
Activos fijos
Costos                    ← nuevo
Financiación y deuda      ← nuevo
Indicadores y proyecciones ← nuevo
```

Las rutas nuevas son `NavPage` derivadas de `FinancialModuleId`, por lo que el
router existente (`FinanceModulePage.tsx`) las resuelve sin cambios de
contrato.

---

## 2. Catálogo funcional — módulo Costos

### F-COS-001 · Panel de costos
- **Debe hacer:** mostrar costo total del período, CIF distribuido, variación
  neta y margen bruto; comparar costo por centro; listar pools pendientes y los
  objetos de costo de mayor participación.
- **Reglas:** costo total = Σ costo directo de centros activos + Σ valor de
  pools. Variación neta = costo real − costo estándar de los objetos.
- **Datos:** `costCenters`, `costPools`, `costAllocations`, `costObjects`.
- **Aceptación:** el panel abre con 4 KPIs, un gráfico de costo por centro y dos
  listas de seguimiento.

### F-COS-002 · Centros y conductores
- **Debe hacer:** listar, crear y editar centros de costo con tipo, responsable,
  inductor, unidad, consumo, costo directo y bases de distribución.
- **Reglas:** código único; centro inactivo no recibe CIF; `driverBasis` traduce
  el inductor a `areaM2`, `energyKwh`, `machineHours`, `insuredValue` o
  `driverQty`.
- **Datos:** `CostCenter`.
- **Aceptación:** se puede crear un centro y aparece en la tabla y en la
  distribución de CIF.

### F-COS-003 · Distribución de CIF
- **Debe hacer:** mostrar cada pool con valor, inductor, distribuido, pendiente y
  estado; ejecutar la distribución; mostrar el detalle pool → centro y el
  historial de corridas.
- **Reglas:** reparto proporcional a la base de cada centro activo; el último
  centro absorbe el redondeo; se reemplazan asignaciones previas del mismo pool
  y período; cada corrida deja una `CostRun`.
- **Datos:** `CostPool`, `CostAllocation`, `CostRun`.
- **Aceptación:** distribuir un pool deja el pendiente en cero y crea una
  corrida con estado `Calculada`.

### F-COS-004 · Costeo estándar
- **Debe hacer:** comparar costo estándar y real por objeto; descomponer la
  variación en precio y cantidad; calcular margen.
- **Reglas:**
  - `estándar = cantidadEstándar × precioEstándar × unidades`
  - `real = cantidadReal × precioReal × unidades`
  - `variaciónTotal = real − estándar`
  - `variaciónPrecio = (precioReal − precioEstándar) × cantidadReal × unidades`
  - `variaciónCantidad = (cantidadReal − cantidadEstándar) × precioEstándar × unidades`
- **Datos:** `CostObject`.
- **Aceptación:** la suma de variación de precio y cantidad coincide con la
  variación total de cada fila.

### F-COS-005 · Costeo ABC
- **Debe hacer:** listar actividades con conductor, consumo, costo y tasa;
  asignar el costo de las actividades a los objetos de cada centro.
- **Reglas:** tasa = costo total / consumo del conductor; asignación al objeto
  proporcional a su costo real dentro del centro; costo ABC unitario = asignado /
  unidades.
- **Datos:** `CostActivity`, `CostObject`, `CostRun`.
- **Aceptación:** ejecutar ABC crea una corrida con método `ABC` y el total de la
  corrida coincide con la suma de actividades.

### F-COS-006 · Costos por proyecto
- **Debe hacer:** aislar los objetos tipo proyecto y mostrar valor contratado,
  costo estándar, costo real, variación, ejecución y margen.
- **Reglas:** ejecución = costo real / valor contratado; margen = (contrato −
  costo real) / contrato.
- **Aceptación:** un proyecto con sobrecosto se marca en rojo y aumenta el
  contador de proyectos con sobrecosto.

### F-COS-007 · Reportes de costo
- **Debe hacer:** consolidar comparativo estándar vs. real, margen por objeto y
  participación por centro; ofrecer exportación simulada.
- **Aceptación:** el reporte refleja los mismos totales del panel y del costeo
  estándar.

---

## 3. Catálogo funcional — módulo Financiación y deuda

### F-FIN-001 · Panel de deuda
- **Debe hacer:** mostrar deuda financiera, cuota mensual, intereses del año y
  cupo disponible; graficar deuda por entidad; mostrar perfil de vencimientos,
  próximos pagos y composición corriente / no corriente.
- **Reglas:** deuda = saldo pendiente de préstamos vigentes o en mora.
- **Aceptación:** los totales coinciden con la suma de los calendarios de
  amortización.

### F-FIN-002 · Préstamos bancarios
- **Debe hacer:** listar y crear préstamos con entidad, cupo, valor, tasa EA,
  plazo, fecha de desembolso, destino y estado.
- **Reglas:** código único; el valor no puede exceder el cupo disponible; al
  crear se genera el calendario completo y se incrementa el cupo utilizado.
- **Datos:** `Loan`, `CreditLine`, `AmortizationRow`.
- **Aceptación:** un préstamo nuevo aparece en la tabla con saldo igual al
  desembolso y con su primera cuota pendiente.

### F-FIN-003 · Calendario de amortización
- **Debe hacer:** mostrar por préstamo el número, fecha, saldo inicial, cuota,
  interés, capital, saldo final y estado; permitir registrar el pago de la
  siguiente cuota.
- **Reglas:** sistema francés; tasa mensual `i = (1 + EA)^(1/12) − 1`; cuota
  `P × i / (1 − (1+i)^−n)`; la última cuota ajusta el capital.
- **Aceptación:** la suma de capital de las cuotas iguala el valor desembolsado y
  el saldo final de la última cuota es cero.

### F-FIN-004 · Intereses y pagos
- **Debe hacer:** consolidar las cuotas del año con filtros por préstamo y estado;
  registrar pagos.
- **Reglas:** solo se habilita la siguiente cuota pendiente de cada préstamo.
- **Aceptación:** al pagar una cuota cambia a `Pagado` y se actualizan los KPIs de
  capital e intereses pagados.

### F-FIN-005 · Cupos de crédito
- **Debe hacer:** listar, crear y editar líneas con cupo aprobado, utilizado,
  disponible, tasa, vencimiento y estado.
- **Reglas:** utilizado ≤ aprobado; una línea vencida no puede originar préstamos.
- **Aceptación:** el disponible se recalcula al crear o cancelar un préstamo.

### F-FIN-006 · Arrendamientos financieros
- **Debe hacer:** listar contratos con activo, arrendador, cuota, plazo, tasa,
  valor total, opción y estado; explicar el tratamiento contable.
- **Aceptación:** se distinguen los contratos con opción de compra y se muestra
  la cuota mensual agregada.

### F-FIN-007 · Reportes de deuda
- **Debe hacer:** mostrar deuda por entidad, tasa promedio ponderada, perfil de
  vencimientos por año, intereses pagados y pendientes.
- **Reglas:** tasa promedio = Σ(saldo × tasa) / Σ(saldos).
- **Aceptación:** el total del perfil de vencimientos coincide con la deuda
  vigente.

---

## 4. Catálogo funcional — módulo Indicadores y proyecciones

### F-IND-001 · Tablero gerencial
- **Debe hacer:** mostrar ingresos, EBITDA y caja libre proyectados; indicadores
  en meta y fuera de meta; gráfico de EBITDA mensual; resumen por grupo.
- **Reglas:** cumplimiento acotado a 100 % para promedios.
- **Aceptación:** el tablero usa el escenario vigente y resalta los indicadores
  en riesgo.

### F-IND-002 · Catálogo de indicadores
- **Debe hacer:** listar, filtrar, crear y editar indicadores con grupo, fórmula,
  unidad, meta, valor actual, anterior y dirección.
- **Reglas:** `Mayor es mejor` cumple con `actual ≥ meta`; `Menor es mejor`
  cumple con `actual ≤ meta`.
- **Datos:** `Indicator`.
- **Aceptación:** un indicador nuevo se refleja en el tablero y en el informe.

### F-IND-003 · Proyecciones financieras
- **Debe hacer:** mostrar el estado de resultados mensual, totales anuales,
  EBITDA y caja libre; permitir crear versiones y marcar la vigente.
- **Reglas:** `EBITDA = ingresos − costo − gastos`; `caja libre = EBITDA −
  inversión`; crecimiento mensual compuesto sobre los ingresos.
- **Datos:** `Projection`, `ProjectionLine`.
- **Aceptación:** la tabla mensual suma exactamente los totales del encabezado.

### F-IND-004 · Escenarios
- **Debe hacer:** comparar Base, Optimista y Conservador en ingresos, costo,
  gastos, EBITDA, margen y caja libre; permitir cambiar el escenario vigente.
- **Reglas:** la diferencia de EBITDA es el rango entre el mejor y el menor
  escenario.
- **Aceptación:** el comparativo coincide con los totales de cada proyección.

### F-IND-005 · Informes gerenciales
- **Debe hacer:** generar un resumen ejecutivo con cumplimiento promedio,
  indicadores en riesgo, escenario vigente y resumen de escenarios; exportación
  simulada.
- **Aceptación:** el texto del informe cita los indicadores fuera de meta y las
  cifras del escenario vigente.

---

## 5. Implementación realizada

### Archivos nuevos

```text
Interface_web/src/pages/finance/costos/
  index.tsx  Panel.tsx  Centros.tsx  Cif.tsx  Estandar.tsx
  Abc.tsx  Proyectos.tsx  Reportes.tsx  shared.tsx
Interface_web/src/pages/finance/financiacion/
  index.tsx  Panel.tsx  Prestamos.tsx  Amortizacion.tsx  Pagos.tsx
  Cupos.tsx  Leasing.tsx  Reportes.tsx  shared.tsx
Interface_web/src/pages/finance/indicadores/
  index.tsx  Panel.tsx  Catalogo.tsx  Proyecciones.tsx
  Escenarios.tsx  Reportes.tsx  shared.tsx
```

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/finance/types.ts` | Nuevas entidades y colecciones de los tres módulos |
| `src/finance/seed.ts` | Datos iniciales deterministas y generación de amortizaciones |
| `src/finance/store.tsx` | Migración retrocompatible de las colecciones nuevas |
| `src/data/finance.ts` | Configuración de los tres módulos y `MODULE_ORDER` |
| `src/components/Icon.tsx` | Iconos `cost`, `loan`, `indicator` |
| `src/pages/finance/FinanceModulePage.tsx` | Router de los tres módulos |
| `scripts/verify-finance.mjs` | Verificación de 68 pantallas y flujos nuevos |

### Cifras

| Concepto | Antes | Después |
|---|---|---|
| Módulos del sidebar | 6 | 9 |
| Pantallas de suite | 49 | 68 |
| Colecciones en `FinanceState` | 32 | 45 |
| Pantallas nuevas | — | 19 |

### Verificación ejecutada

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | Sin errores |
| `npm run build` | Correcto (aviso de bundle > 500 kB, preexistente) |
| `npm run test:assets` | 11/11 |
| `node scripts/verify-finance.mjs` | **68/68 pantallas + flujos: TODO OK** |

---

## 6. Brechas que siguen abiertas (Fase 3)

Estas funciones fueron identificadas en la evaluación y **no** forman parte de
la Fase 2. Se listan para que el plan completo quede por escrito.

### 6.1 Cerrar lo que ya existe

| Brecha | Módulo | Complejidad | Pantallas estimadas |
|---|---|---|---|
| ~~Flujo de caja real y proyectado~~ | Tesorería | Media | **Implementado (fase 3.1)** |
| ~~Gestión de liquidez y calendario de recaudos~~ | Tesorería | Media | **Implementado (fase 3.1)** |
| ~~Cierre y apertura real de períodos~~ | Contabilidad | Alta | **Implementado (fase 3.2)** |
| ~~Provisión por deterioro de cartera~~ | Cartera | Media | **Implementado (fase 3.3)** |
| ~~Conciliación de cuentas con clientes~~ | Cartera | Baja | **Implementado (fase 3.3)** |
| ~~Descuentos y notas débito de proveedor~~ | CxP | Baja | **Implementado (fase 3.3)** |
| ~~Conciliación formal con proveedores~~ | CxP | Baja | **Implementado (fase 3.3)** |
| ~~Traslado de activos fijos~~ | Activos fijos | Baja | **Implementado (fase 3.3)** |
| ~~Proyecciones por proyecto en presupuesto~~ | Presupuestos | Media | **Implementado (fase 3.3)** |

### 6.2 Profundizar tributación

| Brecha | Complejidad | Pantallas estimadas |
|---|---|---|
| ~~Formularios DIAN 300, 350 y 110~~ | Alta | **Implementado (fase 3.4)** |
| ~~Declaración electrónica y exógena validada~~ | Alta | **Implementado (fase 3.4, simulado)** |
| Integración real DIAN (XML UBL, firma, CUFE) | Muy alta | backend (pendiente) |

### 6.3 Transversales

| Brecha | Complejidad | Pantallas estimadas |
|---|---|---|
| Multimoneda, TRM y diferencias en cambio | Alta | **Fuera de alcance confirmado** |
| ~~Consolidación real con eliminación intercompañía~~ | Alta | **Implementado (fase 3.5)** |
| ~~Motor configurable de aprobaciones~~ | Media | **Implementado (fase 3.5)** |
| ~~Bitácora real y permisos persistentes~~ | Media | **Implementado (fase 3.5)** |
| ~~Distribución secundaria de centros de servicio~~ | Media | **Implementado (fase 3.5)** |

### 6.4 Fuera de alcance confirmado

- Nómina y seguridad social como módulo propio.
- Inventario y valoración de existencias.
- Multimoneda en esta fase.

---

## 7. Orden sugerido para la Fase 3

1. **Liquidez y caja:** flujo real, flujo proyectado, calendario de recaudos.
   — *Ejecutado en la fase 3.1.*
2. **Cierre contable:** ejecución real del cierre, bloqueo de período y apertura.
   — *Ejecutado en la fase 3.2.*
3. **Riesgo de cartera:** deterioro y conciliación con clientes.
   — *Ejecutado en la fase 3.3, junto con CxP, activos y presupuesto.*
4. **Tributación:** formularios y declaración electrónica.
   — *Interfaz ejecutada en la fase 3.4; la transmisión real sigue en backend.*
5. **Transversales:** multimoneda, consolidación, aprobaciones y auditoría.
   — *Consolidación, aprobaciones, auditoría y permisos ejecutados en la fase 3.5;
   multimoneda sigue fuera de alcance.*

Cada ola debe mantener la regla de esta fase: **interfaz primero**, con la capa
de dominio local en `FinanceProvider` y los contratos en `types.ts`, para que el
reemplazo por backend sea un cambio acotado a `store.tsx` y a los adaptadores de
acción.

---

## 8. Fase 3.1 ejecutada — liquidez y flujo de caja

**Fecha:** 2026-10-22. **Alcance:** solo interfaz; sin entidades nuevas, porque el
flujo se deriva del estado existente.

### Pantallas agregadas a Tesorería

| Slug | Pantalla | Función |
|---|---|---|
| `flujo` | Flujo de caja real | Entradas, salidas, neto y saldo de cierre mensual |
| `proyectado` | Flujo de caja proyectado | Horizonte de seis meses con recaudos y compromisos |
| `liquidez` | Liquidez y recaudos | Cobertura, posición semanal y calendarios |

### Fuentes del cálculo

| Flujo | Entradas | Salidas |
|---|---|---|
| Real | Recibos de caja | Pagos, cheques cobrados y caja menor |
| Proyectado | Cartera abierta por vencimiento | CxP, cuotas de deuda, leasing y reembolsos aprobados |
| Liquidez | Cartera a 30 días | CxP, deuda, leasing y gastos a 30 días |

Las transferencias entre cuentas se excluyen por ser movimientos internos. La
depreciación y las provisiones no entran al flujo porque no generan efectivo.

### Resultado

| Concepto | Antes | Después |
|---|---|---|
| Pantallas de Tesorería | 9 | 12 |
| Pantallas de la suite | 68 | 71 |
| Entidades nuevas | — | 0 |

### Verificación

`tsc --noEmit` limpio, `npm run build` correcto, `test:assets` 11/11 y
`verify-finance.mjs` con **71/71 pantallas y flujos en verde**.

---

## 9. Fase 3.2 ejecutada — cierre y apertura de períodos

**Fecha:** 2026-10-22. **Alcance:** solo interfaz. El período se cierra, se
bloquea y se reabre sobre un snapshot determinista; el backend no participa
 todavía.

### Motor nuevo

Archivo `Interface_web/src/data/cierres.ts`. Contiene el modelo
(`PeriodRecord`, `PeriodEntry`, `CloseState`), el snapshot contable de
`2026-02`, la plantilla de siete verificaciones (tres bloqueantes), el cálculo
de la diferencia del balance, la construcción del comprobante de cierre y del
asiento de apertura, y las operaciones `toggleCheck`, `generateClosing`,
`closePeriod` y `reopenPeriod`.

Persistencia: `localStorage` con la llave
`contabdsi:cierres:v1:<código de compañía>`.

### Pantalla

`Interface_web/src/pages/Cierres.tsx` se reescribió (~600 líneas). Cuatro
indicadores, tres pestañas (período actual, historial y apertura) y bitácora de
eventos. El checklist dejó de ser decorativo: cuenta lotes pendientes reales,
calcula la diferencia del balance y bloquea el cierre.

### Reglas implementadas

| Regla | Comportamiento |
|---|---|
| Generar comprobante | Deja el período en `En cierre` con `NO-YYYY-MM` |
| Cerrar | Exige verificaciones bloqueantes y confirmación escrita `CIERRE` |
| Apertura | Crea el período siguiente con `AP-YYYY-MM` al primer día |
| Cierre del resultado | Cancela cuentas de resultado contra `330505` |
| Reapertura | Solo el último período cerrado; confirmación `REABRIR` |
| Trazabilidad | Cada acción queda en la bitácora con usuario y fecha |

### Verificación

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | Limpio |
| `npm run build` | Correcto (aviso de bundle > 500 kB, preexistente) |
| `npm run test:assets` | 11/11 |
| `node scripts/verify-finance.mjs` | **71/71 pantallas + flujos: TODO OK** |

El script cubre el flujo completo en la sección `11. Cierre y apertura de
períodos`: checklist, vista previa, generación, cierre, apertura del mes
siguiente y reapertura.

### Límites documentados

- El snapshot de `2026-02` es estático; no se recalcula desde el libro legado.
- El bloqueo del período es de interfaz, no de escritura en el backend.
- La reapertura no genera contra-asiento.

El detalle funcional, el modelo y la integración pendiente están en
[`docs/modulos/cierres.md`](../modulos/cierres.md).

---

## 10. Fase 3.3 ejecutada — brechas operativas

**Fecha:** 2026-10-22. **Alcance:** solo interfaz. Se cierran las seis brechas
operativas que quedaban abiertas en la sección 6.1, sin fusionar módulos.

### Pantallas agregadas

| Módulo | Slug | Pantalla | Función |
|---|---|---|---|
| Cartera | `deterioro` | Provisión por deterioro | Cálculo por edades, aprobación y contabilización |
| Cartera | `conciliacion` | Conciliación con clientes | Auxiliar contra estado de cuenta y confirmación |
| Cuentas por pagar | `descuentos` | Descuentos y notas débito | Pronto pago, notas débito/crédito y devoluciones |
| Cuentas por pagar | `conciliacion` | Conciliación con proveedores | Auxiliar contra estado del proveedor |
| Activos fijos | `traslados` | Traslados | Ubicación, centro de costo y responsable |
| Presupuestos | `proyectos` | Proyección por proyecto | Presupuesto, ejecución y cierre estimado |

### Entidades nuevas

| Entidad | Módulo | Campos principales |
|---|---|---|
| `ImpairmentProvision` | Cartera | período, base, apertura, requerido, cargo, recuperación, cierre, estado |
| `CustomerReconciliation` | Cartera | cliente, período, saldo auxiliar, estado de cuenta, diferencia, confirmación |
| `SupplierAdjustment` | CxP | número, obligación, tipo, base, tasa, valor, estado |
| `SupplierReconciliation` | CxP | proveedor, período, saldos, diferencia, confirmación |
| `AssetTransfer` | Activos fijos | activo, origen, destino, centros, responsables, estado |
| `BudgetProjection` | Presupuestos | proyecto, centro, presupuesto, ejecutado, curva mensual, estado |

### Reglas implementadas

| Regla | Comportamiento |
|---|---|
| Deterioro | Tasa por tramo (0 %, 1 %, 5 %, 15 %, 35 %); cargo = requerido − apertura |
| Aprobación de provisión | Calculada → Aprobada → Contabilizada |
| Conciliación | Ajusta el saldo auxiliar al estado de cuenta y exige nota |
| Descuentos | Reducen la obligación; la nota débito la incrementa |
| Traslados | Al aplicar actualiza el activo y crea movimiento tipo `Traslado` |
| Proyección | Anual = ejecutado + meses restantes; desviación contra presupuesto |

### Resultado

| Concepto | Antes | Después |
|---|---|---|
| Pantallas de la suite | 71 | 77 |
| Entidades nuevas | — | 6 |
| Módulos del sidebar | 9 | 9 (sin fusiones) |

### Verificación

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | Limpio |
| `npm run build` | Correcto |
| `npm run test:assets` | 11/11 |
| `node scripts/verify-finance.mjs` | **77/77 pantallas + flujos: TODO OK** |

La sección `12. Brechas operativas de fase 3` del script recorre cálculo,
aprobación y contabilización de la provisión; las dos conciliaciones; el alta y
registro de un ajuste de proveedor; la solicitud de traslado; y la creación de
un proyecto presupuestal.

---

## 11. Fase 3.4 ejecutada — tributación

**Fecha:** 2026-10-22. **Alcance:** solo interfaz. Los formularios se calculan
desde el estado local y la presentación ante la DIAN es simulada: genera acuse y
bloquea el formulario, sin transmitir XML ni firmar electrónicamente.

### Pantallas agregadas a Facturación

| Slug | Pantalla | Función |
|---|---|---|
| `formulario-300` | Formulario 300 · IVA | IVA generado, descontable y saldo a pagar del bimestre |
| `formulario-350` | Formulario 350 · Retención | Retención en la fuente y ReteICA del período |
| `formulario-110` | Formulario 110 · Renta | Renta líquida, presuntiva, impuesto y saldo anual |
| `declaracion` | Declaración electrónica | Checklist, validación, presentación y acuse |
| `exogena` | Exógena y medios | Formatos anuales, terceros, incidencias y presentación |

### Entidades nuevas

| Entidad | Campos principales |
|---|---|
| `TaxFiling` | formulario, nombre, año, período, vencimiento, estado, casillas, saldo, acuse |
| `TaxBox` | número, concepto, valor y tipo (informativo, calculado, editable) |
| `ExogenousReport` | año, estado, vencimiento, formatos, nota y acuse |
| `ExogenousRow` | formato, concepto, terceros, valor reportado e incidencias |

### Cálculos implementados

| Formulario | Fuente | Fórmula |
|---|---|---|
| 300 | Facturas contabilizadas del período | IVA generado − IVA descontable − retenciones |
| 350 | Retenciones del período | Retención en la fuente + ReteICA + otras |
| 110 | Cierre anual | Renta líquida gravable × 35 % − descuentos − autorretenciones |

Las notas crédito restan de los ingresos y del IVA generado. Las casillas
marcadas como editables permiten ajustes con soporte y se conservan al
recalcular. La proyección de renta es editable en ingresos, deducciones,
presuntiva, descuentos y autorretenciones; el resto se calcula.

### Flujo de presentación

```text
Formulario calculado ──► Validar formulario ──► Validada
        │                                         │
        └──► Declaración electrónica ──► checklist ──► «PRESENTAR»
                                                       │
                                                       └──► Aceptada + acuse DIAN
Exógena en preparación ──► corregir incidencias ──► Validada ──► «EXOGENA» ──► acuse
```

### Resultado

| Concepto | Antes | Después |
|---|---|---|
| Pantallas de la suite | 77 | 82 |
| Entidades nuevas | — | 4 |
| Módulos del sidebar | 9 | 9 (sin fusiones) |

### Verificación

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | Limpio |
| `npm run build` | Correcto |
| `npm run test:assets` | 11/11 |
| `node scripts/verify-finance.mjs` | **82/82 pantallas + flujos: TODO OK** |

La sección `13. Tributación: formularios, declaración y exógena` valida los tres
formularios, la presentación con confirmación escrita y el acuse, además de la
corrección de incidencias y la presentación de la exógena.

### Límites

- No hay XML UBL, firma electrónica ni transmisión real a la DIAN.
- Los valores del formulario 110 son un cierre anual de referencia, no se
  recalculan desde el libro.
- La exógena valida sobre datos locales y no genera los archivos oficiales.

---

## 12. Fase 3.5 ejecutada — transversales

**Fecha:** 2026-10-22. **Alcance:** solo interfaz. Se agregan tres módulos
independientes al sidebar y una pantalla a Costos, sin fusionar los existentes.
La multimoneda sigue fuera de alcance por decisión del usuario.

### Módulos y pantallas

| Módulo | Slug | Pantalla | Función |
|---|---|---|---|
| Aprobaciones | `bandeja` | Bandeja de aprobaciones | Solicitudes de todos los módulos, nivel actual y decisión |
| Aprobaciones | `reglas` | Reglas y niveles | Umbrales por módulo, concepto y cantidad de aprobadores |
| Auditoría y control | `bitacora` | Bitácora de eventos | Trazabilidad por usuario, módulo, fecha y acción |
| Auditoría y control | `permisos` | Roles y permisos | Matriz rol × módulo y segregación de funciones |
| Consolidación | `panel` | Panel de consolidación | Perímetro, compañías, participación y totales |
| Consolidación | `eliminaciones` | Eliminaciones intercompañía | Saldos internos, aplicación y revisión |
| Costos | `secundaria` | Distribución secundaria | Costos de servicio redistribuidos a producción |

### Entidades nuevas

| Entidad | Módulo | Campos principales |
|---|---|---|
| `ApprovalRule` | Aprobaciones | módulo, concepto, rango, niveles y estado |
| `ApprovalRequest` | Aprobaciones | número, referencia, monto, nivel, histórico y estado |
| `ApprovalStep` | Aprobaciones | nivel, rol, usuario, acción, fecha y nota |
| `Role` | Auditoría | nombre, descripción, usuarios y estado |
| `RolePermission` | Auditoría | rol, módulo y nivel de acceso |
| `ConsolidationCompany` | Consolidación | código, NIT, país, participación y saldos |
| `EliminationEntry` | Consolidación | concepto, compañías, cuenta, débito, crédito y estado |
| `CostSecondaryAllocation` | Costos | centro origen, destino, inductor, monto y estado |

### Reglas implementadas

| Regla | Comportamiento |
|---|---|
| Aprobación | Al aprobar un nivel avanza al siguiente; el último deja la solicitud `Aprobada` |
| Rechazo | Deja la solicitud `Rechazada` y conserva la nota en el histórico |
| Regla inactiva | No aplica a nuevas solicitudes, pero conserva su histórico |
| Permisos | El cambio en la matriz se guarda de inmediato; el permiso de suite es global |
| Consolidación | Solo las compañías `Incluida` suman en los totales |
| Eliminaciones | No se generan nuevas mientras existan partidas pendientes |
| Distribución secundaria | Recalcular conserva lo aplicado y regenera lo calculado |

### Resultado

| Concepto | Antes | Después |
|---|---|---|
| Pantallas de la suite | 82 | 89 |
| Módulos del sidebar | 9 | 12 |
| Entidades nuevas | — | 8 |

### Verificación

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | Limpio |
| `npm run build` | Correcto |
| `npm run test:assets` | 11/11 |
| `node scripts/verify-finance.mjs` | **89/89 pantallas + flujos: TODO OK** |

La sección `14. Transversales` del script recorre la decisión de una solicitud,
la desactivación de una regla, la exportación de la bitácora, la matriz de
permisos, el panel de consolidación, la aplicación de una eliminación y el
recálculo de la distribución secundaria.

### Límites

- Los permisos son de interfaz: no bloquean endpoints ni operaciones del backend.
- La bitácora conserva los últimos 80 eventos por compañía en `localStorage`.
- La consolidación suma saldos individuales y aplica eliminaciones de interfaz;
  no ejecuta homologación de cuentas ni cálculo de minoritarios desde el libro.
- La distribución secundaria usa horas máquina como inductor y no genera asiento.
