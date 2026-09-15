const { supabase } = require('../lib/db/client');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function exportSelectProof() {
  const { data: cotacoes, error: errCot } = await supabase
    .from('cotacoes')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(1);

  if (errCot || !cotacoes || cotacoes.length === 0) {
    console.error('Erro no SELECT cotacoes:', errCot);
    process.exit(1);
  }

  const cotacaoId = cotacoes[0].id;

  const { data: itens } = await supabase
    .from('cotacao_itens')
    .select('*')
    .eq('cotacao_id', cotacaoId);

  const { data: sessoes } = await supabase
    .from('cotacao_fornecedor_sessoes')
    .select('*')
    .eq('cotacao_id', cotacaoId);

  cotacoes[0].itens_cotacao_fornecedor = itens || [];
  cotacoes[0].cotacao_fornecedor_sessoes = sessoes || [];

  const historyDir = path.join(__dirname, '..', 'docs', 'historico', 'Correcao Leitura Frontend Cotacoes - 14-09_15h31');
  const outFile = path.join(historyDir, '02-teste-real-select-postgres.txt');

  const content = `===================================================================
COMPROVAÇÃO DE SELECT NO SUPABASE POSTGRESQL (SEM FALLBACK MEMÓRIA)
Data/Hora: ${new Date().toISOString()}
Tabelas Consultadas: cotacoes, cotacao_itens, cotacao_fornecedor_sessoes
ID da Cotação: ${cotacaoId}
===================================================================

REGISTRO RETORNADO DO BANCO POSTGRESQL:
${JSON.stringify(cotacoes[0], null, 2)}
`;

  fs.writeFileSync(outFile, content, 'utf-8');
  console.log(`✓ Comprovação de SELECT salva em: ${outFile}`);
}

exportSelectProof();
