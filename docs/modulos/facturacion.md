# Facturación

**Ruta:** `facturacion`
**Archivo:** `Interface_web/src/pages/finance/Facturacion.tsx`
**Datos:** `invoices`, `resolutions`, `dianEvents`, `products` en `FinanceState`.

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

## Reglas de negocio

- Una factura requiere tercero, al menos una línea y subtotal mayor que cero.
- El total se calcula: `base + IVA − retenciones`; no se digita manualmente.
- El consecutivo se reserva al guardar y nunca se reutiliza.
- Un documento contabilizado no se edita; se corrige con nota o se revierte.
  La reversión conserva el original y deja la CxC/CxP en cero.
- Una compra genera CxP por el neto después de retenciones.
- Una venta genera CxC por el total del documento.
- La aceptación DIAN no altera el asiento ni el valor.

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

## Integración pendiente

- Generar UBL 2.1 y firmar con proveedor tecnológico.
- Validar NIT, municipio y responsabilidad fiscal contra la DIAN real.
- Reservar consecutivos en una transacción de servidor.
- Crear el asiento contable en el libro Advantage al contabilizar.
