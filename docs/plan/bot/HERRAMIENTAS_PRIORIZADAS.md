# Herramientas priorizadas del asistente (Daisy)

Que funcionalidades del aplicativo merece la pena pedirle al asistente y plan
para implementar las que ya se pueden. Depende de `PLAN_BOT.md` (fases,
regla de no inventar, inventario), de `../../catalogo/MAPA_FUNCIONALIDAD.md` (estado
control por control), de `../../auditorias/AUDITORIA_FUNCIONALIDAD.md` (que esta
simulado y por que) y de `../backend/PLAN_BACKEND.md` (los 86 endpoints
que faltan).

Metodo: solo entran candidatas cuyo endpoint exista en `backend/app.py`; toda
cifra y toda ruta se cita con `archivo:linea`. No se proponen herramientas que
dependan de algo inexistente. Fecha: 2026-09-22.

Datos de partida, tomados de los documentos (no recalculados):

- 702 controles: 245 conectados, 442 locales o simulados, 15 inertes
  (`MAPA_FUNCIONALIDAD.md:123-130`).
- 48 rutas en `backend/app.py`; una sola sin pantalla, `/api/health`
  (`PLAN_BOT.md:117`).
- 86 rutas por construir; 17 filas reutilizan una ruta existente; 13 son solo
  interfaz (`PLAN_BACKEND.md:417-444`).
- `TOOLS = []` y `FUNCTION_MAP = {}` (`ia-service/app/tools.py:29-32`); el loop
  de function calling ya existe (`ia-service/app/deepseek.py:129-176`).
- El widget pinta unicamente `reply`: en `Interface_web/src/components/BotChat.tsx`
  no hay ninguna referencia a `payload`, y la respuesta se agrega al hilo con
  `respuesta.reply` (`BotChat.tsx:108`).

---

## 0. Resumen

| Concepto | Valor |
|---|---:|
| Candidatas evaluadas (con endpoint real) | 45 |
| Implementables ya | 29 |
| De las anteriores, solo texto (antes de la fase 2) | 8 |
| De las anteriores, necesitan `payload` de tabla (fase 2) | 21 |
| Con endpoint de escritura ya existente, sujetas al testigo de confirmacion de la fase 4 | 12 |
| Descartadas por diseno | 4 |
| Candidatas que dependen de los 86 endpoints por construir | 0 |

Las cinco primeras por orden de entrega: `consultar_periodo_operacion`,
`consultar_parametros_operacion`, `listar_companias`, `buscar_tercero`,
`consultar_comprobantes`.

---

## 1. Criterios de evaluacion

Peso total 10. El criterio (f) es el que mas pesa porque es el objetivo
declarado del plan: `PLAN_BOT.md:11-28` (no inventar datos ni
funcionalidad) y `PLAN_BOT.md:97-102` (fase 5).

| Id | Criterio | Pregunta que responde | Peso |
|---|---|---|---:|
| f | Convierte una respuesta hoy inventada en una verificada | el asistente deja de improvisar una cifra que hoy no puede comprobar | **3** |
| a | Pregunta real de contador | un contador, auxiliar o auditor haria esta pregunta en su jornada | 2 |
| b | Dato real | el endpoint lee una tabla real y no un modulo simulado | 2 |
| d | Argumentos pocos y no ambiguos | el modelo puede llenar el esquema sin adivinar valores | 1 |
| c | Lectura, o escritura con confirmacion | la herramienta no ejecuta nada irreversible por si sola | 1 |
| e | Cabe en el widget | la respuesta se puede leer sin desplazarse por cientos de filas | 1 |

Dos condiciones son excluyentes y no puntuan:

- **Endpoint real (b)**: si el modulo esta simulado, la candidata no entra en la
  tabla del punto 2 aunque la pregunta sea excelente. Los modulos simulados
  quedan en el punto 4.
- **Sin dependencias nuevas**: si la herramienta necesita una de las 86 rutas por
  construir, o una tabla nueva, no se propone todavia.

Consecuencia practica de (f), que es la razon de existir del asistente: hoy el
prompt ya prohibe inventar datos y manda a la pantalla (`deepseek.py:26`), de
modo que ante "cual es el saldo de la cuenta 4135" el asistente no responde la
cifra pero tampoco la puede verificar. Cada herramienta de la tabla sustituye un
"no lo puedo verificar" por el dato real, o por un error descriptivo del backend
(`backend/app.py:255-256` lo devuelve como 422 con texto en castellano).

Reglas de puntuacion:

- 9 a 10: primera ola.
- 7 a 8: segunda ola.
- 6 o menos: solo tiene sentido como tabla, y despues de la fase 2.

Ninguna candidata de este documento queda por debajo de 6: las que no llegaban
se descartaron antes de la tabla por no cumplir (b) o por depender de los 86
endpoints.

### 1.1 Decisiones de diseno que valen para todas las herramientas

Se aplican a todo el punto 3 y son la razon por la que los esquemas tienen pocos
argumentos (criterio d).

1. **`cia` no es argumento.** La compania activa viaja en el contexto de sesion
   (`BotChat.tsx:100-105`, contrato en `api/bot.ts:18-24`) y el handler la toma de
   `ctx["context"]["compania"]` (`deepseek.py:41-60` la pinta en el prompt). Si no
   viene, la herramienta devuelve `{"ok": false, "mensaje": "..."}` pidiendo la
   compania en vez de elegir una. Nunca se asume la 001.
2. **`anio` y `mes` no se parsean del texto del contexto.** `periodo` es una
   cadena de presentacion (`BotChat.tsx:103`); su formato no es contrato. Si el
   usuario no da periodo, el handler lo resuelve con `GET /api/periodo-operacion`
   (`app.py:401`) y **declara en la salida que periodo uso**.
3. **Dos salidas por herramienta.** El dict que vuelve al modelo lleva el resumen
   (conteos, totales, primeras filas y `hasMore`); la tabla completa se guarda en
   `ctx["payload"]` (`tools.py:16-17`, `deepseek.py:138`). Asi el modelo no gasta
   contexto con 200 filas que el humano vera en la tabla.
4. **Sin argumento de paginacion.** El handler fija `page=1` y el `pageSize`
   maximo que admite cada ruta; si hay mas, devuelve `hasMore: true` y el modelo
   propone acotar el filtro. Un `pagina` expuesto al modelo solo invita a
   inventarlo o a pedir paginas vacias.
5. **Los errores del backend no se reescriben.** El handler traduce el 422/404/503
   a `{"ok": false, "mensaje": <detail>}` y el modelo lo comunica tal cual. Un
   informe que el backend rechaza
   (`backend/informes_adicionales_repository.py:433-441`) no se convierte en un
   exito narrado.
6. **Forma del `payload`.** Se adopta la que el frontend ya sabe pintar: la de
   `InformeAdicional` (`Interface_web/src/api/informesAdicionales.ts:22-34`), que
   es exactamente la que consume `CeldaValor`
   (`Interface_web/src/pages/Informes.tsx:180-188`). Ver punto 5.

---

## 2. Candidatas evaluadas

Todas tienen endpoint en `backend/app.py`. "Dato" indica la tabla real de origen
que el endpoint lee. La columna *ruta* cita `archivo:linea` de la definicion.
"Imp. ya" es *se puede implementar ya*.

