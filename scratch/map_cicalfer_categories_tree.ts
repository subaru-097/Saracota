import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';

async function mapCicalferCategoriesTree() {
  console.log('🌳 Mapeando árvore completa de Categorias e Subcategorias da Cicalfer B2B...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navegando e autenticando na Cicalfer...');
    await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

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

    await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Clicar em todas as categorias de nível 1 para expandir a lista de dimensao-XXXXXXXX-YYYYYYYY
    console.log('Expandindo os accordions de Nível 1...');
    await page.evaluate(() => {
      const summaries = Array.from(document.querySelectorAll('.MuiAccordionSummary-root, [class*="MuiAccordionSummary"]'));
      summaries.forEach((s) => (s as HTMLElement).click());
    });
    await page.waitForTimeout(3000);

    // Capturar a árvore completa usando o seletor exato informado pelo usuário
    const arvore = await page.evaluate(() => {
      const subDivs = Array.from(document.querySelectorAll('div[id^="dimensao-"]'));
      const mapCategoriaPai = new Map<string, { categoriaPaiId: string; subcategorias: { id: string; dimensaoId: string; titulo: string }[] }>();

      subDivs.forEach((div) => {
        const fullId = div.id; // ex: "dimensao-00000007-00001003"
        const parts = fullId.replace('dimensao-', '').split('-');
        const dimensaoId = parts[0];
        const categoriaPaiId = parts[1] || '00001003';

        const spanTitle = div.querySelector('span.font-size-14.fw-medium.text-uppercase.text-start, span');
        const titulo = spanTitle ? (spanTitle.textContent || '').trim() : fullId;

        if (!mapCategoriaPai.has(categoriaPaiId)) {
          mapCategoriaPai.set(categoriaPaiId, { categoriaPaiId, subcategorias: [] });
        }

        const catGroup = mapCategoriaPai.get(categoriaPaiId)!;
        if (dimensaoId && titulo && !catGroup.subcategorias.some((s) => s.dimensaoId === dimensaoId)) {
          catGroup.subcategorias.push({
            id: fullId,
            dimensaoId,
            titulo,
          });
        }
      });

      return Array.from(mapCategoriaPai.entries()).map(([paiId, data]) => ({
        categoriaPaiId: paiId,
        totalSubcategorias: data.subcategorias.length,
        subcategorias: data.subcategorias,
      }));
    });

    console.log(`\n🎉 ÁRVORE DE CATEGORIAS MAPEADA COM SUCESSO! (${arvore.length} Categorias Pai):`);
    let totalSubcategoriasGeral = 0;
    arvore.forEach((cat, idx) => {
      totalSubcategoriasGeral += cat.totalSubcategorias;
      console.log(`\n[Categoria ${idx + 1}] ID Pai: ${cat.categoriaPaiId} | Subcategorias: ${cat.totalSubcategorias}`);
      console.log('Amostra de 5 subcategorias:');
      cat.subcategorias.slice(0, 5).forEach((sub) => {
        console.log(`  - [Dimensão ${sub.dimensaoId}] ${sub.titulo}`);
      });
    });

    console.log(`\nTOTAL GERAL DE SUBCATEGORIAS EM TODAS AS CATEGORIAS PAI: ${totalSubcategoriasGeral}`);

  } catch (err: any) {
    console.error('Erro no mapeamento da árvore:', err.message);
  } finally {
    await browser.close();
  }
}

mapCicalferCategoriesTree();
