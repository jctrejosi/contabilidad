import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';

const INPUT = 'mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-petroleum-500';
const PRIMARY = 'rounded bg-petroleum-500 px-4 py-2 text-sm font-medium text-white hover:bg-petroleum-600 disabled:opacity-50';
type Compania = { codigo: string; nombre: string; nit: string; habilitada: boolean };
type Formulario = { codigo: string; nombre: string; nit: string; clave: string; habilitada: boolean };
const VACIO: Formulario = { codigo: '', nombre: '', nit: '', clave: '', habilitada: false };

async function leer<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as (T & { detail?: unknown }) | null;
  if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'No fue posible completar la operación.');
  return body as T;
}

/** Alta adaptada de CIAS1/DSIGRABA7: una fila CONEMP, sin carpetas de datos. */
export default function Companias({ cia }: { cia: string }) {
  const [items, setItems] = useState<Compania[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [anio, setAnio] = useState<number | null>(null);
  const [form, setForm] = useState<Formulario>(VACIO);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  async function recargar() {
    setCargando(true); setError('');
    try {
      const [companias, parametros] = await Promise.all([
        fetch('/api/companias').then(response => leer<{ items: Compania[]; source: string }>(response)),
        fetch(`/api/parametros-operacion?${new URLSearchParams({ cia })}`).then(response => leer<{ item: { anioOperacion: string } }>(response)),
      ]);
      if (companias.source === 'DEMO') throw new Error('No hay conexión con el catálogo de compañías.');
      setItems(companias.items);
      setAnio(Number(parametros.item.anioOperacion));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible cargar las compañías.'); }
    finally { setCargando(false); }
  }
  useEffect(() => { void recargar(); }, [cia]);

  function avanzar(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    const campos = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input:not([type=checkbox])'));
    const index = campos.indexOf(event.target as HTMLInputElement);
    if (index >= 0 && index < campos.length - 1) { event.preventDefault(); campos[index + 1].focus(); }
  }
  async function crear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const codigo = form.codigo.padStart(3, '0');
    if (!/^\d{3}$/.test(codigo) || codigo === '000') { setError('Ingrese un código entre 001 y 999.'); return; }
    if (!form.nombre.trim() || form.nombre.trim().length > 40) { setError('El nombre debe contener de 1 a 40 caracteres.'); return; }
    if (!form.nit.trim() || form.nit.trim().length > 12) { setError('El NIT debe contener de 1 a 12 caracteres.'); return; }
    if (!form.clave.trim() || form.clave.trim().length > 5) { setError('La clave debe contener de 1 a 5 caracteres.'); return; }
    if (items.some(item => item.codigo === codigo)) { setError(`Ya existe la compañía ${codigo}.`); return; }
    if (anio === null) { setError('No se pudo conocer el año operativo.'); return; }
    setGuardando(true); setError(''); setAviso('');
    try {
      await leer(await fetch('/api/companias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, nombre: form.nombre.trim(), nit: form.nit.trim(), clave: form.clave.trim(), habilitada: form.habilitada, anio, usuario: 'WEB' }),
      }));
      setAbierto(false); setForm(VACIO); setAviso(`Compañía ${codigo} creada correctamente.`);
      await recargar();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible crear la compañía.'); }
    finally { setGuardando(false); }
  }
  const filtrados = items.filter(item => `${item.codigo} ${item.nombre} ${item.nit}`.toLocaleLowerCase('es-CO').includes(busqueda.toLocaleLowerCase('es-CO')));

  return <div className="max-w-screen-2xl space-y-4 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="mb-1 text-xs text-gray-400">Configuración / Compañías</div><h1 className="text-lg font-semibold text-gray-800">Compañías</h1><p className="mt-1 text-xs text-gray-500">Catálogo de contabilidades de esta instalación.</p></div><span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">{cargando ? 'Consultando…' : `${items.length} compañías`}</span></div>
    {aviso && <div role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{aviso}</div>}
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white p-3"><input type="search" aria-label="Buscar compañía" placeholder="Buscar por código, nombre o NIT..." value={busqueda} onChange={event => setBusqueda(event.target.value)} className="w-72 rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1" /><span className="text-xs text-gray-500">Año operativo: {anio ?? '—'}</span><button type="button" disabled={cargando || !!error || anio === null} onClick={() => { setForm(VACIO); setError(''); setAbierto(true); }} className={`${PRIMARY} ml-auto`}>+ Crear compañía</button></div>
    <div className="overflow-hidden rounded border border-gray-200 bg-white"><div className="table-fixed-header overflow-x-auto"><table className="w-full text-xs"><thead className="border-b border-gray-200 bg-gray-50"><tr><th className="w-28 px-3 py-2.5 text-left font-semibold text-gray-600">Código</th><th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th><th className="w-52 px-3 py-2.5 text-left font-semibold text-gray-600">NIT</th><th className="w-36 px-3 py-2.5 text-center font-semibold text-gray-600">Habilitada</th></tr></thead><tbody className="divide-y divide-gray-50">{cargando && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Consultando compañías…</td></tr>}{!cargando && filtrados.map(item => <tr key={item.codigo} className="hoverable"><td className="px-3 py-2.5 font-mono font-semibold text-gray-800">{item.codigo}{item.codigo === cia && <span className="ml-2 rounded bg-petroleum-50 px-1.5 py-0.5 text-petroleum-700">Actual</span>}</td><td className="px-3 py-2.5 text-gray-700">{item.nombre}</td><td className="px-3 py-2.5 font-mono text-gray-600">{item.nit}</td><td className="px-3 py-2.5 text-center text-gray-600">{item.habilitada ? 'Sí' : 'No'}</td></tr>)}</tbody></table></div><div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">{filtrados.length} compañía{filtrados.length !== 1 ? 's' : ''}</div></div>
    {abierto && <div role="dialog" aria-modal="true" aria-label="Crear compañía" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><form onSubmit={crear} onKeyDown={avanzar} className="w-full max-w-lg space-y-4 rounded-lg bg-white p-5 shadow-xl"><h2 className="text-base font-semibold text-gray-800">Crear compañía</h2><p className="text-xs text-gray-500">La nueva contabilidad utilizará las tablas compartidas y el año operativo {anio}.</p>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}<div className="grid grid-cols-2 gap-3"><label className="block text-xs text-gray-600">Código<input autoFocus className={`${INPUT} font-mono`} maxLength={3} inputMode="numeric" value={form.codigo} onChange={event => setForm({ ...form, codigo: event.target.value.replace(/\D/g, '') })} /></label><label className="block text-xs text-gray-600">NIT<input className={`${INPUT} font-mono`} maxLength={12} value={form.nit} onChange={event => setForm({ ...form, nit: event.target.value })} /></label><label className="col-span-2 block text-xs text-gray-600">Nombre<input className={INPUT} maxLength={40} value={form.nombre} onChange={event => setForm({ ...form, nombre: event.target.value })} /></label><label className="block text-xs text-gray-600">Clave<input type="password" autoComplete="new-password" className={INPUT} maxLength={5} value={form.clave} onChange={event => setForm({ ...form, clave: event.target.value })} /></label><label className="flex items-center gap-2 pt-5 text-xs text-gray-600"><input type="checkbox" checked={form.habilitada} onChange={event => setForm({ ...form, habilitada: event.target.checked })} />Habilitar para ingresar</label></div><div className="flex justify-end gap-2 border-t border-gray-100 pt-4"><button type="button" onClick={() => { setAbierto(false); setError(''); }} className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700">Cancelar</button><button type="submit" disabled={guardando} className={PRIMARY}>{guardando ? 'Guardando…' : 'Crear compañía'}</button></div></form></div>}
  </div>;
}
