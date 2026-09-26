import * as fs from 'fs';
import * as path from 'path';
import { ProdutoBrutoScraped } from '../catalogos/catalogManager';
import { generateCofemaAuditoriaCSV } from './export_cofema_auditoria_csv';

const COFEMA_SLUG = 'cofema';

interface CategoryReport {
  categoryName: string;
  code: string;
  totalEsperado: number;
  totalColetado: number;
  totalUnicos: number;
  coveragePercent: number;
  status: 'COMPLETO' | 'INCOMPLETO';
  warning?: string;
}

interface CofemaApiRecord {
  codigo: string;
  descricao: string;
  descricaoCompleta?: string;
  tipoGrupoCodigo?: string;
  tipoGrupoDescricao?: string;
  grupoCodigo?: string;
  grupoDescricao?: string;
  agrupamento?: string;
  marcaCodigo?: string;
  marcaDescricao?: string;
  precoVenda?: number | null;
  precoPromocao?: number | null;
  quantidadeEmbalagem?: number;
  multiploVenda?: number;
  codigoBarras?: string;
  fornecedorCodigoReferencia?: string;
  url?: string;
  urlThumbnail?: string;
  estoque?: number | null;
}

async function fetchCofemaApiCategory(catName: string, catCode: string, isPromocao = false, isOutlet = false): Promise<{ records: CofemaApiRecord[]; totalRecords: number }> {
  const limit = 100;
  let page = 1;
  let totalPages = 1;
  let totalRecords = 0;
  const categoryRecords: CofemaApiRecord[] = [];

  while (page <= totalPages) {
    let payload: any;
    if (isPromocao) {
      payload = {
        action: 'fetchProdutosByPromocao',
        params: { limit, page, filters: { FILIAL: '0101' } }
      };
    } else if (isOutlet) {
      payload = {
        action: 'fetchProdutos',
        params: { limit, page, sortBy: 'PERC_PROMOCAO', descending: true, filters: { OUTLET: 1, FILIAL: '0101' } }
      };
    } else {
      payload = {
        action: 'fetchProdutosByCategoria',
        categoriaCodigo: catCode,
        params: {
          sortBy: 'PERC_PROMOCAO',
          descending: true,
          filters: { TIPO_GRUPO_CODIGO: catCode, FILIAL: '0101' },
          limit,
          page
        }
      };
    }

    const res = await fetch('https://www.cofema.com.br/api/produto', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Referer': isPromocao ? 'https://www.cofema.com.br/page/promocoes' : isOutlet ? 'https://www.cofema.com.br/page/outlet' : `https://www.cofema.com.br/page/categoria/${catCode}`
      },
      body: JSON.stringify(payload)
    });

    if (res.status !== 200) {
      console.error(`  ⚠️ Erro HTTP ${res.status} na página ${page} para ${catName}`);
      break;
    }

    const data = await res.json();
    totalRecords = data.totalRecords || totalRecords;
    totalPages = data.totalPages || totalPages;

    const pageRecords: CofemaApiRecord[] = data.records || [];
    if (pageRecords.length === 0) break;

    categoryRecords.push(...pageRecords);

    if (page % 5 === 0 || page === totalPages) {
      console.log(`  Progress ${catName}: Página ${page}/${totalPages} (${categoryRecords.length}/${totalRecords} baixados)`);
    }

    page++;
  }

  return { records: categoryRecords, totalRecords };
}

function convertApiRecordToScraped(item: CofemaApiRecord, categoryName: string): ProdutoBrutoScraped {
  const rawId = item.codigo || '0';
  const sku = `COF-${rawId}`;
  const preco = item.precoPromocao || item.precoVenda || 0;
  const link = item.url ? item.url : `https://www.cofema.com.br/page/produto/${rawId}`;

  return {
    sku,
    nome_produto: item.descricao || item.descricaoCompleta || '',
    preco,
    preco_promocional: item.precoPromocao || undefined,
    categoria_site: categoryName,
    subcategoria: item.grupoDescricao || item.tipoGrupoDescricao || '',
    marca: item.marcaDescricao || '',
    unidade_embalagem: item.quantidadeEmbalagem ? `${item.quantidadeEmbalagem} UN` : '1 UN',
    link_produto: link,
    codigo_barras: item.codigoBarras || undefined,
    data_raspagem: new Date().toISOString()
  };
}

