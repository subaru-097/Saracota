import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function findCartButton() {
  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const user = fornDbRecord?.emailLogin || fornDbRecord?.login_salvo || '43.313.798/0001-34';
  const pass = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br/', selectors: fornDbRecord?.seletores };

  try {
    await cofemaRealizarLogin(page, config, { user, pass });
    console.log('Login OK. Procurando botões e links com SVG na página inteira...');

    const allButtons = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, a, div[role="button"]')).map((b, idx) => ({
        index: idx,
        tag: b.tagName,
        text: (b.innerText || '').trim(),
        title: b.getAttribute('title'),
        ariaLabel: b.getAttribute('aria-label'),
        class: b.className,
        hasSvg: Boolean(b.querySelector('svg')),
        svgClass: b.querySelector('svg')?.className?.toString() || ''
      })).filter(b => b.hasSvg || b.title || b.text.toLowerCase().includes('carrinho'));
      return els;
    });

    console.log('Botões com SVG ou referência a carrinho:\n', JSON.stringify(allButtons, null, 2));

  } finally {
    await browser.close();
  }
}

findCartButton();
