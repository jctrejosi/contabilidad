/* ============================================================
   CONTABDSI · Integración de nómina
   Flujos separados por Tabs: Nómina / Aportes / Provisiones.
   Cada flujo genera un LOTE en BORRADOR con enlace para abrirlo.
   El lote NOM2 existente proviene de este flujo.
   ============================================================ */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  LoadingState,
  NoPermissionState,
  PageHeader,
  Tabs,
} from '@/components/ui'
import { InfoStrip, usePageTitle } from '@/components/accounting/Widgets'
import { AccountingDataGrid, DebitCreditSummary, type GridColumn } from '@/components/accounting/DataGrid'
import { CostCenterPicker, VoucherPicker } from '@/components/accounting/Combobox'
import { useCan, useStore, validarLote } from '@/state/AppStore'
import { makeLinea } from '@/data/mock'
import { money, nowISO, uid } from '@/core/format'
import type { LineaMovimiento, Lote } from '@/core/types'

type Flujo = 'nomina' | 'aportes' | 'provisiones'

interface FilaNomina {
  cuenta: string
  nit: string
  centro: string
  debito: number
  credito: number
  base: number
  clase: '' | 'RETENCION'
  concepto: string
}

const FILAS: Record<Flujo, FilaNomina[]> = {
  nomina: [
    { cuenta: '510506', nit: '', centro: 'ADM', debito: 12000000, credito: 0, base: 0, clase: '', concepto: 'Sueldos — Administración' },
    { cuenta: '510506', nit: '', centro: 'VEN', debito: 8000000, credito: 0, base: 0, clase: '', concepto: 'Sueldos — Ventas' },
    { cuenta: '510506', nit: '', centro: 'OPE', debito: 5000000, credito: 0, base: 0, clase: '', concepto: 'Sueldos — Operaciones' },
    { cuenta: '236540', nit: '901555666', centro: '', debito: 0, credito: 2250000, base: 45000000, clase: 'RETENCION', concepto: 'Retención en la fuente por salarios' },
    { cuenta: '250505', nit: '900111222', centro: '', debito: 0, credito: 22750000, base: 0, clase: '', concepto: 'Salarios por pagar — neto a empleados' },
  ],
  aportes: [
    { cuenta: '510506', nit: '', centro: 'ADM', debito: 1500000, credito: 0, base: 0, clase: '', concepto: 'Aportes salud empleador — Administración' },
    { cuenta: '510506', nit: '', centro: 'VEN', debito: 1000000, credito: 0, base: 0, clase: '', concepto: 'Aportes pensión empleador — Ventas' },
    { cuenta: '510506', nit: '', centro: 'OPE', debito: 700000, credito: 0, base: 0, clase: '', concepto: 'Aportes ARL — Operaciones' },
    { cuenta: '250505', nit: '900111222', centro: '', debito: 0, credito: 3200000, base: 0, clase: '', concepto: 'Aportes de seguridad social por pagar' },
  ],
  provisiones: [
    { cuenta: '510506', nit: '', centro: 'ADM', debito: 1600000, credito: 0, base: 0, clase: '', concepto: 'Provisión cesantías — Administración' },
    { cuenta: '510506', nit: '', centro: 'OPE', debito: 1200000, credito: 0, base: 0, clase: '', concepto: 'Provisión primas — Operaciones' },
    { cuenta: '250505', nit: '900111222', centro: '', debito: 0, credito: 2800000, base: 0, clase: '', concepto: 'Prestaciones sociales por pagar' },
  ],
}

const PREFIJOS: Record<Flujo, string> = { nomina: 'NOM', aportes: 'APO', provisiones: 'PRV' }

const COLUMNAS: GridColumn<LineaMovimiento>[] = [
  { key: 'cuenta', label: 'Cuenta', width: 90, searchValue: (r) => r.cuenta },
  { key: 'nit', label: 'NIT', width: 110 },
  { key: 'centro', label: 'Centro', width: 90 },
  { key: 'concepto', label: 'Concepto', minWidth: 220 },
  { key: 'debito', label: 'Débito', align: 'right', money: true, width: 130 },
  { key: 'credito', label: 'Crédito', align: 'right', money: true, width: 130 },
  { key: 'clase', label: 'Clase', width: 90 },
]

