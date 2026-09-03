# Modelo lógico neutro — Reglas de negocio (03)

Descripción **decisional** de la lógica de negocio central, sin atar a un
motor ni a un lenguaje. Esta es la especificación que debe implementar el
**servicio de contabilización** (backend) de cada despliegue. La referencia
ejecutable actual vive en
[`../postgresql/funciones.sql`](../postgresql/funciones.sql) (PL/pgSQL) y
debe leerse como **una implementación de estas reglas**, no como la regla en sí.

## 1. Ciclo de vida de un lote

```
Borrador ──validar──▶ Verificado ──aprobar──▶ Pendiente aprobacion ──aprobar──▶ Aprobado
    │                      │                        │                              │
    │◀─editar/corregir─────┘                        │                              │
    └──(con errores)◀───────────────────────────────┘                              │
        ▲                                                                          │
        └──validar con errores──┐ (vuelve a Con errores si hay issues)             │
                                                                                   ▼
Borrador ─validar(con errores)─▶ Con errores                             Contabilizando
                                                                                   │
    Anulado ◀──────────────── Fallido ◀──────────────────── Contabilizado ◀────────┘
```

Transiciones válidas (regla de la máquina de estados):

| De | A | Acción que lo permite |
|---|---|---|
| Borrador / Con errores | Verificado | `validar` sin errores |
| Borrador / Con errores | Con errores | `validar` con ≥1 error (o lote vacío) |
| Verificado / Pendiente aprobacion | Aprobado | `aprobar` |
| Verificado / Pendiente aprobacion / Aprobado | Con errores | **No permitido**: un lote aprobado no se degrada al revalidar (la revalidación solo actualiza estado si el lote está en estado editable) |
| Aprobado | Contabilizado | `contabilizar` (atómico, dentro de transacción) |
| Borrador…Aprobado | Anulado | Rechazo/anulación con `motivo` |

Reglas transversales del ciclo:

- **Solo se validan estados editables** (Borrador, Con errores, Verificado,
  Pendiente aprobacion, Aprobado). Un lote contabilizado o anulado jamás se
  revalida (B06).
- **Solo se contabiliza un lote Aprobado** y sobre **período Abierto**.
- **El lote es el vehículo de captura; el libro es el resultado.**
  Editar un lote contabilizado no existe: se anula el documento y se hace uno nuevo.

## 2. `validar` — centro de validación

Recalcula íntegramente los issues del lote (`lote_validaciones`):
borra los previos y los regenera recorriendo el lote, por línea y por grupo.

Reglas por **línea** (severidad Error salvo nota):

| # | Regla | Campo |
|---|---|---|
| V1 | La línea debe tener cuenta asignada | cuenta |
| V2 | La cuenta debe ser **afectable** | cuenta |
| V3 | No puede haber débito y crédito a la vez (el CHECK de tabla lo duplica a nivel motor) | debito |
| V4 | Debe haber al menos un valor (débito o crédito ≠ 0) | debito |
| V5 | Si la cuenta **controla tercero**, el tercero es obligatorio | tercero |
| V6 | Si la cuenta **controla centro**, el centro es obligatorio | centro |
| V7 | Si la cuenta controla base **o** la línea es de clase IVA/Retención, la base debe ser > 0 | base |
| V8 | Línea de clase `Retencion` exige `concepto_retencion_id` **explícito** (B03: nunca inferir la tarifa vigente) | concepto |
| V9 | Línea de clase `IVA` exige `tarifa_iva_id` **explícita** | tarifa |
| V10 | Advertencia: fecha de la línea fuera del período del lote | fecha |

Reglas por **grupo documental** (documento + fecha):

| # | Regla |
|---|---|
| V11 | Cada grupo debe cuadrar: Σ débito = Σ crédito **por documento**, no solo global (B01/T02) |
| V12 | Descuadre global del lote |
| V13 | El documento propuesto ya existe **Contabilizado** en el libro (duplicado) |

Reglas globales:

| # | Regla |
|---|---|
| V14 | Lote vacío = Error (no puede "cuadrar 0 = 0") (B06) |

Salida: `true` si no queda ningún issue de severidad Error; el estado pasa a
`Verificado` o `Con errores` **solo si** el lote está en un estado editable.

## 3. `contabilizar` — paso a libro (atómico, multi-documento)

Precondiciones: lote **Aprobado** · período **Abierto** · revalidación sin
errores · lote no contabilizado previamente (idempotencia).

Algoritmo (todo dentro de una sola transacción; cualquier fallo = rollback):

1. **Agrupar** las líneas por grupo documental `(comprobante, documento, fecha)`.
   Un lote produce **un documento por grupo** (B01). El comprobante del grupo
   se resuelve por código dentro de la compañía; si no existe, cae al
   comprobante del lote.
2. **Asignar consecutivo** por compañía/año/comprobante: se bloquea la fila de
   `consecutivos_comprobantes` (`FOR UPDATE`), se toma el valor y se avanza.
   Dos contabilizaciones simultáneas nunca reciben el mismo número.
