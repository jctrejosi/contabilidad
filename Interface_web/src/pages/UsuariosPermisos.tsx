import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Rol } from '../types';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

type PermisoId =
  | 'capturar' | 'lotes' | 'aprobar' | 'contabilizar' | 'anular' | 'importar' | 'consultar'
  | 'informes' | 'impuestos' | 'reprocesos' | 'cierres' | 'consolidacion' | 'configurar' | 'administrar';

interface Permiso { id: PermisoId; nombre: string; }

const PERMISOS: Permiso[] = [
  { id: 'capturar', nombre: 'Capturar' },
  { id: 'lotes', nombre: 'Lotes' },
  { id: 'aprobar', nombre: 'Aprobar' },
  { id: 'contabilizar', nombre: 'Contabilizar' },
  { id: 'anular', nombre: 'Anular' },
  { id: 'importar', nombre: 'Importar' },
  { id: 'consultar', nombre: 'Consultar' },
  { id: 'informes', nombre: 'Informes' },
  { id: 'impuestos', nombre: 'Impuestos' },
  { id: 'reprocesos', nombre: 'Reprocesos' },
  { id: 'cierres', nombre: 'Cierres' },
  { id: 'consolidacion', nombre: 'Consolidación' },
  { id: 'configurar', nombre: 'Configurar' },
  { id: 'administrar', nombre: 'Administrar' },
];

const ROLES: Rol[] = [
  'Administrador',
  'Contador principal',
  'Auxiliar contable',
  'Auditor',
  'Analista tributario',
  'Consulta gerencial',
];

interface UsuarioSistema {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  estado: 'Activo' | 'Bloqueado';
}

const USUARIOS_INICIALES: UsuarioSistema[] = [
  { id: 'u1', nombre: 'María del Pilar Restrepo', email: 'pilar.restrepo@compania.com', rol: 'Administrador', estado: 'Activo' },
  { id: 'u2', nombre: 'Laura Gómez', email: 'laura.gomez@compania.com', rol: 'Contador principal', estado: 'Activo' },
  { id: 'u3', nombre: 'Carlos Pérez', email: 'carlos.perez@compania.com', rol: 'Auxiliar contable', estado: 'Activo' },
  { id: 'u4', nombre: 'Pedro Ruiz', email: 'pedro.ruiz@compania.com', rol: 'Auditor', estado: 'Activo' },
  { id: 'u5', nombre: 'Ana Torres', email: 'ana.torres@compania.com', rol: 'Analista tributario', estado: 'Activo' },
  { id: 'u6', nombre: 'Jorge Salazar', email: 'jorge.salazar@compania.com', rol: 'Consulta gerencial', estado: 'Activo' },
];

type Matriz = Record<Rol, Record<PermisoId, boolean>>;

function matrizInicial(): Matriz {
  const solo = (ids: PermisoId[]): Record<PermisoId, boolean> =>
    Object.fromEntries(PERMISOS.map(p => [p.id, ids.includes(p.id)])) as Record<PermisoId, boolean>;
  return {
    'Administrador': solo(PERMISOS.map(p => p.id)),
    'Contador principal': solo(['capturar', 'lotes', 'aprobar', 'contabilizar', 'anular', 'importar', 'consultar', 'informes', 'impuestos', 'reprocesos', 'cierres', 'consolidacion', 'configurar']),
    'Auxiliar contable': solo(['capturar', 'lotes', 'importar', 'consultar', 'informes']),
    'Auditor': solo(['consultar', 'informes']),
    'Analista tributario': solo(['capturar', 'lotes', 'importar', 'consultar', 'informes', 'impuestos']),
    'Consulta gerencial': solo(['consultar', 'informes']),
  };
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-lg border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/40">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 id={titleId} className="text-sm font-semibold text-gray-800">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar diálogo" className="rounded px-2 text-xl text-gray-500 hover:bg-gray-100">×</button>
      </div>
      {children}
    </dialog>
  );
}

