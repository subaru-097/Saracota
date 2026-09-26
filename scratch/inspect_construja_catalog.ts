import { chromium } from 'playwright';

async function inspectConstrujaCatalog() {
  console.log('=== INSPECTING CONSTRUJÁ CATALOG AND PROMO SECTIONS ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

  await page.goto('https://www.construja.com.br/produtos');
  await page.waitForTimeout(3000);

  // Perform login properly
  const loginTrigger = page.locator('#botao-login').first();
  if (await loginTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginTrigger.click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('input[name="email"], input[type="email"]').first().fill('comercialsantana@gmail.com');
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('53597');
    await page.locator('button#btn-entrar, button[type="submit"]').first().click({ force: true });
    await page.waitForTimeout(3000);
    console.log('Login performed successfully.');
  }

  // Look for "Oferta", "Promoção", "Desconto" banners/links or navigate pages
  const promoLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button'))
      .filter(e => /oferta|promo|desconto|outlet/i.test(e.innerText || '') || /oferta|promo/i.test((e as any).href || ''))
      .map(e => ({ text: e.innerText.trim(), href: (e as any).href || '' }));
  });
  console.log('Promo links on page:', promoLinks);

  // Inspect first 30 products on catalog page 1
  const catalogProducts = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.Produto_cardProduto__1J3fX, div[class*="cardProduto"]'));
    return cards.map((card, idx) => {
      const titleEl = card.querySelector('.Produto_tituloProduto__2tU5g, span[class*="tituloProduto"], h5, a');
      const title = titleEl ? titleEl.innerText.trim() : '';

      const allElements = Array.from(card.querySelectorAll('*'));
      const priceTexts = allElements
        .filter(e => /^R\$\s*[\d\.,]+/i.test((e.innerText || '').trim()) && e.children.length === 0)
        .map(e => ({
          text: e.innerText.trim(),
          tag: e.tagName,
          className: e.className,
          parentClass: e.parentElement ? e.parentElement.className : ''
        }));

      const badges = Array.from(card.querySelectorAll('.badge, [class*="badge"], [class*="selo"], [class*="desconto"]')).map(b => b.innerText.trim());

      return {
        idx,
        title,
        badges,
        priceTexts,
        cardHTML: card.outerHTML.substring(0, 400)
      };
    });
  });

  console.log(`Found ${catalogProducts.length} product cards on catalog page 1.`);
  catalogProducts.slice(0, 15).forEach(p => {
    console.log(`\n[Item #${p.idx + 1}] "${p.title}"`);
    console.log(`  Badges:`, p.badges);
    console.log(`  Price Elements:`, p.priceTexts);
  });

  await browser.close();
}

inspectConstrujaCatalog().catch(err => console.error(err));
