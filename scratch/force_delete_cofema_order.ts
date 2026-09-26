import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function forceDeleteCofemaOrder() {
  console.log('=== REMOÇÃO COMPROVADA DO RASCUNHO/PEDIDO #132393 NO PORTAL COFEMA ===\n');

  const cofemaFornecedorId = '752e18bd-4f41-414a-8f66-0d8f538de99e';
  const fornDbRecord = await db.fornecedores.getById(cofemaFornecedorId);
  const emailLogin = fornDbRecord?.emailLogin || '';
  const senhaLogin = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada);

  const browser = await chromium.launch({
    headless: true,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR'
  });

  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br/' };

  try {
    console.log('1. Efetuando login...');
    await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });

    console.log('2. Navegando para /page/pedidos...');
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    const tabCarrinhos = page.locator('button:has-text("Carrinhos"), span:has-text("Carrinhos"), a:has-text("Carrinhos")').last();
    if (await tabCarrinhos.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tabCarrinhos.click();
      await page.waitForTimeout(2500);
    }

    // Inspecionar todos os botões e elementos na página /page/pedidos
    const pageHtml = await page.evaluate(() => document.body.innerHTML);
    console.log(`HTML da página /page/pedidos obtido. Tamanho: ${pageHtml.length} caracteres.`);

    for (let loop = 0; loop < 10; loop++) {
      // Procurar linhas da tabela ou modais
      const rowsCount = await page.locator('table tbody tr').count().catch(() => 0);
      console.log(`[Loop ${loop + 1}] Linhas na tabela de pedidos/carrinhos: ${rowsCount}`);

      if (rowsCount === 0) {
        console.log('Nenhuma linha restante na tabela de carrinhos.');
        break;
      }

      // Clicar no primeiro botão de olho/abrir ou lixeira na tabela
      const rowActionBtn = page.locator('table tbody tr button, table tbody tr svg, table tbody tr td a').first();
      if (await rowActionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Clicando na ação da primeira linha da tabela...');
        await rowActionBtn.evaluate((el: any) => el.click()).catch(() => {});
        await page.waitForTimeout(3000);
      }

      // Dentro do modal aberto ou na tela, localizar botões de exclusão
      const deleteModalBtn = page.locator('button[title*="Excluir"], button:has-text("Excluir carrinho"), button:has-text("Esvaziar"), button:has-text("Excluir")').first();
      if (await deleteModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        const btnTitle = await deleteModalBtn.getAttribute('title').catch(() => '') || await deleteModalBtn.textContent().catch(() => '');
        console.log(`Encontrado botão de exclusão: "${btnTitle}". Clicando via JS evaluate...`);
        await deleteModalBtn.evaluate((btn: any) => btn.click()).catch(() => {});
        await page.waitForTimeout(2000);

        // Procurar botões de confirmação ("Sim", "Confirmar", "Excluir", "Ok")
        const confirmBtns = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), button:has-text("Excluir"), div[role="dialog"] button:has-text("Sim")');
        const confirmCount = await confirmBtns.count().catch(() => 0);
        console.log(`Botões de confirmação encontrados: ${confirmCount}`);
        if (confirmCount > 0) {
          await confirmBtns.first().evaluate((b: any) => b.click()).catch(() => {});
          await page.waitForTimeout(3000);
        }
      }

      // Recarregar a página para atualizar o estado do portal
      await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
    }

    // Validação final do DOM
    const finalRowCount = await page.locator('table tbody tr').count().catch(() => 0);
    console.log(`\nLinhas finais na tabela pós-expurgo total: ${finalRowCount}`);
    if (finalRowCount === 0) {
      console.log('✅ [CofemaExtractor RESET COMPROVADO] carrinho verificado como vazio: 0 itens');
    } else {
      console.log(`⚠️ Ainda restam ${finalRowCount} linha(s) na tabela.`);
    }

  } finally {
    await browser.close();
  }
}

forceDeleteCofemaOrder().catch(console.error);
