-- =====================================================================
-- CONTABDSI · 07_procesos.sql
-- Reprocesos/auditoría, cierres y consolidación.
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Procesos (reproceso mensual, revalorización, auditorías, etc.).
-- -------------------------------------------------------------------
CREATE TABLE procesos (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id        bigint NOT NULL REFERENCES companias (id),
  anio               integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  tipo               text NOT NULL,                          -- 'Reproceso mensual', 'Revalorizacion', …
  estado             text NOT NULL DEFAULT 'Configurado' CHECK (estado IN
                       ('Configurado', 'Simulado', 'Ejecutando', 'Completado', 'Fallido')),
  alcance            jsonb NOT NULL DEFAULT '{}',
  simulacion         jsonb NOT NULL DEFAULT '{}',
  reporte_diferencias jsonb NOT NULL DEFAULT '{}',
  respaldo_realizado boolean NOT NULL DEFAULT false,
  resultado          jsonb NOT NULL DEFAULT '{}',
  usuario_id         integer NOT NULL,
  creado_en          timestamptz,
  creado_por         integer,
  actualizado_en     timestamptz,
  actualizado_por    integer,
  version            integer NOT NULL DEFAULT 0
);

-- -------------------------------------------------------------------
-- Cierres contables (checklist + comprobante de cierre).
-- -------------------------------------------------------------------
CREATE TABLE cierres (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id          bigint NOT NULL REFERENCES companias (id),
  anio                 integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  estado               text NOT NULL DEFAULT 'Pendiente' CHECK (estado IN
                         ('Pendiente', 'Ejecutado', 'Anulado')),
  checklist            jsonb NOT NULL DEFAULT '{}',           -- conciliaciones, lotes, descuadres…
  comprobante_id       bigint REFERENCES comprobantes (id),
  cuenta_resultado_id  bigint REFERENCES cuentas (id),
  documento            text,
  fecha                date,
  usuario_id           integer NOT NULL,
  creado_en            timestamptz,
  creado_por           integer,
  actualizado_en       timestamptz,
  actualizado_por      integer,
  version              integer NOT NULL DEFAULT 0
);

-- -------------------------------------------------------------------
-- Traslado de períodos 13-18 a 01-06 (matriz origen/destino).
-- -------------------------------------------------------------------
CREATE TABLE cierre_traslados (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cierre_id      bigint NOT NULL REFERENCES cierres (id) ON DELETE CASCADE,
  origen_periodo text NOT NULL,                              -- '13'..'18'
  destino_periodo text NOT NULL,                             -- '01'..'06'
  cuenta_id      bigint REFERENCES cuentas (id),
  debito         dinero NOT NULL DEFAULT 0,
  credito        dinero NOT NULL DEFAULT 0
);

-- -------------------------------------------------------------------
-- Consolidación (compañías origen → destino solo-consolidación).
-- -------------------------------------------------------------------
CREATE TABLE consolidaciones (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_destino_id bigint NOT NULL REFERENCES companias (id),
  anio               integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  estado             text NOT NULL DEFAULT 'Configurado' CHECK (estado IN
                       ('Configurado', 'Simulado', 'Ejecutado', 'Anulado')),
  compatibilidad     jsonb NOT NULL DEFAULT '{}',
  simulacion         jsonb NOT NULL DEFAULT '{}',
  respaldo_realizado boolean NOT NULL DEFAULT false,
  confirmacion_vaciado boolean NOT NULL DEFAULT false,
  ejecutado_por      integer,
  ejecutado_en       timestamptz,
  creado_en          timestamptz,
  creado_por         integer,
  actualizado_en     timestamptz,
  actualizado_por    integer,
  version            integer NOT NULL DEFAULT 0
);

CREATE TABLE consolidacion_origenes (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  consolidacion_id  bigint NOT NULL REFERENCES consolidaciones (id) ON DELETE CASCADE,
  compania_origen_id bigint NOT NULL REFERENCES companias (id),
  incluida          boolean NOT NULL DEFAULT true,
  CONSTRAINT consolidacion_origenes_uk UNIQUE (consolidacion_id, compania_origen_id)
);

CREATE TRIGGER trg_procesos_auditoria BEFORE UPDATE ON procesos
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_cierres_auditoria BEFORE UPDATE ON cierres
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_consolidaciones_auditoria BEFORE UPDATE ON consolidaciones
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();

COMMIT;
