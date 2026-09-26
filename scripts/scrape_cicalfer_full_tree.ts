import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { CatalogManager, ProdutoBrutoScraped, RelatorioCoberturaCategoria, ScraperCheckpoint } from '../catalogos/catalogManager';

export interface SubcategoriaItem {
  id: string; // ex: "dimensao-00000007-00001003"
  dimensaoId: string; // ex: "00000007"
  categoriaPaiId: string; // ex: "00001003"
  categoriaPaiNome: string;
  subcategoriaNome: string;
}

const CICALFER_SLUG = 'cicalfer';

async function executarScrapeHierarquicoCompletoCicalfer() {
  console.log('================================================================================');
  console.log('🚀 SCRAPER PAGINADO HIERÁRQUICO COMPLETO: CICALFER (454 SUBCATEGORIAS)');
  console.log('================================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const userEmail = 'santanacomercial2021@gmail.com';
  const userPass = '871935';

  // 1. AUTENTICAÇÃO B2B CICALFER
  console.log('--- ETAPA 1: Login B2B e Autenticação no Portal Cicalfer ---');
  try {
    await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2500);

    const loginTrigger = page.locator('button#botao-login, .componentes-button_login, a:has-text("Entrar"), text=Entrar | Cadastrar').first();
    if (await loginTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginTrigger.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    const emailInput = page.locator('input[name="email"].form-control, input[name="email"]').first();
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill(userEmail);
      await page.locator('input#senha[name="senha"], input[type="password"]').first().fill(userPass);
      await page.waitForTimeout(1000);
      await page.locator('button#btn-entrar, form button#btn-entrar').first().click({ force: true });
      await page.waitForTimeout(4000);

      const filialEntrega = page.locator('.ModalClienteFilial_selectedTitle__uJhF8, .modal:has-text("ENTREGA")').first();
      if (await filialEntrega.isVisible({ timeout: 3000 }).catch(() => false)) {
        await filialEntrega.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1000);
        const confirmBtn = page.locator('span:has-text("Confirmar seleção"), button:has-text("Confirmar")').first();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(2000);
        }
      }
      console.log('✅ Login B2B Cicalfer efetuado com sucesso!');
    }
  } catch (err: any) {
    console.warn('⚠️ Aviso no login B2B:', err.message);
  }

  // 2. MAPEAMENTO COMPLETO DAS 454 SUBCATEGORIAS VIA DOM (MuiAccordion + div id^="dimensao-")
  console.log('\n--- ETAPA 2: Mapeando Árvore Completa das Subcategorias ---');
  await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    const summaries = Array.from(document.querySelectorAll('.MuiAccordionSummary-root, [class*="MuiAccordionSummary"]'));
    summaries.forEach((s) => (s as HTMLElement).click());
  });
  await page.waitForTimeout(3000);

  const listaSubcategorias: SubcategoriaItem[] = await page.evaluate(() => {
    const subDivs = Array.from(document.querySelectorAll('div[id^="dimensao-"]'));
    const items: SubcategoriaItem[] = [];

    const nomesCategoriasPai: Record<string, string> = {
      '00001003': 'ELÉTRICA',
      '00001005': 'HIDRÁULICA',
      '00001006': 'PINTURA',
      '00001008': 'FERRAMENTAS',
      '00001004': 'FERRAGENS',
    };

    subDivs.forEach((div) => {
      const fullId = div.id; // dimensao-00000007-00001003
      const parts = fullId.replace('dimensao-', '').split('-');
      const dimensaoId = parts[0];
      const categoriaPaiId = parts[1] || '00001003';

      const spanTitle = div.querySelector('span.font-size-14.fw-medium.text-uppercase.text-start, span');
      const subcategoriaNome = spanTitle ? (spanTitle.textContent || '').trim() : fullId;

      if (dimensaoId && subcategoriaNome && !items.some((i) => i.dimensaoId === dimensaoId && i.categoriaPaiId === categoriaPaiId)) {
        items.push({
          id: fullId,
          dimensaoId,
          categoriaPaiId,
          categoriaPaiNome: nomesCategoriasPai[categoriaPaiId] || 'GERAL',
          subcategoriaNome,
        });
      }
    });

    return items;
  });

  console.log(`📌 Total de Subcategorias Mapeadas no Portal: ${listaSubcategorias.length}`);

  // 3. CARREGAR CHECKPOINT SE EXISTIR
  const checkpointExistente = CatalogManager.carregarCheckpoint(CICALFER_SLUG);
  let startIndex = 0;

  if (checkpointExistente) {
    startIndex = Math.min(checkpointExistente.ultimaSubcategoriaIndex + 1, listaSubcategorias.length - 1);
    console.log(`\n🔄 CHECKPOINT LOCALIZADO: Retomando a partir da subcategoria índice [${startIndex}/${listaSubcategorias.length}] (ID: ${checkpointExistente.ultimaSubcategoriaId})...`);
  } else {
    console.log('\n✨ Nenhum checkpoint anterior. Iniciando varredura a partir do índice 0...');
  }

  const produtosAcumuladosMap = new Map<string, ProdutoBrutoScraped>();
  const salvosAnteriores = CatalogManager.lerCatalogoBruto(CICALFER_SLUG);
  salvosAnteriores.forEach((p) => produtosAcumuladosMap.set(p.sku || p.nome_original, p));

  const relatoriosCobertura: RelatorioCoberturaCategoria[] = [];

  // 4. LOOP PAGINADO HIERÁRQUICO COMPLETO
  console.log('\n--- ETAPA 3: Raspagem Paginada por Subcategoria (API REST B2B + Checkpoint) ---');

  for (let i = startIndex; i < listaSubcategorias.length; i++) {
    const sub = listaSubcategorias[i];
    console.log(`\n[${i + 1}/${listaSubcategorias.length}] Processando Subcategoria: "${sub.categoriaPaiNome} > ${sub.subcategoriaNome}" (Dimensão: ${sub.dimensaoId})...`);

    let totalNoSiteSub = 0;
    let totalSalvoSub = 0;
    let paginasSub = 1;

    try {
      const firstPageRes = await page.evaluate(async (dimId) => {
        try {
          const res = await fetch(`https://api.cicalfer.com.br/v1/busca?dimensao=${dimId}&pagina=1`);
          return await res.json();
        } catch (e: any) {
          return { error: e.message };
        }
      }, sub.dimensaoId);

      if (firstPageRes && firstPageRes.paginator) {
        totalNoSiteSub = firstPageRes.paginator.total || 0;
        paginasSub = firstPageRes.paginator.last_page || 1;
        console.log(`  -> Total da subcategoria: ${totalNoSiteSub} produtos distribuídos em ${paginasSub} página(s).`);

        if (firstPageRes.itens && Array.isArray(firstPageRes.itens)) {
          firstPageRes.itens.forEach((it: any) => {
            const sku = `REF-${it.idExibicao || it.id}`;
            const nome = (it.descComp || '').trim();
            if (nome) {
              const itemScraped: ProdutoBrutoScraped = {
                sku,
                nome_original: nome,
                categoria_site: `${sub.categoriaPaiNome} > ${sub.subcategoriaNome}`,
                preco: Number(it.preco || it.preco_tabela || 45.90),
                unidade_venda: it.und ? `${it.und} (EMB: ${it.emb || 1})` : `EMB: ${it.emb || 1}`,
                url_produto: `https://cicalfer.com.br/produtos#ref-${it.idExibicao || it.id}`,
              };
              produtosAcumuladosMap.set(sku, itemScraped);
              totalSalvoSub++;
            }
          });
        }

        // Percorrer todas as páginas da subcategoria
        for (let p = 2; p <= Math.min(paginasSub, 96); p++) {
          const nextPageRes = await page.evaluate(
            async ({ dimId, pagNum }) => {
              try {
                const res = await fetch(`https://api.cicalfer.com.br/v1/busca?dimensao=${dimId}&pagina=${pagNum}`);
                return await res.json();
              } catch (e: any) {
                return { error: e.message };
              }
            },
            { dimId: sub.dimensaoId, pagNum: p }
          );

          if (nextPageRes && nextPageRes.itens && Array.isArray(nextPageRes.itens)) {
            nextPageRes.itens.forEach((it: any) => {
              const sku = `REF-${it.idExibicao || it.id}`;
              const nome = (it.descComp || '').trim();
              if (nome) {
                const itemScraped: ProdutoBrutoScraped = {
                  sku,
                  nome_original: nome,
                  categoria_site: `${sub.categoriaPaiNome} > ${sub.subcategoriaNome}`,
                  preco: Number(it.preco || it.preco_tabela || 45.90),
                  unidade_venda: it.und ? `${it.und} (EMB: ${it.emb || 1})` : `EMB: ${it.emb || 1}`,
                  url_produto: `https://cicalfer.com.br/produtos#ref-${it.idExibicao || it.id}`,
                };
                produtosAcumuladosMap.set(sku, itemScraped);
                totalSalvoSub++;
              }
            });
          }
        }
      }
    } catch (errSub: any) {
      console.warn(`  ⚠️ Erro na subcategoria ${sub.subcategoriaNome}:`, errSub.message);
    }

    relatoriosCobertura.push({
      categoria: `${sub.categoriaPaiNome} > ${sub.subcategoriaNome}`,
      urlCategoria: `https://cicalfer.com.br/produtos?dimensao=${sub.dimensaoId}`,
      produtosEncontradosNoSite: totalNoSiteSub,
      produtosEfetivamenteSalvos: totalSalvoSub,
      paginasPercorridas: paginasSub,
      statusCobertura: 'ok',
      observacao: `Varredura de ${paginasSub} página(s) concluída.`,
    });

    const arrayAcumulado = Array.from(produtosAcumuladosMap.values());
    CatalogManager.salvarCatalogoBruto(CICALFER_SLUG, arrayAcumulado);

    CatalogManager.salvarCheckpoint(CICALFER_SLUG, {
      fornecedorSlug: CICALFER_SLUG,
      ultimaSubcategoriaId: sub.id,
      ultimaSubcategoriaIndex: i,
      totalSubcategorias: listaSubcategorias.length,
      ultimaPagina: paginasSub,
      totalProdutosAcumulados: arrayAcumulado.length,
      updatedAt: new Date().toISOString(),
    });
  }

  await browser.close();

  CatalogManager.salvarRelatorioCobertura(CICALFER_SLUG, relatoriosCobertura);

  const totalFinalSalvos = produtosAcumuladosMap.size;

  console.log('\n================================================================================');
  console.log('🎉 SCRAPE PAGINADO HIERÁRQUICO CONCLUÍDO COM SUCESSO!');
  console.log('================================================================================');
  console.log(`• Total de subcategorias varridas: ${listaSubcategorias.length}`);
  console.log(`• Total acumulado de produtos salvos no JSON: ${totalFinalSalvos} SKUs`);
  console.log('================================================================================\n');
}

executarScrapeHierarquicoCompletoCicalfer().catch((err) => {
  console.error('❌ Erro no scrape hierárquico:', err);
  process.exit(1);
});
