# CONTABDSI Suite Financiera — Brief de diseño para Figma Make

> **Para:** Figma Make y equipo de diseño.
> **Producto:** CONTABDSI Suite Financiera.
> **Entrega:** prototipo navegable de alta fidelidad, en español, con datos mock.
> **Alcance:** los módulos nuevos de la suite descritos en este documento.
> **Autonomía:** todo lo necesario para diseñar está en este documento.

## Contenido

1. Qué vamos a diseñar
2. Principios de diseño
3. Sistema de diseño
4. Navegación y shell
5. Patrones transversales
6. Módulos (11 módulos, 124 funciones, 82 pantallas)
7. Flujos navegables obligatorios
8. Datos mock
9. Instrucciones para Figma Make
10. Cobertura del encargo
11. Criterios de aceptación
12. Prompt listo para pegar en Figma Make

---

## 1. Qué vamos a diseñar

Una aplicación web para que una empresa colombiana gestione su ciclo financiero:
facturar, cobrar, pagar, mover dinero, controlar activos, presupuestar, cumplir
obligaciones tributarias, producir informes certificables y cerrar periodos.

La suite es multiempresa y multiusuario, trabaja con roles y aprobaciones, y
muestra siempre tres datos de contexto: **compañía**, **periodo** y **moneda**.

### 1.1 Usuarios

| Rol | Qué necesita ver y hacer |
|---|---|
| Administrador | Configurar usuarios, roles, permisos, conectores e integridad del sistema |
| Gerente financiero | Panel general, aprobaciones, comparativos, informes y cierres |
| Analista financiero | Impuestos, informes, presupuestos, cierres y conciliaciones |
| Tesorero | Bancos, extractos, conciliación, pagos, transferencias y caja |
| Cobranzas | Cartera, recibos, aplicación de pagos, edades y cobro |
| Compras | Obligaciones por pagar, propuestas de pago, proveedores y gastos |
| Ventas | Facturación de venta, notas crédito/débito y estados de cuenta |
| Auditor | Consulta de todo, auditoría, trazabilidad y evidencias, sin editar |

### 1.2 Módulos del encargo

| Módulo | Resultado que entrega |
|---|---|
| Facturación | Emitir y recibir documentos, notas, resoluciones y estado DIAN |
| Cartera | Controlar partidas por cobrar, recibos, aplicación, edades y cobro |
| Cuentas por pagar | Controlar obligaciones, propuestas, aprobaciones, pagos y retenciones |
| Tesorería | Administrar cuentas, extractos, conciliación, transferencias, cheques y caja |
| Activos fijos | Registrar activos, depreciar, ajustar, dar de baja y reportar |
| Presupuesto | Planear por cuenta, centro y periodo; aprobar, ejecutar y comparar |
| Impuestos | Configurar impuestos, calendarizar, declarar, generar exógena y certificados |
| Informes | Consultar, comparar, certificar, exportar y programar informes |
| Cierres | Ejecutar checklists, cerrar periodos, reabrir y consolidar compañías |
| Administración | Gobiernar usuarios, roles, permisos, sesiones, auditoría e integraciones |
| Colaboración | Tareas, aprobaciones, búsqueda global, notificaciones y asistente |

### 1.3 Fuera de alcance

- Nómina, inventario, producción, punto de venta, CRM y comercio electrónico.
- Aplicaciones móviles nativas. El diseño es web de escritorio, adaptable a
  1280 px como mínimo.
- Backend real, autenticación real y datos reales. Todo se simula.
- Pantallas de mantenimiento de catálogos maestros. En los formularios aparecen
  como selectores con búsqueda y creación rápida en modal.

### 1.4 Entregables

1. Página de **design system** con tokens, tipografía, iconografía y componentes.
2. **Shell** de la aplicación con navegación, contexto y estados.
3. Las **pantallas** de los 11 módulos, con sus variantes.
4. **8 flujos navegables** de punta a punta.
5. Estados de **carga, vacío, error, sin permiso y periodo cerrado**.
6. Tabla de **datos mock** reutilizada en todo el prototipo.
7. Prototipo conectado, con navegación real entre pantallas.

---

## 2. Principios de diseño

1. **La tarea primero.** Cada pantalla responde una pregunta: qué tengo que
   hacer, sobre qué documento y con qué consecuencia.
2. **Denso pero legible.** El usuario financiero trabaja con muchas filas.
   Prioriza densidad compacta, encabezados fijos y jerarquía tipográfica.
3. **El estado siempre visible.** Documento, periodo, compañía y saldo deben
   entenderse sin abrir un detalle.
4. **Los números tienen contexto.** Todo importe muestra moneda, signo y
   comparación cuando aporta (presupuesto, periodo anterior, saldo).
5. **Nada se pierde.** Toda acción deja rastro: quién, cuándo, qué cambió y por
   qué. Las acciones destructivas explican su consecuencia.
6. **Los errores enseñan.** El mensaje dice qué pasó, dónde y cómo corregirlo;
   nunca solo "error inesperado".
7. **El vacío guía.** Una tabla vacía explica por qué está vacía y cuál es el
   siguiente paso.
8. **Consistencia antes que sorpresa.** Los mismos patrones para filtros,
   aprobaciones, documentos y estados en todos los módulos.
9. **Colombia en el detalle.** NIT con dígito de verificación, COP, UVT, fechas
   dd/mm/aaaa, calendario tributario y nombres de documentos locales.
10. **El prototipo no inventa.** Ninguna acción visible puede quedar sin una
    pantalla o un estado que la explique.

---

## 3. Sistema de diseño

Este sistema se define aquí y se usa en todas las pantallas.

### 3.1 Color

| Token | Valor | Uso |
|---|---|---|
| `navy-900` | `#001F4C` | Sidebar, títulos de marca, encabezados de tabla |
| `navy-700` | `#0A3A6B` | Hover de navegación, énfasis oscuro |
| `blue-600` | `#0073C0` | Acción primaria, enlace, selección |
| `blue-500` | `#00B0F2` | Acento, foco, indicador activo |
| `blue-200` | `#7BDCFB` | Gráficas, fondos de selección suave |
| `blue-50` | `#EFFAFF` | Fondo de fila seleccionada, tarjeta informativa |
| `gray-50` | `#F9FAFB` | Fondo alterno de tabla |
| `gray-100` | `#F3F4F6` | Fondo de aplicación |
| `white` | `#FFFFFF` | Tarjetas, modales, superficies |
| `gray-200` | `#E5E7EB` | Bordes y divisores |
| `gray-500` | `#6B7280` | Texto secundario, metadatos |
| `gray-900` | `#111827` | Texto principal |
| `green-600` | `#16A34A` | Éxito, aprobado, conciliado |
| `amber-600` | `#D97706` | Advertencia, pendiente, por vencer |
| `red-600` | `#DC2626` | Error, vencido, rechazado, anulado |
| `sky-600` | `#0284C7` | Información, en proceso |

Paleta de gráficas, en orden: `#0073C0`, `#00B0F2`, `#7BDCFB`, `#0E7490`,
`#F59E0B`, `#8B5CF6`, `#10B981`, `#EF4444`.

Reglas de color:

- El color nunca es el único portador de significado: todo estado lleva texto.
- Los importes negativos van en rojo y con signo menos; los positivos en
  `gray-900`, sin signo.
- Las alertas de periodo cerrado usan fondo ámbar suave y borde ámbar.

### 3.2 Tipografía

| Rol | Fuente | Tamaño / interlínea | Peso |
|---|---|---|---|
| Display | Inter | 28 / 36 | 700 |
| Título de página | Inter | 24 / 32 | 700 |
| Título de sección | Inter | 20 / 28 | 600 |
| Título de tarjeta | Inter | 16 / 24 | 600 |
| Cuerpo | Inter | 14 / 22 | 400 |
| Cuerpo fuerte | Inter | 14 / 22 | 600 |
| Tabla | Inter | 13 / 20 | 400 |
| Metadato | Inter | 12 / 16 | 400 |
| Cifra | JetBrains Mono | 13 / 20 | 400 o 500 |
| Cifra grande | JetBrains Mono | 24 / 32 | 500 |

Los importes, cantidades, NIT, CUFE, códigos y números de documento usan
JetBrains Mono con cifras tabulares. Los importes se alinean a la derecha; los
textos, a la izquierda; los estados, al centro.

### 3.3 Espaciado, radios y sombras

- Escala de espaciado: 4, 8, 12, 16, 24, 32, 48, 64 px.
- Radios: 6 px en campos y botones; 8 px en tarjetas; 12 px en modales y
  paneles; 999 px en chips y píldoras.
- Sombras: `0 1px 2px rgba(16,24,40,.06)` para tarjetas; `0 8px 24px
  rgba(16,24,40,.12)` para modales y drawers.
- Foco: anillo de 2 px `#00B0F2` con separación de 2 px.

### 3.4 Layout

- Sidebar expandido: 264 px. Colapsado: 72 px. Fondo `navy-900`.
- Header superior: 64 px, fondo blanco, borde inferior `gray-200`, fijo.
- Contenido: padding 24 px; máximo 1600 px; en pantallas anchas, 32 px.
- Grilla: 12 columnas, gutter 24 px.
- Densidad de tabla: compacta 36 px por fila; cómoda 44 px.
- Breakpoints de referencia: 1280, 1440 y 1680 px.

### 3.5 Iconografía

Iconos de línea estilo Lucide, 20 px, trazo 1.5. Cada módulo tiene un icono
propio y cada estado tiene icono y texto. No se usan emojis.

### 3.6 Componentes base

