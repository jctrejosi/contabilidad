import { useEffect, useState } from 'react';
import { listarCompanias } from '../api/companias';
import { copiarDefinicionesCompania, previsualizarCopiaCompania, type VistaCopia } from '../api/mediosCuentas';
import type { CompaniaSesion } from '../types';

/** MEDMAG03T: traspasa seis definiciones de CONMAE, por código de cuenta y NITN. */
export default function MediosCopiaCompania({ cia }: { cia: string }) {
  const [companias, setCompanias] = useState<CompaniaSesion[]>([]);
  const [origen, setOrigen] = useState('');
  const [vista, setVista] = useState<VistaCopia | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  useEffect(() => { void listarCompanias().then(setCompanias).catch(cause => setError(cause instanceof Error ? cause.message : 'No fue posible consultar las compañías.')); }, []);

  async function previsualizar() {
    setCargando(true); setError(''); setVista(null); setAviso('');
    try { setVista(await previsualizarCopiaCompania(cia, origen)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible comparar las compañías.'); }
    finally { setCargando(false); }
  }
  async function copiar() {
    setCargando(true); setError('');
    try {
      const result = await copiarDefinicionesCompania(cia, origen);
      setConfirmando(false); setVista(null);
      setAviso(`${result.actualizadas} cuentas actualizadas. ${result.sinCorrespondencia} cuentas del origen no tenían correspondencia.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible copiar las definiciones.'); }
    finally { setCargando(false); }
  }

  return <div className="max-w-3xl space-y-4 p-4">
    <div><p className="text-xs text-gray-500">Medios magnéticos / Asignación de cuentas</p><h1 className="text-lg font-semibold text-gray-800">Traer definiciones de otra compañía</h1></div>
    <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Esta operación reemplaza en el plan de cuentas de la compañía actual las definiciones fiscales de las cuentas coincidentes. Revise la vista previa antes de confirmar.</div>
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    {aviso && <div role="status" className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{aviso}</div>}
    <div className="space-y-4 rounded border border-gray-200 bg-white p-5"><div className="text-sm text-gray-700">Compañía destino: <strong>{cia}</strong></div><label className="block text-xs font-medium text-gray-700">Compañía origen<select className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm" value={origen} onChange={event => { setOrigen(event.target.value); setVista(null); }}><option value="">Seleccione la compañía de donde traerá definiciones</option>{companias.filter(item => item.codigo !== cia).map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} · {item.nombre}</option>)}</select></label><button type="button" onClick={() => void previsualizar()} disabled={!origen || cargando} className="rounded bg-petroleum-500 px-4 py-2 text-sm text-white disabled:opacity-50">{cargando ? 'Comparando…' : 'Comparar cuentas'}</button></div>
    {vista && <div className="space-y-3 rounded border border-gray-200 bg-white p-5"><h2 className="text-sm font-semibold">Resultado de la comparación</h2><div className="grid grid-cols-3 gap-3 text-center text-sm"><div className="rounded bg-gray-50 p-3"><div className="text-lg font-semibold">{vista.origenFilas}</div><div className="text-xs text-gray-500">Cuentas del origen</div></div><div className="rounded bg-sky-50 p-3"><div className="text-lg font-semibold">{vista.coincidentes}</div><div className="text-xs text-gray-500">Se actualizarán</div></div><div className="rounded bg-gray-50 p-3"><div className="text-lg font-semibold">{vista.sinCorrespondencia}</div><div className="text-xs text-gray-500">Sin coincidencia</div></div></div><p className="text-xs text-gray-600">Se copian formato, concepto, tipo de medio, valor de medio, renglón y suma/resta. La coincidencia se determina por código de cuenta y auxiliar de tercero; no se crean cuentas nuevas ni se copian filas de asignación manual.</p><button type="button" disabled={!vista.coincidentes || cargando} onClick={() => setConfirmando(true)} className="rounded bg-petroleum-500 px-4 py-2 text-sm text-white disabled:opacity-50">Aplicar definiciones</button></div>}
    {confirmando && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Confirmar copia entre compañías"><div className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-xl"><h2 className="text-base font-semibold">Confirmar copia</h2><p className="text-sm text-gray-700">Se sobrescribirán seis campos fiscales en {vista?.coincidentes} cuentas de la compañía {cia} con los datos de {origen}. ¿Desea continuar?</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setConfirmando(false)} className="rounded border px-4 py-2 text-sm">Cancelar</button><button type="button" onClick={() => void copiar()} disabled={cargando} className="rounded bg-petroleum-500 px-4 py-2 text-sm text-white disabled:opacity-50">{cargando ? 'Aplicando…' : 'Confirmar'}</button></div></div></div>}
  </div>;
}
