import { type FormEvent, type ReactNode, useEffect, useState } from 'react';

type AccessResult =
  | { authorized: true }
  | { authorized: false; message: string };

let bootstrapPromise: Promise<AccessResult> | null = null;
const TAB_AUTHORIZATION_KEY = 'fortuner_contabilidad_tab_authorized';

function hasTabAuthorization(): boolean {
  try {
    return window.sessionStorage.getItem(TAB_AUTHORIZATION_KEY) === 'true';
  } catch {
    return false;
  }
}

function authorizeCurrentTab(): boolean {
  try {
    window.sessionStorage.setItem(TAB_AUTHORIZATION_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

function clearTabAuthorization(): void {
  try {
    window.sessionStorage.removeItem(TAB_AUTHORIZATION_KEY);
  } catch {
    // Si el almacenamiento está bloqueado, la pestaña se considera no autorizada.
  }
}

async function responseMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { detail?: unknown };
    return typeof payload.detail === 'string' && payload.detail ? payload.detail : fallback;
  } catch {
    return fallback;
  }
}

async function verifySession(): Promise<boolean> {
  const response = await fetch('/api/access/session', {
    credentials: 'include',
    cache: 'no-store',
  });
  return response.ok;
}

async function bootstrapAccess(): Promise<AccessResult> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('fortuner_code');

  if (code) {
    clearTabAuthorization();
    url.searchParams.delete('fortuner_code');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);

    try {
      const response = await fetch('/api/access/fortuner', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        return {
          authorized: false,
          message: await responseMessage(response, 'Fortuner no pudo autorizar el acceso a Contabilidad.'),
        };
      }
      if (await verifySession()) {
        if (authorizeCurrentTab()) return { authorized: true };
        return {
          authorized: false,
          message: 'El navegador bloqueó el almacenamiento de sesión necesario para esta pestaña.',
        };
      }
      return {
        authorized: false,
        message: 'El navegador bloqueó la cookie necesaria para iniciar Contabilidad. Habilite las cookies para este sitio e intente nuevamente desde Fortuner.',
      };
    } catch {
      return {
        authorized: false,
        message: 'No fue posible comunicarse con el servicio de autorización. Verifique que Fortuner y Contabilidad estén iniciados.',
      };
    }
  }

  if (!hasTabAuthorization()) {
    return {
      authorized: false,
      message: 'Este módulo debe iniciarse desde FORTUNER27.',
    };
  }

  try {
    if (await verifySession()) return { authorized: true };
    clearTabAuthorization();
  } catch {
    clearTabAuthorization();
    return {
      authorized: false,
      message: 'No fue posible comprobar la sesión de Contabilidad.',
    };
  }

  return {
    authorized: false,
    message: 'Este módulo debe iniciarse desde FORTUNER27.',
  };
}

function initialAccess(): Promise<AccessResult> {
  if (!bootstrapPromise) bootstrapPromise = bootstrapAccess();
  return bootstrapPromise;
}

export default function AccessGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'authorized' | 'blocked'>('checking');
  const [message, setMessage] = useState('Validando el inicio desde Fortuner…');
  const [showAdministrator, setShowAdministrator] = useState(false);
  const [administratorKey, setAdministratorKey] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void initialAccess().then(result => {
      if (!active) return;
      if (result.authorized) {
        setStatus('authorized');
      } else {
        setMessage(result.message);
        setStatus('blocked');
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function submitAdministrator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!administratorKey || submitting) return;

    setSubmitting(true);
    setMessage('Validando la clave administrativa…');
    try {
      const response = await fetch('/api/access/administrator', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: administratorKey }),
      });
      setAdministratorKey('');
      if (!response.ok) {
        setMessage(await responseMessage(response, 'La clave administrativa no fue aceptada.'));
        return;
      }
      if (!(await verifySession())) {
        clearTabAuthorization();
        setMessage('El navegador bloqueó la cookie necesaria. Habilite las cookies para este sitio.');
        return;
      }
      if (!authorizeCurrentTab()) {
        setMessage('El navegador bloqueó el almacenamiento de sesión necesario para esta pestaña.');
        return;
      }
      setStatus('authorized');
    } catch {
      setMessage('No fue posible comunicarse con el servicio de autorización.');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'authorized') return <>{children}</>;

  if (status === 'checking') {
    return (
      <main className="flex min-h-full items-center justify-center bg-[#F3F7FA] px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8F0FD] border-t-[#0073C0]" />
          <p className="text-sm font-medium text-[#52667A]">{message}</p>
        </div>
      </main>
    );
  }

  const fortunerUrl = import.meta.env.VITE_FORTUNER_URL || `http://${window.location.hostname}:8444/`;

  return (
    <main className="relative flex min-h-full items-center justify-center overflow-hidden bg-[#F3F7FA] px-5 py-10">
      <div className="absolute inset-x-0 top-0 h-52 bg-gradient-to-br from-[#001F4C] via-[#004183] to-[#0073C0]" />
      <section className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#D9E4EC] bg-white shadow-xl">
        <header className="border-b border-[#D9E4EC] px-7 py-6 text-center">
          <img src="/dsi-logo.png" alt="DSI S.A." className="mx-auto mb-5 h-12 w-auto" />
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="5" y="10" width="14" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              <path d="M12 14v2" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#001F4C]">Ejecución incorrecta del programa</h1>
          <p className="mt-2 text-sm leading-6 text-[#52667A]">{message}</p>
        </header>

        <div className="space-y-4 px-7 py-6">
          <a
            href={fortunerUrl}
            className="flex w-full items-center justify-center rounded-lg bg-[#0073C0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#005D9C]"
          >
            Ir a FORTUNER27
          </a>

          {!showAdministrator ? (
            <button
              type="button"
              onClick={() => setShowAdministrator(true)}
              className="w-full rounded-lg border border-[#D9E4EC] px-4 py-2.5 text-sm font-semibold text-[#004183] transition hover:bg-[#EFFAFF]"
            >
              Acceso de administrador
            </button>
          ) : (
            <form onSubmit={submitAdministrator} className="space-y-3 rounded-xl border border-[#D9E4EC] bg-[#F8FBFD] p-4">
              <label className="block text-sm font-semibold text-[#001F4C]" htmlFor="administrator-key">
                Clave administrativa
              </label>
              <input
                id="administrator-key"
                type="password"
                autoComplete="current-password"
                value={administratorKey}
                onChange={event => setAdministratorKey(event.target.value)}
                autoFocus
                className="w-full rounded-lg border border-[#C8D5DE] bg-white px-3 py-2.5 text-sm text-[#001F4C] outline-none focus:border-[#0073C0] focus:ring-2 focus:ring-[#0073C0]/15"
              />
              <button
                type="submit"
                disabled={!administratorKey || submitting}
                className="w-full rounded-lg bg-[#004183] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Validando…' : 'Ingresar'}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
