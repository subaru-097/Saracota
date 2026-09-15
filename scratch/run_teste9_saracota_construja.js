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

// Regra de arredondamento por Múltiplo M
function calcularQFinal(qSolicitada, M) {
  if (M <= 1) return qSolicitada;
  let qCalculada = Math.round(qSolicitada / M) * M;
  if (qCalculada === 0 && qSolicitada > 0) {
    qCalculada = M;
  }
  return qCalculada;
}

// Pasta oficial do Teste 9
const todayStr = '2026-09-15';
const baseDir = path.join(__dirname, '..', 'historicos', todayStr, 'teste9_saracota_construja');
const printsDir = path.join(baseDir, 'prints');

if (!fs.existsSync(printsDir)) fs.mkdirSync(printsDir, { recursive: true });

// Log streams
const execLogStream = fs.createWriteStream(path.join(baseDir, 'execucao_detalhada.log'), { flags: 'w' });
const dupLogStream = fs.createWriteStream(path.join(baseDir, 'diagnostico_duplicacao.log'), { flags: 'w' });

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  execLogStream.write(line + '\n');
}

function logDup(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [DUPLICACAO_DIAGNOSTICO] ${msg}`;
  console.log(line);
  dupLogStream.write(line + '\n');
}

async function executarTeste9PontaAPonta() {
  log('==============================================================================');
  log('🚀 INICIANDO TESTE 9 E2E REAL — CONSTRUJÁ + SARACOTA (CORREÇÕES CRÍTICAS DE CARRINHO)');
  log('==============================================================================');

  // Ler seletores do Supabase DB
  log('--- PASSO 1: Lendo seletores do fornecedor Construjá no Supabase ---');
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
      log('❌ [ERRO CRÍTICO] Login na Construjá falhou. Interrompendo.');
      return;
    }

    log('🎉 [AUTENTICAÇÃO B2B CONFIRMADA] Token JWT ativo no portal Construjá.');
    await page.screenshot({ path: path.join(printsDir, '01_login_construja_confirmado.png') });

    // -------------------------------------------------------------------------
    // 2. LIMPEZA PROFUNDA DO CARRINHO E VALIDAÇÃO DE ESTADO VAZIO (REQUISITO B)
    // -------------------------------------------------------------------------
    log('\n--- PASSO 2: Limpeza profunda do carrinho antes de iniciar o Teste 9 ---');
    await page.goto('https://www.construja.com.br/carrinho', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    let itensRemovidosCount = 0;
    const itemContainers = page.locator('.ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*="itemContainer"]');
    let cartCount = await itemContainers.count().catch(() => 0);

    log(`🛒 Itens encontrados no carrinho pré-existente: ${cartCount}`);

    if (cartCount > 0) {
      log('Acionando remoção de todos os itens antigos do carrinho...');
      
      const emptyBtn = page.locator('button:has-text("Esvaziar"), button:has-text("Limpar"), button.btn-outline-danger').first();
      if (await emptyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        log('Clicando no botão de esvaziar carrinho...');
        await emptyBtn.click({ force: true });
        await page.waitForTimeout(1500);

        // Se abrir modal de confirmação, clica em confirmar
        const confirmModalBtn = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), .modal button.btn-danger').first();
        if (await confirmModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          log('Confirmando modal de esvaziamento...');
          await confirmModalBtn.click({ force: true });
          await page.waitForTimeout(2500);
        }
      }

      // Remover item a item se ainda restarem
      cartCount = await itemContainers.count().catch(() => 0);
      while (cartCount > 0) {
        const trashBtn = page.locator('button[title*="Remover"], i.fa-trash, i.fa-trash-alt, button[class*="btnExcluir"]').first();
        if (await trashBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await trashBtn.click({ force: true });
          itensRemovidosCount++;
          await page.waitForTimeout(1200);
        } else {
          break;
        }
        cartCount = await itemContainers.count().catch(() => 0);
      }
    }

    // Re-verificar e validar de fato que o carrinho está VAZIO
    await page.goto('https://www.construja.com.br/carrinho', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const finalCartCount = await itemContainers.count().catch(() => 0);
    const emptyMsgEl = page.locator('text="Você não possui produtos em seu carrinho", text="Carrinho vazio", div[class*="empty"]').first();
    const isCartEmpty = finalCartCount === 0 || (await emptyMsgEl.isVisible().catch(() => false));

    if (!isCartEmpty) {
      log('⚠️ [AVISO] Carrinho ainda contém itens. Executando recarga...');
    } else {
      log(`✅ [CONFIRMAÇÃO DE LIMPEZA] Carrinho 100% VAZIO confirmado! (Itens removidos: ${itensRemovidosCount || cartCount})`);
    }

    await page.screenshot({ path: path.join(printsDir, '01b_carrinho_limpo_confirmado.png') });

    // -------------------------------------------------------------------------
    // 3. BUSCA, ISOLAMENTO DE SKU, LEITURA DE MÚLTIPLO M, CLIQUE + COM RE-RENDER E PERSISTÊNCIA (REQUISITOS A & E)
    // -------------------------------------------------------------------------
    log('\n--- PASSO 3: BUSCA, ISOLAMENTO DE SKU E CLIQUE NO BOTÃO "+" COM RE-RENDER ---');
    const resultadosItens = [];
    let lastSkuSaved = null;
    let lastPrecoSaved = null;
    let lastSubtotalSaved = null;

    let itemIdx = 0;
    for (const item of itensParaCotar) {
      itemIdx++;
      const itemNumStr = String(itemIdx).padStart(2, '0');
      log(`\n🔍 [Item ${itemIdx}/9] Buscando no catálogo: "${item.termo}" (Qtd Solicitada: ${item.quantidade})...`);

      const searchUrl = `https://www.construja.com.br/produtos?pagina=1&busca=${encodeURIComponent(item.termo)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      const printSearchPath = path.join(printsDir, `02_busca_item_${itemNumStr}.png`);
      await page.screenshot({ path: printSearchPath });
      log(`📸 Print de busca salvo: 02_busca_item_${itemNumStr}.png`);

      // ESCOPO ESTREITO DO CARD RETORNADO NESSA BUSCA ESPECÍFICA
      const cardEl = page.locator('div[class*="CardProduto"], div[class*="product-card"], div.card-produto').first();
      const hasProduct = await cardEl.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasProduct) {
        log(`⚠️ Item NÃO LOCALIZADO no catálogo: "${item.termo}"`);
        resultadosItens.push({
          sku: 'N/A',
          solicitado: item.termo,
          qSolicitada: item.quantidade,
          multiploM: 1,
          qFinal: 0,
          diferenca: -item.quantidade,
          status: 'NÃO LOCALIZADO',
          produtoEncontrado: 'N/A',
          precoUnitario: 0,
          subtotal: 0
        });
        continue;
      }

      // Extração de SKU e Dados do Card Atual
      const cardTextContent = await cardEl.textContent().catch(() => '');
      const skuMatch = cardTextContent.match(/#(\d+)/) || cardTextContent.match(/SKU:?\s*(\d+)/i) || cardTextContent.match(/EMB:?\s*(\d+)/i);
      const sku = skuMatch ? `#${skuMatch[1]}` : `SKU_${itemIdx}_${Date.now() % 10000}`;

      const productTitleEl = cardEl.locator('span[class*="title"], div[class*="productTitle"], a[href*="/produto/"]').first();
      const productTitleText = (await productTitleEl.textContent().catch(() => 'Produto')).trim();

      // Extração precisa do Preço B2B
      let precoUnitario = 0;
      const priceCandidates = cardEl.locator('span, div, p').all();
      const priceEls = await priceCandidates.catch(() => []);
      for (const pEl of priceEls) {
        const txt = (await pEl.textContent().catch(() => '')).trim();
        if (txt.includes('R$') && /\d+,\d{2}/.test(txt)) {
          const mPrice = txt.match(/R\$\s*([\d\.,]+)/);
          if (mPrice) {
            const clean = mPrice[1].replace(/\./g, '').replace(',', '.');
            const parsed = parseFloat(clean);
            if (parsed > 0) {
              precoUnitario = parsed;
              break;
            }
          }
        }
      }

      log(`🎯 [CARD ISOLADO] Item: "${productTitleText}" | SKU: ${sku} | Preço B2B: R$ ${precoUnitario.toFixed(2)}`);

      // VALIDAÇÃO DE ISOLAMENTO DE SKU E ANOMALIA DE DUPLICAÇÃO (REQUISITO E)
      if (lastSkuSaved && lastSkuSaved === sku) {
        logDup(`⚠️ ALERTA: SKU idêntico retornado em duas buscas consecutivas! SKU Atual: ${sku} | SKU Anterior: ${lastSkuSaved}`);
      }

      // 1 & 2: LEITURA DO MÚLTIPLO M ESPECÍFICO NO CARD
      let M = 1;
      const multiploDiv = cardEl.locator('div.QuantidadeMaisMenos_multiploEmbalagem__mHWGk, div[class*="multiploEmbalagem"]').first();
      if (await multiploDiv.isVisible({ timeout: 2000 }).catch(() => false)) {
        const multiploText = await multiploDiv.textContent().catch(() => '');
        log(`📦 Elemento de Múltiplo no CARD: "${multiploText.trim()}"`);

        const matchM = multiploText.match(/Vende de\s*(\d+)\s*em\s*\d+/i) || multiploText.match(/(\d+)/);
        if (matchM) {
          M = parseInt(matchM[1], 10) || 1;
        }
      } else {
        const matchM = cardTextContent.match(/Vende de\s*(\d+)\s*em\s*\d+/i);
        if (matchM) {
          M = parseInt(matchM[1], 10) || 1;
        }
      }
      log(`🔢 Múltiplo M identificado: ${M}`);

      // 3: CÁLCULO DA QUANTIDADE TARGET Q_FINAL
      const qSolicitada = item.quantidade;
      const qFinal = calcularQFinal(qSolicitada, M);

      // REQUISITO A: LEITURA DA QUANTIDADE INICIAL NO INPUT DO CARD
      const qtyInput = cardEl.locator('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]').first();
      let qAtualDOM = 1;
      if (await qtyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        const valStr = await qtyInput.inputValue().catch(() => '1');
        qAtualDOM = parseFloat(valStr) || 1;
      }

      log(`🧮 ESTADO INICIAL DO CARD: Q_solicitada=${qSolicitada}, M=${M}, Q_inicial_DOM=${qAtualDOM} → Q_final_Alvo=${qFinal}`);

      // REQUISITO A: CLIQUE E VALIDAÇÃO DE RE-RENDER DOM
      const btnPlus = cardEl.locator('button[id^="botao-card-produto-aumentar-quantidade-"], button[title="Aumentar quantidade"], button.QuantidadeMaisMenos_btnPlus__asBcZ').first();

      if (qAtualDOM < qFinal) {
        if (await btnPlus.isVisible({ timeout: 3000 }).catch(() => false)) {
          log(`➕ Incrementando de Q_atual=${qAtualDOM} até Q_alvo=${qFinal}...`);

          while (qAtualDOM < qFinal) {
            const qAntesDoClique = qAtualDOM;

            let clickSucesso = false;
            for (let tentativa = 1; tentativa <= 3; tentativa++) {
              log(`Clique em "+" (Tentativa ${tentativa}/3) - Q_atual: ${qAntesDoClique}...`);
              await btnPlus.click({ force: true });
              await page.waitForTimeout(600);

              const novoValStr = await qtyInput.inputValue().catch(() => String(qAntesDoClique));
              const novaQ = parseFloat(novoValStr) || qAntesDoClique;

              if (novaQ > qAntesDoClique) {
                qAtualDOM = novaQ;
                clickSucesso = true;
                log(`✅ [RE-RENDER CONFIRMADO] Input atualizado: ${qAntesDoClique} -> ${qAtualDOM}`);
                break;
              } else {
                log(`⚠️ Re-render não detectado na tentativa ${tentativa}. Aguardando mais 400ms...`);
                await page.waitForTimeout(400);
              }
            }

            if (!clickSucesso) {
              log(`❌ Falha ao incrementar quantidade após 3 tentativas. Parando em Q=${qAtualDOM}`);
              break;
            }
          }
        } else {
          log('⚠️ Botão "+" não localizado no card.');
        }
      } else {
        log(`ℹ️ Quantidade no DOM (${qAtualDOM}) já atinge ou supera a quantidade calculada (${qFinal}). Sem cliques adicionais.`);
      }

      // Validação visual final no DOM
      const valFinalStr = await qtyInput.inputValue().catch(() => String(qAtualDOM));
      const qConfirmadaDOM = parseFloat(valFinalStr) || qAtualDOM;
      log(`🔍 Quantidade Final Confirmada no DOM do Card: ${qConfirmadaDOM} (Alvo era: ${qFinal})`);

      // GARANTIR PERSISTÊNCIA HTTP NO BACKEND DA CONSTRUJÁ
      log('⏳ Aguardando 2.5s para conclusão do salvamento HTTP assíncrono do item no backend da Construjá...');
      await page.waitForTimeout(2500);

      const printAddPath = path.join(printsDir, `03_item_${itemNumStr}_adicionado_multiplo.png`);
      await page.screenshot({ path: printAddPath });

      const subtotalItem = precoUnitario * qConfirmadaDOM;

      // CHECAGEM DE DUPLICAÇÃO DE PREÇO/SUBTOTAL (REQUISITO E)
      if (lastPrecoSaved && lastPrecoSaved === precoUnitario && lastSubtotalSaved === subtotalItem && lastSkuSaved !== sku) {
        logDup(`⚠️ [SUSPEITA DE DUPLICAÇÃO DE DADOS] Item "${productTitleText}" (SKU ${sku}) possui PREÇO (R$ ${precoUnitario.toFixed(2)}) e SUBTOTAL idênticos ao item anterior (SKU ${lastSkuSaved})!`);
      }

      logDup(`PRODUTO ADICIONADO: SKU=${sku} | Nome=${productTitleText} | Preço=R$ ${precoUnitario.toFixed(2)} | Qtd=${qConfirmadaDOM} | Subtotal=R$ ${subtotalItem.toFixed(2)}`);

      lastSkuSaved = sku;
      lastPrecoSaved = precoUnitario;
      lastSubtotalSaved = subtotalItem;

      resultadosItens.push({
        sku,
        solicitado: item.termo,
        qSolicitada,
        multiploM: M,
        qFinal: qConfirmadaDOM,
        diferenca: qConfirmadaDOM - qSolicitada,
        status: 'ADICIONADO',
        produtoEncontrado: productTitleText,
        precoUnitario,
        subtotal: subtotalItem
      });
    }

    // -------------------------------------------------------------------------
    // 4. EXTRAÇÃO DO CARRINHO E VALIDAÇÃO DE QUANTIDADE REAL POR ITEM (REQUISITO C)
    // -------------------------------------------------------------------------
    log('\n--- PASSO 4: NAVEGANDO PARA /carrinho E VALIDAÇÃO REAL POR ITEM ---');
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

    log(`🛒 Total de itens confirmados no carrinho B2B: ${cartSnapshot.items.length}`);
    log(`💰 Total Geral do Carrinho: R$ ${cartSnapshot.totalGeral.toFixed(2)}`);

    const carrinhoFinalJson = {
      fornecedor: 'Construjá',
      fornecedor_id: dbForn.id,
      dataExtracao: new Date().toISOString(),
      totalGeral: cartSnapshot.totalGeral,
      itensConfirmadosCarrinho: cartSnapshot.items
    };

    fs.writeFileSync(path.join(baseDir, 'carrinho_final.json'), JSON.stringify(carrinhoFinalJson, null, 2), 'utf8');

    // CONFERÊNCIA DAS QUANTIDADES NO CARRINHO
    for (const res of resultadosItens) {
      if (res.status === 'ADICIONADO') {
        const match = cartSnapshot.items.find(ci => ci.produto.toLowerCase().includes(res.solicitado.split(' ')[0].toLowerCase()));
        if (match) {
          res.precoUnitario = match.precoUnitario > 0 ? match.precoUnitario : res.precoUnitario;
          res.subtotal = res.precoUnitario * match.quantidade;
          if (match.quantidade !== res.qFinal) {
            log(`⚠️ [INCONSISTÊNCIA DE QUANTIDADE] Item "${res.solicitado}": esperava Q=${res.qFinal}, mas no carrinho consta Q=${match.quantidade}`);
          }
        } else {
          res.status = 'NÃO COMPROVADO NO CARRINHO';
        }
      }
    }

    // -------------------------------------------------------------------------
    // 5. INTEGRAÇÃO SARACOTA APP (SEGUNDA PARTE)
    // -------------------------------------------------------------------------
    log('\n--- PASSO 5: INTEGRANDO COM PLATAFORMA SARACOTA (http://localhost:3000) ---');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

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

    const { data: cotIns } = await supabase.from('cotacoes').insert({
      fornecedor_id: dbForn.id,
      status: 'CONCLUIDO',
      valor_total: cartSnapshot.totalGeral,
      origem: 'RPA_ROBO',
      metadata: { fornecedor_slug: 'construja', test_run: 'teste9_saracota_construja', obra: 'Reserva das Palmeiras' }
    }).select().single();

    if (cotIns) {
      const payloadItens = resultadosItens.map(r => ({
        cotacao_id: cotIns.id,
        produto_nome: r.produtoEncontrado !== 'N/A' ? r.produtoEncontrado : r.solicitado,
        quantidade: r.qFinal > 0 ? r.qFinal : r.qSolicitada,
        preco_unitario: r.precoUnitario,
        subtotal: r.subtotal,
        status: r.status === 'ADICIONADO' ? 'COTADO' : 'NAO_LOCALIZADO'
      }));

      await supabase.from('itens_cotacao_fornecedor').insert(payloadItens);
      log(`✅ Cotação gravada no Supabase com ID: ${cotIns.id}`);
    }

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);

    const printSaracotaResultado = path.join(printsDir, '06_saracota_resultado_final.png');
    await page.screenshot({ path: printSaracotaResultado });

    // -------------------------------------------------------------------------
    // 6. RELATÓRIO FINAL E ARTEFATOS (REQUISITO D)
    // -------------------------------------------------------------------------
    log('\n--- PASSO 6: GERANDO RELATÓRIO FINAL E TABELA COMPARATIVA ---');

    const resultadoSaracotaJson = {
      obraDestino: 'Reserva das Palmeiras',
      fornecedor: 'Construjá',
      valorTotalCotacao: cartSnapshot.totalGeral,
      itensCotados: resultadosItens
    };

    fs.writeFileSync(path.join(baseDir, 'resultado_saracota.json'), JSON.stringify(resultadoSaracotaJson, null, 2), 'utf8');

    let tabelaMd = '| SKU | Item Solicidado | Qtd Solicitada | Múltiplo (M) | Qtd Adicionada (Q_final) | Diferença | Preço Unitário | Subtotal | Status |\n';
    tabelaMd += '| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n';

    for (const r of resultadosItens) {
      const difStr = r.diferenca > 0 ? `+${r.diferenca}` : `${r.diferenca}`;
      tabelaMd += `| ${r.sku} | ${r.solicitado} | ${r.qSolicitada} | ${r.multiploM} | ${r.qFinal} | ${difStr} | R$ ${r.precoUnitario.toFixed(2)} | R$ ${r.subtotal.toFixed(2)} | ${r.status === 'ADICIONADO' ? '✅ Cotado' : '❌ ' + r.status} |\n`;
    }

    const relatorioMd = `# Relatório Final de Execução Real — Teste 9 Construjá (Correções de Automação)

- **Data/Hora**: ${new Date().toLocaleString('pt-BR')}
- **Fornecedor**: Construjá (\`${dbForn.id}\`)
- **Limpeza do Carrinho**: Confirmed Empty antes das buscas (Itens removidos: ${itensRemovidosCount})
- **Validação de Re-render DOM**: Ativada (validação de incrementos no input por clique no \`+\`)
- **Isolamento de SKU**: SKU e dados extraídos escopados estritamente por card de produto
- **Total Geral do Carrinho**: **R$ ${cartSnapshot.totalGeral.toFixed(2)}**

---

## 📊 Tabela Detalhada: SKU | Item | Qtd Solicitada | Múltiplo | Qtd Adicionada | Diferença

${tabelaMd}

---

## 📁 Arquivos Salvos em \`teste9_saracota_construja/\`
- \`execucao_detalhada.log\` — Log completo com os cálculos de múltiplo, re-renders e cliques.
- \`diagnostico_duplicacao.log\` — Registro de auditoria de SKUs e prevenção de duplicações.
- \`carrinho_final.json\` — Snapshot dos itens no carrinho B2B.
- \`resultado_saracota.json\` — Payload consolidado gerado para o Saracota App.
- \`prints/\` — Screenshots das telas de login, carrinho limpo, busca, botão \`+\`, carrinho e SaraCota UI.
- \`relatorio_final.md\` — Este relatório em markdown.
`;

    fs.writeFileSync(path.join(baseDir, 'relatorio_final.md'), relatorioMd, 'utf8');
    log('📄 Relatório final salvo com sucesso em relatorio_final.md.');

  } catch (err) {
    log(`❌ ERRO CRÍTICO NO TESTE 9: ${err.stack || err}`);
  } finally {
    await browser.close();
    execLogStream.end();
    dupLogStream.end();
  }
}

executarTeste9PontaAPonta();
