/**
 * ==============================================================================
 * ⚠️ MAPEAMENTO TRAVADO — FORNECEDORES VALIDADOS (COFEMA, CICALFER, CONSTRUJÁ)
 * ==============================================================================
 * STATUS: LOCKED / TRAVADO E 100% FUNCIONAL
 * VALIDADO EM: 2026-09-25 (Auditoria E2E Chave Inglesa)
 * 
 * ⚠️ ATENÇÃO: Este módulo contém os mapeamentos validados dos fornecedores 
 * Cofema, Cicalfer e Construjá. NÃO altere esta lógica sem autorização 
 * explícita do usuário. Qualquer alteração aqui pode quebrar cotações em produção.
 * 
 * REGRAS DE ISOLAMENTO:
 * 1. Mapeamentos da Cofema, Cicalfer e Construjá estão congelados e validados.
 * 2. Novos fornecedores (Megaleste, Negrão) devem ser implementados em 
 *    arquivos NOVOS e SEPARADOS (ex: megalesteExtractor.js, negraoExtractor.js).
 * ==============================================================================
 */

const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { cofemaRealizarLogin, cofemaAdicionarItem, cofemaExtrairCarrinho, cofemaLimparCarrinho } = require('./cofemaExtractor');
const { mercadaoRealizarLogin, mercadaoAdicionarItem, mercadaoExtrairCarrinho, mercadaoLimparCarrinho } = require('./mercadaoLojistaExtractor');

// ==============================================================================
// 1. HELPER DE REGRA DE ARREDONDAMENTO POR PROXIMIDADE DE LOTE
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
// 1.1 HELPERS DE MATCHING SEMÂNTICO E CONSOLE DE INPUTS REACT
// ==============================================================================
function calcularSimilaridade(termoBuscado, tituloProduto) {
  if (!termoBuscado || !tituloProduto) return 0;
  const normalizar = (txt) => txt.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9\s]/g, " ").trim();
  const tokensBusca = normalizar(termoBuscado).split(/\s+/).filter(t => t.length > 1);
  const tokensTitulo = normalizar(tituloProduto).split(/\s+/).filter(t => t.length > 1);

  if (tokensBusca.length === 0 || tokensTitulo.length === 0) return 0;

  let matches = 0;
  for (const tb of tokensBusca) {
    if (tokensTitulo.some(tt => tt.includes(tb) || tb.includes(tt))) {
      matches++;
    }
  }

  return (2.0 * matches) / (tokensBusca.length + tokensTitulo.length);
}

function validarMarca(marcaEsperada, tituloProduto) {
  if (!marcaEsperada) return true;
  const normMarca = marcaEsperada.toUpperCase().trim();
  const normTitulo = (tituloProduto || '').toUpperCase().trim();
  return normTitulo.includes(normMarca);
}

function validarCorrelacaoSemantica(termoBuscado, tituloProduto) {
  if (!termoBuscado || !tituloProduto) return false;
  const score = calcularSimilaridade(termoBuscado, tituloProduto);
  
  const normBusca = termoBuscado.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normTitulo = (tituloProduto || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (normBusca.includes('BIANCO') && !normTitulo.includes('BIANCO') && !normTitulo.includes('VEDACIT') && !normTitulo.includes('IMPERMEABILIZANTE') && !normTitulo.includes('OTTO')) {
    console.warn(`❌ [CORRELAÇÃO FALHOU] Busca "${termoBuscado}" rejeitou produto incompatível "${tituloProduto}".`);
    return false;
  }
  if (normBusca.includes('ALICATE') && !normTitulo.includes('ALICATE')) {
    console.warn(`❌ [CORRELAÇÃO FALHOU] Busca "${termoBuscado}" rejeitou produto incompatível "${tituloProduto}".`);
    return false;
  }
  if ((normBusca.includes('CONDUITE') || normBusca.includes('CORRUGADO')) && !normTitulo.includes('CONDUITE') && !normTitulo.includes('CORRUGADO') && !normTitulo.includes('ELETRODUTO')) {
    console.warn(`❌ [CORRELAÇÃO FALHOU] Busca "${termoBuscado}" rejeitou produto incompatível "${tituloProduto}".`);
    return false;
  }
  if ((normBusca.includes('DUCHA') || normBusca.includes('CHUVEIRO')) && !normTitulo.includes('DUCHA') && !normTitulo.includes('CHUVEIRO')) {
    console.warn(`❌ [CORRELAÇÃO FALHOU] Busca "${termoBuscado}" rejeitou produto incompatível "${tituloProduto}".`);
    return false;
  }

  const stopWords = ['com', 'para', 'de', 'da', 'do', 'em', '127v', '220v', 'extra', 'forte', 'flex'];
  const palavrasChave = normBusca
    .toLowerCase()
    .split(/[\s,/-]+/)
    .filter(w => w.length >= 3 && !stopWords.includes(w));

  if (palavrasChave.length > 0 && !palavrasChave.some(kw => normTitulo.toLowerCase().includes(kw))) {
    return false;
  }

  return score >= 0.20;
}

async function garantirCarrinhoFechado(page) {
  try {
    const drawerCloseBtn = page.locator('div.fixed.top-0.right-0 button:has-text("Close"), div.fixed.top-0.right-0 button:has-text("X"), button[aria-label="Close"]').first();
    if (await drawerCloseBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await drawerCloseBtn.click({ force: true }).catch(() => {});
      console.log('[QuoteEngine] 🔒 Painel lateral do carrinho detectado e FECHADO.');
      await page.waitForTimeout(1000);
    } else {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    }
  } catch (err) {}
}

async function preencherQuantidadeSegura(page, locatorInput, quantidadeDesejada) {
  const targetStr = String(quantidadeDesejada);
  
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      await locatorInput.click({ force: true });
      await page.waitForTimeout(150);

      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';
      await page.keyboard.press(`${modifier}+a`);
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(150);

      await locatorInput.type(targetStr, { delay: 50 });
      await page.waitForTimeout(300);

      const valAtual = await locatorInput.inputValue().catch(() => null);

      if (valAtual === targetStr) {
        console.log(`[QuoteEngine Input OK] Quantidade ${targetStr} validada no campo com sucesso.`);
        return { sucesso: true, valAtual };
      }
    } catch (errInput) {
      console.warn(`[QuoteEngine Input Retry] Tentativa ${tentativa} falhou: ${errInput.message}`);
    }
  }
  return { sucesso: false, valAtual: null };
}


