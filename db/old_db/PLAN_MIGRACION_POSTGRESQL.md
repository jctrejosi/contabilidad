# CONTABDSI — Validación y plan de migración a PostgreSQL

Fecha de revisión: 2 de septiembre de 2026.

## 1. Dictamen

**El esquema actual de `contabilidad/db` es una base aprovechable, pero NO está listo para una migración productiva que conserve toda la funcionalidad de CONTABDSI.**

Hay tres problemas diferentes:

1. Datos funcionales del original que no tienen estructura equivalente o que perderían detalle al cargarse.
2. Tablas que existen, pero cuyas funciones de contabilización, anulación, reconstrucción o validación no reproducen el proceso original.
3. Consultas y escrituras sobre módulos compartidos que necesitan una integración explícita; una fila en `integraciones` no almacena los registros de esos módulos.

La migración es viable si se amplía el modelo, se corrigen las reglas y se prueba el resultado por proceso. No recomiendo pasar a producción cargando archivos ADT directamente en las 52 tablas actuales.

Una función no necesariamente se «almacena» en una tabla: su información se persiste en tablas y su comportamiento se implementa mediante SQL, servicios o interfaz. Esta revisión separa ambas responsabilidades.

## 2. Alcance real de esta validación

| Elemento | Alcance |
|---|---:|
| Proyecto fuente | `C:\Xedit4\CONTABDSI\CONTABDSI.xpj` |
| Archivos propios revisados e inventariados | 12 PRG |
| Funciones/procedimientos inventariados | 969 |
| Opciones con ACTION en los menús | 161 |
| Otras declaraciones ACTION, incluidas acciones de botones | 572 |
| Tablas/familias funcionales del esquema depurado | 98 |
| Tablas PostgreSQL definidas en `schema/01..09` | 52 |
| Columnas declaradas en esas tablas | 543 |
| Funciones SQL de negocio revisadas | 4 |
| Familias de procesos evaluadas | 36 |

Se contrastaron el DDL, `funciones.sql`, `seed.sql`, `scripts/validate.sql`, `scripts/up.sh`, metadatos físicos obtenidos en la revisión anterior y referencias funcionales al código original. Se conservaron huellas SHA-256 de los archivos revisados en el JSON del informe.

**Es validación estática, no una certificación de equivalencia ejecutada de las 969 funciones.** El rastreo de llamadas es conservador y no resuelve todas las macros, alias heredados o variantes de parámetros. El inventario hace visibles esos pendientes; no los etiqueta como aprobados.

No se ejecutó PostgreSQL: no se encontraron `psql`/`postgres` en PATH y el motor de Docker no estaba disponible. No se inició infraestructura ni se corrieron scripts destructivos. No se leyeron filas de negocio en esta revisión ni se midieron volúmenes o calidad de datos. No se cambiaron fuentes, esquema, datos ni interfaz.

Las bibliotecas externas de interfaz/Excel no se presentan como funciones de negocio individualmente certificadas. La base del alcance es el inventario funcional de los 12 PRG propios del XPJ. Las tablas previamente excluidas por simple apertura no se reintroducen como datos a migrar; sus operaciones de instalación/indexación se tratan como sustitución técnica.

## 3. Resultado de almacenamiento

La clasificación es por tabla/familia original, no por porcentaje de funcionalidad terminada:

| Clasificación | Cantidad | Qué significa |
|---|---:|---|
| Parcial | 30 | Hay entidades candidatas, pero faltan campos, relaciones, historia o reglas. |
| Parcial condicional | 18 | Formatos compartidos de otros módulos; requieren ampliar el modelo y confirmar ramas utilizadas. |
| Sin estructura equivalente definida | 18 | No existe un destino que represente la entidad funcional completa. |
| Derivable con cambios | 6 | Se puede reconstruir desde el libro, pero faltan dimensiones o algoritmos correctos. |
| Integración requerida | 23 | Información de otros módulos; decidir integración o réplica funcional tipada. |
| Sustitución técnica | 3 | Plantillas/estructuras de trabajo reemplazables por DDL y consultas. |
| **Total** | **98** | No se certifica cobertura integral por mera coincidencia de nombres. |

Las 18 sin estructura equivalente son: FADCTAS, CIUDAD, ACTIVIDA, VISTDOC, CONMAE2, CONCECO2, CONINF1, CONAJUS, CONMAGIT, XADPDF, AFIART, AFITAB, AFITAB2, AMORART, AMORTAB, AMORTAB2, CONREMAE y CONREITE.

Esto no significa que deban crearse 18 tablas con los mismos nombres. Por ejemplo, activos y amortizables pueden compartir un modelo normalizado, y las selecciones temporales pueden residir en una tabla de preferencias por usuario.

