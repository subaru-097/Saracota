import { db } from '../lib/db/client';

async function syncConstrujaSupabase() {
  console.log('🔄 [TESTE 18] Sincronizando seletores da Construjá no Supabase...');

  const construjaId = 'a1684c4d-d896-4ba9-a591-cda455c5ffe2';
  const seletores = {
    cookie_accept: 'button:has-text("Aceitar"), button:has-text("Concordar"), button:has-text("Entendi"), #lgpd-aceitar, .lgpd-accept',
    login_trigger: '#botao-login',
    email_input: 'input[name="email"].form-control',
    password_input: 'input#senha[name="senha"]',
    login_submit: 'button#btn-entrar',
    campo_pesquisar_produto: 'input[name="search"]',
    campo_quantidade_produto: 'input.QuantidadeMaisMenos_input__grKxO',
    item_container: '.ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*="ProdutoCompactCarrinho_itemContainer"]',
    product_title: '.ProdutoCompactCarrinho_productTitle__n7FXX',
    unit_price: '.d-flex.flex-column > span.fs-14.fw-bold, span.fs-14.fw-bold',
    total_price_item: '.d-flex.flex-column:has(strong:text-is("Total")) span.fs-14.fw-bold',
    abrir_carrinho_button: '#botao-abrir-carrinho',
    cart_url: 'https://www.construja.com.br/produtos',
    rpa_ativo: true,
    config_slug: 'construja'
  };

  await db.fornecedores.update(construjaId, {
    urlPortalB2B: 'https://www.construja.com.br/produtos',
    observacoes: 'Fornecedor Construjá (construja.com.br). Login via #botao-login com suporte a cookie_accept e gaveta de carrinho.'
  });

  const { supabase } = await import('../lib/db/client');
  if (supabase) {
    const { error } = await supabase
      .from('fornecedores')
      .update({ seletores })
      .eq('id', construjaId);

    if (error) console.error('Erro ao atualizar seletores no Supabase:', error);
    else console.log('✅ Seletores da Construjá atualizados com sucesso no Supabase!');
  }
}

syncConstrujaSupabase().catch(console.error);
