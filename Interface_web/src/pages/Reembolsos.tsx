import { useId, useRef, useState, useEffect, type ReactNode } from 'react';
import { CENTROS, CUENTAS, EMPRESA, TERCEROS, fmtCOP } from '../data/mock';
import type { Lote, LoteLinea } from '../types';
import type { NavPage } from '../components/Shell';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const SELECT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500 disabled:cursor-not-allowed disabled:opacity-50';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500 disabled:cursor-not-allowed disabled:opacity-50';

const STORAGE_KEY = `contabdsi:reembolsos:v1:${EMPRESA.codigo}`;
const CAJAS = ['CAJA-ADM — Caja menor Administración', 'CAJA-VEN — Caja menor Ventas', 'CAJA-OPE — Caja menor Operaciones'];

interface Props {
  onNavigate: (p: NavPage) => void;
  onCrearLote: (l: Lote) => void;
}

interface DetalleReembolso {
  id: string;
  concepto: string;
  cuenta: string;
  centro: string;
  debito: number;
  credito: number;
}

interface EncabezadoReembolso {
  tercero: string;
  periodo: string;
  fecha: string;
  comprobante: string;
  caja: string;
  documento: string;
}

interface ReembolsoGuardado {
  encabezado: EncabezadoReembolso;
  detalle: DetalleReembolso[];
}

function esDetalle(v: unknown): v is DetalleReembolso {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.concepto === 'string' && typeof o.cuenta === 'string' &&
    typeof o.centro === 'string' && typeof o.debito === 'number' && typeof o.credito === 'number';
}

function esGuardado(v: unknown): v is ReembolsoGuardado {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.encabezado === 'object' && o.encabezado !== null && Array.isArray(o.detalle) && o.detalle.every(esDetalle);
}

function inicial(): ReembolsoGuardado {
  return {
    encabezado: {
      tercero: '12.345.678',
      periodo: '2026-02',
      fecha: '2026-02-18',
      comprobante: 'CE',
      caja: CAJAS[0],
      documento: 'RB-2026-001',
    },
    detalle: [
      { id: 'R01', concepto: 'Transporte urbano personal', cuenta: '510506', centro: 'ADM', debito: 240000, credito: 0 },
      { id: 'R02', concepto: 'Papelería y útiles reembolso', cuenta: '510506', centro: 'OPE', debito: 150000, credito: 0 },
      { id: 'R03', concepto: 'Reembolso caja menor', cuenta: '110505', centro: '', debito: 0, credito: 390000 },
    ],
  };
}

function cargar(): ReembolsoGuardado {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (esGuardado(value)) return value;
    }
  } catch {
    // Dato dañado o almacenamiento deshabilitado: usar borrador inicial.
  }
  return inicial();
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-lg border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/40">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 id={titleId} className="text-sm font-semibold text-gray-800">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar diálogo" className="rounded px-2 text-xl text-gray-500 hover:bg-gray-100">×</button>
      </div>
      {children}
    </dialog>
  );
}

