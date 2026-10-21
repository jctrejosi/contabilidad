# Funcionalidades — `integrations`

Origen funcional (inventario de partida): RPC/JSON de Odoo `base`, conectores de
pago y correo (Community); IO/AI de Odoo (Enterprise, según versión).

## F-INT-001 — Registro de conectores

**Debe hacer.** Registrar conectores con código, tipo, configuración, estado y
credenciales cifradas.

**Reglas.** Código único; configuración validada por tipo; secretos cifrados y
nunca en logs; un conector inactivo no se ejecuta; el cambio se audita.

**Datos/API.** `intg.conector`; CRUD en `/api/v1/integrations/conectores`.

**Aceptación.** Sin configuración válida no se activa; el secreto no se expone;
el cambio queda auditado.

---

## F-INT-002 — Integración DIAN

**Debe hacer.** Enviar facturas/notas al proveedor certificado, recibir
CUFE/estado, reintentar y consultar.

**Reglas.** Contrato versionado; idempotencia por documento; timeout y backoff;
un fallo no revierte el asiento; el XML/CUFE se conserva; la contingencia se
marca.

**Datos/API.** `inv.dian_documento`, `intg.ejecucion`;
`POST /api/v1/integrations/dian/documentos/{id}/enviar`.

**Aceptación.** El envío repetido no duplica; el estado refleja la respuesta; el
fallo queda reintentable.

---

## F-INT-003 — Integración bancaria

**Debe hacer.** Importar extractos y, si se contrata, sincronizar movimientos y
saldos.

**Reglas.** Archivo con hash y deduplicación; credenciales cifradas; la
conciliación es del módulo `banking`; un fallo de sincronización no altera el
libro.

**Datos/API.** `bnk.extracto`, `intg.ejecucion`;
`POST /api/v1/integrations/bancos/sincronizar`.

**Aceptación.** No se duplican líneas; el extracto importado es válido; el error
se reporta sin romper la conciliación existente.

---

## F-INT-004 — E-commerce y CRM

**Debe hacer.** Recibir pedidos/facturas o enviar documentos y estados a los
proyectos hermanos (e-commerce/CRM).

**Reglas.** Contrato versionado; idempotencia por clave externa; mapeo de
terceros/productos; reintentos; un pedido no se factura dos veces.

**Datos/API.** `intg.mapeo`, `intg.ejecucion`;
`POST /api/v1/integrations/ecommerce/pedidos`.

**Aceptación.** El mismo pedido no duplica factura; el mapeo es trazable; el
fallo se reintenta.

---

## F-INT-005 — Asistente IA

**Debe hacer.** Exponer al asistente consultas de solo lectura sobre datos
autorizados y explicaciones de procedimientos existentes.

**Reglas.** Nunca inventa datos ni funciones; respeta permisos y compañía; no
escribe en el libro; registra consulta y respuesta; el modelo no recibe secretos.

**Datos/API.** `POST /api/v1/integrations/ia/consulta` (delegado a `ia-service`).

**Aceptación.** Una pregunta sin dato responde que no existe; no puede postear ni
pagar; la consulta queda auditada.

---

## F-INT-006 — API keys y webhooks

**Debe hacer.** Emitir claves con scopes, expiración y estado; registrar webhooks
con secreto y eventos.

**Reglas.** La clave se muestra una sola vez; hash almacenado; scopes mínimos;
webhook firmado; reintentos; revocación inmediata.

**Datos/API.** `intg.api_key`, `intg.webhook`;
`POST /api/v1/integrations/api-keys`.

**Aceptación.** Una clave revocada no autentica; la firma del webhook se verifica;
el reintento no duplica.

---

## F-INT-007 — Outbox y reintentos

**Debe hacer.** Publicar eventos de dominio con reintentos, backoff y
deduplicación por consumidor.

**Reglas.** El evento se escribe en la transacción; el worker es idempotente;
estado `pendiente`, `procesando`, `exitoso`, `fallido`; alerta tras N fallos.

**Datos/API.** `core.outbox`, `intg.ejecucion`;
`GET /api/v1/integrations/outbox`.

**Aceptación.** Un fallo no pierde el evento; el reintento no duplica; la alerta
se dispara.

---

## F-INT-008 — Observabilidad de integraciones

**Debe hacer.** Mostrar estado, latencia, errores y últimas ejecuciones por
conector.

**Reglas.** Sin exponer secretos; retención configurable; filtros por conector y
estado; exportable.

**Datos/API.** `GET /api/v1/integrations/ejecuciones`.

**Aceptación.** El estado refleja la última ejecución; el error es legible; el
dashboard no filtra secretos.

---

## F-INT-009 — Importación y exportación externa

**Debe hacer.** Intercambiar archivos con terceros (bancos, DIAN, CRM) con
validación de formato y hash.

**Reglas.** Validación de tipo/tamaño; hash; cuarentena de archivos inválidos;
procesamiento idempotente; trazabilidad de origen.

**Datos/API.** `intg.ejecucion`, `intg.archivo`;
`POST /api/v1/integrations/archivos`.

**Aceptación.** Un archivo inválido no se procesa; el mismo archivo no se duplica;
el origen queda registrado.
