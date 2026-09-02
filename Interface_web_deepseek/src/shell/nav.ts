/* ============================================================
   CONTABDSI · Modelo de navegación
   ============================================================ */

import type { Permission, Role } from '@/core/types'

export interface NavItem {
  key: string
  label: string
  icon: string
  to?: string
  perm?: Permission
  children?: NavItem[]
  badge?: number
  featureFlag?: keyof { presupuesto: boolean }
}

export interface NavSection {
  key: string
  label: string
  items: NavItem[]
}

export const NAV: NavSection[] = [
  {
    key: 'principal',
    label: 'Principal',
    items: [{ key: 'inicio', label: 'Inicio', icon: 'home', to: '/' }],
  },
  {
    key: 'movimientos',
    label: 'Movimientos',
    items: [
      { key: 'captura', label: 'Captura directa', icon: 'entrada', to: '/movimientos/captura', perm: 'mov.capturar' },
      { key: 'lotes', label: 'Lotes', icon: 'lote', to: '/movimientos/lotes', perm: 'mov.lotes' },
      { key: 'anulacion', label: 'Anulación', icon: 'anular', to: '/movimientos/anulacion', perm: 'mov.anular' },
      { key: 'importaciones', label: 'Importaciones', icon: 'importar', to: '/movimientos/importaciones', perm: 'mov.importar' },
      { key: 'nomina', label: 'Integración de nómina', icon: 'nomina', to: '/movimientos/nomina', perm: 'mov.nomina' },
      { key: 'reembolsos', label: 'Reembolsos', icon: 'reembolso', to: '/movimientos/reembolsos', perm: 'mov.reembolsos' },
    ],
  },
  {
    key: 'consultas',
    label: 'Consultas',
    items: [
      { key: 'cons-doc', label: 'Documentos', icon: 'doc', to: '/consultas/documentos', perm: 'consulta.ver' },
      { key: 'cons-mensual', label: 'Movimiento mensual', icon: 'calendario', to: '/consultas/movimiento-mensual', perm: 'consulta.ver' },
      { key: 'cons-saldos', label: 'Saldos anuales', icon: 'libro', to: '/consultas/saldos-anuales', perm: 'consulta.ver' },
      { key: 'cons-cuenta', label: 'Anual por cuenta', icon: 'plan', to: '/consultas/anual-cuenta', perm: 'consulta.ver' },
      { key: 'cons-tercero', label: 'Anual por tercero', icon: 'terceros', to: '/consultas/anual-tercero', perm: 'consulta.ver' },
      { key: 'cons-centro', label: 'Anual por centro', icon: 'centro', to: '/consultas/anual-centro', perm: 'consulta.ver' },
      { key: 'cons-cuenta-centro', label: 'Saldos cuenta/centro', icon: 'git', to: '/consultas/saldos-cuenta-centro', perm: 'consulta.ver' },
      { key: 'cons-doc-espec', label: 'Documento específico', icon: 'lupa', to: '/consultas/documento-especifico', perm: 'consulta.ver' },
      { key: 'cons-compara', label: 'Comparativos', icon: 'columns', to: '/consultas/comparativos', perm: 'consulta.ver' },
    ],
  },
  {
    key: 'informes',
    label: 'Informes',
    items: [
      { key: 'inf-hub', label: 'Centro de informes', icon: 'informe', to: '/informes', perm: 'informes.ver' },
      { key: 'inf-doc', label: 'Documentos', icon: 'doc', to: '/informes/documentos', perm: 'informes.ver' },
      { key: 'inf-libros', label: 'Libros', icon: 'libro', to: '/informes/libros', perm: 'informes.ver' },
      { key: 'inf-estados', label: 'Estados y balances', icon: 'trendUp', to: '/informes/estados', perm: 'informes.ver' },
      { key: 'inf-terceros', label: 'Terceros', icon: 'terceros', to: '/informes/terceros', perm: 'informes.ver' },
      { key: 'inf-centros', label: 'Centros', icon: 'centro', to: '/informes/centros', perm: 'informes.ver' },
      { key: 'inf-flujo', label: 'Flujo de caja', icon: 'trendUp', to: '/informes/flujo', perm: 'informes.ver' },
      { key: 'inf-nic', label: 'NIC/NIIF', icon: 'shield', to: '/informes/nic', perm: 'informes.ver' },
      { key: 'inf-generador', label: 'Generador personalizado', icon: 'sliders', to: '/informes/generador', perm: 'informes.ver' },
    ],
  },
  {
    key: 'impuestos',
    label: 'Impuestos',
    items: [
      { key: 'imp-ret', label: 'Retenciones', icon: 'retencion', to: '/impuestos/retenciones', perm: 'impuestos.retenciones' },
      { key: 'imp-iva', label: 'IVA', icon: 'iva', to: '/impuestos/iva', perm: 'impuestos.iva' },
      { key: 'imp-medios', label: 'Medios magnéticos', icon: 'medio', to: '/impuestos/medios-magneticos', perm: 'impuestos.medios' },
    ],
  },
  {
    key: 'procesos',
    label: 'Procesos',
    items: [
      { key: 'reprocesos', label: 'Reprocesos y auditoría', icon: 'reproceso', to: '/reprocesos', perm: 'reprocesos.auditar' },
      { key: 'cierres', label: 'Cierres', icon: 'cierre', to: '/cierres', perm: 'cierres.ejecutar' },
      { key: 'consolidacion', label: 'Consolidación', icon: 'consolidar', to: '/consolidacion', perm: 'consolidacion.ejecutar' },
    ],
  },
  {
    key: 'configuracion',
    label: 'Configuración',
    items: [
      { key: 'cfg-param', label: 'Parámetros', icon: 'parametros', to: '/configuracion/parametros', perm: 'config.ver' },
      { key: 'cfg-plan', label: 'Plan de cuentas', icon: 'plan', to: '/configuracion/plan-cuentas', perm: 'config.ver' },
      { key: 'cfg-terceros', label: 'Terceros', icon: 'terceros', to: '/configuracion/terceros', perm: 'config.ver' },
      { key: 'cfg-comprobantes', label: 'Comprobantes', icon: 'comprobante', to: '/configuracion/comprobantes', perm: 'config.ver' },
      { key: 'cfg-centros', label: 'Centros', icon: 'centro', to: '/configuracion/centros', perm: 'config.ver' },
      { key: 'cfg-renta', label: 'Renglones de renta', icon: 'renta', to: '/configuracion/renglones-renta', perm: 'config.ver' },
      { key: 'cfg-tiposdoc', label: 'Tipos de documento', icon: 'doc', to: '/configuracion/tipos-documento', perm: 'config.ver' },
      { key: 'cfg-ret', label: 'Retenciones', icon: 'retencion', to: '/configuracion/retenciones', perm: 'config.ver' },
      { key: 'cfg-iva', label: 'IVA', icon: 'iva', to: '/configuracion/iva', perm: 'config.ver' },
      { key: 'cfg-plantillas', label: 'Plantillas', icon: 'plantilla', to: '/configuracion/plantillas', perm: 'config.ver' },
      { key: 'cfg-companias', label: 'Compañías', icon: 'compania', to: '/configuracion/companias', perm: 'config.ver' },
      { key: 'cfg-formatos', label: 'Formatos documentales', icon: 'formato', to: '/configuracion/formatos', perm: 'config.ver' },
      { key: 'cfg-especiales', label: 'Especiales', icon: 'especial', to: '/configuracion/especiales', perm: 'config.especiales' },
      { key: 'cfg-reclas', label: 'Reclasificaciones', icon: 'reclasificar', to: '/configuracion/reclasificaciones', perm: 'config.reclasificaciones' },
    ],
  },
  {
    key: 'administracion',
    label: 'Administración',
    items: [
      { key: 'adm-usuarios', label: 'Usuarios / permisos', icon: 'usuarios', to: '/administracion/usuarios', perm: 'admin.usuarios' },
      { key: 'adm-bitacora', label: 'Bitácora', icon: 'bitacora', to: '/administracion/bitacora', perm: 'admin.bitacora' },
      { key: 'adm-integraciones', label: 'Integraciones', icon: 'integracion', to: '/administracion/integraciones', perm: 'admin.integraciones' },
      { key: 'adm-reorg', label: 'Reorganización de datos', icon: 'db', to: '/administracion/reorganizacion', perm: 'admin.reorganizacion' },
    ],
  },
  {
    key: 'presupuesto',
    label: 'Presupuesto',
    items: [
      {
        key: 'presupuesto',
        label: 'Presupuesto futuro',
        icon: 'presupuesto',
        to: '/presupuesto',
        perm: 'presupuesto.ver',
        featureFlag: 'presupuesto',
      },
    ],
  },
]

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  CONTADOR: 'Contador principal',
  AUXILIAR: 'Auxiliar contable',
  AUDITOR: 'Auditor',
  TRIBUTARIO: 'Analista tributario',
  GERENCIA: 'Consulta gerencial',
}
