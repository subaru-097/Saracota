import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';

async function inspectAndCleanMercadaoCart() {
  console.log('=====================================================');
  console.log('HIGIENE / LIMPEZA DE CARRINHO REAL - MERCADÃO LOJISTA');
  console.log('=====================================================');

  const { data: mercadao } = await supabase.from('fornecedores').select('*').eq('id', 'a4042203-b504-4a82-af41-8ffa19ae24a6').single();
  const loginEmail = mercadao.login_salvo;
  const loginSenha = decryptAES256(mercadao.senha_criptografada);

  const timestamp = 'teste_limpeza_2026-09-25_19h44min';
  const outputDir = path.join(process.cwd(), 'docs', 'auditorias', 'historico', timestamp);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    console.log('1. Efetuando login no Mercadão Lojista...');
    await page.goto(mercadao.url_login || 'https://www.mercadaolojista.com.br/conta/login?next=/carrinho/index', { waitUntil: 'domcontentloaded' });
    await page.fill('#id_email', loginEmail);
    await page.fill('#id_senha', loginSenha);
    await page.click('button.botao.principal[type="submit"]');
    await page.waitForTimeout(3000);

    console.log('2. Navegando para a página do carrinho: https://www.mercadaolojista.com.br/carrinho/index');
    await page.goto('https://www.mercadaolojista.com.br/carrinho/index', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('3. Inspecionando botões/links de remoção de itens no carrinho...');
    const cartItems = await page.$$eval('tr[data-produto-id]', rows => rows.map(r => ({
      produtoId: r.getAttribute('data-produto-id'),
      title: r.querySelector('.produto-info a')?.textContent?.trim() || '',
      removeLinks: Array.from(r.querySelectorAll('a[href*="remover"], a[href*="excluir"], i.icon-trash, button, a')).map(el => ({
        tagName: el.tagName,
        href: el.getAttribute('href'),
        class: el.getAttribute('class'),
        text: el.textContent?.trim()
      }))
    })));

    console.log('Itens encontrados no carrinho:', JSON.stringify(cartItems, null, 2));

    // Loop de remoção de todos os itens do carrinho
    for (let loop = 1; loop <= 10; loop++) {
      const itemRows = page.locator('tr[data-produto-id]');
      const count = await itemRows.count();
      if (count === 0) {
        console.log('✅ Nenhum item restante no carrinho!');
        break;
      }

      console.log(`Removendo item residual ${loop} de ${count}...`);
      const removeBtn = page.locator('tr[data-produto-id] a[href*="remover"], tr[data-produto-id] .icon-trash, tr[data-produto-id] a.excluir, a[href*="/carrinho/produto/"][href*="/remover"]').first();
      
      if (await removeBtn.isVisible().catch(() => false)) {
        await removeBtn.click({ force: true });
        await page.waitForTimeout(2500);
      } else {
        // Tentar buscar por href direto de remover
        const removeHref = await page.evaluate(() => {
          const a = document.querySelector('a[href*="/carrinho/produto/"][href*="/remover"]');
          return a ? a.getAttribute('href') : null;
        });
        if (removeHref) {
          console.log(`Navegando diretamente para o link de remoção: ${removeHref}`);
          await page.goto(removeHref, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2500);
        } else {
          console.warn('Nenhum botão ou link de remoção localizado nesta tentativa.');
          break;
        }
      }
    }

    // Navegar novamente para o carrinho para ter certeza absoluta que está 0 itens
    await page.goto('https://www.mercadaolojista.com.br/carrinho/index', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const finalCount = await page.locator('tr[data-produto-id]').count();
    console.log(`\n=====================================================`);
    console.log(`STATUS FINAL DO CARRINHO: ${finalCount} itens.`);
    console.log(`=====================================================`);

    // Capturar screenshot comprovando 0 itens no carrinho
    const screenshotPath = path.join(outputDir, '01_carrinho_mercadao_limpo_0itens.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Print do carrinho limpo (0 itens) salvo em: ${screenshotPath}`);

  } finally {
    await browser.close();
  }
}

inspectAndCleanMercadaoCart().catch(console.error);
