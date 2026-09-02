/* ============================================================
   CONTABDSI · Combobox + pickers contables
   ============================================================ */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/ui'
import { useStore } from '@/state/AppStore'
import type { Account } from '@/core/types'

export interface ComboItem {
  value: string
  label: string
  sub?: string
  disabled?: boolean
  hint?: string
}

export function Combobox({
  items,
  value,
  onChange,
  placeholder = 'Buscar…',
  width,
  disabled,
  readOnly,
  error,
  allowFree,
  emptyText = 'Sin resultados',
  onFocus,
  ariaLabel,
}: {
  items: ComboItem[]
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  width?: number | string
  disabled?: boolean
  readOnly?: boolean
  error?: boolean
  allowFree?: boolean
  emptyText?: string
  onFocus?: () => void
  ariaLabel?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = items.find((i) => i.value === value)

  const filtered = useMemo(() => {
    if (!query) return items
    const q = query.toLowerCase()
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.value.toLowerCase().includes(q) || (i.sub ?? '').toLowerCase().includes(q))
  }, [items, query])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => setHi(0), [query, open])

  const pick = (v: string) => {
    onChange?.(v)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className={`combo ${error ? 'combo-error' : ''}`} style={width ? { width } : undefined} ref={rootRef}>
      <input
        className="input combo-input mono"
        value={open ? query : (selected?.label ?? value ?? '')}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (allowFree) onChange?.(e.target.value)
        }}
        onFocus={() => {
          setOpen(true)
          setQuery('')
          onFocus?.()
        }}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        aria-label={ariaLabel ?? placeholder}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && open) {
            e.preventDefault()
            setHi((h) => Math.min(h + 1, filtered.length - 1))
          } else if (e.key === 'ArrowUp' && open) {
            e.preventDefault()
            setHi((h) => Math.max(h - 1, 0))
          } else if (e.key === 'Enter' && open && filtered[hi]) {
            e.preventDefault()
            pick(filtered[hi].value)
          } else if (e.key === 'Escape') {
            setOpen(false)
          } else if (e.key === 'Tab') {
            setOpen(false)
          }
        }}
      />
      <button
        type="button"
        className="combo-btn"
        tabIndex={-1}
        aria-label="Abrir lista"
        onClick={() => (open ? setOpen(false) : (setQuery(''), setOpen(true)))}
        disabled={disabled || readOnly}
      >
        <Icon name="chevronD" size={12} />
      </button>
      {open && (
        <div className="combo-pop" role="listbox">
          {filtered.length === 0 ? (
            <div className="combo-empty">{emptyText}</div>
          ) : (
            filtered.slice(0, 60).map((it, i) => (
              <button
                key={it.value}
                type="button"
                role="option"
                aria-selected={it.value === value}
                className={`combo-item ${i === hi ? 'combo-hi' : ''} ${it.value === value ? 'combo-sel' : ''}`}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(it.value)}
                disabled={it.disabled}
              >
                <span className="combo-main">
                  <span className="combo-value mono">{it.label}</span>
                  {it.sub ? <span className="combo-sub">{it.sub}</span> : null}
                </span>
                {it.value === value ? <Icon name="check" size={13} className="combo-check" /> : null}
                {it.hint ? <span className="combo-hint" title={it.hint}><Icon name="info" size={12} /></span> : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------- Pickers de dominio ---------------- */

export function AccountPicker({ value, onChange, width, disabled, error, placeholder = 'Cuenta', excludeCodes = [] }: {
  value?: string
  onChange?: (v: string) => void
  width?: number
  disabled?: boolean
  error?: boolean
  placeholder?: string
  excludeCodes?: string[]
}) {
  const { state } = useStore()
  const items = useMemo<ComboItem[]>(() => {
    const afectableFiltered = state.accounts.filter((a) => !excludeCodes.includes(a.code))
    return afectableFiltered.map((a: Account) => ({
      value: a.code,
      label: a.code,
      sub: a.nombre,
      hint: !a.afectable ? 'No afectable' : a.controlaTercero ? 'Controla tercero' : a.centroCosto ? 'Controla centro' : undefined,
      disabled: false,
    }))
  }, [state.accounts, excludeCodes])
  return <Combobox items={items} value={value} onChange={onChange} width={width} disabled={disabled} error={error} placeholder={placeholder} />
}

export function ThirdPartyPicker({ value, onChange, width, disabled, error }: {
  value?: string
  onChange?: (v: string) => void
  width?: number
  disabled?: boolean
  error?: boolean
}) {
  const { state } = useStore()
  const items = useMemo<ComboItem[]>(
    () => state.terceros.map((t) => ({ value: t.nit, label: t.nit, sub: t.nombre, disabled: t.estado === 'BLOQUEADO', hint: t.estado === 'BLOQUEADO' ? `Bloqueado: ${t.motivoBloqueo ?? ''}` : undefined })),
    [state.terceros],
  )
  return <Combobox items={items} value={value} onChange={onChange} width={width} disabled={disabled} error={error} placeholder="NIT" />
}

export function CostCenterPicker({ value, onChange, width, disabled, error }: {
  value?: string
  onChange?: (v: string) => void
  width?: number
  disabled?: boolean
  error?: boolean
}) {
  const { state } = useStore()
  const items = useMemo<ComboItem[]>(
    () => state.centros.map((c) => ({ value: c.code, label: c.code, sub: c.nombre })),
    [state.centros],
  )
  return <Combobox items={items} value={value} onChange={onChange} width={width} disabled={disabled} error={error} placeholder="Centro" />
}

export function VoucherPicker({ value, onChange, width, disabled }: {
  value?: string
  onChange?: (v: string) => void
  width?: number
  disabled?: boolean
}) {
  const { state } = useStore()
  const items = useMemo<ComboItem[]>(
    () => state.vouchers.filter((v) => v.activo).map((v) => ({ value: v.code, label: v.code, sub: v.nombre })),
    [state.vouchers],
  )
  return <Combobox items={items} value={value} onChange={onChange} width={width} disabled={disabled} placeholder="Comprobante" />
}

export function DocumentTypePicker({ value, onChange, width, disabled }: {
  value?: string
  onChange?: (v: string) => void
  width?: number
  disabled?: boolean
}) {
  const { state } = useStore()
  const items = useMemo<ComboItem[]>(
    () => state.tiposDocumento.map((t) => ({ value: t.code, label: t.code, sub: t.nombre })),
    [state.tiposDocumento],
  )
  return <Combobox items={items} value={value} onChange={onChange} width={width} disabled={disabled} placeholder="Tipo doc." />
}

export function TaxRatePicker({ value, onChange, width, disabled, kind = 'retencion' }: {
  value?: string
  onChange?: (v: string) => void
  width?: number
  disabled?: boolean
  kind?: 'retencion' | 'iva'
}) {
  const { state } = useStore()
  const items = useMemo<ComboItem[]>(() => {
    if (kind === 'iva') {
      return state.tarifasIVA.map((t) => ({ value: t.code, label: `${t.tarifa}%`, sub: t.nombre }))
    }
    return state.conceptosRetencion.map((c) => ({ value: c.code, label: `${c.tarifa}%`, sub: c.nombre }))
  }, [state, kind])
  return <Combobox items={items} value={value} onChange={onChange} width={width} disabled={disabled} placeholder={kind === 'iva' ? 'Tarifa IVA' : 'Retención'} />
}

export function TerceroLabel({ nit }: { nit?: string }) {
  const { state } = useStore()
  const t = state.terceros.find((x) => x.nit === nit)
  return <span>{t ? t.nombre : (nit ?? '—')}</span>
}

export function AccountLabel({ code }: { code?: string }) {
  const { state } = useStore()
  const a = state.accounts.find((x) => x.code === code)
  return <span>{a ? a.nombre : (code ?? '—')}</span>
}

export function CentroLabel({ code }: { code?: string }) {
  const { state } = useStore()
  const c = state.centros.find((x) => x.code === code)
  return <span>{c ? c.nombre : (code ?? '—')}</span>
}
