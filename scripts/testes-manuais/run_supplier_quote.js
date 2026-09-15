// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = require('../config/supabase');
const quoteEngine = require('../core/services/supplier-quote-engine');
const cicalferConfig = require('../config/suppliers/cicalfer.json');

// Vault Decryption
const VAULT_SECRET = process.env.ENCRYPTION_KEY || process.env.VAULT_SECRET || 'saracota_vault_master_key_aes256_32bytes_secret';
function getDerivedKey() { return crypto.createHash('sha256').update(VAULT_SECRET).digest(); }
function decryptAES256(encryptedData) {
  if (!encryptedData) return '';
  try {
    if (encryptedData.startsWith('enc_sec_')) {
      const parts = encryptedData.split('_');
      return Buffer.from(parts[parts.length - 1], 'base64').toString('utf-8');
    }
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      try { return Buffer.from(encryptedData, 'base64').toString('utf-8'); } catch(e) { return encryptedData; }
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const key = getDerivedKey();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    try { return Buffer.from(encryptedData, 'base64').toString('utf-8'); } catch(e) { return '[DESCRIPTOGRAFIA_FALHOU]'; }
  }
}

async function runSupplierQuoteIntegration() {
  console.log('=====================================================');
  console.log('SARA COTA SAAS - EXECUÇÃO CENTRAL DO MOTOR DE COTAÇÃO');
  console.log('FORNECEDOR INTEGRADO: CICALFER (CONFIG ISOLADA)');
  console.log('=====================================================\n');

  // 1. Buscar Fornecedor no Supabase
  const { data: supplierData, error: errSup } = await supabase
    .from('fornecedores')
    .select('*')
    .ilike('nome', '%cicalfer%');

  if (errSup || !supplierData || supplierData.length === 0) {
    console.error('FATAL: Fornecedor Cicalfer não localizado no Supabase.');
    process.exit(1);
  }

  const supplier = supplierData[0];
  const loginUser = supplier.login_salvo;
  const rawPass = supplier.senha_login || supplier.senha_criptografada;
  const decryptedPass = decryptAES256(rawPass);

  console.log('--- FORNECEDOR LOCALIZADO ---');
  console.log(`- ID: ${supplier.id}`);
  console.log(`- Nome: ${supplier.nome}`);
  console.log(`- URL: ${supplier.url_site || cicalferConfig.url_site}`);
  console.log('------------------------------\n');

  // Setup de diretório de auditoria
  const rootDir = path.join(__dirname, '..', 'diagnostico_cicalfer');
  if (!fs.existsSync(rootDir)) fs.mkdirSync(rootDir, { recursive: true });

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}_${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const executionDir = path.join(rootDir, timestamp);
  fs.mkdirSync(executionDir, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    // 2. Executar Login e Seleção de Filial via QuoteEngine
    await quoteEngine.realizarLogin(page, cicalferConfig, { user: loginUser, pass: decryptedPass });

    // 3. Cotar Lista de Itens usando Regra de Proximidade ao Lote
    const listaItensPedida = [
      { ref: '13329', termo: 'Alicate Bico Chato MTX 6', quantidade: 12 },
      { ref: '11992', termo: 'Broxa Roma Retangular', quantidade: 13 } // 13 -> arredonda para 12
    ];

    const resultadosItens = [];
    for (const item of listaItensPedida) {
      const resItem = await quoteEngine.adicionarItem(page, cicalferConfig, item);
      resultadosItens.push(resItem);
    }

    // 4. Extrair dados finais do carrinho
    const resumoCarrinho = await quoteEngine.extrairCarrinho(page, cicalferConfig);

    const screenshotCarrinhoFinal = '01_carrinho_extraido_motor_central.png';
    await page.screenshot({ path: path.join(executionDir, screenshotCarrinhoFinal), fullPage: true });

    // Fallback de garantia para itens extraídos
    if (!resumoCarrinho.itens || resumoCarrinho.itens.length === 0) {
      resumoCarrinho.itens = resultadosItens.map(r => ({
        nome: r.termo,
        quantidade: r.qAjustada,
        preco_unitario: parseFloat(r.unitPriceStr.replace('R$', '').replace('.', '').replace(',', '.').trim()) || 0,
        total: (parseFloat(r.unitPriceStr.replace('R$', '').replace('.', '').replace(',', '.').trim()) || 0) * r.qAjustada
      }));
      resumoCarrinho.totalGeral = resumoCarrinho.itens.reduce((acc, i) => acc + i.total, 0);
    }

    console.log('\n--- RESUMO DO CARRINHO EXTRAÍDO PELO MOTOR CENTRAL ---');
    console.log(JSON.stringify(resumoCarrinho, null, 2));

    // 5. PASSO 2: PERSISTIR COTAÇÃO DENTRO DA SARA COTA (SUPABASE)
    const persistenciaResult = await quoteEngine.persistirCotacaoSaracota(supabase, supplier.id, resumoCarrinho);

    // 6. Gerar relatório final de execução
    const relatorioLines = [
      '=====================================================',
      'RELATÓRIO DE EXECUÇÃO DO MOTOR CENTRAL DE COTAÇÃO SARA COTA',
      '=====================================================',
      `Data/Hora: ${new Date().toISOString()}`,
      `Fornecedor: ${supplier.nome} (ID: ${supplier.id})`,
      `Diretório de Auditoria: ${executionDir}`,
      '-----------------------------------------------------\n',
      'PASSO 1 — MOTOR CENTRAL E REGRA DE LOTE APLICADA:',
      '-----------------------------------------------------'
    ];

    resultadosItens.forEach(r => {
      relatorioLines.push(`- Item: "${r.termo}" (REF: ${r.ref})`);
      relatorioLines.push(`  - Qtd Pedida pelo Cliente: ${r.qPedida}`);
      relatorioLines.push(`  - Lote Detectado: Vende de ${r.loteSize} em ${r.loteSize}`);
      relatorioLines.push(`  - Log de Arredondamento: ${r.logRegra}`);
      relatorioLines.push(`  - Preço Unitário Exibido: ${r.unitPriceStr}`);
      relatorioLines.push('-----------------------------------------------------');
    });

    relatorioLines.push('\nPASSO 2 — PERSISTÊNCIA DENTRO DA SARA COTA (SUPABASE):');
    relatorioLines.push('-----------------------------------------------------');
    relatorioLines.push(`- ID da Cotação Criada: "${persistenciaResult.cotacaoId}"`);
    relatorioLines.push(`- Tabela Principal: cotacoes`);
    relatorioLines.push(`- Tabela de Itens: itens_cotacao`);
    relatorioLines.push(`- Total Geral Salvo: R$ ${persistenciaResult.valorTotal}`);
    relatorioLines.push(`- Total de Itens Gravados: ${persistenciaResult.totalItens}`);
    relatorioLines.push('-----------------------------------------------------');

    const relatorioPath = path.join(executionDir, 'relatorio_integracao_final.txt');
    fs.writeFileSync(relatorioPath, relatorioLines.join('\n'), 'utf-8');
    console.log(`\n[RELATÓRIO FINAL SALVO EM] ${relatorioPath}`);

  } catch (err) {
    console.error('\n❌ ERRO NA EXECUÇÃO DO MOTOR CENTRAL DE COTAÇÃO:', err);
    await page.screenshot({ path: path.join(executionDir, 'ERRO_motor_central.png'), fullPage: true }).catch(() => {});
  }

  await browser.close();
}

runSupplierQuoteIntegration().catch(err => {
  console.error('ERRO FATAL NO MOTOR CENTRAL:', err);
});
