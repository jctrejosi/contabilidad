/* ============================================================
   CONTABDSI · Centro de informes (favoritos, recientes, búsqueda
   y tarjetas por categoría)
   ============================================================ */

import '../consultas/pages.css'

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Icon, IconButton, LoadingState, NoPermissionState, PageHeader, SearchInput } from '@/components/ui'
import { REPORT_CATEGORIES, REPORTS } from '@/data/reports'
import { useCan, useStore } from '@/state/AppStore'
import { useMountLoading } from '@/pages/consultas/Documentos'
import { usePageTitle } from '@/components/accounting/Widgets'
import type { ReportCategory } from '@/core/types'

const FAV_KEY = 'contabdsi.informes.favoritos'
const REC_KEY = 'contabdsi.informes.recientes'

function leerIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    const arr = JSON.parse(raw ?? '[]')
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function guardarIds(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify(ids))
}

const ICONO_CATEGORIA: Record<ReportCategory, string> = {
  documentos: 'doc',
  libros: 'libro',
  estados: 'informe',
  terceros: 'terceros',
  centros: 'centro',
  flujo: 'trendUp',
  nic: 'shield',
  generador: 'sliders',
}

export function InformesHubPage() {
  usePageTitle('Centro de informes')
  const { audit } = useStore()
  const puede = useCan('informes.ver')
  const navigate = useNavigate()
  const loading = useMountLoading(400)

  const [favoritos, setFavoritos] = useState<string[]>(() => leerIds(FAV_KEY))
  const [recientes, setRecientes] = useState<string[]>(() => leerIds(REC_KEY))
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => guardarIds(FAV_KEY, favoritos), [favoritos])
  useEffect(() => guardarIds(REC_KEY, recientes), [recientes])

  const marcarReciente = (id: string) => {
    setRecientes((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 8))
  }

  const abrirReporte = (id: string) => {
    marcarReciente(id)
    audit('Abrir informe', 'Informes', `Informe ${id}`, 'INFO')
    navigate(`/informes/reporte/${id}`)
  }

  const toggleFavorito = (id: string) => {
    setFavoritos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]))
  }

  const favs = favoritos.map((id) => REPORTS.find((r) => r.id === id)).filter((r) => r !== undefined)

  const q = busqueda.trim().toLowerCase()
  const categorias = (Object.keys(REPORT_CATEGORIES) as ReportCategory[]).filter((cat) => {
    if (!q) return true
    if (REPORT_CATEGORIES[cat].toLowerCase().includes(q)) return true
    return REPORTS.some((r) => r.categoria === cat && (r.nombre.toLowerCase().includes(q) || r.descripcion.toLowerCase().includes(q)))
  })

  const porCategoria = (cat: ReportCategory) => REPORTS.filter((r) => r.categoria === cat)

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Centro de informes" icon="informe" />
        <NoPermissionState perm="informes.ver" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Centro de informes"
        subtitle={`${REPORTS.length} informes organizados por categoría · favoritos y recientes guardados localmente`}
        icon="informe"
        badge={<Badge tone="brand">{REPORTS.length} informes</Badge>}
        actions={
          <>
            <Button size="sm" variant="primary" icon="sliders" onClick={() => { marcarReciente('generador'); navigate('/informes/generador') }}>Generador personalizado</Button>
            <Button size="sm" icon="chevronL" onClick={() => navigate(-1)}>Volver</Button>
          </>
        }
      />

      <div className="querybar">
        <SearchInput value={busqueda} onChange={setBusqueda} width={320} placeholder="Buscar informe o categoría…" />
        <span className="muted small">También puede navegar por categoría.</span>
      </div>

      {loading ? (
        <Card><LoadingState label="Cargando centro de informes…" /></Card>
      ) : (
        <>
          {favs.length > 0 && !q && (
            <section aria-label="Favoritos">
              <h2 className="rep-section-title"><Icon name="star" size={16} /> Favoritos <Badge tone="warning">{favs.length}</Badge></h2>
              <div className="rep-grid">
                {favs.map((r) => (
                  <article key={r.id} className="rep-card" onClick={() => abrirReporte(r.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') abrirReporte(r.id) }}>
                    <div className="rep-fav" onClick={(e) => e.stopPropagation()}>
                      <IconButton icon="star" label="Quitar de favoritos" size={24} active onClick={() => toggleFavorito(r.id)} />
                    </div>
                    <div className="rep-card-top">
                      <span className="rep-card-icon"><Icon name={ICONO_CATEGORIA[r.categoria]} size={16} /></span>
                      <div className="rep-card-body">
                        <span className="rep-card-name">{r.nombre}</span>
                        <span className="rep-card-meta"><Badge tone="outline">{REPORT_CATEGORIES[r.categoria]}</Badge></span>
                      </div>
                    </div>
                    <span className="rep-card-desc">{r.descripcion}</span>
                  </article>
                ))}
              </div>
            </section>
          )}

          {recientes.length > 0 && !q && (
            <section aria-label="Recientes">
              <h2 className="rep-section-title"><Icon name="clock" size={16} /> Recientes</h2>
              <div className="rep-chips">
                {recientes.map((rid) => {
                  const esGenerador = rid === 'generador'
                  const r = REPORTS.find((x) => x.id === rid)
                  const nombre = esGenerador ? 'Generador personalizado' : r?.nombre
                  if (!nombre) return null
                  return (
                    <button
                      key={rid}
                      type="button"
                      className="rep-chip"
                      onClick={() => {
                        if (esGenerador) {
                          marcarReciente('generador')
                          navigate('/informes/generador')
                        } else {
                          abrirReporte(rid)
                        }
                      }}
                    >
                      <Icon name={esGenerador ? 'sliders' : r ? ICONO_CATEGORIA[r.categoria] : 'informe'} size={13} className="muted" />
                      {nombre}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {categorias.length === 0 ? (
            <Card>
              <EmptyState icon="lupa" title="Sin coincidencias" detail={`Ninguna categoría o informe coincide con «${busqueda}».`} action={<Button size="sm" onClick={() => setBusqueda('')}>Limpiar búsqueda</Button>} />
            </Card>
          ) : (
            categorias.map((cat) => {
              const informes = porCategoria(cat)
              return (
                <section key={cat} aria-label={REPORT_CATEGORIES[cat]}>
                  <h2 className="rep-section-title">
                    <Icon name={ICONO_CATEGORIA[cat]} size={16} />
                    {REPORT_CATEGORIES[cat]}
                    <Badge tone="neutral">{informes.length}</Badge>
                  </h2>
                  {cat === 'generador' ? (
                    <div className="rep-grid">
                      <article className="rep-card" onClick={() => { marcarReciente('generador'); navigate('/informes/generador') }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') navigate('/informes/generador') }}>
                        <div className="rep-card-top">
                          <span className="rep-card-icon"><Icon name="sliders" size={16} /></span>
                          <div className="rep-card-body">
                            <span className="rep-card-name">Generador personalizado</span>
                            <span className="rep-card-meta"><Badge tone="brand">Personalizado</Badge></span>
                          </div>
                        </div>
                        <span className="rep-card-desc">Arme su propio informe eligiendo renglones, signos, totales, orden y columnas dinámicas.</span>
                      </article>
                    </div>
                  ) : informes.length === 0 ? (
                    <Card>
                      <EmptyState icon="informe" title="Sin informes" detail="Esta categoría no tiene informes disponibles aún." />
                    </Card>
                  ) : (
                    <div className="rep-grid">
                      {informes.map((r) => (
                        <article key={r.id} className="rep-card" onClick={() => abrirReporte(r.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') abrirReporte(r.id) }}>
                          <div className="rep-fav" onClick={(e) => e.stopPropagation()}>
                            <IconButton icon="star" label={favoritos.includes(r.id) ? 'Quitar de favoritos' : 'Marcar favorito'} size={24} active={favoritos.includes(r.id)} onClick={() => toggleFavorito(r.id)} />
                          </div>
                          <div className="rep-card-top">
                            <span className="rep-card-icon"><Icon name={ICONO_CATEGORIA[cat]} size={16} /></span>
                            <div className="rep-card-body">
                              <span className="rep-card-name">{r.nombre}</span>
                            </div>
                          </div>
                          <span className="rep-card-desc">{r.descripcion}</span>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )
            })
          )}
        </>
      )}
    </div>
  )
}
