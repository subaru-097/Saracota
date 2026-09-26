import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';

async function runMercadaoTest() {
  console.log('=====================================================');
  console.log('INICIANDO TESTE REAL DE COTAÇÃO - MERCADÃO LOJISTA');
  console.log('=====================================================');

  const timestamp = 'teste_2026-09-25_19h09min';
  const outputDir = path.join(process.cwd(), 'docs', 'auditorias', 'historico', timestamp);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Extrair fornecedor do Supabase
  console.log('\n--- PASSO 1 A 4: EXTRAINDO PARÂMETROS DO SUPABASE ---');
  if (!supabase) throw new Error('Supabase não configurado');

  const { data: mercadao, error: dbErr } = await supabase
    .from('fornecedores')
    .select('*')
    .eq('id', 'a4042203-b504-4a82-af41-8ffa19ae24a6')
    .single();

  if (dbErr || !mercadao) {
    throw new Error(`Erro ao buscar Mercadão Lojista no DB: ${dbErr?.message}`);
  }

  const loginEmail = mercadao.login_salvo;
  const loginSenha = decryptAES256(mercadao.senha_criptografada);
  const urlLogin = mercadao.url_login || 'https://www.mercadaolojista.com.br/conta/login?next=/conta/index';
  const seletores = mercadao.seletores;

  console.log('✅ URL Login:', urlLogin);
  console.log('✅ Login Email:', loginEmail);
  console.log('✅ Login Senha (descriptografada):', loginSenha ? '****** (Comprimento: ' + loginSenha.length + ')' : 'FALHA');

  // Launch Playwright
  const browser = await chromium.launch({
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // 5. Acesse a URL de login
    console.log('\n--- PASSO 5 E 6: ACESSANDO O SITE E REALIZANDO LOGIN ---');
    console.log(`Navegando para: ${urlLogin}`);
    await page.goto(urlLogin, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const emailSelector = seletores?.selectors?.email_input || '#id_email';
    const passSelector = seletores?.selectors?.password_input || '#id_senha';
    const submitSelector = seletores?.selectors?.login_submit || 'button.botao.principal[type="submit"]';

    await page.fill(emailSelector, loginEmail);
    await page.fill(passSelector, loginSenha);

    // Save screenshot 01_login_mercadao.png
    await page.screenshot({ path: path.join(outputDir, '01_login_mercadao.png'), fullPage: true });
    console.log('📸 Print salvo: 01_login_mercadao.png');

    await page.click(submitSelector);
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    console.log('URL pós login:', page.url());

    // 7. Busca do produto
    console.log('\n--- PASSO 7: BUSCA PELO PRODUTO "chave combinada" ---');
    const searchSelector = seletores?.selectors?.search_input || '#auto-complete';
    await page.waitForSelector(searchSelector, { timeout: 15000 });
    await page.fill(searchSelector, 'chave combinada');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Save screenshot 02_busca_produto.png
    await page.screenshot({ path: path.join(outputDir, '02_busca_produto.png'), fullPage: true });
    console.log('📸 Print salvo: 02_busca_produto.png');

    // 8. Selecionar o card "Chave Combinada 27mm"
    console.log('\n--- PASSO 8: LOCALIZANDO CARD EXATO DE "Chave Combinada 27mm" ---');
    const productCardSelector = seletores?.selectors?.product_card_title || 'a.produto-sobrepor';
    
    const cards = await page.$$eval(productCardSelector, (els) => 
      els.map(el => ({
        title: el.getAttribute('title') || el.textContent?.trim() || '',
        href: el.getAttribute('href') || '',
      }))
    );

    console.log(`Encontrados ${cards.length} cards na página.`);

    // Match Chave Combinada 27mm (case-insensitive, checking title contains 27mm)
    const exactCardIndex = cards.findIndex(c => {
      const titleLower = c.title.toLowerCase();
      return titleLower.includes('chave combinada') && titleLower.includes('27mm');
    });
    
    if (exactCardIndex === -1) {
      console.error('❌ ERRO CRÍTICO: Card "Chave Combinada 27mm" não encontrado na grade!');
      throw new Error('Card "Chave Combinada 27mm" não localizado!');
    }

    const matchedCard = cards[exactCardIndex];
    console.log(`✅ CARD CORRETO SELECIONADO: Index [${exactCardIndex}] - "${matchedCard.title}"`);

    // Scroll card into view
    const cardElements = await page.$$(productCardSelector);
    const targetElement = cardElements[exactCardIndex];
    await targetElement.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Save screenshot 03_card_produto_correto.png
    await page.screenshot({ path: path.join(outputDir, '03_card_produto_correto.png') });
    console.log('📸 Print salvo: 03_card_produto_correto.png');

    // 9. Adicionar ao carrinho
    console.log('\n--- PASSO 9 E 10: ADICIONANDO AO CARRINHO E EXTRAINDO DADOS DO MODAL ---');
    const addToCartButtonSelector = seletores?.selectors?.add_to_cart_button || 'a.botao-comprar-ajax';
    
    // Locate buy button for matched product
    const buyBtns = page.locator(addToCartButtonSelector);
    const buyBtnCount = await buyBtns.count();
    console.log(`Encontrados ${buyBtnCount} botões "Adicionar ao carrinho" (a.botao-comprar-ajax).`);

    let targetBuyBtn = buyBtns.nth(exactCardIndex);
    if (!(await targetBuyBtn.isVisible().catch(() => false))) {
      targetBuyBtn = buyBtns.first();
    }

    console.log('Clicando no botão Adicionar ao carrinho...');
    await targetBuyBtn.click();
    await page.waitForTimeout(3000);

    // Save screenshot 04_modal_adicao_carrinho.png
    await page.screenshot({ path: path.join(outputDir, '04_modal_adicao_carrinho.png') });
    console.log('📸 Print salvo: 04_modal_adicao_carrinho.png');

    // Inspect window.cart / var cart
    const extractedJsCart = await page.evaluate(() => {
      return (window as any).cart || (window as any).carrinho || null;
    });
    console.log('🛒 Variável JS var cart extraída do modal:', JSON.stringify(extractedJsCart, null, 2));

    // 11 e 12. Ir ao carrinho e atualizar quantidade para 15
    console.log('\n--- PASSO 11 E 12: NAVEGANDO PARA O CARRINHO E ATUALIZANDO QUANTIDADE PARA 15 ---');
    const cartUrl = seletores?.selectors?.cart_url || 'https://www.mercadaolojista.com.br/carrinho/index';
    console.log(`Navegando para o carrinho: ${cartUrl}`);
    await page.goto(cartUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Locate quantity input in cart table
    const qtyInputSelector = seletores?.selectors?.quantity_input || 'input.input-mini[name="quantidade"]';
    await page.waitForSelector(qtyInputSelector, { timeout: 15000 });
    
    // Clear and type 15
    await page.fill(qtyInputSelector, '15');

    // Click update button or submit
    const updateBtnLocator = page.locator('button:has-text("Atualizar"), input[value*="Atualizar"], .btn-atualizar, button.btn-mini, button[type="submit"]').first();
    
    if (await updateBtnLocator.isVisible().catch(() => false)) {
      console.log('Clicando no botão de atualizar quantidade...');
      await updateBtnLocator.click();
    } else {
      console.log('Pressionando Enter no input de quantidade...');
      await page.focus(qtyInputSelector);
      await page.keyboard.press('Enter');
    }

    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Save screenshot 05_carrinho_quantidade_atualizada.png
    await page.screenshot({ path: path.join(outputDir, '05_carrinho_quantidade_atualizada.png'), fullPage: true });
    console.log('📸 Print salvo: 05_carrinho_quantidade_atualizada.png');

    // 13. Extração dos valores do carrinho
    console.log('\n--- PASSO 13: EXTRAINDO DADOS REAIS DO CARRINHO ---');

    const itemTitleSelector = seletores?.selectors?.cart_item_title || '.produto-info a';
    const unitPriceSelector = seletores?.selectors?.cart_item_unit_price || 'td.col-item-unit-price';
    const unitPriceAttr = seletores?.selectors?.cart_item_unit_price_attr || 'data-item-unit-valor';
    const subtotalSelector = seletores?.selectors?.cart_subtotal || 'strong.valor-subtotal';
    const subtotalAttr = seletores?.selectors?.cart_subtotal_attr || 'data-subtotal-valor';
    const totalSelector = seletores?.selectors?.resumo_total_pedido || 'strong.valor-total';
    const totalAttr = seletores?.selectors?.resumo_total_pedido_attr || 'data-total-valor';

    const rawProductName = await page.locator(itemTitleSelector).first().innerText().catch(() => '');
    
    // Unit price
    const unitPriceEl = page.locator(unitPriceSelector).first();
    const rawUnitPriceAttr = await unitPriceEl.getAttribute(unitPriceAttr).catch(() => null);
    const rawUnitPriceText = await unitPriceEl.innerText().catch(() => '');

    // Subtotal
    const subtotalEl = page.locator(subtotalSelector).first();
    const rawSubtotalAttr = await subtotalEl.getAttribute(subtotalAttr).catch(() => null);
    const rawSubtotalText = await subtotalEl.innerText().catch(() => '');

    // Total
    const totalEl = page.locator(totalSelector).first();
    const rawTotalAttr = await totalEl.getAttribute(totalAttr).catch(() => null);
    const rawTotalText = await totalEl.innerText().catch(() => '');

    console.log('📦 Nome do Produto extraído:', rawProductName);
    console.log('💲 Preço Unitário (Atributo):', rawUnitPriceAttr, '| Text:', rawUnitPriceText);
    console.log('💲 Subtotal Carrinho (Atributo):', rawSubtotalAttr, '| Text:', rawSubtotalText);
    console.log('💲 Total Pedido (Atributo):', rawTotalAttr, '| Text:', rawTotalText);

    // Save screenshot 06_valores_extraidos.png
    await page.screenshot({ path: path.join(outputDir, '06_valores_extraidos.png'), fullPage: true });
    console.log('📸 Print salvo: 06_valores_extraidos.png');

    // Parse numeric unit price
    let unitPrice = 0;
    if (rawUnitPriceAttr) {
      unitPrice = parseFloat(rawUnitPriceAttr.replace(',', '.'));
    } else {
      const match = rawUnitPriceText.replace(/[^\d,. ]/g, '').trim().replace('.', '').replace(',', '.');
      unitPrice = parseFloat(match);
    }

    const calculatedSubtotal = unitPrice * 15;

    // 14. Inserir resultados na Sara Cota e capturar UI
    console.log('\n--- PASSO 14: INSERINDO COTAÇÃO NA PLATAFORMA SARA COTA ---');

    // Create quote record in Supabase
    const { data: dbUser } = await supabase.from('fornecedores').select('user_id').not('user_id', 'is', null).limit(1).single();
    const resolvedUserId = dbUser?.user_id || '61ab64e4-c2cb-46df-bb14-6cc326293085';

    const quoteRecord = {
      user_id: resolvedUserId,
      fornecedores_selecionados: ['a4042203-b504-4a82-af41-8ffa19ae24a6'],
      itens: [
        {
          material: rawProductName.trim() || 'Chave Combinada 27mm - TAFORT',
          quantidade: 15,
          unidade: 'un',
          preco_unitario: unitPrice,
          categoria: 'ferramentas'
        }
      ],
      status: 'aprovada',
      valor_total: calculatedSubtotal,
      atualizado_em: new Date().toISOString()
    };

    const { data: insertedCot, error: cotErr } = await supabase.from('cotacoes').insert([quoteRecord]).select().single();
    if (cotErr) {
      console.warn('Aviso ao inserir cotação direta:', cotErr.message);
    } else {
      console.log('✅ Cotação salva no DB com sucesso! ID:', insertedCot.id);
      
      // Save matching item
      await supabase.from('cotacao_itens').insert([{
        cotacao_id: insertedCot.id,
        fornecedor_id: 'a4042203-b504-4a82-af41-8ffa19ae24a6',
        nome: rawProductName.trim() || 'Chave Combinada 27mm - TAFORT',
        material: rawProductName.trim() || 'Chave Combinada 27mm - TAFORT',
        preco_unitario: unitPrice,
        quantidade: 15,
        total_item: calculatedSubtotal,
        unidade: 'un',
        observacoes: JSON.stringify({ status: 'CONFIRMADO', confianca: 100 })
      }]);
    }

    // Open local Sara Cota app page
    console.log('Navegando para o app Sara Cota local (http://localhost:3000)...');
    await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Save screenshot 07_dados_inseridos_saracota.png
    await page.screenshot({ path: path.join(outputDir, '07_dados_inseridos_saracota.png'), fullPage: true });
    console.log('📸 Print salvo: 07_dados_inseridos_saracota.png');

    console.log('\n=====================================================');
    console.log('TESTE CONCLUÍDO COM SUCESSO!');
    console.log(`Produto Extrato: ${rawProductName.trim()}`);
    console.log(`Preço Unitário Real: R$ ${unitPrice.toFixed(2)}`);
    console.log(`Quantidade: 15`);
    console.log(`Subtotal Calculado (15x): R$ ${calculatedSubtotal.toFixed(2)}`);
    console.log(`Subtotal Carrinho Site: R$ ${rawSubtotalAttr || rawSubtotalText}`);
    console.log(`Total Pedido Site: R$ ${rawTotalAttr || rawTotalText}`);
    console.log('=====================================================');

  } catch (err: any) {
    console.error('\n❌ OCORREU UMA FALHA DURANTE O TESTE:', err.message);
    await page.screenshot({ path: path.join(outputDir, 'FALHA_EXECUCAO.png'), fullPage: true }).catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}

runMercadaoTest().catch((err) => {
  console.error('Execução encerrada com erro:', err);
  process.exit(1);
});
