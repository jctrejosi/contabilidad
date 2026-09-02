import { useId, useRef, useState, useEffect, type ReactNode } from 'react';
import { CUENTAS, EMPRESA, LOTES_INICIALES, fmtCOP } from '../data/mock';
import type { Lote, LoteLinea } from '../types';
import type { NavPage } from '../components/Shell';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const SELECT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500 disabled:cursor-not-allowed disabled:opacity-50';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500 disabled:cursor-not-allowed disabled:opacity-50';

const PASOS = ['Archivo', 'Hoja y mapeo', 'Previsualizar', 'Validar', 'Importar'];
const FORMATOS = ['XLS / XLSX', 'ADT', 'XLS por meses', 'TXT', 'CSV'];
const COLUMNAS_FUENTE = [
  'A: Fecha', 'B: Cuenta', 'C: Nit', 'D: Centro', 'E: Comprobante', 'F: Documento',
  'G: Tipo', 'H: Débito', 'I: Crédito', 'J: Base', 'K: Impuesto', 'L: Concepto',
];
const CAMPOS: { campo: string; label: string }[] = [
  { campo: 'cuenta', label: 'Cuenta' },
  { campo: 'nit', label: 'NIT' },
  { campo: 'centro', label: 'Centro' },
  { campo: 'comprobante', label: 'Comprobante' },
  { campo: 'documento', label: 'Documento' },
  { campo: 'tipo', label: 'Tipo' },
  { campo: 'fecha', label: 'Fecha' },
  { campo: 'debito', label: 'Débito' },
  { campo: 'credito', label: 'Crédito' },
  { campo: 'base', label: 'Base' },
  { campo: 'impuesto', label: 'Impuesto' },
  { campo: 'concepto', label: 'Concepto' },
];
const MAPEO_DEFAULT: Record<string, string> = {
  cuenta: 'B: Cuenta',
  nit: 'C: Nit',
  centro: 'D: Centro',
  comprobante: 'E: Comprobante',
  documento: 'F: Documento',
  tipo: 'G: Tipo',
  fecha: 'A: Fecha',
  debito: 'H: Débito',
  credito: 'I: Crédito',
  base: 'J: Base',
  impuesto: 'K: Impuesto',
  concepto: 'L: Concepto',
};

type EstadoFila = 'aceptada' | 'advertida' | 'rechazada' | 'duplicada';

interface FilaPreview {
  fila: number;
  cuenta: string;
  nit: string;
  tercero: string;
  centro: string;
  comprobante: string;
  documento: string;
  tipoDoc: string;
  fecha: string;
  debito: number;
  credito: number;
  base: number;
  clase: string;
  concepto: string;
  estado: EstadoFila;
  motivo: string;
}

