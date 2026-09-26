import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testDeleteOrder() {
  console.log('=== TESTE DE EXCLUSÃO DEFINITIVA DO PEDIDO/CARRINHO #132393 NO COFEMA ===');

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
    console.log('1. Efetuando login...');
    await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });

    console.log('2. Navegando para /page/pedidos...');
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    const tabCarrinhos = page.locator('button:has-text("Carrinhos"), span:has-text("Carrinhos"), a:has-text("Carrinhos")').last();
    if (await tabCarrinhos.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tabCarrinhos.click();
      await page.waitForTimeout(2500);
    }

    console.log('3. Abrindo modal do pedido #132393...');
    const eyeOrRow = page.locator('tr td:has-text("#132393"), tr:has-text("#132393") button, tr:has-text("#132393") svg').first();
    if (await eyeOrRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await eyeOrRow.click({ force: true });
      await page.waitForTimeout(3000);
    }

    console.log('4. Clicando no botão "Excluir carrinho permanentemente" (force: true)...');
    const deleteOrderBtn = page.locator('button[title*="Excluir carrinho"], button:has-text("Excluir carrinho")').first();
    if (await deleteOrderBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteOrderBtn.click({ force: true });
      await page.waitForTimeout(2000);

      const confirmBtn = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), button:has-text("Excluir")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(3000);
      }
      console.log('Pedido #132393 excluído permanentemente via botão Excluir Carrinho!');
    }

    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const tableTextAfter = await page.evaluate(() => document.querySelector('table')?.innerText || document.body.innerText.substring(0, 1000));
    console.log('\n--- TEXTO DA TABELA APÓS EXCLUSÃO COMPLETA ---');
    console.log(tableTextAfter);

  } finally {
    await browser.close();
  }
}

testDeleteOrder().catch(console.error);