| Componente | Especificación |
|---|---|
| `AppShell` | Sidebar + header + área de contenido + contenedor de toasts |
| `SidebarItem` | Icono, etiqueta, contador opcional, estados normal, hover, activo y colapsado |
| `SidebarGroup` | Etiqueta de grupo, expandible, conserva el estado abierto |
| `CompanySwitcher` | Compañía actual, NIT, lista con búsqueda y opción "ver consolidado" |
| `PeriodSelector` | Año y mes, estado Abierto o Cerrado, acceso al calendario |
| `PageHeader` | Título, descripción corta, breadcrumb, acciones primaria y secundaria |
| `Breadcrumb` | Ruta de navegación con último elemento no clickeable |
| `Tabs` | Pestañas con contador; una sola activa; no ocultan acciones críticas |
| `FilterBar` | Búsqueda, filtros por chips, rango de fechas, "limpiar filtros" |
| `DataTable` | Encabezado fijo, orden, selección múltiple, columnas configurables, paginación |
| `BulkActionBar` | Barra flotante con seleccionados y acciones masivas |
| `MoneyInput` | Máscara COP, alineación derecha, valor en letras opcional |
| `NitInput` | Máscara 000.000.000-0, validación de DV y búsqueda de tercero |
| `DateRange` | Fechas dd/mm/aaaa, atajos "este mes", "mes anterior", "año" |
| `StatusChip` | Píldora con punto de color y texto; variantes neutral, info, éxito, alerta y error |
| `ApprovalStepper` | Pasos de aprobación con responsable, fecha, estado y comentario |
| `DocumentTimeline` | Línea de tiempo de eventos, autor, fecha, detalle y adjuntos |
| `SideDrawer` | Panel lateral de 480 px para detalle y edición rápida |
| `Modal` | Ancho 560 u 720 px, título, cuerpo, acciones fijas al pie |
| `ConfirmDialog` | Consecuencia explícita, campo de motivo cuando aplica |
| `Toast` | Éxito, error, advertencia e información; acción "deshacer" cuando exista |
| `EmptyState` | Ilustración lineal, título, explicación y acción |
| `ErrorState` | Qué pasó, dónde, cómo corregir y código de referencia |
| `Skeleton` | Bloques de carga con la misma silueta del contenido |
| `KpiCard` | Valor, etiqueta, variación, periodo comparado y tendencia |
| `ChartCard` | Título, filtros, leyenda, ejes y estado vacío |
| `SummaryPanel` | Totales, subtotales, impuestos y diferencia; sticky en formularios |
| `SplitView` | Lista a la izquierda, detalle a la derecha, redimensionable |
| `UploadDropzone` | Arrastrar y soltar, formatos aceptados, progreso y errores por fila |
| `RuleBuilder` | Condición, operador, valor y acción; filas apilables |
| `ReconciliationMatcher` | Dos columnas enfrentadas, coincidencias, diferencia y acciones |
| `AgingBar` | Barras por rango de vencimiento con importe y porcentaje |
| `CalendarGrid` | Mes con celdas de vencimientos y declaraciones |
| `PermissionMatrix` | Roles en columnas, permisos en filas, estados permitido, lectura y denegado |
| `AuditLog` | Tabla de eventos con filtros, detalle de cambio y exportación |
| `CommandPalette` | Búsqueda global con secciones y atajos de teclado |

### 3.7 Accesibilidad

- Contraste mínimo AA en texto y controles.
- Todo control tiene etiqueta visible; los iconos solos llevan tooltip y
  `aria-label`.
- El foco de teclado es visible y sigue el orden lógico.
- Los estados no dependen solo del color.
- Las tablas se pueden recorrer con teclado y anuncian fila y columna.
- Los formularios muestran el error junto al campo y un resumen al inicio.

---

## 4. Navegación y shell

### 4.1 Árbol de navegación

```text
Inicio

Facturación
├── Facturas de venta
├── Facturas de compra
├── Notas crédito y débito
├── DIAN
├── Resoluciones y numeración
├── Productos y servicios
└── Importar documentos

Cartera
├── Bandeja de cartera
├── Recibos de caja
├── Aplicación de pagos
├── Edades
├── Estados de cuenta
├── Cobro y promesas
├── Castigos y ajustes
└── Anticipos de clientes

Cuentas por pagar
├── Bandeja de obligaciones
├── Propuestas de pago
├── Pagos
├── Retenciones y certificados
├── Anticipos y gastos
└── Edades y programación

Tesorería
├── Panel de tesorería
├── Cuentas bancarias
├── Extractos
├── Conciliación
├── Reglas
├── Transferencias
├── Cheques
├── Caja menor
└── Partidas conciliatorias

Activos fijos
├── Bandeja de activos
├── Altas y edición
├── Depreciación
├── Ajustes y mejoras
├── Bajas
└── Reportes

Presupuesto
├── Bandeja de presupuestos
├── Editor
├── Distribución
├── Aprobación
├── Ejecución y compromisos
├── Comparativo y escenarios
└── Alertas

Impuestos
├── Panel fiscal
├── Catálogo y grupos
├── Posiciones fiscales
├── Calendario tributario
├── Declaraciones
├── Exógena y medios
├── Certificados
└── Pagos e historial

Informes
├── Centro de informes
├── Visor
├── Snapshots
├── NIIF y ESFA
├── Flujo de caja
└── Programación

Cierres
├── Panel de cierre
├── Checklist
├── Cierre de periodo
├── Reapertura
├── Consolidación
└── Homologación y eliminaciones

Administración
├── Usuarios
├── Roles y permisos
├── Sesiones y auditoría
├── Integridad
├── Conectores
├── Monitor de integraciones
└── API keys y webhooks
```

### 4.2 Header

De izquierda a derecha:

1. Botón para colapsar o expandir el sidebar.
2. Breadcrumb de la sección actual.
3. Selector de compañía con NIT y opción "consolidado".
4. Selector de periodo con estado Abierto o Cerrado.
5. Búsqueda global con atajo `Ctrl+K`.
6. Icono de notificaciones con contador y panel desplegable.
7. Ayuda y novedades.
8. Menú de usuario con rol, preferencias y cerrar sesión.

### 4.3 Comportamiento

- El sidebar recuerda si está colapsado; al colapsarse muestra solo iconos con
  tooltip.
- El grupo activo se expande automáticamente y el ítem activo usa fondo
  `blue-600` con texto blanco.
- Los contadores del sidebar muestran pendientes accionables: facturas por
  enviar a DIAN, partidas vencidas, propuestas por aprobar, extractos sin
  conciliar, declaraciones por vencer.
- El breadcrumb siempre refleja la jerarquía real y permite volver a cualquier
  nivel.
- La búsqueda global filtra por documento, tercero, NIT, importe y módulo, y
  muestra resultados agrupados con su estado.
- El selector de periodo advierte cuando se elige un periodo cerrado y ofrece
  "solicitar reapertura" si el rol lo permite.
- El cambio de compañía recarga el contexto y conserva la sección actual si
  existe en la otra compañía; si no, lleva a Inicio.

---

## 5. Patrones transversales

### 5.1 Ciclo de vida de un documento

```text
Borrador → En revisión → Aprobado → Registrado → Aplicado → Cerrado
     ↘ Rechazado        ↘ Anulado                  ↘ Reversado
```

- **Borrador:** editable, sin efectos. Acciones: guardar, enviar a revisión,
  eliminar.
- **En revisión:** solo lectura para el autor; el aprobador puede aprobar,
  rechazar o devolver con comentario.
- **Aprobado:** listo para registrar; aún puede anularse con motivo.
- **Registrado:** produce efectos en cartera, CxP, banco, presupuesto o
  impuestos; ya no se edita.
- **Aplicado:** el pago o documento se cruzó contra una partida o un extracto.
- **Cerrado:** el periodo se cerró; solo lectura absoluta.
- **Anulado / Reversado:** conserva el original y genera el documento contrario
  con trazabilidad.

El `StatusChip` y el `DocumentTimeline` son obligatorios en todo detalle.

### 5.2 Periodo cerrado

Cuando el periodo está cerrado:

- Banner superior ámbar: "Periodo cerrado. Solo lectura."
- Las acciones de escritura se muestran deshabilitadas con tooltip explicativo.
- El botón "Solicitar reapertura" aparece solo para roles autorizados.
- Los formularios de creación muestran el periodo bloqueado y permiten elegir
  otro periodo abierto.
- Nunca se oculta el documento; se muestra completo en modo lectura.

### 5.3 Permisos

- Si el usuario no puede ver un módulo, el ítem no aparece en el sidebar.
- Si puede ver pero no editar, las acciones se deshabilitan con explicación.
- Si intenta una acción prohibida por URL, se muestra `ErrorState` con el
  permiso faltante y el contacto del administrador.
- Las acciones sensibles piden **motivo obligatorio** y quedan en auditoría.

### 5.4 Aprobaciones

- Toda aprobación ocurre en un `SideDrawer` con: resumen del documento,
  importe, solicitante, política aplicable, comentario y decisión.
- El `ApprovalStepper` muestra pasos, responsables, fechas y estado.
- Rechazar exige comentario.
- Aprobar puede exigir segundo factor simulado en acciones de alto valor.
- El historial de aprobación queda en el `DocumentTimeline`.

### 5.5 Auditoría y trazabilidad

- Cada detalle tiene una pestaña "Actividad" con el `DocumentTimeline`.
- Cada evento muestra usuario, rol, fecha y hora, acción, valor anterior y
  valor nuevo.
- Los documentos registrados muestran un sello de integridad con código corto
  verificable.
- La auditoría se puede filtrar por usuario, módulo, acción y rango de fechas.

### 5.6 Adjuntos y comentarios

- Adjuntos en PDF, XML, imagen y Excel; tamaño máximo indicado.
- Cada adjunto muestra nombre, tipo, tamaño, autor y fecha.
- Los comentarios son internos, con menciones y sin edición posterior.
- Los documentos de proveedor y los soportes de pago tienen su propia sección.

### 5.7 Formato colombiano

| Dato | Formato | Ejemplo |
|---|---|---|
| Moneda | COP, separador de miles, coma decimal | `$ 1.234.567,89` |
| NIT | Puntos y guion con dígito de verificación | `900.123.456-7` |
| Fecha | Día/mes/año | `21/10/2026` |
| Fecha y hora | Día/mes/año hora:minuto | `21/10/2026 14:35` |
| Porcentaje | Dos decimales | `19,00 %` |
| UVT | Valor con separador de miles | `$ 49.799` |
| Rango | Desde y hasta | `01/10/2026 – 31/10/2026` |

### 5.8 Multiempresa

- El `CompanySwitcher` muestra compañía, NIT y estado.
- La opción "Consolidado" solo aparece si el usuario tiene alcance de grupo.
- En modo consolidado, el header muestra una banda `blue-50` con la leyenda
  "Vista consolidada de 3 compañías".
- Los documentos indican siempre la compañía de origen.
- Las acciones de escritura se deshabilitan en modo consolidado.

### 5.9 Exportación

- Todo listado e informe ofrece Excel, PDF y CSV.
- Las exportaciones grandes se ejecutan en segundo plano y notifican al
  terminar.
- El modal de exportación permite elegir columnas, rango y formato.
- El archivo generado conserva filtros, fecha y usuario en la cabecera.

### 5.10 Estados obligatorios por pantalla

Toda pantalla de listado o detalle debe tener:

1. **Cargando:** skeleton con la silueta real.
2. **Vacío:** explicación y acción principal.
3. **Error:** causa, código y reintento.
4. **Sin permiso:** qué permiso falta y a quién solicitar.
5. **Periodo cerrado:** banner y acciones deshabilitadas.
6. **Datos parciales:** aviso cuando una fuente externa no responde.

### 5.11 Validaciones

- Validación al salir del campo y al enviar.
- El error se muestra debajo del campo, en rojo, con texto concreto.
- Un resumen al inicio del formulario lista los errores y lleva al primero.
- Los cálculos dependientes muestran la fórmula o el desglose en un tooltip.
- Nunca se pierde lo diligenciado por un error de validación.

### 5.12 Atajos

| Atajo | Acción |
|---|---|
| `Ctrl+K` | Búsqueda global |
| `G` luego `F` | Ir a Facturación |
| `G` luego `C` | Ir a Cartera |
| `G` luego `P` | Ir a Cuentas por pagar |
| `G` luego `T` | Ir a Tesorería |
| `N` | Crear documento en el módulo actual |
| `Esc` | Cerrar modal, drawer o paleta |
| `?` | Ayuda de atajos |

