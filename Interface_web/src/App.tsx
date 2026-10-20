import { useState } from 'react';
import Shell, { type NavPage } from './components/Shell';
import { LOTES_INICIALES, ALERTAS } from './data/mock';
import type { ClaveDocumento } from './api/documentos';
import type { CompaniaSesion, Lote } from './types';

import Dashboard from './pages/Dashboard';
import LotesPage from './pages/Lotes';
import CapturaDirecta from './pages/CapturaDirecta';
import Importaciones from './pages/Importaciones';
import Nomina from './pages/Nomina';
import Reembolsos from './pages/Reembolsos';
import PlanCuentas from './pages/PlanCuentas';
import TercerosPage from './pages/Terceros';
import MovimientoMensual from './pages/MovimientoMensual';
import ConsultaDocumentos from './pages/ConsultaDocumentos';
import SaldosAnuales from './pages/SaldosAnuales';
import AnualCuenta from './pages/AnualCuenta';
import AnualTercero from './pages/AnualTercero';
import AnualCentro from './pages/AnualCentro';
import SaldosCuentaCentro from './pages/SaldosCuentaCentro';
import DocumentoEspecifico from './pages/DocumentoEspecifico';
import Comparativos from './pages/Comparativos';
import DocumentoOficial from './pages/DocumentoOficial';
import Anulacion from './pages/Anulacion';
import Informes from './pages/Informes';
import MediosMagneticos from './pages/MediosMagneticos';
import MediosConceptos from './pages/MediosConceptos';
import MediosAsignacion from './pages/MediosAsignacion';
import MediosGeneracion from './pages/MediosGeneracion';
import MediosCopiaCompania from './pages/MediosCopiaCompania';
import Reprocesos from './pages/Reprocesos';
import Cierres from './pages/Cierres';
import Consolidacion from './pages/Consolidacion';
import ParametrosOperacion from './pages/ParametrosOperacion';
import Comprobantes from './pages/Comprobantes';
import Centros from './pages/Centros';
import RenglonesRenta from './pages/RenglonesRenta';
import TiposDocumento from './pages/TiposDocumento';
import ConfigRetenciones from './pages/ConfigRetenciones';
import ConfigIVA from './pages/ConfigIVA';
import Plantillas from './pages/Plantillas';
import Companias from './pages/Companias';
import FormatosDocumentales from './pages/FormatosDocumentales';
import Especiales from './pages/Especiales';
import Reclasificaciones from './pages/Reclasificaciones';
import UsuariosPermisos from './pages/UsuariosPermisos';
import Bitacora from './pages/Bitacora';
import Integraciones from './pages/Integraciones';
import Reorganizacion from './pages/Reorganizacion';
import SeleccionCompania from './pages/SeleccionCompania';

const URGENTE_ALERTS = ALERTAS.filter(a => a.tipo === 'error').length;

