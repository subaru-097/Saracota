import { chromium } from 'playwright';

async function findConstrujaPromoItems() {
  console.log('=== SEARCHING CURRENT PROMO / DISCOUNT ITEMS ON CONSTRUJÁ ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://www.construja.com.br/produtos');
  await page.waitForTimeout(3000);

  // Trigger login if visible
  const btnLogin = page.locator('#botao-login').first();
  if (await btnLogin.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btnLogin.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
    
    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill('comercialsantana@gmail.com');
      await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('53597');
      await page.locator('button#btn-entrar, button[type="submit"]').first().click({ force: true });
      await page.waitForTimeout(3000);
    }
  }

  // Go directly to products page or search terms
  const searchTerms = ['vedalit', 'fortlev', 'tintas', 'colorgin', 'massa', 'amanco', 'tigre'];
  const promoItems: any[] = [];

  for (const term of searchTerms) {
    if (promoItems.length >= 6) break;
    console.log(`Searching term: "${term}"...`);
    await page.goto(`https://www.construja.com.br/produtos?pagina=1&busca=${encodeURIComponent(term)}`);
    await page.waitForTimeout(2500);

    const itemsOnPage = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.Produto_cardProduto__1J3fX, div[class*="cardProduto"]'));
      const found: any[] = [];

      cards.forEach(card => {
        const titleEl = card.querySelector('.Produto_tituloProduto__2tU5g, span[class*="tituloProduto"], h5, a');
        const title = titleEl ? titleEl.innerText.trim() : '';

        // All leaf elements containing R$
        const allRS = Array.from(card.querySelectorAll('*'))
          .filter(e => /^R\$\s*[\d\.,]+/i.test((e.innerText || '').trim()) && e.children.length === 0)
          .map(e => {
            const style = window.getComputedStyle(e);
            const parentStyle = e.parentElement ? window.getComputedStyle(e.parentElement) : null;
            const isStrikethrough = Boolean(style.textDecorationLine.includes('line-through')) ||
                                   Boolean(parentStyle && parentStyle.textDecorationLine.includes('line-through')) ||
                                   Boolean(e.closest('.text-decoration-line-through, .line-through, .text-muted, .price-old, del, s, strike, [class*="SemDesconto"], [class*="sem-desconto"], [class*="PrecoSemDesconto"], [class*="oldPrice"], [class*="old-price"]')) ||
                                   Boolean(e.classList && (e.classList.contains('text-decoration-line-through') || e.classList.contains('text-muted') || (e.className || '').toString().includes('SemDesconto')));
            return {
              text: e.innerText.trim(),
              isStrikethrough
            };
          });

        if (allRS.length >= 2 || allRS.some(r => r.isStrikethrough)) {
          found.push({
            title,
            allRS,
            strikethroughPrice: allRS.find(r => r.isStrikethrough)?.text || null,
            promoPrice: allRS.find(r => !r.isStrikethrough)?.text || null
          });
        }
      });
      return found;
    });

    for (const item of itemsOnPage) {
      if (item.strikethroughPrice && item.promoPrice && !promoItems.some(p => p.title === item.title)) {
        promoItems.push(item);
        console.log(`  ✅ PROMO PRODUCT: "${item.title}"`);
        console.log(`     - Strikethrough Price: ${item.strikethroughPrice}`);
        console.log(`     - Promo Price: ${item.promoPrice}`);
      }
    }
  }

  console.log('\n=== FINAL SUMMARY OF PROMO PRODUCTS FOUND ===');
  console.log(JSON.stringify(promoItems, null, 2));

  await browser.close();
}

findConstrujaPromoItems().catch(err => console.error(err));