---

## 6. Módulos

Cada módulo se describe con tres bloques: propósito y roles, funcionalidades que la
interfaz debe exponer y pantallas con su contenido, acciones y estados.

### 6.1 Facturación

**Propósito.** Emitir documentos de venta, registrar documentos de compra, emitir
notas y gestionar la relación con la DIAN. Es la puerta de entrada de los importes
a cartera y a cuentas por pagar.

**Roles.** Ventas (venta y notas), Compras (compra), Analista financiero
(impuestos y DIAN), Gerente (aprobación de notas y casos especiales).

#### Funcionalidades

| ID | Funcionalidad | Qué debe poder hacer el usuario |
|---|---|---|
| F-INV-001 | Factura de venta | Crear, guardar borrador, previsualizar, enviar a revisión y emitir una factura con numeración y datos fiscales |
| F-INV-002 | Factura de compra | Registrar el documento del proveedor con su número, fecha, impuestos, retenciones y soportes |
| F-INV-003 | Nota crédito | Emitir una nota total o parcial contra una factura, con motivo y líneas ajustadas |
| F-INV-004 | Nota débito | Cobrar intereses, ajustes o cargos adicionales con referencia a una factura |
| F-INV-005 | Impuestos por línea | Elegir impuesto por línea, ver base, tarifa y valor calculado, y marcar exenciones |
| F-INV-006 | Descuentos, recargos y redondeo | Aplicar descuentos o recargos por línea o globales, con motivo y redondeo configurable |
| F-INV-007 | Condiciones y vencimientos | Definir contado o crédito, número de cuotas, días y fechas de vencimiento |
| F-INV-008 | Numeración y resolución DIAN | Configurar prefijo, rango autorizado, vigencia y siguiente número |
| F-INV-009 | XML, CUFE y firma | Generar el XML, firmarlo, enviarlo y consultar el estado con CUFE |
| F-INV-010 | Eventos DIAN | Registrar aceptación, rechazo, acuse, reclamación y sus fechas |
| F-INV-011 | Contingencia | Emitir en modo contingencia y enviar después, con marca visible en el documento |
| F-INV-012 | Reversión y anulación | Anular un borrador o reversar un documento registrado, con motivo y documento relacionado |

#### Pantallas

| ID | Pantalla | Objetivo | Contenido clave | Acciones y estados |
|---|---|---|---|---|
| D-INV-01 | Bandeja de facturación | Ver y priorizar documentos de venta, compra y notas | Pestañas Ventas, Compras y Notas; indicadores de por enviar a DIAN, rechazadas, por vencer y total del mes; filtros por fecha, tercero, estado y resolución; tabla con número, fecha, tercero, NIT, total, estado, estado DIAN y vencimiento; vistas guardadas | Nueva factura, importar, exportar, enviar a DIAN en lote; clic en fila abre el detalle; estados vacío, carga, error y sin permiso |
| D-INV-02 | Editor de factura de venta | Construir una factura completa sin perder el resumen | Encabezado con tipo, número, fecha, cliente, NIT, condiciones y moneda; líneas con producto, descripción, cantidad, precio, descuento, impuesto, retención y total; panel derecho sticky con subtotal, descuentos, IVA, retenciones, redondeo y total; notas, adjuntos y datos DIAN | Guardar borrador, previsualizar PDF, enviar a revisión, emitir; validación por campo y resumen de errores; estados de cliente sin datos fiscales y resolución agotada |
| D-INV-03 | Editor de factura de compra | Registrar el documento del proveedor con sus soportes | Proveedor y NIT, número y fecha del proveedor, fecha de recepción, centro de costo, líneas, impuestos, retenciones, forma de pago y adjuntos del soporte | Guardar borrador, registrar, asociar a una obligación; alerta si el número del proveedor ya existe; estado sin soporte adjunto |
| D-INV-04 | Editor de nota crédito o débito | Ajustar un documento sin borrarlo | Documento relacionado, motivo obligatorio, líneas precargadas y editables, impuestos y total; para nota débito, concepto de interés o cargo | Emitir, guardar borrador, previsualizar; no permite superar el saldo del documento original; estado de documento ya anulado |
| D-INV-05 | Detalle del documento | Entender el documento y su historia completa | Encabezado con número, estado, tercero, fechas e importes; stepper de estado; líneas; desglose de impuestos y retenciones; panel DIAN con CUFE; pestañas Actividad, Adjuntos y Documentos relacionados | PDF, XML, duplicar, nota crédito, reversar, enviar a DIAN, comentar; estados de contingencia y rechazo DIAN con el motivo |
| D-INV-06 | Centro DIAN | Operar el envío electrónico y resolver rechazos | Indicadores por estado; cola de envíos con fecha, documento, cliente, CUFE, estado e intentos; detalle lateral con respuesta de la DIAN, errores por campo y historial de eventos | Reenviar, descargar XML, marcar contingencia, acusar evento; estados pendiente, enviado, aceptado, rechazado y contingencia |
| D-INV-07 | Resoluciones y numeración | Controlar rangos autorizados y evitar documentos sin número | Tabla de resoluciones con prefijo, rango, vigencia, siguiente número, disponibles y estado; formulario lateral para crear o editar; alerta de rango por agotarse | Crear, editar, inactivar, exportar; no permite rangos solapados; estado vencida y agotada |
| D-INV-08 | Productos y servicios | Mantener el catálogo que se usa en las líneas | Tabla con código, nombre, tipo, unidad, precio, impuesto por defecto y estado; búsqueda y filtros; formulario lateral con datos fiscales y de facturación | Crear, editar, importar, inactivar; estado producto sin impuesto configurado |
| D-INV-09 | Importar documentos | Cargar un lote de facturas sin digitar una por una | Zona de carga, descarga de plantilla, mapeo de columnas, vista previa con errores por fila y resumen de importación | Validar, importar, descargar errores; estados archivo inválido, filas con error y proceso en curso |

#### Reglas del módulo

- Un documento registrado no se edita: se corrige con nota o con reversión.
- Un rechazo de la DIAN no elimina el documento; lo deja en estado rechazado y
  habilita la corrección y el reenvío.
- La nota crédito nunca puede superar el saldo del documento original.
- La numeración es consecutiva por resolución y compañía; no se salta ni se
  reutiliza.
- El total mostrado en el editor siempre debe coincidir con el PDF previo.

---

### 6.2 Cartera

**Propósito.** Convertir las facturas de venta en partidas por cobrar, aplicar
pagos y recibos, medir la antigüedad y ejecutar la cobranza.

**Roles.** Cobranzas (operación diaria), Tesorero (recibos y aplicación),
Gerente (castigos y acuerdos), Ventas (consulta de estado de cuenta).

#### Funcionalidades

| ID | Funcionalidad | Qué debe poder hacer el usuario |
|---|---|---|
| F-AR-001 | Partida por cobrar desde factura | Ver la partida generada por cada factura con saldo, vencimiento y estado |
| F-AR-002 | Recibos de caja | Registrar un recibo con fecha, cliente, medio de pago, referencia y valor |
| F-AR-003 | Aplicación de pagos | Cruzar un recibo contra una o varias partidas abiertas |
| F-AR-004 | Pagos parciales y múltiples | Aplicar un pago a varias facturas y dejar saldos parciales visibles |
| F-AR-005 | Edades de cartera | Analizar saldos por rangos de vencimiento y por cliente |
| F-AR-006 | Estado de cuenta por tercero | Consultar el histórico de documentos, pagos y saldo de un cliente |
| F-AR-007 | Gestión de cobro y recordatorios | Programar recordatorios, registrar gestiones y dejar constancia |
| F-AR-008 | Promesas de pago | Registrar fecha y valor prometido, y hacer seguimiento a su cumplimiento |
| F-AR-009 | Castigo de cartera | Castigar una partida con motivo, aprobación y evidencia |
| F-AR-010 | Anticipos de cliente | Registrar dineros recibidos sin factura y aplicarlos después |
| F-AR-011 | Conciliación bancaria de recibos | Relacionar un recibo con su movimiento en el extracto |
| F-AR-012 | Notas crédito y ajustes de cartera | Reflejar en la partida las notas crédito y los ajustes aprobados |

#### Pantallas

| ID | Pantalla | Objetivo | Contenido clave | Acciones y estados |
|---|---|---|---|---|
| D-AR-01 | Bandeja de cartera | Ver qué se debe cobrar y qué está vencido | Indicadores de saldo total, vencido, por vencer y recaudo del mes; filtros por cliente, responsable, rango de vencimiento y estado; tabla con documento, cliente, NIT, emisión, vencimiento, saldo, días vencidos y estado; barra de edades | Nuevo recibo, exportar, asignar responsable, enviar recordatorio; estados vacío y sin permiso |
| D-AR-02 | Detalle de partida | Entender el saldo y su historia | Encabezado con cliente, documento, saldo y vencimiento; documentos relacionados; pagos aplicados; notas crédito; timeline de gestiones; panel de contacto | Aplicar pago, registrar gestión, promesa, castigar, nota crédito; estado partida cerrada y en acuerdo de pago |
| D-AR-03 | Recibo de caja | Registrar un ingreso y decidir cómo aplicarlo | Fecha, cliente, NIT, medio de pago, cuenta bancaria, referencia, valor, observaciones y adjunto; panel de partidas abiertas con aplicación automática sugerida | Guardar y aplicar, guardar sin aplicar, imprimir; validación de valor contra partidas; estado valor sin aplicar |
| D-AR-04 | Aplicación de pagos | Cruzar recibos y partidas con precisión | Vista dividida: recibos sin aplicar a la izquierda y partidas abiertas a la derecha; coincidencias sugeridas; diferencia en vivo; aplicación parcial por fila | Aplicar, aplicar todo, desaplicar, guardar; estados sin coincidencias, diferencia distinta de cero y recibo ya aplicado |
| D-AR-05 | Edades | Medir la antigüedad y priorizar la cobranza | Tabla dinámica por cliente y rangos de 0 a 30, 31 a 60, 61 a 90 y más de 90 días; totales por columna; gráfico de barras; filtros por responsable y sucursal | Exportar, enviar a cobranza, cambiar rango; estado sin saldos vencidos |
| D-AR-06 | Estado de cuenta | Entregar al cliente una cuenta clara | Encabezado con cliente, NIT, contacto y período; tabla de documentos, débitos, créditos y saldo; resumen de vencido y por vencer; notas al pie | Exportar PDF, enviar por correo, copiar enlace; estado cliente sin movimiento |
| D-AR-07 | Cobro y promesas | Organizar la gestión diaria de cobranza | Cola de clientes asignados; tarjetas con saldo, días vencidos, última gestión y próxima acción; panel de promesas con fecha, valor y estado; historial de llamadas y correos | Registrar gestión, crear promesa, marcar cumplida o incumplida, enviar recordatorio; estados promesa vencida y cliente sin contacto |
| D-AR-08 | Castigo y ajuste | Dar salida controlada a una partida irrecuperable | Partida afectada, saldo, motivo, soporte, aprobador y comentario; vista previa del efecto en cartera y en el estado de resultados | Solicitar castigo, aprobar, rechazar; estado solicitud pendiente y partida con pago parcial |
| D-AR-09 | Anticipos de cliente | Controlar dineros recibidos sin factura | Tabla de anticipos con cliente, fecha, valor, saldo y estado; detalle con aplicaciones y documento que lo originó | Registrar anticipo, aplicar a factura, devolver; estado anticipo agotado y sin aplicación |

