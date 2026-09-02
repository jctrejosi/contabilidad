/* ============================================================
   CONTABDSI · Consulta de documentos contabilizados
   También exporta utilidades compartidas por las demás páginas
   de consultas e informes (movimiento consolidado, carga simulada).
   ============================================================ */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Field, IconButton, Input, LoadingState, NoPermissionState, PageHeader, Select } from '@/components/ui'
import { AccountingDataGrid, type GridColumn, type GridTotal } from '@/components/accounting/DataGrid'
import { ExportMenu, downloadCsv } from '@/components/accounting/Widgets'
import { TerceroLabel } from '@/components/accounting/Combobox'
import { useCan, useStore } from '@/state/AppStore'
import { fecha, money, sum } from '@/core/format'
import type { AppState, DocumentoContable, LineaMovimiento } from '@/core/types'

/* ============================================================
   Utilidades compartidas (consultas + informes)
   ============================================================ */

/** Línea de movimiento enriquecida con el contexto del documento oficial */
export interface MovLinea {
  linea: LineaMovimiento
  docId: string
  estado: DocumentoContable['estado']
  tercero: string
  nit: string
  concepto: string
  periodo: string
  lote: string
}

/** Movimiento consolidado = documentos contabilizados + lotes contabilizados sin duplicar */
export function movimientosConsolidados(state: AppState): MovLinea[] {
  const out: MovLinea[] = []
  const oficiales = new Set<string>()
  for (const d of state.documentos) {
    oficiales.add(`${d.comprobante}|${d.documento}`)
    for (const l of d.lineas) {
      out.push({
        linea: l,
        docId: d.id,
        estado: d.estado,
        tercero: d.tercero ?? '',
        nit: d.nit || l.nit,
        concepto: d.concepto || l.concepto,
        periodo: d.periodo,
        lote: d.lote,
      })
    }
  }
  for (const lo of state.lotes) {
    if (lo.estado !== 'CONTABILIZADO') continue
    if (oficiales.has(`${lo.comprobante ?? ''}|${lo.documento ?? ''}`)) continue
    for (const l of lo.lineas) {
      out.push({
        linea: l,
        docId: '',
        estado: 'CONTABILIZADO',
        tercero: '',
        nit: l.nit,
        concepto: l.concepto,
        periodo: lo.periodo,
        lote: lo.codigo,
      })
    }
  }
  return out
}

/** Mes (1..12) de una fecha ISO 'YYYY-MM-DD' */
export function mesDeFecha(iso: string): number {
  const m = Number(iso.slice(5, 7))
  return Number.isNaN(m) ? 0 : m
}

/** Carga simulada al montar la página */
export function useMountLoading(ms = 400): boolean {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), ms)
    return () => window.clearTimeout(t)
  }, [ms])
  return loading
}

/* ============================================================
   Página — Consulta de documentos
   ============================================================ */

interface DocRow {
  id: string
  comprobante: string
  documento: string
  fecha: string
  tercero: string
  nit: string
  concepto: string
  debito: number
  credito: number
  estado: DocumentoContable['estado']
}

interface Filtros {
  periodo: string
  comprobante: string
  tipoDoc: string
  nit: string
  desde: string
  hasta: string
}

const FILTROS_VACIOS: Filtros = { periodo: '', comprobante: '', tipoDoc: '', nit: '', desde: '', hasta: '' }

