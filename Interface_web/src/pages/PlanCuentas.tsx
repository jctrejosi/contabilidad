import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { fmtCOP } from '../data/mock';
import { actualizarCuenta, crearCuenta, listarCuentas, type CuentaWrite } from '../api/cuentas';
import type { Cuenta } from '../types';

/*
 * Pantalla de mantenimiento del Plan de cuentas.
 *
 * Fuente real: CONMAE a través del backend Python. La pantalla solo permite
 * mantener los datos maestros autorizados; saldos y acumulados mensuales son
 * de consulta porque los actualiza el proceso contable, no este formulario.
 */
const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

const NIVELES = [1, 2, 4, 6, 9, 12];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const PAGE_SIZE = 100;
const TREE_ROW_HEIGHT = 32;
const TREE_OVERSCAN = 12;

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
  // CONMAE entrega débitos positivos y el adaptador convierte créditos a valor
  // positivo; por eso el saldo visible se calcula como débito menos crédito.
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
  // ``nivel`` solo guía y valida la creación. En edición se deriva de la
  // longitud de CODIGO y permanece bloqueado junto con el código.
  codigo: string;
  nombre: string;
  nivel: number;
  afectable: boolean;
  requiereTercero: boolean;
  requiereCentro: boolean;
  ajuste: boolean;
  tipoFiscal: 'O' | 'I' | 'R';
}

interface TreeRow {
  cuenta: Cuenta;
  profundidad: number;
}

function formVacio(): FormCuenta {
  return { codigo: '', nombre: '', nivel: 4, afectable: true, requiereTercero: false, requiereCentro: false, ajuste: false, tipoFiscal: 'O' };
}

function formDe(c: Cuenta): FormCuenta {
  return {
    codigo: c.codigo,
    nombre: c.nombre,
    nivel: c.nivel,
    afectable: c.afectable,
    requiereTercero: c.requiereTercero,
    requiereCentro: c.requiereCentro,
    ajuste: c.ajuste,
    tipoFiscal: c.claseIVA ? 'I' : c.claseRetencion ? 'R' : 'O',
  };
}

