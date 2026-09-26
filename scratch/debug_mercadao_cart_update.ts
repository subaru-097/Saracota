import { chromium } from 'playwright';
import { supabase } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';

async function debugCartUpdate() {
  const { data: mercadao } = await supabase.from('fornecedores').select('*').eq('id', 'a4042203-b504-4a82-af41-8ffa19ae24a6').single();
  const loginEmail = mercadao.login_salvo;
  const loginSenha = decryptAES256(mercadao.senha_criptografada);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
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

    console.log('3. Clicando Adicionar ao carrinho no 27mm...');
    const cards = await page.$$eval('a.produto-sobrepor', els => els.map(el => el.getAttribute('title') || ''));
    const index27 = cards.findIndex(t => t.toLowerCase().includes('27mm'));
    console.log(`Index 27mm: ${index27} - Title: ${cards[index27]}`);

    const buyBtns = page.locator('a.botao-comprar-ajax');
    await buyBtns.nth(index27).click();
    await page.waitForTimeout(3000);

    console.log('4. Indo para o carrinho...');
    await page.goto('https://www.mercadaolojista.com.br/carrinho/index', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('5. Inspecionando formulário do carrinho...');
    const cartHtml = await page.evaluate(() => {
      const table = document.querySelector('table');
      return table ? table.outerHTML : document.body.innerHTML.substring(0, 5000);
    });

    console.log('HTML do carrinho (primeiros 2000 chars):');
    console.log(cartHtml.substring(0, 2000));

    // Testar atualização da quantidade para 15
    console.log('\n6. Testando atualização de quantidade para 15...');
    const qtyInput = page.locator('input[name="quantidade"]').first();
    await qtyInput.fill('15');

    // Inspecionar botões dentro da linha do produto
    const rowButtons = await page.$$eval('tr[data-produto-id] button, tr[data-produto-id] input[type="submit"], form button, form input[type="submit"]', els =>
      els.map(el => ({
        tagName: el.tagName,
        type: el.getAttribute('type'),
        value: el.getAttribute('value'),
        text: el.textContent?.trim(),
        outerHTML: el.outerHTML
      }))
    );
    console.log('Botões no formulário/linha do produto:', JSON.stringify(rowButtons, null, 2));

    // Pressionar enter no qtyInput ou clicar no submit do form
    const form = page.locator('form:has(input[name="quantidade"])').first();
    if (await form.count() > 0) {
      console.log('Submetendo formulário da quantidade...');
      await form.evaluate((f: any) => f.submit());
    } else {
      await qtyInput.press('Enter');
    }

    await page.waitForTimeout(4000);

    const updatedQty = await page.locator('input[name="quantidade"]').first().inputValue();
    const updatedSubtotal = await page.locator('strong.valor-subtotal').innerText().catch(() => '');
    console.log(`\nRESULTADO DA ATUALIZAÇÃO DA QUANTIDADE: Qtd no input = "${updatedQty}" | Subtotal = "${updatedSubtotal}"`);

  } finally {
    await browser.close();
  }
}

debugCartUpdate().catch(console.error);
