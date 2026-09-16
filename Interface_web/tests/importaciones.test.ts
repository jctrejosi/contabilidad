import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarConceptoImportacion, normalizarFechaImportacion } from '../src/data/importaciones.ts';

test('convierte la fecha numérica AAAAMMDD usada por Advantage', () => {
  assert.equal(normalizarFechaImportacion(20251201), '2025-12-01');
  assert.equal(normalizarFechaImportacion('20251201'), '2025-12-01');
  assert.equal(normalizarFechaImportacion('20251201.0'), '2025-12-01');
});

test('conserva fechas ISO y convierte fechas locales o seriales de Excel', () => {
  assert.equal(normalizarFechaImportacion('2025-12-01'), '2025-12-01');
  assert.equal(normalizarFechaImportacion('01/12/2025'), '2025-12-01');
  assert.equal(normalizarFechaImportacion(45992), '2025-12-01');
});

test('rechaza fechas que no existen', () => {
  assert.equal(normalizarFechaImportacion('20250229'), '');
  assert.equal(normalizarFechaImportacion('31/04/2025'), '');
});

test('limpia relleno y espacios no separables de conceptos importados', () => {
  const source = 'HUMBERTO LAVERDE   POSADA,FVH1814\u00a0\u00a0\u00a0\u00a0 ,FVH1817\u00a0\u00a0\u00a0\u00a0 ,F';
  const result = normalizarConceptoImportacion(source);
  assert.equal(result, 'HUMBERTO LAVERDE POSADA,FVH1814,FVH1817,F');
  assert.ok(result.length <= 50);
});

test('recorta conceptos extensos a los primeros 50 caracteres', () => {
  const source = 'Concepto contable demasiado extenso que contiene información adicional no requerida';
  const result = normalizarConceptoImportacion(source);
  assert.equal(result.length, 50);
  assert.equal(result, source.slice(0, 50));
});
