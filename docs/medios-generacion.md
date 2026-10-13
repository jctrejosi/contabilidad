# Generar medios: MEDMAG04

La opción 4 del menú Medios magnéticos prepara los datos anuales para su
revisión posterior. No produce archivos XML ni envía información a la DIAN:
esas salidas pertenecen a otras funciones del programa original.

## Flujo y alcance

1. La pantalla consulta el año activo de `CONCTR.CTANO`, el número de
   asignaciones y los resultados existentes de la compañía.
2. Se solicita mes inicial/final, con valores predeterminados 01–12. Enter
   desplaza el foco entre los campos y al botón Generar.
3. El usuario confirma la sustitución de los resultados de su compañía.
4. Se verifican las asignaciones y sus referencias antes de calcular.
5. Se calculan detalle y acumulados siguiendo las ramas de Harbour.
6. Una transacción elimina y reconstruye exclusivamente las filas con
   `CIA = compañía seleccionada` en `CONMAGIT` y `CONMAGDT`.
7. La pantalla informa cantidades y tiempo transcurrido.

Las filas antiguas sin CIA permanecen sin asignar y no se borran. El esquema
mantiene una generación vigente por compañía; no conserva versiones por
rango de meses. Generar enero después de generar enero–diciembre sustituye
todo el resultado de esa compañía, como hace MEDMAG04 en su carpeta original.

## Correspondencia con el código de origen

Origen: `C:\Xedit4\CONTABDSI\Source\DSITAB.prg`, funciones MEDMAG04,
MEDMAG04G, MEDMAG4B, MEDMAG41, MEDMAG42NN, MOVMEDIOS, MOVMEDCXP,
MOVMEDRET, MEDMAG44 y MEDMAG45. El saldo anual usa CONSALDO de CONSULTA.PRG.

- `MEDMAG41/42NN`: recorre el rango de meses y las asignaciones `CONMAG3.CIA`.
  Los antiguos MOV01–MOV12 se sustituyen por MOV01, filtrando CONCIA,
  CONANO (año activo), CONMES y CODIGO.
- `MODCXP=1`, movimiento directo: filtra los documentos DOCX/DOCX2/DOCX3
  cuando están definidos. Orienta el signo por el primer dígito de la cuenta.
  PMED1–PMED6 son factores bimestrales, no porcentajes divididos por 100.
  Un factor no cero invierte el signo y separa valor principal y remanente
  hacia el segundo formato/concepto/columna, igual que MOVMEDIOS.
- `MODCXP=1`, movimiento tipo 2: toma las partidas de CUENTA2 cuando existe
  una partida de CUENTA con igual tercero, número documental, tipo de
  documento, comprobante y fecha. NATURAL invierte la orientación. La marca
  TTIME original se representa en memoria por partida durante el mes;
  varias partidas del mismo documento se conservan, y una partida ya
  procesada por esta rama no se vuelve a emitir en otra asignación del mes.
  Esta rama no utiliza DOCX ni PMED en el original.
- `MODCXP=2`: consulta XADMAE por tercero (primeros 10 caracteres), factura
  (primeros 12) y fecha. Separa proporcionalmente CVLRBRU/CVLRIVA; el IVA
  va a COLBASE, cuyo valor predeterminado es 1. Si XADMAE falta o no puede
  abrirse, la generación se detiene antes de sustituir resultados.
- `MODCXP=3`: obtiene el valor absoluto de TBASE de la segunda cuenta con
  la misma llave documental. Emite base y diferencia en COLVALOR/COLBASE,
  conservando filtros documentales y rótulos BASE/IVA DESDE RET.
- `TIPOMED=4`: se procesa una vez al terminar los meses. El usuario confirmó
  que cada compañía corresponde a un ejercicio y sus saldos de terceros
  pertenecen a ese ejercicio. Se consulta CONTERCE por CIA/CODIGO/NIT y se
  calcula MSALDO + débitos + créditos de enero a diciembre. Los créditos ya
  son negativos. Este saldo anual no se restringe al mes final del filtro,
  igual que MEDMAG45, que siempre llama CONSALDO('12').
- FADCLI proporciona el dígito de verificación. CONMAGDT agrupa por formato,
  concepto, tercero y tercero2; acumula VALOR1–VALOR11. CONMAGIT conserva las
  partidas documentales. Los campos no utilizados por el original se dejan
  con sus valores predeterminados. Se conserva TINCON=0 en la rama de cruce,
  donde Harbour no asigna ese campo, y el cero original de COLVALOR en el
  detalle de saldos cuando la columna acumulada se normaliza a 1.

El diálogo original incluye rango de ciudades, pero ninguna función del
recorrido MEDMAG04 utiliza WCIUI/WCIUF. La pantalla nueva no ofrece ese filtro
sin efecto ni incorpora un filtrado diferente al cálculo original.

## Implementación y verificación

- `backend/medios_generacion_repository.py`: validación, cálculo y escritura
  mediante ADODB + ODBC. No modifica MOV01 ni CONTERCE.
- `backend/app.py`: GET/POST `/api/medios/generacion?cia=027`. El POST requiere
  mesInicial, mesFinal y confirmar=true. No recibe año desde el navegador.
- `Interface_web/src/api/mediosGeneracion.ts`: contrato HTTP.
- `Interface_web/src/pages/MediosGeneracion.tsx`: filtros y confirmación.
- `db/migration/19_medios_generacion_compania.sql`: añade CIA e índices de
  compañía a ambas tablas de resultados; no reasigna históricos.
- `backend/tests/test_medios_generacion.py`: ejemplos de todas las ramas,
  signos, partición bimestral, partidas repetidas, dependencias y rollback.

Las verificaciones automáticas no ejecutan una generación en la base activa.
La comprobación comparativa con datos reales necesita asignaciones configuradas
y XADMAE incorporada para las asignaciones de CxP.
