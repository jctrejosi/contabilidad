import { useMemo, useState } from 'react';
import { CENTROS, CUENTAS, MOVIMIENTOS_FEB, fmtCOP } from '../data/mock';
import type { MovimientoLinea } from '../types';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const SELECT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const ABC = { nit: '800.100.200', nombre: 'Empresa ABC Comercial S.A.S.' };
const XYZ = { nit: '900.200.300', nombre: 'Comercial XYZ Distribuciones Ltda.' };
const STN = { nit: '860.050.010', nombre: 'Suministros Técnicos del Norte Ltda.' };
const GARCIA = { nit: '12.345.678', nombre: 'García Moreno Juan Pablo' };
const LOPEZ = { nit: '23.456.789', nombre: 'López Vargas María Fernanda' };
const MARTINEZ = { nit: '34.567.890', nombre: 'Martínez Rojas Ana Lucía' };

function nombreCuenta(codigo: string): string {
  return CUENTAS.find(c => c.codigo === codigo)?.nombre ?? codigo;
}

/** Movimientos anuales coherentes: febrero real (MOVIMIENTOS_FEB + complemento NOM2) y mocks locales cuadrados para los demás meses. */
function generarMovs(): MovimientoLinea[] {
  const out: MovimientoLinea[] = [];
  let seq = 0;
  const add = (mes: number, dia: number, comprobante: string, tipoDoc: string, documento: string, cuenta: string, nit: string, tercero: string, centro: string, debito: number, credito: number, concepto: string, origen: string, lote: string, docAfectado = '') => {
    seq += 1;
    out.push({
      id: `G${String(seq).padStart(3, '0')}`,
      periodo: `2026-${String(mes).padStart(2, '0')}`,
      fecha: `2026-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
      comprobante, tipoDoc, documento, cuenta, nombreCuenta: nombreCuenta(cuenta),
      nit, tercero, centro, debito, credito, base: 0, clase: cuenta === '236540' ? 'RETFTE' : '', docAfectado, concepto, origen, lote,
    });
  };

  out.push(...MOVIMIENTOS_FEB);
  const C = (mes: number, dia: number, comprobante: string, tipoDoc: string, documento: string, cuenta: string, nit: string, tercero: string, centro: string, debito: number, credito: number, concepto: string) => {
    seq += 1;
    out.push({
      id: `C${String(seq).padStart(3, '0')}`,
      periodo: `2026-${String(mes).padStart(2, '0')}`,
      fecha: `2026-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
      comprobante, tipoDoc, documento, cuenta, nombreCuenta: nombreCuenta(cuenta),
      nit, tercero, centro, debito, credito, base: 0, clase: cuenta === '236540' ? 'RETFTE' : '', docAfectado: '', concepto, origen: 'Nómina', lote: 'NOM2',
    });
  };
  C(2, 28, 'CE-000245', 'NOM', 'NOM-2026-02', '510506', GARCIA.nit, GARCIA.nombre, 'ADM', 800000, 0, 'Prestaciones febrero ADM');
  C(2, 28, 'CE-000245', 'NOM', 'NOM-2026-02', '510506', MARTINEZ.nit, MARTINEZ.nombre, 'OPE', 600000, 0, 'Prestaciones febrero OPE');
  C(2, 28, 'CE-000245', 'NOM', 'NOM-2026-02', '510506', GARCIA.nit, GARCIA.nombre, 'ADM', 1200000, 0, 'Aportes seguridad social feb');
  C(2, 28, 'CE-000245', 'NOM', 'NOM-2026-02', '250505', GARCIA.nit, GARCIA.nombre, 'ADM', 0, 800000, 'Prestaciones por pagar feb ADM');
  C(2, 28, 'CE-000245', 'NOM', 'NOM-2026-02', '250505', MARTINEZ.nit, MARTINEZ.nombre, 'OPE', 0, 600000, 'Prestaciones por pagar feb OPE');
  C(2, 20, 'CE-000246', 'RB', 'RB-2026-006', '510506', MARTINEZ.nit, MARTINEZ.nombre, 'OPE', 390000, 0, 'Reembolso caja menor transporte');
  C(2, 20, 'CE-000246', 'RB', 'RB-2026-006', '110505', '', '', '', 0, 390000, 'Reembolso caja menor');

  add(1, 8, 'CI-000143', 'FV', 'FV-2026-008', '111005', ABC.nit, ABC.nombre, '', 7500000, 0, 'Recaudo factura ventas', 'Manual', 'CI-003', 'FV-2025-140');
  add(1, 8, 'CI-000143', 'FV', 'FV-2026-008', '130505', ABC.nit, ABC.nombre, '', 0, 7500000, 'Recaudo factura ventas', 'Manual', 'CI-003', 'FV-2025-140');
  add(1, 20, 'CI-000144', 'FV', 'FV-2026-009', '111005', XYZ.nit, XYZ.nombre, '', 4500000, 0, 'Recaudo factura ventas', 'Manual', 'CI-003', 'FV-2025-141');
  add(1, 20, 'CI-000144', 'FV', 'FV-2026-009', '130505', XYZ.nit, XYZ.nombre, '', 0, 4500000, 'Recaudo factura ventas', 'Manual', 'CI-003', 'FV-2025-141');
  add(1, 15, 'CE-000241', 'OR', 'OR-2026-021', '111005', STN.nit, STN.nombre, '', 0, 3200000, 'Pago proveedor materiales', 'Manual', 'CE-001');
  add(1, 15, 'CE-000241', 'OR', 'OR-2026-021', '130505', STN.nit, STN.nombre, '', 3200000, 0, 'Pago proveedor materiales', 'Manual', 'CE-001');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '510506', GARCIA.nit, GARCIA.nombre, 'ADM', 4500000, 0, 'Sueldo enero Administración', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '510506', LOPEZ.nit, LOPEZ.nombre, 'VEN', 3200000, 0, 'Sueldo enero Ventas', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '510506', MARTINEZ.nit, MARTINEZ.nombre, 'OPE', 2300000, 0, 'Sueldo enero Operaciones', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '510506', GARCIA.nit, GARCIA.nombre, 'ADM', 1400000, 0, 'Prestaciones enero ADM', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '510506', GARCIA.nit, GARCIA.nombre, 'ADM', 1200000, 0, 'Aportes seguridad social ene', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '250505', GARCIA.nit, GARCIA.nombre, 'ADM', 0, 4500000, 'Obligación nómina ene ADM', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '250505', LOPEZ.nit, LOPEZ.nombre, 'VEN', 0, 3200000, 'Obligación nómina ene VEN', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '250505', MARTINEZ.nit, MARTINEZ.nombre, 'OPE', 0, 2300000, 'Obligación nómina ene OPE', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '250505', GARCIA.nit, GARCIA.nombre, 'ADM', 0, 1400000, 'Prestaciones por pagar ene ADM', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '236540', '', '', '', 0, 1200000, 'Retención nómina enero', 'Nómina', 'NOM1');
  add(1, 31, 'NO-000087', 'NO', 'NO-2026-087', '250505', '', '', '', 10000000, 0, 'Pago nómina enero', 'Manual', 'NO-001');
  add(1, 31, 'NO-000087', 'NO', 'NO-2026-087', '111005', '', '', '', 0, 10000000, 'Pago nómina enero', 'Manual', 'NO-001');
  add(1, 31, 'NO-000088', 'NO', 'NO-2026-088', '236540', '', '', '', 1200000, 0, 'Pago retención enero', 'Manual', 'NO-001');
  add(1, 31, 'NO-000088', 'NO', 'NO-2026-088', '111005', '', '', '', 0, 1200000, 'Pago retención enero', 'Manual', 'NO-001');
  add(1, 31, 'NO-000089', 'NO', 'NO-2026-089', '240805', '', '', '', 2850000, 0, 'Pago IVA bimestre nov-dic', 'Manual', 'NO-001');
  add(1, 31, 'NO-000089', 'NO', 'NO-2026-089', '111005', '', '', '', 0, 2850000, 'Pago IVA bimestre nov-dic', 'Manual', 'NO-001');
  add(1, 22, 'CE-000241', 'RB', 'RB-2026-005', '510506', MARTINEZ.nit, MARTINEZ.nombre, 'OPE', 390000, 0, 'Reembolso caja menor', 'Manual', 'CE-001');
  add(1, 22, 'CE-000241', 'RB', 'RB-2026-005', '110505', '', '', '', 0, 390000, 'Reembolso caja menor', 'Manual', 'CE-001');

  let sueldoPrevio = 12600000;
  for (let m = 3; m <= 12; m += 1) {
    const recaudo = 6500000 + m * 300000;
    const pagoProv = 2600000 + m * 200000;
    const sueldo = m === 6 || m === 12 ? 13500000 : 12100000;
    const tRecaudo = m % 2 === 0 ? ABC : XYZ;
    const tCaja = m % 2 === 0 ? GARCIA : MARTINEZ;
    const centroCaja = m % 2 === 0 ? 'ADM' : 'OPE';
    const mes = String(m).padStart(2, '0');

    add(m, 5, `CI-0001${44 + m}`, 'FV', `FV-2026-0${10 + m}`, '111005', tRecaudo.nit, tRecaudo.nombre, '', recaudo, 0, 'Recaudo factura ventas', 'Manual', 'CI-003', `FV-2026-0${10 + m - 1}`);
    add(m, 5, `CI-0001${44 + m}`, 'FV', `FV-2026-0${10 + m}`, '130505', tRecaudo.nit, tRecaudo.nombre, '', 0, recaudo, 'Recaudo factura ventas', 'Manual', 'CI-003', `FV-2026-0${10 + m - 1}`);
    add(m, 15, `CE-0002${44 + m}`, 'OR', `OR-2026-0${20 + m}`, '111005', STN.nit, STN.nombre, '', 0, pagoProv, 'Pago proveedor materiales', 'Manual', 'CE-001');
    add(m, 15, `CE-0002${44 + m}`, 'OR', `OR-2026-0${20 + m}`, '130505', STN.nit, STN.nombre, '', pagoProv, 0, 'Pago proveedor materiales', 'Manual', 'CE-001');
    add(m, 28, `CE-0002${45 + m}`, 'NOM', `NOM-2026-${mes}`, '510506', GARCIA.nit, GARCIA.nombre, 'ADM', Math.round(sueldo * 0.42), 0, `Sueldo mes ${m} Administración`, 'Nómina', `NOM${m}`);
    add(m, 28, `CE-0002${45 + m}`, 'NOM', `NOM-2026-${mes}`, '510506', LOPEZ.nit, LOPEZ.nombre, 'VEN', Math.round(sueldo * 0.3), 0, `Sueldo mes ${m} Ventas`, 'Nómina', `NOM${m}`);
    add(m, 28, `CE-0002${45 + m}`, 'NOM', `NOM-2026-${mes}`, '510506', MARTINEZ.nit, MARTINEZ.nombre, 'OPE', Math.round(sueldo * 0.28), 0, `Sueldo mes ${m} Operaciones`, 'Nómina', `NOM${m}`);
    add(m, 28, `CE-0002${45 + m}`, 'NOM', `NOM-2026-${mes}`, '250505', GARCIA.nit, GARCIA.nombre, 'ADM', 0, Math.round(sueldo * 0.42), `Obligación nómina mes ${m} ADM`, 'Nómina', `NOM${m}`);
    add(m, 28, `CE-0002${45 + m}`, 'NOM', `NOM-2026-${mes}`, '250505', LOPEZ.nit, LOPEZ.nombre, 'VEN', 0, Math.round(sueldo * 0.3), `Obligación nómina mes ${m} VEN`, 'Nómina', `NOM${m}`);
    add(m, 28, `CE-0002${45 + m}`, 'NOM', `NOM-2026-${mes}`, '250505', MARTINEZ.nit, MARTINEZ.nombre, 'OPE', 0, Math.round(sueldo * 0.28), `Obligación nómina mes ${m} OPE`, 'Nómina', `NOM${m}`);
    add(m, 28, `CE-0002${45 + m}`, 'NOM', `NOM-2026-${mes}`, '510506', GARCIA.nit, GARCIA.nombre, 'ADM', 1200000, 0, 'Aportes seguridad social', 'Nómina', `NOM${m}`);
    add(m, 28, `CE-0002${45 + m}`, 'NOM', `NOM-2026-${mes}`, '236540', '', '', '', 0, 1200000, 'Aportes por pagar', 'Nómina', `NOM${m}`);
    add(m, 28, `CE-0002${45 + m}`, 'NOM', `NOM-2026-${mes}`, '510506', GARCIA.nit, GARCIA.nombre, 'ADM', 800000, 0, 'Prestaciones ADM', 'Nómina', `NOM${m}`);
    add(m, 28, `CE-0002${45 + m}`, 'NOM', `NOM-2026-${mes}`, '510506', MARTINEZ.nit, MARTINEZ.nombre, 'OPE', 600000, 0, 'Prestaciones OPE', 'Nómina', `NOM${m}`);
    add(m, 28, `CE-0002${45 + m}`, 'NOM', `NOM-2026-${mes}`, '250505', GARCIA.nit, GARCIA.nombre, 'ADM', 0, 800000, 'Prestaciones por pagar ADM', 'Nómina', `NOM${m}`);
    add(m, 28, `CE-0002${45 + m}`, 'NOM', `NOM-2026-${mes}`, '250505', MARTINEZ.nit, MARTINEZ.nombre, 'OPE', 0, 600000, 'Prestaciones por pagar OPE', 'Nómina', `NOM${m}`);
    add(m, 28, `NO-0000${86 + m}`, 'NO', `NO-2026-0${86 + m}`, '250505', '', '', '', sueldoPrevio, 0, `Pago nómina mes ${m - 1}`, 'Manual', 'NO-001');
    add(m, 28, `NO-0000${86 + m}`, 'NO', `NO-2026-0${86 + m}`, '111005', '', '', '', 0, sueldoPrevio, `Pago nómina mes ${m - 1}`, 'Manual', 'NO-001');
    add(m, 30, `NO-0000${87 + m}`, 'NO', `NO-2026-0${87 + m}`, '236540', '', '', '', 1200000, 0, 'Pago retención del mes', 'Manual', 'NO-001');
    add(m, 30, `NO-0000${87 + m}`, 'NO', `NO-2026-0${87 + m}`, '111005', '', '', '', 0, 1200000, 'Pago retención del mes', 'Manual', 'NO-001');
    if (m % 2 === 1) {
      add(m, 30, `NO-0000${88 + m}`, 'NO', `NO-2026-0${88 + m}`, '240805', '', '', '', 2850000, 0, 'Pago IVA bimestral', 'Manual', 'NO-001');
      add(m, 30, `NO-0000${88 + m}`, 'NO', `NO-2026-0${88 + m}`, '111005', '', '', '', 0, 2850000, 'Pago IVA bimestral', 'Manual', 'NO-001');
    }
    add(m, 20, `CE-0002${46 + m}`, 'RB', `RB-2026-0${6 + m}`, '510506', tCaja.nit, tCaja.nombre, centroCaja, 390000, 0, 'Reembolso caja menor', 'Manual', 'CE-001');
    add(m, 20, `CE-0002${46 + m}`, 'RB', `RB-2026-0${6 + m}`, '110505', '', '', '', 0, 390000, 'Reembolso caja menor', 'Manual', 'CE-001');
    sueldoPrevio = sueldo;
  }

  return out;
}

