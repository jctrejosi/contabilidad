import { useEffect, useMemo, useState } from 'react';
import { listarCentros } from '../api/centros';
import { centrosHijos, type CentroJerarquico } from '../data/configCentros';

/** Ordena una lista jerárquica fija: cada padre aparece antes de sus hijos. */
function ordenarJerarquico(centros: CentroJerarquico[]): CentroJerarquico[] {
  const porPadre = new Map<string, CentroJerarquico[]>();
  for (const centro of centros) {
    const grupo = porPadre.get(centro.padre) ?? [];
    grupo.push(centro);
    porPadre.set(centro.padre, grupo);
  }
  for (const grupo of porPadre.values()) grupo.sort((a, b) => a.codigo.localeCompare(b.codigo));

  const resultado: CentroJerarquico[] = [];
  const vistos = new Set<string>();
  const visitar = (centro: CentroJerarquico) => {
    if (vistos.has(centro.codigo)) return;
    vistos.add(centro.codigo);
    resultado.push(centro);
    for (const hijo of porPadre.get(centro.codigo) ?? []) visitar(hijo);
  };
  for (const raiz of porPadre.get('') ?? []) visitar(raiz);
  // Conserva incluso filas heredadas anómalas para que ninguna se oculte.
  for (const centro of centros) visitar(centro);
  return resultado;
}

function exportarCSV(centros: CentroJerarquico[], cia: string) {
  const filas = [
    ['Compañía', 'Código', 'Nombre', 'Nivel', 'Padre', 'Carpeta', 'Tipo', 'Habilita'],
    ...centros.map(c => [
      cia, c.codigo, c.nombre, String(c.nivel), c.padre || '', c.carpeta || '',
      String(c.tipo ?? ''),
      c.habilita === null || c.habilita === undefined ? '' : c.habilita ? 'Sí' : 'No',
    ]),
  ];
  const csv = filas.map(fila => fila.map(valor => `"${valor.replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `centros-costo-cia-${cia}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}

function estadoCentro(habilita: boolean | null | undefined) {
  if (habilita === true) return { texto: 'Habilitado', clase: 'bg-green-50 text-green-700' };
  if (habilita === false) return { texto: 'No habilitado', clase: 'bg-gray-100 text-gray-600' };
  return { texto: 'Sin definir', clase: 'bg-amber-50 text-amber-700' };
}

interface CentrosProps {
  /** Código de la compañía seleccionada al ingresar a la aplicación. */
  cia: string;
}

export default function Centros({ cia }: CentrosProps) {
  const [centros, setCentros] = useState<CentroJerarquico[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    setCentros([]);
    listarCentros(cia)
      .then(respuesta => { if (vigente) setCentros(respuesta.items); })
      .catch((cause: unknown) => {
        if (vigente) setError(cause instanceof Error ? cause.message : 'No fue posible consultar CONCECOS.');
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [cia]);

  const ordenados = useMemo(() => ordenarJerarquico(centros), [centros]);
  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es');
    if (!termino) return ordenados;
    const visibles = new Set<string>();
    for (const centro of centros) {
      const coincide = centro.codigo.toLocaleLowerCase('es').includes(termino)
        || centro.nombre.toLocaleLowerCase('es').includes(termino)
        || (centro.carpeta ?? '').toLocaleLowerCase('es').includes(termino);
      if (coincide) {
        visibles.add(centro.codigo);
        if (centro.padre) visibles.add(centro.padre);
      }
    }
    return ordenados.filter(centro => visibles.has(centro.codigo));
  }, [busqueda, centros, ordenados]);

  const raices = centros.filter(centro => centro.nivel === 1).length;

  return (
    <div className="max-w-screen-2xl space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Centros de costo</div>
          <h1 className="text-lg font-semibold text-gray-800">Centros de costo</h1>
          <p className="mt-1 text-xs text-gray-500">Catálogo CONCECOS de la compañía {cia}. La jerarquía se muestra completa y no se puede contraer.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">
          Advantage · CIA {cia} · {centros.length} centros
        </span>
      </div>

      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white p-3">
        <input type="search" aria-label="Buscar centros de costo" placeholder="Buscar por código, nombre o carpeta..." value={busqueda} onChange={event => setBusqueda(event.target.value)} className="w-72 rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1" />
        <span className="text-xs text-gray-500">{centros.length} centros · {raices} raíces</span>
        <button type="button" disabled={!centros.length} onClick={() => exportarCSV(ordenados, cia)} className="ml-auto rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">↓ Exportar CSV</button>
        <button type="button" disabled title="Se habilitará después de validar las reglas de escritura en Advantage." className="cursor-not-allowed rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white opacity-50">+ Crear centro</button>
      </div>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-gray-200 bg-gray-50"><tr>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Código</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Nivel</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Padre</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Carpeta</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Tipo</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Estado</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Hijos</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {cargando && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-500">Consultando CONCECOS para la compañía {cia}…</td></tr>}
              {!cargando && !error && filtrados.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-500">{centros.length ? 'No hay centros que coincidan con la búsqueda.' : `La compañía ${cia} no tiene centros de costo registrados.`}</td></tr>}
              {!cargando && filtrados.map(centro => {
                const estado = estadoCentro(centro.habilita);
                const hijos = centrosHijos(centro.codigo, centros).length;
                const sangria = centro.nivel === 2 ? 20 : 0;
                return <tr key={`${cia}-${centro.codigo}`} className="hoverable">
                  <td className="px-3 py-2.5" style={{ paddingLeft: `${12 + sangria}px` }}><span className={`font-mono ${centro.nivel === 1 ? 'font-bold text-gray-800' : 'text-gray-600'}`}>{centro.nivel === 2 && <span aria-hidden="true" className="mr-2 text-gray-300">└</span>}{centro.codigo}</span></td>
                  <td className="px-3 py-2.5 text-gray-700">{centro.nombre || '—'}</td>
                  <td className="px-3 py-2.5 text-center"><span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">{centro.nivel}</span></td>
                  <td className="px-3 py-2.5 font-mono text-gray-500">{centro.padre || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600">{centro.carpeta || '—'}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-gray-600">{centro.tipo ?? '—'}</td>
                  <td className="px-3 py-2.5 text-center"><span className={`rounded-full px-2 py-0.5 ${estado.clase}`}>{estado.texto}</span></td>
                  <td className="px-3 py-2.5 text-center font-mono text-gray-600">{hijos || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-400" title="Alta, edición y eliminación pendientes de validación de integridad.">Solo consulta</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">{filtrados.length} centro{filtrados.length !== 1 ? 's' : ''} mostrado{filtrados.length !== 1 ? 's' : ''} en orden jerárquico</div>
      </div>
    </div>
  );
}
