/* ============================================================
   CONTABDSI · Captura directa de movimientos
   ============================================================ */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge, Button, Card, Field, Icon, IconButton, Input, Kbd, Modal, NoPermissionState, PageHeader, ProgressBar, SearchInput, Select,
} from '@/components/ui'
import { AccountingEntryGrid, DebitCreditSummary } from '@/components/accounting/DataGrid'
import { DocumentTypePicker, ThirdPartyPicker, VoucherPicker } from '@/components/accounting/Combobox'
import { usePageTitle, ValidationCenter } from '@/components/accounting/Widgets'
import { useCan, useContabilizar, useStore, validarLote } from '@/state/AppStore'
import { makeLinea } from '@/data/mock'
import { fecha as fechaFmt, money, nombreMes, sum } from '@/core/format'
import type { DocumentoContable, LineaMovimiento, Lote, ValidationIssue } from '@/core/types'
import './pages.css'

const MESES = Array.from({ length: 12 }, (_, i) => ({
  value: `2026${String(i + 1).padStart(2, '0')}`,
  label: `${nombreMes(i + 1)} 2026`,
}))

type FilaExcel = {
  cuenta: string
  nit: string
  centro: string
  debito: number
  credito: number
  base: number
  clase: LineaMovimiento['clase']
  concepto: string
}

const FILAS_EXCEL: FilaExcel[] = [
  { cuenta: '510506', nit: '', centro: 'ADM', debito: 1200000, credito: 0, base: 0, clase: '', concepto: 'Sueldos febrero — Administración' },
  { cuenta: '250505', nit: '900111222', centro: '', debito: 0, credito: 1200000, base: 0, clase: '', concepto: 'Salarios por pagar — quincena' },
  { cuenta: '236540', nit: '901555666', centro: '', debito: 0, credito: 120000, base: 1200000, clase: 'RETENCION', concepto: 'Retención en la fuente por salarios' },
]

interface Plantilla {
  id: string
  nombre: string
  descripcion: string
  lineas: Array<Partial<LineaMovimiento>>
}

const PLANTILLAS: Plantilla[] = [
  {
    id: 'P1', nombre: 'Gasto de nómina básico', descripcion: 'Sueldos + salarios por pagar',
    lineas: [
      { cuenta: '510506', centro: 'ADM', debito: 1200000, concepto: 'Sueldos — Administración' },
      { cuenta: '250505', nit: '900111222', credito: 1200000, concepto: 'Salarios por pagar' },
    ],
  },
  {
    id: 'P2', nombre: 'Pago proveedor con retención', descripcion: 'Gasto + retención + banco',
    lineas: [
      { cuenta: '510506', centro: 'ADM', debito: 1000000, base: 1000000, clase: 'OTRO', concepto: 'Servicios técnicos' },
      { cuenta: '236540', nit: '900333444', credito: 40000, base: 1000000, clase: 'RETENCION', concepto: 'Retefuente servicios 4%' },
      { cuenta: '111005', nit: '900777000', credito: 960000, concepto: 'Pago neto banco' },
    ],
  },
  {
    id: 'P3', nombre: 'Ajuste por redondeo', descripcion: 'Gasto financiero + caja',
    lineas: [
      { cuenta: '510506', centro: 'ADM', debito: 100, concepto: 'Ajuste por redondeo' },
      { cuenta: '110505', credito: 100, concepto: 'Ajuste caja' },
    ],
  },
]

