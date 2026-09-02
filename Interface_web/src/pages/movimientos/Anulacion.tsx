/* ============================================================
   CONTABDSI · Anulación de documentos — reversión trazable
   ============================================================ */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge, Button, Card, EmptyState, Field, Icon, Input, LoadingState, Modal, NoPermissionState, PageHeader, Select, Textarea,
} from '@/components/ui'
import { AccountingDataGrid, type GridColumn } from '@/components/accounting/DataGrid'
import { TerceroLabel, ThirdPartyPicker, VoucherPicker } from '@/components/accounting/Combobox'
import { InfoStrip, MoneyInput, usePageTitle } from '@/components/accounting/Widgets'
import { useCan, useStore } from '@/state/AppStore'
import { makeDocumento, makeLinea } from '@/data/mock'
import { fecha, money, nombreMes, nitFmt, sum } from '@/core/format'
import type { DocumentoContable } from '@/core/types'

const MESES = Array.from({ length: 12 }, (_, i) => ({
  value: `2026${String(i + 1).padStart(2, '0')}`,
  label: `${nombreMes(i + 1)} 2026`,
}))

export function AnulacionPage() {
  usePageTitle('Anulación de documentos')
  const { state, dispatch, toast, audit } = useStore()
  const puedeAnular = useCan('mov.anular')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const t = window.setTimeout(() => setCargando(false), 400)
    return () => window.clearTimeout(t)
  }, [])

  const periodoActual = `${state.session.year}${String(state.session.period).padStart(2, '0')}`
  const [periodo, setPeriodo] = useState(periodoActual)
  const [tipo, setTipo] = useState('')
  const [numero, setNumero] = useState('')
  const [comprobante, setComprobante] = useState('')
  const [nit, setNit] = useState('')
  const [valor, setValor] = useState(0)

  const [seleccion, setSeleccion] = useState<DocumentoContable | null>(null)
  const [revFecha, setRevFecha] = useState('2026-02-28')
  const [revPeriodo, setRevPeriodo] = useState(periodoActual)
  const [revComprobante, setRevComprobante] = useState('NI')
  const [motivo, setMotivo] = useState('')
  const [soporte, setSoporte] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  const resultados = useMemo(
    () => state.documentos.filter((d) => {
      if (d.estado !== 'CONTABILIZADO') return false
      if (d.periodo !== periodo) return false
      if (comprobante && d.comprobante !== comprobante) return false
      if (tipo && !d.documento.toUpperCase().includes(tipo.toUpperCase())) return false
      if (numero && !d.documento.includes(numero)) return false
      if (nit && d.nit !== nit) return false
      if (valor > 0 && !d.lineas.some((l) => l.debito === valor || l.credito === valor)) return false
      return true
    }),
    [state.documentos, periodo, comprobante, tipo, numero, nit, valor],
  )

  if (!puedeAnular) {
    return (
      <div className="page">
        <NoPermissionState perm="mov.anular" />
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="page">
        <PageHeader title="Anulación" icon="anular" />
        <Card>
          <LoadingState label="Cargando documentos…" />
        </Card>
      </div>
    )
  }

  const periodoCerrado = state.periodStatus === 'CERRADO' || Boolean(state.massiveLock)
  const reversado = (id: string) => state.documentos.some((d) => d.reversoDe === id)
  const reversionDe = (id: string) => state.documentos.find((d) => d.reversoDe === id)
  const motivoValido = motivo.trim().length >= 10
  const puedeConfirmar = puedeAnular && !periodoCerrado && seleccion !== null && motivoValido && !reversado(seleccion.id)

  const documentosAfectados = seleccion
    ? state.documentos.filter((d) => d.id !== seleccion.id && d.nit && d.nit === seleccion.nit)
    : []

  const elegir = (d: DocumentoContable) => {
    if (reversado(d.id)) {
      toast('warning', 'Documento ya reversado', `${d.documento} ya tiene una reversión asociada.`)
      return
    }
    setSeleccion(d)
    setMotivo('')
    setSoporte('')
  }

  const limpiar = () => {
    setTipo('')
    setNumero('')
    setComprobante('')
    setNit('')
    setValor(0)
    setSeleccion(null)
  }

  const confirmarReversion = () => {
    if (!seleccion || !puedeConfirmar) return
    const lineasInv = seleccion.lineas.map((l) => makeLinea({
      ...l,
      debito: l.credito,
      credito: l.debito,
      concepto: `Reversión de ${seleccion.documento}`,
    }))
    const docReversion = makeDocumento({
      comprobante: revComprobante,
      documento: `REV-${seleccion.documento}`,
      fecha: revFecha,
      periodo: revPeriodo,
      tercero: seleccion.tercero,
      nit: seleccion.nit,
      concepto: `Reversión de ${seleccion.documento} — ${motivo}`,
      estado: 'CONTABILIZADO',
      lineas: lineasInv,
      lote: seleccion.lote,
      usuario: state.session.user.nombre,
      reversoDe: seleccion.id,
    })
    const loteOriginal = state.lotes.find((l) => l.codigo === seleccion.lote)
    if (loteOriginal) {
      dispatch({ type: 'CONTABILIZAR_OK', codigo: loteOriginal.codigo, documento: docReversion })
    }
    audit('Anulación de documento', 'Movimientos', `Reversión de ${seleccion.documento} → ${docReversion.documento}. Motivo: ${motivo}`, 'EXITO')
    toast('success', 'Reversión generada', `${seleccion.documento} quedó reversado. Asiento inverso: ${docReversion.documento}.`)
    if (!loteOriginal) {
      toast('warning', 'Reversión simulada', 'El lote original no existe en el estado actual; la reversión quedó registrada solo en la bitácora.')
    }
    setPreviewOpen(false)
  }

  const tituloConfirmar = !puedeAnular
    ? 'Su rol no tiene el permiso mov.anular'
    : periodoCerrado
      ? 'El período está cerrado o hay un proceso masivo en curso'
      : !motivoValido
        ? 'Escriba un motivo de al menos 10 caracteres'
        : 'Confirmar la anulación'

  const columnas: GridColumn<DocumentoContable>[] = [
    { key: 'comprobante', label: 'Comp.', minWidth: 60, searchValue: (d) => d.comprobante },
    { key: 'documento', label: 'Documento', minWidth: 150, render: (d) => <b className="tnum">{d.documento}</b>, searchValue: (d) => d.documento },
    { key: 'fecha', label: 'Fecha', minWidth: 90, render: (d) => <span className="tnum">{fecha(d.fecha)}</span> },
    { key: 'nit', label: 'NIT', minWidth: 120, render: (d) => <span className="tnum">{d.nit ? nitFmt(d.nit) : '—'}</span> },
    { key: 'tercero', label: 'Tercero', minWidth: 190, render: (d) => <TerceroLabel nit={d.nit} /> },
    { key: 'concepto', label: 'Concepto', minWidth: 200 },
    { key: 'debito', label: 'Débito', align: 'right', money: true, minWidth: 130, render: (d) => <span className="money">{money(sum(d.lineas.map((l) => l.debito)))}</span> },
    { key: 'credito', label: 'Crédito', align: 'right', money: true, minWidth: 130, render: (d) => <span className="money">{money(sum(d.lineas.map((l) => l.credito)))}</span> },
    {
      key: 'estado', label: 'Estado', minWidth: 130,
      render: (d) => (reversado(d.id) ? <Badge tone="warning" icon="x">Reversado</Badge> : <Badge tone="success" icon="check">Contabilizado</Badge>),
    },
  ]

  return (
    <div className="page">
      <PageHeader title="Anulación de documentos" subtitle="Reversión trazable de movimientos contabilizados" icon="anular" />

      <div className="querybar">
        <Field label="Período" width={130}>
          <Select value={periodo} onChange={setPeriodo} options={MESES} ariaLabel="Período de búsqueda" />
        </Field>
        <Field label="Tipo doc." width={100}>
          <Input value={tipo} onChange={setTipo} placeholder="NOM, CE…" monospace ariaLabel="Tipo de documento" />
        </Field>
        <Field label="Número" width={110}>
          <Input value={numero} onChange={setNumero} placeholder="Número" monospace ariaLabel="Número de documento" />
        </Field>
        <Field label="Comprobante" width={150}>
          <VoucherPicker value={comprobante} onChange={setComprobante} width={150} />
        </Field>
        <Field label="NIT" width={170}>
          <ThirdPartyPicker value={nit} onChange={setNit} width={170} />
        </Field>
        <Field label="Valor" width={140}>
          <MoneyInput value={valor} onChange={setValor} width={140} />
        </Field>
        <Button variant="ghost" icon="x" onClick={limpiar}>Limpiar</Button>
      </div>

      <div className="anul-layout">
        <div className="stack gap-12">
          <Card
            title="Documentos contabilizados"
            icon="doc"
            pad={false}
            actions={<span className="muted xs">{resultados.length} coincidencia(s)</span>}
          >
            <AccountingDataGrid
              rows={resultados}
              columns={columnas}
              rowKey={(d) => d.id}
              selectable={false}
              searchable={false}
              height={360}
              onRowClick={elegir}
              empty={
                <EmptyState
                  icon="lupa"
                  title="Sin resultados"
                  detail="Ajuste los filtros: período, tipo/número, comprobante, NIT o valor."
                />
              }
            />
          </Card>

          <div className="local-banner local-banner-info" role="note">
            <Icon name="link" size={15} />
            <span>
              La reversión es <b>trazable</b>: el documento original <b>permanece</b> en el libro oficial, se genera un
              asiento inverso enlazado y todo queda registrado en la bitácora de auditoría. No se elimina información.
            </span>
          </div>
        </div>

        <div className="stack gap-12">
          {!seleccion ? (
            <Card>
              <EmptyState icon="anular" title="Sin documento seleccionado" detail="Seleccione un documento de la grilla para preparar su reversión." />
            </Card>
          ) : (
            <>
              <Card
                title={`Movimiento original — ${seleccion.documento}`}
                icon="doc"
                tone="warning"
                actions={
                  reversado(seleccion.id)
                    ? <Badge tone="danger" icon="x">ANULADO</Badge>
                    : <Badge tone="success" icon="check">Contabilizado</Badge>
                }
              >
                <InfoStrip
                  items={[
                    { label: 'Comprobante', value: <span className="tnum">{seleccion.comprobante}</span> },
                    { label: 'Documento', value: <span className="tnum">{seleccion.documento}</span> },
                    { label: 'Fecha', value: <span className="tnum">{fecha(seleccion.fecha)}</span> },
                    { label: 'Período', value: <span className="tnum">{seleccion.periodo}</span> },
                    { label: 'Tercero', value: <TerceroLabel nit={seleccion.nit} /> },
                    { label: 'Concepto', value: seleccion.concepto },
                  ]}
                />
                <div className="stack gap-8" style={{ marginTop: 10 }}>
                  <table className="mini-table">
                    <thead>
                      <tr><th>Cuenta</th><th>NIT</th><th>Centro</th><th className="right">Débito</th><th className="right">Crédito</th><th>Concepto</th></tr>
                    </thead>
                    <tbody>
                      {seleccion.lineas.map((l) => (
                        <tr key={l.id}>
                          <td className="tnum">{l.cuenta}</td>
                          <td className="tnum">{l.nit || '—'}</td>
                          <td className="tnum">{l.centro || '—'}</td>
                          <td className="money">{l.debito ? money(l.debito) : ''}</td>
                          <td className="money">{l.credito ? money(l.credito) : ''}</td>
                          <td>{l.concepto}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {documentosAfectados.length > 0 && (
                    <div className="stack gap-4">
                      <span className="xs muted bold">DOCUMENTOS RELACIONADOS (mismo NIT)</span>
                      {documentosAfectados.map((a) => (
                        <div key={a.id} className="row gap-8">
                          <Icon name="doc" size={13} className="muted" />
                          <Link to={`/documentos/${a.id}`} className="small">{a.documento} — {a.concepto}</Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              <Card title="Formulario de reversión" icon="anular">
                <div className="stack gap-12">
                  <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
                    <Field label="Fecha de reversión" width={150}>
                      <Input type="date" value={revFecha} onChange={setRevFecha} ariaLabel="Fecha de reversión" />
                    </Field>
                    <Field label="Período de reversión" width={160}>
                      <Select value={revPeriodo} onChange={setRevPeriodo} options={MESES} ariaLabel="Período de reversión" />
                    </Field>
                    <Field label="Comprobante" width={150}>
                      <VoucherPicker value={revComprobante} onChange={setRevComprobante} width={150} />
                    </Field>
                  </div>
                  <Field
                    label="Motivo"
                    required
                    hint="Mínimo 10 caracteres. Quedará registrado en la bitácora de auditoría."
                    error={motivo.trim().length > 0 && motivo.trim().length < 10 ? 'El motivo debe tener al menos 10 caracteres.' : undefined}
                  >
                    <Textarea value={motivo} onChange={setMotivo} rows={2} placeholder="Explique por qué se reversa este documento…" />
                  </Field>
                  <Field label="Soporte (opcional)">
                    <div className="row gap-8">
                      <input
                        className="input"
                        type="file"
                        aria-label="Soporte de la reversión"
                        onChange={(e) => setSoporte(e.target.files?.[0]?.name ?? '')}
                      />
                      {soporte ? <span className="xs muted"><Icon name="file" size={12} /> {soporte}</span> : null}
                    </div>
                  </Field>
                  <div className="row gap-8">
                    <Button icon="eye" onClick={() => setPreviewOpen(true)} disabled={!motivoValido}>Previsualizar asiento inverso</Button>
                    <span className="spacer" />
                    <Button variant="danger" icon="anular" disabled={!puedeConfirmar} title={tituloConfirmar} onClick={confirmarReversion}>
                      Confirmar anulación
                    </Button>
                  </div>
                  {periodoCerrado && (
                    <div className="local-banner local-banner-warning" role="alert">
                      <Icon name="lock" size={15} />
                      <span>El período está <b>cerrado</b> o hay un proceso masivo en curso: la anulación está bloqueada.</span>
                    </div>
                  )}
                </div>
              </Card>

              {reversionDe(seleccion.id) && (
                <Card title="Original ↔ Reversión" icon="link" tone="success">
                  <div className="rev-cards">
                    <div className="rev-card rev-card-tone-danger">
                      <div className="row gap-8">
                        <Badge tone="danger" icon="x">ANULADO</Badge>
                        <b className="small tnum">{seleccion.documento}</b>
                      </div>
                      <span className="xs muted">{fecha(seleccion.fecha)} · {seleccion.concepto}</span>
                    </div>
                    <div className="rev-arrow">
                      <Icon name="chevronR" size={18} />
                      <Icon name="chevronL" size={18} />
                    </div>
                    <div className="rev-card rev-card-tone-success">
                      <div className="row gap-8">
                        <Badge tone="success" icon="check">REVERSIÓN</Badge>
                        <b className="small tnum">{reversionDe(seleccion.id)?.documento}</b>
                      </div>
                      <span className="xs muted">Asiento inverso generado y enlazado.</span>
                      <Link to={`/documentos/${reversionDe(seleccion.id)?.id}`} className="small">Ver documento oficial →</Link>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* Previsualizar asiento inverso */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Asiento inverso — ${seleccion?.documento ?? ''}`}
        icon="eye"
        width={760}
        footer={
          <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setPreviewOpen(false)}>Cerrar</Button>
            <Button variant="danger" icon="anular" disabled={!puedeConfirmar} onClick={confirmarReversion}>Confirmar anulación</Button>
          </div>
        }
      >
        {seleccion && (
          <div className="stack gap-12">
            <p className="small muted">
              Las mismas líneas con débito/crédito invertidos y concepto «Reversión de {seleccion.documento}».
              Período de reversión {revPeriodo} · comprobante {revComprobante}.
            </p>
            <table className="mini-table">
              <thead>
                <tr><th>Cuenta</th><th>NIT</th><th>Centro</th><th className="right">Débito</th><th className="right">Crédito</th><th>Concepto</th></tr>
              </thead>
              <tbody>
                {seleccion.lineas.map((l) => (
                  <tr key={l.id}>
                    <td className="tnum">{l.cuenta}</td>
                    <td className="tnum">{l.nit || '—'}</td>
                    <td className="tnum">{l.centro || '—'}</td>
                    <td className="money">{l.credito ? money(l.credito) : ''}</td>
                    <td className="money">{l.debito ? money(l.debito) : ''}</td>
                    <td>Reversión de {seleccion.documento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
