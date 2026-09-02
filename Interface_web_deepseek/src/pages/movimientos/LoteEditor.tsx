/* ============================================================
   CONTABDSI · Editor de lote — flujo completo de un lote
   ============================================================ */

import { useEffect, useState, type ReactElement } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button, Card, ErrorState, Field, Icon, Modal, NoPermissionState, PageHeader, ProgressBar, Select, Tabs,
} from '@/components/ui'
import { AccountingEntryGrid, DebitCreditSummary, StatusBadge } from '@/components/accounting/DataGrid'
import { AuditTimeline, DangerConfirmation, ExportMenu, InfoStrip, usePageTitle, ValidationCenter } from '@/components/accounting/Widgets'
import { useCan, useContabilizar, useStore, validarLote } from '@/state/AppStore'
import { USERS, makeLinea } from '@/data/mock'
import { fecha, money, sum } from '@/core/format'
import { LOTE_ESTADOS } from '@/core/types'
import type { DocumentoContable, LineaMovimiento, ValidationIssue } from '@/core/types'

const EJEMPLO_IMPORT: Array<Partial<LineaMovimiento>> = [
  { cuenta: '510506', centro: 'VEN', debito: 750000, concepto: 'Bonificación ventas (importada)' },
  { cuenta: '250505', nit: '900111222', credito: 750000, concepto: 'Salarios por pagar (importada)' },
]

