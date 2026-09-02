/* ============================================================
   CONTABDSI · Medios magnéticos (asistente anual)
   Formatos → Conceptos → Asignación de cuentas → Generación →
   Revisión → Topes/cruces → Exportación, con conciliación final.
   ============================================================ */

import './pages.css'

import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  LoadingState,
  Modal,
  NoPermissionState,
  PageHeader,
  ProgressBar,
  Select,
  Segmented,
} from '@/components/ui'
import { MoneyInput, ProcessWizard, usePageTitle } from '@/components/accounting/Widgets'
import { useCan, useStore } from '@/state/AppStore'
import { money, nitFmt } from '@/core/format'
import type { FormatoMedio } from '@/core/types'

interface ConceptoFormato {
  id: string
  formato: string
  code: string
  nombre: string
  tarifa: number
  cuenta: string
}

interface FilaMedio {
  id: string
  formato: string
  nit: string
  tercero: string
  documento: string
  concepto: string
  cuenta: string
  valor: number
  ajuste: number
}

interface VersionMedio {
  version: string
  anio: string
  fecha: string
  filas: number
  usuario: string
}

const FORMATOS_INI: FormatoMedio[] = [
  { code: '1001', nombre: 'Pagos o abonos en cuenta y descuentos', anual: true, concepto: 'Retenciones practicadas', filas: 0 },
  { code: '1007', nombre: 'Ingresos recibidos', anual: true, concepto: 'Ingresos del período', filas: 0 },
  { code: '2275', nombre: 'Rentas exentas y ganancias ocasionales', anual: true, concepto: 'Rentas exentas', filas: 0 },
  { code: '2276', nombre: 'Pagos al exterior', anual: true, concepto: 'Pagos al exterior', filas: 0 },
]

const CONCEPTOS_INI: ConceptoFormato[] = [
  { id: 'c1', formato: '1001', code: 'R01', nombre: 'Compras generales', tarifa: 2.5, cuenta: '236540' },
  { id: 'c2', formato: '1001', code: 'R02', nombre: 'Servicios', tarifa: 4, cuenta: '236540' },
  { id: 'c3', formato: '1001', code: 'R04', nombre: 'Salarios', tarifa: 10, cuenta: '236540' },
  { id: 'c4', formato: '1007', code: 'IV19', nombre: 'IVA generado', tarifa: 19, cuenta: '240805' },
  { id: 'c5', formato: '2275', code: 'RE', nombre: 'Rentas exentas', tarifa: 0, cuenta: '419510' },
  { id: 'c6', formato: '2276', code: 'EXT', nombre: 'Pagos al exterior', tarifa: 15, cuenta: '236540' },
]

const TOPES: Record<string, number> = { '1001': 5000000, '1007': 50000000, '2275': 20000000, '2276': 10000000 }

const ASIGN_PRESET: Record<string, Record<string, string[]>> = {
  '002': { '510506': ['1001'], '236540': ['1001', '2276'], '240805': ['1007'], '250505': ['1001'], '111005': ['1001', '1007'] },
  '003': { '510506': ['1001'], '236540': ['1001'], '240805': ['1007'], '130505': ['1007'], '110505': ['1007'] },
}

const FILAS_SAMPLE: Omit<FilaMedio, 'ajuste'>[] = [
  { id: 'm1', formato: '1001', nit: '890999888', tercero: 'CLIENTE LA MONTAÑA LTDA', documento: 'FVC-2210', concepto: 'Compras generales', cuenta: '236540', valor: 1200000 },
  { id: 'm2', formato: '1001', nit: '900333444', tercero: 'PROVEEDORES DEL VALLE S.A.S.', documento: 'FVC-2211', concepto: 'Servicios', cuenta: '236540', valor: 3800000 },
  { id: 'm3', formato: '1001', nit: '900111222', tercero: 'EMPLEADOS VARIOS NÓMINA', documento: 'NOM-2026-01', concepto: 'Salarios', cuenta: '236540', valor: 6500000 },
  { id: 'm4', formato: '1001', nit: '900333444', tercero: 'PROVEEDORES DEL VALLE S.A.S.', documento: 'FVC-2244', concepto: 'Compras generales', cuenta: '236540', valor: 900000 },
  { id: 'm5', formato: '1007', nit: '890999888', tercero: 'CLIENTE LA MONTAÑA LTDA', documento: 'FV-1042', concepto: 'Ingresos recibidos', cuenta: '240805', valor: 45000000 },
  { id: 'm6', formato: '1007', nit: '800456789', tercero: 'SEGUROS ANDINOS S.A.', documento: 'FV-1043', concepto: 'Ingresos recibidos', cuenta: '240805', valor: 22000000 },
  { id: 'm7', formato: '1007', nit: '52987654', tercero: 'RODRÍGUEZ SUÁREZ JUAN', documento: 'FV-1044', concepto: 'Ingresos recibidos', cuenta: '240805', valor: 12000000 },
  { id: 'm8', formato: '2275', nit: '901555666', tercero: 'DIAN — DIRECCIÓN DE IMPUESTOS', documento: 'RE-001', concepto: 'Rentas exentas', cuenta: '419510', valor: 8000000 },
  { id: 'm9', formato: '2275', nit: '800456789', tercero: 'SEGUROS ANDINOS S.A.', documento: 'RE-002', concepto: 'Rentas exentas', cuenta: '419510', valor: 15000000 },
  { id: 'm10', formato: '2276', nit: '900333444', tercero: 'PROVEEDORES DEL VALLE S.A.S.', documento: 'EXT-010', concepto: 'Pagos al exterior', cuenta: '236540', valor: 4200000 },
  { id: 'm11', formato: '2276', nit: '900777000', tercero: 'BANCO NACIONAL', documento: 'EXT-011', concepto: 'Pagos al exterior', cuenta: '236540', valor: 11500000 },
]

