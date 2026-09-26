import { chromium } from 'playwright';
import fs from 'fs';

const cofemaConfig = JSON.parse(fs.readFileSync('core/services/supplier-quote-engine/configs/cofema.json', 'utf8'));
const { cofemaRealizarLogin } = require('../core/services/supplier-quote-engine/cofemaExtractor');
const { decryptAES256 } = require('../lib/security/vault');
const { db } = require('../lib/db/client');

async function testEvalFix() {
  console.log('🧪 Testing Evaluate Candidate Extraction for 300500...\n');

  const forn = (await db.fornecedores.list()).find((f: any) => f.slug === 'cofema' || f.nome.toLowerCase().includes('cofema'));
  const user = forn.emailLogin || forn.login || forn.email;
  const pass = forn.rawSenhaCriptografada ? decryptAES256(forn.rawSenhaCriptografada) : (forn.senhaLogin || forn.senha_login);

  let browser;
  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
  } catch (e) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' }
  });

  const page = await context.newPage();
  await cofemaRealizarLogin(page, cofemaConfig, { user, pass });

  console.log('Navigating with referer to /page/busca?q=300500 ...');
  await page.goto('https://www.cofema.com.br/page/busca?q=300500', {
    referer: 'https://www.cofema.com.br/',
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(4000);

  const testEval = await page.evaluate(() => {
    const allBtns = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim());
    const addBtns = Array.from(document.querySelectorAll('button')).filter(b => (b.textContent || '').toLowerCase().includes('adicionar'));

    const cards = Array.from(document.querySelectorAll('main div, section div, div[class*="grid"] div')).filter(div => {
      const txt = (div as HTMLElement).innerText || '';
      return txt.includes('300500') || (txt.includes('R$') && txt.includes('un.'));
    });

    return {
      allBtnsCount: allBtns.length,
      addBtnsCount: addBtns.length,
      cardsFound: cards.length,
      addBtnsTexts: addBtns.map(b => b.textContent?.trim())
    };
  });

  console.log('Eval Results:', JSON.stringify(testEval, null, 2));

  await browser.close();
}

testEvalFix().catch(console.error);
