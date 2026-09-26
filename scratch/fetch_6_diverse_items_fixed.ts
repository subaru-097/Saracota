import { chromium } from 'playwright';

async function fetch6DiverseItems() {
  console.log('=== STEP 1 & 2: FETCHING 6 DIVERSE PROMO ITEMS FROM CONSTRUJÁ ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  console.log('Navigating to Construjá produtos page...');
  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'commit', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Accept cookies if present
  const btnCookie = page.locator('#btn-aceitar-lgpd, button:has-text("Aceitar"), button:has-text("Concordar")').first();
  if (await btnCookie.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btnCookie.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Open login modal
  const loginTrigger = page.locator('button#botao-login, button:has-text("FAÇA LOGIN"), a:has-text("Entrar")').first();
  const emailInput = page.locator('input[name="email"].form-control, input[name="email"]').first();

  if (!(await emailInput.isVisible({ timeout: 1500 }).catch(() => false))) {
    if (await loginTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loginTrigger.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  }

  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Logging in with B2B credentials...');
    await emailInput.fill('comercialsantana@gmail.com');
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('53597');
    await page.locator('button#btn-entrar').first().click({ force: true });
    await page.waitForTimeout(4000);
    console.log('Login successful!');
  } else {
    console.error('Email input not visible!');
    await browser.close();
    return;
  }

  // Search terms across different categories
  const terms = [
    'COLORGIN PRETO',
    'COLORGIN MARROM',
    'DUCHA',
    'DISCO',
    'HYDRA',
    'SILICONE',
    'VEDALIT',
    'FORTLEV',
    'TINTA'
  ];

  const itemsFound: any[] = [];

  for (const term of terms) {
    if (itemsFound.length >= 6) break;
    console.log(`\nSearching category term: "${term}"...`);
    await page.goto(`https://www.construja.com.br/produtos?pagina=1&busca=${encodeURIComponent(term)}`);
    await page.waitForTimeout(3500);

    const cardsData = await page.evaluate(() => {
      // Find cards by product class
      const cards = Array.from(document.querySelectorAll('div[class*="cardProduto"], div[class*="CardProduto"], div[class*="Produto_card"]'));
      
      const results: any[] = [];
      cards.forEach(card => {
        const titleEl = card.querySelector('span[class*="tituloProduto"], h5, a[href*="/produto/"], div[class*="titulo"]');
        const title = titleEl ? titleEl.innerText.trim() : '';
        if (!title || title.length < 5) return;

        // Find leaf R$ elements
        const leafRS = Array.from(card.querySelectorAll('*')).filter(e => e.children.length === 0 && /^R\$\s*[\d\.,]+/i.test((e.innerText || '').trim()));
        
        let strikethrough: string | null = null;
        let promo: string | null = null;

        leafRS.forEach(e => {
          const val = (e.innerText || '').trim();
          const style = window.getComputedStyle(e);
          const pStyle = e.parentElement ? window.getComputedStyle(e.parentElement) : null;
          const isStrike = style.textDecorationLine.includes('line-through') ||
                          (pStyle && pStyle.textDecorationLine.includes('line-through')) ||
                          Boolean(e.closest('.text-decoration-line-through, .line-through, .text-muted, del, s, strike, [class*="SemDesconto"], [class*="sem-desconto"], [class*="PrecoSemDesconto"]')) ||
                          (e.classList && (e.classList.contains('text-decoration-line-through') || e.classList.contains('text-muted')));
          
          if (isStrike && !strikethrough) {
            strikethrough = val;
          } else if (!isStrike && !promo) {
            promo = val;
          }
        });

        if (strikethrough && promo) {
          results.push({
            title,
            strikethrough,
            promo
          });
        }
      });

      return results;
    });

    for (const card of cardsData) {
      if (!itemsFound.some(i => i.title === card.title)) {
        itemsFound.push(card);
        console.log(`  ✅ PROMO PRODUCT FOUND: "${card.title}"`);
        console.log(`     - Strikethrough (Original): ${card.strikethrough}`);
        console.log(`     - Promotional (Final):    ${card.promo}`);
        if (itemsFound.length >= 6) break;
      }
    }
  }

  console.log('\n================================================================');
  console.log(`BASELINE DIVERSE PROMO ITEMS CAPTURED (TOTAL: ${itemsFound.length})`);
  console.log('================================================================');
  itemsFound.forEach((item, idx) => {
    console.log(`[Item ${idx + 1}]`);
    console.log(`  Name: ${item.title}`);
    console.log(`  Strikethrough Price: ${item.strikethrough}`);
    console.log(`  Promotional Price:   ${item.promo}`);
  });

  await browser.close();
}

fetch6DiverseItems().catch(err => console.error(err));
