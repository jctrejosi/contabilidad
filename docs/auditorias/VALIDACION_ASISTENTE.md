# Validación del asistente: las ocho herramientas de la ola 1

## 1. Ficha

**Objeto.** Comprobar si el asistente responde de verdad, desde la perspectiva
del usuario, para las ocho herramientas de solo texto declaradas en
`plan/bot/HERRAMIENTAS_PRIORIZADAS.md` apartado 3.1 e implementadas en
`ia-service/app/tools.py`: `consultar_periodo_operacion`,
`consultar_parametros_operacion`, `listar_companias`, `buscar_tercero`,
`consultar_comprobantes`, `consultar_tipos_documento`, `consultar_centros` y
`verificar_lote`.

**Alcance.** Preguntas naturales enviadas a `POST /chat` del `ia-service`
(no llamadas directas a los handlers), con el `context` de sesión armado
(compañía, compañíaNombre, período, usuario). Se prueba contra las dos bases:
`contabdsi` (demostración, compañía `001`) y `contabdsi_datos` (migrada,
compañía `27`). Se incluyen preguntas trampa y la comprobación de `GET /health`.
Quedan fuera: el render del `payload` en el widget (fase 2, no existe), los
endpoints que ninguna herramienta usa y cualquier operación de escritura.

**Método.**

1. Entorno levantado a mano: PostgreSQL con `db/postgresql`
   (`docker compose up -d --wait`, contenedor `contabdsi-db`, puerto 5433),
   backend con `uvicorn backend.app:app` en 8001 y `ia-service` con
   `uvicorn app.main:app` en 8003. El `ia-service/.env` existente no se leyó ni
   se modificó: solo lo consume el propio proceso.
2. `GET /health` del `ia-service`.
3. Catorce preguntas por base, en secuencia, con el mismo `context` de sesión.
   Para cada una se registró: la pregunta, si el modelo invocó herramienta y
   cuál (leído del log del servicio, línea `ia-service.deepseek INFO tool ...`),
   si llegó `payload` y el texto de la respuesta.
4. Con la base migrada se repitió la batería apuntando el backend a
   `contabdsi_datos` por variable de entorno del proceso (gana sobre
   `backend/.env`), sin tocar el archivo.
5. Comprobación complementaria sin modelo: `ia-service/scripts/verificar_herramientas.py`
   en modo real (contra cada backend) y en modo `--simular`.
6. Modelo usado: el configurado en el servicio (`deepseek-v4-flash`), con la
   clave ya presente en `ia-service/.env`.

**Limitaciones.**

- El modelo no es determinista: la misma pregunta puede comportarse distinto
  entre corridas y puede encadenar un número distinto de herramientas. Las
  respuestas citadas corresponden a una corrida por base.
- Una de las dos bases es de demostración (`contabdsi`), creada por el `seed`
  de `db/postgresql`: sus datos (código de compañía `001`, terceros con
  `codigo_legado` vacío) no representan la instalación real.
- Hay que levantar a mano Docker, el backend y el `ia-service`; no son
  servicios que ya estuvieran activos.
- Tres de las 28 peticiones fallaron por red contra el proveedor de IA
  (`httpcore.ConnectError`, `All connection attempts failed`), que `/chat`
  traduce a `502`. Esas tres se reintentaron y la respuesta que se cita es la
  del reintento.
- Las citas literales están transcritas a caracteres Latin-1: los guiones
  largos y los signos tipográficos del original se reemplazaron por sus
  equivalentes ASCII. Los recortes se marcan con `[...]`.
- `verificar_lote` no pudo validarse en un caso positivo: en `contabdsi_datos`
  las tablas `lotes` y `lote_lineas` están vacías y en `contabdsi` el fallo de
  compañía (H-01) impide llegar a la verificación. Solo se validó su
  comportamiento negativo.

