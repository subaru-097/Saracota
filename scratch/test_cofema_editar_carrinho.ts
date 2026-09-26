import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testEditarCarrinho() {
  console.log('=== TESTE DE EDIÇÃO E LIMPEZA REAL DO CARRINHO #132393 NO COFEMA ===');

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

    console.log('3. Abrindo modal do pedido #132393...');
    const eyeOrRow = page.locator('tr td:has-text("#132393"), tr:has-text("#132393") button, tr:has-text("#132393") svg').first();
    if (await eyeOrRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await eyeOrRow.click({ force: true });
      await page.waitForTimeout(3000);
    }

    console.log('4. Clicando no botão "Editar" dentro do modal...');
    const btnEditar = page.locator('button:has-text("Editar")').first();
    if (await btnEditar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btnEditar.click({ force: true });
      await page.waitForTimeout(4000);
      console.log('URL após clicar em Editar:', page.url());
    }

    const editDomText = await page.evaluate(() => document.body.innerText);
    console.log('\n--- TEXTO DO BODY NA TELA DE EDIÇÃO DO CARRINHO ---');
    console.log(editDomText.substring(0, 2000));

    console.log('\n5. Procurando botões de excluir/esvaziar/lixeira na tela de edição...');
    const editButtons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a, svg, i')).map(b => ({
        text: b.innerText || b.getAttribute('title') || b.getAttribute('aria-label') || b.className || '',
        html: b.outerHTML.substring(0, 150)
      }));
      return btns.filter(b => b.text.toLowerCase().includes('excluir') || b.text.toLowerCase().includes('esvaziar') || b.text.toLowerCase().includes('limpar') || b.text.toLowerCase().includes('remover') || b.text.toLowerCase().includes('cancelar') || b.text.toLowerCase().includes('trash'));
    });

    console.log('BOTÕES DE LIMPEZA ENCONTRADOS:', JSON.stringify(editButtons, null, 2));

  } finally {
    await browser.close();
  }
}

testEditarCarrinho().catch(console.error);
