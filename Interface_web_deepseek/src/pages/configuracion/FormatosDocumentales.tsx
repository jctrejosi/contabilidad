/* ============================================================
   CONTABDSI · Configuración → Formatos documentales (editor visual)
   ============================================================ */

import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Select,
  Tabs,
  Textarea,
} from '@/components/ui'
import { usePageTitle } from '@/components/accounting/Widgets'
import { useStore } from '@/state/AppStore'
import { uid } from '@/core/format'

type TipoElemento = 'LEYENDA' | 'IMAGEN' | 'RECTANGULO' | 'LINEA' | 'CAMPO'

interface ElementoFormato {
  id: string
  tipo: TipoElemento
  texto: string
  campo?: string
  x: number
  y: number
  w: number
  h: number
}

interface FormatoDoc {
  code: string
  nombre: string
  descripcion: string
  elementos: ElementoFormato[]
}

const CAMPOS_DISPONIBLES = ['COMPROBANTE', 'DOCUMENTO', 'FECHA', 'TOTALES', 'TERCERO', 'NIT']

const INICIALES: FormatoDoc[] = [
  {
    code: 'CE', nombre: 'Comprobante de egreso', descripcion: 'Formato de comprobante de egreso con totales y firmas.',
    elementos: [
      { id: 'e1', tipo: 'LEYENDA', texto: 'COMPROBANTE DE EGRESO', x: 30, y: 4, w: 40, h: 6 },
      { id: 'e2', tipo: 'CAMPO', campo: 'COMPROBANTE', texto: '', x: 4, y: 14, w: 24, h: 5 },
      { id: 'e3', tipo: 'CAMPO', campo: 'DOCUMENTO', texto: '', x: 4, y: 20, w: 24, h: 5 },
      { id: 'e4', tipo: 'CAMPO', campo: 'FECHA', texto: '', x: 76, y: 14, w: 20, h: 5 },
      { id: 'e5', tipo: 'CAMPO', campo: 'TOTALES', texto: '', x: 60, y: 60, w: 36, h: 8 },
      { id: 'e6', tipo: 'RECTANGULO', texto: '', x: 2, y: 88, w: 96, h: 8 },
      { id: 'e7', tipo: 'LINEA', texto: '', x: 2, y: 46, w: 96, h: 1 },
    ],
  },
  {
    code: 'RC', nombre: 'Recibo de caja', descripcion: 'Formato de recibo de caja.',
    elementos: [
      { id: 'e1', tipo: 'LEYENDA', texto: 'RECIBO DE CAJA', x: 32, y: 4, w: 36, h: 6 },
      { id: 'e2', tipo: 'CAMPO', campo: 'DOCUMENTO', texto: '', x: 4, y: 14, w: 24, h: 5 },
      { id: 'e3', tipo: 'CAMPO', campo: 'TERCERO', texto: '', x: 4, y: 22, w: 50, h: 5 },
      { id: 'e4', tipo: 'CAMPO', campo: 'TOTALES', texto: '', x: 60, y: 55, w: 36, h: 8 },
    ],
  },
  {
    code: 'NOM', nombre: 'Nómina', descripcion: 'Formato de comprobante de nómina.',
    elementos: [
      { id: 'e1', tipo: 'LEYENDA', texto: 'COMPROBANTE DE NÓMINA', x: 26, y: 4, w: 48, h: 6 },
      { id: 'e2', tipo: 'CAMPO', campo: 'FECHA', texto: '', x: 76, y: 12, w: 20, h: 5 },
      { id: 'e3', tipo: 'IMAGEN', texto: '', x: 4, y: 6, w: 14, h: 10 },
      { id: 'e4', tipo: 'CAMPO', campo: 'TOTALES', texto: '', x: 60, y: 70, w: 36, h: 8 },
    ],
  },
]

