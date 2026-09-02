/* ============================================================
   CONTABDSI · Widgets de dominio
   ValidationCenter, ProcessWizard, DangerConfirmation,
   AuditTimeline, CompanyPeriodSwitcher, ReportParameters,
   ReportPreview, ExportMenu, SavedView, MoneyInput
   ============================================================ */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Badge, Button, Card, Checkbox, Field, Icon, IconButton, Input, Modal, Segmented, Select, Textarea } from '@/components/ui'
import { useStore } from '@/state/AppStore'
import { fechaHora, money, nombreMes } from '@/core/format'
import type { AuditEvent, ReportColumn, ReportParam, ValidationIssue } from '@/core/types'
import './accounting.css'

/* ---------------- ValidationCenter ---------------- */

export function ValidationCenter({
  issues,
  title = 'Centro de validación',
  onGoToIssue,
  height = 260,
}: {
  issues: ValidationIssue[]
  title?: string
  onGoToIssue?: (issue: ValidationIssue) => void
  height?: number
}) {
  const [filter, setFilter] = useState<'TODOS' | 'ERROR' | 'ADVERTENCIA'>('TODOS')
  const errores = issues.filter((i) => i.severidad === 'ERROR')
  const avisos = issues.filter((i) => i.severidad === 'ADVERTENCIA')

  const list = filter === 'TODOS' ? issues : filter === 'ERROR' ? errores : avisos

  const exportXlsx = () => {
    const rows = [
      ['Severidad', 'Ámbito', 'Tipo', 'Mensaje', 'Línea'],
      ...list.map((i) => [i.severidad, i.ambito, i.tipo, i.mensaje, i.lineaId ?? '']),
    ]
    downloadCsv(rows, 'validaciones.csv')
  }

  return (
    <Card
      title={title}
      icon="shield"
      tone={errores.length > 0 ? 'danger' : avisos.length > 0 ? 'warning' : 'success'}
      pad={false}
      actions={
        <div className="row gap-8">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'TODOS', label: <span>Todos <b>{issues.length}</b></span> },
              { value: 'ERROR', label: <span className="neg">Errores <b>{errores.length}</b></span> },
              { value: 'ADVERTENCIA', label: <span className="vc-warn">Avisos <b>{avisos.length}</b></span> },
            ]}
          />
          <Button size="sm" icon="excel" onClick={exportXlsx} disabled={list.length === 0}>Exportar XLSX</Button>
        </div>
      }
    >
      <div className="vc" style={{ maxHeight: height }}>
        {issues.length === 0 ? (
          <div className="vc-empty">
            <Icon name="success" size={22} className="pos" />
            <span>Sin novedades: el lote pasa todas las validaciones.</span>
          </div>
        ) : list.length === 0 ? (
          <div className="vc-empty"><span className="muted">No hay elementos con este filtro.</span></div>
        ) : (
          <ul className="vc-list" role="list">
            {list.map((i) => (
              <li key={i.id} className={`vc-item vc-${i.severidad.toLowerCase()}`} role="listitem">
                <Icon name={i.severidad === 'ERROR' ? 'error' : 'warn'} size={15} className={i.severidad === 'ERROR' ? 'neg' : 'vc-warn'} />
                <div className="grow">
                  <div className="vc-item-top">
                    <Badge tone={i.severidad === 'ERROR' ? 'danger' : 'warning'}>{i.ambito}</Badge>
                    <span className="vc-type muted xs">{i.tipo.replaceAll('_', ' ')}</span>
                  </div>
                  <div className="vc-msg">{i.mensaje}</div>
                </div>
                {i.lineaId && onGoToIssue ? (
                  <Button size="sm" variant="subtle" icon="lupa" onClick={() => onGoToIssue(i)}>Ir a la celda</Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

/* ---------------- ProcessWizard ---------------- */

export interface WizardStep {
  key: string
  label: string
  icon?: string
  done?: boolean
  disabled?: boolean
  danger?: boolean
}

export function ProcessWizard({
  steps,
  active,
  onSelect,
  children,
}: {
  steps: WizardStep[]
  active: string
  onSelect?: (key: string) => void
  children?: ReactNode
}) {
  const idx = steps.findIndex((s) => s.key === active)
  return (
    <div className="wizard">
      <ol className="wizard-steps" role="tablist" aria-orientation="horizontal">
        {steps.map((s, i) => (
          <li key={s.key} className={`wizard-step ${i === idx ? 'wizard-current' : ''} ${s.done ? 'wizard-done' : ''} ${s.disabled ? 'wizard-disabled' : ''} ${s.danger ? 'wizard-danger' : ''}`}>
            <button type="button" role="tab" aria-selected={i === idx} disabled={s.disabled} onClick={() => onSelect?.(s.key)}>
              <span className="wizard-dot">
                {s.done ? <Icon name="check" size={12} /> : i + 1}
              </span>
              <span className="wizard-label">
                {s.icon ? <Icon name={s.icon} size={13} /> : null}
                {s.label}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="wizard-body">{children}</div>
    </div>
  )
}

/* ---------------- DangerConfirmation ---------------- */

export function DangerConfirmation({
  open,
  onClose,
  onConfirm,
  title,
  descripcion,
  tablasAfectadas,
  confirmText,
  simulacion = [],
  extraBody,
  confirmLabel = 'Ejecutar',
}: {
  open: boolean
  onClose: () => void
  onConfirm: (motivo: string) => void
  title: string
  descripcion?: string
  tablasAfectadas?: string[]
  confirmText: string
  simulacion?: { descripcion: string; valor: string | number }[]
  extraBody?: ReactNode
  confirmLabel?: string
}) {
  const { state } = useStore()
  const [motivo, setMotivo] = useState('')
  const [texto, setTexto] = useState('')
  const listo = motivo.trim().length >= 10 && texto.trim() === confirmText

  return (
    <Modal open={open} onClose={onClose} title={title} icon="warn" width={600} tone="danger"
      footer={
        <div className="row gap-8" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <span className="muted xs grow">Motivo obligatorio (mín. 10 caracteres) · texto exacto requerido</span>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="danger" disabled={!listo} icon="warn" onClick={() => onConfirm(motivo)}>{confirmLabel}</Button>
        </div>
      }
    >
      <div className="danger">
        <div className="danger-context">
          <dl className="danger-dl">
            <div><dt>Compañía</dt><dd>{state.session.company.codigo} — {state.session.company.nombre}</dd></div>
            <div><dt>NIT</dt><dd className="tnum">{state.session.company.nit}</dd></div>
            <div><dt>Año / Período</dt><dd className="tnum">{state.session.year} · {state.session.periodName} ({state.session.periodStatus})</dd></div>
          </dl>
        </div>
        {descripcion ? <p className="danger-desc">{descripcion}</p> : null}
        {tablasAfectadas ? (
          <div className="danger-tables">
            <span className="xs muted bold">TABLAS / REGISTROS AFECTADOS</span>
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              {tablasAfectadas.map((t) => <Badge key={t} tone="danger">{t}</Badge>)}
            </div>
          </div>
        ) : null}
        <div className="danger-meta">
          <div><span className="xs muted">Usuarios conectados</span><b className="tnum">3</b></div>
          <div><span className="xs muted">Estado del respaldo</span><Badge tone="success" icon="check">Actualizado</Badge></div>
          <div><span className="xs muted">Simulación</span>
            <Button size="sm" variant="subtle" icon="download" onClick={() => downloadCsv([['Descripción', 'Valor'], ...simulacion.map((s) => [s.descripcion, String(s.valor)])], 'simulacion.csv')}>Descargable</Button>
          </div>
        </div>
        {simulacion.length > 0 ? (
          <div className="danger-sim">
            {simulacion.map((s) => (
              <div key={s.descripcion} className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small">{s.descripcion}</span>
                <span className="small tnum bold">{typeof s.valor === 'number' ? money(s.valor) : s.valor}</span>
              </div>
            ))}
          </div>
        ) : null}
        {extraBody}
        <Field label="Motivo de la operación" required hint="Quedará registrado en la bitácora de auditoría.">
          <Textarea value={motivo} onChange={setMotivo} rows={2} placeholder="Explique por qué se ejecuta esta operación de riesgo…" />
        </Field>
        <Field label={`Escriba exactamente «${confirmText}» para confirmar`} required>
          <Input value={texto} onChange={setTexto} placeholder={confirmText} monospace ariaLabel="Texto de confirmación" />
        </Field>
      </div>
    </Modal>
  )
}

/* ---------------- AuditTimeline ---------------- */

export function AuditTimeline({ events, height = 240 }: { events: AuditEvent[]; height?: number }) {
  if (events.length === 0) {
    return <div className="vc-empty"><span className="muted">Sin eventos registrados aún.</span></div>
  }
  return (
    <ol className="timeline" style={{ maxHeight: height }}>
      {[...events].reverse().map((e) => (
        <li key={e.id} className="timeline-item">
          <span className={`timeline-dot timeline-${e.resultado.toLowerCase()}`}>
            <Icon name={e.resultado === 'EXITO' ? 'check' : e.resultado === 'FALLO' ? 'error' : 'info'} size={11} />
          </span>
          <div className="timeline-body">
            <div className="row gap-8">
              <b className="small">{e.accion}</b>
              <Badge tone={e.resultado === 'EXITO' ? 'success' : e.resultado === 'FALLO' ? 'danger' : 'info'}>{e.resultado}</Badge>
            </div>
            <div className="small muted">{e.detalle}</div>
            <div className="xs muted">{e.usuario} · {fechaHora(e.fecha)}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ---------------- CompanyPeriodSwitcher ---------------- */

export function CompanyPeriodSwitcher({ compact = false }: { compact?: boolean }) {
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const s = state.session

  return (
    <div className="cps">
      <button type="button" className="cps-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="cps-company">
          <Icon name="compania" size={15} />
          <span className={`cps-name ${compact ? 'cps-name-compact' : ''}`}>
            <b>{s.company.codigo}</b> {!compact && s.company.nombre}
          </span>
        </span>
        {!compact && (
          <span className="cps-period">
            <span className="tnum">{s.year} · {nombreMes(s.period).slice(0, 3).toUpperCase()}</span>
            <span className={`cps-status cps-${s.periodStatus.toLowerCase()}`}><span className="cps-dot" />{s.periodStatus === 'ABIERTO' ? 'Abierto' : 'Cerrado'}</span>
          </span>
        )}
        <Icon name="chevronD" size={12} className="muted" />
      </button>
      {open && (
        <div className="cps-pop">
          <div className="cps-pop-title xs muted bold">COMPAÑÍA Y PERÍODO</div>
          <div className="cps-pop-row row" style={{ justifyContent: 'space-between' }}>
            <span className="small">001 — Compañía Demo S.A.S.</span>
            <Badge tone="brand">Activa</Badge>
          </div>
          <div className="cps-pop-row row gap-8">
            <Select width={130} value={String(s.year)} options={[{ value: '2026', label: 'Año 2026' }, { value: '2025', label: 'Año 2025' }]} onChange={() => {}} />
            <Select width={150} value={String(s.period)} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${nombreMes(i + 1)} 2026` }))} onChange={() => {}} />
          </div>
          <div className="cps-pop-row row" style={{ justifyContent: 'space-between' }}>
            <span className="small">Estado del período</span>
            <Segmented
              value={state.periodStatus}
              onChange={(v) => dispatch({ type: 'SET_PERIOD_STATUS', status: v })}
              options={[{ value: 'ABIERTO', label: 'Abierto' }, { value: 'CERRADO', label: 'Cerrado' }]}
            />
          </div>
          <div className="cps-pop-note xs muted">El cambio de estado simula el contrato con el servidor (período cerrado = solo lectura).</div>
        </div>
      )}
    </div>
  )
}

/* ---------------- ReportParameters ---------------- */

export function ReportParameters({
  params,
  values,
  onChange,
  onGenerate,
}: {
  params: ReportParam[]
  values: Record<string, string | number | boolean>
  onChange: (values: Record<string, string | number | boolean>) => void
  onGenerate?: () => void
}) {
  const { state } = useStore()
  const set = (key: string, v: string | number | boolean) => onChange({ ...values, [key]: v })

  return (
    <div className="rparams row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
      {params.map((p) => (
        <Field key={p.key} label={p.label} width={p.tipo === 'texto' ? 200 : 150}>
          {p.tipo === 'checkbox' ? (
            <Checkbox checked={Boolean(values[p.key])} onChange={(v) => set(p.key, v)} label="Incluir" />
          ) : p.tipo === 'select' ? (
            <Select value={String(values[p.key] ?? '')} options={(p.options ?? []).map((o) => ({ value: o, label: o }))} onChange={(v) => set(p.key, v)} placeholder="Todos" />
          ) : p.tipo === 'periodo' ? (
            <Segmented
              value={String(values[p.key] ?? '02')}
              onChange={(v) => set(p.key, v)}
              options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: nombreMes(i + 1).slice(0, 3) }))}
            />
          ) : p.tipo === 'cuenta' ? (
            <Input value={String(values[p.key] ?? '')} onChange={(v) => set(p.key, v)} placeholder="Código cuenta" monospace />
          ) : p.tipo === 'tercero' ? (
            <Input value={String(values[p.key] ?? '')} onChange={(v) => set(p.key, v)} placeholder="NIT" monospace />
          ) : p.tipo === 'centro' ? (
            <Input value={String(values[p.key] ?? '')} onChange={(v) => set(p.key, v)} placeholder="Centro" monospace />
          ) : p.tipo === 'nivel' ? (
            <Select value={String(values[p.key] ?? '')} options={state.accounts.filter((a) => [1, 2, 4, 6, 9, 12].includes(a.nivel)).map((a) => ({ value: a.code, label: `${a.code} — ${a.nombre}` }))} onChange={(v) => set(p.key, v)} />
          ) : (
            <Input value={String(values[p.key] ?? '')} onChange={(v) => set(p.key, v)} />
          )}
        </Field>
      ))}
      <Button variant="primary" icon="play" onClick={onGenerate}>Generar</Button>
    </div>
  )
}

/* ---------------- ReportPreview ---------------- */

export function ReportPreview({
  titulo,
  columns,
  rows,
  pageSize = 30,
  company,
}: {
  titulo: string
  columns: ReportColumn[]
  rows: Record<string, string | number>[][]
  pageSize?: number
  company?: string
}) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const start = (page - 1) * pageSize
  const view = rows.slice(start, start + pageSize)

  return (
    <div className="preview">
      <div className="preview-sheet">
        <div className="preview-title">
          <div className="xs muted">{company ?? '001 — Compañía Demo S.A.S. · NIT 900.123.456-7'}</div>
          <h3>{titulo}</h3>
          <div className="xs muted">Año 2026 · Generado {new Date().toLocaleDateString('es-CO')} · Valores en COP</div>
        </div>
        <table className="preview-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ textAlign: c.align ?? 'left' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => {
                  const v = r.find((x) => x.key === c.key)?.value ?? ''
                  return (
                    <td key={c.key} className={c.money ? 'money' : ''} style={{ textAlign: c.align ?? 'left' }}>
                      {c.money ? money(Number(v) || 0) : String(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="preview-controls">
        <span className="xs muted">{rows.length.toLocaleString('es-CO')} filas · {totalPages} páginas</span>
        <span className="spacer" />
        <IconButton icon="chevronL" label="Página anterior" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
        <span className="xs tnum">Pág. {page} / {totalPages}</span>
        <IconButton icon="chevronR" label="Página siguiente" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} />
      </div>
    </div>
  )
}

/* ---------------- ExportMenu ---------------- */

export function ExportMenu({
  onExport,
  filename = 'informe',
  disabled,
}: {
  onExport?: (format: 'PDF' | 'XLSX' | 'CSV' | 'IMPRIMIR') => void
  filename?: string
  disabled?: boolean
}) {
  const { toast, audit } = useStore()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLDivElement>(null)

  const run = (format: 'PDF' | 'XLSX' | 'CSV' | 'IMPRIMIR') => {
    setOpen(false)
    if (format === 'IMPRIMIR') {
      window.print()
      return
    }
    toast('success', `Exportando ${format}`, `El archivo «${filename}.${format.toLowerCase()}» se generó correctamente (simulado).`)
    audit('Exportación de informe', 'Informes', `Formato ${format} · ${filename}`, 'EXITO')
    onExport?.(format)
  }

  return (
    <div className="cols-wrap" ref={btnRef}>
      <Button size="sm" icon="download" iconRight="chevronD" disabled={disabled} onClick={() => setOpen((o) => !o)}>Exportar</Button>
      {open && (
        <div className="cols-pop menu-pop" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 500 }}>
          <button className="menu-item" onClick={() => run('PDF')}><Icon name="pdf" size={14} /> PDF</button>
          <button className="menu-item" onClick={() => run('XLSX')}><Icon name="excel" size={14} /> XLSX</button>
          <button className="menu-item" onClick={() => run('CSV')}><Icon name="download" size={14} /> CSV</button>
          <button className="menu-item" onClick={() => run('IMPRIMIR')}><Icon name="print" size={14} /> Imprimir</button>
        </div>
      )}
    </div>
  )
}

/* ---------------- SavedView ---------------- */

export interface SavedViewDef {
  key: string
  nombre: string
}

export function SavedView({
  views,
  current,
  onLoad,
  onSave,
  onDelete,
}: {
  views: SavedViewDef[]
  current?: string
  onLoad: (key: string) => void
  onSave: (nombre: string) => void
  onDelete: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nombre, setNombre] = useState('')

  return (
    <div className="cols-wrap">
      <Button size="sm" variant="ghost" icon="star" onClick={() => setOpen((o) => !o)}>Vistas guardadas</Button>
      {open && (
        <div className="cols-pop menu-pop" style={{ position: 'absolute', left: 0, top: 'calc(100% + 4px)', width: 240 }}>
          {views.length === 0 ? (
            <div className="vc-empty"><span className="muted xs">Aún no hay vistas guardadas.</span></div>
          ) : (
            views.map((v) => (
              <div key={v.key} className="sv-row">
                <button className="menu-item grow" onClick={() => { onLoad(v.key); setOpen(false) }}>
                  <Icon name={v.key === current ? 'check' : 'star'} size={13} />
                  {v.nombre}
                </button>
                <IconButton icon="trash" label="Eliminar vista" size={22} danger onClick={() => onDelete(v.key)} />
              </div>
            ))
          )}
          {saving ? (
            <div className="sv-save row gap-4">
              <Input value={nombre} onChange={setNombre} placeholder="Nombre de la vista" autoFocus />
              <IconButton icon="check" label="Guardar" onClick={() => { if (nombre.trim()) { onSave(nombre.trim()); setNombre(''); setSaving(false); setOpen(false) } }} />
            </div>
          ) : (
            <button className="menu-item" onClick={() => setSaving(true)}><Icon name="plus" size={14} /> Guardar vista actual</button>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------- MoneyInput ---------------- */

export function MoneyInput({ value, onChange, width = 120, disabled, placeholder = '0', ariaLabel }: {
  value?: number
  onChange?: (v: number) => void
  width?: number
  disabled?: boolean
  placeholder?: string
  ariaLabel?: string
}) {
  const [text, setText] = useState(value ? money(value) : '')
  return (
    <input
      className="input money-input mono"
      style={{ width, textAlign: 'right' }}
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      onFocus={(e) => { e.target.select(); if (value) setText(String(value)) }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = parseMoney(text)
        onChange?.(n)
        setText(n ? money(n) : '')
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

export function parseMoney(s: string): number {
  if (!s) return 0
  const clean = s.replace(/[^\d.,-]/g, '')
  const neg = clean.startsWith('-')
  const digits = clean.replace(/[^\d]/g, '')
  const dec = clean.includes(',') ? clean.split(',').pop()?.replace(/\D/g, '') : clean.includes('.') ? clean.split('.').pop()?.replace(/\D/g, '') : ''
  const intPart = digits.slice(0, dec && dec.length ? -dec.length : undefined)
  const n = Number(`${intPart || 0}.${dec || 0}`)
  return neg ? -n : n
}

export function downloadCsv(rows: (string | number)[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/* ---------------- InfoStrip (datos de contexto de proceso) ---------------- */

export function InfoStrip({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="infostrip">
      {items.map((i) => (
        <div key={i.label} className="infostrip-item">
          <span className="xs muted">{i.label}</span>
          <span className="small bold">{i.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Actualiza el título del documento por página */
export function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title
    document.title = `${title} · CONTABDSI`
    return () => {
      document.title = prev
    }
  }, [title])
}
