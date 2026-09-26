import { chromium } from 'playwright';

async function testCofemaDomCleanup() {
  console.log('================================================================================');
  console.log('🧪 TESTANDO TÉCNICA DE DOM CLEANUP C/ SCROLL TO BOTTOM (COFEMA FERRAGENS)');
  console.log('================================================================================\n');

  const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
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
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
    if (await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click().catch(() => {});
      await page.waitForTimeout(500);
    }

    await page.evaluate(() => {
      window.location.href = 'https://www.cofema.com.br/page/categoria/01';
    });
    await page.waitForTimeout(4500);

    const extractedMap = new Map<string, any>();
    let scrollRound = 0;
    let stallCount = 0;

    console.log('🚀 Iniciando scroll infinito com DOM cleanup + re-anchor de scroll...');

    while (scrollRound < 350) {
      scrollRound++;

      const roundItems = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('a[aria-label]'));
        const extracted: any[] = [];

        cards.forEach(c => {
          const ariaLabel = c.getAttribute('aria-label') || '';
          const href = c.getAttribute('href') || '';

          const rawTitle = ariaLabel.replace(/^Ver produto\s+/i, '').trim();
          if (!rawTitle) return;

          const idMatch = rawTitle.match(/(\d{4,10})\s*$/) || href.match(/\/(\d{4,10})/);
          const id = idMatch ? idMatch[1] : '';
          if (!id) return;

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

          extracted.push({
            id,
            sku: `COF-${id}`,
            nome_original: rawTitle,
            marca: brand || rawTitle.split(' ')[0],
            preco: precoNum,
            url_produto: href.startsWith('http') ? href : `https://www.cofema.com.br${href}`
          });
        });

        // DOM CLEANUP: manter últimos 4 cards para ser o gatilho visual do IntersectionObserver
        if (cards.length > 4) {
          const cardsToRemove = cards.slice(0, cards.length - 4);
          cardsToRemove.forEach(c => {
            const container = c.closest('div.group, div.relative') || c.parentElement;
            if (container && container.parentNode) {
              container.parentNode.removeChild(container);
            }
          });
        }

        // Scrollar até o final da página recalculado
        window.scrollTo(0, document.body.scrollHeight);

        const domDivCount = document.querySelectorAll('div').length;
        return { extracted, domDivCount, remainingCards: document.querySelectorAll('a[aria-label]').length };
      });

      let newInRound = 0;
      roundItems.extracted.forEach((item: any) => {
        if (!extractedMap.has(item.sku)) {
          extractedMap.set(item.sku, item);
          newInRound++;
        }
      });

      if (scrollRound % 5 === 0 || newInRound > 0) {
        console.log(`  [Scroll #${scrollRound}] SKUs Únicos: ${extractedMap.size} | Novos nesta rodada: +${newInRound} | Cards no DOM: ${roundItems.remainingCards} | Divs no DOM: ${roundItems.domDivCount}`);
      }

      if (newInRound === 0) {
        stallCount++;
        if (stallCount >= 15) {
          console.log(`  ⏹️ Estagnação detectada após ${stallCount} rodadas sem novos cards. Fim do scroll.`);
          break;
        }
      } else {
        stallCount = 0;
      }

      await page.waitForTimeout(1400);
    }

    console.log(`\n🎉 RESULTADO FINAL DOM CLEANUP FERRAGENS: Coletados ${extractedMap.size} SKUs únicos.`);

  } catch (err: any) {
    console.error('❌ Erro durante teste de DOM cleanup:', err);
  } finally {
    await context.close();
    await browser.close();
  }
}

testCofemaDomCleanup().catch(console.error);
