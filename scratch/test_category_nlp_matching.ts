import {
  detectarCategoriaProduto,
  extrairAtributosPorCategoria,
  normalizarTextoNLP
} from '../lib/services/normalizer/categorySchemaRegistry';

import {
  interpretarComandoLinguagemNatural,
  buscarCatalogosPorLinguagemNatural
} from '../lib/services/normalizer/naturalLanguageSearch';

import {
  executarMatchingEmCamadas,
  extrairAtributosEstruturados
} from '../lib/services/normalizer/canonicalIdGenerator';

function runCategoryNlpTests() {
  console.log('================================================================================');
  console.log('🧪 SUÍTE DE TESTES: SCHEMAS POR CATEGORIA, EXTRAÇÃO NLP & BUSCA EM LINGUAGEM NATURAL');
  console.log('================================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] Teste ${totalTests}: ${testName}`);
      if (detail) console.log(`   └─ ${detail}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] Teste ${totalTests}: ${testName}`);
      if (detail) console.error(`   └─ ${detail}`);
      process.exitCode = 1;
    }
  }

  // --- 1. TESTES DE RECONHECIMENTO DE CATEGORIA E ATRIBUTOS ESTRUTURADOS ---
  console.log('--- 1. Testando Schemas Declarativos e Detecção de Categoria ---');

  const catDucha = detectarCategoriaProduto('Ducha Lorenzetti Bella Ducha 220V');
  assert(catDucha.categoriaId === 'chuveiro', 'Detecção de Categoria: Chuveiro/Ducha', `Categoria: ${catDucha.nomeExibicao}`);

  const catAlicate = detectarCategoriaProduto('Alicate Universal 8 Pol Sparta 1000V');
  assert(catAlicate.categoriaId === 'alicate', 'Detecção de Categoria: Alicate', `Categoria: ${catAlicate.nomeExibicao}`);

  const catDisjuntor = detectarCategoriaProduto('Disjuntor Bipolar 20A Steck Curva C');
  assert(catDisjuntor.categoriaId === 'disjuntor', 'Detecção de Categoria: Disjuntor', `Categoria: ${catDisjuntor.nomeExibicao}`);

  const catFio = detectarCategoriaProduto('Fio Cabo Flexível 2.5mm² 100M SIL Azul');
  assert(catFio.categoriaId === 'fio_cabo', 'Detecção de Categoria: Fio/Cabo', `Categoria: ${catFio.nomeExibicao}`);


  // --- 2. TESTES DE EXTRAÇÃO DE ATRIBUTOS INDEPENDENTE DE ORDEM ---
  console.log('\n--- 2. Testando Extração de Atributos Independente da Ordem no Texto ---');

  const ext1 = extrairAtributosPorCategoria('Ducha Lorenzetti Ultra 6800W 220V Branca');
  const ext2 = extrairAtributosPorCategoria('Lorenzetti Branca 220V 6800W Ducha Ultra');

  assert(
    ext1.atributos.marca === 'LORENZETTI' &&
    ext1.atributos.voltagem === '220V' &&
    ext1.atributos.potencia === '6800W',
    'Extração de Atributos (Ordem Original)',
    `Marca: ${ext1.atributos.marca}, Voltagem: ${ext1.atributos.voltagem}, Potência: ${ext1.atributos.potencia}`
  );

  assert(
    ext2.atributos.marca === 'LORENZETTI' &&
    ext2.atributos.voltagem === '220V' &&
    ext2.atributos.potencia === '6800W',
    'Extração de Atributos (Ordem Invertida/Embaralhada)',
    `Marca: ${ext2.atributos.marca}, Voltagem: ${ext2.atributos.voltagem}, Potência: ${ext2.atributos.potencia}`
  );


  // --- 3. TESTES DE MATCHING EM CAMADAS COM INDEPENDÊNCIA DE POSIÇÃO ---
  console.log('\n--- 3. Testando Matching por Atributos Cruzados entre Descrições com Ordem Diferente ---');

  const matchOrdem = executarMatchingEmCamadas(
    'Ducha Lorenzetti Ultra 6800W 220V',
    'Lorenzetti Ultra 220V 6800W Ducha'
  );

  assert(
    matchOrdem.status === 'MATCH_EXATO' && matchOrdem.scoreConfianca >= 0.9,
    'Match Exato entre Nomenclaturas com Ordem Diferente',
    `Status: ${matchOrdem.status}, Score: ${matchOrdem.scoreConfianca}, Motivo: ${matchOrdem.motivo}`
  );


  // --- 4. TESTES DE PARSER DE BUSCA EM LINGUAGEM NATURAL ---
  console.log('\n--- 4. Testando Parser de Consulta em Linguagem Natural ---');

  const queryLn = interpretarComandoLinguagemNatural('chuveiro Lorenzetti 220');
  assert(
    queryLn.categoriaIdentificada.categoriaId === 'chuveiro' &&
    queryLn.atributosFiltro.marca === 'LORENZETTI' &&
    queryLn.atributosFiltro.voltagem === '220V',
    'Interpretação de Consulta: "chuveiro Lorenzetti 220"',
    `Resumo: ${queryLn.descricaoInterpreted}`
  );

  const mockCatalogo = [
    { sku: '300500', nome_produto: 'DUCHA LORENZETTI BELLA DUCHA 6800W 4T 220V BRANCA 7531212' },
    { sku: '300497', nome_produto: 'DUCHA LORENZETTI BELLA DUCHA 5500W 4T 127V BRANCA 7531211' },
    { sku: '112930', nome_produto: 'ALICATE UNIVERSAL 8 POLEGADAS SPARTA' }
  ];

  const resBusca = buscarCatalogosPorLinguagemNatural('chuveiro Lorenzetti 220', mockCatalogo);

  assert(
    resBusca.length > 0 && resBusca[0].produto.sku === '300500',
    'Busca no Catálogo Multi-Fornecedor via Linguagem Natural',
    `Melhor Match SKU: ${resBusca[0]?.produto.sku}, Score: ${resBusca[0]?.scoreConfianca}`
  );

  // --- 5. TRAVA DE SEGURANÇA EM VOLTAGEM E AMPERAGEM ---
  console.log('\n--- 5. Testando Travas Absolutas de Segurança ---');

  const resVoltagemDiverg = buscarCatalogosPorLinguagemNatural('chuveiro Lorenzetti 127', [mockCatalogo[0]]); // mock 0 é 220V
  assert(
    resVoltagemDiverg.length === 0 || resVoltagemDiverg[0].scoreConfianca === 0.0,
    'Trava de Segurança: Rejeição Total de Voltagem Divergente (127V vs 220V)',
    `Score: ${resVoltagemDiverg[0]?.scoreConfianca || 0.0}`
  );

  console.log('\n================================================================================');
  console.log(`RESUMO DA SUÍTE CATEGORIA & NLP: ${passedTests}/${totalTests} TESTES PASSARAM COM SUCESSO!`);
  console.log('================================================================================');

  if (passedTests === totalTests) {
    console.log('🎉 TODOS OS TESTES DE CATEGORIA E NLP FORAM CONCLUÍDOS COM 100% DE ÉXITO!');
  } else {
    console.error('❌ REGRESSÃO IDENTIFICADA NA SUÍTE DE CATEGORIA/NLP!');
    process.exit(1);
  }
}

runCategoryNlpTests();