#### Reglas del módulo

- La suma de aplicaciones nunca supera el valor del recibo ni el saldo de la
  partida.
- Un recibo sin aplicar permanece visible como anticipo; no desaparece.
- Una partida castigada no se reabre; si el cliente paga, se registra un ingreso
  de recuperación.
- La promesa de pago no modifica el vencimiento legal de la factura.
- El estado de cuenta debe cuadrar con la suma de partidas abiertas.

---

### 6.3 Cuentas por pagar

**Propósito.** Controlar las obligaciones con proveedores, proponer y aprobar
pagos, retener impuestos y certificar.

**Roles.** Compras (registro y soporte), Tesorero (pago), Gerente (aprobación),
Analista financiero (retenciones y certificados).

#### Funcionalidades

| ID | Funcionalidad | Qué debe poder hacer el usuario |
|---|---|---|
| F-AP-001 | Partida por pagar desde factura | Ver la obligación generada por cada documento de compra |
| F-AP-002 | Propuestas de pago | Agrupar obligaciones por proveedor o fecha y proponer un pago |
| F-AP-003 | Aprobación segregada | Aprobar o rechazar propuestas con reglas por monto y responsable |
| F-AP-004 | Pagos y aplicación | Registrar el pago y aplicarlo a una o varias obligaciones |
| F-AP-005 | Retenciones en la fuente, IVA e ICA | Calcular y mostrar retenciones por concepto antes de pagar |
| F-AP-006 | Certificados de retención | Generar y enviar certificados por proveedor y periodo |
| F-AP-007 | Anticipos a proveedores | Registrar anticipos y descontarlos en pagos posteriores |
| F-AP-008 | Gastos y reembolsos | Registrar gastos sin factura formal y reembolsos a empleados |
| F-AP-009 | Notas crédito de proveedor | Aplicar notas crédito del proveedor contra obligaciones abiertas |
| F-AP-010 | Programación y priorización de pagos | Ver vencimientos, priorizar y simular el flujo de salida |
| F-AP-011 | Conciliación bancaria de pagos | Relacionar un pago con su movimiento en el extracto |
| F-AP-012 | Edades de CxP y estado de cuenta | Analizar obligaciones por vencimiento y por proveedor |

#### Pantallas

| ID | Pantalla | Objetivo | Contenido clave | Acciones y estados |
|---|---|---|---|---|
| D-AP-01 | Bandeja de obligaciones | Ver qué se debe pagar y qué está vencido | Indicadores de total, vencido, por vencer y pagado del mes; filtros por proveedor, fecha, estado y responsable; tabla con documento, proveedor, NIT, emisión, vencimiento, valor, retenciones, neto y estado | Nueva propuesta, exportar, programar pago; estados vacío y sin permiso |
| D-AP-02 | Detalle de obligación | Entender el valor neto y la trazabilidad | Encabezado con proveedor, documento, valor bruto, retenciones y neto; documentos relacionados; pagos aplicados; notas crédito; timeline; adjuntos | Pagar, incluir en propuesta, nota crédito, comentar; estado obligación pagada y en disputa |
| D-AP-03 | Propuesta de pago | Construir una propuesta clara y aprobable | Fecha de pago, proveedor o lote, obligaciones seleccionadas, valor bruto, retenciones, descuentos y neto; banco y cuenta de salida; observaciones; resumen sticky | Guardar borrador, enviar a aprobación, eliminar; validación de obligaciones ya incluidas; estado sin obligaciones seleccionadas |
| D-AP-04 | Aprobación de propuestas | Decidir con contexto y segregación | Lista de propuestas pendientes; detalle con solicitante, monto, proveedores, vencimientos y política aplicada; stepper de aprobación; comentario obligatorio al rechazar | Aprobar, rechazar, devolver, delegar; estado aprobación vencida y conflicto de interés |
| D-AP-05 | Pago y egreso | Ejecutar el pago y dejar evidencia | Propuesta aprobada, fecha, medio de pago, cuenta bancaria, referencia, comprobante y adjunto; desglose de obligaciones y retenciones; confirmación con consecuencia | Registrar pago, imprimir comprobante, enviar al banco; estado pago en tránsito y pago rechazado por el banco |
| D-AP-06 | Retenciones y certificados | Calcular, revisar y certificar | Tabla de retenciones por proveedor, concepto, base, tarifa y valor; filtros por periodo; vista previa del certificado; historial de certificados emitidos | Generar certificado, enviar, descargar, anular con motivo; estado certificado ya emitido y proveedor sin datos fiscales |
| D-AP-07 | Anticipos y gastos | Controlar salidas sin factura formal | Pestañas Anticipos y Gastos; tabla con proveedor o empleado, fecha, valor, saldo y estado; formulario con concepto, soporte y centro de costo; aplicaciones | Registrar, aplicar a pago, reembolsar, anular; estado soporte faltante y anticipo vencido |
| D-AP-08 | Edades y programación | Planear la salida de caja | Calendario de vencimientos por semana; tabla por proveedor con rangos de vencimiento; simulación de pago con saldo disponible; priorización por fecha y criticidad | Simular, mover prioridad, crear propuesta desde selección, exportar; estado saldo insuficiente |

#### Reglas del módulo

- Nadie puede aprobar su propia propuesta.
- Una propuesta requiere al menos una obligación y un medio de pago.
- El pago no puede superar el neto aprobado.
- Las retenciones se calculan antes del pago y quedan en el comprobante.
- Un anticipo no aplicado se muestra como saldo a favor y no se elimina.

---

### 6.4 Tesorería

**Propósito.** Administrar el dinero disponible: cuentas, extractos, conciliación,
transferencias, cheques y caja.

**Roles.** Tesorero (operación), Analista financiero (conciliación y ajustes),
Gerente (aprobación de transferencias y ajustes), Auditor (consulta).

#### Funcionalidades

| ID | Funcionalidad | Qué debe poder hacer el usuario |
|---|---|---|
| F-BNK-001 | Cuentas bancarias | Crear y administrar cuentas con banco, tipo, número, moneda y saldo inicial |
| F-BNK-002 | Extractos manuales | Registrar movimientos de extracto uno por uno |
| F-BNK-003 | Importación de extractos | Cargar archivos del banco, mapear columnas y validar filas |
| F-BNK-004 | Validación de saldos | Comparar saldo del extracto contra saldo del sistema |
| F-BNK-005 | Reglas de conciliación | Crear reglas por texto, importe, referencia o fecha |
| F-BNK-006 | Conciliación automática | Sugerir y aplicar coincidencias de forma automática |
| F-BNK-007 | Conciliación manual | Cruzar movimientos cuando no hay coincidencia automática |
| F-BNK-008 | Diferencias y ajustes | Registrar diferencias, comisiones y ajustes con motivo |
| F-BNK-009 | Transferencias entre cuentas | Mover dinero entre cuentas y registrar comisión |
| F-BNK-010 | Cheques | Emitir, imprimir, anular y conciliar cheques |
| F-BNK-011 | Caja y cierre de caja | Registrar ingresos y egresos de caja y cerrar el turno |
| F-BNK-012 | Reporte de partidas conciliatorias | Ver y exportar lo que sigue sin conciliar |

#### Pantallas

| ID | Pantalla | Objetivo | Contenido clave | Acciones y estados |
|---|---|---|---|---|
| D-BNK-01 | Panel de tesorería | Ver la posición de dinero hoy | Saldos por cuenta, total disponible, movimientos del día, extractos sin conciliar, cheques pendientes y caja; gráfico de flujo de los últimos 30 días; alertas de saldo bajo | Ir a conciliación, transferir, exportar; estado sin cuentas y fuente bancaria caída |
| D-BNK-02 | Cuentas bancarias | Mantener el catálogo de cuentas | Tabla con banco, tipo, número enmascarado, moneda, saldo y estado; formulario lateral con datos del banco, cuenta y saldo inicial; historial de saldos | Crear, editar, inactivar, ver movimientos; estado cuenta inactiva con saldo |
| D-BNK-03 | Extractos | Consultar y administrar extractos | Lista por cuenta y periodo con fecha, descripción, referencia, débito, crédito, saldo y estado de conciliación; filtros y totales | Importar, conciliar, exportar, eliminar extracto no conciliado; estado extracto cerrado |
| D-BNK-04 | Importar extracto | Cargar el archivo del banco sin errores | Selección de cuenta, zona de carga, formatos aceptados, mapeo de columnas, vista previa con fecha, descripción, valor y saldo; errores por fila | Validar, importar, descargar errores; estados archivo duplicado y saldo inicial inconsistente |
| D-BNK-05 | Conciliación | Cruzar extracto y sistema con evidencia | Vista dividida: movimientos del extracto a la izquierda y partidas del sistema a la derecha; coincidencias sugeridas con porcentaje; diferencia en vivo; panel de detalle; filtros por cuenta y fecha | Conciliar, desconciliar, crear ajuste, aceptar sugerencia; estados sin coincidencia y diferencia distinta de cero |
| D-BNK-06 | Reglas | Automatizar la conciliación | Lista de reglas con nombre, condiciones, acción y estado; constructor de reglas con texto, importe, referencia, fecha y cuenta; prioridad y previsualización de coincidencias | Crear, editar, activar, desactivar, probar; estado regla sin coincidencias |
| D-BNK-07 | Transferencias | Mover dinero entre cuentas propias | Cuenta origen, cuenta destino, fecha, valor, comisión, referencia y descripción; resumen de saldo antes y después; aprobación si supera el umbral | Guardar, solicitar aprobación, ejecutar; estado saldo insuficiente y transferencia pendiente |
| D-BNK-08 | Cheques | Emitir y controlar cheques | Tabla con número, beneficiario, cuenta, fecha, valor, estado y conciliación; formulario de emisión; vista de impresión con formato de cheque | Emitir, imprimir, anular, conciliar; estado cheque vencido y cheque anulado |
| D-BNK-09 | Caja menor | Controlar el efectivo de la operación | Apertura de caja con base inicial; movimientos con concepto, soporte y responsable; arqueo con denominaciones; diferencia; cierre del turno | Abrir, registrar ingreso o egreso, arquear, cerrar; estado caja abierta de otro usuario y descuadre |
| D-BNK-10 | Partidas conciliatorias | Cerrar la brecha entre banco y sistema | Tabla con fecha, cuenta, descripción, valor, antigüedad y estado; filtros por cuenta y tipo; detalle con historial de intentos | Crear ajuste, asignar responsable, exportar; estado partida conciliada y partida antigua |

