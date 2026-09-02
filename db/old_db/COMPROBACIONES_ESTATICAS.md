# Comprobaciones estáticas de esta entrega

Estas comprobaciones verifican consistencia del inventario y la presencia de hallazgos en los archivos. NO son pruebas ejecutadas en PostgreSQL, ni afirman que la aplicación funcione.

1. Confirmado: Las 98 tablas tienen clasificación/destino o tratamiento explícito.
2. Confirmado: Las clasificaciones de tablas suman el universo de 98.
3. Confirmado: Se inventarían 969 funciones con ubicación única.
4. Confirmado: Las 161 acciones de menú tienen proceso(s) candidato(s).
5. Confirmado: Todos los destinos declarados como existentes están en el DDL.
6. Confirmado: Todas las funciones de entrada de los procesos existen en el inventario.
7. Confirmado: Las fuentes/DDL mantienen las huellas de la revisión; no fueron modificadas por este análisis.
8. Confirmado: Hallazgo B08: generaciones_medios no declara actualizado_en.
9. Confirmado: Hallazgo B03: la regeneración no inserta en acumulados_retencion ni acumulados_iva.
10. Confirmado: Hallazgo B02: anular_documento no actualiza/insertar saldos_cuenta*.
11. Confirmado: Hallazgo B04: documento_lineas no declara tipo_documento_id ni fecha.
12. Confirmado: Hallazgo B13: presupuesto_rubros no declara nombre ni concepto.
13. Confirmado: El universo de campos tiene estado explícito.

Pruebas de motor, de datos y de cada proceso: pendientes según PLAN_MIGRACION_POSTGRESQL.md.
