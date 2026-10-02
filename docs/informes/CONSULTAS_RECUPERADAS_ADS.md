# Consultas contables recuperadas — Advantage Data Server

La aplicación usa `CONTABDSI_STORE=ads` por defecto. Las consultas de este
documento leen las tablas reales de Advantage; los registros de demostración
del frontend no intervienen. El año de los acumulados se valida con `CONCTR`.

| Opción del menú | Función Harbour | Tablas leídas | Filtros y búsqueda |
| --- | --- | --- | --- |
| Saldos y comportamiento anual | `CONSUL_2`, `CONSUL_21` | `CONCTR`, `CONMAE`, `CONTERCE`, `MOV01` (periodos 13–18) | Compañía, año, período 1–18, clasificación general/todos/retenciones/IVA, código o nombre de cuenta, página. |
| Movimiento anual por cuenta | `CONSUL_3`, `CONSUL_31` | `CONCTR`, `CONMAE`, `CONTERCE`, `MOV01` | Compañía, año, cuenta buscada por código o nombre, NIT inicial/final, mes de detalle, página. |
| Movimiento anual por tercero | `CONSUL_4`, `CONSUL_41` | `CONCTR`, `FADCLI`, `CONTERCE`, `CONMAE`, `MOV01` | Compañía, año, tercero buscado por identificación o nombre, cuenta inicial/final, mes de detalle, página. |
| Movimiento anual por centro de costo | `CONSUL_5`, `CONSUL_51` | `CONCTR`, `CONCECOS`, `COCENTRO`, `CONMAE`, `MOV01` | Compañía, año, centro, cuenta inicial/final, mes de detalle, página. |
| Saldos cuenta / centro de costos | `CONSUL_7` | `CONCTR`, `CONMAE`, `COCENTRO`, `CONCECOS`, `MOV01` | Compañía, año, período 1–18, cuenta por código o nombre, selección de cuenta y centro, página. |
| Documento específico | `CONSUL_8`, `CONSUL_81` | `VISDOCUM`, `MOV01`, `CONMAE` | Compañía, año, período 1–18, tipo y número de documento, documento propio (`TDOCUM`) o afectado (`TDOCUM2`). |
| Comparativos | `CONSULCO`, `CONSULCO2`, `CONSULME` | `CONEMP`, `CONMAE`, `CONTERCE`, `COCENTRO`, `CONCECOS`, `MOV01` | Compañías o meses, saldo/movimiento, rangos de cuenta/NIT/centro, búsqueda por código o nombre y página. |

`MOV01` reúne los períodos que en la aplicación original estaban repartidos
entre `MOV01` y `MOV12`. `CONTERCE` almacena el desglose de terceros que antes
estaba integrado en `CONMAE`. Los importes de crédito heredados son negativos
en la fuente; se muestran positivos en las columnas de crédito y se suman con
su signo para calcular el saldo.

Las pantallas no consultan resultados al ingresar: exigen aplicar los filtros
y pulsar **Consultar**. Los maestros de cuentas, terceros, centros, compañías y
tipos de documento se cargan desde sus respectivos endpoints, nunca desde
arreglos de datos de ejemplo.

Estas rutas nuevas leen Advantage directamente. Si se activa
`CONTABDSI_STORE=postgres`, deben homologarse explícitamente con
`saldos_cuenta`, `saldos_cuenta_tercero`, `saldos_cuenta_centro` y
`documento_lineas`; no debe suponerse equivalencia automática por compartir
la misma interfaz.
