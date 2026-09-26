import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';

async function inspectCicalferApiSearch() {
  console.log('🔍 Testando extração via API/DOM da Cicalfer com 160+ produtos por página...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const produtosExtraidos = await page.evaluate(() => {
      const items: any[] = [];
      const bodyText = document.body.innerText;

      // Buscar todos os blocos de produtos com padrão #SKU
      const regexSKU = /#(\d+)\s*\n\s*EMB:\s*(\d+)\s*\n\s*([^\n]+)/g;
      let match;
      while ((match = regexSKU.exec(bodyText)) !== null) {
        items.push({
          sku: `REF-${match[1]}`,
          emb: match[2],
          nome_original: match[3].trim(),
          preco: 45.90,
          unidade_venda: `EMB: ${match[2]}`,
          url_produto: `https://cicalfer.com.br/produtos#ref-${match[1]}`,
          categoria_site: 'Elétrica',
        });
      }
      return items;
    });

    console.log(`\n🎉 Total de produtos capturados via DOM parser regex: ${produtosExtraidos.length}`);
    console.log('Amostra dos 5 primeiros:');
    produtosExtraidos.slice(0, 5).forEach((p, idx) => {
      console.log(`  ${idx + 1}. [${p.sku}] ${p.nome_original} (${p.unidade_venda})`);
    });

  } catch (err: any) {
    console.error('Erro ao inspecionar:', err.message);
  } finally {
    await browser.close();
  }
}

inspectCicalferApiSearch();
