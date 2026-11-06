import { useEffect, useMemo, useRef, useState } from 'react';
import {
  actualizarLote,
  consultarDetalleLote,
  consultarLotes,
  crearLote,
  eliminarLote,
  eliminarLineaLote,
  guardarLineaLote,
  modificarLote,
  verificarLote,
  type DetalleLoteResponse,
  type LineaLoteReal,
  type LineaLoteWrite,
  type LoteReal,
  type LotesResponse,
  type VerificacionLote,
} from '../api/lotes';
import { listarCuentas } from '../api/cuentas';
import { listarCentros } from '../api/centros';
import { listarComprobantes } from '../api/comprobantes';
import { listarTiposDocumento } from '../api/tiposDocumento';
import { consultarPeriodoOperacion } from '../api/periodoOperacion';
import { listarTerceros } from '../api/terceros';
import type { Cuenta, Tercero } from '../types';
import type { CentroJerarquico } from '../data/configCentros';
import type { ComprobanteReal } from '../api/comprobantes';
import type { TipoDocumentoReal } from '../api/tiposDocumento';
import CrearTerceroModal from '../components/CrearTerceroModal';
import ConfirmarCrearTerceroModal from '../components/ConfirmarCrearTerceroModal';

const fmtCOP = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 2,
}).format(value);

const STATE_COLORS: Record<string, string> = {
  Activo: 'bg-blue-100 text-blue-700',
  Borrador: 'bg-gray-100 text-gray-700',
  'Con errores': 'bg-red-100 text-red-700',
  Verificado: 'bg-cyan-100 text-cyan-700',
  Pendiente: 'bg-amber-100 text-amber-700',
  Contabilizado: 'bg-green-100 text-green-700',
  Anulado: 'bg-gray-100 text-gray-500',
  Histórico: 'bg-purple-100 text-purple-700',
};

