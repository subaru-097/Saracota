const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

// Pasta de saída para o Teste 2 (Corrigido)
const historyDir = path.join(__dirname, '..', 'historicos', '2026-09-17', 'teste2_cofema_corrigido');
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

// Algoritmo de Similaridade Semântica (Dice / Token Overlap)
function calcularSimilaridade(termoBuscado, tituloProduto) {
  const normalizar = (txt) => txt.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9\s]/g, " ").trim();
  const tokensBusca = normalizar(termoBuscado).split(/\s+/).filter(t => t.length > 1);
  const tokensTitulo = normalizar(tituloProduto).split(/\s+/).filter(t => t.length > 1);

  if (tokensBusca.length === 0 || tokensTitulo.length === 0) return 0;

  let matches = 0;
  for (const tb of tokensBusca) {
    if (tokensTitulo.some(tt => tt.includes(tb) || tb.includes(tt))) {
      matches++;
    }
  }

  return (2.0 * matches) / (tokensBusca.length + tokensTitulo.length);
}

// Validação de Marca Específica
function validarMarca(marcaEsperada, tituloProduto) {
  if (!marcaEsperada) return true;
  const normMarca = marcaEsperada.toUpperCase().trim();
  const normTitulo = tituloProduto.toUpperCase().trim();
  return normTitulo.includes(normMarca);
}

const userCnpj = '43.313.798/0001-34';
const passWord = decryptPass();

const itensParaCotar = [
  { id: 1, termoOriginal: '6x DUCHA LORENZETTI BELLA DUCHA 127V', query: 'BELLA DUCHA 127V', marcaEsperada: 'LORENZETTI', quantidade: 6 },
  { id: 2, termoOriginal: '4x BIANCO 900G', query: 'BIANCO 900G', marcaEsperada: 'OTTO', quantidade: 4 },
  { id: 3, termoOriginal: '7x DUCHA LORENZETTI MAXI DUCHA 127V', query: 'MAXI DUCHA 127V', marcaEsperada: 'LORENZETTI', quantidade: 7 },
  { id: 4, termoOriginal: '12x ALICATE BOMBA D AGUA MTX 10', query: 'ALICATE BOMBA', marcaEsperada: 'MTX', quantidade: 12 },
  { id: 5, termoOriginal: '5x CONDUITE CORR AM FORTLEV 25MM 50M', query: 'CONDUITE 25MM', marcaEsperada: 'FORTLEV', quantidade: 5 }
];

// 1. Helper para garantir que a gaveta do carrinho lateral esteja fechada
async function garantirCarrinhoFechado(page) {
  try {
    const drawerCloseBtn = page.locator('div.fixed.top-0.right-0 button:has-text("Close"), div.fixed.top-0.right-0 button:has-text("X"), button[aria-label="Close"]').first();
    if (await drawerCloseBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await drawerCloseBtn.click({ force: true }).catch(() => {});
      log('🔒 Painel lateral do carrinho detectado e FECHADO para evitar contaminação do DOM.');
      await page.waitForTimeout(1000);
    } else {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    }
  } catch (err) {
    // Ignorar se não estiver aberto
  }
}

// 2. Helper de Limpeza Segura de Inputs React com Validação e Retry
async function preencherQuantidadeSegura(page, locatorInput, quantidadeDesejada) {
  const targetStr = String(quantidadeDesejada);
  
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      await locatorInput.click({ force: true });
      await page.waitForTimeout(150);

      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';
      await page.keyboard.press(`${modifier}+a`);
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(150);

      await locatorInput.type(targetStr, { delay: 50 });
      await page.waitForTimeout(300);

      const valAtual = await locatorInput.inputValue().catch(() => null);

      if (valAtual === targetStr) {
        log(`  [INPUT OK] Tentativa ${tentativa}: Quantidade ${targetStr} validada com sucesso no campo.`);
        return { sucesso: true, valAtual };
      } else {
        log(`  [INPUT WARNING] Tentativa ${tentativa}: Valor lido (${valAtual}) diferente do pretendido (${targetStr}). Retentando...`);
      }
    } catch (errInput) {
      log(`  [INPUT ERROR] Tentativa ${tentativa}: ${errInput.message}`);
    }
  }

  return { sucesso: false, valAtual: null };
}

