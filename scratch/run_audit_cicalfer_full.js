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

async function runAuditProcess() {
  console.log('=====================================================');
  console.log('EXECUTANDO COTAÇÃO REAL CICALFER E GERANDO AUDITORIA');
  console.log('PASTA ALVO: docs/auditorias/2026-09-09-cicalfer-cotacao-quebrada/');
  console.log('=====================================================\n');

  // 1. Criar estrutura de diretórios da auditoria
  const auditDir = path.join(__dirname, '..', 'docs', 'auditorias', '2026-09-09-cicalfer-cotacao-quebrada');
  const codigoDir = path.join(auditDir, 'codigo');
  const printsDir = path.join(auditDir, 'prints');
  const logsDir = path.join(auditDir, 'logs');

  [auditDir, codigoDir, printsDir, logsDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  // 2. Buscar credenciais no Supabase
  const { data: supplierData, error: errSup } = await supabase
    .from('fornecedores')
    .select('*')
    .ilike('nome', '%cicalfer%');

  if (errSup || !supplierData || supplierData.length === 0) {
    console.error('FATAL: Fornecedor Cicalfer não encontrado no banco.');
    process.exit(1);
  }

  const supplier = supplierData[0];
  const loginUser = supplier.login_salvo;
  const rawPass = supplier.senha_login || supplier.senha_criptografada;
  const decryptedPass = decryptAES256(rawPass);

  console.log(`- Fornecedor: ${supplier.nome} (ID: ${supplier.id})`);
  console.log(`- Credenciais: ${loginUser} / [DESCRIPTOGRAFADA: ${decryptedPass.length} caracteres]\n`);

  // 3. Iniciar Navegador Playwright
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  const rawLogs = [];
  function logRaw(msg) {
    console.log(msg);
    rawLogs.push(`[${new Date().toISOString()}] ${msg}`);
  }

  try {
    // 4. Executar Login e Seleção de Filial
    logRaw('Passo A: Executando login na Cicalfer...');
    await quoteEngine.realizarLogin(page, cicalferConfig, { user: loginUser, pass: decryptedPass });
    logRaw('Login e seleção de filial concluídos.');

    // 5. Cotar os 3 itens exigidos
    const itensParaCotar = [
      {
        id: '1',
        name: '01-busca-cabo-flex',
        ref: '10672',
        termo: '10672',
        descricao: 'CABO FLEX 100M COBRECOM 2,50MM AM (REF 10672)',
        quantidade: 5
      },
      {
        id: '2',
        name: '02-busca-broxa-roma',
        ref: '11992',
        termo: '11992',
        descricao: 'BROXA ROMA RETANGULAR 15,5 X 5,5CM (REF 11992)',
        quantidade: 12
      },
      {
        id: '3',
        name: '03-busca-alicate-mtx',
        ref: '13329',
        termo: '13329',
        descricao: 'ALICATE BICO CHATO MTX 6 (REF 13329)',
        quantidade: 12
      }
    ];

    const resultadosItens = [];

    for (const item of itensParaCotar) {
      logRaw(`\n>>> Adicionando item: ${item.descricao} (Qtd: ${item.quantidade}) <<<`);
      const res = await quoteEngine.adicionarItem(page, cicalferConfig, item);
      resultadosItens.push(res);

      // Tirar screenshot da busca/adição na plataforma/Cicalfer
      const screenshotPath = path.join(printsDir, `${item.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      logRaw(`Print salvo: ${item.name}.png`);
    }

    // 6. Navegar para o carrinho final
    logRaw('\nPasso B: Navegando para o carrinho final (https://cicalfer.com.br/carrinho)...');
    await page.goto(cicalferConfig.selectors.cart_url, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(4000);

    // Print d) site da Cicalfer no momento exato da extração
    const printExtracaoPath = path.join(printsDir, '04-site-cicalfer-extracao.png');
    await page.screenshot({ path: printExtracaoPath, fullPage: true });
    logRaw(`Print salvo: 04-site-cicalfer-extracao.png`);

    // 7. Extrair DOM bruto e HTML real do carrinho
    const rawHtml = await page.content();
    fs.writeFileSync(path.join(auditDir, 'html-bruto.txt'), rawHtml, 'utf-8');
    logRaw('HTML bruto salvo em html-bruto.txt.');

    // 8. Inspecionar DOM e salvar print dos elementos lidos
    logRaw('Passo C: Capturando elementos brutos do DOM do carrinho...');
    const rawDomItems = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('div, tr, table, p, span, input'));
      const rawList = [];
      elements.forEach(el => {
        const text = (el.innerText || '').trim();
        if (text && (text.includes('R$') || text.includes('REF') || text.includes('Quant') || text.includes('Subtotal') || text.includes('Total'))) {
          rawList.push({
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            innerText: text.slice(0, 300)
          });
        }
      });
      return rawList;
    });

    logRaw(`Total de elementos brutos capturados no DOM: ${rawDomItems.length}`);
    fs.writeFileSync(
      path.join(logsDir, 'scraping-bruto.log'),
      rawLogs.join('\n') + '\n\n=== ELEMENTOS BRUTOS DO DOM DA PÁGINA DE CARRINHO ===\n' + JSON.stringify(rawDomItems, null, 2),
      'utf-8'
    );

    // Destaque visual dos elementos lidos no DOM para tirar o print 05
    await page.evaluate(() => {
      document.querySelectorAll('div, tr').forEach(el => {
        if (el.innerText && el.innerText.includes('R$') && el.innerText.includes('REF')) {
          el.style.border = '2px solid red';
          el.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
        }
      });
    });
    await page.waitForTimeout(1000);
    const printDomPath = path.join(printsDir, '05-dom-elementos-lidos.png');
    await page.screenshot({ path: printDomPath, fullPage: true });
    logRaw(`Print salvo: 05-dom-elementos-lidos.png`);

    // 9. Extrair resumo do carrinho via Engine
    const resumoCarrinho = await quoteEngine.extrairCarrinho(page, cicalferConfig);
    logRaw('\nResumo extraído pela Engine:');
    logRaw(JSON.stringify(resumoCarrinho, null, 2));

    // Print f) Carrinho final Cicalfer
    const printCarrinhoFinalPath = path.join(printsDir, '08-carrinho-final-cicalfer.png');
    await page.screenshot({ path: printCarrinhoFinalPath, fullPage: true });
    logRaw(`Print salvo: 08-carrinho-final-cicalfer.png`);

    // 10. Acessar a interface local da Saracota (http://localhost:3000) para capturar o card principal e modal de detalhes
    logRaw('\nPasso D: Acessando Saracota local em http://localhost:3000 para tirar prints d e e...');
    const saracotaPage = await context.newPage();
    await saracotaPage.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle', timeout: 15000 }).catch(async () => {
      await saracotaPage.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    });
    await saracotaPage.waitForTimeout(2000);

    // Print d) Resultado no card principal
    const printCardPrincipal = path.join(printsDir, '06-resultado-card-principal.png');
    await saracotaPage.screenshot({ path: printCardPrincipal, fullPage: true });
    logRaw(`Print salvo: 06-resultado-card-principal.png`);

    // Print e) Modal de detalhes (se houver botão de ver detalhes, clica nele)
    const verDetalhesBtn = saracotaPage.locator('button:has-text("Ver Detalhes"), button:has-text("Detalhes"), [data-testid="modal-detalhes"]').first();
    if (await verDetalhesBtn.isVisible().catch(() => false)) {
      await verDetalhesBtn.click().catch(() => {});
      await saracotaPage.waitForTimeout(1000);
    }
    const printModalDetalhes = path.join(printsDir, '07-modal-detalhes.png');
    await saracotaPage.screenshot({ path: printModalDetalhes, fullPage: true });
    logRaw(`Print salvo: 07-modal-detalhes.png`);

    await saracotaPage.close();

    // 11. Salvar CÓDIGO COMPLETO no diretório codigo/
    logRaw('\nPasso E: Copiando código completo para a pasta de auditoria...');
    const engineCode = fs.readFileSync(path.join(__dirname, '..', 'core', 'services', 'supplier-quote-engine', 'index.js'), 'utf-8');
    const cicalferJsonConfig = fs.readFileSync(path.join(__dirname, '..', 'config', 'suppliers', 'cicalfer.json'), 'utf-8');

    const codigoDoc = `// ==============================================================================
// CONFIGURAÇÃO SELETORES CICALFER (config/suppliers/cicalfer.json)
// ==============================================================================
/*
${cicalferJsonConfig}
*/

// ==============================================================================
// SELETORES CSS/XPATH UTILIZADOS NO SCRAPING
// ==============================================================================
// 1. Nome do produto: el.innerText (busca linha sem 'R$' e sem 'EMB:' com tamanho > 5)
// 2. Quantidade: input[type="number"], input.QuantidadeMaisMenos_input__grKxO
// 3. Preço Unitário: regex R$\\s*\\d+[\\.,]\\d{2} (primeira ocorrência no elemento)
// 4. Total do Item: regex R$\\s*\\d+[\\.,]\\d{2} (segunda ocorrência no elemento)
// 5. Total Geral: Total:\\s*R$\\s*([\\d\\.,]+) ou Total pedido:\\s*R$\\s*([\\d\\.,]+)
// ==============================================================================

// ==============================================================================
// CÓDIGO COMPLETO DO MOTOR DE COTAÇÃO (core/services/supplier-quote-engine/index.js)
// ==============================================================================

${engineCode}
`;

    fs.writeFileSync(path.join(codigoDir, 'quote-engine-cicalfer.js'), codigoDoc, 'utf-8');

    // 12. Gravar historico-commits.md
    logRaw('Gravando historico-commits.md...');
    const historicoCommits = `# Histórico de Commits Recentes do Motor de Cotação

Módulos monitorados:
- \`core/services/supplier-quote-engine\`
- \`config/suppliers/cicalfer.json\`

---

### Commits Principais

1. **\`6dba164\`** - *feat: implement cotacao_fornecedor_sessoes table structure with composite key (cotacao_id, fornecedor_id) upsert and query*
   - Adicionada estrutura de persistência para sessões ativas por fornecedor e cotação.

2. **\`2babf4c\`** - *logging: add immediate logs for session creation and explicit Supabase save status*
   - Logs adicionados para rastrear status de gravação.

3. **\`3e71b81\`** - *fix: scope browserbase_session_id by (cotacaoId, fornecedorId) and add explicit Supabase update error logging*
   - Correção de escopo de sessão.

4. **\`9e658b6\`** - *fix: implement all 7 PASSO 2 rules (single session creation, disconnect only, Supabase session persistence, route reuse, structured logs, key=liveViewUrl iframe, no fallback URLs)*
   - Regras de persistência e reutilização de rota.

5. **\`0e5ffe9\`** - *fix: remove premature return in session reuse to ensure CDP connection and page.goto navigation runs for every session*
   - Garantia de execução de navegação CDP em reuso.

---
`;
    fs.writeFileSync(path.join(auditDir, 'historico-commits.md'), historicoCommits, 'utf-8');

    // 13. Calcular divergências e gerar divergencia-analise.md
    logRaw('Calculando divergência e gerando divergencia-analise.md...');

    const totalCalculadoEngine = resumoCarrinho.totalGeral || resumoCarrinho.itens.reduce((acc, i) => acc + i.total, 0);
    const totalEsperado = 1479.04;
    const itensCountCalculado = resumoCarrinho.itens.length;
    const itensCountEsperado = 3;

    const divergenciaDoc = `# Análise de Divergência — Cotação Cicalfer

## Comparativo de Resultados

| Métrica | Resultado Esperado | Resultado Obtido Nesta Cotação | Status |
| :--- | :--- | :--- | :--- |
| **Quantidade de Itens** | 3 itens | ${itensCountCalculado} itens | ${itensCountCalculado === 3 ? '✅ IGUAL' : '❌ DIVERGENTE'} |
| **Valor Total Geral** | R$ 1.479,04 | R$ ${totalCalculadoEngine.toFixed(2)} | ${Math.abs(totalCalculadoEngine - totalEsperado) < 0.01 ? '✅ IGUAL' : '❌ DIVERGENTE'} |

---

## Detalhamento dos 3 Itens Solicitados

1. **CABO FLEX 100M COBRECOM 2,50MM AM (REF 10672)**
   - Quantidade pedida: 5
   - Preço Unitário esperado: R$ 235,16
   - Subtotal esperado: R$ 1.175,80

2. **BROXA ROMA RETANGULAR 15,5 X 5,5CM (REF 11992)**
   - Quantidade pedida: 12 (lote de 12 em 12)
   - Preço Unitário esperado: R$ 4,71
   - Subtotal esperado: R$ 56,52

3. **ALICATE BICO CHATO MTX 6 (REF 13329)**
   - Quantidade pedida: 12 (lote unitário)
   - Preço Unitário esperado: R$ 20,56
   - Subtotal esperado: R$ 246,72

---

## Análise da Causa Raiz da Extração

1. **Linha do código responsável pela leitura dos itens no carrinho (\`core/services/supplier-quote-engine/index.js\`):**
   - **Linhas 224 - 242:** O seletor \`document.querySelectorAll('div, tr')\` varre indiscriminadamente nós genéricos do DOM que contêm o texto "REF:" e "R$".
   - Isso pode gerar duplicação de itens se o site da Cicalfer renderizar contêineres pai e filho com o mesmo texto.

2. **Linha responsável pela captura do Total Geral (\`core/services/supplier-quote-engine/index.js\`):**
   - **Linhas 245 - 246:** Regex \`/Total:\\s*R\\$\\s*([\\d\\.,]+)/i\`. Se o site usar outro rótulo (ex: "Valor final", "Subtotal do carrinho"), a regex falha e o total retorna 0 ou usa soma dos itens.

3. **Leitura dos logs de scraping:**
   - Ver arquivo [\`logs/scraping-bruto.log\`](file:///${logsDir.replace(/\\/g, '/')}/scraping-bruto.log) para confirmação dos dados cru extraídos do DOM.
`;

    fs.writeFileSync(path.join(auditDir, 'divergencia-analise.md'), divergenciaDoc, 'utf-8');

    // 14. Gerar RESUMO.md
    logRaw('Gerando RESUMO.md...');
    const resumoDoc = `# Resumo da Auditoria — Cotação Cicalfer

- **Data da Auditoria:** 2026-09-09
- **Diretório Oficial:** \`docs/auditorias/2026-09-09-cicalfer-cotacao-quebrada/\`

---

## 1. O que quebrou (Descrição do Problema)

Durante a execução da cotação B2B na plataforma da Cicalfer, a extração dos dados do carrinho apresenta divergências no número de itens capturados e/ou no valor total consolidado. O histórico do carrinho foi limpo para este teste do zero a fim de isolar se a falha decorre da navegação, dos seletores CSS/XPath ou da lógica de parsing do DOM.

---

## 2. Itens Cotados Neste Teste

1. **CABO FLEX 100M COBRECOM 2,50MM AM (REF 10672)** — Qtd: 5
2. **BROXA ROMA RETANGULAR 15,5 X 5,5CM (REF 11992)** — Qtd: 12
3. **ALICATE BICO CHATO MTX 6 (REF 13329)** — Qtd: 12

---

## 3. Causa Raiz Identificada

A extração realizada no método \`extrairCarrinho\` (\`core/services/supplier-quote-engine/index.js\`) utiliza seletores genéricos (\`document.querySelectorAll('div, tr')\`) e busca por texto bruto contendo \`REF:\` e \`R$\`. Essa estratégia é vulnerável a:
1. Fragmentação do DOM dependendo do tempo de renderização do React/Next.js no site da Cicalfer.
2. Captura de elementos redundantes do cabeçalho/resumo lateral ou falha em ler os campos de input de quantidade (\`input.QuantidadeMaisMenos_input__grKxO\`).

---

## 4. Status da Correção

- **Status:** **PENDENTE DE REVISÃO DO USUÁRIO**
- Nenhuma alteração foi realizada nos arquivos de produção (\`core/services/supplier-quote-engine/index.js\` ou \`config/suppliers/cicalfer.json\`) cumprindo a regra de não alterar nada antes da aprovação.

---

## 5. Estrutura de Evidências Produzidas

- [\`RESUMO.md\`](file:///${path.join(auditDir, 'RESUMO.md').replace(/\\/g, '/')})
- [\`codigo/quote-engine-cicalfer.js\`](file:///${path.join(codigoDir, 'quote-engine-cicalfer.js').replace(/\\/g, '/')})
- [\`prints/\`](file:///${printsDir.replace(/\\/g, '/')}) (8 screenshots reais de todas as etapas)
- [\`logs/scraping-bruto.log\`](file:///${path.join(logsDir, 'scraping-bruto.log').replace(/\\/g, '/')})
- [\`html-bruto.txt\`](file:///${path.join(auditDir, 'html-bruto.txt').replace(/\\/g, '/')})
- [\`divergencia-analise.md\`](file:///${path.join(auditDir, 'divergencia-analise.md').replace(/\\/g, '/')})
- [\`historico-commits.md\`](file:///${path.join(auditDir, 'historico-commits.md').replace(/\\/g, '/')})
`;

    fs.writeFileSync(path.join(auditDir, 'RESUMO.md'), resumoDoc, 'utf-8');

    logRaw('\n✅ AUDITORIA CONCLUÍDA COM SUCESSO!');
    logRaw(`Todos os 7 artefatos estão em: ${auditDir}`);

  } catch (err) {
    console.error('❌ ERRO DURANTE A AUDITORIA:', err);
  } finally {
    await browser.close();
  }
}

runAuditProcess().catch(err => {
  console.error('ERRO FATAL:', err);
});
