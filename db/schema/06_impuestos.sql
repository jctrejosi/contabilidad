-- =====================================================================
-- CONTABDSI · 06_impuestos.sql
-- Medios magnéticos (información exógena) y conciliación.
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Formatos de información exógena (1001, 1007, 2275, 2276…).
-- -------------------------------------------------------------------
CREATE TABLE formatos_exogenos (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id  bigint NOT NULL REFERENCES companias (id),
  codigo       text NOT NULL,
  nombre       text NOT NULL,
  vigencia     integer NOT NULL,
  activo       boolean NOT NULL DEFAULT true,
  eliminado_en timestamptz,
  creado_en    timestamptz,
  creado_por   integer,
  actualizado_en timestamptz,
  actualizado_por integer,
  version      integer NOT NULL DEFAULT 0,
  CONSTRAINT formatos_exogenos_codigo_uk UNIQUE (compania_id, codigo)
);

-- -------------------------------------------------------------------
-- Conceptos asociados a un formato (tarifa/cuenta).
-- -------------------------------------------------------------------
CREATE TABLE formato_conceptos (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  formato_id bigint NOT NULL REFERENCES formatos_exogenos (id) ON DELETE CASCADE,
  codigo     text NOT NULL,
  nombre     text NOT NULL,
  tarifa     porcentaje NOT NULL DEFAULT 0,
  cuenta_id  bigint REFERENCES cuentas (id)
);

-- -------------------------------------------------------------------
-- Asignación de cuentas del plan a cada formato (árbol con checkbox).
-- -------------------------------------------------------------------
CREATE TABLE formato_asignaciones (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  formato_id bigint NOT NULL REFERENCES formatos_exogenos (id) ON DELETE CASCADE,
  cuenta_id  bigint NOT NULL REFERENCES cuentas (id),
  activo     boolean NOT NULL DEFAULT true,
  CONSTRAINT formato_asignaciones_uk UNIQUE (formato_id, cuenta_id)
);

-- -------------------------------------------------------------------
-- Generaciones de medios (versión + parámetros conservados).
-- -------------------------------------------------------------------
CREATE TABLE generaciones_medios (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id   bigint NOT NULL REFERENCES companias (id),
  anio          integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  version       integer NOT NULL DEFAULT 1,
  parametros    jsonb NOT NULL DEFAULT '{}',
  estado        text NOT NULL DEFAULT 'Generado' CHECK (estado IN ('Generado', 'Revisado', 'Exportado')),
  generado_por  integer,
  generado_en   timestamptz,
  CONSTRAINT generaciones_medios_uk UNIQUE (compania_id, anio, version)
);

-- -------------------------------------------------------------------
-- Filas del medio generado (revisión editable).
-- -------------------------------------------------------------------
CREATE TABLE medio_filas (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  generacion_id bigint NOT NULL REFERENCES generaciones_medios (id) ON DELETE CASCADE,
  formato_id    bigint NOT NULL REFERENCES formatos_exogenos (id),
  tercero_id    bigint REFERENCES terceros (id),
  concepto_id   bigint REFERENCES formato_conceptos (id),
  cuenta_id     bigint REFERENCES cuentas (id),
  valor         dinero NOT NULL DEFAULT 0,
  base          dinero NOT NULL DEFAULT 0,
  ajustado      boolean NOT NULL DEFAULT false,
  detalle       jsonb NOT NULL DEFAULT '{}'
);

-- -------------------------------------------------------------------
-- Topes por formato/concepto (depuración por topes).
-- -------------------------------------------------------------------
CREATE TABLE medio_topes (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id bigint NOT NULL REFERENCES companias (id),
  anio        integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  formato_id  bigint NOT NULL REFERENCES formatos_exogenos (id),
  concepto_id bigint REFERENCES formato_conceptos (id),
  tope        dinero NOT NULL DEFAULT 0,
  CONSTRAINT medio_topes_uk UNIQUE (compania_id, anio, formato_id, concepto_id)
);

-- -------------------------------------------------------------------
-- Conciliación: total contable vs exclusiones/topes/ajustes/reportado.
-- -------------------------------------------------------------------
CREATE TABLE medio_conciliaciones (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  generacion_id   bigint NOT NULL REFERENCES generaciones_medios (id) ON DELETE CASCADE,
  total_contable  dinero NOT NULL DEFAULT 0,
  exclusiones     dinero NOT NULL DEFAULT 0,
  topes           dinero NOT NULL DEFAULT 0,
  ajustes         dinero NOT NULL DEFAULT 0,
  total_reportado dinero NOT NULL DEFAULT 0,
  cuadrado        boolean NOT NULL DEFAULT true,
  CONSTRAINT medio_conciliaciones_uk UNIQUE (generacion_id)
);

CREATE TRIGGER trg_formatos_exogenos_auditoria BEFORE UPDATE ON formatos_exogenos
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_generaciones_medios_auditoria BEFORE UPDATE ON generaciones_medios
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();

COMMIT;
