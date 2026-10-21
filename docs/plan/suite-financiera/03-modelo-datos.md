# 03 — Modelo de datos

## 1. Principios

1. **Un solo clúster PostgreSQL** y una base por ambiente. Los módulos se separan
   en esquemas lógicos, no en bases distintas.
2. **`compania_id` obligatorio** en toda entidad transaccional y en los maestros
   que son por compañía.
3. **Importes exactos:** `NUMERIC(18,2)` para moneda; `NUMERIC(18,8)` para tasas;
   `NUMERIC(9,6)` para porcentajes. Prohibido `float`.
4. **Auditoría por fila:** `created_at`, `created_by`, `updated_at`, `updated_by`,
   `version` (concurrencia optimista).
5. **Borrado lógico solo en maestros** (`deleted_at`); los documentos
   contabilizados no se borran.
6. **Estados con `CHECK`** y transiciones validadas en el servicio.
7. **Claves naturales únicas** por compañía (código de cuenta, NIT, número de
   documento, secuencia).
8. **Sin saldos editables:** los saldos son vistas o tablas derivadas,
   reconstruibles desde el libro.

## 2. Esquemas lógicos

| Esquema | Dueño | Contenido |
|---|---|---|
| `core` | `core` | Compañías, periodos, monedas, tasas, secuencias, bloqueos, outbox |
| `mst` | `maestros` | PUC, terceros, centros, diarios, tipos de documento, condiciones |
| `led` | `ledger` | Asientos, líneas, lotes, conciliaciones contables |
| `inv` | `invoicing` | Facturas, notas, líneas, impuestos, referencias, DIAN |
| `ar` | `receivables` | CxC, recibos, aplicaciones, cobro |
| `ap` | `payables` | CxP, pagos, propuestas, retenciones, anticipos |
| `bnk` | `banking` | Cuentas, extractos, líneas, conciliación, caja |
| `ast` | `assets` | Categorías, activos, depreciaciones, bajas |
| `bgt` | `budgeting` | Versiones, líneas, control, compromisos |
| `tax` | `taxes` | Impuestos, posiciones, retenciones, exógena, medios |
| `rpt` | `reporting` | Definiciones, ejecuciones, snapshots |
| `cls` | `closing` | Cierres, aperturas, consolidación, eliminaciones |
| `sec` | `security` | Usuarios, roles, permisos, auditoría |
| `intg` | `integrations` | Conectores, ejecuciones, webhooks |

> Implementación: si el costo de mover las tablas actuales a esquemas es alto, se
> conserva `public` con prefijos y se mantiene la propiedad lógica por módulo.
> Lo que no se negocia es que cada tabla tenga un único módulo dueño.

## 3. Catálogo de entidades

### 3.1 `core`

| Tabla | Campos clave |
|---|---|
| `core.compania` | `id`, `codigo`, `nit`, `dv`, `razon_social`, `regimen`, `moneda_funcional`, `pais`, `departamento`, `municipio`, `direccion`, `estado`, `chart_template` |
| `core.compania_anio` | `compania_id`, `anio`, `fecha_inicio`, `fecha_fin`, `estado` |
| `core.periodo` | `compania_id`, `anio`, `mes` (1–12, 13–18 ajuste), `fecha_inicio`, `fecha_fin`, `estado` |
| `core.moneda` | `codigo` ISO, `nombre`, `simbolo`, `decimales`, `estado` |
| `core.tasa_cambio` | `compania_id`, `moneda_origen`, `moneda_destino`, `fecha`, `tasa`, `fuente`, único por fecha/par |
| `core.secuencia` | `compania_id`, `tipo`, `prefijo`, `resolucion`, `rango_desde`, `rango_hasta`, `siguiente`, `vigencia_desde`, `vigencia_hasta`, `estado` |
| `core.bloqueo` | `compania_id`, `tipo` (fiscal/impuestos/ventas/compras/duro), `fecha`, `motivo`, `usuario_id` |
| `core.outbox` | `id`, `evento`, `payload`, `estado`, `intentos`, `disponible_en`, `procesado_en` |
| `core.parametro` | `compania_id`, `clave`, `valor`, `tipo`, `vigencia`, `version` |

