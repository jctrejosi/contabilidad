import { useState } from 'react';
import type { NavPage } from '../../../components/Shell';
import Icon from '../../../components/Icon';
import { Button, PageHeader } from '../../../components/finance/ui';
import { USUARIO } from '../../../data/mock';
import { FINANCIAL_MODULES } from '../../../data/finance';
import { useFinance } from '../../../finance/store';
import { HOY } from '../../../finance/selectors';
import type {
  CostCenter,
  CostObject,
  FinanceState,
} from '../../../finance/types';
import {
  CostCenterEditor,
  CostObjectEditor,
  driverBasis,
  newId,
  type CostActions,
} from './shared';
import Panel from './Panel';
import Centros from './Centros';
import Cif from './Cif';
import Estandar from './Estandar';
import Abc from './Abc';
import Proyectos from './Proyectos';
import Secundaria from './Secundaria';
import Reportes from './Reportes';

interface Props {
  page: string;
  onNavigate: (page: NavPage) => void;
}

const MODULE = FINANCIAL_MODULES.costos;
const SLUGS = MODULE.nav.map(item => item.slug);

const HEADERS: Record<string, { title: string; subtitle: string }> = {
  panel: { title: 'Panel de costos', subtitle: 'Costo acumulado, distribución de CIF y variaciones del período.' },
  centros: { title: 'Centros y conductores', subtitle: 'Catálogo de centros, inductores y bases de distribución.' },
  cif: { title: 'Distribución de CIF', subtitle: 'Reparto de costos indirectos desde los pools hacia los centros de costo.' },
  secundaria: { title: 'Distribución secundaria', subtitle: 'Costos de centros de servicio redistribuidos a los centros de producción.' },
  estandar: { title: 'Costeo estándar', subtitle: 'Costo estándar, costo real y descomposición de variaciones de precio y cantidad.' },
  abc: { title: 'Costeo ABC', subtitle: 'Actividades, conductores y asignación a objetos de costo.' },
  proyectos: { title: 'Costos por proyecto', subtitle: 'Acumulación de costos y margen por proyecto.' },
  reportes: { title: 'Reportes de costo', subtitle: 'Comparativos, márgenes y participación por centro.' },
};

function nextCenterCode(state: FinanceState): string {
  return `CC-${String(state.costCenters.length + 1).padStart(3, '0')}`;
}

function nextObjectCode(state: FinanceState): string {
  const max = state.costObjects.reduce((value, object) => {
    const number = Number(object.code.replace(/\D/g, ''));
    return Number.isFinite(number) ? Math.max(value, number) : value;
  }, 0);
  return `CO-${String(max + 1).padStart(3, '0')}`;
}

