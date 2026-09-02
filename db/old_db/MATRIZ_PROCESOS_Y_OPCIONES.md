# Validación por proceso y opción del menú

Los procesos se agrupan sin eliminar variantes. Las opciones exactas y argumentos del menú aparecen al final. Todos requieren pruebas de aceptación sobre PostgreSQL.

| ID | Proceso | Estado | Destino existente | Cambios necesarios | Prueba de aceptación |
|---|---|---|---|---|---|
| P01 | Empresas, apertura, traslado y limpieza | Parcial | companias, compania_anios, integraciones | Identidad de contabilidad distinta de NIT; alta por año, traslado sin duplicar historia y limpieza con autorización/respaldo. | Una empresa con dos años y un NIT con dos contabilidades; aislamiento y traslado conciliado. |
| P02 | Parámetros de operación y períodos | Parcial | parametros_operacion, periodos_contables | No es mapeo 1:1 completo. Preservar CTFCHOY, CTTOBS, CTDOCUM, CTLEY2 y flags; CT00..12 habilitado no equivale necesariamente a cierre definitivo. MCR se inicializa y no se guarda: nuevo modo requiere decisión. | Abrir/guardar cada control, reiniciar y comprobar persistencia; período inexistente/cerrado no admite operaciones. |
| P03 | Plan de cuentas, NIIF y niveles | Parcial | cuentas, saldos_cuenta | Separar cuenta/tercero/acumulados; reglas de captura, asignaciones fiscales y clasificación corriente; no asumir que NIVEL original equivale a longitud sin revisar. | Misma jerarquía y validaciones por cuenta; apertura por año y saldos general/NIIF reproducibles. |
| P04 | Comprobantes, tipos documentales y plantillas | Parcial | comprobantes, consecutivos_comprobantes, tipos_documento, plantillas_contables, plantilla_lineas | Tipos y comprobantes son dimensiones distintas. Expandir ocho parejas de cuentas débito/crédito y ligarlas a tipo documental; no tratarlas como ocho importes. | Capturar desde cada plantilla y comparar las cuentas generadas, numeración y documento afectado. |
| P05 | Terceros y catálogos de identificación | Parcial | terceros, tercero_etiquetas | Ampliar datos fiscales/comerciales y catálogos; conservar código legacy, nombres, actividad, ciudad y reasignaciones; decidir modelo global/por empresa. | Ficha completa antes/después, NIT con ceros, persona natural/jurídica, bloqueo y reasignación sin perder referencias. |
| P06 | Cuentas bancarias de terceros | Sin estructura | — | Agregar cuentas de banco por tercero con principal, tipo, número textual y observación. | Un tercero con varias cuentas y cambio de principal; ninguna truncada ni expuesta a roles de consulta no autorizados. |
| P07 | Centros de costo y distribución | Parcial | centros_costos | Reglas de distribución por cuentas/terceros y árbol; invariantes de compañía. CCOSTOS(2) pertenece a consolidación, no a este proceso. | Jerarquía, reparto fijo/porcentaje y total distribuido igual al origen. |
| P08 | Creación, continuación, edición y verificación de lotes | Parcial | lotes, lote_lineas, lote_validaciones | Conservar historial y estado del lote; reglas por documento y renglón; bloquear modificación tras aprobación/contabilización; importes inválidos a staging, no a tablas definitivas. | Lote vacío, descuadrado por documento, terceros/centros faltantes, edición concurrente y reintentos. |
| P09 | Ingreso directo y contabilización | Bloqueo funcional | documentos, documento_lineas, lotes | Original agrupa TDOCUM+TIPODOC+TCOMPR; destino crea sólo un documento. Persistir fecha/tipo y referencias por grupo; transacción y saldos equivalentes. | Un lote con al menos dos documentos y dos tipos produce documentos separados y totales exactos; fallo intermedio revierte todo. |
| P10 | Carga XLS, ADT, TXT, CSV y por meses | Parcial | lotes, lote_lineas, integraciones | Faltan lotes de importación, archivo/hash, filas crudas, rechazos, mapeos y ejecución idempotente; ADT requiere lector compatible. | Reimportar mismo archivo no duplica; filas inválidas se reportan con número y valor original; carga multimes conserva períodos. |
| P11 | Integración de nómina, aportes y provisiones | Parcial | integraciones, lotes, lote_lineas | Faltan CTCOMNOM1..3/CTDOCNOM1..3 y contrato de columnas XLS por modalidad. | Tres modalidades generan tipos y comprobantes correctos; archivo repetido y período cerrado se controlan. |
| P12 | Reembolsos | Sin estructura | — | Crear cabecera/detalle con centros y cruce, estado, tercero, valores y vínculo contable. Estructura física no verificada. | Reembolso con varios terceros/centros, modificación y aplicación una vez; validar contra fuente antes de migrar. |
| P13 | Anulación y reversión | Bloqueo funcional | documentos, documento_lineas, auditoria | Nueva anulación no actualiza saldos ni valida período y regeneración excluye original anulado pero incluye reversión. Definir semántica de libro para no invertir dos veces. | Original + reversión = efecto neto cero en cada cuenta/dimensión; coincide antes y después de regenerar. |
| P14 | Consultas, auxiliares, comparativos y acumulados | Derivable con cambios | documentos, documento_lineas, saldos_cuenta, saldos_cuenta_tercero, saldos_cuenta_centro, acumulados_tercero, acumulados_centro | Consultas nuevas y cruce cuenta+tercero+centro; regenerar todo desde libro/apertura, con selección por año/empresa/período. | Auxiliar y balance coinciden por cuenta, tercero y centro, no sólo totales globales. |
| P15 | Informes contables, flujo de caja y generador | Parcial | documentos, documento_lineas, saldos_cuenta | Faltan definiciones CONINF1 y selecciones por usuario; portear fórmulas, filtros, agrupación, bases y salidas. Tabla disponible no significa informe implementado. | Comparar todos los informes listados en menú con mismos filtros y un período patrón; exportaciones con iguales cifras. |
| P16 | Retenciones, certificados, anexos y plano anual | Bloqueo funcional | conceptos_retencion, acumulados_retencion, estado_acumulaciones | Separar variante retención de IVA por parámetro; persistir concepto/tarifa histórica, ajustes y certificados. Regeneración actual escribe terceros. | Base y valor por tercero/concepto/período; certificado coincide con libro y vuelve a ser igual tras limpieza/regeneración. |
| P17 | IVA, acumulados, certificados y limpieza | Bloqueo funcional | tarifas_iva, acumulados_iva, estado_acumulaciones | Regeneración Iva no hace carga y sin embargo actualiza estado; agregar tarifa por renglón y signo fiscal. | Tarifas múltiples, generado/descontable y reversión: reporte igual antes/después de reconstruir. |
| P18 | Renglones de declaración de renta | Parcial | renglones_renta | Conservar relación/rangos/reglas y vigencia de las definiciones; no inferir reglas tributarias nuevas. | Cada cuenta llega al renglón y signo original; los importes comparan con el informe patrón. |
| P19 | Exógena: formatos, conceptos y asignación | Parcial | formatos_exogenos, formato_conceptos, formato_asignaciones, medio_topes | Modelo insuficiente para rangos, conceptos en asignación, condiciones, fuente CXP y columnas. Versionar vigencia y contratos. | Reglas manuales e importadas de otra contabilidad producen la misma selección. |
| P20 | Exógena: generar, revisar, ajustar, detallar y depurar | Parcial | generaciones_medios, medio_filas, medio_conciliaciones | Falta detalle por documento y once valores/tercero alterno; corrección de trigger; conservar ajustes, topes, cruces y versión de salida. | Trazar cada fila hasta movimiento, comparar valores1..11 y cruce entre formatos, reproducir exportación. |
| P21 | Edición e impresión de formatos | Parcial | formatos_documentales, formato_elementos | Ampliar tipos de elemento, fórmulas/campos, secciones y configuración; aislar los formatos de cada módulo. Evaluar expresiones legacy sin ejecutar código arbitrario. | Documento patrón imprime campos, totales, leyendas, páginas y condiciones; mismo código en módulos distintos no colisiona. |
| P22 | Reprocesos, revalorización y auditorías | Parcial | procesos, saldos_cuenta | Faltan algoritmos de reconstrucción y reglas CONAJUS; persistir cambios/simulaciones por renglón y exclusión mutua con contabilización. | Reproceso dos veces arroja mismo resultado; informe de diferencias por cuenta/documento y recuperación ante fallo. |
| P23 | Certificados y anexos en portal | Sin estructura | — | Metadatos de XADPDF y archivos requieren repositorio privado, publicación, autorización por tercero y trazabilidad. | Subir, consultar y retirar documento sin perder huella histórica; usuario ajeno no puede descargarlo. |
| P24 | Activos fijos y amortizaciones | Sin estructura | — | Crear maestros, vida útil, costo, cuota/ajuste mensual, cuentas y distribuciones; no basta guardar el asiento final. | Un activo y un amortizable generan cuotas y asientos iguales por centro; baja y distribución suman correctamente. |
| P25 | Cierre anual y comprobante de cierre | Parcial | cierres, periodos_contables, documentos | Falta ejecución SQL/servicio, vínculo al documento generado y apertura siguiente año, bloqueo coordinado e idempotencia. | Cierre conserva historia, bloquea año y genera resultado/apertura conciliados; segundo intento no duplica. |
| P26 | Traslado de períodos 13–18 | Parcial | cierre_traslados, cierres, documentos | Persistir año/empresa/operación destino y referencia de origen; reglas de período y prevención de doble traslado. | Cada ajuste se traslada exactamente una vez al destino previsto y se concilian ambos lados. |
| P27 | Consolidación de contabilidades | Parcial | consolidaciones, consolidacion_origenes | Origen/destino no basta: homologación de cuentas/centros, trazabilidad de resultados y control del vaciado. | Dos empresas con códigos iguales/diferentes, destino sólo consolidación y repetición sin duplicación. |
| P28 | Usuarios, permisos y auditoría | Parcial | usuarios, roles, permisos, rol_permisos, auditoria | Permiso por compañía, identidad autenticada y actor bigint; auditoría real de todas las acciones. PERMI devuelve verdadero en el original: no trasladar ese bypass. | Usuarios con compañías distintas no cruzan datos; cambio y anulación dejan actor, motivo y fecha; accesos denegados se prueban. |
| P29 | Presupuesto jerárquico | Parcial | presupuestos, presupuesto_rubros, presupuesto_valores | Agregar concepto/nombre y clave completa, decidir PRE00/13 y ejecución MOVxx; preservar jerarquía y vínculo al centro. | Crear/editar cada nivel y 12 meses; mismo código en dos centros; presupuesto y ejecución se comparan. |
| P30 | Dependencias comerciales, cartera, CXP y catálogos compartidos | Integración requerida | integraciones | Definir propietarios y contratos por dependencia; integrar o replicar datos requeridos, también escrituras de terceros. Configuración JSON no reemplaza datos externos. | Consulta de factura y cartera, datos de proveedor y réplica de tercero siguen funcionando con el legado coexistente. |
| P31 | Reasignación, reclasificación y fusión | Parcial | procesos, cuentas, terceros, centros_costos, documentos | Crear plan de cambios y homologaciones, referencias afectadas y restauración; evitar reescribir el libro sin rastro. | Reasignar una cuenta/tercero/centro conserva totales, saldos e historial; detectar colisiones antes de aplicar. |
| P32 | Extracción, exportación y corrección de movimiento | Parcial | procesos, documentos, documento_lineas, lotes | Preservar filtros por documento, lote/usuario, centro y mes; exportar sin borrar por defecto; depuración con simulación y huella. | Cada filtro selecciona el mismo conjunto fuente y los importes coinciden; corregir no elimina historia inadvertidamente. |
| P33 | Aperturas y traslado automático de saldos | Parcial | saldos_cuenta, documentos, documento_lineas | Elegir MOV00 o saldo inicial como origen para evitar duplicación; dimensiones completas y referencia al corte anterior. | Balance inicial exacto por cuenta/tercero/centro, con y sin detalle histórico completo. |
| P34 | Revisión de bases IVA/retención y distribución | Parcial | procesos, documento_lineas | Cálculo determinista y reglas de base/tasa versionadas; diferencias y aprobaciones antes de reescribir datos. | Mismos casos de base-a-retención y retención-a-base; redondeo reconciliado y reversibilidad. |
| P35 | Informes NIC/NIIF e información de apertura | Parcial | cuentas, documentos, documento_lineas | Conservar campos NIIF/clasificación usados y transformaciones; confirmar alcance efectivo, ya que hay rutinas parciales en el legado. | Informe patrón y clasificación corriente/no corriente sin perder saldos alternos; funciones incompletas se declaran, no se inventan. |
| P36 | Mantenimiento técnico, estructuras y paginación | Sustitución técnica | procesos | Índices ADI y COPY STRUC se reemplazan por índices/DDL y mantenimiento PostgreSQL; preservar paginación funcional y no migrar índices como datos. | Instalación/migraciones reproducibles sin borrado de base; búsquedas y páginas equivalentes. |

