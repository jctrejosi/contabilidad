import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assetDepreciableBase,
  assetDepreciationPct,
  assetGross,
  assetIsFullyDepreciated,
  assetMonthlyDepreciation,
  assetNetBook,
  assetProjection,
  assetReconciliationDifference,
  assetReconciliationValues,
} from '../src/finance/selectors.ts';
import type { Asset, AssetReconciliation } from '../src/finance/types.ts';

function makeAsset(patch: Partial<Asset> = {}): Asset {
  return {
    id: 'af-test',
    code: 'AF-TEST',
    name: 'Activo de prueba',
    description: '',
    categoryId: 'cat-maq',
    serial: '',
    plate: '',
    location: '',
    costCenter: 'OPE',
    responsible: '',
    supplier: '',
    invoiceRef: '',
    acquisitionDate: '2020-01-01',
    inServiceDate: '2020-02-01',
    acquisitionCost: 120_000_000,
    improvements: 0,
    revaluation: 0,
    impairment: 0,
    residualValue: 0,
    usefulLifeMonths: 120,
    method: 'Línea recta',
    depreciatedMonths: 0,
    accumulatedDepreciation: 0,
    lastDepreciation: '',
    estimatedUnits: 0,
    producedUnits: 0,
    status: 'En operación',
    insurancePolicy: '',
    warrantyUntil: '',
    disposedAt: '',
    disposalValue: 0,
    notes: '',
    ...patch,
  };
}

function close(actual: number, expected: number, tolerance = 1) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `esperado ${expected}, recibido ${actual}`);
}

test('valor bruto, neto y base depreciable', () => {
  const asset = makeAsset({ acquisitionCost: 100_000_000, improvements: 10_000_000, revaluation: 20_000_000, impairment: 5_000_000, accumulatedDepreciation: 30_000_000, residualValue: 10_000_000 });
  assert.equal(assetGross(asset), 130_000_000);
  assert.equal(assetNetBook(asset), 95_000_000);
  assert.equal(assetDepreciableBase(asset), 115_000_000);
  close(assetDepreciationPct(asset), (30_000_000 / 115_000_000) * 100, 0.001);
});

test('línea recta sin revalorización', () => {
  const asset = makeAsset();
  close(assetMonthlyDepreciation(asset), 1_000_000);
  close(assetMonthlyDepreciation(makeAsset({ accumulatedDepreciation: 12_000_000, depreciatedMonths: 12 })), 1_000_000);
});

test('línea recta absorbe la revalorización sobre los meses restantes', () => {
  const asset = makeAsset({ revaluation: 24_000_000, accumulatedDepreciation: 12_000_000, depreciatedMonths: 12 });
  close(assetMonthlyDepreciation(asset), (144_000_000 - 12_000_000) / 108);
});

test('el deterioro reduce la base depreciable futura', () => {
  const asset = makeAsset({ impairment: 20_000_000 });
  assert.equal(assetDepreciableBase(asset), 100_000_000);
  close(assetMonthlyDepreciation(asset), 100_000_000 / 120);
});

test('saldos decrecientes usa el doble del lineal cuando no hay residual', () => {
  const asset = makeAsset({ method: 'Saldos decrecientes', usefulLifeMonths: 60, acquisitionCost: 68_000_000, accumulatedDepreciation: 32_293_200, depreciatedMonths: 19 });
  close(assetMonthlyDepreciation(asset), 35_706_800 * 0.4 / 12, 2);
});

test('unidades de producción aplica las unidades del periodo', () => {
  const asset = makeAsset({ method: 'Unidades de producción', acquisitionCost: 145_000_000, usefulLifeMonths: 120, estimatedUnits: 100_000, producedUnits: 34_000, accumulatedDepreciation: 49_300_000, depreciatedMonths: 34 });
  close(assetMonthlyDepreciation(asset, 1_100), 1_595_000);
  assert.equal(assetMonthlyDepreciation(asset, 0), 0);
});

test('un activo en montaje no deprecia', () => {
  assert.equal(assetMonthlyDepreciation(makeAsset({ status: 'En montaje' })), 0);
});

test('un activo totalmente depreciado no genera más cuota', () => {
  const asset = makeAsset({ accumulatedDepreciation: 120_000_000, depreciatedMonths: 120 });
  assert.equal(assetIsFullyDepreciated(asset), true);
  assert.equal(assetMonthlyDepreciation(asset), 0);
});

test('la proyección acumula doce cuotas lineales', () => {
  const rows = assetProjection(makeAsset(), 12);
  assert.equal(rows.length, 12);
  close(rows[0].amount, 1_000_000);
  close(rows[11].accumulated, 12_000_000, 10);
});

test('la conciliación compara el valor neto del mayor contra el sistema', () => {
  const assets = [
    makeAsset({ id: 'a', acquisitionCost: 100_000_000, accumulatedDepreciation: 40_000_000 }),
    makeAsset({ id: 'b', acquisitionCost: 50_000_000, accumulatedDepreciation: 10_000_000 }),
  ];
  const system = assetReconciliationValues(assets, 'cat-maq');
  assert.deepEqual(system, { gross: 150_000_000, accumulated: 50_000_000, impairment: 0, net: 100_000_000 });
  const reconciliation: AssetReconciliation = {
    id: 'r', period: '2026-01', categoryId: 'cat-maq',
    ledgerGross: 150_000_000, ledgerAccumulated: 48_000_000, ledgerImpairment: 0,
    status: 'Diferencia', note: '', checkedBy: '', checkedAt: '',
  };
  assert.equal(assetReconciliationDifference(assets, reconciliation), 2_000_000);
});

test('los activos vendidos no entran en los saldos de conciliación', () => {
  const assets = [
    makeAsset({ id: 'a', acquisitionCost: 100_000_000, accumulatedDepreciation: 40_000_000 }),
    makeAsset({ id: 'b', acquisitionCost: 50_000_000, status: 'Vendido' }),
  ];
  const system = assetReconciliationValues(assets, 'cat-maq');
  assert.equal(system.gross, 100_000_000);
  assert.equal(system.net, 60_000_000);
});