export default function App() {
  const [compania, setCompania] = useState<CompaniaSesion | null>(null);
  const [page, setPage] = useState<NavPage>('dashboard');
  const [lotes, setLotes] = useState<Lote[]>(LOTES_INICIALES);
  const [showDocumentPage, setShowDocumentPage] = useState(false);
  const [documentoOficial, setDocumentoOficial] = useState<ClaveDocumento | null>(null);

  if (!compania) {
    return (
      <SeleccionCompania
        onSelect={seleccion => {
          setCompania(seleccion);
          setPage('dashboard');
          setShowDocumentPage(false);
        }}
      />
    );
  }

  // Alias no anulable para las funciones de navegación definidas debajo.
  const companiaActiva = compania;

  function navigate(p: NavPage) {
    setPage(p);
    setShowDocumentPage(false);
  }

  function openDocumento(clave: ClaveDocumento) {
    setDocumentoOficial(clave);
    setShowDocumentPage(true);
    setPage('movimientos/lotes');
  }

  function goToMensual() {
    setPage('consultas/mensual');
    setShowDocumentPage(false);
  }

  function crearLote(lote: Lote) {
    setLotes(prev => [lote, ...prev]);
  }

  function renderPage() {
    // Special case: document official page
    if (showDocumentPage && page === 'movimientos/lotes') {
      return <DocumentoOficial cia={companiaActiva.codigo} compania={companiaActiva} clave={documentoOficial} onNavigate={navigate} />;
    }

    switch (page) {
      case 'dashboard':
        return (
          <Dashboard
            cia={companiaActiva.codigo}
            compania={companiaActiva}
            onNavigate={navigate}
          />
        );

      case 'movimientos/lotes':
        return <LotesPage cia={companiaActiva.codigo} />;

      case 'movimientos/captura':
        return <CapturaDirecta cia={companiaActiva.codigo} onCrearLote={crearLote} />;

      case 'movimientos/anulacion':
        return <Anulacion cia={companiaActiva.codigo} />;

      case 'movimientos/importaciones':
        return <Importaciones cia={companiaActiva.codigo} onNavigate={navigate} />;

      case 'movimientos/nomina':
        return <Nomina onNavigate={navigate} onCrearLote={crearLote} />;

      case 'movimientos/reembolsos':
        return <Reembolsos cia={companiaActiva.codigo} onNavigate={navigate} />;

      case 'consultas/documentos':
        return <ConsultaDocumentos cia={companiaActiva.codigo} onOpenDocumento={openDocumento} />;

      case 'consultas/mensual':
        return <MovimientoMensual cia={companiaActiva.codigo} onOpenDocumento={openDocumento} />;

      case 'consultas/saldos-anuales':
        return <SaldosAnuales cia={companiaActiva.codigo} />;

      case 'consultas/anual-cuenta':
        return <AnualCuenta cia={companiaActiva.codigo} />;

      case 'consultas/anual-tercero':
        return <AnualTercero cia={companiaActiva.codigo} />;

      case 'consultas/anual-centro':
        return <AnualCentro cia={companiaActiva.codigo} />;

      case 'consultas/saldos-cuenta-centro':
        return <SaldosCuentaCentro cia={companiaActiva.codigo} />;

      case 'consultas/documento-especifico':
        return <DocumentoEspecifico cia={companiaActiva.codigo} onOpenDocumento={openDocumento} />;

      case 'consultas/comparativos':
        return <Comparativos cia={companiaActiva.codigo} />;

      case 'informes/documentos':
      case 'informes/libros':
      case 'informes/estados':
      case 'informes/terceros':
      case 'informes/centros':
      case 'informes/flujo-caja':
      case 'informes/nic-niif':
      case 'informes/generador':
        return <Informes cia={companiaActiva.codigo} onNavigate={navigate} />;

      case 'medios/formatos':
        return <MediosMagneticos opcion={page} cia={companiaActiva.codigo} />;
      case 'medios/conceptos':
        return <MediosConceptos cia={companiaActiva.codigo} />;
      case 'medios/cuentas-manual':
        return <MediosAsignacion cia={companiaActiva.codigo} />;
      case 'medios/cuentas-copiar':
        return <MediosCopiaCompania cia={companiaActiva.codigo} />;
      case 'medios/generar':
        return <MediosGeneracion cia={companiaActiva.codigo} />;
      case 'medios/revision':
      case 'medios/detalle-tercero':
      case 'medios/totales-tercero':
      case 'medios/formato-tercero':
      case 'medios/documento':
      case 'medios/depurar-topes':
      case 'medios/depurar-cruce':
        return <MediosMagneticos opcion={page} cia={companiaActiva.codigo} />;

      case 'reprocesos':
        return <Reprocesos compania={companiaActiva} />;

      case 'cierres':
        return <Cierres />;

      case 'consolidacion':
        return <Consolidacion />;

      case 'config/parametros':
        return <ParametrosOperacion cia={companiaActiva.codigo} onExit={() => navigate('dashboard')} />;

      case 'config/plan-cuentas':
        return <PlanCuentas cia={companiaActiva.codigo} />;

      case 'config/terceros':
        return <TercerosPage />;

      case 'config/comprobantes':
        return <Comprobantes cia={companiaActiva.codigo} />;

      case 'config/centros':
        return <Centros cia={companiaActiva.codigo} />;

      case 'config/renglones':
        return <RenglonesRenta />;

      case 'config/tipos-doc':
        return <TiposDocumento />;

      case 'config/retenciones':
        return <ConfigRetenciones cia={companiaActiva.codigo} />;

      case 'config/iva':
        return <ConfigIVA cia={companiaActiva.codigo} />;

      case 'config/plantillas':
        return <Plantillas cia={companiaActiva.codigo} />;

      case 'config/companias':
        return <Companias cia={companiaActiva.codigo} />;

      case 'config/formatos':
        return <FormatosDocumentales />;

      case 'config/especiales':
        return <Especiales compania={companiaActiva} />;

      case 'config/reclasificaciones':
        return <Reclasificaciones onNavigate={navigate} onCrearLote={crearLote} />;

      case 'admin/usuarios':
        return <UsuariosPermisos />;

      case 'admin/bitacora':
        return <Bitacora />;

      case 'admin/integraciones':
        return <Integraciones />;

      case 'admin/reorganizacion':
        return <Reorganizacion />;

      default:
        return <Dashboard cia={companiaActiva.codigo} compania={companiaActiva} onNavigate={navigate} />;
    }
  }

  return (
    <Shell
      currentPage={page}
      onNavigate={navigate}
      badgeAlerts={URGENTE_ALERTS}
      compania={companiaActiva}
      onChangeCompany={() => {
        setPage('dashboard');
        setShowDocumentPage(false);
        setCompania(null);
      }}
    >
      {renderPage()}
    </Shell>
  );
}
