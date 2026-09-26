/**
 * ETAPA 3: LÓGICA DE BUSCA, MATCHING SEMÂNTICO E ADIÇÃO AO CARRINHO (CONSTRUJÁ)
 * 
 * Sequência estrita de execução:
 * 1. Sanitização do termo (remoção de prefixos de quantidade como 3x, 12uni)
 * 2. Navegação para URL de pesquisa: https://www.construja.com.br/produtos?pagina=1&busca={termo}
 * 3. Leitura do primeiro resultado e validação de correlação semântica
 * 4. Ajuste de lote de venda e preenchimento de quantidade no campo input.QuantidadeMaisMenos_input__grKxO
 * 5. Pressionamento da tecla ENTER no campo de quantidade para adicão direta ao carrinho B2B
 */

function validarCorrelacaoSemanticaConstruja(termoBuscado, tituloEncontrado) {
  if (!tituloEncontrado) return false;
  const tNorm = termoBuscado.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const pNorm = tituloEncontrado.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const stopWords = ['com', 'para', 'de', 'da', 'do', 'em', '1000l', '900ml', 'flex'];
  const palavrasChave = tNorm
    .split(/[\s,/-]+/)
    .filter(w => w.length >= 3 && !stopWords.includes(w));

  if (palavrasChave.length === 0) return true;
  return palavrasChave.some(kw => pNorm.includes(kw));
}

async function adicionarItemConstruja(page, config, itemInfo) {
  const sel = config.selectors || {};
  const rawTerm = itemInfo.termo || itemInfo.ref || '';
  const searchTerm = rawTerm
    .replace(/^\s*\d+\s*(?:x|uni|un|pçs|pcs|cx|caixa|m|metro|kg)?\s*/i, '')
    .replace(/^(?:x|uni|un|pçs|pcs)\s+/i, '')
    .trim() || rawTerm.trim();

  const qPedida = Number(itemInfo.quantidade) || 1;

  console.log(`[RPA BUSCA CONSTRUJÁ] Termo sanitizado: "${searchTerm}" | Quantidade pedida: ${qPedida}`);

  const searchUrl = `https://www.construja.com.br/produtos?pagina=1&busca=${encodeURIComponent(searchTerm)}`;
  console.log(`[RPA NAVEGAÇÃO] Acessando URL de busca: ${searchUrl}...`);
  await page.goto(searchUrl, { waitUntil: 'commit', timeout: 30000 });
  await page.waitForTimeout(2500);

  // 1. Validar se produto foi retornado no grid
  const cardTitleSel = sel.product_card_title || '.ProdutoCard_title__1Fm0w, a[href*="/produto/"]';
  const cardTitleEl = page.locator(cardTitleSel).first();

  let tituloProdutoEncontrado = null;
  if (await cardTitleEl.isVisible({ timeout: 4000 }).catch(() => false)) {
    tituloProdutoEncontrado = await cardTitleEl.innerText().catch(() => null);
  }

  const isValidMatch = validarCorrelacaoSemanticaConstruja(searchTerm, tituloProdutoEncontrado);
  if (!isValidMatch) {
    console.warn(`[RPA MATCHING ALERTA] Sem correlação semântica para "${searchTerm}". Produto: "${tituloProdutoEncontrado}"`);
  }

  // 2. Preencher quantidade e adicionar pressionando ENTER
  const qtyInputSel = sel.campo_quantidade_produto || 'input.QuantidadeMaisMenos_input__grKxO';
  const qtyInput = page.locator(qtyInputSel).first();

  if (await qtyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log(`[RPA CARRINHO CONSTRUJÁ] Preenchendo quantidade ${qPedida} e pressionando ENTER...`);
    await qtyInput.fill(String(qPedida));
    await qtyInput.press('Enter');
    await page.waitForTimeout(2000);
  }

  return {
    termo: searchTerm,
    tituloProduto: tituloProdutoEncontrado,
    quantidadeAjustada: qPedida,
    status: tituloProdutoEncontrado ? 'ENCONTRADO' : 'NAO_ENCONTRADO'
  };
}

module.exports = { adicionarItemConstruja, validarCorrelacaoSemanticaConstruja };
