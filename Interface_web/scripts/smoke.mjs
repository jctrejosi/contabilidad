/* Smoke test E2E — Interfase_web_figma (flujo contable + coherencia) */
import puppeteer from 'puppeteer-core'

const BASE = 'http://localhost:8444'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PLACEHOLDER = 'Implementación completa disponible en la versión de producción'

let failures = 0
function ok(cond, label) {
  if (cond) console.log(`  ✓ ${label}`)
  else { failures++; console.log(`  ✗ ${label}`) }
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,900'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 900 })
page.on('pageerror', (e) => { failures++; console.log('  ✗ PAGE ERROR:', e.message) })

const body = () => page.evaluate(() => document.body.innerText)

async function clickText(t) {
  await page.evaluate((t) => {
    const els = [...document.querySelectorAll('button, a')]
    const el = els.find((e) => e.textContent.trim() === t) || els.find((e) => e.textContent.trim().length < 60 && e.textContent.includes(t))
    if (el) el.click()
  }, t)
}

/** Selecciona la opción cuyo texto contiene `optionText` en el select editable (borde azul) */
async function elegirEnSelect(optionText) {
  return page.evaluate((ot) => {
    const sel = [...document.querySelectorAll('select')].find((s) => s.className.includes('border-blue'))
    if (!sel) return false
    const opt = [...sel.options].find((o) => o.text.includes(ot))
    if (!opt) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    setter.call(sel, opt.value)
    sel.dispatchEvent(new Event('input', { bubbles: true }))
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, optionText)
}

async function irA(grupo, item) {
  // Abrir el grupo si está cerrado
  for (let i = 0; i < 2; i++) {
    const visible = await page.evaluate((g, it) => {
      const gbtn = [...document.querySelectorAll('aside button')].find((b) => b.textContent.includes(g))
      const container = gbtn?.parentElement
      const itbtn = container ? [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === it) : null
      return !!itbtn && itbtn.offsetParent !== null
    }, grupo, item)
    if (visible) break
    await page.evaluate((g) => {
      const gbtn = [...document.querySelectorAll('aside button')].find((b) => b.textContent.includes(g))
      gbtn?.click()
    }, grupo)
    await sleep(250)
  }
  // Clic en el item dentro del contenedor del grupo (evita items homónimos de otros grupos)
  await page.evaluate((g, it) => {
    const gbtn = [...document.querySelectorAll('aside button')].find((b) => b.textContent.includes(g))
    const container = gbtn?.parentElement
    const itbtn = container ? [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === it) : null
    itbtn?.click()
  }, grupo, item)
  await sleep(450)
}

console.log('1. Tablero')
await page.goto(BASE, { waitUntil: 'networkidle0' })
await sleep(600)
const t1 = await body()
ok(t1.includes('CONTABDSI'), 'Shell renderizado')
ok(t1.includes('Compañía Demo'), 'Compañía visible')
ok(t1.includes('NOM2'), 'Lote NOM2 visible en tablero')

console.log('2. Flujo NOM2 (corregir → verificar → aprobar → contabilizar → documento)')
await page.evaluate(() => {
  const el = [...document.querySelectorAll('button, tr, td, .cursor-pointer')].find((e) => e.textContent.includes('NOM2'))
  el?.click()
})
await sleep(700)
let t2 = await body()
ok(t2.includes('Nómina febrero'), 'Editor del lote abierto')
ok(t2.includes('Con errores'), 'Estado inicial: Con errores')
ok(t2.includes('2 errores'), 'Centro de validación: 2 errores')

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Ir a celda'))
  btn?.click()
})
await sleep(700)
ok(await page.evaluate(() => [...document.querySelectorAll('select')].some((s) => s.className.includes('border-blue'))), 'Celda 1 en edición (tercero)')
ok(await elegirEnSelect('García Moreno'), 'Tercero asignado (L01)')
await sleep(400)

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Ir a celda'))
  btn?.click()
})
await sleep(700)
ok(await elegirEnSelect('ADM'), 'Centro asignado (L03)')
await sleep(500)

const t3 = await body()
ok(t3.includes('Cuadrado'), 'Lote cuadrado tras corregir')
ok(!t3.includes('Ir a celda'), 'Sin errores pendientes')

