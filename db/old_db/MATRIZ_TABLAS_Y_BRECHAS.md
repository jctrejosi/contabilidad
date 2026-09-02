# Matriz de almacenamiento: legado → PostgreSQL

98 tablas/familias funcionales frente a 52 tablas del destino. Ninguna equivalencia integral se certifica sólo por nombre. Cada estado refiere al almacenamiento, no a ejecución probada.

| Origen | Estado | Destino existente | Brecha / transformación | Proceso |
|---|---|---|---|---|
| VISION | Parcial | `integraciones` | Separar configuración global, rutas de origen y almacenamiento de archivos; configuracion JSON no tiene contrato para reproducir todas las opciones. | P01 |
| CONEMP | Parcial | `companias`, `compania_anios` | Conservar código de contabilidad y reasignaciones; validar varias contabilidades del mismo NIT antes de aplicar UNIQUE(nit,digito). | P01 |
| CONCTR | Parcial | `parametros_operacion`, `periodos_contables`, `companias` | Faltan fecha operativa, longitud de observación, ruta documental, segunda leyenda y seis parámetros de nómina; sincronizar periodos y flags; MCR no se guarda en DSIGRABA6. | P02 |
| CONPUC | Parcial | `cuentas` | Conservar catálogo base independiente o procedencia/versionado; no mezclar automáticamente catálogo base y cuentas por empresa. | P03 |
| CONMAE | Parcial | `cuentas`, `saldos_cuenta`, `saldos_cuenta_tercero` | Separar maestro de cuentas de registros cuenta+NIT y acumulados; faltan reglas/campos fiscales, NIIF, clasificación corriente y asignaciones; saldo inicial requiere año y dimensiones. | P03 |
| VISDOCUM | Parcial | `tipos_documento`, `consecutivos_comprobantes`, `plantillas_contables`, `plantilla_lineas` | Preservar tipo documental separado del comprobante, ámbito compartido/local y claves originales. Plantillas NOM/DEB/CRE01..08 no son simples valores fijos. | P04 |
| CONTICOM | Parcial | `comprobantes`, `consecutivos_comprobantes` | Validar significado de consecutivo actual/próximo, alcance por año y no renumerar documentos históricos. | P04 |
| CONTIDOC | Parcial | `tipos_documento`, `consecutivos_comprobantes`, `plantillas_contables`, `plantilla_lineas` | Preservar tipo documental separado del comprobante, ámbito compartido/local y claves originales. Plantillas NOM/DEB/CRE01..08 no son simples valores fijos. | P04 |
| CONDOCUM | Parcial | `documentos` | Faltan tipo_documento_id y clave de documento original; DDOCUM alfanumérico no equivale automáticamente a numero bigint. Conciliar cabeceras con MOVxx. | P09 |
| CONMOVI | Parcial | `lotes` | Conservar usuarios inicio/fin, estado original, historial y marca de archivo; no recontabilizar lotes ya aplicados. | P08 |
| CONINTER | Sustitución técnica | `lote_lineas` | Plantilla de estructura, no maestro contable: sustituir COPY STRUC por el DDL versionado; conservar valores existentes sólo si se acredita uso como datos. | P08 |
| MOVxx | Parcial | `documentos`, `documento_lineas`, `saldos_cuenta` | TVALOR firmado debe desdoblarse; faltan tipo documental, fecha por renglón, moneda/valor alterno, NITN y trazabilidad original. Revisar granularidad y estados/borrados. | P09 |
| MC&lt;lote&gt; | Parcial | `lotes`, `lote_lineas`, `documentos`, `documento_lineas` | Mantener múltiples documentos/tipos/fechas por lote y NITN; normalizar por agrupación original. La función destino actualmente aplana el lote a un documento. | P08 |
| FADCLI | Parcial | `terceros`, `tercero_etiquetas` | Faltan código original, nombres separados, email, actividad económica, datos fiscales/comerciales y relaciones. Resolver terceros globales versus propios sin fusionar sólo por NIT. | P05 |
| FADCTAS | Sin estructura | — | Crear tercero_cuentas_bancarias: tercero, banco, tipo, número como texto, observación y principal; tratar datos personales con acceso restringido. | P06 |
| VISTDOC | Sin estructura | — | Crear catálogos codificados de municipios/ciudades, actividades y tipos de identificación; columnas de texto en terceros no conservan catálogos ni validaciones. | P05 |
| CIUDAD | Sin estructura | — | Crear catálogos codificados de municipios/ciudades, actividades y tipos de identificación; columnas de texto en terceros no conservan catálogos ni validaciones. | P05 |
| ACTIVIDA | Sin estructura | — | Crear catálogos codificados de municipios/ciudades, actividades y tipos de identificación; columnas de texto en terceros no conservan catálogos ni validaciones. | P05 |
| CONCECOS | Parcial | `centros_costos` | Conservar jerarquía, clasificación y reglas utilizadas; validar claves compuestas y alcance por compañía. | P07 |
| COCENTRO | Derivable con cambios | `documento_lineas`, `saldos_cuenta_tercero`, `saldos_cuenta_centro`, `acumulados_tercero`, `acumulados_centro` | Conservar cruce simultáneo cuenta+tercero+centro y saldo inicial; dos agregados separados no permiten reconstruir ese cruce. Derivar del detalle o crear agregado multidimensional. | P14 |
| CONMCOS | Derivable con cambios | `documento_lineas`, `saldos_cuenta_tercero`, `saldos_cuenta_centro`, `acumulados_tercero`, `acumulados_centro` | Conservar cruce simultáneo cuenta+tercero+centro y saldo inicial; dos agregados separados no permiten reconstruir ese cruce. Derivar del detalle o crear agregado multidimensional. | P14 |
| CONTCOS | Derivable con cambios | `documento_lineas`, `saldos_cuenta_tercero`, `saldos_cuenta_centro`, `acumulados_tercero`, `acumulados_centro` | Conservar cruce simultáneo cuenta+tercero+centro y saldo inicial; dos agregados separados no permiten reconstruir ese cruce. Derivar del detalle o crear agregado multidimensional. | P14 |
| CONMAE2 | Sin estructura | — | Crear selecciones/filtros de informe por usuario y sesión; no convertir selecciones en maestros duplicados. | P15 |
| CONCECO2 | Sin estructura | — | Crear selecciones/filtros de informe por usuario y sesión; no convertir selecciones en maestros duplicados. | P15 |
| CONTERCE | Derivable con cambios | `documento_lineas`, `saldos_cuenta_tercero`, `saldos_cuenta_centro`, `acumulados_tercero`, `acumulados_centro` | Conservar cruce simultáneo cuenta+tercero+centro y saldo inicial; dos agregados separados no permiten reconstruir ese cruce. Derivar del detalle o crear agregado multidimensional. | P14 |
| CONINF1 | Sin estructura | — | Crear definiciones y renglones de informe: NIVEL, CUENTA, NOMBRE, TIPO, PPTO, VLRBASE; formato_documental no equivale al generador/flujo de caja. | P15 |
| CONRET | Derivable con cambios | `acumulados_retencion` | regenerar_acumulados(Retencion) actualiza terceros, no retenciones; preservar bases, período, concepto y ajustes/certificados. | P16 |
| CONIVA | Derivable con cambios | `acumulados_iva` | regenerar_acumulados(Iva) no reconstruye esta tabla; falta relación fiscal inequívoca desde el renglón. | P17 |
| CONTIRET | Parcial | `conceptos_retencion` | Mapear VLRPOR de porcentaje a fracción, confirmar vigencia, base y vinculación a cuenta; no usar tarifas actuales para historia. | P16 |
| CONTIIVA | Parcial | `tarifas_iva` | Mapear VLRPOR a fracción y conservar clase/vigencia; falta tarifa fiscal persistida por movimiento. | P17 |
| CONRTER | Parcial | `cuentas`, `acumulados_tercero` | Conservar selección/configuración de cuentas para informes de terceros; acumulado no representa la configuración. | P14 |
| CONDECLA | Parcial | `renglones_renta` | Validar reglas y relaciones con cuentas/RENGLON; necesita historial de definiciones y reproducción de resultados. | P18 |
| CONAJUS | Sin estructura | — | Crear reglas de ajuste/revalorización por cuenta y vigencia; procesos sólo registra la ejecución, no sustituye las reglas. | P22 |
| CONMAG1 | Parcial | `formatos_exogenos` | Faltan definición de elementos/campos y columnas COMBO; UNIQUE(compania,codigo) impide varias vigencias del mismo formato. | P19 |
| CONMAG2 | Parcial | `formato_conceptos`, `medio_topes` | Preservar MONTO, VALOR1/2 y selección de columnas; clave y relación formato/concepto/vigencia. | P19 |
| CONMAG3 | Parcial | `formato_asignaciones`, `formato_conceptos` | Faltan rango CUENTA..CUENTA2, concepto en asignación, TIPO/TIPOMED, origen CXP, columnas y filtros; una cuenta por formato no representa la regla. | P19 |
| CONMAGIT | Sin estructura | — | Crear detalle de generación ligado a documento/renglón fuente: tipo, fecha, referencia, base, valor, tercero, formato y concepto. medio_filas no sustituye detalle transaccional por documento. | P20 |
| CONMAGDT | Parcial | `generaciones_medios`, `medio_filas`, `medio_conciliaciones` | Definir VALOR1..VALOR11, TERCERO2, MODCXP, COLBASE/COLIVA mediante contrato tipado o JSON versionado. detalle JSON por sí solo no acredita cobertura. | P20 |
| CONGENF | Parcial | `formatos_documentales`, `formato_elementos` | Preservar catálogo de campos y expresiones ARCHI/CAMPO, secciones, totales, condiciones, límites, formato y preview; CHECK tipo sólo admite ocho clases. | P21 |
| CONFORMA | Parcial | `formatos_documentales`, `formato_elementos` | Preservar catálogo de campos y expresiones ARCHI/CAMPO, secciones, totales, condiciones, límites, formato y preview; CHECK tipo sólo admite ocho clases. | P21 |
| CONFACTU | Parcial | `formatos_documentales`, `formato_elementos` | Preservar catálogo de campos y expresiones ARCHI/CAMPO, secciones, totales, condiciones, límites, formato y preview; CHECK tipo sólo admite ocho clases. | P21 |
| INFORMES | Sustitución técnica | — | Reemplazar tablas temporales por consultas/CTE/tablas temporales aisladas por ejecución; persistir definición, parámetros y exportación cuando corresponda. | P15 |
| POSINFOR | Sustitución técnica | — | Reemplazar tablas temporales por consultas/CTE/tablas temporales aisladas por ejecución; persistir definición, parámetros y exportación cuando corresponda. | P15 |
| XADPDF | Sin estructura | — | Crear archivos y certificados de tercero con metadatos, vínculo contable, almacenamiento seguro, hash, permisos, publicación y retiro. | P23 |
| AFIART | Sin estructura | — | Crear maestros de activos/amortizables, cuentas/reglas, cuotas por período y distribución por centros; conservar ajustes, baja, vida útil y vínculo al lote generado. | P24 |
| AFITAB | Sin estructura | — | Crear maestros de activos/amortizables, cuentas/reglas, cuotas por período y distribución por centros; conservar ajustes, baja, vida útil y vínculo al lote generado. | P24 |
| AFITAB2 | Sin estructura | — | Crear maestros de activos/amortizables, cuentas/reglas, cuotas por período y distribución por centros; conservar ajustes, baja, vida útil y vínculo al lote generado. | P24 |
| AMORART | Sin estructura | — | Crear maestros de activos/amortizables, cuentas/reglas, cuotas por período y distribución por centros; conservar ajustes, baja, vida útil y vínculo al lote generado. | P24 |
| AMORTAB | Sin estructura | — | Crear maestros de activos/amortizables, cuentas/reglas, cuotas por período y distribución por centros; conservar ajustes, baja, vida útil y vínculo al lote generado. | P24 |
| AMORTAB2 | Sin estructura | — | Crear maestros de activos/amortizables, cuentas/reglas, cuotas por período y distribución por centros; conservar ajustes, baja, vida útil y vínculo al lote generado. | P24 |
| CONSOLID | Parcial | `consolidaciones`, `consolidacion_origenes` | Falta persistir correspondencias de cuentas/centros y procedencia de cada resultado; verificar CODIGO/NOMBRE/HIST/VALOR y referencias de empresas. | P27 |
| CONREMAE | Sin estructura | — | Crear reembolsos y detalle con tercero, fecha, valor, centro y centro de cruce; conservar estado aplicado y vínculo al lote/documentos. Estructura física pendiente de localizar. | P12 |
| CONREITE | Sin estructura | — | Crear reembolsos y detalle con tercero, fecha, valor, centro y centro de cruce; conservar estado aplicado y vínculo al lote/documentos. Estructura física pendiente de localizar. | P12 |
| VISUSU | Parcial | `usuarios`, `roles`, `permisos`, `rol_permisos` | Agregar usuario_companias y homologación de identificadores; CONOPER es rutina heredada sin llamada rastreada; no copiar permisos permisivos ni claves en claro. | P28 |
| VISAUDI | Parcial | `auditoria` | Preservar usuario/fecha/hora/acción/valor original y procedencia; asegurar bitácora de cambios e inmutabilidad, no sólo columnas de auditoría. | P28 |
| CONOPER | Parcial | `usuarios`, `roles`, `permisos`, `rol_permisos` | Agregar usuario_companias y homologación de identificadores; CONOPER es rutina heredada sin llamada rastreada; no copiar permisos permisivos ni claves en claro. | P28 |
| TIDPRESU | Parcial | `presupuestos`, `presupuesto_rubros`, `presupuesto_valores` | Falta CONCEPTO/nombre de rubro y unicidad código+centro; resolver PRE00/PRE13 y MOV00..13, jerarquía 2+2+2+3 y ejecución vs presupuesto. | P29 |
| CADEMP | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| CADFACTU | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| CADFORMA | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| CADGENF | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| CADMAE | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| CAUFACTU | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| CAUFORMA | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| CAUGENF | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| COMFACTU | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| COMFORMA | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| COMGENF | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| EVENTOS | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| FADCON | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| FADDIA | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| FADFACTU | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| FADFORMA | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| FADGENF | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| FADITE | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| FADPAGO | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| FADTAB | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| FADVEHI | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| FAESPERA | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| NOMCALEN | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| TIDBODE | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| TIDFORMA | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| TIDGENF | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| TIDINVE | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| TIDPEDI | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| TIDSAL | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| TIDSUCUR | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| TIDTAB | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| TIDTIPOS | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| TIDTRET | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| VEDVEN | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| VISBODE | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| XADFACTU | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| XADFORMA | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| XADGENF | Parcial condicional | `formatos_documentales`, `formato_elementos` | Ramas de formatos compartidos: requieren ámbito módulo, catálogo de campos/expresiones y clave compuesta. Confirmar rutas habilitadas; no omitirlas como simples aperturas. | P21 |
| XADMAE | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| XADMOVI | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |
| XADPAGOS | Integración requerida | `integraciones` | integraciones guarda configuración/estado, no los registros de este módulo. Mantener API/consulta al origen o crear réplica tipada sólo del contrato utilizado; no perder consultas ni escrituras compartidas. | P30 |