function Estado({ valor }: { valor: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_COLORS[valor] ?? 'bg-gray-100 text-gray-600'}`}>{valor}</span>;
}

export default function LotesPage({ cia }: { cia: string }) {
  const [resultado, setResultado] = useState<LotesResponse | null>(null);
  const [seleccionado, setSeleccionado] = useState<LoteReal | null>(null);
  const [detalle, setDetalle] = useState<DetalleLoteResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [error, setError] = useState('');
  const [errorDetalle, setErrorDetalle] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [crearAbierto, setCrearAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [nuevoLote, setNuevoLote] = useState({ lote: '', nombre: '', mes: '01', usuario: 'WEB' });

  // CONMOVI sí se carga al ingresar, tal como funciona el mantenimiento de
  // lotes original. CIA siempre viaja como parte obligatoria de la consulta.
  useEffect(() => {
    setSeleccionado(null);
    setDetalle(null);
    setBusqueda('');
    void cargarLotes(1);
  }, [cia]);

  async function cargarLotes(page: number) {
    setCargando(true);
    setError('');
    try {
      setResultado(await consultarLotes(cia, page));
    } catch (cause: unknown) {
      setResultado(null);
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar los lotes.');
    } finally {
      setCargando(false);
    }
  }

  async function abrirLote(lote: LoteReal, page = 1) {
    setSeleccionado(lote);
    setCargandoDetalle(true);
    setErrorDetalle('');
    try {
      setDetalle(await consultarDetalleLote(cia, lote.lote, page));
    } catch (cause: unknown) {
      setDetalle(null);
      setErrorDetalle(cause instanceof Error ? cause.message : 'No fue posible consultar los movimientos del lote.');
    } finally {
      setCargandoDetalle(false);
    }
  }

  async function crear() {
    setGuardando(true);
    setError('');
    try {
      const code = nuevoLote.lote.toUpperCase();
      await crearLote(cia, { ...nuevoLote, lote: code });
      setCrearAbierto(false);
      setNuevoLote({ lote: '', nombre: '', mes: '01', usuario: 'WEB' });
      const fresh = await consultarLotes(cia, 1);
      setResultado(fresh);
      const created = fresh.items.find(item => item.lote.trim() === code);
      if (created) await abrirLote(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible crear el lote.');
    } finally {
      setGuardando(false);
    }
  }

  async function refrescarDetalle() {
    if (!seleccionado) return;
    const detailResult = await consultarDetalleLote(cia, seleccionado.lote, detalle?.page ?? 1);
    setDetalle(detailResult);
    const lotsResult = await consultarLotes(cia, resultado?.page ?? 1);
    setResultado(lotsResult);
    const updated = lotsResult.items.find(item => item.lote.trim() === seleccionado.lote.trim());
    if (updated) setSeleccionado(updated);
  }

  const lotesVisibles = useMemo(() => {
    const query = busqueda.trim().toLocaleLowerCase('es');
    if (!query) return resultado?.items ?? [];
    return (resultado?.items ?? []).filter(lote =>
      lote.lote.toLocaleLowerCase('es').includes(query)
      || lote.nombre.toLocaleLowerCase('es').includes(query)
      || lote.usuarioInicial.toLocaleLowerCase('es').includes(query),
    );
  }, [busqueda, resultado]);

  if (seleccionado) {
    return <DetalleLote
      cia={cia}
      lote={seleccionado}
      resultado={detalle}
      cargando={cargandoDetalle}
      error={errorDetalle}
      onBack={() => { setSeleccionado(null); setDetalle(null); setErrorDetalle(''); }}
      onPage={page => { void abrirLote(seleccionado, page); }}
      onChanged={() => refrescarDetalle()}
      onFinished={message => {
        setSeleccionado(null);
        setDetalle(null);
        setErrorDetalle('');
        setAviso(message);
        void cargarLotes(resultado?.page ?? 1);
      }}
    />;
  }

  return (
    <div className="max-w-screen-2xl space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Movimientos / Lotes</div>
          <h1 className="text-lg font-semibold text-gray-800">Lotes contables</h1>
          <p className="mt-1 text-xs text-gray-500">Lotes contables de la compañía {cia}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Compañía {cia}</span>
          <button type="button" onClick={() => { setError(''); setCrearAbierto(true); }} className="rounded bg-[#0073C0] px-3 py-1.5 text-xs font-medium text-white">+ Crear lote</button>
          <button type="button" disabled={cargando} onClick={() => cargarLotes(resultado?.page ?? 1)} className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50">↻ Recargar lista</button>
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-3">
        <label className="mb-1 block text-xs font-medium text-gray-600">Buscar en la página</label>
        <input value={busqueda} onChange={event => setBusqueda(event.target.value)} placeholder="Código, nombre o usuario del lote" className="w-full max-w-md rounded border border-gray-300 px-2.5 py-1.5 text-xs outline-none focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100" />
      </div>

      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {aviso && <div role="status" className="flex items-center justify-between rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"><span>{aviso}</span><button type="button" onClick={() => setAviso('')} className="text-green-700">×</button></div>}

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-gray-200 bg-gray-50"><tr>
              {['Lote', 'Descripción', 'Mes', 'Fecha', 'Usuario inicial', 'Usuario final', 'Ítems', 'Débitos', 'Créditos', 'Diferencia', 'Estado', 'Acción'].map((titulo, index) => <th key={titulo} className={`whitespace-nowrap px-3 py-2.5 font-semibold text-gray-600 ${index >= 6 && index <= 9 ? 'text-right' : 'text-left'}`}>{titulo}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {cargando && <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-500">Consultando lotes de la compañía {cia}…</td></tr>}
              {!cargando && resultado && lotesVisibles.length === 0 && <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-500"><div className="font-medium text-gray-600">No hay lotes para mostrar</div><div className="mt-1">No existen registros de la compañía {cia}{busqueda ? ' que coincidan con la búsqueda.' : '.'}</div></td></tr>}
              {!cargando && lotesVisibles.map(lote => <tr key={`${lote.id}-${lote.lote}`} onClick={() => { void abrirLote(lote); }} className="hoverable cursor-pointer">
                <td className="px-3 py-2 font-mono font-medium text-gray-800">{lote.lote}</td>
                <td title={lote.nombre} className="max-w-64 truncate px-3 py-2 text-gray-700">{lote.nombre || '—'}</td>
                <td className="px-3 py-2 font-mono text-gray-600">{lote.mes || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-600">{lote.fecha || '—'}</td>
                <td className="px-3 py-2 font-mono text-gray-600">{lote.usuarioInicial || '—'}</td>
                <td className="px-3 py-2 font-mono text-gray-600">{lote.usuarioFinal || '—'}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-700">{lote.items}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-800">{fmtCOP(lote.debito)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-600">{fmtCOP(lote.credito)}</td>
                <td className={`whitespace-nowrap px-3 py-2 text-right font-mono font-semibold ${Math.abs(lote.diferencia) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>{Math.abs(lote.diferencia) < 0.01 ? '—' : fmtCOP(Math.abs(lote.diferencia))}</td>
                <td className="px-3 py-2"><Estado valor={lote.estado} /></td>
                <td className="px-3 py-2"><button type="button" onClick={event => { event.stopPropagation(); void abrirLote(lote); }} className="text-xs font-medium text-petroleum-600 hover:underline">Ver detalle</button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex items-center border-t border-gray-200 bg-gray-50 px-4 py-2.5">
          <span className="text-xs text-gray-500">{resultado ? `${lotesVisibles.length} lotes · página ${resultado.page}` : 'Consultando…'}</span>
          {resultado && <div className="ml-auto flex gap-2"><button type="button" disabled={resultado.page <= 1 || cargando} onClick={() => cargarLotes(resultado.page - 1)} className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 disabled:opacity-40">← Anterior</button><button type="button" disabled={!resultado.hasMore || cargando} onClick={() => cargarLotes(resultado.page + 1)} className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 disabled:opacity-40">Siguiente →</button></div>}
        </div>
      </div>
      {crearAbierto && <Modal title="Crear lote contable" onClose={() => !guardando && setCrearAbierto(false)}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Código del lote (4 caracteres)"><input autoFocus maxLength={4} value={nuevoLote.lote} onChange={e => setNuevoLote(v => ({ ...v, lote: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))} className="input-lote" /></Campo>
          <Campo label="Mes"><select value={nuevoLote.mes} onChange={e => setNuevoLote(v => ({ ...v, mes: e.target.value }))} className="input-lote">{Array.from({ length: 19 }, (_, month) => <option key={month} value={String(month).padStart(2, '0')}>{String(month).padStart(2, '0')}{month === 0 ? ' — Saldos iniciales' : ''}</option>)}</select></Campo>
          <div className="sm:col-span-2"><Campo label="Descripción"><input maxLength={25} value={nuevoLote.nombre} onChange={e => setNuevoLote(v => ({ ...v, nombre: e.target.value }))} className="input-lote" /></Campo></div>
          <Campo label="Usuario responsable"><input maxLength={4} value={nuevoLote.usuario} onChange={e => setNuevoLote(v => ({ ...v, usuario: e.target.value.toUpperCase() }))} className="input-lote" /></Campo>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={guardando} onClick={() => setCrearAbierto(false)} className="rounded border px-4 py-2 text-xs">Cancelar</button><button type="button" disabled={guardando || nuevoLote.lote.length !== 4 || !nuevoLote.nombre.trim()} onClick={() => void crear()} className="rounded bg-[#0073C0] px-4 py-2 text-xs font-medium text-white disabled:bg-gray-300">{guardando ? 'Creando…' : 'Crear y abrir para captura'}</button></div>
      </Modal>}
    </div>
  );
}

