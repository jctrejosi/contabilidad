import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { guardarDocumentoPlantilla, listarDocumentosPlantilla, type DocumentoPlantilla, type PosicionPlantilla } from '../api/plantillasOriginal';

const INPUT = 'w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-petroleum-500';
const PRIMARY = 'rounded bg-petroleum-500 px-4 py-2 text-sm font-medium text-white hover:bg-petroleum-600 disabled:opacity-50';

/** Reproduce PLANTICO: elegir documento existente y modificar sus ocho renglones. */
export default function Plantillas({ cia }: { cia: string }) {
  const [documentos, setDocumentos] = useState<DocumentoPlantilla[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [codigo, setCodigo] = useState('');
  const [posiciones, setPosiciones] = useState<PosicionPlantilla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  async function recargar() {
    setCargando(true); setError('');
    try {
      const items = await listarDocumentosPlantilla(cia);
      setDocumentos(items);
      setCodigo(actual => items.some(item => item.codigo === actual) ? actual : '');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible consultar los documentos.'); }
    finally { setCargando(false); }
  }
  useEffect(() => { void recargar(); }, [cia]);
  useEffect(() => {
    const item = documentos.find(documento => documento.codigo === codigo);
    setPosiciones(item ? item.posiciones.map(posicion => ({ ...posicion })) : []);
  }, [codigo, documentos]);

  function cambiar(orden: number, campo: 'concepto' | 'cuentaDebito' | 'cuentaCredito', valor: string) {
    setPosiciones(prev => prev.map(posicion => posicion.orden === orden ? { ...posicion, [campo]: campo === 'concepto' ? valor : valor.replace(/\D/g, '') } : posicion));
    setError(''); setAviso('');
  }
  function avanzarConEnter(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    const campos = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input'));
    const index = campos.indexOf(event.target as HTMLInputElement);
    if (index >= 0 && index < campos.length - 1) { event.preventDefault(); campos[index + 1].focus(); }
  }
  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const original = documentos.find(item => item.codigo === codigo);
    if (!original) { setError('Seleccione un tipo de documento.'); return; }
    if (posiciones.length !== 8) { setError('El documento no tiene las ocho posiciones requeridas.'); return; }
    setGuardando(true); setError(''); setAviso('');
    try {
      const guardado = await guardarDocumentoPlantilla(cia, { ...original, posiciones });
      setDocumentos(prev => prev.map(item => item.codigo === codigo ? guardado : item));
      setAviso('Plantilla guardada correctamente.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible guardar la plantilla.'); }
    finally { setGuardando(false); }
  }

  const seleccion = documentos.find(item => item.codigo === codigo);
  const filtrados = documentos.filter(item => `${item.codigo} ${item.nombre}`.toLocaleLowerCase('es-CO').includes(busqueda.toLocaleLowerCase('es-CO')));
  const configurados = (item: DocumentoPlantilla) => item.posiciones.filter(posicion => posicion.concepto || posicion.cuentaDebito || posicion.cuentaCredito).length;

  return <div className="max-w-screen-2xl space-y-4 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="mb-1 text-xs text-gray-400">Configuración / Plantillas contables</div><h1 className="text-lg font-semibold text-gray-800">Plantillas contables</h1><p className="mt-1 text-xs text-gray-500">Seleccione un tipo de documento y defina hasta ocho posiciones de concepto y cuentas.</p></div><span className={`rounded-full border px-3 py-1 text-xs font-medium ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-petroleum-100 bg-petroleum-50 text-petroleum-700'}`}>{cargando ? 'Consultando…' : `${documentos.length} documentos`}</span></div>
    {aviso && <div role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{aviso}</div>}
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="rounded border border-gray-200 bg-white p-3"><input type="search" aria-label="Buscar tipo de documento" placeholder="Buscar documento por código o nombre..." value={busqueda} onChange={event => setBusqueda(event.target.value)} className="w-72 rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1" /><span className="ml-3 text-xs text-gray-500">{filtrados.length} de {documentos.length}</span></div>
    <div className="overflow-hidden rounded border border-gray-200 bg-white"><div className="table-fixed-header max-h-64 overflow-auto"><table className="w-full text-xs"><thead className="border-b border-gray-200 bg-gray-50"><tr><th className="w-28 px-3 py-2.5 text-left font-semibold text-gray-600">Código</th><th className="px-3 py-2.5 text-left font-semibold text-gray-600">Tipo de documento</th><th className="w-32 px-3 py-2.5 text-right font-semibold text-gray-600">Posiciones</th><th className="w-28 px-3 py-2.5 text-left font-semibold text-gray-600">Acción</th></tr></thead><tbody className="divide-y divide-gray-50">{cargando && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Consultando documentos…</td></tr>}{!cargando && !filtrados.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">No hay documentos coincidentes.</td></tr>}{filtrados.map(item => <tr key={item.codigo} onClick={() => setCodigo(item.codigo)} className={`hoverable cursor-pointer ${codigo === item.codigo ? 'bg-blue-50' : ''}`}><td className="px-3 py-2.5 font-mono font-semibold text-gray-800">{item.codigo}</td><td className="px-3 py-2.5 text-gray-700">{item.nombre}</td><td className="px-3 py-2.5 text-right text-gray-600">{configurados(item)} / 8</td><td className="px-3 py-2.5"><button type="button" onClick={() => setCodigo(item.codigo)} className="text-blue-600 hover:underline">{codigo === item.codigo ? 'Seleccionado' : 'Configurar'}</button></td></tr>)}</tbody></table></div></div>
    {seleccion && <form onSubmit={guardar} onKeyDown={avanzarConEnter} className="overflow-hidden rounded border border-gray-200 bg-white"><div className="border-b border-gray-200 px-4 py-3"><h2 className="text-sm font-semibold text-gray-800">{seleccion.codigo} — {seleccion.nombre}</h2><p className="mt-1 text-xs text-gray-500">Puede dejar cuentas o conceptos vacíos. Las cuentas ingresadas se validan en la compañía actual.</p></div><div className="overflow-x-auto p-4"><table className="w-full min-w-[42rem] text-xs"><thead><tr className="border-b border-gray-200 text-left text-gray-600"><th className="w-12 px-2 py-2">#</th><th className="px-2 py-2">Concepto</th><th className="w-44 px-2 py-2">Cuenta débito</th><th className="w-44 px-2 py-2">Cuenta crédito</th></tr></thead><tbody className="divide-y divide-gray-50">{posiciones.map(posicion => <tr key={posicion.orden}><td className="px-2 py-2 font-mono text-gray-500">{String(posicion.orden).padStart(2, '0')}</td><td className="px-2 py-2"><input aria-label={`Concepto ${posicion.orden}`} className={INPUT} maxLength={20} value={posicion.concepto} onChange={event => cambiar(posicion.orden, 'concepto', event.target.value)} /></td><td className="px-2 py-2"><input aria-label={`Cuenta débito ${posicion.orden}`} className={`${INPUT} font-mono`} maxLength={12} inputMode="numeric" value={posicion.cuentaDebito} onChange={event => cambiar(posicion.orden, 'cuentaDebito', event.target.value)} /></td><td className="px-2 py-2"><input aria-label={`Cuenta crédito ${posicion.orden}`} className={`${INPUT} font-mono`} maxLength={12} inputMode="numeric" value={posicion.cuentaCredito} onChange={event => cambiar(posicion.orden, 'cuentaCredito', event.target.value)} /></td></tr>)}</tbody></table></div><div className="flex justify-end gap-2 border-t border-gray-200 p-4"><button type="button" onClick={() => setPosiciones(seleccion.posiciones.map(posicion => ({ ...posicion })))} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Restablecer</button><button type="submit" disabled={guardando} className={PRIMARY}>{guardando ? 'Guardando…' : 'Guardar plantilla'}</button></div></form>}
  </div>;
}
