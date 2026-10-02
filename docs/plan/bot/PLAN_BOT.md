# Plan del asistente contable (Daisy) — fases e inventario

Complementa el plan por fases con dos piezas: la **fuente de conocimiento** (para
que los procedimientos salgan de la documentación y no del modelo) y el
**inventario del aplicativo**, que es el techo de lo que el asistente puede
afirmar. Nace de la pregunta concreta: *¿cómo puede explicar «los pasos para
registrar un comprobante contable» si no tiene manual?*

> Este es el **plan del bot** (`docs/plan/bot/`). El otro plan es el de backend,
> en `../backend/PLAN_BACKEND.md`; el índice de los dos está en `../README.md`.

---

## 0. Regla que rige todo: no inventar

Hoy el prompt de sistema ya prohíbe inventar **datos** (regla 3: saldos, cuentas,
terceros, documentos, cifras). Falta prohibir inventar **funcionalidad**, que es
más fácil de pasar por alto y más difícil de detectar:

1. **Datos**: nunca cifras ni registros. Si piden uno, indicar en qué pantalla se
   consulta. *(Ya está en el prompt.)*
2. **Funcionalidad**: no describir pantallas, campos, botones ni pasos que no
   existan en el inventario (§3). Si un módulo existe pero está en demostración,
   **decirlo**.
3. **Cuando no haya fuente, decirlo**: «eso no lo puedo verificar» es una
   respuesta válida y preferible a un procedimiento plausible pero falso.

**Principio de diseño.** La fuente de conocimiento **se genera desde el propio
inventario**, no se escribe a mano: así no puede describir algo que no existe ni
quedarse desactualizada cuando cambie una pantalla. Es la diferencia entre un
manual y una promesa.

---

## 1. Estado de partida (verificado por lectura del código)

| Pieza | Estado |
|---|---|
| `ia-service` (FastAPI, puerto 8003) | `/chat`, `/chat/options`, `/health`. **Sin base de datos**: no hay una sola referencia a Postgres ni a ADS |
| Loop de function calling | Listo en `app/deepseek.py`: manda `tools.TOOLS`, ejecuta `tool_calls`, hasta `MAX_TOOL_ROUNDS = 6` |
| `app/tools.py` | `TOOLS = []` y `FUNCTION_MAP = {}` **vacíos**; `QUICK_OPTIONS` con 4 sugerencias fijas |
| Prompt de sistema | `SYSTEM_PROMPT` (6 reglas) + `NO_TOOLS_HINT` + bloque de contexto de sesión + historial (12 mensajes) |
| Widget (`BotChat.tsx`) | Pinta **sólo** `reply`. `payload` está en el contrato de `api/bot.ts` y **nadie lo renderiza** |
| Backend | **48 rutas**; `store.py` es fachada que despacha por operación a `postgres_repository` o `ads_repository` |

---

## 2. Fases

### Fase 0 — Transporte y andamiaje
Las herramientas **llaman al backend por HTTP**, no a la base: la lógica de
filtros y validaciones no se duplica, el asistente funciona igual con Advantage o
con PostgreSQL, y no necesita credenciales de base. Se añade
`IA_SERVICE_BACKEND_URL`, se acuerda la forma del `payload` de datos y se registra
**una** herramienta inocua para probar el loop de punta a punta.
*Salida:* el modelo la invoca y el `payload` llega al frontend.

> **Estado 2026-09-22: hecha.** `IA_SERVICE_BACKEND_URL` (por defecto
> `http://localhost:8001`) y `IA_SERVICE_BACKEND_TIMEOUT` en `app/config.py` y en
> `.env.example`; cliente HTTP único en `app/backend_client.py` con tiempo de
> espera y mapeo de errores a `{"ok": false, "mensaje": ...}`; forma acordada del
> `payload` declarada en `app/payload.py` (la de `InformeAdicional` más los campos
> de trazabilidad); y en `app/tools.py` están registradas las **ocho**
> herramientas de solo texto del apartado 3.1 de `HERRAMIENTAS_PRIORIZADAS.md`
> (pasos 2 a 4 de su punto 3.4), no una sola: el paso 2 de aquel documento pide
> T-01 como herramienta inocua y los pasos 3 y 4 el resto de la ola 1.
> Verificación en `ia-service/scripts/verificar_herramientas.py` y `GET /health`
> lista las herramientas registradas y si se le anuncian al modelo.
>
> **Pendiente de la fase 0:** la comprobación de que el `payload` llega al
> frontend de punta a punta no se puede cerrar aquí, porque depende de la fase 2
> (el widget todavía no lo pinta); y la línea base de preguntas trampa del punto 5
> (paso 4) de `HERRAMIENTAS_PRIORIZADAS.md` no se grabó.

