/* ============================================================
   CONTABDSI · Impuesto a las ventas (IVA)
   Acumulación por tarifa (generado / descontable), análisis,
   certificados, totales por cuenta 240805, soportes y limpieza
   de acumulados.
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
import { fechaHora, money } from '@/core/format'
import type { ReportColumn } from '@/core/types'

export function IVAPage() {
  usePageTitle('IVA')
  const { state, dispatch, toast, audit } = useStore()
  const puede = useCan('impuestos.iva')

  const [tab, setTab] = useState('acumulacion')
  const [limpio, setLimpio] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [regenerando, setRegenerando] = useState(false)

  const lineasIva = useMemo(() => {
    const src = [...state.documentos.flatMap((d) => d.lineas), ...state.lotes.flatMap((l) => l.lineas)]
    return src.filter((l) => l.clase === 'IVA')
  }, [state.documentos, state.lotes])

  const desactualizada = useMemo(() => {
    const t = new Date(state.acumuladosFecha).getTime()
    return Date.now() - t > 7 * 24 * 60 * 60 * 1000
  }, [state.acumuladosFecha])

  const porTarifa = useMemo(() => {
    const map = new Map<number, { tarifa: number; base: number; descontable: number; generado: number; docs: number }>()
    for (const l of lineasIva) {
      const monto = Math.max(l.debito, l.credito)
      const tarifa = l.base > 0 ? Math.round((monto / l.base) * 100) : 0
      const cur = map.get(tarifa) ?? { tarifa, base: 0, descontable: 0, generado: 0, docs: 0 }
      cur.base += l.base
      if (l.debito > 0) cur.descontable += l.debito
      if (l.credito > 0) cur.generado += l.credito
      cur.docs += 1
      map.set(tarifa, cur)
    }
    const filas = state.tarifasIVA.map((t) => ({
      code: t.code,
      nombre: t.nombre,
      tarifa: t.tarifa,
      ...(map.get(t.tarifa) ?? { base: 0, descontable: 0, generado: 0, docs: 0 }),
    }))
    return filas
  }, [lineasIva, state.tarifasIVA])

  const totalBase = porTarifa.reduce((a, t) => a + t.base, 0)
  const totalDesc = porTarifa.reduce((a, t) => a + t.descontable, 0)
  const totalGen = porTarifa.reduce((a, t) => a + t.generado, 0)

  const regen = () => {
    setRegenerando(true)
    window.setTimeout(() => {
      dispatch({ type: 'REGEN_ACUMULADOS' })
      setRegenerando(false)
      setLimpio(false)
      audit('Regeneración de acumulados', 'IVA', 'Acumulados de IVA regenerados desde el libro contable', 'EXITO')
      toast('success', 'Acumulados regenerados', 'Los acumulados de IVA se recalcularon desde el libro contable (simulado).')
    }, 1400)
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="IVA" subtitle="Impuesto a las ventas" icon="iva" />
        <NoPermissionState perm="impuestos.iva" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="IVA"
        subtitle="Acumulación de IVA generado y descontable por tarifa, análisis, certificados y soportes."
        icon="iva"
        actions={<ExportMenu filename="acumulados-iva" />}
      />
      <InfoStrip
        items={[
          { label: 'Última acumulación', value: fechaHora(state.acumuladosFecha) },
          { label: 'Base gravada', value: money(totalBase) },
          { label: 'IVA descontable', value: money(totalDesc) },
          { label: 'IVA generado', value: money(totalGen) },
        ]}
      />
      {desactualizada && (
        <div className="stale-alert" role="alert">
          <Badge tone="warning" icon="warn">Desactualizada</Badge>
          La acumulación de IVA tiene más de 7 días. Regénere los acumulados en la pestaña «Limpiar acumulados».
        </div>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'acumulacion', label: 'Acumulación general', icon: 'list' },
          { key: 'analisis', label: 'Análisis', icon: 'trendUp' },
          { key: 'certificados', label: 'Certificados', icon: 'doc' },
          { key: 'totales', label: 'Totales por cuenta', icon: 'plan' },
          { key: 'soportes', label: 'Soportes / anexos', icon: 'file' },
          { key: 'limpiar', label: 'Limpiar acumulados', icon: 'trash', badge: limpio ? 1 : 0 },
        ]}
      />

      {tab === 'acumulacion' && (
        <Card title="Acumulación por tarifa" icon="iva" pad>
          {porTarifa.every((t) => t.base === 0) ? (
            <EmptyState icon="list" title="Sin acumulados de IVA" detail="No hay líneas de clase IVA en los documentos y lotes actuales." />
          ) : (
            <div className="table-scroll">
              <table className="mini-table">
                <thead>
                  <tr><th>Tarifa</th><th>Concepto</th><th className="right">Base</th><th className="right">IVA descontable</th><th className="right">IVA generado</th><th className="right">Docs.</th></tr>
                </thead>
                <tbody>
                  {porTarifa.map((t) => (
                    <tr key={t.code}>
                      <td className="tnum bold">{t.tarifa}%</td>
                      <td>{t.nombre}</td>
                      <td className="right tnum">{money(t.base)}</td>
                      <td className="right tnum">{money(t.descontable)}</td>
                      <td className="right tnum">{money(t.generado)}</td>
                      <td className="right tnum">{t.docs}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={2}>Totales</td><td className="right tnum">{money(totalBase)}</td><td className="right tnum">{money(totalDesc)}</td><td className="right tnum">{money(totalGen)}</td><td className="right tnum">{lineasIva.length}</td></tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="small muted" style={{ marginTop: 8 }}>
            El IVA descontable proviene de las compras (débito a 240805) y el generado de las ventas (crédito a 240805).
          </p>
        </Card>
      )}

      {tab === 'analisis' && (
        <div className="page-grid">
          <div className="col-6">
            <Card title="Participación por tarifa" icon="trendUp">
              <div className="stack gap-8">
                {porTarifa.map((t) => {
                  const pct = totalBase > 0 ? (t.base / totalBase) * 100 : 0
                  return (
                    <div key={t.code} className="stack gap-4">
                      <div className="row gap-8">
                        <span className="small bold grow">{t.tarifa}% — {t.nombre}</span>
                        <span className="small tnum">{money(t.base)}</span>
                      </div>
                      <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                        <div className="progress-fill progress-brand" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="xs muted" style={{ marginTop: 10 }}>
                El IVA excluido (tarifa 0%) no genera impuesto descontable pero sí base informativa.
              </p>
            </Card>
          </div>
          <div className="col-6">
            <Card title="Movimiento del período" icon="libro">
              <div className="table-scroll">
                <table className="mini-table">
                  <thead>
                    <tr><th>Documento</th><th>Cuenta</th><th className="right">Débito</th><th className="right">Crédito</th></tr>
                  </thead>
                  <tbody>
                    {lineasIva.map((l) => (
                      <tr key={l.id}>
                        <td className="tnum">{l.documento}</td>
                        <td className="tnum">{l.cuenta}</td>
                        <td className="right tnum">{money(l.debito)}</td>
                        <td className="right tnum">{money(l.credito)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'certificados' && (
        <Card title="Certificado de IVA del período" icon="doc" actions={
          <>
            <ExportMenu filename="certificado-iva" />
            <Button size="sm" icon="play" onClick={() => toast('success', 'Certificado emitido', 'Certificado de IVA generado (simulado).')}>Emitir</Button>
          </>
        }>
          <ReportPreview
            titulo="Certificado de IVA — resumen por tarifa"
            columns={CERT_IVA_COLS}
            rows={porTarifa.map((t) => [
              { key: 'tarifa', value: `${t.tarifa}%` },
              { key: 'base', value: t.base },
              { key: 'descontable', value: t.descontable },
              { key: 'generado', value: t.generado },
            ])}
            pageSize={8}
          />
        </Card>
      )}

      {tab === 'totales' && (
        <Card title="Totales por cuenta — 240805 IVA Generado" icon="plan">
          <div className="table-scroll">
            <table className="mini-table">
              <thead>
                <tr><th>Concepto</th><th className="right">Saldo inicial</th><th className="right">Débitos</th><th className="right">Créditos</th><th className="right">Saldo acumulado</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><b>240805</b> — IVA Generado</td>
                  <td className="right tnum">{money(state.accounts.find((a) => a.code === '240805')?.saldoInicial ?? 0)}</td>
                  <td className="right tnum">{money(lineasIva.filter((l) => l.cuenta === '240805').reduce((a, l) => a + l.debito, 0))}</td>
                  <td className="right tnum">{money(lineasIva.filter((l) => l.cuenta === '240805').reduce((a, l) => a + l.credito, 0))}</td>
                  <td className="right tnum bold">
                    {money(
                      (state.accounts.find((a) => a.code === '240805')?.saldoInicial ?? 0) +
                        lineasIva.filter((l) => l.cuenta === '240805').reduce((a, l) => a + (l.debito - l.credito), 0),
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'soportes' && (
        <Card title="Soportes y anexos" icon="file">
          <div className="stack gap-8">
            {[
              { icon: 'excel', nombre: 'Auxiliar de IVA por tarifa (XLSX)', detalle: '540 KB · generado 28/02/2026' },
              { icon: 'pdf', nombre: 'Certificados de IVA 2025 (PDF)', detalle: '980 KB · generado 31/01/2026' },
              { icon: 'file', nombre: 'Facturas electrónicas del período (ZIP)', detalle: '12,8 MB · cargado 25/02/2026' },
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
                Los acumulados derivados fueron <b>eliminados</b>. El libro contable permanece intacto.
              </p>
              {regenerando ? (
                <LoadingState label="Regenerando acumulados de IVA…" />
              ) : (
                <div className="row gap-8">
                  <Button variant="primary" icon="refresh" onClick={regen}>Regenerar acumulados</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="stack gap-8">
              <p className="small">
                Esta acción <b>elimina los acumulados derivados</b>, <b>no el libro contable</b>. Puede regenerarlos cuando quiera.
              </p>
              <div className="row gap-8">
                <Button variant="danger" icon="trash" onClick={() => setConfirmOpen(true)}>Limpiar acumulados</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          setLimpio(true)
          audit('Limpieza de acumulados', 'IVA', 'Acumulados de IVA derivados eliminados (el libro no se toca)', 'EXITO')
          toast('warning', 'Acumulados limpiados', 'Se eliminaron los acumulados derivados de IVA. El libro contable permanece intacto.')
        }}
        title="Limpiar acumulados de IVA"
        danger
        confirmLabel="Sí, limpiar acumulados"
        message={
          <>
            Esta acción <b>elimina los acumulados derivados</b> de IVA, <b>no el libro contable</b>. Puede regenerarlos cuando quiera
            desde el movimiento oficial. La operación quedará registrada en la bitácora.
          </>
        }
      />
    </div>
  )
}

const CERT_IVA_COLS: ReportColumn[] = [
  { key: 'tarifa', label: 'Tarifa' },
  { key: 'base', label: 'Base gravada', align: 'right', money: true },
  { key: 'descontable', label: 'IVA descontable', align: 'right', money: true },
  { key: 'generado', label: 'IVA generado', align: 'right', money: true },
]
