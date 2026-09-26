import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaExtrairCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function purgeIndividualCartItems() {
  console.log('=== REMOÇÃO INDIVIDUAL DE CADA ITEM E EXCLUSÃO DO CARRINHO COFEMA ===\n');

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

    console.log('1. Navegando para /page/pedidos e abrindo modal...');
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    const openModalBtn = page.locator('table tbody tr button, table tbody tr svg, table tbody tr td a').first();
    if (await openModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await openModalBtn.evaluate((el: any) => el.click()).catch(() => {});
      await page.waitForTimeout(3000);
    }

    // 2. Loop para clicar em todos os botões "Remover item" (title="Remover item")
    for (let loop = 0; loop < 15; loop++) {
      const removeBtns = page.locator('button[title="Remover item"]');
      const count = await removeBtns.count().catch(() => 0);
      console.log(`[Loop ${loop + 1}] Itens individuais no carrinho (botões Remover item): ${count}`);

      if (count === 0) break;

      await removeBtns.first().evaluate((btn: any) => btn.click()).catch(() => {});
      await page.waitForTimeout(1500);

      // Confirmar se houver popup
      const confirmBtn = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), button:has-text("Excluir")').first();
      if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await confirmBtn.evaluate((b: any) => b.click()).catch(() => {});
        await page.waitForTimeout(1500);
      }
    }

    // 3. Clicar em "Excluir carrinho permanentemente"
    const deleteCartBtn = page.locator('button[title*="Excluir carrinho"], button:has-text("Excluir carrinho")').first();
    if (await deleteCartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Clicando em "Excluir carrinho permanentemente"...');
      await deleteCartBtn.evaluate((btn: any) => btn.click()).catch(() => {});
      await page.waitForTimeout(2000);

      const confirmBtn = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), button:has-text("Excluir")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.evaluate((b: any) => b.click()).catch(() => {});
        await page.waitForTimeout(2500);
      }
    }

    // 4. Recarregar e extrair carrinho para confirmar 0 itens
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const extractedAfter = await cofemaExtrairCarrinho(page);
    console.log('\n=== CARRINHO EXTRAÍDO PÓS-LIMPEZA TOTAL ===');
    console.log(JSON.stringify(extractedAfter, null, 2));

  } finally {
    await browser.close();
  }
}

purgeIndividualCartItems().catch(console.error);
