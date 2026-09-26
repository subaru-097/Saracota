import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';

async function testDimensaoApi() {
  console.log('🧪 Testando API REST de Busca por Dimensão/Subcategoria na Cicalfer...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://cicalfer.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Login B2B
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

    // Fazer fetch direto via contexto do browser logado para a API de busca por dimensao
    const testDimensaoId = '00000007'; // Abraçadeira Nylon Branca
    const apiResult = await page.evaluate(async (dimId) => {
      try {
        const res = await fetch(`https://api.cicalfer.com.br/v1/busca?dimensao=${dimId}&pagina=1`);
        const json = await res.json();
        return json;
      } catch (e: any) {
        return { error: e.message };
      }
    }, testDimensaoId);

    console.log('\n✅ RESPOSTA DA API CICALFER (dimensao 00000007):');
    console.log('Paginador:', JSON.stringify(apiResult?.paginator, null, 2));
    console.log('Total de itens na página:', apiResult?.itens?.length || 0);
    if (apiResult?.itens && apiResult.itens.length > 0) {
      console.log('Amostra 1º Item:', JSON.stringify(apiResult.itens[0], null, 2));
    }

  } catch (err: any) {
    console.error('Erro no teste da API:', err.message);
  } finally {
    await browser.close();
  }
}

testDimensaoApi();
