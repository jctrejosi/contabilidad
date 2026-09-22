# Detalle: procesos (bloques D2, D3 y D4)

Catorce rutas nuevas para Cierres (H5), Consolidacion y Reorganizacion (H9).

Tres advertencias que valen para todo el archivo, tomadas del propio proyecto:

1. La parte funcional de los cierres y de las consolidaciones esta declarada
   pendiente: "la parte funcional de B13 (cierres y consolidaciones sin
   algoritmos en `funciones.sql`)" (`db/migration/03_plan_de_carga.md:156-162`).
   Este plan implementa estado, checklist, homologacion y simulacion; la
   ejecucion que reescribe el libro queda condicionada a esa decision.
2. Los periodos 13 a 18 no existen en la copia disponible (decision P-5,
   `db/migration/homologacion/PENDIENTES.md:44`). Todo lo que dependa de ellos se
   prueba con periodos sembrados y se declara sin conciliacion contra el origen.
3. El mantenimiento del legado es sustitucion tecnica, no funcionalidad a
   replicar: "indices ADI y `COPY STRUC` se reemplazan por indices/DDL y
   mantenimiento PostgreSQL" (`db/old_db/MATRIZ_PROCESOS_Y_OPCIONES.md`, P36). Por
   eso D4 es solo PostgreSQL.

Tablas: `cierres`, `cierre_traslados`, `consolidaciones`,
`consolidacion_origenes` y `procesos` ya existen
(`db/postgresql/schema/07_procesos.sql`). Se anaden `consolidacion_cuentas` y
`consolidacion_centros` (seccion 4.2 del plan principal).

---

## 0. Patron comun

- `cia` (query) y `anio` (query) en todas las rutas del archivo; `usuario` en
  todas las que escriben.
- Toda operacion de proceso admite `dryRun` y exige `motivo`: son operaciones
  sobre el libro y la bitacora tiene que poder contar quien, cuando y por que
  (`backend/app.py:161-173` y `703`).
- El estado de cada proceso es el del modelo y no se escribe a mano:
  `procesos.estado` (`Configurado | Simulado | Ejecutando | Completado |
  Fallido`), `cierres.estado` (`Pendiente | Ejecutado | Anulado`) y
  `consolidaciones.estado` (`Configurado | Simulado | Ejecutado | Anulado`),
  todos con `CHECK` en el esquema.
- Respuestas: elemento `{"item": {...}, "source": "TABLA"}`, lista
  `{"items": [...], "count": n, "source": "TABLA"}`.
- Aceptacion: normal (el flujo completo), vacio (ano sin datos: listas vacias o
  checklist en falso, sin error) e invalido (el caso propio de cada ruta).

---

## 1. Cierres (D2)

### 1.1 `GET /api/cierres`

**Proposito.** Consultar el estado del cierre del ano y el checklist calculado.

**Request.** `cia`, `anio` (`ge=1900`, `le=2100`).

**Response (200)**

```json
{
  "item": {
    "anio": 2026,
    "estado": "Pendiente",
    "checklist": [
      { "id": "c1", "label": "Todos los lotes contabilizados", "bloqueante": true, "cumplido": false, "detalle": "3 lotes en Borrador" },
      { "id": "c2", "label": "Balance cuadrado (dif = 0)", "bloqueante": true, "cumplido": true, "detalle": "debito = credito" },
      { "id": "c4", "label": "Retenciones acumuladas", "bloqueante": false, "cumplido": false, "detalle": "ultimo periodo 01" }
    ],
    "puedeCerrar": false
  },
  "source": "cierres"
}
```

**Consume.** Cierres: los siete items del checklist (`Cierres.tsx:1-19`) y la
vista previa del cierre.

**Reglas**

- Los items se **calculan** con lo que existe: lotes pendientes con
  `GET /api/lotes`, cuadre con el balance (`GET /api/informes/
  balance-comprobacion`), acumulados con el estado de `estado_acumulaciones` y
  respaldo con la marca de `procesos.respaldo_realizado`. No se guardan valores
  fijos como en `INITIAL_CHECKS`.
- `puedeCerrar` es falso si algun item bloqueante no esta cumplido: la interfaz
  deshabilita "Generar lote de cierre" con esa bandera, no con su propio criterio.
