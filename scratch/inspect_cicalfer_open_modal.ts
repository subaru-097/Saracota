import { chromium } from 'playwright';

async function inspectOpenModal() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://cicalfer.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const modalInfo = await page.evaluate(() => {
    const modal = document.querySelector('.modal.show, .modal');
    if (!modal) return { hasModal: false };
    return {
      hasModal: true,
      className: modal.className,
      innerText: (modal as HTMLElement).innerText.slice(0, 300),
      buttons: Array.from(modal.querySelectorAll('button, a')).map(b => ({
        text: (b.textContent || '').trim(),
        className: b.className,
        id: b.id
      })),
      inputs: Array.from(modal.querySelectorAll('input')).map(i => ({
        name: i.name,
        type: i.type,
        placeholder: i.placeholder
      }))
    };
  });

  console.log('Modal on load:', JSON.stringify(modalInfo, null, 2));

  await browser.close();
}

inspectOpenModal().catch(console.error);
