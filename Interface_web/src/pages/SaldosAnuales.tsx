import { useState } from 'react';
import { SALDOS_BALANCE, fmtCOP } from '../data/mock';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';

type Pestana = 'meses' | 'ajustes';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Columnas de ajuste (períodos 13-18) — datos de ejemplo que cuadran por columna.
const AJUSTES: { codigo: string; nombre: string }[] = [
  { codigo: '13', nombre: 'Reclasificaciones' },
  { codigo: '14', nombre: 'Cierres' },
  { codigo: '15', nombre: 'IVA' },
  { codigo: '16', nombre: 'Retefuente' },
  { codigo: '17', nombre: 'Consolidación' },
  { codigo: '18', nombre: 'Depuración' },
];

const AJUSTES_MOCK: Record<string, { debito: number; credito: number }[]> = {
  '110505': [{ debito: 0, credito: 120000 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 90000, credito: 0 }],
  '111005': [{ debito: 120000, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 2000000 }, { debito: 0, credito: 0 }],
  '130505': [{ debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 1500000 }, { debito: 0, credito: 0 }, { debito: 2000000, credito: 0 }, { debito: 0, credito: 0 }],
  '236540': [{ debito: 0, credito: 0 }, { debito: 210000, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }],
  '240805': [{ debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 1500000, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }],
  '250505': [{ debito: 0, credito: 0 }, { debito: 0, credito: 210000 }, { debito: 0, credito: 0 }, { debito: 0, credito: 300000 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }],
  '510506': [{ debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 300000, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 90000 }],
};

