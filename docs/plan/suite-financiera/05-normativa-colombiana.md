# 05 — Normativa colombiana

> **Aviso.** Este documento traduce requisitos funcionales, no asesora
> tributariamente. Tarifas, UVT, topes, calendarios y resoluciones cambian; todo
> debe parametrizarse por año y validarse con el contador y el revisor fiscal
> antes de producción.

## 1. Marco de referencia

La suite se diseña para una entidad colombiana con contabilidad de causación,
sujeta a:

- Plan Único de Cuentas (PUC) para comerciantes.
- Estatuto Tributario y reglamentación de la DIAN.
- Normas de información financiera (NIIF plenas o NIIF para PYMES).
- Obligaciones municipales (ICA y retención de ICA).
- Facturación electrónica y sistemas de facturación autorizados.
- Información exógena y medios magnéticos.

El sistema **genera, valida y exporta**; la **presentación y la firma** ante la
DIAN son responsabilidad del contribuyente o de un proveedor autorizado.

## 2. Plan Único de Cuentas (PUC)

### 2.1 Estructura

| Nivel | Dígitos | Ejemplo | Uso |
|---|---:|---|---|
| Clase | 1 | 1 | Activo |
| Grupo | 2 | 13 | Deudores |
| Cuenta | 4 | 1305 | Clientes |
| Subcuenta | 6 | 130505 | Clientes nacionales |
| Auxiliar | 8+ | 13050501 | Detalle por tercero/uso |

Clases: 1 Activo, 2 Pasivo, 3 Patrimonio, 4 Ingresos, 5 Gastos, 6 Costos de
ventas, 7 Costos de producción/operación, 8 Cuentas de orden deudoras, 9 Cuentas
de orden acreedoras. La longitud exacta y los auxiliares se parametrizan por
compañía.

### 2.2 Reglas funcionales

1. Jerarquía por prefijo: toda cuenta tiene padre existente y nivel coherente.
2. Solo las cuentas **afectables** reciben movimientos.
3. Flags por cuenta:
   - `requiere_tercero`: obliga NIT en la línea.
   - `requiere_centro`: obliga centro de costo.
   - `requiere_base`: obliga base para IVA/retención.
   - `tipo_fiscal`: ingreso, costo, gasto, activo, pasivo, patrimonio, orden.
4. Cuenta con movimientos no se elimina; se inactiva.
5. El PUC se versiona por compañía y año; un cambio de plan no reescribe
   historia.
6. Validación de cuadre por nivel: padre = suma de hijos afectables.
7. Mapeo PUC → rubro NIIF para estados financieros.

### 2.3 Datos mínimos de la cuenta

`codigo`, `nombre`, `naturaleza` (débito/crédito), `nivel`, `padre`, `afectable`,
`requiere_tercero`, `requiere_centro`, `requiere_base`, `tipo_fiscal`,
`moneda` (si aplica), `estado`, `vigencia`.

## 3. Terceros y NIT

1. NIT de 9 dígitos + dígito de verificación calculado.
2. Tipo de persona: natural/jurídica; tipo de documento: NIT, cédula, pasaporte,
   tarjeta de extranjería.
3. Régimen: común, simple, no responsable.
4. Responsabilidades tributarias: responsable de IVA, agente retenedor,
   autorretenedor, régimen simple, informante de exógena, etc.
5. Dirección departamento/municipio (DIAN usa la división política).
6. Condición de pago y cupo de crédito.
7. Cuentas bancarias del tercero para pagos.
8. Duplicados por NIT: prohibidos; se unifican con auditoría.
9. El NIT del tercero y el de la compañía se validan con DV.

## 4. IVA

### 4.1 Reglas

1. Tarifas parametrizadas por año (general, diferencial, excluido, exento).
2. Base gravable por línea: cantidad × precio − descuento.
3. IVA = base × tarifa, con redondeo definido por línea.
4. Descuentos y devoluciones ajustan base e IVA.
5. IVA descontable solo cuando la operación lo permite; el sistema no decide
   legalidad, la parametriza.
6. Prorrateo cuando haya operaciones gravadas y no gravadas: regla configurable
   con base documentada.
