import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { TERCEROS, MOVIMIENTOS_FEB, USUARIO, fmtCOP } from '../data/mock';
import { listarCuentas } from '../api/cuentas';
import { listarCentros } from '../api/centros';
import { listarTerceros } from '../api/terceros';
import { listarComprobantes, type ComprobanteReal } from '../api/comprobantes';
import { listarTiposDocumento, type TipoDocumentoReal } from '../api/tiposDocumento';
import { contabilizarCaptura, type ResultadoContabilizacion } from '../api/contabilizacion';
import { consultarPeriodoOperacion } from '../api/periodoOperacion';
import type { CentroJerarquico } from '../data/configCentros';
import type { Cuenta, Lote, LoteLinea, MovimientoLinea, Tercero } from '../types';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600';

interface Linea {
  id: number;
  cuenta: string;
  nombreCuenta: string;
  nit: string;
  tercero: string;
  terceroValidado: boolean;
  centro: string;
  documento: string;
  debito: string;
  credito: string;
  base: string;
  concepto: string;
}

let lineId = 1;
function newLine(documento = '', concepto = ''): Linea {
  return { id: lineId++, cuenta: '', nombreCuenta: '', nit: '', tercero: '', terceroValidado: false, centro: '', documento, debito: '', credito: '', base: '', concepto };
}

function parseCOP(s: string): number {
  return parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
}

