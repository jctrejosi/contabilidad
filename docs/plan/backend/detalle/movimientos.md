# Detalle: movimientos (bloques B1b, C, E1 y E2)

Cinco rutas nuevas: la reasignacion de NIT (E1) y el ciclo del reembolso (E2).
El bloque C no tiene rutas nuevas: cierra H1 y H2 cableando dos rutas que ya
existen. La ultima seccion recoge ese trabajo de interfaz para que quede
especificado en un solo sitio.

---

## 1. `POST /api/terceros/{nit}/reasignar` (E1)

**Proposito.** Reescribir las referencias contables de un NIT cuando el tercero
se creo con un documento equivocado.

**Request**

- `nit` (path): `pattern=r"^[0-9]{1,10}$"`.
- Cuerpo `ThirdPartyReassignment`: `nitNuevo` (`pattern=r"^[0-9]{1,10}$"`),
  `motivo` (`5..180`), `usuario`, y `alcance`
  (`Literal["todo", "desdeFecha"]`) con `fecha` obligatoria cuando el alcance es
  `desdeFecha` (`date`, igual que `DirectMovementPost.fecha`, `backend/app.py:139`).
- `dryRun` (query, opcional): informe de impacto sin escribir,
  `backend/app.py:703`.

**Response (200)**

```json
{
  "item": {
    "nitOrigen": "900123456",
    "nitDestino": "900123457",
    "reescrito": { "documento_lineas": 184, "lote_lineas": 12, "saldos_cuenta_tercero": 9, "acumulados_tercero": 3, "reembolsos": 0 },
    "dryRun": false
  },
  "source": "terceros"
}
```

**Consume.** Terceros, "Reasignar NIT" (`Terceros.tsx:299-305`, asistente
deshabilitado).

**Reglas**

- El NIT destino debe existir (`terceros`/`FADCLI`): si no, 404; esta operacion
  no crea terceros.
- Todo dentro de una transaccion, con `dryRun` disponible: es una reescritura del
  libro y la auditoria de un contador no admite ejecuciones a medias.
- Consecutivos y numeracion no se tocan: solo la referencia al tercero.
- Saldos y acumulados se recalculan con la funcion del esquema
  (`regenerar_acumulados`, `db/README.md:97-98`) despues de reescribir; no se
  editan a mano.
- La operacion **no** esta implementada en Advantage: la auditoria no encontro
  rutina de reasignacion en el legado y la matriz solo la menciona al conservar
  campos (`db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`, FADCLI y CONEMP). Con
  `CONTABDSI_STORE=ads` devuelve 503 declarado, no una simulacion.
- Queda una fila por cada tabla tocada en `auditoria`, con el conteo y el motivo.

**Criterio de aceptacion**

1. Normal: reasignacion de un NIT con 184 partidas devuelve 200 con el conteo,
   las partidas quedan en el NIT destino y los saldos del periodo cuadran igual
   que antes (la suma total no cambia).
2. Vacio: un NIT sin partidas devuelve 200 con todos los conteos en cero y un
   aviso en el item; no falla.
3. Invalido: NIT origen inexistente, 404; NIT origen igual al destino, 422; sin
   `motivo`, 422; `alcance: "desdeFecha"` sin `fecha`, 422; motor ADS, 503.

---

## 2. Reembolsos (E2)

Cuatro rutas sobre `reembolsos` y `reembolso_lineas`
(`db/postgresql/schema/11_ampliaciones.sql:33-71`). Cierran la mitad de H15
(el borrador en `localStorage`, `Reembolsos.tsx:175-179`) y la parte de H2 que le
toca a esta pantalla.

### 2.1 `GET /api/reembolsos`

**Proposito.** Listar los reembolsos de la compania con su estado.

**Request.** `cia` (query, obligatorio), `anio` (query, `ge=1900`, `le=2100`),
`estado` (`Literal["todos", "Borrador", "Aplicado", "Anulado"]`, por defecto
`todos`), `page` y `pageSize` (`le=200`), con los mismos nombres y limites que
`GET /api/documentos` (`backend/app.py:644-654`).

**Response (200)**

