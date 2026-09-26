import { chromium } from 'playwright';

async function fetchDiversePromoItems() {
  console.log('=== STEP 1 & 2: DIVERSE PROMO ITEMS ON CONSTRUJÁ PORTAL ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  console.log('1. Navigating to Construjá...');
  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'commit', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Accept cookies if present
  const btnCookie = page.locator('#btn-aceitar-lgpd, button:has-text("Aceitar"), button:has-text("Concordar")').first();
  if (await btnCookie.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Accepting cookies...');
    await btnCookie.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Click login button to open modal
  const loginBtn = page.locator('button#botao-login, button:has-text("FAÇA LOGIN"), a:has-text("Entrar")').first();
  if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Clicking login button...');
    await loginBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  const emailInput = page.locator('input[name="email"].form-control, input[name="email"]').first();
  if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Filling login credentials...');
    await emailInput.fill('comercialsantana@gmail.com');
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('53597');
    await page.locator('button#btn-entrar').first().click({ force: true });
    await page.waitForTimeout(4000);
    console.log('Logged in successfully!');
  }

  // Terms to search
  const candidateTerms = [
    'COLORGIN',
    'DUCHA',
    'VEDALIT',
    'FORTLEV',
    'LORENZETTI',
    'NORTON',
    'HYDRA',
    'TEK BOND',
    'TINTA',
    'AMANCO'
  ];

  const promoItems: any[] = [];

  for (const term of candidateTerms) {
    if (promoItems.length >= 6) break;
    console.log(`\nSearching for term: "${term}"...`);
    await page.goto(`https://www.construja.com.br/produtos?pagina=1&busca=${encodeURIComponent(term)}`);
    await page.waitForTimeout(3000);

    const itemsFound = await page.evaluate(() => {
      // Find cards or items
      const cards = Array.from(document.querySelectorAll('div[class*="cardProduto"], div[class*="itemContainer"], div[class*="Produto_card"]'));
      const results: any[] = [];

      cards.forEach(card => {
        const text = card.innerText || '';
        if (!text.includes('R$')) return;

        const titleEl = card.querySelector('span[class*="tituloProduto"], h5, a, div[class*="titulo"]');
        const title = titleEl ? titleEl.innerText.trim() : card.innerText.split('\n')[0].trim();

        // Find all R$ matches inside element
        const matches = text.match(/R\$\s*[\d\.,]+/gi) || [];
        
        // Find strikethrough elements inside card
        const strikethroughEls = Array.from(card.querySelectorAll('*')).filter(e => {
          if (e.children.length > 0) return false;
          const style = window.getComputedStyle(e);
          const parentStyle = e.parentElement ? window.getComputedStyle(e.parentElement) : null;
          const isLineThrough = Boolean(style.textDecorationLine.includes('line-through')) ||
                                Boolean(parentStyle && parentStyle.textDecorationLine.includes('line-through')) ||
                                Boolean(e.closest('.text-decoration-line-through, .line-through, .text-muted, del, s, strike, [class*="SemDesconto"], [class*="sem-desconto"]')) ||
                                Boolean(e.classList && (e.classList.contains('text-decoration-line-through') || e.classList.contains('text-muted')));
          return isLineThrough && /^R\$\s*[\d\.,]+/i.test((e.innerText || '').trim());
        });

        const nonStrikethroughEls = Array.from(card.querySelectorAll('*')).filter(e => {
          if (e.children.length > 0) return false;
          const style = window.getComputedStyle(e);
          const parentStyle = e.parentElement ? window.getComputedStyle(e.parentElement) : null;
          const isLineThrough = Boolean(style.textDecorationLine.includes('line-through')) ||
                                Boolean(parentStyle && parentStyle.textDecorationLine.includes('line-through')) ||
                                Boolean(e.closest('.text-decoration-line-through, .line-through, .text-muted, del, s, strike, [class*="SemDesconto"], [class*="sem-desconto"]')) ||
                                Boolean(e.classList && (e.classList.contains('text-decoration-line-through') || e.classList.contains('text-muted')));
          return !isLineThrough && /^R\$\s*[\d\.,]+/i.test((e.innerText || '').trim());
        });

        if (strikethroughEls.length > 0 && nonStrikethroughEls.length > 0) {
          results.push({
            title,
            strikethroughPrice: strikethroughEls[0].innerText.trim(),
            promoPrice: nonStrikethroughEls[0].innerText.trim(),
            allMatches: matches
          });
        }
      });

      return results;
    });

    for (const item of itemsFound) {
      if (!promoItems.some(p => p.title === item.title)) {
        promoItems.push(item);
        console.log(`  ✅ DIVERSE PROMO MATCH: "${item.title}"`);
        console.log(`     - Strikethrough: ${item.strikethroughPrice}`);
        console.log(`     - Promotional:   ${item.promoPrice}`);
        if (promoItems.length >= 6) break;
      }
    }
  }

  console.log('\n==================================================');
  console.log('BASELINE PROMO ITEMS FOR REGRESSION TEST (TOTAL:', promoItems.length, ')');
  console.log('==================================================');
  promoItems.forEach((item, idx) => {
    console.log(`[Item ${idx + 1}]`);
    console.log(`  Name: ${item.title}`);
    console.log(`  Strikethrough (Original): ${item.strikethroughPrice}`);
    console.log(`  Promotional (Final):    ${item.promoPrice}`);
  });

  await browser.close();
}

fetchDiversePromoItems().catch(err => console.error(err));
