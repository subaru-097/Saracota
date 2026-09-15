const supabase = require('../config/supabase');

async function testWideDictionary() {
  const words = [
    'id', 'cotacao_id', 'user_id', 'usuario_id', 'cliente_id', 'fornecedor_id', 'status', 'created_at', 'updated_at', 'criado_em',
    'preco_unitario', 'preco', 'preco_total', 'total_item', 'total', 'subtotal', 'valor_total', 'valor', 'valor_unitario',
    'quantidade', 'qtd', 'quant', 'unidade', 'und', 'emb', 'embalagem', 'lote',
    'nome', 'nome_produto', 'produto', 'descricao', 'material', 'item', 'titulo', 'produto_nome', 'produto_titulo',
    'codigo', 'codigo_produto', 'cod_produto', 'codigo_badge', 'cod_badge', 'badge', 'ref', 'referencia', 'sku', 'sku_produto',
    'link', 'link_produto', 'url', 'href', 'imagem', 'img', 'foto',
    'observacoes', 'categoria', 'marca', 'ncm', 'dados', 'dados_json', 'json', 'payload', 'detalhes',
    'badge_codigo', 'codigo_ref', 'embalagem_qtd', 'item_container', 'total_pedido', 'resumo'
  ];

  console.log('--- COTACAO_ITENS COLUMNS ---');
  const cotacaoItensFound = [];
  for (const w of words) {
    const res = await supabase.from('cotacao_itens').insert({ [w]: 'test' }).select();
    const isColumn = !res.error || !res.error.message.includes(`Could not find the '${w}' column`);
    if (isColumn) {
      cotacaoItensFound.push(w);
    }
  }
  console.log('cotacao_itens columns:', cotacaoItensFound);

  console.log('\n--- COTACOES COLUMNS ---');
  const cotacoesFound = [];
  for (const w of words) {
    const res = await supabase.from('cotacoes').insert({ [w]: 'test' }).select();
    const isColumn = !res.error || !res.error.message.includes(`Could not find the '${w}' column`);
    if (isColumn) {
      cotacoesFound.push(w);
    }
  }
  console.log('cotacoes columns:', cotacoesFound);
}

testWideDictionary();
