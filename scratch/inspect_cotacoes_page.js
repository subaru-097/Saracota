const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/cotacoes');
  await page.waitForTimeout(5000);
  console.log('Current URL:', page.url());
  console.log('Inputs found:');
  const inputs = await page.locator('input, textarea, button').all();
  for (const input of inputs) {
    const ph = await input.getAttribute('placeholder').catch(() => null);
    const text = await input.innerText().catch(() => null);
    const type = await input.getAttribute('type').catch(() => null);
    console.log(`Tag: ${await input.evaluate(el => el.tagName)}, type: ${type}, placeholder: "${ph}", text: "${text}"`);
  }
  await browser.close();
})();
