# 08 · Plan para culminar la migración

Qué falta, en qué orden y con qué criterio de salida. Nace del estado real
medido al terminar el libro (`07_decisiones_del_libro.md`) y de las tres
decisiones que se tomaron sobre este plan:

1. Los campos del origen sin columna de destino se conservan en una columna
   **`legado jsonb`** de cada tabla de destino (no fila por fila en
   `migracion_filas`).
2. Se añade la **conciliación por renglón con `TSALDO`**.
3. La equivalencia entre motores se prueba **de verdad, contra Advantage**
   (nivel 2), no sólo contrastando contra el origen.

---

## 0. Dónde estamos

Verificado con corridas reales, no declarado:

| Pieza | Estado |
|---|---|
| Esquema (14 archivos + `funciones.sql`) | 65 tablas y 37 funciones instaladas en base vacía con `ON_ERROR_STOP=1`, sin errores |
| Extracción | 15 CSV, 9.134.136 filas, `sha256` de todos igual al manifiesto |
| Carga | 735.762 documentos y 5.025.890 renglones; 214 y 23.047 rechazados con causa escrita |
| Cuadre | cabeceras y renglones cargados + rechazados = origen, comprobado por el cargador (aborta si no) |
| Idempotencia | segunda corrida deja 0 filas nuevas, mismos conteos y mismas sumas |
| Conciliación | 3.352 de 3.352 pares (cuenta hoja, período con libro) cuadran; diferencia 0,00 |
| `scripts/validate.sql` | las 11 validaciones en verde |
| Backend contra PostgreSQL | **81 líneas y 2 de 34 rutas** |

La migración **de los datos de esta copia** está cerrada salvo los campos sin
destino (etapa A). Lo que falta para culminar se reparte en trabajo de datos,
trabajo de backend y trabajo de producción.

---

## Etapa A · Cerrar el modelo de datos

**Objetivo.** Que no quede ni un valor del origen sin destino, y que el cargador
lo demuestre en cada corrida.

**Trabajo.**

- Columna `legado jsonb` en las tablas de destino que hoy tienen campos sin
  columna con datos: `terceros`, `cuentas`, `documentos`, `documento_lineas`,
  `tipos_documento`, `centros_costos`, `comprobantes`, `companias`,
  `parametros_operacion`.
- Se llena **sólo con los campos que traigan valor** (jsonb con las claves del
  origen, nombres físicos: `CACTIVI`, `DDOCUMI`, `TUSUA`, `TSALDO`…).
- Espejos: `db/advantage/01_tablas.sql`, `db/advantage/02_indices.sql` si hace
  falta, `db/general/referencia_ansi.sql`, `db/general/modelo.json` y
  `db/presentacion-web/src/data/nuevo.json`.
- Cargador: llenar `legado` en todas las entidades y **añadir una comprobación
  automática** —si queda un campo del origen con datos y sin destino, la entidad
  aborta—, igual que ya hace con el cuadre de cabeceras y renglones.
- `homologacion/reglas.py`: los 168 campos de clase `procedencia` pasan a
  declarar `<tabla>.legado` en vez de `migracion_filas`. Regenerar
  `contrato_campos.json` y `06_referencia_campos.md`.

**Entregable.** Recarga completa desde base nueva con el `legado` lleno.

**Criterio de salida.** La auditoría de campos sin destino da **0**, y se probó
que el cargador falla a propósito si aparece uno.

**Esfuerzo.** 1 sesión (la recarga son ~30 minutos).

**Cierra además** el abierto de `documentoInterno`: hoy `documentos_repository`
devuelve `DDOCUMI` y no hay dónde leerlo; pasa a `documentos.legado`.

**Hecho y verificado.** Recarga desde base nueva, aplicando los 15 archivos de
esquema con `ON_ERROR_STOP=1` (2023,9 s): 735.762 documentos y 5.025.890
renglones, conciliación 3.352 de 3.352 con diferencia 0,00, y
`db/migration/cargador/auditar_legado.py` —la comprobación permanente, que lee
el contrato y compara el CSV contra la base— en verde: **159 campos con dato y
ninguno perdido**. Los descuadres frente al CSV son exactamente lo que el propio
cargador excluye, fusiona o rechaza (15 cuentas, 16 terceros, 54 `DMODULO` y 214
`DDOCUMI` de cabeceras rechazadas), y el informe los nombra uno a uno.

