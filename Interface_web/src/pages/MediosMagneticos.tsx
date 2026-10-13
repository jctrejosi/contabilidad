import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { NavPage } from '../components/Shell';
import { eliminarMedioFormato, guardarMedioFormato, listarMedioFormatos, type MedioFormato } from '../api/mediosFormatos';

/** Cada opción original tiene su propia entrada de menú; aún no ejecuta procesos sin migrar. */
const TITULOS: Partial<Record<NavPage, string>> = {
  'medios/formatos': 'Mantenimiento de formatos',
  'medios/conceptos': 'Mantenimiento de conceptos',
  'medios/cuentas-manual': 'Asignación manual de cuentas',
  'medios/cuentas-copiar': 'Traer definiciones de otra compañía',
  'medios/generar': 'Generar medios',
  'medios/revision': 'Revisión de medios',
  'medios/detalle-tercero': 'Detalle de medios por tercero',
  'medios/totales-tercero': 'Medios totales por tercero',
  'medios/formato-tercero': 'Revisión por formato y tercero',
  'medios/documento': 'Medios por documento',
  'medios/depurar-topes': 'Depuración de formatos por topes',
  'medios/depurar-cruce': 'Cruce de terceros entre formatos',
};

const VACIO: MedioFormato = {
  codigo: '', nombre: '', elemento: '', concepto: true, tipodoc: true, nit: true,
  digito: true, nombreCampo: true, direccion: true, municipio: true, pais: true,
  valor1: true, valor2: true,
};
const CAMPOS: { key: keyof MedioFormato; label: string }[] = [
  { key: 'concepto', label: 'Concepto' }, { key: 'tipodoc', label: 'Tipo de documento' },
  { key: 'nit', label: 'NIT' }, { key: 'digito', label: 'Dígito de verificación' },
  { key: 'nombreCampo', label: 'Nombre' }, { key: 'direccion', label: 'Dirección' },
  { key: 'municipio', label: 'Municipio' }, { key: 'pais', label: 'País' },
];
const INPUT = 'mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500';