## Evidencia y campos por tabla

### VISION

- ABREPPAL — VISDBF.PRG:11 — CTDIRVIS
- ABREDBF2 — VISDBF.PRG:154 — CTCONDIR
- ABRE_CONTAB — CONTABDSI.PRG:661 — CTFTE1
- NUMDOC_SGASTOS — CONTABDSI.PRG:2102 — CTULCONSP
- INTERCAM2 — MOVICON.prg:2861 — CTCONDIR

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CTCODCIA`, `CTCIA`, `CTNIT`, `CTCIUDAD`, `CTDIRECC`, `CTTELEF`, `CTFCHOY`, `CTNORMAL`, `CTCOMPRI`, `CTDOBLE`, `CTPASS`, `CTPASSW`, `CTINIS`, `CTANO`, `CTCOLOR1`, `CTCOLOR2`, `CTCONTAB`, `CTTIPCON`, `CTNIVEL`, `CTTIPDOC`, `CTTIPCOM`, `CTCONTROL`, `CTDIRVIS`, `CTCONDIR`, `CTINVDIR`, `CTFACDIR`, `CTCARDIR`, `CTCXPDIR`, `CTSER1`, `CTSER2`, `CTLINF`, `CTLINI`, `CTLINX`, `CTLINC`, `CTMOD`, `CTCAJON`, `CTMES13`, `CTLOTF`, `CTLOTI`, `CTLOTX`, `CTFTE1`, `CTFTE2`, `CTFTE3`, `CTFTE4`, `CTPUERTOS`, `CXPCONCE`, `CTLEECON`, `CTLOTC`, `EDITOR`, `CTCONTAB2`, `CTCODCIU`, `CTFUERAL`, `CRUTAWEB`, `CTCLUBES`, `CTBFCH`, `CTCADUCA`, `CTOPERAF`, `CTREMOTO`, `CTSUCURSAL`, `CTAUTODOC`, `CTDATAFONO`, `MODNIIF`, `REPLICLI`, `CTPEDDIR`, `CTMONEXT`, `REALNIT`, `CTTIPOTER`, `CTOBSERCA`, `CTCONTA`, `CTSUCAUDI`, `CTHORAI`, `CTHORAF`, `TIPOTALL`, `CTPRP`, `CRUTAREPO`, `CTORDENL`, `CTINTDIR`, `CTOPESUC`, `CTCODSUC`, `CTRETITER`, `CTRUTAFE`, `CTRUTAPRN`, `CTPRESOP`, `CTCONSOP`, `CTULCONSP`, `CTFCHSOP`, `CTLIMISOP`, `CTREPLISUC`, `CTREPLIFE`, `CTRUTAFE1`, `CTRUTAFE2`.

### CONEMP

- CONREASIG — CONTAGRAL.PRG:497 — REASIGNA
- PROCERE — CONTAGRAL.PRG:513 — REASIGNA
- CONSOL12 — DSITAB.PRG:1304 — EMPNOM
- CIAS — DSITAB.PRG:1917 — EMPCOD
- BORRACON — DSITAB.PRG:1949 — EMPCOD

Destino: companias — schema/02_nucleo.sql:11; compania_anios — schema/02_nucleo.sql:32

Campos físicos/código inventariados: `EMPCOD`, `EMPNOM`, `EMPNIT`, `EMPCLAV`, `REASIGNA`, `HABILITA`.

### CONCTR

- CONCARG9_NOM — MOVICON.prg:95 — CTCOMNOM1
- INICIO — CONTABDSI.PRG:620 — CTTERDOC
- PARAMS — DSITAB.PRG:1358 — CTCODCIA
- PARAMS_NOMI — DSITAB.PRG:1445 — CTCOMNOM1
- DSIGRABA6_NOM — DSITAB.PRG:1473 — CTCOMNOM1

Destino: parametros_operacion — schema/02_nucleo.sql:74; periodos_contables — schema/02_nucleo.sql:49; companias — schema/02_nucleo.sql:11

Campos físicos/código inventariados: `CTCODCIA`, `CTCIA`, `CTNIT`, `CTCIUDAD`, `CTDIRECC`, `CTFCINIP`, `CTFCFINP`, `CTFCHOY`, `CTCLAVE1`, `CTCLAVE2`, `CTFSIS`, `CTCLAVE`, `CTLLAVE`, `CTVALDOL`, `CTCTARES`, `CTNORMAL`, `CTCOMPRI`, `CTDOBLE`, `CTCLOR1`, `CTCLOR2`, `CTCLOR3`, `CTCLOR4`, `CTCTAEL`, `CTMEM`, `CTSONIDO`, `CTDOS`, `CTDIREC`, `CTCOPYCIE`, `CTCOPYACT`, `CTDDOS`, `CTPASS`, `CTRED`, `CTPUC`, `CTLEY1`, `CTLEY2`, `CTLEY3`, `CTLEY4`, `CTTNIT`, `COMESES`, `CTSUPER`, `CTPASSW`, `CTINIS`, `CTBLOFCH`, `CTSUBCU`, `CTTOBS`, `CTCORTE`, `CTVERDOC`, `CTCXP`, `CTNIVEL`, `CTMESES`, `CTANO`, `CTVERTIPO`, `CTUTERCE`, `CTCONTROL`, `CTDOCUM`, `CTTERDOC`, `CTCODCIU`, `CT00`, `CT01`, `CT02`, `CT03`, `CT04`, `CT05`, `CT06`, `CT07`, `CT08`, `CT09`, `CT10`, `CT11`, `CT12`, `CTORDENL`, `CTENIIF`, `CTLINCER`, `CTCOMNOM1`, `CTDOCNOM1`, `CTCOMNOM2`, `CTDOCNOM2`, `CTCOMNOM3`, `CTDOCNOM3`.

### CONPUC

- GRABAMAES — PLANMAES.PRG:468 — CODIGO
- CMAEST2 — PLANMAES.PRG:382 — DBSEEK

Destino: cuentas — schema/03_maestros.sql:12

Campos físicos/código inventariados: `CODIGO`, `MFLAG`, `MNOMBRE`.

### CONMAE

- VERSALCOS — PLANMAES.PRG:7 — CODIGO
- CMAESTRO — PLANMAES.PRG:27 — NIT
- ANA_MOVCTA3 — REPROCES.PRG:74 — MTC
- VERSALDOS — PLANMAES.PRG:88 — MSALDO
- MAIN — CONTABDSI.PRG:97 — NIT

Destino: cuentas — schema/03_maestros.sql:12; saldos_cuenta — schema/05_saldos.sql:12; saldos_cuenta_tercero — schema/05_saldos.sql:30

Campos físicos/código inventariados: `CODIGO`, `NIT`, `MNOMBRE`, `MSALDO`, `MACMDEB01`, `MACMCRE01`, `MACMDEB02`, `MACMCRE02`, `MACMDEB03`, `MACMCRE03`, `MACMCRE04`, `MACMDEB04`, `MACMDEB05`, `MACMCRE05`, `MACMDEB06`, `MACMCRE06`, `MACMDEB07`, `MACMCRE07`, `MACMDEB08`, `MACMCRE08`, `MACMDEB09`, `MACMCRE09`, `MACMDEB10`, `MACMCRE10`, `MACMDEB11`, `MACMCRE11`, `MACMCRE12`, `MACMDEB12`, `MACMCRE13`, `MACMDEB13`, `MACMCRE14`, `MACMDEB14`, `MACMCRE15`, `MACMDEB15`, `MACMCRE16`, `MACMDEB16`, `MACMCRE17`, `MACMDEB17`, `MACMCRE18`, `MACMDEB18`, `MAJUSTE`, `MCOSTOS`, `MDISTRICC`, `MCTAPAGOS`, `MIVA_RET`, `PORIVARET`, `MTC`, `MCMOVI`, `SALE`, `GENERAL`, `MAPLICAR`, `MBASER`, `NITN`, `FORMATO`, `CONCEPTO`, `TIPOMED`, `VALMED`, `RENGLON`, `SUMARES`, `COSTOI`, `COSTOF`, `CTACRUCE`, `PMED1`, `PMED2`, `PMED3`, `PMED4`, `PMED5`, `PMED6`, `FORMATO2`, `CONCEPTO2`, `MODCXP`, `COLBASE`, `COLIVA`, `MCOSABC`, `MSUBCTOS`, `ESTRUABC`, `EMPRESA`, `NEGOCIO`, `AREA`, `ECHOECO`, `TIPONIIF`, `TRANSFOR`, `NIVEL`, `NIIFSALDO`, `NIIFDEB00`, `NIIFCRE00`, `NIIFDEB01`, `NIIFCRE01`, `NIIFDEB02`, `NIIFCRE02`, `NIIFDEB03`, `NIIFCRE03`, `NIIFDEB04`, `NIIFCRE04`, `NIIFDEB05`, `NIIFCRE05`, `NIIFDEB06`, `NIIFCRE06`, `NIIFDEB07`, `NIIFCRE07`, `NIIFDEB08`, `NIIFCRE08`, `NIIFDEB09`, `NIIFCRE09`, `NIIFDEB10`, `NIIFCRE10`, `NIIFDEB11`, `NIIFCRE11`, `NIIFDEB12`, `NIIFCRE12`, `MRECURSO`, `MNOMNIIF`, `MBLOQUE`, `REVELA`, `NIIFDEB13`, `NIIFCRE13`, `NIIFDEB14`, `NIIFCRE14`, `NIIFDEB15`, `NIIFCRE15`, `NIIFDEB16`, `NIIFCRE16`, `NIIFDEB17`, `NIIFCRE17`, `NIIFCRE18`, `NIIFDEB18`, `CTCTABASE`.

### VISDOCUM

- DOCUMVIS — CONTABDSI.PRG:2317 — CODIGO
- TRAB_DOC — CONTABDSI.PRG:2518 — DISTRICC
- BORRDOV — CONTABDSI.PRG:2806 — CODIGO
- ILISTAR — CONTABDSI.PRG:2857 — CODIGO
- DOCESTA2 — CONTABDSI.PRG:2982 — NOMBRE

Destino: tipos_documento — schema/03_maestros.sql:135; consecutivos_comprobantes — schema/03_maestros.sql:121; plantillas_contables — schema/03_maestros.sql:212; plantilla_lineas — schema/03_maestros.sql:226

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `MODULO`, `TIPO`, `CONSE`, `MODICONSE`, `GMORA`, `FPAGO`, `DOCOFI`, `MODICOS`, `CONVER`, `DOCCONVER`, `VALORA`, `VLRCOS`, `TRASLADO`, `ICXP`, `ICONTAB`, `SUGECOS`, `GRABASAL`, `REPETI`, `VLRVTA`, `NIMP1`, `IMP1`, `RET1`, `NRET1`, `RET2`, `NRET2`, `RET3`, `NRET3`, `RET4`, `NRET4`, `NOM01`, `DEB01`, `CRE01`, `NOM02`, `DEB02`, `CRE02`, `NOM03`, `DEB03`, `CRE03`, `NOM04`, `DEB04`, `CRE04`, `NOM05`, `DEB05`, `CRE05`, `NOM06`, `DEB06`, `CRE06`, `NOM07`, `DEB07`, `CRE07`, `NOM08`, `DEB08`, `CRE08`, `DEB09`, `CRE09`, `COMPRO`, `BANCOS`, `CCOSTO`, `INTERES`, `ARETEN`, `AREPITE`, `MODIIMP`, `LEETRAS`, `CXPCONCE`, `CTRPROVE`, `DISTRICC`, `DCTO2`, `DOCAFE`, `BLOLOTE`, `EXTRALO`, `VERIIMP`, `RECON`, `PREFIJO`, `AUTORIZA`, `CEROSCV`, `FECHADOC`, `ANULROJO`, `RUBRO`, `CLAVE`, `CLAVE2`, `MOVBLOQ`, `ASISAL`, `VALDIAN`, `BODEGA`, `SGASTOS`.

### CONTICOM

- CCOMPRO — DSITAB.PRG:1597 — CODIGO
- ODLG_INIT — DSITAB.PRG:1614 — CODIGO
- CCOMPRO1 — DSITAB.PRG:1630 — CODIGO
- AYUDCOMP — CONTABDSI.PRG:3156 — CODIGO
- NOMCOMPRO — CONINFOR.PRG:3972 — NOMBRE

Destino: comprobantes — schema/03_maestros.sql:106; consecutivos_comprobantes — schema/03_maestros.sql:121

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `HIST`, `CTABDES`.

### CONTIDOC

- VERIFI2 — MOVICON.prg:6096 — DBSEEK

Destino: tipos_documento — schema/03_maestros.sql:135; consecutivos_comprobantes — schema/03_maestros.sql:121; plantillas_contables — schema/03_maestros.sql:212; plantilla_lineas — schema/03_maestros.sql:226

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `CONCILIA`, `HIST`, `MANEJOC`, `CONSE`, `LEEDOC`, `DCOSTO`.

### CONDOCUM

- CONSCON — CONSULTA.PRG:1806 — DFECHA
- VERITCON — CONSULTA.PRG:1876 — DDOCUM
- ACTUALIZAR — MOVICON.prg:3205 — DDOCUM
- CONTA2 — REPROCES.PRG:6089 — DFECHA
- CON901 — REPROCES.PRG:6130 — DVALOR

Destino: documentos — schema/04_movimientos.sql:85

Campos físicos/código inventariados: `DDOCUM`, `DDOCUMI`, `DNIT`, `DCOMPRO`, `DTIPODOC`, `DFECHA`, `DDETALLE`, `DVALOR`, `DMODULO`, `DDOCUM2`.

### CONMOVI

- MOVI1 — MOVICON.prg:3604 — USUA_I
- INDELOT — MOVICON.prg:3668 — LOTE
- MOVI11 — MOVICON.prg:3700 — LOTE
- IMPLOTE — MOVICON.prg:4498 — MES
- CREALOT2 — MOVICON.prg:5458 — USUA_I

Destino: lotes — schema/04_movimientos.sql:12

Campos físicos/código inventariados: `LOTE`, `NOMBRE`, `MES`, `ESTADO`, `USUA_I`, `USUA_F`, `FECHA`, `HORA`, `HIST`, `BORRAR`, `DEBITOS`, `CREDITOS`, `ITEMS`, `ARCHOK`.

### CONINTER

- INTEACT2 — DSITAB.PRG:282 — COPY STRUC crea el detalle MC&lt;lote&gt; a partir de CONINTER

Destino: lote_lineas — schema/04_movimientos.sql:45

Campos físicos/código inventariados: `CUENTA`, `NIT`, `DEBITO`, `CREDITO`, `BASE`, `TFASE`, `CONCEPTO`, `TCOMPR`, `TIPODOC`, `TFECHA`, `TDOCUM`, `TINCON`, `TDOCUM2`, `NITN`.

### MOVxx

- CONSUL_1 — CONSULTA.PRG:142 — CODIGO
- DOBLE_LOT — REPROCES.PRG:193 — CODIGO
- TERCE_LOT2 — REPROCES.PRG:252 — TDOCUM
- REPRO01 — REPROCES.PRG:344 — CODIGO
- CONIMP22 — CONINFOR.PRG:393 — TDOCUM

Destino: documentos — schema/04_movimientos.sql:85; documento_lineas — schema/04_movimientos.sql:116; saldos_cuenta — schema/05_saldos.sql:12

Campos físicos/código inventariados: `CODIGO`, `NIT`, `TFECHA`, `TCOMPR`, `TFASE`, `TIPODOC`, `TDOCUM`, `TDOCUM2`, `TDETALLE`, `TFECDOC`, `TVALOR`, `TVALORUS`, `TBASE`, `TIVA_RET`, `TSEC`, `TINCON`, `TCV`, `TABMNIT`, `TESTADO`, `TARCHI`, `TSUBCTA`, `TDATE`, `TTIME`, `TUSUA`, `NITN`, `BORRAR`, `TSALDO`, `TTRANSF`, `TSUBCOS`.

### MC&lt;lote&gt;

- CONCARG95 — MOVICON.prg:528 — CUENTA
- CONCARG92 — MOVICON.prg:627 — CUENTA
- CONCARG93 — MOVICON.prg:782 — CUENTA
- CONCARG94 — MOVICON.prg:888 — CUENTA
- MOVI11 — MOVICON.prg:3798 — TDOCUM

Destino: lotes — schema/04_movimientos.sql:12; lote_lineas — schema/04_movimientos.sql:45; documentos — schema/04_movimientos.sql:85; documento_lineas — schema/04_movimientos.sql:116

Campos físicos/código inventariados: `CUENTA`, `NIT`, `DEBITO`, `CREDITO`, `BASE`, `TFASE`, `CONCEPTO`, `TCOMPR`, `TIPODOC`, `TFECHA`, `TDOCUM`, `TINCON`, `TDOCUM2`, `NITN`.

### FADCLI

- ABREPPAL — VISDBF.PRG:39 — CCODIGO
- CLIENTER — CONTAGRAL.PRG:440 — CCODIGO
- NOMCENT — CONSULTA.PRG:636 — CNOMBRE
- PROCERE2 — CONTAGRAL.PRG:676 — CODIGO2
- PROCERE4 — CONTAGRAL.PRG:714 — CODIGO2

Destino: terceros — schema/03_maestros.sql:44; tercero_etiquetas — schema/03_maestros.sql:77

Campos físicos/código inventariados: `CCODIGO`, `CODIGO2`, `CDIGITO`, `CCODCIU`, `CNOMBRE`, `CNOM1`, `CNOM2`, `CAPE1`, `CAPE2`, `CDIREC`, `CCIUDAD`, `CTELEF`, `CZONA`, `CEMAIL`, `CPROPIETAR`, `CCUPO`, `CVENDED`, `CPLAZO`, `CTIPOCLI`, `CLISTA`, `CESTADO`, `CMOTIVO`, `CRETEN`, `CBLOQUE`, `CPROFESION`, `CDIROFI`, `CTELOFI`, `CCUMPLE`, `CCONYUGE`, `CPROFEC`, `CCUMPLEC`, `CDIROFIC`, `CTELOFIC`, `CTIPEMP`, `CTIPPAG`, `CPLAZO1`, `CDCTO1`, `CPLAZO2`, `CDCTO2`, `CPLAZO3`, `CDCTO3`, `CPLAZO4`, `CDCTO4`, `CPLAZO5`, `CDCTO5`, `CPLAZO6`, `CDCTO6`, `CMODIFI`, `CFACTU`, `CINVE`, `CCXP`, `CDCTOFAC`, `CCONDICION`, `CFCHCREA`, `CTIPDOC`, `CCODBE`, `CBENEFI`, `CDIASROT`, `CSOCIAL`, `CODICEN`, `BCOCTA`, `OPELOGIS`, `VLRLOGIS`, `PORLOGIS`, `DEBLOGIS`, `CSALDO`, `CNIT`, `CBANMAIL`, `CTCIFIN`, `CCARNET`, `CDIASMOR`, `CAUTMORA`, `CSEXO`, `CFCHMOD`, `CCELU`, `CDIRCORRES`, `DCTOC1`, `DCTOC2`, `DCTOC3`, `DIASC1`, `DIASC2`, `DIASC3`, `CACTIVI`, `CFCHACTI`, `NOVEDAD`, `CRETACTI`, `CEMAILFE`, `CEMAILFB`, `CPORRETI`, `CBASERETI`, `CMETCOMP`, `CFCHVIGMC`, `CPLAENTRE`, `CFRECUVIS`, `CDIASEM`, `CSEMA1`, `CSEMA2`, `CSEMA3`, `CSEMA4`, `CTIPCROSS`, `CINIAGEN`, `CFRECUVIS2`, `CLAT`, `CLON`.

### FADCTAS

- ADMCUENTA — CONTAGRAL.PRG:3077 — CODBANCO
- GRABACUENTA — CONTAGRAL.PRG:3112 — CODCLI

Destino: 

Campos físicos/código inventariados: `CODCLI`, `CODBANCO`, `NOMBANCO`, `TIPOBANCO`, `NCTABANCO`, `OBSERBANCO`, `BANPPAL`.

### VISTDOC

- VERNOM — CONTAGRAL.PRG:982 — NOMBRE
- TDOCOK — CONTAGRAL.PRG:4016 — NOMBRE
- INFOR153X — CONINFOR.PRG:19491 — NOMBRE

Destino: 

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `SALE`.

### CIUDAD

- CIUOK — CONTAGRAL.PRG:3985 — NOMBRE
- CIUDAD — FACTAB.PRG:271 — CODIGO

Destino: 

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `SALE`.

### ACTIVIDA

- TRAB_CLI2 — CONTAGRAL.PRG:2678 — NOMBRE
- ACTIOK — CONTAGRAL.PRG:3961 — RETCREE
- CIUDAD — FACTAB.PRG:271 — CODIGO

Destino: 

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `SALE`, `RETCREE`.

### CONCECOS

- NOMCENT — CONSULTA.PRG:630 — NOMBRE
- CCOSTOS — DSITAB.PRG:1112 — CODIGO
- ODLG_INIT1 — DSITAB.PRG:1154 — CODIGO
- CCOSTO1 — DSITAB.PRG:1235 — CODIGO
- VER_DETACON — CONSULTA.PRG:1955 — NOMBRE

Destino: centros_costos — schema/03_maestros.sql:87

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `HIST`, `VALOR`, `PORCEN`, `VLRPOR`, `CODITEM`, `CUENTA`, `CONCEPTO`, `CARPETA`, `TIPO`, `HABILITA`.

### COCENTRO

- CCTANIVEL2 — CONSULTA.PRG:55 — CODIGO
- CONSULCO2A — CONSULTA.PRG:655 — CODIGO
- INCLU_CC — CONINFOR.PRG:2273 — CODIGO
- CONSUL_7 — CONSULTA.PRG:2807 — CENTRO
- ACTUCOS — MOVICON.prg:3132 — CODIGO

Destino: documento_lineas — schema/04_movimientos.sql:116; saldos_cuenta_tercero — schema/05_saldos.sql:30; saldos_cuenta_centro — schema/05_saldos.sql:45; acumulados_tercero — schema/05_saldos.sql:60; acumulados_centro — schema/05_saldos.sql:74

Campos físicos/código inventariados: `CODIGO`, `NIT`, `CENTRO`, `DEB00`, `CRE00`, `DEB01`, `CRE01`, `DEB02`, `CRE02`, `DEB03`, `CRE03`, `DEB04`, `CRE04`, `DEB05`, `CRE05`, `DEB06`, `CRE06`, `DEB07`, `CRE07`, `DEB08`, `CRE08`, `DEB09`, `CRE09`, `DEB10`, `CRE10`, `DEB11`, `CRE11`, `DEB12`, `CRE12`, `DEB13`, `CRE13`, `DEB14`, `CRE14`, `DEB15`, `CRE15`, `DEB16`, `CRE16`, `DEB17`, `CRE17`, `DEB18`, `CRE18`.

### CONMCOS

- INFOR9L — CONINFOR.PRG:22036 — COSTOI

Destino: documento_lineas — schema/04_movimientos.sql:116; saldos_cuenta_tercero — schema/05_saldos.sql:30; saldos_cuenta_centro — schema/05_saldos.sql:45; acumulados_tercero — schema/05_saldos.sql:60; acumulados_centro — schema/05_saldos.sql:74

Campos físicos/código inventariados: `CODIGO`, `NIT`, `MNOMBRE`, `MSALDO`, `MACMDEB01`, `MACMCRE01`, `MACMDEB02`, `MACMCRE02`, `MACMDEB03`, `MACMCRE03`, `MACMCRE04`, `MACMDEB04`, `MACMDEB05`, `MACMCRE05`, `MACMDEB06`, `MACMCRE06`, `MACMDEB07`, `MACMCRE07`, `MACMDEB08`, `MACMCRE08`, `MACMDEB09`, `MACMCRE09`, `MACMDEB10`, `MACMCRE10`, `MACMDEB11`, `MACMCRE11`, `MACMCRE12`, `MACMDEB12`, `MACMCRE13`, `MACMDEB13`, `MACMCRE14`, `MACMDEB14`, `MACMCRE15`, `MACMDEB15`, `MACMCRE16`, `MACMDEB16`, `MACMCRE17`, `MACMDEB17`, `MACMCRE18`, `MACMDEB18`, `MAJUSTE`, `MCOSTOS`, `MDISTRICC`, `MCTAPAGOS`, `MIVA_RET`, `PORIVARET`, `MTC`, `MCMOVI`, `SALE`, `GENERAL`, `MAPLICAR`, `MBASER`, `NITN`, `FORMATO`, `CONCEPTO`, `TIPOMED`, `VALMED`, `RENGLON`, `SUMARES`, `COSTOI`, `COSTOF`.

### CONTCOS

- INFOR9L — CONINFOR.PRG:22036 — COSTOI

Destino: documento_lineas — schema/04_movimientos.sql:116; saldos_cuenta_tercero — schema/05_saldos.sql:30; saldos_cuenta_centro — schema/05_saldos.sql:45; acumulados_tercero — schema/05_saldos.sql:60; acumulados_centro — schema/05_saldos.sql:74

Campos físicos/código inventariados: `CODIGO`, `NIT`, `TFASE`, `MNOMBRE`, `NNOMBRE`, `TNOMBRE`, `MSALDO`, `MACMDEB01`, `MACMCRE01`, `MACMDEB02`, `MACMCRE02`, `MACMDEB03`, `MACMCRE03`, `MACMCRE04`, `MACMDEB04`, `MACMDEB05`, `MACMCRE05`, `MACMDEB06`, `MACMCRE06`, `MACMDEB07`, `MACMCRE07`, `MACMDEB08`, `MACMCRE08`, `MACMDEB09`, `MACMCRE09`, `MACMDEB10`, `MACMCRE10`, `MACMDEB11`, `MACMCRE11`, `MACMCRE12`, `MACMDEB12`, `MACMCRE13`, `MACMDEB13`, `MACMCRE14`, `MACMDEB14`, `MACMCRE15`, `MACMDEB15`, `MACMCRE16`, `MACMDEB16`, `MACMCRE17`, `MACMDEB17`, `MACMCRE18`, `MACMDEB18`, `MAJUSTE`, `MCOSTOS`, `MDISTRICC`, `MCTAPAGOS`, `MIVA_RET`, `PORIVARET`, `MTC`, `MCMOVI`, `SALE`, `GENERAL`, `MAPLICAR`, `MBASER`, `NITN`, `FORMATO`, `CONCEPTO`, `TIPOMED`, `VALMED`, `RENGLON`, `SUMARES`, `COSTOI`, `COSTOF`.

### CONMAE2

- INFOR09CX — CONINFOR.PRG:21228 — CODIGO
- INFORCIP — DSITAB.PRG:6947 — DBDELETE

Destino: 

Campos físicos/código inventariados: `CODIGO`, `MNOMBRE`, `SALE`, `USUARIO`, `MCOSTOS`.

### CONCECO2

- INFOR09CX — CONINFOR.PRG:21218 — CODIGO
- INFORTAB — DSITAB.PRG:6764 — DBDELETE

Destino: 

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `HIST`, `USUARIO`.

### CONTERCE

- INFOR07T — CONINFOR.PRG:6592 — CODIGO
- LIMACUMB — CONINFOR.PRG:6049 — DBDELETE
- INFOR71B — CONINFOR.PRG:5298 — UPDATE CONTERCE
- LIMACUM — CONINFOR.PRG:5934 — FROM CONTERCE

Destino: documento_lineas — schema/04_movimientos.sql:116; saldos_cuenta_tercero — schema/05_saldos.sql:30; saldos_cuenta_centro — schema/05_saldos.sql:45; acumulados_tercero — schema/05_saldos.sql:60; acumulados_centro — schema/05_saldos.sql:74

Campos físicos/código inventariados: `CODIGO`, `NIT`, `DEB00`, `CRE00`, `DEB01`, `CRE01`, `DEB02`, `CRE02`, `DEB03`, `CRE03`, `DEB04`, `CRE04`, `DEB05`, `CRE05`, `DEB06`, `CRE06`, `DEB07`, `CRE07`, `DEB08`, `CRE08`, `DEB09`, `CRE09`, `DEB10`, `CRE10`, `DEB11`, `CRE11`, `DEB12`, `CRE12`, `DEB13`, `CRE13`, `DEB14`, `CRE14`, `DEB15`, `CRE15`, `DEB16`, `CRE16`, `DEB17`, `CRE17`, `DEB18`, `CRE18`, `CENTRO`.

### CONINF1

- INFORM1 — CONINFOR.PRG:601 — NIVEL
- INFORM21 — CONINFOR.PRG:798 — NIVEL

Destino: 

Campos físicos/código inventariados: `NIVEL`, `CUENTA`, `NOMBRE`, `TIPO`, `PPTO`, `VLRBASE`.

### CONRET

- INFOR15 — CONINFOR.PRG:6901 — CODIGO
- RETCTA2 — CONINFOR.PRG:18662 — NIT
- INFOR153 — CONINFOR.PRG:18937 — CODIGO
- LIMACUMB — CONINFOR.PRG:5998 — DBDELETE
- LIMACUM — CONINFOR.PRG:5925 — FROM CONRET

Destino: acumulados_retencion — schema/05_saldos.sql:88

Campos físicos/código inventariados: `CODIGO`, `NIT`, `BASE01`, `VALOR01`, `BASE01C`, `VALOR01C`, `BASE02`, `VALOR02`, `BASE02C`, `VALOR02C`, `BASE03`, `VALOR03`, `BASE03C`, `VALOR03C`, `BASE04`, `VALOR04`, `BASE04C`, `VALOR04C`, `BASE05`, `VALOR05`, `BASE05C`, `VALOR05C`, `BASE06`, `VALOR06`, `BASE06C`, `VALOR06C`, `BASE07`, `VALOR07`, `BASE07C`, `VALOR07C`, `BASE08`, `VALOR08`, `BASE08C`, `VALOR08C`, `BASE09`, `VALOR09`, `BASE09C`, `VALOR09C`, `BASE10`, `VALOR10`, `BASE10C`, `VALOR10C`, `BASE11`, `VALOR11`, `BASE11C`, `VALOR11C`, `BASE12`, `VALOR12`, `BASE12C`, `VALOR12C`, `CTABASE`, `BASCO01`, `BASCO01C`, `BASCO02`, `BASCO02C`, `BASCO03`, `BASCO03C`, `BASCO04`, `BASCO04C`, `BASCO05`, `BASCO05C`, `BASCO06`, `BASCO06C`, `BASCO07`, `BASCO07C`, `BASCO08`, `BASCO08C`, `BASCO09`, `BASCO09C`, `BASCO10`, `BASCO10C`, `BASCO11`, `BASCO11C`, `BASCO12`, `BASCO12C`, `CTR`.

### CONIVA

- INFOR15 — CONINFOR.PRG:6901 — CODIGO
- RETCTA2 — CONINFOR.PRG:18662 — NIT
- INFOR153 — CONINFOR.PRG:18937 — CODIGO
- LIMACUMB — CONINFOR.PRG:6015 — DBDELETE
- LIMACUM — CONINFOR.PRG:5928 — FROM CONIVA

Destino: acumulados_iva — schema/05_saldos.sql:104

Campos físicos/código inventariados: `CODIGO`, `NIT`, `TDOCUM`, `TFECHA`, `TBASE`, `TVALOR`, `TBASEC`, `TVALORC`, `NOMBREC`, `NOMBREN`, `COIMP`.

### CONTIRET

- RETES — DSITAB.PRG:1766 — CODIGO
- ODLG_INIT5 — DSITAB.PRG:1782 — CODIGO
- RETES1 — DSITAB.PRG:1799 — CODIGO
- SACABASE — MOVICON.prg:1592 — VLRPOR
- BASEOK2 — MOVICON.prg:1924 — VLRPOR

Destino: conceptos_retencion — schema/03_maestros.sql:157

Campos físicos/código inventariados: `TIPO`, `CODIGO`, `NOMBRE`, `VLRPOR`, `HIST`.

### CONTIIVA

- IVAS — DSITAB.PRG:1849 — CODIGO
- ODLG_INIT6 — DSITAB.PRG:1866 — CODIGO
- IVA1 — DSITAB.PRG:1883 — CODIGO
- SACABASE — MOVICON.prg:1585 — VLRPOR
- BASEOK2 — MOVICON.prg:1911 — VLRPOR

Destino: tarifas_iva — schema/03_maestros.sql:174

Campos físicos/código inventariados: `TIPO`, `CODIGO`, `NOMBRE`, `VLRPOR`, `HIST`.

### CONRTER

- INFORT1 — DSITAB.PRG:7129 — CODIGO
- INFORT1A — DSITAB.PRG:7179 — DEBITOS
- INFTER4 — DSITAB.PRG:7280 — CODIGO
- INFTER1 — DSITAB.PRG:7404 — CODIGO
- AURES21 — DSITAB.PRG:7580 — CODIGO

Destino: cuentas — schema/03_maestros.sql:12; acumulados_tercero — schema/05_saldos.sql:60

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `DEBITOS`, `CREDITOS`, `MARCA`.

### CONDECLA

- RENGLONES — DSITAB.PRG:1656 — CODIGO
- ODLG_INIT3 — DSITAB.PRG:1673 — CODIGO
- RENGLON1 — DSITAB.PRG:1694 — CODIGO
- DSIGRABA4 — DSITAB.PRG:1725 — CODIGO

Destino: renglones_renta — schema/03_maestros.sql:193

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `FORMULA`, `CONCEPTO`.

### CONAJUS

- AJUS02G — DSITAB.PRG:5959 — CUENTA

Destino: 

Campos físicos/código inventariados: `CUENTA`, `NOMBRE`, `AJUSTE`, `CAJUSTE`, `AJLLA`, `AJNOM`, `AJCOD`.

### CONMAG1

- DETALLE1N — DSITAB.PRG:7861 — NOMFORMA
- DETALLE2N — DSITAB.PRG:8032 — NOMFORMA
- MEDMAG01 — DSITAB.PRG:2796 — CODFORMA

Destino: formatos_exogenos — schema/06_impuestos.sql:11

Campos físicos/código inventariados: `CODFORMA`, `NOMFORMA`, `ELEMENTO`, `CONCEPTO`, `TIPODOC`, `NIT`, `DIGITO`, `NOMBRE`, `DIRECCION`, `MUNICIPIO`, `VALOR1`, `VALOR2`, `PAIS`, `COMBO1`, `COMBO2`, `COMBO3`, `COMBO4`, `COMBO5`, `COMBO6`, `COMBO7`.

### CONMAG2

- MEDMAG02 — DSITAB.PRG:2984 — CONCEPTO
- MEDMAG21 — DSITAB.PRG:3123 — CONCEPTO
- GRACONCEP — DSITAB.PRG:3200 — FORMATO
- DETALLE1N — DSITAB.PRG:7850 — NOMCONCEP
- DETALLE2N — DSITAB.PRG:8021 — NOMCONCEP

Destino: formato_conceptos — schema/06_impuestos.sql:30; medio_topes — schema/06_impuestos.sql:84

Campos físicos/código inventariados: `FORMATO`, `CONCEPTO`, `NOMCONCEP`, `MONTO`, `VALOR1`, `VALOR2`, `COMBO1`, `COMBO2`, `COMBO3`, `COMBO4`, `COMBO5`, `COMBO6`, `COMBO7`.

### CONMAG3

- MEDMAG03 — DSITAB.PRG:3266 — FORMATO
- MEDMAG31PEG — DSITAB.PRG:3316 — CUENTA
- MEDMAG31A — DSITAB.PRG:3384 — FORMATO
- MEDMAG31AG — DSITAB.PRG:3469 — CUENTA
- MEDMAG42NN — DSITAB.PRG:3697 — TIPOMED

Destino: formato_asignaciones — schema/06_impuestos.sql:42; formato_conceptos — schema/06_impuestos.sql:30

Campos físicos/código inventariados: `CUENTA`, `FORMATO`, `CONCEPTO`, `TIPO`, `CUENTA2`, `TIPOMED`, `MODCXP`, `COLVALOR`, `COLBASE`, `PMED1`, `PMED2`, `PMED3`, `PMED4`, `PMED5`, `PMED6`, `FORMATO2`, `CONCEPTO2`, `MOVTIPO`, `COLUMNA2`, `DOCX`, `NATURAL`, `DOCX2`, `DOCX3`.

### CONMAGIT

- DETAMAG — DSITAB.PRG:4568 — CODIGO
- DETALLE1 — DSITAB.PRG:4677 — CODIGO
- DETALLE2 — DSITAB.PRG:4746 — CODIGO
- MEDMAG06 — DSITAB.PRG:7611 — FORMATO
- DETALLE1N — DSITAB.PRG:7744 — FORMATO

Destino: 

Campos físicos/código inventariados: `CODIGO`, `FORMATO`, `CONCEPTO`, `NIT`, `TFECHA`, `TCOMPR`, `TFASE`, `TIPODOC`, `TDOCUM`, `TDOCUM2`, `TDETALLE`, `TFECDOC`, `TVALOR`, `TVALORUS`, `TBASE`, `TIVA_RET`, `TINCON`.

### CONMAGDT

- MEDMAG05 — DSITAB.PRG:4285 — CONCEPTO
- GENERAID — DSITAB.PRG:4335 — FORMATO
- MEDMAG08 — DSITAB.PRG:4399 — CONCEPTO
- NITOKR — DSITAB.PRG:4457 — VALOR1
- AYUDAFOR — DSITAB.PRG:4502 — VALOR1

Destino: generaciones_medios — schema/06_impuestos.sql:53; medio_filas — schema/06_impuestos.sql:68; medio_conciliaciones — schema/06_impuestos.sql:97

Campos físicos/código inventariados: `FORMATO`, `CONCEPTO`, `CUENTA`, `TERCERO`, `VALOR1`, `VALOR2`, `DIGITO`, `SALE`, `VALOR3`, `VALOR4`, `VALOR5`, `VALOR6`, `VALOR7`, `VALOR8`, `VALOR9`, `VALOR10`, `VALOR11`, `TERCERO2`, `MODCXP`, `COLBASE`, `COLIVA`.

### CONGENF

- FADGENF — FACTAB.PRG:723 — CODIGO
- CON123 — CONINFOR.PRG:1121 — TAMANO
- FORMATO — CONTABDSI.PRG:1275 — AUTORIZA
- CONSIFOR — CONTABDSI.PRG:2376 — CODIGO

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `AMBIENTE`, `INICIAL`, `TAMANO`, `LIMITES`, `LIMITEI`, `CONFIGURA`, `TOTALIZA`, `SALE`, `AUTORIZA`, `FPREVIEW`.

### CONFORMA

- GRAVAFOR — FACTAB.PRG:879 — CODIGO
- FADGENF2 — FACTAB.PRG:980 — NOMBRE
- CON123 — CONINFOR.PRG:1184 — CODIGO
- CON123I — CONINFOR.PRG:1305 — CODIGO

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `ARCHI`, `CAMPO`, `NOMBRE`, `LONGITUD`, `TIPO`, `IMP`, `TAMANO`, `FORMATO`, `INICIAL`, `FINAL`, `FILA`, `COLUMNA`, `FILA2`, `COLUMNA2`, `LEYENDA`, `FUENTE`, `TIPOFTE`.

### CONFACTU

- GRAVAFOR — FACTAB.PRG:880 — ARCHI

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `ARCHI`, `CAMPO`, `NOMBRE`, `LONGITUD`, `TIPO`, `IMP`, `TAMANO`, `FORMATO`, `INICIAL`, `FINAL`, `FILA`, `COLUMNA`, `LEYENDA`.

### INFORMES

- GENINFT — CONINFOR.PRG:565 — C01

Destino: 

Campos físicos/código inventariados: `CODIGO`, `C01`, `T01`, `B01`, `C02`, `T02`, `B02`, `C03`, `T03`, `B03`, `C04`, `T04`, `B04`, `C05`, `T05`, `B05`, `LIN`.

### POSINFOR

- CCTANIVEL — CONSULTA.PRG:9 — COPY STRUC crea TEMC&lt;usuario&gt; para acumular la consulta

Destino: 

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `VAL1`, `VAL2`, `VAL3`, `VAL4`, `VAL5`, `VAL6`, `VAL7`, `VAL8`, `VAL9`, `CHR1`, `CHR2`, `CHR3`, `CHR4`, `CHR5`, `CHR6`, `NIVEL`, `TIPO`, `NOMBRE2`, `MOTIVO`, `VAL10`.

### XADPDF

- CARGA_PORTAL2 — CONINFOR.PRG:8507 — NOMBRE
- CARGA_PORTAL3 — CONINFOR.PRG:8602 — CODIGO
- INFOR16I_PDF — CONINFOR.PRG:8834 — CODIGO
- BORRA_PORTAL — CONINFOR.PRG:8534 — DBDELETE

Destino: 

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `FECHA`, `DESCRIP`.

### AFIART

- AFISALDO — DSITAB.PRG:496 — AJA00
- INFACT2 — CONINFOR.PRG:20945 — AFICOD
- INFORACT — DSITAB.PRG:6432 — DBDELETE

Destino: 

Campos físicos/código inventariados: `AFICOD`, `AFIDES`, `AFIFCHI`, `AFIFACT`, `AFIANOS`, `AFICOSTO`, `AFINIT`, `TASA00`, `AJA00`, `DEP00`, `AJD00`, `TASA01`, `AJA01`, `DEP01`, `AJD01`, `TASA02`, `AJA02`, `DEP02`, `AJD02`, `TASA03`, `AJA03`, `DEP03`, `AJD03`, `TASA04`, `AJA04`, `DEP04`, `AJD04`, `TASA05`, `AJA05`, `DEP05`, `AJD05`, `TASA06`, `AJA06`, `DEP06`, `AJD06`, `TASA07`, `AJA07`, `DEP07`, `AJD07`, `TASA08`, `AJA08`, `DEP08`, `AJD08`, `TASA09`, `AJA09`, `DEP09`, `AJD09`, `TASA10`, `AJA10`, `DEP10`, `AJD10`, `TASA11`, `AJA11`, `DEP11`, `AJD11`, `TASA12`, `AJA12`, `DEP12`, `AJD12`, `BAJA`, `AJUSTA`.

### AFITAB

- CONSULFS — DSITAB.PRG:973 — CODIGO
- INFACT2 — CONINFOR.PRG:20951 — NOMBRE
- INTEACT3 — DSITAB.PRG:357 — DBSEEK
- ACTIGRA — DSITAB.PRG:852 — DBSEEK
- AYUDEP — DSITAB.PRG:900 — DBSEEK

Destino: 

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `DEBAJA`, `CREAJA`, `DEBDEP`, `CREDEP`, `DEBAJD`, `CREAJD`, `CCOSTO`.

### AFITAB2

- INTEACT3 — DSITAB.PRG:389 — PORCE y CENTRO; cAliTAB2 := cAFITAB2 en INTEACT2:256

Destino: 

Campos físicos/código inventariados: `CODIGO`, `CENTRO`, `PORCE`, `VALOR`.

### AMORART

- INTEACT3 — DSITAB.PRG:420 — AMOCOD, AMONIT y acumulados; cAliART := cAMORART en INTEACT2:259
- INFORAMO — DSITAB.PRG:6589 — DBDELETE

Destino: 

Campos físicos/código inventariados: `AMOCOD`, `AMODES`, `AMOFCHI`, `AMOFACT`, `AMOANOS`, `AMOCOSTO`, `AMONIT`, `TASA00`, `AJA00`, `AMOR00`, `AJM00`, `TASA01`, `AJA01`, `AMOR01`, `AJM01`, `TASA02`, `AJA02`, `AMOR02`, `AJM02`, `TASA03`, `AJA03`, `AMOR03`, `AJM03`, `TASA04`, `AJA04`, `AMOR04`, `AJM04`, `TASA05`, `AJA05`, `AMOR05`, `AJM05`, `TASA06`, `AJA06`, `AMOR06`, `AJM06`, `TASA07`, `AJA07`, `AMOR07`, `AJM07`, `TASA08`, `AJA08`, `AMOR08`, `AJM08`, `TASA09`, `AJA09`, `AMOR09`, `AJM09`, `TASA10`, `AJA10`, `AMOR10`, `AJM10`, `TASA11`, `AJA11`, `AMOR11`, `AJM11`, `TASA12`, `AJA12`, `AMOR12`, `AJM12`, `BAJA`, `AJUSTA`.

### AMORTAB

- CONSULFS — DSITAB.PRG:973 — CODIGO
- INFACT2 — CONINFOR.PRG:20951 — NOMBRE
- ACTIGRA — DSITAB.PRG:864 — DBSEEK
- AYUDEP — DSITAB.PRG:900 — DBSEEK
- AYUSEC — DSITAB.PRG:951 — DBSEEK

Destino: 

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `DEBAJA`, `CREAJA`, `DEBDEP`, `CREDEP`, `DEBAJD`, `CREAJD`, `CCOSTO`.

### AMORTAB2

- INTEACT3 — DSITAB.PRG:466 — PORCE y CENTRO; cAliTAB2 := cAMORTAB2 en INTEACT2:261

Destino: 

Campos físicos/código inventariados: `CODIGO`, `CENTRO`, `PORCE`, `VALOR`.

### CONSOLID

- CCOSTOS — DSITAB.PRG:1135 — CODIGO
- ODLG_INIT2 — DSITAB.PRG:1166 — CODIGO
- CONS002 — REPROCES.PRG:6321 — CODIGO
- CONSOL12 — DSITAB.PRG:1286 — DBSEEK

Destino: consolidaciones — schema/07_procesos.sql:69; consolidacion_origenes — schema/07_procesos.sql:88

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `HIST`, `VALOR`.

### CONREMAE

- ACTU_LOTRE — MOVICON.prg:7389 — RMACTU
- GRABAREEM — MOVICON.prg:7693 — RMLOTE
- CONTAB_REEM — MOVICON.prg:7872 — RMACTU

Destino: 

Campos físicos/código inventariados: `RMLOTE`, `RMCODCON`, `RMFECHA`, `RMVLRTOT`, `RMCONCEP`, `RMTDOCUM`, `RMTCOMPR`, `RMACTU`.

### CONREITE

- REEMBOL01 — MOVICON.prg:7345 — RIDETALLE

Destino: 

Campos físicos/código inventariados: `RILOTE`, `RITERCE`, `RIFECHA`, `RIDETALLE`, `RIVALOR`, `RICCOSTO`, `RICCOSCRU`.

### VISUSU

- EXPORMES2B — REPROCES.PRG:8100 — INOMBRE
- USUOK7 — MOVICON.prg:5505 — DBSEEK

Destino: usuarios — schema/08_seguridad.sql:37; roles — schema/08_seguridad.sql:11; permisos — schema/08_seguridad.sql:21; rol_permisos — schema/08_seguridad.sql:28

Campos físicos/código inventariados: `IINICIAL`, `INOMBRE`, `IPASSWORD`, `ICEDULA`, `IDIREC`, `ITELEF`, `IREMOTO`, `ICADUCA`, `IFECHAC`, `IMETCOMP`, `IFCHVIGMC`.

### VISAUDI

- AUDIVIS — CONTABDSI.PRG:1567 — USUARIO
- EXPORMES2B — REPROCES.PRG:8093 — USUARIO

Destino: auditoria — schema/08_seguridad.sql:56

Campos físicos/código inventariados: `USUARIO`, `HORA`, `MODULO`, `DOCUMENTO`, `MOTIVO`, `TIPO`, `FECHA`.

### CONOPER

- USUARIOS — DSITAB.PRG:2716 — IINICIAL
- USUA1 — DSITAB.PRG:2741 — IINICIAL
- DSIGRABA8 — DSITAB.PRG:2767 — IINICIAL

Destino: usuarios — schema/08_seguridad.sql:37; roles — schema/08_seguridad.sql:11; permisos — schema/08_seguridad.sql:21; rol_permisos — schema/08_seguridad.sql:28

Campos físicos/código inventariados: `IINICIAL`, `INOMBRE`, `IPASSWORD`, `IVENCE`.

### TIDPRESU

- PRESU1 — CONPRESU.PRG:17 — CODIGO
- CONSULPRE — CONPRESU.PRG:205 — CODIGO
- GRABAPRESU — CONPRESU.PRG:248 — CODIGO
- AYUCCP — CONPRESU.PRG:102 — DBSEEK
- AYUTAP — CONPRESU.PRG:132 — DBSEEK

Destino: presupuestos — schema/09_presupuesto.sql:8; presupuesto_rubros — schema/09_presupuesto.sql:23; presupuesto_valores — schema/09_presupuesto.sql:35

Campos físicos/código inventariados: `CODIGO`, `CCOSTO`, `MOV00`, `MOV01`, `MOV02`, `MOV03`, `MOV04`, `MOV05`, `MOV06`, `MOV07`, `MOV08`, `MOV09`, `MOV10`, `MOV11`, `MOV12`, `MOV13`, `PRE00`, `PRE01`, `PRE02`, `PRE03`, `PRE04`, `PRE05`, `PRE06`, `PRE07`, `PRE08`, `PRE09`, `PRE10`, `PRE11`, `PRE12`, `PRE13`, `CONCEPTO`.

### CADEMP

- LISTER4 — CONTAGRAL.PRG:1809 — NOMBRE
- TRAB_CLI2 — CONTAGRAL.PRG:2724 — NOMBRE
- TEMPOK — CONTAGRAL.PRG:3270 — NOMBRE

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `SALE`.

### CADFACTU

- GRAVAFOR — FACTAB.PRG:880 — ARCHI

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `ARCHI`, `CAMPO`, `NOMBRE`, `LONGITUD`, `TIPO`, `IMP`, `TAMANO`, `FORMATO`, `INICIAL`, `FINAL`, `FILA`, `COLUMNA`, `LEYENDA`.

### CADFORMA

- GRAVAFOR — FACTAB.PRG:879 — CODIGO
- FADGENF2 — FACTAB.PRG:980 — NOMBRE

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `ARCHI`, `CAMPO`, `NOMBRE`, `LONGITUD`, `TIPO`, `IMP`, `TAMANO`, `FORMATO`, `INICIAL`, `FINAL`, `FILA`, `COLUMNA`, `FILA2`, `COLUMNA2`, `LEYENDA`, `FUENTE`, `TIPOFTE`.

### CADGENF

- FADGENF — FACTAB.PRG:723 — CODIGO
- FORMATO — CONTABDSI.PRG:1275 — AUTORIZA
- CONSIFOR — CONTABDSI.PRG:2376 — CODIGO

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `AMBIENTE`, `INICIAL`, `TAMANO`, `LIMITES`, `LIMITEI`, `CONFIGURA`, `SALE`, `MONEDA`, `COLA`, `CTAS`, `IMPRESORA`, `PREVISUAL`, `SERVICIO`, `AUTORIZA`, `FPREVIEW`.

### CADMAE

- CADTOT — CONTAGRAL.PRG:408 — CCODIGO

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CCODIGO`, `CENTRY`, `CFACTURA`, `CNOMBRE`, `CFECFAC`, `CVLRBRU`, `CVLRDES`, `CVLRFAC`, `CFECVEN`, `CFECPAGO`, `CRECCAJA`, `SALDO00`, `DEB00`, `CRE00`, `DEB01`, `CRE01`, `DEB02`, `CRE02`, `DEB03`, `CRE03`, `DEB04`, `CRE04`, `DEB05`, `CRE05`, `DEB06`, `CRE06`, `DEB07`, `CRE07`, `DEB08`, `CRE08`, `DEB09`, `CRE09`, `DEB10`, `CRE10`, `DEB11`, `CRE11`, `DEB12`, `CRE12`, `CVENDED`, `CFACTUR`, `CCHEQUE`, `CCONTA`, `CTSALE`, `SALE`, `CCHECK2`, `GENERAL`, `BASECOMI`, `COMIPAGA`, `COMI01`, `COMI02`, `COMI03`, `COMI04`, `CCUOTA`, `SALDO`, `MARCA`, `CEDAD`, `CZONA`, `CSUCURSAL`, `CVENDE2`, `NEWFIELD`.

