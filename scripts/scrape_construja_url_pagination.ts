import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { generateConstrujaAuditoriaCSV } from './export_construja_auditoria_csv';

const CONSTRUJA_SLUG = 'construja';
const LOGIN_EMAIL = process.env.CONSTRUJA_EMAIL || process.env.CONSTRUJA_LOGIN || 'comercialsantana@gmail.com';
const LOGIN_PASS = process.env.CONSTRUJA_PASSWORD || '53597';

interface ProdutoBrutoConstruja {
  sku: string;
  id: string;
  nome_original: string;
  categoria_site: string;
  marca: string;
  preco: number;
  unidade_venda: string;
  estoque: string;
  url_produto: string;
  scraped_at: string;
}

async function scrapeConstrujaUrlPagination() {
  console.log('================================================================================');
  console.log('🚀 RASPAGEM COMPLETA CONSTRUJÁ VIA PAGINAÇÃO POR URL (?pagina=1 ATÉ 358)');
  console.log('================================================================================\n');

  const baseDir = path.join(process.cwd(), 'catalogos', CONSTRUJA_SLUG);
  const auditDir = path.join(baseDir, 'auditoria');

  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }

  const brutosPath = path.join(auditDir, 'produtos_brutos.json');
  const brutosPathBase = path.join(baseDir, 'produtos_brutos.json');
  const reportPath = path.join(auditDir, 'relatorio_cobertura_construja.json');
  const checkpointPath = path.join(baseDir, 'scraper_checkpoint.json');

  const produtosMap = new Map<string, ProdutoBrutoConstruja>();

  // Iniciar navegador autenticado
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
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  try {
    console.log('🔑 Realizando login B2B na Construjá...');
    await page.goto('https://www.construja.com.br/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2500);

    const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
    if (await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click().catch(() => {});
      await page.waitForTimeout(500);
    }

    const loginLink = page.locator('a[href*="/login"], button:has-text("Entre"), span:has-text("Entre"), a:has-text("Entre")').first();
    if (await loginLink.isVisible().catch(() => false)) {
      await loginLink.click();
      await page.waitForTimeout(2000);
    }

    const modal = page.locator('.modal-login, div[role="dialog"]').first();
    const isModalVisible = await modal.isVisible().catch(() => false);
    const container = isModalVisible ? modal : page.locator('body');

    const emailInput = container.locator('input[type="email"], input[name*="email"], input[name*="login"], input[placeholder*="email" i], input[placeholder*="cpf" i]').first();
    const passInput = container.locator('input[type="password"], input[name*="senha"], input[name*="pass"], input[placeholder*="senha" i]').first();

    await emailInput.fill(LOGIN_EMAIL);
    await passInput.fill(LOGIN_PASS);

    const submitBtn = container.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Acessar"), button:has-text("Login")').first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
    } else {
      await passInput.press('Enter');
    }

    await page.waitForTimeout(4000);
    console.log('✅ Login B2B realizado com sucesso.\n');

    const TOTAL_PAGES_ANNOUNCED = 358;
    const TOTAL_EXPECTED_PRODUCTS = TOTAL_PAGES_ANNOUNCED * 40; // ~14.320 produtos

    console.log(`📌 Iniciando varredura por parâmetro de URL (?pagina=1 até ${TOTAL_PAGES_ANNOUNCED})...`);

    let pageNum = 1;
    let consecutiveEmptyPages = 0;

    while (pageNum <= TOTAL_PAGES_ANNOUNCED) {
      const pageUrl = `https://www.construja.com.br/produtos?pagina=${pageNum}`;

      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2200);

        const pageProducts = await page.evaluate(() => {
          const containers = Array.from(document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]'));
          return containers.map(c => {
            const link = c.querySelector('a[href*="/produto/"]');
            const titleEl = c.querySelector('[class*="CardProduto_tituloCardProduto"]');
            const href = link?.getAttribute('href') || '';
            const match = href.match(/\/produto\/(\d+)/);
            const id = match ? match[1] : '';
            const rawTitle = titleEl?.textContent?.trim() || '';

            const brandMatch = rawTitle.match(/^([^-]+)\s*-\s*/);
            const brand = brandMatch ? brandMatch[1].trim() : rawTitle.split(' ')[0];

            const priceEl = c.querySelector('div[class*="CardProduto_precoCardProduto"], [class*="preco"], [class*="valorUnitario"], [class*="valorUnitarioDestaque"]');
            const precoText = priceEl?.textContent?.trim() || '';
            const precoNum = parseFloat(precoText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

            const badges = Array.from(c.querySelectorAll('.badge, [class*="Badge"], span')).map(s => s.textContent?.trim()).filter(Boolean);
            const embBadge = badges.find(b => b?.includes('EMB:') || b?.includes('CX:')) || 'UN (EMB: 1)';
            const estoqueBadge = badges.find(b => b?.toLowerCase().includes('estoque')) || 'Disponível';

            return {
              id,
              sku: `CON-${id}`,
              nome_original: rawTitle,
              categoria_site: 'CATÁLOGO GLOBAL',
              marca: brand,
              preco: precoNum,
              unidade_venda: embBadge,
              estoque: estoqueBadge,
              url_produto: href.startsWith('http') ? href : `https://www.construja.com.br${href}`,
              scraped_at: new Date().toISOString()
            };
          }).filter(x => x.id && x.nome_original);
        });

        let newInPage = 0;
        pageProducts.forEach(it => {
          if (!produtosMap.has(it.sku)) {
            produtosMap.set(it.sku, it);
            newInPage++;
          }
        });

        if (pageNum % 10 === 0 || pageNum === 1 || pageNum === TOTAL_PAGES_ANNOUNCED) {
          console.log(`  [Página ${String(pageNum).padStart(3, ' ')}/${TOTAL_PAGES_ANNOUNCED}] Cards na Página: ${pageProducts.length} | Novos nesta página: +${newInPage} | Total Acumulado SKUs Únicos: ${produtosMap.size}`);
        }

        if (pageProducts.length === 0) {
          consecutiveEmptyPages++;
          if (consecutiveEmptyPages >= 5) {
            console.log(`⏹️ 5 páginas vazias consecutivas detectadas na página ${pageNum}. Encerrando varredura.`);
            break;
          }
        } else {
          consecutiveEmptyPages = 0;
        }

        // Checkpoint a cada 20 páginas
        if (pageNum % 20 === 0 || pageNum === TOTAL_PAGES_ANNOUNCED) {
          const currentArray = Array.from(produtosMap.values());
          fs.writeFileSync(brutosPath, JSON.stringify(currentArray, null, 2), 'utf-8');
          fs.writeFileSync(brutosPathBase, JSON.stringify(currentArray, null, 2), 'utf-8');
        }

      } catch (errPage: any) {
        console.warn(`  ⚠️ Erro na página ${pageNum}:`, errPage.message);
      }

      pageNum++;
    }

    const totalColetado = produtosMap.size;
    const coveragePercent = Math.min(100, Math.round((totalColetado / TOTAL_EXPECTED_PRODUCTS) * 100));
    const status: 'COMPLETO' | 'INCOMPLETO' = coveragePercent >= 95 ? 'COMPLETO' : 'INCOMPLETO';

    console.log('\n================================================================================');
    console.log('📊 RELATÓRIO FINAL DA RASPAGEM AUTENTICADA CONSTRUJÁ VIA PARÂMETRO DE URL');
    console.log('================================================================================');
    console.log(`• Meta Esperada Anunciada (358 pág × 40): ${TOTAL_EXPECTED_PRODUCTS} produtos`);
    console.log(`• Total de SKUs Únicos Coletados: ${totalColetado} SKUs`);
    console.log(`• Cobertura Real: ${coveragePercent}%`);
    console.log(`• Status: ${status === 'COMPLETO' ? '✅ COMPLETO' : `⚠️ INCOMPLETO (${coveragePercent}%)`}`);
    console.log('================================================================================\n');

    const currentArray = Array.from(produtosMap.values());
    fs.writeFileSync(brutosPath, JSON.stringify(currentArray, null, 2), 'utf-8');
    fs.writeFileSync(brutosPathBase, JSON.stringify(currentArray, null, 2), 'utf-8');

    const reportData = [{
      categoryName: 'CATÁLOGO GLOBAL CONSTRUJÁ',
      totalEsperado: TOTAL_EXPECTED_PRODUCTS,
      totalColetado,
      totalUnicos: totalColetado,
      coveragePercent,
      status,
      warning: status === 'INCOMPLETO' ? `Cobertura real de ${coveragePercent}% (${totalColetado} de ${TOTAL_EXPECTED_PRODUCTS} produtos anunciados)` : undefined
    }];

    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf-8');
    fs.writeFileSync(checkpointPath, JSON.stringify({
      fornecedorSlug: CONSTRUJA_SLUG,
      totalProdutosAcumulados: totalColetado,
      updatedAt: new Date().toISOString()
    }, null, 2), 'utf-8');

    generateConstrujaAuditoriaCSV();

  } catch (errGlobal: any) {
    console.error('❌ Erro na raspagem Construjá:', errGlobal);
  } finally {
    await context.close();
    await browser.close();
  }
}

scrapeConstrujaUrlPagination().catch((err) => {
  console.error('❌ Falha crítica no scraper Construjá:', err);
  process.exit(1);
});
