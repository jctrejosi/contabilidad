/* ============================================================
   CONTABDSI · Store global (contexto + reducer)
   Simula sesión, roles, lotes, validación, contabilización
   atómica, bitácora y notificaciones. Sin backend real.
   ============================================================ */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react'
import type {
  AppState,
  AuditEvent,
  BitacoraEntry,
  DocumentoContable,
  LineaMovimiento,
  Lote,
  LoteEstado,
  Permission,
  Role,
  Session,
  ValidationIssue,
} from '@/core/types'
import { nowISO, sum, uid } from '@/core/format'
import {
  ACCOUNTS,
  BITACORA_INICIAL,
  CENTROS,
  CONCEPTOS_RETENCION,
  DOCUMENTOS_INICIALES,
  LOTES_INICIALES,
  TARIFAS_IVA,
  TERCEROS,
  TIPOS_DOCUMENTO,
  VOUCHERS,
} from '@/data/mock'

/* ---------------- Permisos por rol ---------------- */

const TODOS: Permission[] = [
  'mov.capturar', 'mov.lotes', 'mov.lotes.aprobar', 'mov.lotes.contabilizar',
  'mov.anular', 'mov.importar', 'mov.nomina', 'mov.reembolsos',
  'consulta.ver', 'informes.ver', 'informes.exportar',
  'impuestos.retenciones', 'impuestos.iva', 'impuestos.medios',
  'reprocesos.auditar', 'reprocesos.corregir', 'cierres.ejecutar', 'consolidacion.ejecutar',
  'config.ver', 'config.editar', 'config.especiales', 'config.reclasificaciones',
  'admin.usuarios', 'admin.bitacora', 'admin.integraciones', 'admin.reorganizacion',
  'presupuesto.ver',
]

const PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: TODOS,
  CONTADOR: [
    'mov.capturar', 'mov.lotes', 'mov.lotes.aprobar', 'mov.lotes.contabilizar',
    'mov.anular', 'mov.importar', 'mov.nomina', 'mov.reembolsos',
    'consulta.ver', 'informes.ver', 'informes.exportar',
    'impuestos.retenciones', 'impuestos.iva', 'impuestos.medios',
    'reprocesos.auditar', 'reprocesos.corregir', 'cierres.ejecutar', 'consolidacion.ejecutar',
    'config.ver', 'config.editar', 'admin.bitacora', 'presupuesto.ver',
  ],
  AUXILIAR: ['mov.capturar', 'mov.lotes', 'mov.importar', 'mov.nomina', 'mov.reembolsos', 'consulta.ver', 'informes.ver'],
  AUDITOR: ['consulta.ver', 'informes.ver', 'informes.exportar', 'reprocesos.auditar', 'reprocesos.corregir', 'admin.bitacora'],
  TRIBUTARIO: ['consulta.ver', 'informes.ver', 'informes.exportar', 'impuestos.retenciones', 'impuestos.iva', 'impuestos.medios', 'config.ver'],
  GERENCIA: ['consulta.ver', 'informes.ver'],
}

export function roleHas(role: Role, perm: Permission): boolean {
  return PERMISSIONS[role]?.includes(perm) ?? false
}

/* ---------------- Estado inicial ---------------- */

export const SESSION_BASE: Session = {
  user: { id: 'u1', nombre: 'Laura Gómez', role: 'CONTADOR', iniciales: 'LG' },
  company: { codigo: '001', nombre: 'Compañía Demo S.A.S.', nit: '900.123.456-7' },
  year: 2026,
  period: 2,
  periodName: 'Febrero',
  periodStatus: 'ABIERTO',
}

const initialState: AppState = {
  session: SESSION_BASE,
  role: 'CONTADOR',
  sidebarCollapsed: false,
  density: 'compact',
  periodStatus: 'ABIERTO',
  massiveLock: null,
  accounts: ACCOUNTS,
  terceros: TERCEROS,
  centros: CENTROS,
  vouchers: VOUCHERS,
  tiposDocumento: TIPOS_DOCUMENTO,
  conceptosRetencion: CONCEPTOS_RETENCION,
  tarifasIVA: TARIFAS_IVA,
  lotes: LOTES_INICIALES,
  documentos: DOCUMENTOS_INICIALES,
  bitacora: BITACORA_INICIAL,
  acumuladosFecha: '2026-02-27T23:00:00',
  featureFlags: { presupuesto: false },
}

