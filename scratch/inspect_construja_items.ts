import { chromium } from 'playwright';
import { realizarLogin } from '../core/services/supplier-quote-engine';

async function dumpConstrujaProducts() {
  console.log('=== DUMPING CONSTRUJÁ PRODUCT CARDS & PRICES ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const config = {
    nome: 'Construjá',
    slug: 'construja',
    url_site: 'https://www.construja.com.br/produtos',
    login_url: 'https://www.construja.com.br/produtos',
    selectors: {
      login_trigger: '#botao-login',
      username_input: 'input[name="email"].form-control, input[type="email"]',
      password_input: 'input#senha[name="senha"], input[type="password"]',
      login_submit: 'button#btn-entrar, button[type="submit"]',
    }
  };

  await realizarLogin(page, config, { user: 'comercialsantana@gmail.com', pass: '53597' });

  // Go to catalog page 1
  await page.goto('https://www.construja.com.br/produtos?pagina=1');
  await page.waitForTimeout(3000);

  const products = await page.evaluate(() => {
    // Find all product containers
    const cards = Array.from(document.querySelectorAll('.col-6, .col-12, div[class*="col-"]')).filter(c => {
      return Boolean(c.querySelector('input[type="number"], button, [class*="Quantidade"]'));
    });

    return cards.map((card, i) => {
      const titleEl = card.querySelector('h5, a, span[class*="titulo"], div[class*="titulo"]');
      const title = titleEl ? titleEl.innerText.trim() : '';

      const priceEls = Array.from(card.querySelectorAll('*'))
        .filter(e => /^R\$\s*[\d\.,]+/i.test((e.innerText || '').trim()) && e.children.length === 0)
        .map(e => {
          const style = window.getComputedStyle(e);
          const parentStyle = e.parentElement ? window.getComputedStyle(e.parentElement) : null;
          const isStrikethrough = (style && style.textDecorationLine && style.textDecorationLine.includes('line-through')) ||
                                 (parentStyle && parentStyle.textDecorationLine && parentStyle.textDecorationLine.includes('line-through')) ||
                                 Boolean(e.closest('.text-decoration-line-through, .line-through, .text-muted, .price-old, del, s, strike, [class*="SemDesconto"], [class*="sem-desconto"], [class*="PrecoSemDesconto"], [class*="oldPrice"], [class*="old-price"]')) ||
                                 (e.classList && (e.classList.contains('text-decoration-line-through') || e.classList.contains('text-muted') || (e.className || '').toString().includes('SemDesconto')));
          return {
            text: e.innerText.trim(),
            tag: e.tagName,
            className: e.className,
            isStrikethrough
          };
        });

      return {
        index: i,
        title,
        priceEls,
        hasStrikethrough: priceEls.some(p => p.isStrikethrough)
      };
    });
  });

  console.log(`Found ${products.length} product cards with quantity inputs on catalog page 1:`);
  products.forEach(p => {
    console.log(`\n[Product #${p.index + 1}] "${p.title}" (Has Strikethrough: ${p.hasStrikethrough})`);
    p.priceEls.forEach(pr => console.log(`   - ${pr.text} | Tag: ${pr.tag}.${pr.className} | Strikethrough: ${pr.isStrikethrough}`));
  });

  await browser.close();
}

dumpConstrujaProducts().catch(err => console.error(err));
