# Plan de la suite financiera — CONTABDSI

> **Versión:** 1.0 (propuesta para aprobación)
> **Fecha:** 2026-10-21
> **Ámbito:** evolución de CONTABDSI desde libro contable legado hacia una suite
> financiera completa, con la normativa colombiana como requisito de primer nivel
> y un catálogo de **159 funciones a implementar**, derivado del inventario
> funcional de Odoo (Community y Enterprise) y especificado una por una.

Este es el **plan estratégico** de la suite. No sustituye al plan táctico de
backend (`docs/plan/backend/PLAN_BACKEND.md`), que cierra la brecha actual de
pantallas simuladas; lo enmarca y le da un destino. Cuando ambos difieran en
modelo de datos, arquitectura o flujo del dato, prevalece este plan.

## 1. Qué se construye

Una suite financiera para Colombia que cubra, en un solo sistema:

| Módulo | Qué resuelve |
|---|---|
| `core` | Compañías, años, periodos, monedas, tasas, secuencias, bloqueos, eventos |
| `maestros` | Plan de cuentas (PUC), terceros, centros de costo, diarios, tipos de documento, condiciones de pago |
| `ledger` | Asientos, lotes, contabilización, reversión, libro mayor y auxiliares |
| `invoicing` | Facturas de venta y compra, notas crédito/débito, facturación electrónica DIAN |
| `receivables` | Cartera (CxC), recibos, aplicación de pagos, edades, estados de cuenta, cobro |
| `payables` | CxP, propuestas de pago, pagos, retenciones, anticipos, gastos |
| `banking` | Cuentas bancarias, extractos, conciliación, transferencias, cheques, caja |
| `assets` | Activos fijos, depreciación, bajas, revalorización, deterioro |
| `budgeting` | Presupuestos por cuenta/centro/periodo, versiones, control y ejecución |
| `taxes` | IVA, retenciones, ICA, exógena, medios magnéticos, calendario tributario |
| `reporting` | Estados financieros, libros, informes NIIF, comparativos, snapshots |
| `closing` | Cierres mensuales/anuales, asientos de cierre, consolidación |
| `security` | Usuarios, roles, permisos, alcance por compañía, auditoría inmutable |
| `integrations` | DIAN, bancos, e-commerce/CRM, IA, API y webhooks |

## 2. Principios rectores

1. **Un solo sistema, un solo repo, una sola base de datos.** Monolito modular,
   no microservicios ni un repositorio por función. Ver `10-adr.md` (ADR-001).
2. **El libro es la fuente de verdad.** Todo saldo, informe, presupuesto ejecutado
   o acumulado fiscal se deriva de asientos contabilizados. Ver ADR-002.
3. **Lo contabilizado es inmutable.** Corrección por reversión, nunca por edición
   o borrado. Ver ADR-003.
4. **PostgreSQL es el almacén canónico.** Advantage queda como fuente legada de
   solo lectura durante la transición; prohibido el doble escritura. Ver ADR-004.
5. **Colombia primero.** PUC, NIT/DV, IVA, retenciones, ICA, exógena, medios
   magnéticos, DIAN y NIIF son requisitos, no personalizaciones opcionales.
6. **Catálogo funcional cerrado y propio.** Cada funcionalidad a implementar
   tiene ID, reglas, datos/API y aceptación en `01-catalogo-funcional.md` y
   `funcionalidades/`. Odoo se usa como inventario funcional de partida; no hay
   dependencia de código ni de runtime, ni se copia código Enterprise.
7. **API primero y auditoría por defecto.** Toda operación pasa por un servicio
   de dominio, queda auditada y es idempotente.
8. **Transición sin doble escritura.** Cada módulo se certifica y se corta; el
   legado permanece de solo lectura hasta el corte.

## 3. Documentos del plan