export default function MediosMagneticos({ opcion, cia }: { opcion: NavPage; cia: string }) {
  const [items, setItems] = useState<MedioFormato[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [modo, setModo] = useState<'crear' | 'editar' | null>(null);
  const [form, setForm] = useState<MedioFormato>(VACIO);
  const [porEliminar, setPorEliminar] = useState<MedioFormato | null>(null);
  const [seleccion, setSeleccion] = useState<string | null>(null);

  async function cargar() {
    setCargando(true); setError('');
    try { setItems(await listarMedioFormatos(cia)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible consultar los formatos.'); }
    finally { setCargando(false); }
  }
  useEffect(() => { if (opcion === 'medios/formatos') void cargar(); }, [opcion, cia]);
  const filtrados = useMemo(() => items.filter(item => `${item.codigo} ${item.nombre} ${item.elemento}`.toLocaleLowerCase('es-CO').includes(busqueda.toLocaleLowerCase('es-CO'))), [items, busqueda]);

  function teclas(event: KeyboardEvent<HTMLDivElement>) {
    if (modo || porEliminar || event.altKey || event.ctrlKey || event.metaKey) return;
    const elegido = items.find(item => item.codigo === seleccion);
    if (event.key === 'F2') { event.preventDefault(); setForm({ ...VACIO }); setModo('crear'); setError(''); }
    if (event.key === 'F3' && elegido) { event.preventDefault(); setForm({ ...elegido }); setModo('editar'); setError(''); }
    if (event.key === 'F4' && elegido) { event.preventDefault(); setPorEliminar(elegido); setError(''); }
  }

  function avanzarConEnter(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    const fields = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input:not([readonly])'));
    const index = fields.indexOf(event.target as HTMLInputElement);
    if (index >= 0 && index < fields.length - 1) {
      event.preventDefault();
      fields[index + 1].focus();
    }
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setAviso('');
    const formato = { ...form, codigo: form.codigo.trim().toUpperCase(), nombre: form.nombre.trim(), elemento: form.elemento.trim() };
    if (!/^[A-Z0-9]{1,4}$/.test(formato.codigo)) { setError('El código debe tener de 1 a 4 letras o números.'); return; }
    if (!formato.nombre || formato.nombre.length > 40) { setError('Ingrese una descripción de máximo 40 caracteres.'); return; }
    if (modo === 'crear' && items.some(item => item.codigo === formato.codigo)) { setError('Ya existe un formato con ese código.'); return; }
    setGuardando(true);
    try {
      await guardarMedioFormato(cia, formato, modo === 'editar' ? formato.codigo : undefined);
      setModo(null); setSeleccion(formato.codigo); setAviso(modo === 'crear' ? 'Formato creado.' : 'Formato actualizado.');
      await cargar();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible guardar el formato.'); }
    finally { setGuardando(false); }
  }

  async function eliminar() {
    if (!porEliminar) return;
    setGuardando(true); setError(''); setAviso('');
    try {
      await eliminarMedioFormato(cia, porEliminar.codigo);
      setPorEliminar(null); setSeleccion(null); setAviso('Formato eliminado.'); await cargar();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible eliminar el formato.'); }
    finally { setGuardando(false); }
  }

  if (opcion === 'medios/formatos') return (
    <div className="max-w-screen-2xl space-y-4 p-4" onKeyDown={teclas}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs text-gray-500">Medios magnéticos</p><h1 className="text-lg font-semibold text-gray-800">Mantenimiento de formatos</h1></div>
        <span className="rounded bg-sky-50 px-3 py-1 text-xs text-sky-800">{items.length} formatos · Compartidos entre compañías</span>
      </div>
      {aviso && <div role="status" className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{aviso}</div>}
      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white p-3">
        <input aria-label="Buscar formatos" type="search" placeholder="Buscar código, descripción o elemento…" value={busqueda} onChange={event => setBusqueda(event.target.value)} className="w-80 rounded border border-gray-300 px-3 py-2 text-xs" />
        <span className="text-xs text-gray-500">{filtrados.length} resultados</span>
        <button type="button" onClick={() => void cargar()} disabled={cargando} className="ml-auto rounded border border-gray-300 px-3 py-2 text-xs text-gray-700">Actualizar</button>
        <button type="button" onClick={() => { setForm({ ...VACIO }); setModo('crear'); setError(''); }} className="rounded bg-petroleum-500 px-4 py-2 text-sm text-white">+ Crear formato</button>
      </div>
      <div className="overflow-x-auto rounded border border-gray-200 bg-white"><table className="w-full text-xs"><thead className="border-b bg-gray-50"><tr>{['Formato', 'Descripción', 'Elemento', 'Concepto', 'T. doc.', 'NIT', 'Dígito', 'Nombre', 'Dirección', 'Municipio', 'Vlr. 1', 'Vlr. 2', 'Acciones'].map(label => <th key={label} className="px-3 py-2.5 text-left font-semibold text-gray-600">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">
        {cargando && <tr><td colSpan={13} className="px-4 py-8 text-center text-gray-500">Consultando formatos…</td></tr>}
        {!cargando && filtrados.length === 0 && <tr><td colSpan={13} className="px-4 py-8 text-center text-gray-500">No se encontraron formatos.</td></tr>}
        {!cargando && filtrados.map(item => <tr key={item.codigo} onClick={() => setSeleccion(item.codigo)} className={`cursor-pointer hover:bg-gray-50 ${seleccion === item.codigo ? 'bg-sky-50' : ''}`}><td className="px-3 py-2 font-mono font-semibold">{item.codigo}</td><td className="px-3 py-2">{item.nombre}</td><td className="px-3 py-2">{item.elemento}</td>{(['concepto', 'tipodoc', 'nit', 'digito', 'nombreCampo', 'direccion', 'municipio', 'valor1', 'valor2'] as const).map(key => <td key={key} className="px-3 py-2 text-center">{item[key] ? 'Sí' : 'No'}</td>)}<td className="whitespace-nowrap px-3 py-2"><button type="button" onClick={() => { setForm({ ...item }); setModo('editar'); setError(''); }} className="mr-3 text-blue-700 hover:underline">Modificar</button><button type="button" onClick={() => { setPorEliminar(item); setError(''); }} className="text-red-600 hover:underline">Eliminar</button></td></tr>)}
      </tbody></table></div>
      {modo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={modo === 'crear' ? 'Crear formato' : 'Modificar formato'}><form onSubmit={guardar} onKeyDown={avanzarConEnter} className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-lg bg-white p-5 shadow-xl"><h2 className="text-base font-semibold">{modo === 'crear' ? 'Crear formato' : `Modificar formato ${form.codigo}`}</h2>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-gray-600">Código<input autoFocus className={INPUT} value={form.codigo} readOnly={modo === 'editar'} maxLength={4} onChange={event => setForm({ ...form, codigo: event.target.value.toUpperCase() })} /></label><label className="text-xs text-gray-600">Elemento<input className={INPUT} value={form.elemento} maxLength={10} onChange={event => setForm({ ...form, elemento: event.target.value })} /></label></div><label className="block text-xs text-gray-600">Descripción<input className={INPUT} value={form.nombre} maxLength={40} onChange={event => setForm({ ...form, nombre: event.target.value })} /></label><div><h3 className="mb-2 text-xs font-semibold text-gray-700">Columnas incluidas en el formato</h3><div className="grid gap-2 sm:grid-cols-2">{CAMPOS.map(campo => <label key={campo.key} className="flex items-center gap-2 rounded border border-gray-100 px-3 py-2 text-xs text-gray-700"><input type="checkbox" checked={Boolean(form[campo.key])} onChange={event => setForm({ ...form, [campo.key]: event.target.checked })} />{campo.label}</label>)}</div></div><div className="flex justify-end gap-2"><button type="button" onClick={() => { setModo(null); setError(''); }} className="rounded border border-gray-300 px-4 py-2 text-sm">Cancelar</button><button type="submit" disabled={guardando} className="rounded bg-petroleum-500 px-4 py-2 text-sm text-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar'}</button></div></form></div>}
      {porEliminar && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Eliminar formato"><div className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-xl"><h2 className="text-base font-semibold">Eliminar formato {porEliminar.codigo}</h2><p className="text-sm text-gray-700">Se eliminarán el formato y sus conceptos y cuentas asignadas para todas las compañías. ¿Desea continuar?</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => { setPorEliminar(null); setError(''); }} className="rounded border px-4 py-2 text-sm">Cancelar</button><button type="button" onClick={() => void eliminar()} disabled={guardando} className="rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50">Eliminar</button></div></div></div>}
    </div>
  );

  return (
    <div className="max-w-screen-xl space-y-4 p-4">
      <div>
        <p className="text-xs text-gray-500">Medios magnéticos</p>
        <h1 className="text-lg font-semibold text-gray-800">{TITULOS[opcion]}</h1>
      </div>
      <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-600">
        Esta opción está pendiente de migración. Todavía no genera ni modifica información.
      </div>
    </div>
  );
}
