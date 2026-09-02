-- =====================================================================
-- CONTABDSI · 03_maestros.sql
-- Plan de cuentas, terceros, centros, comprobantes, tipos de documento,
-- retenciones, IVA, renglones de renta, plantillas y formatos.
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Plan de cuentas (niveles 1, 2, 4, 6, 9 y 12).
-- -------------------------------------------------------------------
CREATE TABLE cuentas (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id     bigint NOT NULL REFERENCES companias (id),
  codigo          text NOT NULL,                             -- '510506'
  nombre          text NOT NULL,
  nivel           integer NOT NULL CHECK (nivel IN (1, 2, 4, 6, 9, 12)),
  afectable       boolean NOT NULL DEFAULT true,             -- no afectable no acepta movimiento
  controla_tercero boolean NOT NULL DEFAULT false,
  controla_centro  boolean NOT NULL DEFAULT false,
  controla_base    boolean NOT NULL DEFAULT false,
  ajuste          boolean NOT NULL DEFAULT false,
  clase_iva       text,                                       -- 'Generado' | 'Descontable' | null
  clase_retencion text,                                       -- 'Renta' | 'IVA' | 'ICA' | null
  distribucion    text NOT NULL DEFAULT 'Ninguna'
                    CHECK (distribucion IN ('Ninguna', 'Fija', 'Porcentaje')),
  porcentaje      porcentaje NOT NULL DEFAULT 0,
  cuenta_base_id  bigint REFERENCES cuentas (id),            -- cuenta base para distribución
  saldo_inicial   dinero NOT NULL DEFAULT 0,
  parent_id       bigint REFERENCES cuentas (id),            -- jerarquía
  path            text,                                      -- materializado: '/1/5/51/5105/510506'
  eliminado_en    timestamptz,
  creado_en       timestamptz,
  creado_por      integer,
  actualizado_en  timestamptz,
  actualizado_por integer,
  version         integer NOT NULL DEFAULT 0,
  CONSTRAINT cuentas_codigo_uk UNIQUE (compania_id, codigo)
);

-- -------------------------------------------------------------------
-- Terceros (clientes, proveedores, empleados, entidades…).
-- -------------------------------------------------------------------
CREATE TABLE terceros (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id     bigint NOT NULL REFERENCES companias (id),
  zona            text,
  nit             text NOT NULL,
  digito          text NOT NULL,
  tipo_documento  text NOT NULL DEFAULT 'NIT',               -- 'NIT' | 'CC' | 'CE' | …
  nombre          text NOT NULL,
  tipo            text NOT NULL DEFAULT 'Juridica'
                    CHECK (tipo IN ('Natural', 'Juridica')),
  direccion       text,
  telefono        text,
  ciudad          text,
  nit_relacionado text,
  estado          text NOT NULL DEFAULT 'Activo'
                    CHECK (estado IN ('Activo', 'Bloqueado')),
  motivo_bloqueo  text,
  fecha_creacion  date,
  saldo           dinero NOT NULL DEFAULT 0,
  cupo            dinero NOT NULL DEFAULT 0,
  sexo            text CHECK (sexo IN ('M', 'F', 'J') OR sexo IS NULL),
  nacimiento      date,
  estado_web      text NOT NULL DEFAULT 'Inactivo'
                    CHECK (estado_web IN ('Activo', 'Inactivo')),
  eliminado_en    timestamptz,
  creado_en       timestamptz,
  creado_por      integer,
  actualizado_en  timestamptz,
  actualizado_por integer,
  version         integer NOT NULL DEFAULT 0,
  CONSTRAINT terceros_nit_uk UNIQUE (compania_id, nit)
);

CREATE TABLE tercero_etiquetas (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tercero_id bigint NOT NULL REFERENCES terceros (id) ON DELETE CASCADE,
  etiqueta   text NOT NULL,
  CONSTRAINT tercero_etiquetas_uk UNIQUE (tercero_id, etiqueta)
);

