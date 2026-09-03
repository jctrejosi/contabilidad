-- =====================================================================
-- CONTABDSI · 11_ampliaciones.sql
-- Entidades faltantes detectadas en la validación de migración (B10):
-- cuentas bancarias de terceros, reembolsos y activos/amortizaciones.
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Cuentas bancarias por tercero (ADMCUENTA en el legado).
-- El número se conserva como texto (ceros iniciales).
-- -------------------------------------------------------------------
CREATE TABLE tercero_cuentas_bancarias (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id bigint NOT NULL REFERENCES companias (id),
  tercero_id  bigint NOT NULL,
  tipo        text NOT NULL DEFAULT 'Ahorros' CHECK (tipo IN ('Ahorros', 'Corriente', 'Otro')),
  numero      text NOT NULL,                                  -- texto: preserva ceros iniciales
  principal   boolean NOT NULL DEFAULT false,
  observacion text,
  creado_en   timestamptz,
  creado_por  integer,
  actualizado_en timestamptz,
  actualizado_por integer,
  version     integer NOT NULL DEFAULT 0,
  CONSTRAINT tercero_cuentas_bancarias_fk FOREIGN KEY (compania_id, tercero_id)
    REFERENCES terceros (compania_id, id)
);

-- -------------------------------------------------------------------
-- Reembolsos de caja menor (REEMBOL01: encabezado + detalle).
-- -------------------------------------------------------------------
CREATE TABLE reembolsos (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id   bigint NOT NULL REFERENCES companias (id),
  anio          integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  numero        text NOT NULL,
  fecha         date NOT NULL,
  periodo       text NOT NULL,
  tercero_id    bigint NOT NULL,
  caja_menor    text,
  estado        text NOT NULL DEFAULT 'Borrador'
                  CHECK (estado IN ('Borrador', 'Aplicado', 'Anulado')),
  lote_id       bigint,                                       -- lote generado al aplicar
  usuario_id    bigint NOT NULL,
  creado_en     timestamptz,
  creado_por    integer,
  actualizado_en timestamptz,
  actualizado_por integer,
  version       integer NOT NULL DEFAULT 0,
  CONSTRAINT reembolsos_tercero_fk FOREIGN KEY (compania_id, tercero_id)
    REFERENCES terceros (compania_id, id)
);

CREATE TABLE reembolso_lineas (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reembolso_id    bigint NOT NULL REFERENCES reembolsos (id) ON DELETE CASCADE,
  compania_id     bigint NOT NULL REFERENCES companias (id),
  numero_linea    integer NOT NULL,
  cuenta_id       bigint NOT NULL,
  centro_costo_id bigint,
  concepto        text,
  debito          dinero NOT NULL DEFAULT 0 CHECK (debito >= 0),
  credito         dinero NOT NULL DEFAULT 0 CHECK (credito >= 0),
  documento_soporte text,
  CONSTRAINT reembolso_lineas_sin_doble_valor CHECK (debito = 0 OR credito = 0),
  CONSTRAINT reembolso_lineas_cuenta_fk FOREIGN KEY (compania_id, cuenta_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT reembolso_lineas_centro_fk FOREIGN KEY (compania_id, centro_costo_id)
    REFERENCES centros_costos (compania_id, id)
);

-- -------------------------------------------------------------------
-- Activos fijos y amortizables (INTEACT2/INTEACT3).
-- -------------------------------------------------------------------
CREATE TABLE activos (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id    bigint NOT NULL REFERENCES companias (id),
  codigo         text NOT NULL,
  nombre         text NOT NULL,
  tipo           text NOT NULL DEFAULT 'Activo' CHECK (tipo IN ('Activo', 'Amortizable')),
  cuenta_activo_id bigint,                                    -- cuenta del activo
  cuenta_gasto_id  bigint,                                    -- cuenta del gasto de depreciación
  cuenta_depreciacion_id bigint,                              -- depreciación acumulada
  costo          dinero NOT NULL DEFAULT 0,
  vida_util_meses integer NOT NULL DEFAULT 0,
  valor_residual dinero NOT NULL DEFAULT 0,
  fecha_adquisicion date,
  fecha_baja     date,
  estado         text NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Baja', 'Totalmente depreciado')),
  creado_en      timestamptz,
  creado_por     integer,
  actualizado_en timestamptz,
  actualizado_por integer,
  version        integer NOT NULL DEFAULT 0,
  CONSTRAINT activos_codigo_uk UNIQUE (compania_id, codigo),
  CONSTRAINT activos_cuenta_activo_fk FOREIGN KEY (compania_id, cuenta_activo_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT activos_cuenta_gasto_fk FOREIGN KEY (compania_id, cuenta_gasto_id)
    REFERENCES cuentas (compania_id, id),
  CONSTRAINT activos_cuenta_depreciacion_fk FOREIGN KEY (compania_id, cuenta_depreciacion_id)
    REFERENCES cuentas (compania_id, id)
);

-- Cuotas mensuales por activo y su distribución por centro.
CREATE TABLE activo_cuotas (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  activo_id  bigint NOT NULL REFERENCES activos (id) ON DELETE CASCADE,
  anio       integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  periodo    text NOT NULL CHECK (periodo IN
               ('00','01','02','03','04','05','06',
                '07','08','09','10','11','12',
                '13','14','15','16','17','18')),
  valor      dinero NOT NULL DEFAULT 0,
  aplicada   boolean NOT NULL DEFAULT false,                  -- ¿ya generó asiento?
  lote_id    bigint,
  CONSTRAINT activo_cuotas_uk UNIQUE (activo_id, anio, periodo)
);

CREATE TABLE activo_distribuciones (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  activo_id       bigint NOT NULL REFERENCES activos (id) ON DELETE CASCADE,
  compania_id     bigint NOT NULL REFERENCES companias (id),
  centro_costo_id bigint NOT NULL,
  porcentaje      porcentaje NOT NULL DEFAULT 0,
  CONSTRAINT activo_distribuciones_uk UNIQUE (activo_id, centro_costo_id),
  CONSTRAINT activo_distribuciones_centro_fk FOREIGN KEY (compania_id, centro_costo_id)
    REFERENCES centros_costos (compania_id, id)
);

CREATE TRIGGER trg_tercero_cuentas_bancarias_auditoria BEFORE UPDATE ON tercero_cuentas_bancarias
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_reembolsos_auditoria BEFORE UPDATE ON reembolsos
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_activos_auditoria BEFORE UPDATE ON activos
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();

COMMIT;
