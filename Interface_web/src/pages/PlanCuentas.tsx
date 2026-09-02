import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CUENTAS, MOVIMIENTOS_FEB, fmtCOP } from '../data/mock';
import type { Cuenta } from '../types';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

const NIVELES = [1, 2, 4, 6, 9, 12];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

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

function saldo(cuenta: Cuenta): number {
  let s = cuenta.saldoInicial;
  for (const m of cuenta.movimientos) {
    s += m.debito - m.credito;
  }
  return s;
}

function tieneMovimiento(c: Cuenta): boolean {
  return c.saldoInicial !== 0 || c.movimientos.some(m => m.debito !== 0 || m.credito !== 0);
}

interface FormCuenta {
  codigo: string;
  nombre: string;
  nivel: number;
  afectable: boolean;
  requiereTercero: boolean;
  requiereCentro: boolean;
  requiereBase: boolean;
  ajuste: boolean;
}

function formVacio(): FormCuenta {
  return { codigo: '', nombre: '', nivel: 4, afectable: true, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false };
}

function formDe(c: Cuenta): FormCuenta {
  return { codigo: c.codigo, nombre: c.nombre, nivel: c.nivel, afectable: c.afectable, requiereTercero: c.requiereTercero, requiereCentro: c.requiereCentro, requiereBase: c.requiereBase, ajuste: c.ajuste };
}

