import { useState, type ReactNode } from 'react';
import { CUENTAS, TERCEROS, CENTROS, COMPROBANTES, MOVIMIENTOS_FEB, USUARIO, fmtCOP } from '../data/mock';
import type { Lote, LoteLinea, MovimientoLinea } from '../types';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600';

interface Linea {
  id: number;
  cuenta: string;
  nombreCuenta: string;
  nit: string;
  tercero: string;
  centro: string;
  documento: string;
  debito: string;
  credito: string;
  base: string;
  concepto: string;
}

let lineId = 1;
function newLine(): Linea {
  return { id: lineId++, cuenta: '', nombreCuenta: '', nit: '', tercero: '', centro: '', documento: '', debito: '', credito: '', base: '', concepto: '' };
}

function parseCOP(s: string): number {
  return parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
}

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

interface PlantillaLinea {
  cuenta: string;
  tercero: string;
  centro: string;
  debito: string;
  credito: string;
  base: string;
  concepto: string;
}

const PLANTILLAS: { id: string; nombre: string; descripcion: string; lineas: PlantillaLinea[] }[] = [
  {
    id: 'nomina',
    nombre: 'Nómina mensual',
    descripcion: 'Sueldo, obligación laboral y retención de nómina. Cuadrada: 4.500.000 = 4.500.000.',
    lineas: [
      { cuenta: '510506', tercero: 'García Moreno Juan Pablo', centro: 'ADM', debito: '4500000', credito: '', base: '', concepto: 'Sueldo febrero Administración' },
      { cuenta: '250505', tercero: 'García Moreno Juan Pablo', centro: 'ADM', debito: '', credito: '3900000', base: '', concepto: 'Obligación nómina febrero' },
      { cuenta: '236540', tercero: '', centro: '', debito: '', credito: '600000', base: '4500000', concepto: 'Retención aportes de nómina' },
    ],
  },
  {
    id: 'compra-iva',
    nombre: 'Compra con IVA y retención',
    descripcion: 'Gasto + IVA descontable − retención, pago neto por banco. Cuadrada: 1.190.000 = 1.190.000.',
    lineas: [
      { cuenta: '510506', tercero: 'Comercial XYZ Distribuciones Ltda.', centro: 'ADM', debito: '1000000', credito: '', base: '', concepto: 'Compra de servicios administrativos' },
      { cuenta: '240805', tercero: 'Comercial XYZ Distribuciones Ltda.', centro: '', debito: '190000', credito: '', base: '1000000', concepto: 'IVA 19% descontable' },
      { cuenta: '236540', tercero: 'Comercial XYZ Distribuciones Ltda.', centro: '', debito: '', credito: '25000', base: '1000000', concepto: 'Retención en la fuente 2,5%' },
      { cuenta: '111005', tercero: '', centro: '', debito: '', credito: '1165000', base: '', concepto: 'Pago neto por banco' },
    ],
  },
  {
    id: 'pago-banco',
    nombre: 'Pago por banco',
    descripcion: 'Pago de obligación laboral con egreso bancario. Cuadrada: 1.500.000 = 1.500.000.',
    lineas: [
      { cuenta: '250505', tercero: 'López Vargas María Fernanda', centro: '', debito: '1500000', credito: '', base: '', concepto: 'Pago obligación laboral' },
      { cuenta: '111005', tercero: '', centro: '', debito: '', credito: '1500000', base: '', concepto: 'Egreso bancario' },
    ],
  },
];

const FILAS_PORTAPAPELES: PlantillaLinea[] = [
  { cuenta: '510506', tercero: 'López Vargas María Fernanda', centro: 'ADM', debito: '1200000', credito: '', base: '', concepto: 'Servicios administrativos' },
  { cuenta: '510506', tercero: 'Martínez Rojas Ana Lucía', centro: 'VEN', debito: '800000', credito: '', base: '', concepto: 'Servicios ventas' },
  { cuenta: '250505', tercero: 'López Vargas María Fernanda', centro: '', debito: '', credito: '2000000', base: '', concepto: 'Provisión servicios' },
];

let cdCounter = 1;