const FILAS_PREVIEW: FilaPreview[] = [
  { fila: 1, cuenta: '111005', nit: '800.100.200', tercero: 'Empresa ABC Comercial S.A.S.', centro: '', comprobante: 'CE-000246', documento: 'OR-2026-024', tipoDoc: 'OR', fecha: '2026-02-15', debito: 6200000, credito: 0, base: 0, clase: '', concepto: 'Recaudo cartera ABC', estado: 'aceptada', motivo: '' },
  { fila: 2, cuenta: '130505', nit: '800.100.200', tercero: 'Empresa ABC Comercial S.A.S.', centro: '', comprobante: 'CE-000246', documento: 'OR-2026-024', tipoDoc: 'OR', fecha: '2026-02-15', debito: 0, credito: 6200000, base: 0, clase: '', concepto: 'Recaudo cartera ABC', estado: 'aceptada', motivo: '' },
  { fila: 3, cuenta: '111005', nit: '900.200.300', tercero: 'Comercial XYZ Distribuciones Ltda.', centro: '', comprobante: 'CE-000246', documento: 'OR-2026-025', tipoDoc: 'OR', fecha: '2026-02-16', debito: 9800000, credito: 0, base: 0, clase: '', concepto: 'Recaudo cartera XYZ', estado: 'aceptada', motivo: '' },
  { fila: 4, cuenta: '130505', nit: '900.200.300', tercero: 'Comercial XYZ Distribuciones Ltda.', centro: '', comprobante: 'CE-000246', documento: 'OR-2026-025', tipoDoc: 'OR', fecha: '2026-02-16', debito: 0, credito: 9800000, base: 0, clase: '', concepto: 'Recaudo cartera XYZ', estado: 'aceptada', motivo: '' },
  { fila: 5, cuenta: '111005', nit: '860.050.010', tercero: 'Suministros Técnicos del Norte Ltda.', centro: '', comprobante: 'CE-000247', documento: 'OR-2026-026', tipoDoc: 'OR', fecha: '2026-02-18', debito: 0, credito: 3500000, base: 0, clase: '', concepto: 'Pago proveedor materiales', estado: 'aceptada', motivo: '' },
  { fila: 6, cuenta: '130505', nit: '860.050.010', tercero: 'Suministros Técnicos del Norte Ltda.', centro: '', comprobante: 'CE-000247', documento: 'OR-2026-026', tipoDoc: 'OR', fecha: '2026-02-18', debito: 3500000, credito: 0, base: 0, clase: '', concepto: 'Pago proveedor materiales', estado: 'aceptada', motivo: '' },
  { fila: 7, cuenta: '510506', nit: '', tercero: '', centro: '', comprobante: 'NO-000090', documento: 'AJ-2026-004', tipoDoc: 'NO', fecha: '2026-02-20', debito: 450000, credito: 0, base: 0, clase: '', concepto: 'Ajuste nómina sin tercero', estado: 'advertida', motivo: 'La cuenta 510506 requiere tercero (NIT)' },
  { fila: 8, cuenta: '250505', nit: '12.345.678', tercero: 'García Moreno Juan Pablo', centro: 'ADM', comprobante: 'NO-000090', documento: 'AJ-2026-004', tipoDoc: 'NO', fecha: '2026-02-20', debito: 0, credito: 450000, base: 0, clase: '', concepto: 'Ajuste nómina provisión', estado: 'advertida', motivo: 'Importada con advertencia' },
  { fila: 9, cuenta: '999999', nit: '', tercero: '', centro: '', comprobante: 'CE-000247', documento: 'OR-2026-027', tipoDoc: 'OR', fecha: '2026-02-19', debito: 1000000, credito: 0, base: 0, clase: '', concepto: 'Cuenta inexistente', estado: 'rechazada', motivo: 'La cuenta 999999 no existe en el plan de cuentas' },
  { fila: 10, cuenta: '111005', nit: '800.100.200', tercero: 'Empresa ABC Comercial S.A.S.', centro: '', comprobante: 'CE-000246', documento: 'OR-2026-024', tipoDoc: 'OR', fecha: '2026-02-15', debito: 6200000, credito: 0, base: 0, clase: '', concepto: 'Recaudo cartera ABC', estado: 'duplicada', motivo: 'Fila duplicada de la fila 1' },
];

interface PlantillaMapeo {
  id: string;
  nombre: string;
  mapeo: Record<string, string>;
}

interface Props {
  onNavigate: (p: NavPage) => void;
  onCrearLote: (l: Lote) => void;
}

const STORAGE_KEY = `contabdsi:importaciones:mapeos:v1:${EMPRESA.codigo}`;

function esPlantilla(v: unknown): v is PlantillaMapeo {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.nombre === 'string' && typeof o.mapeo === 'object' && o.mapeo !== null;
}

