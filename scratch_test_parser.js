const { isMultiLinePaste, parseMultiItemPaste } = require('./lib/utils/parseMultiItemPaste');

function runTestSuites() {
  console.log('====================================================');
  console.log('🧪 TESTE DE VALIDAÇÃO: PARSER INTELIGENTE MULTI-ITEM');
  console.log('====================================================\n');

  const testCases = [
    {
      name: 'Formato 1: Exemplo Principal do Prompt (Quebras de linha simples + misto de prefixo/sufixo)',
      input: `3 chuveiros Lorenzetti
5x cimento CP-II 50kg
Vergalhão 8mm - 10 unidades
2 sacos de cal
Torneira monocomando`,
      expectedCount: 5,
      expected: [
        { quantidade: 3, nome: 'Chuveiros Lorenzetti' },
        { quantidade: 5, nome: 'Cimento CP-II 50kg' },
        { quantidade: 10, nome: 'Vergalhão 8mm' },
        { quantidade: 2, nome: 'Sacos de cal' },
        { quantidade: 1, nome: 'Torneira monocomando' },
      ],
    },
    {
      name: 'Formato 2: Lista numerada em linha única com ponto e vírgula',
      input: `1. 12 latas de tinta acrílica; 2. Sifão Astra - 4 pçs; 3. 5 - caixa d'água 1000L`,
      expectedCount: 3,
      expected: [
        { quantidade: 12, nome: 'Latas de tinta acrílica' },
        { quantidade: 4, nome: 'Sifão Astra' },
        { quantidade: 5, nome: "Caixa d'água 1000L" },
      ],
    },
    {
      name: 'Formato 3: Bullets (•, -, *) com quantidades e metragens',
      input: `• 20m cabo flexível sil 2,5mm
- 8 disjuntores bipolares 20A
* Argamassa AC-III 6x`,
      expectedCount: 3,
      expected: [
        { quantidade: 20, nome: 'Cabo flexível sil 2,5mm' },
        { quantidade: 8, nome: 'Disjuntores bipolares 20A' },
        { quantidade: 6, nome: 'Argamassa AC-III' },
      ],
    },
    {
      name: 'Formato 4: Quantidades no fim com hífen e sufixo de embalagem',
      input: `Pintura acrílica fosca 18L - 2 latas
Tubo PVC 100mm 5 varas`,
      expectedCount: 2,
      expected: [
        { quantidade: 2, nome: 'Pintura acrílica fosca 18L' },
        { quantidade: 5, nome: 'Tubo PVC 100mm' },
      ],
    },
    {
      name: 'Formato 5: Item único em linha única (Deve retornar isMultiLinePaste = false)',
      input: `Torneira de Mesa Docol`,
      isSingleLineTest: true,
    },
  ];

  let totalPassed = 0;

  testCases.forEach((tc, idx) => {
    console.log(`📌 Teste ${idx + 1}: ${tc.name}`);
    const isMulti = isMultiLinePaste(tc.input);

    if (tc.isSingleLineTest) {
      if (!isMulti) {
        console.log(`  ✓ OK: Detectado como linha única (isMultiLinePaste = false)\n`);
        totalPassed++;
      } else {
        console.error(`  ✗ ERRO: Deveria ser linha única mas retornou true\n`);
      }
      return;
    }

    if (!isMulti) {
      console.error(`  ✗ ERRO: Deveria ter sido detectado como multilinha\n`);
      return;
    }

    const items = parseMultiItemPaste(tc.input);
    console.log(`  🔍 Itens detectados (${items.length}):`);
    
    let okCount = 0;
    items.forEach((it, i) => {
      const exp = tc.expected[i];
      const matchQtd = exp ? it.quantidade === exp.quantidade : false;
      const matchNome = exp ? it.nomeProduto.toLowerCase().includes(exp.nome.toLowerCase().substring(0, 5)) : false;

      if (matchQtd && matchNome) {
        console.log(`    ✓ [${i + 1}] ${it.quantidade}x "${it.nomeProduto}"`);
        okCount++;
      } else {
        console.log(`    ⚠️ [${i + 1}] ${it.quantidade}x "${it.nomeProduto}" (Esperado: ${exp?.quantidade}x "${exp?.nome}")`);
      }
    });

    if (items.length === tc.expectedCount && okCount === tc.expectedCount) {
      console.log(`  ✓ TESTE PASSOU INTEGRALMENTE!\n`);
      totalPassed++;
    } else {
      console.error(`  ❌ FALHA NO TESTE!\n`);
    }
  });

  console.log('====================================================');
  console.log(`🏆 RESULTADO FINAL: ${totalPassed}/${testCases.length} SUÍTES DE TESTE APROVADAS`);
  console.log('====================================================');
}

runTestSuites();
