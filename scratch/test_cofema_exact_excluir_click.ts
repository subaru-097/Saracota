import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaExtrairCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testCofemaExactExcluirClick() {
  console.log('=== TESTE DE EXCLUSÃO DEFINITIVA VIA JS EVALUATE CLICK (#132393) ===\n');

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

    // 1. Clicar na primeira linha da tabela de pedidos para abrir o modal do rascunho #132393
    const rowBtn = page.locator('table tbody tr button, table tbody tr td').first();
    if (await rowBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('1. Abrindo modal do rascunho #132393 na tabela de pedidos...');
      await rowBtn.evaluate((el: any) => el.click());
      await page.waitForTimeout(3000);
    }

    // 2. Clicar via evaluate no botão Excluir do modal
    console.log('2. Clicando via JS evaluate no botão "Excluir carrinho permanentemente"...');
    const clickedExcluir = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const delBtn = btns.find(b => (b.getAttribute('title') || '').includes('Excluir carrinho') || (b.textContent || '').trim() === 'Excluir');
      if (delBtn) {
        (delBtn as HTMLElement).click();
        return true;
      }
      return false;
    });

    console.log(`Botão Excluir carrinho clicado: ${clickedExcluir}`);
    await page.waitForTimeout(2000);

    // 3. Clicar via evaluate no botão de confirmação
    console.log('3. Clicando no botão de confirmação da exclusão no popup...');
    const confirmed = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
      const confBtn = btns.find(b => {
        const txt = (b.textContent || '').trim().toLowerCase();
        return txt === 'sim' || txt === 'confirmar' || txt === 'excluir' || txt === 'sim, excluir';
      });
      if (confBtn) {
        (confBtn as HTMLElement).click();
        return (confBtn as HTMLElement).textContent;
      }
      return null;
    });

    console.log(`Confirmação clicada: "${confirmed}"`);
    await page.waitForTimeout(3500);

    // 4. Recarregar e extrair estado do carrinho
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const cartExtracted = await cofemaExtrairCarrinho(page);
    console.log('\n=== CARRINHO EXTRAÍDO PÓS-EXCLUSÃO DO RASCUNHO #132393 ===');
    console.log(JSON.stringify(cartExtracted, null, 2));

  } finally {
    await browser.close();
  }
}

testCofemaExactExcluirClick().catch(console.error);
