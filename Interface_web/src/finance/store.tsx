import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { USUARIO } from '../data/mock';
import { HOY } from './selectors';
import { createSeed } from './seed';
import type { AuditEntry, FinanceState, FinancialModuleId } from './types';

const STORAGE_PREFIX = 'contabdsi.finance.v1';
const MAX_AUDIT = 80;

interface FinanceContextValue {
  companyCode: string;
  state: FinanceState;
  /** Clona el estado, aplica la mutación y deja traza en la bitácora. */
  update: (mutator: (draft: FinanceState) => void, action?: string, module?: FinancialModuleId | 'suite') => void;
  reset: () => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

function storageKey(companyCode: string) {
  return `${STORAGE_PREFIX}.${companyCode}`;
}

function loadState(companyCode: string): FinanceState {
  try {
    const raw = localStorage.getItem(storageKey(companyCode));
    if (!raw) return createSeed();
    const parsed = JSON.parse(raw) as FinanceState;
    if (!parsed || !Array.isArray(parsed.invoices) || !Array.isArray(parsed.parties)) {
      return createSeed();
    }
    return parsed;
  } catch {
    return createSeed();
  }
}

function stamp(): string {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return `${HOY} ${time}`;
}

export function FinanceProvider({ companyCode, children }: { companyCode: string; children: ReactNode }) {
  const [state, setState] = useState<FinanceState>(() => loadState(companyCode));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(companyCode), JSON.stringify(state));
    } catch {
      // Si el navegador bloquea el almacenamiento, la suite sigue operando en memoria.
    }
  }, [companyCode, state]);

  const update = useCallback<FinanceContextValue['update']>((mutator, action, module = 'suite') => {
    setState(previous => {
      const draft = structuredClone(previous);
      mutator(draft);
      if (action) {
        const entry: AuditEntry = {
          id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
          at: stamp(),
          user: USUARIO.nombre,
          module,
          action,
        };
        draft.audit = [entry, ...draft.audit].slice(0, MAX_AUDIT);
      }
      return draft;
    });
  }, []);

  const reset = useCallback(() => setState(createSeed()), []);

  const value = useMemo(
    () => ({ companyCode, state, update, reset }),
    [companyCode, state, update, reset],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('useFinance debe usarse dentro de FinanceProvider.');
  return context;
}
