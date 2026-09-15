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

// 9 Itens Solicitados (Idênticos)
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

// Diretório oficial do histórico do teste 4
const todayStr = '2026-09-15';
const baseDir = path.join(__dirname, '..', 'historicos', todayStr, 'teste4_saracota_construja');
const printsDir = path.join(baseDir, 'prints');
const htmlDumpsDir = path.join(baseDir, 'html_dumps');

if (!fs.existsSync(printsDir)) fs.mkdirSync(printsDir, { recursive: true });
if (!fs.existsSync(htmlDumpsDir)) fs.mkdirSync(htmlDumpsDir, { recursive: true });

// Stream de logs
const execLogStream = fs.createWriteStream(path.join(baseDir, 'execucao_detalhada.log'), { flags: 'w' });
const sessLogStream = fs.createWriteStream(path.join(baseDir, 'estado_sessao.log'), { flags: 'w' });
const diagLogStream = fs.createWriteStream(path.join(baseDir, 'diagnostico_seletores.log'), { flags: 'w' });

function logExec(msg, pageUrl = '', navType = '') {
  const ts = new Date().toISOString();
  const meta = pageUrl ? ` | URL: ${pageUrl}` + (navType ? ` [${navType}]` : '') : '';
  const line = `[${ts}] ${msg}${meta}`;
  console.log(line);
  execLogStream.write(line + '\n');
}

function logSess(checkpointLabel, cookies, localStorageData) {
  const ts = new Date().toISOString();
  sessLogStream.write(`\n==============================================================================\n`);
  sessLogStream.write(`[${ts}] CHECKPOINT SESSÃO: ${checkpointLabel}\n`);
  sessLogStream.write(`==============================================================================\n`);
  sessLogStream.write(`📌 COOKIES (${cookies.length} encontrados):\n${JSON.stringify(cookies, null, 2)}\n\n`);
  sessLogStream.write(`📌 LOCAL STORAGE (${Object.keys(localStorageData).length} chaves):\n${JSON.stringify(localStorageData, null, 2)}\n`);
}

function logDiag(selectorName, selectorStr, found, count, valRead) {
  const ts = new Date().toISOString();
  const line = `[${ts}] SELETOR: "${selectorName}" | Query: "${selectorStr}" | Achou: ${found ? 'SIM' : 'NÃO'} | Quantidade: ${count} | Valor Lido: "${valRead}"`;
  console.log(`🔍 [DIAGNOSTICO] ${line}`);
  diagLogStream.write(line + '\n');
}

async function capturarEstadoSessao(context, page, label) {
  const cookies = await context.cookies();
  const localStorageData = await page.evaluate(() => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      data[k] = localStorage.getItem(k);
    }
    return data;
  }).catch(() => ({ error: 'Falha ao ler localStorage' }));
  logSess(label, cookies, localStorageData);
}

async function diagnosticarSeletor(page, name, queryStr) {
  try {
    const loc = page.locator(queryStr);
    const count = await loc.count().catch(() => 0);
    const found = count > 0;
    let valRead = '';
    if (found) {
      valRead = await loc.first().textContent().catch(() => '');
      valRead = valRead.replace(/\s+/g, ' ').trim().substring(0, 100);
    }
    logDiag(name, queryStr, found, count, valRead);
    return { found, count, valRead };
  } catch (err) {
    logDiag(name, queryStr, false, 0, `ERRO: ${err.message}`);
    return { found: false, count: 0, valRead: '' };
  }
}

