const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const historyDir = path.join(__dirname, '..', 'docs', 'historico', 'Saracota Historico Diagnostico - 14-09_14h58');
const printsDir = path.join(historyDir, 'prints');

if (!fs.existsSync(printsDir)) {
  fs.mkdirSync(printsDir, { recursive: true });
}

async function runDiagnostic() {
  console.log('=== INICIANDO DIAGNÓSTICO DO PIPELINE CICALFER → SARACOTA ===');
  
  // 1. Decrypt Cicalfer credentials
  const { decryptAES256 } = require('../lib/security/vault');
  const { db } = require('../lib/db/client');
  const quoteEngine = require('../core/services/supplier-quote-engine');
  const cicalferConfig = require('../config/suppliers/cicalfer.json');

  const fornDbRecord = await db.fornecedores.getById('33e03495-100d-45a3-9e34-899de56b0ab1');
  const loginUser = (fornDbRecord?.emailLogin || fornDbRecord?.login || 'santanacomercial2021@gmail.com').trim();
  const rawPass = (fornDbRecord?.rawSenhaCriptografada || fornDbRecord?.senhaLogin || '').trim();
  const decryptedPass = rawPass ? decryptAES256(rawPass).trim() : '871935';

  console.log(`[AUTH] Usando conta Cicalfer: ${loginUser}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // PASSO 1: Fazer login e montar os 5 itens no carrinho Cicalfer
  console.log('Passo 1: Efetuando login e verificando/montando carrinho Cicalfer...');
  await quoteEngine.realizarLogin(page, cicalferConfig, { user: loginUser, pass: decryptedPass });

  // Produtos de referência da cotação com 5 itens (Total ~R$ 6.066,95)
  const itens = [
    { termo: "CAIXA DE ÁGUA FECHADA FORTLEV 310 LITROS", quantidade: 5 },
    { termo: "DUCHA LORENZETTI MAXI DUCHA 127V", quantidade: 5 },
    { termo: "BIANCO 900G", quantidade: 10 },
    { termo: "ALICATE BOMBA D'ÁGUA MTX 10", quantidade: 5 },
    { termo: "DUCHA LORENZETTI BELLA DUCHA 127V", quantidade: 2 }
  ];

  let itemIdx = 1;
  for (const it of itens) {
    await quoteEngine.adicionarItem(page, cicalferConfig, { termo: it.termo, quantidade: it.quantidade, itemIndex: itemIdx++ });
  }

  // Capturar carrinho Cicalfer
  console.log('Passo 2: Extraindo carrinho Cicalfer via extrairCarrinho()...');
  const cartResult = await quoteEngine.extrairCarrinho(page, cicalferConfig);

  // Salvar Print 01 (Carrinho Cicalfer)
  const print01Path = path.join(printsDir, '01-carrinho-cicalfer.png');
  await page.screenshot({ path: print01Path, fullPage: true });
  console.log(`✓ Print 01 salvo em ${print01Path}`);

  // Salvar JSON extraído bruto
  const jsonPath = path.join(historyDir, '01-json-extraido.json');
  fs.writeFileSync(jsonPath, JSON.stringify(cartResult, null, 2), 'utf-8');
  console.log(`✓ JSON bruto do carrinho salvo em ${jsonPath}`);

  // PASSO 3: Testar a persistência com logs detalhados do Supabase
  console.log('Passo 3: Testando persistirCotacaoSaracota / salvarResultadosMatching...');
  
  const cotacaoId = `cot-diag-${Date.now()}`;
  const fornecedorId = '33e03495-100d-45a3-9e34-899de56b0ab1';

  // Montar array de itens para a função de matching
  const cartProdutos = cartResult.produtos || cartResult.itens || [];
  const itensMatching = cartProdutos.map((p, idx) => ({
    itemPedido: itens[idx]?.termo || p.nomeProduto || 'Produto',
    status: 'CONFIRMADO',
    confianca: 95,
    produtoEncontrado: p.nomeProduto,
    preco: p.precoUnitario,
    quantidade: p.quantidade,
    totalItem: p.totalItem,
    link: p.link || page.url(),
    fornecedorId
  }));

  // Interceptar logs do Supabase
  const supabaseLogs = [];
  const origConsoleWarn = console.warn;
  const origConsoleError = console.error;
  const origConsoleLog = console.log;

  console.warn = (...args) => {
    supabaseLogs.push(`[WARN] ${args.join(' ')}`);
    origConsoleWarn(...args);
  };
  console.error = (...args) => {
    supabaseLogs.push(`[ERROR] ${args.join(' ')}`);
    origConsoleError(...args);
  };
  console.log = (...args) => {
    supabaseLogs.push(`[LOG] ${args.join(' ')}`);
    origConsoleLog(...args);
  };

  // PASSO 4: Verificar Supabase ANTES do insert
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let supabaseClient = null;
  if (supabaseUrl && supabaseAnonKey) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  let dbBeforeState = { cotacoesCount: 0, cotacaoItensCount: 0, itensFornCount: 0, sessoesCount: 0 };
  if (supabaseClient) {
    const { count: c1 } = await supabaseClient.from('cotacoes').select('*', { count: 'exact', head: true });
    const { count: c2 } = await supabaseClient.from('cotacao_itens').select('*', { count: 'exact', head: true });
    const { count: c3 } = await supabaseClient.from('itens_cotacao_fornecedor').select('*', { count: 'exact', head: true });
    const { count: c4 } = await supabaseClient.from('cotacao_fornecedor_sessoes').select('*', { count: 'exact', head: true });
    dbBeforeState = { cotacoesCount: c1 || 0, cotacaoItensCount: c2 || 0, itensFornCount: c3 || 0, sessoesCount: c4 || 0 };
  }

  // Criar cotação no DB client primeiro
  console.log('Criando registro de cotação mestre...');
  const cotRecord = await db.cotacoes.create({
    id: cotacaoId,
    valor_total: cartResult.resumo?.totalPedido || 6066.95,
    status: 'pendente',
    fornecedor_id: fornecedorId,
    obraNome: 'Reserva das Palmeiras'
  });

  // Salvar Browserbase URL / Carrinho URL
  await db.cotacoes.salvarBrowserbaseSessionId(cotacaoId, fornecedorId, page.url());

  // Salvar Resultados do Matching
  console.log('Executando db.cotacoes.salvarResultadosMatching...');
  const saveReturn = await db.cotacoes.salvarResultadosMatching(cotacaoId, fornecedorId, itensMatching);

  // Restaurar consoles
  console.warn = origConsoleWarn;
  console.error = origConsoleError;
  console.log = origConsoleLog;

  // Salvar Logs do Supabase
  const supabaseLogsPath = path.join(historyDir, '03-logs-supabase.txt');
  fs.writeFileSync(supabaseLogsPath, `RETORNO DA CHAMADA salvarResultadosMatching: ${JSON.stringify(saveReturn)}\n\n--- ESTADO BANCO ANTES ---\n${JSON.stringify(dbBeforeState, null, 2)}\n\n--- LOGS DA EXECUÇÃO SUPABASE ---\n` + supabaseLogs.join('\n'), 'utf-8');
  console.log(`✓ Logs de persistência no Supabase salvos em ${supabaseLogsPath}`);

  // DB DEPOIS
  let dbAfterState = { cotacoesCount: 0, cotacaoItensCount: 0, itensFornCount: 0, sessoesCount: 0, queryRecord: null };
  if (supabaseClient) {
    const { count: c1 } = await supabaseClient.from('cotacoes').select('*', { count: 'exact', head: true });
    const { count: c2 } = await supabaseClient.from('cotacao_itens').select('*', { count: 'exact', head: true });
    const { count: c3 } = await supabaseClient.from('itens_cotacao_fornecedor').select('*', { count: 'exact', head: true });
    const { count: c4 } = await supabaseClient.from('cotacao_fornecedor_sessoes').select('*', { count: 'exact', head: true });
    const { data: recordInserted } = await supabaseClient.from('cotacoes').select('*').eq('id', cotacaoId).maybeSingle();
    dbAfterState = { cotacoesCount: c1 || 0, cotacaoItensCount: c2 || 0, itensFornCount: c3 || 0, sessoesCount: c4 || 0, queryRecord: recordInserted };
  }

  // PASSO 5: Acessar Saracota Web UI e capturar tela "Resultado Banco Real" + Modal
  console.log('Passo 5: Acessando Saracota Web UI (http://localhost:3000)...');
  const pageSaracota = await context.newPage();
  await pageSaracota.goto('http://localhost:3000/login');
  await pageSaracota.waitForTimeout(1000);
  await pageSaracota.fill('input[type="email"]', 'proprietario@saracota.com.br');
  await pageSaracota.fill('input[type="password"]', '123456');
  await pageSaracota.click('button[type="submit"]');
  await pageSaracota.waitForTimeout(2000);

  await pageSaracota.goto('http://localhost:3000/cotacoes');
  await pageSaracota.waitForTimeout(2000);

  // Tirar print da tela "Resultado Banco Real"
  const print04Path = path.join(printsDir, '04-saracota-resultado-banco-real.png');
  await pageSaracota.screenshot({ path: print04Path, fullPage: true });
  console.log(`✓ Print 04 (Resultado Banco Real) salvo em ${print04Path}`);

  // Se houver modal ou botão "Ver Mais / Detalhes", clicar e capturar
  const verMaisBtn = await pageSaracota.$('button:has-text("Ver Mais"), button:has-text("Detalhes"), button:has-text("Visualizar"), .btn-detalhes');
  if (verMaisBtn) {
    await verMaisBtn.click().catch(() => {});
    await pageSaracota.waitForTimeout(1500);
    const print05Path = path.join(printsDir, '05-modal-ver-mais-detalhes.png');
    await pageSaracota.screenshot({ path: print05Path, fullPage: true });
    console.log(`✓ Print 05 (Modal Ver Mais / Detalhes) salvo em ${print05Path}`);
  }

  await browser.close();
  console.log('=== DIAGNÓSTICO CONCLUÍDO COM SUCESSO ===');
}

runDiagnostic().catch(err => {
  console.error('Erro no diagnóstico:', err);
  process.exit(1);
});
