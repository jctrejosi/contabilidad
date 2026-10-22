# Cierre y apertura de períodos

Módulo transversal de la contabilidad general. Ejecuta el cierre mensual del
período, genera el comprobante de cierre, bloquea el período, abre el siguiente
con asiento de apertura y deja trazabilidad de cada decisión. La reapertura
existe como operación controlada y auditada.

> **Alcance de esta fase:** solo interfaz. El estado vive en `localStorage` y el
> saldo del período se toma de un snapshot determinista. No consulta todavía el
> libro legado ni el backend de PostgreSQL. Ver [Límites](#límites).

## Ruta

| Navegación | Ruta | Qué resuelve |
|---|---|---|
| Contabilidad general → Cierres | pestaña `cierres` de `Shell.tsx` | Checklist, comprobante, cierre, historial y apertura |

No tiene submenú propio en el sidebar: se entra desde **Contabilidad general**,
igual que Reprocesos y Consolidación.

## Pantalla

La pantalla se compone de cuatro bloques, en este orden:

1. **Encabezado.** Título, período en curso, estado (`Abierto`, `En cierre`,
   `Cerrado`) y última actualización de la bitácora.
2. **Cuatro indicadores.** Período, estado con conteo de verificaciones,
   comprobante de cierre y diferencia del balance.
3. **Tres pestañas.**
   - **Período actual:** checklist, vista previa del comprobante y acciones.
   - **Historial de cierres:** períodos cerrados, comprobante, usuario, fecha y
     motivo, con acceso al asiento y acción de reapertura.
   - **Apertura:** asiento de apertura del período vigente y su origen.
4. **Bitácora.** Últimos eventos con fecha, usuario y acción.

### Indicadores

| Indicador | Origen | Regla |
|---|---|---|
| Período | `currentPeriod()` | Primer período `Abierto` o `En cierre` por orden ascendente |
| Estado | `period.status` | Incluye `n de 7 verificaciones` |
| Comprobante de cierre | `period.closingEntry` | `NO-YYYY-MM` o `Sin generar` |
| Diferencia del balance | `trialBalanceDifference(id)` | Debe ser `0`; si no, muestra `Requiere ajuste` |

### Checklist previo al cierre

Siete verificaciones; tres son bloqueantes:

| Id | Verificación | Bloqueante | Automática |
|---|---|---|---|
| `c1` | Todos los lotes contabilizados | Sí | No |
| `c2` | Balance cuadrado (diferencia = 0) | Sí | **Sí** |
| `c3` | Conciliaciones bancarias completas | No | No |
| `c4` | Retenciones acumuladas | No | No |
| `c5` | IVA acumulado | No | No |
| `c6` | Respaldo de base de datos realizado | Sí | No |
| `c7` | Usuarios informados del cierre | No | No |

Reglas:

- `c2` no se puede alternar: se calcula desde el snapshot. Si el balance no
  cuadra, queda sin marcar y bloquea el cierre.
- `c1` muestra el número real de lotes pendientes tomados de `LOTES_INICIALES`.
- El resto se marca manualmente y cada cambio queda en la bitácora.
- Las verificaciones no bloqueantes se pueden dejar pendientes: el cierre
  procede, pero quedan visibles en el historial.

## Modelo de datos

Archivo: `Interface_web/src/data/cierres.ts`.

### `PeriodRecord`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | `YYYY-MM` |
| `year`, `month` | `number` | Período |
| `label` | `string` | `Febrero 2026` |
| `status` | `PeriodStatus` | `Abierto` · `En cierre` · `Cerrado` |
| `checks` | `PeriodCheck[]` | Checklist del período |
| `closingEntry` | `PeriodEntry?` | Comprobante `NO-YYYY-MM` |
| `openingEntry` | `PeriodEntry?` | Asiento `AP-YYYY-MM` |
| `closedAt`, `closedBy`, `note` | `string?` | Trazabilidad del cierre |

### `PeriodEntry`

Comprobante con `number`, `date`, `type` (`Cierre` o `Apertura`), `lines`,
totales `debit`/`credit`, `status: 'Generado'`, `generatedAt` y `generatedBy`.

### `CloseState`

```ts
interface CloseState {
  periods: PeriodRecord[];
  audit: CloseAudit[];
}
```

Persistencia: `localStorage` con la llave
`contabdsi:cierres:v1:<código de compañía>` (para la compañía demo,
`contabdsi:cierres:v1:001`). Si el almacenamiento falla o el JSON está dañado,
se vuelve al estado inicial sin romper la pantalla.

## Reglas de negocio

### Generación del comprobante de cierre

`buildClosingEntry(id, user)`:

1. Recorre las cuentas de resultado del snapshot.
2. Cancela cada saldo: las cuentas acreedoras se debitan, las deudoras se
   acreditan.
3. Calcula el neto del ejercicio.
4. Cierra contra la cuenta `330505` (Resultados del ejercicio): si el neto es
   acreedor, acredita; si es deudor, debita.
5. Numera `NO-YYYY-MM` con fecha del último día del período.

Generar el comprobante **no** cierra el período: lo deja en `En cierre`.

### Cierre

`closePeriod(...)` exige tres condiciones:

1. El período no está cerrado.
2. No quedan verificaciones bloqueantes pendientes.
3. Existe el comprobante de cierre.

Al confirmar:

- Marca `Cerrado`, guarda `closedAt`, `closedBy` y la nota.
- Crea el período siguiente en estado `Abierto` si no existe.
- Genera el asiento de apertura `AP-YYYY-MM` con fecha del primer día del
  período siguiente, a partir de los saldos de balance y trasladando el
  resultado a `330505`.
- Registra dos eventos en la bitácora: cierre y apertura.

La confirmación exige escribir literalmente `CIERRE` en un campo de texto. La
nota es opcional.

### Reapertura

`reopenPeriod(...)`:

- Solo opera sobre un período `Cerrado`.
- Falla si existe un período posterior cerrado: primero hay que reabrir el más
  reciente.
- Elimina el comprobante de cierre y limpia `closedAt`/`closedBy`.
- Elimina los períodos posteriores que no tengan comprobante propio (es decir,
  el período de apertura creado por el cierre).
- Devuelve el período a `Abierto` y registra el motivo en la bitácora.

La confirmación exige escribir literalmente `REABRIR`.

## Flujo

```text
Checklist (c1, c6 manuales; c2 automático)
        │
        ▼
Previsualizar y generar ──► NO-2026-02 (estado «En cierre»)
        │
        ▼
Cerrar Febrero 2026 ──► confirmación «CIERRE»
        │
        ├──► período «Cerrado»
        ├──► Marzo 2026 «Abierto»
        └──► asiento AP-2026-03
        │
        ▼
Reabrir (solo el último cerrado) ──► confirmación «REABRIR»
```

## Criterios de aceptación

| # | Criterio | Verificación |
|---|---|---|
| 1 | La pantalla muestra checklist, período y diferencia del balance | `verify-finance.mjs` § 11 |
| 2 | El comprobante se previsualiza antes de generarse | Manual + script |
| 3 | Generar deja el período en `En cierre` con `NO-YYYY-MM` | Script |
| 4 | Cerrar exige confirmación escrita | Script |
| 5 | El período siguiente queda abierto con `AP-YYYY-MM` | Script |
| 6 | El historial registra cierre, usuario, fecha y motivo | Script |
| 7 | Reabrir vuelve al checklist sin perder la trazabilidad | Script |
| 8 | El balance cuadrado se calcula, no se marca a mano | Código (`automatico`) |
| 9 | El estado sobrevive a la recarga | `localStorage` |

## Límites

- **Snapshot estático.** `SNAPSHOTS['2026-02']` está codificado en
  `cierres.ts`. Los períodos distintos de `2026-02` reutilizan ese snapshot
  (`snapshotFor`). El cierre no recalcula desde el libro mayor ni desde
  `contabdsi_datos`.
- **Sin bloqueo real de escritura.** El estado `Cerrado` es de interfaz: el
  backend no rechaza comprobantes con fecha en un período cerrado.
- **Sin consolidación.** La pestaña de consolidación es otra pantalla y no
  participa del cierre.
- **Sin reversión contable automática.** Reabrir elimina el comprobante del
  estado local; no genera un contra-asiento.
- **Una compañía por navegador.** La llave incluye el código de compañía, pero
  el snapshot no distingue compañías.

## Integración pendiente

Para convertir esta pantalla en cierre real se necesita, en este orden:

1. Endpoint de saldos por período en el backend (`cierres_repository.py` ya
   existe para consultas del legado).
2. Validación server-side de verificaciones bloqueantes.
3. Registro del cierre en `cierres` y bloqueo de escritura por fecha.
4. Numeración consecutiva desde `consecutivos_comprobantes`.
5. Reapertura con contra-asiento y permiso dedicado.
6. Reemplazar `loadCloseState`/`saveCloseState` por llamadas al backend sin
   cambiar la interfaz de `Cierres.tsx`.

## Operación

- **Reiniciar el cierre de la compañía demo:**

  ```js
  localStorage.removeItem('contabdsi:cierres:v1:001')
  ```

  Recargar la página. Vuelve a `Febrero 2026` abierto.

- **Consultar el estado actual:** en la consola del navegador,

  ```js
  JSON.parse(localStorage.getItem('contabdsi:cierres:v1:001'))
  ```

- **Verificación automatizada:**

  ```bash
  cd Interface_web
  node scripts/verify-finance.mjs
  ```

  La sección `11. Cierre y apertura de períodos` cubre el flujo completo.
