# Modelo lógico neutro — Entidades (01)

Catálogo completo de las **60 entidades** de CONTABDSI en notación neutra.
Las columnas de auditoría estándar (`creado_en`, `creado_por`, `actualizado_en`,
`actualizado_por`, `version`) se omiten en cada tabla para legibilidad; están
definidas en [`00_convenciones.md`](00_convenciones.md#4-columnas-de-auditoría-todas-las-tablas-de-negocio).
Tipos: ver [`00_convenciones.md`](00_convenciones.md#2-tipos-lógicos).

Legenda de claves: **PK** clave primaria · **UK** unicidad · **FK** referencia →
`tabla_destino(campos)` · **CHECK** restricción declarativa.

---

## Módulo 1 — Núcleo (compañía, años, períodos, parámetros)

### 1. `companias` — empresas del sistema (equivale a la carpeta de empresa de VISION)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| codigo | texto | Código corto de la empresa, p. ej. `001` |
| nombre | texto | Razón social (legado CONCTR.CTCIA) |
| nit | texto | NIT sin dígito de verificación (CTNIT) |
| digito | texto | Dígito de verificación |
| estado | texto | CHECK: Activa, Inactiva |
| solo_consolidacion | booleano | Solo destino de consolidación (no opera) |

Claves: **UK** `(codigo)` · **UK** `(nit, digito)`.

### 2. `compania_anios` — años contables habilitados por compañía

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| anio | entero | CHECK: 1900–2999 |

Claves: **UK** `(compania_id, anio)`.

### 3. `periodos_contables` — períodos por compañía/año y su estado de cierre

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| anio | entero | CHECK: 1900–2999 |
| periodo | texto | CHECK: `00` (saldos iniciales), `01`–`12` (meses), `13`–`18` (ajustes) |
| nombre | texto | Etiqueta: "Febrero", "Saldos Iniciales"… |
| estado | texto | CHECK: Abierto, Cerrado. Un período Cerrado es de solo lectura |
| cerrado_por | entero | Usuario que cerró |
| cerrado_en | fecha_hora | Momento del cierre |

Claves: **UK** `(compania_id, anio, periodo)`.

### 4. `parametros_operacion` — parámetros de operación por compañía/año (PARAM_1 / DSIGRABA6)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| anio | entero | CHECK: 1900–2999 |
| nombre_empresa | texto | CONCTR.CTCIA |
| nit | texto | CTNIT |
| direccion | texto | CTDIRECC |
| ciudad | texto | CTCIUDAD |
| directorio_contabilidad | texto | CTDIREC |
| anio_operacion | texto | CTANO |
| contabilidad_conciliacion | texto | CTCLAVE1 |
| verifica_documentos_lotes | booleano | CTVERDOC (default true) |
| terceros_documentos_propios | booleano | CTTERDOC (default false) |
| controla_usuario_lotes | booleano | CTPUC (default true) |
| comentario_certificado | texto_libre | CTLEY1 |
| fecha_operativa | fecha | CTFCHOY |
| observacion | texto_libre | CTTOBS |
| documento | texto | CTDOCUM |
| leyenda2 | texto_libre | CTLEY2 |
| modo_retencion | texto | CHECK: retencion-a-base, base-a-retencion |
| periodos_habilitados | documento | Mapa CT00..CT12 → habilitado |

Claves: **UK** `(compania_id, anio)`.

### 5. `parametros_nomina` — parámetros de nómina (PARAMS_NOMI / DSIGRABA6_NOM)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| anio | entero | CHECK: 1900–2999 |
| comprobante_nomina | texto | CTCOMNOM1 |
| documento_nomina | texto | CTDOCNOM1 |
| comprobante_aportes | texto | CTCOMNOM2 |
| documento_aportes | texto | CTDOCNOM2 |
| comprobante_provisiones | texto | CTCOMNOM3 |
| documento_provisiones | texto | CTDOCNOM3 |

Claves: **UK** `(compania_id, anio)`.

---

## Módulo 2 — Maestros (plan de cuentas, terceros, catálogos contables)

### 6. `cuentas` — plan de cuentas jerárquico

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK (+ UK `(compania_id, id)`) |
| compania_id | id | FK → `companias(id)` |
| codigo | texto | p. ej. `510506` |
| nombre | texto | Denominación |
| nivel | entero | CHECK: 1, 2, 4, 6, 9, 12 |
| afectable | booleano | Acepta movimiento (default true) |
| controla_tercero | booleano | Exige tercero en movimiento |
| controla_centro | booleano | Exige centro de costo |
| controla_base | booleano | Exige base |
| ajuste | booleano | Solo admite período de ajuste |
| clase_iva | texto | CHECK: Generado, Descontable, nulo |
| clase_retencion | texto | CHECK: Renta, IVA, ICA, nulo |
| distribucion | texto | CHECK: Ninguna, Fija, Porcentaje |
| porcentaje | porcentaje | Factor de distribución (default 0) |
| cuenta_base_id | id | FK → `cuentas(id)` — cuenta base de distribución |
| saldo_inicial | dinero | Saldo inicial de la cuenta |
| parent_id | id | FK → `cuentas(id)` — jerarquía |
| path | texto | Ruta materializada `/1/5/51/5105/510506` |
| eliminado_en | fecha_hora | Borrado lógico |

Claves: **UK** `(compania_id, codigo)`. Restricción funcional: una cuenta con
hijas, saldo o movimiento no puede eliminarse.

### 7. `terceros` — clientes, proveedores, empleados, entidades

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK (+ UK `(compania_id, id)`) |
| compania_id | id | FK → `companias(id)` |
| zona | texto | Zona comercial |
| nit | texto | Número de identificación |
| digito | texto | Dígito de verificación |
| tipo_documento | texto | CHECK: NIT, CC, CE, … |
| nombre | texto | Razón social / nombre |
| tipo | texto | CHECK: Natural, Juridica |
| direccion | texto | Dirección física |
| telefono | texto | Teléfono |
| ciudad | texto | Ciudad |
| nit_relacionado | texto | NIT relacionado (matriz/holding) |
| correo | texto | Correo electrónico (FADCLI) |
| codigo_legado | texto | Identidad original del legado (RECNO/clave) |
| estado | texto | CHECK: Activo, Bloqueado |
| motivo_bloqueo | texto | Motivo del bloqueo |
| fecha_creacion | fecha | Fecha de creación |
| saldo | dinero | Saldo acumulado |
| cupo | dinero | Cupo de crédito |
| sexo | texto | CHECK: M, F, J, nulo |
| nacimiento | fecha | Fecha de nacimiento |
| estado_web | texto | CHECK: Activo, Inactivo |
| eliminado_en | fecha_hora | Borrado lógico |

Claves: **UK** `(compania_id, nit)`.

### 8. `tercero_etiquetas` — etiquetas libres por tercero

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| tercero_id | id | FK → `terceros(id)` ON DELETE CASCADE |
| etiqueta | texto | Etiqueta |

Claves: **UK** `(tercero_id, etiqueta)`.

### 9. `centros_costos` — centros de costo jerárquicos

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK (+ UK `(compania_id, id)`) |
| compania_id | id | FK → `companias(id)` |
| codigo | texto | p. ej. `ADM`, `VEN`, `OPE` |
| nombre | texto | Denominación |
| nivel | entero | Nivel jerárquico (default 1) |
| parent_id | id | FK → `centros_costos(id)` |
| eliminado_en | fecha_hora | Borrado lógico |

Claves: **UK** `(compania_id, codigo)`.

### 10. `comprobantes` — tipos de comprobante contable

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK (+ UK `(compania_id, id)`) |
| compania_id | id | FK → `companias(id)` |
| codigo | texto | p. ej. `CE`, `RC`, `CP` |
| nombre | texto | Denominación |
| activo | booleano | Habilitado (default true) |
| eliminado_en | fecha_hora | Borrado lógico |

Claves: **UK** `(compania_id, codigo)`.

### 11. `consecutivos_comprobantes` — consecutivo por comprobante/año (fila caliente)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| anio | entero | CHECK: 1900–2999 |
| comprobante_id | id | FK → `comprobantes(id)` |
| consecutivo_actual | entero_largo | Último asignado (default 1) |
| consecutivo_fin | entero_largo | Tope opcional del rango |

Claves: **UK** `(compania_id, anio, comprobante_id)`. Se actualiza en cada
contabilización: debe tolerar alta concurrencia (HOT/row-lock de motor).

### 12. `tipos_documento` — tipos documentales y numeración (VISDOCUM)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK (+ UK `(compania_id, id)`) |
| compania_id | id | FK → `companias(id)` |
| codigo | texto | p. ej. `NOM`, `FV`, `OR` |
| nombre | texto | Denominación |
| numeracion | texto | CHECK: Manual, Automatica |
| consecutivo | entero_largo | Consecutivo del tipo (default 1) |
| tercero_obligatorio | booleano | Exige tercero en el renglón |
| centro_obligatorio | booleano | Exige centro en el renglón |
| eliminado_en | fecha_hora | Borrado lógico |

Claves: **UK** `(compania_id, codigo)`.

### 13. `conceptos_retencion` — conceptos de retención en la fuente

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK (+ UK `(compania_id, id)`) |
| compania_id | id | FK → `companias(id)` |
| codigo | texto | Código del concepto |
| nombre | texto | Denominación |
| tarifa | porcentaje | Tarifa como fracción (default 0) |
| cuenta_id | id | FK → `cuentas(id)` — cuenta contable asociada |
| base_minima | dinero | Base mínima para aplicar (default 0) |
| eliminado_en | fecha_hora | Borrado lógico |

Claves: **UK** `(compania_id, codigo)`.

### 14. `tarifas_iva` — tarifas de IVA

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK (+ UK `(compania_id, id)`) |
| compania_id | id | FK → `companias(id)` |
| codigo | texto | p. ej. `IV19`, `IV05`, `IVE` |
| nombre | texto | Denominación |
| tarifa | porcentaje | Tarifa como fracción (default 0) |
| cuenta_id | id | FK → `cuentas(id)` |
| eliminado_en | fecha_hora | Borrado lógico |

Claves: **UK** `(compania_id, codigo)`.

### 15. `renglones_renta` — renglones de la declaración de renta

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| codigo | texto | Código del renglón |
| nombre | texto | Denominación |
| cuenta_id | id | FK → `cuentas(id)` |
| signo | entero | CHECK: -1, 1 — sentido del renglón |
| eliminado_en | fecha_hora | Borrado lógico |

Claves: **UK** `(compania_id, codigo)`.

### 16. `plantillas_contables` — plantillas de asiento (PLANTICO/GRABAPLA)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| codigo | texto | Código de plantilla |
| nombre | texto | Denominación |
| tipo_documento_id | id | FK → `tipos_documento(id)` |
| eliminado_en | fecha_hora | Borrado lógico |

Claves: **UK** `(compania_id, codigo)`.

### 17. `plantilla_lineas` — parejas de cuentas de la plantilla (NOM/DEB/CRE)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| plantilla_id | id | FK → `plantillas_contables(id)` ON DELETE CASCADE |
| orden | entero | Orden del renglón |
| cuenta_debito_id | id | FK → `cuentas(id)` — cuenta débito (DEB) |
| cuenta_credito_id | id | FK → `cuentas(id)` — cuenta crédito (CRE) |
| concepto | texto | Texto del renglón |

> El legado guarda PAREJAS de cuentas, no importes fijos: al usar la plantilla
> el usuario digita los valores y el sistema arma débito/crédito.

### 18. `formatos_documentales` — formatos de impresión de comprobantes

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| codigo | texto | Código del formato |
| nombre | texto | Denominación |
| comprobante_id | id | FK → `comprobantes(id)` |
| eliminado_en | fecha_hora | Borrado lógico |

Claves: **UK** `(compania_id, codigo)`.

### 19. `formato_elementos` — elementos visuales del formato (editor)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| formato_id | id | FK → `formatos_documentales(id)` ON DELETE CASCADE |
| tipo | texto | CHECK: Leyenda, Imagen, Rectangulo, Linea, CampoComprobante, CampoDocumento, CampoFecha, CampoTotal |
| contenido | texto | Texto/imagen del elemento |
| x, y | cantidad | Posición |
| ancho, alto | cantidad | Dimensiones |
| fuente | texto | Tipografía |
| orden | entero | Z-order |

---

## Módulo 3 — Movimientos (lotes, líneas, validaciones, libro)

### 20. `lotes` — lotes de captura contable

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK (+ UK `(compania_id, id)`) |
| compania_id | id | FK → `companias(id)` |
| anio | entero | CHECK: 1900–2999 |
| periodo | texto | CHECK: catálogo de períodos |
| codigo | texto | p. ej. `NOM2`, `CE-001` |
| nombre | texto | Denominación del lote |
| usuario_id | id | FK → `usuarios(id)` — responsable |
| origen | texto | CHECK: Manual, Excel, Nomina, Reembolso, … |
| origen_referencia | texto | Clave estable del origen (nombre de archivo/hash) |
| fecha | fecha | Fecha del lote |
| estado | texto | CHECK: catálogo `estado_lote` |
| comprobante_id | id | FK → `comprobantes(id)` |
| documento | texto | Documento propuesto (p. ej. `NOM-2026-02`) |
| idempotency_key | uuid | Previene doble envío |
| motivo | texto | Motivo de anulación/rechazo |

Claves: **UK** `(compania_id, anio, codigo)` · **UK** `(idempotency_key)` ·
**UK** `(compania_id, anio, origen_referencia)` · **FK** `(compania_id, anio, periodo)`
→ `periodos_contables(compania_id, anio, periodo)` (rechaza períodos inexistentes).

### 21. `lote_lineas` — renglones del lote (grilla editable)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| lote_id | id | FK → `lotes(id)` ON DELETE CASCADE |
| compania_id | id | FK → `companias(id)` (aislamiento) |
| numero_linea | entero | Orden dentro del lote |
| cuenta_id | id | FK `(compania_id, cuenta_id)` → `cuentas` |
| tercero_id | id | FK `(compania_id, tercero_id)` → `terceros` |
| centro_costo_id | id | FK `(compania_id, centro_costo_id)` → `centros_costos` |
| tipo_documento_id | id | FK `(compania_id, tipo_documento_id)` → `tipos_documento` |
| comprobante | texto | Código de comprobante (texto) |
| documento | texto | Documento del renglón |
| fecha | fecha | Fecha del movimiento |
| fecha_documento | fecha | TFECDOC — fecha del documento soporte |
| debito | dinero | CHECK: ≥ 0 |
| credito | dinero | CHECK: ≥ 0 |
| base | dinero | Base gravable |
| clase | texto | CHECK: IVA, Retencion, Otro, vacío |
| concepto_retencion_id | id | FK compuesta → `conceptos_retencion` (histórico) |
| tarifa_iva_id | id | FK compuesta → `tarifas_iva` (histórico) |
| documento_afectado | texto | Documento que afecta (consulta específica) |
| concepto | texto | Detalle del renglón |
| valor_moneda | dinero | TVALORUS — valor en moneda alterna |
| nit_alterno | texto | NITN — tercero alterno |
| archivo_origen | texto | TARCHI — procedencia |
| origen | texto | CHECK: catálogo `origen_lote` |

Claves: **UK** `(lote_id, numero_linea)` · **CHECK** `debito = 0 O credito = 0`
(un renglón nunca lleva los dos valores).

### 22. `lote_validaciones` — issues del centro de validación

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| lote_id | id | FK → `lotes(id)` ON DELETE CASCADE |
| linea_id | id | FK → `lote_lineas(id)` ON DELETE CASCADE (nulo si es global) |
| severidad | texto | CHECK: Error, Advertencia |
| ambito | texto | CHECK: Global, Documento, Comprobante, Linea |
| tipo | texto | Código del issue: `Tercero obligatorio`, `Descuadre`, … |
| mensaje | texto | Texto legible |
| campo | texto | Campo asociado: tercero, centro, cuenta… |
| resuelta | booleano | Marcada como resuelta (default false) |

### 23. `documentos` — comprobantes contabilizados (el libro mayor)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK (+ UK `(compania_id, id)`) |
| compania_id | id | FK → `companias(id)` |
| anio | entero | CHECK: 1900–2999 |
| comprobante_id | id | FK compuesta → `comprobantes` |
| numero | entero_largo | Consecutivo → `CE-000245` |
| documento | texto | p. ej. `NOM-2026-02` |
| tipo_documento_id | id | FK compuesta → `tipos_documento` (tipo en el libro) |
| fecha | fecha | Fecha contable |
| fecha_documento | fecha | Fecha del soporte |
| periodo | texto | CHECK: catálogo de períodos |
| tercero_id | id | FK compuesta → `terceros` |
| concepto | texto | Concepto general |
| estado | texto | CHECK: Contabilizado, Anulado |
| lote_id | id | FK compuesta → `lotes` (trazabilidad) |
| usuario_id | id | FK → `usuarios(id)` |
| idempotency_key | uuid | Previene doble contabilización |
| documento_original_id | id | FK → `documentos(id)` — original ↔ reversión |
| motivo_anulacion | texto | Motivo de la anulación |
| soporte_anulacion | texto | Soporte/acta de la anulación |

Claves: **UK** `(compania_id, anio, comprobante_id, numero)` · **UK**
`(idempotency_key)` · **regla de negocio**: UK parcial — un mismo documento
solo puede existir UNA vez en estado Contabilizado.

### 24. `documento_lineas` — renglones del libro (espejo histórico del lote)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| documento_id | id | FK → `documentos(id)` |
| compania_id | id | FK → `companias(id)` |
| numero_linea | entero | Orden |
| cuenta_id | id | FK compuesta → `cuentas` (obligatoria) |
| tercero_id | id | FK compuesta → `terceros` |
| centro_costo_id | id | FK compuesta → `centros_costos` |
| tipo_documento_id | id | FK compuesta → `tipos_documento` |
| debito / credito | dinero | CHECK: ≥ 0; no ambos a la vez |
| base | dinero | Base gravable |
| clase | texto | CHECK: IVA, Retencion, Otro, vacío |
| concepto_retencion_id | id | FK compuesta → `conceptos_retencion` |
| tarifa_iva_id | id | FK compuesta → `tarifas_iva` |
| fecha_documento | fecha | TFECDOC |
| valor_moneda | dinero | TVALORUS |
| nit_alterno | texto | NITN |
| documento_afectado | texto | Documento que afecta |
| concepto | texto | Detalle |
| archivo_origen | texto | TARCHI |
| origen | texto | CHECK: catálogo `origen_lote` |

Claves: **UK** `(documento_id, numero_linea)` · **CHECK** sin doble valor.
Inmutable: el libro no se edita; toda corrección es una anulación + nuevo asiento.

---

## Módulo 4 — Saldos y acumulados (derivados, regenerables)

### 25. `saldos_cuenta` — saldo por cuenta y período

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| anio | entero | CHECK: 1900–2999 |
| periodo | texto | CHECK: catálogo |
| cuenta_id | id | FK compuesta → `cuentas` |
| saldo_inicial | dinero | Saldo inicial del período |
| debito / credito | dinero | Movimientos del período |

Claves: **UK** `(compania_id, anio, periodo, cuenta_id)`.

### 26. `saldos_cuenta_tercero` — saldo por cuenta + tercero + período

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id, anio, periodo | — | Como en `saldos_cuenta` |
| cuenta_id | id | FK compuesta → `cuentas` |
| tercero_id | id | FK compuesta → `terceros` |
| debito / credito | dinero | Movimientos del período |

Claves: **UK** `(compania_id, anio, periodo, cuenta_id, tercero_id)`.

### 27. `saldos_cuenta_centro` — saldo por cuenta + centro + período

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id, anio, periodo | — | Como en `saldos_cuenta` |
| cuenta_id | id | FK compuesta → `cuentas` |
| centro_costo_id | id | FK compuesta → `centros_costos` |
| debito / credito | dinero | Movimientos del período |

Claves: **UK** `(compania_id, anio, periodo, cuenta_id, centro_costo_id)`.

### 28. `acumulados_tercero` — acumulado anual por tercero + cuenta

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id, anio | — | Como en `saldos_cuenta` |
| tercero_id | id | FK compuesta → `terceros` |
| cuenta_id | id | FK compuesta → `cuentas` |
| debito / credito | dinero | Acumulado anual |

Claves: **UK** `(compania_id, anio, tercero_id, cuenta_id)`.

### 29. `acumulados_centro` — acumulado anual por centro + cuenta

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id, anio | — | Como en `saldos_cuenta` |
| centro_costo_id | id | FK compuesta → `centros_costos` |
| cuenta_id | id | FK compuesta → `cuentas` |
| debito / credito | dinero | Acumulado anual |

Claves: **UK** `(compania_id, anio, centro_costo_id, cuenta_id)`.

### 30. `acumulados_retencion` — retención acumulada por tercero/concepto/período

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id, anio, periodo | — | Como en `saldos_cuenta` |
| tercero_id | id | FK compuesta → `terceros` |
| concepto_retencion_id | id | FK compuesta → `conceptos_retencion` |
| base | dinero | Base acumulada |
| valor | dinero | Retención acumulada |

Claves: **UK** `(compania_id, anio, periodo, tercero_id, concepto_retencion_id)`.

### 31. `acumulados_iva` — IVA acumulado por tercero/tarifa/período

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id, anio, periodo | — | Como en `saldos_cuenta` |
| tercero_id | id | FK compuesta → `terceros` |
| tarifa_iva_id | id | FK compuesta → `tarifas_iva` |
| base | dinero | Base acumulada |
| valor | dinero | IVA acumulado |

Claves: **UK** `(compania_id, anio, periodo, tercero_id, tarifa_iva_id)`.

### 32. `estado_acumulaciones` — último período acumulado por tipo

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| anio | entero | CHECK: 1900–2999 |
| tipo | texto | CHECK: Retencion, Iva, Terceros, Centros |
| periodo_hasta | texto | Último período acumulado |
| ultima_acumulacion | fecha_hora | Momento de la última acumulación |

Claves: **UK** `(compania_id, anio, tipo)`. La UI avisa si quedó desactualizada.

---

## Módulo 5 — Impuestos: medios magnéticos (información exógena)

### 33. `formatos_exogenos` — formatos de información exógena (1001, 1007, 2275…)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| codigo | texto | Código del formato |
| nombre | texto | Denominación |
| vigencia | entero | Año de vigencia |
| activo | booleano | Habilitado (default true) |
| eliminado_en | fecha_hora | Borrado lógico |

Claves: **UK** `(compania_id, codigo, vigencia)`.

### 34. `formato_conceptos` — conceptos de un formato (tarifa/cuenta)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| formato_id | id | FK → `formatos_exogenos(id)` ON DELETE CASCADE |
| codigo | texto | Código del concepto |
| nombre | texto | Denominación |
| tarifa | porcentaje | Tarifa (default 0) |
| cuenta_id | id | FK → `cuentas(id)` |

### 35. `formato_asignaciones` — cuentas del plan asignadas a un formato

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| formato_id | id | FK → `formatos_exogenos(id)` ON DELETE CASCADE |
| cuenta_id | id | FK → `cuentas(id)` |
| activo | booleano | Asignación activa (default true) |

Claves: **UK** `(formato_id, cuenta_id)`.

### 36. `generaciones_medios` — generaciones de medios por compañía/año

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| anio | entero | CHECK: 1900–2999 |
| numero_generacion | entero | Identidad de la generación (default 1) |
| parametros | documento | Parámetros de generación |
| estado | texto | CHECK: Generado, Revisado, Exportado |
| generado_por | entero | Usuario que generó |
| generado_en | fecha_hora | Momento de generación |

Claves: **UK** `(compania_id, anio, numero_generacion)`.
> `numero_generacion` identifica la generación por compañía/año; `version`
> (auditoría) es el control optimista. Son conceptos distintos.

### 37. `medio_filas` — filas del medio generado (revisión editable)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| generacion_id | id | FK → `generaciones_medios(id)` ON DELETE CASCADE |
| formato_id | id | FK → `formatos_exogenos(id)` |
| tercero_id | id | FK → `terceros(id)` |
| concepto_id | id | FK → `formato_conceptos(id)` |
| cuenta_id | id | FK → `cuentas(id)` |
| valor | dinero | Valor reportado |
| base | dinero | Base |
| ajustado | booleano | Fue ajustada en revisión |
| detalle | documento | Datos adicionales de la fila |

### 38. `medio_topes` — topes de depuración por formato/concepto

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| anio | entero | CHECK: 1900–2999 |
| formato_id | id | FK → `formatos_exogenos(id)` |
| concepto_id | id | FK → `formato_conceptos(id)` |
| tope | dinero | Tope para depuración |

Claves: **UK** `(compania_id, anio, formato_id, concepto_id)`.

### 39. `medio_conciliaciones` — conciliación de una generación

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| generacion_id | id | FK → `generaciones_medios(id)` ON DELETE CASCADE |
| total_contable | dinero | Total según contabilidad |
| exclusiones | dinero | Exclusiones |
| topes | dinero | Valor bajo topes |
| ajustes | dinero | Ajustes manuales |
| total_reportado | dinero | Total a reportar |
| cuadrado | booleano | total_contable − excl − topes + ajustes = reportado |

Claves: **UK** `(generacion_id)` — una conciliación por generación.

---

## Módulo 6 — Procesos (reprocesos, cierres, consolidación)

### 40. `procesos` — reprocesos, revalorizaciones y auditorías masivas

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| anio | entero | CHECK: 1900–2999 |
| tipo | texto | p. ej. Reproceso mensual, Revalorizacion |
| estado | texto | CHECK: Configurado, Simulado, Ejecutando, Completado, Fallido |
| alcance | documento | Parámetros del proceso |
| simulacion | documento | Resultado de la simulación |
| reporte_diferencias | documento | Diferencias detectadas |
| respaldo_realizado | booleano | Se tomó respaldo antes de ejecutar |
| resultado | documento | Resultado final |
| usuario_id | entero | Usuario responsable |

### 41. `cierres` — cierres contables (checklist + comprobante de cierre)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| anio | entero | CHECK: 1900–2999 |
| estado | texto | CHECK: Pendiente, Ejecutado, Anulado |
| checklist | documento | Conciliaciones, lotes, descuadres… |
| comprobante_id | id | FK → `comprobantes(id)` |
| cuenta_resultado_id | id | FK → `cuentas(id)` — cuenta de resultado |
| documento | texto | Documento generado |
| fecha | fecha | Fecha del cierre |
| usuario_id | entero | Usuario responsable |

### 42. `cierre_traslados` — traslados de períodos 13–18 a 01–06

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| cierre_id | id | FK → `cierres(id)` ON DELETE CASCADE |
| origen_periodo | texto | `13`–`18` |
| destino_periodo | texto | `01`–`06` |
| cuenta_id | id | FK → `cuentas(id)` |
| debito / credito | dinero | Valores trasladados |

### 43. `consolidaciones` — consolidación multiempresa

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_destino_id | id | FK → `companias(id)` — destino solo-consolidación |
| anio | entero | CHECK: 1900–2999 |
| estado | texto | CHECK: Configurado, Simulado, Ejecutado, Anulado |
| compatibilidad | documento | Diagnóstico de compatibilidad de planes |
| simulacion | documento | Resultado de simulación |
| respaldo_realizado | booleano | Respaldo previo |
| confirmacion_vaciado | booleano | Confirmación de vaciado del destino |
| ejecutado_por | entero | Usuario que ejecutó |
| ejecutado_en | fecha_hora | Momento de ejecución |

### 44. `consolidacion_origenes` — compañías origen de una consolidación

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| consolidacion_id | id | FK → `consolidaciones(id)` ON DELETE CASCADE |
| compania_origen_id | id | FK → `companias(id)` |
| incluida | booleano | Participa (default true) |

Claves: **UK** `(consolidacion_id, compania_origen_id)`.

---

## Módulo 7 — Seguridad (roles, permisos, usuarios, bitácora, integraciones)

### 45. `roles` — roles del sistema

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| codigo | texto | p. ej. `ADMIN`, `CONTADOR` |
| nombre | texto | Denominación |
| descripcion | texto | Detalle |

Claves: **UK** `(codigo)`.

### 46. `permisos` — permisos funcionales

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| codigo | texto | p. ej. `mov.lotes.aprobar` |
| nombre | texto | Denominación |
| modulo | texto | Módulo al que pertenece |

Claves: **UK** `(codigo)`.

### 47. `rol_permisos` — permisos por rol

| Campo | Tipo | Descripción |
|---|---|---|
| rol_id | id | FK → `roles(id)` ON DELETE CASCADE |
| permiso_id | id | FK → `permisos(id)` ON DELETE CASCADE |

Claves: **UK** `(rol_id, permiso_id)`.

### 48. `usuarios` — usuarios del sistema

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| nombre | texto | Nombre completo |
| email | texto | Correo (opcional) |
| rol_id | id | FK → `roles(id)` |
| iniciales | texto | Iniciales para sellos |
| activo | booleano | Habilitado (default true) |
| eliminado_en | fecha_hora | Borrado lógico |

Claves: **UK** `(email)`.

### 49. `auditoria` — bitácora de acciones sensibles (inmutable)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` (nulo si es global) |
| anio | entero | Año contable afectado |
| usuario_id | id | FK → `usuarios(id)` |
| rol_id | id | FK → `roles(id)` |
| accion | texto | p. ej. "Aprobación de lote" |
| modulo | texto | p. ej. "Lotes" |
| detalle | texto | Descripción |
| resultado | texto | CHECK: EXITO, FALLO, INFO |
| parametros | documento | Parámetros de la acción |
| impacto | documento | Tablas/registros afectados |
| motivo | texto | Motivo (si aplica) |
| creado_en | fecha_hora | Momento exacto (obligatorio) |

Regla: la bitácora es **append-only** — el sistema no permite UPDATE ni DELETE.

### 50. `integraciones` — sincronización con módulos externos

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| modulo | texto | p. ej. Facturacion, Cartera |
| estado | texto | CHECK: Conectado, Desconectado, Bloqueado |
| ultima_sincronizacion | fecha_hora | Última sincronización |
| configuracion | documento | Parámetros de conexión |

Claves: **UK** `(compania_id, modulo)`.

### 51. `usuario_companias` — acceso de usuarios a compañías (B14)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| usuario_id | id | FK → `usuarios(id)` ON DELETE CASCADE |
| compania_id | id | FK → `companias(id)` ON DELETE CASCADE |

Claves: **UK** `(usuario_id, compania_id)`.

---

## Módulo 8 — Presupuesto (feature flag, jerárquico)

### 52. `presupuestos` — presupuestos por compañía/año

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| anio | entero | CHECK: 1900–2999 |
| nombre | texto | Nombre del presupuesto |
| estado | texto | CHECK: Borrador, Aprobado |

Claves: **UK** `(compania_id, anio, nombre)`.

### 53. `presupuesto_rubros` — estructura Departamento → Grupo → Sección → Código

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| presupuesto_id | id | FK → `presupuestos(id)` ON DELETE CASCADE |
| departamento | texto | Nivel 1 |
| grupo | texto | Nivel 2 |
| seccion | texto | Nivel 3 |
| codigo | texto | Nivel 4 |
| nombre | texto | Concepto del rubro (B13) |
| concepto | texto | Detalle |
| centro_costo_id | id | FK → `centros_costos(id)` |
| parent_id | id | FK → `presupuesto_rubros(id)` — jerarquía |
| orden | entero | Orden de presentación |

Claves: **UK** `(presupuesto_id, codigo, centro_costo_id)`.

### 54. `presupuesto_valores` — valores por rubro/período (presupuesto o ejecución)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| rubro_id | id | FK → `presupuesto_rubros(id)` ON DELETE CASCADE |
| periodo | texto | CHECK: `00`–`13` |
| tipo | texto | CHECK: Presupuesto, Ejecucion |
| valor | dinero | Valor del período |

Claves: **UK** `(rubro_id, periodo, tipo)`.

---

## Módulo 9 — Ampliaciones (bancos, reembolsos, activos fijos)

### 55. `tercero_cuentas_bancarias` — cuentas bancarias de terceros (ADMCUENTA)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK compuesta → `terceros` |
| tercero_id | id | FK compuesta → `terceros(compania_id, id)` |
| tipo | texto | CHECK: Ahorros, Corriente, Otro |
| numero | texto | Número — texto para preservar ceros iniciales |
| principal | booleano | Cuenta principal |
| observacion | texto | Notas |

### 56. `reembolsos` — reembolsos de caja menor (REEMBOL01)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| anio | entero | CHECK: 1900–2999 |
| numero | texto | Número del reembolso |
| fecha | fecha | Fecha |
| periodo | texto | CHECK: catálogo |
| tercero_id | id | FK compuesta → `terceros` |
| caja_menor | texto | Caja menor origen |
| estado | texto | CHECK: Borrador, Aplicado, Anulado |
| lote_id | id | Lote generado al aplicar |
| usuario_id | id | FK → `usuarios(id)` |

### 57. `reembolso_lineas` — detalle del reembolso

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| reembolso_id | id | FK → `reembolsos(id)` ON DELETE CASCADE |
| compania_id | id | FK → `companias(id)` |
| numero_linea | entero | Orden |
| cuenta_id | id | FK compuesta → `cuentas` |
| centro_costo_id | id | FK compuesta → `centros_costos` |
| concepto | texto | Detalle |
| debito / credito | dinero | CHECK: ≥ 0, no ambos |
| documento_soporte | texto | Documento que soporta el gasto |

Claves: **CHECK** sin doble valor.

### 58. `activos` — activos fijos y amortizables (INTEACT2/INTEACT3)

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| compania_id | id | FK → `companias(id)` |
| codigo | texto | Código del activo |
| nombre | texto | Denominación |
| tipo | texto | CHECK: Activo, Amortizable |
| cuenta_activo_id | id | FK compuesta → `cuentas` — cuenta del activo |
| cuenta_gasto_id | id | FK compuesta → `cuentas` — gasto depreciación |
| cuenta_depreciacion_id | id | FK compuesta → `cuentas` — depreciación acumulada |
| costo | dinero | Costo de adquisición |
| vida_util_meses | entero | Vida útil en meses |
| valor_residual | dinero | Valor residual |
| fecha_adquisicion | fecha | Fecha de compra |
| fecha_baja | fecha | Fecha de retiro |
| estado | texto | CHECK: Activo, Baja, Totalmente depreciado |

Claves: **UK** `(compania_id, codigo)`.

### 59. `activo_cuotas` — cuota mensual de depreciación por activo

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| activo_id | id | FK → `activos(id)` ON DELETE CASCADE |
| anio | entero | CHECK: 1900–2999 |
| periodo | texto | CHECK: catálogo |
| valor | dinero | Valor de la cuota |
| aplicada | booleano | ¿Ya generó asiento? |
| lote_id | id | Lote que la aplicó |

Claves: **UK** `(activo_id, anio, periodo)`.

### 60. `activo_distribuciones` — distribución de la depreciación por centro

| Campo | Tipo | Descripción |
|---|---|---|
| id | id | PK |
| activo_id | id | FK → `activos(id)` ON DELETE CASCADE |
| compania_id | id | FK compuesta → `centros_costos` |
| centro_costo_id | id | FK compuesta → `centros_costos(compania_id, id)` |
| porcentaje | porcentaje | Participación del centro |

Claves: **UK** `(activo_id, centro_costo_id)`.
