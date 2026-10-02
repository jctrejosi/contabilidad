# 16 · Homologación de consolidación

## Objeto

Dos tablas nuevas que guardan la correspondencia de cuentas y de centros entre la
compañía origen y la compañía destino de una consolidación.

| Tabla | Qué guarda |
|---|---|
| `consolidacion_cuentas` | cuenta origen → cuenta destino, con el signo del cruce |
| `consolidacion_centros` | centro de costo origen → centro destino |

## Motivo (evidencia)

`db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md` (CONSOLID): `consolidaciones` y
`consolidacion_origenes` no bastan — "falta persistir correspondencias de
cuentas/centros y procedencia de cada resultado"; lo repite la validación por
proceso **P27**. Es la brecha que el plan cierra con estas dos tablas.

## DDL PostgreSQL

En `db/postgresql/schema/16_consolidacion_homologacion.sql`. Aditivo: **ninguna
columna nueva** sobre tablas existentes (`consolidaciones` y
`consolidacion_origenes` ya existen en `07_procesos.sql`).

**Desviación frente al plan (§4.2), deliberada.** El plan dejó abierta la clave
destino: su DDL declaraba
`FOREIGN KEY (compania_origen_id, cuenta_destino_id) REFERENCES cuentas (compania_id, id)`,
que compara la compañía de **origen** con la cuenta de **destino** y por tanto
admite la cuenta destino de otra compañía. La corrección es una columna
`compania_destino_id` (denormalizada de `consolidaciones`) que hace la FK
compuesta correcta y conserva el estilo del esquema
(`UNIQUE (compania_id, id)` en `cuentas` y `centros_costos`).

## Endpoints que lo usan

| Endpoint | Tablas |
|---|---|
| `POST /api/consolidaciones`, `GET /api/consolidaciones/{id}` | `consolidacion_cuentas`, `consolidacion_centros` |
| `POST /api/consolidaciones/{id}/simular`, `POST /api/consolidaciones/{id}/ejecutar` | las mismas |

Bloque **D3** del plan (5 rutas; la cabecera y los orígenes son doble motor, las
homologaciones son solo PostgreSQL).

## Contraparte requerida en Advantage

`CONSOLID` **existe** pero es "Parcial": guarda la cabecera y los orígenes, y el
propio diccionario declara que le faltan las correspondencias. Pero al
implementar D3 se comprobó que la brecha es **mayor** que la homologación:
`CONSOLID` tiene **cuatro campos** (`CODIGO`, `NOMBRE`, `HIST`, `VALOR`,
`db/old_db/DICCIONARIO_DEPURADO_CONTABDSI.md`), **sin identidad numérica, sin año,
sin estado y sin orígenes**. Por eso **las cinco rutas de D3 responden 503
declarado** en Advantage (`backend/consolidacion_repository.py`), no solo las de
homologación. El plan las daba por "AMBOS" en cabecera y orígenes; el legado no da
para tanto.

Para paridad habría que ampliar `CONSOLID` (o crear tablas nuevas) con:

| Cambio propuesto | Equivale a |
|---|---|
| identidad, `anio`, `estado`, `compatibilidad`, `simulacion`, `respaldo_realizado`, `confirmacion_vaciado`, `ejecutado_por/en` | `consolidaciones` |
| una tabla hija de orígenes (compañía origen, incluida) | `consolidacion_origenes` |
| correspondencia cuenta origen → destino (compañía origen, código origen, código destino, signo) | `consolidacion_cuentas` |
| correspondencia centro origen → destino (compañía origen, código origen, código destino) | `consolidacion_centros` |

Como en el caso 15, la alternativa declarada es mantenerlo solo en PostgreSQL.
Además, el **algoritmo** de consolidación está pendiente de decisión
(`db/migration/03_plan_de_carga.md:156-162`): `POST /api/consolidaciones/{id}/ejecutar`
responde **503 declarado en los dos motores** por esa razón, no por el legado.
