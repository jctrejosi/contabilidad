# Validación de los hallazgos del plan de migración contra el esquema

Fecha: 2 de septiembre de 2026.
Fuente revisada: `db/old_db/` (PLAN_MIGRACION_POSTGRESQL.md, MATRIZ_TABLAS_Y_BRECHAS.md,
MATRIZ_PROCESOS_Y_OPCIONES.md, HOMOLOGACION_CAMPOS.md, COMPROBACIONES_ESTATICAS.md,
ESQUEMA_DEPURADO_CONTABDSI.md, EXCLUSIONES_CONTABDSI.md, TRAZABILIDAD_FUNCIONES_Y_BOTONES.md,
VALIDACION_MIGRACION_CONTABDSI.json).

Veredicto por hallazgo (B01–B15) contra el esquema actual de `contabilidad/db`:

| ID | Hallazgo | Veredicto | Acción tomada en el esquema |
|---|---|---|---|
| B01 | Un lote puede producir varios documentos; el destino lo aplana | **CONFIRMADO — CORREGIDO** | `contabilizar_lote()` ahora agrupa las líneas por (comprobante, documento, fecha) y crea un documento por grupo con balance validado por documento. Prueba T01 en `validate.sql` (lote T2 → 2 documentos). |
| B02 | La anulación deja libro y saldos inconsistentes | **CONFIRMADO — CORREGIDO** | `anular_documento()` ahora reversa los saldos (`saldos_cuenta*`) con el efecto invertido; `regenerar_acumulados()` incluye originales anulados **y** sus reversiones → efecto neto cero. Prueba T09 (saldos netos cero + acumulados cero tras anular). |
| B03 | IVA/retenciones sin regeneración funcional | **CONFIRMADO — CORREGIDO** | Columnas `concepto_retencion_id` y `tarifa_iva_id` por renglón (históricas); `regenerar_acumulados()` implementa los casos `Retencion` e `Iva`; la validación exige concepto/tarifa explícitos en líneas fiscales; el estado se marca solo tras éxito. |
| B04 | El libro carece de dimensiones del movimiento original | **CONFIRMADO — CORREGIDO (parcial)** | `documento_lineas`/`lote_lineas` ahora incluyen `tipo_documento_id`, `fecha_documento` (TFECDOC), `valor_moneda` (TVALORUS), `nit_alterno` (NITN), `archivo_origen` (TARCHI). Pendiente: transformación TVALOR→débito/crédito y mapeo fino de 2.257 campos en HOMOLOGACION_CAMPOS. |
| B05 | Aislamiento por compañía/año incompleto | **CONFIRMADO — CORREGIDO** | FK compuestas `(compania_id, id)` en cuentas/terceros/centros/comprobantes/tipos/conceptos/tarifas, aplicadas a líneas, saldos y acumulados; `lotes` con FK a `periodos_contables` (período inexistente rechazado por la base); `documentos` con FK compuestas. Prueba T04 pendiente de ejecutar con datos de dos compañías (semilla con 2ª empresa). |
| B06 | El libro no queda protegido por el esquema | **CONFIRMADO — CORREGIDO (parcial)** | `CHECK (debito=0 OR credito=0)` en `documento_lineas`; eliminado el borrado en cascada del libro; `validar_lote()` rechaza lotes vacíos, sólo revalida estados editables y no degrada un lote Aprobado. Pendiente (capa de servicio): prohibir DML libre y exigir aprobación vinculada a la versión exacta de líneas. |
| B07 | Idempotencia y pruebas insuficientes | **CONFIRMADO — CORREGIDO** | Nueva `lotes.origen_referencia` con UNIQUE parcial (reimportar el mismo origen no duplica); prueba de idempotencia reescrita para verificar por **efecto** (conteo de documentos), sin falso positivo; conciliación libro vs saldos por cuenta. |
| B08 | Error estructural en auditoría de generaciones fiscales | **CONFIRMADO — CORREGIDO** | `generaciones_medios` ahora declara `actualizado_en` (el trigger era inválido) y separa `numero_generacion` (identidad por compañía/año) de `version` (control optimista). |
| B09 | Parámetros, nómina y plantillas incompletos | **CONFIRMADO — CORREGIDO (parcial)** | `parametros_operacion` ampliado (fecha_operativa/CTFCHOY, observacion/CTTOBS, documento/CTDOCUM, leyenda2/CTLEY2); nueva `parametros_nomina` (CTCOMNOM1..3, CTDOCNOM1..3); `plantilla_lineas` reestructurada a **parejas de cuentas** (cuenta_debito/cuenta_credito) como el legado. Pendiente: decidir regla de `modo_retencion` (MCR no se persiste en el legado). |
| B10 | Faltan activos, amortizaciones, bancos y reembolsos | **CONFIRMADO — CORREGIDO (estructura)** | Nuevas tablas: `tercero_cuentas_bancarias`, `reembolsos`+`reembolso_lineas`, `activos`+`activo_cuotas`+`activo_distribuciones` (postgresql/schema/11). Pendiente: verificar estructura física de CONREMAE/CONREITE antes de fijar tipos. |
| B11 | Terceros y catálogos perderían información | **CONFIRMADO — CORREGIDO (parcial)** | `terceros` ampliado con `correo` y `codigo_legado`. Pendiente: catálogos CIUDAD/ACTIVIDA/VISTDOC y datos comerciales/fiscales completos (integración o réplica) — fase 2 del plan. |
| B12 | Exógena e informes no se reducen a una tabla de resultados | **CONFIRMADO — CORREGIDO (parcial)** | `formatos_exogenos` con unicidad `(compania, codigo, vigencia)`. Pendiente: reglas CONMAG3 (rangos/condiciones/fuentes), VALOR1..11 de CONMAGDT, CONMAGIT por documento y definiciones CONINF1 del generador. |
| B13 | Presupuesto y cierres necesitan más que cabeceras | **CONFIRMADO — CORREGIDO (parcial)** | `presupuesto_rubros` con `nombre`/`concepto` y UNIQUE `(presupuesto, codigo, centro)`; `presupuesto_valores` con períodos 00–13 y tipo Presupuesto/Ejecucion. Pendiente: algoritmos de cierre/consolidación/reprocesos (tablas existen, funciones no). |
| B14 | Seguridad y auditoría no equivalen a guardar un usuario | **CONFIRMADO — CORREGIDO (parcial)** | `auditoria.usuario_id`, `lotes.usuario_id`, `documentos.usuario_id` ahora `bigint` con FK a `usuarios`; nueva `usuario_companias`. Pendiente: autenticación/RLS real, inmutabilidad de bitácora y pruebas de aislamiento (fase de servicios). |
| B15 | El instalador de demostración no es un migrador | **CONFIRMADO — ASUMIDO COMO CORRECTO** | `postgresql/scripts/up.sh` es un bootstrap de demostración con `dropdb`; está documentado que NUNCA debe apuntar a producción. El migrador real (fases 5-9 del plan) es una unidad de trabajo separada. |

