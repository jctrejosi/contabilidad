# 07 · Decisiones del libro (CONDOCUM + MOVxx)

Este documento registra las decisiones que hubo que tomar para cargar el libro
—`documentos` y `documento_lineas`— y **con qué evidencia**. Cada número que
aparece aquí se midió sobre la copia real (`ADD_CONTAB/`, 735.976 cabeceras y
5.048.937 renglones) con las consultas que se indican al final.

Sustituye a lo que suponía el plan donde los datos lo desmintieron; cada
corrección dice también qué se creía antes y por qué era falso.

---

## 1. La etiqueta de documento del legado no es única (D-CONDOCUM-3)

**Decisión.** `documentos.documento` guarda `CONDOCUM.DDOCUM` tal cual, y
`documentos_contabilizado_uk` —«un documento solo puede estar contabilizado UNA
vez»— **no se aplica a la historia migrada**: su condición incluye
`origen <> 'Migracion'`.

**Evidencia.** `DDOCUM` parece un número de documento (`FVE742`, `ND-10150`,
`AJU0930`) pero se reutiliza:

| Clave sobre las 735.976 cabeceras | Colisiones |
|---|---|
| `(anio, documento)` | 73.236 |
| `(comprobante, documento, anio)` | 101.171 |
| `(comprobante, tipo documental, documento, anio, período)` | 31.410 |
| `(comprobante, tipo documental, documento, fecha)` | 31.175 |
| `(comprobante, tipo documental, documento, fecha, valor)` | 29.059 |

Ninguna combinación de columnas del legado es única, así que no hay ninguna
-versión ampliada del índice- que salve las filas. Los casos peores no son
errores de datos: hay etiquetas reutilizadas por **15 documentos distintos con 14
NIT distintos** (`28895150`, facturas de proveedores distintos) y por 15 ajustes
con importes distintos (`AJU0930`).

**Alternativas descartadas.**

- *Ampliar el índice* a comprobante y tipo documental: sigue colisionando en
  29.059 filas, y cambia la regla de «un documento una vez» a «una vez por
  comprobante», que protege menos que la verificación que ya hace la propia
  aplicación (`_assert_document_is_new`, cuatro campos).
- *Decorar la etiqueta* (`AJU0930#2`) para hacerla única: le inventa al legado un
  código que nunca tuvo y rompe la unión con los renglones, que llevan
  `TDOCUM` crudo.
- *Dejar `documento` nulo* y conservar la etiqueta en otro sitio: la consulta de
  documentos y la de anulación filtran y muestran por `documento`; el libro
  migrado aparecería con la columna vacía y dejaría de comportarse como en
  Advantage, que es justo lo que se pidió.

**Consecuencia, y por qué se acepta.** La regla sigue vigente para los documentos
que produce el sistema; lo que se documenta es que **el legado tampoco
distinguía** esos documentos por su etiqueta: su propia consulta de detalle une
por compañía, año, mes, documento, comprobante y tipo documental, y devuelve
todas las partidas de esa clave, no las de un documento concreto. La migración
reproduce ese comportamiento en vez de inventar una unicidad que el origen no
tiene.

**Dónde está.** `db/postgresql/schema/04_movimientos.sql` (columna
`documentos.origen`), `db/postgresql/schema/10_indices.sql` (condición del
índice) y sus espejos `db/advantage/01_tablas.sql`, `db/advantage/02_indices.sql`,
`db/general/referencia_ansi.sql`, `db/general/modelo.json` y
`db/presentacion-web/src/data/nuevo.json`.

> En Advantage no hay índices parciales: allí el invariante se emula con la
> columna derivada `documento_estado` y queda **declarado, no impuesto por el
> motor** (ya era así antes de este cambio). El espejo lo dice explícitamente.

---

## 2. Cómo se une un renglón con su cabecera (D-MOV-3)

