import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://cicalfer.com.br/', { waitUntil: 'domcontentloaded' });
  const text = await page.evaluate(() => document.body.innerText);

  console.log('Contém "inválid"?:', text.includes('inválid'));
  console.log('Contém "incorret"?:', text.includes('incorret'));
  console.log('Contém "Credenciais Inválidas"?:', text.includes('Credenciais Inválidas'));

  const matches = text.match(/.{0,50}(inválid|incorret).{0,50}/gi);
  console.log('Ocorrências encontradas na página estática:', matches);

  await browser.close();
})();
