import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testCartDeletion() {
  console.log('=== TESTE DE EXCLUSÃO DE CARRINHO/PEDIDO #132393 NO PORTAL COFEMA ===');

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

    console.log('3. Inspecionando botões/ícones da coluna Ações da tabela...');
    const actionElements = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      return rows.map((r, idx) => {
        const btns = Array.from(r.querySelectorAll('button, a, svg, i, span')).map(b => ({
          tag: b.tagName,
          text: b.innerText || b.getAttribute('title') || b.getAttribute('aria-label') || b.className || '',
          html: b.outerHTML.substring(0, 150)
        }));
        return { rowIdx: idx, text: r.innerText.substring(0, 100), buttons: btns };
      });
    });

    console.log('ELEMENTOS DE AÇÃO NA TABELA:', JSON.stringify(actionElements, null, 2));

    console.log('4. Abrindo modal do pedido #132393 para inspecionar botão de excluir do modal...');
    const eyeOrRow = page.locator('tr td:has-text("#132393"), tr:has-text("#132393") button, tr:has-text("#132393") svg').first();
    if (await eyeOrRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await eyeOrRow.click({ force: true });
      await page.waitForTimeout(3000);
    }

    const modalButtons = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"], .modal-content, div[class*="modal"]') || document.body;
      const btns = Array.from(modal.querySelectorAll('button, a')).map(b => ({
        text: b.innerText || b.getAttribute('title') || b.getAttribute('aria-label') || '',
        class: b.className,
        html: b.outerHTML.substring(0, 150)
      }));
      return btns;
    });

    console.log('BOTÕES DENTRO DO MODAL:', JSON.stringify(modalButtons, null, 2));

  } finally {
    await browser.close();
  }
}

testCartDeletion().catch(console.error);
