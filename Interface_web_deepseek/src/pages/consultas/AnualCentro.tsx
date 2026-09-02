/* ============================================================
   CONTABDSI · Anual por centro de costo (12 meses + drill-down)
   ============================================================ */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, IconButton, LoadingState, NoPermissionState, PageHeader } from '@/components/ui'
import { AccountingDataGrid, type GridColumn } from '@/components/accounting/DataGrid'
import { ExportMenu, InfoStrip, downloadCsv } from '@/components/accounting/Widgets'
import { AccountLabel, CostCenterPicker, TerceroLabel } from '@/components/accounting/Combobox'
import { useCan, useStore } from '@/state/AppStore'
import { fecha, money, nombreMes, round2, sum } from '@/core/format'
import { mesDeFecha, movimientosConsolidados, useMountLoading, type MovLinea } from './Documentos'

interface MesData {
  mes: number
  debito: number
  credito: number
  saldo: number
  lineas: MovLinea[]
}

export function AnualCentroPage() {
  const { state, audit } = useStore()
  const puede = useCan('consulta.ver')
  const navigate = useNavigate()
  const loading = useMountLoading(400)

  const [centro, setCentro] = useState('')
  const [openMes, setOpenMes] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const centroDef = state.centros.find((c) => c.code === centro)

  const meses = useMemo<MesData[]>(() => {
    const mov = movimientosConsolidados(state).filter((m) => m.linea.centro === centro)
    let acum = 0
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      const lineas = mov.filter((m) => mesDeFecha(m.linea.fecha) === mes)
      const debito = sum(lineas.map((m) => m.linea.debito))
      const credito = sum(lineas.map((m) => m.linea.credito))
      acum = round2(acum + debito - credito)
      return { mes, debito, credito, saldo: acum, lineas }
    })
  }, [state, centro])

  const totDeb = sum(meses.map((m) => m.debito))
  const totCre = sum(meses.map((m) => m.credito))
  const saldoFinal = meses.length > 0 ? meses[11]?.saldo ?? 0 : 0
  const lineasAbiertas = openMes !== null ? meses[openMes - 1]?.lineas ?? [] : []

  const abrirDocumento = (m: MovLinea) => {
    if (!m.docId) return
    audit('Abrir documento', 'Consultas', `Línea ${m.linea.id} → ${m.docId}`, 'INFO')
    navigate(`/documentos/${m.docId}`)
  }

  const columnas: GridColumn<MovLinea>[] = [
    { key: 'fecha', label: 'Fecha', width: 92, sortable: true, render: (r) => <span className="tnum">{fecha(r.linea.fecha)}</span> },
    { key: 'cuenta', label: 'Cuenta', width: 200, render: (r) => <span><b className="tnum">{r.linea.cuenta}</b> <span className="muted xs"><AccountLabel code={r.linea.cuenta} /></span></span>, searchValue: (r) => r.linea.cuenta },
    { key: 'nit', label: 'Tercero', minWidth: 160, render: (r) => (r.nit ? <span><b className="tnum">{r.nit}</b> <span className="muted xs"><TerceroLabel nit={r.nit} /></span></span> : <span className="muted">—</span>), searchValue: (r) => r.nit },
    { key: 'comprobante', label: 'Comp.', width: 62, render: (r) => <Badge tone="info">{r.linea.comprobante}</Badge> },
    { key: 'documento', label: 'Documento', width: 150, sortable: true },
    { key: 'debito', label: 'Débito', money: true, align: 'right', width: 125 },
    { key: 'credito', label: 'Crédito', money: true, align: 'right', width: 125 },
    { key: 'concepto', label: 'Concepto', minWidth: 220, searchValue: (r) => r.linea.concepto },
    {
      key: 'detalle',
      label: '',
      width: 60,
      align: 'center',
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <IconButton icon="eye" label="Ver documento" size={22} disabled={!r.docId} onClick={() => abrirDocumento(r)} />
        </span>
      ),
    },
  ]

  const exportarCsv = () => {
    downloadCsv(
      [
        ['Mes', 'Débito', 'Crédito', 'Saldo'],
        ...meses.map((m) => [nombreMes(m.mes), money(m.debito), money(m.credito), money(m.saldo)]),
        ['Total anual', money(totDeb), money(totCre), money(saldoFinal)],
      ],
      `anual-centro-${centro || 'sin-centro'}.csv`,
    )
    audit('Exportación de consulta', 'Consultas', `CSV anual por centro ${centro}`, 'EXITO')
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Anual por centro" icon="centro" />
        <NoPermissionState perm="consulta.ver" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Anual por centro de costo"
        subtitle="Doce meses de movimiento de un centro · clic en un mes para ver sus líneas"
        icon="centro"
        actions={
          <>
            <ExportMenu onExport={(fmt) => { if (fmt === 'CSV') exportarCsv() }} filename={`anual-centro-${centro || 'sin-centro'}`} disabled={!centroDef} />
            <Button size="sm" icon="chevronL" onClick={() => navigate(-1)}>Volver</Button>
          </>
        }
      />

      <div className="querybar">
        <CostCenterPicker value={centro} onChange={(v) => { setCentro(v); setOpenMes(null) }} width={260} />
        <span className="muted small">Seleccione un centro de costo para ver su movimiento anual.</span>
        <span className="spacer" />
        {centroDef ? <Badge tone="success" icon="check">Centro seleccionado</Badge> : null}
      </div>

      {loading ? (
        <Card><LoadingState label="Calculando anual por centro…" /></Card>
      ) : !centroDef ? (
        <Card>
          <EmptyState icon="centro" title="Seleccione un centro" detail="Elija un centro de costo de la lista para ver su detalle mensual con drill-down a documentos." />
        </Card>
      ) : (
        <>
          <InfoStrip
            items={[
              { label: 'Centro', value: <span>{centroDef.code} — {centroDef.nombre}</span> },
              { label: 'Nivel', value: <span className="tnum">{centroDef.nivel}</span> },
              { label: 'Débito anual', value: <span className="tnum">{money(totDeb)}</span> },
              { label: 'Crédito anual', value: <span className="tnum">{money(totCre)}</span> },
              { label: 'Saldo final', value: <span className="tnum">{money(saldoFinal)}</span> },
            ]}
          />

          <Card pad={false} title="Movimiento mensual" icon="calendario">
            <div className="cp-anual-scroll">
              <table className="cp-anual">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Débito</th>
                    <th>Crédito</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {meses.map((m) => (
                    <tr key={m.mes}>
                      <td>
                        <button
                          type="button"
                          className={`cp-cell cp-cell-link cp-anual-mes ${openMes === m.mes ? 'cp-anual-open' : ''}`}
                          onClick={() => setOpenMes(openMes === m.mes ? null : m.mes)}
                          aria-expanded={openMes === m.mes}
                        >
                          {nombreMes(m.mes)} <span className="xs muted">({m.lineas.length} líneas)</span>
                        </button>
                      </td>
                      <td className="money">{money(m.debito)}</td>
                      <td className="money">{money(m.credito)}</td>
                      <td className="money">{money(m.saldo)}</td>
                    </tr>
                  ))}
                  <tr className="cp-anual-total">
                    <td>Total anual</td>
                    <td className="money">{money(totDeb)}</td>
                    <td className="money">{money(totCre)}</td>
                    <td className="money">{money(saldoFinal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {openMes !== null && (
            <div className="cp-drill">
              <div className="cp-drill-head">
                <b>{nombreMes(openMes)}</b>
                <Badge tone="info">{lineasAbiertas.length} líneas</Badge>
                <span className="muted xs">Clic en una línea para abrir el documento oficial.</span>
                <span className="spacer" />
                <IconButton icon="x" label="Cerrar detalle" size={22} onClick={() => setOpenMes(null)} />
              </div>
              {lineasAbiertas.length === 0 ? (
                <EmptyState icon="lupa" title="Sin líneas este mes" detail={`El centro ${centroDef.code} no tuvo movimiento en ${nombreMes(openMes)}.`} />
              ) : (
                <AccountingDataGrid
                  rows={lineasAbiertas}
                  columns={columnas}
                  rowKey={(r) => r.linea.id}
                  onRowClick={(r) => abrirDocumento(r)}
                  searchText={busqueda}
                  onSearchChange={setBusqueda}
                  selectable={false}
                  height={260}
                  empty={<EmptyState icon="lupa" title="Sin resultados" detail="Ninguna línea coincide con la búsqueda." />}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
