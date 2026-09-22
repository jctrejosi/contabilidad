# Plan de implementacion de la funcionalidad faltante

Plan de trabajo derivado de la auditoria de funcionalidad. Ordena, por
dependencia, todo lo que falta para que los controles que hoy simulan en
`Interface_web/` operen contra el backend, con el detalle de contrato en
`detalle/`.

> Este es el **plan de backend** (`docs/plan/backend/`). El otro plan es el del
> asistente (Daisy), en `../bot/PLAN_BOT.md`; el indice de los dos esta en
> `../README.md`.

Contenido del punto 3 en archivos aparte:

- `detalle/maestros.md`: terceros, centros, comprobantes y tipos de documento
  (bloque B1, B1b, B2 y el alta de tercero desde el directorio).
- `detalle/configuracion.md`: las seis pantallas de configuracion por compania
  (bloque B3).
- `detalle/movimientos.md`: captura directa, generacion de lote, reembolsos y
  reasignacion de NIT (bloques C, E1 y E2).
- `detalle/impuestos.md`: acumulados, medios magneticos, topes y el modulo de
  cuentas en cero (bloque D1 y Especiales).
- `detalle/procesos.md`: cierres, consolidacion y mantenimiento (bloques D2,
  D3 y D4).
- `detalle/administracion.md`: usuarios y permisos, bitacora e integraciones
  (bloques D5, D6 y D7).
- `detalle/informes.md`: configuracion de flujo de caja y NIIF para los seis
  informes marcados "Pendiente" (bloque A5).

---

## 1. Ficha

| Campo | Valor |
|---|---|
| Objeto | Implementar la funcionalidad que los 446 controles locales o simulados del mapa necesitan del backend, empezando por los hallazgos H1 a H18 |
| Base del orden | `docs/auditorias/AUDITORIA_FUNCIONALIDAD.md` seccion 4 (bloques A a E) |
| Base del inventario | `docs/catalogo/MAPA_FUNCIONALIDAD.md` seccion 3 (funcionalidad que falta) y seccion 4 (controles que prometen y no cumplen) |
| Base de convenciones | `backend/app.py` (48 rutas), `backend/store.py` (despacho por operacion), `backend/*_repository.py`, `db/postgresql/schema/*.sql` (65 tablas) |
| Rutas nuevas propuestas | 86 |
| Rutas existentes que se reutilizan | 11 distintas, en 17 filas del inventario |
| Filas que son trabajo solo de interfaz | 13 (de 106 filas del inventario) |
| Tablas nuevas | 5, en 2 archivos de esquema |
| Fuera de alcance | Conectores externos reales, generador de informes personalizado, certificados y anexos en portal, edicion y baja de los tres catalogos del bloque B2 (seccion 6) |
| Fecha | 2026-09-21 |

### 1.1 Por que este plan vive en `docs/plan/backend/`

`docs/maestros/` es especificacion de materia: contrato de datos de un maestro
contra Advantage Data Server (`docs/README.md:5`). Este documento no especifica
un maestro: cruza maestros, movimientos, informes, procesos y administracion, y
su contenido util no es el contrato de datos sino **el orden de implementacion y
los criterios de aceptacion**. Eso es lo mismo que hace `docs/auditorias/`, que
es la fuente de la que este plan desciende. Por eso se crea `docs/plan/` como
carpeta hermana, y dentro de ella esta **este plan de backend** en
`docs/plan/backend/`, con un archivo principal y el detalle por modulo en
`docs/plan/backend/detalle/`. El otro plan de `docs/plan/` es el del asistente
(Daisy), en `docs/plan/bot/`; los dos comparten las mismas fuentes
(`docs/catalogo/MAPA_FUNCIONALIDAD.md` y `docs/auditorias/`) y se separan porque
uno ordena el trabajo de backend y el otro el del bot. Se anade su linea de
indice en `docs/README.md`.

### 1.2 Fuentes obligatorias y como se usaron

| Fuente | Que se tomo de ella | Que no se toco |
|---|---|---|
| `docs/auditorias/AUDITORIA_FUNCIONALIDAD.md` | Los 18 hallazgos con su severidad, la evidencia `archivo:linea` de cada uno y los bloques A a E de la seccion 4, que fijan el orden | No se anaden hallazgos ni se re-clasifican severidades |
| `docs/catalogo/MAPA_FUNCIONALIDAD.md` | La seccion 3 (que le falta a cada control inerte o simulado) y la seccion 4 (controles que prometen y no cumplen) | No se recalculan los conteos por pantalla |
| `backend/app.py` | Convencion de rutas, validacion con Pydantic y `Query`/`Path`, forma de las respuestas, mapeo de errores | No se modifica |
| `backend/store.py` | Patron de despacho por operacion entre los dos motores | No se modifica |
| `backend/*_repository.py` | Nombres de tabla y campos del legado que cada repositorio ya usa | No se modifica |
| `db/postgresql/schema/*.sql` | Que tablas existen ya (65) y el estilo del DDL y de los comentarios | No se modifica |
| `db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md` | Que tabla del legado corresponde a cada tabla del modelo y que brecha queda declarada | No se modifica (`old_db/` es contexto congelado, `db/README.md:45-53`) |

### 1.3 Reglas del plan

Son las reglas del proyecto, no de este documento. Cada una se cita con su
archivo y linea.

**R1. Doble motor.** Todo endpoint nuevo funciona con los dos motores, `ads` y
`postgres`, salvo que la fila lo declare en la columna *motor* con su
justificacion. El despacho vive en un unico punto de decision
(`backend/store.py:41-56`) y cada operacion resuelve su implementacion ahi
(`backend/store.py:73-89`). El contrato JSON tiene que ser identico en los dos
motores: es la razon por la que la implementacion de PostgreSQL reutiliza los
nombres fisicos del legado (`db/migration/13_informe_final.md:76-80`).

**R2. No se rompe lo conectado.** Los 242 controles conectados siguen leyendo
las mismas claves. Cuando hace falta mas informacion se **anade un campo
opcional** o se **anade una ruta nueva**; no se cambia el significado de una
clave existente ni se quita ninguna. Casos de este plan: `GET /api/companias`
(seccion 5, columna *reutiliza*) y `PUT /api/cuentas/{codigo}`.

**R3. Nada sin criterio de aceptacion.** Cada ruta nueva del punto 3 cierra con
dos o tres casos: normal, vacio y argumentos invalidos, con el resultado
esperado. Un endpoint sin esos casos no se marca como terminado.

**R4. La capa HTTP no escribe SQL.** `backend/app.py` valida y delega; el SQL
vive en `ads_repository` y en `postgres_writes` (`backend/app.py:1-6`). Un
endpoint nuevo es una funcion de `store` mas una implementacion por motor.

**R5. Errores estables.** Todo fallo pasa por `_service_error`
(`backend/app.py:245-269`): 404 no encontrado, 409 conflicto, 422 validacion,
503 motor no disponible. Los repositorios declaran su excepcion de dominio y se
anade al mapeo.

**R6. Validacion en el modelo.** Pydantic con `extra="forbid"` y `Field` con
limites, alias camelCase en los parametros de consulta y `pattern` en los
codigos (`backend/app.py:71-116`, `176-223`).

**R7. Escrituras sensibles con red de seguridad.** `dryRun` en lo masivo o
destructivo (`backend/app.py:703`, `756`, `836`, `894`), `usuario` de hasta 4
caracteres (`backend/app.py:144`) y `motivo` obligatorio con longitud minima en
lo que hay que poder auditar (`backend/app.py:161-173`).

**R8. Auditoria.** En PostgreSQL la escriben los disparadores de fila
(`db/postgresql/schema/08_seguridad.sql:111-114`) y las acciones de negocio
insertan en `auditoria` (`backend/postgres_writes.py:1186-1190`). En Advantage
escribe `auditoria_repository` sobre `VISAUDI`
(`backend/auditoria_repository.py:55`, `74`, `94`). Toda ruta nueva destructiva
registra el motivo en el motor activo.

**R9. Idiomas de ruta y respuesta.** Las rutas siguen el patron de las 48
existentes: prefijo `/api/`, minusculas, guiones, plural o singular igual que el
`GET` con el que conviven (`/api/centros`, `/api/tipos-documento`,
`/api/informes/balance-comprobacion`). Las listas responden
`{"items": [...], "count": n, "source": "TABLA"}` (`backend/app.py:1050-1059`),
los elementos `{"item": {...}, "source": "TABLA"}` (`backend/app.py:785-795`) y
las bajas sin cuerpo 204 (`backend/app.py:881-891`). Los filtros van por
`Query`, no por cuerpo, incluso en los `POST` que crean
(`backend/app.py:785-789`).

**R10. Escritura de los dos motores.** En Advantage la compania es global para
el tercero y en PostgreSQL es obligatoria: cuando la diferencia existe se
declara en el contrato, como ya hace el alta de tercero
(`backend/app.py:339-349`, que exige `cia` en la consulta y responde
`"sharedAcrossCompanies": true`).

---

## 2. Inventario de endpoints a implementar

### 2.0 Como leer las tablas

