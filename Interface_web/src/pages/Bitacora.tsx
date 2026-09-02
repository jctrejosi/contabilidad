import { useState } from 'react';

interface EventoBitacora {
  id: string;
  fecha: string;
  usuario: string;
  rol: string;
  accion: string;
  modulo: string;
  detalle: string;
  resultado: 'EXITO' | 'FALLO' | 'INFO';
}

const EVENTOS: EventoBitacora[] = [
  { id: 'E01', fecha: '2026-02-20 09:14', usuario: 'Laura Gómez', rol: 'Contador principal', accion: 'Creación de lote', modulo: 'Lotes', detalle: 'Lote NOM2 «Nómina febrero 2026» creado con 12 líneas', resultado: 'EXITO' },
  { id: 'E02', fecha: '2026-02-20 09:16', usuario: 'Laura Gómez', rol: 'Contador principal', accion: 'Validación de lote', modulo: 'Lotes', detalle: 'Validación NOM2: 2 errores detectados — L01 sin tercero (NIT), L03 sin centro de costo', resultado: 'FALLO' },
  { id: 'E03', fecha: '2026-02-20 09:22', usuario: 'Carlos Pérez', rol: 'Auxiliar contable', accion: 'Corrección de línea', modulo: 'Lotes', detalle: 'Línea L01 corregida: tercero asignado García Moreno Juan Pablo (12.345.678)', resultado: 'EXITO' },
  { id: 'E04', fecha: '2026-02-20 09:25', usuario: 'Carlos Pérez', rol: 'Auxiliar contable', accion: 'Corrección de línea', modulo: 'Lotes', detalle: 'Línea L03 corregida: centro de costo OPE asignado', resultado: 'EXITO' },
  { id: 'E05', fecha: '2026-02-20 09:30', usuario: 'Laura Gómez', rol: 'Contador principal', accion: 'Verificación de lote', modulo: 'Lotes', detalle: 'NOM2 verificado: 12 líneas, débito 12.600.000 = crédito 12.600.000, 0 errores', resultado: 'EXITO' },
  { id: 'E06', fecha: '2026-02-20 09:32', usuario: 'Laura Gómez', rol: 'Contador principal', accion: 'Envío a aprobación', modulo: 'Lotes', detalle: 'Lote NOM2 enviado a aprobación', resultado: 'EXITO' },
  { id: 'E07', fecha: '2026-02-20 10:05', usuario: 'María del Pilar Restrepo', rol: 'Administrador', accion: 'Aprobación de lote', modulo: 'Lotes', detalle: 'Lote NOM2 aprobado para contabilización', resultado: 'EXITO' },
  { id: 'E08', fecha: '2026-02-20 10:06', usuario: 'Laura Gómez', rol: 'Contador principal', accion: 'Contabilización', modulo: 'Contabilización', detalle: 'Contabilizado CE-000245 / NOM-2026-02: 12.600.000 débito = 12.600.000 crédito', resultado: 'EXITO' },
  { id: 'E09', fecha: '2026-02-15 11:40', usuario: 'Carlos Pérez', rol: 'Auxiliar contable', accion: 'Importación de movimientos', modulo: 'Importaciones', detalle: 'IMP-01: 45 líneas leídas, 3 rechazadas por NIT inválido', resultado: 'FALLO' },
  { id: 'E10', fecha: '2026-02-14 10:12', usuario: 'Laura Gómez', rol: 'Contador principal', accion: 'Generación de informe', modulo: 'Informes', detalle: 'Balance de comprobación acumulado 2026-02 generado en PDF', resultado: 'EXITO' },
  { id: 'E11', fecha: '2026-02-25 16:45', usuario: 'María del Pilar Restrepo', rol: 'Administrador', accion: 'Cambio de permisos', modulo: 'Administración', detalle: 'Permiso «aprobar» retirado al rol Auxiliar contable', resultado: 'EXITO' },
  { id: 'E12', fecha: '2026-02-28 08:30', usuario: 'Ana Torres', rol: 'Analista tributario', accion: 'Acumulación de retenciones', modulo: 'Impuestos', detalle: 'Acumulado de retenciones período 2026-02 generado (cuenta 236540)', resultado: 'EXITO' },
  { id: 'E13', fecha: '2026-02-12 15:00', usuario: 'Sistema', rol: 'Sistema', accion: 'Sincronización', modulo: 'Integraciones', detalle: 'Sincronización con Facturación falló: almacenamiento legado bloqueado', resultado: 'FALLO' },
  { id: 'E14', fecha: '2026-03-01 14:20', usuario: 'Pedro Ruiz', rol: 'Auditor', accion: 'Consulta de bitácora', modulo: 'Auditoría', detalle: 'Acceso de solo lectura al historial de eventos', resultado: 'INFO' },
];

