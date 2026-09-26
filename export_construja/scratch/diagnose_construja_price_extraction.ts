const { chromium } = require('playwright');
const { db } = require('../lib/db/client');

async function main() {
  console.log('🔍 [DIAGNÓSTICO PREÇO CONSTRUJÁ - INSPEÇÃO DIRETA DO CART DRAWER DOM]');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // 1. Login
    console.log('\n--- 1. NAVEGAÇÃO E LOGIN ---');
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

    // 2. Ir para a busca de Fortlev
    console.log('\n--- 2. BUSCANDO E ADICIONANDO FORTLEV AO CARRINHO ---');
    await page.goto('https://www.construja.com.br/produtos?pagina=1&busca=FORTLEV', { waitUntil: 'commit' });
    await page.waitForTimeout(3000);

    // Fechar modal entendi se houver
    const btnEntendi = page.locator('button.shepherd-button, button:has-text("Entendi")').first();
    if (await btnEntendi.isVisible().catch(() => false)) {
      await btnEntendi.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Preencher quantidade no primeiro card de produto
    const qtyInput = page.locator('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]').first();
    if (await qtyInput.isVisible().catch(() => false)) {
      console.log('Preenchendo quantidade 3...');
      await qtyInput.fill('3');
      await page.waitForTimeout(500);
      await qtyInput.press('Enter');
      await page.waitForTimeout(1500);

      const buyBtn = page.locator('button:has-text("Comprar"), button:has-text("Adicionar")').first();
      if (await buyBtn.isVisible().catch(() => false)) {
        console.log('Clicando em Comprar...');
        await buyBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(2000);
      }
    }

    // 3. Abrir gaveta do carrinho
    console.log('\n--- 3. ABRINDO GAVETA DO CARRINHO (#botao-abrir-carrinho) ---');
    const openCartBtn = page.locator('#botao-abrir-carrinho').first();
    if (await openCartBtn.isVisible().catch(() => false)) {
      await openCartBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(3000);
    }

    // 4. Inspecionar o DOM EXATO usando string literal no evaluate
    console.log('\n--- 4. EXTRAÇÃO DE SELETORES E PREÇOS NO DOM DO CARRINHO ---');

    const evalCode = `
      (() => {
        function parsePrecoBR(valor) {
          if (typeof valor !== 'string' || !valor.trim()) return -1;
          const limpo = valor.replace(/[^\\d.,]/g, '').replace(/\\./g, '').replace(',', '.');
          if (!limpo) return -2;
          const numero = parseFloat(limpo);
          return isNaN(numero) ? -3 : Math.round(numero * 100) / 100;
        }

        const containers = Array.from(document.querySelectorAll('.ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*="itemContainer"]'));

        const containerDetails = containers.map((c, idx) => {
          const titleEl = c.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, span[class*="productTitle"], a');
          const titleText = titleEl ? titleEl.innerText.trim() : 'NÃO ENCONTRADO';

          // Seletores tentados
          const priceElsSupabase = Array.from(c.querySelectorAll('.d-flex.flex-column > span.fs-14.fw-bold, span.fs-14.fw-bold'));
          const priceTextsSupabase = priceElsSupabase.map(e => e.innerText.trim());

          const rawUnitPriceStr = priceElsSupabase[0] ? priceElsSupabase[0].innerText.trim() : '';
          const rawTotalItemStr = priceElsSupabase[1] ? priceElsSupabase[1].innerText.trim() : '';

          const precoUnitarioParsed = parsePrecoBR(rawUnitPriceStr);
          const totalItemParsed = parsePrecoBR(rawTotalItemStr);

          const rawText = c.innerText || '';
          const pricesInContainer = Array.from(rawText.matchAll(/R\\$\\s*([\\d\\.,]+)/gi)).map(m => parsePrecoBR(m[1]));

          return {
            idx: idx,
            titleText: titleText,
            priceElsSupabaseCount: priceElsSupabase.length,
            priceTextsSupabase: priceTextsSupabase,
            rawUnitPriceStr: rawUnitPriceStr,
            precoUnitarioParsed: precoUnitarioParsed,
            rawTotalItemStr: rawTotalItemStr,
            totalItemParsed: totalItemParsed,
            pricesInContainer: pricesInContainer,
            containerRawText: rawText.replace(/\\n+/g, ' | ')
          };
        });

        const summaryTable = document.querySelector('table.table-bordered, table, div[class*="resumo"], div[class*="Resumo"]');
        const bodyText = document.body.innerText;

        return {
          containersCount: containers.length,
          containerDetails: containerDetails,
          summaryTableFound: Boolean(summaryTable),
          summaryTableText: summaryTable ? summaryTable.innerText.replace(/\\n+/g, ' | ') : null,
          bodyTotalPedidoMatch: bodyText.match(/Total pedido:?\\s*R\\$\\s*[\\d.,]+/i)?.[0] || bodyText.match(/Total:?\\s*R\\$\\s*[\\d.,]+/i)?.[0] || 'NÃO ENCONTRADO'
        };
      })()
    `;

    const cartInspection = await page.evaluate(evalCode);

    console.log('\n=== RESULTADO DA INSPEÇÃO DO DOM DO CARRINHO ===');
    console.log(JSON.stringify(cartInspection, null, 2));

  } catch (err) {
    console.error('❌ Erro durante teste:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
