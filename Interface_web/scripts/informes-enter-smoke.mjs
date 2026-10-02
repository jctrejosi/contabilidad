/* Verifica que Enter recorra filtros y no envíe el informe prematuramente. */
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});

try {
  const page = await browser.newPage();
  let generated = 0;
  page.on('request', request => {
    if (request.url().includes('/api/informes/adicionales/aux-gral?')) generated += 1;
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
  await page.waitForFunction(() => [...document.querySelectorAll('aside button')]
    .some(element => element.textContent.includes('Informes 1–R')));
  await page.evaluate(() => [...document.querySelectorAll('aside button')]
    .find(element => element.textContent.includes('Informes 1–R'))?.click());
  await page.waitForSelector('input[aria-label="Buscar informe"]');
  await page.type('input[aria-label="Buscar informe"]', 'Libro auxiliar general');
  await page.waitForFunction(() => [...document.querySelectorAll('button')]
    .some(element => element.textContent.trim() === 'Generar'));
  const opened = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find(element => element.textContent.trim() === 'Generar');
    button?.click();
    return Boolean(button);
  });
  if (!opened) throw new Error('No se abrió el filtro del Libro auxiliar general.');
  await page.waitForSelector('#param-fecha-desde');
  await page.waitForSelector('button[data-report-submit]:not([disabled])');

  const expected = [
    'param-fecha-hasta', 'param-modalidad', 'param-cuentaDesde',
    'param-cuentaHasta', 'submit',
  ];
  for (const next of expected) {
    await page.keyboard.press('Enter');
    const focused = await page.evaluate(() => document.activeElement?.hasAttribute('data-report-submit')
      ? 'submit' : document.activeElement?.id);
    if (focused !== next) throw new Error(`Enter debía enfocar ${next}; enfocó ${focused}.`);
    if (generated !== 0) throw new Error('El informe se generó antes de confirmar el botón.');
  }
  console.log('Enter recorrió los filtros y enfocó Generar informe sin enviarlo.');
} finally {
  await browser.close();
}
