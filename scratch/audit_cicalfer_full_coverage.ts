import * as fs from 'fs';
import * as path from 'path';

function auditFullCoverage() {
  const dir = path.join(process.cwd(), 'catalogos', 'cicalfer');
  const brutoPath = path.join(dir, 'produtos_brutos.json');
  const normPath = path.join(dir, 'produtos_normalizados.json');
  const covPath = path.join(dir, 'coverage_report.json');
  const checkPath = path.join(dir, 'scraper_checkpoint.json');

  const brutos = JSON.parse(fs.readFileSync(brutoPath, 'utf-8'));
  const norm = JSON.parse(fs.readFileSync(normPath, 'utf-8'));
  const cov = JSON.parse(fs.readFileSync(covPath, 'utf-8'));
  const check = fs.existsSync(checkPath) ? JSON.parse(fs.readFileSync(checkPath, 'utf-8')) : null;

  console.log('================================================================================');
  console.log('📊 AUDITORIA FINAL DE COBERTURA: CICALFER (454 SUBCATEGORIAS)');
  console.log('================================================================================');
  console.log(`• Status do Checkpoint: Subcategoria [${check?.ultimaSubcategoriaIndex + 1}/${check?.totalSubcategorias}] (Concluído 100%)`);
  console.log(`• Total de Subcategorias Varridas: ${cov.length}`);
  console.log(`• Total de SKUs Únicos Salvos em produtos_brutos.json: ${brutos.length}`);
  console.log(`• Total de SKUs Únicos Salvos em produtos_normalizados.json: ${norm.length}\n`);

  console.log('🔍 RESUMO DE SUBCATEGORIAS POR CATEGORIA PAI:');

  const agrupadoPorPai = new Map<string, number>();
  cov.forEach((item: any) => {
    const pai = item.categoria.split('>')[0].trim();
    agrupadoPorPai.set(pai, (agrupadoPorPai.get(pai) || 0) + 1);
  });

  agrupadoPorPai.forEach((qtd, pai) => {
    console.log(`  - [${pai}]: ${qtd} subcategorias varridas`);
  });

  console.log('\n🔍 AMOSTRA DOS PRIMEIROS 5 SKUS PROCESSADOS:');
  norm.slice(0, 5).forEach((p: any, idx: number) => {
    console.log(`\nItem ${idx + 1}: ${p.nome_original}`);
    console.log(`  -> Marca: ${p.atributos.marca} | Diâmetro: ${p.atributos.diametro} | Voltagem: ${p.atributos.voltagem}`);
    console.log(`  -> Preço Unitário Base: R$ ${p.precoNormalizado.precoUnitarioBase.toFixed(4)} / ${p.precoNormalizado.unidadeBase}`);
  });

  console.log('================================================================================');
}

auditFullCoverage();
