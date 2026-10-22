# Módulo de Costos

**Estado:** implementado (solo interfaz, datos en `localStorage`).
**Ruta base:** `Interface_web/src/pages/finance/costos/`
**Sidebar:** `Costos` → `/costos`.
**Módulo:** `FinancialModuleId = 'costos'`.

## Propósito

Acumular costos directos, distribuir costos indirectos de fabricación (CIF) y
medir el costo de productos, servicios y proyectos. Cubre dos modelos en
paralelo:

- **Costeo estándar** con descomposición de variaciones de precio y cantidad.
- **Costeo ABC** por actividades y conductores.

Ambos conviven con la distribución de CIF y el costeo por proyecto, sin fusionar
el módulo con Activos fijos ni con Presupuestos.

## Pantallas

| Slug | Pantalla | Contenido |
|---|---|---|
| `panel` | Panel de costos | KPIs, costo por centro, pools pendientes y objetos de mayor costo |
| `centros` | Centros y conductores | Catálogo de centros, inductor, base de distribución y costo directo |
| `cif` | Distribución de CIF | Pools, porcentaje distribuido, asignaciones y corridas |
| `secundaria` | Distribución secundaria | Costos de centros de servicio redistribuidos a producción |
| `estandar` | Costeo estándar | Costo estándar vs. real y variaciones de precio y cantidad |
| `abc` | Costeo ABC | Actividades, conductores, tasa y asignación a objetos |
| `proyectos` | Costos por proyecto | Valor contratado, costo real, ejecución y margen |
| `reportes` | Reportes de costo | Comparativo, margen por objeto y participación por centro |

## Modelo de datos

Definido en `src/finance/types.ts` y poblado en `src/finance/seed.ts`.

### `CostCenter`

Centro que acumula costo directo y recibe CIF.

| Campo | Uso |
|---|---|
| `code`, `name`, `kind` | Identificación y clasificación (Producción, Servicio, Administrativo, Comercial) |
| `manager` | Responsable |
| `driver`, `driverUnit`, `driverQty` | Inductor principal y consumo del período |
| `areaM2`, `energyKwh`, `machineHours`, `insuredValue` | Bases reales de distribución de CIF |
| `directCost` | Costo directo asignado al centro |
| `status` | Activo / Inactivo |

### `CostPool`

Costo indirecto pendiente de distribución.

| Campo | Uso |
|---|---|
| `code`, `name`, `account` | Identificación y cuenta PUC |
| `amount` | Valor del pool en el período |
| `driver`, `driverUnit` | Inductor de reparto |
| `period` | Período contable (`YYYY-MM`) |

### `CostAllocation`

Resultado de distribuir un pool hacia un centro.

| Campo | Uso |
|---|---|
| `poolId`, `centerId` | Origen y destino |
| `driverQty` | Base aplicada |
| `amount` | Valor asignado |
| `period`, `date` | Período y fecha de la corrida |

### `CostObject`

Producto, servicio o proyecto cuyo costo se mide.

| Campo | Uso |
|---|---|
| `kind` | Producto / Servicio / Proyecto |
| `productCode` | Código del producto o proyecto asociado |
| `centerId` | Centro responsable |
| `units` | Unidades del período |
| `standardQty`, `standardPrice` | Cantidad y precio estándar por unidad |
| `actualQty`, `actualPrice` | Cantidad y precio real por unidad |
| `revenue` | Ingreso del período |

### `CostActivity`

Actividad del modelo ABC.

| Campo | Uso |
|---|---|
| `centerId` | Centro al que pertenece |
| `driver`, `driverUnit`, `driverQty` | Conductor y consumo |
| `totalCost` | Costo acumulado de la actividad |

### `CostRun`

Historial de corridas de distribución o ABC.

| Campo | Uso |
|---|---|
| `method` | `CIF` o `ABC` |
| `total` | Valor distribuido |
| `status` | Calculada / Contabilizada |

## Reglas de cálculo

### Distribución secundaria

- Los centros de servicio activos (`kind = 'Servicio'`) redistribuyen su costo
  directo a los centros de producción activos.
- El inductor utilizado es horas máquina; si el centro no tiene horas, se usa su
  consumo de inductor.
