/* ============================================================
   CONTABDSI · Consolidación de compañías
   Compañías origen 002/003 → destino 001 (sólo consolidación).
   Asistente con compatibilidad, simulación, respaldo,
   confirmación de vaciado (DangerConfirmation), ejecución con
   bloqueo masivo, revalorización desde 00 y comparación.
   ============================================================ */

import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  LoadingState,
  NoPermissionState,
  PageHeader,
  ProgressBar,
  Switch,
} from '@/components/ui'
import { DangerConfirmation, InfoStrip, ProcessWizard, usePageTitle } from '@/components/accounting/Widgets'
import { useCan, useStore } from '@/state/AppStore'
import { money } from '@/core/format'

const COMPANIAS_ORIGEN = [
  { code: '002', nombre: 'Sucursal Norte', cuentas: 24, centros: 4, comprobantes: 2, movimientos: 88, compatibilidad: 94 },
  { code: '003', nombre: 'Sucursal Sur', cuentas: 21, centros: 3, comprobantes: 1, movimientos: 57, compatibilidad: 88 },
]

const PASOS_CON = [
  { key: 'origenes', label: 'Orígenes', icon: 'compania' },
  { key: 'compatibilidad', label: 'Compatibilidad', icon: 'plan' },
  { key: 'simulacion', label: 'Simulación', icon: 'eye' },
  { key: 'respaldo', label: 'Respaldo', icon: 'db' },
  { key: 'confirmacion', label: 'Confirmación', icon: 'warn' },
  { key: 'ejecucion', label: 'Ejecución', icon: 'play' },
  { key: 'revalorizar', label: 'Revalorizar desde 00', icon: 'refresh' },
  { key: 'comparar', label: 'Comparar totales', icon: 'check' },
]

const COMPARATIVO = [
  { clase: '1 — Activo', antes: 385000000, despues: 412300000 },
  { clase: '2 — Pasivo', antes: 195000000, despues: 208100000 },
  { clase: '3 — Patrimonio', antes: 120000000, despues: 120000000 },
  { clase: '4 — Ingresos', antes: 0, despues: 0 },
  { clase: '5 — Gastos', antes: 96500000, despues: 103800000 },
]

