require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const quoteEngine = require('../core/services/supplier-quote-engine');
const construjaConfig = require('../core/services/supplier-quote-engine/configs/construja.json');

// Supabase setup
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const supabase = (url && key) ? createClient(url, key) : null;

// Vault decryption helper
function decryptAES256(encryptedData) {
  if (!encryptedData) return '';
  try {
    const crypto = require('crypto');
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
    console.error('Falha ao descriptografar:', e);
    return '[DESCRIPTOGRAFIA_FALHOU]';
  }
}

// Pasta de histórico do teste
const todayStr = '2026-09-15';
const historyDir = path.join(__dirname, '..', 'docs', 'historico', todayStr, 'teste1_construja');
if (!fs.existsSync(historyDir)) {
  fs.mkdirSync(historyDir, { recursive: true });
}

// Logger com timestamp
const logFile = path.join(historyDir, 'log_execucao_construja.log');
const logStream = fs.createWriteStream(logFile, { flags: 'w' });

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  logStream.write(line + '\n');
}

// 9 Itens solicitados
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

async function executarTesteConstruja() {
  log('==============================================================================');
  log('🚀 INICIANDO TESTE REAL DE COTAÇÃO — FORNECEDOR CONSTRUJÁ (9 ITENS)');
  log('==============================================================================');

  // 1. Copiar o config JSON gerado para a pasta do histórico
  fs.writeFileSync(
    path.join(historyDir, 'construja.json'),
    JSON.stringify(construjaConfig, null, 2),
    'utf8'
  );
  log(`✅ Config construja.json salvo em ${path.join(historyDir, 'construja.json')}`);

  // 2. Extrair credenciais da tabela `fornecedores`
  let loginUser = '';
  let decryptedPass = '';

  if (supabase) {
    const { data: dbData } = await supabase
      .from('fornecedores')
      .select('*')
      .or('nome.ilike.%construja%,id.eq.a1684c4d-d896-4ba9-a591-cda455c5ffe2')
      .maybeSingle();

    if (dbData) {
      loginUser = (dbData.login_salvo || dbData.email_login || dbData.login || '').trim();
      const rawPass = (dbData.senha_criptografada || dbData.senha_login || '').trim();
      decryptedPass = decryptAES256(rawPass);
      log(`🔑 Credenciais resgatadas do banco para ${dbData.nome}: Usuário: "${loginUser}" | Senha: [DESCRIPTOGRAFADA DA VAULT - ${decryptedPass.length} chars]`);
    }
  }

  if (!loginUser || !decryptedPass || decryptedPass === '[DESCRIPTOGRAFIA_FALHOU]') {
    log('⚠️ Credenciais do banco não obtidas por Supabase. Tentando fallback local...');
    loginUser = 'comercialsantana2021@gmail.com';
    decryptedPass = '871935'; // Fallback se vault local
  }

  // 3. Iniciar browser Playwright
  log('🌐 Iniciando navegador Chromium para automação Playwright...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    // 4. Login no site da Construjá
    log(`🔑 Executando login no portal Construjá (${construjaConfig.url_site})...`);
    await quoteEngine.realizarLogin(page, construjaConfig, { user: loginUser, pass: decryptedPass });
    log('✅ Login e seleção de filial finalizados com sucesso.');

    // Screenshot pós-login
    const pLogin = path.join(historyDir, '01_pos_login.png');
    await page.screenshot({ path: pLogin, fullPage: false }).catch(() => {});
    log(`📸 Print pós-login salvo em: 01_pos_login.png`);

    // 5. Cotar os 9 itens sequencialmente
    const resultadosItensMap = [];
    let idx = 1;

    for (const itemObj of itensParaCotar) {
      log(`\n🔍 [Item ${idx}/${itensParaCotar.length}] Pesquisando: "${itemObj.termo}" (Quantidade: ${itemObj.quantidade})...`);
      
      const resItem = await quoteEngine.adicionarItem(page, construjaConfig, {
        termo: itemObj.termo,
        quantidade: itemObj.quantidade,
        itemIndex: idx++
      }).catch((err) => ({
        termo: itemObj.termo,
        tituloProduto: null,
        status: 'FALHA',
        erro: err.message
      }));

      log(`  └─ Resultado: ${resItem.status} | Produto Encontrado: "${resItem.tituloProduto || 'Nenhum'}" | Preço: ${resItem.unitPriceStr || 'R$ 0,00'}`);
      resultadosItensMap.push(resItem);
    }

    // Screenshot do carrinho preenchido
    const pCarrinho = path.join(historyDir, '02_carrinho_preenchido.png');
    await page.screenshot({ path: pCarrinho, fullPage: false }).catch(() => {});

    // 6. Extrair dados finais do carrinho
    log('\n🛒 Navegando para o carrinho para extração dos valores finais...');
    const cartData = await quoteEngine.extrairCarrinho(page, construjaConfig);

    // Screenshot resumo carrinho
    const pResumo = path.join(historyDir, '03_resumo_carrinho.png');
    await page.screenshot({ path: pResumo, fullPage: false }).catch(() => {});

    // 7. Salvar Payload Final JSON
    const payloadFinal = {
      fornecedor: construjaConfig.nome,
      slug: construjaConfig.slug,
      fornecedor_id: construjaConfig.fornecedor_id,
      data_execucao: new Date().toISOString(),
      cartUrl: cartData.cartUrl,
      resumoGeral: cartData.resumo,
      itensCotadosCount: cartData.produtos ? cartData.produtos.length : 0,
      itensExtracao: cartData.produtos,
      itensResultadosBusca: resultadosItensMap,
      errosExtracao: cartData.errosExtracao || []
    };

    fs.writeFileSync(
      path.join(historyDir, 'payload_final_construja.json'),
      JSON.stringify(payloadFinal, null, 2),
      'utf8'
    );
    log(`✅ Payload final salvo em ${path.join(historyDir, 'payload_final_construja.json')}`);

    // 8. Gerar Relatório Markdown em teste1_construja/relatorio_construja_teste1.md
    let mdContent = `# Relatório de Teste Real — Fornecedor Construjá (9 Itens)

- **Data de Execução**: ${new Date().toLocaleString('pt-BR')}
- **Fornecedor**: Construjá (${construjaConfig.fornecedor_id})
- **URL**: ${construjaConfig.url_site}
- **Itens Solicitados**: 9
- **Total do Pedido Extraído**: R$ ${(cartData.resumo?.totalPedido || 0).toFixed(2)}

---

## 📊 Tabela Comparativa de Itens (Solicitado vs. Cotado no Site)

| # | Item Solicitado pelo Cliente | Qtd | Produto Localizado no Site Construjá | Status | Preço Unitário | Preço Total Item |
|---|---|---|---|---|---|---|
`;

    itensParaCotar.forEach((it, i) => {
      const matchItem = cartData.produtos ? cartData.produtos[i] : null;
      const resItem = resultadosItensMap[i];
      const nomeEnc = matchItem ? matchItem.nomeProduto : (resItem ? resItem.tituloProduto : 'Não Localizado');
      const st = matchItem || (resItem && resItem.status === 'ENCONTRADO') ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO';
      const pUnit = matchItem ? `R$ ${matchItem.precoUnitario.toFixed(2)}` : (resItem?.unitPriceStr || 'R$ 0,00');
      const pTot = matchItem ? `R$ ${matchItem.totalItem.toFixed(2)}` : 'R$ 0,00';

      mdContent += `| ${i + 1} | ${it.termo} | ${it.quantidade} | ${nomeEnc} | ${st} | ${pUnit} | ${pTot} |\n`;
    });

    mdContent += `\n---

## 🛒 Resumo Geral do Pedido
- **Subtotal Itens**: R$ ${(cartData.resumo?.totalItens || 0).toFixed(2)}
- **Despesas Acessórias**: R$ ${(cartData.resumo?.despesaAcessoria || 0).toFixed(2)}
- **Total Geral do Pedido**: R$ ${(cartData.resumo?.totalPedido || 0).toFixed(2)}

---

## 📁 Arquivos do Histórico Salvos
- \`construja.json\` (Config do fornecedor)
- \`log_execucao_construja.log\` (Log completo com timestamps)
- \`payload_final_construja.json\` (Payload estruturado)
- \`01_pos_login.png\`, \`02_carrinho_preenchido.png\`, \`03_resumo_carrinho.png\`
`;

    fs.writeFileSync(path.join(historyDir, 'relatorio_construja_teste1.md'), mdContent, 'utf8');
    log(`✅ Relatório Markdown gerado com SUCESSO em ${path.join(historyDir, 'relatorio_construja_teste1.md')}`);

    log('\n==============================================================================');
    log('🎉 COTAÇÃO REAL CONSTRUJÁ CONCLUÍDA COM SUCESSO!');
    log('==============================================================================');
  } catch (err) {
    log(`❌ ERRO NA EXECUÇÃO DO TESTE CONSTRUJÁ: ${err.stack || err}`);
  } finally {
    await browser.close();
    logStream.end();
  }
}

executarTesteConstruja();
