import { testarMotorICMSST } from '../tests/tax.test';
import { testarMotorMatching } from '../tests/matching.test';

export function executarTodosOsTestes() {
  console.log('=== SARA COTA SAAS — EXECUTOR DE TESTES UNITÁRIOS ===\n');

  const testesTax = testarMotorICMSST();
  console.log('--- Suíte: Motor Tributário ICMS-ST ---');
  testesTax.forEach((t) => {
    console.log(`${t.passou ? '✅ PASSOU' : '❌ FALHOU'}: ${t.nome} -> ${t.mensagem}`);
  });

  const testesMatching = testarMotorMatching();
  console.log('\n--- Suíte: Motor de Matching Técnico & Fuzzy Search ---');
  testesMatching.forEach((t) => {
    console.log(`${t.passou ? '✅ PASSOU' : '❌ FALHOU'}: ${t.nome} -> ${t.mensagem}`);
  });

  const total = testesTax.length + testesMatching.length;
  const passaram = testesTax.filter((t) => t.passou).length + testesMatching.filter((t) => t.passou).length;

  console.log(`\n==================================================`);
  console.log(`RESULTADO FINAL: ${passaram}/${total} testes aprovados com sucesso!`);
  console.log(`==================================================`);
}

// Executar se chamado via terminal
if (require.main === module) {
  executarTodosOsTestes();
}