function cargarPlantillas(): PlantillaMapeo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (Array.isArray(value)) return value.filter(esPlantilla);
    }
  } catch {
    // Almacenamiento deshabilitado o dato dañado: no bloquear la pantalla.
  }
  return [];
}

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export default function Importaciones({ onNavigate, onCrearLote }: Props) {
  const [paso, setPaso] = useState(0);
  const [archivo, setArchivo] = useState<{ nombre: string; tamanio: string } | null>(null);
  const [formato, setFormato] = useState('XLS / XLSX');
  const [hoja, setHoja] = useState('Movimientos');
  const [mapeo, setMapeo] = useState<Record<string, string>>({ ...MAPEO_DEFAULT });
  const [plantillas, setPlantillas] = useState<PlantillaMapeo[]>(cargarPlantillas);
  const [nombrePlantilla, setNombrePlantilla] = useState('');
  const [loteDestino, setLoteDestino] = useState<'nuevo' | string>('nuevo');
  const [loteCodigo, setLoteCodigo] = useState('IMP2');
  const [loteNombre, setLoteNombre] = useState('Importación Excel febrero 2026');
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [loteCreado, setLoteCreado] = useState<Lote | null>(null);
  const [aviso, setAviso] = useState(false);
  const avisoRef = useRef<HTMLButtonElement>(null);

  const conteos = {
    aceptadas: FILAS_PREVIEW.filter(f => f.estado === 'aceptada').length,
    advertidas: FILAS_PREVIEW.filter(f => f.estado === 'advertida').length,
    rechazadas: FILAS_PREVIEW.filter(f => f.estado === 'rechazada').length,
    duplicadas: FILAS_PREVIEW.filter(f => f.estado === 'duplicada').length,
  };

  const filasValidas = FILAS_PREVIEW.filter(f => f.estado === 'aceptada' || f.estado === 'advertida');
  const totalDebito = filasValidas.reduce((s, f) => s + f.debito, 0);
  const totalCredito = filasValidas.reduce((s, f) => s + f.credito, 0);
  const mapeoCompleto = CAMPOS.every(c => mapeo[c.campo]);

  function grabarPlantilla() {
    const nombre = nombrePlantilla.trim() || `Mapeo ${plantillas.length + 1}`;
    const nueva: PlantillaMapeo = { id: `pl-${Date.now()}`, nombre, mapeo: { ...mapeo } };
    const siguientes = [...plantillas, nueva];
    setPlantillas(siguientes);
    setNombrePlantilla('');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(siguientes));
    } catch {
      // El mapeo queda disponible en memoria durante la sesión.
    }
  }

  function usarPlantilla(plantilla: PlantillaMapeo) {
    setMapeo({ ...MAPEO_DEFAULT, ...plantilla.mapeo });
    setPaso(1);
  }

  function eliminarPlantilla(id: string) {
    const siguientes = plantillas.filter(p => p.id !== id);
    setPlantillas(siguientes);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(siguientes));
    } catch {
      // Ignorar fallo de almacenamiento.
    }
  }

  function construirLineas(): LoteLinea[] {
    return filasValidas.map((f, i) => {
      const cuenta = CUENTAS.find(c => c.codigo === f.cuenta);
      return {
        id: `L${String(i + 1).padStart(2, '0')}`,
        cuenta: f.cuenta,
        nombreCuenta: cuenta?.nombre ?? f.cuenta,
        nit: f.nit,
        tercero: f.tercero,
        centro: f.centro,
        comprobante: f.comprobante,
        documento: f.documento,
        fecha: f.fecha,
        debito: f.debito,
        credito: f.credito,
        base: f.base,
        clase: f.clase,
        docAfectado: '',
        concepto: f.concepto,
        errores: [],
      };
    });
  }

  async function importar() {
    setImportando(true);
    setProgreso(0);
    for (let p = 0; p <= 100; p += 25) {
      setProgreso(p);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    const lineas = construirLineas();
    const existente = LOTES_INICIALES.find(l => l.id === loteDestino);
    const lote: Lote = {
      id: `lote-${Date.now()}`,
      codigo: existente?.codigo ?? loteCodigo,
      nombre: existente?.nombre ?? loteNombre,
      periodo: '2026-02',
      usuario: 'Laura Gómez',
      origen: `Importación ${formato}`,
      fecha: '2026-02-20',
      lineasCount: lineas.length,
      debito: totalDebito,
      credito: totalCredito,
      diferencia: 0,
      erroresCount: 0,
      estado: 'Borrador',
      lineas,
    };
    onCrearLote(lote);
    setLoteCreado(lote);
    setImportando(false);
    setAviso(true);
  }

  const badgeFila: Record<EstadoFila, string> = {
    aceptada: 'bg-green-100 text-green-700',
    advertida: 'bg-amber-100 text-amber-700',
    rechazada: 'bg-red-100 text-red-700',
    duplicada: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Movimientos / Importaciones</div>
          <h1 className="text-lg font-semibold text-gray-800">Importaciones</h1>
          <p className="mt-1 text-xs text-gray-500">Asistente para importar movimientos contables desde XLS, XLSX, ADT, TXT y CSV.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      <div className="rounded-md border border-petroleum-100 bg-petroleum-50 px-3 py-2 text-xs text-petroleum-800">
        <span className="font-semibold">Regla:</span> toda importación masiva termina en un lote para validación antes de contabilizar.
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {PASOS.map((s, i) => (
          <div key={s} className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setPaso(i)}
              disabled={i > paso || importando}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded font-medium transition-colors ${
                i === paso ? 'bg-petroleum-500 text-white' :
                i < paso ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                i < paso ? 'bg-green-100 text-green-700' : i === paso ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{i < paso ? '✓' : i + 1}</span>
              {s}
            </button>
            {i < PASOS.length - 1 && <span className="text-gray-200 mx-1">›</span>}
          </div>
        ))}
      </div>

      {/* Paso 1: Archivo */}
      {paso === 0 && (
        <div className="bg-white rounded border border-gray-200 p-4 space-y-4">
          <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
            <legend className="px-2 text-xs font-semibold text-petroleum-800">Archivo de origen</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">Archivo (XLS, XLSX, ADT, TXT, CSV)</label>
                <input
                  type="file"
                  accept=".xls,.xlsx,.adt,.txt,.csv"
                  className={`${INPUT} file:mr-2 file:rounded file:border-0 file:bg-petroleum-50 file:px-2 file:py-0.5 file:text-xs file:font-medium file:text-petroleum-700`}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) setArchivo({ nombre: f.name, tamanio: formatearTamano(f.size) });
                  }}
                />
                <p className="text-xs text-gray-400">Solo se muestra el nombre y el tamaño; el contenido no se lee en esta demostración.</p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">Formato</label>
                <select value={formato} onChange={e => setFormato(e.target.value)} className={SELECT}>
                  {FORMATOS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </fieldset>

          {archivo ? (
            <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-800">
              <span className="text-base">✓</span>
              <span className="font-mono font-medium">{archivo.nombre}</span>
              <span className="text-green-600">({archivo.tamanio})</span>
              <span className="ml-auto text-green-700">Archivo listo para revisar</span>
            </div>
          ) : (
            <button type="button" onClick={() => setArchivo({ nombre: 'movimientos_febrero_2026.xlsx', tamanio: '1,4 MB' })} className={BUTTON_SECONDARY}>
              Usar archivo de ejemplo (simulado)
            </button>
          )}

          <div className="flex justify-end">
            <button type="button" disabled={!archivo} onClick={() => setPaso(1)} className={BUTTON_PRIMARY}>
              Siguiente: hoja y mapeo →
            </button>
          </div>
        </div>
      )}

      {/* Paso 2: Hoja y mapeo */}
      {paso === 1 && (
        <div className="bg-white rounded border border-gray-200 p-4 space-y-4">
          <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
            <legend className="px-2 text-xs font-semibold text-petroleum-800">Hoja y mapeo de columnas</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">Hoja del libro</label>
                <select value={hoja} onChange={e => setHoja(e.target.value)} className={SELECT}>
                  {['Movimientos', 'Hoja1', 'Resumen'].map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">Plantilla de mapeo guardada</label>
                <div className="flex gap-2">
                  <select className={SELECT} value="" onChange={e => {
                    const p = plantillas.find(x => x.id === e.target.value);
                    if (p) usarPlantilla(p);
                  }}>
                    <option value="">— Seleccionar —</option>
                    {plantillas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  {plantillas.length > 0 && (
                    <button
                      type="button"
                      onClick={() => eliminarPlantilla(plantillas[plantillas.length - 1].id)}
                      title="Eliminar la última plantilla"
                      className="rounded border border-gray-300 px-2 text-xs text-gray-500 hover:bg-gray-50"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CAMPOS.map(c => (
                <div key={c.campo} className="grid items-center gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]">
                  <label className="text-xs font-medium text-gray-600">{c.label}</label>
                  <select
                    value={mapeo[c.campo] ?? ''}
                    onChange={e => setMapeo(prev => ({ ...prev, [c.campo]: e.target.value }))}
                    className={SELECT}
                  >
                    <option value="">— Sin mapear —</option>
                    {COLUMNAS_FUENTE.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
            <legend className="px-2 text-xs font-semibold text-petroleum-800">Guardar plantilla de mapeo</legend>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5 w-64">
                <label className="block text-xs font-medium text-gray-600">Nombre de la plantilla</label>
                <input value={nombrePlantilla} onChange={e => setNombrePlantilla(e.target.value)} placeholder="Mapeo estándar proveedores" className={INPUT} />
              </div>
              <button type="button" onClick={grabarPlantilla} disabled={!mapeoCompleto} className={BUTTON_SECONDARY}>
                Guardar mapeo actual
              </button>
            </div>
            {!mapeoCompleto && <p className="mt-2 text-xs text-amber-700">Asigne todas las columnas para poder guardar la plantilla.</p>}
          </fieldset>

          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setPaso(0)} className={BUTTON_SECONDARY}>← Anterior</button>
            <button type="button" disabled={!mapeoCompleto} onClick={() => setPaso(2)} className={BUTTON_PRIMARY}>
              Siguiente: previsualizar →
            </button>
          </div>
        </div>
      )}

      {/* Paso 3: Previsualizar */}
      {paso === 2 && (
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="text-xs font-semibold text-gray-700">
              Previsualización — hoja «{hoja}» ({archivo?.nombre})
            </div>
            <span className="text-xs text-gray-500">{FILAS_PREVIEW.length} filas leídas (muestra)</span>
          </div>
          <div className="table-fixed-header overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Fila</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Fecha</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Cuenta</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Tercero</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Documento</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Débito</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Crédito</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Concepto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {FILAS_PREVIEW.map(f => (
                  <tr key={f.fila} className="hoverable">
                    <td className="px-3 py-2 font-mono text-gray-500">{f.fila}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{f.fecha}</td>
                    <td className="px-3 py-2 font-mono text-gray-700">{f.cuenta}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-44 truncate">{f.tercero || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{f.documento}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-800">{f.debito > 0 ? fmtCOP(f.debito) : <span className="text-gray-200">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-500">{f.credito > 0 ? fmtCOP(f.credito) : <span className="text-gray-200">—</span>}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-48 truncate">{f.concepto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-t border-gray-200">
            <span className="text-xs text-gray-500">Los valores se validarán en el siguiente paso.</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPaso(1)} className={BUTTON_SECONDARY}>← Anterior</button>
              <button type="button" onClick={() => setPaso(3)} className={BUTTON_PRIMARY}>Validar archivo →</button>
            </div>
          </div>
        </div>
      )}

      {/* Paso 4: Validar */}
      {paso === 3 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2.5">
              <div className="text-2xl font-semibold text-green-700">{conteos.aceptadas}</div>
              <div className="text-xs text-green-800">Aceptadas</div>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
              <div className="text-2xl font-semibold text-amber-700">{conteos.advertidas}</div>
              <div className="text-xs text-amber-800">Advertidas</div>
            </div>
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
              <div className="text-2xl font-semibold text-red-700">{conteos.rechazadas}</div>
              <div className="text-xs text-red-800">Rechazadas</div>
            </div>
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5">
              <div className="text-2xl font-semibold text-blue-700">{conteos.duplicadas}</div>
              <div className="text-xs text-blue-800">Duplicadas</div>
            </div>
          </div>

          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3 text-xs font-semibold text-gray-700">Resultado por fila</div>
            <div className="table-fixed-header overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Fila</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Documento</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Concepto</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Estado</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {FILAS_PREVIEW.map(f => (
                    <tr key={f.fila} className={`hoverable ${f.estado === 'rechazada' ? 'row-error' : ''}`}>
                      <td className="px-3 py-2 font-mono text-gray-500">{f.fila}</td>
                      <td className="px-3 py-2 font-mono text-gray-600">{f.documento}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-48 truncate">{f.concepto}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${badgeFila[f.estado]}`}>{f.estado}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{f.motivo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-6 px-4 py-2.5 bg-gray-50 border-t border-gray-200">
              <span className="text-xs text-gray-500">Total débitos importables: <span className="font-mono font-semibold text-gray-800">{fmtCOP(totalDebito)}</span></span>
              <span className="text-xs text-gray-500">Total créditos importables: <span className="font-mono font-semibold text-gray-800">{fmtCOP(totalCredito)}</span></span>
              <span className={`text-xs font-mono font-semibold ${totalDebito === totalCredito ? 'text-green-600' : 'text-red-600'}`}>
                {totalDebito === totalCredito ? 'Cuadrado ✓' : `Descuadrado ${fmtCOP(Math.abs(totalDebito - totalCredito))}`}
              </span>
            </div>
          </div>

          <div className="bg-white rounded border border-gray-200 p-4">
            <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
              <legend className="px-2 text-xs font-semibold text-petroleum-800">Lote destino</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-600">Destino de la importación</label>
                  <select value={loteDestino} onChange={e => setLoteDestino(e.target.value)} className={SELECT}>
                    <option value="nuevo">Nuevo lote</option>
                    {LOTES_INICIALES.filter(l => l.periodo === '2026-02').map(l => (
                      <option key={l.id} value={l.id}>{l.codigo} — {l.nombre}</option>
                    ))}
                  </select>
                </div>
                {loteDestino === 'nuevo' ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-gray-600">Código del lote</label>
                      <input value={loteCodigo} onChange={e => setLoteCodigo(e.target.value)} className={`${INPUT} font-mono`} maxLength={6} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600">Nombre del lote</label>
                      <input value={loteNombre} onChange={e => setLoteNombre(e.target.value)} className={INPUT} />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-500 self-end">Las filas importables se anexarán al lote existente seleccionado.</p>
                )}
              </div>
            </fieldset>
            <div className="mt-3 flex items-center justify-between">
              <button type="button" onClick={() => setPaso(2)} className={BUTTON_SECONDARY}>← Anterior</button>
              <button type="button" onClick={() => setPaso(4)} className={BUTTON_PRIMARY}>
                Continuar a importación →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paso 5: Importar */}
      {paso === 4 && (
        <div className="bg-white rounded border border-gray-200 p-4 space-y-4">
          <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
            <legend className="px-2 text-xs font-semibold text-petroleum-800">Resumen de la importación</legend>
            <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
              {[
                ['Archivo', archivo?.nombre ?? '—'],
                ['Formato', formato],
                ['Hoja', hoja],
                ['Filas a importar', String(filasValidas.length)],
                ['Total débitos', fmtCOP(totalDebito)],
                ['Total créditos', fmtCOP(totalCredito)],
                ['Lote destino', loteDestino === 'nuevo' ? `${loteCodigo} — ${loteNombre}` : LOTES_INICIALES.find(l => l.id === loteDestino)?.nombre ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-gray-50 py-1.5">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-mono text-gray-800 text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </fieldset>

          {importando ? (
            <div className="space-y-2">
              <div className="h-2 w-full rounded bg-gray-100 overflow-hidden">
                <div className="h-full bg-petroleum-500 transition-all" style={{ width: `${progreso}%` }} />
              </div>
              <p className="text-xs text-gray-500">Importando {progreso}% — preparando lote de validación…</p>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setPaso(3)} className={BUTTON_SECONDARY}>← Anterior</button>
              <button type="button" onClick={importar} className={BUTTON_PRIMARY}>
                Importar y crear lote
              </button>
            </div>
          )}
        </div>
      )}

      {aviso && loteCreado && (
        <Modal title="Importación terminada" onClose={() => setAviso(false)}>
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-gray-600">
              Se creó el lote <span className="font-mono font-semibold text-gray-800">{loteCreado.codigo}</span> — {loteCreado.nombre} con{' '}
              <span className="font-mono">{loteCreado.lineasCount}</span> líneas, cuadrado, en estado Borrador.
            </p>
            <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600">
              Débitos <span className="font-mono font-semibold text-gray-800">{fmtCOP(loteCreado.debito)}</span> · Créditos{' '}
              <span className="font-mono font-semibold text-gray-800">{fmtCOP(loteCreado.credito)}</span> · Diferencia{' '}
              <span className="font-mono font-semibold text-green-700">$ 0</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
            <button type="button" onClick={() => setAviso(false)} className={BUTTON_SECONDARY}>Cerrar</button>
            <button
              type="button"
              ref={avisoRef}
              data-initial-focus
              onClick={() => onNavigate('movimientos/lotes')}
              className={BUTTON_PRIMARY}
            >
              Abrir lotes
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