/* ---------------- Motor de validación ---------------- */

export function validarLinea(linea: LineaMovimiento, accounts: typeof ACCOUNTS, terceros: typeof TERCEROS, centros: typeof CENTROS, periodo: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const cuenta = accounts.find((a) => a.code === linea.cuenta)

  if (!linea.cuenta) {
    issues.push({ id: uid('v'), severidad: 'ERROR', ambito: 'LINEA', tipo: 'CUENTA_INVALIDA', mensaje: 'La línea no tiene cuenta. Asigne una cuenta válida.', lineaId: linea.id, campo: 'cuenta' })
    return issues
  }
  if (!cuenta) {
    issues.push({ id: uid('v'), severidad: 'ERROR', ambito: 'LINEA', tipo: 'CUENTA_INVALIDA', mensaje: `La cuenta ${linea.cuenta} no existe en el plan de cuentas.`, lineaId: linea.id, campo: 'cuenta' })
    return issues
  }
  if (!cuenta.afectable) {
    issues.push({ id: uid('v'), severidad: 'ERROR', ambito: 'LINEA', tipo: 'CUENTA_NO_AFECTABLE', mensaje: `La cuenta ${linea.cuenta} — ${cuenta.nombre} no es afectable. No acepta movimiento.`, lineaId: linea.id, campo: 'cuenta' })
  }
  if (linea.debito === 0 && linea.credito === 0) {
    issues.push({ id: uid('v'), severidad: 'ERROR', ambito: 'LINEA', tipo: 'DESCUADRE', mensaje: 'La línea no tiene débito ni crédito. Asigne un valor.', lineaId: linea.id, campo: 'debito' })
  }
  if (linea.debito !== 0 && linea.credito !== 0) {
    issues.push({ id: uid('v'), severidad: 'ERROR', ambito: 'LINEA', tipo: 'DESCUADRE', mensaje: 'La línea tiene débito y crédito simultáneamente. Use una sola columna.', lineaId: linea.id, campo: 'debito' })
  }
  if (cuenta.controlaTercero) {
    if (!linea.nit) {
      issues.push({ id: uid('v'), severidad: 'ERROR', ambito: 'LINEA', tipo: 'TERCERO_OBLIGATORIO', mensaje: `La cuenta ${linea.cuenta} (${cuenta.nombre}) controla tercero. Asigne un NIT válido.`, lineaId: linea.id, campo: 'nit' })
    } else if (!terceros.some((t) => t.nit === linea.nit)) {
      issues.push({ id: uid('v'), severidad: 'ERROR', ambito: 'LINEA', tipo: 'NIT_INVALIDO', mensaje: `El NIT ${linea.nit} no existe en el maestro de terceros.`, lineaId: linea.id, campo: 'nit' })
    }
  }
  if (cuenta.centroCosto) {
    if (!linea.centro) {
      issues.push({ id: uid('v'), severidad: 'ERROR', ambito: 'LINEA', tipo: 'CENTRO_OBLIGATORIO', mensaje: `La cuenta ${linea.cuenta} (${cuenta.nombre}) controla centro de costo. Asigne un centro válido.`, lineaId: linea.id, campo: 'centro' })
    } else if (!centros.some((c) => c.code === linea.centro)) {
      issues.push({ id: uid('v'), severidad: 'ERROR', ambito: 'LINEA', tipo: 'CENTRO_OBLIGATORIO', mensaje: `El centro ${linea.centro} no existe.`, lineaId: linea.id, campo: 'centro' })
    }
  }
  if ((cuenta.clase === 'IVA' || cuenta.clase === 'RETENCION') && linea.base <= 0) {
    issues.push({ id: uid('v'), severidad: 'ERROR', ambito: 'LINEA', tipo: 'BASE_OBLIGATORIA', mensaje: `La cuenta ${linea.cuenta} es de clase ${cuenta.clase}: la base es obligatoria.`, lineaId: linea.id, campo: 'base' })
  }
  if (linea.fecha) {
    const f = linea.fecha.slice(0, 7).replace('-', '')
    if (f !== periodo) {
      issues.push({ id: uid('v'), severidad: 'ERROR', ambito: 'LINEA', tipo: 'FECHA', mensaje: `La fecha ${linea.fecha} no corresponde al período ${periodo}.`, lineaId: linea.id, campo: 'fecha' })
    }
  }
  return issues
}

