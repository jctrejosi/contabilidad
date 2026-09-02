import { useId, useRef, useState, useEffect, type ReactNode } from 'react';
import { CENTROS, COMPROBANTES, TERCEROS, fmtCOP } from '../data/mock';
import type { Lote, LoteLinea } from '../types';
import type { NavPage } from '../components/Shell';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const SELECT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

type Tab = 'nomina' | 'aportes' | 'provisiones';

interface Props {
  onNavigate: (p: NavPage) => void;
  onCrearLote: (l: Lote) => void;
}

interface FilaNomina {
  id: string;
  cuenta: string;
  nombreCuenta: string;
  nit: string;
  tercero: string;
  centro: string;
  debito: number;
  credito: number;
  concepto: string;
}

const FILAS: Record<Tab, FilaNomina[]> = {
  nomina: [
    { id: 'N01', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '12.345.678', tercero: 'García Moreno Juan Pablo', centro: 'ADM', debito: 4500000, credito: 0, concepto: 'Sueldo febrero Administración' },
    { id: 'N02', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '23.456.789', tercero: 'López Vargas María Fernanda', centro: 'VEN', debito: 3200000, credito: 0, concepto: 'Sueldo febrero Ventas' },
    { id: 'N03', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '34.567.890', tercero: 'Martínez Rojas Ana Lucía', centro: 'OPE', debito: 2300000, credito: 0, concepto: 'Sueldo febrero Operaciones' },
    { id: 'N04', cuenta: '250505', nombreCuenta: 'Salarios por pagar', nit: '12.345.678', tercero: 'García Moreno Juan Pablo', centro: 'ADM', debito: 0, credito: 4500000, concepto: 'Obligación nómina feb ADM' },
    { id: 'N05', cuenta: '250505', nombreCuenta: 'Salarios por pagar', nit: '23.456.789', tercero: 'López Vargas María Fernanda', centro: 'VEN', debito: 0, credito: 3200000, concepto: 'Obligación nómina feb VEN' },
    { id: 'N06', cuenta: '250505', nombreCuenta: 'Salarios por pagar', nit: '34.567.890', tercero: 'Martínez Rojas Ana Lucía', centro: 'OPE', debito: 0, credito: 2300000, concepto: 'Obligación nómina feb OPE' },
  ],
  aportes: [
    { id: 'A01', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '12.345.678', tercero: 'García Moreno Juan Pablo', centro: 'ADM', debito: 1400000, credito: 0, concepto: 'Aportes patronales feb ADM' },
    { id: 'A02', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '23.456.789', tercero: 'López Vargas María Fernanda', centro: 'VEN', debito: 800000, credito: 0, concepto: 'Aportes patronales feb VEN' },
    { id: 'A03', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '34.567.890', tercero: 'Martínez Rojas Ana Lucía', centro: 'OPE', debito: 400000, credito: 0, concepto: 'Aportes patronales feb OPE' },
    { id: 'A04', cuenta: '236540', nombreCuenta: 'Retenciones y aportes de nómina', nit: '', tercero: '', centro: '', debito: 0, credito: 2600000, concepto: 'Aportes por pagar febrero' },
  ],
  provisiones: [
    { id: 'P01', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '12.345.678', tercero: 'García Moreno Juan Pablo', centro: 'ADM', debito: 800000, credito: 0, concepto: 'Prestaciones feb ADM' },
    { id: 'P02', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '34.567.890', tercero: 'Martínez Rojas Ana Lucía', centro: 'OPE', debito: 600000, credito: 0, concepto: 'Prestaciones feb OPE' },
    { id: 'P03', cuenta: '250505', nombreCuenta: 'Salarios por pagar', nit: '12.345.678', tercero: 'García Moreno Juan Pablo', centro: 'ADM', debito: 0, credito: 800000, concepto: 'Prestaciones por pagar feb ADM' },
    { id: 'P04', cuenta: '250505', nombreCuenta: 'Salarios por pagar', nit: '34.567.890', tercero: 'Martínez Rojas Ana Lucía', centro: 'OPE', debito: 0, credito: 600000, concepto: 'Prestaciones por pagar feb OPE' },
  ],
};

const TAB_META: Record<Tab, { label: string; codigo: string; nombre: string; documento: string }> = {
  nomina: { label: 'Nómina', codigo: 'NOM3', nombre: 'Nómina febrero 2026', documento: 'NOM-2026-02' },
  aportes: { label: 'Aportes', codigo: 'NOM4', nombre: 'Aportes seguridad social febrero 2026', documento: 'APO-2026-02' },
  provisiones: { label: 'Provisiones', codigo: 'NOM5', nombre: 'Provisiones nómina febrero 2026', documento: 'PRO-2026-02' },
};

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

