# CONTABDSI — Diccionario de datos Advantage ADS (db/advantage)

Advantage Database Server (ADS) es el motor de **ORIGEN** del legado
VISION/FORTUNER: tablas ADT/DBF con diccionarios de datos `.ADD`, agrupadas en
**carpetas por empresa** (CONCTR, DSIGRABA6, PARAMS_NOMI, VISDOCUM, PLANTICO,
ADMCUENTA, REEMBOL01, INTEACT2/3…). El modelo nuevo no se despliega sobre ese
esquema por-empresa; esta carpeta documenta el **diccionario de datos
equivalente** del modelo lógico neutro para dos usos:

1. **Instalaciones que permanezcan en ADS** (requisito del cliente): punto de
   partida para crear un diccionario `.ADD` nuevo con la estructura del modelo
   CONTABDSI, revisado previamente con Advantage Data Architect.
2. **Guía del ETL de migración**: el mismo diccionario documenta, tipo por
   tipo, cómo leer el legado ADS (AUTOINC, CHARACTER/VARCHAR con ancho, MEMO,
   NUMERIC, DATE, TIMESTAMP, LOGICAL) y cómo traducirlo al modelo nuevo.

## 1. Relación con `general/` y `postgresql/`

```
db/general/    → fuente de verdad: 60 entidades, tipos lógicos, convenciones
                 e índices independientes de motor. Nada aquí es sintaxis ADS.
db/postgresql/ → implementación PostgreSQL 18 completa y VALIDADA (referencia
                 de columnas, defaults, constraints e índices reales).
db/advantage/  → traducción documentada del mismo modelo a un diccionario ADS
                 equivalente. NO es ejecutable tal cual: los scripts siguen el
                 DDL de Data Architect / ADS SQL y deben revisarse contra la
                 versión concreta de ADS antes de crear el diccionario.
```

- Los archivos de `advantage/` no son una copia del diccionario legado por
  empresa: modelan el **esquema único** del modelo nuevo (una tabla por
  entidad para todas las compañías, aislamiento con `compania_id`), tal como
  lo hacen `general/` y `postgresql/`.
- Las columnas y defaults de `01_tablas.sql` se verificaron contra
  `db/postgresql/schema/*.sql` (ground truth); los tipos se traducen según
  `db/general/mapeo_motores.md`.
- `03_reglas_negocio.md`, `02_indices.md` y `01_entidades.md` de `general/`
  explican el porqué de cada CHECK, FK, UK e índice que aquí aparece solo
  como comentario (ADS no los declara).

## 2. Limitaciones honestas de ADS para este modelo

| Limitación de ADS | Impacto en el modelo | Cómo se resuelve en este diccionario |
|---|---|---|
| `AUTOINC` de 32 bits (~2 147 M) | `id` de tablas de alto volumen (`documentos`, `documento_lineas`, `lote_lineas`, `saldos_*`) puede agotarse en décadas de operación intensa | Se usa `AUTOINC` igual que en el legado; si un contrato proyecta acercarse al límite, la secuencia pasa a manejarse en el servicio (con transacción y bloqueo de registro) |
| Sin entero de 64 bits | `entero_largo` (consecutivos) no tiene tipo nativo exacto | Decisión de esta guía: **`INTEGER`** para todos los consecutivos (volumen contable real ≪ 2^31). `DOUBLE` queda descartado (IEEE 754 no es seguro para exactitud). Si un contrato exige 64 bits: `VARCHAR(18)` numérico o dos `INTEGER` alto/bajo asignados por el servicio. Ver comentarios en `documentos.numero`, `consecutivos_comprobantes` y `tipos_documento.consecutivo` |
| `MONEY` no usado | — | Todo importe es `NUMERIC(18,2)` explícito (contrato monetario idéntico a PostgreSQL; `MONEY` trae 4 decimales internos y redondeos de motor) |
| Sin CHECK declarativos | Catálogos cerrados (`estado IN (…)`), `debito = 0 OR credito = 0`, rangos, importes ≥ 0 | Se documentan como comentario al pie de cada tabla; los valida el **servicio** (dominio en la capa de datos) |
| Sin FK declarativas | Referencias simples y compuestas `(compania_id, id)` | Se documentan como comentario ("FK lógica"); la integridad y el aislamiento entre compañías los valida el servicio; las UK compuestas `(compania_id, id)` se crean como `UNIQUE INDEX` en `02_indices.sql` para que el motor sí impida mezclar compañías |
| Sin índices parciales | UK "un documento Contabilizado por nombre" e índice del filtro de clase IVA/Retención | Emulación con **columna derivada** mantenida por servicio o trigger (`documentos.documento_estado`, ver `01_tablas.sql` y `02_indices.sql`); para el filtro de clase, índice completo `(clase, cuenta_id)` |
| JSON (`documento`) | `jsonb` no existe | `MEMO` con JSON serializado; validación sintáctica en el servicio; sin consultas JSON dentro del motor |
| `fecha_hora` | `timestamptz` | `TIMESTAMP` sin zona horaria: el servicio normaliza (hora del contrato/UTC) |
| `uuid` | Claves de idempotencia | `CHARACTER(36)` **sin default de motor**: el servicio genera el UUID antes del INSERT |
| Auditoría | Columnas + trigger genérico | ADS sí soporta **triggers de tabla en el diccionario** (se definen en Data Architect, no hay DDL SQL portable): replicar `auditoria_antes_update/insert` de PostgreSQL (sellar `actualizado_en`, avanzar `version`, fijar `creado_en`). Alternativa equivalente: hacerlo en el servicio. `auditoria` (append-only) se protege con permisos del diccionario y política del servicio |
| Transacciones | Contabilización atómica, consecutivos sin huecos | ADS **sí ofrece transacciones** (`BEGIN`/`COMMIT` con bloqueo por registro nativo): la secuencia de contabilización del servicio corre dentro de una transacción, igual que en PostgreSQL |

> Los `CHARACTER(n)` de ADS rellenan con espacios (artefactos en comparaciones
> y UK); por eso esta guía usa `VARCHAR(n)` para todo el texto. El diccionario
> legado conserva sus campos Character originales; el ETL los lee y recorta.

## 3. Archivos de esta carpeta

| Archivo | Contenido |
|---|---|
| `01_tablas.sql` | Las **60 tablas** en `CREATE TABLE` (orden de módulos de `general/01_entidades.md`), tipos ADS, defaults, y CHECK/FK lógicos como comentarios |
| `02_indices.sql` | PK, UK de negocio, UK de aislamiento `(compania_id, id)` e índices de consulta como `CREATE [UNIQUE] INDEX`, con la emulación de las UK parciales |

Verificación esperada: `grep -c '^CREATE TABLE' db/advantage/01_tablas.sql` → 60.

## 4. Conclusión

El modelo nuevo se implementa en **PostgreSQL 18** (`db/postgresql/`) o en el
motor que exija el contrato, siempre traducido desde `db/general/`. **Advantage
NO debe elegirse como destino nuevo** salvo requisito explícito del cliente
(instalaciones que conservan módulos ADT del legado, integración en sitio,
cláusula contractual): elegir ADS implica asumir las limitaciones de la
sección 2 y que la integridad referencial, los catálogos y la cuadratura se
validan en el servicio, no en el motor.