export function validarLote(lote: Lote, accounts: typeof ACCOUNTS, terceros: typeof TERCEROS, centros: typeof CENTROS, documentos: DocumentoContable[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const lineaIssues = lote.lineas.flatMap((l) => validarLinea(l, accounts, terceros, centros, lote.periodo))
  issues.push(...lineaIssues)

  // Descuadre global
  const deb = sum(lote.lineas.map((l) => l.debito))
  const cre = sum(lote.lineas.map((l) => l.credito))
  if (Math.abs(deb - cre) > 0.004) {
    const dif = Math.abs(deb - cre)
    issues.push({ id: uid('v'), severidad: 'ERROR', ambito: 'GLOBAL', tipo: 'DESCUADRE', mensaje: `El lote está descuadrado: Débito $${deb.toLocaleString('es-CO')} vs Crédito $${cre.toLocaleString('es-CO')}. Diferencia $${dif.toLocaleString('es-CO')}.` })
  }

  // Duplicados dentro del lote
  const seen = new Map<string, number>()
  for (const l of lote.lineas) {
    const key = `${l.cuenta}|${l.nit}|${l.centro}|${l.documento}|${l.debito}|${l.credito}|${l.concepto}`
    if (!l.cuenta) continue
    const n = seen.get(key) ?? 0
    if (n > 0) {
      issues.push({ id: uid('v'), severidad: 'ERROR', ambito: 'LINEA', tipo: 'DUPLICADO', mensaje: `Posible línea duplicada: cuenta ${l.cuenta}, ${l.documento || 'sin documento'}, valor ${(l.debito || l.credito).toLocaleString('es-CO')}.`, lineaId: l.id, campo: 'documento' })
    }
    seen.set(key, n + 1)
  }

  // Documento ya contabilizado en el libro
  const docKey = lote.documento
  if (docKey && documentos.some((d) => d.documento === docKey && d.estado === 'CONTABILIZADO')) {
    issues.push({ id: uid('v'), severidad: 'ERROR', ambito: 'DOCUMENTO', tipo: 'YA_CONTABILIZADO', mensaje: `El documento ${docKey} ya fue contabilizado. No puede contabilizarse dos veces.` })
  }

  // Advertencias de terceros sin dirección
  for (const l of lote.lineas) {
    if (l.nit) {
      const t = terceros.find((x) => x.nit === l.nit)
      if (t && !t.direccion) {
        issues.push({ id: uid('v'), severidad: 'ADVERTENCIA', ambito: 'LINEA', tipo: 'NIT_INVALIDO', mensaje: `El tercero ${l.nit} no tiene dirección registrada. Verifique antes de contabilizar.`, lineaId: l.id, campo: 'nit' })
      }
    }
  }
  return issues
}

function estadoPorIssues(issues: ValidationIssue[]): LoteEstado {
  return issues.some((i) => i.severidad === 'ERROR') ? 'CON_ERRORES' : 'VERIFICADO'
}

/* ---------------- Acciones ---------------- */

export type ToastKind = 'success' | 'error' | 'warning' | 'info'
export interface Toast {
  id: string
  kind: ToastKind
  titulo: string
  detalle?: string
}

type Action =
  | { type: 'SET_ROLE'; role: Role }
  | { type: 'SET_PERIOD_STATUS'; status: 'ABIERTO' | 'CERRADO' }
  | { type: 'SET_MASSIVE_LOCK'; lock: AppState['massiveLock'] }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_DENSITY'; density: 'compact' | 'comfortable' }
  | { type: 'ADD_LOTE'; lote: Lote }
  | { type: 'UPDATE_LOTE'; codigo: string; patch: Partial<Lote> }
  | { type: 'DELETE_LOTE'; codigo: string }
  | { type: 'UPDATE_LINEA'; codigo: string; lineaId: string; patch: Partial<LineaMovimiento> }
  | { type: 'ADD_LINEA'; codigo: string; linea: LineaMovimiento }
  | { type: 'DELETE_LINEA'; codigo: string; lineaId: string }
  | { type: 'MOVE_LINEA'; codigo: string; from: number; to: number }
  | { type: 'VERIFICAR'; codigo: string }
  | { type: 'SOLICITAR_APROBACION'; codigo: string }
  | { type: 'APROBAR'; codigo: string }
  | { type: 'CONTABILIZANDO'; codigo: string }
  | { type: 'CONTABILIZAR_OK'; codigo: string; documento: DocumentoContable }
  | { type: 'CONTABILIZAR_FALLIDO'; codigo: string }
  | { type: 'ANULAR_LOTE'; codigo: string; motivo: string }
  | { type: 'REASIGNAR_LOTE'; codigo: string; usuario: string }
  | { type: 'DEPURAR_LOTE'; codigo: string }
  | { type: 'BITACORA'; entry: Omit<BitacoraEntry, 'id' | 'fecha'> }
  | { type: 'REGEN_ACUMULADOS' }
  | { type: 'SET_FLAG'; flag: keyof AppState['featureFlags']; value: boolean }

function loteAudit(accion: string, detalle: string, resultado: AuditEvent['resultado'] = 'EXITO'): AuditEvent {
  return { id: uid('a'), fecha: nowISO(), usuario: 'Laura Gómez', rol: 'CONTADOR', accion, detalle, resultado }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_ROLE': {
      const user = state.session.user
      return { ...state, role: action.role, session: { ...state.session, user: { ...user, role: action.role } } }
    }
    case 'SET_PERIOD_STATUS':
      return { ...state, periodStatus: action.status, session: { ...state.session, periodStatus: action.status } }
    case 'SET_MASSIVE_LOCK':
      return { ...state, massiveLock: action.lock }
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed }
    case 'SET_DENSITY':
      return { ...state, density: action.density }
    case 'ADD_LOTE':
      return { ...state, lotes: [action.lote, ...state.lotes] }
    case 'UPDATE_LOTE': {
      return { ...state, lotes: state.lotes.map((l) => (l.codigo === action.codigo ? { ...l, ...action.patch } : l)) }
    }
    case 'DELETE_LOTE':
      return { ...state, lotes: state.lotes.filter((l) => l.codigo !== action.codigo) }
    case 'UPDATE_LINEA': {
      const lotes = state.lotes.map((l) => {
        if (l.codigo !== action.codigo) return l
        const lineas = l.lineas.map((li) => (li.id === action.lineaId ? { ...li, ...action.patch } : li))
        const nuevo = { ...l, lineas }
        const issues = validarLote(nuevo, state.accounts, state.terceros, state.centros, state.documentos)
        let estado = nuevo.estado
        if (['BORRADOR', 'CON_ERRORES', 'VERIFICADO'].includes(estado)) {
          estado = estadoPorIssues(issues)
        }
        return { ...nuevo, issues, estado }
      })
      return { ...state, lotes }
    }
    case 'ADD_LINEA': {
      const lotes = state.lotes.map((l) => {
        if (l.codigo !== action.codigo) return l
        const nuevo = { ...l, lineas: [...l.lineas, action.linea] }
        return { ...nuevo, issues: validarLote(nuevo, state.accounts, state.terceros, state.centros, state.documentos) }
      })
      return { ...state, lotes }
    }
    case 'DELETE_LINEA': {
      const lotes = state.lotes.map((l) => {
        if (l.codigo !== action.codigo) return l
        const nuevo = { ...l, lineas: l.lineas.filter((li) => li.id !== action.lineaId) }
        return { ...nuevo, issues: validarLote(nuevo, state.accounts, state.terceros, state.centros, state.documentos) }
      })
      return { ...state, lotes }
    }
    case 'MOVE_LINEA': {
      const lotes = state.lotes.map((l) => {
        if (l.codigo !== action.codigo) return l
        const lineas = [...l.lineas]
        const [item] = lineas.splice(action.from, 1)
        lineas.splice(action.to, 0, item)
        return { ...l, lineas }
      })
      return { ...state, lotes }
    }
    case 'VERIFICAR': {
      const lotes = state.lotes.map((l) => {
        if (l.codigo !== action.codigo) return l
        const issues = validarLote(l, state.accounts, state.terceros, state.centros, state.documentos)
        const tieneErrores = issues.some((i) => i.severidad === 'ERROR')
        return {
          ...l,
          issues,
          estado: (tieneErrores ? 'CON_ERRORES' : 'VERIFICADO') as LoteEstado,
          audit: [...l.audit, loteAudit( 'Verificación', tieneErrores ? 'Verificación fallida: aún hay errores' : 'Lote verificado: débito = crédito, sin errores', tieneErrores ? 'FALLO' : 'EXITO')],
        }
      })
      return { ...state, lotes }
    }
    case 'SOLICITAR_APROBACION': {
      const lotes = state.lotes.map((l) =>
        l.codigo === action.codigo
          ? { ...l, estado: 'PENDIENTE_APROBACION' as LoteEstado, audit: [...l.audit, loteAudit( 'Envío a aprobación', 'Lote enviado a aprobación')] }
          : l,
      )
      return { ...state, lotes }
    }
    case 'APROBAR': {
      const lotes = state.lotes.map((l) =>
        l.codigo === action.codigo
          ? { ...l, estado: 'APROBADO' as LoteEstado, audit: [...l.audit, loteAudit( 'Aprobación', 'Lote aprobado por Contador principal')] }
          : l,
      )
      return { ...state, lotes }
    }
    case 'CONTABILIZANDO': {
      const lotes = state.lotes.map((l) =>
        l.codigo === action.codigo ? { ...l, estado: 'CONTABILIZANDO' as LoteEstado } : l,
      )
      return { ...state, lotes }
    }
    case 'CONTABILIZAR_OK': {
      const lotes = state.lotes.map((l) =>
        l.codigo === action.codigo
          ? {
              ...l,
              estado: 'CONTABILIZADO' as LoteEstado,
              comprobante: action.documento.comprobante,
              documento: action.documento.documento,
              audit: [...l.audit, loteAudit( 'Contabilización', `Comprobante ${action.documento.comprobante}-${consecutivo(action.documento.comprobante)} · ${action.documento.documento} — transacción atómica exitosa`)],
            }
          : l,
      )
      return { ...state, lotes, documentos: [action.documento, ...state.documentos] }
    }
    case 'CONTABILIZAR_FALLIDO': {
      const lotes = state.lotes.map((l) =>
        l.codigo === action.codigo
          ? { ...l, estado: 'FALLIDO' as LoteEstado, audit: [...l.audit, loteAudit( 'Contabilización', 'La transacción falló y fue revertida atómicamente. Reintente.', 'FALLO')] }
          : l,
      )
      return { ...state, lotes }
    }
    case 'ANULAR_LOTE': {
      const lotes = state.lotes.map((l) =>
        l.codigo === action.codigo
          ? { ...l, estado: 'ANULADO' as LoteEstado, motivo: action.motivo, audit: [...l.audit, loteAudit( 'Anulación', `Lote anulado. Motivo: ${action.motivo}`)] }
          : l,
      )
      return { ...state, lotes }
    }
    case 'REASIGNAR_LOTE': {
      const lotes = state.lotes.map((l) =>
        l.codigo === action.codigo
          ? { ...l, usuario: action.usuario, audit: [...l.audit, loteAudit( 'Reasignación', `Lote reasignado a ${action.usuario}`)] }
          : l,
      )
      return { ...state, lotes }
    }
    case 'DEPURAR_LOTE': {
      const lotes = state.lotes.map((l) =>
        l.codigo === action.codigo
          ? {
              ...l,
              lineas: l.lineas.filter((li) => li.debito !== 0 || li.credito !== 0),
              audit: [...l.audit, loteAudit( 'Depuración', 'Líneas en cero eliminadas')],
            }
          : l,
      )
      return { ...state, lotes }
    }
    case 'BITACORA':
      return { ...state, bitacora: [{ id: uid('b'), fecha: nowISO(), ...action.entry }, ...state.bitacora] }
    case 'REGEN_ACUMULADOS':
      return { ...state, acumuladosFecha: nowISO() }
    case 'SET_FLAG':
      return { ...state, featureFlags: { ...state.featureFlags, [action.flag]: action.value } }
    default:
      return state
  }
}