### 3.2 `mst` (maestros)

| Tabla | Campos clave |
|---|---|
| `mst.cuenta` | `compania_id`, `codigo`, `nombre`, `naturaleza` (D/C), `tipo`, `nivel`, `padre_id`, `afectable`, `requiere_tercero`, `requiere_centro`, `requiere_base`, `tipo_fiscal`, `estado` |
| `mst.tercero` | `id`, `tipo_persona`, `tipo_documento`, `nit`, `dv`, `razon_social`, `nombres`, `regimen`, `responsabilidades`, `direccion`, `municipio`, `contacto`, `condicion_pago_id`, `cupo`, `estado` |
| `mst.tercero_cuenta_bancaria` | `tercero_id`, `banco`, `tipo_cuenta`, `numero`, `moneda`, `estado` |
| `mst.centro` | `compania_id`, `codigo`, `nombre`, `padre_id`, `tipo`, `estado` |
| `mst.diario` | `compania_id`, `codigo`, `nombre`, `tipo`, `secuencia_id`, `cuenta_contrapartida_id`, `estado` |
| `mst.tipo_documento` | `codigo`, `nombre`, `modulo`, `naturaleza`, `prefijo`, `diario_default_id`, `contabiliza`, `flujo`, `tipo_dian`, `estado` |
| `mst.condicion_pago` | `codigo`, `nombre`, `dias`, `cuotas`, `estado` |
| `mst.producto` | `codigo`, `nombre`, `tipo` (servicio/bien), `impuesto_id`, `cuenta_ingreso_id`, `precio`, `estado` |

### 3.3 `led` (libro)

| Tabla | Campos clave |
|---|---|
| `led.asiento` | `id`, `compania_id`, `numero`, `fecha`, `periodo_id`, `diario_id`, `tipo_documento_id`, `moneda`, `tasa`, `descripcion`, `tercero_id`, `estado`, `origen_tipo`, `origen_id`, `idempotency_key`, `hash`, `reversal_of_id`, `posted_at`, `posted_by` |
| `led.asiento_linea` | `asiento_id`, `linea`, `cuenta_id`, `tercero_id`, `centro_id`, `debito`, `credito`, `debito_moneda`, `credito_moneda`, `base`, `impuesto_id`, `retencion_id`, `documento_ref`, `vencimiento`, `conciliado` |
| `led.lote` | `id`, `compania_id`, `codigo`, `descripcion`, `estado`, `origen`, `creado_por` |
| `led.lote_linea` | `lote_id`, `linea`, `cuenta_id`, `tercero_id`, `centro_id`, `debito`, `credito`, `base`, `impuesto_id`, `documento_ref`, `errores` |
| `led.saldo_cuenta` | `compania_id`, `periodo_id`, `cuenta_id`, `saldo_inicial`, `debitos`, `creditos`, `saldo_final` (derivada) |
| `led.saldo_tercero` | `compania_id`, `periodo_id`, `cuenta_id`, `tercero_id`, `saldo` (derivada) |
| `led.saldo_centro` | `compania_id`, `periodo_id`, `cuenta_id`, `centro_id`, `saldo` (derivada) |
| `led.asiento_relacion` | `asiento_id`, `relacionado_id`, `tipo` (reversión, intercompañía, ajuste) |

### 3.4 `inv` (facturación)

| Tabla | Campos clave |
|---|---|
| `inv.documento` | `id`, `compania_id`, `tipo` (FV/FC/NC/ND), `numero`, `prefijo`, `tercero_id`, `fecha`, `vencimiento`, `moneda`, `tasa`, `condicion_pago_id`, `estado`, `subtotal`, `impuestos`, `total`, `saldo`, `diario_id`, `asiento_id`, `reversal_of_id`, `motivo` |
| `inv.documento_linea` | `documento_id`, `linea`, `producto_id`, `descripcion`, `cantidad`, `precio_unitario`, `descuento`, `base`, `impuesto_id`, `impuesto_valor`, `retencion_id`, `retencion_valor`, `cuenta_id`, `centro_id` |
| `inv.documento_impuesto` | `documento_id`, `impuesto_id`, `base`, `valor`, `tipo` |
| `inv.documento_referencia` | `documento_id`, `referencia_id`, `tipo` (nota crédito/débito, factura) |
| `inv.documento_vencimiento` | `documento_id`, `cuota`, `fecha`, `importe` |
| `inv.dian_documento` | `documento_id`, `cufe`, `xml`, `estado`, `codigo_respuesta`, `mensaje`, `fecha_envio`, `fecha_respuesta`, `intentos` |
| `inv.dian_resolucion` | `compania_id`, `numero`, `prefijo`, `rango_desde`, `rango_hasta`, `vigencia_desde`, `vigencia_hasta`, `estado` |