### CAUFACTU

- GRAVAFOR — FACTAB.PRG:880 — ARCHI

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `ARCHI`, `CAMPO`, `NOMBRE`, `LONGITUD`, `TIPO`, `IMP`, `TAMANO`, `FORMATO`, `INICIAL`, `FINAL`, `FILA`, `COLUMNA`, `LEYENDA`.

### CAUFORMA

- GRAVAFOR — FACTAB.PRG:879 — CODIGO
- FADGENF2 — FACTAB.PRG:980 — NOMBRE

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `ARCHI`, `CAMPO`, `NOMBRE`, `LONGITUD`, `TIPO`, `IMP`, `TAMANO`, `FORMATO`, `INICIAL`, `FINAL`, `FILA`, `COLUMNA`, `FILA2`, `COLUMNA2`, `LEYENDA`, `FUENTE`, `TIPOFTE`.

### CAUGENF

- FADGENF — FACTAB.PRG:723 — CODIGO
- FORMATO — CONTABDSI.PRG:1275 — AUTORIZA
- CONSIFOR — CONTABDSI.PRG:2376 — CODIGO

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `AMBIENTE`, `INICIAL`, `TAMANO`, `LIMITES`, `LIMITEI`, `CONFIGURA`, `MONEDA`, `DIVA`, `COLA`, `SALE`, `DCTOS`, `COLA2`, `PUERTO2`, `AUTORIZA`, `FPREVIEW`, `LIMITES2`.

