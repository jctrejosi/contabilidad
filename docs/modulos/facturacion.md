# Facturación

**Ruta:** `facturacion`
**Archivo:** `Interface_web/src/pages/finance/Facturacion.tsx`
**Datos:** `invoices`, `resolutions`, `dianEvents`, `products`, `taxFilings`
y `exogenousReports` en `FinanceState`.

## Objetivo

Emitir documentos de venta y compra, controlar la numeración autorizada,
gestionar el ciclo DIAN y entregar los documentos contabilizados a cartera y
cuentas por pagar.

## Pantallas

| Slug | Pantalla | Qué permite |
|---|---|---|
| `documentos` | Facturas de venta | Bandeja con flujo Borrador → DIAN → Cartera, filtros, detalle, creación, contabilización y envío DIAN |
| `compras` | Facturas de compra | Registro de proveedor, retenciones, neto y generación de CxP |
| `notas` | Notas crédito y débito | Ajuste de documentos originales con motivo y valor controlado |
| `dian` | Centro DIAN | Cola de envío, CUFE, eventos, aceptación, rechazo y reenvío |
| `resoluciones` | Resoluciones y numeración | Rangos, vigencia, consecutivo y disponibles |
| `productos` | Productos y servicios | Catálogo con precio, IVA, cuenta y estado |
| `importar` | Importar documentos | Carga validada y creación de borradores |
| `formulario-300` | Formulario 300 · IVA | IVA generado, descontable y saldo a pagar |
| `formulario-350` | Formulario 350 · Retención | Retención en la fuente y ReteICA |
| `formulario-110` | Formulario 110 · Renta | Renta líquida, presuntiva e impuesto anual |
| `declaracion` | Declaración electrónica | Checklist, validación, presentación y acuse |
| `exogena` | Exógena y medios | Formatos anuales, terceros e incidencias |

## Funcionalidad implementada

### Documentos de venta

- KPIs de facturado del mes, documentos por enviar, rechazados y saldo de
  cartera.
- Flujo visual con conteos reales por estado.
- Filtros por texto (número, cliente o NIT) y estado.
- Tabla con documento, cliente, NIT, fecha, vencimiento, total, estado y
  estado DIAN.
- Drawer con líneas, subtotal, descuentos, IVA, retenciones, total, CUFE,
  trazabilidad DIAN y vínculo con la partida de cartera.
- Acciones: contabilizar, enviar a DIAN, marcar aceptada, emitir nota,
  revertir el documento y navegar a cartera.

### Facturas de compra

- Tabla con bruto, retención y neto.
- Al contabilizar se crea una obligación en cuentas por pagar por el neto.
- Numeración propia con resolución de compra.

### Notas crédito y débito

- Referencia obligatoria a una factura contabilizada.
- Motivo obligatorio y valor máximo igual al total del documento original.
- La nota se crea contabilizada; las notas crédito reducen la CxC/CxP y las
  débito la aumentan.
- Se conserva el documento original y su histórico.

### Centro DIAN

- Conteo de pendientes, en tránsito, aceptados y rechazados.
- Envío individual o masivo de pendientes.
- Respuesta simulada de aceptación o rechazo con código y mensaje.
- Bitácora de eventos por documento.
- CUFE generado al enviar.

### Resoluciones y numeración

- Rango desde/hasta, siguiente número, disponibles y porcentaje de uso.
- Estado Vigente, Vencida o Agotada según fecha y consecutivo.
- Al emitir una factura se consume el consecutivo de la resolución activa.

### Productos y servicios

- Alta de producto con código, nombre, unidad, precio, IVA y cuenta contable.
- Activación/inactivación.
- El producto seleccionado en una línea hereda precio, IVA y cuenta.

### Importación

- Selección de archivo CSV/XLSX/JSON.
- Validación simulada y resumen de filas aceptadas.
- Creación de facturas de compra en borrador con numeración `FC-8872+`.
- Plantilla de columnas requeridas visible en pantalla.

### Formulario 300 · IVA

- Calcula el IVA del período desde las facturas contabilizadas: las notas
  crédito restan de los ingresos y del IVA generado.
- Casillas informativas, calculadas y editables; estas últimas permiten ajustes
  con soporte (operaciones excluidas, no gravadas, retenciones de IVA).