export default function UsuariosPermisos() {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>(USUARIOS_INICIALES);
  const [matriz, setMatriz] = useState<Matriz>(matrizInicial);
  const [editando, setEditando] = useState<UsuarioSistema | null>(null);
  const [creando, setCreando] = useState(false);
  const [eliminando, setEliminando] = useState<UsuarioSistema | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'Auxiliar contable' as Rol, estado: 'Activo' as 'Activo' | 'Bloqueado' });
  const [errores, setErrores] = useState<{ nombre?: string; email?: string }>({});

  function abrirCrear() {
    setForm({ nombre: '', email: '', rol: 'Auxiliar contable', estado: 'Activo' });
    setErrores({});
    setCreando(true);
  }

  function abrirEditar(u: UsuarioSistema) {
    setForm({ nombre: u.nombre, email: u.email, rol: u.rol, estado: u.estado });
    setErrores({});
    setEditando(u);
  }

  function abrirEliminar(u: UsuarioSistema) {
    if (u.rol === 'Administrador') {
      setMensaje({ tipo: 'error', texto: 'El rol Administrador es fijo: el usuario administrador no puede eliminarse.' });
      return;
    }
    setEliminando(u);
  }

  function guardarUsuario(event: FormEvent) {
    event.preventDefault();
    const nuevosErrores: { nombre?: string; email?: string } = {};
    if (form.nombre.trim().length < 3) nuevosErrores.nombre = 'Ingrese el nombre completo (mínimo 3 caracteres).';
    if (!form.email.includes('@')) nuevosErrores.email = 'Ingrese un correo válido.';
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length) return;
    if (editando) {
      setUsuarios(prev => prev.map(u => (u.id === editando.id ? { ...u, nombre: form.nombre.trim(), email: form.email.trim(), rol: form.rol, estado: form.estado } : u)));
      setMensaje({ tipo: 'success', texto: `Usuario «${form.nombre.trim()}» actualizado. Los cambios rigen en el próximo inicio de sesión.` });
      setEditando(null);
    } else {
      setUsuarios(prev => [...prev, { id: `u-${Date.now()}`, nombre: form.nombre.trim(), email: form.email.trim(), rol: form.rol, estado: form.estado }]);
      setMensaje({ tipo: 'success', texto: `Usuario «${form.nombre.trim()}» creado con el rol ${form.rol}.` });
      setCreando(false);
    }
  }

  function confirmarEliminar() {
    if (!eliminando) return;
    setUsuarios(prev => prev.filter(u => u.id !== eliminando.id));
    setMensaje({ tipo: 'success', texto: `Usuario «${eliminando.nombre}» eliminado (simulado).` });
    setEliminando(null);
  }

  function togglePermiso(rol: Rol, permiso: PermisoId) {
    if (rol === 'Administrador') return;
    setMatriz(prev => ({ ...prev, [rol]: { ...prev[rol], [permiso]: !prev[rol][permiso] } }));
    setMensaje(null);
  }

  const conteoPorRol = (rol: Rol) => PERMISOS.filter(p => matriz[rol][p.id]).length;

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Administración / Usuarios y permisos</div>
          <h1 className="text-lg font-semibold text-gray-800">Usuarios y permisos</h1>
          <p className="mt-1 text-xs text-gray-500">Gestión de accesos, roles y permisos por módulo — cambios simulados en este navegador.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {mensaje && (
        <div role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`rounded border px-4 py-3 text-sm ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>
          {mensaje.texto}
        </div>
      )}

      {/* Usuarios */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h2 className="text-xs font-semibold text-gray-700">Usuarios del sistema</h2>
            <p className="text-xs text-gray-400 mt-0.5">{usuarios.length} usuarios — un rol por usuario según el tipo <span className="font-mono">Rol</span></p>
          </div>
          <button type="button" onClick={abrirCrear} className="text-xs px-3 py-1.5 rounded bg-petroleum-500 text-white font-medium hover:bg-petroleum-600">+ Nuevo usuario</button>
        </div>
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Usuario</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Correo</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Rol</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Estado</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {usuarios.map(u => (
                <tr key={u.id} className="hoverable">
                  <td className="px-3 py-2.5 text-gray-800 font-medium">{u.nombre}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-600">{u.email}</td>
                  <td className="px-3 py-2.5 text-gray-700">
                    <span className={`inline-flex items-center gap-1.5 ${u.rol === 'Administrador' ? 'text-petroleum-700 font-medium' : ''}`}>
                      {u.rol === 'Administrador' && <span title="Rol fijo">🔒</span>}
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.estado}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => abrirEditar(u)} className="text-xs text-petroleum-600 hover:underline">Editar</button>
                      <button type="button" onClick={() => abrirEliminar(u)} disabled={u.rol === 'Administrador'} className="text-xs text-red-600 hover:underline disabled:text-gray-300 disabled:no-underline">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Matriz rol x permisos */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h2 className="text-xs font-semibold text-gray-700">Matriz de permisos por rol</h2>
            <p className="text-xs text-gray-400 mt-0.5">El rol Administrador es fijo: todos los permisos marcados y no modificables.</p>
          </div>
          <span className="text-xs text-gray-400">Los cambios aplican al próximo inicio de sesión</span>
        </div>
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 sticky left-0 bg-gray-50 min-w-44">Rol</th>
                {PERMISOS.map(p => (
                  <th key={p.id} className="px-2 py-2.5 text-center font-semibold text-gray-600 whitespace-nowrap">{p.nombre}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ROLES.map(rol => (
                <tr key={rol} className={`hoverable ${rol === 'Administrador' ? 'bg-gray-50/60' : ''}`}>
                  <td className="px-3 py-2.5 text-gray-800 font-medium sticky left-0 bg-white whitespace-nowrap">
                    <span className="flex items-center justify-between gap-2">
                      {rol === 'Administrador' && <span title="Rol fijo">🔒</span>}
                      <span className="flex-1">{rol}</span>
                      <span className="text-gray-400 font-mono">{conteoPorRol(rol)}/14</span>
                    </span>
                  </td>
                  {PERMISOS.map(p => (
                    <td key={p.id} className="px-2 py-2.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${p.nombre} — ${rol}`}
                        checked={matriz[rol][p.id]}
                        disabled={rol === 'Administrador'}
                        onChange={() => togglePermiso(rol, p.id)}
                        className="h-4 w-4 accent-petroleum-500 disabled:opacity-60"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
          🔒 El rol Administrador conserva todos los permisos de forma permanente y no puede editarse ni eliminarse.
        </div>
      </div>

      {/* Modal crear / editar */}
      {(creando || editando) && (
        <Modal title={editando ? `Editar usuario — ${editando.nombre}` : 'Nuevo usuario'} onClose={() => { setCreando(false); setEditando(null); }}>
          <form noValidate onSubmit={guardarUsuario}>
            <div className="space-y-3 p-5">
              <div>
                <label htmlFor="usuario-nombre" className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
                <input id="usuario-nombre" data-initial-focus className={INPUT} value={form.nombre} onChange={e => { setForm(f => ({ ...f, nombre: e.target.value })); setErrores(e => ({ ...e, nombre: undefined })); }}
                  aria-invalid={!!errores.nombre} aria-describedby={errores.nombre ? 'usuario-nombre-error' : undefined} placeholder="Nombre y apellidos" />
                {errores.nombre && <p id="usuario-nombre-error" className="mt-1 text-xs text-red-600">{errores.nombre}</p>}
              </div>
              <div>
                <label htmlFor="usuario-email" className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico</label>
                <input id="usuario-email" className={INPUT} value={form.email} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrores(e => ({ ...e, email: undefined })); }}
                  aria-invalid={!!errores.email} aria-describedby={errores.email ? 'usuario-email-error' : undefined} placeholder="usuario@compania.com" />
                {errores.email && <p id="usuario-email-error" className="mt-1 text-xs text-red-600">{errores.email}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="usuario-rol" className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
                  <select id="usuario-rol" className={INPUT} value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value as Rol }))}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="usuario-estado" className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                  <select id="usuario-estado" className={INPUT} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as 'Activo' | 'Bloqueado' }))}>
                    <option value="Activo">Activo</option>
                    <option value="Bloqueado">Bloqueado</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-400">Los permisos efectivos del usuario dependen de la matriz de su rol.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
              <button type="button" onClick={() => { setCreando(false); setEditando(null); }} className={BUTTON_SECONDARY}>Cancelar</button>
              <button type="submit" className={BUTTON_PRIMARY}>{editando ? 'Guardar cambios' : 'Crear usuario'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal eliminar */}
      {eliminando && (
        <Modal title="Eliminar usuario" onClose={() => setEliminando(null)}>
          <p className="p-5 text-sm text-gray-600">
            ¿Eliminar el usuario <strong>{eliminando.nombre}</strong> ({eliminando.rol})? La acción es simulada y reversible en esta demostración.
          </p>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" data-initial-focus onClick={() => setEliminando(null)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="button" onClick={confirmarEliminar} className="rounded bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