### COMFACTU

- GRAVAFOR — FACTAB.PRG:880 — ARCHI

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `ARCHI`, `CAMPO`, `NOMBRE`, `LONGITUD`, `TIPO`, `IMP`, `TAMANO`, `FORMATO`, `INICIAL`, `FINAL`, `FILA`, `COLUMNA`, `LEYENDA`.

### COMFORMA

- GRAVAFOR — FACTAB.PRG:879 — CODIGO
- FADGENF2 — FACTAB.PRG:980 — NOMBRE

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `ARCHI`, `CAMPO`, `NOMBRE`, `LONGITUD`, `TIPO`, `IMP`, `TAMANO`, `FORMATO`, `INICIAL`, `FINAL`, `FILA`, `COLUMNA`, `FILA2`, `COLUMNA2`, `LEYENDA`, `FUENTE`, `TIPOFTE`.

### COMGENF

- FADGENF — FACTAB.PRG:723 — CODIGO
- CONSIFOR — CONTABDSI.PRG:2376 — CODIGO

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `AMBIENTE`, `INICIAL`, `TAMANO`, `LIMITES`, `LIMITEI`, `CONFIGURA`, `MONEDA`, `DIVA`, `COLA`, `SALE`, `DCTOS`, `COLA2`, `PUERTO2`, `AUTORIZA`, `FPREVIEW`.

