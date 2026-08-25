import { Page } from 'playwright';
import { obterSessaoLogada, loginFornecedor } from './loginFornecedor';
import { registrarLogAutomacao } from './logAutomacao';

export interface ItemProdutoExtraido {
  nome: string;
  preco: number;
  imagem?: string;
  link?: string;
}

export interface ResultadoBuscaAutomacao {
  sucesso: boolean;
  status: 'SUCESSO' | 'CAMPO_BUSCA_NAO_ENCONTRADO' | 'PRODUTO_NAO_ENCONTRADO' | 'LOGIN_FALHOU' | 'TIMEOUT';
  mensagem: string;
  fornecedorId: string;
  nomeItemBuscado: string;
  totalResultados: number;
  resultados: ItemProdutoExtraido[];
  tempoDeExecucaoMs: number;
}

// Seletores genéricos para campos de busca em e-commerce e portais B2B
const SELECTORES_BUSCA = [
  'input[type="search"]',
  'input[name="q"]',
  'input[name="busca"]',
  'input[name="search"]',
  'input[name="termo"]',
  '#search',
  '#busca',
  'input[placeholder*="buscar" i]',
  'input[placeholder*="pesquisar" i]',
  'input[placeholder*="procurar" i]',
  'input[placeholder*="produto" i]',
  'input[placeholder*="o que você procura" i]',
  'input[placeholder*="pesquise" i]',
];

const SELECTORES_BOTAO_BUSCA = [
  'button[type="submit"]',
  '.btn-search',
  '.btn-busca',
  '#btn-search',
  'button:has-text("Buscar")',
  'button:has-text("Pesquisar")',
  'button:has-text("Procurar")',
];

// Seletores genéricos para containers de produtos
const SELECTORES_CARD_PRODUTO = [
  '.product-card',
  '.produto-item',
  '.product-item',
  '.card-produto',
  '[data-product]',
  'li.product',
  'div.product',
  '.item-produto',
  '.product-grid > div',
  '.grid-produtos > div',
  '.result-item',
  '.product',
];

/**
 * Utilitário de formatação de preço: converte strings "R$ 1.250,90" para number (1250.90)
 */