| # | Funcionalidad | Endpoint (archivo:linea) | Dato | Valor | Riesgo | Imp. ya | Fase |
|---|---|---|---|---|---|---|---|
| C01 | Consultar periodo de operacion | `GET /api/periodo-operacion` (`app.py:401`) | real: CONCTR | Alto | Bajo (lectura) | Si: ruta, modelo de item y 0 argumentos utiles | 1 |
| C02 | Consultar parametros de operacion | `GET /api/parametros-operacion` (`app.py:413`) | real: CONCTR | Alto | Bajo | Si; el `PUT` de `app.py:425` queda en fase 4 | 1 |
| C03 | Listar companias | `GET /api/companias` (`app.py:304`) | real: CONEMP o `companias` | Medio | Bajo; con `ADS_DEV_FALLBACK` puede responder `DEMO` (`app.py:314-319`) y hay que decirlo | Si | 1 |
| C04 | Buscar tercero (NIT, nombre, ciudad) | `GET /api/terceros` (`app.py:324`) | real: FADCLI | Alto | Bajo; el maestro es global (`app.py:336`) | Si, acotando `pageSize` en el handler | 1 |
| C05 | Consultar plan de cuentas | `GET /api/cuentas` (`app.py:1050`) | real: CONMAE | Alto | Medio: el endpoint no filtra, solo `cia`; sin tabla se vuelca todo | Si, con `payload` y truncado | 3 |
| C06 | Consultar comprobantes de la compania | `GET /api/comprobantes` (`app.py:384`) | real: CONTICOM | Alto | Bajo; catalogo por compania | Si | 1 |
| C07 | Consultar tipos de documento | `GET /api/tipos-documento` (`app.py:369`) | real: VISDOCUM | Medio | Bajo; global | Si | 1 |
| C08 | Consultar centros de costo | `GET /api/centros` (`app.py:352`) | real: CONCECOS | Medio | Bajo | Si | 1 |
| C09 | Crear tercero | `POST /api/terceros` (`app.py:339`) | real: FADCLI | Medio | Alto: escritura y el backend valida menos que el modal (`AUDITORIA_FUNCIONALIDAD.md:640-674`) | No hoy: falta el testigo de confirmacion de la fase 4 | 4 |
| C10 | Movimiento mensual | `GET /api/movimiento-mensual` (`app.py:438`) | real: MOV01 | Alto | Medio: sin filtros devuelve 200 filas | Si, con `payload` | 3 |
| C11 | Saldos y comportamiento anual | `GET /api/consultas/saldos-anuales` (`app.py:472`) | real: CONMAE, CONTERCE | Alto | Medio: idem | Si, con `payload` | 3 |
| C12 | Movimiento anual por cuenta | `GET /api/consultas/movimiento-anual-cuenta` (`app.py:487`) | real: CONMAE, CONTERCE, MOV01 | Alto | Bajo: exige `cuenta` | Si, con `payload` | 3 |
| C13 | Detalle mensual de una cuenta | `.../movimiento-anual-cuenta/detalle` (`app.py:501`) | real: MOV01 | Alto | Medio | Si, con `payload` | 3 |
| C14 | Movimiento anual por tercero | `.../movimiento-anual-tercero` (`app.py:515`) | real: FADCLI, CONTERCE, MOV01 | Alto | Bajo: exige `tercero` | Si, con `payload` | 3 |
| C15 | Detalle mensual de un tercero | `.../movimiento-anual-tercero/detalle` (`app.py:529`) | real: MOV01 | Alto | Medio | Si, con `payload` | 3 |
| C16 | Movimiento anual por centro | `.../movimiento-anual-centro` (`app.py:543`) | real: COCENTRO, MOV01 | Medio | Bajo: exige `centro` | Si, con `payload` | 3 |
| C17 | Detalle mensual de un centro | `.../movimiento-anual-centro/detalle` (`app.py:557`) | real: MOV01 | Medio | Medio | Si, con `payload` | 3 |
| C18 | Saldos cuenta-centro (lista de cuentas) | `.../saldos-cuenta-centro/cuentas` (`app.py:571`) | real: CONMAE, COCENTRO | Alto | Medio | Si, con `payload` | 3 |
| C19 | Centros de una cuenta | `.../saldos-cuenta-centro/centros` (`app.py:584`) | real: COCENTRO, CONCECOS | Alto | Bajo | Si, con `payload` | 3 |
| C20 | Partidas de cuenta y centro | `.../saldos-cuenta-centro/detalle` (`app.py:595`) | real: MOV01 | Medio | Medio | Si, con `payload` | 3 |
| C21 | Documento especifico (propio o afectado) | `GET /api/consultas/documento-especifico` (`app.py:608`) | real: VISDOCUM, MOV01 | Alto | Bajo: exige tipo y numero | Si, con `payload` | 3 |
| C22 | Comparativos (companias, centros, meses) | `GET /api/consultas/comparativos` (`app.py:622`) | real: CONMAE, CONTERCE, COCENTRO | Medio | Medio: `ciaB` y `mesB` opcionales y faciles de confundir | Si, con `payload` | 3 |
| C23 | Cabeceras de documentos | `GET /api/documentos` (`app.py:644`) | real: CONDOCUM | Alto | Medio; `pageSize` tope 100 (`app.py:648`) | Si, con `payload` | 3 |
| C24 | Partidas de un documento | `GET /api/documentos/detalle` (`app.py:676`) | real: MOV01 | Alto | Bajo: 4 argumentos exigidos por el endpoint | Si, pero los 4 argumentos hay que tomarlos de C23 | 3 |
| C25 | Listar lotes de la compania | `GET /api/lotes` (`app.py:726`) | real: CONMOVI | Alto | Bajo; el endpoint no filtra por estado | Si, con `payload` | 3 |
| C26 | Partidas de un lote | `GET /api/lotes/detalle` (`app.py:770`) | real: CONLOTES | Alto | Bajo | Si, con `payload` | 3 |
| C27 | Verificar un lote | `POST /api/lotes/{lote}/verificar` (`app.py:824`) | real: CONLOTES, MOV01 | Alto | Medio: con errores, la lista puede crecer | Si: resumen en texto; con errores, `payload` | 3 |
| C28 | Crear lote | `POST /api/lotes` (`app.py:785`) | real: CONMOVI | Medio | Alto: escritura | No hoy: fase 4 (testigo) | 4 |
| C29 | Modificar cabecera de lote | `PUT /api/lotes/{lote}` (`app.py:798`) | real: CONMOVI | Bajo | Alto: escritura | No hoy: fase 4 | 4 |
| C30 | Eliminar lote | `DELETE /api/lotes/{lote}` (`app.py:811`) | real: CONMOVI, CONLOTES | Bajo | Muy alto: destructivo | No hoy: fase 4, exige `motivo` | 4 |
| C31 | Agregar partida a un lote | `POST /api/lotes/{lote}/detalle` (`app.py:850`) | real: CONLOTES | Medio | Alto: escritura | No hoy: fase 4 | 4 |
| C32 | Modificar partida de un lote | `PUT /api/lotes/{lote}/detalle/{line_id}` (`app.py:867`) | real: CONLOTES | Bajo | Alto: escritura | No hoy: fase 4 | 4 |
| C33 | Eliminar partida de un lote | `DELETE /api/lotes/{lote}/detalle/{line_id}` (`app.py:881`) | real: CONLOTES | Bajo | Muy alto: destructivo | No hoy: fase 4 | 4 |
| C34 | Contabilizar un lote verificado | `POST /api/lotes/{lote}/actualizar` (`app.py:836`) | real: MOV01, CONMAE, CONTERCE | Alto | Muy alto: irreversible sin anulacion | No hoy: fase 4 | 4 |
| C35 | Contabilizar captura directa | `POST /api/movimientos/contabilizar` (`app.py:894`) | real: MOV01 | Alto | Muy alto: irreversiblesin anulacion | No hoy: fase 4 | 4 |
| C36 | Anular documento | `POST /api/documentos/anular` (`app.py:703`) | real: MOV01, CONDOCUM | Medio | Muy alto: destructivo, con `dryRun` (`app.py:706`) | No hoy: fase 4 | 4 |
| C37 | Simular reproceso mensual | `POST /api/reprocesos/mensual/simular` (`app.py:911`) | real: MOV01 vs CONMAE/CONTERCE | Alto | Bajo: no escribe (`app.py:920`) | Si, con `payload` | 3 |
| C38 | Ejecutar reproceso mensual | `POST /api/reprocesos/mensual/ejecutar` (`app.py:923`) | real: CONMAE, CONTERCE | Medio | Muy alto: reemplaza acumulados | No hoy: fase 4, exige `motivo` (`app.py:161-173`) | 4 |
| C39 | Balance de comprobacion | `GET /api/informes/balance-comprobacion` (`app.py:944`) | real: CONMAE | Alto | Medio: el informe completo supera el widget | Si, con `payload` | 3 |
| C40 | Informes adicionales (35 opciones) | `GET /api/informes/adicionales/{report_id}` (`app.py:993`) | real: CONMAE, MOV01, CONTERCE, COCENTRO, FADCLI | Alto | Medio: 6 ids se rechazan (`informes_adicionales_repository.py:433-441`) y la ruta es solo Advantage (ver 3.2) | Si, con `payload` y enum restringido | 3 |
| C41 | Exportar balance o informe adicional | `app.py:962` y `app.py:1028` | real | Bajo | Medio: devuelven binario | No: el handler debe devolver un dict serializable (`tools.py:18`) y el chat no puede adjuntar archivos | - |
| C42 | Leer archivo de importacion | `POST /api/importaciones/leer` (`app.py:740`) | real | Bajo | Medio: exige `UploadFile` | No: la conversacion solo lleva texto (`main.py:41-48`) | - |
| C43 | Crear lote desde importacion | `POST /api/importaciones/lote` (`app.py:756`) | real | Bajo | Alto | No: depende de C42 | - |
| C44 | Modificar/crear cuenta maestra | `app.py:1062` y `app.py:1079` | real: CONMAE | Bajo | Alto: escritura de maestro | No hoy: fase 4; ningun control de la interfaz lo pide desde el chat | 4 |
| C45 | Estado del servicio (`/api/health`) | `GET /api/health` (`app.py:272`) | real | Nulo | Bajo | No: no responde a ninguna pregunta contable (`PLAN_BOT.md:117`) | - |