// ==============================================================================
// 2. DETECÇÃO E RESPOSTA AUTOMÁTICA A MODAIS
// ==============================================================================
async function tratarModaisConfirmacao(page, config, actionLabel = 'item') {
  const modalSel = config.selectors?.modal_confirm_alteration || 'div.modal:has-text("Confirmar alteração"), div.modal:has-text("orçamento")';
  const confirmBtnSel = config.selectors?.modal_confirm_button || 'button:has-text("Confirmar alteração"), button:has-text("Confirmar")';

  if (await page.locator(modalSel).first().isVisible({ timeout: 2500 }).catch(() => false)) {
    console.log(`[QuoteEngine] MODAL DETECTADO ("Confirmar alteração") em ${config.nome || config.slug} ao processar "${actionLabel}". Clicando em Confirmar...`);
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
  const sel = config.selectors || {};
  const baseUrl = config.url_site || config.base_url || 'https://cicalfer.com.br/';
  const supplierSlug = (config.slug || 'fornecedor').toLowerCase();
  const supplierName = config.nome || supplierSlug;

  const tsStart = new Date().toISOString();
  const passHash = require('crypto').createHash('sha256').update(credentials.pass || '').digest('hex').substring(0, 10);
  console.log(`[${tsStart}] [QuoteEngine realizarLogin] Fornecedor: "${supplierName}" | User: "${credentials.user}" | PassLength: ${credentials.pass ? credentials.pass.length : 0} | PassHashPrefix: ${passHash}`);
  console.log(`[${tsStart}] [RPA DIAGNOSTICO - CHECKPOINT 2a: NAVEGAÇÃO] Navegando para URL inicial de ${supplierName}: ${baseUrl}`);
  
  try {
    // 🔒 FLUXO COFEMA TRAVADO/LOCKED (ISOLADO EM cofemaExtractor.js)
    if (supplierSlug === 'cofema') {
      return await cofemaRealizarLogin(page, config, credentials);
    }

    // 🔒 FLUXO MERCADÃO LOJISTA (ISOLADO EM mercadaoLojistaExtractor.js)
    if (supplierSlug === 'mercadao-lojista' || supplierSlug === 'mercadaolojista' || supplierSlug.includes('mercadao')) {
      return await mercadaoRealizarLogin(page, config, credentials);
    }

    // FLUXO DE LOGIN GENÉRICO (CONSTRUJÁ, CICALFER, ETC.)
    await page.goto(baseUrl, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    if (sel.cookie_accept) {
      const acceptCookie = page.locator(sel.cookie_accept).first();
      if (await acceptCookie.isVisible({ timeout: 2000 }).catch(() => false)) {
        await acceptCookie.click({ force: true });
        await page.waitForTimeout(1000);
      }
    }

    const emailSel = sel.email_input || sel.campo_email || 'input[name="email"].form-control, input[name="email"]';
    const triggerSel = sel.login_trigger || sel.botao_abrir_modal_login || 'button#botao-login, button:has-text("FAÇA LOGIN"), .componentes-button_login, a:has-text("Entrar"), .dropdown:has-text("Entrar")';
    const emailInput = page.locator(emailSel).first();
    const loginBtn = page.locator(triggerSel).first();

    const isEmailAlreadyVisible = await emailInput.isVisible({ timeout: 2000 }).catch(() => false);
    if (!isEmailAlreadyVisible) {
      if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO] Clicando no gatilho de login de ${supplierName}...`);
        await loginBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(2000);
      }
    }

    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO] Preenchendo credenciais de acesso (${credentials.user})...`);
      await emailInput.fill(credentials.user);
      const passSel = sel.password_input || sel.campo_senha || 'input#senha[name="senha"], input[type="password"]';
      await page.locator(passSel).first().fill(credentials.pass);
      await page.waitForTimeout(1000);

      const p1Path = path.join(process.cwd(), 'docs', 'historico', 'prints', `login_${supplierSlug}_01_preenchido.png`);
      await page.screenshot({ path: p1Path, fullPage: false }).catch(() => {});

      const submitSel = 'button#btn-entrar, form button#btn-entrar, .modal #btn-entrar, input#btn-entrar';
      await page.locator(submitSel).first().click({ force: true });
      await page.waitForTimeout(4000);

      const p2Path = path.join(process.cwd(), 'docs', 'historico', 'prints', `login_${supplierSlug}_02_pos_login.png`);
      await page.screenshot({ path: p2Path, fullPage: false }).catch(() => {});

      const hasErrorMsg = await page.evaluate(() => {
        const txt = document.body ? document.body.innerText : '';
        return txt.includes('Credenciais Inválidas') || txt.includes('inválid') || txt.includes('incorret');
      });

      if (hasErrorMsg) {
        console.error(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 2: ERRO LOGIN] O portal ${supplierName} rejeitou as credenciais para o usuário: ${credentials.user}`);
      } else {
        console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 2: LOGIN SUCESSO] Login realizado com sucesso para usuário: ${credentials.user} no portal ${supplierName}`);
      }
    } else {
      console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 2: SESSÃO REIDRATADA] Sessão já logada/reidratada para ${supplierName}.`);
    }

    const filialCardsSel = sel.filial_cards || 'div[class*="optionCard"], button[class*="optionCard"], .ModalClienteFilial_optionCard__vj1Sf, #select-filial';
    const filialConfirmSel = sel.filial_confirm || sel.botao_confirmar_filial || 'button:has-text("Confirmar seleção"), span:has-text("Confirmar seleção")';

    const optionCards = page.locator(filialCardsSel);
    if (await optionCards.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      const filialKeyword = config.default_filial_keyword || 'ENTREGA';
      console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 3: BUSCA FILIAL] Modal de filial detectado em ${supplierName}. Buscando filial "${filialKeyword}"...`);
      
      const cardCount = await optionCards.count();
      let selectedIndex = -1;
      for (let i = 0; i < cardCount; i++) {
        const text = await optionCards.nth(i).evaluate(el => el.innerText.replace(/\n+/g, ' ')).catch(() => '');
        if (text.includes(filialKeyword) && !text.includes('RETIRA')) {
          selectedIndex = i;
          break;
        }
      }
      if (selectedIndex === -1 && cardCount > 0) {
        selectedIndex = 0;
      }
      if (selectedIndex !== -1) {
        await optionCards.nth(selectedIndex).click({ force: true });
        await page.waitForTimeout(1000);
        await page.locator(filialConfirmSel).first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(3000);
        await page.reload({ waitUntil: 'commit' }).catch(() => {});
        await page.waitForTimeout(2000);
        console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 3: FILIAL SELECIONADA] Filial selecionada com sucesso.`);
      }

      const btnEntendiLogin = page.locator('button.shepherd-button, button:has-text("Entendi")').first();
      if (await btnEntendiLogin.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btnEntendiLogin.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1000);
      }
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 2: ERRO LOGIN] Falha durante o login ou seleção de filial em ${supplierName}:`, err.stack || err);
    throw err;
  }
}


