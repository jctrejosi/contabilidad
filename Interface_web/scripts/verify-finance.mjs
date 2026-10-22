import puppeteer from 'puppeteer-core'

const BASE = process.env.BASE || 'http://127.0.0.1:8448'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
function ok(cond, label) {
  if (cond) console.log(`  ✓ ${label}`)
  else { failures++; console.log(`  ✗ ${label}`) }
}

const MODULES = [
  {
    name: 'Facturación',
    pages: [
      ['Facturas de venta', 'documentos'],
      ['Facturas de compra', 'compras'],
      ['Notas crédito y débito', 'notas'],
      ['Centro DIAN', 'dian'],
      ['Resoluciones y numeración', 'resoluciones'],
      ['Productos y servicios', 'productos'],
      ['Importar documentos', 'importar'],
      ['Formulario 300 (IVA)', 'formulario-300'],
      ['Formulario 350 (Retención)', 'formulario-350'],
      ['Formulario 110 (Renta)', 'formulario-110'],
      ['Declaración electrónica', 'declaracion'],
      ['Exógena y medios', 'exogena'],
    ],
  },
  {
    name: 'Cuentas por cobrar',
    pages: [
      ['Bandeja de cartera', 'partidas'],
      ['Recibos de caja', 'recibos'],
      ['Aplicación de pagos', 'aplicacion'],
      ['Edades de cartera', 'edades'],
      ['Estados de cuenta', 'estados-cuenta'],
      ['Cobro y promesas', 'cobro'],
      ['Castigos y ajustes', 'ajustes'],
      ['Anticipos de clientes', 'anticipos'],
      ['Provisión por deterioro', 'deterioro'],
      ['Conciliación con clientes', 'conciliacion'],
    ],
  },
  {
    name: 'Cuentas por pagar',
    pages: [
      ['Bandeja de obligaciones', 'obligaciones'],
      ['Propuestas de pago', 'propuestas'],
      ['Pagos', 'pagos'],
      ['Retenciones y certificados', 'retenciones'],
      ['Anticipos y gastos', 'anticipos'],
      ['Edades y programación', 'programacion'],
      ['Estados de cuenta', 'estados-cuenta'],
      ['Gastos y reembolsos', 'gastos'],
      ['Notas de proveedor', 'notas'],
      ['Descuentos y notas débito', 'descuentos'],
      ['Conciliación con proveedores', 'conciliacion'],
    ],
  },
  {
    name: 'Tesorería y bancos',
    pages: [
      ['Panel de tesorería', 'panel'],
      ['Flujo de caja real', 'flujo'],
      ['Flujo de caja proyectado', 'proyectado'],
      ['Liquidez y recaudos', 'liquidez'],
      ['Cuentas bancarias', 'cuentas'],
      ['Extractos', 'extractos'],
      ['Conciliación', 'conciliacion'],
      ['Reglas', 'reglas'],
      ['Transferencias', 'transferencias'],
      ['Cheques', 'cheques'],
      ['Caja menor', 'caja'],
      ['Partidas conciliatorias', 'partidas'],
    ],
  },
  {
    name: 'Presupuestos',
    pages: [
      ['Bandeja de presupuestos', 'versiones'],
      ['Editor', 'editor'],
      ['Distribución', 'distribucion'],
      ['Aprobación', 'aprobacion'],
      ['Ejecución y compromisos', 'ejecucion'],
      ['Comparativo y escenarios', 'comparativo'],
      ['Proyección por proyecto', 'proyectos'],
      ['Alertas', 'alertas'],
    ],
  },
  {
    name: 'Activos fijos',
    pages: [
      ['Panel de activos', 'panel'],
      ['Registro de activos', 'registro'],
      ['Registro contable', 'movimientos'],
      ['Depreciación', 'depreciacion'],
      ['Revalorizaciones', 'revalorizaciones'],
      ['Bajas y retiros', 'bajas'],
      ['Traslados', 'traslados'],
      ['Conciliación con el mayor', 'conciliacion'],
      ['Categorías y políticas', 'categorias'],
      ['Reportes', 'reportes'],
    ],
  },
  {
    name: 'Costos',
    pages: [
      ['Panel de costos', 'panel'],
      ['Centros y conductores', 'centros'],
      ['Distribución de CIF', 'cif'],
      ['Distribución secundaria', 'secundaria'],
      ['Costeo estándar', 'estandar'],
      ['Costeo ABC', 'abc'],
      ['Costos por proyecto', 'proyectos'],
      ['Reportes de costo', 'reportes'],
    ],
  },
  {
    name: 'Financiación y deuda',
    pages: [
      ['Panel de deuda', 'panel'],
      ['Préstamos bancarios', 'prestamos'],
      ['Calendario de amortización', 'amortizacion'],
      ['Intereses y pagos', 'pagos'],
      ['Cupos de crédito', 'cupos'],
      ['Arrendamientos financieros', 'leasing'],
      ['Reportes de deuda', 'reportes'],
    ],
  },
  {
    name: 'Indicadores y proyecciones',
    pages: [
      ['Tablero gerencial', 'panel'],
      ['Catálogo de indicadores', 'catalogo'],
      ['Proyecciones financieras', 'proyecciones'],
      ['Escenarios', 'escenarios'],
      ['Informes gerenciales', 'reportes'],
    ],
  },
  {
    name: 'Aprobaciones',
    pages: [
      ['Bandeja de aprobaciones', 'bandeja'],
      ['Reglas y niveles', 'reglas'],
    ],
  },
  {
    name: 'Auditoría y control',
    pages: [
      ['Bitácora de eventos', 'bitacora'],
      ['Roles y permisos', 'permisos'],
    ],
  },
  {
    name: 'Consolidación',
    pages: [
      ['Panel de consolidación', 'panel'],
      ['Eliminaciones intercompañía', 'eliminaciones'],
    ],
  },
]

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
page.on('pageerror', (error) => { failures++; console.log('  ✗ PAGE ERROR:', error.message) })

