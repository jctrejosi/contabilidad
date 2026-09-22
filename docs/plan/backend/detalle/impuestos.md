# Detalle: impuestos y cuentas en cero (bloque D1 y Especiales)

Veintidos rutas nuevas: veinte del modulo de Impuestos (H10) y dos del modulo de
Especiales (H6). La auditoria no asigna H6 a ningun bloque de su seccion 4; este
plan lo coloca en D porque toca el plan de cuentas y su registro obligatorio va a
la bitacora de D6.

Las tablas ya existen y la contraparte legada esta nombrada, asi que no hay DDL
nuevo. Los siete pasos de la pantalla (`Impuestos.tsx:28`) corresponden uno a uno
a las tablas del modelo de exogena.

---

## 0. Patron comun del modulo de Impuestos

- **Compania.** `cia` (query, `pattern=r"^[0-9]{1,3}$"`) en todas las rutas. Los
  formatos y las generaciones son por compania y ano; los conceptos y las
  asignaciones cuelgan de un formato.
- **Respuestas.** Iguales al resto de la API: lista
  `{"items": [...], "count": n, "source": "TABLA"}`, elemento
  `{"item": {...}, "source": "TABLA"}`, baja 204, exportacion `Response`
  (`backend/app.py:962-972`).
- **Escrituras destructivas o masivas.** `POST .../acumular`, `PUT .../topes`,
  `PUT .../conceptos` y `PUT .../asignaciones` reemplazan o recalculan
  colecciones: llevan `dryRun` (query) y `motivo` en el cuerpo, siguiendo el
  patron de la anulacion y del reproceso (`backend/app.py:703` y `894`).
- **Porcentajes.** `tarifa` como fraccion, igual que en el bloque B3: 10 % es
  `0.1` (`db/postgresql/schema/01_dominios.sql:15`). Es la conversion que la
  matriz exige para CONMAG2 y para la clase fiscal del renglon.
- **Estados.** `generaciones_medios.estado` es
  `Generado | Revisado | Exportado` (`db/postgresql/schema/06_impuestos.sql:62`):
  una generacion exportada no se vuelve a generar, solo se consulta.
- **Auditoria.** En PostgreSQL los disparadores de `formatos_exogenos` y
  `generaciones_medios` (`db/postgresql/schema/06_impuestos.sql:115-118`) y la
  fila de `auditoria` de cada accion; en ADS `VISAUDI`.
- **Aceptacion.** Cada ruta cierra con tres casos: normal (el flujo con datos del
  periodo), vacio (periodo o compania sin datos, que devuelve listas vacias o
  totales en cero, nunca un error) e invalido (el caso propio que se enumera).

---

## 1. Acumulados de IVA y de retenciones

Advertencia de alcance que condiciona las seis rutas de esta seccion: la matriz
declara que el recalculo no esta resuelto en el modelo. Para CONRET,
"`regenerar_acumulados(Retencion)` actualiza terceros, no retenciones; preservar
bases, periodo, concepto y ajustes/certificados"; para CONIVA,
"`regenerar_acumulados(Iva)` no reconstruye esta tabla; **falta relacion fiscal
inequivoca desde el renglon**" (`db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`). Por eso
la ruta de acumulacion incluye como parte de su trabajo la relacion entre la
clase fiscal del renglon (`documento_lineas.clase`, con los valores `IVA` y
`Retencion` que fija D-MOV-2,
`db/migration/homologacion/PENDIENTES.md:86`) y el concepto o la tarifa que lo
genero. Sin esa relacion la acumulacion seria una suma por cuenta y no un
acumulado fiscal, que es justo lo que la declaracion necesita.

### 1.1 `GET /api/impuestos/acumulados-iva`

**Proposito.** Consultar el IVA acumulado por tercero y periodo.

**Request.** `cia`, `anio` (`ge=1900`, `le=2100`), `mesDesde` y `mesHasta`
(`ge=1`, `le=12`, con los alias de `backend/app.py:944-948`), `nit` (opcional,
`max_length=15`), `page` y `pageSize` (`le=200`).

**Response (200)**

```json
{
  "items": [
    { "nit": "800100200", "nombre": "EMPRESA ABC COMERCIAL S.A.S.", "periodo": "02", "base": 15000000.0, "ivaGenerado": 2850000.0, "ivaDescontable": 0.0, "neto": 2850000.0 }
  ],
  "count": 1,
  "totales": { "base": 15000000.0, "ivaGenerado": 2850000.0, "ivaDescontable": 0.0, "neto": 2850000.0 },
  "source": "acumulados_iva"
}
```

