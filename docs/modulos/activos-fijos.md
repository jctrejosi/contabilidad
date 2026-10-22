# Activos fijos

Módulo de propiedades, planta y equipo de la suite financiera. Cubre el ciclo
completo del activo: capitalización, mejoras, depreciación, deterioro,
revalorización, baja y conciliación con el libro mayor.

## Rutas

| Submenú | Ruta | Qué resuelve |
|---|---|---|
| Panel de activos | `activos-fijos/panel` | Totales, composición, alertas y últimos movimientos |
| Registro de activos | `activos-fijos/registro` | Inventario, filtros, ficha y creación de activos |
| Registro contable | `activos-fijos/movimientos` | Libro de asientos de todos los hechos económicos |
| Depreciación | `activos-fijos/depreciacion` | Cierre mensual, historial y proyección |
| Revalorizaciones | `activos-fijos/revalorizaciones` | Avalúos, aprobación y superávit patrimonial |
| Bajas y retiros | `activos-fijos/bajas` | Venta, obsolescencia, donación, pérdida y chatarra |
| Traslados | `activos-fijos/traslados` | Cambio de ubicación, centro de costo y responsable |
| Conciliación con el mayor | `activos-fijos/conciliacion` | Cuadre por categoría contra el libro |
| Categorías y políticas | `activos-fijos/categorias` | Cuentas PUC, vidas útiles, residual y método |
| Reportes | `activos-fijos/reportes` | Libro de activos, cédula y fiscal vs. NIIF |

## Arquitectura

| Capa | Ubicación |
|---|---|
| Entidades | `Interface_web/src/finance/types.ts` |
| Datos iniciales | `Interface_web/src/finance/seed.ts` |
| Cálculos | `Interface_web/src/finance/selectors.ts` |
| Estado y persistencia | `Interface_web/src/finance/store.tsx` |
| Acciones del módulo | `Interface_web/src/pages/finance/activos-fijos/index.tsx` |
| Vistas | `Interface_web/src/pages/finance/activos-fijos/` |
| Componentes compartidos | `activos-fijos/shared.tsx` |
| Configuración del sidebar | `Interface_web/src/data/finance.ts` |

El módulo comparte el `FinanceProvider` de la suite. El estado se guarda en
`localStorage` con la llave `contabdsi.finance.v1.<código de compañía>`. La
migración es retrocompatible: si la compañía ya existía sin activos, el store
completa las colecciones nuevas con el seed.

## Modelo de datos

### AssetCategory

Política contable y fiscal de un grupo de activos:

- Cuenta del activo (1504, 1516, 1520, 1524, 1528, 1540).
- Cuenta de gasto (5160), depreciación acumulada (1592), deterioro (1596) y
  superávit por revalorización (3805).
- Vida útil contable y fiscal en meses.
- Porcentaje de valor residual.
- Método: línea recta, saldos decrecientes o unidades de producción.
- Bandera de depreciable y de activa.

### Asset

Ficha completa del activo. Campos principales:

- Identificación: `code`, `name`, `description`, `serial`, `plate`.
- Localización: `location`, `costCenter`, `responsible`, `supplier`.
- Documento: `invoiceRef`, `acquisitionDate`, `inServiceDate`.
- Valores: `acquisitionCost`, `improvements`, `revaluation`, `impairment`,
  `residualValue`, `accumulatedDepreciation`.
- Política: `usefulLifeMonths`, `method`, `depreciatedMonths`.
- Producción: `estimatedUnits`, `producedUnits` para el método de unidades.
- Estado: `En operación`, `En montaje`, `Totalmente depreciado`, `Dado de baja`,
  `Vendido`.
- Retiro: `disposedAt`, `disposalValue`.
- Seguro y garantía: `insurancePolicy`, `warrantyUntil`.

### Movimientos

`AssetMovement` registra cada hecho con fecha, tipo, descripción, cuenta débito,
cuenta crédito, valor, referencia y usuario. Tipos: `Adquisición`, `Mejora`,
`Depreciación`, `Revalorización`, `Deterioro`, `Baja`, `Venta`, `Traslado` y
`Ajuste`.

### Depreciación

`DepreciationEntry` guarda periodo (`YYYY-MM`), activo, valor, acumulado después
del asiento, estado (`Proyectada`, `Contabilizada`, `Reversada`), fecha de
contabilización, centro de costo y cuenta de gasto.

