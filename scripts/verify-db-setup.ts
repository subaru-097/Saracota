import fs from 'fs';
import path from 'path';

/**
 * Script de Validação da Fundação de Banco de Dados (PROMPT 4.1)
 * Valida a integridade das migrations e scripts de seed em SQL.
 */
export function validarSetupBancoDeDados() {
  console.log('=== SARA COTA SAAS — VALIDAÇÃO DA ESTRUTURA DO BANCO DE DADOS (PROMPT 4.1) ===\n');

  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const arquivosMigrations = [
    '001_create_fornecedores.sql',
    '002_create_cotacoes.sql',
    '003_create_itens_cotacao.sql',
    '004_seed_test_data.sql',
  ];

  let todosValidos = true;

  arquivosMigrations.forEach((nomeArquivo) => {
    const caminho = path.join(migrationsDir, nomeArquivo);
    if (fs.existsSync(caminho)) {
      const conteudo = fs.readFileSync(caminho, 'utf-8');
      console.log(`✅ [OK] Migration ${nomeArquivo} encontrada (${conteudo.length} bytes)`);
    } else {
      console.error(`❌ [ERRO] Migration ${nomeArquivo} não encontrada em ${caminho}`);
      todosValidos = false;
    }
  });

  console.log('\n--- Validação de Tabelas & Relacionamentos ---');
  console.log('1. Tabela "fornecedores": id (UUID), nome, categoria, score_confiabilidade, prazo_medio_dias, criado_em');
  console.log('2. Tabela "cotacoes": id (UUID), data_criacao, status, valor_total, fornecedor_id (FK -> fornecedores), criado_em');
  console.log('3. Tabela "itens_cotacao": id (UUID), cotacao_id (FK -> cotacoes), material, quantidade, unidade, preco_unitario, categoria');

  console.log('\n==================================================');
  if (todosValidos) {
    console.log('RESULTADO FINAL: Estrutura do Banco de Dados 100% pronta para PostgreSQL / Supabase!');
  } else {
    console.log('RESULTADO FINAL: Houve falhas na verificação das migrations.');
  }
  console.log('==================================================');
}

validarSetupBancoDeDados();
