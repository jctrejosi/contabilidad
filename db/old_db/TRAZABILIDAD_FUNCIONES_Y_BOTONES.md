# Inventario de funciones y acciones para homologación

969 funciones/procedimientos de los 12 PRG propios del XPJ. Inventario trazable, NO certificación de 969 funciones ejecutadas.

Tablas directas = evidencia literal/cadena revisada del análisis anterior. Dependencias por llamadas = candidatas conservadoras, no rutas de ejecución confirmadas. Las funciones sin acceso acreditado pueden ser de interfaz, cálculo, apertura, impresión o acceso dinámico; no se consideran automáticamente cubiertas.

| Función | Fuente | Tablas directas | Tablas candidatas vía llamadas | Alias pendientes | Estado |
|---|---|---|---|---|---|
| MAIN | CONTABDSI.PRG:8 | CONMAE | ACTIVIDA, AFIART, AFITAB, AMORART, AMORTAB, CADEMP, CADFACTU, CADFORMA, CADGENF, CADMAE, CAUFACTU, CAUFORMA, CAUGENF, CIUDAD, COCENTRO, COMFACTU, COMFORMA, COMGENF, CONCECO2, CONCECOS, CONCTR, CONDECLA, CONDOCUM, CONEMP, CONFACTU, CONFORMA, CONGENF, CONINF1, CONIVA, CONMAE2, CONMAG1, CONMAG2, CONMAG3, CONMAGDT, CONMAGIT, CONMCOS, CONMOVI, CONPUC, CONREITE, CONREMAE, CONRET, CONRTER, CONSOLID, CONTCOS, CONTERCE, CONTICOM, CONTIDOC, CONTIIVA, CONTIRET, FADCLI, FADCON, FADDIA, FADFACTU, FADFORMA, FADGENF, FADITE, FADPAGO, FADTAB, INFORMES, MC&lt;lote&gt;, MOVxx, NOMCALEN, POSINFOR, TIDBODE, TIDFORMA, TIDGENF, TIDINVE, TIDPEDI, TIDSAL, TIDSUCUR, TIDTAB, TIDTIPOS, TIDTRET, VEDVEN, VISAUDI, VISBODE, VISDOCUM, VISION, VISTDOC, VISUSU, XADFACTU, XADFORMA, XADGENF, XADMAE, XADMOVI, XADPAGOS, XADPDF | — | No certificada: requiere cambios y pruebas |
| SALDOS_ANO | CONTABDSI.PRG:159 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| COMPRA01 | CONTABDSI.PRG:176 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ODLG_AGENDA | CONTABDSI.PRG:179 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ADM_LISTA | CONTABDSI.PRG:213 | — | ACTIVIDA, AFIART, AFITAB, AMORART, AMORTAB, CADEMP, CADFACTU, CADFORMA, CADGENF, CADMAE, CAUFACTU, CAUFORMA, CAUGENF, CIUDAD, COMFACTU, COMFORMA, COMGENF, CONCECO2, CONCECOS, CONCTR, CONDECLA, CONDOCUM, CONEMP, CONFACTU, CONFORMA, CONGENF, CONMAE, CONMAE2, CONMOVI, CONPUC, CONSOLID, CONTICOM, CONTIIVA, CONTIRET, FADCLI, FADCON, FADFACTU, FADFORMA, FADGENF, FADTAB, INFORMES, MC&lt;lote&gt;, MOVxx, NOMCALEN, TIDBODE, TIDFORMA, TIDGENF, TIDINVE, TIDPEDI, TIDSAL, TIDSUCUR, TIDTAB, TIDTIPOS, TIDTRET, VEDVEN, VISAUDI, VISBODE, VISDOCUM, VISION, VISTDOC, VISUSU, XADFACTU, XADFORMA, XADGENF, XADMAE, XADPAGOS | — | No certificada: requiere cambios y pruebas |
| MENU_MOVI | CONTABDSI.PRG:282 | — | CADGENF, CAUGENF, CIUDAD, COCENTRO, COMGENF, CONCECOS, CONCTR, CONDOCUM, CONEMP, CONFORMA, CONGENF, CONMAE, CONMOVI, CONREITE, CONREMAE, CONTICOM, CONTIDOC, CONTIIVA, CONTIRET, FADCLI, FADGENF, FADTAB, MC&lt;lote&gt;, MOVxx, NOMCALEN, TIDGENF, VISAUDI, VISDOCUM, VISION, VISUSU, XADGENF | — | No certificada: requiere cambios y pruebas |
| MENU_CONSULTA | CONTABDSI.PRG:307 | — | CIUDAD, COCENTRO, CONCECOS, CONDOCUM, CONEMP, CONMAE, FADCLI, FADDIA, FADITE, FADPAGO, FADTAB, MOVxx, NOMCALEN, VEDVEN, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| MENU_INFOR | CONTABDSI.PRG:327 | — | CADGENF, CAUGENF, CIUDAD, COCENTRO, COMGENF, CONCECO2, CONCECOS, CONCTR, CONEMP, CONFORMA, CONGENF, CONINF1, CONIVA, CONMAE, CONMAE2, CONMCOS, CONRET, CONRTER, CONTCOS, CONTERCE, CONTICOM, FADCLI, FADGENF, FADTAB, MOVxx, NOMCALEN, POSINFOR, TIDGENF, VISAUDI, VISDOCUM, VISTDOC, XADGENF, XADMOVI, XADPDF | — | No certificada: requiere cambios y pruebas |
| MENU_REPRO | CONTABDSI.PRG:439 | — | CIUDAD, CONCECOS, CONDOCUM, CONMAE, CONTICOM, CONTIIVA, CONTIRET, FADCLI, FADTAB, MOVxx, VISAUDI, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| MENU_CIERRE | CONTABDSI.PRG:454 | — | CONMOVI, CONTICOM, NOMCALEN, VISAUDI, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| MENU_MEDIOS | CONTABDSI.PRG:466 | — | CONCECOS, CONEMP, CONMAE, CONMAG1, CONMAG2, CONMAG3, CONMAGDT, CONMAGIT, CONSOLID, FADCLI, VISAUDI, XADMAE | — | No certificada: requiere cambios y pruebas |
| MENU_CONSO | CONTABDSI.PRG:491 | — | CONCECOS, CONEMP, CONMAE, CONSOLID, CONTICOM, MOVxx, VISAUDI | — | No certificada: requiere cambios y pruebas |
| INICIO | CONTABDSI.PRG:502 | CONCTR | CONEMP, CONMAE, VISION | — | No certificada: requiere cambios y pruebas |
| ABRE_CONTAB | CONTABDSI.PRG:648 | VISION | CONEMP | — | No certificada: requiere cambios y pruebas |
| INGRESO_CONTABLE | CONTABDSI.PRG:795 | — | CONEMP | — | No certificada: requiere cambios y pruebas |
| INGRESO_CONTABLE2 | CONTABDSI.PRG:815 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CTOBLOCK | CONTABDSI.PRG:825 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CHECKUSUARIO | CONTABDSI.PRG:830 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| TERMINA | CONTABDSI.PRG:851 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| PERMI | CONTABDSI.PRG:858 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CTADOC2 | CONTABDSI.PRG:876 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| CTADOC3 | CONTABDSI.PRG:910 | CONMAE | — | BALIMAE | No certificada: requiere cambios y pruebas |
| MESOK2 | CONTABDSI.PRG:941 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CTRMES | CONTABDSI.PRG:957 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CTRINFOR | CONTABDSI.PRG:968 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CTRPUERTO | CONTABDSI.PRG:1050 | — | — | TEMPP | Pendiente: alias dinámicos o temporales |
| PPP | CONTABDSI.PRG:1074 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| PPF | CONTABDSI.PRG:1138 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| WDATE | CONTABDSI.PRG:1222 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| VERARCHI | CONTABDSI.PRG:1227 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| TVMENU | CONTABDSI.PRG:1233 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| TVITEM | CONTABDSI.PRG:1236 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| FORMATO | CONTABDSI.PRG:1239 | CADGENF, CAUGENF, CONGENF, FADGENF, TIDGENF, XADGENF | COMGENF | — | No certificada: requiere cambios y pruebas |
| DSIFCH3 | CONTABDSI.PRG:1300 | NOMCALEN | — | — | No certificada: requiere cambios y pruebas |
| CTRMESC | CONTABDSI.PRG:1343 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CTAINFOX | CONTABDSI.PRG:1354 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| ASIGCTA | CONTABDSI.PRG:1366 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| TERCEAYU | CONTABDSI.PRG:1377 | — | FADCLI | — | No certificada: requiere cambios y pruebas |
| FONDORET | CONTABDSI.PRG:1389 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| AYUDAT | CONTABDSI.PRG:1401 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| PPFI_LINEA | CONTABDSI.PRG:1465 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| VISINO | CONTABDSI.PRG:1550 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| AUDIVIS | CONTABDSI.PRG:1558 | VISAUDI | — | — | No certificada: requiere cambios y pruebas |
| MODESTA2_NIIF | CONTABDSI.PRG:1577 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| MODESTA3_NIIF | CONTABDSI.PRG:1590 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONSULTAP | CONTABDSI.PRG:1604 | — | — | TEMP | Pendiente: alias dinámicos o temporales |
| DSIFCH | CONTABDSI.PRG:1649 | NOMCALEN | — | — | No certificada: requiere cambios y pruebas |
| DSIFCH2 | CONTABDSI.PRG:1694 | NOMCALEN | — | — | No certificada: requiere cambios y pruebas |
| FCHFAC2 | CONTABDSI.PRG:1758 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| NOMDOC | CONTABDSI.PRG:1784 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| TIPOD | CONTABDSI.PRG:1801 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONSULCLI | CONTABDSI.PRG:1823 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| MESMOV | CONTABDSI.PRG:1867 | — | NOMCALEN | — | No certificada: requiere cambios y pruebas |
| CONTARLINIECITAS | CONTABDSI.PRG:1884 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| LINIEACITAS | CONTABDSI.PRG:1894 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| PALABRITAS | CONTABDSI.PRG:1917 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| DBFCDX | CONTABDSI.PRG:1940 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONTROL | CONTABDSI.PRG:1943 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONSULTA | CONTABDSI.PRG:1953 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CLIESTA | CONTABDSI.PRG:1986 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| SALECC3 | CONTABDSI.PRG:2038 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ABREC31 | CONTABDSI.PRG:2050 | — | — | XALICC | Pendiente: alias dinámicos o temporales |
| AYUDEMP | CONTABDSI.PRG:2063 | CONEMP | — | — | No certificada: requiere cambios y pruebas |
| NUMDOC_SGASTOS | CONTABDSI.PRG:2095 | VISION | — | — | No certificada: requiere cambios y pruebas |
| ACTULOT | CONTABDSI.PRG:2132 | — | FADCLI | TALIMAE, TALILOT | No certificada: requiere cambios y pruebas |
| CONSULYA | CONTABDSI.PRG:2195 | — | — | CALI | Pendiente: alias dinámicos o temporales |
| DABUS | CONTABDSI.PRG:2211 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONSULBUS | CONTABDSI.PRG:2216 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| AYUDACL | CONTABDSI.PRG:2220 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| AYUDEMPL | CONTABDSI.PRG:2259 | CONEMP | — | — | No certificada: requiere cambios y pruebas |
| DOCUMVIS | CONTABDSI.PRG:2289 | VISDOCUM | CONTICOM, TIDPEDI, TIDSUCUR, TIDTAB, TIDTIPOS, TIDTRET, VISAUDI, VISBODE | — | No certificada: requiere cambios y pruebas |
| ODLG_INIT4 | CONTABDSI.PRG:2335 | — | CONTICOM, TIDPEDI, TIDSUCUR, TIDTAB, TIDTIPOS, TIDTRET, VISAUDI, VISBODE, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| CONSIFOR | CONTABDSI.PRG:2349 | CADGENF, CAUGENF, COMGENF, CONGENF, FADGENF, TIDGENF, XADGENF | — | — | No certificada: requiere cambios y pruebas |
| CLIBUS | CONTABDSI.PRG:2392 | — | FADCLI | — | No certificada: requiere cambios y pruebas |
| BUSCLIL | CONTABDSI.PRG:2410 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| CLIORDEN | CONTABDSI.PRG:2431 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| REALNIT | CONTABDSI.PRG:2460 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| TIPODOC | CONTABDSI.PRG:2482 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| TRAB_DOC | CONTABDSI.PRG:2495 | VISDOCUM | CONTICOM, VISAUDI | — | No certificada: requiere cambios y pruebas |
| BORRDOV | CONTABDSI.PRG:2799 | VISDOCUM | VISAUDI | — | No certificada: requiere cambios y pruebas |
| ILISTAR | CONTABDSI.PRG:2813 | TIDPEDI, TIDSUCUR, TIDTAB, TIDTIPOS, TIDTRET, VISBODE, VISDOCUM | — | CALI | No certificada: requiere cambios y pruebas |
| DOCESTA2 | CONTABDSI.PRG:2975 | VISDOCUM | — | — | No certificada: requiere cambios y pruebas |
| TICOMPR | CONTABDSI.PRG:2990 | CONTICOM | — | — | No certificada: requiere cambios y pruebas |
| GRABADOC | CONTABDSI.PRG:3019 | VISDOCUM | VISAUDI | — | No certificada: requiere cambios y pruebas |
| OKDOCC | CONTABDSI.PRG:3125 | VISDOCUM | — | — | No certificada: requiere cambios y pruebas |
| AYUDCOMP | CONTABDSI.PRG:3147 | CONTICOM | — | — | No certificada: requiere cambios y pruebas |
| ABRESUC_MER | CONTABDSI.PRG:3170 | TIDBODE | — | — | No certificada: requiere cambios y pruebas |
| ABRESUC_MER2 | CONTABDSI.PRG:3192 | TIDBODE | — | — | No certificada: requiere cambios y pruebas |
| CIERRSUC_MER | CONTABDSI.PRG:3246 | TIDBODE | — | — | No certificada: requiere cambios y pruebas |
| CIERRSUC_CLI | CONTABDSI.PRG:3265 | TIDBODE | — | — | No certificada: requiere cambios y pruebas |
| ABRESUC_CLI | CONTABDSI.PRG:3282 | TIDBODE | — | — | No certificada: requiere cambios y pruebas |
| ABRESUC_CLI2 | CONTABDSI.PRG:3305 | TIDBODE | — | — | No certificada: requiere cambios y pruebas |
| NICSALMOV | CONINFOR.PRG:6 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| NICSALMOV1 | CONINFOR.PRG:31 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| NICSALMOV2 | CONINFOR.PRG:72 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| NICSALMOV3 | CONINFOR.PRG:87 | CONMAE | — | TALIMOV | No certificada: requiere cambios y pruebas |
| NICAPER | CONINFOR.PRG:132 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| NICAPER2 | CONINFOR.PRG:155 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| NICAPER3 | CONINFOR.PRG:190 | CONMAE | — | TALIMOV, TALITEM | No certificada: requiere cambios y pruebas |
| CONIMP2 | CONINFOR.PRG:310 | — | MOVxx | — | No certificada: requiere cambios y pruebas |
| CONIMP22 | CONINFOR.PRG:344 | MOVxx | — | — | No certificada: requiere cambios y pruebas |
| GENINFT | CONINFOR.PRG:539 | INFORMES | CONCECOS, CONEMP, CONMAE, CONSOLID, VISAUDI | — | No certificada: requiere cambios y pruebas |
| INFORM1 | CONINFOR.PRG:584 | CONINF1 | CONMAE | — | No certificada: requiere cambios y pruebas |
| BORRINF | CONINFOR.PRG:619 | — | — | CALINF | Pendiente: alias dinámicos o temporales |
| INFORM11 | CONINFOR.PRG:631 | — | CONMAE | CALINF | No certificada: requiere cambios y pruebas |
| ESTAINF1 | CONINFOR.PRG:670 | — | — | CALINF | Pendiente: alias dinámicos o temporales |
| INFORM1G | CONINFOR.PRG:679 | — | — | CALINF | Pendiente: alias dinámicos o temporales |
| INFORM2 | CONINFOR.PRG:699 | — | CONEMP, CONINF1, CONMAE | — | No certificada: requiere cambios y pruebas |
| INFORM21 | CONINFOR.PRG:713 | CONINF1, CONMAE | — | — | No certificada: requiere cambios y pruebas |
| CONIMP | CONINFOR.PRG:1055 | — | CADGENF, CAUGENF, COMGENF, CONFORMA, CONGENF, FADCLI, FADGENF, MOVxx, TIDGENF, VISDOCUM, XADGENF | — | No certificada: requiere cambios y pruebas |
| CON123 | CONINFOR.PRG:1095 | CONFORMA, CONGENF, FADCLI, MOVxx | — | — | No certificada: requiere cambios y pruebas |
| CON123I | CONINFOR.PRG:1253 | CONFORMA | — | TALIMOV, TALIMAE, TALICLI | No certificada: requiere cambios y pruebas |
| CONMESA | CONINFOR.PRG:1337 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONMESA2 | CONINFOR.PRG:1380 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFOR01 | CONINFOR.PRG:1451 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| COLUM | CONINFOR.PRG:1472 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFOR011 | CONINFOR.PRG:1491 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFOR011X | CONINFOR.PRG:1580 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFOR02 | CONINFOR.PRG:1658 | — | COCENTRO, CONMAE | — | No certificada: requiere cambios y pruebas |
| MOVMENSU | CONINFOR.PRG:1705 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFOR21 | CONINFOR.PRG:1728 | — | COCENTRO, CONMAE | — | No certificada: requiere cambios y pruebas |
| INFOR21_3 | CONINFOR.PRG:1768 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| INFOR21A | CONINFOR.PRG:1782 | CONMAE | COCENTRO | — | No certificada: requiere cambios y pruebas |
| INCLU_CC | CONINFOR.PRG:2267 | COCENTRO | — | — | No certificada: requiere cambios y pruebas |
| MOVMENSU_CC | CONINFOR.PRG:2297 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFOR21B | CONINFOR.PRG:2327 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| ASIGNA_CORRI | CONINFOR.PRG:2788 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFOR21B_3 | CONINFOR.PRG:2851 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFOR04 | CONINFOR.PRG:3304 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| INFOR41 | CONINFOR.PRG:3333 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| INFOR41A | CONINFOR.PRG:3347 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFOR41B | CONINFOR.PRG:3639 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| MOVANUAL | CONINFOR.PRG:3915 | — | — | CA | Pendiente: alias dinámicos o temporales |
| INFOR03_2 | CONINFOR.PRG:3926 | — | FADCLI, MOVxx | — | No certificada: requiere cambios y pruebas |
| NOMCC | CONINFOR.PRG:3948 | CONCECOS | — | — | No certificada: requiere cambios y pruebas |
| NOMDOCUM | CONINFOR.PRG:3958 | VISDOCUM | — | — | No certificada: requiere cambios y pruebas |
| NOMCOMPRO | CONINFOR.PRG:3968 | CONTICOM | — | — | No certificada: requiere cambios y pruebas |
| NOMCLIT | CONINFOR.PRG:3978 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| INFOR31_2 | CONINFOR.PRG:3989 | — | FADCLI, MOVxx | — | No certificada: requiere cambios y pruebas |
| MOVI_DOC | CONINFOR.PRG:4076 | FADCLI, MOVxx | — | — | No certificada: requiere cambios y pruebas |
| SALDO_INIDOC | CONINFOR.PRG:4127 | FADCLI, MOVxx | — | — | No certificada: requiere cambios y pruebas |
| INFOR03 | CONINFOR.PRG:4159 | — | CONMAE, MOVxx, NOMCALEN | — | No certificada: requiere cambios y pruebas |
| INFOR31 | CONINFOR.PRG:4181 | — | CONMAE, MOVxx | — | No certificada: requiere cambios y pruebas |
| INFOR32X | CONINFOR.PRG:4227 | MOVxx | — | — | No certificada: requiere cambios y pruebas |
| INFOR31TX | CONINFOR.PRG:4326 | CONMAE | MOVxx | — | No certificada: requiere cambios y pruebas |
| INFOR31A | CONINFOR.PRG:4477 | CONMAE | MOVxx | — | No certificada: requiere cambios y pruebas |
| INFOR31B | CONINFOR.PRG:4642 | CONMAE | MOVxx | — | No certificada: requiere cambios y pruebas |
| INFOR31T | CONINFOR.PRG:4780 | CONMAE | MOVxx | — | No certificada: requiere cambios y pruebas |
| NOMCTA | CONINFOR.PRG:4941 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFOR32 | CONINFOR.PRG:4953 | MOVxx | — | — | No certificada: requiere cambios y pruebas |
| INFOR07 | CONINFOR.PRG:5096 | — | COCENTRO, CONMAE, CONTERCE, VISAUDI | — | No certificada: requiere cambios y pruebas |
| INFOR71B | CONINFOR.PRG:5164 | COCENTRO, CONMAE, CONTERCE | — | — | No certificada: requiere cambios y pruebas |
| ACU_COSTER | CONINFOR.PRG:5345 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| TERIMP | CONINFOR.PRG:5467 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFOR171 | CONINFOR.PRG:5508 | — | — | TALIAS, CALIMAE, CALICLI, CALICOS | Pendiente: alias dinámicos o temporales |
| INFOR171X | CONINFOR.PRG:5719 | — | — | TALIAS, CALIMAE, CALICLI, CALICOS | Pendiente: alias dinámicos o temporales |
| TERSALDO | CONINFOR.PRG:5879 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| LIMACUM | CONINFOR.PRG:5911 | COCENTRO, CONIVA, CONRET, CONTERCE | — | — | No certificada: requiere cambios y pruebas |
| LIMACUMB | CONINFOR.PRG:5987 | COCENTRO, CONIVA, CONRET, CONTERCE | — | — | No certificada: requiere cambios y pruebas |
| MESMAYO | CONINFOR.PRG:6060 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFOR05 | CONINFOR.PRG:6067 | — | CONMAE, XADMOVI | — | No certificada: requiere cambios y pruebas |
| INFOR51 | CONINFOR.PRG:6087 | CONMAE | XADMOVI | — | No certificada: requiere cambios y pruebas |
| INFOR52 | CONINFOR.PRG:6166 | — | XADMOVI | — | No certificada: requiere cambios y pruebas |
| INFOR53 | CONINFOR.PRG:6207 | — | XADMOVI | — | No certificada: requiere cambios y pruebas |
| INFOR53R | CONINFOR.PRG:6215 | XADMOVI | — | TALIMOV, TALIXMAE, CALIMOV, TALIAS | No certificada: requiere cambios y pruebas |
| INFOR53I | CONINFOR.PRG:6404 | — | — | TALIMOV, TALIXMAE, TALIAS | Pendiente: alias dinámicos o temporales |
| LIMMESRI | CONINFOR.PRG:6483 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFOR07C | CONINFOR.PRG:6507 | COCENTRO | CONCECOS, CONMAE, FADCLI | — | No certificada: requiere cambios y pruebas |
| INFOR07T | CONINFOR.PRG:6564 | CONTERCE | — | — | No certificada: requiere cambios y pruebas |
| NOMCLI_I | CONINFOR.PRG:6613 | — | — | CALICLI | Pendiente: alias dinámicos o temporales |
| NOMCTA_I | CONINFOR.PRG:6621 | — | — | CALIMAE | Pendiente: alias dinámicos o temporales |
| TERANO | CONINFOR.PRG:6630 | — | — | TALIAS, CALICLI, CALICOS | Pendiente: alias dinámicos o temporales |
| INFOR15 | CONINFOR.PRG:6775 | CONIVA, CONRET | CONCTR, CONMAE, FADCLI, XADPDF | — | No certificada: requiere cambios y pruebas |
| BUSCTAR | CONINFOR.PRG:6932 | — | CONMAE | TALIRET | No certificada: requiere cambios y pruebas |
| FILRET | CONINFOR.PRG:6952 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| FILRET2 | CONINFOR.PRG:6973 | — | CONMAE | TALIRET | No certificada: requiere cambios y pruebas |
| FILRET8 | CONINFOR.PRG:6983 | — | — | TALIRET | Pendiente: alias dinámicos o temporales |
| VERITRE | CONINFOR.PRG:7052 | CONMAE | — | TALIRET, TALICLI | No certificada: requiere cambios y pruebas |
| INFOR16C | CONINFOR.PRG:7203 | CONCTR | CONMAE, FADCLI, XADPDF | TALIRET | No certificada: requiere cambios y pruebas |
| ASIGTIPC | CONINFOR.PRG:7265 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFOR16I | CONINFOR.PRG:7274 | CONMAE | XADPDF | TALICTR, TALIRET, TALICLI | No certificada: requiere cambios y pruebas |
| CARGA_PORTAL | CONINFOR.PRG:8425 | — | FADCLI, NOMCALEN, XADPDF | — | No certificada: requiere cambios y pruebas |
| CARGA_PORTAL2 | CONINFOR.PRG:8486 | XADPDF | — | — | No certificada: requiere cambios y pruebas |
| BORRA_PORTAL | CONINFOR.PRG:8531 | XADPDF | — | — | No certificada: requiere cambios y pruebas |
| CARGA_PORTAL3 | CONINFOR.PRG:8543 | XADPDF | — | — | No certificada: requiere cambios y pruebas |
| INFOR16I_PDF | CONINFOR.PRG:8627 | CONMAE, XADPDF | — | TALICTR, TALIRET, TALICLI | No certificada: requiere cambios y pruebas |
| VALRET3 | CONINFOR.PRG:9199 | — | — | TALIRET | Pendiente: alias dinámicos o temporales |
| VALRET2 | CONINFOR.PRG:9369 | CONMAE | — | TALIRET | No certificada: requiere cambios y pruebas |
| VALRET2_PDF | CONINFOR.PRG:9520 | CONMAE | — | TALIRET | No certificada: requiere cambios y pruebas |
| VALRET2E | CONINFOR.PRG:9655 | CONMAE | — | TALIRET | No certificada: requiere cambios y pruebas |
| VALRET2RI | CONINFOR.PRG:9798 | — | — | TALIRET | Pendiente: alias dinámicos o temporales |
| VALRET2RI_PDF | CONINFOR.PRG:9881 | — | — | TALIRET | Pendiente: alias dinámicos o temporales |
| INFOR09C | CONINFOR.PRG:9959 | — | COCENTRO, CONCECOS, CONMAE, FADCLI | — | No certificada: requiere cambios y pruebas |
| INFOR_NIIF | CONINFOR.PRG:9996 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFOR091 | CONINFOR.PRG:10010 | COCENTRO, CONCECOS, CONMAE, FADCLI | — | — | No certificada: requiere cambios y pruebas |
| SQL_ESC_ADS | CONINFOR.PRG:10710 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFOR091XX | CONINFOR.PRG:10718 | — | — | TALICEN, TALIMAE, TALICOS, TALICLI | Pendiente: alias dinámicos o temporales |
| INFOR07D | CONINFOR.PRG:11312 | — | CONMAE, FADCLI | — | No certificada: requiere cambios y pruebas |
| INFOR174 | CONINFOR.PRG:11353 | CONMAE, FADCLI | — | CALIMOV | No certificada: requiere cambios y pruebas |
| INFOR174X | CONINFOR.PRG:11912 | CONMAE | — | CALIMOV, CALICLI | No certificada: requiere cambios y pruebas |
| TER174 | CONINFOR.PRG:12264 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFOR08 | CONINFOR.PRG:12369 | — | CONMAE, CONTICOM, MOVxx, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| INFOR81 | CONINFOR.PRG:12402 | CONMAE, CONTICOM, MOVxx, VISDOCUM | — | TALIMOV | No certificada: requiere cambios y pruebas |
| INFOR81X | CONINFOR.PRG:12705 | — | — | TALIMOV, CALICOM, CALIMAE, CALIDOC | Pendiente: alias dinámicos o temporales |
| INFOR09 | CONINFOR.PRG:12909 | — | COCENTRO, CONMAE | — | No certificada: requiere cambios y pruebas |
| INFOR09G | CONINFOR.PRG:12938 | — | COCENTRO, CONMAE | — | No certificada: requiere cambios y pruebas |
| INFOR10 | CONINFOR.PRG:12943 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| INFOR101 | CONINFOR.PRG:12968 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFOR101X | CONINFOR.PRG:13155 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFOR11 | CONINFOR.PRG:13301 | — | CONMAE, MOVxx | — | No certificada: requiere cambios y pruebas |
| INFOR111 | CONINFOR.PRG:13323 | CONMAE, MOVxx | — | — | No certificada: requiere cambios y pruebas |
| INFOR111X | CONINFOR.PRG:13446 | CONMAE | — | TALIMOV | No certificada: requiere cambios y pruebas |
| INFOR12 | CONINFOR.PRG:13544 | — | CONMAE, CONTICOM, MOVxx, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| VERTCOMPR | CONINFOR.PRG:13580 | MOVxx | CONTICOM, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| CPRXDOC | CONINFOR.PRG:13602 | CONTICOM, VISDOCUM | — | — | No certificada: requiere cambios y pruebas |
| INFOR121 | CONINFOR.PRG:13617 | CONMAE, CONTICOM, MOVxx | VISDOCUM | TALITEM | No certificada: requiere cambios y pruebas |
| INFOR121X | CONINFOR.PRG:13841 | CONMAE | — | TALIMOV, TALICOMP, TALITEM | No certificada: requiere cambios y pruebas |
| INFOR122 | CONINFOR.PRG:13968 | CONMAE, CONTICOM, MOVxx | — | TEM2, TALIMOV | No certificada: requiere cambios y pruebas |
| INFOR122X | CONINFOR.PRG:14114 | CONMAE | — | TALIMOV, TALICOMP | No certificada: requiere cambios y pruebas |
| INFOR12G | CONINFOR.PRG:14191 | — | — | TALITEM | Pendiente: alias dinámicos o temporales |
| INFOR13 | CONINFOR.PRG:14266 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| INFOR131 | CONINFOR.PRG:14300 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFOR131X | CONINFOR.PRG:14442 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFOR14 | CONINFOR.PRG:14571 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| INFOR141 | CONINFOR.PRG:14608 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFOR141X | CONINFOR.PRG:15085 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFOR14L | CONINFOR.PRG:15583 | — | CONEMP, CONMAE | — | No certificada: requiere cambios y pruebas |
| MESL | CONINFOR.PRG:15632 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFOR14L1 | CONINFOR.PRG:15698 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFO015 | CONINFOR.PRG:15842 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| INFO151 | CONINFOR.PRG:15872 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFO151X | CONINFOR.PRG:16155 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INF15TOT | CONINFOR.PRG:16473 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INF15TOTX | CONINFOR.PRG:16524 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INF15IG | CONINFOR.PRG:16575 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFOR0K2 | CONINFOR.PRG:16613 | — | CONCECOS, CONMAE, FADCLI, MOVxx | — | No certificada: requiere cambios y pruebas |
| INFOR0K21 | CONINFOR.PRG:16649 | CONCECOS, CONMAE, FADCLI, MOVxx | — | — | No certificada: requiere cambios y pruebas |
| INFOR0K21X | CONINFOR.PRG:17100 | CONMAE | — | TALIMOV, CALICLI | No certificada: requiere cambios y pruebas |
| INFOR0K | CONINFOR.PRG:17459 | — | CONCECOS, CONMAE, FADCLI, MOVxx | — | No certificada: requiere cambios y pruebas |
| INFOR0K1 | CONINFOR.PRG:17490 | CONCECOS, CONMAE, FADCLI, MOVxx | — | — | No certificada: requiere cambios y pruebas |
| INFOR0K1X1 | CONINFOR.PRG:17842 | CONCECOS, CONMAE | — | TALIMOV, CALICLI | No certificada: requiere cambios y pruebas |
| INFOR09D | CONINFOR.PRG:18135 | — | NOMCALEN | — | No certificada: requiere cambios y pruebas |
| INFOR0D1 | CONINFOR.PRG:18164 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFOR0D2 | CONINFOR.PRG:18214 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFOR0D3 | CONINFOR.PRG:18243 | — | — | TALIMOV, TALIMAE, TALICC | Pendiente: alias dinámicos o temporales |
| INFOR0D4 | CONINFOR.PRG:18279 | — | — | TALICC, TALIMAE, TALICOS | Pendiente: alias dinámicos o temporales |
| INFOR0D4X | CONINFOR.PRG:18410 | — | — | TALICC, TALIMAE, TALICOS | Pendiente: alias dinámicos o temporales |
| INFOR0L | CONINFOR.PRG:18531 | — | COCENTRO, CONCECOS, CONMAE | — | No certificada: requiere cambios y pruebas |
| RETECTA | CONINFOR.PRG:18576 | — | CONIVA, CONMAE, CONRET | — | No certificada: requiere cambios y pruebas |
| RETCTA2 | CONINFOR.PRG:18607 | CONIVA, CONMAE, CONRET | — | — | No certificada: requiere cambios y pruebas |
| RETCTA2X | CONINFOR.PRG:18754 | — | — | TALIRET, TALIMAE | Pendiente: alias dinámicos o temporales |
| INFOR152 | CONINFOR.PRG:18835 | — | CONIVA, CONMAE, CONRET, FADCLI, VISTDOC | — | No certificada: requiere cambios y pruebas |
| INFOR153 | CONINFOR.PRG:18879 | CONIVA, CONMAE, CONRET, FADCLI | VISTDOC | — | No certificada: requiere cambios y pruebas |
| INFOR153X | CONINFOR.PRG:19243 | VISTDOC | — | TALIRET, TALIMAE, TALICLI | No certificada: requiere cambios y pruebas |
| ANEXIMP | CONINFOR.PRG:19538 | — | CONMAE, FADCLI, NOMCALEN | — | No certificada: requiere cambios y pruebas |
| ANEXIMP2 | CONINFOR.PRG:19574 | FADCLI | CONMAE | CMOV | No certificada: requiere cambios y pruebas |
| ANEXIMP3 | CONINFOR.PRG:19878 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| ANEXIMP4 | CONINFOR.PRG:19902 | CONMAE | — | TALIMOV, CMOV | No certificada: requiere cambios y pruebas |
| INFORO1N | CONINFOR.PRG:19954 | — | CONMAE, MOVxx, NOMCALEN | — | No certificada: requiere cambios y pruebas |
| INFORO1N1 | CONINFOR.PRG:19978 | — | CONMAE, MOVxx | TALIAS | No certificada: requiere cambios y pruebas |
| INFOROBU | CONINFOR.PRG:20062 | — | — | TALIAS | Pendiente: alias dinámicos o temporales |
| INFORO13 | CONINFOR.PRG:20074 | — | — | TALIAS | Pendiente: alias dinámicos o temporales |
| INFOO13G | CONINFOR.PRG:20100 | — | — | TALIAS | Pendiente: alias dinámicos o temporales |
| INFORO14 | CONINFOR.PRG:20111 | CONMAE | — | TALIAS, CALICLI | No certificada: requiere cambios y pruebas |
| INFORO14X | CONINFOR.PRG:20233 | CONMAE | — | TALIAS, CALICLI | No certificada: requiere cambios y pruebas |
| INFORO12 | CONINFOR.PRG:20327 | MOVxx | — | TALIAS | No certificada: requiere cambios y pruebas |
| INFORQ1 | CONINFOR.PRG:20357 | — | CONMAE, FADCLI, MOVxx | — | No certificada: requiere cambios y pruebas |
| INFORQ1_G | CONINFOR.PRG:20387 | — | CONMAE, FADCLI, MOVxx | — | No certificada: requiere cambios y pruebas |
| INFORQ1_XLS | CONINFOR.PRG:20421 | CONMAE, FADCLI | — | TALITEM | No certificada: requiere cambios y pruebas |
| INFORQ1_M | CONINFOR.PRG:20487 | FADCLI, MOVxx | — | TALITEM | No certificada: requiere cambios y pruebas |
| INFORP1 | CONINFOR.PRG:20597 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFORP12 | CONINFOR.PRG:20617 | — | — | TALITEM | Pendiente: alias dinámicos o temporales |
| INFORP12X | CONINFOR.PRG:20741 | — | — | TALITEM | Pendiente: alias dinámicos o temporales |
| INFORP14 | CONINFOR.PRG:20809 | — | — | TALIMOV, TALIMAE | Pendiente: alias dinámicos o temporales |
| INFORP13 | CONINFOR.PRG:20853 | — | — | TALIMES, TALICLI, TALITEM | Pendiente: alias dinámicos o temporales |
| INFACTI | CONINFOR.PRG:20875 | — | AFIART, AFITAB, AMORTAB | — | No certificada: requiere cambios y pruebas |
| INFACT2 | CONINFOR.PRG:20901 | AFIART, AFITAB, AMORTAB | — | — | No certificada: requiere cambios y pruebas |
| ACTUTABCO | CONINFOR.PRG:21074 | CONCECOS, CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFOR09CX | CONINFOR.PRG:21129 | CONCECO2, CONMAE, CONMAE2 | COCENTRO, CONCECOS, FADCLI | — | No certificada: requiere cambios y pruebas |
| INFOR091X | CONINFOR.PRG:21247 | COCENTRO, CONCECOS, CONMAE, FADCLI | — | — | No certificada: requiere cambios y pruebas |
| INFOR091X2 | CONINFOR.PRG:21615 | — | — | TALICEN, TALICOS, TALIMAE, TALICLI | Pendiente: alias dinámicos o temporales |
| INFOR091X9 | CONINFOR.PRG:21850 | CONCECOS, CONMAE | — | TALICEN, TALICOS | No certificada: requiere cambios y pruebas |
| LIMPIAR | CONINFOR.PRG:21955 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| MARCACE | CONINFOR.PRG:21970 | CONCECOS, CONMAE | — | — | No certificada: requiere cambios y pruebas |
| INFOR9L | CONINFOR.PRG:22011 | CONCECOS, CONMCOS, CONTCOS | VISAUDI | — | No certificada: requiere cambios y pruebas |
| INFOR21J | CONINFOR.PRG:22096 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFOR9LX | CONINFOR.PRG:22109 | CONCECOS | — | — | No certificada: requiere cambios y pruebas |
| INFOR2AJ | CONINFOR.PRG:22127 | — | — | TALIMCOS | Pendiente: alias dinámicos o temporales |
| INFOR2BJ | CONINFOR.PRG:22569 | — | — | TALIMCOS | Pendiente: alias dinámicos o temporales |
| HABILCC | CONINFOR.PRG:22970 | CONCECOS | — | — | No certificada: requiere cambios y pruebas |
| INFOR9L3 | CONINFOR.PRG:22979 | — | CONCECOS, VISAUDI | — | No certificada: requiere cambios y pruebas |
| INFORPII | CONINFOR.PRG:23013 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFORPII2 | CONINFOR.PRG:23024 | — | — | TALIMCOS | Pendiente: alias dinámicos o temporales |
| INFOR9L4 | CONINFOR.PRG:23065 | CONCECOS | — | — | No certificada: requiere cambios y pruebas |
| INFOR9L5 | CONINFOR.PRG:23094 | — | CONCECOS | — | No certificada: requiere cambios y pruebas |
| INFOR9L6 | CONINFOR.PRG:23113 | CONCECOS | — | CMOV, TALICLI, TALIMAE, TALIMCOS | No certificada: requiere cambios y pruebas |
| INFOR9L4_2 | CONINFOR.PRG:23244 | CONCECOS | — | — | No certificada: requiere cambios y pruebas |
| INFOR9L5_2 | CONINFOR.PRG:23269 | — | CONCECOS | — | No certificada: requiere cambios y pruebas |
| INFOR9L6_2 | CONINFOR.PRG:23285 | CONCECOS | — | CMOV, TALICLI, TALIMAE, TALIMCOS | No certificada: requiere cambios y pruebas |
| MENIMP | CONINFOR.PRG:23456 | COCENTRO, CONMAE | CONCECOS, FADCLI | — | No certificada: requiere cambios y pruebas |
| MENIMPX | CONINFOR.PRG:23698 | COCENTRO, CONMAE | CONCECOS, FADCLI | — | No certificada: requiere cambios y pruebas |
| PLANORETEN | CONINFOR.PRG:23878 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| PLANORET2 | CONINFOR.PRG:23922 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| PLANORET3 | CONINFOR.PRG:23956 | — | — | TALICLI, TALIRET, TALIMAE | Pendiente: alias dinámicos o temporales |
| ACTUNOMA | CONINFOR.PRG:24308 | — | CONMAE, FADCLI | — | No certificada: requiere cambios y pruebas |
| ACTUNOMA1 | CONINFOR.PRG:24332 | CONMAE, FADCLI | — | — | No certificada: requiere cambios y pruebas |
| PRESU1 | CONPRESU.PRG:6 | TIDPRESU | CONCECOS | — | No certificada: requiere cambios y pruebas |
| AYUCCP | CONPRESU.PRG:90 | CONCECOS, TIDPRESU | — | — | No certificada: requiere cambios y pruebas |
| AYUTAP | CONPRESU.PRG:120 | TIDPRESU | — | — | No certificada: requiere cambios y pruebas |
| CONSULPRE | CONPRESU.PRG:197 | TIDPRESU | — | — | No certificada: requiere cambios y pruebas |
| GRABAPRESU | CONPRESU.PRG:243 | TIDPRESU | — | — | No certificada: requiere cambios y pruebas |
| CCTANIVEL | CONSULTA.PRG:4 | POSINFOR | COCENTRO | — | No certificada: requiere cambios y pruebas |
| CCTANIVEL2 | CONSULTA.PRG:39 | COCENTRO | — | TALITEM | No certificada: requiere cambios y pruebas |
| CONSUL1M | CONSULTA.PRG:74 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONSUL_1 | CONSULTA.PRG:84 | MOVxx | CONCECOS, CONMAE | — | No certificada: requiere cambios y pruebas |
| OKMES | CONSULTA.PRG:181 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| OKMES2 | CONSULTA.PRG:194 | — | — | SQL_SELECT | Pendiente: alias dinámicos o temporales |
| BUSMES | CONSULTA.PRG:265 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| BUSMESC | CONSULTA.PRG:285 | — | — | TALIAS | Pendiente: alias dinámicos o temporales |
| ORDEN1 | CONSULTA.PRG:309 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONSUL_2A | CONSULTA.PRG:334 | CONMAE | CONCECOS, MOVxx | — | No certificada: requiere cambios y pruebas |
| CAMCO1 | CONSULTA.PRG:421 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| OKRAN | CONSULTA.PRG:428 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONSULCO | CONSULTA.PRG:435 | — | COCENTRO, CONCECOS, CONEMP, CONMAE, FADCLI, MOVxx | — | No certificada: requiere cambios y pruebas |
| CONSULCO1 | CONSULTA.PRG:471 | CONMAE | COCENTRO, CONCECOS, FADCLI, MOVxx | — | No certificada: requiere cambios y pruebas |
| CONSULCO2 | CONSULTA.PRG:581 | — | COCENTRO, CONCECOS, CONEMP, CONMAE, FADCLI | — | No certificada: requiere cambios y pruebas |
| NOMCENT | CONSULTA.PRG:617 | CONCECOS, CONMAE, FADCLI | — | — | No certificada: requiere cambios y pruebas |
| CONSULCO2A | CONSULTA.PRG:642 | COCENTRO | CONCECOS, CONMAE, FADCLI | — | No certificada: requiere cambios y pruebas |
| DIFEL | CONSULTA.PRG:763 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONSULME | CONSULTA.PRG:790 | — | COCENTRO, CONCECOS, CONMAE, FADCLI, MOVxx | — | No certificada: requiere cambios y pruebas |
| CONSULME1 | CONSULTA.PRG:824 | CONMAE | COCENTRO, CONCECOS, FADCLI, MOVxx | — | No certificada: requiere cambios y pruebas |
| CONSUL_2 | CONSULTA.PRG:912 | CONMAE | CONCECOS, MOVxx | — | No certificada: requiere cambios y pruebas |
| VERMOV8 | CONSULTA.PRG:983 | MOVxx | CONCECOS, CONMAE | — | No certificada: requiere cambios y pruebas |
| VERMOV82 | CONSULTA.PRG:1077 | — | — | TALIMES | Pendiente: alias dinámicos o temporales |
| VERMOV9 | CONSULTA.PRG:1107 | MOVxx | CONCECOS, CONMAE | — | No certificada: requiere cambios y pruebas |
| VERMOV92 | CONSULTA.PRG:1206 | — | — | TALIMES | Pendiente: alias dinámicos o temporales |
| CMES_2 | CONSULTA.PRG:1239 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONSALDO | CONSULTA.PRG:1286 | — | — | CAR | Pendiente: alias dinámicos o temporales |
| CONMOV12 | CONSULTA.PRG:1359 | — | — | CAR | Pendiente: alias dinámicos o temporales |
| CONMMES | CONSULTA.PRG:1427 | — | — | CAR | Pendiente: alias dinámicos o temporales |
| CONMMESC | CONSULTA.PRG:1447 | — | — | CAR | Pendiente: alias dinámicos o temporales |
| CONSALDOC | CONSULTA.PRG:1467 | — | — | CAR | Pendiente: alias dinámicos o temporales |
| CCSALDO | CONSULTA.PRG:1542 | — | — | CAR | Pendiente: alias dinámicos o temporales |
| CCSALDO2 | CONSULTA.PRG:1584 | — | — | CAR | Pendiente: alias dinámicos o temporales |
| CONSUL_21 | CONSULTA.PRG:1628 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| CONSULC1 | CONSULTA.PRG:1770 | — | CONCECOS, CONDOCUM, CONMAE, FADCLI, FADDIA, FADITE, FADPAGO, MOVxx, NOMCALEN, VEDVEN, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| CONSCON | CONSULTA.PRG:1792 | CONDOCUM | CONCECOS, CONMAE, FADCLI, FADDIA, FADITE, FADPAGO, MOVxx, NOMCALEN, VEDVEN | — | No certificada: requiere cambios y pruebas |
| BUSDOCUM | CONSULTA.PRG:1850 | CONDOCUM | — | — | No certificada: requiere cambios y pruebas |
| VLRDOC | CONSULTA.PRG:1865 | CONDOCUM | — | — | No certificada: requiere cambios y pruebas |
| VERITCON | CONSULTA.PRG:1873 | CONDOCUM, MOVxx | CONCECOS, CONMAE, FADCLI | — | No certificada: requiere cambios y pruebas |
| VER_DETACON | CONSULTA.PRG:1943 | CONCECOS, CONMAE, FADCLI | — | — | No certificada: requiere cambios y pruebas |
| VERDETAL | CONSULTA.PRG:1971 | FADDIA, FADITE, FADPAGO, VEDVEN | — | — | No certificada: requiere cambios y pruebas |
| CONSUL_3 | CONSULTA.PRG:2090 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| CONSUL_31 | CONSULTA.PRG:2125 | CONMAE | — | TALIMES | No certificada: requiere cambios y pruebas |
| CONSUL_31_ACUMULA_MES | CONSULTA.PRG:2283 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONSUL_31_LIMPIA_SCOPE | CONSULTA.PRG:2327 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| VERNIT | CONSULTA.PRG:2342 | — | — | TALINIT | Pendiente: alias dinámicos o temporales |
| CONMOV | CONSULTA.PRG:2355 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONSUL_4 | CONSULTA.PRG:2370 | — | CIUDAD, CONMAE, FADCLI, FADTAB | — | No certificada: requiere cambios y pruebas |
| CONSUL_41 | CONSULTA.PRG:2404 | — | CONMAE | TALIMES | No certificada: requiere cambios y pruebas |
| CONSUL_41_APLICA_SCOPE | CONSULTA.PRG:2541 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONSUL_41_LIMPIA_SCOPE | CONSULTA.PRG:2556 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| VERCTA | CONSULTA.PRG:2573 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| CONSUL_5 | CONSULTA.PRG:2584 | — | CONCECOS, CONMAE | — | No certificada: requiere cambios y pruebas |
| CONSUL_51 | CONSULTA.PRG:2619 | — | CONMAE | TALIMES | No certificada: requiere cambios y pruebas |
| CONSUL_7 | CONSULTA.PRG:2736 | COCENTRO, CONCECOS, CONMAE | — | — | No certificada: requiere cambios y pruebas |
| CONSUL_8 | CONSULTA.PRG:2832 | — | CONCECOS, CONMAE, MOVxx, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| DOC8OK | CONSULTA.PRG:2857 | MOVxx | — | — | No certificada: requiere cambios y pruebas |
| CONSUL_81 | CONSULTA.PRG:2883 | MOVxx | CONCECOS, CONMAE | — | No certificada: requiere cambios y pruebas |
| TIPINFOR2 | CONSULTA.PRG:2996 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| PLANTICO | DSITAB.PRG:7 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| NOCREADA | DSITAB.PRG:71 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| AVISO | DSITAB.PRG:75 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ESPACIO | DSITAB.PRG:84 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| AYUDPLA | DSITAB.PRG:91 | — | — | CALIDOC | Pendiente: alias dinámicos o temporales |
| GRABAPLA | DSITAB.PRG:157 | — | — | CALIDOC | Pendiente: alias dinámicos o temporales |
| INTERACT | DSITAB.PRG:187 | — | AFITAB, AFITAB2, AMORART, AMORTAB2, CIUDAD, CONINTER, CONMOVI, CONTICOM, FADCLI, FADTAB, NOMCALEN, VISAUDI, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| TIPAFI | DSITAB.PRG:236 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INTEACT2 | DSITAB.PRG:242 | CONINTER, CONMOVI | AFITAB, AFITAB2, AMORART, AMORTAB2, FADCLI, VISAUDI | — | No certificada: requiere cambios y pruebas |
| INTEACT3 | DSITAB.PRG:330 | AFITAB, AFITAB2, AMORART, AMORTAB2 | FADCLI, VISAUDI | CALIART, CALITAB, CALITAB2 | No certificada: requiere cambios y pruebas |
| AFISALDO | DSITAB.PRG:493 | AFIART | — | — | No certificada: requiere cambios y pruebas |
| ACTI201 | DSITAB.PRG:519 | — | AFITAB, AMORTAB, CIUDAD, CONCECOS, FADCLI, FADTAB, NOMCALEN, VISAUDI | TALIART | No certificada: requiere cambios y pruebas |
| DCOSTO | DSITAB.PRG:618 | — | CONCECOS | XALICC | No certificada: requiere cambios y pruebas |
| EDIC312C | DSITAB.PRG:675 | — | CONCECOS | XALICC | No certificada: requiere cambios y pruebas |
| ABREC31C | DSITAB.PRG:721 | — | — | XALICC | Pendiente: alias dinámicos o temporales |
| SALECC3C | DSITAB.PRG:733 | — | — | XALICC | Pendiente: alias dinámicos o temporales |
| SACACC3C | DSITAB.PRG:767 | — | — | XALICC | Pendiente: alias dinámicos o temporales |
| COSOKMC | DSITAB.PRG:775 | CONCECOS | — | — | No certificada: requiere cambios y pruebas |
| ACTIGRA | DSITAB.PRG:817 | AFITAB, AMORTAB | CONCECOS | TALIART | No certificada: requiere cambios y pruebas |
| VSALDEP | DSITAB.PRG:880 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| AYUDEP | DSITAB.PRG:885 | AFITAB, AMORTAB | — | — | No certificada: requiere cambios y pruebas |
| CONSULFT | DSITAB.PRG:909 | — | — | TALITAB | Pendiente: alias dinámicos o temporales |
| AYUSEC | DSITAB.PRG:936 | AFITAB, AMORTAB | — | — | No certificada: requiere cambios y pruebas |
| CONSULFS | DSITAB.PRG:960 | AFITAB, AMORTAB | — | — | No certificada: requiere cambios y pruebas |
| ACTIESTA | DSITAB.PRG:997 | — | — | TALIART | Pendiente: alias dinámicos o temporales |
| ACTI101 | DSITAB.PRG:1019 | — | VISAUDI | CALIAS | No certificada: requiere cambios y pruebas |
| AFIOK | DSITAB.PRG:1056 | — | — | CALIAS | Pendiente: alias dinámicos o temporales |
| AFIGRABA | DSITAB.PRG:1082 | — | — | CALIAS | Pendiente: alias dinámicos o temporales |
| CCOSTOS | DSITAB.PRG:1099 | CONCECOS, CONSOLID | CONEMP, VISAUDI | — | No certificada: requiere cambios y pruebas |
| ODLG_INIT1 | DSITAB.PRG:1148 | CONCECOS | CONEMP, CONSOLID, VISAUDI | — | No certificada: requiere cambios y pruebas |
| ODLG_INIT2 | DSITAB.PRG:1161 | CONSOLID | CONCECOS, CONEMP, VISAUDI | — | No certificada: requiere cambios y pruebas |
| COSBUS | DSITAB.PRG:1173 | CONCECOS | — | — | No certificada: requiere cambios y pruebas |
| COSORDEN | DSITAB.PRG:1195 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| BORRAR | DSITAB.PRG:1210 | — | VISAUDI | CALI | No certificada: requiere cambios y pruebas |
| CCOSTO1 | DSITAB.PRG:1225 | CONCECOS | CONEMP, CONSOLID, VISAUDI | — | No certificada: requiere cambios y pruebas |
| CONSOL12 | DSITAB.PRG:1279 | CONEMP, CONSOLID | — | — | No certificada: requiere cambios y pruebas |
| DSIGRABA1 | DSITAB.PRG:1310 | — | VISAUDI | BASES | No certificada: requiere cambios y pruebas |
| DSIESTA | DSITAB.PRG:1335 | — | — | BASES | Pendiente: alias dinámicos o temporales |
| PARAMS | DSITAB.PRG:1348 | CONCTR | VISAUDI | — | No certificada: requiere cambios y pruebas |
| PARAMS_NOMI | DSITAB.PRG:1439 | CONCTR | — | — | No certificada: requiere cambios y pruebas |
| DSIGRABA6_NOM | DSITAB.PRG:1471 | CONCTR | — | — | No certificada: requiere cambios y pruebas |
| DIROK | DSITAB.PRG:1483 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| DSIGRABA6 | DSITAB.PRG:1506 | CONCTR | VISAUDI | — | No certificada: requiere cambios y pruebas |
| CCOMPRO | DSITAB.PRG:1585 | CONTICOM | CONCECOS, CONEMP, CONSOLID, VISAUDI | — | No certificada: requiere cambios y pruebas |
| ODLG_INIT | DSITAB.PRG:1608 | CONTICOM | CONCECOS, CONEMP, CONSOLID, VISAUDI | — | No certificada: requiere cambios y pruebas |
| CCOMPRO1 | DSITAB.PRG:1623 | CONTICOM | VISAUDI | — | No certificada: requiere cambios y pruebas |
| RENGLONES | DSITAB.PRG:1644 | CONDECLA | CONCECOS, CONEMP, CONSOLID, VISAUDI | — | No certificada: requiere cambios y pruebas |
| ODLG_INIT3 | DSITAB.PRG:1667 | CONDECLA | VISAUDI | — | No certificada: requiere cambios y pruebas |
| RENGLON1 | DSITAB.PRG:1681 | CONDECLA | — | — | No certificada: requiere cambios y pruebas |
| FORMU1 | DSITAB.PRG:1714 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| DSIGRABA4 | DSITAB.PRG:1722 | CONDECLA | — | — | No certificada: requiere cambios y pruebas |
| RETES | DSITAB.PRG:1754 | CONTIRET | CONCECOS, CONEMP, CONSOLID, VISAUDI | — | No certificada: requiere cambios y pruebas |
| ODLG_INIT5 | DSITAB.PRG:1776 | CONTIRET | VISAUDI | — | No certificada: requiere cambios y pruebas |
| RETES1 | DSITAB.PRG:1791 | CONTIRET | — | — | No certificada: requiere cambios y pruebas |
| DSIGRABA5 | DSITAB.PRG:1819 | — | — | BASES | Pendiente: alias dinámicos o temporales |
| IVAS | DSITAB.PRG:1837 | CONTIIVA | CONCECOS, CONEMP, CONSOLID, VISAUDI | — | No certificada: requiere cambios y pruebas |
| ODLG_INIT6 | DSITAB.PRG:1860 | CONTIIVA | VISAUDI | — | No certificada: requiere cambios y pruebas |
| IVA1 | DSITAB.PRG:1875 | CONTIIVA | — | — | No certificada: requiere cambios y pruebas |
| CIAS | DSITAB.PRG:1901 | CONEMP | CONCECOS, CONCTR, CONSOLID, VISAUDI | — | No certificada: requiere cambios y pruebas |
| ODLG_INIT7 | DSITAB.PRG:1934 | — | CONCTR, CONEMP, VISAUDI | — | No certificada: requiere cambios y pruebas |
| BORRACON | DSITAB.PRG:1948 | CONEMP | VISAUDI | — | No certificada: requiere cambios y pruebas |
| CIAS1 | DSITAB.PRG:1965 | CONCTR, CONEMP | — | — | No certificada: requiere cambios y pruebas |
| ANOPER | DSITAB.PRG:2017 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| DSIGRABA7 | DSITAB.PRG:2023 | CONCTR, CONEMP | — | — | No certificada: requiere cambios y pruebas |
| ARMA2 | DSITAB.PRG:2060 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| PROCIAS | DSITAB.PRG:2439 | CONCTR | — | — | No certificada: requiere cambios y pruebas |
| USUARIOS | DSITAB.PRG:2706 | CONOPER | CONCECOS, CONCTR, CONEMP, CONSOLID, VISAUDI | — | No certificada: requiere cambios y pruebas |
| USUA1 | DSITAB.PRG:2731 | CONOPER | CONCTR | — | No certificada: requiere cambios y pruebas |
| DSIGRABA8 | DSITAB.PRG:2762 | CONOPER | CONCTR | — | No certificada: requiere cambios y pruebas |
| MEDMAG01 | DSITAB.PRG:2782 | CONMAG1 | CONCECOS, CONEMP, CONSOLID, VISAUDI | — | No certificada: requiere cambios y pruebas |
| ODLG_INIT8 | DSITAB.PRG:2819 | — | VISAUDI | — | No certificada: requiere cambios y pruebas |
| BORRAMG | DSITAB.PRG:2833 | — | VISAUDI | CALIAS | No certificada: requiere cambios y pruebas |
| MEDMAG11 | DSITAB.PRG:2856 | — | VISAUDI | CALIAS | No certificada: requiere cambios y pruebas |
| GRAFORMA | DSITAB.PRG:2912 | — | VISAUDI | CALIAS | No certificada: requiere cambios y pruebas |
| ESFORMA | DSITAB.PRG:2941 | — | — | CALIAS | Pendiente: alias dinámicos o temporales |
| MEDMAG02 | DSITAB.PRG:2955 | CONMAG2 | CONCECOS, CONEMP, CONMAGDT, CONSOLID, VISAUDI | — | No certificada: requiere cambios y pruebas |
| CONSUCON | DSITAB.PRG:3004 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONSUCON2 | DSITAB.PRG:3032 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| AYUDACON | DSITAB.PRG:3061 | — | — | CALICON | Pendiente: alias dinámicos o temporales |
| AYUDACON2 | DSITAB.PRG:3082 | — | — | CALICON | Pendiente: alias dinámicos o temporales |
| MEDMAG21 | DSITAB.PRG:3108 | CONMAG2 | VISAUDI | — | No certificada: requiere cambios y pruebas |
| ESCONCEP | DSITAB.PRG:3176 | CONMAG2 | — | — | No certificada: requiere cambios y pruebas |
| GRACONCEP | DSITAB.PRG:3191 | CONMAG2 | VISAUDI | — | No certificada: requiere cambios y pruebas |
| MEDMAG03 | DSITAB.PRG:3222 | CONMAE, CONMAG3 | CONMAGDT | — | No certificada: requiere cambios y pruebas |
| MEDMAG31COP | DSITAB.PRG:3296 | — | — | TALIMAE | Pendiente: alias dinámicos o temporales |
| MEDMAG31PEG | DSITAB.PRG:3301 | CONMAG3 | — | TALIMAE | No certificada: requiere cambios y pruebas |
| MEDMAG31X | DSITAB.PRG:3349 | CONMAG3 | — | — | No certificada: requiere cambios y pruebas |
| MEDMAG31A | DSITAB.PRG:3357 | CONMAG3 | CONMAGDT | — | No certificada: requiere cambios y pruebas |
| MEDMAG31AG | DSITAB.PRG:3465 | CONMAG3 | — | — | No certificada: requiere cambios y pruebas |
| MEDMAG03V | DSITAB.PRG:3499 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| MEDMAG03T | DSITAB.PRG:3509 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| MEDMAG03X | DSITAB.PRG:3541 | — | — | XALIMAE, YALIMAE | Pendiente: alias dinámicos o temporales |
| MEDMAG04 | DSITAB.PRG:3568 | — | CONMAG3, VISAUDI, XADMAE | — | No certificada: requiere cambios y pruebas |
| MEDMAG04G | DSITAB.PRG:3594 | — | CONMAG3, VISAUDI, XADMAE | — | No certificada: requiere cambios y pruebas |
| MEDMAG4B | DSITAB.PRG:3644 | — | — | TALIMAGDT, TALIMAGIT | Pendiente: alias dinámicos o temporales |
| MEDMAG41 | DSITAB.PRG:3668 | — | CONMAG3, XADMAE | — | No certificada: requiere cambios y pruebas |
| MEDMAG42NN | DSITAB.PRG:3690 | CONMAG3 | XADMAE | — | No certificada: requiere cambios y pruebas |
| MOVMEDIOS | DSITAB.PRG:3739 | CONMAG3 | — | TALIMOV, TALICLI, TALIMAGDT, TALIMAGIT, XALIMOV | No certificada: requiere cambios y pruebas |
| MOVMEDCXP | DSITAB.PRG:3947 | CONMAG3, XADMAE | — | TALIMOV, TALICLI, TALIMAGDT, TALIMAGIT | No certificada: requiere cambios y pruebas |
| MOVMEDRET | DSITAB.PRG:4052 | CONMAG3 | — | TALIMOV, XALIMOV, TALICLI, TALIMAGDT, TALIMAGIT | No certificada: requiere cambios y pruebas |
| MEDMAG44 | DSITAB.PRG:4160 | CONMAG3 | VISAUDI | — | No certificada: requiere cambios y pruebas |
| MEDMAG45 | DSITAB.PRG:4182 | CONMAG3 | VISAUDI | TALIMAE, TALICLI, TALIMAGIT, TALIMAGDT | No certificada: requiere cambios y pruebas |
| MEDMAG05 | DSITAB.PRG:4244 | CONMAGDT | CONMAGIT, FADCLI | — | No certificada: requiere cambios y pruebas |
| GENERAID | DSITAB.PRG:4326 | CONMAGDT | — | CALICLI | No certificada: requiere cambios y pruebas |
| MEDMAG08 | DSITAB.PRG:4355 | CONMAGDT | FADCLI | — | No certificada: requiere cambios y pruebas |
| NITOKR | DSITAB.PRG:4425 | CONMAGDT | FADCLI | CALICLI | No certificada: requiere cambios y pruebas |
| AYUDAFOR | DSITAB.PRG:4468 | CONMAGDT | — | CALIFOR | No certificada: requiere cambios y pruebas |
| AYUDAFOR2 | DSITAB.PRG:4513 | — | — | CALIFOR | Pendiente: alias dinámicos o temporales |
| DETAMAG | DSITAB.PRG:4538 | CONMAGIT | — | — | No certificada: requiere cambios y pruebas |
| IMPREDET | DSITAB.PRG:4595 | — | CONMAGIT | — | No certificada: requiere cambios y pruebas |
| IMPREDET1 | DSITAB.PRG:4610 | — | CONMAGIT | — | No certificada: requiere cambios y pruebas |
| DETALLE1 | DSITAB.PRG:4626 | CONMAGIT | — | — | No certificada: requiere cambios y pruebas |
| DETALLE2 | DSITAB.PRG:4708 | CONMAGIT | — | — | No certificada: requiere cambios y pruebas |
| NOMCLIG | DSITAB.PRG:4767 | — | — | CALICLI | Pendiente: alias dinámicos o temporales |
| DEPUMAG | DSITAB.PRG:4775 | — | CONMAGDT | — | No certificada: requiere cambios y pruebas |
| FORMAOK | DSITAB.PRG:4844 | — | — | CALIFOR | Pendiente: alias dinámicos o temporales |
| DEPUMAG2 | DSITAB.PRG:4863 | CONMAGDT | — | MTEMDEP, RTEMDEP | No certificada: requiere cambios y pruebas |
| BORRAMAG | DSITAB.PRG:4923 | CONMAGDT | — | — | No certificada: requiere cambios y pruebas |
| CREAMAG | DSITAB.PRG:4934 | CONMAGDT | FADCLI | — | No certificada: requiere cambios y pruebas |
| DIGI7 | DSITAB.PRG:4978 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CREAMAG2 | DSITAB.PRG:4982 | CONMAGDT | — | — | No certificada: requiere cambios y pruebas |
| GENEMAG | DSITAB.PRG:4999 | CONMAGDT | — | CALIFOR, CALICLI | No certificada: requiere cambios y pruebas |
| GENEMAGXLS | DSITAB.PRG:5091 | — | CONMAGDT | — | No certificada: requiere cambios y pruebas |
| GENEMAGXLS2 | DSITAB.PRG:5106 | CONMAGDT | — | CALIFOR, CALICLI, CALICON | No certificada: requiere cambios y pruebas |
| IMPREG | DSITAB.PRG:5605 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| GENEMAG2 | DSITAB.PRG:5619 | CONMAGDT | — | CALICLI, CALIFOR | No certificada: requiere cambios y pruebas |
| AJUS02 | DSITAB.PRG:5886 | — | CONAJUS, CONCECOS, CONMAE, CONMOVI, CONTICOM, NOMCALEN, VISAUDI, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| AJUS02G | DSITAB.PRG:5922 | CONAJUS, CONMAE, CONMOVI | VISAUDI | CALILOT | No certificada: requiere cambios y pruebas |
| INFORCIA | DSITAB.PRG:6015 | — | AFIART, AFITAB, AMORART, AMORTAB, CONCECO2, CONCECOS, CONEMP, CONMAE, CONMAE2, CONMOVI, CONTICOM, CONTIIVA, CONTIRET, FADCLI, MOVxx | — | No certificada: requiere cambios y pruebas |
| CONTOKL | DSITAB.PRG:6058 | CONEMP | — | — | No certificada: requiere cambios y pruebas |
| CONTOK | DSITAB.PRG:6082 | CONEMP | — | — | No certificada: requiere cambios y pruebas |
| INFORCI2 | DSITAB.PRG:6192 | — | AFIART, AFITAB, AMORART, AMORTAB, CONCECO2, CONCECOS, CONMAE, CONMAE2, CONMOVI, CONTICOM, CONTIIVA, CONTIRET, FADCLI, MOVxx | — | No certificada: requiere cambios y pruebas |
| INFORLOT | DSITAB.PRG:6226 | CONMOVI | — | — | No certificada: requiere cambios y pruebas |
| INFORLOT2 | DSITAB.PRG:6263 | — | — | CALILOT, CALILOT2 | Pendiente: alias dinámicos o temporales |
| INFORCIV | DSITAB.PRG:6312 | — | MOVxx | — | No certificada: requiere cambios y pruebas |
| INFOVMES | DSITAB.PRG:6326 | MOVxx | — | — | No certificada: requiere cambios y pruebas |
| INFORV2 | DSITAB.PRG:6360 | — | — | CALIMOV2, CALIMOV1 | Pendiente: alias dinámicos o temporales |
| INFORACT | DSITAB.PRG:6395 | AFIART, AFITAB | — | — | No certificada: requiere cambios y pruebas |
| INFORACT2 | DSITAB.PRG:6446 | — | — | CALITAB2, CALITAB, CALIART2, CALIART | Pendiente: alias dinámicos o temporales |
| INFORAMO | DSITAB.PRG:6552 | AMORART, AMORTAB | — | — | No certificada: requiere cambios y pruebas |
| INFORAMO2 | DSITAB.PRG:6603 | — | — | CALITAB2, CALITAB, CALIART2, CALIART | Pendiente: alias dinámicos o temporales |
| INFORTAB | DSITAB.PRG:6709 | CONCECO2, CONCECOS, CONTICOM, CONTIIVA, CONTIRET | — | — | No certificada: requiere cambios y pruebas |
| INFORTA2 | DSITAB.PRG:6810 | — | — | CALICONC2, CALICONC, CALICON22, CALICON2, CALIRET2, CALIRET1, CALIIVA2, CALIIVA1, CALICOM2, CALICOM1 | Pendiente: alias dinámicos o temporales |
| INFORCIP | DSITAB.PRG:6920 | CONMAE, CONMAE2 | — | — | No certificada: requiere cambios y pruebas |
| INFORP2 | DSITAB.PRG:6972 | — | — | CALIMAE1, CALIMAE2, CALIMAEY | Pendiente: alias dinámicos o temporales |
| INFORCIT | DSITAB.PRG:7033 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| INFORT2 | DSITAB.PRG:7066 | — | — | CALICLI2, CALICLI1 | Pendiente: alias dinámicos o temporales |
| INFORT1 | DSITAB.PRG:7100 | CONRTER | CIUDAD, CONMAE, FADCLI, FADTAB | — | No certificada: requiere cambios y pruebas |
| MES2K | DSITAB.PRG:7146 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INFORT1A | DSITAB.PRG:7153 | CONRTER | — | CARCHTEM | No certificada: requiere cambios y pruebas |
| INFTER4 | DSITAB.PRG:7222 | CONRTER | — | CARCHTEM | No certificada: requiere cambios y pruebas |
| INFTER1 | DSITAB.PRG:7360 | CONRTER | — | CARCHTEM | No certificada: requiere cambios y pruebas |
| CTADOC2A | DSITAB.PRG:7517 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| AURES2 | DSITAB.PRG:7551 | — | CONMAE, CONRTER | — | No certificada: requiere cambios y pruebas |
| AURES3 | DSITAB.PRG:7562 | CONRTER | — | — | No certificada: requiere cambios y pruebas |
| AURES21 | DSITAB.PRG:7573 | CONMAE, CONRTER | — | — | No certificada: requiere cambios y pruebas |
| MEDMAG06 | DSITAB.PRG:7587 | CONMAGIT | CONMAG1, CONMAG2, FADCLI | — | No certificada: requiere cambios y pruebas |
| NITOKL | DSITAB.PRG:7638 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| IMPREDETN | DSITAB.PRG:7679 | — | CONMAG1, CONMAG2, CONMAGIT | — | No certificada: requiere cambios y pruebas |
| IMPREDET1N | DSITAB.PRG:7696 | — | CONMAG1, CONMAG2, CONMAGIT | — | No certificada: requiere cambios y pruebas |
| DETALLE1N | DSITAB.PRG:7714 | CONMAG1, CONMAG2, CONMAGIT | — | — | No certificada: requiere cambios y pruebas |
| DETALLE2N | DSITAB.PRG:7890 | CONMAG1, CONMAG2, CONMAGIT | — | — | No certificada: requiere cambios y pruebas |
| MEDMAG07 | DSITAB.PRG:8051 | CONMAGDT | — | — | No certificada: requiere cambios y pruebas |
| IMPREDET7 | DSITAB.PRG:8101 | — | CONMAGDT | — | No certificada: requiere cambios y pruebas |
| IMPREDET71 | DSITAB.PRG:8116 | — | CONMAGDT | — | No certificada: requiere cambios y pruebas |
| DETALLE71 | DSITAB.PRG:8132 | CONMAGDT | — | — | No certificada: requiere cambios y pruebas |
| DETALLE72 | DSITAB.PRG:8192 | CONMAGDT | — | — | No certificada: requiere cambios y pruebas |
| MEDBUS | DSITAB.PRG:8251 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| MEDBUS1 | DSITAB.PRG:8268 | — | — | WARCHI | Pendiente: alias dinámicos o temporales |
| DIRCLIG | DSITAB.PRG:8279 | — | — | CALICLI | Pendiente: alias dinámicos o temporales |
| CIUCLIG | DSITAB.PRG:8287 | — | — | CALICLI | Pendiente: alias dinámicos o temporales |
| DEPUMAGT | DSITAB.PRG:8295 | — | CONMAGDT | — | No certificada: requiere cambios y pruebas |
| FORMAOK2 | DSITAB.PRG:8359 | — | — | CALIFOR | Pendiente: alias dinámicos o temporales |
| DEPUMAGT2 | DSITAB.PRG:8380 | CONMAGDT | — | RTEMDEP | No certificada: requiere cambios y pruebas |
| MEDMAG09 | DSITAB.PRG:8435 | CONMAGIT | FADCLI | — | No certificada: requiere cambios y pruebas |
| NITOKL9 | DSITAB.PRG:8495 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| DOCOKL | DSITAB.PRG:8531 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| IMPREDEDI | DSITAB.PRG:8542 | CONMAGIT | — | — | No certificada: requiere cambios y pruebas |
| CONCARG10 | MOVICON.prg:9 | — | CONMAE, CONMOVI, MC&lt;lote&gt; | — | No certificada: requiere cambios y pruebas |
| CSV_OK | MOVICON.prg:33 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONCARG9 | MOVICON.prg:53 | — | CONMAE, CONMOVI, CONTICOM, MC&lt;lote&gt;, NOMCALEN, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| CONCARG9_NOM | MOVICON.prg:86 | CONCTR | CONMAE, CONMOVI, CONTICOM, NOMCALEN, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| CONCARG92_NOM | MOVICON.prg:136 | CONMOVI | CONMAE | — | No certificada: requiere cambios y pruebas |
| CONCARG92_NOM2 | MOVICON.prg:220 | CONMAE | — | XALILOT | No certificada: requiere cambios y pruebas |
| CONCARG9_MES | MOVICON.prg:300 | — | MOVxx | — | No certificada: requiere cambios y pruebas |
| CONCARG9_CTR | MOVICON.prg:317 | — | MOVxx | — | No certificada: requiere cambios y pruebas |
| CONCARG9_MOV | MOVICON.prg:334 | MOVxx | — | — | No certificada: requiere cambios y pruebas |
| CONCARG95 | MOVICON.prg:443 | CONMOVI, MC&lt;lote&gt; | — | — | No certificada: requiere cambios y pruebas |
| CONCARG92 | MOVICON.prg:551 | CONMAE, CONMOVI, MC&lt;lote&gt; | — | XALIMES | No certificada: requiere cambios y pruebas |
| CONCARG93 | MOVICON.prg:661 | CONMAE, CONMOVI, MC&lt;lote&gt; | — | XALIMES | No certificada: requiere cambios y pruebas |
| CONCARG94 | MOVICON.prg:803 | CONMOVI, MC&lt;lote&gt; | — | — | No certificada: requiere cambios y pruebas |
| MOVI2 | MOVICON.prg:993 | CONMAE | CADGENF, CAUGENF, CIUDAD, COCENTRO, COMGENF, CONCECOS, CONDOCUM, CONFORMA, CONGENF, CONTICOM, CONTIIVA, CONTIRET, FADCLI, FADGENF, FADTAB, MOVxx, NOMCALEN, TIDGENF, VISAUDI, VISDOCUM, VISION, XADGENF | TALIAS | No certificada: requiere cambios y pruebas |
| LOTEXLS_CON | MOVICON.prg:1143 | — | — | TALIAS | Pendiente: alias dinámicos o temporales |
| MESMOVT | MOVICON.prg:1242 | — | NOMCALEN | — | No certificada: requiere cambios y pruebas |
| VLRLOT1 | MOVICON.prg:1260 | — | — | TALIAS | Pendiente: alias dinámicos o temporales |
| SACAITEL | MOVICON.prg:1274 | — | — | TALIAS | Pendiente: alias dinámicos o temporales |
| BORRMOV | MOVICON.prg:1291 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| EDITACELC | MOVICON.prg:1298 | — | CIUDAD, CONCECOS, CONMAE, CONTIIVA, CONTIRET, FADCLI, FADTAB | WALI, TALIAS | No certificada: requiere cambios y pruebas |
| SACABASE | MOVICON.prg:1558 | CONTIIVA, CONTIRET | — | — | No certificada: requiere cambios y pruebas |
| CON900G | MOVICON.prg:1604 | — | CONDOCUM, MOVxx, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| CON901G | MOVICON.prg:1648 | MOVxx | — | CALIDOCUM, TALIAS | No certificada: requiere cambios y pruebas |
| NUMCONTA | MOVICON.prg:1699 | CONDOCUM | — | — | No certificada: requiere cambios y pruebas |
| CONESTA | MOVICON.prg:1719 | — | — | TALIDOCUM | Pendiente: alias dinámicos o temporales |
| SALIR9 | MOVICON.prg:1752 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| SACAITET | MOVICON.prg:1768 | — | — | TALILOT | Pendiente: alias dinámicos o temporales |
| EDITACELDA | MOVICON.prg:1786 | — | CIUDAD, CONCECOS, CONDOCUM, CONMAE, CONTICOM, CONTIIVA, CONTIRET, FADCLI, FADTAB, NOMCALEN, VISDOCUM | TALILOT | No certificada: requiere cambios y pruebas |
| FECHALOT | MOVICON.prg:1880 | — | NOMCALEN | — | No certificada: requiere cambios y pruebas |
| BASEOK2 | MOVICON.prg:1896 | CONMAE, CONTIIVA, CONTIRET | — | — | No certificada: requiere cambios y pruebas |
| VALDEB | MOVICON.prg:1940 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CTAOK | MOVICON.prg:1952 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| CTAOK2 | MOVICON.prg:1998 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| CONSULCTA | MOVICON.prg:2035 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| CONSULCT8 | MOVICON.prg:2073 | — | — | TALIPLAN | Pendiente: alias dinámicos o temporales |
| CTABUS | MOVICON.prg:2105 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| BUSCTA | MOVICON.prg:2122 | — | — | WARCHI | Pendiente: alias dinámicos o temporales |
| CTABUSX | MOVICON.prg:2139 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| BUSCTAX | MOVICON.prg:2156 | — | — | WARCHI | Pendiente: alias dinámicos o temporales |
| NITOK | MOVICON.prg:2178 | FADCLI | CIUDAD, FADTAB | — | No certificada: requiere cambios y pruebas |
| CLIENTES2 | MOVICON.prg:2221 | — | CIUDAD, FADCLI, FADTAB | — | No certificada: requiere cambios y pruebas |
| GRABCLI2 | MOVICON.prg:2263 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| COSOK | MOVICON.prg:2295 | CONCECOS | — | — | No certificada: requiere cambios y pruebas |
| COSOK2 | MOVICON.prg:2327 | — | CONCECOS | XALICC, TALIAS | No certificada: requiere cambios y pruebas |
| EDICM2 | MOVICON.prg:2406 | — | CONCECOS | XALICC | No certificada: requiere cambios y pruebas |
| PLANTIC | MOVICON.prg:2486 | CONMAE, VISDOCUM | CIUDAD, CONCECOS, FADCLI, FADTAB | — | No certificada: requiere cambios y pruebas |
| GRABA_PLA | MOVICON.prg:2654 | CONMAE | — | TALIAS | No certificada: requiere cambios y pruebas |
| INGRECO7 | MOVICON.prg:2730 | — | CONEMP | CALIEMP | No certificada: requiere cambios y pruebas |
| INTERCAM | MOVICON.prg:2753 | — | CONCTR, CONEMP, VISION | — | No certificada: requiere cambios y pruebas |
| INTERCAMC | MOVICON.prg:2773 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONCERRAR | MOVICON.prg:2777 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| INTERCAM1 | MOVICON.prg:2793 | — | CONCTR, VISION | — | No certificada: requiere cambios y pruebas |
| INTERCAM2 | MOVICON.prg:2813 | CONCTR, VISION | — | — | No certificada: requiere cambios y pruebas |
| GRAVADIRE | MOVICON.prg:2983 | VISDOCUM | CADGENF, CAUGENF, COCENTRO, COMGENF, CONDOCUM, CONFORMA, CONGENF, CONMAE, FADCLI, FADGENF, MOVxx, TIDGENF, VISAUDI, VISION, XADGENF | — | No certificada: requiere cambios y pruebas |
| ACTUCOS | MOVICON.prg:3111 | COCENTRO, CONMAE | — | — | No certificada: requiere cambios y pruebas |
| ACTUALIZAR | MOVICON.prg:3141 | CONDOCUM, CONMAE, FADCLI | COCENTRO | TALIAS, TALIMOV | No certificada: requiere cambios y pruebas |
| ACTUMAE | MOVICON.prg:3220 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| ACTUMES0 | MOVICON.prg:3310 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| VERCTAS | MOVICON.prg:3381 | CONCECOS, CONMAE | — | TALINIT | No certificada: requiere cambios y pruebas |
| AYUDA1 | MOVICON.prg:3402 | CONTICOM | — | — | No certificada: requiere cambios y pruebas |
| AYUDA2 | MOVICON.prg:3429 | VISDOCUM | — | — | No certificada: requiere cambios y pruebas |
| AYUTDOC | MOVICON.prg:3486 | — | — | CALIDOC | Pendiente: alias dinámicos o temporales |
| GRABAMOV1 | MOVICON.prg:3508 | — | NOMCALEN | XALICC, TALILOT | No certificada: requiere cambios y pruebas |
| FWKEYBOARD | MOVICON.prg:3593 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| MOVI1 | MOVICON.prg:3598 | CONMOVI | CIUDAD, COCENTRO, CONCECOS, CONCTR, CONDOCUM, CONEMP, CONMAE, CONTICOM, CONTIDOC, CONTIIVA, CONTIRET, FADCLI, FADTAB, MC&lt;lote&gt;, MOVxx, NOMCALEN, VISAUDI, VISDOCUM, VISUSU | — | No certificada: requiere cambios y pruebas |
| ODLG_INIT10 | MOVICON.prg:3636 | — | CIUDAD, COCENTRO, CONCECOS, CONCTR, CONDOCUM, CONEMP, CONMAE, CONMOVI, CONTICOM, CONTIDOC, CONTIIVA, CONTIRET, FADCLI, FADTAB, MC&lt;lote&gt;, MOVxx, NOMCALEN, VISAUDI, VISDOCUM, VISUSU | — | No certificada: requiere cambios y pruebas |
| INDELOT | MOVICON.prg:3666 | CONMOVI | VISAUDI | — | No certificada: requiere cambios y pruebas |
| MOVI11 | MOVICON.prg:3698 | CONMAE, CONMOVI, MC&lt;lote&gt; | CIUDAD, CONCECOS, CONDOCUM, CONEMP, CONTICOM, CONTIIVA, CONTIRET, FADCLI, FADTAB, MOVxx, NOMCALEN, VISAUDI, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| COMPARALO | MOVICON.prg:3845 | CONMAE | — | TALILOT | No certificada: requiere cambios y pruebas |
| MOVREVI | MOVICON.prg:3887 | — | — | TALILOT | Pendiente: alias dinámicos o temporales |
| ACTURETMO | MOVICON.prg:3899 | — | CONMAE, CONTIIVA, CONTIRET | — | No certificada: requiere cambios y pruebas |
| BASEOKMOV | MOVICON.prg:3931 | CONMAE, CONTIIVA, CONTIRET | — | — | No certificada: requiere cambios y pruebas |
| ACTURETMO1 | MOVICON.prg:3981 | — | — | TALILOT | Pendiente: alias dinámicos o temporales |
| LOTEXLS | MOVICON.prg:4003 | — | NOMCALEN | — | No certificada: requiere cambios y pruebas |
| RUTARX | MOVICON.prg:4033 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| LOTEXLS2 | MOVICON.prg:4065 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| LOTEXLS3 | MOVICON.prg:4076 | — | — | TALILOT | Pendiente: alias dinámicos o temporales |
| LOTEXLS3_2 | MOVICON.prg:4168 | — | — | TALILOT | Pendiente: alias dinámicos o temporales |
| EDITAVAL | MOVICON.prg:4241 | — | — | TALILOT | Pendiente: alias dinámicos o temporales |
| EDIVAL2 | MOVICON.prg:4262 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| VALGRAB | MOVICON.prg:4273 | — | — | TALILOT | Pendiente: alias dinámicos o temporales |
| ORDENTL | MOVICON.prg:4288 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| COPIMOV | MOVICON.prg:4316 | — | CONEMP, MOVxx, NOMCALEN | — | No certificada: requiere cambios y pruebas |
| CONTOKM | MOVICON.prg:4358 | CONEMP | — | — | No certificada: requiere cambios y pruebas |
| COPIMOK | MOVICON.prg:4375 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| COPIMOV2 | MOVICON.prg:4382 | MOVxx | — | TALILOT | No certificada: requiere cambios y pruebas |
| MOVIBUS | MOVICON.prg:4448 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| BUSCADC | MOVICON.prg:4466 | — | — | TALILOT | Pendiente: alias dinámicos o temporales |
| IMPLOTE | MOVICON.prg:4487 | CONMOVI | CONCECOS, CONMAE, CONTICOM, FADCLI, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| IMPLOTEX | MOVICON.prg:4539 | — | CONCECOS, CONMAE, CONTICOM, FADCLI, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| IMPLOTEX2 | MOVICON.prg:4558 | — | — | TALILOT | Pendiente: alias dinámicos o temporales |
| IMPLOTEX1 | MOVICON.prg:4780 | — | CONCECOS, CONMAE, CONTICOM, FADCLI, VISDOCUM | TALILOT | No certificada: requiere cambios y pruebas |
| IMPLOTE2 | MOVICON.prg:5020 | — | CONCECOS, CONMAE, CONTICOM, FADCLI, VISDOCUM | TALILOT | No certificada: requiere cambios y pruebas |
| IMPLOTE2_8 | MOVICON.prg:5226 | — | CONCECOS, CONMAE, CONTICOM, FADCLI, VISDOCUM | TALILOT | No certificada: requiere cambios y pruebas |
| VLRLOT | MOVICON.prg:5389 | — | — | TALILOT | Pendiente: alias dinámicos o temporales |
| MESLOTK | MOVICON.prg:5410 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| MARCAR | MOVICON.prg:5420 | — | — | CALIAS | Pendiente: alias dinámicos o temporales |
| CREALOT2 | MOVICON.prg:5448 | CONMOVI | VISAUDI, VISUSU | — | No certificada: requiere cambios y pruebas |
| MESOK3 | MOVICON.prg:5487 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| USUOK7 | MOVICON.prg:5501 | VISUSU | — | — | No certificada: requiere cambios y pruebas |
| LOTEE | MOVICON.prg:5513 | CONMOVI | — | — | No certificada: requiere cambios y pruebas |
| GRABALOT | MOVICON.prg:5528 | CONMOVI | VISAUDI | — | No certificada: requiere cambios y pruebas |
| BORRALOT | MOVICON.prg:5574 | CONMOVI | VISAUDI | — | No certificada: requiere cambios y pruebas |
| DEPURALO | MOVICON.prg:5629 | CONMOVI, MC&lt;lote&gt; | VISAUDI | — | No certificada: requiere cambios y pruebas |
| DEPURAL1 | MOVICON.prg:5689 | — | VISAUDI | TALIGEN, TALILOT | No certificada: requiere cambios y pruebas |
| VERIFI4 | MOVICON.prg:5747 | CONMAE | — | ALITEM | No certificada: requiere cambios y pruebas |
| VERIFI | MOVICON.prg:5821 | CONCTR, CONMOVI | COCENTRO, CONCECOS, CONDOCUM, CONMAE, CONTICOM, CONTIDOC, FADCLI, MOVxx, VISAUDI, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| VERIFI2 | MOVICON.prg:5947 | CONCECOS, CONMAE, CONTICOM, CONTIDOC, FADCLI, MOVxx, VISDOCUM | COCENTRO, CONDOCUM | TALILOT, TALIERR | No certificada: requiere cambios y pruebas |
| VERIFI3 | MOVICON.prg:6279 | — | COCENTRO, CONDOCUM, CONMAE | — | No certificada: requiere cambios y pruebas |
| VERIFIREP | MOVICON.prg:6334 | — | — | TALIERR | Pendiente: alias dinámicos o temporales |
| VERIFI31 | MOVICON.prg:6367 | — | — | TALIERR | Pendiente: alias dinámicos o temporales |
| INFERR | MOVICON.prg:6407 | — | — | TALIERR | Pendiente: alias dinámicos o temporales |
| VERIFI32 | MOVICON.prg:6483 | — | COCENTRO, CONDOCUM, CONMAE | — | No certificada: requiere cambios y pruebas |
| ACTUALIMO2 | MOVICON.prg:6521 | CONDOCUM, CONMAE | COCENTRO | TALILOT, TALIMOV, TALINIT, TALIMOVI | No certificada: requiere cambios y pruebas |
| CAPTURA | MOVICON.prg:6639 | — | CONTICOM, MOVxx, NOMCALEN, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| GENLOTE | MOVICON.prg:6678 | MOVxx | — | CALIAS | No certificada: requiere cambios y pruebas |
| DOCUMOK | MOVICON.prg:6709 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CAPTUOK | MOVICON.prg:6725 | — | — | CALICOMP, CALIDOC | Pendiente: alias dinámicos o temporales |
| HABIMES | MOVICON.prg:6744 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| HABIMES2 | MOVICON.prg:6763 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| REASIGLO | MOVICON.prg:6781 | CONMOVI | CIUDAD, CONCECOS, CONMAE, FADCLI, FADTAB | — | No certificada: requiere cambios y pruebas |
| COSOKR | MOVICON.prg:6828 | CONCECOS | — | — | No certificada: requiere cambios y pruebas |
| REASIGL2 | MOVICON.prg:6850 | — | CONMAE, FADCLI | — | No certificada: requiere cambios y pruebas |
| REASIGL3 | MOVICON.prg:6869 | CONMAE, FADCLI | — | TALILOT | No certificada: requiere cambios y pruebas |
| CTAOKM7 | MOVICON.prg:6924 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| NITOKM | MOVICON.prg:6984 | FADCLI | CIUDAD, FADTAB | — | No certificada: requiere cambios y pruebas |
| COSOKM | MOVICON.prg:7046 | CONCECOS | — | — | No certificada: requiere cambios y pruebas |
| CONSULCC | MOVICON.prg:7092 | CONCECOS | — | — | No certificada: requiere cambios y pruebas |
| CCBUS | MOVICON.prg:7121 | — | — | TALICOS | Pendiente: alias dinámicos o temporales |
| CONCEOKM | MOVICON.prg:7136 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| BASEOKM | MOVICON.prg:7145 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ACTUCOSXX | MOVICON.prg:7155 | COCENTRO, CONMAE | — | — | No certificada: requiere cambios y pruebas |
| ACTUMAEXX | MOVICON.prg:7185 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| REEMBOL01 | MOVICON.prg:7268 | CONREITE | CIUDAD, CONCECOS, CONMOVI, CONREMAE, CONTICOM, FADCLI, FADTAB, NOMCALEN, VISDOCUM, VISION | — | No certificada: requiere cambios y pruebas |
| ACTU_LOTRE | MOVICON.prg:7370 | CONREMAE | — | TALIAS | No certificada: requiere cambios y pruebas |
| EDITA_REEM | MOVICON.prg:7460 | — | CIUDAD, CONCECOS, FADCLI, FADTAB | TALIAS, TALINIT | No certificada: requiere cambios y pruebas |
| NITOKM_R | MOVICON.prg:7512 | FADCLI | CIUDAD, FADTAB | — | No certificada: requiere cambios y pruebas |
| OK_CC | MOVICON.prg:7575 | — | CONCECOS | — | No certificada: requiere cambios y pruebas |
| AYUDPLA_RE | MOVICON.prg:7584 | VISDOCUM | — | — | No certificada: requiere cambios y pruebas |
| AYUDCOMP_RE | MOVICON.prg:7615 | CONTICOM | — | — | No certificada: requiere cambios y pruebas |
| GRABAITE_RE | MOVICON.prg:7646 | — | — | TALIAS | Pendiente: alias dinámicos o temporales |
| GRABAREEM | MOVICON.prg:7671 | CONREMAE | — | — | No certificada: requiere cambios y pruebas |
| SALIR_RE | MOVICON.prg:7709 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONTAB_REEM | MOVICON.prg:7727 | CONMOVI, CONREMAE, VISDOCUM, VISION | FADCLI | TALIAS | No certificada: requiere cambios y pruebas |
| ACTUMAE_L | MOVICON.prg:7894 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| VERSALCOS | PLANMAES.PRG:4 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| CMAESTRO | PLANMAES.PRG:16 | CONMAE | CONPUC, VISAUDI | — | No certificada: requiere cambios y pruebas |
| VERSALDOS | PLANMAES.PRG:87 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| VERIBORR | PLANMAES.PRG:116 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| BORRAPL | PLANMAES.PRG:143 | CONMAE | VISAUDI | — | No certificada: requiere cambios y pruebas |
| ORDENN2 | PLANMAES.PRG:192 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| ORDENN | PLANMAES.PRG:221 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| CMAEST1 | PLANMAES.PRG:253 | CONMAE | CONPUC, VISAUDI | — | No certificada: requiere cambios y pruebas |
| IRET | PLANMAES.PRG:336 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| COSDIS | PLANMAES.PRG:344 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CMAEST2 | PLANMAES.PRG:352 | CONMAE, CONPUC | — | — | No certificada: requiere cambios y pruebas |
| CTAPADRE | PLANMAES.PRG:389 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| GRABAMAES | PLANMAES.PRG:406 | CONMAE, CONPUC | VISAUDI | — | No certificada: requiere cambios y pruebas |
| ESTADO | PLANMAES.PRG:500 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ORDBUSCA | PLANMAES.PRG:508 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| VLRNT | PLANMAES.PRG:519 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ANA_MOVCTA | REPROCES.PRG:6 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| ANA_MOVCTA2 | REPROCES.PRG:23 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| ANA_MOVCTA3 | REPROCES.PRG:36 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| ANA_NIVEL | REPROCES.PRG:121 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| DOBLE_LOT | REPROCES.PRG:169 | MOVxx | — | CTEM | No certificada: requiere cambios y pruebas |
| TERCE_LOT | REPROCES.PRG:217 | — | MOVxx | — | No certificada: requiere cambios y pruebas |
| TERCE_LOT2 | REPROCES.PRG:238 | MOVxx | — | — | No certificada: requiere cambios y pruebas |
| CREA_MOV2 | REPROCES.PRG:283 | — | — | CMOV | Pendiente: alias dinámicos o temporales |
| REPRO01 | REPROCES.PRG:295 | MOVxx | CIUDAD, CONCECOS, CONDOCUM, CONMAE, CONTICOM, CONTIIVA, CONTIRET, FADCLI, FADTAB, VISAUDI, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| ORDMOV | REPROCES.PRG:383 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| BUSDOC2 | REPROCES.PRG:412 | — | — | TALIAS | Pendiente: alias dinámicos o temporales |
| EDITAREP | REPROCES.PRG:427 | CONMAE | CIUDAD, CONCECOS, CONDOCUM, CONTICOM, CONTIIVA, CONTIRET, FADCLI, FADTAB, VISDOCUM | TALIAS | No certificada: requiere cambios y pruebas |
| NITOK_N | REPROCES.PRG:517 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| GRAVAREP | REPROCES.PRG:540 | — | CONMAE | TALIAS | No certificada: requiere cambios y pruebas |
| AYUDAM | REPROCES.PRG:577 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| REASIMES | REPROCES.PRG:594 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| REASIME2 | REPROCES.PRG:615 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| REASIME3 | REPROCES.PRG:640 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| REASIME4 | REPROCES.PRG:655 | — | — | CMOV, TALIMAE | Pendiente: alias dinámicos o temporales |
| RECONDOC | REPROCES.PRG:709 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| RECONDO2 | REPROCES.PRG:729 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| RECONDO3 | REPROCES.PRG:746 | — | — | TALIDOC | Pendiente: alias dinámicos o temporales |
| RECONDO4 | REPROCES.PRG:777 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| RECONDO5 | REPROCES.PRG:792 | — | — | CMOV, TALIDOC | Pendiente: alias dinámicos o temporales |
| AUTOREP | REPROCES.PRG:830 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| AUTOREP2 | REPROCES.PRG:848 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| REPRO027 | REPROCES.PRG:855 | — | CONMAE, MOVxx, VISAUDI | — | No certificada: requiere cambios y pruebas |
| REPRO02 | REPROCES.PRG:939 | — | CONCECOS, CONMAE, MOVxx, VISAUDI | — | No certificada: requiere cambios y pruebas |
| REPRO21M | REPROCES.PRG:993 | — | CONCECOS, CONMAE, MOVxx | — | No certificada: requiere cambios y pruebas |
| REPRO31M | REPROCES.PRG:1024 | — | — | TALICOS | Pendiente: alias dinámicos o temporales |
| REPRO33 | REPROCES.PRG:1056 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| REPRO35 | REPROCES.PRG:1075 | — | — | CMOV, XMAECC, TALIMAE, TALICLI | Pendiente: alias dinámicos o temporales |
| CREACOS3 | REPROCES.PRG:1351 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| REPRO23A | REPROCES.PRG:1402 | — | — | TALIMAE | Pendiente: alias dinámicos o temporales |
| REPRO26 | REPROCES.PRG:1420 | CONMAE, MOVxx | — | — | No certificada: requiere cambios y pruebas |
| REVAMESSQL | REPROCES.PRG:1802 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ACUNIVEL | REPROCES.PRG:2565 | — | CONMAE | CXOVD, CXOVC | No certificada: requiere cambios y pruebas |
| ACUNIVEL_XX | REPROCES.PRG:2601 | CONMAE | — | CMOVTMP | No certificada: requiere cambios y pruebas |
| RUNQUERY | REPROCES.PRG:2894 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| RUNQUERY_DIRECTO | REPROCES.PRG:2923 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ACU_MOV_LUCHO | REPROCES.PRG:3230 | CONMAE, FADCLI, MOVxx | — | CMOVMES | No certificada: requiere cambios y pruebas |
| REPRO21_06 | REPROCES.PRG:3772 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| REPRO25_06 | REPROCES.PRG:3787 | — | — | CMOV, TALIMAE, TALICLI | Pendiente: alias dinámicos o temporales |
| REPRO23 | REPROCES.PRG:3914 | — | CONCECOS, CONMAE, MOVxx | TALIMAE | No certificada: requiere cambios y pruebas |
| REPRO24 | REPROCES.PRG:4082 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| REPRO21 | REPROCES.PRG:4113 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| REPRO25 | REPROCES.PRG:4128 | — | — | CMOV, TALICLI | Pendiente: alias dinámicos o temporales |
| REPROMES | REPROCES.PRG:4185 | — | — | CMOV, TALIMAE | Pendiente: alias dinámicos o temporales |
| CIERR01 | REPROCES.PRG:4281 | — | VISAUDI | — | No certificada: requiere cambios y pruebas |
| CIERR02 | REPROCES.PRG:4305 | — | CONMOVI, CONTICOM, NOMCALEN, VISAUDI, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| CIERR21 | REPROCES.PRG:4337 | CONMOVI | VISAUDI | — | No certificada: requiere cambios y pruebas |
| CIERR22 | REPROCES.PRG:4385 | — | VISAUDI | TALIMAE, TALILOT | No certificada: requiere cambios y pruebas |
| CIERR03 | REPROCES.PRG:4427 | — | VISAUDI | 18 | No certificada: requiere cambios y pruebas |
| CIERR031 | REPROCES.PRG:4440 | — | VISAUDI | — | No certificada: requiere cambios y pruebas |
| ESPE03 | REPROCES.PRG:4468 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ESPE03I | REPROCES.PRG:4490 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ESPE04 | REPROCES.PRG:4517 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ESPE05 | REPROCES.PRG:4527 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| ESPE05_1 | REPROCES.PRG:4543 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| ESPE06 | REPROCES.PRG:4561 | — | CONDOCUM, CONMAE, CONMOVI, CONTICOM, MC&lt;lote&gt;, MOVxx, VISAUDI, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| ESPE09 | REPROCES.PRG:4586 | — | CONDOCUM, CONMAE, CONMOVI, CONTICOM, MC&lt;lote&gt;, MOVxx, VISAUDI, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| ESPE091 | REPROCES.PRG:4615 | CONDOCUM, CONMOVI, MC&lt;lote&gt;, MOVxx | CONMAE, VISAUDI | — | No certificada: requiere cambios y pruebas |
| ESPE08 | REPROCES.PRG:4759 | — | CONDOCUM, CONMAE, CONMOVI, CONTICOM, MC&lt;lote&gt;, MOVxx, VISAUDI, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| ESPE081 | REPROCES.PRG:4785 | CONDOCUM, CONMOVI, MC&lt;lote&gt;, MOVxx | CONMAE, VISAUDI | — | No certificada: requiere cambios y pruebas |
| ESPE08J | REPROCES.PRG:4905 | — | CONMAE, CONMOVI, MC&lt;lote&gt;, MOVxx, VISAUDI | — | No certificada: requiere cambios y pruebas |
| ESPE081J | REPROCES.PRG:4930 | CONMOVI, MC&lt;lote&gt;, MOVxx | CONMAE, VISAUDI | — | No certificada: requiere cambios y pruebas |
| ESPE081_M | REPROCES.PRG:5039 | CONMOVI, MC&lt;lote&gt;, MOVxx | CONMAE, VISAUDI | — | No certificada: requiere cambios y pruebas |
| LOTEES | REPROCES.PRG:5149 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ESPE061 | REPROCES.PRG:5167 | CONDOCUM, CONMOVI, MC&lt;lote&gt;, MOVxx | CONMAE, VISAUDI | — | No certificada: requiere cambios y pruebas |
| ESPE07 | REPROCES.PRG:5302 | — | CONDOCUM, CONMAE, CONMOVI, MC&lt;lote&gt;, MOVxx, VISAUDI, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| OKESPE7 | REPROCES.PRG:5326 | CONDOCUM | — | — | No certificada: requiere cambios y pruebas |
| ESPE071 | REPROCES.PRG:5347 | CONDOCUM, CONMOVI, MC&lt;lote&gt;, MOVxx | CONMAE, VISAUDI | — | No certificada: requiere cambios y pruebas |
| ESPE10 | REPROCES.PRG:5498 | — | CONEMP, CONMAE, CONMOVI, MOVxx, NOMCALEN | — | No certificada: requiere cambios y pruebas |
| CTACIER | REPROCES.PRG:5528 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| ESPE101 | REPROCES.PRG:5563 | CONMOVI | CONMAE, MOVxx | — | No certificada: requiere cambios y pruebas |
| ESPE102 | REPROCES.PRG:5631 | CONMAE, MOVxx | — | TALIMAE, TALICOS, TALILOT | No certificada: requiere cambios y pruebas |
| ESPE11 | REPROCES.PRG:5810 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| ESPE11G | REPROCES.PRG:5846 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ESPE11GM | REPROCES.PRG:5868 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ESPE11GC | REPROCES.PRG:5887 | — | — | TALIMOV | Pendiente: alias dinámicos o temporales |
| ESPE12 | REPROCES.PRG:5911 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| ESPE12_1 | REPROCES.PRG:5937 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ESPE12_2 | REPROCES.PRG:5959 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ESPE12_3 | REPROCES.PRG:5984 | — | — | CALIMOV | Pendiente: alias dinámicos o temporales |
| CON900 | REPROCES.PRG:6009 | — | CONDOCUM, CONMAE, MOVxx, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| CONTA2 | REPROCES.PRG:6058 | CONDOCUM | — | — | No certificada: requiere cambios y pruebas |
| CON901 | REPROCES.PRG:6105 | CONDOCUM, MOVxx | CONMAE | — | No certificada: requiere cambios y pruebas |
| LOTEE2 | REPROCES.PRG:6169 | — | CONMOVI, MC&lt;lote&gt; | — | No certificada: requiere cambios y pruebas |
| LOTEE3 | REPROCES.PRG:6187 | CONMOVI, MC&lt;lote&gt; | — | TALIAR | No certificada: requiere cambios y pruebas |
| CONS002 | REPROCES.PRG:6257 | CONCECOS, CONMAE, CONSOLID, CONTICOM, MOVxx | — | — | No certificada: requiere cambios y pruebas |
| CONS210 | REPROCES.PRG:6328 | — | CONCECOS, CONMAE, CONTICOM | — | No certificada: requiere cambios y pruebas |
| CONS2101 | REPROCES.PRG:6372 | CONCECOS, CONMAE, CONTICOM | — | — | No certificada: requiere cambios y pruebas |
| CONS220 | REPROCES.PRG:6423 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CONS222 | REPROCES.PRG:6503 | — | — | TMOV, XMOV | Pendiente: alias dinámicos o temporales |
| TRASLASA | REPROCES.PRG:6525 | — | CONMAE, CONMOVI, CONTICOM, FADCLI, MC&lt;lote&gt;, MOVxx, NOMCALEN, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| NITTRAS | REPROCES.PRG:6603 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| TRASLAS2 | REPROCES.PRG:6614 | CONMAE, CONMOVI, MC&lt;lote&gt; | MOVxx | — | No certificada: requiere cambios y pruebas |
| TRASLAS3 | REPROCES.PRG:6721 | CONMOVI, MC&lt;lote&gt;, MOVxx | — | — | No certificada: requiere cambios y pruebas |
| STRULOT | REPROCES.PRG:6788 | CONMOVI | — | — | No certificada: requiere cambios y pruebas |
| STRULOT2 | REPROCES.PRG:6805 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| MOVDOCK | REPROCES.PRG:6823 | — | CONMAE, FADCLI | — | No certificada: requiere cambios y pruebas |
| MOVDOCK_CTA | REPROCES.PRG:6884 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| VERESTRUCTA | REPROCES.PRG:6929 | CONMAE | — | TALITEM | No certificada: requiere cambios y pruebas |
| MOVDOCK2_CTA | REPROCES.PRG:7025 | CONMAE | — | TALIAS, TALITEM | No certificada: requiere cambios y pruebas |
| MOVDOCK_CRE | REPROCES.PRG:7126 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| MOVDOCK2_CRE | REPROCES.PRG:7172 | CONMAE | — | TALIAS, X2ALIMAE | No certificada: requiere cambios y pruebas |
| MOVDOCK2 | REPROCES.PRG:7236 | CONMAE, FADCLI | — | TALIAS, TALITEM | No certificada: requiere cambios y pruebas |
| BORRAMAE | REPROCES.PRG:7375 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| LIMPCIA | REPROCES.PRG:7449 | — | NOMCALEN | — | No certificada: requiere cambios y pruebas |
| LIMPCIA2 | REPROCES.PRG:7471 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| LIMPCIA3 | REPROCES.PRG:7492 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| LIMPCIA4 | REPROCES.PRG:7509 | — | — | CMOV | Pendiente: alias dinámicos o temporales |
| RECLA01 | REPROCES.PRG:7524 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| RECLA01G | REPROCES.PRG:7547 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| RECLA01GM | REPROCES.PRG:7578 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| RECLA03 | REPROCES.PRG:7602 | — | CONMAE | — | No certificada: requiere cambios y pruebas |
| RECLA03G | REPROCES.PRG:7625 | CONMAE | — | — | No certificada: requiere cambios y pruebas |
| RECLA03GM | REPROCES.PRG:7656 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| RECLA03GC | REPROCES.PRG:7678 | — | — | TALIMOV | Pendiente: alias dinámicos o temporales |
| RECLA01GC | REPROCES.PRG:7693 | — | — | TALIMOV | Pendiente: alias dinámicos o temporales |
| RECLA02 | REPROCES.PRG:7709 | — | CONMAE, CONTICOM, FADCLI, VISDOCUM | — | No certificada: requiere cambios y pruebas |
| RECLA021 | REPROCES.PRG:7734 | — | CONMAE, FADCLI | — | No certificada: requiere cambios y pruebas |
| RECLA021C | REPROCES.PRG:7758 | CONMAE, FADCLI | — | TALIMOV | No certificada: requiere cambios y pruebas |
| EXPORMES | REPROCES.PRG:7787 | CONCTR | CONCECOS, CONMAE, CONTICOM, FADCLI, NOMCALEN, VISAUDI, VISDOCUM, VISUSU | — | No certificada: requiere cambios y pruebas |
| EXPORMES2A | REPROCES.PRG:7848 | — | CONCECOS, CONMAE, CONTICOM, FADCLI, VISAUDI, VISDOCUM, VISUSU | — | No certificada: requiere cambios y pruebas |
| EXPORMES2B | REPROCES.PRG:7991 | CONCECOS, CONMAE, CONTICOM, FADCLI, VISAUDI, VISDOCUM, VISUSU | — | IALIMOV | No certificada: requiere cambios y pruebas |
| REINDXT | DSIINDEX.PRG:9 | — | CONMAE, FADCLI, VISION | — | Sustitución técnica / índices |
| INDEXVIS | DSIINDEX.PRG:1563 | — | CONMAE, FADCLI, VISION | — | Sustitución técnica / índices |
| MARCAINV | DSIINDEX.PRG:1791 | — | — | — | Sustitución técnica / índices |
| INDEXMET | DSIINDEX.PRG:1833 | — | — | — | Sustitución técnica / índices |
| REINDXF | DSIINDEX.PRG:1838 | — | CONMAE, FADCLI, VISION | — | Sustitución técnica / índices |
| REINDXI | DSIINDEX.PRG:3107 | — | CONMAE, FADCLI, VISION | — | Sustitución técnica / índices |
| REINDXI2 | DSIINDEX.PRG:4409 | — | CONMAE, FADCLI, VISION | — | Sustitución técnica / índices |
| ABREPPAL | VISDBF.PRG:5 | FADCLI, VISION | — | — | No certificada: requiere cambios y pruebas |
| BORRATEMP | VISDBF.PRG:104 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ABREDBF | VISDBF.PRG:121 | — | CONMAE, VISION | — | No certificada: requiere cambios y pruebas |
| ABRE4 | VISDBF.PRG:133 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| ABREDBF2 | VISDBF.PRG:151 | CONMAE, VISION | — | — | No certificada: requiere cambios y pruebas |
| VEHI001 | FACTAB.PRG:8 | FADVEHI | FADTAB | — | No certificada: requiere cambios y pruebas |
| BORRAVEHI | FACTAB.PRG:42 | FADVEHI | — | — | No certificada: requiere cambios y pruebas |
| TRAB_VEHI | FACTAB.PRG:55 | FADVEHI | FADTAB | — | No certificada: requiere cambios y pruebas |
| VEHIGRABA | FACTAB.PRG:84 | FADVEHI | — | — | No certificada: requiere cambios y pruebas |
| ZONAS | FACTAB.PRG:100 | FADTAB | — | — | No certificada: requiere cambios y pruebas |
| EVENTOS | FACTAB.PRG:136 | EVENTOS | FADTAB | — | No certificada: requiere cambios y pruebas |
| BORRAEVEN | FACTAB.PRG:168 | EVENTOS | — | — | No certificada: requiere cambios y pruebas |
| TRAB_EVEN | FACTAB.PRG:180 | EVENTOS | FADTAB | — | No certificada: requiere cambios y pruebas |
| DSIGRABAE | FACTAB.PRG:206 | EVENTOS | — | — | No certificada: requiere cambios y pruebas |
| LISTARZ | FACTAB.PRG:223 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CIUDAD | FACTAB.PRG:238 | ACTIVIDA, CIUDAD, FAESPERA | FADTAB | — | No certificada: requiere cambios y pruebas |
| CLISTAR | FACTAB.PRG:287 | — | — | CALI, CALISAL | Pendiente: alias dinámicos o temporales |
| DSIESTAZ | FACTAB.PRG:398 | FADTAB | — | CALI | No certificada: requiere cambios y pruebas |
| TRAB_ZONA | FACTAB.PRG:432 | FADTAB | — | — | No certificada: requiere cambios y pruebas |
| TRAB_CIU | FACTAB.PRG:458 | — | FADTAB | CALI | No certificada: requiere cambios y pruebas |
| GRABACIU | FACTAB.PRG:490 | — | — | CALI | Pendiente: alias dinámicos o temporales |
| DSIGRABAZ | FACTAB.PRG:505 | FADTAB | — | — | No certificada: requiere cambios y pruebas |
| BORRATAB1 | FACTAB.PRG:524 | FADTAB | — | — | No certificada: requiere cambios y pruebas |
| BORRATAB4 | FACTAB.PRG:536 | — | — | CALI | Pendiente: alias dinámicos o temporales |
| DUFORMA | FACTAB.PRG:548 | — | — | CALIFAC | Pendiente: alias dinámicos o temporales |
| FORMACOP | FACTAB.PRG:571 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| FORMACOP2 | FACTAB.PRG:633 | — | — | FTEMFOR1, FTEMFOR2 | Pendiente: alias dinámicos o temporales |
| FADGENF | FACTAB.PRG:691 | CADGENF, CAUGENF, COMGENF, CONGENF, FADGENF, TIDGENF, XADGENF | CADFACTU, CADFORMA, CAUFACTU, CAUFORMA, COMFACTU, COMFORMA, CONFACTU, CONFORMA, FADFACTU, FADFORMA, TIDFORMA, TIDINVE, VISAUDI, XADFACTU, XADFORMA | — | No certificada: requiere cambios y pruebas |
| ODLG_INIT9 | FACTAB.PRG:746 | — | CADFACTU, CADFORMA, CAUFACTU, CAUFORMA, COMFACTU, COMFORMA, CONFACTU, CONFORMA, FADFACTU, FADFORMA, TIDFORMA, TIDINVE, VISAUDI, XADFACTU, XADFORMA | — | No certificada: requiere cambios y pruebas |
| FADGENFC | FACTAB.PRG:761 | — | CADFACTU, CADFORMA, CAUFACTU, CAUFORMA, COMFACTU, COMFORMA, CONFACTU, CONFORMA, FADFACTU, FADFORMA, TIDFORMA, TIDINVE, VISAUDI, XADFACTU, XADFORMA | CALIFAC | No certificada: requiere cambios y pruebas |
| OKFORMA | FACTAB.PRG:818 | — | — | CALIFAC | Pendiente: alias dinámicos o temporales |
| GRAVAFOR | FACTAB.PRG:827 | CADFACTU, CADFORMA, CAUFACTU, CAUFORMA, COMFACTU, COMFORMA, CONFACTU, CONFORMA, FADFACTU, FADFORMA, TIDFORMA, TIDINVE, XADFACTU, XADFORMA | VISAUDI | CALIFAC | No certificada: requiere cambios y pruebas |
| FADGENFB | FACTAB.PRG:914 | — | — | CALIFAC | Pendiente: alias dinámicos o temporales |
| FADGENF2 | FACTAB.PRG:926 | CADFORMA, CAUFORMA, COMFORMA, CONFORMA, FADFORMA, TIDFORMA, XADFORMA | — | CALIFAC | No certificada: requiere cambios y pruebas |
| FADGENFF | FACTAB.PRG:1098 | — | — | CALIFOR | Pendiente: alias dinámicos o temporales |
| GRABAFF | FACTAB.PRG:1131 | — | — | CALIFOR, CALIFAC | Pendiente: alias dinámicos o temporales |
| BORRAFOR | FACTAB.PRG:1155 | — | — | CALIFOR | Pendiente: alias dinámicos o temporales |
| FADGENFN | FACTAB.PRG:1167 | — | — | CALIFOR | Pendiente: alias dinámicos o temporales |
| FADGENFI | FACTAB.PRG:1212 | — | — | CALIFOR | Pendiente: alias dinámicos o temporales |
| GRABAF3 | FACTAB.PRG:1248 | — | — | CALIFOR, CALIFAC | Pendiente: alias dinámicos o temporales |
| GRABAF6 | FACTAB.PRG:1271 | — | — | CALIFOR, CALIFAC | Pendiente: alias dinámicos o temporales |
| FADGENFP | FACTAB.PRG:1298 | — | — | CALIFOR | Pendiente: alias dinámicos o temporales |
| GRABAITF | FACTAB.PRG:1377 | — | — | CALIFOR | Pendiente: alias dinámicos o temporales |
| CAMBIOF | FACTAB.PRG:1399 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CMES | CONTAGRAL.PRG:9 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| XLS_METCOMP | CONTAGRAL.PRG:21 | — | TIDSAL | CALIAS | No certificada: requiere cambios y pruebas |
| DIAS | CONTAGRAL.PRG:138 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CADSALDO | CONTAGRAL.PRG:152 | — | — | WALI | Pendiente: alias dinámicos o temporales |
| AYUBUS | CONTAGRAL.PRG:221 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| BUSFIN | CONTAGRAL.PRG:239 | — | — | FALIBUS | Pendiente: alias dinámicos o temporales |
| BUSORDEN | CONTAGRAL.PRG:255 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| CAL_VIGMC | CONTAGRAL.PRG:272 | NOMCALEN | — | — | No certificada: requiere cambios y pruebas |
| NOMB_MC | CONTAGRAL.PRG:295 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| SELCOLX | CONTAGRAL.PRG:310 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| AYUCODV | CONTAGRAL.PRG:336 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| CADTOT | CONTAGRAL.PRG:398 | CADMAE | — | — | No certificada: requiere cambios y pruebas |
| CLIENTER | CONTAGRAL.PRG:430 | FADCLI | CONEMP | — | No certificada: requiere cambios y pruebas |
| CLIBUSR | CONTAGRAL.PRG:454 | — | FADCLI | — | No certificada: requiere cambios y pruebas |
| BUSCLILR | CONTAGRAL.PRG:472 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| CONREASIG | CONTAGRAL.PRG:495 | CONEMP | — | — | No certificada: requiere cambios y pruebas |
| PROCERE | CONTAGRAL.PRG:507 | CONEMP | FADCLI | — | No certificada: requiere cambios y pruebas |
| PROCERE1 | CONTAGRAL.PRG:643 | — | FADCLI | — | No certificada: requiere cambios y pruebas |
| PROCERE2 | CONTAGRAL.PRG:664 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| PROCERE3 | CONTAGRAL.PRG:693 | — | FADCLI | — | No certificada: requiere cambios y pruebas |
| PROCERE4 | CONTAGRAL.PRG:707 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| EDITACLI | CONTAGRAL.PRG:746 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| GRABCOD2 | CONTAGRAL.PRG:769 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| CLIENTES | CONTAGRAL.PRG:778 | FADCLI, FADCON | ACTIVIDA, CADEMP, CADMAE, CIUDAD, FADTAB, NOMCALEN, TIDBODE, TIDSAL, VEDVEN, VISAUDI, VISTDOC, XADMAE, XADPAGOS | — | No certificada: requiere cambios y pruebas |
| ODLG_INITCL | CONTAGRAL.PRG:870 | — | ACTIVIDA, CADEMP, CADMAE, CIUDAD, FADCLI, FADCON, FADTAB, NOMCALEN, TIDBODE, TIDSAL, VEDVEN, VISAUDI, VISTDOC, XADMAE, XADPAGOS | — | No certificada: requiere cambios y pruebas |
| VER_NITR | CONTAGRAL.PRG:901 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| BLO_GRAL | CONTAGRAL.PRG:907 | FADCON | CADMAE, VISAUDI | — | No certificada: requiere cambios y pruebas |
| BLO_GRAL2 | CONTAGRAL.PRG:938 | — | CADMAE, VISAUDI | CALICLI | No certificada: requiere cambios y pruebas |
| VERNOM | CONTAGRAL.PRG:973 | FADCLI, VISTDOC, XADPAGOS | — | — | No certificada: requiere cambios y pruebas |
| BORRACLI | CONTAGRAL.PRG:1002 | FADCLI, XADMAE | — | — | No certificada: requiere cambios y pruebas |
| LISTER1 | CONTAGRAL.PRG:1039 | — | CADEMP, FADCLI, FADTAB, NOMCALEN, VEDVEN | — | No certificada: requiere cambios y pruebas |
| LISTERCU | CONTAGRAL.PRG:1053 | — | FADCLI | — | No certificada: requiere cambios y pruebas |
| LISTEU2 | CONTAGRAL.PRG:1111 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| LISRUTAS | CONTAGRAL.PRG:1210 | — | FADCLI, FADTAB, VEDVEN | — | No certificada: requiere cambios y pruebas |
| LISRUTASX | CONTAGRAL.PRG:1256 | FADCLI, VEDVEN | — | — | No certificada: requiere cambios y pruebas |
| LISTERCE | CONTAGRAL.PRG:1376 | — | CADEMP, FADCLI, FADTAB, NOMCALEN, VEDVEN | — | No certificada: requiere cambios y pruebas |
| AYUCODZ | CONTAGRAL.PRG:1433 | FADTAB | — | — | No certificada: requiere cambios y pruebas |
| LISTER2 | CONTAGRAL.PRG:1460 | FADCLI, FADTAB, VEDVEN | CADEMP, NOMCALEN | — | No certificada: requiere cambios y pruebas |
| FCHCLI | CONTAGRAL.PRG:1657 | — | NOMCALEN | — | No certificada: requiere cambios y pruebas |
| LISTER4 | CONTAGRAL.PRG:1685 | CADEMP, FADCLI | NOMCALEN | — | No certificada: requiere cambios y pruebas |
| LISTER5 | CONTAGRAL.PRG:1840 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| ETICLI | CONTAGRAL.PRG:1930 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| CARGACLIXL | CONTAGRAL.PRG:2089 | — | FADCLI | — | No certificada: requiere cambios y pruebas |
| CARGACLIXL1 | CONTAGRAL.PRG:2132 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| CARGA_CLI | CONTAGRAL.PRG:2223 | — | FADCLI | — | No certificada: requiere cambios y pruebas |
| SUBECLI | CONTAGRAL.PRG:2250 | — | FADCLI | — | No certificada: requiere cambios y pruebas |
| CLIPEGA3 | CONTAGRAL.PRG:2282 | FADCLI | — | CALITEM | No certificada: requiere cambios y pruebas |
| CLIPEGA | CONTAGRAL.PRG:2341 | FADCLI | — | CALITEM | No certificada: requiere cambios y pruebas |
| BUS_CLI | CONTAGRAL.PRG:2467 | — | FADCLI | — | No certificada: requiere cambios y pruebas |
| ORCLI3 | CONTAGRAL.PRG:2486 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| BUSCLI3T | CONTAGRAL.PRG:2508 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| TRAB_CLI2 | CONTAGRAL.PRG:2528 | ACTIVIDA, CADEMP, FADCLI, XADPAGOS | CIUDAD, FADCON, FADTAB, NOMCALEN, TIDBODE, TIDSAL, VEDVEN, VISAUDI, VISTDOC | — | No certificada: requiere cambios y pruebas |
| ADMCUENTA | CONTAGRAL.PRG:3066 | FADCTAS | — | — | No certificada: requiere cambios y pruebas |
| GRABACUENTA | CONTAGRAL.PRG:3106 | FADCTAS | — | — | No certificada: requiere cambios y pruebas |
| NITOKID | CONTAGRAL.PRG:3124 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| DIMORA | CONTAGRAL.PRG:3153 | FADCON | — | — | No certificada: requiere cambios y pruebas |
| NOMOK2 | CONTAGRAL.PRG:3168 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| OKBENEFI | CONTAGRAL.PRG:3185 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| CNOMOK | CONTAGRAL.PRG:3217 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| TEMPOK | CONTAGRAL.PRG:3253 | CADEMP | — | — | No certificada: requiere cambios y pruebas |
| TPAGOOK | CONTAGRAL.PRG:3277 | XADPAGOS | — | — | No certificada: requiere cambios y pruebas |
| GRABACLI | CONTAGRAL.PRG:3301 | FADCLI | TIDBODE, TIDSAL, VISAUDI | — | No certificada: requiere cambios y pruebas |
| REPLICA_BTW | CONTAGRAL.PRG:3469 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| VERIMODCLI | CONTAGRAL.PRG:3511 | — | VISAUDI | — | No certificada: requiere cambios y pruebas |
| REPLICA_CLI | CONTAGRAL.PRG:3648 | TIDBODE | — | OALIAS | No certificada: requiere cambios y pruebas |
| PINGCOMP | CONTAGRAL.PRG:3770 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| REPLICA_MER | CONTAGRAL.PRG:3804 | TIDBODE | — | OALIAS | No certificada: requiere cambios y pruebas |
| REPLI_METC | CONTAGRAL.PRG:3929 | TIDSAL | — | — | No certificada: requiere cambios y pruebas |
| ACTIOK | CONTAGRAL.PRG:3947 | ACTIVIDA | — | — | No certificada: requiere cambios y pruebas |
| CIUOK | CONTAGRAL.PRG:3970 | CIUDAD | — | — | No certificada: requiere cambios y pruebas |
| TDOCOK | CONTAGRAL.PRG:3992 | VISTDOC | — | — | No certificada: requiere cambios y pruebas |
| CODALTER | CONTAGRAL.PRG:4022 | FADCLI | — | — | No certificada: requiere cambios y pruebas |
| DIGITOK | CONTAGRAL.PRG:4040 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| PZONAOK | CONTAGRAL.PRG:4078 | FADTAB | — | — | No certificada: requiere cambios y pruebas |
| PVENOK | CONTAGRAL.PRG:4108 | VEDVEN | — | — | No certificada: requiere cambios y pruebas |
| BLO_CLI | CONTAGRAL.PRG:4127 | FADCLI | VISAUDI | — | No certificada: requiere cambios y pruebas |
| BLO_GRABA | CONTAGRAL.PRG:4153 | FADCLI | VISAUDI | — | No certificada: requiere cambios y pruebas |
| CUPO_CLI | CONTAGRAL.PRG:4179 | FADCLI | TIDBODE | — | No certificada: requiere cambios y pruebas |
| CUPMAX | CONTAGRAL.PRG:4205 | — | — | — | Sin almacenamiento propio acreditado; revisar servicio/interfaz |
| GRACUP | CONTAGRAL.PRG:4225 | — | TIDBODE | CALICLI | No certificada: requiere cambios y pruebas |
| ACTCLCUP | CONTAGRAL.PRG:4235 | TIDBODE | — | OALIAS | No certificada: requiere cambios y pruebas |
| GENIXLS | CONTAGRAL.PRG:4256 | — | FADCLI, TIDSAL | — | No certificada: requiere cambios y pruebas |
| GENIXLS2 | CONTAGRAL.PRG:4270 | FADCLI | TIDSAL | — | No certificada: requiere cambios y pruebas |

