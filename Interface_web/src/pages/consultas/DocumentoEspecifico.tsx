/* ============================================================
   CONTABDSI · Documento específico (búsqueda por documento
   propio o documento afectado)
   ============================================================ */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Field, Input, LoadingState, NoPermissionState, PageHeader } from '@/components/ui'
import { AccountingDataGrid, type GridColumn, type GridTotal } from '@/components/accounting/DataGrid'
import { ExportMenu, downloadCsv } from '@/components/accounting/Widgets'
import { AccountLabel, CentroLabel, TerceroLabel } from '@/components/accounting/Combobox'
import { useCan, useStore } from '@/state/AppStore'
import { fecha, money, sum } from '@/core/format'
import { movimientosConsolidados, useMountLoading, type MovLinea } from './Documentos'

export function DocumentoEspecificoPage() {
  const { state, audit } = useStore()
  const puede = useCan('consulta.ver')
  const navigate = useNavigate()
  const loading = useMountLoading(400)

  const [documento, setDocumento] = useState('')
  const [docAfectado, setDocAfectado] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const activo = documento.trim() !== '' || docAfectado.trim() !== ''

  const rows = useMemo<MovLinea[]>(() => {
    if (!activo) return []
    const doc = documento.trim().toLowerCase()
    const afect = docAfectado.trim().toLowerCase()
    return movimientosConsolidados(state).filter((m) => {
      const porPropio = doc !== '' && m.linea.documento.toLowerCase().includes(doc)
      const porAfectado = afect !== '' && m.linea.docAfectado.toLowerCase().includes(afect)
      if (doc !== '' && afect !== '') return porPropio || porAfectado
      return porPropio || porAfectado
    })
  }, [state, documento, docAfectado, activo])

  const abrirDocumento = (m: MovLinea) => {
    if (!m.docId) return
    audit('Abrir documento', 'Consultas', `Documento específico → ${m.docId}`, 'INFO')
    navigate(`/documentos/${m.docId}`)
  }

  const columns: GridColumn<MovLinea>[] = [
    { key: 'cuenta', label: 'Cuenta', width: 200, render: (r) => <span><b className="tnum">{r.linea.cuenta}</b> <span className="muted xs"><AccountLabel code={r.linea.cuenta} /></span></span>, searchValue: (r) => r.linea.cuenta },
    { key: 'nit', label: 'Tercero', minWidth: 170, render: (r) => (r.nit ? <span><b className="tnum">{r.nit}</b> <span className="muted xs"><TerceroLabel nit={r.nit} /></span></span> : <span className="muted">—</span>), searchValue: (r) => r.nit },
    { key: 'comprobante', label: 'Comp.', width: 62, render: (r) => <Badge tone="info">{r.linea.comprobante}</Badge> },
    { key: 'documento', label: 'Documento', width: 150, sortable: true },
    { key: 'docAfectado', label: 'Doc. afectado', width: 130, render: (r) => r.linea.docAfectado || <span className="muted">—</span>, searchValue: (r) => r.linea.docAfectado },
    { key: 'centro', label: 'Centro', width: 120, render: (r) => (r.linea.centro ? <span><b>{r.linea.centro}</b> <span className="muted xs"><CentroLabel code={r.linea.centro} /></span></span> : <span className="muted">—</span>), searchValue: (r) => r.linea.centro },
    { key: 'fecha', label: 'Fecha', width: 92, sortable: true, render: (r) => <span className="tnum">{fecha(r.linea.fecha)}</span> },
    { key: 'debito', label: 'Débito', money: true, align: 'right', width: 125, sortable: true },
    { key: 'credito', label: 'Crédito', money: true, align: 'right', width: 125, sortable: true },
    { key: 'base', label: 'Base', money: true, align: 'right', width: 115, render: (r) => (r.linea.base ? money(r.linea.base) : '—') },
    { key: 'concepto', label: 'Concepto', minWidth: 200, searchValue: (r) => r.linea.concepto },
    { key: 'origen', label: 'Origen', width: 100, render: (r) => <span className="xs muted">{r.linea.origen}</span> },
    {
      key: 'detalle',
      label: 'Ver documento',
      width: 100,
      align: 'center',
      sticky: 'right',
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" icon="eye" onClick={() => abrirDocumento(r)} disabled={!r.docId}>Ver</Button>
        </span>
      ),
    },
  ]

  const totalDeb = sum(rows.map((r) => r.linea.debito))
  const totalCre = sum(rows.map((r) => r.linea.credito))

  const totals: GridTotal[] = [
    { label: 'Totales', key: 'debito', value: money(totalDeb), money: true },
    { label: '', key: 'credito', value: money(totalCre), money: true },
  ]

  const exportarCsv = () => {
    downloadCsv(
      [
        ['Cuenta', 'NIT', 'Comprobante', 'Documento', 'Doc. afectado', 'Centro', 'Fecha', 'Débito', 'Crédito', 'Base', 'Concepto', 'Origen'],
        ...rows.map((r) => [r.linea.cuenta, r.nit, r.linea.comprobante, r.linea.documento, r.linea.docAfectado, r.linea.centro, fecha(r.linea.fecha), money(r.linea.debito), money(r.linea.credito), money(r.linea.base), r.linea.concepto, r.linea.origen]),
      ],
      'documento-especifico.csv',
    )
    audit('Exportación de consulta', 'Consultas', `CSV documento específico (${rows.length} líneas)`, 'EXITO')
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Documento específico" icon="doc" />
        <NoPermissionState perm="consulta.ver" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Documento específico"
        subtitle="Busque líneas por documento propio o por documento afectado"
        icon="doc"
        badge={activo ? <Badge tone="brand">{rows.length} líneas</Badge> : undefined}
        actions={
          <>
            <ExportMenu onExport={(fmt) => { if (fmt === 'CSV') exportarCsv() }} filename="documento-especifico" disabled={rows.length === 0} />
            <Button size="sm" icon="chevronL" onClick={() => navigate(-1)}>Volver</Button>
          </>
        }
      />

      <div className="querybar" role="search">
        <Field label="Documento propio" width={200}>
          <Input value={documento} onChange={(v) => setDocumento(v)} placeholder="p. ej. CE-2026-02" monospace ariaLabel="Documento propio" />
        </Field>
        <Field label="Documento afectado" width={200}>
          <Input value={docAfectado} onChange={(v) => setDocAfectado(v)} placeholder="p. ej. FV-1042" monospace ariaLabel="Documento afectado" />
        </Field>
        <Button size="sm" variant="ghost" icon="refresh" onClick={() => { setDocumento(''); setDocAfectado('') }}>Limpiar</Button>
        <span className="spacer" />
        <Button size="sm" variant="primary" icon="lupa" onClick={() => audit('Búsqueda', 'Consultas', `Documento específico: ${documento || '—'} / ${docAfectado || '—'}`, 'INFO')}>Buscar</Button>
      </div>

      {loading ? (
        <Card><LoadingState label="Preparando búsqueda de documento…" /></Card>
      ) : (
        <Card pad={false}>
          {!activo ? (
            <EmptyState icon="lupa" title="Indique un documento a buscar" detail="Escriba el documento propio o el documento afectado (o ambos) y pulse Buscar para listar las líneas que coincidan." />
          ) : (
            <AccountingDataGrid
              rows={rows}
              columns={columns}
              rowKey={(r) => r.linea.id}
              onRowClick={(r) => abrirDocumento(r)}
              onRowDoubleClick={(r) => abrirDocumento(r)}
              searchText={busqueda}
              onSearchChange={setBusqueda}
              totals={totals}
              selectable={false}
              height={480}
              empty={<EmptyState icon="lupa" title="Sin coincidencias" detail="Ninguna línea coincide con el documento o documento afectado indicado." />}
            />
          )}
        </Card>
      )}

      <p className="muted xs">Clic en una fila abre el documento oficial al que pertenece la línea.</p>
    </div>
  )
}
