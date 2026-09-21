-- =====================================================================
-- CONTABDSI · 12_migracion.sql
-- Trazabilidad del cargador de datos (contrato del §4 del plan de carga).
--
-- El plan exige, por fila: localizador en la instantánea, clave de negocio
-- cruda, flags, valores originales, resultado y destino; equivalencias
-- source-key → id persistentes; rechazos con causa; y registro de las
-- transformaciones aprobadas. Nada de eso tiene cabida en las tablas de
-- negocio: son datos de la migración, no de la contabilidad.
--
-- Estas tablas son **de sólo anexado** para el cargador: no llevan triggers de
-- auditoría ni versión, y ningún servicio del backend las escribe.
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Ejecuciones: una por corrida del cargador, con la huella del conjunto
-- fuente + transformaciones. Dos corridas con la misma huella deben ser
-- idempotentes (no duplicar ni renumerar).
-- -------------------------------------------------------------------
CREATE TABLE migracion_ejecuciones (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  huella        text NOT NULL,                             -- hash de fuente + transformaciones
  version_contrato text,                                   -- huella de reglas.py/contrato_campos.json
  origen        text NOT NULL,                             -- p. ej. 'ADD_CONTAB' + ruta de la instantánea
  descripcion   text,
  simulacion    boolean NOT NULL DEFAULT false,            -- ensayo: no debe tocar tablas de negocio
  estado        text NOT NULL DEFAULT 'En curso'
                  CHECK (estado IN ('En curso', 'Completada', 'Fallida', 'Revertida')),
  iniciado_en   timestamptz NOT NULL DEFAULT now(),
  terminado_en  timestamptz,
  creado_por    integer,
  CONSTRAINT migracion_ejecuciones_terminada_con_fecha
    CHECK (estado = 'En curso' OR terminado_en IS NOT NULL)
);

-- -------------------------------------------------------------------
-- Archivos de la instantánea: uno por `.ADT` exportado, con hashes y
-- conteos. `(ejecucion_id, ruta)` es único porque el mismo archivo no se
-- procesa dos veces en la misma corrida.
-- -------------------------------------------------------------------
CREATE TABLE migracion_archivos (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ejecucion_id   bigint NOT NULL REFERENCES migracion_ejecuciones (id) ON DELETE CASCADE,
  ruta           text NOT NULL,
  nombre         text NOT NULL,
  tabla_origen   text NOT NULL,                            -- 'MOV00', 'CONMAE', …
  formato        text NOT NULL DEFAULT 'CSV' CHECK (formato IN ('CSV', 'ADT')),
  bytes          bigint,
  filas          integer,
  hash_contenido text,
  compania_codigo text,
  anio           integer CHECK (anio IS NULL OR anio BETWEEN 1900 AND 2999),
  extraido_en    timestamptz,
  procesado_en   timestamptz,
  estado         text NOT NULL DEFAULT 'Pendiente'
                   CHECK (estado IN ('Pendiente', 'Procesado', 'Rechazado')),
  CONSTRAINT migracion_archivos_uk UNIQUE (ejecucion_id, ruta)
);

-- -------------------------------------------------------------------
-- Filas: la unidad de trazabilidad. `valores_originales` guarda el renglón
-- **crudo** con los nombres físicos del legado (TINCON, TSALDO, …), que es
-- lo que permite preservar los campos sin destino tipado sin inventar
-- columnas de negocio.
-- -------------------------------------------------------------------
CREATE TABLE migracion_filas (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ejecucion_id     bigint NOT NULL REFERENCES migracion_ejecuciones (id) ON DELETE CASCADE,
  archivo_id       bigint NOT NULL REFERENCES migracion_archivos (id) ON DELETE CASCADE,
  tabla_origen     text NOT NULL,
  localizador      text NOT NULL,                          -- renglón/NREC de la instantánea
  clave_negocio    text,                                   -- clave cruda, sin homologar
  resultado        text NOT NULL
                     CHECK (resultado IN ('Cargado', 'Fusionado', 'Derivado',
                                          'Excluido', 'Rechazado')),
  destino_tabla    text,
  destino_id       bigint,
  flags            text[],
  valores_originales jsonb NOT NULL,
  causa_rechazo    text,
  responsable      text,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT migracion_filas_uk UNIQUE (ejecucion_id, archivo_id, localizador),
  -- Un rechazo sin causa escrita no es trazabilidad: es un dato perdido.
  CONSTRAINT migracion_filas_rechazo_con_causa
    CHECK (resultado <> 'Rechazado'
           OR (causa_rechazo IS NOT NULL AND btrim(causa_rechazo) <> ''))
);

-- -------------------------------------------------------------------
-- Equivalencias clave origen → id destino, persistentes y reutilizables
-- entre entidades (un tercero referenciado por documento, lote y saldo
-- resuelve al mismo id).
-- `NULLS NOT DISTINCT` porque en ámbito global la compañía va nula: sin
-- esto, PostgreSQL admitiría duplicados al no comparar los NULL.
-- -------------------------------------------------------------------
CREATE TABLE migracion_equivalencias (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entidad       text NOT NULL,                             -- 'terceros', 'cuentas', 'centros_costos', …
  ambito        text NOT NULL DEFAULT 'global' CHECK (ambito IN ('global', 'local')),
  compania_id   bigint REFERENCES companias (id),
  clave_origen  text NOT NULL,
  tabla_destino text NOT NULL,
  destino_id    bigint NOT NULL,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT migracion_equivalencias_uk
    UNIQUE NULLS NOT DISTINCT (entidad, ambito, compania_id, clave_origen)
);

-- -------------------------------------------------------------------
-- Ajustes aprobados: todo valor que la carga **cambió** respecto del
-- original (redondeo, trim, equivalencia de código) queda con su motivo y
-- quién lo aprobó. Sin esta tabla, una diferencia de conciliación no tiene
-- explicación.
-- -------------------------------------------------------------------
CREATE TABLE migracion_ajustes (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ejecucion_id  bigint NOT NULL REFERENCES migracion_ejecuciones (id) ON DELETE CASCADE,
  fila_id       bigint REFERENCES migracion_filas (id) ON DELETE CASCADE,
  campo         text NOT NULL,
  valor_origen  text,
  valor_cargado text,
  motivo        text NOT NULL,
  aprobado_por  integer,
  aprobado_en   timestamptz,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT migracion_ajustes_fila_campo_uk UNIQUE (fila_id, campo),
  CONSTRAINT migracion_ajustes_motivo_obligatorio CHECK (btrim(motivo) <> '')
);

-- Índices para las consultas de conciliación del cargador.
CREATE INDEX migracion_archivos_ejecucion_ix ON migracion_archivos (ejecucion_id, tabla_origen);
CREATE INDEX migracion_filas_resultado_ix    ON migracion_filas (ejecucion_id, resultado);
CREATE INDEX migracion_filas_destino_ix      ON migracion_filas (destino_tabla, destino_id);
CREATE INDEX migracion_filas_valores_ix      ON migracion_filas USING gin (valores_originales);
CREATE INDEX migracion_equivalencias_clave_ix ON migracion_equivalencias (entidad, clave_origen);

COMMIT;
