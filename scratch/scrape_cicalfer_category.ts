import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🚀 Iniciando Mapeamento e Scraping da Cicalfer (https://cicalfer.com.br)...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    console.log('Navegando até a home da Cicalfer...');
    await page.goto('https://cicalfer.com.br/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    // Mapear menu / categorias
    console.log('Mapeando árvore de categorias do site...');
    const categoriasTree = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/produtos"], a[href*="/categoria"], nav a'));
      const tree: { title: string; url: string }[] = [];
      links.forEach((l) => {
        const title = (l.textContent || '').trim();
        const url = (l as HTMLAnchorElement).href;
        if (title && url && !tree.some((t) => t.url === url)) {
          tree.push({ title, url });
        }
      });
      return tree;
    });

    console.log(`Categorias/Links encontrados (${categoriasTree.length}):`, categoriasTree.slice(0, 10));

    // Navegar para busca ou categoria de Eletrodutos / Conduítes / Elétrica
    const urlCategoria = 'https://cicalfer.com.br/produtos?pagina=1&busca=conduite';
    console.log(`\nRaspando produtos na categoria/busca: ${urlCategoria}...`);
    await page.goto(urlCategoria, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);

    // Extrair lista de produtos da grade
    const produtosRaspados = await page.evaluate(() => {
      const items: any[] = [];
      // Buscar elementos de card de produto na grade
      const cards = Array.from(document.querySelectorAll('div[class*="product"], div[class*="Card"], div[class*="Item"], div.col-6, div.col-md-3, a[href*="/produto/"]'));

      cards.forEach((card, idx) => {
        const titleEl = card.querySelector('h2, h3, h4, p, [class*="title"], [class*="Title"], [class*="name"]');
        const priceEl = card.querySelector('[class*="price"], [class*="Price"], span.fw-bold, div.fw-bold');
        const linkEl = (card.tagName === 'A' ? card : card.querySelector('a')) as HTMLAnchorElement | null;
        const unEl = card.querySelector('[class*="unit"], [class*="Unit"], small, span');

        const nome = titleEl ? (titleEl.textContent || '').trim() : '';
        const priceText = priceEl ? (priceEl.textContent || '').trim() : '';
        const link = linkEl ? linkEl.href : '';
        const unText = unEl ? (unEl.textContent || '').trim() : '';

        // Limpeza do preço
        const priceMatch = priceText.match(/R\$\s*([\d.,]+)/i);
        let priceNum = 0;
        if (priceMatch) {
          priceNum = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'));
        }

        if (nome && nome.length > 5 && !items.some(i => i.nome_original === nome)) {
          items.push({
            sku: `CICALFER-${idx + 100}`,
            nome_original: nome,
            preco: priceNum,
            unidade_venda: unText || 'UNIDADE',
            url_produto: link || 'https://cicalfer.com.br/produtos',
            categoria_site: 'Elétrica > Conduítes',
          });
        }
      });
      return items;
    });

    console.log(`\nTotal de produtos capturados na página (${produtosRaspados.length}):`);
    produtosRaspados.forEach((p, i) => {
      console.log(`  ${i + 1}. [${p.sku}] ${p.nome_original} - R$ ${p.preco.toFixed(2)} (${p.unidade_venda})`);
    });

    // Se a extração genérica não pegou tudo, tentar seletor específico ou API de busca
    if (produtosRaspados.length === 0) {
      console.log('\nNenhum produto extraído via seletores genéricos. Testando seletores específicos da Cicalfer...');
      const bodyHtml = await page.content();
      console.log('Amostra HTML da página:', bodyHtml.substring(0, 1000));
    }

  } catch (err: any) {
    console.error('Erro ao navegar/raspar Cicalfer:', err.message);
  } finally {
    await browser.close();
  }
}

main();