const body = () => page.evaluate(() => document.body.innerText)

async function clickText(text) {
  return page.evaluate((value) => {
    const buttons = [...document.querySelectorAll('aside button, main button, header button')]
    const exact = buttons.find((button) => button.textContent.trim() === value)
    const partial = buttons.find((button) => button.textContent.trim().length < 90 && button.textContent.includes(value))
    const target = exact ?? partial
    if (target) { target.click(); return true }
    return false
  }, text)
}

await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.removeItem('contabdsi:cierres:v1:001'))
await sleep(700)
await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Compañía Demo'))?.click())
await sleep(200)
await clickText('Ingresar a la compañía')
await sleep(900)

console.log('1. Render de las 71 pantallas')
for (const module of MODULES) {
  await clickText('Todos los módulos')
  await sleep(350)
  await clickText(module.name)
  await sleep(700)
  for (const [label, slug] of module.pages) {
    const clicked = await clickText(label)
    await sleep(450)
    const text = await body()
    const healthy = clicked
      && text.length > 250
      && !text.includes('Panel de inicio')
      && !text.includes('Implementación completa disponible')
      && !text.includes('Algo salió mal')
    ok(healthy, `${module.name} → ${label} (${slug})`)
  }
}

console.log('2. Flujo Facturación → Cartera')
await clickText('Todos los módulos')
await sleep(300)
await clickText('Facturación')
await sleep(600)
await clickText('Facturas de venta')
await sleep(500)
await clickText('Nueva factura')
await sleep(500)
const modalOpen = (await body()).includes('Nueva factura de venta')
ok(modalOpen, 'Editor de factura de venta abierto')
await clickText('Emitir y contabilizar')
await sleep(900)
const afterCreate = await body()
ok(afterCreate.includes('FV-1049'), 'Factura FV-1049 creada y numerada')
ok(afterCreate.includes('contabilizada'), 'Factura contabilizada')
await clickText('Todos los módulos')
await sleep(400)
await clickText('Cuentas por cobrar')
await sleep(600)
await clickText('Bandeja de cartera')
await sleep(600)
const cartera = await body()
ok(cartera.includes('FV-1049'), 'La nueva factura aparece en cartera')
ok(cartera.includes('Empresa ABC Comercial'), 'Cliente y saldo visibles')

