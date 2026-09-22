# Movimiento mensual conectado a MOV01

La opción **Consultas > Movimiento mensual** trabaja bajo demanda. Entrar a la
pantalla no abre ni recorre MOV01: la primera solicitud se produce únicamente
cuando el usuario selecciona el período y pulsa **Consultar**.

## Correspondencia contable

| Dato en pantalla | Campo MOV01 | Uso |
|---|---|---|
| Compañía | `CONCIA` | Aísla la contabilidad seleccionada al ingresar. |
| Año y mes | `CONANO`, `CONMES` | Delimita el período contable. |
| Cuenta | `CODIGO` | Cuenta afectada por el asiento. |
| Tercero | `NITN` y, como respaldo, `NIT` | Identificación asociada al movimiento. |
| Fecha | `TFECHA` | Fecha contable en formato heredado AAAAMMDD. |
| Comprobante | `TCOMPR` | Agrupa el asiento dentro del comprobante contable. |
| Centro de costo | `TFASE` | Centro al que se imputa el movimiento. |
| Tipo y número documental | `TIPODOC`, `TDOCUM` | Soporte del asiento. |
| Concepto | `TDETALLE` | Explicación registrada para el movimiento. |
| Débito / crédito | `TVALOR` | Positivo = débito; negativo = crédito. |
| Base fiscal | `TBASE` | Base gravable o de retención. |

## Rendimiento y seguridad funcional

- La compañía y el período son filtros obligatorios ejecutados en ADS.
- Los filtros adicionales también se procesan en ADS, no en el navegador.
- Se entregan 100 filas por página y una fila de control para saber si existe
  página siguiente; no se ejecuta un conteo total sobre el archivo completo.
- Se conserva la secuencia física de MOV01. Forzar un ordenamiento global antes
  de paginar tarda más de 30 segundos en ADS y no cambia el valor contable.
- Los totales visibles corresponden a la página actual.
- Cambiar de compañía elimina los resultados anteriores sin lanzar una consulta.
