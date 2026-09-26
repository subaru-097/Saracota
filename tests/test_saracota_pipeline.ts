import { normalizarAtributosProduto } from '../lib/services/normalizer/attributeNormalizer';
import { normalizarPrecoPorUnidade } from '../lib/services/normalizer/unitPriceNormalizer';
import { CatalogManager } from '../catalogos/catalogManager';
import { MatchingEngine } from '../lib/services/matchingEngine';
import { RPASubstitutionEngine } from '../lib/services/rpa/substitutionEngine';

async function testPipelineSaracota() {
  console.log('=====================================================');
  console.log('🧪 TESTE AUTOMATIZADO DO PIPELINE DE COTAÇÃO SARACOTA');
  console.log('=====================================================\n');

  // 1. Teste Normalização de Atributos
  console.log('--- TESTE 1: Normalização de Atributos ---');
  const prod1 = normalizarAtributosProduto('TUBO PVC ESGOTO 100MM 6M TIGRE', 'Tubos');
  console.log('Entrada: "TUBO PVC ESGOTO 100MM 6M TIGRE"');
  console.log('Resultado:', JSON.stringify(prod1, null, 2));

  const prod2 = normalizarAtributosProduto('BROCA CHATA P/MADEIRA 1/2', 'Ferramentas');
  console.log('\nEntrada: "BROCA CHATA P/MADEIRA 1/2"');
  console.log('Resultado:', JSON.stringify(prod2, null, 2));

  // Assertiva: Atributos não presentes devem ser estritamente "indisponível"
  if (prod2.marca !== 'indisponível') {
    throw new Error('Falha no Teste 1: Atributo marca ausente não foi marcado como "indisponível"!');
  }
  console.log('✅ Teste 1 APROVADO: Atributos extraídos e campos ausentes marcados como "indisponível".\n');

  // 2. Teste Normalização de Preço por Unidade
  console.log('--- TESTE 2: Normalização de Preço por Unidade ---');
  const p1 = normalizarPrecoPorUnidade(200.0, 'ROLO 100M', 'CABO FLEXIVEL 2.5MM SIL');
  console.log('Rolo 100m a R$ 200,00 -> Preço Unitário Base:', p1.precoUnitarioBase, 'R$/' + p1.unidadeBase);

  const p2 = normalizarPrecoPorUnidade(45.9, 'BARRA 6M', 'TUBO PVC ESGOTO 100MM TIGRE');
  console.log('Barra 6m a R$ 45,90 -> Preço Unitário Base:', p2.precoUnitarioBase, 'R$/' + p2.unidadeBase);

  if (p1.precoUnitarioBase !== 2.0 || p2.precoUnitarioBase !== 7.65) {
    throw new Error('Falha no Teste 2: Erro no cálculo de conversão por unidade-base!');
  }
  console.log('✅ Teste 2 APROVADO: Preços convertidos com precisão matemática para unidade-base.\n');

  // 3. Teste Catálogo Modular e Re-scraping Incremental
  console.log('--- TESTE 3: Gerenciamento de Catálogo Modular por Fornecedor ---');
  const resScrape = CatalogManager.salvarCatalogoBruto('cofema_teste', [
    {
      sku: 'SKU-101',
      nome_original: 'DUCHA LORENZETTI MAXI DUCHA 127V',
      categoria_site: 'Chuveiros',
      preco: 84.67,
      unidade_venda: 'UNIDADE',
      url_produto: 'https://cofema.com.br/ducha-maxi',
    },
    {
      sku: 'SKU-102',
      nome_original: 'BIANCO VEDACIT 900G',
      categoria_site: 'Impermeabilizantes',
      preco: 31.35,
      unidade_venda: 'UNIDADE',
    },
  ]);
  console.log(`Catálogo salvo em: ${resScrape.path} com ${resScrape.totalSalvos} produtos.`);

  const lidos = CatalogManager.lerCatalogoBruto('cofema_teste');
  if (lidos.length !== 2) {
    throw new Error('Falha no Teste 3: Quantidade de produtos lidos difere do salvo!');
  }
  console.log('✅ Teste 3 APROVADO: Catálogo bruto salvo e lido modularmente por fornecedor.\n');

  // 4. Teste Matching em 3 Níveis
  console.log('--- TESTE 4: Motor de Matching em 3 Níveis ---');
  const matchNivel2 = await MatchingEngine.executarMatchingItem(
    'cot-test-1',
    'item-1',
    'forn-cofema',
    'DUCHA MAXI LORENZETTI 127V',
    'Chuveiros',
    lidos
  );
  console.log('Resultado Matching Nível 2:', JSON.stringify(matchNivel2, null, 2));

  if (matchNivel2.matchTipo !== 'similar' || matchNivel2.nivelUtilizado !== 2) {
    throw new Error('Falha no Teste 4: Esperado Nível 2 (similar), recebido outro tipo!');
  }

  const matchNivel3 = await MatchingEngine.executarMatchingItem(
    'cot-test-1',
    'item-2',
    'forn-cofema',
    'PRODUTO INEXISTENTE NO CATALOGO XYZ 99',
    'Geral',
    lidos
  );
  console.log('\nResultado Matching Nível 3 (Fallback):', JSON.stringify(matchNivel3, null, 2));

  if (matchNivel3.matchTipo !== 'pendente_revisao' || matchNivel3.nivelUtilizado !== 3) {
    throw new Error('Falha no Teste 4: Esperado Nível 3 (pendente_revisao), recebido outro tipo!');
  }
  console.log('✅ Teste 4 APROVADO: Matching de 3 níveis funcionou perfeitamente sem travar a cotação.\n');

  // 5. Teste RPA Substitution Engine Hook
  console.log('--- TESTE 5: Hook de Substituição Automática com Robô RPA ---');
  const resSubst = await RPASubstitutionEngine.executarSubstituicaoNoCarrinho({
    cotacaoId: 'cot-test-1',
    fornecedorId: 'forn-cofema',
    fornecedorSlug: 'cofema',
    skuRemover: 'SKU-101',
    skuAdicionar: 'SKU-102',
    quantidadeNova: 2,
  });
  console.log('Resultado Substituição RPA:', JSON.stringify(resSubst, null, 2));
  if (!resSubst.sucesso) {
    throw new Error('Falha no Teste 5: Substituição RPA falhou!');
  }
  console.log('✅ Teste 5 APROVADO: Hook de substituição do robô executado com sucesso.\n');

  console.log('=====================================================');
  console.log('🎉 TODOS OS TESTES DO PIPELINE SARACOTA PASSARAM!');
  console.log('=====================================================');
}

testPipelineSaracota().catch((err) => {
  console.error('❌ ERRO NO TESTE:', err);
  process.exit(1);
});