console.log('3. Acciones rápidas por módulo')
await clickText('Todos los módulos'); await sleep(300); await clickText('Tesorería y bancos'); await sleep(500); await clickText('Transferencias'); await sleep(500)
await clickText('Nueva transferencia'); await sleep(400)
ok((await body()).includes('Nueva transferencia'), 'Formulario de transferencia abre')
await page.keyboard.press('Escape')

await clickText('Todos los módulos'); await sleep(300); await clickText('Presupuestos'); await sleep(500); await clickText('Editor'); await sleep(500)
const editor = await body()
ok(editor.includes('Editor de presupuesto') || editor.includes('Presupuesto'), 'Editor de presupuesto abre')
ok(editor.includes('Ene') || editor.includes('Enero'), 'Grilla mensual visible')

await clickText('Todos los módulos'); await sleep(300); await clickText('Cuentas por pagar'); await sleep(500); await clickText('Propuestas de pago'); await sleep(500)
ok((await body()).includes('PROP-028'), 'Propuesta PROP-028 visible')

console.log('4. Flujo Activos fijos')
await clickText('Todos los módulos'); await sleep(300); await clickText('Activos fijos'); await sleep(600)
await clickText('Registro de activos'); await sleep(500)
const registro = await body()
ok(registro.includes('AF-0001'), 'Activo AF-0001 visible en el registro')
ok(registro.includes('Sede administrativa principal'), 'Ficha de la sede visible')
ok(registro.includes('Valor neto'), 'Valor neto en libros visible')

await clickText('Depreciación'); await sleep(500)
const depreciacion = await body()
ok(depreciacion.includes('Cierre de depreciación'), 'Vista previa de depreciación visible')
ok(depreciacion.includes('Contabilizar depreciación'), 'Acción de cierre disponible')
await clickText('Contabilizar depreciación'); await sleep(400)
ok((await body()).includes('Se generará un asiento por activo'), 'Confirmación del cierre abre')
await clickText('Contabilizar periodo'); await sleep(900)
ok((await body()).includes('Depreciación de 2026-02 contabilizada') || (await body()).includes('Contabilizada'), 'Depreciación de febrero contabilizada')

await clickText('Revalorizaciones'); await sleep(500)
ok((await body()).includes('AV-2026-014'), 'Revalorización aprobada visible')
await clickText('Nueva revalorización'); await sleep(400)
ok((await body()).includes('Nueva revalorización'), 'Formulario de revalorización abre')
await page.keyboard.press('Escape'); await sleep(300)

await clickText('Bajas y retiros'); await sleep(500)
ok((await body()).includes('Obsolescencia'), 'Solicitud de baja visible')
await clickText('Nueva baja'); await sleep(400)
ok((await body()).includes('Solicitud de baja'), 'Formulario de baja abre')
await page.keyboard.press('Escape'); await sleep(300)

await clickText('Conciliación con el mayor'); await sleep(500)
const conciliacion = await body()
ok(conciliacion.includes('Diferencia'), 'Diferencias de conciliación visibles')
ok(conciliacion.includes('1592') || conciliacion.includes('Cuentas que se cruzan'), 'Cuentas del cuadre visibles')

console.log('5. Acciones de activos fijos: aplicar revalorización, baja y ajuste')
await clickText('Revalorizaciones'); await sleep(500)
await clickText('Aplicar'); await sleep(900)
ok((await body()).includes('AV-2026-014 aplicada'), 'Revalorización AV-2026-014 aplicada')

await clickText('Bajas y retiros'); await sleep(500)
await clickText('Aprobar'); await sleep(600)
await clickText('Aplicar baja'); await sleep(900)
const afterDisposal = await body()
ok(afterDisposal.includes('Baja de AF-0013 aplicada'), 'Baja del servidor obsoleto aplicada')

await clickText('Conciliación con el mayor'); await sleep(500)
await page.evaluate(() => {
  const row = [...document.querySelectorAll('tr')].find(item => item.textContent.includes('Maquinaria y equipo'))
  const target = [...(row?.querySelectorAll('button') ?? [])].find(button => button.textContent.trim() === 'Registrar ajuste')
  target?.click()
})
await sleep(500)
await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button')].filter(button => button.textContent.trim() === 'Registrar ajuste')
  buttons[buttons.length - 1]?.click()
})
await sleep(900)
const maquinariaRow = await page.evaluate(() => [...document.querySelectorAll('tr')].find(item => item.textContent.includes('Maquinaria y equipo'))?.innerText ?? '')
ok(maquinariaRow.includes('Conciliada'), 'Ajuste de conciliación aplicado')
ok(!maquinariaRow.includes('Diferencia'), 'La diferencia de maquinaria quedó resuelta')

