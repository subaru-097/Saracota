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

// Pasta oficial do Teste 5
const todayStr = '2026-09-15';
const baseDir = path.join(__dirname, '..', 'historicos', todayStr, 'teste5_saracota_construja');
const printsDir = path.join(baseDir, 'prints');
const htmlDumpsDir = path.join(baseDir, 'html_dumps');

if (!fs.existsSync(printsDir)) fs.mkdirSync(printsDir, { recursive: true });
if (!fs.existsSync(htmlDumpsDir)) fs.mkdirSync(htmlDumpsDir, { recursive: true });

// Logs Streams
const execLogStream = fs.createWriteStream(path.join(baseDir, 'execucao.log'), { flags: 'w' });

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  execLogStream.write(line + '\n');
}

async function executarTeste5Construja() {
  log('==============================================================================');
  log('🚀 INICIANDO TESTE 5 REAL — CONSTRUJÁ (COM SELETOR button#btn-entrar CORRIGIDO)');
  log('==============================================================================');

  // 1. Ler seletores atualizados do Supabase DB
  log('--- PASSO 1: Lendo seletores atualizados do fornecedor Construjá no Supabase ---');
  const { data: dbForn, error: errForn } = await supabase
    .from('fornecedores')
    .select('*')
    .eq('id', 'a1684c4d-d896-4ba9-a591-cda455c5ffe2')
    .single();

  if (errForn || !dbForn) {
    log(`❌ Erro ao buscar fornecedor no Supabase: ${JSON.stringify(errForn)}`);
    return;
  }

  log(`✅ Fornecedor lido do Supabase: "${dbForn.nome}" (ID: ${dbForn.id})`);
  log(`📋 Seletores de login lidos do banco: ${JSON.stringify(dbForn.seletores.login, null, 2)}`);

  const seletoresDB = dbForn.seletores || {};
  const loginSel = seletoresDB.login || {};
  const carrinhoSel = seletoresDB.carrinho || {};

  const config = {
    selectors: {
      cart_item_container: carrinhoSel.item_container || '.ProdutoCompactCarrinho_itemContainer__Eaq76',
      cart_item_title: carrinhoSel.product_title || '.ProdutoCompactCarrinho_productTitle__n7FXX',
      cart_item_price: carrinhoSel.unit_price || '.d-flex.flex-column > span.fs-14.fw-bold'
    }
  };

  const loginUser = (dbForn.login_salvo || dbForn.login || 'comercialsantana@gmail.com').trim();
  const rawPass = (dbForn.senha_criptografada || '').trim();
  const decryptedPass = decryptAES256(rawPass) || '53597';

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
    if (u.includes('api.construja.com.br') || u.includes('carrinho')) {
      log(`🌐 [HTTP ${res.status()}] ${u}`);
    }
  });

  try {
    // -------------------------------------------------------------------------
    // PASSO 2: AUTENTICAÇÃO COM SELETOR button#btn-entrar
    // -------------------------------------------------------------------------
    log('\n--- PASSO 2: Acessando Construjá e efetuando Login com seletor button#btn-entrar ---');
    await page.goto('https://www.construja.com.br/', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    const cookieBtn = page.locator('#botao-aceitar-todos').first();
    if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('Clicando em #botao-aceitar-todos...');
      await cookieBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }

    const loginTrigger = page.locator(loginSel.login_trigger || '#botao-login').first();
    if (await loginTrigger.isVisible({ timeout: 4000 }).catch(() => false)) {
      log('Clicando no botão de abrir modal de login (#botao-login)...');
      await loginTrigger.click({ force: true });
      await page.waitForTimeout(2000);
    }

    log(`Preenchendo e-mail (${loginUser}) e senha...`);
    const emailInput = page.locator(loginSel.email_input || 'input[name="email"].form-control').first();
    const passInput = page.locator(loginSel.password_input || 'input#senha[name="senha"]').first();

    await emailInput.focus();
    await emailInput.pressSequentially(loginUser, { delay: 30 });
    await passInput.focus();
    await passInput.pressSequentially(decryptedPass, { delay: 30 });
    await page.waitForTimeout(1000);

    // Clicar no botão exato e único: button#btn-entrar e aguardar a resposta da API B2B
    log(`Clicando no botão EXATO de submit: "${loginSel.login_submit}"...`);
    const submitBtn = page.locator(loginSel.login_submit).first();

    const responsePromise = page.waitForResponse(res => res.url().includes('login/b2b'), { timeout: 15000 }).catch(() => null);
    await submitBtn.click({ force: true });
    
    const loginRes = await responsePromise;
    let loginApiStatus = 0;
    let loginApiBody = '';

    if (loginRes) {
      loginApiStatus = loginRes.status();
      loginApiBody = await loginRes.text().catch(() => '');
      log(`🌐 [LOGIN API RESPONSE HTTP ${loginApiStatus}] Body: ${loginApiBody.substring(0, 150)}`);
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(printsDir, '01_login_confirmado.png') });
    fs.writeFileSync(path.join(htmlDumpsDir, '01_home_pos_login.html'), await page.content(), 'utf8');

    // -------------------------------------------------------------------------
    // VALIDAÇÃO PÓS-LOGIN ESTRITA
    // -------------------------------------------------------------------------
    log('\n--- VALIDAÇÃO PÓS-LOGIN ESTRITA ---');
    const isLoginOk = loginApiStatus === 200 && loginApiBody.includes('"token"');

    if (!isLoginOk) {
      log('❌ [ERRO CRÍTICO DE AUTENTICAÇÃO] O login NÃO foi efetivado!');
      log(`API Status: ${loginApiStatus} | Body: ${loginApiBody}`);
      log('Conforme REGRA ABSOLUTA, a execução foi interrompida imediatamente sem prosseguir para os produtos.');

      const failPayload = {
        sucesso: false,
        etapaFalha: 'PASSO_2_LOGIN',
        loginApiStatus,
        loginApiBody,
        seletorUsado: loginSel.login_submit
      };
      fs.writeFileSync(path.join(baseDir, 'payload_final.json'), JSON.stringify(failPayload, null, 2), 'utf8');

      const failReport = `# Relatório do Teste 5 — Falha de Login

- **Data**: ${new Date().toLocaleString('pt-BR')}
- **Status**: ❌ INTERROMPIDO NO LOGIN
- **Seletor Usado**: \`${loginSel.login_submit}\`
- **HTTP Status**: \`${loginApiStatus}\`
- **Mensagem da API**: \`${loginApiBody}\`
`;
      fs.writeFileSync(path.join(baseDir, 'relatorio_final.md'), failReport, 'utf8');
      return;
    }

    log('🎉 [LOGIN EFETIVADO COM SUCESSO] Token JWT obtido da API Construjá!');
    log('==============================================================================');

    // -------------------------------------------------------------------------
    // PASSO 3: BUSCA E ADIÇÃO DOS 9 ITENS
    // -------------------------------------------------------------------------
    log('\n--- PASSO 3: Buscando e adicionando os 9 itens com sessão B2B ativa ---');
    const resultadosCotacao = [];

    let itemIdx = 0;
    for (const item of itensParaCotar) {
      itemIdx++;
      log(`\n🔍 [Item ${itemIdx}/9] Buscando: "${item.termo}" (Qtd: ${item.quantidade})...`);

      const searchUrl = `https://www.construja.com.br/produtos?pagina=1&busca=${encodeURIComponent(item.termo)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      const printSearchPath = path.join(printsDir, `02_busca_item_${String(itemIdx).padStart(2, '0')}.png`);
      const htmlSearchPath = path.join(htmlDumpsDir, `02_busca_item_${String(itemIdx).padStart(2, '0')}.html`);
      await page.screenshot({ path: printSearchPath });
      fs.writeFileSync(htmlSearchPath, await page.content(), 'utf8');

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
      log(`🎯 Produto encontrado: "${productTitleText}"`);

      // Quantidade e Enter
      const qtyInput = page.locator('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]').first();
      if (await qtyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await qtyInput.focus();
        await qtyInput.fill(String(item.quantidade));
        await page.waitForTimeout(500);
        await qtyInput.press('Enter');
        await page.waitForTimeout(2500);
      }

      const printAddPath = path.join(printsDir, `03_item_${String(itemIdx).padStart(2, '0')}_adicionado.png`);
      await page.screenshot({ path: printAddPath });

      resultadosCotacao.push({
        solicitado: item.termo,
        quantidadePedida: item.quantidade,
        status: 'ADICIONADO',
        produtoEncontrado: productTitleText,
        precoUnitario: 0,
        subtotal: 0
      });
    }

    // -------------------------------------------------------------------------
    // PASSO 4: ACESSAR CARRINHO E EXTRAIR PREÇOS
    // -------------------------------------------------------------------------
    log('\n--- PASSO 4: Acessando e extraindo os preços reais do carrinho ---');
    await page.goto('https://www.construja.com.br/carrinho', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(4000);

    await page.screenshot({ path: path.join(printsDir, '04_carrinho_completo.png') });
    fs.writeFileSync(path.join(htmlDumpsDir, '04_carrinho_completo.html'), await page.content(), 'utf8');

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

    log(`🛒 Qtd de itens extraídos do Carrinho: ${cartExtracted.items.length}`);
    log(`💰 Total Geral do Carrinho: R$ ${cartExtracted.totalGeral.toFixed(2)}`);

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

    // -------------------------------------------------------------------------
    // PASSO 5 E 6: PAYLOAD E RELATÓRIO FINAL
    // -------------------------------------------------------------------------
    const finalPayload = {
      sucesso: true,
      fornecedor: 'Construjá',
      fornecedor_id: dbForn.id,
      dataExecucao: new Date().toISOString(),
      totalGeralPedido: cartExtracted.totalGeral,
      itensCotados: resultadosCotacao,
      itensDOMCarrinho: cartExtracted.items
    };

    fs.writeFileSync(path.join(baseDir, 'payload_final.json'), JSON.stringify(finalPayload, null, 2), 'utf8');

    let tabelaMd = '| Item Solicidado | Qtd Pedida | Produto Efetivamente Cotado | Preço Unitário (R$) | Subtotal (R$) | Status |\n';
    tabelaMd += '| :--- | :---: | :--- | :---: | :---: | :---: |\n';

    for (const r of resultadosCotacao) {
      tabelaMd += `| ${r.solicitado} | ${r.quantidadePedida} | ${r.produtoEncontrado} | R$ ${r.precoUnitario.toFixed(2)} | R$ ${r.subtotal.toFixed(2)} | ${r.status === 'ADICIONADO' ? '✅ Cotado' : '❌ ' + r.status} |\n`;
    }

    const relatorioMd = `# Relatório de Execução Real — Teste 5 Construjá (Login Corrigido)

- **Data de Execução**: ${new Date().toLocaleString('pt-BR')}
- **Seletor de Login Utilizado**: \`${loginSel.login_submit}\` (\`button#btn-entrar\`)
- **Resultado da Autenticação**: 🎉 LOGIN EFETIVADO COM SUCESSO (HTTP 200 Token JWT)
- **Total Geral do Carrinho**: **R$ ${cartExtracted.totalGeral.toFixed(2)}**

---

## 📊 Tabela Comparativa (Solicitado x Cotado)

${tabelaMd}

---

## 📁 Arquivos Salvos na Pasta do Histórico
- \`execucao.log\` — Log completo com timestamps de execução.
- \`payload_final.json\` — Payload retornado pelo robô.
- \`prints/\` — Screenshots das telas pós-login, buscas e carrinho.
- \`html_dumps/\` — HTMLs capturados das páginas do portal.
`;

    fs.writeFileSync(path.join(baseDir, 'relatorio_final.md'), relatorioMd, 'utf8');
    log('📄 Relatório final salvo em relatorio_final.md.');

  } catch (err) {
    log(`❌ ERRO CRÍTICO NO TESTE 5: ${err.stack || err}`);
  } finally {
    await browser.close();
    execLogStream.end();
  }
}

executarTeste5Construja();
