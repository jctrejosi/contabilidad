# Esquema funcional depurado de CONTABDSI

## Resultado

El esquema queda en **98 tablas lógicas o familias con uso de datos/estructura operativa en funciones del proyecto**: 57 del núcleo y procesos contables relacionados, y 41 dependencias de funciones compartidas o de integración.

No se cuentan cada MOV mensual ni cada MC de lote como una entidad diferente. Tampoco se duplica una tabla por sus alias c/t/x/v. Sí se preservan sus variantes físicas en el diccionario y el JSON.

Se conservan 141 variantes físicas documentadas, con 3.616 campos; CONREMAE y CONREITE tienen uso en código pero no estructura física verificada.

Del inventario anterior de 261 nombres/familias lógicas, 167 quedan fuera del esquema funcional. Además se documentan usos que el rastreo por aperturas no cubría, como FADCTAS y XADPDF.

## Criterio aplicado

- Se conserva una tabla cuando una función lee o escribe sus campos, busca datos para una validación/consulta, procesa registros, ejecuta SQL sobre ella o utiliza su estructura para generar un lote/informe.
- No basta que aparezca en ABRE4/CNWOPENDBF, DBSELECTAREA, cierre, posicionamiento, índice, copia inicial de una empresa o en el directorio de datos.
- Se ignoraron comentarios y código posterior a retornos incondicionales de nivel superior. Se revisaron cadenas de alias relevantes, como INTEACT2 → INTEACT3.
- Se incluyen funciones presentes en los 12 PRG propios del XPJ, no únicamente botones del menú principal. Una rama condicional o función heredada no equivale a ejecución demostrada en producción.
- No se han borrado tablas, modificado aperturas, ejecutado SQL de negocio ni cambiado la aplicación.

## Correcciones respecto del inventario amplio

| Caso | Decisión y evidencia |
|---|---|
| CONPRESU | Fuera del esquema funcional. PRESU1 y otras funciones de CONPRESU.PRG acceden a TIDPRESU. No debe deducirse la tabla por el nombre del PRG. |
| CONAUDI y CONCERTI | Fuera: se encontraron en apertura/cierre, indexación y provisión, sin lectura/escritura funcional de registros acreditada en esta revisión. Esto no elimina la funcionalidad de informes/certificados, que usa otras tablas. |
| CONLOTE | Fuera: la ruta se asigna a WARCHI, pero en los usos revisados no se consume como esa tabla; se abren MOVxx. No confundir con CONMOVI ni con MC&lt;lote&gt;. |
| AFITAB2 y AMORTAB2 | Dentro: INTEACT2 asigna cAliTAB2; INTEACT3 lee PORCE y CENTRO para distribuir valores. |
| CONINTER | Dentro: se copia su estructura para crear MC&lt;lote&gt;, no sólo se abre. |
| POSINFOR | Dentro: su estructura se usa para resultados temporales de consultas e informes; se verificó la variante de VISADS raíz. |
| FADCTAS | Dentro: ADMCUENTA y funciones relacionadas leen/graban cuentas bancarias del tercero. Véase evidencia exacta abajo. |
| XADPDF | Dentro: CARGA_PORTAL2 y auxiliares consultan y mantienen documentos/certificados del proveedor. |
| CONOPER | Se conserva como referencia de rutina heredada: USUARIOS/USUA1/DSIGRABA8 acceden a sus campos, pero no se encontró llamada a USUARIOS ni apertura rastreable. No presentarla como opción operativa validada. |

## Relación depurada por proceso

Cada fila identifica una función y una evidencia de uso. Los nombres de función son los originales, aunque algunos provengan de rutinas compartidas. Las referencias se expresan como archivo:línea dentro de C:\Xedit4\CONTABDSI\Source.

### Empresa y parámetros

| Tabla/familia | Función contable o uso | Evidencia representativa |
|---|---|---|
| VISION | Configuración global y rutas del entorno. | ABREPPAL — VISDBF.PRG:11; CTDIRVIS |
| CONEMP | Catálogo de contabilidades/empresas. | CONREASIG — CONTAGRAL.PRG:497; REASIGNA |
| CONCTR | Parámetros de operación y configuración histórica de la empresa. | CONCARG9_NOM — MOVICON.prg:95; CTCOMNOM1 |

### Cuentas, documentos y movimiento