### EVENTOS

- EVENTOS — FACTAB.PRG:153 — CTABCOD
- TRAB_EVEN — FACTAB.PRG:188 — CTABCOD
- DSIGRABAE — FACTAB.PRG:211 — CTABCOD
- BORRAEVEN — FACTAB.PRG:171 — DBDELETE

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CTABCOD`, `CTABDES`, `CTPESO`, `CTCOSTO`.

### FADCON

- CLIENTES — CONTAGRAL.PRG:802 — CTMAXCART
- BLO_GRAL — CONTAGRAL.PRG:916 — CTDIASMORA
- DIMORA — CONTAGRAL.PRG:3154 — CTDIASMORA

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CTTALLER`, `CTCOLAS`, `CTIMPMUL`, `CTIMPDIR`, `CTFACPED`, `CTCLIENTE`, `CTBODEGAF`, `CTFLETES`, `CTCONTAB`, `CTINTERFA`, `CTDEFINE`, `CTPLAZOF`, `CTNIVELI`, `CTALTERNA`, `CTRETEN`, `CTRETVTA`, `CTRBASEV`, `CTRETIVA`, `CTRBASEI`, `CTNFISCAL`, `CTVENCEF`, `CTCAJON`, `CTCONSEC`, `CTTIPOCON`, `CTFORMATO`, `CTPREFIJO`, `CTULTFAC`, `CTULTDEV`, `CTAVANCE`, `CTDESCRIP`, `CTCAPTURA`, `CTIVAIN`, `CTMODIDES`, `CTCOSTO`, `CTREPETI`, `CTPARCIAL`, `CTNITEM`, `CTDCTOS`, `CTCOMISION`, `CTCRECAUDO`, `CTANALCOMI`, `CTDIASMORA`, `CTTOPEMORA`, `CTULTCRUCE`, `CTOBSERRC`, `CTAUTOMORO`, `CTCODPAG`, `CTOBSERCTA`, `CTULTCRE`, `PREFICRE`, `CTULTCON`, `PREFICON`, `CTSER1`, `CTMODIVA`, `CTASALPED`, `CTFECIPED`, `CTACARPED`, `CTULTPED`, `CTFORPED`, `CTASALCOT`, `CTFECICOT`, `CTACARCOT`, `CTULTCOT`, `CTFORCOT`, `CTDECIMAL`, `CTMINIMO`, `CTBODEGA`, `CTPLANO`, `CTINVPROD`, `ENTPROD`, `SALPROD`, `CRUCEDEB`, `CRUCECRE`, `CTANACAR`, `CTMAQUINA`, `CTMAXCART`, `CTANAIMP`, `CTOBSERCA`, `CTTALLERIT`, `CTRETICA`, `CTRBASEC`, `CTCCCONT`, `CTMODFCH`, `CTRETCREE`, `CTREVALC`, `CTREVALX`, `CTREVALT`, `CTREVALI`, `CTUSUC`, `CTUSUX`, `CTUSUT`, `CTUSUI`, `CTAUTORET`, `CTCOSTOPI`, `CTCEROSFA`, `CTNIIF01`, `CTNIIF02`, `CTNIIF03`, `CTNIIF04`, `CTNIIF05`, `CTNIIF01K`, `CTNIIF02K`, `CTNIIF03K`, `CTNIIF04K`, `CTNIIF05K`, `CTNIIFDEB`, `CTNIIFCRE`, `CTNIIFBAJO`, `CTNIIFMEDIO`, `CTNIIFALTO`, `CTACTIVAFE`, `CTCONSEFE`, `CTRESOLFE1`, `CTRESOLFE2`, `CTFCHIRFE`, `CTFCHFRFE`, `CTLEYEN1`, `CTLEYEN2`, `CTLEYEN3`, `CTLEYEN4`, `CTLEYEN5`, `CTPREFIFE`, `CTLEYEN6`, `CTLEYEN7`, `CTLEYEN8`, `CTLEYEN9`, `CTLEYEN10`, `CTENCAB1`, `CTENCAB2`, `CTENCAB3`, `CTENCAB4`, `CTULPWEB`, `CTPREFIWEB`, `DESPAI`, `DESPAF`.

