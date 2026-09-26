import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';

async function auditConstrujaExact() {
  console.log('================================================================================');
  console.log('📊 AUDITORIA EXATA E CONTAGEM MANUAL - CATÁLOGO CONSTRUJÁ');
  console.log('================================================================================\n');

  const baseDir = path.join(process.cwd(), 'catalogos', 'construja');
  const brutosPath = path.join(baseDir, 'produtos_brutos.json');
  const auditCsvPath = path.join(baseDir, 'auditoria', 'auditoria_completa.csv');

  // 1. Contagem no JSON
  let rawItems: any[] = [];
  if (fs.existsSync(brutosPath)) {
    rawItems = JSON.parse(fs.readFileSync(brutosPath, 'utf-8'));
  }
  const skuSet = new Set(rawItems.map(i => i.sku || `CON-${i.id}`));

  console.log(`📌 1. CONTAGEM REAL NO JSON (produtos_brutos.json):`);
  console.log(`   • Total de Objetos no Array: ${rawItems.length}`);
  console.log(`   • Total de SKUs Únicos (CON-{id}): ${skuSet.size}`);

  // Breakdown de SKUs coletados por categoria no JSON
  const breakdownCategoryJSON: Record<string, number> = {};
  rawItems.forEach(item => {
    const cat = item.categoria_site || 'GERAL';
    breakdownCategoryJSON[cat] = (breakdownCategoryJSON[cat] || 0) + 1;
  });
  console.log(`   • Distribuição por Categoria no JSON:`, JSON.stringify(breakdownCategoryJSON, null, 2));

  // 2. Contagem de Linhas no CSV
  let csvLines = 0;
  if (fs.existsSync(auditCsvPath)) {
    const content = fs.readFileSync(auditCsvPath, 'utf-8');
    csvLines = content.split('\n').filter(line => line.trim().length > 0).length;
  }
  console.log(`\n📌 2. CONTAGEM DE LINHAS NO CSV (auditoria_completa.csv):`);
  console.log(`   • Linhas no Arquivo CSV (incluindo cabeçalho): ${csvLines}`);
  console.log(`   • Linhas de Produtos Únicos (excluindo cabeçalho): ${csvLines > 0 ? csvLines - 1 : 0}`);

  // 3. Inspeção das Metas Anunciadas no Site (Total de Páginas * 40 por Categoria)
  console.log(`\n📌 3. BUSCANDO METAS ANUNCIADAS NO SITE CONSTRUJÁ POR CATEGORIA...`);

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch (e) {
    browser = await chromium.launch({ headless: true });
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const page = await context.newPage();

  const categoryList = [
    { name: 'TODOS PRODUTOS', selector: null },
    { name: 'ABRASIVOS', selector: 'ABRASIVOS' },
    { name: 'ACESSÓRIOS DE PINTURA', selector: 'ACESSÓRIOS DE PINTURA' },
    { name: 'ADESIVOS E SELANTES', selector: 'ADESIVOS E SELANTES' },
    { name: 'FERRAMENTAS', selector: 'FERRAMENTAS' },
    { name: 'FIXAÇÃO', selector: 'FIXAÇÃO' },
    { name: 'HIDRÁULICA', selector: 'HIDRÁULICA' },
    { name: 'ELÉTRICA', selector: 'ELÉTRICA' },
    { name: 'PINTURA', selector: 'PINTURA' },
    { name: 'SEGURANÇA', selector: 'SEGURANÇA' }
  ];

  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  const realSiteMetas: Record<string, { totalPaginas: number; totalEsperado: number; textoSite: string }> = {};

  for (const cat of categoryList) {
    if (cat.selector) {
      await page.evaluate((targetCat) => {
        const spans = Array.from(document.querySelectorAll('span.font-size-14.fw-medium.text-uppercase'));
        const matchSpan = spans.find(s => s.textContent?.trim().toUpperCase() === targetCat.toUpperCase());
        if (matchSpan) {
          let parent: HTMLElement | null = matchSpan as HTMLElement;
          while (parent && parent.tagName !== 'BUTTON' && parent.tagName !== 'A' && parent.parentElement && parent.parentElement.tagName !== 'BODY') {
            if (parent.classList.contains('cursor-pointer') || parent.onclick) break;
            parent = parent.parentElement;
          }
          if (parent) parent.click();
        }
      }, cat.selector);
      await page.waitForTimeout(3000);
    }

    const pagInfo = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const match = text.match(/de\s+(\d+)\s+páginas/i);
      const totalPages = match ? parseInt(match[1], 10) : 1;

      const paginatorStr = Array.from(document.querySelectorAll('div, span, p'))
        .map(e => e.textContent?.trim())
        .find(t => t && t.includes('registros por página de'));

      return {
        totalPages,
        totalEsperado: totalPages * 40,
        paginatorStr: paginatorStr || 'NÃO_ENCONTRADO'
      };
    });

    realSiteMetas[cat.name] = {
      totalPaginas: pagInfo.totalPages,
      totalEsperado: pagInfo.totalEsperado,
      textoSite: pagInfo.paginatorStr
    };

    console.log(`  📂 ${cat.name.padEnd(25, ' ')} | Páginas: ${String(pagInfo.totalPages).padStart(4, ' ')} | Total Esperado Anunciado: ${String(pagInfo.totalEsperado).padStart(6, ' ')} | Texto: "${pagInfo.paginatorStr}"`);
  }

  await context.close();
  await browser.close();

  console.log('\n================================================================================');
  console.log('📌 RESUMO COMPLETO DAS METAS REALMENTE ANUNCIADAS NO SITE CONSTRUJÁ:');
  console.log('================================================================================');
  console.log(JSON.stringify(realSiteMetas, null, 2));
}

auditConstrujaExact().then(() => process.exit(0)).catch(console.error);