De las 45: 29 implementables ya (C01-C08, C10-C27, C37, C39, C40), 12 de
escritura que necesitan el testigo de confirmacion de la fase 4 (C09, C28-C36,
C38, C44) y 4 descartadas por diseno (C41, que agrupa los dos exportadores,
C42, C43 y C45).

---

## 3. Plan de las implementables ya

Orden pensado para que ninguna herramienta dependa de otra que no exista aun.
Las 8 primeras se pueden entregar **antes de la fase 2**, porque el modelo puede
resumir su resultado en `reply` sin tabla. Las 21 siguientes necesitan que el
widget pinte el `payload`, que es la fase 2 (`PLAN_BOT.md:79-81`).

### 3.1 Ola 1: solo texto, antes de la fase 2 (8 herramientas)

> **Estado 2026-09-22: las 8 quedaron implementadas** (punto 5, pasos 1 a 4, mas
> T-08). En `ia-service`: handlers en `app/tools.py` con `TOOLS` y `FUNCTION_MAP`
> coherentes; transporte por HTTP en `app/backend_client.py` con
> `IA_SERVICE_BACKEND_URL` (por defecto `http://localhost:8001`); forma acordada
> del `payload` declarada en `app/payload.py` (punto 5, paso 2). Verificacion:
> `ia-service/scripts/verificar_herramientas.py` (coherencia de `TOOLS` y
> `FUNCTION_MAP`, y cada handler con argumentos validos e invalidos).
>
> **Pendiente:** la fase 2 (nadie pinta el `payload` todavia: solo viaja en la
> respuesta de `/chat`) y la linea base de preguntas trampa del paso 4.
>
> **Notas de implementacion, sin cambiar el plan:** (1) las descripciones de T-07
> y T-08 nombraban `consultar_saldos_cuenta_centro` y `consultar_lotes`, que no
> existen en esta entrega, y se sustituyeron por la pantalla real para no anunciar
> funciones inexistentes (regla 2 de `PLAN_BOT.md`); (2) el punto 3.4 ubica
> T-08 en el paso 6, despues de la fase 2, mientras que este apartado la lista en
> la ola 1: se implemento por lo que dice este apartado, con el `payload` de tabla
> solo cuando `errores` trae mas de 5 entradas, de modo que el caso normal viaja en
> `reply`. (3) T-05, T-06 y T-07 devuelven el catalogo completo, como fija este
> apartado: el `payload` no esta truncado.

Responden con un item de forma fija o con un catalogo corto. El handler acota y
el modelo resume; el `payload` se llena igual, de modo que el dia que exista el
render aparece sin tocar la herramienta.

**T-01 `consultar_periodo_operacion`** - C01 - implementada (fase 0)
- Endpoint: `GET /api/periodo-operacion` (`app.py:401`).
- Descripcion para el modelo: "Devuelve el periodo contable habilitado de la
compania activa: anio, meses habilitados, periodo sugerido y fecha sugerida.
Usala siempre que el usuario pregunte en que periodo esta o cuando necesites
ubicar una consulta en el tiempo. No la uses para saldos ni movimientos."
- Parametros: `{"type":"object","properties":{},"additionalProperties":false}`.
- Validaciones: ninguna; la compania sale del contexto de sesion.
- Salida: `{"ok": true, "periodo": {...}, "origen": "CONCTR"}`.
- Viaja en `reply`.

**T-02 `consultar_parametros_operacion`** - C02 - implementada (fase 0)
- Endpoint: `GET /api/parametros-operacion` (`app.py:413`).
- Descripcion para el modelo: "Lee los parametros de operacion vigentes de la
compania activa (controles de captura, periodos habilitados y demas banderas de
CONCTR). Usala para responder si la compania exige algo al contabilizar o si un
periodo esta habilitado. No la uses para modificar nada: la modificacion no esta
disponible."
- Parametros: objeto vacio, con la misma validacion que T-01.
- Salida: `{"ok": true, "parametros": {...}, "origen": "CONCTR"}`.
- Viaja en `reply`.

**T-03 `listar_companias`** - C03 - implementada (fase 0)
- Endpoint: `GET /api/companias` (`app.py:304`).
- Descripcion para el modelo: "Lista las companias que existen en el motor
activo. Usala cuando pregunten que companias hay, con cual estan trabajando o si
existe un codigo de compania. Si el origen que devuelve es DEMO, dilo: son datos
de respaldo, no del sistema real."
- Parametros: objeto vacio.
- Validaciones: ninguna; el handler corta a 20 filas y reporta el total.
- Salida: `{"ok": true, "items":[...], "count": n, "origen": "CONEMP"|"companias"|"DEMO"}`.
- Viaja en `reply`.

**T-04 `buscar_tercero`** - C04 - implementada (fase 0)
- Endpoint: `GET /api/terceros` (`app.py:324`).
- Descripcion para el modelo: "Busca terceros por codigo, nombre o ciudad y
devuelve hasta 10 coincidencias con su estado. Usala cuando el usuario nombre un
tercero sin dar el NIT o pregunte si existe. No la uses para saldos ni para
crear terceros. Si no hay coincidencias, dilo; no supongas que el tercero existe
con otro NIT."
- Parametros:

```json
{"type":"object","additionalProperties":false,
 "properties":{
   "buscar":{"type":"string","minLength":1,"maxLength":60,
             "description":"Codigo, nombre o ciudad. Obligatorio."},
   "estado":{"type":"string","enum":["todos","activo","bloqueado"],"default":"todos"}},
 "required":["buscar"]}
```

- Validaciones: `pageSize` fijo en 10 (el endpoint admite hasta 200, `app.py:327`).
- Salida: `{"ok": true, "items":[...], "count": n, "hayMas": bool, "origen": "FADCLI", "compartidoEntreCompanias": true}`.
- Viaja en `reply`. Es la herramienta que mas evita invencion de NIT.

