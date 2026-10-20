import { useRef, useState, type FormEvent } from 'react';

export interface PartidaOrigen {
  cuenta: string; nit: string; tercero: string; terceroValidado: boolean;
  centro: string; concepto: string; debito: number; credito: number; base: number; documentoAfectado: string;
}
interface DocumentoOrigen {
  comprobante: string; tipoDocumento: string; documento: string; fecha: string;
  partidas: PartidaOrigen[];
}
const INPUT = 'w-full rounded border border-gray-300 px-3 py-2 text-sm';

/** Selección de solo detalle; el componente no recibe setters del encabezado. */
export default function CargarDocumentoCaptura({ cia, periodo, tienePartidas, onClose, onLoad }: {
  cia: string; periodo: string; tienePartidas: boolean; onClose: () => void;
  onLoad: (partidas: PartidaOrigen[], documento: string) => void;
}) {
  const [anio, setAnio] = useState(Number(periodo.slice(0, 4)));
  const [mes, setMes] = useState(Number(periodo.slice(5, 7)));
  const [documento, setDocumento] = useState('');
  const [comprobante, setComprobante] = useState('');
  const [tipo, setTipo] = useState('');
  const [items, setItems] = useState<DocumentoOrigen[]>([]);
  const [consultado, setConsultado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [seleccionado, setSeleccionado] = useState<DocumentoOrigen | null>(null);
  const request = useRef(0);
  function invalidar() {
    request.current++; setItems([]); setConsultado(false); setSeleccionado(null); setError(''); setCargando(false);
  }
  async function buscar(event: FormEvent) {
    event.preventDefault();
    const version = ++request.current;
    setCargando(true); setError(''); setItems([]); setSeleccionado(null); setConsultado(false);
    try {
      const params = new URLSearchParams({ cia, anio: String(anio), mes: String(mes), documento: documento.trim(), comprobante: comprobante.trim(), tipoDocumento: tipo.trim() });
      const response = await fetch(`/api/captura/documento-origen?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'No fue posible buscar el documento.');
      if (version === request.current) { setItems(body.items); setConsultado(true); }
    } catch (cause) {
      if (version === request.current) setError(cause instanceof Error ? cause.message : 'No fue posible buscar el documento.');
    } finally { if (version === request.current) setCargando(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="cargar-documento-titulo" className="mx-4 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl">
      <header className="flex items-center justify-between border-b p-4"><h2 id="cargar-documento-titulo" className="text-sm font-semibold">Cargar detalle de un documento existente</h2><button type="button" onClick={onClose} aria-label="Cerrar">×</button></header>
      <div className="space-y-4 overflow-y-auto p-4">
        <p className="text-xs text-gray-600">Busque un documento de la compañía actual. Solo se copiarán sus partidas; se conservará el encabezado que está diligenciando. El documento original no se modifica.</p>
        <form onSubmit={buscar} className="grid grid-cols-2 gap-3 sm:grid-cols-3" onKeyDown={event => {
          if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) return;
          event.preventDefault();
          const fields = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input, select, button[type="submit"]'));
          fields[fields.indexOf(event.target) + 1]?.focus();
        }}>
          <label className="text-xs">Número de documento<input autoFocus required maxLength={12} className={INPUT} value={documento} onChange={e => { invalidar(); setDocumento(e.target.value); }} /></label>
          <label className="text-xs">Año del documento<input required type="number" min={1900} max={9999} className={INPUT} value={anio} onChange={e => { invalidar(); setAnio(Number(e.target.value)); }} /></label>
          <label className="text-xs">Mes<select className={INPUT} value={mes} onChange={e => { invalidar(); setMes(Number(e.target.value)); }}>{Array.from({ length: 18 }, (_, i) => <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>)}</select></label>
          <label className="text-xs">Comprobante (opcional)<input maxLength={6} className={INPUT} value={comprobante} onChange={e => { invalidar(); setComprobante(e.target.value); }} /></label>
          <label className="text-xs">Tipo de documento (opcional)<input maxLength={2} className={INPUT} value={tipo} onChange={e => { invalidar(); setTipo(e.target.value.toUpperCase()); }} /></label>
          <button type="submit" disabled={cargando} className="self-end rounded bg-petroleum-500 px-4 py-2 text-sm text-white disabled:opacity-50">{cargando ? 'Buscando…' : 'Consultar'}</button>
        </form>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {consultado && !items.length && <p role="status" className="text-sm text-gray-500">No se encontraron documentos con estos filtros.</p>}
        {items.map((item, index) => <div key={index} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-xs">
          <span>{item.comprobante} · {item.tipoDocumento} · {item.documento} · {item.fecha}<br />{item.partidas.length} partidas · Débito {item.partidas.reduce((sum, p) => sum + p.debito, 0).toLocaleString('es-CO')} · Crédito {item.partidas.reduce((sum, p) => sum + p.credito, 0).toLocaleString('es-CO')}</span>
          <button type="button" className="rounded border border-petroleum-300 px-3 py-2 text-petroleum-700" onClick={() => tienePartidas ? setSeleccionado(item) : onLoad(item.partidas, item.documento)}>Cargar detalle</button>
        </div>)}
        {seleccionado && <div role="alert" className="space-y-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
          <p>Se reemplazarán las partidas actuales por las del documento {seleccionado.documento}. El encabezado no cambiará. ¿Desea continuar?</p>
          <div className="flex gap-3"><button type="button" onClick={() => setSeleccionado(null)} className="rounded border px-3 py-2">Cancelar</button><button type="button" onClick={() => onLoad(seleccionado.partidas, seleccionado.documento)} className="rounded bg-petroleum-500 px-3 py-2 text-white">Reemplazar partidas</button></div>
        </div>}
      </div>
    </section>
  </div>;
}