export function ConsolidacionPage() {
  usePageTitle('Consolidación')
  const { state, dispatch, toast, audit } = useStore()
  const puede = useCan('consolidacion.ejecutar')

  const [paso, setPaso] = useState('origenes')
  const [origenes, setOrigenes] = useState<Record<string, boolean>>({ '002': true, '003': false })
  const [soloConsolidacion, setSoloConsolidacion] = useState(false)
  const [respaldoC, setRespaldoC] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [ejecutando, setEjecutando] = useState(false)
  const [pct, setPct] = useState(0)
  const [pasoText, setPasoText] = useState('')
  const [ejecutado, setEjecutado] = useState(false)
  const [revalC, setRevalC] = useState(false)
  const [revalizando, setRevalizando] = useState(false)
  const [revalDone, setRevalDone] = useState(false)

  const pasoIdx = PASOS_CON.findIndex((s) => s.key === paso)
  const seleccionadas = COMPANIAS_ORIGEN.filter((c) => origenes[c.code])
  const destinoListo = soloConsolidacion && seleccionadas.length > 0

  const totales = useMemo(() => {
    const antes = COMPARATIVO.reduce((a, r) => a + r.antes, 0)
    const despues = COMPARATIVO.reduce((a, r) => a + r.despues, 0)
    return { antes, despues }
  }, [])

  const ejecutar = (motivo: string) => {
    setConfirmOpen(false)
    setEjecutando(true)
    dispatch({ type: 'SET_MASSIVE_LOCK', lock: { activo: true, proceso: 'Consolidación de compañías', usuario: state.session.user.nombre } })
    const pasos = [
      'Vaciando datos de la compañía destino…',
      'Insertando cuentas, centros y comprobantes origen…',
      'Insertando movimientos consolidados…',
      'Verificando cuadre por clase…',
      'Actualizando totalizadores…',
    ]
    let i = 0
    setPct(10)
    setPasoText(pasos[0])
    const iv = window.setInterval(() => {
      i += 1
      if (i < pasos.length) {
        setPct(10 + i * 18)
        setPasoText(pasos[i])
      } else {
        window.clearInterval(iv)
        setPct(100)
        window.setTimeout(() => {
          dispatch({ type: 'SET_MASSIVE_LOCK', lock: null })
          setEjecutando(false)
          setEjecutado(true)
          audit('Consolidación de compañías', 'Consolidación', `${seleccionadas.map((c) => c.code).join(', ')} → 001. Motivo: ${motivo}`, 'EXITO')
          toast('success', 'Consolidación ejecutada', 'La compañía 001 quedó consolidada con los orígenes seleccionados (simulado).')
        }, 400)
      }
    }, 550)
  }

  const revalorizar = () => {
    setRevalizando(true)
    window.setTimeout(() => {
      setRevalizando(false)
      setRevalDone(true)
      audit('Revalorización desde 00', 'Consolidación', 'Compañía 001 revalorizada desde 00 tras la consolidación', 'EXITO')
      toast('success', 'Revalorización completada', 'La compañía 001 se revalorizó desde 00 (simulado).')
    }, 1500)
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Consolidación" subtitle="Consolidación de compañías" icon="consolidar" />
        <NoPermissionState perm="consolidacion.ejecutar" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Consolidación"
        subtitle="Consolide las sucursales en la compañía 001. La compañía destino se vacía y se reemplaza."
        icon="consolidar"
        badge={<Badge tone="brand" icon="consolidar">{seleccionadas.length} origen(es)</Badge>}
      />

      <Card tone="warning" icon="warn" title="Alcance de esta consolidación">
        <span className="small">
          <b>No incluye eliminación intercompañía ni conversión de moneda.</b> Solo reemplaza cuentas, centros, comprobantes y
          movimientos en la compañía destino.
        </span>
      </Card>

      <Card title="Definición de compañías" icon="compania">
        <div className="table-scroll">
          <table className="mini-table">
            <thead>
              <tr><th>Compañía</th><th>Rol</th><th>Cuentas</th><th>Centros</th><th className="right">Movimientos</th><th /></tr>
            </thead>
            <tbody>
              <tr>
                <td><b className="tnum">001</b> — Compañía Demo S.A.S.</td>
                <td><Badge tone="brand">Destino</Badge></td>
                <td className="tnum">26</td>
                <td className="tnum">6</td>
                <td className="right tnum">145</td>
                <td>
                  <Switch
                    checked={soloConsolidacion}
                    onChange={(v) => { setSoloConsolidacion(v); setPaso('origenes') }}
                    label={<span className="small bold">Sólo consolidación</span>}
                  />
                </td>
              </tr>
              {COMPANIAS_ORIGEN.map((c) => (
                <tr key={c.code}>
                  <td><b className="tnum">{c.code}</b> — {c.nombre}</td>
                  <td><Badge tone="info">Origen</Badge></td>
                  <td className="tnum">{c.cuentas}</td>
                  <td className="tnum">{c.centros}</td>
                  <td className="right tnum">{c.movimientos}</td>
                  <td>
                    <Checkbox
                      checked={Boolean(origenes[c.code])}
                      onChange={(v) => setOrigenes((o) => ({ ...o, [c.code]: v }))}
                      label="Incluir"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!destinoListo && (
          <p className="small neg" style={{ marginTop: 8 }}>
            El destino 001 debe estar marcado como «Sólo consolidación» y al menos un origen seleccionado para continuar.
          </p>
        )}
      </Card>

      <ProcessWizard
        steps={PASOS_CON.map((s, i) => ({
          ...s,
          done: i < pasoIdx,
          disabled:
            (s.key !== 'origenes' && !destinoListo) ||
            (s.key === 'ejecucion' && !respaldoC) ||
            (s.key === 'revalorizar' && !ejecutado) ||
            (s.key === 'comparar' && !revalDone),
        }))}
        active={paso}
        onSelect={setPaso}
      >
        {paso === 'origenes' && (
          <div className="stack gap-12">
            <InfoStrip
              items={[
                { label: 'Destino', value: '001 — Compañía Demo S.A.S.' },
                { label: 'Orígenes seleccionados', value: seleccionadas.length === 0 ? 'Ninguno' : seleccionadas.map((c) => `${c.code} ${c.nombre}`).join(', ') },
                { label: 'Movimientos a consolidar', value: seleccionadas.reduce((a, c) => a + c.movimientos, 0) },
              ]}
            />
            <p className="small muted">
              Al consolidar, la compañía destino se <b>vacía</b> y se reemplaza con los datos de los orígenes seleccionados.
            </p>
            <div className="row gap-8">
              <Button variant="primary" iconRight="chevronR" disabled={!destinoListo} onClick={() => setPaso('compatibilidad')}>Continuar</Button>
            </div>
          </div>
        )}

        {paso === 'compatibilidad' && (
          <div className="stack gap-12">
            <p className="small">Porcentaje del plan de cuentas común entre cada origen y el destino.</p>
            <div className="stack gap-8">
              {COMPANIAS_ORIGEN.filter((c) => origenes[c.code]).map((c) => (
                <div key={c.code} className="stack gap-4">
                  <div className="row gap-8">
                    <span className="small bold grow">{c.code} — {c.nombre}</span>
                    <Badge tone={c.compatibilidad >= 90 ? 'success' : 'warning'}>{c.compatibilidad}% común</Badge>
                  </div>
                  <ProgressBar pct={c.compatibilidad} tone={c.compatibilidad >= 90 ? 'success' : 'warning'} label={`Compatibilidad ${c.code}`} />
                  {c.compatibilidad < 90 && <span className="xs warning-note muted">El plan difiere: se crearán las cuentas faltantes en el destino.</span>}
                </div>
              ))}
            </div>
            <div className="row gap-8">
              <Button onClick={() => setPaso('origenes')} icon="chevronL">Atrás</Button>
              <Button variant="primary" iconRight="chevronR" onClick={() => setPaso('simulacion')}>Continuar</Button>
            </div>
          </div>
        )}

        {paso === 'simulacion' && (
          <div className="stack gap-12">
            <p className="small">
              La consolidación <b>reemplazará cuentas, centros, comprobantes y movimientos</b> de la compañía 001:
            </p>
            <div className="table-scroll">
              <table className="mini-table">
                <thead>
                  <tr><th>Elemento</th><th className="right">Existente en 001</th><th className="right">Tras consolidar</th><th className="right">Diferencia</th></tr>
                </thead>
                <tbody>
                  {[
                    { el: 'Cuentas del plan', antes: 26, despues: 29 },
                    { el: 'Centros de costo', antes: 6, despues: 9 },
                    { el: 'Comprobantes', antes: 2, despues: 4 },
                    { el: 'Movimientos contables', antes: 145, despues: 290 },
                  ].map((r) => (
                    <tr key={r.el}>
                      <td>{r.el}</td>
                      <td className="right tnum">{r.antes}</td>
                      <td className="right tnum">{r.despues}</td>
                      <td className="right tnum pos">+{r.despues - r.antes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row gap-8">
              <Button onClick={() => setPaso('compatibilidad')} icon="chevronL">Atrás</Button>
              <Button variant="primary" iconRight="chevronR" onClick={() => setPaso('respaldo')}>Continuar</Button>
            </div>
          </div>
        )}

        {paso === 'respaldo' && (
          <div className="stack gap-12">
            <div className="check-row" style={{ borderColor: respaldoC ? 'var(--success-600)' : undefined }}>
              <Checkbox checked={respaldoC} onChange={setRespaldoC} label={<b className="small">He realizado el respaldo completo de las compañías origen y destino (obligatorio)</b>} />
            </div>
            <p className="xs muted">El respaldo es prerrequisito de la confirmación de vaciado.</p>
            <div className="row gap-8">
              <Button onClick={() => setPaso('simulacion')} icon="chevronL">Atrás</Button>
              <Button variant="primary" iconRight="chevronR" disabled={!respaldoC} onClick={() => setPaso('confirmacion')}>Continuar</Button>
            </div>
          </div>
        )}

        {paso === 'confirmacion' && (
          <div className="stack gap-12">
            <p className="small">
              El siguiente paso <b>vacía la compañía 001</b> y la reemplaza con los orígenes. Requiere confirmación escrita.
            </p>
            <div className="row gap-8">
              <Button onClick={() => setPaso('respaldo')} icon="chevronL">Atrás</Button>
              <Button variant="danger" icon="warn" onClick={() => setConfirmOpen(true)}>Abrir confirmación de vaciado</Button>
            </div>
          </div>
        )}

        {paso === 'ejecucion' && (
          <div className="stack gap-12">
            {ejecutando ? (
              <div className="stack gap-8">
                <LoadingState label={pasoText || 'Ejecutando consolidación…'} />
                <ProgressBar pct={pct} tone="success" label="Progreso de consolidación" />
                <p className="xs muted">Bloqueo masivo activo: la compañía queda bloqueada para captura y contabilización.</p>
              </div>
            ) : ejecutado ? (
              <div className="stack gap-8">
                <Badge tone="success" icon="check">Consolidación ejecutada</Badge>
                <div className="row gap-8">
                  <Button variant="primary" iconRight="chevronR" onClick={() => setPaso('revalorizar')}>Continuar a revalorización</Button>
                </div>
              </div>
            ) : (
              <div className="row gap-8">
                <Button onClick={() => setPaso('confirmacion')} icon="chevronL">Atrás</Button>
                <Button variant="danger" icon="warn" onClick={() => setConfirmOpen(true)}>Confirmar y ejecutar vaciado</Button>
              </div>
            )}
          </div>
        )}

        {paso === 'revalorizar' && (
          <div className="stack gap-12">
            <p className="small">
              Paso obligatorio: revalorizar la compañía consolidada <b>desde 00</b> para reconstruir saldos históricos.
            </p>
            <div className="check-row" style={{ borderColor: revalC ? 'var(--success-600)' : undefined }}>
              <Checkbox checked={revalC} onChange={setRevalC} label={<b className="small">Comprendo que la revalorización desde 00 es obligatoria</b>} />
            </div>
            {revalizando ? (
              <LoadingState label="Revalorizando desde 00…" />
            ) : revalDone ? (
              <div className="row gap-8">
                <Badge tone="success" icon="check">Revalorización completada</Badge>
                <Button variant="primary" iconRight="chevronR" onClick={() => setPaso('comparar')}>Comparar totales</Button>
              </div>
            ) : (
              <Button variant="primary" icon="refresh" disabled={!revalC} onClick={revalorizar}>Revalorizar desde 00</Button>
            )}
          </div>
        )}

        {paso === 'comparar' && (
          <div className="stack gap-12">
            <p className="small">Comparación de totales por clase antes y después de la consolidación.</p>
            <div className="table-scroll">
              <table className="mini-table">
                <thead>
                  <tr><th>Clase</th><th className="right">Antes</th><th className="right">Después</th><th className="right">Diferencia</th></tr>
                </thead>
                <tbody>
                  {COMPARATIVO.map((r) => (
                    <tr key={r.clase}>
                      <td className="bold">{r.clase}</td>
                      <td className="right tnum">{money(r.antes)}</td>
                      <td className="right tnum">{money(r.despues)}</td>
                      <td className="right tnum pos">{money(r.despues - r.antes)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Totales</td>
                    <td className="right tnum">{money(totales.antes)}</td>
                    <td className="right tnum">{money(totales.despues)}</td>
                    <td className="right tnum pos">{money(totales.despues - totales.antes)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="row gap-8">
              <Badge tone="success" icon="check">Cuadra</Badge>
              <span className="xs muted">La suma de los orígenes coincide con la variación de la compañía consolidada.</span>
            </div>
          </div>
        )}
      </ProcessWizard>

      <Card title="Ajustes futuros" icon="clock" className="future-card" actions={<Badge tone="info" icon="star">Futuro</Badge>}>
        <p className="small muted">
          En una próxima versión: <b>eliminación intercompañía</b>, <b>conversión de moneda</b> y estados financieros
          consolidados. Esta sección queda reservada.
        </p>
      </Card>

      <DangerConfirmation
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={ejecutar}
        title="Vaciado y consolidación de la compañía 001"
        descripcion="Se vaciarán las cuentas, centros, comprobantes y movimientos de la compañía 001 y se reemplazarán con los datos consolidados de los orígenes seleccionados. Operación irreversible."
        tablasAfectadas={['Cuentas', 'Centros de costo', 'Comprobantes', 'Movimientos contables', 'Saldos']}
        confirmText="VACIAR Y CONSOLIDAR"
        confirmLabel="Vaciar y consolidar"
        simulacion={[
          { descripcion: 'Orígenes', valor: seleccionadas.map((c) => c.code).join(', ') || '—' },
          { descripcion: 'Movimientos a insertar', valor: seleccionadas.reduce((a, c) => a + c.movimientos, 0) },
          { descripcion: 'Revalorización desde 00', valor: 'Obligatoria después de ejecutar' },
        ]}
      />
    </div>
  )
}