**Corrige una cifra de la conversación previa.** Los valores que quedan en
`legado` son **16.082.989**, no 1,56 millones: la auditoría inicial sólo miró la
clase `procedencia` y dejó fuera 4.515.204 valores de clase `fuera_nucleo` que el
contrato ya mandaba a `terceros.legado` (los atributos comerciales, de crédito y
de contacto de `FADCLI`) y 10.011.513 de clase `derivado` en `MOVxx` (`TUSUA` con
dato en 4.962.576 renglones y `TSALDO` en los 5.048.937).

**Pendiente menor.** `centros_costos.legado` queda siempre nulo: `CONCECOS` no
tiene ningún campo con destino `.legado` (su único campo sin columna, `ID`, va a
`migracion_filas.localizador`). La auditoría lo informa; falta decidir si se quita
la columna o se deja a la espera de que cambien las reglas de esa tabla.

---

## Etapa B · Conciliación por renglón con `TSALDO`

**Objetivo.** Verificar importe y cuenta renglón a renglón, no sólo por cuenta y
período.

**Trabajo.** `MOVxx.TSALDO` es el saldo corrido que llevaba el legado (con valor
en las 5.048.937 filas, y distinto de cero en 545.554). Se recorre el libro en el
orden físico (`_archivo`, `_loc`) por cuenta y se compara el saldo acumulado
contra el que traía el origen. Las diferencias se registran con su causa; si el
modelo de saldo corrido no cuadra, se reporta en vez de esconderse.

**Criterio de salida.** Cuadre renglón a renglón en los períodos con libro, o
informe de diferencias explicadas.

**Esfuerzo.** 0,5 sesión.

---

## Etapa C · Backend PostgreSQL: lectura

**Objetivo.** Que las consultas del sistema funcionen contra el modelo nuevo.

**Punto de partida.** `backend/store.py` despacha **2 operaciones**
(`list_companies`, `check_connection`); las otras 32 rutas llaman siempre a los
repositorios de Advantage. `backend/postgres_repository.py` tiene 81 líneas.

| # | Alcance | Riesgo |
|---|---|---|
| C1 | Generalizar el despacho en `store.py`: una implementación por operación y por motor | Bajo; define el patrón |
| C2 | Maestros: `terceros`, `centros`, `tipos-documento`, `comprobantes`, `parametros-operacion`, `periodo-operacion` | Bajo |
| C3 | `movimiento-mensual` | Medio: volumen e índices |
| C4 | `documentos` y `documentos/detalle` | Alto: la clave del documento es de seis campos y hay etiquetas repetidas (ver `07`, §1) |
| C5 | `balance-comprobacion` | Medio: depende de las funciones de acumulados |
| C6 | `lotes`, `lotes/detalle`, `importaciones/leer` | Alto: el flujo más enredado; `lotes` está vacía en la copia |

**Criterio de salida por endpoint.** Mismo JSON que el origen para los mismos
filtros, contrastado por SQL independiente, incluidos los casos límite ya
conocidos: documento con etiqueta repetida, período sin renglones, tercero
bloqueado, cuenta con hijas.

**Esfuerzo.** ~1 repositorio por sesión; 6 a 8 sesiones.

---

## Etapa D · Backend PostgreSQL: escritura

**Objetivo.** Que el sistema pueda escribir en el modelo nuevo con las mismas
garantías que en el legado.

**Orden.** `terceros` (POST) y `parametros-operacion` (PUT) → `anular` documento
→ `lotes` (crear, modificar, verificar, actualizar) → `contabilizar` y
`reprocesos`.

Los tres últimos son los que tocan `documentos`, `documento_lineas` y los
acumulados, y dependen de las funciones del esquema (B03/B06).

**Criterio de salida.** Los mismos casos de `scripts/validate.sql` ejecutados a
través de la API, con los saldos cuadrando después de cada operación.

**Esfuerzo.** 4 a 6 sesiones.

---

## Etapa E · Equivalencia real motor a motor

**Objetivo.** Demostrar que los dos motores responden lo mismo, que es lo que se
pidió desde el principio.

