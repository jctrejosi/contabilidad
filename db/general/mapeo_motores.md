# Modelo lógico neutro — Mapeo por motor

Traducción de los tipos lógicos ([`00_convenciones.md`](00_convenciones.md))
y de las garantías del modelo a cada motor implementado. El modelo neutro en
`general/` es la fuente de verdad; estas tablas son la guía de traducción de
cada carpeta de motor.

## 1. Tipos de dato

| Tipo lógico | PostgreSQL 18 | Advantage ADS (diccionario .ADD) |
|---|---|---|
| `id` (auto 64 bits) | `bigint GENERATED ALWAYS AS IDENTITY` | `AUTOINC` (entero de 32 bits — ver límite ⚠) |
| `entero` (32 bits) | `integer` | `INTEGER` |
| `entero_largo` (64 bits) | `bigint` | `DOUBLE`* (ver nota ⚠) |
| `texto` (variable) | `text` | `VARCHAR(n)` (n según el ancho del legado) |
| `texto(n)` (ancho fijo) | `varchar(n)` | `CHARACTER(n)` |
| `texto_libre` | `text` | `MEMO` |
| `dinero` (18,2 exacto) | `numeric(18,2)` | `NUMERIC(18,2)` |
| `porcentaje` (9,6 fracción) | `numeric(9,6)` | `NUMERIC(9,6)` |
| `cantidad` (18,4) | `numeric(18,4)` | `NUMERIC(18,4)` |
| `fecha` | `date` | `DATE` |
| `fecha_hora` | `timestamptz` | `TIMESTAMP` |
| `booleano` | `boolean` | `LOGICAL` |
| `uuid` | `uuid` | `CHARACTER(36)` (generado por el servicio) |
| `documento` (JSON) | `jsonb` | `MEMO` con JSON serializado (validación en el servicio) |

⚠ **Limitaciones Advantage a considerar antes de elegirlo como destino:**

- `AUTOINC` es de 32 bits (máx. ~2 100 M). Para `documentos`, `lotes` o
  `documento_lineas` con volumen alto, conviene secuencia propia en `DOUBLE`
  o `VARCHAR` manejada por el servicio con transacción.
- No hay tipo entero de 64 bits: `DOUBLE` (IEEE 754) **no es seguro** para
  contadores de exactitud estricta; alternativa: dos `INTEGER`
  (alto/bajo) o `VARCHAR(18)` numérico.
- `MONEY` existe (moneda de 8 bytes) pero con 4 decimales internos y
  redondeos de motor; se prefiere `NUMERIC(18,2)` explícito para que el
  contrato monetario del modelo sea idéntico en todos los motores.
- PostgreSQL cubre `jsonb`, índices parciales, CHECK declarativos y
  transacciones con bloqueo de fila nativo; Advantage exige emular
  (validación en servicio + tablas auxiliares). Ver §3.

## 2. Nomenclatura y estructura

| Aspecto | Regla común | PostgreSQL | Advantage |
|---|---|---|---|
| Nombres | Español, plural de tablas, minúsculas | `cuentas` | Igual (respetando mayúsculas si el diccionario lo exige) |
| Aislamiento | Esquema único + `compania_id` | Sin esquemas por cliente; índices compuestos | Sin esquemas por cliente; filtra por `compania_id` (Rights/Scope del DD opcional) |
| Claves | `id` + UK de negocio `(compania_id, …)` | Constraints reales | Índices únicos (las UK declarativas se modelan como `UNIQUE INDEX`) |
| Estados | `texto` + lista cerrada | `CHECK` | Sin CHECK declarativo → validación en servicio + dominio en la capa de datos |
| Audit | Columnas + disparador genérico | Trigger PL/pgSQL | Trigger de diccionario (ADS soporta triggers de tabla en el DD) o servicio |
| Borrado lógico | `eliminado_en` | Convención | Convención |
| FK compuestas | `(compania_id, id)` | Constraint compuesto | Sin FK declarativas → integridad en servicio + índices |

## 3. Garantías del modelo y su traducción

| Garantía del modelo neutro | PostgreSQL | Advantage ADS |
|---|---|---|
| Cuadratura de línea (débito XOR crédito) | `CHECK (debito = 0 OR credito = 0)` | Validación en servicio (el DD no declara CHECK) |
| Importes no negativos | `CHECK (col >= 0)` | Validación en servicio |
| Un documento Contabilizado por nombre (UK parcial) | `CREATE UNIQUE INDEX … WHERE estado='Contabilizado'` | Índice único sobre columna derivada (p. ej. `nombre_estado` = documento ‖ estado), mantenida por el servicio/trigger |
| Consecutivos sin huecos ni duplicados | Fila bloqueada `FOR UPDATE` | Bloqueo de registro (RESTART/UPDATE dentro de transacción); ADS bloquea por registro nativamente |
| Idempotencia de origen (un archivo una vez) | UK `(compania, anio, origen_referencia)` | Índice único equivalente |
| Reversión con efecto neto cero | Función `anular_documento` + upsert de saldos | Servicio: misma secuencia dentro de transacción |
| Acumulados regenerables | Función `regenerar_acumulados` | Servicio: mismo recorrido sobre el libro |

## 4. Motores futuros (referencia rápida, no implementados)

| Tipo lógico | MySQL 8 | SQL Server |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | `BIGINT IDENTITY(1,1)` |
| `dinero` | `DECIMAL(18,2)` | `DECIMAL(18,2)` |
| `porcentaje` | `DECIMAL(9,6)` | `DECIMAL(9,6)` |
| `fecha_hora` | `DATETIME(6)` | `DATETIME2` |
| `booleano` | `TINYINT(1)` (o `BOOLEAN` alias) | `BIT` |
| `uuid` | `CHAR(36)` / `BINARY(16)` | `UNIQUEIDENTIFIER` |
| `documento` | `JSON` (desde 5.7) | `NVARCHAR(MAX)` + `ISJSON` / `JSON` (2022) |
| UK parcial | No soportada → columna derivada | Índice único filtrado |

> **Advantage no es destino de la migración de VISION/FORTUNER**: es el motor
> de ORIGEN. La carpeta `advantage/` documenta el diccionario equivalente para
> despliegues que conserven ADS (instalaciones nuevas sobre el mismo motor),
> pero el proyecto nuevo implementa el modelo completo en PostgreSQL
> (`postgresql/`) o en el motor que el contrato exija, siempre traducido desde
> `general/`.