async function runCofemaApiScraper() {
  console.log('================================================================================');
  console.log('🚀 RASPAGEM COMPLETA DO CATÁLOGO COFEMA VIA API DIRETA (30.000+ PRODUTOS)');
  console.log('================================================================================\n');

  const baseDir = path.join(process.cwd(), 'catalogos', COFEMA_SLUG);
  const auditoriaDir = path.join(baseDir, 'auditoria');
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  if (!fs.existsSync(auditoriaDir)) fs.mkdirSync(auditoriaDir, { recursive: true });

  const brutosPath = path.join(baseDir, 'produtos_brutos.json');
  const reportPath = path.join(baseDir, 'relatorio_cobertura_cofema.json');

  const categories = [
    { name: 'Promoções', code: 'PROMO', isPromocao: true },
    { name: 'Outlet', code: 'OUTLET', isOutlet: true },
    { name: 'Ferragens & Ferramentas', code: '01' },
    { name: 'Máquinas & Acessórios', code: '02' },
    { name: 'Hidráulica & Acessórios', code: '03' },
    { name: 'Elétrica & Iluminação', code: '04' },
    { name: 'Pintura', code: '05' },
    { name: 'Utilidades Domésticas', code: '06' },
    { name: 'Segurança', code: '07' },
    { name: 'Jardinagem & Acessórios', code: '08' },
    { name: 'Limpeza', code: '10' }
  ];

  const globalProductsMap = new Map<string, ProdutoBrutoScraped>();
  const categoryReports: CategoryReport[] = [];

  for (const cat of categories) {
    console.log(`\n📦 Processando categoria: ${cat.name} (${cat.code})...`);
    const startTime = Date.now();

    const { records, totalRecords } = await fetchCofemaApiCategory(cat.name, cat.code, cat.isPromocao, cat.isOutlet);

    const catUniqueSkus = new Set<string>();

    for (const rec of records) {
      const scraped = convertApiRecordToScraped(rec, cat.name);
      globalProductsMap.set(scraped.sku, scraped);
      catUniqueSkus.add(scraped.sku);
    }

    const totalEsperado = totalRecords > 0 ? totalRecords : records.length;
    const totalColetado = records.length;
    const totalUnicos = catUniqueSkus.size;
    const coveragePercent = totalEsperado > 0 ? Number(((totalColetado / totalEsperado) * 100).toFixed(2)) : 100;
    const status: 'COMPLETO' | 'INCOMPLETO' = (coveragePercent >= 95 || (totalEsperado === 0 && totalColetado === 0)) ? 'COMPLETO' : 'INCOMPLETO';

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ✅ ${cat.name}: ${totalColetado}/${totalEsperado} baixados (${coveragePercent}%) em ${durationSec}s | Status: ${status}`);

    categoryReports.push({
      categoryName: cat.name,
      code: cat.code,
      totalEsperado,
      totalColetado,
      totalUnicos,
      coveragePercent,
      status
    });
  }

  // Persistir produtos_brutos.json
  const allProductsList = Array.from(globalProductsMap.values());
  fs.writeFileSync(brutosPath, JSON.stringify(allProductsList, null, 2), 'utf-8');
  console.log(`\n💾 Salvos ${allProductsList.length} SKUs únicos globais em ${brutosPath}`);

  // Persistir relatório de cobertura
  fs.writeFileSync(reportPath, JSON.stringify(categoryReports, null, 2), 'utf-8');
  console.log(`📊 Relatório salvo em ${reportPath}`);

  // Exportar CSV de auditoria
  generateCofemaAuditoriaCSV();

  console.log('\n================================================================================');
  console.log(`🎉 RASPAGEM COFEMA COMPLETA COM ÉXITO! TOTAL GLOBAL: ${allProductsList.length} SKUs UNICOS`);
  console.log('================================================================================\n');
}

runCofemaApiScraper().catch(err => {
  console.error('Fatal error in Cofema API Scraper:', err);
  process.exit(1);
});