function BadgeResultado({ resultado }: { resultado: EventoBitacora['resultado'] }) {
  const clases: Record<EventoBitacora['resultado'], string> = {
    EXITO: 'bg-green-100 text-green-700',
    FALLO: 'bg-red-100 text-red-700',
    INFO: 'bg-blue-100 text-blue-700',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${clases[resultado]}`}>{resultado}</span>;
}

export default function Bitacora() {
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroModulo, setFiltroModulo] = useState('');
  const [filtroResultado, setFiltroResultado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [exportando, setExportando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const usuarios = [...new Set(EVENTOS.map(e => e.usuario))].sort();
  const modulos = [...new Set(EVENTOS.map(e => e.modulo))].sort();

  const filtrados = EVENTOS.filter(e =>
    (!filtroUsuario || e.usuario === filtroUsuario) &&
    (!filtroModulo || e.modulo === filtroModulo) &&
    (!filtroResultado || e.resultado === filtroResultado) &&
    (!busqueda || e.detalle.toLowerCase().includes(busqueda.toLowerCase()) || e.accion.toLowerCase().includes(busqueda.toLowerCase()))
  );

  function exportarXLSX() {
    setExportando(true);
    setMensaje(null);
    window.setTimeout(() => {
      setExportando(false);
      setMensaje('Archivo bitacora-2026-02.xlsx generado (simulado).');
    }, 1000);
  }

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Administración / Bitácora</div>
          <h1 className="text-lg font-semibold text-gray-800">Bitácora de auditoría</h1>
          <p className="mt-1 text-xs text-gray-500">Registro inmutable de las acciones del sistema — usuario, módulo, detalle y resultado.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded border border-gray-200 p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">⌕</span>
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar en acción o detalle..."
              className="w-64 pl-7 pr-3 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-petroleum-500"
            />
          </div>
          <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none">
            <option value="">Todos los usuarios</option>
            {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <select value={filtroModulo} onChange={e => setFiltroModulo(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none">
            <option value="">Todos los módulos</option>
            {modulos.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filtroResultado} onChange={e => setFiltroResultado(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none">
            <option value="">Todos los resultados</option>
            <option value="EXITO">EXITO</option>
            <option value="FALLO">FALLO</option>
            <option value="INFO">INFO</option>
          </select>
          <div className="flex-1" />
          <button
            type="button"
            onClick={exportarXLSX}
            disabled={exportando}
            className="text-xs px-3 py-1.5 rounded bg-petroleum-500 text-white font-medium hover:bg-petroleum-600 disabled:opacity-60"
          >
            {exportando ? '⏳ Generando…' : '↓ Exportar XLSX'}
          </button>
        </div>
        <p className="text-xs text-gray-400">Mostrando {filtrados.length} de {EVENTOS.length} eventos registrados.</p>
      </div>

      {mensaje && <div role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{mensaje}</div>}

      {/* Grilla */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Fecha</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Usuario</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Rol</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acción</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Módulo</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Detalle</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(e => (
                <tr key={e.id} className={`hoverable ${e.resultado === 'FALLO' ? 'row-error' : ''}`}>
                  <td className="px-3 py-2.5 font-mono text-gray-600 whitespace-nowrap">{e.fecha}</td>
                  <td className="px-3 py-2.5 text-gray-800 font-medium whitespace-nowrap">{e.usuario}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{e.rol}</td>
                  <td className="px-3 py-2.5 text-gray-700">{e.accion}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{e.modulo}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-md">{e.detalle}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap"><BadgeResultado resultado={e.resultado} /></td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-400">No hay eventos que coincidan con los filtros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
