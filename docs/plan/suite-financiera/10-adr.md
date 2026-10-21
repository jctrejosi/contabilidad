# 10 — Registro de decisiones de arquitectura (ADR)

Formato: contexto, decisión, consecuencias. Una decisión aceptada solo se cambia
con un ADR nuevo que la reemplace.

---

## ADR-001 — Monolito modular, un repo y una base de datos

**Contexto.** La suite incluye contabilidad, facturación, cartera, CxP, bancos,
activos, presupuesto, impuestos, informes y cierres. Son un mismo dominio con
transacciones compartidas. Hoy el backend es un archivo de ~4.832 líneas y 195
rutas.

**Decisión.** Un solo repositorio, un backend desplegable, un frontend y una base
PostgreSQL, con módulos internos de límites explícitos. No microservicios ni un
repo por función.

**Consecuencias.**
- Transacciones locales y consistentes.
- Un solo despliegue, backup y esquema de permisos.
- Exige disciplina de límites y revisión de arquitectura.
- Si un módulo necesita escalar o aislarse, se extrae después con un ADR.

---

## ADR-002 — El libro contable es la fuente de verdad

**Contexto.** El sistema legado mantiene saldos y acumulados editables. Eso
permite inconsistencias y reprocesos.

**Decisión.** Todo saldo, impuesto, cartera, CxP y ejecución presupuestal se
deriva de asientos contabilizados. Las tablas de saldo son vistas o
materializaciones reconstruibles, nunca la verdad.

**Consecuencias.**
- Un solo lugar para corregir: el asiento (por reversión).
- Los informes son reproducibles.
- Se necesita rendimiento con vistas materializadas e índices.
- Se elimina el “ajuste manual de saldo”.

---

## ADR-003 — Documentos contabilizados inmutables y reversión

**Contexto.** Editar o borrar asientos rompe la auditoría y la trazabilidad
fiscal.

**Decisión.** Un asiento/documento contabilizado no se actualiza ni se elimina.
La corrección se hace con un asiento de reversión que referencia el original y
exige motivo. Las notas crédito/débito corrigen documentos comerciales.

**Consecuencias.**
- Trazabilidad completa y defendible ante auditoría.
- Más filas y necesidad de reportes que excluyan reversiones.
- La UI debe ocultar “editar/eliminar” en documentos posteados.

---

## ADR-004 — PostgreSQL canónico y Advantage de solo lectura

**Contexto.** El backend actual puede escribir en Advantage o PostgreSQL según
`CONTABDSI_STORE`. Mantener dos motores invita a divergencias.

**Decisión.** PostgreSQL es el almacén canónico de la suite. Advantage se usa
solo para leer datos legados durante la migración. Prohibida la doble escritura.

**Consecuencias.**
- Un solo modelo y una sola migración.
- El corte se hace por módulo y con conciliación.
- Las pantallas legadas siguen leyendo ADS hasta su corte.
- Se elimina el riesgo de transacciones distribuidas.

---

## ADR-005 — Multi-compañía con aislamiento estricto

**Contexto.** Varias compañías comparten maestros (terceros, PUC) pero tienen
contabilidad, secuencias y periodos propios.

**Decisión.** `compania_id` obligatorio en entidades transaccionales; permisos
por compañía; validación en servicio y RLS opcional. Las operaciones
intercompañía se registran con cuentas de enlace y aprobación explícita.

**Consecuencias.**
- Consultas y reportes siempre filtran por compañía.
- La consolidación es un proceso explícito, no un `JOIN` accidental.
- Un usuario puede tener roles distintos por compañía.

---

## ADR-006 — Precisión monetaria y redondeo

**Contexto.** Los errores de redondeo se acumulan y rompen cuadres.

**Decisión.** `NUMERIC(18,2)` para importes, `NUMERIC(18,8)` para tasas,
`NUMERIC(9,6)` para porcentajes. Cálculo por línea; redondeo half-up configurable;
línea de ajuste por diferencia si el documento lo requiere. Prohibido `float`.

**Consecuencias.**
- Cuadres exactos y reproducibles.
- La base y la cuota se guardan por línea.
- Las diferencias de cambio se reconocen explícitamente.

---

## ADR-007 — Secuencias, idempotencia y concurrencia

