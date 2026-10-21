# Funcionalidades — `maestros`

Origen funcional (inventario de partida): Odoo `account.account`,
`res.partner`, `analytic.account`, `account.journal`,
`account.payment.term`, `product.product`, importador/exportador (Community) y
`l10n_co` para PUC y NIT.

## F-MST-001 — Plan de cuentas jerárquico

**Debe hacer.** Crear, editar, inactivar y consultar cuentas por compañía con
código, nombre, naturaleza, nivel, padre, flags y estado.

**Reglas.** Código único por compañía; padre existente y de nivel inmediatamente
anterior; no se cambia el código de una cuenta con movimientos; la jerarquía se
valida por prefijo; la cuenta padre no recibe movimientos si tiene hijas
afectables.

**Datos/API.** `mst.cuenta`; CRUD en `/api/v1/masters/cuentas`; importación y
exportación.

**Aceptación.** Cuenta con padre inexistente o nivel inválido se rechaza; cuenta
con movimientos no cambia de código; el árbol cuadra por prefijo.

---

## F-MST-002 — Cuentas afectables y flags de uso

**Debe hacer.** Marcar si una cuenta recibe movimientos y si exige tercero,
centro, base o clasificación fiscal.

**Reglas.** Solo afectables reciben líneas; `requiere_tercero` obliga NIT;
`requiere_centro` obliga centro; `requiere_base` obliga base de impuesto;
`tipo_fiscal` clasifica para informes y NIIF.

**Datos/API.** `mst.cuenta`; validación en `ledger.post` y facturación.

**Aceptación.** Una línea sin tercero/centro cuando la cuenta lo exige se
rechaza; una cuenta no afectable no se usa en asientos.

---

## F-MST-003 — Terceros y NIT

**Debe hacer.** Crear, editar, inactivar y consultar terceros con tipo de
persona, tipo y número de documento, NIT, DV, razón social, nombres, dirección,
municipio, contactos, condición de pago y cupo.

**Reglas.** NIT único; DV calculado y validado; municipio obligatorio para
ICA/exógena; no se elimina un tercero con movimientos; duplicados se unifican
con auditoría.

**Datos/API.** `mst.tercero`; CRUD en `/api/v1/masters/terceros`;
`POST /terceros/{id}/unificar`.

**Aceptación.** NIT duplicado rechazado; DV inválido rechazado; tercero con
movimientos no se elimina; unificación conserva referencias.

---

## F-MST-004 — Régimen y responsabilidades fiscales

**Debe hacer.** Asignar régimen (común, simple, no responsable) y
responsabilidades (IVA, agente retenedor, autorretenedor, informante, etc.).

**Reglas.** Las responsabilidades determinan impuestos, retenciones y reportes;
un cambio aplica a documentos futuros, no a históricos; la combinación
régimen/responsabilidad debe ser válida.

**Datos/API.** `mst.tercero.responsabilidades`; catálogo `tax.responsabilidad`.

**Aceptación.** Un tercero no responsable de IVA no recibe IVA por defecto; el
cambio no altera facturas contabilizadas; el reporte de exógena usa la vigencia
correcta.

---

## F-MST-005 — Cuentas bancarias del tercero

**Debe hacer.** Registrar banco, tipo y número de cuenta, moneda y estado por
tercero.

**Reglas.** Una cuenta por defecto por tercero/moneda; número enmascarado en
consultas; no se elimina si tiene pagos asociados.

**Datos/API.** `mst.tercero_cuenta_bancaria`; CRUD anidado en terceros.

**Aceptación.** Pago usa la cuenta por defecto o la seleccionada; cuenta con
pagos no se elimina; el número completo solo lo ve un rol autorizado.

---

## F-MST-006 — Centros de costo y analítica

**Debe hacer.** Crear centros jerárquicos y permitir distribución analítica por
línea.

