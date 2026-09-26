import { db } from '../lib/db/client';
import { processarCotacaoFornecedor } from '../lib/services/automacao/matchingEngine';
import * as fs from 'fs';
import * as path from 'path';

async function runComparativeAudit() {
  console.log('=== INICIANDO AUDITORIA COMPARATIVA E2E (COFEMA, CICALFER, CONSTRUJÁ) ===');

  const folderName = '2026-09-25_16h45_teste-real-chave-inglesa';
  const auditDir = path.join(process.cwd(), 'docs', 'auditorias', 'historico', folderName);
  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }

  // IDs dos 3 Fornecedores no Supabase DB
  const FORNECEDORES = [
    { id: '752e18bd-4f41-414a-8f66-0d8f538de99e', name: 'Cofema', slug: 'cofema' },
    { id: '33e03495-100d-45a3-9e34-899de56b0ab1', name: 'Cicalfer', slug: 'cicalfer' },
    { id: 'a1684c4d-d896-4ba9-a591-cda455c5ffe2', name: 'Construjá', slug: 'construja' },
  ];

  // 1. Criar Cotação Limpa no DB para os 3 fornecedores
  const novaCotacao = await db.cotacoes.create({
    cliente: 'Auditoria Comparativa 3 Fornecedores - Chave Inglesa',
    status: 'rascunho',
    itens: [
      {
        id: 'item-1',
        material: 'Chave Inglesa 12 Brasfort',
        quantidade: 5,
        skuFornecedor: '296511',
        unidade: 'UN',
        marcaRecomendada: 'Brasfort'
      }
    ]
  });
  console.log(`[AUDIT MULTI] Cotação criada com ID: ${novaCotacao.id}`);

  // Configurar gravação de Log RAW
  const logFilePath = path.join(auditDir, 'execucao_raw.log');
  const logStream = fs.createWriteStream(logFilePath, { flags: 'w' });

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  function writeLog(prefix: string, args: any[]) {
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ');
    const line = `[${new Date().toISOString()}] ${prefix} ${msg}\n`;
    logStream.write(line);
    process.stdout.write(line);
  }

  console.log = (...args: any[]) => writeLog('[INFO]', args);
  console.error = (...args: any[]) => writeLog('[ERROR]', args);
  console.warn = (...args: any[]) => writeLog('[WARN]', args);

  // Hook em salvarResultadosMatching para capturar os JSONs BRUTOS passados para persistência
  const rawJsonPerSupplier: Record<string, any> = {};
  const originalSalvarResultadosMatching = db.cotacoes.salvarResultadosMatching;

  db.cotacoes.salvarResultadosMatching = async function(cotacaoId: string, fornecedorId: string, resultados: any[]) {
    console.log(`\n======================================================`);
    console.log(`[RAW JSON MATCHING HOOK] Fornecedor: ${fornecedorId} | CotacaoId: ${cotacaoId}`);
    console.log(`JSON BRUTO PASSDO PARA salvarResultadosMatching:`);
    console.log(JSON.stringify(resultados, null, 2));
    console.log(`======================================================\n`);

    rawJsonPerSupplier[fornecedorId] = resultados;
    return await originalSalvarResultadosMatching.call(db.cotacoes, cotacaoId, fornecedorId, resultados);
  };

  // Hook no quoteEngine para capturar screenshots reais do carrinho de cada fornecedor
  const quoteEngine = require('../core/services/supplier-quote-engine');
  
  // Hook Cofema
  const origCofemaExtrair = quoteEngine.cofemaExtrairCarrinho;
  quoteEngine.cofemaExtrairCarrinho = async function(page: any, config: any) {
    const res = await origCofemaExtrair(page, config);
    try {
      await page.waitForTimeout(2000);
      const screenshotPath = path.join(auditDir, '01_carrinho_real_cofema.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[AUDIT SCREENSHOT ✅] 01_carrinho_real_cofema.png salva em: ${screenshotPath}`);
    } catch (e: any) {
      console.error(`[AUDIT SCREENSHOT ❌] Erro ao tirar print Cofema: ${e.message}`);
    }
    return res;
  };

  // Hook Genérico extrairCarrinho (para Cicalfer e Construjá)
  const origExtrairCarrinho = quoteEngine.extrairCarrinho;
  quoteEngine.extrairCarrinho = async function(page: any, config: any) {
    const res = await origExtrairCarrinho(page, config);
    const slug = (config.slug || 'fornecedor').toLowerCase();
    try {
      await page.waitForTimeout(2000);
      let filename = `carrinho_real_${slug}.png`;
      if (slug.includes('cicalfer')) filename = '02_carrinho_real_cicalfer.png';
      if (slug.includes('construja')) filename = '03_carrinho_real_construja.png';
      
      const screenshotPath = path.join(auditDir, filename);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[AUDIT SCREENSHOT ✅] ${filename} salva em: ${screenshotPath}`);
    } catch (e: any) {
      console.error(`[AUDIT SCREENSHOT ❌] Erro ao tirar print ${slug}: ${e.message}`);
    }
    return res;
  };

  const resultadosFinais: Record<string, any> = {};

  // Executar cotação sequencialmente para os 3 fornecedores
  for (const forn of FORNECEDORES) {
    console.log(`\n\n================================================================`);
    console.log(`>>> INICIANDO COTAÇÃO DO FORNECEDOR: ${forn.name} (${forn.id}) <<<`);
    console.log(`================================================================\n`);

    try {
      const res = await processarCotacaoFornecedor(novaCotacao.id, forn.id, async (msg: string) => {
        console.log(`[PROGRESS - ${forn.name}] ${msg}`);
      });
      resultadosFinais[forn.slug] = res;
    } catch (err: any) {
      console.error(`❌ EXCEÇÃO AO PROCESSAR FORNECEDOR ${forn.name}:`, err.stack || err.message);
      resultadosFinais[forn.slug] = { sucesso: false, erro: err.message };
    }
  }

  console.log(`\n================================================================`);
  console.log(`=== TODOS OS FORNECEDORES CONCLUÍDOS ===`);
  console.log(`================================================================`);
  console.log(JSON.stringify(resultadosFinais, null, 2));

  // Tirar Screenshot 04_modal_resumo_saracota.png
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const screenshotPathSaracota = path.join(auditDir, '04_modal_resumo_saracota.png');

  try {
    const targetUrl = `http://localhost:3000/cotacoes/${novaCotacao.id}`;
    console.log(`[AUDIT] Acessando UI da Saracota em ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: screenshotPathSaracota, fullPage: true });
    console.log(`[AUDIT ✅] Screenshot 04_modal_resumo_saracota.png capturada em: ${screenshotPathSaracota}`);
  } catch (err: any) {
    console.error(`[AUDIT ❌] Erro ao capturar screenshot Saracota: ${err.message}`);
  } finally {
    await browser.close();
  }

  // Restaurar console
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
  logStream.end();

  // Salvar raw_matching_json.json no diretório de auditoria
  fs.writeFileSync(
    path.join(auditDir, 'raw_matching_json.json'),
    JSON.stringify(rawJsonPerSupplier, null, 2),
    'utf8'
  );

  // Gerar RESUMO.md
  const resumoMd = `# Relatório de Auditoria Comparativa E2E - 3 Fornecedores (Chave Inglesa)

**Data/Hora**: 2026-09-25
**Cotação ID**: \`${novaCotacao.id}\`
**Diretório de Auditoria**: \`docs/auditorias/historico/${folderName}/\`

---

## 1. Quadro Comparativo de Desempenho

| Fornecedor | Status | Produto Encontrado no Carrinho | Preço Unit. | Total |
| :--- | :---: | :--- | :---: | :---: |
| **Cofema** | ${resultadosFinais.cofema?.sucesso ? '✅ SUCESSO' : '❌ FALHA'} | ${resultadosFinais.cofema?.itensProcessados?.[0]?.produtoEncontrado || 'N/A'} | R$ ${(resultadosFinais.cofema?.itensProcessados?.[0]?.preco || 0).toFixed(2)} | R$ ${((resultadosFinais.cofema?.itensProcessados?.[0]?.preco || 0) * 5).toFixed(2)} |
| **Cicalfer** | ${resultadosFinais.cicalfer?.sucesso ? '✅ SUCESSO' : '❌ FALHA / NAO ENCONTRADO'} | ${resultadosFinais.cicalfer?.itensProcessados?.[0]?.produtoEncontrado || 'Nenhum'} | R$ ${(resultadosFinais.cicalfer?.itensProcessados?.[0]?.preco || 0).toFixed(2)} | R$ ${((resultadosFinais.cicalfer?.itensProcessados?.[0]?.preco || 0) * 5).toFixed(2)} |
| **Construjá** | ${resultadosFinais.construja?.sucesso ? '✅ SUCESSO' : '❌ FALHA'} | ${resultadosFinais.construja?.itensProcessados?.[0]?.produtoEncontrado || 'N/A'} | R$ ${(resultadosFinais.construja?.itensProcessados?.[0]?.preco || 0).toFixed(2)} | R$ ${((resultadosFinais.construja?.itensProcessados?.[0]?.preco || 0) * 5).toFixed(2)} |

---

## 2. Evidências em Imagens Reais (Screenshots)

1. **Carrinho Real Portal Cofema**:
   ![01_carrinho_real_cofema.png](file:///${path.join(auditDir, '01_carrinho_real_cofema.png').replace(/\\/g, '/')})

2. **Carrinho Real / Grade Portal Cicalfer**:
   ![02_carrinho_real_cicalfer.png](file:///${path.join(auditDir, '02_carrinho_real_cicalfer.png').replace(/\\/g, '/')})

3. **Carrinho Real Portal Construjá**:
   ![03_carrinho_real_construja.png](file:///${path.join(auditDir, '03_carrinho_real_construja.png').replace(/\\/g, '/')})

4. **Modal Resumo da Saracota (localhost:3000)**:
   ![04_modal_resumo_saracota.png](file:///${screenshotPathSaracota.replace(/\\/g, '/')})

---

## 3. Logs RAW e JSONs Brutos de Entrada no Banco

- **Log RAW sem cortes**: [execucao_raw.log](file:///${logFilePath.replace(/\\/g, '/')})
- **JSON Bruto da Função \`salvarResultadosMatching\`**: [raw_matching_json.json](file:///${path.join(auditDir, 'raw_matching_json.json').replace(/\\/g, '/')})
`;

  fs.writeFileSync(path.join(auditDir, 'RESUMO.md'), resumoMd, 'utf8');
  console.log(`[AUDIT COMPREHENSIVE ✅] Auditoria finalizada e salva em: ${auditDir}`);
}

runComparativeAudit().catch(err => {
  console.error('ERRO FATAL NA AUDITORIA COMPARATIVA:', err);
  process.exit(1);
});