```json
{
  "items": [
    { "numero": "RB-001", "fecha": "2026-02-10", "periodo": "02", "tercero": "12.345.678", "nombreTercero": "GARCIA MORENO JUAN PABLO", "cajaMenor": "Caja general", "estado": "Borrador", "lote": null, "total": 1250000.0 }
  ],
  "count": 1,
  "source": "reembolsos"
}
```

**Consume.** Reembolsos: lista del modulo (19 de 19 controles sin conexion).

**Reglas.** Excluye los anulados salvo que `estado` lo pida. En Advantage devuelve
503 declarado: CONREMAE y CONREITE estan en la matriz como "Sin estructura,
estructura fisica no localizada".

**Criterio de aceptacion**

1. Normal: devuelve el reembolso con su total, calculado sumando lineas, no un
   campo precalculado.
2. Vacio: compania sin reembolsos, `items: []`, `count: 0`.
3. Invalido: `cia` ausente, 422; `estado` distinto de los cuatro valores, 422.

### 2.2 `POST /api/reembolsos`

**Proposito.** Crear el reembolso con sus lineas.

**Request.** `cia` mas cuerpo `RefundWrite`: `numero` (`1..12`), `fecha` (`date`),
`periodo` (`pattern=r"^(0[0-9]|1[0-8])$"`, igual que `LotWrite.mes`,
`backend/app.py:183`), `tercero` (NIT existente), `cajaMenor` (opcional),
`lineas` (`list[RefundLineWrite]`, `min_length=2`, `max_length=200`, con
`numeroLinea`, `cuenta`, `centro`, `concepto`, `debito`, `credito`,
`documentoSoporte`), `usuario`.

**Response (201)**

```json
{
  "item": { "numero": "RB-002", "estado": "Borrador", "debito": 1250000.0, "credito": 1250000.0, "lineas": 3, "cuadrado": true },
  "source": "reembolsos"
}
```

**Consume.** Reembolsos: "Guardar" (`Reembolsos.tsx:224`, via `onCrearLote`).

**Reglas**

- Unicidad de `numero` por compania y ano (409). El numero es manual: la pantalla
  lo escribe y el modelo no declara consecutivo de reembolsos.
- Cuadre obligatorio: suma de `debito` igual a suma de `credito`, si no 422. Es la
  misma condicion que el modelo declara por linea (`reembolso_lineas` tiene
  `CHECK (debito = 0 OR credito = 0)` y el `sin_doble_valor`).
- Cuenta y centro deben existir en la compania (FK compuestas,
  `11_ampliaciones.sql:67-70`): 422.
- Estado: nace `Borrador`. Un reembolso `Aplicado` no se vuelve a crear.

**Criterio de aceptacion**

1. Normal: reembolso de tres lineas cuadrado devuelve 201 y aparece en el `GET`
   con `estado: "Borrador"`.
2. Vacio: `lineas: []` devuelve 422; una sola linea, 422.
3. Invalido: descuadre de 1 peso, 422; `numero` repetido, 409; tercero
   inexistente, 422; una linea con debito y credito a la vez, 422.

### 2.3 `PUT /api/reembolsos/{numero}`

**Proposito.** Modificar el borrador y reemplazar sus lineas.

**Request.** `numero` (path), `cia`, y cuerpo `RefundWrite` sin `numero`.

**Response (200).** `{"item": {...}, "source": "reembolsos"}`.

**Consume.** Reembolsos: "Guardar borrador" (`Reembolsos.tsx:175-179`, hoy
`localStorage.setItem` con el aviso "guardado como borrador en este navegador").

**Reglas.** Solo se modifica en estado `Borrador`: 409 en `Aplicado` o `Anulado`.
Las lineas se reemplazan en bloque. Si la fecha cambia de periodo, se recalcula el
periodo en `periodos_contables` de la compania.

**Criterio de aceptacion**

1. Normal: cambio de lineas devuelve 200 con el cuadre recalculado y el borrador
   viaja con la compania (ya no vive en el navegador).
2. Vacio: numero inexistente, 404.
3. Invalido: reembolso `Aplicado`, 409; descuadre, 422.