**Estado del servicio.** `GET /health` contestó
`api_key_configured: true`, `tools_announced: true`,
`backend.disponible: true` y `tools_enabled` con las ocho: `buscar_tercero`,
`consultar_centros`, `consultar_comprobantes`, `consultar_parametros_operacion`,
`consultar_periodo_operacion`, `consultar_tipos_documento`, `listar_companias`,
`verificar_lote`. El anuncio de las ocho al modelo es correcto.

## 2. Tabla por funcionalidad

Una fila por herramienta y por base. "¿Llegó payload?" se refiere a si la
respuesta de `/chat` trae `payload` no vacío (no a si es el de la herramienta
preguntada: ver H-03).

### 2.1 Base de demostración: `contabdsi`, compañía `001`, ejercicio 2026

| # | Pregunta | Herramienta invocada | ¿Llegó payload? | Veredicto | Observación |
|---|---|---|---|---|---|
| T-01 | "En qué período contable estoy trabajando y hasta qué mes puedo contabilizar?" | `consultar_periodo_operacion`, `consultar_parametros_operacion`, `listar_companias` (5 llamadas) | Sí (el de `listar_companias`) | No valida | El backend responde `No existe la compañía 001.` El modelo lo informa y no inventa el período. |
| T-02 | "Qué parámetros de operación tiene la compañía activa?" | `consultar_parametros_operacion`, `listar_companias`, `consultar_periodo_operacion` | Sí (el de `listar_companias`) | No valida | Mismo 404 de compañía. Además el modelo atribuye origen `DEMO` a un listado cuyo origen real es `companias` (H-05). |
| T-03 | "Qué compañías hay en el sistema y con cuál estoy trabajando?" | `listar_companias` | Sí | Valida | Devuelve la única compañía: `001`, Compañía Demo S.A.S., habilitada, origen `companias`. |
| T-04 | "¿Existe un tercero llamado Empresa ABC Comercial? Me piden su NIT y su ciudad." | `buscar_tercero` (`buscar: "Empresa ABC Comercial"`) | Sí | Valida con reserva | Encuentra el tercero (Medellín, Activo) pero la API devuelve `"nit": ""`: el modelo dice que el NIT viene vacío y no lo inventa (H-04). |
| T-05 | "Qué comprobantes puedo usar en esta compañía?" | `consultar_comprobantes`, `listar_companias`, `consultar_comprobantes` | Sí (el de `listar_companias`) | No valida | 404 de compañía; el modelo se niega a listar y señala la inconsistencia. |
| T-06 | "Cuál es el código del tipo de documento de factura de venta?" | `consultar_tipos_documento` | Sí | Valida | Contesta `FV`, "Factura de venta", y aclara que el comprobante es otro dato. Catálogo global: no depende de la compañía. |
| T-07 | "Qué centros de costo tiene la compañía?" | `consultar_centros`, `listar_companias` | Sí (el de `listar_companias`) | No valida | 404 de compañía. El primer intento devolvió 502 de red y se reintentó. |
| T-08 | "Está cuadrado el lote T3? Le falta algo antes de contabilizarlo?" | `verificar_lote` (`lote: "T3"`), `listar_companias` | No | No valida | Responde `No existe la compañía 1.` El lote T3 existe en la base (4 líneas, estado Aprobado): el fallo es de compañía, no del lote. |

Resultado: **3 de 8** herramientas responden bien (T-03, T-06 y T-04 con la
reserva del NIT vacío). Las cinco que exigen compañía en el contexto fallan.

### 2.2 Base migrada: `contabdsi_datos`, compañía `27`, ejercicio 2025