export function FormatosDocumentalesPage() {
  usePageTitle('Formatos documentales')
  const { toast, audit } = useStore()
  const [formatos, setFormatos] = useState<FormatoDoc[]>(INICIALES)
  const [selCode, setSelCode] = useState('CE')
  const [draft, setDraft] = useState<FormatoDoc | null>(() => INICIALES[0])
  const [elemSel, setElemSel] = useState<string | null>(null)
  const [tab, setTab] = useState('editor')
  const [modalCrear, setModalCrear] = useState<{ nombre: string; code: string } | null>(null)
  const [eliminar, setEliminar] = useState<FormatoDoc | null>(null)
  const dragRef = useRef<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const abrir = (code: string) => {
    const f = formatos.find((x) => x.code === code)
    if (!f) return
    setSelCode(code)
    setDraft({ ...f, elementos: f.elementos.map((e) => ({ ...e })) })
    setElemSel(null)
  }

  const agregarElemento = (tipo: TipoElemento, campo?: string) => {
    if (!draft) return
    const el: ElementoFormato = {
      id: uid('e'),
      tipo,
      texto: tipo === 'LEYENDA' ? 'NUEVA LEYENDA' : '',
      campo,
      x: 10,
      y: 10,
      w: tipo === 'LINEA' ? 40 : 24,
      h: tipo === 'LINEA' ? 1 : tipo === 'IMAGEN' ? 12 : 6,
    }
    const next = { ...draft, elementos: [...draft.elementos, el] }
    setDraft(next)
    setElemSel(el.id)
  }

  const actualizarElemento = (id: string, patch: Partial<ElementoFormato>) => {
    if (!draft) return
    setDraft({ ...draft, elementos: draft.elementos.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const id = dragRef.current
    const canvas = canvasRef.current
    if (!id || !canvas || !draft) return
    const rect = canvas.getBoundingClientRect()
    const el = draft.elementos.find((x) => x.id === id)
    if (!el) return
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100 - el.w / 2)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100 - el.h / 2)
    actualizarElemento(id, { x: Math.max(0, Math.min(100 - el.w, x)), y: Math.max(0, Math.min(100 - el.h, y)) })
    dragRef.current = null
  }

  const guardar = () => {
    if (!draft) return
    setFormatos((prev) => prev.map((f) => (f.code === draft.code ? draft : f)))
    toast('success', 'Formato guardado', `El formato ${draft.code} — ${draft.nombre} quedó guardado.`)
    audit('Guardado de formato documental', 'Formatos', `Formato ${draft.code} — ${draft.nombre} (${draft.elementos.length} elementos)`)
  }

  const cancelar = () => {
    const f = formatos.find((x) => x.code === selCode)
    if (f) setDraft({ ...f, elementos: f.elementos.map((e) => ({ ...e })) })
    toast('info', 'Cambios descartados', 'Se restauró la última versión guardada del formato.')
  }

  const crearFormato = () => {
    if (!modalCrear || !modalCrear.code.trim() || !modalCrear.nombre.trim()) {
      toast('error', 'Datos incompletos', 'Código y nombre del formato son obligatorios.')
      return
    }
    if (formatos.some((f) => f.code === modalCrear.code.trim())) {
      toast('error', 'Código duplicado', `Ya existe el formato ${modalCrear.code}.`)
      return
    }
    const nuevo: FormatoDoc = { code: modalCrear.code.trim().toUpperCase(), nombre: modalCrear.nombre, descripcion: '', elementos: [] }
    setFormatos((prev) => [...prev, nuevo])
    setSelCode(nuevo.code)
    setDraft(nuevo)
    toast('success', 'Formato creado', `Se creó el formato ${nuevo.code} — ${nuevo.nombre}.`)
    audit('Creación de formato documental', 'Formatos', `Formato ${nuevo.code} creado`)
    setModalCrear(null)
  }

  const confirmarEliminar = () => {
    if (!eliminar) return
    setFormatos((prev) => prev.filter((f) => f.code !== eliminar.code))
    if (selCode === eliminar.code) abrir(formatos.find((f) => f.code !== eliminar.code)?.code ?? '')
    toast('success', 'Formato eliminado', `Se eliminó el formato ${eliminar.code}.`)
    audit('Eliminación de formato documental', 'Formatos', `Formato ${eliminar.code} — ${eliminar.nombre} eliminado`)
    setEliminar(null)
  }

  const elem = draft?.elementos.find((e) => e.id === elemSel) ?? null

  const renderElemento = (e: ElementoFormato, editable: boolean): ReactNode => {
    const estilos: Record<string, string | number> = {
      left: `${e.x}%`,
      top: `${e.y}%`,
      width: `${e.w}%`,
      minHeight: `${e.h}%`,
    }
    const cls = `fmt-elem ${editable && elemSel === e.id ? 'sel' : ''}`
    const drag = editable
      ? {
          draggable: true,
          onDragStart: (ev: DragEvent<HTMLDivElement>) => {
            dragRef.current = e.id
            ev.dataTransfer.effectAllowed = 'move'
          },
          onClick: (ev: React.MouseEvent) => {
            ev.stopPropagation()
            setElemSel(e.id)
          },
        }
      : {}
    if (e.tipo === 'LEYENDA') {
      return <div key={e.id} className={`${cls} fmt-leyenda`} style={estilos} {...drag}>{e.texto}</div>
    }
    if (e.tipo === 'IMAGEN') {
      return <div key={e.id} className={`${cls} fmt-img-ph`} style={estilos} {...drag}>IMAGEN</div>
    }
    if (e.tipo === 'RECTANGULO') {
      return <div key={e.id} className={`${cls} fmt-figura`} style={estilos} {...drag} />
    }
    if (e.tipo === 'LINEA') {
      return <div key={e.id} className={`${cls} fmt-figura`} style={{ ...estilos, minHeight: 0, height: 2 }} {...drag} />
    }
    return (
      <div key={e.id} className={`${cls} fmt-campo`} style={estilos} {...drag}>
        {CAMPOS_DISPLAY[e.campo ?? ''] ?? e.campo}
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Formatos documentales"
        subtitle="Editor visual de formatos de impresión por comprobante"
        icon="formato"
        actions={
          <>
            <Button icon="plus" onClick={() => setModalCrear({ nombre: '', code: '' })}>Crear formato</Button>
            <Button variant="primary" icon="save" onClick={guardar} disabled={!draft}>Guardar</Button>
            <Button icon="refresh" onClick={cancelar} disabled={!draft}>Cancelar</Button>
          </>
        }
      />

      <div className="fmt-layout">
        {/* Lista de formatos */}
        <div className="stack gap-8">
          <Card title="Formatos" icon="list" pad>
            <div className="fmt-list">
              {formatos.map((f) => (
                <div key={f.code} className={`fmt-list-item ${selCode === f.code ? 'sel' : ''}`} onClick={() => abrir(f.code)}>
                  <span><b className="mono">{f.code}</b> <span className="muted small">{f.nombre}</span></span>
                  <IconButton icon="trash" label="Eliminar formato" danger size={22} onClick={() => setEliminar(f)} />
                </div>
              ))}
              {formatos.length === 0 && <EmptyState icon="formato" title="Sin formatos" detail="Cree el primer formato." />}
            </div>
          </Card>
          <div className="note-strip" style={{ fontSize: 12 }}>
            Arrastre los elementos dentro del lienzo para posicionarlos.
          </div>
        </div>

        {/* Lienzo */}
        <Card title={draft ? `${draft.code} — ${draft.nombre}` : 'Lienzo'} icon="formato">
          <div className="stack gap-12">
            <div className="fmt-palette">
              <Button size="sm" icon="plus" onClick={() => agregarElemento('LEYENDA')}>Leyenda</Button>
              <Button size="sm" icon="plus" onClick={() => agregarElemento('IMAGEN')}>Imagen</Button>
              <Button size="sm" icon="plus" onClick={() => agregarElemento('RECTANGULO')}>Rectángulo</Button>
              <Button size="sm" icon="plus" onClick={() => agregarElemento('LINEA')}>Línea</Button>
              <Button size="sm" icon="plus" onClick={() => agregarElemento('CAMPO', 'COMPROBANTE')}>Campo: comprobante</Button>
              <Button size="sm" icon="plus" onClick={() => agregarElemento('CAMPO', 'DOCUMENTO')}>Campo: documento</Button>
              <Button size="sm" icon="plus" onClick={() => agregarElemento('CAMPO', 'FECHA')}>Campo: fecha</Button>
              <Button size="sm" icon="plus" onClick={() => agregarElemento('CAMPO', 'TOTALES')}>Campo: totales</Button>
            </div>
            <Tabs
              active={tab}
              onChange={setTab}
              tabs={[{ key: 'editor', label: 'Editor' }, { key: 'preview', label: 'Vista previa' }]}
            />
            {tab === 'editor' ? (
              <div className="fmt-canvas-wrap">
                <div
                  className="fmt-canvas"
                  ref={canvasRef}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => setElemSel(null)}
                >
                  {draft?.elementos.map((e) => renderElemento(e, true))}
                  {draft && draft.elementos.length === 0 && (
                    <p className="muted center" style={{ paddingTop: 240 }}>Agregue elementos con los botones de la paleta.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="fmt-preview-paper">
                {draft?.elementos.map((e) => renderElemento(e, false))}
                <div className="xs muted" style={{ position: 'absolute', bottom: 8, right: 10 }}>{draft?.code} · Vista previa</div>
              </div>
            )}
          </div>
        </Card>

        {/* Propiedades */}
        <Card title="Propiedades del elemento" icon="sliders">
          {elem ? (
            <div className="fmt-props">
              <Field label="Tipo">
                <Badge tone="brand">{TIPO_LABEL[elem.tipo]}</Badge>
              </Field>
              <Field label="Posición X (%)" width={120}>
                <Input type="number" value={elem.x} onChange={(v) => actualizarElemento(elem.id, { x: Number(v) || 0 })} />
              </Field>
              <Field label="Posición Y (%)" width={120}>
                <Input type="number" value={elem.y} onChange={(v) => actualizarElemento(elem.id, { y: Number(v) || 0 })} />
              </Field>
              <Field label="Ancho (%)" width={120}>
                <Input type="number" value={elem.w} onChange={(v) => actualizarElemento(elem.id, { w: Number(v) || 1 })} />
              </Field>
              {elem.tipo !== 'LINEA' && (
                <Field label="Alto (%)" width={120}>
                  <Input type="number" value={elem.h} onChange={(v) => actualizarElemento(elem.id, { h: Number(v) || 1 })} />
                </Field>
              )}
              {elem.tipo === 'LEYENDA' && (
                <Field label="Texto">
                  <Textarea value={elem.texto} onChange={(v) => actualizarElemento(elem.id, { texto: v })} rows={2} />
                </Field>
              )}
              {elem.tipo === 'CAMPO' && (
                <Field label="Campo del documento">
                  <Select
                    value={elem.campo ?? ''}
                    onChange={(v) => actualizarElemento(elem.id, { campo: v })}
                    options={CAMPOS_DISPONIBLES.map((c) => ({ value: c, label: c }))}
                  />
                </Field>
              )}
              <Button size="sm" variant="danger" icon="trash" onClick={() => {
                if (!draft) return
                setDraft({ ...draft, elementos: draft.elementos.filter((x) => x.id !== elem.id) })
                setElemSel(null)
              }}>Eliminar elemento</Button>
            </div>
          ) : (
            <p className="muted small">Seleccione un elemento del lienzo para editar sus propiedades.</p>
          )}
        </Card>
      </div>

      {/* Crear formato */}
      <Modal
        open={modalCrear !== null}
        onClose={() => setModalCrear(null)}
        title="Nuevo formato documental"
        icon="formato"
        width={460}
        footer={
          <>
            <Button onClick={() => setModalCrear(null)}>Cancelar</Button>
            <Button variant="primary" icon="save" onClick={crearFormato}>Crear</Button>
          </>
        }
      >
        <div className="stack gap-12">
          <Field label="Código" required>
            <Input value={modalCrear?.code ?? ''} onChange={(v) => setModalCrear({ code: v.toUpperCase(), nombre: modalCrear?.nombre ?? '' })} placeholder="CE" monospace />
          </Field>
          <Field label="Nombre" required>
            <Input value={modalCrear?.nombre ?? ''} onChange={(v) => setModalCrear({ code: modalCrear?.code ?? '', nombre: v })} placeholder="Comprobante de egreso" />
          </Field>
        </div>
      </Modal>

      <ConfirmModal
        open={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar formato"
        danger
        message={`¿Desea eliminar el formato ${eliminar?.code} — ${eliminar?.nombre}?`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}

const TIPO_LABEL: Record<TipoElemento, string> = {
  LEYENDA: 'Leyenda',
  IMAGEN: 'Imagen',
  RECTANGULO: 'Rectángulo',
  LINEA: 'Línea',
  CAMPO: 'Campo',
}

const CAMPOS_DISPLAY: Record<string, string> = {
  COMPROBANTE: '{Comprobante}',
  DOCUMENTO: '{Documento}',
  FECHA: '{Fecha}',
  TOTALES: '{Totales}',
  TERCERO: '{Tercero}',
  NIT: '{NIT}',
}
