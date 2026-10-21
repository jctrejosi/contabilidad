# 06 — Especificación por módulo

Cada módulo define: objetivo, origen funcional, entidades, comandos, reglas,
estados, pantallas, dependencias y criterios de aceptación. Los contratos
detallados de API se documentan en el módulo al implementarlo; aquí queda el
compromiso funcional.

El desglose **función por función** está en `01-catalogo-funcional.md` y en
`funcionalidades/` (un archivo por módulo, 159 funciones en total). Este
documento es el contrato de módulo; el catálogo es la unidad de alcance y
aceptación.

Convención de rutas: `/api/v1/<modulo>/...`. Las rutas actuales `/api/...` se
mantienen como alias durante la transición.

---

## 1. `core` — Núcleo

**Objetivo.** Sostener compañías, tiempo contable, monedas, secuencias, bloqueos
y la infraestructura de eventos.

**Origen funcional.** `res.company`, `res.currency`, `ir.sequence`, fechas de bloqueo.

**Entidades.** `core.compania`, `compania_anio`, `periodo`, `moneda`,
`tasa_cambio`, `secuencia`, `bloqueo`, `outbox`.

**Comandos.**
- `POST /companias`, `PUT /companias/{id}`
- `POST /periodos/{id}/abrir`, `POST /periodos/{id}/cerrar`
- `POST /bloqueos`, `DELETE /bloqueos/{id}`
- `POST /tasas`, `GET /tasas?fecha=`
- `GET /secuencias`, `POST /secuencias`, `POST /secuencias/{id}/reservar` (interno)
- `GET /outbox/pendientes`, `POST /outbox/{id}/reintentar` (interno)

**Reglas.**
1. Un periodo pertenece a un año de una compañía y no se solapa.
2. No se contabiliza en periodo cerrado ni bajo bloqueo.
3. La secuencia se reserva con bloqueo de fila y sin huecos.
4. La moneda funcional de la compañía define los importes base.
5. La tasa de cambio es por fecha y par; si falta, se usa la última anterior y se
   advierte.
6. El outbox se escribe en la misma transacción del comando.

**Estados.** Periodo: `abierto`, `cerrado`, `bloqueado`. Secuencia: `activa`,
`agotada`, `vencida`.

**Pantallas.** Compañías, periodos, monedas/tasas, secuencias, bloqueos.

**Depende de.** Nada.

**Aceptación.**
- No se puede postear en periodo cerrado (prueba negativa).
- Dos posteos concurrentes no duplican ni saltan número.
- Cambiar la tasa no altera asientos ya contabilizados.

---

## 2. `maestros` — Maestros contables

**Objetivo.** Mantener el PUC, terceros, centros, diarios, tipos de documento,
condiciones de pago y productos/servicios.

**Origen funcional.** `account.account`, `res.partner`, `analytic.account`,
`account.journal`, `account.payment.term`, `product.product`.

**Entidades.** `mst.cuenta`, `tercero`, `tercero_cuenta_bancaria`, `centro`,
`diario`, `tipo_documento`, `condicion_pago`, `producto`.

**Comandos.**
- CRUD de cuentas con validación de jerarquía y flags.
- CRUD de terceros con NIT/DV, régimen, responsabilidades y municipio.
- CRUD de centros, diarios, tipos de documento y condiciones de pago.
- CRUD de productos/servicios (sin inventario).
- `POST /terceros/{id}/unificar` (duplicados, con auditoría).

**Reglas.**
1. Código de cuenta inmutable después de tener movimientos.
2. Cuenta padre existente; nivel coherente; solo afectables reciben líneas.
3. NIT único; DV validado; municipio obligatorio para ICA/exógena.
4. Tercero con movimientos no se elimina; se inactiva.
5. Diario con movimientos no se elimina.
6. Tipo de documento define si contabiliza y su flujo.
7. Cambios de maestro quedan auditados con antes/después.

**Estados.** `activo`, `inactivo`; cuentas además `bloqueada`.

**Pantallas.** Plan de cuentas, terceros, centros, diarios, tipos de documento,
condiciones de pago, productos.

**Depende de.** `core`.

**Aceptación.**
- No se crea una cuenta con padre inexistente o nivel inválido.
- No se duplica un NIT.
- Cambiar un flag de cuenta no reescribe movimientos históricos.

---

