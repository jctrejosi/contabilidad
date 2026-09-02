/* Smoke test E2E del flujo obligatorio CONTABDSI (puppeteer-core + chromium del sistema) */
import puppeteer from 'puppeteer-core'

const BASE = 'http://localhost:4173/#'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let failures = 0
function ok(cond, label) {
  if (cond) console.log(`  ✓ ${label}`)
  else {
    failures++
    console.log(`  ✗ ${label}`)
  }
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,900'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 900 })
page.on('pageerror', (e) => { failures++; console.log('  ✗ PAGE ERROR:', e.message) })
page.on('console', (m) => { if (m.type() === 'error') console.log('  [console.error]', m.text()) })

async function text(sel) {
  try {
    return await page.$eval(sel, (el) => el.textContent ?? '')
  } catch { return '' }
}
async function clickText(t, partial = false) {
  await page.evaluate(([t, partial]) => {
    const els = [...document.querySelectorAll('button, a, .stat-card, td, .nav-item')]
    const el = els.find((e) => (partial ? e.textContent.includes(t) : e.textContent.trim() === t))
    if (el) el.click()
  }, [t, partial])
}

console.log('1. Tablero')
await page.goto(BASE + '/', { waitUntil: 'networkidle0' })
await sleep(600)
ok((await text('body')).includes('CONTABDSI'), 'Shell renderizado')
ok((await text('body')).includes('Compañía Demo'), 'Compañía visible en tablero')
ok((await text('body')).includes('Laura Gómez'), 'Usuario visible')
ok((await text('body')).includes('NOM2'), 'Lote NOM2 visible en tablero')

console.log('2. Abrir lote NOM2 desde tablero')
await clickText('NOM2', true)
await sleep(600)
ok(page.url().includes('/movimientos/lotes/NOM2'), 'Navegó a editor del lote NOM2')
ok((await text('body')).includes('Nómina febrero'), 'Nombre del lote visible')
ok((await text('body')).includes('Con errores'), 'Estado: Con errores')
await clickText('Validaciones', true)
await sleep(300)
const errCount = await page.evaluate(() => document.querySelectorAll('.vc-error').length)
ok(errCount === 2, `Centro de validación muestra 2 errores (encontrados: ${errCount})`)

console.log('3. Corregir centro (línea 7)')
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.vc-error')]
  const b = items[0]?.querySelector('button')
  b?.click()
})
await sleep(500)
const editing = await page.evaluate(() => document.querySelector('.eg-cell-editing') !== null)
ok(editing, 'La celda del error quedó en edición')
await page.click('.eg-cell-editing .combo-input')
await page.keyboard.type('ADM')
await sleep(300)
await page.keyboard.press('Enter')
await sleep(500)

console.log('4. Corregir tercero (línea 11)')
await clickText('Validaciones', true)
await sleep(300)
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.vc-error')]
  const b = items[0]?.querySelector('button')
  b?.click()
})
await sleep(500)
await page.click('.eg-cell-editing .combo-input')
await page.keyboard.type('900111222')
await sleep(300)
await page.keyboard.press('Enter')
await sleep(600)

const bodyAfter = await text('body')
ok(bodyAfter.includes('Cuadrado'), 'Lote cuadrado tras corregir')
await clickText('Validaciones', true)
await sleep(300)
const errsAfter = await page.evaluate(() => document.querySelectorAll('.vc-error').length)
ok(errsAfter === 0, `Errores en cero tras corregir (restantes: ${errsAfter})`)

console.log('5. Verificar → aprobación → aprobar')
const btnVerificar = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Verificar')))
if (btnVerificar) { await clickText('Verificar', true); await sleep(500) }
ok((await text('body')).includes('Verificado'), 'Estado Verificado')
await clickText('Enviar a aprobación', true)
await sleep(400)
ok((await text('body')).includes('Pendiente aprobación'), 'Estado Pendiente aprobación')
await clickText('Aprobar', true)
await sleep(400)
ok((await text('body')).includes('Aprobado'), 'Estado Aprobado')

console.log('6. Contabilizar (atómico) y recibo')
await clickText('Contabilizar', true)
await sleep(4200)
const bodyPost = await text('body')
ok(bodyPost.includes('Contabilizado'), 'Estado Contabilizado')
ok(bodyPost.includes('CE-000245'), 'Comprobante CE-000245 en recibo')
await clickText('Ver documento oficial', true)
await sleep(600)
const bodyDoc = await text('body')
ok(bodyDoc.includes('NOM-2026-02'), 'Documento oficial muestra NOM-2026-02')

console.log('7. Consulta mensual e informe')
await page.goto(BASE + '/consultas/movimiento-mensual', { waitUntil: 'networkidle0' })
await sleep(600)
ok((await text('body')).includes('Movimiento mensual'), 'Consulta mensual renderiza')
await page.goto(BASE + '/informes/reporte/lib-balance-acumulado', { waitUntil: 'networkidle0' })
await sleep(600)
ok((await text('body')).includes('Balance de comprobación acumulado'), 'Informe balance de comprobación renderiza')
await clickText('Generar', true)
await sleep(800)
ok((await page.evaluate(() => document.querySelector('.preview-table') !== null)), 'Vista previa del informe generada')
ok((await text('body')).includes('Exportar'), 'Botón exportar visible')

console.log('8. Navegación por áreas (rutas navegables)')
const rutas = [
  ['/movimientos/captura', 'Captura directa'],
  ['/movimientos/lotes', 'Lotes'],
  ['/configuracion/plan-cuentas', 'Plan de cuentas'],
  ['/configuracion/terceros', 'Terceros'],
  ['/impuestos/retenciones', 'Retenciones'],
  ['/impuestos/medios-magneticos', 'Medios magnéticos'],
  ['/reprocesos', 'Reprocesos'],
  ['/cierres', 'Cierres'],
  ['/consolidacion', 'Consolidación'],
  ['/administracion/bitacora', 'Bitácora'],
]
for (const [ruta, label] of rutas) {
  await page.goto(BASE + ruta, { waitUntil: 'networkidle0' })
  await sleep(350)
  const t = await text('body')
  ok(t.includes(label), `${ruta} → "${label}"`)
}

console.log('9. Cambio de rol (simulación de permisos)')
await page.goto(BASE + '/', { waitUntil: 'networkidle0' })
await sleep(500)
await page.evaluate(() => { document.querySelector('.user-chip')?.click() })
await sleep(300)
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.user-pop .notif-item')]
  const b = btns.find((x) => x.textContent.includes('Consulta gerencial'))
  b?.click()
})
await sleep(500)
const gerencia = await text('body')
ok(gerencia.toLowerCase().includes('consulta gerencial') || gerencia.toLowerCase().includes('solo lectura'), 'Banner de rol gerencial visible')
const movItems = await page.evaluate(() => [...document.querySelectorAll('.nav-item-label')].map((e) => e.textContent))
ok(!movItems.some((x) => x === 'Captura directa'), 'Menú de movimientos oculto para gerencia')

await browser.close()
console.log(failures === 0 ? '\nSMOKE TEST: TODO OK ✓' : `\nSMOKE TEST: ${failures} FALLOS`)
process.exit(failures === 0 ? 0 : 1)
