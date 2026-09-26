import * as fs from 'fs';
import * as path from 'path';
import { normalizarAtributosProduto } from '../lib/services/normalizer/attributeNormalizer';

export function generateConstrujaAuditoriaCSV() {
  const baseDir = path.join(process.cwd(), 'catalogos', 'construja');
  const brutosPath = path.join(baseDir, 'produtos_brutos.json');
  const auditDir = path.join(baseDir, 'auditoria');

  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }

  const csvPath = path.join(auditDir, 'auditoria_completa.csv');
  const csvPathRoot = path.join(baseDir, 'auditoria_completa.csv');
  const normPath = path.join(baseDir, 'produtos_normalizados.json');

  if (!fs.existsSync(brutosPath)) {
    console.error(`❌ Arquivo não encontrado: ${brutosPath}`);
    return;
  }

  const rawData: any[] = JSON.parse(fs.readFileSync(brutosPath, 'utf-8'));
  console.log(`📌 Processando ${rawData.length} produtos para CSV de Auditoria Construjá...`);

  const headers = [
    'categoria_pai',
    'subcategoria',
    'nome_bruto',
    'nome_limpo',
    'marca',
    'sku',
    'preco',
    'unidade_venda',
    'estoque',
    'url_produto'
  ];

  const escapeCSV = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows: string[] = [headers.join(',')];
  const normalizedList: any[] = [];

  rawData.forEach(item => {
    const attrs = normalizarAtributosProduto(item.nome_original || item.nome_bruto, item.categoria_site);
    
    // Extrair categoria_site se disponível (ex: "GERAL > ABRASIVOS")
    let siteCategory = '';
    if (item.categoria_site && item.categoria_site.includes('>')) {
      const parts = item.categoria_site.split('>');
      siteCategory = parts[parts.length - 1].trim();
    }

    let brand = item.marca || attrs.marca;
    if (!brand || brand === 'indisponível') {
      const brandMatch = (item.nome_original || item.nome_bruto || '').match(/^([^-]+)\s*-\s*/);
      brand = brandMatch ? brandMatch[1].trim() : (item.nome_original || '').split(' ')[0];
    }

    const catPai = (attrs.categoriaPai && attrs.categoriaPai !== 'GERAL') 
      ? attrs.categoriaPai 
      : (siteCategory || item.categoria_pai || 'GERAL');

    const subcat = (attrs.subcategoria && attrs.subcategoria !== 'GERAL') 
      ? attrs.subcategoria 
      : catPai;

    const nomeBruto = item.nome_original || item.nome_bruto || '';
    const nomeLimpo = attrs.nomeLimpo || nomeBruto;
    const sku = item.sku || `CON-${item.id}`;
    const preco = typeof item.preco === 'number' ? item.preco.toFixed(2) : (item.preco || '0.00');
    const unidadeVenda = item.unidade_venda || item.embalagem || 'UN (EMB: 1)';
    const estoque = item.estoque || 'Disponível';
    const urlProduto = item.url_produto || '';

    rows.push([
      escapeCSV(catPai),
      escapeCSV(subcat),
      escapeCSV(nomeBruto),
      escapeCSV(nomeLimpo),
      escapeCSV(brand),
      escapeCSV(sku),
      escapeCSV(preco),
      escapeCSV(unidadeVenda),
      escapeCSV(estoque),
      escapeCSV(urlProduto)
    ].join(','));

    normalizedList.push({
      sku,
      nome_original: nomeBruto,
      atributos: { ...attrs, marca: brand, nomeLimpo },
      precoNormalizado: { preco_unitario: parseFloat(preco) || 0, unidade: unidadeVenda },
      categoria_site: item.categoria_site || `GERAL > ${catPai.toUpperCase()}`,
      url_produto: urlProduto,
      scraped_at: item.scraped_at || new Date().toISOString()
    });
  });

  const csvContent = rows.join('\n');
  fs.writeFileSync(csvPath, csvContent, 'utf-8');
  fs.writeFileSync(csvPathRoot, csvContent, 'utf-8');
  fs.writeFileSync(normPath, JSON.stringify(normalizedList, null, 2), 'utf-8');

  console.log(`✅ CSV Auditoria Construjá gerado com sucesso!`);
  console.log(`📍 Path 1: ${csvPath}`);
  console.log(`📍 Path 2: ${csvPathRoot}`);
  console.log(`📊 Total de Linhas: ${rawData.length}`);
}

if (require.main === module) {
  generateConstrujaAuditoriaCSV();
}
