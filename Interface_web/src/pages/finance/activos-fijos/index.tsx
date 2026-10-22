import { useMemo, useState } from 'react';
import type { NavPage } from '../../../components/Shell';
import Icon from '../../../components/Icon';
import { Button, PageHeader } from '../../../components/finance/ui';
import { USUARIO } from '../../../data/mock';
import { FINANCIAL_MODULES } from '../../../data/finance';
import { useFinance } from '../../../finance/store';
import {
  HOY,
  assetDepreciableBase,
  assetMonthlyDepreciation,
  assetNetBook,
  assetReconciliationDifference,
  assetReconciliationValues,
  isAssetActive,
} from '../../../finance/selectors';
import type {
  Asset,
  AssetCategory,
  AssetDisposal,
  AssetRevaluation,
  DepreciationEntry,
  FinanceState,
} from '../../../finance/types';
import {
  AssetDrawer,
  AssetEditor,
  CategoryEditor,
  DisposalEditor,
  ImpairmentEditor,
  ImprovementEditor,
  RejectModal,
  RevaluationEditor,
  newId,
  type AssetActions,
  type AssetDraft,
  type DisposalDraft,
  type RevaluationDraft,
} from './shared';
import Panel from './Panel';
import Registro from './Registro';
import Movimientos from './Movimientos';
import Depreciacion from './Depreciacion';
import Revalorizaciones from './Revalorizaciones';
import Bajas from './Bajas';
import Conciliacion from './Conciliacion';
import Traslados from './Traslados';
import Categorias from './Categorias';
import Reportes from './Reportes';

interface Props {
  page: string;
  onNavigate: (page: NavPage) => void;
}

const MODULE = FINANCIAL_MODULES['activos-fijos'];
const SLUGS = MODULE.nav.map(item => item.slug);

const HEADERS: Record<string, { title: string; subtitle: string }> = {
  panel: { title: 'Panel de activos', subtitle: 'Posición consolidada de propiedades, planta y equipo y alertas del ciclo de vida.' },
  registro: { title: 'Registro de activos', subtitle: 'Inventario completo con ficha técnica, valor en libros y trazabilidad contable.' },
  movimientos: { title: 'Registro contable', subtitle: 'Asientos de adquisición, mejoras, depreciación, revalorización y retiro.' },
  depreciacion: { title: 'Depreciación', subtitle: 'Cierre mensual por activo, historial de asientos y proyección de los próximos meses.' },
  revalorizaciones: { title: 'Revalorizaciones', subtitle: 'Avalúos técnicos, aprobación y registro del superávit en el patrimonio.' },
  bajas: { title: 'Bajas y retiros', subtitle: 'Ventas, obsolescencia, donaciones y pérdidas con cálculo del resultado contable.' },
  traslados: { title: 'Traslados de activos', subtitle: 'Cambio de ubicación, centro de costo y responsable con trazabilidad contable.' },
  conciliacion: { title: 'Conciliación con el mayor', subtitle: 'Cuadre por categoría entre el libro mayor y el valor en libros del módulo.' },
  categorias: { title: 'Categorías y políticas', subtitle: 'Cuentas PUC, vida útil contable y fiscal, valor residual y método de depreciación.' },
  reportes: { title: 'Reportes', subtitle: 'Libro de activos, cédula de depreciación y comparativo fiscal vs. NIIF.' },
};

const REVALUATION_ACCOUNT = '3805';
const GAIN_ACCOUNT = '4245';
const LOSS_ACCOUNT = '5395';

function nextAssetCode(state: FinanceState): string {
  const max = state.assets.reduce((value, asset) => {
    const number = Number(asset.code.replace(/\D/g, ''));
    return Number.isFinite(number) ? Math.max(value, number) : value;
  }, 0);
  return `AF-${String(max + 1).padStart(4, '0')}`;
}

function categoryOf(state: FinanceState, id: string): AssetCategory | undefined {
  return state.assetCategories.find(category => category.id === id);
}

