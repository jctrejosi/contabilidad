/* ============================================================
   CONTABDSI · UI kit
   ============================================================ */

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './ui.css'

/* ---------------- Iconos ---------------- */

const ICON_PATHS: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-10.5Z" />,
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  libro: <path d="M4 5a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5Zm2 14h12V5H8v11" />,
  entrada: <path d="M5 4h3v2H7v12h1v2H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm8 4 5 4-5 4v-3H8V9h5V8Z" />,
  salida: <path d="M19 4h-3v2h1v12h-1v2h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1Zm-8 4-5 4 5 4v-3h5V9h-5V8Z" />,
  lote: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 10h16M10 4v16" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  anular: <path d="M7 7h10l1 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L7 7Zm3 4v6m4-6v6M9 4V3h6v1h4v2H5V4h4Z" />,
  importar: <path d="M12 3v10m0 0 4-4m-4 4-4-4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />,
  nomina: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>,
  reembolso: <path d="M9 4h6l3 3v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1Zm0 0V3h6v1M3 13h3l2 2 3-3 2 2h3" />,
  lupa: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  doc: <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 0v5h5" />,
  calendario: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4m8-4v4" /></>,
  informe: <><path d="M5 20V9m5 11V4m5 16v-7m4 7H3" /><path d="M4 4h16" /></>,
  retencion: <path d="M12 3v18M7 7h8a2 2 0 0 1 0 4H8a2 2 0 0 0 0 4h9" />,
  iva: <path d="M4 20 12 4l8 16h-4l-4-8-4 8H4Z" />,
  medio: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /><path d="M12 4v2m0 12v2M4 12h2m12 0h2" /></>,
  reproceso: <path d="M20 12a8 8 0 1 1-2.3-5.6M20 3v4h-4" />,
  cierre: <path d="M7 3h10a1 1 0 0 1 1 1v16l-6-3-6 3V4a1 1 0 0 1 1-1Z" />,
  consolidar: <><path d="M8 8h12v12H8V8Z" /><path d="M4 16 16 4" /></>,
  parametros: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1m0-14.2-2.1 2.1M7 17l-2.1 2.1" /></>,
  plan: <path d="M4 4h16v3H4V4Zm0 6.5h16v3H4v-3ZM4 17h16v3H4v-3Z" />,
  terceros: <><circle cx="9" cy="8" r="4" /><path d="M2 21c0-4 3.1-6 7-6s7 2 7 6" /><path d="M17 8a3.5 3.5 0 0 1 0 6.7M20 21c0-3.5-2-5.5-4-6" /></>,
  comprobante: <path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 4h8m-8 4h8m-8 4h5" />,
  centro: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  renta: <path d="M4 20V10m5 10V6m6 14v-8m5 8V4M2 20h20" />,
  plantilla: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6m-6 4h6m-6 4h4" /></>,
  compania: <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" />,
  formato: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /></>,
  especial: <path d="M12 2l2.4 5.4L20 9l-5.6 1.6L12 16l-2.4-5.4L4 9l5.6-1.6L12 2Z" />,
  reclasificar: <path d="M4 7h9m-4-4 4 4-4 4M20 17h-9m4-4-4 4 4 4" />,
  usuarios: <><circle cx="9" cy="8" r="4" /><path d="M2 21c0-4 3.1-6 7-6s7 2 7 6" /><path d="M17 4a4 4 0 0 1 0 8m2 9c0-3.5-1.6-5.6-4.4-6" /></>,
  bitacora: <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm2 4h6m-6 4h10m-10 4h8" />,
  integracion: <><path d="M9 6h6v2l4-3-4-3v2H8a1 1 0 0 0-1 1v4h2V6Zm6 12H9v-2l-4 3 4 3v-2h7a1 1 0 0 0 1-1v-4h-2v4Z" /></>,
  reorganizar: <path d="M4 6h16M4 12h16M4 18h16M9 3v6m6 6v6" />,
  presupuesto: <path d="M12 3v18m4-14 2 1v3l-2 1m-8-5-2 1v3l2 1M4 21h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17l-1 3Z" />,
  trash: <path d="M6 7h12l-1 14H7L6 7Zm3 0V4h6v3M4 7h16" />,
  check: <path d="m5 13 4 4L19 7" />,
  chevronD: <path d="m6 9 6 6 6-6" />,
  chevronR: <path d="m9 6 6 6-6 6" />,
  chevronL: <path d="m15 6-6 6 6 6" />,
  filter: <path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" />,
  download: <path d="M12 4v11m0 0 4-4m-4 4-4-4M4 19h16" />,
  upload: <path d="M12 15V4m0 0 4 4m-4-4L8 8M4 19h16" />,
  print: <><path d="M7 8V3h10v5" /><rect x="3" y="8" width="18" height="9" rx="2" /><path d="M7 14h10v7H7v-7Z" /></>,
  columns: <path d="M4 4h16v16H4V4Zm10 0v16" />,
  kebab: <><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  unlock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 7.7-1.3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>,
  bell: <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Zm4 9a2 2 0 0 0 4 0" />,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
  refresh: <path d="M20 12a8 8 0 1 1-2.3-5.6M20 3v4h-4" />,
  save: <path d="M5 3h11l3 3v15H5V3Zm4 0v5h7V3" />,
  file: <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 0v5h5" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  warn: <path d="M12 3 2 20h20L12 3Zm0 7v5m0 3v.01" />,
  error: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 4v.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.01" /></>,
  success: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5.5-6" /></>,
  arrowUp: <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
  arrowDown: <path d="M12 5v14m0 0 6-6m-6 6-6-6" />,
  excel: <path d="M7 3h7l4 4v14H7V3Zm7 0v5h5M10 13l4 4m0-4-4 4" />,
  pdf: <path d="M7 3h7l4 4v14H7V3Zm7 0v5h5M10 13h2m-2 2h3" />,
  play: <path d="M7 5l12 7-12 7V5Z" />,
  pause: <path d="M8 5h3v14H8V5Zm5 0h3v14h-3V5Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  shield: <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />,
  db: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  star: <path d="m12 3 2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.9 6.4 20l1.3-6.2L3 9.5l6.3-.7L12 3Z" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  git: <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><circle cx="6" cy="18" r="2" /><path d="M6 8v8M18 9a9 9 0 0 0-9-3" /></>,
  trendUp: <path d="M3 17 9 11l4 4 8-8m0 0h-5m5 0v5" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7L12.5 17" />,
  sliders: <path d="M4 7h9m5 0h2M4 17h2m5 0h9M13 5v4M9 15v4m6-12v4M6 15v4" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8m-3 3 2 2m-5 1 2 2" /></>,
  chip: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4" /></>,
}

