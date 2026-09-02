/* ============================================================
   CONTABDSI · Movimiento mensual (consulta)
   Importa los estilos propios del área (pages.css)
   ============================================================ */

import './pages.css'

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Field, Input, LoadingState, NoPermissionState, PageHeader, Select } from '@/components/ui'
import { AccountingDataGrid, DebitCreditSummary, type GridColumn, type GridTotal } from '@/components/accounting/DataGrid'
import { ExportMenu, downloadCsv } from '@/components/accounting/Widgets'
import { AccountLabel, AccountPicker, CentroLabel, CostCenterPicker, TerceroLabel, ThirdPartyPicker, VoucherPicker } from '@/components/accounting/Combobox'
import { useCan, useStore } from '@/state/AppStore'
import { fecha, money, sum } from '@/core/format'
import { movimientosConsolidados, useMountLoading, type MovLinea } from './Documentos'

interface Filtros {
  periodo: string
  cuenta: string
  nit: string
  comprobante: string
  documento: string
  centro: string
  fecha: string
}

function claseBadge(clase: string) {
  if (clase === 'IVA') return <Badge tone="brand" icon="iva">IVA</Badge>
  if (clase === 'RETENCION') return <Badge tone="warning" icon="retencion">RET</Badge>
  if (clase === 'OTRO') return <span className="muted xs">OTRO</span>
  return <span className="muted xs">—</span>
}