## 3. `ledger` — Libro contable

**Objetivo.** Registrar asientos, lotes y reversiones; producir mayor, auxiliares
y saldos reconstruibles.

**Origen funcional.** `account.move`, `account.move.line`, `account.journal`,
`account.partial.reconcile` (concepto).

**Entidades.** `led.asiento`, `asiento_linea`, `lote`, `lote_linea`,
`asiento_relacion`, `saldo_*`.

**Comandos.**
- `POST /lotes`, `POST /lotes/{id}/lineas`, `POST /lotes/{id}/validar`,
  `POST /lotes/{id}/contabilizar`.
- `POST /asientos` (manual), `POST /asientos/{id}/revertir`.
- `GET /asientos`, `GET /asientos/{id}`, `GET /mayor`, `GET /auxiliares`.

**Reglas.**
1. Débitos = créditos; una naturaleza por línea.
2. Cuenta/tercero/centro/diario de la compañía.
3. Posteo solo por `ledger.post`; secuencia y auditoría en la transacción.
4. Asiento contabilizado inmutable; reversión espejo con motivo.
5. Lote: borrador → validado → contabilizado; una línea con error bloquea el
   lote completo.
6. Importes en moneda del documento y funcional.
7. No se contabiliza dos veces el mismo origen.

**Estados.** Asiento: `borrador`, `contabilizado`, `revertido`. Lote: `borrador`,
`validado`, `contabilizado`, `anulado`.

**Pantallas.** Lotes, captura directa, asientos, mayor, auxiliares, reversión.

**Depende de.** `core`, `maestros`, `taxes` (determinación).

**Aceptación.**
- Un lote con descuadre no contabiliza.
- Revertir dos veces no duplica la reversión.
- El mayor cuadra con los asientos y con los saldos materializados.

---

## 4. `invoicing` — Facturación

**Objetivo.** Emitir facturas de venta y registrar facturas de compra, con notas
crédito/débito, impuestos, vencimientos y DIAN.

**Origen funcional.** `account.move` (out_invoice/in_invoice/out_refund/in_refund),
`account.move.line`, `l10n_co_edi` (Enterprise).

**Entidades.** `inv.documento`, `documento_linea`, `documento_impuesto`,
`documento_referencia`, `documento_vencimiento`, `dian_documento`,
`dian_resolucion`.

**Comandos.**
- `POST /facturas-venta`, `POST /facturas-compra`
- `POST /notas-credito`, `POST /notas-debito`
- `POST /documentos/{id}/validar`, `/contabilizar`, `/revertir`
- `POST /documentos/{id}/dian/enviar`, `GET /documentos/{id}/dian`
- `GET /documentos`, `GET /documentos/{id}`

**Reglas.**
1. Tercero, líneas, impuestos y condición de pago obligatorios.
2. Base/IVA/retención por línea; totales derivados.
3. Vencimientos generados desde la condición de pago.
4. Contabilizar crea asiento y CxC/CxP en la misma transacción.
5. Numeración DIAN por resolución; sin número válido no se contabiliza.
6. Nota crédito/débito referencia el documento original.
7. Documento contabilizado no se edita; se revierte o se corrige con nota.
8. XML/CUFE y estado DIAN se conservan.

**Estados.** `borrador`, `validado`, `contabilizado`, `pagado_parcial`,
`pagado`, `revertido`, `anulado` (solo borrador). DIAN: `pendiente`,
`generado`, `enviado`, `aceptado`, `rechazado`, `contingencia`.

**Pantallas.** Facturas de venta, facturas de compra, notas, detalle DIAN,
resoluciones.

**Depende de.** `maestros`, `ledger`, `taxes`, `integrations` (DIAN).

**Aceptación.**
- Factura con IVA genera asiento y CxC exactos.
- Nota crédito reduce la CxC y el IVA.
- Rechazo DIAN no altera el asiento y permite corrección auditada.

---

## 5. `receivables` — Cartera (CxC)

**Objetivo.** Gestionar partidas por cobrar, recibos, aplicación de pagos, edades,
estados de cuenta, cobro y castigos.

**Origen funcional.** Partidas abiertas, `account_followup` (Enterprise).

**Entidades.** `ar.cxc`, `ar.recibo`, `ar.aplicacion_pago`, `ar.gestion_cobro`,
`ar.castigo`.

