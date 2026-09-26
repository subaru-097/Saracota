import { CatalogManager } from '../catalogos/catalogManager';
import { normalizarAtributosProduto } from '../lib/services/normalizer/attributeNormalizer';
import { normalizarPrecoPorUnidade } from '../lib/services/normalizer/unitPriceNormalizer';

const CICALFER_SLUG = 'cicalfer';

function normalizarCatalogoCompletoCicalfer() {
  console.log('🔄 NORMALIZANDO ATRIBUTOS E PREÇOS DOS 1.901 SKUS DA CICALFER...');

  const brutos = CatalogManager.lerCatalogoBruto(CICALFER_SLUG);
  console.log(`📌 Lidos ${brutos.length} produtos brutos.`);

  const normalizados = brutos.map((p) => {
    const attr = normalizarAtributosProduto(p.nome_original, p.categoria_site);
    const precoNorm = normalizarPrecoPorUnidade(p.preco, p.unidade_venda, p.nome_original);

    return {
      sku: p.sku,
      nome_original: p.nome_original,
      nome_limpo: attr.nomeLimpo,
      categoria_site: p.categoria_site,
      atributos: attr,
      preco_original: p.preco,
      unidade_venda_original: p.unidade_venda,
      preco_unitario_base: precoNorm.precoUnitarioBase,
      unidade_base: precoNorm.unidadeBase,
      fator_conversao: precoNorm.fatorConversao,
      url_produto: p.url_produto,
    };
  });

  CatalogManager.salvarCatalogoNormalizado(CICALFER_SLUG, normalizados);

  console.log(`✅ NORMALIZAÇÃO CONCLUÍDA! Salvo em catalogos/cicalfer/produtos_normalizados.json com ${normalizados.length} itens.`);
}

normalizarCatalogoCompletoCicalfer();
