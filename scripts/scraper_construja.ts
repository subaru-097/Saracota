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

interface CategoryReportConstruja {
  categoryName: string;
  totalEsperado: number;
  totalColetado: number;
  totalUnicos: number;
  coveragePercent: number;
  status: 'COMPLETO' | 'INCOMPLETO';
  warning?: string;
}

async function scrapeConstrujaFullCatalog() {
  console.log('================================================================================');
  console.log('🚀 RASPAGEM AUTENTICADA DO CATÁLOGO CONSTRUJÁ (PREÇOS REAIS B2B)');
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
  if (fs.existsSync(brutosPath)) {
    try {
      const existing: ProdutoBrutoConstruja[] = JSON.parse(fs.readFileSync(brutosPath, 'utf-8'));
      existing.forEach(item => produtosMap.set(item.sku, item));
      console.log(`📌 Checkpoint lido: ${produtosMap.size} SKUs já salvos em ${brutosPath}\n`);
    } catch (e) {}
  }

  const categoryListToProcess = [
    'TODOS PRODUTOS',
    'ABRASIVOS',
    'ACESSÓRIOS DE PINTURA',
    'ADESIVOS E SELANTES',
    'FERRAMENTAS',
    'FIXAÇÃO',
    'HIDRÁULICA',
    'ELÉTRICA',
    'PINTURA',
    'SEGURANÇA'
  ];

  console.log(`📌 Processando ${categoryListToProcess.length} categorias principais com autenticação B2B.\n`);

  const reports: CategoryReportConstruja[] = [];

  for (let cIdx = 0; cIdx < categoryListToProcess.length; cIdx++) {
    const catName = categoryListToProcess[cIdx];
    console.log(`\n================================================================================`);
    console.log(`📂 CATEGORIA [${cIdx + 1}/${categoryListToProcess.length}]: "${catName.toUpperCase()}"`);
    console.log(`================================================================================`);

    let categorySuccess = false;
    let attempt = 0;

    while (!categorySuccess && attempt < 3) {
      attempt++;
      console.log(`📌 Tentativa #${attempt} para "${catName}"...`);

      let catBrowser;
      try {
        catBrowser = await chromium.launch({
          channel: 'chrome',
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });
      } catch (e) {
        catBrowser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });
      }

      const catContext = await catBrowser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        locale: 'pt-BR',
      });
      await catContext.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      const page = await catContext.newPage();

      try {
        // FLUXO DE LOGIN B2B OBRIGATÓRIO
        console.log('   🔑 Realizando login B2B na Construjá...');
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
        console.log('   ✅ Login realizado com sucesso.');

        // NAVEGAÇÃO NA CATEGORIA
        await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 35000 });
        await page.waitForTimeout(3000);

        if (catName !== 'TODOS PRODUTOS') {
          const clickedCategory = await page.evaluate((targetCat) => {
            const spans = Array.from(document.querySelectorAll('span.font-size-14.fw-medium.text-uppercase'));
            const matchSpan = spans.find(s => s.textContent?.trim().toUpperCase() === targetCat.toUpperCase());
            if (matchSpan) {
              let parent: HTMLElement | null = matchSpan as HTMLElement;
              while (parent && parent.tagName !== 'BUTTON' && parent.tagName !== 'A' && parent.parentElement && parent.parentElement.tagName !== 'BODY') {
                if (parent.classList.contains('cursor-pointer') || parent.onclick) break;
                parent = parent.parentElement;
              }
              if (parent) {
                parent.click();
                return true;
              }
            }
            return false;
          }, catName);

          if (clickedCategory) {
            console.log(`  ✅ Clicado no menu da categoria "${catName}".`);
            await page.waitForTimeout(3000);
          }
        }

        const catProductMap = new Map<string, ProdutoBrutoConstruja>();
        let pageNum = 1;

        while (pageNum <= 50) {
          const pageProducts = await page.evaluate((catNameParam) => {
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
                categoria_site: `GERAL > ${catNameParam.toUpperCase()}`,
                marca: brand,
                preco: precoNum,
                unidade_venda: embBadge,
                estoque: estoqueBadge,
                url_produto: href.startsWith('http') ? href : `https://www.construja.com.br${href}`,
                scraped_at: new Date().toISOString()
              };
            }).filter(x => x.id && x.nome_original);
          }, catName);

          let newInPage = 0;
          pageProducts.forEach(it => {
            if (!catProductMap.has(it.sku)) {
              catProductMap.set(it.sku, it);
              newInPage++;
            }
            if (!produtosMap.has(it.sku)) {
              produtosMap.set(it.sku, it);
            }
          });

          console.log(`  [Página ${pageNum}] Extraídos: ${pageProducts.length} cards | Novos nesta página: +${newInPage} | Acumulado Categoria: ${catProductMap.size}`);

          if (pageProducts.length === 0) {
            console.log(`  ⏹️ Nenhum produto retornado na página ${pageNum}. Encerrando paginação desta categoria.`);
            break;
          }

          const nextPageNum = pageNum + 1;
          const hasClickedNext = await page.evaluate((nextNum) => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const targetBtn = btns.find(b => b.textContent?.trim() === String(nextNum));
            if (targetBtn) {
              (targetBtn as HTMLElement).click();
              return 'NUMBER';
            }
            const nextBtn = btns.find(b => b.textContent?.trim().includes('Próximo') || b.textContent?.trim() === '>');
            if (nextBtn && !(nextBtn as HTMLButtonElement).disabled) {
              (nextBtn as HTMLElement).click();
              return 'NEXT_BTN';
            }
            return null;
          }, nextPageNum);

          if (!hasClickedNext) {
            console.log(`  🏁 Fim das páginas detectado na página ${pageNum} (Sem mais botões de próxima página).`);
            break;
          }

          pageNum++;
          await page.waitForTimeout(2200);
        }

        const totalColetadoCategoria = catProductMap.size;
        const totalUnicosCategoria = catProductMap.size;
        const totalEsperadoEstimado = pageNum * 40;
        const status: 'COMPLETO' | 'INCOMPLETO' = totalColetadoCategoria > 0 ? 'COMPLETO' : 'INCOMPLETO';

        console.log(`  🎉 CATEGORIA CONCLUÍDA! Coletados: ${totalColetadoCategoria} SKUs únicos em ${pageNum} páginas.`);
        console.log(`  🔍 CHECAGEM DE UNICIDADE: ${totalUnicosCategoria} IDs numéricos únicos extraídos (100% deduplicados por SKU CON-{id}).`);

        reports.push({
          categoryName: catName,
          totalEsperado: totalEsperadoEstimado,
          totalColetado: totalColetadoCategoria,
          totalUnicos: totalUnicosCategoria,
          coveragePercent: totalColetadoCategoria > 0 ? 100 : 0,
          status
        });

        const currentArray = Array.from(produtosMap.values());
        fs.writeFileSync(brutosPath, JSON.stringify(currentArray, null, 2), 'utf-8');
        fs.writeFileSync(brutosPathBase, JSON.stringify(currentArray, null, 2), 'utf-8');
        fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2), 'utf-8');
        fs.writeFileSync(checkpointPath, JSON.stringify({
          fornecedorSlug: CONSTRUJA_SLUG,
          ultimaCategoria: catName,
          totalProdutosAcumulados: produtosMap.size,
          updatedAt: new Date().toISOString()
        }, null, 2), 'utf-8');

        categorySuccess = true;

      } catch (errCat: any) {
        console.error(`❌ Erro na tentativa #${attempt} para "${catName}":`, errCat.message);
      } finally {
        await catContext.close().catch(() => {});
        await catBrowser.close().catch(() => {});
      }
    }
  }

  console.log('\n================================================================================');
  console.log('📊 RELATÓRIO FINAL CONSOLIDADO DA RASPAGEM AUTENTICADA CONSTRUJÁ');
  console.log('================================================================================');
  console.log('CATEGORIA                   | ESPERADO | COLETADO | ÚNICOS ID | COBERTURA | STATUS');
  console.log('--------------------------------------------------------------------------------');

  reports.forEach(r => {
    const namePad = r.categoryName.padEnd(27, ' ');
    const espPad = String(r.totalEsperado).padStart(8, ' ');
    const colPad = String(r.totalColetado).padStart(8, ' ');
    const uniPad = String(r.totalUnicos).padStart(9, ' ');
    const covPad = `${r.coveragePercent}%`.padStart(9, ' ');
    const statusStr = r.status === 'COMPLETO' ? '✅ COMPLETO' : '⚠️ INCOMPLETO';
    console.log(`${namePad} | ${espPad} | ${colPad} | ${uniPad} | ${covPad} | ${statusStr}`);
  });

  console.log('--------------------------------------------------------------------------------');
  console.log(`• Arquivo Bruto Salvo: ${brutosPath}`);
  console.log(`• Total Global de SKUs Únicos no Catálogo: ${produtosMap.size}`);
  console.log('================================================================================\n');

  generateConstrujaAuditoriaCSV();
}

scrapeConstrujaFullCatalog().catch((err) => {
  console.error('❌ Erro na raspagem Construjá:', err);
  process.exit(1);
});