- **metodo y ruta**: la ruta propuesta, en el patron de R9. Cuando dice
  `(existe)`, la ruta ya esta en `backend/app.py` y el trabajo es de interfaz.
- **tablas que toca**: `PG` es la tabla del modelo PostgreSQL (`db/postgresql/
  schema/`); `ADS` es la tabla del legado que hoy leen los repositorios.
  `nueva` marca tabla que no existe y esta en la seccion 4.
- **motor**:
  - `AMBOS`: hay contraparte legada nombrada en
    `db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`, de modo que se implementan las dos
    ramas de `store`.
  - `requiere tabla nueva en ADS`: no hay contraparte legada utilizable; la
    tabla existe en el modelo y en la guia del diccionario ADS
    (`db/advantage/01_tablas.sql`, que es guia de traduccion y no script de
    produccion), pero el diccionario del legado no la tiene. La ruta arranca en
    PostgreSQL y se habilita en Advantage cuando esa tabla se cree.
  - `solo PostgreSQL`: ademas de no tener contraparte, la operacion no es
    representable en la semantica del legado (crear una compania es crear una
    carpeta de tablas, `db/README.md:106-111`; el mantenimiento fisico del
    legado es ADI y `COPY STRUC`, sustituido por el DDL versionado
    (`db/old_db/MATRIZ_PROCESOS_Y_OPCIONES.md`, P36); el control de acceso
    efectivo exige una identidad que hoy no existe en ningun motor,
    P28).
- **reutiliza una ruta existente**: `Si` cuando la ruta ya existe y el trabajo
  es de interfaz o de extension aditiva del contrato; `No` cuando la ruta es
  nueva.
- **depende de**: la clave de la fila de la que no se puede prescindir.

### Bloque A. Cableado sin prerrequisito (empezar aqui)

No crea funcionalidad nueva: usa lo que ya existe. La auditoria lo pone primero
porque es el menor esfuerzo para dejar de mostrar datos falsos donde ya hay
backend detras.

| metodo y ruta | proposito | pantalla y control | tablas que toca | motor | reutiliza | depende de |
|---|---|---|---|---|---|---|
| `GET /api/documentos/detalle` (existe, `app.py:676`) | partidas reales del documento consultado | DocumentoOficial: boton "Documento oficial" de ConsultaDocumentos (`218-221`), MovimientoMensual (`168-169`) y DocumentoEspecifico; el filtro fijo del mock esta en `DocumentoOficial.tsx:8-12` | PG `documentos`, `documento_lineas`; ADS `CONDOCUM`, `MOV01` | AMBOS | Si; el trabajo es de interfaz: pasar la clave de la cabecera | nada |
| `GET /api/documentos/detalle` (existe) | impresion del documento oficial | DocumentoOficial, boton "Imprimir" (`DocumentoOficial.tsx:156`, inerte) | las mismas | AMBOS | Si; el manejador es de interfaz (`window.print()` o el exportador que ya existe) | A1 |
| `GET /api/lotes` (existe, `app.py:726`) | lotes reales del tablero | Dashboard: indicadores y "tareas pendientes" (`Dashboard.tsx:92-102`) | PG `lotes`; ADS `CONMOVI` | AMBOS | Si; el trabajo es de interfaz | nada |
| `GET /api/documentos` (existe, `app.py:644`) | documentos del periodo para los conteos | Dashboard: indicadores (`Dashboard.tsx:1`) | PG `documentos`; ADS `CONDOCUM` | AMBOS | Si; el trabajo es de interfaz | nada |
| `GET /api/informes/balance-comprobacion` (existe, `app.py:944`) | balance real en la pantalla huerfana | BalanceComprobacion: cabecera y tabla (`BalanceComprobacion.tsx:1-2`) | PG `saldos_cuenta`; ADS `CONMAE` | AMBOS | Si; hay cliente (`api/balanceComprobacion.ts:47`) | nada |
| `GET /api/informes/balance-comprobacion/exportar` (existe, `app.py:962`) | "Imprimir" del balance | BalanceComprobacion, boton "Imprimir" (`BalanceComprobacion.tsx:42`, inerte) | las mismas | AMBOS | Si; el cliente ya lo expone (`api/balanceComprobacion.ts:59`) | A3 |
| `GET /api/plantillas-contables` (nueva, B3) | plantillas persistidas para "F5 Plantilla" | CapturaDirecta: `PLANTILLAS` fijas (`77-87`), "Aplicar plantilla" e "Insertar" (`418-432`), aviso simulado en `431` | PG `plantillas_contables`, `plantilla_lineas`; ADS `PLANTICO`/`VISDOCUM`, `CONTIDOC` | AMBOS | No; es el `GET` del modulo de plantillas de B3 | B3 |
| `GET /api/informes/adicionales/{report_id}` (existe, `app.py:993`) | informes marcados "Pendiente" | Informes: botones de tarjeta (`695`, `738`), parametros modales; `PENDING_REPORTS` en `Informes.tsx:160-167` | segun informe: `cuentas`, `acumulados_tercero`, `documento_lineas` | AMBOS | Si; falta el dato (clasificacion y definiciones) y el cableado | A5 (tablas nuevas) |
| `POST /api/terceros` (existe, `app.py:339`) | habilitar el alta real desde el directorio | Terceros: "+ Nuevo tercero" (`306`, deshabilitado con nota) | PG `terceros`; ADS `FADCLI` | AMBOS | Si; el alta real ya existe y la usa `CrearTerceroModal` (19 controles conectados) | nada |
| `GET /api/informes/adicionales/tercero-especifico` (existe, `app.py:993`) | dar contenido a la pestana "Informes" del directorio | Terceros: pestana "Informes" (`328`, deshabilitada sin contenido) | PG `documento_lineas`, `acumulados_tercero`; ADS `MOV01`, `CONTERCE` | AMBOS | Si; el informe ya existe y exige `nit` (`informes_adicionales_repository.py:404-405`) | nada |
| `GET /api/cuentas` (existe, `app.py:1050`) | arbol de cuentas de las pantallas de asignacion | Impuestos: paso "Asignacion cuentas"; Informes: rubros NIIF | PG `cuentas`; ADS `CONMAE` | AMBOS | Si; ya lo consume PlanCuentas | nada |

Nota de A2: las *alertas* del tablero que hoy salen del mock (`ALERTAS`) se
calculan en la interfaz con `lotes` y `documentos`. Si el tablero necesita un
agregado que no se pueda derivar de esas dos consultas paginadas (por ejemplo el
total de lotes sin verificar de todos los periodos), se resuelve con una ruta
nueva `GET /api/dashboard` que este plan **no** propone: no hay evidencia en la
auditoria de cual es el agregado requerido y conviene decidirlo con el dato real
delante.

A5. Configuracion de los seis informes que hoy no se pueden generar. La ruta de
consulta existe; lo que no existe es el dato que la alimenta.

| metodo y ruta | proposito | pantalla y control | tablas que toca | motor | reutiliza | depende de |
|---|---|---|---|---|---|---|
| `GET /api/flujo-caja-renglones` | definicion de cuentas del flujo de caja | Informes: informes `def-cuentas-flujo` y `flujo-comparativo` (`Informes.tsx:160-167`) | PG `flujo_caja_renglones` (`nueva`); ADS no | requiere tabla nueva en ADS | No | nada |
| `PUT /api/flujo-caja-renglones` | reemplazar la definicion completa | los mismos dos informes | la misma | requiere tabla nueva en ADS | No | A5-flujo-GET |
| `GET /api/rubros-niif` | rubros NIIF y las cuentas asignadas | Informes: informes `esfa-apertura` y `nic-saldos` | PG `rubros_niif`, `rubro_niif_cuentas` (`nueva`); ADS no | requiere tabla nueva en ADS | No | nada |
| `PUT /api/rubros-niif` | reemplazar rubros y asignaciones | los mismos dos informes | las mismas | requiere tabla nueva en ADS | No | A5-niif-GET |

El tercer informe del mismo grupo, `acum-corriente`, **no** necesita ruta de
configuracion: la clasificacion vive en `cuentas.clasificacion_corriente`, que ya
existe (`db/postgresql/schema/03_maestros.sql:25`); lo que falta es que
`AccountWrite` (`backend/app.py:71-84`) acepte el campo, y eso es una extension
aditiva de `PUT /api/cuentas/{codigo}`, que ya existe (`backend/app.py:1079`). El
sexto, `generador-personalizado`, queda fuera (seccion 6).

### Bloque B. Base de escritura de maestros (prerrequisito de C, D y E)

Es el conjunto de endpoints de escritura que hoy no existe. Sin este bloque todo
lo demas de escritura sigue viviendo en el navegador.

#### B1 y B1b. Terceros

