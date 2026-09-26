import { db } from '../lib/db/client';

async function updateConstrujaSupabase() {
  const seletoresAtualizados = {
    cart_url: 'https://www.construja.com.br/produtos',
    rpa_ativo: true,
    config_slug: 'construja',
    cookie_accept: 'button:has-text("Aceitar"), button:has-text("Concordar"), button:has-text("Entendi"), #lgpd-aceitar, .lgpd-accept',
    login_trigger: '#botao-login',
    email_input: 'input[name="email"].form-control',
    password_input: 'input#senha[name="senha"]',
    login_submit: 'button#btn-entrar',
    campo_pesquisar_produto: 'input[name="search"]',
    campo_quantidade_produto: 'input.QuantidadeMaisMenos_input__grKxO',
    item_container: '.ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*="ProdutoCompactCarrinho_itemContainer"]',
    product_card_title: '.ProdutoCompactCarrinho_productTitle__n7FXX, .ProdutoCard_title__1Fm0w, a[href*="/produto/"]',
    product_title: '.ProdutoCompactCarrinho_productTitle__n7FXX',
    unit_price: '.d-flex.flex-column > span.fs-14.fw-bold, span.fs-14.fw-bold',
    total_price_item: '.d-flex.flex-column:has(strong:text-is("Total")) span.fs-14.fw-bold',
    abrir_carrinho_button: '#botao-abrir-carrinho'
  };

  const res = await db.fornecedores.update('a1684c4d-d896-4ba9-a591-cda455c5ffe2', {
    seletores: seletoresAtualizados
  });
  console.log('✅ Construjá Supabase record updated successfully:', Boolean(res));
}

updateConstrujaSupabase().catch(console.error);