| Tabla/familia | Función contable o uso | Evidencia representativa |
|---|---|---|
| CONPUC | Catálogo base del plan de cuentas. | GRABAMAES — PLANMAES.PRG:468; CODIGO |
| CONMAE | Cuentas, reglas de captura y acumulados generales/por tercero. | VERSALCOS — PLANMAES.PRG:7; CODIGO |
| VISDOCUM | Tipos documentales, consecutivos y reglas de integración. | DOCUMVIS — CONTABDSI.PRG:2317; CODIGO |
| CONTICOM | Tipos de comprobante contable. | CCOMPRO — DSITAB.PRG:1597; CODIGO |
| CONTIDOC | Configuración documental de legado; no confundir con la variable WPCONTIDOC. | VERIFI2 — MOVICON.prg:6096; DBSEEK |
| CONDOCUM | Cabeceras de documentos contabilizados. | CONSCON — CONSULTA.PRG:1806; DFECHA |
| CONMOVI | Registro maestro de lotes. | MOVI1 — MOVICON.prg:3604; USUA_I |
| CONINTER | Plantilla estructural efectiva para crear lotes y archivos de captura. | INTEACT2 — DSITAB.PRG:282; COPY STRUC crea el detalle MC&lt;lote&gt; a partir de CONINTER |
| MOVxx | Detalle contable por período (MOV00 a MOV18). | CONSUL_1 — CONSULTA.PRG:142; CODIGO |
| MC&lt;lote&gt; | Renglones del lote antes de aplicar la contabilización. | CONCARG95 — MOVICON.prg:528; CUENTA |

### Terceros y datos relacionados

| Tabla/familia | Función contable o uso | Evidencia representativa |
|---|---|---|
| FADCLI | Terceros; estructura compartida con otros módulos y variante local. | ABREPPAL — VISDBF.PRG:39; CCODIGO |
| FADCTAS | Cuentas bancarias asociadas al tercero. | ADMCUENTA — CONTAGRAL.PRG:3077; CODBANCO |
| VISTDOC | Tipos de identificación de terceros. | VERNOM — CONTAGRAL.PRG:982; NOMBRE |
| CIUDAD | Catálogo de ciudades para las direcciones y validaciones del tercero. | CIUOK — CONTAGRAL.PRG:3985; NOMBRE |
| ACTIVIDA | Actividad económica asociada a la ficha del tercero. | TRAB_CLI2 — CONTAGRAL.PRG:2678; NOMBRE |

### Costos y auxiliares

| Tabla/familia | Función contable o uso | Evidencia representativa |
|---|---|---|
| CONCECOS | Catálogo y parametrización de centros de costo. | NOMCENT — CONSULTA.PRG:630; NOMBRE |
| COCENTRO | Acumulados por cuenta, centro y tercero. | CCTANIVEL2 — CONSULTA.PRG:55; CODIGO |
| CONMCOS | Tabla auxiliar de cuentas/acumulados para informes de costos. | INFOR9L — CONINFOR.PRG:22036; COSTOI |
| CONTCOS | Tabla auxiliar por cuenta, tercero y centro para informes. | INFOR9L — CONINFOR.PRG:22036; COSTOI |
| CONMAE2 | Selección de cuentas por usuario. | INFOR09CX — CONINFOR.PRG:21228; CODIGO |
| CONCECO2 | Selección de centros por usuario. | INFOR09CX — CONINFOR.PRG:21218; CODIGO |
| CONTERCE | Acumulados auxiliares por cuenta/tercero/centro. | INFOR07T — CONINFOR.PRG:6592; CODIGO |

### Informes, fiscal e impresión