**Consume.** Impuestos, tab IVA: tabla, filtros de periodo y el indicador de
"ultima actualizacion".

**Reglas.** Solo lectura; no recalcula. El campo de ultima actualizacion sale de
`estado_acumulaciones` (`db/postgresql/schema/05_saldos.sql:146`), no de una
fecha escrita en la interfaz. En Advantage lee CONIVA.

**Criterio de aceptacion**

1. Normal: periodo con movimiento devuelve las filas por tercero y los totales
   que cuadran con la suma.
2. Vacio: periodo sin movimiento devuelve `items: []`, totales en cero y no falla.
3. Invalido: `mesDesde` mayor que `mesHasta`, 422; sin `cia`, 422.

### 1.2 `POST /api/impuestos/acumulados-iva/acumular`

**Proposito.** Recalcular el acumulado de IVA del periodo indicado.

**Request.** `cia`, mas cuerpo `AccumulationRequest`: `anio`, `mesDesde`,
`mesHasta`, `usuario` y `motivo` (`5..180`, obligatorio: la acumulacion reescribe
la base de una declaracion). `dryRun` (query).

**Response (200)**

```json
{
  "item": { "tipo": "IVA", "periodos": ["02"], "filas": 37, "base": 22600000.0, "valor": 17900000.0, "diferencias": 0, "dryRun": false },
  "source": "acumulados_iva"
}
```

**Consume.** Impuestos: "Acumular" (`Impuestos.tsx:230-238`, hoy `setTimeout` con
aviso "(simulado)" y fecha fija `2026-02-28`).

**Reglas.** Reescribe solo los periodos pedidos y dentro de una transaccion.
`dryRun` devuelve el mismo informe sin escribir. Actualiza
`estado_acumulaciones` por tipo y periodo. Si el periodo esta en un ano cerrado
(`cierres.estado = 'Ejecutado'`), 409. Registra en `auditoria` el conteo, el
rango y el motivo.

**Criterio de aceptacion**

1. Normal: acumular febrero con 37 filas devuelve 200 y el `GET` de 1.1 pasa a
   mostrar el periodo y la fecha real de actualizacion.
2. Vacio: rango sin movimiento devuelve 200 con `filas: 0` y deja el acumulado de
   ese periodo en cero, sin tocar los demas.
3. Invalido: sin `motivo`, 422; periodo de un ano cerrado, 409; `dryRun=true` no
   escribe y lo declara.

### 1.3 `GET /api/impuestos/acumulados-iva/exportar`

**Proposito.** Descargar el acumulado de IVA filtrado.

**Request.** Los mismos filtros de 1.1 mas `formato`
(`Literal["xlsx", "csv"]`, obligatorio), siguiendo la exportacion del balance
(`backend/app.py:962-972`).

**Response (200).** `Response` con el archivo y su `content-type`; el cuerpo no
es JSON.

**Consume.** Impuestos: "Exportar IVA" (`663-672`).

**Reglas.** Exporta exactamente lo que la pantalla muestra, con los mismos
filtros: el endpoint de exportacion no admite filtros que la consulta no admita
(es la misma regla que el balance, donde el exportador reutiliza los filtros de
la consulta visible, `backend/app.py:1028-1032`). Sin filas devuelve un archivo
con encabezados, 200, no un error.

**Criterio de aceptacion**

1. Normal: descarga con las mismas filas del `GET`.
2. Vacio: descarga de un periodo sin datos, archivo con solo encabezados.
3. Invalido: `formato` distinto de `xlsx` o `csv`, 422.

### 1.4 `GET /api/impuestos/acumulados-retenciones`

**Proposito.** Consultar las retenciones acumuladas por tercero, concepto y
periodo.

**Request.** Los mismos filtros de 1.1 mas `concepto` (opcional).

**Response (200)**

```json
{
  "items": [
    { "nit": "800100200", "nombre": "EMPRESA ABC COMERCIAL S.A.S.", "concepto": "HON", "nombreConcepto": "Honorarios", "periodo": "01", "base": 15000000.0, "tarifa": 0.1, "valor": 1500000.0 }
  ],
  "count": 1,
  "totales": { "base": 15000000.0, "valor": 1500000.0 },
  "source": "acumulados_retencion"
}
```

