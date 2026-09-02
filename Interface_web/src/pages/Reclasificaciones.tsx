import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CENTROS, MOVIMIENTOS_FEB, TERCEROS, fmtCOP } from '../data/mock';
import { crearLoteReclasificacion, cuentasAfectables, movimientosPorDocumento, totalesLineas, type ResultadoReclasificacion } from '../data/configReclasificaciones';
import type { Lote, LoteLinea, MovimientoLinea } from '../types';
import type { NavPage } from '../components/Shell';

interface Props {
  onNavigate: (p: NavPage) => void;
  onCrearLote: (l: Lote) => void;
}

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} className={`fixed inset-0 m-auto w-[calc(100%_-_2rem)] ${wide ? 'max-w-4xl' : 'max-w-lg'} rounded-lg border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/40`}>
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 id={titleId} className="text-sm font-semibold text-gray-800">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar diálogo" className="rounded px-2 text-xl text-gray-500 hover:bg-gray-100">×</button>
      </div>
      {children}
    </dialog>
  );
}

type TabId = 'cuenta-doc-centro' | 'comp-doc-tercero' | 'centro-cuenta' | 'plan-nivel' | 'movimiento-mes';

const TABS: { id: TabId; label: string }[] = [
  { id: 'cuenta-doc-centro', label: 'Cuenta-documento a centro' },
  { id: 'comp-doc-tercero', label: 'Comprobante-documento-tercero' },
  { id: 'centro-cuenta', label: 'Centro por cuenta' },
  { id: 'plan-nivel', label: 'Analizar plan por nivel' },
  { id: 'movimiento-mes', label: 'Analizar movimiento por mes' },
];

// Una reclasificación genera un par por cada movimiento: reversa del original
// y re-captura con el nuevo dato. Así el lote queda cuadrado y trazable.
function parReclasificacion(m: MovimientoLinea, cambios: { centro?: string; tercero?: string; nit?: string }, conceptoNuevo: string): LoteLinea[] {
  const base: LoteLinea = {
    id: m.id,
    cuenta: m.cuenta,
    nombreCuenta: m.nombreCuenta,
    nit: m.nit,
    tercero: m.tercero,
    centro: m.centro,
    comprobante: m.comprobante,
    documento: m.documento,
    fecha: m.fecha,
    debito: m.debito,
    credito: m.credito,
    base: m.base,
    clase: m.clase,
    docAfectado: m.documento,
    concepto: m.concepto,
    errores: [],
  };
  const reversa: LoteLinea = { ...base, debito: m.credito, credito: m.debito, concepto: `Reversa: ${m.concepto}`, docAfectado: m.documento };
  const reCaptura: LoteLinea = {
    ...base,
    centro: cambios.centro !== undefined ? cambios.centro : m.centro,
    tercero: cambios.tercero !== undefined ? cambios.tercero : m.tercero,
    nit: cambios.nit !== undefined ? cambios.nit : m.nit,
    concepto: conceptoNuevo,
    docAfectado: m.documento,
  };
  return [reversa, reCaptura];
}

const COMPROBANTES_FEB = [...new Set(MOVIMIENTOS_FEB.map(m => m.comprobante))].sort();
const DOCUMENTOS_FEB = [...new Set(MOVIMIENTOS_FEB.map(m => m.documento))].sort();