| Tabla/familia | Función contable o uso | Evidencia representativa |
|---|---|---|
| CONINF1 | Configuración de informes contables. | INFORM1 — CONINFOR.PRG:601; NIVEL |
| CONRET | Acumulados de bases y retenciones. | INFOR15 — CONINFOR.PRG:6901; CODIGO |
| CONIVA | Trabajo de informes de IVA. | INFOR15 — CONINFOR.PRG:6901; CODIGO |
| CONTIRET | Catálogo de tipos/porcentajes de retención. | RETES — DSITAB.PRG:1766; CODIGO |
| CONTIIVA | Catálogo de tipos/porcentajes de IVA. | IVAS — DSITAB.PRG:1849; CODIGO |
| CONRTER | Selección de cuentas y apoyo a informes de terceros. | INFORT1 — DSITAB.PRG:7129; CODIGO |
| CONDECLA | Definiciones para declaraciones. | RENGLONES — DSITAB.PRG:1656; CODIGO |
| CONAJUS | Configuración de cuentas para ajustes. | AJUS02G — DSITAB.PRG:5959; CUENTA |
| CONMAG1 | Definición de formatos fiscales. | DETALLE1N — DSITAB.PRG:7861; NOMFORMA |
| CONMAG2 | Definición de conceptos por formato fiscal. | MEDMAG02 — DSITAB.PRG:2984; CONCEPTO |
| CONMAG3 | Mapeo de cuentas/rangos a formatos y conceptos fiscales. | MEDMAG03 — DSITAB.PRG:3266; FORMATO |
| CONMAGIT | Detalle de movimientos para preparación de información fiscal. | DETAMAG — DSITAB.PRG:4568; CODIGO |
| CONMAGDT | Resultados fiscales acumulados por formato, concepto y tercero. | MEDMAG05 — DSITAB.PRG:4285; CONCEPTO |
| CONGENF | Definición general de formatos impresos. | FADGENF — FACTAB.PRG:723; CODIGO |
| CONFORMA | Elementos/posiciones de formatos de salida. | GRAVAFOR — FACTAB.PRG:879; CODIGO |
| CONFACTU | Elementos/posiciones de formatos de salida. | GRAVAFOR — FACTAB.PRG:880; ARCHI |
| INFORMES | Tabla de trabajo para generación de informes. | GENINFT — CONINFOR.PRG:565; C01 |
| POSINFOR | Plantilla para tablas temporales de consultas e informes. | CCTANIVEL — CONSULTA.PRG:9; COPY STRUC crea TEMC&lt;usuario&gt; para acumular la consulta |
| XADPDF | Registro de archivos/certificados de proveedores en el portal. | CARGA_PORTAL2 — CONINFOR.PRG:8507; NOMBRE |

### Activos y amortizaciones

| Tabla/familia | Función contable o uso | Evidencia representativa |
|---|---|---|
| AFIART | Maestro de activos y valores por período. | AFISALDO — DSITAB.PRG:496; AJA00 |
| AFITAB | Cuentas de ajuste/depreciación de activos. | CONSULFS — DSITAB.PRG:973; CODIGO |
| AFITAB2 | Distribución de activo por centro. | INTEACT3 — DSITAB.PRG:389; PORCE y CENTRO; cAliTAB2 := cAFITAB2 en INTEACT2:256 |
| AMORART | Maestro amortizable y valores por período. | INTEACT3 — DSITAB.PRG:420; AMOCOD, AMONIT y acumulados; cAliART := cAMORART en INTEACT2:259 |
| AMORTAB | Cuentas para amortizaciones y ajustes. | CONSULFS — DSITAB.PRG:973; CODIGO |
| AMORTAB2 | Distribución de amortizables por centro. | INTEACT3 — DSITAB.PRG:466; PORCE y CENTRO; cAliTAB2 := cAMORTAB2 en INTEACT2:261 |

### Consolidación y reembolsos

| Tabla/familia | Función contable o uso | Evidencia representativa |
|---|---|---|
| CONSOLID | Configuración/trabajo de consolidación. | CCOSTOS — DSITAB.PRG:1135; CODIGO |
| CONREMAE | Cabecera de reembolso; estructura física no localizada en la muestra. | ACTU_LOTRE — MOVICON.prg:7389; RMACTU |
| CONREITE | Renglones del reembolso; estructura física no localizada en la muestra. | REEMBOL01 — MOVICON.prg:7345; RIDETALLE |

### Usuarios y auditoría

| Tabla/familia | Función contable o uso | Evidencia representativa |
|---|---|---|
| VISUSU | Identificación de usuarios y campos de acceso del legado. | EXPORMES2B — REPROCES.PRG:8100; INOMBRE |
| VISAUDI | Bitácora de acciones. | AUDIVIS — CONTABDSI.PRG:1567; USUARIO |
| CONOPER | Datos de usuarios en USUARIOS/USUA1/DSIGRABA8; rutina presente, sin llamada ni apertura rastreadas. | USUARIOS — DSITAB.PRG:2716; IINICIAL |

### Presupuesto

