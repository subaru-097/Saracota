import { chromium } from 'playwright';
import { db } from '../lib/db/client';

async function testCloudflareStealth() {
  console.log('=== TESTANDO BROWSER STEALTH CONTRA CLOUDFLARE ===');
  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const user = fornDbRecord?.emailLogin || fornDbRecord?.login_salvo || '43.313.798/0001-34';
  const pass = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR'
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  console.log('Navegando para cofema.com.br...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(2000);

  const isBlocked1 = await page.evaluate(() => document.body.innerText.includes('Acesso bloqueado'));
  console.log('Bloqueado no acesso inicial?', isBlocked1);

  const entreBtn = page.locator('button:has-text("Entre ou Cadastre-se")').first();
  if (await entreBtn.isVisible({ timeout: 5000 })) {
    await entreBtn.click();
    await page.waitForTimeout(1000);
  }

  const areaCliente = page.getByText('Área do Cliente', { exact: true }).first();
  if (await areaCliente.isVisible({ timeout: 5000 })) {
    await areaCliente.click();
    await page.waitForTimeout(1000);
  }

  await page.locator('#codigo').fill(user);
  await page.locator('#senha').fill(pass);
  await page.waitForTimeout(500);

  await page.locator('button:has-text("Entrar")').click();
  await page.waitForTimeout(5000);

  const isBlocked2 = await page.evaluate(() => document.body.innerText.includes('Acesso bloqueado'));
  console.log('Bloqueado pós-login?', isBlocked2);
  console.log('URL pós-login:', page.url());

  if (!isBlocked2) {
    console.log('Navegando para busca de produto 296511...');
    await page.goto('https://www.cofema.com.br/page/busca?q=296511', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const isBlocked3 = await page.evaluate(() => document.body.innerText.includes('Acesso bloqueado'));
    console.log('Bloqueado na busca?', isBlocked3);

    if (!isBlocked3) {
      const cardsText = await page.evaluate(() => Array.from(document.querySelectorAll('div, article, tr')).map(el => el.innerText).filter(t => t.includes('R$') && t.includes('296511')).slice(0, 3));
      console.log('Cards na busca:\n', cardsText);
    }
  }

  await browser.close();
}

testCloudflareStealth();
