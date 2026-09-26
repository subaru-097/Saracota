import { chromium } from 'playwright';
import { realizarLogin } from '../core/services/supplier-quote-engine';

async function inspectTitlesAndPrices() {
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
  await page.goto('https://www.construja.com.br/produtos?pagina=1');
  await page.waitForTimeout(3000);

  const productData = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.col-6, .col-12, div[class*="col-"]')).filter(c => {
      return Boolean(c.querySelector('input[type="number"], button, [class*="Quantidade"]'));
    });

    return cards.map((c, i) => {
      const fullText = (c as HTMLElement).innerText.replace(/\n+/g, ' | ');
      return { index: i + 1, fullText };
    });
  });

  console.log('=== FIRST 10 CATALOG PRODUCTS RAW TEXT ===');
  productData.slice(0, 10).forEach(p => {
    console.log(`[Item ${p.index}] ${p.fullText}`);
  });

  await browser.close();
}

inspectTitlesAndPrices().catch(err => console.error(err));
