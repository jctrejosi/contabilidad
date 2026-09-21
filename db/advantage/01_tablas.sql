-- =====================================================================
-- CONTABDSI · db/advantage/01_tablas.sql
-- Diccionario de datos Advantage ADS — las 60 tablas del modelo.
-- =====================================================================
-- Motor: Advantage Database Server (ADS), diccionario de datos .ADD.
-- ADVERTENCIA: este archivo es una GUÍA DE TRADUCCIÓN, no un script de
-- producción. La sintaxis sigue el DDL de Advantage Data Architect / ADS
-- SQL contra un diccionario de datos (conexión a la ruta .ADD) y debe
-- REVISARSE con Data Architect antes de crear el diccionario: tipos,
-- anchos, defaults y nulabilidad pueden exigir ajustes según la versión
-- de ADS instalada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0.1 Forma canónica y ejecución
-- ---------------------------------------------------------------------
-- Forma canónica de cada sentencia (diccionario nuevo, un solo .ADD):
--
--   CREATE TABLE companias ( … ) IN DATABASE 'C:\CONTABDSI\CONTABDSI.add';
--
-- En este script se omite la cláusula `IN DATABASE` (es idéntica para las
-- 60 tablas y solo añade ruido): las sentencias se ejecutan conectado al
-- diccionario (Data Architect o cliente SQL apuntando a la ruta .ADD).
-- Nomenclatura: nombres del modelo en minúsculas y sin acentos
-- (companias, cuentas, documento_lineas…). El diccionario conserva los
-- identificadores tal como se declaran; si el despliegue exige otra caja
-- (p. ej. mayúsculas por convención del diccionario legado), el cambio es
-- mecánico y no altera el resto del diseño.
-- Estructura: UNA sola tabla por entidad para todas las compañías
-- (esquema único); el aislamiento entre empresas se hace con compania_id,
-- NO con un diccionario/carpeta por empresa como hacía VISION.

-- ---------------------------------------------------------------------
-- 0.2 Tipos (traducción de db/general/mapeo_motores.md)
-- ---------------------------------------------------------------------
--   id           → AUTOINC          ⚠ 32 bits: máx. ~2 147 483 647 filas
--                                    por tabla. Volumen alto en documentos,
--                                    documento_lineas, lote_lineas y
--                                    saldos_*: ver README §2 (alternativa:
--                                    secuencia propia en el servicio).
--   entero       → INTEGER
--   entero_largo → INTEGER          ⚠ DECISIÓN de esta guía: el mapeo
--                                    ofrece DOUBLE (riesgoso: IEEE 754 no
--                                    es exacto para contadores), dos
--                                    INTEGER o VARCHAR(18). Todos los usos
--                                    del modelo (consecutivos de
--                                    documentos, consecutivos_comprobantes,
--                                    tipos_documento.consecutivo) son
--                                    contadores que la operación contable
--                                    real no acerca a 2^31, así que se
--                                    declaran INTEGER y cada columna
--                                    documenta cuándo escalar.
--   texto        → VARCHAR(n)        anchos por clase, ver §0.3
--   texto_libre  → MEMO
--   dinero       → NUMERIC(18,2)     MONEY NO se usa (4 decimales internos
--                                    y redondeos de motor): el contrato
--                                    monetario debe ser idéntico al de
--                                    PostgreSQL.
--   porcentaje   → NUMERIC(9,6)      fracción: 19 % = 0.190000
--   cantidad     → NUMERIC(18,4)     excepción: formato_elementos
--                                    (x, y, ancho, alto) usa NUMERIC(10,2)
--                                    igual que PostgreSQL.
--   fecha        → DATE
--   fecha_hora   → TIMESTAMP         ADS no tiene zona horaria; el servicio
--                                    normaliza (UTC/hora del contrato).
--   booleano     → LOGICAL
--   uuid         → CHARACTER(36)     sin default de motor: el servicio
--                                    genera el UUID antes del INSERT.
--   documento    → MEMO              JSON serializado, validado por el
--                                    servicio (no hay jsonb en ADS).
--
-- Defaults: se replican los literales de PostgreSQL. No se usan funciones
-- en DEFAULT (NOW(), gen_random_uuid()…) porque el DDL del diccionario
-- espera literales; donde PostgreSQL usa una función hay un comentario en
-- la columna y el valor lo asigna el servicio o el trigger del diccionario.

-- ---------------------------------------------------------------------
-- 0.3 Anchos de texto VARCHAR por clase (decisión de esta guía)
-- ---------------------------------------------------------------------
--   VARCHAR(1)   sexo (M/F/J)
--   VARCHAR(2)   periodo ('00'–'18'), digito (DV)
--   VARCHAR(10)  tipo_documento (NIT/CC/CE/…), numeracion (Manual/Automatica)
--   VARCHAR(20)  nit, nit_relacionado, nit_alterno (NIT colombiano + holgura)
--   VARCHAR(30)  codigo, estado, tipo, clase, origen, zona, ambito,
--                severidad, resultado, modulo, distribucion, modo_retencion,
--                campo, comprobante, numero (bancaria/reembolso),
--                codigo_legado, telefono
--   VARCHAR(100) documento (referencia), documento_afectado,
--                documento_soporte, soporte_anulacion, caja_menor, etiqueta
--   VARCHAR(255) nombre/nombre_empresa (razón social, denominaciones),
--                direccion, ciudad, correo, path, origen_referencia,
--                archivo_origen, fuente
--   VARCHAR(500) concepto, mensaje, motivo, motivo_bloqueo, motivo_anulacion,
--                detalle, accion, descripcion, contenido
--   VARCHAR(10)  iniciales (sellos)
-- NOTA: los VarChar del diccionario no rellenan con espacios (a diferencia
-- de los Character); pasarse de ancho no cuesta espacio en disco. Son
-- anchos de diseño revisables en Data Architect sin afectar otras tablas.
-- Excepción: el diccionario LEGADO usa campos Character de ancho fijo
-- (p. ej. códigos de cuenta de 12): el ETL los lee y los recorta/valida.

-- ---------------------------------------------------------------------
-- 0.4 CHECK, FK y UK (garantías del modelo)
-- ---------------------------------------------------------------------
-- ADS no declara CHECK ni FK. Al pie de cada tabla quedan, como comentario:
--   -- CHECK: …       catálogos cerrados y reglas que valida el servicio
--   -- FK lógica: …   referencias que valida el servicio (con integridad
--                     de aislamiento (compania_id, id) donde aplica)
-- Las UK de negocio y de aislamiento SÍ se materializan como UNIQUE INDEX
-- en 02_indices.sql (en ADS la unicidad se declara con índices).
-- Una tabla referenciada por FK compuestas de otras tablas necesita la UK
-- (compania_id, id); se indica en su pie de comentarios.

