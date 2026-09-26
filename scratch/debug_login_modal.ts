import { chromium } from 'playwright';

async function debugLoginModal() {
  console.log('🔍 Debugando modal de login da Cicalfer...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const loginElements = await page.evaluate(() => {
    const elems = Array.from(document.querySelectorAll('button, a, div, span'));
    return elems
      .map(e => ({
        tag: e.tagName,
        id: e.id,
        className: e.className,
        text: (e.textContent || '').trim()
      }))
      .filter(e => e.text.includes('Entrar') || e.text.includes('Login') || e.id.includes('login') || e.className.includes('login'));
  });

  console.log('Login related elements in DOM:', JSON.stringify(loginElements, null, 2));

  // Try clicking the first match
  const firstTrigger = page.locator('text="Entrar | Cadastrar", text="Faça login", button#botao-login, a:has-text("Entrar")').first();
  if (await firstTrigger.isVisible().catch(() => false)) {
    console.log('Clicking trigger:', await firstTrigger.textContent());
    await firstTrigger.click();
    await page.waitForTimeout(2000);

    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(i => ({
        name: i.name,
        id: i.id,
        type: i.type,
        placeholder: i.placeholder
      }));
    });
    console.log('Inputs found after trigger click:', JSON.stringify(inputs, null, 2));
  }

  await browser.close();
}

debugLoginModal().catch(console.error);
