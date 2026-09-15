const supabase = require('../config/supabase');

async function testFullInsert() {
  console.log('--- TEST INSERT INTO COTACOES ---');
  // 1. Insert into cotacoes
  const cotacaoPayload = {
    valor_total: 1102.22,
    status: 'concluido'
  };

  const { data: cotData, error: cotErr } = await supabase
    .from('cotacoes')
    .insert([cotacaoPayload])
    .select();

  console.log('cotacoes insert:', { cotData, cotErr });

  if (cotData && cotData.length > 0) {
    const cotacaoId = cotData[0].id;
    console.log('Created cotacao_id:', cotacaoId);

    // 2. Insert into cotacao_itens
    const itemPayload = {
      cotacao_id: cotacaoId,
      preco_unitario: 100.50,
      preco: 100.50,
      status: 'concluido',
      observacoes: JSON.stringify({
        codigo_produto: '0000000210',
        codigo_badge: '#11145',
        embalagem: 'EMB:4',
        nome: 'Produto Teste',
        quantidade: 2,
        total_item: 201.00
      })
    };

    const { data: itemData, error: itemErr } = await supabase
      .from('cotacao_itens')
      .insert([itemPayload])
      .select();

    console.log('cotacao_itens insert:', { itemData, itemErr });
  }
}

testFullInsert();
