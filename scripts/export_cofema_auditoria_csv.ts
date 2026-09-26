import * as fs from 'fs';
import * as path from 'path';
import { normalizarAtributosProduto } from '../lib/services/normalizer/attributeNormalizer';

export function generateCofemaAuditoriaCSV() {
  const baseDir = path.join(process.cwd(), 'catalogos', 'cofema');
  const brutosPath = path.join(baseDir, 'produtos_brutos.json');
  const auditDir = path.join(baseDir, 'auditoria');

  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }

  const csvPath = path.join(auditDir, 'auditoria_completa.csv');
  const csvPathRoot = path.join(baseDir, 'auditoria_completa.csv');

  if (!fs.existsSync(brutosPath)) {
    console.error(`❌ File not found: ${brutosPath}`);
    return;
  }

  const rawData: any[] = JSON.parse(fs.readFileSync(brutosPath, 'utf-8'));
  console.log(`📌 Processing ${rawData.length} products for Cofema Auditoria CSV...`);

  // Columns: categoria_pai, subcategoria, nome_bruto, nome_limpo, marca, sku, preco, unidade_venda, url_produto
  const headers = [
    'categoria_pai',
    'subcategoria',
    'nome_bruto',
    'nome_limpo',
    'marca',
    'sku',
    'preco',
    'unidade_venda',
    'url_produto'
  ];

  const escapeCSV = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows: string[] = [headers.join(',')];

  rawData.forEach(item => {
    const rawCat = item.categoria_site || '';
    const catPaiRaw = rawCat.replace(/^GERAL\s*>\s*/i, '').trim();
    
    const attrs = normalizarAtributosProduto(item.nome_original, item.categoria_site);
    
    const catPai = attrs.categoriaPai || catPaiRaw || 'GERAL';
    const subcat = attrs.subcategoria || catPaiRaw || 'GERAL';
    const nomeBruto = item.nome_original;
    const nomeLimpo = attrs.nomeLimpo || item.nome_original;
    const marca = attrs.marca || 'indisponível';
    const sku = item.sku;
    const preco = (item.preco || 0).toFixed(2);
    const unidadeVenda = item.unidade_venda || 'UN (EMB: 1)';
    const urlProduto = item.url_produto || '';

    rows.push([
      escapeCSV(catPai),
      escapeCSV(subcat),
      escapeCSV(nomeBruto),
      escapeCSV(nomeLimpo),
      escapeCSV(marca),
      escapeCSV(sku),
      escapeCSV(preco),
      escapeCSV(unidadeVenda),
      escapeCSV(urlProduto)
    ].join(','));
  });

  const csvContent = rows.join('\n');
  fs.writeFileSync(csvPath, csvContent, 'utf-8');
  fs.writeFileSync(csvPathRoot, csvContent, 'utf-8');

  console.log(`✅ CSV Auditoria Cofema gerado com sucesso!`);
  console.log(`📍 Path 1: ${csvPath}`);
  console.log(`📍 Path 2: ${csvPathRoot}`);
  console.log(`📊 Total de Linhas: ${rawData.length}`);
}

if (require.main === module) {
  generateCofemaAuditoriaCSV();
}
