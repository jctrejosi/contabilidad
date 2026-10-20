import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { eliminarTarifaIva, guardarTarifaIva, listarTarifasIva, type TarifaIva } from '../api/tarifasIva';

const INPUT = 'mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-petroleum-500';
const PRIMARY = 'rounded bg-petroleum-500 px-4 py-2 text-sm font-medium text-white hover:bg-petroleum-600 disabled:opacity-50';
const SECONDARY = 'rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50';
type Formulario = { codigo: string; nombre: string; porcentaje: string };
const VACIO: Formulario = { codigo: '', nombre: '', porcentaje: '0,00' };
const porcentajeDe = (fraccion: number) => (fraccion * 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Mantenimiento global de CONTIIVA; no contiene cuentas, estados ni tarifas fijas. */
export default function ConfigIVA({ cia }: { cia: string }) {
  const [items, setItems] = useState<TarifaIva[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [modo, setModo] = useState<'crear' | 'editar' | null>(null);
  const [form, setForm] = useState<Formulario>(VACIO);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [eliminar, setEliminar] = useState<TarifaIva | null>(null);
  const [motivo, setMotivo] = useState('');
  const primerCampo = useRef<HTMLInputElement>(null);

  async function recargar() {
    setCargando(true); setError('');
    try { setItems(await listarTarifasIva(cia)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible consultar las tarifas de IVA.'); }
    finally { setCargando(false); }
  }
  useEffect(() => { void recargar(); }, [cia]);
  useEffect(() => { if (modo) primerCampo.current?.focus(); }, [modo]);

  function abrirCrear() { setForm(VACIO); setError(''); setModo('crear'); }
  function abrirEditar(item: TarifaIva) {
    setSeleccion(item.codigo);
    setForm({ codigo: item.codigo, nombre: item.nombre, porcentaje: porcentajeDe(item.tarifa) });
    setError(''); setModo('editar');
  }
  function teclas(event: KeyboardEvent<HTMLDivElement>) {
    if (modo || eliminar || event.altKey || event.ctrlKey || event.metaKey) return;
    const item = items.find(x => x.codigo === seleccion);
    if (event.key === 'F2') { event.preventDefault(); abrirCrear(); }
    if (event.key === 'F3' && item) { event.preventDefault(); abrirEditar(item); }
    if (event.key === 'F4' && item) { event.preventDefault(); setMotivo(''); setEliminar(item); }
  }
  function avanzarConEnter(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    const campos = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input:not([readonly])'));
    const posicion = campos.indexOf(event.target as HTMLInputElement);
    if (posicion >= 0 && posicion < campos.length - 1) { event.preventDefault(); campos[posicion + 1].focus(); }
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const codigo = form.codigo.trim(), nombre = form.nombre.trim();
    const porcentaje = Number(form.porcentaje.trim().replace(',', '.'));
    if (!/^\d{2}$/.test(codigo)) { setError('El código debe tener dos dígitos.'); return; }
    if (!nombre || nombre.length > 30) { setError('El nombre debe contener de 1 a 30 caracteres.'); return; }
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 99.99 || !/^\d{1,2}(?:[.,]\d{1,2})?$/.test(form.porcentaje.trim())) {
      setError('Ingrese un porcentaje de 0 a 99,99 con máximo dos decimales.'); return;
    }
    if (modo === 'crear' && items.some(x => x.codigo === codigo)) { setError(`Ya existe la tarifa ${codigo}.`); return; }
    setGuardando(true); setError('');
    try {
      await guardarTarifaIva(cia, { codigo, nombre, tarifa: porcentaje / 100 }, modo === 'editar' ? codigo : undefined);
      setModo(null); setSeleccion(codigo);
      setAviso(modo === 'crear' ? 'Tarifa de IVA creada.' : 'Tarifa de IVA actualizada.');
      await recargar();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible guardar.'); }
    finally { setGuardando(false); }
  }
  async function confirmarEliminacion() {
    if (!eliminar || motivo.trim().length < 5) return;
    setGuardando(true); setError('');
    try {
      await eliminarTarifaIva(cia, eliminar.codigo, motivo.trim());
      setAviso('Tarifa de IVA eliminada.'); setSeleccion(null); setEliminar(null);
      await recargar();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible eliminar la tarifa.'); }
    finally { setGuardando(false); }
  }

  const filtrados = items.filter(item => `${item.codigo} ${item.nombre}`.toLocaleLowerCase('es-CO').includes(busqueda.toLocaleLowerCase('es-CO')));
  function exportarCSV() {
    const filas = [['Código', 'Nombre', 'Porcentaje'], ...filtrados.map(item => [item.codigo, item.nombre, porcentajeDe(item.tarifa)])];
    const contenido = filas.map(fila => fila.map(valor => `"${valor.replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${contenido}`], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a'); enlace.href = url; enlace.download = 'tarifas-iva.csv'; enlace.click(); URL.revokeObjectURL(url);
  }

  return <div className="max-w-screen-2xl space-y-4 p-4" onKeyDown={teclas}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="mb-1 text-xs text-gray-400">Configuración / Tarifas de IVA</div><h1 className="text-lg font-semibold text-gray-800">Tarifas de IVA</h1><p className="mt-1 text-xs text-gray-500">Catálogo de códigos y porcentajes de IVA.</p></div><span className={`rounded-full border px-3 py-1 text-xs font-medium ${error ? 'border-red-200 bg-red-50 text-red-700' : cargando ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-petroleum-100 bg-petroleum-50 text-petroleum-700'}`}>{error ? 'Sin conexión' : cargando ? 'Consultando tarifas…' : `${items.length} tarifas · Catálogo compartido`}</span></div>
    <div className="rounded border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">Las tarifas de IVA se comparten entre todas las compañías.</div>
    {aviso && <div role="status" className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{aviso}</div>}
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white p-3"><input type="search" aria-label="Buscar tarifas de IVA" placeholder="Buscar por código o nombre..." value={busqueda} onChange={event => setBusqueda(event.target.value)} className="w-72 rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1" /><span className="text-xs text-gray-500">{filtrados.length} de {items.length}</span><button type="button" disabled={!filtrados.length} onClick={exportarCSV} className="ml-auto rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">↓ Exportar CSV</button><button type="button" onClick={abrirCrear} disabled={cargando || !!error} className={`${PRIMARY} disabled:cursor-not-allowed`}>+ Crear tarifa</button></div>
    <div className="overflow-hidden rounded border border-gray-200 bg-white"><div className="table-fixed-header overflow-x-auto"><table className="w-full text-xs"><thead className="border-b border-gray-200 bg-gray-50"><tr><th className="w-28 px-3 py-2.5 text-left font-semibold text-gray-600">Código</th><th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th><th className="w-36 px-3 py-2.5 text-right font-semibold text-gray-600">Porcentaje</th><th className="w-36 px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th></tr></thead><tbody className="divide-y divide-gray-50">{cargando && <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-500">Consultando tarifas de IVA…</td></tr>}{!cargando && !error && !filtrados.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-500">No hay tarifas que coincidan con la búsqueda.</td></tr>}{!cargando && filtrados.map(item => <tr key={item.codigo} onClick={() => setSeleccion(item.codigo)} className={`hoverable cursor-pointer ${seleccion === item.codigo ? 'bg-blue-50' : ''}`}><td className="px-3 py-2.5 font-mono font-semibold text-gray-800">{item.codigo}</td><td className="px-3 py-2.5 text-gray-700">{item.nombre}</td><td className="px-3 py-2.5 text-right font-mono text-gray-700">{porcentajeDe(item.tarifa)} %</td><td className="space-x-3 px-3 py-2.5 text-left"><button type="button" onClick={() => abrirEditar(item)} className="text-xs text-blue-600 hover:underline">Editar</button><button type="button" onClick={() => { setSeleccion(item.codigo); setMotivo(''); setEliminar(item); }} className="text-xs text-red-500 hover:underline">Eliminar</button></td></tr>)}</tbody></table></div><div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">{filtrados.length} tarifa{filtrados.length !== 1 ? 's' : ''} de IVA · catálogo compartido</div></div>
    {modo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={modo === 'crear' ? 'Crear tarifa de IVA' : 'Modificar tarifa de IVA'}><form onSubmit={guardar} onKeyDown={avanzarConEnter} className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-xl"><h2 className="text-base font-semibold">{modo === 'crear' ? 'Crear tarifa de IVA' : `Modificar tarifa ${form.codigo}`}</h2>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}<label className="block text-xs text-gray-600">Código de dos dígitos<input ref={primerCampo} value={form.codigo} onChange={event => setForm({ ...form, codigo: event.target.value.replace(/\D/g, '').slice(0, 2) })} readOnly={modo === 'editar'} maxLength={2} inputMode="numeric" className={`${INPUT} font-mono`} /></label><label className="block text-xs text-gray-600">Nombre<input value={form.nombre} onChange={event => setForm({ ...form, nombre: event.target.value })} maxLength={30} className={INPUT} /></label><label className="block text-xs text-gray-600">Porcentaje<input value={form.porcentaje} onChange={event => setForm({ ...form, porcentaje: event.target.value })} inputMode="decimal" className={`${INPUT} font-mono`} /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => { setModo(null); setError(''); }} className={SECONDARY}>Cancelar</button><button type="submit" disabled={guardando} className={PRIMARY}>{guardando ? 'Guardando…' : 'Guardar'}</button></div></form></div>}
    {eliminar && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Eliminar tarifa de IVA"><div className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-xl"><h2 className="text-base font-semibold">Eliminar tarifa {eliminar.codigo}</h2>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}<p className="text-sm text-gray-700">Esta acción elimina la tarifa para todas las compañías. Confirme el motivo antes de continuar.</p><label className="block text-xs text-gray-600">Motivo<input autoFocus value={motivo} onChange={event => setMotivo(event.target.value)} maxLength={180} className={INPUT} /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => { setEliminar(null); setError(''); }} className={SECONDARY}>Cancelar</button><button type="button" onClick={() => void confirmarEliminacion()} disabled={guardando || motivo.trim().length < 5} className="rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50">Eliminar</button></div></div></div>}
  </div>;
}
