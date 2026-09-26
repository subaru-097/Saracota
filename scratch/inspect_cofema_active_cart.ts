import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaExtrairCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function inspectCofemaActiveCart() {
  console.log('=== VERIFICAÇÃO DO CARRINHO ATIVO EM REAL-TIME NO COFEMA ===\n');

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
    await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });

    // 1. Testar navegação direta para /page/carrinho ou abrir gaveta de carrinho
    console.log('1. Navegando para https://www.cofema.com.br/page/carrinho ...');
    const resCarrinho = await page.goto('https://www.cofema.com.br/page/carrinho', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(3000);

    console.log(`URL Atual: ${page.url()}`);
    const cartTextContent = await page.evaluate(() => document.body.innerText);
    console.log(`\n--- CONTEÚDO DE TEXTO DE /page/carrinho ---\n${cartTextContent.substring(0, 1500)}`);

    // 2. Procurar ícone/botão de carrinho no header se /page/carrinho redirecionar ou não existir
    console.log('\n2. Procurando botão de carrinho no Header...');
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    const cartIcon = page.locator('header a[href*="carrinho"], header button[aria-label*="carrinho"], header div:has-text("Carrinho")').first();
    if (await cartIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Clicando no ícone do carrinho no header...');
      await cartIcon.click({ force: true }).catch(() => {});
      await page.waitForTimeout(3000);
    }

    const cartDrawerText = await page.evaluate(() => {
      const drawer = document.querySelector('[role="dialog"], .offcanvas, div[class*="cart"]') || document.body;
      return drawer.innerText;
    });

    console.log(`\n--- CONTEÚDO DE TEXTO DA GAVETA/MODAL DO CARRINHO ---\n${cartDrawerText.substring(0, 1500)}`);

  } finally {
    await browser.close();
  }
}

inspectCofemaActiveCart().catch(console.error);
