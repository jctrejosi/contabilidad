# Diccionario del esquema funcional depurado

Sólo tablas retenidas. 141 variantes físicas; 3616 campos. Longitud es la informada por Advantage, no precisión SQL. DOUBLE de longitud 8 ocupa 8 bytes; los campos numéricos no deben inferirse como DECIMAL(8,d).

Los campos físicos completos se preservan. Su presencia no acredita uso individual en todas las funciones.

## VISION

Configuración global y rutas del entorno.

Uso: ABREPPAL (VISDBF.PRG:11); ABREDBF2 (VISDBF.PRG:154); ABRE_CONTAB (CONTABDSI.PRG:661).

### C:\VISADS\VISION.ADT

91 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CTCODCIA | CHARACTER | 3 | 0 |
| 2 | CTCIA | CHARACTER | 60 | 0 |
| 3 | CTNIT | CHARACTER | 15 | 0 |
| 4 | CTCIUDAD | CHARACTER | 20 | 0 |
| 5 | CTDIRECC | CHARACTER | 30 | 0 |
| 6 | CTTELEF | CHARACTER | 20 | 0 |
| 7 | CTFCHOY | INTEGER | 4 | 0 |
| 8 | CTNORMAL | CHARACTER | 30 | 0 |
| 9 | CTCOMPRI | CHARACTER | 30 | 0 |
| 10 | CTDOBLE | CHARACTER | 30 | 0 |
| 11 | CTPASS | CHARACTER | 15 | 0 |
| 12 | CTPASSW | CHARACTER | 6 | 0 |
| 13 | CTINIS | CHARACTER | 4 | 0 |
| 14 | CTANO | SHORTINT | 2 | 0 |
| 15 | CTCOLOR1 | DOUBLE | 8 | 0 |
| 16 | CTCOLOR2 | DOUBLE | 8 | 0 |
| 17 | CTCONTAB | CHARACTER | 3 | 0 |
| 18 | CTTIPCON | SHORTINT | 2 | 0 |
| 19 | CTNIVEL | CHARACTER | 1 | 0 |
| 20 | CTTIPDOC | CHARACTER | 2 | 0 |
| 21 | CTTIPCOM | CHARACTER | 2 | 0 |
| 22 | CTCONTROL | CHARACTER | 26 | 0 |
| 23 | CTDIRVIS | CHARACTER | 40 | 0 |
| 24 | CTCONDIR | CHARACTER | 40 | 0 |
| 25 | CTINVDIR | CHARACTER | 40 | 0 |
| 26 | CTFACDIR | CHARACTER | 40 | 0 |
| 27 | CTCARDIR | CHARACTER | 40 | 0 |
| 28 | CTCXPDIR | CHARACTER | 40 | 0 |
| 29 | CTSER1 | CHARACTER | 20 | 0 |
| 30 | CTSER2 | CHARACTER | 20 | 0 |
| 31 | CTLINF | SHORTINT | 2 | 0 |
| 32 | CTLINI | SHORTINT | 2 | 0 |
| 33 | CTLINX | SHORTINT | 2 | 0 |
| 34 | CTLINC | SHORTINT | 2 | 0 |
| 35 | CTMOD | CHARACTER | 10 | 0 |
| 36 | CTCAJON | CHARACTER | 2 | 0 |
| 37 | CTMES13 | LOGICAL | 1 | 0 |
| 38 | CTLOTF | CHARACTER | 2 | 0 |
| 39 | CTLOTI | CHARACTER | 2 | 0 |
| 40 | CTLOTX | CHARACTER | 2 | 0 |
| 41 | CTFTE1 | DOUBLE | 8 | 2 |
| 42 | CTFTE2 | DOUBLE | 8 | 2 |
| 43 | CTFTE3 | DOUBLE | 8 | 2 |
| 44 | CTFTE4 | DOUBLE | 8 | 2 |
| 45 | CTPUERTOS | LOGICAL | 1 | 0 |
| 46 | CXPCONCE | LOGICAL | 1 | 0 |
| 47 | CTLEECON | LOGICAL | 1 | 0 |
| 48 | CTLOTC | CHARACTER | 2 | 0 |
| 49 | EDITOR | CHARACTER | 10 | 0 |
| 50 | CTCONTAB2 | CHARACTER | 3 | 0 |
| 51 | CTCODCIU | CHARACTER | 5 | 0 |
| 52 | CTFUERAL | CHARACTER | 30 | 0 |
| 53 | CRUTAWEB | CHARACTER | 50 | 0 |
| 54 | CTCLUBES | LOGICAL | 1 | 0 |
| 55 | CTBFCH | LOGICAL | 1 | 0 |
| 56 | CTCADUCA | DOUBLE | 8 | 0 |
| 57 | CTOPERAF | LOGICAL | 1 | 0 |
| 58 | CTREMOTO | CHARACTER | 50 | 0 |
| 59 | CTSUCURSAL | CHARACTER | 50 | 0 |
| 60 | CTAUTODOC | LOGICAL | 1 | 0 |
| 61 | CTDATAFONO | LOGICAL | 1 | 0 |
| 62 | MODNIIF | LOGICAL | 1 | 0 |
| 63 | REPLICLI | LOGICAL | 1 | 0 |
| 64 | CTPEDDIR | CHARACTER | 30 | 0 |
| 65 | CTMONEXT | LOGICAL | 1 | 0 |
| 66 | REALNIT | LOGICAL | 1 | 0 |
| 67 | CTTIPOTER | LOGICAL | 1 | 0 |
| 68 | CTOBSERCA | LOGICAL | 1 | 0 |
| 69 | CTCONTA | CHARACTER | 3 | 0 |
| 70 | CTSUCAUDI | CHARACTER | 10 | 0 |
| 71 | CTHORAI | CHARACTER | 4 | 0 |
| 72 | CTHORAF | CHARACTER | 4 | 0 |
| 73 | TIPOTALL | DOUBLE | 8 | 0 |
| 74 | CTPRP | LOGICAL | 1 | 0 |
| 75 | CRUTAREPO | CHARACTER | 100 | 0 |
| 76 | CTORDENL | CHARACTER | 1 | 0 |
| 77 | CTINTDIR | CHARACTER | 50 | 0 |
| 78 | CTOPESUC | LOGICAL | 1 | 0 |
| 79 | CTCODSUC | CHARACTER | 2 | 0 |
| 80 | CTRETITER | LOGICAL | 1 | 0 |
| 81 | CTRUTAFE | CHARACTER | 100 | 0 |
| 82 | CTRUTAPRN | CHARACTER | 100 | 0 |
| 83 | CTPRESOP | CHARACTER | 6 | 0 |
| 84 | CTCONSOP | DOUBLE | 8 | 0 |
| 85 | CTULCONSP | DOUBLE | 8 | 0 |
| 86 | CTFCHSOP | DOUBLE | 8 | 0 |
| 87 | CTLIMISOP | DOUBLE | 8 | 0 |
| 88 | CTREPLISUC | LOGICAL | 1 | 0 |
| 89 | CTREPLIFE | LOGICAL | 1 | 0 |
| 90 | CTRUTAFE1 | CHARACTER | 50 | 0 |
| 91 | CTRUTAFE2 | CISTRING | 50 | 0 |

## CONEMP

Catálogo de contabilidades/empresas.

Uso: CONREASIG (CONTAGRAL.PRG:497); PROCERE (CONTAGRAL.PRG:513); CONSOL12 (DSITAB.PRG:1304).

### C:\VISADS\CONTAB\CONEMP.ADT

6 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | EMPCOD | CHARACTER | 3 | 0 |
| 2 | EMPNOM | CHARACTER | 40 | 0 |
| 3 | EMPNIT | CHARACTER | 12 | 0 |
| 4 | EMPCLAV | CHARACTER | 5 | 0 |
| 5 | REASIGNA | CHARACTER | 1 | 0 |
| 6 | HABILITA | LOGICAL | 1 | 0 |

## CONCTR

Parámetros de operación y configuración histórica de la empresa.

Uso: CONCARG9_NOM (MOVICON.prg:95); INICIO (CONTABDSI.PRG:620); PARAMS (DSITAB.PRG:1358).

### C:\VISADS\CONTAB\CONCTR.ADT

79 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CTCODCIA | SHORTINT | 2 | 0 |
| 2 | CTCIA | CHARACTER | 40 | 0 |
| 3 | CTNIT | CHARACTER | 15 | 0 |
| 4 | CTCIUDAD | CHARACTER | 20 | 0 |
| 5 | CTDIRECC | CHARACTER | 30 | 0 |
| 6 | CTFCINIP | INTEGER | 4 | 0 |
| 7 | CTFCFINP | INTEGER | 4 | 0 |
| 8 | CTFCHOY | INTEGER | 4 | 0 |
| 9 | CTCLAVE1 | CHARACTER | 3 | 0 |
| 10 | CTCLAVE2 | CHARACTER | 3 | 0 |
| 11 | CTFSIS | INTEGER | 4 | 0 |
| 12 | CTCLAVE | CHARACTER | 3 | 0 |
| 13 | CTLLAVE | SHORTINT | 2 | 0 |
| 14 | CTVALDOL | DOUBLE | 8 | 2 |
| 15 | CTCTARES | CHARACTER | 11 | 0 |
| 16 | CTNORMAL | CHARACTER | 30 | 0 |
| 17 | CTCOMPRI | CHARACTER | 30 | 0 |
| 18 | CTDOBLE | CHARACTER | 30 | 0 |
| 19 | CTCLOR1 | CHARACTER | 2 | 0 |
| 20 | CTCLOR2 | CHARACTER | 2 | 0 |
| 21 | CTCLOR3 | CHARACTER | 2 | 0 |
| 22 | CTCLOR4 | CHARACTER | 2 | 0 |
| 23 | CTCTAEL | CHARACTER | 1 | 0 |
| 24 | CTMEM | SHORTINT | 2 | 0 |
| 25 | CTSONIDO | CHARACTER | 1 | 0 |
| 26 | CTDOS | CHARACTER | 8 | 0 |
| 27 | CTDIREC | CHARACTER | 40 | 0 |
| 28 | CTCOPYCIE | SHORTINT | 2 | 0 |
| 29 | CTCOPYACT | SHORTINT | 2 | 0 |
| 30 | CTDDOS | CHARACTER | 2 | 0 |
| 31 | CTPASS | CHARACTER | 15 | 0 |
| 32 | CTRED | CHARACTER | 1 | 0 |
| 33 | CTPUC | CHARACTER | 1 | 0 |
| 34 | CTLEY1 | CHARACTER | 120 | 0 |
| 35 | CTLEY2 | CHARACTER | 120 | 0 |
| 36 | CTLEY3 | CHARACTER | 120 | 0 |
| 37 | CTLEY4 | CHARACTER | 120 | 0 |
| 38 | CTTNIT | SHORTINT | 2 | 0 |
| 39 | COMESES | CHARACTER | 1 | 0 |
| 40 | CTSUPER | CHARACTER | 8 | 0 |
| 41 | CTPASSW | CHARACTER | 8 | 0 |
| 42 | CTINIS | CHARACTER | 4 | 0 |
| 43 | CTBLOFCH | CHARACTER | 1 | 0 |
| 44 | CTSUBCU | CHARACTER | 1 | 0 |
| 45 | CTTOBS | SHORTINT | 2 | 0 |
| 46 | CTCORTE | CHARACTER | 6 | 0 |
| 47 | CTVERDOC | LOGICAL | 1 | 0 |
| 48 | CTCXP | CHARACTER | 30 | 0 |
| 49 | CTNIVEL | CHARACTER | 9 | 0 |
| 50 | CTMESES | CHARACTER | 36 | 0 |
| 51 | CTANO | SHORTINT | 2 | 0 |
| 52 | CTVERTIPO | CHARACTER | 1 | 0 |
| 53 | CTUTERCE | CHARACTER | 1 | 0 |
| 54 | CTCONTROL | CHARACTER | 6 | 0 |
| 55 | CTDOCUM | CHARACTER | 40 | 0 |
| 56 | CTTERDOC | LOGICAL | 1 | 0 |
| 57 | CTCODCIU | CHARACTER | 5 | 0 |
| 58 | CT00 | LOGICAL | 1 | 0 |
| 59 | CT01 | LOGICAL | 1 | 0 |
| 60 | CT02 | LOGICAL | 1 | 0 |
| 61 | CT03 | LOGICAL | 1 | 0 |
| 62 | CT04 | LOGICAL | 1 | 0 |
| 63 | CT05 | LOGICAL | 1 | 0 |
| 64 | CT06 | LOGICAL | 1 | 0 |
| 65 | CT07 | LOGICAL | 1 | 0 |
| 66 | CT08 | LOGICAL | 1 | 0 |
| 67 | CT09 | LOGICAL | 1 | 0 |
| 68 | CT10 | LOGICAL | 1 | 0 |
| 69 | CT11 | LOGICAL | 1 | 0 |
| 70 | CT12 | LOGICAL | 1 | 0 |
| 71 | CTORDENL | DOUBLE | 8 | 0 |
| 72 | CTENIIF | CHARACTER | 10 | 0 |
| 73 | CTLINCER | DOUBLE | 8 | 0 |
| 74 | CTCOMNOM1 | CHARACTER | 2 | 0 |
| 75 | CTDOCNOM1 | CHARACTER | 2 | 0 |
| 76 | CTCOMNOM2 | CHARACTER | 2 | 0 |
| 77 | CTDOCNOM2 | CHARACTER | 2 | 0 |
| 78 | CTCOMNOM3 | CHARACTER | 2 | 0 |
| 79 | CTDOCNOM3 | CHARACTER | 2 | 0 |

## CONPUC

Catálogo base del plan de cuentas.

Uso: GRABAMAES (PLANMAES.PRG:468); CMAEST2 (PLANMAES.PRG:382).

### C:\VISADS\CONTAB\CONPUC.ADT

3 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | MFLAG | CHARACTER | 1 | 0 |
| 3 | MNOMBRE | CHARACTER | 40 | 0 |

## CONMAE

Cuentas, reglas de captura y acumulados generales/por tercero.

Uso: VERSALCOS (PLANMAES.PRG:7); CMAESTRO (PLANMAES.PRG:27); ANA_MOVCTA3 (REPROCES.PRG:74).

### C:\VISADS\CONTAB\CONMAE.adt

127 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | MNOMBRE | CHARACTER | 40 | 0 |
| 4 | MSALDO | DOUBLE | 8 | 2 |
| 5 | MACMDEB01 | DOUBLE | 8 | 2 |
| 6 | MACMCRE01 | DOUBLE | 8 | 2 |
| 7 | MACMDEB02 | DOUBLE | 8 | 2 |
| 8 | MACMCRE02 | DOUBLE | 8 | 2 |
| 9 | MACMDEB03 | DOUBLE | 8 | 2 |
| 10 | MACMCRE03 | DOUBLE | 8 | 2 |
| 11 | MACMCRE04 | DOUBLE | 8 | 2 |
| 12 | MACMDEB04 | DOUBLE | 8 | 2 |
| 13 | MACMDEB05 | DOUBLE | 8 | 2 |
| 14 | MACMCRE05 | DOUBLE | 8 | 2 |
| 15 | MACMDEB06 | DOUBLE | 8 | 2 |
| 16 | MACMCRE06 | DOUBLE | 8 | 2 |
| 17 | MACMDEB07 | DOUBLE | 8 | 2 |
| 18 | MACMCRE07 | DOUBLE | 8 | 2 |
| 19 | MACMDEB08 | DOUBLE | 8 | 2 |
| 20 | MACMCRE08 | DOUBLE | 8 | 2 |
| 21 | MACMDEB09 | DOUBLE | 8 | 2 |
| 22 | MACMCRE09 | DOUBLE | 8 | 2 |
| 23 | MACMDEB10 | DOUBLE | 8 | 2 |
| 24 | MACMCRE10 | DOUBLE | 8 | 2 |
| 25 | MACMDEB11 | DOUBLE | 8 | 2 |
| 26 | MACMCRE11 | DOUBLE | 8 | 2 |
| 27 | MACMCRE12 | DOUBLE | 8 | 2 |
| 28 | MACMDEB12 | DOUBLE | 8 | 2 |
| 29 | MACMCRE13 | DOUBLE | 8 | 2 |
| 30 | MACMDEB13 | DOUBLE | 8 | 2 |
| 31 | MACMCRE14 | DOUBLE | 8 | 2 |
| 32 | MACMDEB14 | DOUBLE | 8 | 2 |
| 33 | MACMCRE15 | DOUBLE | 8 | 2 |
| 34 | MACMDEB15 | DOUBLE | 8 | 2 |
| 35 | MACMCRE16 | DOUBLE | 8 | 2 |
| 36 | MACMDEB16 | DOUBLE | 8 | 2 |
| 37 | MACMCRE17 | DOUBLE | 8 | 2 |
| 38 | MACMDEB17 | DOUBLE | 8 | 2 |
| 39 | MACMCRE18 | DOUBLE | 8 | 2 |
| 40 | MACMDEB18 | DOUBLE | 8 | 2 |
| 41 | MAJUSTE | LOGICAL | 1 | 0 |
| 42 | MCOSTOS | LOGICAL | 1 | 0 |
| 43 | MDISTRICC | LOGICAL | 1 | 0 |
| 44 | MCTAPAGOS | LOGICAL | 1 | 0 |
| 45 | MIVA_RET | CHARACTER | 1 | 0 |
| 46 | PORIVARET | DOUBLE | 8 | 2 |
| 47 | MTC | LOGICAL | 1 | 0 |
| 48 | MCMOVI | LOGICAL | 1 | 0 |
| 49 | SALE | CHARACTER | 1 | 0 |
| 50 | GENERAL | CHARACTER | 29 | 0 |
| 51 | MAPLICAR | DOUBLE | 8 | 2 |
| 52 | MBASER | DOUBLE | 8 | 2 |
| 53 | NITN | CHARACTER | 15 | 0 |
| 54 | FORMATO | CHARACTER | 4 | 0 |
| 55 | CONCEPTO | CHARACTER | 4 | 0 |
| 56 | TIPOMED | SHORTINT | 2 | 0 |
| 57 | VALMED | SHORTINT | 2 | 0 |
| 58 | RENGLON | SHORTINT | 2 | 0 |
| 59 | SUMARES | SHORTINT | 2 | 0 |
| 60 | COSTOI | CHARACTER | 7 | 0 |
| 61 | COSTOF | CHARACTER | 7 | 0 |
| 62 | CTACRUCE | CHARACTER | 12 | 0 |
| 63 | PMED1 | DOUBLE | 8 | 0 |
| 64 | PMED2 | DOUBLE | 8 | 0 |
| 65 | PMED3 | DOUBLE | 8 | 0 |
| 66 | PMED4 | DOUBLE | 8 | 0 |
| 67 | PMED5 | DOUBLE | 8 | 0 |
| 68 | PMED6 | DOUBLE | 8 | 0 |
| 69 | FORMATO2 | CHARACTER | 4 | 0 |
| 70 | CONCEPTO2 | CHARACTER | 4 | 0 |
| 71 | MODCXP | LOGICAL | 1 | 0 |
| 72 | COLBASE | DOUBLE | 8 | 0 |
| 73 | COLIVA | DOUBLE | 8 | 0 |
| 74 | MCOSABC | CHARACTER | 1 | 0 |
| 75 | MSUBCTOS | LOGICAL | 1 | 0 |
| 76 | ESTRUABC | CHARACTER | 21 | 0 |
| 77 | EMPRESA | CHARACTER | 2 | 0 |
| 78 | NEGOCIO | CHARACTER | 2 | 0 |
| 79 | AREA | CHARACTER | 4 | 0 |
| 80 | ECHOECO | CHARACTER | 2 | 0 |
| 81 | TIPONIIF | CHARACTER | 2 | 0 |
| 82 | TRANSFOR | LOGICAL | 1 | 0 |
| 83 | NIVEL | CHARACTER | 2 | 0 |
| 84 | NIIFSALDO | DOUBLE | 8 | 0 |
| 85 | NIIFDEB00 | DOUBLE | 8 | 0 |
| 86 | NIIFCRE00 | DOUBLE | 8 | 0 |
| 87 | NIIFDEB01 | DOUBLE | 8 | 0 |
| 88 | NIIFCRE01 | DOUBLE | 8 | 0 |
| 89 | NIIFDEB02 | DOUBLE | 8 | 0 |
| 90 | NIIFCRE02 | DOUBLE | 8 | 0 |
| 91 | NIIFDEB03 | DOUBLE | 8 | 0 |
| 92 | NIIFCRE03 | DOUBLE | 8 | 0 |
| 93 | NIIFDEB04 | DOUBLE | 8 | 0 |
| 94 | NIIFCRE04 | DOUBLE | 8 | 0 |
| 95 | NIIFDEB05 | DOUBLE | 8 | 0 |
| 96 | NIIFCRE05 | DOUBLE | 8 | 0 |
| 97 | NIIFDEB06 | DOUBLE | 8 | 0 |
| 98 | NIIFCRE06 | DOUBLE | 8 | 0 |
| 99 | NIIFDEB07 | DOUBLE | 8 | 0 |
| 100 | NIIFCRE07 | DOUBLE | 8 | 0 |
| 101 | NIIFDEB08 | DOUBLE | 8 | 0 |
| 102 | NIIFCRE08 | DOUBLE | 8 | 0 |
| 103 | NIIFDEB09 | DOUBLE | 8 | 0 |
| 104 | NIIFCRE09 | DOUBLE | 8 | 0 |
| 105 | NIIFDEB10 | DOUBLE | 8 | 0 |
| 106 | NIIFCRE10 | DOUBLE | 8 | 0 |
| 107 | NIIFDEB11 | DOUBLE | 8 | 0 |
| 108 | NIIFCRE11 | DOUBLE | 8 | 0 |
| 109 | NIIFDEB12 | DOUBLE | 8 | 0 |
| 110 | NIIFCRE12 | DOUBLE | 8 | 0 |
| 111 | MRECURSO | CHARACTER | 2 | 0 |
| 112 | MNOMNIIF | CHARACTER | 50 | 0 |
| 113 | MBLOQUE | CHARACTER | 1 | 0 |
| 114 | REVELA | LOGICAL | 1 | 0 |
| 115 | NIIFDEB13 | DOUBLE | 8 | 0 |
| 116 | NIIFCRE13 | DOUBLE | 8 | 0 |
| 117 | NIIFDEB14 | DOUBLE | 8 | 0 |
| 118 | NIIFCRE14 | DOUBLE | 8 | 0 |
| 119 | NIIFDEB15 | DOUBLE | 8 | 0 |
| 120 | NIIFCRE15 | DOUBLE | 8 | 0 |
| 121 | NIIFDEB16 | DOUBLE | 8 | 0 |
| 122 | NIIFCRE16 | DOUBLE | 8 | 0 |
| 123 | NIIFDEB17 | DOUBLE | 8 | 0 |
| 124 | NIIFCRE17 | DOUBLE | 8 | 0 |
| 125 | NIIFCRE18 | DOUBLE | 8 | 0 |
| 126 | NIIFDEB18 | DOUBLE | 8 | 0 |
| 127 | CTCTABASE | CHARACTER | 10 | 0 |

## VISDOCUM

Tipos documentales, consecutivos y reglas de integración.

Uso: DOCUMVIS (CONTABDSI.PRG:2317); TRAB_DOC (CONTABDSI.PRG:2518); BORRDOV (CONTABDSI.PRG:2806).

### C:\VISADS\CONTAB\VISDOCUM.ADT

69 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 25 | 0 |
| 3 | MODULO | SHORTINT | 2 | 0 |
| 4 | TIPO | CHARACTER | 10 | 0 |
| 5 | CONSE | INTEGER | 4 | 0 |
| 6 | MODICONSE | LOGICAL | 1 | 0 |
| 7 | GMORA | LOGICAL | 1 | 0 |
| 8 | FPAGO | LOGICAL | 1 | 0 |
| 9 | DOCOFI | LOGICAL | 1 | 0 |
| 10 | MODICOS | LOGICAL | 1 | 0 |
| 11 | CONVER | LOGICAL | 1 | 0 |
| 12 | DOCCONVER | CHARACTER | 2 | 0 |
| 13 | VALORA | LOGICAL | 1 | 0 |
| 14 | VLRCOS | LOGICAL | 1 | 0 |
| 15 | TRASLADO | LOGICAL | 1 | 0 |
| 16 | ICXP | LOGICAL | 1 | 0 |
| 17 | ICONTAB | LOGICAL | 1 | 0 |
| 18 | SUGECOS | SHORTINT | 2 | 0 |
| 19 | GRABASAL | LOGICAL | 1 | 0 |
| 20 | REPETI | LOGICAL | 1 | 0 |
| 21 | VLRVTA | SHORTINT | 2 | 0 |
| 22 | NIMP1 | CHARACTER | 25 | 0 |
| 23 | IMP1 | DOUBLE | 8 | 2 |
| 24 | RET1 | DOUBLE | 8 | 2 |
| 25 | NRET1 | CHARACTER | 25 | 0 |
| 26 | RET2 | DOUBLE | 8 | 2 |
| 27 | NRET2 | CHARACTER | 25 | 0 |
| 28 | RET3 | DOUBLE | 8 | 2 |
| 29 | NRET3 | CHARACTER | 25 | 0 |
| 30 | RET4 | DOUBLE | 8 | 2 |
| 31 | NRET4 | CHARACTER | 25 | 0 |
| 32 | NOM01 | CHARACTER | 20 | 0 |
| 33 | DEB01 | CHARACTER | 12 | 0 |
| 34 | CRE01 | CHARACTER | 12 | 0 |
| 35 | NOM02 | CHARACTER | 20 | 0 |
| 36 | DEB02 | CHARACTER | 12 | 0 |
| 37 | CRE02 | CHARACTER | 12 | 0 |
| 38 | NOM03 | CHARACTER | 20 | 0 |
| 39 | DEB03 | CHARACTER | 12 | 0 |
| 40 | CRE03 | CHARACTER | 12 | 0 |
| 41 | NOM04 | CHARACTER | 20 | 0 |
| 42 | DEB04 | CHARACTER | 12 | 0 |
| 43 | CRE04 | CHARACTER | 12 | 0 |
| 44 | NOM05 | CHARACTER | 20 | 0 |
| 45 | DEB05 | CHARACTER | 12 | 0 |
| 46 | CRE05 | CHARACTER | 12 | 0 |
| 47 | NOM06 | CHARACTER | 20 | 0 |
| 48 | DEB06 | CHARACTER | 12 | 0 |
| 49 | CRE06 | CHARACTER | 12 | 0 |
| 50 | NOM07 | CHARACTER | 20 | 0 |
| 51 | DEB07 | CHARACTER | 12 | 0 |
| 52 | CRE07 | CHARACTER | 12 | 0 |
| 53 | NOM08 | CHARACTER | 20 | 0 |
| 54 | DEB08 | CHARACTER | 12 | 0 |
| 55 | CRE08 | CHARACTER | 12 | 0 |
| 56 | DEB09 | CHARACTER | 12 | 0 |
| 57 | CRE09 | CHARACTER | 12 | 0 |
| 58 | COMPRO | CHARACTER | 2 | 0 |
| 59 | BANCOS | LOGICAL | 1 | 0 |
| 60 | CCOSTO | CHARACTER | 5 | 0 |
| 61 | INTERES | DOUBLE | 8 | 2 |
| 62 | ARETEN | LOGICAL | 1 | 0 |
| 63 | AREPITE | LOGICAL | 1 | 0 |
| 64 | MODIIMP | LOGICAL | 1 | 0 |
| 65 | LEETRAS | LOGICAL | 1 | 0 |
| 66 | CXPCONCE | LOGICAL | 1 | 0 |
| 67 | CTRPROVE | LOGICAL | 1 | 0 |
| 68 | DISTRICC | LOGICAL | 1 | 0 |
| 69 | DCTO2 | LOGICAL | 1 | 0 |

### C:\VISADS\VISDOCUM.ADT