const PASOS_MED = [
  { key: 'formatos', label: 'Formatos', icon: 'formato' },
  { key: 'conceptos', label: 'Conceptos', icon: 'list' },
  { key: 'asignacion', label: 'Asignación de cuentas', icon: 'plan' },
  { key: 'generacion', label: 'Generación', icon: 'play' },
  { key: 'revision', label: 'Revisión', icon: 'eye' },
  { key: 'topes', label: 'Topes / cruces', icon: 'filter' },
  { key: 'exportacion', label: 'Exportación', icon: 'download' },
]

export function MediosMagneticosPage() {
  usePageTitle('Medios magnéticos')
  const { state, toast, audit } = useStore()
  const puede = useCan('impuestos.medios')

  const [paso, setPaso] = useState('formatos')
  const [formatos, setFormatos] = useState<FormatoMedio[]>(FORMATOS_INI)
  const [editFormato, setEditFormato] = useState<FormatoMedio | null>(null)
  const [conceptos, setConceptos] = useState<ConceptoFormato[]>(CONCEPTOS_INI)
  const [asignacion, setAsignacion] = useState<Record<string, string[]>>({ '510506': ['1001'], '236540': ['1001', '2276'], '240805': ['1007'] })
  const [copiarOpen, setCopiarOpen] = useState(false)
  const [compOrigen, setCompOrigen] = useState('002')
  const [anio, setAnio] = useState('2026')
  const [version, setVersion] = useState('1.0')
  const [incluirMenores, setIncluirMenores] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [versiones, setVersiones] = useState<VersionMedio[]>([
    { version: '0.9', anio: '2025', fecha: '2026-01-31 17:20', filas: 48, usuario: 'Diana Torres' },
  ])
  const [filasMedio, setFilasMedio] = useState<FilaMedio[]>([])
  const [totalContable, setTotalContable] = useState(0)
  const [editFila, setEditFila] = useState<FilaMedio | null>(null)
  const [panel, setPanel] = useState<'detalle' | 'variante' | 'identificacion' | null>(null)
  const [ajustesTopes, setAjustesTopes] = useState<Set<string>>(new Set())
  const [salidas, setSalidas] = useState<{ nombre: string; filas: number; size: string }[]>([])
  const [vistaSalida, setVistaSalida] = useState<VistaSalida>('detalle')

  const pasoIdx = PASOS_MED.findIndex((s) => s.key === paso)

  const generadas = filasMedio.length > 0

  const guardarFormato = (f: FormatoMedio) => {
    setFormatos((fs) => {
      const existe = fs.some((x) => x.code === f.code)
      return existe ? fs.map((x) => (x.code === f.code ? f : x)) : [...fs, f]
    })
    setEditFormato(null)
    toast('success', 'Formato guardado', `Formato ${f.code} — ${f.nombre} actualizado.`)
  }

  const eliminarFormato = (code: string) => {
    setFormatos((fs) => fs.filter((f) => f.code !== code))
    setConceptos((cs) => cs.filter((c) => c.formato !== code))
    toast('info', 'Formato eliminado', `El formato ${code} y sus conceptos fueron retirados del asistente.`)
  }

  const generarMedios = () => {
    setGenerando(true)
    window.setTimeout(() => {
      const filas: FilaMedio[] = FILAS_SAMPLE.map((f) => ({ ...f, ajuste: 0 }))
      setFilasMedio(filas)
      setTotalContable(filas.reduce((a, f) => a + f.valor, 0))
      setFormatos((fs) => fs.map((f) => ({ ...f, filas: filas.filter((x) => x.formato === f.code).length })))
      setVersiones((v) => [
        { version, anio, fecha: '2026-02-28 16:45', filas: filas.length, usuario: state.session.user.nombre },
        ...v,
      ])
      setGenerando(false)
      audit('Generación de medios magnéticos', 'Medios magnéticos', `Año ${anio} · versión ${version} · ${filas.length} filas`, 'EXITO')
      toast('success', 'Medios generados', `Se generaron ${filas.length} filas en ${filas.map((f) => f.formato).filter((v, i, a) => a.indexOf(v) === i).length} formatos (simulado).`)
    }, 1600)
  }

  const guardarFila = (f: FilaMedio) => {
    setFilasMedio((fs) => {
      const existe = fs.some((x) => x.id === f.id)
      return existe ? fs.map((x) => (x.id === f.id ? f : x)) : [...fs, f]
    })
    setEditFila(null)
    toast('success', 'Fila guardada', `Registro ${f.documento} actualizado en el medio generado.`)
  }

  const eliminarFila = (id: string) => {
    setFilasMedio((fs) => fs.filter((f) => f.id !== id))
    toast('info', 'Fila eliminada', 'La fila se eliminó manualmente del medio generado.')
  }

  const sobreTope = useMemo(
    () => filasMedio.filter((f) => f.ajuste === 0 && f.valor > (TOPES[f.formato] ?? 0)),
    [filasMedio],
  )

  const cruces = useMemo(() => {
    const porNit = new Map<string, Set<string>>()
    for (const f of filasMedio) {
      if (!f.nit) continue
      const s = porNit.get(f.nit) ?? new Set<string>()
      s.add(f.formato)
      porNit.set(f.nit, s)
    }
    return [...porNit.entries()].filter(([, fs]) => fs.size > 1).map(([nit, fs]) => ({ nit, formatos: [...fs] }))
  }, [filasMedio])

  const totalReportado = useMemo(
    () => filasMedio.reduce((a, f) => a + (f.valor - f.ajuste), 0),
    [filasMedio],
  )
  const topesPendientes = sobreTope.reduce((a, f) => a + (f.valor - (TOPES[f.formato] ?? 0)), 0)
  const exclusiones = 0
  const cuadra = totalContable > 0 && Math.abs(totalReportado - (totalContable - exclusiones - topesPendientes)) < 0.005

  const aplicarTopes = () => {
    setFilasMedio((fs) =>
      fs.map((f) => (ajustesTopes.has(f.id) ? { ...f, ajuste: f.valor - (TOPES[f.formato] ?? 0) } : f)),
    )
    audit('Ajuste por topes', 'Medios magnéticos', `${ajustesTopes.size} fila(s) ajustadas al tope del formato`, 'EXITO')
    toast('success', 'Ajustes aplicados', `${ajustesTopes.size} fila(s) ajustadas al tope. La conciliación ahora cuadra.`)
    setAjustesTopes(new Set())
  }

  const generarSalidas = () => {
    const files = formatos
      .filter((f) => filasMedio.some((x) => x.formato === f.code))
      .map((f) => ({
        nombre: `medios_${f.code}_${anio}_v${version.replaceAll('.', '_')}.txt`,
        filas: filasMedio.filter((x) => x.formato === f.code).length,
        size: `${(0.4 + Math.random() * 1.4).toFixed(1)} MB`,
      }))
    setSalidas(files)
    audit('Exportación de medios', 'Medios magnéticos', `${files.length} archivo(s) generados (simulado)`, 'EXITO')
    toast('success', 'Salidas generadas', `${files.length} archivo(s) listos para presentar ante la DIAN (simulado).`)
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Medios magnéticos" subtitle="Asistente anual de medios" icon="medio" />
        <NoPermissionState perm="impuestos.medios" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Medios magnéticos"
        subtitle="Asistente anual: formatos, conceptos, asignación de cuentas, generación, revisión, topes y exportación."
        icon="medio"
        badge={<Badge tone="brand" icon="medio">Año {anio}</Badge>}
      />

      <ProcessWizard
        steps={PASOS_MED.map((s, i) => ({
          ...s,
          done: i < pasoIdx,
          disabled: (s.key === 'generacion' && formatos.length === 0) || (s.key === 'revision' && !generadas) || (s.key === 'topes' && !generadas) || (s.key === 'exportacion' && !generadas),
        }))}
        active={paso}
        onSelect={setPaso}
      >
        {paso === 'formatos' && (
          <div className="stack gap-12">
            <div className="row gap-8">
              <Button size="sm" icon="plus" onClick={() => setEditFormato({ code: '', nombre: '', anual: true, concepto: '', filas: 0 })}>Nuevo formato</Button>
            </div>
            {formatos.length === 0 ? (
              <EmptyState icon="formato" title="Sin formatos" detail="Cree un formato para comenzar el asistente." />
            ) : (
              <div className="table-scroll">
                <table className="mini-table">
                  <thead>
                    <tr><th>Formato</th><th>Nombre</th><th>Concepto</th><th>Periodicidad</th><th className="right">Filas</th><th /></tr>
                  </thead>
                  <tbody>
                    {formatos.map((f) => (
                      <tr key={f.code}>
                        <td className="tnum bold">{f.code}</td>
                        <td>{f.nombre}</td>
                        <td>{f.concepto}</td>
                        <td><Badge tone="brand">{f.anual ? 'Anual' : 'Mensual'}</Badge></td>
                        <td className="right tnum">{f.filas}</td>
                        <td>
                          <div className="row gap-4" style={{ justifyContent: 'flex-end' }}>
                            <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditFormato(f)}>Editar</Button>
                            <Button size="sm" variant="ghost" danger icon="trash" onClick={() => eliminarFormato(f.code)}>Eliminar</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="row gap-8">
              <Button variant="primary" iconRight="chevronR" disabled={formatos.length === 0} onClick={() => setPaso('conceptos')}>Continuar</Button>
            </div>
          </div>
        )}

        {paso === 'conceptos' && (
          <div className="stack gap-12">
            <p className="small">Conceptos por formato con tarifa y cuenta asociada. Se usarán para clasificar los registros del medio.</p>
            <div className="table-scroll">
              <table className="mini-table">
                <thead>
                  <tr><th>Formato</th><th>Código</th><th>Concepto</th><th className="right">Tarifa</th><th>Cuenta</th></tr>
                </thead>
                <tbody>
                  {conceptos
                    .filter((c) => formatos.some((f) => f.code === c.formato))
                    .map((c) => (
                      <tr key={c.id}>
                        <td className="tnum bold">{c.formato}</td>
                        <td className="tnum">{c.code}</td>
                        <td>{c.nombre}</td>
                        <td className="right tnum">{c.tarifa.toLocaleString('es-CO')}%</td>
                        <td className="tnum">{c.cuenta}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="row gap-8">
              <Button onClick={() => setPaso('formatos')} icon="chevronL">Atrás</Button>
              <Button variant="primary" iconRight="chevronR" onClick={() => setPaso('asignacion')}>Continuar</Button>
            </div>
          </div>
        )}

        {paso === 'asignacion' && (
          <div className="stack gap-12">
            <div className="row gap-8">
              <p className="small grow">
                Marque, para cada cuenta del plan, los formatos que la alimentan. El asistente la usa para clasificar los registros.
              </p>
              <Button size="sm" icon="copy" onClick={() => setCopiarOpen(true)}>Copiar definiciones de otra compañía</Button>
            </div>
            <div className="table-scroll">
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Cuenta</th>
                    {formatos.map((f) => (
                      <th className="center" key={f.code}>{f.code}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.accounts
                    .slice()
                    .sort((a, b) => a.code.localeCompare(b.code))
                    .filter((a) => a.afectable)
                    .map((a) => (
                      <tr key={a.code}>
                        <td style={{ paddingLeft: 8 + a.nivel * 8 }}>
                          <span className="tnum">{a.code}</span> <span className="muted">— {a.nombre}</span>
                        </td>
                        {formatos.map((f) => (
                          <td key={f.code} className="center">
                            <Checkbox
                              checked={(asignacion[a.code] ?? []).includes(f.code)}
                              onChange={(v) =>
                                setAsignacion((asg) => {
                                  const cur = asg[a.code] ?? []
                                  return { ...asg, [a.code]: v ? [...cur, f.code] : cur.filter((x) => x !== f.code) }
                                })
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="row gap-8">
              <Button onClick={() => setPaso('conceptos')} icon="chevronL">Atrás</Button>
              <Button variant="primary" iconRight="chevronR" onClick={() => setPaso('generacion')}>Continuar</Button>
            </div>
          </div>
        )}

        {paso === 'generacion' && (
          <div className="stack gap-12">
            <div className="row gap-12" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Field label="Año" required>
                <Select value={anio} options={[{ value: '2026', label: '2026' }, { value: '2025', label: '2025' }]} onChange={setAnio} width={120} />
              </Field>
              <Field label="Versión" required>
                <Input value={version} onChange={setVersion} placeholder="1.0" monospace width={100} />
              </Field>
              <Field label="Parámetros">
                <Checkbox checked={incluirMenores} onChange={setIncluirMenores} label="Incluir cuantías menores" />
              </Field>
            </div>
            {generando ? (
              <div className="stack gap-8">
                <LoadingState label="Generando medios magnéticos…" />
                <ProgressBar pct={65} label="Progreso de generación" />
              </div>
            ) : (
              <div className="row gap-8">
                <Button variant="primary" icon="play" onClick={generarMedios}>Generar medios</Button>
              </div>
            )}
            <div className="stack gap-4">
              <span className="xs muted bold">VERSIONES GENERADAS (se conservan versión y parámetros)</span>
              {versiones.map((v, i) => (
                <div key={`${v.version}-${i}`} className="row gap-8 version-row">
                  <Badge tone={i === 0 ? 'success' : 'outline'} icon={i === 0 ? 'check' : 'clock'}>v{v.version} · {v.anio}</Badge>
                  <span className="small grow">{v.fecha} · {v.filas} filas · {v.usuario}</span>
                  <Button size="sm" variant="ghost" icon="eye" onClick={() => toast('info', `Versión ${v.version}`, 'Parámetros de esa generación: incluir cuantías menores = No · depurar por topes = Sí.')}>Parámetros</Button>
                </div>
              ))}
            </div>
            <div className="row gap-8">
              <Button onClick={() => setPaso('asignacion')} icon="chevronL">Atrás</Button>
              <Button variant="primary" iconRight="chevronR" disabled={!generadas} onClick={() => setPaso('revision')}>Revisar medio generado</Button>
            </div>
          </div>
        )}

        {paso === 'revision' && (
          <div className="stack gap-12">
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              <Button size="sm" icon="plus" onClick={() => setEditFila({ id: `m-${Date.now()}`, formato: formatos[0]?.code ?? '1001', nit: '', tercero: '', documento: '', concepto: '', cuenta: '', valor: 0, ajuste: 0 })}>Crear fila manual</Button>
              <Button size="sm" variant="subtle" icon="eye" onClick={() => setPanel(panel === 'detalle' ? null : 'detalle')}>Detalle</Button>
              <Button size="sm" variant="subtle" icon="copy" onClick={() => setPanel(panel === 'variante' ? null : 'variante')}>Segunda variante</Button>
              <Button size="sm" variant="subtle" icon="key" onClick={() => setPanel(panel === 'identificacion' ? null : 'identificacion')}>Identificación</Button>
            </div>

            {panel && (
              <div className="panel-row">
                {panel === 'detalle' && (
                  <div className="panel-box">
                    <b className="small">Detalle del medio generado</b>
                    <p className="xs muted">{filasMedio.length} filas · {formatos.filter((f) => filasMedio.some((x) => x.formato === f.code)).map((f) => f.code).join(', ')}</p>
                    <p className="xs">Valor total: <b>{money(totalReportado)}</b></p>
                  </div>
                )}
                {panel === 'variante' && (
                  <div className="panel-box">
                    <b className="small">Segunda variante (archivo alterno)</b>
                    <p className="xs muted">Incluye los pagos al exterior (2276) con tipo de documento extranjero y moneda de origen. Útil para cruces de la DIAN.</p>
                  </div>
                )}
                {panel === 'identificacion' && (
                  <div className="panel-box">
                    <b className="small">Identificación de la versión</b>
                    <p className="xs muted">Año {anio} · versión {version} · generada por {state.session.user.nombre} · hash simulado 8f3a…c21e</p>
                  </div>
                )}
              </div>
            )}

            {filasMedio.length === 0 ? (
              <EmptyState icon="list" title="Sin filas generadas" detail="Vuelva al paso Generación para crear el medio." />
            ) : (
              <div className="table-scroll">
                <table className="mini-table">
                  <thead>
                    <tr><th>Formato</th><th>NIT</th><th>Tercero</th><th>Documento</th><th>Concepto</th><th className="right">Valor</th><th className="right">Ajuste</th><th /></tr>
                  </thead>
                  <tbody>
                    {filasMedio.map((f) => (
                      <tr key={f.id}>
                        <td className="tnum bold">{f.formato}</td>
                        <td className="tnum">{nitFmt(f.nit)}</td>
                        <td>{f.tercero}</td>
                        <td className="tnum">{f.documento}</td>
                        <td>{f.concepto}</td>
                        <td className="right tnum">{money(f.valor)}</td>
                        <td className="right tnum">{f.ajuste ? money(f.ajuste) : '—'}</td>
                        <td>
                          <div className="row gap-4" style={{ justifyContent: 'flex-end' }}>
                            <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditFila(f)}>Editar</Button>
                            <Button size="sm" variant="ghost" danger icon="trash" onClick={() => eliminarFila(f.id)}>Eliminar</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="row gap-8">
              <Button onClick={() => setPaso('generacion')} icon="chevronL">Atrás</Button>
              <Button variant="primary" iconRight="chevronR" disabled={!generadas} onClick={() => setPaso('topes')}>Topes y cruces</Button>
            </div>
          </div>
        )}

        {paso === 'topes' && (
          <div className="stack gap-12">
            <div className="page-grid">
            <div className="col-6">
              <Card title={`Depuración por topes (${sobreTope.length} fila(s) sobre el tope)`} icon="filter">
                {sobreTope.length === 0 ? (
                  <EmptyState icon="check" title="Sin filas sobre el tope" detail="Ninguna fila supera el tope de su formato." />
                ) : (
                  <div className="stack gap-8">
                    <div className="table-scroll">
                      <table className="mini-table">
                        <thead>
                          <tr><th>Formato</th><th>Tercero</th><th className="right">Valor</th><th className="right">Tope</th><th className="right">Exceso</th><th /></tr>
                        </thead>
                        <tbody>
                          {sobreTope.map((f) => (
                            <tr key={f.id}>
                              <td className="tnum bold">{f.formato}</td>
                              <td>{f.tercero}</td>
                              <td className="right tnum">{money(f.valor)}</td>
                              <td className="right tnum">{money(TOPES[f.formato] ?? 0)}</td>
                              <td className="right tnum neg">{money(f.valor - (TOPES[f.formato] ?? 0))}</td>
                              <td>
                                <Checkbox
                                  checked={ajustesTopes.has(f.id)}
                                  onChange={(v) =>
                                    setAjustesTopes((s) => {
                                      const n = new Set(s)
                                      if (v) n.add(f.id)
                                      else n.delete(f.id)
                                      return n
                                    })
                                  }
                                  label="Ajustar"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button size="sm" variant="primary" icon="sliders" disabled={ajustesTopes.size === 0} onClick={aplicarTopes}>Aplicar ajustes por tope</Button>
                  </div>
                )}
              </Card>
            </div>
            <div className="col-6">
              <Card title={`Cruces de terceros entre formatos (${cruces.length})`} icon="terceros">
                {cruces.length === 0 ? (
                  <EmptyState icon="check" title="Sin cruces" detail="Ningún tercero aparece en más de un formato." />
                ) : (
                  <div className="stack gap-8">
                    {cruces.map((c) => (
                      <div key={c.nit} className="row gap-8 version-row">
                        <span className="small bold grow">{nitFmt(c.nit)}</span>
                        {c.formatos.map((f) => (
                          <Badge key={f} tone="info" icon="formato">{f}</Badge>
                        ))}
                        <Button size="sm" variant="ghost" icon="eye" onClick={() => toast('info', 'Cruce de tercero', `${nitFmt(c.nit)} aparece en ${c.formatos.join(', ')}. Verifique que la clasificación es correcta.`)}>Revisar</Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
            </div>
            <div className="row gap-8">
              <Button onClick={() => setPaso('revision')} icon="chevronL">Atrás</Button>
              <Button variant="primary" iconRight="chevronR" onClick={() => setPaso('exportacion')}>Ir a exportación</Button>
            </div>
          </div>
        )}

        {paso === 'exportacion' && (
          <div className="stack gap-12">
            <div className="row gap-8">
              <Button variant="primary" icon="download" onClick={generarSalidas}>Generar salidas</Button>
              <Button variant="ghost" icon="print" onClick={() => window.print()}>Imprimir conciliación</Button>
            </div>

            {salidas.length > 0 && (
              <div className="stack gap-4">
                <span className="xs muted bold">ARCHIVOS GENERADOS (SIMULADOS)</span>
                {salidas.map((s) => (
                  <div key={s.nombre} className="row gap-8 version-row">
                    <Badge tone="success" icon="file">{s.nombre}</Badge>
                    <span className="small grow">{s.filas} filas</span>
                    <span className="xs muted">{s.size}</span>
                    <Button size="sm" variant="ghost" icon="download" onClick={() => toast('success', 'Descarga iniciada', `«${s.nombre}» se descargó (simulado).`)}>Descargar</Button>
                  </div>
                ))}
              </div>
            )}

            <div className="page-grid">
              <div className="col-6">
                <Card title="Conciliación — total contable vs reportado" icon="check">
                  <div className="concat-row"><span>Total contable (libro)</span><span className="tnum">{money(totalContable)}</span></div>
                  <div className="concat-row"><span>Exclusiones</span><span className="tnum">{money(exclusiones)}</span></div>
                  <div className="concat-row"><span>Topes pendientes de ajustar</span><span className="tnum neg">{money(topesPendientes)}</span></div>
                  <div className="concat-row"><span>Ajustes aplicados</span><span className="tnum">{money(filasMedio.reduce((a, f) => a + f.ajuste, 0))}</span></div>
                  <div className="concat-row">
                    <span>Total reportado</span>
                    <span className="tnum">{money(totalReportado)}</span>
                  </div>
                  <div className="row gap-8" style={{ marginTop: 8 }}>
                    {cuadra ? (
                      <Badge tone="success" icon="check">Cuadra</Badge>
                    ) : (
                      <Badge tone="danger" icon="error">No cuadra</Badge>
                    )}
                    <span className="xs muted">{cuadra ? 'La conciliación entre el libro y el medio está cerrada.' : 'Aplique los ajustes por tope en el paso anterior para cuadrar.'}</span>
                  </div>
                </Card>
              </div>
              <div className="col-6">
                <Card title="Salidas por tipo" icon="list">
                  <Segmented
                    value={vistaSalida}
                    onChange={setVistaSalida}
                    options={[
                      { value: 'detalle', label: 'Detalle por tercero' },
                      { value: 'totales', label: 'Totales por tercero' },
                      { value: 'formato', label: 'Formato por tercero' },
                      { value: 'movimiento', label: 'Movimiento por documento' },
                    ]}
                  />
                  <div className="table-scroll" style={{ marginTop: 10, maxHeight: 260 }}>
                    <table className="mini-table">
                      <thead>
                        <tr>
                          {vistaSalida === 'detalle' && <><th>Tercero</th><th>Documento</th><th className="right">Valor</th></>}
                          {vistaSalida === 'totales' && <><th>Tercero</th><th className="right">Registros</th><th className="right">Total</th></>}
                          {vistaSalida === 'formato' && <><th>Tercero</th><th>Formatos</th></>}
                          {vistaSalida === 'movimiento' && <><th>Documento</th><th>Formato</th><th className="right">Valor</th></>}
                        </tr>
                      </thead>
                      <tbody>
                        {filasMedio.map((f) => {
                          if (vistaSalida === 'detalle') return <tr key={f.id}><td>{f.tercero}</td><td className="tnum">{f.documento}</td><td className="right tnum">{money(f.valor - f.ajuste)}</td></tr>
                          if (vistaSalida === 'movimiento') return <tr key={f.id}><td className="tnum">{f.documento}</td><td className="tnum bold">{f.formato}</td><td className="right tnum">{money(f.valor - f.ajuste)}</td></tr>
                          return null
                        })}
                        {vistaSalida === 'totales' && agruparTercero(filasMedio).map((t) => (
                          <tr key={t.nit}><td>{t.tercero}</td><td className="right tnum">{t.registros}</td><td className="right tnum">{money(t.total)}</td></tr>
                        ))}
                        {vistaSalida === 'formato' && agruparTercero(filasMedio).map((t) => (
                          <tr key={t.nit}><td>{t.tercero}</td><td className="tnum">{t.formatos.join(', ')}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>
            <div className="row gap-8">
              <Button onClick={() => setPaso('topes')} icon="chevronL">Atrás</Button>
              <Badge tone={salidas.length > 0 ? 'success' : 'neutral'} icon={salidas.length > 0 ? 'check' : 'clock'}>
                {salidas.length > 0 ? 'Asistente completado' : 'Pendiente de generar salidas'}
              </Badge>
            </div>
          </div>
        )}
      </ProcessWizard>

      {/* ---- Modal: editar formato ---- */}
      <Modal
        open={editFormato !== null}
        onClose={() => setEditFormato(null)}
        title={editFormato && editFormato.code ? `Editar formato ${editFormato.code}` : 'Nuevo formato'}
        icon="formato"
        width={520}
        footer={
          <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setEditFormato(null)}>Cancelar</Button>
            <Button variant="primary" disabled={!editFormato || !editFormato.code.trim() || !editFormato.nombre.trim()} onClick={() => editFormato && guardarFormato(editFormato)}>Guardar</Button>
          </div>
        }
      >
        {editFormato && (
          <div className="stack gap-8">
            <Field label="Código del formato" required>
              <Input value={editFormato.code} onChange={(v) => setEditFormato({ ...editFormato, code: v })} monospace />
            </Field>
            <Field label="Nombre" required>
              <Input value={editFormato.nombre} onChange={(v) => setEditFormato({ ...editFormato, nombre: v })} />
            </Field>
            <Field label="Concepto">
              <Input value={editFormato.concepto} onChange={(v) => setEditFormato({ ...editFormato, concepto: v })} />
            </Field>
            <Checkbox checked={editFormato.anual} onChange={(v) => setEditFormato({ ...editFormato, anual: v })} label="Presentación anual" />
          </div>
        )}
      </Modal>

      {/* ---- Modal: copiar definiciones ---- */}
      <Modal
        open={copiarOpen}
        onClose={() => setCopiarOpen(false)}
        title="Copiar definiciones de otra compañía"
        icon="copy"
        width={440}
        footer={
          <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setCopiarOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={() => {
                setAsignacion({ ...(ASIGN_PRESET[compOrigen] ?? {}) })
                setCopiarOpen(false)
                audit('Copia de definiciones', 'Medios magnéticos', `Asignación copiada desde la compañía ${compOrigen}`, 'EXITO')
                toast('success', 'Definiciones copiadas', `La asignación de cuentas se copió desde la compañía ${compOrigen}.`)
              }}
            >
              Copiar
            </Button>
          </div>
        }
      >
        <div className="stack gap-8">
          <Field label="Compañía origen" required>
            <Select
              value={compOrigen}
              options={[
                { value: '002', label: '002 — Sucursal Norte' },
                { value: '003', label: '003 — Sucursal Sur' },
              ]}
              onChange={setCompOrigen}
              width={260}
            />
          </Field>
          <p className="xs muted">Se reemplazará la asignación manual actual por la definición de la compañía seleccionada.</p>
        </div>
      </Modal>

      {/* ---- Modal: editar fila del medio ---- */}
      <Modal
        open={editFila !== null}
        onClose={() => setEditFila(null)}
        title="Fila del medio generado"
        icon="edit"
        width={520}
        footer={
          <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setEditFila(null)}>Cancelar</Button>
            <Button variant="primary" disabled={!editFila || !editFila.documento.trim()} onClick={() => editFila && guardarFila(editFila)}>Guardar</Button>
          </div>
        }
      >
        {editFila && (
          <div className="stack gap-8">
            <div className="row gap-8">
              <Field label="Formato" required>
                <Select value={editFila.formato} options={formatos.map((f) => ({ value: f.code, label: `${f.code} — ${f.nombre}` }))} onChange={(v) => setEditFila({ ...editFila, formato: v })} width={300} />
              </Field>
              <Field label="Cuenta">
                <Input value={editFila.cuenta} onChange={(v) => setEditFila({ ...editFila, cuenta: v })} monospace width={110} />
              </Field>
            </div>
            <div className="row gap-8">
              <Field label="NIT">
                <Input value={editFila.nit} onChange={(v) => setEditFila({ ...editFila, nit: v })} monospace width={140} />
              </Field>
              <Field label="Documento" required>
                <Input value={editFila.documento} onChange={(v) => setEditFila({ ...editFila, documento: v })} monospace />
              </Field>
            </div>
            <Field label="Tercero">
              <Input value={editFila.tercero} onChange={(v) => setEditFila({ ...editFila, tercero: v })} />
            </Field>
            <Field label="Concepto">
              <Input value={editFila.concepto} onChange={(v) => setEditFila({ ...editFila, concepto: v })} />
            </Field>
            <Field label="Valor">
              <MoneyInput value={editFila.valor} onChange={(v) => setEditFila({ ...editFila, valor: v })} width={180} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}

type VistaSalida = 'detalle' | 'totales' | 'formato' | 'movimiento'

function agruparTercero(filas: FilaMedio[]): { nit: string; tercero: string; registros: number; total: number; formatos: string[] }[] {
  const map = new Map<string, { nit: string; tercero: string; registros: number; total: number; formatos: Set<string> }>()
  for (const f of filas) {
    const cur = map.get(f.nit) ?? { nit: f.nit, tercero: f.tercero, registros: 0, total: 0, formatos: new Set<string>() }
    cur.registros += 1
    cur.total += f.valor - f.ajuste
    cur.formatos.add(f.formato)
    map.set(f.nit, cur)
  }
  return [...map.values()].map((t) => ({ ...t, formatos: [...t.formatos] }))
}
