const { chromium } = require('playwright');
const { db } = require('../lib/db/client');
const quoteEngine = require('../core/services/supplier-quote-engine');

async function main() {
  console.log('🚀 [TESTE DE EXTRAÇÃO CONSTRUJÁ - 4 CENÁRIOS COM QUOTEENGINE.ADICIONARITEM]');

  const construjaId = 'a1684c4d-d896-4ba9-a591-cda455c5ffe2';
  const fornDbRecord = await db.fornecedores.getById(construjaId);
  const selObj = (fornDbRecord?.seletores as any)?.selectors || fornDbRecord?.seletores || {};

  const activeConfig = {
    nome: 'Construjá',
    slug: 'construja',
    url_site: 'https://www.construja.com.br/produtos',
    base_url: 'https://www.construja.com.br',
    login_url: 'https://www.construja.com.br/produtos',
    cart_url: 'https://www.construja.com.br/produtos',
    selectors: selObj,
    compra_rapida: (fornDbRecord?.seletores as any)?.compra_rapida,
    regras_negocio: (fornDbRecord?.seletores as any)?.regras_negocio,
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // 1. Login
    console.log('\n--- 1. LOGIN ---');
    await quoteEngine.realizarLogin(page, activeConfig, { user: 'comercialsantana@gmail.com', pass: '53597' });

    // 2. Adicionar Item 1 (Sem promoção, 1x): QUARTZOLIT ADITIVO 18L
    console.log('\n--- CENÁRIO 1: PRODUTO SEM PROMOÇÃO (1x) ---');
    await quoteEngine.adicionarItem(page, activeConfig, { termo: 'QUARTZOLIT ADITIVO PLASTIFICANTE 18L', quantidade: 1, itemIndex: 1 });

    // 3. Adicionar Item 2 (Sem promoção, Nx = 3x): FORTLEV 1000L
    console.log('\n--- CENÁRIO 2: PRODUTO SEM PROMOÇÃO (3x) ---');
    await quoteEngine.adicionarItem(page, activeConfig, { termo: 'FORTLEV CX DAGUA TAMPA 1000L', quantidade: 3, itemIndex: 2 });

    // 4. Adicionar Item 3 (COM Oferta do Dia / Promoção, 12x): VEDALIT 900ML
    console.log('\n--- CENÁRIO 3: PRODUTO COM OFERTA DO DIA / PROMOÇÃO (12x) ---');
    await quoteEngine.adicionarItem(page, activeConfig, { termo: 'VEDACIT VEDALIT 900ML', quantidade: 12, itemIndex: 3 });

    // 5. Abrir Carrinho e Extrair os 4 Cenários
    console.log('\n--- CENÁRIO 4: ABRINDO GAVETA DO CARRINHO E EXECUTANDO EXTRAÇÃO ---');
    const openCartBtn = page.locator('#botao-abrir-carrinho').first();
    if (await openCartBtn.isVisible().catch(() => false)) {
      await openCartBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(3000);
    }

    const evalCode = `
      (() => {
        function parsePrecoBR(valor) {
          if (typeof valor !== 'string' || !valor.trim()) return 0;
          const limpo = valor.replace(/[^\\d.,]/g, '').replace(/\\./g, '').replace(',', '.');
          const num = parseFloat(limpo);
          return isNaN(num) ? 0 : Math.round(num * 100) / 100;
        }

        const mainContent = document.querySelector('#compra-rapida-carrinho, .offcanvas, body') || document.body;
        const containers = Array.from(mainContent.querySelectorAll('.ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*="ProdutoCompactCarrinho_itemContainer"], div[class*="itemContainer"]'));

        const itensExtraidos = containers.map((c, idx) => {
          const titleEl = c.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, span[class*="productTitle"], a[href*="/produto/"]');
          const nomeProduto = titleEl ? titleEl.innerText.trim() : 'PRODUTO_SEM_NOME';

          // 1. Obter todos os elementos dentro do container com texto contendo "R$"
          const allRSElements = Array.from(c.querySelectorAll('*')).filter(e => {
            const txt = (e.innerText || '').trim();
            return e.children.length === 0 && txt.includes('R$');
          });

          // 2. Filtrar elementos de preço riscado / promocional antigo
          const validPriceEls = allRSElements.filter(e => {
            const style = window.getComputedStyle(e);
            const parentStyle = e.parentElement ? window.getComputedStyle(e.parentElement) : null;
            const isStrikethrough = (style && style.textDecorationLine && style.textDecorationLine.includes('line-through')) ||
                                    (parentStyle && parentStyle.textDecorationLine && parentStyle.textDecorationLine.includes('line-through')) ||
                                    e.classList.contains('text-decoration-line-through') ||
                                    e.classList.contains('line-through') ||
                                    e.classList.contains('text-muted') ||
                                    e.classList.contains('price-old') ||
                                    Boolean(e.closest('.text-decoration-line-through, .line-through, del, s, strike, .price-old'));
            return !isStrikethrough;
          });

          const rawUnitPriceStr = validPriceEls[0] ? validPriceEls[0].innerText.trim() : '';
          const rawTotalItemStr = validPriceEls[1] ? validPriceEls[1].innerText.trim() : '';

          let precoUnitario = parsePrecoBR(rawUnitPriceStr);
          let totalItem = parsePrecoBR(rawTotalItemStr);

          // Fallback se validPriceEls não retornou preço
          if (precoUnitario <= 0) {
            const rawText = c.innerText || '';
            const matches = Array.from(rawText.matchAll(/R\\$\\s*([\\d\\.,]+)/gi)).map(m => parsePrecoBR(m[1]));
            if (matches.length > 0) precoUnitario = matches[0];
          }

          const qtyInput = c.querySelector('input.QuantidadeMaisMenos_input__grKxO, input[type="number"], input');
          const quantidade = qtyInput ? (parseInt(qtyInput.value, 10) || 1) : 1;

          if (totalItem <= 0 && precoUnitario > 0) {
            totalItem = Math.round(precoUnitario * quantidade * 100) / 100;
          }

          return {
            itemIdx: idx + 1,
            nomeProduto,
            quantidade,
            rawUnitPriceStr,
            precoUnitario,
            rawTotalItemStr,
            totalItem,
            todosValoresRS: allRSElements.map(e => e.innerText.trim()),
            valoresValidosSemRisco: validPriceEls.map(e => e.innerText.trim())
          };
        });

        // 3. Extrair Total Geral do Carrinho
        const bodyText = document.body.innerText || '';
        let totalPedido = 0;
        let resumoEncontrado = false;

        const totalMatch = bodyText.match(/Total\\s*(?:do\\s+pedido)?:?\\s*R\\$\\s*([\\d\\.,]+)/i) ||
                           bodyText.match(/Total:?\\s*R\\$\\s*([\\d\\.,]+)/i) ||
                           bodyText.match(/(\\d+)\\s*\\|\\s*itens\\s*\\|\\s*R\\$\\s*([\\d\\.,]+)/i);

        if (totalMatch) {
          totalPedido = parsePrecoBR(totalMatch[1] || totalMatch[2]);
          resumoEncontrado = true;
        }

        if (totalPedido <= 0 && itensExtraidos.length > 0) {
          totalPedido = itensExtraidos.reduce((acc, item) => acc + item.totalItem, 0);
          totalPedido = Math.round(totalPedido * 100) / 100;
          if (totalPedido > 0) resumoEncontrado = true;
        }

        return {
          totalItensCount: itensExtraidos.length,
          itensExtraidos,
          totalPedido,
          resumoEncontrado
        };
      })()
    `;

    const extractionResult = await page.evaluate(evalCode);

    console.log('\n=== RESULTADO DOS 4 CENÁRIOS ===');
    console.log(JSON.stringify(extractionResult, null, 2));

  } catch (err) {
    console.error('❌ Erro durante execução do teste:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
