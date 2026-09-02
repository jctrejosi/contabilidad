/* ============================================================
   CONTABDSI · Presupuesto (feature flag «presupuesto»)
   Jerarquía departamento → grupo → sección → código, centro de
   costo por nodo y 12 columnas mensuales editables.
   ============================================================ */

import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  NoPermissionState,
  PageHeader,
} from '@/components/ui'
import { MoneyInput, usePageTitle } from '@/components/accounting/Widgets'
import { CostCenterPicker } from '@/components/accounting/Combobox'
import { useCan, useStore } from '@/state/AppStore'
import { money, nombreMes } from '@/core/format'

interface NodoPresupuesto {
  id: string
  nombre: string
  nivel: number // 0 departamento · 1 grupo · 2 sección · 3 código
  parentId: string | null
  centro: string
  valores: number[]
}

const NODOS_INI: NodoPresupuesto[] = [
  { id: 'd1', nombre: 'VENTAS', nivel: 0, parentId: null, centro: 'VEN', valores: [45000000, 46000000, 47000000, 48000000, 49000000, 50000000, 51000000, 52000000, 53000000, 54000000, 55000000, 56000000] },
  { id: 'g1', nombre: 'Mercadeo', nivel: 1, parentId: 'd1', centro: 'VEN', valores: [15000000, 15000000, 16000000, 16000000, 17000000, 17000000, 18000000, 18000000, 19000000, 19000000, 20000000, 20000000] },
  { id: 's1', nombre: 'Publicidad', nivel: 2, parentId: 'g1', centro: 'VEN', valores: [9000000, 9000000, 9500000, 9500000, 10000000, 10000000, 10500000, 10500000, 11000000, 11000000, 11500000, 11500000] },
  { id: 'c1', nombre: 'PUB-001 — Pauta digital', nivel: 3, parentId: 's1', centro: 'VEN', valores: [9000000, 9000000, 9500000, 9500000, 10000000, 10000000, 10500000, 10500000, 11000000, 11000000, 11500000, 11500000] },
  { id: 's2', nombre: 'Eventos', nivel: 2, parentId: 'g1', centro: 'VEN', valores: [6000000, 6000000, 6500000, 6500000, 7000000, 7000000, 7500000, 7500000, 8000000, 8000000, 8500000, 8500000] },
  { id: 'g2', nombre: 'Comercial', nivel: 1, parentId: 'd1', centro: 'VEN', valores: [30000000, 31000000, 31000000, 32000000, 32000000, 33000000, 33000000, 34000000, 34000000, 35000000, 35000000, 36000000] },
  { id: 'd2', nombre: 'ADMINISTRACIÓN', nivel: 0, parentId: null, centro: 'ADM', valores: [22000000, 22000000, 22500000, 22500000, 23000000, 23000000, 23500000, 23500000, 24000000, 24000000, 24500000, 24500000] },
  { id: 'g3', nombre: 'Finanzas', nivel: 1, parentId: 'd2', centro: 'ADM', valores: [22000000, 22000000, 22500000, 22500000, 23000000, 23000000, 23500000, 23500000, 24000000, 24000000, 24500000, 24500000] },
]

let nodoSeq = 100

