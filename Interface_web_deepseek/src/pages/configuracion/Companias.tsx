/* ============================================================
   CONTABDSI · Configuración → Compañías
   ============================================================ */

import { useEffect, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  Toolbar,
  ToolbarGroup,
} from '@/components/ui'
import { AccountingDataGrid, type GridColumn } from '@/components/accounting/DataGrid'
import { DangerConfirmation, usePageTitle } from '@/components/accounting/Widgets'
import { useStore } from '@/state/AppStore'

export interface Compania {
  codigo: string
  nombre: string
  nit: string
  estado: 'ACTIVA' | 'INACTIVA'
  registros: number
  ultimoCierre: string
}

const INICIALES: Compania[] = [
  { codigo: '001', nombre: 'Compañía Demo S.A.S.', nit: '900.123.456-7', estado: 'ACTIVA', registros: 12480, ultimoCierre: '2026-01-31' },
  { codigo: '002', nombre: 'Sucursal Norte S.A.S.', nit: '900.555.777-1', estado: 'INACTIVA', registros: 3420, ultimoCierre: '2025-12-31' },
  { codigo: '003', nombre: 'Holding Pruebas S.A.S.', nit: '901.222.333-9', estado: 'INACTIVA', registros: 815, ultimoCierre: '2025-12-31' },
]

const VACIO: Compania = { codigo: '', nombre: '', nit: '', estado: 'INACTIVA', registros: 0, ultimoCierre: '' }

