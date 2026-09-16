import test from 'node:test';
import assert from 'node:assert/strict';
import { PERIODOS_OPERACION, crearParametrosIniciales, esParametrosGuardados, esRutaContableValida, validarParametros } from '../src/data/parametrosOperacion.ts';

const empresa = { codigo: '001', nombre: 'Empresa prueba', nit: '900.123.456', digito: '7' };

test('representa exactamente CT00 a CT12; true significa período habilitado', () => {
  const p = crearParametrosIniciales(empresa, 2026);
  assert.equal(PERIODOS_OPERACION.length, 13);
  assert.deepEqual(Object.keys(p.periodosHabilitados).sort(), Array.from({ length: 13 }, (_, i) => String(i).padStart(2, '0')));
  assert.ok(Object.values(p.periodosHabilitados).every(Boolean));
  p.periodosHabilitados['02'] = false;
  assert.equal(p.periodosHabilitados['02'], false);
  assert.equal(p.periodosHabilitados['01'], true);
});

test('los valores iniciales representan un registro CONCTR válido', () => {
  const p = crearParametrosIniciales(empresa, 2026);
  assert.deepEqual(validarParametros(p), {});
  assert.ok(esParametrosGuardados(JSON.parse(JSON.stringify(p))));
});

test('rechaza nombre, NIT, año y directorio inválidos', () => {
  const p = crearParametrosIniciales(empresa, 2026);
  Object.assign(p, { nombreEmpresa: ' ', nit: '', anioOperacion: '26', directorioContabilidad: 'carpeta-relativa' });
  assert.deepEqual(Object.keys(validarParametros(p)).sort(), ['anioOperacion', 'directorioContabilidad', 'nit', 'nombreEmpresa']);
});

test('acepta directorios Windows y UNC, sin afirmar que existen', () => {
  assert.ok(esRutaContableValida('C:\\VISION20\\CONTAB\\001\\'));
  assert.ok(esRutaContableValida('\\\\servidor\\contabilidad\\001\\'));
  assert.ok(esRutaContableValida('\\VIS90'));
  for (const ruta of ['', 'C:', 'relativa', '\\\\servidor', 'C:\\ruta?invalida']) assert.equal(esRutaContableValida(ruta), false, ruta);
});

test('ignora preferencias incompletas o dañadas', () => {
  assert.equal(esParametrosGuardados(null), false);
  assert.equal(esParametrosGuardados({}), false);
  const p = crearParametrosIniciales(empresa, 2026);
  assert.equal(esParametrosGuardados({ ...p, periodosHabilitados: {} }), false);
  assert.equal(esParametrosGuardados({ ...p, controlaUsuarioLotes: '1' }), false);
  assert.equal(esParametrosGuardados({ ...p, codigoInterno: '101' }), false);
});
