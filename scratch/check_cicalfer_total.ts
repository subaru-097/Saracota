import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function auditAndScrapeFullCicalfer() {
  console.log('🔍 INICIANDO AUDITORIA E RASPAGEM COMPLETA DA CICALFER...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Login
  console.log('Logging in to Cicalfer B2B...');
  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const loginTrigger = page.locator('button#botao-login, .componentes-button_login, a:has-text("Entrar")').first();
  if (await loginTrigger.isVisible().catch(() => false)) {
    await loginTrigger.click().catch(() => {});
    await page.waitForTimeout(1500);
  }

  const emailInput = page.locator('input[name="email"]').first();
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill('santanacomercial2021@gmail.com');
    await page.locator('input[name="senha"], input[type="password"]').first().fill('871935');
    await page.locator('button#btn-entrar').first().click();
    await page.waitForTimeout(3000);
  }

  // Obter todas as subcategorias do DOM
  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const summaries = Array.from(document.querySelectorAll('.MuiAccordionSummary-root, [class*="MuiAccordionSummary"]'));
    summaries.forEach((s) => (s as HTMLElement).click());
  });
  await page.waitForTimeout(2000);

  const subcategories: { dimensaoId: string; subNome: string; catPai: string }[] = await page.evaluate(() => {
    const subDivs = Array.from(document.querySelectorAll('div[id^="dimensao-"]'));
    const items: { dimensaoId: string; subNome: string; catPai: string }[] = [];

    subDivs.forEach((div) => {
      const fullId = div.id;
      const parts = fullId.replace('dimensao-', '').split('-');
      const dimensaoId = parts[0];
      const catPai = parts[1] || '00001003';
      const span = div.querySelector('span');
      const subNome = span ? (span.textContent || '').trim() : fullId;

      if (dimensaoId && !items.some(i => i.dimensaoId === dimensaoId)) {
        items.push({ dimensaoId, subNome, catPai });
      }
    });

    return items;
  });

  console.log(`📌 Encontradas ${subcategories.length} subcategorias.`);

  let totalProdutosSite = 0;
  const produtosMap = new Map<string, any>();
  const coverage: any[] = [];

  for (let i = 0; i < subcategories.length; i++) {
    const sub = subcategories[i];
    
    // Fetch page 1
    const resPage1 = await page.evaluate(async (dimId) => {
      try {
        const r = await fetch(`https://api.cicalfer.com.br/v1/busca?dimensao=${dimId}&pagina=1`);
        return await r.json();
      } catch (e: any) {
        return { error: e.message };
      }
    }, sub.dimensaoId);

    if (resPage1 && resPage1.paginator) {
      const totalSub = resPage1.paginator.total || 0;
      const lastPage = resPage1.paginator.last_page || 1;
      totalProdutosSite += totalSub;

      let subSavedCount = 0;

      const processItens = (itens: any[]) => {
        if (!itens || !Array.isArray(itens)) return;
        itens.forEach((it) => {
          const sku = `REF-${it.idExibicao || it.id}`;
          const nome = (it.descComp || it.descricao || '').trim();
          if (nome) {
            produtosMap.set(sku, {
              sku,
              nome_original: nome,
              categoria_site: sub.subNome,
              preco: Number(it.preco || it.preco_tabela || 0),
              unidade_venda: it.und ? `${it.und} (EMB: ${it.emb || 1})` : `EMB: ${it.emb || 1}`,
              url_produto: `https://cicalfer.com.br/produtos#ref-${it.idExibicao || it.id}`,
            });
            subSavedCount++;
          }
        });
      };

      processItens(resPage1.itens);

      for (let p = 2; p <= lastPage; p++) {
        const resNext = await page.evaluate(async ({ dimId, pagNum }) => {
          try {
            const r = await fetch(`https://api.cicalfer.com.br/v1/busca?dimensao=${dimId}&pagina=${pagNum}`);
            return await r.json();
          } catch (e: any) {
            return { error: e.message };
          }
        }, { dimId: sub.dimensaoId, pagNum: p });

        processItens(resNext.itens);
      }

      coverage.push({
        subcategoria: sub.subNome,
        dimensaoId: sub.dimensaoId,
        totalSite: totalSub,
        totalSalvo: subSavedCount,
        paginas: lastPage
      });

      if ((i + 1) % 25 === 0 || i === subcategories.length - 1) {
        console.log(`[${i + 1}/${subcategories.length}] Subcategorias varridas. Produtos únicos acumulados no Map: ${produtosMap.size} | Total somado do site: ${totalProdutosSite}`);
      }
    }
  }

  await browser.close();

  const todosProdutosArray = Array.from(produtosMap.values());
  const catalogDir = path.join(process.cwd(), 'catalogos', 'cicalfer');
  fs.mkdirSync(catalogDir, { recursive: true });

  fs.writeFileSync(path.join(catalogDir, 'produtos_brutos.json'), JSON.stringify(todosProdutosArray, null, 2));
  fs.writeFileSync(path.join(catalogDir, 'coverage_report.json'), JSON.stringify(coverage, null, 2));

  console.log('\n=====================================================');
  console.log('🎉 AUDITORIA E RASPAGEM COMPLETA CONCLUÍDA!');
  console.log(`• Total de produtos somados do site (todas subcategorias/páginas): ${totalProdutosSite}`);
  console.log(`• Total de produtos ÚNICOS (deduplicados por SKU) salvos no JSON: ${todosProdutosArray.length}`);
  console.log('=====================================================\n');
}

auditAndScrapeFullCicalfer().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
