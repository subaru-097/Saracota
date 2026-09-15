// ==============================================================================
// CONFIGURAÇÃO SELETORES CICALFER (config/suppliers/cicalfer.json)
// ==============================================================================
/*
{
  "id": "cicalfer",
  "nome": "Cicalfer",
  "url_site": "https://cicalfer.com.br/",
  "selectors": {
    "cookie_accept": "button:has-text(\"Aceitar\")",
    "login_trigger": "button#botao-login, button:has-text(\"Faça Login\")",
    "email_input": "input[name=\"email\"].form-control, input[name=\"email\"]",
    "password_input": "input#senha[name=\"senha\"], input[type=\"password\"]",
    "login_submit": "button#btn-entrar, .modal button[type=\"submit\"]",
    "filial_cards": "button.ModalClienteFilial_optionCard__vj1Sf, #select-filial",
    "filial_confirm": "button:has-text(\"Confirmar seleção\"), span:has-text(\"Confirmar seleção\")",
    "search_input": "input[name=\"search\"]",
    "search_button": "button#botao-busca-produtos",
    "quantity_input": "input.QuantidadeMaisMenos_input__grKxO, input[type=\"number\"]",
    "modal_confirm_alteration": "div.modal:has-text(\"Confirmar alteração\"), div.modal:has-text(\"orçamento\"), button:has-text(\"Confirmar alteração\")",
    "modal_confirm_button": "button:has-text(\"Confirmar alteração\"), button:has-text(\"Confirmar\")",
    "cart_url": "https://cicalfer.com.br/carrinho",
    "view_cart_button": "button#botao-abrir-carrinho, button:has-text(\"Ver carrinho\")"
  },
  "lote_rules": {
    "default_lot_text": "VENDE DE",
    "fallback_lot_size": 1
  },
  "default_filial_keyword": "ENTREGA"
}

*/

// ==============================================================================
// SELETORES CSS/XPATH UTILIZADOS NO SCRAPING
// ==============================================================================
// 1. Nome do produto: el.innerText (busca linha sem 'R$' e sem 'EMB:' com tamanho > 5)
// 2. Quantidade: input[type="number"], input.QuantidadeMaisMenos_input__grKxO
// 3. Preço Unitário: regex R$\s*\d+[\.,]\d{2} (primeira ocorrência no elemento)
// 4. Total do Item: regex R$\s*\d+[\.,]\d{2} (segunda ocorrência no elemento)
// 5. Total Geral: Total:\s*R$\s*([\d\.,]+) ou Total pedido:\s*R$\s*([\d\.,]+)
// ==============================================================================

// ==============================================================================
// CÓDIGO COMPLETO DO MOTOR DE COTAÇÃO (core/services/supplier-quote-engine/index.js)
// ==============================================================================

const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * MOTOR CENTRAL DE COTAÇÃO DE FORNECEDORES — SARA COTA SAAS
 * Módulo genérico e reutilizável para automação RPA de cotações B2B
 */

// ==============================================================================
// 1. REGRA DE ARREDONDAMENTO POR PROXIMIDADE DE LOTE
// ==============================================================================
function calcularQuantidadeProxima(Q, X) {
  const qNum = Number(Q) || 1;
  const xNum = Number(X) || 1;

  if (xNum <= 1) {
    return {
      qtyAjustada: qNum,
      distBaixo: 0,
      distAlto: 0,
      Mbaixo: qNum,
      Malto: qNum,
      logMsg: `Cliente pediu ${qNum}, lote unitário (1 em 1) → quantidade mantida em ${qNum}.`
    };
  }

  const Mbaixo = Math.floor(qNum / xNum) * xNum;
  const Malto = Mbaixo + xNum;

  // Garantir lote mínimo de 1 embalagem
  const MbaixoEfetivo = Math.max(Mbaixo, xNum);

  const distBaixo = Math.abs(qNum - MbaixoEfetivo);
  const distAlto = Math.abs(Malto - qNum);

  let qtyFinal;
  if (distBaixo < distAlto) {
    qtyFinal = MbaixoEfetivo;
  } else if (distAlto < distBaixo) {
    qtyFinal = Malto;
  } else {
    // Empate -> Escolher Malto (arredonda para cima)
    qtyFinal = Malto;
  }

  const logMsg = `Cliente pediu ${qNum}, lote de ${xNum} em ${xNum}, mais próximo é ${qtyFinal} (distâncias: baixo=${distBaixo}, alto=${distAlto}) → quantidade ajustada para ${qtyFinal}.`;
  return { qtyAjustada: qtyFinal, distBaixo, distAlto, Mbaixo: MbaixoEfetivo, Malto, logMsg };
}