**T-05 `consultar_comprobantes`** - C06 - implementada (fase 0)
- Endpoint: `GET /api/comprobantes` (`app.py:384`).
- Descripcion para el modelo: "Lista los comprobantes contables definidos para la
compania activa. Usala cuando pregunten que comprobante usar para un tipo de
operacion o cual es el codigo de un comprobante. No confundas comprobante con
tipo de documento."
- Parametros: objeto vacio.
- Validaciones: `cia` del contexto; si falta, `ok: false`.
- Salida: `{"ok": true, "items":[...], "count": n, "origen": "CONTICOM"}`.
- Viaja en `reply`.

**T-06 `consultar_tipos_documento`** - C07 - implementada (fase 0)
- Endpoint: `GET /api/tipos-documento` (`app.py:369`).
- Descripcion para el modelo: "Lista los tipos de documento del catalogo global
(se comparten entre companias). Usala cuando pregunten por el codigo de un tipo
de documento, por ejemplo para consultar un documento especifico."
- Parametros: objeto vacio.
- Salida: `{"ok": true, "items":[...], "count": n, "origen": "VISDOCUM"}`.
- Viaja en `reply`.

**T-07 `consultar_centros`** - C08 - implementada (fase 0)
- Endpoint: `GET /api/centros` (`app.py:352`).
- Descripcion para el modelo: "Lista los centros de costo de la compania activa
con su nombre. Usala cuando pregunten si existe un centro, como se llama o cual
usar. No la uses para saldos por centro: para eso esta `consultar_saldos_cuenta_centro`."
- Parametros: objeto vacio.
- Salida: `{"ok": true, "items":[...], "count": n, "origen": "CONCECOS"}`.
- Viaja en `reply`.

**T-08 `verificar_lote`** - C27 - implementada (fase 0)
- Endpoint: `POST /api/lotes/{lote}/verificar` (`app.py:824`).
- Descripcion para el modelo: "Verifica la consistencia de un lote (partidas
descuadradas, documentos duplicados, totales). Es de lectura: no contabiliza
nada. Usala cuando pregunten si un lote esta cuadrado o que le falta antes de
contabilizar. Si no sabes el codigo del lote, primero usa `consultar_lotes`."
- Parametros:

```json
{"type":"object","additionalProperties":false,
 "properties":{"lote":{"type":"string","minLength":1,"maxLength":10,
   "description":"Codigo exacto del lote, como aparece en CONMOVI."}},
 "required":["lote"]}
```

- Validaciones: `pattern` de 1 a 10 caracteres (`app.py:773`); no admite comodines.
- Salida: `{"ok": true, "valido": bool, "estado": "...", "items": n, "documentos": n,
  "documentosDuplicados": n, "debito": x, "credito": y, "diferencia": z,
  "errores": [...], "origen": "CONLOTES"}`; el `payload` de tabla solo se llena
  cuando `errores` trae mas de 5 entradas.
- Viaja en `reply` en el caso normal. Forma del resultado tomada de
  `api/lotes.ts:82-100`.

### 3.2 Ola 2: requieren el `payload` de tabla (21 herramientas)

> **Estado 2026-09-22: ninguna implementada.** Dependen de la fase 2 (render del
> `payload` en el widget), que no forma parte de esta entrega.

Misma forma de trabajo; cambia que el resultado es una tabla y el modelo solo
recibe el resumen.

**T-09 `consultar_movimiento_mensual`** - C10
- Endpoint: `GET /api/movimiento-mensual` (`app.py:438`).
- Descripcion para el modelo: "Devuelve las partidas de MOV01 de un mes con los
filtros indicados. Usala para 'movimientos de febrero', 'que se registro en la
cuenta 4135 este mes' o el detalle de un documento dentro de un mes. Exige
compania y periodo (resueltos del contexto o de CONCTR); si el resultado es muy
grande, pide un filtro adicional en lugar de listar todo."
- Parametros:

```json
{"type":"object","additionalProperties":false,
 "properties":{
  "anio":{"type":"integer","minimum":1900,"maximum":2100},
  "mes":{"type":"integer","minimum":1,"maximum":12},
  "cuenta":{"type":"string","maxLength":12,"pattern":"^[0-9]*$"},
  "tercero":{"type":"string","maxLength":15,"pattern":"^[0-9]*$"},
  "comprobante":{"type":"string","maxLength":6},
  "centro":{"type":"string","maxLength":7},
  "documento":{"type":"string","maxLength":12}}}
```

- Validaciones: `cuenta` se envia como `cuentaDesde` y `cuentaHasta` con el mismo
  valor; `pageSize` fijo en 200 (tope del endpoint, `app.py:444`).
- Salida: resumen con `count`, `pageDebit`, `pageCredit`, `hasMore` y las 10
  primeras filas; `payload` con la tabla completa y `origen: "MOV01"`.
- Viaja en `payload`.

**T-10 `consultar_saldos_anuales`** - C11
- Endpoint: `GET /api/consultas/saldos-anuales` (`app.py:472`).
- Descripcion para el modelo: "Saldos y comportamiento anual por cuenta y por
tercero, con el clasificado fiscal (general, todos, retenciones o IVA). Usala
para 'como se comporto la cuenta X en el ano' o para preguntas de IVA y
retenciones por cuenta. No la uses para un mes puntual: para eso esta
`consultar_movimiento_mensual`."
- Parametros: `anio` (1900-2100), `mes` (1-18, `app.py:475`), `filtro`
  (`generales|todos|retenciones|iva`), `cuenta` (max 30, busqueda por codigo o
  nombre, `app.py:477`).
- Validaciones: `pageSize` fijo en 200.
- Salida: resumen con `count`, `hasMore` y `totalesPagina`
  (`api/saldosAnuales.ts:25-35`); `payload` con la tabla.
- Viaja en `payload`.

**T-11 `consultar_movimiento_anual_cuenta`** - C12
- Endpoint: `GET /api/consultas/movimiento-anual-cuenta` (`app.py:487`).
- Descripcion para el modelo: "Saldos y los doce meses de una cuenta, con rango
  opcional de NIT. Es la herramienta de 'cuanto tiene la cuenta X' y 'como se
  movio mes a mes'. Si el usuario da el nombre de la cuenta en vez del codigo,
  resuelvelo con `consultar_plan_cuentas` antes."
- Parametros: `cuenta` obligatorio (`^[0-9]+$`, 1-12, `app.py:490`), `anio`,
  `nitDesde` y `nitHasta` opcionales (max 15).
- Salida: resumen con `saldo`, `saldoFinal` y el mes pedido; `payload` con la
  serie mensual.
- Viaja en `payload`.

**T-12 `consultar_detalle_mensual_cuenta`** - C13
- Endpoint: `.../movimiento-anual-cuenta/detalle` (`app.py:501`).
- Descripcion para el modelo: "Partidas de una cuenta en un mes concreto
  (mismo resultado que la pantalla de movimiento anual, pestana del mes). Usala
  cuando el usuario quiera el detalle, no el resumen anual."
- Parametros: `cuenta` (1-12), `mes` (1-12), `anio`, `nitDesde`, `nitHasta`.
- Validaciones: `pageSize` fijo en 200.
- Viaja en `payload`.

**T-13 `consultar_movimiento_anual_tercero`** - C14
- Endpoint: `GET /api/consultas/movimiento-anual-tercero` (`app.py:515`).
- Descripcion para el modelo: "Saldos y meses del ano para un tercero, con rango
  opcional de cuentas. Usala para 'cuanto nos debe el tercero X' o 'movimiento
  del NIT X'. El tercero se identifica por NIT numerico; si solo tienes el
  nombre, buscalo antes con `buscar_tercero`."
- Parametros: `tercero` obligatorio (`^[0-9]+$`, 1-15, `app.py:518`), `anio`,
  `cuentaDesde`, `cuentaHasta`.
- Viaja en `payload`.

