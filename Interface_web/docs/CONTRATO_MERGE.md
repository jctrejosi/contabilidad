# CONTRATO v2 — Compleción de Interfase_web_figma (CONTABDSI)

Referencia para implementar las pantallas que faltan en `Interfase_web_figma`
(React 19 + Vite + Tailwind v4 + TypeScript, pnpm). La funcionalidad se porta del
proyecto hermano `Interface_web_deepseek`, pero **reescrita** en el estilo y la
arquitectura de ESTE proyecto. NO copiar componentes del otro stack.

## Estado actual (ya analizado)

- Implementadas y funcionando: Dashboard, Lotes (flujo completo), CapturaDirecta,
  Anulacion, PlanCuentas, Terceros, MovimientoMensual, BalanceComprobacion,
  DocumentoOficial, Informes (hub sin vista previa), Impuestos (medios con pasos
  vacíos), Reprocesos, Cierres, Consolidacion, **ParametrosOperacion (hecho a mano,
  calidad alta — NO tocar)**.
- Pendientes (PlaceholderPage): importaciones, nómina, reembolsos, 8 consultas,
  11 configuraciones, 4 administración. → ESTO es el trabajo de los agentes.

## Estilo de la casa v2 (patrón ParametrosOperacion.tsx — seguirlo)

- Clases compartidas al inicio del archivo:
  ```ts
  const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
  const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
  const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
  ```
- Agrupar campos con `<fieldset className="rounded-md border border-gray-200 px-3 pb-3">` +
  `<legend className="px-2 text-xs font-semibold text-petroleum-800">…</legend>`.
- Modal: `<dialog>` nativo con `showModal()`, `data-initial-focus`, clase
  `fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-lg border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/40`, header con título y botón ×,
  footer con botones.
- Checkboxes/radios con `accent-petroleum-500`.
- Cabecera de página: breadcrumb `text-xs text-gray-400` (p. ej. "Configuración / Comprobantes"),
  h1 `text-lg font-semibold text-gray-800`, subtítulo `text-xs text-gray-500`,
  badge `rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700` con "Datos de demostración".
- Contenedor: `mx-auto max-w-6xl space-y-3 p-4` (formularios) o `p-4 space-y-4 max-w-screen-2xl` (tablas).
- Tablas: wrapper `bg-white rounded border border-gray-200 overflow-hidden` +
  `table-fixed-header overflow-x-auto` + `table w-full text-xs`, thead
  `bg-gray-50 border-b border-gray-200`, tbody `divide-y divide-gray-50`, filas `hoverable`,
  números `font-mono` alineados a la derecha.
- Dinero con `fmtCOP(n)` de `../data/mock`. Fechas en `font-mono`.
- Badges: `text-xs px-2 py-0.5 rounded-full font-medium` + bg-green-100/text-green-700,
  bg-red-100/text-red-700, bg-amber-100/text-amber-700, bg-blue-100/text-blue-700,
  bg-gray-100/text-gray-600.
- Validación: funciones puras (`validarX`, `esXValido`) y datos mock en un archivo
  propio `src/data/<miPantalla>.ts` SI conviene; si no, constantes locales en la página.
  NO editar `src/data/mock.ts`, `src/types.ts`, `src/App.tsx`, `src/components/Shell.tsx`.
- Default exports. Semicolons. Comillas simples (dobles solo con apóstrofes).
- Persistencia con localStorage donde aporte (patrón `contabdsi:<pantalla>:v1:001`),
  con try/catch y guarda de tipos (`esXGuardado`). No es obligatorio en todas.
- Español, COP, coherente con los mocks. No instalar dependencias.

## Datos disponibles (`../data/mock`)

`EMPRESA` (001 — Compañía Demo S.A.S., NIT 900.123.456-7), `PERIODO` (2026-02 Febrero,
Abierto), `USUARIO` (Laura Gómez — Contador principal), `CENTROS` (ADM/VEN/OPE),
`COMPROBANTES` (RC, CE, CP, NI, NV), `CUENTAS: Cuenta[]` (codigo, nombre, nivel,
afectable, requiereTercero, requiereCentro, requiereBase, ajuste, claseIVA,
claseRetencion, saldoInicial, movimientos[{mes,debito,credito}]), `TERCEROS: Tercero[]`
(nit, digito, nombre, tipo, tipoDoc, direccion, telefono, ciudad, estado, saldo, cupo,
fechaCreacion), `LOTES_INICIALES: Lote[]`, `MOVIMIENTOS_FEB: MovimientoLinea[]`,
`SALDOS_BALANCE: SaldoCuenta[]`, `ALERTAS`, `fmt`, `fmtCOP`.

