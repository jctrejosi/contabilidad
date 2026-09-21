# 13 · Informe final de la migración CONTABDSI

Resumen de todo el trabajo de migración del sistema contable legado
(Advantage/CA-Clipper) a PostgreSQL, con lo que quedó hecho, con qué evidencia y
qué falta. Consolida los documentos [`01`](01_inventario_fuente.md) a
[`12`](12_escrituras.md); para el detalle, este informe enlaza a cada uno.

**Veredicto.** El modelo nuevo está **operativo de punta a punta** sobre la copia
disponible: los datos cargados concilian, el backend lee y escribe contra
PostgreSQL y el proyecto se levanta con `node dev.js --db-postgres`. Lo que falta
es **alcance declarado** (una etapa bloqueada por el servidor del cliente, una
aplazada por decisión) y las **fases organizativas de puesta en producción**.

## 1. Estado por etapa

| Etapa | Qué es | Estado |
|---|---|---|
| A | Modelo de datos completo (`legado jsonb`) | ✅ cerrada |
| B | Conciliación por renglón con `TSALDO` | ✅ cerrada |
| C1–C4 | Despacho por motor; maestros, movimiento mensual, documentos | ✅ hecho |
| C5 | Balance de comprobación | ✅ hecho |
| C6 | Lotes e importaciones (lectura) | ✅ hecho |
| D | Escrituras | ✅ hecho¹ |
| E | Equivalencia motor a motor | ⏸️ aplazada por decisión |
| F | Los datos que faltan (`MOV02`..`MOV18`) | ⛔ bloqueada por el servidor |
| G | Cierre (documentación, fases 7–10) | 🟡 parcial² |

¹ Salvo la *ejecución* del reproceso mensual, condicionada a la etapa F (§4).
² Falta el commit y las fases organizativas, que son tuyas.

## 2. Qué se migró

### 2.1 Datos (`contabdsi_datos`)

Extraídos **sin el motor de Advantage** (los `.adt` se decodifican: ver
[`extractor/`](extractor/README.md)) desde `ADD_CONTAB` y cargados con el cargador
(`cargador/README.md`). Estado real medido en la base:

| Tabla | Filas |
|---|---:|
| `documentos` | 740.689 (4.927 con cabecera sintética) |
| `documento_lineas` | 5.043.942 |
| `terceros` | 125.993 |
| `cuentas` | 4.046 |
| `tipos_documento` | 127 |
| `comprobantes` | 28 |
| `centros_costos` | 222 |
| `saldos_cuenta` | 16.418 |
| `consecutivos_comprobantes` | 79 |
| `periodos_contables` | 5 |

Cuadre con el origen: `5.043.942` cargados `+ 4.995` rechazados `= 5.048.937`;
`740.689 − 4.927` sintéticas `+ 214` cabeceras rechazadas `= 735.976`. Cada
rechazo tiene su causa escrita.

**Conciliación.** 3.352 de 3.352 pares (cuenta hoja, período con libro) cuadran,
con diferencia **0,00** ([`09_conciliacion_tsaldo.md`](09_conciliacion_tsaldo.md)).

**Idempotencia.** Una segunda corrida del cargador deja 0 filas nuevas, los mismos
conteos y las mismas sumas.

### 2.2 Backend (`backend/`)

Las **34 rutas** de la API operan contra PostgreSQL con
`CONTABDSI_STORE=postgres`, sin tocar React: el contrato JSON es el mismo.

- **Lectura (etapas C2–C6):** compañías, cuentas, centros, comprobantes, tipos de
  documento, terceros, parámetros y período de operación, movimiento mensual,
  documentos y su detalle, balance de comprobación (con exportación XLSX/PDF) y
  lotes.
- **Escritura (etapa D):** crear tercero, crear/modificar cuenta, grabar
  parámetros, lotes (crear, modificar, eliminar, partidas, verificar,
  contabilizar, importar), anular documento (con reversión), captura directa y
  reproceso mensual ([`12_escrituras.md`](12_escrituras.md)).

El principio que lo sostiene: la implementación de PostgreSQL consulta los
**mismos nombres físicos del legado** y reutiliza los **mapeadores** y hasta el
**ensamblado del informe** del motor viejo, así que el JSON no puede divergir; y
las reglas de negocio de lotes y anulación viven en las **funciones del esquema**
(`validar_lote`, `contabilizar_lote`, `anular_documento`, `regenerar_acumulados`),
invocadas en una sola transacción.

## 3. Cómo se opera (PostgreSQL)

