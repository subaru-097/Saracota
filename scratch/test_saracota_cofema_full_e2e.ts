import { db } from '../lib/db/client';
import { processarCotacaoFornecedor } from '../lib/services/automacao/matchingEngine';

async function runSaracotaCofemaE2E() {
  console.log('🚀 INICIANDO TESTE E2E DA SARACOTA PARA O FORNECEDOR COFEMA...\n');

  // 1. Obter fornecedor Cofema
  const fornecedores = await db.fornecedores.list();
  const cofema = fornecedores.find((f: any) => f.slug === 'cofema' || f.nome.toLowerCase().includes('cofema'));

  if (!cofema) {
    throw new Error('Fornecedor Cofema não foi encontrado no banco de dados!');
  }

  console.log(`📌 Fornecedor encontrado: ${cofema.nome} (${cofema.id})`);

  // 2. Criar ou reutilizar cotação de teste na Saracota
  let cotacaoId = `test-e2e-cofema-${Date.now()}`;
  const novoItem = {
    id: 'item-ducha-300500',
    material: 'DUCHA LORENZETTI BELLA DUCHA 220V',
    quantidade: 5,
    unidade: 'un',
    sku: '300500',
    codigo_fornecedor: '300500',
    marca: 'Lorenzetti'
  };

  try {
    const criada = await db.cotacoes.create({
      id: cotacaoId,
      cliente: 'Cliente Teste E2E Saracota',
      status: 'pendente',
      materiais: [novoItem],
      itens: [novoItem],
      fornecedores: [cofema.id],
      dataCriacao: new Date().toISOString()
    } as any);
    if (criada && criada.id) cotacaoId = criada.id;
  } catch (e: any) {
    console.log('Aviso ao criar cotação no DB, prosseguindo com ID:', cotacaoId);
  }

  console.log(`\n📋 Cotação ID: ${cotacaoId}`);
  console.log(`📦 Item de teste: ${novoItem.material} (SKU: ${novoItem.sku}, Qtd: ${novoItem.quantidade})`);

  // 3. Executar o robô de cotação através do matchingEngine oficial da Saracota
  const resultado = await processarCotacaoFornecedor(
    cotacaoId,
    cofema.id,
    async (msg: string) => {
      console.log(`  [PROGRESSO SARACOTA] ${msg}`);
    }
  );

  console.log('\n================================================================================');
  console.log('RESULTADO FINAL DO MOTOR DE COTAÇÃO DA SARACOTA:');
  console.log('================================================================================');
  console.log(JSON.stringify(resultado, null, 2));

  // 4. Verificar o resultado gravado no DB para o card da Cofema
  const cotacaoAtualizada = await db.cotacoes.getById(cotacaoId);
  console.log('\n================================================================================');
  console.log('DADOS SALVOS NO BANCO PARA O CARD DA COFEMA:');
  console.log('================================================================================');
  console.log(JSON.stringify(cotacaoAtualizada, null, 2));

  process.exit(0);
}

runSaracotaCofemaE2E().catch(err => {
  console.error('❌ FALHA NO TESTE E2E:', err);
  process.exit(1);
});