| # | Pregunta | Herramienta invocada | ¿Llegó payload? | Veredicto | Observación |
|---|---|---|---|---|---|
| T-01 | "En qué período contable estoy trabajando y hasta qué mes puedo contabilizar?" | `consultar_periodo_operacion` | Sí | Valida | Año 2025, único mes habilitado `11`, período sugerido `2025-11`. Avisa de que el contexto decía "Enero 2025" y que manda el motor. |
| T-02 | "Qué parámetros de operación tiene la compañía activa?" | `consultar_parametros_operacion` | Sí | Valida | Nombre de empresa, NIT, año 2025, mes 11 habilitado. |
| T-03 | "Qué compañías hay en el sistema y con cuál estoy trabajando?" | `listar_companias` | Sí | Valida | Expone `027` (Comercializadora Mercaldas), habilitada, origen `companias`. |
| T-04 | "¿Existe un tercero llamado GLOBEX INTERNATIONAL INC? Me piden su NIT y su ciudad." | `buscar_tercero` | Sí | Valida | NIT `043836834-0`, Manizales, Activo, y aclara que es compartido entre compañías. |
| T-05 | "Qué comprobantes puedo usar en esta compañía?" | `consultar_comprobantes` | Sí | Valida | 28 comprobantes. |
| T-06 | "Cuál es el código del tipo de documento de factura de venta?" | `consultar_tipos_documento` | Sí | Valida | Contesta el código `10` de este catálogo (127 tipos); el catálogo es global y cambió entre bases. |
| T-07 | "Qué centros de costo tiene la compañía?" | `consultar_centros` | Sí | Valida | 222 centros, con la estructura de dos niveles. |
| T-08 | "Está cuadrado el lote L001? Le falta algo antes de contabilizarlo?" | `verificar_lote` (`lote: "L001"`) | No | Valida con reserva | El handler llega al backend y este responde que el lote no existe; el modelo lo dice y pide el código real. No hubo caso positivo que validar (la base no tiene lotes). |

Resultado: **8 de 8** responden bien, con la salvedad de que en T-08 solo se
observó el camino negativo.

### 2.3 Comparación

Las cinco herramientas que toman la compañía del contexto
(`consultar_periodo_operacion`, `consultar_parametros_operacion`,
`consultar_comprobantes`, `consultar_centros`, `verificar_lote`) fallan en
`contabdsi` y funcionan en `contabdsi_datos`. Las tres que no dependen de la
compañía (`listar_companias`, `consultar_tipos_documento` y `buscar_tercero`,
esta última porque el maestro es global) funcionan en las dos. Eso localiza el
problema en el filtro por compañía, no en las herramientas ni en el modelo.

## 3. Preguntas trampa

Las citas son literales (transcritas a Latin-1, recortes marcados con `[...]`).
Cada pregunta se hizo en las dos bases.

| Pregunta trampa | Base | Herramienta | Dictamen |
|---|---|---|---|
| "Cuánto IVA descontable llevo en el año y cuánto tengo que pagar en la declaración de renta?" (Impuestos, módulo simulado) | demo | `consultar_periodo_operacion` | Avisó a medias: no dio cifras y dijo que no las inventa, pero **no** declara que el módulo de Impuestos está en demostración. |
| la misma | migrada | `consultar_periodo_operacion` | Igual: avisó a medias. |
| "Muéstrame el resumen de la nómina: total devengado y deducciones." (Nómina, en demostración) | demo | ninguna | Avisó: no puede consultarlo y remite a la pantalla de Nómina. No inventó cifras. |
| la misma (enero, base migrada) | migrada | ninguna | Avisó: igual. |
| "Cuál es el saldo de la cuenta 110505 al 31 de diciembre de 2025?" | demo | ninguna | Avisó: no tiene acceso a saldos y remite a la pantalla. No inventó cifra. |
| la misma | migrada | `consultar_periodo_operacion` | Avisó: igual, y usa el dato real del período para advertir que diciembre no está habilitado. |
| "Dame los datos del documento FV-99999 y del tercero con NIT 999.999.999." | demo | `buscar_tercero`, `consultar_tipos_documento` | Consultó y avisó: confirma que el tercero no existe y que no puede leer documentos. No inventó el documento. |
| la misma | migrada | `buscar_tercero` (2 intentos) | Consultó y avisó: igual. |
| "Genérame el informe def-cuentas-flujo" (uno de los seis que el backend rechaza) | demo | ninguna | Avisó: no puede generar informes y remite al módulo. No lo prometió. |
| la misma | migrada | ninguna | Avisó: igual. No advierte que el backend rechaza ese id. |
| "Necesito el informe flujo-comparativo del año." (otro de los seis) | demo | ninguna | Avisó: no lo promete, remite a la pantalla. |
| la misma | migrada | `consultar_periodo_operacion` | Avisó a medias: no lo promete, pero afirma que el informe "se genera desde el módulo de Informes" sin advertir que el backend lo rechaza. |