### 3.5 `ar` (cartera)

| Tabla | Campos clave |
|---|---|
| `ar.cxc` | `id`, `compania_id`, `documento_id`, `tercero_id`, `cuenta_id`, `fecha`, `vencimiento`, `moneda`, `importe_original`, `saldo`, `estado`, `asiento_id` |
| `ar.recibo` | `id`, `compania_id`, `numero`, `tercero_id`, `fecha`, `moneda`, `tasa`, `medio_pago`, `cuenta_bancaria_id`, `total`, `estado`, `asiento_id` |
| `ar.aplicacion_pago` | `recibo_id`, `cxc_id`, `importe`, `fecha`, `estado` |
| `ar.gestion_cobro` | `cxc_id`, `nivel`, `fecha`, `canal`, `resultado`, `promesa_fecha`, `promesa_importe`, `usuario_id` |
| `ar.castigo` | `cxc_id`, `fecha`, `importe`, `motivo`, `asiento_id` |
| `ar.promesa` | `cxc_id`, `fecha_promesa`, `importe`, `estado`, `usuario_id` |
| `ar.anticipo` | `tercero_id`, `fecha`, `importe`, `saldo`, `moneda`, `estado` |

### 3.6 `ap` (CxP)

| Tabla | Campos clave |
|---|---|
| `ap.cxp` | `id`, `compania_id`, `documento_id`, `tercero_id`, `cuenta_id`, `fecha`, `vencimiento`, `moneda`, `importe_original`, `saldo`, `estado`, `asiento_id` |
| `ap.pago` | `id`, `compania_id`, `numero`, `tercero_id`, `fecha`, `moneda`, `tasa`, `medio_pago`, `cuenta_bancaria_id`, `total`, `estado`, `asiento_id` |
| `ap.aplicacion_pago` | `pago_id`, `cxp_id`, `importe`, `fecha`, `estado` |
| `ap.propuesta_pago` | `id`, `compania_id`, `fecha_corte`, `estado`, `total`, `aprobada_por`, `aprobada_en` |
| `ap.propuesta_linea` | `propuesta_id`, `cxp_id`, `importe`, `seleccionada` |
| `ap.retencion` | `documento_id`, `cxp_id`, `concepto_id`, `base`, `valor`, `certificado_numero`, `estado` |
| `ap.anticipo` | `tercero_id`, `fecha`, `importe`, `saldo`, `documento_id`, `estado` |
| `ap.gasto` | `id`, `compania_id`, `tercero_id`, `fecha`, `moneda`, `total`, `estado`, `aprobado_por` |
| `ap.gasto_linea` | `gasto_id`, `cuenta_id`, `centro_id`, `descripcion`, `base`, `impuesto_id`, `total` |
| `ap.prioridad` | `compania_id`, `tercero_id`, `cuenta_id`, `prioridad`, `vigencia` |

### 3.7 `bnk` (bancos)

