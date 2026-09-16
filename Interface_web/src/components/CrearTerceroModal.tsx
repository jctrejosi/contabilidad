import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { crearTercero, type TerceroCreate } from '../api/terceros';
import type { Tercero } from '../types';

const INPUT = 'w-full rounded border border-gray-300 px-2.5 py-1.5 text-xs outline-none focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';

const VERIFICATION_WEIGHTS = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];

/** Misma operación de DIGITOK() en CLIENTES2 del sistema original. */
export function calcularDigitoVerificacion(identificacion: string): string {
  if (!/^\d{1,10}$/.test(identificacion)) return '';
  const padded = identificacion.padStart(15, '0');
  const suma = [...padded].reduce((total, digito, index) => total + Number(digito) * VERIFICATION_WEIGHTS[index], 0);
  const residuo = suma % 11;
  return String(residuo === 0 || residuo === 1 ? residuo : 11 - residuo);
}

function correoValido(correo: string): boolean {
  const value = correo.trim();
  return !value || (value.split('@').length === 2 && !value.startsWith('@') && !value.endsWith('@'));
}

function initialForm(term: string): TerceroCreate {
  const possibleCode = term.replace(/\D/g, '').slice(0, 10);
  return {
    nit: possibleCode,
    digito: calcularDigitoVerificacion(possibleCode),
    tipoDocumento: '13',
    nombre: '',
    nombreComercial: '',
    primerNombre: '',
    segundoNombre: '',
    primerApellido: '',
    segundoApellido: '',
    direccion: '',
    codigoCiudad: '',
    ciudad: '',
    telefono: '',
    correo: '',
    zona: '',
    cupo: 0,
  };
}

export default function CrearTerceroModal({ initialTerm, onClose, onCreated }: {
  initialTerm: string;
  onClose: () => void;
  onCreated: (tercero: Tercero) => void;
}) {
  const [form, setForm] = useState<TerceroCreate>(() => initialForm(initialTerm));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const valid = useMemo(() => {
    const baseValid = /^\d{1,10}$/.test(form.nit) && Boolean(form.nombre.trim()) && correoValido(form.correo);
    if (form.tipoDocumento === '31') return baseValid;
    return baseValid
      && Boolean(form.primerNombre.trim())
      && Boolean(form.primerApellido.trim())
      && Boolean(form.segundoApellido.trim());
  }, [form]);

  function set<K extends keyof TerceroCreate>(key: K, value: TerceroCreate[K]) {
    setForm(current => ({ ...current, [key]: value }));
    setError('');
  }

  function navigateWithEnter(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    const target = event.target as HTMLElement;
    if (target.matches('button[type="submit"]')) return;
    event.preventDefault();
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input:not(:disabled),select:not(:disabled),button[type="submit"]:not(:disabled)'));
    controls[controls.indexOf(target) + 1]?.focus();
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!valid) {
      if (!correoValido(form.correo)) {
        setError('Ingrese un correo electrónico válido que contenga @.');
        return;
      }
      setError(form.tipoDocumento === '31'
        ? 'Ingrese una identificación numérica y la razón social.'
        : 'Ingrese la identificación, el nombre o razón social, el primer nombre y los dos apellidos.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const created = await crearTercero(Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim().toUpperCase() : value]),
      ) as unknown as TerceroCreate);
      onCreated(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible crear el tercero.');
    } finally {
      setGuardando(false);
    }
  }

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !guardando) onClose(); }}>
    <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div><h2 className="text-sm font-semibold text-gray-800">Crear tercero</h2><p className="mt-0.5 text-xs text-gray-400">Complete los datos básicos para usarlo en el movimiento.</p></div>
        <button type="button" disabled={guardando} onClick={onClose} className="text-xl text-gray-400 disabled:opacity-40">×</button>
      </div>
      <form noValidate onKeyDown={navigateWithEnter} onSubmit={save}>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          {error && <div role="alert" className="sm:col-span-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Tipo de documento *</span><select autoFocus className={INPUT} value={form.tipoDocumento} onChange={event => set('tipoDocumento', event.target.value as '13' | '31')}><option value="13">Cédula de ciudadanía</option><option value="31">NIT</option></select></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Identificación *</span><input className={`${INPUT} font-mono`} inputMode="numeric" maxLength={10} value={form.nit} onChange={event => {
            const nit = event.target.value.replace(/\D/g, '');
            setForm(current => ({ ...current, nit, digito: calcularDigitoVerificacion(nit) }));
            setError('');
          }} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Dígito de verificación</span><input className={`${INPUT} bg-gray-100 font-mono text-gray-600`} disabled value={form.digito} placeholder="Automático" title="Calculado automáticamente a partir de la identificación" /></label>
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium text-gray-600">Nombre / razón social *</span><input className={INPUT} maxLength={60} value={form.nombre} onChange={event => set('nombre', event.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Primer nombre {form.tipoDocumento === '13' && '*'}</span><input className={INPUT} maxLength={20} value={form.primerNombre} onChange={event => set('primerNombre', event.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Segundo nombre</span><input className={INPUT} maxLength={20} value={form.segundoNombre} onChange={event => set('segundoNombre', event.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Primer apellido {form.tipoDocumento === '13' && '*'}</span><input className={INPUT} maxLength={20} value={form.primerApellido} onChange={event => set('primerApellido', event.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Segundo apellido {form.tipoDocumento === '13' && '*'}</span><input className={INPUT} maxLength={20} value={form.segundoApellido} onChange={event => set('segundoApellido', event.target.value)} /></label>
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium text-gray-600">Nombre comercial</span><input className={INPUT} maxLength={60} value={form.nombreComercial} onChange={event => set('nombreComercial', event.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Dirección</span><input className={INPUT} maxLength={25} value={form.direccion} onChange={event => set('direccion', event.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Teléfono</span><input className={INPUT} maxLength={15} value={form.telefono} onChange={event => set('telefono', event.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Código de ciudad</span><input className={`${INPUT} font-mono`} maxLength={5} value={form.codigoCiudad} onChange={event => set('codigoCiudad', event.target.value.toUpperCase())} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Ciudad</span><input className={INPUT} maxLength={12} value={form.ciudad} onChange={event => set('ciudad', event.target.value)} /></label>
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium text-gray-600">Correo electrónico</span><input type="email" aria-invalid={!correoValido(form.correo)} className={INPUT} maxLength={60} value={form.correo} onChange={event => set('correo', event.target.value)} /><span className={`mt-1 block text-[11px] ${correoValido(form.correo) ? 'text-gray-400' : 'text-red-600'}`}>{correoValido(form.correo) ? 'Opcional. Si lo ingresa, debe contener @.' : 'El correo debe contener un solo @ y texto a ambos lados.'}</span></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Zona</span><input className={INPUT} maxLength={2} value={form.zona} onChange={event => set('zona', event.target.value.toUpperCase())} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Cupo de crédito</span><input type="number" min="0" step="0.01" className={`${INPUT} text-right font-mono`} value={form.cupo || ''} onChange={event => set('cupo', Number(event.target.value))} /></label>
        </div>
        <div className="flex justify-end gap-2 border-t bg-gray-50 px-5 py-4"><button type="button" disabled={guardando} onClick={onClose} className="rounded border border-gray-300 bg-white px-4 py-2 text-xs text-gray-700 disabled:opacity-40">Cancelar</button><button type="submit" disabled={guardando || !valid} className="rounded bg-petroleum-500 px-4 py-2 text-xs font-medium text-white disabled:bg-gray-300">{guardando ? 'Guardando…' : 'Guardar tercero'}</button></div>
      </form>
    </div>
  </div>;
}