/** Obtiene YYYY-MM-DD usando la zona horaria local del equipo del usuario. */
function fechaLocalActual(): string {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
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

export default function CapturaDirecta({ cia, onCrearLote }: { cia: string; onCrearLote?: (l: Lote) => void }) {
  const [periodo, setPeriodo] = useState(() => fechaLocalActual().slice(0, 7));
  const [fecha, setFecha] = useState(fechaLocalActual);
  const [comprobante, setComprobante] = useState('');
  const [tipoDoc, setTipoDoc] = useState('');
  const [numDoc, setNumDoc] = useState('');
  const [terceroHdr, setTerceroHdr] = useState('');
  const [concepto, setConcepto] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([newLine(), newLine()]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [posted, setPosted] = useState(false);
  const [contabilizando, setContabilizando] = useState(false);
  const [resultadoContabilizacion, setResultadoContabilizacion] = useState<ResultadoContabilizacion | null>(null);
  const [showCuentaPicker, setShowCuentaPicker] = useState<number | null>(null);
  const [cuentaSearch, setCuentaSearch] = useState('');
  const [cuentaOpcion, setCuentaOpcion] = useState(0);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [centros, setCentros] = useState<CentroJerarquico[]>([]);
  const [comprobantes, setComprobantes] = useState<ComprobanteReal[]>([]);
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumentoReal[]>([]);
  const [maestrosCargando, setMaestrosCargando] = useState(true);
  const [maestrosError, setMaestrosError] = useState('');
  const [showTerceroPicker, setShowTerceroPicker] = useState<number | null>(null);
  const [terceroSearch, setTerceroSearch] = useState('');
  const [tercerosEncontrados, setTercerosEncontrados] = useState<Tercero[]>([]);
  const [tercerosCargando, setTercerosCargando] = useState(false);
  const [tercerosError, setTercerosError] = useState('');
  const [showPlantilla, setShowPlantilla] = useState(false);
  const [showExcel, setShowExcel] = useState(false);
  const [showCargarDoc, setShowCargarDoc] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const capturaRef = useRef<HTMLDivElement>(null);

  // CONMAE, CONCECOS y CONTICOM son maestros por compañía; VISDOCUM es global.
  // Todos se resuelven al entrar para que la captura nunca mezcle catálogos de
  // otra contabilidad ni dependa de listas de demostración del frontend.
  useEffect(() => {
    let vigente = true;
    setMaestrosCargando(true);
    setMaestrosError('');
    setCuentas([]);
    setCentros([]);
    setComprobantes([]);
    setTiposDocumento([]);
    setComprobante('');
    setTipoDoc('');
    setNumDoc('');
    // Cada nueva entrada a la captura parte de la fecha real del usuario. El
    // período se deriva de ella; CONCTR vuelve a comprobarlo al contabilizar.
    const fechaActual = fechaLocalActual();
    setPeriodo(fechaActual.slice(0, 7));
    setFecha(fechaActual);
    setLineas([newLine(), newLine()]);
    Promise.all([
      listarCuentas(cia),
      listarCentros(cia),
      listarComprobantes(cia),
      listarTiposDocumento(),
      consultarPeriodoOperacion(cia),
    ])
      .then(([cuentasReales, centrosResponse, comprobantesResponse, tiposResponse]) => {
        if (!vigente) return;
        setCuentas(cuentasReales);
        setCentros(centrosResponse.items);
        setComprobantes(comprobantesResponse.items);
        setTiposDocumento(tiposResponse.items);
        setComprobante(comprobantesResponse.items[0]?.codigo ?? '');
        setTipoDoc(tiposResponse.items[0]?.codigo ?? '');
      })
      .catch((cause: unknown) => {
        if (vigente) setMaestrosError(cause instanceof Error ? cause.message : 'No fue posible cargar los maestros contables.');
      })
      .finally(() => { if (vigente) setMaestrosCargando(false); });
    return () => { vigente = false; };
  }, [cia]);

  const cuentasAfectables = cuentas.filter(c => c.afectable);

  // VISDOCUM es global. Los tipos vinculados al comprobante seleccionado se
  // presentan primero, pero los demás permanecen disponibles para no alterar
  // la operación histórica cuando COMPROBA viene vacío o difiere por módulo.
  const tiposDocumentoOrdenados = Array.from(
    new Map(tiposDocumento.map(tipo => [tipo.codigo, tipo])).values(),
  ).sort((a, b) =>
    Number(b.comprobante === comprobante) - Number(a.comprobante === comprobante)
    || a.codigo.localeCompare(b.codigo),
  );
  const tipoDocumentoSeleccionado = tiposDocumento.find(tipo => tipo.codigo === tipoDoc);

  const totalDeb = lineas.reduce((s, l) => s + parseCOP(l.debito), 0);
  const totalCred = lineas.reduce((s, l) => s + parseCOP(l.credito), 0);
  const diff = totalDeb - totalCred;
  const isBalanced = diff === 0 && totalDeb > 0;

  function erroresLinea(l: Linea): string[] {
    const e: string[] = [];
    if (parseCOP(l.debito) > 0 && parseCOP(l.credito) > 0) e.push('La partida no puede tener débito y crédito simultáneamente');
    if (!l.cuenta.trim()) return e;
    const cuenta = cuentas.find(c => c.codigo === l.cuenta);
    if (!cuenta) {
      e.push('La cuenta no existe en el plan de cuentas');
      return e;
    }
    if (!cuenta.afectable) e.push('La cuenta no es afectable');
    if (cuenta.requiereTercero && (!l.tercero || !l.nit || !l.terceroValidado)) e.push('La cuenta requiere un tercero válido de FADCLI');
    if (!cuenta.requiereTercero && (l.tercero || l.nit)) e.push('La cuenta no maneja tercero');
    if (cuenta.requiereCentro && !centros.some(centro => centro.codigo === l.centro)) e.push('La cuenta requiere un centro válido de CONCECOS');
    if (!cuenta.requiereCentro && l.centro) e.push('La cuenta no maneja centro de costo');
    if (cuenta.requiereBase && parseCOP(l.base) <= 0) e.push('La cuenta requiere base');
    return e;
  }

  const lineasConError = lineas.filter(l => erroresLinea(l).length > 0);
  const totalErrores = lineas.reduce((s, l) => s + erroresLinea(l).length, 0);
  const sinErrores = totalErrores === 0;
  const cabeceraCompleta = Boolean(
    comprobante
    && tipoDoc
    && concepto.trim()
    && periodo === fecha.slice(0, 7)
    && (tipoDocumentoSeleccionado?.permiteModificarConsecutivo !== true || numDoc.trim()),
  );
  const puedePostear = isBalanced && sinErrores && cabeceraCompleta && !posted && !contabilizando && !maestrosCargando && !maestrosError;

  function updateLine(id: number, field: keyof Linea, value: string) {
    setLineas(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      // Una partida contable tiene una sola naturaleza. Al digitar un débito
      // se elimina cualquier crédito de esa línea y viceversa; el JSX bloquea
      // luego el campo contrario mientras el importe sea mayor que cero.
      if (field === 'debito' && parseCOP(value) > 0) updated.credito = '';
      if (field === 'credito' && parseCOP(value) > 0) updated.debito = '';
      if (field === 'cuenta') {
        const cuenta = cuentas.find(c => c.codigo === value.trim());
        updated.nombreCuenta = cuenta?.nombre ?? '';
        if (!cuenta?.requiereTercero) {
          updated.tercero = '';
          updated.nit = '';
          updated.terceroValidado = false;
        }
        if (!cuenta?.requiereCentro) updated.centro = '';
      }
      return updated;
    }));
    setShowCuentaPicker(null);
  }

  /** Devuelve los controles activos en el orden contable de digitación. */
  function camposNavegables(): HTMLElement[] {
    if (!capturaRef.current) return [];
    return Array.from(capturaRef.current.querySelectorAll<HTMLElement>('[data-capture-nav="true"]'))
      .filter(element => !element.hasAttribute('disabled') && element.getClientRects().length > 0);
  }

  function enfocarSiguiente(actual: HTMLElement, direccion: 1 | -1 = 1) {
    const campos = camposNavegables();
    const indice = campos.indexOf(actual);
    const siguiente = campos[indice + direccion];
    if (siguiente) {
      siguiente.focus();
      if (siguiente instanceof HTMLInputElement) siguiente.select();
      return true;
    }
    return false;
  }

  /** Enter avanza como en el formulario original; Shift+Enter devuelve el foco. */
  function navegarFormulario(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    const actual = event.target as HTMLElement;
    if (actual.dataset.captureNav !== 'true') return;
    event.preventDefault();
    const direccion = event.shiftKey ? -1 : 1;
    if (enfocarSiguiente(actual, direccion)) return;

    // En la última columna de la última línea, Enter crea la siguiente línea y
    // deja el cursor listo en Cuenta para continuar digitando sin usar el mouse.
    if (direccion === 1 && actual.dataset.lineField === 'concepto') {
      const nueva = newLine(numDoc, concepto);
      setLineas(prev => [...prev, nueva]);
      requestAnimationFrame(() => capturaRef.current
        ?.querySelector<HTMLElement>(`[data-line-id="${nueva.id}"][data-line-field="cuenta"]`)
        ?.focus());
    }
  }

  function addLine() {
    setLineas(prev => [...prev, newLine(numDoc, concepto)]);
  }

  function deleteLine(id: number) {
    setLineas(prev => prev.filter(l => l.id !== id));
  }

  const filteredCuentas = cuentasAfectables.filter(c => {
    const q = cuentaSearch.toLowerCase();
    return c.codigo.includes(q) || c.nombre.toLowerCase().includes(q);
  });

  function confirmarCuentaDesdeTeclado(event: ReactKeyboardEvent<HTMLInputElement>, lineId: number) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setShowCuentaPicker(null);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const ultimo = Math.min(filteredCuentas.length, 15) - 1;
      if (ultimo >= 0) setCuentaOpcion(actual => event.key === 'ArrowDown' ? Math.min(actual + 1, ultimo) : Math.max(actual - 1, 0));
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    const exacta = cuentasAfectables.find(cuenta => cuenta.codigo === event.currentTarget.value.trim());
    const seleccionada = exacta ?? filteredCuentas[cuentaOpcion];
    if (!seleccionada) return;
    const control = event.currentTarget;
    updateLine(lineId, 'cuenta', seleccionada.codigo);
    requestAnimationFrame(() => enfocarSiguiente(control));
  }

  async function buscarTerceros() {
    const termino = terceroSearch.trim();
    if (termino.length < 2) {
      setTercerosError('Escriba al menos dos caracteres del NIT o del nombre.');
      setTercerosEncontrados([]);
      return;
    }
    setTercerosCargando(true);
    setTercerosError('');
    try {
      const response = await listarTerceros({ page: 1, pageSize: 30, search: termino, estado: 'todos' });
      setTercerosEncontrados(response.items);
    } catch (cause: unknown) {
      setTercerosEncontrados([]);
      setTercerosError(cause instanceof Error ? cause.message : 'No fue posible buscar en FADCLI.');
    } finally {
      setTercerosCargando(false);
    }
  }

  function seleccionarTercero(lineId: number, tercero: Tercero) {
    const control = capturaRef.current?.querySelector<HTMLElement>(`[data-line-id="${lineId}"][data-line-field="tercero"]`);
    setLineas(prev => prev.map(line => line.id === lineId ? {
      ...line,
      nit: tercero.nit,
      tercero: tercero.nombre,
      terceroValidado: true,
    } : line));
    setShowTerceroPicker(null);
    setTerceroSearch('');
    setTercerosEncontrados([]);
    setTercerosError('');
    requestAnimationFrame(() => { if (control) enfocarSiguiente(control); });
  }

  /**
   * El documento y el concepto identifican al comprobante completo. Se copian
   * a cada partida para conservar el mismo dato que grabará el movimiento.
   */
  function cambiarNumeroDocumento(value: string) {
    setNumDoc(value);
    setLineas(prev => prev.map(linea => ({ ...linea, documento: value })));
  }

  function cambiarConceptoGeneral(value: string) {
    setConcepto(value);
    setLineas(prev => prev.map(linea => ({ ...linea, concepto: value })));
  }

  function insertarPlantilla(pls: PlantillaLinea[]) {
    const nuevas: Linea[] = pls.map(p => {
      const cuenta = cuentasAfectables.find(c => c.codigo === p.cuenta);
      const l = newLine(numDoc, concepto);
      return {
        ...l,
        cuenta: p.cuenta,
        nombreCuenta: cuenta?.nombre ?? '',
        // Las plantillas de demostración no pueden certificar la existencia de
        // un tercero en FADCLI; cuando sea requerido el usuario debe elegirlo.
        tercero: '',
        nit: '',
        terceroValidado: false,
        centro: cuenta?.requiereCentro && centros.some(c => c.codigo === p.centro) ? p.centro : '',
        debito: p.debito,
        credito: p.credito,
        base: p.base,
        documento: numDoc,
        concepto,
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
      const l = newLine(prim.documento, prim.concepto);
      return {
        ...l,
        cuenta: m.cuenta,
        nombreCuenta: m.nombreCuenta,
        nit: '',
        tercero: '',
        terceroValidado: false,
        centro: cuentas.find(c => c.codigo === m.cuenta)?.requiereCentro && centros.some(c => c.codigo === m.centro) ? m.centro : '',
        documento: prim.documento,
        debito: m.debito ? String(m.debito) : '',
        credito: m.credito ? String(m.credito) : '',
        base: m.base ? String(m.base) : '',
        concepto: prim.concepto,
      };
    }));
    setShowCargarDoc(false);
    setAviso({ tipo: 'success', texto: `Documento ${doc.documento} cargado con ${doc.lineas.length} líneas.` });
  }

  function guardarBorrador() {
    if (!onCrearLote) return;
    if (maestrosCargando || maestrosError || !sinErrores) {
      setAviso({ tipo: 'error', texto: 'Corrija las validaciones de cuenta, tercero y centro antes de guardar el borrador.' });
      return;
    }
    const codigo = `CD-${String(cdCounter++).padStart(2, '0')}`;
    const lineasLote: LoteLinea[] = lineas
      .filter(l => l.cuenta.trim() || parseCOP(l.debito) > 0 || parseCOP(l.credito) > 0)
      .map((l, i) => {
        const cuenta = cuentas.find(c => c.codigo === l.cuenta);
        return {
          id: `L${String(i + 1).padStart(2, '0')}`,
          cuenta: l.cuenta,
          nombreCuenta: cuenta?.nombre ?? l.nombreCuenta,
          nit: l.nit,
          tercero: l.tercero,
          centro: l.centro,
          comprobante: `${comprobante}-${String(cdCounter).padStart(6, '0')}`,
          documento: l.documento || numDoc || `${tipoDoc || 'DOC'}-000001`,
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

  async function confirmarPost() {
    if (!puedePostear) return;
    setContabilizando(true);
    setAviso(null);
    try {
      const resultado = await contabilizarCaptura({
        cia,
        fecha,
        comprobante,
        tipoDocumento: tipoDoc,
        numeroDocumento: numDoc.trim(),
        concepto: concepto.trim(),
        // Código corto compatible con MOV01.TUSUA (4 caracteres).
        usuario: USUARIO.nombre.split(/\s+/).map(parte => parte[0] ?? '').join('').slice(0, 4).toUpperCase() || 'WEB',
        lineas: lineas
          .filter(linea => parseCOP(linea.debito) > 0 || parseCOP(linea.credito) > 0)
          .map(linea => ({
            cuenta: linea.cuenta.trim(),
            nit: linea.nit.trim(),
            centro: linea.centro.trim(),
            debito: parseCOP(linea.debito),
            credito: parseCOP(linea.credito),
            base: parseCOP(linea.base),
            documentoAfectado: '',
          })),
      });
      setResultadoContabilizacion(resultado);
      setNumDoc(resultado.documento);
      setLineas(prev => prev.map(linea => ({ ...linea, documento: resultado.documento })));
      setShowConfirm(false);
      setPosted(true);
      if (resultado.advertencia) {
        setAviso({ tipo: 'error', texto: resultado.advertencia });
      }
    } catch (cause: unknown) {
      setShowConfirm(false);
      setAviso({
        tipo: 'error',
        texto: cause instanceof Error ? cause.message : 'No fue posible contabilizar el documento en Advantage.',
      });
    } finally {
      setContabilizando(false);
    }
  }

  function nuevaCaptura() {
    setPosted(false);
    setResultadoContabilizacion(null);
    setNumDoc('');
    setConcepto('');
    setLineas([newLine(), newLine()]);
  }

  return (
    <div ref={capturaRef} onKeyDown={navegarFormulario} className="flex flex-col h-full">
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

      {maestrosCargando && <div className="shrink-0 border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-700">Consultando CONMAE, CONCECOS, CONTICOM, VISDOCUM y CONCTR para la compañía {cia}…</div>}
      {maestrosError && <div role="alert" className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{maestrosError}</div>}

      {/* Header form */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Período <span className="font-normal text-gray-400">(CONCTR)</span></label>
            <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              autoFocus data-capture-nav="true"
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Comprobante <span className="font-normal text-gray-400">(CONTICOM)</span></label>
            <select value={comprobante} onChange={e => setComprobante(e.target.value)}
              data-capture-nav="true"
              disabled={maestrosCargando || comprobantes.length === 0}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1">
              <option value="">{maestrosCargando ? 'Cargando…' : 'Seleccione…'}</option>
              {comprobantes.map(c => (
                <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo documento <span className="font-normal text-gray-400">(VISDOCUM)</span></label>
            <select value={tipoDoc} onChange={e => {
              const nuevoTipo = e.target.value;
              setTipoDoc(nuevoTipo);
              if (tiposDocumento.find(tipo => tipo.codigo === nuevoTipo)?.permiteModificarConsecutivo !== true) {
                cambiarNumeroDocumento('');
              }
            }}
              data-capture-nav="true"
              disabled={maestrosCargando || tiposDocumentoOrdenados.length === 0}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1">
              <option value="">{maestrosCargando ? 'Cargando…' : 'Seleccione…'}</option>
              {tiposDocumentoOrdenados.map(tipo => (
                <option key={tipo.codigo} value={tipo.codigo}>
                  {tipo.codigo} — {tipo.nombre}{tipo.comprobante ? ` · Comp. ${tipo.comprobante}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">N.° documento</label>
            <input value={numDoc} onChange={e => cambiarNumeroDocumento(e.target.value)}
              placeholder={tipoDocumentoSeleccionado?.permiteModificarConsecutivo === true ? 'Digite el número' : 'Se asigna al contabilizar'}
              disabled={tipoDocumentoSeleccionado?.permiteModificarConsecutivo !== true}
              data-capture-nav="true"
              className="w-full font-mono text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 disabled:bg-gray-100 disabled:text-gray-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tercero header</label>
            <select value={terceroHdr} onChange={e => setTerceroHdr(e.target.value)}
              data-capture-nav="true"
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1">
              <option value="">— Sin tercero —</option>
              {TERCEROS.map(t => <option key={t.nit} value={t.nit}>{t.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Concepto general</label>
          <input value={concepto} onChange={e => cambiarConceptoGeneral(e.target.value)} placeholder="Descripción del comprobante..."
            data-capture-nav="true"
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 max-w-xl" />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
          <span><kbd className="rounded border bg-gray-50 px-1">Enter</kbd> siguiente campo</span>
          <span><kbd className="rounded border bg-gray-50 px-1">Shift + Enter</kbd> campo anterior</span>
          <span><kbd className="rounded border bg-gray-50 px-1">↑ ↓</kbd> recorrer opciones</span>
          <span><kbd className="rounded border bg-gray-50 px-1">Esc</kbd> cerrar buscador</span>
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
                const cuentaLinea = cuentas.find(cuenta => cuenta.codigo === line.cuenta);
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
                          disabled={maestrosCargando || Boolean(maestrosError)}
                          data-capture-nav="true"
                          data-line-id={line.id}
                          data-line-field="cuenta"
                          onChange={e => { setCuentaSearch(e.target.value); setCuentaOpcion(0); updateLine(line.id, 'cuenta', e.target.value); setShowCuentaPicker(line.id); }}
                          onFocus={() => { setEditingId(line.id); setCuentaSearch(line.cuenta); setCuentaOpcion(0); setShowCuentaPicker(line.id); }}
                          onKeyDown={event => confirmarCuentaDesdeTeclado(event, line.id)}
                          onClick={e => e.stopPropagation()}
                          placeholder="código"
                        />
                        {showCuentaPicker === line.id && (
                          <div className="absolute top-8 left-0 z-20 bg-white border border-gray-200 rounded shadow-lg w-72">
                            <div className="border-b bg-gray-50 px-3 py-2 text-[11px] text-gray-500">Digite código o nombre en el campo Cuenta. Use ↑/↓ y confirme con Enter.</div>
                            <div className="max-h-40 overflow-y-auto">
                              {!maestrosCargando && filteredCuentas.length === 0 && <div className="px-3 py-3 text-center text-gray-400">No existe una cuenta afectable que coincida en CONMAE.</div>}
                              {filteredCuentas.slice(0, 15).map((c, optionIndex) => (
                                <div
                                  key={c.codigo}
                                  className={`px-3 py-1.5 cursor-pointer flex items-center gap-2 ${optionIndex === cuentaOpcion ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                  onMouseEnter={() => setCuentaOpcion(optionIndex)}
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
                    <td className="relative px-2 py-1.5">
                      <button
                        type="button"
                        disabled={!cuentaLinea?.requiereTercero}
                        data-capture-nav="true"
                        data-line-id={line.id}
                        data-line-field="tercero"
                        onClick={event => {
                          event.stopPropagation();
                          setShowTerceroPicker(line.id);
                          setTerceroSearch(line.nit || line.tercero);
                          setTercerosEncontrados([]);
                          setTercerosError('');
                        }}
                        onKeyDown={event => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            setShowTerceroPicker(line.id);
                            setTerceroSearch(line.nit || line.tercero);
                            setTercerosEncontrados([]);
                            setTercerosError('');
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            setShowTerceroPicker(null);
                          }
                        }}
                        className={`w-full truncate rounded border px-1 py-1 text-left text-xs focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 ${errs.some(e => e.includes('tercero')) ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                        title={cuentaLinea?.requiereTercero ? 'Buscar tercero en FADCLI' : 'Esta cuenta no maneja tercero'}
                      >
                        {cuentaLinea?.requiereTercero ? (line.nit ? `${line.nit} — ${line.tercero}` : 'Buscar en FADCLI…') : 'No aplica'}
                      </button>
                      {showTerceroPicker === line.id && cuentaLinea?.requiereTercero && <div className="absolute left-0 top-8 z-20 w-96 rounded border border-gray-200 bg-white shadow-lg" onClick={event => event.stopPropagation()}>
                        <div className="flex gap-2 border-b p-2">
                          <input
                            autoFocus
                            value={terceroSearch}
                            onChange={event => setTerceroSearch(event.target.value)}
                            onKeyDown={event => {
                              if (event.key === 'Enter') { event.preventDefault(); void buscarTerceros(); }
                              if (event.key === 'ArrowDown' && tercerosEncontrados.length) {
                                event.preventDefault();
                                capturaRef.current?.querySelector<HTMLElement>(`[data-third-option="${line.id}-0"]`)?.focus();
                              }
                              if (event.key === 'Escape') {
                                event.preventDefault();
                                setShowTerceroPicker(null);
                                capturaRef.current?.querySelector<HTMLElement>(`[data-line-id="${line.id}"][data-line-field="tercero"]`)?.focus();
                              }
                            }}
                            placeholder="NIT o nombre (mínimo 2 caracteres)"
                            className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none"
                          />
                          <button type="button" disabled={tercerosCargando} onClick={() => void buscarTerceros()} className="rounded bg-petroleum-500 px-3 py-1 text-xs font-medium text-white disabled:opacity-50">{tercerosCargando ? 'Buscando…' : 'Buscar'}</button>
                        </div>
                        {tercerosError && <div className="border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{tercerosError}</div>}
                        <div className="max-h-52 overflow-y-auto">
                          {!tercerosCargando && !tercerosError && tercerosEncontrados.length === 0 && <div className="px-3 py-4 text-center text-xs text-gray-400">Busque y seleccione un registro existente en FADCLI.</div>}
                          {tercerosEncontrados.map(tercero => <button
                            type="button"
                            key={tercero.nit}
                            data-third-option={`${line.id}-${tercerosEncontrados.indexOf(tercero)}`}
                            onClick={() => seleccionarTercero(line.id, tercero)}
                            className="flex w-full items-center gap-2 border-b border-gray-50 px-3 py-2 text-left hover:bg-gray-50"
                          >
                            <span className="w-28 shrink-0 font-mono text-xs text-gray-600">{tercero.nit}</span>
                            <span className="min-w-0 flex-1 truncate text-xs text-gray-700">{tercero.nombre}</span>
                            <span className={`text-[10px] ${tercero.estado === 'Activo' ? 'text-green-600' : 'text-amber-600'}`}>{tercero.estado}</span>
                          </button>)}
                        </div>
                      </div>}
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        disabled={!cuentaLinea?.requiereCentro}
                        data-capture-nav="true"
                        data-line-id={line.id}
                        data-line-field="centro"
                        title={cuentaLinea?.requiereCentro ? 'Centros de CONCECOS para la compañía activa' : 'Esta cuenta no maneja centro de costo'}
                        className={`w-full rounded border px-1 py-1 text-xs focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 ${errs.some(e => e.includes('centro')) ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                        value={line.centro}
                        onChange={e => updateLine(line.id, 'centro', e.target.value)}
                        onClick={e => e.stopPropagation()}
                      >
                        <option value="">{cuentaLinea?.requiereCentro ? 'Seleccione…' : 'No aplica'}</option>
                        {centros.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        data-capture-nav="true"
                        data-line-id={line.id}
                        data-line-field="documento"
                        readOnly
                        title="Heredado del número de documento de la cabecera"
                        className="w-full cursor-default bg-gray-50 font-mono text-xs text-gray-600 border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1"
                        value={line.documento}
                        onClick={e => e.stopPropagation()}
                        placeholder="Desde cabecera"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        data-capture-nav="true"
                        data-line-id={line.id}
                        data-line-field="debito"
                        inputMode="decimal"
                        disabled={parseCOP(line.credito) > 0}
                        title={parseCOP(line.credito) > 0 ? 'Bloqueado porque esta partida tiene valor crédito' : 'Valor débito de la partida'}
                        className="w-full font-mono text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 text-right disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                        value={line.debito}
                        onChange={e => updateLine(line.id, 'debito', e.target.value)}
                        onClick={e => e.stopPropagation()}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        data-capture-nav="true"
                        data-line-id={line.id}
                        data-line-field="credito"
                        inputMode="decimal"
                        disabled={parseCOP(line.debito) > 0}
                        title={parseCOP(line.debito) > 0 ? 'Bloqueado porque esta partida tiene valor débito' : 'Valor crédito de la partida'}
                        className="w-full font-mono text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 text-right disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                        value={line.credito}
                        onChange={e => updateLine(line.id, 'credito', e.target.value)}
                        onClick={e => e.stopPropagation()}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        data-capture-nav="true"
                        data-line-id={line.id}
                        data-line-field="base"
                        className={`w-full font-mono text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-1 text-right ${errs.some(e => e.includes('base')) ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                        value={line.base}
                        onChange={e => updateLine(line.id, 'base', e.target.value)}
                        onClick={e => e.stopPropagation()}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        data-capture-nav="true"
                        data-line-id={line.id}
                        data-line-field="concepto"
                        readOnly
                        title="Heredado del concepto general de la cabecera"
                        className="w-full cursor-default bg-gray-50 text-xs text-gray-600 border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1"
                        value={line.concepto}
                        onClick={e => e.stopPropagation()}
                        placeholder="Desde cabecera"
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
              <button disabled={contabilizando} onClick={() => void confirmarPost()} className="text-xs px-4 py-2 rounded text-white font-medium disabled:cursor-wait disabled:opacity-60" style={{ backgroundColor: '#0073C0' }}>
                {contabilizando ? 'Grabando en Advantage…' : 'Contabilizar'}
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
            <p className="text-xs text-gray-500">El movimiento fue registrado directamente en Advantage.</p>
            <p className="my-3 font-mono text-sm font-semibold text-petroleum-700">{resultadoContabilizacion?.documento}</p>
            <p className="text-xs text-gray-500 mb-4">{resultadoContabilizacion?.lineas ?? 0} partidas · período {periodo}</p>
            {resultadoContabilizacion?.auditoria === 'Pendiente' && (
              <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">Documento confirmado; auditoría global pendiente de revisión.</p>
            )}
            <button
              onClick={nuevaCaptura}
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
      {(showCuentaPicker !== null || showTerceroPicker !== null) && (
        <div className="fixed inset-0 z-10" onClick={() => { setShowCuentaPicker(null); setShowTerceroPicker(null); }} />
      )}
    </div>
  );
}
