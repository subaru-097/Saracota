import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testDeleteItemsInsideModal() {
  console.log('=== INSPEÇÃO E EXCLUSÃO DOS ITENS DENTRO DO MODAL #132393 NO COFEMA ===');

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

    console.log('4. Inspecionando TODOS os elementos interativos dentro do modal...');
    const modalElements = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"], .modal-content, div[class*="modal"]') || document.body;
      const allEls = Array.from(modal.querySelectorAll('*'));
      
      const clickable = allEls.filter(el => {
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute('role') || '';
        const title = el.getAttribute('title') || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const cls = String(el.className || '');
        return tag === 'button' || tag === 'a' || tag === 'svg' || role === 'button' || title || ariaLabel || cls.includes('trash') || cls.includes('delete') || cls.includes('remove') || cls.includes('close');
      });

      return clickable.map(el => ({
        tag: el.tagName,
        text: (el.textContent || '').trim().substring(0, 50),
        title: el.getAttribute('title') || el.getAttribute('aria-label') || '',
        class: String(el.className || ''),
        html: el.outerHTML.substring(0, 150)
      }));
    });

    console.log('ELEMENTOS INTERATIVOS DO MODAL:', JSON.stringify(modalElements, null, 2));

  } finally {
    await browser.close();
  }
}

testDeleteItemsInsideModal().catch(console.error);