**Consume.** Impuestos, tab retenciones.

**Reglas.** La tarifa que se muestra es la del concepto vigente o la que quedo
registrada en el acumulado: la matriz pide "no usar tarifas actuales para
historia" (`db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`, CONTIRET). Si el modelo no
guarda la tarifa en el acumulado, el campo viaja como `null` y la interfaz debe
mostrarlo asi, no completarlo con la tarifa de hoy.

**Criterio de aceptacion**

1. Normal: filas por tercero y concepto con totales que cuadran.
2. Vacio: lista vacia y totales en cero.
3. Invalido: `concepto` inexistente devuelve lista vacia (no 404): es un filtro.

### 1.5 `POST /api/impuestos/acumulados-retenciones/acumular`

**Proposito.** Recalcular las retenciones acumuladas del periodo.

**Request.** Igual que 1.2.

**Response (200)**

```json
{ "item": { "tipo": "Retencion", "periodos": ["01", "02"], "filas": 64, "base": 29500000.0, "valor": 2050000.0, "diferencias": 0, "dryRun": false }, "source": "acumulados_retencion" }
```

**Consume.** Impuestos: "Acumular" (`230-238`).

**Reglas.** Las mismas de 1.2. A diferencia del IVA, aqui el recalculo no puede
apoyarse en `regenerar_acumulados(Retencion)`, que hoy actualiza terceros y no
retenciones (declarado en la matriz): la implementacion incluye la parte que
falta.

**Criterio de aceptacion**

1. Normal: acumular dos periodos devuelve 200 con el conteo y el `GET` de 1.4
   refleja el resultado.
2. Vacio: rango sin movimiento, `filas: 0`.
3. Invalido: sin `motivo`, 422; ano cerrado, 409.

### 1.6 `GET /api/impuestos/acumulados-retenciones/exportar`

**Proposito.** Descargar las retenciones acumuladas.

**Request.** Los filtros de 1.4 mas `formato` (`Literal["xlsx", "csv"]`).

**Response (200).** Archivo, no JSON.

**Consume.** Impuestos: "Exportar retenciones" (`426-436`).

**Reglas.** Las mismas de 1.3.

**Criterio de aceptacion.** Los tres casos de 1.3, sobre las retenciones.

---

## 2. Formatos, conceptos y asignaciones

### 2.1 `GET /api/impuestos/formatos`

**Proposito.** Listar los formatos de exogena con su vigencia y su estado.

**Request.** `cia`, `anio` (opcional: filtra por vigencia).

**Response (200)**

```json
{
  "items": [{ "codigo": "F1001", "nombre": "Pagos o abonos en cuenta", "vigencia": 2026, "activo": true, "conceptos": 3, "cuentasAsignadas": 2 }],
  "count": 1,
  "source": "formatos_exogenos"
}
```

**Consume.** Impuestos, paso "Formatos" (`MEDIOS_STEPS`, `Impuestos.tsx:28`).

**Reglas.** La unicidad del modelo es `(compania_id, codigo, vigencia)`
(`db/postgresql/schema/06_impuestos.sql:24`): el mismo formato puede tener varias
vigencias y la matriz lo señala como brecha de CONMAG1. Los conteos de conceptos
y cuentas se calculan, no se guardan.

**Criterio de aceptacion**

1. Normal: devuelve los formatos con sus conteos.
2. Vacio: compania sin formatos, `items: []`, `count: 0`.
3. Invalido: sin `cia`, 422.

### 2.2 `POST /api/impuestos/formatos`

**Proposito.** Crear un formato de exogena.

**Request.** `cia` mas cuerpo `ExogenousFormatWrite`: `codigo` (`1..10`),
`nombre` (`1..60`), `vigencia` (`ge=1900`, `le=2100`), `activo` (booleano),
`usuario`.

**Response (201)**

```json
{ "item": { "codigo": "F1008", "nombre": "Descuentos tributarios", "vigencia": 2026, "activo": true }, "source": "formatos_exogenos" }
```

**Consume.** Impuestos: "Agregar formato" (`Impuestos.tsx:258-268`).