| Tabla/familia | Función contable o uso | Evidencia representativa |
|---|---|---|
| TIDPRESU | Tabla que las funciones de presupuesto leen y modifican; no CONPRESU. | PRESU1 — CONPRESU.PRG:17; CODIGO |

### Dependencias de otras funciones incluidas en el proyecto

| Tabla/familia | Función contable o uso | Evidencia representativa |
|---|---|---|
| CADEMP | Clasificación de empresa del tercero consultada en sus fichas/listados. | LISTER4 — CONTAGRAL.PRG:1809; NOMBRE |
| CADFACTU | Catálogo fuente de elementos copiados por GRAVAFOR, según cAR. | GRAVAFOR — FACTAB.PRG:880; ARCHI |
| CADFORMA | Elementos del formato en rutinas compartidas; depende de cAR/cT. | GRAVAFOR — FACTAB.PRG:879; CODIGO |
| CADGENF | Definición de formatos en rutinas compartidas; depende del módulo/parámetro elegido. | FADGENF — FACTAB.PRG:723; CODIGO |
| CADMAE | Consulta de obligaciones/cartera del tercero. | CADTOT — CONTAGRAL.PRG:408; CCODIGO |
| CAUFACTU | Catálogo fuente de elementos copiados por GRAVAFOR, según cAR. | GRAVAFOR — FACTAB.PRG:880; ARCHI |
| CAUFORMA | Elementos del formato en rutinas compartidas; depende de cAR/cT. | GRAVAFOR — FACTAB.PRG:879; CODIGO |
| CAUGENF | Definición de formatos en rutinas compartidas; depende del módulo/parámetro elegido. | FADGENF — FACTAB.PRG:723; CODIGO |
| COMFACTU | Catálogo fuente de elementos copiados por GRAVAFOR, según cAR. | GRAVAFOR — FACTAB.PRG:880; ARCHI |
| COMFORMA | Elementos del formato en rutinas compartidas; depende de cAR/cT. | GRAVAFOR — FACTAB.PRG:879; CODIGO |
| COMGENF | Definición de formatos en rutinas compartidas; depende del módulo/parámetro elegido. | FADGENF — FACTAB.PRG:723; CODIGO |
| EVENTOS | Catálogo de eventos en EVENTOS y sus auxiliares. | EVENTOS — FACTAB.PRG:153; CTABCOD |
| FADCON | Parámetros de cartera y mora usados en la ficha del tercero. | CLIENTES — CONTAGRAL.PRG:802; CTMAXCART |
| FADDIA | Cabecera de factura consultada desde VERDETAL. | VERDETAL — CONSULTA.PRG:1994; FACODIGO |
| FADFACTU | Catálogo fuente de elementos copiados por GRAVAFOR, según cAR. | GRAVAFOR — FACTAB.PRG:880; ARCHI |
| FADFORMA | Elementos del formato en rutinas compartidas; depende de cAR/cT. | GRAVAFOR — FACTAB.PRG:879; CODIGO |
| FADGENF | Definición de formatos en rutinas compartidas; depende del módulo/parámetro elegido. | FADGENF — FACTAB.PRG:723; CODIGO |
| FADITE | Renglones de factura totalizados desde VERDETAL. | VERDETAL — CONSULTA.PRG:2062; IFNOMBRE |
| FADPAGO | Nombre de la forma de pago en la consulta documental. | VERDETAL — CONSULTA.PRG:2017; NOMBRE |
| FADTAB | Zonas y clasificaciones en ZONAS/DSIESTAZ. | ZONAS — FACTAB.PRG:121; CTABCOD |
| FADVEHI | Catálogo de vehículos mantenido por VEHI001 y funciones relacionadas. | VEHI001 — FACTAB.PRG:27; VCODIGO |
| FAESPERA | Tabla de espera: rama alternativa de CIUDAD(cT). | CIUDAD — FACTAB.PRG:271; CODIGO |
| NOMCALEN | Validación/búsqueda de fechas y calendario. | CAL_VIGMC — CONTAGRAL.PRG:283; DIA |
| TIDBODE | Bodegas y rutas en apertura de sucursales y replicación de terceros. | ABRESUC_MER — CONTABDSI.PRG:3176; ESTADO |
| TIDFORMA | Elementos del formato en rutinas compartidas; depende de cAR/cT. | GRAVAFOR — FACTAB.PRG:879; CODIGO |
| TIDGENF | Definición de formatos en rutinas compartidas; depende del módulo/parámetro elegido. | FADGENF — FACTAB.PRG:723; CODIGO |
| TIDINVE | Catálogo fuente de elementos copiados por GRAVAFOR, según cAR. | GRAVAFOR — FACTAB.PRG:880; ARCHI |
| TIDPEDI | Conceptos de pedido listados en una rama de ILISTAR. | ILISTAR — CONTABDSI.PRG:2964; PEDCOD |
| TIDSAL | Actualización de información comercial replicada por REPLI_METC. | REPLI_METC — CONTAGRAL.PRG:3937; INMETCOMP |
| TIDSUCUR | Sucursales listadas en una rama de ILISTAR. | ILISTAR — CONTABDSI.PRG:2933; SUCURSAL |
| TIDTAB | Clasificaciones listadas en una rama de ILISTAR. | ILISTAR — CONTABDSI.PRG:2840; CTABCOD |
| TIDTIPOS | Tipos de inventario listados en una rama de ILISTAR. | ILISTAR — CONTABDSI.PRG:2876; TIPO |
| TIDTRET | Tipos de retención listados en una rama de ILISTAR. | ILISTAR — CONTABDSI.PRG:2909; CODIGO |
| VEDVEN | Datos del vendedor en consultas y listados. | LISRUTASX — CONTAGRAL.PRG:1311; VNOMBRE |
| VISBODE | Bodegas/centros listados en una rama de ILISTAR. | ILISTAR — CONTABDSI.PRG:2824; CCOSTO |
| XADFACTU | Catálogo fuente de elementos copiados por GRAVAFOR, según cAR. | GRAVAFOR — FACTAB.PRG:880; ARCHI |
| XADFORMA | Elementos del formato en rutinas compartidas; depende de cAR/cT. | GRAVAFOR — FACTAB.PRG:879; CODIGO |
| XADGENF | Definición de formatos en rutinas compartidas; depende del módulo/parámetro elegido. | FADGENF — FACTAB.PRG:723; CODIGO |
| XADMAE | Documentos de cuentas por pagar usados en preparación fiscal. | MOVMEDCXP — DSITAB.PRG:3962; CCODIGO |
| XADMOVI | Importes y retenciones de cuentas por pagar para informes. | INFOR53R — CONINFOR.PRG:6280; XVLRRETI |
| XADPAGOS | Condiciones/tipos de pago consultados para terceros. | VERNOM — CONTAGRAL.PRG:987; NOMBRE |