export function Icon({ name, size = 16, className = '', title }: { name: keyof typeof ICON_PATHS | string; size?: number; className?: string; title?: string }) {
  const content = ICON_PATHS[name] ?? ICON_PATHS.info
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {content}
    </svg>
  )
}

/* ---------------- Botón ---------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'subtle'

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  disabled,
  loading,
  onClick,
  type = 'button',
  title,
  className = '',
  danger,
}: {
  children?: ReactNode
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  icon?: string
  iconRight?: string
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  title?: string
  className?: string
  danger?: boolean
}) {
  const v = danger ? 'danger' : variant
  return (
    <button
      type={type}
      className={`btn btn-${v} btn-${size} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
    >
      {loading ? <Spinner size={14} /> : icon ? <Icon name={icon} size={14} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={14} /> : null}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  danger,
  active,
  size = 26,
  className = '',
}: {
  icon: string
  label: string
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  active?: boolean
  size?: number
  className?: string
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${danger ? 'icon-btn-danger' : ''} ${active ? 'icon-btn-active' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
    >
      <Icon name={icon} size={Math.max(14, size - 10)} />
    </button>
  )
}

/* ---------------- Badge ---------------- */

export function Badge({
  children,
  tone = 'neutral',
  icon,
  title,
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'outline'
  icon?: string
  title?: string
}) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {icon ? <Icon name={icon} size={11} /> : null}
      {children}
    </span>
  )
}

/* ---------------- Card ---------------- */

export function Card({
  children,
  title,
  icon,
  actions,
  footer,
  className = '',
  pad = true,
  tone,
}: {
  children?: ReactNode
  title?: ReactNode
  icon?: string
  actions?: ReactNode
  footer?: ReactNode
  className?: string
  pad?: boolean
  tone?: 'danger' | 'warning' | 'success' | 'info'
}) {
  return (
    <section className={`card ${tone ? `card-tone-${tone}` : ''} ${className}`}>
      {(title || actions) && (
        <header className="card-header">
          <h3 className="card-title">
            {icon ? <Icon name={icon} size={16} className="card-title-icon" /> : null}
            {title}
          </h3>
          {actions ? <div className="card-actions row gap-8">{actions}</div> : null}
        </header>
      )}
      <div className={pad ? 'card-body' : 'card-body card-body-flush'}>{children}</div>
      {footer ? <footer className="card-footer">{footer}</footer> : null}
    </section>
  )
}

/* ---------------- Formularios ---------------- */

