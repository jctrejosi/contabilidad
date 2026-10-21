# Funcionalidades — `taxes`

Origen funcional (inventario de partida): `account.tax`,
`account.fiscal.position` (Community); `l10n_co` (PUC, IVA, retenciones, NIT);
`account_reports` (informes fiscales, Enterprise); `l10n_co_edi` (DIAN,
Enterprise). La exógena y los medios magnéticos no existen en Odoo: se
especifican desde la normativa colombiana.

## F-TAX-001 — Catálogo de impuestos

**Debe hacer.** Mantener impuestos con código, nombre, tipo (IVA, retención,
ICA, otro), tarifa, base, cuenta contable, grupo, vigencia y estado.

**Reglas.** Código único por tipo/vigencia; tarifa parametrizada; cuenta de la
compañía; no se edita un impuesto usado en documentos contabilizados; se crea
una nueva vigencia.

**Datos/API.** `tax.impuesto`; CRUD en `/api/v1/taxes/impuestos`.

**Aceptación.** No se crea sin cuenta; cambiar tarifa no altera historia; el
impuesto inactivo no se usa en documentos nuevos.

---

## F-TAX-002 — Grupos y etiquetas de impuesto

**Debe hacer.** Agrupar impuestos para reportes y etiquetar líneas de declaración.

**Reglas.** Un impuesto pertenece a un grupo; las etiquetas mapean a renglones de
reporte; el cambio de etiqueta no altera documentos; los reportes usan la
vigencia.

**Datos/API.** `tax.grupo`, `tax.etiqueta`; CRUD en `/api/v1/taxes/grupos`.

**Aceptación.** El reporte agrupa por etiqueta; una etiqueta sin mapeo se
advierte; los totales cuadran con el libro.

---

## F-TAX-003 — Posiciones fiscales

**Debe hacer.** Definir reglas que cambian impuestos/cuentas según país, régimen,
responsabilidad o tipo de tercero.

**Reglas.** Una posición se aplica al documento antes de calcular impuestos; el
mapeo es explícito; no se aplican dos posiciones contradictorias; el resultado se
congela.

**Datos/API.** `tax.posicion_fiscal`; CRUD en `/api/v1/taxes/posiciones`.

**Aceptación.** Un tercero exento no recibe IVA; el cambio de posición se refleja
en el documento; la posición usada queda registrada.

---

## F-TAX-004 — Determinación por línea

**Debe hacer.** Calcular base, impuesto y retención por línea, con redondeo y
cuenta.

**Reglas.** Base = cantidad × precio − descuento; se aplica la posición fiscal;
se guarda base/cuota; el redondeo no descuadra el documento; una línea puede
tener varios impuestos.

**Datos/API.** `inv.documento_linea`, `led.asiento_linea`;
servicio `taxes.determine`.

**Aceptación.** La suma de bases/cuotas = resumen; una línea exenta no genera
IVA; cambiar la tarifa no altera documentos posteados.

---

## F-TAX-005 — IVA

**Debe hacer.** Calcular IVA por línea, resumirlo por tarifa, registrar IVA por
pagar/descontable y generar el reporte del periodo.

**Reglas.** Tarifas y bases parametrizadas; descuentos/devoluciones ajustan base;
prorrateo configurable; IVA descontable según regla; declaración mensual o
bimestral según calendario.

**Datos/API.** `tax.impuesto`, `tax.reporte`;
`GET /api/v1/taxes/reportes/iva`.

**Aceptación.** IVA del periodo = suma de líneas; el reporte cuadra con el libro;
una nota crédito reduce el IVA.

---

## F-TAX-006 — Retenciones en la fuente

**Debe hacer.** Calcular retención por concepto, base, tarifa, UVT y momento;
registrar pasivo y emitir certificado.

**Reglas.** Base mínima en UVT; tarifa vigente; se calcula por línea/documento
según concepto; el pago neto descuenta; no se edita un certificado emitido.

**Datos/API.** `tax.concepto_retencion`, `ap.retencion`;
`GET /api/v1/taxes/reportes/retenciones`.

**Aceptación.** La retención cuadra con la base; el certificado coincide con el
reporte; el cambio de UVT no altera historia.

---

## F-TAX-007 — ICA y retención municipal

**Debe hacer.** Configurar tarifas por municipio/actividad, calcular ICA y
reteICA, y reportar por municipio.

**Reglas.** Municipio del tercero y de la compañía obligatorios; tarifa
parametrizada; sin configuración no se calcula; el reporte agrupa por municipio.

