import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function inspectHeaderCartDrawer() {
  console.log('=== INSPEÇÃO E HIGIENE DO CARRINHO VIA DRAWER DO HEADER NO COFEMA ===\n');

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
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    // Clicar no botão do carrinho no Header (o botão que tem o badge de 4 itens)
    const cartTrigger = page.locator('header button:has(svg), header a:has(svg), header button:has-text("4"), header div:has-text("4")').filter({
      has: page.locator('svg, span')
    }).first();

    console.log('Tentando abrir o carrinho no header...');
    if (await cartTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cartTrigger.click({ force: true });
      await page.waitForTimeout(3000);
    } else {
      // Tentar clicar em qualquer elemento no header que abra a gaveta do carrinho
      const allHeaderBtns = page.locator('header button, header a');
      const count = await allHeaderBtns.count();
      console.log(`Total de botões no header: ${count}`);
      for (let i = 0; i < count; i++) {
        const txt = await allHeaderBtns.nth(i).innerText().catch(() => '');
        if (txt.includes('4') || txt.toLowerCase().includes('carrinho')) {
          console.log(`Clicando no botão do header index ${i}: "${txt.trim()}"`);
          await allHeaderBtns.nth(i).click({ force: true }).catch(() => {});
          await page.waitForTimeout(2500);
          break;
        }
      }
    }

    // Inspecionar o DOM da gaveta do carrinho (drawer) aberta
    const drawerInfo = await page.evaluate(() => {
      const drawer = document.querySelector('[role="dialog"], [class*="drawer"], [class*="sheet"], [class*="offcanvas"], div[class*="cart"]') || document.body;
      const buttons = Array.from(drawer.querySelectorAll('button, a')).map(b => ({
        text: (b.textContent || '').trim(),
        title: b.getAttribute('title'),
        ariaLabel: b.getAttribute('aria-label'),
        class: b.className
      }));
      return {
        drawerHtmlSample: drawer.outerHTML.substring(0, 3000),
        buttons
      };
    });

    console.log('\n--- HTML DA GAVETA DO CARRINHO (DRAWER) ---');
    console.log(drawerInfo.drawerHtmlSample);

    console.log('\n--- BOTÕES DENTRO DA GAVETA DO CARRINHO ---');
    console.log(JSON.stringify(drawerInfo.buttons, null, 2));

  } finally {
    await browser.close();
  }
}

inspectHeaderCartDrawer().catch(console.error);
