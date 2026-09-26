import { chromium } from 'playwright';

async function testCofemaSearch() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Testing Cofema search URLs and DOM elements...');

  // Test 1: page/busca?q=DUCHA LORENZETTI BELLA DUCHA 220V
  await page.goto('https://www.cofema.com.br/page/busca?q=DUCHA%20LORENZETTI%20BELLA%20DUCHA%20220V', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const text1 = await page.evaluate(() => document.body.innerText);
  console.log('\n--- PAGE /page/busca?q=... ---');
  console.log('Snippet:', text1.substring(0, 500));
  console.log('Cards count:', await page.locator('div.rounded-lg, div.border, div[class*="product-card"]').count());

  // Test 2: page/busca?q=300500
  await page.goto('https://www.cofema.com.br/page/busca?q=300500', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const text2 = await page.evaluate(() => document.body.innerText);
  console.log('\n--- PAGE /page/busca?q=300500 ---');
  console.log('Snippet:', text2.substring(0, 500));

  // Test 3: Type into search input on home page
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const searchInput = page.locator('#input-busca-home, input[placeholder*="Buscar"], input[type="search"]').first();
  console.log('\nSearch input visible on home:', await searchInput.isVisible().catch(() => false));
  if (await searchInput.isVisible()) {
    await searchInput.fill('300500');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    console.log('URL after submit search:', page.url());
    const text3 = await page.evaluate(() => document.body.innerText);
    console.log('Snippet after search submit:', text3.substring(0, 500));
  }

  await browser.close();
}

testCofemaSearch().catch(console.error);