export default function ActivosFijos({ page, onNavigate }: Props) {
  const { state, update } = useFinance();
  const slug = page.split('/')[1] ?? 'panel';
  const activeSlug = SLUGS.includes(slug) ? slug : 'panel';

  const [toast, setToast] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assetModal, setAssetModal] = useState<{ asset?: Asset } | null>(null);
  const [improvementFor, setImprovementFor] = useState<string | null>(null);
  const [impairmentFor, setImpairmentFor] = useState<string | null>(null);
  const [revaluationFor, setRevaluationFor] = useState<string | null>(null);
  const [disposalFor, setDisposalFor] = useState<string | null>(null);
  const [categoryModal, setCategoryModal] = useState<AssetCategory | 'new' | null>(null);
  const [rejection, setRejection] = useState<{ kind: 'reval' | 'disp'; id: string } | null>(null);

  const selected = selectedId ? state.assets.find(asset => asset.id === selectedId) ?? null : null;
  const nextCode = useMemo(() => nextAssetCode(state), [state]);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(''), 3800);
  }

  function createAsset(draft: AssetDraft) {
    if (state.assets.some(asset => asset.code === draft.code)) {
      showToast(`El código ${draft.code} ya existe.`);
      return;
    }
    const category = categoryOf(state, draft.categoryId);
    const id = newId('af');
    const asset: Asset = {
      ...draft,
      id,
      inServiceDate: draft.status === 'En montaje' ? '' : draft.inServiceDate,
      improvements: 0,
      revaluation: 0,
      impairment: 0,
      depreciatedMonths: 0,
      accumulatedDepreciation: 0,
      lastDepreciation: '',
      producedUnits: 0,
      disposedAt: '',
      disposalValue: 0,
    };
    update(stateDraft => {
      stateDraft.assets.unshift(asset);
      stateDraft.assetMovements.unshift({
        id: newId('mov'),
        assetId: id,
        date: draft.acquisitionDate,
        type: 'Adquisición',
        description: `Capitalización de ${draft.name}`,
        debitAccount: category?.assetAccount ?? '1516',
        creditAccount: '2205',
        amount: draft.acquisitionCost,
        reference: draft.invoiceRef || 'ACTA',
        user: USUARIO.nombre,
      });
    }, `Activo ${draft.code} capitalizado por ${draft.acquisitionCost.toLocaleString('es-CO')}`, 'activos-fijos');
    setAssetModal(null);
    showToast(`${draft.code} registrado. Se generó el asiento de adquisición.`);
  }

  function updateAsset(id: string, patch: Partial<Asset>, action: string) {
    update(draft => {
      const target = draft.assets.find(asset => asset.id === id);
      if (!target) return;
      Object.assign(target, patch);
      if (target.status === 'En operación' && target.inServiceDate === '') target.inServiceDate = HOY;
    }, action, 'activos-fijos');
    showToast('Cambios guardados en la ficha del activo.');
  }

  function putInService(id: string, date: string) {
    const asset = state.assets.find(item => item.id === id);
    if (!asset) return;
    update(draft => {
      const target = draft.assets.find(item => item.id === id);
      if (!target) return;
      target.status = 'En operación';
      target.inServiceDate = date;
      target.lastDepreciation = '';
    }, `Activo ${asset.code} puesto en servicio`, 'activos-fijos');
    showToast(`${asset.code} en operación desde ${date}. La depreciación inicia el mes siguiente.`);
  }

  function registerImprovement(id: string, amount: number, note: string, date: string) {
    const asset = state.assets.find(item => item.id === id);
    if (!asset || amount <= 0) return;
    const category = categoryOf(state, asset.categoryId);
    update(draft => {
      const target = draft.assets.find(item => item.id === id);
      if (!target) return;
      target.improvements += amount;
      draft.assetMovements.unshift({
        id: newId('mov'),
        assetId: id,
        date,
        type: 'Mejora',
        description: note,
        debitAccount: category?.assetAccount ?? '1516',
        creditAccount: '2205',
        amount,
        reference: `MEJ-${date}`,
        user: USUARIO.nombre,
      });
    }, `Mejora de ${asset.code} por ${amount.toLocaleString('es-CO')}`, 'activos-fijos');
    setImprovementFor(null);
    showToast(`Mejora registrada en ${asset.code}. Se recalculó la base depreciable.`);
  }

  function runDepreciation(period: string, units: Record<string, number>) {
    const targets = state.assets.filter(asset => {
      if (!isAssetActive(asset) || asset.status === 'En montaje' || asset.usefulLifeMonths <= 0) return false;
      if (state.depreciationEntries.some(entry => entry.assetId === asset.id && entry.period === period && entry.status === 'Contabilizada')) return false;
      return assetMonthlyDepreciation(asset, units[asset.id] ?? 0) > 0;
    });
    if (targets.length === 0) {
      showToast(`No hay activos pendientes de depreciación en ${period}.`);
      return;
    }
    update(draft => {
      for (const target of draft.assets) {
        if (!isAssetActive(target) || target.status === 'En montaje' || target.usefulLifeMonths <= 0) continue;
        const exists = draft.depreciationEntries.some(entry => entry.assetId === target.id && entry.period === period && entry.status === 'Contabilizada');
        if (exists) continue;
        const amount = Math.round(assetMonthlyDepreciation(target, units[target.id] ?? 0));
        if (amount <= 0) continue;
        const category = categoryOf(draft, target.categoryId);
        const accumulatedAfter = target.accumulatedDepreciation + amount;
        target.accumulatedDepreciation = accumulatedAfter;
        target.depreciatedMonths += 1;
        if (target.method === 'Unidades de producción') target.producedUnits += units[target.id] ?? 0;
        target.lastDepreciation = period;
        if (target.accumulatedDepreciation >= assetDepreciableBase(target) - 1) target.status = 'Totalmente depreciado';
        const entry: DepreciationEntry = {
          id: newId('dep'),
          period,
          assetId: target.id,
          amount,
          accumulatedAfter,
          status: 'Contabilizada',
          postedAt: HOY,
          costCenter: target.costCenter,
          account: category?.depreciationAccount ?? '5160',
        };
        draft.depreciationEntries.unshift(entry);
        draft.assetMovements.unshift({
          id: newId('mov'),
          assetId: target.id,
          date: HOY,
          type: 'Depreciación',
          description: `Depreciación de ${period}`,
          debitAccount: entry.account,
          creditAccount: category?.accumulatedAccount ?? '1592',
          amount,
          reference: `DEP-${period}`,
          user: 'Sistema',
        });
      }
    }, `Depreciación ${period} contabilizada para ${targets.length} activos`, 'activos-fijos');
    showToast(`Depreciación de ${period} contabilizada para ${targets.length} activos.`);
  }

  function reverseDepreciation(period: string) {
    const entries = state.depreciationEntries.filter(entry => entry.period === period && entry.status === 'Contabilizada');
    if (entries.length === 0) {
      showToast(`No hay asientos contabilizados en ${period}.`);
      return;
    }
    update(draft => {
      for (const entry of draft.depreciationEntries.filter(item => item.period === period && item.status === 'Contabilizada')) {
        const asset = draft.assets.find(item => item.id === entry.assetId);
        if (!asset) continue;
        const category = categoryOf(draft, asset.categoryId);
        asset.accumulatedDepreciation = Math.max(0, asset.accumulatedDepreciation - entry.amount);
        asset.depreciatedMonths = Math.max(0, asset.depreciatedMonths - 1);
        if (asset.status === 'Totalmente depreciado') asset.status = 'En operación';
        const previous = draft.depreciationEntries
          .filter(item => item.assetId === asset.id && item.status === 'Contabilizada' && item.period !== period)
          .sort((a, b) => b.period.localeCompare(a.period))[0];
        asset.lastDepreciation = previous?.period ?? '';
        entry.status = 'Reversada';
        draft.assetMovements.unshift({
          id: newId('mov'),
          assetId: asset.id,
          date: HOY,
          type: 'Ajuste',
          description: `Reversión de la depreciación de ${period}`,
          debitAccount: category?.accumulatedAccount ?? '1592',
          creditAccount: entry.account,
          amount: entry.amount,
          reference: `REV-DEP-${period}`,
          user: USUARIO.nombre,
        });
      }
    }, `Depreciación ${period} revertida`, 'activos-fijos');
    showToast(`Depreciación de ${period} revertida en ${entries.length} activos.`);
  }

  function registerImpairment(id: string, amount: number, note: string, date: string) {
    const asset = state.assets.find(item => item.id === id);
    if (!asset || amount <= 0) return;
    const category = categoryOf(state, asset.categoryId);
    const applied = Math.min(amount, Math.max(0, assetNetBook(asset)));
    if (applied <= 0) {
      showToast('El activo no tiene valor neto disponible para deteriorar.');
      return;
    }
    update(draft => {
      const target = draft.assets.find(item => item.id === id);
      if (!target) return;
      target.impairment += applied;
      draft.assetMovements.unshift({
        id: newId('mov'),
        assetId: id,
        date,
        type: 'Deterioro',
        description: note,
        debitAccount: '5199',
        creditAccount: category?.impairmentAccount ?? '1596',
        amount: applied,
        reference: `DET-${date}`,
        user: USUARIO.nombre,
      });
    }, `Deterioro de ${asset.code} por ${applied.toLocaleString('es-CO')}`, 'activos-fijos');
    setImpairmentFor(null);
    showToast(`Deterioro registrado en ${asset.code}. La base depreciable quedó reducida.`);
  }

  function createRevaluation(draft: RevaluationDraft) {
    const asset = state.assets.find(item => item.id === draft.assetId);
    if (!asset) return;
    const current = assetNetBook(asset);
    const surplus = draft.newValue - current;
    const revaluation: AssetRevaluation = {
      id: newId('rev'),
      assetId: draft.assetId,
      date: draft.date,
      previousValue: current,
      newValue: draft.newValue,
      surplus,
      appraiser: draft.appraiser,
      report: draft.report,
      status: 'Borrador',
      approvedBy: '',
      note: draft.note,
    };
    update(stateDraft => {
      stateDraft.revaluations.unshift(revaluation);
    }, `Revalorización ${draft.report} creada para ${asset.code}`, 'activos-fijos');
    setRevaluationFor(null);
    showToast(`Revalorización ${draft.report} en borrador. Superávit calculado: ${surplus.toLocaleString('es-CO')}.`);
  }

  function approveRevaluation(id: string) {
    const revaluation = state.revaluations.find(item => item.id === id);
    if (!revaluation) return;
    update(draft => {
      const target = draft.revaluations.find(item => item.id === id);
      if (!target) return;
      target.status = 'Aprobada';
      target.approvedBy = USUARIO.nombre;
    }, `Revalorización ${revaluation.report} aprobada`, 'activos-fijos');
    showToast(`Revalorización ${revaluation.report} aprobada. Queda pendiente de aplicación.`);
  }

  function applyRevaluation(id: string) {
    const revaluation = state.revaluations.find(item => item.id === id);
    if (!revaluation || revaluation.status === 'Aplicada') return;
    const asset = state.assets.find(item => item.id === revaluation.assetId);
    if (!asset) return;
    const category = categoryOf(state, asset.categoryId);
    update(draft => {
      const target = draft.revaluations.find(item => item.id === id);
      const targetAsset = draft.assets.find(item => item.id === revaluation.assetId);
      if (!target || !targetAsset) return;
      let remaining = target.surplus;
      if (remaining > 0 && targetAsset.impairment > 0) {
        const reversal = Math.min(targetAsset.impairment, remaining);
        targetAsset.impairment -= reversal;
        remaining -= reversal;
        draft.assetMovements.unshift({
          id: newId('mov'),
          assetId: targetAsset.id,
          date: target.date,
          type: 'Ajuste',
          description: `Reversión de deterioro por revalorización · ${target.report}`,
          debitAccount: category?.impairmentAccount ?? '1596',
          creditAccount: '5199',
          amount: reversal,
          reference: target.report,
          user: USUARIO.nombre,
        });
      }
      targetAsset.revaluation += remaining;
      target.status = 'Aplicada';
      target.approvedBy = target.approvedBy || USUARIO.nombre;
      if (Math.abs(remaining) > 0) {
        draft.assetMovements.unshift({
          id: newId('mov'),
          assetId: targetAsset.id,
          date: target.date,
          type: 'Revalorización',
          description: `${remaining >= 0 ? 'Superávit' : 'Déficit'} por revalorización · ${target.report}`,
          debitAccount: remaining >= 0 ? (category?.assetAccount ?? '1516') : (category?.revaluationAccount ?? REVALUATION_ACCOUNT),
          creditAccount: remaining >= 0 ? (category?.revaluationAccount ?? REVALUATION_ACCOUNT) : (category?.assetAccount ?? '1516'),
          amount: Math.abs(remaining),
          reference: target.report,
          user: USUARIO.nombre,
        });
      }
    }, `Revalorización ${revaluation.report} aplicada`, 'activos-fijos');
    showToast(`Revalorización ${revaluation.report} aplicada. El superávit quedó en el patrimonio.`);
  }

  function rejectRevaluation(id: string, note: string) {
    const revaluation = state.revaluations.find(item => item.id === id);
    if (!revaluation) return;
    update(draft => {
      const target = draft.revaluations.find(item => item.id === id);
      if (!target) return;
      target.status = 'Rechazada';
      target.note = `${target.note} · Rechazo: ${note}`;
    }, `Revalorización ${revaluation.report} rechazada`, 'activos-fijos');
    setRejection(null);
    showToast(`Revalorización ${revaluation.report} rechazada.`);
  }

  function createDisposal(draft: DisposalDraft) {
    const asset = state.assets.find(item => item.id === draft.assetId);
    if (!asset) return;
    const netBookValue = assetNetBook(asset);
    const disposal: AssetDisposal = {
      id: newId('disp'),
      assetId: draft.assetId,
      date: draft.date,
      type: draft.type,
      proceeds: draft.proceeds,
      netBookValue,
      gainLoss: draft.proceeds - netBookValue,
      status: 'Solicitada',
      requestedBy: USUARIO.nombre,
      approvedBy: '',
      note: draft.note,
      invoiceRef: draft.invoiceRef,
    };
    update(stateDraft => {
      stateDraft.disposals.unshift(disposal);
    }, `Baja solicitada para ${asset.code}`, 'activos-fijos');
    setDisposalFor(null);
    showToast(`Solicitud de baja de ${asset.code} enviada a aprobación.`);
  }

  function approveDisposal(id: string) {
    const disposal = state.disposals.find(item => item.id === id);
    if (!disposal) return;
    update(draft => {
      const target = draft.disposals.find(item => item.id === id);
      if (!target) return;
      target.status = 'Aprobada';
      target.approvedBy = USUARIO.nombre;
    }, `Baja aprobada para ${disposal.assetId}`, 'activos-fijos');
    showToast('Baja aprobada. Queda pendiente de aplicación contable.');
  }

  function applyDisposal(id: string) {
    const disposal = state.disposals.find(item => item.id === id);
    if (!disposal || disposal.status === 'Aplicada') return;
    const asset = state.assets.find(item => item.id === disposal.assetId);
    if (!asset) return;
    const category = categoryOf(state, asset.categoryId);
    const netBookValue = assetNetBook(asset);
    const gainLoss = disposal.proceeds - netBookValue;
    update(draft => {
      const target = draft.disposals.find(item => item.id === id);
      const targetAsset = draft.assets.find(item => item.id === disposal.assetId);
      if (!target || !targetAsset) return;
      target.status = 'Aplicada';
      target.netBookValue = netBookValue;
      target.gainLoss = gainLoss;
      targetAsset.status = target.type === 'Venta' ? 'Vendido' : 'Dado de baja';
      targetAsset.disposedAt = target.date;
      targetAsset.disposalValue = target.proceeds;
      draft.assetMovements.unshift({
        id: newId('mov'),
        assetId: targetAsset.id,
        date: target.date,
        type: target.type === 'Venta' ? 'Venta' : 'Baja',
        description: `Retiro del activo · valor en libros ${netBookValue.toLocaleString('es-CO')} · resultado ${gainLoss.toLocaleString('es-CO')}`,
        debitAccount: `${category?.accumulatedAccount ?? '1592'} / 1110 / ${gainLoss >= 0 ? GAIN_ACCOUNT : LOSS_ACCOUNT}`,
        creditAccount: category?.assetAccount ?? '1516',
        amount: targetAsset.acquisitionCost + targetAsset.improvements + targetAsset.revaluation,
        reference: target.invoiceRef || `ACTA-${target.date}`,
        user: USUARIO.nombre,
      });
      targetAsset.notes = `${targetAsset.notes}${targetAsset.notes ? ' · ' : ''}Baja ${target.type.toLowerCase()} aplicada el ${target.date}.`;
    }, `Baja aplicada para ${asset.code}`, 'activos-fijos');
    showToast(`Baja de ${asset.code} aplicada. Resultado contable: ${gainLoss.toLocaleString('es-CO')}.`);
  }

  function rejectDisposal(id: string, note: string) {
    const disposal = state.disposals.find(item => item.id === id);
    if (!disposal) return;
    update(draft => {
      const target = draft.disposals.find(item => item.id === id);
      if (!target) return;
      target.status = 'Rechazada';
      target.note = `${target.note} · Rechazo: ${note}`;
    }, `Baja rechazada para ${disposal.assetId}`, 'activos-fijos');
    setRejection(null);
    showToast('Solicitud de baja rechazada.');
  }

  function reconcile(id: string, note: string) {
    const reconciliation = state.assetReconciliations.find(item => item.id === id);
    if (!reconciliation) return;
    const difference = assetReconciliationDifference(state.assets, reconciliation);
    if (Math.abs(difference) >= 1) {
      showToast('La categoría tiene diferencias. Registre un ajuste antes de conciliar.');
      return;
    }
    update(draft => {
      const target = draft.assetReconciliations.find(item => item.id === id);
      if (!target) return;
      const system = assetReconciliationValues(draft.assets, target.categoryId);
      target.ledgerGross = system.gross;
      target.ledgerAccumulated = system.accumulated;
      target.ledgerImpairment = system.impairment;
      target.status = 'Conciliada';
      target.note = note;
      target.checkedBy = USUARIO.nombre;
      target.checkedAt = HOY;
    }, `Conciliación ${reconciliation.period} marcada como conciliada`, 'activos-fijos');
    showToast('Categoría conciliada contra el libro mayor.');
  }

  function adjustReconciliation(id: string, note: string) {
    const reconciliation = state.assetReconciliations.find(item => item.id === id);
    if (!reconciliation) return;
    const category = categoryOf(state, reconciliation.categoryId);
    const difference = assetReconciliationDifference(state.assets, reconciliation);
    update(draft => {
      const target = draft.assetReconciliations.find(item => item.id === id);
      if (!target) return;
      const system = assetReconciliationValues(draft.assets, target.categoryId);
      target.ledgerGross = system.gross;
      target.ledgerAccumulated = system.accumulated;
      target.ledgerImpairment = system.impairment;
      target.status = 'Conciliada';
      target.note = note;
      target.checkedBy = USUARIO.nombre;
      target.checkedAt = HOY;
      if (Math.abs(difference) >= 1) {
        draft.assetMovements.unshift({
          id: newId('mov'),
          assetId: draft.assets.find(asset => asset.categoryId === target.categoryId)?.id ?? '',
          date: HOY,
          type: 'Ajuste',
          description: `Ajuste de conciliación ${target.period} · ${category?.name ?? target.categoryId}`,
          debitAccount: difference > 0 ? (category?.depreciationAccount ?? '5160') : (category?.accumulatedAccount ?? '1592'),
          creditAccount: difference > 0 ? (category?.accumulatedAccount ?? '1592') : (category?.depreciationAccount ?? '5160'),
          amount: Math.abs(difference),
          reference: `AJUSTE-${target.period}`,
          user: USUARIO.nombre,
        });
      }
    }, `Ajuste de conciliación ${reconciliation.period}`, 'activos-fijos');
    showToast('Ajuste contable registrado y categoría conciliada.');
  }

  function createCategory(draft: Omit<AssetCategory, 'id'>) {
    const category: AssetCategory = { ...draft, id: newId('cat') };
    update(stateDraft => {
      stateDraft.assetCategories.push(category);
    }, `Categoría ${draft.code} creada`, 'activos-fijos');
    setCategoryModal(null);
    showToast(`Categoría ${draft.name} creada.`);
  }

  function updateCategory(id: string, patch: Partial<AssetCategory>) {
    update(draft => {
      const target = draft.assetCategories.find(category => category.id === id);
      if (!target) return;
      Object.assign(target, patch);
    }, `Categoría de activo actualizada`, 'activos-fijos');
    setCategoryModal(null);
    showToast('Política de la categoría actualizada.');
  }

  const actions: AssetActions = {
    createAsset,
    updateAsset,
    putInService,
    registerImprovement,
    registerImpairment,
    runDepreciation,
    reverseDepreciation,
    createRevaluation,
    approveRevaluation,
    applyRevaluation,
    rejectRevaluation,
    createDisposal,
    approveDisposal,
    applyDisposal,
    rejectDisposal,
    reconcile,
    adjustReconciliation,
    createCategory,
    updateCategory,
    showToast,
  };

  const header = HEADERS[activeSlug] ?? HEADERS.panel;
  const action = (() => {
    if (activeSlug === 'panel' || activeSlug === 'registro') {
      return <Button variant="primary" onClick={() => setAssetModal({})}><Icon name="plus" className="h-3.5 w-3.5" /> Nuevo activo</Button>;
    }
    if (activeSlug === 'movimientos') {
      return <div className="flex gap-2"><Button onClick={() => setImprovementFor('')}>Registrar mejora</Button><Button variant="primary" onClick={() => setAssetModal({})}><Icon name="plus" className="h-3.5 w-3.5" /> Registrar adquisición</Button></div>;
    }
    if (activeSlug === 'revalorizaciones') {
      return <Button variant="primary" onClick={() => setRevaluationFor('')}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva revalorización</Button>;
    }
    if (activeSlug === 'bajas') {
      return <Button variant="primary" onClick={() => setDisposalFor('')}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva baja</Button>;
    }
    if (activeSlug === 'categorias') {
      return <Button variant="primary" onClick={() => setCategoryModal('new')}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva categoría</Button>;
    }
    return undefined;
  })();

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-5">
      <PageHeader eyebrow="Activos fijos" title={header.title} subtitle={header.subtitle} actions={action} />

      {activeSlug === 'panel' && <Panel state={state} onNavigate={onNavigate} onNew={() => setAssetModal({})} />}
      {activeSlug === 'registro' && <Registro state={state} onOpen={setSelectedId} onNew={() => setAssetModal({})} />}
      {activeSlug === 'movimientos' && <Movimientos state={state} onOpen={setSelectedId} onNewAsset={() => setAssetModal({})} onImprove={() => setImprovementFor('')} />}
      {activeSlug === 'depreciacion' && <Depreciacion state={state} actions={actions} />}
      {activeSlug === 'revalorizaciones' && (
        <Revalorizaciones
          state={state}
          actions={actions}
          onCreate={() => setRevaluationFor('')}
          onReject={id => setRejection({ kind: 'reval', id })}
          onOpenAsset={setSelectedId}
        />
      )}
      {activeSlug === 'bajas' && (
        <Bajas
          state={state}
          actions={actions}
          onCreate={() => setDisposalFor('')}
          onReject={id => setRejection({ kind: 'disp', id })}
          onOpenAsset={setSelectedId}
        />
      )}
      {activeSlug === 'conciliacion' && <Conciliacion state={state} actions={actions} />}
      {activeSlug === 'traslados' && <Traslados showToast={showToast} />}
      {activeSlug === 'categorias' && <Categorias state={state} actions={actions} onCreate={() => setCategoryModal('new')} onEdit={setCategoryModal} />}
      {activeSlug === 'reportes' && <Reportes state={state} actions={actions} />}

      {selected && (
        <AssetDrawer
          state={state}
          asset={selected}
          actions={actions}
          onClose={() => setSelectedId(null)}
          onEdit={asset => { setSelectedId(null); setAssetModal({ asset }); }}
          onImprove={asset => { setSelectedId(null); setImprovementFor(asset.id); }}
          onRevalue={asset => { setSelectedId(null); setRevaluationFor(asset.id); }}
          onImpair={asset => { setSelectedId(null); setImpairmentFor(asset.id); }}
          onDispose={asset => { setSelectedId(null); setDisposalFor(asset.id); }}
        />
      )}

      {assetModal && (
        <AssetEditor
          state={state}
          nextCode={nextCode}
          asset={assetModal.asset}
          onClose={() => setAssetModal(null)}
          onSave={draft => {
            if (assetModal.asset) {
              updateAsset(assetModal.asset.id, draft, `Activo ${draft.code} actualizado`);
              setAssetModal(null);
            } else {
              createAsset(draft);
            }
          }}
        />
      )}
      {improvementFor !== null && <ImprovementEditor state={state} assetId={improvementFor || undefined} onClose={() => setImprovementFor(null)} onSave={registerImprovement} />}
      {impairmentFor !== null && <ImpairmentEditor state={state} assetId={impairmentFor || undefined} onClose={() => setImpairmentFor(null)} onSave={registerImpairment} />}
      {revaluationFor !== null && <RevaluationEditor state={state} assetId={revaluationFor || undefined} onClose={() => setRevaluationFor(null)} onSave={createRevaluation} />}
      {disposalFor !== null && <DisposalEditor state={state} assetId={disposalFor || undefined} onClose={() => setDisposalFor(null)} onSave={createDisposal} />}
      {categoryModal && (
        <CategoryEditor
          category={categoryModal === 'new' ? undefined : categoryModal}
          onClose={() => setCategoryModal(null)}
          onSave={draft => {
            if (categoryModal === 'new') createCategory(draft);
            else updateCategory(categoryModal.id, draft);
          }}
        />
      )}
      {rejection && (
        <RejectModal
          title={rejection.kind === 'reval' ? 'Rechazar revalorización' : 'Rechazar solicitud de baja'}
          onClose={() => setRejection(null)}
          onReject={note => rejection.kind === 'reval' ? rejectRevaluation(rejection.id, note) : rejectDisposal(rejection.id, note)}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-xl bg-[#001F4C] px-4 py-3 text-xs text-white shadow-2xl">
          <Icon name="check" className="h-4 w-4 text-emerald-300" />
          {toast}
        </div>
      )}
    </div>
  );
}
