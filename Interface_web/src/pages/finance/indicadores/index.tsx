import { useState } from 'react';
import type { NavPage } from '../../../components/Shell';
import Icon from '../../../components/Icon';
import { Button, PageHeader } from '../../../components/finance/ui';
import { FINANCIAL_MODULES } from '../../../data/finance';
import { useFinance } from '../../../finance/store';
import type { FinanceState, Indicator, Projection } from '../../../finance/types';
import {
  currentProjection,
  IndicatorEditor,
  newId,
  ProjectionEditor,
  type IndicatorActions,
} from './shared';
import Panel from './Panel';
import Catalogo from './Catalogo';
import Proyecciones from './Proyecciones';
import Escenarios from './Escenarios';
import Reportes from './Reportes';

interface Props {
  page: string;
  onNavigate: (page: NavPage) => void;
}

const MODULE = FINANCIAL_MODULES.indicadores;
const SLUGS = MODULE.nav.map(item => item.slug);

const HEADERS: Record<string, { title: string; subtitle: string }> = {
  panel: { title: 'Tablero gerencial', subtitle: 'Indicadores clave, escenario vigente y alertas de gestión.' },
  catalogo: { title: 'Catálogo de indicadores', subtitle: 'Definición, meta, valor actual y seguimiento por grupo.' },
  proyecciones: { title: 'Proyecciones financieras', subtitle: 'Estado de resultados proyectado mes a mes.' },
  escenarios: { title: 'Escenarios', subtitle: 'Comparación de versiones base, optimista y conservadora.' },
  reportes: { title: 'Informes gerenciales', subtitle: 'Resumen ejecutivo para el comité de dirección.' },
};

function nextIndicatorCode(state: FinanceState): string {
  return `IND-${String(state.indicators.length + 1).padStart(2, '0')}`;
}

function nextProjectionName(state: FinanceState): string {
  return `Proyección ${new Date().getFullYear()} V${state.projections.length + 1}`;
}

export default function Indicadores({ page, onNavigate }: Props) {
  const { state, update } = useFinance();
  const slug = page.split('/')[1] ?? 'panel';
  const activeSlug = SLUGS.includes(slug) ? slug : 'panel';

  const [toast, setToast] = useState('');
  const [indicatorModal, setIndicatorModal] = useState<Indicator | 'new' | null>(null);
  const [projectionModal, setProjectionModal] = useState(false);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(''), 3800);
  }

  function createIndicator(draft: Indicator) {
    if (state.indicators.some(indicator => indicator.code === draft.code)) {
      showToast(`El código ${draft.code} ya existe.`);
      return;
    }
    update(stateDraft => {
      stateDraft.indicators.push({ ...draft, id: newId('ind') });
    }, `Indicador ${draft.code} creado`, 'indicadores');
    setIndicatorModal(null);
    showToast(`Indicador ${draft.name} creado.`);
  }

  function updateIndicator(id: string, patch: Partial<Indicator>) {
    update(draft => {
      const target = draft.indicators.find(indicator => indicator.id === id);
      if (target) Object.assign(target, patch);
    }, 'Indicador actualizado', 'indicadores');
    setIndicatorModal(null);
    showToast('Indicador actualizado.');
  }

  function createProjection(draft: Projection) {
    const id = newId('proj');
    const projection: Projection = {
      ...draft,
      id,
      current: state.projections.length === 0,
      lines: draft.lines.map((line, index) => ({ ...line, id: `${id}-${line.id}-${index}` })),
    };
    update(stateDraft => {
      if (projection.current) stateDraft.projections.forEach(item => { item.current = false; });
      stateDraft.projections.push(projection);
    }, `Proyección ${projection.name} creada`, 'indicadores');
    setProjectionModal(false);
    showToast(`Proyección ${projection.name} creada.`);
  }

  function setCurrentProjection(id: string) {
    update(draft => {
      draft.projections.forEach(projection => { projection.current = projection.id === id; });
    }, 'Proyección marcada como vigente', 'indicadores');
    showToast('Proyección vigente actualizada.');
  }

  const actions: IndicatorActions = {
    createIndicator,
    updateIndicator,
    createProjection,
    setCurrentProjection,
    showToast,
  };

  const header = HEADERS[activeSlug] ?? HEADERS.panel;
  const base = currentProjection(state) ?? state.projections[0];
  const action = (() => {
    if (activeSlug === 'catalogo') {
      return <Button variant="primary" onClick={() => setIndicatorModal('new')}><Icon name="plus" className="h-3.5 w-3.5" /> Nuevo indicador</Button>;
    }
    if (activeSlug === 'proyecciones' || activeSlug === 'escenarios') {
      return <Button variant="primary" disabled={!base} onClick={() => setProjectionModal(true)}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva proyección</Button>;
    }
    return undefined;
  })();

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-5">
      <PageHeader eyebrow="Indicadores y proyecciones" title={header.title} subtitle={header.subtitle} actions={action} />

      {activeSlug === 'panel' && <Panel state={state} onNavigate={onNavigate} />}
      {activeSlug === 'catalogo' && <Catalogo state={state} onCreate={() => setIndicatorModal('new')} onEdit={setIndicatorModal} />}
      {activeSlug === 'proyecciones' && <Proyecciones state={state} onCreate={() => setProjectionModal(true)} onSetCurrent={setCurrentProjection} />}
      {activeSlug === 'escenarios' && <Escenarios state={state} onSetCurrent={setCurrentProjection} />}
      {activeSlug === 'reportes' && <Reportes state={state} onExport={() => actions.showToast('Informe gerencial exportado (simulación).')} />}

      {indicatorModal && (
        <IndicatorEditor
          indicator={indicatorModal === 'new' ? undefined : indicatorModal}
          nextCode={nextIndicatorCode(state)}
          onClose={() => setIndicatorModal(null)}
          onSave={draft => {
            if (indicatorModal === 'new') createIndicator(draft);
            else updateIndicator(indicatorModal.id, draft);
          }}
        />
      )}

      {projectionModal && base && (
        <ProjectionEditor
          base={base}
          nextName={nextProjectionName(state)}
          onClose={() => setProjectionModal(false)}
          onSave={createProjection}
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