**Decisión.** Un renglón de `MOVxx` busca su cabecera por **comprobante + tipo
documental + documento + fecha del documento**, y esa clave se resuelve con una
unión hash contra una tabla temporal, no con búsquedas por índice fila a fila.

**Evidencia.** El legado usa compañía, año, período, comprobante, tipo documental
y número. Medido sobre las 5.048.937 filas, `CONANO`/`CONMES` y `TFECDOC`
coinciden **en todas**, así que el año y el período no discriminan nada que la
fecha no discrimine ya. Quedan dos claves razonables, y esta tabla es la
**comparación entre claves**, medida antes de cargar (no el recuento final de
rechazos, que está en §4):

| Clave | Sin cabecera | Claves ambiguas |
|---|---|---|
| fecha + tipo documental | 5.044 claves · 18.559 renglones | 135 claves · 786.747 renglones |
| año + período + tipo documental | 5.029 claves · 18.476 renglones | 220 claves · 788.612 renglones |

La segunda ahorra 83 renglones huérfanos y mete 1.865 más en claves ambiguas: se
prefiere la primera, porque una clave ambigua obliga a **elegir** cabecera y
elegir es peor que rechazar con causa.

**La clave omitía el tipo documental.** La versión anterior del cargador unía por
compañía, documento, año, período y comprobante, **sin** el tipo documental:
97.700 claves habrían casado con más de una cabecera y cada partida se habría
duplicado al insertarse. Es el fallo más caro que se corrigió aquí.

---

## 3. Cuando una clave tiene varias cabeceras: la elección y su motivo (D-MOV-4)

**Decisión.** Por cada clave se elige **una** cabecera, en este orden:
(1) la cuyo `DVALOR` cuadra con el total de débitos de los renglones; si ninguna
cuadra, (2) la de menor número (`_loc`, la primera de la instantánea). La elección
queda registrada en `migracion_filas` con `flags = {CLAVE_AMBIGUA}`, el número de
candidatas, sus ids y el motivo.

**Evidencia de que `DVALOR` es el total de débitos.** Medido sobre las claves de
una sola cabecera: coincide con la suma de `TVALOR > 0` en **121.216 de 123.678**
(98,0%), y con la suma de `TVALOR < 0` en 121.192. No es la suma con signo de los
renglones, que es cero por partida doble — así lo dice el contrato de campos,
corregido en `06_referencia_campos.md`.

**Alcance.** Son **3.197 claves** las que tienen más de una cabecera candidata.
En 64 de las 84 claves con candidatas de distinto valor no cuadra ningún `DVALOR`
—el legado reasentó el mismo documento varias veces con totales ligeramente
distintos, y los `SI00` de saldos iniciales son el caso extremo: 768.904
renglones para 11 cabeceras con 6 valores distintos, ninguno igual al total— y se
aplica la regla 2. Los renglones no se pierden: la partida va a una cabecera que
existe y la atribución queda declarada.

---

## 4. El cargador perdía cabeceras en silencio (corregido)

**Qué pasaba.** `DOCUMENTOS_SQL` terminaba en `ON CONFLICT DO NOTHING` sin
destino. Con el índice anterior, **73.236 cabeceras** (el 10% del libro) chocaban
en `(compania_id, anio, documento)` y desaparecían sin una sola excepción
registrada: la suma de cabeceras cargadas y rechazadas no cuadraba con el origen
y nada lo comprobaba.

**Qué se hace ahora.** La cabecera entra por su clave real, la etiqueta se
conserva, y las que no pueden entrar —214 con `DCOMPRO` nulo o inexistente en
`comprobantes`— se registran como rechazo con causa. La entidad **comprueba al
terminar** que cabeceras cargadas + rechazadas = cabeceras del origen, y que
renglones cargados + rechazados = renglones del origen. Si no cuadra, aborta.