| metodo y ruta | proposito | pantalla y control | tablas que toca | motor | reutiliza | depende de |
|---|---|---|---|---|---|---|
| `PUT /api/terceros/{nit}` | modificar los datos del tercero | Terceros: "Guardar" y "Guardar cambios" de los modales (`Terceros.tsx:184-203`) | PG `terceros`; ADS `FADCLI` | AMBOS | No; `api/terceros.ts` solo tiene `GET` (`44`) y `POST` (`76`), igual que el backend | nada |
| `DELETE /api/terceros/{nit}` | retirar el tercero del directorio | Terceros: "Eliminar" del modal (`Terceros.tsx:214-220`) | PG `terceros`; ADS `FADCLI` | AMBOS | No | B1-PUT |
| `PUT /api/terceros/{nit}/cupo` | cupo de cartera del tercero | Terceros: "Cupos" (`298`, deshabilitado) y "Guardar cupos" (`855`, solo estado) | PG `terceros.cupo`; ADS `FADCLI.CCUPO` | AMBOS | No; el campo ya existe en los dos motores (`terceros_repository.py:120-121`, `postgres_repository.py:365-372`) | nada |
| `POST /api/terceros/importar` | alta masiva desde archivo | Terceros: "Importar" (`296`, deshabilitado) y el modal de importacion (`Terceros.tsx:235-245`) | PG `terceros`; ADS `FADCLI` | AMBOS | No la ruta; reutiliza el lector de archivos (`app.py:740`, `importaciones_repository.read_import_file`) | B1-PUT (el mapeo de columnas usa el mismo contrato de escritura) |

#### B2. Catalogos compartidos

| metodo y ruta | proposito | pantalla y control | tablas que toca | motor | reutiliza | depende de |
|---|---|---|---|---|---|---|
| `POST /api/centros` | crear centro de costo | Centros: "+ Crear centro" (`Centros.tsx:116`, deshabilitado) | PG `centros_costos`; ADS `CONCECOS` | AMBOS | No; el `GET` existe (`app.py:352`) | nada |
| `POST /api/comprobantes` | crear comprobante | Comprobantes: "+ Crear comprobante" (`Comprobantes.tsx:79`) | PG `comprobantes`; ADS `CONTICOM` | AMBOS | No; el `GET` existe (`app.py:384`) | nada |
| `POST /api/tipos-documento` | crear tipo de documento | TiposDocumento: "+ Crear tipo" (`TiposDocumento.tsx:104`) | PG `tipos_documento`; ADS `VISDOCUM`, `CONTIDOC` | AMBOS | No; el `GET` existe (`app.py:369`) | B2-comprobantes (el tipo referencia comprobante, `13_campos_contrato.sql:43`) |

La creacion de estos tres catalogos no agota el ciclo: la auditoria solo pide el
`POST` de los tres botones deshabilitados (`app.py` no tiene hoy ningun `POST`
de estos maestros). La edicion y la baja no las pide ningun control y quedan en
la seccion 6.

#### B3. Persistencia por compania de la configuracion

Cierra H3 (seis pantallas) y la parte de alta y baja de H4 (companias). Las
tablas ya existen (diez, entre el nucleo y los maestros): no hace falta crear
ninguna. El `GET` es obligatorio porque hoy el estado de arranque sale de
`localStorage` (`Companias.tsx:27-33` y sus equivalentes) y tiene que salir del
backend.

| metodo y ruta | proposito | pantalla y control | tablas que toca | motor | reutiliza | depende de |
|---|---|---|---|---|---|---|
| `GET /api/companias` (existe, `app.py:304`) | que el selector y la pantalla vean las companias creadas | Companias: lista y avisos (`Companias.tsx:175-194`); SeleccionCompania (`1` de 4 controles conectado) | PG `companias`, `compania_anios`; ADS `CONEMP` | AMBOS | Si, con extension aditiva: la respuesta gana `soloConsolidacion` y `anios`, sin quitar claves | nada |
| `POST /api/companias` | crear compania | Companias: "Crear" (`Companias.tsx:181-183`) | PG `companias`, `compania_anios`, `periodos_contables`; ADS no | solo PostgreSQL: en el legado una compania es una carpeta de tablas (`db/README.md:106-111`) y el alta la hace el instalador del legado, no una fila | No | nada |
| `PUT /api/companias/{codigo}` | modificar nombre, NIT, estado | Companias: "Guardar" (`Companias.tsx:175-186`) | las mismas | solo PostgreSQL, por lo mismo | No | B3-companias-POST |
| `DELETE /api/companias/{codigo}` | baja logica de la compania | Companias: confirmacion de eliminacion (`Companias.tsx:380-383`) | las mismas | solo PostgreSQL, por lo mismo | No | B3-companias-POST |
| `GET /api/tarifas-iva` | tarifas de IVA de la compania | ConfigIVA: carga inicial (`ConfigIVA.tsx:24-27`) | PG `tarifas_iva`; ADS `CONTIIVA` | AMBOS | No | nada |
| `POST /api/tarifas-iva` | crear tarifa | ConfigIVA: "Guardar"/"Crear" | PG `tarifas_iva`; ADS `CONTIIVA` | AMBOS | No | B3-iva-GET |
| `PUT /api/tarifas-iva/{codigo}` | modificar tarifa | ConfigIVA: "Guardar" | las mismas | AMBOS | No | B3-iva-POST |
| `DELETE /api/tarifas-iva/{codigo}` | baja logica de la tarifa | ConfigIVA: "Eliminar" | las mismas | AMBOS | No | B3-iva-POST |
| `GET /api/conceptos-retencion` | conceptos de retencion | ConfigRetenciones: carga inicial (`24-27`) | PG `conceptos_retencion`; ADS `CONTIRET` | AMBOS | No | nada |
| `POST /api/conceptos-retencion` | crear concepto | ConfigRetenciones: "Guardar"/"Crear" | las mismas | AMBOS | No | B3-ret-GET |
| `PUT /api/conceptos-retencion/{codigo}` | modificar concepto | ConfigRetenciones: "Guardar" | las mismas | AMBOS | No | B3-ret-POST |
| `DELETE /api/conceptos-retencion/{codigo}` | baja logica del concepto | ConfigRetenciones: "Eliminar" | las mismas | AMBOS | No | B3-ret-POST |
| `GET /api/renglones-renta` | renglones de renta | RenglonesRenta: carga inicial (`24-27`) y las 23 filas de tabla | PG `renglones_renta`; ADS `CONDECLA` | AMBOS | No | nada |
| `POST /api/renglones-renta` | crear renglon | RenglonesRenta: "Guardar"/"Crear" | las mismas | AMBOS | No | B3-renta-GET |
| `PUT /api/renglones-renta/{codigo}` | modificar renglon | RenglonesRenta: "Guardar" | las mismas | AMBOS | No | B3-renta-POST |
| `DELETE /api/renglones-renta/{codigo}` | baja logica del renglon | RenglonesRenta: "Eliminar" | las mismas | AMBOS | No | B3-renta-POST |
| `GET /api/plantillas-contables` | plantillas contables y sus parejas de cuentas | Plantillas: carga inicial (`31-34`); CapturaDirecta "F5 Plantilla" (A4) | PG `plantillas_contables`, `plantilla_lineas`; ADS `PLANTICO`, `VISDOCUM`, `CONTIDOC` | AMBOS | No | nada |
| `POST /api/plantillas-contables` | crear plantilla con sus lineas | Plantillas: "Crear" (`158-168`) | las mismas | AMBOS | No | B3-plant-GET |
| `PUT /api/plantillas-contables/{codigo}` | modificar plantilla y sus lineas | Plantillas: "Guardar" | las mismas | AMBOS | No | B3-plant-POST |
| `DELETE /api/plantillas-contables/{codigo}` | baja logica de la plantilla | Plantillas: "Eliminar" | las mismas | AMBOS | No | B3-plant-POST |
| `GET /api/formatos-documentales` | formatos de impresion y sus elementos | FormatosDocumentales: carga inicial (`31-34`) | PG `formatos_documentales`, `formato_elementos`; ADS `CONGENF`, `CONFORMA`, `CONFACTU` | AMBOS | No | nada |
| `POST /api/formatos-documentales` | crear formato con sus elementos | FormatosDocumentales: "Crear" | las mismas | AMBOS | No | B3-form-GET |
| `PUT /api/formatos-documentales/{codigo}` | modificar formato y sus elementos | FormatosDocumentales: "Guardar" | las mismas | AMBOS | No | B3-form-POST |
| `DELETE /api/formatos-documentales/{codigo}` | baja logica del formato | FormatosDocumentales: "Eliminar" | las mismas | AMBOS | No | B3-form-POST |

Las diez tablas de este bloque ya existen en el modelo
(`db/postgresql/schema/03_maestros.sql:180`, `198`, `218`, `238`, `253`, `265`,
`280`; `02_nucleo.sql:11`, `35`, `52`) y tienen contraparte legada nombrada en
`db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md` (CONTIIVA, CONTIRET, CONDECLA, VISDOCUM,
CONTIDOC, CONGENF, CONFORMA, CONFACTU, CONEMP). No se crea ninguna.

### Bloque C. Escritura de movimientos (prerrequisito: B)

Cierra H1 y H2. **No propone ninguna ruta nueva**: las dos que hacen falta
existen y el cliente ya las expone.