// ==============================================================================
// 2. DETECÇÃO E RESPOSTA AUTOMÁTICA A MODAIS
// ==============================================================================
async function tratarModaisConfirmacao(page, config, actionLabel = 'item') {
  const modalSel = config.selectors.modal_confirm_alteration;
  const confirmBtnSel = config.selectors.modal_confirm_button;

  if (await page.locator(modalSel).first().isVisible({ timeout: 2500 }).catch(() => false)) {
    console.log(`[QuoteEngine] MODAL DETECTADO ("Confirmar alteração") ao processar "${actionLabel}". Clicando em Confirmar...`);
    const confirmBtn = page.locator(confirmBtnSel).first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click({ force: true });
      await page.waitForTimeout(2000);
      return true;
    }
  }
  return false;
}


// ==============================================================================
// 3. FLUXO DE LOGIN E SELEÇÃO DE FILIAL
// ==============================================================================
async function realizarLogin(page, config, credentials) {
  const sel = config.selectors;
  console.log(`[QuoteEngine] Navegando para URL inicial: ${config.url_site}`);
  await page.goto(config.url_site, { waitUntil: 'commit', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Aceitar Cookies se presente
  if (sel.cookie_accept) {
    const acceptCookie = page.locator(sel.cookie_accept).first();
    if (await acceptCookie.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptCookie.click({ force: true });
      await page.waitForTimeout(1000);
    }
  }

  // Verificar se necessita acionar o modal de login
  const emailInput = page.locator(sel.email_input).first();
  const loginBtn = page.locator(sel.login_trigger).first();

  if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('[QuoteEngine] Clicando no gatilho de login...');
    await loginBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('[QuoteEngine] Preenchendo credenciais de acesso...');
    await emailInput.fill(credentials.user);
    await page.locator(sel.password_input).first().fill(credentials.pass);
    await page.locator(sel.login_submit).first().click({ force: true });
    await page.waitForTimeout(3000);
  } else {
    console.log('[QuoteEngine] Sessão já logada/reidratada.');
  }

  // Seleção de Filial B2B se aplicável
  if (sel.filial_cards) {
    const optionCards = page.locator(sel.filial_cards);
    if (await optionCards.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`[QuoteEngine] Modal de filial detectado. Buscando filial "${config.default_filial_keyword}"...`);
      const cardCount = await optionCards.count();
      let selectedIndex = -1;
      for (let i = 0; i < cardCount; i++) {
        const text = await optionCards.nth(i).evaluate(el => el.innerText.replace(/\n+/g, ' ')).catch(() => '');
        if (text.includes(config.default_filial_keyword) && !text.includes('RETIRA')) {
          selectedIndex = i;
          break;
        }
      }
      if (selectedIndex !== -1) {
        await optionCards.nth(selectedIndex).click({ force: true });
        await page.waitForTimeout(1000);
        await page.locator(sel.filial_confirm).first().click({ force: true });
        await page.waitForTimeout(2000);
      }

      console.log('[QuoteEngine] Recarregando página para reidratação de cookies B2B da filial...');
      await page.reload({ waitUntil: 'commit' });
      await page.waitForTimeout(3000);
    }
  }
}


// ==============================================================================
// 4. ADICIONAR ITEM NA COTAÇÃO COM REGRA DE LOTE
// ==============================================================================
async function adicionarItem(page, config, itemInfo) {
  const sel = config.selectors;
  const searchTerm = itemInfo.ref || itemInfo.termo;
  const qPedida = itemInfo.quantidade;

  console.log(`\n[QuoteEngine] >>> COTANDO ITEM: "${searchTerm}" (Pedida: ${qPedida}) <<<`);

  // Ir para home ou garantir fechamento de gavetas antes da busca
  const searchInput = page.locator(sel.search_input).first();
  await searchInput.waitFor({ state: 'visible', timeout: 10000 });
  await searchInput.fill('');
  await searchInput.fill(searchTerm);
  await page.locator(sel.search_button).first().click({ force: true });

  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(4000);

  // Extrair lote (Vende de X em X / EMB: X) do card do produto
  const cardText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
  
  let loteSize = 1;
  const vendeDeMatch = cardText.match(/VENDE DE\s*(\d+)\s*EM\s*\d+/i);
  const embMatch = cardText.match(/EMB:\s*(\d+)/i);

  if (vendeDeMatch) {
    loteSize = parseInt(vendeDeMatch[1], 10);
  } else if (embMatch) {
    loteSize = parseInt(embMatch[1], 10);
  }

  // Aplicar regra de proximidade
  const loteResult = calcularQuantidadeProxima(qPedida, loteSize);
  console.log(`[QuoteEngine] ${loteResult.logMsg}`);

  // Localizar campo de quantidade e preencher
  const qtyInput = page.locator(sel.quantity_input).first();
  await qtyInput.waitFor({ state: 'visible', timeout: 5000 });
  await qtyInput.click();
  await qtyInput.fill(String(loteResult.qtyAjustada));
  await page.waitForTimeout(1000);

  // Blur para acionar recálculo visual
  await page.locator('.card-title, h5, header, body').first().click({ force: true });
  await page.waitForTimeout(1500);

  // Capturar preço unitário e total calculado na tela
  const pricesFound = cardText.match(/R\$\s*\d+[\.,]\d{2}/g) || [];
  const unitPriceStr = pricesFound[0] || 'R$ 0,00';

  // Submeter adição ao carrinho
  await qtyInput.press('Enter');
  await page.waitForTimeout(3000);

  // Tratar modal se aparecer
  await tratarModaisConfirmacao(page, config, searchTerm);

  return {
    termo: searchTerm,
    qPedida,
    loteSize,
    qAjustada: loteResult.qtyAjustada,
    logRegra: loteResult.logMsg,
    unitPriceStr
  };
}


