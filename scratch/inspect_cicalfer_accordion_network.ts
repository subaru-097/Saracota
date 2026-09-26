import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';

async function inspectCicalferAccordionNetwork() {
  console.log('🔍 Inspecionando rede (XHR/API) nos cliques do Accordion da Cicalfer B2B...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const apiCalls: { url: string; method: string; bodySample?: string }[] = [];

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('api') || url.includes('dimensao') || url.includes('categoria') || url.includes('produtos') || url.includes('busca')) {
      apiCalls.push({ url, method: req.method() });
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('dimensao') || url.includes('produtos') || url.includes('v1/')) {
      try {
        const text = await res.text();
        console.log(`\n📡 [API RESPONSE ${res.status()}] ${url.substring(0, 100)}...`);
        console.log(`   Sample JSON/Text: ${text.substring(0, 300)}`);
      } catch (e) {}
    }
  });

  try {
    console.log('Navegando e realizando login B2B...');
    await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const loginTrigger = page.locator('button#botao-login, .componentes-button_login, a:has-text("Entrar"), text=Entrar | Cadastrar').first();
    if (await loginTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginTrigger.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    const emailInput = page.locator('input[name="email"].form-control, input[name="email"]').first();
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill('santanacomercial2021@gmail.com');
      await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('871935');
      await page.waitForTimeout(1000);
      await page.locator('button#btn-entrar, form button#btn-entrar').first().click({ force: true });
      await page.waitForTimeout(4000);

      const filialEntrega = page.locator('.ModalClienteFilial_selectedTitle__uJhF8, .modal:has-text("ENTREGA")').first();
      if (await filialEntrega.isVisible({ timeout: 3000 }).catch(() => false)) {
        await filialEntrega.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1000);
        const confirmBtn = page.locator('span:has-text("Confirmar seleção"), button:has-text("Confirmar")').first();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(2000);
        }
      }
    }

    console.log('Navegando para a página de produtos onde fica a barra lateral de categorias/accordions...');
    await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Mapear acordeões de Nível 1 (Categorias Principais)
    const categoriasNivel1 = await page.evaluate(() => {
      const summaries = Array.from(document.querySelectorAll('.MuiAccordionSummary-root, [class*="MuiAccordionSummary"]'));
      return summaries.map((s, idx) => ({
        index: idx,
        text: (s.textContent || '').trim(),
      }));
    });

    console.log(`Categorias Nível 1 (MuiAccordionSummary) encontradas (${categoriasNivel1.length}):`, categoriasNivel1);

    // Clicar na primeira categoria relevante (ex: ELETRICA)
    const eletrAccordion = page.locator('.MuiAccordionSummary-root:has-text("ELETRICA"), [class*="MuiAccordionSummary"]:has-text("ELETRICA")').first();
    if (await eletrAccordion.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('Clicando para expandir Categoria Nível 1: ELETRICA...');
      await eletrAccordion.click({ force: true });
      await page.waitForTimeout(3000);

      // Mapear subcategorias de Nível 2
      const subcategoriasNivel2 = await page.evaluate(() => {
        const subDivs = Array.from(document.querySelectorAll('div[id^="dimensao-"]'));
        return subDivs.map((div) => {
          const span = div.querySelector('span.font-size-14.fw-medium.text-uppercase.text-start, span');
          return {
            id: div.id,
            title: span ? (span.textContent || '').trim() : '',
          };
        });
      });

      console.log(`Subcategorias Nível 2 em ELETRICA encontradas (${subcategoriasNivel2.length}):`);
      console.log(subcategoriasNivel2.slice(0, 10));

      // Clicar na primeira subcategoria Nível 2 para observar a requisição XHR/API disparada!
      if (subcategoriasNivel2.length > 0) {
        const firstSubId = subcategoriasNivel2[0].id;
        console.log(`\nClicando para expandir Subcategoria Nível 2 (${subcategoriasNivel2[0].title} - ID: ${firstSubId})...`);
        const subElement = page.locator(`#${firstSubId}`).first();
        if (await subElement.isVisible({ timeout: 3000 }).catch(() => false)) {
          await subElement.click({ force: true });
          await page.waitForTimeout(4000);
        }
      }
    }

    // Checar texto de paginação
    const pagText = await page.evaluate(() => {
      const el = document.querySelector('[class*="pagina"], [class*="Pagina"], [class*="registro"], [class*="mostrando"], div.text-muted');
      return el ? (el.textContent || '').trim() : document.body.innerText.substring(0, 1000);
    });
    console.log('\nTexto de Paginação / DOM amostra:', pagText.substring(0, 500));

  } catch (err: any) {
    console.error('Erro na inspeção do Accordion:', err.message);
  } finally {
    await browser.close();
  }
}

inspectCicalferAccordionNetwork();
