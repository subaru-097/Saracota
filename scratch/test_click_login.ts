import { chromium } from 'playwright';

async function testClickLogin() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('Clicking button#botao-login...');
  await page.click('button#botao-login').catch(e => console.error('Click err:', e.message));
  await page.waitForTimeout(2000);

  const isModalVisible = await page.evaluate(() => {
    const email = document.querySelector('input[name="email"]');
    return email !== null && (email as HTMLElement).offsetParent !== null;
  });

  console.log('Is email input visible after button#botao-login click?', isModalVisible);

  await browser.close();
}

testClickLogin().catch(console.error);