export default function Nomina({ onNavigate, onCrearLote }: Props) {
  const [tab, setTab] = useState<Tab>('nomina');
  const [periodo, setPeriodo] = useState('2026-02');
  const [documento, setDocumento] = useState(TAB_META.nomina.documento);
  const [comprobante, setComprobante] = useState('CE');
  const [centroDefecto, setCentroDefecto] = useState('ADM');
  const [terceroEmpleados, setTerceroEmpleados] = useState('12.345.678');
  const [aviso, setAviso] = useState(false);
  const [loteCreado, setLoteCreado] = useState<Lote | null>(null);

  const filas = FILAS[tab];
  const totalDeb = filas.reduce((s, f) => s + f.debito, 0);
  const totalCred = filas.reduce((s, f) => s + f.credito, 0);

  function cambiarTab(t: Tab) {
    setTab(t);
    setDocumento(TAB_META[t].documento);
    setAviso(false);
  }

  function generarLote() {
    const meta = TAB_META[tab];
    const comp = COMPROBANTES.find(c => c.codigo === comprobante);
    const lineas: LoteLinea[] = filas.map((f, i) => ({
      id: `L${String(i + 1).padStart(2, '0')}`,
      cuenta: f.cuenta,
      nombreCuenta: f.nombreCuenta,
      nit: f.nit,
      tercero: f.tercero,
      centro: f.centro,
      comprobante: `${comprobante}-${String(comp?.consecutivo ?? 0).padStart(6, '0')}`,
      documento,
      fecha: '2026-02-28',
      debito: f.debito,
      credito: f.credito,
      base: 0,
      clase: f.cuenta === '236540' ? 'RETFTE' : '',
      docAfectado: '',
      concepto: f.concepto,
      errores: [],
    }));
    const lote: Lote = {
      id: `lote-${Date.now()}`,
      codigo: meta.codigo,
      nombre: meta.nombre,
      periodo,
      usuario: 'Laura Gómez',
      origen: 'Nómina',
      fecha: '2026-02-28',
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
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Movimientos / Nómina</div>
          <h1 className="text-lg font-semibold text-gray-800">Integración de nómina</h1>
          <p className="mt-1 text-xs text-gray-500">Nómina, aportes y provisiones con flujo separado por tipo y generación de lote para validación.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(Object.keys(TAB_META) as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => cambiarTab(t)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === t ? 'border-petroleum-500 text-petroleum-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_META[t].label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded border border-gray-200 p-4">
        <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
          <legend className="px-2 text-xs font-semibold text-petroleum-800">Parámetros del flujo {TAB_META[tab].label}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Período</label>
              <select value={periodo} onChange={e => setPeriodo(e.target.value)} className={SELECT}>
                <option value="2026-02">2026-02 Febrero</option>
                <option value="2026-01">2026-01 Enero</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Documento</label>
              <input value={documento} onChange={e => setDocumento(e.target.value)} className={`${INPUT} font-mono`} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Comprobante</label>
              <select value={comprobante} onChange={e => setComprobante(e.target.value)} className={SELECT}>
                {COMPROBANTES.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Centro por defecto</label>
              <select value={centroDefecto} onChange={e => setCentroDefecto(e.target.value)} className={SELECT}>
                {CENTROS.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Tercero empleados</label>
              <select value={terceroEmpleados} onChange={e => setTerceroEmpleados(e.target.value)} className={SELECT}>
                {TERCEROS.filter(t => t.tipo === 'Natural').map(t => <option key={t.nit} value={t.nit}>{t.nombre}</option>)}
              </select>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            El centro por defecto se aplica a las líneas que no traen centro; el tercero agrupa a los empleados del flujo.
          </p>
        </fieldset>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="text-xs font-semibold text-gray-700">Líneas de ejemplo — {TAB_META[tab].label} ({documento})</div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${totalDeb === totalCred ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {totalDeb === totalCred ? 'Cuadrado' : 'Descuadrado'}
          </span>
        </div>
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Cuenta</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre cuenta</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">NIT</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Tercero</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Centro</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Débito</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Crédito</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Concepto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filas.map(f => (
                <tr key={f.id} className="hoverable">
                  <td className="px-3 py-2 font-mono text-gray-700">{f.cuenta}</td>
                  <td className="px-3 py-2 text-gray-600">{f.nombreCuenta}</td>
                  <td className="px-3 py-2 font-mono text-gray-600">{f.nit || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-44 truncate">{f.tercero || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2">
                    {f.centro ? (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        f.centro === 'ADM' ? 'bg-blue-50 text-blue-700' :
                        f.centro === 'VEN' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}>{f.centro}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-800">{f.debito > 0 ? fmtCOP(f.debito) : <span className="text-gray-200">—</span>}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-500">{f.credito > 0 ? fmtCOP(f.credito) : <span className="text-gray-200">—</span>}</td>
                  <td className="px-3 py-2 text-gray-500">{f.concepto}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-gray-700">TOTALES</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(totalDeb)}</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(totalCred)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">{filas.length} líneas — flujo cuadrado por construcción (débito = crédito).</span>
          <button type="button" onClick={generarLote} className={BUTTON_PRIMARY}>
            Generar lote
          </button>
        </div>
      </div>

      {aviso && loteCreado && (
        <Modal title="Lote generado" onClose={() => setAviso(false)}>
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
