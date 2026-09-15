const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button')).map(el => ({
      tag: el.tagName,
      id: el.id,
      className: el.className,
      href: el.getAttribute('href'),
      text: (el.innerText || '').replace(/\n+/g, ' ').trim()
    })).filter(e => e.text.toLowerCase().includes('entrar') || e.text.toLowerCase().includes('login') || (e.href && e.href.includes('login')) || (e.id && e.id.includes('login')));
  });

  console.log('Links/Buttons de login no Construjá:', JSON.stringify(links, null, 2));
  await browser.close();
})();