export default function Costos({ page, onNavigate }: Props) {
  const { state, update } = useFinance();
  const slug = page.split('/')[1] ?? 'panel';
  const activeSlug = SLUGS.includes(slug) ? slug : 'panel';

  const [toast, setToast] = useState('');
  const [centerModal, setCenterModal] = useState<CostCenter | 'new' | null>(null);
  const [objectModal, setObjectModal] = useState<CostObject | 'new' | null>(null);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(''), 3800);
  }

  function createCenter(draft: CostCenter) {
    if (state.costCenters.some(center => center.code === draft.code)) {
      showToast(`El código ${draft.code} ya existe.`);
      return;
    }
    update(stateDraft => {
      stateDraft.costCenters.push({ ...draft, id: newId('cc') });
    }, `Centro de costo ${draft.code} creado`, 'costos');
    setCenterModal(null);
    showToast(`Centro ${draft.name} creado.`);
  }

  function updateCenter(id: string, patch: Partial<CostCenter>) {
    update(draft => {
      const target = draft.costCenters.find(center => center.id === id);
      if (target) Object.assign(target, patch);
    }, `Centro de costo actualizado`, 'costos');
    setCenterModal(null);
    showToast('Centro de costo actualizado.');
  }

  function createObject(draft: CostObject) {
    if (state.costObjects.some(object => object.code === draft.code)) {
      showToast(`El código ${draft.code} ya existe.`);
      return;
    }
    update(stateDraft => {
      stateDraft.costObjects.push({ ...draft, id: newId('co') });
    }, `Objeto de costo ${draft.code} creado`, 'costos');
    setObjectModal(null);
    showToast(`Objeto ${draft.name} creado.`);
  }

  function updateObject(id: string, patch: Partial<CostObject>) {
    update(draft => {
      const target = draft.costObjects.find(object => object.id === id);
      if (target) Object.assign(target, patch);
    }, `Objeto de costo actualizado`, 'costos');
    setObjectModal(null);
    showToast('Objeto de costo actualizado.');
  }

  function distributePool(poolId: string) {
    const pool = state.costPools.find(item => item.id === poolId);
    if (!pool) return;
    const centers = state.costCenters.filter(center => center.status === 'Activo');
    const bases = centers.map(center => ({ center, basis: driverBasis(center, pool.driver) }));
    const totalBasis = bases.reduce((total, item) => total + item.basis, 0);
    if (totalBasis <= 0) {
      showToast('Los centros no tienen una base de distribución mayor que cero.');
      return;
    }

    update(draft => {
      draft.costAllocations = draft.costAllocations.filter(item => !(item.poolId === poolId && item.period === pool.period));
      let assigned = 0;
      bases.forEach((item, index) => {
        const isLast = index === bases.length - 1;
        const amount = isLast ? pool.amount - assigned : Math.round((pool.amount * item.basis) / totalBasis);
        assigned += amount;
        draft.costAllocations.push({
          id: newId('cal'),
          poolId,
          centerId: item.center.id,
          driverQty: item.basis,
          amount,
          period: pool.period,
          date: HOY,
        });
      });
      draft.costRuns.unshift({
        id: newId('cr'),
        number: `CR-${HOY.slice(0, 4)}-${String(draft.costRuns.length + 1).padStart(3, '0')}`,
        date: HOY,
        period: pool.period,
        method: 'CIF',
        total: pool.amount,
        status: 'Calculada',
        user: USUARIO.nombre,
      });
    }, `Pool ${pool.code} distribuido`, 'costos');

    showToast(`${pool.name} distribuido entre ${centers.length} centros.`);
  }

  function runAbc() {
    const total = state.costActivities.reduce((value, activity) => value + activity.totalCost, 0);
    update(draft => {
      draft.costRuns.unshift({
        id: newId('cr'),
        number: `CR-${HOY.slice(0, 4)}-${String(draft.costRuns.length + 1).padStart(3, '0')}`,
        date: HOY,
        period: '2026-02',
        method: 'ABC',
        total,
        status: 'Calculada',
        user: USUARIO.nombre,
      });
    }, 'Corrida de costeo ABC ejecutada', 'costos');
    showToast(`Costeo ABC ejecutado por ${total.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}.`);
  }

  function closeRun() {
    const target = state.costRuns.find(run => run.status === 'Calculada');
    if (!target) return;
    update(draft => {
      const run = draft.costRuns.find(item => item.id === target.id);
      if (run) run.status = 'Contabilizada';
    }, `Corrida ${target.number} contabilizada`, 'costos');
    showToast(`Corrida ${target.number} contabilizada.`);
  }

  const actions: CostActions = {
    createCenter,
    updateCenter,
    createObject,
    updateObject,
    distributePool,
    runAbc,
    closeRun,
    showToast,
  };

  const header = HEADERS[activeSlug] ?? HEADERS.panel;
  const action = (() => {
    if (activeSlug === 'centros') {
      return <Button variant="primary" onClick={() => setCenterModal('new')}><Icon name="plus" className="h-3.5 w-3.5" /> Nuevo centro</Button>;
    }
    if (activeSlug === 'panel' || activeSlug === 'estandar' || activeSlug === 'proyectos') {
      return <Button variant="primary" onClick={() => setObjectModal('new')}><Icon name="plus" className="h-3.5 w-3.5" /> Nuevo objeto de costo</Button>;
    }
    return undefined;
  })();

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-5">
      <PageHeader eyebrow="Costos" title={header.title} subtitle={header.subtitle} actions={action} />

      {activeSlug === 'panel' && <Panel state={state} onNavigate={onNavigate} />}
      {activeSlug === 'centros' && <Centros state={state} onCreate={() => setCenterModal('new')} onEdit={setCenterModal} />}
      {activeSlug === 'cif' && <Cif state={state} onDistribute={actions.distributePool} onCloseRun={actions.closeRun} />}
      {activeSlug === 'secundaria' && <Secundaria state={state} showToast={showToast} />}
      {activeSlug === 'estandar' && <Estandar state={state} onCreate={() => setObjectModal('new')} onOpen={setObjectModal} />}
      {activeSlug === 'abc' && <Abc state={state} onRun={actions.runAbc} />}
      {activeSlug === 'proyectos' && <Proyectos state={state} />}
      {activeSlug === 'reportes' && <Reportes state={state} actions={actions} />}

      {centerModal && (
        <CostCenterEditor
          center={centerModal === 'new' ? undefined : centerModal}
          nextCode={nextCenterCode(state)}
          onClose={() => setCenterModal(null)}
          onSave={draft => {
            if (centerModal === 'new') createCenter(draft);
            else updateCenter(centerModal.id, draft);
          }}
        />
      )}

      {objectModal && (
        <CostObjectEditor
          object={objectModal === 'new' ? undefined : objectModal}
          centers={state.costCenters.filter(center => center.status === 'Activo')}
          nextCode={nextObjectCode(state)}
          onClose={() => setObjectModal(null)}
          onSave={draft => {
            if (objectModal === 'new') createObject(draft);
            else updateObject(objectModal.id, draft);
          }}
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
