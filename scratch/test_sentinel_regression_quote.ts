import { executarMatchingEmCamadas, extrairAtributosEstruturados } from '../lib/services/normalizer/canonicalIdGenerator';
import { cofemaRealizarLogin, cofemaAdicionarItem, cofemaExtrairCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';
import { chromium } from 'playwright';
import { db } from '../lib/db/client';

async function runSentinelRegressionTests() {
  console.log('================================================================================');
  console.log('🛡️ RUNNING SENTINEL REGRESSION SUITE FOR CANONICAL MATCHING & COFEMA QUOTE ENGINE');
  console.log('================================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] Test ${totalTests}: ${testName}`);
      if (detail) console.log(`   └─ ${detail}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] Test ${totalTests}: ${testName}`);
      if (detail) console.error(`   └─ ${detail}`);
      process.exitCode = 1;
    }
  }

  // --- UNIT TEST SUITE: CANONICAL MATCHING & VOLTAGE RIGOR ---
  console.log('\n--- 1. Testing Canonical Multi-Layer Engine Unit Logic ---');

  const prodCofema220 = '300500•DUCHA LORENZETTI BELLA DUCHA 6800W 4T 220V BRANCA 7531212';
  const skuCofema = '300500';

  // Test 1.1: Exact SKU match
  const resSku = executarMatchingEmCamadas('300500', prodCofema220, skuCofema);
  assert(resSku.status === 'MATCH_EXATO' && resSku.scoreConfianca === 1.0, 'Exact SKU Match Layer 1', `Score: ${resSku.scoreConfianca}, Camada: ${resSku.camadaUtilizada}`);

  // Test 1.2: Exact Attribute match (220V request vs 220V product)
  const res220 = executarMatchingEmCamadas('DUCHA LORENZETTI BELLA DUCHA 220V', prodCofema220, skuCofema);
  assert(res220.status === 'MATCH_EXATO' && res220.camadaUtilizada === 2, 'Structured Technical Match 220V', `Score: ${res220.scoreConfianca}, Motivo: ${res220.motivo}`);

  // Test 1.3: Voltage Rejection (127V request vs 220V product)
  const res127 = executarMatchingEmCamadas('DUCHA LORENZETTI BELLA DUCHA 127V', prodCofema220, skuCofema);
  assert(res127.status === 'AMBIGUO_REVISAO_MANUAL' && res127.scoreConfianca === 0.0, 'Strict Voltage Rejection 127V vs 220V', `Status: ${res127.status}, Score: ${res127.scoreConfianca}`);

  // Test 1.4: Power / Ampere extraction check
  const attrDucha = extrairAtributosEstruturados('DUCHA LORENZETTI BELLA DUCHA 6800W 4T 220V BRANCA');
  assert(attrDucha.marca === 'LORENZETTI' && attrDucha.voltagem === '220V' && attrDucha.potencia === '6800W', 'Technical Attribute Extraction', `Marca: ${attrDucha.marca}, Voltagem: ${attrDucha.voltagem}, Potencia: ${attrDucha.potencia}`);


  // --- LIVE B2B INTEGRATION SUITE: COFEMA RPA QUOTE ENGINE ---
  console.log('\n--- 2. Testing Live Cofema B2B RPA Extractor with Canonical Rejection ---');

  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const emailLogin = fornDbRecord?.emailLogin || process.env.COFEMA_EMAIL || '';
  const senhaLogin = fornDbRecord?.rawSenhaCriptografada ? require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada) : process.env.COFEMA_PASSWORD || '';

  if (!emailLogin || !senhaLogin) {
    console.warn('⚠️ Credentials not resolved for Cofema live test. Skipping B2B live test.');
  } else {
    const browser = await chromium.launch({
      headless: true,
      args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      locale: 'pt-BR',
      extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' }
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    const config = { url_site: 'https://www.cofema.com.br' };

    try {
      console.log('   Autenticando no portal B2B Cofema...');
      await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });
      assert(true, 'Cofema Live B2B Login Completed');

      // Live Test 2.1: 220V Valid Search & Match
      console.log('   Testando cotação de 220V (Item solicitado: DUCHA LORENZETTI BELLA DUCHA 220V)...');
      const add220Res = await cofemaAdicionarItem(page, config, { termo: 'DUCHA LORENZETTI BELLA DUCHA 220V', quantidade: 1, sku: '300500', codigo_fornecedor: '300500', itemIndex: 1 });
      assert((add220Res.status === 'ENCONTRADO' || add220Res.status === 'SUCESSO') && add220Res.sku === '300500', 'Live Cofema Item 220V Match', `Status: ${add220Res.status}, SKU: ${add220Res.sku}, Item: "${add220Res.tituloProduto}"`);

      // Live Test 2.2: 127V Search Match (Must match SKU 300497 127V, NOT 300500 220V)
      console.log('   Testando cotação de 127V (Item solicitado: DUCHA LORENZETTI BELLA DUCHA 127V)...');
      const add127Res = await cofemaAdicionarItem(page, config, { termo: 'DUCHA LORENZETTI BELLA DUCHA 127V', quantidade: 1, itemIndex: 2 });
      assert((add127Res.status === 'ENCONTRADO' || add127Res.status === 'SUCESSO') && add127Res.sku === '300497', 'Live Cofema Exact 127V Match to SKU 300497', `Status: ${add127Res.status}, SKU: ${add127Res.sku}, Item: "${add127Res.tituloProduto}"`);

      // Live Test 2.3: Cart Hygiene & Price Extraction
      console.log('   Extraindo resumo e itens do carrinho Cofema...');
      const cartRes = await cofemaExtrairCarrinho(page, config);
      assert(Array.isArray(cartRes.produtos) && cartRes.produtos.length > 0, 'Live Cofema Cart Extraction', `Total Produtos no Carrinho: ${cartRes.produtos.length}`);
      
      const item300500 = cartRes.produtos.find((p: any) => (p.codigoProduto || p.codigo || p.nomeProduto || '').includes('300500'));
      assert(Boolean(item300500 && item300500.precoUnitario > 0), 'Cofema Cart Non-Zero Price Verification', `SKU 300500 Preço: R$ ${item300500?.precoUnitario}`);

    } finally {
      await browser.close();
    }
  }

  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED CLEANLY!`);
  console.log('================================================================================');

  if (passedTests === totalTests) {
    console.log('🎉 REGRESSION SUITE COMPLETED WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    console.error('❌ REGRESSION SUITE FAILED!');
    process.exit(1);
  }
}

runSentinelRegressionTests().catch(err => {
  console.error('❌ UNHANDLED EXCEPTION IN SENTINEL REGRESSION SUITE:', err);
  process.exit(1);
});