export function LoteEditorPage() {
  const { codigo = '' } = useParams<{ codigo: string }>()
  const navigate = useNavigate()
  const { state, dispatch, toast, audit } = useStore()
  const puedeLotes = useCan('mov.lotes')
  const puedeAprobar = useCan('mov.lotes.aprobar')
  const puedeContabilizarPerm = useCan('mov.lotes.contabilizar')
  const { contabilizar, progreso } = useContabilizar()

  const lote = state.lotes.find((l) => l.codigo === codigo)
  usePageTitle(lote ? `Lote ${lote.codigo}` : 'Lote no encontrado')

  const [tab, setTab] = useState('lineas')
  const [revealIssue, setRevealIssue] = useState<ValidationIssue | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [reasigOpen, setReasigOpen] = useState(false)
  const [reasigUsuario, setReasigUsuario] = useState(USERS[0]?.nombre ?? '')
  const [anularOpen, setAnularOpen] = useState(false)
  const [recibo, setRecibo] = useState<DocumentoContable | null>(null)

  useEffect(() => {
    const onReceipt = (e: Event) => setRecibo((e as CustomEvent<DocumentoContable>).detail)
    window.addEventListener('contab:receipt', onReceipt)
    return () => window.removeEventListener('contab:receipt', onReceipt)
  }, [])

  if (!puedeLotes) {
    return (
      <div className="page">
        <NoPermissionState perm="mov.lotes" />
      </div>
    )
  }

  if (!lote) {
    return (
      <div className="page">
        <PageHeader title="Editor de lote" icon="lote" />
        <ErrorState title="Lote no encontrado" detail={`No existe un lote con el código «${codigo}». Puede que haya sido eliminado.`} />
        <div className="center">
          <Button icon="chevronL" onClick={() => navigate('/movimientos/lotes')}>Volver a lotes</Button>
        </div>
      </div>
    )
  }

  const soloLectura = state.periodStatus === 'CERRADO' || Boolean(state.massiveLock)
  const editable = !soloLectura && lote.estado !== 'CONTABILIZADO' && lote.estado !== 'ANULADO'

  const deb = sum(lote.lineas.map((l) => l.debito))
  const cre = sum(lote.lineas.map((l) => l.credito))
  const docGenerado = state.documentos.find((d) => d.lote === lote.codigo)
  const docLibro = state.documentos.find((d) => d.documento === lote.documento)

  const syncLineas = (next: LineaMovimiento[]) => {
    if (!editable) return
    const prev = lote.lineas
    const nextIds = new Set(next.map((l) => l.id))
    for (const pl of prev) {
      if (!nextIds.has(pl.id)) dispatch({ type: 'DELETE_LINEA', codigo, lineaId: pl.id })
    }
    for (const nl of next) {
      const pl = prev.find((l) => l.id === nl.id)
      if (pl && JSON.stringify(pl) !== JSON.stringify(nl)) {
        dispatch({ type: 'UPDATE_LINEA', codigo, lineaId: nl.id, patch: nl })
      }
    }
  }

  const verificar = () => {
    const iss = validarLote(lote, state.accounts, state.terceros, state.centros, state.documentos)
    const tiene = iss.some((i) => i.severidad === 'ERROR')
    dispatch({ type: 'VERIFICAR', codigo })
    if (tiene) {
      toast('error', 'Verificación fallida', 'El lote aún tiene errores. Corríjalos y vuelva a verificar.')
      audit('Verificación de lote', 'Lotes', `Lote ${codigo}: aún tiene errores (${iss.filter((i) => i.severidad === 'ERROR').length})`, 'FALLO')
    } else {
      toast('success', 'Lote verificado', 'Débito = crédito y sin errores. Puede enviarlo a aprobación.')
      audit('Verificación de lote', 'Lotes', `Lote ${codigo} verificado sin errores`)
    }
  }

  const solicitar = () => {
    dispatch({ type: 'SOLICITAR_APROBACION', codigo })
    toast('info', 'Enviado a aprobación', 'El lote pasó a PENDIENTE_APROBACION.')
    audit('Envío a aprobación', 'Lotes', `Lote ${codigo} enviado a aprobación`)
  }

  const aprobar = () => {
    dispatch({ type: 'APROBAR', codigo })
    toast('success', 'Lote aprobado', 'El lote puede contabilizarse.')
    audit('Aprobación de lote', 'Lotes', `Lote ${codigo} aprobado`)
  }

  const rechazar = () => {
    dispatch({ type: 'UPDATE_LOTE', codigo, patch: { estado: 'CON_ERRORES' } })
    toast('warning', 'Lote rechazado', 'El lote volvió a CON_ERRORES.')
    audit('Rechazo de lote', 'Lotes', `Lote ${codigo} rechazado en aprobación`, 'FALLO')
  }

  const depurar = () => {
    const cero = lote.lineas.filter((l) => l.debito === 0 && l.credito === 0).length
    dispatch({ type: 'DEPURAR_LOTE', codigo })
    toast('success', 'Lote depurado', cero > 0 ? `${cero} línea(s) en cero eliminadas.` : 'No había líneas en cero.')
    audit('Depuración de lote', 'Lotes', `Lote ${codigo}: ${cero} línea(s) en cero eliminadas`)
  }

  const reasignar = () => {
    dispatch({ type: 'REASIGNAR_LOTE', codigo, usuario: reasigUsuario })
    setReasigOpen(false)
    toast('success', 'Lote reasignado', `El lote ahora está asignado a ${reasigUsuario}.`)
    audit('Reasignación de lote', 'Lotes', `Lote ${codigo} reasignado a ${reasigUsuario}`)
  }

  const importarLineas = () => {
    const nuevas = EJEMPLO_IMPORT.map((f) => makeLinea({ ...f, fecha: lote.fecha, comprobante: lote.comprobante, documento: lote.documento }))
    for (const n of nuevas) dispatch({ type: 'ADD_LINEA', codigo, linea: n })
    setImportOpen(false)
    toast('success', 'Líneas importadas', `${nuevas.length} líneas de ejemplo agregadas al lote.`)
    audit('Importación de líneas', 'Lotes', `Lote ${codigo}: ${nuevas.length} líneas importadas (simulado)`)
  }

  const cerrarRecibo = () => setRecibo(null)

  const verDocumento = () => {
    if (recibo) navigate(`/documentos/${recibo.id}`)
  }

  const consecutivoDe = (code: string) => {
    const v = state.vouchers.find((x) => x.code === code)
    return String(v?.consecutivo ?? 0).padStart(6, '0')
  }

  const accionesEstado: ReactElement[] = []
  if (lote.estado === 'CON_ERRORES') {
    accionesEstado.push(<Button key="verificar" icon="shield" onClick={verificar} disabled={soloLectura} title="Validar el lote nuevamente">Verificar</Button>)
  }
  if (lote.estado === 'VERIFICADO') {
    accionesEstado.push(<Button key="solicitar" icon="upload" onClick={solicitar}>Enviar a aprobación</Button>)
  }
  if (lote.estado === 'PENDIENTE_APROBACION') {
    if (puedeAprobar) accionesEstado.push(<Button key="aprobar" variant="success" icon="check" onClick={aprobar}>Aprobar</Button>)
    accionesEstado.push(<Button key="rechazar" danger icon="x" onClick={rechazar}>Rechazar</Button>)
  }
  if (lote.estado === 'APROBADO') {
    if (puedeContabilizarPerm) {
      accionesEstado.push(
        <Button
          key="contabilizar"
          variant="primary"
          icon="play"
          onClick={() => contabilizar(codigo)}
          disabled={soloLectura}
          title={soloLectura ? 'El período está cerrado o hay un proceso masivo en curso' : 'Contabilizar el lote'}
        >
          Contabilizar
        </Button>,
      )
    }
  }
  if (lote.estado === 'CONTABILIZADO') {
    if (docGenerado) accionesEstado.push(<Button key="verdoc" icon="doc" onClick={() => navigate(`/documentos/${docGenerado.id}`)}>Ver documento oficial</Button>)
    accionesEstado.push(<Button key="anular" danger icon="anular" onClick={() => setAnularOpen(true)}>Anular lote</Button>)
  }

  return (
    <div className="page">
      <PageHeader
        title={lote.nombre}
        subtitle={`${lote.codigo} · ${LOTE_ESTADOS[lote.estado]}`}
        icon="lote"
        badge={<StatusBadge estado={lote.estado} />}
        actions={
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            {accionesEstado}
            <Button variant="ghost" icon="chevronL" onClick={() => navigate('/movimientos/lotes')}>Volver</Button>
          </div>
        }
      />

      <InfoStrip
        items={[
          { label: 'Código', value: <span className="tnum">{lote.codigo}</span> },
          { label: 'Origen', value: lote.origen },
          { label: 'Período', value: <span className="tnum">{lote.periodo}</span> },
          { label: 'Usuario', value: lote.usuario },
          { label: 'Fecha', value: <span className="tnum">{fecha(lote.fecha)}</span> },
          { label: 'Comprobante', value: <span className="tnum">{lote.comprobante ?? '—'}</span> },
          { label: 'Documento', value: <span className="tnum">{lote.documento ?? '—'}</span> },
          { label: 'Líneas', value: <span className="tnum">{lote.lineas.length}</span> },
        ]}
      />

      {soloLectura && (
        <div className="local-banner local-banner-warning" role="alert">
          <Icon name="lock" size={15} />
          <span>
            {state.massiveLock ? (
              <>Proceso masivo en curso: <b>{state.massiveLock.proceso}</b>. La edición y la contabilización están bloqueadas.</>
            ) : (
              <>El período está <b>cerrado</b>. La edición y la contabilización están deshabilitadas.</>
            )}
          </span>
        </div>
      )}

      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        <Button size="sm" icon="lupa" onClick={() => setCompareOpen(true)}>Comparar con el libro</Button>
        <ExportMenu onExport={() => {}} filename={`lote-${lote.codigo}`} />
        <Button size="sm" icon="refresh" onClick={depurar} disabled={!editable} title="Eliminar líneas en cero">Depurar</Button>
        <Button size="sm" icon="user" onClick={() => setReasigOpen(true)} disabled={!editable}>Reasignar</Button>
        <Button size="sm" icon="importar" onClick={() => setImportOpen(true)} disabled={!editable}>Importar</Button>
        <Button size="sm" icon="print" onClick={() => window.print()}>Imprimir</Button>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'lineas', label: 'Líneas', icon: 'list', badge: lote.lineas.length },
          { key: 'validaciones', label: 'Validaciones', icon: 'shield', badge: lote.issues.length },
          { key: 'auditoria', label: 'Auditoría', icon: 'bitacora' },
        ]}
      />

      {tab === 'lineas' && (
        <Card pad={false} title="Líneas del lote" icon="list">
          <AccountingEntryGrid
            lineas={lote.lineas}
            onChange={syncLineas}
            issues={lote.issues}
            readOnly={!editable}
            height={420}
            revealIssue={revealIssue}
          />
          <div className="dcs-wrap">
            <DebitCreditSummary debito={deb} credito={cre} />
            <span className="muted xs">Los cambios se validan automáticamente contra el plan de cuentas y maestros.</span>
          </div>
        </Card>
      )}

      {tab === 'validaciones' && (
        <ValidationCenter
          issues={lote.issues}
          height={360}
          onGoToIssue={(i) => { setRevealIssue(i); setTab('lineas') }}
        />
      )}

      {tab === 'auditoria' && (
        <Card title="Auditoría del lote" icon="bitacora" pad={false}>
          <AuditTimeline events={lote.audit} height={340} />
        </Card>
      )}

      {/* Comparar lote vs libro */}
      <Modal open={compareOpen} onClose={() => setCompareOpen(false)} title={`Comparar lote ${lote.codigo} con el libro`} icon="lupa" width={900}>
        <div className="compare-cols">
          <div className="compare-col">
            <h4>Lote — {lote.lineas.length} líneas</h4>
            <table className="mini-table">
              <thead>
                <tr><th>Cuenta</th><th>NIT</th><th>Centro</th><th className="right">Débito</th><th className="right">Crédito</th></tr>
              </thead>
              <tbody>
                {lote.lineas.map((l) => (
                  <tr key={l.id}>
                    <td className="tnum">{l.cuenta}</td>
                    <td className="tnum">{l.nit || '—'}</td>
                    <td className="tnum">{l.centro || '—'}</td>
                    <td className="money">{l.debito ? money(l.debito) : ''}</td>
                    <td className="money">{l.credito ? money(l.credito) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="compare-col">
            <h4>Libro oficial — {docLibro ? `${docLibro.lineas.length} líneas` : 'sin movimiento'}</h4>
            {docLibro ? (
              <table className="mini-table">
                <thead>
                  <tr><th>Cuenta</th><th>NIT</th><th>Centro</th><th className="right">Débito</th><th className="right">Crédito</th></tr>
                </thead>
                <tbody>
                  {docLibro.lineas.map((l) => (
                    <tr key={l.id}>
                      <td className="tnum">{l.cuenta}</td>
                      <td className="tnum">{l.nit || '—'}</td>
                      <td className="tnum">{l.centro || '—'}</td>
                      <td className="money">{l.debito ? money(l.debito) : ''}</td>
                      <td className="money">{l.credito ? money(l.credito) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="vc-empty"><span className="muted">El documento {lote.documento ?? '—'} aún no está contabilizado.</span></div>
            )}
          </div>
        </div>
      </Modal>

      {/* Importar líneas (simulado) */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar líneas al lote"
        icon="importar"
        width={640}
        footer={
          <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button variant="primary" icon="upload" onClick={importarLineas}>Importar {EJEMPLO_IMPORT.length} líneas</Button>
          </div>
        }
      >
        <div className="stack gap-12">
          <p className="small muted">Simulación de importación: se agregarán las siguientes líneas de ejemplo al lote {lote.codigo}.</p>
          <table className="mini-table">
            <thead>
              <tr><th>Cuenta</th><th>NIT</th><th>Centro</th><th className="right">Débito</th><th className="right">Crédito</th><th>Concepto</th></tr>
            </thead>
            <tbody>
              {EJEMPLO_IMPORT.map((l, i) => (
                <tr key={i}>
                  <td className="tnum">{l.cuenta ?? ''}</td>
                  <td className="tnum">{l.nit || '—'}</td>
                  <td className="tnum">{l.centro || '—'}</td>
                  <td className="money">{l.debito ? money(l.debito) : ''}</td>
                  <td className="money">{l.credito ? money(l.credito) : ''}</td>
                  <td>{l.concepto ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Reasignar */}
      <Modal
        open={reasigOpen}
        onClose={() => setReasigOpen(false)}
        title={`Reasignar lote ${lote.codigo}`}
        icon="user"
        width={420}
        footer={
          <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setReasigOpen(false)}>Cancelar</Button>
            <Button variant="primary" icon="user" onClick={reasignar}>Reasignar</Button>
          </div>
        }
      >
        <Field label="Nuevo usuario responsable">
          <Select value={reasigUsuario} onChange={setReasigUsuario} options={USERS.map((u) => ({ value: u.nombre, label: `${u.nombre} (${u.role})` }))} ariaLabel="Usuario responsable" />
        </Field>
      </Modal>

      {/* Anular lote */}
      <DangerConfirmation
        open={anularOpen}
        onClose={() => setAnularOpen(false)}
        onConfirm={(motivo) => {
          dispatch({ type: 'ANULAR_LOTE', codigo, motivo })
          toast('warning', 'Lote anulado', `Motivo: ${motivo}`)
          audit('Anulación de lote', 'Lotes', `Lote ${codigo} anulado. Motivo: ${motivo}`, 'INFO')
          setAnularOpen(false)
        }}
        title={`Anular lote ${lote.codigo}`}
        descripcion="El lote está contabilizado. La anulación dejará el lote en estado ANULADO y quedará registrada en la bitácora. Para reversar el movimiento contable use el módulo de Anulación de documentos."
        tablasAfectadas={['LOTES', 'BITACORA']}
        confirmText="ANULAR"
        confirmLabel="Anular lote"
        simulacion={[
          { descripcion: 'Líneas del lote', valor: lote.lineas.length },
          { descripcion: 'Total débito', valor: money(deb) },
          { descripcion: 'Total crédito', valor: money(cre) },
        ]}
      />

      {/* Progreso de contabilización */}
      <Modal open={progreso?.lote === codigo} title="Contabilizando lote" icon="refresh" width={440}>
        <div className="stack gap-12">
          <ProgressBar pct={progreso?.pct ?? 0} label="Progreso de contabilización" />
          <p className="small muted">{progreso?.paso ?? 'Preparando…'}</p>
        </div>
      </Modal>

      {/* Recibo de contabilización */}
      <Modal
        open={recibo !== null}
        onClose={cerrarRecibo}
        title="Recibo de contabilización"
        icon="success"
        tone="success"
        width={560}
        footer={
          <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={cerrarRecibo}>Cerrar</Button>
            <Button variant="primary" icon="eye" onClick={verDocumento}>Ver documento oficial</Button>
          </div>
        }
      >
        {recibo && (
          <div className="receipt">
            <div className="receipt-hero">
              <div className="receipt-box">
                <span className="xs muted bold">COMPROBANTE</span>
                <b>{recibo.comprobante}-{consecutivoDe(recibo.comprobante)}</b>
              </div>
              <div className="receipt-box">
                <span className="xs muted bold">DOCUMENTO</span>
                <b>{recibo.documento}</b>
              </div>
            </div>
            <div className="row gap-16">
              <span className="small">Líneas <b className="tnum">{recibo.lineas.length}</b></span>
              <span className="small">Débito <b className="tnum">{money(sum(recibo.lineas.map((l) => l.debito)))}</b></span>
              <span className="small">Crédito <b className="tnum">{money(sum(recibo.lineas.map((l) => l.credito)))}</b></span>
            </div>
            <p className="small muted">Transacción atómica exitosa. El movimiento quedó registrado en el libro oficial.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
