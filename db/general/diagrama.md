# Modelo lógico neutro — Diagrama entidad-relación

Complemento visual de [`01_entidades.md`](01_entidades.md), la fuente de verdad del diseño de datos: **las 60 entidades se muestran aquí únicamente con sus relaciones; los campos, tipos, UK, CHECK y reglas de cada una están en `01_entidades.md`**. No hay ninguna sintaxis propietaria de SGBD (ver [`00_convenciones.md`](00_convenciones.md)).

## Notas de lectura

- **Nueve diagramas, uno por módulo.** Las entidades llevan su nombre de tabla exacto, en minúsculas (igual que en los SQL). Cada bloque dibuja las relaciones internas del módulo y las relaciones con entidades de otros módulos que las declaran (p. ej. Movimientos referencia Maestros, Núcleo y Seguridad).
- **Aislamiento omitido para legibilidad.** El esquema es único y cada tabla lleva `compania_id`; las FK de línea → maestro son compuestas `(compania_id, id)`. El diagrama las dibuja como relaciones lógicas simples y *no* repite la arista genérica `compania_id` hacia `companias` en cada módulo: se dibuja solo en el Módulo 1 y, fuera de él, cuando es la única relación de la entidad (`estado_acumulaciones`, `procesos`, `integraciones`) o cuando la FK tiene significado de negocio propio (consolidaciones destino/origen, auditoría global, acceso de `usuario_companias`).
- **Cardinalidad estándar de Mermaid**: `||` exactamente uno · `|o` cero o uno · `o{` cero o más · `|{` uno o más · `o|` cero o uno. El símbolo del lado de cada entidad describe cuántas filas de *esa* entidad participan por cada fila de la otra (p. ej. `companias ||--o{ compania_anios`: cada año habilitado pertenece exactamente a una compañía; una compañía tiene cero o más años habilitados).
- **Relaciones etiquetadas** cuando hay ambigüedad o más de una relación entre la misma pareja: jerarquías por `parent_id`, `cuenta_base_id`, reversión `documento_original_id`, consolidación origen/destino, y las tres cuentas distintas que puede referenciar `activos`.
- **Sin atributos** salvo las claves mínimas de las cuatro entidades más centrales (`companias`, `cuentas`, `lotes`, `documentos`).

Módulos y cobertura:

| Módulo | Entidades |
|---|---|
| 1 Núcleo | `companias`, `compania_anios`, `periodos_contables`, `parametros_operacion`, `parametros_nomina` |
| 2 Maestros | `cuentas`, `terceros`, `tercero_etiquetas`, `centros_costos`, `comprobantes`, `consecutivos_comprobantes`, `tipos_documento`, `conceptos_retencion`, `tarifas_iva`, `renglones_renta`, `plantillas_contables`, `plantilla_lineas`, `formatos_documentales`, `formato_elementos` |
| 3 Movimientos | `lotes`, `lote_lineas`, `lote_validaciones`, `documentos`, `documento_lineas` |
| 4 Saldos | `saldos_cuenta`, `saldos_cuenta_tercero`, `saldos_cuenta_centro`, `acumulados_tercero`, `acumulados_centro`, `acumulados_retencion`, `acumulados_iva`, `estado_acumulaciones` |
| 5 Impuestos | `formatos_exogenos`, `formato_conceptos`, `formato_asignaciones`, `generaciones_medios`, `medio_filas`, `medio_topes`, `medio_conciliaciones` |
| 6 Procesos | `procesos`, `cierres`, `cierre_traslados`, `consolidaciones`, `consolidacion_origenes` |
| 7 Seguridad | `roles`, `permisos`, `rol_permisos`, `usuarios`, `auditoria`, `integraciones`, `usuario_companias` |
| 8 Presupuesto | `presupuestos`, `presupuesto_rubros`, `presupuesto_valores` |
| 9 Ampliaciones | `tercero_cuentas_bancarias`, `reembolsos`, `reembolso_lineas`, `activos`, `activo_cuotas`, `activo_distribuciones` |

## Módulo 1 — Núcleo

Los años habilitados, períodos y parámetros cuelgan directamente de `companias`. `periodos_contables` es referenciado a su vez por `lotes` (Módulo 3) con la FK compuesta `(compania_id, anio, periodo)`.

