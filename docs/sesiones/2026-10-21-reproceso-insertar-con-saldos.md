# Primera optimización funcional: auxiliares nuevos con saldos

Referencia: ejecución 6dd259ab4df7; 1.106.444 movimientos, 286.728 auxiliares
nuevos, 9.096,012 segundos total. Últimos bloques CASE de 250: unos 2,6 s.
No se deduce el tiempo completo de cada subetapa a partir de esos últimos bloques.

Para una clave nueva (CIA/cuenta/NIT), INSERT incluye los acumulados calculados
de los meses con movimiento dentro del rango. Los demás campos conservan sus
defaults. Conserva nombre, indicador de costos, signo de créditos y conversión
numérica anterior. No se consulta su ID ni se la incluye en CASE posterior.
Si existen auxiliares, mantienen limpieza, consolidación y UPDATE anteriores.
No se cambian tablas, índices, consultas de lectura ni transacción global.

Esto evita un SELECT por auxiliar nuevo y la reescritura posterior de esos
auxiliares. Aún hay un INSERT individual por nuevo auxiliar; no es carga masiva.
El avance de inserciones se registra cada 500 (bloques de diagnóstico, no COMMIT).
En caso de fallo se registra ordinal sin NIT y se propaga para rollback.

Pruebas locales: instrumentación, SQL/parametrización, valores con signo,
defaults de meses ausentes, exclusión de existentes, ausencia de SELECT/CASE
para nuevos, bloque de 501 y error sin reintento ni commit parcial.
No se ejecutó sobre la base del servidor remoto ni se acredita mejora medida.

Aceptación: recompilar/desplegar con servicios detenidos y transacción previa
finalizada. Como CONTERCE ya está poblada, repetir el mismo mes no mide esta
optimización: puede devolver Sin cambios. Para comparar primera construcción
usar otra copia/compañía de pruebas con auxiliares vacíos y mismo movimiento.
No borrar la compañía ya reconstruida. Comparar todos los acumulados por
CIA/cuenta/NIT/mes, conteo de auxiliares y totales, además de tiempo total.
La actualización de existentes por CASE sigue siendo el siguiente cuello por
medir y optimizar; no se adoptó una tabla staging sin validar motor/sintaxis.
