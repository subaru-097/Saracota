import { chromium } from 'playwright';
import fs from 'fs';

const cofemaConfig = JSON.parse(fs.readFileSync('core/services/supplier-quote-engine/configs/cofema.json', 'utf8'));
const { cofemaRealizarLogin, cofemaAdicionarItem, cofemaExtrairCarrinho } = require('../core/services/supplier-quote-engine/cofemaExtractor');
const { decryptAES256 } = require('../lib/security/vault');
const { db } = require('../lib/db/client');

async function main() {
  console.log('================================================================================');
  console.log('🔍 E2E TEST: COTAÇÃO COFEMA PARA DUCHA LORENZETTI BELLA DUCHA 220V (SKU 300500)');
  console.log('================================================================================\n');

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
    locale: 'pt-BR'
  });

  const page = await context.newPage();

  try {
    // 1. LOGIN
    console.log('--- 1. LOGIN B2B ---');
    await cofemaRealizarLogin(page, cofemaConfig, { user, pass });

    // 2. BUSCA E ADICIONAR (SKU 300500)
    console.log('\n--- 2. ADICIONAR ITEM ---');
    const itemTest = {
      material: 'DUCHA LORENZETTI BELLA DUCHA 220V',
      sku: '300500',
      codigo_fornecedor: '300500',
      marcaRecomendada: 'Lorenzetti',
      quantidade: 5
    };

    const addRes = await cofemaAdicionarItem(page, cofemaConfig, itemTest.material, itemTest.quantidade, itemTest);
    console.log('Resultado Adicionar:', JSON.stringify(addRes, null, 2));

    // 3. EXTRAÇÃO DE CARRINHO
    console.log('\n--- 3. EXTRAIR CARRINHO ---');
    const cartRes = await cofemaExtrairCarrinho(page, cofemaConfig);
    console.log('Resultado Carrinho:', JSON.stringify(cartRes, null, 2));

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
