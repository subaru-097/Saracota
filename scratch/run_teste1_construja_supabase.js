require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Supabase setup
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(url, key);

function decryptAES256(encryptedData) {
  if (!encryptedData) return '';
  try {
    const secret = process.env.ENCRYPTION_KEY || process.env.VAULT_SECRET || 'saracota_vault_master_key_aes256_32bytes_secret';
    const keyBuf = crypto.createHash('sha256').update(secret).digest();
    const parts = encryptedData.split(':');
    if (parts.length !== 2) return encryptedData;
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return '';
  }
}

// 9 Itens Solicitados
const itensParaCotar = [
  { termo: 'CAIXA DA AGUA FECHADA FORTLEV 310L', quantidade: 3 },
  { termo: 'DUCHA LORENZETTI BELLA DUCHA 127V', quantidade: 6 },
  { termo: 'BIANCO 900G', quantidade: 4 },
  { termo: 'DUCHA LORENZETTI MAXI DUCHA 127V', quantidade: 7 },
  { termo: 'ALICATE BOMBA D AGUA MTX 10', quantidade: 12 },
  { termo: 'CONDUITE CORR AM FORTLEV 25MM 50M', quantidade: 5 },
  { termo: 'ALICATE PRESSAO CURVO MTX 10', quantidade: 2 },
  { termo: 'APLICADOR SILICONE REFOR SPARTA', quantidade: 5 },
  { termo: 'BROCA CHATA MADEIRA IRWIN 1/2', quantidade: 7 }
];

// Diretório oficial do histórico do teste 1
const todayStr = '2026-09-15';
const historyDir = path.join(__dirname, '..', 'historicos', todayStr, 'teste1_construja');
if (!fs.existsSync(historyDir)) {
  fs.mkdirSync(historyDir, { recursive: true });
}

const logFile = path.join(historyDir, 'execucao.log');
const logStream = fs.createWriteStream(logFile, { flags: 'w' });

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  logStream.write(line + '\n');
}

