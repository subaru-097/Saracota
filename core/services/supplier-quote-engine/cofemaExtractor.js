/**
 * ==============================================================================
 * ⚠️ MAPEAMENTO TRAVADO — COFEMA (ATACADISTA B2B)
 * ==============================================================================
 * STATUS: LOCKED / TRAVADO E 100% FUNCIONAL
 * VALIDADO EM: 2026-09-25 (Auditoria E2E Chave Inglesa R$ 348,50)
 * 
 * ⚠️ ATENÇÃO: Este fornecedor está 100% funcional e validado em 2026-09-25. 
 * NÃO altere esta lógica sem autorização explícita do usuário. Qualquer alteração 
 * aqui pode quebrar cotações em produção.
 * 
 * REGRAS DE ISOLAMENTO:
 * 1. Mapeamento por SKU (cofemaSessionProductsMap) e sanitização de badges ('Abre'/'Fechar')
 *    são congelados e validados.
 * 2. Alterações para novos fornecedores (Megaleste, Negrão, etc.) devem ser criadas em 
 *    arquivos NOVOS e SEPARADOS.
 * ==============================================================================
 */

function calcularSimilaridade(str1, str2) {
  const s1 = (str1 || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const s2 = (str2 || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const words1 = s1.split(/\s+/).filter(w => w.length > 2);
  const words2 = s2.split(/\s+/).filter(w => w.length > 2);
  if (words1.length === 0 || words2.length === 0) return 0;
  let matches = 0;
  for (const w1 of words1) {
    if (words2.some(w2 => w2.includes(w1) || w1.includes(w2))) {
      matches++;
    }
  }
  return matches / Math.max(words1.length, words2.length);
}

function validarMarca(marcaEsperada, tituloProduto) {
  if (!marcaEsperada) return true;
  const brandNorm = marcaEsperada.toLowerCase().trim();
  const titleNorm = tituloProduto.toLowerCase().trim();
  if (brandNorm.includes('lorenzetti')) return titleNorm.includes('lorenzetti') || titleNorm.includes('lorenz');
  if (brandNorm.includes('fortlev')) return titleNorm.includes('fortlev');
  if (brandNorm.includes('mtx')) return titleNorm.includes('mtx');
  if (brandNorm.includes('otto') || brandNorm.includes('vedacit')) return titleNorm.includes('otto') || titleNorm.includes('bianco') || titleNorm.includes('vedacit');
  return titleNorm.includes(brandNorm);
}

function validarCorrelacaoSemantica(termoPedido, tituloSite) {
  const normPedido = (termoPedido || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normSite = (tituloSite || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  const isDuchaPedido = normPedido.includes('ducha') || normPedido.includes('chuveiro');
  const isDuchaSite = normSite.includes('ducha') || normSite.includes('chuveiro') || normSite.includes('resist');
  if (isDuchaPedido && !isDuchaSite) return false;

  const isBiancoPedido = normPedido.includes('bianco') || normPedido.includes('impermeabilizante');
  const isBiancoSite = normSite.includes('bianco') || normSite.includes('otto') || normSite.includes('impermeab');
  if (isBiancoPedido && !isBiancoSite) return false;

  const isAlicatePedido = normPedido.includes('alicate');
  const isAlicateSite = normSite.includes('alicate');
  if (isAlicatePedido && !isAlicateSite) return false;

  const isConduitePedido = normPedido.includes('conduite') || normPedido.includes('corrugado');
  const isConduiteSite = normSite.includes('conduite') || normSite.includes('corrugado') || normSite.includes('eletroduto');
  if (isConduitePedido && !isConduiteSite) return false;

  return true;
}

async function garantirCarrinhoFechado(page) {
  try {
    const closeBtn = page.locator('button[aria-label="Close"], button[aria-label="Fechar"], svg.lucide-x, .offcanvas-header button.btn-close').first();
    if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await closeBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  } catch (e) {}
}

/**
 * 🔒 FLUXO DE LOGIN B2B COFEMA
 */
async function cofemaRealizarLogin(page, config, credentials) {
  const sel = config.selectors || {};
  const baseUrl = config.url_site || 'https://www.cofema.com.br/';

  console.log(`[${new Date().toISOString()}] [CofemaExtractor] Executando login B2B Cofema (${credentials.user})...`);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator(sel.cookie_accept || 'button:has-text("Aceitar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cookieBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  const entreBtn = page.locator(sel.login_trigger || 'button:has-text("Entre ou Cadastre-se")').first();
  if (await entreBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await entreBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }

  const areaClienteLoc = page.getByText('Área do Cliente', { exact: true }).first();
  if (await areaClienteLoc.isVisible({ timeout: 5000 }).catch(() => false)) {
    await areaClienteLoc.click({ force: true });
    await page.waitForTimeout(2000);
  }

  const emailInput = page.locator(sel.email_input || '#codigo').first();
  const passInput = page.locator(sel.password_input || '#senha').first();

  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill('');
    await emailInput.type(credentials.user, { delay: 30 });

    await passInput.fill('');
    await passInput.type(credentials.pass, { delay: 30 });
    await page.waitForTimeout(500);

    const submitBtn = page.locator(sel.login_submit || 'button:has-text("Entrar")').first();
    await submitBtn.click({ force: true });
    await page.waitForTimeout(5000);
    console.log(`[${new Date().toISOString()}] [CofemaExtractor] Login B2B concluído com sucesso.`);
  }
}

/**
 * 🔒 FLUXO DE BUSCA E ADIÇÃO DE ITEM COFEMA
 */
async function cofemaAdicionarItem(page, config, rawTermInput, qPedida, itemOrig) {
  const rawTerm = typeof rawTermInput === 'string' ? rawTermInput : (rawTermInput?.termo || rawTermInput?.material || rawTermInput?.nome || '');
  const quantidadeDesejada = typeof rawTermInput === 'object' && rawTermInput?.quantidade ? rawTermInput.quantidade : (qPedida || 1);
  const itemObjContext = typeof rawTermInput === 'object' ? rawTermInput : itemOrig;
  const marcaEsperada = typeof itemObjContext === 'object' ? itemObjContext.marcaRecomendada : null;

  await garantirCarrinhoFechado(page);

  // Extrair código numérico se fornecido (ex: COF-300500 -> 300500)
  const skuMatchInTerm = rawTerm.match(/\b(\d{5,7})\b/);
  const origSku = typeof itemObjContext === 'object' ? (itemObjContext.skuFornecedor || itemObjContext.sku || itemObjContext.codigo_fornecedor || itemObjContext.codigoProduto || itemObjContext.codigo || '') : '';
  const skuMatchInOrig = String(origSku).match(/\b(\d{5,7})\b/);
  const targetSku = skuMatchInTerm ? skuMatchInTerm[1] : (skuMatchInOrig ? skuMatchInOrig[1] : null);

  const cleanTerm = rawTerm
    .replace(/^\s*\d+\s*(?:x|uni|un|pçs|pcs|cx|caixa|m|metro|kg)?\s*/i, '')
    .replace(/^(?:x|uni|un|pçs|pcs)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleanTerm.split(/\s+/).filter((w) => w.length >= 2);
  const shortText = words.slice(0, 3).join(' ');
  let searchTerm = targetSku ? targetSku : shortText || rawTerm.trim();

  console.log(`[CofemaExtractor] Buscando item: "${searchTerm}" (marca esperada: "${marcaEsperada || 'qualquer'}")`);
  const targetSearchUrl = `https://www.cofema.com.br/page/busca?q=${encodeURIComponent(searchTerm)}`;
  
  await page.goto(targetSearchUrl, {
    referer: 'https://www.cofema.com.br/',
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  // Aguardar renderização dinâmica dos produtos na grade
  await page.waitForTimeout(4000);

  const candidatos = await page.evaluate(() => {
    // Localizar botões de ação do produto (Adicionar ou x no carrinho)
    const actionBtns = Array.from(document.querySelectorAll('button')).filter(b => {
      const txt = (b.textContent || '').toLowerCase();
      return txt.includes('adicionar') || txt.includes('no carrinho');
    });

    const cardContainers = [];
    actionBtns.forEach(btn => {
      let container = btn.parentElement;
      while (container && container !== document.body) {
        const txt = container.innerText || '';
        if (txt.includes('R$') && (txt.includes('un.') || txt.includes('Abre') || txt.includes('•'))) {
          break;
        }
        container = container.parentElement;
      }
      if (!container) container = btn.parentElement;
      if (container && !cardContainers.includes(container)) {
        cardContainers.push(container);
      }
    });

    return cardContainers.map((container, idx) => {
      const fullText = container ? container.innerText : '';
      const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

      const skuMatch = fullText.match(/\b(\d{5,8})\b/);
      const sku = skuMatch ? skuMatch[1] : `SKU-${idx}`;

      const titleLine = lines.find(l => /\d{5,8}•/.test(l)) || lines.find(l => l.length > 8 && l !== '•' && !l.startsWith('R$') && !l.toLowerCase().includes('adicionar') && !l.toLowerCase().includes('no carrinho') && !l.includes('•')) || lines[0] || 'Produto Cofema';
      const cleanTitle = titleLine.replace(/^\d+•/, '').trim();

      // Remover menções a estoque/disponibilidade para não confundir estoque ("22 un.") com múltiplo de embalagem
      const textWithoutStock = fullText.replace(/(?:estoque|dispon[íi]vel|disp\.?)\s*:?\s*\d+\s*un\.?/gi, '');
      const multMatch = textWithoutStock.match(/(?:embalagem|cx|caixa|m[úu]ltiplo|fator|m[úu]lt)\s*:?\s*(\d+)/i) ||
                        textWithoutStock.match(/(\d+)\s*un\s*(?:fechada|caixa|emb|master)/i);
      const mult = multMatch ? parseInt(multMatch[1], 10) : 1;

      const priceMatch = fullText.match(/R\$\s*([\d\.,]+)/i);
      const priceUnit = priceMatch ? parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.')) : 0;

      const btnText = (container.querySelector('button')?.textContent || '').toLowerCase();
      const isAlreadyInCart = btnText.includes('no carrinho');

      return {
        index: idx,
        title: cleanTitle,
        sku,
        multiploVenda: mult,
        precoUnitario: priceUnit,
        isAlreadyInCart,
      };
    });
  });

  if (candidatos.length === 0) {
    return { termo: searchTerm, qPedida, status: 'FALHA', erro: 'Nenhum produto na grade', unitPriceStr: 'R$ 0,00' };
  }

  const { executarMatchingEmCamadas } = require('../../../lib/services/normalizer/canonicalIdGenerator');

  let melhorCandidato = null;
  let melhorResultadoMatching = null;

  for (const cand of candidatos) {
    const matchRes = executarMatchingEmCamadas(rawTerm, cand.title, cand.sku, itemObjContext);
    if (matchRes.status === 'MATCH_EXATO' || matchRes.status === 'MATCH_SIMILAR') {
      if (!melhorResultadoMatching || matchRes.scoreConfianca > melhorResultadoMatching.scoreConfianca) {
        melhorResultadoMatching = matchRes;
        melhorCandidato = cand;
      }
    } else {
      console.log(`[CofemaExtractor 🛑 MATCH REJEITADO] "${rawTerm}" vs "${cand.title}" -> ${matchRes.motivo}`);
    }
  }

  if (!melhorCandidato || !melhorResultadoMatching) {
    console.warn(`[CofemaExtractor ⚠️] Nenhum candidato passou no matching em camadas para "${rawTerm}". Interrompendo adição ao carrinho.`);
    return {
      termo: rawTerm,
      qPedida,
      status: 'AMBIGUO_REVISAO_MANUAL',
      erro: 'Item ambíguo ou com voltagem/atributo divergente — pendente de revisão manual',
      unitPriceStr: 'R$ 0,00'
    };
  }

  const targetQty = quantidadeDesejada || qPedida || 1;
  const mult = melhorCandidato.multiploVenda || 1;
  let qAjustada = targetQty;
  if (targetQty % mult !== 0) {
    qAjustada = Math.ceil(targetQty / mult) * mult;
  }

  if (!melhorCandidato.isAlreadyInCart) {
    // 🔒 VALIDAÇÃO OBRIGATÓRIA DE SEGURANÇA PRÉ-CLIQUE
    const searchSkuOrTitle = melhorCandidato.sku || melhorCandidato.title;
    const cardElement = page.locator('div, tr, article').filter({ hasText: searchSkuOrTitle }).first();

    const cardText = await cardElement.innerText({ timeout: 4000 }).catch(() => '');
    const isMatchValid = (cardText.includes(melhorCandidato.sku) || cardText.includes(melhorCandidato.title)) &&
                         (rawTerm.includes(melhorCandidato.sku) || executarMatchingEmCamadas(rawTerm, cardText, melhorCandidato.sku, itemObjContext).status !== 'REJEITADO');

    if (!isMatchValid || !cardText) {
      console.error(`🛑 [BLOQUEIO DE SEGURANÇA B2B] Tentativa de clique BLOQUEADA! O card no DOM ("${cardText.substring(0, 60)}") não corresponde ao item aprovado ("${melhorCandidato.title}", SKU: ${melhorCandidato.sku}). NENHUM ITEM ADICIONADO.`);
      return {
        termo: rawTerm,
        qPedida,
        status: 'BLOQUEADO_POR_SEGURANCA',
        erro: 'Card no DOM divergente do item aprovado — clique bloqueado por segurança',
        unitPriceStr: 'R$ 0,00'
      };
    }

    // Preencher quantidade no input DENTRO deste card específico
    try {
      const qtyInput = cardElement.locator('input[type="number"], input[name*="qtd"], input[class*="qty"]').first();
      if (await qtyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await qtyInput.fill(String(qAjustada));
        await page.waitForTimeout(500);
      }
    } catch (e) {}

    // Clicar no botão "Adicionar" DENTRO deste card específico (SEM NENHUM FALLBACK PARA PRIMEIRA POSIÇÃO OU BOTÃO GLOBAL)
    const addBtn = cardElement.locator('button').filter({ hasText: /adicionar|comprar|\+|carrinho/i }).first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`[CofemaExtractor ✅ ADD TO CART LOG] Adicionando ao carrinho CARD CONFIRMADO: "${melhorCandidato.title}" (SKU: ${melhorCandidato.sku}, Qtd: ${qAjustada}, Preço Unit: R$ ${melhorCandidato.precoUnitario.toFixed(2)})`);
      await addBtn.click({ force: true });
      await page.waitForTimeout(3000);
    } else {
      console.error(`❌ [ERRO B2B] Botão Adicionar não visível dentro do card de "${melhorCandidato.title}". NENHUM ITEM ADICIONADO.`);
      return {
        termo: rawTerm,
        qPedida,
        status: 'FALHA_BOTAO',
        erro: 'Botão Adicionar ausente no card do produto',
        unitPriceStr: 'R$ 0,00'
      };
    }
  } else {
    console.log(`[CofemaExtractor] Item ${melhorCandidato.sku} (${melhorCandidato.title}) já está presente no carrinho.`);
  }

  await garantirCarrinhoFechado(page);

  if (melhorCandidato && melhorCandidato.sku && melhorCandidato.title) {
    cofemaSessionProductsMap.set(String(melhorCandidato.sku), melhorCandidato.title);
  }

  const divergenciaMarca = Boolean(marcaEsperada && melhorResultadoMatching?.divergencias?.some((d) => d.includes('Marca')));

  return {
    termo: searchTerm,
    tituloProduto: melhorCandidato.title,
    sku: melhorCandidato.sku,
    qPedida,
    loteSize: mult,
    qAjustada,
    precoUnitario: melhorCandidato.precoUnitario,
    unitPriceStr: `R$ ${melhorCandidato.precoUnitario.toFixed(2)}`,
    status: divergenciaMarca ? 'MARCA_SUBSTITUIDA' : 'ENCONTRADO',
    marcaSubstituida: divergenciaMarca,
    marcaSolicitada: marcaEsperada || null,
    marcaCotada: melhorCandidato.title,
  };
}

const cofemaSessionProductsMap = new Map();

/**
 * 🔒 FLUXO DE EXTRAÇÃO DO CARRINHO COFEMA DO DOM (GAVETA DO CARRINHO ATIVO DO PORTAL)
 */
async function cofemaExtrairCarrinho(page, config) {
  console.log(`[${new Date().toISOString()}] [CofemaExtractor] Extraindo carrinho ativo da página /page/pedidos e modal Detalhes do Pedido...`);
  
  await garantirCarrinhoFechado(page);

  // 1. Navegação SPA segura para /page/pedidos
  try {
    const pedidosMenu = page.locator('a[href="/page/pedidos"], a:has-text("Pedidos")').first();
    if (await pedidosMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pedidosMenu.evaluate((el) => el.click());
      await page.waitForTimeout(3000);
    } else {
      await page.evaluate(() => {
        const link = document.querySelector('a[href*="pedidos"]');
        if (link) link.click();
      });
      await page.waitForTimeout(3000);
    }
  } catch (navErr) {}

  // 2. Clicar na aba Carrinhos
  try {
    const tabCarrinhos = page.locator('button:has-text("Carrinhos"), [role="tab"]:has-text("Carrinhos")').first();
    if (await tabCarrinhos.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tabCarrinhos.evaluate((el) => el.click());
      await page.waitForTimeout(2000);
    }
  } catch (tabErr) {}

  // 3. Abrir modal Detalhes do Pedido clicando na primeira linha da tabela
  try {
    const firstRowCell = page.locator('tbody tr td').first();
    if (await firstRowCell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRowCell.evaluate((el) => el.click());
      await page.waitForTimeout(3000);
    }
  } catch (rowErr) {}

  // 4. Parser de itens do modal Detalhes do Pedido no DOM real
  const cartData = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]') || document.body;
    const text = modal.innerText || '';

    if (text.includes('vazio') || text.includes('Nenhum item') || text.includes('0 produtos')) {
      return {
        cartUrl: window.location.href,
        containersFoundCount: 0,
        produtos: [],
        errosExtracao: [],
        resumo: {
          resumoTabelaEncontrada: true,
          totalItens: 0,
          despesaAcessoria: 0,
          totalPedido: 0.00
        }
      };
    }

    const itemBlocks = text.split(/(?=Código:\s*\d+)/gi);
    const items = [];
    const seenSkus = new Set();

    itemBlocks.forEach(block => {
      const skuMatch = block.match(/Código:\s*(\d+)/i) || block.match(/SKU:?\s*(\d+)/i);
      if (!skuMatch) return;
      const sku = skuMatch[1];
      if (seenSkus.has(sku)) return;
      seenSkus.add(sku);

      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const candidateTitles = [];
      for (const line of lines) {
        const lineClean = line
          .replace(/^(?:Código|SKU|Ref):\s*\d+\s*[-–—]?\s*/i, '')
          .replace(/^(?:Abre|Não\s*Abre|Nao\s*Abre|Fechar|Detalhes|Voltar|Carrinhos|Carrinho)\s*[-–—•·]?\s*/i, '')
          .replace(/^[·•\-\*\.\s]+/, '')
          .trim();
        const lower = lineClean.toLowerCase();
        const isUiBadge = ['fechar', 'detalhes do pedido', 'carrinhos', 'carrinho', 'voltar', 'excluir', 'resumo', 'pedidos', 'abre', 'não abre', 'nao abre'].includes(lower);
        const isQtyBadge = /^\d+\s*(?:un|pcs|pc|cx|emb|m|kg)\.?$/i.test(lower);
        const hasProductWords = lower.split(/\s+/).some(w => w.length >= 3 && /^[a-zA-ZÀ-ÿ]+$/.test(w));
        if (lineClean.length >= 3 && !lineClean.startsWith('Qtd:') && !lineClean.startsWith('TOTAL') && !lineClean.startsWith('R$') && !isUiBadge && !isQtyBadge && hasProductWords) {
          candidateTitles.push(lineClean);
        }
      }

      let title = 'Produto Cofema';
      if (candidateTitles.length > 0) {
        const longCandidates = candidateTitles.filter(c => c.length > 12);
        if (longCandidates.length > 0) {
          title = longCandidates[0];
        } else {
          title = candidateTitles[0];
        }
      }

      const qtdMatch = block.match(/Qtd:\s*(\d+)/i) || block.match(/(\d+)\s*un/i);
      const qtd = qtdMatch ? parseInt(qtdMatch[1], 10) : 1;

      const prices = Array.from(block.matchAll(/R\$\s*([\d\.,]+)/gi)).map(m => parseFloat(m[1].replace(/\./g, '').replace(',', '.')));
      let totalVal = prices.length > 0 ? prices[prices.length - 1] : 0;
      let unitPrice = totalVal > 0 ? Math.round((totalVal / Math.max(qtd, 1)) * 100) / 100 : 0;

      if (unitPrice > 0 || totalVal > 0) {
        items.push({
          nomeProduto: title,
          codigoProduto: sku,
          quantidade: qtd,
          precoUnitario: unitPrice,
          totalItem: totalVal,
          rawUnitPriceStr: `R$ ${unitPrice.toFixed(2)}`
        });
      }
    });

    const totalMatch = text.match(/Total\s*Carrinho:?\s*R\$\s*([\d\.,]+)/i) || text.match(/TOTAL\s*R\$\s*([\d\.,]+)/i);
    const totalPedido = totalMatch ? parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.')) : items.reduce((acc, i) => acc + i.totalItem, 0);

    return {
      cartUrl: window.location.href,
      containersFoundCount: items.length,
      produtos: items,
      errosExtracao: [],
      resumo: {
        resumoTabelaEncontrada: items.length > 0,
        totalItens: items.length,
        despesaAcessoria: 0,
        totalPedido: Math.round(totalPedido * 100) / 100
      }
    };
  });

  if (cartData && cartData.produtos) {
    cartData.produtos.forEach(p => {
      const skuStr = String(p.codigoProduto || '');
      const cachedTitle = cofemaSessionProductsMap.get(skuStr);
      if (cachedTitle && (p.nomeProduto === 'Produto Cofema' || p.nomeProduto === 'BRASFORT' || p.nomeProduto.length <= 10)) {
        console.log(`[CofemaExtractor] Enriquecendo título do item SKU ${skuStr}: "${p.nomeProduto}" ➔ "${cachedTitle}"`);
        p.nomeProduto = cachedTitle;
      }
    });
  }

  console.log(`[CofemaExtractor] ${cartData.produtos.length} item(ns) extraído(s) do modal Detalhes do Pedido em /page/pedidos. Total: R$ ${cartData.resumo.totalPedido.toFixed(2)}`);
  return cartData;
}

/**
 * 🔒 FLUXO DE RESET / LIMPEZA DO CARRINHO COFEMA ANTES DA COTAÇÃO
 */
async function cofemaLimparCarrinho(page, config) {
  console.log(`[${new Date().toISOString()}] [CofemaExtractor] Executando higiene/reset do carrinho B2B...`);
  try {
    if (!page.url().includes('cofema.com.br')) {
      await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // 1. Abrir gaveta do carrinho no header
    const cartTrigger = page.locator('header button:has(svg), header a:has(svg)').first();
    if (await cartTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cartTrigger.evaluate((el) => el.click()).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // 2. Clicar em "Excluir carrinho permanentemente" se visível
    const deleteCartBtn = page.locator('button[title="Excluir carrinho permanentemente"]').first();
    if (await deleteCartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteCartBtn.evaluate((b) => b.click()).catch(() => {});
      await page.waitForTimeout(1500);

      const confirmBtn = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), button:has-text("Excluir")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.evaluate((b) => b.click()).catch(() => {});
        await page.waitForTimeout(2000);
      }
    }

    // 3. Purga individual de cada card de item restante na gaveta
    for (let loop = 0; loop < 10; loop++) {
      const removeBtn = page.locator('button[title="Remover item"]').first();
      if (await removeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        console.log(`[CofemaExtractor RESET] Removendo item residual ${loop + 1}...`);
        await removeBtn.evaluate((b) => b.click()).catch(() => {});
        await page.waitForTimeout(1500);

        const confirmBtn = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), button:has-text("Excluir")').first();
        if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await confirmBtn.evaluate((b) => b.click()).catch(() => {});
          await page.waitForTimeout(1500);
        }
      } else {
        break;
      }
    }

    // 🔒 VALIDAÇÃO PÓS-LIMPEZA DO DOM DO PORTAL (GAVETA DE CARRINHO ATIVO)
    const cartCheck = await cofemaExtrairCarrinho(page, config);
    const remCount = cartCheck.produtos.length;

    if (remCount === 0) {
      console.log(`[${new Date().toISOString()}] [CofemaExtractor] ✅ carrinho verificado como vazio: 0 itens`);
    } else {
      console.error(`[${new Date().toISOString()}] [CofemaExtractor] ❌ FALHA NA LIMPEZA: ${remCount} itens residuais detectados no carrinho!`);
      throw new Error(`Limpeza do carrinho falhou - ${remCount} itens residuais ainda presentes`);
    }

    await garantirCarrinhoFechado(page);

  } catch (e) {
    if (e.message && e.message.startsWith('Limpeza do carrinho falhou')) {
      throw e;
    }
    console.error(`[${new Date().toISOString()}] [CofemaExtractor] Erro crítico na limpeza do carrinho:`, e.message);
    throw e;
  }
}

module.exports = {
  cofemaRealizarLogin,
  cofemaAdicionarItem,
  cofemaExtrairCarrinho,
  cofemaLimparCarrinho,
};

