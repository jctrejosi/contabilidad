/* ============================================================
   CONTABDSI · Cierres de período y anuales
   Checklist previo, cierre anual automático (no disponible),
   comprobante de cierre (lote SIN contabilizar) y traslado de
   ajustes 13-18 a 01-06 (operación de MÁXIMO RIESGO).
   ============================================================ */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  NoPermissionState,
  PageHeader,
  ProgressBar,
  Select,
} from '@/components/ui'
import { DangerConfirmation, InfoStrip, usePageTitle } from '@/components/accounting/Widgets'
import { DebitCreditSummary } from '@/components/accounting/DataGrid'
import { VoucherPicker } from '@/components/accounting/Combobox'
import { useCan, useStore, validarLote } from '@/state/AppStore'
import { makeLinea } from '@/data/mock'
import { money, nombreMes, nowISO, uid } from '@/core/format'
import type { LineaMovimiento, Lote } from '@/core/types'

const ORIGENES = ['13', '14', '15', '16', '17', '18']
const DESTINOS = ['01', '02', '03', '04', '05', '06']

const ITEMS_CHECK = [
  { key: 'conciliaciones', label: 'Conciliaciones bancarias al día' },
  { key: 'lotes', label: 'Lotes pendientes contabilizados' },
  { key: 'descuadres', label: 'Sin descuadres en los lotes' },
  { key: 'impuestos', label: 'Impuestos (retención / IVA) generados y declarados' },
  { key: 'respaldo', label: 'Respaldo completo de la compañía' },
  { key: 'usuarios', label: 'Usuarios conectados sin captura activa' },
]