export default function AnualCentro() {
  const [centroSel, setCentroSel] = useState('ADM');
  const [expandido, setExpandido] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);

  const movs = useMemo(generarMovs, []);
  const centro = CENTROS.find(c => c.codigo === centroSel);
  const lineasCentro = movs.filter(m => m.centro === centroSel);

  const meses = MESES.map((nombre, i) => {
    const mes = i + 1;
    const delMes = lineasCentro.filter(m => Number(m.fecha.slice(5, 7)) === mes);
    return {
      nombre,
      mes,
      debito: delMes.reduce((s, l) => s + l.debito, 0),
      credito: delMes.reduce((s, l) => s + l.credito, 0),
      lineas: delMes,
    };
  });

  const totalDeb = meses.reduce((s, m) => s + m.debito, 0);
  const totalCred = meses.reduce((s, m) => s + m.credito, 0);
  const saldoFinal = totalDeb - totalCred;

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Consultas / Anual por centro de costo</div>
          <h1 className="text-lg font-semibold text-gray-800">Anual por centro de costo</h1>
          <p className="mt-1 text-xs text-gray-500">Movimiento anual por centro de costo con drill-down mensual.</p>
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

      <div className="bg-white rounded border border-gray-200 p-3">
        <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
          <legend className="px-2 text-xs font-semibold text-petroleum-800">Filtros</legend>
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Centro de costo</label>
              <select value={centroSel} onChange={e => { setCentroSel(e.target.value); setExpandido(null); }} className={SELECT}>
                {CENTROS.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Año</label>
              <input value="2026" readOnly className={INPUT} />
            </div>
          </div>
          {centro && (
            <p className="mt-2 text-xs text-gray-500">Nivel {centro.nivel} · Las líneas sin centro de costo no aparecen en esta consulta.</p>
          )}
        </fieldset>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Mes</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Débito</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Crédito</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Saldo del mes</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Saldo acumulado</th>
                <th className="px-3 py-2.5 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {meses.map((m, i) => {
                const acumulado = meses.slice(0, i + 1).reduce((s, x) => s + x.debito - x.credito, 0);
                return (
                  <FilaMes
                    key={m.mes}
                    mes={m.nombre}
                    debito={m.debito}
                    credito={m.credito}
                    acumulado={acumulado}
                    expandido={expandido === m.mes}
                    onToggle={() => setExpandido(expandido === m.mes ? null : m.mes)}
                    lineas={m.lineas}
                    centro={centroSel}
                  />
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td className="px-3 py-2 text-xs font-semibold text-gray-700">TOTAL AÑO</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(totalDeb)}</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(totalCred)}</td>
                <td />
                <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(saldoFinal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {lineasCentro.length === 0 && (
          <div className="px-4 py-10 text-center">
            <div className="text-2xl mb-2 text-gray-300">⊟</div>
            <div className="text-xs text-gray-500">Sin resultados — este centro no tiene movimiento en el año.</div>
          </div>
        )}
      </div>

      {showExport && <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />}
    </div>
  );
}

