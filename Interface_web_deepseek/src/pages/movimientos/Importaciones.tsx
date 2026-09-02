/* ============================================================
   CONTABDSI · Importaciones masivas
   Asistente para XLS/XLSX, ADT, XLS por meses, TXT y CSV.
   Regla obligatoria: toda importación termina primero en un
   LOTE (ADD_LOTE con las líneas aceptadas; el estado se calcula
   según los issues de validación).
   ============================================================ */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Icon,
  Input,
  LoadingState,
  NoPermissionState,
  PageHeader,
  ProgressBar,
  Select,
} from '@/components/ui'
import { InfoStrip, ProcessWizard, usePageTitle } from '@/components/accounting/Widgets'
import { useCan, useStore, validarLote } from '@/state/AppStore'
import { makeLinea } from '@/data/mock'
import { nowISO, uid } from '@/core/format'
import type { LineaMovimiento, Lote } from '@/core/types'

type FormatoArchivo = 'XLSX' | 'ADT' | 'XLSMES' | 'TXT' | 'CSV'

const FORMATOS: { value: FormatoArchivo; label: string }[] = [
  { value: 'XLSX', label: 'XLS / XLSX — hoja de cálculo' },
  { value: 'ADT', label: 'ADT — archivo de texto DSI' },
  { value: 'XLSMES', label: 'XLS por meses — un archivo, una hoja por mes' },
  { value: 'TXT', label: 'TXT — texto delimitado' },
  { value: 'CSV', label: 'CSV — valores separados por coma' },
]