export function CierresPage() {
  usePageTitle('Cierres')
  const { state, dispatch, toast, audit } = useStore()
  const puede = useCan('cierres.ejecutar')

  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [clasesSel, setClasesSel] = useState<string[]>(() => state.accounts.filter((a) => ['4', '5', '6', '7', '8', '9'].some((c) => a.code.startsWith(c))).map((a) => a.code))
  const [cuentaResultado, setCuentaResultado] = useState('590505')
  const [compCierre, setCompCierre] = useState('NI')
  const [docCierre, setDocCierre] = useState('CI-2026-12-001')
  const [fechaCierre, setFechaCierre] = useState('2026-12-31')
  const [periodoCierre, setPeriodoCierre] = useState('202612')
  const [loteDestino, setLoteDestino] = useState('nuevo')
  const [cierreCreado, setCierreCreado] = useState<string | null>(null)
  const [matriz, setMatriz] = useState<Record<string, string>>({ '13': '01', '14': '02', '15': '03', '16': '04', '17': '05', '18': '06' })
  const [respaldoT, setRespaldoT] = useState(false)
  const [exclusividad, setExclusividad] = useState(false)
  const [reval00, setReval00] = useState(false)
  const [peligroOpen, setPeligroOpen] = useState(false)
  const [trasladando, setTrasladando] = useState(false)

  const lotesPendientes = state.lotes.filter((l) => !['CONTABILIZADO', 'ANULADO'].includes(l.estado)).length
  const descuadres = state.lotes.filter((l) => l.issues.some((i) => i.tipo === 'DESCUADRE')).length

  const cuentasCierre = useMemo(
    () => state.accounts.filter((a) => clasesSel.includes(a.code) && a.afectable),
    [state.accounts, clasesSel],
  )

  const saldoCuenta = (code: string): number => {
    const cuenta = state.accounts.find((a) => a.code === code)
    const movs = [...state.documentos.flatMap((d) => d.lineas), ...state.lotes.flatMap((l) => l.lineas)].filter((l) => l.cuenta === code)
    const neto = movs.reduce((a, l) => a + (l.debito - l.credito), 0)
    return (cuenta?.saldoInicial ?? 0) + neto
  }

  const lineasCierre = useMemo<LineaMovimiento[]>(() => {
    const lineas: LineaMovimiento[] = []
    for (const c of cuentasCierre) {
      const saldo = saldoCuenta(c.code)
      if (Math.abs(saldo) < 0.005) continue
      if (saldo > 0) {
        lineas.push(makeLinea({ cuenta: c.code, comprobante: compCierre, documento: docCierre, fecha: fechaCierre, credito: saldo, concepto: `Cierre de saldo ${c.code} ${c.nombre}`, origen: 'CIERRE' }))
        lineas.push(makeLinea({ cuenta: cuentaResultado, comprobante: compCierre, documento: docCierre, fecha: fechaCierre, debito: saldo, concepto: `Traslado a resultados — ${c.code} ${c.nombre}`, origen: 'CIERRE' }))
      } else {
        lineas.push(makeLinea({ cuenta: c.code, comprobante: compCierre, documento: docCierre, fecha: fechaCierre, debito: -saldo, concepto: `Cierre de saldo ${c.code} ${c.nombre}`, origen: 'CIERRE' }))
        lineas.push(makeLinea({ cuenta: cuentaResultado, comprobante: compCierre, documento: docCierre, fecha: fechaCierre, credito: -saldo, concepto: `Traslado a resultados — ${c.code} ${c.nombre}`, origen: 'CIERRE' }))
      }
    }
    return lineas
  }, [cuentasCierre, compCierre, docCierre, fechaCierre, cuentaResultado])

  const totalDebC = lineasCierre.reduce((a, l) => a + l.debito, 0)
  const totalCreC = lineasCierre.reduce((a, l) => a + l.credito, 0)

  const generarLoteCierre = () => {
    const codigo = nextCode(state.lotes, 'CIE')
    const lote: Lote = {
      codigo,
      nombre: `Cierre anual ${state.session.year}`,
      periodo: periodoCierre,
      usuario: state.session.user.nombre,
      origen: 'CIERRE',
      fecha: fechaCierre,
      comprobante: compCierre,
      documento: docCierre,
      lineas: lineasCierre,
      estado: 'BORRADOR',
      issues: [],
      audit: [{ id: uid('a'), fecha: nowISO(), usuario: state.session.user.nombre, rol: state.role, accion: 'Creación del lote', detalle: `Lote ${codigo} — comprobante de cierre generado SIN contabilizar`, resultado: 'INFO' }],
    }
    lote.issues = validarLote(lote, state.accounts, state.terceros, state.centros, state.documentos)
    dispatch({ type: 'ADD_LOTE', lote })
    setCierreCreado(codigo)
    audit('Generación de comprobante de cierre', 'Cierres', `Lote ${codigo} · ${lineasCierre.length} líneas · destino ${loteDestino}`, 'EXITO')
    toast('success', 'Lote de cierre generado', `Lote ${codigo} en BORRADOR (sin contabilizar). Verifíquelo, apruébelo y contabilícelo cuando esté listo.`)
  }

  const ejecutarTraslado = (motivo: string) => {
    setPeligroOpen(false)
    setTrasladando(true)
    dispatch({ type: 'SET_MASSIVE_LOCK', lock: { activo: true, proceso: 'Traslado 13-18 a 01-06', usuario: state.session.user.nombre } })
    window.setTimeout(() => {
      dispatch({ type: 'SET_MASSIVE_LOCK', lock: null })
      setTrasladando(false)
      setReval00(false)
      setRespaldoT(false)
      setExclusividad(false)
      audit('Traslado de ajustes 13-18', 'Cierres', `Matriz aplicada ${JSON.stringify(matriz)}. Motivo: ${motivo}`, 'EXITO')
      toast('success', 'Traslado completado', 'Los ajustes 13-18 se trasladaron a 01-06 y la compañía se revalorizó desde 00 (simulado).')
    }, 2600)
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Cierres" subtitle="Cierres de período y anuales" icon="cierre" />
        <NoPermissionState perm="cierres.ejecutar" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Cierres"
        subtitle="Checklist de cierre, comprobante de cierre y traslado de ajustes por inflación."
        icon="cierre"
        badge={<Badge tone="brand" icon="cierre">Período {nombreMes(state.session.period)} {state.session.year}</Badge>}
      />

      {/* ---- Checklist previo ---- */}
      <Card title="Checklist previo de cierre" icon="check">
        <div className="stack gap-8">
          {ITEMS_CHECK.map((it) => {
            const rojo = (it.key === 'lotes' && lotesPendientes > 0) || (it.key === 'descuadres' && descuadres > 0)
            return (
              <div key={it.key} className={`check-row ${rojo ? 'check-row-red' : ''}`}>
                <Checkbox checked={Boolean(checklist[it.key])} onChange={(v) => setChecklist((c) => ({ ...c, [it.key]: v }))} />
                <span className="small grow">{it.label}</span>
                {it.key === 'lotes' && (
                  <Badge tone={lotesPendientes > 0 ? 'danger' : 'success'}>{lotesPendientes > 0 ? `${lotesPendientes} pendiente(s)` : 'Al día'}</Badge>
                )}
                {it.key === 'descuadres' && (
                  <Badge tone={descuadres > 0 ? 'danger' : 'success'}>{descuadres > 0 ? `${descuadres} descuadre(s)` : 'Sin descuadres'}</Badge>
                )}
              </div>
            )
          })}
        </div>
        {(lotesPendientes > 0 || descuadres > 0) && (
          <p className="small neg" style={{ marginTop: 8 }}>
            Hay lotes sin contabilizar o descuadres abiertos: resuélvalos antes de ejecutar el cierre.
          </p>
        )}
      </Card>

      {/* ---- Cierre anual automático (no disponible) ---- */}
      <Card title="Cierre anual automático" icon="cierre" className="future-card" actions={<Badge tone="warning" icon="clock">En desarrollo / no disponible</Badge>}>
        <p className="small muted">
          El asistente de cierre anual automático (cierre de resultados, traslados y apertura del año siguiente en un solo paso)
          estará disponible en una próxima versión. Por ahora use el comprobante de cierre manual.
        </p>
        <div className="row gap-8" style={{ marginTop: 8 }}>
          <Button disabled icon="play">Ejecutar cierre anual</Button>
        </div>
      </Card>

      {/* ---- Generar comprobante de cierre ---- */}
      <Card title="Generar comprobante de cierre" icon="doc">
        <div className="row gap-12" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Comprobante">
            <VoucherPicker value={compCierre} onChange={setCompCierre} width={200} />
          </Field>
          <Field label="Documento">
            <Input value={docCierre} onChange={setDocCierre} monospace width={160} />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={fechaCierre} onChange={setFechaCierre} width={140} />
          </Field>
          <Field label="Período">
            <Select value={periodoCierre} options={[{ value: '202612', label: `${nombreMes(12)} ${state.session.year}` }, { value: '202602', label: `${nombreMes(2)} ${state.session.year}` }]} onChange={setPeriodoCierre} width={150} />
          </Field>
          <Field label="Cuenta de resultado">
            <Input value={cuentaResultado} onChange={setCuentaResultado} monospace width={120} />
          </Field>
          <Field label="Lote de destino">
            <Select
              value={loteDestino}
              options={[
                { value: 'nuevo', label: 'Lote nuevo' },
                ...state.lotes.filter((l) => ['BORRADOR'].includes(l.estado)).map((l) => ({ value: l.codigo, label: l.codigo })),
              ]}
              onChange={setLoteDestino}
              width={150}
            />
          </Field>
        </div>

        <p className="xs muted bold" style={{ margin: '10px 0 4px' }}>CUENTAS A CERRAR (CLASES 4-9)</p>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          {state.accounts
            .filter((a) => ['4', '5', '6', '7', '8', '9'].some((c) => a.code.startsWith(c)))
            .map((a) => (
              <Checkbox
                key={a.code}
                checked={clasesSel.includes(a.code)}
                onChange={(v) => setClasesSel((s) => (v ? [...s, a.code] : s.filter((x) => x !== a.code)))}
                label={<span className="small">{a.code} — {a.nombre}</span>}
              />
            ))}
        </div>

        <div className="page-grid" style={{ marginTop: 12 }}>
          <div className="col-6">
            <p className="xs muted bold">VISTA PREVIA DE LÍNEAS ({lineasCierre.length})</p>
            <div className="table-scroll" style={{ maxHeight: 220 }}>
              <table className="mini-table">
                <thead>
                  <tr><th>Cuenta</th><th>Concepto</th><th className="right">Débito</th><th className="right">Crédito</th></tr>
                </thead>
                <tbody>
                  {lineasCierre.map((l) => (
                    <tr key={l.id}>
                      <td className="tnum">{l.cuenta}</td>
                      <td>{l.concepto}</td>
                      <td className="right tnum">{money(l.debito)}</td>
                      <td className="right tnum">{money(l.credito)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row gap-8" style={{ marginTop: 10 }}>
              <DebitCreditSummary debito={totalDebC} credito={totalCreC} compact />
            </div>
            <div className="row gap-8" style={{ marginTop: 10 }}>
              <Button variant="primary" icon="lote" disabled={lineasCierre.length === 0} onClick={generarLoteCierre}>
                Generar lote SIN contabilizar
              </Button>
              {cierreCreado && (
                <Link className="btn btn-primary btn-sm" to={`/movimientos/lotes/${cierreCreado}`}>Verificar / aprobar / contabilizar</Link>
              )}
            </div>
          </div>
          <div className="col-6">
            <p className="xs muted bold">COMPARAR BALANCE ANTES / DESPUÉS</p>
            <div className="bal-compare">
              <div>
                <h5>Antes</h5>
                {cuentasCierre.map((c) => (
                  <div key={c.code} className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="xs tnum">{c.code}</span>
                    <span className="xs tnum">{money(saldoCuenta(c.code))}</span>
                  </div>
                ))}
              </div>
              <div>
                <h5>Después</h5>
                {cuentasCierre.map((c) => (
                  <div key={c.code} className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="xs tnum">{c.code}</span>
                    <span className="xs tnum">{money(0)}</span>
                  </div>
                ))}
              </div>
              <div>
                <h5>Diferencia</h5>
                {cuentasCierre.map((c) => (
                  <div key={c.code} className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="xs tnum">{c.code}</span>
                    <span className={`xs tnum ${saldoCuenta(c.code) > 0 ? 'bal-diff-neg' : 'bal-diff-pos'}`}>{money(-saldoCuenta(c.code))}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ---- Traslado 13-18 a 01-06 ---- */}
      <Card title="Traslado 13-18 a 01-06" icon="reclasificar" tone="danger">
        <div className="row gap-8">
          <Badge tone="danger" icon="warn">MÁXIMO RIESGO</Badge>
          <span className="small muted">Reclasifica los ajustes por inflación de los períodos anteriores a las clases operativas del año.</span>
        </div>
        <div className="page-grid" style={{ marginTop: 12 }}>
          <div className="col-6">
            <p className="xs muted bold">MATRIZ ORIGEN → DESTINO</p>
            <div className="table-scroll" style={{ maxHeight: 240 }}>
              <table className="mini-table matriz-table">
                <thead>
                  <tr><th>Origen (ajuste)</th><th>Destino (clase)</th></tr>
                </thead>
                <tbody>
                  {ORIGENES.map((o) => (
                    <tr key={o}>
                      <td className="tnum bold">Clase {o}</td>
                      <td>
                        <Select value={matriz[o]} options={DESTINOS.map((d) => ({ value: d, label: `Clase ${d}` }))} onChange={(v) => setMatriz((m) => ({ ...m, [o]: v }))} width={130} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="col-6">
            <p className="xs muted bold">SIMULACIÓN</p>
            <div className="stack gap-8">
              <InfoStrip
                items={[
                  { label: 'Movimientos a trasladar', value: '132' },
                  { label: 'Comprobantes afectados', value: '38' },
                  { label: 'Terceros involucrados', value: '24' },
                  { label: 'Valor total', value: money(96400000) },
                ]}
              />
              <div className="check-row">
                <Checkbox checked={respaldoT} onChange={setRespaldoT} label={<b className="small">Respaldo completo realizado</b>} />
              </div>
              <div className="check-row">
                <Checkbox checked={exclusividad} onChange={setExclusividad} label={<b className="small">Exclusividad: ningún otro usuario capturando</b>} />
              </div>
              <div className="check-row" style={{ borderColor: reval00 ? 'var(--success-600)' : undefined }}>
                <Checkbox checked={reval00} onChange={setReval00} label={<b className="small">Revalorizar desde 00 después del traslado (obligatorio)</b>} />
              </div>
              {trasladando ? (
                <ProgressBar pct={60} tone="warning" label="Ejecutando traslado…" />
              ) : (
                <Button variant="danger" icon="warn" disabled={!respaldoT || !exclusividad || !reval00} onClick={() => setPeligroOpen(true)}>
                  Ejecutar traslado de ajustes
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <DangerConfirmation
        open={peligroOpen}
        onClose={() => setPeligroOpen(false)}
        onConfirm={ejecutarTraslado}
        title="Traslado de ajustes 13-18 a 01-06"
        descripcion="Reclasificará los saldos de las clases 13 a 18 (ajustes por inflación) hacia las clases operativas 01 a 06 según la matriz definida. Operación de MÁXIMO RIESGO e irreversible."
        tablasAfectadas={['Movimientos contables', 'Saldos por cuenta', 'Comprobantes', 'Centros de costo']}
        confirmText="TRASLADAR AJUSTES"
        confirmLabel="Trasladar ahora"
        simulacion={[
          { descripcion: 'Movimientos a trasladar', valor: '132' },
          { descripcion: 'Valor total', valor: money(96400000) },
          { descripcion: 'Revalorización desde 00', valor: 'Obligatoria' },
        ]}
        extraBody={
          <div className="row gap-8">
            <Badge tone="danger" icon="lock">Requiere respaldo, exclusividad y revalorización desde 00</Badge>
          </div>
        }
      />
    </div>
  )
}

function nextCode(lotes: Lote[], prefix: string): string {
  const nums = lotes.map((l) => l.codigo).filter((c) => c.startsWith(prefix)).map((c) => Number(c.slice(prefix.length)) || 0)
  return `${prefix}${nums.length ? Math.max(...nums) + 1 : 1}`
}
