import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { db, supabase } from '../lib/db/client';
import { processarCotacaoFornecedor, processarCotacaoTodosFornecedores } from '../lib/services/automacao/matchingEngine';

interface SupplierTiming {
  fornecedorId: string;
  fornecedorNome: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  sucesso: boolean;
  itemCount: number;
}

interface ScenarioResult {
  cenario: string;
  supplierCount: number;
  fornecedoresNomes: string[];
  startTime: string;
  endTime: string;
  totalDurationMs: number;
  totalDurationSec: number;
  avgDurationPerSupplierMs: number;
  cpuUsageBefore: { user: number; system: number };
  cpuUsageAfter: { user: number; system: number };
  memHeapUsedMB: number;
  memHeapTotalMB: number;
  sysFreeMemMB: number;
  sysTotalMemMB: number;
  supplierTimings: SupplierTiming[];
}

const SUPPLIERS_POOL = [
  { id: 'a4042203-b504-4a82-af41-8ffa19ae24a6', nome: 'Mercadão Lojista' },
  { id: 'a1684c4d-d896-4ba9-a591-cda455c5ffe2', nome: 'Construjá' },
  { id: '752e18bd-4f41-414a-8f66-0d8f538de99e', nome: 'Cofema' },
  { id: '33e03495-100d-45a3-9e34-899de56b0ab1', nome: 'Cicalfer' },
  { id: '0e75b26e-6ff7-4fb0-a783-897ca1224f48', nome: 'Megaleste' }
];

async function runBenchmarkScenario(count: number): Promise<ScenarioResult> {
  const activeSuppliers = SUPPLIERS_POOL.slice(0, count);
  const fornIds = activeSuppliers.map(s => s.id);
  const fornNomes = activeSuppliers.map(s => s.nome);

  console.log(`\n================================================================`);
  console.log(`INICIANDO CENÁRIO DE BENCHMARK COM ${count} FORNECEDOR(ES)`);
  console.log(`Fornecedores: ${fornNomes.join(', ')}`);
  console.log(`================================================================`);

  // 1. Criar cotação no banco
  const quoteRecord = await db.cotacoes.create({
    obraNome: `Benchmark Concorrência - ${count} Fornecedores (${new Date().toLocaleTimeString()})`,
    fornecedor_id: fornIds[0],
    fornecedorIds: fornIds,
    fornecedores_selecionados: fornIds,
    status: 'pendente',
    itens: [
      {
        material: 'Chave Combinada 27mm',
        quantidade: 15,
        unidade: 'un',
        categoria: 'ferramentas'
      }
    ]
  });

  const startCpu = process.cpuUsage();
  const startTimeMs = Date.now();
  const startTimeIso = new Date().toISOString();

  const supplierTimings: SupplierTiming[] = [];

  // Disparar processamento para os fornecedores
  console.log(`Cotacao ID: ${quoteRecord.id} | Disparando processamento...`);

  for (const forn of activeSuppliers) {
    const fStart = Date.now();
    console.log(`  ➔ Iniciando ${forn.nome}...`);

    let sucesso = false;
    let itemCount = 0;

    try {
      const res = await processarCotacaoFornecedor(quoteRecord.id, forn.id, async (msg: string) => {
        // quiet log
      });
      sucesso = res.sucesso;
      itemCount = res.itensProcessados.length;
    } catch (err: any) {
      console.warn(`  ⚠️ Falha em ${forn.nome}: ${err.message}`);
    }

    const fEnd = Date.now();
    supplierTimings.push({
      fornecedorId: forn.id,
      fornecedorNome: forn.nome,
      startTime: fStart,
      endTime: fEnd,
      durationMs: fEnd - fStart,
      sucesso,
      itemCount
    });

    console.log(`  ✅ ${forn.nome} finalizado em ${((fEnd - fStart) / 1000).toFixed(2)}s | Sucesso: ${sucesso}`);
  }

  const endTimeMs = Date.now();
  const endTimeIso = new Date().toISOString();
  const endCpu = process.cpuUsage(startCpu);
  const totalDurationMs = endTimeMs - startTimeMs;

  const mem = process.memoryUsage();
  const sysFree = os.freemem();
  const sysTotal = os.totalmem();

  const result: ScenarioResult = {
    cenario: `Cenário ${count}: ${count} Fornecedor(es)`,
    supplierCount: count,
    fornecedoresNomes: fornNomes,
    startTime: startTimeIso,
    endTime: endTimeIso,
    totalDurationMs,
    totalDurationSec: Number((totalDurationMs / 1000).toFixed(2)),
    avgDurationPerSupplierMs: Number((totalDurationMs / count).toFixed(2)),
    cpuUsageBefore: { user: startCpu.user, system: startCpu.system },
    cpuUsageAfter: { user: endCpu.user, system: endCpu.system },
    memHeapUsedMB: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
    memHeapTotalMB: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
    sysFreeMemMB: Number((sysFree / 1024 / 1024).toFixed(2)),
    sysTotalMemMB: Number((sysTotal / 1024 / 1024).toFixed(2)),
    supplierTimings
  };

  console.log(`\n📊 FIM DO CENÁRIO ${count}: Tempo Total = ${result.totalDurationSec}s | Média por Fornecedor = ${(result.avgDurationPerSupplierMs / 1000).toFixed(2)}s`);
  return result;
}

async function runAllDiagnostics() {
  console.log('================================================================');
  console.log('BENCHMARK E DIAGNÓSTICO TÉCNICO DE CONCORRÊNCIA DA SARA COTA');
  console.log('================================================================');
  console.log('CPUs da máquina:', os.cpus().length, 'cores');
  console.log('Modelo de CPU:', os.cpus()[0]?.model);
  console.log('Memória Total:', (os.totalmem() / 1024 / 1024 / 1024).toFixed(2), 'GB');

  const results: ScenarioResult[] = [];

  // Cenário 1: 1 fornecedor (Mercadão Lojista)
  results.push(await runBenchmarkScenario(1));

  // Cenário 2: 2 fornecedores (Mercadão + Construjá)
  results.push(await runBenchmarkScenario(2));

  // Cenário 3: 3 fornecedores (Mercadão + Construjá + Cofema)
  results.push(await runBenchmarkScenario(3));

  // Cenário 4: 4 fornecedores (Mercadão + Construjá + Cofema + Cicalfer)
  results.push(await runBenchmarkScenario(4));

  // Cenário 5: 5 fornecedores (Mercadão + Construjá + Cofema + Cicalfer + Megaleste)
  results.push(await runBenchmarkScenario(5));

  // Gravar resultados em JSON e Markdown
  const timestampDir = `diagnostico_performance_${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const outputDir = path.join(process.cwd(), 'docs', 'auditorias', 'historico', timestampDir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jsonPath = path.join(outputDir, 'resultados_benchmark.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  console.log(`\n✅ Diagnóstico concluído! Resultados salvos em: ${jsonPath}`);
}

runAllDiagnostics().catch(console.error);
