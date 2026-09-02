/* ============================================================
   CONTABDSI · Informe individual (/informes/reporte/:id)
   Incluye el Generador personalizado (id 'generador')
   ============================================================ */

import '../consultas/pages.css'

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, Checkbox, EmptyState, ErrorState, IconButton, LoadingState, NoPermissionState, PageHeader, Segmented } from '@/components/ui'
import { ExportMenu, ReportParameters, ReportPreview, SavedView, downloadCsv, usePageTitle } from '@/components/accounting/Widgets'
import { AccountPicker } from '@/components/accounting/Combobox'
import { useCan, useStore } from '@/state/AppStore'
import { REPORTS } from '@/data/reports'
import { fecha, money, nombreMes, round2, sum, uid } from '@/core/format'
import { mesDeFecha, movimientosConsolidados } from '@/pages/consultas/Documentos'
import type { AppState, ReportColumn, ReportDef } from '@/core/types'

/* ============================================================
   Construcción de filas mock consistentes con el store
   ============================================================ */

function buildRows(report: ReportDef, values: Record<string, string | number | boolean>, state: AppState): Record<string, string | number>[] {
  const year = state.session.year
  const periodo = String(values.periodo ?? String(state.session.period).padStart(2, '0')).padStart(2, '0')
  const mesIdx = Number(periodo)
  const cuentaSel = String(values.cuenta ?? '')
  const terceroSel = String(values.tercero ?? '')
  const docSel = String(values.documento ?? '').toLowerCase()

  const nomCuenta = (code: string) => state.accounts.find((a) => a.code === code)?.nombre ?? ''
  const nomTercero = (nit: string) => state.terceros.find((t) => t.nit === nit)?.nombre ?? ''
  const nomCentro = (code: string) => state.centros.find((c) => c.code === code)?.nombre ?? ''

  const movAnio = movimientosConsolidados(state)
  const mov = movAnio
    .filter((m) => m.linea.fecha.startsWith(`${year}-${periodo}`))
    .filter((m) => !cuentaSel || m.linea.cuenta === cuentaSel)
    .filter((m) => !terceroSel || m.linea.nit === terceroSel)
    .filter((m) => !docSel || m.linea.docAfectado.toLowerCase().includes(docSel) || m.linea.documento.toLowerCase().includes(docSel))

  const docRows = () =>
    state.documentos
      .filter((d) => d.periodo === `${year}${periodo}`)
      .map((d) => ({
        comprobante: d.comprobante,
        documento: d.documento,
        fecha: fecha(d.fecha),
        tercero: d.tercero || d.nit || '',
        concepto: d.concepto,
        debito: sum(d.lineas.map((l) => l.debito)),
        credito: sum(d.lineas.map((l) => l.credito)),
      }))

  const movRows = () =>
    mov.map((m) => ({
      cuenta: m.linea.cuenta,
      nombre: nomCuenta(m.linea.cuenta),
      nit: m.linea.nit,
      tercero: nomTercero(m.linea.nit),
      centro: m.linea.centro,
      comprobante: m.linea.comprobante,
      documento: m.linea.documento,
      fecha: fecha(m.linea.fecha),
      debito: m.linea.debito,
      credito: m.linea.credito,
      base: m.linea.base,
      clase: m.linea.clase,
    }))

  const saldoRows = () =>
    state.accounts.map((a) => {
      const deb = sum(mov.filter((m) => m.linea.cuenta === a.code).map((m) => m.linea.debito))
      const cre = sum(mov.filter((m) => m.linea.cuenta === a.code).map((m) => m.linea.credito))
      return { cuenta: a.code, nombre: a.nombre, saldoInicial: a.saldoInicial, debito: deb, credito: cre, saldo: round2(a.saldoInicial + deb - cre) }
    })

  const id = report.id

  /* ---------- Documentos ---------- */
  if (id.startsWith('doc-')) return docRows()

  /* ---------- Libros ---------- */
  if (id === 'lib-auxiliar-general' || id === 'lib-auxiliar-afectado' || id === 'lib-diario-cuenta' || id === 'lib-caja-cuenta') return movRows()
  if (id === 'lib-mov-comprobante' || id === 'lib-caja-comprobante') return docRows()
  if (id === 'lib-acumulado-corriente') {
    const corriente = ['11', '13', '21', '23', '24', '25', '51']
    return saldoRows().filter((r) => corriente.includes(String(r.cuenta).slice(0, 2)))
  }
  if (id.startsWith('lib-')) return saldoRows()

  /* ---------- Estados ---------- */
  if (id === 'est-balance-comparativo') {
    return state.accounts.map((a) => {
      const mesB = a.meses[mesIdx - 1] ?? 0
      const mesA = mesIdx > 1 ? (a.meses[mesIdx - 2] ?? 0) : a.saldoInicial
      return { cuenta: a.code, nombre: a.nombre, mesA, mesB, var: round2(mesB - mesA) }
    })
  }
  if (id === 'est-mov-tipo-doc') return docRows()
  if (id === 'est-mov-cuenta') return movRows()
  if (id === 'est-comparativo-cta-tercero') {
    return mov.map((m) => ({
      cuenta: m.linea.cuenta,
      nit: m.linea.nit,
      tercero: nomTercero(m.linea.nit),
      debito: m.linea.debito,
      credito: m.linea.credito,
      saldo: round2(m.linea.debito - m.linea.credito),
    }))
  }
  if (id === 'est-resumen-contribuyente') {
    const byTipo = new Map<string, { tipoDoc: string; cantidad: number; debito: number; credito: number }>()
    for (const t of state.terceros) {
      const acc = byTipo.get(t.tipoDoc) ?? { tipoDoc: t.tipoDoc, cantidad: 0, debito: 0, credito: 0 }
      acc.cantidad += 1
      byTipo.set(t.tipoDoc, acc)
    }
    for (const m of mov) {
      const t = state.terceros.find((x) => x.nit === m.linea.nit)
      if (!t) continue
      const acc = byTipo.get(t.tipoDoc)
      if (acc) {
        acc.debito += m.linea.debito
        acc.credito += m.linea.credito
      }
    }
    return [...byTipo.values()].map((r) => ({ tipoDoc: r.tipoDoc, cantidad: r.cantidad, debito: round2(r.debito), credito: round2(r.credito) }))
  }
  if (id.startsWith('est-')) return saldoRows()

  /* ---------- Terceros ---------- */
  if (id === 'ter-general') {
    return state.terceros.map((t) => ({ nit: t.nit, nombre: t.nombre, ciudad: t.ciudad, saldo: t.saldo, estado: t.estado }))
  }
  if (id === 'ter-acumulacion') {
    return state.terceros.map((t) => {
      const deb = sum(mov.filter((m) => m.linea.nit === t.nit).map((m) => m.linea.debito))
      const cre = sum(mov.filter((m) => m.linea.nit === t.nit).map((m) => m.linea.credito))
      return { nit: t.nit, nombre: t.nombre, debito: deb, credito: cre }
    })
  }
  if (id === 'ter-cuenta-tercero') {
    return mov.map((m) => ({ cuenta: m.linea.cuenta, nit: m.linea.nit, nombre: nomTercero(m.linea.nit), debito: m.linea.debito, credito: m.linea.credito }))
  }
  if (id === 'ter-especifico') return movRows()
  if (id === 'ter-cumpleanos') {
    const mes = String(values.mes ?? '')
    return state.terceros
      .filter((t) => t.nacimiento && nombreMes(mesDeFecha(t.nacimiento)) === mes)
      .map((t) => ({ nit: t.nit, nombre: t.nombre, nacimiento: fecha(t.nacimiento), ciudad: t.ciudad }))
  }
  if (id === 'ter-etiquetas') {
    return state.terceros.map((t) => ({ nit: t.nit, nombre: t.nombre, etiquetas: t.etiquetas.join(', ') || '—', saldo: t.saldo }))
  }

  /* ---------- Centros ---------- */
  if (id === 'cen-diario-continuo' || id === 'cen-diario-fijo' || id === 'cen-clasificacion') return movRows()
  if (id === 'cen-balance-acum') {
    return state.centros.map((c) => {
      const deb = sum(mov.filter((m) => m.linea.centro === c.code).map((m) => m.linea.debito))
      const cre = sum(mov.filter((m) => m.linea.centro === c.code).map((m) => m.linea.credito))
      return { centro: c.code, nombre: c.nombre, saldoInicial: 0, debito: deb, credito: cre, saldo: round2(deb - cre) }
    })
  }
  if (id === 'cen-balance-mensual') {
    return state.centros.map((c) => {
      const deb = sum(mov.filter((m) => m.linea.centro === c.code).map((m) => m.linea.debito))
      const cre = sum(mov.filter((m) => m.linea.centro === c.code).map((m) => m.linea.credito))
      return { centro: c.code, nombre: c.nombre, debito: deb, credito: cre, saldo: round2(deb - cre) }
    })
  }
  if (id === 'cen-clasif-tercero') {
    return mov.map((m) => ({ centro: m.linea.centro, nit: m.linea.nit, nombre: nomTercero(m.linea.nit), debito: m.linea.debito, credito: m.linea.credito }))
  }
  if (id === 'cen-discriminado-mes') {
    return state.centros.map((c) => {
      const mes = (n: number) => {
        const lineas = movAnio.filter((m) => m.linea.centro === c.code && mesDeFecha(m.linea.fecha) === n)
        return sum(lineas.map((m) => m.linea.debito)) - sum(lineas.map((m) => m.linea.credito))
      }
      return { centro: c.code, nombre: nomCentro(c.code), enero: mes(1), febrero: mes(2), marzo: mes(3) }
    })
  }

  /* ---------- Flujo de caja (mocks derivados del store) ---------- */
  if (id === 'flujo-definicion') {
    const actividad = (code: string) => {
      if (code.startsWith('11')) return 'Operación'
      if (code.startsWith('12') || code.startsWith('13')) return 'Operación'
      if (code.startsWith('21') || code.startsWith('22')) return 'Financiación'
      if (code.startsWith('23') || code.startsWith('24') || code.startsWith('25')) return 'Operación'
      return 'Operación'
    }
    return state.accounts.filter((a) => a.movimiento).map((a) => ({ cuenta: a.code, nombre: a.nombre, actividad: actividad(a.code) }))
  }
  if (id === 'flujo-comparativo') {
    const debAnio = sum(movAnio.map((m) => m.linea.debito))
    const creAnio = sum(movAnio.map((m) => m.linea.credito))
    const impuestos = state.accounts.find((a) => a.code === '2408')?.saldoInicial ?? 0
    const gastos = state.accounts.find((a) => a.code === '5')?.meses[1] ?? 0
    const conceptos = [
      { concepto: 'Ingresos operacionales', anioActual: round2(creAnio + 420000000) },
      { concepto: 'Compras y servicios', anioActual: round2(debAnio) },
      { concepto: 'Gastos de personal', anioActual: gastos },
      { concepto: 'Impuestos', anioActual: impuestos },
      { concepto: 'Efectivo disponible', anioActual: state.accounts.find((a) => a.code === '1110')?.saldoInicial ?? 0 },
    ]
    return conceptos.map((c) => ({ concepto: c.concepto, anioActual: c.anioActual, anioAnterior: round2(c.anioActual * 0.93), var: round2(c.anioActual - c.anioActual * 0.93) }))
  }

  /* ---------- NIC / NIIF ---------- */
  if (id === 'nic-apertura') return saldoRows()
  if (id === 'nic-saldos') return movRows()

  return saldoRows()
}

