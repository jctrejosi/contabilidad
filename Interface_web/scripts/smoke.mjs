/* Smoke test E2E — Interface_web (suite financiera + flujo contable) */
import puppeteer from 'puppeteer-core'

const BASE = process.env.BASE || 'http://127.0.0.1:8448'
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
  return page.evaluate((t) => {
    const els = [...document.querySelectorAll('button, a')]
    const el = els.find((e) => e.textContent.trim() === t) || els.find((e) => e.textContent.trim().length < 60 && e.textContent.includes(t))
    if (el) { el.click(); return true }
    return false
  }, t)
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

console.log('0. Selección de compañía → suite')
await page.goto(BASE, { waitUntil: 'networkidle0' })
await sleep(600)
const t0 = await body()
ok(t0.includes('Seleccione la compañía'), 'Pantalla de selección de compañía')
ok(t0.includes('Compañía Demo'), 'Compañía Demo listada')

await page.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Compañía Demo'))
  el?.click()
})
await sleep(250)
await clickText('Ingresar a la compañía')
await sleep(900)
const ts = await body()
ok(ts.includes('Centro financiero'), 'Suite financiera renderizada')
for (const modulo of ['Contabilidad general', 'Facturación', 'Cuentas por cobrar', 'Cuentas por pagar', 'Tesorería y bancos', 'Presupuestos']) {
  ok(ts.includes(modulo), `Módulo visible: ${modulo}`)
}

console.log('1. Tablero contable')
await clickText('Contabilidad general')
await sleep(700)
const t1 = await body()
ok(t1.includes('CONTABDSI'), 'Shell renderizado')
ok(t1.includes('Compañía Demo'), 'Compañía visible')
ok(t1.includes('NOM2'), 'Lote NOM2 visible en tablero')

console.log('2. Lotes: listado real y detalle NOM2')
await irA('Movimientos', 'Lotes')
await sleep(900)
const t2 = await body()
ok(t2.includes('NOM2'), 'Lote NOM2 en el listado')
ok(t2.includes('Nómina febrero'), 'Descripción del lote visible')
await page.evaluate(() => {
  const fila = [...document.querySelectorAll('tbody tr')].find((tr) => tr.textContent.includes('NOM2'))
  fila?.click()
})
await sleep(1200)
const t2b = await body()
ok(t2b.includes('Lote NOM2 — Nómina febrero'), 'Detalle del lote abierto')
ok(t2b.includes('Verificar lote'), 'Acción Verificar lote disponible')
ok(t2b.includes('Actualizar lote'), 'Acción Actualizar lote disponible')
ok(t2b.includes('+ Agregar movimiento'), 'Acción Agregar movimiento disponible')
await clickText('Verificar lote')
await sleep(1200)
const t2c = await body()
ok(t2c.includes('Resultado de verificación'), 'Verificación del lote ejecutada')
ok(t2c.includes('listo para actualizar') || t2c.includes('inconsistencia'), 'Resultado de la verificación mostrado')
await clickText('Cerrar')
await sleep(400)
await clickText('Volver a lotes')
await sleep(500)

console.log('3. Todas las pantallas nuevas navegables (sin PlaceholderPage)')
const rutas = [
  ['Movimientos', 'Captura directa'],
  ['Movimientos', 'Lotes'],
  ['Movimientos', 'Anulación'],
  ['Movimientos', 'Importaciones'],
  ['Movimientos', 'Reembolsos'],
  ['Consultas', 'Documentos'],
  ['Consultas', 'Movimiento mensual'],
  ['Consultas', 'Saldos anuales'],
  ['Consultas', 'Anual por cuenta'],
  ['Consultas', 'Anual por tercero'],
  ['Consultas', 'Anual por centro'],
  ['Consultas', 'Saldos cuenta/centro'],
  ['Consultas', 'Documento específico'],
  ['Consultas', 'Comparativos'],
  ['Informes', 'Informes 1–R'],
  ['Medios magnéticos', '1. Mantenimiento de formatos'],
  ['Medios magnéticos', '2. Mantenimiento de conceptos'],
  ['Medios magnéticos', '4. Generar medios'],
  ['Medios magnéticos', '5. Revisión de medios'],
  ['Medios magnéticos', '9. Medios por documento'],
  ['Configuración', 'Parámetros'],
  ['Configuración', 'Plan de cuentas'],
  ['Configuración', 'Terceros'],
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
  ok(!txt.includes(PLACEHOLDER) && !txt.includes('Panel de inicio'), `${grupo} → ${item}`)
}

for (const pantalla of ['Reprocesos y auditoría', 'Cierres', 'Consolidación']) {
  await clickText(pantalla)
  await sleep(600)
  const txt = await body()
  ok(!txt.includes(PLACEHOLDER) && !txt.includes('Panel de inicio'), `Pantalla independiente: ${pantalla}`)
}

console.log('3b. Ida y vuelta suite ↔ módulo ↔ contabilidad')
await clickText('Todos los módulos')
await sleep(500)
ok((await body()).includes('Centro financiero'), 'Volver a la suite desde contabilidad')
await clickText('Facturación')
await sleep(600)
ok((await body()).includes('Facturación'), 'Módulo Facturación abierto')
await clickText('Todos los módulos')
await sleep(500)
await clickText('Contabilidad general')
await sleep(600)
ok((await body()).includes('Inicio contable'), 'Regreso a Contabilidad general')

console.log('4. Captura directa operativa')
await irA('Movimientos', 'Captura directa')
await sleep(900)
const t4 = await body()
ok(t4.includes('Captura directa'), 'Pantalla de captura directa abierta')
ok(t4.includes('F2 Validar / Contabilizar'), 'Acción de contabilización disponible')
ok(t4.includes('Concepto general'), 'Cabecera del comprobante disponible')

console.log('5. Centro de informes con vista previa')
await irA('Informes', 'Informes 1–R')
await sleep(800)
ok((await body()).includes('Centro de informes'), 'Centro de informes abierto')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('3-') && b.textContent.includes('Balance de comprobación'))
  b?.click()
})
await sleep(500)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '1-Acumulado')
  b?.click()
})
await sleep(800)
ok((await body()).includes('Parámetros'), 'Parámetros del informe abiertos')
await clickText('Generar informe')
await sleep(4000)
const tInf = await body()
ok(tInf.includes('BALANCE DE COMPROBACIÓN ACUMULADO'), 'Vista previa del informe generada')
ok(tInf.includes('Compañía Demo'), 'Vista previa con datos de la compañía')

await browser.close()
console.log(failures === 0 ? '\nSMOKE TEST: TODO OK ✓' : `\nSMOKE TEST: ${failures} FALLOS`)
process.exit(failures === 0 ? 0 : 1)
