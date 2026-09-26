import { chromium } from 'playwright';

async function testReactSelectArrow() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  const selectControl = page.locator('.react-select__control, [id*="react-select"]').first();
  if (await selectControl.isVisible().catch(() => false)) {
    console.log('Clicking select control...');
    await selectControl.click({ force: true });
    await page.waitForTimeout(400);

    // Click the 96 option directly if present in DOM
    const opt96 = page.locator('.react-select__option').filter({ hasText: '96' }).first();
    if (await opt96.count() > 0) {
      console.log('Clicking .react-select__option with text 96...');
      await opt96.click();
      await page.waitForTimeout(3000);
    } else {
      console.log('Using ArrowDown + Enter...');
      await page.keyboard.type('96');
      await page.waitForTimeout(300);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }
  }

  const cardsCount = await page.evaluate(() => document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]').length);
  console.log(`Cards count in DOM: ${cardsCount}`);

  await browser.close();
}

testReactSelectArrow().catch(console.error);