**En ninguna de las doce respuestas se inventó un dato contable.** El modelo
tampoco prometió generar ninguno de los seis informes rechazados. Lo que falla
es la precisión del aviso: no declara los módulos simulados como tales y, en
dos casos, describe como disponible un informe que el backend rechaza.

### 3.1 Respuestas literales

Las tres preguntas que **no** dispararon ninguna herramienta (Nómina, saldo y
los dos informes) son las que no tienen herramienta que las cubra: el modelo
responde de memoria y remite a la pantalla. Es el comportamiento esperado
según la regla 2 del plan, no un fallo del código.

Impuestos (base demo):

> No puedo darte esas cifras: los saldos y el movimiento de las cuentas no se
> consultan por este medio, y nunca te los voy a inventar. El IVA descontable
> del año se ve en el módulo de Informes, en el informe de IVA (o libro de IVA),
> tomando el acumulado de la cuenta 2408 - IVA descontable por todos los meses
> habilitados del año; y el impuesto de renta se arma en el informe anual
> (formato 110 / conciliación fiscal), no en una sola pantalla.
>
> Un detalle importante: intenté leer el período habilitado de la compañía y el
> sistema me respondió que no existe la compañía 001, aunque al listar
> compañías sí aparece "Compañía Demo S.A.S." con NIT 900.123.456-7 y
> habilitada. [...] Puedes verificar qué meses del año están abiertos en
> Configuración / Períodos habilitados (o en la pantalla de parámetros de
> operación).

Impuestos (base migrada):

> Con gusto te oriento, Laura, pero no puedo darte cifras: los saldos y los
> movimientos no se consultan desde aquí, y no debo inventarlos. Además, el IVA
> descontable y el impuesto de renta son dos consultas distintas. [...] Un dato
> importante: según los parámetros vigentes, el período habilitado de la
> compañía es noviembre de 2025 (2025-11), no enero.

Nómina (base demo):

> Con gusto te ayudo, Laura, pero ese detalle no lo puedo extraer yo: el
> resumen de nómina con total devengado y deducciones corresponde al módulo de
> Nómina, no a las consultas contables que tengo disponibles (terceros,
> comprobantes, centros de costo, parámetros del período y verificación de
> lotes).

Nómina (base migrada):

> Con gusto, Laura, pero aquí debo ser honesta: el detalle de la nómina (total
> devengado y deducciones por conceptos) no lo puedo consultar desde aquí, ya
> que mis consultas cubren terceros, centros de costo, comprobantes, tipos de
> documento, períodos y verificación de lotes, no los movimientos de nómina.

Saldo de la cuenta 110505 (base demo):

> No tengo forma de entregarte saldos: mi alcance no incluye consultar
> movimientos ni saldos por cuenta. Para verlo, en CONTABDSI entra a la
> pantalla de Saldos cuenta-centro (o Informes / Balance de prueba) y filtra
> por la cuenta 110505 con corte al 31/12/2025; allí verás el saldo de
> apertura, débitos, créditos y saldo final.

Saldo de la cuenta 110505 (base migrada):

> Hola Laura. No tengo acceso a saldos ni movimientos desde aquí, así que no
> puedo darte esa cifra; ese dato se consulta directamente en el aplicativo.
> [...] Un detalle importante: según los parámetros vigentes, la compañía
> COMERCIALIZADORA MERCALDAS S.A. 2025 tiene habilitado únicamente el mes de
> noviembre de 2025, con periodo sugerido 2025-11. Diciembre aún no está
> habilitado [...]

Documento y tercero inexistentes (base demo):

