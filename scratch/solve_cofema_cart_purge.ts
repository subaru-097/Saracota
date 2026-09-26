import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function solveCofemaCartPurge() {
  console.log('=== DISPOSIÇÃO E SOLUÇÃO DEFINITIVA DA PURGA DO CARRINHO COFEMA ===\n');

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

  // Interceptar chamadas de API (fetch / XHR) para ver como o Cofema adiciona/remove/limpa carrinho
  page.on('request', req => {
    const url = req.url();
    if (url.includes('carrinho') || url.includes('pedidos') || url.includes('cart') || url.includes('api')) {
      console.log(`[NETWORK REQ] ${req.method()} -> ${url}`);
    }
  });

  try {
    console.log('1. Efetuando login...');
    await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });

    console.log('\n2. Abrindo página inicial do Cofema...');
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    // Clicar no botão do carrinho no header
    const headerCartBtn = page.locator('header button, header a').filter({ hasText: /\d+/ }).first();
    if (await headerCartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Clicando no botão do carrinho no Header...');
      await headerCartBtn.evaluate((el: any) => el.click());
      await page.waitForTimeout(3000);
    }

    // Inspecionar todos os elementos com lixeira ou remover
    const domDetails = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const trashElements = allElements.filter(el => {
        const txt = (el.textContent || '').toLowerCase();
        const title = (el.getAttribute('title') || '').toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        const html = (el.outerHTML || '').toLowerCase();
        return title.includes('remover') || aria.includes('remover') || html.includes('lucide-trash') || txt.includes('esvaziar');
      });

      return trashElements.map(el => ({
        tagName: el.tagName,
        className: el.className,
        title: el.getAttribute('title'),
        ariaLabel: el.getAttribute('aria-label'),
        text: (el.textContent || '').trim().substring(0, 100),
        outerHTML: el.outerHTML.substring(0, 300)
      }));
    });

    console.log('\n--- ELEMENTOS DE LIXEIRA/REMOÇÃO ENCONTRADOS ---');
    console.log(JSON.stringify(domDetails, null, 2));

    // Testar alteração das quantidades de cada item para 0 via inputs de quantidade ou botões de decremento (-)
    const decreaseResult = await page.evaluate(async () => {
      // Procurar botões de minus/subtrair quantidade
      const minusBtns = Array.from(document.querySelectorAll('button, div, span')).filter(el => {
        const txt = (el.textContent || '').trim();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        return txt === '-' || aria.includes('diminuir') || aria.includes('subtrair') || aria.includes('menos');
      });

      let clickedCount = 0;
      for (const btn of minusBtns) {
        for (let i = 0; i < 10; i++) {
          (btn as HTMLElement).click();
          clickedCount++;
          await new Promise(r => setTimeout(r, 200));
        }
      }
      return { clickedCount, minusBtnsFound: minusBtns.length };
    });

    console.log(`\nResultado da tentativa de decremento: ${JSON.stringify(decreaseResult)}`);
    await page.waitForTimeout(3000);

    // Inspecionar valor atual exibido no carrinho
    const totalTextAfter = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log(`\n--- TEXTO DA PÁGINA PÓS-DECREMENTO ---\n${totalTextAfter}`);

  } finally {
    await browser.close();
  }
}

solveCofemaCartPurge().catch(console.error);
