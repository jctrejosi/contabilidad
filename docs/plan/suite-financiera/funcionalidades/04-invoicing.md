# Funcionalidades — `invoicing`

Origen funcional (inventario de partida): Odoo `account` (facturas, notas,
impuestos, condiciones de pago, Community) y `l10n_co_edi` (facturación
electrónica DIAN, Enterprise).

## F-INV-001 — Factura de venta

**Debe hacer.** Crear facturas de venta con cliente, fecha, moneda, condición de
pago, líneas, impuestos, descuentos y totales; guardar, validar y contabilizar.

**Reglas.** Cliente con NIT; al menos una línea; base/impuesto por línea; total =
suma de líneas + impuestos − retenciones; numeración autorizada; al contabilizar
genera asiento y CxC.

**Datos/API.** `inv.documento`, `documento_linea`, `documento_impuesto`;
`POST /api/v1/invoicing/facturas-venta`.

**Aceptación.** Factura sin cliente/líneas se rechaza; totales cuadran; al
contabilizar la CxC coincide con el total; el documento queda inmutable.

---

## F-INV-002 — Factura de compra

**Debe hacer.** Registrar facturas de proveedor con líneas, IVA, retenciones y
condición de pago; validar y contabilizar.

**Reglas.** Proveedor con NIT; retención según concepto; total neto = total −
retenciones; al contabilizar genera asiento y CxP; el número del proveedor es
único por tercero.

**Datos/API.** `inv.documento` tipo FC; `POST /api/v1/invoicing/facturas-compra`.

**Aceptación.** Factura de compra con retención genera CxP neta y pasivo; número
duplicado del proveedor se rechaza; la CxP vence según condición.

---

## F-INV-003 — Nota crédito

**Debe hacer.** Emitir notas crédito de venta o compra que referencien la factura
original y ajusten base, impuestos y cartera/CxP.

**Reglas.** Referencia obligatoria; motivo; total ≤ saldo del documento original
(salvo devolución total); genera asiento de reverso parcial; si es electrónica,
CUDE y referencia DIAN.

**Datos/API.** `inv.documento` tipo NC; `documento_referencia`;
`POST /api/v1/invoicing/notas-credito`.

**Aceptación.** La nota reduce la CxC/CxP y el IVA; no se puede referenciar un
documento de otra compañía; la nota contabilizada es inmutable.

---

## F-INV-004 — Nota débito

**Debe hacer.** Emitir notas débito que aumenten el valor de una factura
(intereses, ajustes, cargos posteriores).

**Reglas.** Referencia obligatoria; motivo; genera asiento y aumenta cartera/CxP;
si es electrónica, referencia DIAN; no se usa para corregir errores (para eso,
nota crédito y nueva factura).

**Datos/API.** `inv.documento` tipo ND; `POST /api/v1/invoicing/notas-debito`.

**Aceptación.** El saldo del documento original aumenta; el asiento cuadra; la
referencia DIAN es correcta.

---

## F-INV-005 — Impuestos por línea

**Debe hacer.** Determinar IVA, retención y otros impuestos por línea según
producto, tercero y posición fiscal.

**Reglas.** Base = cantidad × precio − descuento; tarifa parametrizada; impuesto
con cuenta; posición fiscal puede cambiar impuesto/cuenta; retenciones se
calculan según concepto y momento; redondeo por línea.

**Datos/API.** `tax.impuesto`, `tax.posicion_fiscal`;
`inv.documento_linea.impuesto_id`.

**Aceptación.** La suma de impuestos = resumen del documento; cambiar la posición
fiscal cambia el impuesto; una línea exenta no genera IVA.

---

## F-INV-006 — Descuentos, recargos y redondeo

**Debe hacer.** Aplicar descuentos por línea o documento, recargos y redondeo
final, reflejados en base e impuestos.

**Reglas.** Descuento no mayor al valor de la línea; recargo con cuenta
configurada; el redondeo genera línea de ajuste; el total nunca se edita a mano.

**Datos/API.** `inv.documento_linea.descuento`; `documento.redondeo`.

**Aceptación.** El total cuadra con líneas e impuestos; el descuento reduce la
base; el redondeo queda explicado.

---

## F-INV-007 — Condiciones y vencimientos

**Debe hacer.** Generar cuotas y fechas de vencimiento desde la condición de
pago, con posibilidad de override.

**Reglas.** La suma de cuotas = total; la condición se congela; el override
requiere motivo; los vencimientos alimentan cartera/CxP y aging.

**Datos/API.** `inv.documento_vencimiento`.

**Aceptación.** Vencimientos suman el total; cambiar la condición después de
contabilizar no altera la CxC; el aging usa la fecha correcta.

---

## F-INV-008 — Numeración y resolución DIAN

**Debe hacer.** Asignar número dentro de una resolución autorizada (prefijo,
rango, vigencia) y bloquear fuera de rango.

**Reglas.** Sin huecos ni reutilización; una resolución vencida/agotada rechaza;
la secuencia se reserva en la transacción; el número y la resolución se guardan
en el documento.

**Datos/API.** `inv.dian_resolucion`, `core.secuencia`;
`GET/POST /api/v1/invoicing/resoluciones`.

**Aceptación.** Dos facturas concurrentes no repiten número; fuera de rango se
rechaza; el número se conserva tras reversión.

---

## F-INV-009 — XML, CUFE y firma

**Debe hacer.** Generar el documento UBL 2.1, obtener CUFE/CUDE y firmar a través
del proveedor certificado; almacenar XML y respuesta.

**Reglas.** El XML refleja exactamente el documento contabilizado; la firma y el
envío son del proveedor; el XML/CUFE se conservan; un error no altera el asiento.

**Datos/API.** `inv.dian_documento`; `POST /documentos/{id}/dian/enviar`.

**Aceptación.** XML y total del asiento coinciden; el CUFE se guarda; un fallo de
firma deja estado reintentable.

---

## F-INV-010 — Eventos DIAN

**Debe hacer.** Registrar acuse, aceptación, rechazo y eventos de contingencia;
permitir reenvío y consulta de estado.

**Reglas.** Estados monotónicos; un rechazo no borra el documento; el reenvío no
duplica; cada evento queda auditado con fecha y respuesta.

**Datos/API.** `inv.dian_documento.estado`, `tax.dian_evento`.

**Aceptación.** La aceptación cambia el estado y queda visible; el rechazo
permite corregir y reenviar; el reenvío no crea otro documento.

---

## F-INV-011 — Contingencia

**Debe hacer.** Marcar documentos en contingencia, generar el XML y regularizar
la transmisión cuando el servicio esté disponible.

**Reglas.** La contingencia tiene motivo y vigencia; el documento sigue siendo
válido internamente; la regularización es auditada; no se contabiliza dos veces.

**Datos/API.** `inv.dian_documento.contingencia`.

**Aceptación.** Un documento en contingencia se puede consultar y regularizar;
el estado final queda consistente; el reporte de contingencia cuadra.

---

## F-INV-012 — Reversión y anulación

**Debe hacer.** Revertir un documento contabilizado con asiento espejo y, cuando
aplique, nota crédito; anular solo documentos en borrador.

**Reglas.** Contabilizado no se edita ni borra; la reversión exige motivo; la
nota crédito es el documento fiscal de corrección; la CxC/CxP se ajusta.

**Datos/API.** `POST /api/v1/invoicing/documentos/{id}/revertir`.

**Aceptación.** El original queda `revertido`; la cartera se ajusta; el XML/CUFE
original se conserva.
