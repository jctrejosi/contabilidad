import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

type Value = string | number | boolean;
type Form = Record<string, Value> & { CCODIGO: string; version: string };
type Kind = 'text' | 'number' | 'check' | 'select';
type Definition = { key: string; label: string; kind?: Kind; options?: Array<[string, string]>; note?: string };

const input = 'w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const secondary = 'rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50';
const primary = 'rounded bg-petroleum-500 px-4 py-2 text-sm font-medium text-white hover:bg-petroleum-600 disabled:opacity-50';
const weights = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];
const referenceFields = new Set(['CTIPDOC', 'CCODCIU', 'CZONA', 'CVENDED', 'CTIPEMP', 'CTIPPAG', 'CACTIVI']);
function digit(code: string): string {
  if (!/^[A-Za-z0-9]{1,10}$/.test(code)) return '';
  const remainder = [...code.padStart(15, ' ')].reduce((total, value, index) => total + (/^[0-9]$/.test(value) ? Number(value) : 0) * weights[index], 0) % 11;
  return String(remainder <= 1 ? remainder : 11 - remainder);
}

const sections: Array<{ title: string; fields: Definition[] }> = [
  { title: 'Generales', fields: [
    { key: 'CTIPDOC', label: 'Tipo de documento (código) *', note: '13: cédula · 31: NIT' },
    { key: 'CTIPOCLI', label: 'Tipo de persona', kind: 'select', options: [['1', 'Natural'], ['2', 'Jurídica']] },
    { key: 'CCODIGO', label: 'Identificación *' }, { key: 'CDIGITO', label: 'Dígito de verificación' },
    { key: 'CNOMBRE', label: 'Nombre o razón social *' }, { key: 'CSOCIAL', label: 'Nombre comercial' },
    { key: 'CNOM1', label: 'Primer nombre' }, { key: 'CNOM2', label: 'Segundo nombre' },
    { key: 'CAPE1', label: 'Primer apellido' }, { key: 'CAPE2', label: 'Segundo apellido' },
    { key: 'CDIREC', label: 'Dirección' }, { key: 'CCODCIU', label: 'Código de ciudad' },
    { key: 'CCIUDAD', label: 'Ciudad' }, { key: 'CTELEF', label: 'Teléfono' },
    { key: 'CEMAIL', label: 'Correo electrónico' }, { key: 'CEMAILFE', label: 'Correo de facturación electrónica' },
    { key: 'CZONA', label: 'Zona' }, { key: 'CFCHCREA', label: 'Fecha de creación (AAAAMMDD)', kind: 'number' },
    { key: 'CNIT', label: 'NIT relacionado' },
    { key: 'CFACTU', label: 'Facturación', kind: 'check' }, { key: 'CINVE', label: 'Inventario', kind: 'check' },
    { key: 'CCXP', label: 'Cuentas por pagar', kind: 'check' },
  ] },
  { title: 'Facturación y cartera', fields: [
    { key: 'CCUPO', label: 'Cupo de crédito', kind: 'number' },
    { key: 'CCONDICION', label: 'Condición comercial' }, { key: 'CDCTOFAC', label: 'Descuento de factura %', kind: 'number' },
    { key: 'CPLAZO', label: 'Plazo de pago (días)', kind: 'number' },
    { key: 'CDIASMOR', label: 'Días de mora autorizados', kind: 'number' },
    { key: 'CAUTMORA', label: 'Autorizó mora' }, { key: 'CLISTA', label: 'Lista de precios' },
    { key: 'CVENDED', label: 'Vendedor' }, { key: 'CPROPIETAR', label: 'Propietario' },
    { key: 'CRETEN', label: 'Retención', kind: 'select', options: [['1', 'No aplica'], ['2', 'Retención en ventas y ReteIVA'], ['3', 'Solo retención en ventas']] },
    { key: 'CPORRETI', label: 'Porcentaje de retención', kind: 'number' },
    { key: 'CBASERETI', label: 'Base de retención', kind: 'number' },
    { key: 'CESTADO', label: 'Estado', kind: 'select', options: [['1', 'Normal'], ['2', 'Bloqueado']] },
    { key: 'CMOTIVO', label: 'Motivo de bloqueo' },
    { key: 'CMODIFI', label: 'Permite modificación', kind: 'check' },
    { key: 'CTCIFIN', label: 'Información financiera', kind: 'check' },
    ...[1, 2, 3].flatMap(index => [
      { key: `DIASC${index}`, label: `Escala ${index}: días`, kind: 'number' as Kind },
      { key: `DCTOC${index}`, label: `Escala ${index}: descuento %`, kind: 'number' as Kind },
    ]),
  ] },
  { title: 'Cuentas por pagar / compras', fields: [
    { key: 'CTIPEMP', label: 'Tipo de empresa' }, { key: 'CTIPPAG', label: 'Tipo de contribuyente' },
    ...[1, 2, 3, 4, 5, 6].flatMap(index => [
      { key: `CPLAZO${index}`, label: `Plazo ${index} (días)`, kind: 'number' as Kind },
      { key: `CDCTO${index}`, label: `Descuento ${index} %`, kind: 'number' as Kind },
    ]),
    { key: 'CACTIVI', label: 'Actividad económica' },
    { key: 'CFCHACTI', label: 'Vigencia actividad (AAAAMMDD)', kind: 'number' },
    { key: 'CRETACTI', label: 'Retención por actividad' },
    { key: 'CCODBE', label: 'Código del beneficiario' }, { key: 'CBENEFI', label: 'Nombre del beneficiario' },
    { key: 'BCOCTA', label: 'Banco / cuenta' }, { key: 'CDIASROT', label: 'Días de rotación', kind: 'number' },
    { key: 'CODICEN', label: 'Código de centro' },
    { key: 'CMETCOMP', label: 'Método de compra', kind: 'select', options: [['0', 'Sin definir'], ['1', 'Centralizada'], ['2', 'Tienda'], ['3', 'Mixto']] },
    { key: 'CFCHVIGMC', label: 'Vigencia método de compra (AAAAMMDD)', kind: 'number' },
    { key: 'CPLAENTRE', label: 'Plazo de entrega', kind: 'number' },
    { key: 'CFRECUVIS', label: 'Frecuencia de visita', kind: 'number' },
    { key: 'CDIASEM', label: 'Día de visita', kind: 'select', options: [['', 'Sin definir'], ...['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'].map(day => [day, day] as [string, string])] },
  ] },
  { title: 'Servicio al cliente', fields: [
    { key: 'CPROFESION', label: 'Profesión' }, { key: 'CDIROFI', label: 'Dirección de oficina' },
    { key: 'CTELOFI', label: 'Teléfono de oficina' },
    { key: 'CCUMPLE', label: 'Cumpleaños (valor numérico del registro original)', kind: 'number' },
    { key: 'CSEXO', label: 'Sexo', kind: 'select', options: [['', 'Sin definir'], ['M', 'Masculino'], ['F', 'Femenino']] },
    { key: 'CCONYUGE', label: 'Cónyuge' }, { key: 'CPROFEC', label: 'Profesión del cónyuge' },
    { key: 'CCUMPLEC', label: 'Cumpleaños del cónyuge', kind: 'number' },
    { key: 'CDIROFIC', label: 'Dirección de oficina del cónyuge' },
    { key: 'CTELOFIC', label: 'Teléfono de oficina del cónyuge' },
    { key: 'CCARNET', label: 'Clave web' },
  ] },
  { title: 'Facturación automática', fields: [
    { key: 'OPELOGIS', label: 'Operación logística', kind: 'check' },
    { key: 'DEBLOGIS', label: 'Debita logística', kind: 'check' },
    { key: 'VLRLOGIS', label: 'Valor de logística', kind: 'number' },
    { key: 'PORLOGIS', label: 'Porcentaje de logística', kind: 'number' },
    { key: 'CBANMAIL', label: 'Envío automático por correo', kind: 'check' },
  ] },
];