export function CapturaDirectaPage() {
  usePageTitle('Captura directa')
  const navigate = useNavigate()
  const { state, dispatch, toast, audit } = useStore()
  const puedeCapturar = useCan('mov.capturar')
  const { contabilizar, progreso } = useContabilizar()

  const periodoActual = `${state.session.year}${String(state.session.period).padStart(2, '0')}`
  const [periodo, setPeriodo] = useState(periodoActual)
  const [fecha, setFecha] = useState('2026-02-28')
  const [comprobante, setComprobante] = useState('CE')
  const [tipoDoc, setTipoDoc] = useState('CE')
  const [numeroDoc, setNumeroDoc] = useState('')
  const [tercero, setTercero] = useState('')
  const [docAfectado, setDocAfectado] = useState('')
  const [concepto, setConcepto] = useState('')

  const [lineas, setLineas] = useState<LineaMovimiento[]>(() => [makeLinea({ fecha: '2026-02-28', comprobante: 'CE' })])
  const [selIdx, setSelIdx] = useState(0)
  const [vcOpen, setVcOpen] = useState(true)
  const [openExcel, setOpenExcel] = useState(false)
  const [openPlantilla, setOpenPlantilla] = useState(false)
  const [openCargar, setOpenCargar] = useState(false)
  const [openResumen, setOpenResumen] = useState(false)
  const [recibo, setRecibo] = useState<DocumentoContable | null>(null)
  const [contabilizando, setContabilizando] = useState(false)
  const [qDoc, setQDoc] = useState('')

  const soloLectura = state.periodStatus === 'CERRADO' || Boolean(state.massiveLock)

  const pseudoLote = useMemo<Lote>(() => ({
    codigo: 'CAPTURA',
    nombre: 'Captura directa',
    periodo,
    usuario: state.session.user.nombre,
    origen: 'CAPTURA',
    fecha,
    lineas,
    estado: 'BORRADOR',
    issues: [],
    audit: [],
  }), [periodo, fecha, lineas, state.session.user.nombre])

  const issues = useMemo<ValidationIssue[]>(
    () => validarLote(pseudoLote, state.accounts, state.terceros, state.centros, state.documentos),
    [pseudoLote, state.accounts, state.terceros, state.centros, state.documentos],
  )

  const deb = useMemo(() => sum(lineas.map((l) => l.debito)), [lineas])
  const cre = useMemo(() => sum(lineas.map((l) => l.credito)), [lineas])
  const dif = Math.round((deb - cre) * 100) / 100
  const hayErrores = issues.some((i) => i.severidad === 'ERROR')
  const docKey = tipoDoc && numeroDoc ? `${tipoDoc}-${numeroDoc}` : ''
  const puedeContabilizar = !soloLectura && lineas.length > 0 && Math.abs(dif) < 0.005 && !hayErrores

  useEffect(() => {
    if (selIdx >= lineas.length) setSelIdx(Math.max(0, lineas.length - 1))
  }, [lineas.length, selIdx])

  useEffect(() => {
    const onReceipt = (e: Event) => {
      const doc = (e as CustomEvent<DocumentoContable>).detail
      setRecibo(doc)
      setContabilizando(false)
    }
    window.addEventListener('contab:receipt', onReceipt)
    return () => window.removeEventListener('contab:receipt', onReceipt)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F4') { e.preventDefault(); setOpenCargar(true) }
      else if (e.key === 'F5') { e.preventDefault(); setOpenPlantilla(true) }
      else if (e.key === 'F6') { e.preventDefault(); setOpenExcel(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!puedeCapturar) {
    return (
      <div className="page">
        <NoPermissionState perm="mov.capturar" />
      </div>
    )
  }

  const generarCodigo = () => {
    const v = state.vouchers.find((x) => x.code === comprobante)
    const base = String(v?.consecutivo ?? state.lotes.length + 1).padStart(2, '0').slice(-2)
    let codigo = `${comprobante}-${base}`
    let i = 0
    while (state.lotes.some((l) => l.codigo === codigo)) {
      i += 1
      codigo = `${comprobante}-${base}${String.fromCharCode(64 + i)}`
    }
    return codigo
  }

  const consecutivoDe = (code: string) => {
    const v = state.vouchers.find((x) => x.code === code)
    return String(v?.consecutivo ?? 0).padStart(6, '0')
  }

  const agregarLinea = () => {
    if (soloLectura) return
    const nl = makeLinea({ fecha, comprobante, documento: docKey, concepto })
    setLineas((prev) => [...prev, nl])
    setSelIdx(lineas.length)
  }

  const duplicarLinea = () => {
    if (soloLectura) return
    const src = lineas[selIdx]
    if (!src) return
    const cp = makeLinea({ ...src })
    const next = [...lineas]
    next.splice(selIdx + 1, 0, cp)
    setLineas(next)
    setSelIdx(selIdx + 1)
  }

  const eliminarLinea = () => {
    if (soloLectura || lineas.length <= 1) return
    setLineas(lineas.filter((_, i) => i !== selIdx))
  }

  const moverLinea = (dir: -1 | 1) => {
    if (soloLectura) return
    const to = selIdx + dir
    if (to < 0 || to >= lineas.length) return
    const next = [...lineas]
    const [item] = next.splice(selIdx, 1)
    next.splice(to, 0, item)
    setLineas(next)
    setSelIdx(to)
  }

  const insertarExcel = () => {
    const nuevas = FILAS_EXCEL.map((f) => makeLinea({ ...f, fecha, comprobante, documento: docKey }))
    setLineas((prev) => [...prev, ...nuevas])
    setSelIdx(lineas.length)
    setOpenExcel(false)
    toast('success', 'Filas insertadas', `${nuevas.length} líneas importadas desde Excel (simulado).`)
  }

  const aplicarPlantilla = (p: Plantilla) => {
    const nuevas = p.lineas.map((pl) => makeLinea({ ...pl, fecha, comprobante, documento: docKey, origen: 'CAPTURA' }))
    setLineas((prev) => [...prev, ...nuevas])
    setOpenPlantilla(false)
    toast('success', 'Plantilla aplicada', `${p.nombre}: ${nuevas.length} líneas agregadas.`)
  }

  const cargarDocumento = (d: DocumentoContable) => {
    setLineas(d.lineas.map((l) => makeLinea({ ...l })))
    setComprobante(d.comprobante)
    setTipoDoc(d.comprobante)
    setNumeroDoc('')
    setTercero(d.nit ?? '')
    setConcepto(d.concepto)
    setOpenCargar(false)
    setSelIdx(0)
    toast('info', 'Documento cargado', `${d.documento} — ${d.lineas.length} líneas listas para editar.`)
  }

  const guardarBorrador = () => {
    if (soloLectura || lineas.length === 0) return
    const codigo = generarCodigo()
    const lote: Lote = {
      codigo,
      nombre: (concepto || `Captura ${comprobante} ${docKey}`).trim(),
      periodo,
      usuario: state.session.user.nombre,
      origen: 'CAPTURA',
      fecha,
      lineas,
      estado: 'BORRADOR',
      issues,
      comprobante,
      documento: docKey,
      audit: [],
    }
    dispatch({ type: 'ADD_LOTE', lote })
    audit('Guardar borrador', 'Movimientos', `Lote ${codigo} guardado como borrador (${lineas.length} líneas)`)
    toast('success', 'Borrador guardado', `Lote ${codigo} creado con ${lineas.length} líneas.`)
  }

  const confirmarContabilizar = () => {
    if (!puedeContabilizar) return
    const codigo = generarCodigo()
    const lote: Lote = {
      codigo,
      nombre: (concepto || `Captura ${comprobante} ${docKey}`).trim(),
      periodo,
      usuario: state.session.user.nombre,
      origen: 'CAPTURA',
      fecha,
      lineas,
      estado: 'APROBADO',
      issues,
      comprobante,
      documento: docKey,
      audit: [],
    }
    dispatch({ type: 'ADD_LOTE', lote })
    audit('Captura directa', 'Movimientos', `Lote ${codigo} creado y aprobado para contabilización (${lineas.length} líneas)`)
    setOpenResumen(false)
    setContabilizando(true)
    window.setTimeout(() => contabilizar(codigo), 80)
  }

  const cerrarRecibo = () => {
    setRecibo(null)
    if (recibo) navigate(`/movimientos/lotes/${recibo.lote}`)
  }

  const verDocumento = () => {
    if (recibo) navigate(`/documentos/${recibo.id}`)
  }

  const tituloContab = soloLectura
    ? 'El período está cerrado o hay un proceso masivo en curso'
    : hayErrores
      ? 'Corrija los errores de validación antes de contabilizar'
      : Math.abs(dif) >= 0.005
        ? 'El movimiento está descuadrado. Iguale débito y crédito.'
        : lineas.length === 0
          ? 'Agregue al menos una línea'
          : 'Contabilizar el movimiento'

  const docsFiltrados = state.documentos.filter((d) =>
    `${d.comprobante} ${d.documento} ${d.concepto}`.toLowerCase().includes(qDoc.toLowerCase()),
  )

  const nombrePeriodo = nombreMes(Number(periodo.slice(4, 6)) || 1)

  return (
    <div className="page">
      <PageHeader
        title="Captura directa"
        subtitle={`Nueva entrada de movimiento · Período ${nombrePeriodo} ${periodo.slice(0, 4)}`}
        icon="entrada"
      />

      {soloLectura && (
        <div className="local-banner local-banner-warning" role="alert">
          <Icon name="lock" size={15} />
          <span>
            {state.massiveLock ? (
              <>Proceso masivo en curso: <b>{state.massiveLock.proceso}</b>. La captura está bloqueada.</>
            ) : (
              <>El período está <b>cerrado</b>. La captura es de solo lectura.</>
            )}
          </span>
        </div>
      )}

      <div className="querybar">
        <Field label="Período" width={130}>
          <Select value={periodo} onChange={setPeriodo} options={MESES} disabled={soloLectura} ariaLabel="Período" />
        </Field>
        <Field label="Fecha" width={140}>
          <Input type="date" value={fecha} onChange={setFecha} disabled={soloLectura} ariaLabel="Fecha del movimiento" />
        </Field>
        <Field label="Comprobante" width={150}>
          <VoucherPicker value={comprobante} onChange={setComprobante} width={150} disabled={soloLectura} />
        </Field>
        <Field label="Tipo doc." width={110}>
          <DocumentTypePicker value={tipoDoc} onChange={setTipoDoc} width={110} disabled={soloLectura} />
        </Field>
        <Field label="Número" width={110}>
          <Input value={numeroDoc} onChange={setNumeroDoc} placeholder="Número" monospace disabled={soloLectura} ariaLabel="Número de documento" />
        </Field>
        <Field label="Tercero" width={180}>
          <ThirdPartyPicker value={tercero} onChange={setTercero} width={180} disabled={soloLectura} />
        </Field>
        <Field label="Doc. afectado" width={150}>
          <Input value={docAfectado} onChange={setDocAfectado} placeholder="Documento afectado" disabled={soloLectura} ariaLabel="Documento afectado" />
        </Field>
        <Field label="Concepto" width={220} className="grow">
          <Input value={concepto} onChange={setConcepto} placeholder="Concepto del movimiento" disabled={soloLectura} ariaLabel="Concepto" />
        </Field>
      </div>

      <div className="shortcut-bar" aria-label="Atajos de teclado">
        <span className="bold">Atajos:</span>
        <span className="shortcut"><Kbd>Enter</Kbd> editar celda</span>
        <span className="shortcut"><Kbd>F2</Kbd> validar línea</span>
        <span className="shortcut"><Kbd>F3</Kbd> eliminar línea</span>
        <span className="shortcut"><Kbd>F4</Kbd> cargar movimiento</span>
        <span className="shortcut"><Kbd>F5</Kbd> aplicar plantilla</span>
        <span className="shortcut"><Kbd>F6</Kbd> importar Excel</span>
      </div>

      <Card pad={false} title="Líneas del movimiento" icon="list">
        <AccountingEntryGrid
          lineas={lineas}
          onChange={setLineas}
          issues={issues}
          readOnly={soloLectura}
          height={400}
          extraActions={
            <div className="row gap-4" style={{ flexWrap: 'wrap' }}>
              <Button size="sm" icon="plus" onClick={agregarLinea} disabled={soloLectura}>Agregar línea</Button>
              <Button size="sm" icon="copy" onClick={duplicarLinea} disabled={soloLectura || !lineas[selIdx]} title="Duplicar la línea seleccionada">Duplicar</Button>
              <Button size="sm" danger icon="trash" onClick={eliminarLinea} disabled={soloLectura || lineas.length <= 1} title="Eliminar la línea seleccionada">Eliminar</Button>
              <IconButton icon="arrowUp" label="Mover línea arriba" size={24} onClick={() => moverLinea(-1)} disabled={soloLectura || selIdx === 0} />
              <IconButton icon="arrowDown" label="Mover línea abajo" size={24} onClick={() => moverLinea(1)} disabled={soloLectura || selIdx >= lineas.length - 1} />
              <span className="muted xs tnum">Línea {selIdx + 1} de {lineas.length}</span>
            </div>
          }
        />
        <div className="dcs-wrap">
          <DebitCreditSummary debito={deb} credito={cre} />
          <div className="row gap-8">
            <Button size="sm" icon="excel" onClick={() => setOpenExcel(true)} disabled={soloLectura}>Pegar desde Excel</Button>
            <Button size="sm" icon="plantilla" onClick={() => setOpenPlantilla(true)} disabled={soloLectura}>Aplicar plantilla</Button>
            <Button size="sm" icon="file" onClick={() => setOpenCargar(true)} disabled={soloLectura}>Cargar documento existente</Button>
          </div>
        </div>
      </Card>

      <div className="stack gap-8">
        <button type="button" className="vc-toggle" onClick={() => setVcOpen((o) => !o)} aria-expanded={vcOpen}>
          <Icon name="shield" size={15} className={hayErrores ? 'neg' : issues.length > 0 ? 'vc-warn' : 'pos'} />
          <span className="bold small">Centro de validación</span>
          <Badge tone={hayErrores ? 'danger' : issues.length > 0 ? 'warning' : 'success'}>
            {issues.filter((i) => i.severidad === 'ERROR').length} errores · {issues.filter((i) => i.severidad === 'ADVERTENCIA').length} avisos
          </Badge>
          <Icon name={vcOpen ? 'chevronD' : 'chevronR'} size={13} className="muted" />
        </button>
        {vcOpen && <ValidationCenter issues={issues} height={220} />}
      </div>

      {contabilizando && progreso && (
        <div className="local-banner local-banner-info" role="status">
          <Icon name="refresh" size={15} />
          <div className="grow">
            <b>Contabilizando lote…</b>
            <ProgressBar pct={progreso.pct} label="Progreso de contabilización" />
            <span className="xs muted">{progreso.paso}</span>
          </div>
        </div>
      )}

      <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
        <Button icon="save" onClick={guardarBorrador} disabled={soloLectura || lineas.length === 0}>Guardar borrador</Button>
        <Button variant="primary" icon="check" onClick={() => setOpenResumen(true)} disabled={!puedeContabilizar} title={tituloContab}>
          Contabilizar
        </Button>
      </div>

      {/* Pegar desde Excel (simulado) */}
      <Modal
        open={openExcel}
        onClose={() => setOpenExcel(false)}
        title="Pegar desde Excel"
        icon="excel"
        width={680}
        footer={
          <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setOpenExcel(false)}>Cancelar</Button>
            <Button variant="primary" icon="upload" onClick={insertarExcel}>Insertar {FILAS_EXCEL.length} filas</Button>
          </div>
        }
      >
        <div className="stack gap-12">
          <p className="small muted">Portapapeles detectado (simulado). Las siguientes filas de ejemplo se insertarán al final del movimiento.</p>
          <table className="mini-table">
            <thead>
              <tr>
                <th>Cuenta</th><th>NIT</th><th>Centro</th>
                <th className="right">Débito</th><th className="right">Crédito</th><th>Concepto</th>
              </tr>
            </thead>
            <tbody>
              {FILAS_EXCEL.map((f, i) => (
                <tr key={i}>
                  <td className="tnum">{f.cuenta}</td>
                  <td className="tnum">{f.nit || '—'}</td>
                  <td className="tnum">{f.centro || '—'}</td>
                  <td className="money">{f.debito ? money(f.debito) : ''}</td>
                  <td className="money">{f.credito ? money(f.credito) : ''}</td>
                  <td>{f.concepto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Plantillas */}
      <Modal open={openPlantilla} onClose={() => setOpenPlantilla(false)} title="Aplicar plantilla" icon="plantilla" width={640}>
        <div className="modal-list">
          {PLANTILLAS.map((p) => (
            <div
              key={p.id}
              className="modal-list-item"
              role="button"
              tabIndex={0}
              onClick={() => aplicarPlantilla(p)}
              onKeyDown={(e) => { if (e.key === 'Enter') aplicarPlantilla(p) }}
            >
              <Icon name="plantilla" size={15} className="muted" />
              <span className="grow">
                <b className="small">{p.nombre}</b>
                <span className="xs muted" style={{ display: 'block' }}>{p.descripcion} · {p.lineas.length} líneas</span>
              </span>
              <Icon name="chevronR" size={13} className="muted" />
            </div>
          ))}
        </div>
      </Modal>

      {/* Cargar documento existente */}
      <Modal open={openCargar} onClose={() => setOpenCargar(false)} title="Cargar documento existente" icon="file" width={680}>
        <div className="stack gap-8">
          <SearchInput value={qDoc} onChange={setQDoc} placeholder="Buscar documento…" width={260} />
          <div className="modal-list">
            {docsFiltrados.length === 0 ? (
              <div className="vc-empty"><span className="muted">Sin documentos que coincidan.</span></div>
            ) : (
              docsFiltrados.map((d) => (
                <div
                  key={d.id}
                  className="modal-list-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => cargarDocumento(d)}
                  onKeyDown={(e) => { if (e.key === 'Enter') cargarDocumento(d) }}
                >
                  <Icon name="doc" size={15} className="muted" />
                  <span className="grow">
                    <b className="small tnum">{d.comprobante} · {d.documento}</b>
                    <span className="xs muted" style={{ display: 'block' }}>{fechaFmt(d.fecha)} — {d.concepto} · {d.lineas.length} líneas</span>
                  </span>
                  <Icon name="chevronR" size={13} className="muted" />
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Resumen de contabilización */}
      <Modal
        open={openResumen}
        onClose={() => setOpenResumen(false)}
        title="Resumen de contabilización"
        icon="check"
        width={720}
        footer={
          <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setOpenResumen(false)}>Cancelar</Button>
            <Button variant="primary" icon="play" onClick={confirmarContabilizar}>Confirmar y contabilizar</Button>
          </div>
        }
      >
        <div className="stack gap-12">
          <div className="row gap-16" style={{ flexWrap: 'wrap' }}>
            <span className="small">Comprobante <b className="tnum">{comprobante}</b></span>
            <span className="small">Documento <b className="tnum">{docKey || '—'}</b></span>
            <span className="small">Fecha <b className="tnum">{fecha}</b></span>
            <span className="small">Período <b className="tnum">{periodo}</b></span>
            <span className="small">{lineas.length} líneas</span>
          </div>
          <table className="mini-table">
            <thead>
              <tr>
                <th>Cuenta</th><th>NIT</th><th>Centro</th>
                <th className="right">Débito</th><th className="right">Crédito</th><th>Concepto</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.id}>
                  <td className="tnum">{l.cuenta || '—'}</td>
                  <td className="tnum">{l.nit || '—'}</td>
                  <td className="tnum">{l.centro || '—'}</td>
                  <td className="money">{l.debito ? money(l.debito) : ''}</td>
                  <td className="money">{l.credito ? money(l.credito) : ''}</td>
                  <td>{l.concepto}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <DebitCreditSummary debito={deb} credito={cre} />
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
            <Button onClick={cerrarRecibo}>Ir al lote</Button>
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
