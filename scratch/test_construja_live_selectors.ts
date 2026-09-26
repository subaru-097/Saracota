const { chromium } = require('playwright');
const { db } = require('../lib/db/client');

async function main() {
  console.log('🔍 [TESTE DE SELETORES AO VIVO - CONSTRUJÁ]');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // 1. Login
    console.log('\n--- 1. LOGIN ---');
    await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'commit' });
    await page.waitForTimeout(3000);

    const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), button:has-text("Entendi")').first();
    if (await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }

    const loginTrigger = page.locator('#botao-login').first();
    if (await loginTrigger.isVisible().catch(() => false)) {
      await loginTrigger.click({ force: true });
      await page.waitForTimeout(1500);
      await page.locator('input[name="email"].form-control').first().fill('comercialsantana@gmail.com');
      await page.locator('input#senha[name="senha"]').first().fill('53597');
      await page.locator('button#btn-entrar').first().click({ force: true });
      await page.waitForTimeout(3500);
    }

    // 2. Adicionar Item 1: 3 FORTLEV 1000L
    console.log('\n--- 2. ADICIONANDO ITEM 1 (3 FORTLEV 1000L) ---');
    await page.goto('https://www.construja.com.br/produtos?pagina=1&busca=FORTLEV', { waitUntil: 'commit' });
    await page.waitForTimeout(3000);

    const btnEntendi = page.locator('button.shepherd-button, button:has-text("Entendi")').first();
    if (await btnEntendi.isVisible().catch(() => false)) {
      await btnEntendi.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    const qtyInput1 = page.locator('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]').first();
    if (await qtyInput1.isVisible().catch(() => false)) {
      await qtyInput1.fill('3');
      await page.waitForTimeout(500);
      await qtyInput1.press('Enter');
      await page.waitForTimeout(1500);
    }

    // 3. Adicionar Item 2: 12 VEDALIT 900ML
    console.log('\n--- 3. ADICIONANDO ITEM 2 (12 VEDALIT 900ML) ---');
    await page.goto('https://www.construja.com.br/produtos?pagina=1&busca=VEDALIT', { waitUntil: 'commit' });
    await page.waitForTimeout(3000);

    const qtyInput2 = page.locator('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]').first();
    if (await qtyInput2.isVisible().catch(() => false)) {
      await qtyInput2.fill('12');
      await page.waitForTimeout(500);
      await qtyInput2.press('Enter');
      await page.waitForTimeout(1500);
    }

    // 4. Abrir Carrinho Offcanvas (#botao-abrir-carrinho)
    console.log('\n--- 4. ABRINDO GAVETA DO CARRINHO ---');
    const openCartBtn = page.locator('#botao-abrir-carrinho').first();
    if (await openCartBtn.isVisible().catch(() => false)) {
      await openCartBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(3000);
    }

    // 5. Inspecionar elementos em tempo real
    console.log('\n--- 5. INSPEÇÃO DE DOM COMPLETA ---');

    const evalCode = `
      (() => {
        function parsePrecoBR(valor) {
          if (typeof valor !== 'string' || !valor.trim()) return 0;
          const limpo = valor.replace(/[^\\d.,]/g, '').replace(/\\./g, '').replace(',', '.');
          const num = parseFloat(limpo);
          return isNaN(num) ? 0 : Math.round(num * 100) / 100;
        }

        const containers = Array.from(document.querySelectorAll('.ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*="itemContainer"]'));

        const containerData = containers.map((c, idx) => {
          const titleEl = c.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, span[class*="productTitle"], a');
          const titleText = titleEl ? titleEl.innerText.trim() : '';

          // 1. Todos os elementos com texto R$ dentro do container
          const allRSElements = Array.from(c.querySelectorAll('*')).filter(e => {
            const txt = (e.innerText || '').trim();
            return e.children.length === 0 && txt.includes('R$');
          }).map(e => {
            const style = window.getComputedStyle(e);
            const parentStyle = e.parentElement ? window.getComputedStyle(e.parentElement) : null;
            const isStrikethrough = style.textDecorationLine.includes('line-through') ||
                                    (parentStyle && parentStyle.textDecorationLine.includes('line-through')) ||
                                    e.classList.contains('text-decoration-line-through') ||
                                    e.classList.contains('line-through') ||
                                    e.classList.contains('text-muted') ||
                                    e.classList.contains('price-old') ||
                                    Boolean(e.closest('.text-decoration-line-through, .line-through, del, s, strike, .price-old'));
            return {
              tag: e.tagName,
              class: e.className,
              text: e.innerText.trim(),
              isStrikethrough: isStrikethrough
            };
          });

          // 2. Aplicar lógica de filtragem
          const validPriceElements = allRSElements.filter(item => !item.isStrikethrough);

          const rawUnitPriceStr = validPriceElements[0] ? validPriceElements[0].text : '';
          const rawTotalItemStr = validPriceElements[1] ? validPriceElements[1].text : '';

          const precoUnitario = parsePrecoBR(rawUnitPriceStr);
          const totalItem = parsePrecoBR(rawTotalItemStr);

          const qtyInput = c.querySelector('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]');
          const quantidade = qtyInput ? (parseInt(qtyInput.value, 10) || 1) : 1;

          return {
            idx,
            titleText,
            quantidade,
            allRSElements,
            validPriceElements,
            rawUnitPriceStr,
            precoUnitario,
            rawTotalItemStr,
            totalItem
          };
        });

        // Inspeção do Resumo / Total Geral do Carrinho
        const offcanvas = document.querySelector('#compra-rapida-carrinho, .offcanvas, [class*="carrinho"], body');
        const offcanvasText = offcanvas ? offcanvas.innerText : '';

        // Procurar por elementos contendo "Total"
        const totalElements = Array.from(document.querySelectorAll('*')).filter(e => {
          const txt = (e.innerText || '').trim();
          return e.children.length === 0 && /total/i.test(txt) && !/total itens/i.test(txt);
        }).map(e => {
          const parent = e.parentElement;
          return {
            tag: e.tagName,
            class: e.className,
            text: e.innerText.trim(),
            parentText: parent ? parent.innerText.replace(/\\n+/g, ' | ').trim() : ''
          };
        });

        // Regex para extrair total do pedido
        const matchTotalPedido = offcanvasText.match(/Total(?:\\s+do\\s+pedido)?:?\\s*R\\$\\s*([\\d\\.,]+)/i) ||
                                  offcanvasText.match(/Total:?\\s*R\\$\\s*([\\d\\.,]+)/i);

        const totalPedidoVal = matchTotalPedido ? parsePrecoBR(matchTotalPedido[1]) : 0;

        return {
          containersCount: containers.length,
          containerData,
          totalElements,
          matchTotalPedidoRaw: matchTotalPedido ? matchTotalPedido[0] : null,
          totalPedidoVal
        };
      })()
    `;

    const result = await page.evaluate(evalCode);

    console.log('\n=== RESULTADO DA INSPEÇÃO AO VIVO ===');
    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    console.error('❌ Erro no teste ao vivo:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