```mermaid
erDiagram
  companias {
    id id PK
    texto codigo
    texto nit
    texto estado
  }

  companias ||--o{ compania_anios : "anios habilitados por compania"
  companias ||--o{ periodos_contables : "periodos 00 a 18 por anio contable"
  companias ||--o{ parametros_operacion : "parametros de operacion por compania y anio"
  companias ||--o{ parametros_nomina : "parametros de nomina por compania y anio"
```

## Módulo 2 — Maestros

Catálogos del plan de cuentas, terceros, centros de costo, comprobantes, tipos documentales e impresos. `cuentas` es autorreferenciada dos veces: por `parent_id` (jerarquía del plan) y por `cuenta_base_id` (distribución); `centros_costos` por `parent_id`. `tipos_documento`, `comprobantes`, `cuentas` y `terceros` son referenciados por los módulos de movimiento, saldos, impuestos, procesos y ampliaciones (ver esos diagramas).

```mermaid
erDiagram
  cuentas {
    id id PK
    entero compania_id FK
    texto codigo
    id parent_id FK
    id cuenta_base_id FK
  }

  cuentas |o--o{ cuentas : "jerarquia del plan, parent_id"
  cuentas |o--o{ cuentas : "distribucion de la cuenta, cuenta_base_id"
  terceros ||--o{ tercero_etiquetas : "etiquetas libres del tercero"
  centros_costos |o--o{ centros_costos : "jerarquia de centros, parent_id"
  comprobantes ||--o{ consecutivos_comprobantes : "consecutivo por comprobante y anio"
  comprobantes ||--o{ formatos_documentales : "formato de impresion del comprobante"
  formatos_documentales ||--o{ formato_elementos : "elementos visuales del formato"
  tipos_documento ||--o{ plantillas_contables : "tipo documental de la plantilla"
  plantillas_contables ||--o{ plantilla_lineas : "lineas de la plantilla"
  cuentas ||--o{ plantilla_lineas : "cuenta debito, cuenta_debito_id"
  cuentas ||--o{ plantilla_lineas : "cuenta credito, cuenta_credito_id"
  cuentas ||--o{ conceptos_retencion : "cuenta contable asociada al concepto"
  cuentas ||--o{ tarifas_iva : "cuenta contable asociada a la tarifa"
  cuentas ||--o{ renglones_renta : "cuenta del renglon de renta"
```

## Módulo 3 — Movimientos

El ciclo de captura (lotes y sus líneas validables) y el libro mayor (documentos contabilizados). Referencia Núcleo (`periodos_contables`), Maestros (`cuentas`, `terceros`, `centros_costos`, `comprobantes`, `tipos_documento`, `conceptos_retencion`, `tarifas_iva`) y Seguridad (`usuarios`). En los renglones, tercero y centro son opcionales según los flags `controla_tercero`/`controla_centro` de la cuenta, y concepto de retención/tarifa de IVA solo se llenan según la `clase` del renglón; las FK a esos maestros son compuestas `(compania_id, id)`. `documento_original_id` enlaza un comprobante con su reversión (nulo en el original).

```mermaid
erDiagram
  lotes {
    id id PK
    entero compania_id FK
    texto codigo
    texto estado
  }
  documentos {
    id id PK
    entero compania_id FK
    entero_largo numero
    id lote_id FK
    id documento_original_id FK
  }

  periodos_contables ||--o{ lotes : "periodo del lote, FK compania_id + anio + periodo"
  comprobantes ||--o{ lotes : "comprobante del lote"
  usuarios ||--o{ lotes : "usuario responsable, usuario_id"
  lotes ||--o{ lote_lineas : "renglones del lote"
  cuentas ||--o{ lote_lineas : "FK compuesta compania_id + cuenta_id"
  terceros |o--o{ lote_lineas : "FK compuesta, opcional"
  centros_costos |o--o{ lote_lineas : "FK compuesta, opcional"
  tipos_documento ||--o{ lote_lineas : "tipo documental del renglon"
  conceptos_retencion |o--o{ lote_lineas : "solo renglones de retencion"
  tarifas_iva |o--o{ lote_lineas : "solo renglones de iva"
  lotes ||--o{ lote_validaciones : "issues del centro de validacion"
  lote_lineas |o--o{ lote_validaciones : "issue de linea, nulo si es global"
  lotes ||--o{ documentos : "lote de origen, trazabilidad"
  comprobantes ||--o{ documentos : "FK compuesta compania_id + comprobante_id"
  tipos_documento ||--o{ documentos : "tipo documental en el libro"
  terceros ||--o{ documentos : "tercero del documento"
  usuarios ||--o{ documentos : "usuario que contabilizo"
  documentos |o--o{ documentos : "reversion, documento_original_id"
  documentos ||--|{ documento_lineas : "renglones del libro mayor"
  cuentas ||--o{ documento_lineas : "FK compuesta compania_id + cuenta_id, obligatoria"
  terceros |o--o{ documento_lineas : "FK compuesta, opcional"
  centros_costos |o--o{ documento_lineas : "FK compuesta, opcional"
  tipos_documento ||--o{ documento_lineas : "tipo documental del renglon"
  conceptos_retencion |o--o{ documento_lineas : "solo renglones de retencion"
  tarifas_iva |o--o{ documento_lineas : "solo renglones de iva"
```