## Funciones de entrada por proceso

- P01: CIAS (DSITAB.PRG:1901), INFORCIA (DSITAB.PRG:6015), LIMPCIA (REPROCES.PRG:7449), ABRE_CONTAB (CONTABDSI.PRG:648)
- P02: PARAMS (DSITAB.PRG:1348), DSIGRABA6 (DSITAB.PRG:1506)
- P03: CMAESTRO (PLANMAES.PRG:16), CMAEST1 (PLANMAES.PRG:253), GRABAMAES (PLANMAES.PRG:406), ANA_NIVEL (REPROCES.PRG:121), ANA_MOVCTA (REPROCES.PRG:6)
- P04: CCOMPRO (DSITAB.PRG:1585), DOCUMVIS (CONTABDSI.PRG:2289), PLANTICO (DSITAB.PRG:7), GRABAPLA (DSITAB.PRG:157)
- P05: CLIENTES (CONTAGRAL.PRG:778), CLIENTER (CONTAGRAL.PRG:430), CIUDAD (FACTAB.PRG:238), TRAB_CLI2 (CONTAGRAL.PRG:2528), LISTERCE (CONTAGRAL.PRG:1376), LISTERCU (CONTAGRAL.PRG:1053)
- P06: ADMCUENTA (CONTAGRAL.PRG:3066)
- P07: CCOSTOS (DSITAB.PRG:1099)
- P08: MOVI1 (MOVICON.prg:3598), MOVI11 (MOVICON.prg:3698), GRABALOT (MOVICON.prg:5528), VERIFI (MOVICON.prg:5821), VERIFI2 (MOVICON.prg:5947)
- P09: MOVI2 (MOVICON.prg:993), ACTUALIMO2 (MOVICON.prg:6521)
- P10: CONCARG9 (MOVICON.prg:53), CONCARG9_MES (MOVICON.prg:300), CONCARG10 (MOVICON.prg:9)
- P11: PARAMS_NOMI (DSITAB.PRG:1439), DSIGRABA6_NOM (DSITAB.PRG:1471), CONCARG9_NOM (MOVICON.prg:86)
- P12: REEMBOL01 (MOVICON.prg:7268), ACTU_LOTRE (MOVICON.prg:7370), GRABAITE_RE (MOVICON.prg:7646)
- P13: CON900 (REPROCES.PRG:6009)
- P14: CONSULC1 (CONSULTA.PRG:1770), CONSUL_1 (CONSULTA.PRG:84), CONSUL_2 (CONSULTA.PRG:912), CONSUL_3 (CONSULTA.PRG:2090), CONSUL_4 (CONSULTA.PRG:2370), CONSUL_5 (CONSULTA.PRG:2584), CONSUL_7 (CONSULTA.PRG:2736), CONSUL_8 (CONSULTA.PRG:2832), CONSULCO (CONSULTA.PRG:435), CONSULCO2 (CONSULTA.PRG:581), CONSULME (CONSULTA.PRG:790), INFOR07 (CONINFOR.PRG:5096), INFOR07T (CONINFOR.PRG:6564), INFOR07C (CONINFOR.PRG:6507), INFOR09C (CONINFOR.PRG:9959), INFOR09CX (CONINFOR.PRG:21129), CCTANIVEL (CONSULTA.PRG:4), INFOR07D (CONINFOR.PRG:11312), INFORT1 (DSITAB.PRG:7100), INFOR09D (CONINFOR.PRG:18135)
- P15: INFOR01 (CONINFOR.PRG:1451), INFOR02 (CONINFOR.PRG:1658), INFOR03 (CONINFOR.PRG:4159), INFOR03_2 (CONINFOR.PRG:3926), INFOR04 (CONINFOR.PRG:3304), INFOR08 (CONINFOR.PRG:12369), INFOR09 (CONINFOR.PRG:12909), INFOR10 (CONINFOR.PRG:12943), INFOR11 (CONINFOR.PRG:13301), INFOR12 (CONINFOR.PRG:13544), INFOR13 (CONINFOR.PRG:14266), INFOR14 (CONINFOR.PRG:14571), INFO015 (CONINFOR.PRG:15842), INFOR0K (CONINFOR.PRG:17459), INFOR0K2 (CONINFOR.PRG:16613), INFOR0L (CONINFOR.PRG:18531), INFOR9L (CONINFOR.PRG:22011), INFORM1 (CONINFOR.PRG:584), INFORM2 (CONINFOR.PRG:699), GENINFT (CONINFOR.PRG:539), INFORO1N (CONINFOR.PRG:19954), INFORP1 (CONINFOR.PRG:20597), INFORQ1 (CONINFOR.PRG:20357)
- P16: RETES (DSITAB.PRG:1754), INFOR05 (CONINFOR.PRG:6067), INFOR15 (CONINFOR.PRG:6775), INFOR152 (CONINFOR.PRG:18835), RETECTA (CONINFOR.PRG:18576), ANEXIMP (CONINFOR.PRG:19538), LIMACUM (CONINFOR.PRG:5911), PLANORETEN (CONINFOR.PRG:23878)
- P17: IVAS (DSITAB.PRG:1837), INFOR05 (CONINFOR.PRG:6067), INFOR15 (CONINFOR.PRG:6775), INFOR152 (CONINFOR.PRG:18835), RETECTA (CONINFOR.PRG:18576), ANEXIMP (CONINFOR.PRG:19538), LIMACUM (CONINFOR.PRG:5911)
- P18: RENGLONES (DSITAB.PRG:1644)
- P19: MEDMAG01 (DSITAB.PRG:2782), MEDMAG02 (DSITAB.PRG:2955), MEDMAG03 (DSITAB.PRG:3222), MEDMAG03T (DSITAB.PRG:3509)
- P20: MEDMAG04 (DSITAB.PRG:3568), MEDMAG05 (DSITAB.PRG:4244), MEDMAG06 (DSITAB.PRG:7587), MEDMAG07 (DSITAB.PRG:8051), MEDMAG08 (DSITAB.PRG:4355), MEDMAG09 (DSITAB.PRG:8435), DEPUMAG (DSITAB.PRG:4775), DEPUMAGT (DSITAB.PRG:8295)
- P21: FADGENF (FACTAB.PRG:691), GRAVAFOR (FACTAB.PRG:827), FORMATO (CONTABDSI.PRG:1239), CONIMP (CONINFOR.PRG:1055), CONIMP2 (CONINFOR.PRG:310)
- P22: REPRO01 (REPROCES.PRG:295), REPRO02 (REPROCES.PRG:939), REPRO027 (REPROCES.PRG:855), MOVDOCK (REPROCES.PRG:6823), MOVDOCK_CTA (REPROCES.PRG:6884), MOVDOCK_CRE (REPROCES.PRG:7126)
- P23: CARGA_PORTAL (CONINFOR.PRG:8425), CARGA_PORTAL2 (CONINFOR.PRG:8486), CARGA_PORTAL3 (CONINFOR.PRG:8543), BORRA_PORTAL (CONINFOR.PRG:8531)
- P24: INTERACT (DSITAB.PRG:187), INTEACT2 (DSITAB.PRG:242), INTEACT3 (DSITAB.PRG:330), INFACT2 (CONINFOR.PRG:20901), INFORAMO (DSITAB.PRG:6552)
- P25: CIERR01 (REPROCES.PRG:4281), CIERR02 (REPROCES.PRG:4305), CIERR21 (REPROCES.PRG:4337), CIERR22 (REPROCES.PRG:4385)
- P26: CIERR03 (REPROCES.PRG:4427), CIERR031 (REPROCES.PRG:4440)
- P27: CONS002 (REPROCES.PRG:6257), CCOSTOS (DSITAB.PRG:1099)
- P28: CHECKUSUARIO (CONTABDSI.PRG:830), PERMI (CONTABDSI.PRG:858), AUDIVIS (CONTABDSI.PRG:1558), USUARIOS (DSITAB.PRG:2706), USUA1 (DSITAB.PRG:2731), DSIGRABA8 (DSITAB.PRG:2762)
- P29: PRESU1 (CONPRESU.PRG:6), GRABAPRESU (CONPRESU.PRG:243), AYUTAP (CONPRESU.PRG:120), AYUCCP (CONPRESU.PRG:90)
- P30: VERDETAL (CONSULTA.PRG:1971), CADTOT (CONTAGRAL.PRG:398), REPLI_METC (CONTAGRAL.PRG:3929), ILISTAR (CONTABDSI.PRG:2813), ABRESUC_MER (CONTABDSI.PRG:3170), ABRESUC_CLI (CONTABDSI.PRG:3282)
- P31: CLIENTER (CONTAGRAL.PRG:430), ESPE04 (REPROCES.PRG:4517), ESPE05 (REPROCES.PRG:4527), ESPE11 (REPROCES.PRG:5810), RECLA01 (REPROCES.PRG:7524), RECLA02 (REPROCES.PRG:7709), RECLA03 (REPROCES.PRG:7602), REASIMES (REPROCES.PRG:594), ACTUNOMA (CONINFOR.PRG:24308)
- P32: ESPE06 (REPROCES.PRG:4561), ESPE07 (REPROCES.PRG:5302), ESPE08 (REPROCES.PRG:4759), ESPE08J (REPROCES.PRG:4905), ESPE09 (REPROCES.PRG:4586), EXPORMES (REPROCES.PRG:7787), RECONDOC (REPROCES.PRG:709), LOTEE2 (REPROCES.PRG:6169), TERCE_LOT (REPROCES.PRG:217), DOBLE_LOT (REPROCES.PRG:169)
- P33: TRASLASA (REPROCES.PRG:6525), ESPE10 (REPROCES.PRG:5498)
- P34: ESPE12 (REPROCES.PRG:5911), TERCE_LOT (REPROCES.PRG:217)
- P35: NICAPER (CONINFOR.PRG:132), NICSALMOV (CONINFOR.PRG:6), MODESTA2_NIIF (CONTABDSI.PRG:1577), MODESTA3_NIIF (CONTABDSI.PRG:1590)
- P36: INDEXVIS (DSIINDEX.PRG:1563), STRULOT (REPROCES.PRG:6788), ESPE03 (REPROCES.PRG:4468)