**Comandos.**
- `GET /cxc?tercero=&estado=&vencimiento=`
- `POST /recibos`, `POST /recibos/{id}/aplicar`, `POST /recibos/{id}/revertir`
- `POST /cxc/{id}/castigar`
- `POST /cxc/{id}/gestion` (llamada, correo, promesa)
- `GET /aging`, `GET /estado-cuenta/{tercero}`

**Reglas.**
1. La CxC nace del posteo; no se crea a mano.
2. Aplicación ≤ saldo y ≤ importe disponible del recibo.
3. Varias CxC por recibo y varios recibos por CxC (parciales).
4. diferencia de cambio al aplicar en moneda distinta.
5. Castigo genera asiento y cierra la partida.
6. El aging se calcula por vencimiento, no por fecha de emisión.
7. El estado de cuenta incluye facturas, notas y pagos.

**Estados.** CxC: `abierta`, `parcial`, `pagada`, `castigada`, `revertida`.
Recibo: `registrado`, `aplicado`, `conciliado`, `revertido`.

**Pantallas.** Cartera, recibos, aplicación, aging, estado de cuenta, cobro.

**Depende de.** `invoicing`, `ledger`, `banking`.

**Aceptación.**
- Suma de aplicaciones = saldo pagado; saldo restante correcto.
- No se aplica un pago a una CxC de otra compañía o moneda sin conversión.
- Aging y estado de cuenta cuadran con el libro.

---

## 6. `payables` — CxP y pagos

**Objetivo.** Gestionar cuentas por pagar, propuestas de pago, retenciones,
anticipos y gastos.

**Origen funcional.** `account.move` (in_invoice), `account.payment`, `hr_expense`,
`account_followup` (concepto).

**Entidades.** `ap.cxp`, `ap.pago`, `ap.aplicacion_pago`, `ap.propuesta_pago`,
`ap.propuesta_linea`, `ap.retencion`, `ap.anticipo`.

**Comandos.**
- `GET /cxp?tercero=&estado=&vencimiento=`
- `POST /propuestas`, `POST /propuestas/{id}/aprobar`,
  `POST /propuestas/{id}/pagar`
- `POST /pagos`, `POST /pagos/{id}/aplicar`, `POST /pagos/{id}/revertir`
- `GET /retenciones`, `POST /retenciones/{id}/certificado`
- `POST /anticipos`, `POST /anticipos/{id}/aplicar`

**Reglas.**
1. CxP nace del posteo de factura de compra.
2. Retención según concepto, base y momento; se registra en la CxP.
3. Propuesta selecciona CxP por vencimiento y prioridad; aprobación segregada.
4. Pago neto = total − retenciones − anticipos.
5. Pago parcial deja la CxP en `parcial`.
6. Anticipo se aplica a facturas futuras del mismo tercero.
7. Certificado de retención inmutable una vez emitido.

**Estados.** CxP: `abierta`, `parcial`, `pagada`, `revertida`. Pago:
`registrado`, `aplicado`, `conciliado`, `revertido`. Propuesta: `borrador`,
`aprobada`, `pagada`, `anulada`.

**Pantallas.** CxP, propuestas de pago, pagos, retenciones, anticipos, gastos.

**Depende de.** `invoicing`, `ledger`, `banking`, `taxes`.

**Aceptación.**
- Factura con retención genera CxP por el neto y pasivo por la retención.
- Una propuesta aprobada no se edita; se anula y se crea otra.
- El pago conciliado cierra la CxP y el extracto.

---

## 7. `banking` — Bancos y tesorería

**Objetivo.** Administrar cuentas bancarias, extractos, conciliación,
transferencias, cheques y caja.

**Origen funcional.** `account.bank.statement`, `account_accountant` (conciliación,
Enterprise).

**Entidades.** `bnk.cuenta_bancaria`, `extracto`, `extracto_linea`,
`conciliacion`, `regla`, `transferencia`, `cheque`, `caja`, `caja_movimiento`.

**Comandos.**
- CRUD de cuentas bancarias y cajas.
- `POST /extractos/importar` (CSV/XLSX/OFX), `POST /extractos`,
  `POST /extractos/{id}/cerrar`.
- `POST /conciliaciones/automaticas`, `POST /conciliaciones`,
  `DELETE /conciliaciones/{id}`.
