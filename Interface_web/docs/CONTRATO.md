# CONTRATO DE DESARROLLO — CONTABDSI (prototipo React)

Documento de referencia para implementar las páginas del prototipo CONTABDSI.
Cada agente tiene un **conjunto de archivos asignado (write set)** y NO debe modificar
archivos fuera de él. El build actual compila con `npm run build`.

## Estructura

```
Interface_web/
  src/
    core/types.ts        ← tipos de dominio
    core/format.ts       ← money, fecha, fechaHora, nitFmt, nombreMes, sum, uid
    data/mock.ts         ← datos mock (cuentas, terceros, centros, lotes…)
    data/reports.ts      ← catálogo de informes (REPORTS, REPORT_CATEGORIES)
    state/AppStore.tsx   ← store global (contexto + reducer)
    components/ui/       ← kit UI genérico
    components/accounting/ ← kit contable
    shell/               ← sidebar + header + toasts (NO modificar)
    pages/               ← las páginas (aquí trabaja cada agente)
```

## Convenciones obligatorias

- TypeScript estricto: `verbatimModuleSyntax` → los tipos se importan con `import type`.
- `noUnusedLocals`/`noUnusedParameters`: sin imports ni variables sin usar.
- `erasableSyntaxOnly`: prohibidos los `enum`; usar uniones de tipos o const objects.
- React 19 + `react-router-dom` v7. Navegación: `useNavigate()`, `<Link to="...">`.
- Alias `@/` → `src/`.
- Sin dependencias nuevas, sin npm install, sin tocar `package.json`.
- Todos los textos en español; valores COP; dinero con `money(v)` (ya formatea miles y 2 decimales).
- Los datos de estado deben venir de `useStore()` (lotes, documentos, terceros…), NO copias locales,
  para que el flujo interactivo persista entre pantallas.
- Para acciones sensibles: `audit(accion, modulo, detalle, resultado)` y `toast(kind, titulo, detalle)`.
- Simular (no conectar backend): cargas de archivo con `<input type="file">` (solo leer `name`),
  trabajos en segundo plano con `setTimeout` + progreso, validaciones y confirmaciones con modales.

## Store — `@/state/AppStore`

```ts
const { state, dispatch, toast, audit, can } = useStore()
const puede = useCan('mov.lotes.aprobar')          // boolean según rol actual
const { contabilizar, progreso } = useContabilizar()
```

`state` incluye: `session { user { nombre, role, iniciales }, company { codigo, nombre, nit },
year, period, periodName, periodStatus }`, `role`, `periodStatus`, `massiveLock`,
`accounts`, `terceros`, `centros`, `vouchers`, `tiposDocumento`, `conceptosRetencion`,
`tarifasIVA`, `lotes: Lote[]`, `documentos: DocumentoContable[]`, `bitacora`,
`acumuladosFecha`, `featureFlags { presupuesto }`, `sidebarCollapsed`, `density`.

Acciones `dispatch({type: ...})` disponibles (ver firma exacta en AppStore.tsx):
`SET_ROLE, SET_PERIOD_STATUS, SET_MASSIVE_LOCK, ADD_LOTE, UPDATE_LOTE, DELETE_LOTE,
UPDATE_LINEA, ADD_LINEA, DELETE_LINEA, MOVE_LINEA, VERIFICAR, SOLICITAR_APROBACION,
APROBAR, CONTABILIZANDO, CONTABILIZAR_OK, CONTABILIZAR_FALLIDO, ANULAR_LOTE,
REASIGNAR_LOTE, DEPURAR_LOTE, BITACORA, REGEN_ACUMULADOS, SET_FLAG`.

- `UPDATE_LINEA(codigo, lineaId, patch)` revalida el lote y recalcula `issues`/estado.
- `VERIFICAR(codigo)` valida y deja VERIFICADO o CON_ERRORES.
- La contabilización real se hace con `useContabilizar().contabilizar(codigo)` (transición
  CONTABILIZANDO → CONTABILIZADO, crea el `DocumentoContable` y emite el evento de ventana
  `contab:receipt` con el documento).
- El cambio de rol se simula desde el header (menú de usuario). Las páginas deben ocultar o
  deshabilitar acciones según `useCan('permiso')` (lista de permisos en `core/types.ts`).

## Kit UI — `@/components/ui`

