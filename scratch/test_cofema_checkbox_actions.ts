import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testCheckboxActions() {
  console.log('=== TESTE DE EXCLUSÃO DE CARRINHO #132393 VIA CHECKBOX DA TABELA ===');

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

    console.log('3. Clicando no checkbox da linha do pedido #132393...');
    const rowCheckbox = page.locator('tr:has-text("#132393") button[role="checkbox"], tr:has-text("#132393") input[type="checkbox"]').first();
    if (await rowCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rowCheckbox.click({ force: true });
      await page.waitForTimeout(2000);
      console.log('Checkbox do pedido #132393 marcado com sucesso.');
    }

    console.log('4. Inspecionando botões de ação que surgiram na página (Toolbar/Header)...');
    const toolbarButtons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a, div[role="button"]')).map(b => ({
        text: (b.textContent || b.getAttribute('title') || b.getAttribute('aria-label') || '').trim(),
        class: String(b.className || ''),
        html: b.outerHTML.substring(0, 150)
      }));
      return btns.filter(b => b.text.length > 0);
    });

    console.log('BOTÕES DISPONÍVEIS APÓS MARCAR CHECKBOX:', JSON.stringify(toolbarButtons, null, 2));

    // Procurar por botão Excluir/Cancelar/Remover/Esvaziar
    const actionDeleteBtn = page.locator('button:has-text("Excluir"), button:has-text("Cancelar"), button:has-text("Remover"), button:has-text("Esvaziar"), button[title*="Excluir"]').first();
    if (await actionDeleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Botão de exclusão localizado! Clicando...');
      await actionDeleteBtn.click({ force: true });
      await page.waitForTimeout(2000);

      const confirmBtn = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), button:has-text("Excluir")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(3000);
      }
      console.log('Pedido #132393 excluído com sucesso!');
    }

    const tableTextAfter = await page.evaluate(() => document.querySelector('table')?.innerText || document.body.innerText.substring(0, 1000));
    console.log('\n--- TEXTO DA TABELA APÓS EXCLUSÃO ---');
    console.log(tableTextAfter);

  } finally {
    await browser.close();
  }
}

testCheckboxActions().catch(console.error);
