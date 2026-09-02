/* ============================================================
   CONTABDSI · Administración → Integraciones
   Requiere permiso: admin.integraciones
   ============================================================ */

import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Divider,
  Icon,
  NoPermissionState,
  PageHeader,
} from '@/components/ui'
import { usePageTitle } from '@/components/accounting/Widgets'
import { useCan, useStore } from '@/state/AppStore'
import { fechaHora } from '@/core/format'

type EstadoIntegracion = 'CONECTADO' | 'DESCONECTADO' | 'BLOQUEADO'

interface Integracion {
  code: string
  nombre: string
  icon: string
  estado: EstadoIntegracion
  ultimoSync: string
  descripcion: string
}

const INICIALES: Integracion[] = [
  { code: 'FAC', nombre: 'Facturación', icon: 'doc', estado: 'CONECTADO', ultimoSync: '2026-02-27T18:30:00', descripcion: 'Documentos electrónicos y facturas de venta.' },
  { code: 'CAR', nombre: 'Cartera', icon: 'trendUp', estado: 'CONECTADO', ultimoSync: '2026-02-27T06:00:00', descripcion: 'Saldos de clientes y recaudos.' },
  { code: 'INV', nombre: 'Inventario', icon: 'list', estado: 'DESCONECTADO', ultimoSync: '2026-02-10T14:00:00', descripcion: 'Kardex y costos de inventario.' },
  { code: 'CXP', nombre: 'Cuentas por pagar', icon: 'salida', estado: 'CONECTADO', ultimoSync: '2026-02-27T18:30:00', descripcion: 'Proveedores y obligaciones por pagar.' },
  { code: 'NOM', nombre: 'Nómina externa', icon: 'nomina', estado: 'BLOQUEADO', ultimoSync: '2026-01-15T09:00:00', descripcion: 'Integración de nómina con software externo.' },
]

const FUNCIONES_COMPARTIDAS = [
  { code: 'VEH', nombre: 'Vehículos', icon: 'carro', dato: 'Referencia técnica compartida con módulos de ventas/inventario. No forma parte del menú contable.' },
  { code: 'ZON', nombre: 'Zonas', icon: 'chip', dato: 'La zona SÍ forma parte del tercero contable (campo zona en la tabla de terceros).' },
  { code: 'EVE', nombre: 'Eventos', icon: 'calendario', dato: 'Eventos comerciales compartidos. Referencia técnica, no enlazada al menú contable.' },
  { code: 'CIU', nombre: 'Ciudades', icon: 'terceros', dato: 'La ciudad SÍ forma parte del tercero contable (campo ciudad en la tabla de terceros).' },
]