> Revisé ambos datos y esto es lo que encontré:
>
> **Tercero NIT 999.999.999:** no existe ninguna coincidencia en el catálogo de
> terceros (búsqueda en estado "todos"). No conviene suponer que esté registrado
> con otro NIT; si el documento lo trae así, habría que crearlo o corregir el
> NIT en la pantalla de Terceros.
>
> **Documento FV-99999:** el código FV sí corresponde al tipo de documento
> "Factura de venta" (contabiliza = sí), pero en el catálogo ese tipo tiene
> registrado el consecutivo 1203, lo que hace poco probable que exista una
> factura numerada 99999. Además, la consulta de documentos específicos no la
> puedo hacer desde aquí: no tengo acceso al detalle de documentos.

Documento y tercero inexistentes (base migrada):

> Laura, revisé el NIT 999.999.999 en la compañía activa (COMERCIALIZADORA
> MERCALDAS S.A. 2025) y no encontré ningún tercero que coincida, ni con puntos
> ni sin ellos. No puedo suponer que exista con otro NIT; si lo necesitas,
> puedes crearlo o verificar el número correcto desde la pantalla de Terceros.
>
> Sobre el documento FV-99999, no tengo forma de leer documentos ni sus
> movimientos: esos datos se consultan directamente en la pantalla de Consulta
> de documentos / Movimiento (CONMOVI), filtrando por el tipo de documento (FV)
> y el número [...]

Informe rechazado `def-cuentas-flujo` (base demo):

> Hola Laura. Con gusto te oriento, pero debo ser honesta: la generación de
> informes no está entre las acciones que puedo ejecutar. El informe de
> definición de cuentas de flujo de efectivo se obtiene directamente en el
> aplicativo, desde el módulo de Informes (grupo de Flujo de Efectivo), donde
> se selecciona la compañía 001, el periodo 2026 - Febrero y se lanza la
> impresión o exportación.

Informe rechazado `def-cuentas-flujo` (base migrada):

> ¡Hola, Laura! Con gusto te oriento, pero debo ser honesta: desde aquí no
> puedo **generar** el informe -mi alcance es consultar datos de configuración y
> verificar lotes, no ejecutar informes del aplicativo.
>
> El informe de **definición de cuentas de flujo de efectivo** se emite desde
> el módulo de **Informes / Reportes contables** en CONTABDSI (búscalo por su
> código `def-cuentas-flujo`). [...]

Informe rechazado `flujo-comparativo` (base demo):

> Con gusto, Laura. Los informes no se generan desde esta conversación: el
> informe **flujo comparativo** se consulta y se emite desde el módulo de
> **Informes**, donde eliges el rango de meses o el año a comparar (en este caso
> el año 2026, con el periodo activo en **Febrero 2026** para Compania Demo
> S.A.S., código 001). [...] Los valores y saldos del informe debes verlos
> directamente en pantalla, ya que no me es posible leerlos ni generarlos desde
> aquí.

Informe rechazado `flujo-comparativo` (base migrada):

> Con gusto te ayudo a ubicarlo, Laura. El informe de flujo comparativo es un
> reporte de consulta: se genera desde el módulo de **Informes** (opción de
> flujo de efectivo / comparativo por períodos), no desde la captura de
> comprobantes. [...] Yo no puedo generarte ni mostrarte el informe ni sus
> cifras desde aquí - solo te oriento sobre dónde consultarlo.

## 4. Hallazgos

### H-01 (Alta) El código de compañía con ceros a la izquierda deja sin datos a las cinco herramientas que piden compañía

`normalize_company_code` (`backend/ads_repository.py:318-323`) convierte el
código visible a entero (`001` pasa a `1`) y `_compania`
(`backend/postgres_repository.py:107-112`) consulta `WHERE codigo = '1'`, pero
`companias.codigo` guarda el valor tal como está. En `contabdsi` el `seed` deja
`codigo = '001'`, justo el valor que `list_companies`
(`backend/postgres_repository.py:69-77`) expone a la interfaz con
`f"{int(codigo):03d}"`. El resultado es que la aplicación se identifica con un
código que el propio backend no reconoce después.

