import { useEffect, useMemo, useState } from 'react';
import { listarTiposDocumento, type TipoDocumentoReal } from '../api/tiposDocumento';

type FiltroModulo = 'todos' | '1' | '2' | '3' | '9' | 'otros';

const OPCIONES_MODULO: Array<{ valor: FiltroModulo; etiqueta: string }> = [
  { valor: 'todos', etiqueta: 'Todos los módulos' },
  { valor: '1', etiqueta: 'Cartera' },
  { valor: '2', etiqueta: 'Inventarios' },
  { valor: '3', etiqueta: 'Cuentas por pagar' },
  { valor: '9', etiqueta: 'Contabilidad' },
  { valor: 'otros', etiqueta: 'No reconocidos' },
];

function marca(value: boolean | null) {
  if (value === true) return <span className="font-semibold text-blue-600">✓</span>;
  if (value === null) return <span className="text-amber-500" title="El valor está vacío en VISDOCUM">?</span>;
  return <span className="text-gray-200">—</span>;
}

function exportarCSV(tipos: TipoDocumentoReal[]) {
  const filas = [
    ['Código', 'Nombre', 'Módulo', 'Tipo', 'Consecutivo', 'Permite modificar consecutivo', 'Prefijo', 'Comprobante', 'Contabiliza', 'Cuentas por pagar', 'Bancos', 'Convierte a'],
    ...tipos.map(tipo => [
      tipo.codigo,
      tipo.nombre,
      `${tipo.modulo} - ${tipo.nombreModulo}`,
      tipo.tipo,
      String(tipo.consecutivo),
      tipo.permiteModificarConsecutivo === null ? '' : tipo.permiteModificarConsecutivo ? 'Sí' : 'No',
      tipo.prefijo,
      tipo.comprobante,
      tipo.contabiliza === null ? '' : tipo.contabiliza ? 'Sí' : 'No',
      tipo.generaCuentasPorPagar === null ? '' : tipo.generaCuentasPorPagar ? 'Sí' : 'No',
      tipo.afectaBancos === null ? '' : tipo.afectaBancos ? 'Sí' : 'No',
      tipo.convierteDocumento ? tipo.documentoConversion : '',
    ]),
  ];
  const csv = filas.map(fila => fila.map(value => `"${value.replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'tipos-documento-globales.csv';
  enlace.click();
  URL.revokeObjectURL(url);
}

export default function TiposDocumento() {
  const [tipos, setTipos] = useState<TipoDocumentoReal[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroModulo, setFiltroModulo] = useState<FiltroModulo>('todos');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    listarTiposDocumento()
      .then(response => { if (vigente) setTipos(response.items); })
      .catch((cause: unknown) => {
        if (vigente) setError(cause instanceof Error ? cause.message : 'No fue posible consultar VISDOCUM.');
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es');
    return tipos.filter(tipo => {
      if (filtroModulo === 'otros' && [1, 2, 3, 9].includes(tipo.modulo)) return false;
      if (filtroModulo !== 'todos' && filtroModulo !== 'otros' && tipo.modulo !== Number(filtroModulo)) return false;
      if (!termino) return true;
      return tipo.codigo.toLocaleLowerCase('es').includes(termino)
        || tipo.nombre.toLocaleLowerCase('es').includes(termino)
        || tipo.tipo.toLocaleLowerCase('es').includes(termino)
        || tipo.nombreModulo.toLocaleLowerCase('es').includes(termino)
        || tipo.comprobante.toLocaleLowerCase('es').includes(termino);
    });
  }, [busqueda, filtroModulo, tipos]);

  return (
    <div className="max-w-screen-2xl space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Tipos de documento</div>
          <h1 className="text-lg font-semibold text-gray-800">Tipos de documento</h1>
          <p className="mt-1 text-xs text-gray-500">Reglas globales de Cartera, Inventarios, Cuentas por pagar y Contabilidad.</p>
        </div>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">Advantage · VISDOCUM · Global · {tipos.length} tipos</span>
      </div>

      <div className="rounded border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        Este catálogo se comparte entre todas las compañías. Cambiar de compañía no cambia ni duplica sus registros.
      </div>
      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white p-3">
        <input type="search" aria-label="Buscar tipos de documento" placeholder="Buscar código, nombre, tipo o comprobante..." value={busqueda} onChange={event => setBusqueda(event.target.value)} className="w-80 rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1" />
        <label htmlFor="filtro-modulo" className="sr-only">Filtrar por módulo</label>
        <select id="filtro-modulo" value={filtroModulo} onChange={event => setFiltroModulo(event.target.value as FiltroModulo)} className="rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700">
          {OPCIONES_MODULO.map(opcion => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>)}
        </select>
        <span className="text-xs text-gray-500">{filtrados.length} de {tipos.length}</span>
        <button type="button" disabled={!filtrados.length} onClick={() => exportarCSV(filtrados)} className="ml-auto rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">↓ Exportar CSV</button>
        <button type="button" disabled title="Se habilitará después de validar todas las reglas y dependencias de VISDOCUM." className="cursor-not-allowed rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white opacity-50">+ Crear tipo</button>
      </div>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full min-w-[1100px] text-xs">
            <thead className="border-b border-gray-200 bg-gray-50"><tr>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Código</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Módulo</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Tipo</th>
              <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Consecutivo</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Consec. editable</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Prefijo</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Comprobante</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Contabiliza</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Convierte</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {cargando && <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-500">Consultando el catálogo global VISDOCUM…</td></tr>}
              {!cargando && !error && filtrados.length === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-500">No hay tipos que coincidan con los filtros.</td></tr>}
              {!cargando && filtrados.map(tipo => <tr key={tipo.id || tipo.codigo} className="hoverable">
                <td className="px-3 py-2.5 font-mono font-semibold text-gray-800">{tipo.codigo}</td>
                <td className="px-3 py-2.5 text-gray-700">{tipo.nombre}</td>
                <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 font-medium ${[1, 2, 3, 9].includes(tipo.modulo) ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{tipo.modulo} · {tipo.nombreModulo}</span></td>
                <td className="px-3 py-2.5 text-gray-600">{tipo.tipo || '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-700">{tipo.consecutivo.toLocaleString('es-CO')}</td>
                <td className="px-3 py-2.5 text-center">{marca(tipo.permiteModificarConsecutivo)}</td>
                <td className="px-3 py-2.5 font-mono text-gray-600">{tipo.prefijo || '—'}</td>
                <td className="px-3 py-2.5 font-mono text-gray-600">{tipo.comprobante || '—'}</td>
                <td className="px-3 py-2.5 text-center">{marca(tipo.contabiliza)}</td>
                <td className="px-3 py-2.5 text-center">{tipo.convierteDocumento ? <span className="font-mono text-blue-600">→ {tipo.documentoConversion || '?'}</span> : marca(tipo.convierteDocumento)}</td>
                <td className="px-3 py-2.5 text-gray-400" title="Alta, edición y eliminación pendientes de validar las 89 columnas y sus referencias.">Solo consulta</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">{filtrados.length} tipo{filtrados.length !== 1 ? 's' : ''} de documento · catálogo compartido</div>
      </div>
    </div>
  );
}