function parseNum(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function PlanCuentas() {
  const [cuentas, setCuentas] = useState<Cuenta[]>(CUENTAS);
  const [view, setView] = useState<'tree' | 'table'>('table');
  const [filterText, setFilterText] = useState('');
  const [filterTipo, setFilterTipo] = useState<'todas' | 'afectables' | 'retenciones' | 'iva' | 'base'>('todas');
  const [selectedCodigo, setSelectedCodigo] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [detalleTab, setDetalleTab] = useState<'meses' | 'ajustes'>('meses');
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showEliminar, setShowEliminar] = useState(false);
  const [showBloqueo, setShowBloqueo] = useState<{ cuenta: Cuenta; motivos: string[] } | null>(null);
  const [showImpacto, setShowImpacto] = useState<{ original: Cuenta; nuevo: FormCuenta } | null>(null);
  const [formNueva, setFormNueva] = useState<FormCuenta>(formVacio);
  const [formEdit, setFormEdit] = useState<FormCuenta>(formVacio);
  const [erroresNueva, setErroresNueva] = useState<{ codigo?: string; nombre?: string; nivel?: string }>({});
  const [erroresEdit, setErroresEdit] = useState<{ nombre?: string; nivel?: string }>({});
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const selectedCuenta = cuentas.find(c => c.codigo === selectedCodigo) || null;

  function pasaFiltro(c: Cuenta): boolean {
    if (filterTipo === 'afectables' && !c.afectable) return false;
    if (filterTipo === 'base' && c.nivel > 2) return false;
    if (filterTipo === 'retenciones' && !c.claseRetencion) return false;
    if (filterTipo === 'iva' && !c.claseIVA) return false;
    if (filterText) {
      const q = filterText.toLowerCase();
      if (!c.codigo.includes(q) && !c.nombre.toLowerCase().includes(q)) return false;
    }
    return true;
  }

  function padre(codigo: string): string | null {
    let mejor: string | null = null;
    for (const c of cuentas) {
      if (c.codigo !== codigo && codigo.startsWith(c.codigo)) {
        if (mejor === null || c.codigo.length > mejor.length) mejor = c.codigo;
      }
    }
    return mejor;
  }

  const hijosDe = (codigo: string): Cuenta[] =>
    cuentas
      .filter(c => padre(c.codigo) === codigo)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

  const filterActivo = filterText !== '' || filterTipo !== 'todas';
  const visibles = new Set<string>();
  if (filterActivo) {
    for (const c of cuentas) {
      if (!pasaFiltro(c)) continue;
      let cur: string | null = c.codigo;
      while (cur) {
        visibles.add(cur);
        cur = padre(cur);
      }
    }
  }

  const filtered = cuentas.filter(pasaFiltro).sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

  function toggleCollapse(codigo: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  }

  function abrirNueva() {
    setFormNueva(formVacio());
    setErroresNueva({});
    setShowNew(true);
  }

  function guardarNueva() {
    const e: typeof erroresNueva = {};
    const codigo = formNueva.codigo.trim();
    if (!codigo) e.codigo = 'El código es obligatorio.';
    else if (cuentas.some(c => c.codigo === codigo)) e.codigo = `Ya existe la cuenta ${codigo}.`;
    if (!formNueva.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
    if (!(NIVELES as readonly number[]).includes(formNueva.nivel)) e.nivel = 'El nivel debe ser 1, 2, 4, 6, 9 o 12.';
    setErroresNueva(e);
    if (Object.keys(e).length) return;
    setCuentas(prev => [...prev, {
      codigo,
      nombre: formNueva.nombre.trim(),
      nivel: formNueva.nivel,
      afectable: formNueva.afectable,
      requiereTercero: formNueva.requiereTercero,
      requiereCentro: formNueva.requiereCentro,
      requiereBase: formNueva.requiereBase,
      ajuste: formNueva.ajuste,
      claseIVA: null,
      claseRetencion: null,
      saldoInicial: 0,
      movimientos: [],
    }]);
    setShowNew(false);
    setSelectedCodigo(codigo);
    setAviso({ tipo: 'success', texto: `Cuenta ${codigo} creada en el plan de cuentas.` });
  }

  function abrirEditar(c: Cuenta) {
    setFormEdit(formDe(c));
    setErroresEdit({});
    setShowEdit(true);
  }

  function aplicarEdicion(f: FormCuenta) {
    if (!selectedCodigo) return;
    setCuentas(prev => prev.map(c => c.codigo === selectedCodigo ? {
      ...c,
      nombre: f.nombre.trim(),
      nivel: f.nivel,
      afectable: f.afectable,
      requiereTercero: f.requiereTercero,
      requiereCentro: f.requiereCentro,
      requiereBase: f.requiereBase,
      ajuste: f.ajuste,
    } : c));
    setShowEdit(false);
    setShowImpacto(null);
    setAviso({ tipo: 'success', texto: 'Cuenta actualizada.' });
  }

  function guardarEditar() {
    if (!selectedCuenta) return;
    const e: typeof erroresEdit = {};
    if (!formEdit.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
    if (!(NIVELES as readonly number[]).includes(formEdit.nivel)) e.nivel = 'El nivel debe ser 1, 2, 4, 6, 9 o 12.';
    setErroresEdit(e);
    if (Object.keys(e).length) return;
    const cambioControl = formEdit.afectable !== selectedCuenta.afectable || formEdit.requiereTercero !== selectedCuenta.requiereTercero || formEdit.requiereCentro !== selectedCuenta.requiereCentro;
    if (cambioControl && tieneMovimiento(selectedCuenta)) {
      setShowImpacto({ original: selectedCuenta, nuevo: formEdit });
      return;
    }
    aplicarEdicion(formEdit);
  }

  function motivosBloqueo(c: Cuenta): string[] {
    const motivos: string[] = [];
    const hijas = cuentas.filter(o => o.codigo !== c.codigo && o.codigo.startsWith(c.codigo));
    if (hijas.length) motivos.push(`Tiene ${hijas.length} cuenta(s) hija(s) que dependen de su código (${hijas.slice(0, 4).map(h => h.codigo).join(', ')}${hijas.length > 4 ? '…' : ''}).`);
    if (c.saldoInicial !== 0) motivos.push(`Su saldo inicial es ${fmtCOP(c.saldoInicial)} y debe ser cero para poder eliminarla.`);
    const conMov = c.movimientos.filter(m => m.debito !== 0 || m.credito !== 0).length;
    if (conMov) motivos.push(`Tiene movimiento registrado en ${conMov} mes(es) del libro.`);
    return motivos;
  }

  function pedirEliminar() {
    if (!selectedCuenta) return;
    const motivos = motivosBloqueo(selectedCuenta);
    if (motivos.length) {
      setShowBloqueo({ cuenta: selectedCuenta, motivos });
      return;
    }
    setShowEliminar(true);
  }

  function confirmarEliminar() {
    if (!selectedCodigo) return;
    setCuentas(prev => prev.filter(c => c.codigo !== selectedCodigo));
    setSelectedCodigo(null);
    setShowEliminar(false);
    setAviso({ tipo: 'success', texto: 'Cuenta eliminada del plan de cuentas.' });
  }

  function editarSaldoInicial(valor: string) {
    if (!selectedCodigo) return;
    const n = parseNum(valor);
    setCuentas(prev => prev.map(c => c.codigo === selectedCodigo ? { ...c, saldoInicial: n } : c));
  }

  function editarMes(idx: number, campo: 'debito' | 'credito', valor: string) {
    if (!selectedCodigo) return;
    const n = parseNum(valor);
    setCuentas(prev => prev.map(c => {
      if (c.codigo !== selectedCodigo) return c;
      const movimientos = Array.from({ length: 12 }, (_, i) => c.movimientos[i] ?? { mes: i + 1, debito: 0, credito: 0 });
      movimientos[idx] = { ...movimientos[idx], [campo]: n };
      return { ...c, movimientos };
    }));
  }

  function ajustesMock(c: Cuenta): { mes: number; concepto: string; valor: number }[] {
    const s = saldo(c);
    const factores = [0.02, -0.01, 0.015, 0, -0.025, 0.03];
    return factores.map((f, i) => ({ mes: 13 + i, concepto: `Ajuste simulado período ${13 + i}`, valor: Math.round(s * f) }));
  }

  function exportarCSV() {
    const filas = cuentas.map(c => [c.codigo, c.nombre, String(c.nivel), c.afectable ? 'Sí' : 'No', c.requiereTercero ? 'Sí' : 'No', c.requiereCentro ? 'Sí' : 'No', c.requiereBase ? 'Sí' : 'No', c.claseIVA || '', c.claseRetencion || '', String(c.saldoInicial)].join(';'));
    const csv = ['Código;Nombre;Nivel;Afectable;Requiere tercero;Requiere centro;Requiere base;Clase IVA;Clase retención;Saldo inicial', ...filas].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plan-cuentas.csv';
    a.click();
    URL.revokeObjectURL(url);
    setAviso({ tipo: 'success', texto: `Plan de cuentas exportado (${cuentas.length} cuentas).` });
  }

  function renderNodo(c: Cuenta): ReactNode {
    if (filterActivo && !visibles.has(c.codigo)) return null;
    const hijos = hijosDe(c.codigo);
    const abierto = !collapsed.has(c.codigo);
    const sal = saldo(c);
    const esSeleccionada = selectedCodigo === c.codigo;
    return (
      <div key={c.codigo}>
        <div
          onClick={() => setSelectedCodigo(c.codigo)}
          className={`flex items-center gap-2 border-b border-gray-50 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 ${esSeleccionada ? 'bg-blue-50' : ''}`}
        >
          <button
            type="button"
            aria-label={abierto ? 'Contraer' : 'Expandir'}
            onClick={e => { e.stopPropagation(); toggleCollapse(c.codigo); }}
            className={`w-4 shrink-0 text-center ${hijos.length ? 'text-gray-500 hover:text-gray-800' : 'text-gray-200'}`}
          >
            {hijos.length ? (abierto ? '▾' : '▸') : '·'}
          </button>
          <span className={`font-mono shrink-0 w-20 ${c.nivel <= 2 ? 'font-bold text-gray-800' : c.nivel === 3 ? 'font-semibold text-gray-700' : 'text-gray-600'}`}>{c.codigo}</span>
          <span className={`flex-1 truncate ${c.nivel <= 2 ? 'font-bold uppercase text-gray-800' : c.nivel === 3 ? 'font-semibold text-gray-700' : 'text-gray-600'}`}>{c.nombre}</span>
          <span className="w-14 text-center text-gray-400">Niv {c.nivel}</span>
          <span className="w-10 text-center">{c.afectable ? <span className="text-green-500">✓</span> : <span className="text-gray-200">—</span>}</span>
          <span className="w-10 text-center">{c.requiereTercero ? <span className="text-blue-500">✓</span> : <span className="text-gray-200">—</span>}</span>
          <span className="w-10 text-center">{c.requiereCentro ? <span className="text-blue-500">✓</span> : <span className="text-gray-200">—</span>}</span>
          <span className="w-10 text-center">{c.requiereBase ? <span className="text-amber-500">✓</span> : <span className="text-gray-200">—</span>}</span>
          <span className="w-24 text-center">
            {c.claseRetencion && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{c.claseRetencion}</span>}
            {c.claseIVA && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{c.claseIVA}</span>}
          </span>
          <span className={`w-28 text-right font-mono ${sal > 0 ? 'text-green-700' : sal < 0 ? 'text-red-700' : 'text-gray-300'}`}>
            {sal !== 0 ? fmtCOP(Math.abs(sal)) : '—'}
          </span>
          <span className="w-36 text-right" onClick={e => e.stopPropagation()}>
            <button className="text-xs text-blue-600 hover:underline" onClick={() => abrirEditar(c)}>Editar</button>
            <span className="text-gray-300"> | </span>
            <button className="text-xs text-red-500 hover:underline" onClick={() => { setSelectedCodigo(c.codigo); pedirEliminar(); }}>Eliminar</button>
          </span>
        </div>
        {abierto && <div>{hijos.map(renderNodo)}</div>}
      </div>
    );
  }

  const documentosImpacto = showImpacto ? MOVIMIENTOS_FEB.filter(m => m.cuenta === showImpacto.original.codigo) : [];

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Plan de cuentas</div>
          <h1 className="text-lg font-semibold text-gray-800">Plan de cuentas</h1>
          <p className="mt-1 text-xs text-gray-500">Catálogo maestro de cuentas contables — niveles 1, 2, 4, 6, 9 y 12</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
          <button onClick={() => window.print()} className={BUTTON_SECONDARY}>⎙ Imprimir</button>
          <button onClick={exportarCSV} className={BUTTON_SECONDARY}>↓ Exportar</button>
          <button onClick={abrirNueva} className={BUTTON_PRIMARY}>+ Crear cuenta</button>
        </div>
      </div>

      {aviso && (
        <div role={aviso.tipo === 'error' ? 'alert' : 'status'} className={`flex items-center justify-between rounded border px-4 py-2 text-sm ${aviso.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>
          <span>{aviso.texto}</span>
          <button onClick={() => setAviso(null)} className="text-xs text-gray-400 hover:text-gray-600">×</button>
        </div>
      )}

      <div className="flex gap-4">
        {/* Main panel */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Toolbar */}
          <div className="bg-white rounded border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Buscar por código o nombre..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 w-56"
            />
            <div className="flex items-center gap-1">
              {([
                { k: 'todas', label: 'Todas' },
                { k: 'afectables', label: 'Afectables' },
                { k: 'base', label: 'Base' },
                { k: 'retenciones', label: 'Retenciones' },
                { k: 'iva', label: 'IVA' },
              ] as const).map(f => (
                <button
                  key={f.k}
                  onClick={() => setFilterTipo(f.k)}
                  className={`text-xs px-2.5 py-1 rounded transition-colors font-medium ${filterTipo === f.k ? 'bg-petroleum-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 ml-auto">
              {(['tree', 'table'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`text-xs px-2.5 py-1 rounded transition-colors ${view === v ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  {v === 'tree' ? '⊞ Árbol' : '≡ Tabla'}
                </button>
              ))}
            </div>
          </div>

          {view === 'table' ? (
            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="table-fixed-header overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Código</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Niv</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Afect.</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Tercero</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Centro</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Base</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Clase</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Saldo actual</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(cuenta => {
                      const sal = saldo(cuenta);
                      return (
                        <tr
                          key={cuenta.codigo}
                          className={`hoverable cursor-pointer ${selectedCodigo === cuenta.codigo ? 'bg-blue-50' : ''}`}
                          onClick={() => setSelectedCodigo(cuenta.codigo)}
                        >
                          <td className="px-3 py-2">
                            <span className={`font-mono ${cuenta.nivel <= 2 ? 'font-bold text-gray-800' : cuenta.nivel === 3 ? 'font-semibold text-gray-700' : 'text-gray-600'}`}>
                              {cuenta.codigo}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={cuenta.nivel <= 2 ? 'font-bold text-gray-800 uppercase text-xs' : cuenta.nivel === 3 ? 'font-semibold text-gray-700' : 'text-gray-600'}>
                              {cuenta.nombre}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-gray-500">{cuenta.nivel}</td>
                          <td className="px-3 py-2 text-center">{cuenta.afectable ? <span className="text-green-500">✓</span> : <span className="text-gray-200">—</span>}</td>
                          <td className="px-3 py-2 text-center">{cuenta.requiereTercero ? <span className="text-blue-500">✓</span> : <span className="text-gray-200">—</span>}</td>
                          <td className="px-3 py-2 text-center">{cuenta.requiereCentro ? <span className="text-blue-500">✓</span> : <span className="text-gray-200">—</span>}</td>
                          <td className="px-3 py-2 text-center">{cuenta.requiereBase ? <span className="text-amber-500">✓</span> : <span className="text-gray-200">—</span>}</td>
                          <td className="px-3 py-2">
                            {cuenta.claseRetencion && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{cuenta.claseRetencion}</span>}
                            {cuenta.claseIVA && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{cuenta.claseIVA}</span>}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono ${sal > 0 ? 'text-green-700' : sal < 0 ? 'text-red-700' : 'text-gray-300'}`}>
                            {sal !== 0 ? fmtCOP(Math.abs(sal)) : '—'}
                          </td>
                          <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <button className="text-xs text-blue-600 hover:underline" onClick={() => abrirEditar(cuenta)}>Editar</button>
                              <span className="text-gray-300">|</span>
                              <button className="text-xs text-red-500 hover:underline" onClick={() => { setSelectedCodigo(cuenta.codigo); pedirEliminar(); }}>Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
                {filtered.length} cuenta{filtered.length !== 1 ? 's' : ''}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                <span className="w-4 shrink-0" />
                <span className="w-20 shrink-0 font-semibold text-gray-600">Código</span>
                <span className="flex-1 font-semibold text-gray-600">Nombre</span>
                <span className="w-14 text-center font-semibold text-gray-600">Nivel</span>
                <span className="w-10 text-center font-semibold text-gray-600">Afect.</span>
                <span className="w-10 text-center font-semibold text-gray-600">Terc.</span>
                <span className="w-10 text-center font-semibold text-gray-600">Cent.</span>
                <span className="w-10 text-center font-semibold text-gray-600">Base</span>
                <span className="w-24 text-center font-semibold text-gray-600">Clase</span>
                <span className="w-28 text-right font-semibold text-gray-600">Saldo</span>
                <span className="w-36 text-right font-semibold text-gray-600">Acciones</span>
              </div>
              <div>
                {cuentas.filter(c => padre(c.codigo) === null).sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true })).map(renderNodo)}
              </div>
              <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
                {filtered.length} cuenta{filtered.length !== 1 ? 's' : ''} {filterActivo ? '(con ancestros visibles)' : ''}
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedCuenta && (
          <div className="w-80 shrink-0 space-y-3">
            <div className="bg-white rounded border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-mono font-bold text-gray-800">{selectedCuenta.codigo}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{selectedCuenta.nombre}</div>
                </div>
                <button onClick={() => setSelectedCodigo(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
              </div>

              <div className="space-y-2 text-xs">
                {([
                  ['Nivel', selectedCuenta.nivel],
                  ['Afectable', selectedCuenta.afectable ? 'Sí' : 'No'],
                  ['Requiere tercero', selectedCuenta.requiereTercero ? 'Sí' : 'No'],
                  ['Requiere centro', selectedCuenta.requiereCentro ? 'Sí' : 'No'],
                  ['Requiere base', selectedCuenta.requiereBase ? 'Sí' : 'No'],
                  ['Ajuste por inflación', selectedCuenta.ajuste ? 'Sí' : 'No'],
                  ['Clase IVA', selectedCuenta.claseIVA || '—'],
                  ['Clase retención', selectedCuenta.claseRetencion || '—'],
                ] as const).map(([label, val]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-800">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="flex border-b border-gray-200">
                {([['meses', 'Saldo inicial y meses'], ['ajustes', '13-18']] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setDetalleTab(k)}
                    className={`flex-1 px-3 py-2 text-xs font-medium ${detalleTab === k ? 'bg-petroleum-50 text-petroleum-700 border-b-2 border-petroleum-500' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {detalleTab === 'meses' ? (
                <div className="p-3 space-y-2">
                  <div className="grid items-center gap-1 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-3">
                    <label htmlFor="pc-saldo-inicial" className="text-xs font-medium text-gray-600">Saldo inicial</label>
                    <input id="pc-saldo-inicial" className={`${INPUT} font-mono text-right`} inputMode="numeric" value={String(selectedCuenta.saldoInicial)}
                      onChange={e => editarSaldoInicial(e.target.value)} />
                  </div>
                  <div className="text-xs font-semibold text-gray-700 pt-1">Movimiento por meses</div>
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {MESES.map((mes, idx) => {
                      const m = selectedCuenta.movimientos[idx] ?? { mes: idx + 1, debito: 0, credito: 0 };
                      return (
                        <div key={mes} className="grid grid-cols-[2.2rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1">
                          <span className="text-xs text-gray-500">{mes}</span>
                          <input aria-label={`Débito ${mes}`} className={`${INPUT} font-mono text-right`} inputMode="numeric" value={String(m.debito)}
                            onChange={e => editarMes(idx, 'debito', e.target.value)} placeholder="Débito" />
                          <input aria-label={`Crédito ${mes}`} className={`${INPUT} font-mono text-right`} inputMode="numeric" value={String(m.credito)}
                            onChange={e => editarMes(idx, 'credito', e.target.value)} placeholder="Crédito" />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-2 text-xs font-semibold">
                    <span className="text-gray-600">Saldo actual</span>
                    <span className={`font-mono ${saldo(selectedCuenta) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {fmtCOP(Math.abs(saldo(selectedCuenta)))}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 space-y-1">
                  <p className="text-xs text-gray-400 pb-1">Ajustes simulados (demostración) para los períodos 13 a 18.</p>
                  {ajustesMock(selectedCuenta).map(a => (
                    <div key={a.mes} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-gray-50 py-1 text-xs">
                      <span className="font-mono text-gray-500">{a.mes}</span>
                      <span className="text-gray-600 truncate">{a.concepto}</span>
                      <span className={`font-mono ${a.valor > 0 ? 'text-green-700' : a.valor < 0 ? 'text-red-700' : 'text-gray-300'}`}>{a.valor !== 0 ? fmtCOP(Math.abs(a.valor)) : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => abrirEditar(selectedCuenta)} className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Editar</button>
              <button onClick={pedirEliminar} className="flex-1 rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50">Eliminar</button>
            </div>
          </div>
        )}
      </div>

      {/* Crear cuenta */}
      {showNew && (
        <Modal title="Crear cuenta contable" onClose={() => setShowNew(false)}>
          <form noValidate onSubmit={e => { e.preventDefault(); guardarNueva(); }}>
            <div className="space-y-3 p-5">
              <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
                <legend className="px-2 text-xs font-semibold text-petroleum-800">Identificación</legend>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="pc-nuevo-codigo" className="block text-xs font-medium text-gray-600 mb-1">Código *</label>
                    <input id="pc-nuevo-codigo" data-initial-focus className={`${INPUT} font-mono`} value={formNueva.codigo} placeholder="Ej. 510506"
                      onChange={e => { setFormNueva({ ...formNueva, codigo: e.target.value }); setErroresNueva({ ...erroresNueva, codigo: undefined }); }}
                      aria-invalid={!!erroresNueva.codigo} />
                    {erroresNueva.codigo && <p className="mt-1 text-xs text-red-600">{erroresNueva.codigo}</p>}
                  </div>
                  <div>
                    <label htmlFor="pc-nuevo-nivel" className="block text-xs font-medium text-gray-600 mb-1">Nivel *</label>
                    <select id="pc-nuevo-nivel" className={INPUT} value={formNueva.nivel}
                      onChange={e => { setFormNueva({ ...formNueva, nivel: Number(e.target.value) }); setErroresNueva({ ...erroresNueva, nivel: undefined }); }}
                      aria-invalid={!!erroresNueva.nivel}>
                      {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {erroresNueva.nivel && <p className="mt-1 text-xs text-red-600">{erroresNueva.nivel}</p>}
                  </div>
                </div>
              </fieldset>
              <div>
                <label htmlFor="pc-nuevo-nombre" className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                <input id="pc-nuevo-nombre" className={INPUT} value={formNueva.nombre} placeholder="Nombre de la cuenta"
                  onChange={e => { setFormNueva({ ...formNueva, nombre: e.target.value }); setErroresNueva({ ...erroresNueva, nombre: undefined }); }}
                  aria-invalid={!!erroresNueva.nombre} />
                {erroresNueva.nombre && <p className="mt-1 text-xs text-red-600">{erroresNueva.nombre}</p>}
              </div>
              <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
                <legend className="px-2 text-xs font-semibold text-petroleum-800">Controles</legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {([
                    ['afectable', 'Afectable'],
                    ['requiereTercero', 'Requiere tercero'],
                    ['requiereCentro', 'Requiere centro'],
                    ['requiereBase', 'Requiere base'],
                    ['ajuste', 'Ajuste por inflación'],
                  ] as const).map(([campo, label]) => (
                    <label key={campo} className="flex cursor-pointer items-center gap-2.5 text-xs text-gray-700">
                      <input type="checkbox" checked={formNueva[campo]} onChange={e => setFormNueva({ ...formNueva, [campo]: e.target.checked })} className="mt-0.5 h-4 w-4 shrink-0 accent-petroleum-500" />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setShowNew(false)} className={BUTTON_SECONDARY}>Cancelar</button>
              <button type="submit" className={BUTTON_PRIMARY}>Guardar cuenta</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Editar cuenta */}
      {showEdit && selectedCuenta && (
        <Modal title={`Editar cuenta ${selectedCuenta.codigo}`} onClose={() => setShowEdit(false)}>
          <form noValidate onSubmit={e => { e.preventDefault(); guardarEditar(); }}>
            <div className="space-y-3 p-5">
              <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
                <legend className="px-2 text-xs font-semibold text-petroleum-800">Identificación</legend>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="pc-edit-codigo" className="block text-xs font-medium text-gray-600 mb-1">Código</label>
                    <input id="pc-edit-codigo" className={`${INPUT} font-mono bg-gray-50 text-gray-500`} value={formEdit.codigo} readOnly aria-readonly="true" />
                    <p className="mt-1 text-xs text-gray-400">El código no se puede cambiar; define la jerarquía.</p>
                  </div>
                  <div>
                    <label htmlFor="pc-edit-nivel" className="block text-xs font-medium text-gray-600 mb-1">Nivel *</label>
                    <select id="pc-edit-nivel" className={INPUT} value={formEdit.nivel}
                      onChange={e => { setFormEdit({ ...formEdit, nivel: Number(e.target.value) }); setErroresEdit({ ...erroresEdit, nivel: undefined }); }}
                      aria-invalid={!!erroresEdit.nivel}>
                      {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {erroresEdit.nivel && <p className="mt-1 text-xs text-red-600">{erroresEdit.nivel}</p>}
                  </div>
                </div>
              </fieldset>
              <div>
                <label htmlFor="pc-edit-nombre" className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                <input id="pc-edit-nombre" data-initial-focus className={INPUT} value={formEdit.nombre}
                  onChange={e => { setFormEdit({ ...formEdit, nombre: e.target.value }); setErroresEdit({ ...erroresEdit, nombre: undefined }); }}
                  aria-invalid={!!erroresEdit.nombre} />
                {erroresEdit.nombre && <p className="mt-1 text-xs text-red-600">{erroresEdit.nombre}</p>}
              </div>
              <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
                <legend className="px-2 text-xs font-semibold text-petroleum-800">Controles</legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {([
                    ['afectable', 'Afectable'],
                    ['requiereTercero', 'Requiere tercero'],
                    ['requiereCentro', 'Requiere centro'],
                    ['requiereBase', 'Requiere base'],
                    ['ajuste', 'Ajuste por inflación'],
                  ] as const).map(([campo, label]) => (
                    <label key={campo} className="flex cursor-pointer items-center gap-2.5 text-xs text-gray-700">
                      <input type="checkbox" checked={formEdit[campo]} onChange={e => setFormEdit({ ...formEdit, [campo]: e.target.checked })} className="mt-0.5 h-4 w-4 shrink-0 accent-petroleum-500" />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setShowEdit(false)} className={BUTTON_SECONDARY}>Cancelar</button>
              <button type="submit" className={BUTTON_PRIMARY}>Guardar cambios</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Eliminar (confirmación) */}
      {showEliminar && selectedCuenta && (
        <Modal title="Eliminar cuenta" onClose={() => setShowEliminar(false)}>
          <p className="p-5 text-sm text-gray-600">
            ¿Confirma la eliminación de la cuenta <strong className="font-mono">{selectedCuenta.codigo}</strong> — {selectedCuenta.nombre}? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" data-initial-focus onClick={() => setShowEliminar(false)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="button" onClick={confirmarEliminar} className="rounded bg-red-500 px-5 py-2 text-sm font-medium text-white hover:bg-red-600">Eliminar</button>
          </div>
        </Modal>
      )}

      {/* Eliminar bloqueada */}
      {showBloqueo && (
        <Modal title="No se puede eliminar la cuenta" onClose={() => setShowBloqueo(null)}>
          <div className="space-y-3 p-5">
            <p className="text-sm text-gray-600">
              La cuenta <strong className="font-mono">{showBloqueo.cuenta.codigo}</strong> — {showBloqueo.cuenta.nombre} no cumple los requisitos para ser eliminada:
            </p>
            <ul className="space-y-1.5">
              {showBloqueo.motivos.map((m, i) => (
                <li key={i} className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <span>⚠</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400">Elimine las dependencias o ponga en cero los saldos antes de intentarlo de nuevo.</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" data-initial-focus onClick={() => setShowBloqueo(null)} className={BUTTON_PRIMARY}>Entendido</button>
          </div>
        </Modal>
      )}

      {/* Impacto por cambio de controles */}
      {showImpacto && (
        <Modal title="Cambio de controles con movimiento registrado" onClose={() => setShowImpacto(null)}>
          <div className="space-y-3 p-5">
            <p className="text-sm leading-relaxed text-gray-700">
              La cuenta <strong className="font-mono">{showImpacto.original.codigo}</strong> tiene saldo y/o movimiento registrado en el libro mayor. Cambiar sus controles (afectable, requiere tercero o requiere centro) puede invalidar asientos existentes.
            </p>
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <strong>{documentosImpacto.length}</strong> documento{documentosImpacto.length !== 1 ? 's' : ''} afectado{documentosImpacto.length !== 1 ? 's' : ''} en el período actual.
            </div>
            {documentosImpacto.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Documento</th>
                      <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Fecha</th>
                      <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Concepto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {documentosImpacto.map(m => (
                      <tr key={m.id}>
                        <td className="px-3 py-1.5 font-mono">{m.documento}</td>
                        <td className="px-3 py-1.5 font-mono text-gray-500">{m.fecha}</td>
                        <td className="px-3 py-1.5 text-gray-600">{m.concepto}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-gray-500">La acción quedará registrada en la bitácora con su usuario y fecha. ¿Desea aplicar el cambio de todos modos?</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" data-initial-focus onClick={() => setShowImpacto(null)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="button" onClick={() => aplicarEdicion(showImpacto.nuevo)} className={BUTTON_PRIMARY}>Aplicar cambio</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
