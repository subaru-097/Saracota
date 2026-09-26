import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaExtrairCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testCofemaFullPurge() {
  console.log('=== TESTE DE PURGA TOTAL DO CARRINHO E EXIBIÇÃO DE 0 ITENS / R$ 0,00 ===\n');

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
  const printsDir = path.join(process.cwd(), 'docs', 'auditorias', 'historico', '2026-09-20_02h42', 'prints');
  fs.mkdirSync(printsDir, { recursive: true });

  try {
    await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    // 1. Abrir gaveta do carrinho no Header
    const cartTrigger = page.locator('header div:has-text("4"), header button:has(svg), header a:has(svg)').first();
    if (await cartTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cartTrigger.evaluate((el: any) => el.click());
      await page.waitForTimeout(2500);
    }

    // 2. Clicar em "Excluir carrinho permanentemente"
    const deleteCartBtn = page.locator('button[title="Excluir carrinho permanentemente"]').first();
    if (await deleteCartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteCartBtn.evaluate((b: any) => b.click());
      await page.waitForTimeout(2000);

      const confirmLoc = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), button:has-text("Excluir")').first();
      if (await confirmLoc.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmLoc.evaluate((b: any) => b.click());
        await page.waitForTimeout(3000);
      }
    }

    // 3. Purga individual de cada card de item restante na gaveta
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

    // 4. Também apagar rascunhos na página /page/pedidos se houver
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const openRowBtn = page.locator('table tbody tr button, table tbody tr td').first();
    if (await openRowBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await openRowBtn.evaluate((el: any) => el.click());
      await page.waitForTimeout(2500);

      const deleteOrderBtn = page.locator('button[title="Excluir carrinho permanentemente"]').first();
      if (await deleteOrderBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteOrderBtn.evaluate((b: any) => b.click());
        await page.waitForTimeout(2000);

        const confirmOrderBtn = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), button:has-text("Excluir")').first();
        if (await confirmOrderBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmOrderBtn.evaluate((b: any) => b.click());
          await page.waitForTimeout(3000);
        }
      }
    }

    // 5. Tirar o print 01_carrinho_real_vazio_0,00.png no portal Cofema
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.join(printsDir, '01_carrinho_real_vazio_0,00.png'), fullPage: true });
    console.log('📸 Print 1 salvo: 01_carrinho_real_vazio_0,00.png');

    const cartExtracted = await cofemaExtrairCarrinho(page);
    console.log('\n=== JSON RETORNADO POR cofemaExtrairCarrinho PÓS-LIMPEZA TOTAL ===');
    console.log(JSON.stringify(cartExtracted, null, 2));

  } finally {
    await browser.close();
  }
}

testCofemaFullPurge().catch(console.error);
