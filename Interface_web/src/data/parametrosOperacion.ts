export const PERIODOS_OPERACION = [
  { codigo: '00', nombre: 'Saldos Iniciales' },
  { codigo: '01', nombre: 'Enero' },
  { codigo: '02', nombre: 'Febrero' },
  { codigo: '03', nombre: 'Marzo' },
  { codigo: '04', nombre: 'Abril' },
  { codigo: '05', nombre: 'Mayo' },
  { codigo: '06', nombre: 'Junio' },
  { codigo: '07', nombre: 'Julio' },
  { codigo: '08', nombre: 'Agosto' },
  { codigo: '09', nombre: 'Septiembre' },
  { codigo: '10', nombre: 'Octubre' },
  { codigo: '11', nombre: 'Noviembre' },
  { codigo: '12', nombre: 'Diciembre' },
] as const;

export type PeriodoOperacion = typeof PERIODOS_OPERACION[number]['codigo'];

// Correspondencia con PARAMS()/DSIGRABA6() y el recurso PARAM_1 del legado.
export interface ParametrosOperacion {
  nombreEmpresa: string; // CONCTR.CTCIA
  nit: string; // CTNIT
  direccion: string; // CTDIRECC
  ciudad: string; // CTCIUDAD
  directorioContabilidad: string; // CTDIREC
  anioOperacion: string; // CTANO
  contabilidadConciliacion: string; // CTCLAVE1
  verificaDocumentosLotes: boolean; // CTVERDOC
  tercerosDocumentosPropios: boolean; // CTTERDOC
  controlaUsuarioLotes: boolean; // CTPUC: '1' / ' '
  comentarioCertificado: string; // CTLEY1
  // MCR se muestra en PARAM_1, pero DSIGRABA6 no lo persiste en CONCTR.
  modoRetencion: 'retencion-a-base' | 'base-a-retencion';
  periodosHabilitados: Record<PeriodoOperacion, boolean>; // CT00…CT12: true = habilitado
}

export type ErroresParametros = Partial<Record<keyof ParametrosOperacion, string>>;

export function crearParametrosIniciales(empresa: { codigo: string; nombre: string; nit: string; digito: string }, anio: number): ParametrosOperacion {
  return {
    nombreEmpresa: empresa.nombre,
    nit: `${empresa.nit}-${empresa.digito}`,
    direccion: '',
    ciudad: '',
    directorioContabilidad: `C:\\VISION20\\CONTAB\\${empresa.codigo}\\`,
    anioOperacion: String(anio),
    contabilidadConciliacion: '',
    verificaDocumentosLotes: true,
    tercerosDocumentosPropios: false,
    controlaUsuarioLotes: true,
    comentarioCertificado: '',
    modoRetencion: 'retencion-a-base',
    periodosHabilitados: Object.fromEntries(PERIODOS_OPERACION.map(p => [p.codigo, true])) as Record<PeriodoOperacion, boolean>,
  };
}

export function esRutaContableValida(ruta: string): boolean {
  // Sólo valida la sintaxis. Comprobar la existencia requiere el servicio del servidor.
  return /^(?:[a-z]:\\|\\\\[^\\/]+\\[^\\/]+(?:\\|$))/i.test(ruta.trim())
    && !/[<>"|?*\u0000-\u001f]/.test(ruta.trim());
}

export function validarParametros(parametros: ParametrosOperacion): ErroresParametros {
  const errores: ErroresParametros = {};
  if (!parametros.nombreEmpresa.trim()) errores.nombreEmpresa = 'Ingrese el nombre de la empresa.';
  if (!parametros.nit.trim()) errores.nit = 'Ingrese el NIT de la empresa.';
  if (!/^\d{4}$/.test(parametros.anioOperacion) || Number(parametros.anioOperacion) < 1900) {
    errores.anioOperacion = 'Ingrese un año de cuatro dígitos válido.';
  }
  if (!esRutaContableValida(parametros.directorioContabilidad)) {
    errores.directorioContabilidad = 'Ingrese una ruta de Windows, por ejemplo C:\\VISION20\\CONTAB\\001\\ o \\\\servidor\\contabilidad\\.';
  }
  return errores;
}

export function esParametrosGuardados(valor: unknown): valor is ParametrosOperacion {
  if (!valor || typeof valor !== 'object') return false;
  const p = valor as Record<string, unknown>;
  const textos = ['nombreEmpresa', 'nit', 'direccion', 'ciudad', 'directorioContabilidad', 'anioOperacion', 'contabilidadConciliacion', 'comentarioCertificado'];
  const controles = ['verificaDocumentosLotes', 'tercerosDocumentosPropios', 'controlaUsuarioLotes'];
  return textos.every(campo => typeof p[campo] === 'string')
    && controles.every(campo => typeof p[campo] === 'boolean')
    && (p.modoRetencion === 'retencion-a-base' || p.modoRetencion === 'base-a-retencion')
    && !!p.periodosHabilitados && typeof p.periodosHabilitados === 'object'
    && PERIODOS_OPERACION.every(periodo => typeof (p.periodosHabilitados as Record<string, unknown>)[periodo.codigo] === 'boolean');
}
