import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CUENTAS, EMPRESA, fmtCOP } from '../data/mock';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

type Tab = 'retenciones' | 'iva' | 'medios';

interface Props {
  initialTab?: Tab;
}

const MOCK_RETENCIONES = [
  { nit: '800.100.200', nombre: 'Empresa ABC Comercial S.A.S.', concepto: 'Honorarios', base: 15000000, tarifa: 10, valor: 1500000, periodo: '2026-01' },
  { nit: '900.200.300', nombre: 'Comercial XYZ Distribuciones Ltda.', concepto: 'Servicios', base: 8500000, tarifa: 4, valor: 340000, periodo: '2026-01' },
  { nit: '800.100.200', nombre: 'Empresa ABC Comercial S.A.S.', concepto: 'Arrendamiento', base: 6000000, tarifa: 3.5, valor: 210000, periodo: '2026-02' },
];

const MOCK_IVA = [
  { nit: '800.100.200', nombre: 'Empresa ABC Comercial S.A.S.', base: 15000000, iva19: 2850000, ivaDescontable: 0, neto: 2850000, periodo: '2026-01' },
  { nit: '900.200.300', nombre: 'Comercial XYZ Distribuciones Ltda.', base: 8500000, iva19: 1615000, ivaDescontable: 800000, neto: 815000, periodo: '2026-02' },
];

const SOPORTES_ANEXOS = [
  { nombre: 'Anexo_retenciones_2026-01.pdf', tipo: 'PDF', peso: '184 KB', fecha: '2026-01-31' },
  { nombre: 'Certificados_enero_2026.zip', tipo: 'ZIP', peso: '1,2 MB', fecha: '2026-01-31' },
  { nombre: 'Plano_anual_retenciones.xml', tipo: 'XML', peso: '96 KB', fecha: '2026-01-31' },
];

const MEDIOS_STEPS = ['Formatos', 'Conceptos', 'Asignación cuentas', 'Generación', 'Revisión', 'Topes/cruces', 'Exportación'];

// ---------------- medios magnéticos: datos ----------------

type FormatoMedio = { id: string; nombre: string; vigencia: string; estado: 'Activo' | 'Pendiente' };

const FORMATOS_INICIALES: FormatoMedio[] = [
  { id: 'F1001', nombre: 'Pagos o abonos en cuenta', vigencia: '2026', estado: 'Activo' },
  { id: 'F1007', nombre: 'Ingresos recibidos', vigencia: '2026', estado: 'Activo' },
  { id: 'F1008', nombre: 'Descuentos tributarios', vigencia: '2026', estado: 'Pendiente' },
];

type ConceptoMedio = { id: string; formato: string; concepto: string; tarifa: number; cuenta: string; nombreCuenta: string };

const CONCEPTOS_INICIALES: ConceptoMedio[] = [
  { id: 'c1', formato: 'F1001', concepto: 'Honorarios', tarifa: 10, cuenta: '236525', nombreCuenta: 'Honorarios' },
  { id: 'c2', formato: 'F1001', concepto: 'Servicios', tarifa: 4, cuenta: '236540', nombreCuenta: 'Servicios' },
  { id: 'c3', formato: 'F1001', concepto: 'Arrendamientos', tarifa: 3.5, cuenta: '236560', nombreCuenta: 'Arrendamientos' },
  { id: 'c4', formato: 'F1007', concepto: 'Ventas gravadas', tarifa: 19, cuenta: '240805', nombreCuenta: 'IVA por pagar' },
];

type Asignaciones = Record<string, string[]>;

const ASIG_INICIALES: Asignaciones = {
  '236525': ['F1001'],
  '236540': ['F1001'],
  '236560': ['F1001'],
  '240805': ['F1007'],
};

const COPIA_DEFINICIONES: Record<string, Asignaciones> = {
  '002': {
    '236525': ['F1001', 'F1008'],
    '236540': ['F1001'],
    '236560': ['F1001'],
    '240805': ['F1007'],
  },
  '003': {
    '236525': ['F1001'],
    '236540': ['F1001', 'F1008'],
    '236560': ['F1001'],
    '240805': ['F1007', 'F1008'],
  },
};

type VersionMedio = { id: string; version: number; fecha: string; formatos: number; registros: number; estado: 'Generada' | 'Exportada' };

const VERSIONES_INICIALES: VersionMedio[] = [
  { id: 'v1', version: 1, fecha: '2026-02-15 14:22', formatos: 3, registros: 142, estado: 'Exportada' },
];

type FilaMedio = { id: string; formato: string; nit: string; nombre: string; concepto: string; base: number; tarifa: number; valor: number };

const FILAS_MEDIO_INICIALES: FilaMedio[] = [
  { id: 'r1', formato: 'F1001', nit: '800.100.200', nombre: 'Empresa ABC Comercial S.A.S.', concepto: 'Honorarios', base: 15000000, tarifa: 10, valor: 1500000 },
  { id: 'r2', formato: 'F1001', nit: '900.200.300', nombre: 'Comercial XYZ Distribuciones Ltda.', concepto: 'Servicios', base: 8500000, tarifa: 4, valor: 340000 },
  { id: 'r3', formato: 'F1001', nit: '800.100.200', nombre: 'Empresa ABC Comercial S.A.S.', concepto: 'Arrendamiento', base: 6000000, tarifa: 3.5, valor: 210000 },
];

type TopeRow = { id: string; formato: string; nit: string; nombre: string; concepto: string; valor: number; tope: number };

const TOPES_INICIALES: TopeRow[] = [
  { id: 't1', formato: 'F1001', nit: '800.100.200', nombre: 'Empresa ABC Comercial S.A.S.', concepto: 'Honorarios', valor: 15000000, tope: 10000000 },
  { id: 't2', formato: 'F1001', nit: '900.200.300', nombre: 'Comercial XYZ Distribuciones Ltda.', concepto: 'Servicios', valor: 8500000, tope: 8000000 },
  { id: 't3', formato: 'F1001', nit: '12.345.678', nombre: 'García Moreno Juan Pablo', concepto: 'Caja menor no deducible', valor: 500000, tope: 0 },
];

const CRUCES_INICIALES = [
  { id: 'x1', nit: '800.100.200', nombre: 'Empresa ABC Comercial S.A.S.', f1001: 15000000, f1007: 14500000 },
  { id: 'x2', nit: '900.200.300', nombre: 'Comercial XYZ Distribuciones Ltda.', f1001: 8500000, f1007: 8500000 },
];

const TOTAL_CONTABLE = 22600000;
const EXCLUSIONES = 2400000;
const TOPES_NO_REPORTADOS = 1800000;
const BASE_REPORTADA = 17900000;

type Ajuste = { id: string; detalle: string; valor: number };

function fechaHora(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Modal({ title, onClose, ancho = 'max-w-lg', children }: { title: string; onClose: () => void; ancho?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} className={`fixed inset-0 m-auto w-[calc(100%_-_2rem)] ${ancho} rounded-lg border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/40`}>
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 id={titleId} className="text-sm font-semibold text-gray-800">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar diálogo" className="rounded px-2 text-xl text-gray-500 hover:bg-gray-100">×</button>
      </div>
      {children}
    </dialog>
  );
}

