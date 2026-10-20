import { useEffect, useState, type FormEvent } from 'react';
import { eliminarDefinicionFlujo, guardarDefinicionFlujo, listarDefinicionesFlujo, type DefinicionFlujo } from '../api/informesAdicionales';

const EMPTY: DefinicionFlujo = { nivel: '', cuenta: '', nombre: '', tipo: '+', presupuesto: 0, valorBase: false };
const INPUT = 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-petroleum-500 focus:outline-none';

/** INFORM1: niveles de flujo definidos por compañía, sin exposición de tablas. */
export default function DefinicionesFlujo({ cia, onClose }: { cia: string; onClose: () => void }) {
  const [items, setItems] = useState<DefinicionFlujo[]>([]);
  const [edit, setEdit] = useState<DefinicionFlujo>({ ...EMPTY });
  const [original, setOriginal] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmNivel, setConfirmNivel] = useState('');

  async function refresh() {
    setItems(await listarDefinicionesFlujo(cia));
  }
  useEffect(() => { refresh().catch(err => setError(err instanceof Error ? err.message : 'No fue posible cargar las definiciones.')); }, [cia]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(''); setLoading(true);
    try {
      await guardarDefinicionFlujo(cia, edit, original || undefined);
      await refresh(); setEdit({ ...EMPTY }); setOriginal('');
    } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible guardar.'); }
    finally { setLoading(false); }
  }

  async function remove(item: DefinicionFlujo) {
    setError(''); setLoading(true);
    try { await eliminarDefinicionFlujo(cia, item.nivel); await refresh(); setConfirmNivel(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'No fue posible eliminar.'); }
    finally { setLoading(false); }
  }

  return <section className="rounded border border-gray-200 bg-white">
    <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
      <div><h2 className="text-base font-semibold text-petroleum-800">Definición de cuentas — flujo comparativo</h2>
        <p className="text-xs text-gray-500">Configure los niveles, la operación y el presupuesto de esta compañía.</p></div>
      <button type="button" onClick={onClose} className="rounded border border-gray-300 px-3 py-1.5 text-sm">Volver a informes</button>
    </div>
    <div className="grid gap-5 p-5 lg:grid-cols-[1fr_350px]">
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-petroleum-50 text-petroleum-900"><tr>
        <th className="p-2">Nivel</th><th className="p-2">Cuenta</th><th className="p-2">Nombre</th><th className="p-2">Operación</th><th className="p-2">Presupuesto</th><th className="p-2">Base</th><th className="p-2">Acciones</th>
      </tr></thead><tbody>{items.map(item => <tr key={item.nivel} className="border-b border-gray-100">
        <td className="p-2">{item.nivel}</td><td className="p-2">{item.cuenta}</td><td className="p-2">{item.nombre}</td>
        <td className="p-2">{item.tipo}</td><td className="p-2">{item.presupuesto.toLocaleString('es-CO')}</td><td className="p-2">{item.valorBase ? 'Sí' : 'No'}</td>
        <td className="whitespace-nowrap p-2"><button type="button" className="mr-2 text-petroleum-700 hover:underline" onClick={() => { setEdit({ ...item }); setOriginal(item.nivel); }}>Modificar</button>
          <button type="button" className="text-red-700 hover:underline" disabled={loading} onClick={() => setConfirmNivel(item.nivel)}>Eliminar</button></td>
      </tr>)}</tbody></table>{items.length === 0 && <p className="p-4 text-sm text-gray-500">Aún no hay definiciones para esta compañía.</p>}</div>
      <form onSubmit={save} className="space-y-3 rounded border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-petroleum-800">{original ? 'Modificar definición' : 'Nueva definición'}</h3>
        <label className="block text-xs font-medium text-gray-600">Nivel<input required maxLength={4} disabled={Boolean(original)} className={INPUT} value={edit.nivel} onChange={e => setEdit(p => ({ ...p, nivel: e.target.value }))} /></label>
        <label className="block text-xs font-medium text-gray-600">Cuenta<input required maxLength={12} className={INPUT} value={edit.cuenta} onChange={e => setEdit(p => ({ ...p, cuenta: e.target.value }))} /></label>
        <label className="block text-xs font-medium text-gray-600">Nombre<input required maxLength={30} className={INPUT} value={edit.nombre} onChange={e => setEdit(p => ({ ...p, nombre: e.target.value }))} /></label>
        <label className="block text-xs font-medium text-gray-600">Operación<select className={INPUT} value={edit.tipo} onChange={e => setEdit(p => ({ ...p, tipo: e.target.value as '+' | '-' }))}><option value="+">Sumar (+)</option><option value="-">Restar (−)</option></select></label>
        <label className="block text-xs font-medium text-gray-600">Presupuesto<input required type="number" min={0} step="0.01" className={INPUT} value={edit.presupuesto} onChange={e => setEdit(p => ({ ...p, presupuesto: Number(e.target.value) }))} /></label>
        <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={edit.valorBase} onChange={e => setEdit(p => ({ ...p, valorBase: e.target.checked }))} />Valor base para porcentajes</label>
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        <div className="flex gap-2"><button disabled={loading} type="submit" className="rounded bg-petroleum-500 px-4 py-2 text-xs font-medium text-white disabled:opacity-50">Guardar</button>
          {original && <button type="button" className="rounded border border-gray-300 px-4 py-2 text-xs" onClick={() => { setEdit({ ...EMPTY }); setOriginal(''); }}>Cancelar edición</button>}</div>
      </form>
    </div>
    {confirmNivel && <div className="border-t border-red-100 bg-red-50 px-5 py-4 text-sm text-red-900">
      <p>¿Eliminar la definición {confirmNivel}? Esta acción no modifica los movimientos contables.</p>
      <div className="mt-3 flex gap-2"><button type="button" disabled={loading} className="rounded bg-red-700 px-3 py-1.5 text-xs text-white" onClick={() => {
        const item = items.find(row => row.nivel === confirmNivel);
        if (item) remove(item);
      }}>Sí, eliminar</button>
        <button type="button" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs" onClick={() => setConfirmNivel('')}>Cancelar</button></div>
    </div>}
  </section>;
}