3. **Crear el documento** en estado `Contabilizado`, con trazabilidad:
   `lote_id`, `usuario_id`, y UK parcial que garantiza que un mismo documento
   no puede estar Contabilizado dos veces en la compañía/año.
4. **Copiar las líneas** del grupo a `documento_lineas` (espejo inmutable,
   incluye dimensiones fiscales B03/B04: clase, concepto/tarifa, fechas,
   moneda alterna, NIT alterno, archivo de origen).
5. **Actualizar saldos** por cuenta, cuenta+tercero y cuenta+centro en el
   período del lote (upsert: suma a débito/crédito).
6. **Verificar cuadratura por documento** antes de continuar al siguiente grupo.
7. Cerrar: lote → `Contabilizado`, registro en bitácora (`EXITO`).

Contratos protegidos por el motor (red de seguridad, no dependen del servicio):

- `idempotency_key` único en lote y documento → el reintento de un envío no
  produce asientos duplicados (B07).
- UK `(compania_id, anio, comprobante_id, numero)` → no hay números repetidos.
- UK parcial documento Contabilizado → el libro no tiene duplicados.
- FKs compuestas `(compania_id, id)` → ninguna línea cruza maestros entre
  compañías (B05).
- Período inexistente o cerrado → rechazo del motor y del servicio.

## 4. `anular` — reversión trazable (nunca DELETE)

Anular un documento del libro **no lo borra**: lo marca `Anulado` y crea un
documento de **reversión** que lo deja con efecto neto cero (B02).

Algoritmo (transaccional):

1. Precondiciones: documento existe y está `Contabilizado`; el período de la
   reversión está **Abierto**.
2. Asignar consecutivo del comprobante de reversión (mismo mecanismo de bloqueo).
3. Crear el documento de reversión: `documento = 'REV-' || documento original`,
   `documento_original_id` = id del original (pareja original ↔ reversión),
   estado `Contabilizado`, con `motivo_anulacion` y `soporte_anulacion`.
4. Copiar las líneas del original **con débito y crédito intercambiados**
   (misma base, clase y dimensiones históricas; `origen = 'Reversion'`).
5. **Reversar saldos**: sumar en el período de la reversión el efecto invertido
   (original + reversión = 0 en el acumulado). Se aplica en los tres niveles:
   cuenta, cuenta+tercero, cuenta+centro.
6. Marcar el original `Anulado` con su motivo.
7. Bitácora `EXITO`.

> Convención del modelo: la reversión puede ir a **otro período** (p. ej.
> corregir febrero desde marzo), por eso los saldos se reversan en el período
> elegido y el original conserva intacto su movimiento histórico.

## 5. `regenerar_acumulados` — reconstrucción desde el libro

Los acumulados son **derivados** y se reconstruyen leyendo el libro. La
regeneración toma todas las líneas de `documento_lineas` de la compañía/año —
**incluye originales anulados y sus reversiones** para obtener el efecto neto
correcto (B02/B03) — y aplica por tipo:

| Tipo | Origen de datos | Resultado |
|---|---|---|
| Terceros | líneas con `tercero_id` | `acumulados_tercero`: Σ débito/crédito por tercero + cuenta |
| Centros | líneas con `centro_costo_id` | `acumulados_centro`: Σ débito/crédito por centro + cuenta |
| Retencion | líneas `clase = 'Retencion'` | `acumulados_retencion`: Σ base y valor por tercero + concepto + período |
| Iva | líneas `clase = 'IVA'` | `acumulados_iva`: Σ base y valor por tercero + tarifa + período |

La semántica de base/valor por clase es **neta**:

- Línea `Retencion`: `base` aporta a base acumulada; el valor retenido es el
  débito/crédito de la línea.
- Línea `IVA`: `base` aporta a base acumulada; el IVA es el débito/crédito.

Al terminar, `estado_acumulaciones` registra el período hasta el cual quedó
acumulado cada tipo; la UI advierte si el estado quedó desactualizado frente
al libro. Este proceso **nunca toca el libro**; por eso es seguro repetirlo
cuantas veces se quiera.

## 6. Dónde vive cada regla (arquitectura acordada)

| Capa | Responsabilidad |
|---|---|
| **Servicio (backend)** | `validar`, `aprobar`, `contabilizar`, `anular`, `regenerar` como operaciones de negocio: orquestación, máquina de estados, auditoría funcional, mensajes de error. Es el dueño del flujo. |
| **Base de datos** | Red de seguridad y garantías declarativas: CHECK, UK (incl. parciales), FKs compuestas, disparadores de auditoría, consecutivos atómicos, transacciones. **No** es dueña de la lógica, pero rechaza cualquier violación aunque el servicio falle. |

> Migración en curso: hoy las 4 operaciones están implementadas en
> `postgresql/funciones.sql` y validadas por `postgresql/scripts/validate.sql`
> (11 pruebas). La implementación definitiva las reproduce en el backend
> TypeScript; las funciones quedan como implementación de referencia y
> respaldo operativo. Cualquier motor destino debe ofrecer transacciones con
> aislamiento y bloqueo de fila; si no soporta índices parciales (Advantage),
> la unicidad de "documento Contabilizado" se garantiza con columna calculada
> o tabla auxiliar en el servicio.
