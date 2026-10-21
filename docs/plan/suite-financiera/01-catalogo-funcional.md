# 01 — Catálogo funcional a implementar

Este documento es el inventario cerrado de **lo que debemos construir**: una
función por ID, con su origen funcional, reglas y aceptación. No es un análisis
comparativo de productos ni una lista de deseos: es la especificación de
alcance que se implementa, se prueba y se acepta.

Cada función tiene: qué debe hacer, reglas, datos/API y criterio de aceptación.
Una función sin criterio de aceptación no se considera especificada.

## 1. Alcance del catálogo

| Métrica | Valor |
|---|---:|
| Módulos | 14 |
| Funciones especificadas | **159** |
| Fases del roadmap | 7 (0–6) |
| Documento de flujo | `04-flujo-del-dato.md` |
| Contrato de módulos | `06-modulos.md` |
| Normativa | `05-normativa-colombiana.md` |

## 2. Módulos y archivos

| Módulo | Funciones | Archivo | Fase |
|---|---:|---|---|
| `core` | 10 | `funcionalidades/01-core.md` | 0 |
| `maestros` | 12 | `funcionalidades/02-maestros.md` | 1 |
| `ledger` | 12 | `funcionalidades/03-ledger.md` | 1 |
| `invoicing` | 12 | `funcionalidades/04-invoicing.md` | 2 |
| `receivables` | 12 | `funcionalidades/05-receivables.md` | 2 |
| `payables` | 12 | `funcionalidades/06-payables.md` | 2 |
| `banking` | 12 | `funcionalidades/07-banking.md` | 3 |
| `assets` | 10 | `funcionalidades/08-assets.md` | 3 |
| `budgeting` | 10 | `funcionalidades/09-budgeting.md` | 4 |
| `taxes` | 14 | `funcionalidades/10-taxes.md` | 2 y 5 |
| `reporting` | 14 | `funcionalidades/11-reporting.md` | 4 |
| `closing` | 11 | `funcionalidades/12-closing.md` | 4 |
| `security` | 9 | `funcionalidades/13-security.md` | 0 |
| `integrations` | 9 | `funcionalidades/14-integrations.md` | 2 y 5 |
| **Total** | **159** | | |

## 3. Trazabilidad funcional (qué tomamos y qué construimos)

La columna “origen” identifica de dónde salió la capacidad funcional que se
implementa. No implica dependencia de código ni de licencia.

| Capacidad | Origen funcional | Funciones a implementar |
|---|---|---|
| Compañías, periodos, monedas, secuencias, bloqueos | Odoo `res.company`, `res.currency`, `ir.sequence` (Community) | F-CORE-001 a F-CORE-010 |
| PUC, terceros, centros, diarios, condiciones, productos | Odoo `account.account`, `res.partner`, `analytic.account`, `account.journal`, `account.payment.term`, `product.product`, `l10n_co` (Community) | F-MST-001 a F-MST-012 |
| Asientos, lotes, reversión, mayor, comprobación | Odoo `account.move`, `account.move.line`, `account.journal` (Community); libros de `account_reports` (Enterprise) | F-LED-001 a F-LED-012 |
| Facturas, notas, impuestos por línea, DIAN | Odoo `account` (Community); `l10n_co_edi` (Enterprise) | F-INV-001 a F-INV-012 |
| Cartera, recibos, aplicación, aging, cobro | Partidas abiertas de `account`; `account_reports` y `account_followup` (Enterprise) | F-AR-001 a F-AR-012 |
| CxP, propuestas, pagos, retenciones, gastos | `account`, `account_payment`, `hr_expense` (Community); batch/aging (Enterprise) | F-AP-001 a F-AP-012 |
| Bancos, extractos, conciliación | `account` (Community); `account_accountant` (Enterprise) | F-BNK-001 a F-BNK-012 |
| Activos fijos y depreciación | `account_asset` (Enterprise) | F-AST-001 a F-AST-010 |
| Presupuesto y control | `account_budget` (Enterprise) | F-BGT-001 a F-BGT-010 |
| IVA, retenciones, ICA, exógena, medios, DIAN | `account.tax`, `account.fiscal.position`, `l10n_co` (Community); `account_reports`, `l10n_co_edi` (Enterprise); exógena/medios: normativa colombiana | F-TAX-001 a F-TAX-014 |
| Estados financieros, libros, NIIF, snapshots | `account_reports` (Enterprise); motor `account.report` (Community) | F-RPT-001 a F-RPT-014 |
| Cierres, apertura, consolidación | `account` (Community); `account_consolidation` (Enterprise) | F-CLS-001 a F-CLS-011 |
| Usuarios, roles, auditoría, inalterabilidad | `base`, ACL y audit trail de `account` (Community) | F-SEC-001 a F-SEC-009 |
| DIAN, bancos, e-commerce/CRM, IA, API | `base` RPC/JSON, `payment`, IO/AI (Community/Enterprise) | F-INT-001 a F-INT-009 |

