const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const historyDir = path.join(__dirname, '..', 'historicos', '2026-09-17', 'teste1_cofema_real');
if (!fs.existsSync(historyDir)) {
  fs.mkdirSync(historyDir, { recursive: true });
}

const logFile = path.join(historyDir, 'execucao_detalhada.log');
const logStream = fs.createWriteStream(logFile, { flags: 'w' });

function log(msg) {
  const ts = new Date().toISOString();
  const formatted = `[${ts}] ${msg}`;
  console.log(formatted);
  logStream.write(formatted + '\n');
}

function decryptPass() {
  const secret = process.env.ENCRYPTION_KEY || 'saracota_vault_master_key_aes256_32bytes_secret';
  const key = crypto.createHash('sha256').update(secret).digest();
  const enc = '2d9b6e86b1034675062fec1cfdfc46c6:41a8001d9d1eb443aa21bf2b901da8a4';
  const parts = enc.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const userCnpj = '43.313.798/0001-34';
const passWord = decryptPass();

const itensParaCotar = [
  { termo: 'DUCHA LORENZETTI BELLA DUCHA 127V', quantidade: 6 },
  { termo: 'BIANCO 900G', quantidade: 4 },
  { termo: 'DUCHA LORENZETTI MAXI DUCHA 127V', quantidade: 7 },
  { termo: 'ALICATE BOMBA D AGUA MTX 10', quantidade: 12 },
  { termo: 'CONDUITE CORR AM FORTLEV 25MM 50M', quantidade: 5 }
];

async function executarCotacaoRealCofema() {
  log('================================================================');
  log('🚀 INICIANDO TESTE DE COTAÇÃO REAL NO FORNECEDOR COFEMA');
  log(`📂 Diretório de Evidências: ${historyDir}`);
  log(`👤 Usuário/CNPJ: ${userCnpj}`);
  log('================================================================');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      log(`[BROWSER CONSOLE ERROR] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    log(`[BROWSER UNCAUGHT ERROR] ${err.message}`);
  });

  const resultadosItens = [];
  let resumoPedido = { totalItens: 0, totalPedido: 0, cartUrl: '' };

  try {
    // PASSO 1: Acesso Inicial ao Site
    log('--- PASSO 1: Navegando para https://www.cofema.com.br/ ---');
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(historyDir, '01_pagina_inicial_cofema.png'), fullPage: false });
    log('📸 Screenshot salvo: 01_pagina_inicial_cofema.png');

    // Aceite de Cookies
    const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar, .lgpd-accept').first();
    if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cookieBtn.click().catch(() => {});
      log('✅ Banner de cookies detectado e aceito.');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(historyDir, '02_cookies_aceitos.png'), fullPage: false });
    }

    // PASSO 2: Autenticação no Portal Cofema
    log('--- PASSO 2: Abrindo modal de Login ---');
    const entreBtn = page.locator('button:has-text("Entre ou Cadastre-se")').first();
    await entreBtn.waitFor({ state: 'visible', timeout: 10000 });
    await entreBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const areaClienteLoc = page.getByText('Área do Cliente', { exact: true }).first();
    await areaClienteLoc.waitFor({ state: 'visible', timeout: 5000 });
    await areaClienteLoc.click({ force: true });
    await page.waitForTimeout(2000);

    // Preencher Inputs do Modal (#codigo e #senha)
    log(`⌨️ Preenchendo credenciais: CNPJ ${userCnpj}...`);
    const emailInput = page.locator('#codigo').first();
    const passInput = page.locator('#senha').first();

    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    await emailInput.fill('');
    await emailInput.type(userCnpj, { delay: 30 });

    await passInput.waitFor({ state: 'visible', timeout: 5000 });
    await passInput.fill('');
    await passInput.type(passWord, { delay: 30 });

    await page.screenshot({ path: path.join(historyDir, '03_login_preenchido.png'), fullPage: false });
    log('📸 Screenshot salvo: 03_login_preenchido.png');

    const submitBtn = page.locator('button:has-text("Entrar")').first();
    log('👆 Clicando no botão "Entrar"...');
    await submitBtn.click({ force: true });

    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(historyDir, '04_login_confirmado.png'), fullPage: false });
    log('📸 Screenshot salvo: 04_login_confirmado.png');
    log(`🌐 URL pós-login: ${page.url()}`);

    // PASSO 3: Busca e Adição dos 5 Itens
    log('\n--- PASSO 3: Buscando e adicionando os 5 itens solicitados ---');

    let itemIndex = 1;
    for (const item of itensParaCotar) {
      log(`\n🔎 [ITEM ${itemIndex}/5] Cotando: "${item.termo}" (Quantidade pedida: ${item.quantidade})`);

      try {
        const searchInput = page.locator('#input-busca-home, input[type="search"], input[placeholder*="Buscar"], input[placeholder*="Pesquisar"]').first();
        await searchInput.waitFor({ state: 'visible', timeout: 10000 });
        await searchInput.fill('');
        await searchInput.type(item.termo, { delay: 30 });
        await page.waitForTimeout(500);

        await page.keyboard.press('Enter');
        await page.waitForTimeout(4000);

        const screenshotBusca = `05_item_${itemIndex}_busca.png`;
        await page.screenshot({ path: path.join(historyDir, screenshotBusca), fullPage: false });
        log(`📸 Screenshot salvo: ${screenshotBusca}`);

        // Verificar título do primeiro card encontrado
        const cardTitleLoc = page.locator('h5, .font-medium, .product-title, .nome-produto, a[href*="/produto/"]').first();
        const foundTitle = await cardTitleLoc.textContent({ timeout: 4000 }).catch(() => null);

        if (foundTitle && foundTitle.trim()) {
          const cleanTitle = foundTitle.trim();
          log(`✅ Produto localizado na busca: "${cleanTitle}"`);

          // Extrair preço se visível na busca
          const priceLoc = page.locator('.produto-preco .font-bold, .fs-14.fw-bold, span.font-bold, [class*="preco"], [class*="price"]').first();
          const rawPriceText = await priceLoc.textContent({ timeout: 2000 }).catch(() => '');
          let unitPrice = 0;
          if (rawPriceText) {
            const numMatch = rawPriceText.replace(/\./g, '').replace(',', '.').match(/[\d\.]+/);
            if (numMatch) unitPrice = parseFloat(numMatch[0]);
          }

          // Ajustar quantidade
          const qtyInput = page.locator('input[data-produto-quantidade="true"], input[type="number"], input.QuantidadeMaisMenos_input__grKxO, input[name*="quantidade"]').first();
          if (await qtyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await qtyInput.fill('');
            await qtyInput.type(String(item.quantidade));
            await page.waitForTimeout(300);
          }

          // Clicar em Adicionar
          const addBtn = page.locator('button:has-text("Adicionar"), button:has-text("Comprar"), button.btn-adicionar').first();
          if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await addBtn.click({ force: true });
            await page.waitForTimeout(2000);
            log(`🛒 Item adicionado ao carrinho com quantidade ${item.quantidade}.`);
          } else {
            log('⚠️ Botão Adicionar não visível diretamente, tentando pressionar Enter no campo quantidade...');
            await page.keyboard.press('Enter');
            await page.waitForTimeout(2000);
          }

          const screenshotAdd = `06_item_${itemIndex}_adicionado.png`;
          await page.screenshot({ path: path.join(historyDir, screenshotAdd), fullPage: false });
          log(`📸 Screenshot salvo: ${screenshotAdd}`);

          resultadosItens.push({
            termo: item.termo,
            quantidadePedida: item.quantidade,
            produtoEncontrado: cleanTitle,
            status: 'CONFIRMADO',
            precoUnitario: unitPrice,
            totalItem: unitPrice * item.quantidade
          });
        } else {
          log(`⚠️ Produto "${item.termo}" NÃO foi localizado nos resultados.`);
          resultadosItens.push({
            termo: item.termo,
            quantidadePedida: item.quantidade,
            produtoEncontrado: null,
            status: 'NAO_ENCONTRADO',
            motivo: 'Nenhum resultado retornado na busca do portal.'
          });
        }
      } catch (errItem) {
        log(`❌ Erro no item "${item.termo}": ${errItem.message}`);
        const screenshotErroItem = `ERRO_item_${itemIndex}_falha.png`;
        await page.screenshot({ path: path.join(historyDir, screenshotErroItem), fullPage: false }).catch(() => {});
        resultadosItens.push({
          termo: item.termo,
          quantidadePedida: item.quantidade,
          status: 'ERRO',
          motivo: errItem.message
        });
      }
      itemIndex++;
    }

    // PASSO 4: Leitura do Carrinho e Resumo
    log('\n--- PASSO 4: Abrindo Carrinho / Resumo do Pedido ---');

    const cartBtn = page.locator('button[title*="Carrinho"], #botao-abrir-carrinho, a[href*="carrinho"], a[href*="pedidos"], button:has-text("Carrinho")').first();
    if (await cartBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cartBtn.click({ force: true });
      await page.waitForTimeout(4000);
    } else {
      log('⚠️ Botão do carrinho não identificado, navegando diretamente para /page/pedidos...');
      await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(4000);
    }

    await page.screenshot({ path: path.join(historyDir, '07_carrinho_resumo_pedido.png'), fullPage: false });
    log('📸 Screenshot salvo: 07_carrinho_resumo_pedido.png');

    const cartItemsData = await page.evaluate(() => {
      const items = [];
      const containers = document.querySelectorAll('div.flex.flex-col.sm\\:flex-row, .ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*="itemContainer"], tr');
      
      containers.forEach(el => {
        const titleEl = el.querySelector('h5, .font-medium, .product-title, [class*="productTitle"]');
        const priceEl = el.querySelector('.produto-preco .font-bold, .fs-14.fw-bold, span.font-bold, [class*="price"]');
        const qtyEl = el.querySelector('input[type="number"], input[data-produto-quantidade="true"]');
        
        if (titleEl) {
          items.push({
            nome: titleEl.innerText ? titleEl.innerText.trim() : '',
            precoRaw: priceEl ? priceEl.innerText.trim() : '',
            qtdRaw: qtyEl ? qtyEl.value : ''
          });
        }
      });

      const totalEl = document.querySelector('span:has-text("Total: R$"), tr:has-text("Total pedido") td.text-end, .total-pedido, [class*="total"]');
      const totalText = totalEl ? totalEl.innerText : '';

      return { items, totalText, pageUrl: window.location.href };
    });

    log(`🛒 Extração DOM do Carrinho: ${cartItemsData.items.length} item(ns) localizados.`);
    cartItemsData.items.forEach((it, idx) => {
      log(`   Item ${idx + 1}: "${it.nome}" | Preço: "${it.precoRaw}" | Qtd: "${it.qtdRaw}"`);
    });

    log(`📊 Resumo Total no Carrinho: ${cartItemsData.totalText || 'Não identificado'}`);

    resumoPedido.totalItens = cartItemsData.items.length;
    resumoPedido.cartUrl = cartItemsData.pageUrl;

  } catch (errFatal) {
    log(`💥 ERRO FATAL NA EXECUÇÃO DE COTAÇÃO: ${errFatal.stack || errFatal.message}`);
    await page.screenshot({ path: path.join(historyDir, 'ERRO_FATAL_EXECUCAO.png'), fullPage: true }).catch(() => {});
    log('📸 Screenshot de erro fatal salvo: ERRO_FATAL_EXECUCAO.png');
  } finally {
    const finalPayload = {
      fornecedor: 'Cofema',
      timestamp: new Date().toISOString(),
      itensCotados: resultadosItens,
      resumo: resumoPedido
    };

    fs.writeFileSync(path.join(historyDir, 'payload_final_cofema.json'), JSON.stringify(finalPayload, null, 2), 'utf8');
    log('✅ Payload final salvo em payload_final_cofema.json');

    let relatorioContent = `# Relatório de Execução Real RPA — Fornecedor Cofema\n\n`;
    relatorioContent += `- **Data/Hora**: ${new Date().toLocaleString('pt-BR')}\n`;
    relatorioContent += `- **Fornecedor**: Cofema Atacado\n`;
    relatorioContent += `- **CNPJ de Acesso**: ${userCnpj}\n`;
    relatorioContent += `- **Diretório de Evidências**: \`${historyDir}\`\n\n`;
    relatorioContent += `## 📋 Resumo dos Itens Cotados\n\n`;
    relatorioContent += `| # | Termo Pesquisado | Qtd Pedida | Produto Encontrado | Status | Preço Unitário | Total Item |\n`;
    relatorioContent += `|---|---|---|---|---|---|---|\n`;

    resultadosItens.forEach((it, idx) => {
      relatorioContent += `| ${idx + 1} | ${it.termo} | ${it.quantidadePedida} | ${it.produtoEncontrado || 'N/A'} | ${it.status} | R$ ${(it.precoUnitario || 0).toFixed(2)} | R$ ${(it.totalItem || 0).toFixed(2)} |\n`;
    });

    relatorioContent += `\n## 📸 Evidências Capturadas\n\n`;
    relatorioContent += `- \`01_pagina_inicial_cofema.png\`\n`;
    relatorioContent += `- \`03_login_preenchido.png\`\n`;
    relatorioContent += `- \`04_login_confirmado.png\`\n`;
    relatorioContent += `- \`05_item_X_busca.png\` (Screenshots de busca para cada item)\n`;
    relatorioContent += `- \`06_item_X_adicionado.png\` (Screenshots de adição ao carrinho)\n`;
    relatorioContent += `- \`07_carrinho_resumo_pedido.png\`\n`;

    fs.writeFileSync(path.join(historyDir, 'relatorio_final.md'), relatorioContent, 'utf8');
    log('✅ Relatório final salvo em relatorio_final.md');

    await page.waitForTimeout(5000);
    await browser.close().catch(() => {});
    log('🏁 Execução concluída e navegador encerrado.');
  }
}

executarCotacaoRealCofema();
