const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function main() {
  const htmlPath = path.join(process.cwd(), 'scratch', 'diag_03_carrinho.html');
  if (!fs.existsSync(htmlPath)) {
    console.error('Arquivo diag_03_carrinho.html não encontrado!');
    return;
  }

  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  console.log(`Carregando HTML dump (Tamanho: ${htmlContent.length} bytes)...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(htmlContent);

  const analysis = await page.evaluate(`
    (() => {
      function parsePrecoBR(valor) {
        if (typeof valor !== 'string' || !valor.trim()) return -1;
        const limpo = valor.replace(/[^\\d.,]/g, '').replace(/\\./g, '').replace(',', '.');
        if (!limpo) return -2;
        const numero = parseFloat(limpo);
        return isNaN(numero) ? -3 : Math.round(numero * 100) / 100;
      }

      // Buscar todos os containers possíveis
      const containers = Array.from(document.querySelectorAll('.ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*="itemContainer"], [class*="ProdutoCompactCarrinho"]'));

      const containerDetails = containers.map((c, idx) => {
        const titleEl = c.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, span[class*="productTitle"], a[href*="/produto/"]');
        const titleText = titleEl ? titleEl.innerText.trim() : 'NÃO ENCONTRADO';

        // Seletores de preço testados
        const priceElsSupabase = Array.from(c.querySelectorAll('.d-flex.flex-column > span.fs-14.fw-bold, span.fs-14.fw-bold'));
        const priceTextsSupabase = priceElsSupabase.map(e => e.innerText.trim());

        const rawUnitPriceStr = priceElsSupabase[0] ? priceElsSupabase[0].innerText.trim() : 'VAZIO';
        const rawTotalItemStr = priceElsSupabase[1] ? priceElsSupabase[1].innerText.trim() : 'VAZIO';

        const precoUnitarioParsed = parsePrecoBR(rawUnitPriceStr);
        const totalItemParsed = parsePrecoBR(rawTotalItemStr);

        const rawText = c.innerText || '';
        const pricesInContainer = Array.from(rawText.matchAll(/R\\$\\s*([\\d\\.,]+)/gi)).map(m => ({
          matchedStr: m[0],
          rawNum: m[1],
          parsed: parsePrecoBR(m[1])
        }));

        const allChildrenSpans = Array.from(c.querySelectorAll('span, div, p, strong, td')).map(e => ({
          tag: e.tagName,
          class: e.className,
          text: e.innerText.trim()
        })).filter(e => e.text.length > 0 && e.text.length < 100);

        return {
          idx,
          containerClass: c.className,
          titleText,
          priceElsSupabaseCount: priceElsSupabase.length,
          priceTextsSupabase,
          rawUnitPriceStr,
          precoUnitarioParsed,
          rawTotalItemStr,
          totalItemParsed,
          pricesInContainer,
          containerRawTextSnippet: rawText.replace(/\\n+/g, ' | ').substring(0, 300),
          allChildrenSpans: allChildrenSpans.slice(0, 15)
        };
      });

      // Tabela de resumo
      const summaryTable = document.querySelector('table.table-bordered, table, div[class*="resumo"], div[class*="Resumo"]');
      const bodyText = document.body.innerText;

      return {
        containersCount: containers.length,
        containerDetails,
        summaryTableFound: Boolean(summaryTable),
        summaryTableHTMLSnippet: summaryTable ? summaryTable.outerHTML.substring(0, 500) : null,
        bodyTotalPedidoMatches: Array.from(bodyText.matchAll(/Total[^:]*:?\\s*R\\$\\s*([\\d\\.,]+)/gi)).map(m => ({ full: m[0], raw: m[1], parsed: parsePrecoBR(m[1]) }))
      };
    })()
  `);

  console.log('\n=== ANÁLISE DO DOM DUMP REAL CONSTRUJÁ ===');
  console.log(JSON.stringify(analysis, null, 2));

  await browser.close();
}

main().catch(console.error);
