# Plan de implementación — Activos fijos

## 1. Objetivo

Incorporar a la suite financiera de CONTABDSI el módulo **Activos fijos** para
gestionar el ciclo de vida completo de las propiedades, planta y equipo:
registro, adiciones y mejoras, depreciación, deterioro, revalorización, bajas y
conciliación con el libro mayor.

El módulo se monta sobre la misma capa de dominio local de la suite
(`src/finance`), comparte el estado por compañía y deja trazabilidad en la
bitácora. No postea contra el libro Advantage en esta entrega, pero todos los
movimientos se generan con cuentas, débitos y créditos explícitos para que el
adaptador de posteo sea un cambio acotado.

## 2. Normativa de referencia

| Norma | Uso en el módulo |
|---|---|
| NIC 16 — Propiedades, planta y equipo | Costo, valor residual, vida útil, depreciación, modelo de revaluación y bajas |
| NIC 36 — Deterioro del valor de los activos | Registro de pérdidas por deterioro y reversiones |
| Art. 128 y 137 del Estatuto Tributario | Vida útil fiscal, depreciación por línea recta y depreciación acelerada |
| Art. 134 del Estatuto Tributario | Métodos aceptados: línea recta, saldos decrecientes y unidades de producción |
| PUC Colombia (Decreto 2650 de 1993 y ajustes NIIF) | Cuentas 15xx, 1592, 1596, 3805, 5160, 4245 y 5395 |
| Decreto 1625 de 2016 | Reglamentación de la depreciación fiscal |

El módulo distingue siempre **valor contable (NIIF)** y **valor fiscal**, porque
las vidas útiles y los métodos pueden diferir y generan diferencias temporales.

## 3. Entidades

### 3.1 Categoría de activo (`AssetCategory`)

Agrupa activos con la misma política contable y fiscal.

- Código, nombre y cuenta del activo (1504, 1516, 1520, 1524, 1528, 1540).
- Cuenta de gasto por depreciación (5160).
- Cuenta de depreciación acumulada (1592).
- Cuenta de deterioro acumulado (1596).
- Cuenta patrimonial de revalorización (3805).
- Vida útil contable en meses y vida útil fiscal en meses.
- Porcentaje de valor residual.
- Método: línea recta, saldos decrecientes o unidades de producción.
- Indicador de activo depreciable.

### 3.2 Activo (`Asset`)

- Código interno, nombre, descripción, categoría, serial, placa.
- Ubicación, centro de costo, responsable, proveedor y documento de compra.
- Fecha de adquisición, fecha de puesta en servicio.
- Costo de adquisición, mejoras, revalorización acumulada y deterioro.
- Valor residual, vida útil, método y meses depreciados.
- Depreciación acumulada, última depreciación y estado.
- Datos de seguro, garantía y notas.
- Campos de unidades estimadas y producidas para el método de unidades.
- Datos de retiro: fecha, valor de venta y estado final.

Estados: `En operación`, `En montaje`, `Totalmente depreciado`, `Dado de baja`,
`Vendido`.

### 3.3 Movimiento contable (`AssetMovement`)

Cada hecho económico del activo genera un movimiento con:

- Fecha, tipo, descripción y referencia.
- Cuenta débito y cuenta crédito.
- Valor y usuario.
- Activo asociado.

Tipos: `Adquisición`, `Mejora`, `Depreciación`, `Revalorización`, `Deterioro`,
`Baja`, `Venta`, `Traslado`, `Ajuste`.

### 3.4 Depreciación (`DepreciationEntry`)

- Periodo (`YYYY-MM`), activo, valor, acumulado después del asiento.
- Estado: `Proyectada`, `Contabilizada`, `Reversada`.
- Fecha de contabilización, centro de costo y cuenta de gasto.

### 3.5 Revalorización (`AssetRevaluation`)

- Activo, fecha, valor anterior, valor nuevo y superávit.
- Perito, informe y nota.
- Estado: `Borrador`, `Aprobada`, `Aplicada`, `Rechazada`.
- Aprobador y fecha de aplicación.

### 3.6 Baja (`AssetDisposal`)

- Activo, fecha y tipo: `Venta`, `Obsolescencia`, `Donación`, `Pérdida`,
  `Chatarra`.
- Valor de venta, valor en libros al retiro y resultado (utilidad o pérdida).
- Documento soporte, solicitante, aprobador y nota.
- Estado: `Solicitada`, `Aprobada`, `Aplicada`, `Rechazada`.

### 3.7 Conciliación (`AssetReconciliation`)

- Periodo y categoría.
- Saldo bruto, depreciación acumulada y deterioro según el libro mayor.
- Valores del sistema calculados desde los activos.
- Diferencia neta, estado, nota, responsable y fecha de revisión.