- Si no existe fila en `cierres` para el ano, la respuesta devuelve el checklist
  calculado con `estado: "Pendiente"` y `id: null`: no obliga a crear el cierre
  para consultarlo.

**Criterio de aceptacion**

1. Normal: anno con 3 lotes en borrador devuelve `puedeCerrar: false` y el item
   c1 con el detalle del conteo.
2. Vacio: ano sin movimiento devuelve checklist con los items en falso y
   `id: null`.
3. Invalido: sin `anio`, 422.

### 1.2 `POST /api/cierres`

**Proposito.** Abrir el cierre del ano con la foto del checklist.

**Request.** `cia` mas cuerpo `CloseRequest`: `anio`, `usuario`, `motivo`.
`dryRun` (query).

**Response (201)**

```json
{ "item": { "id": 7, "anio": 2026, "estado": "Pendiente", "checklist": [{ "id": "c1", "cumplido": false }], "comprobante": null, "puedeCerrar": false }, "source": "cierres" }
```

**Consume.** Cierres: apertura de la vista previa (modal de cierre).

**Reglas**

- Un ano admite un solo cierre abierto: si ya existe uno en `Pendiente`, 409 con
  su `id`.
- Si hay un item bloqueante sin cumplir, se puede abrir el cierre (queda
  `Pendiente`), pero no ejecutar el lote: la ruta 1.3 lo exige. Abrir y ejecutar
  son pasos distintos porque el contador necesita revisar el checklist.
- El checklist queda congelado en `cierres.checklist` (`jsonb`) con lo que estaba
  cumplido en ese momento, que es lo que da trazabilidad: la consulta
  `GET /api/cierres` recalcula y esta ruta guarda la foto.

**Criterio de aceptacion**

1. Normal: apertura devuelve 201 y la consulta pasa a devolver el mismo `id`.
2. Vacio: ano sin movimiento permite abrir el cierre, con los items en falso.
3. Invalido: segundo cierre abierto del mismo ano, 409; sin `motivo`, 422;
   `dryRun=true` no escribe.

### 1.3 `POST /api/cierres/{id}/lote`

**Proposito.** Generar el lote de cierre del ano.

**Request.** `id` (path, `ge=1`), `cia`, cuerpo `LotActionRequest` (`usuario`) mas
`mes` (`pattern=r"^(0[0-9]|1[0-8])$"`, el periodo del asiento de cierre) y
`cuentaResultado` (`pattern=r"^[0-9]{1,12}$"`: la cuenta de resultados que recibe
el cierre, campo que el modelo ya declara, `07_procesos.sql:42`). `dryRun`.

**Response (200)**

```json
{ "item": { "cierre": 7, "lote": "CI26", "lineas": 18, "debito": 41500000.0, "credito": 41500000.0, "cuadrado": true, "dryRun": false }, "source": "cierres" }
```

**Consume.** Cierres: "Generar lote de cierre" (`Cierres.tsx:177-180`, hoy el
boton solo cierra el modal y no hay confirmacion alguna).

**Reglas**

- Rechaza con 409 si `puedeCerrar` es falso: primero se cumple el checklist.
- Usa por dentro las rutas que ya existen: `POST /api/lotes`
  (`backend/app.py:785`) y `POST /api/lotes/{lote}/detalle`
  (`backend/app.py:850`) con las partidas del cierre. El lote nace `Borrador` y
  cuadrado; contabilizarlo es el flujo normal de Lotes.
- Calcula las partidas a partir de los saldos del ano (no de un asiento fijo):
  las cuentas de resultado se cancelan contra `cuentaResultado`, que debe ser una
  cuenta de resultado afectable de la compania (422 si no).
- Deja `cierres.comprobante_id` y el lote enlazado, y una fila de `auditoria`. La
  operacion es idempotente: generar dos veces devuelve 409 con el lote ya creado.
- **No** cierra el ano ni abre el siguiente: eso es la parte funcional de B13, que
  esta declarada pendiente.

**Criterio de aceptacion**

1. Normal: checklist cumplido devuelve 200, el lote aparece en Lotes y el cierre
   queda con su comprobante.
2. Vacio: cierre ya generado devuelve 409 con el codigo del lote.
3. Invalido: checklist incompleto, 409; `cuentaResultado` inexistente o no
   afectable, 422; `dryRun=true` devuelve el mismo informe sin crear el lote.