`Icon(name,size,className)`, `Button({variant:'primary'|'secondary'|'ghost'|'danger'|'success'|'subtle', size:'sm'|'md'|'lg', icon, iconRight, disabled, loading, onClick, children, title, danger})`,
`IconButton({icon,label,onClick,disabled,danger,active})`, `Badge({tone:'neutral'|'success'|'warning'|'danger'|'info'|'brand'|'outline', icon, children})`,
`Card({title,icon,actions,footer,pad,tone,children})`,
`Field({label,required,error,hint,children,width})`, `Input`, `Select({value,onChange,options:[{value,label}],placeholder})`,
`Textarea`, `Checkbox({checked,onChange,label,indeterminate})`, `Switch({checked,onChange,label})`,
`Segmented({value,onChange,options:[{value,label}]})`, `Tabs({tabs:[{key,label,icon,badge}],active,onChange})`,
`Toolbar`, `ToolbarGroup`, `SearchInput({value,onChange,width,placeholder})`,
`Modal({open,onClose,title,icon,children,footer,width,tone})`,
`ConfirmModal({open,onClose,onConfirm,title,message,confirmLabel,cancelLabel,danger,children})`,
`Spinner`, `EmptyState({icon,title,detail,action})`, `LoadingState`, `ErrorState({onRetry})`,
`NoPermissionState({perm})`, `SuccessState`, `Kbd`, `ProgressBar({pct,tone,label})`,
`Divider({label})`, `Menu({open,onClose,items,align})`, `PageHeader({title,subtitle,icon,actions,badge})`.

Íconos disponibles (usar `grep '^  [a-z].*:' src/components/ui/index.tsx` para la lista):
home, dashboard, libro, entrada, salida, lote, x, anular, importar, nomina, reembolso, lupa, doc,
calendario, informe, retencion, iva, medio, reproceso, cierre, consolidar, parametros, plan,
terceros, comprobante, centro, renta, plantilla, compania, formato, especial, reclasificar,
usuarios, bitacora, integracion, reorganizar, presupuesto, plus, edit, trash, check, chevronD,
chevronR, chevronL, filter, download, upload, print, columns, kebab, lock, unlock, user, bell, eye,
copy, refresh, save, file, list, warn, error, info, success, arrowUp, arrowDown, excel, pdf, play,
pause, clock, shield, db, star, menu, git, trendUp, link, sliders, key, chip.

## Kit contable — `@/components/accounting`

**DataGrid** (`DataGrid.tsx`):
- `AccountingDataGrid<T>({ rows, columns, rowKey, selected, onSelect, onRowClick, onRowDoubleClick,
  searchText, onSearchChange, searchable, totals, empty, toolbar, initialSort, getRowTone, height, selectable, busy })`
  `columns: { key, label, align?, money?, width?, minWidth?, sortable?, render?(row), searchValue?(row), sticky? }[]`
  `totals: { label, key, value, align?, money? }[]` — el total se muestra en la columna `key`.
- `AccountingEntryGrid({ lineas, onChange, issues, readOnly, height, extraActions, revealIssue })` —
  grilla editable (Enter/F2 edita, F3 elimina, Tab/Escape). `revealIssue` posiciona la celda del issue.
- `DebitCreditSummary({ debito, credito, compact })`
- `StatusBadge({ estado })` (LoteEstado), `PeriodBadge({ status })`

**Combobox** (`Combobox.tsx`): `AccountPicker`, `ThirdPartyPicker`, `CostCenterPicker`,
`VoucherPicker`, `DocumentTypePicker`, `TaxRatePicker({kind:'retencion'|'iva'})` — todos
`{ value, onChange, width?, disabled?, error? }`. También `TerceroLabel({nit})`, `AccountLabel({code})`, `CentroLabel({code})`.

**Widgets** (`Widgets.tsx`):
- `ValidationCenter({ issues, title, onGoToIssue, height })`
- `ProcessWizard({ steps:[{key,label,icon,done,disabled,danger}], active, onSelect, children })`
- `DangerConfirmation({ open, onClose, onConfirm:(motivo)=>void, title, descripcion,
  tablasAfectadas, confirmText, simulacion:[{descripcion,valor}], extraBody, confirmLabel })` —
  modal reforzado: pide motivo (mín. 10 chars) y texto exacto.
- `AuditTimeline({ events, height })`
- `CompanyPeriodSwitcher()` — ya está en el header, no repetir.
- `ReportParameters({ params, values, onChange, onGenerate })`
- `ReportPreview({ titulo, columns, rows, pageSize, company })` — `rows` es un arreglo de
  arreglos `{key, value}[]` por fila.
- `ExportMenu({ onExport, filename, disabled })` (PDF/XLSX/CSV/Imprimir simulados)
- `SavedView({ views, current, onLoad, onSave, onDelete })`
- `MoneyInput({ value, onChange, width })`, `parseMoney`, `downloadCsv(rows, filename)`
- `InfoStrip({ items:[{label,value}] })`, `usePageTitle('Título')`

