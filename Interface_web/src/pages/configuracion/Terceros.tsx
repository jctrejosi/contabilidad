/* ============================================================
   CONTABDSI · Configuración → Terceros
   Tabla completa + informes + bloqueos + reasignación de NIT.
   ============================================================ */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmModal,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  Switch,
  Tabs,
  Textarea,
  Toolbar,
  ToolbarGroup,
} from '@/components/ui'
import { AccountingDataGrid, type GridColumn } from '@/components/accounting/DataGrid'
import {
  DangerConfirmation,
  MoneyInput,
  ProcessWizard,
  downloadCsv,
  usePageTitle,
} from '@/components/accounting/Widgets'
import { useStore } from '@/state/AppStore'
import { fecha, money, nitFmt } from '@/core/format'
import type { Tercero } from '@/core/types'

type Sexo = 'M' | 'F' | 'J' | ''

const VACIO: Tercero = {
  zona: 'Z1', nit: '', digito: '', tipoDoc: 'NIT', nombre: '', direccion: '', telefono: '', ciudad: 'BOGOTÁ',
  nitRelacionado: '', estado: 'ACTIVO', fechaCreacion: '2026-02-28', saldo: 0, cupo: 0, sexo: 'J',
  nacimiento: '', estadoWeb: 'ACTIVO', etiquetas: [],
}

const PASOS_NIT = [
  { key: 'nit', label: 'NIT actual / nuevo', icon: 'terceros' },
  { key: 'modulos', label: 'Módulos afectados', icon: 'link' },
  { key: 'simulacion', label: 'Simulación', icon: 'lupa' },
  { key: 'confirmacion', label: 'Respaldo y confirmación', icon: 'shield', danger: true },
  { key: 'progreso', label: 'Progreso', icon: 'clock' },
  { key: 'resultado', label: 'Resultado', icon: 'success' },
]

const MODULOS_NIT = ['Contabilidad', 'Facturación', 'Cartera', 'Inventario', 'Cuentas por pagar']

