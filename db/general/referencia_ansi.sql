-- =====================================================================
-- CONTABDSI · referencia_ansi.sql — DDL de REFERENCIA del modelo lógico neutro.
-- Documento de diseño NO EJECUTABLE: ningún motor lo corre sin ajustes;
-- cada implementación (postgresql/, advantage/, …) traduce desde general/.
-- =====================================================================
-- Este archivo es la traducción de 00_convenciones.md + 01_entidades.md
-- a SQL ANSI "de referencia": 60 sentencias CREATE TABLE (las 60 entidades
-- numeradas de 01_entidades.md) en orden de módulos, sin sintaxis propietaria
-- de ningún motor. La fuente estructural exhaustiva de columnas, tipos,
-- defaults, NOT NULL, UK, FK y CHECK es db/postgresql/schema/*.sql.
--
-- Convenciones de traducción aplicadas aquí:
--   * identificadores en español y minúsculas (igual en todos los motores);
--   * la clave primaria es siempre `id` con generación de identidad ANSI;
--   * las columnas creado_en/creado_por/actualizado_en/actualizado_por/
--     version son el bloque estándar de auditoría (00_convenciones.md §4) y
--     aparecen SOLO donde la implementación las declara (fuente: postgresql/);
--   * PK/UK/FK/CHECK se escriben a nivel de tabla (sintaxis estándar);
--   * las garantías que ANSI no expresa van como comentarios al pie de la
--     tabla afectada o en la sección final "Garantías fuera del estándar".
-- =====================================================================

-- ---------------------------------------------------------------------
-- Equivalencias de tipos (lógico → ANSI de referencia)
-- ---------------------------------------------------------------------
--   id            → BIGINT GENERATED ALWAYS AS IDENTITY   (columna `id`)
--   entero        → INTEGER
--   entero_largo  → BIGINT
--   texto         → VARCHAR(n)   (n según el uso; ver bandas abajo)
--   texto_libre   → CLOB
--   dinero        → NUMERIC(18,2)   (jamás float/double)
--   porcentaje    → NUMERIC(9,6)    (fracción: 19 % = 0.190000)
--   cantidad      → NUMERIC(18,4)
--   fecha         → DATE
--   fecha_hora    → TIMESTAMP       (en postgresql/ es timestamptz)
--   booleano      → BOOLEAN
--   uuid          → CHAR(36)        (claves de idempotencia)
--   documento     → CLOB            -- JSON: validar en el servicio
--
-- longitudes adoptadas para `texto` (bandas por uso):
--   codigo (catálogo)          → VARCHAR(30)   (p. ej. 'CE', '510506', 'NOM2')
--   documento/numero textual   → VARCHAR(60)   (p. ej. 'NOM-2026-02', 'REV-…')
--   nit, nit_relacionado       → VARCHAR(20)   (nit_alterno y nit de cabeceras igual)
--   digito                     → VARCHAR(5)
--   nombre                     → VARCHAR(255)  (periodos_contables.nombre: 100)
--   correo                     → VARCHAR(200)
--   telefono                   → VARCHAR(50)
--   ciudad/zona                → VARCHAR(100) / VARCHAR(50)
--   direccion                  → VARCHAR(255)
--   origen_referencia,
--   archivo_origen             → VARCHAR(255)  (ruta/hash de importación)
--   campos libres (concepto, motivo, observacion, mensaje, detalle,
--   descripcion, leyenda, contenido, soporte…) → CLOB
--   estados/catálogos (estado, tipo, clase, origen, severidad…) → VARCHAR(30)
--   accion (bitácora)          → VARCHAR(200)  ·  modulo → VARCHAR(60)
--   tipo de validación         → VARCHAR(100)  ·  campo → VARCHAR(60)
--   etiqueta                   → VARCHAR(50)   ·  caja_menor → VARCHAR(100)
--   iniciales                  → VARCHAR(10)   ·  fuente (editor) → VARCHAR(100)
--   sexo                       → VARCHAR(10)   ·  resultado → VARCHAR(10)
--   tipo_documento (NIT/CC/CE) → VARCHAR(10)   ·  periodo → VARCHAR(2)
--   path (árbol materializado) → VARCHAR(255)  ·  codigo_legado → VARCHAR(50)
--   codigo de permiso (mov.*)  → VARCHAR(100)  ·  contabilidad_conciliacion → VARCHAR(30)
--   anio_operacion             → VARCHAR(10)
-- excepción declarada: las coordenadas del editor de formatos
-- (formato_elementos.x/y/ancho/alto) conservan NUMERIC(10,2), precisión del
-- legado que no mapea al tipo lógico `cantidad` NUMERIC(18,4).
-- ---------------------------------------------------------------------

-- =====================================================================
-- módulo 1 — núcleo (entidades 1–5)
-- =====================================================================

-- 1. companias — empresas del sistema (equivale a la carpeta de empresa de VISION).
CREATE TABLE companias (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY,
  codigo             VARCHAR(30) NOT NULL,             -- código corto, p. ej. '001'
  nombre             VARCHAR(255) NOT NULL,            -- razón social (CONCTR.CTCIA)
  nit                VARCHAR(20) NOT NULL,             -- NIT sin dígito de verificación (CONCTR.CTNIT)
  digito             VARCHAR(5) NOT NULL,              -- dígito de verificación
  estado             VARCHAR(30) NOT NULL DEFAULT 'Activa',
  solo_consolidacion BOOLEAN NOT NULL DEFAULT false,   -- destino de consolidación (no opera)
  legado             CLOB,  -- campos del origen sin columna propia; en PostgreSQL es jsonb (etapa A)
  creado_en          TIMESTAMP,
  creado_por         INTEGER,
  actualizado_en     TIMESTAMP,
  actualizado_por    INTEGER,
  version            INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT companias_pk PRIMARY KEY (id),
  CONSTRAINT companias_codigo_uk UNIQUE (codigo),
  CONSTRAINT companias_nit_uk UNIQUE (nit, digito),
  CONSTRAINT companias_estado_ck CHECK (estado IN ('Activa', 'Inactiva'))
);

-- 2. compania_anios — años contables habilitados por compañía.
CREATE TABLE compania_anios (
  id           BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id  BIGINT NOT NULL,
  anio         INTEGER NOT NULL,
  creado_en    TIMESTAMP,
  creado_por   INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT compania_anios_pk PRIMARY KEY (id),
  CONSTRAINT compania_anios_uk UNIQUE (compania_id, anio),
  CONSTRAINT compania_anios_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT compania_anios_anio_ck CHECK (anio BETWEEN 1900 AND 2999)
);

-- 3. periodos_contables — períodos por compañía/año y su estado de cierre.
--    '00' = saldos iniciales, '01'–'12' = meses, '13'–'18' = ajustes.
CREATE TABLE periodos_contables (
  id           BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id  BIGINT NOT NULL,
  anio         INTEGER NOT NULL,
  periodo      VARCHAR(2) NOT NULL,
  nombre       VARCHAR(100) NOT NULL,                  -- 'Febrero', 'Saldos Iniciales'…
  estado       VARCHAR(30) NOT NULL DEFAULT 'Abierto', -- cerrado = solo lectura
  cerrado_por  INTEGER,                                -- usuario que cerró
  cerrado_en   TIMESTAMP,
  creado_en    TIMESTAMP,
  creado_por   INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT periodos_contables_pk PRIMARY KEY (id),
  CONSTRAINT periodos_contables_uk UNIQUE (compania_id, anio, periodo),
  CONSTRAINT periodos_contables_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT periodos_contables_anio_ck CHECK (anio BETWEEN 1900 AND 2999),
  CONSTRAINT periodos_contables_periodo_ck CHECK (periodo IN
    ('00','01','02','03','04','05','06',
     '07','08','09','10','11','12',
     '13','14','15','16','17','18')),
  CONSTRAINT periodos_contables_estado_ck CHECK (estado IN ('Abierto', 'Cerrado'))
);

-- 4. parametros_operacion — parámetros de operación por compañía/año (PARAM_1 / DSIGRABA6).
CREATE TABLE parametros_operacion (
  id                          BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id                 BIGINT NOT NULL,
  anio                        INTEGER NOT NULL,
  nombre_empresa              VARCHAR(255) NOT NULL DEFAULT '',  -- CONCTR.CTCIA
  nit                         VARCHAR(20) NOT NULL DEFAULT '',   -- CTNIT
  direccion                   VARCHAR(255) NOT NULL DEFAULT '',  -- CTDIRECC
  ciudad                      VARCHAR(100) NOT NULL DEFAULT '',  -- CTCIUDAD
  directorio_contabilidad     VARCHAR(255) NOT NULL DEFAULT '',  -- CTDIREC
  anio_operacion              VARCHAR(10) NOT NULL DEFAULT '',   -- CTANO
  contabilidad_conciliacion   VARCHAR(30) NOT NULL DEFAULT '',   -- CTCLAVE1
  verifica_documentos_lotes   BOOLEAN NOT NULL DEFAULT true,     -- CTVERDOC
  terceros_documentos_propios BOOLEAN NOT NULL DEFAULT false,    -- CTTERDOC
  controla_usuario_lotes      BOOLEAN NOT NULL DEFAULT true,     -- CTPUC
  comentario_certificado      CLOB NOT NULL DEFAULT '',          -- CTLEY1
  fecha_operativa             DATE,                              -- CTFCHOY
  observacion                 CLOB NOT NULL DEFAULT '',          -- CTTOBS
  documento                   VARCHAR(60) NOT NULL DEFAULT '',   -- CTDOCUM
  leyenda2                    CLOB NOT NULL DEFAULT '',          -- CTLEY2
  modo_retencion              VARCHAR(30) NOT NULL DEFAULT 'retencion-a-base',
  periodos_habilitados        CLOB NOT NULL DEFAULT '{}',  -- JSON: validar en el servicio (CT00..CT12: true = habilitado)
  legado                      CLOB,  -- campos del origen sin columna propia; en PostgreSQL es jsonb (etapa A)
  creado_en                   TIMESTAMP,
  creado_por                  INTEGER,
  actualizado_en              TIMESTAMP,
  actualizado_por             INTEGER,
  version                     INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT parametros_operacion_pk PRIMARY KEY (id),
  CONSTRAINT parametros_operacion_uk UNIQUE (compania_id, anio),
  CONSTRAINT parametros_operacion_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT parametros_operacion_anio_ck CHECK (anio BETWEEN 1900 AND 2999),
  CONSTRAINT parametros_operacion_modo_retencion_ck CHECK (modo_retencion IN ('retencion-a-base', 'base-a-retencion'))
);

-- 5. parametros_nomina — parámetros de nómina (PARAMS_NOMI / DSIGRABA6_NOM).
CREATE TABLE parametros_nomina (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id           BIGINT NOT NULL,
  anio                  INTEGER NOT NULL,
  comprobante_nomina    VARCHAR(30) NOT NULL DEFAULT '',   -- CTCOMNOM1
  documento_nomina      VARCHAR(60) NOT NULL DEFAULT '',   -- CTDOCNOM1
  comprobante_aportes   VARCHAR(30) NOT NULL DEFAULT '',   -- CTCOMNOM2
  documento_aportes     VARCHAR(60) NOT NULL DEFAULT '',   -- CTDOCNOM2
  comprobante_provisiones VARCHAR(30) NOT NULL DEFAULT '', -- CTCOMNOM3
  documento_provisiones VARCHAR(60) NOT NULL DEFAULT '',   -- CTDOCNOM3
  creado_en             TIMESTAMP,
  creado_por            INTEGER,
  actualizado_en        TIMESTAMP,
  actualizado_por       INTEGER,
  version               INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT parametros_nomina_pk PRIMARY KEY (id),
  CONSTRAINT parametros_nomina_uk UNIQUE (compania_id, anio),
  CONSTRAINT parametros_nomina_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT parametros_nomina_anio_ck CHECK (anio BETWEEN 1900 AND 2999)
);

-- =====================================================================
-- módulo 2 — maestros (entidades 6–19)
-- =====================================================================

-- 6. cuentas — plan de cuentas jerárquico (niveles 1, 2, 4, 6, 9 y 12).
CREATE TABLE cuentas (
  id                BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id       BIGINT NOT NULL,
  codigo            VARCHAR(30) NOT NULL,                -- '510506'
  nombre            VARCHAR(255) NOT NULL,
  nivel             INTEGER NOT NULL,
  afectable         BOOLEAN NOT NULL DEFAULT true,       -- no afectable no acepta movimiento
  controla_tercero  BOOLEAN NOT NULL DEFAULT false,
  controla_centro   BOOLEAN NOT NULL DEFAULT false,
  controla_base     BOOLEAN NOT NULL DEFAULT false,
  ajuste            BOOLEAN NOT NULL DEFAULT false,
  clase_iva         VARCHAR(30),                         -- 'Generado' | 'Descontable' | null
  clase_retencion   VARCHAR(30),                         -- 'Renta' | 'IVA' | 'ICA' | null
  distribucion      VARCHAR(30) NOT NULL DEFAULT 'Ninguna',
  porcentaje        NUMERIC(9,6) NOT NULL DEFAULT 0,     -- distribución porcentual
  cuenta_base_id    BIGINT,                              -- cuenta base para distribución
  saldo_inicial     NUMERIC(18,2) NOT NULL DEFAULT 0,
  parent_id         BIGINT,                              -- jerarquía
  path              VARCHAR(255),                        -- materializado: '/1/5/51/5105/510506'
  eliminado_en      TIMESTAMP,                           -- borrado lógico (NULL = vigente)
  legado            CLOB,  -- campos del origen sin columna propia; en PostgreSQL es jsonb (etapa A)
  creado_en         TIMESTAMP,
  creado_por        INTEGER,
  actualizado_en    TIMESTAMP,
  actualizado_por   INTEGER,
  version           INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT cuentas_pk PRIMARY KEY (id),
  CONSTRAINT cuentas_codigo_uk UNIQUE (compania_id, codigo),
  -- soporta FK compuestas de líneas y saldos (B05)
  CONSTRAINT cuentas_compania_id_uk UNIQUE (compania_id, id),
  CONSTRAINT cuentas_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT cuentas_cuenta_base_fk FOREIGN KEY (cuenta_base_id) REFERENCES cuentas (id),
  CONSTRAINT cuentas_parent_fk FOREIGN KEY (parent_id) REFERENCES cuentas (id),
  CONSTRAINT cuentas_nivel_ck CHECK (nivel IN (1, 2, 4, 6, 9, 12)),
  CONSTRAINT cuentas_distribucion_ck CHECK (distribucion IN ('Ninguna', 'Fija', 'Porcentaje'))
);
-- índices de texto: ver 02_indices.md (búsqueda por nombre en cuentas/terceros).

-- 7. terceros — clientes, proveedores, empleados, entidades.
CREATE TABLE terceros (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id     BIGINT NOT NULL,
  zona            VARCHAR(50),
  nit             VARCHAR(20) NOT NULL,
  digito          VARCHAR(5) NOT NULL,
  tipo_documento  VARCHAR(10) NOT NULL DEFAULT 'NIT',    -- 'NIT' | 'CC' | 'CE' | …
  nombre          VARCHAR(255) NOT NULL,
  tipo            VARCHAR(30) NOT NULL DEFAULT 'Juridica',
  direccion       VARCHAR(255),
  telefono        VARCHAR(50),
  ciudad          VARCHAR(100),
  nit_relacionado VARCHAR(20),
  correo          VARCHAR(200),                          -- FADCLI: correo electrónico
  codigo_legado   VARCHAR(50),                           -- identidad original (RECNO/clave legada)
  estado          VARCHAR(30) NOT NULL DEFAULT 'Activo',
  motivo_bloqueo  CLOB,
  fecha_creacion  DATE,
  saldo           NUMERIC(18,2) NOT NULL DEFAULT 0,
  cupo            NUMERIC(18,2) NOT NULL DEFAULT 0,
  sexo            VARCHAR(10),
  nacimiento      DATE,
  estado_web      VARCHAR(30) NOT NULL DEFAULT 'Inactivo',
  eliminado_en    TIMESTAMP,                             -- borrado lógico (NULL = vigente)
  legado          CLOB,  -- campos del origen sin columna propia; en PostgreSQL es jsonb (etapa A)
  creado_en       TIMESTAMP,
  creado_por      INTEGER,
  actualizado_en  TIMESTAMP,
  actualizado_por INTEGER,
  version         INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT terceros_pk PRIMARY KEY (id),
  CONSTRAINT terceros_nit_uk UNIQUE (compania_id, nit),
  -- soporta FK compuestas de líneas, saldos, reembolsos y cuentas bancarias (B05)
  CONSTRAINT terceros_compania_id_uk UNIQUE (compania_id, id),
  CONSTRAINT terceros_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT terceros_tipo_ck CHECK (tipo IN ('Natural', 'Juridica')),
  CONSTRAINT terceros_estado_ck CHECK (estado IN ('Activo', 'Bloqueado')),
  CONSTRAINT terceros_sexo_ck CHECK (sexo IN ('M', 'F', 'J') OR sexo IS NULL),
  CONSTRAINT terceros_estado_web_ck CHECK (estado_web IN ('Activo', 'Inactivo'))
);
-- índices de texto: ver 02_indices.md (búsqueda por nombre en cuentas/terceros).

-- 8. tercero_etiquetas — etiquetas libres por tercero.
--    Detalle puro de terceros: sin compania_id ni auditoría propias; el
--    aislamiento por compañía se hereda del tercero padre (00_convenciones.md §4).
CREATE TABLE tercero_etiquetas (
  id         BIGINT GENERATED ALWAYS AS IDENTITY,
  tercero_id BIGINT NOT NULL,
  etiqueta   VARCHAR(50) NOT NULL,
  CONSTRAINT tercero_etiquetas_pk PRIMARY KEY (id),
  CONSTRAINT tercero_etiquetas_uk UNIQUE (tercero_id, etiqueta),
  CONSTRAINT tercero_etiquetas_tercero_fk FOREIGN KEY (tercero_id)
    REFERENCES terceros (id) ON DELETE CASCADE
);

-- 9. centros_costos — centros de costo jerárquicos.
CREATE TABLE centros_costos (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id     BIGINT NOT NULL,
  codigo          VARCHAR(30) NOT NULL,                  -- 'ADM', 'VEN', 'OPE'
  nombre          VARCHAR(255) NOT NULL,
  nivel           INTEGER NOT NULL DEFAULT 1,
  parent_id       BIGINT,                                -- jerarquía
  eliminado_en    TIMESTAMP,                             -- borrado lógico (NULL = vigente)
  legado          CLOB,  -- campos del origen sin columna propia; en PostgreSQL es jsonb (etapa A)
  creado_en       TIMESTAMP,
  creado_por      INTEGER,
  actualizado_en  TIMESTAMP,
  actualizado_por INTEGER,
  version         INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT centros_costos_pk PRIMARY KEY (id),
  CONSTRAINT centros_costos_codigo_uk UNIQUE (compania_id, codigo),
  -- soporta FK compuestas de líneas, saldos y reembolsos (B05)
  CONSTRAINT centros_costos_compania_id_uk UNIQUE (compania_id, id),
  CONSTRAINT centros_costos_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT centros_costos_parent_fk FOREIGN KEY (parent_id) REFERENCES centros_costos (id)
);

-- 10. comprobantes — tipos de comprobante contable.
CREATE TABLE comprobantes (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id     BIGINT NOT NULL,
  codigo          VARCHAR(30) NOT NULL,                  -- 'CE', 'RC', 'CP'…
  nombre          VARCHAR(255) NOT NULL,
  activo          BOOLEAN NOT NULL DEFAULT true,
  eliminado_en    TIMESTAMP,                             -- borrado lógico (NULL = vigente)
  legado          CLOB,  -- campos del origen sin columna propia; en PostgreSQL es jsonb (etapa A)
  creado_en       TIMESTAMP,
  creado_por      INTEGER,
  actualizado_en  TIMESTAMP,
  actualizado_por INTEGER,
  version         INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT comprobantes_pk PRIMARY KEY (id),
  CONSTRAINT comprobantes_codigo_uk UNIQUE (compania_id, codigo),
  -- soporta FK compuestas de documentos (B05)
  CONSTRAINT comprobantes_compania_id_uk UNIQUE (compania_id, id),
  CONSTRAINT comprobantes_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id)
);

-- 11. consecutivos_comprobantes — consecutivo por comprobante/año (fila caliente).
CREATE TABLE consecutivos_comprobantes (
  id                BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id       BIGINT NOT NULL,
  anio              INTEGER NOT NULL,
  comprobante_id    BIGINT NOT NULL,
  consecutivo_actual BIGINT NOT NULL DEFAULT 1,
  consecutivo_fin   BIGINT,
  version           INTEGER NOT NULL DEFAULT 0,          -- única columna de auditoría (fila caliente)
  CONSTRAINT consecutivos_comprobantes_pk PRIMARY KEY (id),
  CONSTRAINT consecutivos_uk UNIQUE (compania_id, anio, comprobante_id),
  CONSTRAINT consecutivos_comprobantes_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT consecutivos_comprobantes_comprobante_fk FOREIGN KEY (comprobante_id) REFERENCES comprobantes (id),
  CONSTRAINT consecutivos_comprobantes_anio_ck CHECK (anio BETWEEN 1900 AND 2999)
);
-- fila muy caliente: se actualiza en cada contabilización. postgresql/ usa
-- fillfactor reducido y bloqueo FOR UPDATE (ver 03_reglas_negocio.md §3).

-- 12. tipos_documento — tipos documentales y numeración (VISDOCUM).
CREATE TABLE tipos_documento (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id         BIGINT NOT NULL,
  codigo              VARCHAR(30) NOT NULL,              -- 'NOM', 'FV', 'OR'…
  nombre              VARCHAR(255) NOT NULL,
  numeracion          VARCHAR(30) NOT NULL DEFAULT 'Manual',
  consecutivo         BIGINT NOT NULL DEFAULT 1,
  tercero_obligatorio BOOLEAN NOT NULL DEFAULT false,
  centro_obligatorio  BOOLEAN NOT NULL DEFAULT false,
  eliminado_en        TIMESTAMP,                         -- borrado lógico (NULL = vigente)
  legado              CLOB,  -- campos del origen sin columna propia; en PostgreSQL es jsonb (etapa A)
  creado_en           TIMESTAMP,
  creado_por          INTEGER,
  actualizado_en      TIMESTAMP,
  actualizado_por     INTEGER,
  version             INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT tipos_documento_pk PRIMARY KEY (id),
  CONSTRAINT tipos_documento_codigo_uk UNIQUE (compania_id, codigo),
  -- soporta FK compuestas de líneas y documentos (B05)
  CONSTRAINT tipos_documento_compania_id_uk UNIQUE (compania_id, id),
  CONSTRAINT tipos_documento_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT tipos_documento_numeracion_ck CHECK (numeracion IN ('Manual', 'Automatica'))
);

-- 13. conceptos_retencion — conceptos de retención en la fuente.
CREATE TABLE conceptos_retencion (
  id           BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id  BIGINT NOT NULL,
  codigo       VARCHAR(30) NOT NULL,
  nombre       VARCHAR(255) NOT NULL,
  tarifa       NUMERIC(9,6) NOT NULL DEFAULT 0,
  cuenta_id    BIGINT,                                   -- cuenta del impuesto
  base_minima  NUMERIC(18,2) NOT NULL DEFAULT 0,
  eliminado_en TIMESTAMP,                                -- borrado lógico (NULL = vigente)
  creado_en    TIMESTAMP,
  creado_por   INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT conceptos_retencion_pk PRIMARY KEY (id),
  CONSTRAINT conceptos_retencion_codigo_uk UNIQUE (compania_id, codigo),
  -- soporta FK compuestas de líneas y acumulados (B05)
  CONSTRAINT conceptos_retencion_compania_id_uk UNIQUE (compania_id, id),
  CONSTRAINT conceptos_retencion_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT conceptos_retencion_cuenta_fk FOREIGN KEY (cuenta_id) REFERENCES cuentas (id)
);

-- 14. tarifas_iva — tarifas de IVA.
CREATE TABLE tarifas_iva (
  id           BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id  BIGINT NOT NULL,
  codigo       VARCHAR(30) NOT NULL,                     -- 'IV19', 'IV05', 'IVE'
  nombre       VARCHAR(255) NOT NULL,
  tarifa       NUMERIC(9,6) NOT NULL DEFAULT 0,
  cuenta_id    BIGINT,                                   -- cuenta del impuesto
  eliminado_en TIMESTAMP,                                -- borrado lógico (NULL = vigente)
  creado_en    TIMESTAMP,
  creado_por   INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT tarifas_iva_pk PRIMARY KEY (id),
  CONSTRAINT tarifas_iva_codigo_uk UNIQUE (compania_id, codigo),
  -- soporta FK compuestas de líneas y acumulados (B05)
  CONSTRAINT tarifas_iva_compania_id_uk UNIQUE (compania_id, id),
  CONSTRAINT tarifas_iva_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT tarifas_iva_cuenta_fk FOREIGN KEY (cuenta_id) REFERENCES cuentas (id)
);

-- 15. renglones_renta — renglones de la declaración de renta.
CREATE TABLE renglones_renta (
  id           BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id  BIGINT NOT NULL,
  codigo       VARCHAR(30) NOT NULL,
  nombre       VARCHAR(255) NOT NULL,
  cuenta_id    BIGINT,                                   -- cuenta asociada al renglón
  signo        INTEGER NOT NULL DEFAULT 1,               -- +1 suma / -1 resta
  eliminado_en TIMESTAMP,                                -- borrado lógico (NULL = vigente)
  creado_en    TIMESTAMP,
  creado_por   INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT renglones_renta_pk PRIMARY KEY (id),
  CONSTRAINT renglones_renta_codigo_uk UNIQUE (compania_id, codigo),
  CONSTRAINT renglones_renta_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT renglones_renta_cuenta_fk FOREIGN KEY (cuenta_id) REFERENCES cuentas (id),
  CONSTRAINT renglones_renta_signo_ck CHECK (signo IN (-1, 1))
);

-- 16. plantillas_contables — plantillas de asiento (PLANTICO/GRABAPLA).
--    El legado guarda PAREJAS de cuentas (NOM/DEB/CRE), no importes fijos (B09).
CREATE TABLE plantillas_contables (
  id                BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id       BIGINT NOT NULL,
  codigo            VARCHAR(30) NOT NULL,
  nombre            VARCHAR(255) NOT NULL,
  tipo_documento_id BIGINT,                               -- tipo documental de la plantilla
  eliminado_en      TIMESTAMP,                            -- borrado lógico (NULL = vigente)
  creado_en         TIMESTAMP,
  creado_por        INTEGER,
  actualizado_en    TIMESTAMP,
  actualizado_por   INTEGER,
  version           INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT plantillas_contables_pk PRIMARY KEY (id),
  CONSTRAINT plantillas_codigo_uk UNIQUE (compania_id, codigo),
  CONSTRAINT plantillas_contables_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT plantillas_tipo_documento_fk FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documento (id)
);

-- 17. plantilla_lineas — parejas de cuentas de la plantilla (NOM/DEB/CRE).
--    Detalle puro de plantillas_contables: sin compania_id ni auditoría propias.
CREATE TABLE plantilla_lineas (
  id                BIGINT GENERATED ALWAYS AS IDENTITY,
  plantilla_id      BIGINT NOT NULL,
  orden             INTEGER NOT NULL DEFAULT 0,
  cuenta_debito_id  BIGINT,                               -- DEB en VISDOCUM (cuenta)
  cuenta_credito_id BIGINT,                               -- CRE en VISDOCUM (cuenta)
  concepto          CLOB,
  CONSTRAINT plantilla_lineas_pk PRIMARY KEY (id),
  CONSTRAINT plantilla_lineas_plantilla_fk FOREIGN KEY (plantilla_id)
    REFERENCES plantillas_contables (id) ON DELETE CASCADE,
  CONSTRAINT plantilla_lineas_cuenta_debito_fk FOREIGN KEY (cuenta_debito_id) REFERENCES cuentas (id),
  CONSTRAINT plantilla_lineas_cuenta_credito_fk FOREIGN KEY (cuenta_credito_id) REFERENCES cuentas (id)
);

-- 18. formatos_documentales — formatos de impresión de comprobantes.
CREATE TABLE formatos_documentales (
  id             BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id    BIGINT NOT NULL,
  codigo         VARCHAR(30) NOT NULL,
  nombre         VARCHAR(255) NOT NULL,
  comprobante_id BIGINT,                                  -- comprobante al que aplica
  eliminado_en   TIMESTAMP,                               -- borrado lógico (NULL = vigente)
  creado_en      TIMESTAMP,
  creado_por     INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version        INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT formatos_documentales_pk PRIMARY KEY (id),
  CONSTRAINT formatos_codigo_uk UNIQUE (compania_id, codigo),
  CONSTRAINT formatos_documentales_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT formatos_documentales_comprobante_fk FOREIGN KEY (comprobante_id) REFERENCES comprobantes (id)
);

-- 19. formato_elementos — elementos visuales del formato (editor).
--    Detalle puro de formatos_documentales: sin compania_id ni auditoría propias.
CREATE TABLE formato_elementos (
  id         BIGINT GENERATED ALWAYS AS IDENTITY,
  formato_id BIGINT NOT NULL,
  tipo       VARCHAR(30) NOT NULL,
  contenido  CLOB,                                       -- texto/leyenda o ruta de imagen
  x          NUMERIC(10,2) NOT NULL DEFAULT 0,           -- coordenada (precisión del editor)
  y          NUMERIC(10,2) NOT NULL DEFAULT 0,
  ancho      NUMERIC(10,2),
  alto       NUMERIC(10,2),
  fuente     VARCHAR(100),                               -- nombre de la tipografía
  orden      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT formato_elementos_pk PRIMARY KEY (id),
  CONSTRAINT formato_elementos_formato_fk FOREIGN KEY (formato_id)
    REFERENCES formatos_documentales (id) ON DELETE CASCADE,
  CONSTRAINT formato_elementos_tipo_ck CHECK (tipo IN
    ('Leyenda', 'Imagen', 'Rectangulo', 'Linea',
     'CampoComprobante', 'CampoDocumento', 'CampoFecha', 'CampoTotal'))
);

-- =====================================================================
-- módulo 3 — movimientos (entidades 20–24)
-- =====================================================================

-- 20. lotes — lotes de captura contable.
CREATE TABLE lotes (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id     BIGINT NOT NULL,
  anio            INTEGER NOT NULL,
  periodo         VARCHAR(2) NOT NULL,
  codigo          VARCHAR(30) NOT NULL,                   -- 'NOM2', 'CE-001'…
  nombre          VARCHAR(255) NOT NULL,
  usuario_id      BIGINT NOT NULL,                        -- responsable del lote
  origen          VARCHAR(30) NOT NULL DEFAULT 'Manual',  -- catálogo abierto: 'Excel', 'Nomina', 'Reembolso'…
  origen_referencia VARCHAR(255),                         -- clave estable del origen (archivo/hash de importación)
  fecha           DATE NOT NULL,
  estado          VARCHAR(30) NOT NULL DEFAULT 'Borrador',
  comprobante_id  BIGINT,                                 -- comprobante por defecto (se resuelve por código al contabilizar)
  documento       VARCHAR(60),                            -- 'NOM-2026-02'
  idempotency_key CHAR(36) NOT NULL,                      -- uuid de idempotencia (doble envío prevenido)
  motivo          CLOB,                                   -- anulación / rechazo
  creado_en       TIMESTAMP,
  creado_por      INTEGER,
  actualizado_en  TIMESTAMP,
  actualizado_por INTEGER,
  version         INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT lotes_pk PRIMARY KEY (id),
  CONSTRAINT lotes_codigo_uk UNIQUE (compania_id, anio, codigo),
  CONSTRAINT lotes_idempotencia_uk UNIQUE (idempotency_key),
  -- soporta la FK compuesta de documentos (B05)
  CONSTRAINT lotes_compania_id_uk UNIQUE (compania_id, id),
  -- B07: un mismo origen (archivo/operación) no puede cargarse dos veces
  CONSTRAINT lotes_origen_referencia_uk UNIQUE (compania_id, anio, origen_referencia),
  CONSTRAINT lotes_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  -- B05: el período debe EXISTIR en periodos_contables (rechaza períodos inexistentes)
  CONSTRAINT lotes_periodo_fk FOREIGN KEY (compania_id, anio, periodo)
    REFERENCES periodos_contables (compania_id, anio, periodo),
  CONSTRAINT lotes_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT lotes_anio_ck CHECK (anio BETWEEN 1900 AND 2999),
  CONSTRAINT lotes_periodo_ck CHECK (periodo IN
    ('00','01','02','03','04','05','06',
     '07','08','09','10','11','12',
     '13','14','15','16','17','18')),
  CONSTRAINT lotes_estado_ck CHECK (estado IN
    ('Borrador', 'Con errores', 'Verificado',
     'Pendiente aprobacion', 'Aprobado',
     'Contabilizando', 'Contabilizado', 'Fallido', 'Anulado'))
);
-- nota: la FK a usuarios(id) se declara aquí por claridad; en postgresql/
-- se agrega al final (08_seguridad.sql) por orden de creación de tablas.
-- idempotency_key: el uuid lo genera el motor/aplicación (en postgresql/,
-- default gen_random_uuid()).

-- 21. lote_lineas — renglones del lote (grilla editable).
--    Detalle puro de lotes: sin auditoría propia (los movimientos se auditan
--    por la cabecera). Dimensiones fiscales y documentales por renglón (B03/B04).
CREATE TABLE lote_lineas (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY,
  lote_id              BIGINT NOT NULL,
  compania_id          BIGINT NOT NULL,                   -- aislamiento (B05)
  numero_linea         INTEGER NOT NULL,
  cuenta_id            BIGINT,
  tercero_id           BIGINT,
  centro_costo_id      BIGINT,
  tipo_documento_id    BIGINT,
  comprobante          VARCHAR(30),                       -- código comprobante (texto)
  documento            VARCHAR(60),
  fecha                DATE,
  fecha_documento      DATE,                              -- TFECDOC
  debito               NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito              NUMERIC(18,2) NOT NULL DEFAULT 0,
  base                 NUMERIC(18,2) NOT NULL DEFAULT 0,
  clase                VARCHAR(30) NOT NULL DEFAULT '',
  concepto_retencion_id BIGINT,                           -- concepto histórico por renglón (B03)
  tarifa_iva_id        BIGINT,                            -- tarifa histórica por renglón (B03)
  documento_afectado   VARCHAR(60),
  concepto             CLOB,
  valor_moneda         NUMERIC(18,2),                     -- TVALORUS (moneda alterna)
  nit_alterno          VARCHAR(20),                       -- NITN (tercero alterno)
  archivo_origen       VARCHAR(255),                      -- TARCHI (procedencia)
  origen               VARCHAR(30) NOT NULL DEFAULT 'Manual',
  CONSTRAINT lote_lineas_pk PRIMARY KEY (id),
  CONSTRAINT lote_lineas_numero_uk UNIQUE (lote_id, numero_linea),
  CONSTRAINT lote_lineas_sin_doble_valor_ck CHECK (debito = 0 OR credito = 0),
  CONSTRAINT lote_lineas_lote_fk FOREIGN KEY (lote_id) REFERENCES lotes (id) ON DELETE CASCADE,
  CONSTRAINT lote_lineas_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  -- B05: FK compuestas — una línea no puede referenciar maestros de otra compañía
  CONSTRAINT lote_lineas_cuenta_fk FOREIGN KEY (compania_id, cuenta_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT lote_lineas_tercero_fk FOREIGN KEY (compania_id, tercero_id)
    REFERENCES terceros (compania_id, id),
  CONSTRAINT lote_lineas_centro_fk FOREIGN KEY (compania_id, centro_costo_id)
    REFERENCES centros_costos (compania_id, id),
  CONSTRAINT lote_lineas_tipodoc_fk FOREIGN KEY (compania_id, tipo_documento_id)
    REFERENCES tipos_documento (compania_id, id),
  CONSTRAINT lote_lineas_concepto_fk FOREIGN KEY (compania_id, concepto_retencion_id)
    REFERENCES conceptos_retencion (compania_id, id),
  CONSTRAINT lote_lineas_tarifa_fk FOREIGN KEY (compania_id, tarifa_iva_id)
    REFERENCES tarifas_iva (compania_id, id),
  CONSTRAINT lote_lineas_debito_ck CHECK (debito >= 0),
  CONSTRAINT lote_lineas_credito_ck CHECK (credito >= 0),
  CONSTRAINT lote_lineas_clase_ck CHECK (clase IN ('IVA', 'Retencion', 'Otro', ''))
);

-- 22. lote_validaciones — issues del centro de validación.
--    Detalle puro de lotes: sin compania_id ni auditoría propias.
CREATE TABLE lote_validaciones (
  id         BIGINT GENERATED ALWAYS AS IDENTITY,
  lote_id    BIGINT NOT NULL,
  linea_id   BIGINT,                                      -- nulo si el issue es global
  severidad  VARCHAR(30) NOT NULL,
  ambito     VARCHAR(30) NOT NULL,
  tipo       VARCHAR(100) NOT NULL,                       -- 'Tercero obligatorio', 'Descuadre', …
  mensaje    CLOB NOT NULL,
  campo      VARCHAR(60),                                 -- 'tercero', 'centro', 'cuenta'…
  resuelta   BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT lote_validaciones_pk PRIMARY KEY (id),
  CONSTRAINT lote_validaciones_lote_fk FOREIGN KEY (lote_id) REFERENCES lotes (id) ON DELETE CASCADE,
  CONSTRAINT lote_validaciones_linea_fk FOREIGN KEY (linea_id)
    REFERENCES lote_lineas (id) ON DELETE CASCADE,
  CONSTRAINT lote_validaciones_severidad_ck CHECK (severidad IN ('Error', 'Advertencia')),
  CONSTRAINT lote_validaciones_ambito_ck CHECK (ambito IN ('Global', 'Documento', 'Comprobante', 'Linea'))
);

-- 23. documentos — comprobantes contabilizados (el libro mayor).
--    B01: un lote puede producir VARIOS documentos (uno por grupo documental).
CREATE TABLE documentos (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id           BIGINT NOT NULL,
  anio                  INTEGER NOT NULL,
  comprobante_id        BIGINT NOT NULL,
  numero                BIGINT NOT NULL,                  -- consecutivo → CE-000245
  documento             VARCHAR(60),                      -- 'NOM-2026-02'
  tipo_documento_id     BIGINT,                           -- tipo documental en el libro (B04)
  fecha                 DATE NOT NULL,
  fecha_documento       DATE,
  periodo               VARCHAR(2) NOT NULL,
  tercero_id            BIGINT,
  concepto              CLOB,
  estado                VARCHAR(30) NOT NULL DEFAULT 'Contabilizado',
  origen                VARCHAR(30) NOT NULL DEFAULT 'Manual',   -- 'Manual' | 'Migracion' (historia del legado)
  lote_id               BIGINT,                           -- lote de origen (trazabilidad)
  usuario_id            BIGINT NOT NULL,                  -- usuario que contabilizó
  idempotency_key       CHAR(36) NOT NULL,                -- uuid de idempotencia (doble contabilización prevenida)
  documento_original_id BIGINT,                           -- original <-> reversión
  motivo_anulacion      CLOB,
  soporte_anulacion     CLOB,
  legado                CLOB,  -- campos del origen sin columna propia; en PostgreSQL es jsonb (etapa A)
  creado_en             TIMESTAMP,
  creado_por            INTEGER,
  actualizado_en        TIMESTAMP,
  actualizado_por       INTEGER,
  version               INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT documentos_pk PRIMARY KEY (id),
  CONSTRAINT documentos_uk UNIQUE (compania_id, anio, comprobante_id, numero),
  CONSTRAINT documentos_idempotencia_uk UNIQUE (idempotency_key),
  -- soporta FK compuestas (B05)
  CONSTRAINT documentos_compania_id_uk UNIQUE (compania_id, id),
  CONSTRAINT documentos_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT documentos_comprobante_fk FOREIGN KEY (compania_id, comprobante_id)
    REFERENCES comprobantes (compania_id, id),
  CONSTRAINT documentos_tipodoc_fk FOREIGN KEY (compania_id, tipo_documento_id)
    REFERENCES tipos_documento (compania_id, id),
  CONSTRAINT documentos_tercero_fk FOREIGN KEY (compania_id, tercero_id)
    REFERENCES terceros (compania_id, id),
  CONSTRAINT documentos_lote_fk FOREIGN KEY (compania_id, lote_id)
    REFERENCES lotes (compania_id, id),
  CONSTRAINT documentos_reversion_fk FOREIGN KEY (documento_original_id)
    REFERENCES documentos (id),
  CONSTRAINT documentos_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT documentos_anio_ck CHECK (anio BETWEEN 1900 AND 2999),
  CONSTRAINT documentos_periodo_ck CHECK (periodo IN
    ('00','01','02','03','04','05','06',
     '07','08','09','10','11','12',
     '13','14','15','16','17','18')),
  CONSTRAINT documentos_estado_ck CHECK (estado IN ('Contabilizado', 'Anulado'))
);
-- ÍNDICE ÚNICO PARCIAL (garantía de negocio, no expresable en ANSI):
--    un documento solo puede estar Contabilizado una vez por compañía/año.
--    postgresql/: CREATE UNIQUE INDEX … ON documentos (compania_id, anio, documento)
--    WHERE estado = 'Contabilizado'. Motores sin índices parciales: columna
--    derivada o tabla auxiliar mantenida por el servicio (ver 02_indices.md §2).
-- nota: la FK a usuarios(id) se declara aquí por claridad; en postgresql/
-- se agrega al final (08_seguridad.sql) por orden de creación de tablas.

-- 24. documento_lineas — renglones del libro (espejo histórico del lote).
--    Detalle puro de documentos: sin auditoría propia (el libro es inmutable;
--    la anulación se hace con reversión, nunca con DELETE).
CREATE TABLE documento_lineas (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY,
  documento_id         BIGINT NOT NULL,
  compania_id          BIGINT NOT NULL,                   -- aislamiento (B05)
  numero_linea         INTEGER NOT NULL,
  cuenta_id            BIGINT NOT NULL,
  tercero_id           BIGINT,
  centro_costo_id      BIGINT,
  tipo_documento_id    BIGINT,                            -- TIPODOC por renglón (B04)
  debito               NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito              NUMERIC(18,2) NOT NULL DEFAULT 0,
  base                 NUMERIC(18,2) NOT NULL DEFAULT 0,
  clase                VARCHAR(30) NOT NULL DEFAULT '',
  concepto_retencion_id BIGINT,                           -- concepto histórico (B03)
  tarifa_iva_id        BIGINT,                            -- tarifa histórica (B03)
  fecha_documento      DATE,                              -- TFECDOC (B04)
  valor_moneda         NUMERIC(18,2),                     -- TVALORUS (B04)
  nit_alterno          VARCHAR(20),                       -- NITN (B04)
  documento_afectado   VARCHAR(60),
  concepto             CLOB,
  archivo_origen       VARCHAR(255),                      -- TARCHI (B04, procedencia)
  origen               VARCHAR(30) NOT NULL DEFAULT 'Manual',
  -- Sin bloque de auditoría en esta tabla: `legado` queda como última columna.
  legado               CLOB,  -- campos del origen sin columna propia; en PostgreSQL es jsonb (etapa A)
  CONSTRAINT documento_lineas_pk PRIMARY KEY (id),
  CONSTRAINT documento_lineas_numero_uk UNIQUE (documento_id, numero_linea),
  CONSTRAINT documento_lineas_sin_doble_valor_ck CHECK (debito = 0 OR credito = 0),
  CONSTRAINT documento_lineas_documento_fk FOREIGN KEY (documento_id) REFERENCES documentos (id),
  CONSTRAINT documento_lineas_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  -- B05: FK compuestas — ninguna línea cruza maestros entre compañías
  CONSTRAINT documento_lineas_cuenta_fk FOREIGN KEY (compania_id, cuenta_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT documento_lineas_tercero_fk FOREIGN KEY (compania_id, tercero_id)
    REFERENCES terceros (compania_id, id),
  CONSTRAINT documento_lineas_centro_fk FOREIGN KEY (compania_id, centro_costo_id)
    REFERENCES centros_costos (compania_id, id),
  CONSTRAINT documento_lineas_tipodoc_fk FOREIGN KEY (compania_id, tipo_documento_id)
    REFERENCES tipos_documento (compania_id, id),
  CONSTRAINT documento_lineas_concepto_fk FOREIGN KEY (compania_id, concepto_retencion_id)
    REFERENCES conceptos_retencion (compania_id, id),
  CONSTRAINT documento_lineas_tarifa_fk FOREIGN KEY (compania_id, tarifa_iva_id)
    REFERENCES tarifas_iva (compania_id, id),
  CONSTRAINT documento_lineas_debito_ck CHECK (debito >= 0),
  CONSTRAINT documento_lineas_credito_ck CHECK (credito >= 0),
  CONSTRAINT documento_lineas_clase_ck CHECK (clase IN ('IVA', 'Retencion', 'Otro', ''))
);
-- índice parcial de soporte (no expresable en ANSI): filas con clase fiscal
-- (IVA/Retencion) alimentan la regeneración de acumulados — ver 02_indices.md §2.

-- =====================================================================
-- módulo 4 — saldos y acumulados (entidades 25–32)
-- derivados, regenerables: se reconstruyen desde el libro (03_reglas_negocio.md §5)
-- =====================================================================

-- 25. saldos_cuenta — saldo por cuenta y período.
CREATE TABLE saldos_cuenta (
  id            BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id   BIGINT NOT NULL,
  anio          INTEGER NOT NULL,
  periodo       VARCHAR(2) NOT NULL,
  cuenta_id     BIGINT NOT NULL,
  saldo_inicial NUMERIC(18,2) NOT NULL DEFAULT 0,         -- saldo inicial del período
  debito        NUMERIC(18,2) NOT NULL DEFAULT 0,         -- movimientos del período
  credito       NUMERIC(18,2) NOT NULL DEFAULT 0,
  CONSTRAINT saldos_cuenta_pk PRIMARY KEY (id),
  CONSTRAINT saldos_cuenta_uk UNIQUE (compania_id, anio, periodo, cuenta_id),
  CONSTRAINT saldos_cuenta_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT saldos_cuenta_cuenta_fk FOREIGN KEY (compania_id, cuenta_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT saldos_cuenta_anio_ck CHECK (anio BETWEEN 1900 AND 2999),
  CONSTRAINT saldos_cuenta_periodo_ck CHECK (periodo IN
    ('00','01','02','03','04','05','06',
     '07','08','09','10','11','12',
     '13','14','15','16','17','18'))
);
-- tabla derivada: jamás se edita a mano; la reconstruye la regeneración de
-- acumulados (ver 03_reglas_negocio.md §5). postgresql/: fila caliente con
-- fillfactor reducido (se actualiza en cada contabilización).

-- 26. saldos_cuenta_tercero — saldo por cuenta + tercero + período.
CREATE TABLE saldos_cuenta_tercero (
  id          BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id BIGINT NOT NULL,
  anio        INTEGER NOT NULL,
  periodo     VARCHAR(2) NOT NULL,                        -- '00'–'18' por convención (sin CHECK en postgresql/)
  cuenta_id   BIGINT NOT NULL,
  tercero_id  BIGINT NOT NULL,
  debito      NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito     NUMERIC(18,2) NOT NULL DEFAULT 0,
  CONSTRAINT saldos_cuenta_tercero_pk PRIMARY KEY (id),
  CONSTRAINT saldos_cuenta_tercero_uk UNIQUE (compania_id, anio, periodo, cuenta_id, tercero_id),
  CONSTRAINT saldos_cuenta_tercero_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT saldos_cuenta_tercero_cuenta_fk FOREIGN KEY (compania_id, cuenta_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT saldos_cuenta_tercero_tercero_fk FOREIGN KEY (compania_id, tercero_id)
    REFERENCES terceros (compania_id, id),
  CONSTRAINT saldos_cuenta_tercero_anio_ck CHECK (anio BETWEEN 1900 AND 2999)
);
-- tabla derivada, regenerable (ver 03_reglas_negocio.md §5). postgresql/: fila caliente.

-- 27. saldos_cuenta_centro — saldo por cuenta + centro + período.
CREATE TABLE saldos_cuenta_centro (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id     BIGINT NOT NULL,
  anio            INTEGER NOT NULL,
  periodo         VARCHAR(2) NOT NULL,                    -- '00'–'18' por convención (sin CHECK en postgresql/)
  cuenta_id       BIGINT NOT NULL,
  centro_costo_id BIGINT NOT NULL,
  debito          NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito         NUMERIC(18,2) NOT NULL DEFAULT 0,
  CONSTRAINT saldos_cuenta_centro_pk PRIMARY KEY (id),
  CONSTRAINT saldos_cuenta_centro_uk UNIQUE (compania_id, anio, periodo, cuenta_id, centro_costo_id),
  CONSTRAINT saldos_cuenta_centro_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT saldos_cuenta_centro_cuenta_fk FOREIGN KEY (compania_id, cuenta_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT saldos_cuenta_centro_centro_fk FOREIGN KEY (compania_id, centro_costo_id)
    REFERENCES centros_costos (compania_id, id),
  CONSTRAINT saldos_cuenta_centro_anio_ck CHECK (anio BETWEEN 1900 AND 2999)
);
-- tabla derivada, regenerable (ver 03_reglas_negocio.md §5). postgresql/: fila caliente.

-- 28. acumulados_tercero — acumulado anual por tercero + cuenta.
CREATE TABLE acumulados_tercero (
  id          BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id BIGINT NOT NULL,
  anio        INTEGER NOT NULL,
  tercero_id  BIGINT NOT NULL,
  cuenta_id   BIGINT NOT NULL,
  debito      NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito     NUMERIC(18,2) NOT NULL DEFAULT 0,
  CONSTRAINT acumulados_tercero_pk PRIMARY KEY (id),
  CONSTRAINT acumulados_tercero_uk UNIQUE (compania_id, anio, tercero_id, cuenta_id),
  CONSTRAINT acumulados_tercero_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT acumulados_tercero_tercero_fk FOREIGN KEY (compania_id, tercero_id)
    REFERENCES terceros (compania_id, id),
  CONSTRAINT acumulados_tercero_cuenta_fk FOREIGN KEY (compania_id, cuenta_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT acumulados_tercero_anio_ck CHECK (anio BETWEEN 1900 AND 2999)
);
-- tabla derivada, regenerable (ver 03_reglas_negocio.md §5).

-- 29. acumulados_centro — acumulado anual por centro + cuenta.
CREATE TABLE acumulados_centro (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id     BIGINT NOT NULL,
  anio            INTEGER NOT NULL,
  centro_costo_id BIGINT NOT NULL,
  cuenta_id       BIGINT NOT NULL,
  debito          NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito         NUMERIC(18,2) NOT NULL DEFAULT 0,
  CONSTRAINT acumulados_centro_pk PRIMARY KEY (id),
  CONSTRAINT acumulados_centro_uk UNIQUE (compania_id, anio, centro_costo_id, cuenta_id),
  CONSTRAINT acumulados_centro_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT acumulados_centro_centro_fk FOREIGN KEY (compania_id, centro_costo_id)
    REFERENCES centros_costos (compania_id, id),
  CONSTRAINT acumulados_centro_cuenta_fk FOREIGN KEY (compania_id, cuenta_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT acumulados_centro_anio_ck CHECK (anio BETWEEN 1900 AND 2999)
);
-- tabla derivada, regenerable (ver 03_reglas_negocio.md §5).

-- 30. acumulados_retencion — retención acumulada por tercero/concepto/período.
CREATE TABLE acumulados_retencion (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id           BIGINT NOT NULL,
  anio                  INTEGER NOT NULL,
  periodo               VARCHAR(2) NOT NULL,              -- '00'–'18' por convención (sin CHECK en postgresql/)
  tercero_id            BIGINT NOT NULL,
  concepto_retencion_id BIGINT NOT NULL,
  base                  NUMERIC(18,2) NOT NULL DEFAULT 0, -- base acumulada
  valor                 NUMERIC(18,2) NOT NULL DEFAULT 0, -- retención acumulada
  CONSTRAINT acumulados_retencion_pk PRIMARY KEY (id),
  CONSTRAINT acumulados_retencion_uk UNIQUE
    (compania_id, anio, periodo, tercero_id, concepto_retencion_id),
  CONSTRAINT acumulados_retencion_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT acumulados_retencion_tercero_fk FOREIGN KEY (compania_id, tercero_id)
    REFERENCES terceros (compania_id, id),
  CONSTRAINT acumulados_retencion_concepto_fk FOREIGN KEY (compania_id, concepto_retencion_id)
    REFERENCES conceptos_retencion (compania_id, id),
  CONSTRAINT acumulados_retencion_anio_ck CHECK (anio BETWEEN 1900 AND 2999)
);
-- tabla derivada: la regeneración suma las líneas de clase 'Retencion' del libro.

-- 31. acumulados_iva — IVA acumulado por tercero/tarifa/período.
CREATE TABLE acumulados_iva (
  id            BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id   BIGINT NOT NULL,
  anio          INTEGER NOT NULL,
  periodo       VARCHAR(2) NOT NULL,                      -- '00'–'18' por convención (sin CHECK en postgresql/)
  tercero_id    BIGINT NOT NULL,
  tarifa_iva_id BIGINT NOT NULL,
  base          NUMERIC(18,2) NOT NULL DEFAULT 0,         -- base acumulada
  valor         NUMERIC(18,2) NOT NULL DEFAULT 0,         -- IVA acumulado
  CONSTRAINT acumulados_iva_pk PRIMARY KEY (id),
  CONSTRAINT acumulados_iva_uk UNIQUE (compania_id, anio, periodo, tercero_id, tarifa_iva_id),
  CONSTRAINT acumulados_iva_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT acumulados_iva_tercero_fk FOREIGN KEY (compania_id, tercero_id)
    REFERENCES terceros (compania_id, id),
  CONSTRAINT acumulados_iva_tarifa_fk FOREIGN KEY (compania_id, tarifa_iva_id)
    REFERENCES tarifas_iva (compania_id, id),
  CONSTRAINT acumulados_iva_anio_ck CHECK (anio BETWEEN 1900 AND 2999)
);
-- tabla derivada: la regeneración suma las líneas de clase 'IVA' del libro.

-- 32. estado_acumulaciones — último período acumulado por tipo.
--    La UI avisa si quedó desactualizada frente al libro.
CREATE TABLE estado_acumulaciones (
  id                BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id       BIGINT NOT NULL,
  anio              INTEGER NOT NULL,
  tipo              VARCHAR(30) NOT NULL,
  periodo_hasta     VARCHAR(2) NOT NULL,                  -- último período acumulado
  ultima_acumulacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT estado_acumulaciones_pk PRIMARY KEY (id),
  CONSTRAINT estado_acumulaciones_uk UNIQUE (compania_id, anio, tipo),
  CONSTRAINT estado_acumulaciones_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT estado_acumulaciones_anio_ck CHECK (anio BETWEEN 1900 AND 2999),
  CONSTRAINT estado_acumulaciones_tipo_ck CHECK (tipo IN ('Retencion', 'Iva', 'Terceros', 'Centros'))
);

-- =====================================================================
-- módulo 5 — impuestos: medios magnéticos (entidades 33–39)
-- =====================================================================

-- 33. formatos_exogenos — formatos de información exógena (1001, 1007, 2275…).
CREATE TABLE formatos_exogenos (
  id           BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id  BIGINT NOT NULL,
  codigo       VARCHAR(30) NOT NULL,
  nombre       VARCHAR(255) NOT NULL,
  vigencia     INTEGER NOT NULL,                          -- año de vigencia del formato
  activo       BOOLEAN NOT NULL DEFAULT true,
  eliminado_en TIMESTAMP,                                 -- borrado lógico (NULL = vigente)
  creado_en    TIMESTAMP,
  creado_por   INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT formatos_exogenos_pk PRIMARY KEY (id),
  CONSTRAINT formatos_exogenos_codigo_uk UNIQUE (compania_id, codigo, vigencia),
  CONSTRAINT formatos_exogenos_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id)
);

-- 34. formato_conceptos — conceptos de un formato (tarifa/cuenta).
--    Detalle puro de formatos_exogenos: sin compania_id ni auditoría propias.
CREATE TABLE formato_conceptos (
  id         BIGINT GENERATED ALWAYS AS IDENTITY,
  formato_id BIGINT NOT NULL,
  codigo     VARCHAR(30) NOT NULL,
  nombre     VARCHAR(255) NOT NULL,
  tarifa     NUMERIC(9,6) NOT NULL DEFAULT 0,
  cuenta_id  BIGINT,                                      -- cuenta asociada al concepto
  CONSTRAINT formato_conceptos_pk PRIMARY KEY (id),
  CONSTRAINT formato_conceptos_formato_fk FOREIGN KEY (formato_id)
    REFERENCES formatos_exogenos (id) ON DELETE CASCADE,
  CONSTRAINT formato_conceptos_cuenta_fk FOREIGN KEY (cuenta_id) REFERENCES cuentas (id)
);

-- 35. formato_asignaciones — cuentas del plan asignadas a un formato (árbol con checkbox).
--    Detalle puro de formatos_exogenos: sin compania_id ni auditoría propias.
CREATE TABLE formato_asignaciones (
  id         BIGINT GENERATED ALWAYS AS IDENTITY,
  formato_id BIGINT NOT NULL,
  cuenta_id  BIGINT NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT formato_asignaciones_pk PRIMARY KEY (id),
  CONSTRAINT formato_asignaciones_uk UNIQUE (formato_id, cuenta_id),
  CONSTRAINT formato_asignaciones_formato_fk FOREIGN KEY (formato_id)
    REFERENCES formatos_exogenos (id) ON DELETE CASCADE,
  CONSTRAINT formato_asignaciones_cuenta_fk FOREIGN KEY (cuenta_id) REFERENCES cuentas (id)
);

-- 36. generaciones_medios — generaciones de medios por compañía/año.
--    B08: numero_generacion identifica la generación; version es el control
--    optimista. Sin creado_en/creado_por: se registra generado_en/generado_por.
CREATE TABLE generaciones_medios (
  id                BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id       BIGINT NOT NULL,
  anio              INTEGER NOT NULL,
  numero_generacion INTEGER NOT NULL DEFAULT 1,
  parametros        CLOB NOT NULL DEFAULT '{}',  -- JSON: validar en el servicio
  estado            VARCHAR(30) NOT NULL DEFAULT 'Generado',
  generado_por      INTEGER,
  generado_en       TIMESTAMP,
  actualizado_en    TIMESTAMP,
  actualizado_por   INTEGER,
  version           INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT generaciones_medios_pk PRIMARY KEY (id),
  CONSTRAINT generaciones_medios_uk UNIQUE (compania_id, anio, numero_generacion),
  CONSTRAINT generaciones_medios_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT generaciones_medios_anio_ck CHECK (anio BETWEEN 1900 AND 2999),
  CONSTRAINT generaciones_medios_estado_ck CHECK (estado IN ('Generado', 'Revisado', 'Exportado'))
);

-- 37. medio_filas — filas del medio generado (revisión editable).
--    Detalle puro de generaciones_medios: sin compania_id ni auditoría propias.
CREATE TABLE medio_filas (
  id            BIGINT GENERATED ALWAYS AS IDENTITY,
  generacion_id BIGINT NOT NULL,
  formato_id    BIGINT NOT NULL,
  tercero_id    BIGINT,
  concepto_id   BIGINT,
  cuenta_id     BIGINT,
  valor         NUMERIC(18,2) NOT NULL DEFAULT 0,
  base          NUMERIC(18,2) NOT NULL DEFAULT 0,
  ajustado      BOOLEAN NOT NULL DEFAULT false,           -- corrección manual en revisión
  detalle       CLOB NOT NULL DEFAULT '{}',  -- JSON: validar en el servicio
  CONSTRAINT medio_filas_pk PRIMARY KEY (id),
  CONSTRAINT medio_filas_generacion_fk FOREIGN KEY (generacion_id)
    REFERENCES generaciones_medios (id) ON DELETE CASCADE,
  CONSTRAINT medio_filas_formato_fk FOREIGN KEY (formato_id) REFERENCES formatos_exogenos (id),
  CONSTRAINT medio_filas_tercero_fk FOREIGN KEY (tercero_id) REFERENCES terceros (id),
  CONSTRAINT medio_filas_concepto_fk FOREIGN KEY (concepto_id) REFERENCES formato_conceptos (id),
  CONSTRAINT medio_filas_cuenta_fk FOREIGN KEY (cuenta_id) REFERENCES cuentas (id)
);

-- 38. medio_topes — topes de depuración por formato/concepto.
CREATE TABLE medio_topes (
  id          BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id BIGINT NOT NULL,
  anio        INTEGER NOT NULL,
  formato_id  BIGINT NOT NULL,
  concepto_id BIGINT,                                     -- nulo = aplica al formato completo
  tope        NUMERIC(18,2) NOT NULL DEFAULT 0,
  CONSTRAINT medio_topes_pk PRIMARY KEY (id),
  CONSTRAINT medio_topes_uk UNIQUE (compania_id, anio, formato_id, concepto_id),
  CONSTRAINT medio_topes_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT medio_topes_formato_fk FOREIGN KEY (formato_id) REFERENCES formatos_exogenos (id),
  CONSTRAINT medio_topes_concepto_fk FOREIGN KEY (concepto_id) REFERENCES formato_conceptos (id),
  CONSTRAINT medio_topes_anio_ck CHECK (anio BETWEEN 1900 AND 2999)
);

-- 39. medio_conciliaciones — conciliación de una generación.
--    total contable vs exclusiones/topes/ajustes/reportado.
CREATE TABLE medio_conciliaciones (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  generacion_id   BIGINT NOT NULL,
  total_contable  NUMERIC(18,2) NOT NULL DEFAULT 0,
  exclusiones     NUMERIC(18,2) NOT NULL DEFAULT 0,
  topes           NUMERIC(18,2) NOT NULL DEFAULT 0,
  ajustes         NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_reportado NUMERIC(18,2) NOT NULL DEFAULT 0,
  cuadrado        BOOLEAN NOT NULL DEFAULT true,          -- contable == reportado tras depuración
  CONSTRAINT medio_conciliaciones_pk PRIMARY KEY (id),
  CONSTRAINT medio_conciliaciones_uk UNIQUE (generacion_id),
  CONSTRAINT medio_conciliaciones_generacion_fk FOREIGN KEY (generacion_id)
    REFERENCES generaciones_medios (id) ON DELETE CASCADE
);

-- =====================================================================
-- módulo 6 — procesos (entidades 40–44)
-- =====================================================================

-- 40. procesos — reprocesos, revalorizaciones y auditorías masivas.
CREATE TABLE procesos (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id         BIGINT NOT NULL,
  anio                INTEGER NOT NULL,
  tipo                VARCHAR(100) NOT NULL,              -- 'Reproceso mensual', 'Revalorizacion', …
  estado              VARCHAR(30) NOT NULL DEFAULT 'Configurado',
  alcance             CLOB NOT NULL DEFAULT '{}',  -- JSON: validar en el servicio (parámetros del proceso)
  simulacion          CLOB NOT NULL DEFAULT '{}',  -- JSON: validar en el servicio
  reporte_diferencias CLOB NOT NULL DEFAULT '{}',  -- JSON: validar en el servicio
  respaldo_realizado  BOOLEAN NOT NULL DEFAULT false,     -- se tomó respaldo antes de ejecutar
  resultado           CLOB NOT NULL DEFAULT '{}',  -- JSON: validar en el servicio (resultado final)
  usuario_id          INTEGER NOT NULL,                   -- usuario responsable (referencia de aplicación a usuarios)
  creado_en           TIMESTAMP,
  creado_por          INTEGER,
  actualizado_en      TIMESTAMP,
  actualizado_por     INTEGER,
  version             INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT procesos_pk PRIMARY KEY (id),
  CONSTRAINT procesos_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT procesos_anio_ck CHECK (anio BETWEEN 1900 AND 2999),
  CONSTRAINT procesos_estado_ck CHECK (estado IN
    ('Configurado', 'Simulado', 'Ejecutando', 'Completado', 'Fallido'))
);

-- 41. cierres — cierres contables (checklist + comprobante de cierre).
CREATE TABLE cierres (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id         BIGINT NOT NULL,
  anio                INTEGER NOT NULL,
  estado              VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
  checklist           CLOB NOT NULL DEFAULT '{}',  -- JSON: validar en el servicio (conciliaciones, lotes, descuadres…)
  comprobante_id      BIGINT,                             -- comprobante del asiento de cierre
  cuenta_resultado_id BIGINT,                             -- cuenta de resultados a cerrar
  documento           VARCHAR(60),                        -- documento generado
  fecha               DATE,                               -- fecha del cierre
  usuario_id          INTEGER NOT NULL,                   -- usuario responsable (referencia de aplicación a usuarios)
  creado_en           TIMESTAMP,
  creado_por          INTEGER,
  actualizado_en      TIMESTAMP,
  actualizado_por     INTEGER,
  version             INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT cierres_pk PRIMARY KEY (id),
  CONSTRAINT cierres_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT cierres_comprobante_fk FOREIGN KEY (comprobante_id) REFERENCES comprobantes (id),
  CONSTRAINT cierres_cuenta_resultado_fk FOREIGN KEY (cuenta_resultado_id) REFERENCES cuentas (id),
  CONSTRAINT cierres_anio_ck CHECK (anio BETWEEN 1900 AND 2999),
  CONSTRAINT cierres_estado_ck CHECK (estado IN ('Pendiente', 'Ejecutado', 'Anulado'))
);

-- 42. cierre_traslados — traslados de períodos 13–18 a 01–06 (matriz origen/destino).
--    Detalle puro de cierres: sin compania_id ni auditoría propias.
CREATE TABLE cierre_traslados (
  id             BIGINT GENERATED ALWAYS AS IDENTITY,
  cierre_id      BIGINT NOT NULL,
  origen_periodo  VARCHAR(2) NOT NULL,                    -- '13'..'18'
  destino_periodo VARCHAR(2) NOT NULL,                    -- '01'..'06'
  cuenta_id      BIGINT,                                  -- cuenta a trasladar (nulo = todas)
  debito         NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito        NUMERIC(18,2) NOT NULL DEFAULT 0,
  CONSTRAINT cierre_traslados_pk PRIMARY KEY (id),
  CONSTRAINT cierre_traslados_cierre_fk FOREIGN KEY (cierre_id) REFERENCES cierres (id) ON DELETE CASCADE,
  CONSTRAINT cierre_traslados_cuenta_fk FOREIGN KEY (cuenta_id) REFERENCES cuentas (id)
);

-- 43. consolidaciones — consolidación multiempresa.
CREATE TABLE consolidaciones (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_destino_id  BIGINT NOT NULL,                   -- destino: compañía solo-consolidación
  anio                 INTEGER NOT NULL,
  estado               VARCHAR(30) NOT NULL DEFAULT 'Configurado',
  compatibilidad       CLOB NOT NULL DEFAULT '{}',  -- JSON: validar en el servicio (plan de cuentas compatible)
  simulacion           CLOB NOT NULL DEFAULT '{}',  -- JSON: validar en el servicio
  respaldo_realizado   BOOLEAN NOT NULL DEFAULT false,
  confirmacion_vaciado BOOLEAN NOT NULL DEFAULT false,    -- acepta vaciar el destino
  ejecutado_por        INTEGER,
  ejecutado_en         TIMESTAMP,
  creado_en            TIMESTAMP,
  creado_por           INTEGER,
  actualizado_en       TIMESTAMP,
  actualizado_por      INTEGER,
  version              INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT consolidaciones_pk PRIMARY KEY (id),
  CONSTRAINT consolidaciones_compania_destino_fk FOREIGN KEY (compania_destino_id)
    REFERENCES companias (id),
  CONSTRAINT consolidaciones_anio_ck CHECK (anio BETWEEN 1900 AND 2999),
  CONSTRAINT consolidaciones_estado_ck CHECK (estado IN
    ('Configurado', 'Simulado', 'Ejecutado', 'Anulado'))
);

-- 44. consolidacion_origenes — compañías origen de una consolidación.
--    Detalle puro de consolidaciones: sin compania_id ni auditoría propias.
CREATE TABLE consolidacion_origenes (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY,
  consolidacion_id   BIGINT NOT NULL,
  compania_origen_id BIGINT NOT NULL,
  incluida           BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT consolidacion_origenes_pk PRIMARY KEY (id),
  CONSTRAINT consolidacion_origenes_uk UNIQUE (consolidacion_id, compania_origen_id),
  CONSTRAINT consolidacion_origenes_consolidacion_fk FOREIGN KEY (consolidacion_id)
    REFERENCES consolidaciones (id) ON DELETE CASCADE,
  CONSTRAINT consolidacion_origenes_compania_origen_fk FOREIGN KEY (compania_origen_id)
    REFERENCES companias (id)
);

-- =====================================================================
-- módulo 7 — seguridad (entidades 45–51)
-- =====================================================================

-- 45. roles — roles del sistema (Administrador, Contador principal, Auxiliar…).
--    Tabla global: sin compania_id ni auditoría propias (00_convenciones.md §4).
CREATE TABLE roles (
  id          BIGINT GENERATED ALWAYS AS IDENTITY,
  codigo      VARCHAR(30) NOT NULL,                       -- 'ADMIN', 'CONTADOR'…
  nombre      VARCHAR(255) NOT NULL,                      -- 'Administrador'
  descripcion CLOB,
  CONSTRAINT roles_pk PRIMARY KEY (id),
  CONSTRAINT roles_codigo_uk UNIQUE (codigo)
);

-- 46. permisos — permisos funcionales.
--    Tabla global: sin compania_id ni auditoría propias.
CREATE TABLE permisos (
  id     BIGINT GENERATED ALWAYS AS IDENTITY,
  codigo VARCHAR(100) NOT NULL,                           -- 'mov.capturar', 'mov.lotes.aprobar', …
  nombre VARCHAR(255) NOT NULL,
  modulo VARCHAR(60) NOT NULL,                            -- módulo al que pertenece
  CONSTRAINT permisos_pk PRIMARY KEY (id),
  CONSTRAINT permisos_codigo_uk UNIQUE (codigo)
);

-- 47. rol_permisos — permisos por rol.
--    Tabla puente global: sin id propio, sin compania_id ni auditoría
--    (igual en postgresql/); la UK compuesta actúa como clave.
CREATE TABLE rol_permisos (
  rol_id     BIGINT NOT NULL,
  permiso_id BIGINT NOT NULL,
  CONSTRAINT rol_permisos_uk UNIQUE (rol_id, permiso_id),
  CONSTRAINT rol_permisos_rol_fk FOREIGN KEY (rol_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT rol_permisos_permiso_fk FOREIGN KEY (permiso_id) REFERENCES permisos (id) ON DELETE CASCADE
);

-- 48. usuarios — usuarios del sistema.
--    Tabla global: sin compania_id propia; el acceso por compañía es
--    usuario_companias (entidad 51).
CREATE TABLE usuarios (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  nombre          VARCHAR(255) NOT NULL,                  -- nombre completo
  email           VARCHAR(200),                           -- correo (opcional)
  rol_id          BIGINT NOT NULL,
  iniciales       VARCHAR(10),                            -- iniciales para sellos
  activo          BOOLEAN NOT NULL DEFAULT true,
  eliminado_en    TIMESTAMP,                              -- borrado lógico (NULL = vigente)
  creado_en       TIMESTAMP,
  creado_por      INTEGER,
  actualizado_en  TIMESTAMP,
  actualizado_por INTEGER,
  version         INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT usuarios_pk PRIMARY KEY (id),
  CONSTRAINT usuarios_email_uk UNIQUE (email),
  CONSTRAINT usuarios_rol_fk FOREIGN KEY (rol_id) REFERENCES roles (id)
);

-- 49. auditoria — bitácora de acciones sensibles (inmutable).
--    Append-only: el sistema no permite UPDATE ni DELETE. Sin creado_por/
--    actualizado_*: solo creado_en obligatorio.
CREATE TABLE auditoria (
  id          BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id BIGINT,                                     -- nulo si es global
  anio        INTEGER,                                    -- año contable afectado
  usuario_id  BIGINT,
  rol_id      BIGINT,
  accion      VARCHAR(200) NOT NULL,                      -- 'Aprobación de lote'
  modulo      VARCHAR(60) NOT NULL,                       -- 'Lotes'
  detalle     CLOB,                                       -- descripción
  resultado   VARCHAR(10) NOT NULL DEFAULT 'EXITO',
  parametros  CLOB NOT NULL DEFAULT '{}',  -- JSON: validar en el servicio (parámetros de la acción)
  impacto     CLOB NOT NULL DEFAULT '{}',  -- JSON: validar en el servicio (tablas/registros afectados)
  motivo      CLOB,                                       -- motivo (si aplica)
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT auditoria_pk PRIMARY KEY (id),
  CONSTRAINT auditoria_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT auditoria_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT auditoria_rol_fk FOREIGN KEY (rol_id) REFERENCES roles (id),
  CONSTRAINT auditoria_resultado_ck CHECK (resultado IN ('EXITO', 'FALLO', 'INFO'))
);
-- inmutabilidad y reglas de retención: garantías de aplicación (ver 00_convenciones.md).

-- 50. integraciones — sincronización con módulos externos.
CREATE TABLE integraciones (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id           BIGINT NOT NULL,
  modulo                VARCHAR(60) NOT NULL,             -- 'Facturacion', 'Cartera', …
  estado                VARCHAR(30) NOT NULL DEFAULT 'Desconectado',
  ultima_sincronizacion TIMESTAMP,
  configuracion         CLOB NOT NULL DEFAULT '{}',  -- JSON: validar en el servicio (parámetros de conexión)
  actualizado_en        TIMESTAMP,
  actualizado_por       INTEGER,
  version               INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT integraciones_pk PRIMARY KEY (id),
  CONSTRAINT integraciones_uk UNIQUE (compania_id, modulo),
  CONSTRAINT integraciones_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT integraciones_estado_ck CHECK (estado IN ('Conectado', 'Desconectado', 'Bloqueado'))
);

-- 51. usuario_companias — acceso de usuarios a compañías (B14).
--    Catálogo intermedio: sin compania_id ni auditoría propias.
CREATE TABLE usuario_companias (
  id          BIGINT GENERATED ALWAYS AS IDENTITY,
  usuario_id  BIGINT NOT NULL,
  compania_id BIGINT NOT NULL,
  CONSTRAINT usuario_companias_pk PRIMARY KEY (id),
  CONSTRAINT usuario_companias_uk UNIQUE (usuario_id, compania_id),
  CONSTRAINT usuario_companias_usuario_fk FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT usuario_companias_compania_fk FOREIGN KEY (compania_id)
    REFERENCES companias (id) ON DELETE CASCADE
);

-- =====================================================================
-- módulo 8 — presupuesto (entidades 52–54)
-- =====================================================================

-- 52. presupuestos — presupuestos por compañía/año.
CREATE TABLE presupuestos (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id     BIGINT NOT NULL,
  anio            INTEGER NOT NULL,
  nombre          VARCHAR(255) NOT NULL,                  -- nombre del presupuesto
  estado          VARCHAR(30) NOT NULL DEFAULT 'Borrador',
  creado_en       TIMESTAMP,
  creado_por      INTEGER,
  actualizado_en  TIMESTAMP,
  actualizado_por INTEGER,
  version         INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT presupuestos_pk PRIMARY KEY (id),
  CONSTRAINT presupuestos_uk UNIQUE (compania_id, anio, nombre),
  CONSTRAINT presupuestos_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  CONSTRAINT presupuestos_anio_ck CHECK (anio BETWEEN 1900 AND 2999),
  CONSTRAINT presupuestos_estado_ck CHECK (estado IN ('Borrador', 'Aprobado'))
);

-- 53. presupuesto_rubros — estructura Departamento → Grupo → Sección → Código.
--    Detalle puro de presupuestos: sin compania_id ni auditoría propias.
CREATE TABLE presupuesto_rubros (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  presupuesto_id  BIGINT NOT NULL,
  departamento    VARCHAR(255) NOT NULL,                  -- nivel 1
  grupo           VARCHAR(255) NOT NULL,                  -- nivel 2
  seccion         VARCHAR(255) NOT NULL,                  -- nivel 3
  codigo          VARCHAR(30) NOT NULL,                   -- nivel 4
  nombre          VARCHAR(255) NOT NULL DEFAULT '',       -- concepto/nombre del rubro (B13)
  concepto        CLOB NOT NULL DEFAULT '',               -- detalle
  centro_costo_id BIGINT,                                 -- centro asociado (opcional)
  parent_id       BIGINT,                                 -- jerarquía
  orden           INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT presupuesto_rubros_pk PRIMARY KEY (id),
  CONSTRAINT presupuesto_rubros_uk UNIQUE (presupuesto_id, codigo, centro_costo_id),
  CONSTRAINT presupuesto_rubros_presupuesto_fk FOREIGN KEY (presupuesto_id)
    REFERENCES presupuestos (id) ON DELETE CASCADE,
  CONSTRAINT presupuesto_rubros_centro_costo_fk FOREIGN KEY (centro_costo_id)
    REFERENCES centros_costos (id),
  CONSTRAINT presupuesto_rubros_parent_fk FOREIGN KEY (parent_id)
    REFERENCES presupuesto_rubros (id)
);

-- 54. presupuesto_valores — valores por rubro/período (presupuesto o ejecución).
--    Detalle puro de presupuesto_rubros: sin compania_id ni auditoría propias.
CREATE TABLE presupuesto_valores (
  id       BIGINT GENERATED ALWAYS AS IDENTITY,
  rubro_id BIGINT NOT NULL,
  periodo  VARCHAR(2) NOT NULL,                           -- '00'–'13' en presupuesto
  tipo     VARCHAR(30) NOT NULL DEFAULT 'Presupuesto',
  valor    NUMERIC(18,2) NOT NULL DEFAULT 0,
  CONSTRAINT presupuesto_valores_pk PRIMARY KEY (id),
  CONSTRAINT presupuesto_valores_uk UNIQUE (rubro_id, periodo, tipo),
  CONSTRAINT presupuesto_valores_rubro_fk FOREIGN KEY (rubro_id)
    REFERENCES presupuesto_rubros (id) ON DELETE CASCADE,
  CONSTRAINT presupuesto_valores_periodo_ck CHECK (periodo IN
    ('00','01','02','03','04','05','06',
     '07','08','09','10','11','12','13')),
  CONSTRAINT presupuesto_valores_tipo_ck CHECK (tipo IN ('Presupuesto', 'Ejecucion'))
);

-- =====================================================================
-- módulo 9 — ampliaciones (entidades 55–60)
-- =====================================================================

-- 55. tercero_cuentas_bancarias — cuentas bancarias de terceros (ADMCUENTA).
CREATE TABLE tercero_cuentas_bancarias (
  id          BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id BIGINT NOT NULL,
  tercero_id  BIGINT NOT NULL,
  tipo        VARCHAR(30) NOT NULL DEFAULT 'Ahorros',
  numero      VARCHAR(30) NOT NULL,                       -- texto: preserva ceros iniciales
  principal   BOOLEAN NOT NULL DEFAULT false,
  observacion CLOB,
  creado_en   TIMESTAMP,
  creado_por  INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version     INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT tercero_cuentas_bancarias_pk PRIMARY KEY (id),
  -- B05: FK compuesta — la cuenta bancaria pertenece a la misma compañía del tercero
  CONSTRAINT tercero_cuentas_bancarias_fk FOREIGN KEY (compania_id, tercero_id)
    REFERENCES terceros (compania_id, id),
  CONSTRAINT tercero_cuentas_bancarias_tipo_ck CHECK (tipo IN ('Ahorros', 'Corriente', 'Otro'))
);

-- 56. reembolsos — reembolsos de caja menor (REEMBOL01: encabezado).
CREATE TABLE reembolsos (
  id            BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id   BIGINT NOT NULL,
  anio          INTEGER NOT NULL,
  numero        VARCHAR(60) NOT NULL,                     -- número del reembolso
  fecha         DATE NOT NULL,
  periodo       VARCHAR(2) NOT NULL,                      -- '00'–'18' por convención (sin CHECK en postgresql/)
  tercero_id    BIGINT NOT NULL,                          -- beneficiario
  caja_menor    VARCHAR(100),                             -- identificación de la caja
  estado        VARCHAR(30) NOT NULL DEFAULT 'Borrador',
  lote_id       BIGINT,                                   -- lote generado al aplicar (referencia lógica a lotes)
  usuario_id    BIGINT NOT NULL,                          -- responsable
  creado_en     TIMESTAMP,
  creado_por    INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version       INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT reembolsos_pk PRIMARY KEY (id),
  CONSTRAINT reembolsos_tercero_fk FOREIGN KEY (compania_id, tercero_id)
    REFERENCES terceros (compania_id, id),
  CONSTRAINT reembolsos_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT reembolsos_anio_ck CHECK (anio BETWEEN 1900 AND 2999),
  CONSTRAINT reembolsos_estado_ck CHECK (estado IN ('Borrador', 'Aplicado', 'Anulado'))
);
-- nota: la FK a usuarios(id) está declarada en 01_entidades.md; postgresql/
-- todavía no la declara (queda como referencia de aplicación) — mismo caso
-- que procesos.usuario_id y cierres.usuario_id, que aquí se conservan como
-- INTEGER sin FK, fieles a la implementación.

-- 57. reembolso_lineas — detalle del reembolso.
--    Detalle puro de reembolsos: sin auditoría propia.
CREATE TABLE reembolso_lineas (
  id                BIGINT GENERATED ALWAYS AS IDENTITY,
  reembolso_id      BIGINT NOT NULL,
  compania_id       BIGINT NOT NULL,                      -- aislamiento (B05)
  numero_linea      INTEGER NOT NULL,
  cuenta_id         BIGINT NOT NULL,
  centro_costo_id   BIGINT,
  concepto          CLOB,
  debito            NUMERIC(18,2) NOT NULL DEFAULT 0,
  credito           NUMERIC(18,2) NOT NULL DEFAULT 0,
  documento_soporte VARCHAR(60),                          -- documento que soporta el gasto
  CONSTRAINT reembolso_lineas_pk PRIMARY KEY (id),
  CONSTRAINT reembolso_lineas_reembolso_fk FOREIGN KEY (reembolso_id)
    REFERENCES reembolsos (id) ON DELETE CASCADE,
  CONSTRAINT reembolso_lineas_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  -- B05: FK compuestas
  CONSTRAINT reembolso_lineas_cuenta_fk FOREIGN KEY (compania_id, cuenta_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT reembolso_lineas_centro_fk FOREIGN KEY (compania_id, centro_costo_id)
    REFERENCES centros_costos (compania_id, id),
  CONSTRAINT reembolso_lineas_sin_doble_valor_ck CHECK (debito = 0 OR credito = 0),
  CONSTRAINT reembolso_lineas_debito_ck CHECK (debito >= 0),
  CONSTRAINT reembolso_lineas_credito_ck CHECK (credito >= 0)
);

-- 58. activos — activos fijos y amortizables (INTEACT2/INTEACT3).
CREATE TABLE activos (
  id             BIGINT GENERATED ALWAYS AS IDENTITY,
  compania_id    BIGINT NOT NULL,
  codigo         VARCHAR(30) NOT NULL,
  nombre         VARCHAR(255) NOT NULL,
  tipo           VARCHAR(30) NOT NULL DEFAULT 'Activo',
  cuenta_activo_id BIGINT,                                -- cuenta del activo
  cuenta_gasto_id  BIGINT,                                -- cuenta del gasto de depreciación
  cuenta_depreciacion_id BIGINT,                          -- depreciación acumulada
  costo          NUMERIC(18,2) NOT NULL DEFAULT 0,
  vida_util_meses INTEGER NOT NULL DEFAULT 0,
  valor_residual NUMERIC(18,2) NOT NULL DEFAULT 0,
  fecha_adquisicion DATE,
  fecha_baja     DATE,
  estado         VARCHAR(30) NOT NULL DEFAULT 'Activo',
  creado_en      TIMESTAMP,
  creado_por     INTEGER,
  actualizado_en TIMESTAMP,
  actualizado_por INTEGER,
  version        INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT activos_pk PRIMARY KEY (id),
  CONSTRAINT activos_codigo_uk UNIQUE (compania_id, codigo),
  CONSTRAINT activos_compania_fk FOREIGN KEY (compania_id) REFERENCES companias (id),
  -- B05: FK compuestas hacia el plan de cuentas
  CONSTRAINT activos_cuenta_activo_fk FOREIGN KEY (compania_id, cuenta_activo_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT activos_cuenta_gasto_fk FOREIGN KEY (compania_id, cuenta_gasto_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT activos_cuenta_depreciacion_fk FOREIGN KEY (compania_id, cuenta_depreciacion_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT activos_tipo_ck CHECK (tipo IN ('Activo', 'Amortizable')),
  CONSTRAINT activos_estado_ck CHECK (estado IN ('Activo', 'Baja', 'Totalmente depreciado'))
);

-- 59. activo_cuotas — cuota mensual de depreciación por activo.
--    Detalle puro de activos: sin compania_id ni auditoría propias.
CREATE TABLE activo_cuotas (
  id         BIGINT GENERATED ALWAYS AS IDENTITY,
  activo_id  BIGINT NOT NULL,
  anio       INTEGER NOT NULL,
  periodo    VARCHAR(2) NOT NULL,
  valor      NUMERIC(18,2) NOT NULL DEFAULT 0,
  aplicada   BOOLEAN NOT NULL DEFAULT false,              -- ¿ya generó asiento?
  lote_id    BIGINT,                                      -- lote del asiento generado (referencia lógica a lotes)
  CONSTRAINT activo_cuotas_pk PRIMARY KEY (id),
  CONSTRAINT activo_cuotas_uk UNIQUE (activo_id, anio, periodo),
  CONSTRAINT activo_cuotas_activo_fk FOREIGN KEY (activo_id)
    REFERENCES activos (id) ON DELETE CASCADE,
  CONSTRAINT activo_cuotas_anio_ck CHECK (anio BETWEEN 1900 AND 2999),
  CONSTRAINT activo_cuotas_periodo_ck CHECK (periodo IN
    ('00','01','02','03','04','05','06',
     '07','08','09','10','11','12',
     '13','14','15','16','17','18'))
);

-- 60. activo_distribuciones — distribución de la depreciación por centro.
--    Detalle puro de activos: sin compania_id ni auditoría propias.
CREATE TABLE activo_distribuciones (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  activo_id       BIGINT NOT NULL,
  compania_id     BIGINT NOT NULL,                        -- aislamiento (B05)
  centro_costo_id BIGINT NOT NULL,
  porcentaje      NUMERIC(9,6) NOT NULL DEFAULT 0,        -- fracción distribuida al centro
  CONSTRAINT activo_distribuciones_pk PRIMARY KEY (id),
  CONSTRAINT activo_distribuciones_uk UNIQUE (activo_id, centro_costo_id),
  CONSTRAINT activo_distribuciones_activo_fk FOREIGN KEY (activo_id)
    REFERENCES activos (id) ON DELETE CASCADE,
  CONSTRAINT activo_distribuciones_centro_fk FOREIGN KEY (compania_id, centro_costo_id)
    REFERENCES centros_costos (compania_id, id)
);
-- la suma de porcentajes de un activo debe ser 1 (100 %): garantía de
-- aplicación/servicio, no expresable en ANSI (ver 00_convenciones.md §2).

-- =====================================================================
-- Garantías fuera del estándar
-- ---------------------------------------------------------------------
-- Garantías del modelo que ANSI no puede declarar; cada implementación las
-- traduce con su mecanismo nativo (ver 02_indices.md y 03_reglas_negocio.md):
--
-- 1. UK parcial de documentos (un documento solo Contabilizado una vez por
--    compañía/año, excluida la historia migrada): índice único parcial
--    WHERE estado = 'Contabilizado' AND origen <> 'Migracion'
--    (postgresql/: documentos_contabilizado_uk en 10_indices.sql). La
--    exclusión responde a que en el legado (CONDOCUM) la etiqueta DDOCUM no
--    es única: sobre 735.976 cabeceras, (anio, documento) colisiona 73.236
--    veces, y (comprobante + tipo documental + fecha + documento + valor)
--    todavía colisiona 29.059 veces (db/migration/07_decisiones_del_libro.md).
--    Motores sin índices parciales: columna derivada o tabla auxiliar
--    mantenida por el servicio (mapeo_motores.md §3).
--
-- 2. Índices trigram de texto: búsqueda por nombre en cuentas y terceros
--    (postgresql/: extensión pg_trgm + índices GIN). Motores sin trigramas:
--    LIKE con índice de subcadenas o búsqueda en el servicio (02_indices.md §1).
--
-- 3. Triggers de auditoría (implementar por motor): antes de cada UPDATE
--    sellan actualizado_en y avanzan version en toda tabla con el bloque de
--    auditoría (postgresql/: funciones auditoria_antes_update/insert +
--    triggers por tabla en 01_dominios.sql y cada módulo). En INSERT se
--    completa creado_en y version cuando vienen nulos.
--
-- 4. Regeneración de acumulados: saldos_* y acumulados_* son derivados del
--    libro (documentos/documento_lineas) y se reconstruyen con un proceso de
--    regeneración que jamás toca el libro; estado_acumulaciones registra el
--    avance por tipo (03_reglas_negocio.md §5).
--
-- Otras notas de traducción por motor (detalles que no caben en ANSI):
--   * idempotency_key (CHAR(36)): el uuid lo genera el motor o la aplicación;
--     postgresql/ usa DEFAULT gen_random_uuid().
--   * filas calientes (consecutivos_comprobantes y saldos_*): postgresql/ usa
--     fillfactor reducido y bloqueo FOR UPDATE para el consecutivo; en motores
--     sin esas facilidades se emula con transacciones y bloqueo de fila.
--   * CLOB con contenido JSON (columnas tipo `documento`): la validación del
--     JSON vive en el servicio; postgresql/ usa jsonb.
--   * los índices auxiliares no únicos (listados de lotes, documentos por
--     período, bitácora, etc.) no son parte del modelo: ver 02_indices.md.
--   * checks de catálogo que postgresql/ omite en tablas derivadas (p. ej.
--     `periodo` en saldos/acumulados y `origen` en lotes/líneas) se conservan
--     omitidos aquí para no divergir de la implementación real.
--   * este documento declara 60 sentencias CREATE TABLE (las 60 entidades de
--     01_entidades.md, numeradas y en orden de módulos).
-- =====================================================================