-- ---------------------------------------------------------------------
-- 0.5 Auditoría
-- ---------------------------------------------------------------------
-- Las columnas de auditoría (creado_en, creado_por, actualizado_en,
-- actualizado_por, version) se declaran SOLO donde la tabla real las tiene
-- (verificado contra db/postgresql/schema/*.sql): las tablas derivadas
-- (saldos_*, acumulados_*), los detalles puros y los catálogos de seguridad
-- no las llevan. Las tablas con columnas de auditoría esperan el trigger
-- genérico del diccionario (se define por tabla en Data Architect; ADS
-- soporta triggers de tabla) o, en su defecto, la misma lógica en el
-- servicio: en UPDATE sellar actualizado_en y avanzar version; en INSERT
-- fijar creado_en y version cuando vienen NULL (equivalente a
-- auditoria_antes_update/insert de db/postgresql/schema/01_dominios.sql).
-- `documentos` exige además un trigger/servicio que mantenga la columna
-- derivada documento_estado (ver tabla 23).

-- =====================================================================
-- MÓDULO 1 — NÚCLEO: entidades 1–5 (companias → parametros_nomina)
-- =====================================================================

-- 1. companias — empresas del sistema (equivale a la carpeta de empresa de VISION). (ver general/01_entidades.md)
CREATE TABLE companias (
  id                 AUTOINC,
  codigo             VARCHAR(30)  NOT NULL,   -- '001'
  nombre             VARCHAR(255) NOT NULL,   -- razón social (CONCTR.CTCIA)
  nit                VARCHAR(20)  NOT NULL,   -- sin dígito de verificación
  digito             VARCHAR(2)   NOT NULL,   -- DV
  estado             VARCHAR(30)  NOT NULL DEFAULT 'Activa',
  solo_consolidacion LOGICAL      NOT NULL DEFAULT FALSE,
  creado_en          TIMESTAMP,
  creado_por         INTEGER,
  actualizado_en     TIMESTAMP,
  actualizado_por    INTEGER,
  version            INTEGER      NOT NULL DEFAULT 0   -- concurrencia optimista
);
-- CHECK: estado IN ('Activa','Inactiva')
-- UK (02): (codigo); (nit, digito)

-- 2. compania_anios — años contables habilitados por compañía. (ver general/01_entidades.md)
CREATE TABLE compania_anios (
  id               AUTOINC,
  compania_id      INTEGER  NOT NULL,
  anio             INTEGER  NOT NULL,
  creado_en        TIMESTAMP,
  creado_por       INTEGER,
  actualizado_en   TIMESTAMP,
  actualizado_por  INTEGER,
  version          INTEGER  NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999
-- FK lógica: compania_id → companias(id)

-- 3. periodos_contables — períodos por compañía/año y su estado de cierre. (ver general/01_entidades.md)
CREATE TABLE periodos_contables (
  id              AUTOINC,
  compania_id     INTEGER      NOT NULL,
  anio            INTEGER      NOT NULL,
  periodo         VARCHAR(2)   NOT NULL,   -- '00' saldos iniciales, '01'-'12' meses, '13'-'18' ajustes
  nombre          VARCHAR(255) NOT NULL,   -- 'Febrero', 'Saldos Iniciales'…
  estado          VARCHAR(30)  NOT NULL DEFAULT 'Abierto',
  cerrado_por     INTEGER,                 -- usuario que cerró
  cerrado_en      TIMESTAMP,
  creado_en       TIMESTAMP,
  creado_por      INTEGER,
  actualizado_en  TIMESTAMP,
  actualizado_por INTEGER,
  version         INTEGER      NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999; periodo IN ('00'…'18');
--        estado IN ('Abierto','Cerrado')
-- FK lógica: compania_id → companias(id)

-- 4. parametros_operacion — parámetros de operación por compañía/año (PARAM_1 / DSIGRABA6). (ver general/01_entidades.md)
CREATE TABLE parametros_operacion (
  id                          AUTOINC,
  compania_id                 INTEGER      NOT NULL,
  anio                        INTEGER      NOT NULL,
  nombre_empresa              VARCHAR(255) NOT NULL DEFAULT '',  -- CONCTR.CTCIA
  nit                         VARCHAR(20)  NOT NULL DEFAULT '',  -- CTNIT
  direccion                   VARCHAR(255) NOT NULL DEFAULT '',  -- CTDIRECC
  ciudad                      VARCHAR(255) NOT NULL DEFAULT '',  -- CTCIUDAD
  directorio_contabilidad     VARCHAR(255) NOT NULL DEFAULT '',  -- CTDIREC
  anio_operacion              VARCHAR(30)  NOT NULL DEFAULT '',  -- CTANO
  contabilidad_conciliacion   VARCHAR(30)  NOT NULL DEFAULT '',  -- CTCLAVE1
  verifica_documentos_lotes   LOGICAL      NOT NULL DEFAULT TRUE,  -- CTVERDOC
  terceros_documentos_propios LOGICAL      NOT NULL DEFAULT FALSE, -- CTTERDOC
  controla_usuario_lotes      LOGICAL      NOT NULL DEFAULT TRUE,  -- CTPUC
  comentario_certificado      MEMO         NOT NULL,  -- CTLEY1 (texto_libre)
  fecha_operativa             DATE,                  -- CTFCHOY
  observacion                 MEMO         NOT NULL,  -- CTTOBS (texto_libre)
  documento                   VARCHAR(100) NOT NULL DEFAULT '',  -- CTDOCUM
  leyenda2                    MEMO         NOT NULL,  -- CTLEY2 (texto_libre)
  modo_retencion              VARCHAR(30)  NOT NULL DEFAULT 'retencion-a-base',
  periodos_habilitados        MEMO         NOT NULL,  -- JSON CT00..CT12 → habilitado; servicio inserta '{}'
  creado_en                   TIMESTAMP,
  creado_por                  INTEGER,
  actualizado_en              TIMESTAMP,
  actualizado_por             INTEGER,
  version                     INTEGER      NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999; modo_retencion IN ('retencion-a-base','base-a-retencion')
-- FK lógica: compania_id → companias(id)

-- 5. parametros_nomina — parámetros de nómina (PARAMS_NOMI / DSIGRABA6_NOM). (ver general/01_entidades.md)
CREATE TABLE parametros_nomina (
  id                      AUTOINC,
  compania_id             INTEGER      NOT NULL,
  anio                    INTEGER      NOT NULL,
  comprobante_nomina      VARCHAR(100) NOT NULL DEFAULT '',  -- CTCOMNOM1
  documento_nomina        VARCHAR(100) NOT NULL DEFAULT '',  -- CTDOCNOM1
  comprobante_aportes     VARCHAR(100) NOT NULL DEFAULT '',  -- CTCOMNOM2
  documento_aportes       VARCHAR(100) NOT NULL DEFAULT '',  -- CTDOCNOM2
  comprobante_provisiones VARCHAR(100) NOT NULL DEFAULT '',  -- CTCOMNOM3
  documento_provisiones   VARCHAR(100) NOT NULL DEFAULT '',  -- CTDOCNOM3
  creado_en               TIMESTAMP,
  creado_por              INTEGER,
  actualizado_en          TIMESTAMP,
  actualizado_por         INTEGER,
  version                 INTEGER      NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999
-- FK lógica: compania_id → companias(id)

-- =====================================================================
-- MÓDULO 2 — MAESTROS: entidades 6–19 (cuentas → formato_elementos)
-- =====================================================================

-- 6. cuentas — plan de cuentas jerárquico. (ver general/01_entidades.md)
CREATE TABLE cuentas (
  id               AUTOINC,
  compania_id      INTEGER       NOT NULL,
  codigo           VARCHAR(30)   NOT NULL,   -- '510506'
  nombre           VARCHAR(255)  NOT NULL,
  nivel            INTEGER       NOT NULL,   -- CHECK: 1, 2, 4, 6, 9, 12
  afectable        LOGICAL       NOT NULL DEFAULT TRUE,
  controla_tercero LOGICAL       NOT NULL DEFAULT FALSE,
  controla_centro  LOGICAL       NOT NULL DEFAULT FALSE,
  controla_base    LOGICAL       NOT NULL DEFAULT FALSE,
  ajuste           LOGICAL       NOT NULL DEFAULT FALSE,
  clase_iva        VARCHAR(30),              -- 'Generado' | 'Descontable' | NULL
  clase_retencion  VARCHAR(30),              -- 'Renta' | 'IVA' | 'ICA' | NULL
  distribucion     VARCHAR(30)   NOT NULL DEFAULT 'Ninguna',
  porcentaje       NUMERIC(9,6)  NOT NULL DEFAULT 0,
  cuenta_base_id   INTEGER,                  -- cuenta base de distribución
  saldo_inicial    NUMERIC(18,2) NOT NULL DEFAULT 0,
  parent_id        INTEGER,                  -- jerarquía
  path             VARCHAR(255),             -- ruta materializada '/1/5/51/5105/510506'
  eliminado_en     TIMESTAMP,                -- borrado lógico
  creado_en        TIMESTAMP,
  creado_por       INTEGER,
  actualizado_en   TIMESTAMP,
  actualizado_por  INTEGER,
  version          INTEGER       NOT NULL DEFAULT 0
);
-- CHECK: nivel IN (1,2,4,6,9,12); distribucion IN ('Ninguna','Fija','Porcentaje');
--        clase_iva IN ('Generado','Descontable') OR NULL; clase_retencion IN ('Renta','IVA','ICA') OR NULL
-- FK lógica: compania_id → companias(id); cuenta_base_id → cuentas(id); parent_id → cuentas(id)
-- UK aislamiento (compania_id, id): la exigen las FK compuestas de
--   lote_lineas, documento_lineas, documentos, saldos_*, acumulados_*,
--   activos y reembolso_lineas (se crea en 02_indices.sql).

-- 7. terceros — clientes, proveedores, empleados, entidades. (ver general/01_entidades.md)
CREATE TABLE terceros (
  id              AUTOINC,
  compania_id     INTEGER       NOT NULL,
  zona            VARCHAR(30),
  nit             VARCHAR(20)   NOT NULL,
  digito          VARCHAR(2)    NOT NULL,
  tipo_documento  VARCHAR(10)   NOT NULL DEFAULT 'NIT',  -- 'NIT' | 'CC' | 'CE' | …
  nombre          VARCHAR(255)  NOT NULL,
  tipo            VARCHAR(30)   NOT NULL DEFAULT 'Juridica',
  direccion       VARCHAR(255),
  telefono        VARCHAR(30),
  ciudad          VARCHAR(255),
  nit_relacionado VARCHAR(20),
  correo          VARCHAR(255),              -- FADCLI
  codigo_legado   VARCHAR(30),               -- identidad original del legado (RECNO/clave)
  estado          VARCHAR(30)   NOT NULL DEFAULT 'Activo',
  motivo_bloqueo  VARCHAR(500),
  fecha_creacion  DATE,
  saldo           NUMERIC(18,2) NOT NULL DEFAULT 0,
  cupo            NUMERIC(18,2) NOT NULL DEFAULT 0,
  sexo            VARCHAR(1),                -- 'M' | 'F' | 'J' | NULL
  nacimiento      DATE,
  estado_web      VARCHAR(30)   NOT NULL DEFAULT 'Inactivo',
  eliminado_en    TIMESTAMP,
  creado_en       TIMESTAMP,
  creado_por      INTEGER,
  actualizado_en  TIMESTAMP,
  actualizado_por INTEGER,
  version         INTEGER       NOT NULL DEFAULT 0
);
-- CHECK: tipo IN ('Natural','Juridica'); estado IN ('Activo','Bloqueado');
--        sexo IN ('M','F','J') OR NULL; estado_web IN ('Activo','Inactivo')
-- FK lógica: compania_id → companias(id)
-- UK aislamiento (compania_id, id): la exigen las FK compuestas de
--   lote_lineas, documento_lineas, documentos, saldos_*, acumulados_*,
--   reembolsos y tercero_cuentas_bancarias (se crea en 02_indices.sql).

-- 8. tercero_etiquetas — etiquetas libres por tercero. (ver general/01_entidades.md)
CREATE TABLE tercero_etiquetas (
  id         AUTOINC,
  tercero_id INTEGER      NOT NULL,
  etiqueta   VARCHAR(100) NOT NULL
);
-- FK lógica: tercero_id → terceros(id) ON DELETE CASCADE (borrado en cascada
--   que ejecuta el servicio)
-- Sin columnas de auditoría (tabla de detalle puro; igual que PostgreSQL).

-- 9. centros_costos — centros de costo jerárquicos. (ver general/01_entidades.md)
CREATE TABLE centros_costos (
  id              AUTOINC,
  compania_id     INTEGER      NOT NULL,
  codigo          VARCHAR(30)  NOT NULL,   -- 'ADM', 'VEN', 'OPE'
  nombre          VARCHAR(255) NOT NULL,
  nivel           INTEGER      NOT NULL DEFAULT 1,
  parent_id       INTEGER,                 -- jerarquía
  eliminado_en    TIMESTAMP,
  creado_en       TIMESTAMP,
  creado_por      INTEGER,
  actualizado_en  TIMESTAMP,
  actualizado_por INTEGER,
  version         INTEGER      NOT NULL DEFAULT 0
);
-- FK lógica: compania_id → companias(id); parent_id → centros_costos(id)
-- UK aislamiento (compania_id, id): la exigen las FK compuestas de
--   lote_lineas, documento_lineas, saldos_cuenta_centro, acumulados_centro,
--   activo_distribuciones y reembolso_lineas (se crea en 02_indices.sql).

-- 10. comprobantes — tipos de comprobante contable. (ver general/01_entidades.md)
CREATE TABLE comprobantes (
  id              AUTOINC,
  compania_id     INTEGER      NOT NULL,
  codigo          VARCHAR(30)  NOT NULL,   -- 'CE', 'RC', 'CP'
  nombre          VARCHAR(255) NOT NULL,
  activo          LOGICAL      NOT NULL DEFAULT TRUE,
  eliminado_en    TIMESTAMP,
  creado_en       TIMESTAMP,
  creado_por      INTEGER,
  actualizado_en  TIMESTAMP,
  actualizado_por INTEGER,
  version         INTEGER      NOT NULL DEFAULT 0
);
-- FK lógica: compania_id → companias(id)
-- UK aislamiento (compania_id, id): la exige la FK compuesta de documentos
--   (compania_id, comprobante_id) — se crea en 02_indices.sql.

-- 11. consecutivos_comprobantes — consecutivo por comprobante/año (fila caliente). (ver general/01_entidades.md)
CREATE TABLE consecutivos_comprobantes (
  id                AUTOINC,
  compania_id       INTEGER NOT NULL,
  anio              INTEGER NOT NULL,
  comprobante_id    INTEGER NOT NULL,
  -- entero_largo → INTEGER (decisión §0.2): consecutivo por comprobante/año;
  -- el rango contable real no se acerca a 2^31. Si un contrato exigiera más:
  -- VARCHAR(18) numérico o dos INTEGER asignados por el servicio (NO DOUBLE).
  consecutivo_actual INTEGER NOT NULL DEFAULT 1,
  consecutivo_fin    INTEGER,             -- tope opcional del rango (NULL = sin tope)
  version            INTEGER NOT NULL DEFAULT 0  -- única columna de auditoría (igual que PostgreSQL)
);
-- CHECK: anio BETWEEN 1900 AND 2999; consecutivo_fin IS NULL OR consecutivo_fin >= consecutivo_actual
-- FK lógica: compania_id → companias(id); comprobante_id → comprobantes(id)
-- Fila MÁS CALIENTE del modelo: se actualiza en cada contabilización dentro
--   de la transacción del servicio (bloqueo de registro ADS); sin índices
--   adicionales (ver 02_indices.sql).

-- 12. tipos_documento — tipos documentales y numeración (VISDOCUM). (ver general/01_entidades.md)
CREATE TABLE tipos_documento (
  id                  AUTOINC,
  compania_id         INTEGER      NOT NULL,
  codigo              VARCHAR(30)  NOT NULL,   -- 'NOM', 'FV', 'OR'
  nombre              VARCHAR(255) NOT NULL,
  numeracion          VARCHAR(10)  NOT NULL DEFAULT 'Manual',
  -- entero_largo → INTEGER (decisión §0.2): mismo criterio que consecutivos_comprobantes.
  consecutivo         INTEGER      NOT NULL DEFAULT 1,
  tercero_obligatorio LOGICAL      NOT NULL DEFAULT FALSE,
  centro_obligatorio  LOGICAL      NOT NULL DEFAULT FALSE,
  eliminado_en        TIMESTAMP,
  creado_en           TIMESTAMP,
  creado_por          INTEGER,
  actualizado_en      TIMESTAMP,
  actualizado_por     INTEGER,
  version             INTEGER      NOT NULL DEFAULT 0
);
-- CHECK: numeracion IN ('Manual','Automatica')
-- FK lógica: compania_id → companias(id)
-- UK aislamiento (compania_id, id): la exigen las FK compuestas de
--   lote_lineas, documento_lineas y documentos (se crea en 02_indices.sql).

-- 13. conceptos_retencion — conceptos de retención en la fuente. (ver general/01_entidades.md)
CREATE TABLE conceptos_retencion (
  id           AUTOINC,
  compania_id  INTEGER      NOT NULL,
  codigo       VARCHAR(30)  NOT NULL,
  nombre       VARCHAR(255) NOT NULL,
  tarifa       NUMERIC(9,6) NOT NULL DEFAULT 0,   -- fracción (0.025 = 2.5 %)
  cuenta_id    INTEGER,                            -- cuenta contable asociada
  base_minima  NUMERIC(18,2) NOT NULL DEFAULT 0,
  eliminado_en TIMESTAMP,
  creado_en    TIMESTAMP,
  creado_por   INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version      INTEGER      NOT NULL DEFAULT 0
);
-- FK lógica: compania_id → companias(id); cuenta_id → cuentas(id)
-- UK aislamiento (compania_id, id): la exigen las FK compuestas (históricas)
--   de lote_lineas, documento_lineas y acumulados_retencion (02_indices.sql).

-- 14. tarifas_iva — tarifas de IVA. (ver general/01_entidades.md)
CREATE TABLE tarifas_iva (
  id           AUTOINC,
  compania_id  INTEGER      NOT NULL,
  codigo       VARCHAR(30)  NOT NULL,   -- 'IV19', 'IV05', 'IVE'
  nombre       VARCHAR(255) NOT NULL,
  tarifa       NUMERIC(9,6) NOT NULL DEFAULT 0,   -- fracción (0.190000 = 19 %)
  cuenta_id    INTEGER,                            -- cuenta contable asociada
  eliminado_en TIMESTAMP,
  creado_en    TIMESTAMP,
  creado_por   INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version      INTEGER      NOT NULL DEFAULT 0
);
-- FK lógica: compania_id → companias(id); cuenta_id → cuentas(id)
-- UK aislamiento (compania_id, id): la exigen las FK compuestas (históricas)
--   de lote_lineas, documento_lineas y acumulados_iva (02_indices.sql).

-- 15. renglones_renta — renglones de la declaración de renta. (ver general/01_entidades.md)
CREATE TABLE renglones_renta (
  id           AUTOINC,
  compania_id  INTEGER      NOT NULL,
  codigo       VARCHAR(30)  NOT NULL,
  nombre       VARCHAR(255) NOT NULL,
  cuenta_id    INTEGER,     -- cuenta asociada
  signo        INTEGER      NOT NULL DEFAULT 1,   -- sentido del renglón
  eliminado_en TIMESTAMP,
  creado_en    TIMESTAMP,
  creado_por   INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version      INTEGER      NOT NULL DEFAULT 0
);
-- CHECK: signo IN (-1, 1)
-- FK lógica: compania_id → companias(id); cuenta_id → cuentas(id)

-- 16. plantillas_contables — plantillas de asiento (PLANTICO/GRABAPLA). (ver general/01_entidades.md)
CREATE TABLE plantillas_contables (
  id                AUTOINC,
  compania_id       INTEGER      NOT NULL,
  codigo            VARCHAR(30)  NOT NULL,
  nombre            VARCHAR(255) NOT NULL,
  tipo_documento_id INTEGER,
  eliminado_en      TIMESTAMP,
  creado_en         TIMESTAMP,
  creado_por        INTEGER,
  actualizado_en    TIMESTAMP,
  actualizado_por   INTEGER,
  version           INTEGER      NOT NULL DEFAULT 0
);
-- FK lógica: compania_id → companias(id); tipo_documento_id → tipos_documento(id)

-- 17. plantilla_lineas — parejas de cuentas de la plantilla (NOM/DEB/CRE). (ver general/01_entidades.md)
CREATE TABLE plantilla_lineas (
  id                AUTOINC,
  plantilla_id      INTEGER      NOT NULL,
  orden             INTEGER      NOT NULL DEFAULT 0,
  cuenta_debito_id  INTEGER,     -- DEB: cuenta débito
  cuenta_credito_id INTEGER,     -- CRE: cuenta crédito
  concepto          VARCHAR(500) -- texto del renglón
);
-- El legado guarda PAREJAS de cuentas, no importes fijos.
-- FK lógica: plantilla_id → plantillas_contables(id) ON DELETE CASCADE (servicio);
--   cuenta_debito_id / cuenta_credito_id → cuentas(id)
-- Sin columnas de auditoría (detalle puro; igual que PostgreSQL).

-- 18. formatos_documentales — formatos de impresión de comprobantes. (ver general/01_entidades.md)
CREATE TABLE formatos_documentales (
  id             AUTOINC,
  compania_id    INTEGER      NOT NULL,
  codigo         VARCHAR(30)  NOT NULL,
  nombre         VARCHAR(255) NOT NULL,
  comprobante_id INTEGER,
  eliminado_en   TIMESTAMP,
  creado_en      TIMESTAMP,
  creado_por     INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version        INTEGER      NOT NULL DEFAULT 0
);
-- FK lógica: compania_id → companias(id); comprobante_id → comprobantes(id)

-- 19. formato_elementos — elementos visuales del formato (editor). (ver general/01_entidades.md)
CREATE TABLE formato_elementos (
  id         AUTOINC,
  formato_id INTEGER      NOT NULL,
  tipo       VARCHAR(30)  NOT NULL,   -- catálogo cerrado (ver CHECK)
  contenido  VARCHAR(500),            -- texto del elemento; si es Imagen, guardar referencia al recurso
  x          NUMERIC(10,2) NOT NULL DEFAULT 0,  -- cantidad: NUMERIC(10,2) igual que PostgreSQL
  y          NUMERIC(10,2) NOT NULL DEFAULT 0,
  ancho      NUMERIC(10,2),
  alto       NUMERIC(10,2),
  fuente     VARCHAR(255),            -- tipografía
  orden      INTEGER      NOT NULL DEFAULT 0    -- Z-order
);
-- CHECK: tipo IN ('Leyenda','Imagen','Rectangulo','Linea','CampoComprobante',
--        'CampoDocumento','CampoFecha','CampoTotal')
-- FK lógica: formato_id → formatos_documentales(id) ON DELETE CASCADE (servicio)
-- Sin columnas de auditoría (detalle puro; igual que PostgreSQL).

-- =====================================================================
-- MÓDULO 3 — MOVIMIENTOS: entidades 20–24 (lotes → documento_lineas)
-- =====================================================================

-- 20. lotes — lotes de captura contable. (ver general/01_entidades.md)
CREATE TABLE lotes (
  id               AUTOINC,
  compania_id      INTEGER       NOT NULL,
  anio             INTEGER       NOT NULL,
  periodo          VARCHAR(2)    NOT NULL,   -- '00'–'18'
  codigo           VARCHAR(30)   NOT NULL,   -- 'NOM2', 'CE-001'
  nombre           VARCHAR(255)  NOT NULL,
  usuario_id       INTEGER       NOT NULL,   -- responsable (FK en 08_seguridad)
  origen           VARCHAR(30)   NOT NULL DEFAULT 'Manual',
  origen_referencia VARCHAR(255),            -- clave estable del origen (archivo/hash de importación)
  fecha            DATE          NOT NULL,
  estado           VARCHAR(30)   NOT NULL DEFAULT 'Borrador',
  comprobante_id   INTEGER,
  documento        VARCHAR(100),             -- documento propuesto 'NOM-2026-02'
  -- uuid → CHARACTER(36): SIN default de motor; el servicio genera el UUID
  -- antes del INSERT (no existe gen_random_uuid() en ADS).
  idempotency_key  CHARACTER(36) NOT NULL,
  motivo           VARCHAR(500),             -- motivo de anulación/rechazo
  creado_en        TIMESTAMP,
  creado_por       INTEGER,
  actualizado_en   TIMESTAMP,
  actualizado_por  INTEGER,
  version          INTEGER       NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999; periodo IN ('00'…'18');
--        estado IN ('Borrador','Con errores','Verificado','Pendiente aprobacion',
--        'Aprobado','Contabilizando','Contabilizado','Fallido','Anulado');
--        origen IN ('Manual','Excel','Nomina','Reembolso',…) — extensible
-- FK lógica: compania_id → companias(id); usuario_id → usuarios(id);
--   comprobante_id → comprobantes(id);
--   (compania_id, anio, periodo) → periodos_contables(compania_id, anio, periodo)
--   (rechaza períodos inexistentes); idempotencia y origen_referencia como UK (02)
-- UK aislamiento (compania_id, id): la exige la FK compuesta de documentos
--   (lote_id) y la trazabilidad lote → documento (se crea en 02_indices.sql).
-- Volumen alto: AUTOINC de 32 bits — vigilar cerca de ~2 100 M de filas.

-- 21. lote_lineas — renglones del lote (grilla editable). (ver general/01_entidades.md)
CREATE TABLE lote_lineas (
  id                   AUTOINC,
  lote_id              INTEGER      NOT NULL,
  compania_id          INTEGER      NOT NULL,  -- aislamiento (B05)
  numero_linea         INTEGER      NOT NULL,
  cuenta_id            INTEGER,
  tercero_id           INTEGER,
  centro_costo_id      INTEGER,
  tipo_documento_id    INTEGER,
  comprobante          VARCHAR(30),            -- código de comprobante (texto)
  documento            VARCHAR(100),
  fecha                DATE,
  fecha_documento      DATE,                   -- TFECDOC
  debito               NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito              NUMERIC(18,2) NOT NULL DEFAULT 0,
  base                 NUMERIC(18,2) NOT NULL DEFAULT 0,
  clase                VARCHAR(30)   NOT NULL DEFAULT '',
  concepto_retencion_id INTEGER,               -- concepto histórico por renglón
  tarifa_iva_id        INTEGER,                -- tarifa histórica por renglón
  documento_afectado   VARCHAR(100),
  concepto             VARCHAR(500),
  valor_moneda         NUMERIC(18,2),          -- TVALORUS (moneda alterna)
  nit_alterno          VARCHAR(20),            -- NITN (tercero alterno)
  archivo_origen       VARCHAR(255),           -- TARCHI (procedencia)
  origen               VARCHAR(30)   NOT NULL DEFAULT 'Manual'
);
-- CHECK: debito >= 0; credito >= 0; debito = 0 OR credito = 0 (nunca ambos);
--        clase IN ('IVA','Retencion','Otro','')
-- FK lógica: lote_id → lotes(id) ON DELETE CASCADE (servicio);
--   compania_id → companias(id);
--   (compania_id, cuenta_id) → cuentas(compania_id, id);
--   (compania_id, tercero_id) → terceros(compania_id, id);
--   (compania_id, centro_costo_id) → centros_costos(compania_id, id);
--   (compania_id, tipo_documento_id) → tipos_documento(compania_id, id);
--   (compania_id, concepto_retencion_id) → conceptos_retencion(compania_id, id);
--   (compania_id, tarifa_iva_id) → tarifas_iva(compania_id, id)
-- Sin columnas de auditoría (igual que PostgreSQL). Volumen alto: AUTOINC 32 bits.

-- 22. lote_validaciones — issues del centro de validación. (ver general/01_entidades.md)
CREATE TABLE lote_validaciones (
  id         AUTOINC,
  lote_id    INTEGER      NOT NULL,
  linea_id   INTEGER,                -- nulo si el issue es global
  severidad  VARCHAR(30)  NOT NULL,
  ambito     VARCHAR(30)  NOT NULL,
  tipo       VARCHAR(30)  NOT NULL,  -- 'Tercero obligatorio', 'Descuadre', …
  mensaje    VARCHAR(500) NOT NULL,
  campo      VARCHAR(30),            -- 'tercero', 'centro', 'cuenta'…
  resuelta   LOGICAL      NOT NULL DEFAULT FALSE
);
-- CHECK: severidad IN ('Error','Advertencia');
--        ambito IN ('Global','Documento','Comprobante','Linea')
-- FK lógica: lote_id → lotes(id) ON DELETE CASCADE (servicio);
--   linea_id → lote_lineas(id) ON DELETE CASCADE (servicio)
-- Sin columnas de auditoría (igual que PostgreSQL).

-- 23. documentos — comprobantes contabilizados (el libro mayor). (ver general/01_entidades.md)
CREATE TABLE documentos (
  id                    AUTOINC,
  compania_id           INTEGER       NOT NULL,
  anio                  INTEGER       NOT NULL,
  comprobante_id        INTEGER       NOT NULL,
  -- entero_largo → INTEGER (decisión §0.2): consecutivo del libro 'CE-000245'.
  -- Es el contador que más crece del modelo; INTEGER admite ~2 100 M por
  -- comprobante/año (en la práctica el límite lo pone antes el AUTOINC de id).
  -- Escalar solo por contrato: VARCHAR(18) numérico o secuencia de servicio.
  numero                INTEGER       NOT NULL,
  documento             VARCHAR(100),            -- 'NOM-2026-02'
  tipo_documento_id     INTEGER,                 -- tipo documental en el libro
  fecha                 DATE          NOT NULL,
  fecha_documento       DATE,
  periodo               VARCHAR(2)    NOT NULL,
  tercero_id            INTEGER,
  concepto              VARCHAR(500),
  estado                VARCHAR(30)   NOT NULL DEFAULT 'Contabilizado',
  -- Procedencia del documento. El legado no lleva documentos propios de este
  -- modelo: su historia entra marcada como 'Migracion' y eso la exime de la
  -- UK parcial documentos_contabilizado_uk (ver 02_indices.sql), porque la
  -- etiqueta DDOCUM del legado no es única por año.
  origen                VARCHAR(30)   NOT NULL DEFAULT 'Manual',
  lote_id               INTEGER,                 -- trazabilidad
  usuario_id            INTEGER       NOT NULL,  -- FK en 08_seguridad
  -- uuid → CHARACTER(36) sin default de motor (servicio genera el UUID).
  idempotency_key       CHARACTER(36) NOT NULL,
  documento_original_id INTEGER,                 -- original ↔ reversión
  motivo_anulacion      VARCHAR(500),
  soporte_anulacion     VARCHAR(100),
  creado_en             TIMESTAMP,
  creado_por            INTEGER,
  actualizado_en        TIMESTAMP,
  actualizado_por       INTEGER,
  version               INTEGER       NOT NULL DEFAULT 0,
  -- Columna DERIVADA solo-ADS (no existe en PostgreSQL): emula la UK parcial
  -- "un documento solo puede estar Contabilizado una vez" (mapeo_motores §3:
  -- ADS no soporta índices parciales). Valor: documento || '|' || estado;
  -- debe ser NULL cuando origen = 'Migracion' (esa historia queda fuera de la
  -- UK parcial en PostgreSQL). La mantiene el trigger del diccionario o el
  -- servicio en cada INSERT/UPDATE.
  -- Si documento es NULL, documento_estado es NULL (verificar semántica de
  -- NULLs del índice único en Data Architect). Ver 02_indices.sql.
  documento_estado      VARCHAR(120)
);
-- CHECK: anio BETWEEN 1900 AND 2999; periodo IN ('00'…'18');
--        estado IN ('Contabilizado','Anulado')
-- FK lógica: compania_id → companias(id);
--   (compania_id, comprobante_id) → comprobantes(compania_id, id);
--   (compania_id, tipo_documento_id) → tipos_documento(compania_id, id);
--   (compania_id, tercero_id) → terceros(compania_id, id);
--   (compania_id, lote_id) → lotes(compania_id, id);
--   usuario_id → usuarios(id); documento_original_id → documentos(id)
-- Regla de negocio (UK parcial, emulada con documento_estado): un mismo
--   documento solo existe UNA vez en estado Contabilizado, salvo la historia
--   migrada (origen = 'Migracion').
-- UK aislamiento (compania_id, id): la exige la FK compuesta de
--   documento_lineas (documento_id) (se crea en 02_indices.sql).
-- Volumen alto: AUTOINC de 32 bits — vigilar cerca de ~2 100 M de filas.
-- El libro es inmutable: toda corrección es anulación + nuevo asiento (servicio).

-- 24. documento_lineas — renglones del libro (espejo histórico del lote). (ver general/01_entidades.md)
CREATE TABLE documento_lineas (
  id                   AUTOINC,
  documento_id         INTEGER      NOT NULL,
  compania_id          INTEGER      NOT NULL,  -- aislamiento (B05)
  numero_linea         INTEGER      NOT NULL,
  cuenta_id            INTEGER      NOT NULL,
  tercero_id           INTEGER,
  centro_costo_id      INTEGER,
  tipo_documento_id    INTEGER,               -- TIPODOC por renglón
  debito               NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito              NUMERIC(18,2) NOT NULL DEFAULT 0,
  base                 NUMERIC(18,2) NOT NULL DEFAULT 0,
  clase                VARCHAR(30)   NOT NULL DEFAULT '',
  concepto_retencion_id INTEGER,              -- concepto histórico
  tarifa_iva_id        INTEGER,               -- tarifa histórica
  fecha_documento      DATE,                  -- TFECDOC
  valor_moneda         NUMERIC(18,2),         -- TVALORUS
  nit_alterno          VARCHAR(20),           -- NITN
  documento_afectado   VARCHAR(100),
  concepto             VARCHAR(500),
  archivo_origen       VARCHAR(255),          -- TARCHI
  origen               VARCHAR(30)   NOT NULL DEFAULT 'Manual'
);
-- CHECK: debito >= 0; credito >= 0; debito = 0 OR credito = 0 (nunca ambos);
--        clase IN ('IVA','Retencion','Otro','')
-- FK lógica: documento_id → documentos(id); compania_id → companias(id);
--   (compania_id, cuenta_id) → cuentas(compania_id, id);
--   (compania_id, tercero_id) → terceros(compania_id, id);
--   (compania_id, centro_costo_id) → centros_costos(compania_id, id);
--   (compania_id, tipo_documento_id) → tipos_documento(compania_id, id);
--   (compania_id, concepto_retencion_id) → conceptos_retencion(compania_id, id);
--   (compania_id, tarifa_iva_id) → tarifas_iva(compania_id, id)
-- Sin columnas de auditoría: espejo inmutable del libro; no se edita.
-- Volumen MUY alto: AUTOINC de 32 bits — vigilar cerca de ~2 100 M de filas.

-- =====================================================================
-- MÓDULO 4 — SALDOS Y ACUMULADOS: entidades 25–32 (derivados, regenerables)
-- =====================================================================
-- Tablas derivadas del libro: se reconstruyen con el proceso de regeneración
-- del servicio; jamás se editan a mano. Sin columnas de auditoría en
-- PostgreSQL → aquí tampoco (consistencia verificada contra los .sql).

-- 25. saldos_cuenta — saldo por cuenta y período. (ver general/01_entidades.md)
CREATE TABLE saldos_cuenta (
  id            AUTOINC,
  compania_id   INTEGER       NOT NULL,
  anio          INTEGER       NOT NULL,
  periodo       VARCHAR(2)    NOT NULL,
  cuenta_id     INTEGER       NOT NULL,
  saldo_inicial NUMERIC(18,2) NOT NULL DEFAULT 0,
  debito        NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito       NUMERIC(18,2) NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999; periodo IN ('00'…'18')
-- FK lógica: compania_id → companias(id);
--   (compania_id, cuenta_id) → cuentas(compania_id, id)
-- Fila caliente: se actualiza (HOT) en cada contabilización.

-- 26. saldos_cuenta_tercero — saldo por cuenta + tercero + período. (ver general/01_entidades.md)
CREATE TABLE saldos_cuenta_tercero (
  id          AUTOINC,
  compania_id INTEGER       NOT NULL,
  anio        INTEGER       NOT NULL,
  periodo     VARCHAR(2)    NOT NULL,
  cuenta_id   INTEGER       NOT NULL,
  tercero_id  INTEGER       NOT NULL,
  debito      NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito     NUMERIC(18,2) NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999
-- FK lógica: compania_id → companias(id);
--   (compania_id, cuenta_id) → cuentas(compania_id, id);
--   (compania_id, tercero_id) → terceros(compania_id, id)
-- Fila caliente: se actualiza en cada contabilización.

-- 27. saldos_cuenta_centro — saldo por cuenta + centro + período. (ver general/01_entidades.md)
CREATE TABLE saldos_cuenta_centro (
  id              AUTOINC,
  compania_id     INTEGER       NOT NULL,
  anio            INTEGER       NOT NULL,
  periodo         VARCHAR(2)    NOT NULL,
  cuenta_id       INTEGER       NOT NULL,
  centro_costo_id INTEGER       NOT NULL,
  debito          NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito         NUMERIC(18,2) NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999
-- FK lógica: compania_id → companias(id);
--   (compania_id, cuenta_id) → cuentas(compania_id, id);
--   (compania_id, centro_costo_id) → centros_costos(compania_id, id)
-- Fila caliente: se actualiza en cada contabilización.

-- 28. acumulados_tercero — acumulado anual por tercero + cuenta. (ver general/01_entidades.md)
CREATE TABLE acumulados_tercero (
  id          AUTOINC,
  compania_id INTEGER       NOT NULL,
  anio        INTEGER       NOT NULL,
  tercero_id  INTEGER       NOT NULL,
  cuenta_id   INTEGER       NOT NULL,
  debito      NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito     NUMERIC(18,2) NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999
-- FK lógica: compania_id → companias(id);
--   (compania_id, tercero_id) → terceros(compania_id, id);
--   (compania_id, cuenta_id) → cuentas(compania_id, id)

-- 29. acumulados_centro — acumulado anual por centro + cuenta. (ver general/01_entidades.md)
CREATE TABLE acumulados_centro (
  id              AUTOINC,
  compania_id     INTEGER       NOT NULL,
  anio            INTEGER       NOT NULL,
  centro_costo_id INTEGER       NOT NULL,
  cuenta_id       INTEGER       NOT NULL,
  debito          NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito         NUMERIC(18,2) NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999
-- FK lógica: compania_id → companias(id);
--   (compania_id, centro_costo_id) → centros_costos(compania_id, id);
--   (compania_id, cuenta_id) → cuentas(compania_id, id)

-- 30. acumulados_retencion — retención acumulada por tercero/concepto/período. (ver general/01_entidades.md)
CREATE TABLE acumulados_retencion (
  id                    AUTOINC,
  compania_id           INTEGER       NOT NULL,
  anio                  INTEGER       NOT NULL,
  periodo               VARCHAR(2)    NOT NULL,
  tercero_id            INTEGER       NOT NULL,
  concepto_retencion_id INTEGER       NOT NULL,
  base                  NUMERIC(18,2) NOT NULL DEFAULT 0,
  valor                 NUMERIC(18,2) NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999
-- FK lógica: compania_id → companias(id);
--   (compania_id, tercero_id) → terceros(compania_id, id);
--   (compania_id, concepto_retencion_id) → conceptos_retencion(compania_id, id)

-- 31. acumulados_iva — IVA acumulado por tercero/tarifa/período. (ver general/01_entidades.md)
CREATE TABLE acumulados_iva (
  id            AUTOINC,
  compania_id   INTEGER       NOT NULL,
  anio          INTEGER       NOT NULL,
  periodo       VARCHAR(2)    NOT NULL,
  tercero_id    INTEGER       NOT NULL,
  tarifa_iva_id INTEGER       NOT NULL,
  base          NUMERIC(18,2) NOT NULL DEFAULT 0,
  valor         NUMERIC(18,2) NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999
-- FK lógica: compania_id → companias(id);
--   (compania_id, tercero_id) → terceros(compania_id, id);
--   (compania_id, tarifa_iva_id) → tarifas_iva(compania_id, id)

-- 32. estado_acumulaciones — último período acumulado por tipo. (ver general/01_entidades.md)
CREATE TABLE estado_acumulaciones (
  id                 AUTOINC,
  compania_id        INTEGER     NOT NULL,
  anio               INTEGER     NOT NULL,
  tipo               VARCHAR(30) NOT NULL,
  periodo_hasta      VARCHAR(2)  NOT NULL,
  -- TIMESTAMP NOT NULL; sin default de motor (NOW() no es literal DDL):
  -- lo asigna el servicio o el trigger del diccionario en el INSERT.
  ultima_acumulacion TIMESTAMP   NOT NULL
);
-- CHECK: anio BETWEEN 1900 AND 2999; tipo IN ('Retencion','Iva','Terceros','Centros')
-- FK lógica: compania_id → companias(id)
-- La UI avisa si quedó desactualizada (periodo_hasta < último período del libro).

-- =====================================================================
-- MÓDULO 5 — IMPUESTOS (medios magnéticos): entidades 33–39
-- =====================================================================

-- 33. formatos_exogenos — formatos de información exógena (1001, 1007, 2275…). (ver general/01_entidades.md)
CREATE TABLE formatos_exogenos (
  id           AUTOINC,
  compania_id  INTEGER      NOT NULL,
  codigo       VARCHAR(30)  NOT NULL,
  nombre       VARCHAR(255) NOT NULL,
  vigencia     INTEGER      NOT NULL,
  activo       LOGICAL      NOT NULL DEFAULT TRUE,
  eliminado_en TIMESTAMP,
  creado_en    TIMESTAMP,
  creado_por   INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version      INTEGER      NOT NULL DEFAULT 0
);
-- FK lógica: compania_id → companias(id)

-- 34. formato_conceptos — conceptos de un formato (tarifa/cuenta). (ver general/01_entidades.md)
CREATE TABLE formato_conceptos (
  id         AUTOINC,
  formato_id INTEGER      NOT NULL,
  codigo     VARCHAR(30)  NOT NULL,
  nombre     VARCHAR(255) NOT NULL,
  tarifa     NUMERIC(9,6) NOT NULL DEFAULT 0,
  cuenta_id  INTEGER
);
-- FK lógica: formato_id → formatos_exogenos(id) ON DELETE CASCADE (servicio);
--   cuenta_id → cuentas(id)
-- Sin columnas de auditoría (igual que PostgreSQL).

-- 35. formato_asignaciones — cuentas del plan asignadas a un formato. (ver general/01_entidades.md)
CREATE TABLE formato_asignaciones (
  id         AUTOINC,
  formato_id INTEGER NOT NULL,
  cuenta_id  INTEGER NOT NULL,
  activo     LOGICAL NOT NULL DEFAULT TRUE
);
-- FK lógica: formato_id → formatos_exogenos(id) ON DELETE CASCADE (servicio);
--   cuenta_id → cuentas(id)
-- Sin columnas de auditoría (igual que PostgreSQL).

-- 36. generaciones_medios — generaciones de medios por compañía/año. (ver general/01_entidades.md)
CREATE TABLE generaciones_medios (
  id                AUTOINC,
  compania_id       INTEGER     NOT NULL,
  anio              INTEGER     NOT NULL,
  numero_generacion INTEGER     NOT NULL DEFAULT 1,
  parametros        MEMO        NOT NULL,  -- JSON; servicio inserta '{}'
  estado            VARCHAR(30) NOT NULL DEFAULT 'Generado',
  generado_por      INTEGER,
  generado_en       TIMESTAMP,
  -- Auditoría PARCIAL (igual que PostgreSQL): sin creado_en/creado_por;
  -- solo actualizado_en/actualizado_por/version (B08: numero_generacion es
  -- la identidad; version es el control optimista).
  actualizado_en    TIMESTAMP,
  actualizado_por   INTEGER,
  version           INTEGER     NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999; estado IN ('Generado','Revisado','Exportado')
-- FK lógica: compania_id → companias(id)

-- 37. medio_filas — filas del medio generado (revisión editable). (ver general/01_entidades.md)
CREATE TABLE medio_filas (
  id            AUTOINC,
  generacion_id INTEGER       NOT NULL,
  formato_id    INTEGER       NOT NULL,
  tercero_id    INTEGER,
  concepto_id   INTEGER,
  cuenta_id     INTEGER,
  valor         NUMERIC(18,2) NOT NULL DEFAULT 0,
  base          NUMERIC(18,2) NOT NULL DEFAULT 0,
  ajustado      LOGICAL       NOT NULL DEFAULT FALSE,
  detalle       MEMO          NOT NULL   -- JSON; servicio inserta '{}'
);
-- FK lógica: generacion_id → generaciones_medios(id) ON DELETE CASCADE (servicio);
--   formato_id → formatos_exogenos(id); tercero_id → terceros(id);
--   concepto_id → formato_conceptos(id); cuenta_id → cuentas(id)
-- Sin columnas de auditoría (igual que PostgreSQL).

-- 38. medio_topes — topes de depuración por formato/concepto. (ver general/01_entidades.md)
CREATE TABLE medio_topes (
  id          AUTOINC,
  compania_id INTEGER       NOT NULL,
  anio        INTEGER       NOT NULL,
  formato_id  INTEGER       NOT NULL,
  concepto_id INTEGER,      -- NULL = tope para todo el formato
  tope        NUMERIC(18,2) NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999
-- FK lógica: compania_id → companias(id); formato_id → formatos_exogenos(id);
--   concepto_id → formato_conceptos(id)
-- Sin columnas de auditoría (igual que PostgreSQL).

-- 39. medio_conciliaciones — conciliación de una generación. (ver general/01_entidades.md)
CREATE TABLE medio_conciliaciones (
  id              AUTOINC,
  generacion_id   INTEGER       NOT NULL,
  total_contable  NUMERIC(18,2) NOT NULL DEFAULT 0,
  exclusiones     NUMERIC(18,2) NOT NULL DEFAULT 0,
  topes           NUMERIC(18,2) NOT NULL DEFAULT 0,
  ajustes         NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_reportado NUMERIC(18,2) NOT NULL DEFAULT 0,
  cuadrado        LOGICAL       NOT NULL DEFAULT TRUE
);
-- Regla de cuadratura (servicio): total_contable − exclusiones − topes
--   + ajustes = total_reportado; cuadrado refleja la igualdad.
-- FK lógica: generacion_id → generaciones_medios(id) ON DELETE CASCADE (servicio)
-- Sin columnas de auditoría (igual que PostgreSQL).

-- =====================================================================
-- MÓDULO 6 — PROCESOS: entidades 40–44 (reprocesos, cierres, consolidación)
-- =====================================================================

-- 40. procesos — reprocesos, revalorizaciones y auditorías masivas. (ver general/01_entidades.md)
CREATE TABLE procesos (
  id                  AUTOINC,
  compania_id         INTEGER     NOT NULL,
  anio                INTEGER     NOT NULL,
  tipo                VARCHAR(30) NOT NULL,  -- 'Reproceso mensual', 'Revalorizacion', …
  estado              VARCHAR(30) NOT NULL DEFAULT 'Configurado',
  alcance             MEMO        NOT NULL,  -- JSON; servicio inserta '{}'
  simulacion          MEMO        NOT NULL,  -- JSON; servicio inserta '{}'
  reporte_diferencias MEMO        NOT NULL,  -- JSON; servicio inserta '{}'
  respaldo_realizado  LOGICAL     NOT NULL DEFAULT FALSE,
  resultado           MEMO        NOT NULL,  -- JSON; servicio inserta '{}'
  usuario_id          INTEGER     NOT NULL,
  creado_en           TIMESTAMP,
  creado_por          INTEGER,
  actualizado_en      TIMESTAMP,
  actualizado_por     INTEGER,
  version             INTEGER     NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999; estado IN ('Configurado','Simulado',
--        'Ejecutando','Completado','Fallido')
-- FK lógica: compania_id → companias(id); usuario_id → usuarios(id)

-- 41. cierres — cierres contables (checklist + comprobante de cierre). (ver general/01_entidades.md)
CREATE TABLE cierres (
  id                  AUTOINC,
  compania_id         INTEGER       NOT NULL,
  anio                INTEGER       NOT NULL,
  estado              VARCHAR(30)   NOT NULL DEFAULT 'Pendiente',
  checklist           MEMO          NOT NULL,  -- JSON; servicio inserta '{}'
  comprobante_id      INTEGER,
  cuenta_resultado_id INTEGER,
  documento           VARCHAR(100),
  fecha               DATE,
  usuario_id          INTEGER       NOT NULL,
  creado_en           TIMESTAMP,
  creado_por          INTEGER,
  actualizado_en      TIMESTAMP,
  actualizado_por     INTEGER,
  version             INTEGER       NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999; estado IN ('Pendiente','Ejecutado','Anulado')
-- FK lógica: compania_id → companias(id); comprobante_id → comprobantes(id);
--   cuenta_resultado_id → cuentas(id); usuario_id → usuarios(id)

-- 42. cierre_traslados — traslados de períodos 13–18 a 01–06. (ver general/01_entidades.md)
CREATE TABLE cierre_traslados (
  id              AUTOINC,
  cierre_id       INTEGER       NOT NULL,
  origen_periodo  VARCHAR(2)    NOT NULL,   -- '13'–'18'
  destino_periodo VARCHAR(2)    NOT NULL,   -- '01'–'06'
  cuenta_id       INTEGER,
  debito          NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito         NUMERIC(18,2) NOT NULL DEFAULT 0
);
-- CHECK: debito >= 0; credito >= 0
-- FK lógica: cierre_id → cierres(id) ON DELETE CASCADE (servicio);
--   cuenta_id → cuentas(id)
-- Sin columnas de auditoría (igual que PostgreSQL).

-- 43. consolidaciones — consolidación multiempresa. (ver general/01_entidades.md)
CREATE TABLE consolidaciones (
  id                   AUTOINC,
  compania_destino_id  INTEGER     NOT NULL,  -- destino solo-consolidación
  anio                 INTEGER     NOT NULL,
  estado               VARCHAR(30) NOT NULL DEFAULT 'Configurado',
  compatibilidad       MEMO        NOT NULL,  -- JSON; servicio inserta '{}'
  simulacion           MEMO        NOT NULL,  -- JSON; servicio inserta '{}'
  respaldo_realizado   LOGICAL     NOT NULL DEFAULT FALSE,
  confirmacion_vaciado LOGICAL     NOT NULL DEFAULT FALSE,
  ejecutado_por        INTEGER,
  ejecutado_en         TIMESTAMP,
  creado_en            TIMESTAMP,
  creado_por           INTEGER,
  actualizado_en       TIMESTAMP,
  actualizado_por      INTEGER,
  version              INTEGER     NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999; estado IN ('Configurado','Simulado',
--        'Ejecutado','Anulado')
-- FK lógica: compania_destino_id → companias(id); ejecutado_por → usuarios(id)

-- 44. consolidacion_origenes — compañías origen de una consolidación. (ver general/01_entidades.md)
CREATE TABLE consolidacion_origenes (
  id                 AUTOINC,
  consolidacion_id   INTEGER NOT NULL,
  compania_origen_id INTEGER NOT NULL,
  incluida           LOGICAL NOT NULL DEFAULT TRUE
);
-- FK lógica: consolidacion_id → consolidaciones(id) ON DELETE CASCADE (servicio);
--   compania_origen_id → companias(id)
-- Sin columnas de auditoría (igual que PostgreSQL).

-- =====================================================================
-- MÓDULO 7 — SEGURIDAD: entidades 45–51 (roles → usuario_companias)
-- =====================================================================
-- Tablas transversales: roles, permisos y usuarios NO llevan compania_id
-- (00_convenciones §4); el acceso a compañías se modela en usuario_companias.

-- 45. roles — roles del sistema. (ver general/01_entidades.md)
CREATE TABLE roles (
  id          AUTOINC,
  codigo      VARCHAR(30)  NOT NULL,   -- 'ADMIN', 'CONTADOR'
  nombre      VARCHAR(255) NOT NULL,
  descripcion VARCHAR(500)
);
-- Sin columnas de auditoría (igual que PostgreSQL).

-- 46. permisos — permisos funcionales. (ver general/01_entidades.md)
CREATE TABLE permisos (
  id     AUTOINC,
  codigo VARCHAR(30)  NOT NULL,   -- 'mov.lotes.aprobar'
  nombre VARCHAR(255) NOT NULL,
  modulo VARCHAR(30)  NOT NULL
);
-- Sin columnas de auditoría (igual que PostgreSQL).

-- 47. rol_permisos — permisos por rol. (ver general/01_entidades.md)
CREATE TABLE rol_permisos (
  rol_id     INTEGER NOT NULL,
  permiso_id INTEGER NOT NULL
);
-- Sin columna id (igual que PostgreSQL y que general/01_entidades.md): es
-- el catálogo intermedio puro; su PK real es el índice único
-- (rol_id, permiso_id) que se crea en 02_indices.sql.
-- FK lógica: rol_id → roles(id) ON DELETE CASCADE (servicio);
--   permiso_id → permisos(id) ON DELETE CASCADE (servicio)
-- Sin columnas de auditoría (igual que PostgreSQL).

-- 48. usuarios — usuarios del sistema. (ver general/01_entidades.md)
CREATE TABLE usuarios (
  id           AUTOINC,
  nombre       VARCHAR(255) NOT NULL,
  email        VARCHAR(255),          -- opcional (NULL)
  rol_id       INTEGER      NOT NULL,
  iniciales    VARCHAR(10),           -- iniciales para sellos
  activo       LOGICAL      NOT NULL DEFAULT TRUE,
  eliminado_en TIMESTAMP,
  creado_en    TIMESTAMP,
  creado_por   INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version      INTEGER      NOT NULL DEFAULT 0
);
-- FK lógica: rol_id → roles(id)
-- UK (email) en 02: OJO — email admite NULL; verificar en Data Architect si
--   el índice único acepta varios NULL; si no, el servicio guarda '' (vacío).

-- 49. auditoria — bitácora de acciones sensibles (inmutable). (ver general/01_entidades.md)
CREATE TABLE auditoria (
  id          AUTOINC,
  compania_id INTEGER,               -- NULL si la acción es global
  anio        INTEGER,
  usuario_id  INTEGER,
  rol_id      INTEGER,
  accion      VARCHAR(500) NOT NULL, -- 'Aprobación de lote'
  modulo      VARCHAR(30)  NOT NULL, -- 'Lotes'
  detalle     VARCHAR(500),
  resultado   VARCHAR(30)  NOT NULL DEFAULT 'EXITO',
  parametros  MEMO         NOT NULL, -- JSON; servicio inserta '{}'
  impacto     MEMO         NOT NULL, -- JSON; servicio inserta '{}'
  motivo      VARCHAR(500),
  -- Única columna de auditoría propia (igual que PostgreSQL): momento exacto.
  -- TIMESTAMP NOT NULL sin default de motor: lo asigna el servicio o el
  -- trigger del diccionario (equivalente a DEFAULT now() en PostgreSQL).
  creado_en   TIMESTAMP    NOT NULL
);
-- CHECK: resultado IN ('EXITO','FALLO','INFO')
-- FK lógica: compania_id → companias(id); usuario_id → usuarios(id);
--   rol_id → roles(id)
-- REGLA: bitácora append-only — el servicio no permite UPDATE ni DELETE;
--   respaldar con permisos del diccionario (Rights) y política de servicio.

-- 50. integraciones — sincronización con módulos externos. (ver general/01_entidades.md)
CREATE TABLE integraciones (
  id                    AUTOINC,
  compania_id           INTEGER     NOT NULL,
  modulo                VARCHAR(30) NOT NULL,   -- 'Facturacion', 'Cartera'
  estado                VARCHAR(30) NOT NULL DEFAULT 'Desconectado',
  ultima_sincronizacion TIMESTAMP,
  configuracion         MEMO        NOT NULL,   -- JSON; servicio inserta '{}'
  -- Auditoría PARCIAL (igual que PostgreSQL): sin creado_en/creado_por;
  -- solo actualizado_en/actualizado_por/version.
  actualizado_en        TIMESTAMP,
  actualizado_por       INTEGER,
  version               INTEGER     NOT NULL DEFAULT 0
);
-- CHECK: estado IN ('Conectado','Desconectado','Bloqueado')
-- FK lógica: compania_id → companias(id)

-- 51. usuario_companias — acceso de usuarios a compañías (B14). (ver general/01_entidades.md)
CREATE TABLE usuario_companias (
  id          AUTOINC,
  usuario_id  INTEGER NOT NULL,
  compania_id INTEGER NOT NULL
);
-- FK lógica: usuario_id → usuarios(id) ON DELETE CASCADE (servicio);
--   compania_id → companias(id) ON DELETE CASCADE (servicio)
-- Sin columnas de auditoría (igual que PostgreSQL).

-- =====================================================================
-- MÓDULO 8 — PRESUPUESTO: entidades 52–54 (feature flag, jerárquico)
-- =====================================================================

-- 52. presupuestos — presupuestos por compañía/año. (ver general/01_entidades.md)
CREATE TABLE presupuestos (
  id           AUTOINC,
  compania_id  INTEGER      NOT NULL,
  anio         INTEGER      NOT NULL,
  nombre       VARCHAR(255) NOT NULL,
  estado       VARCHAR(30)  NOT NULL DEFAULT 'Borrador',
  creado_en    TIMESTAMP,
  creado_por   INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version      INTEGER      NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999; estado IN ('Borrador','Aprobado')
-- FK lógica: compania_id → companias(id)

-- 53. presupuesto_rubros — estructura Departamento → Grupo → Sección → Código. (ver general/01_entidades.md)
CREATE TABLE presupuesto_rubros (
  id              AUTOINC,
  presupuesto_id  INTEGER      NOT NULL,
  departamento    VARCHAR(30)  NOT NULL,   -- nivel 1
  grupo           VARCHAR(30)  NOT NULL,   -- nivel 2
  seccion         VARCHAR(30)  NOT NULL,   -- nivel 3
  codigo          VARCHAR(30)  NOT NULL,   -- nivel 4
  nombre          VARCHAR(255) NOT NULL DEFAULT '',  -- concepto del rubro (B13)
  concepto        VARCHAR(500) NOT NULL DEFAULT '',
  centro_costo_id INTEGER,                -- NULL = rubro sin centro
  parent_id       INTEGER,                -- jerarquía
  orden           INTEGER      NOT NULL DEFAULT 0
);
-- FK lógica: presupuesto_id → presupuestos(id) ON DELETE CASCADE (servicio);
--   centro_costo_id → centros_costos(id); parent_id → presupuesto_rubros(id)
-- Sin columnas de auditoría (igual que PostgreSQL).
-- OJO: la UK (presupuesto_id, codigo, centro_costo_id) incluye columna NULL;
--   verificar en Data Architect la semántica de NULL del índice único (02).

-- 54. presupuesto_valores — valores por rubro/período (presupuesto o ejecución). (ver general/01_entidades.md)
CREATE TABLE presupuesto_valores (
  id       AUTOINC,
  rubro_id INTEGER       NOT NULL,
  periodo  VARCHAR(2)    NOT NULL,   -- '00'–'13'
  tipo     VARCHAR(30)   NOT NULL DEFAULT 'Presupuesto',
  valor    NUMERIC(18,2) NOT NULL DEFAULT 0
);
-- CHECK: periodo IN ('00'–'13'); tipo IN ('Presupuesto','Ejecucion')
-- FK lógica: rubro_id → presupuesto_rubros(id) ON DELETE CASCADE (servicio)
-- Sin columnas de auditoría (igual que PostgreSQL).

-- =====================================================================
-- MÓDULO 9 — AMPLIACIONES: entidades 55–60 (bancos, reembolsos, activos)
-- =====================================================================

-- 55. tercero_cuentas_bancarias — cuentas bancarias de terceros (ADMCUENTA). (ver general/01_entidades.md)
CREATE TABLE tercero_cuentas_bancarias (
  id          AUTOINC,
  compania_id INTEGER      NOT NULL,
  tercero_id  INTEGER      NOT NULL,
  tipo        VARCHAR(30)  NOT NULL DEFAULT 'Ahorros',
  numero      VARCHAR(30)  NOT NULL,   -- texto: preserva ceros iniciales
  principal   LOGICAL      NOT NULL DEFAULT FALSE,
  observacion VARCHAR(255),
  creado_en   TIMESTAMP,
  creado_por  INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version     INTEGER      NOT NULL DEFAULT 0
);
-- CHECK: tipo IN ('Ahorros','Corriente','Otro')
-- FK lógica: compania_id → companias(id);
--   (compania_id, tercero_id) → terceros(compania_id, id)

-- 56. reembolsos — reembolsos de caja menor (REEMBOL01). (ver general/01_entidades.md)
CREATE TABLE reembolsos (
  id            AUTOINC,
  compania_id   INTEGER       NOT NULL,
  anio          INTEGER       NOT NULL,
  numero        VARCHAR(30)   NOT NULL,   -- número del reembolso
  fecha         DATE          NOT NULL,
  periodo       VARCHAR(2)    NOT NULL,
  tercero_id    INTEGER       NOT NULL,
  caja_menor    VARCHAR(100),             -- caja menor origen
  estado        VARCHAR(30)   NOT NULL DEFAULT 'Borrador',
  lote_id       INTEGER,                  -- lote generado al aplicar
  usuario_id    INTEGER       NOT NULL,
  creado_en     TIMESTAMP,
  creado_por    INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version       INTEGER       NOT NULL DEFAULT 0
);
-- CHECK: anio BETWEEN 1900 AND 2999; estado IN ('Borrador','Aplicado','Anulado')
-- FK lógica: compania_id → companias(id);
--   (compania_id, tercero_id) → terceros(compania_id, id);
--   usuario_id → usuarios(id); lote_id → lotes(id)

-- 57. reembolso_lineas — detalle del reembolso. (ver general/01_entidades.md)
CREATE TABLE reembolso_lineas (
  id               AUTOINC,
  reembolso_id     INTEGER       NOT NULL,
  compania_id      INTEGER       NOT NULL,
  numero_linea     INTEGER       NOT NULL,
  cuenta_id        INTEGER       NOT NULL,
  centro_costo_id  INTEGER,
  concepto         VARCHAR(500),
  debito           NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito          NUMERIC(18,2) NOT NULL DEFAULT 0,
  documento_soporte VARCHAR(100)
);
-- CHECK: debito >= 0; credito >= 0; debito = 0 OR credito = 0 (nunca ambos)
-- FK lógica: reembolso_id → reembolsos(id) ON DELETE CASCADE (servicio);
--   compania_id → companias(id);
--   (compania_id, cuenta_id) → cuentas(compania_id, id);
--   (compania_id, centro_costo_id) → centros_costos(compania_id, id)
-- Sin columnas de auditoría (igual que PostgreSQL).

-- 58. activos — activos fijos y amortizables (INTEACT2/INTEACT3). (ver general/01_entidades.md)
CREATE TABLE activos (
  id                    AUTOINC,
  compania_id           INTEGER       NOT NULL,
  codigo                VARCHAR(30)   NOT NULL,
  nombre                VARCHAR(255)  NOT NULL,
  tipo                  VARCHAR(30)   NOT NULL DEFAULT 'Activo',
  cuenta_activo_id      INTEGER,      -- cuenta del activo
  cuenta_gasto_id       INTEGER,      -- gasto de depreciación
  cuenta_depreciacion_id INTEGER,     -- depreciación acumulada
  costo                 NUMERIC(18,2) NOT NULL DEFAULT 0,
  vida_util_meses       INTEGER       NOT NULL DEFAULT 0,
  valor_residual        NUMERIC(18,2) NOT NULL DEFAULT 0,
  fecha_adquisicion     DATE,
  fecha_baja            DATE,
  estado                VARCHAR(30)   NOT NULL DEFAULT 'Activo',
  creado_en             TIMESTAMP,
  creado_por            INTEGER,
  actualizado_en        TIMESTAMP,
  actualizado_por       INTEGER,
  version               INTEGER       NOT NULL DEFAULT 0
);
-- CHECK: tipo IN ('Activo','Amortizable'); estado IN ('Activo','Baja',
--        'Totalmente depreciado')
-- FK lógica: compania_id → companias(id);
--   (compania_id, cuenta_activo_id) → cuentas(compania_id, id);
--   (compania_id, cuenta_gasto_id) → cuentas(compania_id, id);
--   (compania_id, cuenta_depreciacion_id) → cuentas(compania_id, id)

-- 59. activo_cuotas — cuota mensual de depreciación por activo. (ver general/01_entidades.md)
CREATE TABLE activo_cuotas (
  id         AUTOINC,
  activo_id  INTEGER       NOT NULL,
  anio       INTEGER       NOT NULL,
  periodo    VARCHAR(2)    NOT NULL,
  valor      NUMERIC(18,2) NOT NULL DEFAULT 0,
  aplicada   LOGICAL       NOT NULL DEFAULT FALSE,  -- ¿ya generó asiento?
  lote_id    INTEGER                                -- lote que la aplicó
);
-- CHECK: anio BETWEEN 1900 AND 2999; periodo IN ('00'…'18')
-- FK lógica: activo_id → activos(id) ON DELETE CASCADE (servicio);
--   lote_id → lotes(id)
-- Sin columnas de auditoría (igual que PostgreSQL).

-- 60. activo_distribuciones — distribución de la depreciación por centro. (ver general/01_entidades.md)
CREATE TABLE activo_distribuciones (
  id              AUTOINC,
  activo_id       INTEGER      NOT NULL,
  compania_id     INTEGER      NOT NULL,
  centro_costo_id INTEGER      NOT NULL,
  porcentaje      NUMERIC(9,6) NOT NULL DEFAULT 0   -- participación del centro (fracción)
);
-- FK lógica: activo_id → activos(id) ON DELETE CASCADE (servicio);
--   compania_id → companias(id);
--   (compania_id, centro_costo_id) → centros_costos(compania_id, id)
-- Sin columnas de auditoría (igual que PostgreSQL).

-- =====================================================================
-- FIN · 60 tablas (verificación: grep -c '^CREATE TABLE' → 60)
-- Los índices (PK, UK de negocio, UK de aislamiento y consulta) se crean
-- en 02_indices.sql.
-- =====================================================================