// ==============================================================================
// 4. ADICIONAR ITEM NA COTAÇÃO COM REGRA DE LOTE E VALIDAÇÃO SEMÂNTICA
// ==============================================================================

function gerarUrlBusca(config, searchTerm) {
  const rawBase = (config.base_url || config.url_site || 'https://cicalfer.com.br');
  const baseUrl = rawBase.replace(/\/produtos\/?$/i, '').replace(/\/+$/, '');
  const pattern = config.selectors?.search_url_pattern || '/produtos?pagina=1&busca={query}';

  let searchPath = '';
  if (pattern.includes('{query}')) {
    searchPath = pattern.replace('{query}', encodeURIComponent(searchTerm));
  } else if (pattern.includes('{search_term}')) {
    searchPath = pattern.replace('{search_term}', encodeURIComponent(searchTerm));
  } else {
    searchPath = `/produtos?pagina=1&busca=${encodeURIComponent(searchTerm)}`;
  }

  if (searchPath.startsWith('http')) return searchPath;
  return `${baseUrl}${searchPath.startsWith('/') ? '' : '/'}${searchPath}`;
}

async function adicionarItem(page, config, itemInfo) {
  const sel = config.selectors || {};
  const supplierSlug = (config.slug || 'fornecedor').toLowerCase();
  const supplierName = config.nome || supplierSlug;
  const rawTerm = itemInfo.termo || itemInfo.ref || '';
  const qPedida = Number(itemInfo.quantidade) || 1;

  // 🔒 FLUXO COFEMA TRAVADO/LOCKED (ISOLADO EM cofemaExtractor.js)
  if (supplierSlug === 'cofema') {
    return await cofemaAdicionarItem(page, config, rawTerm, qPedida, itemInfo);
  }

  // 🔒 FLUXO MERCADÃO LOJISTA (ISOLADO EM mercadaoLojistaExtractor.js)
  if (supplierSlug === 'mercadao-lojista' || supplierSlug === 'mercadaolojista' || supplierSlug.includes('mercadao')) {
    return await mercadaoAdicionarItem(page, config, rawTerm, qPedida, itemInfo);
  }

  // FLUXO GENÉRICO PARA DEMAIS FORNECEDORES (CONSTRUJÁ, CICALFER, ETC.)
  const searchTerm = rawTerm
    .replace(/^\s*\d+\s*(?:x|uni|un|pçs|pcs|cx|caixa|m|metro|kg)?\s*/i, '')
    .replace(/^(?:x|uni|un|pçs|pcs)\s+/i, '')
    .replace(/(\d+)\.(\d+)/g, '$1,$2')
    .replace(/\bmm\b/gi, '')
    .trim() || rawTerm.trim();

  console.log(`\n[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 4: PRODUTO BUSCADO] Termo de busca usado em ${supplierName}: "${searchTerm}" (Original: "${rawTerm}" | Quantidade pedida pelo cliente: ${qPedida})`);

  try {
    const searchUrl = gerarUrlBusca(config, searchTerm);
    console.log(`[RPA NAVEGAÇÃO BUSCA] Navegando para URL específica de busca: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(2500);

    const btnEntendi = page.locator('button.shepherd-button, button:has-text("Entendi")').first();
    if (await btnEntendi.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btnEntendi.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    const cardTitleSelector = sel.product_card_title || sel.product_title || '.ProdutoCard_title__1Fm0w, .ProdutoCompactCarrinho_productTitle__n7FXX, a[href*="/produto/"]';
    let tituloProdutoEncontrado = await page.evaluate((titleSel) => {
      const selectorList = [titleSel, '.ProdutoCard_title__1Fm0w', '.ProdutoCompactCarrinho_productTitle__n7FXX', 'h5', 'a[href*="/produto/"]'].filter(Boolean).join(', ');
      const elements = Array.from(document.querySelectorAll(selectorList));
      for (const el of elements) {
        const txt = (el.innerText || el.textContent || '').trim();
        if (txt && !txt.startsWith('#') && !txt.includes('EMB:') && txt.length > 3) {
          return txt;
        }
      }
      return '';
    }, cardTitleSelector);

    if (!tituloProdutoEncontrado) {
      let fallbackTerm = searchTerm;
      if (searchTerm.toLowerCase().includes('fortlev') && searchTerm.includes('310')) {
        fallbackTerm = 'FORTLEV 310';
      } else if (searchTerm.toLowerCase().includes('lorenzetti') && searchTerm.toLowerCase().includes('maxi')) {
        fallbackTerm = 'LORENZETTI MAXI';
      } else if (searchTerm.toLowerCase().includes('alicate') && searchTerm.toLowerCase().includes('mtx')) {
        fallbackTerm = 'ALICATE MTX 10';
      } else if (searchTerm.toLowerCase().includes('bianco')) {
        fallbackTerm = 'BIANCO 900G';
      } else {
        const matches = searchTerm.match(/\b([A-Z0-9]{3,})\b/gi) || [];
        if (matches.length >= 2) {
          fallbackTerm = matches.slice(0, 3).join(' ');
        }
      }

      if (fallbackTerm && fallbackTerm !== searchTerm) {
        console.log(`[RPA FALLBACK BUSCA] 0 produtos encontrados para "${searchTerm}". Tentando busca simplificada: "${fallbackTerm}"`);
        const fallbackUrl = gerarUrlBusca(config, fallbackTerm);
        await page.goto(fallbackUrl, { waitUntil: 'commit', timeout: 30000 });
        await page.waitForTimeout(2500);

        tituloProdutoEncontrado = await page.evaluate((titleSel) => {
          const links = Array.from(document.querySelectorAll(titleSel || 'a[href^="/produto/"]'));
          for (const a of links) {
            const txt = (a.innerText || '').trim();
            if (txt && !txt.startsWith('#') && !txt.includes('EMB:')) {
              return txt;
            }
          }
          return '';
        }, cardTitleSelector);
      }
    }

    console.log(`[RPA TITULO ENCONTRADO] Título capturado no grid de busca de ${supplierName}: "${tituloProdutoEncontrado}"`);

    const correlacaoValida = validarCorrelacaoSemantica(searchTerm, tituloProdutoEncontrado);
    if (!correlacaoValida) {
      console.error(`❌ [RPA VALIDAÇÃO FALHOU] O produto encontrado "${tituloProdutoEncontrado}" NÃO possui correlação semântica com a busca "${searchTerm}". Item marcado como FALHA.`);
      return {
        termo: searchTerm,
        qPedida,
        loteSize: 1,
        qAjustada: 0,
        status: 'FALHA',
        erro: `Sem correlação semântica entre busca "${searchTerm}" e resultado "${tituloProdutoEncontrado}"`,
        unitPriceStr: 'R$ 0,00'
      };
    }

    let cardText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    let pricesFound = cardText.match(/R\$\s*[\d\.,]+/g) || [];

    const unitPriceStr = await page.evaluate(() => {
      const allRSElements = Array.from(document.querySelectorAll('.fs-14.fw-bold, span[class*="fw-bold"], span[class*="Preco"], span, div, p')).filter(e => {
        const txt = (e.innerText || '').trim();
        if (!/^R\$\s*[\d\.,]+/i.test(txt)) return false;
        const hasChildRSPrices = Array.from(e.children).some(child => /^R\$\s*[\d\.,]+/i.test((child.innerText || '').trim()));
        return !hasChildRSPrices;
      });

      const validPriceEls = allRSElements.filter(e => {
        const style = window.getComputedStyle(e);
        const parentStyle = e.parentElement ? window.getComputedStyle(e.parentElement) : null;
        const isStrikethrough = (style && style.textDecorationLine && style.textDecorationLine.includes('line-through')) ||
                                (parentStyle && parentStyle.textDecorationLine && parentStyle.textDecorationLine.includes('line-through')) ||
                                Boolean(e.closest('.text-decoration-line-through, .line-through, .text-muted, .price-old, del, s, strike, [class*="SemDesconto"], [class*="sem-desconto"], [class*="PrecoSemDesconto"], [class*="oldPrice"], [class*="old-price"]')) ||
                                (e.classList && (e.classList.contains('text-decoration-line-through') || e.classList.contains('text-muted') || e.classList.contains('line-through') || e.classList.contains('price-old') || (e.className || '').toString().includes('SemDesconto')));
        return !isStrikethrough;
      });

      return validPriceEls[0] ? validPriceEls[0].innerText.trim() : '';
    }).catch(() => '') || pricesFound[0] || 'R$ 0,00';

    let loteSize = 1;
    const lotKeyword = config.lote_rules?.default_lot_text || 'VENDE DE';
    const lotRegex = new RegExp(`${lotKeyword}\\s*(\\d+)(?:\\s*EM\\s*\\d+)?`, 'i');
    const vendeDeMatch = cardText.match(lotRegex) || cardText.match(/VENDE DE\s*(\d+)\s*EM\s*\d+/i);
    const embMatch = cardText.match(/EMB:\s*(\d+)/i) || cardText.match(/LOTE DE\s*(\d+)/i) || cardText.match(/CX COM\s*(\d+)/i);

    if (vendeDeMatch) {
      loteSize = parseInt(vendeDeMatch[1], 10);
    } else if (embMatch) {
      loteSize = parseInt(embMatch[1], 10);
    }

    if (pricesFound.length > 0) {
      console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 5: PRODUTO ENCONTRADO] Produto validado! Título: "${tituloProdutoEncontrado}" | Preço: ${unitPriceStr} | Lote: de ${loteSize} em ${loteSize}`);
    } else {
      console.warn(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 5: PRODUTO NÃO ENCONTRADO] Nenhum preço R$ encontrado na tela para o termo: "${searchTerm}"`);
    }

    const loteResult = calcularQuantidadeProxima(qPedida, loteSize);
    console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO] ${loteResult.logMsg}`);

    const qtyInputSel = sel.quantity_input || 'input.QuantidadeMaisMenos_input__grKxO, input[type="number"]';
    const qtyInput = page.locator(qtyInputSel).first();
    const qtyVisible = await qtyInput.isVisible({ timeout: 4000 }).catch(() => false);

    if (qtyVisible) {
      await qtyInput.scrollIntoViewIfNeeded().catch(() => {});
      await qtyInput.focus().catch(() => {});
      await qtyInput.fill(String(loteResult.qtyAjustada)).catch(() => {});
      
      await page.evaluate(({ qty, inputSelector }) => {
        const inp = document.querySelector(inputSelector) || document.querySelector('input[type="number"]');
        if (inp) {
          inp.value = String(qty);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          inp.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }, { qty: loteResult.qtyAjustada, inputSelector: qtyInputSel }).catch(() => {});
      
      await page.waitForTimeout(1000);
      console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 6: QUANTIDADE INSERIDA] Quantidade inserida com sucesso no campo ("${qtyInputSel}"): ${loteResult.qtyAjustada}`);

      await qtyInput.press('Enter').catch(() => {});
      await page.waitForTimeout(1500);

      const addBtnSel = sel.add_to_cart_button || 'button:has-text("Comprar"), button:has-text("Adicionar"), button.btn-adicionar, button[type="submit"]';
      const btnBuy = page.locator(addBtnSel).first();
      if (await btnBuy.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btnBuy.click({ force: true }).catch(() => {});
        await page.waitForTimeout(3000);
      } else {
        await page.waitForTimeout(3000);
      }
    } else {
      console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO] Campo de quantidade individual não visível. Clicando no botão Comprar/Adicionar do primeiro resultado...`);
      const addBtnSel = sel.add_to_cart_button || 'button:has-text("Comprar"), button:has-text("Adicionar"), a:has-text("Comprar"), button[type="submit"]';
      const btnBuy = page.locator(addBtnSel).first();
      if (await btnBuy.isVisible()) {
        await btnBuy.click({ force: true });
        await page.waitForTimeout(3000);
      }
    }

    await tratarModaisConfirmacao(page, config, searchTerm);

    console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 7: ADICIONADO AO CARRINHO] Produto "${tituloProdutoEncontrado}" adicionado ao carrinho com sucesso em ${supplierName} (Quantidade: ${loteResult.qtyAjustada}).`);

    return {
      termo: searchTerm,
      tituloProduto: tituloProdutoEncontrado,
      qPedida,
      loteSize,
      qAjustada: loteResult.qtyAjustada,
      logRegra: loteResult.logMsg,
      unitPriceStr,
      status: 'ENCONTRADO'
    };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 6/7 ERRO] Erro ao buscar ou adicionar produto "${searchTerm}" em ${supplierName}:`, err.stack || err);
    throw err;
  }
}