### 1.4 `POST /api/cierres/{id}/traslado`

**Proposito.** Ejecutar el asistente de traslado de periodos que el modelo ya
declara en `cierre_traslados`.

**Request.** `id` (path), `cia`, y cuerpo `CloseTransferRequest`: `traslados`
(`list[TransferLine]`, `min_length=1`, con `origenPeriodo`, `destinoPeriodo`,
`cuenta`, `debito`, `credito`), `usuario`, `motivo`, `confirmacion` (texto
literal `TRASLADAR`). `dryRun`.

**Response (200)**

```json
{ "item": { "cierre": 7, "lineas": 6, "debito": 12400000.0, "credito": 12400000.0, "aplicado": true, "dryRun": false }, "source": "cierre_traslados" }
```

**Consume.** Cierres: "Iniciar asistente de traslado" (`Cierres.tsx:118-122`,
boton sin manejador).

**Reglas**

- Persiste la matriz origen y destino en `cierre_traslados`
  (`db/postgresql/schema/07_procesos.sql:56-64`) y, al aplicar, crea los
  documentos del periodo destino con las mismas dos rutas del lote de cierre.
- Un traslado no se aplica dos veces: la matriz declara la unicidad de la
  operacion; si el par origen y destino ya tiene las mismas lineas, 409 con el
  detalle (la matriz lo pide como prueba de aceptacion: "cada ajuste se traslada
  exactamente una vez al destino previsto").
- Advertencia P-5: los periodos 13 a 18 no existen en la copia. Si el origen del
  traslado es uno de ellos y el motor activo no los tiene sembrados, la ruta
  responde 422 con esa causa explicita y no inventa el periodo.
- `motor`: requiere tabla nueva en ADS. En Advantage no existe `cierre_traslados`
  ni el cierre como fila; con `CONTABDSI_STORE=ads` devuelve 503 declarado.

**Criterio de aceptacion**

1. Normal: traslado de 6 lineas cuadradas devuelve 200, los documentos del
   destino existen y `cierre_traslados` tiene las filas.
2. Vacio: matriz vacia devuelve 422 (`min_length=1`).
3. Invalido: sin `confirmacion`, 422; periodo de origen 13 en un motor sin
   periodos 13 a 18, 422 con la causa; repetir el mismo traslado, 409.

---

## 2. Consolidacion (D3)

### 2.1 `GET /api/consolidaciones`

**Proposito.** Listar las consolidaciones del ano destino.

**Request.** `cia` (compania destino), `anio`.

**Response (200)**

```json
{
  "items": [{ "id": 3, "anio": 2026, "estado": "Configurado", "origenes": 2, "compatibles": true, "ejecutadoEn": null }],
  "count": 1,
  "source": "consolidaciones"
}
```

**Consume.** Consolidacion: cabecera y chips de paso (`Consolidacion.tsx:39-44`).

**Reglas.** `origenes` y `compatibles` se calculan de `consolidacion_origenes` y
de la verificacion de compatibilidad (mismas cuentas homologadas), no del estado
de la pantalla.

**Criterio de aceptacion**

1. Normal: devuelve las consolidaciones con el conteo de origenes.
2. Vacio: compania sin consolidaciones, `items: []`, `count: 0`.
3. Invalido: sin `cia`, 422.

### 2.2 `POST /api/consolidaciones`

**Proposito.** Configurar una consolidacion: destino, origenes y homologaciones.

**Request.** `cia` (destino) mas cuerpo `ConsolidationWrite`: `anio`, `origenes`
(`list[CiaInclude]`, `min_length=1`, con `cia` y `incluida`), `cuentas`
(`list[AccountEquivalence]`, con `ciaOrigen`, `cuentaOrigen`, `cuentaDestino` y
`signo`), `centros` (`list[CenterEquivalence]`, con `ciaOrigen`, `centroOrigen` y
`centroDestino`), `usuario`, `motivo`.

**Response (201)**

```json
{ "item": { "id": 4, "anio": 2026, "estado": "Configurado", "origenes": 2, "cuentasHomologadas": 41, "centrosHomologados": 6 }, "source": "consolidaciones" }
```

**Consume.** Consolidacion: chips de origen (`Consolidacion.tsx:64-74`) y paso de
confirmacion.

**Reglas**

- Escribe `consolidaciones`, `consolidacion_origenes`, `consolidacion_cuentas` y
  `consolidacion_centros` en una transaccion. Las dos ultimas son las tablas
  nuevas: la matriz declara que "origen/destino no basta: falta persistir
  correspondencias de cuentas/centros y procedencia de cada resultado"
  (`db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`, CONSOLID, y P27).
- La compania destino debe estar marcada `solo_consolidacion`
  (`db/postgresql/schema/02_nucleo.sql:18`): consolidar hacia una compania
  operativa mezcla libros y se rechaza con 422.
- Las cuentas y los centros de la homologacion deben existir en la compania de
  origen y en la de destino. La cuenta destino debe ser del destino y la de
  origen, del origen; un cruce al reves, 422.
- Un origen solo puede estar en una consolidacion por ano (409).
- `motor`: en Advantage la cabecera y los origenes van a `CONSOLID`; las
  homologaciones requieren tabla nueva, porque la brecha esta declarada ahi mismo.

**Criterio de aceptacion**

1. Normal: dos origenes y 41 cuentas homologadas devuelven 201 y el paso
   "Verificar compatibilidad" deja de ser un paso de estado.
2. Vacio: sin `origenes` devuelve 422 (`min_length=1`).
3. Invalido: destino que no es de solo consolidacion, 422; cuenta de origen que
   no existe en ese origen, 422; origen ya incluido en otra consolidacion del ano,
   409.

### 2.3 `GET /api/consolidaciones/{id}`

**Proposito.** Ver orígenes, homologaciones, simulacion y totales comparados.

**Request.** `id` (path, `ge=1`), `cia`.

**Response (200)**

```json
{
  "item": {
    "id": 4,
    "estado": "Simulado",
    "origenes": [{ "cia": "002", "incluida": true, "cuentasHomologadas": 20, "cuentasSinHomologar": 3 }],
    "simulacion": { "filas": 318, "debito": 91200000.0, "credito": 91200000.0, "origen": 87800000.0, "diferencia": 3400000.0 },
    "comparacion": [{ "grupo": "Activo", "origen": 45000000.0, "destino": 48400000.0, "diferencia": 3400000.0 }]
  },
  "source": "consolidaciones"
}
```

**Consume.** Consolidacion: pasos "Verificar compatibilidad" y "Comparar
totales".

**Reglas.** Las cuentas sin homologar se listan y no se consolidan: la matriz
exige que la trazabilidad de cada resultado sea visible, asi que ir a
`diferencia` sin explicar el grupo que la produce no se considera terminado.

**Criterio de aceptacion**

1. Normal: devuelve la comparacion con la diferencia explicada por grupo.
2. Vacio: consolidacion recien configurada devuelve `simulacion` vacia y
   `cuentasSinHomologar` con el conteo.
3. Invalido: `id` inexistente o de otra compania, 404.

### 2.4 `POST /api/consolidaciones/{id}/simular`

**Proposito.** Simular la consolidacion sin escribir en el libro.

**Request.** `id` (path), `cia`, cuerpo `LotActionRequest` (`usuario`) y `motivo`.
`dryRun` (query, por defecto `true`: la simulacion ya es una simulacion; forzar
`false` seria incoherente y se rechaza con 422).

**Response (200)**

```json
{ "item": { "id": 4, "estado": "Simulado", "filas": 318, "debito": 91200000.0, "credito": 91200000.0, "cuentasSinHomologar": 3, "cuadra": true }, "source": "consolidaciones" }
```

**Consume.** Consolidacion: paso "Simulacion".

**Reglas**

- Lee los saldos de cada origen en el motor activo (PostgreSQL o `CONMAE` en ADS)
  y los pasa por la homologacion; no escribe asiento.
- El resultado va a `consolidaciones.simulacion` (`jsonb`) y el estado pasa a
  `Simulado`.
- Si no cuadra, devuelve `cuadra: false` con la diferencia y el detalle por
  cuenta sin homologar; no falla la ruta.

**Criterio de aceptacion**

1. Normal: simulacion de dos origenes devuelve 200 con las cifras y el estado
   `Simulado`.
2. Vacio: origen sin movimiento en el ano devuelve cifras en cero y `cuadra:
   true`.
3. Invalido: `dryRun=false`, 422; consolidacion en estado `Ejecutado`, 409;
   homogeneizacion incompleta que impida cuadrar, 200 con `cuadra: false` y el
   detalle.

### 2.5 `POST /api/consolidaciones/{id}/ejecutar`

**Proposito.** Ejecutar la consolidacion: escribir el asiento en la compania
destino.

**Request.** `id` (path), `cia`, cuerpo: `usuario`, `motivo`,
`respaldoRealizado` (booleano, obligatorio: el modelo tiene la columna
`respaldo_realizado`, `07_procesos.sql:77`) y `confirmacionVaciado` (booleano:
`confirmacion_vaciado`, `07_procesos.sql:78`). `dryRun`.

**Response (200)**

```json
{ "item": { "id": 4, "estado": "Ejecutado", "ejecutadoEn": "2026-03-02T10:15:00", "lote": "CN26", "filas": 318, "vaciado": true }, "source": "consolidaciones" }
```

**Consume.** Consolidacion: pasos "Respaldo y confirmacion", "Ejecucion" y
"Revalorizar" (`Consolidacion.tsx:187-189`).

**Reglas**

- Exige `respaldoRealizado` y `confirmacionVaciado` en verdadero (422 si no), y
  estado previo `Simulado` (409): no se ejecuta lo que no se simulo, que es lo
  que la propia pantalla promete al pedir el respaldo antes de ejecutar.
- Escribe por las rutas de lote que ya existen y marca
  `consolidaciones.estado = 'Ejecutado'` con `ejecutado_por` y `ejecutado_en` en
  la misma transaccion.
- **Alcance declarado:** el algoritmo de consolidacion esta entre lo pendiente de
  B13 (`db/migration/03_plan_de_carga.md:156-162`). Esta ruta queda
  especificada pero su implementacion espera esa decision; mientras no exista,
  devuelve 503 con el mensaje de la decision pendiente, no una simulacion que se
  presente como ejecucion.
- `motor`: requiere tabla nueva en ADS.

**Criterio de aceptacion**

1. Normal: consolidacion simulada con respaldo confirmado devuelve 200, el lote
   existe en el destino y el estado queda `Ejecutado`.
2. Vacio: no aplica (no hay ejecucion sin simulacion previa); el caso vacio es la
   consolidacion sin origen, que ya rechaza 2.2.
3. Invalido: sin `respaldoRealizado`, 422; sin simulacion previa, 409; segunda
   ejecucion, 409; motor ADS, 503 declarado.

---

## 3. Reorganizacion y mantenimiento (D4)

Las cinco rutas son `solo PostgreSQL`. En Advantage el mantenimiento del legado
es ADI y `COPY STRUC`, que el servicio no puede ejecutar sobre las tablas del
diccionario (P36): con `CONTABDSI_STORE=ads` devuelven 503 declarado.

### 3.1 `GET /api/mantenimiento`

**Proposito.** Consultar si hay un mantenimiento en curso y quien lo inicio.

**Request.** `cia`.

**Response (200)**

```json
{ "item": { "activo": true, "proceso": 12, "iniciadoEn": "2026-03-02T22:00:00", "usuario": "ADMI", "motivo": "Reindexacion mensual", "respaldo": true, "bloquea": true }, "source": "procesos" }
```

**Consume.** Reorganizacion: cabecera y aviso de exclusividad
(`Reorganizacion.tsx:40-50` y el texto de `107-117`).

**Reglas.** Se apoya en `procesos` con `tipo = 'Mantenimiento'` y estado
`Ejecutando`. `bloquea` es verdadero mientras haya un proceso de mantenimiento
abierto, y es lo que las demas rutas de escritura deben consultar (es la parte
que hoy solo cambia estado en React).

**Criterio de aceptacion**

1. Normal: con mantenimiento en curso devuelve `activo: true` y el actor.
2. Vacio: sin mantenimiento devuelve `activo: false` y el resto en nulo.
3. Invalido: sin `cia`, 422.

### 3.2 `POST /api/mantenimiento`

**Proposito.** Entrar en modo mantenimiento.

**Request.** `cia`, cuerpo: `usuario`, `motivo` (obligatorio), `respaldoRealizado`
(booleano, obligatorio), `alcance` (opcional, `jsonb` con las tablas a
mantener).

**Response (201)**

```json
{ "item": { "proceso": 12, "estado": "Ejecutando", "respaldo": true, "bloquea": true }, "source": "procesos" }
```

**Consume.** Reorganizacion: "Iniciar mantenimiento" (`Reorganizacion.tsx:185-187`).

**Reglas.** Un solo mantenimiento abierto por compania: 409 si ya hay uno. Exige
`respaldoRealizado`. Deja fila en `auditoria` con el motivo. La comprobacion de
`bloquea` es la que convierte el modo en efectivo y es lo que hoy no existe: la
pantalla dice que la operacion "excluye a los demas usuarios" y eso pasa a ser
cierto porque las rutas de escritura la consultan.

**Criterio de aceptacion**

1. Normal: entra con respaldo confirmado, el `GET` de 3.1 lo ve y una escritura
   de prueba (por ejemplo crear un lote) devuelve 409 mientras dura.
2. Vacio: no aplica; el caso equivalente es sin `respaldoRealizado`, que es 422.
3. Invalido: sin `motivo`, 422; segundo mantenimiento, 409.

### 3.3 `DELETE /api/mantenimiento`

**Proposito.** Volver al estado normal.

**Request.** `cia`, `motivo`, `usuario` y `proceso` (query, `ge=1`): solo quien
puede ver el proceso lo cierra.

**Response (204).**

**Consume.** Reorganizacion: "Volver al estado normal"
(`Reorganizacion.tsx:72-82`).

**Reglas.** Cierra el proceso con estado `Completado` y deja de bloquear. Si el
proceso tiene una ejecucion en curso (3.4), 409 hasta que termine. Registrar el
cierre en `auditoria` es obligatorio: es la salida del modo que excluye a los
demas usuarios.

**Criterio de aceptacion**

1. Normal: cerrar devuelve 204 y las escrituras vuelven a pasar.
2. Vacio: sin mantenimiento activo, 404.
3. Invalido: sin `motivo`, 422; con ejecucion en curso, 409.

### 3.4 `POST /api/reorganizaciones`

**Proposito.** Ejecutar la compactacion o reindexacion declarada.

**Request.** `cia`, cuerpo: `usuario`, `motivo`, `tipo`
(`Literal["Reindexar", "Analizar", "Compactar"]`) y `alcance` (opcional).
`dryRun`.

**Response (202)**

```json
{ "item": { "proceso": 13, "tipo": "Reindexar", "estado": "Ejecutando", "iniciadoEn": "2026-03-02T22:05:00" }, "source": "procesos" }
```

**Consume.** Reorganizacion: confirmacion de la ejecucion
(`Reorganizacion.tsx:72-76`).

**Reglas.** Exige mantenimiento activo (409 si no): es exactamente lo que la
pantalla promete al iniciar mantenimiento antes de reorganizar. Se ejecuta fuera
de la peticion (la operacion es larga) y la respuesta 202 devuelve el proceso que
se puede consultar en 3.5. Una sola reorganizacion en curso por compania (409).

**Criterio de aceptacion**

1. Normal: con mantenimiento activo devuelve 202 y el proceso aparece en la
   consulta.
2. Vacio: `dryRun=true` valida el alcance y devuelve las tablas afectadas sin
   ejecutar.
3. Invalido: sin mantenimiento activo, 409; `tipo` desconocido, 422; sin
   `motivo`, 422.

### 3.5 `GET /api/reorganizaciones/{id}`

**Proposito.** Consultar el resultado y los conteos de una reorganizacion.

**Request.** `id` (path, `ge=1`), `cia`.

**Response (200)**

```json
{ "item": { "proceso": 13, "estado": "Completado", "tipo": "Reindexar", "duracionSegundos": 184, "resultado": { "indices": 42, "filas": 5043942, "bloatAntes": 0.31, "bloatDespues": 0.04 } }, "source": "procesos" }
```

**Consume.** Reorganizacion: barra de progreso (hoy un `setInterval`).

**Reglas.** `progreso` y `resultado` salen de `procesos.resultado`
(`jsonb`). El estado es el del modelo (`Ejecutando`, `Completado`, `Fallido`), no
un porcentaje inventado en la interfaz.

**Criterio de aceptacion**

1. Normal: devuelve el estado y el resultado con los conteos reales.
2. Vacio: proceso recien lanzado devuelve `Ejecutando` y `resultado: {}`.
3. Invalido: `id` inexistente, 404.