**Resultado de la carga.** 735.976 cabeceras del origen repartidas en 735.762
documentos cargados y 214 rechazadas; 5.048.937 renglones repartidos en 5.025.890
partidas cargadas y 23.047 rechazadas (18.551 sin cabecera en `CONDOCUM`, 4.496
con valor cero, 0 sin cuenta en el plan). Las dos sumas cuadran exactamente.

---

## 5. `TIVA_RET` no era la clase del destino (cierra D-MOV-2)

**Decisión.** `MOVxx.TIVA_RET` se traduce antes de cargarse en
`documento_lineas.clase`: `I` → `IVA`, `R` → `Retencion`, `O` → `Otro`, vacío →
`''`.

**Evidencia.** Contado sobre las 5.048.937 filas, el dominio real es
`O` 2.945.663 · `I` 2.047.372 · `R` 47.365 · vacío 8.537. La clase del destino
sólo admite `IVA`, `Retencion`, `Otro` y vacío: cargar el carácter crudo
**violaba el CHECK** de la tabla. No es el mismo dominio que `CONMAE.MIVA_RET`
(que vale `Generado`/`Renta`/vacío), así que el paralelo entre las dos columnas
no se sostiene.

`O` se conserva como `Otro` en vez de fundirlo con el vacío porque el origen sí
distingue los dos casos; para los acumulados de IVA y retención el efecto es el
mismo (ninguno de los dos entra), pero la distinción no se pierde.

---

## 6. `TSEC` está vacía: el orden de las partidas

**Decisión.** `documento_lineas.numero_linea` se numera con el **orden físico de
la instantánea** (`_archivo`, `_loc`), no con `TSEC`.

**Evidencia.** `TSEC` está vacía en las 5.048.937 filas. Es exactamente el
reemplazo que el contrato de campos dejaba indicado para ese caso.

---

## 7. Fechas: cuarentena en vez de aborto

**Decisión.** Las fechas del legado se convierten con un guardián que comprueba
rango de año, mes y día contra la duración real del mes, y devuelve nulo en vez de
dejar que `to_date` falle. Una cabecera sin fecha válida se rechaza con su causa.

**Por qué.** `to_date('20230230', 'YYYYMMDD')` no devuelve nulo: **falla** con
«date/time field value out of range», y una sola fecha mala habría abortado la
carga entera en lugar de mandar la fila a cuarentena, que es lo que pide el plan.
En esta copia no hay ninguna fecha inválida —0 en las 5.048.937 de `MOVxx` y 0 en
`CONDOCUM`—, así que el guardián no cambia ningún dato: protege la próxima.

---

## 8. Rendimiento: por qué la entidad no terminaba

Medido, no supuesto. Cuatro cosas, todas corregidas en
`db/migration/cargador/cargar.py`:

1. **Anticombinación por bucle anidado.** Comparar 5.048.937 renglones contra las
   cabeceras una por una llevaba más de 30 minutos sin acabar. Se fuerza el
   `hash join` (`enable_nestloop = off`, `enable_mergejoin = off`).
2. **`work_mem` de 4 MB.** La tabla hash se derramaba a disco en cada lote; la
   entidad lo sube a 256 MB para su propia transacción.
3. **Diez millones de búsquedas por índice.** Resolver comprobante, tipo, cuenta,
   centro y tercero (este último por NIT y por código heredado) fila a fila son
   recorridos aleatorios sobre `terceros` (126.009 filas). Los cinco catálogos se
   copian a tablas temporales y la unión pasa a ser una sola tabla hash.
4. **Un `WITH` inlineado.** `PostgreSQL 12+` inlinea los CTE que se referencian una
   vez, y el `EXISTS` de cobertura de la conciliación volvía a recorrer los
   5.025.890 renglones por cada fila de la instantánea. Materializado en su propia
   tabla temporal, la consulta pasa de no terminar en 20 minutos a 78 segundos.

Resultado: la entidad completa tarda unos **16 minutos** (antes no terminaba) y
la de renglones sola unos 10.