- Saldo a pagar = IVA generado − IVA descontable − retenciones de IVA.
- Acciones: recalcular desde documentos, guardar ajustes, validar y exportar
  borrador.

### Formulario 350 · Retención

- Agrupa las retenciones del período por concepto: retención en la fuente y
  ReteICA.
- Muestra base y valor practicado de cada concepto y el total del período.
- Mismas acciones de recálculo, ajuste y validación del formulario 300.

### Formulario 110 · Renta

- Declaración anual con ingresos brutos, devoluciones, costos y deducciones,
  renta líquida, presuntiva y renta líquida gravable.
- Impuesto al 35 %, menos descuentos tributarios y autorretenciones.
- Casillas editables para ingresos, deducciones, presuntiva, descuentos y
  autorretenciones; los totales se recalculan.

### Declaración electrónica

- Bandeja de formularios con período, vencimiento, saldo, estado y acuse.
- Checklist previo: formulario calculado, cifras revisadas, firma vigente y
  pago programado.
- Validación y presentación con confirmación escrita (`PRESENTAR`).
- La presentación genera acuse `DIAN-<formulario>-<período>-<secuencia>` y deja
  el formulario en `Aceptada`.
- La presentación es simulada: no transmite XML ni firma electrónicamente.

### Exógena y medios magnéticos

- Reporte anual por formato (1001, 1005, 1006, 1007, 1008, 1009, 1010).
- Terceros informados, valor reportado e incidencias por formato.
- Corrección individual de incidencias.
- Validación bloqueada mientras existan incidencias.
- Presentación con confirmación escrita (`EXOGENA`) y acuse `EXO-<año>-<secuencia>`.

## Reglas de negocio

- Una factura requiere tercero, al menos una línea y subtotal mayor que cero.
- El total se calcula: `base + IVA − retenciones`; no se digita manualmente.
- El consecutivo se reserva al guardar y nunca se reutiliza.
- Un documento contabilizado no se edita; se corrige con nota o se revierte.
  La reversión conserva el original y deja la CxC/CxP en cero.
- Una compra genera CxP por el neto después de retenciones.
- Una venta genera CxC por el total del documento.
- La aceptación DIAN no altera el asiento ni el valor.
- Un formulario no se presenta si la lista de verificación está incompleta.
- La exógena no se valida ni presenta mientras tenga incidencias.
- Las casillas editables se conservan al recalcular; las calculadas se derivan
  de las facturas y retenciones.
- La presentación ante la DIAN es simulada y genera un acuse local.

## Cobertura funcional

| Función | Dónde se cubre |
|---|---|
| F-INV-001 Factura de venta | `documentos` + editor |
| F-INV-002 Factura de compra | `compras` + editor |
| F-INV-003 Nota crédito | `notas` |
| F-INV-004 Nota débito | `notas` |
| F-INV-005 Impuestos por línea | Editor de factura |
| F-INV-006 Descuentos y redondeo | Editor de factura |
| F-INV-007 Condiciones y vencimientos | Editor (días + fecha calculada) |
| F-INV-008 Numeración y resolución | `resoluciones` + emisión |
| F-INV-009 XML, CUFE y firma | `dian` (CUFE simulado) |
| F-INV-010 Eventos DIAN | `dian` |
| F-INV-011 Contingencia | Cola DIAN (estado y evento) |
| F-INV-012 Reversión y anulación | Notas y estado del documento |
| F-TAX-001 Formulario 300 | `formulario-300` |
| F-TAX-002 Formulario 350 | `formulario-350` |
| F-TAX-003 Formulario 110 | `formulario-110` |
| F-TAX-004 Declaración electrónica | `declaracion` |
| F-TAX-005 Exógena | `exogena` |

## Integración pendiente

- Generar UBL 2.1 y firmar con proveedor tecnológico.
- Validar NIT, municipio y responsabilidad fiscal contra la DIAN real.
- Reservar consecutivos en una transacción de servidor.
- Crear el asiento contable en el libro Advantage al contabilizar.
- Generar XML UBL, firmar y transmitir a la DIAN desde `declaracion`.
- Calcular el formulario 110 desde el cierre del ejercicio y no desde valores
  de referencia.
- Generar los archivos oficiales de exógena y validarlos contra los formatos
  vigentes.
