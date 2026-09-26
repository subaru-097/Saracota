import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';

async function testCicalferDirectApi() {
  console.log('🧪 Testando API REST oficial da Cicalfer por Dimensão/Subcategoria...');

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

    // Testar chamada à API de busca por dimensao (subcategoria 00000007)
    const resDimensao = await page.evaluate(async () => {
      try {
        const res = await fetch('https://api.cicalfer.com.br/v1/busca?dimensao=00000007&pagina=1');
        return await res.json();
      } catch (e: any) {
        return { error: e.message };
      }
    });

    console.log('\n✅ RESPOSTA DA API CICALFER (subcategoria 00000007 - Abraçadeira Nylon Branca):');
    console.log('Paginador:', JSON.stringify(resDimensao?.paginator, null, 2));
    console.log('Quantidade de itens retornados:', resDimensao?.itens?.length || 0);

    if (resDimensao?.itens && resDimensao.itens.length > 0) {
      console.log('Primeiro produto retornado pela API:');
      console.log('  ID Exibição / Ref:', resDimensao.itens[0].idExibicao);
      console.log('  Descrição Completa:', resDimensao.itens[0].descComp);
      console.log('  Embalagem:', resDimensao.itens[0].emb);
      console.log('  Unidade:', resDimensao.itens[0].und);
      console.log('  Preço/Preço Tabela:', resDimensao.itens[0].preco || resDimensao.itens[0].preco_tabela || 'Liberado B2B');
    }

  } catch (err: any) {
    console.error('Erro na chamada da API Cicalfer:', err.message);
  } finally {
    await browser.close();
  }
}

testCicalferDirectApi();