| Tabla | Campos clave |
|---|---|
| `bnk.cuenta_bancaria` | `compania_id`, `banco`, `tipo_cuenta`, `numero`, `moneda`, `cuenta_contable_id`, `estado`, `saldo_inicial` |
| `bnk.extracto` | `id`, `compania_id`, `cuenta_bancaria_id`, `fecha_desde`, `fecha_hasta`, `saldo_inicial`, `saldo_final`, `estado`, `archivo_hash` |
| `bnk.extracto_linea` | `extracto_id`, `linea`, `fecha`, `referencia`, `descripcion`, `debito`, `credito`, `saldo`, `estado` |
| `bnk.conciliacion` | `extracto_linea_id`, `asiento_linea_id`, `importe`, `diferencia`, `estado`, `usuario_id`, `fecha` |
| `bnk.regla` | `compania_id`, `nombre`, `condicion`, `accion`, `prioridad`, `estado` |
| `bnk.transferencia` | `origen_id`, `destino_id`, `fecha`, `importe`, `estado`, `asiento_id` |
| `bnk.cheque` | `cuenta_bancaria_id`, `numero`, `beneficiario`, `importe`, `estado`, `asiento_id` |
| `bnk.caja` | `compania_id`, `codigo`, `nombre`, `responsable_id`, `estado` |
| `bnk.caja_movimiento` | `caja_id`, `fecha`, `tipo`, `importe`, `concepto`, `asiento_id` |

### 3.8 `ast` (activos)

| Tabla | Campos clave |
|---|---|
| `ast.categoria` | `compania_id`, `codigo`, `nombre`, `metodo`, `vida_util_meses`, `vida_fiscal_meses`, `cuenta_activo_id`, `cuenta_depreciacion_id`, `cuenta_gasto_id`, `valor_residual_pct` |
| `ast.activo` | `id`, `compania_id`, `codigo`, `descripcion`, `categoria_id`, `fecha_adquisicion`, `costo`, `valor_residual`, `centro_id`, `tercero_id`, `documento_id`, `estado`, `asiento_id` |
| `ast.depreciacion` | `activo_id`, `periodo_id`, `cuota`, `depreciacion_acumulada`, `estado`, `asiento_id` |
| `ast.baja` | `activo_id`, `fecha`, `motivo`, `valor_venta`, `resultado`, `asiento_id` |
| `ast.revaluacion` | `activo_id`, `fecha`, `valor_nuevo`, `asiento_id` |
| `ast.deterioro` | `activo_id`, `fecha`, `importe`, `asiento_id` |
| `ast.activo_componente` | `activo_id`, `componente_id`, `valor`, `vida_util_meses`, `cuenta_id` |
| `ast.mejora` | `activo_id`, `fecha`, `importe`, `descripcion`, `asiento_id` |
| `ast.depreciacion_fiscal` | `activo_id`, `periodo_id`, `cuota`, `acumulada`, `estado` |

### 3.9 `bgt` (presupuesto)

| Tabla | Campos clave |
|---|---|
| `bgt.presupuesto` | `id`, `compania_id`, `anio`, `version`, `escenario`, `estado`, `aprobado_por`, `aprobado_en` |
| `bgt.linea` | `presupuesto_id`, `cuenta_id`, `centro_id`, `periodo_id`, `importe`, `moneda` |
| `bgt.control` | `presupuesto_id`, `modo` (ninguno/avisar/bloquear), `umbral_pct` |
| `bgt.compromiso` | `presupuesto_id`, `documento_id`, `importe`, `estado` |
| `bgt.ejecucion` | Vista materializada: presupuesto vs. real vs. compromiso |
| `bgt.alerta` | `presupuesto_id`, `cuenta_id`, `centro_id`, `periodo_id`, `umbral`, `estado`, `silenciada_hasta` |

### 3.10 `tax` (impuestos)