## Acciones de controles / botones

Inventario de declaraciones ACTION, no número de botones únicos. Una declaración puede contener varias llamadas o continuar en otra línea. La evidencia exacta en fuente es la referencia para implementar cada comportamiento.

| Función contenedora | Fuente | Control | Acción declarada |
|---|---|---|---|
| MAIN | CONTABDSI.PRG:106 | REDEFINE BTNBMP oBTS3  ID 201 OF oDLGPPAL FILENAME WF16 NOBORDER TOOLTIP "Definiciones" | ADM_LISTA() |
| MAIN | CONTABDSI.PRG:107 | REDEFINE BTNBMP oBTS4  ID 202 OF oDLGPPAL FILENAME WF11 NOBORDER TOOLTIP "Movimiento" | MENU_MOVI() |
| MAIN | CONTABDSI.PRG:108 | REDEFINE BTNBMP oBTS5  ID 203 OF oDLGPPAL FILENAME WF14 NOBORDER TOOLTIP "Consultas" | MENU_CONSULTA() |
| MAIN | CONTABDSI.PRG:109 | REDEFINE BTNBMP oBTS6  ID 204 OF oDLGPPAL FILENAME WF15 NOBORDER TOOLTIP "Informes" | MENU_INFOR() |
| MAIN | CONTABDSI.PRG:110 | REDEFINE BTNBMP oBTS8  ID 205 OF oDLGPPAL FILENAME WF6  NOBORDER TOOLTIP "Reprocesos" | MENU_REPRO() |
| MAIN | CONTABDSI.PRG:111 | REDEFINE BTNBMP oBTS10 ID 206 OF oDLGPPAL FILENAME WF7  NOBORDER TOOLTIP "Cierres" | MENU_CIERRE() |
| MAIN | CONTABDSI.PRG:112 | REDEFINE BTNBMP oBTS11 ID 207 OF oDLGPPAL FILENAME WF5  NOBORDER TOOLTIP "Medios Magneticos" | MENU_MEDIOS() |
| MAIN | CONTABDSI.PRG:113 | REDEFINE BTNBMP oBTS9  ID 208 OF oDLGPPAL FILENAME WF13 NOBORDER TOOLTIP "Consolidaciones" | MENU_CONSO() |
| MAIN | CONTABDSI.PRG:116 | REDEFINE BTNBMP oBTS16 ID 210 OF oDLGPPAL FILENAME WF8  NOBORDER TOOLTIP "Cambio Contabilidad" | INTERCAM("T") WHEN PERMI("T1C") |
| MAIN | CONTABDSI.PRG:117 | REDEFINE BTNBMP oBTS15 ID 211 OF oDLGPPAL FILENAME WF10 NOBORDER TOOLTIP "Salir" | oDLGPPAL:END() |
| ODLG_AGENDA | CONTABDSI.PRG:190 | @ 14, 195 BTNBMP oBT1 Size 22, 22 PIXEL FILENAME WMF2 TOOLTIP "Consultar" |  |
| INGRESO_CONTABLE | CONTABDSI.PRG:808 | REDEFINE BUTTON oBtn1 ID 201 OF oDlga | (INGRESO_CONTABLE2(1),odlga:END()) |
| INGRESO_CONTABLE | CONTABDSI.PRG:809 | REDEFINE BUTTON oBtn2 ID 202 OF oDlga | (INGRESO_CONTABLE2(2),oDlga:end()) |
| CONSULCLI | CONTABDSI.PRG:1846 | REDEFINE BUTTON ID 102 OF oDLG | oDLG:END() |
| CONSULCLI | CONTABDSI.PRG:1847 | REDEFINE BUTTON ID 103 OF oDLG | (CLIBUS(),oDLG:END()) |
| CONSULCLI | CONTABDSI.PRG:1848 | REDEFINE BUTTON ID 104 OF oDLG | oDLG:END() |
| ODLG_INIT4 | CONTABDSI.PRG:2339 | TASKITEM "[F2]Crear"      BITMAP WMF3 | (TIPODOC(),TRAB_DOC(.T.)),OBROW:REFRESH() |
| ODLG_INIT4 | CONTABDSI.PRG:2340 | TASKITEM "[F3]Modificar"  BITMAP WMF4 | TRAB_DOC(.F.),OBROW:REFRESH() |
| ODLG_INIT4 | CONTABDSI.PRG:2341 | TASKITEM "[F4]Eliminar"   BITMAP WMF5 | BORRDOV(),OBROW:REFRESH() |
| ODLG_INIT4 | CONTABDSI.PRG:2342 | TASKITEM "[F5]Impresion"  BITMAP WMF5 | (ILISTAR(3),OBROW:REFRESH()) |
| TIPODOC | CONTABDSI.PRG:2488 | REDEFINE BUTTON oBtn1 ID 106 OF oDLGD | (WDSIGUE:=.T.,oDLGD:END()) |
| TIPODOC | CONTABDSI.PRG:2489 | REDEFINE BUTTON oBtn2 ID 107 OF oDLGD | (WDSIGUE:=.F.,oDLGD:END()) |
| TRAB_DOC | CONTABDSI.PRG:2636 | REDEFINE BUTTON ID 901 OF oDLGC | GRABADOC(cTIPO),oDLGC:END() |
| TRAB_DOC | CONTABDSI.PRG:2637 | REDEFINE BUTTON ID 902 OF oDLGC | oDLGC:END() |
| TRAB_DOC | CONTABDSI.PRG:2697 | REDEFINE BUTTON ID 901 OF oDLGC | GRABADOC(cTIPO),oDLGC:END() |
| TRAB_DOC | CONTABDSI.PRG:2698 | REDEFINE BUTTON ID 902 OF oDLGC | oDLGC:END() |
| TRAB_DOC | CONTABDSI.PRG:2745 | REDEFINE BUTTON ID 901 OF oDLGC | GRABADOC(cTIPO),oDLGC:END() |
| TRAB_DOC | CONTABDSI.PRG:2746 | REDEFINE BUTTON ID 902 OF oDLGC | oDLGC:END() |
| TRAB_DOC | CONTABDSI.PRG:2790 | REDEFINE BUTTON ID 901 OF oDLGC | GRABADOC(cTIPO),oDLGC:END() |
| TRAB_DOC | CONTABDSI.PRG:2791 | REDEFINE BUTTON ID 902 OF oDLGC | oDLGC:END() |
| NICSALMOV | CONINFOR.PRG:23 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|NICSALMOV1()}),oDLG:END() |
| NICSALMOV | CONINFOR.PRG:24 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| NICAPER | CONINFOR.PRG:148 | REDEFINE BUTTON ID 201 OF oDLGI2 | NICAPER2(),oDLGI2:END() PROMPT "&Procesar" |
| NICAPER | CONINFOR.PRG:149 | REDEFINE BUTTON ID 202 OF oDLGI2 | oDLGI2:END() |
| CONIMP2 | CONINFOR.PRG:337 | REDEFINE BUTTON ID 201 OF oDLGI2 | CONIMP22(),oDLGI2:END() |
| CONIMP2 | CONINFOR.PRG:338 | REDEFINE BUTTON ID 202 OF oDLGI2 | oDLGI2:END() |
| GENINFT | CONINFOR.PRG:560 | DEFINE VMENUITEM OF oMENUV IMAGE "CREAR"   CAPTION "[F2]Crear"       COLOR RGB(85,85,85),RGB(230,230,230) | INFORM11(.T.),OBROW:REFRESH() |
| GENINFT | CONINFOR.PRG:561 | DEFINE VMENUITEM OF oMENUV IMAGE "MODIFI"  CAPTION "[F3]Modificar"   COLOR RGB(85,85,85),RGB(230,230,230) | INFORM11(.F.),OBROW:REFRESH() |
| GENINFT | CONINFOR.PRG:562 | DEFINE VMENUITEM OF oMENUV IMAGE "ELIMINA" CAPTION "[F4]Eliminar"    COLOR RGB(85,85,85),RGB(230,230,230) | BORRINF(),OBROW:REFRESH() |
| INFORM1 | CONINFOR.PRG:596 | DEFINE VMENUITEM OF oMENUV IMAGE "CREAR"   CAPTION "[F2]Crear"       COLOR RGB(85,85,85),RGB(230,230,230) | INFORM11(.T.),OBROW:REFRESH() |
| INFORM1 | CONINFOR.PRG:597 | DEFINE VMENUITEM OF oMENUV IMAGE "MODIFI"  CAPTION "[F3]Modificar"   COLOR RGB(85,85,85),RGB(230,230,230) | INFORM11(.F.),OBROW:REFRESH() |
| INFORM1 | CONINFOR.PRG:598 | DEFINE VMENUITEM OF oMENUV IMAGE "ELIMINA" CAPTION "[F4]Eliminar"    COLOR RGB(85,85,85),RGB(230,230,230) | BORRINF(),OBROW:REFRESH() |
| INFORM11 | CONINFOR.PRG:663 | REDEFINE BUTTON ID 201 OF oDLGI | INFORM1G(cT),oDLGI:END() |
| INFORM11 | CONINFOR.PRG:664 | REDEFINE BUTTON ID 202 OF oDLGI | oDLGI:END() |
| INFORM2 | CONINFOR.PRG:709 | REDEFINE BUTTON ID 201 OF oDLGI2 | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFORM21()}),oDLGI2:END() |
| CONIMP | CONINFOR.PRG:1090 | REDEFINE BUTTON ID 211 OF oDLGI | CON123(1),oDLGI:END() |
| CONIMP | CONINFOR.PRG:1091 | REDEFINE BUTTON ID 212 OF oDLGI | oDLGI:END() |
| INFOR01 | CONINFOR.PRG:1466 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR011()}),oDLG:END() |
| INFOR01 | CONINFOR.PRG:1467 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR02 | CONINFOR.PRG:1698 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR21(cT,"tCONMAE")}),oDLG:END() |
| INFOR02 | CONINFOR.PRG:1699 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR04 | CONINFOR.PRG:3327 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR41()}),oDLG:END() |
| INFOR04 | CONINFOR.PRG:3328 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR03_2 | CONINFOR.PRG:3942 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR31_2()}),oDLG:END() |
| INFOR03_2 | CONINFOR.PRG:3943 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR03 | CONINFOR.PRG:4175 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR31()}),oDLG:END() |
| INFOR03 | CONINFOR.PRG:4176 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR07 | CONINFOR.PRG:5153 | REDEFINE BUTTON ID 201 OF oDLG7 | (INFOR71B(cT,SUBS(WPERIODO,1,2)),oDLG7:END()) |
| INFOR07 | CONINFOR.PRG:5154 | REDEFINE BUTTON ID 202 OF oDLG7 | oDLG7:END() |
| TERIMP | CONINFOR.PRG:5501 | REDEFINE BUTTON ID 201 OF oDLG5 | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR171(cT)}),oDLG5:END() |
| TERIMP | CONINFOR.PRG:5502 | REDEFINE BUTTON ID 202 OF oDLG5 | oDLG5:END() |
| INFOR05 | CONINFOR.PRG:6081 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|INFOR51(cT)}),oDLG:END() PROMPT "Procesar" |
| INFOR05 | CONINFOR.PRG:6082 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR07C | CONINFOR.PRG:6537 | REDEFINE BUTTON ID 201 OF odlg4 | TERIMP(cT) PROMPT "[F5]Imprimir" |
| INFOR07C | CONINFOR.PRG:6538 | REDEFINE BUTTON ID 202 OF odlg4 | odlg4:END() PROMPT "Buscar" |
| INFOR07C | CONINFOR.PRG:6539 | REDEFINE BUTTON ID 203 OF odlg4 | odlg4:END() prompt "Salir" |
| INFOR07T | CONINFOR.PRG:6588 | REDEFINE BUTTON ID 201 OF odlg4 | TERIMP(cT) PROMPT "[F5]Imprimir" |
| INFOR07T | CONINFOR.PRG:6589 | REDEFINE BUTTON ID 202 OF odlg4 | odlg4:END() PROMPT "Buscar" |
| INFOR07T | CONINFOR.PRG:6590 | REDEFINE BUTTON ID 203 OF odlg4 | odlg4:END() prompt "Salir" |
| TERANO | CONINFOR.PRG:6769 | REDEFINE BUTTON ID 201 OF oDLGA | oDlga:END() |
| INFOR15 | CONINFOR.PRG:6894 | REDEFINE BUTTON ID 201 OF odlg4 | FILRET() |
| INFOR15 | CONINFOR.PRG:6895 | REDEFINE BUTTON ID 202 OF odlg4 | INFOR16C() |
| INFOR15 | CONINFOR.PRG:6896 | REDEFINE BUTTON ID 203 OF odlg4 | oDlg4:END() |
| INFOR15 | CONINFOR.PRG:6897 | REDEFINE BUTTON ID 204 OF odlg4 | BUSCTAR() |
| INFOR15 | CONINFOR.PRG:6898 | REDEFINE BUTTON ID 205 OF odlg4 | FILRET8() |
| FILRET | CONINFOR.PRG:6966 | REDEFINE BUTTON ID 201 OF oDLG5 | FILRET2(),oBrowT:REFRESH(),oDLG5:END() |
| FILRET | CONINFOR.PRG:6967 | REDEFINE BUTTON ID 202 OF oDLG5 | oDLG5:END() |
| INFOR16C | CONINFOR.PRG:7254 | REDEFINE BUTTON oBtn1I ID 211 OF oDlgCI | INFOR16I(),oDLGCI:END() |
| INFOR16C | CONINFOR.PRG:7255 | REDEFINE BUTTON oBtn2I ID 212 OF oDlgCI | oDLGCI:END() |
| CARGA_PORTAL | CONINFOR.PRG:8479 | REDEFINE BUTTON ID 211 OF oDLGC | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|(CARGA_PORTAL2(),)}) |
| CARGA_PORTAL | CONINFOR.PRG:8480 | REDEFINE BUTTON ID 212 OF oDLGC | oDLGC:END() |
| CARGA_PORTAL2 | CONINFOR.PRG:8501 | DEFINE VMENUITEM OF oMENUV IMAGE "CREAR"   CAPTION "[F2]Cargar Documentos" COLOR RGB(85,85,85),WPRGB2 | CARGA_PORTAL3(),oBROWT:REFRESH() |
| CARGA_PORTAL2 | CONINFOR.PRG:8503 | DEFINE VMENUITEM OF oMENUV IMAGE "ELIMINA" CAPTION "[F4]Eliminar" COLOR RGB(85,85,85),WPRGB2 | BORRA_PORTAL(),oBROWT:REFRESH() |
| CARGA_PORTAL3 | CONINFOR.PRG:8575 | REDEFINE BUTTON oBtn1  ID 301 OF oDLG3 | (WSS:=1,oDlg3:End()) |
| CARGA_PORTAL3 | CONINFOR.PRG:8576 | REDEFINE BUTTON oBtn2  ID 302 OF oDLG3 | (WSS:=2,oDlg3:End()) |
| INFOR16I_PDF | CONINFOR.PRG:8670 | REDEFINE BUTTON oBtn1  ID 301 OF oDLG3 | (WSS:=1,oDlg3:End()) |
| INFOR16I_PDF | CONINFOR.PRG:8671 | REDEFINE BUTTON oBtn2  ID 302 OF oDLG3 | (WSS:=2,oDlg3:End()) |
| INFOR09C | CONINFOR.PRG:9989 | REDEFINE BUTTON ID 201 OF oDLG5 | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR091(cT)}),oDLG5:END() |
| INFOR09C | CONINFOR.PRG:9990 | REDEFINE BUTTON ID 202 OF oDLG5 | oDLG5:END() |
| INFOR_NIIF | CONINFOR.PRG:10004 | REDEFINE BUTTON ID 201 OF oFLD | oFLD:END() |
| INFOR_NIIF | CONINFOR.PRG:10005 | REDEFINE BUTTON ID 202 OF oFLD | oFLD:END() |
| INFOR07D | CONINFOR.PRG:11346 | REDEFINE BUTTON ID 201 OF oDLG5 | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR174()}),oDLG5:END() |
| INFOR07D | CONINFOR.PRG:11347 | REDEFINE BUTTON ID 202 OF oDLG5 | oDLG5:END() |
| INFOR08 | CONINFOR.PRG:12395 | REDEFINE BUTTON ID 201 OF oDLG5 | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR81(cT)}),oDLG5:END() |
| INFOR08 | CONINFOR.PRG:12396 | REDEFINE BUTTON ID 202 OF oDLG5 | oDLG5:END() |
| INFOR09 | CONINFOR.PRG:12932 | REDEFINE BUTTON ID 201 OF oDLG | INFOR09G(),oDLG:END() |
| INFOR09 | CONINFOR.PRG:12933 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR10 | CONINFOR.PRG:12961 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR101()}),oDLG:END() |
| INFOR10 | CONINFOR.PRG:12962 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR11 | CONINFOR.PRG:13316 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR111()}),oDLG:END() |
| INFOR11 | CONINFOR.PRG:13317 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR12 | CONINFOR.PRG:13574 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR121(cT)}),oDLG:END() |
| INFOR12 | CONINFOR.PRG:13575 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR13 | CONINFOR.PRG:14293 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR131()}),oDLG:END() |
| INFOR13 | CONINFOR.PRG:14294 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR14 | CONINFOR.PRG:14601 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR141()}),oDLG:END() |
| INFOR14 | CONINFOR.PRG:14602 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR14L | CONINFOR.PRG:15625 | REDEFINE BUTTON ID 201 OF oDLG | INFOR14L1(),oDLG:END() |
| INFOR14L | CONINFOR.PRG:15626 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFO015 | CONINFOR.PRG:15865 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFO151(cT)}),oDLG:END() |
| INFO015 | CONINFOR.PRG:15866 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR0K2 | CONINFOR.PRG:16642 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR0K21()}),oDLG:END() |
| INFOR0K2 | CONINFOR.PRG:16643 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR0K | CONINFOR.PRG:17483 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR0K1()}),oDLG:END() |
| INFOR0K | CONINFOR.PRG:17484 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR09D | CONINFOR.PRG:18156 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR0D1()}),oDLG:END() |
| INFOR09D | CONINFOR.PRG:18157 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFOR0L | CONINFOR.PRG:18570 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR21(cT,"CC"+WCCOSTO)}),oDLG:END() |
| INFOR0L | CONINFOR.PRG:18571 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| RETECTA | CONINFOR.PRG:18600 | REDEFINE BUTTON ID 201 OF oDLG5 | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|RETCTA2(cT)}),oDLG5:END() |
| RETECTA | CONINFOR.PRG:18601 | REDEFINE BUTTON ID 202 OF oDLG5 | oDLG5:END() |
| INFOR152 | CONINFOR.PRG:18872 | REDEFINE BUTTON ID 201 OF oDLG5 | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR153(cT)}),oDLG5:END() |
| INFOR152 | CONINFOR.PRG:18873 | REDEFINE BUTTON ID 202 OF oDLG5 | oDLG5:END() |
| ANEXIMP | CONINFOR.PRG:19567 | REDEFINE BUTTON ID 201 OF oDLG5 | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|ANEXIMP2(cT)}),oDLG5:END() |
| ANEXIMP | CONINFOR.PRG:19568 | REDEFINE BUTTON ID 202 OF oDLG5 | oDLG5:END() |
| INFORO1N | CONINFOR.PRG:19971 | REDEFINE BUTTON ID 201 OF oDLG | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFORO1N1()}),oDLG:END() |
| INFORO1N | CONINFOR.PRG:19972 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| INFORO1N1 | CONINFOR.PRG:20037 | DEFINE VMENUITEM OF oMENUV IMAGE "CREAR"   CAPTION "[Enter]Modificar"   COLOR RGB(85,85,85),RGB(230,230,230) | INFORO13(),OBROW:REFRESH() |
| INFORO1N1 | CONINFOR.PRG:20038 | DEFINE VMENUITEM OF oMENUV IMAGE "MODIFI"  CAPTION "[I]Imprimir"        COLOR RGB(85,85,85),RGB(230,230,230) | INFORO14(),OBROW:GOTOP(),OBROW:REFRESH() |
| INFORO1N1 | CONINFOR.PRG:20039 | DEFINE VMENUITEM OF oMENUV IMAGE "ELIMINA" CAPTION "[B]Buscar Doc"      COLOR RGB(85,85,85),RGB(230,230,230) | INFOROBU(),OBROW:REFRESH() |
| INFORO1N1 | CONINFOR.PRG:20040 | DEFINE VMENUITEM OF oMENUV IMAGE "ELIMINA" CAPTION "[Esc]Salir"         COLOR RGB(85,85,85),RGB(230,230,230) | oWNDHIJA:END() |
| INFORO13 | CONINFOR.PRG:20093 | REDEFINE BUTTON oBtn1 ID 201 OF oDlgCG | (INFOO13G(),odlGCG:END()) |
| INFORO13 | CONINFOR.PRG:20094 | REDEFINE BUTTON oBtn2 ID 202 OF oDlgCG | oDlgCG:end() |
| INFORQ1 | CONINFOR.PRG:20381 | REDEFINE BUTTON ID 901 OF oDLGC | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFORQ1_G()}),oDLGC:END() PROMPT "&Generar" |
| INFORQ1 | CONINFOR.PRG:20382 | REDEFINE BUTTON ID 902 OF oDLGC | oDLGC:END() |
| INFORP1 | CONINFOR.PRG:20611 | REDEFINE BUTTON ID 201 OF oDLGC | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFORP12()}),oDLGC:END() |
| INFORP1 | CONINFOR.PRG:20612 | REDEFINE BUTTON ID 202 OF oDLGC | oDLGC:END() |
| INFACTI | CONINFOR.PRG:20894 | REDEFINE BUTTON ID 901 OF oDLGI | INFACT2(cT),oDLGI:END() |
| INFACTI | CONINFOR.PRG:20895 | REDEFINE BUTTON ID 902 OF oDLGI | oDLGI:END() |
| INFOR09CX | CONINFOR.PRG:21209 | REDEFINE BUTTON ID 201 OF oDLG5 | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR091X(cT)}),oDLG5:END() |
| INFOR09CX | CONINFOR.PRG:21210 | REDEFINE BUTTON ID 202 OF oDLG5 | oDLG5:END() |
| INFOR09CX | CONINFOR.PRG:21211 | REDEFINE BUTTON ID 203 OF oDLG5 | MARCACE(1) |
| INFOR09CX | CONINFOR.PRG:21212 | REDEFINE BUTTON ID 204 OF oDLG5 | MARCACE(2) |
| INFOR09CX | CONINFOR.PRG:21213 | REDEFINE BUTTON ID 205 OF oDLG5 | CTABUSX("xCONMAE") |
| INFOR09CX | CONINFOR.PRG:21214 | REDEFINE BUTTON ID 206 OF oDLG5 | LIMPIAR(2),oBrobus:REFRESH() |
| INFOR09CX | CONINFOR.PRG:21215 | REDEFINE BUTTON ID 207 OF oDLG5 | MARCACE(3) |
| INFOR9L | CONINFOR.PRG:22087 | REDEFINE BUTTON ID 201 OF oWNDFIS | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|INFOR21J(1,"TALIMCOS")}),oWNDFIS:END() |
| INFOR9L | CONINFOR.PRG:22088 | REDEFINE BUTTON ID 202 OF oWNDFIS | INFOR9L3(cT) |
| INFOR9L | CONINFOR.PRG:22089 | REDEFINE BUTTON ID 203 OF oWNDFIS | INFOR9LX() PROMPT "Marcar Todos" |
| INFOR9L3 | CONINFOR.PRG:23004 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | INFOR9L4(cT),oDlg:End() PROMPT "&Procesar" |
| INFOR9L3 | CONINFOR.PRG:23005 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| PLANORETEN | CONINFOR.PRG:23915 | REDEFINE BUTTON ID 201 OF oDLG5 | MSGRUN("Un momento por favor...","Preparando Informe",{\|\|PLANORET2(cT)}),oDLG5:END() |
| PLANORETEN | CONINFOR.PRG:23916 | REDEFINE BUTTON ID 202 OF oDLG5 | oDLG5:END() |
| PRESU1 | CONPRESU.PRG:83 | REDEFINE BUTTON oBtn1 ID 201 OF oDlga | (GRABAPRESU(cTIPO),oDlga:END()) |
| PRESU1 | CONPRESU.PRG:84 | REDEFINE BUTTON oBtn2 ID 202 OF oDlga | oDlga:END() |
| CCTANIVEL | CONSULTA.PRG:32 | REDEFINE BUTTON ID 201 OF oDLGA | CCTANIVEL2(WM,WCTA),oDLGA:END() |
| CCTANIVEL | CONSULTA.PRG:33 | REDEFINE BUTTON ID 202 OF oDLGA | oDLGA:END() |
| CONSUL1M | CONSULTA.PRG:79 | REDEFINE BUTTON ID 208 OF oDLGM | (WS:=.T.,oDLGM:END()) |
| CONSUL1M | CONSULTA.PRG:80 | REDEFINE BUTTON ID 209 OF oDLGM | (WS:=.F.,oDLGM:END()) |
| CONSUL_1 | CONSULTA.PRG:173 | REDEFINE BUTTON ID 201 OF oWNDHIJA | BUSMES() |
| CONSUL_1 | CONSULTA.PRG:174 | REDEFINE BUTTON ID 202 OF oWNDHIJA | oWNDHIJA:END() |
| CONSUL_2A | CONSULTA.PRG:412 | REDEFINE BUTTON ID 204 OF owndhija | VERMOV8((cCONMAE)-&gt;CODIGO,WMES) |
| CONSULCO | CONSULTA.PRG:464 | REDEFINE BUTTON ID 201 OF oWNDHIJA | oWNDHIJA:END(),MSGRUN("Un momento por favor...","Procesando tarea",{\|\|CONSULCO1()}) |
| CONSULCO | CONSULTA.PRG:465 | REDEFINE BUTTON ID 202 OF oWNDHIJA | oWNDHIJA:END() |
| CONSULCO1 | CONSULTA.PRG:534 | REDEFINE BUTTON ID 204 OF oDLGI2 | VERMOV8((cCONMAE)-&gt;CODIGO,WMES),(oBroBUS:REFRESH(),oBroBUS:SETFOCUS()) PROMPT "Detalle "+WCON1 |
| CONSULCO1 | CONSULTA.PRG:535 | REDEFINE BUTTON ID 203 OF oDLGI2 | VERMOV9((cALIMAE2)-&gt;CODIGO,WMES),(oBroBUS:REFRESH(),oBroBUS:SETFOCUS()) PROMPT "Detalle "+WCON2 |
| CONSULCO1 | CONSULTA.PRG:536 | REDEFINE BUTTON ID 205 OF oDLGI2 | MSGRUN("Un momento por favor...","Generando Informe",{\|\|MENIMP(1)}) |
| CONSULCO1 | CONSULTA.PRG:568 | REDEFINE BUTTON ID 204 OF oDLGI2 | VERMOV8((cCONMAE)-&gt;CODIGO,WMES),(oBroBUS:REFRESH(),oBroBUS:SETFOCUS()) PROMPT "Detalle "+WCON1 |
| CONSULCO1 | CONSULTA.PRG:569 | REDEFINE BUTTON ID 203 OF oDLGI2 | VERMOV9((cALIMAE2)-&gt;CODIGO,WMES),(oBroBUS:REFRESH(),oBroBUS:SETFOCUS()) PROMPT "Detalle "+WCON2 |
| CONSULCO1 | CONSULTA.PRG:570 | REDEFINE BUTTON ID 205 OF oDLGI2 | MSGRUN("Un momento por favor...","Generando Informe",{\|\|MENIMP(2)}) |
| CONSULCO2 | CONSULTA.PRG:610 | REDEFINE BUTTON ID 201 OF oWNDHIJA | oWNDHIJA:END(),CONSULCO2A() |
| CONSULCO2 | CONSULTA.PRG:611 | REDEFINE BUTTON ID 202 OF oWNDHIJA | oWNDHIJA:END() |
| CONSULCO2A | CONSULTA.PRG:714 | REDEFINE BUTTON ID 205 OF oDLGI2 | MSGRUN("Un momento por favor...","Generando Informe",{\|\|MENIMP(3)}) |
| CONSULCO2A | CONSULTA.PRG:751 | REDEFINE BUTTON ID 205 OF oDLGI2 | MSGRUN("Un momento por favor...","Generando Informe",{\|\|MENIMP(4)}) |
| CONSULME | CONSULTA.PRG:817 | REDEFINE BUTTON ID 201 OF oWNDHIJA | oWNDHIJA:END(),CONSULME1() |
| CONSULME | CONSULTA.PRG:818 | REDEFINE BUTTON ID 202 OF oWNDHIJA | oWNDHIJA:END() |
| CONSULME1 | CONSULTA.PRG:865 | REDEFINE BUTTON ID 204 OF oDLGI2 | VERMOV8((cCONMAE)-&gt;CODIGO,WMES),(oBroBUS:REFRESH(),oBroBUS:SETFOCUS()) PROMPT "Detalle mes "+WMES |
| CONSULME1 | CONSULTA.PRG:866 | REDEFINE BUTTON ID 203 OF oDLGI2 | VERMOV8((cCONMAE)-&gt;CODIGO,WMES1),(oBroBUS:REFRESH(),oBroBUS:SETFOCUS()) PROMPT "Detalle mes "+WMES1 |
| CONSULME1 | CONSULTA.PRG:867 | REDEFINE BUTTON ID 205 OF oDLGI2 | MSGRUN("Un momento por favor...","Generando Informe",{\|\|MENIMP(5)}) |
| CONSULME1 | CONSULTA.PRG:900 | REDEFINE BUTTON ID 204 OF oDLGI2 | VERMOV8((cCONMAE)-&gt;CODIGO,WMES),(oBroBUS:REFRESH(),oBroBUS:SETFOCUS()) PROMPT "Detalle mes "+WMES |
| CONSULME1 | CONSULTA.PRG:901 | REDEFINE BUTTON ID 203 OF oDLGI2 | VERMOV8((cCONMAE)-&gt;CODIGO,WMES1),(oBroBUS:REFRESH(),oBroBUS:SETFOCUS()) PROMPT "Detalle mes "+WMES1 |
| CONSULME1 | CONSULTA.PRG:902 | REDEFINE BUTTON ID 205 OF oDLGI2 | MSGRUN("Un momento por favor...","Generando Informe",{\|\|MENIMP(6)}) |
| CONSUL_2 | CONSULTA.PRG:974 | REDEFINE BUTTON ID 204 OF owndhija | VERMOV8((cCONMAE)-&gt;CODIGO,WMES) |
| VERMOV8 | CONSULTA.PRG:1067 | REDEFINE BUTTON ID 201 OF oWNDHIJA2 | BUSMES() |
| VERMOV8 | CONSULTA.PRG:1068 | REDEFINE BUTTON ID 202 OF oWNDHIJA2 | oWNDHIJA2:END() |
| VERMOV8 | CONSULTA.PRG:1069 | REDEFINE BUTTON ID 203 OF owndhija2 | VERMOV82(WMES,(tALIAS)-&gt;TIPODOC,(tALIAS)-&gt;TDOCUM,(tALIAS)-&gt;NIT) |
| VERMOV9 | CONSULTA.PRG:1196 | REDEFINE BUTTON ID 201 OF oWNDHIJA2 | BUSMES() |
| VERMOV9 | CONSULTA.PRG:1197 | REDEFINE BUTTON ID 202 OF oWNDHIJA2 | oWNDHIJA2:END() |
| VERMOV9 | CONSULTA.PRG:1198 | REDEFINE BUTTON ID 203 OF owndhija2 | VERMOV92(WMES,(tALIAS)-&gt;TIPODOC,(tALIAS)-&gt;TDOCUM,(tALIAS)-&gt;NIT) |
| CONSUL_21 | CONSULTA.PRG:1765 | REDEFINE BUTTON ID 201 OF oDLGA | oDlga:END() |
| CONSULC1 | CONSULTA.PRG:1786 | REDEFINE BUTTON oBtn1 ID 901 OF oWNDHIJA | oWNDHIJA:END(),MSGRUN("Un momento por favor...","Procesando tarea",{\|\|CONSCON()}) |
| CONSULC1 | CONSULTA.PRG:1787 | REDEFINE BUTTON oBtn2 ID 902 OF oWNDHIJA | oWNDHIJA:END() |
| CONSCON | CONSULTA.PRG:1835 | REDEFINE BUTTON oBtn1 ID 901 OF oDlgX | VERITCON() |
| CONSCON | CONSULTA.PRG:1836 | REDEFINE BUTTON oBtn2 ID 902 OF oDlgX | VERDETAL((cCONDOCUM)-&gt;DMODULO,(cCONDOCUM)-&gt;DDOCUM) |
| CONSCON | CONSULTA.PRG:1837 | REDEFINE BUTTON oBtn1 ID 903 OF oDlgX | BUSDOCUM() |
| CONSUL_3 | CONSULTA.PRG:2118 | REDEFINE BUTTON oBtn1 ID 201 OF oDlgM | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|CONSUL_31()}),oDLGM:END() |
| CONSUL_3 | CONSULTA.PRG:2119 | REDEFINE BUTTON oBtn2 ID 202 OF oDlgM | oDLGM:END() |
| CONSUL_4 | CONSULTA.PRG:2397 | REDEFINE BUTTON oBtn1 ID 201 OF oDlgM | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|CONSUL_41()}),oDLGM:END() |
| CONSUL_4 | CONSULTA.PRG:2398 | REDEFINE BUTTON oBtn2 ID 202 OF oDlgM | oDLGM:END() |
| CONSUL_5 | CONSULTA.PRG:2613 | REDEFINE BUTTON oBtn1 ID 201 OF oDlgM | CONSUL_51(), oDLGM:END() |
| CONSUL_5 | CONSULTA.PRG:2614 | REDEFINE BUTTON oBtn2 ID 202 OF oDlgM | oDLGM:END() |
| CONSUL_8 | CONSULTA.PRG:2851 | REDEFINE BUTTON oBtn1 ID 201 OF oDlgM | CONSUL_81() |
| CONSUL_8 | CONSULTA.PRG:2852 | REDEFINE BUTTON oBtn2 ID 202 OF oDlgM | oDLGM:END() |
| TIPINFOR2 | CONSULTA.PRG:3003 | REDEFINE BUTTON ID 201 OF oWNDDETA | WSI:=.T.,oWNDDETA:END() |
| TIPINFOR2 | CONSULTA.PRG:3004 | REDEFINE BUTTON ID 202 OF oWNDDETA | WSI:=.F.,oWNDDETA:END() |
| PLANTICO | DSITAB.PRG:65 | REDEFINE BUTTON ID 901 OF oDLGC | GRABAPLA(),oDLGC:END() |
| PLANTICO | DSITAB.PRG:66 | REDEFINE BUTTON ID 902 OF oDLGC | oDLGC:END() |
| INTERACT | DSITAB.PRG:228 | REDEFINE BUTTON oBtn1 ID 201 OF oWNDFIS | INTEACT2(cT),oWNDFIS:END() |
| INTERACT | DSITAB.PRG:229 | REDEFINE BUTTON oBtn2 ID 202 OF oWNDFIS | oWNDFIS:end() |
| ACTI201 | DSITAB.PRG:610 | REDEFINE BUTTON oBtn1 ID 201 OF oDlga | ACTIGRA(cTIPO,cT),oDLGA:END() |
| ACTI201 | DSITAB.PRG:611 | REDEFINE BUTTON oBtn2 ID 202 OF oDlga | oDlga:end() |
| ACTI101 | DSITAB.PRG:1049 | REDEFINE BUTTON oBtn1 ID 201 OF oDlga | AFIGRABA(cTIPO),oDLGA:END() |
| ACTI101 | DSITAB.PRG:1050 | REDEFINE BUTTON oBtn2 ID 202 OF oDlga | oDlga:end() |
| ODLG_INIT1 | DSITAB.PRG:1152 | TASKITEM "[F2]Crear"      BITMAP WMF3 | CCOSTO1(.T.,cT),OBROW:REFRESH() |
| ODLG_INIT1 | DSITAB.PRG:1153 | TASKITEM "[F3]Modificar"  BITMAP WMF4 | CCOSTO1(.F.,cT),OBROW:REFRESH() |
| ODLG_INIT1 | DSITAB.PRG:1154 | TASKITEM "[F4]Eliminar"   BITMAP WMF5 | BORRAR("cCONCECOS","Centros de Costos","T",(cCONCECOS)-&gt;CODIGO),OBROW:REFRESH() |
| ODLG_INIT2 | DSITAB.PRG:1165 | TASKITEM "[F2]Crear"      BITMAP WMF3 | CCOSTO1(.T.,cT),OBROW:REFRESH() |
| ODLG_INIT2 | DSITAB.PRG:1166 | TASKITEM "[F4]Eliminar"   BITMAP WMF5 | BORRAR("cCONSOLID","Compañias Consolidacion","T",(cCONSOLID)-&gt;CODIGO),OBROW:REFRESH() |
| CCOSTO1 | DSITAB.PRG:1253 | REDEFINE BUTTON oBtn1 ID 109 OF oDlga | DSIGRABA1("cCONCECOS",CCOD+CCODIGO,CNOMBRE,cTIPO,cC),oDLGA:END() |
| CCOSTO1 | DSITAB.PRG:1254 | REDEFINE BUTTON oBtn2 ID 110 OF oDlga | oDlga:end(),oBrow:GoBottom(),oBrow:GoTop(),oBROW:Refresh() |
| CCOSTO1 | DSITAB.PRG:1272 | REDEFINE BUTTON oBtn1 ID 109 OF oDlga | DSIGRABA1("cCONSOLID",CCODIGO,CNOMBRE,cTIPO,cC),oDLGA:END() |
| CCOSTO1 | DSITAB.PRG:1273 | REDEFINE BUTTON oBtn2 ID 110 OF oDlga | oDlga:end(),oBrow:GoBottom(),oBrow:GoTop(),oBROW:Refresh() |
| PARAMS | DSITAB.PRG:1406 | REDEFINE BTNBMP                    ID 113 OF oDLGA RESOURCE "BITMAP_2" | DIROK(2,1) |
| PARAMS | DSITAB.PRG:1433 | REDEFINE BUTTON oBtn1 ID 109 OF oDlga | DSIGRABA6(),odlga:END() |
| PARAMS | DSITAB.PRG:1434 | REDEFINE BUTTON oBtn2 ID 110 OF oDlga | oDlga:end() |
| PARAMS_NOMI | DSITAB.PRG:1465 | REDEFINE BUTTON oBtn1 ID 201 OF oDlga | DSIGRABA6_NOM(),odlga:END() |
| PARAMS_NOMI | DSITAB.PRG:1466 | REDEFINE BUTTON oBtn2 ID 202 OF oDlga | oDlga:end() |
| ODLG_INIT | DSITAB.PRG:1612 | TASKITEM "[F2]Crear"      BITMAP WMF3 TOOLTIP "Analisis Semanal" | CCOMPRO1(.T.),OBROW:REFRESH() |
| ODLG_INIT | DSITAB.PRG:1613 | TASKITEM "[F3]Modificar"  BITMAP WMF4 TOOLTIP "Analisis Mensual" | CCOMPRO1(.F.),OBROW:REFRESH() |
| ODLG_INIT | DSITAB.PRG:1614 | TASKITEM "[F4]Eliminar"   BITMAP WMF5 TOOLTIP "Analisis Grafico" | BORRAR("cCONTICOM","Comprobantes Contables","T",(cCONTICOM)-&gt;CODIGO),OBROW:REFRESH() |
| ODLG_INIT | DSITAB.PRG:1615 | TASKITEM "[F5]Impresion"  BITMAP WMF5 TOOLTIP "Analisis Grafico" | CCOSTO1(.T.),OBROW:REFRESH() |
| CCOMPRO1 | DSITAB.PRG:1639 | REDEFINE BUTTON oBtn1 ID 109 OF oDlga | DSIGRABA1("cCONTICOM",CCODIGO,CNOMBRE,cTIPO),oDLGA:END() |
| CCOMPRO1 | DSITAB.PRG:1640 | REDEFINE BUTTON oBtn2 ID 110 OF oDlga | oDlga:end(),oBrow:GoBottom(),oBrow:GoTop(),oBROW:Refresh() |
| ODLG_INIT3 | DSITAB.PRG:1671 | TASKITEM "[F2]Crear"      BITMAP WMF3 | RENGLON1(.T.),OBROW:REFRESH() |
| ODLG_INIT3 | DSITAB.PRG:1672 | TASKITEM "[F3]Modificar"  BITMAP WMF4 | RENGLON1(.F.),OBROW:REFRESH() |
| ODLG_INIT3 | DSITAB.PRG:1673 | TASKITEM "[F4]Eliminar"   BITMAP WMF5 | BORRAR("cCONDECLA","Renglones Declaracion Renta","T",(cCONDECLA)-&gt;CODIGO),OBROW:REFRESH() |
| RENGLON1 | DSITAB.PRG:1708 | REDEFINE BUTTON oBtn1 ID 109 OF oDlga | DSIGRABA4(CTIPO),odlga:END(),OBROW:REFRESH() |
| RENGLON1 | DSITAB.PRG:1709 | REDEFINE BUTTON oBtn2 ID 110 OF oDlga | oDlga:end(),oBROW:Refresh() |
| ODLG_INIT5 | DSITAB.PRG:1780 | TASKITEM "[F2]Crear"      BITMAP WMF3 | RETES1(.T.),OBROW:REFRESH() |
| ODLG_INIT5 | DSITAB.PRG:1781 | TASKITEM "[F3]Modificar"  BITMAP WMF4 | RETES1(.F.),OBROW:REFRESH() |
| ODLG_INIT5 | DSITAB.PRG:1782 | TASKITEM "[F4]Eliminar"   BITMAP WMF5 | borrar("cCONTIRET","Impuestos Retenciones","T",(cCONTIRET)-&gt;CODIGO),OBROW:REFRESH() |
| RETES1 | DSITAB.PRG:1813 | REDEFINE BUTTON oBtn1 ID 109 OF oDlga | DSIGRABA5("cCONTIRET",CTIPO),odlga:END(),OBROW:REFRESH() |
| RETES1 | DSITAB.PRG:1814 | REDEFINE BUTTON oBtn2 ID 110 OF oDlga | oDlga:end(),oBROW:Refresh() |
| ODLG_INIT6 | DSITAB.PRG:1864 | TASKITEM "[F2]Crear"      BITMAP WMF3 | IVA1(.T.),OBROW:REFRESH() |
| ODLG_INIT6 | DSITAB.PRG:1865 | TASKITEM "[F3]Modificar"  BITMAP WMF4 | IVA1(.F.),OBROW:REFRESH() |
| ODLG_INIT6 | DSITAB.PRG:1866 | TASKITEM "[F4]Eliminar"   BITMAP WMF5 | BORRAR("cCONTIIVA","Impuestos IVA","T",(cCONTIIVA)-&gt;CODIGO),OBROW:REFRESH() |
| IVA1 | DSITAB.PRG:1895 | REDEFINE BUTTON oBtn1 ID 109 OF oDlga | DSIGRABA5("cCONTIIVA",CTIPO),odlga:END(),OBROW:REFRESH() |
| IVA1 | DSITAB.PRG:1896 | REDEFINE BUTTON oBtn2 ID 110 OF oDlga | oDlga:end(),oBROW:Refresh() |
| ODLG_INIT7 | DSITAB.PRG:1938 | TASKITEM "[F2]Crear"      BITMAP WMF3 | CIAS1(.T.),OBROW:REFRESH() |
| ODLG_INIT7 | DSITAB.PRG:1939 | TASKITEM "[F3]Modificar"  BITMAP WMF4 | CIAS1(.F.),OBROW:REFRESH() |
| ODLG_INIT7 | DSITAB.PRG:1940 | TASKITEM "[F4]Eliminar"   BITMAP WMF5 | borracon(),OBROW:REFRESH() |
| CIAS1 | DSITAB.PRG:2007 | REDEFINE BUTTON oBtn1 ID 109 OF oDlga | MSGRUN("Un momento por favor...","Realizando Proceso",{\|\|DSIGRABA7(CTIPO)}),odlga:END() |
| CIAS1 | DSITAB.PRG:2008 | REDEFINE BUTTON oBtn2 ID 110 OF oDlga | oDlga:end() |
| USUARIOS | DSITAB.PRG:2714 | REDEFINE BUTTON ID 201 OF oWndhija | USUA1(.T.) |
| USUARIOS | DSITAB.PRG:2715 | REDEFINE BUTTON ID 202 OF oWndhija | USUA1(.F.) |
| USUARIOS | DSITAB.PRG:2716 | REDEFINE BUTTON ID 203 OF oWndhija | BORRAR("cCONOPER","Usuarios Contabilidad","T",(cCONOPER)-&gt;iinicial) |
| USUA1 | DSITAB.PRG:2756 | REDEFINE BUTTON oBtn1 ID 109 OF oDlga | DSIGRABA8(CTIPO),odlga:END(),OBROW:REFRESH() |
| USUA1 | DSITAB.PRG:2757 | REDEFINE BUTTON oBtn2 ID 110 OF oDlga | oDlga:end(),oBROW:Refresh() |
| ODLG_INIT8 | DSITAB.PRG:2823 | TASKITEM "[F2]Crear"      BITMAP WMF3 | (MEDMAG11(.T.),OBROW:REFRESH()) |
| ODLG_INIT8 | DSITAB.PRG:2824 | TASKITEM "[F3]Modificar"  BITMAP WMF4 | (MEDMAG11(.F.),OBROW:REFRESH()) |
| ODLG_INIT8 | DSITAB.PRG:2825 | TASKITEM "[F4]Eliminar"   BITMAP WMF5 | BORRAMG() |
| MEDMAG11 | DSITAB.PRG:2904 | REDEFINE BUTTON ID 201 OF oDLG | GRAFORMA(cTIPO),oDLG:END() |
| MEDMAG11 | DSITAB.PRG:2905 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| MEDMAG21 | DSITAB.PRG:3168 | REDEFINE BUTTON ID 201 OF oDLG | GRACONCEP(cTIPO),oDLG:END() |
| MEDMAG21 | DSITAB.PRG:3169 | REDEFINE BUTTON ID 202 OF oDLG | oDLG:END() |
| MEDMAG03 | DSITAB.PRG:3282 | REDEFINE BUTTON ID 201 OF oWNDHIJA | MEDMAG31A((tALIMAE)-&gt;CODIGO,1) |
| MEDMAG03 | DSITAB.PRG:3283 | REDEFINE BUTTON ID 202 OF oWNDHIJA | MEDMAG31A((tALIMAE)-&gt;CODIGO,2) |
| MEDMAG03 | DSITAB.PRG:3284 | REDEFINE BUTTON ID 203 OF oWNDHIJA | MEDMAG31X() |
| MEDMAG03 | DSITAB.PRG:3286 | REDEFINE BUTTON ID 205 OF oWNDHIJA | MEDMAG31COP() |
| MEDMAG03 | DSITAB.PRG:3287 | REDEFINE BUTTON ID 206 OF oWNDHIJA | MEDMAG31PEG() |
| MEDMAG31A | DSITAB.PRG:3458 | REDEFINE BUTTON ID 201 OF oDLG2 | (MEDMAG31AG(cC,cT),oDLG2:END()) |
| MEDMAG31A | DSITAB.PRG:3459 | REDEFINE BUTTON ID 202 OF oDLG2 | oDLG2:END() |
| MEDMAG04 | DSITAB.PRG:3587 | REDEFINE BUTTON oBtn1 ID 201 OF oWNDHIJA | MEDMAG04G(),oWNDHIJA :END() PROMPT "&Generar" |
| MEDMAG04 | DSITAB.PRG:3588 | REDEFINE BUTTON oBtn2 ID 202 OF oWNDHIJA | oWNDHIJA :END() |
| MEDMAG05 | DSITAB.PRG:4281 | REDEFINE BUTTON ID 201 OF oWNDHIJA | CREAMAG(.T.) |
| MEDMAG05 | DSITAB.PRG:4282 | REDEFINE BUTTON ID 202 OF oWNDHIJA | CREAMAG(.F.) |
| MEDMAG05 | DSITAB.PRG:4283 | REDEFINE BUTTON ID 203 OF oWNDHIJA | BORRAMAG() |
| MEDMAG05 | DSITAB.PRG:4284 | REDEFINE BUTTON ID 205 OF oWNDHIJA | GENEMAG() |
| MEDMAG05 | DSITAB.PRG:4285 | REDEFINE BUTTON ID 206 OF oWNDHIJA | DETAMAG(cCODF,(cCONMAGDT)-&gt;CONCEPTO,(cCONMAGDT)-&gt;TERCERO) |
| MEDMAG05 | DSITAB.PRG:4286 | REDEFINE BUTTON ID 207 OF oWNDHIJA | GENEMAG2() |
| MEDMAG05 | DSITAB.PRG:4287 | REDEFINE BUTTON ID 208 OF oWNDHIJA | (GENERAID(cCODF),oWNDHIJA:END()) |
| MEDMAG08 | DSITAB.PRG:4396 | REDEFINE BUTTON ID 205 OF oWNDHIJA | oWNDHIJA:END() |
| DETAMAG | DSITAB.PRG:4564 | REDEFINE BUTTON ID 201 OF oWNDIT | IMPREDET() |
| DETAMAG | DSITAB.PRG:4565 | REDEFINE BUTTON ID 203 OF oWNDIT | oWNDIT:END() |
| IMPREDET | DSITAB.PRG:4604 | REDEFINE BUTTON ID 201 OF oDLGIALX | IMPREDET1(),oDLGIALX:END() |
| IMPREDET | DSITAB.PRG:4605 | REDEFINE BUTTON ID 202 OF oDLGIALX | oDLGIALX:END() |
| DEPUMAG | DSITAB.PRG:4836 | REDEFINE BUTTON oBtn1 ID 201 OF oDlg6 | DEPUMAG2(WTIPO),oDLG6:END() |
| DEPUMAG | DSITAB.PRG:4837 | REDEFINE BUTTON oBtn2 ID 202 OF oDlg6 | oDLG6:END() |
| CREAMAG | DSITAB.PRG:4969 | REDEFINE BUTTON oBtn1 ID 201 OF oDlg6 | CREAMAG2(cTIPO),oDLG6:END() |
| CREAMAG | DSITAB.PRG:4970 | REDEFINE BUTTON oBtn2 ID 202 OF oDlg6 | oDLG6:END() |
| GENEMAGXLS | DSITAB.PRG:5099 | REDEFINE BUTTON ID 201 OF oWndFIS | MSGRUN("Un momento por favor...","Generando Informe",{\|\|GENEMAGXLS2(WTER)}),oWNDFIS:END() |
| GENEMAGXLS | DSITAB.PRG:5100 | REDEFINE BUTTON ID 202 OF oWndFIS | oWNDFIS:END() |
| IMPREG | DSITAB.PRG:5613 | REDEFINE BUTTON ID 201 OF oDLGIALX | oDLGIALX:END() |
| IMPREG | DSITAB.PRG:5614 | REDEFINE BUTTON ID 202 OF oDLGIALX | oDLGIALX:END() WHEN .F. |
| AJUS02 | DSITAB.PRG:5916 | REDEFINE BUTTON ID 201 OF oDLGC2 | AJUS02G(),oDLGC2:END() |
| AJUS02 | DSITAB.PRG:5917 | REDEFINE BUTTON ID 202 OF oDLGC2 | oDLGC2:END() |
| INFORCIA | DSITAB.PRG:6052 | REDEFINE BUTTON oBtn1 ID 201 OF oDlga | MSGRUN("Un momento por favor...","Realizando Proceso",{\|\|INFORCI2()}),odlga:END() |
| INFORCIA | DSITAB.PRG:6053 | REDEFINE BUTTON oBtn2 ID 202 OF oDlga | oDlga:end() |
| INFORT1 | DSITAB.PRG:7138 | REDEFINE BUTTON ID 201 OF oDLGIA | INFORT1A(),oDLGIA:END()    |
| INFORT1 | DSITAB.PRG:7139 | REDEFINE BUTTON ID 202 OF oDLGIA | oDLGIA:END()               |
| INFORT1 | DSITAB.PRG:7140 | REDEFINE BUTTON ID 203 OF oDLGIA | AURES2()                   |
| INFORT1 | DSITAB.PRG:7141 | REDEFINE BUTTON ID 204 OF oDLGIA | AURES3()                   |
| AURES2 | DSITAB.PRG:7557 | REDEFINE BUTTON ID 208 OF oDLGI2 | AURES21(),oDLGI2:END() |
| AURES2 | DSITAB.PRG:7558 | REDEFINE BUTTON ID 209 OF oDLGI2 | oDLGI2:END() |
| MEDMAG06 | DSITAB.PRG:7607 | REDEFINE BUTTON ID 201 OF oWNDHIJA | IMPREDETN() |
| MEDMAG06 | DSITAB.PRG:7608 | REDEFINE BUTTON ID 202 OF oWNDHIJA | oWNDHIJA:END() |
| IMPREDETN | DSITAB.PRG:7690 | REDEFINE BUTTON ID 201 OF oDLGIMPN | IMPREDET1N(),oDLGIMPN:END() |
| IMPREDETN | DSITAB.PRG:7691 | REDEFINE BUTTON ID 202 OF oDLGIMPN | oDLGIMPN:END() |
| MEDMAG07 | DSITAB.PRG:8068 | REDEFINE BUTTON ID 201 OF oWNDHIJA | IMPREDET7() |
| MEDMAG07 | DSITAB.PRG:8069 | REDEFINE BUTTON ID 202 OF oWNDHIJA | oWNDHIJA:END() |
| MEDMAG07 | DSITAB.PRG:8070 | REDEFINE BUTTON ID 203 OF oWNDHIJA | MEDBUS("cCONMAGDT") |
| IMPREDET7 | DSITAB.PRG:8110 | REDEFINE BUTTON ID 201 OF oDLGIALX | IMPREDET71(),oDLGIALX:END()    |
| IMPREDET7 | DSITAB.PRG:8111 | REDEFINE BUTTON ID 202 OF oDLGIALX | oDLGIALX:END()               |
| DEPUMAGT | DSITAB.PRG:8351 | REDEFINE BUTTON oBtn1 ID 201 OF oDlg6 | DEPUMAGT2(),oDLG6:END() |
| DEPUMAGT | DSITAB.PRG:8352 | REDEFINE BUTTON oBtn2 ID 202 OF oDlg6 | oDLG6:END() |
| MEDMAG09 | DSITAB.PRG:8462 | REDEFINE BUTTON ID 201 OF oWNDHIJA | IMPREDEDI() |
| MEDMAG09 | DSITAB.PRG:8463 | REDEFINE BUTTON ID 202 OF oWNDHIJA | oWNDHIJA:END() |
| CONCARG10 | MOVICON.prg:26 | REDEFINE BUTTON oBtn1  ID 301 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|CONCARG92(cT)}),oDlg:End() |
| CONCARG10 | MOVICON.prg:27 | REDEFINE BUTTON oBtn2  ID 302 OF oDLG | oDlg:End() |
| CONCARG9 | MOVICON.prg:79 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|CONCARG92(cT)}),oDlg:End() |
| CONCARG9 | MOVICON.prg:80 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| CONCARG9_NOM | MOVICON.prg:129 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|CONCARG92_NOM(cT)}),oDlg:End() |
| CONCARG9_NOM | MOVICON.prg:130 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| MOVI2 | MOVICON.prg:1101 | REDEFINE BUTTON ID 106 OF oWNDHIJA | editaCelC("TALIAS") |
| MOVI2 | MOVICON.prg:1102 | REDEFINE BUTTON ID 107 OF oWNDHIJA | (GravaDIRE(),oWNDHIJA:END()) |
| MOVI2 | MOVICON.prg:1103 | REDEFINE BUTTON ID 108 OF oWNDHIJA | SACAITEL() |
| MOVI2 | MOVICON.prg:1104 | REDEFINE BUTTON ID 109 OF oWNDHIJA | CON900G() |
| MOVI2 | MOVICON.prg:1105 | REDEFINE BUTTON ID 110 OF oWNDHIJA | PLANTIC(oBrowM) |
| MOVI2 | MOVICON.prg:1106 | REDEFINE BUTTON ID 118 OF oWNDHIJA | LOTEXLS_CON() |
| CON900G | MOVICON.prg:1639 | REDEFINE BUTTON ID 901 OF oDLGG | (CON901G() ,oDLGG:END()) PROMPT "&Cargar" |
| CON900G | MOVICON.prg:1640 | REDEFINE BUTTON ID 902 OF oDLGG | oDLGG:END() |
| CONESTA | MOVICON.prg:1746 | REDEFINE BUTTON ID 901 OF oDLGES | (WSIGUE:=.T.,oDlgES:end()) |
| CONESTA | MOVICON.prg:1747 | REDEFINE BUTTON ID 902 OF oDLGES | (WSIGUE:=.F.,oDlgES:end()) |
| EDITACELDA | MOVICON.prg:1866 | REDEFINE BUTTON oBtn1 ID 201 OF oDlgM | GRABAMOV1(cT),oDLGM:END() |
| EDITACELDA | MOVICON.prg:1867 | REDEFINE BUTTON oBtn2 ID 202 OF oDlgM | oDLGM:END() |
| CLIENTES2 | MOVICON.prg:2257 | REDEFINE BUTTON ID 901 OF oDLGT | GRABCLI2(),oDLGT:END() |
| CLIENTES2 | MOVICON.prg:2258 | REDEFINE BUTTON ID 902 OF oDLGT | oDLGT:END() |
| PLANTIC | MOVICON.prg:2645 | REDEFINE BUTTON oBtn1 ID 901 OF oDlgP | GRABA_PLA(),oDLGP:END() |
| PLANTIC | MOVICON.prg:2646 | REDEFINE BUTTON oBtn2 ID 902 OF oDlgP | oDlgP:end() |
| INTERCAM | MOVICON.prg:2764 | REDEFINE BUTTON oBtn1 ID 201 OF oDlga | (INTERCAM1(),odlga:END()) |
| INTERCAM | MOVICON.prg:2765 | REDEFINE BUTTON oBtn2 ID 202 OF oDlga | (INTERCAMC(),oDlga:end()) |
| ODLG_INIT10 | MOVICON.prg:3640 | TASKITEM "[Ent]Trabajar"   BITMAP WMF3 | (MOVI11(),OBROW:REFRESH()) |
| ODLG_INIT10 | MOVICON.prg:3641 | TASKITEM "[F2]Crear"       BITMAP WMF3 | (CREALOT2(.T.),OBROW:REFRESH()) |
| ODLG_INIT10 | MOVICON.prg:3642 | TASKITEM "[F3]Modificar"   BITMAP WMF4 | (CREALOT2(.F.),OBROW:REFRESH()) |
| ODLG_INIT10 | MOVICON.prg:3643 | TASKITEM "[F4]Eliminar"    BITMAP WMF5 | BORRALOT() |
| ODLG_INIT10 | MOVICON.prg:3644 | TASKITEM "[F5]Reorganizar" BITMAP WMF5 | INDELOT() |
| ODLG_INIT10 | MOVICON.prg:3645 | TASKITEM "[F6]Impresion"   BITMAP WMF5 | IMPLOTE(1) |
| ODLG_INIT10 | MOVICON.prg:3651 | TASKITEM "Verificacion Lote"  BITMAP "VERIFI" | (VERIFI(1),OBROW:REFRESH()) |
| ODLG_INIT10 | MOVICON.prg:3652 | TASKITEM "Actualizacion Lote" BITMAP WMF3 | (VERIFI(2),OBROW:REFRESH()) |
| ODLG_INIT10 | MOVICON.prg:3653 | TASKITEM "Depuracion Lote"    BITMAP WMF4 | (DEPURALO(),OBROW:REFRESH()) |
| ODLG_INIT10 | MOVICON.prg:3654 | TASKITEM "Reasignacion"       BITMAP WMF5 | (REASIGLO(),OBROW:REFRESH()) |
| MOVI11 | MOVICON.prg:3828 | REDEFINE BUTTON ID 201 OF oDLGM | EDITACELDA(1) |
| MOVI11 | MOVICON.prg:3829 | REDEFINE BUTTON ID 202 OF oDLGM | EDITACELDA(2) |
| MOVI11 | MOVICON.prg:3830 | REDEFINE BUTTON ID 203 OF oDLGM | SACAITET() |
| MOVI11 | MOVICON.prg:3831 | REDEFINE BUTTON ID 204 OF oDLGM | COMPARALO() |
| MOVI11 | MOVICON.prg:3832 | REDEFINE BUTTON ID 205 OF oDLGM | IMPLOTE(2) |
| MOVI11 | MOVICON.prg:3833 | REDEFINE BUTTON ID 206 OF oDLGM | MOVIBUS() |
| MOVI11 | MOVICON.prg:3834 | REDEFINE BUTTON ID 207 OF oDLGM | LOTEXLS() |
| ACTURETMO | MOVICON.prg:3919 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|ACTURETMO1()}),oDlg:End() |
| ACTURETMO | MOVICON.prg:3920 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| LOTEXLS | MOVICON.prg:4026 | REDEFINE BUTTON ID 901 OF oWNDCRE | LOTEXLS2(WTIPOX),oWNDCRE:END() |
| LOTEXLS | MOVICON.prg:4027 | REDEFINE BUTTON ID 902 OF oWNDCRE | oWNDCRE:END() |
| EDITAVAL | MOVICON.prg:4256 | REDEFINE BUTTON oBtn1 ID 201 OF oDlgP | VALGRAB(),oDLGP:END() |
| COPIMOV | MOVICON.prg:4351 | REDEFINE BUTTON oBtn1 ID 201 OF oDlgP | COPIMOV2(),oDLGP:END() |
| COPIMOV | MOVICON.prg:4352 | REDEFINE BUTTON oBtn2 ID 202 OF oDlgP | oDLGP:END() |
| IMPLOTE | MOVICON.prg:4531 | REDEFINE BUTTON ID 201 OF oDLGI2 | IMPLOTE2(),oDLGI2:END() |
| IMPLOTE | MOVICON.prg:4532 | REDEFINE BUTTON ID 202 OF oDLGI2 | oDLGI2:END() |
| CREALOT2 | MOVICON.prg:5481 | REDEFINE BUTTON oBtn1 ID 109 OF oDlg2 | GRABALOT(cLOTE3,cNOMBRE3,cMES3,cT),oDLG2:END() |
| CREALOT2 | MOVICON.prg:5482 | REDEFINE BUTTON oBtn2 ID 110 OF oDlg2 | oDlg2:end(),oBroW:GoBottom(),oBroW:GoTop(),oBROW:Refresh() |
| VERIFI | MOVICON.prg:5923 | REDEFINE BUTTON ID 190 OF odlg | odlg:END() |
| VERIFI3 | MOVICON.prg:6313 | REDEFINE BUTTON ID 201 OF oWNDV | (WVER:=.T.,oWNDV:END()) |
| VERIFI3 | MOVICON.prg:6314 | REDEFINE BUTTON ID 202 OF oWNDV | (WVER:=.F.,oWNDV:END()) |
| VERIFIREP | MOVICON.prg:6357 | REDEFINE BUTTON ID 204 OF oDLGER | INFERR() |
| VERIFIREP | MOVICON.prg:6358 | REDEFINE BUTTON ID 205 OF oDLGER PROMPT "[Esc]Salir" | oDlg:End() |
| VERIFI31 | MOVICON.prg:6396 | REDEFINE BUTTON ID 204 OF oDLGER | INFERR() |
| VERIFI31 | MOVICON.prg:6397 | REDEFINE BUTTON ID 205 OF oDLGER PROMPT "[Esc]Salir" | oDlg:End() |
| CAPTURA | MOVICON.prg:6671 | REDEFINE BUTTON ID 190 OF odlg | GENLOTE(),odlg:END() |
| CAPTURA | MOVICON.prg:6672 | REDEFINE BUTTON ID 191 OF odlg | odlg:END() |
| REASIGLO | MOVICON.prg:6822 | REDEFINE BUTTON ID 201 OF oDLG4 | REASIGL2(),oDlg4:end() |
| REASIGLO | MOVICON.prg:6823 | REDEFINE BUTTON ID 202 OF oDLG4 | oDlg4:end() |
| REEMBOL01 | MOVICON.prg:7340 | REDEFINE BUTTON ID 201 OF oWNDHIJA | (GrabaREEM(),oWNDHIJA:END()) |
| REEMBOL01 | MOVICON.prg:7341 | REDEFINE BUTTON ID 203 OF oWNDHIJA | (CONTAB_REEM(),oWNDHIJA:END()) |
| REEMBOL01 | MOVICON.prg:7342 | REDEFINE BUTTON ID 202 OF oWNDHIJA | oWNDHIJA:END() |
| EDITA_REEM | MOVICON.prg:7504 | REDEFINE BUTTON ID 201 OF oWNDHIJA2 | (GRABAITE_RE(),oWNDHIJA2:END()) |
| EDITA_REEM | MOVICON.prg:7505 | REDEFINE BUTTON ID 202 OF oWNDHIJA2 | oWNDHIJA2:END() |
| CMAESTRO | PLANMAES.PRG:35 | REDEFINE BUTTON ID 201 OF oWndhija | CMAEST1(.T.) |
| CMAESTRO | PLANMAES.PRG:36 | REDEFINE BUTTON ID 202 OF oWndhija | CMAEST1(.F.) |
| CMAESTRO | PLANMAES.PRG:37 | REDEFINE BUTTON ID 203 OF oWndhija | BORRAPL() |
| CMAESTRO | PLANMAES.PRG:38 | REDEFINE BUTTON ID 204 OF oWndhija | INFOR01() |
| CMAESTRO | PLANMAES.PRG:39 | REDEFINE BUTTON ID 205 OF oWndhija | CTABUS("cCONMAE") |
| CMAEST1 | PLANMAES.PRG:330 | REDEFINE BUTTON oBtn1 ID 109 OF oDlga | GRABAMAES(ctIPO),oDLGA:END() |
| CMAEST1 | PLANMAES.PRG:331 | REDEFINE BUTTON oBtn2 ID 110 OF oDlga | oDlga:end(),oBROBUS:Refresh() |
| ANA_MOVCTA | REPROCES.PRG:16 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | ANA_MOVCTA2(),oDlg:End() PROMPT "&Procesar" |
| ANA_MOVCTA | REPROCES.PRG:17 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| TERCE_LOT | REPROCES.PRG:224 | REDEFINE BUTTON ID 201 OF oDLGINV | TERCE_LOT2(),oDLGINV:END() |
| TERCE_LOT | REPROCES.PRG:225 | REDEFINE BUTTON ID 202 OF oDLGINV | oDLGINV:END() |
| REPRO01 | REPROCES.PRG:340 | REDEFINE BUTTON oBtn1  ID 201 OF oWNDHIJA | EDITAREP() |
| REPRO01 | REPROCES.PRG:341 | REDEFINE BUTTON oBtn4  ID 204 OF oWNDHIJA | BUSDOC2() |
| EDITAREP | REPROCES.PRG:510 | REDEFINE BUTTON oBtn1 ID 201 OF oDlgM | GRAVAREP() |
| EDITAREP | REPROCES.PRG:511 | REDEFINE BUTTON oBtn2 ID 202 OF oDlgM | oDLGM:END() |
| REASIMES | REPROCES.PRG:608 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|REASIME2()}),oDlg:End() PROMPT "&Procesar" |
| REASIMES | REPROCES.PRG:609 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| RECONDOC | REPROCES.PRG:723 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|RECONDO2()}),oDlg:End() PROMPT "&Procesar" |
| RECONDOC | REPROCES.PRG:724 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| AUTOREP | REPROCES.PRG:841 | REDEFINE BUTTON oBtn1 ID 201 OF oDlgM | AUTOREP2(),oDLGM:END() |
| AUTOREP | REPROCES.PRG:842 | REDEFINE BUTTON oBtn2 ID 202 OF oDlgM | oDLGM:END() |
| REPRO027 | REPROCES.PRG:927 | REDEFINE BUTTON ID 201 OF oDLG7 | (REPRO26(cT,SUBS(WPERIODO,1,2)),oDLG7:END()) |
| REPRO027 | REPROCES.PRG:928 | REDEFINE BUTTON ID 202 OF oDLG7 | oDLG7:END() |
| REPRO02 | REPROCES.PRG:984 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | REPRO21M(cT),oDlg:End() PROMPT "&Procesar" |
| REPRO02 | REPROCES.PRG:985 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| CIERR01 | REPROCES.PRG:4296 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | oDlg:End() |
| CIERR01 | REPROCES.PRG:4297 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| CIERR02 | REPROCES.PRG:4331 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | CIERR21(),oDlg:End() |
| CIERR02 | REPROCES.PRG:4332 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| ESPE03 | REPROCES.PRG:4484 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|ESPE03I()}),oDlg:End() |
| ESPE03 | REPROCES.PRG:4485 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| ESPE04 | REPROCES.PRG:4522 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | oDlg:End() |
| ESPE04 | REPROCES.PRG:4523 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| ESPE06 | REPROCES.PRG:4579 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|ESPE061()}),oDlg:End() |
| ESPE06 | REPROCES.PRG:4580 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| ESPE09 | REPROCES.PRG:4608 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|ESPE091()}),oDlg:End() |
| ESPE09 | REPROCES.PRG:4609 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| ESPE08 | REPROCES.PRG:4777 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|ESPE081(cT)}),oDlg:End() |
| ESPE08 | REPROCES.PRG:4778 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| ESPE08J | REPROCES.PRG:4923 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|ESPE081J(cT)}),oDlg:End() |
| ESPE08J | REPROCES.PRG:4924 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| ESPE07 | REPROCES.PRG:5321 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|ESPE071()}),oDlg:End() |
| ESPE07 | REPROCES.PRG:5322 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| ESPE10 | REPROCES.PRG:5523 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|ESPE101()}),oDlg:End() |
| ESPE10 | REPROCES.PRG:5524 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| ESPE11 | REPROCES.PRG:5838 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|ESPE11G(cT)}),oDlg:End() |
| ESPE11 | REPROCES.PRG:5839 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| ESPE12 | REPROCES.PRG:5931 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|ESPE12_1()}),oDlg:End() |
| ESPE12 | REPROCES.PRG:5932 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| CON900 | REPROCES.PRG:6049 | REDEFINE BUTTON ID 901 OF oDLGI | IIF( Ctipo=1,CON901(WMODULO,9) ,CON901G() ),oDLGI:END() |
| CON900 | REPROCES.PRG:6050 | REDEFINE BUTTON ID 902 OF oDLGI | (AVISO(1),oDLGI:END()) |
| LOTEE2 | REPROCES.PRG:6180 | REDEFINE BUTTON ID 201 OF oDLL | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|LOTEE3()}),oDLL:END() |
| LOTEE2 | REPROCES.PRG:6181 | REDEFINE BUTTON ID 202 OF oDLL | oDLL:END() |
| TRASLASA | REPROCES.PRG:6593 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|TRASLAS2(cT)}),oDlg:End() |
| TRASLASA | REPROCES.PRG:6594 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| MOVDOCK | REPROCES.PRG:6840 | REDEFINE BUTTON oBtn1  ID 201 OF oDLGM | oDLGM:end() |
| MOVDOCK | REPROCES.PRG:6841 | REDEFINE BUTTON oBtn4  ID 202 OF oDLGM | (X:=0,oDLGM:end()) |
| LIMPCIA | REPROCES.PRG:7464 | REDEFINE BUTTON oBtn1 ID 201 OF oDlgM | LIMPCIA2(),oDLGM:END() |
| LIMPCIA | REPROCES.PRG:7465 | REDEFINE BUTTON oBtn2 ID 202 OF oDlgM | oDLGM:END() |
| RECLA01 | REPROCES.PRG:7540 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|RECLA01G()}),oDlg:End() |
| RECLA01 | REPROCES.PRG:7541 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| RECLA03 | REPROCES.PRG:7618 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|RECLA03G()}),oDlg:End() |
| RECLA03 | REPROCES.PRG:7619 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| RECLA02 | REPROCES.PRG:7727 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|RECLA021()}),oDlg:End() |
| RECLA02 | REPROCES.PRG:7728 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| EXPORMES | REPROCES.PRG:7841 | REDEFINE BUTTON oBtn1  ID 201 OF oDLG | MSGRUN("Un momento por favor...","Procesando tarea",{\|\|EXPORMES2A()}),oDlg:End() PROMPT "&Procesar" |
| EXPORMES | REPROCES.PRG:7842 | REDEFINE BUTTON oBtn2  ID 202 OF oDLG | oDlg:End() |
| INDEXVIS | DSIINDEX.PRG:1782 | REDEFINE BUTTON ID 201 OF oDLG | (IIF( cT='I',ReIndxI(),IIF( cT='F',Reindxf(),IIF(cT='B',ReindxI2() ,IIF(cT='T' ,ReindxT() , NIL )))),oDLG:END()) |
| INDEXVIS | DSIINDEX.PRG:1783 | REDEFINE BUTTON ID 202 OF oDLG | Marcainv(1,"F") |
| INDEXVIS | DSIINDEX.PRG:1784 | REDEFINE BUTTON ID 203 OF oDLG | Marcainv(2,"F") |
| INDEXVIS | DSIINDEX.PRG:1785 | REDEFINE BUTTON ID 204 OF oDLG | oDLG:END() |
| VEHI001 | FACTAB.PRG:21 | DEFINE VMENUITEM OF oMENUV IMAGE "CREAR"   CAPTION "[F2]Crear" COLOR RGB(85,85,85),RGB(230,230,230) | TRAB_VEHI(.T.),oBROWT:REFRESH() |
| VEHI001 | FACTAB.PRG:22 | DEFINE VMENUITEM OF oMENUV IMAGE "MODIFI"  CAPTION "[F3]Modificar" COLOR RGB(85,85,85),RGB(230,230,230) | TRAB_VEHI(.F.),oBROWT:REFRESH() |
| VEHI001 | FACTAB.PRG:23 | DEFINE VMENUITEM OF oMENUV IMAGE "ELIMINA" CAPTION "[F4]Eliminar" COLOR RGB(85,85,85),RGB(230,230,230) | BORRAVEHI(),oBROWT:REFRESH() |
| VEHI001 | FACTAB.PRG:24 | DEFINE VMENUITEM OF oMENUV IMAGE "IMPRE"   CAPTION "[F5]Impresion" COLOR RGB(85,85,85),RGB(230,230,230) | LISTARZ() |
| TRAB_VEHI | FACTAB.PRG:77 | REDEFINE BUTTON oBtn1 ID 107 OF oDlga | VEHIGRABA(CTIPO),odlga:END(),oBROWT:REFRESH() |
| TRAB_VEHI | FACTAB.PRG:78 | REDEFINE BUTTON oBtn2 ID 105 OF oDlga | oDlga:end(),oBROWT:Refresh() |
| ZONAS | FACTAB.PRG:115 | DEFINE VMENUITEM OF oMENUV IMAGE "CREAR"   CAPTION "[F2]Crear" COLOR RGB(85,85,85),RGB(230,230,230) | TRAB_ZONA(.T.),oBROWT:REFRESH() |
| ZONAS | FACTAB.PRG:116 | DEFINE VMENUITEM OF oMENUV IMAGE "MODIFI"  CAPTION "[F3]Modificar" COLOR RGB(85,85,85),RGB(230,230,230) | TRAB_ZONA(.F.),oBROWT:REFRESH() |
| ZONAS | FACTAB.PRG:117 | DEFINE VMENUITEM OF oMENUV IMAGE "ELIMINA" CAPTION "[F4]Eliminar" COLOR RGB(85,85,85),RGB(230,230,230) | BORRATAB1(),oBROWT:REFRESH() |
| ZONAS | FACTAB.PRG:118 | DEFINE VMENUITEM OF oMENUV IMAGE "IMPRE"   CAPTION "[F5]Impresion" COLOR RGB(85,85,85),RGB(230,230,230) | LISTARZ() |
| EVENTOS | FACTAB.PRG:147 | DEFINE VMENUITEM OF oMENUV IMAGE "CREAR"   CAPTION "[F2]Crear" COLOR RGB(85,85,85),RGB(230,230,230) | TRAB_EVEN(.T.),oBROWT:REFRESH() |
| EVENTOS | FACTAB.PRG:148 | DEFINE VMENUITEM OF oMENUV IMAGE "MODIFI"  CAPTION "[F3]Modificar" COLOR RGB(85,85,85),RGB(230,230,230) | TRAB_EVEN(.F.),oBROWT:REFRESH() |
| EVENTOS | FACTAB.PRG:149 | DEFINE VMENUITEM OF oMENUV IMAGE "ELIMINA" CAPTION "[F4]Eliminar" COLOR RGB(85,85,85),RGB(230,230,230) | BORRAEVEN(),oBROWT:REFRESH() |
| EVENTOS | FACTAB.PRG:150 | DEFINE VMENUITEM OF oMENUV IMAGE "IMPRE"   CAPTION "[F5]Impresion" COLOR RGB(85,85,85),RGB(230,230,230) | LISTARZ() |
| TRAB_EVEN | FACTAB.PRG:199 | REDEFINE BUTTON oBtn1 ID 107 OF oDlga | DSIGRABAE(CTIPO),odlga:END(),oBROWT:REFRESH() |
| TRAB_EVEN | FACTAB.PRG:200 | REDEFINE BUTTON oBtn2 ID 105 OF oDlga | oDlga:end(),oBROWT:Refresh() |
| CIUDAD | FACTAB.PRG:265 | DEFINE VMENUITEM OF oMENUV IMAGE "CREAR"   CAPTION "[F2]Crear" COLOR RGB(85,85,85),RGB(230,230,230) | TRAB_CIU(.T.,cT),oBROWT:REFRESH() |
| CIUDAD | FACTAB.PRG:266 | DEFINE VMENUITEM OF oMENUV IMAGE "MODIFI"  CAPTION "[F3]Modificar" COLOR RGB(85,85,85),RGB(230,230,230) | TRAB_CIU(.F.,cT),oBROWT:REFRESH() |
| CIUDAD | FACTAB.PRG:267 | DEFINE VMENUITEM OF oMENUV IMAGE "ELIMINA" CAPTION "[F4]Eliminar" COLOR RGB(85,85,85),RGB(230,230,230) | BORRATAB4(),oBROWT:REFRESH() |
| CIUDAD | FACTAB.PRG:268 | DEFINE VMENUITEM OF oMENUV IMAGE "IMPRE"   CAPTION "[F5]Impresion" COLOR RGB(85,85,85),RGB(230,230,230) | CLISTAR(CT,"CALI") |
| TRAB_ZONA | FACTAB.PRG:451 | REDEFINE BUTTON oBtn1 ID 107 OF oDlga | DSIGRABAZ(CTIPO),odlga:END(),oBROWT:REFRESH() |
| TRAB_ZONA | FACTAB.PRG:452 | REDEFINE BUTTON oBtn2 ID 105 OF oDlga | oDlga:end(),oBROWT:Refresh() |
| TRAB_CIU | FACTAB.PRG:483 | REDEFINE BUTTON oBtn1 ID 107 OF oDlga | GRABACIU(CTIPO,cT),odlga:END(),oBROWT:REFRESH() |
| TRAB_CIU | FACTAB.PRG:484 | REDEFINE BUTTON oBtn2 ID 105 OF oDlga | oDlga:end(),oBROWT:Refresh() |
| FORMACOP | FACTAB.PRG:626 | REDEFINE BUTTON ID 201 OF oDLGA | MSGRUN("Un momento por favor...","Copiando formato...",{\|\|FORMACOP2()}),oDLGA:END() |
| FORMACOP | FACTAB.PRG:627 | REDEFINE BUTTON ID 202 OF oDLGA | oDLGA:end() |
| ODLG_INIT9 | FACTAB.PRG:750 | TASKITEM "[F2]Crear"      BITMAP WMF3 | FADGENFC(.T.,cT),oBROWf:REFRESH() |
| ODLG_INIT9 | FACTAB.PRG:751 | TASKITEM "[F3]Modificar"  BITMAP WMF4 | FADGENFC(.F.,cT),oBROWf:REFRESH() |
| ODLG_INIT9 | FACTAB.PRG:752 | TASKITEM "[F4]Eliminar"   BITMAP WMF5 | FADGENFB(),oBROWf:REFRESH() |
| ODLG_INIT9 | FACTAB.PRG:753 | TASKITEM "[Enter]Parametrizar"  BITMAP WMF5 | FADGENF2(cAR),oBROWf:REFRESH() |
| FADGENFC | FACTAB.PRG:811 | REDEFINE BUTTON oBtn1 ID 201 OF oDlgc | GRAVAFOR(cTIPO,cT),oDLGC:END() |
| FADGENFC | FACTAB.PRG:812 | REDEFINE BUTTON oBtn2 ID 202 OF oDlgC | oDLGC:END() |
| FADGENF2 | FACTAB.PRG:1019 | REDEFINE BTNBMP ID 108 OF oFLD:aDialogs[ 3 ] RESOURCE "BITMAP_10" | FADGENFN(.T.) TOOLTIP "Crear Nueva Leyenda" |
| FADGENF2 | FACTAB.PRG:1020 | REDEFINE BTNBMP ID 109 OF oFLD:aDialogs[ 3 ] RESOURCE "FAC9" | BORRAFOR() TOOLTIP "Eliminar" |
| FADGENF2 | FACTAB.PRG:1038 | REDEFINE BTNBMP ID 108 OF oFLD:aDialogs[ 4 ] RESOURCE "BITMAP_10" | FADGENFI(.T.) TOOLTIP "Insertar Imagen" |
| FADGENF2 | FACTAB.PRG:1039 | REDEFINE BTNBMP ID 109 OF oFLD:aDialogs[ 4 ] RESOURCE "FAC9" | BORRAFOR() TOOLTIP "Eliminar" |
| FADGENF2 | FACTAB.PRG:1054 | REDEFINE BTNBMP ID 108 OF oFLD:aDialogs[ 5 ] RESOURCE "BITMAP_10" | FADGENFF(.T.) TOOLTIP "Crear Nueva Forma" |
| FADGENF2 | FACTAB.PRG:1055 | REDEFINE BTNBMP ID 109 OF oFLD:aDialogs[ 5 ] RESOURCE "FAC9" | BORRAFOR() TOOLTIP "Eliminar" |
| FADGENF2 | FACTAB.PRG:1072 | REDEFINE BTNBMP ID 108 OF oFLD:aDialogs[ 6 ] RESOURCE "BITMAP_10" | FADGENFI(.T.) TOOLTIP "Insertar Imagen" |
| FADGENF2 | FACTAB.PRG:1073 | REDEFINE BTNBMP ID 109 OF oFLD:aDialogs[ 6 ] RESOURCE "DEL" | BORRAFOR() TOOLTIP "Eliminar" |
| FADGENFF | FACTAB.PRG:1124 | REDEFINE BUTTON oBtn1 ID 201 OF oDlFF | GRABAFF(cTIPO),oDLFF:END() |
| FADGENFF | FACTAB.PRG:1125 | REDEFINE BUTTON oBtn2 ID 202 OF oDlFF | oDLFF:END() |
| FADGENFN | FACTAB.PRG:1205 | REDEFINE BUTTON oBtn1 ID 201 OF oDlg6 | GRABAF6(Ctipo,XX),oDLG6:END() |
| FADGENFN | FACTAB.PRG:1206 | REDEFINE BUTTON oBtn2 ID 202 OF oDlg6 | oDLG6:END() |
| FADGENFI | FACTAB.PRG:1241 | REDEFINE BUTTON oBtn1 ID 201 OF oDlg6 | GRABAF3(Ctipo,XX),oDLG6:END() |
| FADGENFI | FACTAB.PRG:1242 | REDEFINE BUTTON oBtn2 ID 202 OF oDlg6 | oDLG6:END() |
| FADGENFP | FACTAB.PRG:1368 | REDEFINE BUTTON ID 201 OF oDLG5 | GRABAITF(),oDLG5:END() |
| FADGENFP | FACTAB.PRG:1369 | REDEFINE BUTTON ID 202 OF oDLG5 | oDLG5:END() |
| SELCOLX | CONTAGRAL.PRG:332 | REDEFINE BUTTON ID 211 OF oDLGTS | oDLGTS:END() |
| AYUCODV | CONTAGRAL.PRG:374 | REDEFINE BUTTON ID 102 OF oDLG | oDLG:END() |
| AYUCODV | CONTAGRAL.PRG:375 | REDEFINE BUTTON ID 104 OF oDLG | (AYUBUS(),oDLG:END()) |
| CLIENTER | CONTAGRAL.PRG:436 | REDEFINE BUTTON ID 103 OF oWndhija | CLIBUSR(),OBROW:REFRESH() |
| CLIENTER | CONTAGRAL.PRG:437 | REDEFINE BUTTON ID 102 OF oWndhija | EDITACLI(),OBROW:REFRESH() |
| CLIENTER | CONTAGRAL.PRG:438 | REDEFINE BUTTON ID 104 OF oWndhija | PROCERE() PROMPT "Procesar" |
| PROCERE | CONTAGRAL.PRG:534 | REDEFINE BUTTON ID 160 OF oWTP PROMPT "[Doble Click]Marca" | CONREASIG() |
| PROCERE | CONTAGRAL.PRG:535 | REDEFINE BUTTON ID 162 OF oWTP PROMPT "Continuar" | oWTP:END() |
| EDITACLI | CONTAGRAL.PRG:762 | REDEFINE BUTTON ID 901 OF oDLGC2 | GRABCOD2(),oDLGC2:END() |
| EDITACLI | CONTAGRAL.PRG:763 | REDEFINE BUTTON ID 902 OF oDLGC2 | oDLGC2:END() |
| ODLG_INITCL | CONTAGRAL.PRG:874 | TASKITEM "[F2]Crear"      BITMAP WMF3 | (TRAB_CLI2(.T.),OBROW:REFRESH()) |
| ODLG_INITCL | CONTAGRAL.PRG:875 | TASKITEM "[F3]Modificar"  BITMAP WMF4 | (TRAB_CLI2(.F.),OBROW:REFRESH()) |
| ODLG_INITCL | CONTAGRAL.PRG:876 | TASKITEM "[F4]Eliminar"   BITMAP WMF5 | (BORRACLI(),OBROW:REFRESH()) |
| ODLG_INITCL | CONTAGRAL.PRG:877 | TASKITEM "[B]Busqueda"  BITMAP WMF5 | BUS_CLI() |
| ODLG_INITCL | CONTAGRAL.PRG:881 | TASKITEM "Informacion Gral"  BITMAP WMF3 | LISTERCE(1) |
| ODLG_INITCL | CONTAGRAL.PRG:882 | TASKITEM "Cumpleaños"        BITMAP WMF4 | LISTERCU(1) |
| ODLG_INITCL | CONTAGRAL.PRG:883 | TASKITEM "Profesiones"       BITMAP WMF5 | LISTERCU(2) |
| ODLG_INITCL | CONTAGRAL.PRG:884 | TASKITEM "Etiquetas"         BITMAP WMF5 | LISTERCE(2) |
| ODLG_INITCL | CONTAGRAL.PRG:888 | TASKITEM "Bloquear"               BITMAP WMF3 | BLO_CLI() |
| ODLG_INITCL | CONTAGRAL.PRG:889 | TASKITEM "Desbloquear"            BITMAP WMF4 | BLO_CLI() |
| ODLG_INITCL | CONTAGRAL.PRG:890 | TASKITEM "Cargar Archivo"         BITMAP WMF5 | CARGA_CLI() |
| ODLG_INITCL | CONTAGRAL.PRG:891 | TASKITEM "Cupos Cartera"          BITMAP WMF5 | CUPO_CLI() |
| ODLG_INITCL | CONTAGRAL.PRG:892 | TASKITEM "Bloqueo Gral x Cartera" BITMAP WMF5 | BLO_GRAL() |
| ODLG_INITCL | CONTAGRAL.PRG:893 | TASKITEM "Informacion a XLS"      BITMAP WMF5 | GENIXLS() |
| BLO_GRAL | CONTAGRAL.PRG:929 | REDEFINE BUTTON ID 311 OF oDLGi3 | (BLO_GRAL2(),oDLGI3:END()) |
| BLO_GRAL | CONTAGRAL.PRG:930 | REDEFINE BUTTON ID 312 OF oDLGi3 | oDLGI3:END() |
| LISTERCU | CONTAGRAL.PRG:1083 | REDEFINE BUTTON ID 201 OF oWndFIS | LISTEU2(cT),oWNDFIS:END() |
| LISTERCU | CONTAGRAL.PRG:1084 | REDEFINE BUTTON ID 202 OF oWndFIS | oWNDFIS:END() |
| LISTERCU | CONTAGRAL.PRG:1101 | REDEFINE BUTTON ID 201 OF oWndFIS | LISTEU2(cT),oWNDFIS:END() |
| LISTERCU | CONTAGRAL.PRG:1102 | REDEFINE BUTTON ID 202 OF oWndFIS | oWNDFIS:END() |
| LISRUTAS | CONTAGRAL.PRG:1232 | REDEFINE BTNBMP ID 105 OF oWndFIS RESOURCE "BUSCA" | AYUCODZ("WZONAI","oGETF1") |
| LISRUTAS | CONTAGRAL.PRG:1233 | REDEFINE BTNBMP ID 106 OF oWndFIS RESOURCE "BUSCA" | AYUCODZ("WZONAF","oGETF2") |
| LISRUTAS | CONTAGRAL.PRG:1236 | REDEFINE BTNBMP ID 117 OF oWndFIS RESOURCE "BUSCA" | AYUCODV("WCODI2",WNIVEL2,"oGETF5",2) |
| LISRUTAS | CONTAGRAL.PRG:1237 | REDEFINE BTNBMP ID 118 OF oWndFIS RESOURCE "BUSCA" | AYUCODV("WCODF2",WNIVEL2,"oGETF6",2) |
| LISRUTAS | CONTAGRAL.PRG:1240 | REDEFINE BTNBMP ID 127 OF oWndFIS RESOURCE "BUSCA" | AYUCODV("WVENDEI","Vendedor","oGETF7",2) |
| LISRUTAS | CONTAGRAL.PRG:1241 | REDEFINE BTNBMP ID 128 OF oWndFIS RESOURCE "BUSCA" | AYUCODV("WVENDEF","Vendedor","oGETF8",2) |
| LISRUTAS | CONTAGRAL.PRG:1244 | REDEFINE BUTTON ID 201 OF oWndFIS | MSGRUN("Un momento por favor...","Generando Informe...",{\|\|LISRUTASX()}),oWndFIS:END()  |
| LISRUTAS | CONTAGRAL.PRG:1245 | REDEFINE BUTTON ID 202 OF oWndFIS | oWndFIS:END() |
| LISTERCE | CONTAGRAL.PRG:1413 | REDEFINE BTNBMP ID 105 OF oWNDFIS RESOURCE "BUSCA" | AYUCODZ("WZONAI","oGETF1") |
| LISTERCE | CONTAGRAL.PRG:1414 | REDEFINE BTNBMP ID 106 OF oWNDFIS RESOURCE "BUSCA" | AYUCODZ("WZONAF","oGETF2") |
| LISTERCE | CONTAGRAL.PRG:1417 | REDEFINE BTNBMP ID 117 OF oWNDFIS RESOURCE "BUSCA" | AYUCODV("WCODI2",WNIVEL2,"oGETF5",2) |
| LISTERCE | CONTAGRAL.PRG:1418 | REDEFINE BTNBMP ID 118 OF oWNDFIS RESOURCE "BUSCA" | AYUCODV("WCODF2",WNIVEL2,"oGETF6",2) |
| LISTERCE | CONTAGRAL.PRG:1421 | REDEFINE BTNBMP ID 127 OF oWNDFIS RESOURCE "BUSCA" | AYUCODV("WVENDEI","Vendedor","oGETF7",2) |
| LISTERCE | CONTAGRAL.PRG:1422 | REDEFINE BTNBMP ID 128 OF oWNDFIS RESOURCE "BUSCA" | AYUCODV("WVENDEF","Vendedor","oGETF8",2) |
| LISTERCE | CONTAGRAL.PRG:1426 | REDEFINE BUTTON ID 201 OF oWndFIS | LISTER2(cT),oWNDFIS:END() |
| LISTERCE | CONTAGRAL.PRG:1427 | REDEFINE BUTTON ID 202 OF oWndFIS | oWNDFIS:END() |
| LISTER4 | CONTAGRAL.PRG:1701 | REDEFINE BUTTON ID 201 OF oDLGi3 | oDLGI3:END() |
| LISTER4 | CONTAGRAL.PRG:1702 | REDEFINE BUTTON ID 202 OF oDLGi3 | oDLGI3:END() |
| CARGA_CLI | CONTAGRAL.PRG:2243 | REDEFINE BUTTON oBtn1 ID 208 OF oWndCLI | SUBECLI(),oWndCLI:END() |
| CARGA_CLI | CONTAGRAL.PRG:2244 | REDEFINE BUTTON oBtn2 ID 209 OF oWndCLI | oWndCLI:end() |
| TRAB_CLI2 | CONTAGRAL.PRG:2903 | REDEFINE BUTTON ID 901 OF oFLD:aDialogs[ 1 ] | GRABACLI(cTIPO),oDLG:END() |
| TRAB_CLI2 | CONTAGRAL.PRG:2904 | REDEFINE BUTTON ID 902 OF oFLD:aDialogs[ 1 ] | oDLG:END() |
| TRAB_CLI2 | CONTAGRAL.PRG:2952 | REDEFINE BUTTON ID 901 OF oFLD:aDialogs[ 2 ] | GRABACLI(cTIPO),oDLG:END() |
| TRAB_CLI2 | CONTAGRAL.PRG:2953 | REDEFINE BUTTON ID 902 OF oFLD:aDialogs[ 2 ] | oDLG:END() |
| TRAB_CLI2 | CONTAGRAL.PRG:3020 | REDEFINE BUTTON ID 901 OF oFLD:aDialogs[ 3 ] | GRABACLI(cTIPO),oDLG:END() |
| TRAB_CLI2 | CONTAGRAL.PRG:3021 | REDEFINE BUTTON ID 902 OF oFLD:aDialogs[ 3 ] | oDLG:END() |
| TRAB_CLI2 | CONTAGRAL.PRG:3043 | REDEFINE BUTTON ID 901 OF oFLD:aDialogs[ 4 ] | GRABACLI(cTIPO),oDLG:END() |
| TRAB_CLI2 | CONTAGRAL.PRG:3044 | REDEFINE BUTTON ID 902 OF oFLD:aDialogs[ 4 ] | oDLG:END() |
| TRAB_CLI2 | CONTAGRAL.PRG:3054 | REDEFINE BUTTON ID 901 OF oFLD:aDialogs[ 5 ] | GRABACLI(cTIPO),oDLG:END() |
| TRAB_CLI2 | CONTAGRAL.PRG:3055 | REDEFINE BUTTON ID 902 OF oFLD:aDialogs[ 5 ] | oDLG:END() |
| ADMCUENTA | CONTAGRAL.PRG:3101 | REDEFINE BUTTON ID 201 OF oWndFIS | (GRABACUENTA(cTIPO,WCOD),oWNDFIS:END()) |
| ADMCUENTA | CONTAGRAL.PRG:3102 | REDEFINE BUTTON ID 202 OF oWndFIS | oWNDFIS:END() |
| BLO_CLI | CONTAGRAL.PRG:4146 | REDEFINE BUTTON oBtn1 ID 106 OF oDlg | BLO_GRABA(),oDLG:END() |
| BLO_CLI | CONTAGRAL.PRG:4147 | REDEFINE BUTTON oBtn2 ID 107 OF oDlg | oDlg:end() |
| CUPO_CLI | CONTAGRAL.PRG:4198 | REDEFINE BUTTON ID 201 OF oDLGi3 | (GRACUP(),oDLGI3:END()) PROMPT "&Grabar" |
| CUPO_CLI | CONTAGRAL.PRG:4199 | REDEFINE BUTTON ID 202 OF oDLGi3 | oDLGI3:END() |
| GENIXLS | CONTAGRAL.PRG:4264 | REDEFINE BUTTON ID 201 OF oWNDEMP2 | MSGRUN("Un momento por favor...","Generando Informe...",{\|\|GENIXLS2(WTI)}),oWNDEMP2:END()  |
| GENIXLS | CONTAGRAL.PRG:4265 | REDEFINE BUTTON oBtn2 ID 202 OF oWNDEMP2 | oWNDEMP2:END() |