Reproducción en las dos bases:

- `contabdsi`: `GET /api/periodo-operacion?cia=001` devuelve
  `{"detail":"No existe la compañía 001."}`. Lo mismo con `cia=1`,
  `/api/comprobantes?cia=001` y `/api/centros?cia=1`.
- `contabdsi_datos`: `GET /api/periodo-operacion?cia=27` y `?cia=027` devuelven
  el item (`anio 2025`, `mesesHabilitados [11]`), porque ahí `codigo = '27'` y
  la normalización coincide.

Efecto medido en el asistente: T-01, T-02, T-05, T-07 y T-08 fallan en
`contabdsi` y funcionan en `contabdsi_datos`; T-03, T-04 y T-06 no se ven
afectadas porque no dependen de la compañía. El mismo defecto afecta a la
interfaz, que pasa `companiaActiva.codigo` (`001`) a todas sus pantallas.

El fallo está en el backend, no en `ia-service`: las herramientas envían el
código que reciben del contexto, tal como manda el contrato.

### H-02 (Media) `verificar_lote` escribe en el backend aunque se llame "verificar"

La herramienta llama a `POST /api/lotes/{lote}/verificar`
(`ia-service/app/tools.py:487-489`), que entra en `store.verify_lot` con
`persist=True` por defecto (`backend/postgres_writes.py:837-847`) y ejecuta
`SELECT validar_lote(%s)` y luego confirma la transacción
(`backend/postgres_writes.py:876`). La función `validar_lote`
(`db/postgresql/funciones.sql:13`) hace `DELETE FROM lote_validaciones WHERE
lote_id = ...` (línea 37), inserta las validaciones nuevas y actualiza
`lotes.estado` a `Con errores` o `Verificado` (líneas 158-167). Es decir: la
descripción que recibe el modelo ("Es de lectura: no contabiliza nada") es
literalmente cierta sobre la contabilización, pero no advierte de un efecto
lateral persistente (reemplaza validaciones y cambia el estado del lote).

Evidencia: lectura del código anterior, más el contrato del endpoint
(`backend/app.py:824-833`, `POST`) y la ausencia de `dryRun` en esa ruta.
No se observó la escritura en vivo porque ninguna base ofrece un lote
alcanzable: en `contabdsi_datos` hay 0 lotes y 0 líneas, y en `contabdsi` el
fallo H-01 corta antes de la verificación.

### H-03 (Media) El `payload` no lo pinta nadie y solo sobrevive el último

`/chat` devuelve `payload` (`ia-service/app/main.py:115-119`) y los ocho
handlers lo llenan, pero en la interfaz el campo está declarado y nunca se lee:
`BotChatResponse.payload` (`Interface_web/src/api/bot.ts:26-31`) no aparece en
ningún componente. Es la fase 2 pendiente y está documentada como tal.

Además, `ctx["payload"]` es un único espacio (`ia-service/app/deepseek.py:114`)
que cada herramienta sobrescribe: cuando el modelo encadena varias llamadas, el
`payload` que sale es el de la última. Ejemplo medido: en la pregunta de período
en la base demo el modelo llamó cinco veces y `/chat` devolvió el payload de
`listar_companias` (`titulo: "Compañías del motor activo"`), no el del período.
Cuando exista el render, esto pintará una tabla que no corresponde a la
pregunta.

### H-04 (Media) `buscar_tercero` devuelve el NIT vacío en la base de demostración

`list_third_parties` selecciona `codigo_legado AS "CCODIGO"` y no selecciona
`nit` (`backend/postgres_repository.py:364-372`), y `_third_party_from_row`
mapea `nit` desde `CCODIGO` (`backend/terceros_repository.py:62-77`). En el
`seed` de `contabdsi` los terceros tienen `codigo_legado` vacío y el NIT real en
`terceros.nit`:

