const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log('Navigating to Cofema...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  console.log('Clicking "Entre ou Cadastre-se"...');
  const entreBtn = page.locator('button:has-text("Entre ou Cadastre-se")').first();
  await entreBtn.click();
  await page.waitForTimeout(1500);

  const options = await page.evaluate(() => {
    const els = document.querySelectorAll('button, a, div[role="button"], li');
    return Array.from(els).map(el => ({
      text: el.innerText ? el.innerText.trim() : '',
      href: el.href || el.getAttribute('href') || '',
      tag: el.tagName,
      class: el.className
    })).filter(x => x.text && (x.text.includes('Entre') || x.text.includes('Cliente') || x.text.includes('Área') || x.text.includes('Login')));
  });

  console.log('Login menu options found:', JSON.stringify(options, null, 2));

  // Let's also check if there is a direct login URL like /page/login or /login
  console.log('Checking direct login URLs...');
  await page.goto('https://www.cofema.com.br/page/login').catch(() => {});
  await page.waitForTimeout(2000);
  console.log('URL for /page/login:', page.url());

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, button')).map(el => ({
      tag: el.tagName,
      id: el.id,
      name: el.name,
      type: el.type,
      placeholder: el.placeholder,
      class: el.className,
      text: el.innerText ? el.innerText.trim() : ''
    }));
  });
  console.log('Inputs/Buttons on current page:', JSON.stringify(inputs, null, 2));

  await browser.close();
})();
