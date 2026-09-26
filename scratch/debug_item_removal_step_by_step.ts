import { chromium } from 'playwright';
import * as path from 'path';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function debugItemRemovalStepByStep() {
  console.log('=== DEBUG PASSO A PASSO DA REMOÇÃO DE ITEM NO CARRINHO COFEMA ===\n');

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
  const debugDir = path.join(process.cwd(), 'scratch', 'debug_cofema');
  require('fs').mkdirSync(debugDir, { recursive: true });

  try {
    await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    // 1. Abrir carrinho no header
    const cartTrigger = page.locator('header button:has(svg), header a:has(svg)').filter({
      has: page.locator('svg')
    }).first();

    if (await cartTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cartTrigger.click({ force: true });
      await page.waitForTimeout(2500);
    }

    await page.screenshot({ path: path.join(debugDir, '01_drawer_aberto.png') });
    console.log('📸 Print 01_drawer_aberto.png salvo.');

    // 2. Inspecionar o primeiro botão de lixeira/remover dentro da gaveta
    const removeBtnInfo = await page.evaluate(() => {
      const drawer = document.querySelector('[role="dialog"], [class*="drawer"], [class*="sheet"], [class*="offcanvas"], div[class*="cart"]') || document.body;
      const btns = Array.from(drawer.querySelectorAll('button, svg, a'));
      const target = btns.find(b => {
        const title = (b.getAttribute('title') || '').toLowerCase();
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        const txt = (b.textContent || '').toLowerCase();
        return title.includes('remover') || title.includes('excluir') || aria.includes('remover') || txt.includes('remover');
      });

      return target ? {
        tagName: target.tagName,
        title: target.getAttribute('title'),
        ariaLabel: target.getAttribute('aria-label'),
        text: target.textContent,
        outerHTML: target.outerHTML
      } : null;
    });

    console.log('\n--- INFORMAÇÕES DO BOTÃO REMOVER DENTRO DA GAVETA ---');
    console.log(JSON.stringify(removeBtnInfo, null, 2));

    // Clicar no botão remover via Playwright locator real
    const trashLoc = page.locator('button[title*="Remover"], button[aria-label*="Remover"], button:has-text("Remover")').first();
    if (await trashLoc.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Clicando no botão de remover item via Playwright click()...');
      await trashLoc.click({ force: true });
      await page.waitForTimeout(2000);

      await page.screenshot({ path: path.join(debugDir, '02_pos_clique_remover.png') });
      console.log('📸 Print 02_pos_clique_remover.png salvo.');

      // Inspecionar o que mudou no DOM (se apareceu modal de confirmação)
      const dialogText = await page.evaluate(() => {
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"], .modal-content, div[class*="modal"]'));
        return dialogs.map(d => d.innerText).join('\n---\n');
      });
      console.log(`\n--- TEXTO DOS DIÁLOGOS/MODAIS APÓS CLIQUE EM REMOVER ---\n${dialogText}`);
    }

  } finally {
    await browser.close();
  }
}

debugItemRemovalStepByStep().catch(console.error);
