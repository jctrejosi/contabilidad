# Detalle: informes (bloque A5)

Cuatro rutas nuevas, y la especificacion de los seis informes que la pantalla
marca "Pendiente" (`PENDING_REPORTS` en `Interface_web/src/pages/Informes.tsx:160-167`).
Cierra la parte de datos de H17 y el bloque A5.

Punto de partida que conviene tener claro: **la ruta de los informes ya existe**.
`GET /api/informes/adicionales/{report_id}` (`backend/app.py:993`) y sus dos
exportaciones (`backend/app.py:1028`) ya atienden los ids de la pantalla; hoy
responden 422 con un mensaje que declara la carencia
(`backend/informes_adicionales_repository.py:433-441`). El trabajo no es una ruta
nueva de informes: es el dato que falta detras y el cableado de la interfaz
(`api/informesAdicionales.ts:53` y `62` ya existen).

| id del informe | que le falta | cierre |
|---|---|---|
| `acum-corriente` | usar `cuentas.clasificacion_corriente`, que existe (`db/postgresql/schema/03_maestros.sql:25`) pero no esta en el contrato de escritura | extension de `PUT /api/cuentas/{codigo}` (ruta existente, `backend/app.py:1079`) mas el generador |
| `def-cuentas-flujo` | definicion de cuentas del flujo | `flujo_caja_renglones` (tabla nueva) mas el generador |
| `flujo-comparativo` | la misma definicion, aplicada a dos periodos | la misma tabla |
| `esfa-apertura` | clasificacion NIIF de las cuentas | `rubros_niif` y `rubro_niif_cuentas` (tablas nuevas) |
| `nic-saldos` | la misma clasificacion NIIF | las mismas tablas |
| `generador-personalizado` | decision de producto sobre el alcance del generador | fuera de alcance (seccion 6) |

---

## 0. Patron comun

- Las cuatro rutas de configuracion siguen el patron del bloque B3: `GET` lista,
  `PUT` reemplaza la coleccion completa, `cia` obligatoria, `usuario` y `motivo`
  en la escritura, baja logica no aplicable (se reemplaza, no se borra fila a
  fila), `dryRun` en la escritura.
- Las tablas son nuevas, asi que la columna *motor* es `requiere tabla nueva en
  ADS` en las cuatro: la clasificacion NIIF y la definicion de flujo no tienen
  contraparte en el legado (los 37 campos NIIF de `CONMAE` no existen siquiera en
  la copia, `db/migration/homologacion/PENDIENTES.md:83`, y se cerro no modelarlos
  en `cuentas`). Con `CONTABDSI_STORE=ads` devuelven 503 declarado.
- Auditoria: fila en `auditoria` por cada reemplazo, con los conteos.

---

## 1. `GET /api/flujo-caja-renglones`

**Proposito.** Leer la definicion de cuentas del flujo de caja de la compania.

**Request.** `cia` (query, obligatorio), `anio` (opcional: la definicion es
vigente por ano; sin el, devuelve la ultima).

**Response (200)**

```json
{
  "items": [
    { "codigo": "OP01", "nombre": "Efectivo de actividades de operacion", "grupo": "Operacion", "orden": 1, "cuenta": "410505", "nombreCuenta": "Ingresos operacionales", "signo": 1 },
    { "codigo": "OP02", "nombre": "Pagos a proveedores", "grupo": "Operacion", "orden": 2, "cuenta": "510506", "nombreCuenta": "Gastos", "signo": -1 }
  ],
  "count": 2,
  "source": "flujo_caja_renglones"
}
```

**Consume.** Informes: los informes `def-cuentas-flujo` y `flujo-comparativo`,
cuyos botones de tarjeta son los de `Informes.tsx:695` y `738`.

**Reglas.** `grupo` es `Operacion`, `Inversion` o `Financiacion`, con el `CHECK`
de la tabla propuesta. `signo` es 1 o -1 y usa la misma convencion que
`renglones_renta.signo` (`db/postgresql/schema/03_maestros.sql:224`): el renglon
se suma o se resta al total del grupo. El orden lo fija `orden`.

