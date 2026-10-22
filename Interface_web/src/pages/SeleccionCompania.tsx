import { useEffect, useMemo, useState } from 'react';
import { listarCompanias } from '../api/companias';
import type { CompaniaSesion } from '../types';

interface SeleccionCompaniaProps {
  onSelect: (compania: CompaniaSesion) => void;
}

/**
 * Puerta de entrada al sistema contable.
 *
 * La compañía no es un filtro opcional: define el ámbito de datos de toda la
 * sesión. El código seleccionado se enviará al backend como CIA en cada
 * consulta o escritura que se implemente contra las tablas contables.
 */
export default function SeleccionCompania({ onSelect }: SeleccionCompaniaProps) {
  const [companias, setCompanias] = useState<CompaniaSesion[]>([]);
  const [seleccionada, setSeleccionada] = useState<string>('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const items = await listarCompanias();
      setCompanias(items);
      // Se destaca la vigente, pero el usuario debe confirmar expresamente el ingreso.
      setSeleccionada(items.find(item => item.habilitada)?.codigo ?? items[0]?.codigo ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar las compañías.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es');
    if (!texto) return companias;
    return companias.filter(compania =>
      compania.codigo.includes(texto)
      || compania.nombre.toLocaleLowerCase('es').includes(texto)
      || compania.nit.toLocaleLowerCase('es').includes(texto)
    );
  }, [busqueda, companias]);

  const companiaSeleccionada = companias.find(item => item.codigo === seleccionada) ?? null;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl lg:grid-cols-[21rem_1fr]">
          <aside className="flex flex-col justify-between bg-[#001F4C] p-8 text-white">
            <div>
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <img
                  src={`${import.meta.env.BASE_URL}dsi-logo.svg`}
                  alt="DSI S.A."
                  width={176}
                  height={51}
                  className="mx-auto h-auto w-44 object-contain"
                />
              </div>
              <h1 className="mt-8 text-2xl font-semibold">CONTABDSI</h1>
              <p className="mt-1 text-sm text-cyan-200">Contabilidad General</p>
              <p className="mt-8 text-sm leading-6 text-slate-200">
                Seleccione la compañía antes de ingresar. Esta elección determina qué información contable podrá consultar y modificar.
              </p>
            </div>
            <div className="mt-10 rounded-lg border border-white/15 bg-white/5 p-4 text-xs leading-5 text-slate-300">
              Los datos se consultan directamente desde la tabla de compañías CONEMP.
            </div>
          </aside>

          <div className="p-6 sm:p-8">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#0073C0]">Acceso al sistema</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-800">Seleccione la compañía</h2>
              <p className="mt-1 text-sm text-slate-500">El Plan de cuentas mostrará únicamente los registros asociados a este código.</p>
            </div>

            <label htmlFor="buscar-compania" className="mb-1 block text-xs font-medium text-slate-600">Buscar compañía</label>
            <input
              id="buscar-compania"
              value={busqueda}
              onChange={event => setBusqueda(event.target.value)}
              placeholder="Código, nombre o NIT"
              disabled={cargando || !!error}
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#0073C0] focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
            />

            {cargando && (
              <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500">
                Consultando compañías en CONEMP…
              </div>
            )}

            {error && (
              <div role="alert" className="flex h-64 flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 px-6 text-center">
                <p className="text-sm text-red-700">{error}</p>
                <button type="button" onClick={cargar} className="mt-4 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
                  Reintentar
                </button>
              </div>
            )}

            {!cargando && !error && (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200" role="radiogroup" aria-label="Compañías disponibles">
                {visibles.map(compania => {
                  const activa = compania.codigo === seleccionada;
                  return (
                    <button
                      key={compania.codigo}
                      type="button"
                      role="radio"
                      aria-checked={activa}
                      onClick={() => setSeleccionada(compania.codigo)}
                      onDoubleClick={() => onSelect(compania)}
                      className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 ${activa ? 'bg-sky-50 ring-1 ring-inset ring-[#0073C0]' : 'hover:bg-slate-50'}`}
                    >
                      <span className={`flex h-8 w-12 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold ${activa ? 'bg-[#0073C0] text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {compania.codigo}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-slate-800">{compania.nombre}</span>
                          {compania.habilitada && <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Vigente</span>}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">NIT {compania.nit || 'No registrado'}</span>
                      </span>
                      <span aria-hidden="true" className={activa ? 'text-[#0073C0]' : 'text-slate-300'}>{activa ? '●' : '○'}</span>
                    </button>
                  );
                })}
                {visibles.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No se encontraron compañías.</p>}
              </div>
            )}

            <div className="mt-6 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <p className="min-w-0 text-xs text-slate-500">
                {companiaSeleccionada ? <>Seleccionada: <strong className="text-slate-700">{companiaSeleccionada.codigo} · {companiaSeleccionada.nombre}</strong></> : 'Seleccione una compañía para continuar.'}
              </p>
              <button
                type="button"
                disabled={!companiaSeleccionada || cargando || !!error}
                onClick={() => companiaSeleccionada && onSelect(companiaSeleccionada)}
                className="shrink-0 rounded-lg bg-[#0073C0] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#005f9e] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Ingresar a la compañía
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