### Fase 1 — Herramientas del contexto
`consultar_periodo_operacion`, `consultar_parametros_operacion`,
`listar_companias`. Baratas, ya existen como endpoints, y evitan que el asistente
adivine en qué período está el usuario.
*Salida:* misma respuesta que el endpoint con los mismos filtros.

### Fase 1.5 — Fuente de conocimiento (la pieza que faltaba)
Es la que responde «¿cómo registro un comprobante?» con los pasos **reales**.

1. Un script (`ia-service/generar_catalogo.py` o similar) lee el inventario —
   rutas de `src/App.tsx`, llamadas de `src/api/*.ts`, rutas de `backend/app.py` —
   y los 15 documentos de `docs/*.md`, y produce un catálogo por módulo: qué
   pantalla existe, qué campos y filtros tiene, qué endpoint usa y **si está
   conectada o en demostración**.
2. Ese catálogo se entrega al modelo de una de dos formas:
   - **(a) Inyectado** en el prompt de sistema (recortado; cabe de sobra para 42
     pantallas). Es lo mínimo para que deje de inventar hoy mismo.
   - **(b) Recuperación (RAG)**: se busca el fragmento pertinente y se le entrega
     sólo eso. Escala cuando haya manual de usuario final, a cambio de una pieza
     más y de índices que mantener.
3. El prompt gana una regla explícita: *si el módulo está en demostración, dilo*.
*Salida:* un conjunto de preguntas de funcionalidad se responde citando la
pantalla real; ninguna respuesta menciona un campo que no exista.

### Fase 2 — Renderizar el `payload` en el widget
Sin esto, las herramientas de datos no sirven de nada.
*Salida:* una respuesta con `payload` de tipo tabla se ve en el widget.

### Fase 3 — Las siete consultas contables
Una herramienta por opción de `docs/informes/CONSULTAS_RECUPERADAS_ADS.md`: saldos y
comportamiento anual, movimiento anual por cuenta, por tercero, por centro, saldos
cuenta-centro, documento específico y comparativos.
*Salida por herramienta:* el mismo JSON que la pantalla, con tres casos (uno
normal, uno vacío y uno con argumentos inválidos).

### Fase 4 — Escritura con confirmación humana
`contabilizar`, `anular`, crear o modificar lote. El handler **no ejecuta**:
devuelve el resumen y un testigo de confirmación, y la ejecución es una segunda
llamada.
*Salida:* nada se ejecuta sin confirmación explícita, y los casos de
`scripts/validate.sql` se reproducen a través del asistente.

### Fase 5 — Endurecimiento y verificación de la no-invención
Límites de argumentos y longitud, traza de auditoría (qué herramienta, con qué
argumentos, qué devolvió) y **preguntas trampa**: funcionalidades que no existen,
módulos en demostración y datos concretos. El asistente debe decir que no puede
verificarlos, no improvisar.
*Salida:* las trampas se responden con honestidad, y queda registrado.

---

## 3. Inventario del aplicativo (el techo de lo que puede afirmar)

Medido sobre `Interface_web/src/` y `backend/app.py`.

| Métrica | Valor |
|---|---|
| Pantallas en `pages/` | **42** (41 enrutadas en `App.tsx`; `BalanceComprobacion.tsx` es huérfana) |
| Conectadas a rutas del backend | **22** |
| Con rutas del backend que no existen | **0** |
| Con datos de demostración | **20** |
| Clientes de API (`api/*.ts`) | 22 archivos, 47 funciones exportadas, todas en uso |
| Rutas del backend sin ninguna pantalla | **1** de 48 (`/api/health`) |

### Conectadas de punta a punta (22)

**Matiz a nivel de control** (auditoria completa en
`docs/catalogo/MAPA_FUNCIONALIDAD.md`): «conectada» aqui es a nivel de pantalla.
Al bajar al control, varias de estas 22 tienen botones inertes o simulados:
CapturaDirecta (guardar borrador y pegar son locales), Centros, Comprobantes y
TiposDocumento (los botones de crear estan deshabilitados), Terceros (solo lee;
crear, editar, importar y cupos son locales) e Informes (varios informes figuran
como pendientes).