### FADDIA

- VERDETAL — CONSULTA.PRG:1994 — FACODIGO

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `FACIA`, `FAPLACA`, `FACODIGO`, `FANOMBRE`, `FADIREC`, `FACIUDAD`, `FATELEF`, `FANIT`, `FATIPPER`, `FAFACTURA`, `FAPEDIDO`, `FAFCHFAC`, `FAFCHVEN`, `FACANT`, `FACANT2`, `FAVLRBRU`, `FAVLRRETV`, `FAVLRRETI`, `FAVLRRETC`, `FAVARIOS`, `FAVLRDES`, `FAVLRFLE`, `FAVLRIVA`, `FAVLRIMC`, `FAVLROIP`, `FAVLRNET`, `FAVLR01`, `FAPAG01`, `FAVLR02`, `FAPAG02`, `FAVLR03`, `FAPAG03`, `FAVLDESFI`, `FAPEDINT`, `FAVENDED`, `FAOBSER`, `FATIME`, `FADOCPAGO`, `FANOMCOMP`, `FAOBSERVEN`, `FACOND`, `FAESTADO`, `FAVLRBRU2`, `FAVLRDES2`, `FAVLRIVA2`, `FAVLRNET2`, `FACONTRA`, `FANOMPRO`, `FAVENDED2`, `FATIPO`, `FAVLRCREE`, `FAVLRTASA`.

