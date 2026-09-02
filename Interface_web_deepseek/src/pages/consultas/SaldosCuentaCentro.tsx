/* ============================================================
   CONTABDSI · Saldos cuenta / centro (dos paneles relacionados)
   ============================================================ */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, LoadingState, NoPermissionState, PageHeader } from '@/components/ui'
import { AccountingDataGrid, type GridColumn, type GridTotal } from '@/components/accounting/DataGrid'
import { ExportMenu, downloadCsv } from '@/components/accounting/Widgets'
import { AccountLabel, AccountPicker, CentroLabel, CostCenterPicker } from '@/components/accounting/Combobox'
import { useCan, useStore } from '@/state/AppStore'
import { money, round2, sum } from '@/core/format'
import { movimientosConsolidados, useMountLoading } from './Documentos'

interface SaldoRow {
  code: string
  nombre: string
  debito: number
  credito: number
  saldo: number
  docId: string
}

export function SaldosCuentaCentroPage() {
  const { state, audit, toast } = useStore()
  const puede = useCan('consulta.ver')
  const navigate = useNavigate()
  const loading = useMountLoading(400)

  const [cuenta, setCuenta] = useState('')
  const [centro, setCentro] = useState('')

  const mov = useMemo(() => movimientosConsolidados(state), [state])

  /** Panel A: saldos por centro de la cuenta elegida */
  const porCentro = useMemo<SaldoRow[]>(() => {
    if (!cuenta) return []
    return state.centros
      .map((c) => {
        const lineas = mov.filter((m) => m.linea.cuenta === cuenta && m.linea.centro === c.code)
        const debito = sum(lineas.map((m) => m.linea.debito))
        const credito = sum(lineas.map((m) => m.linea.credito))
        return { code: c.code, nombre: c.nombre, debito, credito, saldo: round2(debito - credito), docId: lineas.find((m) => m.docId)?.docId ?? '' }
      })
      .filter((r) => r.debito !== 0 || r.credito !== 0)
  }, [mov, cuenta, state.centros])

  /** Panel B: saldos por cuenta del centro elegido */
  const porCuenta = useMemo<SaldoRow[]>(() => {
    if (!centro) return []
    return state.accounts
      .filter((a) => a.afectable)
      .map((a) => {
        const lineas = mov.filter((m) => m.linea.cuenta === a.code && m.linea.centro === centro)
        const debito = sum(lineas.map((m) => m.linea.debito))
        const credito = sum(lineas.map((m) => m.linea.credito))
        return { code: a.code, nombre: a.nombre, debito, credito, saldo: round2(debito - credito), docId: lineas.find((m) => m.docId)?.docId ?? '' }
      })
      .filter((r) => r.debito !== 0 || r.credito !== 0)
  }, [mov, centro, state.accounts])

  /** Clic en un saldo → documento origen (y sincroniza el panel opuesto) */
  const irAlOrigen = (row: SaldoRow, panel: 'A' | 'B') => {
    if (panel === 'A') setCentro(row.code)
    else setCuenta(row.code)
    if (row.docId) {
      audit('Abrir documento', 'Consultas', `Saldo ${cuenta || row.code}/${centro || row.code} → ${row.docId}`, 'INFO')
      navigate(`/documentos/${row.docId}`)
    } else {
      toast('info', 'Sin documento asociado', 'Este saldo proviene de líneas sin documento oficial.')
    }
  }

  const columnasA: GridColumn<SaldoRow>[] = [
    { key: 'code', label: 'Centro', width: 90, render: (r) => <span><b>{r.code}</b> <span className="muted xs"><CentroLabel code={r.code} /></span></span>, searchValue: (r) => r.code },
    { key: 'nombre', label: 'Nombre del centro', minWidth: 150, searchValue: (r) => r.nombre },
    { key: 'debito', label: 'Débito', money: true, align: 'right', width: 120, sortable: true },
    { key: 'credito', label: 'Crédito', money: true, align: 'right', width: 120, sortable: true },
    { key: 'saldo', label: 'Saldo', money: true, align: 'right', width: 120, sortable: true },
  ]

  const columnasB: GridColumn<SaldoRow>[] = [
    { key: 'code', label: 'Cuenta', width: 100, render: (r) => <span><b className="tnum">{r.code}</b> <span className="muted xs"><AccountLabel code={r.code} /></span></span>, searchValue: (r) => r.code },
    { key: 'nombre', label: 'Nombre de la cuenta', minWidth: 150, searchValue: (r) => r.nombre },
    { key: 'debito', label: 'Débito', money: true, align: 'right', width: 120, sortable: true },
    { key: 'credito', label: 'Crédito', money: true, align: 'right', width: 120, sortable: true },
    { key: 'saldo', label: 'Saldo', money: true, align: 'right', width: 120, sortable: true },
  ]

  const totales = (rows: SaldoRow[]): GridTotal[] => [
    { label: 'Totales', key: 'debito', value: money(sum(rows.map((r) => r.debito))), money: true },
    { label: '', key: 'credito', value: money(sum(rows.map((r) => r.credito))), money: true },
    { label: '', key: 'saldo', value: money(sum(rows.map((r) => r.saldo))), money: true },
  ]

  const exportar = (rows: SaldoRow[], nombre: string, encabezados: string[]) => {
    downloadCsv(
      [encabezados, ...rows.map((r) => [r.code, r.nombre, money(r.debito), money(r.credito), money(r.saldo)])],
      `${nombre}.csv`,
    )
    audit('Exportación de consulta', 'Consultas', `CSV ${nombre} (${rows.length} filas)`, 'EXITO')
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Saldos cuenta / centro" icon="centro" />
        <NoPermissionState perm="consulta.ver" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Saldos cuenta / centro"
        subtitle="Dos vistas relacionadas: saldos por centro de una cuenta y saldos por cuenta de un centro"
        icon="centro"
        actions={<Button size="sm" icon="chevronL" onClick={() => navigate(-1)}>Volver</Button>}
      />

      {loading ? (
        <Card><LoadingState label="Calculando saldos cuenta / centro…" /></Card>
      ) : (
        <div className="cp-panels">
          <Card
            title="Por centro de costo"
            icon="centro"
            pad={false}
            actions={
              <ExportMenu onExport={(fmt) => { if (fmt === 'CSV') exportar(porCentro, `saldos-cuenta-${cuenta}-por-centro`, ['Centro', 'Nombre', 'Débito', 'Crédito', 'Saldo']) }} filename={`saldos-cuenta-${cuenta}-por-centro`} disabled={porCentro.length === 0} />
            }
          >
            <div className="querybar" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
              <AccountPicker value={cuenta} onChange={(v) => setCuenta(v)} width={230} />
              {cuenta ? <Badge tone="info"><AccountLabel code={cuenta} /></Badge> : null}
            </div>
            {!cuenta ? (
              <div style={{ padding: 14 }}><EmptyState icon="centro" title="Elija una cuenta" detail="Seleccione una cuenta para listar los centros con saldo en ella." /></div>
            ) : (
              <AccountingDataGrid
                rows={porCentro}
                columns={columnasA}
                rowKey={(r) => r.code}
                onRowClick={(r) => irAlOrigen(r, 'A')}
                totals={totales(porCentro)}
                selectable={false}
                height={340}
                empty={<EmptyState icon="lupa" title="Sin saldos" detail={`La cuenta ${cuenta} no registra movimiento por centro.`} />}
              />
            )}
          </Card>

          <Card
            title="Por cuenta"
            icon="plan"
            pad={false}
            actions={
              <ExportMenu onExport={(fmt) => { if (fmt === 'CSV') exportar(porCuenta, `saldos-centro-${centro}-por-cuenta`, ['Cuenta', 'Nombre', 'Débito', 'Crédito', 'Saldo']) }} filename={`saldos-centro-${centro}-por-cuenta`} disabled={porCuenta.length === 0} />
            }
          >
            <div className="querybar" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
              <CostCenterPicker value={centro} onChange={(v) => setCentro(v)} width={230} />
              {centro ? <Badge tone="info"><CentroLabel code={centro} /></Badge> : null}
            </div>
            {!centro ? (
              <div style={{ padding: 14 }}><EmptyState icon="plan" title="Elija un centro" detail="Seleccione un centro para listar las cuentas con saldo en él." /></div>
            ) : (
              <AccountingDataGrid
                rows={porCuenta}
                columns={columnasB}
                rowKey={(r) => r.code}
                onRowClick={(r) => irAlOrigen(r, 'B')}
                totals={totales(porCuenta)}
                selectable={false}
                height={340}
                empty={<EmptyState icon="lupa" title="Sin saldos" detail={`El centro ${centro} no registra movimiento por cuenta.`} />}
              />
            )}
          </Card>
        </div>
      )}

      <p className="muted xs">Clic en un saldo abre el documento origen y sincroniza el panel opuesto con el centro/cuenta correspondiente.</p>
    </div>
  )
}