87 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 25 | 0 |
| 3 | MODULO | SHORTINT | 2 | 0 |
| 4 | TIPO | CHARACTER | 10 | 0 |
| 5 | CONSE | INTEGER | 4 | 0 |
| 6 | MODICONSE | LOGICAL | 1 | 0 |
| 7 | GMORA | LOGICAL | 1 | 0 |
| 8 | FPAGO | LOGICAL | 1 | 0 |
| 9 | DOCOFI | LOGICAL | 1 | 0 |
| 10 | MODICOS | LOGICAL | 1 | 0 |
| 11 | CONVER | LOGICAL | 1 | 0 |
| 12 | DOCCONVER | CHARACTER | 2 | 0 |
| 13 | VALORA | LOGICAL | 1 | 0 |
| 14 | VLRCOS | LOGICAL | 1 | 0 |
| 15 | TRASLADO | LOGICAL | 1 | 0 |
| 16 | ICXP | LOGICAL | 1 | 0 |
| 17 | ICONTAB | LOGICAL | 1 | 0 |
| 18 | SUGECOS | SHORTINT | 2 | 0 |
| 19 | GRABASAL | LOGICAL | 1 | 0 |
| 20 | REPETI | LOGICAL | 1 | 0 |
| 21 | VLRVTA | SHORTINT | 2 | 0 |
| 22 | NIMP1 | CHARACTER | 25 | 0 |
| 23 | IMP1 | DOUBLE | 8 | 2 |
| 24 | RET1 | DOUBLE | 8 | 2 |
| 25 | NRET1 | CHARACTER | 25 | 0 |
| 26 | RET2 | DOUBLE | 8 | 2 |
| 27 | NRET2 | CHARACTER | 25 | 0 |
| 28 | RET3 | DOUBLE | 8 | 2 |
| 29 | NRET3 | CHARACTER | 25 | 0 |
| 30 | RET4 | DOUBLE | 8 | 2 |
| 31 | NRET4 | CHARACTER | 25 | 0 |
| 32 | NOM01 | CHARACTER | 20 | 0 |
| 33 | DEB01 | CHARACTER | 12 | 0 |
| 34 | CRE01 | CHARACTER | 12 | 0 |
| 35 | NOM02 | CHARACTER | 20 | 0 |
| 36 | DEB02 | CHARACTER | 12 | 0 |
| 37 | CRE02 | CHARACTER | 12 | 0 |
| 38 | NOM03 | CHARACTER | 20 | 0 |
| 39 | DEB03 | CHARACTER | 12 | 0 |
| 40 | CRE03 | CHARACTER | 12 | 0 |
| 41 | NOM04 | CHARACTER | 20 | 0 |
| 42 | DEB04 | CHARACTER | 12 | 0 |
| 43 | CRE04 | CHARACTER | 12 | 0 |
| 44 | NOM05 | CHARACTER | 20 | 0 |
| 45 | DEB05 | CHARACTER | 12 | 0 |
| 46 | CRE05 | CHARACTER | 12 | 0 |
| 47 | NOM06 | CHARACTER | 20 | 0 |
| 48 | DEB06 | CHARACTER | 12 | 0 |
| 49 | CRE06 | CHARACTER | 12 | 0 |
| 50 | NOM07 | CHARACTER | 20 | 0 |
| 51 | DEB07 | CHARACTER | 12 | 0 |
| 52 | CRE07 | CHARACTER | 12 | 0 |
| 53 | NOM08 | CHARACTER | 20 | 0 |
| 54 | DEB08 | CHARACTER | 12 | 0 |
| 55 | CRE08 | CHARACTER | 12 | 0 |
| 56 | DEB09 | CHARACTER | 12 | 0 |
| 57 | CRE09 | CHARACTER | 12 | 0 |
| 58 | COMPRO | CHARACTER | 2 | 0 |
| 59 | BANCOS | LOGICAL | 1 | 0 |
| 60 | CCOSTO | CHARACTER | 5 | 0 |
| 61 | INTERES | DOUBLE | 8 | 2 |
| 62 | ARETEN | LOGICAL | 1 | 0 |
| 63 | AREPITE | LOGICAL | 1 | 0 |
| 64 | MODIIMP | LOGICAL | 1 | 0 |
| 65 | LEETRAS | LOGICAL | 1 | 0 |
| 66 | CXPCONCE | LOGICAL | 1 | 0 |
| 67 | CTRPROVE | LOGICAL | 1 | 0 |
| 68 | DISTRICC | LOGICAL | 1 | 0 |
| 69 | DCTO2 | LOGICAL | 1 | 0 |
| 70 | DOCAFE | LOGICAL | 1 | 0 |
| 71 | BLOLOTE | LOGICAL | 1 | 0 |
| 72 | EXTRALO | LOGICAL | 1 | 0 |
| 73 | VERIIMP | LOGICAL | 1 | 0 |
| 74 | RECON | LOGICAL | 1 | 0 |
| 75 | PREFIJO | CHARACTER | 3 | 0 |
| 76 | AUTORIZA | LOGICAL | 1 | 0 |
| 77 | CEROSCV | LOGICAL | 1 | 0 |
| 78 | FECHADOC | LOGICAL | 1 | 0 |
| 79 | ANULROJO | LOGICAL | 1 | 0 |
| 80 | RUBRO | LOGICAL | 1 | 0 |
| 81 | CLAVE | LOGICAL | 1 | 0 |
| 82 | CLAVE2 | CHARACTER | 10 | 0 |
| 83 | MOVBLOQ | LOGICAL | 1 | 0 |
| 84 | ASISAL | LOGICAL | 1 | 0 |
| 85 | VALDIAN | LOGICAL | 1 | 0 |
| 86 | BODEGA | CHARACTER | 2 | 0 |
| 87 | SGASTOS | LOGICAL | 1 | 0 |

## CONTICOM

Tipos de comprobante contable.

Uso: CCOMPRO (DSITAB.PRG:1597); ODLG_INIT (DSITAB.PRG:1614); CCOMPRO1 (DSITAB.PRG:1630).

### C:\VISADS\CONTAB\CONTICOM.ADT

4 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 30 | 0 |
| 3 | HIST | CHARACTER | 1 | 0 |
| 4 | CTABDES | CHARACTER | 30 | 0 |

## CONTIDOC

Configuración documental de legado; no confundir con la variable WPCONTIDOC.

Uso: VERIFI2 (MOVICON.prg:6096).

### C:\VISADS\CONTAB\CONTIDOC.ADT

8 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 30 | 0 |
| 3 | CONCILIA | CHARACTER | 1 | 0 |
| 4 | HIST | CHARACTER | 1 | 0 |
| 5 | MANEJOC | CHARACTER | 1 | 0 |
| 6 | CONSE | INTEGER | 4 | 0 |
| 7 | LEEDOC | CHARACTER | 1 | 0 |
| 8 | DCOSTO | CHARACTER | 1 | 0 |

## CONDOCUM

Cabeceras de documentos contabilizados.

Uso: CONSCON (CONSULTA.PRG:1806); VERITCON (CONSULTA.PRG:1876); ACTUALIZAR (MOVICON.prg:3205).

### C:\VISADS\CONTAB\CONDOCUM.ADT

10 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | DDOCUM | CHARACTER | 12 | 0 |
| 2 | DDOCUMI | CHARACTER | 12 | 0 |
| 3 | DNIT | CHARACTER | 11 | 0 |
| 4 | DCOMPRO | CHARACTER | 2 | 0 |
| 5 | DTIPODOC | CHARACTER | 2 | 0 |
| 6 | DFECHA | INTEGER | 4 | 0 |
| 7 | DDETALLE | CHARACTER | 50 | 0 |
| 8 | DVALOR | DOUBLE | 8 | 2 |
| 9 | DMODULO | SHORTINT | 2 | 0 |
| 10 | DDOCUM2 | CHARACTER | 12 | 0 |

## CONMOVI

Registro maestro de lotes.

Uso: MOVI1 (MOVICON.prg:3604); INDELOT (MOVICON.prg:3668); MOVI11 (MOVICON.prg:3700).

### C:\VISADS\CONTAB\CONMOVI.ADT

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | LOTE | CHARACTER | 5 | 0 |
| 2 | NOMBRE | CHARACTER | 35 | 0 |
| 3 | MES | CHARACTER | 2 | 0 |
| 4 | ESTADO | CHARACTER | 1 | 0 |
| 5 | USUA_I | CHARACTER | 4 | 0 |
| 6 | USUA_F | CHARACTER | 4 | 0 |
| 7 | FECHA | DATE | 4 | 0 |
| 8 | HORA | CHARACTER | 8 | 0 |
| 9 | HIST | CHARACTER | 1 | 0 |
| 10 | BORRAR | CHARACTER | 1 | 0 |
| 11 | DEBITOS | DOUBLE | 8 | 2 |
| 12 | CREDITOS | DOUBLE | 8 | 2 |
| 13 | ITEMS | INTEGER | 4 | 0 |
| 14 | ARCHOK | CHARACTER | 1 | 0 |

## CONINTER

Plantilla estructural efectiva para crear lotes y archivos de captura.

Uso: INTEACT2 (DSITAB.PRG:282).

### C:\VISADS\CONTAB\CONINTER.ADT

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

## MOVxx

Detalle contable por período (MOV00 a MOV18).

Uso: CONSUL_1 (CONSULTA.PRG:142); DOBLE_LOT (REPROCES.PRG:193); TERCE_LOT2 (REPROCES.PRG:252).

### C:\VISADS\CONTAB\MOV00.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDOCUM2 | CHARACTER | 12 | 0 |
| 9 | TDETALLE | CHARACTER | 105 | 0 |
| 10 | TFECDOC | INTEGER | 4 | 0 |
| 11 | TVALOR | DOUBLE | 8 | 2 |
| 12 | TVALORUS | DOUBLE | 8 | 2 |
| 13 | TBASE | DOUBLE | 8 | 2 |
| 14 | TIVA_RET | CHARACTER | 1 | 0 |
| 15 | TSEC | INTEGER | 4 | 0 |
| 16 | TINCON | SHORTINT | 2 | 0 |
| 17 | TCV | CHARACTER | 1 | 0 |
| 18 | TABMNIT | SHORTINT | 2 | 0 |
| 19 | TESTADO | SHORTINT | 2 | 0 |
| 20 | TARCHI | CHARACTER | 4 | 0 |
| 21 | TSUBCTA | CHARACTER | 4 | 0 |
| 22 | TDATE | INTEGER | 4 | 0 |
| 23 | TTIME | CHARACTER | 8 | 0 |
| 24 | TUSUA | CHARACTER | 4 | 0 |
| 25 | NITN | CHARACTER | 15 | 0 |
| 26 | BORRAR | CHARACTER | 1 | 0 |
| 27 | TSALDO | DOUBLE | 8 | 2 |

### C:\VISADS\CONTAB\mov01.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDOCUM2 | CHARACTER | 12 | 0 |
| 9 | TDETALLE | CHARACTER | 105 | 0 |
| 10 | TFECDOC | INTEGER | 4 | 0 |
| 11 | TVALOR | DOUBLE | 8 | 2 |
| 12 | TVALORUS | DOUBLE | 8 | 2 |
| 13 | TBASE | DOUBLE | 8 | 2 |
| 14 | TIVA_RET | CHARACTER | 1 | 0 |
| 15 | TSEC | INTEGER | 4 | 0 |
| 16 | TINCON | SHORTINT | 2 | 0 |
| 17 | TCV | CHARACTER | 1 | 0 |
| 18 | TABMNIT | SHORTINT | 2 | 0 |
| 19 | TESTADO | SHORTINT | 2 | 0 |
| 20 | TARCHI | CHARACTER | 4 | 0 |
| 21 | TSUBCTA | CHARACTER | 4 | 0 |
| 22 | TDATE | INTEGER | 4 | 0 |
| 23 | TTIME | CHARACTER | 8 | 0 |
| 24 | TUSUA | CHARACTER | 4 | 0 |
| 25 | NITN | CHARACTER | 15 | 0 |
| 26 | BORRAR | CHARACTER | 1 | 0 |
| 27 | TSALDO | DOUBLE | 8 | 2 |

### C:\VISADS\CONTAB\MOV02.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDOCUM2 | CHARACTER | 12 | 0 |
| 9 | TDETALLE | CHARACTER | 105 | 0 |
| 10 | TFECDOC | INTEGER | 4 | 0 |
| 11 | TVALOR | DOUBLE | 8 | 2 |
| 12 | TVALORUS | DOUBLE | 8 | 2 |
| 13 | TBASE | DOUBLE | 8 | 2 |
| 14 | TIVA_RET | CHARACTER | 1 | 0 |
| 15 | TSEC | INTEGER | 4 | 0 |
| 16 | TINCON | SHORTINT | 2 | 0 |
| 17 | TCV | CHARACTER | 1 | 0 |
| 18 | TABMNIT | SHORTINT | 2 | 0 |
| 19 | TESTADO | SHORTINT | 2 | 0 |
| 20 | TARCHI | CHARACTER | 4 | 0 |
| 21 | TSUBCTA | CHARACTER | 4 | 0 |
| 22 | TDATE | INTEGER | 4 | 0 |
| 23 | TTIME | CHARACTER | 8 | 0 |
| 24 | TUSUA | CHARACTER | 4 | 0 |
| 25 | NITN | CHARACTER | 15 | 0 |
| 26 | BORRAR | CHARACTER | 1 | 0 |
| 27 | TSALDO | DOUBLE | 8 | 2 |

### C:\VISADS\CONTAB\MOV03.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDOCUM2 | CHARACTER | 12 | 0 |
| 9 | TDETALLE | CHARACTER | 105 | 0 |
| 10 | TFECDOC | INTEGER | 4 | 0 |
| 11 | TVALOR | DOUBLE | 8 | 2 |
| 12 | TVALORUS | DOUBLE | 8 | 2 |
| 13 | TBASE | DOUBLE | 8 | 2 |
| 14 | TIVA_RET | CHARACTER | 1 | 0 |
| 15 | TSEC | INTEGER | 4 | 0 |
| 16 | TINCON | SHORTINT | 2 | 0 |
| 17 | TCV | CHARACTER | 1 | 0 |
| 18 | TABMNIT | SHORTINT | 2 | 0 |
| 19 | TESTADO | SHORTINT | 2 | 0 |
| 20 | TARCHI | CHARACTER | 4 | 0 |
| 21 | TSUBCTA | CHARACTER | 4 | 0 |
| 22 | TDATE | INTEGER | 4 | 0 |
| 23 | TTIME | CHARACTER | 8 | 0 |
| 24 | TUSUA | CHARACTER | 4 | 0 |
| 25 | NITN | CHARACTER | 15 | 0 |
| 26 | BORRAR | CHARACTER | 1 | 0 |
| 27 | TSALDO | DOUBLE | 8 | 2 |

### C:\VISADS\CONTAB\MOV04.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDOCUM2 | CHARACTER | 12 | 0 |
| 9 | TDETALLE | CHARACTER | 105 | 0 |
| 10 | TFECDOC | INTEGER | 4 | 0 |
| 11 | TVALOR | DOUBLE | 8 | 2 |
| 12 | TVALORUS | DOUBLE | 8 | 2 |
| 13 | TBASE | DOUBLE | 8 | 2 |
| 14 | TIVA_RET | CHARACTER | 1 | 0 |
| 15 | TSEC | INTEGER | 4 | 0 |
| 16 | TINCON | SHORTINT | 2 | 0 |
| 17 | TCV | CHARACTER | 1 | 0 |
| 18 | TABMNIT | SHORTINT | 2 | 0 |
| 19 | TESTADO | SHORTINT | 2 | 0 |
| 20 | TARCHI | CHARACTER | 4 | 0 |
| 21 | TSUBCTA | CHARACTER | 4 | 0 |
| 22 | TDATE | INTEGER | 4 | 0 |
| 23 | TTIME | CHARACTER | 8 | 0 |
| 24 | TUSUA | CHARACTER | 4 | 0 |
| 25 | NITN | CHARACTER | 15 | 0 |
| 26 | BORRAR | CHARACTER | 1 | 0 |
| 27 | TSALDO | DOUBLE | 8 | 2 |

### C:\VISADS\CONTAB\MOV05.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDETALLE | CHARACTER | 105 | 0 |
| 9 | TFECDOC | INTEGER | 4 | 0 |
| 10 | TVALOR | DOUBLE | 8 | 2 |
| 11 | TVALORUS | DOUBLE | 8 | 2 |
| 12 | TBASE | DOUBLE | 8 | 2 |
| 13 | TIVA_RET | CHARACTER | 1 | 0 |
| 14 | TSEC | INTEGER | 4 | 0 |
| 15 | TINCON | SHORTINT | 2 | 0 |
| 16 | TCV | CHARACTER | 1 | 0 |
| 17 | TABMNIT | SHORTINT | 2 | 0 |
| 18 | TESTADO | SHORTINT | 2 | 0 |
| 19 | TARCHI | CHARACTER | 4 | 0 |
| 20 | TSUBCTA | CHARACTER | 4 | 0 |
| 21 | TDATE | INTEGER | 4 | 0 |
| 22 | TTIME | CHARACTER | 8 | 0 |
| 23 | TUSUA | CHARACTER | 4 | 0 |
| 24 | NITN | CHARACTER | 15 | 0 |
| 25 | BORRAR | CHARACTER | 1 | 0 |
| 26 | TSALDO | DOUBLE | 8 | 2 |
| 27 | TDOCUM2 | CHARACTER | 12 | 0 |

### C:\VISADS\CONTAB\MOV06.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDETALLE | CHARACTER | 105 | 0 |
| 9 | TFECDOC | INTEGER | 4 | 0 |
| 10 | TVALOR | DOUBLE | 8 | 2 |
| 11 | TVALORUS | DOUBLE | 8 | 2 |
| 12 | TBASE | DOUBLE | 8 | 2 |
| 13 | TIVA_RET | CHARACTER | 1 | 0 |
| 14 | TSEC | INTEGER | 4 | 0 |
| 15 | TINCON | SHORTINT | 2 | 0 |
| 16 | TCV | CHARACTER | 1 | 0 |
| 17 | TABMNIT | SHORTINT | 2 | 0 |
| 18 | TESTADO | SHORTINT | 2 | 0 |
| 19 | TARCHI | CHARACTER | 4 | 0 |
| 20 | TSUBCTA | CHARACTER | 4 | 0 |
| 21 | TDATE | INTEGER | 4 | 0 |
| 22 | TTIME | CHARACTER | 8 | 0 |
| 23 | TUSUA | CHARACTER | 4 | 0 |
| 24 | NITN | CHARACTER | 15 | 0 |
| 25 | BORRAR | CHARACTER | 1 | 0 |
| 26 | TSALDO | DOUBLE | 8 | 2 |
| 27 | TDOCUM2 | CHARACTER | 12 | 0 |

### C:\VISADS\CONTAB\MOV07.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDETALLE | CHARACTER | 105 | 0 |
| 9 | TFECDOC | INTEGER | 4 | 0 |
| 10 | TVALOR | DOUBLE | 8 | 2 |
| 11 | TVALORUS | DOUBLE | 8 | 2 |
| 12 | TBASE | DOUBLE | 8 | 2 |
| 13 | TIVA_RET | CHARACTER | 1 | 0 |
| 14 | TSEC | INTEGER | 4 | 0 |
| 15 | TINCON | SHORTINT | 2 | 0 |
| 16 | TCV | CHARACTER | 1 | 0 |
| 17 | TABMNIT | SHORTINT | 2 | 0 |
| 18 | TESTADO | SHORTINT | 2 | 0 |
| 19 | TARCHI | CHARACTER | 4 | 0 |
| 20 | TSUBCTA | CHARACTER | 4 | 0 |
| 21 | TDATE | INTEGER | 4 | 0 |
| 22 | TTIME | CHARACTER | 8 | 0 |
| 23 | TUSUA | CHARACTER | 4 | 0 |
| 24 | NITN | CHARACTER | 15 | 0 |
| 25 | BORRAR | CHARACTER | 1 | 0 |
| 26 | TSALDO | DOUBLE | 8 | 2 |
| 27 | TDOCUM2 | CHARACTER | 12 | 0 |

### C:\VISADS\CONTAB\MOV08.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDETALLE | CHARACTER | 105 | 0 |
| 9 | TFECDOC | INTEGER | 4 | 0 |
| 10 | TVALOR | DOUBLE | 8 | 2 |
| 11 | TVALORUS | DOUBLE | 8 | 2 |
| 12 | TBASE | DOUBLE | 8 | 2 |
| 13 | TIVA_RET | CHARACTER | 1 | 0 |
| 14 | TSEC | INTEGER | 4 | 0 |
| 15 | TINCON | SHORTINT | 2 | 0 |
| 16 | TCV | CHARACTER | 1 | 0 |
| 17 | TABMNIT | SHORTINT | 2 | 0 |
| 18 | TESTADO | SHORTINT | 2 | 0 |
| 19 | TARCHI | CHARACTER | 4 | 0 |
| 20 | TSUBCTA | CHARACTER | 4 | 0 |
| 21 | TDATE | INTEGER | 4 | 0 |
| 22 | TTIME | CHARACTER | 8 | 0 |
| 23 | TUSUA | CHARACTER | 4 | 0 |
| 24 | NITN | CHARACTER | 15 | 0 |
| 25 | BORRAR | CHARACTER | 1 | 0 |
| 26 | TSALDO | DOUBLE | 8 | 2 |
| 27 | TDOCUM2 | CHARACTER | 12 | 0 |

### C:\VISADS\CONTAB\MOV09.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDETALLE | CHARACTER | 105 | 0 |
| 9 | TFECDOC | INTEGER | 4 | 0 |
| 10 | TVALOR | DOUBLE | 8 | 2 |
| 11 | TVALORUS | DOUBLE | 8 | 2 |
| 12 | TBASE | DOUBLE | 8 | 2 |
| 13 | TIVA_RET | CHARACTER | 1 | 0 |
| 14 | TSEC | INTEGER | 4 | 0 |
| 15 | TINCON | SHORTINT | 2 | 0 |
| 16 | TCV | CHARACTER | 1 | 0 |
| 17 | TABMNIT | SHORTINT | 2 | 0 |
| 18 | TESTADO | SHORTINT | 2 | 0 |
| 19 | TARCHI | CHARACTER | 4 | 0 |
| 20 | TSUBCTA | CHARACTER | 4 | 0 |
| 21 | TDATE | INTEGER | 4 | 0 |
| 22 | TTIME | CHARACTER | 8 | 0 |
| 23 | TUSUA | CHARACTER | 4 | 0 |
| 24 | NITN | CHARACTER | 15 | 0 |
| 25 | BORRAR | CHARACTER | 1 | 0 |
| 26 | TSALDO | DOUBLE | 8 | 2 |
| 27 | TDOCUM2 | CHARACTER | 12 | 0 |

### C:\VISADS\CONTAB\MOV10.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDETALLE | CHARACTER | 105 | 0 |
| 9 | TFECDOC | INTEGER | 4 | 0 |
| 10 | TVALOR | DOUBLE | 8 | 2 |
| 11 | TVALORUS | DOUBLE | 8 | 2 |
| 12 | TBASE | DOUBLE | 8 | 2 |
| 13 | TIVA_RET | CHARACTER | 1 | 0 |
| 14 | TSEC | INTEGER | 4 | 0 |
| 15 | TINCON | SHORTINT | 2 | 0 |
| 16 | TCV | CHARACTER | 1 | 0 |
| 17 | TABMNIT | SHORTINT | 2 | 0 |
| 18 | TESTADO | SHORTINT | 2 | 0 |
| 19 | TARCHI | CHARACTER | 4 | 0 |
| 20 | TSUBCTA | CHARACTER | 4 | 0 |
| 21 | TDATE | INTEGER | 4 | 0 |
| 22 | TTIME | CHARACTER | 8 | 0 |
| 23 | TUSUA | CHARACTER | 4 | 0 |
| 24 | NITN | CHARACTER | 15 | 0 |
| 25 | BORRAR | CHARACTER | 1 | 0 |
| 26 | TSALDO | DOUBLE | 8 | 2 |
| 27 | TDOCUM2 | CHARACTER | 12 | 0 |

### C:\VISADS\CONTAB\MOV11.ADT

29 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDETALLE | CHARACTER | 105 | 0 |
| 9 | TFECDOC | INTEGER | 4 | 0 |
| 10 | TVALOR | DOUBLE | 8 | 2 |
| 11 | TVALORUS | DOUBLE | 8 | 2 |
| 12 | TBASE | DOUBLE | 8 | 2 |
| 13 | TIVA_RET | CHARACTER | 1 | 0 |
| 14 | TSEC | INTEGER | 4 | 0 |
| 15 | TINCON | SHORTINT | 2 | 0 |
| 16 | TCV | CHARACTER | 1 | 0 |
| 17 | TABMNIT | SHORTINT | 2 | 0 |
| 18 | TESTADO | SHORTINT | 2 | 0 |
| 19 | TARCHI | CHARACTER | 4 | 0 |
| 20 | TSUBCTA | CHARACTER | 4 | 0 |
| 21 | TDATE | INTEGER | 4 | 0 |
| 22 | TTIME | CHARACTER | 8 | 0 |
| 23 | TUSUA | CHARACTER | 4 | 0 |
| 24 | NITN | CHARACTER | 15 | 0 |
| 25 | BORRAR | CHARACTER | 1 | 0 |
| 26 | TSALDO | DOUBLE | 8 | 2 |
| 27 | TDOCUM2 | CHARACTER | 12 | 0 |
| 28 | TTRANSF | CHARACTER | 1 | 0 |
| 29 | TSUBCOS | CHARACTER | 7 | 0 |

### C:\VISADS\CONTAB\MOV12.ADT

29 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDETALLE | CHARACTER | 105 | 0 |
| 9 | TFECDOC | INTEGER | 4 | 0 |
| 10 | TVALOR | DOUBLE | 8 | 2 |
| 11 | TVALORUS | DOUBLE | 8 | 2 |
| 12 | TBASE | DOUBLE | 8 | 2 |
| 13 | TIVA_RET | CHARACTER | 1 | 0 |
| 14 | TSEC | INTEGER | 4 | 0 |
| 15 | TINCON | SHORTINT | 2 | 0 |
| 16 | TCV | CHARACTER | 1 | 0 |
| 17 | TABMNIT | SHORTINT | 2 | 0 |
| 18 | TESTADO | SHORTINT | 2 | 0 |
| 19 | TARCHI | CHARACTER | 4 | 0 |
| 20 | TSUBCTA | CHARACTER | 4 | 0 |
| 21 | TDATE | INTEGER | 4 | 0 |
| 22 | TTIME | CHARACTER | 8 | 0 |
| 23 | TUSUA | CHARACTER | 4 | 0 |
| 24 | NITN | CHARACTER | 15 | 0 |
| 25 | BORRAR | CHARACTER | 1 | 0 |
| 26 | TSALDO | DOUBLE | 8 | 2 |
| 27 | TDOCUM2 | CHARACTER | 12 | 0 |
| 28 | TTRANSF | CHARACTER | 1 | 0 |
| 29 | TSUBCOS | CHARACTER | 7 | 0 |

### C:\VISADS\CONTAB\MOV13.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDETALLE | CHARACTER | 105 | 0 |
| 9 | TFECDOC | INTEGER | 4 | 0 |
| 10 | TVALOR | DOUBLE | 8 | 2 |
| 11 | TVALORUS | DOUBLE | 8 | 2 |
| 12 | TBASE | DOUBLE | 8 | 2 |
| 13 | TIVA_RET | CHARACTER | 1 | 0 |
| 14 | TSEC | INTEGER | 4 | 0 |
| 15 | TINCON | SHORTINT | 2 | 0 |
| 16 | TCV | CHARACTER | 1 | 0 |
| 17 | TABMNIT | SHORTINT | 2 | 0 |
| 18 | TESTADO | SHORTINT | 2 | 0 |
| 19 | TARCHI | CHARACTER | 4 | 0 |
| 20 | TSUBCTA | CHARACTER | 4 | 0 |
| 21 | TDATE | INTEGER | 4 | 0 |
| 22 | TTIME | CHARACTER | 8 | 0 |
| 23 | TUSUA | CHARACTER | 4 | 0 |
| 24 | NITN | CHARACTER | 15 | 0 |
| 25 | BORRAR | CHARACTER | 1 | 0 |
| 26 | TSALDO | DOUBLE | 8 | 2 |
| 27 | TDOCUM2 | CHARACTER | 12 | 0 |

### C:\VISADS\CONTAB\MOV14.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDETALLE | CHARACTER | 105 | 0 |
| 9 | TFECDOC | INTEGER | 4 | 0 |
| 10 | TVALOR | DOUBLE | 8 | 2 |
| 11 | TVALORUS | DOUBLE | 8 | 2 |
| 12 | TBASE | DOUBLE | 8 | 2 |
| 13 | TIVA_RET | CHARACTER | 1 | 0 |
| 14 | TSEC | INTEGER | 4 | 0 |
| 15 | TINCON | SHORTINT | 2 | 0 |
| 16 | TCV | CHARACTER | 1 | 0 |
| 17 | TABMNIT | SHORTINT | 2 | 0 |
| 18 | TESTADO | SHORTINT | 2 | 0 |
| 19 | TARCHI | CHARACTER | 4 | 0 |
| 20 | TSUBCTA | CHARACTER | 4 | 0 |
| 21 | TDATE | INTEGER | 4 | 0 |
| 22 | TTIME | CHARACTER | 8 | 0 |
| 23 | TUSUA | CHARACTER | 4 | 0 |
| 24 | NITN | CHARACTER | 15 | 0 |
| 25 | BORRAR | CHARACTER | 1 | 0 |
| 26 | TSALDO | DOUBLE | 8 | 2 |
| 27 | TDOCUM2 | CHARACTER | 12 | 0 |

### C:\VISADS\CONTAB\MOV15.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDETALLE | CHARACTER | 105 | 0 |
| 9 | TFECDOC | INTEGER | 4 | 0 |
| 10 | TVALOR | DOUBLE | 8 | 2 |
| 11 | TVALORUS | DOUBLE | 8 | 2 |
| 12 | TBASE | DOUBLE | 8 | 2 |
| 13 | TIVA_RET | CHARACTER | 1 | 0 |
| 14 | TSEC | INTEGER | 4 | 0 |
| 15 | TINCON | SHORTINT | 2 | 0 |
| 16 | TCV | CHARACTER | 1 | 0 |
| 17 | TABMNIT | SHORTINT | 2 | 0 |
| 18 | TESTADO | SHORTINT | 2 | 0 |
| 19 | TARCHI | CHARACTER | 4 | 0 |
| 20 | TSUBCTA | CHARACTER | 4 | 0 |
| 21 | TDATE | INTEGER | 4 | 0 |
| 22 | TTIME | CHARACTER | 8 | 0 |
| 23 | TUSUA | CHARACTER | 4 | 0 |
| 24 | NITN | CHARACTER | 15 | 0 |
| 25 | BORRAR | CHARACTER | 1 | 0 |
| 26 | TSALDO | DOUBLE | 8 | 2 |
| 27 | TDOCUM2 | CHARACTER | 12 | 0 |

