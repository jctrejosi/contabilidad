-- =====================================================================
-- CONTABDSI · 10_indices.sql
-- Capa de indexación. Cada índice está justificado por un patrón de
-- consulta real de la aplicación (ver comentario por índice).
-- Se carga al final (después de las tablas y los triggers).
-- =====================================================================

BEGIN;

-- Búsqueda de texto por nombre en maestros (UI: "Buscar por código o nombre").
-- Requiere la extensión pg_trgm (disponible en PostgreSQL estándar; en
-- entornos gestionados puede requerir permiso de superusuario).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX cuentas_nombre_trgm_idx ON cuentas USING gin (nombre gin_trgm_ops);
CREATE INDEX terceros_nombre_trgm_idx ON terceros USING gin (nombre gin_trgm_ops);

-- -------------------------------------------------------------------
-- MOVIMIENTOS
-- -------------------------------------------------------------------

-- Listado de lotes: filtro por estado dentro de compañía/año
--   SELECT * FROM lotes WHERE compania_id=? AND anio=? AND estado=?
CREATE INDEX lotes_estado_idx ON lotes (compania_id, anio, estado);

-- Consultas por período (movimiento mensual, cierres)
CREATE INDEX lotes_periodo_idx ON lotes (compania_id, anio, periodo);

-- "Mis lotes" / reasignación por usuario
CREATE INDEX lotes_usuario_idx ON lotes (usuario_id);

-- Búsqueda de lotes por documento (detección de duplicados entre lotes)
CREATE INDEX lotes_documento_idx ON lotes (compania_id, anio, documento);

-- Líneas de lote por cuenta/tercero/centro (validación y edición en grilla)
CREATE INDEX lote_lineas_cuenta_idx ON lote_lineas (cuenta_id);
CREATE INDEX lote_lineas_tercero_idx ON lote_lineas (tercero_id);
CREATE INDEX lote_lineas_centro_idx ON lote_lineas (centro_costo_id);

-- Centro de validación: issues de un lote por severidad
CREATE INDEX lote_validaciones_severidad_idx ON lote_validaciones (lote_id, severidad);

-- Documentos: consulta general por período, ordenada por fecha
--   SELECT ... WHERE compania_id=? AND anio=? AND periodo=? ORDER BY fecha
CREATE INDEX documentos_periodo_idx ON documentos (compania_id, anio, periodo, fecha);

-- Documentos por estado (Contabilizados del período, anulación)
CREATE INDEX documentos_estado_idx ON documentos (compania_id, anio, estado);

-- Documentos por tercero (consulta por NIT)
CREATE INDEX documentos_tercero_idx ON documentos (tercero_id);

-- Del lote al documento generado (trazabilidad)
CREATE INDEX documentos_lote_idx ON documentos (lote_id);

-- REGLA DE NEGOCIO COMO ÍNDICE PARCIAL ÚNICO:
-- Un documento (ej. NOM-2026-02) sólo puede estar contabilizado UNA vez.
-- La base lo garantiza sin depender de la lógica de la aplicación.
--
-- La regla vale para los documentos que produce este sistema, **no para la
-- historia migrada**, y no por comodidad: la numeración del legado no es única.
-- Medido sobre las 735.976 cabeceras de `CONDOCUM`:
--   · `(anio, documento)` colisiona 73.236 veces;
--   · `DDOCUM` tampoco se salva añadiendo comprobante, tipo documental, período
--     ni NIT: la mejor combinación (`comprobante+tipo+fecha+documento+valor`)
--     todavía colisiona 29.059 veces, y hay etiquetas reutilizadas por 15
--     documentos distintos con 14 NIT distintos.
-- El legado tampoco distinguía esos documentos por su etiqueta, así que la
-- historia entra con `origen = 'Migracion'` y queda fuera del índice; los
-- documentos propios quedan cubiertos igual que antes. Evidencia y decisión:
-- `db/migration/07_decisiones_del_libro.md`.
CREATE UNIQUE INDEX documentos_contabilizado_uk ON documentos (compania_id, anio, documento)
  WHERE estado = 'Contabilizado' AND origen <> 'Migracion';

