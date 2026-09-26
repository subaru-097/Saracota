import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaLimparCarrinho, cofemaAdicionarItem } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testPedidosPageCart() {
  console.log('=== TESTANDO NAVEGAÇÃO E EXTRAÇÃO EM /page/pedidos ===');
  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const user = fornDbRecord?.emailLogin || fornDbRecord?.login_salvo || '43.313.798/0001-34';
  const pass = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br/', selectors: fornDbRecord?.seletores };

  try {
    await cofemaRealizarLogin(page, config, { user, pass });
    console.log('1. Login OK. Adicionando item: Chave Inglesa 12 Brasfort (5 un)...');

    const addRes = await cofemaAdicionarItem(page, config, 'Chave Inglesa 12', 5, {});
    console.log('Adição concluída:', addRes);

    console.log('2. Navegando para https://www.cofema.com.br/page/pedidos...');
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    console.log('URL atual:', page.url());

    // Inspecionar abas e botões em /page/pedidos
    const pageContent = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button, a, [role="tab"]')).map(el => el.innerText.trim()).filter(Boolean);
      return {
        title: document.title,
        tabs,
        bodySnippet: document.body.innerText.substring(0, 1500)
      };
    });

    console.log('Conteúdo da página /page/pedidos:\n', JSON.stringify(pageContent, null, 2));

    // Clicar na aba Carrinhos se visível
    const tabCarrinhos = page.locator('button:has-text("Carrinhos"), [role="tab"]:has-text("Carrinhos"), a:has-text("Carrinhos")').first();
    if (await tabCarrinhos.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('Clicando na aba Carrinhos...');
      await tabCarrinhos.click({ force: true });
      await page.waitForTimeout(2000);

      const tabContent = await page.evaluate(() => document.body.innerText.substring(0, 1500));
      console.log('Conteúdo após clicar em Carrinhos:\n', tabContent);
    }

    // Tentar expandir o modal do carrinho mais recente / ativo
    const cartRow = page.locator('tr:has-text("R$"), div:has-text("Carrinho"), button:has-text("Ver"), svg.lucide-eye').first();
    if (await cartRow.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('Clicando na linha/botão do carrinho ativo...');
      await cartRow.click({ force: true });
      await page.waitForTimeout(3000);

      // Print do modal aberto
      await page.screenshot({ path: 'scratch/modal_pedidos_cofema.png', fullPage: true });
      console.log('Screenshot do modal salvo em scratch/modal_pedidos_cofema.png');

      const modalText = await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"], div[class*="modal"]') || document.body;
        return modal.innerText;
      });
      console.log('Texto do Modal Detalhes do Pedido:\n', modalText.substring(0, 2000));
    }

  } catch (err: any) {
    console.error('Erro em /page/pedidos:', err);
  } finally {
    await browser.close();
  }
}

testPedidosPageCart();