**T-14 `consultar_detalle_mensual_tercero`** - C15
- Endpoint: `.../movimiento-anual-tercero/detalle` (`app.py:529`).
- Descripcion para el modelo: "Partidas de un tercero en un mes concreto, con
  rango opcional de cuentas."
- Parametros: `tercero` (1-15), `mes` (1-12), `anio`, `cuentaDesde`, `cuentaHasta`.
- Viaja en `payload`.

**T-15 `consultar_movimiento_anual_centro`** - C16
- Endpoint: `GET /api/consultas/movimiento-anual-centro` (`app.py:543`).
- Descripcion para el modelo: "Saldos y meses del ano para un centro de costo
  (CONSUL_5). Usala para 'cuanto consumio el centro X'. El codigo debe existir:
  si dudas, usa antes `consultar_centros`."
- Parametros: `centro` obligatorio (1-7, `app.py:546`), `anio`, `cuentaDesde`,
  `cuentaHasta`.
- Viaja en `payload`.

**T-16 `consultar_detalle_mensual_centro`** - C17
- Endpoint: `.../movimiento-anual-centro/detalle` (`app.py:557`).
- Descripcion para el modelo: "Partidas de un centro de costo en un mes
  concreto."
- Parametros: `centro` (1-7), `mes` (1-12), `anio`, `cuentaDesde`, `cuentaHasta`.
- Viaja en `payload`.

**T-17 `consultar_saldos_cuenta_centro`** - C18
- Endpoint: `.../saldos-cuenta-centro/cuentas` (`app.py:571`).
- Descripcion para el modelo: "Lista de cuentas con saldo por centro de costo,
  con busqueda por codigo o nombre. Primer paso de la consulta CONSUL_7; despues
  usa `consultar_centros_de_cuenta` para una cuenta concreta."
- Parametros: `anio`, `mes` (1-18, `app.py:574`), `buscar` (max 60).
- Viaja en `payload`.

**T-18 `consultar_centros_de_cuenta`** - C19
- Endpoint: `.../saldos-cuenta-centro/centros` (`app.py:584`).
- Descripcion para el modelo: "Centros de costo con saldo para una cuenta
  concreta. Usala cuando ya se sabe la cuenta y se quiere ver el reparto entre
  centros."
- Parametros: `cuenta` obligatorio (`^[0-9]{1,12}$`, `app.py:587`), `anio`, `mes`.
- Viaja en `payload`.

**T-19 `consultar_partidas_cuenta_centro`** - C20
- Endpoint: `.../saldos-cuenta-centro/detalle` (`app.py:595`).
- Descripcion para el modelo: "Ultimo paso de CONSUL_7: las partidas de una
  cuenta en un centro de costo. Usala solo cuando el usuario ya fijo cuenta y
  centro."
- Parametros: `cuenta` (`^[0-9]{1,12}$`), `centro` (max 7), `anio`, `mes` (1-18).
- Viaja en `payload`.

**T-20 `consultar_documento_especifico`** - C21
- Endpoint: `GET /api/consultas/documento-especifico` (`app.py:608`).
- Descripcion para el modelo: "Localiza un documento por su tipo y numero, sea
  propio o afectado, y devuelve sus partidas y el cuadre. Usala para 'revisa el
  documento DV-123' o 'que afecto al documento X'. Tipo y numero son
  obligatorios; no los inventes: si faltan, pidelos."
- Parametros:

```json
{"type":"object","additionalProperties":false,
 "properties":{
  "tipoDocumento":{"type":"string","minLength":1,"maxLength":2},
  "documento":{"type":"string","minLength":1,"maxLength":12},
  "buscarPor":{"type":"string","enum":["propio","afectado"],"default":"propio"},
  "anio":{"type":"integer","minimum":1900,"maximum":2100},
  "mes":{"type":"integer","minimum":1,"maximum":18}},
 "required":["tipoDocumento","documento"]}
```

- Salida: `items` de MOV01 mas `debito`, `credito`, `diferencia` y `cabecera`
  (`api/consultasRestantes.ts:24`).
- Viaja en `payload`.

**T-21 `consultar_comparativos`** - C22
- Endpoint: `GET /api/consultas/comparativos` (`app.py:622`).
- Descripcion para el modelo: "Compara companias, centros o meses en modo saldo o
  movimiento, con rangos de cuenta, NIT y centro. Usala para 'compara febrero y
  marzo' o 'compara la compania 027 con la 031'. Si comparas companias, `ciaB` es
  obligatorio en la practica; no lo supongas."
- Parametros: `tipo` (`companias|centros|meses`), `modo` (`saldo|movimiento`),
  `anio`, `mesA` (1-12), `mesB` (0-12, `app.py:626`), `ciaB` (max 3),
  `cuentaDesde`, `cuentaHasta`, `nitDesde`, `nitHasta`, `centroDesde`,
  `centroHasta`, `buscar`.
- Validaciones: `pageSize` fijo en 100 (tope, `app.py:635`); las claves del
  comparativo se leen de la respuesta (`api/consultasRestantes.ts:30-37`).
- Viaja en `payload`.

**T-22 `consultar_documentos`** - C23
- Endpoint: `GET /api/documentos` (`app.py:644`).
- Descripcion para el modelo: "Cabeceras de documentos contabilizados (CONDOCUM)
  con filtros de periodo, comprobante, tipo, NIT, fechas y numero. Es el punto de
  partida para anular o para ver un documento; para el detalle usa
  `consultar_partidas_documento` con los cuatro datos de la cabecera."
- Parametros: `periodo` (max 7), `comprobante` (max 2), `tipoDocumento` (max 2),
  `nit` (max 15), `fechaDesde` y `fechaHasta` (max 10), `documento` (max 12).
- Validaciones: `pageSize` fijo en 100 (`app.py:648`); las fechas se envian tal
  como las da el usuario y el backend las valida.
- Viaja en `payload`.

**T-23 `consultar_partidas_documento`** - C24
- Endpoint: `GET /api/documentos/detalle` (`app.py:676`).
- Descripcion para el modelo: "Partidas (MOV01) de un documento ya identificado
  por compania, numero, comprobante, tipo y fecha. Los cuatro argumentos son
  obligatorios y deben venir de `consultar_documentos` o del usuario; no los
  completes por parecido."
- Parametros: `documento` (1-12), `comprobante` (1-6), `tipoDocumento` (1-2),
  `fecha` (`AAAA-MM-DD`, exactamente 10 caracteres, `app.py:682`).
- Viaja en `payload`.

**T-24 `consultar_lotes`** - C25
- Endpoint: `GET /api/lotes` (`app.py:726`).
- Descripcion para el modelo: "Lista los lotes de la compania activa con estado,
  usuarios, fecha y totales. Usala para 'que lotes hay pendientes' o para ubicar
  el codigo de un lote antes de verificar o ver su detalle. El endpoint no filtra
  por estado: si el usuario pide solo los pendientes, filtra con los datos que
  recibiste y di cuantos son."
- Parametros: objeto vacio. `pageSize` fijo en 200.
- Salida: resumen con `count` y `hasMore`; `payload` con la tabla
  (`api/lotes.ts:40-47`).
- Viaja en `payload`.

**T-25 `consultar_partidas_lote`** - C26
- Endpoint: `GET /api/lotes/detalle` (`app.py:770`).
- Descripcion para el modelo: "Partidas de un lote (CONLOTES) con los totales de
  la pagina, para revisar antes de verificar o contabilizar. No contabiliza."
- Parametros: `lote` (1-10, obligatorio).
- Validaciones: `pageSize` fijo en 500 (tope de la ruta, `app.py:775`).
- Viaja en `payload`.

**T-26 `consultar_plan_cuentas`** - C05
- Endpoint: `GET /api/cuentas` (`app.py:1050`).
- Descripcion para el modelo: "Catalogo de cuentas maestras de la compania con
  nombre, saldos y atributos de afectabilidad. Usala para resolver un nombre de
  cuenta a su codigo, o para explicar los atributos de una cuenta. El endpoint no
  admite filtros: la respuesta se trunca y hay que decirlo. No la uses para
  saldos de un periodo: para eso estan las consultas de movimiento."
