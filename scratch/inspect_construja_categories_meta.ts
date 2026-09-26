import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function inspectConstrujaCategories() {
  console.log('================================================================================');
  console.log('🔍 INSPEÇÃO METICULOSA DAS METAS REAIS POR CATEGORIA NA CONSTRUJÁ');
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

  const categoryMetaMap: Record<string, { totalAnunciado: number; totalCardsPagina1: number; textMatch: string }> = {};

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

    const info = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const matches = text.match(/(\d+[\d\.]*)\s*(produtos|itens|resultados|encontrados)/i) || text.match(/(mostrando|exibindo)\s*(\d+)/i);
      const cards = document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]').length;

      // Procurar elementos que possam conter o total (ex: badges, contadores, paginador)
      const counterEl = document.querySelector('[class*="total"], [class*="quantidade"], [class*="contador"], span.fw-bold');
      const counterText = counterEl ? counterEl.textContent?.trim() : '';

      return {
        textMatch: matches ? matches[0] : (counterText || 'SEM_TEXTO'),
        numMatch: matches ? parseInt(matches[1].replace(/\./g, ''), 10) : 0,
        cards
      };
    });

    categoryMetaMap[catName] = {
      totalAnunciado: info.numMatch,
      totalCardsPagina1: info.cards,
      textMatch: info.textMatch
    };

    console.log(`📂 CATEGORIA: "${catName}" => Contagem anunciada: ${info.numMatch} | Cards no DOM (Pág 1): ${info.cards} | Match: "${info.textMatch}"`);
  }

  await context.close();
  await browser.close();

  console.log('\nResumo Metas Construjá:', JSON.stringify(categoryMetaMap, null, 2));
}

inspectConstrujaCategories().then(() => process.exit(0)).catch(console.error);