export default function PlanCuentas({ cia }: { cia: string }) {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorConexion, setErrorConexion] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [view, setView] = useState<'tree' | 'table'>('tree');
  const [filterText, setFilterText] = useState('');
  const [filterTipo, setFilterTipo] = useState<'todas' | 'afectables' | 'retenciones' | 'iva' | 'base'>('todas');
  const [pagina, setPagina] = useState(1);
  const [treeScrollTop, setTreeScrollTop] = useState(0);
  const [treeViewportHeight, setTreeViewportHeight] = useState(480);
  const [selectedCodigo, setSelectedCodigo] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showImpacto, setShowImpacto] = useState<{ original: Cuenta; nuevo: FormCuenta } | null>(null);
  const [formNueva, setFormNueva] = useState<FormCuenta>(formVacio);
  const [formEdit, setFormEdit] = useState<FormCuenta>(formVacio);
  const [erroresNueva, setErroresNueva] = useState<{ codigo?: string; nombre?: string; nivel?: string }>({});
  const [erroresEdit, setErroresEdit] = useState<{ nombre?: string; nivel?: string }>({});
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const treeViewportRef = useRef<HTMLDivElement>(null);

  async function cargarCuentas() {
    // La API ya excluye auxiliares por tercero: aquí se reciben solo cuentas
    // maestras y se prepara el árbol completamente desplegado, tal como se
    // consulta el catálogo jerárquico en el proceso contable.
    setCargando(true);
    setErrorConexion(null);
    try {
      const items = await listarCuentas(cia);
      setCuentas(items);
      setSelectedCodigo(actual => actual && items.some(c => c.codigo === actual) ? actual : null);
    } catch (error) {
      setCuentas([]);
      setErrorConexion(error instanceof Error ? error.message : 'No fue posible consultar CONMAE.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarCuentas();
  }, [cia]);

  useEffect(() => {
    setPagina(1);
    setTreeScrollTop(0);
    if (treeViewportRef.current) treeViewportRef.current.scrollTop = 0;
  }, [filterText, filterTipo]);

  useEffect(() => {
    if (view !== 'tree' || !treeViewportRef.current) return;
    const viewport = treeViewportRef.current;
    const updateHeight = () => setTreeViewportHeight(viewport.clientHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [view]);

  const selectedCuenta = cuentas.find(c => c.codigo === selectedCodigo) || null;

  const hierarchy = useMemo(() => {
    // CONMAE no tiene una columna padre. Se crea una vez un índice por prefijo
    // válido para evitar comparar cada cuenta contra las otras 4.000 durante
    // cada render del árbol expandido.
    const byCode = new Set(cuentas.map(cuenta => cuenta.codigo));
    const parentByCode = new Map<string, string | null>();
    const childrenByParent = new Map<string | null, Cuenta[]>();
    const levelsDescending = [...NIVELES].sort((a, b) => b - a);

    for (const cuenta of cuentas) {
      let parent: string | null = null;
      for (const length of levelsDescending) {
        if (length >= cuenta.codigo.length) continue;
        const candidate = cuenta.codigo.slice(0, length);
        if (byCode.has(candidate)) {
          parent = candidate;
          break;
        }
      }
      parentByCode.set(cuenta.codigo, parent);
      const siblings = childrenByParent.get(parent) ?? [];
      siblings.push(cuenta);
      childrenByParent.set(parent, siblings);
    }

    for (const siblings of childrenByParent.values()) {
      siblings.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
    }
    return { parentByCode, childrenByParent };
  }, [cuentas]);

  const hijosDe = (codigo: string): Cuenta[] => hierarchy.childrenByParent.get(codigo) ?? [];

  const filterActivo = filterText !== '' || filterTipo !== 'todas';
  const filterResult = useMemo(() => {
    const query = filterText.toLowerCase();
    const matches = cuentas.filter(cuenta => {
      if (filterTipo === 'afectables' && !cuenta.afectable) return false;
      if (filterTipo === 'base' && cuenta.nivel > 2) return false;
      if (filterTipo === 'retenciones' && !cuenta.claseRetencion) return false;
      if (filterTipo === 'iva' && !cuenta.claseIVA) return false;
      return !query || cuenta.codigo.includes(query) || cuenta.nombre.toLowerCase().includes(query);
    });
    matches.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

    const visibleCodes = new Set<string>();
    if (filterActivo) {
      for (const cuenta of matches) {
        let current: string | null = cuenta.codigo;
        while (current) {
          visibleCodes.add(current);
          current = hierarchy.parentByCode.get(current) ?? null;
        }
      }
    }
    return { matches, visibleCodes };
  }, [cuentas, filterActivo, filterText, filterTipo, hierarchy]);

  const filtered = filterResult.matches;
  const treeRows = useMemo(() => {
    const rows: TreeRow[] = [];
    const append = (siblings: Cuenta[], profundidad: number) => {
      for (const cuenta of siblings) {
        if (filterActivo && !filterResult.visibleCodes.has(cuenta.codigo)) continue;
        rows.push({ cuenta, profundidad });
        append(hierarchy.childrenByParent.get(cuenta.codigo) ?? [], profundidad + 1);
      }
    };
    append(hierarchy.childrenByParent.get(null) ?? [], 0);
    return rows;
  }, [filterActivo, filterResult.visibleCodes, hierarchy]);

  const totalPaginas = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const cuentasPagina = filtered.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE);
  const treeStart = Math.max(0, Math.floor(treeScrollTop / TREE_ROW_HEIGHT) - TREE_OVERSCAN);
  const treeEnd = Math.min(
    treeRows.length,
    Math.ceil((treeScrollTop + treeViewportHeight) / TREE_ROW_HEIGHT) + TREE_OVERSCAN,
  );
  const visibleTreeRows = treeRows.slice(treeStart, treeEnd);

  function abrirNueva() {
    setFormNueva(formVacio());
    setErroresNueva({});
    setShowNew(true);
  }

  async function guardarNueva() {
    // La validación visual replica los niveles permitidos en PLANMAES.PRG. El
    // backend vuelve a validar para proteger la base aunque se omita la UI.
    const e: typeof erroresNueva = {};
    const codigo = formNueva.codigo.trim();
    if (!codigo) e.codigo = 'El código es obligatorio.';
    else if (!/^\d+$/.test(codigo)) e.codigo = 'El código solo puede contener números.';
    else if (cuentas.some(c => c.codigo === codigo)) e.codigo = `Ya existe la cuenta ${codigo}.`;
    if (!formNueva.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
    if (!(NIVELES as readonly number[]).includes(formNueva.nivel)) e.nivel = 'El nivel debe ser 1, 2, 4, 6, 9 o 12.';
    else if (codigo && codigo.length !== formNueva.nivel) e.nivel = `El nivel debe coincidir con los ${codigo.length} dígitos del código.`;
    setErroresNueva(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    try {
      const creada = await crearCuenta(cia, { codigo, ...payloadDe(formNueva) });
      setCuentas(prev => [...prev, creada]);
      setShowNew(false);
      setSelectedCodigo(creada.codigo);
      setFilterText(creada.codigo);
      setAviso({ tipo: 'success', texto: `Cuenta ${creada.codigo} creada en CONMAE.` });
    } catch (error) {
      setAviso({ tipo: 'error', texto: error instanceof Error ? error.message : 'No fue posible crear la cuenta.' });
    } finally {
      setGuardando(false);
    }
  }

  function abrirEditar(c: Cuenta) {
    setSelectedCodigo(c.codigo);
    setFormEdit(formDe(c));
    setErroresEdit({});
    setShowEdit(true);
  }

  function payloadDe(f: FormCuenta): CuentaWrite {
    // Deliberadamente no se envían saldo ni acumulados: este módulo no tiene
    // autorización para alterar la información resultante de movimientos.
    return {
      nombre: f.nombre.trim(),
      afectable: f.afectable,
      requiereTercero: f.requiereTercero,
      requiereCentro: f.requiereCentro,
      ajuste: f.ajuste,
      tipoFiscal: f.tipoFiscal,
    };
  }

  async function aplicarEdicion(f: FormCuenta) {
    if (!selectedCodigo) return;
    setGuardando(true);
    try {
      const actualizada = await actualizarCuenta(cia, selectedCodigo, payloadDe(f));
      setCuentas(prev => prev.map(c => c.codigo === selectedCodigo ? actualizada : c));
      setShowEdit(false);
      setShowImpacto(null);
      setAviso({ tipo: 'success', texto: `Cuenta ${selectedCodigo} actualizada en CONMAE.` });
    } catch (error) {
      setAviso({ tipo: 'error', texto: error instanceof Error ? error.message : 'No fue posible actualizar la cuenta.' });
    } finally {
      setGuardando(false);
    }
  }

  function guardarEditar() {
    // Si una cuenta ya tiene historia, el usuario confirma antes de cambiar
    // controles que afectan la captura futura de comprobantes.
    if (!selectedCuenta) return;
    const e: typeof erroresEdit = {};
    if (!formEdit.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
    if (!(NIVELES as readonly number[]).includes(formEdit.nivel)) e.nivel = 'El nivel debe ser 1, 2, 4, 6, 9 o 12.';
    setErroresEdit(e);
    if (Object.keys(e).length) return;
    const tipoFiscalActual = selectedCuenta.claseIVA ? 'I' : selectedCuenta.claseRetencion ? 'R' : 'O';
    const cambioControl = formEdit.afectable !== selectedCuenta.afectable || formEdit.requiereTercero !== selectedCuenta.requiereTercero || formEdit.requiereCentro !== selectedCuenta.requiereCentro || formEdit.tipoFiscal !== tipoFiscalActual;
    if (cambioControl && tieneMovimiento(selectedCuenta)) {
      setShowImpacto({ original: selectedCuenta, nuevo: formEdit });
      return;
    }
    aplicarEdicion(formEdit);
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

  function renderFilaArbol({ cuenta: c, profundidad }: TreeRow, index: number): ReactNode {
    const hijos = hijosDe(c.codigo);
    const sal = saldo(c);
    const esSeleccionada = selectedCodigo === c.codigo;
    return (
      <div
        key={c.codigo}
        role="treeitem"
        aria-level={profundidad + 1}
        onClick={() => setSelectedCodigo(c.codigo)}
        className={`absolute left-0 right-0 flex cursor-pointer items-center gap-2 border-b border-gray-50 pr-3 text-xs hover:bg-gray-50 ${esSeleccionada ? 'bg-blue-50' : 'bg-white'}`}
        style={{
          height: `${TREE_ROW_HEIGHT}px`,
          paddingLeft: `${12 + profundidad * 18}px`,
          transform: `translateY(${index * TREE_ROW_HEIGHT}px)`,
        }}
      >
        <span
          aria-hidden="true"
          className={`w-4 shrink-0 text-center ${hijos.length ? 'text-petroleum-500' : 'text-gray-300'}`}
        >
          {hijos.length ? '◆' : '•'}
        </span>
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
        </span>
      </div>
    );
  }

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
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${errorConexion ? 'border-red-200 bg-red-50 text-red-700' : cargando ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
            {errorConexion ? 'Sin conexión a Advantage' : cargando ? `Consultando CONMAE · CIA ${cia}…` : `Advantage · CIA ${cia} · ${cuentas.length} cuentas`}
          </span>
          <button onClick={() => window.print()} className={BUTTON_SECONDARY}>⎙ Imprimir</button>
          <button onClick={exportarCSV} disabled={cargando || !!errorConexion} className={`${BUTTON_SECONDARY} disabled:cursor-not-allowed disabled:opacity-50`}>↓ Exportar</button>
          <button onClick={abrirNueva} disabled={cargando || !!errorConexion} className={`${BUTTON_PRIMARY} disabled:cursor-not-allowed disabled:opacity-50`}>+ Crear cuenta</button>
        </div>
      </div>

      {errorConexion && (
        <div role="alert" className="flex items-center justify-between rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{errorConexion} Verifique que el servicio Python esté iniciado.</span>
          <button type="button" onClick={cargarCuentas} className="rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium hover:bg-red-100">Reintentar</button>
        </div>
      )}

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
                    {cuentasPagina.map(cuenta => {
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
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
                <span>{filtered.length} cuenta{filtered.length !== 1 ? 's' : ''} · Página {paginaActual} de {totalPaginas}</span>
                <div className="flex gap-1">
                  <button type="button" disabled={paginaActual === 1} onClick={() => setPagina(p => Math.max(1, p - 1))} className="rounded border border-gray-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
                  <button type="button" disabled={paginaActual === totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} className="rounded border border-gray-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
                </div>
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
              <div
                ref={treeViewportRef}
                role="tree"
                aria-label="Plan de cuentas jerárquico"
                onScroll={event => setTreeScrollTop(event.currentTarget.scrollTop)}
                className="h-[calc(100vh-19rem)] min-h-[28rem] overflow-auto"
              >
                <div className="relative min-w-[58rem]" style={{ height: `${treeRows.length * TREE_ROW_HEIGHT}px` }}>
                  {visibleTreeRows.map((row, offset) => renderFilaArbol(row, treeStart + offset))}
                </div>
              </div>
              <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
                {filtered.length} cuenta{filtered.length !== 1 ? 's' : ''} {filterActivo ? `· ${treeRows.length} nodos con sus cuentas superiores` : '· árbol completo'}
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
              <div className="border-b border-gray-200 bg-petroleum-50 px-3 py-2 text-xs font-medium text-petroleum-700">
                Saldo inicial y movimientos acumulados
              </div>
              <div className="p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-gray-600">Saldo inicial</span>
                  <span className="font-mono text-gray-800">{fmtCOP(Math.abs(selectedCuenta.saldoInicial))}</span>
                </div>
                <div className="grid grid-cols-[2.2rem_minmax(0,1fr)_minmax(0,1fr)] gap-1 text-[11px] font-semibold text-gray-500">
                  <span>Mes</span><span className="text-right">Débito</span><span className="text-right">Crédito</span>
                </div>
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {MESES.map((mes, idx) => {
                    const movement = selectedCuenta.movimientos[idx] ?? { mes: idx + 1, debito: 0, credito: 0 };
                    return (
                      <div key={mes} className="grid grid-cols-[2.2rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1 border-b border-gray-50 py-1 text-xs">
                        <span className="text-gray-500">{mes}</span>
                        <span className="font-mono text-right text-gray-700">{fmtCOP(movement.debito)}</span>
                        <span className="font-mono text-right text-gray-700">{fmtCOP(movement.credito)}</span>
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
                <p className="text-[11px] leading-relaxed text-gray-400">
                  Valores de consulta tomados de CONMAE. Los saldos se actualizan mediante el proceso de movimientos contables.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => abrirEditar(selectedCuenta)} className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Editar</button>
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
                    ['ajuste', 'Ajuste por inflación'],
                  ] as const).map(([campo, label]) => (
                    <label key={campo} className="flex cursor-pointer items-center gap-2.5 text-xs text-gray-700">
                      <input type="checkbox" checked={formNueva[campo]} onChange={e => setFormNueva({ ...formNueva, [campo]: e.target.checked })} className="mt-0.5 h-4 w-4 shrink-0 accent-petroleum-500" />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <label htmlFor="pc-nuevo-fiscal" className="mb-1 block text-xs font-medium text-gray-600">Clasificación fiscal</label>
                  <select id="pc-nuevo-fiscal" className={INPUT} value={formNueva.tipoFiscal} onChange={e => setFormNueva({ ...formNueva, tipoFiscal: e.target.value as FormCuenta['tipoFiscal'] })}>
                    <option value="O">Otra cuenta</option>
                    <option value="I">IVA — requiere base</option>
                    <option value="R">Retención — requiere base</option>
                  </select>
                </div>
              </fieldset>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setShowNew(false)} className={BUTTON_SECONDARY}>Cancelar</button>
              <button type="submit" disabled={guardando} className={`${BUTTON_PRIMARY} disabled:cursor-wait disabled:opacity-60`}>{guardando ? 'Guardando…' : 'Guardar cuenta'}</button>
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
                    <select id="pc-edit-nivel" className={`${INPUT} bg-gray-50 text-gray-500`} value={formEdit.nivel} disabled aria-disabled="true">
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
                    ['ajuste', 'Ajuste por inflación'],
                  ] as const).map(([campo, label]) => (
                    <label key={campo} className="flex cursor-pointer items-center gap-2.5 text-xs text-gray-700">
                      <input type="checkbox" checked={formEdit[campo]} onChange={e => setFormEdit({ ...formEdit, [campo]: e.target.checked })} className="mt-0.5 h-4 w-4 shrink-0 accent-petroleum-500" />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <label htmlFor="pc-edit-fiscal" className="mb-1 block text-xs font-medium text-gray-600">Clasificación fiscal</label>
                  <select id="pc-edit-fiscal" className={INPUT} value={formEdit.tipoFiscal} onChange={e => setFormEdit({ ...formEdit, tipoFiscal: e.target.value as FormCuenta['tipoFiscal'] })}>
                    <option value="O">Otra cuenta</option>
                    <option value="I">IVA — requiere base</option>
                    <option value="R">Retención — requiere base</option>
                  </select>
                </div>
              </fieldset>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setShowEdit(false)} className={BUTTON_SECONDARY}>Cancelar</button>
              <button type="submit" disabled={guardando} className={`${BUTTON_PRIMARY} disabled:cursor-wait disabled:opacity-60`}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Impacto por cambio de controles */}
      {showImpacto && (
        <Modal title="Cambio de controles con movimiento registrado" onClose={() => setShowImpacto(null)}>
          <div className="space-y-3 p-5">
            <p className="text-sm leading-relaxed text-gray-700">
              La cuenta <strong className="font-mono">{showImpacto.original.codigo}</strong> tiene saldo y/o movimiento registrado en el libro mayor. Cambiar sus controles (afectable, requiere tercero o requiere centro) puede invalidar asientos existentes.
            </p>
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              El sistema conservará los saldos y movimientos existentes; solamente actualizará los controles de la cuenta maestra en CONMAE.
            </div>
            <p className="text-xs text-gray-500">¿Desea aplicar el cambio de todos modos?</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" data-initial-focus onClick={() => setShowImpacto(null)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="button" disabled={guardando} onClick={() => aplicarEdicion(showImpacto.nuevo)} className={`${BUTTON_PRIMARY} disabled:cursor-wait disabled:opacity-60`}>{guardando ? 'Guardando…' : 'Aplicar cambio'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