## Tipos principales (`core/types.ts`)

`LineaMovimiento { id, cuenta, nit, centro, comprobante, documento, fecha, debito, credito,
base, clase:'IVA'|'RETENCION'|'OTRO'|'', docAfectado, concepto, origen }`
`Lote { codigo, nombre, periodo, usuario, origen, fecha, lineas, estado, issues, comprobante?,
documento?, audit, motivo? }` con `LoteEstado` ('BORRADOR'|'CON_ERRORES'|'VERIFICADO'|
'PENDIENTE_APROBACION'|'APROBADO'|'CONTABILIZANDO'|'CONTABILIZADO'|'FALLIDO'|'ANULADO').
`ValidationIssue { id, severidad:'ERROR'|'ADVERTENCIA', ambito, tipo, mensaje, lineaId?, campo? }`
`DocumentoContable { id, comprobante, documento, fecha, periodo, tercero?, nit?, concepto,
estado:'CONTABILIZADO'|'ANULADO', lineas, lote, usuario }`
`Account { code, nit?, nombre, nivel, afectable, controlaTercero, ajuste, centroCosto, clase,
movimiento, distribucion, porcentaje, cuentaBase?, saldoInicial, meses[], parent?, hijos? }`
`Tercero { zona, nit, digito, tipoDoc, nombre, direccion, telefono, ciudad, nitRelacionado,
estado:'ACTIVO'|'BLOQUEADO', motivoBloqueo?, fechaCreacion, saldo, cupo, sexo, nacimiento,
estadoWeb, etiquetas[] }`
`Centro { code, nombre, nivel, parent? }`, `Voucher`, `TipoDocumento`, `ConceptoRetencion`,
`TarifaIVA`, `AuditEvent`, `BitacoraEntry`, `ReportDef { id, nombre, categoria, descripcion, params, columns }`,
`ReportParam { key, label, tipo:'periodo'|'texto'|'select'|'checkbox'|'cuenta'|'tercero'|'centro'|'nivel', defaultValue?, options? }`,
`ReportColumn { key, label, align?, money?, width? }`.

## Datos mock

`@/data/mock`: `ROLES, USERS, ACCOUNTS, TERCEROS, CENTROS, VOUCHERS, TIPOS_DOCUMENTO,
CONCEPTOS_RETENCION, TARIFAS_IVA, LOTES_INICIALES, DOCUMENTOS_INICIALES, BITACORA_INICIAL,
makeLinea(partial), makeDocumento(partial)`.
`@/data/reports`: `REPORTS` (38 informes), `REPORT_CATEGORIES`.

**Flujo obligatorio que debe funcionar de punta a punta** (datos iniciales ya preparados):
Lote **NOM2 — Nómina febrero** (estado CON_ERRORES, 12 líneas, 2 errores: falta centro en la
línea 7 (cuenta 510506) y falta tercero en la línea 11 (cuenta 250505), 1 advertencia):
tablero → lote NOM2 → ver 2 errores → ir a la celda → corregir tercero y centro → cuadrado →
verificar → enviar a aprobación → aprobar → contabilizar (progreso) → recibo (evento
`contab:receipt`, detalle comprobante CE-000245 / documento NOM-2026-02) → abrir documento
oficial (`/documentos/:id`) → consulta mensual → balance de comprobación → exportar PDF/XLSX.

## CSS utilidades globales

`.page` (contenedor), `.page-grid` + `.col-3 .col-4 .col-6 .col-8 .col-9 .col-12`, `.row`,
`.stack`, `.gap-4/8/12/16`, `.spacer`, `.grow`, `.muted`, `.small`, `.xs`, `.bold`, `.right`,
`.center`, `.money`, `.tnum`, `.neg`, `.pos`, `.querybar`, `.master-split`, `.flow-steps`,
`.stat-card`, `.stat-label`, `.stat-value`, `.stat-sub`, `.infostrip`.
Los estilos propios de cada página deben ir en un archivo `pages/<área>/pages.css` importado
desde una de las páginas del área (o agregar al final de `src/index.css` si es compartido).

## Validación

Ejecutar `npm run build` en `Interface_web/`. Los errores de archivos de OTROS agentes pueden
aparecer mientras trabajan en paralelo: ignorarlos y corregir únicamente los propios.
No borrar exports que App.tsx importa (nombres `<Xxx>Page`).

## Roles (para probar permisos)

Header → menú de usuario → cambiar rol: ADMIN, CONTADOR, AUXILIAR, AUDITOR, TRIBUTARIO, GERENCIA.
Las páginas deben reaccionar a `useCan(...)`; mostrar `NoPermissionState` si la página entera
está bloqueada por permiso.