export function PresupuestoPage() {
  usePageTitle('Presupuesto')
  const { state, toast, audit } = useStore()
  const puede = useCan('presupuesto.ver')
  const habilitado = state.featureFlags.presupuesto

  const [nodos, setNodos] = useState<NodoPresupuesto[]>(NODOS_INI)
  const [sel, setSel] = useState<string | null>('c1')
  const [editando, setEditando] = useState<NodoPresupuesto | null>(null)

  const selNodo = nodos.find((n) => n.id === sel) ?? null

  const agregarHijo = (padreId: string | null) => {
    nodoSeq += 1
    const nivel = padreId === null ? 0 : (nodos.find((n) => n.id === padreId)?.nivel ?? 0) + 1
    const nombres = ['Departamento', 'Grupo', 'Sección', 'Código']
    const nuevo: NodoPresupuesto = {
      id: `n${nodoSeq}`,
      nombre: `Nuevo ${nombres[nivel] ?? 'nodo'}`,
      nivel,
      parentId: padreId,
      centro: selNodo?.centro ?? '',
      valores: Array.from({ length: 12 }, () => 0),
    }
    setNodos((ns) => [...ns, nuevo])
    setSel(nuevo.id)
    setEditando(nuevo)
    toast('info', 'Nodo agregado', `${nombres[nivel] ?? 'Nodo'} creado. Asígnele nombre, centro y valores mensuales.`)
  }

  const grabar = () => {
    if (!editando) return
    setNodos((ns) => ns.map((n) => (n.id === editando.id ? editando : n)))
    setEditando(null)
    audit('Grabar presupuesto', 'Presupuesto', `Nodo ${editando.id} · ${editando.nombre} · ${money(editando.valores.reduce((a, v) => a + v, 0))}`, 'EXITO')
    toast('success', 'Presupuesto grabado', `«${editando.nombre}» quedó grabado con su centro y valores mensuales.`)
  }

  const cancelar = () => {
    setEditando(null)
    toast('info', 'Edición cancelada', 'Los cambios no grabados fueron descartados.')
  }

  if (!habilitado || !puede) {
    return (
      <div className="page">
        <PageHeader title="Presupuesto" subtitle="Presupuesto por departamento, grupo, sección y código" icon="presupuesto" />
        <NoPermissionState perm="presupuesto.ver" />
        <Card tone="warning" icon="lock" title="Funcionalidad deshabilitada">
          <p className="small">Habilitar desde Administración: active la bandera <code>presupuesto</code> en la configuración de la compañía.</p>
        </Card>
      </div>
    )
  }

  const nodosDe = (nivel: number, padreId: string | null = null) =>
    nodos.filter((n) => n.nivel === nivel && (nivel === 0 ? n.parentId === null : n.parentId === padreId))

  const renderNodo = (n: NodoPresupuesto, prof: number) => {
    const hijos = nodos.filter((x) => x.parentId === n.id)
    return (
      <li key={n.id}>
        <div
          className={`tree-row ${sel === n.id ? 'tree-row-selected' : ''}`}
          style={{ paddingLeft: 6 + prof * 16 }}
          onClick={() => { setSel(n.id); setEditando(null) }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') { setSel(n.id); setEditando(null) } }}
        >
          <span className="grow ellipsis">
            {n.nivel === 3 ? <code className="xs">{n.nombre}</code> : <b className={n.nivel === 0 ? 'small' : 'small'}>{n.nombre}</b>}
          </span>
          <span className="xs muted tnum">{money(n.valores.reduce((a, v) => a + v, 0))}</span>
          {n.nivel < 3 && (
            <span onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="ghost" icon="plus" onClick={() => agregarHijo(n.id)}>Agregar</Button>
            </span>
          )}
        </div>
        {hijos.length > 0 && <ul>{hijos.map((h) => renderNodo(h, prof + 1))}</ul>}
      </li>
    )
  }

  const totalAnual = selNodo?.valores.reduce((a, v) => a + v, 0) ?? 0

  return (
    <div className="page">
      <PageHeader
        title="Presupuesto"
        subtitle={`Presupuesto ${state.session.year} · jerarquía departamento → grupo → sección → código.`}
        icon="presupuesto"
        badge={<Badge tone="brand" icon="presupuesto">Año {state.session.year}</Badge>}
        actions={<Button size="sm" icon="plus" onClick={() => agregarHijo(null)}>Agregar departamento</Button>}
      />

      <div className="page-grid">
        <div className="col-4">
          <Card title="Jerarquía" icon="plan" pad>
            {nodos.length === 0 ? (
              <EmptyState icon="presupuesto" title="Sin nodos" detail="Agregue un departamento para comenzar." />
            ) : (
              <ul className="tree">{nodosDe(0).map((n) => renderNodo(n, 0))}</ul>
            )}
          </Card>
        </div>
        <div className="col-8">
          <Card
            title={editando && editando.id === sel ? 'Editando nodo' : 'Detalle del nodo'}
            icon="edit"
            actions={
              editando && editando.id === sel ? (
                <div className="row gap-8">
                  <Button size="sm" icon="save" variant="primary" onClick={grabar}>Grabar</Button>
                  <Button size="sm" icon="x" onClick={cancelar}>Cancelar</Button>
                </div>
              ) : selNodo ? (
                <Button size="sm" icon="edit" onClick={() => setEditando({ ...selNodo })}>Editar</Button>
              ) : undefined
            }
          >
            {!selNodo ? (
              <EmptyState icon="presupuesto" title="Seleccione un nodo" detail="Elija un nodo del árbol para ver y editar sus valores." />
            ) : editando && editando.id === sel ? (
              <div className="stack gap-8">
                <div className="row gap-8">
                  <Field label="Nombre" required>
                    <Input value={editando.nombre} onChange={(v) => setEditando({ ...editando, nombre: v })} width={260} />
                  </Field>
                  <Field label="Centro de costo">
                    <CostCenterPicker value={editando.centro} onChange={(v) => setEditando({ ...editando, centro: v })} width={200} />
                  </Field>
                </div>
                <p className="xs muted bold">VALORES MENSUALES (COP)</p>
                <div className="row gap-4" style={{ flexWrap: 'wrap' }}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <Field key={i} label={nombreMes(i + 1).slice(0, 3)} width={110}>
                      <MoneyInput
                        value={editando.valores[i]}
                        onChange={(v) => setEditando({ ...editando, valores: editando.valores.map((x, j) => (j === i ? v : x)) })}
                        width={110}
                      />
                    </Field>
                  ))}
                </div>
                <div className="row gap-8">
                  <span className="small bold">Total anual:</span>
                  <span className="small tnum bold">{money(editando.valores.reduce((a, v) => a + v, 0))}</span>
                </div>
              </div>
            ) : (
              <div className="stack gap-8">
                <div className="row gap-8">
                  <span className="xs muted bold">NIVEL</span>
                  <Badge tone="outline">{['Departamento', 'Grupo', 'Sección', 'Código'][selNodo.nivel] ?? 'Nodo'}</Badge>
                  <span className="xs muted bold">CENTRO</span>
                  <Badge tone="info">{selNodo.centro || '—'}</Badge>
                </div>
                <div className="table-scroll">
                  <table className="mini-table">
                    <thead>
                      <tr>
                        <th>Mes</th>
                        {Array.from({ length: 12 }, (_, i) => (
                          <th key={i} className="right">{nombreMes(i + 1).slice(0, 3)}</th>
                        ))}
                        <th className="right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="bold">Valor</td>
                        {selNodo.valores.map((v, i) => (
                          <td key={i} className="right tnum">{money(v)}</td>
                        ))}
                        <td className="right tnum bold">{money(totalAnual)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>

          <Card title="Comparación presupuesto vs real" icon="trendUp" className="future-card" actions={<Badge tone="info" icon="star">Futuro</Badge>}>
            <p className="small muted">
              La comparación del presupuesto contra el movimiento real del período estará disponible en una próxima versión.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
