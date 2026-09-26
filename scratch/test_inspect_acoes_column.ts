import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testInspectAcoesColumn() {
  console.log('=== INSPEÇÃO DA COLUNA AÇÕES DA TABELA DE CARRINHOS /PAGE/PEDIDOS ===');

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
    console.log('1. Efetuando login...');
    await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });

    console.log('2. Navegando para /page/pedidos...');
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    const tabCarrinhos = page.locator('button:has-text("Carrinhos"), span:has-text("Carrinhos"), a:has-text("Carrinhos")').last();
    if (await tabCarrinhos.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tabCarrinhos.click();
      await page.waitForTimeout(2500);
    }

    console.log('3. Inspecionando a célula td da coluna Ações na linha de #132393...');
    const acoesCellInfo = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('tr')).find(r => r.innerText.includes('#132393'));
      if (!row) return { found: false };

      const cells = Array.from(row.querySelectorAll('td'));
      const acoesTd = cells[1] || cells[0];

      const children = Array.from(acoesTd.querySelectorAll('*')).map(c => ({
        tag: c.tagName,
        class: String(c.className || ''),
        html: c.outerHTML.substring(0, 150)
      }));

      return {
        found: true,
        rowText: row.innerText,
        acoesHtml: acoesTd.outerHTML,
        children
      };
    });

    console.log('CÉLULA AÇÕES DO PEDIDO #132393:', JSON.stringify(acoesCellInfo, null, 2));

  } finally {
    await browser.close();
  }
}

testInspectAcoesColumn().catch(console.error);
