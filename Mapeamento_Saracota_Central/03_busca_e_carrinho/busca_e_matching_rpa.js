/**
 * ETAPA 4: BUSCA, MATCHING SEMÂNTICO E REGRA DE LOTE
 * 
 * Trechos extraídos de core/services/supplier-quote-engine/index.js
 * Executa a navegação de busca por produto, validação de correlação semântica,
 * cálculo de lote mais próximo e adição das quantidades ao carrinho.
 */

// 1. REGRA DE ARREDONDAMENTO POR PROXIMIDADE DE LOTE
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

// 2. VALIDAÇÃO DE CORRELAÇÃO SEMÂNTICA ENTRE BUSCA E RESULTADO
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

// 3. TRATAMENTO DE MODAIS DE CONFIRMAÇÃO
async function tratarModaisConfirmacao(page, config, actionLabel = 'item') {
  const modalSel = config.selectors.modal_confirm_alteration;
  const confirmBtnSel = config.selectors.modal_confirm_button;

  if (await page.locator(modalSel).first().isVisible({ timeout: 2500 }).catch(() => false)) {
    console.log(`[QuoteEngine] MODAL DETECTADO ("Confirmar alteração") para "${actionLabel}". Clicando em Confirmar...`);
    const confirmBtn = page.locator(confirmBtnSel).first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click({ force: true });
      await page.waitForTimeout(2000);
      return true;
    }
  }
  return false;
}

// 4. FUNÇÃO PRINCIPAL DE BUSCA E ADIÇÃO AO CARRINHO
async function adicionarItem(page, config, itemInfo) {
  const sel = config.selectors;
  const rawTerm = itemInfo.termo || itemInfo.ref || '';
  
  // Limpeza de prefixos de quantidade do termo de busca
  const searchTerm = rawTerm
    .replace(/^\s*\d+\s*(?:x|uni|un|pçs|pcs|cx|caixa|m|metro|kg)?\s*/i, '')
    .replace(/^(?:x|uni|un|pçs|pcs)\s+/i, '')
    .replace(/(\d+)\.(\d+)/g, '$1,$2')
    .replace(/\bmm\b/gi, '')
    .trim() || rawTerm.trim();

  const qPedida = itemInfo.quantidade;

  console.log(`[RPA BUSCA] Termo: "${searchTerm}" | Quantidade Solicitada: ${qPedida}`);

  try {
    // Navegar diretamente para a URL de busca do produto
    const searchUrl = `https://cicalfer.com.br/produtos?pagina=1&busca=${encodeURIComponent(searchTerm)}`;
    await page.goto(searchUrl, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(2500);

    // Extrair o título do primeiro produto retornado no grid
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

    // Validar se há correlação semântica entre a busca e o título encontrado
    const correlacaoValida = validarCorrelacaoSemantica(searchTerm, tituloProdutoEncontrado);
    if (!correlacaoValida) {
      console.error(`❌ Sem correlação semântica entre busca "${searchTerm}" e resultado "${tituloProdutoEncontrado}".`);
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

    // Identificar tamanho de lote ("VENDE DE X EM X" ou "EMB: X")
    let cardText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    let loteSize = 1;
    const vendeDeMatch = cardText.match(/VENDE DE\s*(\d+)\s*EM\s*\d+/i);
    const embMatch = cardText.match(/EMB:\s*(\d+)/i);

    if (vendeDeMatch) {
      loteSize = parseInt(vendeDeMatch[1], 10);
    } else if (embMatch) {
      loteSize = parseInt(embMatch[1], 10);
    }

    // Calcular quantidade ajustada pela regra de proximidade
    const loteResult = calcularQuantidadeProxima(qPedida, loteSize);

    // Preencher campo de quantidade
    const qtyInput = page.locator(sel.quantity_input).first();
    if (await qtyInput.isVisible({ timeout: 4000 }).catch(() => false)) {
      await qtyInput.scrollIntoViewIfNeeded().catch(() => {});
      await qtyInput.focus().catch(() => {});
      await qtyInput.fill(String(loteResult.qtyAjustada)).catch(() => {});
      
      // Dispatch de eventos DOM no React
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

      // Clicar em Comprar/Adicionar
      const btnBuy = page.locator('button:has-text("Comprar"), button:has-text("Adicionar"), button.btn-adicionar, button[type="submit"]').first();
      if (await btnBuy.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btnBuy.click({ force: true }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }

    // Tratar modais de confirmação se surgirem
    await tratarModaisConfirmacao(page, config, searchTerm);

    return {
      termo: searchTerm,
      tituloProduto: tituloProdutoEncontrado,
      qPedida,
      loteSize,
      qAjustada: loteResult.qtyAjustada,
      logRegra: loteResult.logMsg,
      status: 'ENCONTRADO'
    };
  } catch (err) {
    console.error(`Erro ao buscar/adicionar produto "${searchTerm}":`, err);
    throw err;
  }
}

module.exports = {
  calcularQuantidadeProxima,
  validarCorrelacaoSemantica,
  tratarModaisConfirmacao,
  adicionarItem
};
