import { useState } from 'react';
import Shell, { type NavPage } from './components/Shell';
import { LOTES_INICIALES, ALERTAS } from './data/mock';
import type { Lote } from './types';

import Dashboard from './pages/Dashboard';
import LotesPage from './pages/Lotes';
import CapturaDirecta from './pages/CapturaDirecta';
import PlanCuentas from './pages/PlanCuentas';
import TercerosPage from './pages/Terceros';
import MovimientoMensual from './pages/MovimientoMensual';
import BalanceComprobacion from './pages/BalanceComprobacion';
import DocumentoOficial from './pages/DocumentoOficial';
import Anulacion from './pages/Anulacion';
import Informes from './pages/Informes';
import ImpuestosPage from './pages/Impuestos';
import Reprocesos from './pages/Reprocesos';
import Cierres from './pages/Cierres';
import Consolidacion from './pages/Consolidacion';
import PlaceholderPage from './pages/PlaceholderPage';

const URGENTE_ALERTS = ALERTAS.filter(a => a.tipo === 'error').length;

export default function App() {
  const [page, setPage] = useState<NavPage>('dashboard');
  const [lotes, setLotes] = useState<Lote[]>(LOTES_INICIALES);
  const [selectedLoteId, setSelectedLoteId] = useState<string | null>(null);
  const [showDocumentPage, setShowDocumentPage] = useState(false);

  function navigate(p: NavPage, params?: Record<string, string>) {
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
        return <CapturaDirecta />;

      case 'movimientos/anulacion':
        return <Anulacion />;

      case 'movimientos/importaciones':
        return (
          <PlaceholderPage
            title="Importaciones"
            description="Asistente para importar movimientos contables desde XLS, XLSX, ADT, TXT y CSV"
            icon="↓"
            features={[
              'Soporte XLS, XLSX, ADT, TXT, CSV',
              'Mapeo de columnas personalizable',
              'Plantillas de mapeo guardadas',
              'Previsualización antes de importar',
              'Filas aceptadas, advertidas, rechazadas',
              'Destino en lote para validación',
            ]}
          />
        );

      case 'movimientos/nomina':
        return (
          <PlaceholderPage
            title="Integración de nómina"
            description="Importación de nómina, aportes y provisiones con flujo separado por tipo"
            icon="👤"
            features={[
              'Nómina, Aportes y Provisiones separados',
              'Mapeo de cuentas por concepto',
              'Validación por tercero y centro',
              'Generación de lote para aprobación',
            ]}
          />
        );

      case 'movimientos/reembolsos':
        return (
          <PlaceholderPage
            title="Reembolsos"
            description="Registro de reembolsos de caja menor con encabezado y detalle"
            icon="$"
            features={['Encabezado con tercero y fecha', 'Detalle de gastos por cuenta', 'Generar lote y contabilizar']}
          />
        );

      case 'consultas/documentos':
        return (
          <PlaceholderPage
            title="Consulta general de documentos"
            description="Búsqueda y consulta de documentos contables con filtros avanzados"
            icon="📑"
            features={['Filtro por período, comprobante, NIT', 'Ver detalle de cada documento', 'Acceso al documento oficial', 'Exportar XLSX']}
          />
        );

      case 'consultas/mensual':
        return <MovimientoMensual onOpenDocumento={openDocumento} />;

      case 'consultas/saldos-anuales':
        return (
          <PlaceholderPage
            title="Saldos anuales"
            description="Saldo inicial y comportamiento mensual enero-diciembre por cuenta"
            icon="📊"
            features={['Saldo inicial', 'Movimiento mensual (12 cols)', 'Drill-down al documento', 'Exportar']}
          />
        );

      case 'consultas/anual-cuenta':
        return <PlaceholderPage title="Anual por cuenta" description="Movimiento anual agrupado por cuenta con detalle mensual" icon="📈" features={['Agrupación por cuenta', 'Expandir/colapsar meses', 'Totales acumulados']} />;

      case 'consultas/anual-tercero':
        return <PlaceholderPage title="Anual por tercero" description="Movimiento anual por NIT/tercero con drill-down mensual" icon="👤" features={['Filtrar por NIT', 'Expandir por mes', 'Balance por tercero']} />;

      case 'consultas/anual-centro':
        return <PlaceholderPage title="Anual por centro de costo" description="Movimiento anual por centro de costo con comparativo mensual" icon="🏢" features={['Filtrar por centro', 'Comparativo entre centros', 'Exportar XLSX']} />;

      case 'consultas/saldos-cuenta-centro':
        return <PlaceholderPage title="Saldos cuenta/centro" description="Dos paneles relacionados: cuentas con saldo y su desglose por centro" icon="⊟" features={['Panel de cuentas', 'Panel de centros relacionado', 'Selección sincronizada']} />;

      case 'consultas/documento-especifico':
        return <PlaceholderPage title="Documento específico" description="Consulta de un documento por número propio o documento afectado" icon="📄" features={['Búsqueda por número', 'Ver documento afectado', 'Enlace a movimiento']} />;

      case 'consultas/comparativos':
        return <PlaceholderPage title="Comparativos" description="Comparativos entre dos contabilidades, dos meses o dos períodos" icon="⊞" features={['Comparativo dos meses', 'Comparativo dos contabilidades', 'Comparativo centros', 'Diferencia resaltada']} />;

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

      case 'config/plan-cuentas':
        return <PlanCuentas />;

      case 'config/terceros':
        return <TercerosPage />;

      case 'config/parametros':
        return (
          <PlaceholderPage
            title="Parámetros de operación"
            description="Configuración general de la contabilidad: período activo, controles y preferencias"
            icon="⚙"
            features={['Compañía y período activo', 'Controles de validación', 'Alertas y notificaciones', 'Decimales y formato']}
          />
        );

      case 'config/comprobantes':
        return <PlaceholderPage title="Comprobantes" description="Tipos y consecutivos de comprobante contable" icon="📋" features={['CRUD de comprobantes', 'Consecutivos por tipo', 'Control de estados']} />;

      case 'config/centros':
        return (
          <PlaceholderPage
            title="Centros de costo"
            description="Catálogo jerárquico de centros de costo para distribución del gasto"
            icon="🏢"
            features={['Estructura jerárquica', 'CRUD completo', 'Asignación a cuentas']}
          />
        );

      case 'config/renglones':
        return <PlaceholderPage title="Renglones de renta" description="Clasificación de cuentas para declaración de renta" icon="%" features={['Renglones tributarios', 'Asignación de cuentas', 'Verificación de completitud']} />;

      case 'config/tipos-doc':
        return <PlaceholderPage title="Tipos de documento" description="Tipos y numeración de documentos contables" icon="📄" features={['CRUD tipos', 'Control de numeración', 'Consecutivos automáticos']} />;

      case 'config/retenciones':
        return <PlaceholderPage title="Retenciones (config)" description="Conceptos, tarifas y cuentas de retención en la fuente" icon="%" features={['Conceptos y tarifas', 'Cuentas contables asociadas', 'Reglas tributarias configurables']} />;

      case 'config/iva':
        return <PlaceholderPage title="IVA (config)" description="Tarifas de IVA y cuentas asociadas" icon="%" features={['Tarifas 0%, 5%, 19%', 'Cuentas de IVA', 'Reglas de base']} />;

      case 'config/plantillas':
        return <PlaceholderPage title="Plantillas contables" description="Modelos de asientos predefinidos para acelerar la captura" icon="📋" features={['Crear plantillas', 'Aplicar en captura directa', 'Compartir entre usuarios']} />;

      case 'config/companias':
        return <PlaceholderPage title="Compañías" description="Crear, configurar y gestionar las compañías del sistema" icon="🏛" features={['Crear compañía', 'Traslado de saldos iniciales', 'Limpieza de período', 'Marcar como solo consolidación']} />;

      case 'config/formatos':
        return <PlaceholderPage title="Formatos documentales" description="Editor visual de formatos de impresión de documentos" icon="📄" features={['Editor visual drag-and-drop', 'Leyendas e imágenes', 'Vista previa antes de guardar', 'Múltiples formatos por comprobante']} />;

      case 'config/especiales':
        return <PlaceholderPage title="Funciones especiales" description="Operaciones avanzadas de mantenimiento y corrección con permisos elevados" icon="⚠" features={['Reasignar cuentas y centros', 'Extraer y reencolar movimientos', 'Detectar duplicados', 'Requiere permisos de administrador']} />;

      case 'config/reclasificaciones':
        return <PlaceholderPage title="Reclasificaciones" description="Reclasificación de movimientos entre cuentas, centros y comprobantes" icon="↔" features={['Reclasificar por cuenta-documento', 'Reclasificar centro por cuenta', 'Previsualización de cambios']} />;

      case 'admin/usuarios':
        return (
          <PlaceholderPage
            title="Usuarios y permisos"
            description="Gestión de accesos, roles y permisos por módulo y compañía"
            icon="👥"
            features={['Roles: Administrador, Contador, Auxiliar, Auditor, Tributario, Consulta', 'Permisos por módulo y acción', 'Bitácora de accesos', 'Bloqueo por inactividad']}
          />
        );

      case 'admin/bitacora':
        return <PlaceholderPage title="Bitácora de auditoría" description="Registro completo de todas las acciones del sistema con usuario, fecha y detalle" icon="📝" features={['Registro inmutable', 'Filtro por usuario, fecha, módulo', 'Exportar para auditoría', 'Alertas de acceso no autorizado']} />;

      case 'admin/integraciones':
        return <PlaceholderPage title="Integraciones" description="Conexiones con módulos externos y estado de sincronización" icon="🔌" features={['Estado de integración con facturación', 'Estado de integración con cartera', 'Mensajes de indisponibilidad', 'Bloqueo del almacenamiento legado']} />;

      case 'admin/reorganizacion':
        return <PlaceholderPage title="Reorganización de datos" description="Reindexación y compactación de la base de datos — modo mantenimiento exclusivo" icon="🔧" features={['Modo mantenimiento: excluye otros usuarios', 'Respaldo automático previo', 'Reindexar tablas', 'Compactar registros eliminados']} />;

      default:
        return (
          <PlaceholderPage
            title="Módulo en desarrollo"
            description="Esta sección está siendo implementada"
            icon="🔧"
          />
        );
    }
  }

  return (
    <Shell currentPage={page} onNavigate={navigate} badgeAlerts={URGENTE_ALERTS}>
      {renderPage()}
    </Shell>
  );
}
