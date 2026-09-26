import { chromium } from 'playwright';
import { db } from '../lib/db/client';

async function inspectAfterLogin() {
  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const user = fornDbRecord?.emailLogin || fornDbRecord?.login_salvo || '43.313.798/0001-34';
  const pass = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navegando para cofema.com.br...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const entreBtn = page.locator('button:has-text("Entre ou Cadastre-se")').first();
  if (await entreBtn.isVisible()) {
    await entreBtn.click();
    await page.waitForTimeout(1000);
  }

  const areaCliente = page.getByText('Área do Cliente', { exact: true }).first();
  if (await areaCliente.isVisible()) {
    await areaCliente.click();
    await page.waitForTimeout(1000);
  }

  await page.locator('#codigo').fill(user);
  await page.locator('#senha').fill(pass);
  await page.locator('button:has-text("Entrar")').click();
  await page.waitForTimeout(5000);

  console.log('URL após login:', page.url());

  const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).map(el => el.innerText.trim()).filter(Boolean).slice(0, 30));
  console.log('Primeiros botões/links na tela:\n', buttons);

  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
  console.log('Body Text:\n', bodyText);

  await browser.close();
}

inspectAfterLogin();
