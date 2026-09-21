-- =====================================================================
-- CONTABDSI · db/advantage/02_indices.sql
-- Diccionario de datos Advantage ADS — índices de las 60 tablas.
-- =====================================================================
-- Motor: Advantage Database Server (ADS), diccionario de datos .ADD.
-- En ADS la unicidad y el acceso se declaran con ÍNDICES (no con
-- constraints como PostgreSQL): los CHECK no existen y las FK se validan
-- en el servicio, pero las UK del modelo SÍ se materializan como
-- CREATE UNIQUE INDEX. Los índices compuestos (compania_id + …) replican
-- las UK del modelo y además sostienen el aislamiento entre compañías.
--
-- Sintaxis (igual que 01_tablas.sql: guía de traducción, revisar con
-- Advantage Data Architect; omitimos IN DATABASE por legibilidad):
--
--   CREATE UNIQUE INDEX <nombre> ON <tabla> (columna, …);
--   CREATE INDEX <nombre> ON <tabla> (columna, …);
--
-- Nomenclatura (trazable con PostgreSQL):
--   <tabla>_pk              → PK: índice único sobre id (59 tablas con id
--                             AUTOINC; rol_permisos no tiene id — su índice
--                             único (rol_id, permiso_id) oficia de PK).
--   <nombre_constraint_pg>  → UK de negocio y de aislamiento: se reutiliza
--                             el nombre del constraint UNIQUE de
--                             db/postgresql/schema/*.sql donde existe.
--   <tabla>_<motivo>_idx    → índices de consulta (no únicos), mismos
--                             nombres que postgresql/10_indices.sql.
--
-- LIMITACIONES ADS que condicionan este archivo:
--   1) No hay índices PARCIALES: la UK parcial "un documento solo una vez
--      Contabilizado" (excluida la historia migrada, origen = 'Migracion')
--      se emula con la columna derivada documento_estado
--      (declarada en 01_tablas.sql, tabla 23) mantenida por el servicio o
--      trigger del diccionario. El índice parcial del filtro de clase
--      IVA/Retencion se traduce a índice completo (clase, cuenta_id).
--   2) Índices únicos sobre columnas anulables: verificar en Data
--      Architect la semántica de NULL (usuarios.email, lotes.origen_
--      referencia, presupuesto_rubros, medio_topes, documentos).
--   3) Sin índices de texto (trigramas): ver nota al final.

-- =====================================================================
-- MÓDULO 1 — NÚCLEO: entidades 1–5
-- =====================================================================

-- 1. companias
CREATE UNIQUE INDEX companias_pk ON companias (id);                    -- PK
CREATE UNIQUE INDEX companias_codigo_uk ON companias (codigo);         -- UK: código de empresa único
CREATE UNIQUE INDEX companias_nit_uk ON companias (nit, digito);       -- UK: NIT + DV único (sin compania_id: tabla transversal)

-- 2. compania_anios
CREATE UNIQUE INDEX compania_anios_pk ON compania_anios (id);          -- PK
CREATE UNIQUE INDEX compania_anios_uk ON compania_anios (compania_id, anio);  -- UK: un registro por compañía/año

-- 3. periodos_contables
CREATE UNIQUE INDEX periodos_contables_pk ON periodos_contables (id);  -- PK
CREATE UNIQUE INDEX periodos_contables_uk ON periodos_contables (compania_id, anio, periodo);  -- UK: período único por compañía/año

-- 4. parametros_operacion
CREATE UNIQUE INDEX parametros_operacion_pk ON parametros_operacion (id);  -- PK
CREATE UNIQUE INDEX parametros_operacion_uk ON parametros_operacion (compania_id, anio);  -- UK: 1:1 con compañía/año

-- 5. parametros_nomina
CREATE UNIQUE INDEX parametros_nomina_pk ON parametros_nomina (id);    -- PK
CREATE UNIQUE INDEX parametros_nomina_uk ON parametros_nomina (compania_id, anio);  -- UK: 1:1 con compañía/año

-- =====================================================================
-- MÓDULO 2 — MAESTROS: entidades 6–19
-- =====================================================================

-- 6. cuentas
CREATE UNIQUE INDEX cuentas_pk ON cuentas (id);                        -- PK
CREATE UNIQUE INDEX cuentas_codigo_uk ON cuentas (compania_id, codigo);  -- UK: código del plan único por compañía
CREATE UNIQUE INDEX cuentas_compania_id_uk ON cuentas (compania_id, id);  -- UK aislamiento: soporta FK compuestas (compania_id, id)
-- Búsqueda textual por nombre del plan de cuentas: sin equivalente ADS
-- (pg_trgm); la hace el servicio — ver nota al final.

-- 7. terceros
CREATE UNIQUE INDEX terceros_pk ON terceros (id);                      -- PK
CREATE UNIQUE INDEX terceros_nit_uk ON terceros (compania_id, nit);    -- UK: NIT único por compañía
CREATE UNIQUE INDEX terceros_compania_id_uk ON terceros (compania_id, id);  -- UK aislamiento: soporta FK compuestas (compania_id, id)
-- Búsqueda textual por nombre de tercero: sin equivalente ADS; la hace el
-- servicio — ver nota al final.

-- 8. tercero_etiquetas
CREATE UNIQUE INDEX tercero_etiquetas_pk ON tercero_etiquetas (id);    -- PK
CREATE UNIQUE INDEX tercero_etiquetas_uk ON tercero_etiquetas (tercero_id, etiqueta);  -- UK: etiqueta no repetida por tercero

-- 9. centros_costos
CREATE UNIQUE INDEX centros_costos_pk ON centros_costos (id);          -- PK
CREATE UNIQUE INDEX centros_costos_codigo_uk ON centros_costos (compania_id, codigo);  -- UK: código único por compañía
CREATE UNIQUE INDEX centros_costos_compania_id_uk ON centros_costos (compania_id, id);  -- UK aislamiento: soporta FK compuestas

-- 10. comprobantes
CREATE UNIQUE INDEX comprobantes_pk ON comprobantes (id);              -- PK
CREATE UNIQUE INDEX comprobantes_codigo_uk ON comprobantes (compania_id, codigo);  -- UK: código único por compañía
CREATE UNIQUE INDEX comprobantes_compania_id_uk ON comprobantes (compania_id, id);  -- UK aislamiento: la exige documentos (FK compuesta)

-- 11. consecutivos_comprobantes
CREATE UNIQUE INDEX consecutivos_pk ON consecutivos_comprobantes (id); -- PK
CREATE UNIQUE INDEX consecutivos_uk ON consecutivos_comprobantes (compania_id, anio, comprobante_id);  -- UK: un consecutivo por comprobante/año
-- Fila MÁS CALIENTE del modelo: sin índices adicionales (llenado reducido
-- y bloqueo de registro corto dentro de la transacción del servicio).

-- 12. tipos_documento
CREATE UNIQUE INDEX tipos_documento_pk ON tipos_documento (id);        -- PK
CREATE UNIQUE INDEX tipos_documento_codigo_uk ON tipos_documento (compania_id, codigo);  -- UK: código único por compañía
CREATE UNIQUE INDEX tipos_documento_compania_id_uk ON tipos_documento (compania_id, id);  -- UK aislamiento: la exigen lote_lineas, documento_lineas y documentos

-- 13. conceptos_retencion
CREATE UNIQUE INDEX conceptos_retencion_pk ON conceptos_retencion (id);  -- PK
CREATE UNIQUE INDEX conceptos_retencion_codigo_uk ON conceptos_retencion (compania_id, codigo);  -- UK: código único por compañía
CREATE UNIQUE INDEX conceptos_retencion_compania_id_uk ON conceptos_retencion (compania_id, id);  -- UK aislamiento: FK históricas de líneas y acumulados

-- 14. tarifas_iva
CREATE UNIQUE INDEX tarifas_iva_pk ON tarifas_iva (id);                -- PK
CREATE UNIQUE INDEX tarifas_iva_codigo_uk ON tarifas_iva (compania_id, codigo);  -- UK: código único por compañía
CREATE UNIQUE INDEX tarifas_iva_compania_id_uk ON tarifas_iva (compania_id, id);  -- UK aislamiento: FK históricas de líneas y acumulados

-- 15. renglones_renta
CREATE UNIQUE INDEX renglones_renta_pk ON renglones_renta (id);        -- PK
CREATE UNIQUE INDEX renglones_renta_codigo_uk ON renglones_renta (compania_id, codigo);  -- UK: código único por compañía

-- 16. plantillas_contables
CREATE UNIQUE INDEX plantillas_contables_pk ON plantillas_contables (id);  -- PK
CREATE UNIQUE INDEX plantillas_codigo_uk ON plantillas_contables (compania_id, codigo);  -- UK: código único por compañía

-- 17. plantilla_lineas
CREATE UNIQUE INDEX plantilla_lineas_pk ON plantilla_lineas (id);      -- PK
-- Detalle puro: acceso siempre por plantilla_id (cabecera). PostgreSQL no
-- declara UK ni índices adicionales; si el borrado en cascada del servicio
-- recorre líneas por plantilla_id y el volumen lo exige, añadir aquí un
-- índice no único sobre (plantilla_id).

-- 18. formatos_documentales
CREATE UNIQUE INDEX formatos_documentales_pk ON formatos_documentales (id);  -- PK
CREATE UNIQUE INDEX formatos_codigo_uk ON formatos_documentales (compania_id, codigo);  -- UK: código único por compañía

-- 19. formato_elementos
CREATE UNIQUE INDEX formato_elementos_pk ON formato_elementos (id);    -- PK
-- Detalle puro: acceso por formato_id; sin UK adicional en PostgreSQL.

-- =====================================================================
-- MÓDULO 3 — MOVIMIENTOS: entidades 20–24
-- =====================================================================

-- 20. lotes
CREATE UNIQUE INDEX lotes_pk ON lotes (id);                            -- PK
CREATE UNIQUE INDEX lotes_codigo_uk ON lotes (compania_id, anio, codigo);  -- UK: código de lote único por compañía/año
CREATE UNIQUE INDEX lotes_idempotencia_uk ON lotes (idempotency_key);  -- UK: previene doble envío (UUID del servicio)
CREATE UNIQUE INDEX lotes_origen_referencia_uk ON lotes (compania_id, anio, origen_referencia);  -- UK: un archivo/operación se carga una vez (B07)
CREATE UNIQUE INDEX lotes_compania_id_uk ON lotes (compania_id, id);   -- UK aislamiento: la exige documentos (FK compuesta lote_id)
CREATE INDEX lotes_estado_idx ON lotes (compania_id, anio, estado);    -- listado de lotes por estado
CREATE INDEX lotes_periodo_idx ON lotes (compania_id, anio, periodo);  -- movimiento mensual y cierres
CREATE INDEX lotes_usuario_idx ON lotes (usuario_id);                  -- "Mis lotes" / reasignación
CREATE INDEX lotes_documento_idx ON lotes (compania_id, anio, documento);  -- detección de duplicados entre lotes
-- OJO: lotes_origen_referencia_uk incluye columna anulable (lotes manuales
-- sin origen_referencia): verificar en Data Architect la semántica de NULL
-- del índice único; alternativa si rechaza varios NULL: guardar '' vacío.

-- 21. lote_lineas
CREATE UNIQUE INDEX lote_lineas_pk ON lote_lineas (id);                -- PK
CREATE UNIQUE INDEX lote_lineas_numero_uk ON lote_lineas (lote_id, numero_linea);  -- UK: numeración única dentro del lote
CREATE INDEX lote_lineas_cuenta_idx ON lote_lineas (cuenta_id);        -- validación/edición por cuenta
CREATE INDEX lote_lineas_tercero_idx ON lote_lineas (tercero_id);      -- validación/edición por tercero
CREATE INDEX lote_lineas_centro_idx ON lote_lineas (centro_costo_id);  -- validación/edición por centro

-- 22. lote_validaciones
CREATE UNIQUE INDEX lote_validaciones_pk ON lote_validaciones (id);    -- PK
CREATE INDEX lote_validaciones_severidad_idx ON lote_validaciones (lote_id, severidad);  -- issues de un lote por severidad

-- 23. documentos (el libro mayor)
CREATE UNIQUE INDEX documentos_pk ON documentos (id);                  -- PK
CREATE UNIQUE INDEX documentos_uk ON documentos (compania_id, anio, comprobante_id, numero);  -- UK: consecutivo único por comprobante/año
CREATE UNIQUE INDEX documentos_idempotencia_uk ON documentos (idempotency_key);  -- UK: previene doble contabilización (UUID del servicio)
CREATE UNIQUE INDEX documentos_compania_id_uk ON documentos (compania_id, id);  -- UK aislamiento: la exige documento_lineas (FK documento_id)
-- UK PARCIAL del modelo emulada con columna derivada documento_estado
-- (= documento || '|' || estado, mantenida por servicio o trigger del
-- diccionario, ver 01_tablas.sql tabla 23): un mismo documento solo puede
-- existir UNA vez en estado Contabilizado, excluyendo la historia del legado
-- (origen = 'Migracion'). Esa exclusión responde a la evidencia medida en el
-- legado CONDOCUM: sobre las 735.976 cabeceras, (anio, documento) colisiona
-- 73.236 veces, y (comprobante + tipo documental + fecha + documento + valor)
-- todavía colisiona 29.059 veces; hay etiquetas reutilizadas por 15
-- documentos distintos con 14 NIT distintos, y el legado tampoco distinguía
-- esos documentos por su etiqueta. Evidencia completa en
-- db/migration/07_decisiones_del_libro.md.
-- ADS no soporta índices parciales (mapeo_motores §3): la emulación tendría
-- que derivar documento_estado también de `origen` (NULL para 'Migracion',
-- que los exime igual que el WHERE parcial de PostgreSQL); el invariante
-- queda declarado, no lo impone el motor. Alternativa si el despliegue
-- rechaza la columna: validación transaccional en el servicio (bloqueo +
-- conteo previo).
CREATE UNIQUE INDEX documentos_contabilizado_uk ON documentos (compania_id, anio, documento_estado);
CREATE INDEX documentos_periodo_idx ON documentos (compania_id, anio, periodo, fecha);  -- libro por período (ORDER BY fecha)
CREATE INDEX documentos_estado_idx ON documentos (compania_id, anio, estado);  -- contabilizados del período / anulación
CREATE INDEX documentos_tercero_idx ON documentos (tercero_id);        -- auxiliar por NIT
CREATE INDEX documentos_lote_idx ON documentos (lote_id);              -- trazabilidad lote → documento

-- 24. documento_lineas
CREATE UNIQUE INDEX documento_lineas_pk ON documento_lineas (id);      -- PK
CREATE UNIQUE INDEX documento_lineas_numero_uk ON documento_lineas (documento_id, numero_linea);  -- UK: numeración única dentro del documento
CREATE INDEX documento_lineas_cuenta_idx ON documento_lineas (cuenta_id);  -- auxiliares / regeneración por cuenta
CREATE INDEX documento_lineas_tercero_idx ON documento_lineas (tercero_id);  -- auxiliar por tercero
CREATE INDEX documento_lineas_centro_idx ON documento_lineas (centro_costo_id);  -- auxiliar por centro
CREATE INDEX documento_lineas_afectado_idx ON documento_lineas (documento_afectado);  -- pantalla "Documento específico"
-- Índice del filtro de clase fiscal (IVA/Retencion): en PostgreSQL es
-- PARCIAL (WHERE clase IN ('IVA','Retencion')); ADS no soporta parciales →
-- índice completo. Alternativa si el volumen lo exige: columna derivada
-- LOGICAL clase_fiscal mantenida por servicio/trigger (mapeo_motores §3) y
-- consultar filtrando por ella.
CREATE INDEX documento_lineas_clase_idx ON documento_lineas (clase, cuenta_id);

-- =====================================================================
-- MÓDULO 4 — SALDOS Y ACUMULADOS: entidades 25–32
-- =====================================================================
-- Los UNIQUE cubren el acceso por período; los índices *_anual_idx cubren
-- el patrón anual sin período (drill-down de 12 meses) de general/02 §3.

-- 25. saldos_cuenta
CREATE UNIQUE INDEX saldos_cuenta_pk ON saldos_cuenta (id);            -- PK
CREATE UNIQUE INDEX saldos_cuenta_uk ON saldos_cuenta (compania_id, anio, periodo, cuenta_id);  -- UK: un saldo por cuenta/período
CREATE INDEX saldos_cuenta_anual_idx ON saldos_cuenta (compania_id, anio, cuenta_id);  -- balance anual por cuenta

-- 26. saldos_cuenta_tercero
CREATE UNIQUE INDEX saldos_cuenta_tercero_pk ON saldos_cuenta_tercero (id);  -- PK
CREATE UNIQUE INDEX saldos_cuenta_tercero_uk ON saldos_cuenta_tercero (compania_id, anio, periodo, cuenta_id, tercero_id);  -- UK
CREATE INDEX saldos_cuenta_tercero_anual_idx ON saldos_cuenta_tercero (compania_id, anio, tercero_id, cuenta_id);  -- auxiliar anual por tercero

-- 27. saldos_cuenta_centro
CREATE UNIQUE INDEX saldos_cuenta_centro_pk ON saldos_cuenta_centro (id);  -- PK
CREATE UNIQUE INDEX saldos_cuenta_centro_uk ON saldos_cuenta_centro (compania_id, anio, periodo, cuenta_id, centro_costo_id);  -- UK
CREATE INDEX saldos_cuenta_centro_anual_idx ON saldos_cuenta_centro (compania_id, anio, centro_costo_id, cuenta_id);  -- auxiliar anual por centro

-- 28. acumulados_tercero
CREATE UNIQUE INDEX acumulados_tercero_pk ON acumulados_tercero (id);  -- PK
CREATE UNIQUE INDEX acumulados_tercero_uk ON acumulados_tercero (compania_id, anio, tercero_id, cuenta_id);  -- UK: acumulado anual por tercero/cuenta

-- 29. acumulados_centro
CREATE UNIQUE INDEX acumulados_centro_pk ON acumulados_centro (id);    -- PK
CREATE UNIQUE INDEX acumulados_centro_uk ON acumulados_centro (compania_id, anio, centro_costo_id, cuenta_id);  -- UK: acumulado anual por centro/cuenta

-- 30. acumulados_retencion
CREATE UNIQUE INDEX acumulados_retencion_pk ON acumulados_retencion (id);  -- PK
CREATE UNIQUE INDEX acumulados_retencion_uk ON acumulados_retencion (compania_id, anio, periodo, tercero_id, concepto_retencion_id);  -- UK

-- 31. acumulados_iva
CREATE UNIQUE INDEX acumulados_iva_pk ON acumulados_iva (id);          -- PK
CREATE UNIQUE INDEX acumulados_iva_uk ON acumulados_iva (compania_id, anio, periodo, tercero_id, tarifa_iva_id);  -- UK

-- 32. estado_acumulaciones
CREATE UNIQUE INDEX estado_acumulaciones_pk ON estado_acumulaciones (id);  -- PK
CREATE UNIQUE INDEX estado_acumulaciones_uk ON estado_acumulaciones (compania_id, anio, tipo);  -- UK: último período por tipo

-- =====================================================================
-- MÓDULO 5 — IMPUESTOS (medios magnéticos): entidades 33–39
-- =====================================================================

-- 33. formatos_exogenos
CREATE UNIQUE INDEX formatos_exogenos_pk ON formatos_exogenos (id);    -- PK
CREATE UNIQUE INDEX formatos_exogenos_codigo_uk ON formatos_exogenos (compania_id, codigo, vigencia);  -- UK: formato por código y año de vigencia

-- 34. formato_conceptos
CREATE UNIQUE INDEX formato_conceptos_pk ON formato_conceptos (id);    -- PK
-- Detalle puro: acceso por formato_id (cabecera); sin UK adicional en PostgreSQL.

-- 35. formato_asignaciones
CREATE UNIQUE INDEX formato_asignaciones_pk ON formato_asignaciones (id);  -- PK
CREATE UNIQUE INDEX formato_asignaciones_uk ON formato_asignaciones (formato_id, cuenta_id);  -- UK: cuenta asignada una vez por formato

-- 36. generaciones_medios
CREATE UNIQUE INDEX generaciones_medios_pk ON generaciones_medios (id);  -- PK
CREATE UNIQUE INDEX generaciones_medios_uk ON generaciones_medios (compania_id, anio, numero_generacion);  -- UK: número de generación por compañía/año

-- 37. medio_filas
CREATE UNIQUE INDEX medio_filas_pk ON medio_filas (id);                -- PK
CREATE INDEX medio_filas_generacion_idx ON medio_filas (generacion_id);  -- filas de una generación (revisión)
CREATE INDEX medio_filas_tercero_idx ON medio_filas (tercero_id);      -- depuración por tercero
CREATE INDEX medio_filas_formato_idx ON medio_filas (formato_id);      -- depuración por formato

-- 38. medio_topes
CREATE UNIQUE INDEX medio_topes_pk ON medio_topes (id);                -- PK
CREATE UNIQUE INDEX medio_topes_uk ON medio_topes (compania_id, anio, formato_id, concepto_id);  -- UK: un tope por formato/concepto/año
-- OJO: concepto_id es anulable (tope para todo el formato): verificar
-- semántica de NULL del índice único en Data Architect.

-- 39. medio_conciliaciones
CREATE UNIQUE INDEX medio_conciliaciones_pk ON medio_conciliaciones (id);  -- PK
CREATE UNIQUE INDEX medio_conciliaciones_uk ON medio_conciliaciones (generacion_id);  -- UK: una conciliación por generación

-- =====================================================================
-- MÓDULO 6 — PROCESOS: entidades 40–44
-- =====================================================================

-- 40. procesos
CREATE UNIQUE INDEX procesos_pk ON procesos (id);                      -- PK
CREATE INDEX procesos_compania_anio_idx ON procesos (compania_id, anio);  -- procesos por empresa/año

-- 41. cierres
CREATE UNIQUE INDEX cierres_pk ON cierres (id);                        -- PK
CREATE INDEX cierres_compania_anio_idx ON cierres (compania_id, anio); -- cierres por empresa/año

-- 42. cierre_traslados
CREATE UNIQUE INDEX cierre_traslados_pk ON cierre_traslados (id);      -- PK
-- Detalle puro: acceso por cierre_id (cabecera); sin UK adicional en PostgreSQL.

-- 43. consolidaciones
CREATE UNIQUE INDEX consolidaciones_pk ON consolidaciones (id);        -- PK
CREATE INDEX consolidaciones_destino_anio_idx ON consolidaciones (compania_destino_id, anio);  -- consolidaciones de un destino

-- 44. consolidacion_origenes
CREATE UNIQUE INDEX consolidacion_origenes_pk ON consolidacion_origenes (id);  -- PK
CREATE UNIQUE INDEX consolidacion_origenes_uk ON consolidacion_origenes (consolidacion_id, compania_origen_id);  -- UK: origen no repetido en una consolidación

-- =====================================================================
-- MÓDULO 7 — SEGURIDAD: entidades 45–51
-- =====================================================================

-- 45. roles
CREATE UNIQUE INDEX roles_pk ON roles (id);                            -- PK
CREATE UNIQUE INDEX roles_codigo_uk ON roles (codigo);                 -- UK: código de rol único

-- 46. permisos
CREATE UNIQUE INDEX permisos_pk ON permisos (id);                      -- PK
CREATE UNIQUE INDEX permisos_codigo_uk ON permisos (codigo);           -- UK: código de permiso único

-- 47. rol_permisos
-- Sin columna id en PostgreSQL ni en el modelo: el índice único es la PK
-- real del catálogo intermedio (equivalente al UNIQUE (rol_id, permiso_id)).
CREATE UNIQUE INDEX rol_permisos_uk ON rol_permisos (rol_id, permiso_id);  -- UK/PK: permiso asignado una vez por rol

-- 48. usuarios
CREATE UNIQUE INDEX usuarios_pk ON usuarios (id);                      -- PK
CREATE UNIQUE INDEX usuarios_email_uk ON usuarios (email);             -- UK: correo único
-- OJO: email es opcional (NULL). Si Data Architect no admite varios NULL en
-- el índice único, el servicio guarda '' para usuarios sin correo.

-- 49. auditoria (bitácora append-only)
CREATE UNIQUE INDEX auditoria_pk ON auditoria (id);                    -- PK
CREATE INDEX auditoria_usuario_idx ON auditoria (usuario_id);          -- historial por usuario
CREATE INDEX auditoria_modulo_idx ON auditoria (modulo);               -- historial por módulo
CREATE INDEX auditoria_creado_en_idx ON auditoria (creado_en);         -- eventos recientes: el recorrido inverso (DESC) es nativo de ADS, no requiere índice descendente
CREATE INDEX auditoria_compania_anio_idx ON auditoria (compania_id, anio);  -- filtros por empresa/año

-- 50. integraciones
CREATE UNIQUE INDEX integraciones_pk ON integraciones (id);            -- PK
CREATE UNIQUE INDEX integraciones_uk ON integraciones (compania_id, modulo);  -- UK: un estado por módulo/empresa

-- 51. usuario_companias
CREATE UNIQUE INDEX usuario_companias_pk ON usuario_companias (id);    -- PK
CREATE UNIQUE INDEX usuario_companias_uk ON usuario_companias (usuario_id, compania_id);  -- UK: acceso único usuario/empresa (B14)

-- =====================================================================
-- MÓDULO 8 — PRESUPUESTO: entidades 52–54
-- =====================================================================

-- 52. presupuestos
CREATE UNIQUE INDEX presupuestos_pk ON presupuestos (id);              -- PK
CREATE UNIQUE INDEX presupuestos_uk ON presupuestos (compania_id, anio, nombre);  -- UK: nombre único por compañía/año

-- 53. presupuesto_rubros
CREATE UNIQUE INDEX presupuesto_rubros_pk ON presupuesto_rubros (id);  -- PK
CREATE UNIQUE INDEX presupuesto_rubros_uk ON presupuesto_rubros (presupuesto_id, codigo, centro_costo_id);  -- UK: código único por presupuesto/centro
CREATE INDEX presupuesto_rubros_padre_idx ON presupuesto_rubros (presupuesto_id, parent_id);  -- recorrido jerárquico de rubros
-- OJO: centro_costo_id es anulable: verificar semántica de NULL del índice
-- único en Data Architect.

-- 54. presupuesto_valores
CREATE UNIQUE INDEX presupuesto_valores_pk ON presupuesto_valores (id);  -- PK
CREATE UNIQUE INDEX presupuesto_valores_uk ON presupuesto_valores (rubro_id, periodo, tipo);  -- UK: un valor por rubro/período/tipo

-- =====================================================================
-- MÓDULO 9 — AMPLIACIONES: entidades 55–60
-- =====================================================================

-- 55. tercero_cuentas_bancarias
CREATE UNIQUE INDEX tercero_cuentas_bancarias_pk ON tercero_cuentas_bancarias (id);  -- PK
-- Sin UK en PostgreSQL: un tercero puede tener varias cuentas; si el negocio
-- exige una sola cuenta principal por tercero, validarlo en el servicio.

-- 56. reembolsos
CREATE UNIQUE INDEX reembolsos_pk ON reembolsos (id);                  -- PK
-- Sin UK declarada en PostgreSQL (numero es texto sin secuencia): la
-- unicidad del número la controla el servicio al generar el reembolso.

-- 57. reembolso_lineas
CREATE UNIQUE INDEX reembolso_lineas_pk ON reembolso_lineas (id);      -- PK
-- Detalle puro: acceso por reembolso_id (cabecera); sin UK adicional en
-- PostgreSQL (la numeración de línea la controla el servicio).

-- 58. activos
CREATE UNIQUE INDEX activos_pk ON activos (id);                        -- PK
CREATE UNIQUE INDEX activos_codigo_uk ON activos (compania_id, codigo);  -- UK: código de activo único por compañía

-- 59. activo_cuotas
CREATE UNIQUE INDEX activo_cuotas_pk ON activo_cuotas (id);            -- PK
CREATE UNIQUE INDEX activo_cuotas_uk ON activo_cuotas (activo_id, anio, periodo);  -- UK: una cuota por activo/período

-- 60. activo_distribuciones
CREATE UNIQUE INDEX activo_distribuciones_pk ON activo_distribuciones (id);  -- PK
CREATE UNIQUE INDEX activo_distribuciones_uk ON activo_distribuciones (activo_id, centro_costo_id);  -- UK: distribución única por centro

-- =====================================================================
-- NOTAS OPERATIVAS DEL DICCIONARIO ADVANTAGE
-- =====================================================================
-- 1) Búsqueda textual por nombre (cuentas.nombre, terceros.nombre): el
--    índice pg_trgm de PostgreSQL NO existe en ADS (el LIKE con comodín
--    inicial no usa índices y no hay trigramas). Alternativas: búsqueda en
--    el servicio (carga de catálogos en memoria o tabla auxiliar de
--    búsqueda) o, si la versión de Data Architect lo permite, un índice de
--    expresión que normalice (p. ej. UPPER(nombre)) para igualdad/case-
--    insensitive; el prefijo LIKE '5105%' sí puede aprovechar el índice
--    normal de cuentas.codigo.
-- 2) Índices únicos con columnas anulables (usuarios.email, lotes.origen_
--    referencia, presupuesto_rubros.centro_costo_id, medio_topes.
--    concepto_id, documentos.documento_estado con documento NULL o con
--    origen = 'Migracion'): validar
--    con Data Architect si el motor acepta varios NULL; de lo contrario el
--    servicio debe usar '' (vacío) como valor centinela.
-- 3) La UK parcial "documento Contabilizado único" (excluida la historia
--    migrada, origen = 'Migracion') y el filtro de clase fiscal se tradujeron
--    según mapeo_motores §3 (columna derivada /
--    índice completo); las alternativas documentadas en los comentarios de
--    las tablas 23 y 24 requieren que el servicio (o el trigger del
--    diccionario) mantenga documento_estado y, si se adopta, clase_fiscal.
-- 4) Recomputar estadísticas del diccionario tras cargas masivas (medios
--    magnéticos, consolidaciones) y mantener el diccionario compactado
--    (pack) en tablas calientes: consecutivos_comprobantes, saldos_*,
--    documento_lineas.
-- 5) Los índices se crean después de las tablas; en Data Architect los
--    UNIQUE INDEX se ven como "unique" y pueden marcarse como candidate
--    key / primary key del diccionario según la convención del despliegue.
-- =====================================================================
