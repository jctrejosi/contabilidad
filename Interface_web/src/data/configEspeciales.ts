export type SeccionEspecial = 'analizar' | 'eliminar' | 'fusion';

export interface FuncionEspecial {
  id: string;
  nombre: string;
  descripcion: string;
  seccion: SeccionEspecial;
  confirmacion: string; // texto exacto que se debe digitar para ejecutar
  habilitada: boolean;
  enDesarrollo?: boolean;
  impacto: string;
}

export const FUNCIONES_ESPECIALES: FuncionEspecial[] = [
  { id: 'ap-completo', nombre: 'Analizar plan de cuentas completo', descripcion: 'Recorre todas las cuentas del plan y verifica estructura, niveles y códigos.', seccion: 'analizar', confirmacion: 'ANALIZAR PLAN', habilitada: true, impacto: 'Solo lectura: genera reporte de inconsistencias del plan de cuentas.' },
  { id: 'ap-balance', nombre: 'Analizar cuentas de balance', descripcion: 'Verifica las clases de activo, pasivo y patrimonio y sus saldos.', seccion: 'analizar', confirmacion: 'ANALIZAR PLAN', habilitada: true, impacto: 'Solo lectura: marca cuentas de balance con saldos inconsistentes.' },
  { id: 'ap-resultado', nombre: 'Analizar cuentas de resultado', descripcion: 'Verifica las cuentas de ingreso, gasto y costo y su naturaleza.', seccion: 'analizar', confirmacion: 'ANALIZAR PLAN', habilitada: true, impacto: 'Solo lectura: marca cuentas de resultado con naturaleza invertida.' },
  { id: 'ap-niveles', nombre: 'Analizar niveles 1 a 3', descripcion: 'Comprueba que las cuentas de nivel 1, 2 y 3 tengan dependientes válidos.', seccion: 'analizar', confirmacion: 'ANALIZAR PLAN', habilitada: true, impacto: 'Solo lectura: lista cuentas de nivel superior sin cuentas hijas.' },
  { id: 'ap-duplicados', nombre: 'Analizar códigos duplicados', descripcion: 'Busca códigos de cuenta repetidos en el catálogo.', seccion: 'analizar', confirmacion: 'ANALIZAR PLAN', habilitada: true, impacto: 'Solo lectura: reporta cuentas con código duplicado.' },
  { id: 'ap-sinmov', nombre: 'Analizar cuentas sin movimientos', descripcion: 'Identifica cuentas afectables que no han recibido movimiento en el año.', seccion: 'analizar', confirmacion: 'ANALIZAR PLAN', habilitada: true, impacto: 'Solo lectura: lista cuentas sin uso que podrían marcarse inactivas.' },
  { id: 'ap-ajuste', nombre: 'Analizar cuentas de ajuste por inflación', descripcion: 'Verifica las cuentas marcadas como ajustables por inflación.', seccion: 'analizar', confirmacion: 'ANALIZAR PLAN', habilitada: true, impacto: 'Solo lectura: revisa coherencia de la marca de ajuste fiscal.' },
  { id: 'ap-retencion', nombre: 'Analizar clases de retención', descripcion: 'Valida que las cuentas con clase de retención tengan la cuenta contrapartida.', seccion: 'analizar', confirmacion: 'ANALIZAR PLAN', habilitada: true, impacto: 'Solo lectura: reporta clases de retención sin cuenta de pasivo.' },
  { id: 'ap-iva', nombre: 'Analizar clases de IVA', descripcion: 'Valida que las cuentas con clase de IVA exijan base imponible.', seccion: 'analizar', confirmacion: 'ANALIZAR PLAN', habilitada: true, impacto: 'Solo lectura: reporta clases de IVA sin configuración de base.' },
  { id: 'ap-tercero', nombre: 'Analizar exigencias de tercero', descripcion: 'Revisa las cuentas que exigen tercero y sus saldos por NIT.', seccion: 'analizar', confirmacion: 'ANALIZAR PLAN', habilitada: true, impacto: 'Solo lectura: lista cuentas con tercero exigido y saldos sin NIT.' },
  { id: 'ap-centro', nombre: 'Analizar exigencias de centro de costo', descripcion: 'Revisa las cuentas que exigen centro de costo en sus movimientos.', seccion: 'analizar', confirmacion: 'ANALIZAR PLAN', habilitada: true, impacto: 'Solo lectura: lista movimientos sin centro en cuentas que lo exigen.' },
  { id: 'ap-base', nombre: 'Analizar exigencias de base', descripcion: 'Revisa las cuentas que exigen base imponible (IVA y retención).', seccion: 'analizar', confirmacion: 'ANALIZAR PLAN', habilitada: true, impacto: 'Solo lectura: reporta movimientos de IVA sin base registrada.' },
  { id: 'ec-activo', nombre: 'Eliminar cuentas en cero de activo', descripcion: 'Elimina cuentas de activo de nivel 4 o superior con saldo cero en el año.', seccion: 'eliminar', confirmacion: 'ELIMINAR CUENTAS EN CERO', habilitada: true, impacto: 'Destructivo: borra cuentas de activo sin saldo ni movimiento. Irreversible.' },
  { id: 'ec-pasivo', nombre: 'Eliminar cuentas en cero de pasivo', descripcion: 'Elimina cuentas de pasivo de nivel 4 o superior con saldo cero en el año.', seccion: 'eliminar', confirmacion: 'ELIMINAR CUENTAS EN CERO', habilitada: true, impacto: 'Destructivo: borra cuentas de pasivo sin saldo ni movimiento. Irreversible.' },
  { id: 'ec-patrimonio', nombre: 'Eliminar cuentas en cero de patrimonio', descripcion: 'Elimina cuentas de patrimonio sin saldo ni movimiento.', seccion: 'eliminar', confirmacion: 'ELIMINAR CUENTAS EN CERO', habilitada: true, impacto: 'Destructivo: borra cuentas de patrimonio sin saldo ni movimiento. Irreversible.' },
  { id: 'ec-ingresos', nombre: 'Eliminar cuentas en cero de ingresos', descripcion: 'Elimina cuentas de ingresos sin saldo ni movimiento.', seccion: 'eliminar', confirmacion: 'ELIMINAR CUENTAS EN CERO', habilitada: true, impacto: 'Destructivo: borra cuentas de ingresos sin saldo ni movimiento. Irreversible.' },
  { id: 'ec-gastos', nombre: 'Eliminar cuentas en cero de gastos', descripcion: 'Elimina cuentas de gastos sin saldo ni movimiento.', seccion: 'eliminar', confirmacion: 'ELIMINAR CUENTAS EN CERO', habilitada: true, impacto: 'Destructivo: borra cuentas de gastos sin saldo ni movimiento. Irreversible.' },
  { id: 'ec-costos', nombre: 'Eliminar cuentas en cero de costos', descripcion: 'Elimina cuentas de costos sin saldo ni movimiento.', seccion: 'eliminar', confirmacion: 'ELIMINAR CUENTAS EN CERO', habilitada: true, impacto: 'Destructivo: borra cuentas de costos sin saldo ni movimiento. Irreversible.' },
  { id: 'ec-nivel4', nombre: 'Eliminar cuentas en cero de nivel 4', descripcion: 'Elimina todas las cuentas auxiliares (nivel 4) con saldo cero.', seccion: 'eliminar', confirmacion: 'ELIMINAR CUENTAS EN CERO', habilitada: true, impacto: 'Destructivo: borra cuentas auxiliares sin saldo. Requiere respaldo previo.' },
  { id: 'ec-terceros', nombre: 'Eliminar cuentas en cero con terceros', descripcion: 'Elimina cuentas con manejo de terceros cuyo saldo por tercero es cero.', seccion: 'eliminar', confirmacion: 'ELIMINAR CUENTAS EN CERO', habilitada: true, impacto: 'Destructivo: borra cuentas por tercero sin saldo. Requiere respaldo previo.' },
  { id: 'fm-movimientos', nombre: 'Fusión de movimientos', descripcion: 'Fusiona movimientos duplicados de un mismo documento y período.', seccion: 'fusion', confirmacion: 'FUSIONAR MOVIMIENTOS', habilitada: false, enDesarrollo: true, impacto: 'Destructivo: consolida líneas duplicadas. No disponible aún.' },
  { id: 'fm-comprobantes', nombre: 'Fusión de comprobantes', descripcion: 'Fusiona comprobantes repetidos conservando el consecutivo original.', seccion: 'fusion', confirmacion: 'FUSIONAR MOVIMIENTOS', habilitada: false, enDesarrollo: true, impacto: 'Destructivo: unifica comprobantes. No disponible aún.' },
];