La homologación anexa conserva **2.663 nombres de campo por tabla lógica**, unificando variantes. Se documentaron 406 candidatos explícitos —algunos requieren columnas propuestas— y 2.257 quedan pendientes de homologación individual. No es un porcentaje de datos migrables: los candidatos aún requieren perfilado y los campos físicos pueden incluir información no usada por las rutas activas. **No existe todavía un contrato campo a campo completo y aprobado; es una condición de entrada para ejecutar la migración.**

## 4. Hallazgos que bloquean la equivalencia

### B01. Un lote original puede producir varios documentos; el destino lo aplana

En `MOVICON.prg:6521`, `ACTUALIMO2` agrupa registros por TDOCUM, TIPODOC y TCOMPR y crea cabeceras CONDOCUM por grupo. Véanse el bucle de agrupación y las asignaciones de cabecera posteriores a la línea 6610.

En `db/funciones.sql:145`, `contabilizar_lote` crea un solo registro en `documentos` con los datos de cabecera del lote y copia todas las líneas bajo ese documento. Aunque `lote_lineas` tiene `comprobante`, `documento` y `fecha`, estos no se utilizan para formar varios documentos. Además, el tipo documental no está modelado como relación del libro.

**Corrección requerida:** definir el grupo documental, preservar tipos y fechas, admitir varios documentos por lote y devolver una ejecución/lista de documentos. No resolverlo dividiendo lotes sin conservar el lote original y su trazabilidad. Validar balance por documento, no sólo por lote.

### B02. La anulación deja resultados inconsistentes entre libro y saldos

`anular_documento`, `db/funciones.sql:286`, crea líneas invertidas y marca el original como Anulado, pero no actualiza `saldos_cuenta`, `saldos_cuenta_tercero` ni `saldos_cuenta_centro`.

Después, `regenerar_acumulados`, líneas 373 y 384, filtra sólo documentos Contabilizados: excluye el original anulado e incluye su reversión. Así no reconstruye el efecto neto de ambos.

Ejemplo algebraico por cuenta: original +100 y reversión −100 deben producir 0. Los saldos incrementales pueden seguir en +100; la reconstrucción que sólo conserva la reversión produce −100. No basta comprobar que el libro completo tenga débitos iguales a créditos.

**Corrección requerida:** elegir una semántica consistente de eventos efectivos. Si se conserva original más contraasiento, ambos deben participar con sus signos; el estado de anulación no puede eliminar sólo uno del cálculo. Actualizar o reconstruir todos los derivados en la misma operación, y probar anulación en período cerrado, año distinto y reintentos.

### B03. IVA y retenciones tienen tablas, pero no regeneración funcional equivalente

`regenerar_acumulados`, `db/funciones.sql:362`, sólo implementa terceros y centros. El caso Retencion escribe `acumulados_tercero`, no `acumulados_retencion`; el caso Iva no carga `acumulados_iva`. Aun así se marca la última acumulación y `periodo_hasta='12'`.

**Corrección requerida:** reconstrucción específica de saldos y de acumulados fiscales. Guardar concepto/tarifa y su vigencia por renglón, distinguir base/valor/signo, incluir correcciones y dejar el estado actualizado sólo después de éxito. No asignar por inferencia una tarifa actual a movimientos históricos.

### B04. El libro carece de dimensiones/documentación del movimiento original

MOVxx contiene CODIGO, NIT, TCOMPR, TIPODOC, TDOCUM, TDOCUM2, TFECHA, TFECDOC, TVALOR, TVALORUS, TBASE, TFASE, NITN, TARCHI, TUSUA, TDATE y TTIME, entre otros. `documento_lineas` no ofrece equivalentes completos para tipo documental, fechas por renglón, valor alterno/moneda, tercero alterno y procedencia.

**Corrección requerida:** distinguir campos operativos, históricos y de procedencia, con destinos explícitos. Guardar sólo el archivo crudo en staging no reemplaza la disponibilidad de los campos que una consulta necesita diariamente.

TVALOR es firmado: el código asigna débito positivo y crédito multiplicado por −1 (`MOVICON.prg:6581–6583`). La transformación propuesta es `debito=max(TVALOR,0)` y `credito=max(-TVALOR,0)`, conservando el original y revisando excepciones. Los códigos y documentos no deben convertirse indiscriminadamente a números.

### B05. Aislamiento por compañía y año incompleto

El esquema tiene `compania_id`, pero las FK a cuenta, tercero, centro y comprobante apuntan sólo al id. Por sí solas permiten asociar un movimiento de A con un maestro de B. Tampoco una columna `anio` obliga a que exista la combinación compañía/año/período. El control de período de contabilización sólo detecta una fila Cerrado: un período inexistente no queda rechazado por esa comprobación.