console.log('6. Ficha del activo y deterioro')
await clickText('Registro de activos'); await sleep(500)
await page.evaluate(() => {
  const row = [...document.querySelectorAll('tr')].find(item => item.textContent.includes('AF-0001'))
  row?.click()
})
await sleep(600)
ok((await body()).includes('Datos del activo'), 'Ficha del activo abre desde el registro')
await clickText('Registrar deterioro'); await sleep(400)
ok((await body()).includes('NIC 36'), 'Formulario de deterioro abre')
await page.keyboard.press('Escape'); await sleep(300)

console.log('7. Módulo de costos')
await clickText('Todos los módulos'); await sleep(300); await clickText('Costos'); await sleep(600)
await clickText('Centros y conductores'); await sleep(500)
const centrosCosto = await body()
ok(centrosCosto.includes('CC-PROD'), 'Centro de costo CC-PROD visible')
ok(centrosCosto.includes('Costo directo'), 'Costo directo por centro visible')

await clickText('Distribución de CIF'); await sleep(500)
const cif = await body()
ok(cif.includes('CIF-001'), 'Pool CIF-001 visible')
ok(cif.includes('Pendiente'), 'Estado de distribución visible')

await clickText('Costeo estándar'); await sleep(500)
const estandar = await body()
ok(estandar.includes('CO-001'), 'Objeto de costo CO-001 visible')
ok(estandar.includes('Var. precio'), 'Descomposición de variaciones visible')

await clickText('Costeo ABC'); await sleep(500)
const abc = await body()
ok(abc.includes('AC-001'), 'Actividad AC-001 visible')
ok(abc.includes('Tasa por unidad'), 'Tasa del conductor visible')

console.log('8. Módulo de financiación')
await clickText('Todos los módulos'); await sleep(300); await clickText('Financiación y deuda'); await sleep(600)
await clickText('Préstamos bancarios'); await sleep(500)
const prestamos = await body()
ok(prestamos.includes('LB-2025-01'), 'Préstamo LB-2025-01 visible')
ok(prestamos.includes('13,80') || prestamos.includes('13.80'), 'Tasa efectiva anual visible')

await clickText('Calendario de amortización'); await sleep(500)
const amortizacion = await body()
ok(amortizacion.includes('Saldo inicial'), 'Calendario de amortización visible')
ok(amortizacion.includes('Interés'), 'Separación de capital e interés visible')

await clickText('Cupos de crédito'); await sleep(500)
const cupos = await body()
ok(cupos.includes('CL-001'), 'Cupo CL-001 visible')
ok(cupos.includes('Disponible'), 'Cupo disponible visible')

await clickText('Arrendamientos financieros'); await sleep(500)
ok((await body()).includes('AR-2024-01'), 'Leasing AR-2024-01 visible')

console.log('9. Módulo de indicadores')
await clickText('Todos los módulos'); await sleep(300); await clickText('Indicadores y proyecciones'); await sleep(600)
const tablero = await body()
ok(tablero.includes('Margen bruto'), 'Indicador de margen bruto visible')
ok(tablero.includes('EBITDA'), 'EBITDA proyectado visible')

await clickText('Catálogo de indicadores'); await sleep(500)
const catalogo = await body()
ok(catalogo.includes('LIQ-01'), 'Indicador LIQ-01 visible')
ok(catalogo.includes('Cumplimiento'), 'Cumplimiento por indicador visible')

await clickText('Proyecciones financieras'); await sleep(500)
const proyecciones = await body()
ok(proyecciones.includes('Ingresos operacionales'), 'Línea de ingresos proyectada visible')
ok(proyecciones.includes('Caja libre'), 'Caja libre proyectada visible')

await clickText('Escenarios'); await sleep(500)
const escenarios = await body()
ok(escenarios.includes('Optimista') && escenarios.includes('Conservador'), 'Escenarios comparables visibles')

