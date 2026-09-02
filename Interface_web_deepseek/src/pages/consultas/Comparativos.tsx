/* ============================================================
   CONTABDSI · Comparativos (mes entre contabilidades, centros,
   dos meses de una contabilidad)
   ============================================================ */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Field, LoadingState, NoPermissionState, PageHeader, Select, Tabs } from '@/components/ui'
import { AccountingDataGrid, type GridColumn, type GridTotal } from '@/components/accounting/DataGrid'
import { ExportMenu, downloadCsv } from '@/components/accounting/Widgets'
import { AccountLabel, CentroLabel } from '@/components/accounting/Combobox'
import { useCan, useStore } from '@/state/AppStore'
import { money, round2, sum } from '@/core/format'
import { movimientosConsolidados, useMountLoading } from './Documentos'

interface CmpRow {
  code: string
  nombre: string
  debA: number
  creA: number
  debB: number
  creB: number
  diff: number
}

const hash = (s: string) => s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
/** Factor determinista de la contabilidad 002 Consolidada (mock derivado de A) */
const factorB = (code: string) => 1 + (((hash(code) % 5) - 2) * 0.02)
const round = (v: number) => round2(v)

export function ComparativosPage() {
  const { state, audit } = useStore()
  const puede = useCan('consulta.ver')
  const navigate = useNavigate()
  const loading = useMountLoading(400)

  const [tab, setTab] = useState<'mes' | 'centros' | 'meses'>('mes')
  const [mes, setMes] = useState(String(state.session.period).padStart(2, '0'))
  const [mes1, setMes1] = useState('01')
  const [mes2, setMes2] = useState(String(state.session.period).padStart(2, '0'))

  const mov = useMemo(() => movimientosConsolidados(state), [state])
  const opcionesMes = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: `2026-${String(i + 1).padStart(2, '0')}` }))

  const suma = (lineas: typeof mov, periodo: string) => ({
    deb: sum(lineas.filter((m) => m.linea.fecha.startsWith(`2026-${periodo}`)).map((m) => m.linea.debito)),
    cre: sum(lineas.filter((m) => m.linea.fecha.startsWith(`2026-${periodo}`)).map((m) => m.linea.credito)),
  })

  /* (a) y (b): una contabilidad A (001 Demo) vs B (002 Consolidada, mock) */
  const filasMes = useMemo<CmpRow[]>(() => {
    return state.accounts
      .filter((a) => a.afectable)
      .map((a) => {
        const A = suma(mov.filter((m) => m.linea.cuenta === a.code), mes)
        const f = factorB(a.code)
        const debB = round(A.deb * f)
        const creB = round(A.cre * f)
        return { code: a.code, nombre: a.nombre, debA: A.deb, creA: A.cre, debB, creB, diff: round(A.deb - A.cre - (debB - creB)) }
      })
      .filter((r) => r.debA !== 0 || r.creA !== 0)
  }, [mov, mes, state.accounts])

  const filasCentros = useMemo<CmpRow[]>(() => {
    return state.centros
      .map((c) => {
        const A = suma(mov.filter((m) => m.linea.centro === c.code), mes)
        const f = factorB(c.code)
        const debB = round(A.deb * f)
        const creB = round(A.cre * f)
        return { code: c.code, nombre: c.nombre, debA: A.deb, creA: A.cre, debB, creB, diff: round(A.deb - A.cre - (debB - creB)) }
      })
      .filter((r) => r.debA !== 0 || r.creA !== 0)
  }, [mov, mes, state.centros])

  /* (c): dos meses de la misma contabilidad (001 Demo) */
  const filasMeses = useMemo<CmpRow[]>(() => {
    return state.accounts
      .filter((a) => a.afectable)
      .map((a) => {
        const M1 = suma(mov.filter((m) => m.linea.cuenta === a.code), mes1)
        const M2 = suma(mov.filter((m) => m.linea.cuenta === a.code), mes2)
        return { code: a.code, nombre: a.nombre, debA: M1.deb, creA: M1.cre, debB: M2.deb, creB: M2.cre, diff: round(M1.deb - M1.cre - (M2.deb - M2.cre)) }
      })
      .filter((r) => r.debA !== 0 || r.creA !== 0 || r.debB !== 0 || r.creB !== 0)
  }, [mov, mes1, mes2, state.accounts])

  const filas = tab === 'mes' ? filasMes : tab === 'centros' ? filasCentros : filasMeses
  const diferencias = filas.filter((r) => r.diff !== 0)

  const etiquetas = tab === 'meses' ? ['Débito M1', 'Crédito M1', 'Débito M2', 'Crédito M2'] : ['Débito 001', 'Crédito 001', 'Débito 002', 'Crédito 002']
  const columnasNumericas: GridColumn<CmpRow>[] = [
    { key: 'debA', label: etiquetas[0] ?? '', money: true, align: 'right', width: 125, sortable: true },
    { key: 'creA', label: etiquetas[1] ?? '', money: true, align: 'right', width: 125, sortable: true },
    { key: 'debB', label: etiquetas[2] ?? '', money: true, align: 'right', width: 125, sortable: true },
    { key: 'creB', label: etiquetas[3] ?? '', money: true, align: 'right', width: 125, sortable: true },
    {
      key: 'diff',
      label: 'Diferencia',
      money: true,
      align: 'right',
      width: 135,
      sortable: true,
      render: (r) => <span className={r.diff !== 0 ? 'cp-diff' : 'muted'}>{money(r.diff)}</span>,
    },
  ]

  const columnas: GridColumn<CmpRow>[] =
    tab === 'centros'
      ? [
          { key: 'code', label: 'Centro', width: 100, render: (r) => <span><b>{r.code}</b> <span className="muted xs"><CentroLabel code={r.code} /></span></span>, searchValue: (r) => r.code },
          { key: 'nombre', label: 'Nombre del centro', minWidth: 160, searchValue: (r) => r.nombre },
          ...columnasNumericas,
        ]
      : [
          { key: 'code', label: 'Cuenta', width: 100, render: (r) => <span><b className="tnum">{r.code}</b> <span className="muted xs"><AccountLabel code={r.code} /></span></span>, searchValue: (r) => r.code },
          { key: 'nombre', label: 'Nombre de la cuenta', minWidth: 170, searchValue: (r) => r.nombre },
          ...columnasNumericas,
        ]

  const totals: GridTotal[] = [
    { label: 'Totales', key: 'debA', value: money(sum(filas.map((r) => r.debA))), money: true },
    { label: '', key: 'creA', value: money(sum(filas.map((r) => r.creA))), money: true },
    { label: '', key: 'debB', value: money(sum(filas.map((r) => r.debB))), money: true },
    { label: '', key: 'creB', value: money(sum(filas.map((r) => r.creB))), money: true },
    { label: '', key: 'diff', value: money(sum(filas.map((r) => r.diff))), money: true },
  ]

  const exportarDiferencias = () => {
    downloadCsv(
      [['Código', 'Nombre', 'Débito A', 'Crédito A', 'Débito B', 'Crédito B', 'Diferencia'], ...diferencias.map((r) => [r.code, r.nombre, money(r.debA), money(r.creA), money(r.debB), money(r.creB), money(r.diff)])],
      `comparativo-diferencias-${tab}.csv`,
    )
    audit('Exportación de diferencias', 'Consultas', `Comparativo ${tab}: ${diferencias.length} diferencias`, 'EXITO')
  }

  const exportarTodo = () => {
    downloadCsv(
      [['Código', 'Nombre', 'Débito A', 'Crédito A', 'Débito B', 'Crédito B', 'Diferencia'], ...filas.map((r) => [r.code, r.nombre, money(r.debA), money(r.creA), money(r.debB), money(r.creB), money(r.diff)])],
      `comparativo-${tab}.csv`,
    )
    audit('Exportación de consulta', 'Consultas', `CSV comparativo ${tab} (${filas.length} filas)`, 'EXITO')
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Comparativos" icon="trendUp" />
        <NoPermissionState perm="consulta.ver" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Comparativos"
        subtitle="Compare meses, contabilidades y centros · la columna de diferencia se resalta en rojo"
        icon="trendUp"
        badge={diferencias.length > 0 ? <Badge tone="warning">{diferencias.length} diferencias</Badge> : <Badge tone="success" icon="check">Sin diferencias</Badge>}
        actions={<Button size="sm" icon="chevronL" onClick={() => navigate(-1)}>Volver</Button>}
      />

      <Tabs
        tabs={[
          { key: 'mes', label: 'Mes entre contabilidades', icon: 'consolidar' },
          { key: 'centros', label: 'Centros entre contabilidades', icon: 'centro' },
          { key: 'meses', label: 'Dos meses de una contabilidad', icon: 'calendario' },
        ]}
        active={tab}
        onChange={(k) => setTab(k as 'mes' | 'centros' | 'meses')}
      />

      <div className="querybar" role="search">
        {tab === 'mes' || tab === 'centros' ? (
          <>
            <Field label="Mes" width={150}>
              <Select value={mes} onChange={setMes} options={opcionesMes} ariaLabel="Mes a comparar" />
            </Field>
            <Field label="Contabilidad A" width={180}>
              <Select value="001" onChange={() => {}} options={[{ value: '001', label: '001 — Demo' }]} disabled ariaLabel="Contabilidad A" />
            </Field>
            <Field label="Contabilidad B" width={210}>
              <Select value="002" onChange={() => {}} options={[{ value: '002', label: '002 — Consolidada (mock)' }]} disabled ariaLabel="Contabilidad B" />
            </Field>
          </>
        ) : (
          <>
            <Field label="Mes 1" width={150}>
              <Select value={mes1} onChange={setMes1} options={opcionesMes} ariaLabel="Mes 1" />
            </Field>
            <Field label="Mes 2" width={150}>
              <Select value={mes2} onChange={setMes2} options={opcionesMes} ariaLabel="Mes 2" />
            </Field>
            <span className="muted small">Contabilidad: 001 — Demo.</span>
          </>
        )}
        <span className="spacer" />
        <Button size="sm" variant="danger" icon="download" onClick={exportarDiferencias} disabled={diferencias.length === 0}>
          Exportar diferencias ({diferencias.length})
        </Button>
        <ExportMenu onExport={(fmt) => { if (fmt === 'CSV') exportarTodo() }} filename={`comparativo-${tab}`} disabled={filas.length === 0} />
      </div>

      {loading ? (
        <Card><LoadingState label="Calculando comparativo…" /></Card>
      ) : (
        <Card pad={false}>
          <AccountingDataGrid
            rows={filas}
            columns={columnas}
            rowKey={(r) => r.code}
            totals={totals}
            selectable={false}
            height={480}
            getRowTone={(r) => (r.diff !== 0 ? 'warning' : undefined)}
            empty={<EmptyState icon="lupa" title="Sin datos para comparar" detail="No hay movimiento en el rango seleccionado." />}
          />
        </Card>
      )}

      <p className="muted xs">La contabilidad 002 (Consolidada) es un escenario simulado derivado de la 001. Las filas con diferencia distinta de cero se resaltan.</p>
    </div>
  )
}
