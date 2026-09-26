const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  console.log('Navigating to Cofema...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('Clicking Entre ou Cadastre-se...');
  const entreBtn = page.locator('button:has-text("Entre ou Cadastre-se")').first();
  await entreBtn.click();
  await page.waitForTimeout(1000);

  console.log('Clicking Área do Cliente via getByText...');
  const areaClienteLoc = page.getByText('Área do Cliente', { exact: true }).first();
  await areaClienteLoc.click();
  await page.waitForTimeout(3000);

  console.log('Current URL after click:', page.url());
  await page.screenshot({ path: 'scratch/after_area_cliente_click.png' });

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, button')).map(el => ({
      tag: el.tagName,
      id: el.id,
      name: el.name,
      type: el.type,
      placeholder: el.placeholder,
      class: el.className,
      text: el.innerText ? el.innerText.trim() : ''
    }));
  });

  console.log('Inputs found:', JSON.stringify(inputs, null, 2));

  await browser.close();
})();
