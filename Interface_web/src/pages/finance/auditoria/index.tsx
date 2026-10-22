import { useState } from 'react';
import type { NavPage } from '../../../components/Shell';
import Icon from '../../../components/Icon';
import { PageHeader } from '../../../components/finance/ui';
import { FINANCIAL_MODULES } from '../../../data/finance';
import Bitacora from './Bitacora';
import Permisos from './Permisos';

interface Props {
  page: string;
  onNavigate: (page: NavPage) => void;
}

const MODULE = FINANCIAL_MODULES.auditoria;
const SLUGS = MODULE.nav.map(item => item.slug);

const HEADERS: Record<string, { title: string; subtitle: string }> = {
  bitacora: { title: 'Bitácora de eventos', subtitle: 'Trazabilidad de acciones por usuario, módulo y fecha.' },
  permisos: { title: 'Roles y permisos', subtitle: 'Matriz de acceso por rol y módulo con segregación de funciones.' },
};

export default function Auditoria({ page }: Props) {
  const slug = page.split('/')[1] ?? 'bitacora';
  const activeSlug = SLUGS.includes(slug) ? slug : 'bitacora';
  const [toast, setToast] = useState('');
  const header = HEADERS[activeSlug] ?? HEADERS.bitacora;

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(''), 3500);
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-5">
      <PageHeader eyebrow="Auditoría y control" title={header.title} subtitle={header.subtitle} />

      {activeSlug === 'bitacora' && <Bitacora showToast={showToast} />}
      {activeSlug === 'permisos' && <Permisos showToast={showToast} />}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-xl bg-[#001F4C] px-4 py-3 text-xs text-white shadow-2xl">
          <Icon name="check" className="h-4 w-4 text-emerald-300" />
          {toast}
        </div>
      )}
    </div>
  );
}