export function parsePrecoBRL(precoTexto: string): number {
  if (!precoTexto) return 0;
  // Limpar caracteres não numéricos exceto vírgula e ponto
  let limpo = precoTexto.replace(/[^\d.,]/g, '').trim();
  if (!limpo) return 0;

  // Se houver vírgula e ponto (ex: 1.250,90), remove os pontos de milhar e troca vírgula por ponto
  if (limpo.includes('.') && limpo.includes(',')) {
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  } else if (limpo.includes(',')) {
    // Se tiver apenas vírgula (ex: 1250,90)
    limpo = limpo.replace(',', '.');
  }

  const parsed = parseFloat(limpo);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * 1. Função buscarProduto: Executa busca, quantidade e fluxo de carrinho usando o JSON de seletores
 */
export async function buscarProduto(
  page: Page,
  nomeItem: string,
  seletores?: Record<string, string> | null,
  fornecedorId?: string,
  quantidade: number = 1
): Promise<{ sucesso: boolean; status?: string; mensagem?: string }> {
  const selObj: Record<string, string> = seletores || {};

  // ------------------------------------------------------------------
  // 3a. Preencher campo_pesquisar_produto com o nome do produto
  // ------------------------------------------------------------------
  let selectedInputSelector: string | null = null;
  if (selObj.campo_pesquisar_produto) {
    const searchSel = selObj.campo_pesquisar_produto;
    try {
      const inputLoc = page.locator(searchSel).first();
      await inputLoc.waitFor({ state: 'visible', timeout: 10000 });
      selectedInputSelector = searchSel;
    } catch (e: any) {
      if (fornecedorId) {
        await registrarLogAutomacao({
          fornecedorId,
          etapa: 'campo_pesquisar_produto',
          motivo: 'Timeout ao aguardar elemento campo_pesquisar_produto',
          mensagem: `Seletor de pesquisa "${searchSel}" não localizado: ${e.message}`,
        });
      }
      return {
        sucesso: false,
        status: 'CAMPO_BUSCA_NAO_ENCONTRADO',
        mensagem: `Campo de pesquisa "campo_pesquisar_produto" ("${searchSel}") não foi localizado.`,
      };
    }
  } else {
    for (const sel of SELECTORES_BUSCA) {
      if (await page.locator(sel).first().isVisible().catch(() => false)) {
        selectedInputSelector = sel;
        break;
      }
    }
  }

  if (!selectedInputSelector) {
    if (fornecedorId) {
      await registrarLogAutomacao({
        fornecedorId,
        etapa: 'campo_pesquisar_produto',
        motivo: 'Campo de pesquisa não encontrado na página',
        mensagem: 'Não foi possível encontrar o campo de busca na página do fornecedor.',
      });
    }
    return {
      sucesso: false,
      status: 'CAMPO_BUSCA_NAO_ENCONTRADO',
      mensagem: 'Não foi possível encontrar o campo de busca na página do fornecedor.',
    };
  }

  const inputElement = page.locator(selectedInputSelector).first();
  await inputElement.focus();
  await inputElement.clear().catch(() => {});

  // Digitar com delay aleatório entre 80ms e 250ms por caractere
  for (const char of nomeItem) {
    await inputElement.type(char);
    const delay = Math.floor(Math.random() * (250 - 80 + 1)) + 80;
    await page.waitForTimeout(delay);
  }

  await page.waitForTimeout(Math.floor(Math.random() * (1200 - 500 + 1)) + 500);

  // Submeter busca
  let btnFound = false;
  for (const btnSel of SELECTORES_BOTAO_BUSCA) {
    if (await page.locator(btnSel).first().isVisible().catch(() => false)) {
      await page.locator(btnSel).first().click().catch(() => {});
      btnFound = true;
      break;
    }
  }

  if (!btnFound) {
    await page.keyboard.press('Enter');
  }

  // ------------------------------------------------------------------
  // 3b. Aguardar resultado(s) aparecer(em)
  // ------------------------------------------------------------------
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    await page.waitForTimeout(2000);
  } catch (e) {
    console.warn('[RPA Buscar] Timeout ao aguardar domcontentloaded pós busca.');
  }

  // ------------------------------------------------------------------
  // 3c. Preencher campo_quantidade_produto com a quantidade desejada
  // ------------------------------------------------------------------
  if (selObj.campo_quantidade_produto) {
    const qtdSel = selObj.campo_quantidade_produto;
    console.log(`[RPA DEBUG] Preenchendo campo_quantidade_produto ("${qtdSel}") com valor: ${quantidade}...`);
    try {
      const qtdLoc = page.locator(qtdSel).first();
      await qtdLoc.waitFor({ state: 'visible', timeout: 10000 });
      await qtdLoc.focus();
      await qtdLoc.fill(String(quantidade)).catch(async () => {
        await qtdLoc.clear().catch(() => {});
        await qtdLoc.type(String(quantidade));
      });
      await page.waitForTimeout(500);
    } catch (e: any) {
      if (fornecedorId) {
        await registrarLogAutomacao({
          fornecedorId,
          etapa: 'campo_quantidade_produto',
          motivo: 'Timeout ao aguardar elemento campo_quantidade_produto',
          mensagem: `Campo de quantidade "${qtdSel}" não localizado: ${e.message}`,
        });
      }
      return {
        sucesso: false,
        status: 'CAMPO_QUANTIDADE_NAO_ENCONTRADO',
        mensagem: `Campo "campo_quantidade_produto" ("${qtdSel}") não foi localizado.`,
      };
    }
  }

  // ------------------------------------------------------------------
  // 3d. Clicar em botao_abrir_carrinho (adicionar ao carrinho)
  // ------------------------------------------------------------------
  if (selObj.botao_abrir_carrinho) {
    const addCartSel = selObj.botao_abrir_carrinho;
    console.log(`[RPA DEBUG] Clicando em botao_abrir_carrinho ("${addCartSel}")...`);
    try {
      const addCartLoc = page.locator(addCartSel).first();
      await addCartLoc.waitFor({ state: 'visible', timeout: 10000 });
      await addCartLoc.click();
      await page.waitForTimeout(1500);
    } catch (e: any) {
      if (fornecedorId) {
        await registrarLogAutomacao({
          fornecedorId,
          etapa: 'botao_abrir_carrinho',
          motivo: 'Timeout ao aguardar elemento botao_abrir_carrinho',
          mensagem: `Botão de adicionar ao carrinho "${addCartSel}" não localizado: ${e.message}`,
        });
      }
      return {
        sucesso: false,
        status: 'BOTAO_CARRINHO_NAO_ENCONTRADO',
        mensagem: `Botão "botao_abrir_carrinho" ("${addCartSel}") não foi localizado.`,
      };
    }
  }

  // ------------------------------------------------------------------
  // 3e. Aguardar o botao_ver_carrinho estar HABILITADO
  //     Verificar se o atributo disabled foi removido antes de prosseguir
  // ------------------------------------------------------------------
  if (selObj.botao_ver_carrinho) {
    const viewCartSel = selObj.botao_ver_carrinho;
    console.log(`[RPA DEBUG] Aguardando habilitação de botao_ver_carrinho ("${viewCartSel}")...`);
    try {
      const viewCartLoc = page.locator(viewCartSel).first();
      await viewCartLoc.waitFor({ state: 'visible', timeout: 15000 });

      // Aguardar até que a propriedade disabled e o atributo disabled sejam falsos/ausentes
      await page.waitForFunction(
        (selector) => {
          const el = document.querySelector(selector);
          if (!el) return false;
          const hasAttr = el.hasAttribute('disabled');
          const isPropDisabled = (el as HTMLButtonElement).disabled === true;
          const isClassDisabled = el.classList.contains('disabled');
          return !hasAttr && !isPropDisabled && !isClassDisabled;
        },
        viewCartSel,
        { timeout: 15000 }
      );
      console.log(`[RPA DEBUG] Botão "botao_ver_carrinho" ("${viewCartSel}") está HABILITADO com sucesso!`);
    } catch (e: any) {
      if (fornecedorId) {
        await registrarLogAutomacao({
          fornecedorId,
          etapa: 'botao_ver_carrinho',
          motivo: 'Botão ver carrinho permaneceu desabilitado (atributo disabled) ou não ficou visível',
          mensagem: `Botão "${viewCartSel}" permaneceu com atributo disabled após o timeout de 15s: ${e.message}`,
        });
      }
      return {
        sucesso: false,
        status: 'BOTAO_VER_CARRINHO_DESABILITADO',
        mensagem: `O botão "botao_ver_carrinho" ("${viewCartSel}") permaneceu desabilitado.`,
      };
    }
  }

  return { sucesso: true };
}

