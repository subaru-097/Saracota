import { chromium } from 'playwright';
import { supabase } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';

async function testCartQtySubmit() {
  const { data: mercadao } = await supabase.from('fornecedores').select('*').eq('id', 'a4042203-b504-4a82-af41-8ffa19ae24a6').single();
  const loginEmail = mercadao.login_salvo;
  const loginSenha = decryptAES256(mercadao.senha_criptografada);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    console.log('1. Logando no Mercadão Lojista...');
    await page.goto(mercadao.url_login, { waitUntil: 'domcontentloaded' });
    await page.fill('#id_email', loginEmail);
    await page.fill('#id_senha', loginSenha);
    await page.click('button.botao.principal[type="submit"]');
    await page.waitForTimeout(3000);

    console.log('2. Buscando Chave Combinada 27mm...');
    await page.fill('#auto-complete', 'chave combinada');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Get href of buy button for Chave Combinada 27mm
    const productHref = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('a.produto-sobrepor'));
      const idx = cards.findIndex(c => (c.getAttribute('title') || '').toLowerCase().includes('27mm'));
      const card = cards[idx];
      if (!card) return null;
      const parent = card.closest('.listagem-item, li, div.span3, .produto-item') || card.parentElement;
      const buyBtn = parent ? parent.querySelector('a.botao-comprar-ajax') : null;
      return buyBtn ? buyBtn.getAttribute('href') : null;
    });

    console.log(`Href de adição do produto 27mm: ${productHref}`);
    if (productHref) {
      await page.goto(productHref, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    }

    console.log('3. Indo para o carrinho...');
    await page.goto('https://www.mercadaolojista.com.br/carrinho/index', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Inspecionar formulário de quantidade no carrinho
    const forms = await page.$$eval('form', els => els.map(f => ({
      action: f.getAttribute('action'),
      method: f.getAttribute('method'),
      inputs: Array.from(f.querySelectorAll('input')).map(i => ({ name: i.getAttribute('name'), value: i.getAttribute('value'), type: i.getAttribute('type') })),
      buttons: Array.from(f.querySelectorAll('button, input[type="submit"]')).map(b => ({ text: b.textContent?.trim(), outer: b.outerHTML }))
    })));

    console.log('Formulários no carrinho:', JSON.stringify(forms, null, 2));

    // Atualizar quantidade para 15
    console.log('4. Atualizando quantidade para 15...');
    const qtyInput = page.locator('input[name="quantidade"]').first();
    await qtyInput.fill('15');

    // Tentar clicar no botão com ícone de atualizar ou submit
    const updateBtn = page.locator('button:has-text("Atualizar"), button.btn-atualizar, button[type="submit"], input[value*="Atualizar"], .icon-refresh').first();
    if (await updateBtn.isVisible().catch(() => false)) {
      console.log('Clicando em updateBtn...');
      await updateBtn.click();
    } else {
      console.log('Submetendo form via dispatchEvent/Enter...');
      await qtyInput.press('Enter');
    }

    await page.waitForTimeout(4000);

    const finalQty = await page.locator('input[name="quantidade"]').first().inputValue();
    const finalSubtotal = await page.locator('strong.valor-subtotal').innerText();
    const finalTotal = await page.locator('strong.valor-total').innerText();

    console.log(`\n✅ RESULTADO DO TESTE:`);
    console.log(`  Quantidade no Carrinho: ${finalQty}`);
    console.log(`  Subtotal Carrinho: ${finalSubtotal}`);
    console.log(`  Total Pedido: ${finalTotal}`);

  } finally {
    await browser.close();
  }
}

testCartQtySubmit().catch(console.error);