## Cómo leer las dependencias compartidas

Las familias FAD/CAD/XAD/TID/COM/CAU de formatos se leen o escriben en ramas de FORMATO, GRAVAFOR y otras funciones comunes según cAR/cT. Por eso no son “sólo apertura”; tampoco deben presentarse todas como tablas exclusivas del módulo contable.

Igualmente, ILISTAR tiene ramas que muestran bodegas, sucursales, tipos y pedidos; las dependencias asociadas están separadas del núcleo. Este criterio cumple el alcance solicitado de funciones del proyecto. Una depuración adicional limitada sólo a rutas invocadas por el menú necesitaría especializar parámetros y seguir las llamadas dinámicas.

## Tablas temporales y campos

Los resultados generados como TEM*, TMP_D/TMP_C y TMP_N* no se convierten aquí en maestros persistentes adicionales. Sus plantillas efectivamente utilizadas se conservan; las estructuras calculadas por SQL o por usuario/período requieren su propia definición al implementar cada proceso.

DICCIONARIO_DEPURADO_CONTABDSI.md contiene solamente las estructuras de las tablas retenidas. No se han eliminado campos de esas tablas: ese sería otro análisis, porque macros, SQL y funciones genéricas pueden utilizar campos sin una referencia literal directa.

## Seguridad y límites

**Excluir del esquema funcional no autoriza borrar el archivo del sistema original.** La apertura masiva, indexación o creación de empresas todavía podría necesitar su existencia.

Este resultado se basa en revisión estática y evidencia de funciones, no en trazas de ejecución. Los alias genéricos y ramas condicionales se interpretan de forma conservadora. Las relaciones son lógicas; no se certifican claves foráneas instaladas.

Los casos no retenidos y sus motivos están en EXCLUSIONES_CONTABDSI.md. El inventario amplio anterior se conserva como referencia física; esta revisión sustituye sus atribuciones funcionales cuando difieren.