- Parametros: objeto vacio.
- Validaciones: el handler corta a 50 filas, informa `count` total y
  `truncado: true`; si el usuario busca una cuenta concreta, el handler filtra el
  texto ya recibido y **dice que el filtro se hizo sobre las 50 primeras**.
- Viaja en `payload`.

**T-27 `generar_balance_comprobacion`** - C39
- Endpoint: `GET /api/informes/balance-comprobacion` (`app.py:944`).
- Descripcion para el modelo: "Balance de comprobacion acumulado de la compania
  entre dos meses, con nivel de detalle y opcion de incluir cuentas en cero.
  Devuelve items y totales cuadrados. Usala para 'el balance de febrero' o
  'balance acumulado del ano'. La exportacion a archivo no esta disponible en el
  chat."
- Parametros:

```json
{"type":"object","additionalProperties":false,
 "properties":{
  "anio":{"type":"integer","minimum":1900,"maximum":2100},
  "mesDesde":{"type":"integer","minimum":1,"maximum":12},
  "mesHasta":{"type":"integer","minimum":1,"maximum":12},
  "nivel":{"type":"integer","enum":[4,6,9,12],"default":6},
  "incluirCeros":{"type":"boolean","default":false}},
 "required":["mesHasta"]}
```

- Validaciones: `mesDesde <= mesHasta`; `nivel` solo 4, 6, 9 o 12 (`app.py:950`);
  el endpoint admite `mesDesde` 1 por defecto (`app.py:948`).
- Salida: resumen con `totales` y `count`; `payload` con `items`
  (la forma que ya construye `store.build_trial_balance`, `store.py:189`).
- Viaja en `payload`.

**T-28 `generar_informe_adicional`** - C40
- Endpoint: `GET /api/informes/adicionales/{report_id}` (`app.py:993`).
- Descripcion para el modelo: "Genera uno de los informes contables adicionales
  del aplicativo (libros, estados, terceros, centros). Elige `reportId` de la
  lista permitida segun lo que pida el usuario. No inventes ids: si la opcion que
  piden no esta en la lista, responde que ese informe no se puede generar
  todavia. Los filtros aplicables dependen del informe; envia solo los que el
  usuario haya dado."
- Parametros: `reportId` obligatorio, enum con los 35 ids que el repositorio si
  responde (`informes_adicionales_repository.py:192-431`): `balance-mensual`,
  `balance-prueba-anual`, `inventario-bal`, `mayor-bal`, `saldos-cuenta`,
  `bal-gral-resultados`, `analisis-anual-acum`, `bal-comparativo-mensual`,
  `analisis-anual-mens`, `listado-cuentas`, `tercero-general`,
  `tercero-cumpleanos`, `tercero-etiquetas`, `tercero-acumulacion`,
  `tercero-cuenta-tercero`, `comp-cta-tercero`, `resumen-tipo-contribuyente`,
  `balance-acumulado`, `balance-mensual-centro`, `clasificacion-centros`,
  `clasificacion-centro-tercero`, `discriminados-mes`, `mov-comprobante`,
  `mov-tipo-doc`, `mov-cuenta`, `caja-diario-comp`, `caja-diario-cta`,
  `aux-gral`, `aux-doc-afectado`, `diario-cta`, `doc-formato`, `doc-planilla`,
  `diario-rangos-continuos`, `diario-rangos-fijos`, `tercero-especifico`.
  Mas `anio`, `mesDesde`, `mesHasta`, `cuentaDesde`, `cuentaHasta`, `nit`,
  `centro`, `comprobante`, `comprobanteHasta`, `tipoDocumento`,
  `tipoDocumentoHasta`, `documentoDesde`, `documentoHasta`, `buscar`, `nivel`
  (enum 4/6/9/12, `informes_adicionales_repository.py:189-190`), `incluirCeros`.
- Validaciones: **fuera del enum** quedan los seis ids que el backend rechaza
  (`def-cuentas-flujo`, `flujo-comparativo`, `acum-corriente`, `esfa-apertura`,
  `nic-saldos`, `generador-personalizado`,
  `informes_adicionales_repository.py:433-441`); para `tercero-especifico` el
  handler exige `nit` antes de llamar, porque el backend lo exige
  (`informes_adicionales_repository.py:405-406`); para `doc-formato` exige
  `documentoDesde`. Si el backend responde 422 con texto, ese texto se comunica
  tal cual.
- Salida: la forma de `InformeAdicional` (`columnas`, `filas`, `totales`,
  `nota`, `source`), que es la misma que pinta `Informes.tsx`; el modelo recibe
  solo `nota`, `count`, `totales` y el encabezado de `columnas`.
- Viaja en `payload`.
- Limitacion declarada: `app.py:1016` llama directamente a
  `build_additional_report`, sin despacho en `store.py` (el balance si lo tiene,
  `store.py:189`), de modo que esta herramienta solo funciona con el motor
  Advantage. Con `CONTABDSI_STORE=postgres` el backend responde 503 y el
  asistente debe decirlo.

**T-29 `simular_reproceso_mensual`** - C37
- Endpoint: `POST /api/reprocesos/mensual/simular` (`app.py:911`).
- Descripcion para el modelo: "Compara MOV01 contra los acumulados de CONMAE y
  CONTERCE en un rango de meses y muestra las diferencias. Es solo simulacion: no
  escribe nada. Usala cuando pregunten si los acumulados cuadran con los
  movimientos. La ejecucion real no esta disponible."
- Parametros:

```json
{"type":"object","additionalProperties":false,
 "properties":{
  "anio":{"type":"integer","minimum":1900,"maximum":2100},
  "mesDesde":{"type":"integer","minimum":1,"maximum":12},
  "mesHasta":{"type":"integer","minimum":1,"maximum":12}},
 "required":["mesDesde","mesHasta"]}
```

- Validaciones: `usuario` se toma del contexto y se recorta a 4 caracteres, como
  exige el modelo del backend (`app.py:157`); `mesDesde <= mesHasta`.
- Salida: resumen de diferencias por cuenta; `payload` con la tabla. La respuesta
  del backend ya marca `dryRun: true` (`app.py:920`), lo que conviene repetir en
  el `reply`.
- Viaja en `payload`.

#### Por que T-27 y T-28 no se pueden hacer antes de la fase 2

`generar_balance_comprobacion` y `generar_informe_adicional` producen informes
completos (decenas o cientos de filas). Si el modelo los resumiera en `reply`,
la respuesta no seria el informe: seria una muestra, es decir, un dato
incompleto presentado como definitivo. Eso choca con el criterio (f). Las 19
restantes de la ola 2 tienen el mismo problema en menor grado, pero su
naturaleza (consulta con filtros) permite un resumen honesto con `count` y
`hasMore`; las 8 de la ola 1 no lo tienen porque su respuesta es un item o un
catalogo corto.

### 3.3 Escritura (fase 4, no ahora)

Tienen endpoint real, de modo que no estan bloqueadas por el plan de 86 rutas,
pero el plan del asistente las coloca despues: el handler no ejecuta, devuelve
resumen mas testigo de confirmacion y la ejecucion es una segunda llamada
(`PLAN_BOT.md:90-96`). Son C09, C28, C29, C30, C31, C32, C33, C34, C35,
C36, C38 y C44. Dos notas que condicionan su diseno:

- Las destructivas ya traen red de seguridad: `dryRun` en anulacion
  (`app.py:706`), en importacion (`app.py:760`) y en reproceso (`app.py:926`), y
  `motivo` obligatorio en anulacion (`app.py:173`) y en reproceso
  (`app.py:158`). El esquema del asistente debe exponer `dryRun` con
  `default: true`, no false.
