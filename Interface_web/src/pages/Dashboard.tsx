import { useEffect, useState } from 'react';
import { consultarDocumentos, type DocumentoContable, type DocumentosResponse } from '../api/documentos';
import { consultarLotes, type LoteReal, type LotesResponse } from '../api/lotes';
import { consultarMovimientoMensual, type MovimientoMensualResponse } from '../api/movimientoMensual';
import { consultarPeriodoOperacion, type PeriodoOperacion } from '../api/periodoOperacion';
import type { NavPage } from '../components/Shell';
import type { CompaniaSesion } from '../types';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const fmtCOP = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 2,
}).format(value);

function mesInicial(periodo: PeriodoOperacion): number {
  const hoy = new Date();
  const habilitados = [...periodo.mesesHabilitados].filter(mes => mes >= 1 && mes <= 12).sort((a, b) => a - b);
  if (periodo.anio === hoy.getFullYear()) {
    return habilitados.filter(mes => mes <= hoy.getMonth() + 1).at(-1) ?? habilitados[0] ?? hoy.getMonth() + 1;
  }
  return habilitados.at(-1) ?? (Number(periodo.periodoSugerido.slice(-2)) || 1);
}

function esLotePendiente(lote: LoteReal): boolean {
  return !['Contabilizado', 'Anulado', 'Histórico'].includes(lote.estado);
}

function esLoteConProblema(lote: LoteReal): boolean {
  return esLotePendiente(lote) && (lote.estado === 'Con errores' || Math.abs(lote.diferencia) > 0.005);
}

function TarjetaIndicador({ titulo, valor, detalle, estado = 'normal', onClick }: {
  titulo: string;
  valor: string;
  detalle: string;
  estado?: 'normal' | 'alerta' | 'positivo';
  onClick?: () => void;
}) {
  const color = estado === 'alerta' ? 'text-red-700' : estado === 'positivo' ? 'text-green-700' : 'text-gray-800';
  const className = 'rounded border border-gray-200 bg-white px-4 py-3 text-left transition-colors';
  const content = <>
    <span className="block text-xs text-gray-500">{titulo}</span>
    <span className={`mt-1 block text-xl font-semibold tabular ${color}`}>{valor}</span>
    <span className="mt-1 block text-xs text-gray-500">{detalle}</span>
  </>;
  return onClick
    ? <button type="button" onClick={onClick} className={`${className} hover:border-petroleum-300 hover:bg-petroleum-50/30`}>{content}</button>
    : <div className={className}>{content}</div>;
}