| metodo y ruta | proposito | pantalla y control | tablas que toca | motor | reutiliza | depende de |
|---|---|---|---|---|---|---|
| `POST /api/lotes` y `POST /api/lotes/{lote}/detalle` (existen, `app.py:785` y `850`) | guardar el borrador de captura directa como lote real | CapturaDirecta: "Guardar borrador" (`583-585`, manejador `469-517`, aviso en `515` con codigo del navegador) | PG `lotes`, `lote_lineas`; ADS `CONMOVI`, `CONLOTES` | AMBOS | Si; `api/lotes.ts` ya expone `crearLote` (`136`) y `guardarLineaLote` (`148`). El trabajo es de interfaz: encadenar las dos llamadas y usar el codigo que devuelve el backend | nada |
| `POST /api/lotes` y `POST /api/lotes/{lote}/detalle` (existen) | generar lote desde nomina, plantillas, reclasificaciones y reembolsos | Nomina (`134-138`), Plantillas (`158-168`), Reclasificaciones (`232-238`) y Reembolsos (via `onCrearLote`, `App.tsx:130-131`) | las mismas | AMBOS | Si, las mismas dos rutas. El trabajo es de interfaz y hay que retirar el `onCrearLote` de `App.tsx:95-97` | C1 (mismo encadenado) |
| `GET /api/documentos` y `GET /api/documentos/detalle` (existen, `app.py:644` y `676`) | consulta real de movimientos por documento y centro | Reclasificaciones: "Simular" (`196-315`) sobre `movimientosPorDocumento` (`data/configReclasificaciones.ts`) | PG `documentos`, `documento_lineas`; ADS `CONDOCUM`, `MOV01` | AMBOS | Si; el detalle de documento ya devuelve `centro` por partida (`documentos_repository.py:262-272`). El trabajo es de interfaz | C2 (no se puede reclasificar generando lotes fantasma) |
| sin ruta nueva | parseo real del portapapeles y de plantillas guardadas | CapturaDirecta: "F6 Importar Excel" / "Insertar 3 lineas" (`1046-1076`), "Pegar" (`110-114`, `429-431`) | PG `plantillas_contables`, `plantilla_lineas` (lectura); ADS `PLANTICO` | AMBOS | No aplica: es lectura del portapapeles del navegador (`navigator.clipboard`) mas el `GET` de plantillas de B3 | B3-plant-GET |

### Bloque D. Modulos sin backend (prerrequisito: B)

#### D1. Impuestos

Los siete pasos de medios magneticos (`Impuestos.tsx:28`) corresponden, uno a
uno, a tablas que ya existen: formatos (`formatos_exogenos`), conceptos
(`formato_conceptos`), asignacion (`formato_asignaciones`), generacion y
revision (`generaciones_medios`, `medio_filas`), topes y cruces (`medio_topes`,
`medio_conciliaciones`); y los dos tabs de acumulados a `acumulados_retencion` y
`acumulados_iva`. La contraparte legada existe (CONMAG1, CONMAG2, CONMAG3,
CONMAGDT, CONRET, CONIVA), asi que el bloque es de doble motor.

| metodo y ruta | proposito | pantalla y control | tablas que toca | motor | reutiliza | depende de |
|---|---|---|---|---|---|---|
| `GET /api/impuestos/acumulados-iva` | acumulado de IVA por tercero y periodo | Impuestos, tab IVA: tabla y filtros | PG `acumulados_iva`; ADS `CONIVA` | AMBOS | No | nada |
| `POST /api/impuestos/acumulados-iva/acumular` | recalcular el acumulado al periodo | Impuestos: "Acumular" (`230-238`) | PG `acumulados_iva`, `estado_acumulaciones`; ADS `CONIVA` | AMBOS | No | D1-iva-GET |
| `GET /api/impuestos/acumulados-iva/exportar` | exportar el acumulado | Impuestos: "Exportar IVA" (`663-672`) | las mismas | AMBOS | No | D1-iva-GET |
| `GET /api/impuestos/acumulados-retenciones` | acumulado de retenciones | Impuestos, tab retenciones | PG `acumulados_retencion`; ADS `CONRET` | AMBOS | No | nada |
| `POST /api/impuestos/acumulados-retenciones/acumular` | recalcular retenciones | Impuestos: "Acumular" (`230-238`) | PG `acumulados_retencion`, `estado_acumulaciones`; ADS `CONRET` | AMBOS | No | D1-ret-GET |
| `GET /api/impuestos/acumulados-retenciones/exportar` | exportar retenciones | Impuestos: "Exportar retenciones" (`426-436`) | las mismas | AMBOS | No | D1-ret-GET |
| `GET /api/impuestos/formatos` | formatos de exogena con vigencias | Impuestos, paso "Formatos" | PG `formatos_exogenos`; ADS `CONMAG1` | AMBOS | No | nada |
| `POST /api/impuestos/formatos` | crear formato | Impuestos: "Agregar formato" (`258-268`) | las mismas | AMBOS | No | D1-form-GET |
| `PUT /api/impuestos/formatos/{codigo}` | modificar formato | Impuestos: edicion del formato | las mismas | AMBOS | No | D1-form-POST |
| `DELETE /api/impuestos/formatos/{codigo}` | baja logica del formato | Impuestos: "Eliminar formato" (`749-754`) | las mismas | AMBOS | No | D1-form-POST |
| `PUT /api/impuestos/formatos/{codigo}/conceptos` | reemplazar los conceptos del formato | Impuestos, paso "Conceptos" | PG `formato_conceptos`; ADS `CONMAG2` | AMBOS | No | D1-form-GET |
| `PUT /api/impuestos/formatos/{codigo}/asignaciones` | reemplazar las cuentas asignadas al formato | Impuestos, paso "Asignacion cuentas" | PG `formato_asignaciones`; ADS `CONMAG3` | AMBOS | No; el arbol de cuentas viene de `GET /api/cuentas` (existe) | D1-form-GET |
| `POST /api/impuestos/formatos/copiar` | copiar las definiciones de otra compania | Impuestos: "Copiar definiciones" (`304-310`) | las tres anteriores | AMBOS | No | D1-form-GET |
| `GET /api/impuestos/medios` | generaciones de medios con su estado | Impuestos, paso "Generacion" y "Revision" | PG `generaciones_medios`; ADS `CONMAGDT` | AMBOS | No | nada |
| `POST /api/impuestos/medios` | generar el medio magnetico del ano | Impuestos: "Generar medios magneticos" (`207-215`) | PG `generaciones_medios`, `medio_filas`, `medio_conciliaciones`; ADS `CONMAGDT` | AMBOS | No | D1-medios-GET |
| `GET /api/impuestos/medios/{id}` | filas del medio para revision | Impuestos, paso "Revision" | PG `medio_filas`; ADS `CONMAGDT` | AMBOS | No | D1-medios-POST |
| `PUT /api/impuestos/medios/{id}/filas/{filaId}` | ajustar una fila revisada | Impuestos: edicion de fila del medio | PG `medio_filas`; ADS `CONMAGDT` | AMBOS | No | D1-medios-detalle |
| `GET /api/impuestos/medios/{id}/conciliacion` | topes, exclusiones y cuadre | Impuestos, paso "Topes y cruces" | PG `medio_topes`, `medio_conciliaciones`; ADS `CONMAG2`, `CONMAGDT` | AMBOS | No | D1-medios-detalle |
| `PUT /api/impuestos/topes` | reemplazar los topes del ano | Impuestos, paso "Topes y cruces" | PG `medio_topes`; ADS `CONMAG2` | AMBOS | No | D1-medios-GET |
| `GET /api/impuestos/medios/{id}/exportar` | descargar el medio | Impuestos, paso "Exportacion" y "Descargar" (`1164-1167`) | las mismas | AMBOS | No | D1-medios-detalle |

Los certificados y anexos del portal (`248-254`, y la tabla de soportes) quedan
fuera: la auditoria los lista dentro de H10, pero la contraparte de modelo esta
declarada "Sin estructura" y exige repositorio privado, publicacion y
autorizacion por tercero (`db/old_db/MATRIZ_PROCESOS_Y_OPCIONES.md`, P23). Ver
seccion 6.

#### D2. Cierres

| metodo y ruta | proposito | pantalla y control | tablas que toca | motor | reutiliza | depende de |
|---|---|---|---|---|---|---|
| `GET /api/cierres` | estado del cierre del ano y checklist calculado | Cierres: los siete items (`Cierres.tsx:1-19`) y la vista previa | PG `cierres`, `lotes`, `documentos`; ADS no | requiere tabla nueva en ADS: `cierres` no tiene contraparte legada | No | B (los items de checklist se derivan de lotes y documentos) |
| `POST /api/cierres` | abrir el cierre del ano con el checklist del momento | Cierres: apertura de la vista previa | PG `cierres`, `periodos_contables`; ADS no | requiere tabla nueva en ADS | No | D2-consulta |
| `POST /api/cierres/{id}/lote` | generar el lote de cierre | Cierres: "Generar lote de cierre" (`177-180`, hoy solo cierra el modal) | PG `cierres`, `lotes`, `lote_lineas`, `cuentas`; ADS no | requiere tabla nueva en ADS | No la ruta; reutiliza `POST /api/lotes` y `POST /api/lotes/{lote}/detalle` por dentro | D2-POST |
| `POST /api/cierres/{id}/traslado` | registrar el traslado de periodos de ajuste | Cierres: "Iniciar asistente de traslado" (`118-122`, sin manejador) | PG `cierre_traslados`, `cierres`, `documentos`; ADS no | requiere tabla nueva en ADS | No | D2-POST |