console.log('10. Flujo de caja y liquidez')
await clickText('Todos los módulos'); await sleep(300); await clickText('Tesorería y bancos'); await sleep(600)
await clickText('Flujo de caja real'); await sleep(500)
const flujoReal = await body()
ok(flujoReal.includes('Flujo de caja mensual'), 'Flujo mensual real visible')
ok(flujoReal.includes('Detalle de movimientos'), 'Detalle de movimientos visible')
ok(flujoReal.includes('Saldo de cierre'), 'Saldo de cierre visible')

await clickText('Flujo de caja proyectado'); await sleep(500)
const flujoProyectado = await body()
ok(flujoProyectado.includes('Saldo final proyectado'), 'Saldo final proyectado visible')
ok(flujoProyectado.includes('Recaudos esperados'), 'Recaudos esperados visibles')
ok(flujoProyectado.includes('Pagos y compromisos'), 'Compromisos proyectados visibles')

await clickText('Liquidez y recaudos'); await sleep(500)
const liquidez = await body()
ok(liquidez.includes('Cobertura de pagos'), 'Cobertura de pagos visible')
ok(liquidez.includes('Calendario de recaudos'), 'Calendario de recaudos visible')
ok(liquidez.includes('Calendario de pagos'), 'Calendario de pagos visible')

console.log('11. Cierre y apertura de períodos')
await clickText('Todos los módulos'); await sleep(300); await clickText('Contabilidad general'); await sleep(500); await clickText('Cierres'); await sleep(700)
let cierres = await body()
ok(cierres.includes('Lista de verificación previa al cierre'), 'Checklist de cierre visible')
ok(cierres.includes('Febrero 2026'), 'Período actual visible')
ok(cierres.toLowerCase().includes('diferencia del balance'), 'Diferencia del balance visible')

await page.evaluate(() => [...document.querySelectorAll('main button')].find(button => button.textContent.includes('Todos los lotes contabilizados'))?.click())
await sleep(350)
await page.evaluate(() => [...document.querySelectorAll('main button')].find(button => button.textContent.includes('Respaldo de base de datos realizado'))?.click())
await sleep(350)

await clickText('Previsualizar y generar'); await sleep(500)
ok((await body()).includes('Comprobante de cierre'), 'Vista previa del comprobante abre')
await clickText('Generar comprobante de cierre'); await sleep(800)
cierres = await body()
ok(cierres.includes('NO-2026-02'), 'Comprobante NO-2026-02 generado')

await clickText('Cerrar Febrero 2026'); await sleep(500)
ok((await body()).includes('Escriba'), 'Confirmación de cierre solicita confirmación escrita')
await page.type('input.font-mono', 'CIERRE')
await sleep(250)
await clickText('Confirmar cierre'); await sleep(900)
cierres = await body()
ok(cierres.includes('Marzo 2026'), 'El período siguiente quedó abierto')
ok(cierres.includes('NO-2026-02'), 'Cierre de febrero registrado en el historial')
ok(cierres.includes('AP-2026-03'), 'Asiento de apertura AP-2026-03 generado')

await clickText('Reabrir'); await sleep(500)
await page.type('input.font-mono', 'REABRIR')
await sleep(250)
await clickText('Reabrir período'); await sleep(900)
cierres = await body()
ok(cierres.includes('Lista de verificación previa al cierre') && cierres.includes('Febrero 2026'), 'Período reabierto y checklist disponible')

console.log('12. Brechas operativas de fase 3')

// Cartera: provisión por deterioro
await clickText('Todos los módulos'); await sleep(300); await clickText('Cuentas por cobrar'); await sleep(500); await clickText('Provisión por deterioro'); await sleep(600)
let deterioro = await body()
ok(deterioro.includes('Política de deterioro'), 'Política de deterioro visible')
ok(deterioro.includes('Cartera sujeta por edades'), 'Cartera sujeta por edades visible')
await clickText('Calcular provisión de Febrero 2026'); await sleep(700)
ok((await body()).includes('Calculada'), 'Provisión calculada')
await clickText('Aprobar'); await sleep(600)
ok((await body()).includes('Aprobada'), 'Provisión aprobada')
await clickText('Contabilizar'); await sleep(700)
ok((await body()).includes('Contabilizada'), 'Provisión contabilizada')

