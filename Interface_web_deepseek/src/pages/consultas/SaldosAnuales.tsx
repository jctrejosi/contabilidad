/* ============================================================
   CONTABDSI · Saldos anuales por cuenta (12 meses + ajustes 13-18)
   ============================================================ */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, LoadingState, NoPermissionState, PageHeader, Tabs } from '@/components/ui'
import { AccountingDataGrid, type GridColumn, type GridTotal } from '@/components/accounting/DataGrid'
import { ExportMenu, downloadCsv } from '@/components/accounting/Widgets'
import { useCan, useStore } from '@/state/AppStore'
import { money, nombreMes, round2, sum } from '@/core/format'
import { useMountLoading } from './Documentos'

const MESES = Array.from({ length: 12 }, (_, i) => i + 1)

interface CuentaAnual {
  code: string
  nombre: string
  saldoInicial: number
  meses: number[]
  total: number
  ajustes: number[]
  totalAju: number
}

/** Columnas de ajuste 13-18 (valores mock deterministas derivados del saldo inicial) */
function mockAjustes(code: string, nivel: number, saldoInicial: number): number[] {
  const seed = code.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return Array.from({ length: 6 }, (_, i) => round2(saldoInicial * ((((i + 1) * 7 + nivel * 3 + seed) % 11) - 5) / 1000))
}

