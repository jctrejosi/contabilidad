# 09 · Conciliación de `TSALDO` (etapa B)

Registro de la **etapa B** de [`08_plan_para_culminar.md`](08_plan_para_culminar.md),
medida sobre la copia de `ADD_CONTAB` (15 CSV, 9.134.136 filas) que quedó en
`db/migration/staging/`. Dos resultados: el saldo corrido del origen **no** se
puede reconstruir con el material disponible, y al comprobarlo apareció una
**discrepancia de carga** que conviene decidir antes de dar la etapa por cerrada.

Scripts reproducibles:

```bash
python db/migration/cargador/conciliar_tsaldo.py      # hipótesis del plan
python db/migration/cargador/reconciliar_cuentas.py   # CSV vs base, por cuenta
```

---

## 1. Qué se midió y qué salió

El plan proponía: recorrer el libro en **orden físico** (`_archivo`, `_loc`) por
cuenta, acumular `TVALOR` y comparar con `TSALDO`. Medido:

| Orden de acumulación | `saldo == acumulado` | `delta(saldo) == TVALOR` |
|---|---:|---:|
| físico `(_archivo, _loc)` | 0,1 % | 1,2 % |
| fecha `(TFECHA)` | 0,4 % | 1,4 % |
| fecha, comprobante, documento | 0,1 % | 1,2 % |

Restringido a las cuentas que **sí** mantienen saldo, sigue sin cuadrar
(1,1 % con fecha; 3,5 % por diferencias). El caso más claro: la cuenta
`240801005` tiene 400.076 renglones que suman **0,00** en `TVALOR`, mientras su
`TSALDO` va de **−105.672.326,31** a **+96.521.277,34**; sus variaciones entre
renglones consecutivos son de millones frente a movimientos de miles.

**Control de lectura.** La suma global de `TVALOR` da **−0,12**, exactamente la
diferencia que reporta la conciliación del cargador. Es decir: el CSV está bien
leído y el descuadre es real, no un artefacto de parseo.

**Alcance.** `TSALDO` trae valor en las 5.048.937 filas y distinto de cero en
**545.554** (10,81 %) —el número que anticipaba el plan—, pero solo **243 de
2.362** cuentas lo mantienen; **2.119** lo dejan siempre en cero. Y su magnitud
coincide con la de `saldos_cuenta` de la misma cuenta, así que **sí es un saldo
de cuenta**: lo que no se puede es reconstruirlo desde los movimientos.

## 2. Dónde estaría la definición (y por qué no se pudo conseguir)

Se buscó la semántica de `TSALDO` en todo el material disponible:

| Fuente | Resultado |
|---|---|
| `ADD_CONTAB/MOVICON.prg`, `MOVICONN.prg` (código CA-Clipper) | **No asignan `TSALDO`**; mantienen el saldo en `CONMAE.MSALDO` (`+WDEB`/`+WCRE`) |
| `ADD_CONTAB/PUBLIDATA.add` (diccionario) | Solo declara el campo (`DOUBLE`, 8,2); sin descripción |
| `db/old_db/ESQUEMA_DEPURADO_CONTABDSI.json` | `"description": "significado o dominio específico no documentado campo a campo en esta revisión"` |
| `db/old_db/HOMOLOGACION_CAMPOS.md` | Fila `MOVxx.TSALDO` = **«Pendiente de homologación de campo»** |
| `db/old_db/TRAZABILIDAD_FUNCIONES_Y_BOTONES.md` | Rutinas que sí calculan saldos —`SALDOS_ANO` (`CONTABDSI.PRG:159`), `VERSALDOS` (`PLANMAES.PRG:87`), `CONSALDO`/`CCSALDO` (`CONSULTA.PRG`)— **no están en la copia** |

**Conclusión.** Con el material disponible, `TSALDO` queda **no reconciliable**.
La definición vive en fuentes que no tenemos (`CONTABDSI.PRG`, `PLANMAES.PRG`,
`CONSULTA.PRG`). Si el cliente las aporta, se puede cerrar; mientras tanto se
documenta como diferencia no explicada. El valor crudo ya se conserva por
renglón en `documento_lineas.legado->>'TSALDO'`, así que no se pierde nada.