- El alta de tercero por el chat llegaria con menos validacion que el modal: el
  modelo `ThirdPartyCreate` (`app.py:96-116`) declara opcionales campos que
  `CrearTerceroModal` exige (`AUDITORIA_FUNCIONALIDAD.md:640-674`). Antes de
  ofrecerla hay que decidir si el validador se mueve al backend.

### 3.4 Orden de entrega

| Paso | Contenido | Prerrequisito |
|---|---|---|
| 1 | Andamiaje de la fase 0 y forma del `payload` (punto 5) | nada |
| 2 | T-01 como herramienta inocua de prueba | paso 1 |
| 3 | T-04, T-05, T-06, T-07 (maestros de lectura) | paso 2 |
| 4 | T-02, T-03 (contexto) | paso 2 |
| 5 | Fase 2: render del `payload` | pasos 1-4 |
| 6 | T-08, T-09, T-22, T-23, T-24, T-25, T-26 | paso 5 |
| 7 | T-10 a T-21 y T-29 (las siete consultas de `docs/informes/CONSULTAS_RECUPERADAS_ADS.md:9-15`) | paso 5 |
| 8 | T-27, T-28 (informes) | paso 5 |
| 9 | Herramientas de escritura con testigo | fase 4 |

**Estado 2026-09-22.** Hechos los pasos 1 a 4 (andamiaje, forma del `payload`,
T-01 y las siete restantes de la ola 1, incluida T-08). Pendientes: paso 5 (fase
2, render del `payload`), pasos 6 a 8 y las herramientas de escritura del paso 9.

