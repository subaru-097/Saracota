const { chromium } = require('playwright');

async function inspectModalContent() {
  console.log('--- INSPECCIONANDO O CONTEÚDO DO MODAL DO CONSTRUJÁ ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Encontrar todos os elementos dentro de div.modal ou role=dialog
    const modalHTML = await page.evaluate(() => {
      const modal = document.querySelector('.modal, [role="dialog"], .modal-dialog, .modal-content');
      if (!modal) return 'Nenhum modal encontrado no DOM.';

      const inputs = Array.from(modal.querySelectorAll('input, button, a')).map((e) => ({
        tag: e.tagName,
        type: e.getAttribute('type'),
        id: e.id,
        name: e.getAttribute('name'),
        class: e.className,
        placeholder: e.getAttribute('placeholder'),
        text: e.innerText?.trim()?.slice(0, 80),
      }));

      return {
        outerHTML: modal.outerHTML.slice(0, 2000),
        inputs,
      };
    });

    console.log('--- RETORNO DO MODAL ---');
    console.log(JSON.stringify(modalHTML, null, 2));

  } catch (err) {
    console.error('Erro ao inspecionar modal:', err);
  } finally {
    await browser.close();
  }
}

inspectModalContent();