export function SaldosAnualesPage() {
  const { state, audit } = useStore()
  const puede = useCan('consulta.ver')
  const navigate = useNavigate()
  const loading = useMountLoading(400)
  const [tab, setTab] = useState<'12' | '18'>('12')

  const rows = useMemo<CuentaAnual[]>(() => {
    return state.accounts.map((a) => {
      const meses = MESES.map((i) => a.meses[i - 1] ?? 0)
      const ajustes = mockAjustes(a.code, a.nivel, a.saldoInicial)
      return {
        code: a.code,
        nombre: a.nombre,
        saldoInicial: a.saldoInicial,
        meses,
        total: round2(a.saldoInicial + sum(meses)),
        ajustes,
        totalAju: round2(a.saldoInicial + sum(ajustes)),
      }
    })
  }, [state.accounts])

  const goCuenta = (code: string) => navigate(`/consultas/anual-cuenta?cuenta=${code}`)
  const goMovimiento = (code: string, mes: number) => navigate(`/consultas/movimiento-mensual?cuenta=${code}&periodo=${String(mes).padStart(2, '0')}`)

  const columnas12: GridColumn<CuentaAnual>[] = [
    { key: 'code', label: 'Cuenta', width: 100, sticky: 'left', render: (r) => <button type="button" className="cp-cell cp-cell-link" onClick={() => goCuenta(r.code)} title="Ver anual por cuenta">{r.code}</button>, searchValue: (r) => r.code },
    { key: 'nombre', label: 'Nombre de la cuenta', minWidth: 210, searchValue: (r) => r.nombre },
    { key: 'saldoInicial', label: 'Saldo inicial', money: true, align: 'right', width: 130, sortable: true },
    ...MESES.map((m) => ({
      key: `m${m}`,
      label: nombreMes(m).slice(0, 3),
      money: true,
      align: 'right' as const,
      width: 96,
      render: (r: CuentaAnual) => (
        <button type="button" className="cp-cell" onClick={() => goMovimiento(r.code, m)} title={`Ver movimiento de ${nombreMes(m)} para ${r.code}`}>
          {money(r.meses[m - 1] ?? 0)}
        </button>
      ),
    })),
    { key: 'total', label: 'Total año', money: true, align: 'right', width: 130, sortable: true },
  ]

  const columnas18: GridColumn<CuentaAnual>[] = [
    { key: 'code', label: 'Cuenta', width: 100, sticky: 'left', render: (r) => <button type="button" className="cp-cell cp-cell-link" onClick={() => goCuenta(r.code)} title="Ver anual por cuenta">{r.code}</button>, searchValue: (r) => r.code },
    { key: 'nombre', label: 'Nombre de la cuenta', minWidth: 210, searchValue: (r) => r.nombre },
    { key: 'saldoInicial', label: 'Saldo inicial', money: true, align: 'right', width: 130 },
    ...Array.from({ length: 6 }, (_, i) => ({
      key: `a${i + 13}`,
      label: `Ajuste ${i + 13}`,
      money: true,
      align: 'right' as const,
      width: 100,
      render: (r: CuentaAnual) => money(r.ajustes[i] ?? 0),
    })),
    { key: 'totalAju', label: 'Total ajustado', money: true, align: 'right', width: 130 },
  ]

  const columnas = tab === '12' ? columnas12 : columnas18

  const totals: GridTotal[] =
    tab === '12'
      ? [
          { label: 'Totales', key: 'saldoInicial', value: money(sum(rows.map((r) => r.saldoInicial))), money: true },
          ...MESES.map((m) => ({ label: '', key: `m${m}`, value: money(sum(rows.map((r) => r.meses[m - 1] ?? 0))), money: true })),
          { label: '', key: 'total', value: money(sum(rows.map((r) => r.total))), money: true },
        ]
      : [
          { label: 'Totales', key: 'saldoInicial', value: money(sum(rows.map((r) => r.saldoInicial))), money: true },
          ...Array.from({ length: 6 }, (_, i) => ({ label: '', key: `a${i + 13}`, value: money(sum(rows.map((r) => r.ajustes[i] ?? 0))), money: true })),
          { label: '', key: 'totalAju', value: money(sum(rows.map((r) => r.totalAju))), money: true },
        ]

  const exportarCsv = () => {
    const encabezados = tab === '12'
      ? ['Cuenta', 'Nombre', 'Saldo inicial', ...MESES.map((m) => nombreMes(m).slice(0, 3)), 'Total año']
      : ['Cuenta', 'Nombre', 'Saldo inicial', ...Array.from({ length: 6 }, (_, i) => `Ajuste ${i + 13}`), 'Total ajustado']
    const filas = rows.map((r) => tab === '12'
      ? [r.code, r.nombre, money(r.saldoInicial), ...MESES.map((m) => money(r.meses[m - 1] ?? 0)), money(r.total)]
      : [r.code, r.nombre, money(r.saldoInicial), ...r.ajustes.map((v) => money(v)), money(r.totalAju)])
    downloadCsv([encabezados, ...filas], `saldos-anuales-${tab === '12' ? '12-meses' : 'ajustes-13-18'}.csv`)
    audit('Exportación de consulta', 'Consultas', `CSV saldos anuales (${tab})`, 'EXITO')
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Saldos anuales" icon="plan" />
        <NoPermissionState perm="consulta.ver" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Saldos anuales"
        subtitle="Saldos por cuenta: inicial + 12 meses · clic en un mes para ver el movimiento"
        icon="plan"
        badge={<Badge tone="brand">{rows.length} cuentas</Badge>}
        actions={
          <>
            <ExportMenu onExport={(fmt) => { if (fmt === 'CSV') exportarCsv() }} filename="saldos-anuales" disabled={rows.length === 0} />
            <Button size="sm" icon="chevronL" onClick={() => navigate(-1)}>Volver</Button>
          </>
        }
      />

      <Tabs
        tabs={[
          { key: '12', label: 'Meses 1 – 12' },
          { key: '18', label: 'Ajustes 13 – 18 (mock)', badge: tab === '18' ? 6 : undefined },
        ]}
        active={tab}
        onChange={(k) => setTab(k as '12' | '18')}
      />

      {loading ? (
        <Card><LoadingState label="Calculando saldos anuales…" /></Card>
      ) : state.accounts.length === 0 ? (
        <Card><EmptyState icon="plan" title="Sin cuentas" detail="El plan de cuentas está vacío." /></Card>
      ) : (
        <Card pad={false}>
          <AccountingDataGrid
            rows={rows}
            columns={columnas}
            rowKey={(r) => r.code}
            totals={totals}
            selectable={false}
            height={520}
            busy={false}
            empty={<EmptyState icon="lupa" title="Sin resultados" detail="Ajuste la búsqueda para ver cuentas." />}
          />
        </Card>
      )}

      <p className="muted xs">
        Clic en el código de cuenta para abrir el anual por cuenta · clic en un mes para ir al movimiento mensual de esa cuenta · columnas 13-18 son valores de ajuste simulados.
      </p>
    </div>
  )
}