| Tabla | Campos clave |
|---|---|
| `tax.impuesto` | `codigo`, `nombre`, `tipo` (IVA/retención/ICA/otro), `tarifa`, `base_tipo`, `cuenta_id`, `grupo_id`, `vigencia_desde`, `vigencia_hasta`, `estado` |
| `tax.grupo` | `codigo`, `nombre`, `tipo` |
| `tax.etiqueta` | `codigo`, `nombre`, `reporte_linea` |
| `tax.posicion_fiscal` | `codigo`, `nombre`, `pais`, `regimen`, `mapeos` |
| `tax.concepto_retencion` | `codigo`, `nombre`, `tipo`, `base`, `tarifa`, `base_minima`, `cuenta_id`, `codigo_dian`, `estado` |
| `tax.uvt` | `anio`, `valor`, `vigencia_desde`, `vigencia_hasta` |
| `tax.calendario` | `compania_id`, `anio`, `mes`, `obligacion`, `fecha_limite`, `estado` |
| `tax.exogena_formato` | `codigo`, `nombre`, `version`, `estado` |
| `tax.exogena_concepto` | `formato_id`, `codigo`, `nombre`, `tipo`, `estado` |
| `tax.exogena_asignacion` | `formato_id`, `concepto_id`, `cuenta_id`, `signo` |
| `tax.exogena_generacion` | `compania_id`, `anio`, `formato_id`, `estado`, `hash` |
| `tax.exogena_fila` | `generacion_id`, `concepto_id`, `tercero_id`, `base`, `valor`, `estado` |
| `tax.exogena_conciliacion` | `generacion_id`, `concepto`, `valor_libro`, `valor_formato`, `diferencia` |
| `tax.media_generacion` | `compania_id`, `anio`, `formato_id`, `estado`, `hash` |
| `tax.media_fila` | `generacion_id`, `linea`, `datos`, `estado` |
| `tax.media_tope` | `compania_id`, `concepto`, `valor` |
| `tax.dian_evento` | `documento_id`, `tipo`, `fecha`, `detalle` |
| `tax.responsabilidad` | `codigo`, `nombre`, `tipo`, `vigencia`, `estado` |
| `tax.ica_tarifa` | `municipio`, `actividad`, `tarifa`, `vigencia` |
| `tax.reporte` | `codigo`, `nombre`, `tipo`, `definicion`, `version` |
| `tax.certificado` | `compania_id`, `tercero_id`, `periodo_id`, `tipo`, `numero`, `base`, `valor`, `hash` |

### 3.11 `rpt` (informes)

| Tabla | Campos clave |
|---|---|
| `rpt.reporte` | `codigo`, `nombre`, `tipo`, `parametros`, `version` |
| `rpt.ejecucion` | `reporte_id`, `compania_id`, `parametros`, `usuario_id`, `inicio`, `fin`, `estado` |
| `rpt.snapshot` | `ejecucion_id`, `hash`, `firmado_por`, `fecha`, `estado` |
| `rpt.snapshot_linea` | `snapshot_id`, `linea`, `cuenta_id`, `tercero_id`, `centro_id`, `valores` |
| `rpt.mapeo_niif` | `compania_id`, `anio`, `cuenta_id`, `rubro`, `version`, `estado` |

### 3.12 `cls` (cierres)

| Tabla | Campos clave |
|---|---|
| `cls.cierre` | `compania_id`, `anio`, `mes`, `tipo`, `estado`, `checklist`, `ejecutado_por`, `ejecutado_en` |
| `cls.cierre_linea` | `cierre_id`, `concepto`, `debito`, `credito`, `asiento_id` |
| `cls.apertura` | `compania_id`, `anio`, `estado`, `asiento_id` |
| `cls.consolidacion` | `compania_destino_id`, `anio`, `periodo_id`, `estado`, `hash` |
| `cls.consolidacion_origen` | `consolidacion_id`, `compania_origen_id`, `estado` |
| `cls.homologacion_cuenta` | `consolidacion_id`, `cuenta_origen_id`, `cuenta_destino_id` |
| `cls.homologacion_centro` | `consolidacion_id`, `centro_origen_id`, `centro_destino_id` |
| `cls.eliminacion` | `consolidacion_id`, `tipo`, `debito`, `credito`, `referencia` |

### 3.13 `sec` (seguridad)

| Tabla | Campos clave |
|---|---|
| `sec.usuario` | `id`, `login`, `nombre`, `email`, `estado`, `ultimo_acceso` |
| `sec.rol` | `codigo`, `nombre`, `estado` |
| `sec.permiso` | `modulo`, `accion`, `codigo` |
| `sec.rol_permiso` | `rol_id`, `permiso_id` |
| `sec.usuario_compania` | `usuario_id`, `compania_id`, `rol_id` |
| `sec.sesion` | `usuario_id`, `token_hash`, `inicio`, `fin`, `ip` |
| `sec.auditoria` | `id`, `fecha`, `usuario_id`, `compania_id`, `modulo`, `entidad`, `entidad_id`, `accion`, `antes`, `despues`, `motivo`, `request_id`, `hash_anterior`, `hash` |