interface Props { nit?: string; onClose: () => void; onSaved: (nit: string) => void }

export default function TerceroMantenimiento({ nit, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Form | null>(null);
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState<Record<string, Array<{ codigo: string; nombre: string }>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    let live = true;
    const url = nit ? `/api/terceros/mantenimiento/${encodeURIComponent(nit)}` : '/api/terceros/mantenimiento/nuevo';
    fetch(url).then(async response => {
      const data = await response.json() as Form & { detail?: string };
      if (!response.ok) throw new Error(data.detail || 'No fue posible cargar la ficha.');
      if (live) setForm(data);
    }).catch(problem => { if (live) setError(problem instanceof Error ? problem.message : 'No fue posible cargar la ficha.'); });
    return () => { live = false; };
  }, [nit]);
  useEffect(() => {
    formRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>('input:not([readonly]), select')?.focus();
  }, [tab, Boolean(form)]);

  function update(key: string, value: Value) {
    const selected = options[key]?.find(option => option.codigo === value);
    setForm(previous => previous ? {
      ...previous, [key]: value,
      ...(key === 'CCODIGO' ? { CDIGITO: digit(String(value)) } : {}),
      ...(key === 'CTIPDOC' && (value === '13' || value === '31') ? { CTIPOCLI: value === '31' ? 2 : 1 } : {}),
      ...(key === 'CCODCIU' && selected ? { CCIUDAD: selected.nombre.slice(0, 12) } : {}),
    } : previous);
  }

  async function loadOptions(key: string, search = '') {
    if (!referenceFields.has(key)) return;
    try {
      const response = await fetch(`/api/terceros/mantenimiento/catalogos/${key}?buscar=${encodeURIComponent(search)}`);
      if (!response.ok) return;
      const rows = await response.json() as Array<{ codigo: string; nombre: string }>;
      setOptions(previous => ({ ...previous, [key]: rows }));
    } catch { /* Puede continuar digitando el código si el catálogo no responde. */ }
  }

  async function save() {
    if (!form || busy) return;
    setError(''); setBusy(true);
    try {
      const code = form.CCODIGO.trim();
      const url = nit ? `/api/terceros/mantenimiento/${encodeURIComponent(nit)}` : '/api/terceros/mantenimiento';
      const response = await fetch(url, { method: nit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json() as Form & { detail?: string };
      if (!response.ok) throw new Error(result.detail || 'No fue posible guardar el tercero.');
      onSaved(code);
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'No fue posible guardar el tercero.'); }
    finally { setBusy(false); }
  }

  function advance(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    const fields = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input:not([disabled]):not([readonly]), select:not([disabled])'));
    const index = fields.indexOf(document.activeElement as HTMLInputElement);
    if (index >= 0) {
      event.preventDefault();
      if (index < fields.length - 1) fields[index + 1].focus();
      else if (tab < sections.length - 1) setTab(tab + 1);
      else void save();
    }
  }

  function renderField(definition: Definition) {
    if (!form) return null;
    const { key, label, kind = 'text' } = definition;
    const value = form[key] ?? '';
    if (kind === 'check') return <label key={key} className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs text-gray-700"><input type="checkbox" checked={Boolean(value)} onChange={event => update(key, event.target.checked)} />{label}</label>;
    return <label key={key} className="block text-xs text-gray-600">{label}
      {kind === 'select' ? <select className={input} value={String(value)} onChange={event => update(key, Number.isNaN(Number(event.target.value)) || key === 'CDIASEM' || key === 'CSEXO' ? event.target.value : Number(event.target.value))}>{definition.options?.map(([code, text]) => <option key={code} value={code}>{text}</option>)}</select> :
        <><input className={input} type={kind === 'number' ? 'number' : 'text'} step={kind === 'number' ? 'any' : undefined} maxLength={kind === 'text' ? (key === 'CCODIGO' ? 10 : undefined) : undefined}
          list={referenceFields.has(key) ? `third-${key}` : undefined}
          value={String(value)} readOnly={Boolean(nit && key === 'CCODIGO') || key === 'CDIGITO'}
          onFocus={() => { if (referenceFields.has(key)) void loadOptions(key, String(value)); }}
          onChange={event => { update(key, kind === 'number' ? Number(event.target.value) : event.target.value); if (referenceFields.has(key)) void loadOptions(key, event.target.value); }} />
          {referenceFields.has(key) && <datalist id={`third-${key}`}>{options[key]?.map(option => <option key={option.codigo} value={option.codigo} label={option.nombre} />)}</datalist>}</>}
      {definition.note && <span className="text-[11px] text-gray-400">{definition.note}</span>}
    </label>;
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-label={nit ? 'Modificar tercero' : 'Crear tercero'}>
    <div className="flex max-h-[94vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="text-base font-semibold text-gray-800">{nit ? `Modificar tercero ${nit}` : 'Crear tercero'}</h2><p className="text-xs text-gray-500">Ficha completa del tercero</p></div><button onClick={onClose} className="text-xl text-gray-400" aria-label="Cerrar">×</button></header>
      {error && <div role="alert" className="mx-5 mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      {!form ? <div className="p-8 text-center text-sm text-gray-500">Cargando ficha…</div> : <>
        <nav className="flex gap-1 overflow-x-auto border-b px-4 pt-3">{sections.map((section, index) => <button key={section.title} type="button" onClick={() => setTab(index)} className={`whitespace-nowrap rounded-t px-3 py-2 text-xs ${tab === index ? 'border border-b-white border-gray-200 bg-white font-semibold text-petroleum-700' : 'text-gray-500 hover:bg-gray-50'}`}>{section.title}</button>)}</nav>
        <form ref={formRef} className="overflow-y-auto p-5" onKeyDown={advance} onSubmit={event => { event.preventDefault(); void save(); }}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{sections[tab].fields.map(renderField)}</div>
        </form>
        <footer className="flex justify-between border-t px-5 py-3"><div className="flex gap-2"><button className={secondary} disabled={tab === 0} onClick={() => setTab(tab - 1)}>Anterior</button><button className={secondary} disabled={tab === sections.length - 1} onClick={() => setTab(tab + 1)}>Siguiente</button></div><div className="flex gap-2"><button className={secondary} onClick={onClose}>Cancelar</button><button className={primary} disabled={busy} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar tercero'}</button></div></footer>
      </>}
    </div>
  </div>;
}