export default function Reclasificaciones({ onNavigate, onCrearLote }: Props) {
  const [tab, setTab] = useState<TabId>('cuenta-doc-centro');
  const [resultado, setResultado] = useState<ResultadoReclasificacion | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [simulando, setSimulando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [loteCreado, setLoteCreado] = useState<Lote | null>(null);

  const [f1, setF1] = useState({ cuenta: '510506', documento: 'NOM-2026-02', centroDestino: 'OPE' });
  const [f2, setF2] = useState({ comprobante: 'CE-000245', documento: 'NOM-2026-02', nitDestino: '12.345.678' });
  const [f3, setF3] = useState({ cuenta: '510506', centroOrigen: 'ADM', centroDestino: 'OPE' });
  const [f4, setF4] = useState({ nivel: 4 });
  const [f5, setF5] = useState({ mes: 2 });

  useEffect(() => {
    if (!simulando) return;
    const timer = setInterval(() => {
      setProgreso(prev => {
        const next = Math.min(100, prev + 20 + Math.random() * 25);
        if (next >= 100) {
          clearInterval(timer);
          setSimulando(false);
          return 100;
        }
        return next;
      });
    }, 220);
    return () => clearInterval(timer);
  }, [simulando]);

  function simular(event: FormEvent) {
    event.preventDefault();
    setError('');
    setResultado(null);
    setLoteCreado(null);

    if (tab === 'cuenta-doc-centro') {
      if (!f1.cuenta || !f1.documento || !f1.centroDestino) {
        setError('Seleccione cuenta, documento y centro de destino.');
        return;
      }
      const movimientos = MOVIMIENTOS_FEB.filter(m => m.cuenta === f1.cuenta && m.documento === f1.documento);
      if (!movimientos.length) {
        setError('No se encontraron movimientos para esa cuenta y documento en febrero de 2026.');
        return;
      }
      const lineas = movimientos.flatMap(m => parReclasificacion(m, { centro: f1.centroDestino }, `Reclasificación a centro ${f1.centroDestino}`));
      setResultado({
        nombre: `Reclasificación ${f1.cuenta} ${f1.documento} a ${f1.centroDestino}`,
        descripcion: `${movimientos.length} movimiento(s) de la cuenta ${f1.cuenta} y documento ${f1.documento} trasladados al centro ${f1.centroDestino}, con reversa y re-captura.`,
        documentos: new Set(movimientos.map(m => m.documento)).size,
        lineas,
      });
      setProgreso(0);
      setSimulando(true);
      return;
    }

    if (tab === 'comp-doc-tercero') {
      const nit = f2.nitDestino;
      const tercero = TERCEROS.find(t => t.nit === nit);
      if (!f2.comprobante || !f2.documento || !nit || !tercero) {
        setError('Seleccione comprobante, documento y tercero de destino.');
        return;
      }
      const movimientos = movimientosPorDocumento(f2.comprobante, f2.documento);
      if (!movimientos.length) {
        setError('No se encontraron movimientos para ese comprobante y documento.');
        return;
      }
      const lineas = movimientos.flatMap(m => parReclasificacion(m, { nit: tercero.nit, tercero: tercero.nombre }, `Reclasificación a tercero ${tercero.nombre}`));
      setResultado({
        nombre: `Reclasificación ${f2.comprobante} ${f2.documento} a ${tercero.nombre}`,
        descripcion: `${movimientos.length} movimiento(s) del comprobante ${f2.comprobante} y documento ${f2.documento} trasladados al tercero ${tercero.nit} — ${tercero.nombre}.`,
        documentos: 1,
        lineas,
      });
      setProgreso(0);
      setSimulando(true);
      return;
    }

    if (tab === 'centro-cuenta') {
      if (!f3.cuenta || !f3.centroOrigen || !f3.centroDestino) {
        setError('Seleccione cuenta, centro de origen y centro de destino.');
        return;
      }
      if (f3.centroOrigen === f3.centroDestino) {
        setError('El centro de destino debe ser distinto del centro de origen.');
        return;
      }
      const movimientos = MOVIMIENTOS_FEB.filter(m => m.cuenta === f3.cuenta && m.centro === f3.centroOrigen);
      if (!movimientos.length) {
        setError(`No hay movimientos de la cuenta ${f3.cuenta} en el centro ${f3.centroOrigen}.`);
        return;
      }
      const lineas = movimientos.flatMap(m => parReclasificacion(m, { centro: f3.centroDestino }, `Reclasificación de ${f3.centroOrigen} a ${f3.centroDestino}`));
      setResultado({
        nombre: `Reclasificación ${f3.cuenta} de ${f3.centroOrigen} a ${f3.centroDestino}`,
        descripcion: `${movimientos.length} movimiento(s) de la cuenta ${f3.cuenta} trasladados del centro ${f3.centroOrigen} al centro ${f3.centroDestino}.`,
        documentos: new Set(movimientos.map(m => m.documento)).size,
        lineas,
      });
      setProgreso(0);
      setSimulando(true);
      return;
    }

    if (tab === 'plan-nivel') {
      const nivel = f4.nivel;
      const movimientos = MOVIMIENTOS_FEB.filter(m => cuentasAfectables().some(c => c.codigo === m.cuenta) && nivel === 4);
      if (!movimientos.length) {
        setError('No hay movimientos registrados en cuentas de ese nivel para el período de demostración.');
        return;
      }
      const lineas = movimientos.flatMap(m => parReclasificacion(m, {}, `Recorrido nivel ${nivel}: ${m.concepto}`));
      setResultado({
        nombre: `Reclasificación por nivel ${nivel}`,
        descripcion: `Análisis del nivel ${nivel}: ${movimientos.length} movimiento(s) encontrados. La reclasificación reversa y re-captura cada línea para su revisión.`,
        documentos: new Set(movimientos.map(m => m.documento)).size,
        lineas,
      });
      setProgreso(0);
      setSimulando(true);
      return;
    }

    if (tab === 'movimiento-mes') {
      const mes = f5.mes;
      const movimientos = MOVIMIENTOS_FEB.filter(m => Number(m.fecha.slice(5, 7)) === mes);
      if (!movimientos.length) {
        setError(`No hay movimientos registrados en ${MESES[mes - 1]} de 2026 en los datos de demostración.`);
        return;
      }
      const lineas = movimientos.flatMap(m => parReclasificacion(m, {}, `Reclasificación ${MESES[mes - 1]}: ${m.concepto}`));
      setResultado({
        nombre: `Reclasificación de ${MESES[mes - 1]}`,
        descripcion: `Análisis del movimiento de ${MESES[mes - 1]}: ${movimientos.length} movimiento(s). La reclasificación reversa y re-captura cada línea para su revisión.`,
        documentos: new Set(movimientos.map(m => m.documento)).size,
        lineas,
      });
      setProgreso(0);
      setSimulando(true);
      return;
    }
  }

  function generarLote() {
    if (!resultado || simulando) return;
    const lote = crearLoteReclasificacion(resultado, Math.floor(Math.random() * 900) + 100);
    onCrearLote(lote);
    setLoteCreado(lote);
    setMensaje({ tipo: 'success', texto: `Lote ${lote.codigo} creado como Borrador y cuadrado (${fmtCOP(lote.debito)} = ${fmtCOP(lote.credito)}).` });
  }

  const totales = resultado ? totalesLineas(resultado.lineas) : null;

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Reclasificaciones</div>
          <h1 className="text-lg font-semibold text-gray-800">Reclasificaciones</h1>
          <p className="mt-1 text-xs text-gray-500">Reasignación de cuentas, centros y terceros con simulación y generación de lote borrador cuadrado.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {mensaje && <div role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`rounded border px-4 py-3 text-sm ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>{mensaje.texto}</div>}

      {loteCreado && (
        <div className="rounded border border-petroleum-200 bg-petroleum-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-petroleum-900">
            Lote <span className="font-mono font-semibold">{loteCreado.codigo}</span> — {loteCreado.nombre} creado como <strong>Borrador</strong> con {loteCreado.lineasCount} líneas y débito = crédito = {fmtCOP(loteCreado.debito)}.
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onNavigate('movimientos/lotes')} className={BUTTON_PRIMARY}>Abrir lotes</button>
            <button onClick={() => setLoteCreado(null)} className={BUTTON_SECONDARY}>Cerrar</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResultado(null); setError(''); setLoteCreado(null); }}
            className={`text-xs px-3 py-1.5 rounded-t border-b-2 font-medium ${tab === t.id ? 'border-petroleum-500 text-petroleum-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-4 items-start">
        <div className="w-96 shrink-0">
          <form noValidate onSubmit={simular} className="bg-white rounded border border-gray-200 p-4 space-y-3">
            {tab === 'cuenta-doc-centro' && (
              <>
                <div className="grid items-center gap-1">
                  <label htmlFor="rcl-f1-cuenta" className="text-xs font-medium text-gray-600">Cuenta:</label>
                  <select id="rcl-f1-cuenta" data-initial-focus className={INPUT} value={f1.cuenta} onChange={e => setF1(prev => ({ ...prev, cuenta: e.target.value }))}>
                    {cuentasAfectables().map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                  </select>
                </div>
                <div className="grid items-center gap-1">
                  <label htmlFor="rcl-f1-doc" className="text-xs font-medium text-gray-600">Documento:</label>
                  <select id="rcl-f1-doc" className={INPUT} value={f1.documento} onChange={e => setF1(prev => ({ ...prev, documento: e.target.value }))}>
                    {DOCUMENTOS_FEB.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="grid items-center gap-1">
                  <label htmlFor="rcl-f1-centro" className="text-xs font-medium text-gray-600">Centro de destino:</label>
                  <select id="rcl-f1-centro" className={INPUT} value={f1.centroDestino} onChange={e => setF1(prev => ({ ...prev, centroDestino: e.target.value }))}>
                    {CENTROS.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                  </select>
                </div>
                <p className="text-xs text-gray-500">Busca los movimientos de la cuenta y el documento y los reasigna al centro indicado.</p>
              </>
            )}

            {tab === 'comp-doc-tercero' && (
              <>
                <div className="grid items-center gap-1">
                  <label htmlFor="rcl-f2-comp" className="text-xs font-medium text-gray-600">Comprobante:</label>
                  <select id="rcl-f2-comp" data-initial-focus className={INPUT} value={f2.comprobante} onChange={e => setF2(prev => ({ ...prev, comprobante: e.target.value }))}>
                    {COMPROBANTES_FEB.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid items-center gap-1">
                  <label htmlFor="rcl-f2-doc" className="text-xs font-medium text-gray-600">Documento:</label>
                  <select id="rcl-f2-doc" className={INPUT} value={f2.documento} onChange={e => setF2(prev => ({ ...prev, documento: e.target.value }))}>
                    {DOCUMENTOS_FEB.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="grid items-center gap-1">
                  <label htmlFor="rcl-f2-tercero" className="text-xs font-medium text-gray-600">Tercero de destino:</label>
                  <select id="rcl-f2-tercero" className={INPUT} value={f2.nitDestino} onChange={e => setF2(prev => ({ ...prev, nitDestino: e.target.value }))}>
                    {TERCEROS.filter(t => t.estado === 'Activo').map(t => <option key={t.nit} value={t.nit}>{t.nit}-{t.digito} — {t.nombre}</option>)}
                  </select>
                </div>
                <p className="text-xs text-gray-500">Reasigna el tercero de todas las líneas del comprobante y documento seleccionados.</p>
              </>
            )}

            {tab === 'centro-cuenta' && (
              <>
                <div className="grid items-center gap-1">
                  <label htmlFor="rcl-f3-cuenta" className="text-xs font-medium text-gray-600">Cuenta:</label>
                  <select id="rcl-f3-cuenta" data-initial-focus className={INPUT} value={f3.cuenta} onChange={e => setF3(prev => ({ ...prev, cuenta: e.target.value }))}>
                    {cuentasAfectables().map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid items-center gap-1">
                    <label htmlFor="rcl-f3-origen" className="text-xs font-medium text-gray-600">Centro origen:</label>
                    <select id="rcl-f3-origen" className={INPUT} value={f3.centroOrigen} onChange={e => setF3(prev => ({ ...prev, centroOrigen: e.target.value }))}>
                      {CENTROS.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo}</option>)}
                    </select>
                  </div>
                  <div className="grid items-center gap-1">
                    <label htmlFor="rcl-f3-destino" className="text-xs font-medium text-gray-600">Centro destino:</label>
                    <select id="rcl-f3-destino" className={INPUT} value={f3.centroDestino} onChange={e => setF3(prev => ({ ...prev, centroDestino: e.target.value }))}>
                      {CENTROS.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo}</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Traslada los movimientos de la cuenta del centro origen al centro destino.</p>
              </>
            )}

            {tab === 'plan-nivel' && (
              <>
                <div className="grid items-center gap-1">
                  <label htmlFor="rcl-f4-nivel" className="text-xs font-medium text-gray-600">Nivel del plan:</label>
                  <select id="rcl-f4-nivel" data-initial-focus className={INPUT} value={String(f4.nivel)} onChange={e => setF4({ nivel: Number(e.target.value) })}>
                    <option value={1}>1 — Clase</option>
                    <option value={2}>2 — Grupo</option>
                    <option value={3}>3 — Cuenta</option>
                    <option value={4}>4 — Subcuenta</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500">Analiza las cuentas del nivel indicado y prepara la reclasificación de sus movimientos.</p>
              </>
            )}

            {tab === 'movimiento-mes' && (
              <>
                <div className="grid items-center gap-1">
                  <label htmlFor="rcl-f5-mes" className="text-xs font-medium text-gray-600">Mes del año 2026:</label>
                  <select id="rcl-f5-mes" data-initial-focus className={INPUT} value={String(f5.mes)} onChange={e => setF5({ mes: Number(e.target.value) })}>
                    {MESES.map((m, i) => <option key={m} value={i + 1}>{String(i + 1).padStart(2, '0')} — {m}</option>)}
                  </select>
                </div>
                <p className="text-xs text-gray-500">Analiza el movimiento del mes indicado y prepara su reclasificación para revisión.</p>
              </>
            )}

            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            {simulando && (
              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-petroleum-500 transition-all duration-300" style={{ width: `${Math.round(progreso)}%` }} />
                </div>
                <div className="mt-1 text-right text-xs font-mono text-gray-500">{Math.round(progreso)}%</div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="submit" className={BUTTON_PRIMARY} disabled={simulando}>Simular</button>
            </div>
          </form>
        </div>

        <div className="flex-1 min-w-0">
          {resultado ? (
            <div className="space-y-3">
              <div className="bg-white rounded border border-gray-200 p-4">
                <div className="text-sm font-semibold text-gray-800">{resultado.nombre}</div>
                <p className="mt-0.5 text-xs text-gray-500">{resultado.descripcion}</p>
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                  <span><strong className="text-gray-800">{resultado.documentos}</strong> documento(s)</span>
                  <span><strong className="text-gray-800">{totales?.lineas}</strong> línea(s) con reversa y re-captura</span>
                  {totales && (
                    <span className={totales.diferencia === 0 ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                      {totales.diferencia === 0 ? '✓ Cuadrado' : '✗ Descuadrado'} — D {fmtCOP(totales.debito)} = C {fmtCOP(totales.credito)}
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-white rounded border border-gray-200 overflow-hidden">
                <div className="table-fixed-header overflow-x-auto max-h-96">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">#</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Cuenta</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Tercero</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Centro</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Documento</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Débito</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Crédito</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Concepto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {resultado.lineas.map((l, i) => (
                        <tr key={`${l.id}-${i}`} className="hoverable">
                          <td className="px-3 py-1.5 font-mono text-gray-400">{String(i + 1).padStart(2, '0')}</td>
                          <td className="px-3 py-1.5 font-mono text-gray-700">{l.cuenta}</td>
                          <td className="px-3 py-1.5 text-gray-600 max-w-40 truncate">{l.tercero || '—'}</td>
                          <td className="px-3 py-1.5 font-mono text-gray-600">{l.centro || '—'}</td>
                          <td className="px-3 py-1.5 font-mono text-gray-500">{l.docAfectado || l.documento}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-gray-800">{l.debito ? fmtCOP(l.debito) : '—'}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-gray-800">{l.credito ? fmtCOP(l.credito) : '—'}</td>
                          <td className="px-3 py-1.5 text-gray-500 max-w-64 truncate">{l.concepto}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={generarLote} className={BUTTON_PRIMARY}>Generar lote</button>
              </div>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-400">
              Diligencie el formulario y presione <span className="mx-1 font-semibold">Simular</span> para ver el resultado de la reclasificación.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
