/* Verifica el formulario y la llamada sin escribir en Advantage. */
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  const requests = [];
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().includes('/api/informes/iva-acumulacion?')) {
      requests.push(request.url());
      request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'iva-acumulacion', compania: { codigo: '027', nombre: 'PRUEBA', nit: '900' },
        anio: 2026, mesDesde: 2, mesHasta: 3,
        columnas: ['Cuenta', 'Tercero', 'Base débito', 'IVA débito', 'Base crédito', 'IVA crédito', 'Base neta', 'IVA neto']
          .map((label, index) => ({ label, money: index >= 2 })),
        filas: [['240805', '900', 100, 19, -50, -9.5, 50, 9.5]],
        totales: ['', 'TOTALES', 100, 19, -50, -9.5, 50, 9.5],
        count: 1, source: 'CONIVA', nota: 'Acumulación de IVA de los meses 02 a 03 del ejercicio 2026.',
      }) });
    } else request.continue();
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
  await page.waitForFunction(() => [...document.querySelectorAll('summary')]
    .some(element => element.textContent.includes('Informe de IVA')));
  await page.evaluate(() => [...document.querySelectorAll('summary')]
    .find(element => element.textContent.includes('Informe de IVA'))?.click());
  await page.evaluate(() => {
    const group = [...document.querySelectorAll('details')]
      .find(element => element.querySelector('summary')?.textContent.includes('Informe de IVA'));
    [...(group?.querySelectorAll('button') ?? [])]
      .find(element => element.textContent.trim() === 'Acumulación general')?.click();
  });
  await page.waitForSelector('#param-mes-desde');
  await page.waitForSelector('button[data-report-submit]:not([disabled])');
  const filter = await page.evaluate(() => ({
    selects: [...document.querySelectorAll('form select')].map(element => element.id),
    inputs: document.querySelectorAll('form input').length,
    button: document.querySelector('button[data-report-submit]')?.textContent.trim(),
  }));
  if (filter.selects.join(',') !== 'param-mes-desde,param-mes-hasta' ||
      filter.inputs !== 0 || filter.button !== 'Procesar acumulación') {
    throw new Error(`Filtro distinto al original: ${JSON.stringify(filter)}`);
  }
  await page.select('#param-mes-desde', 'Febrero');
  await page.select('#param-mes-hasta', 'Marzo');
  await page.focus('#param-mes-desde');
  await page.keyboard.press('Enter');
  if (await page.evaluate(() => document.activeElement?.id) !== 'param-mes-hasta' || requests.length) {
    throw new Error('Enter procesó antes de llegar al botón.');
  }
  await page.click('button[data-report-submit]');
  await page.waitForFunction(() => document.body.textContent.includes('Base neta'));
  if (!requests[0]?.includes('cia=027') || !requests[0]?.includes('mesDesde=2') ||
      !requests[0]?.includes('mesHasta=3')) {
    throw new Error(`Filtros enviados incorrectamente: ${requests[0]}`);
  }
  console.log('IVA: menú, rango mensual, Enter y vista previa verificados sin modificar datos.');
} finally {
  await browser.close();
}