### C:\VISADS\CONTAB\MOV16.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDETALLE | CHARACTER | 105 | 0 |
| 9 | TFECDOC | INTEGER | 4 | 0 |
| 10 | TVALOR | DOUBLE | 8 | 2 |
| 11 | TVALORUS | DOUBLE | 8 | 2 |
| 12 | TBASE | DOUBLE | 8 | 2 |
| 13 | TIVA_RET | CHARACTER | 1 | 0 |
| 14 | TSEC | INTEGER | 4 | 0 |
| 15 | TINCON | SHORTINT | 2 | 0 |
| 16 | TCV | CHARACTER | 1 | 0 |
| 17 | TABMNIT | SHORTINT | 2 | 0 |
| 18 | TESTADO | SHORTINT | 2 | 0 |
| 19 | TARCHI | CHARACTER | 4 | 0 |
| 20 | TSUBCTA | CHARACTER | 4 | 0 |
| 21 | TDATE | INTEGER | 4 | 0 |
| 22 | TTIME | CHARACTER | 8 | 0 |
| 23 | TUSUA | CHARACTER | 4 | 0 |
| 24 | NITN | CHARACTER | 15 | 0 |
| 25 | BORRAR | CHARACTER | 1 | 0 |
| 26 | TSALDO | DOUBLE | 8 | 2 |
| 27 | TDOCUM2 | CHARACTER | 12 | 0 |

### C:\VISADS\CONTAB\MOV17.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDETALLE | CHARACTER | 105 | 0 |
| 9 | TFECDOC | INTEGER | 4 | 0 |
| 10 | TVALOR | DOUBLE | 8 | 2 |
| 11 | TVALORUS | DOUBLE | 8 | 2 |
| 12 | TBASE | DOUBLE | 8 | 2 |
| 13 | TIVA_RET | CHARACTER | 1 | 0 |
| 14 | TSEC | INTEGER | 4 | 0 |
| 15 | TINCON | SHORTINT | 2 | 0 |
| 16 | TCV | CHARACTER | 1 | 0 |
| 17 | TABMNIT | SHORTINT | 2 | 0 |
| 18 | TESTADO | SHORTINT | 2 | 0 |
| 19 | TARCHI | CHARACTER | 4 | 0 |
| 20 | TSUBCTA | CHARACTER | 4 | 0 |
| 21 | TDATE | INTEGER | 4 | 0 |
| 22 | TTIME | CHARACTER | 8 | 0 |
| 23 | TUSUA | CHARACTER | 4 | 0 |
| 24 | NITN | CHARACTER | 15 | 0 |
| 25 | BORRAR | CHARACTER | 1 | 0 |
| 26 | TSALDO | DOUBLE | 8 | 2 |
| 27 | TDOCUM2 | CHARACTER | 12 | 0 |

### C:\VISADS\CONTAB\MOV18.ADT

27 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | TFECHA | INTEGER | 4 | 0 |
| 4 | TCOMPR | CHARACTER | 6 | 0 |
| 5 | TFASE | CHARACTER | 7 | 0 |
| 6 | TIPODOC | CHARACTER | 2 | 0 |
| 7 | TDOCUM | CHARACTER | 12 | 0 |
| 8 | TDETALLE | CHARACTER | 105 | 0 |
| 9 | TFECDOC | INTEGER | 4 | 0 |
| 10 | TVALOR | DOUBLE | 8 | 2 |
| 11 | TVALORUS | DOUBLE | 8 | 2 |
| 12 | TBASE | DOUBLE | 8 | 2 |
| 13 | TIVA_RET | CHARACTER | 1 | 0 |
| 14 | TSEC | INTEGER | 4 | 0 |
| 15 | TINCON | SHORTINT | 2 | 0 |
| 16 | TCV | CHARACTER | 1 | 0 |
| 17 | TABMNIT | SHORTINT | 2 | 0 |
| 18 | TESTADO | SHORTINT | 2 | 0 |
| 19 | TARCHI | CHARACTER | 4 | 0 |
| 20 | TSUBCTA | CHARACTER | 4 | 0 |
| 21 | TDATE | INTEGER | 4 | 0 |
| 22 | TTIME | CHARACTER | 8 | 0 |
| 23 | TUSUA | CHARACTER | 4 | 0 |
| 24 | NITN | CHARACTER | 15 | 0 |
| 25 | BORRAR | CHARACTER | 1 | 0 |
| 26 | TSALDO | DOUBLE | 8 | 2 |
| 27 | TDOCUM2 | CHARACTER | 12 | 0 |

## MC<lote>

Renglones del lote antes de aplicar la contabilización.

Uso: CONCARG95 (MOVICON.prg:528); CONCARG92 (MOVICON.prg:627); CONCARG93 (MOVICON.prg:782).

### C:\VISADS\CONTAB\MC212 .adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCAA22.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCAAAA.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCDDD .adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCEEEE.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCF0701.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCFFFF.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCGG11.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCHH01.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCHH02.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCHH03.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCKK07.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCKK77.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCNOXX.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCP0101.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCP0201.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCP0401.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCP0501.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCP0601.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCP0701.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCP1101.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCP1201.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCP1701.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCP3001.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCWW33.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

### C:\VISADS\CONTAB\MCWWWW.adt

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | DEBITO | DOUBLE | 8 | 2 |
| 4 | CREDITO | DOUBLE | 8 | 2 |
| 5 | BASE | DOUBLE | 8 | 2 |
| 6 | TFASE | CHARACTER | 7 | 0 |
| 7 | CONCEPTO | CHARACTER | 51 | 0 |
| 8 | TCOMPR | CHARACTER | 2 | 0 |
| 9 | TIPODOC | CHARACTER | 2 | 0 |
| 10 | TFECHA | INTEGER | 4 | 0 |
| 11 | TDOCUM | CHARACTER | 12 | 0 |
| 12 | TINCON | CHARACTER | 1 | 0 |
| 13 | TDOCUM2 | CHARACTER | 12 | 0 |
| 14 | NITN | CHARACTER | 15 | 0 |

## FADCLI

Terceros; estructura compartida con otros módulos y variante local.

Uso: ABREPPAL (VISDBF.PRG:39); CLIENTER (CONTAGRAL.PRG:440); NOMCENT (CONSULTA.PRG:636).

### C:\VISADS\CONTAB\FADCLI.ADT

61 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CCODIGO | CHARACTER | 10 | 0 |
| 2 | CODIGO2 | CHARACTER | 10 | 0 |
| 3 | CDIGITO | CHARACTER | 1 | 0 |
| 4 | CCODCIU | CHARACTER | 5 | 0 |
| 5 | CNOMBRE | CHARACTER | 45 | 0 |
| 6 | CNOM1 | CHARACTER | 20 | 0 |
| 7 | CNOM2 | CHARACTER | 20 | 0 |
| 8 | CAPE1 | CHARACTER | 20 | 0 |
| 9 | CAPE2 | CHARACTER | 20 | 0 |
| 10 | CDIREC | CHARACTER | 25 | 0 |
| 11 | CCIUDAD | CHARACTER | 12 | 0 |
| 12 | CTELEF | CHARACTER | 15 | 0 |
| 13 | CZONA | CHARACTER | 2 | 0 |
| 14 | CEMAIL | CHARACTER | 40 | 0 |
| 15 | CPROPIETAR | CHARACTER | 30 | 0 |
| 16 | CCUPO | DOUBLE | 8 | 2 |
| 17 | CVENDED | CHARACTER | 2 | 0 |
| 18 | CPLAZO | SHORTINT | 2 | 0 |
| 19 | CTIPOCLI | SHORTINT | 2 | 0 |
| 20 | CLISTA | CHARACTER | 1 | 0 |
| 21 | CESTADO | SHORTINT | 2 | 0 |
| 22 | CMOTIVO | CHARACTER | 30 | 0 |
| 23 | CRETEN | SHORTINT | 2 | 0 |
| 24 | CBLOQUE | SHORTINT | 2 | 0 |
| 25 | CPROFESION | CHARACTER | 25 | 0 |
| 26 | CDIROFI | CHARACTER | 25 | 0 |
| 27 | CTELOFI | CHARACTER | 15 | 0 |
| 28 | CCUMPLE | SHORTINT | 2 | 0 |
| 29 | CCONYUGE | CHARACTER | 30 | 0 |
| 30 | CPROFEC | CHARACTER | 25 | 0 |
| 31 | CCUMPLEC | SHORTINT | 2 | 0 |
| 32 | CDIROFIC | CHARACTER | 25 | 0 |
| 33 | CTELOFIC | CHARACTER | 15 | 0 |
| 34 | CTIPEMP | CHARACTER | 2 | 0 |
| 35 | CTIPPAG | CHARACTER | 2 | 0 |
| 36 | CPLAZO1 | SHORTINT | 2 | 0 |
| 37 | CDCTO1 | SHORTINT | 2 | 0 |
| 38 | CPLAZO2 | SHORTINT | 2 | 0 |
| 39 | CDCTO2 | SHORTINT | 2 | 0 |
| 40 | CPLAZO3 | SHORTINT | 2 | 0 |
| 41 | CDCTO3 | SHORTINT | 2 | 0 |
| 42 | CPLAZO4 | SHORTINT | 2 | 0 |
| 43 | CDCTO4 | SHORTINT | 2 | 0 |
| 44 | CPLAZO5 | SHORTINT | 2 | 0 |
| 45 | CDCTO5 | SHORTINT | 2 | 0 |
| 46 | CPLAZO6 | SHORTINT | 2 | 0 |
| 47 | CDCTO6 | SHORTINT | 2 | 0 |
| 48 | CMODIFI | LOGICAL | 1 | 0 |
| 49 | CFACTU | LOGICAL | 1 | 0 |
| 50 | CINVE | LOGICAL | 1 | 0 |
| 51 | CCXP | LOGICAL | 1 | 0 |
| 52 | CDCTOFAC | DOUBLE | 8 | 2 |
| 53 | CCONDICION | CHARACTER | 20 | 0 |
| 54 | CFCHCREA | INTEGER | 4 | 0 |
| 55 | CTIPDOC | CHARACTER | 2 | 0 |
| 56 | CCODBE | CHARACTER | 10 | 0 |
| 57 | CBENEFI | CHARACTER | 50 | 0 |
| 58 | CDIASROT | SHORTINT | 2 | 0 |
| 59 | CSOCIAL | CHARACTER | 45 | 0 |
| 60 | CODICEN | CHARACTER | 13 | 0 |
| 61 | BCOCTA | CHARACTER | 60 | 0 |

### C:\VISADS\FADCLI.ADT

104 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CCODIGO | CHARACTER | 10 | 0 |
| 2 | CODIGO2 | CHARACTER | 10 | 0 |
| 3 | CDIGITO | CHARACTER | 1 | 0 |
| 4 | CCODCIU | CHARACTER | 5 | 0 |
| 5 | CNOMBRE | CHARACTER | 60 | 0 |
| 6 | CNOM1 | CHARACTER | 20 | 0 |
| 7 | CNOM2 | CHARACTER | 20 | 0 |
| 8 | CAPE1 | CHARACTER | 20 | 0 |
| 9 | CAPE2 | CHARACTER | 20 | 0 |
| 10 | CDIREC | CHARACTER | 25 | 0 |
| 11 | CCIUDAD | CHARACTER | 12 | 0 |
| 12 | CTELEF | CHARACTER | 15 | 0 |
| 13 | CZONA | CHARACTER | 2 | 0 |
| 14 | CEMAIL | CHARACTER | 60 | 0 |
| 15 | CPROPIETAR | CHARACTER | 30 | 0 |
| 16 | CCUPO | DOUBLE | 8 | 2 |
| 17 | CVENDED | CHARACTER | 2 | 0 |
| 18 | CPLAZO | SHORTINT | 2 | 0 |
| 19 | CTIPOCLI | SHORTINT | 2 | 0 |
| 20 | CLISTA | CHARACTER | 1 | 0 |
| 21 | CESTADO | SHORTINT | 2 | 0 |
| 22 | CMOTIVO | CHARACTER | 30 | 0 |
| 23 | CRETEN | SHORTINT | 2 | 0 |
| 24 | CBLOQUE | SHORTINT | 2 | 0 |
| 25 | CPROFESION | CHARACTER | 25 | 0 |
| 26 | CDIROFI | CHARACTER | 25 | 0 |
| 27 | CTELOFI | CHARACTER | 15 | 0 |
| 28 | CCUMPLE | SHORTINT | 2 | 0 |
| 29 | CCONYUGE | CHARACTER | 30 | 0 |
| 30 | CPROFEC | CHARACTER | 25 | 0 |
| 31 | CCUMPLEC | SHORTINT | 2 | 0 |
| 32 | CDIROFIC | CHARACTER | 25 | 0 |
| 33 | CTELOFIC | CHARACTER | 15 | 0 |
| 34 | CTIPEMP | CHARACTER | 2 | 0 |
| 35 | CTIPPAG | CHARACTER | 2 | 0 |
| 36 | CPLAZO1 | SHORTINT | 2 | 0 |
| 37 | CDCTO1 | DOUBLE | 8 | 2 |
| 38 | CPLAZO2 | SHORTINT | 2 | 0 |
| 39 | CDCTO2 | DOUBLE | 8 | 2 |
| 40 | CPLAZO3 | SHORTINT | 2 | 0 |
| 41 | CDCTO3 | DOUBLE | 8 | 2 |
| 42 | CPLAZO4 | SHORTINT | 2 | 0 |
| 43 | CDCTO4 | DOUBLE | 8 | 2 |
| 44 | CPLAZO5 | SHORTINT | 2 | 0 |
| 45 | CDCTO5 | DOUBLE | 8 | 2 |
| 46 | CPLAZO6 | SHORTINT | 2 | 0 |
| 47 | CDCTO6 | DOUBLE | 8 | 2 |
| 48 | CMODIFI | LOGICAL | 1 | 0 |
| 49 | CFACTU | LOGICAL | 1 | 0 |
| 50 | CINVE | LOGICAL | 1 | 0 |
| 51 | CCXP | LOGICAL | 1 | 0 |
| 52 | CDCTOFAC | DOUBLE | 8 | 2 |
| 53 | CCONDICION | CHARACTER | 20 | 0 |
| 54 | CFCHCREA | INTEGER | 4 | 0 |
| 55 | CTIPDOC | CHARACTER | 2 | 0 |
| 56 | CCODBE | CHARACTER | 10 | 0 |
| 57 | CBENEFI | CHARACTER | 50 | 0 |
| 58 | CDIASROT | SHORTINT | 2 | 0 |
| 59 | CSOCIAL | CHARACTER | 60 | 0 |
| 60 | CODICEN | CHARACTER | 13 | 0 |
| 61 | BCOCTA | CHARACTER | 60 | 0 |
| 62 | OPELOGIS | LOGICAL | 1 | 0 |
| 63 | VLRLOGIS | DOUBLE | 8 | 2 |
| 64 | PORLOGIS | DOUBLE | 8 | 2 |
| 65 | DEBLOGIS | LOGICAL | 1 | 0 |
| 66 | CSALDO | DOUBLE | 8 | 2 |
| 67 | CNIT | CHARACTER | 11 | 0 |
| 68 | CBANMAIL | LOGICAL | 1 | 0 |
| 69 | CTCIFIN | LOGICAL | 1 | 0 |
| 70 | CCARNET | CHARACTER | 4 | 0 |
| 71 | CDIASMOR | DOUBLE | 8 | 0 |
| 72 | CAUTMORA | CHARACTER | 4 | 0 |
| 73 | CSEXO | CHARACTER | 1 | 0 |
| 74 | CFCHMOD | DOUBLE | 8 | 0 |
| 75 | CCELU | CHARACTER | 20 | 0 |
| 76 | CDIRCORRES | CHARACTER | 50 | 0 |
| 77 | DCTOC1 | DOUBLE | 8 | 0 |
| 78 | DCTOC2 | DOUBLE | 8 | 0 |
| 79 | DCTOC3 | DOUBLE | 8 | 0 |
| 80 | DIASC1 | DOUBLE | 8 | 0 |
| 81 | DIASC2 | DOUBLE | 8 | 0 |
| 82 | DIASC3 | DOUBLE | 8 | 0 |
| 83 | CACTIVI | CHARACTER | 5 | 0 |
| 84 | CFCHACTI | DOUBLE | 8 | 0 |
| 85 | NOVEDAD | MEMO | 9 | 0 |
| 86 | CRETACTI | CHARACTER | 2 | 0 |
| 87 | CEMAILFE | CHARACTER | 60 | 0 |
| 88 | CEMAILFB | CHARACTER | 100 | 0 |
| 89 | CPORRETI | DOUBLE | 8 | 0 |
| 90 | CBASERETI | DOUBLE | 8 | 0 |
| 91 | CMETCOMP | DOUBLE | 8 | 0 |
| 92 | CFCHVIGMC | DOUBLE | 8 | 0 |
| 93 | CPLAENTRE | DOUBLE | 8 | 0 |
| 94 | CFRECUVIS | DOUBLE | 8 | 0 |
| 95 | CDIASEM | CHARACTER | 9 | 0 |
| 96 | CSEMA1 | CHARACTER | 5 | 0 |
| 97 | CSEMA2 | CHARACTER | 5 | 0 |
| 98 | CSEMA3 | CHARACTER | 5 | 0 |
| 99 | CSEMA4 | CHARACTER | 5 | 0 |
| 100 | CTIPCROSS | DOUBLE | 8 | 0 |
| 101 | CINIAGEN | DOUBLE | 8 | 0 |
| 102 | CFRECUVIS2 | DOUBLE | 8 | 0 |
| 103 | CLAT | CHARACTER | 20 | 0 |
| 104 | CLON | CHARACTER | 20 | 0 |

## FADCTAS

Cuentas bancarias asociadas al tercero.

Uso: ADMCUENTA (CONTAGRAL.PRG:3077); GRABACUENTA (CONTAGRAL.PRG:3112).

### C:\VISADS\FADCTAS.ADT

7 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODCLI | CHARACTER | 10 | 0 |
| 2 | CODBANCO | CHARACTER | 9 | 0 |
| 3 | NOMBANCO | CHARACTER | 60 | 0 |
| 4 | TIPOBANCO | CHARACTER | 15 | 0 |
| 5 | NCTABANCO | CHARACTER | 20 | 0 |
| 6 | OBSERBANCO | CISTRING | 100 | 0 |
| 7 | BANPPAL | LOGICAL | 1 | 0 |

## VISTDOC

Tipos de identificación de terceros.

Uso: VERNOM (CONTAGRAL.PRG:982); TDOCOK (CONTAGRAL.PRG:4016); INFOR153X (CONINFOR.PRG:19491).

### C:\VISADS\VISTDOC.ADT

3 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 20 | 0 |
| 3 | SALE | CHARACTER | 1 | 0 |

## CIUDAD

Catálogo de ciudades para las direcciones y validaciones del tercero.

Uso: CIUOK (CONTAGRAL.PRG:3985); CIUDAD (FACTAB.PRG:271).

### C:\VISADS\POS\CIUDAD.ADT

3 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 5 | 0 |
| 2 | NOMBRE | CHARACTER | 30 | 0 |
| 3 | SALE | CHARACTER | 1 | 0 |

## ACTIVIDA

Actividad económica asociada a la ficha del tercero.

Uso: TRAB_CLI2 (CONTAGRAL.PRG:2678); ACTIOK (CONTAGRAL.PRG:3961); CIUDAD (FACTAB.PRG:271).

### C:\VISADS\ACTIVIDA.ADT

4 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 5 | 0 |
| 2 | NOMBRE | CHARACTER | 50 | 0 |
| 3 | SALE | CHARACTER | 1 | 0 |
| 4 | RETCREE | DOUBLE | 8 | 0 |

## CONCECOS

Catálogo y parametrización de centros de costo.

Uso: NOMCENT (CONSULTA.PRG:630); CCOSTOS (DSITAB.PRG:1112); ODLG_INIT1 (DSITAB.PRG:1154).

### C:\VISADS\CONTAB\CONCECOS.ADT

12 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 7 | 0 |
| 2 | NOMBRE | CHARACTER | 30 | 0 |
| 3 | HIST | CHARACTER | 1 | 0 |
| 4 | VALOR | DOUBLE | 8 | 2 |
| 5 | PORCEN | DOUBLE | 8 | 2 |
| 6 | VLRPOR | DOUBLE | 8 | 2 |
| 7 | CODITEM | CHARACTER | 3 | 0 |
| 8 | CUENTA | CHARACTER | 12 | 0 |
| 9 | CONCEPTO | CHARACTER | 30 | 0 |
| 10 | CARPETA | CHARACTER | 20 | 0 |
| 11 | TIPO | SHORTINT | 2 | 0 |
| 12 | HABILITA | LOGICAL | 1 | 0 |

## COCENTRO

Acumulados por cuenta, centro y tercero.

Uso: CCTANIVEL2 (CONSULTA.PRG:55); CONSULCO2A (CONSULTA.PRG:655); INCLU_CC (CONINFOR.PRG:2273).

### C:\VISADS\CONTAB\COCENTRO.ADT

41 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | CENTRO | CHARACTER | 7 | 0 |
| 4 | DEB00 | DOUBLE | 8 | 2 |
| 5 | CRE00 | DOUBLE | 8 | 2 |
| 6 | DEB01 | DOUBLE | 8 | 2 |
| 7 | CRE01 | DOUBLE | 8 | 2 |
| 8 | DEB02 | DOUBLE | 8 | 2 |
| 9 | CRE02 | DOUBLE | 8 | 2 |
| 10 | DEB03 | DOUBLE | 8 | 2 |
| 11 | CRE03 | DOUBLE | 8 | 2 |
| 12 | DEB04 | DOUBLE | 8 | 2 |
| 13 | CRE04 | DOUBLE | 8 | 2 |
| 14 | DEB05 | DOUBLE | 8 | 2 |
| 15 | CRE05 | DOUBLE | 8 | 2 |
| 16 | DEB06 | DOUBLE | 8 | 2 |
| 17 | CRE06 | DOUBLE | 8 | 2 |
| 18 | DEB07 | DOUBLE | 8 | 2 |
| 19 | CRE07 | DOUBLE | 8 | 2 |
| 20 | DEB08 | DOUBLE | 8 | 2 |
| 21 | CRE08 | DOUBLE | 8 | 2 |
| 22 | DEB09 | DOUBLE | 8 | 2 |
| 23 | CRE09 | DOUBLE | 8 | 2 |
| 24 | DEB10 | DOUBLE | 8 | 2 |
| 25 | CRE10 | DOUBLE | 8 | 2 |
| 26 | DEB11 | DOUBLE | 8 | 2 |
| 27 | CRE11 | DOUBLE | 8 | 2 |
| 28 | DEB12 | DOUBLE | 8 | 2 |
| 29 | CRE12 | DOUBLE | 8 | 2 |
| 30 | DEB13 | DOUBLE | 8 | 2 |
| 31 | CRE13 | DOUBLE | 8 | 2 |
| 32 | DEB14 | DOUBLE | 8 | 2 |
| 33 | CRE14 | DOUBLE | 8 | 2 |
| 34 | DEB15 | DOUBLE | 8 | 2 |
| 35 | CRE15 | DOUBLE | 8 | 2 |
| 36 | DEB16 | DOUBLE | 8 | 2 |
| 37 | CRE16 | DOUBLE | 8 | 2 |
| 38 | DEB17 | DOUBLE | 8 | 2 |
| 39 | CRE17 | DOUBLE | 8 | 2 |
| 40 | DEB18 | DOUBLE | 8 | 2 |
| 41 | CRE18 | DOUBLE | 8 | 2 |

## CONMCOS

Tabla auxiliar de cuentas/acumulados para informes de costos.

Uso: INFOR9L (CONINFOR.PRG:22036).

### C:\VISADS\CONTAB\CONMCOS.ADT

61 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | MNOMBRE | CHARACTER | 40 | 0 |
| 4 | MSALDO | DOUBLE | 8 | 2 |
| 5 | MACMDEB01 | DOUBLE | 8 | 2 |
| 6 | MACMCRE01 | DOUBLE | 8 | 2 |
| 7 | MACMDEB02 | DOUBLE | 8 | 2 |
| 8 | MACMCRE02 | DOUBLE | 8 | 2 |
| 9 | MACMDEB03 | DOUBLE | 8 | 2 |
| 10 | MACMCRE03 | DOUBLE | 8 | 2 |
| 11 | MACMCRE04 | DOUBLE | 8 | 2 |
| 12 | MACMDEB04 | DOUBLE | 8 | 2 |
| 13 | MACMDEB05 | DOUBLE | 8 | 2 |
| 14 | MACMCRE05 | DOUBLE | 8 | 2 |
| 15 | MACMDEB06 | DOUBLE | 8 | 2 |
| 16 | MACMCRE06 | DOUBLE | 8 | 2 |
| 17 | MACMDEB07 | DOUBLE | 8 | 2 |
| 18 | MACMCRE07 | DOUBLE | 8 | 2 |
| 19 | MACMDEB08 | DOUBLE | 8 | 2 |
| 20 | MACMCRE08 | DOUBLE | 8 | 2 |
| 21 | MACMDEB09 | DOUBLE | 8 | 2 |
| 22 | MACMCRE09 | DOUBLE | 8 | 2 |
| 23 | MACMDEB10 | DOUBLE | 8 | 2 |
| 24 | MACMCRE10 | DOUBLE | 8 | 2 |
| 25 | MACMDEB11 | DOUBLE | 8 | 2 |
| 26 | MACMCRE11 | DOUBLE | 8 | 2 |
| 27 | MACMCRE12 | DOUBLE | 8 | 2 |
| 28 | MACMDEB12 | DOUBLE | 8 | 2 |
| 29 | MACMCRE13 | DOUBLE | 8 | 2 |
| 30 | MACMDEB13 | DOUBLE | 8 | 2 |
| 31 | MACMCRE14 | DOUBLE | 8 | 2 |
| 32 | MACMDEB14 | DOUBLE | 8 | 2 |
| 33 | MACMCRE15 | DOUBLE | 8 | 2 |
| 34 | MACMDEB15 | DOUBLE | 8 | 2 |
| 35 | MACMCRE16 | DOUBLE | 8 | 2 |
| 36 | MACMDEB16 | DOUBLE | 8 | 2 |
| 37 | MACMCRE17 | DOUBLE | 8 | 2 |
| 38 | MACMDEB17 | DOUBLE | 8 | 2 |
| 39 | MACMCRE18 | DOUBLE | 8 | 2 |
| 40 | MACMDEB18 | DOUBLE | 8 | 2 |
| 41 | MAJUSTE | LOGICAL | 1 | 0 |
| 42 | MCOSTOS | LOGICAL | 1 | 0 |
| 43 | MDISTRICC | LOGICAL | 1 | 0 |
| 44 | MCTAPAGOS | LOGICAL | 1 | 0 |
| 45 | MIVA_RET | CHARACTER | 1 | 0 |
| 46 | PORIVARET | DOUBLE | 8 | 2 |
| 47 | MTC | LOGICAL | 1 | 0 |
| 48 | MCMOVI | LOGICAL | 1 | 0 |
| 49 | SALE | CHARACTER | 1 | 0 |
| 50 | GENERAL | CHARACTER | 29 | 0 |
| 51 | MAPLICAR | DOUBLE | 8 | 2 |
| 52 | MBASER | DOUBLE | 8 | 2 |
| 53 | NITN | CHARACTER | 15 | 0 |
| 54 | FORMATO | CHARACTER | 4 | 0 |
| 55 | CONCEPTO | CHARACTER | 4 | 0 |
| 56 | TIPOMED | SHORTINT | 2 | 0 |
| 57 | VALMED | SHORTINT | 2 | 0 |
| 58 | RENGLON | SHORTINT | 2 | 0 |
| 59 | SUMARES | SHORTINT | 2 | 0 |
| 60 | COSTOI | CHARACTER | 7 | 0 |
| 61 | COSTOF | CHARACTER | 7 | 0 |

## CONTCOS

Tabla auxiliar por cuenta, tercero y centro para informes.

Uso: INFOR9L (CONINFOR.PRG:22036).

### C:\VISADS\CONTAB\CONTCOS.ADT