-- Líneas de documento por cuenta/tercero/centro (auxiliares, acumulados)
CREATE INDEX documento_lineas_cuenta_idx ON documento_lineas (cuenta_id);
CREATE INDEX documento_lineas_tercero_idx ON documento_lineas (tercero_id);
CREATE INDEX documento_lineas_centro_idx ON documento_lineas (centro_costo_id);

-- Consulta por documento afectado (pantalla "Documento específico")
CREATE INDEX documento_lineas_afectado_idx ON documento_lineas (documento_afectado);

-- Líneas con clase fiscal (sólo las que alimentan acumulados de IVA/retención)
-- Índice PARCIAL: pequeño, acelera regenerar_acumulados() y los informes.
CREATE INDEX documento_lineas_clase_idx ON documento_lineas (clase, cuenta_id)
  WHERE clase IN ('IVA', 'Retencion');

-- -------------------------------------------------------------------
-- SALDOS (consultas anuales por cuenta/tercero/centro)
-- Los UNIQUE ya cubren (compania, anio, periodo, …); estos índices cubren
-- el patrón "anual por X" sin período (drill-down de 12 meses):
-- -------------------------------------------------------------------
CREATE INDEX saldos_cuenta_anual_idx ON saldos_cuenta (compania_id, anio, cuenta_id);
CREATE INDEX saldos_cuenta_tercero_anual_idx ON saldos_cuenta_tercero (compania_id, anio, tercero_id, cuenta_id);
CREATE INDEX saldos_cuenta_centro_anual_idx ON saldos_cuenta_centro (compania_id, anio, centro_costo_id, cuenta_id);

-- -------------------------------------------------------------------
-- MEDIOS MAGNÉTICOS
-- -------------------------------------------------------------------
CREATE INDEX medio_filas_generacion_idx ON medio_filas (generacion_id);
CREATE INDEX medio_filas_tercero_idx ON medio_filas (tercero_id);
CREATE INDEX medio_filas_formato_idx ON medio_filas (formato_id);

-- -------------------------------------------------------------------
-- BITÁCORA (auditoría): filtros por compañía/año además de los ya creados
-- -------------------------------------------------------------------
CREATE INDEX auditoria_compania_anio_idx ON auditoria (compania_id, anio);

-- -------------------------------------------------------------------
-- PROCESOS / CIERRES / CONSOLIDACIONES (poco volumen, cubre compañía/año)
-- -------------------------------------------------------------------
CREATE INDEX procesos_compania_anio_idx ON procesos (compania_id, anio);
CREATE INDEX cierres_compania_anio_idx ON cierres (compania_id, anio);
CREATE INDEX consolidaciones_destino_anio_idx ON consolidaciones (compania_destino_id, anio);

-- -------------------------------------------------------------------
-- PRESUPUESTO
-- -------------------------------------------------------------------
CREATE INDEX presupuesto_rubros_padre_idx ON presupuesto_rubros (presupuesto_id, parent_id);

COMMIT;

-- -------------------------------------------------------------------
-- Notas de operación PostgreSQL (aplicar en producción):
--   1) ANALYZE tras cargas masivas (imports de exógena, consolidaciones).
--   2) Autovacuum más agresivo en tablas calientes (saldos_*, consecutivos,
--      documento_lineas): son las que más se actualizan (HOT) e insertan.
--   3) Cuando el histórico crezca (varios años), particionar por anio:
--      documentos, documento_lineas, saldos_* y auditoria.
--   4) pg_trgm para búsquedas de texto en maestros (ya incluido).
--   5) Los índices parciales (documentos_contabilizado_uk,
--      documento_lineas_clase_idx) mantienen el tamaño bajo al cubrir
--      solo el subconjunto relevante.
-- -------------------------------------------------------------------
