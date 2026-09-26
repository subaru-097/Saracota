import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testHeaderCartDeletion() {
  console.log('=== TESTE DE INSPEÇÃO E LIMPEZA DO CARRINHO NO HEADER DO PORTAL COFEMA ===');

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

    console.log('2. Procurando o ícone do carrinho no cabeçalho (Header)...');
    const headerCart = page.locator('header button, header a, header div').filter({ hasText: /4|MARIA|Carrinho/i }).first();
    if (await headerCart.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Ícone/badge do carrinho localizado no header. Clicando...');
      await headerCart.click({ force: true });
      await page.waitForTimeout(3000);
    } else {
      console.log('Tentando seletor alternativo para ícone de sacola/carrinho no header...');
      const bagBtn = page.locator('header svg, header button[aria-label*="carrinho"], header button[class*="cart"]').first();
      await bagBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(3000);
    }

    console.log('3. Inspecionando DOM da gaveta/modal do carrinho no header...');
    const drawerInfo = await page.evaluate(() => {
      const drawer = document.querySelector('aside, [role="dialog"], div[class*="sheet"], div[class*="drawer"], div[class*="modal"]') || document.body;
      const text = drawer.innerText || '';
      const items = Array.from(drawer.querySelectorAll('div, li, tr')).map(el => el.innerText.trim()).filter(t => t.length > 5 && t.includes('R$'));
      
      const buttons = Array.from(drawer.querySelectorAll('button, svg, a, i')).map(b => ({
        tag: b.tagName,
        text: (b.textContent || b.getAttribute('title') || b.getAttribute('aria-label') || b.className || '').toString(),
        html: b.outerHTML.substring(0, 150)
      }));

      return { text: text.substring(0, 1500), itemsCount: items.length, itemsSample: items.slice(0, 5), buttons: buttons.slice(0, 15) };
    });

    console.log('DOM DA GAVETA DO CARRINHO:', JSON.stringify(drawerInfo, null, 2));

    console.log('\n4. Testando remover todos os itens clicando nos botões de lixeira da gaveta...');
    for (let i = 0; i < 10; i++) {
      const trashBtn = page.locator('aside button, [role="dialog"] button, div[class*="sheet"] button, div[class*="drawer"] button')
        .filter({ has: page.locator('svg, i, path') })
        .filter({ hasNotText: /finalizar|continuar|fechar/i })
        .first();

      if (await trashBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`Clicando em lixeira ${i + 1}...`);
        await trashBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1500);

        const confirmBtn = page.locator('button:has-text("Sim"), button:has-text("Excluir"), button:has-text("Confirmar")').first();
        if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await confirmBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(1500);
        }
      } else {
        console.log('Nenhum botão de lixeira visível na gaveta.');
        break;
      }
    }

    await page.waitForTimeout(2000);
    const finalCartState = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    console.log('\n--- ESTADO DO HEADER APÓS EXCLUSÕES ---');
    console.log(finalCartState);

  } finally {
    await browser.close();
  }
}

testHeaderCartDeletion().catch(console.error);