export default function SaldosAnuales() {
  const [pestana, setPestana] = useState<Pestana>('meses');
  const [busqueda, setBusqueda] = useState('');
  const [showExport, setShowExport] = useState(false);

  const filtradas = SALDOS_BALANCE.filter(s => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return s.cuenta.includes(q) || s.nombre.toLowerCase().includes(q);
  });

  const totalesMeses = MESES.map((_, i) => ({
    debito: filtradas.reduce((s, c) => s + (c.meses[i]?.debito ?? 0), 0),
    credito: filtradas.reduce((s, c) => s + (c.meses[i]?.credito ?? 0), 0),
  }));
  const totalInicial = filtradas.reduce((s, c) => s + c.saldoInicial, 0);
  const totalDeb = totalesMeses.reduce((s, m) => s + m.debito, 0);
  const totalCred = totalesMeses.reduce((s, m) => s + m.credito, 0);
  const totalFinal = totalInicial + totalDeb - totalCred;

  const totalesAjustes = AJUSTES.map((_, i) => ({
    debito: filtradas.reduce((s, c) => s + (AJUSTES_MOCK[c.cuenta]?.[i]?.debito ?? 0), 0),
    credito: filtradas.reduce((s, c) => s + (AJUSTES_MOCK[c.cuenta]?.[i]?.credito ?? 0), 0),
  }));

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Consultas / Saldos anuales</div>
          <h1 className="text-lg font-semibold text-gray-800">Saldos anuales</h1>
          <p className="mt-1 text-xs text-gray-500">Saldo inicial y comportamiento mensual enero–diciembre por cuenta.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
          <button type="button" onClick={() => window.print()} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">⎙ Imprimir</button>
          <div className="relative">
            <button type="button" onClick={() => setShowExport(v => !v)} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↓ Exportar ▾</button>
            {showExport && (
              <div className="absolute right-0 top-8 bg-white rounded border border-gray-200 shadow-lg z-20 py-1 w-36">
                {['PDF', 'XLSX', 'CSV'].map(f => (
                  <button key={f} type="button" onClick={() => setShowExport(false)} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">{f}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        {([['meses', 'Enero – Diciembre'], ['ajustes', 'Períodos 13 – 18 (ajustes)']] as [Pestana, string][]).map(([p, label]) => (
          <button
            key={p}
            type="button"
            onClick={() => setPestana(p)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              pestana === p ? 'border-petroleum-500 text-petroleum-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded border border-gray-200 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-gray-600">Buscar cuenta</label>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Código o nombre…" className={`${INPUT} w-56`} />
        </div>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="table-fixed-header overflow-x-auto">
          {pestana === 'meses' ? (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Cuenta</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Saldo inicial</th>
                  {MESES.map(m => (
                    <th key={m} className="px-3 py-2.5 text-right font-semibold text-gray-600">{m}</th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Total final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtradas.map(s => {
                  const saldoFinal = s.saldoInicial + s.meses.reduce((acc, m) => acc + m.debito - m.credito, 0);
                  return (
                    <tr key={s.cuenta} className="hoverable">
                      <td className="px-3 py-2 font-mono text-gray-700">{s.cuenta}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-44 truncate">{s.nombre}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{fmtCOP(s.saldoInicial)}</td>
                      {s.meses.map((m, i) => (
                        <td key={i} className="px-3 py-2 text-right font-mono">
                          <div className="text-gray-800">{m.debito > 0 ? fmtCOP(m.debito) : <span className="text-gray-300">·</span>}</div>
                          <div className="text-gray-400">{m.credito > 0 ? fmtCOP(m.credito) : <span className="text-gray-300">·</span>}</div>
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(saldoFinal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-700">TOTALES</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(totalInicial)}</td>
                  {totalesMeses.map((m, i) => (
                    <td key={i} className="px-3 py-2 text-right font-mono">
                      <div className="text-gray-800 font-semibold">{m.debito > 0 ? fmtCOP(m.debito) : <span className="text-gray-300">·</span>}</div>
                      <div className="text-gray-500 font-semibold">{m.credito > 0 ? fmtCOP(m.credito) : <span className="text-gray-300">·</span>}</div>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(totalFinal)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Cuenta</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                  {AJUSTES.map(a => (
                    <th key={a.codigo} className="px-3 py-2.5 text-right font-semibold text-gray-600">{a.codigo} · {a.nombre}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtradas.map(s => (
                  <tr key={s.cuenta} className="hoverable">
                    <td className="px-3 py-2 font-mono text-gray-700">{s.cuenta}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-44 truncate">{s.nombre}</td>
                    {AJUSTES.map((a, i) => {
                      const aj = AJUSTES_MOCK[s.cuenta]?.[i];
                      return (
                        <td key={a.codigo} className="px-3 py-2 text-right font-mono">
                          <div className="text-gray-800">{aj && aj.debito > 0 ? fmtCOP(aj.debito) : <span className="text-gray-300">·</span>}</div>
                          <div className="text-gray-400">{aj && aj.credito > 0 ? fmtCOP(aj.credito) : <span className="text-gray-300">·</span>}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-700">TOTALES POR AJUSTE</td>
                  {totalesAjustes.map((m, i) => (
                    <td key={i} className="px-3 py-2 text-right font-mono">
                      <div className="text-gray-800 font-semibold">{m.debito > 0 ? fmtCOP(m.debito) : <span className="text-gray-300">·</span>}</div>
                      <div className="text-gray-500 font-semibold">{m.credito > 0 ? fmtCOP(m.credito) : <span className="text-gray-300">·</span>}</div>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          )}
        </div>
        {filtradas.length === 0 && (
          <div className="px-4 py-10 text-center">
            <div className="text-2xl mb-2 text-gray-300">⊟</div>
            <div className="text-xs text-gray-500">Sin resultados — no hay cuentas que coincidan con la búsqueda.</div>
          </div>
        )}
      </div>

      {pestana === 'ajustes' && (
        <p className="text-xs text-gray-400">
          Períodos 13 a 18: columnas de ajuste posteriores al cierre anual. Cada columna cuadra por construcción (débito = crédito). Datos de ejemplo.
        </p>
      )}

      {showExport && <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />}
    </div>
  );
}
