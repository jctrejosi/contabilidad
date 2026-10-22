import { useMemo } from 'react';
import {
  Badge,
  BarChart,
  Button,
  Card,
  DataTable,
  KpiCard,
  Money,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import { useFinance } from '../../../finance/store';
import { money } from '../../../finance/selectors';
import type { ConsolidationCompany, ConsolidationCompanyStatus } from '../../../finance/types';

const STATUS_TONE: Record<ConsolidationCompanyStatus, 'green' | 'amber' | 'gray'> = {
  Incluida: 'green',
  'En revisión': 'amber',
  Excluida: 'gray',
};

export default function Panel({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();

  const included = useMemo(
    () => state.consolidationCompanies.filter(company => company.status === 'Incluida'),
    [state.consolidationCompanies],
  );

  const assets = included.reduce((total, company) => total + company.assets, 0);
  const liabilities = included.reduce((total, company) => total + company.liabilities, 0);
  const equity = included.reduce((total, company) => total + company.equity, 0);
  const revenue = included.reduce((total, company) => total + company.revenue, 0);
  const eliminations = state.eliminations.reduce((total, entry) => total + entry.debit, 0);
  const minority = included.reduce(
    (total, company) => total + company.equity * ((100 - company.ownership) / 100),
    0,
  );

  function toggle(company: ConsolidationCompany) {
    update(draft => {
      const target = draft.consolidationCompanies.find(item => item.id === company.id);
      if (!target) return;
      target.status = target.status === 'Incluida' ? 'Excluida' : 'Incluida';
    }, `Compañía ${company.code} ${company.status === 'Incluida' ? 'excluida' : 'incluida'} de la consolidación`, 'consolidacion');
    showToast(`${company.name} ${company.status === 'Incluida' ? 'excluida' : 'incluida'} del perímetro.`);
  }

  const columns: Column<ConsolidationCompany>[] = [
    {
      header: 'Compañía',
      cell: row => (
        <div>
          <div className="font-medium text-gray-800">{row.name}</div>
          <div className="text-[10px] text-gray-400">{row.code} · {row.nit}</div>
        </div>
      ),
    },
    { header: 'País', cell: row => row.country },
    {
      header: 'Participación',
      align: 'right',
      cell: row => <span className="tabular">{row.ownership} %</span>,
    },
    { header: 'Activos', align: 'right', cell: row => <Money value={row.assets} /> },
    { header: 'Pasivos', align: 'right', cell: row => <Money value={row.liabilities} /> },
    { header: 'Patrimonio', align: 'right', cell: row => <Money value={row.equity} /> },
    { header: 'Estado', cell: row => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => (
        <Button size="sm" onClick={() => toggle(row)}>
          {row.status === 'Incluida' ? 'Excluir' : 'Incluir'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Compañías incluidas" value={`${included.length} de ${state.consolidationCompanies.length}`} detail="Perímetro de consolidación" tone="green" />
        <KpiCard label="Activos consolidados" value={<Money value={assets} />} detail="Antes de eliminaciones" tone="cyan" />
        <KpiCard label="Pasivos consolidados" value={<Money value={liabilities} />} detail={`Eliminaciones ${money(eliminations)}`} tone="amber" />
        <KpiCard label="Participación no controlante" value={<Money value={minority} />} detail={`Patrimonio ${money(equity)}`} tone="violet" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <SectionTitle
            title="Panel de consolidación"
            detail="Compañías del grupo, participación y saldos individuales"
          />
          <div className="p-4">
            <DataTable
              columns={columns}
              rows={state.consolidationCompanies}
              rowKey={row => row.id}
              empty="No hay compañías en el perímetro."
              footer={
                <span className="text-[11px] text-gray-500">
                  Los saldos son individuales antes de la suma y de las eliminaciones intercompañía.
                </span>
              }
            />
          </div>
        </Card>

        <Card>
          <SectionTitle title="Composición de activos" detail="Aporte de cada compañía incluida" />
          <div className="space-y-4 p-4">
            <BarChart
              data={included.map(company => ({ label: company.code.replace('CIA-', ''), value: company.assets }))}
              height={150}
              tone="blue"
            />
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-gray-500">Ingresos consolidados</dt>
                <dd className="mt-0.5 font-semibold text-gray-900"><Money value={revenue} /></dd>
              </div>
              <div>
                <dt className="text-gray-500">Patrimonio</dt>
                <dd className="mt-0.5 font-semibold text-gray-900"><Money value={equity} /></dd>
              </div>
              <div>
                <dt className="text-gray-500">Eliminaciones</dt>
                <dd className="mt-0.5 font-semibold text-red-700"><Money value={eliminations} /></dd>
              </div>
              <div>
                <dt className="text-gray-500">Minoritarios</dt>
                <dd className="mt-0.5 font-semibold text-violet-700"><Money value={minority} /></dd>
              </div>
            </dl>
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-[11px] text-indigo-900">
              El perímetro se controla por participación. Una compañía excluida deja de sumar en los
              totales y conserva su histórico en la tabla.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