await clickText('Verificar ahora')
await sleep(400)
ok((await body()).includes('Verificado'), 'Estado Verificado')

await clickText('Enviar a aprobación')
await sleep(300)
await clickText('Confirmar')
await sleep(400)
ok((await body()).includes('Pendiente aprobación'), 'Estado Pendiente aprobación')

await clickText('Aprobar')
await sleep(300)
await clickText('Confirmar')
await sleep(400)
ok((await body()).includes('Aprobado'), 'Estado Aprobado')

await clickText('Contabilizar')
await sleep(300)
await clickText('Confirmar')
await sleep(4500)
const t4 = await body()
ok(t4.includes('Contabilizado'), 'Estado Contabilizado')
ok(t4.includes('CE-000245'), 'Recibo con comprobante CE-000245')

await clickText('Ver documento oficial')
await sleep(700)
const t5 = await body()
ok(t5.includes('DOCUMENTO CONTABLE OFICIAL'), 'Documento oficial abierto')
ok(t5.includes('NOM-2026-02'), 'Documento NOM-2026-02 visible')

console.log('3. Todas las pantallas nuevas navegables (sin PlaceholderPage)')
const rutas = [
  ['Configuración', 'Parámetros'],
  ['Movimientos', 'Importaciones'],
  ['Movimientos', 'Nómina'],
  ['Movimientos', 'Reembolsos'],
  ['Consultas', 'Documentos'],
  ['Consultas', 'Saldos anuales'],
  ['Consultas', 'Anual por cuenta'],
  ['Consultas', 'Anual por tercero'],
  ['Consultas', 'Anual por centro'],
  ['Consultas', 'Saldos cuenta/centro'],
  ['Consultas', 'Documento específico'],
  ['Consultas', 'Comparativos'],
  ['Informes', 'Documentos'],
  ['Informes', 'Libros'],
  ['Informes', 'Terceros'],
  ['Informes', 'Centros'],
  ['Informes', 'Flujo de caja'],
  ['Informes', 'NIC/NIIF'],
  ['Informes', 'Generador personalizado'],
  ['Impuestos', 'Retenciones'],
  ['Impuestos', 'IVA'],
  ['Impuestos', 'Medios magnéticos'],
  ['Configuración', 'Comprobantes'],
  ['Configuración', 'Centros de costo'],
  ['Configuración', 'Renglones de renta'],
  ['Configuración', 'Tipos de documento'],
  ['Configuración', 'Retenciones'],
  ['Configuración', 'IVA'],
  ['Configuración', 'Plantillas contables'],
  ['Configuración', 'Compañías'],
  ['Configuración', 'Formatos documentales'],
  ['Configuración', 'Especiales'],
  ['Configuración', 'Reclasificaciones'],
  ['Administración', 'Usuarios y permisos'],
  ['Administración', 'Bitácora'],
  ['Administración', 'Integraciones'],
  ['Administración', 'Reorganización de datos'],
]
for (const [grupo, item] of rutas) {
  await irA(grupo, item)
  const txt = await body()
  const placeholder = txt.includes(PLACEHOLDER)
  ok(!placeholder, `${grupo} → ${item} (sin placeholder: ${!placeholder})`)
}

console.log('4. Coherencia: lote generado desde Nómina aparece en la lista')
await irA('Movimientos', 'Nómina')
await clickText('Generar lote')
await sleep(400)
await clickText('Abrir lotes')
await sleep(600)
ok((await body()).includes('Borrador'), 'El lote nuevo aparece en la lista con estado Borrador')

console.log('5. Informes con vista previa')
await irA('Informes', 'Libros')
await sleep(400)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find((e) => e.textContent.trim() === 'Balance de comprobación acumulado')
  if (el) el.click()
})
await sleep(400)
await clickText('Generar informe')
await sleep(700)
const tInf = await body()
ok(tInf.includes('Balance de comprobación acumulado'), 'Vista previa del informe generada')
ok(tInf.includes('TOTALES') || tInf.includes('Total'), 'Informe con totales')

await browser.close()
console.log(failures === 0 ? '\nSMOKE TEST: TODO OK ✓' : `\nSMOKE TEST: ${failures} FALLOS`)
process.exit(failures === 0 ? 0 : 1)