#### Reglas del módulo

- No se concilia dos veces el mismo movimiento.
- Una diferencia no se oculta: se registra como ajuste con motivo y aprobación.
- Una transferencia genera dos movimientos vinculados, uno por cuenta.
- El cierre de caja no se reabre; se corrige con un movimiento del turno
  siguiente.
- Los saldos del panel se actualizan con cada conciliación y cada pago.

---

### 6.5 Activos fijos

**Propósito.** Controlar los bienes de la empresa durante su vida útil:
alta, depreciación, ajustes, mejoras, bajas y reportes.

**Roles.** Analista financiero (operación), Gerente (aprobación de altas y
bajas), Auditor (consulta y evidencia).

#### Funcionalidades

| ID | Funcionalidad | Qué debe poder hacer el usuario |
|---|---|---|
| F-AST-001 | Categorías de activos | Definir categorías con vida útil, método de depreciación y cuentas asociadas |
| F-AST-002 | Alta de activo | Registrar un activo con datos generales, ubicación, responsable, valor y documentos |
| F-AST-003 | Tabla de depreciación | Ver la proyección mensual o anual desde el alta hasta el final de la vida útil |
| F-AST-004 | Depreciación mensual | Ejecutar la depreciación del periodo, revisar el cálculo y confirmar |
| F-AST-005 | Depreciación fiscal | Comparar la depreciación financiera con la fiscal y ver la diferencia |
| F-AST-006 | Baja de activo | Dar de baja por venta, pérdida, obsolescencia o donación, con motivo y soporte |
| F-AST-007 | Revalorización | Ajustar el valor del activo con avalúo, fecha y efecto |
| F-AST-008 | Deterioro | Registrar pérdida por deterioro con evidencia y reversible cuando aplique |
| F-AST-009 | Mejoras y componentes | Agregar mejoras o separar componentes con su propia vida útil |
| F-AST-010 | Reporte de activos | Consultar activos por categoría, ubicación, responsable, estado y valor |

#### Pantallas

| ID | Pantalla | Objetivo | Contenido clave | Acciones y estados |
|---|---|---|---|---|
| D-AST-01 | Bandeja de activos | Ver el inventario y su estado | Indicadores de valor bruto, depreciación acumulada, valor neto y activos del mes; filtros por categoría, ubicación, responsable y estado; tabla con código, nombre, categoría, fecha de alta, valor, depreciación y neto; vistas guardadas | Nuevo activo, importar, exportar, ejecutar depreciación; estados vacío y activo totalmente depreciado |
| D-AST-02 | Alta y edición de activo | Registrar un bien completo y verificable | Datos generales: código, nombre, categoría, descripción, marca, modelo y serie; ubicación, responsable y centro de costo; datos financieros: fecha de alta, valor, valor residual, vida útil y método; adjuntos de factura y soporte; vista previa de la depreciación | Guardar borrador, registrar, duplicar; validación de fecha, valor y vida útil; estado activo con factura faltante |
| D-AST-03 | Detalle del activo | Entender el activo y su historia | Ficha con datos, estado y valor neto; tabla de depreciación con periodo, cuota y acumulado; mejoras y componentes; ajustes; timeline de eventos; documentos adjuntos | Editar en borrador, depreciar, revalorizar, deteriorar, dar de baja, imprimir ficha; estado activo dado de baja |
| D-AST-04 | Depreciación | Ejecutar y revisar la corrida del periodo | Selección de periodo y categorías; tabla de activos con valor, cuota, depreciación acumulada y nueva; totales; simulación previa; detalle del cálculo por activo | Simular, ejecutar, revertir una corrida no confirmada, exportar; estados periodo cerrado y activo sin vida útil |
| D-AST-05 | Ajustes y mejoras | Modificar el valor sin perder trazabilidad | Pestañas Revalorización, Deterioro y Mejora; activo afectado, fecha, valor, avalúo o soporte, motivo y aprobador; vista previa del nuevo valor y de la nueva cuota | Solicitar, aprobar, aplicar; estado ajuste pendiente y activo de baja |
| D-AST-06 | Bajas | Retirar un activo con evidencia | Activo, fecha, causal, valor de venta o recuperación, soporte, aprobador y comentario; cálculo de utilidad o pérdida; confirmación con consecuencia | Solicitar baja, aprobar, rechazar, imprimir acta; estado baja pendiente y activo con depreciación pendiente |
| D-AST-07 | Reportes de activos | Analizar la base de activos | Reportes por categoría, ubicación, responsable y estado; activos totalmente depreciados; movimiento del periodo; comparativo financiero y fiscal; exportación | Ejecutar, cambiar parámetros, exportar, programar; estado sin datos para el filtro |

#### Reglas del módulo

- Un activo no se elimina: se da de baja con acta y motivo.
- La depreciación de un periodo cerrado no se modifica; se corrige en el
  siguiente.
- La depreciación acumulada nunca supera el valor depreciable.
- Una mejora cambia la base de depreciación y se refleja desde la fecha
  indicada.
- Toda baja conserva el historial completo del activo.

---

### 6.6 Presupuesto

**Propósito.** Planear ingresos y gastos por cuenta, centro de costo y periodo;
aprobar versiones, controlar compromisos y comparar contra lo real.

**Roles.** Gerente financiero (aprobación), Analista financiero (elaboración y
control), Líderes de área (solicitud y justificación), Auditor (consulta).

#### Funcionalidades

| ID | Funcionalidad | Qué debe poder hacer el usuario |
|---|---|---|
| F-BGT-001 | Versiones de presupuesto | Crear versiones por año, comparar y marcar la vigente |
| F-BGT-002 | Líneas por cuenta, centro y periodo | Editar valores mensuales por cuenta y centro con totales automáticos |
| F-BGT-003 | Distribución | Distribuir un valor anual por meses o por porcentajes predefinidos |
| F-BGT-004 | Aprobación de presupuesto | Enviar, revisar, aprobar o rechazar una versión con comentarios |
| F-BGT-005 | Control presupuestal | Mostrar disponibilidad antes de comprometer un gasto |
| F-BGT-006 | Compromisos | Registrar compromisos y descontarlos de la disponibilidad |
| F-BGT-007 | Ejecución real | Comparar lo presupuestado con lo ejecutado y comprometido |
| F-BGT-008 | Cierre de presupuesto | Cerrar el año y decidir arrastre o liberación de saldos |
| F-BGT-009 | Escenarios y simulación | Simular cambios de valor y ver el impacto antes de aprobar |
| F-BGT-010 | Alertas de ejecución | Avisar cuando una cuenta supera el umbral configurado |

#### Pantallas

| ID | Pantalla | Objetivo | Contenido clave | Acciones y estados |
|---|---|---|---|---|
| D-BGT-01 | Bandeja de presupuestos | Ver versiones y su estado | Indicadores de versiones, presupuesto vigente, ejecutado y disponible; tabla con año, versión, estado, responsable, fecha y total; filtros por año y estado | Nueva versión, duplicar, comparar, exportar; estados vacío y versión aprobada |
| D-BGT-02 | Editor de presupuesto | Construir el presupuesto sin perder totales | Grilla con cuentas en filas y meses en columnas; celdas editables; totales por fila y columna; panel lateral con detalle de la cuenta; filtros por centro y cuenta; indicador de cambios sin guardar | Guardar, distribuir, enviar a aprobación, importar desde Excel; validación de valores negativos y celdas vacías; estado versión bloqueada |
| D-BGT-03 | Distribución | Repartir el anual de forma controlada | Valor anual, método de distribución, porcentajes por mes, vista previa y comparación con el año anterior; resumen de totales | Aplicar a todas las filas, aplicar a una cuenta, guardar; estado distribución que no suma 100 % |
| D-BGT-04 | Aprobación | Decidir con contexto | Lista de versiones pendientes; detalle con totales, variación contra la versión vigente, justificación y comentarios; stepper; historial | Aprobar, rechazar, devolver, delegar; estado aprobación vencida y conflicto de interés |
| D-BGT-05 | Ejecución y compromisos | Ver cuánto queda disponible | Tabla por cuenta y centro con presupuesto, comprometido, ejecutado y disponible; semáforo por porcentaje; detalle de compromisos; filtros por periodo | Registrar compromiso, liberar compromiso, exportar; estado sobrepresupuesto y cuenta sin presupuesto |
| D-BGT-06 | Comparativo y escenarios | Entender desviaciones y simular | Vista comparativa de versiones y del real; variaciones absolutas y porcentuales; gráfico de barras; simulación con supuestos y escenario guardado | Cambiar escenario, guardar simulación, exportar; estado sin datos reales |
| D-BGT-07 | Alertas | Anticipar desviaciones | Lista de alertas por cuenta, centro, umbral, consumo y fecha; configuración de umbrales; destinatarios; historial de alertas | Crear alerta, editar umbral, silenciar, ir a la cuenta; estado alerta ya atendida |

#### Reglas del módulo

- Solo una versión puede estar vigente por año y compañía.
- Una versión aprobada no se edita; se crea una nueva versión.
- El disponible es presupuesto menos comprometido menos ejecutado; nunca se
  muestra negativo sin alerta.
- El compromiso se libera al anular el documento que lo originó.
- La ejecución se actualiza con los documentos registrados, no se digita.

---

### 6.7 Impuestos

**Propósito.** Configurar impuestos colombianos, determinar su valor en los
documentos, calendarizar obligaciones, preparar declaraciones y generar
exógena, medios y certificados.

**Roles.** Analista financiero (preparación), Gerente (aprobación y firma),
Tesorero (pago), Auditor (consulta y evidencia).

#### Funcionalidades

| ID | Funcionalidad | Qué debe poder hacer el usuario |
|---|---|---|
| F-TAX-001 | Catálogo de impuestos | Crear impuestos con nombre, tipo, tarifa, base y vigencia |
| F-TAX-002 | Grupos y etiquetas de impuesto | Agrupar impuestos y usarlos como conjunto en documentos |
| F-TAX-003 | Posiciones fiscales | Aplicar un conjunto de impuestos según la operación o el tercero |
| F-TAX-004 | Determinación por línea | Calcular impuestos por línea y mostrar base, tarifa y valor |
| F-TAX-005 | IVA | Determinar IVA, descontable, generado y saldo del periodo |
| F-TAX-006 | Retenciones en la fuente | Calcular retenciones por concepto, base y tarifa |
| F-TAX-007 | ICA y retención municipal | Calcular ICA por municipio y actividad, y su retención |
| F-TAX-008 | UVT y vigencias | Administrar el valor de la UVT por año y usarlo en topes y cálculos |
| F-TAX-009 | Calendario tributario | Ver vencimientos por obligación, municipio y último dígito del NIT |
| F-TAX-010 | Reportes fiscales y declaraciones | Preparar, revisar, aprobar y presentar una declaración |
| F-TAX-011 | Información exógena | Generar los formatos con validación de topes y datos |
| F-TAX-012 | Medios magnéticos | Generar archivos por formato, validar y exportar |
| F-TAX-013 | Certificados tributarios | Emitir certificados de retención y de ingresos |
| F-TAX-014 | Orquestación DIAN | Enviar, consultar y reintentar trámites ante la DIAN |

