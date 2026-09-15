import 'dotenv/config';
import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';
import fs from 'fs';
import path from 'path';

(async () => {
  console.log('=== INSPEÇÃO MANUAL 3 ITENS CICALFER ===');

  const forn = await db.fornecedores.getById('33e03495-100d-45a3-9e34-899de56b0ab1');
  if (!forn) throw new Error('Fornecedor Cicalfer não encontrado no DB');
  const user = forn.emailLogin || forn.email || '';
  const pass = decryptAES256(forn.rawSenhaCriptografada || '');

  console.log(`Credenciais recuperadas do DB: User=${user}, PassLength=${pass.length}`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const cicalferConfig = require('../config/suppliers/cicalfer.json');
  const quoteEngine = require('../core/services/supplier-quote-engine');

  console.log('1. Efetuando Login...');
  await quoteEngine.realizarLogin(page, cicalferConfig, { user, pass });

  const termos = [
    { termo: 'CABO FLEX 100M COBRECOM 2,50MM AM', quantidade: 5 },
    { termo: 'BROXA ROMA RETANGULAR 15,5 X 5,5CM', quantidade: 12 },
    { termo: 'ALICATE BICO CHATO MTX 6', quantidade: 12 }
  ];

  let itemIdx = 1;
  for (const item of termos) {
    console.log(`\n--- Buscando Item #${itemIdx}: "${item.termo}" (Qtd: ${item.quantidade}) ---`);
    const searchInput = page.locator(cicalferConfig.selectors.search_input).first();
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput.fill('');
    await searchInput.fill(item.termo);
    await page.locator(cicalferConfig.selectors.search_button).first().click({ force: true });
    
    await page.waitForTimeout(4000);

    const screenshotPath = path.join(process.cwd(), 'docs', 'historico', 'prints', `2026-09-10_cicalfer_3itens_02_busca_item${itemIdx}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Saved screenshot: ${screenshotPath}`);

    // Inspecionar o que tem na tela: inputs, botões, títulos, cards
    const inputsInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const buttons = Array.from(document.querySelectorAll('button'));
      const cards = Array.from(document.querySelectorAll('div[class*="card"], div[class*="product"], div[class*="Produto"]'));
      
      return {
        inputsCount: inputs.length,
        inputs: inputs.map(i => ({ className: i.className, type: i.type, value: i.value, name: i.name, placeholder: i.placeholder, id: i.id })),
        buttons: buttons.slice(0, 10).map(b => ({ text: b.innerText.trim(), className: b.className })),
        cardsCount: cards.length,
        bodyTextSnippet: document.body.innerText.substring(0, 500).replace(/\n+/g, ' ')
      };
    });

    console.log(`Resultados encontrados para "${item.termo}":`);
    console.log(`- Card Count: ${inputsInfo.cardsCount}`);
    console.log(`- Body Text Snippet: ${inputsInfo.bodyTextSnippet}`);
    console.log(`- Inputs na página:`, inputsInfo.inputs);
    
    itemIdx++;
  }

  await browser.close();
})();