**Contexto.** Dos usuarios pueden postear a la vez; un reintento puede duplicar
una factura.

**Decisión.** Secuencia reservada con bloqueo de fila en la misma transacción.
Todo comando de creación exige `Idempotency-Key` única. Las partidas abiertas se
bloquean en orden de `id`.

**Consecuencias.**
- Sin números duplicados ni huecos.
- Reintentos seguros.
- Mayor contención en secuencias; se mitiga con secuencias por diario/tipo.

---

## ADR-008 — Outbox transaccional para efectos asíncronos

**Contexto.** Enviar DIAN, notificar o generar snapshots no debe bloquear el
posteo ni perderse si el servicio externo falla.

**Decisión.** Los eventos se escriben en `core.outbox` dentro de la transacción
del comando. Un worker los publica con reintentos y deduplicación.

**Consecuencias.**
- El posteo es atómico y rápido.
- Los efectos externos son eventuales y monitoreables.
- Se requiere idempotencia en los consumidores.

---

## ADR-009 — Catálogo funcional propio derivado de Odoo

**Contexto.** Odoo cubre el dominio financiero, pero su edición completa es
propietaria y su stack no es el de CONTABDSI. Usarlo solo como “referencia”
dejaba el alcance ambiguo.

**Decisión.** Se tomó su inventario funcional (Community y Enterprise), se
desglosó en 159 funciones con ID y se especificó cada una en
`01-catalogo-funcional.md` y `funcionalidades/`. La implementación es propia en
el stack actual. No se copia código Enterprise ni se depende de Odoo en runtime.

**Consecuencias.**
- Alcance medible y verificable función por función.
- Libertad de evolución y control del dato.
- Mayor esfuerzo de construcción.
- Obligación de mantener el catálogo actualizado; una función nueva entra por el
  procedimiento del catálogo.

---

## ADR-010 — DIAN mediante proveedor certificado

**Contexto.** La facturación electrónica exige UBL 2.1, firma, numeración
autorizada, CUFE y transmisión. Implementarlo desde cero es riesgoso.

**Decisión.** Integrar un proveedor certificado detrás de un adaptador
(`integrations/dian`). La suite conserva el documento, la resolución, el XML, el
CUFE y los estados.

**Consecuencias.**
- Menor riesgo regulatorio y más rápida salida a producción.
- Dependencia contractual del proveedor.
- El adaptador permite cambiar de proveedor sin tocar facturación.

---

## ADR-011 — Snapshots para informes certificables

**Contexto.** Un informe firmado no puede cambiar si se postea un asiento
posterior.

**Decisión.** Los informes certificables se congelan en `rpt.snapshot` con líneas,
hash y firma. Los informes operativos pueden recalcularse.

**Consecuencias.**
- Evidencia estable para auditoría y revisor fiscal.
- Almacenamiento adicional.
- Se debe versionar la definición del informe.

---

## ADR-012 — Seguridad por roles, compañía y auditoría inmutable

**Contexto.** El dinero y el cumplimiento exigen segregación y trazabilidad.

**Decisión.** RBAC por módulo/acción, alcance por compañía, segregación de
funciones y auditoría append-only con hash encadenado.

**Consecuencias.**
- Control granular y defendible.
- Más complejidad de administración.
- Toda acción sensible exige motivo y queda registrada.

---

## ADR-013 — Inventario y nómina fuera del alcance inicial

**Contexto.** La suite financiera puede crecer sin límite y perder foco.

**Decisión.** Inventario, costos, manufactura y nómina no se implementan en la
primera versión. Se integran por API o se abordan en una fase posterior.

**Consecuencias.**
- Foco en el ciclo financiero.
- La facturación no maneja stock.
- Si se requiere inventario, se decide entre integración y módulo propio con un
  ADR nuevo.

---

## ADR-014 — Ejecución presupuestal derivada del libro

**Contexto.** El presupuesto no debe mantenerse con digitación paralela.

**Decisión.** El presupuesto aprobado es inmutable por versión; la ejecución se
calcula del libro y los compromisos se registran al validar documentos.

**Consecuencias.**
- Real vs. presupuesto siempre cuadra.
- Los compromisos requieren liberación explícita al reversar.
- El control puede bloquear o avisar según configuración.