#### Pantallas

| ID | Pantalla | Objetivo | Contenido clave | Acciones y estados |
|---|---|---|---|---|
| D-TAX-01 | Panel fiscal | Ver el estado tributario de un vistazo | Tarjetas de IVA del periodo, retenciones, ICA, obligaciones por vencer y declaraciones en borrador; calendario resumido; alertas por topes; filtros por año y compañía | Ir a declaración, ver calendario, exportar; estado obligación vencida y declaración rechazada |
| D-TAX-02 | Catálogo y grupos | Mantener la configuración fiscal | Pestañas Impuestos, Grupos y Etiquetas; tabla con nombre, tipo, tarifa, vigencia y estado; formulario lateral con base, tarifa, cuenta y vigencia; composición de grupos | Crear, editar, duplicar, inactivar; estado impuesto vencido y grupo sin impuestos |
| D-TAX-03 | Posiciones fiscales | Aplicar impuestos según el caso | Tabla de posiciones con nombre, descripción, impuestos incluidos y estado; formulario con reglas por tipo de tercero, operación o municipio; previsualización del efecto en una línea | Crear, editar, probar, inactivar; estado posición en uso |
| D-TAX-04 | Calendario tributario | No perder vencimientos | Grilla anual o mensual con obligaciones, fecha límite, último dígito del NIT, estado y responsable; detalle con documentos relacionados y recordatorios | Crear recordatorio, marcar cumplida, exportar; estado vencimiento próximo y vencido |
| D-TAX-05 | Declaración | Preparar y presentar una obligación | Selección de obligación, periodo y municipio; resumen de bases, impuestos generados, descontables, retenciones y saldo; detalle por documento; validaciones; borrador y versión aprobada; adjuntos y acuse | Calcular, guardar borrador, enviar a aprobación, presentar, descargar; estados diferencias detectadas y declaración ya presentada |
| D-TAX-06 | Exógena y medios | Generar archivos con validación previa | Selección de formato y periodo; resumen de registros y topes; tabla de terceros con validaciones; errores por fila; vista previa del archivo; historial de generaciones | Validar, generar, descargar, corregir; estado tercero sin datos y tope no alcanzado |
| D-TAX-07 | Certificados | Emitir certificados confiables | Búsqueda por tercero y periodo; vista previa del certificado con conceptos, bases y retenciones; historial; envío por correo | Generar, enviar, descargar, anular con motivo; estado certificado ya emitido y tercero sin movimientos |
| D-TAX-08 | Pagos e historial | Cerrar el ciclo tributario | Tabla de obligaciones con periodo, valor, fecha de pago, banco, referencia y estado; detalle del pago y soporte; historial de declaraciones | Registrar pago, adjuntar soporte, exportar; estado pago parcial y obligación pagada |

#### Reglas del módulo

- Un impuesto no se elimina si está en uso; se inactiva con vigencia.
- La declaración presentada no se edita; se corrige con una declaración de
  corrección.
- Los topes de exógena se validan antes de generar el archivo.
- Un certificado emitido conserva el valor y la fecha de emisión.
- Toda obligación muestra el último dígito del NIT y la fecha límite aplicable.

---

### 6.8 Informes

**Propósito.** Consultar, comparar, certificar, exportar y programar informes de
la operación financiera. El visor es genérico: cualquier informe usa la misma
experiencia de parámetros, resultados, drill-down y exportación.

**Roles.** Todos los roles consultan según su alcance; Analista y Gerente
programan y certifican; Auditor consulta snapshots.

#### Funcionalidades

| ID | Funcionalidad | Qué debe poder hacer el usuario |
|---|---|---|
| F-RPT-001 | Catálogo de informes | Explorar informes por módulo, uso y favoritos |
| F-RPT-002 | Motor de ejecución | Ejecutar un informe con parámetros y ver progreso y resultado |
| F-RPT-008 | Cartera por edades | Analizar saldos por cliente y rango de vencimiento |
| F-RPT-009 | CxP por edades y programación | Analizar obligaciones y pagos próximos |
| F-RPT-010 | Comparativos | Comparar periodos, versiones o compañías |
| F-RPT-011 | Flujo de caja | Proyectar entradas y salidas con escenarios |
| F-RPT-012 | ESFA y NIIF | Producir informes bajo normativa NIIF |
| F-RPT-013 | Snapshots certificables | Congelar un informe con su hash y evidencia |
| F-RPT-014 | Exportación y programación | Exportar y programar envíos recurrentes |

#### Pantallas

| ID | Pantalla | Objetivo | Contenido clave | Acciones y estados |
|---|---|---|---|---|
| D-RPT-01 | Centro de informes | Encontrar el informe correcto | Buscador; filtros por módulo, tipo y favoritos; tarjetas con nombre, descripción, última ejecución y responsable; secciones Cartera, CxP, Tesorería, Presupuesto, Impuestos, NIIF y Gerenciales | Abrir, marcar favorito, programar, ver historial; estado sin resultados |
| D-RPT-02 | Visor de informes | Ejecutar y leer un informe | Barra de parámetros con periodo, compañía, centro y comparación; área de resultado con tabla, gráfico y totales; drill-down al documento; panel de notas; indicador de fuente y fecha de corte | Ejecutar, cambiar parámetros, expandir, exportar, guardar vista, crear snapshot; estados cargando, sin datos, error de fuente y resultado parcial |
| D-RPT-03 | Snapshot | Certificar un resultado en un momento dado | Encabezado con informe, periodo, compañía, fecha de corte, autor y hash; resultado congelado; adjuntos; historial de verificaciones; sello de integridad | Crear snapshot, verificar hash, descargar, comparar con el actual; estado snapshot alterado y snapshot sin firma |
| D-RPT-04 | NIIF y ESFA | Preparar informes normativos | Selección de norma, periodo y compañía; estado de situación financiera, estado de resultados, cambios en el patrimonio y revelaciones; mapeo de cuentas; validaciones y notas | Generar, revisar mapeo, exportar, aprobar; estado cuenta sin mapeo y diferencia no explicada |
| D-RPT-05 | Flujo de caja | Anticipar la posición de dinero | Horizonte de 30, 60 o 90 días; entradas por cobrar, salidas por pagar, impuestos y nómina excluida; escenarios optimista, base y conservador; gráfico y tabla por semana; saldo proyectado | Cambiar escenario, ajustar supuestos, exportar; estado saldo proyectado negativo |
| D-RPT-06 | Programación | Automatizar la entrega de informes | Lista de programaciones con informe, frecuencia, destinatarios, formato y última ejecución; formulario con día, hora, filtros y mensaje; historial de envíos | Crear, editar, pausar, ejecutar ahora, eliminar; estado envío fallido y programación vencida |

#### Reglas del módulo

- Un informe siempre muestra la fecha de corte y la fuente de los datos.
- Un snapshot es inmutable y verificable; no se regenera con datos nuevos.
- Los informes consolidados solo están disponibles con alcance de grupo.
- Las exportaciones conservan los filtros y el usuario que las generó.
- Un informe programado que falla notifica y queda en el historial.

---

### 6.9 Cierres y consolidación

**Propósito.** Cerrar periodos con evidencia, controlar la reapertura y producir
estados consolidados de varias compañías.

**Roles.** Gerente financiero (aprobación), Analista financiero (ejecución),
Auditor (revisión), Administrador (configuración del grupo).

#### Funcionalidades

| ID | Funcionalidad | Qué debe poder hacer el usuario |
|---|---|---|
| F-CLS-001 | Checklist de cierre | Ver todas las tareas del cierre, su responsable, estado y evidencia |
| F-CLS-002 | Cierre mensual | Ejecutar el cierre del mes con validaciones y confirmación |
| F-CLS-003 | Cierre anual | Ejecutar el cierre del año y dejar los saldos iniciales del siguiente |
| F-CLS-005 | Apertura de periodos y años | Abrir el siguiente periodo o año con reglas y saldos iniciales |
| F-CLS-006 | Reapertura controlada | Reabrir un periodo con motivo, aprobación y alcance limitado |
| F-CLS-007 | Configuración de consolidación | Definir compañías, moneda, periodo y reglas del grupo |
| F-CLS-008 | Homologación de cuentas y centros | Mapear cuentas y centros de las filiales al plan del grupo |
| F-CLS-009 | Eliminaciones intercompañía | Identificar y eliminar saldos y operaciones entre compañías |
| F-CLS-010 | Simulación y ejecución de consolidación | Simular, revisar diferencias y ejecutar la consolidación |
| F-CLS-011 | Reportes consolidados | Producir estados del grupo con detalle por compañía |

#### Pantallas

| ID | Pantalla | Objetivo | Contenido clave | Acciones y estados |
|---|---|---|---|---|
| D-CLS-01 | Panel de cierre | Saber qué falta para cerrar | Estado del periodo, porcentaje de avance, tareas bloqueantes, diferencias pendientes y responsables; línea de tiempo del cierre; acceso al checklist y a la consolidación | Continuar cierre, ver checklist, solicitar reapertura, exportar; estados periodo abierto, en cierre y cerrado |
| D-CLS-02 | Checklist | Ejecutar y evidenciar cada tarea | Lista agrupada por área con tarea, responsable, estado, fecha límite, evidencia y comentario; filtros por estado y responsable; barra de avance | Marcar hecha, adjuntar evidencia, asignar, comentar, bloquear cierre; estado tarea bloqueante y evidencia rechazada |
| D-CLS-03 | Cierre de periodo | Cerrar con validaciones y decisión informada | Asistente en pasos: resumen del periodo, validaciones, diferencias, tareas pendientes, confirmación con motivo y firma; vista previa de lo que quedará bloqueado | Validar, cerrar, cancelar; estados validaciones con error y cierre en proceso |
| D-CLS-04 | Reapertura | Reabrir sin perder control | Periodo solicitado, motivo obligatorio, alcance, documentos afectados, aprobador, vigencia de la reapertura y evidencia; historial de reaperturas | Solicitar, aprobar, rechazar, cerrar reapertura; estado reapertura activa y periodo sin cierre previo |
| D-CLS-05 | Consolidación | Producir el estado del grupo | Selector de compañías, periodo y moneda; estado de cada filial (lista, con diferencias, pendiente); resumen de activos, pasivos, patrimonio y resultados; diferencias de homologación; botón de simulación | Simular, revisar diferencias, ejecutar, exportar; estados filial sin cerrar y diferencia no eliminada |
| D-CLS-06 | Homologación y eliminaciones | Resolver las diferencias del grupo | Pestañas Homologación y Eliminaciones; tabla de cuenta origen, cuenta grupo, centro y estado; pares de operaciones entre compañías con saldo y diferencia; sugerencias de cruce | Mapear, guardar, eliminar par, marcar revisado, exportar; estado cuenta sin homologar y par descuadrado |

