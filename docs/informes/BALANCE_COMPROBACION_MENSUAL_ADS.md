# Balance de comprobación mensual (opción 3 > 2)

## Referencia original

`C:\Xedit4\CONTABDSI\Source\CONTABDSI.PRG` llama `INFOR02(2)`.
El formulario `INFOR2` está en `Resource\VISION.RC`; los cálculos y la
impresión están en `Source\CONINFOR.PRG` (`MOVMENSU`, `INFOR21`, `INFOR21A`,
`INFOR21B`) y el saldo anterior se calcula con `CONSALDO` de
`Source\CONSULTA.PRG`.

## Filtros

- Mes desde / hasta: 1 a 18. Por defecto se usa el mes operativo.
- Nivel: cuenta (4), subcuenta (6), auxiliar 1 (9), auxiliar 2 (12).
- Incluir estado de resultados, cuentas en cero y terceros.
- Incluir centros de costo: el original lo pregunta después de aceptar el
  formulario; la interfaz nueva lo incluye en el mismo formulario.
- La elección de impresora WIN/DOS/disco/Excel se sustituye por la vista
  previa y los botones de impresión, PDF y XLSX del proyecto nuevo.
- No se pide año: se toma el ejercicio operativo de CONCTR.

## Cálculo y fuentes

La cuenta maestra sale de CONMAE. Los detalles por tercero proceden de
CONTERCE y los de centro de costo de COCENTRO. Los meses 13-18, que no
existen como columnas en el CONMAE actual, se reconstruyen desde MOV01.

`MOVMENSU` suma débitos positivos y créditos almacenados negativos solo
entre los meses elegidos. En el mensual, la columna **Saldo actual** muestra
el neto del rango para cada cuenta normal (aplicando el signo de las clases
2, 3 y 4). El saldo anterior no se imprime. Las excepciones del código
original son la raíz de patrimonio y los renglones de resultado del
ejercicio, que conservan el resultado acumulado incorporado al patrimonio.
Si se desactiva el estado de resultados, las clases 4, 5 y 6 todavía
contribuyen al resultado en segundo plano, como hace `INFOR21A`.

La impresión PDF conserva las dos secciones (estado de resultados y balance),
el salto de página entre ellas y el corte después del total de activo, las
columnas Código/NIT/Cuenta/Débitos/Créditos/Saldo actual, subtotales de clase
y renglones de resultado. El PDF y XLSX adoptan el diseño visual del balance
acumulado (títulos, colores, tabla, resaltados y pie de página). El XLSX
mantiene la columna «Saldo anterior» vacía, tal como la salida Excel original.
