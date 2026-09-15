const { chromium } = require('playwright');
const quoteEngine = require('../core/services/supplier-quote-engine/index.js');
const cicalferConfig = require('../config/suppliers/cicalfer.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('1. Efetuando Login B2B na Cicalfer...');
  await quoteEngine.realizarLogin(page, cicalferConfig, { user: 'santanacomercial2021@gmail.com', pass: '871935' });

  const testItems = [
    { termo: 'PARAFUSADEIRA ATOMICA QUANTICA 999V', quantidade: 1, label: '1. Inexistente' },
    { termo: 'BIANCO 900G', quantidade: 100, label: '2. Qtd Alta (100 un)' },
    { termo: 'DUCHA', quantidade: 2, label: '3. Nome Ambíguo' }
  ];

  for (const item of testItems) {
    console.log(`\n--- Testando: ${item.label} ("${item.termo}" Qtd: ${item.quantidade}) ---`);
    try {
      const res = await quoteEngine.adicionarItem(page, cicalferConfig, item);
      console.log('Resultado Adicionar:', res);
    } catch (err) {
      console.error(`❌ Erro ao adicionar item "${item.termo}":`, err.message);
    }
  }

  console.log('\nExtraindo Carrinho...');
  const cartData = await quoteEngine.extrairCarrinho(page, cicalferConfig);
  console.log('Dados do Carrinho:', JSON.stringify(cartData, null, 2));

  await browser.close();
})();