-- -------------------------------------------------------------------
-- Centros de costo (jerárquicos).
-- -------------------------------------------------------------------
CREATE TABLE centros_costos (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id     bigint NOT NULL REFERENCES companias (id),
  codigo          text NOT NULL,                             -- 'ADM', 'VEN', 'OPE'
  nombre          text NOT NULL,
  nivel           integer NOT NULL DEFAULT 1,
  parent_id       bigint REFERENCES centros_costos (id),
  eliminado_en    timestamptz,
  creado_en       timestamptz,
  creado_por      integer,
  actualizado_en  timestamptz,
  actualizado_por integer,
  version         integer NOT NULL DEFAULT 0,
  CONSTRAINT centros_costos_codigo_uk UNIQUE (compania_id, codigo)
);

-- -------------------------------------------------------------------
-- Comprobantes (tipos) y sus consecutivos por compañía/año.
-- -------------------------------------------------------------------
CREATE TABLE comprobantes (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id     bigint NOT NULL REFERENCES companias (id),
  codigo          text NOT NULL,                             -- 'CE', 'RC', 'CP'…
  nombre          text NOT NULL,
  activo          boolean NOT NULL DEFAULT true,
  eliminado_en    timestamptz,
  creado_en       timestamptz,
  creado_por      integer,
  actualizado_en  timestamptz,
  actualizado_por integer,
  version         integer NOT NULL DEFAULT 0,
  CONSTRAINT comprobantes_codigo_uk UNIQUE (compania_id, codigo)
);

CREATE TABLE consecutivos_comprobantes (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id       bigint NOT NULL REFERENCES companias (id),
  anio              integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  comprobante_id    bigint NOT NULL REFERENCES comprobantes (id),
  consecutivo_actual bigint NOT NULL DEFAULT 1,
  consecutivo_fin   bigint,
  version           integer NOT NULL DEFAULT 0,
  CONSTRAINT consecutivos_uk UNIQUE (compania_id, anio, comprobante_id)
);

-- -------------------------------------------------------------------
-- Tipos de documento y numeración.
-- -------------------------------------------------------------------
CREATE TABLE tipos_documento (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id         bigint NOT NULL REFERENCES companias (id),
  codigo              text NOT NULL,                          -- 'NOM', 'FV', 'OR'…
  nombre              text NOT NULL,
  numeracion          text NOT NULL DEFAULT 'Manual'
                        CHECK (numeracion IN ('Manual', 'Automatica')),
  consecutivo         bigint NOT NULL DEFAULT 1,
  tercero_obligatorio boolean NOT NULL DEFAULT false,
  centro_obligatorio  boolean NOT NULL DEFAULT false,
  eliminado_en        timestamptz,
  creado_en           timestamptz,
  creado_por          integer,
  actualizado_en      timestamptz,
  actualizado_por     integer,
  version             integer NOT NULL DEFAULT 0,
  CONSTRAINT tipos_documento_codigo_uk UNIQUE (compania_id, codigo)
);

-- -------------------------------------------------------------------
-- Retenciones e IVA (reglas tributarias configurables).
-- -------------------------------------------------------------------
CREATE TABLE conceptos_retencion (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id  bigint NOT NULL REFERENCES companias (id),
  codigo       text NOT NULL,
  nombre       text NOT NULL,
  tarifa       porcentaje NOT NULL DEFAULT 0,
  cuenta_id    bigint REFERENCES cuentas (id),
  base_minima  dinero NOT NULL DEFAULT 0,
  eliminado_en timestamptz,
  creado_en    timestamptz,
  creado_por   integer,
  actualizado_en timestamptz,
  actualizado_por integer,
  version      integer NOT NULL DEFAULT 0,
  CONSTRAINT conceptos_retencion_codigo_uk UNIQUE (compania_id, codigo)
);

CREATE TABLE tarifas_iva (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id  bigint NOT NULL REFERENCES companias (id),
  codigo       text NOT NULL,                                 -- 'IV19', 'IV05', 'IVE'
  nombre       text NOT NULL,
  tarifa       porcentaje NOT NULL DEFAULT 0,
  cuenta_id    bigint REFERENCES cuentas (id),
  eliminado_en timestamptz,
  creado_en    timestamptz,
  creado_por   integer,
  actualizado_en timestamptz,
  actualizado_por integer,
  version      integer NOT NULL DEFAULT 0,
  CONSTRAINT tarifas_iva_codigo_uk UNIQUE (compania_id, codigo)
);

