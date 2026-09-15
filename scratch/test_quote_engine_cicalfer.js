const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { decryptAES256 } = require('../lib/security/vault');
const { db } = require('../lib/db/client');
const quoteEngine = require('../core/services/supplier-quote-engine');

(async () => {
  console.log('=== TESTE PASSO A PASSO COM QUOTE ENGINE (CICALFER) ===');

  const outputDir = path.join(process.cwd(), 'historicos', '2026-09-15', 'teste15_correcao_definitiva', 'cicalfer');
  fs.mkdirSync(outputDir, { recursive: true });

  const forn = await db.fornecedores.getById('33e03495-100d-45a3-9e34-899de56b0ab1');
  const user = forn.email || 'santanacomercial2021@gmail.com';
  const pass = decryptAES256(forn.senhaCriptografada || forn.rawSenhaCriptografada);

  // Utilizar o mesmo config do cicalfer.json
  const configPath = path.join(process.cwd(), 'core', 'services', 'supplier-quote-engine', 'configs', 'cicalfer.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  console.log(`Config do Cicalfer lido de cicalfer.json: Base URL: ${config.base_url}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // STEP 1: LOGIN
  console.log('1. Executando quoteEngine.realizarLogin...');
  await quoteEngine.realizarLogin(page, config, { user, pass });
  await page.screenshot({ path: path.join(outputDir, '01_login_concluido.png') });
  console.log(`URL pós-login: ${page.url()}`);

  // STEP 2: ADICIONAR ITEM 1
  console.log('2. Executando quoteEngine.adicionarItem (Item 1: Ducha Lorenzetti)...');
  const res1 = await quoteEngine.adicionarItem(page, config, { termo: '6x DUCHA LORENZETTI BELLA DUCHA 127V', quantidade: 6, itemIndex: 1 });
  console.log('Resultado Adicionar Item 1:', JSON.stringify(res1, null, 2));
  await page.screenshot({ path: path.join(outputDir, '02_item1_adicionado.png') });

  // STEP 3: ADICIONAR ITEM 2
  console.log('3. Executando quoteEngine.adicionarItem (Item 2: Caixa D\'Água Fortlev)...');
  const res2 = await quoteEngine.adicionarItem(page, config, { termo: '3x CAIXA DA AGUA FORTLEV 310L', quantidade: 3, itemIndex: 2 });
  console.log('Resultado Adicionar Item 2:', JSON.stringify(res2, null, 2));
  await page.screenshot({ path: path.join(outputDir, '03_item2_adicionado.png') });

  // STEP 4: EXTRAIR CARRINHO
  console.log('4. Executando quoteEngine.extrairCarrinho...');
  const cartRes = await quoteEngine.extrairCarrinho(page, config);
  console.log('Resultado Extrair Carrinho:', JSON.stringify(cartRes, null, 2));
  await page.screenshot({ path: path.join(outputDir, '04_carrinho_extraido.png') });

  await browser.close();
  console.log('=== TESTE FINALIZADO ===');
})();
