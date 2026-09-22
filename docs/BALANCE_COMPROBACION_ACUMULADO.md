# Balance de comprobación acumulado: equivalencia funcional

Referencia: `C:\Xedit4\CONTABDSI\Source\CONINFOR.PRG` (`INFOR02(1)`,
`INFOR21`, `INFOR21A`, `INFOR21B`, `MOVMENSU`, `INCLU_CC`) y
`C:\Xedit4\CONTABDSI\Source\CONSULTA.PRG` (`CONSALDO`).

| Función original | Comportamiento trasladado |
| --- | --- |
| `INFOR02(1)` | Pide mes inicial/final 01–18, nivel Cuenta/Subcuenta/Auxiliar 1/Auxiliar 2, estado de resultados, saldos en cero y terceros. Los valores iniciales son Cuenta, resultados sí, ceros no, terceros no. La antigua elección Win/DOS/Disco/Excel se sustituye por previsualización y exportación PDF/XLSX, según la decisión previa del proyecto. |
| `INFOR21` | Despacha el balance acumulado; la ruta nueva genera un solo resultado para pantalla, PDF y XLSX. |
| `CONSALDO` | Parte de `MSALDO` y suma débito más crédito con signo de todos los meses anteriores al mes inicial. |
| `MOVMENSU` | Suma débitos y créditos del rango seleccionado, incluidos sus extremos. El crédito almacenado es negativo, pero en el informe se presenta positivo. |
| `INFOR21A/B` | Imprime primero estado de resultados (clases 4–9) si se marca y después balance (clases 1–3). Si no se marca, calcula internamente el resultado con clases 4–6, pero no imprime la primera sección. Suma el resultado al renglón raíz de patrimonio, imprime resultado del ejercicio y los totales de clase, ingresos menos egresos y pasivo más patrimonio. Excluye las cuentas sin apertura ni movimiento cuando no se incluyen ceros. |
| `INCLU_CC` | Añade desglose por centro de costo a cada cuenta visible. El original lo pregunta después de aceptar el formulario; la web lo ofrece como casilla dentro del mismo formulario. |

En el esquema actual, la cuenta maestra está en `CONMAE`, los terceros en
`CONTERCE` y los centros en `COCENTRO`. `CONMAE`, `CONTERCE` y `COCENTRO`
solo tienen columnas acumuladas hasta el mes 12. Para meses 13–18 se
reconstruyen los movimientos desde `MOV01`, acumulándolos en la cuenta y sus
padres. Todos los datos quedan restringidos a la compañía activa.

El filtro opcional de rango de cuentas para el **detalle** es una protección
operativa adicional: algunas compañías tienen cientos de miles de auxiliares.
No filtra el balance general ni sus totales; solo acota el desglose de
terceros/centros. Si el desglose supera 10.000 filas se pide acotar ese rango.
