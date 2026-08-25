const { chromium } = require('playwright');
const fs = require('fs');

async function inspectPage() {
  console.log('--- INICIANDO INSPEÇÃO REAL DE DOM DO CONSTRUJÁ ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('1. Navegando para https://www.construja.com.br/produtos...');
    await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    const title = await page.title();
    console.log('Título da página:', title);
    console.log('URL atual:', page.url());

    // Procurar todos os inputs visíveis e ocultos na página
    const inputs = await page.$$eval('input', (els) =>
      els.map((e) => ({
        type: e.getAttribute('type'),
        id: e.id,
        name: e.getAttribute('name'),
        class: e.className,
        placeholder: e.getAttribute('placeholder'),
        isVisible: e.offsetWidth > 0 && e.offsetHeight > 0,
      }))
    );

    console.log('--- INPUTS ENCONTRADOS EM /produtos ---');
    console.log(JSON.stringify(inputs, null, 2));

    // Procurar links ou botões de login/entrar na header
    const actionElements = await page.$$eval('a, button', (els) =>
      els
        .filter((e) => {
          const txt = (e.innerText || e.getAttribute('title') || '').toLowerCase();
          const href = (e.getAttribute('href') || '').toLowerCase();
          return txt.includes('entrar') || txt.includes('login') || txt.includes('conta') || href.includes('login');
        })
        .map((e) => ({
          tag: e.tagName,
          text: e.innerText?.trim(),
          href: e.getAttribute('href'),
          class: e.className,
          id: e.id,
        }))
    );

    console.log('--- BOTÕES / LINKS DE LOGIN ENCONTRADOS NA HEADER ---');
    console.log(JSON.stringify(actionElements, null, 2));

    // Salvar dump do HTML renderizado após JS
    const htmlContent = await page.content();
    fs.writeFileSync('./construja_rendered.html', htmlContent.slice(0, 100000), 'utf-8');
    console.log('HTML Dump parcial salvo em construja_rendered.html');

  } catch (err) {
    console.error('Erro durante a inspeção Playwright:', err);
  } finally {
    await browser.close();
  }
}

inspectPage();