function parseMonto(texto: string): number {
  const n = Number(texto.replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export default function Reembolsos({ onNavigate, onCrearLote }: Props) {
  const [guardado, setGuardado] = useState<ReembolsoGuardado>(cargar);
  const [encabezado, setEncabezado] = useState<EncabezadoReembolso>(() => structuredClone(cargar().encabezado));
  const [detalle, setDetalle] = useState<DetalleReembolso[]>(() => structuredClone(cargar().detalle));
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [aviso, setAviso] = useState(false);
  const [loteCreado, setLoteCreado] = useState<Lote | null>(null);
  const dirty = JSON.stringify({ encabezado, detalle }) !== JSON.stringify(guardado);

  const cuentasAfectables = CUENTAS.filter(c => c.afectable);
  const totalDeb = detalle.reduce((s, d) => s + d.debito, 0);
  const totalCred = detalle.reduce((s, d) => s + d.credito, 0);
  const cuadrado = totalDeb === totalCred;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function actualizarEncabezado(field: keyof EncabezadoReembolso, value: string) {
    setEncabezado(prev => ({ ...prev, [field]: value }));
    setMensaje(null);
  }

  function actualizarDetalle(id: string, field: keyof DetalleReembolso, value: string | number) {
    setDetalle(prev => prev.map(d => {
      if (d.id !== id) return d;
      const siguiente = { ...d, [field]: value };
      if (field === 'cuenta') {
        const cuenta = CUENTAS.find(c => c.codigo === String(value));
        siguiente.centro = cuenta?.requiereCentro ? d.centro : d.centro;
      }
      if (field === 'debito' && Number(value) > 0) siguiente.credito = 0;
      if (field === 'credito' && Number(value) > 0) siguiente.debito = 0;
      return siguiente;
    }));
    setMensaje(null);
  }

  function agregarLinea() {
    setDetalle(prev => [...prev, {
      id: `R${String(prev.length + 1).padStart(2, '0')}`,
      concepto: '',
      cuenta: cuentasAfectables[0]?.codigo ?? '',
      centro: '',
      debito: 0,
      credito: 0,
    }]);
  }

  function eliminarLinea(id: string) {
    setDetalle(prev => prev.filter(d => d.id !== id));
  }

  function cancelar() {
    setEncabezado(structuredClone(guardado.encabezado));
    setDetalle(structuredClone(guardado.detalle));
    setMensaje(null);
  }

  function guardar() {
    const siguiente: ReembolsoGuardado = { encabezado, detalle };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(siguiente));
      setGuardado(structuredClone(siguiente));
      setMensaje({ tipo: 'success', texto: 'Reembolso guardado como borrador en este navegador.' });
    } catch {
      setMensaje({ tipo: 'error', texto: 'El navegador no permitió guardar. Habilite el almacenamiento e intente de nuevo.' });
    }
  }

  function crearLote() {
    if (!cuadrado) return;
    const tercero = TERCEROS.find(t => t.nit === encabezado.tercero);
    const lineas: LoteLinea[] = detalle.map((d, i) => {
      const cuenta = CUENTAS.find(c => c.codigo === d.cuenta);
      return {
        id: `L${String(i + 1).padStart(2, '0')}`,
        cuenta: d.cuenta,
        nombreCuenta: cuenta?.nombre ?? d.cuenta,
        nit: encabezado.tercero,
        tercero: tercero?.nombre ?? '',
        centro: d.centro,
        comprobante: `${encabezado.comprobante}-000247`,
        documento: encabezado.documento,
        fecha: encabezado.fecha,
        debito: d.debito,
        credito: d.credito,
        base: 0,
        clase: '',
        docAfectado: '',
        concepto: d.concepto,
        errores: [],
      };
    });
    const lote: Lote = {
      id: `lote-${Date.now()}`,
      codigo: 'REB1',
      nombre: 'Reembolso caja menor febrero 2026',
      periodo: encabezado.periodo,
      usuario: 'Laura Gómez',
      origen: 'Manual',
      fecha: encabezado.fecha,
      lineasCount: lineas.length,
      debito: totalDeb,
      credito: totalCred,
      diferencia: 0,
      erroresCount: 0,
      estado: 'Borrador',
      lineas,
    };
    onCrearLote(lote);
    setLoteCreado(lote);
    setAviso(true);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Movimientos / Reembolsos</div>
          <h1 className="text-lg font-semibold text-gray-800">Reembolsos</h1>
          <p className="mt-1 text-xs text-gray-500">Registro de reembolsos de caja menor con encabezado y detalle editable.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {mensaje && (
        <div className={`rounded-md border px-3 py-2 text-xs ${mensaje.tipo === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {mensaje.texto}
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); guardar(); }}>
        <fieldset className="rounded-md border border-gray-200 bg-white px-3 pb-3">
          <legend className="px-2 text-xs font-semibold text-petroleum-800">Encabezado del reembolso</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Tercero</label>
              <select value={encabezado.tercero} onChange={e => actualizarEncabezado('tercero', e.target.value)} className={SELECT}>
                {TERCEROS.map(t => <option key={t.nit} value={t.nit}>{t.nit} — {t.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Período</label>
              <select value={encabezado.periodo} onChange={e => actualizarEncabezado('periodo', e.target.value)} className={SELECT}>
                <option value="2026-02">2026-02 Febrero</option>
                <option value="2026-01">2026-01 Enero</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Fecha</label>
              <input type="date" value={encabezado.fecha} onChange={e => actualizarEncabezado('fecha', e.target.value)} className={`${INPUT} font-mono`} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Comprobante</label>
              <select value={encabezado.comprobante} onChange={e => actualizarEncabezado('comprobante', e.target.value)} className={SELECT}>
                <option value="CE">CE — Comprobante de Egreso</option>
                <option value="CI">CI — Comprobante de Ingreso</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Caja menor</label>
              <select value={encabezado.caja} onChange={e => actualizarEncabezado('caja', e.target.value)} className={SELECT}>
                {CAJAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Documento</label>
              <input value={encabezado.documento} onChange={e => actualizarEncabezado('documento', e.target.value)} className={`${INPUT} font-mono`} />
            </div>
          </div>
        </fieldset>

        <fieldset className="mt-3 rounded-md border border-gray-200 bg-white px-3 pb-3">
          <legend className="px-2 text-xs font-semibold text-petroleum-800">Detalle del reembolso</legend>
          <div className="table-fixed-header overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Concepto</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Cuenta</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Centro</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Débito</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Crédito</th>
                  <th className="px-3 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {detalle.map(d => (
                  <tr key={d.id} className="hoverable">
                    <td className="px-3 py-2">
                      <input value={d.concepto} onChange={e => actualizarDetalle(d.id, 'concepto', e.target.value)} placeholder="Concepto del gasto" className={INPUT} />
                    </td>
                    <td className="px-3 py-2">
                      <select value={d.cuenta} onChange={e => actualizarDetalle(d.id, 'cuenta', e.target.value)} className={SELECT}>
                        {cuentasAfectables.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select value={d.centro} onChange={e => actualizarDetalle(d.id, 'centro', e.target.value)} className={SELECT}>
                        <option value="">—</option>
                        {CENTROS.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        inputMode="numeric"
                        value={d.debito > 0 ? String(d.debito) : ''}
                        onChange={e => actualizarDetalle(d.id, 'debito', parseMonto(e.target.value))}
                        placeholder="0"
                        className={`${INPUT} text-right font-mono`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        inputMode="numeric"
                        value={d.credito > 0 ? String(d.credito) : ''}
                        onChange={e => actualizarDetalle(d.id, 'credito', parseMonto(e.target.value))}
                        placeholder="0"
                        className={`${INPUT} text-right font-mono`}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" onClick={() => eliminarLinea(d.id)} aria-label={`Eliminar línea ${d.id}`} className="text-gray-400 hover:text-red-600">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-700">TOTALES</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(totalDeb)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(totalCred)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" onClick={agregarLinea} className={BUTTON_SECONDARY}>+ Agregar línea</button>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cuadrado ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {cuadrado ? 'Cuadrado' : `Descuadrado ${fmtCOP(Math.abs(totalDeb - totalCred))}`}
            </span>
            {!cuadrado && <span className="text-xs text-red-600">Iguale débitos y créditos antes de crear el lote.</span>}
          </div>
        </fieldset>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-400">{dirty ? 'Cambios sin guardar' : 'Todo guardado'}</span>
          <div className="flex gap-2">
            <button type="button" onClick={cancelar} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="submit" className={BUTTON_SECONDARY}>Guardar</button>
            <button type="button" disabled={!cuadrado} onClick={crearLote} className={BUTTON_PRIMARY}>
              Crear lote
            </button>
          </div>
        </div>
      </form>

      {aviso && loteCreado && (
        <Modal title="Lote creado" onClose={() => setAviso(false)}>
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-gray-600">
              Se creó el lote <span className="font-mono font-semibold text-gray-800">{loteCreado.codigo}</span> — {loteCreado.nombre} con{' '}
              <span className="font-mono">{loteCreado.lineasCount}</span> líneas, cuadrado, en estado Borrador.
            </p>
            <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600">
              Débitos <span className="font-mono font-semibold text-gray-800">{fmtCOP(loteCreado.debito)}</span> · Créditos{' '}
              <span className="font-mono font-semibold text-gray-800">{fmtCOP(loteCreado.credito)}</span> · Diferencia{' '}
              <span className="font-mono font-semibold text-green-700">$ 0</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
            <button type="button" onClick={() => setAviso(false)} className={BUTTON_SECONDARY}>Cerrar</button>
            <button type="button" data-initial-focus onClick={() => onNavigate('movimientos/lotes')} className={BUTTON_PRIMARY}>
              Abrir lotes
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