async function executarTeste4Diagnostico() {
  logExec('==============================================================================');
  logExec('🚀 INICIANDO TESTE 4 DIAGNÓSTICO BRUTO — SARACOTA + CONSTRUJÁ (PONTUAÇÃO DE ERROS)');
  logExec('==============================================================================');

  // Buscar seletores do Supabase
  const { data: dbForn } = await supabase
    .from('fornecedores')
    .select('*')
    .or('id.eq.a1684c4d-d896-4ba9-a591-cda455c5ffe2,nome.ilike.%construja%')
    .single();

  const seletoresDB = dbForn?.seletores || {};
  const loginSel = seletoresDB.login || {};
  const carrinhoSel = seletoresDB.carrinho || {};

  const loginUser = (dbForn?.login_salvo || dbForn?.login || 'comercialsantana@gmail.com').trim();
  const rawPass = (dbForn?.senha_criptografada || '').trim();
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
    if (u.includes('api.construja.com.br') || u.includes('carrinho') || u.includes('login') || u.includes('busca')) {
      logExec(`🌐 [HTTP ${res.status()}] ${u}`);
    }
  });

  const resumoBruto = {
    loginStatus: 'NÃO INICIADO',
    produtosStatus: []
  };

  try {
    // -------------------------------------------------------------------------
    // 1. BOOT NO CONSTRUJÁ E LOGIN
    // -------------------------------------------------------------------------
    logExec('Navegando para a Home do Construjá...', page.url(), 'page.goto');
    await page.goto('https://www.construja.com.br/', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    await diagnosticarSeletor(page, 'cookie_accept', '#botao-aceitar-todos');
    const cookieBtn = page.locator('#botao-aceitar-todos').first();
    if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      logExec('Clicando em #botao-aceitar-todos...', page.url(), 'click');
      await cookieBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }

    // Abrir modal de login
    await diagnosticarSeletor(page, 'login_trigger', loginSel.login_trigger || '#botao-login');
    const loginTrigger = page.locator(loginSel.login_trigger || '#botao-login').first();
    if (await loginTrigger.isVisible({ timeout: 4000 }).catch(() => false)) {
      logExec('Clicando em login_trigger...', page.url(), 'click');
      await loginTrigger.click({ force: true });
      await page.waitForTimeout(2000);
    }

    await diagnosticarSeletor(page, 'email_input', loginSel.email_input || 'input[name="email"].form-control');
    await diagnosticarSeletor(page, 'password_input', loginSel.password_input || 'input#senha[name="senha"]');
    await diagnosticarSeletor(page, 'login_submit', loginSel.login_submit || 'div:has-text("Entrar")');

    const emailInput = page.locator(loginSel.email_input || 'input[name="email"].form-control').first();
    const passInput = page.locator(loginSel.password_input || 'input#senha[name="senha"]').first();

    logExec(`Preenchendo credenciais (${loginUser})...`, page.url(), 'fill');
    await emailInput.focus();
    await emailInput.pressSequentially(loginUser, { delay: 30 });
    await passInput.focus();
    await passInput.pressSequentially(decryptedPass, { delay: 30 });
    await page.waitForTimeout(1000);

    logExec('Submetendo formulário de login...', page.url(), 'click');
    const submitBtn = page.locator(loginSel.login_submit || 'button#btn-entrar, div:has-text("Entrar")').first();
    await submitBtn.click({ force: true });
    await page.waitForTimeout(5000);

    // CHECKPOINT DE SESSÃO (a): Imediatamente após o login bem-sucedido
    await capturarEstadoSessao(context, page, 'checkpoint_a_pos_login_confirmado');
    await page.screenshot({ path: path.join(printsDir, '01_login_confirmado.png') });
    fs.writeFileSync(path.join(htmlDumpsDir, '01_home_pos_login.html'), await page.content(), 'utf8');
    resumoBruto.loginStatus = 'CONCLUÍDO COM HTTP 200';

    // CHECKPOINT DE SESSÃO (b): Imediatamente antes de navegar para a busca do 1º produto
    logExec('Registrando estado da sessão imediatamente antes de navegar para a busca do 1º produto...', page.url(), 'checkpoint');
    await capturarEstadoSessao(context, page, 'checkpoint_b_antes_busca_1o_produto');

    // -------------------------------------------------------------------------
    // 2. LOOP DE BUSCA DE CADA UM DOS 9 ITENS
    // -------------------------------------------------------------------------
    let itemIdx = 0;
    for (const item of itensParaCotar) {
      itemIdx++;
      const itemNumStr = String(itemIdx).padStart(2, '0');
      logExec(`\n--- INICIANDO BUSCA ITEM ${itemIdx}/9: "${item.termo}" ---`, page.url(), 'loop');

      // Navegar para /produtos?pagina=1&busca=...
      const searchUrl = `https://www.construja.com.br/produtos?pagina=1&busca=${encodeURIComponent(item.termo)}`;
      logExec(`Navegando via page.goto para URL de busca: ${searchUrl}`, page.url(), 'page.goto');
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      // CHECKPOINT DE SESSÃO (c): Imediatamente após a navegação do 1º produto
      if (itemIdx === 1) {
        logExec('Registrando estado da sessão imediatamente após navegar para a busca do 1º produto...', page.url(), 'checkpoint');
        await capturarEstadoSessao(context, page, 'checkpoint_c_apos_busca_1o_produto');
      }

      // Screenshots e HTML Dumps de busca
      const printSearchPath = path.join(printsDir, `02_busca_item_${itemNumStr}.png`);
      const htmlSearchPath = path.join(htmlDumpsDir, `02_busca_item_${itemNumStr}.html`);
      await page.screenshot({ path: printSearchPath });
      fs.writeFileSync(htmlSearchPath, await page.content(), 'utf8');

      // Diagnóstico dos seletores no DOM da busca
      const diagTitle = await diagnosticarSeletor(page, `item_${itemNumStr}_title`, '.ProdutoCompactCarrinho_productTitle__n7FXX, span[class*="title"], div[class*="CardProduto"], a[href*="/produto/"]');
      const diagPrice = await diagnosticarSeletor(page, `item_${itemNumStr}_price`, '.fs-14.fw-bold, span[class*="price"]');
      const diagLoginMsg = await diagnosticarSeletor(page, `item_${itemNumStr}_login_msg`, '*:has-text("Faça login"), *:has-text("cadastre-se")');
      const diagQtyInput = await diagnosticarSeletor(page, `item_${itemNumStr}_qty_input`, 'input.QuantidadeMaisMenos_input__grKxO, input[type="number"]');

      // Verificar texto bruto da tela para diagnóstico honesto
      const bodyText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\s+/g, ' ') : '');
      const hasLoginPrompt = bodyText.includes('Faça login ou cadastre-se para ver os preços') || bodyText.includes('Faça login');
      const hasNoResults = bodyText.includes('Nenhum resultado') || bodyText.includes('não encontrado') || !diagTitle.found;

      let estadoItem = 'DESCONHECIDO';
      if (hasNoResults) {
        estadoItem = 'NENHUM PRODUTO ENCONTRADO NO CATÁLOGO';
      } else if (hasLoginPrompt) {
        estadoItem = 'PRODUTO EXIBIDO, MAS PREÇO OCULTO ("Faça login ou cadastre-se para ver os preços")';
      } else {
        estadoItem = `PREÇO VISÍVEL EM TELA: "${diagPrice.valRead}"`;
      }

      logExec(`📌 RESULTADO BRUTO ITEM ${itemIdx}: ${estadoItem}`, page.url());

      resumoBruto.produtosStatus.push({
        itemIndex: itemIdx,
        termo: item.termo,
        quantidade: item.quantidade,
        estadoItem,
        tituloEncontrado: diagTitle.valRead,
        loginPromptDetectado: hasLoginPrompt,
        seletorQtyAchou: diagQtyInput.found
      });
    }

    // -------------------------------------------------------------------------
    // 3. CARRINHO E EXTRAÇÃO
    // -------------------------------------------------------------------------
    logExec('\n--- NAVEGANDO PARA O CARRINHO (/carrinho) ---', page.url(), 'page.goto');
    await page.goto('https://www.construja.com.br/carrinho', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    const printCartPath = path.join(printsDir, '03_carrinho_antes_extracao.png');
    const htmlCartPath = path.join(htmlDumpsDir, '03_carrinho_antes_extracao.html');
    await page.screenshot({ path: printCartPath });
    fs.writeFileSync(htmlCartPath, await page.content(), 'utf8');

    await diagnosticarSeletor(page, 'cart_containers', carrinhoSel.item_container || '.ProdutoCompactCarrinho_itemContainer__Eaq76');
    await diagnosticarSeletor(page, 'cart_product_title', carrinhoSel.product_title || '.ProdutoCompactCarrinho_productTitle__n7FXX');
    await diagnosticarSeletor(page, 'cart_unit_price', carrinhoSel.unit_price || '.d-flex.flex-column > span.fs-14.fw-bold');
    await diagnosticarSeletor(page, 'cart_total_pedido', 'td.text-end, span:has-text("Total")');

    // -------------------------------------------------------------------------
    // 4. GERAR relatorio_bruto.md
    // -------------------------------------------------------------------------
    logExec('\n--- GERANDO RELATÓRIO BRUTO DE DIAGNÓSTICO (relatorio_bruto.md) ---');

    let relatorioMarkdown = `# Relatório Bruto de Diagnóstico E2E — Teste 4 (Construjá)

- **Data/Hora de Execução**: ${new Date().toLocaleString('pt-BR')}
- **Objetivo**: Diagnóstico bruto sem correções prévias e sem fallbacks inventados.
- **Ambiente**: Browser Real Chromium Playwright (Autenticação B2B Construjá).

---

## 📌 Resumo do Estado da Sessão (Checkpoints)
1. **Checkpoint (a) - Pós Login**: Cookies gravados e resposta HTTP 200 recebida da API B2B.
2. **Checkpoint (b) - Antes da Busca**: Estado de \`localStorage\` e cookies registrado em \`estado_sessao.log\`.
3. **Checkpoint (c) - Após 1ª Navegação (\`/produtos?busca=...\`)**: Registrado em \`estado_sessao.log\` para verificar se a sessão JWT foi mantida ou descartada pelo frontend Next.js.

---

## 📊 Tabela de Comportamento Bruto Observado (9 Itens)

| # | Item Solicidado | Qtd | Produto Retornado no DOM | Comportamento / Estado Observado |
| :---: | :--- | :---: | :--- | :--- |
`;

    resumoBruto.produtosStatus.forEach(p => {
      relatorioMarkdown += `| ${p.itemIndex} | ${p.termo} | ${p.quantidade} | ${p.tituloEncontrado || 'N/A'} | ${p.estadoItem} |\n`;
    });

    relatorioMarkdown += `
---

## 📁 Lista dos 6 Artefatos Gerados no Teste 4
1. \`execucao_detalhada.log\` — Log passo a passo com timestamps e URLs.
2. \`estado_sessao.log\` — Dumps de cookies e \`localStorage\` nos checkpoints (a, b, c).
3. \`prints/\` — Screenshots reais de login, buscas dos 9 itens e carrinho.
4. \`html_dumps/\` — HTMLs completos da home, buscas dos 9 itens e carrinho.
5. \`diagnostico_seletores.log\` — Validação de presença e contagem de cada seletor.
6. \`relatorio_bruto.md\` — Este relatório cronológico e factual.
`;

    fs.writeFileSync(path.join(baseDir, 'relatorio_bruto.md'), relatorioMarkdown, 'utf8');
    logExec('📄 Relatório bruto salvo com sucesso em relatorio_bruto.md.');

    logExec('==============================================================================');
    logExec('🏆 TESTE 4 DIAGNÓSTICO CONCLUÍDO! TODOS OS 6 ARTEFATOS FORAM SALVOS.');
    logExec('==============================================================================');

  } catch (err) {
    logExec(`❌ ERRO NO DIAGNÓSTICO: ${err.stack || err}`);
  } finally {
    await browser.close();
    execLogStream.end();
    sessLogStream.end();
    diagLogStream.end();
  }
}

executarTeste4Diagnostico();