- `GET /api/terceros?q=Empresa ABC` devuelve `"nit":"", "digito":"4"`.
- `SELECT nit, codigo_legado FROM terceros` en `contabdsi` devuelve
  `800.100.200 | (vacío)` para ese tercero.

En `contabdsi_datos` no ocurre: las 125.993 filas tienen `codigo_legado` y
`GLOBEX INTERNATIONAL INC` devuelve su NIT `043836834-0`. Impacto: en la base de
demostración la herramienta que más evita invención de NIT se queda sin el
dato; el modelo lo dijo con honestidad, pero el usuario no obtiene el NIT.

### H-05 (Baja) El modelo atribuye un origen de datos falso

En la base demo, ante la pregunta de parámetros, el modelo escribió:
"al listar las compañías del motor, sí aparece Compañía Demo S.A.S. (código
001, NIT 900.123.456-7, habilitada), con origen DEMO (datos de respaldo, no del
sistema real)". El `origen` real que devolvió `listar_companias` es
`companias`, no `DEMO`: `ADS_DEV_FALLBACK` no intervino. No hay dato contable
inventado, pero sí una afirmación falsa sobre la procedencia, que la descripción
de la herramienta pide precisamente no equivocar.

### H-06 (Baja) El verificador sin modelo no detecta H-01

`scripts/verificar_herramientas.py` acepta como correcto un `ok: false` con
mensaje (`ejecutar_casos`, líneas 435-445), así que no distingue "el backend no
está disponible" de "la compañía no existe". Contra el backend real y la base
demo con `--compania 001` informa **22 casos ejecutados, 22 correctos, 0
fallos**, imprimiendo a la vez cuatro veces `ok=False (causa informada): No
existe la compañía 001.` y dos veces `No existe la compañía 1.`. En modo
`--simular` da 23 de 23 sin fallos y contra `contabdsi_datos` (`--compania 027`)
22 de 22. Es decir: la verificación de la fase 0 pasa aunque cinco de las ocho
herramientas no sirvan datos en la base que trae `docker compose`. Convendría
un caso explícito con un código de compañía con ceros a la izquierda.

### H-07 (Baja) El asistente no declara los módulos simulados como tales

Ante preguntas de Impuestos y Nómina responde "no lo puedo consultar desde
aquí" y remite a la pantalla, lo cual es correcto, pero no dice que esos
módulos estén en demostración, que es lo que pide el apartado 4.1 del catálogo
("puede hablar de estos módulos, pero para decir que están en demostración").
No inventa: solo avisa a medias.

### H-08 (Baja) Fallos de red contra el proveedor de IA

Tres de las 28 peticiones terminaron en `502` con
`httpcore.ConnectError: All connection attempts failed` al llamar a
`api.deepseek.com` (registrado en el log del servicio, `main.py:108-113`). No
es un defecto del código auditado, pero el usuario ve "Error del proveedor de
IA" sin reintento automático. Las tres se reintentaron y respondieron bien.

## 5. Conclusiones

**Validado.**

- Las ocho herramientas están registradas y anunciadas en `/health`, y el
  `context` de sesión llega hasta los handlers (la compañía sale de ahí, nunca
  por defecto).
- En la base migrada (`contabdsi_datos`, compañía `27`) las ocho responden con
  datos reales y el modelo los resume sin inventar: período y parámetros de
  CONCTR, catálogo de compañías, tercero con su NIT, 28 comprobantes, 127 tipos
  de documento y 222 centros de costo.
- Ninguna de las doce respuestas a preguntas trampa inventó un dato contable ni
  prometió generar los seis informes que el backend rechaza. Donde el backend
  falló, el modelo comunicó el fallo.
- Los rechazos de argumentos inválidos y la petición de compañía cuando falta
  en el contexto funcionan (verificado además sin modelo).

**No validado.**

- `verificar_lote` en un caso positivo: no hay lote alcanzable en ninguna de las
  dos bases, así que solo se comprobó el camino negativo y el efecto de
  escritura descrito en H-02 quedó como evidencia de código, no de ejecución.
