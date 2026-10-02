-- =====================================================================
-- CONTABDSI · 15_flujo_caja_niif.sql
-- Configuracion de los informes que el modelo no tenia: definicion de cuentas
-- de flujo de caja y clasificacion NIIF de las cuentas.
--
-- Evidencia de la carencia:
--   * backend/informes_adicionales_repository.py:433-441 declara que el flujo
--     de caja "requiere la definicion de cuentas del sistema original" y que
--     los informes NIC/NIIF "requieren configurar la clasificacion contable y
--     los tipos documentales".
--   * db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md (CONMAE) declara la brecha:
--     "faltan reglas/campos fiscales, NIIF, clasificacion corriente".
--   * db/migration/homologacion/PENDIENTES.md:98 se cerro NO modelar los 37
--     campos NIIF de CONMAE en `cuentas`, asi que la clasificacion no va como
--     columna del maestro sino como asignacion aparte, igual que
--     `formato_asignaciones` (06_impuestos.sql:42).
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Definicion de flujo de caja: un renglon por linea del estado de flujo,
-- con la cuenta del plan que lo alimenta y su signo.
-- -------------------------------------------------------------------
CREATE TABLE flujo_caja_renglones (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id     bigint NOT NULL REFERENCES companias (id),
  codigo          text NOT NULL,                              -- 'OP01', 'INV03', 'FIN02'
  nombre          text NOT NULL,                              -- 'Efectivo de actividades de operacion'
  grupo           text NOT NULL CHECK (grupo IN
                    ('Operacion', 'Inversion', 'Financiacion')),
  orden           integer NOT NULL DEFAULT 0,
  cuenta_id       bigint NOT NULL,
  signo           integer NOT NULL DEFAULT 1 CHECK (signo IN (-1, 1)), -- igual que renglones_renta
  eliminado_en    timestamptz,
  creado_en       timestamptz,
  creado_por      integer,
  actualizado_en  timestamptz,
  actualizado_por integer,
  version         integer NOT NULL DEFAULT 0,
  CONSTRAINT flujo_caja_renglones_codigo_uk UNIQUE (compania_id, codigo),
  CONSTRAINT flujo_caja_renglones_compania_id_uk UNIQUE (compania_id, id),
  CONSTRAINT flujo_caja_renglones_cuenta_fk FOREIGN KEY (compania_id, cuenta_id)
    REFERENCES cuentas (compania_id, id)
);

-- -------------------------------------------------------------------
-- Rubros NIIF (ESFA y estado de resultados) por compania.
-- -------------------------------------------------------------------
CREATE TABLE rubros_niif (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id     bigint NOT NULL REFERENCES companias (id),
  codigo          text NOT NULL,                              -- 'AC-P1', 'PT-03', 'ING-01'
  nombre          text NOT NULL,
  informe         text NOT NULL CHECK (informe IN ('ESFA', 'ER')),
  tipo            text NOT NULL CHECK (tipo IN
                    ('Activo Corriente', 'Activo No Corriente',
                     'Pasivo Corriente', 'Pasivo No Corriente',
                     'Patrimonio', 'Ingreso', 'Costo', 'Gasto', 'Orden')),
  orden           integer NOT NULL DEFAULT 0,
  eliminado_en    timestamptz,
  creado_en       timestamptz,
  creado_por      integer,
  actualizado_en  timestamptz,
  actualizado_por integer,
  version         integer NOT NULL DEFAULT 0,
  CONSTRAINT rubros_niif_codigo_uk UNIQUE (compania_id, codigo),
  CONSTRAINT rubros_niif_compania_id_uk UNIQUE (compania_id, id)
);

-- -------------------------------------------------------------------
-- Asignacion de cuentas del plan a cada rubro (arbol con checkbox).
-- -------------------------------------------------------------------
CREATE TABLE rubro_niif_cuentas (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rubro_id    bigint NOT NULL REFERENCES rubros_niif (id) ON DELETE CASCADE,
  compania_id bigint NOT NULL REFERENCES companias (id),
  cuenta_id   bigint NOT NULL,
  CONSTRAINT rubro_niif_cuentas_uk UNIQUE (rubro_id, cuenta_id),
  CONSTRAINT rubro_niif_cuentas_cuenta_fk FOREIGN KEY (compania_id, cuenta_id)
    REFERENCES cuentas (compania_id, id)
);

CREATE TRIGGER trg_flujo_caja_renglones_auditoria BEFORE UPDATE ON flujo_caja_renglones
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_rubros_niif_auditoria BEFORE UPDATE ON rubros_niif
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();

COMMIT;