Estados: `Conciliada`, `Diferencia`, `Pendiente`.

## 4. Reglas de negocio

### 4.1 Registro y capitalización

- Un activo se capitaliza con costo de adquisición, IVA no descontable cuando
  aplique y costos directamente atribuibles.
- Si está `En montaje`, no deprecia hasta que se ponga en servicio.
- Toda adquisición genera movimiento: débito a la cuenta del activo y crédito a
  proveedores (2205) o bancos (1110).
- Una mejora aumenta el valor del activo y su vida útil si extiende la capacidad
  o la vida; genera movimiento con la misma contrapartida.

### 4.2 Depreciación

- La depreciación inicia el mes siguiente a la puesta en servicio.
- La base depreciable es: costo + mejoras + revalorización − deterioro − valor
  residual.
- Línea recta: valor en libros menos residual, dividido entre los meses
  restantes de vida útil. Este cálculo absorbe automáticamente las
  revalorizaciones y las mejoras.
- Saldos decrecientes: tasa anual `1 − (residual / base)^(1 / años)`; si el
  residual es cero se usa el doble del lineal. El valor mensual se aplica sobre
  el valor en libros y nunca deja el activo por debajo del residual.
- Unidades de producción: `(base − residual) × unidades del periodo / unidades
  estimadas`.
- Un activo totalmente depreciado no genera más asientos.
- El cierre de un periodo es idempotente: si ya existe un asiento
  `Contabilizada` para el activo y periodo, no se duplica.
- La reversión de un periodo deja los asientos en estado `Reversada` y
  restablece el acumulado y los meses depreciados.

### 4.3 Revalorización

- Se registra por el modelo de revaluación de NIC 16.
- El superávit es `valor nuevo − valor en libros actual` y se abona a la cuenta
  patrimonial 3805 (otro resultado integral), no a resultados.
- Si el activo tenía una pérdida por deterioro previa, primero se revierte
  hasta el valor recuperable y el exceso va a patrimonio.
- Flujo: `Borrador → Aprobada → Aplicada`; también puede rechazarse.
- Al aplicar, el activo aumenta su valor, se recalcula la depreciación sobre los
  meses restantes y se genera movimiento contable.

### 4.4 Deterioro

- Se registra cuando el valor recuperable es inferior al valor en libros.
- Débito al gasto (5199) y crédito al deterioro acumulado (1596).
- Reduce la base depreciable futura.

### 4.5 Bajas y retiros

- Valor en libros al retiro = costo + mejoras + revalorización − deterioro −
  depreciación acumulada.
- Resultado = valor de venta − valor en libros.
- Al aplicar la baja:
  - Se debita la depreciación acumulada y el deterioro.
  - Se acredita el costo bruto del activo.
  - Se debita bancos o cuentas por cobrar por el valor de venta.
  - La diferencia se lleva a utilidad (4245) o pérdida (5395).
- El activo cambia a `Vendido` o `Dado de baja` y sale de los totales, pero su
  histórico se conserva.
- Una baja requiere solicitud y aprobación antes de aplicarse.

### 4.6 Conciliación con el libro mayor

- Para cada periodo y categoría se comparan:
  - Saldo bruto del mayor contra la suma de costo + mejoras + revalorización.
  - Depreciación acumulada del mayor contra la suma del sistema.
  - Deterioro del mayor contra la suma del sistema.
- La diferencia neta es la resta de los valores netos.
- Una diferencia absoluta menor a $1 se considera conciliada.
- El módulo permite:
  - Marcar la categoría como conciliada con nota y responsable.
  - Registrar un ajuste que lleva la diferencia a la cuenta del activo o a
    resultados y actualiza el saldo del mayor.
  - Dejar la fila en `Pendiente` cuando aún no se ha revisado.

## 5. Catálogo funcional

### 5.1 Panel de activos (`activos-fijos/panel`)

| ID | Funcionalidad |
|---|---|
| F-AF-001 | Ver totales de costo bruto, depreciación acumulada, deterioro y valor neto en libros. |
| F-AF-002 | Ver número de activos por estado y por categoría. |
| F-AF-003 | Ver composición del valor neto por categoría. |
| F-AF-004 | Ver superávit por revalorización acumulado. |
| F-AF-005 | Ver alertas de activos en montaje, totalmente depreciados, revalorizaciones pendientes, bajas solicitadas y diferencias de conciliación. |
| F-AF-006 | Ver los activos de mayor valor y su porcentaje de depreciación. |
| F-AF-007 | Navegar desde cada alerta al submenú correspondiente. |

### 5.2 Registro de activos (`activos-fijos/registro`)