**Reglas.** Unicidad por compania, codigo y vigencia (409). Nace `activo`. No se
crean conceptos ni asignaciones en el mismo cuerpo: son pasos distintos de la
pantalla y llevan su propia ruta.

**Criterio de aceptacion**

1. Normal: formato nuevo devuelve 201 y aparece en el `GET` de 2.1.
2. Vacio: sin `vigencia`, 422.
3. Invalido: mismo codigo y vigencia, 409; vigencia fuera de rango, 422.

### 2.3 `PUT /api/impuestos/formatos/{codigo}`

**Proposito.** Modificar nombre, vigencia o estado del formato.

**Request.** `codigo` (path), `cia`, `vigencia` (query, identifica la fila) y
cuerpo `ExogenousFormatWrite` sin `codigo` ni `vigencia`.

**Response (200).** `{"item": {...}, "source": "formatos_exogenos"}`.

**Consume.** Impuestos: edicion del formato.

**Reglas.** La vigencia forma parte de la clave y viaja en la consulta. Un formato
con generaciones de medios en estado `Exportado` pasa a `activo: false` pero no se
retira (409 en el `DELETE`).

**Criterio de aceptacion**

1. Normal: cambio de nombre devuelve 200.
2. Vacio: combinacion codigo y vigencia inexistente, 404.
3. Invalido: `vigencia` distinta de la de la fila, 409; sin `cia`, 422.

### 2.4 `DELETE /api/impuestos/formatos/{codigo}`

**Proposito.** Dar de baja el formato.

**Request.** `codigo` (path), `cia`, `vigencia` (query), `motivo` (query).

**Response (204).**

**Consume.** Impuestos: "Eliminar formato" (`Impuestos.tsx:749-754`).

**Reglas.** Baja logica (`eliminado_en`). 409 si el formato tiene generaciones
`Exportado`: un medio ya presentado no se puede dejar sin su definicion. Los
conceptos y asignaciones se conservan.

**Criterio de aceptacion**

1. Normal: formato sin generaciones exportadas se retira y desaparece del `GET`.
2. Vacio: 404.
3. Invalido: formato con generacion exportada, 409; sin `motivo`, 422.

### 2.5 `PUT /api/impuestos/formatos/{codigo}/conceptos`

**Proposito.** Reemplazar la lista de conceptos del formato.

**Request.** `codigo` (path), `cia`, `vigencia` (query), y cuerpo
`FormatConceptList`: `conceptos` (`list[FormatConceptWrite]`, `max_length=200`,
con `codigo`, `nombre`, `tarifa` y `cuenta`), `usuario`, `motivo`. `dryRun`
(query).

**Response (200)**

```json
{ "item": { "codigo": "F1001", "vigencia": 2026, "conceptos": 3, "creados": 1, "actualizados": 2, "retirados": 0 }, "source": "formato_conceptos" }
```

**Consume.** Impuestos, paso "Conceptos".

**Reglas.** Reemplazo en bloque dentro de una transaccion, con el conteo de
creados, actualizados y retirados. La cuenta, si viene, debe existir. Un concepto
con filas generadas no se retira del formato: se conserva y se reporta en
`retenidos` con su causa (la historia del medio no puede perder su concepto).

**Criterio de aceptacion**

1. Normal: lista de cuatro conceptos devuelve 200 con los conteos y el paso
   "Conceptos" muestra la lista nueva.
2. Vacio: lista vacia retira todos los conceptos que no tengan filas generadas.
3. Invalido: dos conceptos con el mismo codigo, 422; cuenta inexistente, 422;
   `tarifa` mayor que 1, 422.

### 2.6 `PUT /api/impuestos/formatos/{codigo}/asignaciones`

**Proposito.** Reemplazar las cuentas del plan asignadas al formato.

**Request.** `codigo` (path), `cia`, `vigencia` (query), y cuerpo
`FormatAssignmentList`: `cuentas`
(`list[str]`, cada una `pattern=r"^[0-9]{1,12}$"`, `max_length=2000`), `usuario`,
`motivo`. `dryRun` (query).

**Response (200)**

```json
{ "item": { "codigo": "F1001", "vigencia": 2026, "asignadas": 2, "creadas": 1, "retiradas": 1 }, "source": "formato_asignaciones" }
```

**Consume.** Impuestos, paso "Asignacion cuentas" (arbol con checkbox,
`ASIG_INICIALES` en `Impuestos.tsx:54-59`).

