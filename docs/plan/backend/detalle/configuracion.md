# Detalle: configuracion por compania (bloque B3)

Veintitres rutas nuevas para las seis pantallas que hoy escriben en
`localStorage`: Companias, ConfigIVA, ConfigRetenciones, RenglonesRenta,
Plantillas y FormatosDocumentales. Cierra H3 y la parte de alta y baja de H4.

Las diez tablas que usan ya existen y todas tienen contraparte legada nombrada en
`db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`. No hay DDL nuevo en este archivo. La unica
excepcion de motor es el alta y la baja de compania, que es `solo PostgreSQL`.

---

## 0. Patron comun a las seis pantallas

Para no repetir en cada ruta lo que es identico en las veintitres:

- **Autenticacion del cambio.** `GET` no exige actor; `POST`, `PUT` y `DELETE`
  reciben `usuario` (hasta 4 caracteres, `backend/app.py:144`) o lo toman del
  contexto de sesion cuando D5 exista. Las bajas reciben ademas `motivo`
  (5 a 180 caracteres, `backend/app.py:161-173`).
- **Compania.** Salvo en companias, todas las rutas exigen
  `cia` (query, `pattern=r"^[0-9]{1,3}$"`) y lo devuelven en `source` como la
  tabla del motor activo.
- **Forma de las respuestas.** Lista:
  `{"items": [...], "count": n, "source": "TABLA"}` (`backend/app.py:1050-1059`).
  Elemento: `{"item": {...}, "source": "TABLA"}` (`backend/app.py:785-795`).
  Baja: 204 sin cuerpo (`backend/app.py:881-891`).
- **Baja logica.** Salvo en companias, el `DELETE` marca `eliminado_en`, no
  retira la fila: el codigo queda reservado y no se puede reutilizar para otra
  definicion (las siete tablas tienen `eliminado_en`).