function Badge({ texto, color }: { texto: string; color: 'green' | 'red' | 'amber' | 'blue' | 'gray' }) {
  const clases: Record<string, string> = {
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    gray: 'bg-gray-100 text-gray-600',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${clases[color]}`}>{texto}</span>;
}

export default function ImpuestosPage({ initialTab = 'retenciones' }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [mediosStep, setMediosStep] = useState(0);

  // Retenciones / IVA
  const [periodoFiltro, setPeriodoFiltro] = useState('');
  const [busquedaRet, setBusquedaRet] = useState('');
  const [ultimaRet, setUltimaRet] = useState('2026-01-31');
  const [ultimaIva, setUltimaIva] = useState('2026-01-31');
  const [acumulando, setAcumulando] = useState<string | null>(null);
  const [showLimpiar, setShowLimpiar] = useState<'ret' | 'iva' | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargasPortal, setCargasPortal] = useState([
    { id: 'cp1', certificado: 'Certificado_800100200_2026.pdf', tercero: 'Empresa ABC Comercial S.A.S.', periodo: '2026-01', estado: 'Cargado' },
    { id: 'cp2', certificado: 'Certificado_900200300_2026.pdf', tercero: 'Comercial XYZ Distribuciones Ltda.', periodo: '2026-01', estado: 'Pendiente' },
    { id: 'cp3', certificado: 'Certificado_800100200_2026-02.pdf', tercero: 'Empresa ABC Comercial S.A.S.', periodo: '2026-02', estado: 'Rechazado' },
  ]);
  const [cargandoPortal, setCargandoPortal] = useState<string | null>(null);

  // Medios magnéticos
  const [formatos, setFormatos] = useState<FormatoMedio[]>(FORMATOS_INICIALES);
  const [conceptos, setConceptos] = useState<ConceptoMedio[]>(CONCEPTOS_INICIALES);
  const [formatoConceptos, setFormatoConceptos] = useState('F1001');
  const [asignaciones, setAsignaciones] = useState<Asignaciones>(ASIG_INICIALES);
  const [companiaCopiar, setCompaniaCopiar] = useState('002');
  const [copiando, setCopiando] = useState(false);
  const [genAnio, setGenAnio] = useState('2026');
  const [genVersion, setGenVersion] = useState(2);
  const [genCorte, setGenCorte] = useState('2026-02-28');
  const [genSinMovimiento, setGenSinMovimiento] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [progresoGen, setProgresoGen] = useState(0);
  const [versiones, setVersiones] = useState<VersionMedio[]>(VERSIONES_INICIALES);
  const [filasMedio, setFilasMedio] = useState<FilaMedio[]>(FILAS_MEDIO_INICIALES);
  const [editandoFila, setEditandoFila] = useState<string | null>(null);
  const [filaEnEdicion, setFilaEnEdicion] = useState<FilaMedio | null>(null);
  const [modalFila, setModalFila] = useState<{ tipo: 'detalle' | 'variante' | 'identificacion'; fila: FilaMedio } | null>(null);
  const [topes, setTopes] = useState<TopeRow[]>(TOPES_INICIALES);
  const [ajustesTope, setAjustesTope] = useState<Record<string, boolean>>({});
  const [ajustes, setAjustes] = useState<Ajuste[]>([]);
  const [ajusteManual, setAjusteManual] = useState('');
  const [cruces] = useState(CRUCES_INICIALES);
  const [versionExportar, setVersionExportar] = useState('v1');

  // Modales
  const [showFormatoModal, setShowFormatoModal] = useState(false);
  const [showConceptoModal, setShowConceptoModal] = useState(false);
  const [conceptoEditando, setConceptoEditando] = useState<ConceptoMedio | null>(null);
  const [formFormato, setFormFormato] = useState({ id: '', nombre: '', vigencia: '2026' });
  const [formConcepto, setFormConcepto] = useState({ concepto: '', tarifa: '0', cuenta: '236540' });
  const [showFilaModal, setShowFilaModal] = useState(false);
  const [formFila, setFormFila] = useState({ formato: 'F1001', nit: '', nombre: '', concepto: '', base: '0', tarifa: '0' });

  // Progreso de generación
  useEffect(() => {
    if (!generando) return;
    const id = window.setInterval(() => setProgresoGen(p => Math.min(100, p + 10)), 250);
    return () => window.clearInterval(id);
  }, [generando]);

  useEffect(() => {
    if (!generando || progresoGen < 100) return;
    const t = window.setTimeout(() => {
      setGenerando(false);
      const nueva: VersionMedio = { id: `v-${Date.now()}`, version: genVersion, fecha: fechaHora(), formatos: formatos.length, registros: 148, estado: 'Generada' };
      setVersiones(prev => [nueva, ...prev]);
      setGenVersion(v => v + 1);
      setMensaje(`Medios magnéticos generados: versión ${genVersion} con 148 registros en ${formatos.length} formatos (simulado).`);
    }, 300);
    return () => window.clearTimeout(t);
  }, [generando, progresoGen, genVersion, formatos.length]);

  const tabLabel: Record<Tab, string> = {
    retenciones: 'Retenciones',
    iva: 'IVA',
    medios: 'Medios magnéticos',
  };

  const retFiltradas = MOCK_RETENCIONES.filter(r =>
    (!periodoFiltro || r.periodo === periodoFiltro) &&
    (!busquedaRet || r.nombre.toLowerCase().includes(busquedaRet.toLowerCase()) || r.nit.includes(busquedaRet))
  );

  function acumular(tipo: 'ret' | 'iva') {
    setAcumulando(tipo);
    setMensaje(null);
    window.setTimeout(() => {
      setAcumulando(null);
      if (tipo === 'ret') setUltimaRet('2026-02-28');
      else setUltimaIva('2026-02-28');
      setMensaje(`Acumulados de ${tipo === 'ret' ? 'retenciones' : 'IVA'} actualizados al período 2026-02 (simulado).`);
    }, 1000);
  }

  function limpiarAcumulados() {
    if (showLimpiar === 'ret') setUltimaRet('Ninguna — puede regenerar');
    else setUltimaIva('Ninguna — puede regenerar');
    setShowLimpiar(null);
    setMensaje('Acumulados eliminados. El libro contable no se modificó: puede regenerar en cualquier momento.');
  }

  function cargarPortal(id: string) {
    setCargandoPortal(id);
    window.setTimeout(() => {
      setCargandoPortal(null);
      setCargasPortal(prev => prev.map(c => (c.id === id ? { ...c, estado: 'Cargado' } : c)));
      setMensaje('Certificado cargado al portal DIAN (simulado).');
    }, 1000);
  }

  // ----- Medios: acciones por paso -----
  function agregarFormato(event: FormEvent) {
    event.preventDefault();
    const id = formFormato.id.trim().toUpperCase();
    if (!id || formatos.some(f => f.id === id)) {
      setMensaje('Código de formato inválido o repetido.');
      return;
    }
    setFormatos(prev => [...prev, { id, nombre: formFormato.nombre.trim() || `Formato ${id}`, vigencia: formFormato.vigencia, estado: 'Activo' }]);
    setShowFormatoModal(false);
    setFormFormato({ id: '', nombre: '', vigencia: '2026' });
    setMensaje(`Formato ${id} agregado (simulado).`);
  }

  function guardarConcepto(event: FormEvent) {
    event.preventDefault();
    const tarifa = parseFloat(formConcepto.tarifa) || 0;
    const cuenta = CUENTAS.find(c => c.codigo === formConcepto.cuenta);
    if (!formConcepto.concepto.trim()) {
      setMensaje('Ingrese el nombre del concepto.');
      return;
    }
    if (conceptoEditando) {
      setConceptos(prev => prev.map(c => (c.id === conceptoEditando.id ? { ...c, concepto: formConcepto.concepto.trim(), tarifa, cuenta: formConcepto.cuenta, nombreCuenta: cuenta?.nombre ?? '' } : c)));
      setMensaje('Concepto actualizado.');
    } else {
      setConceptos(prev => [...prev, { id: `c-${Date.now()}`, formato: formatoConceptos, concepto: formConcepto.concepto.trim(), tarifa, cuenta: formConcepto.cuenta, nombreCuenta: cuenta?.nombre ?? '' }]);
      setMensaje('Concepto agregado.');
    }
    setShowConceptoModal(false);
    setConceptoEditando(null);
    setFormConcepto({ concepto: '', tarifa: '0', cuenta: '236540' });
  }

  function eliminarConcepto(id: string) {
    setConceptos(prev => prev.filter(c => c.id !== id));
    setMensaje('Concepto eliminado.');
  }

  function toggleAsignacion(cuenta: string, formato: string) {
    setAsignaciones(prev => {
      const actuales = prev[cuenta] ?? [];
      const next = actuales.includes(formato) ? actuales.filter(f => f !== formato) : [...actuales, formato];
      return { ...prev, [cuenta]: next };
    });
  }

  function copiarDefiniciones() {
    setCopiando(true);
    window.setTimeout(() => {
      setCopiando(false);
      setAsignaciones(structuredClone(COPIA_DEFINICIONES[companiaCopiar]));
      setMensaje(`Definiciones de cuentas copiadas de la compañía ${companiaCopiar} (simulado).`);
    }, 1000);
  }

  function iniciarGeneracion() {
    setGenerando(true);
    setProgresoGen(0);
    setMensaje(null);
  }

  function iniciarEdicion(fila: FilaMedio) {
    setEditandoFila(fila.id);
    setFilaEnEdicion({ ...fila });
  }

  function guardarEdicion() {
    if (!filaEnEdicion) return;
    setFilasMedio(prev => prev.map(f => (f.id === filaEnEdicion.id ? filaEnEdicion : f)));
    setEditandoFila(null);
    setFilaEnEdicion(null);
    setMensaje('Fila actualizada.');
  }

  function eliminarFila(id: string) {
    setFilasMedio(prev => prev.filter(f => f.id !== id));
    setMensaje('Fila eliminada del medio generado.');
  }

  function agregarFila(event: FormEvent) {
    event.preventDefault();
    const base = parseFloat(formFila.base) || 0;
    const tarifa = parseFloat(formFila.tarifa) || 0;
    if (!formFila.nit.trim() || !formFila.nombre.trim()) {
      setMensaje('NIT y nombre del tercero son obligatorios.');
      return;
    }
    setFilasMedio(prev => [...prev, {
      id: `r-${Date.now()}`,
      formato: formFila.formato,
      nit: formFila.nit.trim(),
      nombre: formFila.nombre.trim(),
      concepto: formFila.concepto.trim() || 'Manual',
      base,
      tarifa,
      valor: Math.round(base * tarifa) / 100,
    }]);
    setShowFilaModal(false);
    setFormFila({ formato: 'F1001', nit: '', nombre: '', concepto: '', base: '0', tarifa: '0' });
    setMensaje('Fila agregada manualmente al medio.');
  }

  function usarVariante(fila: FilaMedio) {
    setFilasMedio(prev => prev.map(f => (f.id === fila.id ? { ...f, concepto: `${f.concepto} (variante)`, valor: Math.round(f.valor * 1.1) } : f)));
    setModalFila(null);
    setMensaje('Segunda variante aplicada a la fila.');
  }

  function aplicarAjuste(tope: TopeRow) {
    const exceso = Math.max(0, tope.valor - tope.tope);
    setAjustesTope(prev => ({ ...prev, [tope.id]: true }));
    setAjustes(prev => [...prev, { id: `aj-${tope.id}`, detalle: `${tope.concepto} — ${tope.nombre}`, valor: exceso }]);
  }

  function deshacerAjuste(tope: TopeRow) {
    setAjustesTope(prev => ({ ...prev, [tope.id]: false }));
    setAjustes(prev => prev.filter(a => a.id !== `aj-${tope.id}`));
  }

  function agregarAjusteManual() {
    const valor = parseFloat(ajusteManual);
    if (!valor || valor <= 0) {
      setMensaje('Ingrese un valor de ajuste válido.');
      return;
    }
    setAjustes(prev => [...prev, { id: `ajm-${Date.now()}`, detalle: 'Ajuste manual', valor }]);
    setAjusteManual('');
  }

  const esperado = TOTAL_CONTABLE - EXCLUSIONES - TOPES_NO_REPORTADOS;
  const sumaAjustes = ajustes.reduce((s, a) => s + a.valor, 0);
  const totalReportado = BASE_REPORTADA + sumaAjustes;
  const diferencia = esperado - totalReportado;

  const cuentasAfectables = CUENTAS.filter(c => c.afectable);
  const conceptosFiltrados = conceptos.filter(c => c.formato === formatoConceptos);

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Impuestos</div>
          <h1 className="text-lg font-semibold text-gray-800">Impuestos</h1>
          <p className="mt-1 text-xs text-gray-500">Retenciones, IVA y medios magnéticos para la DIAN.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {mensaje && <div role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{mensaje}</div>}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['retenciones', 'iva', 'medios'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === t ? 'border-petroleum-500 text-petroleum-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tabLabel[t]}
          </button>
        ))}
      </div>

      {/* ================= Retenciones ================= */}
      {tab === 'retenciones' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className={`rounded px-3 py-2 text-xs ${ultimaRet === '2026-01-31' ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
              {ultimaRet === '2026-01-31' ? `⚠ Última acumulación: ${ultimaRet} — Período feb 2026 no acumulado` : `✓ Última acumulación: ${ultimaRet}`}
            </div>
            <div className="flex-1" />
            <button onClick={() => acumular('ret')} disabled={!!acumulando} className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-60">
              {acumulando === 'ret' ? '⏳ Acumulando…' : 'Acumular período'}
            </button>
            <button onClick={() => setShowLimpiar('ret')} className="text-xs px-3 py-1.5 border border-red-200 rounded text-red-600 hover:bg-red-50">Limpiar acumulados</button>
            <a href="#plano-anual-ret" className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">⎙ Plano anual</a>
            <button onClick={() => setMensaje('Retenciones exportadas en XLSX (simulado).')} className="text-xs px-3 py-1.5 rounded bg-petroleum-500 text-white hover:bg-petroleum-600">↓ Exportar</button>
          </div>

          {/* Tabla principal de retenciones */}
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <input value={busquedaRet} onChange={e => setBusquedaRet(e.target.value)} placeholder="Buscar NIT o nombre..." className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-petroleum-500 w-48" />
              <input value={periodoFiltro} onChange={e => setPeriodoFiltro(e.target.value)} placeholder="2026-01" className="text-xs font-mono border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none w-28" />
            </div>
            <div className="table-fixed-header overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Período</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">NIT</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Concepto</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Base</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Tarifa %</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Valor retenido</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {retFiltradas.map((r, i) => (
                    <tr key={i} className="hoverable">
                      <td className="px-3 py-2.5 font-mono text-gray-600">{r.periodo}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{r.nit}</td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-48 truncate">{r.nombre}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.concepto}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmtCOP(r.base)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-600">{r.tarifa}%</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-800">{fmtCOP(r.valor)}</td>
                      <td className="px-3 py-2.5"><button className="text-xs text-petroleum-600 hover:underline">Certificado</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 font-semibold text-xs text-gray-700">TOTALES</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(retFiltradas.reduce((s, r) => s + r.base, 0))}</td>
                    <td />
                    <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(retFiltradas.reduce((s, r) => s + r.valor, 0))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Certificado (vista previa) + relación de acumulados */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-xs font-semibold text-gray-700">Certificado de retención — vista previa</h2>
                <p className="text-xs text-gray-400 mt-0.5">Empresa ABC Comercial S.A.S. · período 2026-01</p>
              </div>
              <div className="p-4">
                <div className="rounded border border-gray-200 p-4 font-mono text-xs space-y-1.5">
                  <div className="text-center font-bold text-gray-800">CERTIFICADO DE RETENCIÓN EN LA FUENTE</div>
                  <div className="text-center text-gray-600">{EMPRESA.nombre} — NIT {EMPRESA.nit}-{EMPRESA.digito}</div>
                  <div className="border-t border-gray-200 my-2" />
                  <div className="text-gray-700">Retenido: Empresa ABC Comercial S.A.S.</div>
                  <div className="text-gray-700">NIT: 800.100.200-3</div>
                  <div className="text-gray-700">Concepto: Honorarios</div>
                  <div className="text-gray-700">Base: $ 15.000.000</div>
                  <div className="text-gray-700">Tarifa: 10%</div>
                  <div className="font-bold text-gray-800">Valor retenido: $ 1.500.000</div>
                  <div className="text-gray-500 pt-1">Período gravable: 2026-01 · Expedido: {fechaHora()}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-xs font-semibold text-gray-700">Relación de acumulados</h2>
                <p className="text-xs text-gray-400 mt-0.5">Totales acumulados por concepto y período</p>
              </div>
              <div className="table-fixed-header overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Período</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Concepto</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600">Base</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600">Retenido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      ['2026-01', 'Honorarios', 15000000, 1500000],
                      ['2026-01', 'Servicios', 8500000, 340000],
                      ['2026-02', 'Arrendamiento', 6000000, 210000],
                    ].map((r, i) => (
                      <tr key={i} className="hoverable">
                        <td className="px-3 py-2 font-mono text-gray-600">{r[0]}</td>
                        <td className="px-3 py-2 text-gray-700">{r[1]}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-800">{fmtCOP(r[2] as number)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-800">{fmtCOP(r[3] as number)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-700">TOTAL ACUMULADO</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(29500000)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(2050000)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Totales por cuenta 236540 + soportes */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-xs font-semibold text-gray-700">Totales por cuenta — 236540 Retenciones y aportes de nómina</h2>
              </div>
              <div className="table-fixed-header overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Período</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Concepto</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    <tr className="hoverable">
                      <td className="px-3 py-2 font-mono text-gray-600">2026-01</td>
                      <td className="px-3 py-2 text-gray-700">Retención y aportes de nómina enero</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-800">{fmtCOP(1100000)}</td>
                    </tr>
                    <tr className="hoverable">
                      <td className="px-3 py-2 font-mono text-gray-600">2026-02</td>
                      <td className="px-3 py-2 text-gray-700">Retención nómina febrero (NOM-2026-02)</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-800">{fmtCOP(1200000)}</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-700">SALDO CRÉDITO ACUMULADO</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(2300000)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-xs font-semibold text-gray-700">Soportes y anexos</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {SOPORTES_ANEXOS.map(s => (
                  <div key={s.nombre} className="flex items-center gap-3 px-4 py-2.5 hoverable">
                    <span className="text-sm">📄</span>
                    <span className="flex-1 text-xs text-gray-700 font-mono">{s.nombre}</span>
                    <span className="text-xs text-gray-400">{s.tipo} · {s.peso}</span>
                    <span className="text-xs font-mono text-gray-500">{s.fecha}</span>
                    <button onClick={() => setMensaje(`Descarga de ${s.nombre} (simulada).`)} className="text-xs text-petroleum-600 hover:underline">Descargar</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Plano anual (vista previa) */}
          <div id="plano-anual-ret" className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xs font-semibold text-gray-700">Plano anual — vista previa</h2>
              <p className="text-xs text-gray-400 mt-0.5">Formato DIAN de retenciones practicadas (vista previa simulada)</p>
            </div>
            <pre className="p-4 font-mono text-[11px] text-gray-700 overflow-x-auto bg-gray-50/50">
{`NIT;Concepto;Base;Tarifa;Valor;Periodo
800.100.200;Honorarios;15000000;10;1500000;2026-01
900.200.300;Servicios;8500000;4;340000;2026-01
800.100.200;Arrendamiento;6000000;3.5;210000;2026-02`}
            </pre>
          </div>

          {/* Carga manual de certificados al portal */}
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xs font-semibold text-gray-700">Carga manual de certificados al portal DIAN</h2>
            </div>
            <div className="table-fixed-header overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Certificado</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Tercero</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Período</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Estado</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cargasPortal.map(c => (
                    <tr key={c.id} className="hoverable">
                      <td className="px-3 py-2 font-mono text-gray-700">{c.certificado}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-56 truncate">{c.tercero}</td>
                      <td className="px-3 py-2 font-mono text-gray-600">{c.periodo}</td>
                      <td className="px-3 py-2">
                        <Badge texto={c.estado} color={c.estado === 'Cargado' ? 'green' : c.estado === 'Rechazado' ? 'red' : 'amber'} />
                      </td>
                      <td className="px-3 py-2">
                        {c.estado !== 'Cargado' && (
                          <button onClick={() => cargarPortal(c.id)} disabled={!!cargandoPortal} className="text-xs text-petroleum-600 hover:underline disabled:opacity-50">
                            {cargandoPortal === c.id ? '⏳ Cargando…' : 'Cargar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= IVA ================= */}
      {tab === 'iva' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className={`rounded px-3 py-2 text-xs ${ultimaIva === '2026-01-31' ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
              {ultimaIva === '2026-01-31' ? `⚠ Última acumulación: ${ultimaIva} — IVA de feb 2026 no acumulado` : `✓ Última acumulación: ${ultimaIva}`}
            </div>
            <div className="flex-1" />
            <button onClick={() => acumular('iva')} disabled={!!acumulando} className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-60">
              {acumulando === 'iva' ? '⏳ Acumulando…' : 'Acumular período'}
            </button>
            <button onClick={() => setShowLimpiar('iva')} className="text-xs px-3 py-1.5 border border-red-200 rounded text-red-600 hover:bg-red-50">Limpiar acumulados</button>
            <button onClick={() => setMensaje('IVA exportado en XLSX (simulado).')} className="text-xs px-3 py-1.5 rounded bg-petroleum-500 text-white hover:bg-petroleum-600">↓ Exportar</button>
          </div>

          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="table-fixed-header overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Período</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">NIT</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Base IVA</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">IVA 19%</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">IVA descontable</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Neto a pagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {MOCK_IVA.map((r, i) => (
                    <tr key={i} className="hoverable">
                      <td className="px-3 py-2.5 font-mono text-gray-600">{r.periodo}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{r.nit}</td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-48 truncate">{r.nombre}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmtCOP(r.base)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmtCOP(r.iva19)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-600">{fmtCOP(r.ivaDescontable)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-800">{fmtCOP(r.neto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-700">TOTALES</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(MOCK_IVA.reduce((s, r) => s + r.base, 0))}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(MOCK_IVA.reduce((s, r) => s + r.iva19, 0))}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(MOCK_IVA.reduce((s, r) => s + r.ivaDescontable, 0))}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(MOCK_IVA.reduce((s, r) => s + r.neto, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= Medios magnéticos ================= */}
      {tab === 'medios' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {MEDIOS_STEPS.map((s, i) => (
              <div key={s} className="flex items-center shrink-0">
                <div
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded cursor-pointer transition-colors font-medium ${
                    i === mediosStep ? 'bg-petroleum-500 text-white' :
                    i < mediosStep ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50'
                  }`}
                  onClick={() => setMediosStep(i)}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    i < mediosStep ? 'bg-green-100 text-green-700' : i === mediosStep ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>{i < mediosStep ? '✓' : i + 1}</span>
                  {s}
                </div>
                {i < MEDIOS_STEPS.length - 1 && <span className="text-gray-200 mx-1">›</span>}
              </div>
            ))}
          </div>

          <div className="bg-white rounded border border-gray-200 p-5 min-h-48 space-y-4">
            {/* Paso 1: Formatos */}
            {mediosStep === 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-700">Formatos de información exógena</h3>
                  <button onClick={() => setShowFormatoModal(true)} className="text-xs px-3 py-1.5 rounded bg-petroleum-500 text-white font-medium hover:bg-petroleum-600">+ Agregar formato</button>
                </div>
                {formatos.map(f => (
                  <div key={f.id} className="flex items-center gap-4 p-3 border border-gray-200 rounded">
                    <span className="font-mono text-gray-700 w-16">{f.id}</span>
                    <span className="flex-1 text-gray-600 text-xs">{f.nombre}</span>
                    <span className="text-xs text-gray-500">Vigencia {f.vigencia}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{f.estado}</span>
                    <button onClick={() => { setFormatos(prev => prev.filter(x => x.id !== f.id)); setMensaje(`Formato ${f.id} eliminado (simulado).`); }} className="text-xs text-red-600 hover:underline">Eliminar</button>
                  </div>
                ))}
              </div>
            )}

            {/* Paso 2: Conceptos por formato */}
            {mediosStep === 1 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-gray-700">Conceptos por formato</h3>
                  <button onClick={() => { setConceptoEditando(null); setFormConcepto({ concepto: '', tarifa: '0', cuenta: '236540' }); setShowConceptoModal(true); }} className="text-xs px-3 py-1.5 rounded bg-petroleum-500 text-white font-medium hover:bg-petroleum-600">+ Agregar concepto</button>
                </div>
                <div className="flex items-center gap-2">
                  {formatos.map(f => (
                    <button key={f.id} onClick={() => setFormatoConceptos(f.id)} className={`text-xs px-2.5 py-1 rounded font-mono ${formatoConceptos === f.id ? 'bg-petroleum-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {f.id}
                    </button>
                  ))}
                </div>
                <div className="table-fixed-header overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Concepto</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Tarifa %</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Cuenta</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {conceptosFiltrados.map(c => (
                        <tr key={c.id} className="hoverable">
                          <td className="px-3 py-2 text-gray-700">{c.concepto}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-800">{c.tarifa}%</td>
                          <td className="px-3 py-2 font-mono text-gray-600">{c.cuenta} — {c.nombreCuenta}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setConceptoEditando(c); setFormConcepto({ concepto: c.concepto, tarifa: String(c.tarifa), cuenta: c.cuenta }); setShowConceptoModal(true); }} className="text-xs text-petroleum-600 hover:underline">Editar</button>
                              <button onClick={() => eliminarConcepto(c.id)} className="text-xs text-red-600 hover:underline">Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {conceptosFiltrados.length === 0 && (
                        <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Sin conceptos para {formatoConceptos}. Agregue uno.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Paso 3: Asignación de cuentas */}
            {mediosStep === 2 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-gray-700">Asignación de cuentas por formato</h3>
                  <div className="flex items-center gap-2">
                    <select value={companiaCopiar} onChange={e => setCompaniaCopiar(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5">
                      <option value="002">Compañía 002 — Filial Bogotá</option>
                      <option value="003">Compañía 003 — Sucursal Medellín</option>
                    </select>
                    <button onClick={copiarDefiniciones} disabled={copiando} className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-60">
                      {copiando ? '⏳ Copiando…' : 'Copiar definiciones de otra compañía'}
                    </button>
                  </div>
                </div>
                <div className="table-fixed-header overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Código</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Nombre de la cuenta</th>
                        {formatos.map(f => (
                          <th key={f.id} className="px-2 py-2 text-center font-semibold text-gray-600 font-mono">{f.id}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {cuentasAfectables.map(c => (
                        <tr key={c.codigo} className="hoverable">
                          <td className="px-3 py-2 font-mono text-gray-700">{c.codigo}</td>
                          <td className="px-3 py-2 text-gray-600">{c.nombre}</td>
                          {formatos.map(f => (
                            <td key={f.id} className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                aria-label={`${c.nombre} — ${f.id}`}
                                checked={(asignaciones[c.codigo] ?? []).includes(f.id)}
                                onChange={() => toggleAsignacion(c.codigo, f.id)}
                                className="h-4 w-4 accent-petroleum-500"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400">Las cuentas marcadas alimentan el formato correspondiente al generar los medios.</p>
              </div>
            )}

            {/* Paso 4: Generación */}
            {mediosStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-gray-700">Generación de medios magnéticos</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Año gravable</label>
                    <input value={genAnio} onChange={e => setGenAnio(e.target.value)} className={`${INPUT} font-mono`} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Versión</label>
                    <input value={genVersion} onChange={e => setGenVersion(Number(e.target.value) || 1)} className={`${INPUT} font-mono`} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de corte</label>
                    <input value={genCorte} onChange={e => setGenCorte(e.target.value)} className={`${INPUT} font-mono`} />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={genSinMovimiento} onChange={e => setGenSinMovimiento(e.target.checked)} className="h-4 w-4 accent-petroleum-500" />
                      Incluir terceros sin movimiento
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={iniciarGeneracion} disabled={generando} className="text-xs px-4 py-2 rounded bg-petroleum-500 text-white font-medium hover:bg-petroleum-600 disabled:opacity-60">
                    {generando ? '⏳ Generando…' : 'Generar medios'}
                  </button>
                  {generando && (
                    <div className="flex-1 max-w-md">
                      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-petroleum-500 transition-all duration-200" style={{ width: `${progresoGen}%` }} />
                      </div>
                      <div className="mt-1 text-xs text-gray-500 font-mono">{progresoGen}%</div>
                    </div>
                  )}
                </div>
                <div className="table-fixed-header overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Versión</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Fecha de generación</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Formatos</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Registros</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {versiones.map(v => (
                        <tr key={v.id} className="hoverable">
                          <td className="px-3 py-2 font-mono text-gray-800 font-semibold">v{v.version}</td>
                          <td className="px-3 py-2 font-mono text-gray-600">{v.fecha}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-800">{v.formatos}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-800">{v.registros}</td>
                          <td className="px-3 py-2"><Badge texto={v.estado} color={v.estado === 'Exportada' ? 'green' : 'blue'} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Paso 5: Revisión */}
            {mediosStep === 4 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-700">Revisión del medio generado — grilla editable</h3>
                  <button onClick={() => { setFormFila({ formato: 'F1001', nit: '', nombre: '', concepto: '', base: '0', tarifa: '0' }); setShowFilaModal(true); }} className="text-xs px-3 py-1.5 rounded bg-petroleum-500 text-white font-medium hover:bg-petroleum-600">+ Agregar fila</button>
                </div>
                <div className="table-fixed-header overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Formato</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">NIT</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Nombre</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Concepto</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Base</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Tarifa %</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Valor</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filasMedio.map(f => {
                        const enEdicion = editandoFila === f.id;
                        return (
                          <tr key={f.id} className="hoverable">
                            <td className="px-3 py-2 font-mono text-gray-700">{f.formato}</td>
                            <td className="px-3 py-2 font-mono text-gray-600">{f.nit}</td>
                            <td className="px-3 py-2 text-gray-600 max-w-48 truncate">{f.nombre}</td>
                            <td className="px-3 py-2 text-gray-600">{f.concepto}</td>
                            <td className="px-3 py-2 text-right">
                              {enEdicion ? (
                                <input type="number" value={filaEnEdicion?.base ?? 0} onChange={e => setFilaEnEdicion(prev => prev ? { ...prev, base: Number(e.target.value) || 0 } : prev)} className="w-28 text-right font-mono text-xs border border-petroleum-400 rounded px-1.5 py-1" />
                              ) : (
                                <span className="font-mono text-gray-800">{fmtCOP(f.base)}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {enEdicion ? (
                                <input type="number" value={filaEnEdicion?.tarifa ?? 0} onChange={e => setFilaEnEdicion(prev => prev ? { ...prev, tarifa: Number(e.target.value) || 0 } : prev)} className="w-20 text-right font-mono text-xs border border-petroleum-400 rounded px-1.5 py-1" />
                              ) : (
                                <span className="font-mono text-gray-600">{f.tarifa}%</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {enEdicion ? (
                                <input type="number" value={filaEnEdicion?.valor ?? 0} onChange={e => setFilaEnEdicion(prev => prev ? { ...prev, valor: Number(e.target.value) || 0 } : prev)} className="w-28 text-right font-mono text-xs border border-petroleum-400 rounded px-1.5 py-1" />
                              ) : (
                                <span className="font-mono font-semibold text-gray-800">{fmtCOP(f.valor)}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2 whitespace-nowrap">
                                {enEdicion ? (
                                  <>
                                    <button onClick={guardarEdicion} className="text-xs text-green-700 hover:underline">Guardar</button>
                                    <button onClick={() => { setEditandoFila(null); setFilaEnEdicion(null); }} className="text-xs text-gray-500 hover:underline">Cancelar</button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => iniciarEdicion(f)} className="text-xs text-petroleum-600 hover:underline">Editar</button>
                                    <button onClick={() => eliminarFila(f.id)} className="text-xs text-red-600 hover:underline">Eliminar</button>
                                    <button onClick={() => setModalFila({ tipo: 'detalle', fila: f })} className="text-xs text-gray-500 hover:underline">Detalle</button>
                                    <button onClick={() => setModalFila({ tipo: 'variante', fila: f })} className="text-xs text-gray-500 hover:underline">Segunda variante</button>
                                    <button onClick={() => setModalFila({ tipo: 'identificacion', fila: f })} className="text-xs text-gray-500 hover:underline">Identificación</button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={6} className="px-3 py-2 text-xs font-semibold text-gray-700">TOTAL {filasMedio.length} FILAS</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(filasMedio.reduce((s, f) => s + f.valor, 0))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Paso 6: Topes/cruces + conciliación */}
            {mediosStep === 5 && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-gray-700">Topes y cruces de terceros</h3>

                <div>
                  <h4 className="text-xs font-semibold text-gray-600 mb-2">Filas que superan topes (UVT)</h4>
                  <div className="table-fixed-header overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Formato</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">NIT</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Nombre</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Concepto</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Valor</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Tope</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Exceso</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Ajuste</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {topes.map(t => {
                          const exceso = Math.max(0, t.valor - t.tope);
                          const aplicado = !!ajustesTope[t.id];
                          return (
                            <tr key={t.id} className={`hoverable ${exceso > 0 && !aplicado ? 'row-warning' : ''}`}>
                              <td className="px-3 py-2 font-mono text-gray-700">{t.formato}</td>
                              <td className="px-3 py-2 font-mono text-gray-600">{t.nit}</td>
                              <td className="px-3 py-2 text-gray-600 max-w-44 truncate">{t.nombre}</td>
                              <td className="px-3 py-2 text-gray-600">{t.concepto}</td>
                              <td className="px-3 py-2 text-right font-mono text-gray-800">{fmtCOP(t.valor)}</td>
                              <td className="px-3 py-2 text-right font-mono text-gray-600">{t.tope > 0 ? fmtCOP(t.tope) : '—'}</td>
                              <td className={`px-3 py-2 text-right font-mono font-semibold ${exceso > 0 ? 'text-amber-700' : 'text-gray-300'}`}>{exceso > 0 ? fmtCOP(exceso) : '—'}</td>
                              <td className="px-3 py-2">
                                {aplicado ? (
                                  <button onClick={() => deshacerAjuste(t)} className="text-xs text-red-600 hover:underline">Deshacer ajuste</button>
                                ) : (
                                  <button onClick={() => aplicarAjuste(t)} className="text-xs text-petroleum-600 hover:underline">Aplicar ajuste</button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-600 mb-2">Cruces de terceros entre formatos</h4>
                  <div className="table-fixed-header overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">NIT</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Nombre</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">F1001</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">F1007</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Diferencia</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {cruces.map(x => {
                          const diff = x.f1001 - x.f1007;
                          return (
                            <tr key={x.id} className="hoverable">
                              <td className="px-3 py-2 font-mono text-gray-600">{x.nit}</td>
                              <td className="px-3 py-2 text-gray-600 max-w-56 truncate">{x.nombre}</td>
                              <td className="px-3 py-2 text-right font-mono text-gray-800">{fmtCOP(x.f1001)}</td>
                              <td className="px-3 py-2 text-right font-mono text-gray-800">{fmtCOP(x.f1007)}</td>
                              <td className={`px-3 py-2 text-right font-mono ${diff === 0 ? 'text-gray-400' : 'text-red-600 font-semibold'}`}>{diff === 0 ? '—' : fmtCOP(diff)}</td>
                              <td className="px-3 py-2"><Badge texto={diff === 0 ? 'OK' : 'Revisar'} color={diff === 0 ? 'green' : 'red'} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Conciliación */}
                <div className="rounded border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-gray-700">Conciliación (paso 6/7)</h4>
                    {diferencia === 0
                      ? <Badge texto="Cuadra" color="green" />
                      : <Badge texto={`No cuadra — diferencia ${fmtCOP(Math.abs(diferencia))}`} color="red" />}
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-gray-50">
                        <tr>
                          <td className="py-2 text-gray-600">Total contable (libro)</td>
                          <td className="py-2 text-right font-mono font-semibold text-gray-800">{fmtCOP(TOTAL_CONTABLE)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-gray-600">Exclusiones</td>
                          <td className="py-2 text-right font-mono text-gray-700">− {fmtCOP(EXCLUSIONES)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-gray-600">Topes no reportados</td>
                          <td className="py-2 text-right font-mono text-gray-700">− {fmtCOP(TOPES_NO_REPORTADOS)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-gray-600 font-semibold">Total esperado a reportar</td>
                          <td className="py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(esperado)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-gray-600">Base reportada</td>
                          <td className="py-2 text-right font-mono text-gray-700">{fmtCOP(BASE_REPORTADA)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-gray-600">Ajustes aplicados</td>
                          <td className={`py-2 text-right font-mono font-semibold ${sumaAjustes > 0 ? 'text-petroleum-700' : 'text-gray-400'}`}>+ {fmtCOP(sumaAjustes)}</td>
                        </tr>
                        <tr className="border-t border-gray-200">
                          <td className="py-2 text-gray-600 font-semibold">Total reportado</td>
                          <td className="py-2 text-right font-mono font-bold text-gray-800">{fmtCOP(totalReportado)}</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">Ajustes activos — el badge reacciona a estos valores:</p>
                      {ajustes.length === 0 && <p className="text-xs text-gray-400">Sin ajustes. Aplique el ajuste de «Caja menor no deducible» para cuadrar la conciliación.</p>}
                      <div className="space-y-1.5">
                        {ajustes.map(a => (
                          <div key={a.id} className="flex items-center gap-2 rounded border border-gray-200 px-2.5 py-1.5 text-xs">
                            <span className="flex-1 text-gray-600 truncate">{a.detalle}</span>
                            <span className="font-mono text-gray-800">{fmtCOP(a.valor)}</span>
                            <button onClick={() => setAjustes(prev => prev.filter(x => x.id !== a.id))} className="text-gray-400 hover:text-red-600">×</button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <input type="number" value={ajusteManual} onChange={e => setAjusteManual(e.target.value)} placeholder="Valor ajuste manual" className="text-xs font-mono border border-gray-200 rounded px-2 py-1.5 w-36" />
                        <button onClick={agregarAjusteManual} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Agregar</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Paso 7: Exportación */}
            {mediosStep === 6 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-700">Exportar medios magnéticos</h3>
                  <select value={versionExportar} onChange={e => setVersionExportar(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5">
                    {versiones.map(v => <option key={v.id} value={v.id}>Versión {v.version} — {v.fecha}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {['Archivo .XML para DIAN', 'Archivo .CSV resumen', 'Reporte conciliación'].map(f => (
                    <div key={f} className="border border-gray-200 rounded p-3 text-center">
                      <div className="text-lg mb-1">📄</div>
                      <div className="text-xs text-gray-600">{f}</div>
                      <button onClick={() => setMensaje(`${f} generado para la versión ${versionExportar} (simulado).`)} className="mt-2 text-xs px-3 py-1 rounded bg-petroleum-500 text-white hover:bg-petroleum-600">Descargar</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {mediosStep > 0 && (
              <button onClick={() => setMediosStep(s => s - 1)} className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600">← Anterior</button>
            )}
            {mediosStep < MEDIOS_STEPS.length - 1 && (
              <button onClick={() => setMediosStep(s => s + 1)} className="text-xs px-3 py-1.5 rounded bg-petroleum-500 text-white font-medium hover:bg-petroleum-600">Siguiente →</button>
            )}
          </div>
        </div>
      )}

      {/* Modales */}
      {showLimpiar && (
        <Modal title={showLimpiar === 'ret' ? 'Limpiar acumulados de retenciones' : 'Limpiar acumulados de IVA'} onClose={() => setShowLimpiar(null)}>
          <div className="p-5 space-y-3">
            <p className="text-xs text-gray-600">
              Esta acción elimina los totales acumulados de {showLimpiar === 'ret' ? 'retenciones' : 'IVA'} para el período seleccionado.
              <strong> No elimina el libro contable</strong> — puede regenerar los acumulados en cualquier momento.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-700">
              Los acumulados son derivados del libro. Limpiar y regenerar es una operación segura.
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" data-initial-focus onClick={() => setShowLimpiar(null)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="button" onClick={limpiarAcumulados} className="rounded bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">Limpiar acumulados</button>
          </div>
        </Modal>
      )}

      {showFormatoModal && (
        <Modal title="Agregar formato" onClose={() => setShowFormatoModal(false)}>
          <form noValidate onSubmit={agregarFormato}>
            <div className="space-y-3 p-5">
              <div>
                <label htmlFor="formato-id" className="block text-xs font-medium text-gray-600 mb-1">Código (ej. F1010)</label>
                <input id="formato-id" data-initial-focus className={`${INPUT} font-mono`} value={formFormato.id} onChange={e => setFormFormato(f => ({ ...f, id: e.target.value }))} placeholder="F1010" />
              </div>
              <div>
                <label htmlFor="formato-nombre" className="block text-xs font-medium text-gray-600 mb-1">Nombre del formato</label>
                <input id="formato-nombre" className={INPUT} value={formFormato.nombre} onChange={e => setFormFormato(f => ({ ...f, nombre: e.target.value }))} placeholder="Descripción del formato" />
              </div>
              <div>
                <label htmlFor="formato-vigencia" className="block text-xs font-medium text-gray-600 mb-1">Vigencia</label>
                <input id="formato-vigencia" className={`${INPUT} font-mono`} value={formFormato.vigencia} onChange={e => setFormFormato(f => ({ ...f, vigencia: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setShowFormatoModal(false)} className={BUTTON_SECONDARY}>Cancelar</button>
              <button type="submit" className={BUTTON_PRIMARY}>Agregar formato</button>
            </div>
          </form>
        </Modal>
      )}

      {showConceptoModal && (
        <Modal title={conceptoEditando ? 'Editar concepto' : `Agregar concepto — ${formatoConceptos}`} onClose={() => { setShowConceptoModal(false); setConceptoEditando(null); }}>
          <form noValidate onSubmit={guardarConcepto}>
            <div className="space-y-3 p-5">
              <div>
                <label htmlFor="concepto-nombre" className="block text-xs font-medium text-gray-600 mb-1">Concepto</label>
                <input id="concepto-nombre" data-initial-focus className={INPUT} value={formConcepto.concepto} onChange={e => setFormConcepto(f => ({ ...f, concepto: e.target.value }))} placeholder="Ej. Honorarios" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="concepto-tarifa" className="block text-xs font-medium text-gray-600 mb-1">Tarifa %</label>
                  <input id="concepto-tarifa" type="number" step="0.1" className={`${INPUT} font-mono`} value={formConcepto.tarifa} onChange={e => setFormConcepto(f => ({ ...f, tarifa: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="concepto-cuenta" className="block text-xs font-medium text-gray-600 mb-1">Cuenta contable</label>
                  <select id="concepto-cuenta" className={INPUT} value={formConcepto.cuenta} onChange={e => setFormConcepto(f => ({ ...f, cuenta: e.target.value }))}>
                    {cuentasAfectables.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
              <button type="button" onClick={() => { setShowConceptoModal(false); setConceptoEditando(null); }} className={BUTTON_SECONDARY}>Cancelar</button>
              <button type="submit" className={BUTTON_PRIMARY}>{conceptoEditando ? 'Guardar cambios' : 'Agregar concepto'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showFilaModal && (
        <Modal title="Agregar fila manual al medio" onClose={() => setShowFilaModal(false)}>
          <form noValidate onSubmit={agregarFila}>
            <div className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="fila-formato" className="block text-xs font-medium text-gray-600 mb-1">Formato</label>
                  <select id="fila-formato" className={INPUT} value={formFila.formato} onChange={e => setFormFila(f => ({ ...f, formato: e.target.value }))}>
                    {formatos.map(fm => <option key={fm.id} value={fm.id}>{fm.id}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="fila-concepto" className="block text-xs font-medium text-gray-600 mb-1">Concepto</label>
                  <input id="fila-concepto" className={INPUT} value={formFila.concepto} onChange={e => setFormFila(f => ({ ...f, concepto: e.target.value }))} placeholder="Ej. Honorarios" />
                </div>
              </div>
              <div>
                <label htmlFor="fila-nit" className="block text-xs font-medium text-gray-600 mb-1">NIT del tercero</label>
                <input id="fila-nit" data-initial-focus className={`${INPUT} font-mono`} value={formFila.nit} onChange={e => setFormFila(f => ({ ...f, nit: e.target.value }))} placeholder="800.100.200" />
              </div>
              <div>
                <label htmlFor="fila-nombre" className="block text-xs font-medium text-gray-600 mb-1">Nombre del tercero</label>
                <input id="fila-nombre" className={INPUT} value={formFila.nombre} onChange={e => setFormFila(f => ({ ...f, nombre: e.target.value }))} placeholder="Razón social o nombre" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="fila-base" className="block text-xs font-medium text-gray-600 mb-1">Base</label>
                  <input id="fila-base" type="number" className={`${INPUT} font-mono`} value={formFila.base} onChange={e => setFormFila(f => ({ ...f, base: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="fila-tarifa" className="block text-xs font-medium text-gray-600 mb-1">Tarifa %</label>
                  <input id="fila-tarifa" type="number" step="0.1" className={`${INPUT} font-mono`} value={formFila.tarifa} onChange={e => setFormFila(f => ({ ...f, tarifa: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setShowFilaModal(false)} className={BUTTON_SECONDARY}>Cancelar</button>
              <button type="submit" className={BUTTON_PRIMARY}>Agregar fila</button>
            </div>
          </form>
        </Modal>
      )}

      {modalFila && (
        <Modal
          title={modalFila.tipo === 'detalle' ? 'Detalle de la fila' : modalFila.tipo === 'variante' ? 'Segunda variante' : 'Identificación del tercero'}
          onClose={() => setModalFila(null)}
        >
          <div className="p-5 space-y-3">
            {modalFila.tipo === 'detalle' && (
              <div className="space-y-1.5 text-xs">
                <div><span className="text-gray-500">Formato:</span> <span className="font-mono text-gray-800">{modalFila.fila.formato}</span></div>
                <div><span className="text-gray-500">Tercero:</span> <span className="text-gray-800">{modalFila.fila.nombre} — {modalFila.fila.nit}</span></div>
                <div><span className="text-gray-500">Concepto:</span> <span className="text-gray-800">{modalFila.fila.concepto}</span></div>
                <div><span className="text-gray-500">Base:</span> <span className="font-mono text-gray-800">{fmtCOP(modalFila.fila.base)}</span></div>
                <div><span className="text-gray-500">Tarifa:</span> <span className="font-mono text-gray-800">{modalFila.fila.tarifa}%</span></div>
                <div><span className="text-gray-500">Valor:</span> <span className="font-mono font-semibold text-gray-800">{fmtCOP(modalFila.fila.valor)}</span></div>
                <div className="pt-1 text-gray-400">Soporte: documento origen consultable desde el módulo de documentos.</div>
              </div>
            )}
            {modalFila.tipo === 'variante' && (
              <div className="space-y-2 text-xs">
                <p className="text-gray-600">Variante sugerida para esta fila (mismo tercero, concepto alternativo):</p>
                <div className="rounded border border-gray-200 p-3 font-mono text-gray-700 space-y-1">
                  <div>{modalFila.fila.nombre} — {modalFila.fila.nit}</div>
                  <div>Concepto: {modalFila.fila.concepto} (variante)</div>
                  <div>Valor: {fmtCOP(Math.round(modalFila.fila.valor * 1.1))}</div>
                </div>
                <button type="button" onClick={() => usarVariante(modalFila.fila)} className={BUTTON_PRIMARY}>Usar esta variante</button>
              </div>
            )}
            {modalFila.tipo === 'identificacion' && (
              <div className="space-y-1.5 text-xs">
                <div><span className="text-gray-500">NIT:</span> <span className="font-mono text-gray-800">{modalFila.fila.nit}</span></div>
                <div><span className="text-gray-500">Nombre:</span> <span className="text-gray-800">{modalFila.fila.nombre}</span></div>
                <div><span className="text-gray-500">Tipo de documento:</span> <span className="text-gray-800">NIT</span></div>
                <div><span className="text-gray-500">Verificación RUES:</span> <span className="text-gray-800">Coincide (simulado)</span></div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" data-initial-focus onClick={() => setModalFila(null)} className={BUTTON_SECONDARY}>Cerrar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