Advertencia de alcance declarada por los datos: los periodos 13 a 18 **no
existen en la copia disponible** (`db/migration/homologacion/PENDIENTES.md:44`,
decision P-5). El traslado se persiste y se prueba con periodos sembrados, pero
no se puede conciliar contra el origen de la copia. Ademas la parte funcional
del cierre (algoritmo de resultado y apertura del ano siguiente) esta declarada
pendiente en `db/migration/03_plan_de_carga.md:156-162`: este plan implementa la
persistencia, el checklist y la generacion del lote, y **no** decide el
algoritmo.

#### D3. Consolidacion

| metodo y ruta | proposito | pantalla y control | tablas que toca | motor | reutiliza | depende de |
|---|---|---|---|---|---|---|
| `GET /api/consolidaciones` | consolidaciones del ano destino | Consolidacion: cabecera y chips de paso (`39-44`) | PG `consolidaciones`, `consolidacion_origenes`; ADS `CONSOLID` | AMBOS | No | nada |
| `POST /api/consolidaciones` | configurar destino, origenes y homologaciones | Consolidacion: chips de origen (`64-74`) y confirmacion | PG `consolidaciones`, `consolidacion_origenes`, `consolidacion_cuentas`, `consolidacion_centros` (`nueva`); ADS `CONSOLID` parcial | AMBOS para la cabecera y los origenes; `requiere tabla nueva en ADS` para las homologaciones: la brecha "falta persistir correspondencias de cuentas/centros" esta declarada para CONSOLID | No | D3-consulta |
| `GET /api/consolidaciones/{id}` | orígenes, homologaciones, simulacion y totales | Consolidacion: pasos "Verificar compatibilidad" y "Comparar totales" | las mismas | AMBOS / requiere tabla nueva en ADS | No | D3-POST |
| `POST /api/consolidaciones/{id}/simular` | simular sin escribir en el libro | Consolidacion: paso "Simulacion" | las mismas mas `saldos_cuenta` en los dos motores (`CONMAE` en ADS) | AMBOS / requiere tabla nueva en ADS | No | D3-detalle |
| `POST /api/consolidaciones/{id}/ejecutar` | ejecutar la consolidacion | Consolidacion: pasos "Respaldo y confirmacion", "Ejecucion" y "Revalorizar" (`187-189`) | las mismas mas la escritura del libro | `requiere tabla nueva en ADS` | No | D3-simular |

El algoritmo de consolidacion esta declarado pendiente junto con el de cierre
(`db/migration/03_plan_de_carga.md:156-162`). Este plan implementa el estado, la
homologacion y la simulacion; la ejecucion queda condicionada a esa decision y
asi se declara en la seccion 6.

#### D4. Reorganizacion y mantenimiento

| metodo y ruta | proposito | pantalla y control | tablas que toca | motor | reutiliza | depende de |
|---|---|---|---|---|---|---|
| `GET /api/mantenimiento` | estado del modo mantenimiento y quien lo tiene | Reorganizacion: cabecera (`40-50`) | PG `procesos` | solo PostgreSQL: es sustitucion tecnica del mantenimiento del legado (indices ADI y `COPY STRUC`), que el servicio no puede ejecutar sobre ADS (P36) | No | nada |
| `POST /api/mantenimiento` | entrar en mantenimiento con respaldo confirmado | Reorganizacion: "Iniciar mantenimiento" (`185-187`) | PG `procesos`, `auditoria` | solo PostgreSQL | No | D4-estado |
| `DELETE /api/mantenimiento` | volver al estado normal | Reorganizacion: "Volver al estado normal" (`72-82`) | PG `procesos`, `auditoria` | solo PostgreSQL | No | D4-estado |
| `POST /api/reorganizaciones` | ejecutar la compactacion o reindexacion | Reorganizacion: confirmacion (`72-76`) | PG `procesos` | solo PostgreSQL | No | D4-entrar |
| `GET /api/reorganizaciones/{id}` | resultado y conteos de la ejecucion | Reorganizacion: barra de progreso | PG `procesos` | solo PostgreSQL | No | D4-ejecutar |

#### D5, D6 y D7. Administracion

| metodo y ruta | proposito | pantalla y control | tablas que toca | motor | reutiliza | depende de |
|---|---|---|---|---|---|---|
| `GET /api/usuarios` | usuarios con rol, estado y companias | UsuariosPermisos: estado inicial (`92-102`) | PG `usuarios`, `roles`, `usuario_companias`; ADS `VISUSU` | AMBOS | No | nada |
| `POST /api/usuarios` | crear usuario | UsuariosPermisos: crear (`129-137`) | las mismas | AMBOS | No | D5-usuarios-GET |
| `PUT /api/usuarios/{id}` | modificar usuario | UsuariosPermisos: editar (`129-137`) | las mismas | AMBOS | No | D5-usuarios-POST |
| `DELETE /api/usuarios/{id}` | baja logica del usuario | UsuariosPermisos: eliminar (`141-145`) | las mismas | AMBOS | No | D5-usuarios-POST |
| `GET /api/roles` | roles y los permisos de cada uno | UsuariosPermisos: matriz de permisos (`147-151`) | PG `roles`, `permisos`, `rol_permisos`; ADS `VISUSU`, `CONOPER` | AMBOS | No | nada |
| `PUT /api/roles/{codigo}/permisos` | reemplazar los permisos del rol | UsuariosPermisos: marcar permisos (`147-151`) | PG `rol_permisos`, `permisos`; ADS `VISUSU` | AMBOS | No | D5-roles-GET |
| `PUT /api/usuarios/{id}/companias` | companias a las que accede el usuario | UsuariosPermisos: campo companias | PG `usuario_companias`; ADS no | requiere tabla nueva en ADS: acceso por empresa es aporte del modelo (`db/postgresql/schema/08_seguridad.sql:94-101`) | No | D5-usuarios-GET |
| (transversal) verificacion de permisos por operacion | que el permiso rija de verdad | Shell y cabeceras; razon de H7 | PG `rol_permisos`, `usuario_companias`; ADS no | solo PostgreSQL: el original devolvia verdadero en la comprobacion de permisos y ese atajo no se traslada (P28) | No | D5-usuarios y permisos |
| `GET /api/auditoria` | bitacora real, paginada y filtrada | Bitacora: tabla (`Bitacora.tsx:14-24` es el mock) y texto de cabecera (`72`) | PG `auditoria`; ADS `VISAUDI` | AMBOS; en ADS hace falta una funcion de lectura nueva sobre `VISAUDI`, porque `auditoria_repository.py` hoy solo escribe (`55`, `74`, `94`) | No | B (los modulos que escriben son los que llenan la bitacora) |
| `GET /api/auditoria/exportar` | exportar la bitacora filtrada | Bitacora: "Exportar XLSX" (`58-64`, `setTimeout` y aviso "(simulado)") | las mismas | AMBOS | No | D6-consulta |
| `GET /api/integraciones` | estado real de cada integracion | Integraciones: tabla de estado (`104-115`) | PG `integraciones`; ADS no | requiere tabla nueva en ADS: la contraparte es "Integracion requerida" y guarda configuracion, no los registros del modulo (P30) | No | nada |
| `PUT /api/integraciones/{modulo}` | cambiar estado y configuracion declarada | Integraciones: "Probar conexion" (`116-125`) no; la configuracion del modulo | las mismas | requiere tabla nueva en ADS | No | D7-consulta |

#### Especiales (H6)

La auditoria describe el hallazgo y su cierre, pero **no le asigna bloque** en su
seccion 4: H6 no aparece en A, B, C, D ni E (D6 solo lo menciona como
beneficiado). Este plan lo ubica en D porque toca el plan de cuentas y su
registro obligatorio va a la bitacora de D6; el orden de las secciones 5 lo deja
en el ultimo lugar del bloque, para no retrasar D1 a D7.

| metodo y ruta | proposito | pantalla y control | tablas que toca | motor | reutiliza | depende de |
|---|---|---|---|---|---|---|
| `GET /api/especiales/cuentas-en-cero` | analizar cuentas sin saldo ni movimiento | Especiales: seccion "Analizar plan" (`40-44`) | PG `cuentas`, `saldos_cuenta`, `documento_lineas`; ADS `CONMAE`, `MOV01` | AMBOS | No | nada |
| `POST /api/especiales/cuentas-en-cero/eliminar` | eliminar cuentas en cero con motivo | Especiales: "Ejecutar funcion" (`58-69`, `97-105`) | PG `cuentas`, `auditoria`; ADS `CONMAE`, `VISAUDI` | AMBOS; en ADS hace falta `delete_account`, que hoy no existe en ningun repositorio | No | Especiales-analisis; D6 para que la afirmacion "quedo en la bitacora" sea cierta |

La "Fusion de movimientos" de la misma pantalla esta marcada "Funcionalidad en
preparacion" (`Especiales.tsx:40-44`) y no tiene hallazgo ni contraparte: queda
fuera (seccion 6).

