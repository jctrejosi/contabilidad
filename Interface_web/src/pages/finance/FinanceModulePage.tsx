import type { NavPage } from '../../components/Shell';
import Facturacion from './Facturacion';
import Cartera from './Cartera';
import CuentasPagar from './CuentasPagar';
import Tesoreria from './Tesoreria';
import Presupuesto from './Presupuesto';
import ActivosFijos from './activos-fijos';
import Costos from './costos';
import Financiacion from './financiacion';
import Indicadores from './indicadores';
import Aprobaciones from './aprobaciones';
import Auditoria from './auditoria';
import Consolidacion from './consolidacion';

interface Props {
  page: string;
  onNavigate: (page: NavPage) => void;
}

const PAGES = {
  facturacion: Facturacion,
  cartera: Cartera,
  'cuentas-pagar': CuentasPagar,
  tesoreria: Tesoreria,
  presupuesto: Presupuesto,
  'activos-fijos': ActivosFijos,
  costos: Costos,
  financiacion: Financiacion,
  indicadores: Indicadores,
  aprobaciones: Aprobaciones,
  auditoria: Auditoria,
  consolidacion: Consolidacion,
} as const;

export default function FinanceModulePage({ page, onNavigate }: Props) {
  const moduleId = page.split('/')[0] as keyof typeof PAGES;
  const Component = PAGES[moduleId] ?? Facturacion;
  return <Component page={page} onNavigate={onNavigate} />;
}