**Reglas.** Reemplazo en bloque: el arbol manda la lista completa, que es lo que
evita tener que interpretar altas y bajas sueltas. Cada cuenta debe existir en el
plan de la compania (FK, `06_impuestos.sql:45-47`). El complemento lo aporta
`GET /api/cuentas` (`backend/app.py:1050`), que ya existe.

**Criterio de aceptacion**

1. Normal: marcar una cuenta nueva y desmarcar otra devuelve 200 con los conteos
   y el arbol queda como el usuario lo dejo.
2. Vacio: lista vacia deja el formato sin asignaciones, 200.
3. Invalido: cuenta inexistente, 422; cuenta repetida en la lista, 422; sin
   `cia`, 422.

### 2.7 `POST /api/impuestos/formatos/copiar`

**Proposito.** Copiar las definiciones de exogena de otra compania.

**Request.** `cia` (destino), y cuerpo `FormatCopyRequest`: `ciaOrigen`
(`pattern=r"^[0-9]{1,3}$"`), `vigenciaOrigen` y `vigenciaDestino` (`ge=1900`,
`le=2100`), `formatos` (opcional: si no viene, copia todos los activos),
`usuario`, `motivo`, `reemplazar` (booleano). `dryRun` (query).

**Response (200)**

```json
{
  "item": { "ciaOrigen": "002", "ciaDestino": "001", "formatos": 3, "conceptos": 12, "asignaciones": 41, "reemplazados": 0, "dryRun": false },
  "source": "formatos_exogenos"
}
```

**Consume.** Impuestos: "Copiar definiciones" (`Impuestos.tsx:304-310`, hoy
`COPIA_DEFINICIONES` en memoria).

**Reglas**

- Es una copia de definiciones, no de datos: no toca `generaciones_medios` ni
  `medio_filas`.
- La compania de origen debe existir y ser distinta de la de destino (422).
- Sin `reemplazar`, un formato que ya existe en el destino se deja intacto y se
  informa en el conteo; con `reemplazar`, se reemplaza y se informa cuantos.
- Las cuentas del origen se traducen por **codigo** de cuenta, que es comun entre
  companias; si una cuenta del origen no existe en el destino, el formato se copia
  sin esa asignacion y la respuesta la lista en `cuentasNoEncontradas`.
- Toda la copia en una transaccion, con `dryRun` y una fila de `auditoria` con
  los conteos y el motivo.

**Criterio de aceptacion**

1. Normal: copiar tres formatos de la compania 002 a la 001 devuelve 200 con los
   conteos y el paso "Formatos" de la 001 muestra los tres.
2. Vacio: origen sin formatos activos devuelve 200 con todo en cero.
3. Invalido: origen igual a destino, 422; origen inexistente, 404; sin `motivo`,
   422; `dryRun=true` no escribe.

---

## 3. Generacion y revision del medio magnetico

### 3.1 `GET /api/impuestos/medios`

**Proposito.** Listar las generaciones de medios con su numero y su estado.

**Request.** `cia`, `anio` (obligatorio: la clave del modelo es compania, ano y
numero de generacion, `06_impuestos.sql:68`).

**Response (200)**

```json
{
  "items": [{ "id": 1, "numeroGeneracion": 1, "anio": 2026, "estado": "Generado", "generadoEn": "2026-02-15T14:22:00", "formatos": 3, "registros": 142, "cuadrado": true }],
  "count": 1,
  "source": "generaciones_medios"
}
```

**Consume.** Impuestos, pasos "Generacion", "Revision" y "Exportacion"
(`VERSIONES_INICIALES` en `Impuestos.tsx:78-80`).

**Reglas.** `numeroGeneracion` es el numero de generacion del ano; no se reutiliza
tras una exportacion. `cuadrado` viene de `medio_conciliaciones`, no de un
calculo de la interfaz.

**Criterio de aceptacion**

1. Normal: devuelve la generacion con sus conteos y su cuadre.
2. Vacio: ano sin generaciones, `items: []`, `count: 0`.
3. Invalido: sin `anio`, 422; `anio` fuera de rango, 422.

### 3.2 `POST /api/impuestos/medios`

**Proposito.** Generar el medio magnetico del ano a partir del movimiento.

**Request.** `cia` mas cuerpo `MediumGenerationRequest`: `anio`, `vigencia`,
`formatos` (opcional: si no viene, todos los activos), `usuario`, `motivo`.
`dryRun` (query).

