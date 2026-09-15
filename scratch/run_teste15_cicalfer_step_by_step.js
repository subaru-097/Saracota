const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { decryptAES256 } = require('../lib/security/vault');
const { db } = require('../lib/db/client');

(async () => {
  console.log('=================================================================');
  console.log('=== TESTE 15: INVESTIGAÇÃO PASSO A PASSO DA CICALFER (SOLO) ===');
  console.log('=================================================================');

  const outputDir = path.join(process.cwd(), 'historicos', '2026-09-15', 'teste15_correcao_definitiva', 'cicalfer');
  fs.mkdirSync(outputDir, { recursive: true });

  const logFilePath = path.join(outputDir, 'execucao.log');
  const logStream = fs.createWriteStream(logFilePath, { flags: 'w' });

  function log(msg) {
    const timeStr = `[${new Date().toISOString()}] ${msg}`;
    console.log(timeStr);
    logStream.write(timeStr + '\n');
  }

  log('Iniciando diagnóstico detalhado da Cicalfer...');

  // 1. Obter credenciais do banco
  const fornCicalfer = await db.fornecedores.getById('33e03495-100d-45a3-9e34-899de56b0ab1');
  const user = fornCicalfer.email || 'santanacomercial2021@gmail.com';
  const pass = decryptAES256(fornCicalfer.senhaCriptografada || fornCicalfer.rawSenhaCriptografada);

  log(`Credenciais lidas do banco: User: "${user}" | Pass Length: ${pass ? pass.length : 0}`);

  // Launch browser for site inspection
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // ETAPA 1: Login B2B na Cicalfer
  log('Etapa 1: Navegando para a Cicalfer (https://cicalfer.com.br/)...');
  await page.goto('https://cicalfer.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outputDir, '01_home_inicial.png'), fullPage: false });

  // Fechar qualquer modal inicial se visível (cookies/filial)
  log('Verificando se há modal ou banner de cookies bloqueando a tela...');
  const cookieBtn = page.locator('button:has-text("Aceitar todos"), button:has-text("Aceitar")').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    log('Aceitando cookies...');
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  log('Clicando para abrir modal de login...');
  const loginTrigger = page.locator('.dropdown:has-text("Entrar"), a:has-text("Entrar"), button#botao-login').first();
  await loginTrigger.click({ force: true }).catch(e => log(`Warning ao clicar loginTrigger: ${e.message}`));
  await page.waitForTimeout(1500);

  log('Preenchendo e-mail e senha...');
  const emailInput = page.locator('input[name="email"].form-control, input[name="email"]').first();
  const passInput = page.locator('input#senha[name="senha"], input[type="password"]').first();
  
  await emailInput.fill(user);
  await passInput.fill(pass);
  await page.screenshot({ path: path.join(outputDir, '02_login_preenchido.png') });

  log('Enviando formulário de login...');
  const submitBtn = page.locator('button#btn-entrar, .modal button[type="submit"]').first();
  await submitBtn.click({ force: true });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(outputDir, '03_pos_login.png') });

  log(`URL pós-login: "${page.url()}"`);

  // Seleção de filial se modal estiver visível
  const filialCard = page.locator('button.ModalClienteFilial_optionCard__vj1Sf, #select-filial').first();
  if (await filialCard.isVisible({ timeout: 3000 }).catch(() => false)) {
    log('Modal de filial detectado. Selecionando filial...');
    await filialCard.click();
    await page.waitForTimeout(1000);
    const confirmFilial = page.locator('button:has-text("Confirmar seleção"), span:has-text("Confirmar seleção")').first();
    await confirmFilial.click().catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outputDir, '04_filial_selecionada.png') });
  }

  // ETAPA 2: Busca e adição do Item 1: Ducha Lorenzetti
  log('Etapa 2: Buscando Item 1 ("DUCHA LORENZETTI BELLA DUCHA 127V")...');
  await page.goto('https://cicalfer.com.br/produtos?pagina=1&busca=Ducha%20Lorenzetti%20Bella%20Ducha%20127V', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outputDir, '05_busca_item1.png') });

  const prodTitle1 = await page.locator('a[href^="/produto/"], .card-title, h2, h3').first().innerText().catch(() => 'N/A');
  log(`Produto 1 encontrado: "${prodTitle1}"`);

  log('Adicionando Item 1 ao carrinho...');
  const addBtn1 = page.locator('button:has-text("Comprar"), button:has-text("Adicionar"), button.btn-adicionar').first();
  await addBtn1.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outputDir, '06_adicionado_item1.png') });

  // ETAPA 3: Busca e adição do Item 2: Caixa D'Água Fortlev 310L
  log('Etapa 3: Buscando Item 2 ("CAIXA D AGUA FORTLEV 310L")...');
  await page.goto('https://cicalfer.com.br/produtos?pagina=1&busca=Caixa%20d\'%C3%81gua%20Fortlev%20310L', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outputDir, '07_busca_item2.png') });

  const prodTitle2 = await page.locator('a[href^="/produto/"], .card-title, h2, h3').first().innerText().catch(() => 'N/A');
  log(`Produto 2 encontrado: "${prodTitle2}"`);

  log('Adicionando Item 2 ao carrinho...');
  const addBtn2 = page.locator('button:has-text("Comprar"), button:has-text("Adicionar"), button.btn-adicionar').first();
  await addBtn2.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outputDir, '08_adicionado_item2.png') });

  // ETAPA 4: Navegação e Abertura do Carrinho
  log('Etapa 4: Inspecionando botões de abrir carrinho antes da transição...');
  await page.screenshot({ path: path.join(outputDir, '09_antes_abrir_carrinho.png') });

  const cartBtn = page.locator('button#botao-abrir-carrinho, button:has-text("Ver carrinho"), a[href*="carrinho"]').first();
  const cartBtnCount = await cartBtn.count().catch(() => 0);
  const cartBtnVisible = await cartBtn.isVisible().catch(() => false);

  log(`Seletores de carrinho no DOM: Count: ${cartBtnCount} | IsVisible: ${cartBtnVisible}`);

  if (cartBtnCount > 0) {
    log('Clicando no botão do carrinho no DOM...');
    await cartBtn.click({ force: true }).catch(e => log(`Erro ao clicar no botão do carrinho: ${e.message}`));
    await page.waitForTimeout(3000);
  } else {
    log('Nenhum botão de carrinho encontrado por selector padrão. Tentando page.goto(https://cicalfer.com.br/carrinho)...');
    await page.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  }

  const urlCarrinho = page.url();
  log(`URL capturada pós abertura do carrinho: "${urlCarrinho}"`);
  await page.screenshot({ path: path.join(outputDir, '10_carrinho_pagina.png') });

  // Salvar HTML da página do carrinho para inspeção
  const htmlCarrinho = await page.content();
  fs.writeFileSync(path.join(outputDir, 'carrinho_page.html'), htmlCarrinho);

  // ETAPA 5: Leitura/Extração dos itens no Carrinho
  log('Etapa 5: Inspecionando itens e preços na página do carrinho...');

  const cartData = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('div[class*="ProdutoCompactCarrinho_itemContainer"], div[class*="itemContainer"], table tr, div.row'));
    const items = [];
    containers.forEach((c, idx) => {
      const text = c.innerText;
      if (text.includes('R$') || text.includes('VENDE DE') || text.includes('DUCHA') || text.includes('CAIXA')) {
        items.push({ idx, text });
      }
    });

    const prices = Array.from(document.querySelectorAll('.fs-14.fw-bold, span[class*="fw-bold"], div[class*="price"], td')).map(el => el.innerText.trim()).filter(t => t.includes('R$'));

    return {
      bodyLength: document.body.innerText.length,
      bodyTextSnippet: document.body.innerText.substring(0, 1000),
      items,
      prices
    };
  });

  log(`Resumo da extração do DOM do carrinho:
    Items detectados: ${cartData.items.length}
    Preços R$ detectados: ${JSON.stringify(cartData.prices)}
    Trecho do texto da página: "${cartData.bodyTextSnippet.replace(/\n+/g, ' ')}"`);

  await browser.close();

  // ETAPA 6: Executar Cotação Real pela Interface da SaraCota (via API + UI com browser)
  log('Etapa 6: Disparando cotação completa pelo fluxo real da SaraCota para capturar print do Modal Final...');

  const browserUI = await chromium.launch({ headless: true });
  const pageUI = await browserUI.newPage();

  log('Navegando para http://localhost:3000/cotacoes...');
  await pageUI.goto('http://localhost:3000/cotacoes');
  await pageUI.waitForTimeout(3000);

  log('Clicando na aba Bloco de Notas...');
  await pageUI.click('button:has-text("Bloco de Notas")');
  await pageUI.waitForTimeout(1000);

  log('Limpando bloco de notas...');
  const textarea = pageUI.locator('textarea');
  await textarea.fill('');
  await textarea.fill('3 CAIXA DA AGUA FORTLEV 310L\n6 DUCHA LORENZETTI BELLA DUCHA 127V');
  await pageUI.waitForTimeout(2000);

  log('Clicando em "Cotar com Fornecedores"...');
  await pageUI.click('button:has-text("Cotar com Fornecedores")');
  await pageUI.waitForTimeout(1500);

  log('Selecionando apenas a Cicalfer...');
  // Desmarcar tudo e marcar Cicalfer
  const checkboxes = pageUI.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    const cb = checkboxes.nth(i);
    if (await cb.isChecked()) {
      await cb.uncheck();
    }
  }

  // Marcar Cicalfer
  const cicalferCb = pageUI.locator('label:has-text("Cicalfer") input[type="checkbox"], tr:has-text("Cicalfer") input[type="checkbox"]').first();
  await cicalferCb.check().catch(() => pageUI.click('text=Cicalfer'));
  await pageUI.waitForTimeout(1000);

  await pageUI.screenshot({ path: path.join(outputDir, '11_modal_selecao_cicalfer.png') });

  log('Clicando no botão de confirmação de cotação...');
  await pageUI.click('button:has-text("Cotar"), button:has-text("Iniciar Cotação")');
  await pageUI.waitForTimeout(3000);

  log('Aguardando conclusão do robô na API...');
  for (let poll = 0; poll < 40; poll++) {
    await pageUI.waitForTimeout(3000);
    const textOnPage = await pageUI.evaluate(() => document.body.innerText);
    if (textOnPage.includes('Cotação concluída') || textOnPage.includes('Resumo dos Fornecedores') || textOnPage.includes('aguardando_revisao')) {
      log(`Progresso UI [Poll ${poll+1}]: Cotação finalizada detectada na tela.`);
      break;
    }
  }

  await pageUI.waitForTimeout(2000);
  await pageUI.screenshot({ path: path.join(outputDir, '12_modal_final_saracota.png'), fullPage: true });

  const finalBodyText = await pageUI.evaluate(() => document.body.innerText);
  log(`Texto final da tela SaraCota:
  ${finalBodyText.substring(0, 1500)}`);

  await browserUI.close();

  log('=== DIAGNÓSTICO DO TESTE 15 DA CICALFER FINALIZADO ===');
  logStream.end();
})();
