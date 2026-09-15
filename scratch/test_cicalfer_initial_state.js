const { chromium } = require('playwright');

async function testCicalferState() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to https://cicalfer.com.br/...');
  await page.goto('https://cicalfer.com.br/', { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  const modalCount = await page.locator('.modal.show, [role="dialog"]').count();
  console.log(`Modals/Dialogs count on load: ${modalCount}`);

  for (let i = 0; i < modalCount; i++) {
    const modalEl = page.locator('.modal.show, [role="dialog"]').nth(i);
    const text = await modalEl.evaluate(el => el.innerText).catch(() => '');
    console.log(`Modal #${i} text preview:`, text.replace(/\n+/g, ' | ').slice(0, 150));
  }

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, div.btn')).map(b => ({
      tag: b.tagName,
      id: b.id,
      className: b.className,
      text: b.innerText ? b.innerText.trim().slice(0, 40) : ''
    })).filter(b => b.text.length > 0);
  });

  console.log('Sample buttons/links found:', JSON.stringify(buttons.slice(0, 15), null, 2));

  await browser.close();
}

testCicalferState().catch(console.error);