## 3. Hallazgo colateral: la carga no es fiel cuenta por cuenta

Al comparar el CSV con la base ([`reconciliar_cuentas.py`](cargador/reconciliar_cuentas.py)):

| Medida | Valor |
|---|---|
| Cuentas que difieren | **95** |
| Cuentas que solo están en el CSV | **11** |
| Débitos que faltan en la base | **85.816.656.393,15** |
| Créditos que faltan en la base | **85.817.673.069,15** |

Ejemplo: la cuenta `240801005` está cuadrada en el origen
(débitos = créditos = 8.667.625.024,41) y en la base queda con débitos
**390.239.793,96** por debajo.

La causa son los **23.047 renglones no cargados**: 4.496 con valor cero, 214 de
cabeceras sin comprobante y **18.337 sin cabecera en `CONDOCUM`**. La
conciliación del plan («3.352 de 3.352, diferencia 0,00») es correcta **solo si
se vuelven a sumar los rechazos declarados**; los datos efectivamente cargados no
cuadran contra el origen cuenta por cuenta.

### 3.1 Por qué faltan esas cabeceras

No es que la cabecera no exista: **existe con otra fecha**. El renglón de
`MOV01` de `20250131` cita el documento `JP0000001564`, y en `CONDOCUM` esa
cabecera tiene `DFECHA = 20251031`. La clave de unión incluye la fecha del
documento, así que no cuadra.

Peor: el **número de documento no es único**. `JP0000001919` tiene **5**
cabeceras en `CONDOCUM` (fechas 2025-06 a 2025-10) y ninguna coincide con los
renglones (2025-01 a 2025-04). Quitar la fecha de la clave haría ambiguas esas
claves, que es justo lo que el cargador evita
([`cargar.py`](cargador/cargar.py) §«Clave de la cabecera de un renglón»: *elegir
es peor que rechazar con causa*).

### 3.2 Opción B, implementada y medida

`cargar.py --cabecera-sintetica` (apagado por defecto). Tras resolver
`doc_elegido`, para cada clave de `mov_grp` con renglones de valor y sin cabecera
se inserta en `documentos` una cabecera marcada
(`legado->>'SINTETICA' = 'true'`, `numero` en el rango reservado
`9.000.000.000+`, `idempotency_key` derivada de la clave) y se vuelve a resolver
la unión. Los renglones de valor cero siguen rechazados: una partida sin importe
no es un movimiento.

Recarga completa desde base nueva, medida:

| Medida | Sin la bandera | Con `--cabecera-sintetica` |
|---|---:|---:|
| Cabeceras sintéticas | — | **4.927** |
| Documentos | 735.762 | 740.689 |
| Renglones cargados | 5.025.890 | **5.043.942** (+18.052) |
| Renglones rechazados | 23.047 | **4.995** |
| Cuentas que no cuadran | 95 | **9** |
| Diferencia acumulada | 85.816.656.393,15 | **61.162.669,56** |
| Conciliación cuenta/periodo | 3.352 de 3.352, dif. 0,00 | 3.352 de 3.352, dif. 0,00 |

El saldo de control sigue cerrando: `740.689 − 4.927 + 214 = 735.976` cabeceras y
`5.043.942 + 4.995 = 5.048.937` renglones.

**Lo que queda, explicado.** Los 4.995 rechazos que restan son 4.691 renglones de
valor cero y **304 con `TCOMPR` vacío** (documentos sin comprobante en el propio
origen; las 214 cabeceras rechazadas son su cara en `CONDOCUM`). Esos 304 suman
exactamente **61.162.669,56** de débito y de crédito —el total que aún no
cuadra—. No se les crea cabecera porque `documentos.comprobante_id` es
obligatorio y **el comprobante no está en el origen**: inventarlo sí sería
fabricar un dato. Para cerrarlos haría falta una decisión de negocio (qué
comprobante asignarles) o recuperarlos del cliente.

Criterio de salida de la etapa B: *conciliación cuenta por cuenta con diferencia
0,00, o informe de diferencias explicadas*. Con la opción B queda explicado todo
salvo esos 304 renglones con causa escrita y acotados a 61,2 M sobre 8,5 billones.