64 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | TFASE | CHARACTER | 7 | 0 |
| 4 | MNOMBRE | CHARACTER | 40 | 0 |
| 5 | NNOMBRE | CHARACTER | 50 | 0 |
| 6 | TNOMBRE | CHARACTER | 50 | 0 |
| 7 | MSALDO | DOUBLE | 8 | 2 |
| 8 | MACMDEB01 | DOUBLE | 8 | 2 |
| 9 | MACMCRE01 | DOUBLE | 8 | 2 |
| 10 | MACMDEB02 | DOUBLE | 8 | 2 |
| 11 | MACMCRE02 | DOUBLE | 8 | 2 |
| 12 | MACMDEB03 | DOUBLE | 8 | 2 |
| 13 | MACMCRE03 | DOUBLE | 8 | 2 |
| 14 | MACMCRE04 | DOUBLE | 8 | 2 |
| 15 | MACMDEB04 | DOUBLE | 8 | 2 |
| 16 | MACMDEB05 | DOUBLE | 8 | 2 |
| 17 | MACMCRE05 | DOUBLE | 8 | 2 |
| 18 | MACMDEB06 | DOUBLE | 8 | 2 |
| 19 | MACMCRE06 | DOUBLE | 8 | 2 |
| 20 | MACMDEB07 | DOUBLE | 8 | 2 |
| 21 | MACMCRE07 | DOUBLE | 8 | 2 |
| 22 | MACMDEB08 | DOUBLE | 8 | 2 |
| 23 | MACMCRE08 | DOUBLE | 8 | 2 |
| 24 | MACMDEB09 | DOUBLE | 8 | 2 |
| 25 | MACMCRE09 | DOUBLE | 8 | 2 |
| 26 | MACMDEB10 | DOUBLE | 8 | 2 |
| 27 | MACMCRE10 | DOUBLE | 8 | 2 |
| 28 | MACMDEB11 | DOUBLE | 8 | 2 |
| 29 | MACMCRE11 | DOUBLE | 8 | 2 |
| 30 | MACMCRE12 | DOUBLE | 8 | 2 |
| 31 | MACMDEB12 | DOUBLE | 8 | 2 |
| 32 | MACMCRE13 | DOUBLE | 8 | 2 |
| 33 | MACMDEB13 | DOUBLE | 8 | 2 |
| 34 | MACMCRE14 | DOUBLE | 8 | 2 |
| 35 | MACMDEB14 | DOUBLE | 8 | 2 |
| 36 | MACMCRE15 | DOUBLE | 8 | 2 |
| 37 | MACMDEB15 | DOUBLE | 8 | 2 |
| 38 | MACMCRE16 | DOUBLE | 8 | 2 |
| 39 | MACMDEB16 | DOUBLE | 8 | 2 |
| 40 | MACMCRE17 | DOUBLE | 8 | 2 |
| 41 | MACMDEB17 | DOUBLE | 8 | 2 |
| 42 | MACMCRE18 | DOUBLE | 8 | 2 |
| 43 | MACMDEB18 | DOUBLE | 8 | 2 |
| 44 | MAJUSTE | LOGICAL | 1 | 0 |
| 45 | MCOSTOS | LOGICAL | 1 | 0 |
| 46 | MDISTRICC | LOGICAL | 1 | 0 |
| 47 | MCTAPAGOS | LOGICAL | 1 | 0 |
| 48 | MIVA_RET | CHARACTER | 1 | 0 |
| 49 | PORIVARET | DOUBLE | 8 | 2 |
| 50 | MTC | LOGICAL | 1 | 0 |
| 51 | MCMOVI | LOGICAL | 1 | 0 |
| 52 | SALE | CHARACTER | 1 | 0 |
| 53 | GENERAL | CHARACTER | 29 | 0 |
| 54 | MAPLICAR | DOUBLE | 8 | 2 |
| 55 | MBASER | DOUBLE | 8 | 2 |
| 56 | NITN | CHARACTER | 15 | 0 |
| 57 | FORMATO | CHARACTER | 4 | 0 |
| 58 | CONCEPTO | CHARACTER | 4 | 0 |
| 59 | TIPOMED | SHORTINT | 2 | 0 |
| 60 | VALMED | SHORTINT | 2 | 0 |
| 61 | RENGLON | SHORTINT | 2 | 0 |
| 62 | SUMARES | SHORTINT | 2 | 0 |
| 63 | COSTOI | CHARACTER | 7 | 0 |
| 64 | COSTOF | CHARACTER | 7 | 0 |

## CONMAE2

Selección de cuentas por usuario.

Uso: INFOR09CX (CONINFOR.PRG:21228); INFORCIP (DSITAB.PRG:6947).

### C:\VISADS\CONTAB\CONMAE2.ADT

5 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | MNOMBRE | CHARACTER | 40 | 0 |
| 3 | SALE | CHARACTER | 1 | 0 |
| 4 | USUARIO | CHARACTER | 4 | 0 |
| 5 | MCOSTOS | LOGICAL | 1 | 0 |

## CONCECO2

Selección de centros por usuario.

Uso: INFOR09CX (CONINFOR.PRG:21218); INFORTAB (DSITAB.PRG:6764).

### C:\VISADS\CONTAB\CONCECO2.ADT

4 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 7 | 0 |
| 2 | NOMBRE | CHARACTER | 30 | 0 |
| 3 | HIST | CHARACTER | 1 | 0 |
| 4 | USUARIO | CHARACTER | 4 | 0 |

## CONTERCE

Acumulados auxiliares por cuenta/tercero/centro.

Uso: INFOR07T (CONINFOR.PRG:6592); LIMACUMB (CONINFOR.PRG:6049); INFOR71B (CONINFOR.PRG:5298).

### C:\VISADS\CONTAB\CONTERCE.ADT

41 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | DEB00 | DOUBLE | 8 | 2 |
| 4 | CRE00 | DOUBLE | 8 | 2 |
| 5 | DEB01 | DOUBLE | 8 | 2 |
| 6 | CRE01 | DOUBLE | 8 | 2 |
| 7 | DEB02 | DOUBLE | 8 | 2 |
| 8 | CRE02 | DOUBLE | 8 | 2 |
| 9 | DEB03 | DOUBLE | 8 | 2 |
| 10 | CRE03 | DOUBLE | 8 | 2 |
| 11 | DEB04 | DOUBLE | 8 | 2 |
| 12 | CRE04 | DOUBLE | 8 | 2 |
| 13 | DEB05 | DOUBLE | 8 | 2 |
| 14 | CRE05 | DOUBLE | 8 | 2 |
| 15 | DEB06 | DOUBLE | 8 | 2 |
| 16 | CRE06 | DOUBLE | 8 | 2 |
| 17 | DEB07 | DOUBLE | 8 | 2 |
| 18 | CRE07 | DOUBLE | 8 | 2 |
| 19 | DEB08 | DOUBLE | 8 | 2 |
| 20 | CRE08 | DOUBLE | 8 | 2 |
| 21 | DEB09 | DOUBLE | 8 | 2 |
| 22 | CRE09 | DOUBLE | 8 | 2 |
| 23 | DEB10 | DOUBLE | 8 | 2 |
| 24 | CRE10 | DOUBLE | 8 | 2 |
| 25 | DEB11 | DOUBLE | 8 | 2 |
| 26 | CRE11 | DOUBLE | 8 | 2 |
| 27 | DEB12 | DOUBLE | 8 | 2 |
| 28 | CRE12 | DOUBLE | 8 | 2 |
| 29 | DEB13 | DOUBLE | 8 | 2 |
| 30 | CRE13 | DOUBLE | 8 | 2 |
| 31 | DEB14 | DOUBLE | 8 | 2 |
| 32 | CRE14 | DOUBLE | 8 | 2 |
| 33 | DEB15 | DOUBLE | 8 | 2 |
| 34 | CRE15 | DOUBLE | 8 | 2 |
| 35 | DEB16 | DOUBLE | 8 | 2 |
| 36 | CRE16 | DOUBLE | 8 | 2 |
| 37 | DEB17 | DOUBLE | 8 | 2 |
| 38 | CRE17 | DOUBLE | 8 | 2 |
| 39 | DEB18 | DOUBLE | 8 | 2 |
| 40 | CRE18 | DOUBLE | 8 | 2 |
| 41 | CENTRO | CHARACTER | 7 | 0 |

## CONINF1

Configuración de informes contables.

Uso: INFORM1 (CONINFOR.PRG:601); INFORM21 (CONINFOR.PRG:798).

### C:\VISADS\CONTAB\CONINF1.ADT

6 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | NIVEL | CHARACTER | 4 | 0 |
| 2 | CUENTA | CHARACTER | 12 | 0 |
| 3 | NOMBRE | CHARACTER | 30 | 0 |
| 4 | TIPO | CHARACTER | 1 | 0 |
| 5 | PPTO | DOUBLE | 8 | 0 |
| 6 | VLRBASE | LOGICAL | 1 | 0 |

## CONRET

Acumulados de bases y retenciones.

Uso: INFOR15 (CONINFOR.PRG:6901); RETCTA2 (CONINFOR.PRG:18662); INFOR153 (CONINFOR.PRG:18937).

### C:\VISADS\CONTAB\CONRET.ADT

76 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 15 | 0 |
| 3 | BASE01 | DOUBLE | 8 | 2 |
| 4 | VALOR01 | DOUBLE | 8 | 2 |
| 5 | BASE01C | DOUBLE | 8 | 2 |
| 6 | VALOR01C | DOUBLE | 8 | 2 |
| 7 | BASE02 | DOUBLE | 8 | 2 |
| 8 | VALOR02 | DOUBLE | 8 | 2 |
| 9 | BASE02C | DOUBLE | 8 | 2 |
| 10 | VALOR02C | DOUBLE | 8 | 2 |
| 11 | BASE03 | DOUBLE | 8 | 2 |
| 12 | VALOR03 | DOUBLE | 8 | 2 |
| 13 | BASE03C | DOUBLE | 8 | 2 |
| 14 | VALOR03C | DOUBLE | 8 | 2 |
| 15 | BASE04 | DOUBLE | 8 | 2 |
| 16 | VALOR04 | DOUBLE | 8 | 2 |
| 17 | BASE04C | DOUBLE | 8 | 2 |
| 18 | VALOR04C | DOUBLE | 8 | 2 |
| 19 | BASE05 | DOUBLE | 8 | 2 |
| 20 | VALOR05 | DOUBLE | 8 | 2 |
| 21 | BASE05C | DOUBLE | 8 | 2 |
| 22 | VALOR05C | DOUBLE | 8 | 2 |
| 23 | BASE06 | DOUBLE | 8 | 2 |
| 24 | VALOR06 | DOUBLE | 8 | 2 |
| 25 | BASE06C | DOUBLE | 8 | 2 |
| 26 | VALOR06C | DOUBLE | 8 | 2 |
| 27 | BASE07 | DOUBLE | 8 | 2 |
| 28 | VALOR07 | DOUBLE | 8 | 2 |
| 29 | BASE07C | DOUBLE | 8 | 2 |
| 30 | VALOR07C | DOUBLE | 8 | 2 |
| 31 | BASE08 | DOUBLE | 8 | 2 |
| 32 | VALOR08 | DOUBLE | 8 | 2 |
| 33 | BASE08C | DOUBLE | 8 | 2 |
| 34 | VALOR08C | DOUBLE | 8 | 2 |
| 35 | BASE09 | DOUBLE | 8 | 2 |
| 36 | VALOR09 | DOUBLE | 8 | 2 |
| 37 | BASE09C | DOUBLE | 8 | 2 |
| 38 | VALOR09C | DOUBLE | 8 | 2 |
| 39 | BASE10 | DOUBLE | 8 | 2 |
| 40 | VALOR10 | DOUBLE | 8 | 2 |
| 41 | BASE10C | DOUBLE | 8 | 2 |
| 42 | VALOR10C | DOUBLE | 8 | 2 |
| 43 | BASE11 | DOUBLE | 8 | 2 |
| 44 | VALOR11 | DOUBLE | 8 | 2 |
| 45 | BASE11C | DOUBLE | 8 | 2 |
| 46 | VALOR11C | DOUBLE | 8 | 2 |
| 47 | BASE12 | DOUBLE | 8 | 2 |
| 48 | VALOR12 | DOUBLE | 8 | 2 |
| 49 | BASE12C | DOUBLE | 8 | 2 |
| 50 | VALOR12C | DOUBLE | 8 | 2 |
| 51 | CTABASE | CHARACTER | 12 | 0 |
| 52 | BASCO01 | DOUBLE | 8 | 2 |
| 53 | BASCO01C | DOUBLE | 8 | 2 |
| 54 | BASCO02 | DOUBLE | 8 | 2 |
| 55 | BASCO02C | DOUBLE | 8 | 2 |
| 56 | BASCO03 | DOUBLE | 8 | 2 |
| 57 | BASCO03C | DOUBLE | 8 | 2 |
| 58 | BASCO04 | DOUBLE | 8 | 2 |
| 59 | BASCO04C | DOUBLE | 8 | 2 |
| 60 | BASCO05 | DOUBLE | 8 | 2 |
| 61 | BASCO05C | DOUBLE | 8 | 2 |
| 62 | BASCO06 | DOUBLE | 8 | 2 |
| 63 | BASCO06C | DOUBLE | 8 | 2 |
| 64 | BASCO07 | DOUBLE | 8 | 2 |
| 65 | BASCO07C | DOUBLE | 8 | 2 |
| 66 | BASCO08 | DOUBLE | 8 | 2 |
| 67 | BASCO08C | DOUBLE | 8 | 2 |
| 68 | BASCO09 | DOUBLE | 8 | 2 |
| 69 | BASCO09C | DOUBLE | 8 | 2 |
| 70 | BASCO10 | DOUBLE | 8 | 2 |
| 71 | BASCO10C | DOUBLE | 8 | 2 |
| 72 | BASCO11 | DOUBLE | 8 | 2 |
| 73 | BASCO11C | DOUBLE | 8 | 2 |
| 74 | BASCO12 | DOUBLE | 8 | 2 |
| 75 | BASCO12C | DOUBLE | 8 | 2 |
| 76 | CTR | CHARACTER | 1 | 0 |

## CONIVA

Trabajo de informes de IVA.

Uso: INFOR15 (CONINFOR.PRG:6901); RETCTA2 (CONINFOR.PRG:18662); INFOR153 (CONINFOR.PRG:18937).

### C:\VISADS\CONTAB\CONIVA.ADT

11 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NIT | CHARACTER | 11 | 0 |
| 3 | TDOCUM | CHARACTER | 10 | 0 |
| 4 | TFECHA | INTEGER | 4 | 0 |
| 5 | TBASE | DOUBLE | 8 | 2 |
| 6 | TVALOR | DOUBLE | 8 | 2 |
| 7 | TBASEC | DOUBLE | 8 | 2 |
| 8 | TVALORC | DOUBLE | 8 | 2 |
| 9 | NOMBREC | CHARACTER | 30 | 0 |
| 10 | NOMBREN | CHARACTER | 30 | 0 |
| 11 | COIMP | CHARACTER | 1 | 0 |

## CONTIRET

Catálogo de tipos/porcentajes de retención.

Uso: RETES (DSITAB.PRG:1766); ODLG_INIT5 (DSITAB.PRG:1782); RETES1 (DSITAB.PRG:1799).

### C:\VISADS\CONTAB\CONTIRET.ADT

5 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | TIPO | CHARACTER | 1 | 0 |
| 2 | CODIGO | CHARACTER | 2 | 0 |
| 3 | NOMBRE | CHARACTER | 30 | 0 |
| 4 | VLRPOR | DOUBLE | 8 | 2 |
| 5 | HIST | CHARACTER | 1 | 0 |

## CONTIIVA

Catálogo de tipos/porcentajes de IVA.

Uso: IVAS (DSITAB.PRG:1849); ODLG_INIT6 (DSITAB.PRG:1866); IVA1 (DSITAB.PRG:1883).

### C:\VISADS\CONTAB\CONTIIVA.ADT

5 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | TIPO | CHARACTER | 1 | 0 |
| 2 | CODIGO | CHARACTER | 2 | 0 |
| 3 | NOMBRE | CHARACTER | 30 | 0 |
| 4 | VLRPOR | DOUBLE | 8 | 2 |
| 5 | HIST | CHARACTER | 1 | 0 |

## CONRTER

Selección de cuentas y apoyo a informes de terceros.

Uso: INFORT1 (DSITAB.PRG:7129); INFORT1A (DSITAB.PRG:7179); INFTER4 (DSITAB.PRG:7280).

### C:\VISADS\CONTAB\CONRTER.ADT

5 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | NOMBRE | CHARACTER | 40 | 0 |
| 3 | DEBITOS | INTEGER | 4 | 0 |
| 4 | CREDITOS | INTEGER | 4 | 0 |
| 5 | MARCA | CHARACTER | 1 | 0 |

## CONDECLA

Definiciones para declaraciones.

Uso: RENGLONES (DSITAB.PRG:1656); ODLG_INIT3 (DSITAB.PRG:1673); RENGLON1 (DSITAB.PRG:1694).

### C:\VISADS\CONTAB\CONDECLA.ADT

4 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 3 | 0 |
| 2 | NOMBRE | CHARACTER | 60 | 0 |
| 3 | FORMULA | CHARACTER | 1 | 0 |
| 4 | CONCEPTO | CHARACTER | 25 | 0 |

## CONAJUS

Configuración de cuentas para ajustes.

Uso: AJUS02G (DSITAB.PRG:5959).

### C:\VISADS\CONTAB\CONAJUS.ADT

7 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | NOMBRE | CHARACTER | 30 | 0 |
| 3 | AJUSTE | CHARACTER | 12 | 0 |
| 4 | CAJUSTE | CHARACTER | 12 | 0 |
| 5 | AJLLA | SHORTINT | 2 | 0 |
| 6 | AJNOM | CHARACTER | 30 | 0 |
| 7 | AJCOD | CHARACTER | 13 | 0 |

## CONMAG1

Definición de formatos fiscales.

Uso: DETALLE1N (DSITAB.PRG:7861); DETALLE2N (DSITAB.PRG:8032); MEDMAG01 (DSITAB.PRG:2796).

### C:\VISADS\CONTAB\CONMAG1.ADT

20 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODFORMA | CHARACTER | 4 | 0 |
| 2 | NOMFORMA | CHARACTER | 40 | 0 |
| 3 | ELEMENTO | CHARACTER | 10 | 0 |
| 4 | CONCEPTO | LOGICAL | 1 | 0 |
| 5 | TIPODOC | LOGICAL | 1 | 0 |
| 6 | NIT | LOGICAL | 1 | 0 |
| 7 | DIGITO | LOGICAL | 1 | 0 |
| 8 | NOMBRE | LOGICAL | 1 | 0 |
| 9 | DIRECCION | LOGICAL | 1 | 0 |
| 10 | MUNICIPIO | LOGICAL | 1 | 0 |
| 11 | VALOR1 | LOGICAL | 1 | 0 |
| 12 | VALOR2 | LOGICAL | 1 | 0 |
| 13 | PAIS | LOGICAL | 1 | 0 |
| 14 | COMBO1 | CHARACTER | 20 | 0 |
| 15 | COMBO2 | CHARACTER | 20 | 0 |
| 16 | COMBO3 | CHARACTER | 20 | 0 |
| 17 | COMBO4 | CHARACTER | 20 | 0 |
| 18 | COMBO5 | CHARACTER | 20 | 0 |
| 19 | COMBO6 | CHARACTER | 20 | 0 |
| 20 | COMBO7 | CHARACTER | 20 | 0 |

## CONMAG2

Definición de conceptos por formato fiscal.

Uso: MEDMAG02 (DSITAB.PRG:2984); MEDMAG21 (DSITAB.PRG:3123); GRACONCEP (DSITAB.PRG:3200).

### C:\VISADS\CONTAB\CONMAG2.ADT

13 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | FORMATO | CHARACTER | 4 | 0 |
| 2 | CONCEPTO | CHARACTER | 4 | 0 |
| 3 | NOMCONCEP | CHARACTER | 40 | 0 |
| 4 | MONTO | DOUBLE | 8 | 2 |
| 5 | VALOR1 | LOGICAL | 1 | 0 |
| 6 | VALOR2 | LOGICAL | 1 | 0 |
| 7 | COMBO1 | CHARACTER | 20 | 0 |
| 8 | COMBO2 | CHARACTER | 20 | 0 |
| 9 | COMBO3 | CHARACTER | 20 | 0 |
| 10 | COMBO4 | CHARACTER | 20 | 0 |
| 11 | COMBO5 | CHARACTER | 20 | 0 |
| 12 | COMBO6 | CHARACTER | 20 | 0 |
| 13 | COMBO7 | CHARACTER | 20 | 0 |

## CONMAG3

Mapeo de cuentas/rangos a formatos y conceptos fiscales.

Uso: MEDMAG03 (DSITAB.PRG:3266); MEDMAG31PEG (DSITAB.PRG:3316); MEDMAG31A (DSITAB.PRG:3384).

### C:\VISADS\CONTAB\CONMAG3.ADT

23 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CUENTA | CHARACTER | 12 | 0 |
| 2 | FORMATO | CHARACTER | 4 | 0 |
| 3 | CONCEPTO | CHARACTER | 4 | 0 |
| 4 | TIPO | CHARACTER | 1 | 0 |
| 5 | CUENTA2 | CHARACTER | 12 | 0 |
| 6 | TIPOMED | DOUBLE | 8 | 0 |
| 7 | MODCXP | DOUBLE | 8 | 0 |
| 8 | COLVALOR | DOUBLE | 8 | 0 |
| 9 | COLBASE | DOUBLE | 8 | 0 |
| 10 | PMED1 | DOUBLE | 8 | 0 |
| 11 | PMED2 | DOUBLE | 8 | 0 |
| 12 | PMED3 | DOUBLE | 8 | 0 |
| 13 | PMED4 | DOUBLE | 8 | 0 |
| 14 | PMED5 | DOUBLE | 8 | 0 |
| 15 | PMED6 | DOUBLE | 8 | 0 |
| 16 | FORMATO2 | CHARACTER | 4 | 0 |
| 17 | CONCEPTO2 | CHARACTER | 4 | 0 |
| 18 | MOVTIPO | DOUBLE | 8 | 0 |
| 19 | COLUMNA2 | DOUBLE | 8 | 0 |
| 20 | DOCX | CHARACTER | 2 | 0 |
| 21 | NATURAL | LOGICAL | 1 | 0 |
| 22 | DOCX2 | CHARACTER | 2 | 0 |
| 23 | DOCX3 | CHARACTER | 2 | 0 |

## CONMAGIT

Detalle de movimientos para preparación de información fiscal.

Uso: DETAMAG (DSITAB.PRG:4568); DETALLE1 (DSITAB.PRG:4677); DETALLE2 (DSITAB.PRG:4746).

### C:\VISADS\CONTAB\CONMAGIT.ADT

17 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 12 | 0 |
| 2 | FORMATO | CHARACTER | 4 | 0 |
| 3 | CONCEPTO | CHARACTER | 4 | 0 |
| 4 | NIT | CHARACTER | 15 | 0 |
| 5 | TFECHA | INTEGER | 4 | 0 |
| 6 | TCOMPR | CHARACTER | 6 | 0 |
| 7 | TFASE | CHARACTER | 7 | 0 |
| 8 | TIPODOC | CHARACTER | 2 | 0 |
| 9 | TDOCUM | CHARACTER | 12 | 0 |
| 10 | TDOCUM2 | CHARACTER | 12 | 0 |
| 11 | TDETALLE | CHARACTER | 105 | 0 |
| 12 | TFECDOC | INTEGER | 4 | 0 |
| 13 | TVALOR | DOUBLE | 8 | 2 |
| 14 | TVALORUS | DOUBLE | 8 | 2 |
| 15 | TBASE | DOUBLE | 8 | 2 |
| 16 | TIVA_RET | CHARACTER | 1 | 0 |
| 17 | TINCON | SHORTINT | 2 | 0 |

## CONMAGDT

Resultados fiscales acumulados por formato, concepto y tercero.

Uso: MEDMAG05 (DSITAB.PRG:4285); GENERAID (DSITAB.PRG:4335); MEDMAG08 (DSITAB.PRG:4399).

### C:\VISADS\CONTAB\CONMAGDT.ADT

21 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | FORMATO | CHARACTER | 4 | 0 |
| 2 | CONCEPTO | CHARACTER | 4 | 0 |
| 3 | CUENTA | CHARACTER | 12 | 0 |
| 4 | TERCERO | CHARACTER | 15 | 0 |
| 5 | VALOR1 | DOUBLE | 8 | 2 |
| 6 | VALOR2 | DOUBLE | 8 | 2 |
| 7 | DIGITO | CHARACTER | 1 | 0 |
| 8 | SALE | CHARACTER | 1 | 0 |
| 9 | VALOR3 | DOUBLE | 8 | 0 |
| 10 | VALOR4 | DOUBLE | 8 | 0 |
| 11 | VALOR5 | DOUBLE | 8 | 0 |
| 12 | VALOR6 | DOUBLE | 8 | 0 |
| 13 | VALOR7 | DOUBLE | 8 | 0 |
| 14 | VALOR8 | DOUBLE | 8 | 0 |
| 15 | VALOR9 | DOUBLE | 8 | 0 |
| 16 | VALOR10 | DOUBLE | 8 | 0 |
| 17 | VALOR11 | DOUBLE | 8 | 0 |
| 18 | TERCERO2 | CHARACTER | 15 | 0 |
| 19 | MODCXP | LOGICAL | 1 | 0 |
| 20 | COLBASE | DOUBLE | 8 | 0 |
| 21 | COLIVA | DOUBLE | 8 | 0 |

## CONGENF

Definición general de formatos impresos.

Uso: FADGENF (FACTAB.PRG:723); CON123 (CONINFOR.PRG:1121); FORMATO (CONTABDSI.PRG:1275).

### C:\VISADS\CONTAB\CONGENF.ADT

12 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 25 | 0 |
| 3 | AMBIENTE | CHARACTER | 10 | 0 |
| 4 | INICIAL | CHARACTER | 1 | 0 |
| 5 | TAMANO | SHORTINT | 2 | 0 |
| 6 | LIMITES | SHORTINT | 2 | 0 |
| 7 | LIMITEI | SHORTINT | 2 | 0 |
| 8 | CONFIGURA | CHARACTER | 1 | 0 |
| 9 | TOTALIZA | CHARACTER | 1 | 0 |
| 10 | SALE | CHARACTER | 1 | 0 |
| 11 | AUTORIZA | LOGICAL | 1 | 0 |
| 12 | FPREVIEW | LOGICAL | 1 | 0 |

## CONFORMA

Elementos/posiciones de formatos de salida.

Uso: GRAVAFOR (FACTAB.PRG:879); FADGENF2 (FACTAB.PRG:980); CON123 (CONINFOR.PRG:1184).

### C:\VISADS\CONTAB\CONFORMA.ADT

18 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | ARCHI | CHARACTER | 1 | 0 |
| 3 | CAMPO | CHARACTER | 30 | 0 |
| 4 | NOMBRE | CHARACTER | 20 | 0 |
| 5 | LONGITUD | SHORTINT | 2 | 0 |
| 6 | TIPO | CHARACTER | 1 | 0 |
| 7 | IMP | CHARACTER | 1 | 0 |
| 8 | TAMANO | CHARACTER | 1 | 0 |
| 9 | FORMATO | CHARACTER | 14 | 0 |
| 10 | INICIAL | SHORTINT | 2 | 0 |
| 11 | FINAL | SHORTINT | 2 | 0 |
| 12 | FILA | DOUBLE | 8 | 2 |
| 13 | COLUMNA | DOUBLE | 8 | 2 |
| 14 | FILA2 | DOUBLE | 8 | 2 |
| 15 | COLUMNA2 | DOUBLE | 8 | 2 |
| 16 | LEYENDA | CHARACTER | 130 | 0 |
| 17 | FUENTE | DOUBLE | 8 | 0 |
| 18 | TIPOFTE | CHARACTER | 20 | 0 |

## CONFACTU

Elementos/posiciones de formatos de salida.

Uso: GRAVAFOR (FACTAB.PRG:880).

### C:\VISADS\CONTAB\CONFACTU.ADT

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | ARCHI | CHARACTER | 1 | 0 |
| 3 | CAMPO | CHARACTER | 25 | 0 |
| 4 | NOMBRE | CHARACTER | 20 | 0 |
| 5 | LONGITUD | SHORTINT | 2 | 0 |
| 6 | TIPO | CHARACTER | 1 | 0 |
| 7 | IMP | CHARACTER | 1 | 0 |
| 8 | TAMANO | CHARACTER | 1 | 0 |
| 9 | FORMATO | CHARACTER | 14 | 0 |
| 10 | INICIAL | SHORTINT | 2 | 0 |
| 11 | FINAL | SHORTINT | 2 | 0 |
| 12 | FILA | SHORTINT | 2 | 0 |
| 13 | COLUMNA | SHORTINT | 2 | 0 |
| 14 | LEYENDA | CHARACTER | 56 | 0 |

## INFORMES

Tabla de trabajo para generación de informes.

Uso: GENINFT (CONINFOR.PRG:565).

### C:\VISADS\CONTAB\INFORMES.ADT

