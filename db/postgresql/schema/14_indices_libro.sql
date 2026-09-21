-- =====================================================================
-- CONTABDSI · 14_indices_libro.sql
-- Índices que salieron de cargar el libro (paso 10 del plan: «restricciones e
-- índices restantes»).
--
-- Historia de estos dos índices, porque su razón original ya no se sostiene:
--
-- Se añadieron mientras se diagnosticaba por qué la carga de `documento_lineas`
-- no terminaba. La causa real era doble y ninguna era falta de índice:
--   1. la unión resolvía el tercero con un `OR` entre dos columnas (`nit = x OR
--      codigo_legado = x`), lo que anula el uso del índice de `nit`;
--   2. el cargador resolvía cada clave con **búsquedas por índice fila a fila**,
--      diez millones de recorridos aleatorios sobre `terceros`.
-- Se corrigieron las dos: el cargador resuelve ahora con tablas hash temporales y
-- uniones hash (ver `db/migration/cargador/cargar.py`). La carga completa pasó de
-- no terminar en 30 minutos a 16 minutos, y la entidad de renglones sola a unos
-- 10. Con eso, **estos índices ya no los usa la migración**.
--
-- Se conservan porque sí sirven a las consultas del backend y de la interfaz:
--   * `terceros_codigo_legado_idx`: búsqueda de un tercero por su código heredado
--     (`CCODIGO`), que `terceros.codigo_legado` guarda.
--   * `documentos_documento_idx`: la consulta de documentos filtrada por número
--     de documento y período, que es la que usa la pantalla de consulta
--     (`docs/CONSULTA_DOCUMENTOS_ADS.md`).
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Búsqueda del tercero por su código heredado.
--
-- La carga resolvía el NIT del movimiento por `terceros.nit` y, si no estaba, por
-- `terceros.codigo_legado` (el `CCODIGO` del legado). Con dos columnas en un `OR`
-- PostgreSQL no puede usar el índice de `nit`, así que cada búsqueda iba por su
-- cuenta y este índice cubría la segunda.
-- -------------------------------------------------------------------
CREATE INDEX terceros_codigo_legado_idx ON terceros (compania_id, codigo_legado);

-- -------------------------------------------------------------------
-- Consulta de documentos por número y período.
--
-- Nótese que este índice **no** cubre la unión de `MOVxx`: la clave de cabecera
-- que la migración usa es (comprobante, tipo documental, documento, fecha), y la
-- resuelve con una unión hash, no con este índice. Se conserva por la consulta
-- de la interfaz.
-- -------------------------------------------------------------------
CREATE INDEX documentos_documento_idx
  ON documentos (compania_id, documento, anio, periodo)
  WHERE documento IS NOT NULL;

COMMIT;