- `POST /transferencias`, `POST /cheques`, `POST /caja/movimientos`.
- `GET /conciliacion/pendientes`.

**Reglas.**
1. Extracto: saldo inicial + movimientos = saldo final; si no, no se importa.
2. Hash de archivo evita duplicados.
3. Conciliación enlaza líneas; no edita el libro.
4. Diferencia se explica con asiento de comisión/interés/diferencia.
5. Matching automático por reglas; manual para el resto.
6. Extracto conciliado se bloquea; reabrir exige permiso y auditoría.
7. Transferencia entre cuentas genera asiento único y no afecta resultados.

**Estados.** Extracto: `abierto`, `conciliado`, `cerrado`. Línea: `pendiente`,
`conciliada`, `descartada`. Conciliación: `parcial`, `total`, `revertida`.

**Pantallas.** Cuentas bancarias, extractos, conciliación, reglas, transferencias,
cheques, caja.

**Depende de.** `ledger`, `receivables`, `payables`.

**Aceptación.**
- Un extracto descuadrado se rechaza con detalle.
- La suma conciliada nunca supera la línea del extracto.
- El reporte de partidas conciliatorias cuadra con el saldo bancario.

---

## 8. `assets` — Activos fijos

**Objetivo.** Registrar activos, calcular depreciación contable/fiscal, bajas,
revalorizaciones y deterioro.

**Origen funcional.** `account_asset` (Enterprise).

**Entidades.** `ast.categoria`, `activo`, `depreciacion`, `baja`, `revaluacion`,
`deterioro`.

**Comandos.**
- CRUD de categorías y activos.
- `POST /activos/{id}/activar`, `POST /activos/{id}/baja`,
  `POST /activos/{id}/revaluacion`, `POST /activos/{id}/deterioro`.
- `POST /depreciaciones/generar?periodo=`, `POST /depreciaciones/{id}/contabilizar`.
- `GET /activos/{id}/tabla`, `GET /reporte/activos`.

**Reglas.**
1. Categoría define método, vida útil, cuentas y residual.
2. Tabla de depreciación generada al activar; una cuota por periodo.
3. Cuota = función del método; nunca supera costo − residual.
4. Job mensual idempotente; no duplica cuota.
5. Baja calcula valor en libros y resultado; cierra cuotas futuras.
6. Revalorización/deterioro ajusta y recalcula cuotas futuras.
7. Depreciación fiscal separada de la contable, conciliable.

**Estados.** `borrador`, `activo`, `totalmente_depreciado`, `dado_de_baja`,
`revaluado`, `deteriorado`.

**Pantallas.** Activos, categorías, tabla de depreciación, bajas, reporte.

**Depende de.** `ledger`, `invoicing` (alta desde compra), `taxes`.

**Aceptación.**
- La suma de cuotas = costo − residual.
- Dos ejecuciones del job no duplican asientos.
- La baja genera resultado correcto y deja trazabilidad.

---

## 9. `budgeting` — Presupuesto

**Objetivo.** Planificar por cuenta/centro/periodo, aprobar versiones, controlar
compromisos y comparar real vs. presupuesto.

**Origen funcional.** `account_budget` (Enterprise).

**Entidades.** `bgt.presupuesto`, `linea`, `control`, `compromiso`, vista
`ejecucion`.

**Comandos.**
- `POST /presupuestos`, `POST /presupuestos/{id}/lineas`,
  `POST /presupuestos/{id}/aprobar`, `POST /presupuestos/{id}/cerrar`.
- `POST /compromisos`, `DELETE /compromisos/{id}`.
- `GET /presupuestos/{id}/ejecucion`, `GET /control?cuenta=&centro=&periodo=`.

**Reglas.**
1. Versión aprobada inmutable; nueva versión para cambios.
2. Línea única por versión/cuenta/centro/periodo.
3. Compromiso al validar documento; ejecución al contabilizar.
4. Control: disponible = presupuesto − ejecutado − comprometido.
5. Modo `ninguno`, `avisar`, `bloquear`.
6. Ejecución se lee del libro, no se digita.
7. Cierre de presupuesto no borra historia.

**Estados.** `borrador`, `aprobado`, `cerrado`. Compromiso: `vigente`, `ejecutado`,
`liberado`.

**Pantallas.** Presupuestos, versiones, líneas, control, ejecución.

**Depende de.** `ledger`, `invoicing`, `maestros`.