## Resultado de la re-validación ejecutada

`postgresql/scripts/up.sh` carga el esquema (12 archivos) y ejecuta **11 pruebas** que pasan:

1. NOM2 cuadrado con 2 errores iniciales.
2. Corrección → Verificado.
3. Contabilización atómica → CE-000245 / NOM-2026-02.
4. Idempotencia verificada por efecto (sin falso positivo).
5. Acumulados de retención/IVA/terceros regenerados (retención $1.200.000).
6. Libro y saldos coinciden **por cuenta**.
7. **T01**: lote multidocumento → 2 documentos (CE y RC, consecutivos distintos).
8. **T02**: lote globalmente cuadrado pero con documento descuadrado → rechazado.
9. Lote vacío rechazado.
10. **T09**: anulación consistente (saldos netos cero, reversión enlazada).
11. La base impide borrar una cuenta con hijas.

## Pendientes que requieren decisión de negocio (no se pueden "inventar" en el esquema)

- Homologación campo a campo (2.257 campos) con perfilado de datos reales.
- `modo_retencion` (MCR): el legado lo inicializa pero no lo persiste.
- Estructura física de CONREMAE/CONREITE.
- Reglas de exógena CONMAG3/CONMAGDT y definiciones de informes CONINF1.
- Algoritmos de cierres, traslados 13-18, consolidación y reprocesos.
- Autenticación, RLS y asignación usuario-compañía.
- Migrador versionado (staging, equivalencias, rechazos) — separado del bootstrap demo.
- Estructuras de migración (`migracion_ejecuciones`, `migracion_archivos`, …) del diseño destino.

Con estas correcciones el esquema queda listo como base de las fases 3-4 del plan
(corregir bloqueos en entorno aislado y ensayar el motor); el NO-GO productivo se
mantiene hasta cerrar la homologación funcional y ejecutar las pruebas con datos reales.