- **Porcentajes como fraccion.** `tarifa` viaja como fraccion
  (`porcentaje = numeric(9,6)`, `db/postgresql/schema/01_dominios.sql:15`), con
  `ge=0` y `le=1`: 19 % es `0.19`. La conversion 19 a 0.19 es la misma que declara
  la guia del diccionario (`db/advantage/01_tablas.sql:59`) y evita el error que
  la matriz ya señala para `CONTIIVA` y `CONTIRET` ("mapear VLRPOR de porcentaje a
  fraccion").
- **Codigos de error.** 404 si el codigo no existe en `PUT` y `DELETE`; 409 si el
  codigo ya existe o si la fila tiene dependencias; 422 si falla una validacion.
  Todo por `_service_error` (`backend/app.py:245-269`).
- **Auditoria.** En PostgreSQL la dejan los disparadores de fila y la accion
  sensible inserta en `auditoria`; en ADS la deja
  `backend/auditoria_repository.py` en `VISAUDI`.
- **Aceptacion.** Los tres casos de cada ruta son siempre los mismos: crear o
  modificar un registro valido y verlo despues por el `GET`; operar sobre una
  compania sin filas (la lista devuelve `items: []`, `count: 0`, y el `PUT` o
  `DELETE` devuelve 404); y un caso invalido propio de la tabla, que se enumera
  en cada ruta.

---

## 1. Companias (H4)

Cierra el ciclo de la pantalla de Companias. Decision de producto que el plan
toma y documenta: **el alta de companias es de la aplicacion**, porque la
auditoria deja las dos opciones abiertas (`AUDITORIA_FUNCIONALIDAD.md:249-252`) y
el modelo ya tiene la tabla y los dos anos (`companias`, `compania_anios`). La
consecuencia es que `/api/companias` devuelve tambien las creadas aqui, y que la
rama de Advantage sigue siendo de solo lectura: en el legado una compania es una
carpeta de tablas por empresa (`db/README.md:106-111`), no una fila.

### 1.1 `GET /api/companias` (existe, extension aditiva)

**Proposito.** Que el selector de ingreso y la pantalla de configuracion vean la
misma lista, incluidas las companias creadas desde la web.

**Request.** Sin parametros. La ruta existe (`backend/app.py:304`) y no cambia su
contrato.

**Response (200).** Se conservan las claves actuales y se anaden dos opcionales:

```json
{
  "items": [
    { "codigo": "001", "nombre": "Demo S.A.S.", "nit": "900123456", "soloConsolidacion": false, "anios": [2025, 2026] }
  ],
  "count": 1,
  "source": "companias"
}
```

**Consume.** Companias: lista y avisos (`Companias.tsx:175-194`), y el selector de
ingreso (`SeleccionCompania`, 1 de 4 controles conectado).

**Reglas.** Solo se anaden claves: ningun consumidor existente pierde nada (R2).
En ADS el `source` sigue siendo `CONEMP`.

**Aceptacion.** Normal: una compania creada por el `POST` aparece en la lista y
en el selector. Vacio: instalacion sin companias devuelve `items: []`, `count: 0`.
Invalido: no aplica (sin parametros).

### 1.2 `POST /api/companias`

**Proposito.** Crear una compania con su primer ano de operacion.

**Request.** Cuerpo `CompanyCreate`: `codigo` (`pattern=r"^[0-9]{1,3}$"`, el
`EMPCOD` de 3 posiciones), `nombre` (`1..40`), `nit` (`1..15`), `digito`
(`0..1`), `soloConsolidacion` (booleano, por defecto `false`) y `anio` (entre
1900 y 2999), mas `usuario` y `motivo`, siguiendo los campos de la tabla
(`db/postgresql/schema/02_nucleo.sql:11-30`).

**Response (201)**

```json
{ "item": { "codigo": "002", "nombre": "Filial S.A.S.", "estado": "Activa", "anios": [2026] }, "source": "companias" }
```

**Consume.** Companias: "Crear" (`Companias.tsx:181-183`), hoy con aviso
"Compania X creada" sobre `localStorage`.

**Reglas.** Unicidad de `codigo` (409). Se crea el ano en `compania_anios` y,
si el usuario lo pide, los periodos `00` a `18` en `periodos_contables`
(`db/postgresql/schema/02_nucleo.sql:52-62`). En Advantage devuelve 503 con el
mensaje de la rama no implementada, no un error generico. No se permite NIT
repetido con el mismo digito en la misma instalacion (la matriz lo declara como
brecha de CONEMP): 409.

**Aceptacion.** Normal: compania nueva de 3 digitos devuelve 201 y aparece en el
selector tras recargar. Vacio: sin `anio` devuelve 422. Invalido: `codigo` de mas
de 3 caracteres o no numerico devuelve 422; `codigo` repetido, 409; con el motor
en Advantage, 503 declarado.

### 1.3 `PUT /api/companias/{codigo}`

**Proposito.** Modificar nombre, NIT, digito y estado de la compania.

**Request.** `codigo` (path, `pattern=r"^[0-9]{1,3}$"`) y cuerpo
`CompanyWrite`: `nombre`, `nit`, `digito`, `estado`
(`Literal["Activa", "Inactiva"]`), `soloConsolidacion`, mas `usuario` y `motivo`.

**Response (200)**

```json
{ "item": { "codigo": "002", "nombre": "Filial S.A.S.", "estado": "Inactiva" }, "source": "companias" }
```

**Consume.** Companias: "Guardar" (`Companias.tsx:175-186`).

**Reglas.** El codigo es inmutable (viene en la ruta, no en el cuerpo;
`extra="forbid"`). Pasar a `Inactiva` no borra datos: solo la retira del selector
de ingreso. Si la compania tiene documentos contabilizados, `nit` no se puede
cambiar (409): la identidad fiscal de lo ya contabilizado no se reescribe desde
la configuracion.

**Aceptacion.** Normal: cambio de nombre devuelve 200 y el selector muestra el
nombre nuevo. Vacio: cuerpo `{}` devuelve 422. Invalido: `codigo` inexistente,
404; cambio de NIT con documentos, 409.

### 1.4 `DELETE /api/companias/{codigo}`

**Proposito.** Dar de baja una compania sin movimiento.

**Request.** `codigo` (path), `motivo` (query, obligatorio) y `dryRun`
(opcional), siguiendo `backend/app.py:703`.

**Response (204).** Sin cuerpo.

**Consume.** Companias: confirmacion de eliminacion (`Companias.tsx:380-383`),
hoy solo estado local.

**Reglas.** Se rechaza con 409 si la compania tiene documentos, lotes o saldos
(la consulta de comprobacion se hace con las rutas que ya existen: `GET
/api/documentos`, `GET /api/lotes` y el balance). La baja es logica
(`companias.estado = 'Inactiva'` mas `eliminado_en` si se decide retirarla del
todo): el modelo no tiene borrado fisico de companias y el libro no puede perder
la identidad de sus documentos.

**Aceptacion.** Normal: compania sin movimiento se retira del selector y devuelve
204. Vacio: `dryRun=true` informa cuantos documentos la bloquean. Invalido:
compania con documentos, 409; sin `motivo`, 422.

---

## 2. ConfigIVA: `tarifas_iva`

### 2.1 `GET /api/tarifas-iva`

**Proposito.** Listar las tarifas de IVA de la compania.

**Request.** `cia` (query, obligatorio).

**Response (200)**

```json
{
  "items": [{ "codigo": "IV19", "nombre": "IVA 19%", "tarifa": 0.19, "cuenta": "240805", "nombreCuenta": "IVA por pagar" }],
  "count": 1,
  "source": "tarifas_iva"
}
```

**Consume.** ConfigIVA: carga inicial (`ConfigIVA.tsx:24-27`), hoy
`localStorage.getItem`.

**Reglas.** Excluye las filas con `eliminado_en`. `nombreCuenta` sale del plan de
cuentas de la compania, como ya hace la lectura de terceros con
`nombreCuenta` (`backend/documentos_repository.py:262-272`).

**Aceptacion.** Normal: devuelve las tarifas sembradas. Vacio: compania sin
tarifas devuelve `items: []`, `count: 0`. Invalido: sin `cia`, 422.

### 2.2 `POST /api/tarifas-iva`

**Proposito.** Crear una tarifa de IVA.

**Request.** `cia` mas cuerpo `VatRateWrite`: `codigo` (`1..10`), `nombre`
(`1..40`), `tarifa` (fraccion, `ge=0`, `le=1`), `cuenta` (opcional,
`pattern=r"^[0-9]{1,12}$"`), `usuario`.

**Response (201)**

```json
{ "item": { "codigo": "IV05", "nombre": "IVA 5%", "tarifa": 0.05, "cuenta": "240805" }, "source": "tarifas_iva" }
```

**Consume.** ConfigIVA: "Guardar" y "Crear".

**Reglas.** Unicidad `(compania_id, codigo)` (409). La cuenta, si viene, debe
existir en el plan de la compania. La tarifa no puede ser negativa ni mayor que 1
(422): el valor de mas de 1 es el error tipico de enviar 19 en lugar de 0.19, y
el modelo lo corta.

**Aceptacion.** Normal: `IV05` con `0.05` devuelve 201 y aparece en el `GET`.
Vacio: compania nueva sin tarifas no bloquea la creacion de la primera. Invalido:
`codigo` repetido, 409; `tarifa: 19`, 422; cuenta inexistente, 422.

### 2.3 `PUT /api/tarifas-iva/{codigo}`

**Proposito.** Modificar nombre, tarifa o cuenta de la tarifa.

**Request.** `codigo` (path), `cia` y cuerpo `VatRateWrite` sin `codigo`.

**Response (200).** `{"item": {...}, "source": "tarifas_iva"}`.

**Consume.** ConfigIVA: "Guardar".

**Reglas.** Cambiar la tarifa no reescribe lo ya contabilizado: la clase de IVA
del renglon (`documento_lineas.clase`) es historia. Si se cambia la tarifa de una
tarifa en uso, la respuesta incluye `"advertencia"` con los periodos en que se
uso, para que la interfaz lo muestre. El codigo no es modificable.

**Aceptacion.** Normal: cambio de nombre devuelve 200. Vacio: ninguna tarifa
coincide, 404. Invalido: `tarifa` fuera de rango, 422.

### 2.4 `DELETE /api/tarifas-iva/{codigo}`

**Proposito.** Dar de baja la tarifa.

**Request.** `codigo` (path), `cia`, `motivo` (query).

**Response (204).** Sin cuerpo.

**Consume.** ConfigIVA: "Eliminar".

**Reglas.** Baja logica. Se rechaza con 409 si la tarifa esta referenciada por un
renglon contabilizado (`documento_lineas.clase = 'IVA'` y el concepto): la
historia tributaria no puede quedar apuntando a una tarifa que ya no existe. El
camino es dejarla inactiva.

**Aceptacion.** Normal: tarifa sin uso desaparece del `GET` y devuelve 204.
Vacio: codigo inexistente, 404. Invalido: tarifa en uso, 409; sin `motivo`, 422.

---

## 3. ConfigRetenciones: `conceptos_retencion`

Misma forma que ConfigIVA; cambian los campos y dos reglas.

### 3.1 `GET /api/conceptos-retencion`

**Proposito.** Listar los conceptos de retencion de la compania.

**Request.** `cia` (query, obligatorio).

**Response (200)**

```json
{
  "items": [{ "codigo": "HON", "nombre": "Honorarios", "tarifa": 0.1, "baseMinima": 0.0, "cuenta": "236525", "nombreCuenta": "Retencion honorarios" }],
  "count": 1,
  "source": "conceptos_retencion"
}
```

**Consume.** ConfigRetenciones: carga inicial (`ConfigRetenciones.tsx:24-27`).

**Reglas.** Excluye `eliminado_en`. `baseMinima` es `dinero` y viaja como numero
con dos decimales (`db/postgresql/schema/03_maestros.sql:187`).

**Aceptacion.** Normal, vacio e invalido iguales a 2.1.

### 3.2 `POST /api/conceptos-retencion`

**Proposito.** Crear un concepto de retencion.

**Request.** `cia` mas cuerpo `RetentionConceptWrite`: `codigo` (`1..10`),
`nombre` (`1..40`), `tarifa` (fraccion), `cuenta` (opcional), `baseMinima`
(`Decimal`, `ge=0`), `usuario`.

**Response (201)**

```json
{ "item": { "codigo": "HON", "nombre": "Honorarios", "tarifa": 0.1, "baseMinima": 0.0, "cuenta": "236525" }, "source": "conceptos_retencion" }
```

**Consume.** ConfigRetenciones: "Guardar" y "Crear".

**Reglas.** Unicidad por compania y codigo (409). La `baseMinima` no puede ser
negativa (422). Si el concepto es de renta, `cuenta` es obligatoria (la tabla la
admite opcional y la pantalla exige cuenta al confirmar): 422 sin cuenta.

**Aceptacion.** Normal: concepto nuevo devuelve 201 y aparece en el `GET`.
Vacio: sin `cuenta` devuelve 422. Invalido: `tarifa` mayor que 1, 422; codigo
repetido, 409; `baseMinima` negativa, 422.

### 3.3 `PUT /api/conceptos-retencion/{codigo}`

**Proposito.** Modificar tarifa, base o cuenta del concepto.

**Request.** `codigo` (path), `cia` y cuerpo `RetentionConceptWrite` sin
`codigo`.

**Response (200).** `{"item": {...}, "source": "conceptos_retencion"}`.

**Consume.** ConfigRetenciones: "Guardar".

**Reglas.** Las mismas de inmutabilidad de historia que 2.3: el cambio de tarifa
aplica a lo que se capture, no a lo acumulado (`acumulados_retencion`).

**Aceptacion.** Normal: cambio de tarifa devuelve 200. Vacio: 404. Invalido: 422
por tarifa fuera de rango.

### 3.4 `DELETE /api/conceptos-retencion/{codigo}`

**Proposito.** Dar de baja el concepto.

**Request.** `codigo` (path), `cia`, `motivo`.

**Response (204).**

**Consume.** ConfigRetenciones: "Eliminar".

**Reglas.** Baja logica. 409 si el concepto aparece en `acumulados_retencion` o en
un renglon contabilizado; en ese caso se marca inactivo. Esta es la misma
condicion que la matriz declara para CONRET: "preservar bases, periodo, concepto
y ajustes" (`db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`).

**Aceptacion.** Normal: concepto sin uso se retira. Vacio: 404. Invalido: en uso,
409; sin `motivo`, 422.

---

## 4. RenglonesRenta: `renglones_renta`

### 4.1 `GET /api/renglones-renta`

**Proposito.** Listar los renglones de renta con su cuenta y su signo.

**Request.** `cia` (query, obligatorio).

**Response (200)**

```json
{
  "items": [{ "codigo": "R01", "nombre": "Ingresos brutos", "cuenta": "410505", "nombreCuenta": "Ingresos", "signo": 1 }],
  "count": 1,
  "source": "renglones_renta"
}
```

**Consume.** RenglonesRenta: carga inicial (`RenglonesRenta.tsx:24-27`). Es la
pantalla con mas controles locales y sin ninguna conexion (23 de 23).

**Reglas.** `signo` es 1 o -1
(`db/postgresql/schema/03_maestros.sql:224`) y viaja como entero, no como texto.

**Aceptacion.** Normal, vacio e invalido iguales a 2.1.

### 4.2 `POST /api/renglones-renta`

**Proposito.** Crear un renglon de renta.

**Request.** `cia` mas cuerpo `IncomeLineWrite`: `codigo` (`1..10`), `nombre`
(`1..60`), `cuenta` (`pattern=r"^[0-9]{1,12}$"`), `signo`
(`Literal[1, -1]`), `usuario`.

**Response (201)**

```json
{ "item": { "codigo": "R02", "nombre": "Devoluciones", "cuenta": "417505", "signo": -1 }, "source": "renglones_renta" }
```

**Consume.** RenglonesRenta: "Guardar" y "Crear".

**Reglas.** Unicidad por compania y codigo (409). La cuenta es obligatoria y debe
existir en el plan: sin cuenta el renglon no se puede calcular. Una cuenta no
puede estar en dos renglones con signos distintos (409): partiria el saldo.

**Aceptacion.** Normal: renglon nuevo devuelve 201 y aparece en el `GET`. Vacio:
sin `cuenta`, 422. Invalido: `signo: 0`, 422; cuenta ya usada con otro signo, 409.

### 4.3 `PUT /api/renglones-renta/{codigo}`

**Proposito.** Modificar nombre, cuenta o signo del renglon.

**Request.** `codigo` (path), `cia` y cuerpo `IncomeLineWrite` sin `codigo`.

**Response (200).** `{"item": {...}, "source": "renglones_renta"}`.

**Consume.** RenglonesRenta: "Guardar".

**Reglas.** Cambiar el signo o la cuenta no reescribe declaraciones anteriores:
el renglon es una definicion vigente. La respuesta informa el ano desde el que
aplica si la interfaz lo pide con `desde`.

**Aceptacion.** Normal: cambio de nombre devuelve 200. Vacio: 404. Invalido: 422
por signo invalido.

### 4.4 `DELETE /api/renglones-renta/{codigo}`

**Proposito.** Dar de baja el renglon.

**Request.** `codigo` (path), `cia`, `motivo`.

**Response (204).**

**Consume.** RenglonesRenta: "Eliminar".

**Reglas.** Baja logica. Un renglon usado en una declaracion presentada no se
retira: 409. La matriz declara que CONDECLA "necesita historial de definiciones y
reproduccion de resultados", asi que la baja no puede romper la reproduccion.

**Aceptacion.** Normal: retiro correcto. Vacio: 404. Invalido: en uso, 409; sin
`motivo`, 422.

---

## 5. Plantillas: `plantillas_contables` y `plantilla_lineas`

La plantilla lleva sus lineas en el cuerpo, como ya hace la importacion de lotes
(`ImportLotRequest.lineas`, `backend/app.py:214-223`): no se proponen rutas para
la coleccion hija.

### 5.1 `GET /api/plantillas-contables`

**Proposito.** Listar las plantillas con sus parejas de cuentas.

**Request.** `cia` (query, obligatorio).

**Response (200)**

```json
{
  "items": [
    {
      "codigo": "NOM2",
      "nombre": "Nomina mensual",
      "tipoDocumento": "NOM",
      "lineas": [{ "orden": 1, "cuentaDebito": "510506", "cuentaCredito": "250505", "concepto": "Sueldos" }]
    }
  ],
  "count": 1,
  "source": "plantillas_contables"
}
```

**Consume.** Plantillas: carga inicial (`Plantillas.tsx:31-34`); CapturaDirecta,
"F5 Plantilla" (bloque A4, `CapturaDirecta.tsx:77-87` y `418-432`).

**Reglas.** Las lineas son **parejas de cuentas**, no importes: es la correccion
B09 del modelo (`db/postgresql/schema/03_maestros.sql:234-237`, "el legado
PLANTICO/GRABAPLA guarda PAREJAS de cuentas (NOM/DEB/CRE), no importes fijos").
Devolver importes seria repetir el error del mock de la pantalla.

**Aceptacion.** Normal: devuelve plantillas con lineas ordenadas por `orden`.
Vacio: compania sin plantillas devuelve `items: []`, `count: 0`. Invalido: sin
`cia`, 422.

### 5.2 `POST /api/plantillas-contables`

**Proposito.** Crear una plantilla con sus lineas.

**Request.** `cia` mas cuerpo `TemplateWrite`: `codigo` (`1..10`), `nombre`
(`1..40`), `tipoDocumento` (codigo existente en `tipos_documento`), `lineas`
(`list[TemplateLineWrite]`, `min_length=2`, `max_length=80`, con `orden`,
`cuentaDebito`, `cuentaCredito`, `concepto`), `usuario`.

**Response (201)**

```json
{ "item": { "codigo": "NOM3", "nombre": "Nomina quincenal", "tipoDocumento": "NOM", "lineas": [ { "orden": 1, "cuentaDebito": "510506", "cuentaCredito": "250505", "concepto": "Sueldos" } ] }, "source": "plantillas_contables" }
```

**Consume.** Plantillas: "Crear" (`Plantillas.tsx:158-168`).

**Reglas.** Unicidad por compania y codigo (409). Cada cuenta de cada linea debe
existir y ser afectable (`cuentas.afectable`, `db/postgresql/schema/03_maestros.sql:16`);
si no, 422 con el numero de linea. `min_length=2` porque una plantilla de una
sola linea no puede cuadrar. El tipo de documento debe existir en la compania.

**Aceptacion.** Normal: plantilla de dos lineas devuelve 201 y aparece en el
`GET`. Vacio: `lineas: []` devuelve 422. Invalido: cuenta no afectable, 422;
`tipoDocumento` inexistente, 422; codigo repetido, 409.

### 5.3 `PUT /api/plantillas-contables/{codigo}`

**Proposito.** Modificar la plantilla y reemplazar sus lineas.

**Request.** `codigo` (path), `cia` y cuerpo `TemplateWrite` sin `codigo`.

**Response (200).** `{"item": {...}, "source": "plantillas_contables"}`.

**Consume.** Plantillas: "Guardar".

**Reglas.** Las lineas se reemplazan en bloque (borrar y volver a insertar dentro
de la transaccion): es lo que espera un editor de lineas y lo que evita ids
huerfanos. La plantilla usada en un lote ya contabilizado no se puede modificar
(409): la definicion vigente no puede cambiar lo ya capturado.

**Aceptacion.** Normal: cambio de nombre y de una linea devuelve 200 con las
lineas nuevas. Vacio: codigo inexistente, 404. Invalido: `lineas` de menos de
dos, 422; plantilla en uso, 409.

### 5.4 `DELETE /api/plantillas-contables/{codigo}`

**Proposito.** Dar de baja la plantilla.

**Request.** `codigo` (path), `cia`, `motivo`.

**Response (204).**

**Consume.** Plantillas: "Eliminar".

**Reglas.** Baja logica; las lineas hijas se conservan (el `ON DELETE CASCADE`
del modelo es para el borrado fisico, y aqui no se usa). Un lote creado desde la
plantilla no se toca.

**Aceptacion.** Normal: retiro correcto y la plantilla desaparece del `GET` que
alimenta "F5 Plantilla". Vacio: 404. Invalido: sin `motivo`, 422.

---

## 6. FormatosDocumentales: `formatos_documentales` y `formato_elementos`

Misma forma que Plantillas. El elemento es la unidad del editor visual de
impresion (`db/postgresql/schema/03_maestros.sql:280-293`).

### 6.1 `GET /api/formatos-documentales`

**Proposito.** Listar los formatos de impresion con sus elementos.

**Request.** `cia` (query, obligatorio).

**Response (200)**

```json
{
  "items": [
    {
      "codigo": "CE01",
      "nombre": "Comprobante de egreso",
      "comprobante": "CE",
      "elementos": [
        { "tipo": "Leyenda", "contenido": "COMPROBANTE DE EGRESO", "x": 10, "y": 8, "fuente": "Arial 10", "orden": 1 },
        { "tipo": "CampoDocumento", "contenido": "documento", "x": 10, "y": 16, "orden": 2 }
      ]
    }
  ],
  "count": 1,
  "source": "formatos_documentales"
}
```

**Consume.** FormatosDocumentales: carga inicial (`FormatosDocumentales.tsx:31-34`).

**Reglas.** `tipo` es uno de los ocho del `CHECK`
(`db/postgresql/schema/03_maestros.sql:283-285`). Las coordenadas van en la misma
unidad que el editor (decimal de 2 posiciones). El historico `formato_elementos`
no guarda version: el formato se reemplaza en bloque.

**Aceptacion.** Normal, vacio e invalido iguales a 5.1.

### 6.2 `POST /api/formatos-documentales`

**Proposito.** Crear un formato con sus elementos.

**Request.** `cia` mas cuerpo `DocumentFormatWrite`: `codigo` (`1..10`),
`nombre` (`1..40`), `comprobante` (opcional, codigo existente), `elementos`
(`list[FormatElementWrite]`, `min_length=1`, `max_length=200`, con `tipo`,
`contenido`, `x`, `y`, `ancho`, `alto`, `fuente`, `orden`), `usuario`.

**Response (201).** `{"item": {...}, "source": "formatos_documentales"}`.

**Consume.** FormatosDocumentales: "Crear".

**Reglas.** Unicidad por compania y codigo (409). `tipo` fuera de los ocho
valores, 422. El `comprobante` debe existir en la compania.

**Aceptacion.** Normal: formato nuevo devuelve 201 y aparece en el `GET`. Vacio:
`elementos: []` devuelve 422. Invalido: `tipo` desconocido, 422; `comprobante`
inexistente, 422; codigo repetido, 409.

### 6.3 `PUT /api/formatos-documentales/{codigo}`

**Proposito.** Modificar el formato y reemplazar sus elementos.

**Request.** `codigo` (path), `cia` y cuerpo `DocumentFormatWrite` sin `codigo`.

**Response (200).** `{"item": {...}, "source": "formatos_documentales"}`.

**Consume.** FormatosDocumentales: "Guardar".

**Reglas.** Los elementos se reemplazan en bloque dentro de la transaccion
(igual que 5.3 y por la misma razon). El formato usado para reimprimir un
documento historico se modifica sin reescribir nada: el formato es presentacion,
no dato contable, y asi se declara para que nadie lo trate como si lo fuera.

**Aceptacion.** Normal: cambio de un elemento devuelve 200 y el `GET` muestra la
geometria nueva. Vacio: 404. Invalido: `tipo` desconocido, 422.

### 6.4 `DELETE /api/formatos-documentales/{codigo}`

**Proposito.** Dar de baja el formato.

**Request.** `codigo` (path), `cia`, `motivo`.

**Response (204).**

**Consume.** FormatosDocumentales: "Eliminar".

**Reglas.** Baja logica; los elementos se conservan por si hay que reimprimir un
documento historico con el formato vigente en su fecha.

**Aceptacion.** Normal: retiro correcto. Vacio: 404. Invalido: sin `motivo`, 422.