17 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 3 | 0 |
| 2 | C01 | CHARACTER | 12 | 0 |
| 3 | T01 | DOUBLE | 8 | 1 |
| 4 | B01 | CHARACTER | 10 | 0 |
| 5 | C02 | CHARACTER | 12 | 0 |
| 6 | T02 | DOUBLE | 8 | 1 |
| 7 | B02 | CHARACTER | 10 | 0 |
| 8 | C03 | CHARACTER | 12 | 0 |
| 9 | T03 | DOUBLE | 8 | 1 |
| 10 | B03 | CHARACTER | 10 | 0 |
| 11 | C04 | CHARACTER | 12 | 0 |
| 12 | T04 | DOUBLE | 8 | 1 |
| 13 | B04 | CHARACTER | 10 | 0 |
| 14 | C05 | CHARACTER | 12 | 0 |
| 15 | T05 | DOUBLE | 8 | 1 |
| 16 | B05 | CHARACTER | 10 | 0 |
| 17 | LIN | DOUBLE | 8 | 3 |

## POSINFOR

Plantilla para tablas temporales de consultas e informes.

Uso: CCTANIVEL (CONSULTA.PRG:9).

### C:\VISADS\POSINFOR.ADT

22 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 19 | 0 |
| 2 | NOMBRE | CHARACTER | 60 | 0 |
| 3 | VAL1 | DOUBLE | 8 | 3 |
| 4 | VAL2 | DOUBLE | 8 | 2 |
| 5 | VAL3 | DOUBLE | 8 | 3 |
| 6 | VAL4 | DOUBLE | 8 | 2 |
| 7 | VAL5 | DOUBLE | 8 | 2 |
| 8 | VAL6 | DOUBLE | 8 | 2 |
| 9 | VAL7 | DOUBLE | 8 | 2 |
| 10 | VAL8 | DOUBLE | 8 | 2 |
| 11 | VAL9 | DOUBLE | 8 | 2 |
| 12 | CHR1 | CHARACTER | 10 | 0 |
| 13 | CHR2 | CHARACTER | 10 | 0 |
| 14 | CHR3 | CHARACTER | 80 | 0 |
| 15 | CHR4 | CHARACTER | 15 | 0 |
| 16 | CHR5 | CHARACTER | 20 | 0 |
| 17 | CHR6 | CHARACTER | 20 | 0 |
| 18 | NIVEL | CHARACTER | 7 | 0 |
| 19 | TIPO | CHARACTER | 1 | 0 |
| 20 | NOMBRE2 | CHARACTER | 60 | 0 |
| 21 | MOTIVO | CHARACTER | 200 | 0 |
| 22 | VAL10 | DOUBLE | 8 | 0 |

## XADPDF

Registro de archivos/certificados de proveedores en el portal.

Uso: CARGA_PORTAL2 (CONINFOR.PRG:8507); CARGA_PORTAL3 (CONINFOR.PRG:8602); INFOR16I_PDF (CONINFOR.PRG:8834).

### C:\VISADS\CXP\XADPDF.ADT

4 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 10 | 0 |
| 2 | NOMBRE | CHARACTER | 20 | 0 |
| 3 | FECHA | DOUBLE | 8 | 0 |
| 4 | DESCRIP | CHARACTER | 120 | 0 |

## AFIART

Maestro de activos y valores por período.

Uso: AFISALDO (DSITAB.PRG:496); INFACT2 (CONINFOR.PRG:20945); INFORACT (DSITAB.PRG:6432).

### C:\VISADS\CONTAB\AFIART.ADT

61 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | AFICOD | CHARACTER | 9 | 0 |
| 2 | AFIDES | CHARACTER | 30 | 0 |
| 3 | AFIFCHI | INTEGER | 4 | 0 |
| 4 | AFIFACT | CHARACTER | 10 | 0 |
| 5 | AFIANOS | SHORTINT | 2 | 0 |
| 6 | AFICOSTO | DOUBLE | 8 | 2 |
| 7 | AFINIT | CHARACTER | 15 | 0 |
| 8 | TASA00 | DOUBLE | 8 | 2 |
| 9 | AJA00 | DOUBLE | 8 | 2 |
| 10 | DEP00 | DOUBLE | 8 | 2 |
| 11 | AJD00 | DOUBLE | 8 | 2 |
| 12 | TASA01 | DOUBLE | 8 | 2 |
| 13 | AJA01 | DOUBLE | 8 | 2 |
| 14 | DEP01 | DOUBLE | 8 | 2 |
| 15 | AJD01 | DOUBLE | 8 | 2 |
| 16 | TASA02 | DOUBLE | 8 | 2 |
| 17 | AJA02 | DOUBLE | 8 | 2 |
| 18 | DEP02 | DOUBLE | 8 | 2 |
| 19 | AJD02 | DOUBLE | 8 | 2 |
| 20 | TASA03 | DOUBLE | 8 | 2 |
| 21 | AJA03 | DOUBLE | 8 | 2 |
| 22 | DEP03 | DOUBLE | 8 | 2 |
| 23 | AJD03 | DOUBLE | 8 | 2 |
| 24 | TASA04 | DOUBLE | 8 | 2 |
| 25 | AJA04 | DOUBLE | 8 | 2 |
| 26 | DEP04 | DOUBLE | 8 | 2 |
| 27 | AJD04 | DOUBLE | 8 | 2 |
| 28 | TASA05 | DOUBLE | 8 | 2 |
| 29 | AJA05 | DOUBLE | 8 | 2 |
| 30 | DEP05 | DOUBLE | 8 | 2 |
| 31 | AJD05 | DOUBLE | 8 | 2 |
| 32 | TASA06 | DOUBLE | 8 | 2 |
| 33 | AJA06 | DOUBLE | 8 | 2 |
| 34 | DEP06 | DOUBLE | 8 | 2 |
| 35 | AJD06 | DOUBLE | 8 | 2 |
| 36 | TASA07 | DOUBLE | 8 | 2 |
| 37 | AJA07 | DOUBLE | 8 | 2 |
| 38 | DEP07 | DOUBLE | 8 | 2 |
| 39 | AJD07 | DOUBLE | 8 | 2 |
| 40 | TASA08 | DOUBLE | 8 | 2 |
| 41 | AJA08 | DOUBLE | 8 | 2 |
| 42 | DEP08 | DOUBLE | 8 | 2 |
| 43 | AJD08 | DOUBLE | 8 | 2 |
| 44 | TASA09 | DOUBLE | 8 | 2 |
| 45 | AJA09 | DOUBLE | 8 | 2 |
| 46 | DEP09 | DOUBLE | 8 | 2 |
| 47 | AJD09 | DOUBLE | 8 | 2 |
| 48 | TASA10 | DOUBLE | 8 | 2 |
| 49 | AJA10 | DOUBLE | 8 | 2 |
| 50 | DEP10 | DOUBLE | 8 | 2 |
| 51 | AJD10 | DOUBLE | 8 | 2 |
| 52 | TASA11 | DOUBLE | 8 | 2 |
| 53 | AJA11 | DOUBLE | 8 | 2 |
| 54 | DEP11 | DOUBLE | 8 | 2 |
| 55 | AJD11 | DOUBLE | 8 | 2 |
| 56 | TASA12 | DOUBLE | 8 | 2 |
| 57 | AJA12 | DOUBLE | 8 | 2 |
| 58 | DEP12 | DOUBLE | 8 | 2 |
| 59 | AJD12 | DOUBLE | 8 | 2 |
| 60 | BAJA | CHARACTER | 1 | 0 |
| 61 | AJUSTA | CHARACTER | 1 | 0 |

## AFITAB

Cuentas de ajuste/depreciación de activos.

Uso: CONSULFS (DSITAB.PRG:973); INFACT2 (CONINFOR.PRG:20951); INTEACT3 (DSITAB.PRG:357).

### C:\VISADS\CONTAB\AFITAB.ADT

9 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 4 | 0 |
| 2 | NOMBRE | CHARACTER | 30 | 0 |
| 3 | DEBAJA | CHARACTER | 14 | 0 |
| 4 | CREAJA | CHARACTER | 14 | 0 |
| 5 | DEBDEP | CHARACTER | 14 | 0 |
| 6 | CREDEP | CHARACTER | 14 | 0 |
| 7 | DEBAJD | CHARACTER | 14 | 0 |
| 8 | CREAJD | CHARACTER | 14 | 0 |
| 9 | CCOSTO | CHARACTER | 4 | 0 |

## AFITAB2

Distribución de activo por centro.

Uso: INTEACT3 (DSITAB.PRG:389).

### C:\VISADS\CONTAB\AFITAB2.ADT

4 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 9 | 0 |
| 2 | CENTRO | CHARACTER | 7 | 0 |
| 3 | PORCE | DOUBLE | 8 | 2 |
| 4 | VALOR | DOUBLE | 8 | 2 |

## AMORART

Maestro amortizable y valores por período.

Uso: INTEACT3 (DSITAB.PRG:420); INFORAMO (DSITAB.PRG:6589).

### C:\VISADS\CONTAB\AMORART.ADT

61 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | AMOCOD | CHARACTER | 9 | 0 |
| 2 | AMODES | CHARACTER | 30 | 0 |
| 3 | AMOFCHI | INTEGER | 4 | 0 |
| 4 | AMOFACT | CHARACTER | 10 | 0 |
| 5 | AMOANOS | SHORTINT | 2 | 0 |
| 6 | AMOCOSTO | DOUBLE | 8 | 2 |
| 7 | AMONIT | CHARACTER | 15 | 0 |
| 8 | TASA00 | DOUBLE | 8 | 2 |
| 9 | AJA00 | DOUBLE | 8 | 2 |
| 10 | AMOR00 | DOUBLE | 8 | 2 |
| 11 | AJM00 | DOUBLE | 8 | 2 |
| 12 | TASA01 | DOUBLE | 8 | 2 |
| 13 | AJA01 | DOUBLE | 8 | 2 |
| 14 | AMOR01 | DOUBLE | 8 | 2 |
| 15 | AJM01 | DOUBLE | 8 | 2 |
| 16 | TASA02 | DOUBLE | 8 | 2 |
| 17 | AJA02 | DOUBLE | 8 | 2 |
| 18 | AMOR02 | DOUBLE | 8 | 2 |
| 19 | AJM02 | DOUBLE | 8 | 2 |
| 20 | TASA03 | DOUBLE | 8 | 2 |
| 21 | AJA03 | DOUBLE | 8 | 2 |
| 22 | AMOR03 | DOUBLE | 8 | 2 |
| 23 | AJM03 | DOUBLE | 8 | 2 |
| 24 | TASA04 | DOUBLE | 8 | 2 |
| 25 | AJA04 | DOUBLE | 8 | 2 |
| 26 | AMOR04 | DOUBLE | 8 | 2 |
| 27 | AJM04 | DOUBLE | 8 | 2 |
| 28 | TASA05 | DOUBLE | 8 | 2 |
| 29 | AJA05 | DOUBLE | 8 | 2 |
| 30 | AMOR05 | DOUBLE | 8 | 2 |
| 31 | AJM05 | DOUBLE | 8 | 2 |
| 32 | TASA06 | DOUBLE | 8 | 2 |
| 33 | AJA06 | DOUBLE | 8 | 2 |
| 34 | AMOR06 | DOUBLE | 8 | 2 |
| 35 | AJM06 | DOUBLE | 8 | 2 |
| 36 | TASA07 | DOUBLE | 8 | 2 |
| 37 | AJA07 | DOUBLE | 8 | 2 |
| 38 | AMOR07 | DOUBLE | 8 | 2 |
| 39 | AJM07 | DOUBLE | 8 | 2 |
| 40 | TASA08 | DOUBLE | 8 | 2 |
| 41 | AJA08 | DOUBLE | 8 | 2 |
| 42 | AMOR08 | DOUBLE | 8 | 2 |
| 43 | AJM08 | DOUBLE | 8 | 2 |
| 44 | TASA09 | DOUBLE | 8 | 2 |
| 45 | AJA09 | DOUBLE | 8 | 2 |
| 46 | AMOR09 | DOUBLE | 8 | 2 |
| 47 | AJM09 | DOUBLE | 8 | 2 |
| 48 | TASA10 | DOUBLE | 8 | 2 |
| 49 | AJA10 | DOUBLE | 8 | 2 |
| 50 | AMOR10 | DOUBLE | 8 | 2 |
| 51 | AJM10 | DOUBLE | 8 | 2 |
| 52 | TASA11 | DOUBLE | 8 | 2 |
| 53 | AJA11 | DOUBLE | 8 | 2 |
| 54 | AMOR11 | DOUBLE | 8 | 2 |
| 55 | AJM11 | DOUBLE | 8 | 2 |
| 56 | TASA12 | DOUBLE | 8 | 2 |
| 57 | AJA12 | DOUBLE | 8 | 2 |
| 58 | AMOR12 | DOUBLE | 8 | 2 |
| 59 | AJM12 | DOUBLE | 8 | 2 |
| 60 | BAJA | CHARACTER | 1 | 0 |
| 61 | AJUSTA | LOGICAL | 1 | 0 |

## AMORTAB

Cuentas para amortizaciones y ajustes.

Uso: CONSULFS (DSITAB.PRG:973); INFACT2 (CONINFOR.PRG:20951); ACTIGRA (DSITAB.PRG:864).

### C:\VISADS\CONTAB\AMORTAB.ADT

9 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 4 | 0 |
| 2 | NOMBRE | CHARACTER | 30 | 0 |
| 3 | DEBAJA | CHARACTER | 12 | 0 |
| 4 | CREAJA | CHARACTER | 12 | 0 |
| 5 | DEBDEP | CHARACTER | 12 | 0 |
| 6 | CREDEP | CHARACTER | 12 | 0 |
| 7 | DEBAJD | CHARACTER | 12 | 0 |
| 8 | CREAJD | CHARACTER | 12 | 0 |
| 9 | CCOSTO | CHARACTER | 7 | 0 |

## AMORTAB2

Distribución de amortizables por centro.

Uso: INTEACT3 (DSITAB.PRG:466).

### C:\VISADS\CONTAB\AMORTAB2.ADT

4 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 9 | 0 |
| 2 | CENTRO | CHARACTER | 7 | 0 |
| 3 | PORCE | DOUBLE | 8 | 2 |
| 4 | VALOR | DOUBLE | 8 | 2 |

## CONSOLID

Configuración/trabajo de consolidación.

Uso: CCOSTOS (DSITAB.PRG:1135); ODLG_INIT2 (DSITAB.PRG:1166); CONS002 (REPROCES.PRG:6321).

### C:\VISADS\CONTAB\CONSOLID.ADT

4 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 3 | 0 |
| 2 | NOMBRE | CHARACTER | 30 | 0 |
| 3 | HIST | CHARACTER | 1 | 0 |
| 4 | VALOR | DOUBLE | 8 | 2 |

## CONREMAE

Cabecera de reembolso; estructura física no localizada en la muestra.

Uso: ACTU_LOTRE (MOVICON.prg:7389); GRABAREEM (MOVICON.prg:7693); CONTAB_REEM (MOVICON.prg:7872).

Estructura física no verificada. Campos por uso en código: `RMLOTE`, `RMCODCON`, `RMFECHA`, `RMVLRTOT`, `RMCONCEP`, `RMTDOCUM`, `RMTCOMPR`, `RMACTU`.

## CONREITE

Renglones del reembolso; estructura física no localizada en la muestra.

Uso: REEMBOL01 (MOVICON.prg:7345).

Estructura física no verificada. Campos por uso en código: `RILOTE`, `RITERCE`, `RIFECHA`, `RIDETALLE`, `RIVALOR`, `RICCOSTO`, `RICCOSCRU`.

## VISUSU

Identificación de usuarios y campos de acceso del legado.

Uso: EXPORMES2B (REPROCES.PRG:8100); USUOK7 (MOVICON.prg:5505).

### C:\VISADS\VISUSU.ADT

11 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | IINICIAL | CHARACTER | 4 | 0 |
| 2 | INOMBRE | CHARACTER | 30 | 0 |
| 3 | IPASSWORD | CHARACTER | 6 | 0 |
| 4 | ICEDULA | CHARACTER | 10 | 0 |
| 5 | IDIREC | CHARACTER | 30 | 0 |
| 6 | ITELEF | CHARACTER | 20 | 0 |
| 7 | IREMOTO | LOGICAL | 1 | 0 |
| 8 | ICADUCA | LOGICAL | 1 | 0 |
| 9 | IFECHAC | DOUBLE | 8 | 0 |
| 10 | IMETCOMP | DOUBLE | 8 | 0 |
| 11 | IFCHVIGMC | DOUBLE | 8 | 0 |

## VISAUDI

Bitácora de acciones.

Uso: AUDIVIS (CONTABDSI.PRG:1567); EXPORMES2B (REPROCES.PRG:8093).

### C:\VISADS\VISAUDI.ADT

7 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | USUARIO | CHARACTER | 4 | 0 |
| 2 | HORA | CHARACTER | 10 | 0 |
| 3 | MODULO | CHARACTER | 1 | 0 |
| 4 | DOCUMENTO | CHARACTER | 12 | 0 |
| 5 | MOTIVO | CHARACTER | 250 | 0 |
| 6 | TIPO | SHORTINT | 2 | 0 |
| 7 | FECHA | INTEGER | 4 | 0 |

## CONOPER

Datos de usuarios en USUARIOS/USUA1/DSIGRABA8; rutina presente, sin llamada ni apertura rastreadas.

Uso: USUARIOS (DSITAB.PRG:2716); USUA1 (DSITAB.PRG:2741); DSIGRABA8 (DSITAB.PRG:2767).

### C:\VISADS\CONTAB\CONOPER.ADT

4 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | IINICIAL | CHARACTER | 4 | 0 |
| 2 | INOMBRE | CHARACTER | 30 | 0 |
| 3 | IPASSWORD | CHARACTER | 6 | 0 |
| 4 | IVENCE | INTEGER | 4 | 0 |

## TIDPRESU

Tabla que las funciones de presupuesto leen y modifican; no CONPRESU.

Uso: PRESU1 (CONPRESU.PRG:17); CONSULPRE (CONPRESU.PRG:205); GRABAPRESU (CONPRESU.PRG:248).

### C:\VISADS\COMPRAS\TIDPRESU.ADT

31 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 9 | 0 |
| 2 | CCOSTO | CHARACTER | 7 | 0 |
| 3 | MOV00 | DOUBLE | 8 | 0 |
| 4 | MOV01 | INTEGER | 4 | 0 |
| 5 | MOV02 | DOUBLE | 8 | 2 |
| 6 | MOV03 | DOUBLE | 8 | 2 |
| 7 | MOV04 | DOUBLE | 8 | 2 |
| 8 | MOV05 | DOUBLE | 8 | 0 |
| 9 | MOV06 | DOUBLE | 8 | 0 |
| 10 | MOV07 | DOUBLE | 8 | 0 |
| 11 | MOV08 | DOUBLE | 8 | 0 |
| 12 | MOV09 | DOUBLE | 8 | 0 |
| 13 | MOV10 | DOUBLE | 8 | 0 |
| 14 | MOV11 | DOUBLE | 8 | 0 |
| 15 | MOV12 | DOUBLE | 8 | 0 |
| 16 | MOV13 | DOUBLE | 8 | 0 |
| 17 | PRE00 | DOUBLE | 8 | 0 |
| 18 | PRE01 | DOUBLE | 8 | 0 |
| 19 | PRE02 | DOUBLE | 8 | 0 |
| 20 | PRE03 | DOUBLE | 8 | 0 |
| 21 | PRE04 | DOUBLE | 8 | 0 |
| 22 | PRE05 | DOUBLE | 8 | 0 |
| 23 | PRE06 | DOUBLE | 8 | 0 |
| 24 | PRE07 | DOUBLE | 8 | 0 |
| 25 | PRE08 | DOUBLE | 8 | 0 |
| 26 | PRE09 | DOUBLE | 8 | 0 |
| 27 | PRE10 | DOUBLE | 8 | 0 |
| 28 | PRE11 | DOUBLE | 8 | 0 |
| 29 | PRE12 | DOUBLE | 8 | 0 |
| 30 | PRE13 | DOUBLE | 8 | 0 |
| 31 | CONCEPTO | CHARACTER | 50 | 0 |

## CADEMP

Clasificación de empresa del tercero consultada en sus fichas/listados.

Uso: LISTER4 (CONTAGRAL.PRG:1809); TRAB_CLI2 (CONTAGRAL.PRG:2724); TEMPOK (CONTAGRAL.PRG:3270).

### C:\VISADS\CXP\CADEMP.ADT

3 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 20 | 0 |
| 3 | SALE | CHARACTER | 1 | 0 |

## CADFACTU

Catálogo fuente de elementos copiados por GRAVAFOR, según cAR.

Uso: GRAVAFOR (FACTAB.PRG:880).

### C:\VISADS\POS\CADFACTU.ADT

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | ARCHI | CHARACTER | 1 | 0 |
| 3 | CAMPO | CHARACTER | 25 | 0 |
| 4 | NOMBRE | CHARACTER | 20 | 0 |
| 5 | LONGITUD | SHORTINT | 2 | 0 |
| 6 | TIPO | CHARACTER | 1 | 0 |
| 7 | IMP | CHARACTER | 1 | 0 |
| 8 | TAMANO | CHARACTER | 1 | 0 |
| 9 | FORMATO | CHARACTER | 14 | 0 |
| 10 | INICIAL | SHORTINT | 2 | 0 |
| 11 | FINAL | SHORTINT | 2 | 0 |
| 12 | FILA | SHORTINT | 2 | 0 |
| 13 | COLUMNA | SHORTINT | 2 | 0 |
| 14 | LEYENDA | CHARACTER | 56 | 0 |

## CADFORMA

Elementos del formato en rutinas compartidas; depende de cAR/cT.

Uso: GRAVAFOR (FACTAB.PRG:879); FADGENF2 (FACTAB.PRG:980).

### C:\VISADS\POS\CADFORMA.ADT

18 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | ARCHI | CHARACTER | 1 | 0 |
| 3 | CAMPO | CHARACTER | 25 | 0 |
| 4 | NOMBRE | CHARACTER | 20 | 0 |
| 5 | LONGITUD | SHORTINT | 2 | 0 |
| 6 | TIPO | CHARACTER | 1 | 0 |
| 7 | IMP | CHARACTER | 1 | 0 |
| 8 | TAMANO | CHARACTER | 1 | 0 |
| 9 | FORMATO | CHARACTER | 14 | 0 |
| 10 | INICIAL | SHORTINT | 2 | 0 |
| 11 | FINAL | SHORTINT | 2 | 0 |
| 12 | FILA | SHORTINT | 2 | 0 |
| 13 | COLUMNA | SHORTINT | 2 | 0 |
| 14 | FILA2 | DOUBLE | 8 | 2 |
| 15 | COLUMNA2 | DOUBLE | 8 | 2 |
| 16 | LEYENDA | CHARACTER | 130 | 0 |
| 17 | FUENTE | SHORTINT | 2 | 0 |
| 18 | TIPOFTE | CHARACTER | 20 | 0 |

## CADGENF

Definición de formatos en rutinas compartidas; depende del módulo/parámetro elegido.

Uso: FADGENF (FACTAB.PRG:723); FORMATO (CONTABDSI.PRG:1275); CONSIFOR (CONTABDSI.PRG:2376).

### C:\VISADS\POS\CADGENF.ADT

17 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 25 | 0 |
| 3 | AMBIENTE | CHARACTER | 10 | 0 |
| 4 | INICIAL | CHARACTER | 1 | 0 |
| 5 | TAMANO | SHORTINT | 2 | 0 |
| 6 | LIMITES | SHORTINT | 2 | 0 |
| 7 | LIMITEI | SHORTINT | 2 | 0 |
| 8 | CONFIGURA | CHARACTER | 1 | 0 |
| 9 | SALE | CHARACTER | 1 | 0 |
| 10 | MONEDA | CHARACTER | 6 | 0 |
| 11 | COLA | CHARACTER | 8 | 0 |
| 12 | CTAS | CHARACTER | 1 | 0 |
| 13 | IMPRESORA | CHARACTER | 30 | 0 |
| 14 | PREVISUAL | LOGICAL | 1 | 0 |
| 15 | SERVICIO | LOGICAL | 1 | 0 |
| 16 | AUTORIZA | LOGICAL | 1 | 0 |
| 17 | FPREVIEW | LOGICAL | 1 | 0 |

## CADMAE

Consulta de obligaciones/cartera del tercero.

Uso: CADTOT (CONTAGRAL.PRG:408).

### C:\VISADS\POS\CADMAE.ADT

60 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CCODIGO | CHARACTER | 10 | 0 |
| 2 | CENTRY | CHARACTER | 2 | 0 |
| 3 | CFACTURA | CHARACTER | 12 | 0 |
| 4 | CNOMBRE | CHARACTER | 45 | 0 |
| 5 | CFECFAC | INTEGER | 4 | 0 |
| 6 | CVLRBRU | DOUBLE | 8 | 2 |
| 7 | CVLRDES | DOUBLE | 8 | 2 |
| 8 | CVLRFAC | DOUBLE | 8 | 2 |
| 9 | CFECVEN | INTEGER | 4 | 0 |
| 10 | CFECPAGO | INTEGER | 4 | 0 |
| 11 | CRECCAJA | CHARACTER | 8 | 0 |
| 12 | SALDO00 | DOUBLE | 8 | 2 |
| 13 | DEB00 | DOUBLE | 8 | 2 |
| 14 | CRE00 | DOUBLE | 8 | 2 |
| 15 | DEB01 | DOUBLE | 8 | 2 |
| 16 | CRE01 | DOUBLE | 8 | 2 |
| 17 | DEB02 | DOUBLE | 8 | 2 |
| 18 | CRE02 | DOUBLE | 8 | 2 |
| 19 | DEB03 | DOUBLE | 8 | 2 |
| 20 | CRE03 | DOUBLE | 8 | 2 |
| 21 | DEB04 | DOUBLE | 8 | 2 |
| 22 | CRE04 | DOUBLE | 8 | 2 |
| 23 | DEB05 | DOUBLE | 8 | 2 |
| 24 | CRE05 | DOUBLE | 8 | 2 |
| 25 | DEB06 | DOUBLE | 8 | 2 |
| 26 | CRE06 | DOUBLE | 8 | 2 |
| 27 | DEB07 | DOUBLE | 8 | 2 |
| 28 | CRE07 | DOUBLE | 8 | 2 |
| 29 | DEB08 | DOUBLE | 8 | 2 |
| 30 | CRE08 | DOUBLE | 8 | 2 |
| 31 | DEB09 | DOUBLE | 8 | 2 |
| 32 | CRE09 | DOUBLE | 8 | 2 |
| 33 | DEB10 | DOUBLE | 8 | 2 |
| 34 | CRE10 | DOUBLE | 8 | 2 |
| 35 | DEB11 | DOUBLE | 8 | 2 |
| 36 | CRE11 | DOUBLE | 8 | 2 |
| 37 | DEB12 | DOUBLE | 8 | 2 |
| 38 | CRE12 | DOUBLE | 8 | 2 |
| 39 | CVENDED | CHARACTER | 2 | 0 |
| 40 | CFACTUR | CHARACTER | 2 | 0 |
| 41 | CCHEQUE | DOUBLE | 8 | 2 |
| 42 | CCONTA | CHARACTER | 1 | 0 |
| 43 | CTSALE | CHARACTER | 1 | 0 |
| 44 | SALE | CHARACTER | 1 | 0 |
| 45 | CCHECK2 | CHARACTER | 4 | 0 |
| 46 | GENERAL | CHARACTER | 21 | 0 |
| 47 | BASECOMI | DOUBLE | 8 | 2 |
| 48 | COMIPAGA | DOUBLE | 8 | 2 |
| 49 | COMI01 | DOUBLE | 8 | 4 |
| 50 | COMI02 | DOUBLE | 8 | 4 |
| 51 | COMI03 | DOUBLE | 8 | 4 |
| 52 | COMI04 | DOUBLE | 8 | 4 |
| 53 | CCUOTA | DOUBLE | 8 | 2 |
| 54 | SALDO | DOUBLE | 8 | 2 |
| 55 | MARCA | CHARACTER | 1 | 0 |
| 56 | CEDAD | SHORTINT | 2 | 0 |
| 57 | CZONA | CHARACTER | 2 | 0 |
| 58 | CSUCURSAL | CHARACTER | 3 | 0 |
| 59 | CVENDE2 | CHARACTER | 2 | 0 |
| 60 | NEWFIELD | CHARACTER | 10 | 0 |

## CAUFACTU

Catálogo fuente de elementos copiados por GRAVAFOR, según cAR.

Uso: GRAVAFOR (FACTAB.PRG:880).

### C:\VISADS\CXP\CAUFACTU.ADT

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | ARCHI | CHARACTER | 1 | 0 |
| 3 | CAMPO | CHARACTER | 25 | 0 |
| 4 | NOMBRE | CHARACTER | 20 | 0 |
| 5 | LONGITUD | SHORTINT | 2 | 0 |
| 6 | TIPO | CHARACTER | 1 | 0 |
| 7 | IMP | CHARACTER | 1 | 0 |
| 8 | TAMANO | CHARACTER | 1 | 0 |
| 9 | FORMATO | CHARACTER | 14 | 0 |
| 10 | INICIAL | SHORTINT | 2 | 0 |
| 11 | FINAL | SHORTINT | 2 | 0 |
| 12 | FILA | SHORTINT | 2 | 0 |
| 13 | COLUMNA | SHORTINT | 2 | 0 |
| 14 | LEYENDA | CHARACTER | 56 | 0 |

## CAUFORMA

Elementos del formato en rutinas compartidas; depende de cAR/cT.

