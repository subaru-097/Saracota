import { chromium } from 'playwright';

async function getConstrujaCategoryPages() {
  console.log('================================================================================');
  console.log('🔍 EXTRAÇÃO DAS METAS ANUNCIADAS (TOTAL DE PÁGINAS) NA CONSTRUJÁ');
  console.log('================================================================================\n');

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

  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  const categoryRealMeta: Record<string, { totalPaginas: number; totalEsperado: number }> = {};

  for (const catName of categoryListToProcess) {
    if (catName !== 'TODOS PRODUTOS') {
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
      }, catName);
      await page.waitForTimeout(3000);
    }

    const pages = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const match = text.match(/de\s+(\d+)\s+páginas/i) || text.match(/página\s+(\d+)\s+de\s+(\d+)/i);
      if (match) {
        return parseInt(match[match.length - 1], 10);
      }
      return 1;
    });

    categoryRealMeta[catName] = {
      totalPaginas: pages,
      totalEsperado: pages * 40
    };

    console.log(`📂 CATEGORIA: "${catName.padEnd(25, ' ')}" => ${pages} páginas | Total Anunciado: ${pages * 40} produtos`);
  }

  await context.close();
  await browser.close();

  console.log('\n================================================================================');
  console.log('📌 TABELA DE METAS REAIS ANUNCIADAS CONSTRUJÁ:');
  console.log('================================================================================');
  console.log(JSON.stringify(categoryRealMeta, null, 2));
}

getConstrujaCategoryPages().catch(console.error);