// Cartera: conciliación con clientes
await clickText('Todos los módulos'); await sleep(300); await clickText('Cuentas por cobrar'); await sleep(500); await clickText('Conciliación con clientes'); await sleep(600)
ok((await body()).includes('Saldo auxiliar'), 'Conciliación con clientes visible')
await page.evaluate(() => [...document.querySelectorAll('main button')].find(button => button.textContent.trim() === 'Marcar conciliada')?.click())
await sleep(450)
ok((await body()).includes('Confirmar conciliación'), 'Modal de conciliación de cliente abre')
await clickText('Confirmar conciliación'); await sleep(800)
ok((await body()).includes('Confirmada por el cliente'), 'Cliente conciliado y confirmado')

// CxP: descuentos y notas débito
await clickText('Todos los módulos'); await sleep(300); await clickText('Cuentas por pagar'); await sleep(500); await clickText('Descuentos y notas débito'); await sleep(600)
let descuentos = await body()
ok(descuentos.includes('Descuentos y notas débito'), 'Descuentos y notas débito visibles')
ok(descuentos.includes('Nota débito'), 'Nota débito visible')
await clickText('Nuevo ajuste'); await sleep(500)
ok((await body()).includes('Nuevo descuento o nota de proveedor'), 'Formulario de ajuste abre')
await clickText('Registrar ajuste'); await sleep(800)
ok((await body()).includes('ADJ-0004'), 'Ajuste ADJ-0004 registrado')

// CxP: conciliación con proveedores
await clickText('Todos los módulos'); await sleep(300); await clickText('Cuentas por pagar'); await sleep(500); await clickText('Conciliación con proveedores'); await sleep(600)
ok((await body()).includes('Saldo auxiliar'), 'Conciliación con proveedores visible')
await page.evaluate(() => [...document.querySelectorAll('main button')].find(button => button.textContent.trim() === 'Marcar conciliada')?.click())
await sleep(450)
ok((await body()).includes('Confirmar conciliación'), 'Modal de conciliación de proveedor abre')
await clickText('Confirmar conciliación'); await sleep(800)
ok((await body()).includes('Confirmada por el proveedor'), 'Proveedor conciliado y confirmado')

// Activos fijos: traslados
await clickText('Todos los módulos'); await sleep(300); await clickText('Activos fijos'); await sleep(500); await clickText('Traslados'); await sleep(600)
let traslados = await body()
ok(traslados.includes('Traslados de activos'), 'Traslados de activos visibles')
ok(traslados.includes('Centro destino'), 'Centro destino visible')
await clickText('Nuevo traslado'); await sleep(500)
ok((await body()).includes('Nuevo traslado de activo'), 'Formulario de traslado abre')
await page.evaluate(() => {
  const selects = [...document.querySelectorAll('div.fixed select')]
  const target = selects.find(select => [...select.options].some(option => option.value === 'OPE'))
  if (target) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    setter.call(target, 'OPE')
    target.dispatchEvent(new Event('change', { bubbles: true }))
  }
})
await sleep(200)
await page.type('textarea', 'Reasignación por requerimiento operativo del área.')
await sleep(200)
await clickText('Solicitar traslado'); await sleep(800)
ok((await body()).includes('Traslado de AF-0001 solicitado'), 'Traslado de AF-0001 solicitado')

// Presupuesto: proyección por proyecto
await clickText('Todos los módulos'); await sleep(300); await clickText('Presupuestos'); await sleep(500); await clickText('Proyección por proyecto'); await sleep(600)
let proyectos = await body()
ok(proyectos.includes('Presupuesto por proyecto'), 'Presupuesto por proyecto visible')
ok(proyectos.includes('Desviación proyectada'), 'Desviación proyectada visible')
await clickText('Nuevo proyecto'); await sleep(500)
ok((await body()).includes('Nuevo proyecto presupuestal'), 'Formulario de proyecto abre')
await page.type('input[placeholder="Ej. Expansión zona sur"]', 'Expansión zona sur')
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('div.fixed input[type="number"]')]
  const target = inputs[inputs.length - 1]
  if (target) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(target, '120000000')
    target.dispatchEvent(new Event('input', { bubbles: true }))
  }
})
await sleep(250)
await clickText('Crear proyecto'); await sleep(800)
ok((await body()).includes('Proyecto Expansión zona sur agregado'), 'Proyecto presupuestal creado')