/**
 * 2. Função extrairResultados: Extrai até os 10 primeiros produtos da página
 */
export async function extrairResultados(page: Page): Promise<ItemProdutoExtraido[]> {
  const resultados: ItemProdutoExtraido[] = [];

  // Tentar encontrar o container de cards de produtos
  let selectedContainerSelector: string | null = null;
  for (const cardSel of SELECTORES_CARD_PRODUTO) {
    const count = await page.locator(cardSel).count().catch(() => 0);
    if (count > 0) {
      selectedContainerSelector = cardSel;
      break;
    }
  }

  if (!selectedContainerSelector) {
    return [];
  }

  const cardsLocator = page.locator(selectedContainerSelector);
  const totalCards = await cardsLocator.count();
  const limit = Math.min(totalCards, 10);

  for (let i = 0; i < limit; i++) {
    const card = cardsLocator.nth(i);

    // Extrair Nome
    let nome = '';
    const titleLocators = ['.product-title', '.nome-produto', '.product-name', 'h2', 'h3', 'h4', 'a.title', 'a'];
    for (const tLoc of titleLocators) {
      const txt = await card.locator(tLoc).first().innerText().catch(() => '');
      if (txt && txt.trim().length > 2) {
        nome = txt.trim();
        break;
      }
    }
    if (!nome) {
      nome = (await card.innerText().catch(() => '')).split('\n')[0] || `Produto ${i + 1}`;
    }

    // Extrair Preço
    let preco = 0;
    const priceLocators = ['.price', '.preco', '.product-price', '.valor', 'span[class*="price"]', 'div[class*="preco"]', 'span[class*="valor"]', 'strong'];
    for (const pLoc of priceLocators) {
      const pTxt = await card.locator(pLoc).first().innerText().catch(() => '');
      if (pTxt && (pTxt.includes('R$') || pTxt.match(/\d+[,.]\d+/))) {
        preco = parsePrecoBRL(pTxt);
        if (preco > 0) break;
      }
    }

    // Fallback de preço se não encontrou em classe específica
    if (preco === 0) {
      const fullCardText = await card.innerText().catch(() => '');
      const matchPreco = fullCardText.match(/R\$\s*[\d.,]+/i);
      if (matchPreco) {
        preco = parsePrecoBRL(matchPreco[0]);
      }
    }

    // Extrair Imagem
    let imagem: string | undefined = undefined;
    const imgEl = card.locator('img').first();
    if (await imgEl.count().catch(() => 0)) {
      imagem = (await imgEl.getAttribute('src').catch(() => '')) || (await imgEl.getAttribute('data-src').catch(() => '')) || undefined;
    }

    // Extrair Link
    let link: string | undefined = undefined;
    const aEl = card.locator('a[href]').first();
    if (await aEl.count().catch(() => 0)) {
      link = (await aEl.getAttribute('href').catch(() => '')) || undefined;
    }

    resultados.push({
      nome: nome.substring(0, 150),
      preco,
      imagem,
      link,
    });
  }

  return resultados;
}

