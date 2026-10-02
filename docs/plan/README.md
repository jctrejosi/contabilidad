# Planes

Aquí viven **dos planes separados**. Ordenan trabajos distintos, aunque compartan
las mismas fuentes: el plan de backend dice *qué endpoints y qué tablas faltan*;
el plan del bot dice *qué herramientas y qué fases necesita el asistente*.

---

## `backend/` — plan de implementación de la funcionalidad faltante

Ordena, por dependencia, todo lo que falta para que los controles que hoy simulan
en `Interface_web/` operen contra el backend. Inventario de **86 rutas nuevas** en
bloques A–E, 5 tablas nuevas y el contrato por endpoint.

| Documento | Contenido |
|---|---|
| `backend/PLAN_BACKEND.md` | ficha, reglas R1–R10, inventario de endpoints por bloque, orden por dependencia y verificación |
| `backend/detalle/maestros.md` | terceros, centros, comprobantes y tipos de documento (bloque B1, B1b, B2) |
| `backend/detalle/configuracion.md` | las seis pantallas de configuración por compañía (bloque B3) |
| `backend/detalle/movimientos.md` | captura directa, generación de lote, reembolsos y reasignación de NIT (bloques C, E1, E2) |
| `backend/detalle/impuestos.md` | acumulados, medios magnéticos, topes y cuentas en cero (bloque D1 y Especiales) |
| `backend/detalle/procesos.md` | cierres, consolidación y mantenimiento (bloques D2, D3, D4) |
| `backend/detalle/administracion.md` | usuarios y permisos, bitácora e integraciones (bloques D5, D6, D7) |
| `backend/detalle/informes.md` | flujo de caja y NIIF de los seis informes "Pendiente" (bloque A5) |

## `bot/` — plan del asistente (Daisy)

Fases del asistente, su fuente de conocimiento y las herramientas que merece la
pena exponerle, con la regla que lo rige: **no inventar** (ni datos ni
funcionalidad).

| Documento | Contenido |
|---|---|
| `bot/PLAN_BOT.md` | regla de no inventar, las fases 0 a 5, el inventario del aplicativo (el techo de lo que puede afirmar) y el estado de lo implementado |
| `bot/HERRAMIENTAS_PRIORIZADAS.md` | criterios de evaluación y el catálogo priorizado de herramientas (olas), con su dependencia de cada fase |

---

## Fuentes compartidas (no son planes)

Los dos planes descienden de los mismos documentos de origen, que se quedan en sus
carpetas:

- `docs/catalogo/MAPA_FUNCIONALIDAD.md`: mapa funcional control por control
  (conectado / local o simulado / inerte). Techo de lo que el bot puede afirmar y
  base del inventario del plan de backend.
- `docs/auditorias/AUDITORIA_FUNCIONALIDAD.md`: hallazgos H1–H18 con severidad y
  bloques A–E; base del orden del plan de backend.
- `docs/auditorias/VALIDACION_ASISTENTE.md`: validación del asistente contra
  `POST /chat` con las herramientas de la ola 1.

## Cómo se citan

Los documentos se citan en el resto de `docs/` como `NOMBRE.md:línea` (por
ejemplo `PLAN_BACKEND.md:417-444`). Esa cita apunta al nombre de archivo, no
a una ruta, así que esta tabla es la que resuelve la ubicación:

| Se cita como | Vive en |
|---|---|
| `PLAN_BACKEND.md` | `docs/plan/backend/PLAN_BACKEND.md` |
| `PLAN_BOT.md` | `docs/plan/bot/PLAN_BOT.md` |
| `HERRAMIENTAS_PRIORIZADAS.md` | `docs/plan/bot/HERRAMIENTAS_PRIORIZADAS.md` |
| `MAPA_FUNCIONALIDAD.md` | `docs/catalogo/MAPA_FUNCIONALIDAD.md` |
| `AUDITORIA_FUNCIONALIDAD.md` | `docs/auditorias/AUDITORIA_FUNCIONALIDAD.md` |
| `VALIDACION_ASISTENTE.md` | `docs/auditorias/VALIDACION_ASISTENTE.md` |
