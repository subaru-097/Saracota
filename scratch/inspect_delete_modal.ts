import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function inspectDeleteModal() {
  console.log('=== INSPEÇÃO DO MODAL DE EXCLUSÃO DE CARRINHO NO PORTAL COFEMA ===\n');

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

    const deleteModalBtn = page.locator('button[title*="Excluir"], button:has-text("Excluir carrinho")').first();
    if (await deleteModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Clicando em Excluir carrinho...');
      await deleteModalBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);

      // Inspecionar todos os botões visíveis no DOM após clicar no botão de exclusão
      const modalButtons = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
        return btns.map(b => ({
          text: (b.textContent || '').trim(),
          title: b.getAttribute('title'),
          class: b.className,
          visible: b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().height > 0
        }));
      });

      console.log('\n--- BOTÕES ENCONTRADOS NO DOM PÓS-CLIQUE EM EXCLUIR ---');
      console.log(JSON.stringify(modalButtons.filter(b => b.visible), null, 2));
    }

  } finally {
    await browser.close();
  }
}

inspectDeleteModal().catch(console.error);