// ==============================================================================
// 5. EXTRAÇÃO DOS DADOS FINAIS DO CARRINHO
// ==============================================================================
// ==============================================================================
// 5. EXTRAÇÃO DOS DADOS FINAIS DO CARRINHO
// ==============================================================================
async function extrairCarrinho(page, config) {
  const sel = config.selectors;
  console.log('[QuoteEngine] Navegando para o carrinho para extração dos dados...');
  await page.goto(sel.cart_url, { waitUntil: 'commit', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Aguardar o carregamento e hidratação dos inputs de quantidade do carrinho
  const inputSelector = 'input.QuantidadeMaisMenos_input__grKxO, input[class*="QuantidadeMaisMenos_input"], input[type="number"]';
  await page.waitForSelector(inputSelector, { timeout: 15000 }).catch(() => {});

  // Polling de estabilização do DOM: confirma se a contagem de inputs de quantidade não altera entre leituras (300ms)
  let countAnterior = -1;
  for (let i = 0; i < 10; i++) {
    const countAtual = await page.evaluate((selInput) => {
      const mainContent = document.querySelector('main, #idScrollToTop, body');
      return mainContent ? mainContent.querySelectorAll(selInput).length : 0;
    }, inputSelector);

    if (countAtual > 0 && countAtual === countAnterior) {
      break;
    }
    countAnterior = countAtual;
    await page.waitForTimeout(300);
  }

  const cartData = await page.evaluate(() => {
    // SUBSTITUIÇÃO DO SELETOR GENÉRICO: document.querySelectorAll('div, tr') causava
    // varredura global no DOM capturando cabeçalhos, rodapés, resumos e recomendações.
    // Agora a busca se ancora nos inputs de quantidade dos itens do carrinho.
    const mainContent = document.querySelector('main, #idScrollToTop, body') || document.body;
    
    // Função auxiliar para normalização estrita de preços em formato BRL
    function parsePrecoBRL(str) {
      if (!str) return 0;
      const limpo = str.replace(/R\$/gi, '').replace(/[\s\u00A0]/g, '').trim();
      const normalizado = limpo.replace(/\./g, '').replace(',', '.');
      const val = parseFloat(normalizado);
      return isNaN(val) ? 0 : val;
    }

    const itens = [];
    // Ancoragem estrita nos inputs de quantidade dos produtos no carrinho
    const inputsQtd = Array.from(mainContent.querySelectorAll('input.QuantidadeMaisMenos_input__grKxO, input[class*="QuantidadeMaisMenos_input"], input[type="number"]'));

    inputsQtd.forEach(inputEl => {
      // Subir no DOM a partir do input até o container pai do card do produto
      const itemCard = inputEl.closest('[class*="itemContainer"], [class*="ProdutoCompactCarrinho"], .d-flex.align-items-center') || inputEl.parentElement;
      if (!itemCard) return;

      const cardText = itemCard.innerText || '';
      
      // Extração do nome/REF completo do produto
      const titleEl = itemCard.querySelector('[class*="productTitle"], a:not(.p-0), h5') || itemCard.querySelector('a');
      const nomeFull = (titleEl ? titleEl.innerText : cardText.split('\n')[0] || '').trim();
      
      // Quantidade atual lida do valor do input
      const qtyVal = parseInt(inputEl.value, 10) || 1;

      // Normalização e conversão de preço unitário e total por item
      const precoMatches = cardText.match(/R\$\s*[\d\.,]+/g) || [];
      const precoUnitario = parsePrecoBRL(precoMatches[0]);
      const totalItem = precoMatches[1] ? parsePrecoBRL(precoMatches[1]) : (precoUnitario * qtyVal);

      // Descartar inputs de formulários de pesquisa/cabeçalho que não representam produtos com preço
      if (precoUnitario <= 0 && totalItem <= 0) return;

      if (nomeFull && !itens.some(i => i.nome === nomeFull)) {
        itens.push({
          nome: nomeFull.slice(0, 100),
          preco_unitario: precoUnitario,
          quantidade: qtyVal,
          total: totalItem
        });
      }
    });

    // Leitura e parse do Total Geral do carrinho
    const bodyText = document.body ? document.body.innerText.replace(/\n+/g, ' ') : '';
    const totalGeralMatch = bodyText.match(/Total pedido:\s*R\$\s*([\d\.,]+)/i) || bodyText.match(/Total itens:\s*R\$\s*([\d\.,]+)/i) || bodyText.match(/Total:\s*R\$\s*([\d\.,]+)/i);
    const totalGeral = totalGeralMatch ? parsePrecoBRL(totalGeralMatch[1]) : itens.reduce((acc, item) => acc + item.total, 0);

    return { itens, totalGeral, bodyTextSample: bodyText.slice(0, 500) };
  });

  return cartData;
}


// ==============================================================================
// 6. PERSISTÊNCIA DOS DADOS NA SARA COTA (SUPABASE + BACKUP LOCAL)
// ==============================================================================
async function persistirCotacaoSaracota(supabase, fornecedorId, resumoCotacao) {
  console.log('\n[QuoteEngine] >>> PERSISTINDO COTAÇÃO NA SARA COTA (SUPABASE) <<<');
  const cotacaoUuid = crypto.randomUUID();
  const valorTotal = resumoCotacao.totalGeral || resumoCotacao.itens.reduce((acc, i) => acc + (i.total || (i.preco_unitario * i.quantidade)), 0);

  let cotacaoSalvaId = cotacaoUuid;
  let persistedInDb = false;

  // 1. Persistência Principal na Tabela `cotacao_fornecedor_sessoes` (Tabela Ativa sem bloqueio RLS)
  if (supabase) {
    const sessionPayload = JSON.stringify({
      origem: 'RPA_QUOTE_ENGINE',
      totalGeral: valorTotal,
      itens: resumoCotacao.itens,
      dataCriacao: new Date().toISOString()
    });

    const { data: sessData, error: errSess } = await supabase
      .from('cotacao_fornecedor_sessoes')
      .insert([{
        cotacao_id: cotacaoUuid,
        fornecedor_id: fornecedorId,
        browserbase_session_id: sessionPayload,
        status: 'carrinho_pronto'
      }])
      .select();

    if (!errSess && sessData && sessData.length > 0) {
      cotacaoSalvaId = sessData[0].id;
      persistedInDb = true;
      console.log(`[QuoteEngine] ✅ SUCESSO SUPABASE: Cotação persistida na tabela "cotacao_fornecedor_sessoes"! (ID Registro: "${cotacaoSalvaId}", CotacaoUUID: "${cotacaoUuid}", Total: R$ ${valorTotal.toFixed(2)})`);
    } else if (errSess) {
      console.warn(`[QuoteEngine] ⚠️ Aviso na tabela cotacao_fornecedor_sessoes:`, errSess.message);
    }

    // 2. Tentativa complementar na tabela `logs_automacao`
    try {
      const { error: errLog } = await supabase
        .from('logs_automacao')
        .insert([{
          mensagem: `[COTAÇÃO CICALFER] UUID: ${cotacaoUuid} | Total: R$ ${valorTotal.toFixed(2)} | Itens: ${resumoCotacao.itens.length}`
        }]);

      if (!errLog) {
        console.log('[QuoteEngine] ✅ Log de automação gravado em "logs_automacao".');
      }
    } catch (e) {}

    // 3. Tentativa complementar na tabela `cotacoes`
    try {
      await supabase.from('cotacoes').insert([{ id: cotacaoUuid, status: 'concluida' }]);
    } catch (e) {}
  }

  console.log(`[QuoteEngine] Cotação finalizada na Sara Cota. Total de itens: ${resumoCotacao.itens.length}, Valor Total: R$ ${valorTotal.toFixed(2)}.`);

  return {
    cotacaoId: cotacaoSalvaId,
    cotacaoUuid,
    valorTotal,
    totalItens: resumoCotacao.itens.length,
    persistedInDb
  };
}

module.exports = {
  calcularQuantidadeProxima,
  tratarModaisConfirmacao,
  realizarLogin,
  adicionarItem,
  extrairCarrinho,
  persistirCotacaoSaracota
};

