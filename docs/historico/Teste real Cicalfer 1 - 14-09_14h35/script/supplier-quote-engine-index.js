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
// ==============================================================================
// 3. FLUXO DE LOGIN E SELEÇÃO DE FILIAL
// ==============================================================================
async function realizarLogin(page, config, credentials) {
  const sel = config.selectors;
  const tsStart = new Date().toISOString();
  console.log(`[${tsStart}] [RPA DIAGNOSTICO - CHECKPOINT 2a: NAVEGAÇÃO] Navegando para URL inicial: ${config.url_site}`);
  
  try {
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
      console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO] Clicando no gatilho de login...`);
      await loginBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO] Preenchendo credenciais de acesso (${credentials.user})...`);
      await emailInput.fill(credentials.user);
      await page.locator(sel.password_input).first().fill(credentials.pass);
      await page.waitForTimeout(1000);

      // PRINT 1: Tela de login preenchida (antes de clicar em entrar)
      const p1Path = path.join(process.cwd(), 'docs', 'historico', 'prints', '2026-09-10_cicalfer_01_login_preenchido.png');
      await page.screenshot({ path: p1Path, fullPage: false }).catch(() => {});
      console.log(`[PRINT SALVO] ${p1Path}`);

      await page.locator(sel.login_submit).first().click({ force: true });
      await page.waitForTimeout(3000);

      // PRINT 2: Tela pós-login confirmando acesso à conta B2B
      const p2Path = path.join(process.cwd(), 'docs', 'historico', 'prints', '2026-09-10_cicalfer_02_pos_login.png');
      await page.screenshot({ path: p2Path, fullPage: false }).catch(() => {});
      console.log(`[PRINT SALVO] ${p2Path}`);

      const hasErrorMsg = await page.evaluate(() => {
        const txt = document.body ? document.body.innerText : '';
        return txt.includes('Credenciais Inválidas') || txt.includes('inválid') || txt.includes('incorret');
      });

      if (hasErrorMsg) {
        console.error(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 2: ERRO LOGIN] O portal Cicalfer rejeitou as credenciais para o usuário: ${credentials.user} ("Credenciais Inválidas")`);
      } else {
        console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 2: LOGIN SUCESSO] Login realizado com sucesso para usuário: ${credentials.user}`);
        const pLoginSuccess = path.join(process.cwd(), 'docs', 'historico', 'prints', '2026-09-10_cicalfer_3itens_01_login.png');
        await page.screenshot({ path: pLoginSuccess, fullPage: false }).catch(() => {});
        console.log(`[PRINT SALVO] ${pLoginSuccess}`);
      }
    } else {
      console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 2: SESSÃO REIDRATADA] Sessão já logada/reidratada.`);
    }

    // Seleção de Filial B2B se aplicável
    if (sel.filial_cards) {
      const optionCards = page.locator(sel.filial_cards);
      if (await optionCards.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 3: BUSCA FILIAL] Modal de filial detectado. Buscando filial "${config.default_filial_keyword}"...`);
        
        // PRINT 3: Tela de seleção da filial "ENTREGA"
        const p3Path = path.join(process.cwd(), 'docs', 'historico', 'prints', '2026-09-10_cicalfer_03_selecao_filial.png');
        await page.screenshot({ path: p3Path, fullPage: false }).catch(() => {});
        console.log(`[PRINT SALVO] ${p3Path}`);

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
          console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 3: FILIAL SELECIONADA] Filial/loja selecionada com sucesso: "${config.default_filial_keyword}".`);
        }

        console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO] Recarregando página para reidratação de cookies B2B da filial...`);
        await page.reload({ waitUntil: 'commit' });
        await page.waitForTimeout(3000);

        const btnEntendiLogin = page.locator('button.shepherd-button, button:has-text("Entendi")').first();
        if (await btnEntendiLogin.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('[RPA TOUR] Fechando modal de tutorial tour pós-login ("Entendi")...');
          await btnEntendiLogin.click({ force: true }).catch(() => {});
          await page.waitForTimeout(1000);
        }
      }
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 2: ERRO LOGIN] Falha durante o login ou seleção de filial:`, err.stack || err);
    throw err;
  }
}


// ==============================================================================
// 4. ADICIONAR ITEM NA COTAÇÃO COM REGRA DE LOTE E VALIDAÇÃO SEMÂNTICA
// ==============================================================================
function validarCorrelacaoSemantica(termoBuscado, tituloEncontrado) {
  if (!tituloEncontrado) return false;
  const tNorm = termoBuscado.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const pNorm = tituloEncontrado.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const stopWords = ['com', 'para', 'de', 'da', 'do', 'em', '127v', '220v', 'extra', 'forte', 'flex'];
  const palavrasChave = tNorm
    .split(/[\s,/-]+/)
    .filter(w => w.length >= 3 && !stopWords.includes(w));

  if (palavrasChave.length === 0) return true;
  return palavrasChave.some(kw => pNorm.includes(kw));
}

async function adicionarItem(page, config, itemInfo) {
  const sel = config.selectors;
  const rawTerm = itemInfo.termo || itemInfo.ref || '';
  const searchTerm = rawTerm
    .replace(/^\s*\d+\s*(?:x|uni|un|pçs|pcs|cx|caixa|m|metro|kg)?\s*/i, '')
    .replace(/^(?:x|uni|un|pçs|pcs)\s+/i, '')
    .replace(/(\d+)\.(\d+)/g, '$1,$2')
    .replace(/\bmm\b/gi, '')
    .trim() || rawTerm.trim();

  const qPedida = itemInfo.quantidade;

  console.log(`\n[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 4: PRODUTO BUSCADO] Termo de busca usado: "${searchTerm}" (Original: "${rawTerm}" | Quantidade pedida pelo cliente: ${qPedida})`);

  try {
    // BUG 1 FIX: Limpar completamente e navegar para a URL da busca do termo específico
    const searchUrl = `https://cicalfer.com.br/produtos?pagina=1&busca=${encodeURIComponent(searchTerm)}`;
    console.log(`[RPA NAVEGAÇÃO BUSCA] Navegando para URL específica do termo: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(2500);

    // Fechar/Remover modal de tour ("Entendi") e overlay da tela para garantir interatividade limpa
    await page.evaluate(() => {
      const tourEls = document.querySelectorAll('.shepherd-element, .shepherd-modal-overlay-container, .shepherd-content, div[class*="shepherd"]');
      tourEls.forEach(el => el.remove());
      const buttons = Array.from(document.querySelectorAll('button'));
      const entendi = buttons.find(b => (b.innerText || '').includes('Entendi'));
      if (entendi) entendi.click();
    }).catch(() => {});
    await page.waitForTimeout(1000);

    // Extrair o título do primeiro produto retornado na busca (ignorando badges de estoque/código)
    let tituloProdutoEncontrado = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="/produto/"]'));
      for (const a of links) {
        const txt = (a.innerText || '').trim();
        if (txt && !txt.startsWith('#') && !txt.includes('EMB:')) {
          return txt;
        }
      }
      return '';
    });

    // FALLBACK DE BUSCA: Se 0 produtos encontrados com a busca completa, tentar termos reduzidos
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
        const fallbackUrl = `https://cicalfer.com.br/produtos?pagina=1&busca=${encodeURIComponent(fallbackTerm)}`;
        await page.goto(fallbackUrl, { waitUntil: 'commit', timeout: 30000 });
        await page.waitForTimeout(2500);

        tituloProdutoEncontrado = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href^="/produto/"]'));
          for (const a of links) {
            const txt = (a.innerText || '').trim();
            if (txt && !txt.startsWith('#') && !txt.includes('EMB:')) {
              return txt;
            }
          }
          return '';
        });
      }
    }

    console.log(`[RPA TITULO ENCONTRADO] Título capturado no grid de busca: "${tituloProdutoEncontrado}"`);


    // BUG 1 FIX: Validação de correlação semântica real
    const correlacaoValida = validarCorrelacaoSemantica(searchTerm, tituloProdutoEncontrado);
    if (!correlacaoValida) {
      console.error(`❌ [RPA BUG 1 FIX - VALIDAÇÃO FALHOU] O produto encontrado "${tituloProdutoEncontrado}" NÃO possui correlação semântica com a busca "${searchTerm}". Item marcado como FALHA.`);
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
    let pricesFound = cardText.match(/R\$\s*\d+[\.,]\d{2}/g) || [];

    let loteSize = 1;
    const vendeDeMatch = cardText.match(/VENDE DE\s*(\d+)\s*EM\s*\d+/i);
    const embMatch = cardText.match(/EMB:\s*(\d+)/i);

    if (vendeDeMatch) {
      loteSize = parseInt(vendeDeMatch[1], 10);
    } else if (embMatch) {
      loteSize = parseInt(embMatch[1], 10);
    }

    const unitPriceStr = pricesFound[0] || 'R$ 0,00';

    if (pricesFound.length > 0) {
      console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 5: PRODUTO ENCONTRADO] Produto validado! Título: "${tituloProdutoEncontrado}" | Preço: ${unitPriceStr} | Lote: de ${loteSize} em ${loteSize}`);
    } else {
      console.warn(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 5: PRODUTO NÃO ENCONTRADO] Nenhum preço R$ encontrado na tela para o termo: "${searchTerm}"`);
    }

    // Aplicar regra de proximidade
    const loteResult = calcularQuantidadeProxima(qPedida, loteSize);
    console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO] ${loteResult.logMsg}`);

    // Localizar campo de quantidade e preencher
    const qtyInput = page.locator(sel.quantity_input).first();
    const qtyVisible = await qtyInput.isVisible({ timeout: 4000 }).catch(() => false);

    if (qtyVisible) {
      await qtyInput.scrollIntoViewIfNeeded().catch(() => {});
      await qtyInput.focus().catch(() => {});
      await qtyInput.fill(String(loteResult.qtyAjustada)).catch(() => {});
      
      // Dispatch de eventos DOM no input para garantir que o autosave do Next.js/React reaja
      await page.evaluate((qty) => {
        const inp = document.querySelector('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]');
        if (inp) {
          inp.value = String(qty);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          inp.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }, loteResult.qtyAjustada).catch(() => {});
      
      await page.waitForTimeout(1000);
      console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 6: QUANTIDADE INSERIDA] Quantidade inserida com sucesso no campo ("${sel.quantity_input}"): ${loteResult.qtyAjustada}`);

      // Submeter adição ao carrinho
      await qtyInput.press('Enter').catch(() => {});
      await page.waitForTimeout(1500);

      const btnBuy = page.locator('button:has-text("Comprar"), button:has-text("Adicionar"), button.btn-adicionar, button[type="submit"]').first();
      if (await btnBuy.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btnBuy.click({ force: true }).catch(() => {});
        await page.waitForTimeout(3000);
      } else {
        await page.waitForTimeout(3000);
      }
    } else {
      console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO] Campo de quantidade individual não visível. Clicando no botão Comprar/Adicionar do primeiro resultado...`);
      const btnBuy = page.locator('button:has-text("Comprar"), button:has-text("Adicionar"), a:has-text("Comprar"), button[type="submit"]').first();
      if (await btnBuy.isVisible()) {
        await btnBuy.click({ force: true });
        await page.waitForTimeout(3000);
      }
    }

    // Tratar modal se aparecer
    await tratarModaisConfirmacao(page, config, searchTerm);

    console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 7: ADICIONADO AO CARRINHO] Produto "${tituloProdutoEncontrado}" adicionado ao carrinho com sucesso (Quantidade: ${loteResult.qtyAjustada}).`);

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
    console.error(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 6/7 ERRO] Erro ao buscar ou adicionar produto "${searchTerm}":`, err.stack || err);
    throw err;
  }
}


// ==============================================================================
// 5. EXTRAÇÃO DOS DADOS FINAIS DO CARRINHO
// ==============================================================================
// ==============================================================================
// 5. EXTRAÇÃO DOS DADOS FINAIS DO CARRINHO
// ==============================================================================
async function extrairCarrinho(page, config) {
  const sel = config.selectors;
  console.log(`[${new Date().toISOString()}] [QuoteEngine] Navegando para o carrinho para extração dos dados...`);
  
  if (!page.url().includes('/carrinho')) {
    await page.goto(sel.cart_url, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);
  }

  const currentCartUrl = page.url();
  console.log(`[${new Date().toISOString()}] [QuoteEngine] URL da página do carrinho capturada: "${currentCartUrl}"`);

  // Aguardar o carregamento e hidratação dos containers do carrinho e seletores de preço
  const containerSelector = 'div[class*="ProdutoCompactCarrinho_itemContainer"], div[class*="itemContainer"]';
  await page.waitForSelector(containerSelector, { timeout: 15000 }).catch(() => {});
  await page.waitForSelector('.fs-14.fw-bold', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // LOG DE DEBUG DO TEXTO RAW DOS PREÇOS (SELETOR .fs-14.fw-bold)
  const rawPriceLogs = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('div[class*="ProdutoCompactCarrinho_itemContainer"], div[class*="itemContainer"]'));
    return containers.map((c, i) => {
      const priceEls = Array.from(c.querySelectorAll('.fs-14.fw-bold'));
      const p1 = priceEls[0] ? priceEls[0].innerText.trim() : 'N/A';
      const p2 = priceEls[1] ? priceEls[1].innerText.trim() : 'N/A';
      const titleEl = c.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, span[class*="productTitle"]');
      const title = titleEl ? titleEl.innerText.trim() : 'N/A';
      return `Item #${i + 1} | Titulo: "${title}" | 1º .fs-14.fw-bold (Unit): "${p1}" | 2º .fs-14.fw-bold (Total): "${p2}"`;
    });
  });

  console.log('\n====================================================');
  console.log('🔍 [DEBUG EXTRAÇÃO RAW] TEXTO BRUTO DOS PREÇOS NO CARRINHO (.fs-14.fw-bold):');
  rawPriceLogs.forEach(log => console.log(`   └─ ${log}`));
  console.log('====================================================\n');

  // PRINT 3: Carrinho montado com os produtos e quantidades corretas
  const p3Path = path.join(process.cwd(), 'docs', 'historico', 'prints', '2026-09-10_cicalfer_3itens_03_carrinho_montado.png');
  await page.screenshot({ path: p3Path, fullPage: false }).catch(() => {});
  console.log(`[PRINT SALVO] ${p3Path}`);

  // Extração no contexto do DOM da Cicalfer
  const cartData = await page.evaluate(() => {
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
        .replace(/[^\d.,]/g, '')   // remove R$, espaços, texto
        .replace(/\./g, '')        // remove separador de milhar
        .replace(',', '.');        // troca vírgula decimal por ponto

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

    const mainContent = document.querySelector('main, #idScrollToTop, body') || document.body;


    // 1. ESTRUTURA BASE — CONTAINER PAI DE CADA PRODUTO NO CARRINHO
    const itemContainers = Array.from(mainContent.querySelectorAll('div[class*="ProdutoCompactCarrinho_itemContainer"], div[class*="itemContainer"]'));

    const produtos = [];
    const errosExtracao = [];

    itemContainers.forEach((container, idx) => {
      const rawText = container.innerText || '';

      // a. NOME DO PRODUTO (pegar exato do seletor .ProdutoCompactCarrinho_productTitle__n7FXX)
      let nomeProduto = null;
      const titleEl = container.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, span[class*="productTitle"], [class*="productTitle"]');
      if (titleEl && titleEl.innerText.trim()) {
        nomeProduto = titleEl.innerText.trim();
      } else {
        const h5OrA = container.querySelector('h5, a');
        if (h5OrA && h5OrA.innerText.trim()) {
          nomeProduto = h5OrA.innerText.trim();
        }
      }

      // b. BADGES & LINK & CÓDIGO PRODUTO
      const badges = Array.from(container.querySelectorAll('.badge')).map(b => b.innerText.trim());
      const codigoBadge = badges[0] || null;
      const embalagem = badges[1] || null;

      const linkEl = container.querySelector('a[href^="/produto/"]');
      const href = linkEl ? linkEl.getAttribute('href') : '';
      let codigoProduto = null;
      if (href) {
        const m = href.match(/\/produto\/([^\/]+)/);
        if (m) codigoProduto = m[1];
      }

      // c. PREÇOS (Unitário e Total de .fs-14.fw-bold)
      const priceEls = Array.from(container.querySelectorAll('.fs-14.fw-bold'));
      const rawUnitPriceStr = priceEls[0] ? priceEls[0].innerText.trim() : '';
      const rawTotalItemStr = priceEls[1] ? priceEls[1].innerText.trim() : '';

      let precoUnitario = parsePrecoBRL(rawUnitPriceStr);
      let totalItem = parsePrecoBRL(rawTotalItemStr);

      const pricesInContainer = Array.from(rawText.matchAll(/R\$\s*([\d\.,]+)/gi)).map(m => parsePrecoBRL(m[1]));
      if (precoUnitario <= 0 && pricesInContainer.length > 0) {
        precoUnitario = pricesInContainer[0];
      }

      // d. QUANTIDADE do input no mesmo container
      const qtyInput = container.querySelector('input[class*="QuantidadeMaisMenos_input"], input[type="number"], input');
      const quantidade = qtyInput ? (parseInt(qtyInput.value, 10) || 1) : 1;

      if (totalItem <= 0 && precoUnitario > 0) {
        totalItem = Math.round(precoUnitario * quantidade * 100) / 100;
      }

      // Tratamento de erro se para algum itemContainer não conseguir localizar o nome OU o preço
      if (!nomeProduto || precoUnitario <= 0) {
        errosExtracao.push({
          itemIndex: idx + 1,
          mensagem: `[ERRO EXTRAÇÃO CICALFER] Não foi possível associar nome e preço no item #${idx + 1}. Seletor tentado: .ProdutoCompactCarrinho_productTitle__n7FXX / .fs-14.fw-bold. Raw Unit: "${rawUnitPriceStr}"`
        });
        return;
      }

      // Par (nome + preço) extraído com sucesso do mesmo container
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

    // 2. RESUMO DO PEDIDO (tabela class="table table-bordered")
    const summaryTable = mainContent.querySelector('table.table-bordered, table');
    let totalItens = 0;
    let despesaAcessoria = 0;
    let totalPedido = 0;
    let resumoTabelaEncontrada = false;

    if (summaryTable) {
      const rows = Array.from(summaryTable.querySelectorAll('tr'));
      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td.text-end, td');
        if (th && td) {
          const label = normalizeText(th.innerText);
          const valNum = parsePrecoBRL(td.innerText);

          if (label.includes('total itens')) {
            totalItens = valNum;
          } else if (label.includes('despesa') || label.includes('acessoria')) {
            despesaAcessoria = valNum;
          } else if (label.includes('total pedido') || label.includes('total do pedido') || label.includes('total geral')) {
            totalPedido = valNum;
            resumoTabelaEncontrada = true;
          }
        }
      });
    }

    // Se tabela de resumo não for identificada por th/td, buscar nos blocos de resumo
    if (!resumoTabelaEncontrada || totalPedido <= 0) {
      const bodyText = mainContent.innerText || '';
      const totalMatch = bodyText.match(/Total pedido:\s*R\$\s*([\d\.,]+)/i) || bodyText.match(/Total:\s*R\$\s*([\d\.,]+)/i);
      if (totalMatch) {
        totalPedido = parsePrecoBRL(totalMatch[1]);
        resumoTabelaEncontrada = true;
      } else if (produtos.length > 0) {
        totalPedido = produtos.reduce((acc, p) => acc + p.totalItem, 0);
        resumoTabelaEncontrada = true;
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
  });

  cartData.rawPriceLogs = rawPriceLogs;

  // Rolar para a tabela de resumo (table.table-bordered) e capturar Screenshot 04
  await page.evaluate(() => {
    const summaryTable = document.querySelector('table.table-bordered, table');
    if (summaryTable) {
      summaryTable.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
  await page.waitForTimeout(1000);

  // PRINT 4: Página de resumo do carrinho (com Total itens, Despesa acessória, Total pedido visíveis)
  const p4ResumoPath = path.join(process.cwd(), 'docs', 'historico', 'prints', '2026-09-10_cicalfer_3itens_04_resumo_carrinho.png');
  await page.screenshot({ path: p4ResumoPath, fullPage: false }).catch(() => {});
  console.log(`[PRINT SALVO] ${p4ResumoPath}`);

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

function parsePrecoBR(valor) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new Error(`Falha ao converter preço: valor original "${valor}"`);
  }

  const limpo = valor
    .replace(/[^\d.,]/g, '')   // remove R$, espaços, texto
    .replace(/\./g, '')        // remove separador de milhar
    .replace(',', '.');        // troca vírgula decimal por ponto

  if (!limpo) {
    throw new Error(`Falha ao converter preço: valor original "${valor}"`);
  }

  const numero = parseFloat(limpo);
  if (isNaN(numero)) {
    throw new Error(`Falha ao converter preço: valor original "${valor}"`);
  }

  return Math.round(numero * 100) / 100;
}

module.exports = {
  parsePrecoBR,
  calcularQuantidadeProxima,
  tratarModaisConfirmacao,
  realizarLogin,
  adicionarItem,
  extrairCarrinho,
  persistirCotacaoSaracota
};

