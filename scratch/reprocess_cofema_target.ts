import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { ProdutoBrutoScraped } from '../catalogos/catalogManager';
import { generateCofemaAuditoriaCSV } from '../scripts/export_cofema_auditoria_csv';

const COFEMA_SLUG = 'cofema';

interface CategoryReport {
  categoryName: string;
  url: string;
  totalEsperado: number;
  totalColetado: number;
  totalUnicos: number;
  coveragePercent: number;
  status: 'COMPLETO' | 'INCOMPLETO';
  warning?: string;
}

async function reprocessCofemaTarget() {
  console.log('================================================================================');
  console.log('🚀 REPROCESSANDO CATEGORIAS ALVO COFEMA: FERRAGENS (01) & UTILIDADES DOMÉSTICAS (06)');
  console.log('================================================================================\n');

  const baseDir = path.join(process.cwd(), 'catalogos', COFEMA_SLUG);
  const brutosPath = path.join(baseDir, 'produtos_brutos.json');
  const reportPath = path.join(baseDir, 'relatorio_cobertura_cofema.json');

  const produtosMap = new Map<string, ProdutoBrutoScraped>();
  if (fs.existsSync(brutosPath)) {
    try {
      const existing: ProdutoBrutoScraped[] = JSON.parse(fs.readFileSync(brutosPath, 'utf-8'));
      existing.forEach(item => produtosMap.set(item.sku, item));
      console.log(`📌 Checkpoint lido: ${produtosMap.size} SKUs globais únicos carregados de ${brutosPath}\n`);
    } catch (e) {}
  }

  let reportsMap = new Map<string, CategoryReport>();
  if (fs.existsSync(reportPath)) {
    try {
      const existingRep: CategoryReport[] = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      existingRep.forEach(r => reportsMap.set(r.categoryName, r));
    } catch (e) {}
  }

  // Mapeamento correto e verificado
  const targetCategories = [
    { name: 'Ferragens', url: 'https://www.cofema.com.br/page/categoria/01' },
    { name: 'Utilidades Domésticas', url: 'https://www.cofema.com.br/page/categoria/06' }
  ];

  for (const cat of targetCategories) {
    console.log(`\n================================================================================`);
    console.log(`📂 REPROCESSANDO CATEGORIA: "${cat.name.toUpperCase()}"`);
    console.log(`🔗 URL: ${cat.url}`);
    console.log(`================================================================================`);

    let browser;
    try {
      browser = await chromium.launch({
        channel: 'chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
      });
    } catch (e) {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
      });
    }

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      locale: 'pt-BR',
      extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' }
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    try {
      await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
      await page.waitForTimeout(2500);

      const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
      if (await cookieBtn.isVisible().catch(() => false)) {
        await cookieBtn.click().catch(() => {});
        await page.waitForTimeout(500);
      }

      await page.evaluate((targetUrl) => {
        window.location.href = targetUrl;
      }, cat.url).catch(() => {});
      await page.waitForTimeout(4500);

      const meta = await page.evaluate(() => {
        const text = document.body ? document.body.innerText : '';
        const match = text.match(/(\d+)\s*produtos\s*encontrados/i) || text.match(/(\d+)\s*produtos/i);
        const title = document.querySelector('h1, h2, h3.text-2xl, h3')?.textContent?.trim() || '';
        return {
          title,
          totalEsperado: match ? parseInt(match[1], 10) : 0
        };
      });

      let totalEsperado = meta.totalEsperado;
      console.log(`🎯 META DE VALIDAÇÃO: ${totalEsperado} produtos esperados ("${meta.title}")`);

      const catProductMap = new Map<string, ProdutoBrutoScraped>();
      let prevDomCount = 0;
      let stallCount = 0;
      let scrollRound = 0;
      const MAX_SCROLL_ROUNDS = 1500;

      while (scrollRound < MAX_SCROLL_ROUNDS) {
        scrollRound++;

        const currentItems = await page.evaluate((catNameParam) => {
          const cards = Array.from(document.querySelectorAll('a[aria-label]'));
          return cards.map(c => {
            const ariaLabel = c.getAttribute('aria-label') || '';
            const href = c.getAttribute('href') || '';

            const rawTitle = ariaLabel.replace(/^Ver produto\s+/i, '').trim();
            if (!rawTitle) return null;

            const idMatch = rawTitle.match(/(\d{4,10})\s*$/) || href.match(/\/(\d{4,10})/);
            const id = idMatch ? idMatch[1] : '';
            if (!id) return null;

            const sku = `COF-${id}`;

            const cardContainer = c.closest('div.group, div.relative') || c.parentElement;
            let priceText = '';
            let brand = '';

            if (cardContainer) {
              const priceEl = cardContainer.querySelector('.text-primary, [class*="price"], [class*="Price"]');
              priceText = priceEl?.textContent?.trim() || '';

              const brandEl = cardContainer.querySelector('.text-muted-foreground, [class*="brand"]');
              brand = brandEl?.textContent?.trim() || '';
            }

            const precoNum = parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

            return {
              id,
              sku,
              nome_original: rawTitle,
              categoria_site: `GERAL > ${catNameParam.toUpperCase()}`,
              marca: brand || rawTitle.split(' ')[0],
              preco: precoNum,
              unidade_venda: 'UN',
              estoque: 'Disponível',
              url_produto: href.startsWith('http') ? href : `https://www.cofema.com.br${href}`,
              scraped_at: new Date().toISOString()
            };
          }).filter(Boolean);
        }, cat.name);

        let newInRound = 0;
        currentItems.forEach((it: any) => {
          if (!catProductMap.has(it.sku)) {
            catProductMap.set(it.sku, it);
            newInRound++;
          }
          if (!produtosMap.has(it.sku)) {
            produtosMap.set(it.sku, it);
          }
        });

        const currentDomCount = currentItems.length;
        console.log(`  [Scroll #${scrollRound}] Cards no DOM: ${currentDomCount} | Únicos Categoria: ${catProductMap.size} | Novos nesta rodada: +${newInRound}`);

        if (totalEsperado > 0 && catProductMap.size >= totalEsperado) {
          console.log(`  ✅ META ALCANÇADA! ${catProductMap.size} SKUs únicos coletados (Meta: ${totalEsperado}).`);
          break;
        }

        if (currentDomCount === prevDomCount && newInRound === 0) {
          stallCount++;
          if (stallCount >= 10) {
            console.log(`  ⏹️ Fim do carregamento detectado (estagnação por 10 rodadas consecutivas sem novos cards).`);
            break;
          }
        } else {
          stallCount = 0;
        }
        prevDomCount = currentDomCount;

        await page.evaluate(() => {
          window.scrollBy(0, 1800);
        });
        await page.waitForTimeout(1400);
      }

      const totalColetadoCategoria = catProductMap.size;
      const coveragePercent = totalEsperado > 0 ? Math.min(100, Math.round((totalColetadoCategoria / totalEsperado) * 100)) : 100;
      const status: 'COMPLETO' | 'INCOMPLETO' = coveragePercent >= 95 ? 'COMPLETO' : 'INCOMPLETO';

      console.log(`  🎉 CATEGORIA CONCLUÍDA! Cobertura: ${coveragePercent}% (${totalColetadoCategoria} / ${totalEsperado})`);

      reportsMap.set(cat.name, {
        categoryName: cat.name,
        url: cat.url,
        totalEsperado,
        totalColetado: totalColetadoCategoria,
        totalUnicos: totalColetadoCategoria,
        coveragePercent,
        status,
        warning: status === 'INCOMPLETO' ? `Estagnação detectada no scroll client-side após ${totalColetadoCategoria} itens` : undefined
      });

      // Salvar produtos brutos atualizados
      const allArray = Array.from(produtosMap.values());
      fs.writeFileSync(brutosPath, JSON.stringify(allArray, null, 2), 'utf-8');
      fs.writeFileSync(reportPath, JSON.stringify(Array.from(reportsMap.values()), null, 2), 'utf-8');

    } catch (e: any) {
      console.error(`❌ Erro no reprocessamento da categoria "${cat.name}":`, e.message);
    } finally {
      await context.close();
      await browser.close();
    }
  }

  // Atualizar CSV
  generateCofemaAuditoriaCSV();
}

reprocessCofemaTarget().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