export function MovimientoMensualPage() {
  const { state, audit, toast } = useStore()
  const puede = useCan('consulta.ver')
  const navigate = useNavigate()
  const loading = useMountLoading(400)
  const [sp] = useSearchParams()

  const [f, setF] = useState<Filtros>(() => ({
    periodo: sp.get('periodo') ?? String(state.session.period).padStart(2, '0'),
    cuenta: sp.get('cuenta') ?? '',
    nit: sp.get('nit') ?? '',
    comprobante: sp.get('comprobante') ?? '',
    documento: sp.get('documento') ?? '',
    centro: sp.get('centro') ?? '',
    fecha: sp.get('fecha') ?? '',
  }))

  const set = (patch: Partial<Filtros>) => setF((prev) => ({ ...prev, ...patch }))

  const rows = useMemo<MovLinea[]>(() => {
    const prefijo = `2026-${f.periodo}`
    return movimientosConsolidados(state)
      .filter((m) => m.linea.fecha.startsWith(prefijo))
      .filter((m) => !f.cuenta || m.linea.cuenta === f.cuenta)
      .filter((m) => !f.nit || m.linea.nit === f.nit)
      .filter((m) => !f.comprobante || m.linea.comprobante === f.comprobante)
      .filter((m) => !f.documento || m.linea.documento.toLowerCase().includes(f.documento.toLowerCase()))
      .filter((m) => !f.centro || m.linea.centro === f.centro)
      .filter((m) => !f.fecha || m.linea.fecha === f.fecha)
  }, [state, f])

  const abrirOrigen = (m: MovLinea) => {
    if (m.docId) {
      audit('Abrir documento', 'Consultas', `Línea ${m.linea.id} → ${m.docId}`, 'INFO')
      navigate(`/documentos/${m.docId}`)
    } else {
      toast('info', 'Sin documento oficial', 'Este movimiento proviene de un lote contabilizado sin documento asociado.')
    }
  }

  const columns: GridColumn<MovLinea>[] = [
    { key: 'cuenta', label: 'Cuenta', width: 200, sticky: 'left', render: (r) => <span><b className="tnum">{r.linea.cuenta}</b> <span className="muted xs"><AccountLabel code={r.linea.cuenta} /></span></span>, searchValue: (r) => r.linea.cuenta },
    { key: 'nit', label: 'Tercero', minWidth: 190, render: (r) => (r.nit ? <span><b className="tnum">{r.nit}</b> <span className="muted xs"><TerceroLabel nit={r.nit} /></span></span> : <span className="muted">—</span>), searchValue: (r) => r.nit },
    { key: 'comprobante', label: 'Comp.', width: 62, render: (r) => <Badge tone="info">{r.linea.comprobante}</Badge> },
    { key: 'documento', label: 'Documento', width: 150, sortable: true },
    { key: 'centro', label: 'Centro', width: 140, render: (r) => (r.linea.centro ? <span><b>{r.linea.centro}</b> <span className="muted xs"><CentroLabel code={r.linea.centro} /></span></span> : <span className="muted">—</span>), searchValue: (r) => r.linea.centro },
    { key: 'fecha', label: 'Fecha', width: 92, sortable: true, render: (r) => <span className="tnum">{fecha(r.linea.fecha)}</span> },
    { key: 'debito', label: 'Débito', money: true, align: 'right', width: 125, sortable: true },
    { key: 'credito', label: 'Crédito', money: true, align: 'right', width: 125, sortable: true },
    { key: 'base', label: 'Base', money: true, align: 'right', width: 115, render: (r) => (r.linea.base ? money(r.linea.base) : '—') },
    { key: 'clase', label: 'Clase', width: 70, align: 'center', render: (r) => claseBadge(r.linea.clase), searchValue: (r) => r.linea.clase },
    { key: 'docAfectado', label: 'Doc. afectado', width: 130, render: (r) => r.linea.docAfectado || <span className="muted">—</span> },
    { key: 'concepto', label: 'Concepto', minWidth: 210, searchValue: (r) => r.linea.concepto },
    { key: 'origen', label: 'Origen', width: 100, render: (r) => <span className="xs muted">{r.linea.origen}</span>, searchValue: (r) => r.linea.origen },
    {
      key: 'detalle',
      label: 'Detalle',
      width: 70,
      align: 'center',
      sticky: 'right',
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" icon="eye" onClick={() => abrirOrigen(r)} disabled={!r.docId} title={r.docId ? 'Ver documento oficial' : 'Sin documento oficial'}>Ver</Button>
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
        ['Cuenta', 'NIT', 'Comprobante', 'Documento', 'Centro', 'Fecha', 'Débito', 'Crédito', 'Base', 'Clase', 'Doc. afectado', 'Concepto', 'Origen'],
        ...rows.map((r) => [r.linea.cuenta, r.nit, r.linea.comprobante, r.linea.documento, r.linea.centro, fecha(r.linea.fecha), money(r.linea.debito), money(r.linea.credito), money(r.linea.base), r.linea.clase, r.linea.docAfectado, r.linea.concepto, r.linea.origen]),
      ],
      `movimiento-mensual-2026-${f.periodo}.csv`,
    )
    audit('Exportación de consulta', 'Consultas', `CSV movimiento mensual 2026-${f.periodo} (${rows.length} líneas)`, 'EXITO')
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Movimiento mensual" icon="libro" />
        <NoPermissionState perm="consulta.ver" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Movimiento mensual"
        subtitle={`Líneas de movimiento del período 2026-${f.periodo} · clic en una fila para abrir el documento`}
        icon="libro"
        badge={<Badge tone="brand">{rows.length} líneas</Badge>}
        actions={<Button size="sm" icon="chevronL" onClick={() => navigate(-1)}>Volver</Button>}
      />

      <div className="querybar" role="search">
        <Field label="Período" width={120}>
          <Select
            value={f.periodo}
            onChange={(v) => set({ periodo: v })}
            ariaLabel="Período"
            options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: `2026-${String(i + 1).padStart(2, '0')}` }))}
          />
        </Field>
        <Field label="Cuenta" width={220}>
          <AccountPicker value={f.cuenta} onChange={(v) => set({ cuenta: v })} placeholder="Todas las cuentas" />
        </Field>
        <Field label="Tercero (NIT)" width={220}>
          <ThirdPartyPicker value={f.nit} onChange={(v) => set({ nit: v })} />
        </Field>
        <Field label="Comprobante" width={170}>
          <VoucherPicker value={f.comprobante} onChange={(v) => set({ comprobante: v })} />
        </Field>
        <Field label="Documento" width={150}>
          <Input value={f.documento} onChange={(v) => set({ documento: v })} placeholder="Contiene…" ariaLabel="Documento" />
        </Field>
        <Field label="Centro" width={180}>
          <CostCenterPicker value={f.centro} onChange={(v) => set({ centro: v })} />
        </Field>
        <Field label="Fecha exacta" width={140}>
          <Input type="date" value={f.fecha} onChange={(v) => set({ fecha: v })} ariaLabel="Fecha exacta" />
        </Field>
        <Button size="sm" variant="ghost" icon="refresh" onClick={() => set({ cuenta: '', nit: '', comprobante: '', documento: '', centro: '', fecha: '' })}>Limpiar</Button>
        <span className="spacer" />
        <ExportMenu onExport={(fmt) => { if (fmt === 'CSV') exportarCsv() }} filename={`movimiento-mensual-2026-${f.periodo}`} disabled={rows.length === 0} />
      </div>

      {loading ? (
        <Card><LoadingState label="Consultando movimiento mensual…" /></Card>
      ) : (
        <Card pad={false}>
          <AccountingDataGrid
            rows={rows}
            columns={columns}
            rowKey={(r) => r.linea.id}
            onRowClick={(r) => abrirOrigen(r)}
            onRowDoubleClick={(r) => abrirOrigen(r)}
            totals={totals}
            initialSort={{ key: 'fecha', dir: 'asc' }}
            selectable={false}
            height={520}
            empty={<EmptyState icon="lupa" title="Sin resultados" detail="Ninguna línea coincide con los filtros del período." action={<Button size="sm" onClick={() => set({ cuenta: '', nit: '', comprobante: '', documento: '', centro: '', fecha: '' })}>Quitar filtros</Button>} />}
          />
        </Card>
      )}

      <Card pad>
        <DebitCreditSummary debito={totalDeb} credito={totalCre} compact />
      </Card>
    </div>
  )
}
