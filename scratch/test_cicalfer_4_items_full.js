const { chromium } = require('playwright');
const quoteEngine = require('../core/services/supplier-quote-engine/index.js');
const cicalferConfig = require('../config/suppliers/cicalfer.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('1. Efetuando Login B2B na Cicalfer...');
  await quoteEngine.realizarLogin(page, cicalferConfig, { user: 'santanacomercial2021@gmail.com', pass: '871935' });


  const items = [
    { termo: 'CAIXA DE ÁGUA FECHADA FORTLEV 310 LITROS', quantidade: 5 },
    { termo: 'DUCHA LORENZETTI MAXI DUCHA 127V', quantidade: 5 },
    { termo: 'BIANCO 900G', quantidade: 10 },
    { termo: 'ALICATE BOMBA D\'ÁGUA MTX 10', quantidade: 5 }
  ];

  console.log('\n2. Adicionando 4 produtos ao carrinho Cicalfer...');
  for (const item of items) {
    console.log(`\n--- Processando: ${item.termo} (Qtd: ${item.quantidade}) ---`);
    const res = await quoteEngine.adicionarItem(page, cicalferConfig, item);
    console.log('Resultado Adicionar:', res);
  }

  console.log('\n3. Extraindo Carrinho Completo...');
  const cartData = await quoteEngine.extrairCarrinho(page, cicalferConfig);
  console.log('Dados do Carrinho:', JSON.stringify(cartData, null, 2));

  await browser.close();
})();