function FilaMes({ mes, debito, credito, acumulado, expandido, onToggle, lineas, centro }: {
  mes: string;
  debito: number;
  credito: number;
  acumulado: number;
  expandido: boolean;
  onToggle: () => void;
  lineas: MovimientoLinea[];
  centro: string;
}) {
  const saldoMes = debito - credito;
  return (
    <>
      <tr className="hoverable cursor-pointer" onClick={onToggle}>
        <td className="px-3 py-2 font-medium text-gray-700">
          <span className="text-gray-400 mr-1.5">{expandido ? '▾' : '▸'}</span>{mes}
        </td>
        <td className="px-3 py-2 text-right font-mono text-gray-800">{debito > 0 ? fmtCOP(debito) : <span className="text-gray-200">—</span>}</td>
        <td className="px-3 py-2 text-right font-mono text-gray-500">{credito > 0 ? fmtCOP(credito) : <span className="text-gray-200">—</span>}</td>
        <td className={`px-3 py-2 text-right font-mono ${saldoMes >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{saldoMes !== 0 ? fmtCOP(saldoMes) : <span className="text-gray-200">—</span>}</td>
        <td className="px-3 py-2 text-right font-mono font-medium text-gray-800">{fmtCOP(acumulado)}</td>
        <td className="px-3 py-2 text-right">
          <button type="button" onClick={e => { e.stopPropagation(); onToggle(); }} className="text-xs text-petroleum-600 hover:underline">
            {expandido ? 'Ocultar' : 'Ver detalle'}
          </button>
        </td>
      </tr>
      {expandido && (
        <tr>
          <td colSpan={6} className="px-3 py-3 bg-gray-50/60">
            {lineas.length === 0 ? (
              <div className="text-center py-4 text-xs text-gray-500">Sin movimientos en {mes.toLowerCase()} para el centro {centro}.</div>
            ) : (
              <div className="rounded border border-gray-200 bg-white overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Fecha</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Comprobante</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Documento</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Cuenta</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Tercero</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600">Débito</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600">Crédito</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Concepto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lineas.map(l => (
                      <tr key={l.id}>
                        <td className="px-3 py-1.5 font-mono text-gray-600">{l.fecha}</td>
                        <td className="px-3 py-1.5 font-mono text-gray-700">{l.comprobante}</td>
                        <td className="px-3 py-1.5 font-mono text-gray-600">{l.documento}</td>
                        <td className="px-3 py-1.5 font-mono text-gray-700">{l.cuenta} · <span className="font-sans text-gray-500">{l.nombreCuenta}</span></td>
                        <td className="px-3 py-1.5 text-gray-600 max-w-44 truncate">{l.tercero || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-gray-800">{l.debito > 0 ? fmtCOP(l.debito) : <span className="text-gray-200">—</span>}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-gray-500">{l.credito > 0 ? fmtCOP(l.credito) : <span className="text-gray-200">—</span>}</td>
                        <td className="px-3 py-1.5 text-gray-500">{l.concepto}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
