const { chromium } = require('playwright');
const path = require('path');

async function captureUiFlow() {
  console.log('--- CAPTURING SARA COTA UI FLOW VIA LOCAL PLAYWRIGHT ---');

  const artifactDir = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\aebbd560-11f1-4178-a6da-74a0c0e88b43';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000/login...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Fill login credentials
  await page.fill('input[name="email"]', 'colaborador@saracota.com.br');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(3000);
  if (!page.url().includes('/cotacoes')) {
    await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  }

  // Screenshot 1: Initial Cotacoes page with emerald button
  const screenshot1Path = path.join(artifactDir, '01_saracota_ui_cotar_cicalfer_button.png');
  await page.screenshot({ path: screenshot1Path, fullPage: true });
  console.log(`Saved screenshot 1: ${screenshot1Path}`);

  // Locate and click "Cotar Cicalfer (Motor Central RPA)" button
  const button = page.locator('button:has-text("Cotar Cicalfer")').first();
  if (await button.isVisible()) {
    console.log('Clicking "Cotar Cicalfer (Motor Central RPA)" button...');
    await button.click();

    // Wait until the green badge "✓ PERSISTIDO NO SUPABASE" appears on screen
    console.log('Waiting for "✓ PERSISTIDO NO SUPABASE" badge to appear in DOM...');
    await page.waitForSelector('text=PERSISTIDO NO SUPABASE', { timeout: 60000 });
    await page.waitForTimeout(2000);

    // Screenshot 2: Completed quote card showing DB persistence and items
    const screenshot2Path = path.join(artifactDir, '02_saracota_ui_resultado_persistido_supabase.png');
    await page.screenshot({ path: screenshot2Path, fullPage: true });
    console.log(`Saved screenshot 2: ${screenshot2Path}`);
  } else {
    console.warn('Button "Cotar Cicalfer" not found on page.');
  }

  await browser.close();
}

captureUiFlow().catch(console.error);
