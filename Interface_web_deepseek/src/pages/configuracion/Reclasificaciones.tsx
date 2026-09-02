/* ============================================================
   CONTABDSI · Configuración → Reclasificaciones
   Requiere permiso: config.reclasificaciones
   Genera lotes de reclasificación (BORRADOR) desde simulaciones.
   ============================================================ */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  NoPermissionState,
  PageHeader,
  Select,
  Tabs,
} from '@/components/ui'
import { usePageTitle } from '@/components/accounting/Widgets'
import { AccountPicker, CostCenterPicker, ThirdPartyPicker, VoucherPicker } from '@/components/accounting/Combobox'
import { useCan, useStore } from '@/state/AppStore'
import { makeLinea } from '@/data/mock'
import { money } from '@/core/format'
import type { LineaMovimiento, Lote } from '@/core/types'

interface SimResult {
  origen: { descripcion: string; valor: string | number }[]
  lineas: LineaMovimiento[]
  resumen: string
}

const TABLA_EMPTY: SimResult = { origen: [], lineas: [], resumen: '' }

export function ReclasificacionesPage() {
  usePageTitle('Reclasificaciones')
  const { state, dispatch, toast, audit } = useStore()
  const puede = useCan('config.reclasificaciones')
  const [tab, setTab] = useState('cuenta-documento')

  // Parámetros comunes
  const [cuenta, setCuenta] = useState('')
  const [documento, setDocumento] = useState('')
  const [comprobante, setComprobante] = useState('')
  const [terceroActual, setTerceroActual] = useState('')
  const [terceroNuevo, setTerceroNuevo] = useState('')
  const [centroOrigen, setCentroOrigen] = useState('')
  const [centroDestino, setCentroDestino] = useState('')
  const [nivel, setNivel] = useState('4')
  const [mes, setMes] = useState('02')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [sim, setSim] = useState<SimResult | null>(null)
  const [loteGenerado, setLoteGenerado] = useState<string | null>(null)

  const totales = useMemo(() => {
    if (!sim) return { debito: 0, credito: 0 }
    return {
      debito: sim.lineas.reduce((a, l) => a + l.debito, 0),
      credito: sim.lineas.reduce((a, l) => a + l.credito, 0),
    }
  }, [sim])

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Reclasificaciones" icon="reclasificar" />
        <Card><NoPermissionState perm="config.reclasificaciones" /></Card>
      </div>
    )
  }

  const lineasDe = (f: (l: LineaMovimiento) => boolean): LineaMovimiento[] => {
    const docs = state.documentos.flatMap((d) => d.lineas).filter(f)
    const lotes = state.lotes.filter((l) => l.estado !== 'CONTABILIZADO').flatMap((l) => l.lineas).filter(f)
    return [...docs, ...lotes]
  }

  const simular = () => {
    if (tab === 'cuenta-documento') {
      if (!cuenta || !documento.trim() || !centroOrigen || !centroDestino) {
        toast('error', 'Parámetros incompletos', 'Cuenta, documento, centro origen y centro destino son obligatorios.')
        return
      }
      const origen = lineasDe((l) => l.cuenta === cuenta && l.documento === documento.trim() && l.centro === centroOrigen)
      const lineas = origen.map((l) =>
        makeLinea({
          cuenta: l.cuenta,
          nit: l.nit,
          centro: centroDestino,
          comprobante: l.comprobante,
          documento: l.documento,
          fecha: l.fecha,
          debito: l.credito,
          credito: l.debito,
          base: l.base,
          clase: l.clase,
          concepto: `Reclasificación cuenta-documento a centro ${centroDestino} (origen ${l.centro})`,
          origen: 'RECLASIFICACION',
        }),
      )
      setSim({ origen: origen.map((l) => ({ descripcion: `${l.documento} · ${l.cuenta} · ${l.centro}`, valor: money(l.debito || l.credito) })), lineas, resumen: `${origen.length} línea(s) encontrada(s) para reclasificar.` })
      return
    }
    if (tab === 'comprobante-doc-tercero') {
      if (!comprobante || !documento.trim() || !terceroActual || !terceroNuevo) {
        toast('error', 'Parámetros incompletos', 'Comprobante, documento, tercero actual y tercero nuevo son obligatorios.')
        return
      }
      const origen = lineasDe((l) => l.comprobante === comprobante && l.documento === documento.trim() && l.nit === terceroActual)
      const lineas = origen.map((l) =>
        makeLinea({
          cuenta: l.cuenta,
          nit: terceroNuevo,
          centro: l.centro,
          comprobante: l.comprobante,
          documento: l.documento,
          fecha: l.fecha,
          debito: l.credito,
          credito: l.debito,
          base: l.base,
          clase: l.clase,
          concepto: `Reclasificación ${l.comprobante}-${l.documento} tercero ${terceroActual} → ${terceroNuevo}`,
          origen: 'RECLASIFICACION',
        }),
      )
      setSim({ origen: origen.map((l) => ({ descripcion: `${l.comprobante}-${l.documento} · ${l.cuenta} · ${l.nit}`, valor: money(l.debito || l.credito) })), lineas, resumen: `${origen.length} línea(s) encontrada(s).` })
      return
    }
    if (tab === 'centro-cuenta') {
      if (!cuenta || !centroOrigen || !centroDestino) {
        toast('error', 'Parámetros incompletos', 'Cuenta, centro origen y centro destino son obligatorios.')
        return
      }
      const origen = lineasDe((l) => l.cuenta === cuenta && l.centro === centroOrigen)
      const lineas = origen.map((l) =>
        makeLinea({
          cuenta: l.cuenta, nit: l.nit, centro: centroDestino, comprobante: l.comprobante, documento: l.documento, fecha: l.fecha,
          debito: l.credito, credito: l.debito, base: l.base, clase: l.clase,
          concepto: `Reclasificación de centro por cuenta ${cuenta}: ${centroOrigen} → ${centroDestino}`,
          origen: 'RECLASIFICACION',
        }),
      )
      setSim({ origen: origen.map((l) => ({ descripcion: `${l.documento} · ${l.centro}`, valor: money(l.debito || l.credito) })), lineas, resumen: `${origen.length} línea(s) del centro ${centroOrigen} en la cuenta ${cuenta}.` })
      return
    }
    if (tab === 'analizar-plan') {
      const cuentas = state.accounts.filter((a) => a.nivel === Number(nivel))
      const lineas = cuentas.map((a) =>
        makeLinea({
          cuenta: a.code, centro: '', comprobante: 'NI', documento: `ANALISIS-PLAN-N${nivel}`, fecha: '2026-02-28',
          debito: 0, credito: 0,
          concepto: `Análisis plan nivel ${nivel}: ${a.nombre} (${a.afectable ? 'afectable' : 'no afectable'}, ${a.movimiento ? 'con movimiento' : 'sin movimiento'})`,
          origen: 'RECLASIFICACION',
        }),
      )
      setSim({
        origen: cuentas.map((a) => ({ descripcion: `${a.code} — ${a.nombre}`, valor: `${hijosDe(a.code)} hijos` })),
        lineas,
        resumen: `${cuentas.length} cuentas de nivel ${nivel} analizadas.`,
      })
      return
    }
    if (tab === 'analizar-movimiento') {
      const cuentas = state.accounts.filter((a) => {
        if (desde && a.code < desde) return false
        if (hasta && a.code > hasta) return false
        const idx = Number(mes) - 1
        return a.movimiento && (a.meses[idx] ?? 0) !== 0
      })
      const idx = Number(mes) - 1
      const lineas = cuentas.map((a) =>
        makeLinea({
          cuenta: a.code, centro: '', comprobante: 'NI', documento: `ANALISIS-MES-${mes}`, fecha: '2026-02-28',
          debito: a.meses[idx] ?? 0, credito: 0,
          concepto: `Análisis de movimiento mes ${mes}: ${a.nombre}`,
          origen: 'RECLASIFICACION',
        }),
      )
      setSim({
        origen: cuentas.map((a) => ({ descripcion: `${a.code} — ${a.nombre}`, valor: money(a.meses[idx] ?? 0) })),
        lineas,
        resumen: `${cuentas.length} cuenta(s) con movimiento en el mes ${mes}.`,
      })
      return
    }
    setSim(TABLA_EMPTY)
  }

  const hijosDe = (code: string) => state.accounts.filter((a) => a.parent === code).length

  const generarLote = () => {
    if (!sim || sim.lineas.length === 0) {
      toast('error', 'Sin líneas', 'Ejecute la simulación antes de generar el lote.')
      return
    }
    const codigo = `REC-${Date.now().toString(36).slice(-5).toUpperCase()}`
    const lote: Lote = {
      codigo,
      nombre: `Reclasificación ${TAB_TITULO[tab] ?? ''}`,
      periodo: `${state.session.year}${String(state.session.period).padStart(2, '0')}`,
      usuario: state.session.user.nombre,
      origen: 'RECLASIFICACION',
      fecha: '2026-02-28',
      lineas: sim.lineas,
      estado: 'BORRADOR',
      issues: [],
      audit: [],
    }
    dispatch({ type: 'ADD_LOTE', lote })
    setLoteGenerado(codigo)
    toast('success', 'Lote de reclasificación generado', `Lote ${codigo} creado en estado BORRADOR con ${sim.lineas.length} líneas.`)
    audit('Generación de lote de reclasificación', 'Reclasificaciones', `${TAB_TITULO[tab] ?? tab} → lote ${codigo} (${sim.lineas.length} líneas)`)
  }

  return (
    <div className="page">
      <PageHeader
        title="Reclasificaciones"
        subtitle="Generación de lotes de reclasificación · permiso config.reclasificaciones"
        icon="reclasificar"
      />

      <Tabs
        active={tab}
        onChange={(k) => { setTab(k); setSim(null); setLoteGenerado(null) }}
        tabs={[
          { key: 'cuenta-documento', label: 'Cuenta-documento a centro', icon: 'reclasificar' },
          { key: 'comprobante-doc-tercero', label: 'Comprobante-documento-tercero', icon: 'terceros' },
          { key: 'centro-cuenta', label: 'Centro por cuenta', icon: 'centro' },
          { key: 'analizar-plan', label: 'Analizar plan por nivel', icon: 'plan' },
          { key: 'analizar-movimiento', label: 'Movimiento de cuentas por mes', icon: 'lupa' },
        ]}
      />

      <Card title={TAB_TITULO[tab] ?? 'Reclasificación'} icon="reclasificar">
        <div className="stack gap-12">
          <div className="querybar">
            {tab === 'cuenta-documento' && (
              <>
                <Field label="Cuenta" width={170}><AccountPicker value={cuenta} onChange={setCuenta} /></Field>
                <Field label="Documento" width={180}><Input value={documento} onChange={setDocumento} placeholder="CE-2026-02-018" monospace /></Field>
                <Field label="Centro origen" width={160}><CostCenterPicker value={centroOrigen} onChange={setCentroOrigen} /></Field>
                <Field label="Centro destino" width={160}><CostCenterPicker value={centroDestino} onChange={setCentroDestino} /></Field>
              </>
            )}
            {tab === 'comprobante-doc-tercero' && (
              <>
                <Field label="Comprobante" width={150}><VoucherPicker value={comprobante} onChange={setComprobante} /></Field>
                <Field label="Documento" width={180}><Input value={documento} onChange={setDocumento} placeholder="CE-2026-02-018" monospace /></Field>
                <Field label="Tercero actual" width={170}><ThirdPartyPicker value={terceroActual} onChange={setTerceroActual} /></Field>
                <Field label="Tercero nuevo" width={170}><ThirdPartyPicker value={terceroNuevo} onChange={setTerceroNuevo} /></Field>
              </>
            )}
            {tab === 'centro-cuenta' && (
              <>
                <Field label="Cuenta" width={170}><AccountPicker value={cuenta} onChange={setCuenta} /></Field>
                <Field label="Centro origen" width={160}><CostCenterPicker value={centroOrigen} onChange={setCentroOrigen} /></Field>
                <Field label="Centro destino" width={160}><CostCenterPicker value={centroDestino} onChange={setCentroDestino} /></Field>
              </>
            )}
            {tab === 'analizar-plan' && (
              <Field label="Nivel del plan" width={170}>
                <Select value={nivel} onChange={setNivel} options={[1, 2, 4, 6, 9, 12].map((n) => ({ value: String(n), label: `Nivel ${n}` }))} />
              </Field>
            )}
            {tab === 'analizar-movimiento' && (
              <>
                <Field label="Mes" width={140}>
                  <Select value={mes} onChange={setMes} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: `Mes ${String(i + 1).padStart(2, '0')}` }))} />
                </Field>
                <Field label="Cuenta desde" width={160}><AccountPicker value={desde} onChange={setDesde} placeholder="Todas" /></Field>
                <Field label="Cuenta hasta" width={160}><AccountPicker value={hasta} onChange={setHasta} placeholder="Todas" /></Field>
              </>
            )}
            <Button variant="primary" icon="play" onClick={simular}>Simular</Button>
          </div>

          {sim && (
            <>
              <p className="small">{sim.resumen} <Badge tone="info">{sim.lineas.length} líneas generadas</Badge></p>
              {sim.origen.length > 0 && (
                <table className="sim-table">
                  <thead><tr><th>Registro origen</th><th className="right">Valor</th></tr></thead>
                  <tbody>
                    {sim.origen.map((o) => (
                      <tr key={o.descripcion}><td>{o.descripcion}</td><td className="right tnum">{o.valor}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              {sim.lineas.length > 0 && (
                <table className="sim-table">
                  <thead><tr><th>Cuenta</th><th>NIT</th><th>Centro</th><th className="right">Débito</th><th className="right">Crédito</th><th>Concepto</th></tr></thead>
                  <tbody>
                    {sim.lineas.slice(0, 12).map((l) => (
                      <tr key={l.id}>
                        <td className="mono">{l.cuenta}</td>
                        <td className="mono">{l.nit || '—'}</td>
                        <td className="mono">{l.centro || '—'}</td>
                        <td className="right tnum">{money(l.debito)}</td>
                        <td className="right tnum">{money(l.credito)}</td>
                        <td className="small muted">{l.concepto}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="row gap-8" style={{ alignItems: 'center' }}>
                <span className="small">Total débito: <b className="money">{money(totales.debito)}</b> · Total crédito: <b className="money">{money(totales.credito)}</b></span>
                <span className="spacer" />
                {loteGenerado ? (
                  <span className="small">
                    Lote generado: <Link to={`/movimientos/lotes/${loteGenerado}`} className="mono bold">{loteGenerado}</Link>
                  </span>
                ) : (
                  <Button variant="primary" icon="lote" onClick={generarLote} disabled={sim.lineas.length === 0}>Generar lote</Button>
                )}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

const TAB_TITULO: Record<string, string> = {
  'cuenta-documento': 'Reclasificar cuenta-documento a centro',
  'comprobante-doc-tercero': 'Reclasificar comprobante-documento-tercero',
  'centro-cuenta': 'Reclasificar centro por cuenta',
  'analizar-plan': 'Analizar plan por nivel',
  'analizar-movimiento': 'Analizar movimiento de cuentas por mes',
}
