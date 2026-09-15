const fs = require('fs');
const path = require('path');
const quoteEngine = require('../core/services/supplier-quote-engine');

console.log('==============================================================================');
console.log('🧪 TESTE DE VALIDAÇÃO DO MOTOR CENTRAL CONFIG-DRIVEN — SARA COTA SAAS');
console.log('==============================================================================\n');

const configsToTest = ['cicalfer', 'construja', 'construtor', 'megaleste', 'secofair'];
let passCount = 0;

for (const slug of configsToTest) {
  try {
    const configPath = path.join(__dirname, '..', 'core', 'services', 'supplier-quote-engine', 'configs', `${slug}.json`);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Arquivo de config não encontrado: ${configPath}`);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    console.log(`[TEST] 🏢 Testando Fornecedor: "${config.nome}" (slug: "${config.slug}")`);
    console.log(`  └─ ID: ${config.fornecedor_id}`);
    console.log(`  └─ Base URL: ${config.base_url}`);
    console.log(`  └─ Search Pattern: ${config.selectors.search_url_pattern}`);
    console.log(`  └─ Cart URL: ${config.selectors.cart_url}`);

    // Testar cálculo de lote
    const loteRes = quoteEngine.calcularQuantidadeProxima(7, 5);
    console.log(`  └─ Teste Regra de Lote (Pediu 7, Lote 5): Ajustou para ${loteRes.qtyAjustada} (${loteRes.logMsg})`);

    // Testar parsePrecoBR
    const priceVal = quoteEngine.parsePrecoBR('R$ 1.234,56');
    if (priceVal !== 1234.56) {
      throw new Error(`Falha no parsePrecoBR: Esperado 1234.56, obtido ${priceVal}`);
    }

    console.log(`  ✅ Config "${slug}" carregado e validado com SUCESSO!\n`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FALHA no teste do config "${slug}":`, err.message);
  }
}

console.log('==============================================================================');
console.log(`📊 RESULTADO FINAL: ${passCount}/${configsToTest.length} fornecedores validados com SUCESSO!`);
console.log('==============================================================================');