## Opciones exactas del menú

Una función compartida puede tener varios procesos candidatos: INFOR05/INFOR15/LIMACUM dependen del argumento; CCOSTOS(1) son centros y CCOSTOS(2) consolidación. No se suman como funciones diferentes.

| Menú | Opción | Acción original | Proceso(s) candidato(s) | Fuente |
|---|---|---|---|---|
| ADM_LISTA | 1-Parámetros de Operación | PARAMS() | P02 | CONTABDSI.PRG:217 |
| ADM_LISTA | 1-Mantenimiento Terceros | CLIENTES(2) | P05 | CONTABDSI.PRG:220 |
| ADM_LISTA | 2-Reasignación de Nits | CLIENTER(2) | P05, P31 | CONTABDSI.PRG:221 |
| ADM_LISTA | 3-Catalogo de Cuentas | CMAESTRO() | P03 | CONTABDSI.PRG:223 |
| ADM_LISTA | 4-Números de Comprobante | CCOMPRO() | P04 | CONTABDSI.PRG:224 |
| ADM_LISTA | 5-Centros de Costo | CCOSTOS(1) | P07, P27 | CONTABDSI.PRG:225 |
| ADM_LISTA | 6-Renglones Declaracion de Renta | RENGLONES() | P18 | CONTABDSI.PRG:226 |
| ADM_LISTA | 7-Tipos de Documentos | DOCUMVIS(2) | P04 | CONTABDSI.PRG:227 |
| ADM_LISTA | 8-Tipos de Retenciones | RETES() | P16 | CONTABDSI.PRG:228 |
| ADM_LISTA | 9-Tarifas de IVA | IVAS() | P17 | CONTABDSI.PRG:229 |
| ADM_LISTA | A-Plantillas Contables | PLANTICO() | P04 | CONTABDSI.PRG:230 |
| ADM_LISTA | 1-Creacion | CIAS() | P01 | CONTABDSI.PRG:233 |
| ADM_LISTA | 2-Traslado Informacion | INFORCIA() | P01 | CONTABDSI.PRG:234 |
| ADM_LISTA | 3-Limpieza bases de Datos | LIMPCIA() | P01 | CONTABDSI.PRG:235 |
| ADM_LISTA | C-Reorganizacion Archivos | INDEXVIS("T") | P36 | CONTABDSI.PRG:237 |
| ADM_LISTA | D-Formatos de Documentos | FADGENF(4) | P21 | CONTABDSI.PRG:238 |
| ADM_LISTA | 1-Paginación | ESPE03() | P36 | CONTABDSI.PRG:241 |
| ADM_LISTA | 2-Fusion de Movimientos | ESPE04() | P31 | CONTABDSI.PRG:242 |
| ADM_LISTA | 3-Depuracion de Terceros | ESPE05() | P31 | CONTABDSI.PRG:243 |
| ADM_LISTA | 4-Extractar Comprobante | ESPE06() | P32 | CONTABDSI.PRG:244 |
| ADM_LISTA | 5-Extractar Documento | ESPE07() | P32 | CONTABDSI.PRG:245 |
| ADM_LISTA | 6-Extractar Movimiento Completo | ESPE08(1) | P32 | CONTABDSI.PRG:246 |
| ADM_LISTA | 7-Traslado Automatico de Saldos | TRASLASA(1) | P33 | CONTABDSI.PRG:247 |
| ADM_LISTA | 8-Generar Lote Saldos Iniciales | ESPE10() | P33 | CONTABDSI.PRG:248 |
| ADM_LISTA | 9-Reasignación de Cuentas y Centros de Costos | ESPE11() | P31 | CONTABDSI.PRG:249 |
| ADM_LISTA | 1-Reasignación de Cuentas | ESPE11(1) | P31 | CONTABDSI.PRG:251 |
| ADM_LISTA | 2-Reasignación de Centros de Costos | ESPE11(2) | P31 | CONTABDSI.PRG:252 |
| ADM_LISTA | A-Revision Bases Iva/Retención | ESPE12() | P34 | CONTABDSI.PRG:254 |
| ADM_LISTA | B-Convertir Lote | LOTEE2() | P32 | CONTABDSI.PRG:255 |
| ADM_LISTA | C-Reconstruir Documentos | RECONDOC() | P32 | CONTABDSI.PRG:256 |
| ADM_LISTA | D-Reasignar Movimiento Mensual | REASIMES() | P31 | CONTABDSI.PRG:257 |
| ADM_LISTA | E-Actualizar Estructuras de Lotes | STRULOT() | P36 | CONTABDSI.PRG:258 |
| ADM_LISTA | F-Distribuir Movimiento Contable x Terceros | TERCE_LOT() | P32, P34 | CONTABDSI.PRG:259 |
| ADM_LISTA | G-Depurar Movimiento Contable | DOBLE_LOT() | P32 | CONTABDSI.PRG:260 |
| ADM_LISTA | H-Extractar x Tipo de Documento+C.C. | ESPE09() | P32 | CONTABDSI.PRG:261 |
| ADM_LISTA | I-Extractar Movimiento Mes Errado | ESPE08(2)     | P32 | CONTABDSI.PRG:262 |
| ADM_LISTA | J-Extractar Lote+Usuario | ESPE08J(1)     | P32 | CONTABDSI.PRG:263 |
| ADM_LISTA | K-Generar Movimiento x Tipo de Documento | TRASLASA(2) | P33 | CONTABDSI.PRG:264 |
| ADM_LISTA | L-Actualizar Nombres de Terceros en Maestro Contable | ACTUNOMA() | P31 | CONTABDSI.PRG:265 |
| ADM_LISTA | M-Enviar Movimiento Mensual Completo a Excel | EXPORMES() | P32 | CONTABDSI.PRG:266 |
| ADM_LISTA | F-Generador Informes | GENINFT() | P15 | CONTABDSI.PRG:268 |
| ADM_LISTA | 1-Cuenta-Documento a Centro de Costo | RECLA01() | P31 | CONTABDSI.PRG:271 |
| ADM_LISTA | 2-Comprobante-Tipo Documento-Tercero | RECLA02() | P31 | CONTABDSI.PRG:272 |
| ADM_LISTA | 3-Centro de Costo x Cuenta | RECLA03() | P31 | CONTABDSI.PRG:273 |
| ADM_LISTA | H-Analisis plan de Ctas x Nivel | ANA_NIVEL() | P03 | CONTABDSI.PRG:275 |
| ADM_LISTA | I-Analisis Movimiento Ctas x Mes | ANA_MOVCTA() | P03 | CONTABDSI.PRG:276 |
| MENU_MOVI | 1-Ingreso y actualización Directa | MOVI2() | P09 | CONTABDSI.PRG:286 |
| MENU_MOVI | 2-Creación o continuación de un Lote | MOVI1() | P08 | CONTABDSI.PRG:287 |
| MENU_MOVI | 3-Anulacion de Documentos | CON900(1) | P13 | CONTABDSI.PRG:288 |
| MENU_MOVI | 4-Cargar Movimiento Contable XLS | CONCARG9(1) | P10 | CONTABDSI.PRG:289 |
| MENU_MOVI | 5-Cargar Movimiento Contable ADT | CONCARG9(2) | P10 | CONTABDSI.PRG:290 |
| MENU_MOVI | 6-Cargar Movimiento Contable x Meses XLS | CONCARG9_MES(1) | P10 | CONTABDSI.PRG:291 |
| MENU_MOVI | 7-Cargar Movimiento Contable TXT | CONCARG9(3) | P10 | CONTABDSI.PRG:292 |
| MENU_MOVI | 8-Cargar Movimiento Contable CSV | CONCARG10(4) | P10 | CONTABDSI.PRG:293 |
| MENU_MOVI | 1-Parametros de Integracion | PARAMS_NOMI() | P11 | CONTABDSI.PRG:296 |
| MENU_MOVI | 2-Nomina | CONCARG9_NOM(1) | P11 | CONTABDSI.PRG:297 |
| MENU_MOVI | 3-Aportes | CONCARG9_NOM(2) | P11 | CONTABDSI.PRG:298 |
| MENU_MOVI | 4-Provisiones | CONCARG9_NOM(3) | P11 | CONTABDSI.PRG:299 |
| MENU_MOVI | A-Reembolsos | REEMBOL01() | P12 | CONTABDSI.PRG:301 |
| MENU_CONSULTA | 1-General x Documentos | CONSULC1() | P14 | CONTABDSI.PRG:311 |
| MENU_CONSULTA | 2-Movimiento Mensual | CONSUL_1() | P14 | CONTABDSI.PRG:312 |
| MENU_CONSULTA | 3-Saldos y Comportamiento Anual | CONSUL_2() | P14 | CONTABDSI.PRG:313 |
| MENU_CONSULTA | 4-Movimientos Anual x Cuenta | CONSUL_3() | P14 | CONTABDSI.PRG:314 |
| MENU_CONSULTA | 5-Movimientos Anual x Tercero | CONSUL_4() | P14 | CONTABDSI.PRG:315 |
| MENU_CONSULTA | 6-Movimientos Anual x Centro de Costo | CONSUL_5() | P14 | CONTABDSI.PRG:316 |
| MENU_CONSULTA | 7-Saldos Cuentas / Centro de Costos | CONSUL_7() | P14 | CONTABDSI.PRG:317 |
| MENU_CONSULTA | 8-Documento Especifico | CONSUL_8() | P14 | CONTABDSI.PRG:318 |
| MENU_CONSULTA | 9-Comparativo de un mes entre 2 contabilidades | CONSULCO() | P14 | CONTABDSI.PRG:319 |
| MENU_CONSULTA | A-Comparativo de C.C. entre 2 contabilidades | CONSULCO2() | P14 | CONTABDSI.PRG:320 |
| MENU_CONSULTA | B-Comparativo de 2 meses en una contabilidad | CONSULME() | P14 | CONTABDSI.PRG:321 |
| MENU_INFOR | 1-Impresion de Documentos x Formato | CONIMP(1) | P21 | CONTABDSI.PRG:333 |
| MENU_INFOR | 2-Impresion de Documentos X Planilla | CONIMP2(1) | P21 | CONTABDSI.PRG:334 |
| MENU_INFOR | 2-Listado de Cuentas | INFOR01() | P15 | CONTABDSI.PRG:336 |
| MENU_INFOR | 1-Acumulado | INFOR02(1) | P15 | CONTABDSI.PRG:339 |
| MENU_INFOR | 2-Mensual | INFOR02(2) | P15 | CONTABDSI.PRG:340 |
| MENU_INFOR | 3-Acumulado Corriente/No Corriente | INFOR02(3) | P15 | CONTABDSI.PRG:341 |
| MENU_INFOR | 1-Libro Auxiliar Gral | INFOR03() | P15 | CONTABDSI.PRG:345 |
| MENU_INFOR | 2-Libro Auxiliar Documento Afectado | INFOR03_2() | P15 | CONTABDSI.PRG:346 |
| MENU_INFOR | 5-Balance General y Estado de Resultados | INFOR04(1) | P15 | CONTABDSI.PRG:348 |
| MENU_INFOR | 1-Acumulacion General | INFOR05(1) | P16, P17 | CONTABDSI.PRG:351 |
| MENU_INFOR | 2-Analisis Acumulados y Certificados | INFOR15(1) | P16, P17 | CONTABDSI.PRG:352 |
| MENU_INFOR | 3-Relacion Acumulados | INFOR152(1) | P16, P17 | CONTABDSI.PRG:353 |
| MENU_INFOR | 4-Relacion Totales x Cuenta | RETECTA(1) | P16, P17 | CONTABDSI.PRG:354 |
| MENU_INFOR | 5-Soportes y Anexos | ANEXIMP(1) | P16, P17 | CONTABDSI.PRG:355 |
| MENU_INFOR | 6-Limpiar Acumulados | LIMACUM(1) | P16, P17 | CONTABDSI.PRG:356 |
| MENU_INFOR | 7-Plano Reporte Anual Retenciones | PLANORETEN() | P16 | CONTABDSI.PRG:357 |
| MENU_INFOR | 8-Carga Manual Cerficados a Portal Empresarial | CARGA_PORTAL() | P23 | CONTABDSI.PRG:358 |
| MENU_INFOR | 1-Acumulacion General | INFOR05(2) | P16, P17 | CONTABDSI.PRG:362 |
| MENU_INFOR | 2-Analisis Acumulados y Certificados | INFOR15(2) | P16, P17 | CONTABDSI.PRG:363 |
| MENU_INFOR | 3-Relacion Acumulados | INFOR152(2) | P16, P17 | CONTABDSI.PRG:364 |
| MENU_INFOR | 4-Relacion Totales x Cuenta | RETECTA(2) | P16, P17 | CONTABDSI.PRG:365 |
| MENU_INFOR | 5-Soportes y Anexos | ANEXIMP(2) | P16, P17 | CONTABDSI.PRG:366 |
| MENU_INFOR | 6-Limpiar Acumulados | LIMACUM(2) | P16, P17 | CONTABDSI.PRG:367 |
| MENU_INFOR | 1-Acumulacion General | INFOR07('T') | P14 | CONTABDSI.PRG:371 |
| MENU_INFOR | 2-Consulta  | INFOR07T(1) | P14 | CONTABDSI.PRG:372 |
| MENU_INFOR | 3-Movimiento Cuenta-Tercero | INFOR07D() | P14 | CONTABDSI.PRG:373 |
| MENU_INFOR | 4-Movimiento Específico x Tercero | INFORT1() | P14 | CONTABDSI.PRG:374 |
| MENU_INFOR | 5-Limpiar Acumulados | LIMACUM(4) | P16, P17 | CONTABDSI.PRG:375 |
| MENU_INFOR | 1-Acumulacion General | INFOR07('C') | P14 | CONTABDSI.PRG:379 |
| MENU_INFOR | 2-Consulta | INFOR07C(2) | P14 | CONTABDSI.PRG:380 |
| MENU_INFOR | 1-Cuenta x Centro de Costo | INFOR09C(1) | P14 | CONTABDSI.PRG:383 |
| MENU_INFOR | 2-Centro de Costo x Cuenta | INFOR09CX(2) | P14 | CONTABDSI.PRG:384 |
| MENU_INFOR | 3-Tercero x Centro de Costo | INFOR09C(3) | P14 | CONTABDSI.PRG:385 |
| MENU_INFOR | 4-Detallado Cuenta x Centro de Costo  | INFOR09D() | P14 | CONTABDSI.PRG:386 |
| MENU_INFOR | 5-Centro de Costo x Cuenta x Columnas (51-52) | INFOR09CX(9) | P14 | CONTABDSI.PRG:387 |
| MENU_INFOR | 4-Limpiar Acumulados | LIMACUM(3) | P16, P17 | CONTABDSI.PRG:389 |
| MENU_INFOR | 5-Consulta acumulada x Nivel | CCTANIVEL() | P14 | CONTABDSI.PRG:390 |
| MENU_INFOR | A-Movimiento x Comprobante | INFOR08(1) | P15 | CONTABDSI.PRG:392 |
| MENU_INFOR | B-Inventario y Balance | INFOR09() | P15 | CONTABDSI.PRG:393 |
| MENU_INFOR | C-Mayor y Balance | INFOR10() | P15 | CONTABDSI.PRG:394 |
| MENU_INFOR | D-Diario x Cuenta | INFOR11() | P15 | CONTABDSI.PRG:395 |
| MENU_INFOR | E-Caja Diario x Comprobante | INFOR12(1) | P15 | CONTABDSI.PRG:396 |
| MENU_INFOR | F-Caja Diario x Cuenta | INFOR12(2) | P15 | CONTABDSI.PRG:397 |
| MENU_INFOR | G-Saldos x Cuenta | INFOR13() | P15 | CONTABDSI.PRG:398 |
| MENU_INFOR | H-Balance Comparativo Mensual | INFOR14() | P15 | CONTABDSI.PRG:399 |
| MENU_INFOR | 1-Acumulado | INFO015(1) | P15 | CONTABDSI.PRG:402 |
| MENU_INFOR | 2-Mensual | INFO015(2) | P15 | CONTABDSI.PRG:403 |
| MENU_INFOR | J-Balance de Prueba Anual | INFOR02(4) | P15 | CONTABDSI.PRG:405 |
| MENU_INFOR | 1-Rangos Continuos | INFOR0K() | P15 | CONTABDSI.PRG:408 |
| MENU_INFOR | 2-Rangos Fijos | INFOR0K2() | P15 | CONTABDSI.PRG:409 |
| MENU_INFOR | 1-Generacion Acumulado | REPRO02(3) | P22 | CONTABDSI.PRG:413 |
| MENU_INFOR | 2-Acumulado | INFOR0L(1) | P15 | CONTABDSI.PRG:414 |
| MENU_INFOR | 3-Mensual | INFOR0L(2) | P15 | CONTABDSI.PRG:415 |
| MENU_INFOR | 4-Clasificando Centros de Costos | INFOR9L(1) | P15 | CONTABDSI.PRG:416 |
| MENU_INFOR | 5-Clasificando Centros de Costos y Tercero | INFOR9L(2) | P15 | CONTABDSI.PRG:417 |
| MENU_INFOR | 6-Discriminando Centros de Costos x Mes | INFOR9L(3) | P15 | CONTABDSI.PRG:418 |
| MENU_INFOR | 1-Definicion de Cuentas | INFORM1() | P15 | CONTABDSI.PRG:422 |
| MENU_INFOR | 2-Generacion Informe | INFORM2() | P15 | CONTABDSI.PRG:423 |
| MENU_INFOR | N-Movimiento x Tipo de Documento | INFOR08(2) | P15 | CONTABDSI.PRG:425 |
| MENU_INFOR | O-Movimiento x Cuenta | INFORO1N() | P15 | CONTABDSI.PRG:426 |
| MENU_INFOR | P-Comparativo Cuentas-Tercero | INFORP1() | P15 | CONTABDSI.PRG:427 |
| MENU_INFOR | Q-Resumen Movimiento x Tipo de Contribuyente | INFORQ1() | P15 | CONTABDSI.PRG:428 |
| MENU_INFOR | 1-Estado de situacion Financiera de Apertura - Convergencia | NICAPER() | P35 | CONTABDSI.PRG:431 |
| MENU_INFOR | 2-Informacion Contable Saldos y Movimientos | NICSALMOV() | P35 | CONTABDSI.PRG:432 |
| MENU_REPRO | 1-Ejecucion Reproceso | REPRO01() | P22 | CONTABDSI.PRG:442 |
| MENU_REPRO | 2-Revalorizacion Movimiento Contable | REPRO02(1) | P22 | CONTABDSI.PRG:443 |
| MENU_REPRO | 3-Analisis Documentos-Movimento Mensual | MOVDOCK(1) | P22 | CONTABDSI.PRG:444 |
| MENU_REPRO | 4-Auditoria Revalorizacion Mensual | REPRO02(5) | P22 | CONTABDSI.PRG:445 |
| MENU_REPRO | 5-Auditoria Movimiento x Cuentas | MOVDOCK_CTA(2) | P22 | CONTABDSI.PRG:446 |
| MENU_REPRO | 6-Auditoria Movimiento y Creacion de Cuentas | MOVDOCK_CRE(2) | P22 | CONTABDSI.PRG:447 |
| MENU_REPRO | 7-Revalorizacion Mensual Movimiento Contable | REPRO027() | P22 | CONTABDSI.PRG:448 |
| MENU_CIERRE | 1-Cierre Anual | CIERR01() | P25 | CONTABDSI.PRG:458 |
| MENU_CIERRE | 2-Generacion Comprobante de Cierre | CIERR02() | P25 | CONTABDSI.PRG:459 |
| MENU_CIERRE | 3-Traslado Meses [13-18] | CIERR03() | P26 | CONTABDSI.PRG:460 |
| MENU_MEDIOS | 1-Mantenimiento Formatos | MEDMAG01() | P19 | CONTABDSI.PRG:470 |
| MENU_MEDIOS | 2-Mantenimiento Conceptos | MEDMAG02() | P19 | CONTABDSI.PRG:471 |
| MENU_MEDIOS | 1-Manual x Plan de Ctas | MEDMAG03() | P19 | CONTABDSI.PRG:474 |
| MENU_MEDIOS | 2-Trayendo Definiciones de Otra Contabilidad | MEDMAG03T() | P19 | CONTABDSI.PRG:475 |
| MENU_MEDIOS | 4-Generar Medios | MEDMAG04() | P20 | CONTABDSI.PRG:477 |
| MENU_MEDIOS | 5-Revision Medios | MEDMAG05() | P20 | CONTABDSI.PRG:478 |
| MENU_MEDIOS | 6-Detalle Medios x Tercero | MEDMAG06() | P20 | CONTABDSI.PRG:479 |
| MENU_MEDIOS | 7-Medios Totales x Tercero | MEDMAG07() | P20 | CONTABDSI.PRG:480 |
| MENU_MEDIOS | 8-Revision Medios Formato x Tercero | MEDMAG08() | P20 | CONTABDSI.PRG:481 |
| MENU_MEDIOS | 9-Medios x Documento | MEDMAG09() | P20 | CONTABDSI.PRG:482 |
| MENU_MEDIOS | A-Depuracion Formatos x Topes | DEPUMAG() | P20 | CONTABDSI.PRG:483 |
| MENU_MEDIOS | B-Depuracion Formatos x Cruce Terceros entre Formatos | DEPUMAGT() | P20 | CONTABDSI.PRG:484 |
| MENU_CONSO | 1-Definicion de Compañias | CCOSTOS(2) | P07, P27 | CONTABDSI.PRG:495 |
| MENU_CONSO | 2-Generar Consolidacion | CONS002() | P27 | CONTABDSI.PRG:496 |
| LISTER1 | 1-General Clientes | LISTERCE() | P05 | CONTAGRAL.PRG:1043 |
| LISTER1 | 2-Cumpleaños | LISTERCU(1) | P05 | CONTAGRAL.PRG:1044 |
| LISTER1 | 3-Profesion | LISTERCU(2) | P05 | CONTAGRAL.PRG:1045 |
