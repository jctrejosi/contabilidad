/* ============================================================
   CONTABDSI · Router principal
   ============================================================ */

import { HashRouter, Route, Routes } from 'react-router-dom'
import { StoreProvider } from '@/state/AppStore'
import { Shell } from '@/shell/Shell'
import { DashboardPage } from '@/pages/Dashboard'
import { DocumentoOficialPage } from '@/pages/DocumentoOficial'
import { CapturaDirectaPage } from '@/pages/movimientos/CapturaDirecta'
import { LotesListaPage } from '@/pages/movimientos/LotesLista'
import { LoteEditorPage } from '@/pages/movimientos/LoteEditor'
import { AnulacionPage } from '@/pages/movimientos/Anulacion'
import { ImportacionesPage } from '@/pages/movimientos/Importaciones'
import { NominaPage } from '@/pages/movimientos/Nomina'
import { ReembolsosPage } from '@/pages/movimientos/Reembolsos'
import { ConsultaDocumentosPage } from '@/pages/consultas/Documentos'
import { MovimientoMensualPage } from '@/pages/consultas/MovimientoMensual'
import { SaldosAnualesPage } from '@/pages/consultas/SaldosAnuales'
import { AnualCuentaPage } from '@/pages/consultas/AnualCuenta'
import { AnualTerceroPage } from '@/pages/consultas/AnualTercero'
import { AnualCentroPage } from '@/pages/consultas/AnualCentro'
import { SaldosCuentaCentroPage } from '@/pages/consultas/SaldosCuentaCentro'
import { DocumentoEspecificoPage } from '@/pages/consultas/DocumentoEspecifico'
import { ComparativosPage } from '@/pages/consultas/Comparativos'
import { InformesHubPage } from '@/pages/informes/InformesHub'
import { CategoriaInformesPage } from '@/pages/informes/Categoria'
import { ReportePage } from '@/pages/informes/Reporte'
import { RetencionesPage } from '@/pages/impuestos/Retenciones'
import { IVAPage } from '@/pages/impuestos/IVA'
import { MediosMagneticosPage } from '@/pages/impuestos/MediosMagneticos'
import { ReprocesosPage } from '@/pages/procesos/Reprocesos'
import { CierresPage } from '@/pages/procesos/Cierres'
import { ConsolidacionPage } from '@/pages/procesos/Consolidacion'
import { PresupuestoPage } from '@/pages/procesos/Presupuesto'
import { ParametrosPage } from '@/pages/configuracion/Parametros'
import { PlanCuentasPage } from '@/pages/configuracion/PlanCuentas'
import { TercerosPage } from '@/pages/configuracion/Terceros'
import { ComprobantesPage } from '@/pages/configuracion/Comprobantes'
import { CentrosPage } from '@/pages/configuracion/Centros'
import { RenglonesRentaPage } from '@/pages/configuracion/RenglonesRenta'
import { TiposDocumentoPage } from '@/pages/configuracion/TiposDocumento'
import { ConfigRetencionesPage } from '@/pages/configuracion/ConfigRetenciones'
import { ConfigIVAPage } from '@/pages/configuracion/ConfigIVA'
import { PlantillasPage } from '@/pages/configuracion/Plantillas'
import { CompaniasPage } from '@/pages/configuracion/Companias'
import { FormatosDocumentalesPage } from '@/pages/configuracion/FormatosDocumentales'
import { EspecialesPage } from '@/pages/configuracion/Especiales'
import { ReclasificacionesPage } from '@/pages/configuracion/Reclasificaciones'
import { UsuariosPermisosPage } from '@/pages/administracion/UsuariosPermisos'
import { BitacoraPage } from '@/pages/administracion/Bitacora'
import { IntegracionesPage } from '@/pages/administracion/Integraciones'
import { ReorganizacionPage } from '@/pages/administracion/Reorganizacion'

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/documentos/:id" element={<DocumentoOficialPage />} />

            {/* Movimientos */}
            <Route path="/movimientos/captura" element={<CapturaDirectaPage />} />
            <Route path="/movimientos/lotes" element={<LotesListaPage />} />
            <Route path="/movimientos/lotes/:codigo" element={<LoteEditorPage />} />
            <Route path="/movimientos/anulacion" element={<AnulacionPage />} />
            <Route path="/movimientos/importaciones" element={<ImportacionesPage />} />
            <Route path="/movimientos/nomina" element={<NominaPage />} />
            <Route path="/movimientos/reembolsos" element={<ReembolsosPage />} />

            {/* Consultas */}
            <Route path="/consultas/documentos" element={<ConsultaDocumentosPage />} />
            <Route path="/consultas/movimiento-mensual" element={<MovimientoMensualPage />} />
            <Route path="/consultas/saldos-anuales" element={<SaldosAnualesPage />} />
            <Route path="/consultas/anual-cuenta" element={<AnualCuentaPage />} />
            <Route path="/consultas/anual-tercero" element={<AnualTerceroPage />} />
            <Route path="/consultas/anual-centro" element={<AnualCentroPage />} />
            <Route path="/consultas/saldos-cuenta-centro" element={<SaldosCuentaCentroPage />} />
            <Route path="/consultas/documento-especifico" element={<DocumentoEspecificoPage />} />
            <Route path="/consultas/comparativos" element={<ComparativosPage />} />

            {/* Informes */}
            <Route path="/informes" element={<InformesHubPage />} />
            <Route path="/informes/:categoria" element={<CategoriaInformesPage />} />
            <Route path="/informes/reporte/:id" element={<ReportePage />} />

            {/* Impuestos */}
            <Route path="/impuestos/retenciones" element={<RetencionesPage />} />
            <Route path="/impuestos/iva" element={<IVAPage />} />
            <Route path="/impuestos/medios-magneticos" element={<MediosMagneticosPage />} />

            {/* Procesos */}
            <Route path="/reprocesos" element={<ReprocesosPage />} />
            <Route path="/cierres" element={<CierresPage />} />
            <Route path="/consolidacion" element={<ConsolidacionPage />} />
            <Route path="/presupuesto" element={<PresupuestoPage />} />

            {/* Configuración */}
            <Route path="/configuracion/parametros" element={<ParametrosPage />} />
            <Route path="/configuracion/plan-cuentas" element={<PlanCuentasPage />} />
            <Route path="/configuracion/terceros" element={<TercerosPage />} />
            <Route path="/configuracion/comprobantes" element={<ComprobantesPage />} />
            <Route path="/configuracion/centros" element={<CentrosPage />} />
            <Route path="/configuracion/renglones-renta" element={<RenglonesRentaPage />} />
            <Route path="/configuracion/tipos-documento" element={<TiposDocumentoPage />} />
            <Route path="/configuracion/retenciones" element={<ConfigRetencionesPage />} />
            <Route path="/configuracion/iva" element={<ConfigIVAPage />} />
            <Route path="/configuracion/plantillas" element={<PlantillasPage />} />
            <Route path="/configuracion/companias" element={<CompaniasPage />} />
            <Route path="/configuracion/formatos" element={<FormatosDocumentalesPage />} />
            <Route path="/configuracion/especiales" element={<EspecialesPage />} />
            <Route path="/configuracion/reclasificaciones" element={<ReclasificacionesPage />} />

            {/* Administración */}
            <Route path="/administracion/usuarios" element={<UsuariosPermisosPage />} />
            <Route path="/administracion/bitacora" element={<BitacoraPage />} />
            <Route path="/administracion/integraciones" element={<IntegracionesPage />} />
            <Route path="/administracion/reorganizacion" element={<ReorganizacionPage />} />

            <Route path="*" element={<DashboardPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}
