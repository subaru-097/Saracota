import 'dotenv/config';
import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';
import fs from 'fs';
import path from 'path';

(async () => {
  console.log('=== INSPEÇÃO DOM CARRINHO CICALFER ===');

  const forn = await db.fornecedores.getById('33e03495-100d-45a3-9e34-899de56b0ab1');
  if (!forn) throw new Error('Fornecedor Cicalfer não encontrado no DB');
  const user = forn.emailLogin || forn.email || '';
  const pass = decryptAES256(forn.rawSenhaCriptografada || '');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const cicalferConfig = require('../config/suppliers/cicalfer.json');
  const quoteEngine = require('../core/services/supplier-quote-engine');

  await quoteEngine.realizarLogin(page, cicalferConfig, { user, pass });

  await page.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const htmlDump = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('div[class*="ProdutoCompactCarrinho"], div[class*="itemContainer"], div[class*="Produto"]'));
    return containers.map((c, i) => ({
      index: i,
      className: c.className,
      innerText: (c as HTMLElement).innerText ? (c as HTMLElement).innerText.replace(/\n+/g, ' | ') : '',
      innerHTML: c.innerHTML
    }));
  });

  console.log(`Containers encontrados no carrinho: ${htmlDump.length}`);
  htmlDump.forEach(item => {
    console.log(`\n--- Container #${item.index} (Class: "${item.className}") ---`);
    console.log(`Text: ${item.innerText}`);
    console.log(`HTML: ${item.innerHTML.substring(0, 300)}...`);
  });

  await browser.close();
})();
