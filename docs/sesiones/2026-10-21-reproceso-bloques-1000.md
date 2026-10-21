# Actualización CONTERCE en bloques de 1000

Se cambia únicamente CONTERCE_UPDATE_CHUNK de 250 a 1000. Permanecen los
cálculos, comparación diferencial por fila física, inserción con importes,
limpieza de duplicados/obsoletos y transacción global. No hay commits por bloque
ni reintento silencioso si una sentencia falla. La última fracción también se
actualiza. No se cambian índices ni estructura del diccionario.

Evidencia del benchmark ampliado del usuario: 3000 filas por zona.
Inicio: CASE250 4,04s; CASE500 2,23s; CASE1000 1,51s.
Medio: CASE250 4,31s; CASE500 2,25s; CASE1000 1,50s.
Final: CASE250 4,21s; CASE500 2,34s; CASE1000 1,49s.
Todas las restauraciones verificadas. Ganancia ~64% solo en muestra de escritura,
no promesa para mes completo. El benchmark no reproduce una transacción con
cientos de miles de cambios ni toda la distribución de IDs real.

Validación adicional: 1001 cambios producen dos llamadas, 1000 + 1, conservan
signos y filtro CIA y no confirman por bloque. Compilar y desplegar detenido.
En base de pruebas usar período con diferencias conocidas; si ya coincide, Sin
cambios no mide esta mejora. No borrar datos para forzar diferencias. Conservar
escritura diferencial, duración de bloques, fin de transacción, tiempo total y
comparar resultados con copia equivalente del estado anterior. Si sigue lenta,
analizar distribución/carga transaccional antes de afirmar que el índice falla.