| Documento | Contenido |
|---|---|
| `00-alcance.md` | Objetivos, actores, alcance dentro/fuera, supuestos, riesgos y criterios de éxito |
| `01-catalogo-funcional.md` | Catálogo de 159 funciones a implementar, con trazabilidad y criterios transversales |
| `funcionalidades/` | Especificación función por función, módulo por módulo (14 archivos) |
| `02-arquitectura.md` | Monolito modular, capas, módulos, API, transacciones, eventos, despliegue y seguridad |
| `03-modelo-datos.md` | Entidades por módulo, claves, estados, invariantes y mapeo con el esquema actual |
| `04-flujo-del-dato.md` | Flujo definitivo: factura → asiento → cartera → pago → banco → cierre, y los demás procesos |
| `05-normativa-colombiana.md` | PUC, IVA, retenciones, ICA, exógena, medios, DIAN, NIIF y calendario |
| `06-modulos.md` | Especificación funcional y técnica por módulo |
| `07-roadmap.md` | Fases, dependencias, entregables, criterios de salida y backlog |
| `08-calidad-y-operacion.md` | Pruebas, CI/CD, requisitos no funcionales, observabilidad y continuidad |
| `09-migracion-legado.md` | Estrategia de migración desde Advantage, conciliación y cutover |
| `10-adr.md` | Decisiones de arquitectura con contexto, decisión y consecuencias |
| `glosario.md` | Lenguaje común del dominio financiero y colombiano |

El **brief de diseño para Figma Make** se mantiene aparte, en
`../FIGMA_MAKE_SUITE.md`: es el entregable de diseño de los módulos de la suite y
no un documento de arquitectura.

## 4. Flujo del dato en una frase

Los maestros alimentan documentos; los documentos se validan y se contabilizan
en el libro mediante un único servicio de contabilización; el libro actualiza
cartera/CxP, impuestos, presupuesto e informes; los pagos y extractos concilian
contra las partidas abiertas; los cierres bloquean el periodo y producen saldos
de apertura; todo queda auditado y es reconstruible. El detalle normativo y
técnico está en `04-flujo-del-dato.md`.

## 5. Roadmap resumido

| Fase | Entregable | Depende de |
|---|---|---|
| 0 | Fundaciones: refactor a routers, core, seguridad, auditoría, migraciones, CI | — |
| 1 | Maestros + libro (asientos, lotes, reversión, periodos, secuencias) | 0 |
| 2 | Facturación + cartera + CxP + pagos | 1 |
| 3 | Bancos + activos fijos | 1, 2 |
| 4 | Presupuesto + informes + cierres + consolidación | 1, 2, 3 |
| 5 | DIAN: facturación electrónica, exógena y medios magnéticos | 2, 4 |
| 6 | Migración, cutover y hardening | 1–5 |

Las fases 3, 4 y 5 pueden solaparse por equipos, pero no pueden adelantar
entidades de fases anteriores. El detalle y los criterios de salida están en
`07-roadmap.md`.

## 6. Cómo se gobierna este plan

- Cada decisión estructural vive en `10-adr.md`; no se cambia sin un ADR nuevo
  o una enmienda explícita.
- Cada módulo tiene criterios de aceptación en `06-modulos.md`; una fase no se
  cierra sin ellos y sin las pruebas de `08-calidad-y-operacion.md`.
- Los cambios de alcance se registran en `07-roadmap.md` (sección de control de
  cambios) y se reflejan en el módulo afectado.
- La documentación existente (`docs/maestros/`, `docs/movimientos/`,
  `docs/informes/`, `docs/plan/backend/`) sigue siendo la especificación del
  legado y del estado actual; este plan define el destino.

## 7. Criterios de éxito

1. Un asiento contabilizado produce, en la misma transacción, sus efectos en
   libro, cartera/CxP, impuestos y presupuesto; si algo falla, no queda nada.
2. Ningún saldo se edita a mano: todos son reconstruibles desde el libro.
3. Un documento contabilizado no se modifica ni se borra; se revierte con
   trazabilidad completa.
4. Un cierre de periodo es reproducible, auditable y bloquea escrituras.
5. La declaración de IVA, la retención y la información exógena salen del mismo
   dato que el libro, sin reconciliaciones manuales.
6. La operación colombiana (PUC, NIT, UVT, DIAN, medios) funciona sin planillas
   paralelas.
7. La migración desde Advantage cuadra por cuenta, tercero y periodo antes del
   corte.
