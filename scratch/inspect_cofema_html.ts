import { chromium } from 'playwright';
import fs from 'fs';

const cofemaConfig = JSON.parse(fs.readFileSync('core/services/supplier-quote-engine/configs/cofema.json', 'utf8'));
const { cofemaRealizarLogin } = require('../core/services/supplier-quote-engine/cofemaExtractor');
const { decryptAES256 } = require('../lib/security/vault');
const { db } = require('../lib/db/client');

async function inspectHtml() {
  console.log('🔍 Inspecting Cofema Search & Cart HTML...');

  const forn = (await db.fornecedores.list()).find((f: any) => f.slug === 'cofema' || f.nome.toLowerCase().includes('cofema'));
  const user = forn.emailLogin || forn.login || forn.email;
  const pass = forn.rawSenhaCriptografada ? decryptAES256(forn.rawSenhaCriptografada) : (forn.senhaLogin || forn.senha_login);

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  } catch (e) {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const page = await context.newPage();
  await cofemaRealizarLogin(page, cofemaConfig, { user, pass });

  // 1. Search page inspection
  console.log('Navigating to search page for 300500...');
  await page.goto('https://www.cofema.com.br/page/busca?q=300500', { referer: 'https://www.cofema.com.br/', waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const searchInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent?.trim(),
      outerHTML: b.outerHTML,
      parentText: b.parentElement?.innerText
    }));
    return {
      buttons: btns,
      bodySnippet: document.body.innerText.slice(0, 2000)
    };
  });
  console.log('Search Info Buttons:', JSON.stringify(searchInfo.buttons, null, 2));

  // 2. Cart page inspection
  console.log('Navigating to cart page /page/pedidos...');
  await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const tabCarrinhos = page.locator('button:has-text("Carrinhos"), span:has-text("Carrinhos"), a:has-text("Carrinhos")').last();
  if (await tabCarrinhos.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tabCarrinhos.click();
    await page.waitForTimeout(3000);
  }

  const actionEl = page.locator('tr td:has-text("#"), tr button, tr svg, tr .fa-eye').first();
  if (await actionEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    await actionEl.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  const cartInfo = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"], .modal-content, div[class*="modal"]') || document.body;
    const cards = Array.from(modal.querySelectorAll('div, tr')).filter(el => {
      const t = el.innerText || '';
      return t.includes('300500') || (t.includes('SKU:') || t.includes('Código:'));
    });
    return cards.map(c => ({
      tagName: c.tagName,
      className: c.className,
      innerText: c.innerText
    }));
  });

  console.log('Cart Cards Dump:', JSON.stringify(cartInfo.slice(0, 5), null, 2));

  await browser.close();
}

inspectHtml().catch(console.error);