## Módulo 4 — Saldos y acumulados

Tablas derivadas y regenerables: se reconstruyen desde `documento_lineas` (libro mayor, Módulo 3) con procesos de regeneración y no llevan FK entre sí. Solo referencian maestros por FK compuesta. `estado_acumulaciones` registra el último período acumulado por compañía/año/tipo y su única FK es `companias` (aislamiento); es uno de los pocos casos en que esa arista se dibuja fuera del Módulo 1.

```mermaid
erDiagram
  cuentas ||--o{ saldos_cuenta : "FK compuesta compania_id + cuenta_id"
  cuentas ||--o{ saldos_cuenta_tercero : "FK compuesta compania_id + cuenta_id"
  terceros ||--o{ saldos_cuenta_tercero : "FK compuesta compania_id + tercero_id"
  cuentas ||--o{ saldos_cuenta_centro : "FK compuesta compania_id + cuenta_id"
  centros_costos ||--o{ saldos_cuenta_centro : "FK compuesta compania_id + centro_costo_id"
  terceros ||--o{ acumulados_tercero : "acumulado anual por tercero"
  cuentas ||--o{ acumulados_tercero : "acumulado anual por cuenta"
  centros_costos ||--o{ acumulados_centro : "acumulado anual por centro"
  cuentas ||--o{ acumulados_centro : "acumulado anual por cuenta"
  terceros ||--o{ acumulados_retencion : "retencion acumulada por tercero"
  conceptos_retencion ||--o{ acumulados_retencion : "concepto de retencion"
  terceros ||--o{ acumulados_iva : "iva acumulado por tercero"
  tarifas_iva ||--o{ acumulados_iva : "tarifa de iva"
  companias ||--o{ estado_acumulaciones : "unica relacion, por compania y anio"
```

## Módulo 5 — Impuestos (información exógena)

`formatos_exogenos` define los formatos (1001, 1007, 2275…) con sus conceptos y asignaciones de cuentas; `generaciones_medios` produce los medios por compañía/año. Una generación tiene muchas filas editables y a lo sumo una conciliación. `medio_filas` y `medio_topes` referencian además a Maestros (`cuentas`, `terceros`).

```mermaid
erDiagram
  formatos_exogenos ||--o{ formato_conceptos : "conceptos del formato"
  formatos_exogenos ||--o{ formato_asignaciones : "cuentas asignadas al formato"
  cuentas ||--o{ formato_conceptos : "cuenta del concepto"
  cuentas ||--o{ formato_asignaciones : "cuenta asignada"
  generaciones_medios ||--o{ medio_filas : "filas del medio generado"
  generaciones_medios ||--o| medio_conciliaciones : "una conciliacion por generacion"
  formatos_exogenos ||--o{ medio_filas : "formato de la fila"
  formato_conceptos ||--o{ medio_filas : "concepto de la fila"
  cuentas ||--o{ medio_filas : "cuenta de la fila"
  terceros |o--o{ medio_filas : "tercero de la fila, opcional"
  formatos_exogenos ||--o{ medio_topes : "topes de depuracion por formato"
  formato_conceptos ||--o{ medio_topes : "topes de depuracion por concepto"
```

## Módulo 6 — Procesos

