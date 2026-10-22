# Módulo de Indicadores y proyecciones

**Estado:** implementado (solo interfaz, datos en `localStorage`).
**Ruta base:** `Interface_web/src/pages/finance/indicadores/`
**Sidebar:** `Indicadores y proyecciones` → `/indicadores`.
**Módulo:** `FinancialModuleId = 'indicadores'`.

## Propósito

Dar una capa gerencial sobre los módulos operativos: catálogo de indicadores con
meta y seguimiento, proyección mensual del estado de resultados y comparación de
escenarios. No reemplaza al módulo de Presupuestos; lo interpreta y lo proyecta.

## Pantallas

| Slug | Pantalla | Contenido |
|---|---|---|
| `panel` | Tablero gerencial | KPIs, EBITDA mensual, indicadores fuera de meta y resumen por grupo |
| `catalogo` | Catálogo de indicadores | Definición, fórmula, meta, actual, anterior y cumplimiento |
| `proyecciones` | Proyecciones financieras | Estado de resultados proyectado mes a mes y caja libre |
| `escenarios` | Escenarios | Comparación Base / Optimista / Conservador |
| `reportes` | Informes gerenciales | Resumen ejecutivo, detalle de indicadores y escenarios |

## Modelo de datos

### `Indicator`

| Campo | Uso |
|---|---|
| `code`, `name` | Identificación |
| `group` | Liquidez, Endeudamiento, Rentabilidad, Actividad, Presupuesto |
| `formula` | Expresión de cálculo documentada |
| `unit` | `%`, `veces`, `días` o `$` |
| `target` | Meta del período |
| `actual`, `previous` | Valor actual y anterior |
| `direction` | Mayor es mejor / Menor es mejor |
| `note` | Interpretación |

### `Projection`

| Campo | Uso |
|---|---|
| `name`, `year` | Identificación |
| `scenario` | Base / Optimista / Conservador |
| `current` | Escenario vigente |
| `note` | Supuestos |
| `lines` | Líneas mensuales |

### `ProjectionLine`

| Campo | Uso |
|---|---|
| `account`, `accountName` | Cuenta PUC y nombre |
| `type` | Ingreso / Costo / Gasto / Inversión |
| `monthly` | Arreglo de 12 valores mensuales |

## Reglas de cálculo

### Cumplimiento de un indicador

```text
Si "Mayor es mejor": cumplimiento = actual / meta × 100
Si "Menor es mejor": cumplimiento = meta / actual × 100
```

El valor se acota a 100 % para los promedios, aunque la tabla puede mostrar el
excedente. Un indicador cumple cuando:

```text
"Mayor es mejor": actual >= meta
"Menor es mejor": actual <= meta
```

### Totales de la proyección

```text
Ingresos = Σ líneas tipo Ingreso
Costo    = Σ líneas tipo Costo
Gastos   = Σ líneas tipo Gasto
Inversión = Σ líneas tipo Inversión

EBITDA    = Ingresos − Costo − Gastos
Margen    = EBITDA / Ingresos × 100
Caja libre = EBITDA − Inversión
```

### Agregación mensual

Para cada mes `m`:

```text
EBITDA(m) = Ingresos(m) − Costo(m) − Gastos(m)
Caja(m)   = EBITDA(m) − Inversión(m)
```

### Construcción de una nueva proyección

La nueva versión parte del primer mes de ingresos del escenario base y aplica
crecimiento mensual compuesto:

```text
ingreso(m) = ingreso(0) × (1 + crecimiento)^m
costo(m)   = ingreso(m) × (costo de ventas %)
```

Los gastos administrativos y de ventas crecen a una tasa mensual fija (0,4 % y
0,5 % respectivamente). La depreciación y la inversión se mantienen constantes
por defecto.

### Comparación de escenarios

Se comparan los totales anuales de ingresos, costo, gastos, EBITDA, margen y
caja libre. La diferencia de EBITDA es el rango entre el mejor y el menor
escenario.

## Acciones

| Acción | Efecto |
|---|---|
| Crear indicador | Agrega un `Indicator` con código único |
| Editar indicador | Actualiza meta, valor actual, valor anterior y dirección |
| Crear proyección | Genera líneas mensuales a partir del escenario base y los supuestos |
| Marcar como vigente | Deja una sola proyección con `current = true` |

Todas las acciones dejan traza en `state.audit` con módulo `indicadores`.

## Datos iniciales

`seed.ts` incluye:

- 13 indicadores en 5 grupos (liquidez, endeudamiento, rentabilidad, actividad
  y presupuesto).
- 3 proyecciones para 2026: Base (vigente), Optimista y Conservador.
- 6 líneas por proyección: ingresos, costo de ventas, gastos administrativos,
  gastos de ventas, depreciación e inversión.

## Integración con otros módulos

- **Presupuestos:** la proyección base puede contrastarse contra la ejecución
  presupuestal; hoy son fuentes separadas.
- **Cartera / Tesorería:** los indicadores de rotación y cumplimiento de recaudo
  se alimentan de los saldos operativos.
- **Financiación:** deuda/EBITDA y cobertura de intereses usan el saldo del
  módulo de deuda.
- **Costos:** el margen bruto se contrasta con el costo real de los objetos de
  costo.

## Límites de esta entrega

- No hay backend ni cálculo automático desde el libro mayor: los valores actuales
  de los indicadores son datos del período.
- No hay proyección de balance general ni de flujo de caja detallado por cuenta.
- No hay simulación de sensibilidad por variable (tasa, precio, volumen).
- No hay exportación real a PDF/Excel; los botones simulan la acción.

## Verificación

- `npx tsc --noEmit` sin errores.
- `npm run build` correcto.
- `node scripts/verify-finance.mjs`: las 5 pantallas renderizan y muestran
  indicadores, proyección mensual y escenarios.