### Bloque E. Reasignacion de NIT y robustez

| metodo y ruta | proposito | pantalla y control | tablas que toca | motor | reutiliza | depende de |
|---|---|---|---|---|---|---|
| `POST /api/terceros/{nit}/reasignar` | reescribir las referencias contables de un NIT | Terceros: "Reasignar NIT" (`299-305`, deshabilitado) | PG `terceros`, `documento_lineas`, `lote_lineas`, `saldos_cuenta_tercero`, `acumulados_tercero`, `reembolsos`; ADS `FADCLI`, `MOV01`, `CONTERCE`, `FADCTAS` | solo PostgreSQL: en el legado la reasignacion no tiene rutina rastreada (`db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md` solo la menciona al conservar campos de FADCLI y CONEMP) y la operacion reescribe el libro | No | B1 |
| `GET /api/reembolsos` | reembolsos de la compania y su estado | Reembolsos: lista (el modulo no tiene conexion) | PG `reembolsos`, `reembolso_lineas`; ADS no | requiere tabla nueva en ADS: CONREMAE y CONREITE estan declaradas "Sin estructura, estructura fisica no localizada" | No | B |
| `POST /api/reembolsos` | crear el reembolso con sus lineas | Reembolsos: "Guardar" (`224`) | las mismas | requiere tabla nueva en ADS | No | E2-consulta |
| `PUT /api/reembolsos/{numero}` | modificar el borrador | Reembolsos: "Guardar borrador" (`175-179`, hoy `localStorage`) | las mismas | requiere tabla nueva en ADS | No | E2-POST |
| `POST /api/reembolsos/{numero}/aplicar` | aplicar el reembolso sobre un lote real | Reembolsos: "Generar lote" (`224`) | las mismas mas `lotes`, `lote_lineas` | requiere tabla nueva en ADS | No la ruta; reutiliza `POST /api/lotes` y `POST /api/lotes/{lote}/detalle` | C2 |
| sin ruta nueva | H16: `disabled` en las acciones de Lotes | Lotes: "Ver detalle" (`204`) y las acciones de partida (`368`) | ninguna | no aplica | No aplica; es interfaz | nada |
| sin ruta nueva | H17: manejador propio en los botones de Informes | Informes: botones de tarjeta (`695`, `738`; contenedor con `onClick` en `678` y `720`) | ninguna | no aplica | No aplica; es interfaz | nada |
| `POST /api/terceros` (existe, `app.py:339`) | H18: regla de validacion de tercero en el backend | CrearTerceroModal (`51-55`) contra `ThirdPartyCreate` (`app.py:96-116`) | PG `terceros`; ADS `FADCLI` | AMBOS | Si, con extension del modelo `ThirdPartyCreate`: primer nombre, primer apellido y segundo apellido exigidos para tipo 13 y formato de correo | nada |

### 2.9 Resumen del inventario

| Bloque | Filas | Rutas nuevas | Filas que reutilizan una ruta | Filas solo de interfaz | Tablas nuevas |
|---|---:|---:|---:|---:|---:|
| A. Cableado sin prerrequisito | 11 | 0 | 10 | 7 | 0 |
| B. Base de escritura de maestros | 31 | 30 | 1 | 0 | 0 |
| C. Escritura de movimientos | 4 | 0 | 4 | 4 | 0 |
| D1. Impuestos | 20 | 20 | 1 | 0 | 0 |
| D2. Cierres | 4 | 4 | 0 | 0 | 0 |
| D3. Consolidacion | 5 | 5 | 0 | 0 | 2 |
| D4. Reorganizacion | 5 | 5 | 0 | 0 | 0 |
| D5. Usuarios y permisos | 8 | 7 | 0 | 0 | 0 |
| D6. Bitacora | 2 | 2 | 0 | 0 | 0 |
| D7. Integraciones | 2 | 2 | 0 | 0 | 0 |
| Especiales | 2 | 2 | 0 | 0 | 0 |
| E. Reasignacion y robustez | 8 | 5 | 1 | 2 | 0 |
| A5. Configuracion de informes | 4 | 4 | 0 | 0 | 3 |
| **Total** | **106** | **86** | **17** | **13** | **5** |

Las rutas nuevas distintas son **86**. Las filas que **reutilizan una ruta
existente** son **17**, sobre **11 rutas distintas**: `GET /api/documentos`,
`GET /api/documentos/detalle`, `GET /api/lotes`, `POST /api/lotes`,
`POST /api/lotes/{lote}/detalle`, `GET /api/informes/balance-comprobacion`,
`GET /api/informes/balance-comprobacion/exportar`,
`GET /api/informes/adicionales/{report_id}` (que cubre los dos informes
reutilizados), `POST /api/terceros`, `GET /api/cuentas` y `GET /api/companias`.
Las filas que son **trabajo solo de interfaz** (sin endpoint nuevo ni contrato
nuevo) son **13**.

---

## 3. Detalle por endpoint

El detalle de contrato de las 86 rutas nuevas esta en los archivos de
`detalle/`, por modulo, con la misma estructura en cada ruta: proposito,
request, response, quien lo consume, reglas de negocio y criterio de aceptacion.

| Archivo | Rutas nuevas |
|---|---:|
| `detalle/maestros.md` | 7 |
| `detalle/configuracion.md` | 23 |
| `detalle/movimientos.md` | 5 |
| `detalle/impuestos.md` | 22 |
| `detalle/procesos.md` | 14 |
| `detalle/administracion.md` | 11 |
| `detalle/informes.md` | 4 |

Las filas que reutilizan una ruta existente y las que son trabajo solo de
interfaz no tienen apartado de contrato aqui: su especificacion es el cambio de
interfaz descrito en la tabla del punto 2 y, cuando aplica, el `GET`/`POST` que
ya existe, citado con su linea.

---

## 4. Tablas nuevas

Solo cinco tablas faltan de verdad, en dos archivos de esquema, siguiendo el
estilo de `db/postgresql/schema/` (comentario de cabecera, `BEGIN`/`COMMIT`,
tipos de dominio, `compania_id`, columnas de auditoria, disparador
`auditoria_antes_update()` y clave unica `(compania_id, id)` para las FK
compuestas). Verificacion previa: ninguna de estas cinco existe en
`db/postgresql/schema/` (65 tablas) ni en `db/advantage/01_tablas.sql` (60
tablas).

### 4.1 `db/postgresql/schema/15_flujo_caja_niif.sql`

```sql
-- =====================================================================
-- CONTABDSI · 15_flujo_caja_niif.sql
-- Configuracion de los informes que el modelo no tenia: definicion de cuentas
-- de flujo de caja y clasificacion NIIF de las cuentas.
--
-- Evidencia de la carencia:
--   * backend/informes_adicionales_repository.py:433-441 declara que el flujo
--     de caja "requiere la definicion de cuentas del sistema original" y que
--     los informes NIC/NIIF "requieren configurar la clasificacion contable y
--     los tipos documentales".
--   * db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md (CONMAE) declara la brecha:
--     "faltan reglas/campos fiscales, NIIF, clasificacion corriente".
--   * db/migration/homologacion/PENDIENTES.md:98 se cerro NO modelar los 37
--     campos NIIF de CONMAE en `cuentas`, asi que la clasificacion no va como
--     columna del maestro sino como asignacion aparte, igual que
--     `formato_asignaciones` (06_impuestos.sql:42).
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Definicion de flujo de caja: un renglon por linea del estado de flujo,
-- con la cuenta del plan que lo alimenta y su signo.
-- -------------------------------------------------------------------
CREATE TABLE flujo_caja_renglones (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id     bigint NOT NULL REFERENCES companias (id),
  codigo          text NOT NULL,                              -- 'OP01', 'INV03', 'FIN02'
  nombre          text NOT NULL,                              -- 'Efectivo de actividades de operacion'
  grupo           text NOT NULL CHECK (grupo IN
                    ('Operacion', 'Inversion', 'Financiacion')),
  orden           integer NOT NULL DEFAULT 0,
  cuenta_id       bigint NOT NULL,
  signo           integer NOT NULL DEFAULT 1 CHECK (signo IN (-1, 1)), -- igual que renglones_renta
  eliminado_en    timestamptz,
  creado_en       timestamptz,
  creado_por      integer,
  actualizado_en  timestamptz,
  actualizado_por integer,
  version         integer NOT NULL DEFAULT 0,
  CONSTRAINT flujo_caja_renglones_codigo_uk UNIQUE (compania_id, codigo),
  CONSTRAINT flujo_caja_renglones_compania_id_uk UNIQUE (compania_id, id),
  CONSTRAINT flujo_caja_renglones_cuenta_fk FOREIGN KEY (compania_id, cuenta_id)
    REFERENCES cuentas (compania_id, id)
);

-- -------------------------------------------------------------------
-- Rubros NIIF (ESFA y estado de resultados) por compania.
-- -------------------------------------------------------------------
CREATE TABLE rubros_niif (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id     bigint NOT NULL REFERENCES companias (id),
  codigo          text NOT NULL,                              -- 'AC-P1', 'PT-03', 'ING-01'
  nombre          text NOT NULL,
  informe         text NOT NULL CHECK (informe IN ('ESFA', 'ER')),
  tipo            text NOT NULL CHECK (tipo IN
                    ('Activo Corriente', 'Activo No Corriente',
                     'Pasivo Corriente', 'Pasivo No Corriente',
                     'Patrimonio', 'Ingreso', 'Costo', 'Gasto', 'Orden')),
  orden           integer NOT NULL DEFAULT 0,
  eliminado_en    timestamptz,
  creado_en       timestamptz,
  creado_por      integer,
  actualizado_en  timestamptz,
  actualizado_por integer,
  version         integer NOT NULL DEFAULT 0,
  CONSTRAINT rubros_niif_codigo_uk UNIQUE (compania_id, codigo),
  CONSTRAINT rubros_niif_compania_id_uk UNIQUE (compania_id, id)
);

-- -------------------------------------------------------------------
-- Asignacion de cuentas del plan a cada rubro (arbol con checkbox).
-- -------------------------------------------------------------------
CREATE TABLE rubro_niif_cuentas (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rubro_id    bigint NOT NULL REFERENCES rubros_niif (id) ON DELETE CASCADE,
  compania_id bigint NOT NULL REFERENCES companias (id),
  cuenta_id   bigint NOT NULL,
  CONSTRAINT rubro_niif_cuentas_uk UNIQUE (rubro_id, cuenta_id),
  CONSTRAINT rubro_niif_cuentas_cuenta_fk FOREIGN KEY (compania_id, cuenta_id)
    REFERENCES cuentas (compania_id, id)
);

CREATE TRIGGER trg_flujo_caja_renglones_auditoria BEFORE UPDATE ON flujo_caja_renglones
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_rubros_niif_auditoria BEFORE UPDATE ON rubros_niif
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();

COMMIT;
```

