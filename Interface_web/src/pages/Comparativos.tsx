import { useState } from 'react';
import { fmtCOP } from '../data/mock';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const SELECT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

type Tab = 'contabilidades' | 'centros' | 'meses';

interface FilaComparativo {
  clave: string;
  nombre: string;
  aDebito: number;
  aCredito: number;
  bDebito: number;
  bCredito: number;
}

// Febrero contabilidad 001 (libro real + complemento NOM2, cuadrado).
const FEB_001: FilaComparativo[] = [
  { clave: '110505', nombre: 'Caja general', aDebito: 0, aCredito: 390000, bDebito: 0, bCredito: 0 },
  { clave: '111005', nombre: 'Bancos moneda nacional', aDebito: 8500000, aCredito: 4100000, bDebito: 8200000, bCredito: 4100000 },
  { clave: '130505', nombre: 'Clientes nacionales', aDebito: 4100000, aCredito: 8500000, bDebito: 4400000, bCredito: 8200000 },
  { clave: '236540', nombre: 'Retenciones y aportes de nómina', aDebito: 0, aCredito: 1200000, bDebito: 0, bCredito: 1200000 },
  { clave: '250505', nombre: 'Salarios por pagar', aDebito: 0, aCredito: 11400000, bDebito: 0, bCredito: 11400000 },
  { clave: '510506', nombre: 'Sueldos y salarios', aDebito: 12990000, aCredito: 0, bDebito: 12990000, bCredito: 0 },
];

// Centros de febrero (nómina con centro), 001 vs 002.
const CENTROS_FEB: FilaComparativo[] = [
  { clave: 'ADM', nombre: 'Administración', aDebito: 6500000, aCredito: 5300000, bDebito: 6500000, bCredito: 5300000 },
  { clave: 'VEN', nombre: 'Ventas', aDebito: 3200000, aCredito: 3200000, bDebito: 3200000, bCredito: 3200000 },
  { clave: 'OPE', nombre: 'Operaciones', aDebito: 3290000, aCredito: 2900000, bDebito: 2900000, bCredito: 2900000 },
];

// Enero contabilidad 001.
const ENE_001: FilaComparativo[] = [
  { clave: '110505', nombre: 'Caja general', aDebito: 0, aCredito: 390000, bDebito: 0, bCredito: 0 },
  { clave: '111005', nombre: 'Bancos moneda nacional', aDebito: 12000000, aCredito: 17250000, bDebito: 0, bCredito: 0 },
  { clave: '130505', nombre: 'Clientes nacionales', aDebito: 3200000, aCredito: 12000000, bDebito: 0, bCredito: 0 },
  { clave: '236540', nombre: 'Retenciones y aportes de nómina', aDebito: 1200000, aCredito: 1200000, bDebito: 0, bCredito: 0 },
  { clave: '240805', nombre: 'IVA por pagar', aDebito: 2850000, aCredito: 0, bDebito: 0, bCredito: 0 },
  { clave: '250505', nombre: 'Salarios por pagar', aDebito: 10000000, aCredito: 11400000, bDebito: 0, bCredito: 0 },
  { clave: '510506', nombre: 'Sueldos y salarios', aDebito: 11790000, aCredito: 0, bDebito: 0, bCredito: 0 },
];

const TAB_LABEL: Record<Tab, string> = {
  contabilidades: 'Contabilidades',
  centros: 'Centros',
  meses: 'Meses',
};

