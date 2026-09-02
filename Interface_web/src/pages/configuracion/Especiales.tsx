/* ============================================================
   CONTABDSI · Configuración → Funciones especiales
   Requiere permiso elevado: config.especiales
   ============================================================ */

import { useRef, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Divider,
  Field,
  Modal,
  NoPermissionState,
  PageHeader,
  ProgressBar,
  Textarea,
} from '@/components/ui'
import { usePageTitle } from '@/components/accounting/Widgets'
import { useCan, useStore } from '@/state/AppStore'

interface FuncionEspecial {
  id: string
  nombre: string
  descripcion: string
  alcance: string
  seccion: 'GENERAL' | 'ANALIZAR_PLAN' | 'ELIMINAR_CERO'
  enDesarrollo?: boolean
}

const FUNCIONES: FuncionEspecial[] = [
  { id: 'paginacion', nombre: 'Paginación', descripcion: 'Repagina los registros de las tablas contables para compactar espacio.', alcance: 'Todas las tablas de movimientos de la compañía activa.', seccion: 'GENERAL' },
  { id: 'depurar-terceros', nombre: 'Depuración de terceros', descripcion: 'Limpia terceros sin movimientos y datos incompletos.', alcance: 'Tabla de terceros · terceros sin documentos asociados.', seccion: 'GENERAL' },
  { id: 'extraer-comprobante', nombre: 'Extraer comprobante', descripcion: 'Extrae todos los documentos de un comprobante a otra compañía o archivo.', alcance: 'Documentos del comprobante seleccionado.', seccion: 'GENERAL' },
  { id: 'extraer-documento', nombre: 'Extraer documento', descripcion: 'Extrae un documento específico con todas sus líneas.', alcance: 'Un documento contable.', seccion: 'GENERAL' },
  { id: 'extraer-movimiento', nombre: 'Extraer movimiento completo', descripcion: 'Extrae todo el movimiento de un rango de cuentas.', alcance: 'Movimiento del rango de cuentas indicado.', seccion: 'GENERAL' },
  { id: 'traslado-saldos', nombre: 'Traslado de saldos entre cuentas (genera lote)', descripcion: 'Traslada saldos de una cuenta a otra generando un lote de ajuste.', alcance: 'Saldos de las cuentas origen/destino.', seccion: 'GENERAL' },
  { id: 'lote-saldos-iniciales', nombre: 'Lote de saldos iniciales', descripcion: 'Genera el lote de saldos iniciales del período.', alcance: 'Todas las cuentas con saldo inicial ≠ 0.', seccion: 'GENERAL' },
  { id: 'reasignar-cuentas', nombre: 'Reasignar cuentas', descripcion: 'Reemplaza una cuenta por otra en todos los documentos.', alcance: 'Movimiento histórico y lotes pendientes.', seccion: 'GENERAL' },
  { id: 'reasignar-centros', nombre: 'Reasignar centros', descripcion: 'Reemplaza un centro de costo por otro en los documentos.', alcance: 'Movimiento histórico y lotes pendientes.', seccion: 'GENERAL' },
  { id: 'revisar-bases', nombre: 'Revisar bases IVA/retención', descripcion: 'Verifica bases y tarifas de IVA y retención contra la configuración vigente.', alcance: 'Documentos con líneas clase IVA o RETENCION.', seccion: 'GENERAL' },
  { id: 'convertir-lote', nombre: 'Convertir lote', descripcion: 'Convierte un lote a documento directo o cambia su comprobante.', alcance: 'El lote seleccionado.', seccion: 'GENERAL' },
  { id: 'reconstruir-documentos', nombre: 'Reconstruir documentos', descripcion: 'Reconstruye documentos desde las líneas de movimiento.', alcance: 'Documentos del rango de fechas indicado.', seccion: 'GENERAL' },
  { id: 'reasignar-mes', nombre: 'Reasignar mes', descripcion: 'Cambia el período de un conjunto de documentos.', alcance: 'Documentos del mes origen.', seccion: 'GENERAL' },
  { id: 'estructuras-lotes', nombre: 'Actualizar estructuras de lotes', descripcion: 'Actualiza la estructura de lotes según el catálogo vigente.', alcance: 'Todos los lotes abiertos.', seccion: 'GENERAL' },
  { id: 'distribuir-terceros', nombre: 'Distribuir por terceros', descripcion: 'Distribuye líneas de una cuenta resumen entre los terceros con movimiento.', alcance: 'Cuenta resumen seleccionada.', seccion: 'GENERAL' },
  { id: 'detectar-duplicados', nombre: 'Detectar / depurar duplicados', descripcion: 'Detecta documentos duplicados y permite depurarlos.', alcance: 'Documentos del período.', seccion: 'GENERAL' },
  { id: 'extraer-doc-centro', nombre: 'Extraer por documento + centro', descripcion: 'Extrae líneas de un documento filtradas por centro de costo.', alcance: 'Un documento + centro.', seccion: 'GENERAL' },
  { id: 'extraer-mes-incorrecto', nombre: 'Extraer mes incorrecto', descripcion: 'Extrae documentos registrados en un mes que no corresponde.', alcance: 'Documentos con fecha fuera del período.', seccion: 'GENERAL' },
  { id: 'extraer-lote-usuario', nombre: 'Extraer por lote + usuario', descripcion: 'Extrae los lotes creados por un usuario específico.', alcance: 'Lotes del usuario indicado.', seccion: 'GENERAL' },
  { id: 'generar-tipo-doc', nombre: 'Generar por tipo documental', descripcion: 'Genera documentos por tipo documental desde un rango de lotes.', alcance: 'Lotes del rango indicado.', seccion: 'GENERAL' },
  { id: 'actualizar-nombres', nombre: 'Actualizar nombres de terceros', descripcion: 'Normaliza mayúsculas y nombres de terceros según los datos maestros.', alcance: 'Todos los terceros.', seccion: 'GENERAL' },
  { id: 'exportar-mes', nombre: 'Exportar mes completo', descripcion: 'Exporta todo el movimiento de un mes a un archivo externo.', alcance: 'Documentos del mes seleccionado.', seccion: 'GENERAL' },
  { id: 'analizar-plan-nivel', nombre: 'Analizar plan por nivel', descripcion: 'Analiza la estructura del plan por nivel y detecta inconsistencias.', alcance: 'Plan de cuentas (solo lectura).', seccion: 'ANALIZAR_PLAN' },
  { id: 'validar-estructura', nombre: 'Validar estructura del plan', descripcion: 'Valida padres, hijos y niveles del plan de cuentas.', alcance: 'Plan de cuentas (solo lectura).', seccion: 'ANALIZAR_PLAN' },
  { id: 'cuentas-sin-movimiento', nombre: 'Cuentas sin movimiento en cero', descripcion: 'Lista cuentas en cero sin movimiento para revisión.', alcance: 'Plan de cuentas (solo lectura).', seccion: 'ANALIZAR_PLAN' },
  { id: 'eliminar-cuentas-cero', nombre: 'Eliminar cuentas en cero', descripcion: 'Elimina definitivamente cuentas con saldo y movimiento en cero.', alcance: 'Plan de cuentas — ELIMINACIÓN FÍSICA.', seccion: 'ELIMINAR_CERO' },
  { id: 'depurar-cuentas-sin-mov', nombre: 'Depurar cuentas sin movimiento', descripcion: 'Marca cuentas sin movimiento para depuración posterior.', alcance: 'Plan de cuentas — depuración lógica.', seccion: 'ELIMINAR_CERO' },
  { id: 'fusion-movimientos', nombre: 'Fusión de movimientos', descripcion: 'Fusiona movimientos duplicados en un solo registro.', alcance: 'Movimiento histórico.', seccion: 'GENERAL', enDesarrollo: true },
]