Uso: GRAVAFOR (FACTAB.PRG:879); FADGENF2 (FACTAB.PRG:980).

### C:\VISADS\CXP\CAUFORMA.ADT

18 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | ARCHI | CHARACTER | 1 | 0 |
| 3 | CAMPO | CHARACTER | 30 | 0 |
| 4 | NOMBRE | CHARACTER | 20 | 0 |
| 5 | LONGITUD | SHORTINT | 2 | 0 |
| 6 | TIPO | CHARACTER | 1 | 0 |
| 7 | IMP | CHARACTER | 1 | 0 |
| 8 | TAMANO | CHARACTER | 1 | 0 |
| 9 | FORMATO | CHARACTER | 14 | 0 |
| 10 | INICIAL | SHORTINT | 2 | 0 |
| 11 | FINAL | SHORTINT | 2 | 0 |
| 12 | FILA | DOUBLE | 8 | 2 |
| 13 | COLUMNA | DOUBLE | 8 | 2 |
| 14 | FILA2 | DOUBLE | 8 | 2 |
| 15 | COLUMNA2 | DOUBLE | 8 | 2 |
| 16 | LEYENDA | CHARACTER | 130 | 0 |
| 17 | FUENTE | SHORTINT | 2 | 0 |
| 18 | TIPOFTE | CHARACTER | 20 | 0 |

## CAUGENF

Definición de formatos en rutinas compartidas; depende del módulo/parámetro elegido.

Uso: FADGENF (FACTAB.PRG:723); FORMATO (CONTABDSI.PRG:1275); CONSIFOR (CONTABDSI.PRG:2376).

### C:\VISADS\CXP\CAUGENF.ADT

18 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 25 | 0 |
| 3 | AMBIENTE | CHARACTER | 10 | 0 |
| 4 | INICIAL | CHARACTER | 1 | 0 |
| 5 | TAMANO | SHORTINT | 2 | 0 |
| 6 | LIMITES | SHORTINT | 2 | 0 |
| 7 | LIMITEI | SHORTINT | 2 | 0 |
| 8 | CONFIGURA | CHARACTER | 1 | 0 |
| 9 | MONEDA | CHARACTER | 6 | 0 |
| 10 | DIVA | CHARACTER | 1 | 0 |
| 11 | COLA | CHARACTER | 8 | 0 |
| 12 | SALE | CHARACTER | 1 | 0 |
| 13 | DCTOS | CHARACTER | 1 | 0 |
| 14 | COLA2 | CHARACTER | 1 | 0 |
| 15 | PUERTO2 | CHARACTER | 8 | 0 |
| 16 | AUTORIZA | LOGICAL | 1 | 0 |
| 17 | FPREVIEW | LOGICAL | 1 | 0 |
| 18 | LIMITES2 | DOUBLE | 8 | 0 |

## COMFACTU

Catálogo fuente de elementos copiados por GRAVAFOR, según cAR.

Uso: GRAVAFOR (FACTAB.PRG:880).

### C:\VISADS\COMPRAS\COMFACTU.ADT

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | ARCHI | CHARACTER | 1 | 0 |
| 3 | CAMPO | CHARACTER | 25 | 0 |
| 4 | NOMBRE | CHARACTER | 20 | 0 |
| 5 | LONGITUD | SHORTINT | 2 | 0 |
| 6 | TIPO | CHARACTER | 1 | 0 |
| 7 | IMP | CHARACTER | 1 | 0 |
| 8 | TAMANO | CHARACTER | 1 | 0 |
| 9 | FORMATO | CHARACTER | 14 | 0 |
| 10 | INICIAL | SHORTINT | 2 | 0 |
| 11 | FINAL | SHORTINT | 2 | 0 |
| 12 | FILA | SHORTINT | 2 | 0 |
| 13 | COLUMNA | SHORTINT | 2 | 0 |
| 14 | LEYENDA | CHARACTER | 56 | 0 |

## COMFORMA

Elementos del formato en rutinas compartidas; depende de cAR/cT.

Uso: GRAVAFOR (FACTAB.PRG:879); FADGENF2 (FACTAB.PRG:980).

### C:\VISADS\COMPRAS\COMFORMA.ADT

18 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | ARCHI | CHARACTER | 1 | 0 |
| 3 | CAMPO | CHARACTER | 30 | 0 |
| 4 | NOMBRE | CHARACTER | 20 | 0 |
| 5 | LONGITUD | SHORTINT | 2 | 0 |
| 6 | TIPO | CHARACTER | 1 | 0 |
| 7 | IMP | CHARACTER | 1 | 0 |
| 8 | TAMANO | CHARACTER | 1 | 0 |
| 9 | FORMATO | CHARACTER | 14 | 0 |
| 10 | INICIAL | SHORTINT | 2 | 0 |
| 11 | FINAL | SHORTINT | 2 | 0 |
| 12 | FILA | DOUBLE | 8 | 2 |
| 13 | COLUMNA | DOUBLE | 8 | 2 |
| 14 | FILA2 | DOUBLE | 8 | 2 |
| 15 | COLUMNA2 | DOUBLE | 8 | 2 |
| 16 | LEYENDA | CHARACTER | 130 | 0 |
| 17 | FUENTE | SHORTINT | 2 | 0 |
| 18 | TIPOFTE | CHARACTER | 20 | 0 |

## COMGENF

Definición de formatos en rutinas compartidas; depende del módulo/parámetro elegido.

Uso: FADGENF (FACTAB.PRG:723); CONSIFOR (CONTABDSI.PRG:2376).

### C:\VISADS\COMPRAS\COMGENF.ADT

17 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 25 | 0 |
| 3 | AMBIENTE | CHARACTER | 10 | 0 |
| 4 | INICIAL | CHARACTER | 1 | 0 |
| 5 | TAMANO | SHORTINT | 2 | 0 |
| 6 | LIMITES | SHORTINT | 2 | 0 |
| 7 | LIMITEI | SHORTINT | 2 | 0 |
| 8 | CONFIGURA | CHARACTER | 1 | 0 |
| 9 | MONEDA | CHARACTER | 6 | 0 |
| 10 | DIVA | CHARACTER | 1 | 0 |
| 11 | COLA | CHARACTER | 8 | 0 |
| 12 | SALE | CHARACTER | 1 | 0 |
| 13 | DCTOS | CHARACTER | 1 | 0 |
| 14 | COLA2 | CHARACTER | 1 | 0 |
| 15 | PUERTO2 | CHARACTER | 8 | 0 |
| 16 | AUTORIZA | LOGICAL | 1 | 0 |
| 17 | FPREVIEW | LOGICAL | 1 | 0 |

## EVENTOS

Catálogo de eventos en EVENTOS y sus auxiliares.

Uso: EVENTOS (FACTAB.PRG:153); TRAB_EVEN (FACTAB.PRG:188); DSIGRABAE (FACTAB.PRG:211).

### C:\VISADS\POS\EVENTOS.ADT

4 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CTABCOD | CHARACTER | 10 | 0 |
| 2 | CTABDES | CHARACTER | 30 | 0 |
| 3 | CTPESO | DOUBLE | 8 | 2 |
| 4 | CTCOSTO | CHARACTER | 7 | 0 |

## FADCON

Parámetros de cartera y mora usados en la ficha del tercero.

Uso: CLIENTES (CONTAGRAL.PRG:802); BLO_GRAL (CONTAGRAL.PRG:916); DIMORA (CONTAGRAL.PRG:3154).

### C:\VISADS\POS\FADCON.ADT

135 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CTTALLER | LOGICAL | 1 | 0 |
| 2 | CTCOLAS | LOGICAL | 1 | 0 |
| 3 | CTIMPMUL | LOGICAL | 1 | 0 |
| 4 | CTIMPDIR | LOGICAL | 1 | 0 |
| 5 | CTFACPED | LOGICAL | 1 | 0 |
| 6 | CTCLIENTE | LOGICAL | 1 | 0 |
| 7 | CTBODEGAF | SHORTINT | 2 | 0 |
| 8 | CTFLETES | LOGICAL | 1 | 0 |
| 9 | CTCONTAB | LOGICAL | 1 | 0 |
| 10 | CTINTERFA | SHORTINT | 2 | 0 |
| 11 | CTDEFINE | SHORTINT | 2 | 0 |
| 12 | CTPLAZOF | LOGICAL | 1 | 0 |
| 13 | CTNIVELI | SHORTINT | 2 | 0 |
| 14 | CTALTERNA | SHORTINT | 2 | 0 |
| 15 | CTRETEN | SHORTINT | 2 | 0 |
| 16 | CTRETVTA | DOUBLE | 8 | 2 |
| 17 | CTRBASEV | DOUBLE | 8 | 2 |
| 18 | CTRETIVA | DOUBLE | 8 | 2 |
| 19 | CTRBASEI | DOUBLE | 8 | 2 |
| 20 | CTNFISCAL | LOGICAL | 1 | 0 |
| 21 | CTVENCEF | SHORTINT | 2 | 0 |
| 22 | CTCAJON | CHARACTER | 8 | 0 |
| 23 | CTCONSEC | SHORTINT | 2 | 0 |
| 24 | CTTIPOCON | SHORTINT | 2 | 0 |
| 25 | CTFORMATO | CHARACTER | 2 | 0 |
| 26 | CTPREFIJO | CHARACTER | 5 | 0 |
| 27 | CTULTFAC | INTEGER | 4 | 0 |
| 28 | CTULTDEV | INTEGER | 4 | 0 |
| 29 | CTAVANCE | SHORTINT | 2 | 0 |
| 30 | CTDESCRIP | SHORTINT | 2 | 0 |
| 31 | CTCAPTURA | SHORTINT | 2 | 0 |
| 32 | CTIVAIN | LOGICAL | 1 | 0 |
| 33 | CTMODIDES | LOGICAL | 1 | 0 |
| 34 | CTCOSTO | LOGICAL | 1 | 0 |
| 35 | CTREPETI | LOGICAL | 1 | 0 |
| 36 | CTPARCIAL | LOGICAL | 1 | 0 |
| 37 | CTNITEM | SHORTINT | 2 | 0 |
| 38 | CTDCTOS | SHORTINT | 2 | 0 |
| 39 | CTCOMISION | SHORTINT | 2 | 0 |
| 40 | CTCRECAUDO | SHORTINT | 2 | 0 |
| 41 | CTANALCOMI | SHORTINT | 2 | 0 |
| 42 | CTDIASMORA | SHORTINT | 2 | 0 |
| 43 | CTTOPEMORA | DOUBLE | 8 | 2 |
| 44 | CTULTCRUCE | INTEGER | 4 | 0 |
| 45 | CTOBSERRC | SHORTINT | 2 | 0 |
| 46 | CTAUTOMORO | CHARACTER | 8 | 0 |
| 47 | CTCODPAG | LOGICAL | 1 | 0 |
| 48 | CTOBSERCTA | CHARACTER | 120 | 0 |
| 49 | CTULTCRE | INTEGER | 4 | 0 |
| 50 | PREFICRE | CHARACTER | 4 | 0 |
| 51 | CTULTCON | INTEGER | 4 | 0 |
| 52 | PREFICON | CHARACTER | 4 | 0 |
| 53 | CTSER1 | CHARACTER | 20 | 0 |
| 54 | CTMODIVA | LOGICAL | 1 | 0 |
| 55 | CTASALPED | LOGICAL | 1 | 0 |
| 56 | CTFECIPED | LOGICAL | 1 | 0 |
| 57 | CTACARPED | LOGICAL | 1 | 0 |
| 58 | CTULTPED | INTEGER | 4 | 0 |
| 59 | CTFORPED | CHARACTER | 2 | 0 |
| 60 | CTASALCOT | LOGICAL | 1 | 0 |
| 61 | CTFECICOT | LOGICAL | 1 | 0 |
| 62 | CTACARCOT | LOGICAL | 1 | 0 |
| 63 | CTULTCOT | INTEGER | 4 | 0 |
| 64 | CTFORCOT | CHARACTER | 2 | 0 |
| 65 | CTDECIMAL | LOGICAL | 1 | 0 |
| 66 | CTMINIMO | LOGICAL | 1 | 0 |
| 67 | CTBODEGA | CHARACTER | 2 | 0 |
| 68 | CTPLANO | LOGICAL | 1 | 0 |
| 69 | CTINVPROD | CHARACTER | 2 | 0 |
| 70 | ENTPROD | CHARACTER | 2 | 0 |
| 71 | SALPROD | CHARACTER | 2 | 0 |
| 72 | CRUCEDEB | CHARACTER | 2 | 0 |
| 73 | CRUCECRE | CHARACTER | 2 | 0 |
| 74 | CTANACAR | SHORTINT | 2 | 0 |
| 75 | CTMAQUINA | CHARACTER | 2 | 0 |
| 76 | CTMAXCART | DOUBLE | 8 | 2 |
| 77 | CTANAIMP | LOGICAL | 1 | 0 |
| 78 | CTOBSERCA | LOGICAL | 1 | 0 |
| 79 | CTTALLERIT | CHARACTER | 1 | 0 |
| 80 | CTRETICA | DOUBLE | 8 | 0 |
| 81 | CTRBASEC | DOUBLE | 8 | 0 |
| 82 | CTCCCONT | LOGICAL | 1 | 0 |
| 83 | CTMODFCH | LOGICAL | 1 | 0 |
| 84 | CTRETCREE | DOUBLE | 8 | 0 |
| 85 | CTREVALC | CHARACTER | 1 | 0 |
| 86 | CTREVALX | CHARACTER | 1 | 0 |
| 87 | CTREVALT | CHARACTER | 1 | 0 |
| 88 | CTREVALI | CHARACTER | 1 | 0 |
| 89 | CTUSUC | CHARACTER | 4 | 0 |
| 90 | CTUSUX | CHARACTER | 4 | 0 |
| 91 | CTUSUT | CHARACTER | 4 | 0 |
| 92 | CTUSUI | CHARACTER | 4 | 0 |
| 93 | CTAUTORET | LOGICAL | 1 | 0 |
| 94 | CTCOSTOPI | LOGICAL | 1 | 0 |
| 95 | CTCEROSFA | LOGICAL | 1 | 0 |
| 96 | CTNIIF01 | DOUBLE | 8 | 0 |
| 97 | CTNIIF02 | DOUBLE | 8 | 0 |
| 98 | CTNIIF03 | DOUBLE | 8 | 0 |
| 99 | CTNIIF04 | DOUBLE | 8 | 0 |
| 100 | CTNIIF05 | DOUBLE | 8 | 0 |
| 101 | CTNIIF01K | CHARACTER | 5 | 0 |
| 102 | CTNIIF02K | CHARACTER | 5 | 0 |
| 103 | CTNIIF03K | CHARACTER | 5 | 0 |
| 104 | CTNIIF04K | CHARACTER | 5 | 0 |
| 105 | CTNIIF05K | CHARACTER | 5 | 0 |
| 106 | CTNIIFDEB | CHARACTER | 12 | 0 |
| 107 | CTNIIFCRE | CHARACTER | 12 | 0 |
| 108 | CTNIIFBAJO | DOUBLE | 8 | 0 |
| 109 | CTNIIFMEDIO | DOUBLE | 8 | 0 |
| 110 | CTNIIFALTO | DOUBLE | 8 | 0 |
| 111 | CTACTIVAFE | LOGICAL | 1 | 0 |
| 112 | CTCONSEFE | DOUBLE | 8 | 0 |
| 113 | CTRESOLFE1 | CHARACTER | 50 | 0 |
| 114 | CTRESOLFE2 | CHARACTER | 50 | 0 |
| 115 | CTFCHIRFE | DOUBLE | 8 | 0 |
| 116 | CTFCHFRFE | DOUBLE | 8 | 0 |
| 117 | CTLEYEN1 | CHARACTER | 100 | 0 |
| 118 | CTLEYEN2 | CHARACTER | 100 | 0 |
| 119 | CTLEYEN3 | CHARACTER | 100 | 0 |
| 120 | CTLEYEN4 | CHARACTER | 100 | 0 |
| 121 | CTLEYEN5 | CHARACTER | 100 | 0 |
| 122 | CTPREFIFE | CHARACTER | 6 | 0 |
| 123 | CTLEYEN6 | CHARACTER | 100 | 0 |
| 124 | CTLEYEN7 | CHARACTER | 100 | 0 |
| 125 | CTLEYEN8 | CHARACTER | 100 | 0 |
| 126 | CTLEYEN9 | CHARACTER | 100 | 0 |
| 127 | CTLEYEN10 | CHARACTER | 100 | 0 |
| 128 | CTENCAB1 | CHARACTER | 100 | 0 |
| 129 | CTENCAB2 | CHARACTER | 100 | 0 |
| 130 | CTENCAB3 | CHARACTER | 100 | 0 |
| 131 | CTENCAB4 | CHARACTER | 100 | 0 |
| 132 | CTULPWEB | DOUBLE | 8 | 0 |
| 133 | CTPREFIWEB | CHARACTER | 4 | 0 |
| 134 | DESPAI | DOUBLE | 8 | 0 |
| 135 | DESPAF | DOUBLE | 8 | 0 |

## FADDIA

Cabecera de factura consultada desde VERDETAL.

Uso: VERDETAL (CONSULTA.PRG:1994).

### C:\VISADS\POS\FADDIA.DBF

52 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | FACIA | CHARACTER | 4 | 0 |
| 2 | FAPLACA | CHARACTER | 6 | 0 |
| 3 | FACODIGO | CHARACTER | 10 | 0 |
| 4 | FANOMBRE | CHARACTER | 45 | 0 |
| 5 | FADIREC | CHARACTER | 50 | 0 |
| 6 | FACIUDAD | CHARACTER | 12 | 0 |
| 7 | FATELEF | CHARACTER | 25 | 0 |
| 8 | FANIT | CHARACTER | 15 | 0 |
| 9 | FATIPPER | CHARACTER | 1 | 0 |
| 10 | FAFACTURA | CHARACTER | 12 | 0 |
| 11 | FAPEDIDO | CHARACTER | 18 | 0 |
| 12 | FAFCHFAC | NUMERIC | 8 | 0 |
| 13 | FAFCHVEN | NUMERIC | 8 | 0 |
| 14 | FACANT | NUMERIC | 12 | 2 |
| 15 | FACANT2 | NUMERIC | 12 | 2 |
| 16 | FAVLRBRU | NUMERIC | 14 | 2 |
| 17 | FAVLRRETV | NUMERIC | 12 | 2 |
| 18 | FAVLRRETI | NUMERIC | 12 | 2 |
| 19 | FAVLRRETC | NUMERIC | 12 | 2 |
| 20 | FAVARIOS | NUMERIC | 12 | 2 |
| 21 | FAVLRDES | NUMERIC | 12 | 2 |
| 22 | FAVLRFLE | NUMERIC | 11 | 2 |
| 23 | FAVLRIVA | NUMERIC | 14 | 2 |
| 24 | FAVLRIMC | NUMERIC | 14 | 2 |
| 25 | FAVLROIP | NUMERIC | 14 | 2 |
| 26 | FAVLRNET | NUMERIC | 14 | 2 |
| 27 | FAVLR01 | NUMERIC | 14 | 2 |
| 28 | FAPAG01 | CHARACTER | 2 | 0 |
| 29 | FAVLR02 | NUMERIC | 14 | 2 |
| 30 | FAPAG02 | CHARACTER | 2 | 0 |
| 31 | FAVLR03 | NUMERIC | 14 | 2 |
| 32 | FAPAG03 | CHARACTER | 2 | 0 |
| 33 | FAVLDESFI | NUMERIC | 12 | 2 |
| 34 | FAPEDINT | CHARACTER | 25 | 0 |
| 35 | FAVENDED | CHARACTER | 2 | 0 |
| 36 | FAOBSER | CHARACTER | 250 | 0 |
| 37 | FATIME | CHARACTER | 8 | 0 |
| 38 | FADOCPAGO | CHARACTER | 15 | 0 |
| 39 | FANOMCOMP | CHARACTER | 20 | 0 |
| 40 | FAOBSERVEN | CHARACTER | 30 | 0 |
| 41 | FACOND | CHARACTER | 50 | 0 |
| 42 | FAESTADO | NUMERIC | 1 | 0 |
| 43 | FAVLRBRU2 | NUMERIC | 14 | 2 |
| 44 | FAVLRDES2 | NUMERIC | 14 | 2 |
| 45 | FAVLRIVA2 | NUMERIC | 14 | 2 |
| 46 | FAVLRNET2 | NUMERIC | 14 | 2 |
| 47 | FACONTRA | CHARACTER | 15 | 0 |
| 48 | FANOMPRO | CHARACTER | 50 | 0 |
| 49 | FAVENDED2 | CHARACTER | 2 | 0 |
| 50 | FATIPO | CHARACTER | 2 | 0 |
| 51 | FAVLRCREE | NUMERIC | 14 | 2 |
| 52 | FAVLRTASA | NUMERIC | 14 | 2 |

## FADFACTU

Catálogo fuente de elementos copiados por GRAVAFOR, según cAR.

Uso: GRAVAFOR (FACTAB.PRG:880).

### C:\VISADS\POS\FADFACTU.ADT

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | ARCHI | CHARACTER | 1 | 0 |
| 3 | CAMPO | CHARACTER | 25 | 0 |
| 4 | NOMBRE | CHARACTER | 20 | 0 |
| 5 | LONGITUD | SHORTINT | 2 | 0 |
| 6 | TIPO | CHARACTER | 1 | 0 |
| 7 | IMP | CHARACTER | 1 | 0 |
| 8 | TAMANO | CHARACTER | 1 | 0 |
| 9 | FORMATO | CHARACTER | 14 | 0 |
| 10 | INICIAL | SHORTINT | 2 | 0 |
| 11 | FINAL | SHORTINT | 2 | 0 |
| 12 | FILA | SHORTINT | 2 | 0 |
| 13 | COLUMNA | SHORTINT | 2 | 0 |
| 14 | LEYENDA | CHARACTER | 56 | 0 |

## FADFORMA

Elementos del formato en rutinas compartidas; depende de cAR/cT.

Uso: GRAVAFOR (FACTAB.PRG:879); FADGENF2 (FACTAB.PRG:980).

### C:\VISADS\POS\FADFORMA.ADT

18 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | ARCHI | CHARACTER | 1 | 0 |
| 3 | CAMPO | CHARACTER | 30 | 0 |
| 4 | NOMBRE | CHARACTER | 20 | 0 |
| 5 | LONGITUD | SHORTINT | 2 | 0 |
| 6 | TIPO | CHARACTER | 1 | 0 |
| 7 | IMP | CHARACTER | 1 | 0 |
| 8 | TAMANO | CHARACTER | 1 | 0 |
| 9 | FORMATO | CHARACTER | 14 | 0 |
| 10 | INICIAL | SHORTINT | 2 | 0 |
| 11 | FINAL | SHORTINT | 2 | 0 |
| 12 | FILA | DOUBLE | 8 | 2 |
| 13 | COLUMNA | DOUBLE | 8 | 2 |
| 14 | FILA2 | DOUBLE | 8 | 2 |
| 15 | COLUMNA2 | DOUBLE | 8 | 2 |
| 16 | LEYENDA | CHARACTER | 130 | 0 |
| 17 | FUENTE | SHORTINT | 2 | 0 |
| 18 | TIPOFTE | CHARACTER | 20 | 0 |

## FADGENF

Definición de formatos en rutinas compartidas; depende del módulo/parámetro elegido.

Uso: FADGENF (FACTAB.PRG:723); FORMATO (CONTABDSI.PRG:1275); CONSIFOR (CONTABDSI.PRG:2376).

### C:\VISADS\POS\FADGENF.ADT

17 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 25 | 0 |
| 3 | AMBIENTE | CHARACTER | 10 | 0 |
| 4 | INICIAL | CHARACTER | 1 | 0 |
| 5 | TAMANO | SHORTINT | 2 | 0 |
| 6 | LIMITES | SHORTINT | 2 | 0 |
| 7 | LIMITEI | SHORTINT | 2 | 0 |
| 8 | CONFIGURA | CHARACTER | 1 | 0 |
| 9 | MONEDA | CHARACTER | 6 | 0 |
| 10 | DIVA | CHARACTER | 1 | 0 |
| 11 | COLA | CHARACTER | 8 | 0 |
| 12 | SALE | CHARACTER | 1 | 0 |
| 13 | DCTOS | CHARACTER | 1 | 0 |
| 14 | COLA2 | CHARACTER | 1 | 0 |
| 15 | PUERTO2 | CHARACTER | 8 | 0 |
| 16 | AUTORIZA | LOGICAL | 1 | 0 |
| 17 | FPREVIEW | LOGICAL | 1 | 0 |

## FADITE

Renglones de factura totalizados desde VERDETAL.

Uso: VERDETAL (CONSULTA.PRG:2062).

### C:\VISADS\POS\FADITE.DBF

51 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | IFCLIENTE | CHARACTER | 10 | 0 |
| 2 | IFMESA | CHARACTER | 6 | 0 |
| 3 | IFPLACA | CHARACTER | 6 | 0 |
| 4 | IFPEDIDO | CHARACTER | 12 | 0 |
| 5 | IFFCHPED | NUMERIC | 8 | 0 |
| 6 | IFBODEGA | CHARACTER | 2 | 0 |
| 7 | IFFACT | CHARACTER | 12 | 0 |
| 8 | IFARTIC | CHARACTER | 19 | 0 |
| 9 | IFPARTE | CHARACTER | 16 | 0 |
| 10 | IFNUMERO | NUMERIC | 6 | 0 |
| 11 | IFEAN | CHARACTER | 18 | 0 |
| 12 | IFNOMBRE | CHARACTER | 60 | 0 |
| 13 | IFUNIMED | CHARACTER | 6 | 0 |
| 14 | IFCANT | NUMERIC | 12 | 3 |
| 15 | IFCANT2 | NUMERIC | 12 | 4 |
| 16 | IFCOSTO | NUMERIC | 14 | 2 |
| 17 | IFVLRUNI | NUMERIC | 14 | 3 |
| 18 | IFVARIOS | NUMERIC | 14 | 2 |
| 19 | IFVLRBRU | NUMERIC | 14 | 2 |
| 20 | IFVLRRETV | NUMERIC | 14 | 2 |
| 21 | IFVLRRETI | NUMERIC | 14 | 2 |
| 22 | IFVLRRETC | NUMERIC | 14 | 2 |
| 23 | IFPORDES | NUMERIC | 6 | 2 |
| 24 | IFVLRDES | NUMERIC | 14 | 2 |
| 25 | IFVLDESFI | NUMERIC | 14 | 2 |
| 26 | IFTIMP | CHARACTER | 2 | 0 |
| 27 | IFPORIVA | NUMERIC | 5 | 2 |
| 28 | IFVLRIVA | NUMERIC | 14 | 2 |
| 29 | IFVLRIMC | NUMERIC | 14 | 2 |
| 30 | IFVLROIP | NUMERIC | 14 | 2 |
| 31 | IFVLRNET | NUMERIC | 14 | 2 |
| 32 | IFPEND | NUMERIC | 11 | 2 |
| 33 | IFFECHA | NUMERIC | 8 | 0 |
| 34 | IFVENDED | CHARACTER | 6 | 0 |
| 35 | IFESTADO | NUMERIC | 1 | 0 |
| 36 | IFTIPINV | CHARACTER | 2 | 0 |
| 37 | IFDOCUM2 | CHARACTER | 12 | 0 |
| 38 | IFVLRBRU2 | NUMERIC | 14 | 2 |
| 39 | IFVLRDES2 | NUMERIC | 14 | 2 |
| 40 | IFVLRIVA2 | NUMERIC | 14 | 2 |
| 41 | IFVLRNET2 | NUMERIC | 14 | 2 |
| 42 | IFCONTRA | CHARACTER | 12 | 0 |
| 43 | IFCANTPED | NUMERIC | 12 | 2 |
| 44 | IFLOTE | CHARACTER | 12 | 0 |
| 45 | IFVENLOTE | NUMERIC | 8 | 0 |
| 46 | IFLISTA | CHARACTER | 1 | 0 |
| 47 | IFVENDED2 | CHARACTER | 2 | 0 |
| 48 | IFDEVOK | CHARACTER | 1 | 0 |
| 49 | IFVLRCREE | NUMERIC | 14 | 2 |
| 50 | IFCCOSTO | CHARACTER | 7 | 0 |
| 51 | IFVLRUNI2 | NUMERIC | 14 | 3 |

## FADPAGO

Nombre de la forma de pago en la consulta documental.

Uso: VERDETAL (CONSULTA.PRG:2017).

### C:\VISADS\POS\FADPAGO.ADT

