# Documentación

Índice del árbol de `docs/`. Una línea por subcarpeta.

- `maestros/`: especificaciones de los maestros contables contra Advantage Data Server (plan de cuentas, terceros, centros de costo, comprobantes, tipos de documento) y la validación de maestros en captura directa.
- `movimientos/`: captura y consulta de movimientos (contabilización directa, lotes, importaciones hacia lotes, consulta de documentos, movimiento mensual).
- `informes/`: informes y consultas recuperadas de ADS (balance de comprobación acumulado, consultas contables, informes adicionales, navegación de informes).
- `procesos/`: procesos periódicos del motor contable (reproceso mensual).
- `catalogo/`: inventario del aplicativo y fuente de conocimiento del asistente (mapa funcional control por control).
- `sesiones/`: bitácoras de sesión de trabajo, una por fecha.
- `auditorias/`: auditorías con hallazgos clasificados por severidad; base del plan de trabajo por dependencia (auditoría de funcionalidad).
  - `auditorias/VALIDACION_ASISTENTE.md`: validación del asistente contra `POST /chat` con las ocho herramientas de la ola 1 (fase 0), en las bases de demostración y migrada.
- `plan/`: los dos planes del proyecto, separados, con su índice en `plan/README.md`.
  - `plan/backend/`: plan de implementación de la funcionalidad que falta, con el inventario de endpoints nuevos por bloque, el orden por dependencia y el detalle de contrato por módulo.
  - `plan/bot/`: plan del asistente (Daisy), con sus fases, su fuente de conocimiento y las herramientas priorizadas.
