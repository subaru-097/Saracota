import { chromium } from 'playwright';

async function testPriceWithFilialIds() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let jwtToken = '';

  page.on('response', async res => {
    if (res.url().includes('/v1/login/b2b')) {
      try {
        const json = await res.json();
        if (json.token) jwtToken = json.token;
      } catch (e) {}
    }
  });

  await page.goto('https://cicalfer.com.br/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const cookieBtn = page.locator('button#botao-aceitar-todos').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  const loginTrigger = page.locator('button#botao-login, .componentes-button_login, a:has-text("Entrar")').first();
  if (await loginTrigger.isVisible().catch(() => false)) {
    await loginTrigger.click({ force: true });
    await page.waitForTimeout(1000);
  }

  await page.locator('input[name="email"].form-control, input[name="email"]').first().fill('santanacomercial2021@gmail.com');
  await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('871935');
  await page.waitForTimeout(500);
  await page.locator('button#btn-entrar, form button#btn-entrar').first().click({ force: true });
  await page.waitForTimeout(3500);

  await browser.close();

  console.log('JWT Token obtido:', jwtToken ? jwtToken.slice(0, 30) + '...' : 'FALHA');

  if (jwtToken) {
    console.log('\n--- TESTANDO POST /v1/produtos/0000000034/precos COM HEADERS B2B COMPLETOS ---');

    const headers = {
      'authorization': `Bearer ${jwtToken}`,
      'cliente-id': '0001267',
      'filial-id': '001',
      'app': 'VCOM',
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'accept': 'application/json'
    };

    const res = await fetch('https://api.cicalfer.com.br/v1/produtos/0000000034/precos', {
      method: 'POST',
      headers,
      body: JSON.stringify({ filtros: {} })
    });

    const data: any = await res.json();
    console.log('STATUS:', res.status);
    console.log('DESCRICAO:', data.descComp);
    console.log('PRECOS ARRAY:', JSON.stringify(data.precos, null, 2));

    console.log('\n--- TESTANDO POST /v1/busca COM HEADERS B2B COMPLETOS ---');
    const resBusca = await fetch('https://api.cicalfer.com.br/v1/busca', {
      method: 'POST',
      headers,
      body: JSON.stringify({ page: 1, orderBy: { campo: 'descricaocompleta', modo: 'ASC' }, filtros: { termo: '', produto_id: '', orcamento_id: '' } })
    });
    const dataBusca: any = await resBusca.json();
    if (dataBusca.itens && dataBusca.itens.length > 0) {
      console.log('ITEM 1 DA BUSCA:', dataBusca.itens[0].descComp);
      console.log('PRECOS DO ITEM 1:', JSON.stringify(dataBusca.itens[0].precos, null, 2));
    }
  }
}

testPriceWithFilialIds().catch(console.error);
