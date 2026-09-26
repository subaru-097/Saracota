import { chromium } from 'playwright';
import * as path from 'path';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testPurgeViaEvaluate() {
  console.log('=== TESTE DE PURGA COMPROVADA DO CARRINHO COFEMA VIA JS EVALUATE ===\n');

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

    // 1. Clicar no ícone de carrinho no header (com o badge vermelho)
    console.log('1. Clicando no ícone de carrinho no header...');
    const cartIconLoc = page.locator('header button:has(svg), header a:has(svg)').filter({
      hasText: /\d+/
    }).first();

    if (await cartIconLoc.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cartIconLoc.evaluate((el: any) => el.click()).catch(() => {});
      await page.waitForTimeout(2500);
    } else {
      await page.evaluate(() => {
        const badge = Array.from(document.querySelectorAll('*')).find(el => el.textContent === '4' && el.className.includes('bg-'));
        if (badge) {
          let btn: HTMLElement | null = badge.parentElement;
          while (btn && btn.tagName !== 'BUTTON' && btn.tagName !== 'A') {
            btn = btn.parentElement;
          }
          if (btn) btn.click();
        }
      });
      await page.waitForTimeout(2500);
    }

    await page.screenshot({ path: path.join(debugDir, '01_header_cart_opened.png') });

    // 2. Loop de purga de todos os itens dentro da gaveta aberta
    for (let loop = 0; loop < 10; loop++) {
      const countClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, svg, a'));
        const target = btns.find(b => {
          const title = (b.getAttribute('title') || '').toLowerCase();
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          const txt = (b.textContent || '').toLowerCase();
          return title.includes('remover') || title.includes('excluir') || aria.includes('remover') || txt.includes('remover item');
        });

        if (target) {
          (target as HTMLElement).click();
          return true;
        }
        return false;
      });

      console.log(`[Loop ${loop + 1}] Clique de remoção disparado: ${countClicked}`);
      if (!countClicked) break;
      await page.waitForTimeout(1500);

      // Confirmar exclusão se houver popup/modal de confirmação
      await page.evaluate(() => {
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => {
          const txt = (b.textContent || '').toLowerCase().trim();
          return txt === 'sim' || txt === 'confirmar' || txt === 'excluir' || txt === 'remover';
        });
        if (confirmBtn) (confirmBtn as HTMLElement).click();
      });
      await page.waitForTimeout(2000);
    }

    // 3. Clicar em "Excluir carrinho permanentemente" ou "Esvaziar" se existir
    await page.evaluate(() => {
      const delCartBtn = Array.from(document.querySelectorAll('button')).find(b => {
        const title = (b.getAttribute('title') || '').toLowerCase();
        const txt = (b.textContent || '').toLowerCase();
        return title.includes('excluir carrinho') || txt.includes('esvaziar') || txt.includes('excluir carrinho');
      });
      if (delCartBtn) (delCartBtn as HTMLElement).click();
    });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => {
        const txt = (b.textContent || '').toLowerCase().trim();
        return txt === 'sim' || txt === 'confirmar' || txt === 'excluir';
      });
      if (confirmBtn) (confirmBtn as HTMLElement).click();
    });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.join(debugDir, '02_carrinho_pos_purga.png'), fullPage: true });

    // 4. Recarregar e verificar o badge no Header
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const badgeTextAfter = await page.evaluate(() => {
      const badge = Array.from(document.querySelectorAll('*')).find(el => el.className && el.className.includes('bg-') && /\d+/.test(el.textContent || ''));
      return badge ? badge.textContent : '0';
    });

    console.log(`\nBadge no Header pós-purga: "${badgeTextAfter}"`);

  } finally {
    await browser.close();
  }
}

testPurgeViaEvaluate().catch(console.error);