/* ============================================================
   Página de informe individual
   ============================================================ */

interface VistaGuardada {
  key: string
  nombre: string
  params: Record<string, string | number | boolean>
}

function ReporteDetalle({ report }: { report: ReportDef }) {
  usePageTitle(report.nombre)
  const { state, audit, toast } = useStore()
  const navigate = useNavigate()

  const [values, setValues] = useState<Record<string, string | number | boolean>>(() => {
    const v: Record<string, string | number | boolean> = {}
    for (const p of report.params) v[p.key] = p.defaultValue ?? (p.tipo === 'checkbox' ? false : '')
    if (v.periodo === undefined || v.periodo === '') v.periodo = String(state.session.period).padStart(2, '0')
    return v
  })

  const [rows, setRows] = useState<Record<string, string | number>[] | null>(null)
  const [generando, setGenerando] = useState(false)

  const viewsKey = `contabdsi.vistas.${report.id}`
  const [views, setViews] = useState<VistaGuardada[]>(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(viewsKey) ?? '[]')
      return Array.isArray(arr) ? arr : []
    } catch {
      return []
    }
  })
  const [currentView, setCurrentView] = useState<string | undefined>()

  useEffect(() => {
    localStorage.setItem(viewsKey, JSON.stringify(views))
  }, [views, viewsKey])

  const generar = () => {
    setGenerando(true)
    setRows(null)
    window.setTimeout(() => {
      const filas = buildRows(report, values, state)
      setRows(filas)
      setGenerando(false)
      audit('Generación de informe', 'Informes', `${report.nombre} · período ${String(values.periodo ?? '—')} · ${filas.length} filas`, 'EXITO')
      toast('success', 'Informe generado', `${report.nombre}: ${filas.length.toLocaleString('es-CO')} filas (datos simulados del prototipo).`)
    }, 500)
  }

  const previewRows = rows === null ? [] : rows.map((r) => report.columns.map((c) => ({ key: c.key, value: r[c.key] ?? '' })))

  const exportarCsv = () => {
    if (rows === null) return
    downloadCsv([report.columns.map((c) => c.label), ...rows.map((r) => report.columns.map((c) => String(r[c.key] ?? '')))], `${report.id}.csv`)
    audit('Exportación de informe', 'Informes', `CSV ${report.id} (${rows.length} filas)`, 'EXITO')
  }

  return (
    <div className="page">
      <PageHeader
        title={report.nombre}
        subtitle={report.descripcion}
        icon="informe"
        badge={<Badge tone="brand">{report.columns.length} columnas</Badge>}
        actions={
          <>
            <SavedView
              views={views.map((v) => ({ key: v.key, nombre: v.nombre }))}
              current={currentView}
              onLoad={(key) => {
                const v = views.find((x) => x.key === key)
                if (v) {
                  setValues(v.params)
                  setCurrentView(key)
                  toast('info', 'Vista cargada', `Parámetros de «${v.nombre}» restaurados.`)
                }
              }}
              onSave={(nombre) => {
                const key = uid('vista')
                setViews((prev) => [...prev, { key, nombre, params: values }])
                setCurrentView(key)
                audit('Vista guardada', 'Informes', `Vista «${nombre}» de ${report.id}`, 'EXITO')
              }}
              onDelete={(key) => {
                setViews((prev) => prev.filter((v) => v.key !== key))
                if (currentView === key) setCurrentView(undefined)
              }}
            />
            <ExportMenu onExport={(fmt) => { if (fmt === 'CSV') exportarCsv() }} filename={report.id} disabled={rows === null} />
            <Button size="sm" icon="chevronL" onClick={() => navigate('/informes')}>Volver</Button>
          </>
        }
      />

      <Card title="Parámetros del informe" icon="sliders">
        <ReportParameters params={report.params} values={values} onChange={setValues} onGenerate={generar} />
      </Card>

      {generando ? (
        <Card><LoadingState label="Generando informe…" /></Card>
      ) : rows === null ? (
        <Card>
          <EmptyState icon="informe" title="Informe sin generar" detail="Configure los parámetros y pulse Generar para obtener la vista previa con datos del prototipo." action={<Button variant="primary" icon="play" onClick={generar}>Generar</Button>} />
        </Card>
      ) : (
        <Card pad={false}>
          <ReportPreview
            titulo={report.nombre}
            columns={report.columns}
            rows={previewRows}
            company={`${state.session.company.codigo} — ${state.session.company.nombre} · NIT ${state.session.company.nit}`}
          />
        </Card>
      )}
    </div>
  )
}

