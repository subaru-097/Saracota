import { chromium } from 'playwright';
import * as path from 'path';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaExtrairCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testCofemaDrawerPurgeFix() {
  console.log('=== TESTE DE PURGA COMPROVADA DO CARRINHO COFEMA (JS EVALUATE FIX) ===\n');

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
  const debugDir = path.join(process.cwd(), 'scratch', 'debug_cofema');
  require('fs').mkdirSync(debugDir, { recursive: true });

  try {
    await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    // 1. Abrir gaveta do carrinho no header
    console.log('1. Clicando no botão do carrinho no Header...');
    const cartTrigger = page.locator('header div:has-text("4"), header button:has(svg), header a:has(svg)').first();
    if (await cartTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cartTrigger.evaluate((el: any) => el.click());
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: path.join(debugDir, '01_drawer_aberta.png') });

    // 2. Clicar via evaluate no botão "Excluir carrinho permanentemente"
    console.log('2. Clicando via JS evaluate em "Excluir carrinho permanentemente"...');
    const deleteCartBtn = page.locator('button[title="Excluir carrinho permanentemente"]').first();
    if (await deleteCartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteCartBtn.evaluate((b: any) => b.click());
      await page.waitForTimeout(2000);

      await page.screenshot({ path: path.join(debugDir, '02_pos_clique_excluir.png') });

      // Inspecionar se apareceu modal de confirmação
      const confirmLoc = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), button:has-text("Excluir")').first();
      if (await confirmLoc.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('3. Clicando no botão de confirmação da exclusão...');
        await confirmLoc.evaluate((b: any) => b.click());
        await page.waitForTimeout(3000);
      }
    } else {
      console.log('Botão deleteCartBtn não visível.');
    }

    // 3. Clicar individualmente via evaluate em cada item se ainda houver
    for (let loop = 0; loop < 10; loop++) {
      const removeBtn = page.locator('button[title="Remover item"]').first();
      if (await removeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        console.log(`[Loop ${loop + 1}] Removendo item individual via JS evaluate...`);
        await removeBtn.evaluate((b: any) => b.click()).catch(() => {});
        await page.waitForTimeout(1500);

        const confirmBtn = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), button:has-text("Excluir")').first();
        if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await confirmBtn.evaluate((b: any) => b.click()).catch(() => {});
          await page.waitForTimeout(1500);
        }
      } else {
        break;
      }
    }

    await page.screenshot({ path: path.join(debugDir, '03_gaveta_zerada.png'), fullPage: true });

    // 4. Recarregar e extrair carrinho via cofemaExtrairCarrinho
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const extractedFinal = await cofemaExtrairCarrinho(page);
    console.log('\n=== EXTRAÇÃO FINAL DO CARRINHO ===');
    console.log(JSON.stringify(extractedFinal, null, 2));

  } finally {
    await browser.close();
  }
}

testCofemaDrawerPurgeFix().catch(console.error);
