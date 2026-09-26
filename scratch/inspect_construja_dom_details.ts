import { chromium } from 'playwright';

async function inspectDomDetails() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const pageDetails = await page.evaluate(() => {
    const text = document.body ? document.body.innerText : '';
    const paginatorText = Array.from(document.querySelectorAll('div, span, p')).map(e => e.textContent?.trim()).filter(t => t && (t.includes('Mostrando') || t.includes('de') || t.includes('produtos') || t.includes('Página')));
    const buttons = Array.from(document.querySelectorAll('button, a')).map(b => b.textContent?.trim()).filter(Boolean);

    return {
      paginatorText: paginatorText.slice(0, 30),
      buttons: buttons.filter(b => !isNaN(Number(b)) || b.includes('Próximo') || b.includes('Anterior') || b.includes('>>'))
    };
  });

  console.log('Dom details:', JSON.stringify(pageDetails, null, 2));
  await browser.close();
}

inspectDomDetails().catch(console.error);