console.log('13. Tributación: formularios, declaración y exógena')

// Formulario 300
await clickText('Todos los módulos'); await sleep(300); await clickText('Facturación'); await sleep(500); await clickText('Formulario 300 (IVA)'); await sleep(600)
let f300 = await body()
ok(f300.includes('Formulario 300'), 'Formulario 300 visible')
ok(f300.includes('IVA generado'), 'Casillas de IVA visibles')
ok(f300.includes('Recalcular desde documentos'), 'Recálculo desde documentos disponible')
await clickText('Validar formulario'); await sleep(700)
ok((await body()).includes('Validada'), 'Formulario 300 validado')

// Formulario 350
await clickText('Todos los módulos'); await sleep(300); await clickText('Facturación'); await sleep(500); await clickText('Formulario 350 (Retención)'); await sleep(600)
let f350 = await body()
ok(f350.includes('Formulario 350'), 'Formulario 350 visible')
ok(f350.includes('Retención en la fuente practicada'), 'Retención en la fuente visible')
ok(f350.includes('ReteICA practicada'), 'ReteICA visible')

// Formulario 110
await clickText('Todos los módulos'); await sleep(300); await clickText('Facturación'); await sleep(500); await clickText('Formulario 110 (Renta)'); await sleep(600)
let f110 = await body()
ok(f110.includes('Formulario 110'), 'Formulario 110 visible')
ok(f110.includes('Renta líquida gravable'), 'Renta líquida gravable visible')
ok(f110.includes('Saldo a pagar'), 'Saldo a pagar de renta visible')

// Declaración electrónica
await clickText('Todos los módulos'); await sleep(300); await clickText('Facturación'); await sleep(500); await clickText('Declaración electrónica'); await sleep(600)
let declaracion = await body()
ok(declaracion.includes('Declaración electrónica'), 'Declaración electrónica visible')
ok(declaracion.includes('Pendientes'), 'Indicador de pendientes visible')
await page.evaluate(() => [...document.querySelectorAll('main button')].find(button => button.textContent.trim() === 'Gestionar')?.click())
await sleep(500)
ok((await body()).includes('Lista de verificación'), 'Checklist de presentación abre')
await page.evaluate(() => [...document.querySelectorAll('div.fixed label')].find(label => label.textContent.includes('Pago programado'))?.querySelector('input')?.click())
await sleep(250)
await clickText('Presentar ante la DIAN'); await sleep(500)
ok((await body()).includes('Escriba PRESENTAR'), 'Confirmación escrita de presentación')
await page.type('div.fixed input.font-mono', 'PRESENTAR')
await sleep(250)
await clickText('Confirmar presentación'); await sleep(900)
ok((await body()).includes('DIAN-300'), 'Acuse DIAN generado para el formulario 300')

// Exógena
await clickText('Todos los módulos'); await sleep(300); await clickText('Facturación'); await sleep(500); await clickText('Exógena y medios'); await sleep(600)
let exogena = await body()
ok(exogena.includes('Exógena y medios magnéticos'), 'Exógena visible')
ok(exogena.includes('Incidencias'), 'Indicador de incidencias visible')
await clickText('Corregir'); await sleep(500)
await clickText('Corregir'); await sleep(500)
ok(!(await body()).includes('por corregir'), 'Incidencias de exógena corregidas')
await clickText('Validar exógena'); await sleep(700)
ok((await body()).includes('Validada'), 'Exógena validada')
await clickText('Presentar exógena'); await sleep(500)
ok((await body()).includes('Escriba EXOGENA'), 'Confirmación escrita de exógena')
await page.type('div.fixed input.font-mono', 'EXOGENA')
await sleep(250)
await page.evaluate(() => [...document.querySelectorAll('div.fixed button')].find(button => button.textContent.includes('Presentar exógena'))?.click())
await sleep(900)
ok((await body()).includes('EXO-2025'), 'Acuse de exógena generado')

