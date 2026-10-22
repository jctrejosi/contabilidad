import { useState } from 'react';
import type { NavPage } from '../../../components/Shell';
import Icon from '../../../components/Icon';
import { PageHeader } from '../../../components/finance/ui';
import { FINANCIAL_MODULES } from '../../../data/finance';
import Bandeja from './Bandeja';
import Reglas from './Reglas';

interface Props {
  page: string;
  onNavigate: (page: NavPage) => void;
}

const MODULE = FINANCIAL_MODULES.aprobaciones;
const SLUGS = MODULE.nav.map(item => item.slug);

const HEADERS: Record<string, { title: string; subtitle: string }> = {
  bandeja: { title: 'Bandeja de aprobaciones', subtitle: 'Solicitudes de todos los módulos con nivel actual, vencimiento y decisión.' },
  reglas: { title: 'Reglas y niveles', subtitle: 'Umbrales por módulo y concepto con uno o varios aprobadores.' },
};

export default function Aprobaciones({ page }: Props) {
  const slug = page.split('/')[1] ?? 'bandeja';
  const activeSlug = SLUGS.includes(slug) ? slug : 'bandeja';
  const [toast, setToast] = useState('');
  const header = HEADERS[activeSlug] ?? HEADERS.bandeja;

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(''), 3500);
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-5">
      <PageHeader eyebrow="Aprobaciones" title={header.title} subtitle={header.subtitle} />

      {activeSlug === 'bandeja' && <Bandeja showToast={showToast} />}
      {activeSlug === 'reglas' && <Reglas showToast={showToast} />}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-xl bg-[#001F4C] px-4 py-3 text-xs text-white shadow-2xl">
          <Icon name="check" className="h-4 w-4 text-emerald-300" />
          {toast}
        </div>
      )}
    </div>
  );
}