44 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 15 | 0 |
| 3 | PNUMERO | INTEGER | 4 | 0 |
| 4 | PREFIJO | CHARACTER | 4 | 0 |
| 5 | NDOCUM | CHARACTER | 10 | 0 |
| 6 | PDOCPAGO | LOGICAL | 1 | 0 |
| 7 | PNOMCOMP | LOGICAL | 1 | 0 |
| 8 | PCARTERA | LOGICAL | 1 | 0 |
| 9 | PEFECTO | LOGICAL | 1 | 0 |
| 10 | VLRVENTAS | DOUBLE | 8 | 2 |
| 11 | CANT | DOUBLE | 8 | 2 |
| 12 | SALE | CHARACTER | 1 | 0 |
| 13 | VLRBRUTO | DOUBLE | 8 | 2 |
| 14 | VLRDCTO | DOUBLE | 8 | 2 |
| 15 | VLRIVA | DOUBLE | 8 | 2 |
| 16 | VLRNETO | DOUBLE | 8 | 2 |
| 17 | DEB01 | CHARACTER | 12 | 0 |
| 18 | CRE01 | CHARACTER | 12 | 0 |
| 19 | DEB02 | CHARACTER | 12 | 0 |
| 20 | CRE02 | CHARACTER | 12 | 0 |
| 21 | DEB03 | CHARACTER | 12 | 0 |
| 22 | CRE03 | CHARACTER | 12 | 0 |
| 23 | DEB04 | CHARACTER | 12 | 0 |
| 24 | CRE04 | CHARACTER | 12 | 0 |
| 25 | DEB05 | CHARACTER | 12 | 0 |
| 26 | CRE05 | CHARACTER | 12 | 0 |
| 27 | DEB06 | CHARACTER | 12 | 0 |
| 28 | CRE06 | CHARACTER | 12 | 0 |
| 29 | DEB07 | CHARACTER | 12 | 0 |
| 30 | CRE07 | CHARACTER | 12 | 0 |
| 31 | DEB08 | CHARACTER | 12 | 0 |
| 32 | CRE08 | CHARACTER | 12 | 0 |
| 33 | DEB09 | CHARACTER | 12 | 0 |
| 34 | CRE09 | CHARACTER | 12 | 0 |
| 35 | COMPRO | CHARACTER | 2 | 0 |
| 36 | PCAJON | LOGICAL | 1 | 0 |
| 37 | PCLICARTE | CHARACTER | 10 | 0 |
| 38 | CODCONSE | CHARACTER | 2 | 0 |
| 39 | ULTCONSE | DOUBLE | 8 | 0 |
| 40 | FCHCONSE | DOUBLE | 8 | 0 |
| 41 | NUMDOC | CHARACTER | 12 | 0 |
| 42 | BANCO | CHARACTER | 20 | 0 |
| 43 | AUTORIZA | CHARACTER | 20 | 0 |
| 44 | CODCARTE | CHARACTER | 2 | 0 |

## FADTAB

Zonas y clasificaciones en ZONAS/DSIESTAZ.

Uso: ZONAS (FACTAB.PRG:121); TRAB_ZONA (FACTAB.PRG:440); DSIGRABAZ (FACTAB.PRG:510).

### C:\VISADS\POS\FADTAB.ADT

12 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CTABCOD | CHARACTER | 2 | 0 |
| 2 | CTABDES | CHARACTER | 30 | 0 |
| 3 | CTPESO | DOUBLE | 8 | 2 |
| 4 | CTCOSTO | CHARACTER | 7 | 0 |
| 5 | VINIDEBCP | CHARACTER | 20 | 0 |
| 6 | VINICRECP | CHARACTER | 20 | 0 |
| 7 | VPOSDEBCP | CHARACTER | 20 | 0 |
| 8 | VPOSCRECP | CHARACTER | 20 | 0 |
| 9 | VINIDEBLP | CHARACTER | 20 | 0 |
| 10 | VINICRELP | CHARACTER | 20 | 0 |
| 11 | VPOSDEBLP | CHARACTER | 50 | 0 |
| 12 | VPOSCRELP | CHARACTER | 20 | 0 |

## FADVEHI

Catálogo de vehículos mantenido por VEHI001 y funciones relacionadas.

Uso: VEHI001 (FACTAB.PRG:27); TRAB_VEHI (FACTAB.PRG:63); VEHIGRABA (FACTAB.PRG:89).

### C:\VISADS\POS\FADVEHI.ADT

2 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | VCODIGO | CHARACTER | 2 | 0 |
| 2 | VNOMBRE | CHARACTER | 30 | 0 |

## FAESPERA

Tabla de espera: rama alternativa de CIUDAD(cT).

Uso: CIUDAD (FACTAB.PRG:271).

### C:\VISADS\POS\FAESPERA.ADT

10 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 5 | 0 |
| 2 | NOMBRE | CHARACTER | 30 | 0 |
| 3 | CLIENTE | CHARACTER | 10 | 0 |
| 4 | NOMCLI | CHARACTER | 30 | 0 |
| 5 | VENDED | CHARACTER | 2 | 0 |
| 6 | NOMVEN | CHARACTER | 30 | 0 |
| 7 | CANT | DOUBLE | 8 | 2 |
| 8 | BRUTO | DOUBLE | 8 | 2 |
| 9 | IVA | DOUBLE | 8 | 2 |
| 10 | NETO | DOUBLE | 8 | 2 |

## NOMCALEN

Validación/búsqueda de fechas y calendario.

Uso: CAL_VIGMC (CONTAGRAL.PRG:283); DSIFCH3 (CONTABDSI.PRG:1308); DSIFCH (CONTABDSI.PRG:1657).

### C:\VISADS\NOMINA\NOMCALEN.ADT

7 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | DIA | DOUBLE | 8 | 0 |
| 2 | NOMDIA | CHARACTER | 9 | 0 |
| 3 | OBSERVA | CHARACTER | 50 | 0 |
| 4 | FESTIVO | LOGICAL | 1 | 0 |
| 5 | CIERRE | LOGICAL | 1 | 0 |
| 6 | CANT1 | DOUBLE | 8 | 0 |
| 7 | PROM | CHARACTER | 1 | 0 |

## TIDBODE

Bodegas y rutas en apertura de sucursales y replicación de terceros.

Uso: ABRESUC_MER (CONTABDSI.PRG:3176); ABRESUC_MER2 (CONTABDSI.PRG:3198); CIERRSUC_MER (CONTABDSI.PRG:3251).

### C:\VISADS\COMPRAS\TIDBODE.ADT

102 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 20 | 0 |
| 3 | CARPETA | CHARACTER | 50 | 0 |
| 4 | CARPETAPD | CHARACTER | 50 | 0 |
| 5 | CARPETAIP | CHARACTER | 50 | 0 |
| 6 | CARPETAR | CHARACTER | 50 | 0 |
| 7 | BODEGA | CHARACTER | 2 | 0 |
| 8 | SALDOS | DOUBLE | 8 | 3 |
| 9 | COSTOS | DOUBLE | 8 | 2 |
| 10 | VENTAS | DOUBLE | 8 | 3 |
| 11 | PROMEDIO | DOUBLE | 8 | 3 |
| 12 | CCOSTO | CHARACTER | 7 | 0 |
| 13 | TIPDOC | CHARACTER | 2 | 0 |
| 14 | VTA01 | DOUBLE | 8 | 2 |
| 15 | VTA02 | DOUBLE | 8 | 2 |
| 16 | VTA03 | DOUBLE | 8 | 2 |
| 17 | VTA04 | DOUBLE | 8 | 2 |
| 18 | VTA05 | DOUBLE | 8 | 2 |
| 19 | VTA06 | DOUBLE | 8 | 2 |
| 20 | VTA07 | DOUBLE | 8 | 2 |
| 21 | VTA08 | DOUBLE | 8 | 2 |
| 22 | VTA09 | DOUBLE | 8 | 2 |
| 23 | VTA10 | DOUBLE | 8 | 2 |
| 24 | VTA11 | DOUBLE | 8 | 2 |
| 25 | VTA12 | DOUBLE | 8 | 2 |
| 26 | ENT01 | DOUBLE | 8 | 2 |
| 27 | ENT02 | DOUBLE | 8 | 2 |
| 28 | ENT03 | DOUBLE | 8 | 2 |
| 29 | ENT04 | DOUBLE | 8 | 2 |
| 30 | ENT05 | DOUBLE | 8 | 2 |
| 31 | ENT06 | DOUBLE | 8 | 2 |
| 32 | ENT07 | DOUBLE | 8 | 2 |
| 33 | ENT08 | DOUBLE | 8 | 2 |
| 34 | ENT09 | DOUBLE | 8 | 2 |
| 35 | ENT10 | DOUBLE | 8 | 2 |
| 36 | ENT11 | DOUBLE | 8 | 2 |
| 37 | ENT12 | DOUBLE | 8 | 2 |
| 38 | SAL01 | DOUBLE | 8 | 2 |
| 39 | SAL02 | DOUBLE | 8 | 2 |
| 40 | SAL03 | DOUBLE | 8 | 2 |
| 41 | SAL04 | DOUBLE | 8 | 2 |
| 42 | SAL05 | DOUBLE | 8 | 2 |
| 43 | SAL06 | DOUBLE | 8 | 2 |
| 44 | SAL07 | DOUBLE | 8 | 2 |
| 45 | SAL08 | DOUBLE | 8 | 2 |
| 46 | SAL09 | DOUBLE | 8 | 2 |
| 47 | SAL10 | DOUBLE | 8 | 2 |
| 48 | SAL11 | DOUBLE | 8 | 2 |
| 49 | SAL12 | DOUBLE | 8 | 2 |
| 50 | VERSAL | LOGICAL | 1 | 0 |
| 51 | ESTADO | LOGICAL | 1 | 0 |
| 52 | ACUMULA | LOGICAL | 1 | 0 |
| 53 | HABILITA | LOGICAL | 1 | 0 |
| 54 | BOD1 | CHARACTER | 2 | 0 |
| 55 | BOD2 | CHARACTER | 2 | 0 |
| 56 | ULTIMAF | DOUBLE | 8 | 0 |
| 57 | ULTIMAC | DOUBLE | 8 | 0 |
| 58 | PEDIDO | DOUBLE | 8 | 0 |
| 59 | COMPRA | DOUBLE | 8 | 0 |
| 60 | SALDOULT | DOUBLE | 8 | 0 |
| 61 | ULTVTA | DOUBLE | 8 | 0 |
| 62 | SALDOBO | DOUBLE | 8 | 0 |
| 63 | ULTCOM1 | DOUBLE | 8 | 0 |
| 64 | CANCOM1 | DOUBLE | 8 | 0 |
| 65 | VALCOM1 | DOUBLE | 8 | 0 |
| 66 | VALCOM3 | DOUBLE | 8 | 0 |
| 67 | ROTACION | DOUBLE | 8 | 0 |
| 68 | INACTIVO | CHARACTER | 1 | 0 |
| 69 | CXLS | CHARACTER | 2 | 0 |
| 70 | TIPMARGEN | DOUBLE | 8 | 0 |
| 71 | CODCIU | CHARACTER | 6 | 0 |
| 72 | CTNPED | DOUBLE | 8 | 0 |
| 73 | GTSOL | LOGICAL | 1 | 0 |
| 74 | ABC | CHARACTER | 1 | 0 |
| 75 | SUGEPEDI | DOUBLE | 8 | 0 |
| 76 | EMBALAJE | DOUBLE | 8 | 0 |
| 77 | REDONDEO | DOUBLE | 8 | 0 |
| 78 | ICANT | DOUBLE | 8 | 0 |
| 79 | PROYESEMA | DOUBLE | 8 | 0 |
| 80 | VTASEANT | DOUBLE | 8 | 0 |
| 81 | ISALDO | DOUBLE | 8 | 0 |
| 82 | DIASINV | DOUBLE | 8 | 0 |
| 83 | INVEMAX | DOUBLE | 8 | 0 |
| 84 | ULTIMORECI | DOUBLE | 8 | 0 |
| 85 | ITRANSITO | DOUBLE | 8 | 0 |
| 86 | FORCSEMA | DOUBLE | 8 | 0 |
| 87 | CANTPRDIA | DOUBLE | 8 | 0 |
| 88 | PLAENTRED | DOUBLE | 8 | 0 |
| 89 | STOCKSEG | DOUBLE | 8 | 0 |
| 90 | PTOREORD | DOUBLE | 8 | 0 |
| 91 | CANPTORE | DOUBLE | 8 | 0 |
| 92 | FREPEDI | DOUBLE | 8 | 0 |
| 93 | CICLOPEDI | DOUBLE | 8 | 0 |
| 94 | IPORIVA | DOUBLE | 8 | 0 |
| 95 | IPRELIST | DOUBLE | 8 | 0 |
| 96 | OCEDI | LOGICAL | 1 | 0 |
| 97 | CODCEN | CHARACTER | 50 | 0 |
| 98 | INIMP3 | DOUBLE | 8 | 0 |
| 99 | LOGY1 | LOGICAL | 1 | 0 |
| 100 | CODCEN2 | CHARACTER | 15 | 0 |
| 101 | EOS | CHARACTER | 1 | 0 |
| 102 | AESTADO | CHARACTER | 1 | 0 |

## TIDFORMA

Elementos del formato en rutinas compartidas; depende de cAR/cT.

Uso: GRAVAFOR (FACTAB.PRG:879); FADGENF2 (FACTAB.PRG:980).

### C:\VISADS\INVE\TIDFORMA.ADT

18 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | ARCHI | CHARACTER | 1 | 0 |
| 3 | CAMPO | CHARACTER | 30 | 0 |
| 4 | NOMBRE | CHARACTER | 20 | 0 |
| 5 | LONGITUD | SHORTINT | 2 | 0 |
| 6 | TIPO | CHARACTER | 1 | 0 |
| 7 | IMP | CHARACTER | 1 | 0 |
| 8 | TAMANO | CHARACTER | 1 | 0 |
| 9 | FORMATO | CHARACTER | 14 | 0 |
| 10 | INICIAL | SHORTINT | 2 | 0 |
| 11 | FINAL | SHORTINT | 2 | 0 |
| 12 | FILA | DOUBLE | 8 | 2 |
| 13 | COLUMNA | DOUBLE | 8 | 2 |
| 14 | FILA2 | DOUBLE | 8 | 2 |
| 15 | COLUMNA2 | DOUBLE | 8 | 2 |
| 16 | LEYENDA | CHARACTER | 130 | 0 |
| 17 | FUENTE | SHORTINT | 2 | 0 |
| 18 | TIPOFTE | CHARACTER | 20 | 0 |

## TIDGENF

Definición de formatos en rutinas compartidas; depende del módulo/parámetro elegido.

Uso: FADGENF (FACTAB.PRG:723); FORMATO (CONTABDSI.PRG:1275); CONSIFOR (CONTABDSI.PRG:2376).

### C:\VISADS\INVE\TIDGENF.ADT

17 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 25 | 0 |
| 3 | AMBIENTE | CHARACTER | 10 | 0 |
| 4 | INICIAL | CHARACTER | 1 | 0 |
| 5 | TAMANO | SHORTINT | 2 | 0 |
| 6 | LIMITES | SHORTINT | 2 | 0 |
| 7 | LIMITEI | SHORTINT | 2 | 0 |
| 8 | CONFIGURA | CHARACTER | 1 | 0 |
| 9 | MONEDA | CHARACTER | 6 | 0 |
| 10 | DIVA | CHARACTER | 1 | 0 |
| 11 | COLA | CHARACTER | 8 | 0 |
| 12 | SALE | CHARACTER | 1 | 0 |
| 13 | DCTOS | CHARACTER | 1 | 0 |
| 14 | COLA2 | CHARACTER | 1 | 0 |
| 15 | PUERTO2 | CHARACTER | 8 | 0 |
| 16 | AUTORIZA | LOGICAL | 1 | 0 |
| 17 | FPREVIEW | LOGICAL | 1 | 0 |

## TIDINVE

Catálogo fuente de elementos copiados por GRAVAFOR, según cAR.

Uso: GRAVAFOR (FACTAB.PRG:880).

### C:\VISADS\INVE\TIDINVE.ADT

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | ARCHI | CHARACTER | 1 | 0 |
| 3 | CAMPO | CHARACTER | 25 | 0 |
| 4 | NOMBRE | CHARACTER | 20 | 0 |
| 5 | LONGITUD | SHORTINT | 2 | 0 |
| 6 | TIPO | CHARACTER | 1 | 0 |
| 7 | IMP | CHARACTER | 1 | 0 |
| 8 | TAMANO | CHARACTER | 1 | 0 |
| 9 | FORMATO | CHARACTER | 14 | 0 |
| 10 | INICIAL | SHORTINT | 2 | 0 |
| 11 | FINAL | SHORTINT | 2 | 0 |
| 12 | FILA | SHORTINT | 2 | 0 |
| 13 | COLUMNA | SHORTINT | 2 | 0 |
| 14 | LEYENDA | CHARACTER | 56 | 0 |

## TIDPEDI

Conceptos de pedido listados en una rama de ILISTAR.

Uso: ILISTAR (CONTABDSI.PRG:2964).

### C:\VISADS\INVE\TIDPEDI.ADT

5 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | PEDCOD | CHARACTER | 2 | 0 |
| 2 | PEDNOM | CHARACTER | 30 | 0 |
| 3 | PEDDIR | CHARACTER | 64 | 0 |
| 4 | CANITEM | DOUBLE | 8 | 0 |
| 5 | PEDIPCEDI | CHARACTER | 100 | 0 |

## TIDSAL

Actualización de información comercial replicada por REPLI_METC.

Uso: REPLI_METC (CONTAGRAL.PRG:3937).

### C:\VISADS\INVE\TIDSAL.ADT

270 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | INARTIC | CHARACTER | 19 | 0 |
| 2 | NUMERO | INTEGER | 4 | 0 |
| 3 | INEAN | CHARACTER | 13 | 0 |
| 4 | INEANC | CHARACTER | 13 | 0 |
| 5 | INPARTE | CHARACTER | 16 | 0 |
| 6 | INNOMBRE | CHARACTER | 60 | 0 |
| 7 | INNOMBRE3 | CHARACTER | 20 | 0 |
| 8 | INUNIDAD | CHARACTER | 2 | 0 |
| 9 | INPROVEE | CHARACTER | 10 | 0 |
| 10 | INTIPO | CHARACTER | 3 | 0 |
| 11 | INEMBALAJE | INTEGER | 4 | 0 |
| 12 | INVRVENTA1 | DOUBLE | 8 | 2 |
| 13 | INVRVENTA2 | DOUBLE | 8 | 2 |
| 14 | INVRVENTA3 | DOUBLE | 8 | 2 |
| 15 | INVRVENTA4 | DOUBLE | 8 | 2 |
| 16 | INVRVENTA5 | DOUBLE | 8 | 2 |
| 17 | INVRVENTA6 | DOUBLE | 8 | 2 |
| 18 | INVRVENTA7 | DOUBLE | 8 | 2 |
| 19 | INVRVENTA8 | DOUBLE | 8 | 2 |
| 20 | INVRVENTA9 | DOUBLE | 8 | 2 |
| 21 | INVRVENTA0 | DOUBLE | 8 | 2 |
| 22 | INTIMP | CHARACTER | 2 | 0 |
| 23 | INIMPC | DOUBLE | 8 | 2 |
| 24 | INIMP3 | DOUBLE | 8 | 2 |
| 25 | INTIPINV | CHARACTER | 2 | 0 |
| 26 | INMINIMO | DOUBLE | 8 | 2 |
| 27 | INMAXIMO | DOUBLE | 8 | 2 |
| 28 | INVRULTC | DOUBLE | 8 | 2 |
| 29 | INFCHULTC | INTEGER | 4 | 0 |
| 30 | INFCUSAL1 | INTEGER | 4 | 0 |
| 31 | INUBIC | CHARACTER | 10 | 0 |
| 32 | INCOMPRO | INTEGER | 4 | 0 |
| 33 | INGANAN | DOUBLE | 8 | 3 |
| 34 | INGANAN2 | DOUBLE | 8 | 3 |
| 35 | INGANAN3 | DOUBLE | 8 | 3 |
| 36 | INCONVER | DOUBLE | 8 | 5 |
| 37 | INTREPOS | SHORTINT | 2 | 0 |
| 38 | INPESO | LOGICAL | 1 | 0 |
| 39 | INFPRECIO | LOGICAL | 1 | 0 |
| 40 | INFORMULA | CHARACTER | 2 | 0 |
| 41 | INOUT | CHARACTER | 1 | 0 |
| 42 | INCOSTO00 | DOUBLE | 8 | 2 |
| 43 | INSALDO00 | DOUBLE | 8 | 3 |
| 44 | INSALDO002 | DOUBLE | 8 | 3 |
| 45 | IEU01 | DOUBLE | 8 | 3 |
| 46 | IEV01 | DOUBLE | 8 | 2 |
| 47 | ISV01 | DOUBLE | 8 | 2 |
| 48 | ISU01 | DOUBLE | 8 | 3 |
| 49 | IEU02 | DOUBLE | 8 | 3 |
| 50 | IEV02 | DOUBLE | 8 | 2 |
| 51 | ISU02 | DOUBLE | 8 | 3 |
| 52 | ISV02 | DOUBLE | 8 | 2 |
| 53 | IEU03 | DOUBLE | 8 | 3 |
| 54 | IEV03 | DOUBLE | 8 | 2 |
| 55 | ISU03 | DOUBLE | 8 | 3 |
| 56 | ISV03 | DOUBLE | 8 | 2 |
| 57 | IEU04 | DOUBLE | 8 | 3 |
| 58 | IEV04 | DOUBLE | 8 | 2 |
| 59 | ISU04 | DOUBLE | 8 | 3 |
| 60 | ISV04 | DOUBLE | 8 | 2 |
| 61 | IEU05 | DOUBLE | 8 | 3 |
| 62 | IEV05 | DOUBLE | 8 | 2 |
| 63 | ISU05 | DOUBLE | 8 | 3 |
| 64 | ISV05 | DOUBLE | 8 | 2 |
| 65 | IEU06 | DOUBLE | 8 | 3 |
| 66 | IEV06 | DOUBLE | 8 | 2 |
| 67 | ISU06 | DOUBLE | 8 | 3 |
| 68 | ISV06 | DOUBLE | 8 | 2 |
| 69 | IEU07 | DOUBLE | 8 | 3 |
| 70 | IEV07 | DOUBLE | 8 | 2 |
| 71 | ISU07 | DOUBLE | 8 | 3 |
| 72 | ISV07 | DOUBLE | 8 | 2 |
| 73 | IEU08 | DOUBLE | 8 | 3 |
| 74 | IEV08 | DOUBLE | 8 | 2 |
| 75 | ISU08 | DOUBLE | 8 | 3 |
| 76 | ISV08 | DOUBLE | 8 | 2 |
| 77 | IEU09 | DOUBLE | 8 | 3 |
| 78 | IEV09 | DOUBLE | 8 | 2 |
| 79 | ISU09 | DOUBLE | 8 | 3 |
| 80 | ISV09 | DOUBLE | 8 | 2 |
| 81 | IEU10 | DOUBLE | 8 | 3 |
| 82 | IEV10 | DOUBLE | 8 | 2 |
| 83 | ISU10 | DOUBLE | 8 | 3 |
| 84 | ISV10 | DOUBLE | 8 | 2 |
| 85 | IEU11 | DOUBLE | 8 | 3 |
| 86 | IEV11 | DOUBLE | 8 | 2 |
| 87 | ISU11 | DOUBLE | 8 | 3 |
| 88 | ISV11 | DOUBLE | 8 | 2 |
| 89 | IEU12 | DOUBLE | 8 | 3 |
| 90 | IEV12 | DOUBLE | 8 | 2 |
| 91 | ISU12 | DOUBLE | 8 | 3 |
| 92 | ISV12 | DOUBLE | 8 | 2 |
| 93 | IEU13 | DOUBLE | 8 | 3 |
| 94 | IEV13 | DOUBLE | 8 | 2 |
| 95 | ISU13 | DOUBLE | 8 | 3 |
| 96 | ISV13 | DOUBLE | 8 | 2 |
| 97 | INRETEN | CHARACTER | 2 | 0 |
| 98 | INARTICES | DOUBLE | 8 | 2 |
| 99 | INFINANCIA | CHARACTER | 1 | 0 |
| 100 | INASALDO | LOGICAL | 1 | 0 |
| 101 | INTRANSF | CHARACTER | 19 | 0 |
| 102 | INCPESO | DOUBLE | 8 | 2 |
| 103 | INMARCA | CHARACTER | 16 | 0 |
| 104 | INFRACC | DOUBLE | 8 | 5 |
| 105 | INVLFRA | DOUBLE | 8 | 2 |
| 106 | INPRESEN | CHARACTER | 3 | 0 |
| 107 | INBLOQUEO | CHARACTER | 1 | 0 |
| 108 | INVTACOS | LOGICAL | 1 | 0 |
| 109 | VTA01 | DOUBLE | 8 | 2 |
| 110 | VTA02 | DOUBLE | 8 | 2 |
| 111 | VTA03 | DOUBLE | 8 | 2 |
| 112 | VTA04 | DOUBLE | 8 | 2 |
| 113 | VTA05 | DOUBLE | 8 | 2 |
| 114 | VTA06 | DOUBLE | 8 | 2 |
| 115 | VTA07 | DOUBLE | 8 | 2 |
| 116 | VTA08 | DOUBLE | 8 | 2 |
| 117 | VTA09 | DOUBLE | 8 | 2 |
| 118 | VTA10 | DOUBLE | 8 | 2 |
| 119 | VTA11 | DOUBLE | 8 | 2 |
| 120 | VTA12 | DOUBLE | 8 | 2 |
| 121 | VTA13 | DOUBLE | 8 | 2 |
| 122 | INACTIVO | CHARACTER | 1 | 0 |
| 123 | INFECHA | INTEGER | 4 | 0 |
| 124 | INBLOCOM | LOGICAL | 1 | 0 |
| 125 | INAPLIDCTO | LOGICAL | 1 | 0 |
| 126 | INPTOPOS | DOUBLE | 8 | 2 |
| 127 | INEAN14 | CHARACTER | 14 | 0 |
| 128 | INTIPOFRA | DOUBLE | 8 | 0 |
| 129 | INPROTOR | CHARACTER | 40 | 0 |
| 130 | INCUM | CHARACTER | 18 | 0 |
| 131 | ININVIMA | CHARACTER | 20 | 0 |
| 132 | INMARCAP | CHARACTER | 20 | 0 |
| 133 | INNOMBRE4 | CHARACTER | 100 | 0 |
| 134 | INWEB | LOGICAL | 1 | 0 |
| 135 | INFCHREG | DOUBLE | 8 | 0 |
| 136 | INGARANTIA | CHARACTER | 20 | 0 |
| 137 | INARTOFER | CHARACTER | 19 | 0 |
| 138 | INSUBEPRE | LOGICAL | 1 | 0 |
| 139 | INREGIMPC | LOGICAL | 1 | 0 |
| 140 | INSALDOWEB | DOUBLE | 8 | 0 |
| 141 | INGSALWEB | LOGICAL | 1 | 0 |
| 142 | INBOTONG | LOGICAL | 1 | 0 |
| 143 | INDCTO3X2 | LOGICAL | 1 | 0 |
| 144 | INIMPCOSTO | LOGICAL | 1 | 0 |
| 145 | INTIENDAB | LOGICAL | 1 | 0 |
| 146 | INCCOSTO | CHARACTER | 7 | 0 |
| 147 | INCOSIVA | LOGICAL | 1 | 0 |
| 148 | INCOSNIIF | DOUBLE | 8 | 0 |
| 149 | INSALNIIF | DOUBLE | 8 | 0 |
| 150 | INVALNIIF | DOUBLE | 8 | 0 |
| 151 | INROTNIIF | DOUBLE | 8 | 0 |
| 152 | INCANNIIF | DOUBLE | 8 | 0 |
| 153 | NIFCOSTO00 | DOUBLE | 8 | 0 |
| 154 | NIFEV01 | DOUBLE | 8 | 0 |
| 155 | NIFSV01 | DOUBLE | 8 | 0 |
| 156 | NIFEV02 | DOUBLE | 8 | 0 |
| 157 | NIFSV02 | DOUBLE | 8 | 0 |
| 158 | NIFEV03 | DOUBLE | 8 | 0 |
| 159 | NIFSV03 | DOUBLE | 8 | 0 |
| 160 | NIFEV04 | DOUBLE | 8 | 0 |
| 161 | NIFSV04 | DOUBLE | 8 | 0 |
| 162 | NIFEV05 | DOUBLE | 8 | 0 |
| 163 | NIFSV05 | DOUBLE | 8 | 0 |
| 164 | NIFEV06 | DOUBLE | 8 | 0 |
| 165 | NIFSV06 | DOUBLE | 8 | 0 |
| 166 | NIFEV07 | DOUBLE | 8 | 0 |
| 167 | NIFSV07 | DOUBLE | 8 | 0 |
| 168 | NIFEV08 | DOUBLE | 8 | 0 |
| 169 | NIFSV08 | DOUBLE | 8 | 0 |
| 170 | NIFEV09 | DOUBLE | 8 | 0 |
| 171 | NIFSV09 | DOUBLE | 8 | 0 |
| 172 | NIFEV10 | DOUBLE | 8 | 0 |
| 173 | NIFSV10 | DOUBLE | 8 | 0 |
| 174 | NIFEV11 | DOUBLE | 8 | 0 |
| 175 | NIFSV11 | DOUBLE | 8 | 0 |
| 176 | NIFEV12 | DOUBLE | 8 | 0 |
| 177 | NIFSV12 | DOUBLE | 8 | 0 |
| 178 | NIFEV13 | DOUBLE | 8 | 0 |
| 179 | NIFSV13 | DOUBLE | 8 | 0 |
| 180 | MODI1 | CHARACTER | 10 | 0 |
| 181 | MODI2 | CHARACTER | 10 | 0 |
| 182 | MODI3 | CHARACTER | 10 | 0 |
| 183 | MODI4 | CHARACTER | 10 | 0 |
| 184 | MODI5 | CHARACTER | 10 | 0 |
| 185 | INEMBALAJE2 | DOUBLE | 8 | 0 |
| 186 | INPORIMC | DOUBLE | 8 | 0 |
| 187 | INFAMIS | LOGICAL | 1 | 0 |
| 188 | INGANAN4 | DOUBLE | 8 | 3 |
| 189 | INGANAN5 | DOUBLE | 8 | 3 |
| 190 | INGANAN6 | DOUBLE | 8 | 3 |
| 191 | INGANAN7 | DOUBLE | 8 | 3 |
| 192 | INGANAN8 | DOUBLE | 8 | 3 |
| 193 | INGANAN9 | DOUBLE | 8 | 3 |
| 194 | DESMAR1 | CHARACTER | 30 | 0 |
| 195 | DESMAR2 | CHARACTER | 30 | 0 |
| 196 | DESMAR3 | CHARACTER | 30 | 0 |
| 197 | DESMAR4 | CHARACTER | 30 | 0 |
| 198 | DESMAR5 | CHARACTER | 30 | 0 |
| 199 | DESMAR6 | CHARACTER | 30 | 0 |
| 200 | DESMAR7 | CHARACTER | 30 | 0 |
| 201 | DESMAR8 | CHARACTER | 30 | 0 |
| 202 | DESMAR9 | CHARACTER | 30 | 0 |
| 203 | SACATWEB | LOGICAL | 1 | 0 |
| 204 | INALTO | DOUBLE | 8 | 0 |
| 205 | INANCHO | DOUBLE | 8 | 0 |
| 206 | INLARGO | DOUBLE | 8 | 0 |
| 207 | INACTI1 | CHARACTER | 3 | 0 |
| 208 | INACTI2 | CHARACTER | 3 | 0 |
| 209 | INACTI3 | CHARACTER | 3 | 0 |
| 210 | INACTI4 | CHARACTER | 3 | 0 |
| 211 | INACTI5 | CHARACTER | 3 | 0 |
| 212 | INAPP | LOGICAL | 1 | 0 |
| 213 | INESCA | CHARACTER | 2 | 0 |
| 214 | INACTI6 | CHARACTER | 3 | 0 |
| 215 | INACTI7 | CHARACTER | 3 | 0 |
| 216 | INACTI8 | CHARACTER | 3 | 0 |
| 217 | INACTI9 | CHARACTER | 3 | 0 |
| 218 | INACTI10 | CHARACTER | 3 | 0 |
| 219 | INOPLOG | LOGICAL | 1 | 0 |
| 220 | INVTACAF | LOGICAL | 1 | 0 |
| 221 | INFINVIMA | DOUBLE | 8 | 0 |
| 222 | INWEBSER | LOGICAL | 1 | 0 |
| 223 | INR1 | CHARACTER | 1 | 0 |
| 224 | INR2 | CHARACTER | 1 | 0 |
| 225 | INR3 | CHARACTER | 1 | 0 |
| 226 | INR4 | CHARACTER | 1 | 0 |
| 227 | INR5 | CHARACTER | 1 | 0 |
| 228 | INDOMICOM | LOGICAL | 1 | 0 |
| 229 | INDOMIURL | CHARACTER | 100 | 0 |
| 230 | INIUM1 | CHARACTER | 15 | 0 |
| 231 | INIUM2 | CHARACTER | 15 | 0 |
| 232 | INIUM3 | CHARACTER | 15 | 0 |
| 233 | INDOMIRAP | LOGICAL | 1 | 0 |
| 234 | ARTICDSI | LOGICAL | 1 | 0 |
| 235 | INCATE | CHARACTER | 3 | 0 |
| 236 | ETIDIG | CHARACTER | 1 | 0 |
| 237 | ETI_IDP | CHARACTER | 20 | 0 |
| 238 | ETI_PUM | CHARACTER | 20 | 0 |
| 239 | ETI_TEMPL1 | CHARACTER | 20 | 0 |
| 240 | ETI_TEMPL2 | CHARACTER | 20 | 0 |
| 241 | ETI_IDT | CHARACTER | 20 | 0 |
| 242 | ININACVER | LOGICAL | 1 | 0 |
| 243 | INETISEC | CHARACTER | 1 | 0 |
| 244 | INACTI11 | CHARACTER | 3 | 0 |
| 245 | INACTI12 | CHARACTER | 3 | 0 |
| 246 | INACTI13 | CHARACTER | 3 | 0 |
| 247 | INACTI14 | CHARACTER | 3 | 0 |
| 248 | INACTI15 | CHARACTER | 3 | 0 |
| 249 | INACTI16 | CHARACTER | 3 | 0 |
| 250 | INACTI17 | CHARACTER | 3 | 0 |
| 251 | INACTI18 | CHARACTER | 3 | 0 |
| 252 | INACTI19 | CHARACTER | 3 | 0 |
| 253 | INACTI20 | CHARACTER | 3 | 0 |
| 254 | INULTRAP | LOGICAL | 1 | 0 |
| 255 | INIMP4 | DOUBLE | 8 | 2 |
| 256 | INMETCOMP | DOUBLE | 8 | 0 |
| 257 | INFCHVIGMC | DOUBLE | 8 | 0 |
| 258 | INCLACOMP | CHARACTER | 1 | 0 |
| 259 | INUMINIDES | DOUBLE | 8 | 0 |
| 260 | INABC | CHARACTER | 1 | 0 |
| 261 | INRESERV | DOUBLE | 8 | 0 |
| 262 | INSEMANA | CHARACTER | 2 | 0 |
| 263 | INPRONOSTI | DOUBLE | 8 | 0 |
| 264 | INSTOCKPR | DOUBLE | 8 | 0 |
| 265 | INLARGO14 | DOUBLE | 8 | 0 |
| 266 | INANCHO14 | DOUBLE | 8 | 0 |
| 267 | INALTO14 | DOUBLE | 8 | 0 |
| 268 | INPESO14 | DOUBLE | 8 | 0 |
| 269 | INESTADO | CHARACTER | 50 | 0 |
| 270 | ID | AUTOINC | 4 | 0 |