**Response (201)**

```json
{
  "item": { "id": 2, "numeroGeneracion": 2, "anio": 2026, "estado": "Generado", "formatos": 3, "registros": 142, "totalContable": 22600000.0, "exclusiones": 2400000.0, "topes": 1800000.0, "totalReportado": 17900000.0, "cuadrado": true },
  "source": "generaciones_medios"
}
```

**Consume.** Impuestos: "Generar medios magneticos" (`Impuestos.tsx:207-215`,
hoy `setTimeout`).

**Reglas**

- Escribe `generaciones_medios`, las filas en `medio_filas` y el cuadre en
  `medio_conciliaciones`, todo en una transaccion.
- `numeroGeneracion` se calcula como el siguiente de la compania y el ano (la
  clave unica del modelo lo garantiza, `06_impuestos.sql:68`).
- Las exclusiones y los topes salen de `medio_topes` (ruta 3.6) y de la
  asignacion de cuentas (2.6): una cuenta no asignada a ningun formato queda como
  exclusion, no como error.
- Si la conciliacion no cuadra, la generacion queda `Generado` con
  `cuadrado: false` y la interfaz muestra la diferencia; no se rechaza la
  generacion (es un informe, no una contabilizacion).
- `dryRun` devuelve el mismo informe sin escribir, que es lo que permite revisar
  antes de exportar.

**Criterio de aceptacion**

1. Normal: generar con 142 registros devuelve 201 con el cuadre y el paso
   "Revision" muestra las filas.
2. Vacio: ano sin movimiento devuelve 201 con `registros: 0` y `cuadrado: true`.
3. Invalido: `anio` fuera de rango, 422; sin `motivo`, 422; `dryRun=true` deja
   `GET /api/impuestos/medios` sin la generacion.

### 3.3 `GET /api/impuestos/medios/{id}`

**Proposito.** Consultar las filas de una generacion para revisarlas.

**Request.** `id` (path, `ge=1`), `cia`, y los filtros de revision: `formato`,
`nit` y `page`/`pageSize` (`le=500`, como el detalle de lote, `backend/app.py:777`).

**Response (200)**

```json
{
  "items": [
    { "id": 11, "formato": "F1001", "nit": "800100200", "nombre": "EMPRESA ABC COMERCIAL S.A.S.", "concepto": "HON", "cuenta": "236525", "base": 15000000.0, "tarifa": 0.1, "valor": 1500000.0, "ajustado": false }
  ],
  "count": 1,
  "source": "medio_filas"
}
```

**Consume.** Impuestos, paso "Revision" (`FILAS_MEDIO_INICIALES`,
`Impuestos.tsx:84-88`).

**Reglas.** Paginado: un medio real tiene miles de filas y no se sirve completo.
`ajustado` distingue la fila que el contador corrigio.

**Criterio de aceptacion**

1. Normal: devuelve las filas del formato filtrado.
2. Vacio: generacion sin filas, `items: []`.
3. Invalido: `id` inexistente o de otra compania, 404; `pageSize` mayor que 500,
   422.

### 3.4 `PUT /api/impuestos/medios/{id}/filas/{filaId}`

**Proposito.** Ajustar una fila revisada del medio.

**Request.** `id` y `filaId` (path, `ge=1`), `cia`, y cuerpo `MediumRowWrite`:
`valor` (opcional), `base` (opcional), `concepto` (opcional), `motivo`
(obligatorio, `5..180`), `usuario`.

**Response (200)**

```json
{ "item": { "id": 11, "valor": 1400000.0, "base": 15000000.0, "ajustado": true }, "source": "medio_filas" }
```

**Consume.** Impuestos, paso "Revision": edicion de la fila.

**Reglas.** Solo se ajusta mientras la generacion no este `Exportado`: en
`Exportado`, 409 (un medio presentado no se edita; se genera una version nueva).
La fila queda `ajustado = true` y el ajuste entra en `medio_conciliaciones.ajustes`.
El motivo es obligatorio porque el ajuste cambia lo que se declara.

**Criterio de aceptacion**

1. Normal: bajar el valor de una fila devuelve 200, la marca `ajustado` queda y
   la conciliacion refleja el ajuste en `ajustes`.
