import * as fs from 'fs';
import * as path from 'path';
import { normalizarAtributosProduto, AtributosNormalizados } from '../lib/services/normalizer/attributeNormalizer';
import { normalizarPrecoPorUnidade, PrecoNormalizadoResultado } from '../lib/services/normalizer/unitPriceNormalizer';

export interface ProdutoBrutoScraped {
  sku: string;
  nome_original: string;
  categoria_site?: string;
  preco: number;
  unidade_venda: string;
  url_produto?: string;
  scraped_at?: string;
}

export interface ProdutoProcessadoCatalogo {
  sku: string;
  nome_original: string;
  atributos: AtributosNormalizados;
  precoNormalizado: PrecoNormalizadoResultado;
  categoria_site?: string;
  url_produto?: string;
  scraped_at: string;
}

export interface RelatorioCoberturaCategoria {
  categoria: string;
  urlCategoria: string;
  produtosEncontradosNoSite: number;
  produtosEfetivamenteSalvos: number;
  paginasPercorridas: number;
  statusCobertura: 'ok' | 'divergente' | 'erro';
  observacao?: string;
}

export interface ScraperCheckpoint {
  fornecedorSlug: string;
  ultimaSubcategoriaId: string;
  ultimaSubcategoriaIndex: number;
  totalSubcategorias: number;
  ultimaPagina: number;
  totalProdutosAcumulados: number;
  updatedAt: string;
}

const CATALOGOS_BASE_DIR = path.join(process.cwd(), 'catalogos');

export class CatalogManager {
  private static getSupplierDir(fornecedorSlug: string): string {
    const slugLimpo = fornecedorSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const dir = path.join(CATALOGOS_BASE_DIR, slugLimpo);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public static salvarCatalogoBruto(
    fornecedorSlug: string,
    produtosScraped: ProdutoBrutoScraped[]
  ): { totalSalvos: number; path: string } {
    const dir = this.getSupplierDir(fornecedorSlug);
    const rawFilePath = path.join(dir, 'produtos_brutos.json');
    const timestampIso = new Date().toISOString();

    let catalogoExistenteMap = new Map<string, ProdutoBrutoScraped>();

    if (fs.existsSync(rawFilePath)) {
      try {
        const content = fs.readFileSync(rawFilePath, 'utf-8');
        const rawArray: ProdutoBrutoScraped[] = JSON.parse(content);
        for (const item of rawArray) {
          const key = item.sku || item.nome_original;
          catalogoExistenteMap.set(key, item);
        }
      } catch (e) {
        console.warn(`[CATALOG MANAGER] Erro ao ler produtos brutos de ${fornecedorSlug}:`, e);
      }
    }

    for (const p of produtosScraped) {
      const key = p.sku || p.nome_original;
      catalogoExistenteMap.set(key, {
        ...p,
        scraped_at: timestampIso,
      });
    }

    const catalogoAtualizado = Array.from(catalogoExistenteMap.values());
    fs.writeFileSync(rawFilePath, JSON.stringify(catalogoAtualizado, null, 2), 'utf-8');

    this.gerarCatalogoNormalizado(fornecedorSlug, catalogoAtualizado);

    console.log(`✅ [CATALOG MANAGER] Catálogo bruto de "${fornecedorSlug}" atualizado em "${rawFilePath}" com ${catalogoAtualizado.length} produtos.`);
    return { totalSalvos: catalogoAtualizado.length, path: rawFilePath };
  }

  public static lerCatalogoBruto(fornecedorSlug: string): ProdutoBrutoScraped[] {
    const dir = this.getSupplierDir(fornecedorSlug);
    const rawFilePath = path.join(dir, 'produtos_brutos.json');
    if (!fs.existsSync(rawFilePath)) return [];
    try {
      const content = fs.readFileSync(rawFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error(`[CATALOG MANAGER] Falha ao ler produtos brutos de ${fornecedorSlug}:`, e);
      return [];
    }
  }

  public static salvarRelatorioCobertura(
    fornecedorSlug: string,
    relatorios: RelatorioCoberturaCategoria[]
  ): string {
    const dir = this.getSupplierDir(fornecedorSlug);
    const coverageFilePath = path.join(dir, 'coverage_report.json');
    fs.writeFileSync(coverageFilePath, JSON.stringify(relatorios, null, 2), 'utf-8');
    console.log(`📊 [CATALOG MANAGER] Relatório de cobertura salvo em "${coverageFilePath}".`);
    return coverageFilePath;
  }

  public static salvarCheckpoint(fornecedorSlug: string, data: ScraperCheckpoint): string {
    const dir = this.getSupplierDir(fornecedorSlug);
    const checkpointFilePath = path.join(dir, 'scraper_checkpoint.json');
    fs.writeFileSync(checkpointFilePath, JSON.stringify(data, null, 2), 'utf-8');
    return checkpointFilePath;
  }

  public static carregarCheckpoint(fornecedorSlug: string): ScraperCheckpoint | null {
    const dir = this.getSupplierDir(fornecedorSlug);
    const checkpointFilePath = path.join(dir, 'scraper_checkpoint.json');
    if (!fs.existsSync(checkpointFilePath)) return null;
    try {
      const content = fs.readFileSync(checkpointFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }

  private static gerarCatalogoNormalizado(
    fornecedorSlug: string,
    produtosBrutos: ProdutoBrutoScraped[]
  ): void {
    const dir = this.getSupplierDir(fornecedorSlug);
    const normFilePath = path.join(dir, 'produtos_normalizados.json');

    const listaNormalizada: ProdutoProcessadoCatalogo[] = produtosBrutos.map((p) => {
      const atributos = normalizarAtributosProduto(p.nome_original, p.categoria_site);
      const precoNormalizado = normalizarPrecoPorUnidade(p.preco, p.unidade_venda, p.nome_original);
      return {
        sku: p.sku || p.nome_original,
        nome_original: p.nome_original,
        atributos,
        precoNormalizado,
        categoria_site: p.categoria_site,
        url_produto: p.url_produto,
        scraped_at: p.scraped_at || new Date().toISOString(),
      };
    });

    fs.writeFileSync(normFilePath, JSON.stringify(listaNormalizada, null, 2), 'utf-8');
  }
}
