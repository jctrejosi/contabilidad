-- =====================================================================
-- CONTABDSI · 16_consolidacion_homologacion.sql
-- Homologacion de cuentas y centros entre companias de una consolidacion.
--
-- Evidencia de la carencia: db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md (CONSOLID)
-- declara que `consolidaciones` y `consolidacion_origenes` no bastan:
-- "falta persistir correspondencias de cuentas/centros y procedencia de cada
-- resultado", y lo repite en la validacion por proceso P27.
--
-- Diferencia frente al DDL del plan (§4.2): la clave destino se resuelve en la
-- compania DESTINO de la consolidacion, no en la de origen, asi que la FK
-- compuesta del destino necesita su propia columna `compania_destino_id`
-- (denormalizada de `consolidaciones`). Con la compania de origen, la FK
-- comparaba `compania_origen_id` contra `cuentas.compania_id` y admitia la
-- cuenta destino de otra compania. Es la arista que el plan dejo abierta.
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Correspondencia de cuentas origen -> destino. La compania de origen hace
-- parte de la clave porque dos origenes pueden compartir codigo de cuenta.
-- -------------------------------------------------------------------
CREATE TABLE consolidacion_cuentas (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  consolidacion_id   bigint NOT NULL REFERENCES consolidaciones (id) ON DELETE CASCADE,
  compania_origen_id bigint NOT NULL REFERENCES companias (id),
  compania_destino_id bigint NOT NULL REFERENCES companias (id),
  cuenta_origen_id   bigint NOT NULL,
  cuenta_destino_id  bigint NOT NULL,
  signo              integer NOT NULL DEFAULT 1 CHECK (signo IN (-1, 1)), -- cruces que invierten
  CONSTRAINT consolidacion_cuentas_uk UNIQUE
    (consolidacion_id, compania_origen_id, cuenta_origen_id),
  CONSTRAINT consolidacion_cuentas_origen_fk FOREIGN KEY (compania_origen_id, cuenta_origen_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT consolidacion_cuentas_destino_fk FOREIGN KEY (compania_destino_id, cuenta_destino_id)
    REFERENCES cuentas (compania_id, id)
);

-- -------------------------------------------------------------------
-- Correspondencia de centros de costo origen -> destino (misma regla).
-- -------------------------------------------------------------------
CREATE TABLE consolidacion_centros (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  consolidacion_id   bigint NOT NULL REFERENCES consolidaciones (id) ON DELETE CASCADE,
  compania_origen_id bigint NOT NULL REFERENCES companias (id),
  compania_destino_id bigint NOT NULL REFERENCES companias (id),
  centro_origen_id   bigint NOT NULL,
  centro_destino_id  bigint NOT NULL,
  CONSTRAINT consolidacion_centros_uk UNIQUE
    (consolidacion_id, compania_origen_id, centro_origen_id),
  CONSTRAINT consolidacion_centros_origen_fk FOREIGN KEY (compania_origen_id, centro_origen_id)
    REFERENCES centros_costos (compania_id, id),
  CONSTRAINT consolidacion_centros_destino_fk FOREIGN KEY (compania_destino_id, centro_destino_id)
    REFERENCES centros_costos (compania_id, id)
);

COMMIT;