#### Reglas del módulo

- No se cierra un periodo con tareas bloqueantes pendientes.
- La reapertura tiene vigencia y alcance; no reabre todo el año.
- Toda reapertura exige motivo y aprobación de un rol superior.
- La consolidación no modifica los datos de las filiales; produce una vista
  del grupo.
- Una diferencia de consolidación no se oculta: se muestra y se explica.

---

### 6.10 Administración y seguridad

**Propósito.** Gobiernar el acceso, la trazabilidad y las integraciones de la
suite.

**Roles.** Administrador (configuración), Auditor (consulta), Gerente
(aprobación de accesos sensibles).

#### Funcionalidades

| ID | Funcionalidad | Qué debe poder hacer el usuario |
|---|---|---|
| F-SEC-001 | Usuarios | Crear, invitar, activar, suspender y consultar usuarios |
| F-SEC-002 | Roles | Definir roles y asignarlos a usuarios |
| F-SEC-003 | Permisos por módulo y acción | Configurar ver, crear, editar, aprobar, exportar y administrar |
| F-SEC-004 | Alcance por compañía | Limitar el acceso a una compañía o al grupo consolidado |
| F-SEC-005 | Segregación de funciones | Impedir que un usuario ejecute y apruebe la misma operación |
| F-SEC-006 | Auditoría de acciones | Consultar quién hizo qué, cuándo y con qué resultado |
| F-SEC-007 | Inalterabilidad con hash | Verificar que un documento o snapshot no fue alterado |
| F-SEC-008 | Sesiones y autenticación | Ver sesiones activas, cerrarlas y configurar segundo factor |
| F-SEC-009 | Acciones sensibles con motivo | Exigir motivo y aprobación en anulaciones, reaperturas y castigos |
| F-INT-001 | Registro de conectores | Ver y administrar los conectores disponibles y su estado |
| F-INT-002 | Integración DIAN | Configurar credenciales, ambiente y estado del servicio |
| F-INT-003 | Integración bancaria | Configurar bancos, cuentas y origen de extractos |
| F-INT-004 | E-commerce y CRM | Configurar el intercambio de documentos y terceros |
| F-INT-005 | Asistente IA | Configurar el asistente, su alcance y sus permisos |
| F-INT-006 | API keys y webhooks | Crear llaves, suscribir eventos y revocar accesos |
| F-INT-007 | Outbox y reintentos | Ver la cola de eventos, reintentar y descartar con motivo |
| F-INT-008 | Observabilidad de integraciones | Ver latencia, errores, volumen y última sincronización |
| F-INT-009 | Importación y exportación externa | Cargar y descargar datos con plantillas y validación |

#### Pantallas

| ID | Pantalla | Objetivo | Contenido clave | Acciones y estados |
|---|---|---|---|---|
| D-SEC-01 | Usuarios | Administrar el ciclo de vida de las personas | Tabla con nombre, correo, rol, compañías, estado y último acceso; filtros; formulario lateral con datos, rol, alcance y segundo factor; invitación pendiente | Invitar, editar, suspender, reenviar invitación, ver actividad; estado usuario inactivo y correo duplicado |
| D-SEC-02 | Roles y permisos | Definir quién puede hacer qué | Matriz de roles por permiso con estados permitido, lectura y denegado; agrupación por módulo; búsqueda; resumen de usuarios por rol; alertas de conflicto de segregación | Crear rol, duplicar, editar, guardar, comparar roles; estado conflicto de segregación y rol en uso |
| D-SEC-03 | Sesiones y auditoría | Investigar accesos y cambios | Pestañas Sesiones y Auditoría; sesiones con usuario, dispositivo, IP, inicio y última actividad; auditoría con filtros por usuario, módulo, acción y fecha; detalle con valor anterior y nuevo | Cerrar sesión, exportar, ver detalle, marcar caso; estado sesión expirada y evento sin detalle |
| D-SEC-04 | Integridad | Verificar que la evidencia no cambió | Lista de documentos y snapshots con hash, fecha, autor y estado de verificación; búsqueda por código; detalle con comparación | Verificar, exportar certificado, marcar incidencia; estado hash alterado y verificación pendiente |
| D-INT-01 | Conectores | Configurar y monitorear servicios externos | Tarjetas por conector con nombre, tipo, ambiente, estado, última sincronización y errores; formulario de credenciales y parámetros; prueba de conexión | Activar, desactivar, probar, editar; estado credencial vencida y conector sin configurar |
| D-INT-02 | Monitor de integraciones | Detectar y resolver fallas | Indicadores de éxito, error y latencia; tabla de eventos con fecha, conector, tipo, documento, intentos y estado; detalle con solicitud, respuesta y error; filtros por conector y fecha | Reintentar, descartar con motivo, exportar, ver documento; estado reintento agotado y evento en cola |
| D-INT-03 | API keys y webhooks | Dar acceso controlado a terceros | Lista de llaves con nombre, prefijo, alcance, último uso y estado; webhooks con URL, eventos suscritos, estado y última entrega; formulario de creación con secreto visible una sola vez | Crear, copiar, revocar, probar webhook, rotar secreto; estado llave vencida y webhook fallido |

#### Reglas del módulo

- Un usuario no puede aprobar lo que ejecutó.
- Una llave o secreto se muestra una sola vez y no se puede recuperar.
- Los permisos se aplican por módulo, acción y compañía.
- Toda acción sensible queda en auditoría con motivo.
- Un conector desactivado no pierde los eventos pendientes; los conserva en
  cola.

---

### 6.11 Colaboración y globales

**Propósito.** Dar una capa común de inicio, tareas, búsqueda, notificaciones y
asistencia para toda la suite.

**Roles.** Todos, con contenido filtrado por permisos y alcance.

#### Funcionalidades

| ID | Funcionalidad | Qué debe poder hacer el usuario |
|---|---|---|
| F-GLB-001 | Inicio | Ver el estado general y las tareas priorizadas |
| F-GLB-002 | Tareas y aprobaciones | Ver, filtrar y resolver pendientes de todos los módulos |
| F-GLB-003 | Búsqueda global | Encontrar documentos, terceros y acciones desde cualquier pantalla |
| F-GLB-004 | Notificaciones | Recibir avisos de vencimientos, aprobaciones y errores |
| F-GLB-005 | Asistente financiero | Hacer preguntas y recibir respuestas con enlaces a la fuente |

#### Pantallas

| ID | Pantalla | Objetivo | Contenido clave | Acciones y estados |
|---|---|---|---|---|
| D-GLB-01 | Inicio | Entender la situación y empezar el día | Saludo y contexto de compañía y periodo; tarjetas de cobrar, pagar, disponible, presupuesto y obligaciones fiscales; gráfico de flujo; lista de tareas y aprobaciones; alertas; accesos rápidos | Ir a un módulo, resolver tarea, cambiar periodo, personalizar tarjetas; estados sin datos y periodo cerrado |
| D-GLB-02 | Tareas y aprobaciones | Resolver pendientes sin buscarlos | Bandeja unificada con tipo, documento, módulo, importe, solicitante, fecha límite y estado; filtros por módulo y prioridad; detalle lateral con aprobación | Aprobar, rechazar, delegar, abrir documento, marcar leída; estado tarea vencida y conflicto de interés |
| D-GLB-03 | Búsqueda global | Llegar a cualquier cosa en dos pasos | Paleta con campo de búsqueda y secciones Documentos, Terceros, Informes, Acciones y Ayuda; resultado con tipo, número, tercero, importe y estado; historial y sugerencias | Abrir resultado, filtrar por tipo, ver todo; estado sin resultados y búsqueda demasiado corta |
| D-GLB-04 | Notificaciones | Ver qué requiere atención | Panel agrupado por Hoy, Esta semana y Anteriores; tipos de aviso con icono; marca de leída; enlace al documento | Marcar leída, marcar todas, configurar preferencias, abrir; estado sin notificaciones y notificación de error |
| D-GLB-05 | Asistente financiero | Responder dudas con datos de la suite | Panel lateral con conversación, preguntas sugeridas, respuesta con cifras y enlaces a la pantalla o informe que la sustenta; aviso de alcance y de datos usados | Preguntar, abrir fuente, copiar respuesta, limpiar conversación; estado sin permisos y respuesta sin datos suficientes |

#### Reglas del módulo

- El inicio solo muestra datos de las compañías a las que el usuario tiene
  acceso.
- Una tarea delegada cambia de responsable y conserva el historial.
- La búsqueda respeta permisos y no muestra documentos de otras compañías.
- El asistente nunca inventa cifras: si no tiene el dato, lo dice y ofrece la
  pantalla donde consultarlo.
- Las notificaciones no sustituyen la bandeja de tareas.

---

## 7. Flujos navegables obligatorios

Cada flujo debe estar conectado en el prototipo y conservar el contexto de
compañía y periodo.

### Flujo 1 — Facturar, enviar a la DIAN y cobrar

`D-GLB-01` → `D-INV-02` → `D-INV-05` → `D-INV-06` → `D-AR-01` → `D-AR-03`
→ `D-AR-04` → `D-BNK-05`

El usuario crea una factura, la emite, la envía a la DIAN, ve el estado, la
encuentra en cartera, registra el recibo, aplica el pago y concilia el ingreso
en el banco.

### Flujo 2 — Comprar, aprobar y pagar

`D-AP-01` → `D-AP-02` → `D-AP-03` → `D-AP-04` → `D-AP-05` → `D-BNK-03`
→ `D-BNK-05`

El usuario revisa la obligación, arma la propuesta, la envía a aprobación, la
aprueba con otro rol, registra el pago y lo concilia.

### Flujo 3 — Conciliar el banco

`D-BNK-01` → `D-BNK-04` → `D-BNK-05` → `D-BNK-06` → `D-BNK-10`

El usuario importa el extracto, concilia las coincidencias, crea una regla para
la próxima vez y revisa las partidas que quedan abiertas.

### Flujo 4 — Dar de alta y depreciar un activo

`D-AST-02` → `D-AST-03` → `D-AST-04` → `D-AST-05` → `D-AST-06`

El usuario registra el activo, revisa su tabla de depreciación, ejecuta la
corrida del mes, registra una mejora y finalmente da de baja con acta.

### Flujo 5 — Presupuestar y controlar

`D-BGT-01` → `D-BGT-02` → `D-BGT-03` → `D-BGT-04` → `D-BGT-05` → `D-BGT-06`

El usuario crea la versión, edita las líneas, distribuye el anual, la envía a
aprobación, revisa la ejecución y compara contra el real.

### Flujo 6 — Preparar y presentar impuestos

`D-TAX-01` → `D-TAX-05` → `D-TAX-07` → `D-TAX-08` → `D-TAX-06`

El usuario revisa el panel fiscal, prepara la declaración, revisa el borrador,
presenta, registra el pago y genera la exógena del periodo.

### Flujo 7 — Cerrar el periodo

