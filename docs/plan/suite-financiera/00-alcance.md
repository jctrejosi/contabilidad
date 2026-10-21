# 00 — Alcance, actores y decisiones de producto

## 1. Contexto

CONTABDSI nació como modernización del sistema contable legado sobre Advantage
Data Server. Hoy tiene un modelo PostgreSQL de 60 entidades, 195 rutas de API y
51 pantallas, pero su alcance funcional sigue siendo el de un **libro contable
fiscal**: registro, consulta, informes y tributación. No cubre el ciclo
financiero completo.

La suite financiera amplía ese alcance para que contabilidad, presupuesto,
bancos, cartera, CxP, facturación y activos fijos convivan en el mismo sistema,
con un único flujo de dato y una única fuente de verdad.

## 2. Objetivos

### 2.1 Objetivos de negocio

1. Cerrar el ciclo financiero de punta a punta sin planillas ni sistemas
   paralelos.
2. Reducir el tiempo de cierre mensual y eliminar conciliaciones manuales entre
   contabilidad, cartera, CxP, bancos y presupuesto.
3. Cumplir la normativa colombiana (PUC, IVA, retenciones, ICA, exógena, medios
   magnéticos, DIAN, NIIF) desde el mismo dato contable.
4. Dar trazabilidad completa: quién, cuándo, qué y por qué de cada operación.
5. Permitir crecimiento multi-compañía y multi-moneda sin rehacer el modelo.

### 2.2 Objetivos técnicos

1. Un backend modular, un frontend por features, una base PostgreSQL canónica.
2. Un único servicio de contabilización para todos los documentos.
3. Asientos inmutables, reversión trazable y auditoría append-only.
4. Idempotencia, transacciones atómicas y concurrencia segura en secuencias y
   partidas abiertas.
5. Reportes reproducibles y certificables mediante snapshots.
6. Migración desde Advantage sin doble escritura y con conciliación formal.

### 2.3 Objetivos de cumplimiento

1. Plan Único de Cuentas (PUC) con jerarquía y cuentas afectables.
2. Facturación electrónica DIAN (UBL 2.1, CUFE, numeración autorizada, notas).
3. Información exógena y medios magnéticos con validaciones y exportación.
4. IVA, retenciones en la fuente, reteIVA, reteICA y autorretenciones.
5. Estados financieros y ESFA/NIIF a partir del libro.
6. Cierres y bloqueos de periodo reproducibles.

## 3. Actores y roles

| Actor | Necesita |
|---|---|
| Contador | Registrar, revisar y cerrar; informes y declaraciones |
| Auxiliar contable | Captura, lotes, importaciones, consultas |
| Tesorero | Bancos, pagos, conciliación, flujo de caja |
| Analista de cartera | CxC, edades, cobro, acuerdos de pago |
| Analista de CxP | Facturas de proveedor, propuestas de pago, retenciones |
| Compras | Facturas de proveedor y compromisos presupuestales |
| Gerencia | Estados financieros, presupuesto vs. real, indicadores |
| Auditor / revisor fiscal | Trazabilidad, inmutabilidad, soportes, snapshots |
| Administrador | Usuarios, roles, compañías, parámetros, integraciones |
| Asistente IA | Consultar y explicar datos y procedimientos sin inventar |

Los permisos se definen por rol + módulo + acción + compañía. El detalle está en
`02-arquitectura.md` y `06-modulos.md` (módulo `security`).

## 4. Alcance

### 4.1 Dentro del alcance

- Contabilidad general y auxiliares.
- Facturación de venta y compra (sin inventario).
- Cartera y CxP con partidas abiertas y aplicación de pagos.
- Tesorería: bancos, extractos, conciliación, transferencias, cheques y caja.
- Activos fijos con depreciación contable y fiscal.
- Presupuesto por cuenta, centro y periodo, con control.
- Impuestos colombianos y facturación electrónica DIAN.
- Informes financieros, NIIF, comparativos y snapshots certificables.
- Cierres mensuales/anuales y consolidación multi-compañía.
- Seguridad, auditoría, integraciones y asistente IA.

### 4.2 Fuera del alcance (por ahora)

| Tema | Decisión | Motivo |
|---|---|---|
| Inventario, costos y manufactura | Integrar o fase posterior | Otro contexto; requiere valoración de inventario |
| Nómina | Integrar (o fase posterior) | Alta complejidad legal y de seguridad social |
| CRM y e-commerce | Integrar por API | Ya existen como proyectos hermanos |
| Facturación electrónica propia (firma/UBL) | Integrar proveedor certificado primero | Riesgo regulatorio y de firma; se puede internalizar después |
| Declaraciones tributarias ante DIAN | Generar y exportar; no presentar | La presentación exige responsabilidad y firma del contribuyente |
| Apps móviles | No | Fuera del alcance de la suite |
| Multi-país | No | Colombia primero; el modelo deja la puerta abierta |