export function IntegracionesPage() {
  usePageTitle('Integraciones')
  const { toast, audit } = useStore()
  const puede = useCan('admin.integraciones')
  const [modulos, setModulos] = useState<Integracion[]>(INICIALES)
  const [probando, setProbando] = useState<string | null>(null)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Integraciones" icon="integracion" />
        <Card><NoPermissionState perm="admin.integraciones" /></Card>
      </div>
    )
  }

  const probar = (m: Integracion) => {
    setProbando(m.code)
    window.setTimeout(() => {
      setProbando(null)
      if (m.estado === 'BLOQUEADO') {
        toast('error', 'Conexión bloqueada', `${m.nombre}: el conector está bloqueado por el administrador del sistema legado.`)
        audit('Prueba de conexión', 'Integraciones', `${m.nombre} — conexión bloqueada`, 'FALLO')
      } else {
        setModulos((prev) => prev.map((x) => (x.code === m.code ? { ...x, estado: 'CONECTADO' } : x)))
        toast('success', 'Conexión exitosa', `${m.nombre} respondió correctamente al ping.`)
        audit('Prueba de conexión', 'Integraciones', `${m.nombre} — conexión exitosa`)
      }
    }, 400)
  }

  const sincronizar = (m: Integracion) => {
    setProbando(m.code)
    window.setTimeout(() => {
      setProbando(null)
      setModulos((prev) => prev.map((x) => (x.code === m.code ? { ...x, ultimoSync: new Date().toISOString() } : x)))
      toast('success', 'Sincronización completada', `${m.nombre} sincronizado con el sistema contable.`)
      audit('Sincronización de módulo', 'Integraciones', `${m.nombre} sincronizado correctamente`)
    }, 400)
  }

  const estadoBadge = (e: EstadoIntegracion) =>
    e === 'CONECTADO' ? <Badge tone="success" icon="link">Conectado</Badge> : e === 'DESCONECTADO' ? <Badge tone="warning" icon="warn">Desconectado</Badge> : <Badge tone="danger" icon="lock">Bloqueado</Badge>

  return (
    <div className="page">
      <PageHeader
        title="Integraciones"
        subtitle="Tablero de conexión con módulos externos · permiso admin.integraciones"
        icon="integracion"
      />

      <Card tone="warning" title="Almacenamiento legado" icon="warn">
        <div className="note-strip" style={{ border: 'none', background: 'transparent', padding: 0 }}>
          <Badge tone="warning" icon="error">Indisponible</Badge>
          <span>
            El almacenamiento de datos legado (exportación a sistemas de terceros) está <b>bloqueado</b> por el administrador del sistema.
            Las sincronizaciones de módulos externos continuarán funcionando, pero las exportaciones al repositorio legado están suspendidas.
          </span>
        </div>
      </Card>

      <div className="integ-grid">
        {modulos.map((m) => (
          <Card key={m.code} title={m.nombre} icon={m.icon} actions={estadoBadge(m.estado)}>
            <div className="integ-card-body">
              <p className="small muted">{m.descripcion}</p>
              <div className="integ-meta">
                <div className="integ-meta-row"><span className="xs muted">Último sync</span><span className="tnum small">{fechaHora(m.ultimoSync)}</span></div>
                <div className="integ-meta-row"><span className="xs muted">Conector</span><span className="mono small">{m.code}-CONN-01</span></div>
              </div>
              {probando === m.code ? (
                <div className="state" style={{ padding: 16 }}>
                  <span className="spinner" style={{ width: 20, height: 20 }} role="status" aria-label="Cargando" />
                  <p className="state-detail small">Procesando solicitud…</p>
                </div>
              ) : (
                <div className="row gap-8">
                  <Button size="sm" icon="play" onClick={() => probar(m)}>Probar conexión</Button>
                  <Button size="sm" variant="subtle" icon="refresh" onClick={() => sincronizar(m)} disabled={m.estado === 'BLOQUEADO'}>Sincronizar</Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Divider label="Funciones compartidas de referencia técnica (no enlazadas al menú contable)" />
      <Card title="Datos compartidos con otros módulos" icon="link">
        <div className="stack gap-4">
          {FUNCIONES_COMPARTIDAS.map((f) => (
            <div key={f.code} className="card" style={{ boxShadow: 'none' }}>
              <button className="collapse-head" onClick={() => {
                const next = new Set(abiertos)
                if (next.has(f.code)) next.delete(f.code)
                else next.add(f.code)
                setAbiertos(next)
              }}>
                <Icon name={abiertos.has(f.code) ? 'chevronD' : 'chevronR'} size={14} />
                <Badge tone="brand">{f.code}</Badge>
                {f.nombre}
              </button>
              {abiertos.has(f.code) && <p className="small muted" style={{ padding: '4px 12px 10px' }}>{f.dato}</p>}
            </div>
          ))}
        </div>
        <p className="xs muted" style={{ marginTop: 10 }}>
          Aclaración: <b>ciudad</b> y <b>zona</b> sí forman parte del tercero contable; vehículos y eventos son referencias técnicas de otros módulos (ventas/inventario) y no se gestionan desde contabilidad.
        </p>
      </Card>
    </div>
  )
}