### FADFACTU

- GRAVAFOR — FACTAB.PRG:880 — ARCHI

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `ARCHI`, `CAMPO`, `NOMBRE`, `LONGITUD`, `TIPO`, `IMP`, `TAMANO`, `FORMATO`, `INICIAL`, `FINAL`, `FILA`, `COLUMNA`, `LEYENDA`.

### FADFORMA

- GRAVAFOR — FACTAB.PRG:879 — CODIGO
- FADGENF2 — FACTAB.PRG:980 — NOMBRE

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `ARCHI`, `CAMPO`, `NOMBRE`, `LONGITUD`, `TIPO`, `IMP`, `TAMANO`, `FORMATO`, `INICIAL`, `FINAL`, `FILA`, `COLUMNA`, `FILA2`, `COLUMNA2`, `LEYENDA`, `FUENTE`, `TIPOFTE`.

### FADGENF

- FADGENF — FACTAB.PRG:723 — CODIGO
- FORMATO — CONTABDSI.PRG:1275 — AUTORIZA
- CONSIFOR — CONTABDSI.PRG:2376 — CODIGO

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `AMBIENTE`, `INICIAL`, `TAMANO`, `LIMITES`, `LIMITEI`, `CONFIGURA`, `MONEDA`, `DIVA`, `COLA`, `SALE`, `DCTOS`, `COLA2`, `PUERTO2`, `AUTORIZA`, `FPREVIEW`.

### FADITE

- VERDETAL — CONSULTA.PRG:2062 — IFNOMBRE

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `IFCLIENTE`, `IFMESA`, `IFPLACA`, `IFPEDIDO`, `IFFCHPED`, `IFBODEGA`, `IFFACT`, `IFARTIC`, `IFPARTE`, `IFNUMERO`, `IFEAN`, `IFNOMBRE`, `IFUNIMED`, `IFCANT`, `IFCANT2`, `IFCOSTO`, `IFVLRUNI`, `IFVARIOS`, `IFVLRBRU`, `IFVLRRETV`, `IFVLRRETI`, `IFVLRRETC`, `IFPORDES`, `IFVLRDES`, `IFVLDESFI`, `IFTIMP`, `IFPORIVA`, `IFVLRIVA`, `IFVLRIMC`, `IFVLROIP`, `IFVLRNET`, `IFPEND`, `IFFECHA`, `IFVENDED`, `IFESTADO`, `IFTIPINV`, `IFDOCUM2`, `IFVLRBRU2`, `IFVLRDES2`, `IFVLRIVA2`, `IFVLRNET2`, `IFCONTRA`, `IFCANTPED`, `IFLOTE`, `IFVENLOTE`, `IFLISTA`, `IFVENDED2`, `IFDEVOK`, `IFVLRCREE`, `IFCCOSTO`, `IFVLRUNI2`.

### FADPAGO

- VERDETAL — CONSULTA.PRG:2017 — NOMBRE

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `PNUMERO`, `PREFIJO`, `NDOCUM`, `PDOCPAGO`, `PNOMCOMP`, `PCARTERA`, `PEFECTO`, `VLRVENTAS`, `CANT`, `SALE`, `VLRBRUTO`, `VLRDCTO`, `VLRIVA`, `VLRNETO`, `DEB01`, `CRE01`, `DEB02`, `CRE02`, `DEB03`, `CRE03`, `DEB04`, `CRE04`, `DEB05`, `CRE05`, `DEB06`, `CRE06`, `DEB07`, `CRE07`, `DEB08`, `CRE08`, `DEB09`, `CRE09`, `COMPRO`, `PCAJON`, `PCLICARTE`, `CODCONSE`, `ULTCONSE`, `FCHCONSE`, `NUMDOC`, `BANCO`, `AUTORIZA`, `CODCARTE`.

### FADTAB

- ZONAS — FACTAB.PRG:121 — CTABCOD
- TRAB_ZONA — FACTAB.PRG:440 — CTABCOD
- DSIGRABAZ — FACTAB.PRG:510 — CTABCOD
- AYUCODZ — CONTAGRAL.PRG:1443 — CTABCOD
- LISTER2 — CONTAGRAL.PRG:1590 — CTABDES

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CTABCOD`, `CTABDES`, `CTPESO`, `CTCOSTO`, `VINIDEBCP`, `VINICRECP`, `VPOSDEBCP`, `VPOSCRECP`, `VINIDEBLP`, `VINICRELP`, `VPOSDEBLP`, `VPOSCRELP`.

### FADVEHI

- VEHI001 — FACTAB.PRG:27 — VCODIGO
- TRAB_VEHI — FACTAB.PRG:63 — VCODIGO
- VEHIGRABA — FACTAB.PRG:89 — VCODIGO
- BORRAVEHI — FACTAB.PRG:45 — DBDELETE

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `VCODIGO`, `VNOMBRE`.

### FAESPERA

- CIUDAD — FACTAB.PRG:271 — CODIGO

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `CLIENTE`, `NOMCLI`, `VENDED`, `NOMVEN`, `CANT`, `BRUTO`, `IVA`, `NETO`.

### NOMCALEN

- CAL_VIGMC — CONTAGRAL.PRG:283 — DIA
- DSIFCH3 — CONTABDSI.PRG:1308 — DBSEEK
- DSIFCH — CONTABDSI.PRG:1657 — DBSEEK
- DSIFCH2 — CONTABDSI.PRG:1702 — DBSEEK

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `DIA`, `NOMDIA`, `OBSERVA`, `FESTIVO`, `CIERRE`, `CANT1`, `PROM`.

### TIDBODE

- ABRESUC_MER — CONTABDSI.PRG:3176 — ESTADO
- ABRESUC_MER2 — CONTABDSI.PRG:3198 — TIPDOC
- CIERRSUC_MER — CONTABDSI.PRG:3251 — ESTADO
- CIERRSUC_CLI — CONTABDSI.PRG:3270 — ESTADO
- ABRESUC_CLI — CONTABDSI.PRG:3288 — ESTADO

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `CARPETA`, `CARPETAPD`, `CARPETAIP`, `CARPETAR`, `BODEGA`, `SALDOS`, `COSTOS`, `VENTAS`, `PROMEDIO`, `CCOSTO`, `TIPDOC`, `VTA01`, `VTA02`, `VTA03`, `VTA04`, `VTA05`, `VTA06`, `VTA07`, `VTA08`, `VTA09`, `VTA10`, `VTA11`, `VTA12`, `ENT01`, `ENT02`, `ENT03`, `ENT04`, `ENT05`, `ENT06`, `ENT07`, `ENT08`, `ENT09`, `ENT10`, `ENT11`, `ENT12`, `SAL01`, `SAL02`, `SAL03`, `SAL04`, `SAL05`, `SAL06`, `SAL07`, `SAL08`, `SAL09`, `SAL10`, `SAL11`, `SAL12`, `VERSAL`, `ESTADO`, `ACUMULA`, `HABILITA`, `BOD1`, `BOD2`, `ULTIMAF`, `ULTIMAC`, `PEDIDO`, `COMPRA`, `SALDOULT`, `ULTVTA`, `SALDOBO`, `ULTCOM1`, `CANCOM1`, `VALCOM1`, `VALCOM3`, `ROTACION`, `INACTIVO`, `CXLS`, `TIPMARGEN`, `CODCIU`, `CTNPED`, `GTSOL`, `ABC`, `SUGEPEDI`, `EMBALAJE`, `REDONDEO`, `ICANT`, `PROYESEMA`, `VTASEANT`, `ISALDO`, `DIASINV`, `INVEMAX`, `ULTIMORECI`, `ITRANSITO`, `FORCSEMA`, `CANTPRDIA`, `PLAENTRED`, `STOCKSEG`, `PTOREORD`, `CANPTORE`, `FREPEDI`, `CICLOPEDI`, `IPORIVA`, `IPRELIST`, `OCEDI`, `CODCEN`, `INIMP3`, `LOGY1`, `CODCEN2`, `EOS`, `AESTADO`.

### TIDFORMA

- GRAVAFOR — FACTAB.PRG:879 — CODIGO
- FADGENF2 — FACTAB.PRG:980 — NOMBRE

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `ARCHI`, `CAMPO`, `NOMBRE`, `LONGITUD`, `TIPO`, `IMP`, `TAMANO`, `FORMATO`, `INICIAL`, `FINAL`, `FILA`, `COLUMNA`, `FILA2`, `COLUMNA2`, `LEYENDA`, `FUENTE`, `TIPOFTE`.

### TIDGENF

- FADGENF — FACTAB.PRG:723 — CODIGO
- FORMATO — CONTABDSI.PRG:1275 — AUTORIZA
- CONSIFOR — CONTABDSI.PRG:2376 — CODIGO

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `AMBIENTE`, `INICIAL`, `TAMANO`, `LIMITES`, `LIMITEI`, `CONFIGURA`, `MONEDA`, `DIVA`, `COLA`, `SALE`, `DCTOS`, `COLA2`, `PUERTO2`, `AUTORIZA`, `FPREVIEW`.

### TIDINVE

- GRAVAFOR — FACTAB.PRG:880 — ARCHI

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `ARCHI`, `CAMPO`, `NOMBRE`, `LONGITUD`, `TIPO`, `IMP`, `TAMANO`, `FORMATO`, `INICIAL`, `FINAL`, `FILA`, `COLUMNA`, `LEYENDA`.

### TIDPEDI

- ILISTAR — CONTABDSI.PRG:2964 — PEDCOD

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `PEDCOD`, `PEDNOM`, `PEDDIR`, `CANITEM`, `PEDIPCEDI`.

### TIDSAL

- REPLI_METC — CONTAGRAL.PRG:3937 — INMETCOMP

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `INARTIC`, `NUMERO`, `INEAN`, `INEANC`, `INPARTE`, `INNOMBRE`, `INNOMBRE3`, `INUNIDAD`, `INPROVEE`, `INTIPO`, `INEMBALAJE`, `INVRVENTA1`, `INVRVENTA2`, `INVRVENTA3`, `INVRVENTA4`, `INVRVENTA5`, `INVRVENTA6`, `INVRVENTA7`, `INVRVENTA8`, `INVRVENTA9`, `INVRVENTA0`, `INTIMP`, `INIMPC`, `INIMP3`, `INTIPINV`, `INMINIMO`, `INMAXIMO`, `INVRULTC`, `INFCHULTC`, `INFCUSAL1`, `INUBIC`, `INCOMPRO`, `INGANAN`, `INGANAN2`, `INGANAN3`, `INCONVER`, `INTREPOS`, `INPESO`, `INFPRECIO`, `INFORMULA`, `INOUT`, `INCOSTO00`, `INSALDO00`, `INSALDO002`, `IEU01`, `IEV01`, `ISV01`, `ISU01`, `IEU02`, `IEV02`, `ISU02`, `ISV02`, `IEU03`, `IEV03`, `ISU03`, `ISV03`, `IEU04`, `IEV04`, `ISU04`, `ISV04`, `IEU05`, `IEV05`, `ISU05`, `ISV05`, `IEU06`, `IEV06`, `ISU06`, `ISV06`, `IEU07`, `IEV07`, `ISU07`, `ISV07`, `IEU08`, `IEV08`, `ISU08`, `ISV08`, `IEU09`, `IEV09`, `ISU09`, `ISV09`, `IEU10`, `IEV10`, `ISU10`, `ISV10`, `IEU11`, `IEV11`, `ISU11`, `ISV11`, `IEU12`, `IEV12`, `ISU12`, `ISV12`, `IEU13`, `IEV13`, `ISU13`, `ISV13`, `INRETEN`, `INARTICES`, `INFINANCIA`, `INASALDO`, `INTRANSF`, `INCPESO`, `INMARCA`, `INFRACC`, `INVLFRA`, `INPRESEN`, `INBLOQUEO`, `INVTACOS`, `VTA01`, `VTA02`, `VTA03`, `VTA04`, `VTA05`, `VTA06`, `VTA07`, `VTA08`, `VTA09`, `VTA10`, `VTA11`, `VTA12`, `VTA13`, `INACTIVO`, `INFECHA`, `INBLOCOM`, `INAPLIDCTO`, `INPTOPOS`, `INEAN14`, `INTIPOFRA`, `INPROTOR`, `INCUM`, `ININVIMA`, `INMARCAP`, `INNOMBRE4`, `INWEB`, `INFCHREG`, `INGARANTIA`, `INARTOFER`, `INSUBEPRE`, `INREGIMPC`, `INSALDOWEB`, `INGSALWEB`, `INBOTONG`, `INDCTO3X2`, `INIMPCOSTO`, `INTIENDAB`, `INCCOSTO`, `INCOSIVA`, `INCOSNIIF`, `INSALNIIF`, `INVALNIIF`, `INROTNIIF`, `INCANNIIF`, `NIFCOSTO00`, `NIFEV01`, `NIFSV01`, `NIFEV02`, `NIFSV02`, `NIFEV03`, `NIFSV03`, `NIFEV04`, `NIFSV04`, `NIFEV05`, `NIFSV05`, `NIFEV06`, `NIFSV06`, `NIFEV07`, `NIFSV07`, `NIFEV08`, `NIFSV08`, `NIFEV09`, `NIFSV09`, `NIFEV10`, `NIFSV10`, `NIFEV11`, `NIFSV11`, `NIFEV12`, `NIFSV12`, `NIFEV13`, `NIFSV13`, `MODI1`, `MODI2`, `MODI3`, `MODI4`, `MODI5`, `INEMBALAJE2`, `INPORIMC`, `INFAMIS`, `INGANAN4`, `INGANAN5`, `INGANAN6`, `INGANAN7`, `INGANAN8`, `INGANAN9`, `DESMAR1`, `DESMAR2`, `DESMAR3`, `DESMAR4`, `DESMAR5`, `DESMAR6`, `DESMAR7`, `DESMAR8`, `DESMAR9`, `SACATWEB`, `INALTO`, `INANCHO`, `INLARGO`, `INACTI1`, `INACTI2`, `INACTI3`, `INACTI4`, `INACTI5`, `INAPP`, `INESCA`, `INACTI6`, `INACTI7`, `INACTI8`, `INACTI9`, `INACTI10`, `INOPLOG`, `INVTACAF`, `INFINVIMA`, `INWEBSER`, `INR1`, `INR2`, `INR3`, `INR4`, `INR5`, `INDOMICOM`, `INDOMIURL`, `INIUM1`, `INIUM2`, `INIUM3`, `INDOMIRAP`, `ARTICDSI`, `INCATE`, `ETIDIG`, `ETI_IDP`, `ETI_PUM`, `ETI_TEMPL1`, `ETI_TEMPL2`, `ETI_IDT`, `ININACVER`, `INETISEC`, `INACTI11`, `INACTI12`, `INACTI13`, `INACTI14`, `INACTI15`, `INACTI16`, `INACTI17`, `INACTI18`, `INACTI19`, `INACTI20`, `INULTRAP`, `INIMP4`, `INMETCOMP`, `INFCHVIGMC`, `INCLACOMP`, `INUMINIDES`, `INABC`, `INRESERV`, `INSEMANA`, `INPRONOSTI`, `INSTOCKPR`, `INLARGO14`, `INANCHO14`, `INALTO14`, `INPESO14`, `INESTADO`, `ID`.

### TIDSUCUR

- ILISTAR — CONTABDSI.PRG:2933 — SUCURSAL

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CTDIREC`, `CTNOMBRE`, `CTANOANT`, `SUCURSAL`, `MARCA`, `CANT`, `CANT2`, `CARGA`, `CARPETA`, `CTNPED`, `SUCUR2`, `CLACOMP`, `OCEDI`.

