-- =====================================================================
-- CONTABDSI · 04_movimientos.sql
-- Lotes, líneas, validaciones, documentos (libro) y reversiones.
-- Contrato: idempotencia, control de versión y contabilización atómica.
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
  usuario_id      integer NOT NULL,
  origen          text NOT NULL DEFAULT 'Manual',            -- 'Manual' | 'Excel' | 'Nomina' | 'Reembolso' | …
  fecha           date NOT NULL,
  estado          text NOT NULL DEFAULT 'Borrador' CHECK (estado IN
                    ('Borrador', 'Con errores', 'Verificado',
                     'Pendiente aprobacion', 'Aprobado',
                     'Contabilizando', 'Contabilizado', 'Fallido', 'Anulado')),
  comprobante_id  bigint REFERENCES comprobantes (id),
  documento       text,                                      -- 'NOM-2026-02'
  idempotency_key uuid NOT NULL DEFAULT gen_random_uuid(),   -- doble envío prevenido
  motivo          text,                                      -- anulación / rechazo
  creado_en       timestamptz,
  creado_por      integer,
  actualizado_en  timestamptz,
  actualizado_por integer,
  version         integer NOT NULL DEFAULT 0,
  CONSTRAINT lotes_codigo_uk UNIQUE (compania_id, anio, codigo),
  CONSTRAINT lotes_idempotencia_uk UNIQUE (idempotency_key)
);

-- -------------------------------------------------------------------
-- Líneas de lote (grilla editable).
-- -------------------------------------------------------------------
CREATE TABLE lote_lineas (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lote_id           bigint NOT NULL REFERENCES lotes (id) ON DELETE CASCADE,
  numero_linea      integer NOT NULL,
  cuenta_id         bigint REFERENCES cuentas (id),
  tercero_id        bigint REFERENCES terceros (id),
  centro_costo_id   bigint REFERENCES centros_costos (id),
  comprobante       text,
  documento         text,
  fecha             date,
  debito            dinero NOT NULL DEFAULT 0 CHECK (debito >= 0),
  credito           dinero NOT NULL DEFAULT 0 CHECK (credito >= 0),
  base              dinero NOT NULL DEFAULT 0,
  clase             text NOT NULL DEFAULT '' CHECK (clase IN ('IVA', 'Retencion', 'Otro', '')),
  documento_afectado text,
  concepto          text,
  origen            text NOT NULL DEFAULT 'Manual',
  CONSTRAINT lote_lineas_numero_uk UNIQUE (lote_id, numero_linea),
  CONSTRAINT lote_lineas_sin_doble_valor CHECK (debito = 0 OR credito = 0)
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
-- Documentos contabilizados (el libro mayor).
-- Cada documento agrupa las líneas ya contabilizadas de un comprobante.
-- -------------------------------------------------------------------
CREATE TABLE documentos (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id           bigint NOT NULL REFERENCES companias (id),
  anio                  integer NOT NULL CHECK (anio BETWEEN 1900 AND 2999),
  comprobante_id        bigint NOT NULL REFERENCES comprobantes (id),
  numero                bigint NOT NULL,                     -- consecutivo -> CE-000245
  documento             text,                                -- NOM-2026-02
  fecha                 date NOT NULL,
  periodo               text NOT NULL CHECK (periodo IN
                          ('00','01','02','03','04','05','06',
                           '07','08','09','10','11','12',
                           '13','14','15','16','17','18')),
  tercero_id            bigint REFERENCES terceros (id),
  concepto              text,
  estado                text NOT NULL DEFAULT 'Contabilizado'
                          CHECK (estado IN ('Contabilizado', 'Anulado')),
  lote_id               bigint REFERENCES lotes (id),
  usuario_id            integer NOT NULL,
  idempotency_key       uuid NOT NULL DEFAULT gen_random_uuid(),
  documento_original_id bigint REFERENCES documentos (id),   -- original <-> reversión
  motivo_anulacion      text,
  soporte_anulacion     text,
  creado_en             timestamptz,
  creado_por            integer,
  actualizado_en        timestamptz,
  actualizado_por       integer,
  version               integer NOT NULL DEFAULT 0,
  CONSTRAINT documentos_uk UNIQUE (compania_id, anio, comprobante_id, numero),
  CONSTRAINT documentos_idempotencia_uk UNIQUE (idempotency_key)
);

CREATE TABLE documento_lineas (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  documento_id    bigint NOT NULL REFERENCES documentos (id) ON DELETE CASCADE,
  numero_linea    integer NOT NULL,
  cuenta_id       bigint NOT NULL REFERENCES cuentas (id),
  tercero_id      bigint REFERENCES terceros (id),
  centro_costo_id bigint REFERENCES centros_costos (id),
  debito          dinero NOT NULL DEFAULT 0 CHECK (debito >= 0),
  credito         dinero NOT NULL DEFAULT 0 CHECK (credito >= 0),
  base            dinero NOT NULL DEFAULT 0,
  clase           text NOT NULL DEFAULT '' CHECK (clase IN ('IVA', 'Retencion', 'Otro', '')),
  documento_afectado text,
  concepto        text,
  origen          text NOT NULL DEFAULT 'Manual',
  CONSTRAINT documento_lineas_numero_uk UNIQUE (documento_id, numero_linea)
);

-- Disparadores de auditoría.
CREATE TRIGGER trg_lotes_auditoria BEFORE UPDATE ON lotes
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_documentos_auditoria BEFORE UPDATE ON documentos
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();

COMMIT;
