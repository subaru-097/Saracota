import { chromium } from 'playwright';

async function inspectSearchPage() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'commit' });
  await page.waitForTimeout(2000);

  const loginBtn = page.locator('button#botao-login, button:has-text("FAÇA LOGIN")').first();
  if (await loginBtn.isVisible().catch(() => false)) {
    await loginBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.locator('input[name="email"].form-control').first().fill('comercialsantana@gmail.com');
    await page.locator('input#senha[name="senha"]').first().fill('53597');
    await page.locator('button#btn-entrar').first().click({ force: true });
    await page.waitForTimeout(3000);
  }

  await page.goto('https://www.construja.com.br/produtos?pagina=1&busca=COLORGIN');
  await page.waitForTimeout(3000);

  console.log('Page URL:', page.url());
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Page text snippet (first 1500 chars):\n', bodyText.substring(0, 1500));

  const allRS = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .filter(e => e.children.length === 0 && (e.innerText || '').includes('R$'))
      .map(e => ({
        tag: e.tagName,
        text: e.innerText.trim(),
        class: e.className,
        parentTag: e.parentElement?.tagName,
        parentClass: e.parentElement?.className,
        style: window.getComputedStyle(e).textDecorationLine
      })).slice(0, 15);
  });

  console.log('Leaf elements with R$:\n', JSON.stringify(allRS, null, 2));

  await browser.close();
}

inspectSearchPage().catch(err => console.error(err));
