import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import Icon from '../Icon';
import { money } from '../../finance/selectors';

type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan';

const TONE_BADGE: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

const TONE_BAR: Record<Tone, string> = {
  gray: 'bg-gray-400',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  violet: 'bg-violet-500',
  cyan: 'bg-cyan-500',
};

export const INPUT =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 disabled:bg-gray-50 disabled:text-gray-500';

export function Badge({ tone = 'gray', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TONE_BADGE[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Money({ value, className = '' }: { value: number; className?: string }) {
  return <span className={`tabular ${className}`}>{money(value)}</span>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-[#0073C0] text-white hover:bg-[#005f9e] shadow-sm',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  ghost: 'text-petroleum-600 hover:bg-petroleum-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  const sizing = size === 'sm' ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-xs';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${sizing} ${BUTTON_VARIANT[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#00B0F2]" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-petroleum-600">{eyebrow}</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function KpiCard({
  label,
  value,
  detail,
  tone = 'gray',
}: {
  label: string;
  value: ReactNode;
  detail: string;
  tone?: Tone;
}) {
  const dot: Record<Tone, string> = {
    gray: 'bg-gray-300',
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    violet: 'bg-violet-500',
    cyan: 'bg-cyan-500',
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} />
        <span className="text-[11px] font-medium text-gray-500">{label}</span>
      </div>
      <div className="mt-1.5 text-lg font-semibold text-gray-900">{value}</div>
      <div className="mt-0.5 text-[11px] text-gray-500">{detail}</div>
    </div>
  );
}

export function SectionTitle({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        {detail && <p className="mt-0.5 text-[11px] text-gray-500">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

export function Progress({ value, tone = 'blue', label }: { value: number; tone?: Tone; label?: string }) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className="min-w-28">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${TONE_BAR[tone]}`} style={{ width: `${safe}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>{label}</span>
        <span className="tabular">{safe.toFixed(1)} %</span>
      </div>
    </div>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  width?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty = 'No hay registros para mostrar.',
  footer,
  dense = false,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: string;
  footer?: ReactNode;
  dense?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              {columns.map(column => (
                <th
                  key={column.header}
                  style={column.width ? { width: column.width } : undefined}
                  className={`whitespace-nowrap px-3 ${dense ? 'py-2' : 'py-2.5'} font-semibold text-gray-600 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">{empty}</td>
              </tr>
            )}
            {rows.map(row => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`${onRowClick ? 'cursor-pointer hover:bg-petroleum-50/50' : ''} transition-colors`}
              >
                {columns.map(column => (
                  <td
                    key={column.header}
                    className={`px-3 ${dense ? 'py-1.5' : 'py-2.5'} text-gray-700 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'} ${column.className ?? ''}`}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5">{footer}</div>}
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-2 border-b border-gray-100 px-4 py-3">{children}</div>;
}

export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-medium text-gray-600">{label}{hint && <span className="ml-1 font-normal text-gray-400">{hint}</span>}</span>
      {children}
    </label>
  );
}

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative min-w-48 flex-1">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
        <Icon name="search" className="h-3.5 w-3.5" />
      </span>
      <input {...props} className={`${INPUT} pl-8`} />
    </div>
  );
}

export function FilterSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="w-48 flex-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100" />;
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className={`max-h-[94vh] w-full ${wide ? 'max-w-6xl' : 'max-w-2xl'} overflow-hidden rounded-xl bg-white shadow-2xl`}>
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11px] text-gray-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Cerrar">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(94vh-4rem)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/30" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-gray-800">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11px] text-gray-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Cerrar">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-petroleum-50 text-petroleum-500">
        <Icon name="document" className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-gray-500">{detail}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string; badge?: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-200 px-4 pt-2">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`relative rounded-t-lg px-3 py-2 text-xs font-medium transition ${value === item.id ? 'bg-petroleum-50 text-petroleum-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
        >
          {item.label}
          {item.badge ? <span className="ml-1.5 rounded-full bg-petroleum-100 px-1.5 py-0.5 text-[9px] text-petroleum-700">{item.badge}</span> : null}
          {value === item.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-petroleum-500" />}
        </button>
      ))}
    </div>
  );
}

export function BarChart({
  data,
  height = 120,
  tone = 'blue',
  formatter,
}: {
  data: { label: string; value: number }[];
  height?: number;
  tone?: Tone;
  formatter?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map(item => Math.abs(item.value)));
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map(item => (
        <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${item.label}: ${formatter ? formatter(item.value) : money(item.value)}`}>
          <span className="text-[9px] text-gray-500">{formatter ? formatter(item.value) : `${Math.round(item.value / 1_000_000)} M`}</span>
          <div className={`w-full rounded-t ${TONE_BAR[tone]} opacity-80`} style={{ height: `${Math.max(2, (Math.abs(item.value) / max) * 78)}%` }} />
          <span className="truncate text-[9px] text-gray-400">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function StackedLegend({ items }: { items: { label: string; tone: Tone; value: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <span className={`h-2 w-2 rounded-sm ${TONE_BAR[item.tone]}`} />
          <span>{item.label}</span>
          <strong className="tabular text-gray-800">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