7. Retención de IVA (reteIVA) como concepto separado.
8. Impuestos excluidos y exentos no generan IVA, pero sí reporte.
9. IVA por pagar / saldo a favor se determina por periodo.
10. Declaración mensual o bimestral según calendario y régimen.

### 4.2 Datos

`tax.impuesto`, `tax.grupo`, `tax.etiqueta`, `tax.posicion_fiscal`,
`inv.documento_impuesto`, `led.asiento_linea.impuesto_id`.

## 5. Retenciones

### 5.1 Tipos

| Tipo | Base típica | Momento |
|---|---|---|
| Retención en la fuente (renta) | Valor del pago o abono en cuenta, según concepto | Pago o causación, según concepto |
| ReteIVA | Valor del IVA | Pago |
| ReteICA | Valor del pago, según municipio | Pago |
| Autorretención | Base del ingreso, según concepto | Causación |

Las tarifas, bases mínimas (UVT), topes y momentos son **parámetros por año y
concepto**, no constantes de código.

### 5.2 Reglas

1. Cada concepto define: tipo, base, tarifa, base mínima, cuenta de pasivo,
   código DIAN y vigencia.
2. La retención se calcula por línea o por documento según el concepto.
3. Se emite certificado de retención con número, fecha, base y valor.
4. El pago neto = total − retenciones − anticipos.
5. La retención se declara y se cruza con la exógena.
6. Una retención mal calculada se corrige con nota/ajuste auditado; no se edita
   el certificado emitido.
7. UVT del año: tabla `tax.uvt` (valor, vigencia).

## 6. ICA y retención municipal

1. Tarifa por municipio y actividad económica.
2. Base: ingresos del periodo o pago, según municipio.
3. ReteICA: porcentaje sobre el pago; se configura por municipio y concepto.
4. El sistema guarda municipio del tercero y de la compañía.
5. Reporte por municipio para declaración y conciliación.
6. Sin parametrización municipal no se calcula ICA; se advierte.

## 7. Información exógena y medios magnéticos

### 7.1 Concepto

La información exógena (medios magnéticos) reporta a la DIAN operaciones con
terceros: pagos, retenciones, IVA, cuentas por cobrar/pagar, ingresos, inventarios,
activos, importaciones y exportaciones, según los formatos vigentes.

### 7.2 Modelo funcional

1. **Formato:** código, nombre, versión y vigencia.
2. **Concepto:** código, nombre, tipo, signo.
3. **Asignación:** cuenta(s) contable(s) → concepto (puede ser por compañía).
4. **Generación:** compañía + año + formato; estado `generado`, `revisado`,
   `exportado`.
5. **Filas:** tercero, base, valor, retención, cuentas.
6. **Validación de 5 valores:** base, valor, retención, IVA y total deben
   cuadrar contra el libro; diferencia distinta de cero bloquea la exportación.
7. **Exportación:** XML/CSV/XLSX con hash; una generación exportada es inmutable.
8. **Topes y exclusiones:** configurables por formato/concepto.
9. **Copia entre compañías:** clona definiciones, no datos.
10. **No presentación:** la suite exporta; la presentación es externa.

### 7.3 Reglas de oro

- La exógena sale del **mismo libro**, no de una consulta paralela.
- Los terceros deben tener NIT/DV válidos y municipio.
- Las cuentas deben estar mapeadas; sin mapeo, la generación falla con detalle.
- Una diferencia se explica o se corrige; nunca se “ajusta” la fila.

## 8. Facturación electrónica DIAN

### 8.1 Alcance

1. Factura electrónica de venta (UBL 2.1).
2. Notas crédito y débito electrónicas.
3. Numeración autorizada por resolución (prefijo, rango, vigencia).
4. CUFE/CUDE y firma digital.
5. Eventos: acuse de recibo, aceptación, rechazo, contingencia.
6. Envío y consulta de estado; reintentos y almacenamiento del XML.
7. Contingencia: generación y posterior transmisión.
8. RADIAN y otros eventos: fase posterior/integración.

### 8.2 Decisión de implementación