-- -------------------------------------------------------------------
-- Renglones de renta (clasificación para declaración).
-- -------------------------------------------------------------------
CREATE TABLE renglones_renta (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id  bigint NOT NULL REFERENCES companias (id),
  codigo       text NOT NULL,
  nombre       text NOT NULL,
  cuenta_id    bigint REFERENCES cuentas (id),
  signo        integer NOT NULL DEFAULT 1 CHECK (signo IN (-1, 1)),
  eliminado_en timestamptz,
  creado_en    timestamptz,
  creado_por   integer,
  actualizado_en timestamptz,
  actualizado_por integer,
  version      integer NOT NULL DEFAULT 0,
  CONSTRAINT renglones_renta_codigo_uk UNIQUE (compania_id, codigo)
);

-- -------------------------------------------------------------------
-- Plantillas contables (asientos predefinidos).
-- -------------------------------------------------------------------
CREATE TABLE plantillas_contables (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id  bigint NOT NULL REFERENCES companias (id),
  codigo       text NOT NULL,
  nombre       text NOT NULL,
  eliminado_en timestamptz,
  creado_en    timestamptz,
  creado_por   integer,
  actualizado_en timestamptz,
  actualizado_por integer,
  version      integer NOT NULL DEFAULT 0,
  CONSTRAINT plantillas_codigo_uk UNIQUE (compania_id, codigo)
);

CREATE TABLE plantilla_lineas (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plantilla_id bigint NOT NULL REFERENCES plantillas_contables (id) ON DELETE CASCADE,
  orden       integer NOT NULL DEFAULT 0,
  cuenta_id   bigint REFERENCES cuentas (id),
  debito      dinero NOT NULL DEFAULT 0,
  credito     dinero NOT NULL DEFAULT 0,
  concepto    text
);

-- -------------------------------------------------------------------
-- Formatos documentales (editor visual de impresión).
-- -------------------------------------------------------------------
CREATE TABLE formatos_documentales (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id    bigint NOT NULL REFERENCES companias (id),
  codigo         text NOT NULL,
  nombre         text NOT NULL,
  comprobante_id bigint REFERENCES comprobantes (id),
  eliminado_en   timestamptz,
  creado_en      timestamptz,
  creado_por     integer,
  actualizado_en timestamptz,
  actualizado_por integer,
  version        integer NOT NULL DEFAULT 0,
  CONSTRAINT formatos_codigo_uk UNIQUE (compania_id, codigo)
);

CREATE TABLE formato_elementos (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  formato_id bigint NOT NULL REFERENCES formatos_documentales (id) ON DELETE CASCADE,
  tipo       text NOT NULL CHECK (tipo IN
               ('Leyenda', 'Imagen', 'Rectangulo', 'Linea',
                'CampoComprobante', 'CampoDocumento', 'CampoFecha', 'CampoTotal')),
  contenido  text,
  x          numeric(10, 2) NOT NULL DEFAULT 0,
  y          numeric(10, 2) NOT NULL DEFAULT 0,
  ancho      numeric(10, 2),
  alto       numeric(10, 2),
  fuente     text,
  orden      integer NOT NULL DEFAULT 0
);

-- Disparadores de auditoría de maestros.
CREATE TRIGGER trg_cuentas_auditoria BEFORE UPDATE ON cuentas
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_terceros_auditoria BEFORE UPDATE ON terceros
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_centros_auditoria BEFORE UPDATE ON centros_costos
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_comprobantes_auditoria BEFORE UPDATE ON comprobantes
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_tipos_documento_auditoria BEFORE UPDATE ON tipos_documento
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_conceptos_retencion_auditoria BEFORE UPDATE ON conceptos_retencion
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_tarifas_iva_auditoria BEFORE UPDATE ON tarifas_iva
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_renglones_auditoria BEFORE UPDATE ON renglones_renta
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_plantillas_auditoria BEFORE UPDATE ON plantillas_contables
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_formatos_auditoria BEFORE UPDATE ON formatos_documentales
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();

COMMIT;
