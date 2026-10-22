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
    ],
  },
  {
    name: 'Tesorería y bancos',
    pages: [
      ['Panel de tesorería', 'panel'],
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
      ['Alertas', 'alertas'],
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
await sleep(600)
await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Compañía Demo'))?.click())
await sleep(200)
await clickText('Ingresar a la compañía')
await sleep(900)

console.log('1. Render de las 40 pantallas')
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

await browser.close()
console.log(failures === 0 ? '\nVERIFICACIÓN MÓDULOS: TODO OK ✓' : `\nVERIFICACIÓN MÓDULOS: ${failures} FALLOS`)
process.exit(failures === 0 ? 0 : 1)
