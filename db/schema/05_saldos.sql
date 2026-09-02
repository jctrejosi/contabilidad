-- =====================================================================
-- CONTABDSI · 05_saldos.sql
-- Saldos y acumulados. Son DERIVADOS del libro (regenerables).
-- La función regenerar_acumulados() (funciones.sql) los reconstruye.
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Saldos por cuenta y período.
-- -------------------------------------------------------------------
CREATE TABLE saldos_cuenta (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id   bigint NOT NULL REFERENCES companias (id),
  anio          integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  periodo       text NOT NULL CHECK (periodo IN
                  ('00','01','02','03','04','05','06',
                   '07','08','09','10','11','12',
                   '13','14','15','16','17','18')),
  cuenta_id     bigint NOT NULL REFERENCES cuentas (id),
  saldo_inicial dinero NOT NULL DEFAULT 0,
  debito        dinero NOT NULL DEFAULT 0,
  credito       dinero NOT NULL DEFAULT 0,
  CONSTRAINT saldos_cuenta_uk UNIQUE (compania_id, anio, periodo, cuenta_id)
) WITH (fillfactor = 70); -- fila caliente: se actualiza (HOT) en cada contabilización

-- -------------------------------------------------------------------
-- Saldos por cuenta + tercero.
-- -------------------------------------------------------------------
CREATE TABLE saldos_cuenta_tercero (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id bigint NOT NULL REFERENCES companias (id),
  anio        integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  periodo     text NOT NULL,
  cuenta_id   bigint NOT NULL REFERENCES cuentas (id),
  tercero_id  bigint NOT NULL REFERENCES terceros (id),
  debito      dinero NOT NULL DEFAULT 0,
  credito     dinero NOT NULL DEFAULT 0,
  CONSTRAINT saldos_cuenta_tercero_uk UNIQUE (compania_id, anio, periodo, cuenta_id, tercero_id)
) WITH (fillfactor = 70);

-- -------------------------------------------------------------------
-- Saldos por cuenta + centro de costo.
-- -------------------------------------------------------------------
CREATE TABLE saldos_cuenta_centro (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id     bigint NOT NULL REFERENCES companias (id),
  anio            integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  periodo         text NOT NULL,
  cuenta_id       bigint NOT NULL REFERENCES cuentas (id),
  centro_costo_id bigint NOT NULL REFERENCES centros_costos (id),
  debito          dinero NOT NULL DEFAULT 0,
  credito         dinero NOT NULL DEFAULT 0,
  CONSTRAINT saldos_cuenta_centro_uk UNIQUE (compania_id, anio, periodo, cuenta_id, centro_costo_id)
) WITH (fillfactor = 70);

-- -------------------------------------------------------------------
-- Acumulados por tercero (informes y certificados).
-- -------------------------------------------------------------------
CREATE TABLE acumulados_tercero (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id bigint NOT NULL REFERENCES companias (id),
  anio        integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  tercero_id  bigint NOT NULL REFERENCES terceros (id),
  cuenta_id   bigint NOT NULL REFERENCES cuentas (id),
  debito      dinero NOT NULL DEFAULT 0,
  credito     dinero NOT NULL DEFAULT 0,
  CONSTRAINT acumulados_tercero_uk UNIQUE (compania_id, anio, tercero_id, cuenta_id)
);

-- -------------------------------------------------------------------
-- Acumulados por centro de costo.
-- -------------------------------------------------------------------
CREATE TABLE acumulados_centro (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id     bigint NOT NULL REFERENCES companias (id),
  anio            integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  centro_costo_id bigint NOT NULL REFERENCES centros_costos (id),
  cuenta_id       bigint NOT NULL REFERENCES cuentas (id),
  debito          dinero NOT NULL DEFAULT 0,
  credito         dinero NOT NULL DEFAULT 0,
  CONSTRAINT acumulados_centro_uk UNIQUE (compania_id, anio, centro_costo_id, cuenta_id)
);

-- -------------------------------------------------------------------
-- Acumulados de retención en la fuente (por tercero/concepto/período).
-- -------------------------------------------------------------------
CREATE TABLE acumulados_retencion (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id          bigint NOT NULL REFERENCES companias (id),
  anio                 integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  periodo              text NOT NULL,
  tercero_id           bigint NOT NULL REFERENCES terceros (id),
  concepto_retencion_id bigint NOT NULL REFERENCES conceptos_retencion (id),
  base                 dinero NOT NULL DEFAULT 0,
  valor                dinero NOT NULL DEFAULT 0,
  CONSTRAINT acumulados_retencion_uk UNIQUE
    (compania_id, anio, periodo, tercero_id, concepto_retencion_id)
);

-- -------------------------------------------------------------------
-- Acumulados de IVA (por tercero/tarifa/período).
-- -------------------------------------------------------------------
CREATE TABLE acumulados_iva (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id  bigint NOT NULL REFERENCES companias (id),
  anio         integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  periodo      text NOT NULL,
  tercero_id   bigint NOT NULL REFERENCES terceros (id),
  tarifa_iva_id bigint NOT NULL REFERENCES tarifas_iva (id),
  base         dinero NOT NULL DEFAULT 0,
  valor        dinero NOT NULL DEFAULT 0,
  CONSTRAINT acumulados_iva_uk UNIQUE (compania_id, anio, periodo, tercero_id, tarifa_iva_id)
);

-- -------------------------------------------------------------------
-- Estado de acumulaciones (fecha de última acumulación).
-- La UI avisa si quedó desactualizada.
-- -------------------------------------------------------------------
CREATE TABLE estado_acumulaciones (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id       bigint NOT NULL REFERENCES companias (id),
  anio              integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  tipo              text NOT NULL CHECK (tipo IN ('Retencion', 'Iva', 'Terceros', 'Centros')),
  periodo_hasta     text NOT NULL,
  ultima_acumulacion timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estado_acumulaciones_uk UNIQUE (compania_id, anio, tipo)
);

COMMIT;
