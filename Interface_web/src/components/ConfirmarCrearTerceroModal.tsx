import { useEffect } from 'react';

/** Confirmación visual reutilizable cuando una búsqueda no encuentra el tercero. */
export default function ConfirmarCrearTerceroModal({ termino, onCancel, onConfirm }: {
  termino: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', closeWithEscape);
    return () => document.removeEventListener('keydown', closeWithEscape);
  }, [onCancel]);

  return <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirmar-tercero-titulo"
    className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-4"
    onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}
  >
    <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
      <div className="flex gap-3 px-5 pb-3 pt-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl text-amber-700">!</div>
        <div>
          <h2 id="confirmar-tercero-titulo" className="text-base font-semibold text-gray-800">Tercero no encontrado</h2>
          <p className="mt-1 text-sm leading-5 text-gray-600">
            No encontramos ningún tercero asociado a <strong className="font-semibold text-gray-800">“{termino}”</strong>.
          </p>
          <p className="mt-2 text-sm leading-5 text-gray-500">¿Desea registrarlo ahora para continuar con el movimiento?</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t bg-gray-50 px-5 py-4">
        <button type="button" onClick={onCancel} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Volver a buscar</button>
        <button autoFocus type="button" onClick={onConfirm} className="rounded bg-petroleum-500 px-4 py-2 text-sm font-medium text-white hover:bg-petroleum-600">Crear tercero</button>
      </div>
    </div>
  </div>;
}