## 4. Reglas transversales de toda función

Toda función del catálogo debe cumplir, sin excepción:

1. **Compañía.** Valida `compania_id` y no mezcla datos entre compañías.
2. **Permiso.** Valida el permiso en el servicio, no solo en la UI.
3. **Auditoría.** Registra actor, fecha, antes/después y motivo cuando aplica.
4. **Idempotencia.** Si crea o modifica dinero/documentos, acepta
   `Idempotency-Key`.
5. **Transacción.** Una operación de negocio = una transacción.
6. **Inmutabilidad.** No edita ni borra documentos contabilizados.
7. **Trazabilidad.** Todo saldo tiene asiento y toda partida tiene documento.
8. **Moneda.** Guarda importe en moneda del documento y funcional.
9. **Redondeo.** Usa importes decimales, nunca `float`.
10. **Error.** Devuelve error estructurado, sin filtrar datos sensibles.
11. **Prueba.** Tiene prueba de invariante y caso de aceptación.
12. **Documentación.** Actualiza este catálogo y el módulo si cambia el alcance.

## 5. Ciclo de vida de una función

```text
planeada → en_diseño → en_implementación → en_pruebas → aceptada → desplegada
```

Reglas:

- `aceptada` exige criterio de aceptación, prueba automatizada y validación
  funcional (contador/revisor cuando aplica).
- `desplegada` exige migración, feature flag y monitoreo.
- Una función no puede pasar a `en_implementación` si su fase anterior no está
  cerrada.
- El estado se mantiene en el backlog (`07-roadmap.md`) y en el tablero del
  equipo; este catálogo define el alcance, no el avance diario.

## 6. Qué se toma de Odoo Community y qué de Enterprise

| Bloque | Community | Enterprise |
|---|---|---|
| Contabilidad base | ✅ asientos, plan, diarios, impuestos, periodos, secuencias, audit trail | — |
| Facturación | ✅ facturas, notas, pagos, condiciones | ✅ facturación electrónica DIAN (`l10n_co_edi`) |
| Cartera/CxP | ✅ documentos y pagos | ✅ aging, mayor por tercero, recordatorios, batch de pagos |
| Bancos | ✅ cuentas, extractos manuales | ✅ conciliación asistida y sync |
| Activos | — | ✅ `account_asset` |
| Presupuesto | — | ✅ `account_budget` |
| Consolidación | — | ✅ `account_consolidation` |
| Informes | ✅ motor y algunos reportes | ✅ estados financieros y libros completos |
| Exógena/medios | ❌ no existe | ❌ no existe |
| Nómina | — | ✅ (fuera de alcance) |

Todo lo que aparece como ✅ o ✅ Enterprise en esta tabla está desglosado en las
funciones F-XXX correspondientes. Lo que no está en el catálogo **no se
implementa** en esta versión.

## 7. Fuera del catálogo

- Inventario, costos y manufactura.
- Nómina y seguridad social.
- CRM y e-commerce (se integran).
- Declaraciones y firma ante la DIAN (se generan/exportan; la presentación es
  externa).
- Apps móviles.
- Multi-país.

## 8. Cómo se modifica el catálogo

1. Una función nueva entra con ID, módulo, fase, reglas y aceptación.
2. Si cambia el alcance de una función existente, se actualiza su archivo y el
   `07-roadmap.md`.
3. Si el cambio afecta modelo de datos o flujo, se crea un ADR.
4. Si el cambio afecta normativa, lo valida el contador/revisor.
5. No se elimina una función aceptada sin dejar registro y justificación.

## 9. Relación con los demás documentos

- `02-arquitectura.md`: dónde vive cada función.
- `03-modelo-datos.md`: qué tablas usa.
- `04-flujo-del-dato.md`: cómo se mueve el dato entre funciones.
- `05-normativa-colombiana.md`: qué exige Colombia.
- `06-modulos.md`: contrato de módulo, estados y criterios globales.
- `07-roadmap.md`: cuándo se implementa.
- `08-calidad-y-operacion.md`: cómo se prueba y opera.
- `09-migracion-legado.md`: cómo llegan los datos del legado.
- `10-adr.md`: decisiones que no se cambian sin registro.
