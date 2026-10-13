import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { listarMedioFormatos, type MedioFormato } from '../api/mediosFormatos';
import { listarMedioConceptos, type MedioConcepto } from '../api/mediosConceptos';
import {
  copiarAsignacionesCuenta, eliminarAsignacionMedios, guardarAsignacionMedios,
  listarAsignacionesMedios, listarCuentasMedios,
  type AsignacionMedios, type CuentaMedios,
} from '../api/mediosCuentas';

const INPUT = 'mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-sky-500';
const NUEVA = (cuenta: string): AsignacionMedios => ({
  cuenta, formato: '', concepto: '', tipo: 'D', cuenta2: '', tipomed: 0,
  pmed1: 0, pmed2: 0, pmed3: 0, pmed4: 0, pmed5: 0, pmed6: 0,
  formato2: '', concepto2: '', modcxp: 0, colvalor: 0, colbase: 0,
  movtipo: 1, columna2: 0, docx: '', docx2: '', docx3: '', natural: false,
});

/** MEDMAG03: plan de cuentas, asignaciones CONMAG3 y copiar/pegar por cuenta. */
export default function MediosAsignacion({ cia }: { cia: string }) {
  const [cuentas, setCuentas] = useState<CuentaMedios[]>([]);
  const [formatos, setFormatos] = useState<MedioFormato[]>([]);
  const [cuenta, setCuenta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [asignaciones, setAsignaciones] = useState<AsignacionMedios[]>([]);
  const [conceptos, setConceptos] = useState<MedioConcepto[]>([]);
  const [conceptos2, setConceptos2] = useState<MedioConcepto[]>([]);
  const [modo, setModo] = useState<'crear' | 'editar' | null>(null);
  const [form, setForm] = useState<AsignacionMedios>(NUEVA(''));
  const [original, setOriginal] = useState<AsignacionMedios | undefined>();
  const [porEliminar, setPorEliminar] = useState<AsignacionMedios | null>(null);
  const [origenCopia, setOrigenCopia] = useState('');
  const [confirmarCopia, setConfirmarCopia] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let activo = true;
    Promise.all([listarCuentasMedios(cia), listarMedioFormatos(cia)])
      .then(([accounts, forms]) => { if (activo) { setCuentas(accounts); setFormatos(forms); } })
      .catch(cause => { if (activo) setError(cause instanceof Error ? cause.message : 'No fue posible consultar las cuentas.'); });
    return () => { activo = false; };
  }, [cia]);
  useEffect(() => {
    if (!cuenta) { setAsignaciones([]); return; }
    setCargando(true); setError('');
    void listarAsignacionesMedios(cia, cuenta).then(setAsignaciones)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'No fue posible consultar las asignaciones.'))
      .finally(() => setCargando(false));
  }, [cia, cuenta]);
  useEffect(() => {
    if (!modo || !form.formato) { setConceptos([]); return; }
    void listarMedioConceptos(cia, form.formato).then(setConceptos).catch(() => setConceptos([]));
  }, [cia, modo, form.formato]);
  useEffect(() => {
    if (!modo || !form.formato2) { setConceptos2([]); return; }
    void listarMedioConceptos(cia, form.formato2).then(setConceptos2).catch(() => setConceptos2([]));
  }, [cia, modo, form.formato2]);

  const resultados = useMemo(() => cuentas.filter(item => `${item.codigo} ${item.nombre}`.toLocaleLowerCase('es-CO').includes(busqueda.toLocaleLowerCase('es-CO'))).slice(0, 120), [cuentas, busqueda]);
  const cuentaActiva = cuentas.find(item => item.codigo === cuenta);
  async function recargar() { if (cuenta) setAsignaciones(await listarAsignacionesMedios(cia, cuenta)); }
  function abrirEditar(item: AsignacionMedios) { setForm({ ...item }); setOriginal(item); setModo('editar'); setError(''); }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setAviso('');
    if (!form.formato || !form.concepto) { setError('Seleccione formato y concepto.'); return; }
    if (form.formato2 && !form.concepto2) { setError('Seleccione el segundo concepto.'); return; }
    setGuardando(true);
    try {
      await guardarAsignacionMedios(cia, form, original);
      setModo(null); setOriginal(undefined); setAviso('Asignación guardada.'); await recargar();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible guardar.'); }
    finally { setGuardando(false); }
  }
  async function eliminar() {
    if (!porEliminar) return;
    setGuardando(true); setError('');
    try { await eliminarAsignacionMedios(cia, porEliminar); setPorEliminar(null); setAviso('Asignación eliminada.'); await recargar(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible eliminar.'); }
    finally { setGuardando(false); }
  }
  async function pegar() {
    setGuardando(true); setError('');
    try {
      const result = await copiarAsignacionesCuenta(cia, origenCopia, cuenta);
      setConfirmarCopia(false); setAviso(`${result.copiadas} asignaciones copiadas; ${result.omitidas} ya existían.`); await recargar();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible copiar.'); }
    finally { setGuardando(false); }
  }

  const campo = (label: string, key: keyof AsignacionMedios, maxLength?: number) => <label className="text-xs text-gray-600">{label}<input className={INPUT} value={String(form[key])} maxLength={maxLength} onChange={event => setForm({ ...form, [key]: event.target.value })} /></label>;
  const numero = (label: string, key: keyof AsignacionMedios, step = '1') => <label className="text-xs text-gray-600">{label}<input className={INPUT} type="number" min="0" max="99" step={step} value={Number(form[key])} onChange={event => setForm({ ...form, [key]: Number(event.target.value) })} /></label>;

  return <div className="max-w-screen-2xl space-y-4 p-4">
    <div><p className="text-xs text-gray-500">Medios magnéticos / Asignación de cuentas</p><h1 className="text-lg font-semibold text-gray-800">Manual por plan de cuentas</h1></div>
    {aviso && <div role="status" className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{aviso}</div>}
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    <div className="grid gap-4 lg:grid-cols-[minmax(260px,35%)_1fr]">
      <section className="rounded border border-gray-200 bg-white p-3"><label className="text-xs font-medium text-gray-700">Plan de cuentas<input className={INPUT} type="search" value={busqueda} onChange={event => setBusqueda(event.target.value)} placeholder="Buscar código o nombre…" /></label><p className="my-2 text-xs text-gray-500">{cuentas.length} cuentas de esta compañía</p><div className="max-h-[68vh] overflow-y-auto border-t border-gray-100">{resultados.map(item => <button key={item.codigo} type="button" onClick={() => setCuenta(item.codigo)} className={`block w-full border-b border-gray-50 px-2 py-2 text-left text-xs hover:bg-gray-50 ${cuenta === item.codigo ? 'bg-sky-50 text-sky-900' : 'text-gray-700'}`}><span className="mr-2 font-mono font-semibold">{item.codigo}</span>{item.nombre}</button>)}</div></section>
      <section className="space-y-3"><div className="rounded border border-gray-200 bg-white p-3"><h2 className="text-sm font-semibold text-gray-800">{cuentaActiva ? `${cuentaActiva.codigo} · ${cuentaActiva.nombre}` : 'Seleccione una cuenta'}</h2>{cuenta && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { setForm(NUEVA(cuenta)); setOriginal(undefined); setModo('crear'); setError(''); }} className="rounded bg-petroleum-500 px-3 py-2 text-xs text-white">+ Asignar formato</button><button type="button" onClick={() => { setOrigenCopia(cuenta); setAviso(`Cuenta ${cuenta} seleccionada como origen.`); }} className="rounded border px-3 py-2 text-xs">Copiar parametrización</button><button type="button" disabled={!origenCopia || origenCopia === cuenta} onClick={() => setConfirmarCopia(true)} className="rounded border px-3 py-2 text-xs disabled:opacity-50">Pegar en esta cuenta</button></div>}</div><div className="overflow-x-auto rounded border border-gray-200 bg-white"><table className="w-full text-xs"><thead className="border-b bg-gray-50"><tr>{['Formato', 'Concepto', 'D/C', 'Cuenta 2', 'Tipo', 'CxP/Ot.', 'Col. V.', 'Col. B.', 'Acciones'].map(label => <th key={label} className="px-3 py-2 text-left font-semibold text-gray-600">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{cargando && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Consultando…</td></tr>}{!cargando && !asignaciones.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">{cuenta ? 'Esta cuenta no tiene asignaciones.' : 'Seleccione una cuenta.'}</td></tr>}{!cargando && asignaciones.map(item => <tr key={`${item.formato}-${item.concepto}-${item.cuenta2}`}><td className="px-3 py-2">{item.formato}</td><td className="px-3 py-2">{item.concepto}</td><td className="px-3 py-2">{item.tipo}</td><td className="px-3 py-2">{item.cuenta2}</td><td className="px-3 py-2">{item.tipomed}</td><td className="px-3 py-2">{item.modcxp}</td><td className="px-3 py-2">{item.colvalor}</td><td className="px-3 py-2">{item.colbase}</td><td className="whitespace-nowrap px-3 py-2"><button type="button" onClick={() => abrirEditar(item)} className="mr-2 text-blue-700">Modificar</button><button type="button" onClick={() => setPorEliminar(item)} className="text-red-600">Eliminar</button></td></tr>)}</tbody></table></div></section>
    </div>
    {modo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Asignación de medios"><form onSubmit={guardar} className="max-h-[92vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-lg bg-white p-5 shadow-xl"><h2 className="text-base font-semibold">{modo === 'crear' ? 'Nueva asignación' : 'Modificar asignación'} · Cuenta {cuenta}</h2>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-gray-600">Formato<select className={INPUT} value={form.formato} onChange={event => setForm({ ...form, formato: event.target.value, concepto: '' })}><option value="">Seleccione</option>{formatos.map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} · {item.nombre}</option>)}</select></label><label className="text-xs text-gray-600">Concepto<select className={INPUT} value={form.concepto} onChange={event => setForm({ ...form, concepto: event.target.value })}><option value="">Seleccione</option>{conceptos.map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} · {item.nombre}</option>)}</select></label><label className="text-xs text-gray-600">D/C<select className={INPUT} value={form.tipo} onChange={event => setForm({ ...form, tipo: event.target.value })}><option value="D">Débito</option><option value="C">Crédito</option></select></label><label className="text-xs text-gray-600">Cuenta 2<input className={INPUT} list="cuentas-medios" value={form.cuenta2} onChange={event => setForm({ ...form, cuenta2: event.target.value })} maxLength={12} placeholder="Opcional" /><datalist id="cuentas-medios">{cuentas.map(item => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}</datalist></label>{numero('Tipo de medio', 'tipomed')}{numero('CxP / Otros', 'modcxp')}{numero('Columna valor', 'colvalor')}{numero('Columna base', 'colbase')}{numero('Movimiento tipo', 'movtipo')}{numero('Columna 2', 'columna2')}</div><div><h3 className="mb-2 text-xs font-semibold">Parámetros medios</h3><div className="grid gap-3 sm:grid-cols-3">{([1, 2, 3, 4, 5, 6] as const).map(n => numero(`Parámetro ${n}`, `pmed${n}` as keyof AsignacionMedios, '0.00000001'))}</div></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-gray-600">Formato 2<select className={INPUT} value={form.formato2} onChange={event => setForm({ ...form, formato2: event.target.value, concepto2: '' })}><option value="">Ninguno</option>{formatos.map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} · {item.nombre}</option>)}</select></label><label className="text-xs text-gray-600">Concepto 2<select className={INPUT} value={form.concepto2} onChange={event => setForm({ ...form, concepto2: event.target.value })}><option value="">Ninguno</option>{conceptos2.map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} · {item.nombre}</option>)}</select></label>{campo('Documento 1', 'docx', 2)}{campo('Documento 2', 'docx2', 2)}{campo('Documento 3', 'docx3', 2)}<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.natural} onChange={event => setForm({ ...form, natural: event.target.checked })} />Naturaleza</label></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setModo(null)} className="rounded border px-4 py-2 text-sm">Cancelar</button><button type="submit" disabled={guardando} className="rounded bg-petroleum-500 px-4 py-2 text-sm text-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar'}</button></div></form></div>}
    {porEliminar && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Eliminar asignación"><div className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-xl"><h2 className="text-base font-semibold">Eliminar asignación</h2><p className="text-sm">¿Eliminar {porEliminar.formato}/{porEliminar.concepto} de la cuenta {cuenta}?</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setPorEliminar(null)} className="rounded border px-4 py-2 text-sm">Cancelar</button><button type="button" onClick={() => void eliminar()} disabled={guardando} className="rounded bg-red-600 px-4 py-2 text-sm text-white">Eliminar</button></div></div></div>}
    {confirmarCopia && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Copiar parametrización"><div className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-xl"><h2 className="text-base font-semibold">Copiar parametrización</h2><p className="text-sm">¿Copiar las asignaciones de {origenCopia} a {cuenta}? Las ya existentes se conservarán.</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setConfirmarCopia(false)} className="rounded border px-4 py-2 text-sm">Cancelar</button><button type="button" onClick={() => void pegar()} disabled={guardando} className="rounded bg-petroleum-500 px-4 py-2 text-sm text-white">Copiar</button></div></div></div>}
  </div>;
}