| Pantalla | Cliente | Ruta |
|---|---|---|
| AnualCuenta, AnualTercero, AnualCentro | `movimientoAnual*.ts` | `/api/consultas/movimiento-anual-*` (+`/detalle`) |
| Anulacion, ConsultaDocumentos | `documentos.ts` | `/api/documentos`, `/detalle`, POST `/anular` |
| CapturaDirecta | `contabilizacion.ts` | POST `/api/movimientos/contabilizar` |
| Centros | `centros.ts` | `/api/centros` |
| Comparativos | `consultasRestantes.ts` | `/api/consultas/comparativos` |
| Comprobantes | `comprobantes.ts` | `/api/comprobantes` |
| DocumentoEspecifico | `consultasRestantes.ts` | `/api/consultas/documento-especifico` |
| Importaciones | `importaciones.ts` | `/api/importaciones/leer`, `/lote` |
| Informes | `balanceComprobacion.ts`, `informesAdicionales.ts` | `/api/informes/*` |
| Lotes | `lotes.ts` | `/api/lotes*` (10 rutas) |
| MovimientoMensual | `movimientoMensual.ts` | `/api/movimiento-mensual` |
| ParametrosOperacion | `parametrosOperacion.ts` | GET/PUT `/api/parametros-operacion` |
| PlanCuentas | `cuentas.ts` | `/api/cuentas` |
| Reprocesos | `reprocesoMensual.ts` | `/api/reprocesos/mensual/simular`, `/ejecutar` |
| SaldosAnuales | `saldosAnuales.ts` | `/api/consultas/saldos-anuales` |
| SaldosCuentaCentro | `consultasRestantes.ts` | `/api/consultas/saldos-cuenta-centro/*` |
| SeleccionCompania | `companias.ts` | `/api/companias` |
| Terceros | `terceros.ts` | GET `/api/terceros`, POST vía `CrearTerceroModal` |
| TiposDocumento | `tiposDocumento.ts` | `/api/tipos-documento` |
| Shell → BotChat | `bot.ts` | `/bot-api/chat` (ia-service, puerto 8003) |

### En demostración (20) — el asistente **no** puede hablar de estas como si existieran

| Módulo | Cómo simula |
|---|---|
| Companias, ConfigIVA, ConfigRetenciones, FormatosDocumentales, Plantillas, RenglonesRenta | `localStorage` + `data/config*`, con distintivo de «Datos de demostración» |
| Bitacora, Especiales, Integraciones, Reorganizacion, UsuariosPermisos | datos fijos dentro del `.tsx`, sin `fetch` |
| Cierres, Consolidacion | estáticos, sin distintivo |
| Nomina, Reembolsos, Reclasificaciones | `data/mock`; «generan lote» sólo en memoria |
| Impuestos | `mock` + `MOCK_RETENCIONES` / `MOCK_IVA` |
| Dashboard, DocumentoOficial, BalanceComprobacion | `EMPRESA`, `MOVIMIENTOS_FEB`, `SALDOS_BALANCE` del mock |

---

## 4. Lo que falta por implementar

1. **Impuestos**: no hay endpoint ni cliente; IVA y retenciones son sólo pantalla.
2. **Nómina, Reembolsos, Reclasificaciones, Plantillas**: generan el lote en el
   frontend; falta endpoint, o reutilizar `POST /api/lotes` +
   `POST /api/lotes/{lote}/detalle`.
3. **Cierres y Consolidación**: sin cliente ni rutas.
4. **Bitácora**: el backend ya escribe trazas (`auditoria_repository`) pero no las
   publica; falta la ruta que las exponga.
5. **Usuarios y permisos, Integraciones**: sin backend; permisos y conectores
   externos existen sólo en la interfaz.
6. **Configuración** (IVA, retenciones, plantillas, renglones de renta, formatos
   documentales, compañías): persistencia únicamente en `localStorage`. Es el
   grupo más grande y el que más afecta al asistente, porque son las pantallas
   sobre las que más se pregunta.
7. **Dashboard**: podría usar rutas que ya existen (`/api/lotes`, `/api/documentos`)
   en vez del mock.
8. **`BalanceComprobacion.tsx`**: página huérfana; su versión real es `Informes.tsx`.
9. **`/api/health`**: sin cliente en la web.
10. **`DocumentoOficial`**: recibe `MOVIMIENTOS_FEB` del mock y no consulta
    `/api/documentos/detalle`.

**Sin determinar**: si `Centros.tsx` usa `data/configCentros` sólo como apoyo
jerárquico o también como datos.

---

## 5. Cómo se verifica todo esto

- **No invención**: batería de preguntas trampa (una funcionalidad que no existe,
  una que está en demostración, y un dato concreto). El asistente debe decir que
  no puede verificarlo.
- **Cada herramienta**: mismo JSON que la pantalla, con casos normal, vacío y
  argumentos inválidos.
- **El catálogo de la fase 1.5**: si una pantalla cambia de estado (de demo a
  conectada), el catálogo se regenera y el asistente cambia su respuesta sin
  tocar el prompt a mano.
