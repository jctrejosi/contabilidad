/* ============================================================
   CONTABDSI · Configuración → Centros de costo (jerarquía)
   ============================================================ */

import { useMemo, useState, type ReactNode } from 'react'
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
} from '@/components/ui'
import { ExportMenu, downloadCsv, usePageTitle } from '@/components/accounting/Widgets'
import { useStore } from '@/state/AppStore'
import type { Centro } from '@/core/types'

export function CentrosPage() {
  usePageTitle('Centros de costo')
  const { state, toast, audit } = useStore()
  const [centros, setCentros] = useState<Centro[]>(() => state.centros.map((c) => ({ ...c })))
  const [selCode, setSelCode] = useState<string>('ADM')
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; draft: Centro } | null>(null)
  const [eliminar, setEliminar] = useState<Centro | null>(null)

  const hijosDe = (code: string) => centros.filter((c) => c.parent === code).sort((a, b) => a.code.localeCompare(b.code))

  const visibles = useMemo(() => {
    const q = busqueda.toLowerCase()
    const match = new Set<string>()
    centros.forEach((c) => {
      if (!q || c.code.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q)) {
        match.add(c.code)
        // incluir ancestros
        let p = c.parent
        while (p) {
          match.add(p)
          p = centros.find((x) => x.code === p)?.parent
        }
      }
    })
    return match
  }, [centros, busqueda])

  const nivelMaximo = (parent?: string): number => {
    if (!parent) return 1
    const p = centros.find((c) => c.code === parent)
    return (p?.nivel ?? 1) + 1
  }

  const renderRama = (code: string, depth: number): ReactNode => {
    const nodo = centros.find((c) => c.code === code)
    if (!nodo) return null
    return (
      <div key={code}>
        <div
          className={`cfg-tree-row ${selCode === code ? 'sel' : ''}`}
          style={{ paddingLeft: 8 + depth * 18 }}
          onClick={() => setSelCode(code)}
          role="treeitem"
          aria-selected={selCode === code}
        >
          <span className="cfg-tree-code">{nodo.code}</span>
          <span className="cfg-tree-name">{nodo.nombre}</span>
          <span className="cfg-tree-lvl">N{nodo.nivel}</span>
          <span className="spacer" />
          <span className="xs muted">{hijosDe(code).length > 0 ? `${hijosDe(code).length} hijos` : ''}</span>
        </div>
        {hijosDe(code).filter((h) => visibles.has(h.code)).map((h) => renderRama(h.code, depth + 1))}
      </div>
    )
  }

  const raices = centros.filter((c) => !c.parent).sort((a, b) => a.code.localeCompare(b.code))

  const guardar = () => {
    if (!modal) return
    const { modo, draft } = modal
    if (!draft.code.trim() || !draft.nombre.trim()) {
      toast('error', 'Datos incompletos', 'El código y el nombre del centro son obligatorios.')
      return
    }
    if (modo === 'crear') {
      if (centros.some((c) => c.code === draft.code.trim())) {
        toast('error', 'Código duplicado', `Ya existe el centro ${draft.code}.`)
        return
      }
      setCentros((prev) => [...prev, { ...draft, code: draft.code.trim() }])
      setSelCode(draft.code.trim())
      toast('success', 'Centro creado', `Se creó el centro ${draft.code} — ${draft.nombre}.`)
      audit('Creación de centro', 'Centros de costo', `Centro ${draft.code} — ${draft.nombre} (nivel ${draft.nivel}) creado`)
    } else {
      setCentros((prev) => prev.map((c) => (c.code === draft.code ? draft : c)))
      toast('success', 'Centro actualizado', `El centro ${draft.code} quedó actualizado.`)
      audit('Actualización de centro', 'Centros de costo', `Centro ${draft.code} — ${draft.nombre} modificado`)
    }
    setModal(null)
  }

  const confirmarEliminar = () => {
    if (!eliminar) return
    setCentros((prev) => prev.filter((c) => c.code !== eliminar.code && c.parent !== eliminar.code))
    setSelCode(centros[0]?.code ?? '')
    toast('success', 'Centro eliminado', `Se eliminó el centro ${eliminar.code} y sus dependientes.`)
    audit('Eliminación de centro', 'Centros de costo', `Centro ${eliminar.code} — ${eliminar.nombre} eliminado`)
    setEliminar(null)
  }

  const sel = centros.find((c) => c.code === selCode)

  return (
    <div className="page">
      <PageHeader
        title="Centros de costo"
        subtitle="Estructura jerárquica de centros para distribución de costos"
        icon="centro"
        actions={
          <>
            <ExportMenu
              filename="centros"
              onExport={() =>
                downloadCsv(
                  [['Código', 'Nombre', 'Nivel', 'Padre'], ...centros.map((c) => [c.code, c.nombre, String(c.nivel), c.parent ?? ''])],
                  'centros.csv',
                )
              }
            />
            <Button variant="primary" icon="plus" onClick={() => setModal({ modo: 'crear', draft: { code: '', nombre: '', nivel: 1 } })}>Crear</Button>
          </>
        }
      />

      <div className="master-split">
        <Card title="Jerarquía" icon="list" pad={false} actions={<SearchInputLite value={busqueda} onChange={setBusqueda} />}>
          <div className="cfg-tree" role="tree">
            {raices.filter((r) => visibles.has(r.code)).map((r) => renderRama(r.code, 0))}
          </div>
        </Card>

        <div className="master-detail">
          <Card
            title={sel ? `${sel.code} — ${sel.nombre}` : 'Centro'}
            icon="centro"
            actions={
              sel ? (
                <div className="row gap-8">
                  <Button size="sm" icon="edit" onClick={() => setModal({ modo: 'editar', draft: { ...sel } })}>Modificar</Button>
                  <Button size="sm" icon="trash" danger onClick={() => setEliminar(sel)}>Eliminar</Button>
                  <Button size="sm" icon="plus" onClick={() => setModal({ modo: 'crear', draft: { code: '', nombre: '', nivel: nivelMaximo(sel.code), parent: sel.code } })}>Crear hijo</Button>
                </div>
              ) : undefined
            }
          >
            {sel ? (
              <div className="det-grid">
                <div className="det-item"><span className="det-label">Código</span><span className="det-value mono">{sel.code}</span></div>
                <div className="det-item"><span className="det-label">Nombre</span><span className="det-value">{sel.nombre}</span></div>
                <div className="det-item"><span className="det-label">Nivel</span><span className="det-value"><Badge tone="brand">Nivel {sel.nivel}</Badge></span></div>
                <div className="det-item"><span className="det-label">Centro padre</span><span className="det-value mono">{sel.parent ?? '— (raíz)'}</span></div>
                <div className="det-item"><span className="det-label">Hijos directos</span><span className="det-value">{hijosDe(sel.code).map((h) => h.code).join(', ') || '—'}</span></div>
              </div>
            ) : (
              <p className="muted">Seleccione un centro en el árbol para ver sus detalles.</p>
            )}
          </Card>

          <Card title="Centros dependientes" icon="list">
            {sel && hijosDe(sel.code).length > 0 ? (
              <table className="sim-table">
                <thead>
                  <tr><th>Código</th><th>Nombre</th><th>Nivel</th></tr>
                </thead>
                <tbody>
                  {hijosDe(sel.code).map((h) => (
                    <tr key={h.code}>
                      <td className="mono">{h.code}</td>
                      <td>{h.nombre}</td>
                      <td>Nivel {h.nivel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">Este centro no tiene dependientes.</p>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nuevo centro de costo' : `Centro ${modal?.draft.code ?? ''}`}
        icon="centro"
        width={520}
        footer={
          <>
            <Button onClick={() => setModal(null)}>Cancelar</Button>
            <Button variant="primary" icon="save" onClick={guardar}>Guardar</Button>
          </>
        }
      >
        {modal && (
          <div className="stack gap-12">
            <div className="row gap-8">
              <Field label="Código" required width={150}>
                <Input value={modal.draft.code} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, code: v.toUpperCase() } })} placeholder="ADM-CON" monospace disabled={modal.modo === 'editar'} />
              </Field>
              <Field label="Nivel" required width={110}>
                <Input type="number" value={modal.draft.nivel} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nivel: Number(v) || 1 } })} />
              </Field>
            </div>
            <Field label="Nombre" required>
              <Input value={modal.draft.nombre} onChange={(v) => setModal({ ...modal, draft: { ...modal.draft, nombre: v } })} placeholder="Contabilidad y finanzas" />
            </Field>
            <Field label="Centro padre" hint="Los centros raíz no tienen padre.">
              <Select
                value={modal.draft.parent ?? ''}
                onChange={(v) => {
                  const p = centros.find((c) => c.code === v)
                  setModal({ ...modal, draft: { ...modal.draft, parent: v || undefined, nivel: p ? p.nivel + 1 : 1 } })
                }}
                options={centros.filter((c) => c.code !== modal.draft.code).map((c) => ({ value: c.code, label: `${c.code} — ${c.nombre}` }))}
                placeholder="Ninguno (raíz)"
              />
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar centro"
        danger
        message={
          hijosDe(eliminar?.code ?? '').length > 0
            ? `El centro ${eliminar?.code} tiene ${hijosDe(eliminar?.code ?? '').length} centro(s) dependiente(s). Al eliminar se eliminarán también sus hijos.`
            : `¿Desea eliminar el centro ${eliminar?.code} — ${eliminar?.nombre}?`
        }
        confirmLabel="Eliminar"
      />
    </div>
  )
}

/** Buscador compacto para el árbol (evita duplicar el del grid) */
function SearchInputLite({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input value={value} onChange={onChange} placeholder="Buscar centro…" width={170} className="search-lite" />
  )
}