export function CompaniasPage() {
  usePageTitle('Compañías')
  const { state, toast, audit } = useStore()
  const [companias, setCompanias] = useState<Compania[]>(INICIALES)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; draft: Compania } | null>(null)

  const [traslado, setTraslado] = useState<Compania | null>(null)
  const [trasAnoOrigen, setTrasAnoOrigen] = useState('2025')
  const [trasAnoDestino, setTrasAnoDestino] = useState('2026')
  const [trasProgreso, setTrasProgreso] = useState(0)
  const [trasEjecutando, setTrasEjecutando] = useState(false)
  const timerRef = useRef<number | null>(null)

  const [limpiar, setLimpiar] = useState<Compania | null>(null)
  const [confirmLimpiar, setConfirmLimpiar] = useState(false)

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
  }, [])

  const guardar = () => {
    if (!modal) return
    const { modo, draft } = modal
    if (!draft.codigo.trim() || !draft.nombre.trim() || !draft.nit.trim()) {
      toast('error', 'Datos incompletos', 'Código, nombre y NIT son obligatorios.')
      return
    }
    if (modo === 'crear') {
      if (companias.some((c) => c.codigo === draft.codigo.trim())) {
        toast('error', 'Código duplicado', `Ya existe la compañía ${draft.codigo}.`)
        return
      }
      setCompanias((prev) => [{ ...draft, codigo: draft.codigo.trim() }, ...prev])
      toast('success', 'Compañía creada', `Se creó la compañía ${draft.codigo} — ${draft.nombre}.`)
      audit('Creación de compañía', 'Compañías', `Compañía ${draft.codigo} — ${draft.nombre} creada`)
    } else {
      setCompanias((prev) => prev.map((c) => (c.codigo === draft.codigo ? draft : c)))
      toast('success', 'Compañía actualizada', `La compañía ${draft.codigo} quedó actualizada.`)
      audit('Actualización de compañía', 'Compañías', `Compañía ${draft.codigo} — ${draft.nombre} modificada`)
    }
    setModal(null)
  }

  const ejecutarTraslado = () => {
    if (!traslado) return
    setTrasEjecutando(true)
    let pct = 0
    timerRef.current = window.setInterval(() => {
      pct += 25
      setTrasProgreso(Math.min(100, pct))
      if (pct >= 100) {
        if (timerRef.current) window.clearInterval(timerRef.current)
        setTrasEjecutando(false)
        toast('success', 'Traslado completado', `Compañía ${traslado.codigo} trasladada del año ${trasAnoOrigen} al ${trasAnoDestino}.`)
        audit('Traslado de compañía', 'Compañías', `Compañía ${traslado.codigo} · ${trasAnoOrigen} → ${trasAnoDestino}`)
        setTraslado(null)
        setTrasProgreso(0)
      }
    }, 400)
  }

  const ejecutarLimpieza = () => {
    if (!limpiar) return
    setCompanias((prev) => prev.map((c) => (c.codigo === limpiar.codigo ? { ...c, registros: 0 } : c)))
    toast('success', 'Compañía limpiada', `Se eliminaron los datos de la compañía ${limpiar.codigo}.`)
    audit('Limpieza de compañía', 'Compañías', `Compañía ${limpiar.codigo} — ${limpiar.nombre} limpiada (${limpiar.registros} registros)`)
    setConfirmLimpiar(false)
    setLimpiar(null)
  }

  const columns: GridColumn<Compania>[] = [
    { key: 'codigo', label: 'Código', width: 90, sortable: true, render: (c) => <span className="mono bold">{c.codigo}</span> },
    { key: 'nombre', label: 'Compañía', sortable: true, render: (c) => <b className="small">{c.nombre}</b> },
    { key: 'nit', label: 'NIT', width: 160, render: (c) => <span className="mono">{c.nit}</span> },
    {
      key: 'estado', label: 'Estado', width: 110, align: 'center',
      render: (c) => (c.estado === 'ACTIVA' ? <Badge tone="success">Activa</Badge> : <Badge tone="neutral">Inactiva</Badge>),
      searchValue: (c) => c.estado,
    },
    { key: 'registros', label: 'Registros', width: 120, align: 'right', sortable: true, render: (c) => <span className="tnum">{c.registros.toLocaleString('es-CO')}</span> },
    { key: 'ultimoCierre', label: 'Último cierre', width: 130, render: (c) => <span className="tnum small">{c.ultimoCierre || '—'}</span> },
    {
      key: 'acciones', label: 'Acciones', width: 260, align: 'center',
      render: (c) => (
        <div className="row gap-4" style={{ justifyContent: 'center' }}>
          <Button size="sm" variant="subtle" icon="calendario" onClick={() => setTraslado(c)}>Trasladar</Button>
          <Button size="sm" variant="subtle" danger icon="trash" onClick={() => { setLimpiar(c); setConfirmLimpiar(true) }}>Limpiar</Button>
        </div>
      ),
    },
  ]

  const simLimpieza = (c: Compania) => [
    { descripcion: 'Documentos contables', valor: Math.round(c.registros * 0.42) },
    { descripcion: 'Líneas de movimiento', valor: Math.round(c.registros * 0.9) },
    { descripcion: 'Acumulados por cuenta/tercero', valor: Math.round(c.registros * 0.35) },
    { descripcion: 'Terceros y datos maestros', valor: 0 },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Compañías"
        subtitle={`${companias.filter((c) => c.estado === 'ACTIVA').length} compañía activa · sesión en ${state.session.company.codigo} — ${state.session.company.nombre}`}
        icon="compania"
        actions={<Button variant="primary" icon="plus" onClick={() => setModal({ modo: 'crear', draft: { ...VACIO } })}>Crear</Button>}
      />

      <Card pad={false}>
        <AccountingDataGrid
          rows={companias}
          columns={columns}
          rowKey={(c) => c.codigo}
          selectable
          selected={sel}
          onSelect={setSel}
          searchText={busqueda}
          onSearchChange={setBusqueda}
          onRowDoubleClick={(c) => setModal({ modo: 'editar', draft: { ...c } })}
          height="calc(100vh - 320px)"
          toolbar={
            <Toolbar>
              <ToolbarGroup label="Acciones">
                <Button size="sm" icon="edit" disabled={sel.size !== 1} onClick={() => {
                  const c = companias.find((x) => x.codigo === [...sel][0])
                  if (c) setModal({ modo: 'editar', draft: { ...c } })
                }}>Modificar</Button>
                <Button size="sm" icon="calendario" disabled={sel.size !== 1} onClick={() => {
                  const c = companias.find((x) => x.codigo === [...sel][0])
                  if (c) setTraslado(c)
                }}>Trasladar</Button>
                <Button size="sm" icon="trash" danger disabled={sel.size !== 1} onClick={() => {
                  const c = companias.find((x) => x.codigo === [...sel][0])
                  if (c) { setLimpiar(c); setConfirmLimpiar(true) }
                }}>Limpiar compañía</Button>
              </ToolbarGroup>
            </Toolbar>
          }
        />
      </Card>

      {/* Crear/editar compañía */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nueva compañía' : `Compañía ${modal?.draft.codigo ?? ''}`}
        icon="compania"
        width={520}
        footer={
          <>
            <Button onClick={() => setModal(null)}>Cancelar</Button>
            <Button variant="primary" icon="save" onClick={guardar}>Guardar</Button>
          </>
        }
      >
        {modal && (
          <div className="stack gap-12">
            <div className="row gap-8">
              <Field label="Código" required width={110}>
                <Input value={modal.draft.codigo} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, codigo: v } })} placeholder="004" monospace disabled={modal.modo === 'editar'} />
              </Field>
              <Field label="Estado" width={140}>
                <Select value={modal.draft.estado} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, estado: v as Compania['estado'] } })} options={[{ value: 'ACTIVA', label: 'Activa' }, { value: 'INACTIVA', label: 'Inactiva' }]} />
              </Field>
            </div>
            <Field label="Nombre" required>
              <Input value={modal.draft.nombre} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nombre: v } })} placeholder="Nueva S.A.S." />
            </Field>
            <Field label="NIT" required>
              <Input value={modal.draft.nit} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nit: v } })} placeholder="900.123.456-7" monospace />
            </Field>
          </div>
        )}
      </Modal>

      {/* Trasladar compañía */}
      <Modal
        open={traslado !== null}
        onClose={() => { if (!trasEjecutando) setTraslado(null) }}
        title={`Trasladar compañía ${traslado?.codigo ?? ''}`}
        icon="calendario"
        width={480}
        footer={
          trasEjecutando ? undefined : (
            <>
              <Button onClick={() => setTraslado(null)}>Cancelar</Button>
              <Button variant="primary" icon="play" onClick={ejecutarTraslado} disabled={trasAnoOrigen === trasAnoDestino}>Ejecutar traslado</Button>
            </>
          )
        }
      >
        {traslado && (
          <div className="stack gap-12">
            {!trasEjecutando ? (
              <>
                <p className="modal-message">
                  Traslada saldos y acumulados de <b>{traslado.nombre}</b> ({traslado.registros.toLocaleString('es-CO')} registros) entre años.
                </p>
                <div className="row gap-8">
                  <Field label="Año origen" width={160}>
                    <Input value={trasAnoOrigen} onChange={setTrasAnoOrigen} monospace />
                  </Field>
                  <Field label="Año destino" width={160}>
                    <Input value={trasAnoDestino} onChange={setTrasAnoDestino} monospace />
                  </Field>
                </div>
              </>
            ) : (
              <div className="stack gap-8">
                <ProgressBar pct={trasProgreso} tone={trasProgreso >= 100 ? 'success' : 'brand'} label="Progreso del traslado" />
                <p className="small muted">Trasladando saldos del año {trasAnoOrigen} al {trasAnoDestino}… {trasProgreso}%</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Limpiar compañía */}
      <DangerConfirmation
        open={confirmLimpiar}
        onClose={() => setConfirmLimpiar(false)}
        onConfirm={() => ejecutarLimpieza()}
        title="Limpiar compañía"
        descripcion={`Se eliminarán TODOS los datos contables de la compañía ${limpiar?.codigo} — ${limpiar?.nombre}. Los datos maestros (plan de cuentas, centros, parámetros) se conservan.`}
        tablasAfectadas={['Documentos contables', 'Líneas de movimiento', 'Acumulados', 'Lotes', 'Bitácora de la compañía']}
        confirmText="LIMPIAR COMPAÑIA"
        simulacion={limpiar ? simLimpieza(limpiar) : []}
        confirmLabel="Limpiar"
      />
    </div>
  )
}
