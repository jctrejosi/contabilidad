# Modelo lógico neutro — Índices (02)

Estrategia de indexación **declarativa** (sin sintaxis de motor). Cada índice
está justificado por un patrón de consulta real. La implementación PostgreSQL
está en [`../postgresql/schema/10_indices.sql`](../postgresql/schema/10_indices.sql);
los motores que no soporten índices parciales/funcionales deben emular la misma
garantía con un diseño equivalente (ver nota en cada caso).

Convenciones: **Orden** = secuencia de columnas · **Tipo** = Único / No único /
Único parcial (solo sobre un subconjunto de filas).

## 1. Búsqueda textual en maestros

| Tabla | Columnas | Tipo | Propósito |
|---|---|---|---|
| cuentas | nombre (trigramas/subcadenas) | No único | Búsqueda difusa del plan de cuentas |
| terceros | nombre (trigramas/subcadenas) | No único | Búsqueda rápida de terceros |

## 2. Movimientos

| Tabla | Columnas | Tipo | Propósito |
|---|---|---|---|
| lotes | compania_id, anio, estado | No único | Listado de lotes por estado |
| lotes | compania_id, anio, periodo | No único | Movimiento mensual, cierres |
| lotes | usuario_id | No único | "Mis lotes" / reasignación |
| lotes | compania_id, anio, documento | No único | Detección de duplicados entre lotes |
| lote_lineas | cuenta_id | No único | Validación/edición por cuenta |
| lote_lineas | tercero_id | No único | Validación/edición por tercero |
| lote_lineas | centro_costo_id | No único | Validación/edición por centro |
| lote_validaciones | lote_id, severidad | No único | Issues por severidad |
| documentos | compania_id, anio, periodo, fecha | No único | Libro por período |
| documentos | compania_id, anio, estado | No único | Por estado |
| documentos | tercero_id | No único | Auxiliar por NIT |
| documentos | lote_id | No único | Trazabilidad lote→documento |
| documentos | compania_id, anio, documento donde estado=Contabilizado | Único parcial | Un documento solo puede estar contabilizado una vez |
| documento_lineas | cuenta_id | No único | Auxiliares/regeneración |
| documento_lineas | tercero_id | No único | Auxiliar por tercero |
| documento_lineas | centro_costo_id | No único | Auxiliar por centro |
| documento_lineas | documento_afectado | No único | "Documento específico" |
| documento_lineas | clase, cuenta_id donde clase ∈ {IVA, Retencion} | No único parcial | Regeneración de acumulados fiscales |

## 3. Saldos y acumulados (patrón anual sin período)

| Tabla | Columnas | Tipo | Propósito |
|---|---|---|---|
| saldos_cuenta | compania_id, anio, cuenta_id | No único | Balance anual por cuenta |
| saldos_cuenta_tercero | compania_id, anio, tercero_id, cuenta_id | No único | Auxiliar anual por tercero |
| saldos_cuenta_centro | compania_id, anio, centro_costo_id, cuenta_id | No único | Auxiliar anual por centro |

## 4. Medios magnéticos

| Tabla | Columnas | Tipo | Propósito |
|---|---|---|---|
| medio_filas | generacion_id | No único | Filas de una generación |
| medio_filas | tercero_id | No único | Depuración por tercero |
| medio_filas | formato_id | No único | Depuración por formato |

## 5. Bitácora

| Tabla | Columnas | Tipo | Propósito |
|---|---|---|---|
| auditoria | usuario_id | No único | Historial por usuario |
| auditoria | modulo | No único | Historial por módulo |
| auditoria | creado_en (desc) | No único | Eventos recientes |
| auditoria | compania_id, anio | No único | Filtros por empresa/año |

## 6. Procesos, cierres y consolidaciones

| Tabla | Columnas | Tipo | Propósito |
|---|---|---|---|
| procesos | compania_id, anio | No único | Procesos por empresa/año |
| cierres | compania_id, anio | No único | Cierres por empresa/año |
| consolidaciones | compania_destino_id, anio | No único | Consolidaciones de un destino |

## 7. Presupuesto

| Tabla | Columnas | Tipo | Propósito |
|---|---|---|---|
| presupuesto_rubros | presupuesto_id, parent_id | No único | Recorrido jerárquico de rubros |

## Notas operativas (independientes del motor)

1. **Recomputar estadísticas** tras cargas masivas (exógena, consolidaciones).
2. **Mantenimiento agresivo** en tablas calientes: saldos, consecutivos, líneas.
3. **Particionar por anio** cuando el histórico crezca: documentos,
   documento_lineas, saldos_*, auditoria.
4. **Índices parciales** sobre subconjuntos mantienen tamaño bajo y escritura rápida.
5. **consecutivos_comprobantes** es la fila más caliente: llenado reducido,
   bloqueo de fila corto, sin índices adicionales.
