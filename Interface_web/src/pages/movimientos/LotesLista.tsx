/* ============================================================
   CONTABDSI · Lotes — lista y acciones masivas
   ============================================================ */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge, Button, Card, ConfirmModal, Field, Icon, Input, LoadingState, Modal, NoPermissionState, PageHeader, ProgressBar, Segmented, Select,
} from '@/components/ui'
import { AccountingDataGrid, StatusBadge, type GridColumn } from '@/components/accounting/DataGrid'
import { downloadCsv, usePageTitle } from '@/components/accounting/Widgets'
import { useCan, useContabilizar, useStore, validarLote } from '@/state/AppStore'
import { USERS } from '@/data/mock'
import { fecha, money, nombreMes, sum } from '@/core/format'
import { LOTE_ESTADOS } from '@/core/types'
import type { Lote } from '@/core/types'

const MESES = Array.from({ length: 12 }, (_, i) => ({
  value: `2026${String(i + 1).padStart(2, '0')}`,
  label: `${nombreMes(i + 1)} 2026`,
}))

type Filtro = 'TODOS' | 'CON_ERRORES' | 'PENDIENTES' | 'APROBADO' | 'CONTABILIZADO' | 'ANULADO'

const periodoLabel = (p: string) => {
  const mes = Number(p.slice(4, 6))
  const anio = p.slice(0, 4)
  return `${nombreMes(mes).slice(0, 3)} ${anio}`
}