| ID | Funcionalidad |
|---|---|
| F-AF-010 | Listar activos con código, nombre, categoría, centro de costo, fecha, costo, valor neto y estado. |
| F-AF-011 | Buscar por código, nombre, serial o responsable. |
| F-AF-012 | Filtrar por categoría, estado y centro de costo. |
| F-AF-013 | Crear un activo con todos los datos de ficha y generar el asiento de adquisición. |
| F-AF-014 | Editar los datos descriptivos y de ubicación de un activo. |
| F-AF-015 | Poner en servicio un activo en montaje, fijando la fecha de inicio de depreciación. |
| F-AF-016 | Ver la ficha completa con valor bruto, acumulados, valor residual y valor neto. |
| F-AF-017 | Ver la depreciación del activo con asientos y proyección. |
| F-AF-018 | Ver los movimientos contables del activo. |
| F-AF-019 | Ver las revalorizaciones y bajas asociadas. |
| F-AF-020 | Registrar una mejora desde la ficha del activo. |
| F-AF-021 | Iniciar una revalorización desde la ficha del activo. |
| F-AF-022 | Iniciar una baja desde la ficha del activo. |
| F-AF-023 | Ver el porcentaje de depreciación acumulada y los meses restantes. |
| F-AF-024 | Registrar una pérdida por deterioro (NIC 36) desde la ficha del activo. |

### 5.3 Registro contable (`activos-fijos/movimientos`)

| ID | Funcionalidad |
|---|---|
| F-AF-030 | Ver todos los movimientos con fecha, activo, tipo, descripción, débito, crédito y valor. |
| F-AF-031 | Filtrar movimientos por tipo, periodo y texto. |
| F-AF-032 | Ver totales debitados y acreditados por tipo de movimiento. |
| F-AF-033 | Registrar una adquisición desde este submenú. |
| F-AF-034 | Registrar una mejora sobre un activo existente. |
| F-AF-035 | Identificar el documento soporte y el usuario que registró cada movimiento. |

### 5.4 Depreciación (`activos-fijos/depreciacion`)

| ID | Funcionalidad |
|---|---|
| F-AF-040 | Seleccionar el periodo a depreciar. |
| F-AF-041 | Ver la previsualización por activo: base, acumulado, valor del periodo, método y estado. |
| F-AF-042 | Ingresar unidades producidas del periodo para activos con ese método. |
| F-AF-043 | Contabilizar el periodo completo con confirmación y resumen. |
| F-AF-044 | Evitar duplicados si el periodo ya fue contabilizado. |
| F-AF-045 | Ver el historial de asientos por periodo y activo. |
| F-AF-046 | Revertir un periodo contabilizado. |
| F-AF-047 | Ver la proyección de depreciación de los próximos doce meses. |
| F-AF-048 | Ver el total mensual y el total anual proyectado. |

### 5.5 Revalorizaciones (`activos-fijos/revalorizaciones`)

| ID | Funcionalidad |
|---|---|
| F-AF-050 | Listar revalorizaciones con activo, fecha, valor anterior, valor nuevo, superávit, perito y estado. |
| F-AF-051 | Crear una revalorización calculando el superávit contra el valor en libros. |
| F-AF-052 | Aprobar una revalorización en borrador. |
| F-AF-053 | Aplicar una revalorización aprobada y generar el asiento patrimonial. |
| F-AF-054 | Rechazar una revalorización con nota obligatoria. |
| F-AF-055 | Ver el impacto en la depreciación futura. |

### 5.6 Bajas y retiros (`activos-fijos/bajas`)

| ID | Funcionalidad |
|---|---|
| F-AF-060 | Listar solicitudes con activo, fecha, tipo, valor en libros, valor de venta, resultado y estado. |
| F-AF-061 | Crear una solicitud de baja con cálculo automático del resultado. |
| F-AF-062 | Aprobar una solicitud. |
| F-AF-063 | Aplicar la baja y generar los asientos de retiro. |
| F-AF-064 | Rechazar una solicitud con nota obligatoria. |
| F-AF-065 | Ver el acta y el documento soporte de la baja. |
| F-AF-066 | Consultar activos dados de baja y vendidos sin perder su histórico. |

### 5.7 Conciliación con el mayor (`activos-fijos/conciliacion`)

| ID | Funcionalidad |
|---|---|
| F-AF-070 | Seleccionar el periodo de conciliación. |
| F-AF-071 | Ver por categoría el saldo bruto, la depreciación y el deterioro del mayor contra el sistema. |
| F-AF-072 | Ver la diferencia neta y su estado. |
| F-AF-073 | Marcar una categoría como conciliada con nota y responsable. |
| F-AF-074 | Registrar un ajuste contable por la diferencia. |
| F-AF-075 | Ver el resumen de categorías conciliadas, con diferencia y pendientes. |
| F-AF-076 | Ver la explicación del cuadre y las cuentas involucradas. |

### 5.8 Categorías y políticas (`activos-fijos/categorias`)