**Aceptación.**
- Una factura que excede el presupuesto bloqueado se rechaza.
- El reporte real vs. presupuesto cuadra con el libro.
- Aprobar dos veces no duplica la versión.

---

## 10. `taxes` — Impuestos y cumplimiento

**Objetivo.** Determinar IVA/retenciones/ICA, administrar calendario, generar
declaraciones, exógena y medios magnéticos, y orquestar DIAN.

**Origen funcional.** `account.tax`, `account.fiscal.position` (Community); `l10n_co_edi`
(Enterprise); exógena/medios no existen.

**Entidades.** `tax.impuesto`, `grupo`, `etiqueta`, `posicion_fiscal`,
`concepto_retencion`, `calendario`, `exogena_*`, `media_*`, `dian_evento`,
`uvt`.

**Comandos.**
- CRUD de impuestos, grupos, etiquetas, posiciones y conceptos de retención.
- `GET /calendario?anio=`, `POST /calendario/{id}/estado`.
- `GET /reportes/iva`, `/retenciones`, `/ica`.
- `POST /exogena/generar`, `POST /exogena/{id}/validar`,
  `POST /exogena/{id}/exportar`.
- `POST /medios/generar`, `POST /medios/{id}/validar`,
  `POST /medios/{id}/exportar`.
- `POST /dian/documentos/{id}/enviar`, `GET /dian/documentos/{id}`.

**Reglas.**
1. Impuesto por línea con base, cuota y cuenta.
2. Posición fiscal ajusta impuestos/cuentas por tercero.
3. Retención según concepto, base, UVT y momento.
4. Acumulados derivados del libro; reconstruibles.
5. Exógena: mapeo cuenta→concepto; sin mapeo falla.
6. Validación de 5 valores = 0 para exportar.
7. Generación exportada inmutable; corrección con nueva generación.
8. DIAN: XML/CUFE, estados, reintentos, contingencia.

**Estados.** Generación: `generado`, `revisado`, `exportado`. DIAN: `pendiente`,
`generado`, `enviado`, `aceptado`, `rechazado`, `contingencia`.

**Pantallas.** Impuestos, posiciones, retenciones, calendario, IVA, exógena,
medios, DIAN.

**Depende de.** `ledger`, `invoicing`, `maestros`, `integrations`.

**Aceptación.**
- IVA del periodo = suma de líneas de IVA contabilizadas.
- Exógena con diferencia ≠ 0 no exporta.
- Reenvío DIAN no duplica el documento.

---

## 11. `reporting` — Informes

**Objetivo.** Producir estados financieros, libros, informes NIIF, comparativos y
snapshots certificables.

**Origen funcional.** `account_reports` (Enterprise); motor `account.report` (Community,
limitado).

**Entidades.** `rpt.reporte`, `ejecucion`, `snapshot`, `snapshot_linea`,
`mapeo_niif`.

**Comandos.**
- `GET /reportes`, `POST /reportes/{codigo}/ejecutar`.
- `POST /reportes/{codigo}/snapshot`, `GET /snapshots/{id}`.
- `GET /estados/financieros?anio=&periodo=`.
- `GET /libros/mayor`, `/auxiliares`, `/comprobacion`.

**Reglas.**
1. Solo datos contabilizados (salvo informes de control).
2. Parámetros obligatorios: compañía, periodo, moneda, comparativo.
3. Reglas de presentación versionadas.
4. Snapshot inmutable con hash y firma.
5. Exportación PDF/XLSX/CSV desde el mismo conjunto de datos.
6. Límites de filas con paginación; nunca truncar silenciosamente.

**Estados.** Ejecución: `en_proceso`, `completada`, `fallida`. Snapshot:
`generado`, `certificado`, `anulado`.

**Pantallas.** Centro de informes, estados financieros, libros, comparativos,
snapshots.

**Depende de.** `ledger`, `ar`, `ap`, `assets`, `budgeting`, `closing`.

**Aceptación.**
- Balance de comprobación cuadra con el mayor.
- Snapshot no cambia al postear después.
- Comparativo entre periodos usa la misma regla.

---

## 12. `closing` — Cierres y consolidación

**Objetivo.** Cerrar periodos/años, generar apertura y consolidar compañías.

**Origen funcional.** `account` (bloqueos), `account_consolidation` (Enterprise).