- El monto asignado es `costo directo × peso / peso total`.
- Recalcular conserva las distribuciones `Aplicada` y regenera las `Calculada`.
- Aplicar una distribución la marca como `Aplicada`; no genera asiento.

### Base de distribución

`driverBasis(center, driver)` elige la base según el inductor del pool:

| Inductor | Base |
|---|---|
| Área ocupada | `areaM2` |
| Consumo eléctrico / kWh | `energyKwh` |
| Horas máquina | `machineHours` |
| Valor asegurado | `insuredValue` |
| Cualquier otro | `driverQty` |

### Distribución de CIF

1. Se toman los centros con estado `Activo`.
2. Se calcula la base de cada centro con `driverBasis`.
3. Se reparte el valor del pool en proporción a la base.
4. El último centro absorbe la diferencia de redondeo para que la suma sea
   exacta.
5. Se reemplazan las asignaciones previas del mismo pool y período.
6. Se registra una `CostRun` con estado `Calculada`.

### Costeo estándar

```text
Costo estándar = cantidad estándar × precio estándar × unidades
Costo real     = cantidad real     × precio real     × unidades
Variación total = costo real − costo estándar
Variación de precio   = (precio real − precio estándar) × cantidad real × unidades
Variación de cantidad = (cantidad real − cantidad estándar) × precio estándar × unidades
```

Una variación positiva es **desfavorable** (sobrecosto).

### Margen del objeto

```text
Margen = (ingreso − costo real) / ingreso × 100
```

### Costeo ABC

- Tasa de la actividad = `totalCost / driverQty`.
- El costo de las actividades de un centro se reparte entre sus objetos de costo
  en proporción al costo real de cada objeto dentro del centro.
- Costo ABC unitario = costo asignado / unidades del objeto.
- Se compara contra el costo real unitario para detectar diferencias.

### Costo por proyecto

Los objetos con `kind = 'Proyecto'` usan `revenue` como valor contratado. La
ejecución es `costo real / valor contratado` y el margen es el resultado del
proyecto sobre el contrato.

## Acciones

| Acción | Efecto |
|---|---|
| Crear centro | Agrega un `CostCenter` con código único |
| Editar centro | Actualiza políticas y bases de distribución |
| Crear objeto de costo | Agrega un `CostObject` con código único |
| Editar objeto de costo | Permite ajustar cantidades, precios e ingreso |
| Distribuir pool | Genera `CostAllocation` y una `CostRun` CIF |
| Ejecutar ABC | Genera una `CostRun` con método ABC |
| Contabilizar corrida | Cambia la última corrida calculada a `Contabilizada` |

Todas las acciones pasan por `update(...)` del `FinanceProvider`, por lo que
dejan traza en `state.audit` con módulo `costos`.

## Datos iniciales

`seed.ts` incluye 6 centros, 5 pools de CIF (2 distribuidos y 3 pendientes),
12 asignaciones, 6 objetos de costo, 6 actividades ABC y 2 corridas.

## Integración con otros módulos

- **Presupuestos:** los centros de costo comparten los códigos `ADM`, `VEN`,
  `OPE` y `TI` usados en las líneas presupuestales.
- **Activos fijos:** la depreciación de planta alimenta el pool `CIF-003`, pero
  el módulo no la recalcula; el valor del pool es un dato del período.
- **Contabilidad general:** cada corrida documenta el valor a contabilizar; el
  asiento en el libro legado no se escribe automáticamente.

## Límites de esta entrega

- No hay backend: todo se calcula y persiste en el navegador.
- No hay integración con inventario ni valoración de existencias.
- La distribución de CIF es de un nivel (pool → centro). No hay redistribución
  secundaria de centros de servicio a centros productivos.
- El costeo ABC no consume el CIF distribuido; usa el costo propio de cada
  actividad para evitar doble conteo.

## Verificación

- `npx tsc --noEmit`
- `npm run build`
- `npm run test:assets`
- `node scripts/verify-finance.mjs` — incluye la sección 14 con el recálculo de
  la distribución secundaria.

- `npx tsc --noEmit` sin errores.
- `npm run build` correcto.
- `node scripts/verify-finance.mjs`: las 7 pantallas de Costos renderizan y
  muestran centros, pools, objetos y actividades.
