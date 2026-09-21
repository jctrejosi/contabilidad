# 10 · Balance de comprobación (etapa C5)

Cómo se resuelve `/api/informes/balance-comprobacion` contra PostgreSQL, de dónde
salen las cifras y por qué. Cierra el punto C5 de
[`08_plan_para_culminar.md`](08_plan_para_culminar.md).

## 1. La pregunta que había que decidir

El informe del legado (`balance_comprobacion_repository.py`, reproduce
`INFOR02(1)`/`MOVMENSU`/`CONSALDO` de Harbour) se construye íntegramente desde
**`CONMAE`**:

```
opening = MSALDO + Σ( MACMDEBss + MACMCREss )   para los meses previos al rango
debit   = Σ MACMDEBss                            del rango
credit  = − Σ MACMCREss                          del rango   (créditos en negativo)
closing = opening + debit + signed_credit
```

En el modelo nuevo había **dos fuentes candidatas**:

1. **`saldos_cuenta`** — la instantánea de acumulados por cuenta y período.
2. **`documento_lineas`** (el libro) **+** la apertura, recalculando los meses.

La duda venía de una nota previa: se temía que los saldos cargados «trajeran todo
el año» y no coincidieran con `MACMDEBxx` del legado.

## 2. Decisión: `saldos_cuenta` es la fuente

**`saldos_cuenta` *es* `CONMAE` volcado.** El cargador
(`cargar.py::cargar_cuentas`) tomó las cifras directamente de los campos físicos
del origen, sin recalcularlas:

| Origen (`CONMAE`) | Destino (`saldos_cuenta`) |
|---|---|
| `MSALDO` | `saldo_inicial` del período **`00`** |
| `MACMDEBnn` | `debito` del período `nn` |
| `MACMCREnn` | `credito` del período `nn` (**negativo**, como en el origen) |

Por tanto **no es una aproximación**: es el mismo dato. Recalcular desde el libro
daría otra cosa y, además, no podría reproducir el informe (ver §3). La
preocupación previa era infundada: la copia de `CONMAE` que se volcó es la misma
que leería Advantage.

### Por qué **no** se recalcula desde el libro

- El informe del legado **no** se construye desde los movimientos, sino desde los
  acumulados del maestro. Calcarlo desde el libro sería reimplementar el informe,
  no migrarlo.
- `CONMAE` **acumula el árbol** (una cuenta con hijas incluye sus cifras), mientras
  el libro sólo tiene partidas en hojas; compararlos directamente no significa
  nada (ya medido en `cargar.py::conciliar_saldos`).
- Parte del año **no está en la copia**: `MOV02`..`MOV18` faltan (etapa F). El
  libro no puede reconstruir los meses sin movimientos, pero `CONMAE` sí los trae
  en su instantánea.

## 3. Ensamblado compartido, no duplicado

Para que el contrato **no pueda divergir** entre motores, el armado del JSON se
extrajo a una única función:

```
balance_comprobacion_repository._assemble_report(company, company_row, year,
                                                 month_from, month_to, level,
                                                 include_zero, source_rows)
```

- El motor **Advantage** le pasa las filas de `CONMAE`.
- El motor **PostgreSQL** (`postgres_repository.build_trial_balance`) reconstruye,
  desde `saldos_cuenta`, filas con los **mismos nombres físicos**
  (`CODIGO`/`MNOMBRE`/`MSALDO`/`MACMDEBxx`/`MACMCREyy`) y le pasa esas filas.

Es el mismo patrón que el resto de la etapa C: la implementación nueva habla el
vocabulario del legado y reutiliza el código de salida del motor viejo.

Detalles que se conservan idénticos:

- **Niveles** (`LEVELS`): 4 = Cuenta, 6 = Subcuenta, 9 = Auxiliar 1,
  12 = Auxiliar 2; por defecto 6. Se descartan las cuentas con código más largo
  que el nivel pedido.
- **Totales de control**: sólo con las cuentas de **longitud 1** (las clases).
- **Signo de presentación**: `−1` para las clases 2, 3 y 4 (pasivo, patrimonio,
  ingresos se muestran en positivo); `1` para el resto.
- **`incluirCeros`**: por defecto `false`, descarta filas con todo en cero.
- **Validación de ejercicio**: si el año pedido no es el de operación (`CONCTR.CTANO`),
  se rechaza. En el modelo nuevo `CTANO` vive en
  `parametros_operacion.anio_operacion`.
- **`source`**: sigue informando `"CONMAE"`, que es el origen real del dato.

## 4. Verificación

Corrido contra `contabdsi_datos`, compañía `27`, ejercicio 2025, Enero–Abril,
nivel 6:

| Vía | saldo anterior | débito | crédito | saldo actual |
|---|---:|---:|---:|---:|
| Repositorio PG (`/api/informes/balance-comprobacion`) | −0,11 | 1.051.440.382.749,64 | 1.051.440.382.749,61 | −0,08 |
| **SQL independiente** sobre `saldos_cuenta` | −0,11 | 1.051.440.382.749,64 | 1.051.440.382.749,61 | −0,08 |

Coinciden al centavo; `count = 509` filas con el nivel pedido. La diferencia
débito − crédito = **0,03** es del **propio origen**: es la misma que arrastra la
instantánea de `CONMAE` y aparecería igual en Advantage (no la introduce el modelo
nuevo).

Comprobado además por HTTP real (`uvicorn` + `curl`):

- `GET /api/informes/balance-comprobacion` → `200`, misma cifra.
- `GET …/exportar?formato=xlsx` → `200` (30.436 bytes) y `…&formato=pdf` → `200`
  (65.732 bytes). Los exportadores XLSX/PDF son los **mismos** del motor viejo:
  reciben el informe ya armado y no saben de qué motor vino.
- Año fuera del ejercicio (`2024`) → `422` con «CONMAE contiene los acumulados del
  ejercicio 2025…».

Los 79 tests de `backend/tests/` siguen en verde.

## 5. Pendiente

- **Equivalencia motor a motor** (etapa E): la comparación campo a campo contra
  Advantage del mismo informe queda para cuando se monte el motor (aplazada por
  decisión del usuario). Aquí se verificó contra SQL independiente, que es la
  Evidencia 1 del plan.
- El descuadre de 0,03 del origen **no se corrige**: se conserva, que es lo fiel.
