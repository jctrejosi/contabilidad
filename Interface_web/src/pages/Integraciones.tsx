import { useState } from 'react';

type EstadoModulo = 'Conectado' | 'Desconectado' | 'Bloqueado';

interface ModuloIntegracion {
  id: string;
  nombre: string;
  icono: string;
  descripcion: string;
  estado: EstadoModulo;
  ultimaSinc: string | null;
  nota?: string;
}

const MODULOS_INICIALES: ModuloIntegracion[] = [
  {
    id: 'facturacion',
    nombre: 'Facturación',
    icono: '🧾',
    descripcion: 'Interfaz de documentos electrónicos de venta y su relación con los pagos de terceros.',
    estado: 'Conectado',
    ultimaSinc: '2026-02-28 18:30',
  },
  {
    id: 'cartera',
    nombre: 'Cartera',
    icono: '💳',
    descripcion: 'Estado de la cartera de terceros: saldos, cupos y bloqueos del maestro compartido.',
    estado: 'Desconectado',
    ultimaSinc: '2026-02-15 08:12',
  },
  {
    id: 'inventario',
    nombre: 'Inventario',
    icono: '📦',
    descripcion: 'Referencia técnica del almacenamiento legado. No se usa en el flujo contable actual.',
    estado: 'Bloqueado',
    ultimaSinc: null,
    nota: 'Depende del almacenamiento legado, actualmente bloqueado.',
  },
  {
    id: 'cxp',
    nombre: 'Cuentas por pagar',
    icono: '🧮',
    descripcion: 'Obligaciones con proveedores y su conciliación contra comprobantes de egreso.',
    estado: 'Conectado',
    ultimaSinc: '2026-02-27 16:45',
  },
  {
    id: 'nomina-ext',
    nombre: 'Nómina externa',
    icono: '👥',
    descripcion: 'Interfaz de nómina, aportes y provisiones externas para generar lote de contabilización.',
    estado: 'Desconectado',
    ultimaSinc: null,
  },
];