export function LotesListaPage() {
  usePageTitle('Lotes')
  const navigate = useNavigate()
  const { state, dispatch, toast, audit } = useStore()
  const puedeLotes = useCan('mov.lotes')
  const puedeAprobar = useCan('mov.lotes.aprobar')
  const puedeContabilizarPerm = useCan('mov.lotes.contabilizar')
  const { contabilizar, progreso } = useContabilizar()

  const [cargando, setCargando] = useState(true)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('TODOS')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [crearOpen, setCrearOpen] = useState(false)
  const [crearNombre, setCrearNombre] = useState('')
  const [crearPeriodo, setCrearPeriodo] = useState(`${state.session.year}${String(state.session.period).padStart(2, '0')}`)
  const [crearOrigen, setCrearOrigen] = useState('CAPTURA')
  const [reasigOpen, setReasigOpen] = useState(false)
  const [reasigUsuario, setReasigUsuario] = useState(USERS[0]?.nombre ?? '')
  const [eliminarOpen, setEliminarOpen] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setCargando(false), 400)
    return () => window.clearTimeout(t)
  }, [])

  const soloLectura = state.periodStatus === 'CERRADO' || Boolean(state.massiveLock)

  const rows = useMemo(
    () => state.lotes.filter((l) => {
      switch (filtro) {
        case 'CON_ERRORES': return l.estado === 'CON_ERRORES'
        case 'PENDIENTES': return l.estado === 'BORRADOR' || l.estado === 'VERIFICADO' || l.estado === 'PENDIENTE_APROBACION'
        case 'APROBADO': return l.estado === 'APROBADO'
        case 'CONTABILIZADO': return l.estado === 'CONTABILIZADO'
        case 'ANULADO': return l.estado === 'ANULADO'
        default: return true
      }
    }),
    [state.lotes, filtro],
  )

  if (!puedeLotes) {
    return (
      <div className="page">
        <NoPermissionState perm="mov.lotes" />
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="page">
        <PageHeader title="Lotes" icon="lote" />
        <Card>
          <LoadingState label="Cargando lotes…" />
        </Card>
      </div>
    )
  }

  const selLote = selected.size === 1 ? state.lotes.find((l) => selected.has(l.codigo)) : undefined

  const irA = (l: Lote) => navigate(`/movimientos/lotes/${l.codigo}`)

  const verificar = () => {
    if (!selLote) return
    const iss = validarLote(selLote, state.accounts, state.terceros, state.centros, state.documentos)
    const tiene = iss.some((i) => i.severidad === 'ERROR')
    dispatch({ type: 'VERIFICAR', codigo: selLote.codigo })
    if (tiene) {
      toast('error', 'Verificación fallida', `El lote ${selLote.codigo} aún tiene errores.`)
      audit('Verificación de lote', 'Lotes', `Lote ${selLote.codigo}: aún tiene errores`, 'FALLO')
    } else {
      toast('success', 'Lote verificado', `El lote ${selLote.codigo} quedó VERIFICADO.`)
      audit('Verificación de lote', 'Lotes', `Lote ${selLote.codigo} verificado`)
    }
  }

  const aprobar = () => {
    if (!selLote) return
    if (selLote.estado !== 'PENDIENTE_APROBACION') {
      toast('warning', 'No se puede aprobar', 'El lote debe estar en PENDIENTE_APROBACION.')
      return
    }
    dispatch({ type: 'APROBAR', codigo: selLote.codigo })
    toast('success', 'Lote aprobado', `El lote ${selLote.codigo} pasó a APROBADO.`)
    audit('Aprobación de lote', 'Lotes', `Lote ${selLote.codigo} aprobado`)
  }

  const contabilizarSel = () => {
    if (!selLote) return
    contabilizar(selLote.codigo)
  }

  const eliminarBorrador = () => {
    if (!selLote || selLote.estado !== 'BORRADOR') return
    dispatch({ type: 'DELETE_LOTE', codigo: selLote.codigo })
    setEliminarOpen(false)
    setSelected(new Set())
    toast('success', 'Borrador eliminado', `El lote ${selLote.codigo} fue eliminado.`)
    audit('Eliminación de lote', 'Lotes', `Lote ${selLote.codigo} (borrador) eliminado`)
  }

  const reasignar = () => {
    if (!selLote) return
    dispatch({ type: 'REASIGNAR_LOTE', codigo: selLote.codigo, usuario: reasigUsuario })
    setReasigOpen(false)
    toast('success', 'Lote reasignado', `Lote ${selLote.codigo} asignado a ${reasigUsuario}.`)
    audit('Reasignación de lote', 'Lotes', `Lote ${selLote.codigo} reasignado a ${reasigUsuario}`)
  }

  const crearLote = () => {
    const codigo = `L-${Date.now().toString(36).slice(-4).toUpperCase()}`
    const lote: Lote = {
      codigo,
      nombre: crearNombre.trim() || `Lote ${codigo}`,
      periodo: crearPeriodo,
      usuario: state.session.user.nombre,
      origen: crearOrigen,
      fecha: '2026-02-28',
      lineas: [],
      estado: 'BORRADOR',
      issues: [],
      audit: [],
    }
    dispatch({ type: 'ADD_LOTE', lote })
    audit('Creación de lote', 'Lotes', `Lote ${codigo} creado (${crearOrigen})`)
    setCrearOpen(false)
    setCrearNombre('')
    toast('success', 'Lote creado', `El lote ${codigo} quedó en BORRADOR.`)
    navigate(`/movimientos/lotes/${codigo}`)
  }

  const exportarXlsx = () => {
    const filas: (string | number)[][] = [
      ['Código', 'Nombre', 'Período', 'Usuario', 'Origen', 'Fecha', 'Líneas', 'Débito', 'Crédito', 'Diferencia', 'Errores', 'Estado'],
      ...rows.map((l) => {
        const d = sum(l.lineas.map((x) => x.debito))
        const c = sum(l.lineas.map((x) => x.credito))
        return [
          l.codigo, l.nombre, l.periodo, l.usuario, l.origen, l.fecha, l.lineas.length,
          d, c, Math.round((d - c) * 100) / 100,
          l.issues.filter((i) => i.severidad === 'ERROR').length, LOTE_ESTADOS[l.estado],
        ]
      }),
    ]
    downloadCsv(filas, 'lotes.csv')
    audit('Exportación de lotes', 'Lotes', `XLSX con ${rows.length} lotes`)
    toast('success', 'Exportando XLSX', 'El archivo «lotes.csv» se generó correctamente.')
  }

  const imprimir = () => {
    toast('info', 'Impresión', 'El listado de lotes se envió a la impresora (simulado).')
  }

  const columnas: GridColumn<Lote>[] = [
    { key: 'codigo', label: 'Código', sortable: true, minWidth: 90, render: (l) => <b className="tnum">{l.codigo}</b>, searchValue: (l) => l.codigo },
    { key: 'nombre', label: 'Nombre', sortable: true, minWidth: 170 },
    { key: 'periodo', label: 'Período', sortable: true, minWidth: 90, render: (l) => <span className="tnum">{periodoLabel(l.periodo)}</span>, searchValue: (l) => l.periodo },
    { key: 'usuario', label: 'Usuario', minWidth: 120 },
    { key: 'origen', label: 'Origen', minWidth: 110 },
    { key: 'fecha', label: 'Fecha', sortable: true, minWidth: 90, render: (l) => <span className="tnum">{fecha(l.fecha)}</span> },
    { key: 'lineas', label: 'Líneas', align: 'right', minWidth: 70, render: (l) => <span className="tnum">{l.lineas.length}</span>, searchValue: (l) => String(l.lineas.length) },
    { key: 'debito', label: 'Débito', money: true, align: 'right', sortable: true, minWidth: 130, render: (l) => <span className="money">{money(sum(l.lineas.map((x) => x.debito)))}</span> },
    { key: 'credito', label: 'Crédito', money: true, align: 'right', sortable: true, minWidth: 130, render: (l) => <span className="money">{money(sum(l.lineas.map((x) => x.credito)))}</span> },
    {
      key: 'diferencia', label: 'Diferencia', align: 'right', minWidth: 130,
      render: (l) => {
        const d = Math.round((sum(l.lineas.map((x) => x.debito)) - sum(l.lineas.map((x) => x.credito))) * 100) / 100
        return <span className={`money ${Math.abs(d) > 0.004 ? 'neg' : ''}`}>{money(d)}</span>
      },
    },
    {
      key: 'errores', label: 'Errores', align: 'center', minWidth: 80,
      render: (l) => {
        const n = l.issues.filter((i) => i.severidad === 'ERROR').length
        return n > 0 ? <Badge tone="danger">{n}</Badge> : <span className="muted">—</span>
      },
    },
    { key: 'estado', label: 'Estado', minWidth: 150, render: (l) => <StatusBadge estado={l.estado} />, searchValue: (l) => LOTE_ESTADOS[l.estado] },
  ]

  const debTotal = sum(rows.flatMap((l) => l.lineas.map((x) => x.debito)))
  const creTotal = sum(rows.flatMap((l) => l.lineas.map((x) => x.credito)))
  const totals = [
    { label: `${rows.length} lotes`, key: 'debito', value: money(debTotal), money: true },
    { label: 'Total crédito', key: 'credito', value: money(creTotal), money: true },
  ]

  const getRowTone = (l: Lote): 'danger' | 'warning' | 'info' | undefined => {
    if (l.issues.some((i) => i.severidad === 'ERROR')) return 'danger'
    if (l.estado === 'PENDIENTE_APROBACION') return 'warning'
    if (l.estado === 'CONTABILIZADO') return 'info'
    return undefined
  }

  return (
    <div className="page">
      <PageHeader title="Lotes" subtitle={`${state.lotes.length} lotes en la compañía · ${state.session.periodName} ${state.session.year}`} icon="lote" />

      {soloLectura && (
        <div className="local-banner local-banner-warning" role="alert">
          <Icon name="lock" size={15} />
          <span>
            {state.massiveLock ? (
              <>Proceso masivo en curso: <b>{state.massiveLock.proceso}</b>. Las acciones sobre lotes están bloqueadas.</>
            ) : (
              <>El período está <b>cerrado</b>. Las acciones sobre lotes están deshabilitadas.</>
            )}
          </span>
        </div>
      )}

      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        <Segmented<Filtro>
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: 'TODOS', label: 'Todos' },
            { value: 'CON_ERRORES', label: 'Con errores' },
            { value: 'PENDIENTES', label: 'Pendientes' },
            { value: 'APROBADO', label: 'Aprobados' },
            { value: 'CONTABILIZADO', label: 'Contabilizados' },
            { value: 'ANULADO', label: 'Anulados' },
          ]}
        />
        <span className="spacer" />
        <Button size="sm" icon="plus" onClick={() => setCrearOpen(true)} disabled={soloLectura}>Crear lote</Button>
        <Button size="sm" icon="shield" onClick={verificar} disabled={!selLote || soloLectura} title="Verificar el lote seleccionado">Verificar</Button>
        {puedeAprobar && (
          <Button size="sm" icon="check" onClick={aprobar} disabled={!selLote || selLote.estado !== 'PENDIENTE_APROBACION' || soloLectura} title="Aprobar el lote seleccionado">Aprobar</Button>
        )}
        {puedeContabilizarPerm && (
          <Button size="sm" variant="primary" icon="play" onClick={contabilizarSel} disabled={!selLote || selLote.estado !== 'APROBADO' || soloLectura} title="Contabilizar el lote seleccionado">Contabilizar</Button>
        )}
        <Button size="sm" danger icon="trash" onClick={() => setEliminarOpen(true)} disabled={!selLote || selLote.estado !== 'BORRADOR'} title="Eliminar borrador (solo lotes en BORRADOR)">Eliminar borrador</Button>
        <Button size="sm" icon="user" onClick={() => setReasigOpen(true)} disabled={!selLote} title="Reasignar el lote a otro usuario">Reasignar</Button>
        <Button size="sm" icon="print" onClick={imprimir}>Imprimir</Button>
        <Button size="sm" icon="excel" onClick={exportarXlsx}>Exportar XLSX</Button>
      </div>

      <AccountingDataGrid
        rows={rows}
        columns={columnas}
        rowKey={(l) => l.codigo}
        selected={selected}
        onSelect={setSelected}
        onRowDoubleClick={irA}
        searchText={q}
        onSearchChange={setQ}
        searchable
        totals={totals}
        initialSort={{ key: 'codigo', dir: 'asc' }}
        getRowTone={getRowTone}
        height={520}
        toolbar={
          <Button size="sm" icon="eye" onClick={() => selLote && irA(selLote)} disabled={!selLote}>Ver detalle</Button>
        }
      />

      {/* Crear lote */}
      <Modal
        open={crearOpen}
        onClose={() => setCrearOpen(false)}
        title="Crear lote"
        icon="plus"
        width={440}
        footer={
          <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setCrearOpen(false)}>Cancelar</Button>
            <Button variant="primary" icon="plus" onClick={crearLote}>Crear lote</Button>
          </div>
        }
      >
        <div className="stack gap-12">
          <Field label="Nombre del lote" required>
            <Input value={crearNombre} onChange={setCrearNombre} placeholder="Ej. Nómina marzo" autoFocus />
          </Field>
          <Field label="Período">
            <Select value={crearPeriodo} onChange={setCrearPeriodo} options={MESES} ariaLabel="Período del lote" />
          </Field>
          <Field label="Origen">
            <Select
              value={crearOrigen}
              onChange={setCrearOrigen}
              options={[
                { value: 'CAPTURA', label: 'Captura directa' },
                { value: 'NÓMINA', label: 'Nómina' },
                { value: 'IMPORTACIÓN', label: 'Importación' },
                { value: 'REEMBOLSO', label: 'Reembolso' },
              ]}
              ariaLabel="Origen del lote"
            />
          </Field>
        </div>
      </Modal>

      {/* Reasignar */}
      <Modal
        open={reasigOpen}
        onClose={() => setReasigOpen(false)}
        title={`Reasignar lote ${selLote?.codigo ?? ''}`}
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

      {/* Eliminar borrador */}
      <ConfirmModal
        open={eliminarOpen}
        onClose={() => setEliminarOpen(false)}
        onConfirm={eliminarBorrador}
        danger
        title={`Eliminar borrador ${selLote?.codigo ?? ''}`}
        message="El lote se eliminará definitivamente del estado. Esta acción solo aplica a lotes en estado BORRADOR."
        confirmLabel="Eliminar"
      />

      {/* Progreso de contabilización */}
      <Modal open={progreso !== null} title="Contabilizando lote" icon="refresh" width={440}>
        <div className="stack gap-12">
          <ProgressBar pct={progreso?.pct ?? 0} label="Progreso de contabilización" />
          <p className="small muted">{progreso?.paso ?? 'Preparando…'}</p>
        </div>
      </Modal>
    </div>
  )
}