**Criterio de aceptacion**

1. Normal: devuelve los renglones ordenados y con el nombre de la cuenta.
2. Vacio: compania sin definicion devuelve `items: []`, `count: 0`, y los dos
   informes siguen devolviendo 422 con el mensaje de carencia (no un informe en
   blanco que parezca un resultado).
3. Invalido: sin `cia`, 422.

---

## 2. `PUT /api/flujo-caja-renglones`

**Proposito.** Reemplazar la definicion completa del flujo de caja.

**Request.** `cia` mas cuerpo `CashFlowDefinition`: `anio`, `renglones`
(`list[CashFlowLine]`, `min_length=1`, `max_length=200`, con `codigo`, `nombre`,
`grupo`, `orden`, `cuenta` y `signo`), `usuario`, `motivo`. `dryRun` (query).

**Response (200)**

```json
{ "item": { "anio": 2026, "renglones": 14, "creados": 2, "actualizados": 12, "retirados": 0, "cuentasSinUso": 1 }, "source": "flujo_caja_renglones" }
```

**Consume.** Informes: la configuracion de los dos informes de flujo.

**Reglas**

- Reemplazo en bloque dentro de una transaccion, con los conteos.
- Cada `cuenta` debe existir en el plan de la compania (FK propuesta
  `flujo_caja_renglones_cuenta_fk`): 422 si no.
- Una cuenta no puede estar en dos renglones con signos distintos (409), por la
  misma razon que en `renglones_renta`: partiria el saldo del grupo.
- `cuentasSinUso` informa cuantas cuentas de tesoreria del plan no estan en
  ningun renglon: es el aviso util para el contador y evita que el estado de flujo
  salga incompleto sin que nadie lo note.
- Con la definicion completa, `def-cuentas-flujo` y `flujo-comparativo` dejan de
  responder 422: el generador los construye con los saldos de
  `saldos_cuenta` (`CONMAE` en ADS) y la definicion.

**Criterio de aceptacion**

1. Normal: definicion de 14 renglones devuelve 200 y los dos informes generan
   cifras; el total del flujo cuadra con la variacion del efectivo del periodo.
2. Vacio: lista vacia devuelve 422 (`min_length=1`); una definicion sin cuentas de
   tesoreria devuelve 200 con `cuentasSinUso` alto y los informes salen en cero.
3. Invalido: cuenta inexistente, 422; grupo distinto de los tres valores, 422;
   `signo` distinto de 1 y -1, 422; cuenta repetida con signos distintos, 409.

---

## 3. `GET /api/rubros-niif`

**Proposito.** Leer los rubros NIIF y las cuentas asignadas a cada uno.

**Request.** `cia` (query, obligatorio), `anio` (opcional) e `informe`
(`Literal["todos", "ESFA", "ER"]`, por defecto `todos`).

**Response (200)**

```json
{
  "items": [
    { "codigo": "AC-P1", "nombre": "Efectivo y equivalentes", "informe": "ESFA", "tipo": "Activo Corriente", "orden": 1, "cuentas": ["110505", "111005"] }
  ],
  "count": 1,
  "source": "rubros_niif"
}
```

**Consume.** Informes: los informes `esfa-apertura` y `nic-saldos`.

**Reglas.** `tipo` es uno de los nueve del `CHECK` propuesto (los cinco del ESFA,
los de resultados y `Orden`). Las cuentas vienen de `rubro_niif_cuentas`. Un rubro
sin cuentas se devuelve con `cuentas: []` y los informes lo muestran en cero: no
se completa con heuristicas por nombre de cuenta, que es la clase de invento que
la auditoria pide no hacer (`AUDITORIA_FUNCIONALIDAD.md:779-785`).

**Criterio de aceptacion**

