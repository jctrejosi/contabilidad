import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { listarMedioFormatos, type MedioFormato } from '../api/mediosFormatos';
import {
  OPCIONES_COLUMNA, eliminarMedioConcepto, guardarMedioConcepto,
  listarMedioConceptos, type MedioConcepto,
} from '../api/mediosConceptos';

const INPUT = 'mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500';
const MONEDA = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const vacio = (formato: string): MedioConcepto => ({
  formato, codigo: '', nombre: '', monto: 0, valor1: true, valor2: true,
  combos: Array(7).fill('No Reporta') as string[],
});

/** MEDMAG02: elección de formato (AYUDAFOR), catálogo y formulario MEDMAG21. */
export default function MediosConceptos({ cia }: { cia: string }) {
  const [formatos, setFormatos] = useState<MedioFormato[]>([]);
  const [formato, setFormato] = useState('');
  const [items, setItems] = useState<MedioConcepto[]>([]);
  const [busquedaFormato, setBusquedaFormato] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [modo, setModo] = useState<'crear' | 'editar' | null>(null);
  const [form, setForm] = useState<MedioConcepto>(vacio(''));
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [porEliminar, setPorEliminar] = useState<MedioConcepto | null>(null);

  useEffect(() => {
    let activo = true;
    setError('');
    void listarMedioFormatos(cia).then(rows => { if (activo) setFormatos(rows); })
      .catch(cause => { if (activo) setError(cause instanceof Error ? cause.message : 'No fue posible consultar los formatos.'); });
    return () => { activo = false; };
  }, [cia]);

  async function cargarConceptos(codigo: string) {
    if (!codigo) { setItems([]); return; }
    setCargando(true); setError('');
    try { setItems(await listarMedioConceptos(cia, codigo)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible consultar los conceptos.'); }
    finally { setCargando(false); }
  }
  useEffect(() => { void cargarConceptos(formato); }, [cia, formato]);
  const filtrados = useMemo(() => items.filter(item => `${item.codigo} ${item.nombre}`.toLocaleLowerCase('es-CO').includes(busqueda.toLocaleLowerCase('es-CO'))), [items, busqueda]);
  const formatosFiltrados = useMemo(() => formatos.filter(item => `${item.codigo} ${item.nombre}`.toLocaleLowerCase('es-CO').includes(busquedaFormato.toLocaleLowerCase('es-CO'))), [formatos, busquedaFormato]);
  const formatoActual = formatos.find(item => item.codigo === formato);

  function teclas(event: KeyboardEvent<HTMLDivElement>) {
    if (!formato || modo || porEliminar || event.altKey || event.ctrlKey || event.metaKey) return;
    const elegido = items.find(item => item.codigo === seleccion);
    if (event.key === 'F2') { event.preventDefault(); setForm(vacio(formato)); setModo('crear'); setError(''); }
    if (event.key === 'F3' && elegido) { event.preventDefault(); setForm({ ...elegido, combos: [...elegido.combos] }); setModo('editar'); setError(''); }
    if (event.key === 'F4' && elegido) { event.preventDefault(); setPorEliminar(elegido); setError(''); }
  }
  function avanzarConEnter(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input:not([readonly]), select'));
    const index = controls.indexOf(event.target as HTMLInputElement);
    if (index >= 0 && index < controls.length - 1) { event.preventDefault(); controls[index + 1].focus(); }
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setAviso('');
    const item = { ...form, codigo: form.codigo.trim().toUpperCase(), nombre: form.nombre.trim(), formato };
    if (!/^[A-Z0-9]{1,4}$/.test(item.codigo)) { setError('El concepto debe tener de 1 a 4 letras o números.'); return; }
    if (!item.nombre || item.nombre.length > 40) { setError('Ingrese una descripción de máximo 40 caracteres.'); return; }
    if (!Number.isFinite(item.monto) || item.monto < 0 || item.monto > 99_999_999 || Math.round(item.monto * 100) !== item.monto * 100) { setError('El monto debe estar entre 0 y 99.999.999, con máximo dos decimales.'); return; }
    if (modo === 'crear' && items.some(row => row.codigo === item.codigo)) { setError('Este concepto ya existe en el formato seleccionado.'); return; }
    setGuardando(true);
    try {
      await guardarMedioConcepto(cia, item, modo === 'editar' ? item.codigo : undefined);
      setModo(null); setSeleccion(item.codigo); setAviso(modo === 'crear' ? 'Concepto creado.' : 'Concepto actualizado.');
      await cargarConceptos(formato);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible guardar el concepto.'); }
    finally { setGuardando(false); }
  }
  async function eliminar() {
    if (!porEliminar) return;
    setGuardando(true); setError(''); setAviso('');
    try {
      await eliminarMedioConcepto(cia, formato, porEliminar.codigo);
      setPorEliminar(null); setSeleccion(null); setAviso('Concepto eliminado.'); await cargarConceptos(formato);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible eliminar el concepto.'); }
    finally { setGuardando(false); }
  }

  return <div className="max-w-screen-2xl space-y-4 p-4" onKeyDown={teclas}>
    <div><p className="text-xs text-gray-500">Medios magnéticos</p><h1 className="text-lg font-semibold text-gray-800">Mantenimiento de conceptos</h1></div>
    {aviso && <div role="status" className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{aviso}</div>}
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    <div className="rounded border border-gray-200 bg-white p-4">
      <label className="block max-w-xl text-xs font-medium text-gray-700">Formato
        <input type="search" value={busquedaFormato} onChange={event => setBusquedaFormato(event.target.value)} placeholder="Buscar formato por código o nombre…" className={INPUT} />
      </label>
      <select aria-label="Seleccionar formato" value={formato} onChange={event => { setFormato(event.target.value); setSeleccion(null); setBusqueda(''); }} className="mt-2 w-full max-w-xl rounded border border-gray-300 bg-white px-3 py-2 text-sm">
        <option value="">Seleccione un formato</option>
        {formatosFiltrados.map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} — {item.nombre}</option>)}
        {formatoActual && !formatosFiltrados.some(item => item.codigo === formato) && <option value={formato}>{formatoActual.codigo} — {formatoActual.nombre}</option>}
      </select>
      {!formatos.length && !error && <p className="mt-2 text-xs text-gray-500">Primero debe crear un formato en Mantenimiento de formatos.</p>}
    </div>
    {formato && <>
      <div className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white p-3"><input type="search" aria-label="Buscar conceptos" placeholder="Buscar código o descripción…" value={busqueda} onChange={event => setBusqueda(event.target.value)} className="w-72 rounded border border-gray-300 px-3 py-2 text-xs" /><span className="text-xs text-gray-500">{filtrados.length} conceptos</span><button type="button" onClick={() => void cargarConceptos(formato)} disabled={cargando} className="ml-auto rounded border border-gray-300 px-3 py-2 text-xs">Actualizar</button><button type="button" onClick={() => { setForm(vacio(formato)); setModo('crear'); setError(''); }} className="rounded bg-petroleum-500 px-4 py-2 text-sm text-white">+ Crear concepto</button></div>
      <div className="overflow-x-auto rounded border border-gray-200 bg-white"><table className="w-full text-xs"><thead className="border-b bg-gray-50"><tr>{['Concepto', 'Descripción', 'Monto', 'Valor 1', 'Valor 2', 'Acciones'].map(label => <th key={label} className="px-3 py-2.5 text-left font-semibold text-gray-600">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{cargando && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Consultando conceptos…</td></tr>}{!cargando && !filtrados.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No hay conceptos para este formato.</td></tr>}{!cargando && filtrados.map(item => <tr key={item.codigo} onClick={() => setSeleccion(item.codigo)} className={`cursor-pointer hover:bg-gray-50 ${seleccion === item.codigo ? 'bg-sky-50' : ''}`}><td className="px-3 py-2 font-mono font-semibold">{item.codigo}</td><td className="px-3 py-2">{item.nombre}</td><td className="px-3 py-2 text-right font-mono">{MONEDA.format(item.monto)}</td><td className="px-3 py-2">{item.valor1 ? 'Sí' : 'No'}</td><td className="px-3 py-2">{item.valor2 ? 'Sí' : 'No'}</td><td className="whitespace-nowrap px-3 py-2"><button type="button" onClick={() => { setForm({ ...item, combos: [...item.combos] }); setModo('editar'); setError(''); }} className="mr-3 text-blue-700 hover:underline">Modificar</button><button type="button" onClick={() => { setPorEliminar(item); setError(''); }} className="text-red-600 hover:underline">Eliminar</button></td></tr>)}</tbody></table></div>
    </>}
    {modo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={modo === 'crear' ? 'Crear concepto' : 'Modificar concepto'}><form onSubmit={guardar} onKeyDown={avanzarConEnter} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-lg bg-white p-5 shadow-xl"><h2 className="text-base font-semibold">{modo === 'crear' ? 'Crear concepto' : `Modificar concepto ${form.codigo}`} · Formato {formato}</h2>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-gray-600">Código<input autoFocus className={INPUT} value={form.codigo} readOnly={modo === 'editar'} maxLength={4} onChange={event => setForm({ ...form, codigo: event.target.value.toUpperCase() })} /></label><label className="text-xs text-gray-600">Monto<input className={INPUT} type="number" min="0" max="99999999" step="0.01" value={form.monto} onChange={event => setForm({ ...form, monto: Number(event.target.value) })} /></label></div><label className="block text-xs text-gray-600">Descripción<input className={INPUT} value={form.nombre} maxLength={40} onChange={event => setForm({ ...form, nombre: event.target.value })} /></label><div className="flex flex-wrap gap-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.valor1} onChange={event => setForm({ ...form, valor1: event.target.checked })} />Valor 1</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.valor2} onChange={event => setForm({ ...form, valor2: event.target.checked })} />Valor 2</label></div><div><h3 className="mb-2 text-xs font-semibold text-gray-700">Reglas de las siete columnas</h3><div className="grid gap-3 sm:grid-cols-2">{form.combos.map((valor, index) => <label key={index} className="text-xs text-gray-600">Columna {index + 1}<select className={INPUT} value={valor} onChange={event => { const combos = [...form.combos]; combos[index] = event.target.value; setForm({ ...form, combos }); }}>{OPCIONES_COLUMNA.map(opcion => <option key={opcion} value={opcion}>{opcion}</option>)}</select></label>)}</div></div><div className="flex justify-end gap-2"><button type="button" onClick={() => { setModo(null); setError(''); }} className="rounded border border-gray-300 px-4 py-2 text-sm">Cancelar</button><button type="submit" disabled={guardando} className="rounded bg-petroleum-500 px-4 py-2 text-sm text-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar'}</button></div></form></div>}
    {porEliminar && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Eliminar concepto"><div className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-xl"><h2 className="text-base font-semibold">Eliminar concepto {porEliminar.codigo}</h2><p className="text-sm text-gray-700">Esta acción elimina el concepto del formato {formato} para todas las compañías. ¿Desea continuar?</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => { setPorEliminar(null); setError(''); }} className="rounded border px-4 py-2 text-sm">Cancelar</button><button type="button" onClick={() => void eliminar()} disabled={guardando} className="rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50">Eliminar</button></div></div></div>}
  </div>;
}