**Datos/API.** `tax.ica_tarifa`, `tax.concepto_retencion`;
`GET /api/v1/taxes/reportes/ica`.

**Aceptación.** El cálculo usa el municipio correcto; sin tarifa se advierte;
el reporte cuadra con el libro.

---

## F-TAX-008 — UVT y vigencias

**Debe hacer.** Mantener la UVT por año y usarla en bases mínimas y topes.

**Reglas.** UVT única por año; vigencia definida; los documentos usan la UVT del
año de la fecha; cambiar la UVT no altera historia.

**Datos/API.** `tax.uvt`; CRUD en `/api/v1/taxes/uvt`.

**Aceptación.** La base mínima se calcula en UVT; el año sin UVT se advierte; los
documentos antiguos conservan su cálculo.

---

## F-TAX-009 — Calendario tributario

**Debe hacer.** Registrar obligaciones por compañía, año, mes, fecha límite y
estado; generar alertas.

**Reglas.** Una obligación por periodo; estados `pendiente`, `generado`,
`presentado`, `vencido`; alertas antes del vencimiento; el calendario es
paramétrico.

**Datos/API.** `tax.calendario`; `GET/POST /api/v1/taxes/calendario`.

**Aceptación.** La alerta se genera en la fecha configurada; el estado cambia
manualmente con auditoría; el reporte lista vencidas.

---

## F-TAX-010 — Reportes fiscales y declaraciones

**Debe hacer.** Generar borradores de IVA, retenciones e ICA, con detalle por
tercero/concepto, y exportarlos.

**Reglas.** Solo datos contabilizados; el borrador es reproducible; no se
presenta ante la DIAN; el estado `generado` no bloquea el libro; la exportación
coincide con el reporte.

**Datos/API.** `GET /api/v1/taxes/declaraciones/{tipo}`,
`POST /declaraciones/{id}/generar`.

**Aceptación.** El borrador cuadra con el libro; dos generaciones iguales
producen el mismo resultado; el archivo exportado es consistente.

---

## F-TAX-011 — Información exógena

**Debe hacer.** Configurar formatos, conceptos y mapeos cuenta→concepto; generar
filas por tercero y validar 5 valores; exportar.

**Reglas.** Sin mapeo no se genera; la validación debe dar cero diferencias; una
generación exportada es inmutable; la corrección exige nueva generación con
motivo; los topes son configurables.

**Datos/API.** `tax.exogena_formato`, `concepto`, `asignacion`,
`generacion`, `fila`, `conciliacion`;
`POST /api/v1/taxes/exogena/generar`.

**Aceptación.** La diferencia ≠ 0 bloquea la exportación; los totales cuadran con
el libro; reexportar no duplica.

---

## F-TAX-012 — Medios magnéticos

**Debe hacer.** Generar la información anual por formato, validar topes y cuadre,
permitir ajuste de filas y exportar XML/CSV/XLSX.

**Reglas.** Generación por compañía/año/formato; validación de 5 valores; topes;
estado `generado`, `revisado`, `exportado`; exportado inmutable; ajuste auditado.

**Datos/API.** `tax.media_generacion`, `media_fila`, `media_tope`;
`POST /api/v1/taxes/medios/generar`.

**Aceptación.** El cuadre da cero; una generación exportada no cambia; el archivo
cumple el formato.

---

## F-TAX-013 — Certificados tributarios

**Debe hacer.** Emitir certificados de retención e IVA por tercero/periodo.

**Reglas.** Numeración propia; inmutable al emitir; base y valor coinciden con el
libro; se cruza con exógena; se puede consultar y exportar.

**Datos/API.** `ap.retencion`, `tax.certificado`;
`GET /api/v1/taxes/certificados`.

**Aceptación.** El certificado cuadra con las retenciones; no se emite dos veces;
la exportación coincide.

---

## F-TAX-014 — Orquestación DIAN

**Debe hacer.** Exponer el estado fiscal de cada documento y coordinar envío,
reintento, contingencia y regularización con el proveedor certificado.

**Reglas.** El documento contable manda; el XML/CUFE se conserva; un fallo no
altera el asiento; los estados son monotónicos; el reenvío es idempotente.

**Datos/API.** `inv.dian_documento`, `tax.dian_evento`;
`POST /api/v1/taxes/dian/{documento}/enviar`.

**Aceptación.** El estado refleja la respuesta; un rechazo permite corregir; el
reenvío no duplica.