function exportarDiferencias(filas: FilaComparativo[], nombre: string) {
  const cabecera = 'clave;nombre;a_debito;a_credito;b_debito;b_credito;dif_debito;dif_credito';
  const lineas = filas
    .filter(f => f.aDebito !== f.bDebito || f.aCredito !== f.bCredito)
    .map(f => [f.clave, f.nombre, f.aDebito, f.aCredito, f.bDebito, f.bCredito, f.aDebito - f.bDebito, f.aCredito - f.bCredito].join(';'));
  const blob = new Blob([cabecera + '\n' + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Comparativos() {
  const [tab, setTab] = useState<Tab>('contabilidades');
  const [mesA, setMesA] = useState('2026-01');
  const [mesB, setMesB] = useState('2026-02');
  const [exportado, setExportado] = useState<string | null>(null);

  let filas: FilaComparativo[];
  let columnaA: string;
  let columnaB: string;

  if (tab === 'contabilidades') {
    filas = FEB_001;
    columnaA = '001 — Febrero 2026';
    columnaB = '002 — Febrero 2026';
  } else if (tab === 'centros') {
    filas = CENTROS_FEB;
    columnaA = '001 — Febrero 2026';
    columnaB = '002 — Febrero 2026';
  } else {
    const esFeb = mesA === '2026-02' && mesB === '2026-01';
    filas = esFeb
      ? FEB_001.map(f => ({ ...f, bDebito: ENE_001.find(e => e.clave === f.clave)?.aDebito ?? 0, bCredito: ENE_001.find(e => e.clave === f.clave)?.aCredito ?? 0 }))
      : ENE_001.map(f => ({ ...f, bDebito: FEB_001.find(e => e.clave === f.clave)?.aDebito ?? 0, bCredito: FEB_001.find(e => e.clave === f.clave)?.aCredito ?? 0 }));
    columnaA = mesA;
    columnaB = mesB;
  }

  const diferencias = filas.filter(f => f.aDebito !== f.bDebito || f.aCredito !== f.bCredito);
  const totalDifDeb = diferencias.reduce((s, f) => s + Math.abs(f.aDebito - f.bDebito), 0);
  const totalDifCred = diferencias.reduce((s, f) => s + Math.abs(f.aCredito - f.bCredito), 0);

  function exportar() {
    exportarDiferencias(filas, `diferencias_${tab}_${new Date().toISOString().slice(0, 10)}.csv`);
    setExportado(`${diferencias.length} filas con diferencia exportadas a CSV.`);
  }

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Consultas / Comparativos</div>
          <h1 className="text-lg font-semibold text-gray-800">Comparativos</h1>
          <p className="mt-1 text-xs text-gray-500">Comparativos entre dos contabilidades, dos centros o dos meses, con la diferencia resaltada.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
          <button type="button" onClick={exportar} className={BUTTON_PRIMARY + ' text-xs! px-3! py-1.5!'}>
            ↓ Exportar diferencias
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        {(Object.keys(TAB_LABEL) as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === t ? 'border-petroleum-500 text-petroleum-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === 'meses' && (
        <div className="bg-white rounded border border-gray-200 p-3">
          <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
            <legend className="px-2 text-xs font-semibold text-petroleum-800">Meses a comparar (contabilidad 001)</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">Mes A</label>
                <select value={mesA} onChange={e => setMesA(e.target.value)} className={SELECT}>
                  <option value="2026-01">2026-01 Enero</option>
                  <option value="2026-02">2026-02 Febrero</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">Mes B</label>
                <select value={mesB} onChange={e => setMesB(e.target.value)} className={SELECT}>
                  <option value="2026-01">2026-01 Enero</option>
                  <option value="2026-02">2026-02 Febrero</option>
                </select>
              </div>
              {mesA === mesB && <p className="self-end text-xs text-red-600">Seleccione dos meses distintos.</p>}
            </div>
          </fieldset>
        </div>
      )}

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600" colSpan={2}>Cuenta / Centro</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600 border-l border-gray-200" colSpan={2}>{columnaA}</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600 border-l border-gray-200" colSpan={2}>{columnaB}</th>
                <th className="px-3 py-2.5 text-center font-semibold text-red-700 border-l border-gray-200" colSpan={2}>Diferencia</th>
              </tr>
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Código</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Nombre</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-500 border-l border-gray-200">Débito</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-500">Crédito</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-500 border-l border-gray-200">Débito</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-500">Crédito</th>
                <th className="px-3 py-2 text-right font-semibold text-red-600 border-l border-gray-200">Débito</th>
                <th className="px-3 py-2 text-right font-semibold text-red-600">Crédito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filas.map(f => {
                const difDeb = f.aDebito - f.bDebito;
                const difCred = f.aCredito - f.bCredito;
                const conDiferencia = difDeb !== 0 || difCred !== 0;
                return (
                  <tr key={f.clave} className={`hoverable ${conDiferencia ? 'row-error' : ''}`}>
                    <td className="px-3 py-2 font-mono text-gray-700">{f.clave}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-48 truncate">{f.nombre}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-800 border-l border-gray-100">{f.aDebito > 0 ? fmtCOP(f.aDebito) : <span className="text-gray-200">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-500">{f.aCredito > 0 ? fmtCOP(f.aCredito) : <span className="text-gray-200">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-800 border-l border-gray-100">{f.bDebito > 0 ? fmtCOP(f.bDebito) : <span className="text-gray-200">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-500">{f.bCredito > 0 ? fmtCOP(f.bCredito) : <span className="text-gray-200">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-red-600 border-l border-gray-100">{difDeb !== 0 ? fmtCOP(difDeb) : <span className="text-gray-200">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-red-600">{difCred !== 0 ? fmtCOP(difCred) : <span className="text-gray-200">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={6} className="px-3 py-2 text-xs font-semibold text-gray-700">DIFERENCIAS ABSOLUTAS ({diferencias.length} fila{diferencias.length !== 1 ? 's' : ''})</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-red-600 border-l border-gray-200">{totalDifDeb > 0 ? fmtCOP(totalDifDeb) : '—'}</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-red-600">{totalDifCred > 0 ? fmtCOP(totalDifCred) : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {tab === 'contabilidades' && (
        <p className="text-xs text-gray-400">
          Contabilidad 002 — Compañía Demo S.A.S. (consolidación): datos de ejemplo con diferencias frente a la 001. Las filas con diferencia se resaltan en rojo.
        </p>
      )}

      {exportado && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          ✓ {exportado}
        </div>
      )}
    </div>
  );
}