1. Normal: devuelve rubros con sus cuentas, filtrados por informe.
2. Vacio: compania sin clasificacion devuelve `items: []` y ambos informes siguen
   respondiendo 422 con la carencia declarada.
3. Invalido: `informe` distinto de los tres valores, 422; sin `cia`, 422.

---

## 4. `PUT /api/rubros-niif`

**Proposito.** Reemplazar los rubros NIIF y sus asignaciones de cuentas.

**Request.** `cia` mas cuerpo `NiifClassification`: `anio`, `rubros`
(`list[NiifGroup]`, `min_length=1`, `max_length=200`, con `codigo`, `nombre`,
`informe`, `tipo`, `orden` y `cuentas`), `usuario`, `motivo`. `dryRun` (query).

**Response (200)**

```json
{ "item": { "anio": 2026, "rubros": 22, "asignaciones": 318, "creados": 3, "actualizados": 19, "retirados": 0, "cuentasSinRubro": 41 }, "source": "rubros_niif" }
```

**Consume.** Informes: la configuracion de los dos informes NIIF.

**Reglas**

- Reemplazo en bloque de `rubros_niif` y `rubro_niif_cuentas` en una
  transaccion, con los conteos.
- Una cuenta del plan no puede estar en dos rubros del mismo informe (409): un
  saldo en dos rubros del ESFA descuadra el informe. Si puede estar en un rubro
  del ESFA y en uno del estado de resultados, porque son informes distintos.
- Cada cuenta debe existir en el plan de la compania (FK propuesta): 422 si no.
- `cuentasSinRubro` es el aviso de cobertura, con el mismo criterio que
  `cuentasSinUso` en el flujo.
- La clasificacion corriente o no corriente de `acum-corriente` sale de
  `cuentas.clasificacion_corriente` y no de esta tabla: son dos ejes distintos
  (por rubro financiero y por corriente o no corriente) y mezclarlos produciria un
  informe que no se puede conciliar con el legado
  (`db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`, CONMAE, "clasificacion corriente").
  Ese campo se expone por la extension aditiva de `PUT /api/cuentas/{codigo}`,
  que ya existe (`backend/app.py:1079`), y con `AccountWrite`
  (`backend/app.py:71-84`) mas el campo el informe `acum-corriente` deja de
  responder 422.

**Criterio de aceptacion**

1. Normal: 22 rubros y 318 asignaciones devuelven 200 y `esfa-apertura` y
   `nic-saldos` generan cifras; el total del ESFA cuadra con el balance.
2. Vacio: lista vacia de rubros devuelve 422 (`min_length=1`).
3. Invalido: cuenta inexistente, 422; cuenta en dos rubros del mismo informe,
   409; `informe` distinto de `ESFA` o `ER`, 422; `tipo` fuera de los nueve
   valores, 422.

---

## 5. Cableado de la interfaz

No genera contrato y cierra la parte visual de A5:

| Tarea | Que se hace | Archivos |
|---|---|---|
| Retirar el aviso "Pendiente" | Cuando el id deje de responder 422, el boton de la tarjeta pasa de "Pendiente" a "Generar"/"Abrir pantalla" y se retira la entrada de `PENDING_REPORTS` | `Informes.tsx:160-167`, `693-697` y `737-740` |
| Manejador propio en el boton (H17) | Mover el `onClick` del contenedor al boton y deshabilitarlo mientras carga | `Informes.tsx:678`, `695`, `720` y `738` |
| Configuracion de los dos ejes | Una pantalla o un modal de parametros para flujo de caja y rubros NIIF, con busqueda de cuentas por `GET /api/cuentas` | `Informes.tsx` (parametros del informe) |
| Verificacion de la clasificacion corriente | Exponer `clasificacionCorriente` en el editor de cuentas que ya existe | `PlanCuentas` con `api/cuentas.ts` |

El generador personalizado (`generador-personalizado`) no se cablea: queda fuera
de alcance porque exige una decision de producto sobre su alcance (seccion 6 del
plan principal).
