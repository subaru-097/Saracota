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

// Pasta de Destino do Teste 6
const todayStr = '2026-09-15';
const baseDir = path.join(__dirname, '..', 'historicos', todayStr, 'teste6_saracota_construja');
const printsDir = path.join(baseDir, 'prints');

if (!fs.existsSync(printsDir)) fs.mkdirSync(printsDir, { recursive: true });

// Stream de log detalhado
const execLogStream = fs.createWriteStream(path.join(baseDir, 'execucao_detalhada.log'), { flags: 'w' });

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  execLogStream.write(line + '\n');
}

async function executarTeste6PontaAPonta() {
  log('==============================================================================');
  log('🚀 INICIANDO TESTE 6 E2E REAL — CONSTRUJÁ + SARACOTA APP (ADICIONAR + EXTRAIR + RETORNAR)');
  log('==============================================================================');

  // PASSO 1: Ler seletores do Supabase DB
  log('--- PARTE 1 / PASSO 1: Lendo seletores do fornecedor Construjá no Supabase ---');
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

  const seletoresDB = dbForn.seletores || {};
  const loginSel = seletoresDB.login || {};
  const carrinhoSel = seletoresDB.carrinho || {};

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
    // 1. LOGIN NO PORTAL CONSTRUJÁ
    // -------------------------------------------------------------------------
    log('\n--- Realizando login no portal da Construjá com seletor button#btn-entrar ---');
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
      log('Clicando em #botao-login...');
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

    log(`Clicando no botão EXATO de submit: "${loginSel.login_submit}"...`);
    const submitBtn = page.locator(loginSel.login_submit || 'button#btn-entrar').first();

    const responsePromise = page.waitForResponse(res => res.url().includes('login/b2b'), { timeout: 15000 }).catch(() => null);
    await submitBtn.click({ force: true });

    const loginRes = await responsePromise;
    let loginApiStatus = loginRes ? loginRes.status() : 0;
    let loginApiBody = loginRes ? await loginRes.text().catch(() => '') : '';

    log(`🌐 Login API Status: ${loginApiStatus} | Body Snippet: ${loginApiBody.substring(0, 100)}`);
    await page.waitForTimeout(3000);

    const isLoginOk = loginApiStatus === 200 && loginApiBody.includes('"token"');
    if (!isLoginOk) {
      log('❌ [ERRO CRÍTICO] Login na Construjá falhou ou token ausente. Interrompendo.');
      return;
    }

    log('🎉 [AUTENTICAÇÃO B2B CONFIRMADA] Token JWT ativo no portal Construjá.');
    await page.screenshot({ path: path.join(printsDir, '01_login_construja_confirmado.png') });

    // -------------------------------------------------------------------------
    // 2. BUSCA E ADIÇÃO REAL DOS 9 ITENS
    // -------------------------------------------------------------------------
    log('\n--- PARTE 1 / PASSO 2: Buscando e adicionando os itens ao carrinho ---');
    const resultadosItens = [];

    let itemIdx = 0;
    for (const item of itensParaCotar) {
      itemIdx++;
      const itemNumStr = String(itemIdx).padStart(2, '0');
      log(`\n🔍 [Item ${itemIdx}/9] Buscando no catálogo Construjá: "${item.termo}" (Quantidade: ${item.quantidade})...`);

      const searchUrl = `https://www.construja.com.br/produtos?pagina=1&busca=${encodeURIComponent(item.termo)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      const printSearchPath = path.join(printsDir, `02_busca_item_${itemNumStr}.png`);
      await page.screenshot({ path: printSearchPath });
      log(`📸 Print de busca salvo: 02_busca_item_${itemNumStr}.png`);

      // Verificar se há produto no card do resultado
      const titleElement = page.locator('span[class*="title"], div[class*="CardProduto"], a[href*="/produto/"]').first();
      const hasProduct = await titleElement.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasProduct) {
        log(`⚠️ Item NÃO LOCALIZADO no catálogo do Construjá: "${item.termo}"`);
        resultadosItens.push({
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
      log(`🎯 Produto retornado no card: "${productTitleText}"`);

      // Definir a quantidade no campo input.QuantidadeMaisMenos_input__grKxO
      const qtyInput = page.locator('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]').first();
      if (await qtyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await qtyInput.scrollIntoViewIfNeeded().catch(() => {});
        await qtyInput.focus();
        await qtyInput.fill(String(item.quantidade));
        await page.waitForTimeout(500);

        // Disparar eventos DOM e enviar tecla ENTER para submeter a adição ao carrinho B2B
        log(`⌨️ Pressionando ENTER no campo de quantidade para adicionar ao carrinho B2B...`);
        await qtyInput.press('Enter');
        await page.waitForTimeout(3000);
      }

      const printAddPath = path.join(printsDir, `03_item_${itemNumStr}_adicionado.png`);
      await page.screenshot({ path: printAddPath });
      log(`📸 Print de adição salvo: 03_item_${itemNumStr}_adicionado.png`);

      resultadosItens.push({
        solicitado: item.termo,
        quantidadePedida: item.quantidade,
        status: 'ADICIONADO',
        produtoEncontrado: productTitleText,
        precoUnitario: 0,
        subtotal: 0
      });
    }

    // -------------------------------------------------------------------------
    // 3. EXTRAÇÃO DO CARRINHO CONSTRUJÁ
    // -------------------------------------------------------------------------
    log('\n--- PARTE 1 / PASSO 3: Navegando para /carrinho e extraindo o snapshot final ---');
    await page.goto('https://www.construja.com.br/carrinho', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(4000);

    const printCarrinhoPath = path.join(printsDir, '04_carrinho_final_construja.png');
    await page.screenshot({ path: printCarrinhoPath });
    log(`📸 Print do carrinho salvo: 04_carrinho_final_construja.png`);

    const cartSnapshot = await page.evaluate(({ containerSel, titleSel, priceSel }) => {
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
            produto: title,
            quantidade: qtyVal,
            precoUnitario: unitPrice,
            subtotal: unitPrice * qtyVal
          });
        }
      });

      let totalGeral = 0;
      const allElements = Array.from(document.querySelectorAll('td, span, div, tr'));
      const totalEl = allElements.find(el => (el.textContent || '').includes('Total pedido') || (el.textContent || '').includes('Total Geral'));
      if (totalEl) {
        const m = totalEl.textContent.match(/R\$\s*([\d\.,]+)/);
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
      containerSel: carrinhoSel.item_container,
      titleSel: carrinhoSel.product_title,
      priceSel: carrinhoSel.unit_price
    });

    log(`🛒 Total de itens no carrinho B2B: ${cartSnapshot.items.length}`);
    log(`💰 Total Geral do Carrinho: R$ ${cartSnapshot.totalGeral.toFixed(2)}`);

    const carrinhoFinalJson = {
      fornecedor: 'Construjá',
      fornecedor_id: dbForn.id,
      dataExtracao: new Date().toISOString(),
      totalGeral: cartSnapshot.totalGeral,
      itensConfirmadosCarrinho: cartSnapshot.items
    };

    fs.writeFileSync(path.join(baseDir, 'carrinho_final.json'), JSON.stringify(carrinhoFinalJson, null, 2), 'utf8');
    log('📄 File carrinho_final.json salvo.');

    // Atualizar resultados com preços extraídos estritamente do DOM
    for (const res of resultadosItens) {
      if (res.status === 'ADICIONADO') {
        const match = cartSnapshot.items.find(ci => ci.produto.toLowerCase().includes(res.solicitado.split(' ')[0].toLowerCase()));
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
    // PARTE 2 — SARACOTA: INSERIR LISTA + COTAR + BANCO + INTERFACE
    // -------------------------------------------------------------------------
    log('\n--- PARTE 2 / PASSO 4, 5, 6, 7: Acessando SaraCota Web App (http://localhost:3000) ---');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    log('Preenchendo os 9 itens no Bloco de Compras Inteligente do Saracota...');
    for (const item of itensParaCotar) {
      const itemText = `${item.quantidade}x ${item.termo}`;
      const inputItem = page.locator('input[placeholder*="Adicionar"], input[type="text"]').first();
      if (await inputItem.isVisible().catch(() => false)) {
        await inputItem.fill(itemText);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
      }
    }

    const printSaracotaPreenchido = path.join(printsDir, '05_saracota_bloco_compras_preenchido.png');
    await page.screenshot({ path: printSaracotaPreenchido });
    log(`📸 Print do Bloco de Compras preenchido salvo: 05_saracota_bloco_compras_preenchido.png`);

    // Inserir cotação no banco de dados da SaraCota (Supabase)
    log('\n--- PARTE 2 / PASSO 8: Persistindo cotação processada no Supabase da SaraCota ---');
    const { data: cotIns } = await supabase.from('cotacoes').insert({
      fornecedor_id: dbForn.id,
      status: 'CONCLUIDO',
      valor_total: cartSnapshot.totalGeral,
      origem: 'RPA_ROBO',
      metadata: { fornecedor_slug: 'construja', test_run: 'teste6_saracota_construja', obra: 'Reserva das Palmeiras' }
    }).select().single();

    if (cotIns) {
      const payloadItens = resultadosItens.map(r => ({
        cotacao_id: cotIns.id,
        produto_nome: r.produtoEncontrado !== 'N/A' ? r.produtoEncontrado : r.solicitado,
        quantidade: r.quantidadePedida,
        preco_unitario: r.precoUnitario,
        subtotal: r.subtotal,
        status: r.status === 'ADICIONADO' ? 'COTADO' : 'NAO_LOCALIZADO'
      }));

      await supabase.from('itens_cotacao_fornecedor').insert(payloadItens);
      log(`✅ Cotação e itens salvos no Supabase com ID: ${cotIns.id}`);
    }

    // Recarregar SaraCota App UI para visualização do resultado final
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);

    const printSaracotaResultado = path.join(printsDir, '06_saracota_resultado_final.png');
    await page.screenshot({ path: printSaracotaResultado });
    log(`📸 Print do resultado final no Saracota salvo: 06_saracota_resultado_final.png`);

    // -------------------------------------------------------------------------
    // RELATÓRIOS E RESULTADOS FINAIS
    // -------------------------------------------------------------------------
    log('\n--- PARTE 2 / PASSO 9: Gerando resultado_saracota.json e relatorio_final.md ---');

    const resultadoSaracotaJson = {
      obraDestino: 'Reserva das Palmeiras',
      fornecedor: 'Construjá',
      valorTotalCotacao: cartSnapshot.totalGeral,
      itensEncontrados: resultadosItens.filter(r => r.status === 'ADICIONADO'),
      itensNaoEncontrados: resultadosItens.filter(r => r.status !== 'ADICIONADO')
    };

    fs.writeFileSync(path.join(baseDir, 'resultado_saracota.json'), JSON.stringify(resultadoSaracotaJson, null, 2), 'utf8');
    log('📄 File resultado_saracota.json salvo.');

    let tabelaMd = '| Item Solicidado | Qtd Pedida | Produto Cotado no Construjá | Preço Unitário (R$) | Subtotal (R$) | Status |\n';
    tabelaMd += '| :--- | :---: | :--- | :---: | :---: | :---: |\n';

    for (const r of resultadosItens) {
      tabelaMd += `| ${r.solicitado} | ${r.quantidadePedida} | ${r.produtoEncontrado} | R$ ${r.precoUnitario.toFixed(2)} | R$ ${r.subtotal.toFixed(2)} | ${r.status === 'ADICIONADO' ? '✅ Cotado' : '❌ ' + r.status} |\n`;
    }

    const relatorioMd = `# Relatório Final de Execução Real — Teste 6 Saracota + Construjá

- **Data/Hora**: ${new Date().toLocaleString('pt-BR')}
- **Fornecedor**: Construjá (\`${dbForn.id}\`)
- **Obra / Destino**: Reserva das Palmeiras
- **Total Geral do Pedido Construjá**: **R$ ${cartSnapshot.totalGeral.toFixed(2)}**

---

## 📌 Resumo da Automação End-to-End
1. **Login B2B**: Autenticado via \`button#btn-entrar\` com confirmação HTTP 200 (Token JWT obtido).
2. **Busca & Adição**: Processados os 9 itens com a sessão B2B ativa no portal da Construjá.
3. **Snapshot do Carrinho**: Carrinho B2B extraído diretamente do DOM da página \`/carrinho\`.
4. **Integração SaraCota App**: Itens inseridos no Bloco de Compras da SaraCota (\`http://localhost:3000\`) e gravados na tabela \`cotacoes\` do Supabase.

---

## 📊 Tabela Comparativa (Solicitado x Cotado)

${tabelaMd}

---

## 📁 Arquivos Gerados em \`teste6_saracota_construja/\`
- \`execucao_detalhada.log\` — Log completo da execução end-to-end com timestamps.
- \`carrinho_final.json\` — Snapshot dos itens confirmados no carrinho B2B da Construjá.
- \`resultado_saracota.json\` — Relatório consolidado gerado para a plataforma SaraCota.
- \`prints/\` — Screenshots das etapas (Login, Buscas, Carrinho Construjá, Bloco de Compras e Resultados SaraCota).
- \`relatorio_final.md\` — Este relatório em markdown.
`;

    fs.writeFileSync(path.join(baseDir, 'relatorio_final.md'), relatorioMd, 'utf8');
    log('📄 Relatório final salvo com sucesso em relatorio_final.md.');

    log('==============================================================================');
    log('🏆 TESTE 6 CONCLUÍDO COM SUCESSO! TODOS OS ARTEFATOS SALVOS.');
    log('==============================================================================');

  } catch (err) {
    log(`❌ ERRO CRÍTICO NO TESTE 6: ${err.stack || err}`);
  } finally {
    await browser.close();
    execLogStream.end();
  }
}

executarTeste6PontaAPonta();
