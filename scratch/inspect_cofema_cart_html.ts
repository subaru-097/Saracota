import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function inspectCofemaCartHtml() {
  console.log('=== INSPEÇÃO DETALHADA DO DOM DA TABELA E MODAL DE CARRINHO COFEMA ===\n');

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

    // Inspecionar botões do carrinho na barra superior / header se houver
    const headerCartBtn = page.locator('header button, header a, button[aria-label="Carrinho"], div[class*="cart"]').first();
    console.log('Botões no header/carrinho:');

    // Inspecionar botões dentro do modal de pedido
    const openModalBtn = page.locator('table tbody tr button, table tbody tr svg, table tbody tr td a').first();
    if (await openModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await openModalBtn.evaluate((el: any) => el.click()).catch(() => {});
      await page.waitForTimeout(3000);
    }

    const modalHtml = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"], .modal-content, div[class*="modal"]');
      return dialog ? dialog.outerHTML : document.body.innerHTML;
    });

    console.log(`HTML DO MODAL (primeiros 3000 caracteres):\n${modalHtml.substring(0, 3000)}`);

    // Tentar selecionar a checkbox de "Selecionar todos os itens" se existir no modal
    const checkAll = page.locator('input[type="checkbox"], button[role="checkbox"]').first();
    if (await checkAll.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log('Tentando selecionar checkbox...');
      await checkAll.evaluate((c: any) => c.click()).catch(() => {});
      await page.waitForTimeout(1000);
    }

  } finally {
    await browser.close();
  }
}

inspectCofemaCartHtml().catch(console.error);
