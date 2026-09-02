/* ============================================================
   CONTABDSI · Configuración → Plan de cuentas (maestro)
   Árbol jerárquico + detalle + saldo inicial y meses.
   ============================================================ */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  Field,
  Input,
  Modal,
  PageHeader,
  Segmented,
  Select,
  Switch,
  Tabs,
} from '@/components/ui'
import { ExportMenu, MoneyInput, downloadCsv, usePageTitle } from '@/components/accounting/Widgets'
import { AccountPicker } from '@/components/accounting/Combobox'
import { useStore } from '@/state/AppStore'
import { money, nombreMes, sum } from '@/core/format'
import type { Account, ClaseFiscal, Distribucion } from '@/core/types'
import './pages.css'

type Filtro = 'TODAS' | 'BASE' | 'RETENCIONES' | 'IVA' | 'AFECTABLES'

const NIVELES = [1, 2, 4, 6, 9, 12]

const copiar = (a: Account): Account => ({ ...a, meses: [...a.meses], hijos: a.hijos ? [...a.hijos] : undefined })

export function PlanCuentasPage() {
  usePageTitle('Plan de cuentas')
  const { state, toast, audit } = useStore()
  const [accounts, setAccounts] = useState<Account[]>(() => state.accounts.map(copiar))
  const [ajustes, setAjustes] = useState<Record<string, number[]>>({})
  const [selCode, setSelCode] = useState('1')
  const [filtro, setFiltro] = useState<Filtro>('TODAS')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [tabMeses, setTabMeses] = useState('meses')
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; draft: Account } | null>(null)
  const [eliminar, setEliminar] = useState<Account | null>(null)
  const [bloqueo, setBloqueo] = useState<{ cuenta: Account; motivos: string[] } | null>(null)
  const [impacto, setImpacto] = useState<{ draft: Account; cambios: string[]; docs: { id: string; comprobante: string; documento: string; fecha: string; lineas: number; estado: string }[]; notaClase: string | null } | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setCargando(false), 400)
    return () => window.clearTimeout(t)
  }, [])

  const hijosDe = (code: string) => accounts.filter((a) => a.parent === code).sort((a, b) => a.code.localeCompare(b.code))
  const nivelSiguiente = (nivel: number) => NIVELES.find((n) => n > nivel) ?? 12

  const cumpleFiltro = (a: Account): boolean => {
    switch (filtro) {
      case 'TODAS': return true
      case 'BASE': return a.clase !== 'IVA' && a.clase !== 'RETENCION'
      case 'RETENCIONES': return a.clase === 'RETENCION'
      case 'IVA': return a.clase === 'IVA'
      case 'AFECTABLES': return a.afectable
    }
  }

  const visibles = useMemo(() => {
    const q = busqueda.toLowerCase()
    const match = new Set<string>()
    accounts.forEach((a) => {
      const porBusqueda = !q || a.code.toLowerCase().includes(q) || a.nombre.toLowerCase().includes(q)
      if (porBusqueda && cumpleFiltro(a)) {
        match.add(a.code)
        let p = a.parent
        while (p) {
          match.add(p)
          p = accounts.find((x) => x.code === p)?.parent
        }
      }
    })
    return match
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, filtro, busqueda])

  const renderRama = (code: string, depth: number): ReactNode => {
    const nodo = accounts.find((a) => a.code === code)
    if (!nodo) return null
    const nivelIdx = Math.max(0, NIVELES.indexOf(nodo.nivel))
    return (
      <div key={code}>
        <div
          className={`cfg-tree-row ${selCode === code ? 'sel' : ''}`}
          style={{ paddingLeft: 8 + nivelIdx * 16 }}
          onClick={() => setSelCode(code)}
          role="treeitem"
          aria-selected={selCode === code}
        >
          <span className="cfg-tree-code">{nodo.code}</span>
          <span className="cfg-tree-name">{nodo.nombre}</span>
          <span className="cfg-tree-lvl">N{nodo.nivel}</span>
          <span className="spacer" />
          {nodo.clase === 'IVA' ? <Badge tone="info" icon="iva">IVA</Badge> : nodo.clase === 'RETENCION' ? <Badge tone="warning" icon="retencion">RET</Badge> : null}
        </div>
        {hijosDe(code).filter((h) => visibles.has(h.code)).map((h) => renderRama(h.code, depth + 1))}
      </div>
    )
  }

  const raices = accounts.filter((a) => !a.parent).sort((a, b) => a.code.localeCompare(b.code))
  const sel = accounts.find((a) => a.code === selCode)
  const selAjustes = sel ? ajustes[sel.code] ?? [0, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0]

  const docsAfectados = (code: string) => {
    const docs = state.documentos
      .filter((d) => d.lineas.some((l) => l.cuenta === code))
      .map((d) => ({ id: d.id, comprobante: d.comprobante, documento: d.documento, fecha: d.fecha, lineas: d.lineas.filter((l) => l.cuenta === code).length, estado: d.estado }))
    const lotes = state.lotes
      .filter((l) => l.estado !== 'CONTABILIZADO' && l.lineas.some((li) => li.cuenta === code))
      .map((l) => ({ id: l.codigo, comprobante: l.comprobante ?? '—', documento: l.documento ?? `Lote ${l.codigo}`, fecha: l.fecha, lineas: l.lineas.filter((li) => li.cuenta === code).length, estado: l.estado }))
    return [...docs, ...lotes]
  }

  const prepararGuardado = () => {
    if (!modal) return
    const { modo, draft } = modal
    if (!draft.code.trim() || !draft.nombre.trim()) {
      toast('error', 'Datos incompletos', 'El código y el nombre de la cuenta son obligatorios.')
      return
    }
    if (modo === 'editar') {
      const previo = accounts.find((a) => a.code === draft.code)
      if (previo && previo.movimiento) {
        const cambios: string[] = []
        if (previo.afectable !== draft.afectable) cambios.push('Afectable')
        if (previo.controlaTercero !== draft.controlaTercero) cambios.push('Controla tercero')
        if (previo.centroCosto !== draft.centroCosto) cambios.push('Centro de costo')
        if (cambios.length > 0 || previo.clase !== draft.clase) {
          const docs = docsAfectados(draft.code)
          const cambiaClase = previo.clase !== draft.clase
          const notaClase = cambiaClase
            ? draft.clase === 'IVA' && state.tarifasIVA.length === 0
              ? 'La cuenta quedará marcada como IVA pero no hay tarifas de IVA definidas.'
              : draft.clase === 'RETENCION' && state.conceptosRetencion.length === 0
                ? 'La cuenta quedará marcada como retención pero no hay conceptos de retención definidos.'
                : null
            : null
          setImpacto({ draft, cambios, docs, notaClase })
          setModal(null)
          return
        }
      }
    }
    aplicarGuardado(draft, modo)
  }

  const aplicarGuardado = (draft: Account, modo: 'crear' | 'editar') => {
    if (modo === 'crear') {
      if (accounts.some((a) => a.code === draft.code.trim())) {
        toast('error', 'Código duplicado', `Ya existe la cuenta ${draft.code}.`)
        return
      }
      const nueva = { ...draft, code: draft.code.trim() }
      setAccounts((prev) => {
        const conHijos = draft.parent ? prev.map((a) => (a.code === draft.parent ? { ...a, hijos: [...(a.hijos ?? []), nueva.code] } : a)) : prev
        return [...conHijos, nueva]
      })
      setSelCode(nueva.code)
      toast('success', 'Cuenta creada', `Se creó la cuenta ${nueva.code} — ${nueva.nombre} (nivel ${nueva.nivel}).`)
      audit('Creación de cuenta', 'Plan de cuentas', `Cuenta ${nueva.code} — ${nueva.nombre} creada`)
    } else {
      setAccounts((prev) => prev.map((a) => (a.code === draft.code ? { ...a, ...draft, hijos: a.hijos, parent: a.parent, code: a.code } : a)))
      toast('success', 'Cuenta actualizada', `La cuenta ${draft.code} quedó actualizada.`)
      audit('Actualización de cuenta', 'Plan de cuentas', `Cuenta ${draft.code} — ${draft.nombre} modificada`)
    }
    setModal(null)
  }

  const confirmarImpacto = () => {
    if (!impacto) return
    aplicarGuardado(impacto.draft, 'editar')
    toast('warning', 'Cambio aplicado con impacto', `${impacto.docs.length} documento(s) afectado(s) por el cambio de controles.`)
    audit('Cambio de controles de cuenta con movimiento', 'Plan de cuentas', `Cuenta ${impacto.draft.code} · cambios: ${impacto.cambios.join(', ') || 'clase fiscal'} · ${impacto.docs.length} documentos afectados`)
    setImpacto(null)
  }

  const solicitarEliminar = () => {
    if (!sel) return
    const motivos: string[] = []
    if (hijosDe(sel.code).length > 0) motivos.push(`Tiene ${hijosDe(sel.code).length} cuenta(s) hija(s)`)
    if (sel.saldoInicial !== 0) motivos.push(`Saldo inicial diferente de cero (${money(sel.saldoInicial)})`)
    if (sel.movimiento) motivos.push('La cuenta tiene movimiento registrado')
    if (motivos.length > 0) {
      setBloqueo({ cuenta: sel, motivos })
    } else {
      setEliminar(sel)
    }
  }

  const confirmarEliminar = () => {
    if (!eliminar) return
    setAccounts((prev) => prev.filter((a) => a.code !== eliminar.code && a.parent !== eliminar.code))
    setSelCode(accounts.find((a) => a.code !== eliminar.code)?.code ?? '')
    toast('success', 'Cuenta eliminada', `Se eliminó la cuenta ${eliminar.code}.`)
    audit('Eliminación de cuenta', 'Plan de cuentas', `Cuenta ${eliminar.code} — ${eliminar.nombre} eliminada`)
    setEliminar(null)
  }

  const guardarSaldos = () => {
    if (!sel) return
    setAccounts((prev) => prev.map((a) => (a.code === sel.code ? { ...a, meses: [...sel.meses] } : a)))
    setAjustes((prev) => ({ ...prev, [sel.code]: [...selAjustes] }))
    toast('success', 'Saldos guardados', `Saldos iniciales y mensuales de la cuenta ${sel.code} actualizados.`)
    audit('Actualización de saldos', 'Plan de cuentas', `Cuenta ${sel.code} — saldo inicial ${money(sel.saldoInicial)} y meses actualizados`)
  }

  const setMes = (idx: number, v: number) => {
    if (!sel) return
    const meses = [...sel.meses]
    while (meses.length < 12) meses.push(0)
    meses[idx] = v
    setAccounts((prev) => prev.map((a) => (a.code === sel.code ? { ...a, meses } : a)))
  }

  const setAjuste = (idx: number, v: number) => {
    if (!sel) return
    const arr = [...selAjustes]
    arr[idx] = v
    setAjustes((prev) => ({ ...prev, [sel.code]: arr }))
  }

  const totalMeses = sel ? sum(sel.meses) : 0

  if (cargando) {
    return (
      <div className="page">
        <PageHeader title="Plan de cuentas" icon="plan" />
        <Card><div className="state"><span className="spinner" style={{ width: 26, height: 26 }} role="status" aria-label="Cargando" /><p className="state-detail">Cargando plan de cuentas…</p></div></Card>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Plan de cuentas"
        subtitle={`${accounts.length} cuentas · compañía ${state.session.company.codigo}`}
        icon="plan"
        actions={
          <>
            <ExportMenu
              filename="plan-cuentas"
              onExport={() =>
                downloadCsv(
                  [['Código', 'Nombre', 'Nivel', 'Clase', 'Afectable', 'Movimiento', 'Saldo inicial'], ...accounts.map((a) => [a.code, a.nombre, String(a.nivel), a.clase ?? '', a.afectable ? 'Sí' : 'No', a.movimiento ? 'Sí' : 'No', String(a.saldoInicial)])],
                  'plan-cuentas.csv',
                )
              }
            />
            <Button variant="primary" icon="plus" onClick={() => setModal({ modo: 'crear', draft: { code: '', nombre: '', nivel: sel ? nivelSiguiente(sel.nivel) : 1, afectable: false, controlaTercero: false, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 0, meses: Array.from({ length: 12 }, () => 0), parent: sel?.code } })}>Crear hija</Button>
          </>
        }
      />

      <Card className="querybar-standalone">
        <div className="row gap-8" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Segmented<Filtro>
            value={filtro}
            onChange={setFiltro}
            options={[
              { value: 'TODAS', label: 'Todas' },
              { value: 'BASE', label: 'Base' },
              { value: 'RETENCIONES', label: 'Retenciones' },
              { value: 'IVA', label: 'IVA' },
              { value: 'AFECTABLES', label: 'Afectables' },
            ]}
          />
          <Input value={busqueda} onChange={setBusqueda} placeholder="Buscar cuenta…" width={220} />
        </div>
      </Card>

      <div className="master-split" style={{ gridTemplateColumns: '320px 1fr' }}>
        <Card title="Estructura" icon="list" pad={false}>
          <div className="cfg-tree" role="tree">
            {raices.filter((r) => visibles.has(r.code)).map((r) => renderRama(r.code, 0))}
            {raices.length === 0 && <p className="muted center small" style={{ padding: 16 }}>Sin cuentas para el filtro seleccionado.</p>}
          </div>
        </Card>

        <div className="master-detail">
          <Card
            title={sel ? `${sel.code} — ${sel.nombre}` : 'Cuenta'}
            icon="plan"
            actions={
              sel ? (
                <div className="row gap-8">
                  <Button size="sm" icon="edit" onClick={() => setModal({ modo: 'editar', draft: copiar(sel) })}>Modificar</Button>
                  <Button size="sm" icon="trash" danger onClick={solicitarEliminar}>Eliminar</Button>
                </div>
              ) : undefined
            }
          >
            {sel ? (
              <div className="det-grid">
                <div className="det-item"><span className="det-label">Código</span><span className="det-value mono">{sel.code}</span></div>
                <div className="det-item"><span className="det-label">NIT</span><span className="det-value mono">{sel.nit ?? '—'}</span></div>
                <div className="det-item"><span className="det-label">Nombre</span><span className="det-value">{sel.nombre}</span></div>
                <div className="det-item"><span className="det-label">Nivel</span><span className="det-value"><Badge tone="brand">Nivel {sel.nivel}</Badge></span></div>
                <div className="det-item"><span className="det-label">Afectable</span><span className="det-value">{sel.afectable ? <Badge tone="success">Sí</Badge> : <Badge tone="neutral">No</Badge>}</span></div>
                <div className="det-item"><span className="det-label">Controla tercero</span><span className="det-value">{sel.controlaTercero ? <Badge tone="warning" icon="user">Sí</Badge> : <Badge tone="neutral">No</Badge>}</span></div>
                <div className="det-item"><span className="det-label">Ajuste</span><span className="det-value">{sel.ajuste ? 'Sí' : 'No'}</span></div>
                <div className="det-item"><span className="det-label">Centro de costo</span><span className="det-value">{sel.centroCosto ? <Badge tone="warning" icon="centro">Sí</Badge> : 'No'}</span></div>
                <div className="det-item">
                  <span className="det-label">Clase</span>
                  <span className="det-value">
                    {sel.clase === 'IVA' ? <Badge tone="info" icon="iva">IVA</Badge> : sel.clase === 'RETENCION' ? <Badge tone="warning" icon="retencion">Retención</Badge> : 'Otra'}
                  </span>
                </div>
                <div className="det-item"><span className="det-label">Movimiento</span><span className="det-value">{sel.movimiento ? <Badge tone="info">Sí</Badge> : 'No'}</span></div>
                <div className="det-item"><span className="det-label">Distribución</span><span className="det-value">{sel.distribucion === 'NINGUNA' ? 'Ninguna' : sel.distribucion === 'FIJA' ? 'Fija' : 'Porcentaje'}{sel.distribucion === 'PORCENTAJE' ? ` (${sel.porcentaje}%)` : ''}</span></div>
                <div className="det-item"><span className="det-label">Cuenta base</span><span className="det-value mono">{sel.cuentaBase ?? '—'}</span></div>
                <div className="det-item"><span className="det-label">Saldo inicial</span><span className="det-value money">{money(sel.saldoInicial)}</span></div>
                <div className="det-item"><span className="det-label">Total meses</span><span className="det-value money">{money(totalMeses)}</span></div>
              </div>
            ) : (
              <p className="muted">Seleccione una cuenta en el árbol.</p>
            )}
          </Card>

          <Card
            title="Saldo inicial y meses"
            icon="calendario"
            actions={
              sel ? (
                <Button size="sm" variant="primary" icon="save" onClick={guardarSaldos}>Guardar saldos</Button>
              ) : undefined
            }
          >
            {sel ? (
              <div className="stack gap-12">
                <Tabs
                  active={tabMeses}
                  onChange={setTabMeses}
                  tabs={[
                    { key: 'meses', label: 'Meses 1-12' },
                    { key: 'ajustes', label: '13-18 (ajustes)' },
                  ]}
                />
                {tabMeses === 'meses' ? (
                  <div className="meses-grid">
                    <div className="mes-item">
                      <span className="mes-label">Saldo inicial</span>
                      <MoneyInput value={sel.saldoInicial} onChange={(v) => setAccounts((prev) => prev.map((a) => (a.code === sel.code ? { ...a, saldoInicial: v } : a)))} width={130} />
                    </div>
                    {Array.from({ length: 12 }, (_, i) => (
                      <div className="mes-item" key={i}>
                        <span className="mes-label">{nombreMes(i + 1)}</span>
                        <MoneyInput value={sel.meses[i] ?? 0} onChange={(v) => setMes(i, v)} width={130} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="meses-grid">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div className="mes-item" key={i}>
                        <span className="mes-label">Ajuste mes {i + 13}</span>
                        <MoneyInput value={selAjustes[i] ?? 0} onChange={(v) => setAjuste(i, v)} width={130} />
                      </div>
                    ))}
                    <p className="muted small">Los meses 13-18 corresponden a períodos de ajuste posteriores al cierre (libro de ajustes).</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="muted">Seleccione una cuenta para editar sus saldos.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Modal crear/editar cuenta */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nueva cuenta (hija)' : `Cuenta ${modal?.draft.code ?? ''}`}
        icon="plan"
        width={680}
        footer={
          <>
            <Button onClick={() => setModal(null)}>Cancelar</Button>
            <Button variant="primary" icon="save" onClick={prepararGuardado}>Guardar</Button>
          </>
        }
      >
        {modal && (
          <div className="stack gap-12">
            <div className="row gap-8">
              <Field label="Código" required width={160}>
                <Input value={modal.draft.code} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, code: v } })} placeholder="1105" monospace disabled={modal.modo === 'editar'} />
              </Field>
              <Field label="Nivel" required width={140}>
                <Select
                  value={String(modal.draft.nivel)}
                  onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nivel: Number(v) } })}
                  options={NIVELES.map((n) => ({ value: String(n), label: `Nivel ${n}` }))}
                />
              </Field>
              <Field label="Cuenta padre" width={170}>
                <AccountPicker value={modal.draft.parent ?? ''} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, parent: v || undefined } })} placeholder="Ninguna" excludeCodes={[modal.draft.code]} />
              </Field>
            </div>
            <div className="row gap-8">
              <Field label="Nombre" required className="grow">
                <Input value={modal.draft.nombre} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nombre: v } })} placeholder="Caja general" />
              </Field>
              <Field label="NIT" width={180} hint="Tercero asociado por defecto.">
                <Input value={modal.draft.nit ?? ''} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nit: v || undefined } })} placeholder="NIT" monospace />
              </Field>
            </div>
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              <Field label="Clase" width={170}>
                <Select
                  value={modal.draft.clase ?? ''}
                  onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, clase: (v || null) as ClaseFiscal } })}
                  options={[{ value: '', label: 'Otra' }, { value: 'IVA', label: 'IVA' }, { value: 'RETENCION', label: 'Retención' }]}
                />
              </Field>
              <Field label="Distribución" width={180}>
                <Select
                  value={modal.draft.distribucion}
                  onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, distribucion: v as Distribucion } })}
                  options={[{ value: 'NINGUNA', label: 'Ninguna' }, { value: 'FIJA', label: 'Fija' }, { value: 'PORCENTAJE', label: 'Porcentaje' }]}
                />
              </Field>
              {modal.draft.distribucion === 'PORCENTAJE' && (
                <>
                  <Field label="Porcentaje" width={120}>
                    <Input type="number" value={modal.draft.porcentaje} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, porcentaje: Number(v) || 0 } })} />
                  </Field>
                  <Field label="Cuenta base" width={180}>
                    <AccountPicker value={modal.draft.cuentaBase ?? ''} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, cuentaBase: v || undefined } })} placeholder="Cuenta base" />
                  </Field>
                </>
              )}
            </div>
            <div className="row gap-16" style={{ flexWrap: 'wrap' }}>
              <Switch checked={modal.draft.afectable} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, afectable: v } })} label="Afectable" />
              <Switch checked={modal.draft.controlaTercero} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, controlaTercero: v } })} label="Controla tercero" />
              <Switch checked={modal.draft.centroCosto} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, centroCosto: v } })} label="Centro de costo" />
              <Switch checked={modal.draft.ajuste} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, ajuste: v } })} label="Permite ajuste" />
              <Switch checked={modal.draft.movimiento} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, movimiento: v } })} label="Movimiento" />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de impacto (cambio de controles con movimiento) */}
      <Modal
        open={impacto !== null}
        onClose={() => setImpacto(null)}
        title="Cambio de controles con movimiento existente"
        icon="warn"
        width={620}
        tone="warning"
        footer={
          <>
            <Button onClick={() => setImpacto(null)}>Cancelar</Button>
            <Button variant="danger" icon="check" onClick={confirmarImpacto}>Confirmar cambio</Button>
          </>
        }
      >
        {impacto && (
          <div className="stack gap-12">
            <p className="modal-message">
              La cuenta <b className="mono">{impacto.draft.code}</b> tiene movimiento registrado. El cambio de{' '}
              <b>{impacto.cambios.join(', ') || 'clase fiscal'}</b> afecta la validación de los siguientes documentos:
            </p>
            <div className="impact-list">
              {impacto.docs.length === 0 && <p className="small muted">No se encontraron documentos contabilizados con esta cuenta.</p>}
              {impacto.docs.map((d) => (
                <div className="impact-item" key={d.id}>
                  <span className="mono">{d.comprobante}-{d.documento} <span className="muted xs">{d.fecha}</span></span>
                  <Badge tone={d.estado === 'CONTABILIZADO' ? 'success' : 'neutral'}>{d.estado}</Badge>
                  <span className="muted xs">{d.lineas} línea(s)</span>
                </div>
              ))}
            </div>
            {impacto.notaClase && (
              <div className="note-strip">
                <Badge tone="warning" icon="warn">Pendiente de validación funcional</Badge>
                {impacto.notaClase}
              </div>
            )}
            <p className="xs muted">Al confirmar, el cambio quedará registrado en la bitácora de auditoría.</p>
          </div>
        )}
      </Modal>

      {/* Eliminación bloqueada */}
      <Modal
        open={bloqueo !== null}
        onClose={() => setBloqueo(null)}
        title="No se puede eliminar la cuenta"
        icon="lock"
        width={480}
        tone="danger"
        footer={<Button onClick={() => setBloqueo(null)}>Entendido</Button>}
      >
        {bloqueo && (
          <div className="stack gap-12">
            <p className="modal-message">
              La cuenta <b className="mono">{bloqueo.cuenta.code}</b> no se puede eliminar por las siguientes razones:
            </p>
            <div className="impact-list">
              {bloqueo.motivos.map((m) => (
                <div className="impact-item" key={m}>
                  <span><Badge tone="danger" icon="error">Bloqueo</Badge> {m}</span>
                </div>
              ))}
            </div>
            <p className="xs muted">Para eliminar la cuenta primero debe retirar su movimiento, dejar el saldo inicial en cero y reasignar o eliminar sus cuentas hijas.</p>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar cuenta"
        danger
        message={`La cuenta ${eliminar?.code} — ${eliminar?.nombre} no tiene hijos, saldo inicial ni movimiento. ¿Desea eliminarla?`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}
