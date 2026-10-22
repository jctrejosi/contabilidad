import { useState } from 'react';
import type { NavPage } from '../../../components/Shell';
import Icon from '../../../components/Icon';
import { PageHeader } from '../../../components/finance/ui';
import { FINANCIAL_MODULES } from '../../../data/finance';
import Panel from './Panel';
import Eliminaciones from './Eliminaciones';

interface Props {
  page: string;
  onNavigate: (page: NavPage) => void;
}

const MODULE = FINANCIAL_MODULES.consolidacion;
const SLUGS = MODULE.nav.map(item => item.slug);

const HEADERS: Record<string, { title: string; subtitle: string }> = {
  panel: { title: 'Panel de consolidación', subtitle: 'Compañías del grupo, participación y saldos consolidados.' },
  eliminaciones: { title: 'Eliminaciones intercompañía', subtitle: 'Operaciones internas, aplicación y revisión de eliminaciones.' },
};

export default function Consolidacion({ page }: Props) {
  const slug = page.split('/')[1] ?? 'panel';
  const activeSlug = SLUGS.includes(slug) ? slug : 'panel';
  const [toast, setToast] = useState('');
  const header = HEADERS[activeSlug] ?? HEADERS.panel;

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(''), 3500);
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-5">
      <PageHeader eyebrow="Consolidación" title={header.title} subtitle={header.subtitle} />

      {activeSlug === 'panel' && <Panel showToast={showToast} />}
      {activeSlug === 'eliminaciones' && <Eliminaciones showToast={showToast} />}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-xl bg-[#001F4C] px-4 py-3 text-xs text-white shadow-2xl">
          <Icon name="check" className="h-4 w-4 text-emerald-300" />
          {toast}
        </div>
      )}
    </div>
  );
}