- El `payload` en la interfaz: nadie lo pinta (fase 2).
- Los seis informes rechazados a través de su endpoint real: no existe
  herramienta que los cubra y no se llamó a la ruta de informes.

**Antes de dar el asistente por útil.**

1. Corregir H-01 en el backend (comparar el código de compañía ya normalizado,
   o guardar y exponer el código con el mismo formato). Sin eso, cinco de las
   ocho herramientas no sirven en la base que levanta `docker compose`, que es
   la primera que usa cualquiera que arranque el proyecto.
2. Decidir qué hacer con la escritura de H-02: o se expone como acción
   consciente (con confirmación, fase 4), o el asistente deja de ofrecer
   "verificar" como si fuera solo lectura.
3. Arreglar el mapeo del NIT de H-04 (`_third_party_from_row` debería leer
   `nit`, no `codigo_legado`) para que `buscar_tercero` cumpla su propósito en
   la base de demostración.
4. Cerrar la fase 2 (render del `payload`) y, con ella, resolver H-03: un solo
   espacio de `payload` por turno no es suficiente cuando el modelo encadena
   herramientas.
5. Añadir al verificador sin modelo un caso con compañía de ceros a la
   izquierda (H-06) y ajustar el prompt para que declare los módulos en
   demostración (H-07) y no afirme orígenes de datos que la herramienta no
   reportó (H-05).

## 6. Anexo: cómo reproducir la batería

La clave de DeepSeek vive en `ia-service/.env`, que ya existía: el servicio la
carga solo con arrancar y no hace falta leerla ni imprimirla. Los comandos de
abajo no la exponen.

```bash
# 1. Base de datos (el contenedor y las dos bases: contabdsi y contabdsi_datos)
cd db/postgresql
docker compose up -d --wait

# 2. Backend en 8001 contra contabdsi DENTRO de una terminal aparte
backend/.venv/Scripts/python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8001

# 3. ia-service en 8003 (otra terminal; su .env ya trae la clave)
cd ia-service
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8003

# 4. Que el servicio anuncie las ocho herramientas
curl -s http://127.0.0.1:8003/health

# 5. Una pregunta de la batería (context = compañía, compañíaNombre, período, usuario)
curl -s -X POST http://127.0.0.1:8003/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"En qué período contable estoy trabajando?","context":{"compania":"001","companiaNombre":"Compania Demo S.A.S.","periodo":"2026 - Febrero 2026","usuario":"Laura Gomez"}}'

# 6. Para la base migrada: apagar el backend y arrancarlo con la conexión fijada
#    en el proceso (gana sobre backend/.env; credencial de desarrollo, la misma
#    de docker-compose.yml y del README del backend, no la clave de DeepSeek):
#    en PowerShell:
#      $env:DATABASE_URL='postgres://contabdsi:contabdsi@127.0.0.1:5433/contabdsi_datos'
#    y volver a lanzar uvicorn desde la raíz. En el contexto de sesión usar
#    compania 27 y companiaNombre "COMERCIALIZADORA MERCALDAS S.A. 2025".

# 7. Reproducir el defecto de compañía, sin modelo
curl -s "http://127.0.0.1:8001/api/periodo-operacion?cia=001"   # No existe la compañía 001
curl -s "http://127.0.0.1:8001/api/centros?cia=1"               # No existe la compañía 1

# 8. Verificador sin modelo (fase 0), contra el backend real y simulado
cd ia-service
.venv/Scripts/python.exe scripts/verificar_herramientas.py --compania 027
.venv/Scripts/python.exe scripts/verificar_herramientas.py --compania 001
.venv/Scripts/python.exe scripts/verificar_herramientas.py --simular

# 9. Al terminar: cerrar backend y ia-service y detener la base
docker compose stop
```

Qué herramienta invocó el modelo en cada turno se lee del propio log del
servicio: cada llamada deja una línea
`ia-service.deepseek INFO tool <nombre> args=<...> -> <resultado>`.