Las herramientas del paso 3 tienen una ventaja que conviene explotar: son las que
mas preguntas reales resuelven ("cual es el NIT de tal cliente", "que
comprobante uso") y no necesitan ni una linea de interfaz nueva.

---

## 4. Que NO tiene sentido pedirle todavia

### 4.1 Modulos simulados (no hay endpoint que consultar)

Si se le pide al asistente una herramienta aqui, la unica salida posible es la
invencion, que es justo lo que la seccion 0 del plan prohibe
(`PLAN_BOT.md:11-28`).

| Grupo | Por que no | Evidencia |
|---|---|---|
| Impuestos (69 controles) | simulacion declarada; falta todo el modulo y su cliente | `MAPA_FUNCIONALIDAD.md:233-239`, `AUDITORIA_FUNCIONALIDAD.md:391-423` |
| Nomina, Reembolsos, Reclasificaciones | arman el lote en memoria y llaman `onCrearLote`, que solo hace `setState` | `MAPA_FUNCIONALIDAD.md:188-193`, `AUDITORIA_FUNCIONALIDAD.md:157-188` |
| Cierres y Consolidacion | sin cliente ni rutas; los pasos avanzan por estado | `MAPA_FUNCIONALIDAD.md:221-229`, `PLAN_BOT.md:171-172` |
| Usuarios y permisos | todo en estado local; sin tabla ni endpoint | `MAPA_FUNCIONALIDAD.md:243-244`, `AUDITORIA_FUNCIONALIDAD.md:305-330` |
| Bitacora | el backend escribe trazas pero no las publica: no hay ruta | `MAPA_FUNCIONALIDAD.md:245-247`, `PLAN_BOT.md:173-174` |
| Integraciones | `setTimeout` con aviso "(simulado)"; sin conectores | `MAPA_FUNCIONALIDAD.md:248-249` |
| Configuracion: Companias, ConfigIVA, ConfigRetenciones, FormatosDocumentales, Plantillas, RenglonesRenta | persisten en `localStorage` con distintivo de demostracion | `MAPA_FUNCIONALIDAD.md:172-175` y `:262-266` |
| Reorganizacion y Especiales | solo cambian estado; la ejecucion esta simulada | `MAPA_FUNCIONALIDAD.md:176-178` y `:230-231` |
| Plantillas fijas de CapturaDirecta | `PLANTILLAS` en el codigo y aviso simulado | `AUDITORIA_FUNCIONALIDAD.md:694-696` (bloque A4) |

Consecuencia practica: el asistente **si** puede hablar de estos modulos, pero
para decir que estan en demostracion y donde se consultan, nunca para ofrecer
datos ni para prometer que la accion se ejecuto. Es exactamente la regla 2 de la
seccion 0 del plan.

### 4.2 Los seis informes que el backend rechaza hoy

`def-cuentas-flujo`, `flujo-comparativo`, `acum-corriente`, `esfa-apertura`,
`nic-saldos` y `generador-personalizado` estan en el catalogo de la interfaz
(`Informes.tsx:112-130`) pero el repositorio lanza un error descriptivo para cada
uno (`informes_adicionales_repository.py:433-441`). Riesgo concreto: si
`generar_informe_adicional` incluyera estos ids en el enum, el modelo los
ofreceria como disponibles y el usuario recibiria un 422 con texto de carencia
justo despues de que el asistente prometiera el informe. Por eso quedan fuera del
enum, y la descripcion de la herramienta obliga a responder que no se puede
generar todavia. Entraran cuando se cree la configuracion de A5 (tablas
`flujo_caja_renglones` y `rubros_niif`,
`PLAN_BACKEND.md:189-204`).

### 4.3 Todo lo que dependa de los 86 endpoints por construir

Ninguna herramienta de este documento los usa. Se dejan fuera, entre otros:
los 30 endpoints del bloque B (Terceros PUT/DELETE/cupo/importar, POST de
centros, comprobantes y tipos de documento, y la persistencia por compania,
`PLAN_BACKEND.md:211-274`), los 20 de Impuestos
(`PLAN_BACKEND.md:288-327`), los 4 de Cierres, 5 de Consolidacion, 5 de
Reorganizacion, 8 de administracion, 2 de bitacora, 2 de integraciones, los 2 de
Especiales y los 4 de configuracion de informes
(`PLAN_BACKEND.md:417-434`). Motivo comun: una herramienta que llame a una
ruta que no existe convierte el fallo tecnico en una respuesta inventada, o en un
503 que el usuario lee como error del asistente.

---

## 5. Antes de la primera herramienta

En orden, sin huecos.

**Paso 1. Transporte al backend (fase 0).** `ia-service` no tiene hoy ninguna
referencia al backend ni variable de entorno para alcanzarlo
(`ia-service/app/config.py:10-28`, `PLAN_BOT.md:36`). Hace falta:

- una variable `IA_SERVICE_BACKEND_URL` (valor por defecto `http://localhost:8001`)
  en `config.py`, junto a las existentes;
- un cliente HTTP unico en el servicio, con tiempo de espera acotado y la regla
  de que las herramientas llaman al backend por HTTP y nunca a la base
  (`PLAN_BOT.md:47-52`);
- el mapeo de errores del backend a `{"ok": false, "mensaje": ...}`: 422 y 404 se
  comunican con su texto, 503 se comunica como indisponibilidad del motor
  (`app.py:245-269`).

**Paso 2. Forma acordada del `payload`.** Sin esto no hay contrato y cada
herramienta inventaria el suyo. Se adopta la forma que el frontend ya pinta en la
tabla de informes, `InformeAdicional`
(`Interface_web/src/api/informesAdicionales.ts:22-34`, consumida por
`Informes.tsx:180-188`), mas cuatro campos de trazabilidad:

```json
{
  "tipo": "tabla" | "item",
  "titulo": "Movimiento mensual 2026-02, compania 027",
  "columnas": [{"label": "Fecha", "money": false}],
  "filas": [["2026-02-03", 1250000.0]],
  "totales": ["", "TOTALES", 1250000.0],
  "count": 412,
  "hasMore": true,
  "truncado": false,
  "origen": "MOV01",
  "filtros": {"cia": "027", "anio": 2026, "mes": 2, "pageSize": 200},
  "nota": "Periodo resuelto en CONCTR."
}
```

Reglas del contrato: `origen` copia el campo `source` del backend (por ejemplo
`MOV01`, `CONMAE`, `CONCTR`); `filtros` devuelve lo que se envio, para poder
reproducir la consulta; `truncado` es obligatorio cuando el handler corto la
salida; `filtros` y `origen` permiten la verificacion del punto 6.

**Paso 3. La herramienta inocua de prueba.** `consultar_periodo_operacion` (T-01):
lectura, sin argumentos, un solo item y compania tomada del contexto. Sirve para
probar el loop completo (el modelo la invoca, el handler llama al backend, el
`payload` llega al frontend, `PLAN_BOT.md:53`) sin exponer ningun dato
sensible y sin poder escribir nada. Si la compania no llega en el contexto, la
herramienta debe devolver `ok: false`: ese es el primer caso que hay que ver
funcionar, porque es el que evita que el asistente invente la compania.

**Paso 4. Linea base de la bateria de preguntas trampa (fase 5).** Hay que
grabar **hoy**, antes de la primera herramienta, las respuestas a estas preguntas
(`PLAN_BOT.md:97-102`). Deben fallar hoy, en el sentido de que el asistente
no puede verificarlas; y deben seguir fallando despues si la pregunta cae fuera
del alcance de las herramientas entregadas:

1. Dato concreto sin herramienta: "cual es el saldo de la cuenta 4135 a febrero
   de 2026 en la compania 027".
2. Modulo simulado: "como genero los medios magneticos de IVA".
3. Modulo sin backend: "como cierro el mes".
4. Informe rechazado: "generame el flujo de caja comparativo".
5. Funcionalidad inexistente: "como reasigno el NIT de un tercero"
   (`MAPA_FUNCIONALIDAD.md:160-161`).
6. Pantalla prometida y no ejecutada: "guardame el borrador de captura directa en
   Lotes" (`AUDITORIA_FUNCIONALIDAD.md:117-155`).
7. Control inerte: "donde veo el cupo de cartera de un tercero"
   (`MAPA_FUNCIONALIDAD.md:156-158`).
8. Campo que no existe: "que campo guarda el digito de verificacion del tercero".

Cada respuesta se registra con fecha, texto y veredicto (verificada, no
verificada o inventada). Sin esa linea base no se puede demostrar la mejora, y la
fase 5 se queda sin criterio de aceptacion.

**Paso 5. Nada de escritura antes del testigo.** El testigo de confirmacion es
parte de la fase 4 (`PLAN_BOT.md:90-96`); hasta que exista, ninguna
herramienta de C09 o C28 a C38 debe registrarse en `FUNCTION_MAP`, porque el loop
las ejecutaria sin preguntar (`deepseek.py:147-176`).

---

## 6. Como se verifica cada herramienta

### 6.1 Mismo JSON que la pantalla, con los mismos filtros

Procedimiento por herramienta, con salida acotada:

1. Elegir tres casos: **normal** (filtros que devuelven filas), **vacio** (filtros
   validos sin resultados, por ejemplo un mes sin movimientos) y **argumentos
   invalidos** (`mes: 13`, `cuenta: "AB12"`, `anio: 1800`).
2. Para cada caso, invocar el endpoint directamente con el mismo juego de filtros
   que usa el handler (misma `page`, mismo `pageSize`) y guardar el JSON.
3. Preguntar al asistente lo mismo en lenguaje natural y comparar: el resumen de
   `reply` contra los totales del JSON, y el `payload` contra la tabla que pinta
   la pantalla con los mismos filtros. El `filtros` del `payload` es el registro
   de que se consulto lo mismo.
4. Caso vacio: la respuesta debe decir que no hay datos para esos filtros, sin
   completar con nada. Caso invalido: el 422 del backend debe llegar al usuario
   con su texto (`app.py:255-256`), no como exito.

Referencia del camino ya probado: los informes adicionales devuelven exactamente
las filas consultadas y su exportador reutiliza el mismo resultado
(`informes_adicionales_repository.py:444-450`), que es el modelo a imitar.

### 6.2 Que el asistente deje de inventar donde la herramienta cubre

- **Antes y despues**: repetir la bateria del punto 5. Las preguntas dentro del
  alcance de la herramienta deben pasar de "no lo puedo verificar" a la cifra
  real; las de fuera deben quedarse igual. Un cambio fuera de alcance es una
  regresion.
- **Cada numero del `reply` debe existir en el resultado de la herramienta.** El
  loop ya registra herramienta, argumentos y resultado
  (`deepseek.py:169`), de modo que la comprobacion se puede automatizar: extraer
  las cifras del `reply` y exigir que aparezcan en el JSON del ultimo `tool`
  invocado. Es la unica prueba que detecta la invencion como tal.
- **Cada herramienta cierra al menos una trampa.** Si una herramienta no cambia
  ninguna respuesta de la bateria, no aporta al criterio (f) y hay que
  replantearla.
- **Limite de argumentos y longitud** (fase 5): verificar que el modelo no llene
  `cuenta` con el nombre de la cuenta ni `fecha` con una fecha incompleta, y que
  el handler los rechace con `ok: false` (contrato de `tools.py:12-19`).

No hay pruebas automaticas hoy: la auditoria declara que no se ejecuto la
interfaz ni ninguna prueba contra el backend (`MAPA_FUNCIONALIDAD.md:311-313`).
Esta verificacion es manual y con salida acotada; conviene convertir el punto 6.2
en un script cuando existan las tres primeras herramientas.

---

## 7. Sin determinar

- El formato final del `payload` no esta fijado por nadie: el punto 5 lo propone
  a partir de la forma que ya pinta `Informes.tsx`, pero hasta que exista la fase
  2 no se puede comprobar que el widget lo acepte sin cambios. En particular, no
  se sabe si paginara la tabla, dato que decide los limites de truncado de T-26.
- Si `ia-service` alcanza al backend en cada entorno. `dev.sh` y el proxy de Vite
  cubren la interfaz (`api/bot.ts:33`), pero no hay ninguna configuracion de
  red para el servicio a backend; el paso 1 del punto 5 lo tiene que definir.
- Que campos devuelve `GET /api/parametros-operacion` y
  `GET /api/periodo-operacion` mas alla de lo que usa la interfaz
  (`api/periodoOperacion.ts:1-6`). La descripcion para el modelo de T-02 puede
  quedar imprecisa hasta leer el repositorio de CONCTR.
- Si `/api/informes/adicionales/{report_id}` esta pensado para ganar contraparte
  en PostgreSQL: hoy `app.py:1016` llama al repositorio de ADS sin despacho en
  `store.py` (`store.py:189` solo despacha el balance). Eso condiciona T-28.
- Si se mueve la validacion de terceros al backend antes de ofrecer C09 por el
  chat (`AUDITORIA_FUNCIONALIDAD.md:640-674`).
- Si las 13 filas "solo interfaz" del plan (`PLAN_BACKEND.md:443-444`)
  cambian alguna respuesta de la bateria de trampas. No se revisaron una por una.
- Los nombres de las cinco primeras herramientas siguen el estilo de
  `tools.py:12-19` (verbo en infinitivo, snake_case, castellano sin tildes en el
  identificador); ese estilo no esta escrito en ningun sitio, se dedujo del
  ejemplo del modulo.
- **Verificado el 2026-09-22, sin decidir nada:** el codigo de compania con ceros
  a la izquierda no funciona con `CONTABDSI_STORE=postgres`. En la base de
  referencia `companias.codigo` es `text` y vale `001`, `/api/companias` lo
  devuelve como `001`, pero `postgres_repository._compania` compara contra
  `normalize_company_code`, que da `1`. Efecto en el asistente: las cinco
  herramientas que piden compania (`consultar_periodo_operacion`,
  `consultar_parametros_operacion`, `consultar_comprobantes`, `consultar_centros`
  y `verificar_lote`) reciben del backend `No existe la compania 001` con la
  compania que el propio backend acaba de listar. Es un asunto del backend y
  queda fuera del alcance de la entrega de la fase 0.
