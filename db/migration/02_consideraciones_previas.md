# Consideraciones previas a la migración

Lista de lo que hay que resolver **antes** de cargar un solo registro. Las
referencias `B01–B15`, `P01–P30` y `T01–T18` corresponden a los documentos de
[`../old_db/`](../old_db/); las reglas de transformación están en
[`../old_db/PLAN_MIGRACION_POSTGRESQL.md`](../old_db/PLAN_MIGRACION_POSTGRESQL.md) §6.

## 1. Acceso a la fuente

- **Hace falta el motor Advantage** (cliente/ACE + proveedor OLEDB) o un servidor
  ADS accesible. Es la dependencia que el backend tiene hoy y que la migración
  solo traslada al momento de extraer. Ver [`01_inventario_fuente.md`](01_inventario_fuente.md) §2.
- **Instantánea consistente**: el legado se escribe desde varios módulos. Copiar
  los `.ADT` con escrituras activas mezcla instantes (regla 10.2 del plan). Hay
  que congelar o usar un snapshot del servidor.
- **El origen no se toca**: extracción de solo lectura. No se borran ni
  reorganizan `.ADT`/`.DBF` al terminar (regla 10.8).
- **Codificación**: validar OEM/ANSI por archivo antes de convertir a UTF-8 y
  comparar tildes y `ñ` (regla 6.2). No asumir una sola codificación para todos.
- **`RECNO` no es identidad**: sirve como localizador dentro de una instantánea
  identificada, no como clave estable entre cortes (regla 6.3).

## 2. Alcance (fase 0 del plan)

- **Empresas y años definitivos.** `ADD_CONTAB` es **una** carpeta sin
  identificar; `CONEMP` dirá a qué compañía(s) corresponde. El resto de empresas
  exige su propia copia.
- **Historia requerida.** Con la copia actual solo hay movimientos de `MOV00` y
  `MOV01`: decidir si eso basta para el piloto y qué años deben migrarse después.
- **Módulos que siguen en el legado** (los 23 de P30 y los formatos compartidos
  de P21). De esa decisión depende si van a `integraciones` o a réplica tipada.
- **Exclusiones aprobadas.** Las 167 familias de `EXCLUSIONES_CONTABDSI.md` y las
  18 sin estructura equivalente requieren **aprobación explícita**, no deducción
  automática del analizador.

## 3. Modelo destino

- **Los 15 bloqueos B01–B15 siguen abiertos** y el dictamen es **NO-GO**. En
  particular, antes de cargar: un lote puede producir varios documentos (B01),
  la anulación deja saldos inconsistentes (B02), no hay regeneración de IVA ni
  retención (B03), faltan dimensiones del movimiento (B04) y el aislamiento por
  compañía/año es incompleto (B05).
- **Homologación incompleta**: 2.663 campos, con 406 candidatos explícitos y
  2.257 pendientes. «No existe todavía un contrato campo a campo completo y
  aprobado; es una condición de entrada para ejecutar la migración».
- **No copiar 1:1 los nombres del legado.** Activos, amortizables y las
  selecciones temporales pueden compartir un modelo normalizado.
- **Preservar la historia, no renumerarla**: separar `numero` nuevo, documento
  fuente alfanumérico y tipo documental (regla 6.2). `CONDOCUM.DDOCUM` no es un
  `bigint`.
- **El libro contabilizado es inmutable** y se escribe por servicios/funciones,
  no por DML libre (B06).

## 4. Reglas de transformación que más se equivocan

| Tema | Regla | Trampa documentada |
|---|---|---|
| Signo del valor | `TVALOR > 0` → débito; `< 0` → crédito = `-TVALOR` (`MOVICON.prg:6581-6583`) | Conservar el original y las anomalías/ceros en staging; no perder el signo |
| Columnas mensuales | Despivotar a una fila por período (`MACMDEB/CRE01..18`) | **No perder los períodos 00 y 13..18** |
| Porcentajes | `19` → `0.19` en el dominio de fracción | No dividir dos veces un dato que ya sea fracción |
| Fechas | Numéricas `AAAAMMDD` o texto → `date` con validación estricta | Blancos/cero/invalidas a cuarentena con motivo; **nunca** sustituir por hoy |
| Códigos y NIT | Texto, con ceros iniciales y valor original | Normalizar con tabla de equivalencias, no con sustituciones irreversibles |
| Tercero sin auxiliar | `CONMAE.NITN` = 15 espacios **o NULL** | Es la misma regla que ya usa el backend hoy |
| Códigos que parecen importes | `VISDOCUM.DEB01/CRE01` son **cuentas**, no débitos/créditos | Error de interpretación frecuente |
| Clasificación | `CONMAE.CTCTABASE` no es `cuenta_base_id` | Va a `clasificacion_corriente` |
| Importes | Conservar el valor original en staging y conciliar el redondeo | `numeric(18,2)` puede redondear; documentar cada diferencia |
| Fórmulas | `CONDECLA.FORMULA`, `CONGENF` | No ejecutar expresiones del legado sin control |

