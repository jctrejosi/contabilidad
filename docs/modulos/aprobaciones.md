# Aprobaciones

Módulo transversal de la suite. Centraliza las solicitudes que requieren visto
bueno de otros módulos, con reglas por umbral, uno o varios niveles y
trazabilidad de cada decisión.

## Rutas

| Submenú | Ruta | Qué resuelve |
|---|---|---|
| Bandeja de aprobaciones | `aprobaciones/bandeja` | Solicitudes activas, nivel actual, vencimiento y decisión |
| Reglas y niveles | `aprobaciones/reglas` | Umbrales por módulo, concepto, rango y aprobadores |

## Modelo de datos

### `ApprovalRule`

- `name`, `module`, `concept`.
- `minAmount`, `maxAmount`: rango de aplicación.
- `levels`: arreglo de `{ level, role, minAmount }`.
- `active`: si está inactiva no aplica a nuevas solicitudes.
- `note`: criterio de la regla.

### `ApprovalRequest`

- `number` (`APR-XXXX`), `module`, `concept`, `reference`.
- `party`, `amount`, `requestedBy`, `requestedAt`, `dueDate`.
- `status`: `Pendiente`, `Aprobada`, `Rechazada`, `Delegada` o `Vencida`.
- `currentLevel`, `totalLevels`, `ruleId`.
- `history`: pasos por nivel con rol, usuario, acción, fecha y nota.

## Reglas de negocio

- Aprobar un nivel intermedio avanza `currentLevel` y deja la solicitud
  `Pendiente`.
- Aprobar el último nivel deja la solicitud `Aprobada`.
- Rechazar en cualquier nivel deja la solicitud `Rechazada` y conserva la nota.
- Cada decisión actualiza el paso del nivel correspondiente del histórico.
- Una regla inactiva conserva su histórico y no se aplica a nuevas solicitudes.
- La bandeja se ordena por fecha de vencimiento ascendente.
- El filtro por módulo y estado no altera los totales globales de los KPIs.

```text
Solicitud ──► Regla (módulo + concepto + monto)
          ──► Nivel 1 ──► Nivel 2 ──► Aprobada
                     └──► Rechazada (con nota)
```

## Datos iniciales

- Cinco reglas: pagos menores y mayores a $ 20 M, bajas de activos,
  revalorizaciones y compras (inactiva).
- Cinco solicitudes: propuesta PROP-028, baja AF-0013, ajuste ADJ-0002,
  revalorización AV-2026-014 y pago PAG-4413 (vencida).

## Verificación

- `npx tsc --noEmit`
- `npm run build`
- `node scripts/verify-finance.mjs` — sección 14: decisión de una solicitud y
  desactivación de una regla.

## Límites

- No hay integración con los flujos reales de cada módulo: una aprobación no
  desbloquea por sí sola un pago, una baja o una revalorización.
- El rol del usuario no se valida contra el nivel que le corresponde.
- No hay escalamiento automático por vencimiento; la solicitud se marca
  `Vencida` en los datos iniciales.
- La persistencia es `localStorage`, igual que el resto de la suite.
