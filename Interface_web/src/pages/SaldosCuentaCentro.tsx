import { useId, useRef, useState, useEffect, useMemo, type ReactNode } from 'react';
import { CENTROS, CUENTAS, MOVIMIENTOS_FEB, fmtCOP } from '../data/mock';
import type { MovimientoLinea } from '../types';

const SELECT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';

interface SaldoCC {
  cuenta: string;
  nombre: string;
  centro: string;
  debito: number;
  credito: number;
  lineas: MovimientoLinea[];
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

/** Febrero: datos reales del libro + complemento NOM2 para que el flujo cuadre por completo. */
function generarFeb(): MovimientoLinea[] {
  const out: MovimientoLinea[] = [...MOVIMIENTOS_FEB];
  const nombreCuenta = (codigo: string) => CUENTAS.find(c => c.codigo === codigo)?.nombre ?? codigo;
  const C = (id: string, fecha: string, comprobante: string, tipoDoc: string, documento: string, cuenta: string, nit: string, tercero: string, centro: string, debito: number, credito: number, concepto: string) => {
    out.push({
      id, periodo: '2026-02', fecha, comprobante, tipoDoc, documento, cuenta, nombreCuenta: nombreCuenta(cuenta),
      nit, tercero, centro, debito, credito, base: 0, clase: cuenta === '236540' ? 'RETFTE' : '', docAfectado: '', concepto, origen: 'Nómina', lote: 'NOM2',
    });
  };
  C('C01', '2026-02-28', 'CE-000245', 'NOM', 'NOM-2026-02', '510506', '12.345.678', 'García Moreno Juan Pablo', 'ADM', 800000, 0, 'Prestaciones febrero ADM');
  C('C02', '2026-02-28', 'CE-000245', 'NOM', 'NOM-2026-02', '510506', '34.567.890', 'Martínez Rojas Ana Lucía', 'OPE', 600000, 0, 'Prestaciones febrero OPE');
  C('C03', '2026-02-28', 'CE-000245', 'NOM', 'NOM-2026-02', '510506', '12.345.678', 'García Moreno Juan Pablo', 'ADM', 1200000, 0, 'Aportes seguridad social feb');
  C('C04', '2026-02-28', 'CE-000245', 'NOM', 'NOM-2026-02', '250505', '12.345.678', 'García Moreno Juan Pablo', 'ADM', 0, 800000, 'Prestaciones por pagar feb ADM');
  C('C05', '2026-02-28', 'CE-000245', 'NOM', 'NOM-2026-02', '250505', '34.567.890', 'Martínez Rojas Ana Lucía', 'OPE', 0, 600000, 'Prestaciones por pagar feb OPE');
  C('C06', '2026-02-20', 'CE-000246', 'RB', 'RB-2026-006', '510506', '34.567.890', 'Martínez Rojas Ana Lucía', 'OPE', 390000, 0, 'Reembolso caja menor transporte');
  C('C07', '2026-02-20', 'CE-000246', 'RB', 'RB-2026-006', '110505', '', '', '', 0, 390000, 'Reembolso caja menor');
  return out;
}

export default function SaldosCuentaCentro() {
  const [cuentaSel, setCuentaSel] = useState('510506');
  const [centroSel, setCentroSel] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<SaldoCC | null>(null);

  const movs = useMemo(generarFeb, []);

  const saldos: SaldoCC[] = useMemo(() => {
    const mapa = new Map<string, SaldoCC>();
    for (const m of movs) {
      const clave = `${m.cuenta}|${m.centro}`;
      const existente = mapa.get(clave);
      if (existente) {
        existente.debito += m.debito;
        existente.credito += m.credito;
        existente.lineas.push(m);
      } else {
        mapa.set(clave, {
          cuenta: m.cuenta,
          nombre: m.nombreCuenta,
          centro: m.centro,
          debito: m.debito,
          credito: m.credito,
          lineas: [m],
        });
      }
    }
    return Array.from(mapa.values());
  }, [movs]);

  const cuentas = useMemo(() => {
    const mapa = new Map<string, { cuenta: string; nombre: string; debito: number; credito: number }>();
    for (const s of saldos) {
      const existente = mapa.get(s.cuenta);
      if (existente) {
        existente.debito += s.debito;
        existente.credito += s.credito;
      } else {
        mapa.set(s.cuenta, { cuenta: s.cuenta, nombre: s.nombre, debito: s.debito, credito: s.credito });
      }
    }
    return Array.from(mapa.values());
  }, [saldos]);

  const centros = useMemo(() => {
    const mapa = new Map<string, { centro: string; debito: number; credito: number }>();
    for (const s of saldos) {
      const existente = mapa.get(s.centro);
      if (existente) {
        existente.debito += s.debito;
        existente.credito += s.credito;
      } else {
        mapa.set(s.centro, { centro: s.centro, debito: s.debito, credito: s.credito });
      }
    }
    return Array.from(mapa.values());
  }, [saldos]);

  const centrosDeCuenta = saldos.filter(s => s.cuenta === cuentaSel).sort((a, b) => a.centro.localeCompare(b.centro));
  const cuentasDeCentro = saldos.filter(s => s.centro === centroSel);
  const saldo = (s: { debito: number; credito: number }) => s.debito - s.credito;
  const nombreCentro = (codigo: string) => codigo ? `${codigo} — ${CENTROS.find(c => c.codigo === codigo)?.nombre ?? 'Centro'}` : 'Sin centro';

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Consultas / Saldos cuenta-centro</div>
          <h1 className="text-lg font-semibold text-gray-800">Saldos cuenta / centro</h1>
          <p className="mt-1 text-xs text-gray-500">Dos paneles relacionados: cuentas con su desglose por centro y centros con su desglose por cuenta.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
          <button type="button" onClick={() => window.print()} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">⎙ Imprimir</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Panel izquierdo: cuenta → centros */}
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="text-xs font-semibold text-gray-700">Cuenta → centros con saldo</div>
            <select value={cuentaSel} onChange={e => setCuentaSel(e.target.value)} className={SELECT + ' w-auto'}>
              {cuentas.map(c => <option key={c.cuenta} value={c.cuenta}>{c.cuenta} — {c.nombre}</option>)}
            </select>
          </div>
          <div className="table-fixed-header overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Cuenta</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Débito</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Crédito</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cuentas.map(c => (
                  <tr key={c.cuenta} className={`hoverable cursor-pointer ${c.cuenta === cuentaSel ? 'bg-petroleum-50' : ''}`} onClick={() => setCuentaSel(c.cuenta)}>
                    <td className="px-3 py-2">
                      <div className="font-mono text-gray-700">{c.cuenta}</div>
                      <div className="text-gray-500 max-w-44 truncate">{c.nombre}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-800">{c.debito > 0 ? fmtCOP(c.debito) : <span className="text-gray-200">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-500">{c.credito > 0 ? fmtCOP(c.credito) : <span className="text-gray-200">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-gray-800">{fmtCOP(saldo(c))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-4 py-2.5">
            <div className="text-xs font-semibold text-gray-600 mb-1.5">Centros de {cuentaSel}</div>
            {centrosDeCuenta.length === 0 ? (
              <div className="text-center py-4 text-xs text-gray-500">Sin resultados — la cuenta no tiene movimientos con centro.</div>
            ) : (
              <div className="space-y-1">
                {centrosDeCuenta.map(s => (
                  <button
                    key={s.centro}
                    type="button"
                    onClick={() => { setCentroSel(s.centro); setDetalle(s); }}
                    className="w-full flex items-center justify-between gap-3 rounded border border-gray-200 px-2.5 py-1.5 text-xs hover:border-petroleum-300 hover:bg-petroleum-50"
                    title="Clic en el saldo para ver el detalle del documento"
                  >
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      s.centro === 'ADM' ? 'bg-blue-50 text-blue-700' :
                      s.centro === 'VEN' ? 'bg-green-50 text-green-700' :
                      s.centro === 'OPE' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'
                    }`}>{s.centro || '—'}</span>
                    <span className="ml-auto font-mono text-gray-600">{s.debito > 0 ? fmtCOP(s.debito) : '—'}</span>
                    <span className="font-mono text-gray-500">{s.credito > 0 ? fmtCOP(s.credito) : '—'}</span>
                    <span className="font-mono font-semibold text-gray-800 w-28 text-right">{fmtCOP(saldo(s))}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel derecho: centro → cuentas */}
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="text-xs font-semibold text-gray-700">Centro → cuentas con saldo</div>
            <select value={centroSel ?? ''} onChange={e => setCentroSel(e.target.value || null)} className={SELECT + ' w-auto'}>
              <option value="">— Seleccionar —</option>
              {centros.map(c => <option key={c.centro} value={c.centro}>{nombreCentro(c.centro)}</option>)}
            </select>
          </div>
          <div className="table-fixed-header overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Centro</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Débito</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Crédito</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {centros.map(c => (
                  <tr key={c.centro} className={`hoverable cursor-pointer ${c.centro === centroSel ? 'bg-petroleum-50' : ''}`} onClick={() => setCentroSel(c.centro)}>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        c.centro === 'ADM' ? 'bg-blue-50 text-blue-700' :
                        c.centro === 'VEN' ? 'bg-green-50 text-green-700' :
                        c.centro === 'OPE' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'
                      }`}>{c.centro || 'Sin centro'}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-800">{c.debito > 0 ? fmtCOP(c.debito) : <span className="text-gray-200">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-500">{c.credito > 0 ? fmtCOP(c.credito) : <span className="text-gray-200">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-gray-800">{fmtCOP(saldo(c))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-4 py-2.5">
            <div className="text-xs font-semibold text-gray-600 mb-1.5">
              {centroSel ? `Cuentas de ${nombreCentro(centroSel)}` : 'Seleccione un centro para ver sus cuentas'}
            </div>
            {!centroSel ? (
              <div className="text-center py-4 text-xs text-gray-500">Elija un centro en la tabla superior o haga clic en un saldo del panel izquierdo.</div>
            ) : cuentasDeCentro.length === 0 ? (
              <div className="text-center py-4 text-xs text-gray-500">Sin resultados — el centro no tiene movimientos.</div>
            ) : (
              <div className="space-y-1">
                {cuentasDeCentro.map(s => (
                  <button
                    key={s.cuenta}
                    type="button"
                    onClick={() => { setCuentaSel(s.cuenta); setDetalle(s); }}
                    className="w-full flex items-center justify-between gap-3 rounded border border-gray-200 px-2.5 py-1.5 text-xs hover:border-petroleum-300 hover:bg-petroleum-50"
                    title="Clic en el saldo para ver el detalle del documento"
                  >
                    <span className="font-mono text-gray-700">{s.cuenta}</span>
                    <span className="text-gray-500 max-w-36 truncate">{s.nombre}</span>
                    <span className="ml-auto font-mono text-gray-600">{s.debito > 0 ? fmtCOP(s.debito) : '—'}</span>
                    <span className="font-mono text-gray-500">{s.credito > 0 ? fmtCOP(s.credito) : '—'}</span>
                    <span className="font-mono font-semibold text-gray-800 w-28 text-right">{fmtCOP(saldo(s))}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {detalle && (
        <Modal title={`${detalle.cuenta} — ${detalle.nombre} · ${nombreCentro(detalle.centro)}`} onClose={() => setDetalle(null)}>
          <div className="px-5 py-4">
            <div className="rounded border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Fecha</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Comprobante</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Documento</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Débito</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Crédito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {detalle.lineas.map(l => (
                    <tr key={l.id}>
                      <td className="px-3 py-1.5 font-mono text-gray-600">{l.fecha}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-700">{l.comprobante}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-600">{l.documento}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-800">{l.debito > 0 ? fmtCOP(l.debito) : <span className="text-gray-200">—</span>}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-500">{l.credito > 0 ? fmtCOP(l.credito) : <span className="text-gray-200">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
              <span>Débitos: <span className="font-mono font-semibold text-gray-800">{fmtCOP(detalle.debito)}</span></span>
              <span>Créditos: <span className="font-mono font-semibold text-gray-800">{fmtCOP(detalle.credito)}</span></span>
              <span className="ml-auto font-mono font-semibold text-gray-800">Saldo: {fmtCOP(saldo(detalle))}</span>
            </div>
          </div>
          <div className="flex justify-end border-t border-gray-200 px-5 py-4">
            <button type="button" data-initial-focus onClick={() => setDetalle(null)} className="rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600">Cerrar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