export function ConsultaDocumentosPage() {
  const { state, audit } = useStore()
  const puede = useCan('consulta.ver')
  const navigate = useNavigate()
  const loading = useMountLoading(400)
  const [f, setF] = useState<Filtros>(FILTROS_VACIOS)

  const set = (patch: Partial<Filtros>) => setF((prev) => ({ ...prev, ...patch }))

  const rows = useMemo<DocRow[]>(() => {
    return state.documentos
      .map((d) => ({
        id: d.id,
        comprobante: d.comprobante,
        documento: d.documento,
        fecha: d.fecha,
        tercero: d.tercero ?? '',
        nit: d.nit ?? '',
        concepto: d.concepto,
        debito: sum(d.lineas.map((l) => l.debito)),
        credito: sum(d.lineas.map((l) => l.credito)),
        estado: d.estado,
      }))
      .filter((r) => {
        if (f.periodo && r.fecha.slice(0, 7) !== `2026-${f.periodo}`) return false
        if (f.comprobante && r.comprobante !== f.comprobante) return false
        if (f.tipoDoc && r.comprobante !== f.tipoDoc && !r.documento.startsWith(`${f.tipoDoc}-`)) return false
        if (f.nit && !r.nit.includes(f.nit)) return false
        if (f.desde && r.fecha < f.desde) return false
        if (f.hasta && r.fecha > f.hasta) return false
        return true
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.documento.localeCompare(a.documento))
  }, [state.documentos, f])

  const goDetalle = (id: string) => {
    audit('Abrir documento', 'Consultas', `Documento ${id}`, 'INFO')
    navigate(`/documentos/${id}`)
  }

  const columns: GridColumn<DocRow>[] = [
    { key: 'comprobante', label: 'Comp.', width: 70, sortable: true, render: (r) => <Badge tone="info">{r.comprobante}</Badge> },
    { key: 'documento', label: 'Documento', width: 150, sortable: true },
    { key: 'fecha', label: 'Fecha', width: 92, sortable: true, render: (r) => <span className="tnum">{fecha(r.fecha)}</span> },
    { key: 'tercero', label: 'Tercero', minWidth: 210, searchValue: (r) => `${r.nit} ${r.tercero}`, render: (r) => (r.nit ? <span><b className="tnum">{r.nit}</b> · <TerceroLabel nit={r.nit} /></span> : <span className="muted">—</span>) },
    { key: 'concepto', label: 'Concepto', minWidth: 200, searchValue: (r) => r.concepto },
    { key: 'debito', label: 'Débito', money: true, align: 'right', width: 130, sortable: true },
    { key: 'credito', label: 'Crédito', money: true, align: 'right', width: 130, sortable: true },
    { key: 'estado', label: 'Estado', width: 130, searchValue: (r) => r.estado, render: (r) => (r.estado === 'CONTABILIZADO' ? <Badge tone="success" icon="check">Contabilizado</Badge> : <Badge tone="danger" icon="anular">Anulado</Badge>) },
    { key: 'detalle', label: 'Detalle', width: 70, align: 'center', render: (r) => <span onClick={(e) => e.stopPropagation()}><IconButton icon="eye" label="Ver detalle" size={22} onClick={() => goDetalle(r.id)} /></span> },
  ]

  const totalDeb = sum(rows.map((r) => r.debito))
  const totalCre = sum(rows.map((r) => r.credito))

  const totals: GridTotal[] = [
    { label: 'Totales', key: 'debito', value: money(totalDeb), money: true },
    { label: '', key: 'credito', value: money(totalCre), money: true },
  ]

  const exportarCsv = () => {
    downloadCsv(
      [
        ['Comprobante', 'Documento', 'Fecha', 'NIT', 'Tercero', 'Concepto', 'Débito', 'Crédito', 'Estado'],
        ...rows.map((r) => [r.comprobante, r.documento, fecha(r.fecha), r.nit, r.tercero, r.concepto, money(r.debito), money(r.credito), r.estado]),
      ],
      'documentos-contabilizados.csv',
    )
    audit('Exportación de consulta', 'Consultas', `CSV documentos contabilizados (${rows.length} filas)`, 'EXITO')
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Consulta de documentos" icon="doc" />
        <NoPermissionState perm="consulta.ver" />
      </div>
    )
  }

  const hayFiltros = f.periodo || f.comprobante || f.tipoDoc || f.nit || f.desde || f.hasta

  return (
    <div className="page">
      <PageHeader
        title="Consulta de documentos"
        subtitle="Documentos contabilizados de la compañía · Consulta y exportación"
        icon="doc"
        badge={<Badge tone="brand">{rows.length} documentos</Badge>}
        actions={
          <Button size="sm" icon="chevronL" onClick={() => navigate(-1)}>Volver</Button>
        }
      />

      <div className="querybar" role="search">
        <Field label="Período" width={130}>
          <Select
            value={f.periodo}
            onChange={(v) => set({ periodo: v })}
            placeholder="Todos"
            ariaLabel="Período"
            options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: `2026-${String(i + 1).padStart(2, '0')}` }))}
          />
        </Field>
        <Field label="Comprobante" width={150}>
          <Select
            value={f.comprobante}
            onChange={(v) => set({ comprobante: v })}
            placeholder="Todos"
            ariaLabel="Comprobante"
            options={state.vouchers.map((v) => ({ value: v.code, label: `${v.code} — ${v.nombre}` }))}
          />
        </Field>
        <Field label="Tipo de documento" width={170}>
          <Select
            value={f.tipoDoc}
            onChange={(v) => set({ tipoDoc: v })}
            placeholder="Todos"
            ariaLabel="Tipo de documento"
            options={state.tiposDocumento.map((t) => ({ value: t.code, label: `${t.code} — ${t.nombre}` }))}
          />
        </Field>
        <Field label="NIT tercero" width={140}>
          <Input value={f.nit} onChange={(v) => set({ nit: v })} placeholder="NIT…" monospace ariaLabel="NIT tercero" />
        </Field>
        <Field label="Desde" width={140}>
          <Input type="date" value={f.desde} onChange={(v) => set({ desde: v })} ariaLabel="Fecha desde" />
        </Field>
        <Field label="Hasta" width={140}>
          <Input type="date" value={f.hasta} onChange={(v) => set({ hasta: v })} ariaLabel="Fecha hasta" />
        </Field>
        <Button size="sm" variant="ghost" icon="refresh" onClick={() => setF(FILTROS_VACIOS)}>Limpiar</Button>
        <span className="spacer" />
        <ExportMenu onExport={(fmt) => { if (fmt === 'CSV') exportarCsv() }} filename="documentos-contabilizados" disabled={rows.length === 0} />
      </div>

      {loading ? (
        <Card><LoadingState label="Consultando documentos contabilizados…" /></Card>
      ) : state.documentos.length === 0 ? (
        <Card>
          <EmptyState icon="doc" title="Sin documentos contabilizados" detail="Aún no hay comprobantes contabilizados. Contabilice un lote desde Movimientos para verlo aquí." />
        </Card>
      ) : (
        <Card pad={false}>
          <AccountingDataGrid
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            onRowClick={(r) => goDetalle(r.id)}
            onRowDoubleClick={(r) => goDetalle(r.id)}
            totals={totals}
            initialSort={{ key: 'fecha', dir: 'desc' }}
            selectable={false}
            empty={<EmptyState icon="lupa" title="Sin resultados" detail={hayFiltros ? 'Ningún documento coincide con los filtros aplicados.' : 'No hay documentos para mostrar.'} action={<Button size="sm" onClick={() => setF(FILTROS_VACIOS)}>Quitar filtros</Button>} />}
          />
        </Card>
      )}

      <p className="muted xs">Clic en una fila o en el icono de detalle para abrir el documento oficial. {hayFiltros ? `Filtros activos · ${rows.length} de ${state.documentos.length} documentos.` : `${rows.length} documentos contabilizados.`}</p>
    </div>
  )
}
