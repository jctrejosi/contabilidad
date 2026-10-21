# Cambio en escritor real: compactación de asignaciones

Se conserva CASE de hasta1000 como mejor método medido. Cursor experimental
fue0.5638s CASE frente892.1428s cursor/1000; no se activa cursor en reproceso.

Cada columna de cada bloque ahora elige expresión equivalente más corta:
1. Todos reciben mismo literal monetario: SET campo=valor, sin CASE.
2. Valores repetidos: CASE WHEN ID IN(grupo) THEN importe, agrupado por literal
   redondeado, si y solo si acorta SQL respecto CASE ID original.
3. Valores únicos/poca repetición: se conserva CASE ID cuando sea más corto.

Exactamente mismos IDs y filtro CIA, importes y redondeo a dos decimales; mantiene
ELSE en expresiones CASE. Constante solo en bloque WHERE exacto, nunca UPDATE
general. No agrega SELECT, no cambia orden, tamaño, meses ni transacción.
Duplicados/obsoletos siguen usando valores finales cero calculados en plan.
Update existentes antes de INSERT nuevos permanece. No se elimina auditoría.

Beneficio demostrable local: menos caracteres y condiciones redundantes, nunca
expresión más larga que original. No se acredita todavía menor tiempo en el
motor real: elegir más corta no garantiza plan más rápido. No se promete tiempo
concreto. Casos sin repetición retienen método anterior. Sintaxis CASE WHEN/IN
se valida en integración real del proveedor; errores mantienen rollback global.

Log adicional por bloque: SQL compacto debito/credito modo, caracteres y ahorro
contra expresión anterior. No expone importes ni NIT. Permite medir si hay
repetición útil en la carga real; no realizar otra batería previa de benchmarks.

Compilar/instalar detenido. Base de pruebas respaldada sin otros escritores.
Ejecutar normalmente un mes pendiente (julio si solo se realizaron pruebas con
rollback). Conservar tiempos por etapas y muestra de SQL compacto, inicio/final
de bloques. No limpiar saldos ni repetir un mes corregido como prueba de carga.
Verificar acumulados y que repetición sin cambios posteriores devuelva Sin
cambios. Conservar reversión y no confirmar por bloques para ganar rendimiento.

Pruebas: constante cero, valores repetidos con signo, CASE original cuando gana,
50 conjuntos aleatorios contra asignación previa porID, longitud no mayor,
filtro CIA/IDs, última fracción y rechazo de IDs repetidos. No se realizaron
escrituras reales desde desarrollo ni se cambió esquema/índices.
