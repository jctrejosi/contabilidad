-- =====================================================================
-- CONTABDSI · 04_movimientos.sql
-- Lotes, líneas, validaciones, documentos (libro) y reversiones.
-- Contrato: idempotencia, control de versión y contabilización atómica.
-- B05: FK compuestas (compania_id, id) para impedir mezclar maestros
--      entre compañías. B04: dimensiones del movimiento original.
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Lotes contables.
-- -------------------------------------------------------------------
CREATE TABLE lotes (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id     bigint NOT NULL REFERENCES companias (id),
  anio            integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  periodo         text NOT NULL CHECK (periodo IN
                    ('00','01','02','03','04','05','06',
                     '07','08','09','10','11','12',
                     '13','14','15','16','17','18')),
  codigo          text NOT NULL,                             -- 'NOM2', 'CE-001'…
  nombre          text NOT NULL,
  usuario_id      bigint NOT NULL,                           -- FK en 08_seguridad (usuarios)
  origen          text NOT NULL DEFAULT 'Manual',            -- 'Manual' | 'Excel' | 'Nomina' | 'Reembolso' | …
  origen_referencia text,                                    -- clave estable del origen (B07): archivo/hash de importación
  fecha           date NOT NULL,
  estado          text NOT NULL DEFAULT 'Borrador' CHECK (estado IN
                    ('Borrador', 'Con errores', 'Verificado',
                     'Pendiente aprobacion', 'Aprobado',
                     'Contabilizando', 'Contabilizado', 'Fallido', 'Anulado')),
  comprobante_id  bigint,
  documento       text,                                      -- 'NOM-2026-02'
  idempotency_key uuid NOT NULL DEFAULT gen_random_uuid(),   -- doble envío prevenido
  motivo          text,                                      -- anulación / rechazo
  creado_en       timestamptz,
  creado_por      integer,
  actualizado_en  timestamptz,
  actualizado_por integer,
  version         integer NOT NULL DEFAULT 0,
  CONSTRAINT lotes_codigo_uk UNIQUE (compania_id, anio, codigo),
  CONSTRAINT lotes_idempotencia_uk UNIQUE (idempotency_key),
  CONSTRAINT lotes_compania_id_uk UNIQUE (compania_id, id),
  -- B05: el período debe EXISTIR en periodos_contables (rechaza períodos inexistentes)
  CONSTRAINT lotes_periodo_fk FOREIGN KEY (compania_id, anio, periodo)
    REFERENCES periodos_contables (compania_id, anio, periodo),
  -- B07: un mismo origen (archivo/operación) no puede cargarse dos veces
  CONSTRAINT lotes_origen_referencia_uk UNIQUE (compania_id, anio, origen_referencia)
);

-- -------------------------------------------------------------------
-- Líneas de lote (grilla editable). B04/B03: dimensiones fiscales y
-- documentales por renglón.
-- -------------------------------------------------------------------
CREATE TABLE lote_lineas (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lote_id              bigint NOT NULL REFERENCES lotes (id) ON DELETE CASCADE,
  compania_id          bigint NOT NULL REFERENCES companias (id),   -- B05
  numero_linea         integer NOT NULL,
  cuenta_id            bigint,
  tercero_id           bigint,
  centro_costo_id      bigint,
  tipo_documento_id    bigint,
  comprobante          text,                                       -- código comprobante (texto)
  documento            text,
  fecha                date,
  fecha_documento      date,                                       -- TFECDOC
  debito               dinero NOT NULL DEFAULT 0 CHECK (debito >= 0),
  credito              dinero NOT NULL DEFAULT 0 CHECK (credito >= 0),
  base                 dinero NOT NULL DEFAULT 0,
  clase                text NOT NULL DEFAULT '' CHECK (clase IN ('IVA', 'Retencion', 'Otro', '')),
  concepto_retencion_id bigint,                                    -- B03: concepto histórico por renglón
  tarifa_iva_id        bigint,                                     -- B03: tarifa histórica por renglón
  documento_afectado   text,
  concepto             text,
  valor_moneda         dinero,                                     -- TVALORUS (moneda alterna)
  nit_alterno          text,                                       -- NITN (tercero alterno)
  archivo_origen       text,                                       -- TARCHI (procedencia)
  origen               text NOT NULL DEFAULT 'Manual',
  CONSTRAINT lote_lineas_numero_uk UNIQUE (lote_id, numero_linea),
  CONSTRAINT lote_lineas_sin_doble_valor CHECK (debito = 0 OR credito = 0),
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
    REFERENCES tarifas_iva (compania_id, id)
);

-- -------------------------------------------------------------------
-- Validaciones del lote (centro de validación).
-- -------------------------------------------------------------------
CREATE TABLE lote_validaciones (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lote_id    bigint NOT NULL REFERENCES lotes (id) ON DELETE CASCADE,
  linea_id   bigint REFERENCES lote_lineas (id) ON DELETE CASCADE,
  severidad  text NOT NULL CHECK (severidad IN ('Error', 'Advertencia')),
  ambito     text NOT NULL CHECK (ambito IN ('Global', 'Documento', 'Comprobante', 'Linea')),
  tipo       text NOT NULL,                                  -- 'Tercero obligatorio', 'Descuadre', …
  mensaje    text NOT NULL,
  campo      text,                                           -- 'tercero', 'centro', 'cuenta'…
  resuelta   boolean NOT NULL DEFAULT false
);