**Corrección requerida:** invariantes de pertenencia mediante claves compuestas/FK o mecanismos equivalentes, FK de períodos, verificación del período existente/abierto y transacciones coordinadas con el cierre. RLS, si se adopta, controla acceso; no sustituye las relaciones de integridad. PostgreSQL admite claves foráneas compuestas y advierte que CHECK no es la herramienta para validar otras filas/tablas. [Documentación de restricciones](https://www.postgresql.org/docs/18/ddl-constraints.html).

### B06. El libro y los estados no quedan protegidos sólo por el esquema

`documento_lineas` no impide débito y crédito simultáneos y tiene borrado en cascada desde documentos. No hay en estos SQL una prohibición general de editar/borrar libro contabilizado. `validar_lote` puede cambiar el estado de un lote sin restringir su estado previo; un lote vacío puede superar el balance 0=0. No se aplican todas las reglas de bloqueo de maestros/tipos/terceros ni se exige una aprobación vinculada a la versión exacta de sus líneas.

**Corrección requerida:** escritura a través de servicios/funciones con permisos mínimos, reglas de transición y versión, protección de encabezado y detalle, rechazo del lote vacío y pruebas de concurrencia. No permitir DML libre a las tablas del libro a los usuarios de aplicación.

### B07. Idempotencia y pruebas insuficientes

El UUID automático es único por fila, pero una nueva solicitud que genera otro UUID no se reconoce como reintento de la anterior. La función revisa lote/estado, no una clave estable de negocio del archivo/operación. Falta una política para reintentar después de anulación y para iniciar un consecutivo bajo concurrencia.

En `scripts/validate.sql:79–80`, el manejador `WHEN raise_exception` también captura la excepción que la propia prueba lanza cuando la segunda contabilización NO falla. Por eso puede dar un falso positivo. La prueba de balance compara débitos con créditos, pero no igualdad libro-versus-saldos por cuenta, y no verifica saldos después de anular.

**Corrección requerida:** identificador estable por importación/operación, huella de contenido y respuesta previa; claves de documento bien definidas; pruebas negativas que no capturen su propio fallo; saldos comparados en todas las dimensiones.

### B08. Error estructural en auditoría de generaciones fiscales

`schema/06_impuestos.sql:111` aplica `auditoria_antes_update` a `generaciones_medios`; esa tabla no declara `actualizado_en`, que la función intenta asignar en `schema/01_dominios.sql:33`. Es una incompatibilidad visible en el DDL, pendiente de reproducción en motor.

Además, `version` de `generaciones_medios` identifica una generación por compañía/año y también sería incrementada por el trigger como versión de edición. Son conceptos distintos y pueden colisionar.

**Corrección requerida:** separar número de generación y versión optimista, y adaptar columnas/trigger. `auditoria_antes_insert` está definida, pero no hay triggers de inserción que la utilicen; revisar defaults/fechas en todas las entidades, sin inventar fechas históricas.

### B09. Parámetros, nómina y plantillas no están completos

`PARAMS`/`DSIGRABA6` (`DSITAB.PRG:1348,1506`) usan más datos que `parametros_operacion`. Faltan destinos definidos para CTFCHOY, CTTOBS, CTDOCUM y CTLEY2, además de configuraciones relacionadas. `PARAMS_NOMI`/`DSIGRABA6_NOM` (`1439,1471`) guardan seis campos: CTCOMNOM1..3 y CTDOCNOM1..3.

El radio MCR se inicializa en PARAMS, pero DSIGRABA6 no lo persiste. Por tanto, `modo_retencion` del destino no tiene una correspondencia histórica demostrada sólo por esa pantalla. Debe fijarse su regla con un caso de negocio, no inventar un valor migrado.

`PLANTICO`/`GRABAPLA` (`DSITAB.PRG:7,157`) guardan NOM/DEB/CRE01..08 en VISDOCUM: DEB y CRE son cuentas, no importes fijos. La nueva plantilla debe conservar las dos cuentas de cada regla y su tipo documental.

### B10. Faltan entidades de activos, amortizaciones, bancos y reembolsos

Guardar el asiento final no permite volver a calcular una depreciación, distribuirla por centro, editar los datos de banco del tercero ni continuar un reembolso.

Las funciones `INTEACT2/INTEACT3` (`DSITAB.PRG:242,330`) utilizan maestros, reglas y porcentajes por centro. `ADMCUENTA` (`CONTAGRAL.PRG:3077`) utiliza FADCTAS. `REEMBOL01` y auxiliares (`MOVICON.prg:7268` en adelante) usan CONREMAE/CONREITE.

**Corrección requerida:** modelos de esas entidades y sus vínculos al libro. Para CONREMAE/CONREITE falta localizar/verificar la estructura física antes de fijar tipos definitivos.

### B11. Terceros y catálogos perderían información

FADCLI mantiene nombres/apellidos separados, correo, código de ciudad, relaciones y datos comerciales/fiscales que no tienen equivalente en `terceros`. FADCTAS es independiente. CIUDAD, ACTIVIDA y VISTDOC son catálogos usados para consulta/validación, no simples textos.

**Corrección requerida:** identidad estable y alias de origen, estructura fiscal y catálogos, datos comerciales integrados o replicados. Los terceros globales y los propios de cada contabilidad deben homologarse sin fusionar automáticamente registros por NIT. Toda reasignación debe conservar historia.

### B12. Exógena e informes no se reducen a una tabla de resultados

CONMAG3 incluye rangos de cuentas, concepto, tipo, fuentes, columnas y condiciones que no caben semánticamente en `formato_asignaciones(formato_id,cuenta_id,activo)`. CONMAGDT tiene VALOR1..11 y tercero alterno. CONMAGIT conserva movimiento por documento. `formatos_exogenos` contiene vigencia, pero su unicidad no incluye la vigencia.

CONINF1 configura informes/flujo de caja; CONMAE2/CONCECO2 guardan selecciones. El editor CONGENF/CONFORMA utiliza catálogo de campos, expresiones y secciones que exceden los ocho tipos permitidos en `formato_elementos`.

**Corrección requerida:** reglas versionadas, detalle de generación trazable, valores por columna, definiciones de informe y un editor/ejecutor seguro. JSON puede servir si hay contrato, versión, validación y consultas; no cuenta como cobertura sólo por admitir cualquier contenido.

### B13. Presupuesto y cierres necesitan más que cabeceras

TIDPRESU, no CONPRESU, almacena presupuesto: CODIGO, CCOSTO, CONCEPTO, PRE00..13 y MOV00..13. `presupuesto_rubros` carece de nombre/concepto y de unicidad funcional código+centro. `presupuesto_valores` sólo representa meses 1..12; los demás períodos y ejecución deben clasificarse sin descartarlos.

Las tablas `procesos`, `cierres` y `consolidaciones` registran configuración/estado, pero `funciones.sql` no implementa esos procesos. Faltan algoritmos, relaciones con documentos generados, correspondencias origen/destino y reglas de reejecución.

### B14. Seguridad y auditoría no equivalen a guardar un usuario

`usuarios.id` es bigint, pero muchos actores/argumentos son integer sin FK a usuarios. No existe asignación usuario-compañía. La bitácora no se alimenta automáticamente para cada mantenimiento y no se establece su inmutabilidad.

`PERMI` devuelve verdadero antes del código de permisos en el original (`CONTABDSI.PRG:858`); no debe trasladarse como política permisiva al nuevo sistema. Las rutinas de CONOPER quedan identificadas como heredadas, sin llamada/apertura demostrada.

**Corrección requerida:** autenticación, autorizaciones por compañía/acción, tipos de identificador coherentes, auditoría de eventos y pruebas de aislamiento. Si se usa RLS, probar con el rol real de la aplicación y considerar los privilegios que la omiten. [Documentación de seguridad por filas](https://www.postgresql.org/docs/18/ddl-rowsecurity.html).

### B15. El instalador de demostración no es un migrador

`scripts/up.sh:33` ejecuta `dropdb` antes de recrear/cargar la base. No debe apuntarse a producción. `seed.sql` crea datos ficticios, no transforma información real. No se ejecutó ninguno.

**Corrección requerida:** migraciones versionadas, entorno aislado, permisos distintos y protección del destino. Separar totalmente bootstrap de demostración, cambios de esquema y carga de negocio.

## 5. Diseño destino recomendado

Los nombres siguientes son propuestas, no objetos ya creados. No se requiere copiar cada ADT 1:1.

| Área | Ajuste propuesto | Información que preserva |
|---|---|---|
| Identidad y origen | `migracion_ejecuciones`, `migracion_archivos`, `migracion_rechazos`, `migracion_equivalencias`, vínculo de origen por fila | Fuente, empresa, año, tabla, clave/posición de instantánea, hash, versión de transformación y destino. |
| Parámetros | Ampliar `parametros_operacion`; `parametros_nomina` | Fecha operativa, observación/leyendas/documentos; comprobante y tipo para nómina, aportes y provisiones. |
| Libro | Ampliar lotes/líneas/documentos; `documento_origenes` o vínculo equivalente | Tipo documental, múltiples documentos por lote, referencias, fechas, identificadores legados, usuario y moneda/valor alterno cuando se confirme uso. |
| Reglas y cuentas | `cuenta_reglas`/asignaciones con vigencia; clasificación corriente y atributos NIIF | Captura, reparto, impuestos, cuentas de cruce y reglas originales. |
| Aperturas y agregados | Aperturas por compañía/año/cuenta/tercero/centro; agregado conjunto opcional | Inicio de período y cruce simultáneo de dimensiones. |
| Terceros | Ampliar `terceros`; catálogos; `tercero_identificadores`; `tercero_cuentas_bancarias` | Identidad/fiscalidad, ciudad/actividad y múltiples cuentas bancarias. |
| Plantillas | Reglas con cuenta débito, cuenta crédito, orden y tipo documental | Parejas NOM/DEB/CRE sin convertir códigos a importes. |
| Impuestos | Concepto/tarifa/vigencia en detalle o relación fiscal; resultados y ajustes por período | Bases, valores, signo y reconstrucción reproducible. |
| Activos | `activos`, `activo_reglas_contables`, `activo_cuotas`, `activo_distribuciones` | Activos y amortizables, vida/costo, baja, ajustes y centros; enlace a lotes. |
| Reembolsos | `reembolsos`, `reembolso_lineas` | Tercero, centros y cruce, valor, fecha, concepto, aplicado y documentos. |
| Informes | `informes_definiciones`, `informe_renglones`, `usuario_selecciones` | CONINF1 y selección de cuentas/centros por sesión/usuario. |
| Exógena | Reglas por concepto/rango/vigencia; detalle fuente; valores por columna | CONMAG1..3/IT/DT, once importes, topes, revisiones y trazabilidad. |
| Documentos/portal | `archivos`, `certificados` y repositorio privado | Metadatos, hash, publicación, retiro, autorizaciones y vínculo a tercero/documento. |
| Procesos y consolidación | Ejecuciones con documentos vinculados, correspondencias, diferencias y aprobaciones | Cierres, traslados, revalorización, reclasificación y consolidación reproducibles. |
| Seguridad | `usuario_companias`; actores bigint y FK; eventos auditables | Acceso por empresa y responsabilidad de cada cambio. |

No utilizar `cuentas.saldo_inicial` como único saldo inicial histórico: no tiene año, tercero ni centro. Puede conservarse como dato de presentación si se define cómo se deriva, pero no como fuente del libro multianual.

## 6. Reglas de transformación y preservación

### 6.1 Fuente autoritativa

- Empresa/año se determinan por configuración real y directorio, no sólo por nombres de archivos o ejemplos `VISION20` del README. La muestra anterior usa Advantage ADT y algunos DBF, con rutas reales bajo VISADS.
- CONMAE mezcla maestro, auxiliares y acumulados. Separarlos antes de cargar `cuentas`; no crear una cuenta por cada combinación cuenta/NIT.
- MOV00..18 se unifican en el libro con período explícito; MC de lote se unifica en lotes y detalle. No crear tablas PostgreSQL por mes o por lote.
- CONDOCUM se concilia con MOVxx antes de reconstruir cabeceras. No descartar movimientos huérfanos ni inventar cabeceras silenciosamente: registrar excepción y resolverla.
- Un lote aplicado y su movimiento publicado no son dos asientos distintos. Identificar aplicación para evitar cargar el libro y luego volver a contabilizar el mismo MC.

### 6.2 Tipos, importes y claves

- Mantener códigos/documentos/NIT/números bancarios como texto; preservar ceros iniciales y el valor original. Aplicar normalización con tabla de equivalencias, no con sustituciones irreversibles.
- Convertir fechas numéricas o textuales a `date` sólo tras validación estricta. Blancos/cero/fechas inválidas van a cuarentena con motivo; no se sustituyen por hoy.
- Validar codificación OEM/ANSI por fuente antes de convertir a UTF-8. Comparar tildes, ñ, nombres y direcciones. No asumir una única codificación para todos los archivos.
- Conservar representación numérica original en staging. Perfilar escala/rango antes de adoptar `numeric(18,2)` para todo; un DOUBLE de 8 bytes no significa ocho dígitos de precisión. La conversión a una escala declarada puede redondear; documentar y conciliar cada diferencia. [Tipos numéricos de PostgreSQL](https://www.postgresql.org/docs/18/datatype-numeric.html).
- Porcentajes: documentar cuándo 19 significa 19 % y convertir a 0,19 en el dominio de fracción. No dividir dos veces un dato que ya sea fracción.
- Separar `numero` contable nuevo, documento fuente alfanumérico y tipo documental. Nunca renumerar historia para que quepa en bigint sin guardar la referencia original y aprobar la regla.
- Fechas/horas de auditoría se convierten con zona explícita cuando se conozca; si falta, conservar fecha/hora cruda y marcar incertidumbre.

### 6.3 Historia y derivados

- Guardar columnas mensuales como filas por período, no perder los períodos 00 y 13..18 del libro.
- Para aperturas, elegir fuente y política única. Si MOV00 contiene la apertura completa, no volver a sumarle MSALDO. Si no existe detalle histórico suficiente, incorporar una apertura controlada con procedencia y aprobación, no fabricar movimientos antiguos.
- Conservar instantáneas de acumulados originales como evidencia de conciliación. Los derivados nuevos se calculan desde el libro/apertura que se apruebe como fuente.
- Retener ajustes manuales fiscales, versiones exportadas y certificados que no puedan regenerarse idénticos con datos actuales.
- Flags de borrado, anulaciones y marcas de aplicación se preservan en staging. La decisión de excluir filas es específica de cada entidad/proceso y debe quedar contabilizada; no aplicar «sólo no borrados» como regla global sin análisis.
- RECNO sólo sirve como localizador dentro de una instantánea identificada: PACK/reorganizaciones pueden cambiarlo. No usarlo como identidad permanente entre cortes.

### 6.4 Integraciones y archivos

- La continuidad con facturación, cartera, CXP y catálogos compartidos requiere un propietario por entidad y contratos de lectura/escritura.
- Elegir integración al legado o réplica tipada para cada una de las 23 dependencias. Incluir las 18 familias condicionales de formatos en la decisión de ámbito; no descartarlas silenciosamente.
- Migrar también los archivos que XADPDF y las rutas documentales referencian, con manifiesto, hash, tamaño y prueba de descarga autorizada. Una ruta Windows guardada en PostgreSQL no vuelve disponible el archivo en la aplicación nueva.

## 7. Plan de ejecución por fases

No se asignan fechas ficticias sin conocer volumen, infraestructura y equipo. Cada fase tiene una condición de salida verificable.

| Fase | Trabajo | Responsable sugerido | Condición de salida |
|---|---|---|---|
| 0. Cerrar alcance | Confirmar empresas/años, rutas, módulos activos/compartidos, historia requerida, PostgreSQL 18 o versión acordada, ventana, RPO/RTO y responsables. | Contabilidad + líder técnico | Inventario firmado y decisiones de alcance registradas. |
| 1. Perfilado sólo lectura | Localizar todas las copias activas, tamaños, registros, campos, índices y archivos; detectar claves repetidas, huérfanos, borrados, fechas, signos, escalas y variantes. | Migración + DBA | Informe por fuente y lista de excepciones; CONREMAE/CONREITE localizados o alcance resuelto. |
| 2. Homologación funcional | Completar campo→destino→transformación→regla→prueba. Revisar las 969 funciones/161 opciones y resolver alias/ramas pendientes. | Analista funcional + desarrollo | Ningún dato funcional sin destino o tratamiento aprobado; ninguna acción en alcance sin responsable/prueba. |
| 3. Esquema y servicios | Corregir B01..B15, ampliar tablas, definir contratos JSON, FK, índices, estados, auditoría, versiones e integraciones. | Desarrollo + DBA | Migraciones versionadas instalables en base vacía y actualizable; revisión de integridad aprobada. |
| 4. Ensayo del motor | Levantar entorno aislado PostgreSQL, sin datos de demo mezclados con reales; ejecutar pruebas de lógica, integridad y concurrencia. | QA + DBA | Pruebas críticas pasan, incluida reversión/saldos y lote multidocumento. |
| 5. Extractor y staging | Extraer instantánea consistente con lector Advantage compatible, metadatos, flags y archivos; guardar crudo, hashes y control de registros. | Migración | Extracción reproducible, sin modificar origen y con manifiesto completo. |
| 6. Transformación/carga piloto | Una compañía/año representativos; homologar claves, cargar dependencias y libro, reconstruir derivados e integrar archivos. | Migración + desarrollo | Carga idempotente, rechazados explicados y conciliaciones exactas. |
| 7. Validación por usuarios | Recorrer cada opción y acción aplicable con los mismos casos/datos del original; comparar consultas, informes, archivos y permisos. | Contabilidad + QA | Aceptación documentada por proceso; pendientes sin riesgo explícitamente aprobados. |
| 8. Ensayo general | Repetir con todas las empresas/años; medir duración, congelamiento/delta, recuperación, respaldo y restauración. | DBA + migración | Tiempo compatible con ventana y restauración probada; manifiesto final de objetos/cargas. |
| 9. Corte productivo | Autorizar cambio, detener escrituras de fuentes compartidas, snapshot/delta, carga final, conciliación y habilitación. | Responsable del cambio | Acta GO firmada y accesos dirigidos a un único escritor. |
| 10. Estabilización | Legado en consulta, conciliación operativa, incidencias, respaldo/monitoreo y cierre de migración. | Operación + contabilidad | Aceptación final y política de conservación del legado/respaldos. |

### Orden de carga propuesto

1. Ejecución de migración, fuentes, compañías, años, períodos y usuarios homologados.
2. Catálogos, terceros y sus identificadores; cuentas/jerarquía; centros; comprobantes/tipos y relaciones.
3. Parámetros, nómina, bancos, plantillas, reglas, formatos, exógena, presupuesto, activos/amortizables y reembolsos.
4. Lotes pendientes y su detalle; historia de estados/aplicaciones.
5. Documentos y movimientos históricos por grupos documentales, **sin llamar a la contabilización normal para volver a publicar lo ya aplicado**. El cargador histórico deberá validar invariantes y conservar procedencia.
6. Aperturas, vínculo de reversiones/anulaciones, documentos afectados y referencias cruzadas.
7. Reconstrucción completa de saldos/acumulados y comparación con instantáneas del origen.
8. Certificados, anexos, generaciones/exportaciones históricas, auditoría y archivos.
9. Consecutivos y secuencias de identidad ajustados a datos cargados sin alterar numeración histórica.
10. Restricciones/índices restantes, estadísticas, pruebas funcionales y autorización.

Para grandes cargas se puede usar COPY hacia staging con tratamiento explícito de NULL, encoding y errores; no cargar directamente omitiendo validaciones. Se prefiere ejecución del lado cliente cuando el archivo vive en la máquina del extractor. [Documentación de COPY](https://www.postgresql.org/docs/18/sql-copy.html).

## 8. Contrato mínimo del cargador

- Un identificador de ejecución y una huella del conjunto fuente/transformaciones.
- Registro por archivo: ruta, empresa, año, entidad, formato, tamaño, hash y fechas de extracción.
- Por fila: localizador dentro de la instantánea, clave de negocio cruda, flags, valores originales, resultado y destino.
- Equivalencias source-key→id PostgreSQL persistentes, considerando ámbito global/local.
- Rechazos explícitos con causa y responsable. No reemplazar datos inválidos por valores de demostración o por un tercero genérico sin aprobación.
- Idempotencia: repetir la misma ejecución no duplica datos ni asigna números nuevos; un contenido distinto bajo la misma clave produce conflicto controlado.
- Registro de transformaciones/redondeos/correcciones y aprobaciones. Los scripts no corrigen por iniciativa propia diferencias contables.
- Cargas reanudables por entidad/empresa/año, con transacciones y puntos de control definidos. No ocultar errores para «terminar» una carga.
- Credenciales de lectura para origen y permisos mínimos para destino; secretos fuera de documentos/repositorios y datos sensibles fuera de logs.

## 9. Pruebas obligatorias y criterios de conciliación

La matriz anexa contiene una prueba mínima para cada P01..P36 y las 161 opciones. Además deben pasar estas pruebas transversales:

| ID | Caso | Resultado exigido |
|---|---|---|
| T01 | Lote con dos documentos/tipos distintos | Se conservan grupos, fechas, referencias y balance por documento. |
| T02 | Lote globalmente cuadrado pero documentos descuadrados | Se rechaza según la regla aprobada; no se compensa un documento con otro. |
| T03 | Lote vacío o con cuenta no afectable/bloqueada | Rechazo antes de publicar. |
| T04 | Cuenta/tercero/centro de otra compañía | Rechazo de integridad y autorización. |
| T05 | Período inexistente/cerrado y cierre concurrente | No se contabiliza ni anula fuera del período autorizado. |
| T06 | Dos usuarios publican/reintentan la misma operación | Un único resultado; consecutivo y trazabilidad estables. |
| T07 | Editar líneas después de aprobar o publicar | Bloqueo o nueva revisión obligatoria con versión correcta. |
| T08 | Fallo durante contabilización/carga | Ningún documento parcial, saldo parcial ni consecutivo perdido por esa transacción. |
| T09 | Anular y luego regenerar | Efecto neto consistente por cuenta, tercero, centro e impuesto. |
| T10 | Recalcular retención/IVA dos veces | Mismos datos, sin duplicación ni falsa fecha de actualización. |
| T11 | Apertura desde MOV00 y saldos heredados | Se contabiliza una vez; no se duplican saldos. |
| T12 | Valores fraccionarios, crédito negativo legacy y ceros | Transformación documentada y diferencia reconciliada; sin truncamientos silenciosos. |
| T13 | Actualizar generación fiscal | Trigger válido y número de generación separado de versión de edición. |
| T14 | Misma cuenta/formato/código en empresas o vigencias distintas | No se cruzan ni colisionan indebidamente. |
| T15 | Presupuesto y activo con varios centros/períodos | Se conservan descripción, reparto, cuotas y ejecución. |
| T16 | Certificado/archivo y permisos | Hash coincide, se puede recuperar y sólo accede quien corresponde. |
| T17 | Importar, reanudar y repetir una carga | Conteos/hash/IDs iguales sin duplicación; rechazos trazables. |
| T18 | Restaurar respaldo de PostgreSQL y repositorio documental | Aplicación operativa y conciliaciones reproducibles dentro del objetivo acordado. |

### Conciliaciones contables

- Conteos por empresa/año/entidad y resultado: cargado, fusionado por regla, derivado, excluido autorizado o rechazado. La suma explica el universo fuente.
- Documento original ↔ documentos destino, con renglones, tipos, fechas, tercero y referencias.
- Débitos/créditos y apertura por empresa/año/período/cuenta; también por tercero y centro, incluido el cruce conjunto.
- Balance de comprobación, mayor y auxiliares con iguales filtros. No basta que total débito=total crédito: un error simétrico también cuadra.
- Bases/retenciones/IVA por tercero/concepto/tarifa/período y certificados.
- Exógena por formato/concepto/tercero/columna y generación; explicación de topes y ajustes.
- Presupuesto por código/centro/mes; activos/amortizables por costo/cuota/ajuste/centro.
- Consecutivos, anulaciones y documentos afectados sin colisiones ni huérfanos.

El objetivo es diferencia cero después de aplicar la transformación aprobada. Las diferencias por redondeo/conversión se presentan individualmente y se aprueban; no se usa una tolerancia global para ocultar faltantes. No deben quedar diferencias materiales sin explicación ni rechazos de información funcional pendiente.

## 10. Corte y reversión operativa

1. Prohibir que origen y destino sean escritores simultáneos sobre el mismo proceso, salvo que se haya diseñado y probado una sincronización formal.
2. Para ADT y archivos compartidos, obtener snapshot consistente de todo el conjunto; una copia mientras varios módulos escriben puede mezclar instantes.
3. Si no hay un registro confiable de cambios, preferir congelamiento y extracción final completa o comparación exhaustiva de instantáneas. No prometer CDC a partir de fechas de modificación de archivo.
4. Respaldar y verificar restauración antes del corte; registrar conteos y hashes de origen, staging, destino y archivos.
5. Cargar, conciliar y firmar aceptación antes de habilitar escritura PostgreSQL.
6. Si falla antes de habilitar el nuevo sistema, mantener/reabrir el legado y restaurar/repetir el destino aislado según el procedimiento aprobado.
7. Si falla después de recibir operaciones nuevas, **no basta volver al respaldo antiguo**: congelar, identificar operaciones creadas en PostgreSQL y aplicar un plan probado de retorno/reprocesamiento que no pierda datos ni duplique comprobantes. El plazo y la autoridad para decidirlo se fijan antes del corte.
8. Conservar legado y fuentes de migración en sólo lectura por el plazo aprobado; no borrar ADT/DBF ni archivos al terminar la carga.

## 11. Condiciones GO / NO-GO

**NO-GO actual**, por B01..B15, homologación incompleta y falta de pruebas en motor/datos.

Para autorizar producción:

- Cero bloqueos críticos de libro, anulación, saldos, multicompañía, impuestos o datos sin destino.
- Cada campo/función/opción en alcance tiene destino o sustitución definida, responsable y evidencia de prueba. Las exclusiones requieren aprobación, no deducción automática del analizador.
- Alias/macros que afecten procesos activos resueltos mediante lectura detallada o pruebas instrumentadas del original.
- Perfilado y reglas de identidad aprobados; ningún dato funcional queda descartado silenciosamente.
- Conciliaciones y pruebas P01..P36/T01..T18 satisfactorias con datos representativos.
- Integraciones y archivos operativos; seguridad probada con usuarios reales de cada rol/compañía.
- Ensayo completo, tiempos medidos, restauración y reversión documentadas.
- Aprobación del responsable contable y del responsable técnico.

Decisiones aún necesarias para calendarizar: empresas/años definitivos; volumen; módulos compartidos que seguirán en legado; tratamiento de historia incompleta; servidor/versión PostgreSQL; autenticación; almacenamiento de archivos; ventana de corte, RPO/RTO y política de retorno. Se pueden resolver durante la fase 0 sin cambiar las conclusiones de esta validación.

## 12. Entregables de esta revisión

- `MATRIZ_PROCESOS_Y_OPCIONES.md`: 36 familias de procesos, cambios necesarios, pruebas y 161 acciones de menú con argumentos.
- `MATRIZ_TABLAS_Y_BRECHAS.md`: las 98 tablas/familias originales, destino candidato, estado, campos y evidencia.
- `TRAZABILIDAD_FUNCIONES_Y_BOTONES.md`: inventario de 969 funciones y 572 declaraciones ACTION adicionales, con referencias y alias pendientes.
- `HOMOLOGACION_CAMPOS.md`: 2.663 nombres de campo, candidatos y pendientes visibles.
- `VALIDACION_MIGRACION_CONTABDSI.json`: catálogo PostgreSQL, matrices, trazabilidad y huellas de los archivos revisados.

Este plan prepara la migración; no ejecuta la carga ni modifica el esquema existente. La siguiente unidad de implementación es cerrar la homologación y corregir los bloqueos del libro/esquema en un entorno aislado, no cargar producción.
