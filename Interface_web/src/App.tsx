import { useState } from 'react';
import Shell, { type NavPage } from './components/Shell';
import { LOTES_INICIALES, ALERTAS } from './data/mock';
import type { Lote } from './types';

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
import BalanceComprobacion from './pages/BalanceComprobacion';
import DocumentoOficial from './pages/DocumentoOficial';
import Anulacion from './pages/Anulacion';
import Informes from './pages/Informes';
import ImpuestosPage from './pages/Impuestos';
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

const URGENTE_ALERTS = ALERTAS.filter(a => a.tipo === 'error').length;

export default function App() {
  const [page, setPage] = useState<NavPage>('dashboard');
  const [lotes, setLotes] = useState<Lote[]>(LOTES_INICIALES);
  const [selectedLoteId, setSelectedLoteId] = useState<string | null>(null);
  const [showDocumentPage, setShowDocumentPage] = useState(false);

  function navigate(p: NavPage) {
    setPage(p);
    setShowDocumentPage(false);
    if (p !== 'movimientos/lotes') setSelectedLoteId(null);
  }

  function openLote(id: string) {
    setSelectedLoteId(id);
    setPage('movimientos/lotes');
    setShowDocumentPage(false);
  }

  function openDocumento() {
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
      return <DocumentoOficial onNavigate={navigate} />;
    }

    switch (page) {
      case 'dashboard':
        return (
          <Dashboard
            lotes={lotes}
            onNavigate={navigate}
            onOpenLote={openLote}
          />
        );

      case 'movimientos/lotes':
        return (
          <LotesPage
            lotes={lotes}
            selectedLoteId={selectedLoteId}
            onUpdateLotes={setLotes}
            onNavigateToDoc={openDocumento}
            onNavigateToMensual={goToMensual}
          />
        );

      case 'movimientos/captura':
        return <CapturaDirecta onCrearLote={crearLote} />;

      case 'movimientos/anulacion':
        return <Anulacion />;

      case 'movimientos/importaciones':
        return <Importaciones onNavigate={navigate} onCrearLote={crearLote} />;

      case 'movimientos/nomina':
        return <Nomina onNavigate={navigate} onCrearLote={crearLote} />;

      case 'movimientos/reembolsos':
        return <Reembolsos onNavigate={navigate} onCrearLote={crearLote} />;

      case 'consultas/documentos':
        return <ConsultaDocumentos onOpenDocumento={openDocumento} />;

      case 'consultas/mensual':
        return <MovimientoMensual onOpenDocumento={openDocumento} />;

      case 'consultas/saldos-anuales':
        return <SaldosAnuales />;

      case 'consultas/anual-cuenta':
        return <AnualCuenta />;

      case 'consultas/anual-tercero':
        return <AnualTercero />;

      case 'consultas/anual-centro':
        return <AnualCentro />;

      case 'consultas/saldos-cuenta-centro':
        return <SaldosCuentaCentro />;

      case 'consultas/documento-especifico':
        return <DocumentoEspecifico onOpenDocumento={openDocumento} />;

      case 'consultas/comparativos':
        return <Comparativos />;

      case 'informes/documentos':
      case 'informes/libros':
      case 'informes/terceros':
      case 'informes/centros':
      case 'informes/flujo-caja':
      case 'informes/nic-niif':
      case 'informes/generador':
        return <Informes onNavigate={navigate} />;

      case 'informes/estados':
        return <BalanceComprobacion />;

      case 'impuestos/retenciones':
        return <ImpuestosPage initialTab="retenciones" />;

      case 'impuestos/iva':
        return <ImpuestosPage initialTab="iva" />;

      case 'impuestos/medios':
        return <ImpuestosPage initialTab="medios" />;

      case 'reprocesos':
        return <Reprocesos />;

      case 'cierres':
        return <Cierres />;

      case 'consolidacion':
        return <Consolidacion />;

      case 'config/parametros':
        return <ParametrosOperacion onExit={() => navigate('dashboard')} />;

      case 'config/plan-cuentas':
        return <PlanCuentas />;

      case 'config/terceros':
        return <TercerosPage />;

      case 'config/comprobantes':
        return <Comprobantes />;

      case 'config/centros':
        return <Centros />;

      case 'config/renglones':
        return <RenglonesRenta />;

      case 'config/tipos-doc':
        return <TiposDocumento />;

      case 'config/retenciones':
        return <ConfigRetenciones />;

      case 'config/iva':
        return <ConfigIVA />;

      case 'config/plantillas':
        return <Plantillas onNavigate={navigate} onCrearLote={crearLote} />;

      case 'config/companias':
        return <Companias />;

      case 'config/formatos':
        return <FormatosDocumentales />;

      case 'config/especiales':
        return <Especiales />;

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
        return <Dashboard lotes={lotes} onNavigate={navigate} onOpenLote={openLote} />;
    }
  }

  return (
    <Shell currentPage={page} onNavigate={navigate} badgeAlerts={URGENTE_ALERTS}>
      {renderPage()}
    </Shell>
  );
}