### TIDTAB

- ILISTAR — CONTABDSI.PRG:2840 — CTABCOD

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CTABCOD`, `CTABDES`, `LINEA`, `CTABCOD1`, `NUMERO`, `MAXDCTO`, `RETENCION`, `VENTAS01`, `VENTAS02`, `VENTAS03`, `VENTAS04`, `VENTAS05`, `VENTAS06`, `VENTAS07`, `VENTAS08`, `VENTAS09`, `VENTAS10`, `VENTAS11`, `VENTAS12`, `VENTAS13`, `ESCALAS`, `CODIGO`, `DIAS`, `DIAS2`, `DIAS3`, `DIAS4`, `PRE01C`, `PRE01V`, `PRE02C`, `PRE02V`, `PRE03C`, `PRE03V`, `PRE04C`, `PRE04V`, `PRE05C`, `PRE05V`, `PRE06C`, `PRE06V`, `PRE07C`, `PRE07V`, `PRE08C`, `PRE08V`, `PRE09C`, `PRE09V`, `PRE10C`, `PRE10V`, `PRE11C`, `PRE11V`, `PRE12C`, `PRE12V`, `INVE`, `CCOSTO`, `CTIPDOC`, `CTSERIAL`, `CTAGRUP`, `CTWEB`, `BORRAR`, `CPARTE`, `CTSUBSI`, `CESTAETI`, `CCODNPUM`, `CACUVLR`, `CACUIVA`, `CACUCANT`, `DIASINVEM`.

### TIDTIPOS

- ILISTAR — CONTABDSI.PRG:2876 — TIPO

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CLASE`, `TIPO`, `NOMBRE`, `VALOR`, `VALOR2`, `DECIMAL`, `SALE`, `FLAG`, `VLRIMP3`, `BASE`, `IMPUESTO`, `OTROSIMP`, `BASERET`, `TIPOCOMBO`.

### TIDTRET

- ILISTAR — CONTABDSI.PRG:2909 — CODIGO

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `R1`, `R2`, `R3`, `R4`, `R5`, `R6`, `R7`, `R8`.

### VEDVEN

- LISRUTASX — CONTAGRAL.PRG:1311 — VNOMBRE
- LISTER2 — CONTAGRAL.PRG:1599 — VNOMBRE
- PVENOK — CONTAGRAL.PRG:4120 — VNOMBRE
- VERDETAL — CONSULTA.PRG:2014 — VNOMBRE

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `VCODIGO`, `VCEDULA`, `VNOMBRE`, `VDIRECCION`, `VCIUDAD`, `VTELEF`, `VFCHING`, `VFCHRET`, `VCAUSALRET`, `VPORCOMVEN`, `VPORCOMREC`, `VALOR`, `DIAS1`, `DIAS2`, `DIAS3`, `DIAS4`, `VRUTA01`, `VRUTA02`, `VRUTA03`, `VRUTA04`, `VRUTA05`, `VRUTA06`, `VRUTA07`.

### VISBODE

- ILISTAR — CONTABDSI.PRG:2824 — CCOSTO

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CCOSTO`, `CNOMBRE`, `CNIVEL`, `CFLAG`, `SALDOS`, `COSTOS`, `PROMEDIO`, `BANO`, `FACTURA`, `INVE`, `ASALDO`.

### XADFACTU

- GRAVAFOR — FACTAB.PRG:880 — ARCHI

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `ARCHI`, `CAMPO`, `NOMBRE`, `LONGITUD`, `TIPO`, `IMP`, `TAMANO`, `FORMATO`, `INICIAL`, `FINAL`, `FILA`, `COLUMNA`, `FILA2`, `COLUMNA2`, `LEYENDA`, `FUENTE`, `TIPOFTE`.

### XADFORMA

- GRAVAFOR — FACTAB.PRG:879 — CODIGO
- FADGENF2 — FACTAB.PRG:980 — NOMBRE

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `ARCHI`, `CAMPO`, `NOMBRE`, `LONGITUD`, `TIPO`, `IMP`, `TAMANO`, `FORMATO`, `INICIAL`, `FINAL`, `FILA`, `COLUMNA`, `FILA2`, `COLUMNA2`, `LEYENDA`, `FUENTE`, `TIPOFTE`, `XTOTDEB`, `XTOTCRE`.

### XADGENF

- FADGENF — FACTAB.PRG:723 — CODIGO
- FORMATO — CONTABDSI.PRG:1275 — AUTORIZA
- CONSIFOR — CONTABDSI.PRG:2376 — CODIGO

Destino: formatos_documentales — schema/03_maestros.sql:239; formato_elementos — schema/03_maestros.sql:254

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `AMBIENTE`, `INICIAL`, `TAMANO`, `LIMITES`, `LIMITEI`, `CONFIGURA`, `SALE`, `MONEDA`, `COLA`, `ANEXO`, `AUTORIZA`, `FPREVIEW`, `CTAS`, `LIMITES2`.

### XADMAE

- MOVMEDCXP — DSITAB.PRG:3962 — CCODIGO
- BORRACLI — CONTAGRAL.PRG:1016 — DBSEEK

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CCODIGO`, `CSUCURSAL`, `CEMPRESA`, `CENTRY`, `CTIPO`, `CFACTURA`, `CNINTER`, `CNOMBRE`, `CTIPEMP`, `CFECFAC`, `CVLRBRU`, `DCTOC1`, `CVLRIVA`, `CVLRIMP2`, `CVLRIMP3`, `CVLRRET`, `CVLRRET2`, `CVLRRET3`, `CVLRRET4`, `CVLRRET5`, `CPDFN`, `CVLRFAC`, `CFECVEN`, `CFECPAGO`, `CRECCAJA`, `CVLRSUB`, `SALDO00`, `DEB00`, `CRE00`, `DEB01`, `CRE01`, `DEB02`, `CRE02`, `DEB03`, `CRE03`, `DEB04`, `CRE04`, `DEB05`, `CRE05`, `DEB06`, `CRE06`, `DEB07`, `CRE07`, `DEB08`, `CRE08`, `DEB09`, `CRE09`, `DEB10`, `CRE10`, `DEB11`, `CRE11`, `DEB12`, `CRE12`, `DEB13`, `CRE13`, `CCONTA`, `CCONCEP`, `CESTADO`, `SALDO`, `MARCA`, `CVLRPAGO`, `CEDAD`, `CZONA`, `CCODRET`, `CCODRET2`, `CCODRET3`, `CCODRET4`, `CCODRET5`, `CDCTOFIN`, `CAUTORIZA`, `CCAUSA`, `CCANT`, `CVENDED`, `CVLRMP`, `CIVAMP`, `CVLRICUI`.

### XADMOVI

- INFOR53R — CONINFOR.PRG:6280 — XVLRRETI

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `XDOCUM`, `XENTRY`, `XPROVEE`, `XARTIC`, `XNOMBRE`, `XBRUTO`, `XDCTO`, `XPORIVA`, `XIVA`, `XNETO`, `XPORRET`, `XVLRRET`, `XPORRETI`, `XVLRRETI`, `XIVAT`, `XCTABRU`, `XVLRRET3`, `XPORRET3`, `XVLRRET4`, `XPORRET4`, `XVLROTRO`, `XVLRAIU`, `XRETAD1`, `XRETAD2`, `XRETAD3`, `XRETAD4`, `XRETAD5`, `XDOCUM2`, `XFECHA`, `XFCHVEN`.

### XADPAGOS

- VERNOM — CONTAGRAL.PRG:987 — NOMBRE
- TRAB_CLI2 — CONTAGRAL.PRG:2731 — NOMBRE
- TPAGOOK — CONTAGRAL.PRG:3294 — NOMBRE

Destino: integraciones — schema/08_seguridad.sql:79

Campos físicos/código inventariados: `CODIGO`, `NOMBRE`, `IVA`, `TEORICO`, `RETEFTE`, `RETEIVA`, `RETEICA`, `ANO`, `BASETEOR`.

