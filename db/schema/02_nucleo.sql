-- =====================================================================
-- CONTABDSI · 02_nucleo.sql
-- Compañías, años contables, períodos y parámetros de operación.
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Compañías. Equivale a la "carpeta de empresa" del legado VISION.
-- -------------------------------------------------------------------
CREATE TABLE companias (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo              text NOT NULL,                        -- '001'
  nombre              text NOT NULL,                        -- CONCTR.CTCIA (nombre)
  nit                 text NOT NULL,                        -- CONCTR.CTNIT
  digito              text NOT NULL,                        -- Dígito de verificación
  estado              text NOT NULL DEFAULT 'Activa'
                        CHECK (estado IN ('Activa', 'Inactiva')),
  solo_consolidacion  boolean NOT NULL DEFAULT false,       -- Destino de consolidación
  creado_en           timestamptz,
  creado_por          integer,
  actualizado_en      timestamptz,
  actualizado_por     integer,
  version             integer NOT NULL DEFAULT 0,
  CONSTRAINT companias_codigo_uk UNIQUE (codigo),
  CONSTRAINT companias_nit_uk UNIQUE (nit, digito)
);

-- -------------------------------------------------------------------
-- Años contables por compañía (clave compañía/año del contrato).
-- -------------------------------------------------------------------
CREATE TABLE compania_anios (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id  bigint NOT NULL REFERENCES companias (id),
  anio         integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  creado_en    timestamptz,
  creado_por   integer,
  actualizado_en timestamptz,
  actualizado_por integer,
  version      integer NOT NULL DEFAULT 0,
  CONSTRAINT compania_anios_uk UNIQUE (compania_id, anio)
);

-- -------------------------------------------------------------------
-- Períodos por compañía/año.
-- '00' = saldos iniciales, '01'..'12' = meses, '13'..'18' = ajustes.
-- El estado por período controla el cierre (período cerrado = solo lectura).
-- -------------------------------------------------------------------
CREATE TABLE periodos_contables (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id  bigint NOT NULL REFERENCES companias (id),
  anio         integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  periodo      text NOT NULL CHECK (periodo IN
                 ('00','01','02','03','04','05','06',
                  '07','08','09','10','11','12',
                  '13','14','15','16','17','18')),
  nombre       text NOT NULL,                                -- 'Febrero', 'Saldos Iniciales'…
  estado       text NOT NULL DEFAULT 'Abierto'
                 CHECK (estado IN ('Abierto', 'Cerrado')),
  cerrado_por  integer,
  cerrado_en   timestamptz,
  creado_en    timestamptz,
  creado_por   integer,
  actualizado_en timestamptz,
  actualizado_por integer,
  version      integer NOT NULL DEFAULT 0,
  CONSTRAINT periodos_contables_uk UNIQUE (compania_id, anio, periodo)
);

-- -------------------------------------------------------------------
-- Parámetros de operación por compañía/año.
-- Mapeo 1:1 con el recurso PARAM_1 / DSIGRABA6 del legado.
-- -------------------------------------------------------------------
CREATE TABLE parametros_operacion (
  id                          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id                 bigint NOT NULL REFERENCES companias (id),
  anio                        integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  nombre_empresa              text NOT NULL DEFAULT '',      -- CONCTR.CTCIA
  nit                         text NOT NULL DEFAULT '',      -- CTNIT
  direccion                   text NOT NULL DEFAULT '',      -- CTDIRECC
  ciudad                      text NOT NULL DEFAULT '',      -- CTCIUDAD
  directorio_contabilidad     text NOT NULL DEFAULT '',      -- CTDIREC
  anio_operacion              text NOT NULL DEFAULT '',      -- CTANO
  contabilidad_conciliacion   text NOT NULL DEFAULT '',      -- CTCLAVE1
  verifica_documentos_lotes   boolean NOT NULL DEFAULT true, -- CTVERDOC
  terceros_documentos_propios boolean NOT NULL DEFAULT false,-- CTTERDOC
  controla_usuario_lotes      boolean NOT NULL DEFAULT true, -- CTPUC
  comentario_certificado      text NOT NULL DEFAULT '',      -- CTLEY1
  modo_retencion              text NOT NULL DEFAULT 'retencion-a-base'
                                CHECK (modo_retencion IN ('retencion-a-base', 'base-a-retencion')),
  periodos_habilitados        jsonb NOT NULL DEFAULT '{}',   -- CT00..CT12: true=habilitado
  creado_en                   timestamptz,
  creado_por                  integer,
  actualizado_en              timestamptz,
  actualizado_por             integer,
  version                     integer NOT NULL DEFAULT 0,
  CONSTRAINT parametros_operacion_uk UNIQUE (compania_id, anio)
);

-- Disparadores de auditoría del núcleo.
CREATE TRIGGER trg_companias_auditoria BEFORE UPDATE ON companias
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_compania_anios_auditoria BEFORE UPDATE ON compania_anios
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_periodos_auditoria BEFORE UPDATE ON periodos_contables
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_parametros_auditoria BEFORE UPDATE ON parametros_operacion
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();

COMMIT;