/**
 * Função Integrada: Abre sessão logada (Prompt 7.1), busca produto e extrai os primeiros 10 resultados
 */
export async function buscarEExtrairProdutosFornecedor(
  fornecedorId: string,
  nomeItem: string
): Promise<ResultadoBuscaAutomacao> {
  const startTime = Date.now();

  try {
    // 1. Reutilizar o login automatizado (Prompt 7.1)
    const sessao = await obterSessaoLogada(fornecedorId);
    if (!sessao.sucesso || !sessao.page) {
      return {
        sucesso: false,
        status: (sessao.status as any) || 'LOGIN_FALHOU',
        mensagem: sessao.mensagem || 'Falha ao efetuar login no fornecedor para realizar a busca.',
        fornecedorId,
        nomeItemBuscado: nomeItem,
        totalResultados: 0,
        resultados: [],
        tempoDeExecucaoMs: Date.now() - startTime,
      };
    }

    const { page, browser, fornecedor } = sessao;

    // 2. Executar busca do produto
    const buscaRes = await buscarProduto(page, nomeItem, fornecedor?.seletores, fornecedorId);
    if (!buscaRes.sucesso) {
      await browser.close();
      return {
        sucesso: false,
        status: (buscaRes.status as any) || 'CAMPO_BUSCA_NAO_ENCONTRADO',
        mensagem: buscaRes.mensagem || 'Campo de busca não localizado na página.',
        fornecedorId,
        nomeItemBuscado: nomeItem,
        totalResultados: 0,
        resultados: [],
        tempoDeExecucaoMs: Date.now() - startTime,
      };
    }

    // 3. Extrair os primeiros 10 resultados da página
    const resultados = await extrairResultados(page);
    await browser.close();

    if (resultados.length === 0) {
      return {
        sucesso: false,
        status: 'PRODUTO_NAO_ENCONTRADO',
        mensagem: `Nenhum produto correspondente ao termo "${nomeItem}" foi localizado no catálogo do lojista ${fornecedor.nome}.`,
        fornecedorId,
        nomeItemBuscado: nomeItem,
        totalResultados: 0,
        resultados: [],
        tempoDeExecucaoMs: Date.now() - startTime,
      };
    }

    return {
      sucesso: true,
      status: 'SUCESSO',
      mensagem: `Busca realizada com sucesso no catálogo de ${fornecedor.nome}! ${resultados.length} produto(s) extraído(s).`,
      fornecedorId,
      nomeItemBuscado: nomeItem,
      totalResultados: resultados.length,
      resultados,
      tempoDeExecucaoMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      sucesso: false,
      status: 'TIMEOUT',
      mensagem: error.message || 'Exceção não tratada durante a busca e extração.',
      fornecedorId,
      nomeItemBuscado: nomeItem,
      totalResultados: 0,
      resultados: [],
      tempoDeExecucaoMs: Date.now() - startTime,
    };
  }
}