export function NominaPage() {
  usePageTitle('Integración de nómina')
  const { state, dispatch, toast, audit } = useStore()
  const puede = useCan('mov.nomina')

  const [flujo, setFlujo] = useState<Flujo>('nomina')
  const [periodo, setPeriodo] = useState(`${state.session.year}${String(state.session.period).padStart(2, '0')}`)
  const [documento, setDocumento] = useState('NOM-2026-02')
  const [comprobante, setComprobante] = useState('CE')
  const [centro, setCentro] = useState('ADM')
  const [importando, setImportando] = useState(false)
  const [generado, setGenerado] = useState<{ flujo: Flujo; codigo: string } | null>(null)

  const lineas = useMemo<LineaMovimiento[]>(
    () =>
      FILAS[flujo].map((f) =>
        makeLinea({
          cuenta: f.cuenta,
          nit: f.nit,
          centro: f.centro || (f.cuenta === '510506' ? centro : ''),
          comprobante,
          documento,
          fecha: '2026-02-28',
          debito: f.debito,
          credito: f.credito,
          base: f.base,
          clase: f.clase,
          concepto: f.concepto,
          origen: 'NÓMINA',
        }),
      ),
    [flujo, comprobante, documento, centro],
  )

  const totalDeb = lineas.reduce((a, l) => a + l.debito, 0)
  const totalCre = lineas.reduce((a, l) => a + l.credito, 0)

  const generarLote = () => {
    const codigo = nextCode(state.lotes, PREFIJOS[flujo])
    const lote: Lote = {
      codigo,
      nombre: `${NOMBRE_FLUJO[flujo]} ${state.session.periodName.toLowerCase()} (generado)`,
      periodo,
      usuario: state.session.user.nombre,
      origen: 'NÓMINA',
      fecha: '2026-02-28',
      comprobante,
      documento,
      lineas,
      estado: 'BORRADOR',
      issues: [],
      audit: [{ id: uid('a'), fecha: nowISO(), usuario: state.session.user.nombre, rol: state.role, accion: 'Creación del lote', detalle: `Lote ${codigo} creado desde Integración de nómina (${NOMBRE_FLUJO[flujo]})`, resultado: 'INFO' }],
    }
    lote.issues = validarLote(lote, state.accounts, state.terceros, state.centros, state.documentos)
    dispatch({ type: 'ADD_LOTE', lote })
    setGenerado({ flujo, codigo })
    audit('Generación de lote de nómina', 'Nómina', `Lote ${codigo} · ${lineas.length} líneas · ${documento}`, 'EXITO')
    toast('success', 'Lote generado', `Lote ${codigo} creado en BORRADOR con ${lineas.length} líneas. Ábralo para verificar, aprobar y contabilizar.`)
  }

  const importarArchivo = () => {
    setImportando(true)
    window.setTimeout(() => {
      setImportando(false)
      audit('Importación de archivo de nómina', 'Nómina', `Flujo ${NOMBRE_FLUJO[flujo]} · archivo simulado procesado`, 'EXITO')
      toast('success', 'Archivo procesado', 'El archivo de nómina se interpretó correctamente y las líneas de ejemplo quedaron listas para generar el lote.')
    }, 1100)
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Integración de nómina" subtitle="Nómina, aportes y provisiones" icon="nomina" />
        <NoPermissionState perm="mov.nomina" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Integración de nómina"
        subtitle="Genere los lotes de nómina, aportes y provisiones desde los parámetros de liquidación."
        icon="nomina"
        badge={<Badge tone="brand" icon="nomina">Cargue por lotes</Badge>}
      />

      <Card tone="info">
        <span className="small">
          El lote existente <b>NOM2 — Nómina febrero</b> proviene de este flujo (Integración de nómina).{' '}
          <Link to="/movimientos/lotes/NOM2">Ábralo</Link> para ver sus issues y continuar su ciclo de aprobación.
        </span>
      </Card>

      <Tabs
        active={flujo}
        onChange={(k) => { setFlujo(k as Flujo); setGenerado(null) }}
        tabs={[
          { key: 'nomina', label: 'Nómina', icon: 'nomina' },
          { key: 'aportes', label: 'Aportes', icon: 'users' },
          { key: 'provisiones', label: 'Provisiones', icon: 'clock' },
        ]}
      />

      <div className="page-grid">
        <div className="col-4">
          <Card title={`Parámetros — ${NOMBRE_FLUJO[flujo]}`} icon="parametros">
            <div className="stack gap-8">
              <Field label="Período" required>
                <Input value={periodo} onChange={setPeriodo} placeholder="AAAAMM" monospace width={140} />
              </Field>
              <Field label="Documento" required>
                <Input value={documento} onChange={setDocumento} placeholder="NOM-2026-XX" monospace />
              </Field>
              <Field label="Comprobante" required>
                <VoucherPicker value={comprobante} onChange={setComprobante} width={200} />
              </Field>
              <Field label="Centro por defecto" hint="Se aplica a las cuentas de gasto sin centro.">
                <CostCenterPicker value={centro} onChange={setCentro} width={200} />
              </Field>
              <Field label="Tercero empleados">
                <Input value="900111222 — EMPLEADOS VARIOS NÓMINA" readOnly width={260} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="col-8">
          <Card
            title={`Líneas de ejemplo — ${NOMBRE_FLUJO[flujo]}`}
            icon="lote"
            actions={
              <div className="row gap-8">
                <Button size="sm" icon="upload" loading={importando} onClick={importarArchivo}>Importar archivo</Button>
                <Button size="sm" variant="primary" icon="play" onClick={generarLote}>Generar lote</Button>
              </div>
            }
          >
            {importando ? (
              <LoadingState label="Interpretando archivo de nómina…" />
            ) : (
              <AccountingDataGrid
                rows={lineas}
                columns={COLUMNAS}
                rowKey={(l) => l.id}
                height={300}
                selectable={false}
                searchable={false}
                totals={[
                  { label: 'Totales', key: 'debito', value: money(totalDeb) },
                  { label: '', key: 'credito', value: money(totalCre) },
                ]}
              />
            )}
            <div className="row gap-8" style={{ marginTop: 10 }}>
              <DebitCreditSummary debito={totalDeb} credito={totalCre} compact />
              <span className="spacer" />
              <span className="xs muted">Las líneas son de ejemplo: sueldos por centro (510506), retención (236540) y salarios por pagar (250505).</span>
            </div>
          </Card>
        </div>
      </div>

      {generado && generado.flujo === flujo && (
        <Card tone="success" icon="check" title="Lote creado correctamente">
          <InfoStrip
            items={[
              { label: 'Lote', value: <Link to={`/movimientos/lotes/${generado.codigo}`}>{generado.codigo}</Link> },
              { label: 'Estado', value: <Badge tone="neutral">BORRADOR</Badge> },
              { label: 'Líneas', value: lineas.length },
              { label: 'Siguiente paso', value: 'Verificar → aprobar → contabilizar' },
            ]}
          />
          <div className="row gap-8" style={{ marginTop: 10 }}>
            <Link className="btn btn-primary btn-sm" to={`/movimientos/lotes/${generado.codigo}`}>Abrir lote {generado.codigo}</Link>
          </div>
        </Card>
      )}
    </div>
  )
}

const NOMBRE_FLUJO: Record<Flujo, string> = { nomina: 'Nómina', aportes: 'Aportes', provisiones: 'Provisiones' }

function nextCode(lotes: Lote[], prefix: string): string {
  const nums = lotes.map((l) => l.codigo).filter((c) => c.startsWith(prefix)).map((c) => Number(c.slice(prefix.length)) || 0)
  return `${prefix}${nums.length ? Math.max(...nums) + 1 : 1}`
}