**Reglas.** Código único por compañía; padre existente; centro inactivo no
recibe movimientos; la distribución analítica debe sumar 100 %; la cuenta puede
exigir centro.

**Datos/API.** `mst.centro`; CRUD en `/api/v1/masters/centros`; distribución en
`led.asiento_linea`.

**Aceptación.** Distribución que no suma 100 % se rechaza; centro de otra
compañía se rechaza; los informes por centro cuadran con el libro.

---

## F-MST-007 — Diarios

**Debe hacer.** Crear diarios por tipo (ventas, compras, banco, caja, general),
con código, nombre, secuencia y cuenta de contrapartida.

**Reglas.** Código único por compañía; diario con movimientos no se elimina; el
tipo determina las operaciones permitidas; el diario bancario exige cuenta
bancaria.

**Datos/API.** `mst.diario`; CRUD en `/api/v1/masters/diarios`.

**Aceptación.** No se postea en diario de otra compañía; un diario de ventas no
acepta una compra; diario con asientos no se elimina.

---

## F-MST-008 — Tipos de documento

**Debe hacer.** Definir tipos con código, nombre, módulo, naturaleza, prefijo,
diario por defecto, si contabiliza, flujo y tipo DIAN.

**Reglas.** Código único; un tipo que contabiliza exige diario; el prefijo y la
resolución deben ser compatibles; el tipo determina la secuencia; no se cambia
con documentos emitidos.

**Datos/API.** `mst.tipo_documento`; CRUD en `/api/v1/masters/tipos-documento`.

**Aceptación.** Documento sin tipo válido no se crea; tipo con documentos no
cambia de prefijo; la factura electrónica exige tipo DIAN.

---

## F-MST-009 — Condiciones de pago

**Debe hacer.** Definir condiciones con días y cuotas; calcular vencimientos.

**Reglas.** La suma de cuotas = 100 % del total; la primera cuota puede ser al
contado; la condición se congela en el documento; no se edita si está en uso.

**Datos/API.** `mst.condicion_pago`; CRUD en `/api/v1/masters/condiciones-pago`.

**Aceptación.** Vencimientos suman el total; condición en uso no se elimina; el
cambio no altera documentos existentes.

---

## F-MST-010 — Productos y servicios

**Debe hacer.** Mantener catálogo de bienes/servicios con código, nombre,
impuesto, cuenta de ingreso/gasto, precio y estado.

**Reglas.** Código único; un producto de venta exige cuenta de ingreso; uno de
compra, cuenta de gasto; no maneja inventario; el impuesto por defecto se puede
sobrescribir por línea.

**Datos/API.** `mst.producto`; CRUD en `/api/v1/masters/productos`.

**Aceptación.** Factura usa la cuenta/impuesto del producto o el override; un
producto inactivo no se selecciona; no hay movimientos de stock.

---

## F-MST-011 — Unificación de terceros

**Debe hacer.** Fusionar dos terceros duplicados conservando movimientos,
documentos, cuentas bancarias y contactos.

**Reglas.** Requiere motivo y aprobación; el NIT destino queda único; las
referencias se actualizan en una transacción; se conserva el histórico del
origen inactivo.

**Datos/API.** `POST /api/v1/masters/terceros/{id}/unificar`.

**Aceptación.** Después de unificar, no quedan referencias al tercero origen; los
saldos cuadran; la acción queda auditada.

---

## F-MST-012 — Importación y exportación de maestros

**Debe hacer.** Importar/exportar cuentas, terceros, centros, diarios y
productos en CSV/XLSX con mapeo de columnas y vista previa.

**Reglas.** Validación fila a fila; errores con número de fila y causa; modo
`dryRun`; importación idempotente por clave; no se importan duplicados sin
decisión explícita.

**Datos/API.** `POST /api/v1/masters/importar`, `GET /exportar`.

**Aceptación.** Un archivo inválido no deja datos parciales; el `dryRun` informa
errores sin escribir; reimportar el mismo archivo no duplica.