export function TercerosPage() {
  usePageTitle('Terceros')
  const { state, toast, audit } = useStore()
  const [terceros, setTerceros] = useState<Tercero[]>(() => state.terceros.map((t) => ({ ...t, etiquetas: [...t.etiquetas] })))
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState('tabla')
  const [informe, setInforme] = useState<'GENERAL' | 'CUMPLE' | 'PROFESIONES' | 'ETIQUETAS'>('GENERAL')

  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; draft: Tercero } | null>(null)
  const [eliminar, setEliminar] = useState<Tercero | null>(null)
  const [bloqueo, setBloqueo] = useState<{ tercero: Tercero; desbloquear: boolean } | null>(null)
  const [importar, setImportar] = useState(false)
  const [cupos, setCupos] = useState(false)
  const [cupoGeneral, setCupoGeneral] = useState(0)
  const [masivo, setMasivo] = useState<{ dias: number; saldoMin: number; afectados: Tercero[] } | null>(null)
  const [confirmMasivo, setConfirmMasivo] = useState(false)

  // Wizard de reasignación de NIT
  const [wizAbierto, setWizAbierto] = useState(false)
  const [wizPaso, setWizPaso] = useState('nit')
  const [nitActual, setNitActual] = useState('')
  const [nitNuevo, setNitNuevo] = useState('')
  const [modulosSel, setModulosSel] = useState<Set<string>>(new Set(MODULOS_NIT))
  const [progresoNit, setProgresoNit] = useState(0)
  const [confirmNit, setConfirmNit] = useState(false)
  const [resultadoNit, setResultadoNit] = useState<{ totales: number; duplicados: number; motivo: string } | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setCargando(false), 400)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
  }, [])

  const duplicadoNit = terceros.some((t) => t.nit === nitNuevo)
  const simulacionNit = useMemo(() => {
    const base = { contabilidad: state.documentos.reduce((a, d) => a + d.lineas.filter((l) => l.nit === nitActual).length, 0) + state.lotes.reduce((a, l) => a + l.lineas.filter((li) => li.nit === nitActual).length, 0) }
    return [
      { modulo: 'Contabilidad', registros: base.contabilidad, duplicados: duplicadoNit ? 2 : 0 },
      { modulo: 'Facturación', registros: 128, duplicados: duplicadoNit ? 5 : 0 },
      { modulo: 'Cartera', registros: 46, duplicados: 0 },
      { modulo: 'Inventario', registros: 12, duplicados: 0 },
      { modulo: 'Cuentas por pagar', registros: 23, duplicados: duplicadoNit ? 1 : 0 },
    ]
  }, [nitActual, duplicadoNit, state.documentos, state.lotes])

  const abrirWizard = () => {
    const t = terceros.find((x) => x.nit === [...sel][0])
    setNitActual(t?.nit ?? '')
    setNitNuevo('')
    setWizPaso('nit')
    setProgresoNit(0)
    setResultadoNit(null)
    setWizAbierto(true)
  }

  const ejecutarReasignacion = (motivo: string) => {
    setConfirmNit(false)
    setWizPaso('progreso')
    let pct = 0
    timerRef.current = window.setInterval(() => {
      pct += 20
      setProgresoNit(Math.min(100, pct))
      if (pct >= 100) {
        if (timerRef.current) window.clearInterval(timerRef.current)
        const totales = simulacionNit.reduce((a, s) => a + s.registros, 0)
        const duplicados = simulacionNit.reduce((a, s) => a + s.duplicados, 0)
        setTerceros((prev) => prev.map((t) => (t.nit === nitActual ? { ...t, nit: nitNuevo } : t)))
        setResultadoNit({ totales, duplicados, motivo })
        audit('Reasignación de NIT', 'Terceros', `NIT ${nitFmt(nitActual)} → ${nitFmt(nitNuevo)} · ${totales} registros en ${modulosSel.size} módulos · ${duplicados} duplicados detectados`)
        toast('success', 'NIT reasignado', `${totales} registros actualizados en los módulos seleccionados.`)
        setWizPaso('resultado')
      }
    }, 450)
  }

  const guardar = () => {
    if (!modal) return
    const { modo, draft } = modal
    if (!draft.nit.trim() || !draft.nombre.trim()) {
      toast('error', 'Datos incompletos', 'El NIT y el nombre del tercero son obligatorios.')
      return
    }
    if (modo === 'crear') {
      if (terceros.some((t) => t.nit === draft.nit.trim())) {
        toast('error', 'NIT duplicado', `Ya existe un tercero con el NIT ${draft.nit}.`)
        return
      }
      setTerceros((prev) => [{ ...draft, nit: draft.nit.trim() }, ...prev])
      toast('success', 'Tercero creado', `Se creó el tercero ${draft.nit} — ${draft.nombre}.`)
      audit('Creación de tercero', 'Terceros', `Tercero ${draft.nit} — ${draft.nombre} creado`)
    } else {
      setTerceros((prev) => prev.map((t) => (t.nit === draft.nit ? draft : t)))
      toast('success', 'Tercero actualizado', `El tercero ${draft.nit} quedó actualizado.`)
      audit('Actualización de tercero', 'Terceros', `Tercero ${draft.nit} — ${draft.nombre} modificado`)
    }
    setModal(null)
  }

  const confirmarEliminar = () => {
    if (!eliminar) return
    setTerceros((prev) => prev.filter((t) => t.nit !== eliminar.nit))
    toast('success', 'Tercero eliminado', `Se eliminó el tercero ${eliminar.nit}.`)
    audit('Eliminación de tercero', 'Terceros', `Tercero ${eliminar.nit} — ${eliminar.nombre} eliminado`)
    setEliminar(null)
  }

  const aplicarBloqueo = () => {
    if (!bloqueo) return
    const { tercero, desbloquear } = bloqueo
    setTerceros((prev) =>
      prev.map((t) =>
        t.nit === tercero.nit
          ? desbloquear
            ? { ...t, estado: 'ACTIVO', motivoBloqueo: undefined }
            : { ...t, estado: 'BLOQUEADO', motivoBloqueo: t.motivoBloqueo }
          : t,
      ),
    )
    toast('success', desbloquear ? 'Tercero desbloqueado' : 'Tercero bloqueado', `${tercero.nit} — ${tercero.nombre}.`)
    audit(desbloquear ? 'Desbloqueo de tercero' : 'Bloqueo de tercero', 'Terceros', `Tercero ${tercero.nit} · motivo: ${tercero.motivoBloqueo ?? 'sin motivo'}`)
    setBloqueo(null)
  }

  const aplicarCupos = () => {
    setTerceros((prev) => prev.map((t) => ({ ...t, cupo: cupoGeneral })))
    toast('success', 'Cupos actualizados', `Se asignó un cupo de ${money(cupoGeneral)} a ${terceros.length} terceros.`)
    audit('Edición masiva de cupos', 'Terceros', `Cupo ${money(cupoGeneral)} aplicado a ${terceros.length} terceros`)
    setCupos(false)
  }

  const simularImportacion = () => {
    const filas: Tercero[] = [
      { ...VACIO, nit: '800777111', digito: '4', nombre: 'CONSTRUCCIONES ANDINAS S.A.S.', direccion: 'Cll 45 # 12-34', telefono: '601 222 3344', ciudad: 'BOGOTÁ', etiquetas: ['PROVEEDOR'] },
      { ...VACIO, nit: '10223344', digito: '8', tipoDoc: 'CC', nombre: 'PÉREZ LÓPEZ ANA', direccion: 'Cra 9 # 8-77', telefono: '312 555 9900', ciudad: 'MEDELLÍN', sexo: 'F', nacimiento: '1990-06-30', etiquetas: [] },
    ]
    setTerceros((prev) => [...filas, ...prev])
    toast('success', 'Importación simulada', '2 filas de ejemplo importadas correctamente.')
    audit('Importación de terceros', 'Terceros', 'Archivo simulado procesado · 2 filas importadas')
    setImportar(false)
  }

  const confirmarMasivo = () => {
    if (!masivo) return
    setTerceros((prev) => prev.map((t) => (masivo.afectados.some((a) => a.nit === t.nit) ? { ...t, estado: 'BLOQUEADO' as const, motivoBloqueo: `Bloqueo masivo: mora > ${masivo.dias} días y saldo ≥ ${money(masivo.saldoMin)}` } : t)))
    toast('success', 'Bloqueo masivo aplicado', `${masivo.afectados.length} terceros bloqueados.`)
    audit('Bloqueo masivo de terceros', 'Terceros', `Días mora ${masivo.dias} · saldo mínimo ${money(masivo.saldoMin)} · ${masivo.afectados.length} afectados`)
    setConfirmMasivo(false)
    setMasivo(null)
  }

  const columns: GridColumn<Tercero>[] = [
    { key: 'zona', label: 'Zona', width: 70, sortable: true, render: (t) => <span className="mono">{t.zona}</span> },
    { key: 'nit', label: 'NIT', width: 130, sortable: true, sticky: 'left', render: (t) => <span className="mono bold">{nitFmt(t.nit)}</span> },
    { key: 'digito', label: 'DV', width: 50, align: 'center', render: (t) => <span className="tnum">{t.digito || '—'}</span> },
    { key: 'tipoDoc', label: 'Tipo doc.', width: 90, align: 'center', render: (t) => <span className="mono">{t.tipoDoc}</span> },
    { key: 'nombre', label: 'Nombre', minWidth: 220, sortable: true, render: (t) => <b className="small">{t.nombre}</b> },
    { key: 'direccion', label: 'Dirección', minWidth: 170, render: (t) => <span className="muted small">{t.direccion}</span> },
    { key: 'telefono', label: 'Teléfono', width: 130, render: (t) => <span className="tnum small">{t.telefono}</span> },
    { key: 'ciudad', label: 'Ciudad', width: 120, sortable: true, render: (t) => <span className="small">{t.ciudad}</span> },
    { key: 'nitRelacionado', label: 'NIT relacionado', width: 140, render: (t) => <span className="mono small">{t.nitRelacionado ? nitFmt(t.nitRelacionado) : '—'}</span> },
    {
      key: 'estado', label: 'Estado', width: 100, align: 'center',
      render: (t) => (t.estado === 'ACTIVO' ? <Badge tone="success">Activo</Badge> : <Badge tone="danger" icon="lock">Bloqueado</Badge>),
      searchValue: (t) => t.estado,
    },
    { key: 'motivoBloqueo', label: 'Motivo bloqueo', minWidth: 180, render: (t) => <span className="muted small">{t.motivoBloqueo ?? '—'}</span> },
    { key: 'fechaCreacion', label: 'Creación', width: 100, render: (t) => <span className="tnum small">{fecha(t.fechaCreacion)}</span> },
    { key: 'saldo', label: 'Saldo', width: 140, align: 'right', money: true, sortable: true, render: (t) => <span className="tnum">{money(t.saldo)}</span> },
    { key: 'cupo', label: 'Cupo', width: 140, align: 'right', money: true, render: (t) => <span className="tnum">{money(t.cupo)}</span> },
    { key: 'sexo', label: 'Sexo', width: 60, align: 'center', render: (t) => <span className="tnum">{t.sexo === 'M' ? 'M' : t.sexo === 'F' ? 'F' : t.sexo === 'J' ? 'J' : '—'}</span> },
    { key: 'nacimiento', label: 'Nacimiento', width: 110, render: (t) => <span className="tnum small">{t.nacimiento ? fecha(t.nacimiento) : '—'}</span> },
    { key: 'estadoWeb', label: 'Estado web', width: 100, align: 'center', render: (t) => (t.estadoWeb === 'ACTIVO' ? <Badge tone="info">Web activo</Badge> : <Badge tone="neutral">Web inactivo</Badge>) },
    {
      key: 'etiquetas', label: 'Etiquetas', minWidth: 170,
      render: (t) => <span>{t.etiquetas.map((e) => <span key={e} className="tag-chip">{e}</span>)}</span>,
      searchValue: (t) => t.etiquetas.join(' '),
    },
  ]

  const columnsInforme: GridColumn<Tercero>[] = [
    { key: 'nit', label: 'NIT', width: 130, render: (t) => <span className="mono">{nitFmt(t.nit)}</span> },
    { key: 'nombre', label: 'Nombre', render: (t) => <b className="small">{t.nombre}</b> },
    { key: 'ciudad', label: 'Ciudad', width: 120 },
    { key: 'saldo', label: 'Saldo', width: 140, align: 'right', money: true, render: (t) => <span className="tnum">{money(t.saldo)}</span> },
    { key: 'cupo', label: 'Cupo', width: 140, align: 'right', money: true, render: (t) => <span className="tnum">{money(t.cupo)}</span> },
    { key: 'estado', label: 'Estado', width: 100, align: 'center', render: (t) => (t.estado === 'ACTIVO' ? <Badge tone="success">Activo</Badge> : <Badge tone="danger">Bloqueado</Badge>) },
  ]

  const cumpleaneros = terceros.filter((t) => t.sexo !== 'J' && t.nacimiento)
  const etiquetasDerivadas = useMemo(() => {
    const map = new Map<string, Tercero[]>()
    terceros.forEach((t) => t.etiquetas.forEach((e) => {
      if (!map.has(e)) map.set(e, [])
      map.get(e)?.push(t)
    }))
    return [...map.entries()].map(([etiqueta, list]) => ({ etiqueta, conteo: list.length, terceros: list })).sort((a, b) => b.conteo - a.conteo)
  }, [terceros])

  if (cargando) {
    return (
      <div className="page">
        <PageHeader title="Terceros" icon="terceros" />
        <Card><div className="state"><span className="spinner" style={{ width: 26, height: 26 }} role="status" aria-label="Cargando" /><p className="state-detail">Cargando terceros…</p></div></Card>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Terceros"
        subtitle={`${terceros.length} terceros · compañía ${state.session.company.codigo}`}
        icon="terceros"
        actions={
          <>
            <Button icon="link" onClick={abrirWizard} disabled={sel.size !== 1}>Reasignar NIT</Button>
            <Button icon="upload" onClick={() => setImportar(true)}>Importar</Button>
            <Button icon="chip" onClick={() => setCupos(true)}>Cupos</Button>
            <Button
              icon="lock"
              onClick={() => {
                const afectados = terceros.filter((t) => t.estado === 'ACTIVO' && (t.saldo > 0 || t.etiquetas.includes('MORA')))
                setMasivo({ dias: 90, saldoMin: 1000000, afectados })
              }}
            >Bloqueo masivo</Button>
            <Button variant="primary" icon="plus" onClick={() => setModal({ modo: 'crear', draft: { ...VACIO, etiquetas: [] } })}>Crear</Button>
          </>
        }
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'tabla', label: 'Tabla de terceros', icon: 'list' },
          { key: 'informes', label: 'Informes', icon: 'informe' },
        ]}
      />

      {tab === 'tabla' && (
        <Card pad={false}>
          <AccountingDataGrid
            rows={terceros}
            columns={columns}
            rowKey={(t) => t.nit}
            selectable
            selected={sel}
            onSelect={setSel}
            searchText={busqueda}
            onSearchChange={setBusqueda}
            onRowDoubleClick={(t) => setModal({ modo: 'editar', draft: { ...t, etiquetas: [...t.etiquetas] } })}
            height="calc(100vh - 380px)"
            empty={<EmptyState icon="terceros" title="Sin terceros" detail="Cree un tercero o importe un archivo para comenzar." action={<Button icon="plus" onClick={() => setModal({ modo: 'crear', draft: { ...VACIO, etiquetas: [] } })}>Crear tercero</Button>} />}
            toolbar={
              <Toolbar>
                <ToolbarGroup label="Acciones">
                  <Button size="sm" icon="edit" disabled={sel.size !== 1} onClick={() => {
                    const t = terceros.find((x) => x.nit === [...sel][0])
                    if (t) setModal({ modo: 'editar', draft: { ...t, etiquetas: [...t.etiquetas] } })
                  }}>Modificar</Button>
                  <Button size="sm" icon="trash" danger disabled={sel.size === 0} onClick={() => {
                    const t = terceros.find((x) => x.nit === [...sel][0])
                    if (t) setEliminar(t)
                  }}>Eliminar</Button>
                  <Button size="sm" icon="lock" disabled={sel.size !== 1} onClick={() => {
                    const t = terceros.find((x) => x.nit === [...sel][0])
                    if (t) setBloqueo({ tercero: t, desbloquear: t.estado === 'BLOQUEADO' })
                  }}>{terceros.find((x) => x.nit === [...sel][0])?.estado === 'BLOQUEADO' ? 'Desbloquear' : 'Bloquear'}</Button>
                </ToolbarGroup>
                <ToolbarGroup label="Exportar">
                  <Button
                    size="sm"
                    icon="excel"
                    onClick={() =>
                      downloadCsv(
                        [['Zona', 'NIT', 'DV', 'Tipo', 'Nombre', 'Dirección', 'Teléfono', 'Ciudad', 'NIT rel.', 'Estado', 'Motivo', 'Creación', 'Saldo', 'Cupo', 'Sexo', 'Nacimiento', 'Web', 'Etiquetas'], ...terceros.map((t) => [t.zona, t.nit, t.digito, t.tipoDoc, t.nombre, t.direccion, t.telefono, t.ciudad, t.nitRelacionado, t.estado, t.motivoBloqueo ?? '', t.fechaCreacion, String(t.saldo), String(t.cupo), t.sexo, t.nacimiento, t.estadoWeb, t.etiquetas.join('|')])],
                        'terceros.csv',
                      )
                    }
                  >
                    Exportar XLSX
                  </Button>
                </ToolbarGroup>
              </Toolbar>
            }
          />
        </Card>
      )}

      {tab === 'informes' && (
        <Card
          title="Informes derivados de terceros"
          icon="informe"
          actions={
            <Select
              value={informe}
              onChange={(v) => setInforme(v as 'GENERAL' | 'CUMPLE' | 'PROFESIONES' | 'ETIQUETAS')}
              options={[
                { value: 'GENERAL', label: 'General' },
                { value: 'CUMPLE', label: 'Cumpleaños' },
                { value: 'PROFESIONES', label: 'Profesiones' },
                { value: 'ETIQUETAS', label: 'Etiquetas' },
              ]}
              width={180}
            />
          }
        >
          {informe === 'GENERAL' && (
            <AccountingDataGrid rows={terceros} columns={columnsInforme} rowKey={(t) => t.nit} selectable={false} height={420} />
          )}
          {informe === 'CUMPLE' && (
            cumpleaneros.length > 0 ? (
              <AccountingDataGrid
                rows={cumpleaneros}
                columns={[
                  { key: 'nit', label: 'NIT', width: 130, render: (t) => <span className="mono">{nitFmt(t.nit)}</span> },
                  { key: 'nombre', label: 'Nombre', render: (t) => <b className="small">{t.nombre}</b> },
                  { key: 'nacimiento', label: 'Nacimiento', width: 120, render: (t) => <span className="tnum small">{fecha(t.nacimiento)}</span> },
                  { key: 'ciudad', label: 'Ciudad', width: 120 },
                ]}
                rowKey={(t) => t.nit}
                selectable={false}
                height={380}
              />
            ) : (
              <EmptyState icon="calendario" title="Sin cumpleaños registrados" detail="Ningún tercero persona natural tiene fecha de nacimiento diligenciada." />
            )
          )}
          {informe === 'PROFESIONES' && (
            <EmptyState
              icon="info"
              title="Profesiones no disponibles en el prototipo"
              detail="El campo «profesión» no está modelado en el tipo Tercero de este prototipo. En la versión funcional se deriva del módulo compartido de terceros."
            />
          )}
          {informe === 'ETIQUETAS' && (
            etiquetasDerivadas.length > 0 ? (
              <div className="stack gap-8">
                {etiquetasDerivadas.map((e) => (
                  <div key={e.etiqueta} className="row gap-8" style={{ alignItems: 'center' }}>
                    <Badge tone="brand">{e.etiqueta}</Badge>
                    <span className="small bold">{e.conteo}</span>
                    <span className="muted small">{e.terceros.map((t) => t.nombre).join(', ')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="chip" title="Sin etiquetas" detail="Ningún tercero tiene etiquetas asignadas." />
            )
          )}
        </Card>
      )}

      {/* Modal crear/editar */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nuevo tercero' : `Tercero ${modal?.draft.nit ?? ''}`}
        icon="terceros"
        width={720}
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
              <Field label="Zona" width={90}>
                <Input value={modal.draft.zona} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, zona: v.toUpperCase() } })} placeholder="Z1" monospace />
              </Field>
              <Field label="NIT" required width={150}>
                <Input value={modal.draft.nit} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nit: v } })} placeholder="900111222" monospace disabled={modal.modo === 'editar'} />
              </Field>
              <Field label="Dígito" width={70}>
                <Input value={modal.draft.digito} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, digito: v } })} placeholder="3" monospace />
              </Field>
              <Field label="Tipo doc." width={110}>
                <Select value={modal.draft.tipoDoc} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, tipoDoc: v } })} options={[{ value: 'NIT', label: 'NIT' }, { value: 'CC', label: 'CC' }, { value: 'CE', label: 'CE' }, { value: 'PA', label: 'Pasaporte' }]} />
              </Field>
              <Field label="Sexo" width={80}>
                <Select value={modal.draft.sexo} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, sexo: v as Sexo } })} options={[{ value: 'J', label: 'J' }, { value: 'M', label: 'M' }, { value: 'F', label: 'F' }]} />
              </Field>
            </div>
            <Field label="Nombre / razón social" required>
              <Input value={modal.draft.nombre} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nombre: v } })} placeholder="CLIENTE LA MONTAÑA LTDA" />
            </Field>
            <div className="row gap-8">
              <Field label="Dirección" className="grow">
                <Input value={modal.draft.direccion} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, direccion: v } })} />
              </Field>
              <Field label="Teléfono" width={160}>
                <Input value={modal.draft.telefono} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, telefono: v } })} />
              </Field>
            </div>
            <div className="row gap-8">
              <Field label="Ciudad" width={180}>
                <Input value={modal.draft.ciudad} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, ciudad: v } })} />
              </Field>
              <Field label="NIT relacionado" width={160}>
                <Input value={modal.draft.nitRelacionado} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nitRelacionado: v } })} placeholder="NIT" monospace />
              </Field>
              <Field label="Fecha creación" width={150}>
                <Input type="date" value={modal.draft.fechaCreacion} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, fechaCreacion: v } })} />
              </Field>
              <Field label="Nacimiento" width={150}>
                <Input type="date" value={modal.draft.nacimiento} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nacimiento: v } })} />
              </Field>
            </div>
            <div className="row gap-8">
              <Field label="Saldo" width={160}>
                <MoneyInput value={modal.draft.saldo} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, saldo: v } })} width={150} />
              </Field>
              <Field label="Cupo" width={160}>
                <MoneyInput value={modal.draft.cupo} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, cupo: v } })} width={150} />
              </Field>
              <Field label="Etiquetas" className="grow" hint="Separadas por coma.">
                <Input value={modal.draft.etiquetas.join(', ')} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, etiquetas: v.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean) } })} placeholder="CLIENTE, VIP" />
              </Field>
            </div>
            <div className="row gap-16">
              <Field label="Estado" width={160}>
                <Select value={modal.draft.estado} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, estado: v as Tercero['estado'] } })} options={[{ value: 'ACTIVO', label: 'Activo' }, { value: 'BLOQUEADO', label: 'Bloqueado' }]} />
              </Field>
              {modal.draft.estado === 'BLOQUEADO' && (
                <Field label="Motivo de bloqueo" className="grow">
                  <Input value={modal.draft.motivoBloqueo ?? ''} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, motivoBloqueo: v } })} placeholder="Motivo…" />
                </Field>
              )}
            </div>
            <Switch checked={modal.draft.estadoWeb === 'ACTIVO'} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, estadoWeb: v ? 'ACTIVO' : 'INACTIVO' } })} label="Estado web activo" />
          </div>
        )}
      </Modal>

      {/* Bloquear / desbloquear */}
      <Modal
        open={bloqueo !== null}
        onClose={() => setBloqueo(null)}
        title={bloqueo?.desbloquear ? 'Desbloquear tercero' : 'Bloquear tercero'}
        icon={bloqueo?.desbloquear ? 'unlock' : 'lock'}
        width={480}
        tone={bloqueo?.desbloquear ? undefined : 'danger'}
        footer={
          <>
            <Button onClick={() => setBloqueo(null)}>Cancelar</Button>
            <Button variant={bloqueo?.desbloquear ? 'primary' : 'danger'} icon="check" onClick={aplicarBloqueo} disabled={!bloqueo?.desbloquear && !(bloqueo?.tercero.motivoBloqueo ?? '').trim()}>
              {bloqueo?.desbloquear ? 'Desbloquear' : 'Bloquear'}
            </Button>
          </>
        }
      >
        {bloqueo && (
          <div className="stack gap-12">
            <p className="modal-message">
              {bloqueo.desbloquear
                ? `¿Desea desbloquear el tercero ${bloqueo.tercero.nit} — ${bloqueo.tercero.nombre}? Volverá a estar disponible en la captura.`
                : `El tercero ${bloqueo.tercero.nit} — ${bloqueo.tercero.nombre} quedará bloqueado y no podrá usarse en nuevos documentos.`}
            </p>
            {!bloqueo.desbloquear && (
              <Field label="Motivo del bloqueo" required>
                <Textarea
                  value={bloqueo.tercero.motivoBloqueo ?? ''}
                  onChange={(v) => setBloqueo({ ...bloqueo, tercero: { ...bloqueo.tercero, motivoBloqueo: v } })}
                  rows={2}
                  placeholder="Ej. Saldo vencido mayor a 90 días…"
                />
              </Field>
            )}
          </div>
        )}
      </Modal>

      {/* Importar */}
      <Modal
        open={importar}
        onClose={() => setImportar(false)}
        title="Importar terceros"
        icon="upload"
        width={560}
        footer={
          <>
            <Button onClick={() => setImportar(false)}>Cancelar</Button>
            <Button variant="primary" icon="upload" onClick={simularImportacion}>Importar archivo</Button>
          </>
        }
      >
        <div className="stack gap-12">
          <Field label="Archivo (CSV / XLSX)" hint="Simulación: solo se lee el nombre del archivo.">
            <input
              type="file"
              className="input"
              style={{ padding: 6 }}
              onChange={(e) => {
                const name = e.target.files?.[0]?.name
                if (name) toast('info', 'Archivo seleccionado', `Se leerá «${name}» al importar.`)
              }}
            />
          </Field>
          <p className="small bold">Filas de ejemplo que se importarán</p>
          <table className="sim-table">
            <thead><tr><th>NIT</th><th>Nombre</th><th>Ciudad</th><th>Saldo</th></tr></thead>
            <tbody>
              <tr><td className="mono">800.777.111</td><td>CONSTRUCCIONES ANDINAS S.A.S.</td><td>BOGOTÁ</td><td className="money">$0</td></tr>
              <tr><td className="mono">10.223.344</td><td>PÉREZ LÓPEZ ANA</td><td>MEDELLÍN</td><td className="money">$0</td></tr>
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Cupos masivos */}
      <Modal
        open={cupos}
        onClose={() => setCupos(false)}
        title="Edición masiva de cupos"
        icon="chip"
        width={520}
        footer={
          <>
            <Button onClick={() => setCupos(false)}>Cancelar</Button>
            <Button variant="primary" icon="save" onClick={aplicarCupos}>Aplicar a todos</Button>
          </>
        }
      >
        <div className="stack gap-12">
          <Field label="Cupo general (COP)" hint="Se asignará el mismo cupo a todos los terceros.">
            <MoneyInput value={cupoGeneral} onChange={setCupoGeneral} width={220} />
          </Field>
          <p className="small muted">{terceros.length} terceros recibirán el cupo de {money(cupoGeneral)}.</p>
        </div>
      </Modal>

      {/* Bloqueo masivo: parámetros + simulación */}
      <Modal
        open={masivo !== null}
        onClose={() => setMasivo(null)}
        title="Bloqueo masivo por mora / saldo"
        icon="lock"
        width={600}
        tone="danger"
        footer={
          <>
            <Button onClick={() => setMasivo(null)}>Cancelar</Button>
            <Button variant="danger" icon="lock" onClick={() => setConfirmMasivo(true)}>Continuar</Button>
          </>
        }
      >
        {masivo && (
          <div className="stack gap-12">
            <div className="row gap-8">
              <Field label="Días de mora" required width={150}>
                <Input type="number" value={masivo.dias} onChange={(v) => setMasivo({ ...masivo, dias: Number(v) || 0 })} />
              </Field>
              <Field label="Saldo mínimo (COP)" width={200}>
                <MoneyInput value={masivo.saldoMin} onChange={(v) => setMasivo({ ...masivo, saldoMin: v })} width={180} />
              </Field>
            </div>
            <p className="small bold">Simulación de terceros afectados ({masivo.afectados.length})</p>
            <table className="sim-table">
              <thead><tr><th>NIT</th><th>Nombre</th><th className="money">Saldo</th><th>Estado</th></tr></thead>
              <tbody>
                {masivo.afectados.map((t) => (
                  <tr key={t.nit}>
                    <td className="mono">{nitFmt(t.nit)}</td>
                    <td>{t.nombre}</td>
                    <td className="money">{money(t.saldo)}</td>
                    <td>{t.estado === 'BLOQUEADO' ? <Badge tone="danger">Ya bloqueado</Badge> : <Badge tone="warning">Se bloqueará</Badge>}</td>
                  </tr>
                ))}
                {masivo.afectados.length === 0 && <tr><td colSpan={4} className="muted center" style={{ padding: 12 }}>Ningún tercero cumple los criterios.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <DangerConfirmation
        open={confirmMasivo}
        onClose={() => setConfirmMasivo(false)}
        onConfirm={() => confirmarMasivo()}
        title="Bloqueo masivo de terceros"
        descripcion={`Se bloquearán ${masivo?.afectados.length ?? 0} terceros por mora mayor a ${masivo?.dias ?? 0} días y saldo ≥ ${money(masivo?.saldoMin ?? 0)}. Los terceros bloqueados no podrán usarse en captura.`}
        tablasAfectadas={['Terceros', 'Lotes pendientes', 'Cartera']}
        confirmText="BLOQUEO MASIVO"
        simulacion={(masivo?.afectados ?? []).map((t) => ({ descripcion: `${t.nit} — ${t.nombre}`, valor: money(t.saldo) }))}
        confirmLabel="Bloquear"
      />

      {/* Eliminar */}
      <ConfirmModal
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar tercero"
        danger
        message={`¿Desea eliminar el tercero ${eliminar?.nit} — ${eliminar?.nombre}? Los documentos contabilizados conservan su NIT.`}
        confirmLabel="Eliminar"
      />

      {/* Wizard de reasignación de NIT */}
      <Modal
        open={wizAbierto}
        onClose={() => setWizAbierto(false)}
        title="Asistente de reasignación de NIT"
        icon="link"
        width={860}
        footer={
          wizPaso === 'resultado' ? (
            <Button variant="primary" onClick={() => setWizAbierto(false)}>Cerrar</Button>
          ) : (
            <span className="muted xs grow">
              Este proceso afecta además los módulos de facturación, cartera, inventario y cuentas por pagar de las compañías seleccionadas.
            </span>
          )
        }
      >
        <ProcessWizard steps={PASOS_NIT} active={wizPaso} onSelect={(k) => {
          const idx = PASOS_NIT.findIndex((s) => s.key === k)
          const cur = PASOS_NIT.findIndex((s) => s.key === wizPaso)
          if (idx < cur && wizPaso !== 'resultado') setWizPaso(k)
        }}>
          {wizPaso === 'nit' && (
            <div className="stack gap-12">
              <p className="modal-message">Indique el NIT actual del tercero y el NIT nuevo que lo reemplazará en todos los módulos.</p>
              <div className="row gap-8">
                <Field label="NIT actual" required width={220}>
                  <Input value={nitActual} onChange={setNitActual} placeholder="900111222" monospace />
                </Field>
                <Field label="NIT nuevo" required width={220}>
                  <Input value={nitNuevo} onChange={setNitNuevo} placeholder="901999888" monospace />
                </Field>
              </div>
              {duplicadoNit && (
                <div className="note-strip">
                  <Badge tone="danger" icon="warn">Duplicado detectado</Badge>
                  El NIT {nitFmt(nitNuevo)} ya existe como tercero: la simulación mostrará los registros que entrarían en conflicto.
                </div>
              )}
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button variant="primary" iconRight="chevronR" disabled={!nitActual.trim() || !nitNuevo.trim()} onClick={() => setWizPaso('modulos')}>Continuar</Button>
              </div>
            </div>
          )}

          {wizPaso === 'modulos' && (
            <div className="stack gap-12">
              <p className="modal-message">
                Seleccione las compañías y módulos que se verán afectados. La reasignación se propaga a <b>contabilidad, facturación, cartera, inventario y cuentas por pagar</b>.
              </p>
              <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
                <Badge tone="brand">Compañía 001 — Compañía Demo S.A.S.</Badge>
                <Badge tone="neutral">Compañía 002 — Sucursal Norte</Badge>
                <Badge tone="neutral">Compañía 003 — Holding Pruebas</Badge>
              </div>
              <div className="stack gap-4">
                {MODULOS_NIT.map((m) => (
                  <Checkbox key={m} checked={modulosSel.has(m)} onChange={(v) => {
                    const next = new Set(modulosSel)
                    if (v) next.add(m)
                    else next.delete(m)
                    setModulosSel(next)
                  }} label={m} />
                ))}
              </div>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button iconRight="chevronR" variant="primary" disabled={modulosSel.size === 0} onClick={() => setWizPaso('simulacion')}>Continuar</Button>
              </div>
            </div>
          )}

          {wizPaso === 'simulacion' && (
            <div className="stack gap-12">
              <p className="modal-message">Simulación de registros que se actualizarán con el nuevo NIT, por módulo:</p>
              <table className="sim-table">
                <thead><tr><th>Módulo</th><th className="right">Registros</th><th className="right">Duplicados detectados</th></tr></thead>
                <tbody>
                  {simulacionNit.map((s) => (
                    <tr key={s.modulo}>
                      <td>{s.modulo}</td>
                      <td className="right tnum">{s.registros.toLocaleString('es-CO')}</td>
                      <td className="right tnum">{s.duplicados > 0 ? <Badge tone="danger">{s.duplicados}</Badge> : <Badge tone="success">0</Badge>}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="bold">Totales</td>
                    <td className="right tnum bold">{simulacionNit.reduce((a, s) => a + s.registros, 0).toLocaleString('es-CO')}</td>
                    <td className="right tnum bold">{simulacionNit.reduce((a, s) => a + s.duplicados, 0)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button iconRight="chevronR" variant="primary" onClick={() => setWizPaso('confirmacion')}>Continuar</Button>
              </div>
            </div>
          )}

          {wizPaso === 'confirmacion' && (
            <div className="stack gap-12">
              <p className="modal-message">Verifique el respaldo y confirme la operación con el texto exacto. Se genera un respaldo automático antes de reasignar.</p>
              <Button variant="danger" icon="shield" onClick={() => setConfirmNit(true)}>Abrir confirmación reforzada</Button>
            </div>
          )}

          {wizPaso === 'progreso' && (
            <div className="stack gap-12">
              <ProgressBar pct={progresoNit} tone={progresoNit >= 100 ? 'success' : 'brand'} label="Progreso de reasignación" />
              <p className="small muted">Actualizando registros en {modulosSel.size} módulos seleccionados… {progresoNit}%</p>
            </div>
          )}

          {wizPaso === 'resultado' && resultadoNit && (
            <div className="stack gap-12">
              <div className="state state-success" style={{ padding: 16 }}>
                <div className="state-icon"><Badge tone="success" icon="check">Éxito</Badge></div>
                <h4 className="state-title">NIT reasignado correctamente</h4>
                <p className="state-detail">
                  {resultadoNit.totales.toLocaleString('es-CO')} registros actualizados de {nitFmt(nitActual)} a {nitFmt(nitNuevo)} en {modulosSel.size} módulos.
                  {resultadoNit.duplicados > 0 ? ` ${resultadoNit.duplicados} duplicado(s) fueron reportados para revisión manual.` : ' Sin duplicados detectados.'}
                </p>
              </div>
              <div className="infostrip">
                <div className="infostrip-item"><span className="xs muted">Motivo registrado</span><span className="small bold">{resultadoNit.motivo}</span></div>
                <div className="infostrip-item"><span className="xs muted">Auditoría</span><span className="small bold">Evento registrado en bitácora</span></div>
              </div>
            </div>
          )}
        </ProcessWizard>
      </Modal>

      <DangerConfirmation
        open={confirmNit}
        onClose={() => setConfirmNit(false)}
        onConfirm={(motivo) => ejecutarReasignacion(motivo)}
        title="Reasignación de NIT"
        descripcion={`Se reasignará el NIT ${nitFmt(nitActual)} → ${nitFmt(nitNuevo)} en contabilidad, facturación, cartera, inventario y cuentas por pagar.`}
        tablasAfectadas={['Terceros', 'Documentos contables', 'Cartera', 'Facturación', 'Inventario', 'Cuentas por pagar']}
        confirmText="REASIGNAR NIT"
        simulacion={simulacionNit.map((s) => ({ descripcion: `${s.modulo} — registros`, valor: s.registros }))}
        confirmLabel="Reasignar"
      />
    </div>
  )
}