/* ============================================================
   Generador personalizado (id 'generador')
   ============================================================ */

interface Renglon {
  id: string
  tipo: 'cuenta' | 'rango'
  desde: string
  hasta: string
  signo: 1 | -1
}

function GeneradorPersonalizado() {
  usePageTitle('Generador personalizado')
  const { state, audit, toast } = useStore()
  const navigate = useNavigate()

  const [renglones, setRenglones] = useState<Renglon[]>([{ id: uid('rg'), tipo: 'cuenta', desde: '', hasta: '', signo: 1 }])
  const [mesesSel, setMesesSel] = useState<number[]>([state.session.period])
  const [incluirTotales, setIncluirTotales] = useState(true)
  const [orden, setOrden] = useState<'codigo' | 'nombre'>('codigo')
  const [generando, setGenerando] = useState(false)
  const [generado, setGenerado] = useState(false)

  const mov = useMemo(() => movimientosConsolidados(state), [state])

  const actualizar = (id: string, patch: Partial<Renglon>) => setRenglones((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const quitar = (id: string) => setRenglones((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev))
  const agregar = () => setRenglones((prev) => [...prev, { id: uid('rg'), tipo: 'cuenta', desde: '', hasta: '', signo: 1 }])

  const toggleMes = (m: number) => setMesesSel((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)))

  const filas = useMemo(() => {
    const filasOut = renglones.map((rg) => {
      const cuentas = rg.tipo === 'cuenta'
        ? state.accounts.filter((a) => a.code === rg.desde)
        : state.accounts.filter((a) => a.code >= rg.desde && a.code <= rg.hasta)
      const nombre = rg.tipo === 'cuenta'
        ? (state.accounts.find((a) => a.code === rg.desde)?.nombre ?? (rg.desde || 'Cuenta sin elegir'))
        : `Rango ${rg.desde || '…'} – ${rg.hasta || '…'}`
      const fila: Record<string, string | number> = { cuenta: rg.tipo === 'cuenta' ? rg.desde : `${rg.desde}–${rg.hasta}`, nombre, _signo: rg.signo }
      for (const m of mesesSel) {
        const lineas = mov.filter((ml) => cuentas.some((a) => a.code === ml.linea.cuenta) && mesDeFecha(ml.linea.fecha) === m)
        const valor = rg.signo * (sum(lineas.map((ml) => ml.linea.debito)) - sum(lineas.map((ml) => ml.linea.credito)))
        fila[`m${m}`] = round2(valor)
      }
      return fila
    })
    if (incluirTotales) {
      const total: Record<string, string | number> = { cuenta: 'TOTALES', nombre: '' }
      for (const m of mesesSel) total[`m${m}`] = round2(sum(filasOut.map((f) => Number(f[`m${m}`] ?? 0))))
      filasOut.push(total)
    }
    const sorted = [...filasOut]
    if (orden === 'codigo') sorted.sort((a, b) => String(a.cuenta).localeCompare(String(b.cuenta)))
    else sorted.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)))
    return sorted
  }, [renglones, mesesSel, incluirTotales, orden, mov, state.accounts])

  const columnas: ReportColumn[] = [
    { key: 'cuenta', label: 'Cuenta / Rango', width: 130 },
    { key: 'nombre', label: 'Descripción', width: 260 },
    ...mesesSel.map((m) => ({ key: `m${m}`, label: nombreMes(m).slice(0, 3), money: true, align: 'right' as const })),
  ]

  const generar = () => {
    setGenerando(true)
    window.setTimeout(() => {
      setGenerado(true)
      setGenerando(false)
      audit('Generación de informe', 'Informes', `Generador personalizado · ${renglones.length} renglones · ${mesesSel.length} meses`, 'EXITO')
      toast('success', 'Informe generado', `Generador personalizado con ${filas.length} filas y ${mesesSel.length} columnas de mes.`)
    }, 500)
  }

  const exportarCsv = () => {
    downloadCsv(
      [['Cuenta / Rango', 'Descripción', ...mesesSel.map((m) => nombreMes(m))],
        ...filas.map((f) => [String(f.cuenta), String(f.nombre), ...mesesSel.map((m) => money(Number(f[`m${m}`] ?? 0)))])],
      'generador-personalizado.csv',
    )
    audit('Exportación de informe', 'Informes', 'CSV generador personalizado', 'EXITO')
  }

  return (
    <div className="page">
      <PageHeader
        title="Generador personalizado"
        subtitle="Seleccione renglones (cuentas o rangos), signos, meses, totales y orden · las columnas se construyen dinámicamente"
        icon="sliders"
        badge={<Badge tone="brand">{mesesSel.length} columnas de mes</Badge>}
        actions={
          <>
            <ExportMenu onExport={(fmt) => { if (fmt === 'CSV') exportarCsv() }} filename="generador-personalizado" disabled={!generado} />
            <Button size="sm" icon="chevronL" onClick={() => navigate('/informes')}>Volver</Button>
          </>
        }
      />

      <Card title="Renglones del informe" icon="list">
        <div className="stack gap-8">
          {renglones.map((rg, i) => (
            <div className="gen-renglon" key={rg.id}>
              <Badge tone="info">Renglón {i + 1}</Badge>
              <Segmented
                value={rg.tipo}
                onChange={(t) => actualizar(rg.id, { tipo: t })}
                options={[{ value: 'cuenta', label: 'Cuenta' }, { value: 'rango', label: 'Rango' }]}
              />
              <AccountPicker value={rg.desde} onChange={(v) => actualizar(rg.id, { desde: v })} width={210} placeholder={rg.tipo === 'cuenta' ? 'Cuenta' : 'Desde'} />
              {rg.tipo === 'rango' ? <AccountPicker value={rg.hasta} onChange={(v) => actualizar(rg.id, { hasta: v })} width={210} placeholder="Hasta" /> : null}
              <Segmented
                value={rg.signo === 1 ? '1' : '-1'}
                onChange={(s) => actualizar(rg.id, { signo: s === '-1' ? -1 : 1 })}
                options={[{ value: '1', label: '+' }, { value: '-1', label: '−' }]}
              />
              <IconButton icon="trash" label="Eliminar renglón" danger disabled={renglones.length <= 1} onClick={() => quitar(rg.id)} />
            </div>
          ))}
          <div>
            <Button size="sm" icon="plus" onClick={agregar}>Agregar renglón</Button>
          </div>
        </div>
      </Card>

      <Card title="Columnas (meses) y presentación" icon="columns">
        <div className="stack gap-12">
          <div className="gen-months" role="group" aria-label="Meses a incluir">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <Checkbox key={m} checked={mesesSel.includes(m)} onChange={() => toggleMes(m)} label={nombreMes(m)} />
            ))}
          </div>
          <div className="row gap-16">
            <Segmented value={orden} onChange={setOrden} options={[{ value: 'codigo', label: 'Ordenar por código' }, { value: 'nombre', label: 'Ordenar por nombre' }]} />
            <Checkbox checked={incluirTotales} onChange={setIncluirTotales} label="Incluir fila de totales" />
            <span className="spacer" />
            <Button variant="primary" icon="play" onClick={generar} loading={generando}>Generar</Button>
          </div>
        </div>
      </Card>

      {generando ? (
        <Card><LoadingState label="Generando informe personalizado…" /></Card>
      ) : !generado ? (
        <Card>
          <EmptyState icon="sliders" title="Sin vista previa" detail="Configure renglones y meses, luego pulse Generar para ver la vista previa." />
        </Card>
      ) : (
        <Card pad={false}>
          <ReportPreview
            titulo="Generador personalizado"
            columns={columnas}
            rows={filas.map((f) => columnas.map((c) => ({ key: c.key, value: f[c.key] ?? '' })))}
            company={`${state.session.company.codigo} — ${state.session.company.nombre} · NIT ${state.session.company.nit}`}
          />
        </Card>
      )}
    </div>
  )
}

/* ============================================================
   Ruta /informes/reporte/:id
   ============================================================ */

export function ReportePage() {
  const { id } = useParams()
  const puede = useCan('informes.ver')
  const navigate = useNavigate()

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Informe" icon="informe" />
        <NoPermissionState perm="informes.ver" />
      </div>
    )
  }

  if (id === 'generador') {
    return <GeneradorPersonalizado />
  }

  const report = REPORTS.find((r) => r.id === id)
  if (!report) {
    return (
      <div className="page">
        <PageHeader title="Informe no encontrado" icon="error" />
        <Card>
          <ErrorState
            title="El informe no existe"
            detail={<span>«{id ?? ''}» no corresponde a ningún informe del catálogo.</span>}
            onRetry={() => navigate('/informes')}
          />
        </Card>
      </div>
    )
  }

  return <ReporteDetalle key={report.id} report={report} />
}