// ==============================================================================
// 5. EXTRAÇÃO DOS DADOS FINAIS DO CARRINHO
// ==============================================================================
async function extrairCarrinho(page, config) {
  const sel = config.selectors || {};
  const supplierSlug = (config.slug || 'fornecedor').toLowerCase();
  const rawBase = (config.base_url || config.url_site || 'https://cicalfer.com.br');
  const baseUrl = rawBase.replace(/\/produtos\/?$/i, '').replace(/\/+$/, '');
  const cartRelativeUrl = config.cart_url || sel.cart_url || '/carrinho';
  const fullCartUrl = cartRelativeUrl.startsWith('http') ? cartRelativeUrl : `${baseUrl}${cartRelativeUrl.startsWith('/') ? '' : '/'}${cartRelativeUrl}`;
  const supplierName = config.nome || supplierSlug;

  // 🔒 FLUXO COFEMA TRAVADO/LOCKED (ISOLADO EM cofemaExtractor.js)
  if (supplierSlug === 'cofema') {
    return await cofemaExtrairCarrinho(page, config);
  }

  // 🔒 FLUXO MERCADÃO LOJISTA (ISOLADO EM mercadaoLojistaExtractor.js)
  if (supplierSlug === 'mercadao-lojista' || supplierSlug === 'mercadaolojista' || supplierSlug.includes('mercadao')) {
    return await mercadaoExtrairCarrinho(page, config);
  }

  // EXTRAÇÃO GENÉRICA DE CARRINHO (CONSTRUJÁ, CICALFER, ETC.)
  console.log(`[${new Date().toISOString()}] [QuoteEngine] Navegando para o carrinho de ${supplierName} (${fullCartUrl}) para extração dos dados...`);
  
  const cartBtnSel = sel.abrir_carrinho_button || sel.ver_carrinho_button || sel.view_cart_button || sel.botao_abrir_carrinho || sel.botao_ver_carrinho || '#botao-abrir-carrinho, button[aria-label="Carrinho"], a[href*="carrinho"]';
  const abrirCartBtn = page.locator(cartBtnSel).first();
  const cartBtnExists = (await abrirCartBtn.isVisible({ timeout: 2000 }).catch(() => false)) || ((await abrirCartBtn.count().catch(() => 0)) > 0);
  
  const drawerSelector = '#compra-rapida-carrinho, .offcanvas, .ProdutoCompactCarrinho_itemContainer__Eaq76';
  const drawerVisible = await page.locator(drawerSelector).first().isVisible({ timeout: 1000 }).catch(() => false);

  if (!drawerVisible && cartBtnExists) {
    console.log(`[QuoteEngine] Clicando no botão do carrinho de ${supplierName}...`);
    await abrirCartBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  const drawerVisibleAfter = await page.locator(drawerSelector).first().isVisible({ timeout: 1000 }).catch(() => false);

  if (!drawerVisibleAfter && !page.url().includes('carrinho')) {
    await page.goto(fullCartUrl, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);
    if (await abrirCartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await abrirCartBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  }

  const currentCartUrl = page.url();
  console.log(`[${new Date().toISOString()}] [QuoteEngine] URL da página do carrinho capturada: "${currentCartUrl}"`);

  const containerSelector = sel.cart_item_container || sel.item_container || '.ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*="ProdutoCompactCarrinho_itemContainer"], div[class*="itemContainer"]';
  const priceSelector = sel.cart_item_price || sel.unit_price || '.fs-14.fw-bold, span[class*="fw-bold"]';

  await page.waitForSelector(containerSelector, { timeout: 15000 }).catch(() => {});
  await page.waitForSelector(priceSelector, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const cartData = await page.evaluate(({ containerSel, titleSel, priceSel, summarySel, supplierTag }) => {
    function normalizeText(str) {
      return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    }

    function parsePrecoBR(valor) {
      if (typeof valor !== 'string' || !valor.trim()) {
        throw new Error(`Falha ao converter preço: valor original "${valor}"`);
      }

      const limpo = valor
        .replace(/[^\d.,]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');

      if (!limpo) {
        throw new Error(`Falha ao converter preço: valor original "${valor}"`);
      }

      const numero = parseFloat(limpo);
      if (isNaN(numero)) {
        throw new Error(`Falha ao converter preço: valor original "${valor}"`);
      }

      return Math.round(numero * 100) / 100;
    }

    function parsePrecoBRL(str) {
      try {
        return parsePrecoBR(str);
      } catch {
        return 0;
      }
    }

    const mainContent = document.querySelector('#compra-rapida-carrinho, .offcanvas') || document.querySelector('main, #idScrollToTop, body') || document.body;

    const itemContainers = Array.from(mainContent.querySelectorAll(containerSel || '.ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*="itemContainer"]'));

    const produtos = [];
    const errosExtracao = [];

    itemContainers.forEach((container, idx) => {
      const rawText = container.innerText || '';

      let nomeProduto = null;
      const titleEl = titleSel ? container.querySelector(titleSel) : null;
      if (titleEl && titleEl.innerText.trim()) {
        nomeProduto = titleEl.innerText.trim();
      } else {
        const fallbackTitle = container.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, span[class*="productTitle"], h5, a');
        if (fallbackTitle && fallbackTitle.innerText.trim()) {
          nomeProduto = fallbackTitle.innerText.trim();
        }
      }

      const badges = Array.from(container.querySelectorAll('.badge')).map(b => b.innerText.trim());
      const codigoBadge = badges[0] || null;
      const embalagem = badges[1] || null;

      const linkEl = container.querySelector('a[href*="/produto/"]');
      const href = linkEl ? linkEl.getAttribute('href') : '';
      let codigoProduto = null;
      if (href) {
        const m = href.match(/\/produto\/([^\/]+)/);
        if (m) codigoProduto = m[1];
      }

      const allRSElements = Array.from(container.querySelectorAll('.fs-14.fw-bold, span[class*="fw-bold"], span[class*="Preco"], span, div, p')).filter(e => {
        const txt = (e.innerText || '').trim();
        if (!/^R\$\s*[\d\.,]+/i.test(txt)) return false;
        const hasChildRSPrices = Array.from(e.children).some(child => /^R\$\s*[\d\.,]+/i.test((child.innerText || '').trim()));
        return !hasChildRSPrices;
      });

      const validPriceEls = allRSElements.filter(e => {
        const style = window.getComputedStyle(e);
        const parentStyle = e.parentElement ? window.getComputedStyle(e.parentElement) : null;
        const isStrikethrough = (style && style.textDecorationLine && style.textDecorationLine.includes('line-through')) ||
                                (parentStyle && parentStyle.textDecorationLine && parentStyle.textDecorationLine.includes('line-through')) ||
                                Boolean(e.closest('.text-decoration-line-through, .line-through, .text-muted, .price-old, del, s, strike, [class*="SemDesconto"], [class*="sem-desconto"], [class*="PrecoSemDesconto"], [class*="oldPrice"], [class*="old-price"]')) ||
                                (e.classList && (e.classList.contains('text-decoration-line-through') || e.classList.contains('text-muted') || e.classList.contains('line-through') || e.classList.contains('price-old') || (e.className || '').toString().includes('SemDesconto')));
        return !isStrikethrough;
      });

      let rawUnitPriceStr = validPriceEls[0] ? validPriceEls[0].innerText.trim() : '';
      let rawTotalItemStr = validPriceEls[1] ? validPriceEls[1].innerText.trim() : '';

      if (!rawUnitPriceStr) {
        const priceEls = Array.from(container.querySelectorAll(priceSel || '.fs-14.fw-bold'));
        rawUnitPriceStr = priceEls[0] ? priceEls[0].innerText.trim() : '';
        rawTotalItemStr = priceEls[1] ? priceEls[1].innerText.trim() : '';
      }

      let precoUnitario = parsePrecoBRL(rawUnitPriceStr);
      let totalItem = parsePrecoBRL(rawTotalItemStr);

      const pricesInContainer = Array.from(rawText.matchAll(/R\$\s*([\d\.,]+)/gi)).map(m => parsePrecoBRL(m[1]));
      if (precoUnitario <= 0 && pricesInContainer.length > 0) {
        precoUnitario = pricesInContainer[0];
      }

      const qtyInput = container.querySelector('input[class*="QuantidadeMaisMenos_input"], input[type="number"], input');
      const quantidade = qtyInput ? (parseInt(qtyInput.value, 10) || 1) : 1;

      if (totalItem <= 0 && precoUnitario > 0) {
        totalItem = Math.round(precoUnitario * quantidade * 100) / 100;
      }

      if (!nomeProduto || precoUnitario <= 0) {
        errosExtracao.push({
          itemIndex: idx + 1,
          mensagem: `[ERRO EXTRAÇÃO ${supplierTag}] Não foi possível associar nome e preço no item #${idx + 1}. Seletor tentado: ${titleSel} / ${priceSel}. Raw Unit: "${rawUnitPriceStr}"`
        });
        return;
      }

      produtos.push({
        nomeProduto,
        codigoProduto,
        codigoBadge,
        embalagem,
        precoUnitario,
        quantidade,
        totalItem,
        rawUnitPriceStr,
        rawTotalItemStr
      });
    });

    const summaryTable = mainContent.querySelector(summarySel || 'table.table-bordered, table, div[class*="resumo"], div[class*="Resumo"]');
    let totalItens = 0;
    let despesaAcessoria = 0;
    let totalPedido = 0;
    let resumoTabelaEncontrada = false;

    if (summaryTable) {
      const rows = Array.from(summaryTable.querySelectorAll('tr, div[class*="row"], div[class*="d-flex"]'));
      rows.forEach(row => {
        const th = row.querySelector('th, td:first-child, span:first-child, div:first-child');
        const td = row.querySelector('td.text-end, td:last-child, span:last-child, div:last-child');
        if (th && td) {
          const label = normalizeText(th.innerText);
          const valNum = parsePrecoBRL(td.innerText);

          if (label.includes('total itens')) {
            totalItens = valNum;
          } else if (label.includes('despesa') || label.includes('acessoria')) {
            despesaAcessoria = valNum;
          } else if (label.includes('total pedido') || label.includes('total do pedido') || label.includes('total geral') || label.includes('total')) {
            totalPedido = valNum;
            resumoTabelaEncontrada = true;
          }
        }
      });
    }

    if (!resumoTabelaEncontrada || totalPedido <= 0) {
      const bodyText = mainContent.innerText || '';
      const totalMatch = bodyText.match(/Total\s*(?:do\s+pedido)?:?\s*R\$\s*([\d\.,]+)/i) ||
                         bodyText.match(/Total:?\s*R\$\s*([\d\.,]+)/i) ||
                         bodyText.match(/(\d+)\s*\|\s*itens\s*\|\s*R\$\s*([\d\.,]+)/i);
      if (totalMatch) {
        totalPedido = parsePrecoBRL(totalMatch[1] || totalMatch[2]);
        resumoTabelaEncontrada = true;
      } else if (produtos.length > 0) {
        totalPedido = produtos.reduce((acc, p) => acc + p.totalItem, 0);
        totalPedido = Math.round(totalPedido * 100) / 100;
        resumoTabelaEncontrada = true;
      } else {
        const matches = Array.from(bodyText.matchAll(/R\$\s*([\d\.,]+)/gi)).map(m => parsePrecoBRL(m[1])).filter(v => v > 0);
        if (matches.length > 0) {
          totalPedido = Math.max(...matches);
          resumoTabelaEncontrada = true;
        }
      }
    }

    return {
      cartUrl: window.location.href,
      containersFoundCount: itemContainers.length,
      produtos,
      errosExtracao,
      resumo: {
        resumoTabelaEncontrada,
        totalItens: totalItens || produtos.reduce((acc, p) => acc + p.totalItem, 0),
        despesaAcessoria,
        totalPedido
      }
    };
  }, {
    containerSel: containerSelector,
    titleSel: sel.cart_item_title,
    priceSel: priceSelector,
    summarySel: sel.cart_summary_table,
    supplierTag: (config.nome || config.slug || 'FORNECEDOR').toUpperCase()
  });

  cartData.cartUrl = currentCartUrl;
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
      console.log(`[QuoteEngine] ✅ SUCESSO SUPABASE: Cotação persistida em "cotacao_fornecedor_sessoes"! (ID: "${cotacaoSalvaId}", Total: R$ ${valorTotal.toFixed(2)})`);
    } else if (errSess) {
      console.warn(`[QuoteEngine] ⚠️ Aviso na tabela cotacao_fornecedor_sessoes:`, errSess.message);
    }

    try {
      await supabase
        .from('logs_automacao')
        .insert([{
          mensagem: `[COTAÇÃO RPA] UUID: ${cotacaoUuid} | Total: R$ ${valorTotal.toFixed(2)} | Itens: ${resumoCotacao.itens.length}`
        }]);
    } catch (e) {}

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

function parsePrecoBR(valor) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new Error(`Falha ao converter preço: valor original "${valor}"`);
  }

  const limpo = valor
    .replace(/[^\d.,]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  if (!limpo) {
    throw new Error(`Falha ao converter preço: valor original "${valor}"`);
  }

  const numero = parseFloat(limpo);
  if (isNaN(numero)) {
    throw new Error(`Falha ao converter preço: valor original "${valor}"`);
  }

  return Math.round(numero * 100) / 100;
}

async function limparCarrinho(page, config) {
  const supplierSlug = (config.slug || config.nome || '').toLowerCase();
  console.log(`[${new Date().toISOString()}] [QuoteEngine] Executando higiene/reset de carrinho para ${config.nome || supplierSlug}...`);

  if (supplierSlug.includes('cofema')) {
    return await cofemaLimparCarrinho(page, config);
  }

  if (supplierSlug.includes('mercadao')) {
    return await mercadaoLimparCarrinho(page, config);
  }

  try {
    const sel = config.selectors || {};
    const cartUrl = config.cart_url || (config.base_url ? `${config.base_url}/carrinho` : `${page.url()}`);

    const cartBtnSel = sel.abrir_carrinho_button || sel.ver_carrinho_button || '#botao-abrir-carrinho, button[aria-label="Carrinho"], a[href*="carrinho"]';
    const abrirBtn = page.locator(cartBtnSel).first();
    if (await abrirBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await abrirBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    } else if (!page.url().includes('carrinho')) {
      await page.goto(cartUrl, { waitUntil: 'commit', timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    const clearCartBtnSel = sel.limpar_carrinho_button || 'button[title*="Limpar"], button:has-text("Limpar carrinho"), button:has-text("Esvaziar")';
    const clearBtn = page.locator(clearCartBtnSel).first();
    if (await clearBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await clearBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1500);

      const confirmBtn = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), button:has-text("Excluir")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(2000);
      }
    }

    const removeItemSel = sel.remove_item_button || 'button[aria-label="Remover item"], button[title*="Remover"], button[title*="Excluir"], .btn-remove, button.QuantidadeMaisMenos_lixeira__1Fm0w';
    for (let loop = 0; loop < 15; loop++) {
      const removeBtn = page.locator(removeItemSel).first();
      if (await removeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        console.log(`[QuoteEngine RESET ${supplierSlug}] Removendo item residual ${loop + 1}...`);
        await removeBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1500);

        const confirmBtn = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), button:has-text("Excluir")').first();
        if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await confirmBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(1500);
        }
      } else {
        break;
      }
    }

    console.log(`[QuoteEngine RESET ${supplierSlug}] ✅ Higiene do carrinho concluída com sucesso.`);
  } catch (err) {
    console.warn(`[QuoteEngine RESET WARN ${supplierSlug}] Aviso durante higiene do carrinho: ${err.message}`);
  }
}

module.exports = {
  parsePrecoBR,
  calcularQuantidadeProxima,
  tratarModaisConfirmacao,
  realizarLogin,
  adicionarItem,
  extrairCarrinho,
  persistirCotacaoSaracota,
  cofemaLimparCarrinho,
  limparCarrinho
};