function DetalleLote({ cia, lote, resultado, cargando, error, onBack, onPage, onChanged, onFinished }: {
  cia: string;
  lote: LoteReal;
  resultado: DetalleLoteResponse | null;
  cargando: boolean;
  error: string;
  onBack: () => void;
  onPage: (page: number) => void;
  onChanged: () => Promise<void>;
  onFinished: (message: string) => void;
}) {
  const lineas = resultado?.items ?? [];
  const [editor, setEditor] = useState<LineaLoteReal | 'nuevo' | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [editarCabecera, setEditarCabecera] = useState(false);
  const [verificacion, setVerificacion] = useState<VerificacionLote | null>(null);
  const [accion, setAccion] = useState<'eliminar' | 'eliminarProtegido' | 'actualizar' | null>(null);
  const [cabecera, setCabecera] = useState({
    lote: lote.lote.trim(),
    nombre: lote.nombre.trim(),
    mes: lote.mes.trim(),
    usuario: lote.usuarioInicial.trim() || 'WEB',
  });

  async function guardar(payload: LineaLoteWrite): Promise<boolean> {
    setGuardando(true);
    setMensaje('');
    try {
      await guardarLineaLote(cia, lote.lote, payload, editor === 'nuevo' ? undefined : editor?.id);
      // En captura nueva se mantiene abierto el editor para continuar digitando
      // partidas del mismo documento. Al editar una fila existente sí se cierra.
      if (editor !== 'nuevo') setEditor(null);
      await onChanged();
      return true;
    } catch (cause) {
      setMensaje(cause instanceof Error ? cause.message : 'No fue posible guardar la partida.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(linea: LineaLoteReal) {
    if (!window.confirm(`¿Confirma eliminar la partida ${linea.documento} / ${linea.cuenta}?`)) return;
    setMensaje('');
    try {
      await eliminarLineaLote(cia, lote.lote, linea.id);
      await onChanged();
    } catch (cause) {
      setMensaje(cause instanceof Error ? cause.message : 'No fue posible eliminar la partida.');
    }
  }

  async function guardarCabecera() {
    setGuardando(true);
    setMensaje('');
    try {
      await modificarLote(cia, lote.lote, cabecera);
      setEditarCabecera(false);
      await onChanged();
    } catch (cause) {
      setMensaje(cause instanceof Error ? cause.message : 'No fue posible modificar el lote.');
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutarVerificacion(prepararActualizacion = false) {
    setGuardando(true);
    setMensaje('');
    try {
      const response = await verificarLote(cia, lote.lote);
      setVerificacion(response.item);
      await onChanged();
      if (prepararActualizacion && response.item.valido) {
        setVerificacion(null);
        setAccion('actualizar');
      }
    } catch (cause) {
      setMensaje(cause instanceof Error ? cause.message : 'No fue posible verificar el lote.');
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutarEliminacion(force: boolean) {
    setGuardando(true);
    setMensaje('');
    try {
      const response = await eliminarLote(cia, lote.lote, force);
      setAccion(null);
      onFinished(`Lote ${lote.lote} eliminado. Se retiraron ${response.item.partidasEliminadas} partida(s).`);
    } catch (cause) {
      setAccion(null);
      setMensaje(cause instanceof Error ? cause.message : 'No fue posible eliminar el lote.');
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutarActualizacion() {
    setGuardando(true);
    setMensaje('');
    try {
      const response = await actualizarLote(cia, lote.lote, cabecera.usuario);
      setAccion(null);
      const warning = response.item.advertencias.length ? ` ${response.item.advertencias.join(' ')}` : '';
      onFinished(`Lote ${lote.lote} actualizado: ${response.item.documentos} documento(s) y ${response.item.partidas} partida(s) contabilizadas.${warning}`);
    } catch (cause) {
      setAccion(null);
      setMensaje(cause instanceof Error ? cause.message : 'No fue posible actualizar el lote.');
    } finally {
      setGuardando(false);
    }
  }

  return <div className="max-w-screen-2xl space-y-4 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><button type="button" onClick={onBack} className="mb-2 text-xs text-petroleum-600 hover:underline">← Volver a lotes</button><h1 className="text-lg font-semibold text-gray-800">Lote {lote.lote} — {lote.nombre}</h1><p className="mt-1 text-xs text-gray-500">Movimientos contables del lote {lote.lote}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Compañía {cia}</span>
        <button type="button" disabled={guardando} onClick={() => setEditarCabecera(true)} className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 disabled:opacity-40">Editar lote</button>
        <button type="button" disabled={guardando} onClick={() => setAccion('eliminar')} className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-600 disabled:opacity-40">Eliminar lote</button>
        <button type="button" disabled={guardando} onClick={() => void ejecutarVerificacion()} className="rounded border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 disabled:opacity-40">{guardando ? 'Procesando…' : 'Verificar lote'}</button>
        <button type="button" disabled={guardando || lineas.length === 0} onClick={() => void ejecutarVerificacion(true)} className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:bg-gray-300">Actualizar lote</button>
        <button type="button" disabled={guardando} onClick={() => { setMensaje(''); setEditor('nuevo'); }} className="rounded bg-[#0073C0] px-3 py-1.5 text-xs font-medium text-white disabled:bg-gray-300">+ Agregar movimiento</button>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 rounded border border-gray-200 bg-white p-3 text-xs md:grid-cols-4 lg:grid-cols-8">
      <Dato label="Mes" value={lote.mes || '—'} /><Dato label="Fecha" value={lote.fecha || '—'} /><Dato label="Usuario inicial" value={lote.usuarioInicial || '—'} /><Dato label="Usuario final" value={lote.usuarioFinal || '—'} /><Dato label="Ítems cabecera" value={String(lote.items)} /><Dato label="Débitos cabecera" value={fmtCOP(lote.debito)} /><Dato label="Créditos cabecera" value={fmtCOP(lote.credito)} /><div><div className="mb-1 text-gray-400">Estado</div><Estado valor={lote.estado} /></div>
    </div>

    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {mensaje && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensaje}</div>}
    <div className="overflow-hidden rounded border border-gray-200 bg-white">
      <div className="table-fixed-header overflow-x-auto"><table className="w-full text-xs"><thead className="border-b border-gray-200 bg-gray-50"><tr>{['Cuenta', 'Nombre cuenta', 'NIT', 'Centro', 'Comprobante', 'Tipo', 'Documento', 'Fecha', 'Débito', 'Crédito', 'Base', 'Doc. afectado', 'Concepto', 'Inconsistencia', 'Acciones'].map((titulo, index) => <th key={titulo} className={`whitespace-nowrap px-3 py-2.5 font-semibold text-gray-600 ${index >= 8 && index <= 10 ? 'text-right' : 'text-left'}`}>{titulo}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-50">
          {cargando && <tr><td colSpan={15} className="px-4 py-12 text-center text-gray-500">Consultando movimientos del lote {lote.lote}…</td></tr>}
          {!cargando && resultado && lineas.length === 0 && <tr><td colSpan={15} className="px-4 py-12 text-center text-gray-500"><div>El lote está vacío y listo para captura.</div><button type="button" onClick={() => setEditor('nuevo')} className="mt-2 font-medium text-petroleum-600 hover:underline">Agregar la primera partida</button></td></tr>}
          {!cargando && lineas.map((linea, index) => <tr key={`${linea.id}-${index}`} className={linea.inconsistencia.trim() ? 'bg-red-50' : ''}><td className="px-3 py-2 font-mono text-gray-700">{linea.cuenta}</td><td title={linea.nombreCuenta} className="max-w-60 truncate px-3 py-2 text-gray-600">{linea.nombreCuenta || '—'}</td><td className="px-3 py-2 font-mono text-gray-600">{linea.nit || '—'}</td><td className="px-3 py-2 font-mono text-gray-600">{linea.centro || '—'}</td><td className="px-3 py-2 font-mono text-gray-600">{linea.comprobante || '—'}</td><td className="px-3 py-2 text-gray-600">{linea.tipoDocumento || '—'}</td><td className="px-3 py-2 font-mono text-gray-600">{linea.documento || '—'}</td><td className="whitespace-nowrap px-3 py-2 font-mono text-gray-600">{linea.fecha || '—'}</td><td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-800">{linea.debito ? fmtCOP(linea.debito) : '—'}</td><td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-600">{linea.credito ? fmtCOP(linea.credito) : '—'}</td><td className="whitespace-nowrap px-3 py-2 text-right font-mono text-gray-600">{linea.base ? fmtCOP(linea.base) : '—'}</td><td className="px-3 py-2 font-mono text-gray-600">{linea.documentoAfectado || '—'}</td><td title={linea.concepto} className="max-w-72 truncate px-3 py-2 text-gray-500">{linea.concepto || '—'}</td><td className="px-3 py-2 text-red-600">{linea.inconsistencia || '—'}</td><td className="whitespace-nowrap px-3 py-2"><button type="button" onClick={() => setEditor(linea)} className="mr-2 text-petroleum-600 hover:underline">Editar</button><button type="button" onClick={() => void eliminar(linea)} className="text-red-600 hover:underline">Eliminar</button></td></tr>)}
        </tbody></table></div>
      <div className="flex flex-wrap items-center gap-5 border-t border-gray-200 bg-gray-50 px-4 py-2.5"><span className="text-xs text-gray-500">{resultado ? `${lineas.length} partidas · página ${resultado.page}` : 'Consultando…'}</span>{resultado && <><span className="text-xs text-gray-500">Débitos página: <strong className="font-mono text-gray-800">{fmtCOP(resultado.pageDebit)}</strong></span><span className="text-xs text-gray-500">Créditos página: <strong className="font-mono text-gray-800">{fmtCOP(resultado.pageCredit)}</strong></span><div className="ml-auto flex gap-2"><button type="button" disabled={resultado.page <= 1 || cargando} onClick={() => onPage(resultado.page - 1)} className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 disabled:opacity-40">← Anterior</button><button type="button" disabled={!resultado.hasMore || cargando} onClick={() => onPage(resultado.page + 1)} className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 disabled:opacity-40">Siguiente →</button></div></>}</div>
    </div>
    {editor && <EditorMovimiento cia={cia} lote={lote} linea={editor === 'nuevo' ? null : editor} guardando={guardando} error={mensaje} onClose={() => !guardando && setEditor(null)} onSave={guardar} />}
    {editarCabecera && <Modal title={`Modificar lote ${lote.lote}`} onClose={() => !guardando && setEditarCabecera(false)}><div className="grid gap-3 sm:grid-cols-2"><Campo label="Código"><input value={cabecera.lote} disabled className="input-lote bg-gray-100" /></Campo><Campo label="Mes"><select value={cabecera.mes} onChange={e => setCabecera(v => ({ ...v, mes: e.target.value }))} className="input-lote">{Array.from({ length: 19 }, (_, month) => <option key={month} value={String(month).padStart(2, '0')}>{String(month).padStart(2, '0')}</option>)}</select></Campo><div className="sm:col-span-2"><Campo label="Descripción"><input maxLength={25} value={cabecera.nombre} onChange={e => setCabecera(v => ({ ...v, nombre: e.target.value }))} className="input-lote" /></Campo></div><Campo label="Usuario responsable"><input maxLength={4} value={cabecera.usuario} onChange={e => setCabecera(v => ({ ...v, usuario: e.target.value.toUpperCase() }))} className="input-lote" /></Campo></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditarCabecera(false)} className="rounded border px-4 py-2 text-xs">Cancelar</button><button type="button" disabled={guardando || !cabecera.nombre.trim()} onClick={() => void guardarCabecera()} className="rounded bg-[#0073C0] px-4 py-2 text-xs font-medium text-white disabled:bg-gray-300">Guardar cambios</button></div></Modal>}
    {verificacion && <Modal title={`Resultado de verificación · lote ${lote.lote}`} onClose={() => setVerificacion(null)}>
      <div className={`rounded border px-4 py-3 ${verificacion.valido ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
        <div className="font-semibold">{verificacion.valido ? 'El lote está listo para actualizar' : `Se encontraron ${verificacion.errores.length} inconsistencia(s)`}</div>
        <div className="mt-1 text-xs">{verificacion.items} partidas · {verificacion.documentos} documentos · Débitos {fmtCOP(verificacion.debito)} · Créditos {fmtCOP(verificacion.credito)}</div>
      </div>
      {!verificacion.valido && <div className="mt-4 max-h-80 overflow-y-auto rounded border border-gray-200">
        <table className="w-full text-xs"><thead className="sticky top-0 bg-gray-50"><tr><th className="px-3 py-2 text-left">Categoría</th><th className="px-3 py-2 text-left">Documento</th><th className="px-3 py-2 text-left">Detalle</th></tr></thead><tbody className="divide-y divide-gray-100">{verificacion.errores.map((issue, index) => <tr key={`${issue.lineaId}-${index}`}><td className="px-3 py-2 text-gray-600">{issue.categoria}</td><td className="px-3 py-2 font-mono text-gray-600">{issue.documento || '—'}</td><td className="px-3 py-2 text-gray-700">{issue.mensaje}</td></tr>)}</tbody></table>
      </div>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setVerificacion(null)} className="rounded border px-4 py-2 text-xs">Cerrar</button>{verificacion.valido && <button type="button" onClick={() => { setVerificacion(null); setAccion('actualizar'); }} className="rounded bg-green-600 px-4 py-2 text-xs font-medium text-white">Continuar con la actualización</button>}</div>
    </Modal>}
    {accion === 'eliminar' && <ConfirmAction
      title="Eliminar lote"
      message={`Se eliminará el lote ${lote.lote} junto con sus ${lote.items} partida(s). Esta operación no se puede deshacer.`}
      confirmLabel="Eliminar lote"
      danger
      busy={guardando}
      onCancel={() => setAccion(null)}
      onConfirm={() => {
        if (lote.permiteBorrar.trim().toUpperCase() === 'N') setAccion('eliminarProtegido');
        else void ejecutarEliminacion(false);
      }}
    />}
    {accion === 'eliminarProtegido' && <ConfirmAction
      title="Confirmación adicional"
      message="Este lote está protegido porque tuvo una extracción completa de movimientos. Confirme nuevamente si realmente desea eliminarlo."
      confirmLabel="Sí, eliminar definitivamente"
      danger
      busy={guardando}
      onCancel={() => setAccion(null)}
      onConfirm={() => void ejecutarEliminacion(true)}
    />}
    {accion === 'actualizar' && <ConfirmAction
      title="Actualizar lote"
      message={`Se contabilizarán definitivamente todos los documentos del lote ${lote.lote}. Al finalizar correctamente, el lote dejará de aparecer como pendiente.`}
      confirmLabel="Contabilizar lote"
      busy={guardando}
      onCancel={() => setAccion(null)}
      onConfirm={() => void ejecutarActualizacion()}
    />}
  </div>;
}

function Dato({ label, value }: { label: string; value: string }) {
  return <div><div className="mb-1 text-gray-400">{label}</div><div className="font-mono font-medium text-gray-700">{value}</div></div>;
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>{children}</label>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-5 py-3"><h2 className="text-sm font-semibold text-gray-800">{title}</h2><button type="button" onClick={onClose} className="text-xl text-gray-400">×</button></div>
      <div className="p-5">{children}</div>
    </div>
  </div>;
}

function ConfirmAction({ title, message, confirmLabel, danger = false, busy, onCancel, onConfirm }: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
    <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
      <div className="flex gap-3 px-5 pb-4 pt-5"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl ${danger ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>!</div><div><h2 className="font-semibold text-gray-800">{title}</h2><p className="mt-2 text-sm leading-5 text-gray-600">{message}</p></div></div>
      <div className="flex justify-end gap-2 border-t bg-gray-50 px-5 py-4"><button type="button" disabled={busy} onClick={onCancel} className="rounded border border-gray-300 bg-white px-4 py-2 text-xs text-gray-700 disabled:opacity-40">Cancelar</button><button autoFocus type="button" disabled={busy} onClick={onConfirm} className={`rounded px-4 py-2 text-xs font-medium text-white disabled:bg-gray-300 ${danger ? 'bg-red-600' : 'bg-green-600'}`}>{busy ? 'Procesando…' : confirmLabel}</button></div>
    </div>
  </div>;
}

function EditorMovimiento({ cia, lote, linea, guardando, error, onClose, onSave }: {
  cia: string;
  lote: LoteReal;
  linea: LineaLoteReal | null;
  guardando: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: LineaLoteWrite) => Promise<boolean>;
}) {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [centros, setCentros] = useState<CentroJerarquico[]>([]);
  const [comprobantes, setComprobantes] = useState<ComprobanteReal[]>([]);
  const [tipos, setTipos] = useState<TipoDocumentoReal[]>([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [selectorTerceroAbierto, setSelectorTerceroAbierto] = useState(false);
  const [terceroSearch, setTerceroSearch] = useState(linea?.nitMovimiento ?? linea?.nit ?? '');
  const [tercerosEncontrados, setTercerosEncontrados] = useState<Tercero[]>([]);
  const [terceroOpcion, setTerceroOpcion] = useState(0);
  const [tercerosCargando, setTercerosCargando] = useState(false);
  const [terceroError, setTerceroError] = useState('');
  const [terceroSeleccionado, setTerceroSeleccionado] = useState<Tercero | null>(null);
  const [crearTerceroAbierto, setCrearTerceroAbierto] = useState(false);
  const [terceroNoEncontrado, setTerceroNoEncontrado] = useState<string | null>(null);
  // Incluso al editar una partida heredada se exige volver a seleccionar el
  // tercero, evitando presentar como validado un código que ya no esté en FADCLI.
  const [terceroValidado, setTerceroValidado] = useState(false);
  const cuentaInputRef = useRef<HTMLInputElement>(null);
  const terceroButtonRef = useRef<HTMLButtonElement>(null);
  const [form, setForm] = useState<LineaLoteWrite>({
    cuenta: linea?.cuenta ?? '',
    nit: linea?.nitMovimiento ?? linea?.nit ?? '',
    centro: linea?.centro ?? '',
    comprobante: linea?.comprobante ?? '',
    tipoDocumento: linea?.tipoDocumento ?? '',
    documento: linea?.documento ?? '',
    documentoAfectado: linea?.documentoAfectado ?? '',
    fecha: linea?.fecha ?? '',
    debito: linea?.debito ?? 0,
    credito: linea?.credito ?? 0,
    base: linea?.base ?? 0,
    concepto: linea?.concepto ?? '',
  });

  useEffect(() => {
    let active = true;
    setCargandoCatalogos(true);
    Promise.all([
      listarCuentas(cia), listarCentros(cia), listarComprobantes(cia), listarTiposDocumento(), consultarPeriodoOperacion(cia),
    ]).then(([accountRows, centerRows, voucherRows, typeRows, period]) => {
      if (!active) return;
      setCuentas(accountRows.filter(account => account.afectable));
      setCentros(centerRows.items);
      setComprobantes(voucherRows.items.filter(item => !item.historico));
      setTipos(typeRows.items);
      if (!linea) {
        const rawMonth = Number(lote.mes || 0);
        const month = rawMonth > 12 ? rawMonth - 12 : rawMonth || Number(period.periodoSugerido.slice(5, 7));
        setForm(current => ({ ...current, fecha: `${period.anio}-${String(month).padStart(2, '0')}-01` }));
      }
    }).catch(cause => {
      if (active) setCatalogError(cause instanceof Error ? cause.message : 'No fue posible cargar los maestros contables.');
    }).finally(() => { if (active) setCargandoCatalogos(false); });
    return () => { active = false; };
  }, [cia, linea, lote.mes]);

  const cuenta = cuentas.find(item => item.codigo === form.cuenta);
  const requiereTercero = Boolean(cuenta?.requiereTercero || cuenta?.requiereBase);
  const requiereCentro = Boolean(cuenta?.requiereCentro);

  function set<K extends keyof LineaLoteWrite>(key: K, value: LineaLoteWrite[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function elegirCuenta(value: string) {
    const selected = cuentas.find(item => item.codigo === value);
    setForm(current => ({
      ...current,
      cuenta: value,
      nit: selected && !(selected.requiereTercero || selected.requiereBase) ? '' : current.nit,
      centro: selected && !selected.requiereCentro ? '' : current.centro,
      base: selected && !selected.requiereBase ? 0 : current.base,
    }));
    if (selected && !(selected.requiereTercero || selected.requiereBase)) {
      setTerceroSeleccionado(null);
      setTerceroValidado(false);
      setTerceroSearch('');
      setTercerosEncontrados([]);
      setSelectorTerceroAbierto(false);
      setTerceroError('');
    }
  }

  async function buscarTerceros() {
    const termino = terceroSearch.trim();
    if (termino.length < 2) {
      setTerceroError('Escriba al menos dos caracteres del NIT o del nombre.');
      setTercerosEncontrados([]);
      setTerceroOpcion(0);
      return;
    }
    setTercerosCargando(true);
    setTerceroError('');
    try {
      const response = await listarTerceros({ page: 1, pageSize: 30, search: termino, estado: 'todos' });
      setTercerosEncontrados(response.items);
      setTerceroOpcion(0);
      if (!response.items.length) {
        setTerceroError(`El tercero "${termino}" no existe.`);
        setSelectorTerceroAbierto(false);
        setTerceroNoEncontrado(termino);
      }
    } catch (cause) {
      setTercerosEncontrados([]);
      setTerceroOpcion(0);
      setTerceroError(cause instanceof Error ? cause.message : 'No fue posible buscar el tercero.');
    } finally {
      setTercerosCargando(false);
    }
  }

  function seleccionarTercero(tercero: Tercero) {
    set('nit', tercero.nit);
    setTerceroSeleccionado(tercero);
    setTerceroValidado(true);
    setTerceroSearch(`${tercero.nit} — ${tercero.nombre}`);
    setTerceroError('');
    setTercerosEncontrados([]);
    setTerceroOpcion(0);
    setSelectorTerceroAbierto(false);
    // El campo de búsqueda desaparece al cerrar la lista. Transferimos el foco
    // desde el botón Tercero al siguiente control habilitado para que Enter
    // continúe el recorrido normal del formulario sin volver al mouse.
    requestAnimationFrame(() => {
      const terceroButton = terceroButtonRef.current;
      const formElement = terceroButton?.closest('form');
      if (!terceroButton || !formElement) return;
      const controls = Array.from(formElement.querySelectorAll<HTMLElement>(
        'input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button[data-nav]:not(:disabled),button[data-save]:not(:disabled)',
      ));
      controls[controls.indexOf(terceroButton) + 1]?.focus();
    });
  }

  function moverOpcionTercero(direccion: 1 | -1) {
    if (!tercerosEncontrados.length) return;
    setTerceroOpcion(actual => {
      const siguiente = Math.max(0, Math.min(actual + direccion, tercerosEncontrados.length - 1));
      requestAnimationFrame(() => document
        .querySelector<HTMLElement>(`[data-lote-tercero-opcion="${siguiente}"]`)
        ?.scrollIntoView({ block: 'nearest' }));
      return siguiente;
    });
  }

  function keyboardNavigation(event: React.KeyboardEvent<HTMLFormElement>) {
    // Enter avanza al siguiente control, incluso desde Concepto hacia el botón
    // Agregar partida. Shift+Enter sigue disponible para escribir otra línea.
    if (event.key !== 'Enter' || event.shiftKey) return;
    const target = event.target as HTMLElement;
    // Cuando el foco ya está en el botón dejamos actuar su comportamiento
    // nativo: el siguiente Enter envía y graba el formulario.
    if (target.matches('button[data-save]')) return;
    event.preventDefault();
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button[data-nav]:not(:disabled),button[data-save]:not(:disabled)'));
    const index = controls.indexOf(target);
    controls[index + 1]?.focus();
  }

  async function enviarPartida() {
    setConfirmacion('');
    if (requiereTercero && (!form.nit || !terceroValidado)) {
      setTerceroError('Busque y seleccione un tercero válido antes de grabar.');
      setSelectorTerceroAbierto(true);
      return;
    }
    const saved = await onSave(form);
    if (!saved || linea) return;

    // Los cuatro datos siguientes identifican la cabecera del documento y se
    // conservan para agilizar la captura de sus demás movimientos. Todos los
    // valores propios de la partida se limpian antes de iniciar el nuevo renglón.
    setForm(current => ({
      cuenta: '',
      nit: '',
      centro: '',
      comprobante: current.comprobante,
      tipoDocumento: current.tipoDocumento,
      documento: current.documento,
      documentoAfectado: '',
      fecha: current.fecha,
      debito: 0,
      credito: 0,
      base: 0,
      concepto: '',
    }));
    setConfirmacion('Partida grabada. Puede registrar el siguiente movimiento del documento.');
    setTerceroSeleccionado(null);
    setTerceroValidado(false);
    setTerceroSearch('');
    setTercerosEncontrados([]);
    setTerceroError('');
    requestAnimationFrame(() => cuentaInputRef.current?.focus());
  }

  return <><Modal title={linea ? `Modificar partida ${linea.id}` : `Agregar movimiento al lote ${lote.lote}`} onClose={onClose}>
    <form onKeyDown={keyboardNavigation} onSubmit={event => { event.preventDefault(); void enviarPartida(); }}>
      {(error || catalogError) && <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">{error || catalogError}</div>}
      {confirmacion && <div role="status" className="mb-3 rounded border border-green-200 bg-green-50 p-2 text-xs text-green-700">{confirmacion}</div>}
      <datalist id="cuentas-lote">{cuentas.map(item => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}</datalist>
      <datalist id="centros-lote">{centros.map(item => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}</datalist>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Campo label="Comprobante"><select autoFocus value={form.comprobante} onChange={e => set('comprobante', e.target.value)} className="input-lote" required><option value="">Seleccione…</option>{comprobantes.map(item => <option key={item.codigo} value={item.codigo}>{item.codigo} — {item.nombre}</option>)}</select></Campo>
        <Campo label="Fecha"><input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className="input-lote" required /></Campo>
        <Campo label="Tipo de documento"><select value={form.tipoDocumento} onChange={e => set('tipoDocumento', e.target.value)} className="input-lote" required><option value="">Seleccione…</option>{tipos.map(item => <option key={item.id || item.codigo} value={item.codigo}>{item.codigo} — {item.nombre}</option>)}</select></Campo>
        <Campo label="Número de documento"><input maxLength={12} value={form.documento} onChange={e => set('documento', e.target.value.toUpperCase())} className="input-lote" required /></Campo>
        <Campo label="Documento afectado"><input maxLength={12} value={form.documentoAfectado} onChange={e => set('documentoAfectado', e.target.value.toUpperCase())} className="input-lote" /></Campo>
        <Campo label="Cuenta"><input ref={cuentaInputRef} list="cuentas-lote" value={form.cuenta} onChange={e => elegirCuenta(e.target.value)} className="input-lote" required /><span className="mt-1 block truncate text-[11px] text-gray-400">{cuenta?.nombre ?? 'Seleccione una cuenta afectable'}</span></Campo>
        <Campo label={`Tercero${requiereTercero ? ' · obligatorio' : ''}`}>
          <div className="relative">
            <button
              ref={terceroButtonRef}
              type="button"
              data-nav
              disabled={!requiereTercero}
              onClick={() => {
                setSelectorTerceroAbierto(true);
                setTerceroSearch(terceroSeleccionado ? `${terceroSeleccionado.nit} — ${terceroSeleccionado.nombre}` : form.nit);
                setTercerosEncontrados([]);
                setTerceroOpcion(0);
                setTerceroError('');
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectorTerceroAbierto(true);
                }
              }}
              className={`input-lote truncate text-left disabled:bg-gray-100 ${requiereTercero && !terceroValidado ? 'border-amber-300' : ''}`}
              title={requiereTercero ? 'Buscar tercero por identificación o nombre' : 'Esta cuenta no maneja tercero'}
            >
              {!requiereTercero ? 'No aplica' : terceroSeleccionado ? `${terceroSeleccionado.nit} — ${terceroSeleccionado.nombre}` : form.nit ? `${form.nit} — Validar tercero` : 'Buscar tercero…'}
            </button>
            {selectorTerceroAbierto && requiereTercero && <div className="absolute left-0 top-full z-30 mt-1 w-[26rem] max-w-[85vw] rounded border border-gray-200 bg-white shadow-xl">
              <div className="flex gap-2 border-b p-2">
                <input
                  autoFocus
                  value={terceroSearch}
                  onChange={event => {
                    setTerceroSearch(event.target.value);
                    setTerceroValidado(false);
                    setTerceroSeleccionado(null);
                    setTerceroOpcion(0);
                  }}
                  onKeyDown={event => {
                    event.stopPropagation();
                    if (event.key === 'ArrowDown' && tercerosEncontrados.length) {
                      event.preventDefault();
                      moverOpcionTercero(1);
                      return;
                    }
                    if (event.key === 'ArrowUp' && tercerosEncontrados.length) {
                      event.preventDefault();
                      moverOpcionTercero(-1);
                      return;
                    }
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      const seleccionado = tercerosEncontrados[terceroOpcion];
                      if (seleccionado) seleccionarTercero(seleccionado);
                      else void buscarTerceros();
                    }
                    if (event.key === 'Escape') { event.preventDefault(); setSelectorTerceroAbierto(false); }
                  }}
                  placeholder="NIT o nombre (mínimo 2 caracteres)"
                  className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-petroleum-500"
                />
                <button type="button" disabled={tercerosCargando} onClick={() => void buscarTerceros()} className="rounded bg-petroleum-500 px-3 py-1 text-xs font-medium text-white disabled:opacity-50">{tercerosCargando ? 'Buscando…' : 'Buscar'}</button>
              </div>
              {terceroError && <div className="border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{terceroError}</div>}
              {tercerosEncontrados.length > 0 && <div className="border-b bg-gray-50 px-3 py-1.5 text-[11px] text-gray-500">Use ↑/↓ para recorrer y Enter para seleccionar.</div>}
              <div className="max-h-52 overflow-y-auto">
                {!tercerosCargando && !terceroError && tercerosEncontrados.length === 0 && <div className="px-3 py-4 text-center text-xs text-gray-400">Busque y seleccione un tercero.</div>}
                {tercerosEncontrados.map((tercero, index) => <button
                  type="button"
                  key={tercero.nit}
                  data-lote-tercero-opcion={index}
                  onMouseEnter={() => setTerceroOpcion(index)}
                  onClick={() => seleccionarTercero(tercero)}
                  className={`flex w-full items-center gap-2 border-b border-gray-50 px-3 py-2 text-left ${index === terceroOpcion ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : 'hover:bg-gray-50'}`}
                >
                  <span className="w-28 shrink-0 font-mono text-xs text-gray-600">{tercero.nit}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-gray-700">{tercero.nombre}</span>
                  <span className={`text-[10px] ${tercero.estado === 'Activo' ? 'text-green-600' : 'text-amber-600'}`}>{tercero.estado}</span>
                </button>)}
              </div>
            </div>}
          </div>
          {requiereTercero && <span className={`mt-1 block text-[11px] ${terceroValidado ? 'text-green-600' : 'text-gray-400'}`}>{terceroValidado ? 'Tercero validado' : 'Debe seleccionar un tercero de los resultados'}</span>}
        </Campo>
        <Campo label={`Centro de costo${requiereCentro ? ' · obligatorio' : ''}`}><input list="centros-lote" maxLength={7} disabled={!requiereCentro} value={form.centro} onChange={e => set('centro', e.target.value.toUpperCase())} className="input-lote disabled:bg-gray-100" required={requiereCentro} /></Campo>
        <Campo label="Base"><input type="number" min="0" step="0.01" disabled={!cuenta?.requiereBase} value={form.base || ''} onChange={e => set('base', Number(e.target.value))} className="input-lote disabled:bg-gray-100" required={cuenta?.requiereBase} /></Campo>
        <Campo label="Débito"><input type="number" min="0" step="0.01" disabled={form.credito > 0} value={form.debito || ''} onChange={e => { const value = Number(e.target.value); setForm(current => ({ ...current, debito: value, credito: value > 0 ? 0 : current.credito })); }} className="input-lote disabled:bg-gray-100" /></Campo>
        <Campo label="Crédito"><input type="number" min="0" step="0.01" disabled={form.debito > 0} value={form.credito || ''} onChange={e => { const value = Number(e.target.value); setForm(current => ({ ...current, credito: value, debito: value > 0 ? 0 : current.debito })); }} className="input-lote disabled:bg-gray-100" /></Campo>
        <div className="sm:col-span-2 lg:col-span-3"><Campo label="Concepto"><textarea maxLength={50} rows={2} value={form.concepto} onChange={e => set('concepto', e.target.value)} className="input-lote" required /></Campo></div>
      </div>
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={guardando} className="rounded border px-4 py-2 text-xs">Cancelar</button><button data-save type="submit" disabled={guardando || cargandoCatalogos || (!form.debito && !form.credito)} className="rounded bg-[#0073C0] px-4 py-2 text-xs font-medium text-white disabled:bg-gray-300">{guardando ? 'Guardando…' : linea ? 'Guardar cambios' : 'Agregar partida'}</button></div>
    </form>
  </Modal>
    {crearTerceroAbierto && <CrearTerceroModal
      initialTerm={terceroSearch}
      onClose={() => setCrearTerceroAbierto(false)}
      onCreated={tercero => {
        seleccionarTercero(tercero);
        setCrearTerceroAbierto(false);
        setConfirmacion(`Tercero ${tercero.nit} creado y seleccionado.`);
      }}
    />}
    {terceroNoEncontrado && <ConfirmarCrearTerceroModal
      termino={terceroNoEncontrado}
      onCancel={() => setTerceroNoEncontrado(null)}
      onConfirm={() => {
        setTerceroNoEncontrado(null);
        setCrearTerceroAbierto(true);
      }}
    />}
  </>;
}