Reprocesos, cierres y consolidación. `consolidaciones` apunta a la compañía destino (`compania_destino_id`, compañía de solo consolidación) y `consolidacion_origenes` lista las compañías origen participantes; por eso `companias` aparece aquí con sus dos aristas de negocio. `cierres` referencia `comprobantes` (comprobante de cierre) y `cuentas` (cuenta de resultado).

```mermaid
erDiagram
  companias ||--o{ procesos : "unica relacion, por compania y anio"
  comprobantes ||--o{ cierres : "comprobante de cierre"
  cuentas ||--o{ cierres : "cuenta de resultado del cierre"
  cierres ||--o{ cierre_traslados : "traslados de periodos 13 a 18 hacia 01 a 06"
  cuentas ||--o{ cierre_traslados : "cuenta trasladada"
  companias ||--o{ consolidaciones : "compania destino de la consolidacion"
  consolidaciones ||--o{ consolidacion_origenes : "companias origen de la consolidacion"
  companias ||--o{ consolidacion_origenes : "compania origen participante"
```

## Módulo 7 — Seguridad

Roles, permisos, usuarios y bitácora. `usuario_companias` y `integraciones` son los otros casos en que la FK a `companias` es relación de negocio (acceso del usuario a compañías; conexiones externas por compañía). `auditoria` referencia `companias` con nulo posible cuando el evento es global.

```mermaid
erDiagram
  roles ||--o{ rol_permisos : "permisos asignados al rol"
  permisos ||--o{ rol_permisos : "roles que tienen el permiso"
  roles ||--o{ usuarios : "rol del usuario"
  companias |o--o{ auditoria : "compania_id, nulo si es global"
  usuarios ||--o{ auditoria : "usuario que ejecuto la accion"
  roles ||--o{ auditoria : "rol al momento de la accion"
  companias ||--o{ integraciones : "modulos externos por compania"
  usuarios ||--o{ usuario_companias : "companias a las que accede"
  companias ||--o{ usuario_companias : "usuarios con acceso a la compania"
```

## Módulo 8 — Presupuesto

Presupuestos por compañía/año con rubros jerárquicos (Departamento → Grupo → Sección → Código, vía `parent_id`) ligados a centros de costo, y valores por rubro y período.

```mermaid
erDiagram
  presupuestos ||--o{ presupuesto_rubros : "rubros del presupuesto"
  presupuesto_rubros |o--o{ presupuesto_rubros : "jerarquia de rubros, parent_id"
  centros_costos ||--o{ presupuesto_rubros : "centro de costo del rubro"
  presupuesto_rubros ||--o{ presupuesto_valores : "valores por rubro y periodo"
```

## Módulo 9 — Ampliaciones

Bancos de terceros, reembolsos de caja menor y activos fijos. `reembolsos` referencia Maestros (`terceros`, FK compuesta), Seguridad (`usuarios`) y, al aplicar, genera un `lote` (`lote_id` nulo hasta entonces). `activos` referencia tres cuentas distintas del plan; `activo_cuotas` es aplicada por un `lote` opcional y `activo_distribuciones` reparte la depreciación por centros de costo.

```mermaid
erDiagram
  terceros ||--o{ tercero_cuentas_bancarias : "FK compuesta compania_id + tercero_id"
  terceros ||--o{ reembolsos : "tercero del reembolso, FK compuesta"
  lotes |o--o{ reembolsos : "lote generado al aplicar, lote_id"
  usuarios ||--o{ reembolsos : "usuario responsable"
  reembolsos ||--o{ reembolso_lineas : "detalle del reembolso"
  cuentas ||--o{ reembolso_lineas : "FK compuesta compania_id + cuenta_id"
  centros_costos ||--o{ reembolso_lineas : "FK compuesta compania_id + centro_costo_id"
  cuentas ||--o{ activos : "cuenta del activo, cuenta_activo_id"
  cuentas ||--o{ activos : "cuenta de gasto, cuenta_gasto_id"
  cuentas ||--o{ activos : "depreciacion acumulada, cuenta_depreciacion_id"
  activos ||--o{ activo_cuotas : "cuotas mensuales de depreciacion"
  lotes |o--o{ activo_cuotas : "lote que aplico la cuota, lote_id"
  activos ||--o{ activo_distribuciones : "distribucion de depreciacion por centros"
  centros_costos ||--o{ activo_distribuciones : "FK compuesta compania_id + centro_costo_id"
```
