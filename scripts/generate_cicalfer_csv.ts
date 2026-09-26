import * as fs from 'fs';
import * as path from 'path';

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function exportarAuditoriaCsvCicalfer() {
  console.log('📊 GERANDO CATALOGOS/CICALFER/AUDITORIA_COMPLETA.CSV (1.901 PRODUTOS COM ORIGEM E MÉTODO)...');

  const baseDir = path.join(process.cwd(), 'catalogos', 'cicalfer');
  const brutosPath = path.join(baseDir, 'produtos_brutos.json');
  const normPath = path.join(baseDir, 'produtos_normalizados.json');
  const csvPath = path.join(baseDir, 'auditoria_completa.csv');

  if (!fs.existsSync(brutosPath) || !fs.existsSync(normPath)) {
    throw new Error('Arquivos JSON de produtos brutos ou normalizados não encontrados!');
  }

  const brutos = JSON.parse(fs.readFileSync(brutosPath, 'utf-8'));
  const norm = JSON.parse(fs.readFileSync(normPath, 'utf-8'));

  const normMap = new Map<string, any>();
  norm.forEach((n: any) => {
    normMap.set(n.sku, n);
  });

  const rows: any[] = [];
  let countReal = 0;
  let countEstimado = 0;

  brutos.forEach((b: any) => {
    const n = normMap.get(b.sku) || {};

    const catSite = b.categoria_site || 'GERAL';
    let catPai = 'GERAL';
    let subcat = catSite;

    if (catSite.includes('>')) {
      const parts = catSite.split('>');
      catPai = parts[0].trim().toUpperCase();
      subcat = parts[1].trim();
    } else {
      catPai = catSite.trim().toUpperCase();
      subcat = catSite.trim();
    }

    const atributos = n.atributos || {};
    const precoNorm = n.precoNormalizado || {};
    const origemPreco = b.origem_preco || n.origem_preco || 'ESTIMADO';
    const metodoEstimativa = b.metodo_estimativa || n.metodo_estimativa || `Média categoria ${catPai} + fator variação SKU`;

    if (origemPreco === 'REAL') countReal++;
    else countEstimado++;

    rows.push({
      categoria_pai: catPai,
      subcategoria: subcat,
      nome_bruto: b.nome_original || '',
      nome_limpo: n.nome_limpo || atributos.nomeLimpo || b.nome_original || '',
      marca: atributos.marca || 'indisponível',
      diametro: atributos.diametro || 'indisponível',
      comprimento: atributos.comprimento || 'indisponível',
      unidade_venda: b.unidade_venda || '',
      preco_original: Number(b.preco || 0).toFixed(2),
      preco_normalizado: Number(precoNorm.precoUnitarioBase || b.preco || 0).toFixed(4),
      origem_preco: origemPreco,
      metodo_estimativa: metodoEstimativa,
    });
  });

  // Ordenar por categoria_pai e depois por subcategoria
  rows.sort((a, b) => {
    if (a.categoria_pai !== b.categoria_pai) {
      return a.categoria_pai.localeCompare(b.categoria_pai);
    }
    if (a.subcategoria !== b.subcategoria) {
      return a.subcategoria.localeCompare(b.subcategoria);
    }
    return a.nome_bruto.localeCompare(b.nome_bruto);
  });

  const headers = [
    'categoria_pai',
    'subcategoria',
    'nome_bruto',
    'nome_limpo',
    'marca',
    'diametro',
    'comprimento',
    'unidade_venda',
    'preco_original',
    'preco_normalizado',
    'origem_preco',
    'metodo_estimativa',
  ];

  const csvLines: string[] = [];
  csvLines.push(headers.map(escapeCsvCell).join(','));

  rows.forEach((r) => {
    const line = [
      escapeCsvCell(r.categoria_pai),
      escapeCsvCell(r.subcategoria),
      escapeCsvCell(r.nome_bruto),
      escapeCsvCell(r.nome_limpo),
      escapeCsvCell(r.marca),
      escapeCsvCell(r.diametro),
      escapeCsvCell(r.comprimento),
      escapeCsvCell(r.unidade_venda),
      escapeCsvCell(r.preco_original),
      escapeCsvCell(r.preco_normalizado),
      escapeCsvCell(r.origem_preco),
      escapeCsvCell(r.metodo_estimativa),
    ].join(',');
    csvLines.push(line);
  });

  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');

  console.log(`✅ CSV GERADO COM SUCESSO EM: ${csvPath}`);
  console.log(`📊 Total de produtos processados: ${rows.length}`);
  console.log(`📄 Total de linhas do CSV (Header + Produtos): ${csvLines.length}`);
  console.log(`  • REAL: ${countReal}`);
  console.log(`  • ESTIMADO: ${countEstimado}`);
}

exportarAuditoriaCsvCicalfer();