`D-CLS-01` → `D-CLS-02` → `D-CLS-03` → `D-RPT-02` → `D-RPT-03`

El usuario revisa el avance, completa el checklist, cierra con validaciones,
ejecuta el informe de cierre y crea un snapshot certificable.

### Flujo 8 — Consolidar el grupo

`D-CLS-05` → `D-CLS-06` → `D-RPT-02` → `D-GLB-01`

El usuario simula la consolidación, homologa cuentas, resuelve eliminaciones,
ejecuta la consolidación y consulta el estado del grupo.

---

## 8. Datos mock

Usa estos datos en todas las pantallas para que el prototipo se sienta real y
coherente.

### 8.1 Contexto

| Dato | Valor |
|---|---|
| Compañía | Compañía Demo S.A.S. |
| NIT | 900.123.456-7 |
| Ciudad | Bogotá D.C. |
| Régimen | Responsable de IVA |
| Año | 2026 |
| Periodo abierto | Febrero de 2026 |
| Periodo cerrado | Enero de 2026 |
| Moneda | COP |
| UVT 2026 | $ 49.799 |

### 8.2 Usuarios

| Nombre | Rol | Correo |
|---|---|---|
| Laura Gómez | Gerente financiero | laura.gomez@empresa.co |
| Andrés Rojas | Tesorero | andres.rojas@empresa.co |
| Camila Pérez | Cobranzas | camila.perez@empresa.co |
| Diego Martín | Compras | diego.martin@empresa.co |
| Valentina Ruiz | Analista financiero | valentina.ruiz@empresa.co |
| Felipe Torres | Auditor | felipe.torres@empresa.co |

### 8.3 Terceros

| Tercero | NIT | Tipo |
|---|---|---|
| Distribuidora Andina S.A.S. | 830.456.789-1 | Cliente |
| Comercializadora del Caribe Ltda. | 900.654.321-8 | Cliente |
| Almacenes La Montaña S.A.S. | 811.222.333-4 | Cliente |
| Suministros Industriales S.A.S. | 860.111.222-3 | Proveedor |
| Servicios Logísticos del Norte Ltda. | 901.222.333-5 | Proveedor |

### 8.4 Documentos

| Documento | Tercero | Fecha | Bruto | IVA | Retención | Total | Estado |
|---|---|---|---|---|---|---|---|
| FV-2026-000245 | Distribuidora Andina | 12/02/2026 | 18.560.000 | 3.526.400 | 464.000 | 21.622.400 | Aceptada DIAN |
| FV-2026-000246 | Comercializadora del Caribe | 15/02/2026 | 7.800.000 | 1.482.000 | 195.000 | 9.087.000 | Por enviar |
| FC-2026-000118 | Suministros Industriales | 05/02/2026 | 12.400.000 | 2.356.000 | 310.000 | 14.446.000 | Vence 05/03/2026 |
| NC-2026-000019 | Distribuidora Andina | 18/02/2026 | 1.200.000 | 228.000 | 30.000 | 1.398.000 | Aprobada |

### 8.5 Tesorería

| Cuenta | Banco | Tipo | Número | Saldo |
|---|---|---|---|---|
| Cuenta corriente | Bancolombia | Corriente | 123-456789-01 | 84.320.000 |
| Cuenta de ahorros | Davivienda | Ahorros | 987-654321-00 | 32.450.000 |
| Caja menor | — | Efectivo | CAJA-01 | 1.200.000 |

Extracto de febrero: 14 movimientos, 9 conciliados, 3 pendientes y 2 diferencias
por comisión bancaria.

### 8.6 Activos

| Activo | Categoría | Valor | Vida útil | Depreciación mensual |
|---|---|---|---|---|
| Vehículo Toyota Hilux ABC-123 | Vehículos | 145.000.000 | 5 años | 2.416.667 |
| Servidor Dell PowerEdge | Equipos de cómputo | 38.000.000 | 3 años | 1.055.556 |
| Mobiliario oficina sede norte | Muebles y enseres | 22.500.000 | 10 años | 187.500 |

### 8.7 Presupuesto

| Concepto | Presupuesto 2026 | Ejecutado a febrero | Comprometido | Disponible |
|---|---|---|---|---|
| Ingresos operacionales | 1.200.000.000 | 186.400.000 | 0 | 1.013.600.000 |
| Gastos de personal | 480.000.000 | 78.200.000 | 4.500.000 | 397.300.000 |
| Gastos generales | 300.000.000 | 46.800.000 | 12.300.000 | 240.900.000 |

### 8.8 Impuestos

| Obligación | Periodo | Valor | Vence | Estado |
|---|---|---|---|---|
| IVA | Febrero 2026 | 8.450.000 | 12/03/2026 | En preparación |
| Retención en la fuente | Febrero 2026 | 3.120.000 | 12/03/2026 | En preparación |
| ICA Bogotá | Febrero 2026 | 1.240.000 | 20/03/2026 | Pendiente |
| Exógena 2025 | Año 2025 | — | 30/04/2026 | Validando |

### 8.9 Cierre

Febrero de 2026: checklist con 18 tareas, 15 completadas, 2 en curso y 1
bloqueante (conciliación bancaria pendiente).

---

## 9. Instrucciones para Figma Make

### 9.1 Estructura del archivo

Organiza el archivo en estas páginas:

1. `00 Portada` — nombre, versión, fecha y alcance.
2. `01 Design system` — tokens, tipografía, iconos y componentes con variantes.
3. `02 Shell` — navegación, header y estados globales.
4. `03 Facturación` a `13 Colaboración` — una página por módulo.
5. `14 Flujos` — los 8 recorridos conectados.
6. `15 Estados` — carga, vacío, error, sin permiso y periodo cerrado.
7. `16 Datos mock` — tablas de referencia reutilizables.

### 9.2 Frames

- Frame principal: 1440 × 900 px, escritorio.
- Frame mínimo: 1280 × 800 px.
- Modales: 560 y 720 px de ancho.
- Drawers: 480 px de ancho.
- Usa Auto Layout en todo; no dejes elementos absolutos sin intención.
- Nombra los frames con el ID de pantalla: `D-AR-04 Aplicación de pagos`.

### 9.3 Componentes y variantes

- Crea cada componente con sus variantes de estado: default, hover, focus,
  disabled, loading y error.
- Usa variables para color, tipografía y espaciado; no escribas valores sueltos.
- Las tablas deben tener variantes de densidad compacta y cómoda.
- Los formularios deben tener variantes de una, dos y tres columnas.
- Los estados vacíos y de error son componentes, no dibujos sueltos.

### 9.4 Contenido

- Todo el texto va en español y con datos mock colombianos.
- No uses lorem ipsum.
- No inventes acciones que no estén en este documento.
- Cada pantalla debe tener una acción primaria visible.
- Cada tabla debe tener al menos 5 filas de ejemplo y una fila seleccionada.

### 9.5 Prototipo

- Conecta los 8 flujos con transiciones simples y realistas.
- Mantén el sidebar y el header fijos en todas las pantallas.
- Al cambiar de compañía o periodo, muestra el cambio de contexto.
- Incluye al menos un caso de periodo cerrado y uno de sin permiso.
- Incluye un caso de error de integración y uno de rechazo DIAN.

### 9.6 Qué no hacer

- No diseñes pantallas de nómina, inventario, producción, punto de venta, CRM
  ni comercio electrónico.
- No diseñes el mantenimiento de catálogos maestros; usa selectores y creación
  rápida en modal.
- No uses datos reales de personas o empresas.
- No cambies los tokens ni la tipografía definidos en este documento.
- No entregues pantallas aisladas sin flujo.

---

## 10. Cobertura del encargo

| Módulo | Funciones | Pantallas |
|---|---|---|
| Facturación | 12 | 9 |
| Cartera | 12 | 9 |
| Cuentas por pagar | 12 | 8 |
| Tesorería | 12 | 10 |
| Activos fijos | 10 | 7 |
| Presupuesto | 10 | 7 |
| Impuestos | 14 | 8 |
| Informes | 9 | 6 |
| Cierres y consolidación | 10 | 6 |
| Administración y seguridad | 18 | 7 |
| Colaboración y globales | 5 | 5 |
| **Total** | **124** | **82** |

Las funciones que no tienen pantalla propia se representan en componentes
transversales: `DocumentTimeline`, `ApprovalStepper`, `StatusChip`,
`AuditLog`, `RuleBuilder`, `ReconciliationMatcher` y `SummaryPanel`.

Este encargo cubre las 124 funciones de los módulos visibles. La plataforma
(compañías, periodos, monedas, secuencias y bloqueos) y los catálogos maestros se
resuelven con los patrones transversales y con selectores con búsqueda; no se
diseñan como módulos independientes.

---

## 11. Criterios de aceptación

- [ ] Existe la página de design system con tokens y componentes variantes.
- [ ] Existe el shell con sidebar, header y selector de compañía y periodo.
- [ ] Están las 82 pantallas de los 11 módulos.
- [ ] Cada pantalla tiene acción primaria, estados de carga, vacío y error.
- [ ] Están los estados de sin permiso y periodo cerrado.
- [ ] Los 8 flujos están conectados y se recorren sin callejones sin salida.
- [ ] Los datos mock son coherentes entre pantallas.
- [ ] Los importes, NIT, fechas y porcentajes usan formato colombiano.
- [ ] Las acciones sensibles muestran consecuencia y motivo.
- [ ] No hay módulos ni acciones fuera de este documento.
- [ ] No se usan datos reales ni lorem ipsum.

---

## 12. Prompt listo para pegar en Figma Make

> Diseña un prototipo de alta fidelidad, navegable y en español para una suite
> financiera colombiana. El brief completo está en este documento y es
> autónomo: no necesitas archivos, repositorios ni pantallas previas.
>
> Crea un design system con sidebar `#001F4C`, acción `#0073C0`, acento
> `#00B0F2`, fondo `#F3F4F6`, tarjetas blancas, tipografía Inter para texto y
> JetBrains Mono para cifras. Usa tablas densas, filtros, chips de estado y
> paneles laterales.
>
> Diseña el shell con selector de compañía, periodo y búsqueda global, y los 11
> módulos: Facturación, Cartera, Cuentas por pagar, Tesorería, Activos fijos,
> Presupuesto, Impuestos, Informes, Cierres, Administración y Colaboración.
> Incluye las 82 pantallas descritas, con sus formularios, tablas, drawers,
> modales y estados.
>
> Conecta los 8 flujos: facturar y cobrar, comprar y pagar, conciliar banco,
> activo fijo, presupuesto, impuestos, cierre y consolidación. Usa datos mock
> colombianos: Compañía Demo S.A.S., NIT 900.123.456-7, periodo febrero de 2026
> abierto, enero cerrado, COP, UVT $ 49.799.
>
> Incluye estados de carga, vacío, error, sin permiso, periodo cerrado, rechazo
> DIAN y falla de integración. No diseñes nómina, inventario, producción, punto
> de venta, CRM ni comercio electrónico. No inventes funciones fuera de este
> documento y no uses lorem ipsum.