### 4.2 `db/postgresql/schema/16_consolidacion_homologacion.sql`

```sql
-- =====================================================================
-- CONTABDSI · 16_consolidacion_homologacion.sql
-- Homologacion de cuentas y centros entre companias de una consolidacion.
--
-- Evidencia de la carencia: db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md (CONSOLID)
-- declara que `consolidaciones` y `consolidacion_origenes` no bastan:
-- "falta persistir correspondencias de cuentas/centros y procedencia de cada
-- resultado", y lo repite en la validacion por proceso P27.
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Correspondencia de cuentas origen -> destino. La compania de origen hace
-- parte de la clave porque dos origenes pueden compartir codigo de cuenta.
-- -------------------------------------------------------------------
CREATE TABLE consolidacion_cuentas (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  consolidacion_id   bigint NOT NULL REFERENCES consolidaciones (id) ON DELETE CASCADE,
  compania_origen_id bigint NOT NULL REFERENCES companias (id),
  cuenta_origen_id   bigint NOT NULL,
  cuenta_destino_id  bigint NOT NULL,
  signo              integer NOT NULL DEFAULT 1 CHECK (signo IN (-1, 1)), -- cruces que invierten
  CONSTRAINT consolidacion_cuentas_uk UNIQUE
    (consolidacion_id, compania_origen_id, cuenta_origen_id),
  CONSTRAINT consolidacion_cuentas_origen_fk FOREIGN KEY (compania_origen_id, cuenta_origen_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT consolidacion_cuentas_destino_fk FOREIGN KEY (compania_origen_id, cuenta_destino_id)
    REFERENCES cuentas (compania_id, id)
);

-- -------------------------------------------------------------------
-- Correspondencia de centros de costo origen -> destino (misma regla).
-- -------------------------------------------------------------------
CREATE TABLE consolidacion_centros (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  consolidacion_id   bigint NOT NULL REFERENCES consolidaciones (id) ON DELETE CASCADE,
  compania_origen_id bigint NOT NULL REFERENCES companias (id),
  centro_origen_id   bigint NOT NULL,
  centro_destino_id  bigint NOT NULL,
  CONSTRAINT consolidacion_centros_uk UNIQUE
    (consolidacion_id, compania_origen_id, centro_origen_id),
  CONSTRAINT consolidacion_centros_origen_fk FOREIGN KEY (compania_origen_id, centro_origen_id)
    REFERENCES centros_costos (compania_id, id),
  CONSTRAINT consolidacion_centros_destino_fk FOREIGN KEY (compania_origen_id, centro_destino_id)
    REFERENCES centros_costos (compania_id, id)
);

COMMIT;
```

Nota sobre las FK de la 16: la clave destino se resuelve en la compania destino
de la consolidacion, no en la de origen; el DDL propuesto arriba conserva la
sintaxis de FK compuesta del esquema, pero la implementacion debe decidirlo con
el caso real delante (la compania destino es la que recibe el asiento). Es la
unica arista del plan que no queda cerrada por el DDL y asi se declara.

### 4.3 Que endpoints usan cada tabla nueva

| Tabla nueva | Endpoints |
|---|---|
| `flujo_caja_renglones` | `GET /api/flujo-caja-renglones`, `PUT /api/flujo-caja-renglones` |
| `rubros_niif` | `GET /api/rubros-niif`, `PUT /api/rubros-niif` |
| `rubro_niif_cuentas` | las mismas dos rutas (la asignacion viaja en el cuerpo) |
| `consolidacion_cuentas` | `POST /api/consolidaciones`, `GET /api/consolidaciones/{id}`, `POST /api/consolidaciones/{id}/simular`, `POST /api/consolidaciones/{id}/ejecutar` |
| `consolidacion_centros` | las mismas cuatro rutas |

Son **8 endpoints** sobre 5 tablas nuevas. Los otros 78 endpoints nuevos usan
tablas que ya existen.

### 4.4 Columnas nuevas: ninguna

No hace falta ninguna columna. Los dos casos que parecian pedirla ya estan
resueltos en el esquema:

- clasificacion corriente o no corriente: `cuentas.clasificacion_corriente`
  existe (`db/postgresql/schema/03_maestros.sql:25`); lo que falta es que el
  contrato de escritura la acepte (`AccountWrite`, `backend/app.py:71-84`), y eso
  es una extension aditiva de una ruta existente, no una tabla.
- cupo de cartera: `terceros.cupo` existe y los dos motores ya lo leen y lo
  escriben (`backend/terceros_repository.py:120-121`,
  `backend/postgres_repository.py:365-372`).

---

## 5. Orden de implementacion

### 5.1 Bloques, dependencias y que desbloquea cada uno

```
A  (sin prerrequisito)
 |
 B  (sin prerrequisito)
 |\
 | C  (necesita B para plantillas y reembolsos)
 | D  (necesita B para los catalogos que referencian)
 | E  (E1 y E2 necesitan B y C2)
 |
 A5 (configuracion de informes; independiente de B y C)
```

| Orden | Bloque | Prerrequisito | Que desbloquea |
|---:|---|---|---|
| 1 | A | ninguno | Deja de mostrar datos falsos en DocumentoOficial, Dashboard y BalanceComprobacion, y da contenido a la pestana Informes de Terceros; deja A4 listo para cerrarse cuando B3 entregue el `GET` de plantillas |
| 2 | B | ninguno | Toda la escritura de maestros y de configuracion; es prerrequisito de C, D y E |
| 3 | C | B solo para C4 | El ciclo real de lotes desde las seis pantallas (H1 y H2, que son los dos hallazgos de mayor costo de confianza) |
| 4 | D1 Impuestos | B para el arbol de cuentas | El modulo con mas controles del aplicativo (69) |
| 5 | A5 Informes | D1 no; necesita sus tablas nuevas | Los seis informes "Pendiente" |
| 6 | D2 Cierres y D3 Consolidacion | B; D2 depende de D6 para el registro del motivo del cierre | El estado de cierre y el de consolidacion, y la generacion del lote de cierre |
| 7 | D6 Bitacora | B para tener acciones que registrar | Vuelve cierta la frase de Especiales sobre el registro en bitacora y refuerza D2, D3 y D4 |
| 8 | D4 Reorganizacion | D6 | El modo mantenimiento deja de ser un estado de React |
| 9 | Especiales | D6 | Cierra H6, incluida la afirmacion sobre la bitacora |
| 10 | D5 Usuarios y permisos | B | El alta de usuarios y la matriz de permisos; el control de acceso efectivo es transversal y va despues (afecta a todas las rutas) |
| 11 | D7 Integraciones | nada, pero aporta poco sin los conectores | Estado real de las integraciones; los conectores reales quedan fuera de alcance |
| 12 | E | B y C2 | Reasignacion de NIT, reembolsos sobre el lote real y los tres hallazgos bajos |

### 5.2 El primer bloque que se puede hacer sin prerrequisitos

**A, y dentro de A los seis primeros items (A1, A2 y A3).** No es una decision de
conveniencia: la auditoria lo deja primero porque A1, A2 y A3 **no crean
funcionalidad nueva**, consumen rutas que ya existen y estan verificadas
(`app.py:676`, `726`, `644`, `944`) y clientes que ya existen
(`api/balanceComprobacion.ts:47` y `59`). No dependen de ninguna tabla nueva ni
de ningun otro bloque, y su efecto se ve en pantalla el mismo dia: H11, H12 y H13
se cierran sin tocar el backend. El unico item de A con prerrequisito es A4, que
espera el `GET` de plantillas de B3.

