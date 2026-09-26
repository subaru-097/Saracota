const { chromium } = require('playwright');
const quoteEngine = require('../export_construja/core/services/supplier-quote-engine');
const cicalferConfig = require('../config/suppliers/cicalfer.json');

(async () => {
  console.log('🚀 EXECUÇÃO VIA QUOTE ENGINE CENTRAL DA SARACOTA PARA EXTRAÇÃO DE PREÇOS REAIS B2B...');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 868 } });

  try {
    // 1. Login B2B
    console.log('1. Efetuando login B2B Cicalfer...');
    await quoteEngine.realizarLogin(page, cicalferConfig, {
      user: 'santanacomercial2021@gmail.com',
      pass: '871935'
    });
    console.log('✅ Login B2B realizado com sucesso!');

    // 2. Adicionar 4 itens ao carrinho
    const testItems = [
      { termo: 'ABRAC NYLON BR 3,6 X 200MM', quantidade: 5 },
      { termo: 'CABO FLEX 100M COBRECOM 2,50MM AM', quantidade: 2 },
      { termo: 'BROXA ROMA RETANGULAR', quantidade: 10 },
      { termo: 'DUCHA LORENZETTI BELLA DUCHA 127V', quantidade: 3 }
    ];

    for (let i = 0; i < testItems.length; i++) {
      const it = testItems[i];
      console.log(`\n[${i + 1}/4] Adicionando "${it.termo}" (Qtd: ${it.quantidade})...`);
      await quoteEngine.adicionarItem(page, cicalferConfig, {
        termo: it.termo,
        quantidade: it.quantidade
      });
    }

    // 3. Extrair carrinho com preços reais
    console.log('\n3. Navegando para o carrinho e extraindo tabela de preços reais B2B...');
    await page.goto(cicalferConfig.selectors.cart_url, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    const cartData = await quoteEngine.extrairCarrinho(page, cicalferConfig);
    console.log('\n=====================================================');
    console.log('📌 EXTRATO OFICIAL DO CARRINHO (PREÇOS REAIS):');
    console.log(JSON.stringify(cartData, null, 2));
    console.log('=====================================================\n');

  } catch (err) {
    console.error('❌ Erro na extração de preços:', err);
  } finally {
    await browser.close();
  }
})();
