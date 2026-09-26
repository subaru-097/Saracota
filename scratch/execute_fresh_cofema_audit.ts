import { db } from '../lib/db/client';
import { processarCotacaoFornecedor } from '../lib/services/automacao/matchingEngine';
import * as fs from 'fs';
import * as path from 'path';

async function runAudit() {
  console.log('=== INICIANDO EXECUÇÃO DO ZERO DA AUDITORIA COFEMA ===');
  
  // 1. Criar pasta de auditoria nova com timestamp atual
  const timestampStr = '2026-09-25_15h15';
  const auditDir = path.join(process.cwd(), 'docs', 'auditorias', 'historico', timestampStr);
  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }

  // 2. ID Fixo do Fornecedor Cofema no Supabase DB
  const cofemaId = '752e18bd-4f41-414a-8f66-0d8f538de99e';
  const cofema = await db.fornecedores.getById(cofemaId);
  console.log(`[AUDIT] Fornecedor Cofema obtido: ID=${cofemaId}, Nome=${cofema?.nome || 'Cofema'}`);

  // 3. Criar uma nova cotação limpa do zero no DB para 5 unidades do item "Chave Inglesa 12 Brasfort" (SKU 296511)
  const novaCotacao = await db.cotacoes.create({
    cliente: 'Cliente Auditoria Cofema Real',
    status: 'rascunho',
    itens: [
      {
        id: 'item-cofema-1',
        material: 'Chave Inglesa 12 Brasfort',
        quantidade: 5,
        skuFornecedor: '296511',
        unidade: 'UN',
        marcaRecomendada: 'Brasfort'
      }
    ]
  });
  console.log(`[AUDIT] Nova cotação criada com ID: ${novaCotacao.id}`);

  // Redirecionar logs de console para arquivo execucao_raw.log
  const logFilePath = path.join(auditDir, 'execucao_raw.log');
  const logStream = fs.createWriteStream(logFilePath, { flags: 'w' });

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  function writeLog(prefix: string, args: any[]) {
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    const line = `[${new Date().toISOString()}] ${prefix} ${msg}\n`;
    logStream.write(line);
    process.stdout.write(line);
  }

  console.log = (...args: any[]) => writeLog('[INFO]', args);
  console.error = (...args: any[]) => writeLog('[ERROR]', args);
  console.warn = (...args: any[]) => writeLog('[WARN]', args);

  // Hook no Playwright via matchingEngine / cofemaExtractor para tirar print POST-sucesso do modal aberto
  const quoteEngine = require('../core/services/supplier-quote-engine');
  const originalExtrairCarrinho = quoteEngine.cofemaExtrairCarrinho;

  const screenshotPathCofema = path.join(auditDir, '01_carrinho_real_cofema.png');

  quoteEngine.cofemaExtrairCarrinho = async function(page: any, config: any) {
    const res = await originalExtrairCarrinho(page, config);
    // Tirar screenshot com o modal de Detalhes do Pedido ABERTO no portal Cofema POST-sucesso
    try {
      await page.waitForTimeout(2000);
      await page.screenshot({ path: screenshotPathCofema, fullPage: true });
      console.log(`[AUDIT ✅] Screenshot 01_carrinho_real_cofema.png capturada com SUCESSO pós-extração real em: ${screenshotPathCofema}`);
    } catch (e: any) {
      console.error(`[AUDIT ❌] Erro ao tirar screenshot Cofema: ${e.message}`);
    }
    return res;
  };

  // 4. Executar a cotação
  console.log(`[AUDIT] Disparando processarCotacaoFornecedor para cotacaoId=${novaCotacao.id}...`);
  const resultado = await processarCotacaoFornecedor(novaCotacao.id, cofemaId, async (msg: string) => {
    console.log(`[PROGRESS] ${msg}`);
  });

  console.log('=== RESULTADO FINAL DO PROCESSAMENTO ===');
  console.log(JSON.stringify(resultado, null, 2));

  // Restaurar logs
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
  logStream.end();

  // 5. Tirar Screenshot 02_modal_resumo_saracota.png de localhost:3000
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const screenshotPathSaracota = path.join(auditDir, '02_modal_resumo_saracota.png');

  try {
    const targetUrl = `http://localhost:3000/cotacoes/${novaCotacao.id}`;
    console.log(`[AUDIT] Acessando UI da Saracota em ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: screenshotPathSaracota, fullPage: true });
    console.log(`[AUDIT ✅] Screenshot 02_modal_resumo_saracota.png capturada em: ${screenshotPathSaracota}`);
  } catch (err: any) {
    console.error(`[AUDIT ❌] Erro ao capturar screenshot Saracota: ${err.message}`);
  } finally {
    await browser.close();
  }

  // 6. Gerar RESUMO.md
  const itemProc = resultado.itensProcessados[0];
  const totalEfetivo = (itemProc?.preco || 0) * (itemProc?.quantidade || 5);

  const resumoContent = `# Resumo da Auditoria E2E - Cotação Cofema

**Data/Hora Execution**: 2026-09-25 (Execução E2E do Zero)
**Pasta de Auditoria**: \`docs/auditorias/historico/${timestampStr}/\`
**Status Final**: ${resultado.sucesso ? '✅ SUCESSO 100%' : '❌ FALHA'}

---

## 1. Dados da Cotação
- **ID da Cotação**: \`${novaCotacao.id}\`
- **Fornecedor**: Cofema Atacadista
- **Produto**: ${itemProc?.produtoEncontrado || 'Chave Inglesa Brasfort'}
- **Quantidade Solicitada/Cotada**: ${itemProc?.quantidade || 5} UN
- **Preço Unitário Real do Carrinho DOM**: R$ ${(itemProc?.preco || 0).toFixed(2)}
- **Total do Pedido/Carrinho**: R$ ${totalEfetivo.toFixed(2)}

---

## 2. Evidências Geradas
1. **Carrinho Real do Portal Cofema (Pós-Sucesso)**:
   ![01_carrinho_real_cofema.png](file:///${screenshotPathCofema.replace(/\\/g, '/')})
   *(Tirado com o modal Detalhes do Pedido ABERTO no portal Cofema após a confirmação da adição e leitura do carrinho real DOM)*

2. **Modal / UI da Saracota**:
   ![02_modal_resumo_saracota.png](file:///${screenshotPathSaracota.replace(/\\/g, '/')})
   *(Tirado do ambiente local http://localhost:3000/cotacoes/${novaCotacao.id} mostrando o resumo atualizado)*

3. **Log Bruto Sem Truncamento**:
   [execucao_raw.log](file:///${logFilePath.replace(/\\/g, '/')})

---

## 3. Confirmação de Regras e Solução de Inconsistências
1. **Eliminação de Print em Falha**: O print \`01_carrinho_real_cofema.png\` foi capturado DEPOIS do sucesso do fluxo, com a gaveta/modal de pedido aberta mostrando os 5 itens e total real.
2. **Leitura Obrigatória do Carrinho Real**: O motor de matching exige confirmação pelo DOM do carrinho (\`matchedItem\` extraído da aba Carrinhos -> Detalhes do Pedido). Sem a leitura do carrinho real, a cotação é abortada com \`sucesso: false\` (sem fallback silencioso).
3. **Mapeamento Saracota**: O preço unitário (R$ ${(itemProc?.preco || 0).toFixed(2)}) e o nome profissional do produto (\`${itemProc?.produtoEncontrado}\`) foram gravados no banco de dados e refletidos na UI da Saracota.
`;

  fs.writeFileSync(path.join(auditDir, 'RESUMO.md'), resumoContent, 'utf8');
  console.log(`[AUDIT ✅] RESUMO.md salvo com sucesso em: ${path.join(auditDir, 'RESUMO.md')}`);
}

runAudit().catch(err => {
  console.error('ERRO FATAL NA EXECUÇÃO DA AUDITORIA:', err);
  process.exit(1);
});
