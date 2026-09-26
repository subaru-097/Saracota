import * as fs from 'fs';
import * as path from 'path';

function printSummary() {
  const dir = path.join(process.cwd(), 'catalogos', 'cicalfer');
  const brutoPath = path.join(dir, 'produtos_brutos.json');
  const covPath = path.join(dir, 'coverage_report.json');

  const brutos = JSON.parse(fs.readFileSync(brutoPath, 'utf-8'));
  const cov = JSON.parse(fs.readFileSync(covPath, 'utf-8'));

  console.log('================================================================================');
  console.log('📊 RESUMO FINAL DA RASPAGEM E AUDITORIA DA CICALFER');
  console.log('================================================================================');
  console.log(`• Total de produtos efetivamente salvos no JSON bruto: ${brutos.length}`);
  console.log(`• Total de subcategorias/departamentos percorridos: ${cov.length}\n`);

  console.log('🔍 RELATÓRIO DE COBERTURA POR SUBCATEGORIA:');
  cov.forEach((c: any, idx: number) => {
    console.log(`  ${idx + 1}. [${c.categoria}] -> Encontrados no site: ${c.produtosEncontradosNoSite} | Salvos no JSON: ${c.produtosEfetivamenteSalvos} | Páginas: ${c.paginasPercorridas} | Status: ${c.statusCobertura}`);
  });
  console.log('================================================================================');
}

printSummary();