## TIDSUCUR

Sucursales listadas en una rama de ILISTAR.

Uso: ILISTAR (CONTABDSI.PRG:2933).

### C:\VISADS\INVE\TIDSUCUR.ADT

13 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CTDIREC | CHARACTER | 30 | 0 |
| 2 | CTNOMBRE | CHARACTER | 20 | 0 |
| 3 | CTANOANT | CHARACTER | 2 | 0 |
| 4 | SUCURSAL | CHARACTER | 3 | 0 |
| 5 | MARCA | CHARACTER | 1 | 0 |
| 6 | CANT | DOUBLE | 8 | 2 |
| 7 | CANT2 | DOUBLE | 8 | 2 |
| 8 | CARGA | CHARACTER | 1 | 0 |
| 9 | CARPETA | CHARACTER | 40 | 0 |
| 10 | CTNPED | INTEGER | 4 | 0 |
| 11 | SUCUR2 | CHARACTER | 3 | 0 |
| 12 | CLACOMP | CHARACTER | 1 | 0 |
| 13 | OCEDI | LOGICAL | 1 | 0 |

## TIDTAB

Clasificaciones listadas en una rama de ILISTAR.

Uso: ILISTAR (CONTABDSI.PRG:2840).

### C:\VISADS\INVE\TIDTAB.ADT

65 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CTABCOD | CHARACTER | 7 | 0 |
| 2 | CTABDES | CHARACTER | 45 | 0 |
| 3 | LINEA | CHARACTER | 3 | 0 |
| 4 | CTABCOD1 | CHARACTER | 7 | 0 |
| 5 | NUMERO | DOUBLE | 8 | 0 |
| 6 | MAXDCTO | DOUBLE | 8 | 2 |
| 7 | RETENCION | CHARACTER | 2 | 0 |
| 8 | VENTAS01 | DOUBLE | 8 | 2 |
| 9 | VENTAS02 | DOUBLE | 8 | 2 |
| 10 | VENTAS03 | DOUBLE | 8 | 2 |
| 11 | VENTAS04 | DOUBLE | 8 | 2 |
| 12 | VENTAS05 | DOUBLE | 8 | 2 |
| 13 | VENTAS06 | DOUBLE | 8 | 2 |
| 14 | VENTAS07 | DOUBLE | 8 | 2 |
| 15 | VENTAS08 | DOUBLE | 8 | 2 |
| 16 | VENTAS09 | DOUBLE | 8 | 2 |
| 17 | VENTAS10 | DOUBLE | 8 | 2 |
| 18 | VENTAS11 | DOUBLE | 8 | 2 |
| 19 | VENTAS12 | DOUBLE | 8 | 2 |
| 20 | VENTAS13 | DOUBLE | 8 | 2 |
| 21 | ESCALAS | SHORTINT | 2 | 0 |
| 22 | CODIGO | CHARACTER | 12 | 0 |
| 23 | DIAS | SHORTINT | 2 | 0 |
| 24 | DIAS2 | SHORTINT | 2 | 0 |
| 25 | DIAS3 | SHORTINT | 2 | 0 |
| 26 | DIAS4 | SHORTINT | 2 | 0 |
| 27 | PRE01C | DOUBLE | 8 | 2 |
| 28 | PRE01V | DOUBLE | 8 | 2 |
| 29 | PRE02C | DOUBLE | 8 | 2 |
| 30 | PRE02V | DOUBLE | 8 | 2 |
| 31 | PRE03C | DOUBLE | 8 | 2 |
| 32 | PRE03V | DOUBLE | 8 | 2 |
| 33 | PRE04C | DOUBLE | 8 | 2 |
| 34 | PRE04V | DOUBLE | 8 | 2 |
| 35 | PRE05C | DOUBLE | 8 | 2 |
| 36 | PRE05V | DOUBLE | 8 | 2 |
| 37 | PRE06C | DOUBLE | 8 | 2 |
| 38 | PRE06V | DOUBLE | 8 | 2 |
| 39 | PRE07C | DOUBLE | 8 | 2 |
| 40 | PRE07V | DOUBLE | 8 | 2 |
| 41 | PRE08C | DOUBLE | 8 | 2 |
| 42 | PRE08V | DOUBLE | 8 | 2 |
| 43 | PRE09C | DOUBLE | 8 | 2 |
| 44 | PRE09V | DOUBLE | 8 | 2 |
| 45 | PRE10C | DOUBLE | 8 | 2 |
| 46 | PRE10V | DOUBLE | 8 | 2 |
| 47 | PRE11C | DOUBLE | 8 | 2 |
| 48 | PRE11V | DOUBLE | 8 | 2 |
| 49 | PRE12C | DOUBLE | 8 | 2 |
| 50 | PRE12V | DOUBLE | 8 | 2 |
| 51 | INVE | CHARACTER | 1 | 0 |
| 52 | CCOSTO | CHARACTER | 7 | 0 |
| 53 | CTIPDOC | CHARACTER | 2 | 0 |
| 54 | CTSERIAL | LOGICAL | 1 | 0 |
| 55 | CTAGRUP | CHARACTER | 2 | 0 |
| 56 | CTWEB | LOGICAL | 1 | 0 |
| 57 | BORRAR | CHARACTER | 1 | 0 |
| 58 | CPARTE | CHARACTER | 13 | 0 |
| 59 | CTSUBSI | LOGICAL | 1 | 0 |
| 60 | CESTAETI | CHARACTER | 1 | 0 |
| 61 | CCODNPUM | CHARACTER | 20 | 0 |
| 62 | CACUVLR | DOUBLE | 8 | 0 |
| 63 | CACUIVA | DOUBLE | 8 | 0 |
| 64 | CACUCANT | DOUBLE | 8 | 0 |
| 65 | DIASINVEM | DOUBLE | 8 | 0 |

## TIDTIPOS

Tipos de inventario listados en una rama de ILISTAR.

Uso: ILISTAR (CONTABDSI.PRG:2876).

### C:\VISADS\INVE\TIDTIPOS.ADT

14 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CLASE | CHARACTER | 2 | 0 |
| 2 | TIPO | CHARACTER | 2 | 0 |
| 3 | NOMBRE | CHARACTER | 30 | 0 |
| 4 | VALOR | DOUBLE | 8 | 6 |
| 5 | VALOR2 | DOUBLE | 8 | 6 |
| 6 | DECIMAL | CHARACTER | 1 | 0 |
| 7 | SALE | CHARACTER | 1 | 0 |
| 8 | FLAG | CHARACTER | 1 | 0 |
| 9 | VLRIMP3 | CHARACTER | 1 | 0 |
| 10 | BASE | DOUBLE | 8 | 2 |
| 11 | IMPUESTO | DOUBLE | 8 | 2 |
| 12 | OTROSIMP | DOUBLE | 8 | 2 |
| 13 | BASERET | DOUBLE | 8 | 2 |
| 14 | TIPOCOMBO | DOUBLE | 8 | 0 |

## TIDTRET

Tipos de retención listados en una rama de ILISTAR.

Uso: ILISTAR (CONTABDSI.PRG:2909).

### C:\VISADS\INVE\TIDTRET.ADT

10 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 40 | 0 |
| 3 | R1 | CHARACTER | 2 | 0 |
| 4 | R2 | CHARACTER | 2 | 0 |
| 5 | R3 | CHARACTER | 2 | 0 |
| 6 | R4 | CHARACTER | 2 | 0 |
| 7 | R5 | CHARACTER | 2 | 0 |
| 8 | R6 | CHARACTER | 2 | 0 |
| 9 | R7 | CHARACTER | 2 | 0 |
| 10 | R8 | CHARACTER | 2 | 0 |

## VEDVEN

Datos del vendedor en consultas y listados.

Uso: LISRUTASX (CONTAGRAL.PRG:1311); LISTER2 (CONTAGRAL.PRG:1599); PVENOK (CONTAGRAL.PRG:4120).

### C:\VISADS\POS\VEDVEN.ADT

23 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | VCODIGO | CHARACTER | 2 | 0 |
| 2 | VCEDULA | CHARACTER | 15 | 0 |
| 3 | VNOMBRE | CHARACTER | 30 | 0 |
| 4 | VDIRECCION | CHARACTER | 25 | 0 |
| 5 | VCIUDAD | CHARACTER | 12 | 0 |
| 6 | VTELEF | CHARACTER | 7 | 0 |
| 7 | VFCHING | INTEGER | 4 | 0 |
| 8 | VFCHRET | INTEGER | 4 | 0 |
| 9 | VCAUSALRET | CHARACTER | 20 | 0 |
| 10 | VPORCOMVEN | DOUBLE | 8 | 2 |
| 11 | VPORCOMREC | DOUBLE | 8 | 2 |
| 12 | VALOR | DOUBLE | 8 | 2 |
| 13 | DIAS1 | SHORTINT | 2 | 0 |
| 14 | DIAS2 | SHORTINT | 2 | 0 |
| 15 | DIAS3 | SHORTINT | 2 | 0 |
| 16 | DIAS4 | SHORTINT | 2 | 0 |
| 17 | VRUTA01 | CHARACTER | 6 | 0 |
| 18 | VRUTA02 | CHARACTER | 6 | 0 |
| 19 | VRUTA03 | CHARACTER | 6 | 0 |
| 20 | VRUTA04 | CHARACTER | 6 | 0 |
| 21 | VRUTA05 | CHARACTER | 6 | 0 |
| 22 | VRUTA06 | CHARACTER | 6 | 0 |
| 23 | VRUTA07 | CHARACTER | 7 | 0 |

## VISBODE

Bodegas/centros listados en una rama de ILISTAR.

Uso: ILISTAR (CONTABDSI.PRG:2824).

### C:\VISADS\VISBODE.ADT

11 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CCOSTO | CHARACTER | 2 | 0 |
| 2 | CNOMBRE | CHARACTER | 30 | 0 |
| 3 | CNIVEL | CHARACTER | 1 | 0 |
| 4 | CFLAG | CHARACTER | 1 | 0 |
| 5 | SALDOS | DOUBLE | 8 | 2 |
| 6 | COSTOS | DOUBLE | 8 | 2 |
| 7 | PROMEDIO | DOUBLE | 8 | 2 |
| 8 | BANO | SHORTINT | 2 | 0 |
| 9 | FACTURA | LOGICAL | 1 | 0 |
| 10 | INVE | LOGICAL | 1 | 0 |
| 11 | ASALDO | LOGICAL | 1 | 0 |

## XADFACTU

Catálogo fuente de elementos copiados por GRAVAFOR, según cAR.

Uso: GRAVAFOR (FACTAB.PRG:880).

### C:\VISADS\CXP\XADFACTU.ADT

18 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | ARCHI | CHARACTER | 1 | 0 |
| 3 | CAMPO | CHARACTER | 30 | 0 |
| 4 | NOMBRE | CHARACTER | 20 | 0 |
| 5 | LONGITUD | SHORTINT | 2 | 0 |
| 6 | TIPO | CHARACTER | 1 | 0 |
| 7 | IMP | CHARACTER | 1 | 0 |
| 8 | TAMANO | CHARACTER | 1 | 0 |
| 9 | FORMATO | CHARACTER | 14 | 0 |
| 10 | INICIAL | SHORTINT | 2 | 0 |
| 11 | FINAL | SHORTINT | 2 | 0 |
| 12 | FILA | DOUBLE | 8 | 2 |
| 13 | COLUMNA | DOUBLE | 8 | 2 |
| 14 | FILA2 | DOUBLE | 8 | 2 |
| 15 | COLUMNA2 | DOUBLE | 8 | 2 |
| 16 | LEYENDA | CHARACTER | 130 | 0 |
| 17 | FUENTE | SHORTINT | 2 | 0 |
| 18 | TIPOFTE | CHARACTER | 20 | 0 |

## XADFORMA

Elementos del formato en rutinas compartidas; depende de cAR/cT.

Uso: GRAVAFOR (FACTAB.PRG:879); FADGENF2 (FACTAB.PRG:980).

### C:\VISADS\CXP\XADFORMA.ADT

20 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | ARCHI | CHARACTER | 1 | 0 |
| 3 | CAMPO | CHARACTER | 30 | 0 |
| 4 | NOMBRE | CHARACTER | 20 | 0 |
| 5 | LONGITUD | SHORTINT | 2 | 0 |
| 6 | TIPO | CHARACTER | 1 | 0 |
| 7 | IMP | CHARACTER | 1 | 0 |
| 8 | TAMANO | CHARACTER | 1 | 0 |
| 9 | FORMATO | CHARACTER | 16 | 0 |
| 10 | INICIAL | SHORTINT | 2 | 0 |
| 11 | FINAL | SHORTINT | 2 | 0 |
| 12 | FILA | DOUBLE | 8 | 2 |
| 13 | COLUMNA | DOUBLE | 8 | 2 |
| 14 | FILA2 | DOUBLE | 8 | 2 |
| 15 | COLUMNA2 | DOUBLE | 8 | 2 |
| 16 | LEYENDA | CHARACTER | 130 | 0 |
| 17 | FUENTE | SHORTINT | 2 | 0 |
| 18 | TIPOFTE | CHARACTER | 20 | 0 |
| 19 | XTOTDEB | DOUBLE | 8 | 0 |
| 20 | XTOTCRE | DOUBLE | 8 | 0 |

## XADGENF

Definición de formatos en rutinas compartidas; depende del módulo/parámetro elegido.

Uso: FADGENF (FACTAB.PRG:723); FORMATO (CONTABDSI.PRG:1275); CONSIFOR (CONTABDSI.PRG:2376).

### C:\VISADS\CXP\XADGENF.ADT

16 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 25 | 0 |
| 3 | AMBIENTE | CHARACTER | 10 | 0 |
| 4 | INICIAL | CHARACTER | 1 | 0 |
| 5 | TAMANO | SHORTINT | 2 | 0 |
| 6 | LIMITES | SHORTINT | 2 | 0 |
| 7 | LIMITEI | SHORTINT | 2 | 0 |
| 8 | CONFIGURA | CHARACTER | 1 | 0 |
| 9 | SALE | CHARACTER | 1 | 0 |
| 10 | MONEDA | CHARACTER | 6 | 0 |
| 11 | COLA | CHARACTER | 8 | 0 |
| 12 | ANEXO | LOGICAL | 1 | 0 |
| 13 | AUTORIZA | LOGICAL | 1 | 0 |
| 14 | FPREVIEW | LOGICAL | 1 | 0 |
| 15 | CTAS | CHARACTER | 1 | 0 |
| 16 | LIMITES2 | DOUBLE | 8 | 0 |

## XADMAE

Documentos de cuentas por pagar usados en preparación fiscal.

Uso: MOVMEDCXP (DSITAB.PRG:3962); BORRACLI (CONTAGRAL.PRG:1016).

### C:\VISADS\CXP\XADMAE.ADT

76 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CCODIGO | CHARACTER | 10 | 0 |
| 2 | CSUCURSAL | CHARACTER | 3 | 0 |
| 3 | CEMPRESA | CHARACTER | 3 | 0 |
| 4 | CENTRY | CHARACTER | 2 | 0 |
| 5 | CTIPO | CHARACTER | 1 | 0 |
| 6 | CFACTURA | CHARACTER | 12 | 0 |
| 7 | CNINTER | CHARACTER | 12 | 0 |
| 8 | CNOMBRE | CHARACTER | 40 | 0 |
| 9 | CTIPEMP | CHARACTER | 2 | 0 |
| 10 | CFECFAC | INTEGER | 4 | 0 |
| 11 | CVLRBRU | DOUBLE | 8 | 2 |
| 12 | DCTOC1 | DOUBLE | 8 | 2 |
| 13 | CVLRIVA | DOUBLE | 8 | 2 |
| 14 | CVLRIMP2 | DOUBLE | 8 | 2 |
| 15 | CVLRIMP3 | DOUBLE | 8 | 2 |
| 16 | CVLRRET | DOUBLE | 8 | 2 |
| 17 | CVLRRET2 | DOUBLE | 8 | 2 |
| 18 | CVLRRET3 | DOUBLE | 8 | 2 |
| 19 | CVLRRET4 | DOUBLE | 8 | 2 |
| 20 | CVLRRET5 | DOUBLE | 8 | 2 |
| 21 | CPDFN | DOUBLE | 8 | 2 |
| 22 | CVLRFAC | DOUBLE | 8 | 2 |
| 23 | CFECVEN | INTEGER | 4 | 0 |
| 24 | CFECPAGO | INTEGER | 4 | 0 |
| 25 | CRECCAJA | CHARACTER | 8 | 0 |
| 26 | CVLRSUB | DOUBLE | 8 | 2 |
| 27 | SALDO00 | DOUBLE | 8 | 2 |
| 28 | DEB00 | DOUBLE | 8 | 2 |
| 29 | CRE00 | DOUBLE | 8 | 2 |
| 30 | DEB01 | DOUBLE | 8 | 2 |
| 31 | CRE01 | DOUBLE | 8 | 2 |
| 32 | DEB02 | DOUBLE | 8 | 2 |
| 33 | CRE02 | DOUBLE | 8 | 2 |
| 34 | DEB03 | DOUBLE | 8 | 2 |
| 35 | CRE03 | DOUBLE | 8 | 2 |
| 36 | DEB04 | DOUBLE | 8 | 2 |
| 37 | CRE04 | DOUBLE | 8 | 2 |
| 38 | DEB05 | DOUBLE | 8 | 2 |
| 39 | CRE05 | DOUBLE | 8 | 2 |
| 40 | DEB06 | DOUBLE | 8 | 2 |
| 41 | CRE06 | DOUBLE | 8 | 2 |
| 42 | DEB07 | DOUBLE | 8 | 2 |
| 43 | CRE07 | DOUBLE | 8 | 2 |
| 44 | DEB08 | DOUBLE | 8 | 2 |
| 45 | CRE08 | DOUBLE | 8 | 2 |
| 46 | DEB09 | DOUBLE | 8 | 2 |
| 47 | CRE09 | DOUBLE | 8 | 2 |
| 48 | DEB10 | DOUBLE | 8 | 2 |
| 49 | CRE10 | DOUBLE | 8 | 2 |
| 50 | DEB11 | DOUBLE | 8 | 2 |
| 51 | CRE11 | DOUBLE | 8 | 2 |
| 52 | DEB12 | DOUBLE | 8 | 2 |
| 53 | CRE12 | DOUBLE | 8 | 2 |
| 54 | DEB13 | DOUBLE | 8 | 2 |
| 55 | CRE13 | DOUBLE | 8 | 2 |
| 56 | CCONTA | CHARACTER | 1 | 0 |
| 57 | CCONCEP | CHARACTER | 40 | 0 |
| 58 | CESTADO | SHORTINT | 2 | 0 |
| 59 | SALDO | DOUBLE | 8 | 2 |
| 60 | MARCA | CHARACTER | 1 | 0 |
| 61 | CVLRPAGO | DOUBLE | 8 | 2 |
| 62 | CEDAD | SHORTINT | 2 | 0 |
| 63 | CZONA | CHARACTER | 2 | 0 |
| 64 | CCODRET | CHARACTER | 2 | 0 |
| 65 | CCODRET2 | CHARACTER | 2 | 0 |
| 66 | CCODRET3 | CHARACTER | 2 | 0 |
| 67 | CCODRET4 | CHARACTER | 2 | 0 |
| 68 | CCODRET5 | CHARACTER | 2 | 0 |
| 69 | CDCTOFIN | DOUBLE | 8 | 2 |
| 70 | CAUTORIZA | LOGICAL | 1 | 0 |
| 71 | CCAUSA | CHARACTER | 3 | 0 |
| 72 | CCANT | DOUBLE | 8 | 2 |
| 73 | CVENDED | CHARACTER | 2 | 0 |
| 74 | CVLRMP | DOUBLE | 8 | 0 |
| 75 | CIVAMP | DOUBLE | 8 | 0 |
| 76 | CVLRICUI | DOUBLE | 8 | 0 |

## XADMOVI

Importes y retenciones de cuentas por pagar para informes.

Uso: INFOR53R (CONINFOR.PRG:6280).

### C:\VISADS\CXP\XADMOVI.ADT

30 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | XDOCUM | CHARACTER | 12 | 0 |
| 2 | XENTRY | CHARACTER | 2 | 0 |
| 3 | XPROVEE | CHARACTER | 10 | 0 |
| 4 | XARTIC | CHARACTER | 3 | 0 |
| 5 | XNOMBRE | CHARACTER | 30 | 0 |
| 6 | XBRUTO | DOUBLE | 8 | 2 |
| 7 | XDCTO | DOUBLE | 8 | 2 |
| 8 | XPORIVA | DOUBLE | 8 | 2 |
| 9 | XIVA | DOUBLE | 8 | 2 |
| 10 | XNETO | DOUBLE | 8 | 2 |
| 11 | XPORRET | DOUBLE | 8 | 2 |
| 12 | XVLRRET | DOUBLE | 8 | 2 |
| 13 | XPORRETI | DOUBLE | 8 | 2 |
| 14 | XVLRRETI | DOUBLE | 8 | 2 |
| 15 | XIVAT | DOUBLE | 8 | 2 |
| 16 | XCTABRU | CHARACTER | 12 | 0 |
| 17 | XVLRRET3 | DOUBLE | 8 | 2 |
| 18 | XPORRET3 | DOUBLE | 8 | 2 |
| 19 | XVLRRET4 | DOUBLE | 8 | 2 |
| 20 | XPORRET4 | DOUBLE | 8 | 2 |
| 21 | XVLROTRO | DOUBLE | 8 | 2 |
| 22 | XVLRAIU | DOUBLE | 8 | 2 |
| 23 | XRETAD1 | DOUBLE | 8 | 2 |
| 24 | XRETAD2 | DOUBLE | 8 | 2 |
| 25 | XRETAD3 | DOUBLE | 8 | 2 |
| 26 | XRETAD4 | DOUBLE | 8 | 2 |
| 27 | XRETAD5 | DOUBLE | 8 | 2 |
| 28 | XDOCUM2 | CHARACTER | 12 | 0 |
| 29 | XFECHA | DOUBLE | 8 | 0 |
| 30 | XFCHVEN | DOUBLE | 8 | 0 |

## XADPAGOS

Condiciones/tipos de pago consultados para terceros.

Uso: VERNOM (CONTAGRAL.PRG:987); TRAB_CLI2 (CONTAGRAL.PRG:2731); TPAGOOK (CONTAGRAL.PRG:3294).

### C:\VISADS\CXP\XADPAGOS.ADT

9 campos.

| Orden | Campo | Tipo | Longitud | Decimales |
|---:|---|---|---:|---:|
| 1 | CODIGO | CHARACTER | 2 | 0 |
| 2 | NOMBRE | CHARACTER | 30 | 0 |
| 3 | IVA | LOGICAL | 1 | 0 |
| 4 | TEORICO | LOGICAL | 1 | 0 |
| 5 | RETEFTE | LOGICAL | 1 | 0 |
| 6 | RETEIVA | LOGICAL | 1 | 0 |
| 7 | RETEICA | LOGICAL | 1 | 0 |
| 8 | ANO | DATE | 4 | 0 |
| 9 | BASETEOR | DOUBLE | 8 | 0 |
