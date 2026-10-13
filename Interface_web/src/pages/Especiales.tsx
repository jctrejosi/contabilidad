/**
 * Definiciones > Especiales (CONTABDSI.PRG, menú E).
 *
 * Conserva el orden del menú Harbour. ESPE06/07/08 comparten una extracción
 * real con tres alcances; el resto permanece visible, pero sin ejecución.
 */
import { useState } from 'react';
import type { CompaniaSesion } from '../types';
import ExtraerMovimiento from './ExtraerMovimiento';

type OpcionEspecial = {
  numero: string;
  nombre: string;
  funcionOriginal: string;
  subopciones?: OpcionEspecial[];
};

const OPCIONES: OpcionEspecial[] = [
  { numero: '1', nombre: 'Paginación', funcionOriginal: 'ESPE03' },
  { numero: '2', nombre: 'Fusión de movimientos', funcionOriginal: 'ESPE04' },
  { numero: '3', nombre: 'Depuración de terceros', funcionOriginal: 'ESPE05' },
  { numero: '4–6', nombre: 'Extractar movimiento (comprobante, documentos o mes completo)', funcionOriginal: 'ESPE06 / ESPE07 / ESPE08(1)' },
  { numero: '7', nombre: 'Traslado automático de saldos', funcionOriginal: 'TRASLASA(1)' },
  { numero: '8', nombre: 'Generar lote saldos iniciales', funcionOriginal: 'ESPE10' },
  {
    numero: '9', nombre: 'Reasignación de cuentas y centros de costos', funcionOriginal: 'ESPE11',
    subopciones: [
      { numero: '9.1', nombre: 'Reasignación de cuentas', funcionOriginal: 'ESPE11(1)' },
      { numero: '9.2', nombre: 'Reasignación de centros de costos', funcionOriginal: 'ESPE11(2)' },
    ],
  },
  { numero: 'A', nombre: 'Revisión bases IVA/retención', funcionOriginal: 'ESPE12' },
  { numero: 'B', nombre: 'Convertir lote', funcionOriginal: 'LOTEE2' },
  { numero: 'C', nombre: 'Reconstruir documentos', funcionOriginal: 'RECONDOC' },
  { numero: 'D', nombre: 'Reasignar movimiento mensual', funcionOriginal: 'REASIMES' },
  { numero: 'E', nombre: 'Actualizar estructuras de lotes', funcionOriginal: 'STRULOT' },
  { numero: 'F', nombre: 'Distribuir movimiento contable por terceros', funcionOriginal: 'TERCE_LOT' },
  { numero: 'G', nombre: 'Depurar movimiento contable', funcionOriginal: 'DOBLE_LOT' },
  { numero: 'H', nombre: 'Extractar por tipo de documento y centro de costo', funcionOriginal: 'ESPE09' },
  { numero: 'I', nombre: 'Extractar movimiento de mes errado', funcionOriginal: 'ESPE08(2)' },
  { numero: 'J', nombre: 'Extractar lote y usuario', funcionOriginal: 'ESPE08J(1)' },
  { numero: 'K', nombre: 'Generar movimiento por tipo de documento', funcionOriginal: 'TRASLASA(2)' },
  { numero: 'L', nombre: 'Actualizar nombres de terceros en maestro contable', funcionOriginal: 'ACTUNOMA' },
  { numero: 'M', nombre: 'Enviar movimiento mensual completo a Excel', funcionOriginal: 'EXPORMES' },
];

function Opcion({ opcion, hija = false, onExtract }: { opcion: OpcionEspecial; hija?: boolean; onExtract: () => void }) {
  const disponible = opcion.numero === '4–6';
  return (
    <div className={`flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 ${hija ? 'bg-gray-50 pl-10' : ''}`}>
      <span className="flex h-7 min-w-7 items-center justify-center rounded bg-sky-50 px-1 font-mono text-xs font-semibold text-[#0073C0]">{opcion.numero}</span>
      <span className="min-w-0 flex-1 text-sm text-gray-800">{opcion.nombre}</span>
      {disponible ? <button type="button" onClick={onExtract} className="shrink-0 rounded bg-[#0073C0] px-3 py-1.5 text-xs font-medium text-white">Abrir</button>
        : <span className="shrink-0 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-500">Pendiente</span>}
    </div>
  );
}

export default function Especiales({ compania }: { compania: CompaniaSesion }) {
  const [mostrarExtraccion, setMostrarExtraccion] = useState(false);
  return (
    <div className="max-w-screen-xl space-y-4 p-4">
      <div>
        <p className="mb-1 text-xs text-gray-400">Definiciones / Especiales</p>
        <h1 className="text-lg font-semibold text-gray-800">Especiales</h1>
        <p className="mt-1 text-xs text-gray-500">Opciones del programa original. La extracción reúne comprobante, documentos y movimiento completo.</p>
      </div>
      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        {OPCIONES.map(opcion => (
          <div key={opcion.numero}>
            <Opcion opcion={opcion} onExtract={() => setMostrarExtraccion(true)} />
            {opcion.subopciones?.map(hija => <Opcion key={hija.numero} opcion={hija} hija onExtract={() => setMostrarExtraccion(true)} />)}
          </div>
        ))}
      </div>
      {mostrarExtraccion && <ExtraerMovimiento compania={compania} onClose={() => setMostrarExtraccion(false)} />}
    </div>
  );
}