export function EspecialesPage() {
  usePageTitle('Funciones especiales')
  const { toast, audit } = useStore()
  const puede = useCan('config.especiales')
  const [ejecutar, setEjecutar] = useState<FuncionEspecial | null>(null)
  const [motivo, setMotivo] = useState('')
  const [corriendo, setCorriendo] = useState<{ paso: string; pct: number } | null>(null)
  const timerRef = useRef<number | null>(null)

  if (!puede) {
    return (
      <div className="page">
        <PageHeader title="Funciones especiales" icon="especial" />
        <Card><NoPermissionState perm="config.especiales" /></Card>
      </div>
    )
  }

  const iniciar = () => {
    if (!ejecutar || motivo.trim().length < 10) {
      toast('error', 'Motivo requerido', 'El motivo debe tener al menos 10 caracteres.')
      return
    }
    setCorriendo({ paso: 'Preparando operación…', pct: 10 })
    const pasos = ['Validando bloqueos y permisos…', 'Ejecutando operación sobre las tablas…', 'Verificando integridad…', 'Registrando trazabilidad…']
    let i = 0
    timerRef.current = window.setInterval(() => {
      i += 1
      if (i < pasos.length) {
        setCorriendo({ paso: pasos[i], pct: 15 + i * 25 })
      } else {
        if (timerRef.current) window.clearInterval(timerRef.current)
        setCorriendo(null)
        toast('success', 'Operación ejecutada', `«${ejecutar.nombre}» se ejecutó correctamente.`)
        audit(ejecutar.nombre, 'Funciones especiales', `${ejecutar.nombre} · alcance: ${ejecutar.alcance} · motivo: ${motivo}`)
        setEjecutar(null)
        setMotivo('')
      }
    }, 500)
  }

  const secciones: { key: FuncionEspecial['seccion']; titulo: string; icon: string }[] = [
    { key: 'GENERAL', titulo: 'Funciones generales', icon: 'especial' },
    { key: 'ANALIZAR_PLAN', titulo: 'Analizar plan', icon: 'plan' },
    { key: 'ELIMINAR_CERO', titulo: 'Eliminar cuentas en cero', icon: 'trash' },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Funciones especiales"
        subtitle="Operaciones de alto riesgo sobre datos contables · permiso config.especiales"
        icon="especial"
        badge={<Badge tone="danger" icon="shield">Acceso elevado</Badge>}
      />

      {secciones.map((s) => (
        <div key={s.key} className="stack gap-8">
          <Divider label={s.titulo} />
          <div className="fn-grid">
            {FUNCIONES.filter((f) => f.seccion === s.key).map((f) => (
              <div key={f.id} className="fn-card">
                <h4>
                  {s.key === 'ELIMINAR_CERO' ? <Badge tone="danger" icon="trash">Eliminación</Badge> : s.key === 'ANALIZAR_PLAN' ? <Badge tone="info" icon="plan">Análisis</Badge> : null}
                  {f.nombre}
                  {f.enDesarrollo ? <Badge tone="warning" icon="clock">En desarrollo</Badge> : null}
                </h4>
                <p>{f.descripcion}</p>
                <span className="spacer" />
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <Button
                    size="sm"
                    variant={s.key === 'ELIMINAR_CERO' ? 'danger' : 'secondary'}
                    icon="play"
                    disabled={f.enDesarrollo}
                    onClick={() => { setEjecutar(f); setMotivo('') }}
                  >
                    {f.enDesarrollo ? 'No disponible' : 'Ejecutar'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Confirmación con alcance y motivo */}
      <Modal
        open={ejecutar !== null && corriendo === null}
        onClose={() => setEjecutar(null)}
        title={ejecutar?.nombre ?? ''}
        icon={ejecutar?.seccion === 'ELIMINAR_CERO' ? 'trash' : 'especial'}
        width={560}
        tone={ejecutar?.seccion === 'ELIMINAR_CERO' ? 'danger' : undefined}
        footer={
          <>
            <Button onClick={() => setEjecutar(null)}>Cancelar</Button>
            <Button variant={ejecutar?.seccion === 'ELIMINAR_CERO' ? 'danger' : 'primary'} icon="play" onClick={iniciar} disabled={motivo.trim().length < 10}>Ejecutar</Button>
          </>
        }
      >
        {ejecutar && (
          <div className="stack gap-12">
            <p className="modal-message">{ejecutar.descripcion}</p>
            <div className="infostrip">
              <div className="infostrip-item"><span className="xs muted">Alcance</span><span className="small bold">{ejecutar.alcance}</span></div>
              <div className="infostrip-item"><span className="xs muted">Sección</span><span className="small bold">{ejecutar.seccion === 'ELIMINAR_CERO' ? 'Eliminar cuentas en cero' : ejecutar.seccion === 'ANALIZAR_PLAN' ? 'Analizar plan' : 'General'}</span></div>
            </div>
            <Field label="Motivo de la operación" required hint="Quedará en la bitácora de auditoría (mín. 10 caracteres).">
              <Textarea value={motivo} onChange={setMotivo} rows={3} placeholder="Explique por qué se ejecuta esta función…" />
            </Field>
          </div>
        )}
      </Modal>

      {/* Progreso de ejecución */}
      <Modal open={corriendo !== null} onClose={() => undefined} title="Ejecutando operación" icon="clock" width={480}>
        <div className="stack gap-12">
          <ProgressBar pct={corriendo?.pct ?? 0} tone="brand" label="Progreso de la operación" />
          <p className="small muted">{corriendo?.paso}</p>
        </div>
      </Modal>
    </div>
  )
}
