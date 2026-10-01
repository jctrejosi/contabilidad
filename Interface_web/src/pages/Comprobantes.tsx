import { useEffect, useMemo, useState } from 'react';
import { listarComprobantes, type ComprobanteReal } from '../api/comprobantes';

function exportarCSV(comprobantes: ComprobanteReal[], cia: string) {
  const filas = [
    ['Compañía', 'Código', 'Nombre', 'Indicador histórico', 'Descripción auxiliar'],
    ...comprobantes.map(comprobante => [
      cia,
      comprobante.codigo,
      comprobante.nombre,
      comprobante.hist,
      comprobante.descripcionAuxiliar,
    ]),
  ];
  const csv = filas.map(fila => fila.map(value => `"${value.replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `comprobantes-cia-${cia}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}

interface ComprobantesProps {
  /** Código de la compañía seleccionada al ingresar a la aplicación. */
  cia: string;
}

export default function Comprobantes({ cia }: ComprobantesProps) {
  const [comprobantes, setComprobantes] = useState<ComprobanteReal[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    setComprobantes([]);
    setBusqueda('');
    setCargando(true);
    setError('');
    listarComprobantes(cia)
      .then(response => { if (vigente) setComprobantes(response.items); })
      .catch((cause: unknown) => {
        if (vigente) setError(cause instanceof Error ? cause.message : 'No fue posible consultar CONTICOM.');
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [cia]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es');
    if (!termino) return comprobantes;
    return comprobantes.filter(comprobante =>
      comprobante.codigo.toLocaleLowerCase('es').includes(termino)
      || comprobante.nombre.toLocaleLowerCase('es').includes(termino)
      || comprobante.descripcionAuxiliar.toLocaleLowerCase('es').includes(termino));
  }, [busqueda, comprobantes]);

  return (
    <div className="max-w-screen-2xl space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Comprobantes</div>
          <h1 className="text-lg font-semibold text-gray-800">Comprobantes contables</h1>
          <p className="mt-1 text-xs text-gray-500">Catálogo CONTICOM exclusivo de la compañía {cia}, usado para clasificar los asientos contables.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Advantage · CIA {cia} · {comprobantes.length} comprobantes</span>
      </div>

      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white p-3">
        <input type="search" aria-label="Buscar comprobantes" placeholder="Buscar por código o nombre..." value={busqueda} onChange={event => setBusqueda(event.target.value)} className="w-72 rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1" />
        <span className="text-xs text-gray-500">{filtrados.length} de {comprobantes.length}</span>
        <button type="button" disabled={!filtrados.length} onClick={() => exportarCSV(filtrados, cia)} className="ml-auto rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">↓ Exportar CSV</button>
        <button type="button" disabled title="Se habilitará después de validar movimientos, tipos documentales y auditoría." className="cursor-not-allowed rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white opacity-50">+ Crear comprobante</button>
      </div>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-gray-200 bg-gray-50"><tr>
              <th className="w-28 px-3 py-2.5 text-left font-semibold text-gray-600">Código</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
              <th className="w-36 px-3 py-2.5 text-center font-semibold text-gray-600">Histórico</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Descripción auxiliar</th>
              <th className="w-32 px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {cargando && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">Consultando CONTICOM para la compañía {cia}…</td></tr>}
              {!cargando && !error && filtrados.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">{comprobantes.length ? 'No hay comprobantes que coincidan con la búsqueda.' : `La compañía ${cia} no tiene comprobantes registrados.`}</td></tr>}
              {!cargando && filtrados.map(comprobante => <tr key={`${cia}-${comprobante.codigo}`} className="hoverable">
                <td className="px-3 py-2.5 font-mono font-semibold text-gray-800">{comprobante.codigo}</td>
                <td className="px-3 py-2.5 text-gray-700">{comprobante.nombre || '—'}</td>
                <td className="px-3 py-2.5 text-center">{comprobante.historico ? <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">Sí ({comprobante.hist})</span> : <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2.5 text-gray-600">{comprobante.descripcionAuxiliar || '—'}</td>
                <td className="px-3 py-2.5 text-gray-400" title="Alta, edición y eliminación pendientes de validar referencias contables.">Solo consulta</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">{filtrados.length} comprobante{filtrados.length !== 1 ? 's' : ''} · clave (CIA, CODIGO)</div>
      </div>
    </div>
  );
}