2. Vacio: fila inexistente, 404.
3. Invalido: sin `motivo`, 422; `valor` negativo, 422; generacion exportada, 409.

### 3.5 `GET /api/impuestos/medios/{id}/conciliacion`

**Proposito.** Ver el cuadre del medio: total contable, exclusiones, topes,
ajustes y total reportado.

**Request.** `id` (path), `cia`.

**Response (200)**

```json
{
  "item": { "totalContable": 22600000.0, "exclusiones": 2400000.0, "topes": 1800000.0, "ajustes": 0.0, "totalReportado": 17900000.0, "cuadrado": true },
  "source": "medio_conciliaciones"
}
```

**Consume.** Impuestos, paso "Topes y cruces" (`CRUCES_INICIALES` y
`TOTAL_CONTABLE` en `Impuestos.tsx:98-104`).

**Reglas.** Los cinco valores se calculan al generar y se guardan; esta ruta no
recalcula. Los cruces por tercero entre formatos (por ejemplo 1001 contra 1007)
salen de `medio_filas` agrupando por `formato` y `tercero`, no de datos fijos.

**Criterio de aceptacion**

1. Normal: devuelve los cinco valores y `cuadrado` coherente con ellos.
2. Vacio: generacion sin movimiento, todos en cero y `cuadrado: true`.
3. Invalido: `id` inexistente, 404; sin `cia`, 422.

### 3.6 `PUT /api/impuestos/topes`

**Proposito.** Reemplazar los topes por formato y concepto del ano.

**Request.** `cia` mas cuerpo `MediumCapList`: `anio`, `topes`
(`list[MediumCapWrite]`, `max_length=500`, con `formato`, `concepto`, `tope`),
`usuario`, `motivo`. `dryRun` (query).

**Response (200)**

```json
{ "item": { "anio": 2026, "creados": 2, "actualizados": 1, "retirados": 1 }, "source": "medio_topes" }
```

**Consume.** Impuestos, paso "Topes y cruces" (`TOPES_INICIALES`,
`Impuestos.tsx:92-96`).

**Reglas.** Reemplazo en bloque. El tope es `dinero` y no puede ser negativo. La
unicidad del modelo es compania, ano, formato y concepto
(`06_impuestos.sql:97`), con el concepto opcional. Los topes no se aplican hacia
atras: rigen la proxima generacion y la generacion en estado `Generado`, no una
`Exportado` (si la generacion ya esta exportada, el cambio exige una generacion
nueva; la respuesta lo advierte).

**Criterio de aceptacion**

1. Normal: reemplazar los topes devuelve 200 con los conteos y la siguiente
   generacion los refleja en `topes`.
2. Vacio: lista vacia retira todos los topes del ano, 200.
3. Invalido: tope negativo, 422; formato inexistente, 422; sin `motivo`, 422.

### 3.7 `GET /api/impuestos/medios/{id}/exportar`

**Proposito.** Descargar el medio magnetico generado.

**Request.** `id` (path), `cia`, `formato`
(`Literal["xml", "csv", "xlsx"]`, obligatorio) y `formatoExogeno` (opcional, para
exportar un solo formato del medio).

**Response (200).** Archivo, no JSON.

**Consume.** Impuestos, paso "Exportacion" y "Descargar" (`Impuestos.tsx:1164-1167`).

**Reglas.** Exportar marca la generacion como `Exportado`
(`06_impuestos.sql:62`) y una generacion exportada no vuelve a `Generado` ni se
edita: la reexportacion del mismo `id` es un `GET` y no cambia estado. Antes de
exportar, el cuadre no tiene que estar en verde, pero la respuesta incluye la
cabecera `X-Conciliacion-Cuadrado` con el valor, para que la interfaz lo pueda
advertir. La exportacion deja fila en `auditoria`.

**Criterio de aceptacion**

1. Normal: exportar devuelve el archivo y el `GET` de 3.1 muestra la generacion
   en `Exportado`.
2. Vacio: generacion con cero registros exporta un archivo con encabezados.
3. Invalido: `formato` distinto de `xml`, `csv` o `xlsx`, 422; `id` inexistente,
   404; exportar una generacion que genero otra compania, 404.

---

## 4. Especiales: cuentas en cero (H6)

### 4.1 `GET /api/especiales/cuentas-en-cero`

**Proposito.** Analizar que cuentas del plan estan sin saldo y sin movimiento.