function consecutivo(code: string): string {
  const map: Record<string, number> = { RC: 128, CE: 245, CP: 92, NI: 31, NV: 56 }
  return String(map[code] ?? 100).padStart(6, '0')
}

/* ---------------- Contexto ---------------- */

interface StoreValue {
  state: AppState
  dispatch: Dispatch<Action>
  toasts: Toast[]
  toast: (kind: ToastKind, titulo: string, detalle?: string) => void
  dismissToast: (id: string) => void
  can: (perm: Permission) => boolean
  role: Role
  audit: (accion: string, modulo: string, detalle: string, resultado?: BitacoraEntry['resultado']) => void
}

const StoreCtx = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [toasts, setToasts] = useState<Toast[]>([])
  const stateRef = useRef(state)
  stateRef.current = state

  const toast = useCallback((kind: ToastKind, titulo: string, detalle?: string) => {
    const id = uid('t')
    setToasts((prev) => [...prev, { id, kind, titulo, detalle }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 6000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const can = useCallback((perm: Permission) => roleHas(stateRef.current.role, perm), [])

  const audit = useCallback((accion: string, modulo: string, detalle: string, resultado: BitacoraEntry['resultado'] = 'EXITO') => {
    const s = stateRef.current
    dispatch({
      type: 'BITACORA',
      entry: { usuario: s.session.user.nombre, rol: s.role, accion, modulo, detalle, resultado },
    })
  }, [])

  const value = useMemo<StoreValue>(
    () => ({ state, dispatch, toasts, toast, dismissToast, can, role: state.role, audit }),
    [state, toasts, toast, dismissToast, can, audit],
  )

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore debe usarse dentro de <StoreProvider>')
  return ctx
}

export function useCan(perm: Permission): boolean {
  const { can } = useStore()
  return can(perm)
}

/* ---------------- Helpers de flujo (acciones compuestas) ---------------- */

/** Contabilización atómica simulada: transición -> progreso -> resultado */
export function useContabilizar() {
  const { state, dispatch, toast } = useStore()
  const [progreso, setProgreso] = useState<{ lote: string; paso: string; pct: number } | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const contabilizar = useCallback(
    (codigo: string) => {
      const lote = stateRef.current.lotes.find((l) => l.codigo === codigo)
      if (!lote) return
      if (lote.estado !== 'APROBADO') {
        toast('error', 'No se puede contabilizar', 'El lote debe estar APROBADO antes de contabilizar.')
        return
      }
      if (stateRef.current.periodStatus === 'CERRADO') {
        toast('error', 'Período cerrado', 'El período actual está cerrado. La contabilización es de solo lectura.')
        return
      }
      dispatch({ type: 'CONTABILIZANDO', codigo })
      setProgreso({ lote: codigo, paso: 'Validando idempotencia y bloqueos…', pct: 10 })

      const pasos = [
        'Verificando duplicados y documento ya contabilizado…',
        'Reservando consecutivos de comprobante…',
        'Insertando movimiento (transacción atómica)…',
        'Confirmando saldos por cuenta/tercero/centro…',
        'Registrando trazabilidad…',
      ]
      let i = 0
      const timer = window.setInterval(() => {
        i += 1
        if (i < pasos.length) {
          setProgreso({ lote: codigo, paso: pasos[i], pct: 15 + i * 18 })
        } else {
          window.clearInterval(timer)
          setProgreso({ lote: codigo, paso: 'Finalizando…', pct: 100 })
          window.setTimeout(() => {
            const s = stateRef.current
            const l = s.lotes.find((x) => x.codigo === codigo)
            if (!l) return
            const doc: DocumentoContable = {
              id: uid('doc'),
              comprobante: l.comprobante ?? 'CE',
              documento: l.documento ?? `${l.comprobante ?? 'CE'}-2026-02-${consecutivo(l.comprobante ?? 'CE')}`,
              fecha: l.fecha,
              periodo: l.periodo,
              tercero: l.lineas.find((x) => x.nit)?.nit ?? '',
              nit: l.lineas.find((x) => x.nit)?.nit ?? '',
              concepto: l.nombre,
              estado: 'CONTABILIZADO',
              lineas: l.lineas,
              lote: l.codigo,
              usuario: 'Laura Gómez',
            }
            dispatch({ type: 'CONTABILIZAR_OK', codigo, documento: doc })
            dispatch({ type: 'BITACORA', entry: { usuario: 'Laura Gómez', rol: 'CONTADOR', accion: 'Contabilización de lote', modulo: 'Lotes', detalle: `Lote ${codigo} → ${doc.comprobante}-${consecutivo(doc.comprobante)} · ${doc.documento}`, resultado: 'EXITO' } })
            setProgreso(null)
            toast('success', 'Lote contabilizado', `Comprobante ${doc.comprobante}-${consecutivo(doc.comprobante)} · ${doc.documento}. Transacción atómica exitosa.`)
            window.dispatchEvent(new CustomEvent('contab:receipt', { detail: doc }))
          }, 400)
        }
      }, 500)
    },
    [dispatch, toast],
  )

  return { contabilizar, progreso }
}
