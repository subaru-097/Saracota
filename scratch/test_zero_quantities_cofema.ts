import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaExtrairCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testZeroQuantitiesCofema() {
  console.log('=== TESTE DE ZERAR QUALQUER ITEM RESIDUAL NO COFEMA VIA DOM ===\n');

  const cofemaFornecedorId = '752e18bd-4f41-414a-8f66-0d8f538de99e';
  const fornDbRecord = await db.fornecedores.getById(cofemaFornecedorId);
  const emailLogin = fornDbRecord?.emailLogin || '';
  const senhaLogin = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada);

  const browser = await chromium.launch({
    headless: true,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR'
  });

  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br/' };

  try {
    await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    const openModalBtn = page.locator('table tbody tr button, table tbody tr svg, table tbody tr td a').first();
    if (await openModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await openModalBtn.evaluate((el: any) => el.click()).catch(() => {});
      await page.waitForTimeout(3000);
    }

    // Executar script no navegador para remover todos os elementos de item ou zerar inputs
    const purgeRes = await page.evaluate(async () => {
      const modal = document.querySelector('[role="dialog"], .modal-content, div[class*="modal"]') || document.body;
      const removeBtns = Array.from(modal.querySelectorAll('button[title="Remover item"], button:has-text("Excluir"), button:has-text("Remover")'));
      
      let countClicked = 0;
      for (const btn of removeBtns) {
        (btn as HTMLButtonElement).click();
        countClicked++;
        await new Promise(r => setTimeout(r, 500));
      }

      // Também zerar inputs de quantidade se existirem
      const qInputs = Array.from(modal.querySelectorAll('input[type="number"], input[value]'));
      for (const inp of qInputs) {
        const input = inp as HTMLInputElement;
        input.value = '0';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
      }

      return { countClicked, qInputsFound: qInputs.length };
    });

    console.log(`Resultado purge no navegador: ${JSON.stringify(purgeRes)}`);
    await page.waitForTimeout(3000);

    // Abrir carrinho no header ou recarregar para verificar
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const extracted = await cofemaExtrairCarrinho(page);
    console.log('\n=== EXTRAÇÃO PÓS-ZERO QUANTITIES ===');
    console.log(JSON.stringify(extracted, null, 2));

  } finally {
    await browser.close();
  }
}

testZeroQuantitiesCofema().catch(console.error);
