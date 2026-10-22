import { useMemo, useState } from 'react';
import Icon from '../../../components/Icon';
import {
  Badge,
  BarChart,
  Button,
  Card,
  DataTable,
  Field,
  FilterSelect,
  INPUT,
  KpiCard,
  Modal,
  Money,
  Progress,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import { USUARIO } from '../../../data/mock';
import { useFinance } from '../../../finance/store';
import { HOY, MESES_CORTOS, money, periodLabel, periodOf } from '../../../finance/selectors';
import type { BudgetProjection, BudgetVersion } from '../../../finance/types';

const CURRENT_MONTH = Number(periodOf(HOY).split('-')[1]) - 1;
const CENTERS = ['ADM', 'OPE', 'VEN', 'TI', 'PROD'];

export default function Proyectos({
  version,
  showToast,
}: {
  version: BudgetVersion;
  showToast: (text: string) => void;
}) {
  const { state, update } = useFinance();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const rows = useMemo(
    () => state.budgetProjections.filter(row => row.versionId === version.id),
    [state.budgetProjections, version.id],
  );

  const selected = rows.find(row => row.id === selectedId) ?? rows[0];

  function remaining(row: BudgetProjection) {
    return row.monthly.slice(CURRENT_MONTH + 1).reduce((total, value) => total + value, 0);
  }

  function projected(row: BudgetProjection) {
    return row.executed + remaining(row);
  }

  const totalBudget = rows.reduce((total, row) => total + row.budget, 0);
  const totalExecuted = rows.reduce((total, row) => total + row.executed, 0);
  const totalProjected = rows.reduce((total, row) => total + projected(row), 0);
  const deviation = totalBudget === 0 ? 0 : ((totalProjected - totalBudget) / totalBudget) * 100;

  function create(payload: {
    project: string;
    center: string;
    owner: string;
    budget: number;
    note: string;
  }) {
    const monthly = Array.from({ length: 12 }, (_, index) => (
      index < CURRENT_MONTH + 1 ? 0 : Math.round(payload.budget / Math.max(1, 11 - CURRENT_MONTH))
    ));
    const record: BudgetProjection = {
      id: `bproj-${Date.now()}`,
      versionId: version.id,
      project: payload.project,
      center: payload.center,
      owner: payload.owner,
      budget: payload.budget,
      executed: 0,
      monthly,
      status: 'En curso',
      note: payload.note,
    };
    update(draft => {
      draft.budgetProjections.unshift(record);
    }, `Proyección del proyecto ${payload.project} creada`, 'presupuesto');
    setOpen(false);
    setSelectedId(record.id);
    showToast(`Proyecto ${payload.project} agregado a la proyección.`);
  }

  const columns: Column<BudgetProjection>[] = [
    {
      header: 'Proyecto',
      cell: row => (
        <div>
          <div className="font-medium text-gray-800">{row.project}</div>
          <div className="text-[10px] text-gray-400">{row.center} · {row.owner}</div>
        </div>
      ),
    },
    { header: 'Presupuesto', align: 'right', cell: row => <Money value={row.budget} /> },
    { header: 'Ejecutado', align: 'right', cell: row => <Money value={row.executed} /> },
    {
      header: 'Avance',
      cell: row => (
        <Progress
          value={row.budget === 0 ? 0 : (row.executed / row.budget) * 100}
          tone={row.executed > row.budget ? 'red' : 'blue'}
          label="Ejecución"
        />
      ),
    },
    { header: 'Proyección anual', align: 'right', cell: row => <Money value={projected(row)} className="font-semibold" /> },
    {
      header: 'Desviación',
      align: 'right',
      cell: row => {
        const value = row.budget === 0 ? 0 : ((projected(row) - row.budget) / row.budget) * 100;
        return (
          <span className={value > 3 ? 'font-semibold text-red-700' : value < -3 ? 'text-emerald-700' : 'text-gray-600'}>
            {value.toFixed(1)} %
          </span>
        );
      },
    },
    {
      header: 'Estado',
      cell: row => (
        <Badge tone={row.status === 'Cerrado' ? 'gray' : row.status === 'Cierre estimado' ? 'violet' : 'green'}>
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Presupuesto por proyecto" value={<Money value={totalBudget} />} detail={`${rows.length} proyectos · ${version.name}`} tone="violet" />
        <KpiCard label="Ejecutado acumulado" value={<Money value={totalExecuted} />} detail="Al corte de febrero 2026" tone="cyan" />
        <KpiCard label="Proyección anual" value={<Money value={totalProjected} />} detail="Ejecutado más meses restantes" tone="blue" />
        <KpiCard label="Desviación proyectada" value={`${deviation.toFixed(1)} %`} detail={Math.abs(deviation) <= 3 ? 'Dentro del umbral' : 'Fuera del umbral del 3 %'} tone={Math.abs(deviation) <= 3 ? 'green' : 'red'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <SectionTitle
            title="Proyección por proyecto"
            detail="Presupuesto, ejecución y cierre estimado de cada iniciativa"
            action={
              <Button variant="primary" onClick={() => setOpen(true)}>
                <Icon name="plus" className="h-3.5 w-3.5" /> Nuevo proyecto
              </Button>
            }
          />
          <div className="p-4">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={row => row.id}
              onRowClick={row => setSelectedId(row.id)}
              empty="Esta versión no tiene proyectos con proyección."
              footer={
                <span className="text-[11px] text-gray-500">
                  La proyección anual combina lo ejecutado con los meses restantes del calendario.
                </span>
              }
            />
          </div>
        </Card>

        <Card>
          <SectionTitle
            title="Curva mensual del proyecto"
            detail={selected ? `${selected.project} · ${selected.center}` : 'Seleccione un proyecto'}
          />
          <div className="space-y-4 p-4">
            {selected ? (
              <>
                <BarChart
                  data={selected.monthly.map((value, index) => ({ label: MESES_CORTOS[index], value }))}
                  height={150}
                  tone="violet"
                />
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-gray-500">Presupuesto anual</dt>
                    <dd className="mt-0.5 font-semibold text-gray-900"><Money value={selected.budget} /></dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Ejecutado</dt>
                    <dd className="mt-0.5 font-semibold text-gray-900"><Money value={selected.executed} /></dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Meses restantes</dt>
                    <dd className="mt-0.5 font-semibold text-gray-900"><Money value={remaining(selected)} /></dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Proyección anual</dt>
                    <dd className="mt-0.5 font-semibold text-gray-900"><Money value={projected(selected)} /></dd>
                  </div>
                </dl>
                <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-[11px] text-violet-900">
                  {selected.note}
                </div>
                <div className="text-[10px] text-gray-400">
                  Responsable: {selected.owner} · corte {periodLabel(periodOf(HOY))}
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500">
                Cree un proyecto para ver su curva mensual y su proyección de cierre.
              </p>
            )}
          </div>
        </Card>
      </div>

      {open && <ProjectModal onClose={() => setOpen(false)} onSave={create} />}
    </div>
  );
}

function ProjectModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (payload: { project: string; center: string; owner: string; budget: number; note: string }) => void;
}) {
  const [project, setProject] = useState('');
  const [center, setCenter] = useState(CENTERS[1]);
  const [owner, setOwner] = useState(USUARIO.nombre);
  const [budget, setBudget] = useState(0);
  const [note, setNote] = useState('');
  const valid = project.trim().length >= 4 && budget > 0;

  return (
    <Modal
      title="Nuevo proyecto presupuestal"
      subtitle="Distribuye el presupuesto en los meses restantes del año."
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre del proyecto">
            <input className={INPUT} value={project} onChange={event => setProject(event.target.value)} placeholder="Ej. Expansión zona sur" />
          </Field>
          <Field label="Centro de costo">
            <FilterSelect value={center} onChange={event => setCenter(event.target.value)}>
              {CENTERS.map(item => <option key={item} value={item}>{item}</option>)}
            </FilterSelect>
          </Field>
          <Field label="Responsable">
            <input className={INPUT} value={owner} onChange={event => setOwner(event.target.value)} />
          </Field>
          <Field label="Presupuesto anual">
            <input type="number" className={INPUT} value={budget} onChange={event => setBudget(Number(event.target.value))} />
          </Field>
        </div>
        <Field label="Nota del proyecto" hint="Objetivo, alcance y criterio de cierre.">
          <textarea
            className={`${INPUT} min-h-20`}
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="Descripción breve de la iniciativa y su meta."
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({ project: project.trim(), center, owner, budget, note: note.trim() || 'Proyecto sin nota adicional.' })}
          >
            Crear proyecto
          </Button>
        </div>
      </div>
    </Modal>
  );
}