**Request.** `cia` (query, obligatorio), `anio` (`ge=1900`, `le=2100`),
`incluirNoAfectables` (booleano, por defecto `false`), `page` y `pageSize`
(`le=500`).

**Response (200)**

```json
{
  "items": [
    { "cuenta": "529595", "nombre": "OTROS GASTOS DIVERSOS", "nivel": 6, "afectable": true, "saldo": 0.0, "movimientos": 0, "tieneHijos": false, "eliminable": true }
  ],
  "count": 1,
  "resumen": { "revisadas": 4046, "enCero": 812, "eliminables": 640, "conHijos": 172 },
  "source": "cuentas"
}
```

**Consume.** Especiales, seccion "Analizar plan" (`Especiales.tsx:40-44`).

**Reglas**

- Solo lectura y con `dryRun` implicito: no cambia nada.
- Una cuenta es eliminable si tiene saldo cero en el ano, ningun renglon en
  `documento_lineas` ni en `lote_lineas`, ningun acumulado distinto de cero y
  ningun hijo en la jerarquia. El campo `eliminable` lo dice por fila y el
  `resumen` da el total, que es el numero que la pantalla tiene que mostrar antes
  de la confirmacion.
- En Advantage se lee de `CONMAE` y del movimiento; el conteo de renglones por
  cuenta puede exigir recorrer `MOV01`, asi que la ruta admite `pageSize` alto y
  el trabajo masivo se hace con un script, no en el chat.

**Criterio de aceptacion**

1. Normal: devuelve las cuentas en cero con `eliminable` y el resumen.
2. Vacio: compania sin cuentas en cero, `items: []` y resumen en cero.
3. Invalido: sin `cia`, 422; `anio` fuera de rango, 422.

### 4.2 `POST /api/especiales/cuentas-en-cero/eliminar`

**Proposito.** Eliminar las cuentas en cero confirmadas, con registro real del
motivo.

**Request.** `cia` mas cuerpo `ZeroAccountRemoval`: `anio`, `cuentas`
(`list[str]`, cada una `pattern=r"^[0-9]{1,12}$"`, `min_length=1`), `usuario`,
`motivo` (`10..180`, obligatorio: la pantalla ya exige ese minimo,
`Especiales.tsx:97-105`) y `confirmacion` (texto literal `ELIMINAR`). `dryRun`
(query).

**Response (200)**

```json
{
  "item": { "solicitadas": 12, "eliminadas": 11, "rechazadas": [{ "cuenta": "529595", "detalle": "tiene 3 movimientos" }], "respaldo": true, "dryRun": false },
  "source": "cuentas"
}
```

**Consume.** Especiales: "Ejecutar funcion" (`Especiales.tsx:58-69`), que hoy
corre una barra de progreso sobre `setInterval` y afirma que la accion "quedo
registrada en la bitacora".

**Reglas**

- Revalida cada cuenta en el servidor: una cuenta que dejo de estar en cero entre
  el analisis y la ejecucion se rechaza con su causa, no se elimina.
- Todo en una transaccion, con `dryRun`, `motivo` y `confirmacion`: es la
  operacion mas destructiva del plan y la pantalla ya exige escribir la palabra.
- El motivo **si** queda registrado: en PostgreSQL en `auditoria`
  (`db/postgresql/schema/08_seguridad.sql:56`) y en Advantage en `VISAUDI`
  (`backend/auditoria_repository.py`). Mientras D6 no exista, la frase de la
  pantalla sobre la bitacora se retira: es la indicacion expresa de la auditoria
  para H6.
- En Advantage hay que implementar `delete_account`, que no existe hoy en ningun
  repositorio; la rama se declara junto con la tabla de cuentas del legado.
- Si la cuenta tiene hijos pero todos estan en cero y se incluyen en la misma
  lista, se eliminan de abajo hacia arriba en la misma transaccion.

**Criterio de aceptacion**

1. Normal: eliminar 12 cuentas en cero devuelve 200 con 11 eliminadas, 1
   rechazada con su causa, y la bitacora muestra el motivo por cuenta.
2. Vacio: lista vacia devuelve 422 (`min_length=1`).
3. Invalido: cuenta con saldo distinto de cero, 409; cuenta con movimientos,
   409; sin `confirmacion`, 422; `dryRun=true` no elimina y devuelve el mismo
   informe.