-- -------------------------------------------------------------------
-- Documentos contabilizados (el libro mayor). B01: un lote puede
-- producir VARIOS documentos (uno por grupo documental).
-- -------------------------------------------------------------------
CREATE TABLE documentos (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id           bigint NOT NULL REFERENCES companias (id),
  anio                  integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  comprobante_id        bigint NOT NULL,
  numero                bigint NOT NULL,                     -- consecutivo -> CE-000245
  documento             text,                                -- NOM-2026-02
  tipo_documento_id     bigint,                              -- B04: tipo documental en el libro
  fecha                 date NOT NULL,
  fecha_documento       date,
  periodo               text NOT NULL CHECK (periodo IN
                          ('00','01','02','03','04','05','06',
                           '07','08','09','10','11','12',
                           '13','14','15','16','17','18')),
  tercero_id            bigint,
  concepto              text,
  estado                text NOT NULL DEFAULT 'Contabilizado'
                          CHECK (estado IN ('Contabilizado', 'Anulado')),
  -- Procedencia del documento. El legado no lleva documentos propios de este
  -- modelo: su historia entra marcada como 'Migracion', y eso la exime de la
  -- unicidad de `documentos_contabilizado_uk` (ver 10_indices.sql), porque la
  -- numeración del legado no es única por año.
  origen                text NOT NULL DEFAULT 'Manual',
  lote_id               bigint,
  usuario_id            bigint NOT NULL,                     -- FK en 08_seguridad
  idempotency_key       uuid NOT NULL DEFAULT gen_random_uuid(),
  documento_original_id bigint,                              -- original <-> reversión
  motivo_anulacion      text,
  soporte_anulacion     text,
  -- Campos del origen sin columna propia, crudos, con su nombre físico y sólo si
  -- traen valor (etapa A de db/migration/08_plan_para_culminar.md).
  legado                jsonb,
  creado_en             timestamptz,
  creado_por            integer,
  actualizado_en        timestamptz,
  actualizado_por       integer,
  version               integer NOT NULL DEFAULT 0,
  CONSTRAINT documentos_uk UNIQUE (compania_id, anio, comprobante_id, numero),
  CONSTRAINT documentos_idempotencia_uk UNIQUE (idempotency_key),
  CONSTRAINT documentos_compania_id_uk UNIQUE (compania_id, id),
  CONSTRAINT documentos_comprobante_fk FOREIGN KEY (compania_id, comprobante_id)
    REFERENCES comprobantes (compania_id, id),
  CONSTRAINT documentos_tipodoc_fk FOREIGN KEY (compania_id, tipo_documento_id)
    REFERENCES tipos_documento (compania_id, id),
  CONSTRAINT documentos_tercero_fk FOREIGN KEY (compania_id, tercero_id)
    REFERENCES terceros (compania_id, id),
  CONSTRAINT documentos_lote_fk FOREIGN KEY (compania_id, lote_id)
    REFERENCES lotes (compania_id, id),
  CONSTRAINT documentos_reversion_fk FOREIGN KEY (documento_original_id)
    REFERENCES documentos (id)
);

CREATE TABLE documento_lineas (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  documento_id         bigint NOT NULL REFERENCES documentos (id),
  compania_id          bigint NOT NULL REFERENCES companias (id),   -- B05
  numero_linea         integer NOT NULL,
  cuenta_id            bigint NOT NULL,
  tercero_id           bigint,
  centro_costo_id      bigint,
  tipo_documento_id    bigint,                              -- B04: TIPODOC por renglón
  debito               dinero NOT NULL DEFAULT 0 CHECK (debito >= 0),
  credito              dinero NOT NULL DEFAULT 0 CHECK (credito >= 0),
  base                 dinero NOT NULL DEFAULT 0,
  clase                text NOT NULL DEFAULT '' CHECK (clase IN ('IVA', 'Retencion', 'Otro', '')),
  concepto_retencion_id bigint,                             -- B03: concepto histórico
  tarifa_iva_id        bigint,                              -- B03: tarifa histórica
  fecha_documento      date,                                -- B04: TFECDOC
  valor_moneda         dinero,                              -- B04: TVALORUS
  nit_alterno          text,                                -- B04: NITN
  documento_afectado   text,
  concepto             text,
  archivo_origen       text,                                -- B04: TARCHI (procedencia)
  origen               text NOT NULL DEFAULT 'Manual',
  -- Campos del origen sin columna propia, crudos, con su nombre físico y sólo si
  -- traen valor (etapa A de db/migration/08_plan_para_culminar.md).
  legado               jsonb,
  CONSTRAINT documento_lineas_numero_uk UNIQUE (documento_id, numero_linea),
  CONSTRAINT documento_lineas_sin_doble_valor CHECK (debito = 0 OR credito = 0),
  -- B05: FK compuestas
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
    REFERENCES tarifas_iva (compania_id, id)
);

-- Disparadores de auditoría.
CREATE TRIGGER trg_lotes_auditoria BEFORE UPDATE ON lotes
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_documentos_auditoria BEFORE UPDATE ON documentos
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();

COMMIT;