### 2.4 `POST /api/reembolsos/{numero}/aplicar`

**Proposito.** Aplicar el reembolso: crear el lote real con sus lineas y ligarlo.

**Request.** `numero` (path), `cia`, cuerpo `LotActionRequest` (`usuario`,
`backend/app.py:187-192`) y `dryRun` (query).

**Response (200)**

```json
{
  "item": { "numero": "RB-002", "estado": "Aplicado", "lote": "RB02", "lineas": 3, "cuadrado": true },
  "source": "reembolsos"
}
```

**Consume.** Reembolsos: "Generar lote" (`Reembolsos.tsx:224`, hoy via
`onCrearLote`, que solo hace `setState` en `App.tsx:95-97`).

**Reglas**

- Usa por dentro las dos rutas que ya existen: `POST /api/lotes`
  (`backend/app.py:785`) y `POST /api/lotes/{lote}/detalle`
  (`backend/app.py:850`). El codigo de lote que se muestra es el que devuelve el
  backend, nunca uno generado en el navegador (es la leccion de H1 y H2).
- La creacion del lote y el cambio de estado del reembolso son una sola
  transaccion: o quedan las dos cosas o ninguna.
- Idempotencia: aplicar dos veces devuelve 409 con el lote ya creado; el
  `reembolsos.lote_id` es la marca (`11_ampliaciones.sql:44`).
- El lote nace `Borrador` y cuadrado; verificarlo y contabilizarlo es el flujo
  normal de Lotes, que ya existe.

**Criterio de aceptacion**

1. Normal: aplicar un reembolso cuadrado crea el lote, el reembolso queda
   `Aplicado` y el aviso muestra el codigo devuelto; el lote aparece en Lotes,
   que si lee del backend (`Lotes.tsx:74-84`).
2. Vacio: reembolso sin lineas, 422.
3. Invalido: segundo aplicar, 409; `dryRun=true` informa el lote que crearia y no
   escribe nada; motor ADS, 503 declarado.

---

## 3. Bloque C: trabajo de interfaz, sin ruta nueva

Queda aqui especificado porque no genera contrato de backend. Cierra H1, H2, la
mitad de H15 y la parte de datos de Reclasificaciones.

| Tarea | Que se hace | Archivos |
|---|---|---|
| C1. Guardar borrador | Encadenar `crearLote` y `guardarLineaLote` de `api/lotes.ts` (`136` y `148`), usar el codigo devuelto en el aviso y quitar el codigo `CD-nn` del navegador | `CapturaDirecta.tsx:469-517` y `583-585` |
| C2. Generar lote | Sustituir `onCrearLote` por el mismo encadenado en Nomina, Plantillas, Reclasificaciones y Reembolsos | `Nomina.tsx:134-138`, `Plantillas.tsx:158-168`, `Reclasificaciones.tsx:232-238`, `Reembolsos.tsx`; retirar `crearLote` de `App.tsx:95-97` y `130-131` |
| C2b. Distintivo | Retirar el distintivo "Datos de demostracion" de las cabeceras de las cuatro pantallas **despues** de que el lote sea real | `Nomina.tsx:143-150`, `Plantillas.tsx:187-194`, `Reclasificaciones.tsx:275-277`, `Reembolsos.tsx:231-238` |
| C3. Consulta real | Sustituir `data/mock` y `movimientosPorDocumento` (`data/configReclasificaciones.ts`) por `GET /api/documentos` y `GET /api/documentos/detalle`: las partidas ya traen `centro` por linea (`backend/documentos_repository.py:262-272`) | `Reclasificaciones.tsx:143-153` y `196-315` |
| C4. Portapapeles | Leer de verdad el portapapeles (`navigator.clipboard.readText`) y parsear tabulaciones o comas; en el mismo dialogo, aplicar plantillas guardadas por `GET /api/plantillas-contables` | `CapturaDirecta.tsx:1046-1076`, `110-114` y `429-431` |

Regla de cierre de la tabla: cada fila termina cuando el aviso de la pantalla
nombra un registro que existe en el backend y se puede encontrar por una consulta
independiente. Mientras eso no ocurra, el aviso no puede afirmar persistencia.
