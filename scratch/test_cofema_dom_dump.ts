import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function domDump() {
  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const user = fornDbRecord?.emailLogin || fornDbRecord?.login_salvo || '43.313.798/0001-34';
  const pass = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br/' };

  try {
    await cofemaRealizarLogin(page, config, { user, pass });
    console.log('Login feito. Aguardando 5 segundos...');
    await page.waitForTimeout(5000);

    console.log('URL atual:', page.url());
    await page.screenshot({ path: 'scratch/tela_pos_login.png', fullPage: true });
    console.log('Screenshot salvo em scratch/tela_pos_login.png');

    const domSummary = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('button, a, svg, input')).map(el => ({
        tag: el.tagName,
        text: (el.textContent || '').trim().substring(0, 50),
        class: el.className,
        id: el.id,
        title: el.getAttribute('title')
      })).filter(e => e.text || e.title || e.id || e.tag === 'button' || e.tag === 'svg');
      return allElements.slice(0, 40);
    });

    console.log('Primeiros elementos na página:\n', JSON.stringify(domSummary, null, 2));

  } finally {
    await browser.close();
  }
}

domDump();