---

## 9. Conciliación: qué se puede exigir y qué no

**Decisión.** La conciliación exige, y comprueba, esta igualdad **sólo en cuentas
hoja y sólo en períodos con renglones cargados**:

    instantánea del origen = libro cargado + renglones rechazados declarados

Si la diferencia no es cero, la entidad aborta. Lo demás se reporta aparte.

**Por qué no es la comparación directa.** Comparar `saldos_cuenta` contra el libro
daba 9.781 diferencias de 12.382 pares, y no eran errores de carga. Comprobado:

- **`CONMAE` acumula el árbol**: sus cifras de una cuenta incluyen las de sus
  hijas, y el libro sólo tiene partidas en las hojas. Son 3.248 pares que no son
  comparables (sólo 3 tienen partidas propias).
- **El crédito va en negativo** en la instantánea (`CONMAE` lo guarda así):
  7.230 pares con crédito negativo, ninguno positivo.
- **Lo que faltaba era justo lo rechazado**: en 2025-04, la diferencia de cada
  cuenta es exactamente el importe de sus renglones rechazados
  (`débito origen − débito libro − débito rechazado = 0,00` en las doce cuentas
  con mayor diferencia).

**Resultado de la corrida.** 3.355 pares (cuenta hoja, período con libro) y
**3.355 cuadran**, con diferencia acumulada de 0,00 en débito y en crédito.

**Alcance declarado, no error.** En los períodos 05 a 12 la instantánea trae
saldos y el libro no tiene renglones: faltan `MOV02`..`MOV18` en la copia (P-8 del
plan). Son 9.825 pares, 5.252 de ellos con saldo en el origen. También se reporta,
sin compararlo, el desbalance de **−0,12** entre débitos y créditos del libro: es
del propio origen (`MOV00` neto `−0,12`, `MOV01` neto `0,00`), no del cargue.

---

## 10. Lo que queda abierto

- **P-8**: `MOV02`..`MOV18` no están en la copia. Sin ellos, 615.290 documentos
  migrados no tienen partidas (los períodos 05..12 de 2025 y todo lo anterior a
  2024-12). Cuando lleguen, la carga los añade sin tocar lo ya cargado.
- **`documento_lineas.archivo_origen`** guarda `MOVxx.TARCHI` (984 valores
  distintos), pero no se comprobó que sea la misma cosa que el archivo de origen:
  podría ser un lote. Queda como dato conservado, sin semántica acreditada.
- **`CONDOCUM.DDOCUMI`** (el «documento interno») se conserva en
  `migracion_filas` porque el contrato no le encontró destino, pero
  `backend/documentos_repository.py` sí lo devuelve como `documentoInterno`. Si el
  backend de PostgreSQL tiene que servirlo, hay que decidir dónde vive.
- **El espejo de Advantage no puede reproducir** la condición del índice (no hay
  índices parciales): allí la regla queda declarada. Ver §1.

---

## 11. Cómo se reproduce todo esto

```bash
# 1. Extracción (deja los CSV en db/migration/staging/, ignorado por Git)
python db/migration/extractor/leer_diccionario.py --validar
python db/migration/extractor/decodificar_adt.py
python db/migration/extractor/exportar_csv.py --verificar

# 2. Carga sobre una base recién creada (sin el seed de demostración)
python db/migration/cargador/cargar.py \
  --url postgres://contabdsi:contabdsi@127.0.0.1:5433/contabdsi_datos

# 3. Conciliación: exige diferencia 0,00 y aborta si no la hay
python db/migration/cargador/cargar.py \
  --url postgres://contabdsi:contabdsi@127.0.0.1:5433/contabdsi_datos --entidad conciliacion
```

Las cifras de este documento salen de consultas directas sobre las dos tablas
grandes, no de estimaciones: recuentos por columna y por clave, y comparación de
la instantánea contra el libro cuenta por cuenta y período.