**Integrar un proveedor certificado** para firma, habilitación y transmisión. La
suite construye:

- El documento y sus impuestos.
- La resolución y el rango.
- El XML de negocio (modelo interno → UBL).
- El outbox, estados, reintentos y auditoría.
- El almacenamiento del XML/CUFE y la consulta de estado.

La integración se encapsula en `integrations/dian` con un contrato estable; se
puede cambiar de proveedor sin tocar facturación.

### 8.3 Reglas

1. No se contabiliza una factura sin número y resolución válidos.
2. El número no se reutiliza ni se salta.
3. Un rechazo no borra la factura: se corrige y se reenvía, o se anula con nota.
4. El XML y el CUFE se conservan como soporte.
5. La factura electrónica y el asiento comparten el mismo total.
6. La contingencia se marca y se regulariza.

## 9. NIIF y estados financieros

1. Marco: NIIF plenas o NIIF para PYMES, configurable por compañía.
2. Estados: situación financiera, resultados integrales, cambios en el
   patrimonio, flujos de efectivo, notas.
3. ESFA: estado de situación financiera de apertura con mapeo PUC → rubro.
4. Flujo de caja: método directo/indirecto, con renglones configurables.
5. Mapeo `cuenta → rubro NIIF` versionado por año.
6. Los informes se generan desde asientos contabilizados.
7. Snapshot certificable con hash y firma del contador/revisor.
8. Las notas y revelaciones son texto estructurado, no cálculo contable.

## 10. Calendario tributario y cierres

1. Tabla `tax.calendario` por compañía, año, mes y obligación.
2. Obligaciones: IVA, retenciones, ICA, exógena, renta, información.
3. Estados: pendiente, generado, presentado, vencido.
4. Alertas antes del vencimiento.
5. El cierre contable es independiente del calendario, pero ambos se consultan
   juntos.
6. Los periodos contables se bloquean al cerrar; el bloqueo tributario puede ser
   distinto y se configura.

## 11. Requisitos de datos transversales

| Dato | Dónde | Regla |
|---|---|---|
| NIT y DV | `mst.tercero` | Validación de DV y unicidad |
| Municipio | `mst.tercero`, `core.compania` | Obligatorio para ICA/exógena |
| Régimen y responsabilidades | `mst.tercero` | Definen impuestos y reportes |
| UVT | `tax.uvt` | Por año, parametrizada |
| Tarifas | `tax.impuesto` | Por vigencia, no hardcode |
| Resolución DIAN | `inv.dian_resolucion` | Rango, prefijo, vigencia |
| Cuentas de impuesto | `tax.impuesto.cuenta_id` | Obligatoria para postear |
| Mapeo exógena | `tax.exogena_asignacion` | Sin mapeo no se genera |
| Mapeo NIIF | `rpt.mapeo_niif` | Versionado por año |

## 12. Checklist de cumplimiento por módulo

| Módulo | Debe cumplir |
|---|---|
| `maestros` | PUC, NIT/DV, régimen, responsabilidades, municipio |
| `invoicing` | Numeración, IVA, retenciones, XML/CUFE, notas |
| `receivables` | ReteIVA/reteICA en recibos, certificados |
| `payables` | Retención en la fuente, autorretención, certificados |
| `taxes` | Acumulados, declaraciones, exógena, medios, calendario |
| `assets` | Depreciación contable y fiscal |
| `reporting` | NIIF, ESFA, flujo de caja, snapshots |
| `closing` | Cierre, bloqueo, apertura, consolidación |
| `security` | Segregación, auditoría, retención de soportes |

## 13. Fuera de alcance regulatorio inicial

- Presentación y firma de declaraciones ante la DIAN.
- Firma electrónica propia y habilitación como proveedor tecnológico.
- Nómina y seguridad social.
- Precios de transferencia y renta avanzada.
- RADIAN y factoring electrónico (fase posterior).
- Regímenes especiales no parametrizados.

## 14. Regla final

Todo parámetro legal (tarifa, UVT, tope, fecha, formato, resolución) debe poder
cambiar **sin desplegar código**. Si un requisito obliga a tocar el código, es
un defecto de diseño.
