-- =====================================================================
-- CONTABDSI · 09_presupuesto.sql
-- Presupuesto jerárquico (feature flag). Departamento → Grupo → Sección → Código.
-- =====================================================================

BEGIN;

CREATE TABLE presupuestos (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id  bigint NOT NULL REFERENCES companias (id),
  anio         integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  nombre       text NOT NULL,
  estado       text NOT NULL DEFAULT 'Borrador'
                 CHECK (estado IN ('Borrador', 'Aprobado')),
  creado_en    timestamptz,
  creado_por   integer,
  actualizado_en timestamptz,
  actualizado_por integer,
  version      integer NOT NULL DEFAULT 0,
  CONSTRAINT presupuestos_uk UNIQUE (compania_id, anio, nombre)
);

CREATE TABLE presupuesto_rubros (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  presupuesto_id  bigint NOT NULL REFERENCES presupuestos (id) ON DELETE CASCADE,
  departamento    text NOT NULL,
  grupo           text NOT NULL,
  seccion         text NOT NULL,
  codigo          text NOT NULL,
  nombre          text NOT NULL DEFAULT '',                  -- B13: concepto/nombre del rubro
  concepto        text NOT NULL DEFAULT '',
  centro_costo_id bigint REFERENCES centros_costos (id),
  parent_id       bigint REFERENCES presupuesto_rubros (id),
  orden           integer NOT NULL DEFAULT 0,
  CONSTRAINT presupuesto_rubros_uk UNIQUE (presupuesto_id, codigo, centro_costo_id)
);

CREATE TABLE presupuesto_valores (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rubro_id bigint NOT NULL REFERENCES presupuesto_rubros (id) ON DELETE CASCADE,
  periodo  text NOT NULL CHECK (periodo IN
             ('00','01','02','03','04','05','06',
              '07','08','09','10','11','12','13')),
  tipo     text NOT NULL DEFAULT 'Presupuesto' CHECK (tipo IN ('Presupuesto', 'Ejecucion')),
  valor    dinero NOT NULL DEFAULT 0,
  CONSTRAINT presupuesto_valores_uk UNIQUE (rubro_id, periodo, tipo)
);

CREATE TRIGGER trg_presupuestos_auditoria BEFORE UPDATE ON presupuestos
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();

COMMIT;