## Tipos (`../types`)

`LoteEstado` (en español: 'Borrador'…'Anulado'), `Rol`, `Cuenta`, `Tercero`,
`CentroCosto`, `Comprobante`, `LoteLinea { id, cuenta, nombreCuenta, nit, tercero,
centro, comprobante, documento, fecha, debito, credito, base, clase, docAfectado,
concepto, errores: string[] }`, `Lote { id, codigo, nombre, periodo, usuario, origen,
fecha, lineasCount, debito, credito, diferencia, erroresCount, estado, lineas }`,
`MovimientoLinea`, `SaldoCuenta`, `AlertaContable`.

## Contrato de props (App.tsx lo cablea al final — NO editar App.tsx)

- Generan lote (Importaciones, Nomina, Reembolsos, Plantillas, Reclasificaciones):
  ```ts
  import type { Lote } from '../types';
  import type { NavPage } from '../components/Shell';
  interface Props { onNavigate: (p: NavPage) => void; onCrearLote: (l: Lote) => void; }
  export default function Importaciones({ onNavigate, onCrearLote }: Props) { ... }
  ```
  Lote generado: id `lote-${Date.now()}`, codigo (NOM3/IMP2/REB1…), nombre, periodo
  '2026-02', usuario 'Laura Gómez', origen, fecha, lineasCount, debito=Σ, credito=Σ,
  diferencia=0 (CUADRADO), erroresCount=0, estado 'Borrador', lineas completas con
  id 'L01'…, nombreCuenta derivado de CUENTAS, errores: []. Tras crear: `onCrearLote(lote)`
  y mostrar aviso con botón "Abrir lotes" → `onNavigate('movimientos/lotes')`.

- Consultas con acceso al documento: `{ onOpenDocumento?: () => void }`.
- Config/Admin sin props (salvo las que generan lote).
- ParametrosOperacion ya existe con prop `{ onExit }` — no tocarlo.

## Requisitos por pantalla (resumen)

### Movimientos
- **Importaciones**: asistente por pasos (stepper): 1) archivo (input file que solo
  muestra nombre/tamaño simulado) + formato (XLS/XLSX, ADT, XLS por meses, TXT, CSV);
  2) hoja + mapeo de columnas (columna → cuenta/NIT/centro/comprobante/documento/tipo/
  fecha/débito/crédito/base/impuesto/concepto) + plantillas de mapeo guardadas;
  3) previsualizar 10 filas; 4) validar (aceptadas/advertidas/rechazadas/duplicadas
  con conteos) + elegir lote destino (existente o nuevo); 5) importar → onCrearLote +
  resultado. REGLA visible: toda importación masiva termina en lote.
- **Nomina**: Tabs Nómina/Aportes/Provisiones con parámetros (período, documento
  NOM-2026-XX, comprobante CE, centro por defecto, tercero empleados) + líneas de
  ejemplo cuadradas por flujo + "Generar lote" (onCrearLote Borrador).
- **Reembolsos**: encabezado (tercero, período, fecha, comprobante, caja menor) +
  detalle editable (concepto/cuenta/centro/débito o crédito) + totales con
  Cuadrado/Descuadrado + Guardar / Crear lote (onCrearLote) / Cancelar.

### Consultas (todas con Buscar/Filtrar, Imprimir, Exportar, Ver detalle, Volver)
- **ConsultaDocumentos**: filtros (período, comprobante, tipo doc, NIT, fechas) +
  documentos agrupados de MOVIMIENTOS_FEB + Ver detalle → onOpenDocumento.
- **SaldosAnuales**: SALDOS_BALANCE con saldo inicial + 12 meses + total; pestaña
  "13-18" con columnas de ajuste (mock local).
- **AnualCuenta / AnualTercero / AnualCentro**: selector (cuenta/tercero/centro) +
  tabla 12 meses + total; drill-down mensual que expande líneas (de MOVIMIENTOS_FEB
  y mocks locales coherentes).
