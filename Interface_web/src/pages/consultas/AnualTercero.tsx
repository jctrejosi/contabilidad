/* ============================================================
   CONTABDSI · Anual por tercero (12 meses + drill-down mensual)
   ============================================================ */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, IconButton, LoadingState, NoPermissionState, PageHeader } from '@/components/ui'
import { AccountingDataGrid, type GridColumn } from '@/components/accounting/DataGrid'
import { ExportMenu, InfoStrip, downloadCsv } from '@/components/accounting/Widgets'
import { AccountLabel, CentroLabel, ThirdPartyPicker } from '@/components/accounting/Combobox'
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

export function AnualTerceroPage() {
  const { state, audit } = useStore()
  const puede = useCan('consulta.ver')
  const navigate = useNavigate()
  const loading = useMountLoading(400)

  const [nit, setNit] = useState('')
  const [openMes, setOpenMes] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const tercero = state.terceros.find((t) => t.nit === nit)

  const meses = useMemo<MesData[]>(() => {
    const mov = movimientosConsolidados(state).filter((m) => m.linea.nit === nit)
    const totDeb = sum(mov.map((m) => m.linea.debito))
    const totCre = sum(mov.map((m) => m.linea.credito))
    // El saldo del maestro es el saldo final: el inicial se deduce del movimiento del año
    let acum = round2((tercero?.saldo ?? 0) - totDeb + totCre)
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      const lineas = mov.filter((m) => mesDeFecha(m.linea.fecha) === mes)
      const debito = sum(lineas.map((m) => m.linea.debito))
      const credito = sum(lineas.map((m) => m.linea.credito))
      acum = round2(acum + debito - credito)
      return { mes, debito, credito, saldo: acum, lineas }
    })
  }, [state, nit, tercero?.saldo])

  const totDeb = sum(meses.map((m) => m.debito))
  const totCre = sum(meses.map((m) => m.credito))
  const saldoFinal = meses.length > 0 ? meses[11]?.saldo ?? (tercero?.saldo ?? 0) : tercero?.saldo ?? 0
  const lineasAbiertas = openMes !== null ? meses[openMes - 1]?.lineas ?? [] : []

  const abrirDocumento = (m: MovLinea) => {
    if (!m.docId) return
    audit('Abrir documento', 'Consultas', `Línea ${m.linea.id} → ${m.docId}`, 'INFO')
    navigate(`/documentos/${m.docId}`)
  }

  const columnas: GridColumn<MovLinea>[] = [
    { key: 'fecha', label: 'Fecha', width: 92, sortable: true, render: (r) => <span className="tnum">{fecha(r.linea.fecha)}</span> },
    { key: 'cuenta', label: 'Cuenta', width: 200, render: (r) => <span><b className="tnum">{r.linea.cuenta}</b> <span className="muted xs"><AccountLabel code={r.linea.cuenta} /></span></span>, searchValue: (r) => r.linea.cuenta },
    { key: 'comprobante', label: 'Comp.', width: 62, render: (r) => <Badge tone="info">{r.linea.comprobante}</Badge> },
    { key: 'documento', label: 'Documento', width: 150, sortable: true },
    { key: 'centro', label: 'Centro', width: 120, render: (r) => (r.linea.centro ? <span><b>{r.linea.centro}</b> <span className="muted xs"><CentroLabel code={r.linea.centro} /></span></span> : <span className="muted">—</span>), searchValue: (r) => r.linea.centro },
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
      `anual-tercero-${nit || 'sin-tercero'}.csv`,
    )
    audit('Exportación de consulta', 'Consultas', `CSV anual por tercero ${nit}`, 'EXITO')
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Anual por tercero" icon="terceros" />
        <NoPermissionState perm="consulta.ver" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Anual por tercero"
        subtitle="Doce meses de movimiento de un tercero · clic en un mes para ver sus líneas"
        icon="terceros"
        actions={
          <>
            <ExportMenu onExport={(fmt) => { if (fmt === 'CSV') exportarCsv() }} filename={`anual-tercero-${nit || 'sin-tercero'}`} disabled={!tercero} />
            <Button size="sm" icon="chevronL" onClick={() => navigate(-1)}>Volver</Button>
          </>
        }
      />

      <div className="querybar">
        <ThirdPartyPicker value={nit} onChange={(v) => { setNit(v); setOpenMes(null) }} width={260} />
        <span className="muted small">Seleccione un tercero para ver su movimiento anual.</span>
        <span className="spacer" />
        {tercero ? <Badge tone={tercero.estado === 'ACTIVO' ? 'success' : 'danger'} icon={tercero.estado === 'ACTIVO' ? 'check' : 'lock'}>{tercero.estado}</Badge> : null}
      </div>

      {loading ? (
        <Card><LoadingState label="Calculando anual por tercero…" /></Card>
      ) : !tercero ? (
        <Card>
          <EmptyState icon="terceros" title="Seleccione un tercero" detail="Elija un NIT de la lista para ver su detalle mensual con drill-down a documentos." />
        </Card>
      ) : (
        <>
          <InfoStrip
            items={[
              { label: 'Tercero', value: <span>{tercero.nit} — {tercero.nombre}</span> },
              { label: 'Ciudad', value: <span>{tercero.ciudad}</span> },
              { label: 'Saldo maestro', value: <span className="tnum">{money(tercero.saldo)}</span> },
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
                <EmptyState icon="lupa" title="Sin líneas este mes" detail={`El tercero ${tercero.nombre} no tuvo movimiento en ${nombreMes(openMes)}.`} />
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