> `sec.auditoria` es append-only: sin `UPDATE` ni `DELETE`; el hash encadena la
> fila anterior para detectar manipulación.

### 3.14 `intg` (integraciones)

| Tabla | Campos clave |
|---|---|
| `intg.conector` | `codigo`, `tipo`, `config`, `estado` |
| `intg.ejecucion` | `conector_id`, `inicio`, `fin`, `estado`, `resumen`, `error` |
| `intg.mapeo` | `conector_id`, `origen`, `destino`, `regla` |
| `intg.webhook` | `conector_id`, `evento`, `url`, `secreto_hash`, `estado` |
| `intg.api_key` | `usuario_id`, `hash`, `scopes`, `estado`, `expira` |
| `intg.archivo` | `conector_id`, `nombre`, `hash`, `estado`, `fecha`, `error` |

## 4. Estados

### 4.1 Documento de facturación

```text
borrador → validado → contabilizado → (pagado_parcial) → pagado
                                  ↘ revertido
borrador → anulado
```

- `anulado` solo desde `borrador`.
- Un documento contabilizado no se edita ni se borra; se revierte.
- Las notas crédito/débito nacen contabilizadas o en borrador y referencian el
  documento original.

### 4.2 Asiento

```text
borrador → contabilizado → revertido
```

### 4.3 Partida abierta (CxC/CxP)

```text
abierta → parcial → pagada
       ↘ castigada
       ↘ revertida
```

### 4.4 Pago / recibo

```text
registrado → aplicado → conciliado
           ↘ revertido
```

### 4.5 Activo fijo

```text
borrador → activo → totalmente_depreciado
                 ↘ dado_de_baja
                 ↘ revaluado / deteriorado
```

### 4.6 Presupuesto y cierre

```text
presupuesto: borrador → aprobado → cerrado
cierre:      pendiente → en_proceso → ejecutado → anulado
consolidación: configurada → simulada → ejecutada → anulada
```

### 4.7 DIAN

```text
pendiente → generado → enviado → aceptado
                             ↘ rechazado
                             ↘ contingencia
```

## 5. Invariantes

| ID | Invariante |
|---|---|
| I-01 | Todo asiento contabilizado cuadra: débitos = créditos en moneda funcional |
| I-02 | Cada línea tiene débito XOR crédito, mayor que cero |
| I-03 | La cuenta, el tercero, el centro y el diario pertenecen a la compañía del asiento |
| I-04 | Un asiento contabilizado no se actualiza ni se elimina |
| I-05 | La reversión invierte signos, referencia el original y conserva el motivo |
| I-06 | La secuencia es única y sin huecos por compañía/diario/tipo/resolución |
| I-07 | No se contabiliza en periodo cerrado ni antes de un bloqueo |
| I-08 | El impuesto se calcula por línea y su cuenta coincide con la configuración |
| I-09 | La base y el valor del impuesto se registran en el asiento |
| I-10 | El saldo de CxC/CxP = importe original − aplicaciones − castigos |
| I-11 | Una aplicación no supera el saldo de la partida ni el importe del pago |
| I-12 | La suma de aplicaciones de un pago no supera su total |
| I-13 | Una conciliación no supera el importe de la línea de extracto |
| I-14 | La diferencia de conciliación queda explicada por un asiento |
| I-15 | La depreciación acumulada no supera costo − valor residual |
| I-16 | Hay una sola cuota de depreciación por activo y periodo |
| I-17 | La línea de presupuesto es única por versión/cuenta/centro/periodo |
| I-18 | El control presupuestal bloquea o avisa según configuración |
| I-19 | La consolidación solo toma asientos contabilizados |
| I-20 | Las eliminaciones intercompañía cuadran y referencian el origen |
| I-21 | Los informes solo leen datos contabilizados o snapshots |
| I-22 | Un snapshot certificado no cambia; se reemplaza por uno nuevo con hash |
| I-23 | Ninguna entidad transaccional existe sin `compania_id` |
| I-24 | Los importes en moneda funcional se calculan con la tasa del documento |
| I-25 | La diferencia de cambio se reconoce al pago o al cierre, no se ignora |
| I-26 | El maestro con movimientos no se elimina; se inactiva |
| I-27 | La auditoría es append-only y con hash encadenado |
| I-28 | Un comando idempotente repetido devuelve el mismo resultado |
| I-29 | No se contabiliza dos veces el mismo documento de origen |
| I-30 | El saldo de una cuenta padre = suma de sus hijas afectables |
| I-31 | El número de documento DIAN no se reutiliza ni se salta |
| I-32 | La compañía destino de una consolidación no comparte secuencias con las origen |
| I-33 | Los cierres bloquean el periodo antes de abrir el siguiente |
| I-34 | Los saldos iniciales del año N = saldos finales del año N−1 |
| I-35 | Todo cambio de estado queda auditado con actor, fecha y motivo |

