/* Comprueba filtros de INFOR04 y generación sin modificar datos contables. */
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  const requests = [];
  page.on('request', request => {
    if (request.url().includes('/api/informes/adicionales/bal-gral-resultados?')) requests.push(request.url());
  });
  await page.goto('http://127.0.0.1:8443/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[role="radio"]');
  await page.evaluate(() => [...document.querySelectorAll('[role="radio"]')]
    .find(element => element.textContent.includes('027'))?.click());
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(element => element.textContent.trim() === 'Ingresar a la compañía')?.click());
  await page.waitForFunction(() => document.body.textContent.includes('Panel de inicio'));
  await page.evaluate(() => [...document.querySelectorAll('aside button')]
    .find(element => [...element.querySelectorAll('span')]
      .some(span => span.textContent.trim() === 'Informes'))?.click());
  await page.evaluate(() => [...document.querySelectorAll('aside button')]
    .find(element => element.textContent.includes('Informes 1–R'))?.click());
  await page.waitForSelector('input[aria-label="Buscar informe"]');
  await page.type('input[aria-label="Buscar informe"]', 'Balance general y estado de resultados');
  await page.waitForFunction(() => [...document.querySelectorAll('button')]
    .some(element => element.textContent.trim() === 'Generar'));
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(element => element.textContent.trim() === 'Generar')?.click());
  await page.waitForSelector('#param-mes-balance-general');
  const filter = await page.evaluate(() => ({
    monthCount: document.querySelectorAll('#param-mes-balance-general option').length,
    hasRange: !!document.querySelector('#param-mes-desde, #param-mes-hasta'),
    hasAccountRange: !!document.querySelector('#param-cuentaDesde, #param-cuentaHasta'),
    checkboxCount: document.querySelectorAll('form input[type="checkbox"]').length,
  }));
  if (filter.monthCount !== 18 || filter.hasRange || filter.hasAccountRange || filter.checkboxCount !== 3) {
    throw new Error(`Filtros incorrectos: ${JSON.stringify(filter)}`);
  }
  await page.select('#param-mes-balance-general', 'Mes 13');
  await page.focus('#param-mes-balance-general');
  await page.keyboard.press('Enter');
  const next = await page.evaluate(() => document.activeElement?.id);
  if (next !== 'param-nivel-balance-general' || requests.length) {
    throw new Error(`Enter generó anticipadamente o no avanzó: ${next}`);
  }
  await page.waitForSelector('button[data-report-submit]:not([disabled])');
  await page.click('button[data-report-submit]');
  try {
    await page.waitForFunction(() => document.body.textContent.includes('ESTADO DE RESULTADOS A ENERO 2026 (MES 13)'),
      { timeout: 30000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      body: document.body.textContent.slice(-2500),
      alerts: [...document.querySelectorAll('[role="alert"]')].map(element => element.textContent),
    }));
    throw new Error(`La vista previa no apareció: ${JSON.stringify({ state, requests })}`, { cause: error });
  }
  if (!requests[0]?.includes('mesDesde=13') || !requests[0]?.includes('mesHasta=13')) {
    throw new Error(`La consulta no recibió el mes único: ${requests[0]}`);
  }
  console.log('Balance general: filtros originales, Enter y generación por mes verificados.');
} finally {
  await browser.close();
}