**Entidades.** `cls.cierre`, `cierre_linea`, `apertura`, `consolidacion`,
`consolidacion_origen`, `homologacion_cuenta`, `homologacion_centro`,
`eliminacion`.

**Comandos.**
- `POST /cierres`, `POST /cierres/{id}/checklist`, `POST /cierres/{id}/ejecutar`,
  `POST /cierres/{id}/reabrir`.
- `POST /aperturas`.
- `POST /consolidaciones`, `POST /consolidaciones/{id}/simular`,
  `POST /consolidaciones/{id}/ejecutar`.

**Reglas.**
1. Checklist obligatorio; no se cierra con pendientes sin justificar.
2. Cierre idempotente.
3. Bloqueo del periodo al cerrar; apertura del siguiente.
4. Reapertura con permiso, motivo y auditoría.
5. Consolidación solo con orígenes cerrados.
6. Homologación y eliminaciones explícitas.
7. Libro consolidado separado.

**Estados.** Cierre: `pendiente`, `en_proceso`, `ejecutado`, `anulado`.
Consolidación: `configurada`, `simulada`, `ejecutada`, `anulada`.

**Pantallas.** Cierres, checklist, apertura, consolidación, homologación.

**Depende de.** `ledger`, `taxes`, `reporting`, `assets`, `banking`.

**Aceptación.**
- Cerrar dos veces no duplica asientos.
- El saldo inicial del año siguiente = cierre del anterior.
- La consolidación cuadra y elimina intercompañía.

---

## 13. `security` — Seguridad y auditoría

**Objetivo.** Controlar acceso, segregación de funciones y trazabilidad inmutable.

**Origen funcional.** `res.groups`, ACL, record rules, audit trail.

**Entidades.** `sec.usuario`, `rol`, `permiso`, `rol_permiso`,
`usuario_compania`, `sesion`, `auditoria`.

**Comandos.**
- CRUD de usuarios, roles y permisos.
- `POST /usuarios/{id}/roles`, `POST /usuarios/{id}/companias`.
- `GET /auditoria?entidad=&usuario=&fecha=`.
- `POST /sesiones`, `DELETE /sesiones/{id}`.

**Reglas.**
1. Permiso por módulo + acción; alcance por compañía.
2. Segregación: crear ≠ aprobar ≠ pagar ≠ cerrar.
3. Auditoría append-only con hash encadenado.
4. Sesiones con expiración y revocación.
5. Contraseñas con hash fuerte; nunca en texto plano.
6. Acciones sensibles exigen motivo.

**Estados.** Usuario: `activo`, `bloqueado`, `inactivo`.

**Pantallas.** Usuarios, roles, permisos, auditoría, sesiones.

**Depende de.** `core`.

**Aceptación.**
- Un usuario sin permiso no puede postear ni cerrar.
- La auditoría detecta alteración por hash.
- Cambiar roles queda auditado.

---

## 14. `integrations` — Integraciones e IA

**Objetivo.** Conectar DIAN, bancos, e-commerce/CRM y el asistente, con contratos
estables y reintentos.

**Origen funcional.** RPC/JSON, conectores (concepto).

**Entidades.** `intg.conector`, `ejecucion`, `mapeo`, `webhook`, `api_key`.

**Comandos.**
- CRUD de conectores y mapeos.
- `POST /conectores/{id}/probar`, `POST /conectores/{id}/sincronizar`.
- `POST /webhooks/{conector}`, `GET /ejecuciones`.
- `POST /ia/consulta` (delegado a `ia-service`).

**Reglas.**
1. Cada integración tiene contrato versionado y timeout.
2. Reintentos con backoff y deduplicación.
3. Secretos cifrados; nunca en logs.
4. Webhooks firmados y verificados.
5. La IA solo consulta datos autorizados y no inventa procedimientos.
6. Un fallo externo no revierte un asiento ya confirmado.

**Estados.** Ejecución: `pendiente`, `en_proceso`, `exitosa`, `fallida`,
`reintentando`.

**Pantallas.** Conectores, ejecuciones, webhooks, API keys, asistente.

**Depende de.** Todos (solo a través de APIs públicas).

**Aceptación.**
- Reenviar un webhook no duplica el efecto.
- Un timeout deja trazabilidad y reintento.
- La IA responde solo con datos y funcionalidad existentes.