```bash
# Arrancar todo contra el modelo nuevo (base migrada):
DATABASE_URL=postgres://contabdsi:contabdsi@127.0.0.1:5433/contabdsi_datos \
  node dev.js --db-postgres

# Contra el legado (por defecto, requiere Advantage):
node dev.js --db-advantage

# Detener:
node dev.js --stop
```

El flag fija `CONTABDSI_STORE` en el proceso del backend (gana sobre
`backend/.env`). Sin `DATABASE_URL`, `--db-postgres` usa el valor de
`backend/.env` o `postgres://contabdsi@127.0.0.1:5433/contabdsi` (la base de
`docker compose`). La base de `docker compose` trae un seed de demostración; para
los datos migrados hay que apuntar a `contabdsi_datos`.

**Recargar el esquema** (por ejemplo al recrear la base): los archivos de
`db/postgresql/schema/` en orden, luego `funciones.sql` y, si se quiere el seed,
`seed.sql`.

## 4. Decisiones que sostienen la migración

Índice; el razonamiento y la evidencia están en cada documento.

- **`TSALDO` es no reconciliable** y su valor crudo se preserva en
  `documento_lineas.legado` — [`09`](09_conciliacion_tsaldo.md).
- **Cabecera sintética** para los renglones sin cabecera en `CONDOCUM`, en un rango
  de `numero` reservado — [`09`](09_conciliacion_tsaldo.md).
- **Los 304 renglones sin comprobante no se inventan** — [`08`](08_plan_para_culminar.md) §Etapa B.
- **`saldos_cuenta` es la instantánea fiel de `CONMAE`**; el balance y el plan de
  cuentas se construyen desde ahí, no desde el libro — [`10`](10_balance_comprobacion.md).
- **Ensamblado compartido** del balance entre los dos motores — [`10`](10_balance_comprobacion.md).
- **Reglas de escritura en la base, no en Python**; una transacción sustituye al
  candado del proceso — [`12`](12_escrituras.md).
- **`documentos.fecha` = fecha del documento** (corrección en `contabilizar_lote`) —
  [`12`](12_escrituras.md) §3.1.
- **Anulación por reversión**, no por borrado — [`12`](12_escrituras.md) §3.6.
- **Reproceso: simular sí, ejecutar no** hasta la etapa F — [`12`](12_escrituras.md) §3.8.
- **`/api/companias` expone el código a tres dígitos** (`027`), como `CONEMP`; el
  destino lo guarda sin ceros (`27`).
- **Seed y app alineados**: `companias.codigo` del seed es `'1'` (antes `'001'`,
  que el cliente normalizaba a `'1'` y no encontraba la compañía).

## 5. Verificación reproducible

| Prueba | Comando | Resultado |
|---|---|---|
| Pruebas unitarias | `backend/.venv/bin/python -m pytest backend/tests/ -q` | 79 en verde |
| Validación funcional del esquema | `psql … -f db/postgresql/scripts/validate.sql` sobre schema+funciones+seed | 11/11 |
| Flujo de escritura por HTTP | `tmp/e2e_etapa_d.py` (ver su cabecera) | 32/32 |
| Conciliación libro ↔ saldos | consulta por cuenta tras las escrituras | 0 cuentas descuadradas |
| Endpoints de lectura sobre la base migrada | `uvicorn` + `curl` | 15/15 → `200` |

## 6. Lo que queda

| Pendiente | Qué falta | Quién |
|---|---|---|
| **Etapa E** · equivalencia motor a motor | Montar Advantage local, escribir el arnés de casos y comparar campo a campo | aplacada por tu decisión |
| **Etapa F** · los datos que faltan | Correr el extractor donde están los `.adt` (`MOV02`..`MOV18`), recargar y conciliar | **tú / quien tenga el servidor** |
| **Reproceso real** | Se habilita al completar el libro (etapa F) | depende de F |
| **Fases 7–10** | Validación con usuarios, ensayo general, corte productivo y estabilización | **tú** |
| **Commit** | 4 archivos nuevos y varios modificados, sin commitear | **tú** |

**Deuda declarada** (no bloquea): la redacción exacta de algunos mensajes de error
puede diferir del legado (se conserva el tipo, que fija el código HTTP); el tipo
`documentos.documento` pasa de `VARCHAR(100)` a `text`; e `import_lot` valida los
maestros al importar en vez de diferirlo a la verificación.

**Limitación de datos conocida.** La copia trae `MOV00` y `MOV01`; faltan
`MOV02`..`MOV18`, así que 615.290 documentos migrados no tienen partidas y los
períodos 05–12 no tienen libro. Es alcance declarado, no error; la etapa F lo cierra.
