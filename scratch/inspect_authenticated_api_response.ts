import { chromium } from 'playwright';

async function inspectAuthenticatedApiResponse() {
  console.log('🔍 EXTRAINDO CAMPO EXATO DE PREÇO DA API B2B CICALFER APÓS LOGIN...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1. Login
  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const cookieBtn = page.locator('button#botao-aceitar-todos, button:has-text("Aceitar todos")').first();
  if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cookieBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
  }

  const loginBtn = page.locator('button#botao-login').first();
  if (await loginBtn.isVisible().catch(() => false)) {
    await loginBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  const emailInput = page.locator('input[name="email"]').first();
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill('santanacomercial2021@gmail.com');
    await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('871935');
    await page.locator('button#btn-entrar').first().click({ force: true });
    await page.waitForTimeout(4000);

    const filialCard = page.locator('.ModalClienteFilial_optionCard__vj1Sf, div:has-text("ENTREGA")').first();
    if (await filialCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filialCard.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
      const confirmBtn = page.locator('button:has-text("Confirmar seleção"), span:has-text("Confirmar seleção")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }
  }

  console.log('✅ Autenticado! Fazendo POST /v1/busca no contexto da sessão...');

  const apiRes = await page.evaluate(async () => {
    const payload = {
      page: 1,
      orderBy: { campo: 'descricaocompleta', modo: 'ASC' },
      filtros: { termo: 'CABO', produto_id: '', orcamento_id: '' },
    };
    const r = await fetch('https://api.cicalfer.com.br/v1/busca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await r.json();
  });

  console.log(`Itens retornados pela API autenticada: ${apiRes?.itens?.length}`);
  if (apiRes?.itens?.length > 0) {
    console.log('\n--- ESTRUTURA DO ITEM 0 ---');
    console.log(JSON.stringify(apiRes.itens[0], null, 2));

    console.log('\n--- ESTRUTURA DO ITEM 1 ---');
    console.log(JSON.stringify(apiRes.itens[1], null, 2));
  }

  await browser.close();
}

inspectAuthenticatedApiResponse().catch(console.error);
