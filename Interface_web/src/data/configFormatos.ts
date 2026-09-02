export type TipoElementoFormato = 'leyenda' | 'imagen' | 'rectangulo' | 'linea' | 'campo';
export type CampoFormato = 'comprobante' | 'documento' | 'fecha' | 'totales';
export type Alineacion = 'izquierda' | 'centro' | 'derecha';

export interface ElementoFormato {
  id: string;
  tipo: TipoElementoFormato;
  campo?: CampoFormato;
  x: number;
  y: number;
  w: number;
  h: number;
  texto: string;
  negrita: boolean;
  alineacion: Alineacion;
  fontSize: number;
}

export interface FormatoDocumental {
  id: string;
  nombre: string;
  descripcion: string;
  elementos: ElementoFormato[];
}

export const CAMPOS_FORMATO: { valor: CampoFormato; nombre: string }[] = [
  { valor: 'comprobante', nombre: 'Comprobante' },
  { valor: 'documento', nombre: 'Documento' },
  { valor: 'fecha', nombre: 'Fecha' },
  { valor: 'totales', nombre: 'Totales' },
];

export const ELEMENTOS_DISPONIBLES: { tipo: TipoElementoFormato; nombre: string }[] = [
  { tipo: 'leyenda', nombre: 'Leyenda de texto' },
  { tipo: 'campo', nombre: 'Campo dinámico' },
  { tipo: 'imagen', nombre: 'Imagen (logo)' },
  { tipo: 'rectangulo', nombre: 'Rectángulo' },
  { tipo: 'linea', nombre: 'Línea' },
];

let contadorElementos = 0;
export function crearElemento(tipo: TipoElementoFormato, campo?: CampoFormato): ElementoFormato {
  contadorElementos += 1;
  const base: ElementoFormato = {
    id: `el-${Date.now()}-${contadorElementos}`,
    tipo,
    campo,
    x: 20,
    y: 20 + contadorElementos * 6,
    w: 180,
    h: 16,
    texto: '',
    negrita: false,
    alineacion: 'izquierda',
    fontSize: 10,
  };
  if (tipo === 'leyenda') { base.texto = 'Texto de ejemplo'; }
  if (tipo === 'campo') { base.texto = `{${campo || 'comprobante'}}`; }
  if (tipo === 'imagen') { base.texto = 'LOGO'; base.w = 80; base.h = 30; }
  if (tipo === 'rectangulo') { base.w = 220; base.h = 90; }
  if (tipo === 'linea') { base.w = 200; base.h = 1; }
  return base;
}

export const FORMATOS_INICIALES: FormatoDocumental[] = [
  {
    id: 'fmt-ce',
    nombre: 'Comprobante de egreso',
    descripcion: 'Formato oficial de comprobante de egreso con totales al pie.',
    elementos: [
      { id: 'e1', tipo: 'imagen', x: 20, y: 16, w: 80, h: 30, texto: 'LOGO', negrita: false, alineacion: 'izquierda', fontSize: 10 },
      { id: 'e2', tipo: 'leyenda', x: 130, y: 18, w: 220, h: 16, texto: 'Compañía Demo S.A.S. — NIT 900.123.456-7', negrita: true, alineacion: 'centro', fontSize: 11 },
      { id: 'e3', tipo: 'leyenda', x: 130, y: 36, w: 220, h: 14, texto: 'COMPROBANTE DE EGRESO', negrita: true, alineacion: 'centro', fontSize: 13 },
      { id: 'e4', tipo: 'linea', x: 20, y: 62, w: 330, h: 1, texto: '', negrita: false, alineacion: 'izquierda', fontSize: 10 },
      { id: 'e5', tipo: 'campo', campo: 'comprobante', x: 20, y: 72, w: 140, h: 14, texto: '{comprobante}', negrita: false, alineacion: 'izquierda', fontSize: 10 },
      { id: 'e6', tipo: 'campo', campo: 'documento', x: 170, y: 72, w: 140, h: 14, texto: '{documento}', negrita: false, alineacion: 'izquierda', fontSize: 10 },
      { id: 'e7', tipo: 'campo', campo: 'fecha', x: 20, y: 90, w: 120, h: 14, texto: '{fecha}', negrita: false, alineacion: 'izquierda', fontSize: 10 },
      { id: 'e8', tipo: 'rectangulo', x: 20, y: 112, w: 330, h: 150, texto: '', negrita: false, alineacion: 'izquierda', fontSize: 10 },
      { id: 'e9', tipo: 'campo', campo: 'totales', x: 220, y: 270, w: 130, h: 14, texto: '{totales}', negrita: true, alineacion: 'derecha', fontSize: 11 },
    ],
  },
  {
    id: 'fmt-nom',
    nombre: 'Documento de nómina',
    descripcion: 'Documento interno para la causación de nómina mensual.',
    elementos: [
      { id: 'e1', tipo: 'leyenda', x: 20, y: 20, w: 220, h: 16, texto: 'DOCUMENTO DE NÓMINA', negrita: true, alineacion: 'centro', fontSize: 13 },
      { id: 'e2', tipo: 'campo', campo: 'documento', x: 20, y: 46, w: 140, h: 14, texto: '{documento}', negrita: false, alineacion: 'izquierda', fontSize: 10 },
      { id: 'e3', tipo: 'campo', campo: 'fecha', x: 170, y: 46, w: 140, h: 14, texto: '{fecha}', negrita: false, alineacion: 'izquierda', fontSize: 10 },
      { id: 'e4', tipo: 'rectangulo', x: 20, y: 70, w: 330, h: 120, texto: '', negrita: false, alineacion: 'izquierda', fontSize: 10 },
      { id: 'e5', tipo: 'campo', campo: 'totales', x: 220, y: 200, w: 130, h: 14, texto: '{totales}', negrita: true, alineacion: 'derecha', fontSize: 11 },
    ],
  },
];

export function esFormatosGuardados(valor: unknown): valor is FormatoDocumental[] {
  return Array.isArray(valor) && valor.every(f => {
    if (!f || typeof f !== 'object') return false;
    const formato = f as Record<string, unknown>;
    return typeof formato.id === 'string'
      && typeof formato.nombre === 'string'
      && typeof formato.descripcion === 'string'
      && Array.isArray(formato.elementos)
      && (formato.elementos as unknown[]).every(e => {
        if (!e || typeof e !== 'object') return false;
        const el = e as Record<string, unknown>;
        const tipos = ['leyenda', 'imagen', 'rectangulo', 'linea', 'campo'];
        return typeof el.id === 'string'
          && typeof el.tipo === 'string' && tipos.includes(el.tipo as string)
          && typeof el.x === 'number' && typeof el.y === 'number'
          && typeof el.w === 'number' && typeof el.h === 'number'
          && typeof el.texto === 'string'
          && typeof el.negrita === 'boolean'
          && typeof el.alineacion === 'string'
          && typeof el.fontSize === 'number';
      });
  });
}