## 5. Derivados, saldos y aperturas

- **No copiar acumulados como verdad.** `COCENTRO`, `CONTERCE`, `CONMCOS`,
  `CONTCOS`, `CONRET` y `CONIVA` son derivados del libro: se reconstruyen y se
  conservan las instantáneas del origen **solo como evidencia de conciliación**
  (regla 6.3). Los dos agregados actuales no permiten reconstruir el cruce
  cuenta+tercero+centro (P14).
- **`CONMAE` mezcla maestro, auxiliares y acumulados**: separarlos antes de
  cargar `cuentas`. No crear una cuenta por cada combinación cuenta/NIT.
- **Aperturas**: elegir una única fuente. Si `MOV00` contiene la apertura, **no**
  volver a sumarle `MSALDO`; no cargar ciegamente `cuentas.saldo_inicial` (T11).
- **Un lote aplicado y su movimiento publicado no son dos asientos.** Evitar
  cargar el libro y luego recontabilizar el mismo `MC` (regla 6.1).
- **Períodos del libro**: el legado usa períodos `00` y `13..18` además de
  `01..12`; el destino solo modela 1..12 y hay que clasificar el resto sin
  descartarlo (B13).

## 6. Idempotencia, staging y conciliación

- **Clave de negocio estable + huella de contenido por archivo/operación**; el
  UUID por fila no detecta un reintento (B07).
- **Registrar rechazos con causa y responsable.** No reemplazar un dato inválido
  por un valor de demostración ni por un tercero genérico (contrato del cargador).
- **Cuadratura por documento, no solo por lote**: un error simétrico cuadra
  (T02) y «no basta que total débito = total crédito» (§9).
- **Conciliar cabeceras `CONDOCUM` con `MOVxx`** antes de reconstruir; los
  movimientos huérfanos se registran como excepción, no se descartan ni se les
  inventa cabecera (regla 6.1).
- **Diferencia cero después de la transformación aprobada**; las diferencias de
  redondeo se aprueban una por una, sin tolerancia global que oculte faltantes.
- Cargas **reanudables** por entidad/empresa/año con transacciones y puntos de
  control; no ocultar errores para «terminar» la carga.

## 7. Seguridad y datos sensibles

- **`VISUSU`**: no copiar claves en claro ni heredar permisos. `PERMI` del
  original devuelve verdadero **antes** del código de permisos
  (`CONTABDSI.PRG:858`): esa política permisiva no se traslada (B14).
- **`FADCTAS`**: contiene datos bancarios de terceros; no exponerlos en reportes
  de prueba ni en logs.
- **Auditoría**: la bitácora no se alimenta sola y debe ser inmutable; registrar
  quién migró, cuándo y con qué versión de transformación (B14).
- **Credenciales** de origen y destino fuera de documentos y del repositorio;
  permisos mínimos en el destino.

## 8. Operación y corte

- **Respaldo y restauración probados antes** del corte, con conteos y hashes de
  origen, staging, destino y archivos (regla 10.4).
- **Un solo escritor por proceso**: legado y destino no escriben a la vez salvo
  sincronización formal diseñada y probada (regla 10.1).
- **Ventana, RPO/RTO y autoridad de decisión** fijados antes del corte; si falla
  después de recibir operaciones nuevas, volver al respaldo no basta (regla 10.7).
- **Legado en solo lectura** por el plazo aprobado.

## 9. El backend

Conectar la aplicación al modelo nuevo **no** es parte de la migración de datos y
tampoco es un cambio de configuración: los 15 módulos `*_repository.py` hablan
ADS/ADO y no hay driver PostgreSQL instalado. Está desarrollado en
[`04_transicion_del_backend.md`](04_transicion_del_backend.md).