### Revalorización

`AssetRevaluation` guarda valor anterior, valor nuevo, superávit, perito,
informe, estado (`Borrador`, `Aprobada`, `Aplicada`, `Rechazada`) y aprobador.

### Baja

`AssetDisposal` guarda tipo, valor de venta, valor en libros, resultado,
documento soporte, solicitante, aprobador y estado (`Solicitada`, `Aprobada`,
`Aplicada`, `Rechazada`).

### Conciliación

`AssetReconciliation` guarda periodo, categoría, saldos del mayor (bruto,
depreciación acumulada y deterioro), estado, nota, responsable y fecha de
revisión. Los valores del sistema se calculan en vivo desde los activos.

## Reglas de cálculo

### Valor bruto y neto

```text
Valor bruto = costo de adquisición + mejoras + revalorización
Valor neto  = valor bruto − deterioro − depreciación acumulada
Base depreciable = valor bruto − deterioro − valor residual
```

### Línea recta

```text
Cuota mensual = (valor neto − valor residual) / meses restantes
```

El cálculo sobre el valor neto y los meses restantes absorbe automáticamente
las mejoras y las revalorizaciones, sin recalcular todo el histórico.

### Saldos decrecientes

```text
Tasa anual = 1 − (residual / valor bruto)^(1 / años)
Cuota mensual = valor neto × tasa anual / 12
```

Si el residual es cero se usa el doble del lineal. La cuota nunca lleva el
activo por debajo del residual.

### Unidades de producción

```text
Cuota del periodo = base depreciable × unidades del periodo / unidades estimadas
```

El usuario ingresa las unidades producidas en la vista previa del cierre.

### Revalorización

```text
Superávit = valor nuevo − valor en libros actual
```

El superávit se abona a la cuenta 3805 (patrimonio). Si el valor disminuye, el
déficit se lleva a resultados cuando no existe superávit previo.

### Baja

```text
Resultado = valor de venta o recuperación − valor en libros
```

Se debita la depreciación acumulada y el deterioro, se acredita el costo bruto y
la diferencia va a utilidad (4245) o pérdida (5395).

## Flujos operativos

### Capitalizar un activo

1. Registro de activos → Nuevo activo.
2. Seleccione la categoría; la vida útil, el residual y el método se proponen
   desde la política.
3. Indique costo, fecha de adquisición y fecha de puesta en servicio.
4. Guarde. El módulo crea el activo y el movimiento de adquisición con débito a
   la cuenta del activo y crédito a proveedores (2205).

Si el activo queda `En montaje`, no deprecia. Desde la ficha se puede poner en
servicio; la depreciación inicia el mes siguiente.

### Cerrar la depreciación de un mes

1. Depreciación → seleccione el periodo.
2. Revise la vista previa por activo. Para el método de unidades, ingrese las
   unidades del periodo.
3. Contabilice. El sistema crea un asiento por activo, actualiza el acumulado y
   los meses depreciados.
4. Si el periodo ya estaba contabilizado, no se duplica.
5. Para deshacer, use Revertir en la tarjeta de periodos cerrados. Los asientos
   quedan en estado `Reversada` y el activo vuelve a su acumulado anterior.

### Revalorizar

1. Revalorizaciones → Nueva revalorización.
2. El sistema muestra el valor en libros y calcula el superávit contra el valor
   nuevo.
3. El avalúo queda en `Borrador`.
4. Aprobar → `Aprobada`.
5. Aplicar → actualiza el activo, genera el movimiento contra 3805 y recalcula
   la depreciación futura.

### Registrar deterioro

1. Abra la ficha del activo en Registro de activos.
2. Use Registrar deterioro.
3. Indique la pérdida y su justificación. El valor no puede superar el valor
   neto en libros.
4. El sistema debita el gasto 5199, acredita el deterioro acumulado 1596 y
   reduce la base depreciable futura.

### Dar de baja

1. Bajas y retiros → Nueva baja.
2. Seleccione el activo y el tipo. El sistema calcula el valor en libros y el
   resultado con el valor de venta.
