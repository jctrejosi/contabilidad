# Consolidación

Módulo transversal para consolidar el grupo empresarial. Controla el perímetro
de compañías, suma sus saldos individuales y administra las eliminaciones de
operaciones intercompañía.

## Rutas

| Submenú | Ruta | Qué resuelve |
|---|---|---|
| Panel de consolidación | `consolidacion/panel` | Perímetro, participación y totales consolidados |
| Eliminaciones intercompañía | `consolidacion/eliminaciones` | Partidas internas, aplicación y revisión |

## Modelo de datos

### `ConsolidationCompany`

- `code`, `name`, `nit`, `country`.
- `ownership`: porcentaje de participación.
- `status`: `Incluida`, `En revisión` o `Excluida`.
- `assets`, `liabilities`, `equity`, `revenue`, `expenses`.
- `intercompanyReceivable`, `intercompanyPayable`.

### `EliminationEntry`

- `period`, `concept`, `fromCompany`, `toCompany`.
- `account`: cuentas que se eliminan.
- `debit`, `credit`.
- `status`: `Pendiente`, `Aplicada` o `Revisada`.
- `note`.

## Funcionalidad

### Panel

- KPIs de compañías incluidas, activos, pasivos y participación no controlante.
- Tabla con compañía, país, participación, activos, pasivos, patrimonio y estado.
- Inclusión o exclusión de una compañía del perímetro.
- Gráfico de composición de activos por compañía incluida.
- Totales de ingresos, patrimonio, eliminaciones y minoritarios.
- Minoritarios = patrimonio × (100 − participación) / 100.

### Eliminaciones

- KPIs de total eliminado, pendientes, aplicadas/revisadas y diferencia
  débito/crédito.
- Tabla con concepto, compañías, cuenta, débito, crédito y estado.
- Avance de estado: `Pendiente` → `Aplicada` → `Revisada`.
- Generación de eliminaciones desde los saldos intercompañía del perímetro.
- La generación se bloquea si quedan partidas pendientes.

## Reglas de negocio

- Solo las compañías `Incluida` suman en los totales.
- Excluir una compañía no borra sus datos ni su histórico.
- Las eliminaciones deben cuadrar débito y crédito.
- Una eliminación revisada no se modifica.
- Generar eliminaciones usa las cuentas por cobrar y por pagar intercompañía
  acumuladas de las compañías; una partida por cada saldo distinto de cero.

## Datos iniciales

- Cuatro compañías: matriz, dos subordinadas colombianas y una extranjera en
  revisión.
- Tres eliminaciones: ventas intercompañía aplicada, préstamo y servicios
  administrativos pendientes.

## Verificación

- `npx tsc --noEmit`
- `npm run build`
- `node scripts/verify-finance.mjs` — sección 14: panel, participación no
  controlante, aplicación de una eliminación y bloqueo por pendientes.

## Límites

- No hay homologación de cuentas ni traducción de moneda.
- La consolidación es de interfaz: no lee los libros de cada compañía.
- Los minoritarios se calculan sobre el patrimonio, no sobre el resultado.
- No se generan estados financieros consolidados ni notas.