function BadgeEstado({ estado }: { estado: EstadoModulo }) {
  const clases: Record<EstadoModulo, string> = {
    Conectado: 'bg-green-100 text-green-700',
    Desconectado: 'bg-gray-100 text-gray-600',
    Bloqueado: 'bg-amber-100 text-amber-700',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${clases[estado]}`}>{estado}</span>;
}

const VEHICULOS = [
  { placa: 'ABC-123', descripcion: 'Camioneta de reparto — área logística', estado: 'Activo' },
  { placa: 'DEF-456', descripcion: 'Moto de mensajería', estado: 'Activo' },
  { placa: 'GHI-789', descripcion: 'Vehículo directivo', estado: 'Inactivo' },
];

const ZONAS = [
  { codigo: 'ZN-NORTE', nombre: 'Zona norte', cobertura: 'Bogotá (norte), Chía' },
  { codigo: 'ZN-SUR', nombre: 'Zona sur', cobertura: 'Bogotá (sur), Soacha' },
  { codigo: 'ZN-MED', nombre: 'Zona Medellín', cobertura: 'Medellín, Itagüí' },
];

const EVENTOS = [
  { codigo: 'EV-001', nombre: 'Feria sectorial Bogotá', fecha: '2026-03-12' },
  { codigo: 'EV-002', nombre: 'Rueda de negocios Medellín', fecha: '2026-04-08' },
];

const CIUDADES = [
  { codigo: '11001', nombre: 'Bogotá D.C.', departamento: 'Cundinamarca' },
  { codigo: '05001', nombre: 'Medellín', departamento: 'Antioquia' },
  { codigo: '76001', nombre: 'Cali', departamento: 'Valle del Cauca' },
  { codigo: '25754', nombre: 'Chía', departamento: 'Cundinamarca' },
];

function fechaHora(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Integraciones() {
  const [modulos, setModulos] = useState<ModuloIntegracion[]>(MODULOS_INICIALES);
  const [busy, setBusy] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Record<string, { tipo: 'success' | 'error'; texto: string }>>({});
  const [showCompartidas, setShowCompartidas] = useState(false);

  function ejecutar(modulo: ModuloIntegracion, accion: 'probar' | 'sincronizar') {
    const clave = `${modulo.id}:${accion}`;
    setBusy(clave);
    setResultados(prev => {
      const next = { ...prev };
      delete next[modulo.id];
      return next;
    });
    window.setTimeout(() => {
      setBusy(null);
      if (accion === 'probar') {
        if (modulo.estado === 'Conectado') {
          setResultados(prev => ({ ...prev, [modulo.id]: { tipo: 'success', texto: `Conexión con ${modulo.nombre} verificada (simulado).` } }));
        } else if (modulo.estado === 'Bloqueado') {
          setResultados(prev => ({ ...prev, [modulo.id]: { tipo: 'error', texto: `${modulo.nombre}: no disponible — almacenamiento legado bloqueado.` } }));
        } else {
          setResultados(prev => ({ ...prev, [modulo.id]: { tipo: 'error', texto: `No se pudo establecer conexión con ${modulo.nombre}: servicio no disponible (simulado).` } }));
        }
      } else {
        setModulos(prev => prev.map(m => (m.id === modulo.id ? { ...m, ultimaSinc: fechaHora() } : m)));
        setResultados(prev => ({ ...prev, [modulo.id]: { tipo: 'success', texto: `Sincronización con ${modulo.nombre} completada (simulado).` } }));
      }
    }, 1000);
  }

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Administración / Integraciones</div>
          <h1 className="text-lg font-semibold text-gray-800">Integraciones</h1>
          <p className="mt-1 text-xs text-gray-500">Conexiones con módulos externos, estado de sincronización y funciones compartidas de referencia.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {/* Banner almacenamiento legado */}
      <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="text-base leading-none mt-0.5">⚠</span>
          <div>
            <div className="text-xs font-semibold text-amber-800">Almacenamiento legado bloqueado</div>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              Las tablas del almacenamiento legado están en solo lectura. La sincronización y la conexión con los módulos que dependen de él
              (Inventario) están temporalmente indisponibles. El resto de módulos contables no se ven afectados.
            </p>
          </div>
        </div>
      </div>

      {/* Tarjetas de módulos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {modulos.map(m => {
          const resultado = resultados[m.id];
          const probando = busy === `${m.id}:probar`;
          const sincronizando = busy === `${m.id}:sincronizar`;
          return (
            <div key={m.id} className="bg-white rounded border border-gray-200 p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{m.icono}</span>
                  <h2 className="text-sm font-semibold text-gray-800">{m.nombre}</h2>
                </div>
                <BadgeEstado estado={m.estado} />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{m.descripcion}</p>
              <div className="text-xs text-gray-500">
                Última sincronización: <span className="font-mono text-gray-700">{m.ultimaSinc ?? '—'}</span>
              </div>
              {m.nota && <div className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">{m.nota}</div>}
              {resultado && (
                <div className={`rounded px-2.5 py-1.5 text-xs ${resultado.tipo === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {resultado.texto}
                </div>
              )}
              <div className="mt-auto flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => ejecutar(m, 'probar')}
                  disabled={!!busy}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  {probando ? '⏳ Probando…' : 'Probar conexión'}
                </button>
                <button
                  type="button"
                  onClick={() => ejecutar(m, 'sincronizar')}
                  disabled={!!busy || m.estado === 'Bloqueado'}
                  className="text-xs px-3 py-1.5 rounded bg-petroleum-500 text-white font-medium hover:bg-petroleum-600 disabled:opacity-50"
                >
                  {sincronizando ? '⏳ Sincronizando…' : 'Sincronizar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Funciones compartidas */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCompartidas(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
        >
          <div>
            <h2 className="text-xs font-semibold text-gray-700">Funciones compartidas de referencia técnica (no enlazadas al menú contable)</h2>
            <p className="text-xs text-gray-400 mt-0.5">Vehículos, zonas, eventos y ciudades — información de referencia del sistema.</p>
          </div>
          <span className="text-gray-400 text-sm">{showCompartidas ? '▴' : '▾'}</span>
        </button>

        {showCompartidas && (
          <div className="border-t border-gray-100 p-4 space-y-4">
            <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">
              Aclaración: la <strong>ciudad</strong> y la <strong>zona</strong> sí forman parte del maestro de terceros del módulo contable
              (campo <span className="font-mono">ciudad</span> en TERCEROS). Vehículos y eventos son funciones compartidas de referencia
              técnica, no enlazadas al menú contable. Nada de lo aquí mostrado genera flujos contables.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-700">🚗 Vehículos</div>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-gray-50">
                    {VEHICULOS.map(v => (
                      <tr key={v.placa} className="hoverable">
                        <td className="px-3 py-2 font-mono text-gray-700">{v.placa}</td>
                        <td className="px-3 py-2 text-gray-600">{v.descripcion}</td>
                        <td className="px-3 py-2 text-gray-500">{v.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-700">🗺 Zonas</div>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-gray-50">
                    {ZONAS.map(z => (
                      <tr key={z.codigo} className="hoverable">
                        <td className="px-3 py-2 font-mono text-gray-700">{z.codigo}</td>
                        <td className="px-3 py-2 text-gray-600">{z.nombre}</td>
                        <td className="px-3 py-2 text-gray-500">{z.cobertura}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-700">📅 Eventos</div>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-gray-50">
                    {EVENTOS.map(ev => (
                      <tr key={ev.codigo} className="hoverable">
                        <td className="px-3 py-2 font-mono text-gray-700">{ev.codigo}</td>
                        <td className="px-3 py-2 text-gray-600">{ev.nombre}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{ev.fecha}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-700">🏙 Ciudades (código DIAN)</div>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-gray-50">
                    {CIUDADES.map(c => (
                      <tr key={c.codigo} className="hoverable">
                        <td className="px-3 py-2 font-mono text-gray-700">{c.codigo}</td>
                        <td className="px-3 py-2 text-gray-600">{c.nombre}</td>
                        <td className="px-3 py-2 text-gray-500">{c.departamento}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
