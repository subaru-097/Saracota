const { chromium } = require('playwright');
const fs = require('fs');

async function inspectCofemaDOM() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Extrair todos os botões, links e inputs da página inicial
  const info = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a')).map(a => ({ text: a.innerText.trim(), href: a.href }));
    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({ text: b.innerText.trim(), class: b.className, id: b.id }));
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({ name: i.name, id: i.id, placeholder: i.placeholder, type: i.type }));
    return { links, buttons, inputs, title: document.title, url: window.location.href };
  });

  console.log('Title:', info.title);
  console.log('URL:', info.url);
  console.log('Inputs found:', info.inputs);
  console.log('Buttons found:', info.buttons.slice(0, 15));
  console.log('Links containing login/entre/area:', info.links.filter(l => /login|entre|cliente|entrar|cadastr/i.test(l.text || l.href)));

  await browser.close();
}

inspectCofemaDOM();