**Trabajo.**

1. Montar Advantage localmente con la copia (procedimiento en
   `05_montar_advantage_local.md`) y crear allí el esquema espejo de
   `db/advantage/`.
2. Construir el arnés de equivalencia: un conjunto de casos (compañía, filtros,
   documento, período) que se ejecuta contra los dos motores con
   `CONTABDSI_STORE` y compara el JSON campo a campo. Hoy las 14 pruebas de
   `backend/tests/` son unitarias de funciones auxiliares, no de integración:
   el arnés hay que escribirlo.
3. Correr el arnés por cada endpoint de las etapas C y D.

**Diferencias conocidas de antemano** (documentadas, no sorpresas):

- En Advantage el índice único parcial se emula con `documento_estado`, y esa
  columna derivada **no** lleva `origen`: el motor viejo no puede expresar la
  excepción de la historia migrada. La regla queda declarada, no impuesta.
- `documentos.documento` es `VARCHAR(60)` en ANSI, `VARCHAR(100)` en Advantage y
  `text` en PostgreSQL.

**Criterio de salida.** El arnés en verde, o cada diferencia explicada y aceptada
por escrito.

**Esfuerzo.** Es un workstream propio: 1 sesión para el montaje, 1 para el arnés,
y después se corre junto con cada endpoint.

---

## Etapa F · Los datos que faltan (P-8)

**Objetivo.** Que los 615.290 documentos migrados que hoy no tienen partidas las
tengan.

**Situación.** La copia trae `MOV00` (2024·12) y `MOV01` (2025·01..04). Faltan
`MOV02`..`MOV18`. Por eso la conciliación reporta 9.825 pares en cuentas hoja de
períodos sin libro: es alcance declarado, no error.

**Trabajo.** Correr el extractor donde están los `.adt` (servidor del cliente):

```
python db/migration/extractor/leer_diccionario.py --validar
python db/migration/extractor/decodificar_adt.py
python db/migration/extractor/exportar_csv.py --reanotar
```

Después, en esta máquina: carga (`--entidad libro`, que es idempotente y añade
sólo lo que falta), conciliación y comprobación de que los documentos sin
partidas bajan.

**Criterio de salida.** Conciliación exacta también en los períodos 05 en
adelante, y documentos sin renglones reducidos a los que de verdad no tienen.

**Depende de:** acceso a la máquina donde están los archivos. No se puede hacer
desde aquí.

---

## Etapa G · Cierre

- **Commit por bloques.** Hay 31 archivos sin commitear: esquema y espejos,
  cargador, contrato y documentación.
- `homologacion/PENDIENTES.md`: recuentos al día (dice 42 decisiones; ya son más).
- `.pyc` versionados en `backend/tests/__pycache__/`: `git rm --cached`.
- Fases organizativas del plan (`03_plan_de_carga.md` §1): 0 (firma del
  inventario), 7 (validación con usuarios), 8 (ensayo general), 9 (corte
  productivo) y 10 (estabilización).

---

## Orden, dependencias y quién

```
A ──> B ──> C1..C6 ──> D ──> E (arnés + corridas) ──> G
                                ▲
F (necesita el servidor) ───────┘  se puede intercalar cuando lleguen los archivos
```

| Etapa | Quién | Bloquea a |
|---|---|---|
| A | Agente | C, D (cambia el esquema) |
| B | Agente | — |
| C, D | Agente | E |
| E | Agente + tu decisión sobre el montaje | G |
| F | **Tú o quien tenga acceso al servidor** | Nada del código; completa los datos |
| G | Agente (commit) y tú (fases 7–10) | — |

**A va primero por dos razones**: cierra un hueco de veracidad hoy, y cambia el
esquema; hacerlo después obligaría a rehacer las consultas del backend ya
escritas.

---

## Principios que rigen todo el plan

1. **Nada se descarta en silencio.** Cada fila acaba cargada o rechazada con su
   causa escrita, y cada corrida lo comprueba.
2. **Ninguna etapa se declara hecha sin su medición.** Los criterios de salida de
   arriba son números, no opiniones.
3. **Una tarea por sesión**, como pide la guía del proyecto.
4. **Lo que el origen distingue, la base lo conserva.** Es la razón de la etapa A.
