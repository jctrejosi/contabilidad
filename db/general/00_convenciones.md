# Modelo lógico neutro — Convenciones (00)

Este documento define el vocabulario del **modelo lógico neutro** de CONTABDSI:
la fuente de verdad del diseño de datos, **independiente de cualquier motor**.
Las implementaciones por motor (`postgresql/`, `advantage/`, futuro `mysql/`…)
traducen estas convenciones; ningún archivo de `general/` contiene sintaxis
propietaria de un SGBD.

## 1. Principios estructurales

| Principio | Regla |
|---|---|
| **Esquema único** | Una sola tabla por entidad para todas las compañías. El aislamiento entre empresas se hace con `compania_id` en cada tabla, no con un esquema/carpeta por compañía (como hacía VISION). |
| **Claves compuestas de aislamiento** | Las FK de línea→maestro son compuestas `(compania_id, id)`. Impide a nivel de motor que una línea de la empresa 001 referencie una cuenta de la 002. |
| **Nomenclatura español** | Tablas en plural (`cuentas`, `lotes`), campos en singular (`nombre`, `fecha`), claves `*_id`. |
| **Identificadores** | `id` numérico autoincremental por tabla (PK). Las claves de negocio se protegen con restricciones de unicidad compuestas `(compania_id, …)`. |
| **Auditoría en toda fila** | Columnas `creado_en`, `creado_por`, `actualizado_en`, `actualizado_por`, `version` (control optimista de concurrencia). Un disparador genérico avanza `version` y sella `actualizado_en` en cada UPDATE. |
| **Borrado lógico en maestros** | Maestros editables llevan `eliminado_en` en lugar de DELETE físico; las restricciones impiden eliminar entidades con dependencias. |
| **Estados como texto enumerado** | `estado` es texto + lista cerrada de valores (CHECK), nunca tipos enumerados nativos (más portables y migrables). |
| **Derivados regenerables** | Los saldos y acumulados se derivan del libro (`documentos`/`documento_lineas`) y se reconstruyen con un proceso de regeneración; jamás se editan a mano. |
| **Idempotencia** | Todo lote y documento lleva una clave de idempotencia (UUID) y una referencia de origen única `(compania_id, anio, origen_referencia)` para que un mismo archivo/operación no se cargue dos veces. |

## 2. Tipos lógicos

Los tipos del modelo neutro (columna `modelo`) se traducen por motor en
[`mapeo_motores.md`](mapeo_motores.md).

| Tipo lógico | Semántica | Regla de uso |
|---|---|---|
| `id` | Identificador entero de 64 bits, autoincremental | PK de todas las tablas |
| `texto` | Cadena de longitud variable | Códigos, nombres, documentos, NIT |
| `texto(n)` | Cadena con longitud máxima `n` | Cuando el legado define un ancho fijo |
| `texto_libre` | Texto largo sin límite práctico (memo/CLOB) | Conceptos, observaciones, JSON serializado |
| `entero` | Entero de 32 bits | Años, períodos numéricos, niveles, órdenes |
| `entero_largo` | Entero de 64 bits | Consecutivos, contadores grandes |
| `dinero` | Decimal exacto de 18 dígitos, 2 decimales | **Todo** importe monetario. Prohibido float/double |
| `porcentaje` | Decimal de 9 dígitos, 6 decimales; fracción (19 % = 0.190000) | Tarifas de IVA, retención, distribución |
| `cantidad` | Decimal de 18 dígitos, 4 decimales | Cantidades/tarifas auxiliares no monetarias |
| `fecha` | Fecha de calendario sin hora | Fechas de documento, vencimientos |
| `fecha_hora` | Marca de tiempo con zona horaria | Auditoría, sincronizaciones |
| `booleano` | Verdadero/falso | Flags, habilitaciones |
| `uuid` | Identificador universal (36 caracteres) | Claves de idempotencia |
| `documento` | Documento estructurado (JSON) | Parámetros flexibles, simulaciones, checklists |

### Catálogos cerrados de valores (CHECK lógicos)

- `estado_lote`: Borrador, Con errores, Verificado, Pendiente aprobacion, Aprobado, Contabilizando, Contabilizado, Fallido, Anulado
- `estado_documento`: Contabilizado, Anulado
- `estado_periodo`: Abierto, Cerrado
- `periodo`: 00 (saldos iniciales), 01–12 (meses), 13–18 (ajustes)
- `estado_compania`: Activa, Inactiva
- `severidad_validacion`: Error, Advertencia
- `clase_linea`: IVA, Retencion, Otro, (vacío)
- `numeracion`: Manual, Automatica
- `origen_lote`: Manual, Excel, Nomina, Reembolso, (extensible)
- `resultado_auditoria`: EXITO, FALLO, INFO
- `nivel_cuenta`: 1, 2, 4, 6, 9, 12
- `distribucion_cuenta`: Ninguna, Fija, Porcentaje
- `tipo_acumulacion`: Retencion, Iva, Terceros, Centros

## 3. Notación de claves y restricciones

En [`01_entidades.md`](01_entidades.md) cada entidad declara:

- **PK** — clave primaria (siempre `id`; además `UK (compania_id, id)` cuando otras tablas la referencian por FK compuesta).
- **UK** — unicidad de negocio (los nombres de restricción se forman `<tabla>_<motivo>_uk`).
- **FK** — referencias `tabla_destino (campos)`, con regla de borrado (`RESTRICT` por defecto; `CASCADE` en detalles y catálogos intermedios).
- **CHECK** — catálogos cerrados y reglas de integridad declarativas (`debito = 0 O credito = 0`, `debito >= 0`, etc.).

El orden lógico de creación (respetar dependencias) es el de los módulos:

```
Núcleo → Maestros → Movimientos → Saldos → Impuestos → Procesos →
Seguridad (agrega FKs hacia lotes/documentos) → Presupuesto → Ampliaciones
```

## 4. Columnas de auditoría (todas las tablas de negocio)

| Campo | Tipo lógico | Descripción |
|---|---|---|
| `creado_en` | `fecha_hora` | Momento de creación (nulo si lo setea el disparador) |
| `creado_por` | `entero` | Usuario que creó |
| `actualizado_en` | `fecha_hora` | Sellado por el disparador de auditoría |
| `actualizado_por` | `entero` | Usuario que modificó |
| `version` | `entero` | Concurrencia optimista; el disparador la incrementa |

> Nota: `companias`, `usuarios`, `roles` y tablas globales de seguridad no
> llevan `compania_id` (son transversales). Las tablas de detalles puros
> (`plantilla_lineas`, `formato_elementos`, …) heredan el aislamiento por la
> FK a su cabecera y pueden omitir `compania_id` propio cuando nunca se
> consultan fuera de ese contexto.