| ID | Funcionalidad |
|---|---|
| F-AF-080 | Listar categorías con cuentas, vida útil contable, vida útil fiscal, residual y método. |
| F-AF-081 | Crear una categoría con su política contable y fiscal. |
| F-AF-082 | Editar una categoría existente. |
| F-AF-083 | Activar o inactivar una categoría. |
| F-AF-084 | Ver el número de activos y el valor neto asociado a cada categoría. |
| F-AF-085 | Consultar la referencia normativa de cada política. |

### 5.9 Reportes (`activos-fijos/reportes`)

| ID | Funcionalidad |
|---|---|
| F-AF-090 | Libro de activos con costo, mejoras, revalorización, depreciación, deterioro y valor neto. |
| F-AF-091 | Cédula de depreciación por activo con los próximos doce meses. |
| F-AF-092 | Comparativo fiscal vs. NIIF por vida útil, valor mensual y diferencia. |
| F-AF-093 | Exportación simulada de cada reporte. |

## 6. Flujos

```text
Adquisición ──► Activo en montaje ──► Puesta en servicio ──► Depreciación mensual
                                                              │
                                                              ├──► Revalorización ──► 3805
                                                              ├──► Deterioro ───────► 1596
                                                              └──► Baja / venta ────► 4245 / 5395

Depreciación del periodo ──► asientos 5160 / 1592 ──► conciliación con el mayor
```

## 7. Cuentas contables por defecto

| Concepto | Cuenta |
|---|---|
| Terrenos | 1504 |
| Construcciones y edificaciones | 1516 |
| Maquinaria y equipo | 1520 |
| Equipo de oficina y muebles | 1524 |
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

## 8. Integración con la suite

- El módulo comparte `FinanceState`, `FinanceProvider` y la bitácora.
- Los activos se filtran por compañía mediante la llave de `localStorage`.
- Las cuentas de las categorías son las mismas que usa el plan de cuentas de la
  contabilidad general, de modo que la conciliación sea trazable.
- El estado se migra de forma retrocompatible: si una compañía ya tenía datos de
  la suite sin activos, se completan las colecciones nuevas con el seed.
- Queda preparado para que un adaptador futuro postee los movimientos al libro
  Advantage usando `AssetMovement` como contrato.

## 9. Criterios de aceptación

1. El sidebar muestra `Activos fijos` y sus nueve submenús.
2. El registro lista los activos y permite crear, editar y poner en servicio.
3. La depreciación de un periodo se previsualiza, se contabiliza y no se
   duplica; se puede revertir.
4. Una revalorización recorre borrador, aprobación y aplicación, y genera el
   asiento contra 3805.
5. Una baja recorre solicitud, aprobación y aplicación, y genera el resultado
   contra 4245 o 5395.
6. La conciliación compara mayor contra sistema por categoría y permite marcar
   o ajustar diferencias.
7. Los reportes muestran libro de activos, cédula y comparativo fiscal.
8. `npx tsc --noEmit`, `npm run build` y las pruebas de humo pasan.

## 10. Resultado de la ejecución

Implementado en `Interface_web/src/pages/finance/activos-fijos/` con nueve
submenús y acceso desde el sidebar de la suite:

| Entregable | Ubicación |
|---|---|
| Tipos y estados | `src/finance/types.ts` |
| Seed de 15 activos y 6 categorías | `src/finance/seed.ts` |
| Cálculos y conciliación | `src/finance/selectors.ts` |
| Migración de estado guardado | `src/finance/store.tsx` |
| Configuración del módulo | `src/data/finance.ts` |
| Panel y orquestación | `src/pages/finance/activos-fijos/index.tsx`, `Panel.tsx` |
| Registro y ficha | `Registro.tsx`, `shared.tsx` |
| Registro contable | `Movimientos.tsx` |
| Depreciación | `Depreciacion.tsx` |
| Revalorizaciones | `Revalorizaciones.tsx` |
| Bajas | `Bajas.tsx` |
| Conciliación | `Conciliacion.tsx` |
| Categorías | `Categorias.tsx` |
| Reportes | `Reportes.tsx` |
| Documentación | `docs/modulos/activos-fijos.md` |
| Verificación | `scripts/verify-finance.mjs` (sección 4 y 5) |

Verificación ejecutada:

- `npx tsc --noEmit`: sin errores.
- `npm run build`: correcto (aviso de bundle > 500 kB, preexistente).
- `npm run test:assets`: 11 pruebas de cálculo OK.
- `node scripts/verify-finance.mjs`: 49 pantallas y flujos de activos OK.

El smoke general conserva una validación del centro de informes que depende de
los acumulados del backend; en el entorno actual el backend no tiene datos del
ejercicio 2026, por lo que esa validación falla por una causa ajena al módulo.