- **SaldosCuentaCentro**: DOS paneles relacionados (2 columnas): cuenta → centros con
  saldos; centro → cuentas con saldos; selección sincronizada; clic en saldo → documento.
- **DocumentoEspecifico**: búsqueda por documento propio o afectado → líneas + acceso
  al documento oficial.
- **Comparativos**: Tabs: (a) un mes entre dos contabilidades (001 vs 002 mock) con
  diferencia en rojo; (b) centros entre dos contabilidades; (c) dos meses de una
  contabilidad. Botón "Exportar diferencias".

### Configuración (CRUD + filtros + Crear/Editar/Eliminar/Buscar/Exportar)
- **Comprobantes**: CRUD de COMPROBANTES (codigo, nombre, tipo, consecutivo).
- **Centros**: CRUD jerárquico de CENTROS (nivel, padre).
- **RenglonesRenta**: CRUD (código, nombre, cuenta, signo) + generador con selección
  de renglones/cuentas, totales, orden y vista previa.
- **TiposDocumento**: CRUD tipos + numeración MANUAL/AUTOMÁTICA + consecutivo +
  flags tercero/centro obligatorio.
- **ConfigRetenciones**: conceptos/tarifas/cuentas CRUD; aviso "Pendiente de
  validación funcional" al cambiar tarifas.
- **ConfigIVA**: tarifas (0/5/19) y cuentas CRUD.
- **Plantillas**: plantillas contables (nombre + líneas cuenta/débito/crédito) CRUD +
  "Usar plantilla" → onCrearLote.
- **Companias**: tabla (001 activa + mocks) con Crear (código/nombre/NIT/estado),
  Trasladar (año origen/destino con progreso), Limpiar compañía (modal de riesgo:
  contexto, tablas afectadas, motivo ≥10 chars, texto exacto "LIMPIAR COMPAÑIA").
- **FormatosDocumentales**: editor visual: lista de formatos; lienzo con elementos
  (leyendas, imagen placeholder, rectángulo/línea, campos comprobante/documento/fecha/
  totales); propiedades simples; vista previa; Guardar/Cancelar; Crear/Modificar/Eliminar.
- **Especiales**: lista de ~20 funciones de alto riesgo, cada una con modal de
  confirmación (motivo + texto exacto) y ejecución simulada con progreso. Secciones
  "Analizar plan" vs "Eliminar cuentas en cero". "Fusión de movimientos" deshabilitada
  con badge "En desarrollo".
- **Reclasificaciones**: formularios (cuenta-documento a centro; comprobante-documento-
  tercero; centro por cuenta; analizar plan por nivel; analizar movimiento por mes) con
  simulación y "Generar lote" (onCrearLote Borrador).

### Administración
- **UsuariosPermisos**: tabla de usuarios (6 roles) + CRUD simulado + matriz rol ×
  permisos con checkboxes (Administrador fijo e inmodificable).
- **Bitacora**: grilla de eventos (fecha, usuario, rol, acción, módulo, detalle,
  resultado) con filtros + exportar; 10+ eventos coherentes con el flujo NOM2.
- **Integraciones**: tarjetas de módulos externos (Facturación, Cartera, Inventario,
  CxP, Nómina) con estado Conectado/Desconectado/Bloqueado, probar/sincronizar
  simulados, banner de "bloqueo del almacenamiento legado", sección colapsable de
  funciones compartidas (vehículos/zonas/eventos/ciudades) informativa.
- **Reorganizacion**: modo mantenimiento con modal de riesgo (respaldo obligatorio,
  exclusividad, motivo, texto exacto "REORGANIZAR"), progreso y resultado.

## Coherencia contable

- Débito y crédito separados; nunca crédito negativo; contabilizar solo si son iguales.
- Cuenta no afectable no acepta movimiento; tercero/centro/base según CUENTAS.
- Fecha y documento deben concordar con el período 2026-02.
- Importación masiva → lote. Anulación crea reversión trazable (no borra el original).
- Acciones destructivas piden motivo/confirmación; trabajos largos muestran progreso.
- Los números de ejemplo deben cuadrar (p. ej. NOM2: 12.600.000 = 12.600.000).

## Verificación

`pnpm build` en `/home/jk/Proyectos/dsi/contabilidad/Interfase_web_figma`. Corregir
SOLO los errores de los archivos propios (otros agentes trabajan en paralelo).
Responder con resumen breve + resultado del build.
