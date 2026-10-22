# Módulo de Financiación y deuda

**Estado:** implementado (solo interfaz, datos en `localStorage`).
**Ruta base:** `Interface_web/src/pages/finance/financiacion/`
**Sidebar:** `Financiación y deuda` → `/financiacion`.
**Módulo:** `FinancialModuleId = 'financiacion'`.

## Propósito

Administrar las obligaciones financieras de la compañía: préstamos bancarios,
calendarios de amortización, intereses, cupos de crédito y arrendamientos
financieros. El módulo separa la porción corriente de la no corriente y alimenta
los indicadores de endeudamiento y cobertura.

## Pantallas

| Slug | Pantalla | Contenido |
|---|---|---|
| `panel` | Panel de deuda | Saldo, cuota mensual, intereses, cupo disponible y próximos pagos |
| `prestamos` | Préstamos bancarios | Registro, tasa, plazo, saldo y estado |
| `amortizacion` | Calendario de amortización | Cuotas, interés, capital y saldo por préstamo |
| `pagos` | Intereses y pagos | Cuotas del año, pagadas y pendientes |
| `cupos` | Cupos de crédito | Líneas aprobadas, uso, tasa y vencimiento |
| `leasing` | Arrendamientos financieros | Contratos, cuota, opción de compra y tratamiento |
| `reportes` | Reportes de deuda | Perfil de vencimientos, intereses y concentración por entidad |

## Modelo de datos

### `Loan`

| Campo | Uso |
|---|---|
| `code`, `bank` | Identificación del préstamo y entidad |
| `principal` | Valor desembolsado |
| `annualRate` | Tasa efectiva anual (%) |
| `termMonths` | Plazo en meses |
| `startDate` | Fecha de desembolso |
| `purpose` | Destino del crédito |
| `status` | Vigente / Pagado / En mora / Cancelado |
| `creditLineId` | Cupo del que se dispuso |
| `note` | Observaciones |

### `AmortizationRow`

| Campo | Uso |
|---|---|
| `loanId`, `number` | Préstamo y número de cuota |
| `date` | Fecha de vencimiento |
| `opening`, `closing` | Saldo inicial y final |
| `payment` | Cuota total |
| `interest`, `principal` | Componentes de la cuota |
| `status` | Pendiente / Pagado |

### `CreditLine`

| Campo | Uso |
|---|---|
| `code`, `bank` | Identificación y entidad |
| `approved`, `used` | Cupo aprobado y utilizado |
| `annualRate` | Tasa de referencia |
| `expiresAt` | Vencimiento |
| `status` | Vigente / Vencida / Cerrada |

### `Lease`

| Campo | Uso |
|---|---|
| `code`, `assetName`, `lessor` | Contrato y activo |
| `monthlyPayment`, `termMonths`, `startDate` | Condiciones |
| `annualRate` | Tasa implícita |
| `option` | Compra / Devolución |
| `status` | Vigente / Finalizado |

## Reglas de cálculo

### Tasa mensual a partir de la tasa efectiva anual

```text
i = (1 + tasaEA / 100)^(1/12) − 1
```

### Cuota fija (sistema francés)

```text
cuota = P × i / (1 − (1 + i)^(−n))
```

Donde `P` es el capital, `i` la tasa mensual y `n` el número de cuotas.

### Composición de cada cuota

```text
interés   = saldo inicial × i
capital   = cuota − interés
saldo final = saldo inicial − capital
```

La última cuota ajusta el capital al saldo remanente para evitar residuos de
redondeo.

### Porción corriente y no corriente

- **Corriente:** capital de las primeras 12 cuotas pendientes de cada préstamo.
- **No corriente:** saldo total menos la porción corriente.

### Tasa promedio ponderada

```text
tasa promedio = Σ(saldo del préstamo × tasaEA) / Σ(saldos)
```

### Intereses proyectados

Suma de la columna de intereses de las cuotas pendientes de todos los préstamos
vigentes.

## Acciones

| Acción | Efecto |
|---|---|
| Crear préstamo | Agrega el `Loan`, genera el calendario completo y suma el valor al cupo utilizado |
| Registrar pago | Marca la cuota como `Pagado`; si no quedan pendientes, el préstamo pasa a `Pagado` |
| Cancelar préstamo | Pasa el préstamo a `Cancelado`, elimina cuotas pendientes y libera el cupo |
| Crear cupo | Agrega una `CreditLine` con código único |
| Editar cupo | Actualiza monto, uso, tasa, vencimiento y estado |

El registro de una cuota exige que sean las cuotas anteriores las ya pagadas: la
interfaz solo habilita la siguiente cuota pendiente.

## Datos iniciales

`seed.ts` incluye:

- 3 préstamos vigentes por `$ 420 M` con plazos de 30, 24 y 18 meses.
- Calendario de amortización generado con el sistema francés.
- 4 cupos de crédito (`CL-001` a `CL-004`), uno vencido.
- 2 arrendamientos financieros (`AR-2024-01` y `AR-2025-02`).

## Integración con otros módulos

- **Indicadores:** alimenta deuda financiera, deuda/EBITDA y cobertura de
  intereses.
- **Tesorería:** las cuotas se pagan desde una cuenta bancaria; hoy el módulo
  registra el pago sin generar la salida de tesorería.
- **Contabilidad general:** el asiento de intereses y abono a capital está
  documentado en el calendario, pero no se postea al libro legado.

## Límites de esta entrega

- No hay backend ni conexión bancaria.
- No se calcula el valor presente del leasing ni se genera su tabla de
  amortización; se muestran las condiciones del contrato.
- No hay reprogramación de cuotas ni periodos de gracia.
- No hay diferencias en cambio porque la suite opera en COP.

## Verificación

- `npx tsc --noEmit` sin errores.
- `npm run build` correcto.
- `node scripts/verify-finance.mjs`: las 7 pantallas renderizan y exponen
  préstamos, calendario, cupos y leasing.