console.log('14. Transversales: aprobaciones, auditoría, consolidación y costos')

// Aprobaciones: bandeja y decisión
await clickText('Todos los módulos'); await sleep(300); await clickText('Aprobaciones'); await sleep(500); await clickText('Bandeja de aprobaciones'); await sleep(600)
let aprobaciones = await body()
ok(aprobaciones.includes('Bandeja de aprobaciones'), 'Bandeja de aprobaciones visible')
ok(aprobaciones.includes('APR-0201'), 'Solicitud APR-0201 visible')
await clickText('Aprobar'); await sleep(500)
ok((await body()).includes('Confirmar aprobación'), 'Modal de decisión abre')
await clickText('Confirmar aprobación'); await sleep(800)
ok((await body()).includes('aprobada'), 'Solicitud aprobada y trazada')

// Aprobaciones: reglas
await clickText('Todos los módulos'); await sleep(300); await clickText('Aprobaciones'); await sleep(500); await clickText('Reglas y niveles'); await sleep(600)
let reglas = await body()
ok(reglas.includes('Reglas y niveles de aprobación'), 'Reglas de aprobación visibles')
ok(reglas.includes('Tesorería'), 'Niveles y roles visibles')
await clickText('Desactivar'); await sleep(600)
ok((await body()).includes('Inactiva'), 'Regla desactivada')

// Auditoría: bitácora
await clickText('Todos los módulos'); await sleep(300); await clickText('Auditoría y control'); await sleep(500); await clickText('Bitácora de eventos'); await sleep(600)
let bitacora = await body()
ok(bitacora.includes('Bitácora de eventos'), 'Bitácora visible')
ok(bitacora.includes('Exportar bitácora'), 'Exportación de bitácora disponible')
await clickText('Exportar bitácora'); await sleep(600)
ok((await body()).includes('Bitácora exportada'), 'Bitácora exportada')

// Auditoría: permisos
await clickText('Todos los módulos'); await sleep(300); await clickText('Auditoría y control'); await sleep(500); await clickText('Roles y permisos'); await sleep(600)
let permisos = await body()
ok(permisos.includes('Matriz de permisos'), 'Matriz de permisos visible')
ok(permisos.includes('Suite completa'), 'Permiso global por rol visible')

// Consolidación: panel
await clickText('Todos los módulos'); await sleep(300); await clickText('Consolidación'); await sleep(500); await clickText('Panel de consolidación'); await sleep(600)
let consolidado = await body()
ok(consolidado.includes('Panel de consolidación'), 'Panel de consolidación visible')
ok(consolidado.includes('Participación no controlante'), 'Participación no controlante visible')
ok(consolidado.includes('CIA-002'), 'Compañía CIA-002 visible')

// Consolidación: eliminaciones
await clickText('Todos los módulos'); await sleep(300); await clickText('Consolidación'); await sleep(500); await clickText('Eliminaciones intercompañía'); await sleep(600)
let eliminaciones = await body()
ok(eliminaciones.includes('Eliminaciones intercompañía'), 'Eliminaciones visibles')
ok(eliminaciones.includes('Diferencia débito/crédito'), 'Control de cuadre visible')
await clickText('Aplicar'); await sleep(600)
ok((await body()).includes('marcada como aplicada'), 'Eliminación aplicada')
await clickText('Generar eliminaciones'); await sleep(600)
ok((await body()).includes('pendientes de aplicar'), 'Generación bloqueada por pendientes')

// Costos: distribución secundaria
await clickText('Todos los módulos'); await sleep(300); await clickText('Costos'); await sleep(500); await clickText('Distribución secundaria'); await sleep(600)
let secundaria = await body()
ok(secundaria.includes('Distribución secundaria'), 'Distribución secundaria visible')
ok(secundaria.includes('Centros de servicio'), 'Centros de servicio visibles')
await clickText('Recalcular distribución'); await sleep(700)
ok((await body()).includes('recalculada'), 'Distribución secundaria recalculada')

await browser.close()
console.log(failures === 0 ? '\nVERIFICACIÓN MÓDULOS: TODO OK ✓' : `\nVERIFICACIÓN MÓDULOS: ${failures} FALLOS`)
process.exit(failures === 0 ? 0 : 1)