**B tambien se puede empezar en paralelo a A**, porque no depende de nada. La
razon para hacer A primero es de costo y de riesgo: A se cierra sin escribir SQL
y sin tocar el modelo, B obliga a escribir en los dos motores.

**A5 puede ir en paralelo con B**, porque sus cuatro rutas y sus tres tablas son
independientes del resto del plan.

---

## 6. Alcance declarado

Lo que este plan **no** va a implementar, y por que.

1. **Conectores externos reales de Integraciones.** La contraparte del legado
   esta declarada "Integracion requerida": `integraciones` guarda configuracion y
   estado, no los registros del modulo origen (`db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`,
   P30). Solo se implementan la consulta y la configuracion del estado; "Probar
   conexion" y "Sincronizar" (`Integraciones.tsx:116-125`) siguen simulados hasta
   que exista la definicion del conector. Cerrar H8 con un resultado fijo pero
   marcado como simulado es preferible a afirmar una sincronizacion que no ocurre.

2. **Certificados y anexos en el portal DIAN.** Requieren repositorio privado,
   publicacion, autorizacion por tercero y trazabilidad de huella
   (`db/old_db/MATRIZ_PROCESOS_Y_OPCIONES.md`, P23, "Sin estructura"). Es una
   decision de producto (donde viven los archivos, quien los firma, que portal) y
   no se puede deducir del legado.

3. **Generador de informes personalizado** (`Informes.tsx:160-167`, id
   `generador-personalizado`). Depende de una decision de producto sobre el
   alcance del generador: que campos, que filtros y si el usuario define
   formulas. La auditoria lo lista entre los seis informes pendientes, y este
   plan implementa los otros cinco; este queda declarado.

4. **Algoritmos de cierre y de consolidacion.** La persistencia, el checklist, la
   homologacion y la simulacion entran; la ejecucion que reescribe el libro no,
   porque la parte funcional de B13 esta declarada pendiente
   (`db/migration/03_plan_de_carga.md:156-162`) y el algoritmo de resultado del
   ejercicio no se puede deducir de la copia.

5. **Traslado de periodos 13 a 18 conciliado.** La ruta se implementa, pero la
   copia no tiene esos periodos (`db/migration/homologacion/PENDIENTES.md:44`,
   decision P-5). Se prueba con periodos sembrados y se declara que no hay
   conciliacion contra el origen.

6. **Edicion y baja de centros, comprobantes y tipos de documento.** Ningun
   control las pide; los tres botones estan deshabilitados y son de alta. Anadir
   un `PUT` y un `DELETE` sin pantalla que los use seria funcionalidad sin
   consumidor.

7. **Rama Advantage de la reasignacion de NIT, del alta de compania, de los
   reembolsos y del modo mantenimiento.** Estan declaradas en la columna *motor*
   con su justificacion (seccion 2). En Advantage requieren crear antes la tabla
   en el diccionario, y en el caso del alta de compania y del mantenimiento,
   ademas, un procedimiento que el servicio no puede ejecutar sobre ADS.

8. **"Fusion de movimientos" de Especiales.** No tiene hallazgo, no tiene
   contraparte y la propia pantalla la marca "Funcionalidad en preparacion"
   (`Especiales.tsx:40-44`).

9. **Los controles que son locales por diseno.** Los filtros de pantalla, la
   navegacion, la apertura de modales y la impresion del navegador siguen siendo
   locales: el mapa los cuenta como locales o simulados, pero no todos son
   hallazgo. Este plan solo convierte los que prometen persistencia o ejecucion
   (hallazgos H1 a H18).

10. **Autenticacion.** El backend no tiene hoy ninguna forma de identificar al
    usuario (`usuario` viaja como texto de 4 caracteres, `backend/app.py:144`) y
    los dos motores carecen de identidad. El control de acceso efectivo de D5 se
    implementa como verificacion de permisos por operacion con el actor que se
    declare en la peticion; la autenticacion real queda fuera y hay que decidirla
    con el area de infraestructura.

---

## 7. Verificacion

### 7.1 Como se prueba cada endpoint

| Nivel | Como | Donde |
|---|---|---|
| Unitario de repositorio | Prueba por archivo de repositorio, con el patrón que ya existe: mapeo de fila del legado y normalizacion de la escritura | `backend/tests/test_terceros_repository.py` es el modelo a seguir para el repositorio ADS; `test_consultas_recuperadas.py` y `test_informes_adicionales.py` para las consultas |
| Contrato HTTP | Cada ruta nueva con sus tres casos del punto 3 (normal, vacio, invalido), incluidos los codigos 404, 409, 422 y 503 de `_service_error` (`backend/app.py:245-269`) | `backend/tests/` |
| Esquema | Las validaciones funcionales del flujo contable siguen en verde despues de aplicar los dos archivos de esquema nuevos | `db/postgresql/scripts/validate.sql` (11 validaciones, `db/README.md:75-78`) |
| Extremo a extremo | El recorrido de la pantalla que dispara el control, con el backend y la base levantados | `node dev.js --db-postgres` y `Interface_web/scripts/smoke.mjs` (Puppeteer, `BASE` en `smoke.mjs:4`) |
| Ausencia de simulacion | Busqueda de `setTimeout`, `localStorage`, `simulado` y `data/mock` en la pantalla intervenida; el resultado debe ser cero para los controles convertidos | `grep` sobre `Interface_web/src/pages/` |

Regla de cierre de cada ruta: no se marca terminada si no pasan los tres casos
del apartado correspondiente de `detalle/` y si la pantalla que la consume sigue
mostrando el distintivo "Datos de demostracion" o un aviso "(simulado)" sobre ese
control.

### 7.2 Como se comprueba que la interfaz dejo de simular

El mapa funcional es la fuente del conteo
(`docs/catalogo/MAPA_FUNCIONALIDAD.md:10-20`): un control esta **conectado**
cuando su manejador llega a una funcion de `api/*.ts` que llama a una ruta que
existe en `backend/app.py`. Por eso, para cada control convertido hay que poder
recorrer la cadena completa y dejar la evidencia en el mapa:

1. El manejador del control llama a una funcion de `src/api/*.ts` (no a
   `setState`, `localStorage` ni `data/`).
2. Esa funcion apunta a una ruta que existe en `backend/app.py`.
3. El `POST`/`PUT`/`DELETE` cambio de verdad el dato: se comprueba recargando la
   pantalla y consultando por otra via (por ejemplo, el lote creado aparece en
   Lotes, que si lee del backend: `Lotes.tsx:74-84`).
4. El mapa pasa la fila del control de "local o simulado" a "conectado" y, cuando
   cambia a un control de otro tipo (por ejemplo, un boton deshabilitado que
   pasa a operativo), se retira de las listas de la seccion 4.

El indicador agregado del plan es el par de la seccion 2 del mapa: los 446
controles locales o simulados bajan, y los 242 conectados suben. Este plan no
fija la meta de la cifra: la auditoria ya advierte que el conteo por pantalla
puede variar en uno o dos controles
(`docs/catalogo/MAPA_FUNCIONALIDAD.md:287-292`), asi que la verificacion se hace
control por control y la cifra se recalcula despues, no antes.

Regla adicional de honestidad, heredada de la conclusion de la auditoria
(`AUDITORIA_FUNCIONALIDAD.md:779-785`): mientras un modulo siga simulado, la
pantalla conserva el distintivo "Datos de demostracion". Retirar el distintivo es
el ultimo paso de cada modulo, nunca el primero.

### 7.3 Prueba cruzada entre motores

Es el mismo objeto que la etapa E de la migracion, que quedo "aplazada por
decision" (`db/migration/13_informe_final.md:24`). Este plan la convierte en
parte de la definicion de terminado de cada ruta de doble motor, con este
procedimiento:

1. Levantar el servicio con `CONTABDSI_STORE=ads` y con `CONTABDSI_STORE=postgres`
   usando la misma compania y el mismo periodo (`backend/store.py:48-56`).
2. Ejecutar la misma peticion sobre las dos instancias, con los mismos
   parametros, y comparar el cuerpo JSON **clave por clave**. La unica diferencia
   admitida es el valor de `source`, que por diseno cambia de tabla de origen
   (`backend/store.py:26-36`), y `sharedAcrossCompanies`, que declara la
   diferencia de alcance del tercero (`backend/app.py:339-349`).
3. Para las escrituras, repetir en los dos motores y comparar leyendo por la ruta
   de consulta de cada motor.
4. Para las rutas declaradas `requiere tabla nueva en ADS` o `solo PostgreSQL`,
   la prueba cruzada no aplica: se registra la excepcion con la misma frase de la
   columna *motor* y se prueba solo en PostgreSQL.

Se propone un script en `/scripts-agent/equivalencia-motores.ts` (o `.py`, segun
el patron que ya use el repositorio) que recorra la lista de rutas del punto 2 y
devuelva solo el resumen: rutas comparadas, rutas con diferencia y el primer
campo que difiere. No se traen los cuerpos completos a la sesion de trabajo.