function LotePendiente({ lote, onClick }: { lote: LoteReal; onClick: () => void }) {
  const problema = esLoteConProblema(lote);
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 last:border-b-0">
      <span className={`h-2 w-2 shrink-0 rounded-full ${problema ? 'bg-red-500' : lote.estado === 'Verificado' ? 'bg-blue-500' : 'bg-amber-500'}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-gray-800">{lote.lote} · {lote.nombre}</span>
        <span className="mt-0.5 block text-xs text-gray-500">{lote.items} partidas · Mes {lote.mes || 'sin definir'}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`block text-xs font-medium ${problema ? 'text-red-700' : 'text-gray-700'}`}>{lote.estado}</span>
        {Math.abs(lote.diferencia) > 0.005 && <span className="block text-xs text-red-600">Diferencia {fmtCOP(Math.abs(lote.diferencia))}</span>}
      </span>
    </button>
  );
}

function DocumentoReciente({ documento }: { documento: DocumentoContable }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-gray-100 px-4 py-3 text-xs last:border-b-0">
      <span className="font-mono text-gray-500">{documento.fecha}</span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-gray-800">{documento.tipoDocumento} {documento.documento} · {documento.comprobante}</span>
        <span className="block truncate text-gray-500">{documento.detalle || documento.tercero || 'Sin concepto'}</span>
      </span>
      <span className="whitespace-nowrap font-mono text-gray-700">{fmtCOP(documento.valor)}</span>
    </div>
  );
}

interface DashboardProps {
  cia: string;
  compania: CompaniaSesion;
  onNavigate: (page: NavPage) => void;
}

export default function Dashboard({ cia, compania, onNavigate }: DashboardProps) {
  const [periodo, setPeriodo] = useState<PeriodoOperacion | null>(null);
  const [mes, setMes] = useState(0);
  const [lotes, setLotes] = useState<LotesResponse | null>(null);
  const [documentos, setDocumentos] = useState<DocumentosResponse | null>(null);
  const [movimiento, setMovimiento] = useState<MovimientoMensualResponse | null>(null);
  const [cargandoPeriodo, setCargandoPeriodo] = useState(true);
  const [cargandoLotes, setCargandoLotes] = useState(true);
  const [cargandoMes, setCargandoMes] = useState(false);
  const [errorPeriodo, setErrorPeriodo] = useState('');
  const [errorLotes, setErrorLotes] = useState('');
  const [errorDocumentos, setErrorDocumentos] = useState('');
  const [errorMovimiento, setErrorMovimiento] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => { setMes(0); }, [cia]);

  // Los tres orígenes se cargan por separado: si uno falla, los otros datos
  // útiles permanecen visibles. CONDOCUM se consulta con un mes explícito,
  // como exige la misma pantalla de consulta de documentos.
  useEffect(() => {
    let vigente = true;
    setCargandoPeriodo(true);
    setErrorPeriodo('');
    consultarPeriodoOperacion(cia)
      .then(item => {
        if (!vigente) return;
        setPeriodo(item);
        setMes(actual => actual >= 1 && actual <= 12 ? actual : mesInicial(item));
      })
      .catch((error: unknown) => {
        if (vigente) {
          setPeriodo(null);
          setErrorPeriodo(error instanceof Error ? error.message : 'No fue posible obtener el período operativo.');
        }
      })
      .finally(() => { if (vigente) setCargandoPeriodo(false); });
    return () => { vigente = false; };
  }, [cia, recarga]);

  useEffect(() => {
    let vigente = true;
    setCargandoLotes(true);
    setErrorLotes('');
    setLotes(null);
    consultarLotes(cia, 1)
      .then(items => { if (vigente) setLotes(items); })
      .catch((error: unknown) => {
        if (vigente) setErrorLotes(error instanceof Error ? error.message : 'No fue posible cargar los lotes.');
      })
      .finally(() => { if (vigente) setCargandoLotes(false); });
    return () => { vigente = false; };
  }, [cia, recarga]);

  useEffect(() => {
    if (!periodo || mes < 1 || mes > 12) return;
    let vigente = true;
    setCargandoMes(true);
    setDocumentos(null);
    setMovimiento(null);
    setErrorDocumentos('');
    setErrorMovimiento('');
    const mesTexto = `${periodo.anio}-${String(mes).padStart(2, '0')}`;
    Promise.allSettled([
      consultarDocumentos({ cia, page: 1, pageSize: 5, periodo: mesTexto }),
      consultarMovimientoMensual({ cia, anio: periodo.anio, mes, page: 1, pageSize: 1 }),
    ]).then(([resultadoDocumentos, resultadoMovimiento]) => {
      if (!vigente) return;
      if (resultadoDocumentos.status === 'fulfilled') setDocumentos(resultadoDocumentos.value);
      else setErrorDocumentos(resultadoDocumentos.reason instanceof Error ? resultadoDocumentos.reason.message : 'No fue posible consultar los documentos.');
      if (resultadoMovimiento.status === 'fulfilled') setMovimiento(resultadoMovimiento.value);
      else setErrorMovimiento(resultadoMovimiento.reason instanceof Error ? resultadoMovimiento.reason.message : 'No fue posible consultar el movimiento.');
    }).finally(() => { if (vigente) setCargandoMes(false); });
    return () => { vigente = false; };
  }, [cia, periodo, mes, recarga]);

  const lotesVisibles = lotes?.items ?? [];
  const pendientes = lotesVisibles.filter(esLotePendiente);
  const conProblema = pendientes.filter(esLoteConProblema);
  const borradores = pendientes.filter(lote => lote.estado === 'Borrador' || lote.estado === 'Activo');
  const verificados = pendientes.filter(lote => lote.estado === 'Verificado');
  const diferenciaMes = movimiento ? Math.abs(movimiento.periodSaldo) : null;
  const pendientesOrdenados = [...pendientes].sort((a, b) =>
    Number(esLoteConProblema(b)) - Number(esLoteConProblema(a)) || a.lote.localeCompare(b.lote)
  );
  const tieneDatos = Boolean(periodo || lotes || documentos || movimiento);
  const periodoTexto = periodo && mes ? `${MESES[mes - 1]} de ${periodo.anio}` : 'Período por consultar';

  return (
    <div className="max-w-screen-2xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-petroleum-100 bg-petroleum-50 px-4 py-3">
        <div>
          <div className="text-xs text-petroleum-700">Panel de inicio · Compañía {compania.codigo}</div>
          <h1 className="text-lg font-semibold text-petroleum-900">{compania.nombre}</h1>
          <div className="mt-0.5 text-xs text-petroleum-700">Resumen operativo de {periodoTexto}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {periodo && <label className="flex items-center gap-2 text-xs text-gray-700">
            Mes
            <select aria-label="Mes del panel" value={mes} onChange={event => setMes(Number(event.target.value))} className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800">
              {MESES.map((nombre, index) => <option key={nombre} value={index + 1}>{nombre}</option>)}
            </select>
          </label>}
          <button type="button" onClick={() => setRecarga(value => value + 1)} className="rounded border border-petroleum-200 bg-white px-3 py-1.5 text-xs font-medium text-petroleum-700 hover:bg-petroleum-100">
            Actualizar datos
          </button>
        </div>
      </div>

      {(errorPeriodo || errorLotes || errorDocumentos || errorMovimiento) && <div role="alert" className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <span className="font-semibold">Algunos datos no están disponibles.</span>{' '}
        {[errorPeriodo, errorLotes, errorDocumentos, errorMovimiento].filter(Boolean).join(' ')}
        <button type="button" onClick={() => setRecarga(value => value + 1)} className="ml-2 font-semibold underline">Reintentar</button>
      </div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <TarjetaIndicador titulo="Documentos del mes" valor={documentos ? documentos.totalDocumentos.toLocaleString('es-CO') : '—'} detalle={cargandoMes ? 'Consultando…' : 'Contabilizados en el período'} onClick={() => onNavigate('consultas/documentos')} />
        <TarjetaIndicador titulo="Débitos del mes" valor={movimiento ? fmtCOP(movimiento.periodDebit) : '—'} detalle={cargandoMes ? 'Consultando…' : 'Movimiento contabilizado'} onClick={() => onNavigate('consultas/mensual')} />
        <TarjetaIndicador titulo="Créditos del mes" valor={movimiento ? fmtCOP(movimiento.periodCredit) : '—'} detalle={cargandoMes ? 'Consultando…' : 'Movimiento contabilizado'} onClick={() => onNavigate('consultas/mensual')} />
        <TarjetaIndicador titulo="Lotes por gestionar" valor={lotes ? `${pendientes.length}${lotes.hasMore ? '+' : ''}` : '—'} detalle={cargandoLotes ? 'Consultando…' : 'Pendientes de revisión o actualización'} onClick={() => onNavigate('movimientos/lotes')} />
        <TarjetaIndicador titulo="Lotes con problemas" valor={lotes ? `${conProblema.length}${lotes.hasMore ? '+' : ''}` : '—'} detalle={cargandoLotes ? 'Consultando…' : 'Con errores o descuadrados'} estado={conProblema.length ? 'alerta' : 'positivo'} onClick={() => onNavigate('movimientos/lotes')} />
      </div>

      {!tieneDatos && (cargandoPeriodo || cargandoLotes) && <div className="rounded border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">Preparando el resumen de la compañía…</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div><h2 className="text-sm font-semibold text-gray-800">Lotes que requieren atención</h2><p className="text-xs text-gray-500">Primero los que tienen errores o diferencias</p></div>
              <button type="button" onClick={() => onNavigate('movimientos/lotes')} className="text-xs font-medium text-petroleum-600 hover:underline">Ver lotes</button>
            </div>
            {cargandoLotes && <div className="px-4 py-6 text-center text-xs text-gray-500">Consultando lotes…</div>}
            {!cargandoLotes && !errorLotes && pendientesOrdenados.slice(0, 6).map(lote => <LotePendiente key={lote.id} lote={lote} onClick={() => onNavigate('movimientos/lotes')} />)}
            {!cargandoLotes && !errorLotes && pendientesOrdenados.length === 0 && <div className="px-4 py-6 text-center text-xs text-gray-500">No hay lotes pendientes en los registros consultados.</div>}
            {lotes?.hasMore && <div className="border-t border-gray-100 px-4 py-2 text-xs text-amber-700">Hay más lotes. Los indicadores muestran al menos los primeros 100; abra Lotes para revisar el resto.</div>}
          </section>

          <section className="rounded border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div><h2 className="text-sm font-semibold text-gray-800">Documentos recientes del mes</h2><p className="text-xs text-gray-500">Últimos documentos contabilizados en {periodoTexto.toLowerCase()}</p></div>
              <button type="button" onClick={() => onNavigate('consultas/documentos')} className="text-xs font-medium text-petroleum-600 hover:underline">Consultar documentos</button>
            </div>
            {cargandoMes && <div className="px-4 py-6 text-center text-xs text-gray-500">Consultando documentos…</div>}
            {!cargandoMes && documentos?.items.map(documento => <DocumentoReciente key={documento.id} documento={documento} />)}
            {!cargandoMes && documentos && documentos.items.length === 0 && <div className="px-4 py-6 text-center text-xs text-gray-500">No hay documentos contabilizados en este mes. Seleccione otro mes o registre un movimiento.</div>}
            {!cargandoMes && errorDocumentos && <div className="px-4 py-5 text-center text-xs text-gray-500">No se pudo mostrar la lista de documentos.</div>}
            {documentos && documentos.totalDocumentos > 0 && <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">{documentos.totalDocumentos.toLocaleString('es-CO')} documentos · Valor registrado: {fmtCOP(documentos.totalValor)}</div>}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3"><h2 className="text-sm font-semibold text-gray-800">Qué revisar hoy</h2></div>
            <div className="space-y-2 p-3">
              {conProblema.length > 0 && <button type="button" onClick={() => onNavigate('movimientos/lotes')} className="w-full rounded border border-red-100 bg-red-50 px-3 py-2 text-left text-xs text-red-800 hover:bg-red-100">Revisar {conProblema.length} lote(s) con errores o diferencia</button>}
              {verificados.length > 0 && <button type="button" onClick={() => onNavigate('movimientos/lotes')} className="w-full rounded border border-blue-100 bg-blue-50 px-3 py-2 text-left text-xs text-blue-800 hover:bg-blue-100">Actualizar {verificados.length} lote(s) verificados</button>}
              {borradores.length > 0 && <button type="button" onClick={() => onNavigate('movimientos/lotes')} className="w-full rounded border border-amber-100 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800 hover:bg-amber-100">Continuar o verificar {borradores.length} lote(s) en captura</button>}
              {diferenciaMes !== null && diferenciaMes > 0.005 && <button type="button" onClick={() => onNavigate('consultas/mensual')} className="w-full rounded border border-amber-100 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800 hover:bg-amber-100">Revisar diferencia de {fmtCOP(diferenciaMes)} en el movimiento del mes</button>}
              {!cargandoLotes && !cargandoMes && !errorLotes && !errorMovimiento && conProblema.length === 0 && verificados.length === 0 && borradores.length === 0 && (diferenciaMes === null || diferenciaMes <= 0.005) && <div className="px-2 py-4 text-center text-xs text-gray-500">No se detectaron pendientes en los datos consultados.</div>}
              {(cargandoLotes || cargandoMes) && <div className="px-2 py-3 text-center text-xs text-gray-500">Revisando pendientes…</div>}
            </div>
          </section>

          <section className="rounded border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3"><h2 className="text-sm font-semibold text-gray-800">Accesos frecuentes</h2></div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {([
                ['Captura directa', 'movimientos/captura'],
                ['Lotes', 'movimientos/lotes'],
                ['Documentos', 'consultas/documentos'],
                ['Movimiento mensual', 'consultas/mensual'],
                ['Plan de cuentas', 'config/plan-cuentas'],
                ['Informes', 'informes/documentos'],
              ] as Array<[string, NavPage]>).map(([titulo, destino]) => <button key={destino} type="button" onClick={() => onNavigate(destino)} className="rounded border border-gray-200 px-3 py-2.5 text-left text-xs font-medium text-gray-700 hover:border-petroleum-300 hover:bg-petroleum-50">{titulo}</button>)}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