async function executarCotacaoRealCofema() {
  log('================================================================');
  log('🚀 INICIANDO TESTE 2 (CORRIGIDO) DE COTAÇÃO NO FORNECEDOR COFEMA');
  log(`📂 Diretório de Evidências: ${historyDir}`);
  log(`👤 Credencial CNPJ: ${userCnpj}`);
  log('================================================================');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('500') && !msg.text().includes('404')) {
      log(`[BROWSER CONSOLE ERROR] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    log(`[BROWSER UNCAUGHT ERROR] ${err.message}`);
  });

  const resultadosItens = [];
  let resumoPedido = { totalItens: 0, totalPedido: 0, cartUrl: '', totalCalculado: 0, requerRevisaoManual: false };

  try {
    // PASSO 1: Acesso Inicial ao Site
    log('\n--- PASSO 1: Navegando para https://www.cofema.com.br/ ---');
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(historyDir, '01_pagina_inicial_cofema.png'), fullPage: false });
    log('📸 Screenshot salvo: 01_pagina_inicial_cofema.png');

    const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar, .lgpd-accept').first();
    if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cookieBtn.click().catch(() => {});
      log('✅ Banner LGPD aceito.');
      await page.waitForTimeout(1000);
    }

    // PASSO 2: Autenticação
    log('\n--- PASSO 2: Realizando Login no Portal B2B ---');
    const entreBtn = page.locator('button:has-text("Entre ou Cadastre-se")').first();
    await entreBtn.waitFor({ state: 'visible', timeout: 10000 });
    await entreBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const areaClienteLoc = page.getByText('Área do Cliente', { exact: true }).first();
    await areaClienteLoc.waitFor({ state: 'visible', timeout: 5000 });
    await areaClienteLoc.click({ force: true });
    await page.waitForTimeout(2000);

    log(`⌨️ Preenchendo CNPJ (${userCnpj}) no modal de login...`);
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

    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(historyDir, '04_login_confirmado.png'), fullPage: false });
    log('📸 Screenshot salvo: 04_login_confirmado.png');

    // PASSO 3: Cotação dos 5 Itens
    log('\n--- PASSO 3: Cotando e Processando os 5 Itens ---');

    for (const item of itensParaCotar) {
      log(`\n================================================================`);
      log(`🔎 [ITEM ${item.id}/5] Solicitado: "${item.termoOriginal}"`);
      log(`   Busca: "${item.query}" | Marca Esperada: "${item.marcaEsperada || 'N/A'}" | Qtd Solicitada: ${item.quantidade}`);
      log(`================================================================`);

      await garantirCarrinhoFechado(page);

      try {
        const searchInput = page.locator('#input-busca-home, input[type="search"], input[placeholder*="Buscar"]').first();
        await searchInput.waitFor({ state: 'visible', timeout: 10000 });
        await searchInput.fill('');
        await searchInput.type(item.query, { delay: 30 });
        await page.waitForTimeout(500);

        await page.keyboard.press('Enter');
        await page.waitForTimeout(4000);

        await page.evaluate(() => window.scrollBy(0, 250));
        await page.waitForTimeout(1000);

        const screenshotBusca = `05_item_${item.id}_busca.png`;
        await page.screenshot({ path: path.join(historyDir, screenshotBusca), fullPage: false });
        log(`📸 Screenshot salvo: ${screenshotBusca}`);

        // 1. ESCOPAMENTO ESTRITO: Pegar apenas os filhos diretos da grade principal de resultados
        const candidatosEncontrados = await page.evaluate(() => {
          const mainGrid = document.querySelector('main div.grid, div.grid:not(.fixed)');
          if (!mainGrid) return [];

          const cards = Array.from(mainGrid.children);
          
          return cards.map((c, index) => {
            const txt = c.innerText ? c.innerText.trim() : '';
            const lines = txt.split('\n').map(l => l.trim()).filter(Boolean);
            
            // Extrair SKU
            const skuLine = lines.find(l => l.includes('SKU:')) || '';
            const skuMatch = skuLine.match(/SKU:\s*(\d+)/i) || lines.join(' ').match(/(\d{4,8})\s*•/);
            const skuNum = skuMatch ? skuMatch[1] : '';

            // Extrair Nome (linha de título descritiva excluindo badges de carrinho/campanha)
            const titleLine = lines.find(l => 
              !l.startsWith('#') && 
              !l.includes('SKU:') && 
              !l.includes('R$') && 
              !l.includes('%') && 
              !l.includes('un.') && 
              !l.includes('Expira') && 
              !l.includes('Desconto') &&
              !l.includes('carrinho') &&
              !l.includes('Abre') &&
              !l.includes('Campanha') &&
              l.length > 5
            ) || lines[0] || '';

            // Extrair Múltiplo de Venda
            let multiploVenda = 1;
            const multLine = lines.find(l => l.includes('un.') || l.includes('Abre'));
            if (multLine) {
              const mMatch = multLine.match(/(\d+)\s*un/i);
              if (mMatch) multiploVenda = parseInt(mMatch[1], 10);
            }

            // Extrair Preço Unitário Líquido (do botão ou texto do cartão)
            let precoUnitario = 0;
            const btn = c.querySelector('button');
            const btnTxt = btn ? btn.innerText : '';
            const btnMatch = btnTxt.match(/R\$\s*([\d\.\,]+)/i);
            
            if (btnMatch) {
              precoUnitario = parseFloat(btnMatch[1].replace(/\./g, '').replace(',', '.'));
            } else {
              const rMatches = txt.match(/R\$\s*([\d\.\,]+)/gi);
              if (rMatches && rMatches.length > 0) {
                const valStr = rMatches[0].replace(/R\$\s*/i, '').replace(/\./g, '').replace(',', '.');
                const p = parseFloat(valStr);
                if (!isNaN(p)) precoUnitario = p;
              }
            }

            return {
              index,
              title: titleLine,
              sku: skuNum,
              multiploVenda,
              precoUnitario,
              fullTextSnippet: lines.slice(0, 5).join(' | ')
            };
          }).filter(x => x.title && x.sku);
        });

        log(`🔍 Total de cartões válidos na grade principal: ${candidatosEncontrados.length}`);

        if (candidatosEncontrados.length === 0) {
          log(`⚠️ Nenhum produto válido localizado na grade principal para "${item.query}".`);
          resultadosItens.push({
            id: item.id,
            termoOriginal: item.termoOriginal,
            queryBusca: item.query,
            quantidadePedida: item.quantidade,
            quantidadeRealComprada: 0,
            produtoEncontrado: null,
            status: 'NAO_ENCONTRADO',
            motivo: 'Busca não retornou produtos na grade principal do catálogo.'
          });
          continue;
        }

        // 3. VALIDAÇÃO SEMÂNTICA & MARCA
        let melhorCandidato = null;
        let melhorScore = -1;
        let divergenciaMarca = false;

        for (const cand of candidatosEncontrados) {
          const score = calcularSimilaridade(item.query, cand.title);
          const possuiMarca = validarMarca(item.marcaEsperada, cand.title);

          log(`   Candidato #${cand.index + 1}: SKU ${cand.sku} | "${cand.title}" | Score: ${score.toFixed(2)} | Marca "${item.marcaEsperada}": ${possuiMarca ? 'SIM' : 'NÃO'}`);

          if (possuiMarca && score > melhorScore) {
            melhorScore = score;
            melhorCandidato = cand;
          }
        }

        // Se a marca esperada não foi encontrada nos candidatos retornado
        if (!melhorCandidato) {
          melhorCandidato = candidatosEncontrados[0];
          divergenciaMarca = true;
          log(`  ⚠️ DIVERGÊNCIA DE MARCA DETECTADA! A marca esperada "${item.marcaEsperada}" não foi encontrada nos produtos retornados ("${melhorCandidato.title}").`);
        }

        const produtoEscolhido = melhorCandidato;
        log(`🎯 Produto Escolhido: SKU ${produtoEscolhido.sku} — "${produtoEscolhido.title}" | Preço Unit.: R$ ${produtoEscolhido.precoUnitario.toFixed(2)} | Múltiplo: ${produtoEscolhido.multiploVenda} un.`);

        // Se houver divergência de marca, NÃO adicionar ao carrinho e sinalizar claramente
        if (divergenciaMarca) {
          log(`⛔ ITEM NÃO ADICIONADO AO CARRINHO devido à trava de DIVERGÊNCIA DE MARCA.`);
          resultadosItens.push({
            id: item.id,
            termoOriginal: item.termoOriginal,
            queryBusca: item.query,
            quantidadePedida: item.quantidade,
            quantidadeRealComprada: 0,
            produtoEncontrado: produtoEscolhido.title,
            sku: produtoEscolhido.sku,
            multiploAplicado: produtoEscolhido.multiploVenda,
            precoUnitario: produtoEscolhido.precoUnitario,
            totalItem: 0,
            status: 'DIVERGENCIA_DE_MARCA',
            motivo: `Marca solicitada "${item.marcaEsperada}" não coincide com os produtos disponíveis ("${produtoEscolhido.title}").`
          });
          continue;
        }

        // 4. TRATAMENTO DE MÚLTIPLOS MÍNIMOS DE VENDA
        const mult = produtoEscolhido.multiploVenda || 1;
        const qtdPedida = item.quantidade;
        let qtdRealComprada = qtdPedida;

        if (qtdPedida % mult !== 0) {
          const pacotesNecessarios = Math.ceil(qtdPedida / mult);
          qtdRealComprada = pacotesNecessarios * mult;
          log(`📦 Múltiplo de Venda Aplicado: Pedido de ${qtdPedida} un. ajustado para ${qtdRealComprada} un. (${pacotesNecessarios}x embalagem de ${mult} un.)`);
        } else {
          log(`📦 Quantidade Solicitada (${qtdPedida} un.) é múltiplo exato da embalagem (${mult} un.).`);
        }

        const totalItemCalculado = produtoEscolhido.precoUnitario * qtdRealComprada;

        // 2. LIMPEZA SEGURA DE INPUTS DE QUANTIDADE NO REACT
        const cardLocator = page.locator('main div.grid > div, main section div.grid > div').nth(produtoEscolhido.index);
        const qtyInput = cardLocator.locator('input[type="number"]').first();

        if (await qtyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          const resInput = await preencherQuantidadeSegura(page, qtyInput, qtdRealComprada);
          if (!resInput.sucesso) {
            log(`❌ FALHA DE QUANTIDADE: Não foi possível validar o input de quantidade para ${qtdRealComprada} un.`);
            resultadosItens.push({
              id: item.id,
              termoOriginal: item.termoOriginal,
              queryBusca: item.query,
              quantidadePedida: qtdPedida,
              quantidadeRealComprada: 0,
              produtoEncontrado: produtoEscolhido.title,
              sku: produtoEscolhido.sku,
              status: 'FALHA_DE_QUANTIDADE',
              motivo: 'O campo de quantidade no portal não aceitou o valor exato digitado.'
            });
            continue;
          }
        }

        // Clicar em Adicionar no cartão específico
        const addBtn = cardLocator.locator('button:has-text("Adicionar")').first();
        if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await addBtn.click({ force: true });
          await page.waitForTimeout(2500);
          log(`🛒 Item adicionado ao carrinho com ${qtdRealComprada} un.`);
        } else {
          await page.keyboard.press('Enter');
          await page.waitForTimeout(2000);
        }

        await garantirCarrinhoFechado(page);

        const screenshotAdd = `06_item_${item.id}_adicionado.png`;
        await page.screenshot({ path: path.join(historyDir, screenshotAdd), fullPage: false });
        log(`📸 Screenshot salvo: ${screenshotAdd}`);

        resultadosItens.push({
          id: item.id,
          termoOriginal: item.termoOriginal,
          queryBusca: item.query,
          quantidadePedida: qtdPedida,
          quantidadeRealComprada: qtdRealComprada,
          produtoEncontrado: produtoEscolhido.title,
          sku: produtoEscolhido.sku,
          multiploAplicado: mult,
          precoUnitario: produtoEscolhido.precoUnitario,
          totalItem: totalItemCalculado,
          status: 'OK'
        });

      } catch (errItem) {
        log(`❌ Erro técnico no processamento do item ${item.id}: ${errItem.message}`);
        resultadosItens.push({
          id: item.id,
          termoOriginal: item.termoOriginal,
          queryBusca: item.query,
          quantidadePedida: item.quantidade,
          quantidadeRealComprada: 0,
          status: 'ERRO_TECNICO',
          motivo: errItem.message
        });
      }
    }

    // PASSO 4: Leitura e Validação do Resumo do Pedido no Carrinho (/page/pedidos)
    log('\n--- PASSO 4: Navegando para o Carrinho Real (/page/pedidos) e Executando Trava de Segurança ---');
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(4000);

    await page.screenshot({ path: path.join(historyDir, '07_carrinho_resumo_pedido.png'), fullPage: false });
    log('📸 Screenshot salvo: 07_carrinho_resumo_pedido.png');

    // 5. TRAVA DE SEGURANÇA: Leitura fresca do carrinho real no DOM e comparação com o Payload
    const itensCarrinhoReal = await page.evaluate(() => {
      const items = [];
      const rows = Array.from(document.querySelectorAll('div[class*="itemContainer"], tr, div.border'));
      
      rows.forEach(r => {
        const txt = r.innerText ? r.innerText.trim() : '';
        if (txt.includes('SKU:') && txt.includes('R$')) {
          const skuMatch = txt.match(/SKU:\s*(\d+)/i);
          const priceMatch = txt.replace(/\./g, '').replace(',', '.').match(/R\$\s*([\d\.]+)/i);
          const qtyMatch = txt.match(/(\d+)\s*un/i);
          
          if (skuMatch) {
            items.push({
              sku: skuMatch[1],
              preco: priceMatch ? parseFloat(priceMatch[1]) : 0,
              qtd: qtyMatch ? parseInt(qtyMatch[1], 10) : 0,
              rawText: txt.split('\n').slice(0, 3).join(' ')
            });
          }
        }
      });
      return items;
    });

    log(`🛒 Itens confirmados no carrinho real do portal: ${itensCarrinhoReal.length}`);

    // Validar SKU a SKU do Payload x Carrinho Real
    let temDivergenciaTrava = false;
    for (const itemPayload of resultadosItens) {
      if (itemPayload.status === 'OK') {
        const encontradoNoCarrinho = itensCarrinhoReal.find(ic => ic.sku === itemPayload.sku);
        if (!encontradoNoCarrinho) {
          log(`⚠️ TRAVA DE SEGURANÇA: SKU ${itemPayload.sku} (${itemPayload.produtoEncontrado}) registrado no Payload NÃO foi localizado no carrinho real!`);
          temDivergenciaTrava = true;
        } else {
          log(`✅ TRAVA DE SEGURANÇA: SKU ${itemPayload.sku} verificado com sucesso no carrinho real (${encontradoNoCarrinho.qtd} un. a R$ ${encontradoNoCarrinho.preco.toFixed(2)}).`);
        }
      }
    }

    if (temDivergenciaTrava) {
      resumoPedido.requerRevisaoManual = true;
      log('🚨 STATUS FINAL DE EXECUÇÃO: REQUER REVISÃO MANUAL devido a divergências entre Payload e Carrinho Real.');
    } else {
      log('✅ STATUS FINAL DE EXECUÇÃO: COTAÇÃO CONCLUÍDA E VALIDADA COM SUCESSO.');
    }

    resumoPedido.totalItens = resultadosItens.filter(x => x.status === 'OK').length;
    resumoPedido.cartUrl = page.url();
    resumoPedido.totalCalculado = resultadosItens.reduce((acc, curr) => acc + (curr.totalItem || 0), 0);

    log(`📊 Total Geral Cotado dos Itens Válidos: R$ ${resumoPedido.totalCalculado.toFixed(2)}`);

  } catch (errFatal) {
    log(`💥 ERRO FATAL NA EXECUÇÃO DE COTAÇÃO: ${errFatal.stack || errFatal.message}`);
    await page.screenshot({ path: path.join(historyDir, 'ERRO_FATAL_EXECUCAO.png'), fullPage: true }).catch(() => {});
  } finally {
    const finalPayload = {
      fornecedor: 'Cofema Atacavista',
      timestamp: new Date().toISOString(),
      cnpjAcesso: userCnpj,
      statusExecucao: resumoPedido.requerRevisaoManual ? 'REQUER_REVISAO_MANUAL' : 'CONCLUIDO_COM_SUCESSO',
      itensCotados: resultadosItens,
      resumoExecucao: resumoPedido
    };

    fs.writeFileSync(path.join(historyDir, 'payload_final_cofema.json'), JSON.stringify(finalPayload, null, 2), 'utf8');
    log('✅ Payload final salvo em payload_final_cofema.json');

    // Gerar Relatório Markdown Completo
    let relatorioContent = `# Relatório de Cotação Real — Teste 2 (Corrigido) Cofema Atacavista\n\n`;
    relatorioContent += `- **Data/Hora**: ${new Date().toLocaleString('pt-BR')}\n`;
    relatorioContent += `- **Fornecedor**: Cofema Atacavista (CNPJ: \`${userCnpj}\`)\n`;
    relatorioContent += `- **Status da Execução**: **${finalPayload.statusExecucao}**\n`;
    relatorioContent += `- **Diretório de Evidências**: \`${historyDir}\`\n\n`;
    relatorioContent += `## 📋 Resumo dos Itens Cotados\n\n`;
    relatorioContent += `| # | Item Solicitado | Qtd Pedida | Qtd Real Comprada | SKU Escolhido | Preço Unit. | Total Item | Status |\n`;
    relatorioContent += `|---|---|---|---|---|---|---|---|\n`;

    resultadosItens.forEach((it, idx) => {
      const precoU = it.precoUnitario ? it.precoUnitario.toFixed(2) : '0.00';
      const totalI = it.totalItem ? it.totalItem.toFixed(2) : '0.00';
      const sku = it.sku || 'N/A';
      const qtdReal = it.quantidadeRealComprada || 0;
      relatorioContent += `| ${idx + 1} | ${it.termoOriginal} | ${it.quantidadePedida} un. | ${qtdReal} un. | \`${sku}\` | R$ ${precoU} | R$ ${totalI} | **${it.status}** |\n`;
    });

    relatorioContent += `\n### 📊 Valoração Total da Cotação Válida: **R$ ${(resumoPedido.totalCalculado || 0).toFixed(2)}**\n\n`;
    relatorioContent += `## 📸 Evidências Capturadas\n\n`;
    relatorioContent += `1. \`01_pagina_inicial_cofema.png\`\n`;
    relatorioContent += `2. \`03_login_preenchido.png\`\n`;
    relatorioContent += `3. \`04_login_confirmado.png\`\n`;
    relatorioContent += `4. \`05_item_1_busca.png\` a \`05_item_5_busca.png\`\n`;
    relatorioContent += `5. \`06_item_1_adicionado.png\` a \`06_item_5_adicionado.png\`\n`;
    relatorioContent += `6. \`07_carrinho_resumo_pedido.png\`\n\n`;
    relatorioContent += `## 📜 Log de Execução Detalhado\n\n`;
    relatorioContent += `- Log completo de terminal gravado em \`execucao_detalhada.log\`.\n`;

    fs.writeFileSync(path.join(historyDir, 'relatorio_final.md'), relatorioContent, 'utf8');
    log('✅ Relatório final do Teste 2 salvo em relatorio_final.md');

    await page.waitForTimeout(3000);
    await browser.close().catch(() => {});
    log('🏁 Execução do Teste 2 concluída com sucesso!');
  }
}

executarCotacaoRealCofema();
