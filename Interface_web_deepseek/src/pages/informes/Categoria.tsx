/* ============================================================
   CONTABDSI · Categoría de informes (/informes/:categoria)
   ============================================================ */

import '../consultas/pages.css'

import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, ErrorState, Icon, IconButton, LoadingState, NoPermissionState, PageHeader, SearchInput } from '@/components/ui'
import { REPORT_CATEGORIES, REPORTS } from '@/data/reports'
import { useCan, useStore } from '@/state/AppStore'
import { useMountLoading } from '@/pages/consultas/Documentos'
import { usePageTitle } from '@/components/accounting/Widgets'
import type { ReportCategory } from '@/core/types'

const REC_KEY = 'contabdsi.informes.recientes'
const FAV_KEY = 'contabdsi.informes.favoritos'

const ICONO: Record<ReportCategory, string> = {
  documentos: 'doc',
  libros: 'libro',
  estados: 'informe',
  terceros: 'terceros',
  centros: 'centro',
  flujo: 'trendUp',
  nic: 'shield',
  generador: 'sliders',
}

function leerIds(key: string): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function CategoriaInformesPage() {
  const { categoria } = useParams()
  const { audit } = useStore()
  const puede = useCan('informes.ver')
  const navigate = useNavigate()
  const loading = useMountLoading(400)
  const [busqueda, setBusqueda] = useState('')
  const [favoritos, setFavoritos] = useState<string[]>(() => leerIds(FAV_KEY))

  const valida = categoria !== undefined && Object.prototype.hasOwnProperty.call(REPORT_CATEGORIES, categoria)
  const cat = valida ? (categoria as ReportCategory) : 'documentos'
  usePageTitle(valida ? REPORT_CATEGORIES[cat] : 'Categoría no encontrada')

  useEffect(() => {
    if (!valida) return
    setFavoritos(leerIds(FAV_KEY))
  }, [categoria, valida])

  const toggleFavorito = (id: string) => {
    setFavoritos((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]
      localStorage.setItem(FAV_KEY, JSON.stringify(next))
      return next
    })
  }

  const abrir = (id: string) => {
    const recientes = leerIds(REC_KEY)
    localStorage.setItem(REC_KEY, JSON.stringify([id, ...recientes.filter((x) => x !== id)].slice(0, 8)))
    audit('Abrir informe', 'Informes', `Informe ${id} desde categoría ${cat}`, 'INFO')
    navigate(`/informes/reporte/${id}`)
  }

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Informes" icon="informe" />
        <NoPermissionState perm="informes.ver" />
      </div>
    )
  }

  if (!valida) {
    return (
      <div className="page">
        <PageHeader title="Categoría no encontrada" icon="error" />
        <Card>
          <ErrorState
            title="La categoría no existe"
            detail={<span>«{categoria ?? ''}» no corresponde a ninguna categoría de informes válida.</span>}
            onRetry={() => navigate('/informes')}
          />
        </Card>
      </div>
    )
  }

  if (cat === 'generador') {
    return <Navigate to="/informes/reporte/generador" replace />
  }

  const q = busqueda.trim().toLowerCase()
  const informes = REPORTS.filter((r) => r.categoria === cat).filter((r) => !q || r.nombre.toLowerCase().includes(q) || r.descripcion.toLowerCase().includes(q))

  return (
    <div className="page">
      <PageHeader
        title={REPORT_CATEGORIES[cat]}
        subtitle="Seleccione un informe para configurar parámetros, generar y exportar"
        icon={ICONO[cat]}
        badge={<Badge tone="brand">{informes.length} informes</Badge>}
        actions={
          <>
            <SearchInput value={busqueda} onChange={setBusqueda} width={240} placeholder="Filtrar informes…" />
            <Button size="sm" icon="chevronL" onClick={() => navigate('/informes')}>Volver</Button>
          </>
        }
      />

      {loading ? (
        <Card><LoadingState label={`Cargando informes de ${REPORT_CATEGORIES[cat].toLowerCase()}…`} /></Card>
      ) : informes.length === 0 ? (
        <Card>
          <EmptyState icon="lupa" title="Sin informes" detail={q ? `Ningún informe coincide con «${busqueda}».` : 'Esta categoría no tiene informes disponibles.'} action={q ? <Button size="sm" onClick={() => setBusqueda('')}>Limpiar búsqueda</Button> : undefined} />
        </Card>
      ) : (
        <div className="rep-grid">
          {informes.map((r) => (
            <article key={r.id} className="rep-card" onClick={() => abrir(r.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') abrir(r.id) }}>
              <div className="rep-fav" onClick={(e) => e.stopPropagation()}>
                <IconButton icon="star" label={favoritos.includes(r.id) ? 'Quitar de favoritos' : 'Marcar favorito'} size={24} active={favoritos.includes(r.id)} onClick={() => toggleFavorito(r.id)} />
              </div>
              <div className="rep-card-top">
                <span className="rep-card-icon"><Icon name={ICONO[cat]} size={16} /></span>
                <div className="rep-card-body">
                  <span className="rep-card-name">{r.nombre}</span>
                  <span className="rep-card-meta">{r.params.length} parámetros · {r.columns.length} columnas</span>
                </div>
              </div>
              <span className="rep-card-desc">{r.descripcion}</span>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
