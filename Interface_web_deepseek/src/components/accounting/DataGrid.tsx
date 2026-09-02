/* ============================================================
   CONTABDSI · Grillas contables
   AccountingDataGrid — tabla genérica: encabezado fijo, filtros,
   orden, búsqueda, columnas configurables, selección múltiple,
   totales, exportación y navegación por teclado.
   AccountingEntryGrid — grilla editable de líneas de movimiento.
   ============================================================ */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, Checkbox, Icon, IconButton, SearchInput, EmptyState, Toolbar } from '@/components/ui'
import { money } from '@/core/format'
import type { LineaMovimiento, LoteEstado, ValidationIssue } from '@/core/types'
import { AccountPicker, CostCenterPicker, ThirdPartyPicker, VoucherPicker, DocumentTypePicker, TaxRatePicker } from './Combobox'

export interface GridColumn<T> {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  money?: boolean
  width?: number | string
  minWidth?: number
  sortable?: boolean
  render?: (row: T) => ReactNode
  /** valor crudo para búsqueda */
  searchValue?: (row: T) => string
  sticky?: 'left' | 'right'
}

export interface GridTotal {
  label: string
  key?: string
  align?: 'left' | 'right'
  value: string | number
  money?: boolean
}

export function AccountingDataGrid<T>({
  rows,
  columns,
  rowKey,
  selected = new Set(),
  onSelect,
  onRowClick,
  onRowDoubleClick,
  searchText,
  onSearchChange,
  searchable = true,
  totals,
  empty,
  toolbar,
  initialSort,
  getRowTone,
  height,
  selectable = true,
  busy,
}: {
  rows: T[]
  columns: GridColumn<T>[]
  rowKey: (row: T) => string
  selected?: Set<string>
  onSelect?: (sel: Set<string>) => void
  onRowClick?: (row: T) => void
  onRowDoubleClick?: (row: T) => void
  searchText?: string
  onSearchChange?: (v: string) => void
  searchable?: boolean
  totals?: GridTotal[]
  empty?: ReactNode
  toolbar?: ReactNode
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  getRowTone?: (row: T) => 'danger' | 'warning' | 'info' | undefined
  height?: number | string
  selectable?: boolean
  busy?: boolean
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null)
  const [visible, setVisible] = useState<Set<string> | null>(null)
  const [colsOpen, setColsOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const shownCols = useMemo(() => (visible ? columns.filter((c) => visible.has(c.key)) : columns), [columns, visible])

  const filtered = useMemo(() => {
    let out = rows
    if (searchText) {
      const q = searchText.toLowerCase()
      out = out.filter((r) =>
        columns.some((c) => {
          const v = c.searchValue ? c.searchValue(r) : (c.render ? '' : String((r as Record<string, unknown>)[c.key] ?? ''))
          return v.toLowerCase().includes(q)
        }),
      )
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      out = [...out].sort((a, b) => {
        const av = String((a as Record<string, unknown>)[sort.key] ?? '')
        const bv = String((b as Record<string, unknown>)[sort.key] ?? '')
        if (col?.money || !Number.isNaN(Number(av)) && !Number.isNaN(Number(bv))) {
          return sort.dir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av)
        }
        return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }
    return out
  }, [rows, searchText, sort, columns])

  const allSel = filtered.length > 0 && filtered.every((r) => selected.has(rowKey(r)))
  const someSel = filtered.some((r) => selected.has(rowKey(r)))

  const toggleAll = () => {
    if (!onSelect) return
    const next = new Set(selected)
    if (allSel) filtered.forEach((r) => next.delete(rowKey(r)))
    else filtered.forEach((r) => next.add(rowKey(r)))
    onSelect(next)
  }

  const toggleRow = (row: T) => {
    if (!onSelect) return
    const next = new Set(selected)
    const k = rowKey(row)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    onSelect(next)
  }

  const gridRef = useRef<HTMLTableElement>(null)

  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(0)
  }, [filtered.length, activeIdx])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = filtered[activeIdx]
      if (row) onRowClick?.(row)
    } else if (e.key === ' ' && selectable && onSelect) {
      e.preventDefault()
      const row = filtered[activeIdx]
      if (row) toggleRow(row)
    }
  }

  useEffect(() => {
    if (activeIdx >= 0) {
      const tr = gridRef.current?.querySelector<HTMLElement>(`[data-row-idx="${activeIdx}"]`)
      tr?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIdx])

  return (
    <div className="datagrid" style={height ? { height } : undefined}>
      {(toolbar || searchable || columns.length > 0) && (
        <div className="datagrid-toolbar">
          <div className="row gap-8 grow">{toolbar}</div>
          <div className="row gap-4">
            {searchable && (onSearchChange || searchText !== undefined) ? (
              <SearchInput value={searchText ?? ''} onChange={onSearchChange} width={220} placeholder="Buscar en la tabla…" />
            ) : null}
            <div className="cols-wrap">
              <IconButton icon="columns" label="Configurar columnas" onClick={() => setColsOpen((o) => !o)} active={colsOpen || visible !== null} />
              {colsOpen && (
                <div className="cols-pop">
                  {columns.map((c) => (
                    <Checkbox
                      key={c.key}
                      checked={!visible || visible.has(c.key)}
                      onChange={(v) => {
                        const next = new Set(visible ?? columns.map((x) => x.key))
                        if (v) next.add(c.key)
                        else next.delete(c.key)
                        setVisible(next.size === columns.length ? null : next)
                      }}
                      label={c.label}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="datagrid-scroll" ref={scrollRef}>
        <table className="datagrid-table" ref={gridRef} role="grid" aria-rowcount={filtered.length + 1} tabIndex={0} onKeyDown={onKeyDown}>
          <thead>
            <tr>
              {selectable && onSelect ? (
                <th className="dg-check" style={{ width: 34 }}>
                  <Checkbox checked={allSel} indeterminate={someSel && !allSel} onChange={toggleAll} />
                </th>
              ) : null}
              {shownCols.map((c) => (
                <th
                  key={c.key}
                  className={`dg-th ${c.align === 'right' ? 'right' : c.align === 'center' ? 'center' : ''} ${c.sticky ? `dg-sticky-${c.sticky}` : ''}`}
                  style={{ width: c.width, minWidth: c.minWidth, position: c.sticky ? 'sticky' : undefined, [c.sticky === 'left' ? 'left' : 'right']: c.sticky ? 0 : undefined }}
                  aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {c.sortable ? (
                    <button
                      className={`dg-sort ${sort?.key === c.key ? 'dg-sort-on' : ''}`}
                      onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' }))}
                    >
                      {c.label}
                      <Icon name={sort?.key === c.key ? (sort.dir === 'asc' ? 'arrowUp' : 'arrowDown') : 'chevronD'} size={11} className={sort?.key === c.key ? '' : 'muted'} />
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={shownCols.length + (selectable ? 1 : 0)} className="dg-empty">
                  {empty ?? <EmptyState icon="lupa" title="Sin resultados" detail="Ajuste los filtros o la búsqueda para ver datos." />}
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => {
                const k = rowKey(row)
                const tone = getRowTone?.(row)
                return (
                  <tr
                    key={k}
                    data-row-idx={i}
                    className={`dg-row ${selected.has(k) ? 'dg-row-sel' : ''} ${i === activeIdx ? 'dg-row-active' : ''} ${tone ? `dg-row-${tone}` : ''}`}
                    onClick={() => {
                      setActiveIdx(i)
                      onRowClick?.(row)
                    }}
                    onDoubleClick={() => onRowDoubleClick?.(row)}
                    aria-selected={selected.has(k)}
                  >
                    {selectable && onSelect ? (
                      <td className="dg-check" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(k)} onChange={() => toggleRow(row)} />
                      </td>
                    ) : null}
                    {shownCols.map((c) => {
                      const raw = (row as Record<string, unknown>)[c.key]
                      let content: ReactNode
                      if (c.render) content = c.render(row)
                      else if (c.money) content = <span className="money">{money(Number(raw ?? 0))}</span>
                      else content = String(raw ?? '')
                      return (
                        <td
                          key={c.key}
                          className={`dg-td ${c.align === 'right' ? 'right money' : c.align === 'center' ? 'center' : ''} ${c.sticky ? `dg-sticky-${c.sticky} dg-sticky-bg` : ''}`}
                          style={{ width: c.width, minWidth: c.minWidth, position: c.sticky ? 'sticky' : undefined, [c.sticky === 'left' ? 'left' : 'right']: c.sticky ? 0 : undefined }}
                        >
                          {content}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
          {totals && filtered.length > 0 ? (
            <tfoot>
              <tr className="dg-total">
                {selectable && onSelect ? <td /> : null}
                {shownCols.map((c, i) => {
                  const t = totals.find((x) => x.key === c.key)
                  if (t) return <td key={c.key} className={`dg-total-td ${t.align === 'right' || c.money ? 'right money' : ''}`}>{t.value}</td>
                  if (i === 0) return <td key={c.key} className="dg-total-td bold">{totals[0]?.label ?? ''}</td>
                  return <td key={c.key} />
                })}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <div className="datagrid-statusbar">
        <span className="muted xs">{busy ? 'Procesando…' : `${filtered.length.toLocaleString('es-CO')} de ${rows.length.toLocaleString('es-CO')} registros`}</span>
        {selected.size > 0 ? <span className="xs"><b>{selected.size}</b> seleccionados</span> : null}
        <span className="spacer" />
        <span className="muted xs"><kbd>↑↓</kbd> navegar · <kbd>Enter</kbd> abrir · <kbd>Espacio</kbd> seleccionar</span>
      </div>
    </div>
  )
}

/* ---------------- DebitCreditSummary ---------------- */

export function DebitCreditSummary({ debito, credito, compact = false }: {
  debito: number
  credito: number
  compact?: boolean
}) {
  const diff = Math.round((debito - credito) * 100) / 100
  const cuadra = Math.abs(diff) < 0.005
  return (
    <div className={`dcs ${compact ? 'dcs-compact' : ''}`} role="status">
      <div className="dcs-item">
        <span className="dcs-label">Débito</span>
        <span className="dcs-value money">{money(debito)}</span>
      </div>
      <div className="dcs-item">
        <span className="dcs-label">Crédito</span>
        <span className="dcs-value money">{money(credito)}</span>
      </div>
      <div className={`dcs-item dcs-diff ${cuadra ? 'dcs-ok' : 'dcs-bad'}`}>
        <span className="dcs-label">Diferencia</span>
        <span className="dcs-value money">{money(diff)}</span>
      </div>
      <div className={`dcs-state ${cuadra ? 'dcs-ok' : 'dcs-bad'}`}>
        <Icon name={cuadra ? 'check' : 'error'} size={13} />
        {cuadra ? 'Cuadrado' : 'Descuadrado'}
      </div>
    </div>
  )
}

/* ---------------- StatusBadge ---------------- */

const LOTE_TONES: Record<LoteEstado, 'neutral' | 'danger' | 'success' | 'warning' | 'info' | 'brand'> = {
  BORRADOR: 'neutral',
  CON_ERRORES: 'danger',
  VERIFICADO: 'info',
  PENDIENTE_APROBACION: 'warning',
  APROBADO: 'brand',
  CONTABILIZANDO: 'warning',
  CONTABILIZADO: 'success',
  FALLIDO: 'danger',
  ANULADO: 'neutral',
}

import { Badge } from '@/components/ui'

export function StatusBadge({ estado }: { estado: LoteEstado }) {
  const labels: Record<LoteEstado, string> = {
    BORRADOR: 'Borrador',
    CON_ERRORES: 'Con errores',
    VERIFICADO: 'Verificado',
    PENDIENTE_APROBACION: 'Pendiente aprobación',
    APROBADO: 'Aprobado',
    CONTABILIZANDO: 'Contabilizando',
    CONTABILIZADO: 'Contabilizado',
    FALLIDO: 'Fallido',
    ANULADO: 'Anulado',
  }
  const icons: Partial<Record<LoteEstado, string>> = {
    CON_ERRORES: 'error',
    VERIFICADO: 'check',
    PENDIENTE_APROBACION: 'clock',
    APROBADO: 'shield',
    CONTABILIZANDO: 'refresh',
    CONTABILIZADO: 'success',
    FALLIDO: 'error',
    ANULADO: 'x',
  }
  return <Badge tone={LOTE_TONES[estado]} icon={icons[estado]}>{labels[estado]}</Badge>
}

export function PeriodBadge({ status }: { status: 'ABIERTO' | 'CERRADO' }) {
  return status === 'ABIERTO'
    ? <Badge tone="success" icon="unlock">Abierto</Badge>
    : <Badge tone="neutral" icon="lock">Cerrado</Badge>
}

/* ---------------- AccountingEntryGrid ---------------- */

export interface EntryGridCol {
  key: keyof LineaMovimiento | string
  label: string
  width?: number
  kind?: 'cuenta' | 'nit' | 'centro' | 'comprobante' | 'doc' | 'fecha' | 'debito' | 'credito' | 'base' | 'clase' | 'texto' | 'retencion' | 'iva'
}

const ENTRY_COLS: EntryGridCol[] = [
  { key: 'cuenta', label: 'Cuenta', kind: 'cuenta', width: 150 },
  { key: 'nit', label: 'NIT', kind: 'nit', width: 110 },
  { key: 'centro', label: 'Centro', kind: 'centro', width: 100 },
  { key: 'comprobante', label: 'Comp.', kind: 'comprobante', width: 80 },
  { key: 'documento', label: 'Documento', kind: 'doc', width: 120 },
  { key: 'fecha', label: 'Fecha', kind: 'fecha', width: 100 },
  { key: 'debito', label: 'Débito', kind: 'debito', width: 120 },
  { key: 'credito', label: 'Crédito', kind: 'credito', width: 120 },
  { key: 'base', label: 'Base', kind: 'base', width: 110 },
  { key: 'clase', label: 'Clase', kind: 'clase', width: 80 },
  { key: 'docAfectado', label: 'Doc. afectado', kind: 'texto', width: 120 },
  { key: 'concepto', label: 'Concepto', kind: 'texto', width: 200 },
]

export function AccountingEntryGrid({
  lineas,
  onChange,
  issues = [],
  readOnly = false,
  height = 420,
  extraActions,
  revealIssue,
}: {
  lineas: LineaMovimiento[]
  onChange?: (lineas: LineaMovimiento[]) => void
  issues?: ValidationIssue[]
  readOnly?: boolean
  height?: number
  extraActions?: ReactNode
  /** Al recibir un issue, posiciona la celda en edición (Ir a la celda) */
  revealIssue?: ValidationIssue | null
}) {
  const [edit, setEdit] = useState<{ row: number; col: number } | null>(null)
  const [active, setActive] = useState(0)
  const tableRef = useRef<HTMLTableElement>(null)
  const revealed = useRef<string | null>(null)

  const campoCol: Record<string, number> = {
    cuenta: 0, nit: 1, centro: 2, documento: 4, fecha: 5, debito: 6, credito: 7, base: 8, concepto: 11,
  }

  useEffect(() => {
    if (!revealIssue || !revealIssue.lineaId || revealed.current === revealIssue.id) return
    revealed.current = revealIssue.id
    const row = lineas.findIndex((l) => l.id === revealIssue.lineaId)
    if (row >= 0) {
      setActive(row)
      if (!readOnly) {
        const col = campoCol[revealIssue.campo ?? 'cuenta'] ?? 0
        setEdit({ row, col })
      }
      window.setTimeout(() => {
        tableRef.current?.querySelector<HTMLElement>(`.eg-row:nth-child(${row + 1})`)?.scrollIntoView({ block: 'center' })
      }, 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealIssue, lineas, readOnly])

  const update = (row: number, patch: Partial<LineaMovimiento>) => {
    if (!onChange) return
    onChange(lineas.map((l, i) => (i === row ? { ...l, ...patch } : l)))
  }

  const issueFor = (row: number, campo?: string) => {
    const l = lineas[row]
    return issues.find((i) => i.lineaId === l?.id && (!campo || i.campo === campo))
  }

  const setEditAt = (row: number, col: number) => {
    if (readOnly) return
    setActive(row)
    setEdit({ row, col })
  }

  const commit = (dir: 'down' | 'right' | 'none') => {
    setEdit((e) => {
      if (!e) return null
      if (dir === 'down') return { row: Math.min(e.row + 1, lineas.length - 1), col: e.col }
      if (dir === 'right') return { row: e.row, col: Math.min(e.col + 1, ENTRY_COLS.length - 1) }
      return null
    })
  }

  const cellValue = (l: LineaMovimiento, col: EntryGridCol): string | number => {
    switch (col.kind) {
      case 'debito': return l.debito === 0 ? '' : money(l.debito)
      case 'credito': return l.credito === 0 ? '' : money(l.credito)
      case 'base': return l.base === 0 ? '' : money(l.base)
      default: return String(l[col.key as keyof LineaMovimiento] ?? '')
    }
  }

  const renderCell = (l: LineaMovimiento, row: number, colIdx: number, col: EntryGridCol) => {
    const isEdit = edit?.row === row && edit?.col === colIdx
    const issue = issueFor(row, col.kind === 'nit' ? 'nit' : col.kind === 'centro' ? 'centro' : undefined)
    const cellCls = `eg-cell ${issue ? 'eg-cell-issue' : ''} ${isEdit ? 'eg-cell-editing' : ''}`

    if (isEdit && !readOnly) {
      return (
        <td className={cellCls} style={{ width: col.width, minWidth: col.width }} onClick={(e) => e.stopPropagation()}>
          <CellEditor
            col={col}
            value={l}
            onCommit={(patch, dir) => {
              update(row, patch)
              commit(dir)
            }}
            onCancel={() => setEdit(null)}
          />
        </td>
      )
    }
    return (
      <td
        className={cellCls}
        style={{ width: col.width, minWidth: col.width, textAlign: col.kind === 'debito' || col.kind === 'credito' || col.kind === 'base' ? 'right' : 'left' }}
        title={issue ? issue.mensaje : undefined}
        onClick={() => setEditAt(row, colIdx)}
        tabIndex={readOnly ? -1 : 0}
      >
        <span className={col.kind === 'debito' || col.kind === 'credito' || col.kind === 'base' ? 'money tnum' : 'tnum'}>
          {cellValue(l, col)}
        </span>
      </td>
    )
  }

  const onGridKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, lineas.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && !edit) { e.preventDefault(); setEditAt(active, 0) }
    else if (e.key === 'F2' && !edit) { e.preventDefault(); setEditAt(active, 1) }
    else if (e.key === 'F3' && !readOnly && onChange) {
      e.preventDefault()
      onChange(lineas.filter((_, i) => i !== active))
    }
    else if (e.key === 'Tab' && edit) { e.preventDefault(); commit('right') }
    else if (e.key === 'Escape' && edit) setEdit(null)
  }

  return (
    <div className="entrygrid">
      <div className="entrygrid-toolbar">
        {extraActions}
        <span className="spacer" />
        <span className="muted xs">
          <kbd>Enter</kbd> editar · <kbd>F2</kbd> validar · <kbd>F3</kbd> eliminar línea · <kbd>Tab</kbd> siguiente celda
        </span>
      </div>
      <div className="entrygrid-scroll" style={{ height }}>
        <table className="entrygrid-table" tabIndex={0} onKeyDown={onGridKey} ref={tableRef}>
          <thead>
            <tr>
              <th className="eg-num">#</th>
              {ENTRY_COLS.map((c) => (
                <th key={String(c.key)} style={{ width: c.width, minWidth: c.width, textAlign: c.kind === 'debito' || c.kind === 'credito' || c.kind === 'base' ? 'right' : 'left' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => {
              const rowIssue = issues.find((x) => x.lineaId === l.id)
              return (
                <tr
                  key={l.id}
                  className={`eg-row ${i === active ? 'eg-row-active' : ''} ${rowIssue?.severidad === 'ERROR' ? 'eg-row-error' : rowIssue ? 'eg-row-warn' : ''}`}
                  onClick={() => setActive(i)}
                >
                  <td className="eg-num">
                    <span className="eg-idx">{i + 1}</span>
                    {rowIssue ? <Icon name={rowIssue.severidad === 'ERROR' ? 'error' : 'warn'} size={11} className={rowIssue.severidad === 'ERROR' ? 'neg' : 'eg-warn-icon'} title={rowIssue.mensaje} /> : null}
                  </td>
                  {ENTRY_COLS.map((c, ci) => renderCell(l, i, ci, c))}
                </tr>
              )
            })}
          </tbody>
        </table>
        {lineas.length === 0 ? <EmptyState icon="lote" title="Sin líneas" detail="Agregue líneas o importe desde Excel." /> : null}
      </div>
    </div>
  )
}

function CellEditor({ col, value, onCommit, onCancel }: {
  col: EntryGridCol
  value: LineaMovimiento
  onCommit: (patch: Partial<LineaMovimiento>, dir: 'down' | 'right' | 'none') => void
  onCancel: () => void
}) {
  const [text, setText] = useState(() => {
    if (col.kind === 'debito') return value.debito ? String(value.debito) : ''
    if (col.kind === 'credito') return value.credito ? String(value.credito) : ''
    if (col.kind === 'base') return value.base ? String(value.base) : ''
    return String(value[col.key as keyof LineaMovimiento] ?? '')
  })

  const commit = (dir: 'down' | 'right' | 'none') => {
    const patch: Partial<LineaMovimiento> = {}
    switch (col.kind) {
      case 'debito': patch.debito = Number(text.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0; break
      case 'credito': patch.credito = Number(text.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0; break
      case 'base': patch.base = Number(text.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0; break
      case 'clase': patch.clase = (text as LineaMovimiento['clase']) || ''; break
      default: (patch as Record<string, string>)[col.key as string] = text
    }
    onCommit(patch, dir)
  }

  /** Al elegir en un picker, se confirma de inmediato y avanza a la fila siguiente */
  const pickCommit = (prop: keyof LineaMovimiento, v: string) => {
    const patch = { [prop]: v } as Partial<LineaMovimiento>
    onCommit(patch, 'down')
  }

  return (
    <div className="eg-editor">
      {col.kind === 'cuenta' ? (
        <AccountPicker value={text} onChange={(v) => pickCommit('cuenta', v)} width={col.width ? col.width - 2 : undefined} />
      ) : col.kind === 'nit' ? (
        <ThirdPartyPicker value={text} onChange={(v) => pickCommit('nit', v)} width={col.width ? col.width - 2 : undefined} />
      ) : col.kind === 'centro' ? (
        <CostCenterPicker value={text} onChange={(v) => pickCommit('centro', v)} width={col.width ? col.width - 2 : undefined} />
      ) : col.kind === 'comprobante' ? (
        <VoucherPicker value={text} onChange={(v) => pickCommit('comprobante', v)} width={col.width ? col.width - 2 : undefined} />
      ) : col.kind === 'doc' ? (
        <DocumentTypePicker value={text} onChange={(v) => pickCommit('documento', v)} width={col.width ? col.width - 2 : undefined} />
      ) : col.kind === 'retencion' ? (
        <TaxRatePicker kind="retencion" value={text} onChange={(v) => setText(v)} width={col.width ? col.width - 2 : undefined} />
      ) : col.kind === 'iva' ? (
        <TaxRatePicker kind="iva" value={text} onChange={(v) => setText(v)} width={col.width ? col.width - 2 : undefined} />
      ) : col.kind === 'clase' ? (
        <select className="input" autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => {
          if (e.key === 'Enter') commit('down')
          if (e.key === 'Escape') onCancel()
        }}>
          <option value="">—</option>
          <option value="IVA">IVA</option>
          <option value="RETENCION">RETENCIÓN</option>
          <option value="OTRO">OTRO</option>
        </select>
      ) : (
        <input
          className="input mono"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit('down') }
            if (e.key === 'Tab') { e.preventDefault(); commit('right') }
            if (e.key === 'Escape') onCancel()
          }}
        />
      )}
      <div className="eg-editor-actions">
        <IconButton icon="check" label="Aceptar" size={20} onClick={() => commit('none')} />
        <IconButton icon="x" label="Cancelar" size={20} onClick={onCancel} />
      </div>
    </div>
  )
}

/* ---------------- Toolbar helpers para grilla ---------------- */

export function GridToolbar({ children }: { children: ReactNode }) {
  return <Toolbar>{children}</Toolbar>
}

export function GridButton({ children, ...rest }: React.ComponentProps<typeof Button>) {
  return <Button size="sm" {...rest}>{children}</Button>
}