export default function CapturaDirecta({ onCrearLote }: { onCrearLote?: (l: Lote) => void }) {
  const [periodo, setPeriodo] = useState('2026-02');
  const [fecha, setFecha] = useState('2026-02-28');
  const [comprobante, setComprobante] = useState('CE');
  const [tipoDoc, setTipoDoc] = useState('');
  const [numDoc, setNumDoc] = useState('');
  const [terceroHdr, setTerceroHdr] = useState('');
  const [concepto, setConcepto] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([newLine(), newLine()]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [posted, setPosted] = useState(false);
  const [showCuentaPicker, setShowCuentaPicker] = useState<number | null>(null);
  const [cuentaSearch, setCuentaSearch] = useState('');
  const [showPlantilla, setShowPlantilla] = useState(false);
  const [showExcel, setShowExcel] = useState(false);
  const [showCargarDoc, setShowCargarDoc] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const cuentasAfectables = CUENTAS.filter(c => c.afectable);

  const totalDeb = lineas.reduce((s, l) => s + parseCOP(l.debito), 0);
  const totalCred = lineas.reduce((s, l) => s + parseCOP(l.credito), 0);
  const diff = totalDeb - totalCred;
  const isBalanced = diff === 0 && totalDeb > 0;

  function erroresLinea(l: Linea): string[] {
    const e: string[] = [];
    if (!l.cuenta.trim()) return e;
    const cuenta = CUENTAS.find(c => c.codigo === l.cuenta);
    if (!cuenta) {
      e.push('La cuenta no existe en el plan de cuentas');
      return e;
    }
    if (!cuenta.afectable) e.push('La cuenta no es afectable');
    if (cuenta.requiereTercero && !l.tercero) e.push('La cuenta requiere tercero');
    if (cuenta.requiereCentro && !l.centro) e.push('La cuenta requiere centro de costo');
    if (cuenta.requiereBase && parseCOP(l.base) <= 0) e.push('La cuenta requiere base');
    return e;
  }

  const lineasConError = lineas.filter(l => erroresLinea(l).length > 0);
  const totalErrores = lineas.reduce((s, l) => s + erroresLinea(l).length, 0);
  const sinErrores = totalErrores === 0;
  const puedePostear = isBalanced && sinErrores && !posted;

  function updateLine(id: number, field: keyof Linea, value: string) {
    setLineas(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      if (field === 'cuenta') {
        const cuenta = cuentasAfectables.find(c => c.codigo === value);
        if (cuenta) updated.nombreCuenta = cuenta.nombre;
      }
      if (field === 'tercero') {
        const t = TERCEROS.find(t => t.nombre === value);
        if (t) updated.nit = t.nit;
      }
      return updated;
    }));
    setShowCuentaPicker(null);
  }

  function addLine() {
    setLineas(prev => [...prev, newLine()]);
  }

  function deleteLine(id: number) {
    setLineas(prev => prev.filter(l => l.id !== id));
  }

  const filteredCuentas = cuentasAfectables.filter(c => {
    const q = cuentaSearch.toLowerCase();
    return c.codigo.includes(q) || c.nombre.toLowerCase().includes(q);
  });

  function insertarPlantilla(pls: PlantillaLinea[]) {
    const nuevas: Linea[] = pls.map(p => {
      const cuenta = cuentasAfectables.find(c => c.codigo === p.cuenta);
      const l = newLine();
      return {
        ...l,
        cuenta: p.cuenta,
        nombreCuenta: cuenta?.nombre ?? '',
        tercero: p.tercero,
        nit: TERCEROS.find(t => t.nombre === p.tercero)?.nit ?? '',
        centro: p.centro,
        debito: p.debito,
        credito: p.credito,
        base: p.base,
        concepto: p.concepto,
      };
    });
    setLineas(prev => [...prev, ...nuevas]);
  }

  function aplicarPlantilla(id: string) {
    const plantilla = PLANTILLAS.find(p => p.id === id);
    if (!plantilla) return;
    insertarPlantilla(plantilla.lineas);
    setShowPlantilla(false);
    setAviso({ tipo: 'success', texto: `Plantilla «${plantilla.nombre}» aplicada (${plantilla.lineas.length} líneas).` });
  }

  function insertarPortapapeles() {
    insertarPlantilla(FILAS_PORTAPAPELES);
    setShowExcel(false);
    setAviso({ tipo: 'success', texto: 'Se insertaron 3 líneas simuladas del portapapeles.' });
  }

  const documentos = Object.values(MOVIMIENTOS_FEB.reduce<Record<string, { documento: string; comprobante: string; fecha: string; concepto: string; lineas: MovimientoLinea[] }>>((acc, m) => {
    acc[m.documento] = acc[m.documento] ?? { documento: m.documento, comprobante: m.comprobante, fecha: m.fecha, concepto: m.concepto, lineas: [] };
    acc[m.documento].lineas.push(m);
    return acc;
  }, {}));

  function cargarDocumento(doc: { documento: string; comprobante: string; fecha: string; concepto: string; lineas: MovimientoLinea[] }) {
    const prim = doc.lineas[0];
    setPeriodo(prim.periodo);
    setFecha(prim.fecha);
    setComprobante(prim.comprobante.split('-')[0] || 'CE');
    setTipoDoc(prim.tipoDoc);
    setNumDoc(prim.documento);
    setConcepto(prim.concepto);
    setLineas(doc.lineas.map(m => {
      const l = newLine();
      return {
        ...l,
        cuenta: m.cuenta,
        nombreCuenta: m.nombreCuenta,
        nit: m.nit,
        tercero: m.tercero,
        centro: m.centro,
        documento: m.documento,
        debito: m.debito ? String(m.debito) : '',
        credito: m.credito ? String(m.credito) : '',
        base: m.base ? String(m.base) : '',
        concepto: m.concepto,
      };
    }));
    setShowCargarDoc(false);
    setAviso({ tipo: 'success', texto: `Documento ${doc.documento} cargado con ${doc.lineas.length} líneas.` });
  }

  function guardarBorrador() {
    if (!onCrearLote) return;
    const comp = COMPROBANTES.find(c => c.codigo === comprobante);
    const codigo = `CD-${String(cdCounter++).padStart(2, '0')}`;
    const lineasLote: LoteLinea[] = lineas
      .filter(l => l.cuenta.trim() || parseCOP(l.debito) > 0 || parseCOP(l.credito) > 0)
      .map((l, i) => {
        const cuenta = CUENTAS.find(c => c.codigo === l.cuenta);
        return {
          id: `L${String(i + 1).padStart(2, '0')}`,
          cuenta: l.cuenta,
          nombreCuenta: cuenta?.nombre ?? l.nombreCuenta,
          nit: l.nit,
          tercero: l.tercero,
          centro: l.centro,
          comprobante: comp ? `${comp.codigo}-${String(comp.consecutivo + cdCounter).padStart(6, '0')}` : comprobante,
          documento: numDoc || `${tipoDoc || 'DOC'}-000001`,
          fecha,
          debito: parseCOP(l.debito),
          credito: parseCOP(l.credito),
          base: parseCOP(l.base),
          clase: cuenta?.claseRetencion ?? cuenta?.claseIVA ?? '',
          docAfectado: '',
          concepto: l.concepto || concepto,
          errores: [],
        };
      });
    const lote: Lote = {
      id: `lote-${Date.now()}`,
      codigo,
      nombre: concepto || `Captura directa ${codigo}`,
      periodo,
      usuario: USUARIO.nombre,
      origen: 'Manual',
      fecha,
      lineasCount: lineasLote.length,
      debito: totalDeb,
      credito: totalCred,
      diferencia: diff,
      erroresCount: 0,
      estado: 'Borrador',
      lineas: lineasLote,
    };
    onCrearLote(lote);
    setAviso({ tipo: 'success', texto: `Borrador ${codigo} guardado en Lotes con ${lineasLote.length} línea(s).` });
  }

  function confirmarPost() {
    setShowConfirm(false);
    setPosted(true);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-800">Captura directa</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPlantilla(true)} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">F5 Plantilla</button>
          <button onClick={() => setShowExcel(true)} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">F6 Importar Excel</button>
          <button onClick={() => setShowCargarDoc(true)} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Cargar documento existente</button>
          {onCrearLote && (
            <button onClick={guardarBorrador} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Guardar borrador</button>
          )}
          <button
            disabled={!puedePostear}
            onClick={() => setShowConfirm(true)}
            className={`text-xs px-3 py-1.5 rounded font-medium text-white transition-colors ${puedePostear ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
            style={{ backgroundColor: '#0073C0' }}
          >
            F2 Validar / Contabilizar
          </button>
        </div>
      </div>

      {aviso && (
        <div className={`shrink-0 flex items-center justify-between px-4 py-2 text-xs border-b ${aviso.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          <span>{aviso.texto}</span>
          <button onClick={() => setAviso(null)} className="text-gray-400 hover:text-gray-600">×</button>
        </div>
      )}

      {/* Header form */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Período</label>
            <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Comprobante</label>
            <select value={comprobante} onChange={e => setComprobante(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1">
              {COMPROBANTES.map(c => (
                <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo documento</label>
            <input value={tipoDoc} onChange={e => setTipoDoc(e.target.value)} placeholder="FV, OR, NOM..."
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">N.° documento</label>
            <input value={numDoc} onChange={e => setNumDoc(e.target.value)} placeholder="000001"
              className="w-full font-mono text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tercero header</label>
            <select value={terceroHdr} onChange={e => setTerceroHdr(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1">
              <option value="">— Sin tercero —</option>
              {TERCEROS.map(t => <option key={t.nit} value={t.nit}>{t.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Concepto general</label>
          <input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Descripción del comprobante..."
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 max-w-xl" />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-auto table-fixed-header">
          <table className="w-full text-xs border-collapse min-w-max">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-6">#</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-24">Cuenta</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-44">Nombre cuenta</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-44">Tercero</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-20">Centro</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-32">Documento</th>
                <th className="px-2 py-2 text-right font-semibold text-gray-600 border-b border-gray-200 w-28">Débito</th>
                <th className="px-2 py-2 text-right font-semibold text-gray-600 border-b border-gray-200 w-28">Crédito</th>
                <th className="px-2 py-2 text-right font-semibold text-gray-600 border-b border-gray-200 w-24">Base</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 min-w-36">Concepto línea</th>
                <th className="px-2 py-2 border-b border-gray-200 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((line, idx) => {
                const errs = erroresLinea(line);
                return (
                  <tr
                    key={line.id}
                    className="border-b border-gray-100 hoverable"
                    onClick={() => setEditingId(line.id)}
                  >
                    <td className="px-2 py-1.5 text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-1.5 relative">
                      <div className="flex items-center gap-1">
                        <input
                          className={`w-20 font-mono text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-1 ${editingId === line.id ? 'border-blue-300' : 'border-gray-200'} ${errs.length ? 'bg-red-50' : ''}`}
                          value={line.cuenta}
                          onChange={e => updateLine(line.id, 'cuenta', e.target.value)}
                          onFocus={() => { setEditingId(line.id); setCuentaSearch(line.cuenta); setShowCuentaPicker(line.id); }}
                          onClick={e => e.stopPropagation()}
                          placeholder="código"
                        />
                        {showCuentaPicker === line.id && (
                          <div className="absolute top-8 left-0 z-20 bg-white border border-gray-200 rounded shadow-lg w-72">
                            <div className="p-2 border-b">
                              <input
                                autoFocus
                                className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none"
                                placeholder="Buscar cuenta..."
                                value={cuentaSearch}
                                onChange={e => setCuentaSearch(e.target.value)}
                                onClick={e => e.stopPropagation()}
                              />
                            </div>
                            <div className="max-h-40 overflow-y-auto">
                              {filteredCuentas.slice(0, 15).map(c => (
                                <div
                                  key={c.codigo}
                                  className="px-3 py-1.5 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                                  onMouseDown={e => { e.preventDefault(); updateLine(line.id, 'cuenta', c.codigo); }}
                                >
                                  <span className="font-mono text-gray-600 w-16 shrink-0">{c.codigo}</span>
                                  <span className="text-gray-700 truncate">{c.nombre}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {errs.length > 0 && <div className="mt-0.5 text-[10px] text-red-500 max-w-44">{errs[0]}</div>}
                    </td>
                    <td className="px-2 py-1.5 text-gray-600 text-xs truncate max-w-44">
                      {line.nombreCuenta || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        className={`w-full text-xs border rounded px-1 py-1 focus:outline-none focus:ring-1 ${errs.some(e => e.includes('tercero')) ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                        value={line.tercero}
                        onChange={e => updateLine(line.id, 'tercero', e.target.value)}
                        onClick={e => e.stopPropagation()}
                      >
                        <option value="">—</option>
                        {TERCEROS.map(t => <option key={t.nit} value={t.nombre}>{t.nombre}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        className={`w-full text-xs border rounded px-1 py-1 focus:outline-none focus:ring-1 ${errs.some(e => e.includes('centro')) ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                        value={line.centro}
                        onChange={e => updateLine(line.id, 'centro', e.target.value)}
                        onClick={e => e.stopPropagation()}
                      >
                        <option value="">—</option>
                        {CENTROS.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="w-full font-mono text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1"
                        value={line.documento}
                        onChange={e => updateLine(line.id, 'documento', e.target.value)}
                        onClick={e => e.stopPropagation()}
                        placeholder="doc..."
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="w-full font-mono text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 text-right"
                        value={line.debito}
                        onChange={e => updateLine(line.id, 'debito', e.target.value)}
                        onClick={e => e.stopPropagation()}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="w-full font-mono text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 text-right"
                        value={line.credito}
                        onChange={e => updateLine(line.id, 'credito', e.target.value)}
                        onClick={e => e.stopPropagation()}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className={`w-full font-mono text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-1 text-right ${errs.some(e => e.includes('base')) ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                        value={line.base}
                        onChange={e => updateLine(line.id, 'base', e.target.value)}
                        onClick={e => e.stopPropagation()}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1"
                        value={line.concepto}
                        onChange={e => updateLine(line.id, 'concepto', e.target.value)}
                        onClick={e => e.stopPropagation()}
                        placeholder="Concepto..."
                      />
                    </td>
                    <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => deleteLine(line.id)}
                        className="text-xs text-red-400 hover:text-red-600 w-5 h-5 flex items-center justify-center rounded hover:bg-red-50"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Validation strip */}
        {totalErrores > 0 && (
          <div className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-2 space-y-1">
            <div className="text-xs font-semibold text-red-700">Validación — {totalErrores} error{totalErrores !== 1 ? 'es' : ''}</div>
            {lineasConError.map(l => (
              <div key={l.id} className="flex gap-2 text-xs text-red-700">
                <span className="font-mono shrink-0">{l.cuenta || '(sin cuenta)'}</span>
                <span className="text-red-300">·</span>
                <span>{erroresLinea(l).join(' — ')}</span>
              </div>
            ))}
          </div>
        )}

        {/* Add line + totals */}
        <div className="shrink-0 border-t border-gray-200 bg-white">
          <button
            onClick={addLine}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-b border-gray-100 transition-colors"
          >
            <span>+</span> Agregar línea (Enter)
          </button>
          {/* Totals */}
          <div className="flex items-center gap-6 px-4 py-2.5 bg-gray-50">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500">Total débitos:</span>
              <span className="font-mono font-bold text-gray-800">{fmtCOP(totalDeb)}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500">Total créditos:</span>
              <span className="font-mono font-bold text-gray-800">{fmtCOP(totalCred)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Diferencia:</span>
              <span className={`font-mono font-bold ${diff === 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmtCOP(Math.abs(diff))}
              </span>
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              totalErrores > 0 ? 'bg-red-100 text-red-700' :
              isBalanced ? 'bg-green-100 text-green-700' : totalDeb === 0 ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700'
            }`}>
              {totalErrores > 0 ? `⚠ ${totalErrores} error${totalErrores !== 1 ? 'es' : ''}` :
               isBalanced ? '✓ Cuadrado' : totalDeb === 0 ? '— Sin datos' : '✗ Descuadrado'}
            </div>
            <div className="flex-1" />
            <div className="text-xs text-gray-400">{lineas.length} línea{lineas.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {showConfirm && !posted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Confirmar contabilización</h3>
            <p className="text-xs text-gray-600 mb-1">Comprobante: <strong>{comprobante}</strong></p>
            <p className="text-xs text-gray-600 mb-1">Período: <strong>{periodo}</strong></p>
            <p className="text-xs text-gray-600 mb-1">Líneas: <strong>{lineas.filter(l => parseCOP(l.debito) > 0 || parseCOP(l.credito) > 0).length}</strong></p>
            <p className="text-xs text-gray-600 mb-4">Total: <strong className="font-mono">{fmtCOP(totalDeb)}</strong></p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)} className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmarPost} className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>
                Contabilizar
              </button>
            </div>
          </div>
        </div>
      )}

      {posted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm mx-4 p-6 text-center">
            <div className="text-4xl mb-3 text-green-500">✓</div>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Comprobante contabilizado</h3>
            <p className="text-xs text-gray-500 mb-4">El movimiento ha sido registrado exitosamente en el período {periodo}.</p>
            <button
              onClick={() => setPosted(false)}
              className="text-xs px-4 py-2 rounded text-white font-medium"
              style={{ backgroundColor: '#0073C0' }}
            >
              Nuevo comprobante
            </button>
          </div>
        </div>
      )}

      {/* Plantillas */}
      {showPlantilla && (
        <Modal title="Aplicar plantilla" onClose={() => setShowPlantilla(false)}>
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Seleccione una plantilla de ejemplo. Las líneas se insertan al final de la captura y siempre quedan cuadradas.</p>
            {PLANTILLAS.map(p => {
              const deb = p.lineas.reduce((s, l) => s + parseCOP(l.debito), 0);
              const cred = p.lineas.reduce((s, l) => s + parseCOP(l.credito), 0);
              return (
                <div key={p.id} className="rounded border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-gray-800">{p.nombre}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{p.descripcion}</div>
                    </div>
                    <span className="shrink-0 text-xs font-mono text-green-600">D {fmtCOP(deb)} = C {fmtCOP(cred)}</span>
                  </div>
                  <div className="mt-2 space-y-0.5">
                    {p.lineas.map((l, i) => (
                      <div key={i} className="flex gap-2 text-[11px] text-gray-500">
                        <span className="font-mono w-14 shrink-0">{l.cuenta}</span>
                        <span className="truncate">{l.concepto}</span>
                        <span className="ml-auto shrink-0 font-mono">{l.debito ? fmtCOP(parseCOP(l.debito)) : `(${fmtCOP(parseCOP(l.credito))})`}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button onClick={() => aplicarPlantilla(p.id)} className="text-xs px-3 py-1.5 rounded bg-petroleum-500 text-white font-medium hover:bg-petroleum-600">Aplicar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {/* Pegar desde Excel */}
      {showExcel && (
        <Modal title="Pegar desde Excel" onClose={() => setShowExcel(false)}>
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Simulación: se detectaron 3 filas en el portapapeles. Revise la vista previa antes de insertarlas.</p>
            <div className="rounded border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Cuenta</th>
                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Tercero</th>
                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Centro</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Débito</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Crédito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {FILAS_PORTAPAPELES.map((f, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-mono">{f.cuenta}</td>
                      <td className="px-3 py-1.5 text-gray-600">{f.tercero || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-600">{f.centro || '—'}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{f.debito ? fmtCOP(parseCOP(f.debito)) : '—'}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{f.credito ? fmtCOP(parseCOP(f.credito)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100 shrink-0">
            <button onClick={() => setShowExcel(false)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button onClick={insertarPortapapeles} className={BUTTON_PRIMARY}>Insertar 3 líneas</button>
          </div>
        </Modal>
      )}

      {/* Cargar documento existente */}
      {showCargarDoc && (
        <Modal title="Cargar documento existente" onClose={() => setShowCargarDoc(false)}>
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Documentos contabilizados en el período 2026-02 (demostración). Al elegir uno se cargan sus líneas en la captura.</p>
            <div className="rounded border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Documento</th>
                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Comprobante</th>
                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Fecha</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Líneas</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {documentos.map(d => (
                    <tr key={d.documento} className="hoverable">
                      <td className="px-3 py-1.5 font-mono text-gray-800">{d.documento}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-500">{d.comprobante}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-500">{d.fecha}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-600">{d.lineas.length}</td>
                      <td className="px-3 py-1.5 text-right">
                        <button onClick={() => cargarDocumento(d)} className="text-xs px-2.5 py-1 rounded border border-gray-200 text-petroleum-600 hover:bg-petroleum-50">Cargar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400">Las líneas cargadas conservan su cuenta, tercero, centro y valores originales.</p>
          </div>
        </Modal>
      )}

      {/* Close picker on outside click */}
      {showCuentaPicker && (
        <div className="fixed inset-0 z-10" onClick={() => setShowCuentaPicker(null)} />
      )}
    </div>
  );
}