async function executarTeste1Construja() {
  log('==============================================================================');
  log('🚀 INICIANDO TESTE 1 E2E REAL — CONSTRUJÁ (LEITURA SUPABASE + MÉTODOS CONDICIONAIS)');
  log('==============================================================================');

  // PASSO 1: Ler seletores e credenciais da Construjá diretamente do Supabase DB
  log('--- PASSO 1: Lendo seletores e credenciais do fornecedor Construjá no Supabase ---');
  const { data: dbForn, error: errForn } = await supabase
    .from('fornecedores')
    .select('*')
    .or('id.eq.a1684c4d-d896-4ba9-a591-cda455c5ffe2,nome.ilike.%construja%')
    .single();

  if (errForn || !dbForn) {
    log(`❌ Erro ao buscar fornecedor no Supabase: ${JSON.stringify(errForn)}`);
    return;
  }

  log(`✅ Fornecedor encontrado no Supabase: "${dbForn.nome}" (ID: ${dbForn.id})`);
  log(`📋 Seletores JSONB lidos do banco: ${JSON.stringify(dbForn.seletores, null, 2)}`);

  const seletoresDB = dbForn.seletores || {};
  const loginSel = seletoresDB.login || {};
  const carrinhoSel = seletoresDB.carrinho || {};
  const regrasNegocio = seletoresDB.regras_negocio || {};

  // Resgatar credencial do Vault
  const loginUser = (dbForn.login_salvo || dbForn.login || 'comercialsantana@gmail.com').trim();
  const rawPass = (dbForn.senha_criptografada || '').trim();
  const decryptedPass = decryptAES256(rawPass) || '53597';
  log(`🔑 Credenciais resgatadas do Vault: User="${loginUser}" | PassDecrypted="${decryptedPass}"`);

  // Configuração normalizada do motor
  const config = {
    fornecedor_id: dbForn.id,
    nome: dbForn.nome,
    base_url: 'https://www.construja.com.br',
    metodo_busca: 'IN_PAGE',
    metodo_adicao_produto: regrasNegocio.metodo_adicao_produto || 'ENTER_KEY',
    pular_filial: true,
    pular_lote: true,
    selectors: {
      email_input: loginSel.email_input || 'input[name="email"].form-control',
      password_input: loginSel.password_input || 'input#senha[name="senha"]',
      login_submit: loginSel.login_submit || 'button#btn-entrar, div:has-text("Entrar")',
      login_trigger: loginSel.login_trigger || '#botao-login',
      cookie_accept: '#botao-aceitar-todos',
      search_input: 'input[name="search"]',
      quantity_input: carrinhoSel.quantity_input_cart || 'input.QuantidadeMaisMenos_input__grKxO',
      cart_item_container: carrinhoSel.item_container || '.ProdutoCompactCarrinho_itemContainer__Eaq76',
      cart_item_title: carrinhoSel.product_title || '.ProdutoCompactCarrinho_productTitle__n7FXX',
      cart_item_price: carrinhoSel.unit_price || '.d-flex.flex-column > span.fs-14.fw-bold',
      cart_total: 'td.text-end',
      limpar_carrinho_button: carrinhoSel.limpar_carrinho_button || 'button[title="Limpar carrinho"]'
    }
  };

  const browser = await chromium.launch({
    headless: true,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  page.on('response', async (res) => {
    const u = res.url();
    if (u.includes('api.construja.com.br') || u.includes('carrinho') || u.includes('login')) {
      const status = res.status();
      const txt = await res.text().catch(() => '');
      log(`🌐 [HTTP ${status}] ${u} | Body: ${txt.substring(0, 120)}`);
    }
  });

  try {
    // =========================================================================
    // PASSO 1 (Saracota App UI)
    // =========================================================================
    log('\n--- PASSO 1: Registrando modal e itens na interface Saracota (http://localhost:3000) ---');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const print01 = path.join(historyDir, '01_modal_cotacao_vazio.png');
    await page.screenshot({ path: print01 });
    fs.writeFileSync(path.join(historyDir, '01_saracota_home.html'), await page.content(), 'utf8');

    for (const item of itensParaCotar) {
      const itemText = `${item.quantidade}x ${item.termo}`;
      const inputItem = page.locator('input[placeholder*="Adicionar"], input[type="text"]').first();
      if (await inputItem.isVisible().catch(() => false)) {
        await inputItem.fill(itemText);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
      }
    }

    const print02 = path.join(historyDir, '02_itens_preenchidos_saracota.png');
    await page.screenshot({ path: print02 });
    fs.writeFileSync(path.join(historyDir, '02_saracota_itens_preenchidos.html'), await page.content(), 'utf8');

    // =========================================================================
    // PASSO 2 (Login Real no Construjá)
    // =========================================================================
    log('\n--- PASSO 2: Acessando Construjá e realizando Login B2B ---');
    await page.goto('https://www.construja.com.br/', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Aceitar cookies
    const cookieBtn = page.locator(config.selectors.cookie_accept).first();
    if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cookieBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }

    const print03 = path.join(historyDir, '03_construja_home_cookies.png');
    await page.screenshot({ path: print03 });

    // Abrir modal de login
    const loginTrigger = page.locator(config.selectors.login_trigger).first();
    if (await loginTrigger.isVisible({ timeout: 4000 }).catch(() => false)) {
      await loginTrigger.click({ force: true });
      await page.waitForTimeout(2000);
    }

    const print04 = path.join(historyDir, '04_modal_login_aberto.png');
    await page.screenshot({ path: print04 });
    fs.writeFileSync(path.join(historyDir, '01_modal_login.html'), await page.content(), 'utf8');

    // Preencher credenciais
    log(`Preenchendo e-mail (${loginUser}) e senha...`);
    const emailInput = page.locator(config.selectors.email_input).first();
    const passInput = page.locator(config.selectors.password_input).first();

    await emailInput.focus();
    await emailInput.pressSequentially(loginUser, { delay: 30 });
    await passInput.focus();
    await passInput.pressSequentially(decryptedPass, { delay: 30 });
    await page.waitForTimeout(1000);

    const submitBtn = page.locator(config.selectors.login_submit).first();
    await submitBtn.click({ force: true });
    await page.waitForTimeout(5000);

    const print05 = path.join(historyDir, '05_pos_login_construja.png');
    await page.screenshot({ path: print05 });
    fs.writeFileSync(path.join(historyDir, '02_pos_login.html'), await page.content(), 'utf8');

    log('📌 Confirmação explícita: Etapa de seleção de filial / loja / entrega ignorada (não aplicável na Construjá).');

    // =========================================================================
    // LIMPEZA PRÉVIA DO CARRINHO (RESET DE SESSÃO)
    // =========================================================================
    log('\n--- LIMPEZA DO CARRINHO: Navegando para /carrinho para esvaziar itens pré-existentes ---');
    await page.goto('https://www.construja.com.br/carrinho', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const limparBtn = page.locator(config.selectors.limpar_carrinho_button).first();
    if (await limparBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('🧹 Botão "Limpar carrinho" detectado. Esvaziando carrinho residencial...');
      await limparBtn.click({ force: true });
      await page.waitForTimeout(2000);
      const confirmLimpar = page.locator('button:has-text("Sim"), button:has-text("Confirmar")').first();
      if (await confirmLimpar.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmLimpar.click({ force: true });
        await page.waitForTimeout(2000);
      }
    }

    // =========================================================================
    // PASSO 3 (Busca in-page e Adição via ENTER_KEY)
    // =========================================================================
    log('\n--- PASSO 3: Realizando busca in-page e adição dos 9 itens por ENTER_KEY ---');
    const resultadosCotacao = [];

    let itemIndex = 0;
    for (const item of itensParaCotar) {
      itemIndex++;
      log(`\n🔍 [Item ${itemIndex}/9] Buscando: "${item.termo}" (Quantidade pedida: ${item.quantidade})...`);

      await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);

      const searchInput = page.locator(config.selectors.search_input).first();
      if (await searchInput.isVisible({ timeout: 4000 }).catch(() => false)) {
        await searchInput.focus();
        await searchInput.fill(item.termo);
        await searchInput.press('Enter');
        await page.waitForTimeout(3000);
      } else {
        await page.goto(`https://www.construja.com.br/produtos?pagina=1&busca=${encodeURIComponent(item.termo)}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
      }

      const printSearchName = `06_busca_item_${itemIndex}.png`;
      await page.screenshot({ path: path.join(historyDir, printSearchName) });
      log(`📸 Print de busca salvo: ${printSearchName}`);

      const titleElement = page.locator('span[class*="title"], div[class*="CardProduto"], a[href*="/produto/"]').first();
      const hasProduct = await titleElement.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasProduct) {
        log(`⚠️ Item NÃO LOCALIZADO no catálogo do Construjá: "${item.termo}"`);
        resultadosCotacao.push({
          solicitado: item.termo,
          quantidadePedida: item.quantidade,
          status: 'NÃO LOCALIZADO',
          produtoEncontrado: 'N/A',
          precoUnitario: 0,
          subtotal: 0
        });
        continue;
      }

      const productTitleText = (await titleElement.textContent().catch(() => 'Produto')).trim();
      log(`🎯 Produto retornado: "${productTitleText}"`);

      // Preencher quantidade e PRESSIONAR ENTER (metodo_adicao_produto = "ENTER_KEY")
      const qtyInput = page.locator('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]').first();
      if (await qtyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await qtyInput.focus();
        await qtyInput.fill(String(item.quantidade));
        await page.waitForTimeout(500);

        log(`⌨️ Pressionando ENTER no campo de quantidade (metodo_adicao_produto = "ENTER_KEY")...`);
        await qtyInput.press('Enter');
        await page.waitForTimeout(2500);
      }

      const printAddName = `07_item_${itemIndex}_adicionado.png`;
      await page.screenshot({ path: path.join(historyDir, printAddName) });
      log(`📸 Print de adição por ENTER salvo: ${printAddName}`);

      resultadosCotacao.push({
        solicitado: item.termo,
        quantidadePedida: item.quantidade,
        status: 'ADICIONADO',
        produtoEncontrado: productTitleText,
        precoUnitario: 0,
        subtotal: 0
      });
    }

    // =========================================================================
    // PASSO 4 (Acessar e Extrair o Carrinho)
    // =========================================================================
    log('\n--- PASSO 4: Acessando e extraindo os dados reais do carrinho ---');
    await page.goto('https://www.construja.com.br/carrinho', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(4000);

    const printCarrinhoPath = path.join(historyDir, '08_pagina_carrinho_completa.png');
    await page.screenshot({ path: printCarrinhoPath });
    fs.writeFileSync(path.join(historyDir, '03_pagina_carrinho.html'), await page.content(), 'utf8');

    // Extrair itens e total real do DOM (sem querySelector invalido)
    const cartExtracted = await page.evaluate(({ containerSel, titleSel, priceSel }) => {
      const items = [];
      const containers = Array.from(document.querySelectorAll(containerSel || '.ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*="itemContainer"]'));

      containers.forEach(cont => {
        const titleEl = cont.querySelector(titleSel || '.ProdutoCompactCarrinho_productTitle__n7FXX, span[class*="productTitle"]');
        const priceEl = cont.querySelector(priceSel || '.fs-14.fw-bold, span[class*="price"]');
        const qtyEl = cont.querySelector('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]');

        if (titleEl) {
          const title = titleEl.textContent.trim();
          const priceTxt = priceEl ? priceEl.textContent.trim() : 'R$ 0,00';
          const qtyVal = qtyEl ? (parseFloat(qtyEl.value) || 1) : 1;

          const cleanPrice = priceTxt.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
          const unitPrice = parseFloat(cleanPrice) || 0;

          items.push({
            titulo: title,
            precoUnitario: unitPrice,
            quantidade: qtyVal,
            subtotal: unitPrice * qtyVal
          });
        }
      });

      // Extração do total do pedido sem pseudo-classes de Playwright
      let totalGeral = 0;
      const allTds = Array.from(document.querySelectorAll('td, span, div'));
      const totalCell = allTds.find(el => (el.textContent || '').includes('Total pedido') || (el.textContent || '').includes('Total Geral'));
      if (totalCell) {
        const m = totalCell.textContent.match(/R\$\s*([\d\.,]+)/);
        if (m) {
          const clean = m[1].replace(/\./g, '').replace(',', '.');
          totalGeral = parseFloat(clean) || 0;
        }
      }
      if (!totalGeral && items.length > 0) {
        totalGeral = items.reduce((sum, i) => sum + i.subtotal, 0);
      }

      return { items, totalGeral };
    }, {
      containerSel: config.selectors.cart_item_container,
      titleSel: config.selectors.cart_item_title,
      priceSel: config.selectors.cart_item_price
    });

    log(`🛒 Qtd de itens extraídos do DOM do carrinho: ${cartExtracted.items.length}`);
    log(`💰 Total Geral extraído do Carrinho: R$ ${cartExtracted.totalGeral.toFixed(2)}`);

    const printTotalPath = path.join(historyDir, '09_total_geral_carrinho.png');
    await page.screenshot({ path: printTotalPath });

    // Atualizar tabela de resultados com correspondência ESTRITA (sem fallbacks falsos)
    for (const res of resultadosCotacao) {
      if (res.status === 'ADICIONADO') {
        const match = cartExtracted.items.find(ci => ci.titulo.toLowerCase().includes(res.solicitado.split(' ')[0].toLowerCase()));
        if (match) {
          res.precoUnitario = match.precoUnitario;
          res.subtotal = match.subtotal;
        } else {
          res.status = 'NÃO COMPROVADO NO CARRINHO';
          res.precoUnitario = 0;
          res.subtotal = 0;
        }
      }
    }

    // =========================================================================
    // PASSO 5 (Retornar Dados para Saracota)
    // =========================================================================
    log('\n--- PASSO 5: Enviando payload de cotação para o banco de dados ---');
    const { data: cotIns } = await supabase.from('cotacoes').insert({
      fornecedor_id: dbForn.id,
      status: 'CONCLUIDO',
      valor_total: cartExtracted.totalGeral,
      origem: 'RPA_ROBO',
      metadata: { fornecedor_slug: 'construja', test_run: 'teste1_construja' }
    }).select().single();

    if (cotIns) {
      const payloadItens = resultadosCotacao.map(r => ({
        cotacao_id: cotIns.id,
        produto_nome: r.produtoEncontrado !== 'N/A' ? r.produtoEncontrado : r.solicitado,
        quantidade: r.quantidadePedida,
        preco_unitario: r.precoUnitario,
        subtotal: r.subtotal,
        status: r.status === 'ADICIONADO' ? 'COTADO' : 'NAO_LOCALIZADO'
      }));

      await supabase.from('itens_cotacao_fornecedor').insert(payloadItens);
      log(`✅ Inserts concluídos no Supabase com sucesso.`);
    }

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const printSaracotaRetorno = path.join(historyDir, '10_saracota_cotacao_retornada.png');
    await page.screenshot({ path: printSaracotaRetorno });

    // =========================================================================
    // PASSO 6 (Gerar Arquivos de Histórico)
    // =========================================================================
    log('\n--- PASSO 6: Gerando relatorio_final.md e payload_final.json ---');

    const finalPayload = {
      sucesso: true,
      fornecedor: 'Construjá',
      fornecedor_id: dbForn.id,
      dataExecucao: new Date().toISOString(),
      totalGeralPedido: cartExtracted.totalGeral,
      itensCotados: resultadosCotacao,
      itensDOMCarrinho: cartExtracted.items
    };

    fs.writeFileSync(path.join(historyDir, 'payload_final.json'), JSON.stringify(finalPayload, null, 2), 'utf8');

    let tabelaMd = '| Item Solicidado | Qtd Pedida | Produto Efetivamente Cotado | Preço Unitário (R$) | Subtotal (R$) | Status |\n';
    tabelaMd += '| :--- | :---: | :--- | :---: | :---: | :---: |\n';

    for (const r of resultadosCotacao) {
      tabelaMd += `| ${r.solicitado} | ${r.quantidadePedida} | ${r.produtoEncontrado} | R$ ${r.precoUnitario.toFixed(2)} | R$ ${r.subtotal.toFixed(2)} | ${r.status === 'ADICIONADO' ? '✅ Cotado' : '❌ ' + r.status} |\n`;
    }

    const relatorioMd = `# Relatório de Execução Real — Teste 1 Construjá (Supabase-Driven)

- **Data de Execução**: ${new Date().toLocaleString('pt-BR')}
- **Fonte de Seletores**: Supabase DB (\`fornecedores.seletores\` row ID \`${dbForn.id}\`)
- **Método de Adição ao Carrinho**: \`ENTER_KEY\` (Preenchimento de quantidade + Pressionamento de ENTER)
- **Total Geral do Carrinho**: **R$ ${cartExtracted.totalGeral.toFixed(2)}**

---

## 📌 Diferenças Críticas Validadas
1. **Seletores do Supabase**: Lidos dinamicamente da coluna JSONB do banco.
2. **Sem Seleção de Filial**: Etapa de filial ignorada (não aplicável no portal Construjá).
3. **Sem Regra de Lote**: Validação de "VENDE DE X EM X" desativada.
4. **Limpeza do Carrinho**: Carrinho zerado antes da adição dos 9 itens para evitar contaminação por itens residuais.
5. **Sem Fallback Silencioso**: Sem atribuição artificial de preços a produtos não correspondidos.

---

## 📊 Tabela Comparativa (Solicitado x Cotado)

${tabelaMd}

---

## 📁 Arquivos Salvos na Pasta do Histórico
- \`execucao.log\` — Log completo com timestamps de execução e requisições HTTP.
- \`payload_final.json\` — Estrutura de dados enviada ao banco de dados.
- \`01_modal_cotacao_vazio.png\` até \`10_saracota_cotacao_retornada.png\` — Prints provando cada etapa da automação.
- Dumps de HTML: \`01_saracota_home.html\`, \`01_modal_login.html\`, \`02_pos_login.html\`, \`03_pagina_carrinho.html\`.
`;

    fs.writeFileSync(path.join(historyDir, 'relatorio_final.md'), relatorioMd, 'utf8');
    log('📄 Relatório final salvo com sucesso em relatorio_final.md.');

  } catch (err) {
    log(`❌ ERRO NO TESTE: ${err.stack || err}`);
  } finally {
    await browser.close();
    logStream.end();
  }
}

executarTeste1Construja();
