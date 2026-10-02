/* Prueba de navegación de Reembolsos sin modificar datos contables. */
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8443/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[role="radio"]');
  const company = await page.$x?.('//button[@role="radio" and contains(., "027")]');
  if (company?.[0]) await company[0].click();
  else await page.evaluate(() => [...document.querySelectorAll('[role="radio"]')].find(el => el.textContent.includes('027'))?.click());
  await page.evaluate(() => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Ingresar a la compañía')?.click());
  await page.waitForFunction(() => document.body.textContent.includes('Panel de inicio'));
  await page.evaluate(() => [...document.querySelectorAll('aside button')].find(el => el.textContent.includes('Movimientos'))?.click());
  await page.evaluate(() => [...document.querySelectorAll('aside button')].find(el => el.textContent.trim() === 'Reembolsos')?.click());
  await page.waitForFunction(() => document.body.textContent.includes('Reembolsos guardados'));
  await page.waitForFunction(() => !document.body.textContent.includes('Cargando reembolsos'));
  const state = await page.evaluate(() => {
    const code = document.querySelector('input[maxlength="12"]');
    code?.focus();
    return { title: document.querySelector('h1')?.textContent, code: code?.value,
      hasDemo: document.body.textContent.includes('Datos de demostración'),
      hasLoadError: !!document.querySelector('[role="alert"]') };
  });
  await page.keyboard.press('Enter');
  const focus = await page.evaluate(() => document.activeElement?.tagName);
  if (errors.length || state.title !== 'Reembolsos' || state.hasDemo || state.hasLoadError || focus !== 'SELECT') {
    throw new Error(JSON.stringify({ state, focus, errors }));
  }
  // Sin guardar ni tocar Advantage: ambos atajos deben llegar a sus
  // validaciones, no ejecutar una escritura con el formulario incompleto.
  await page.keyboard.press('F2');
  await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent.includes('Guarde el reembolso'));
  await page.keyboard.press('F4');
  await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent.includes('Agregue al menos un ítem'));
  await page.evaluate(() => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Agregar ítem')?.click());
  await page.waitForSelector('input[placeholder="Buscar tercero"]');
  await page.type('input[placeholder="Buscar tercero"]', '111222333');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('[role="dialog"] button').length > 4);
  await page.keyboard.press('Enter');
  const thirdFocus = await page.evaluate(() => document.activeElement?.getAttribute('list'));
  if (thirdFocus !== 'reembolso-centros') throw new Error(`El foco no avanzó al centro: ${thirdFocus}`);
  console.log('Reembolsos: pantalla real, búsqueda de tercero y navegación con Enter correctas.');
} finally {
  await browser.close();
}
