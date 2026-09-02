/* ============================================================
   CONTABDSI · Retenciones en la fuente
   Acumulación por tercero, análisis por concepto, certificados,
   totales por cuenta, soportes, limpieza/regeneración de
   acumulados, plano anual y carga de certificados al portal.
   ============================================================ */

import './pages.css'

import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  LoadingState,
  NoPermissionState,
  PageHeader,
  Tabs,
} from '@/components/ui'
import { ExportMenu, InfoStrip, ReportPreview, usePageTitle } from '@/components/accounting/Widgets'
import { useCan, useStore } from '@/state/AppStore'
import { fecha, fechaHora, money, nitFmt } from '@/core/format'
import type { ReportColumn } from '@/core/types'

export function RetencionesPage() {
  usePageTitle('Retenciones')
  const { state, dispatch, toast, audit } = useStore()
  const puede = useCan('impuestos.retenciones')

  const [tab, setTab] = useState('acumulacion')
  const [limpio, setLimpio] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [regenerando, setRegenerando] = useState(false)
  const [certs, setCerts] = useState<{ nombre: string; nit: string; anio: string; estado: 'CARGADO' | 'PENDIENTE' }[]>([
    { nombre: 'Certificado_RET_900111222_2025.pdf', nit: '900111222', anio: '2025', estado: 'CARGADO' },
    { nombre: 'Certificado_RET_890999888_2025.pdf', nit: '890999888', anio: '2025', estado: 'PENDIENTE' },
  ])
  const [subiendo, setSubiendo] = useState(false)

  const lineasRet = useMemo(() => {
    const src = [...state.documentos.flatMap((d) => d.lineas), ...state.lotes.flatMap((l) => l.lineas)]
    return src.filter((l) => l.clase === 'RETENCION')
  }, [state.documentos, state.lotes])

  const desactualizada = useMemo(() => {
    const t = new Date(state.acumuladosFecha).getTime()
    return Date.now() - t > 7 * 24 * 60 * 60 * 1000
  }, [state.acumuladosFecha])

  const porTercero = useMemo(() => {
    const map = new Map<string, { nit: string; nombre: string; base: number; retencion: number; docs: number }>()
    for (const l of lineasRet) {
      if (!l.nit) continue
      const t = state.terceros.find((x) => x.nit === l.nit)
      const cur = map.get(l.nit) ?? { nit: l.nit, nombre: t?.nombre ?? l.nit, base: 0, retencion: 0, docs: 0 }
      cur.base += l.base
      cur.retencion += l.credito
      cur.docs += 1
      map.set(l.nit, cur)
    }
    return [...map.values()].sort((a, b) => b.retencion - a.retencion)
  }, [lineasRet, state.terceros])

  const porConcepto = useMemo(() => {
    const acum = new Map<string, { base: number; retencion: number }>()
    for (const l of lineasRet) {
      const code = l.nit === '901555666' ? 'R04' : 'R01'
      const cur = acum.get(code) ?? { base: 0, retencion: 0 }
      cur.base += l.base
      cur.retencion += l.credito
      acum.set(code, cur)
    }
    return state.conceptosRetencion.map((c) => ({
      ...c,
      base: acum.get(c.code)?.base ?? 0,
      retencion: acum.get(c.code)?.retencion ?? 0,
    }))
  }, [lineasRet, state.conceptosRetencion])

  const relacion = useMemo(
    () =>
      lineasRet.map((l) => ({
        documento: l.documento,
        fecha: l.fecha,
        nit: l.nit,
        nombre: state.terceros.find((t) => t.nit === l.nit)?.nombre ?? '—',
        base: l.base,
        retencion: l.credito,
      })),
    [lineasRet, state.terceros],
  )

  const totalBase = porTercero.reduce((a, t) => a + t.base, 0)
  const totalRet = porTercero.reduce((a, t) => a + t.retencion, 0)

  const limpiarAcumulados = () => {
    setConfirmOpen(false)
    setLimpio(true)
    audit('Limpieza de acumulados', 'Retenciones', 'Acumulados derivados eliminados (el libro contable no se toca)', 'EXITO')
    toast('warning', 'Acumulados limpiados', 'Se eliminaron los acumulados derivados. El libro contable permanece intacto; puede regenerarlos cuando quiera.')
  }

  const regenerar = () => {
    setRegenerando(true)
    window.setTimeout(() => {
      dispatch({ type: 'REGEN_ACUMULADOS' })
      setRegenerando(false)
      setLimpio(false)
      audit('Regeneración de acumulados', 'Retenciones', 'Acumulados regenerados desde el libro contable', 'EXITO')
      toast('success', 'Acumulados regenerados', 'Los acumulados de retención se recalcularon desde el libro contable (simulado).')
    }, 1400)
  }

  const subirCertificados = () => {
    setSubiendo(true)
    window.setTimeout(() => {
      setSubiendo(false)
      setCerts((c) => c.map((x) => ({ ...x, estado: 'CARGADO' as const })))
      audit('Carga de certificados al portal', 'Retenciones', `${certs.length} certificado(s) cargados (simulado)`, 'EXITO')
      toast('success', 'Certificados cargados', 'Los certificados fueron enviados al portal de la DIAN (simulado).')
    }, 1200)
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Retenciones" subtitle="Retención en la fuente" icon="retencion" />
        <NoPermissionState perm="impuestos.retenciones" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Retenciones"
        subtitle="Acumulación, análisis, certificados y plano anual de retención en la fuente."
        icon="retencion"
        actions={<ExportMenu filename="acumulados-retenciones" />}
      />
      <InfoStrip
        items={[
          { label: 'Última acumulación', value: fechaHora(state.acumuladosFecha) },
          { label: 'Terceros con retención', value: porTercero.length },
          { label: 'Base acumulada', value: money(totalBase) },
          { label: 'Retención acumulada', value: money(totalRet) },
        ]}
      />
      {desactualizada && (
        <div className="stale-alert" role="alert">
          <Badge tone="warning" icon="warn">Desactualizada</Badge>
          La acumulación tiene más de 7 días. Regénere los acumulados en la pestaña «Limpiar acumulados» para trabajar con cifras al día.
        </div>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'acumulacion', label: 'Acumulación general', icon: 'list' },
          { key: 'analisis', label: 'Análisis y certificados', icon: 'doc' },
          { key: 'relacion', label: 'Relación de acumulados', icon: 'libro' },
          { key: 'totales', label: 'Totales por cuenta', icon: 'plan' },
          { key: 'soportes', label: 'Soportes / anexos', icon: 'file' },
          { key: 'limpiar', label: 'Limpiar acumulados', icon: 'trash', badge: limpio ? 1 : 0 },
          { key: 'plano', label: 'Plano anual', icon: 'informe' },
          { key: 'certificados', label: 'Carga al portal', icon: 'upload' },
        ]}
      />

      {tab === 'acumulacion' && (
        <Card title="Acumulación por tercero" icon="terceros" pad>
          {porTercero.length === 0 ? (
            <EmptyState icon="list" title="Sin acumulados" detail="No hay líneas de clase RETENCION en los documentos y lotes actuales." />
          ) : (
            <div className="table-scroll">
              <table className="mini-table">
                <thead>
                  <tr><th>NIT</th><th>Tercero</th><th className="right">Base</th><th className="right">Retención acumulada</th><th className="right">Docs.</th></tr>
                </thead>
                <tbody>
                  {porTercero.map((t) => (
                    <tr key={t.nit}>
                      <td className="tnum">{nitFmt(t.nit)}</td>
                      <td>{t.nombre}</td>
                      <td className="right tnum">{money(t.base)}</td>
                      <td className="right tnum bold">{money(t.retencion)}</td>
                      <td className="right tnum">{t.docs}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={2}>Totales</td><td className="right tnum">{money(totalBase)}</td><td className="right tnum">{money(totalRet)}</td><td className="right tnum">{lineasRet.length}</td></tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'analisis' && (
        <div className="page-grid">
          <div className="col-6">
            <Card title="Por concepto de retención" icon="retencion">
              <div className="table-scroll">
                <table className="mini-table">
                  <thead>
                    <tr><th>Concepto</th><th className="right">Tarifa</th><th className="right">Base</th><th className="right">Retención</th></tr>
                  </thead>
                  <tbody>
                    {porConcepto.map((c) => (
                      <tr key={c.code}>
                        <td><b>{c.code}</b> — {c.nombre}</td>
                        <td className="right tnum">{c.tarifa.toLocaleString('es-CO')}%</td>
                        <td className="right tnum">{money(c.base)}</td>
                        <td className="right tnum">{money(c.retencion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          <div className="col-6">
            <Card
              title="Emisión de certificado"
              icon="doc"
              actions={<Button size="sm" icon="play" onClick={() => toast('success', 'Certificado emitido', 'Certificado de retención generado (simulado).')}>Emitir certificado</Button>}
            >
              <ReportPreview
                titulo="Certificado de retención en la fuente"
                company="001 — Compañía Demo S.A.S. · NIT 900.123.456-7"
                columns={CERT_COLS}
                rows={porConcepto.map((c) => [
                  { key: 'concepto', value: `${c.code} — ${c.nombre}` },
                  { key: 'base', value: c.base },
                  { key: 'tarifa', value: c.tarifa },
                  { key: 'retencion', value: c.retencion },
                ])}
                pageSize={8}
              />
            </Card>
          </div>
        </div>
      )}

      {tab === 'relacion' && (
        <Card title="Relación de acumulados por documento" icon="libro" pad>
          {relacion.length === 0 ? (
            <EmptyState icon="libro" title="Sin movimientos" detail="No hay documentos con retención acumulada." />
          ) : (
            <div className="table-scroll">
              <table className="mini-table">
                <thead>
                  <tr><th>Documento</th><th>Fecha</th><th>NIT</th><th>Tercero</th><th className="right">Base</th><th className="right">Retención</th></tr>
                </thead>
                <tbody>
                  {relacion.map((r, i) => (
                    <tr key={i}>
                      <td className="tnum">{r.documento}</td>
                      <td className="tnum">{fecha(r.fecha)}</td>
                      <td className="tnum">{nitFmt(r.nit)}</td>
                      <td>{r.nombre}</td>
                      <td className="right tnum">{money(r.base)}</td>
                      <td className="right tnum">{money(r.retencion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'totales' && (
        <Card title="Totales por cuenta — 236540 Retención por salarios" icon="plan">
          <div className="table-scroll">
            <table className="mini-table">
              <thead>
                <tr><th>Concepto</th><th className="right">Saldo inicial</th><th className="right">Débitos</th><th className="right">Créditos</th><th className="right">Saldo acumulado</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><b>236540</b> — Retención por salarios</td>
                  <td className="right tnum">{money(state.accounts.find((a) => a.code === '236540')?.saldoInicial ?? 0)}</td>
                  <td className="right tnum">{money(lineasRet.filter((l) => l.cuenta === '236540' && l.debito > 0).reduce((a, l) => a + l.debito, 0))}</td>
                  <td className="right tnum">{money(lineasRet.filter((l) => l.cuenta === '236540' && l.credito > 0).reduce((a, l) => a + l.credito, 0))}</td>
                  <td className="right tnum bold">
                    {money(
                      (state.accounts.find((a) => a.code === '236540')?.saldoInicial ?? 0) +
                        lineasRet.filter((l) => l.cuenta === '236540').reduce((a, l) => a + (l.credito - l.debito), 0),
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            El saldo de la cuenta contable es la fuente oficial. Los acumulados derivados se usan solo para la generación de certificados y el plano.
          </p>
        </Card>
      )}

      {tab === 'soportes' && (
        <Card title="Soportes y anexos" icon="file">
          <div className="stack gap-8">
            {[
              { icon: 'pdf', nombre: 'Certificados de retención 2025 (PDF)', detalle: '1,2 MB · generado 31/01/2026' },
              { icon: 'excel', nombre: 'Anexo de retenciones practicadas (XLSX)', detalle: '840 KB · generado 28/02/2026' },
              { icon: 'file', nombre: 'Resolución de tarifas y conceptos', detalle: '300 KB · cargado 15/01/2026' },
              { icon: 'file', nombre: 'Soportes de compras con retención (ZIP)', detalle: '6,4 MB · cargado 20/02/2026' },
            ].map((s) => (
              <div key={s.nombre} className="row gap-8 version-row">
                <Badge tone="outline" icon={s.icon}>Soporte</Badge>
                <span className="small bold grow">{s.nombre}</span>
                <span className="xs muted">{s.detalle}</span>
                <Button size="sm" variant="ghost" icon="download" onClick={() => toast('success', 'Descarga iniciada', `«${s.nombre}» se descargó (simulado).`)}>Descargar</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'limpiar' && (
        <Card title="Limpiar acumulados" icon="trash" tone={limpio ? 'warning' : undefined}>
          {limpio ? (
            <div className="stack gap-8">
              <p className="small">
                Los acumulados derivados fueron <b>eliminados</b>. El libro contable permanece intacto — las tablas de esta página se
                calcularán de nuevo al regenerar.
              </p>
              {regenerando ? (
                <div className="stack gap-8">
                  <LoadingState label="Regenerando acumulados desde el libro contable…" />
                </div>
              ) : (
                <div className="row gap-8">
                  <Button variant="primary" icon="refresh" onClick={regenerar}>Regenerar acumulados</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="stack gap-8">
              <p className="small">
                Esta acción <b>elimina los acumulados derivados</b> (los que alimentan certificados y el plano), <b>no el libro
                contable</b>. Puede regenerarlos cuando quiera desde el movimiento oficial.
              </p>
              <div className="row gap-8">
                <Button variant="danger" icon="trash" onClick={() => setConfirmOpen(true)}>Limpiar acumulados</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {tab === 'plano' && (
        <Card title="Plano anual de retenciones" icon="informe" actions={<ExportMenu filename="plano-anual-retenciones" />}>
          <ReportPreview
            titulo="Plano anual de retenciones en la fuente"
            columns={[
              { key: 'nit', label: 'NIT' },
              { key: 'tercero', label: 'Tercero' },
              { key: 'base', label: 'Base', align: 'right', money: true },
              { key: 'retencion', label: 'Retención', align: 'right', money: true },
            ]}
            rows={porTercero.map((t) => [
              { key: 'nit', value: nitFmt(t.nit) },
              { key: 'tercero', value: t.nombre },
              { key: 'base', value: t.base },
              { key: 'retencion', value: t.retencion },
            ])}
          />
        </Card>
      )}

      {tab === 'certificados' && (
        <div className="page-grid">
          <div className="col-6">
            <Card title="Carga manual de certificados al portal" icon="upload">
              <div className="stack gap-8">
                <label className="file-drop">
                  <input
                    type="file"
                    accept=".pdf,.xml"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) {
                        setCerts((c) => [...c, { nombre: f.name, nit: '900111222', anio: '2025', estado: 'PENDIENTE' }])
                        toast('info', 'Archivo adjunto', `«${f.name}» quedó listo para cargar al portal.`)
                      }
                    }}
                  />
                  <span className="file-drop-body">
                    <span className="bold">Adjuntar certificado (PDF/XML)</span>
                    <span className="xs muted">Haga clic para elegir el archivo…</span>
                  </span>
                </label>
                <Button variant="primary" icon="upload" loading={subiendo} disabled={certs.every((c) => c.estado === 'CARGADO')} onClick={subirCertificados}>
                  Cargar al portal DIAN
                </Button>
              </div>
            </Card>
          </div>
          <div className="col-6">
            <Card title="Certificados cargados" icon="list">
              {certs.length === 0 ? (
                <EmptyState icon="file" title="Sin certificados" detail="Adjunte certificados para cargarlos al portal." />
              ) : (
                <div className="stack gap-8">
                  {certs.map((c) => (
                    <div key={c.nombre} className="row gap-8 version-row">
                      <Badge tone={c.estado === 'CARGADO' ? 'success' : 'warning'} icon={c.estado === 'CARGADO' ? 'check' : 'clock'}>
                        {c.estado === 'CARGADO' ? 'Cargado' : 'Pendiente'}
                      </Badge>
                      <span className="small grow">{c.nombre}</span>
                      <span className="xs muted">NIT {nitFmt(c.nit)} · {c.anio}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={limpiarAcumulados}
        title="Limpiar acumulados de retención"
        danger
        confirmLabel="Sí, limpiar acumulados"
        message={
          <>
            Esta acción <b>elimina los acumulados derivados</b> (tablas de certificados y plano), <b>no el libro contable</b>.
            Puede regenerarlos cuando quiera desde el movimiento oficial. La operación quedará registrada en la bitácora.
          </>
        }
      />
    </div>
  )
}

const CERT_COLS: ReportColumn[] = [
  { key: 'concepto', label: 'Concepto' },
  { key: 'base', label: 'Base', align: 'right', money: true },
  { key: 'tarifa', label: 'Tarifa %', align: 'right' },
  { key: 'retencion', label: 'Retención', align: 'right', money: true },
]