export function Field({
  label,
  required,
  error,
  hint,
  children,
  className = '',
  width,
}: {
  label?: ReactNode
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
  className?: string
  width?: number | string
}) {
  return (
    <div className={`field ${error ? 'field-error' : ''} ${className}`} style={width ? { width } : undefined}>
      {label ? (
        <label className="field-label">
          {label}
          {required ? <span className="req">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <div className="field-error-msg" role="alert"><Icon name="error" size={12} /> {error}</div> : null}
      {hint && !error ? <div className="field-hint">{hint}</div> : null}
    </div>
  )
}

export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  disabled,
  readOnly,
  width,
  monospace,
  onKeyDown,
  onFocus,
  onBlur,
  autoFocus,
  list,
  ariaLabel,
  className = '',
}: {
  value?: string | number
  onChange?: (v: string) => void
  placeholder?: string
  type?: string
  error?: boolean
  disabled?: boolean
  readOnly?: boolean
  width?: number | string
  monospace?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
  onBlur?: () => void
  autoFocus?: boolean
  list?: string
  ariaLabel?: string
  className?: string
}) {
  return (
    <input
      className={`input ${error ? 'input-error' : ''} ${monospace ? 'mono' : ''} ${className}`}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      type={type}
      disabled={disabled}
      readOnly={readOnly}
      style={width ? { width } : undefined}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      autoFocus={autoFocus}
      list={list}
      aria-label={ariaLabel ?? placeholder}
    />
  )
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  disabled,
  width,
  ariaLabel,
}: {
  value?: string
  onChange?: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
  width?: number | string
  ariaLabel?: string
}) {
  return (
    <select
      className="input select"
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      style={width ? { width } : undefined}
      aria-label={ariaLabel ?? placeholder}
    >
      <option value="" disabled>{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function Textarea({ value, onChange, placeholder, rows = 3, disabled, width }: {
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  width?: number | string
}) {
  return (
    <textarea
      className="input textarea"
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      style={width ? { width } : undefined}
    />
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  indeterminate,
}: {
  checked?: boolean
  onChange?: (v: boolean) => void
  label?: ReactNode
  disabled?: boolean
  indeterminate?: boolean
}) {
  return (
    <label className={`checkbox ${disabled ? 'checkbox-disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked ?? false}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate ?? false
        }}
      />
      <span className="checkbox-box"><Icon name="check" size={11} /></span>
      {label ? <span className="checkbox-label">{label}</span> : null}
    </label>
  )
}

export function Switch({ checked, onChange, label, disabled }: {
  checked?: boolean
  onChange?: (v: boolean) => void
  label?: ReactNode
  disabled?: boolean
}) {
  return (
    <label className={`switch ${disabled ? 'switch-disabled' : ''}`}>
      <input type="checkbox" checked={checked ?? false} onChange={(e) => onChange?.(e.target.checked)} disabled={disabled} />
      <span className="switch-track"><span className="switch-thumb" /></span>
      {label ? <span className="switch-label">{label}</span> : null}
    </label>
  )
}

export function Segmented<T extends string, O extends readonly { value: T; label: ReactNode }[] = readonly { value: T; label: ReactNode }[]>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T
  onChange?: (v: O[number]['value']) => void
  options: O
  disabled?: boolean
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`segmented-item ${value === o.value ? 'segmented-active' : ''}`}
          onClick={() => onChange?.(o.value)}
          disabled={disabled}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Tabs ---------------- */

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: ReactNode; icon?: string; badge?: number }[]
  active: string
  onChange?: (key: string) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          className={`tab ${active === t.key ? 'tab-active' : ''}`}
          onClick={() => onChange?.(t.key)}
        >
          {t.icon ? <Icon name={t.icon} size={14} /> : null}
          {t.label}
          {t.badge !== undefined && t.badge > 0 ? <span className="tab-badge">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Toolbar ---------------- */

export function Toolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`toolbar ${className}`}>{children}</div>
}

export function ToolbarGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="toolbar-group" role="group" aria-label={label}>
      {children}
    </div>
  )
}

/* ---------------- Buscador ---------------- */

export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar…',
  width = 240,
  autoFocus,
  onKeyDown,
}: {
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  width?: number
  autoFocus?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="search" style={{ width }}>
      <Icon name="lupa" size={14} className="search-icon" />
      <input
        className="search-input"
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
      />
      {value ? (
        <button className="search-clear" onClick={() => onChange?.('')} aria-label="Limpiar búsqueda">
          <Icon name="x" size={12} />
        </button>
      ) : null}
    </div>
  )
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  onClose,
  title,
  icon,
  children,
  footer,
  width = 560,
  tone,
}: {
  open: boolean
  onClose?: () => void
  title?: ReactNode
  icon?: string
  children?: ReactNode
  footer?: ReactNode
  width?: number
  tone?: 'danger' | 'warning' | 'success' | 'info'
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => {
      ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus()
    }, 30)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div
        className={`modal ${tone ? `modal-tone-${tone}` : ''}`}
        style={{ width: `min(${width}px, calc(100vw - 48px))` }}
        role="dialog"
        aria-modal="true"
        ref={ref}
      >
        {title !== undefined && (
          <header className="modal-header">
            <h2 className="modal-title">
              {icon ? <Icon name={icon} size={18} /> : null}
              {title}
            </h2>
            {onClose ? (
              <IconButton icon="x" label="Cerrar" onClick={onClose} />
            ) : null}
          </header>
        )}
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: ReactNode
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  children?: ReactNode
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} icon={danger ? 'warn' : 'info'} width={480} tone={danger ? 'danger' : undefined}
      footer={
        <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      }
    >
      {message ? <p className="modal-message">{message}</p> : null}
      {children}
    </Modal>
  )
}

/* ---------------- Estados ---------------- */

export function Spinner({ size = 18, className = '' }: { size?: number; className?: string }) {
  return <span className={`spinner ${className}`} style={{ width: size, height: size }} aria-label="Cargando" role="status" />
}

export function EmptyState({
  icon = 'file',
  title = 'No hay datos',
  detail,
  action,
}: {
  icon?: string
  title?: string
  detail?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="state">
      <div className="state-icon"><Icon name={icon} size={26} /></div>
      <h4 className="state-title">{title}</h4>
      {detail ? <p className="state-detail">{detail}</p> : null}
      {action ? <div className="state-action">{action}</div> : null}
    </div>
  )
}

export function LoadingState({ label = 'Cargando datos…' }: { label?: string }) {
  return (
    <div className="state">
      <Spinner size={26} />
      <p className="state-detail">{label}</p>
    </div>
  )
}

export function ErrorState({ title = 'Ocurrió un error', detail, onRetry }: {
  title?: string
  detail?: ReactNode
  onRetry?: () => void
}) {
  return (
    <div className="state state-error">
      <div className="state-icon"><Icon name="error" size={26} /></div>
      <h4 className="state-title">{title}</h4>
      {detail ? <p className="state-detail">{detail}</p> : null}
      {onRetry ? (
        <div className="state-action"><Button icon="refresh" onClick={onRetry}>Reintentar</Button></div>
      ) : null}
    </div>
  )
}

export function NoPermissionState({ perm }: { perm?: string }) {
  return (
    <div className="state state-lock">
      <div className="state-icon"><Icon name="lock" size={26} /></div>
      <h4 className="state-title">Sin permiso para esta acción</h4>
      <p className="state-detail">
        Su rol no tiene el permiso requerido{perm ? <code> {perm}</code> : ''}. Solicite acceso a un Administrador.
      </p>
    </div>
  )
}

export function SuccessState({ title = 'Operación exitosa', detail }: { title?: string; detail?: ReactNode }) {
  return (
    <div className="state state-success">
      <div className="state-icon"><Icon name="success" size={26} /></div>
      <h4 className="state-title">{title}</h4>
      {detail ? <p className="state-detail">{detail}</p> : null}
    </div>
  )
}

/* ---------------- Varios ---------------- */

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>
}

export function ProgressBar({ pct, tone = 'brand', label }: { pct: number; tone?: 'brand' | 'success' | 'warning' | 'danger'; label?: string }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`progress-fill progress-${tone}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  )
}

export function Divider({ label }: { label?: string }) {
  return (
    <div className="divider">
      {label ? <span className="divider-label">{label}</span> : null}
    </div>
  )
}

export function Menu({
  open,
  onClose,
  items,
  align = 'right',
}: {
  open: boolean
  onClose: () => void
  items: { label: ReactNode; icon?: string; onClick?: () => void; danger?: boolean; disabled?: boolean; separator?: boolean }[]
  align?: 'left' | 'right'
}) {
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.menu-pop')) onClose()
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className={`menu-pop menu-${align}`} role="menu">
      {items.map((it, i) =>
        it.separator ? (
          <div key={i} className="menu-sep" />
        ) : (
          <button
            key={i}
            role="menuitem"
            className={`menu-item ${it.danger ? 'menu-item-danger' : ''}`}
            disabled={it.disabled}
            onClick={() => { it.onClick?.(); onClose() }}
          >
            {it.icon ? <Icon name={it.icon} size={14} /> : null}
            {it.label}
          </button>
        ),
      )}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  badge,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: string
  actions?: ReactNode
  badge?: ReactNode
}) {
  return (
    <header className="page-header">
      <div className="page-header-title">
        {icon ? <span className="page-header-icon"><Icon name={icon} size={18} /></span> : null}
        <div>
          <h1>{title}</h1>
          {subtitle ? <p className="page-header-sub">{subtitle}</p> : null}
        </div>
        {badge}
      </div>
      {actions ? <div className="page-header-actions row gap-8">{actions}</div> : null}
    </header>
  )
}