const CAMPOS_DESTINO: { value: string; label: string }[] = [
  { value: 'cuenta', label: 'Cuenta' },
  { value: 'nit', label: 'NIT (tercero)' },
  { value: 'centro', label: 'Centro de costo' },
  { value: 'comprobante', label: 'Comprobante' },
  { value: 'documento', label: 'Documento' },
  { value: 'tipo', label: 'Tipo de documento' },
  { value: 'fecha', label: 'Fecha' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
  { value: 'base', label: 'Base' },
  { value: 'impuesto', label: 'Impuesto / tarifa' },
  { value: 'concepto', label: 'Concepto' },
]

/** Mapeo por defecto: campo destino -> columna del archivo, según formato */
const MAPEO_DEF: Record<FormatoArchivo, Record<string, string>> = {
  XLSX: { cuenta: 'CUENTA', nit: 'NIT', centro: 'CENTRO', documento: 'DOCUMENTO', fecha: 'FECHA', debito: 'DEBITO', credito: 'CREDITO', concepto: 'CONCEPTO' },
  ADT: { cuenta: 'CUE', nit: 'NIT', centro: 'CCO', documento: 'DOC', fecha: 'FEC', debito: 'DEB', credito: 'CRE', base: 'BAS', concepto: 'CON' },
  XLSMES: { cuenta: 'CUENTA', nit: 'NIT', centro: 'CENTRO', documento: 'DOCUMENTO', fecha: 'FECHA', debito: 'DEBITO', credito: 'CREDITO', concepto: 'CONCEPTO' },
  TXT: { cuenta: 'C1', nit: 'C2', centro: 'C3', documento: 'C4', fecha: 'C5', debito: 'C6', credito: 'C7', concepto: 'C8' },
  CSV: { cuenta: 'cuenta', nit: 'nit', centro: 'centro', documento: 'documento', fecha: 'fecha', debito: 'debito', credito: 'credito', concepto: 'concepto' },
}

const HOJAS_XLS = ['Comprobantes', 'Terceros', 'Consolidado', 'Histórico']
const HOJAS_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

interface FilaBase {
  CUENTA: string
  NIT: string
  CENTRO: string
  DOCUMENTO: string
  FECHA: string
  DEBITO: number
  CREDITO: number
  CONCEPTO: string
}

/** 10 filas de ejemplo: incluye 1 advertencia, 1 rechazada y 1 duplicada */
const DATOS_BASE: FilaBase[] = [
  { CUENTA: '510506', NIT: '', CENTRO: 'ADM', DOCUMENTO: 'EGR-101', FECHA: '2026-02-10', DEBITO: 1250000, CREDITO: 0, CONCEPTO: 'Papelería y útiles' },
  { CUENTA: '111005', NIT: '900777000', CENTRO: '', DOCUMENTO: 'EGR-101', FECHA: '2026-02-10', DEBITO: 0, CREDITO: 1250000, CONCEPTO: 'Pago banco' },
  { CUENTA: '510506', NIT: '', CENTRO: 'VEN', DOCUMENTO: 'EGR-102', FECHA: '2026-02-12', DEBITO: 850000, CREDITO: 0, CONCEPTO: 'Transporte ventas' },
  { CUENTA: '111005', NIT: '900777000', CENTRO: '', DOCUMENTO: 'EGR-102', FECHA: '2026-02-12', DEBITO: 0, CREDITO: 850000, CONCEPTO: 'Pago banco' },
  { CUENTA: '510506', NIT: '', CENTRO: '', DOCUMENTO: 'EGR-103', FECHA: '2026-02-14', DEBITO: 2100000, CREDITO: 0, CONCEPTO: 'Publicidad campaña' },
  { CUENTA: '111005', NIT: '900777000', CENTRO: '', DOCUMENTO: 'EGR-103', FECHA: '2026-02-14', DEBITO: 0, CREDITO: 2100000, CONCEPTO: 'Pago banco' },
  { CUENTA: '', NIT: '900333444', CENTRO: '', DOCUMENTO: 'EGR-104', FECHA: '2026-02-16', DEBITO: 1500000, CREDITO: 0, CONCEPTO: 'Fila sin cuenta' },
  { CUENTA: '510506', NIT: '', CENTRO: 'OPE', DOCUMENTO: 'EGR-103', FECHA: '2026-02-14', DEBITO: 300000, CREDITO: 0, CONCEPTO: 'Duplicado de documento' },
  { CUENTA: '510506', NIT: '', CENTRO: 'ADM', DOCUMENTO: 'EGR-105', FECHA: '2026-02-18', DEBITO: 1800000, CREDITO: 0, CONCEPTO: 'Mantenimiento locativo' },
  { CUENTA: '111005', NIT: '900777000', CENTRO: '', DOCUMENTO: 'EGR-105', FECHA: '2026-02-18', DEBITO: 0, CREDITO: 1800000, CONCEPTO: 'Pago banco' },
]

interface Plantilla {
  nombre: string
  formato: FormatoArchivo
  mapeo: Record<string, string>
}

interface ResultadoImportacion {
  aceptadas: number
  advertidas: number
  rechazadas: number
  duplicadas: number
  codigo: string
  detalle: { estado: string; fila: number; concepto: string; motivo: string }[]
}

const PASOS = [
  { key: 'archivo', label: 'Seleccionar archivo', icon: 'file' },
  { key: 'hoja', label: 'Hoja / formato', icon: 'excel' },
  { key: 'mapeo', label: 'Mapear columnas', icon: 'columns' },
  { key: 'preview', label: 'Previsualizar', icon: 'eye' },
  { key: 'validar', label: 'Validar y elegir lote', icon: 'check' },
  { key: 'importar', label: 'Importar', icon: 'importar' },
]

export function ImportacionesPage() {
  usePageTitle('Importaciones')
  const { state, dispatch, toast, audit } = useStore()
  const puede = useCan('mov.importar')

  const [paso, setPaso] = useState('archivo')
  const [archivo, setArchivo] = useState<{ name: string; size: number } | null>(null)
  const [formato, setFormato] = useState<FormatoArchivo>('XLSX')
  const [hoja, setHoja] = useState('Comprobantes')
  const [mapeo, setMapeo] = useState<Record<string, string>>({ ...MAPEO_DEF.XLSX })
  const [plantillas, setPlantillas] = useState<Plantilla[]>([
    { nombre: 'Egresos estándar', formato: 'XLSX', mapeo: { ...MAPEO_DEF.XLSX } },
    { nombre: 'Nómina ADT', formato: 'ADT', mapeo: { ...MAPEO_DEF.ADT } },
  ])
  const [nombrePlantilla, setNombrePlantilla] = useState('')
  const [loteModo, setLoteModo] = useState<'existente' | 'nuevo'>('nuevo')
  const [loteCodigo, setLoteCodigo] = useState('')
  const [loteNombre, setLoteNombre] = useState('')
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)

  const necesitaHoja = formato === 'XLSX' || formato === 'XLSMES'
  const colsArchivo = useMemo(() => Object.values(MAPEO_DEF[formato]), [formato])

  const filasPreview = useMemo(() => {
    const inv = MAPEO_DEF[formato]
    return DATOS_BASE.map((f) => {
      const row: Record<string, string> = {}
      for (const [campo, col] of Object.entries(inv)) {
        row[col] = String(f[campo as keyof FilaBase] ?? '')
      }
      return row
    })
  }, [formato])

  const clasificar = useMemo(() => {
    const seen = new Set<string>()
    const detalle: ResultadoImportacion['detalle'] = []
    let aceptadas = 0
    let advertidas = 0
    let rechazadas = 0
    let duplicadas = 0
    DATOS_BASE.forEach((f, i) => {
      if (!f.CUENTA) {
        rechazadas += 1
        detalle.push({ estado: 'Rechazada', fila: i + 1, concepto: f.CONCEPTO, motivo: 'La fila no tiene cuenta asignada' })
        return
      }
      if (seen.has(f.DOCUMENTO)) {
        duplicadas += 1
        detalle.push({ estado: 'Duplicada', fila: i + 1, concepto: f.CONCEPTO, motivo: `Documento ${f.DOCUMENTO} ya existe en el archivo` })
        return
      }
      seen.add(f.DOCUMENTO)
      if (f.CUENTA === '510506' && !f.CENTRO) {
        advertidas += 1
        detalle.push({ estado: 'Advertida', fila: i + 1, concepto: f.CONCEPTO, motivo: 'La cuenta 510506 controla centro de costo y la fila no lo trae' })
        return
      }
      aceptadas += 1
      detalle.push({ estado: 'Aceptada', fila: i + 1, concepto: f.CONCEPTO, motivo: '' })
    })
    return { aceptadas, advertidas, rechazadas, duplicadas, detalle }
  }, [])

  const lotesExistentes = state.lotes.filter((l) => ['BORRADOR', 'CON_ERRORES'].includes(l.estado))
  const periodo = `${state.session.year}${String(state.session.period).padStart(2, '0')}`

  const elegirFormato = (v: string) => {
    const f = v as FormatoArchivo
    setFormato(f)
    setMapeo({ ...MAPEO_DEF[f] })
    setHoja(f === 'XLSMES' ? state.session.periodName : 'Comprobantes')
  }

  const guardarPlantilla = () => {
    if (!nombrePlantilla.trim()) return
    setPlantillas((p) => [...p, { nombre: nombrePlantilla.trim(), formato, mapeo: { ...mapeo } }])
    setNombrePlantilla('')
    toast('success', 'Plantilla guardada', `La plantilla «${nombrePlantilla.trim()}» quedó disponible para futuras importaciones.`)
  }

  const importar = () => {
    const lineas: LineaMovimiento[] = []
    const seen = new Set<string>()
    DATOS_BASE.forEach((f) => {
      if (!f.CUENTA || seen.has(f.DOCUMENTO)) {
        seen.add(f.DOCUMENTO)
        return
      }
      seen.add(f.DOCUMENTO)
      lineas.push(
        makeLinea({
          cuenta: f.CUENTA,
          nit: f.NIT,
          centro: f.CENTRO,
          comprobante: 'CE',
          documento: f.DOCUMENTO,
          fecha: f.FECHA,
          debito: f.DEBITO,
          credito: f.CREDITO,
          concepto: f.CONCEPTO,
          origen: 'IMPORTACIÓN',
        }),
      )
    })

    const codigo = loteModo === 'existente' && loteCodigo ? loteCodigo : nextCode(state.lotes, 'IMP')
    const nombre = loteModo === 'nuevo' && loteNombre.trim() ? loteNombre.trim() : `Importación ${formato} — ${archivo?.name ?? ''}`
    const lote: Lote = {
      codigo,
      nombre,
      periodo,
      usuario: state.session.user.nombre,
      origen: 'IMPORTACIÓN',
      fecha: '2026-02-28',
      lineas,
      estado: 'BORRADOR',
      issues: [],
      comprobante: 'CE',
      audit: [{ id: uid('a'), fecha: nowISO(), usuario: state.session.user.nombre, rol: state.role, accion: 'Creación del lote', detalle: `Lote ${codigo} creado desde Importaciones (${formato})`, resultado: 'INFO' }],
    }
    lote.issues = validarLote(lote, state.accounts, state.terceros, state.centros, state.documentos)
    lote.estado = lote.issues.some((i) => i.severidad === 'ERROR') ? 'CON_ERRORES' : 'VERIFICADO'

    setImportando(true)
    window.setTimeout(() => {
      dispatch({ type: 'ADD_LOTE', lote })
      setImportando(false)
      setResultado({ ...clasificar, codigo, detalle: clasificar.detalle })
      audit('Importación masiva', 'Importaciones', `Lote ${codigo} · ${lineas.length} líneas · ${formato}`, 'EXITO')
      toast('success', 'Importación terminada', `Lote ${codigo} creado con ${lineas.length} líneas. Revise los issues antes de contabilizar.`)
    }, 1400)
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Importaciones" subtitle="Importación masiva de movimientos" icon="importar" />
        <NoPermissionState perm="mov.importar" />
      </div>
    )
  }

  const pasoIdx = PASOS.findIndex((s) => s.key === paso)

  return (
    <div className="page">
      <PageHeader
        title="Importaciones"
        subtitle="Importe XLS/XLSX, ADT, archivos por meses, TXT o CSV. El resultado siempre se revisa en un lote antes de contabilizar."
        icon="importar"
        badge={<Badge tone="brand" icon="importar">{formato}</Badge>}
      />

      <Card tone="info" pad>
        <div className="row gap-8">
          <strong>Regla obligatoria:</strong>
          <span className="small">
            toda importación masiva termina primero en un <b>LOTE</b> — las líneas aceptadas se guardan con <code>ADD_LOTE</code> y el estado se calcula según los issues de validación. Desde el lote se verifica, aprueba y contabiliza.
          </span>
        </div>
      </Card>

      <ProcessWizard
        steps={PASOS.map((s, i) => ({ ...s, done: i < pasoIdx }))}
        active={paso}
        onSelect={(k) => setPaso(k)}
      >
        {paso === 'archivo' && (
          <div className="stack gap-12">
            <Field label="Archivo a importar" required hint="Solo se lee el nombre y el tamaño (simulado).">
              <label className="file-drop">
                <input
                  type="file"
                  accept=".xls,.xlsx,.adt,.txt,.csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setArchivo({ name: f.name, size: f.size })
                  }}
                />
                <span className="file-drop-body">
                  {archivo ? (
                    <>
                      <span className="bold">{archivo.name}</span>
                      <span className="xs muted">{(archivo.size / 1024).toFixed(1)} KB</span>
                    </>
                  ) : (
                    <span className="muted">Haga clic para elegir el archivo…</span>
                  )}
                </span>
              </label>
            </Field>
            <Field label="Formato del archivo" required>
              <Select value={formato} options={FORMATOS} onChange={elegirFormato} width={320} />
            </Field>
            <p className="small muted">
              Nota: la importación desde <b>Captura directa</b> sólo llena el borrador del comprobante activo y pasa por sus
              validaciones antes de contabilizar. Esta pantalla es la vía <b>masiva</b> (siempre por lotes).
            </p>
            <div className="row gap-8">
              <Button variant="primary" iconRight="chevronR" disabled={!archivo} onClick={() => setPaso('hoja')}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {paso === 'hoja' && (
          <div className="stack gap-12">
            <p className="small">
              {necesitaHoja
                ? `El archivo ${archivo?.name ?? ''} contiene varias hojas (o meses). Elija cuál importar.`
                : `El formato ${formato} no usa hojas. Revise las opciones de lectura del archivo.`}
            </p>
            {necesitaHoja ? (
              <Field label={formato === 'XLSMES' ? 'Mes a importar' : 'Hoja del libro'} required>
                <Select
                  value={hoja}
                  options={(formato === 'XLSMES' ? HOJAS_MESES : HOJAS_XLS).map((h) => ({ value: h, label: h }))}
                  onChange={setHoja}
                  width={240}
                />
              </Field>
            ) : (
              <div className="stack gap-8">
                <Field label="Delimitador">
                  <Select value=";" options={[{ value: ';', label: 'Punto y coma (;)' }, { value: ',', label: 'Coma (,)' }, { value: '|', label: 'Tubo (|)' }]} onChange={() => {}} width={240} />
                </Field>
                <Field label="Codificación">
                  <Select value="UTF8" options={[{ value: 'UTF8', label: 'UTF-8' }, { value: 'LATIN', label: 'ISO-8859-1 (Latin-1)' }]} onChange={() => {}} width={240} />
                </Field>
              </div>
            )}
            <div className="row gap-8">
              <Button onClick={() => setPaso('archivo')} icon="chevronL">Atrás</Button>
              <Button variant="primary" iconRight="chevronR" onClick={() => setPaso('mapeo')}>Continuar</Button>
            </div>
          </div>
        )}

        {paso === 'mapeo' && (
          <div className="stack gap-12">
            <p className="small">
              Asocie cada columna del archivo con el campo destino contable. Las columnas sin asignar se ignoran.
            </p>
            <table className="mini-table">
              <thead>
                <tr><th>Columna del archivo</th><th>Campo destino</th></tr>
              </thead>
              <tbody>
                {colsArchivo.map((col) => (
                  <tr key={col}>
                    <td><code>{col}</code></td>
                    <td>
                      <Select
                        value={mapeoInverso(mapeo)[col] ?? ''}
                        placeholder="Ignorar"
                        options={[{ value: '', label: '— Ignorar —' }, ...CAMPOS_DESTINO]}
                        onChange={(v) => {
                          const inv = mapeoInverso(mapeo)
                          const next = { ...mapeo }
                          if (inv[col]) delete next[inv[col]]
                          if (v) next[v] = col
                          setMapeo(next)
                        }}
                        width={220}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row gap-8" style={{ alignItems: 'flex-end' }}>
              <Field label="Guardar plantilla de mapeo">
                <Input value={nombrePlantilla} onChange={setNombrePlantilla} placeholder="Nombre de la plantilla" width={240} />
              </Field>
              <Button icon="save" disabled={!nombrePlantilla.trim()} onClick={guardarPlantilla}>Guardar plantilla</Button>
            </div>
            {plantillas.length === 0 ? (
              <EmptyState icon="plantilla" title="Sin plantillas guardadas" detail="Guarde el mapeo actual para reutilizarlo en la próxima importación." />
            ) : (
              <div className="stack gap-4">
                <span className="xs muted bold">PLANTILLAS GUARDADAS</span>
                {plantillas.map((p) => (
                  <div key={p.nombre} className="row gap-8 plantilla-row">
                    <Icon name="plantilla" size={14} className="muted" />
                    <span className="small bold grow">{p.nombre}</span>
                    <Badge tone="outline">{p.formato}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => { setFormato(p.formato); setMapeo({ ...p.mapeo }) }}>Usar</Button>
                    <Button size="sm" variant="ghost" danger onClick={() => setPlantillas((x) => x.filter((q) => q.nombre !== p.nombre))}>Quitar</Button>
                  </div>
                ))}
              </div>
            )}
            <div className="row gap-8">
              <Button onClick={() => setPaso('hoja')} icon="chevronL">Atrás</Button>
              <Button variant="primary" iconRight="chevronR" disabled={Object.keys(mapeo).length === 0} onClick={() => setPaso('preview')}>Previsualizar</Button>
            </div>
          </div>
        )}

        {paso === 'preview' && (
          <div className="stack gap-12">
            <p className="small">Primeras 10 filas del archivo según el mapeo actual.</p>
            <div className="table-scroll">
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {Object.entries(mapeo).map(([campo, col]) => (
                      <th key={campo}>{campo.toUpperCase()} <span className="xs muted">← {col}</span></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filasPreview.map((r, i) => (
                    <tr key={i}>
                      <td className="tnum muted">{i + 1}</td>
                      {Object.keys(mapeo).map((campo) => (
                        <td key={campo} className="tnum">{r[MAPEO_DEF[formato][campo]]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row gap-8">
              <Button onClick={() => setPaso('mapeo')} icon="chevronL">Atrás</Button>
              <Button variant="primary" iconRight="chevronR" onClick={() => setPaso('validar')}>Validar</Button>
            </div>
          </div>
        )}

        {paso === 'validar' && (
          <div className="stack gap-12">
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              <Badge tone="success" icon="check">{clasificar.aceptadas} aceptadas</Badge>
              <Badge tone="warning" icon="warn">{clasificar.advertidas} con advertencia</Badge>
              <Badge tone="danger" icon="error">{clasificar.rechazadas} rechazadas</Badge>
              <Badge tone="neutral" icon="copy">{clasificar.duplicadas} duplicadas</Badge>
            </div>
            <div className="stack gap-8">
              <SegmentedLote value={loteModo} onChange={setLoteModo} />
              {loteModo === 'existente' ? (
                <Field label="Lote destino" required>
                  <Select
                    value={loteCodigo}
                    placeholder="Elegir lote existente…"
                    options={lotesExistentes.map((l) => ({ value: l.codigo, label: `${l.codigo} — ${l.nombre}` }))}
                    onChange={setLoteCodigo}
                    width={320}
                  />
                </Field>
              ) : (
                <Field label="Nombre del lote nuevo" required>
                  <Input value={loteNombre} onChange={setLoteNombre} placeholder="p. ej. Importación egresos marzo" width={320} />
                </Field>
              )}
            </div>
            <p className="small muted">
              Las líneas rechazadas y duplicadas no entran al lote. Las advertidas sí, y generarán issues visibles en el editor del lote.
            </p>
            <div className="row gap-8">
              <Button onClick={() => setPaso('preview')} icon="chevronL">Atrás</Button>
              <Button variant="primary" icon="importar" disabled={loteModo === 'existente' ? !loteCodigo : !loteNombre.trim()} onClick={() => setPaso('importar')}>
                Continuar a importación
              </Button>
            </div>
          </div>
        )}

        {paso === 'importar' && (
          <div className="stack gap-12">
            {importando ? (
              <div className="stack gap-8">
                <LoadingState label="Importando archivo y creando el lote…" />
                <ProgressBar pct={75} label="Progreso de importación" />
              </div>
            ) : resultado ? (
              <>
                <div className="page-grid">
                  <div className="col-3"><div className="stat-card"><span className="stat-label">Aceptadas</span><span className="stat-value pos">{resultado.aceptadas}</span></div></div>
                  <div className="col-3"><div className="stat-card"><span className="stat-label">Advertidas</span><span className="stat-value">{resultado.advertidas}</span></div></div>
                  <div className="col-3"><div className="stat-card"><span className="stat-label">Rechazadas</span><span className="stat-value neg">{resultado.rechazadas}</span></div></div>
                  <div className="col-3"><div className="stat-card"><span className="stat-label">Duplicadas</span><span className="stat-value">{resultado.duplicadas}</span></div></div>
                </div>
                <Card title="Detalle de la importación" icon="list" actions={
                  <Link to={`/movimientos/lotes/${resultado.codigo}`} className="btn btn-primary btn-sm">Abrir lote {resultado.codigo}</Link>
                }>
                  <div className="table-scroll">
                    <table className="mini-table">
                      <thead>
                        <tr><th>Fila</th><th>Estado</th><th>Concepto</th><th>Observación</th></tr>
                      </thead>
                      <tbody>
                        {resultado.detalle.map((d) => (
                          <tr key={d.fila}>
                            <td className="tnum muted">{d.fila}</td>
                            <td><Badge tone={d.estado === 'Aceptada' ? 'success' : d.estado === 'Advertida' ? 'warning' : d.estado === 'Rechazada' ? 'danger' : 'neutral'}>{d.estado}</Badge></td>
                            <td>{d.concepto}</td>
                            <td className="small muted">{d.motivo || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
                <InfoStrip items={[
                  { label: 'Lote creado', value: resultado.codigo },
                  { label: 'Líneas en el lote', value: resultado.aceptadas + resultado.advertidas },
                  { label: 'Origen', value: 'IMPORTACIÓN' },
                  { label: 'Siguiente paso', value: 'Verificar → aprobar → contabilizar' },
                ]} />
                <div className="row gap-8">
                  <Button icon="refresh" onClick={() => { setResultado(null); setPaso('archivo'); setArchivo(null) }}>Nueva importación</Button>
                </div>
              </>
            ) : (
              <div className="stack gap-8">
                <p className="small">Listo para importar. Se creará el lote con las líneas aceptadas y su estado se calculará según los issues.</p>
                <div className="row gap-8">
                  <Button onClick={() => setPaso('validar')} icon="chevronL">Atrás</Button>
                  <Button variant="primary" icon="importar" onClick={importar}>Importar ahora</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </ProcessWizard>
    </div>
  )
}

function SegmentedLote({ value, onChange }: { value: 'existente' | 'nuevo'; onChange: (v: 'existente' | 'nuevo') => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {([
        { value: 'nuevo', label: 'Crear lote nuevo' },
        { value: 'existente', label: 'Agregar a lote existente' },
      ] as const).map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={`segmented-item ${value === o.value ? 'segmented-active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function mapeoInverso(mapeo: Record<string, string>): Record<string, string> {
  const inv: Record<string, string> = {}
  for (const [campo, col] of Object.entries(mapeo)) inv[col] = campo
  return inv
}

function nextCode(lotes: Lote[], prefix: string): string {
  const nums = lotes.map((l) => l.codigo).filter((c) => c.startsWith(prefix)).map((c) => Number(c.slice(prefix.length)) || 0)
  const n = (nums.length ? Math.max(...nums) : 0) + 1
  return `${prefix}${n}`
}
