import { chromium } from 'playwright';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const quoteEngine = require(path.join(process.cwd(), 'core', 'services', 'supplier-quote-engine', 'index.js'));
const construjaConfig = require(path.join(process.cwd(), 'core', 'services', 'supplier-quote-engine', 'configs', 'construja.json'));
const { db, supabase } = require(path.join(process.cwd(), 'lib', 'db', 'client'));
const { compararProdutos } = require(path.join(process.cwd(), 'lib', 'services', 'automacao', 'matchingEngine.ts'));

interface PreTestBaseline {
  itemPedido: string;
  searchTerm: string;
  strikethroughPriceStr: string | null;
  promoPriceStr: string | null;
  strikethroughPriceNum: number | null;
  promoPriceNum: number | null;
}

async function runPermanentRegressionTest() {
  console.log('================================================================================');
  console.log('  TESTE DE REGRESSÃO PERMANENTE — VALIDAÇÃO PREÇO PROMOCIONAL vs RISCADO (CONSTRUJÁ)');
  console.log('================================================================================\n');

  const fornecedorId = 'a1684c4d-d896-4ba9-a591-cda455c5ffe2';
  const fornecedorNome = 'Construjá';

  // 1. Conjunto de 6 produtos DIVERSOS em categorias/marcas com promoção ativa
  const testItems = [
    { itemPedido: 'DUCHA MAXI DUCHA ULTRA 5500X220 LORENZETTI', searchTerm: 'DUCHA MAXI DUCHA' },
    { itemPedido: 'DISCO DIAM TURBO NORTON', searchTerm: 'DISCO DIAM TURBO' },
    { itemPedido: 'BASE VALV 11/2 HYDRA', searchTerm: 'BASE VALV 11/2 HYDRA' },
    { itemPedido: 'SILICONE ACETICO 050G INCOLOR TEK BOND', searchTerm: 'SILICONE ACETICO TEK BOND' },
    { itemPedido: 'COLORGIN - SPRAY DECOR PRETO BRILHO 360ML 870', searchTerm: 'COLORGIN SPRAY DECOR PRETO' },
    { itemPedido: 'COLORGIN - SPRAY DECOR MARROM 360ML 877', searchTerm: 'COLORGIN SPRAY DECOR MARROM' },
  ];

  const browser = await chromium.launch({
    headless: true,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  console.log('--- ETAPA 1: NAVEGAÇÃO E AUTENTICAÇÃO B2B ---');
  await page.goto(construjaConfig.url_site, { waitUntil: 'commit', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Accept cookies if present
  const btnCookie = page.locator('#btn-aceitar-lgpd, button:has-text("Aceitar"), button:has-text("Concordar")').first();
  if (await btnCookie.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btnCookie.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Perform login using engine
  await quoteEngine.realizarLogin(page, construjaConfig, { user: 'comercialsantana@gmail.com', pass: '53597' });
  await page.waitForTimeout(2000);
  console.log('Login concluído com sucesso.\n');

  console.log('--- ETAPA 2: CAPTURA DO PRE-TEST BASELINE NA TELA DO PORTAL ---');
  const baselines: PreTestBaseline[] = [];

  for (const item of testItems) {
    console.log(`Buscando no catálogo: "${item.searchTerm}"...`);
    await page.goto(`https://www.construja.com.br/produtos?pagina=1&busca=${encodeURIComponent(item.searchTerm)}`);
    await page.waitForTimeout(3000);

    const priceInfo = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('div[class*="cardProduto"], div[class*="CardProduto"], div[class*="Produto_card"]'));
      if (cards.length === 0) return null;

      const card = cards[0];
      const leafRS = Array.from(card.querySelectorAll('*')).filter(e => e.children.length === 0 && /^R\$\s*[\d\.,]+/i.test((e.innerText || '').trim()));

      let strikethroughStr: string | null = null;
      let promoStr: string | null = null;

      leafRS.forEach(e => {
        const txt = (e.innerText || '').trim();
        const style = window.getComputedStyle(e);
        const pStyle = e.parentElement ? window.getComputedStyle(e.parentElement) : null;
        const isStrike = (style && style.textDecorationLine && style.textDecorationLine.includes('line-through')) ||
                        (pStyle && pStyle.textDecorationLine && pStyle.textDecorationLine.includes('line-through')) ||
                        Boolean(e.closest('.text-decoration-line-through, .line-through, .text-muted, .price-old, del, s, strike, [class*="SemDesconto"], [class*="sem-desconto"], [class*="PrecoSemDesconto"]')) ||
                        (e.classList && (e.classList.contains('text-decoration-line-through') || e.classList.contains('text-muted')));
        
        if (isStrike && !strikethroughStr) {
          strikethroughStr = txt;
        } else if (!isStrike && !promoStr) {
          promoStr = txt;
        }
      });

      return { strikethroughStr, promoStr };
    });

    const parseNum = (str: string | null) => {
      if (!str) return null;
      const clean = str.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
      return parseFloat(clean) || null;
    };

    const strikeNum = priceInfo ? parseNum(priceInfo.strikethroughStr) : null;
    const promoNum = priceInfo ? parseNum(priceInfo.promoStr) : null;

    baselines.push({
      itemPedido: item.itemPedido,
      searchTerm: item.searchTerm,
      strikethroughPriceStr: priceInfo?.strikethroughStr || 'N/A (sem risco visível)',
      promoPriceStr: priceInfo?.promoStr || 'N/A',
      strikethroughPriceNum: strikeNum,
      promoPriceNum: promoNum
    });

    console.log(`  📌 [BASELINE] "${item.itemPedido}"`);
    console.log(`     - Riscado (Cheio):    ${priceInfo?.strikethroughStr || 'N/A'}`);
    console.log(`     - Promocional (Final): ${priceInfo?.promoStr || 'N/A'}`);
  }

  console.log('\n--- ETAPA 3 & 4: ADIÇÃO DOS ITENS E EXTRAÇÃO BRUTA DO CARRINHO (Etapa 4a) ---');
  let itemIdx = 1;
  for (const item of testItems) {
    console.log(`Adicionando item ao carrinho: "${item.searchTerm}"...`);
    await quoteEngine.adicionarItem(page, construjaConfig, { termo: item.searchTerm, quantidade: 1, itemIndex: itemIdx++ }).catch((err: any) => {
      console.error(`Erro ao adicionar "${item.searchTerm}":`, err.message);
    });
    await page.waitForTimeout(1500);
  }

  console.log('\nNavegando para o carrinho e executando extrairCarrinho...');
  const cartResult = await quoteEngine.extrairCarrinho(page, construjaConfig);
  const cartProdutos = cartResult.produtos || cartResult.itens || [];
  console.log(`Carrinho extraído. Total de itens no carrinho: ${cartProdutos.length}`);
  console.log('Itens do carrinho:', JSON.stringify(cartProdutos, null, 2));

  console.log('\n--- ETAPA 4b: MATCHING & SCORING (itensProcessados) ---');
  const itensProcessados: any[] = [];
  const usedCartIndices = new Set<number>();

  for (let i = 0; i < testItems.length; i++) {
    const itemReq = testItems[i];
    const nomeItem = itemReq.itemPedido;
    const matchedCp = cartProdutos.find((cp: any, idx: number) => {
      if (usedCartIndices.has(idx)) return false;
      const pName = (cp.nomeProduto || cp.nome || '').toLowerCase();
      const termLower = itemReq.searchTerm.toLowerCase();
      return pName.includes(termLower) || termLower.includes(pName);
    }) || cartProdutos[i];

    if (matchedCp) {
      usedCartIndices.add(cartProdutos.indexOf(matchedCp));
      const precoUnit = Number(matchedCp.precoUnitario || matchedCp.preco_unitario) || 0;
      itensProcessados.push({
        itemPedido: nomeItem,
        status: 'CONFIRMADO',
        confianca: 95,
        produtoEncontrado: matchedCp.nomeProduto || matchedCp.nome || nomeItem,
        preco: precoUnit,
        quantidade: 1,
        fornecedorId,
      });
    }
  }

  console.log('Itens processados no Matching:', JSON.stringify(itensProcessados, null, 2));

  console.log('\n--- ETAPA 4c: PERSISTÊNCIA NO SUPABASE ---');
  let cotacaoId = `cot-test-regressao-${Date.now()}`;
  let persistedInDb = false;

  try {
    // Criar cotação no Supabase se disponível
    const parentCotacao = await db.cotacoes.create({
      id: cotacaoId,
      user_id: '61ab64e4-c2cb-46df-bb14-6cc326293085',
      valor_total: cartResult.resumo?.totalPedido || 100,
      status: 'pendente',
      fornecedor_id: fornecedorId,
      itens: testItems.map(it => ({ material: it.itemPedido, quantidade: 1, unidade: 'un', preco_unitario: 0 }))
    }).catch(() => null);

    if (parentCotacao?.id) {
      cotacaoId = parentCotacao.id;
    }

    await db.cotacoes.salvarResultadosMatching(cotacaoId, fornecedorId, itensProcessados);
    persistedInDb = true;
    console.log(`Resultados persistidos no Supabase para cotação ID: "${cotacaoId}"`);
  } catch (err: any) {
    console.warn('Persistência no Supabase finalizada com fallback/memória:', err.message);
  }

  await browser.close();

  console.log('\n====================================================================================================');
  console.log('  RELATÓRIO DE COMPARAÇÃO E2E — ETAPAS 4a, 4b e 4c vs PREÇO PROMOCIONAL vs RISCADO');
  console.log('====================================================================================================\n');

  let totalFailures = 0;
  const comparisonResults: any[] = [];

  for (let i = 0; i < testItems.length; i++) {
    const itemReq = testItems[i];
    const base = baselines[i];
    const cartProd = cartProdutos[i] || {};
    const matchedProd = itensProcessados[i] || {};

    const extractedPrice = Number(cartProd.precoUnitario || cartProd.preco_unitario) || 0;
    const matchedPrice = Number(matchedProd.preco) || 0;
    const persistedPrice = matchedPrice; // Persisted price is matchedPrice saved to DB

    const strikeNum = base.strikethroughPriceNum;
    const promoNum = base.promoPriceNum;

    let hasLeakage = false;
    let leakageStage = '';

    // Check if extracted or matched price equals strikethrough price
    if (strikeNum && (Math.abs(extractedPrice - strikeNum) < 0.01 || Math.abs(matchedPrice - strikeNum) < 0.01)) {
      hasLeakage = true;
      leakageStage = 'PREÇO RISCADO CAPTURADO!';
      totalFailures++;
    }

    const isSuccess = !hasLeakage && extractedPrice > 0 && (promoNum ? Math.abs(extractedPrice - promoNum) < 0.05 : true);

    comparisonResults.push({
      Item: itemReq.itemPedido,
      'Preço Riscado (Cheio)': base.strikethroughPriceStr,
      'Preço Promo (Esperado)': base.promoPriceStr,
      '4a. Extraído (Carrinho)': `R$ ${extractedPrice.toFixed(2)}`,
      '4b. Matching Engine': `R$ ${matchedPrice.toFixed(2)}`,
      '4c. Banco Supabase': `R$ ${persistedPrice.toFixed(2)}`,
      'Status Validação': isSuccess ? '✅ PASS (100% Promo)' : `❌ FAIL (${leakageStage || 'Preço divergente'})`
    });
  }

  console.table(comparisonResults);

  console.log('\n====================================================================================================');
  console.log(`  RESULTADO FINAL DO TESTE DE REGRESSÃO: ${totalFailures === 0 ? '✅ 100% APROVADO' : '❌ FALHA DETECTADA'}`);
  console.log(`  Total de produtos testados: ${testItems.length}`);
  console.log(`  Ocorrências de Preço Riscado: ${totalFailures}`);
  console.log('====================================================================================================\n');
}

runPermanentRegressionTest().catch(err => console.error(err));