### 4.3 Límites explícitos

- **No se reescribe el legado:** el esquema actual se evoluciona y se mapea.
- **No hay doble escritura:** PostgreSQL es canónico para los módulos nuevos;
  Advantage se lee para migración y convivencia hasta el corte.
- **No se copia código de Odoo Enterprise:** solo se replica funcionalidad.
- **No se promete presentación automática ante la DIAN:** se genera el XML y se
  integra con un proveedor autorizado.

## 5. Mapa de capacidades

```text
Finanzas
├── Contabilidad
│   ├── Maestros (PUC, terceros, centros, diarios)
│   ├── Libro (asientos, lotes, reversión)
│   ├── Cierres y consolidación
│   └── Informes y NIIF
├── Ciclo comercial
│   ├── Facturación (venta/compra)
│   ├── Cartera (CxC)
│   └── CxP y pagos
├── Tesorería
│   ├── Bancos y conciliación
│   └── Caja, cheques y transferencias
├── Planeación
│   ├── Presupuesto
│   └── Control y ejecución
├── Activos fijos
│   ├── Registro y depreciación
│   └── Bajas, revalorización y deterioro
├── Tributario
│   ├── IVA, retenciones e ICA
│   ├── Exógena y medios magnéticos
│   └── Facturación electrónica DIAN
└── Transversal
    ├── Seguridad y auditoría
    ├── Integraciones
    └── Asistente IA
```

## 6. Supuestos

1. La operación es Colombia y la moneda funcional principal es COP, con
   posibilidad de moneda extranjera por documento.
2. Una o varias compañías comparten terceros y PUC, pero cada una tiene su
   contabilidad, secuencias y periodos.
3. La contabilidad es de causación (devengo), no de caja.
4. Los documentos se contabilizan una vez y se corrigen por reversión.
5. El usuario necesita trazabilidad y auditoría, no solo el resultado.
6. La migración desde Advantage es parte del proyecto, no un anexo.
7. El equipo puede asumir un monolito modular con despliegue único.

## 7. Riesgos principales

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Regulatorio (DIAN/cambios normativos) | Alto | Parametrización, catálogo versionado, validación con contador, integración con proveedor certificado |
| Migración de saldos y documentos | Alto | Conciliación por cuenta/tercero/periodo, corte por módulo, rollback |
| Calidad del dato legado | Alto | Perfilado, reglas de limpieza, maestros golden record |
| Alcance demasiado amplio | Alto | Fases con criterios de salida; nada de fase N sin cerrar N-1 |
| Complejidad transaccional | Medio | Un servicio de contabilización, una transacción por comando |
| Doble escritura accidental | Medio | Regla arquitectónica + pruebas + feature flag por módulo |
| Rendimiento de reportes | Medio | Vistas materializadas, snapshots, índices, límites de filas |
| Seguridad y fraude | Alto | RBAC, segregación de funciones, auditoría inmutable, aprobaciones |

## 8. Criterios de éxito medibles

1. **Cierre:** 100 % de los asientos del mes generados por la suite; cero ajustes
   manuales fuera del sistema.
2. **Conciliación:** diferencias banco-libro explicadas y conciliadas al 100 %.
3. **Cartera:** saldo por tercero = suma de partidas abiertas; aging reproducible.
4. **Impuestos:** IVA y retenciones del periodo cuadran con el libro sin ajustes.
5. **Exógena:** validación de 5 valores sin diferencias.
6. **Auditoría:** toda modificación tiene actor, fecha, antes/después y motivo.
7. **Migración:** conciliación formal firmada por contador antes del corte.

## 9. Catálogo funcional y trazabilidad

El alcance no se define como “referencia”: se tomó el inventario funcional de
Odoo (Community y Enterprise) y se desglosó en **159 funciones con ID, reglas,
datos/API y criterio de aceptación**. El catálogo está en
`01-catalogo-funcional.md` y el detalle, módulo por módulo, en
`funcionalidades/`.

Regla de decisión por función:

- **Se construye** la implementación propia en el stack actual, con reglas
  colombianas.
- **Se adapta** cuando la norma local exige un comportamiento distinto (PUC,
  retenciones, exógena, medios).
- **Se integra** un tercero cuando el riesgo regulatorio o la especialización lo
  justifican (DIAN, bancos).
- **Se excluye** lo que no aplica al alcance colombiano o al ciclo financiero.

Cada función del catálogo es la unidad de alcance, estimación, prueba y
aceptación. Lo que no está en el catálogo no se implementa en esta versión.