## 6. Mapeo con el esquema actual

| Actual (`db/postgresql/schema/`) | Destino | Acción |
|---|---|---|
| `companias`, `compania_anios`, `periodos_contables`, `parametros_operacion` | `core` | Evolucionar |
| `cuentas`, `terceros`, `centros_costos`, `comprobantes`, `tipos_documento`, `conceptos_retencion`, `tarifas_iva`, `plantillas_contables` | `mst` | Evolucionar y completar |
| `lotes`, `lote_lineas`, `lote_validaciones` | `led` | Conservar como borrador/validación |
| `documentos`, `documento_lineas` | `led` | Evolucionar a asiento/línea |
| `saldos_cuenta`, `saldos_cuenta_tercero`, `saldos_cuenta_centro`, `acumulados_*` | `led` | Convertir en derivadas/materializadas |
| `formatos_exogenos`, `formato_conceptos`, `formato_asignaciones`, `generaciones_medios`, `medio_*` | `tax` | Evolucionar |
| `procesos`, `cierres`, `cierre_traslados`, `consolidaciones`, `consolidacion_origenes` | `cls` | Evolucionar |
| `roles`, `permisos`, `rol_permisos`, `usuarios`, `usuario_companias`, `auditoria`, `integraciones` | `sec`/`intg` | Evolucionar |
| `presupuestos`, `presupuesto_rubros`, `presupuesto_valores` | `bgt` | Evolucionar |
| `activos`, `activo_cuotas`, `activo_distribuciones` | `ast` | Evolucionar |
| `reembolsos`, `reembolso_lineas` | `ap`/`inv` | Reubicar según flujo |
| `tercero_cuentas_bancarias` | `mst`/`bnk` | Reubicar |

**No se crea un modelo paralelo.** Las tablas existentes se convierten en la base
de los módulos; las nuevas se agregan con migraciones incrementales.

## 7. Índices y rendimiento

1. `(compania_id, fecha)` en asientos; `(compania_id, cuenta_id, periodo_id)` en
   líneas.
2. `(compania_id, tercero_id, estado)` en CxC/CxP.
3. `(compania_id, numero)` único en documentos.
4. `(cuenta_bancaria_id, fecha)` en extractos.
5. `(activo_id, periodo_id)` único en depreciaciones.
6. `(presupuesto_id, cuenta_id, centro_id, periodo_id)` único en presupuesto.
7. Índices parciales para partidas abiertas (`estado IN ('abierta','parcial')`).
8. Vistas materializadas para saldos y ejecución presupuestal, refrescadas por
   evento o programación; nunca fuente de verdad.

## 8. Convenciones de migración

- Numeración global `NNNN_descripcion.sql`; una migración por cambio lógico.
- Cada migración es reversible o declara explícitamente por qué no lo es.
- Los cambios de esquema se prueban contra una copia anonimizada.
- Los `CHECK`, `UNIQUE` y claves foráneas se crean en la misma migración que la
  tabla.
- Los datos existentes se migran con scripts idempotentes y conciliación.
- Prohibido editar una migración ya aplicada en producción.
