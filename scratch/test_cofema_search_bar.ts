import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testSearchInput() {
  console.log('=== TESTANDO BUSCA VIA INPUT DO HEADER NO COFEMA ===');
  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const user = fornDbRecord?.emailLogin || fornDbRecord?.login_salvo || '43.313.798/0001-34';
  const pass = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br/' };

  try {
    await cofemaRealizarLogin(page, config, { user, pass });
    console.log('Login OK. URL atual:', page.url());

    // Procurar input de busca
    const searchInput = page.locator('input[placeholder*="buscar" i], input[placeholder*="pesquisar" i], input[type="search"], .search-input, input[name="q"]').first();
    const isVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Input de busca visível?', isVisible);

    if (isVisible) {
      await searchInput.click();
      await searchInput.fill('');
      await searchInput.type('296511', { delay: 50 });
      await page.waitForTimeout(500);
      await searchInput.press('Enter');
      await page.waitForTimeout(4000);

      console.log('URL após busca:', page.url());
      const pageTitle = await page.title();
      console.log('Page Title:', pageTitle);

      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1500));
      console.log('Body snippet after search:\n', bodyText);
    } else {
      console.log('Procurando todos os inputs na página:');
      const inputs = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => ({ placeholder: i.placeholder, type: i.type, name: i.name, class: i.className })));
      console.log(inputs);
    }

  } catch (e: any) {
    console.error('Erro no teste de busca:', e);
  } finally {
    await browser.close();
  }
}

testSearchInput();
