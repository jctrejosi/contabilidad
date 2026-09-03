// Índices de datos compartidos por las vistas.
import legado from '../data/legado.json';
import nuevo from '../data/nuevo.json';
import { validarIntegridad, DOMINIOS_ESPERADOS } from './validar.js';

export { legado, nuevo, DOMINIOS_ESPERADOS };

// Resultado de integridad (se calcula una sola vez).
export const resultado = validarIntegridad(legado, nuevo);

export const ordenDominios = Object.keys(DOMINIOS_ESPERADOS);

// Entidad nueva por nombre.
export const entidadPorNombre = Object.fromEntries(
  nuevo.entidades.map((e) => [e.nombre, e]),
);

// Orden canónico de módulos (definido en el catálogo).
export const modulos = nuevo.modulos;

// Dominio al que pertenece una tabla legada.
export const dominioDe = (origen) =>
  legado.find((t) => t.origen === origen)?.dominio || '—';

// Módulo de una entidad nueva.
export const moduloDe = (nombre) =>
  nuevo.entidades.find((e) => e.nombre === nombre)?.modulo || '—';

// Tablas legadas que alimentan una entidad nueva.
export const alimentan = (nombreNuevo) =>
  legado.filter((t) => t.destino.includes(nombreNuevo));

// Destinos de una tabla legada (existentes).
export const destinosDe = (origen) =>
  legado.find((t) => t.origen === origen)?.destino || [];

export const CLASIF_COLOR = {
  Parcial: 'c-parcial',
  'Parcial condicional': 'c-condicional',
  'Sin estructura': 'c-sinestructura',
  'Derivable con cambios': 'c-derivable',
  'Sustitución técnica': 'c-sustitucion',
  'Integración requerida': 'c-integracion',
};