3. La solicitud queda en `Solicitada`.
4. Aprobar → `Aprobada`.
5. Aplicar → el activo pasa a `Vendido` o `Dado de baja`, sale de los totales y
   se generan los asientos de retiro. El histórico se conserva.

### Conciliar

1. Conciliación con el mayor → seleccione el periodo.
2. La tabla compara, por categoría, los saldos del mayor contra los del sistema.
3. Si la diferencia es menor a $1, la categoría se puede marcar como conciliada
   con una nota.
4. Si hay diferencia, use Registrar ajuste: el sistema cuadra el mayor contra el
   valor del sistema y genera un movimiento tipo `Ajuste`.

### Trasladar

1. Traslados → Nuevo traslado.
2. Seleccione el activo, la fecha, la ubicación destino, el centro de costo
   destino y el responsable destino.
3. Escriba el motivo (mínimo 8 caracteres). El activo debe cambiar al menos uno
   de los tres atributos.
4. La solicitud queda en `Solicitado` → `Aprobado` → `Aplicado`.
5. Al aplicar, el activo actualiza ubicación, centro de costo y responsable, y se
   crea un movimiento tipo `Traslado` sin efecto neto en el valor.

## Cuentas por defecto

| Concepto | Cuenta |
|---|---|
| Terrenos | 1504 |
| Construcciones y edificaciones | 1516 |
| Maquinaria y equipo | 1520 |
| Muebles y equipo de oficina | 1524 |
| Equipo de computación y comunicación | 1528 |
| Flota y equipo de transporte | 1540 |
| Depreciación acumulada | 1592 |
| Deterioro acumulado | 1596 |
| Superávit por revalorización | 3805 |
| Gasto por depreciación | 5160 |
| Gasto por deterioro | 5199 |
| Utilidad en venta de PP&E | 4245 |
| Pérdida en venta de PP&E | 5395 |
| Proveedores | 2205 |
| Bancos | 1110 |

## Datos iniciales

El seed incluye quince activos en seis categorías: sede administrativa, bodega,
terreno, línea de empaque, compresor, montacargas, planta eléctrica, dos
vehículos, servidores, equipos de cómputo, mobiliario, un activo totalmente
depreciado, un vehículo vendido y una empacadora en montaje.

También incluye:

- Depreciación de enero de 2026 contabilizada.
- Revalorización aplicada de la sede por $ 180.000.000.
- Revalorización aprobada de la bodega por $ 172.500.000, pendiente de aplicar.
- Revalorización en borrador de la línea de empaque.
- Baja aplicada del vehículo vendido y solicitud de baja del servidor obsoleto.
- Conciliaciones de enero con dos diferencias intencionales (maquinaria y
  muebles) y una categoría pendiente (flota).
- Dos traslados: uno aplicado del montacargas y uno solicitado para el
  mobiliario de oficinas.

## Estados y tonos

| Estado | Significado |
|---|---|
| En operación | Activo en uso y depreciando |
| En montaje | Capitalizado, aún no depreciable |
| Totalmente depreciado | Alcanzó su valor residual o agotó la vida útil |
| Vendido | Baja por venta; conserva histórico |
| Dado de baja | Retiro por obsolescencia, donación, pérdida o chatarra |

## Verificación

- `npx tsc --noEmit`
- `npm run build`
- `npm run test:assets` (cálculos de depreciación, deterioro y conciliación)
- `node scripts/verify-finance.mjs` (49 pantallas + flujo de activos fijos)

El smoke general incluye una validación del centro de informes que depende de
los acumulados del backend; si el backend no tiene datos del ejercicio, esa
validación falla por una causa ajena a este módulo.

## Alcance y siguientes pasos

Esta entrega es una capa de dominio local, igual que el resto de la suite. El
módulo de traslados actualiza el activo y crea el movimiento, pero la
reclasificación analítica entre centros se documenta sin asiento separado.
Queda pendiente para producción:

- Posteo real de los movimientos al libro Advantage.
- Importación del mayor para la conciliación (hoy los saldos del mayor se
  editan mediante el ajuste).
- Cálculo de diferencia en cambio para activos en moneda extranjera.
- Deterioro con prueba de valor recuperable y reversión automática.
- Depreciación fiscal acelerada por turnos (Art. 137 ET) como regla configurable.
- Adjuntar el informe de avalúo y las actas de baja como documentos.
