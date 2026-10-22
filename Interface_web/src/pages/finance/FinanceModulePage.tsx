import type { NavPage } from '../../components/Shell';
import Facturacion from './Facturacion';
import Cartera from './Cartera';
import CuentasPagar from './CuentasPagar';
import Tesoreria from './Tesoreria';
import Presupuesto from './Presupuesto';

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
} as const;

export default function FinanceModulePage({ page, onNavigate }: Props) {
  const moduleId = page.split('/')[0] as keyof typeof PAGES;
  const Component = PAGES[moduleId] ?? Facturacion;
  return <Component page={page} onNavigate={onNavigate} />;
}
