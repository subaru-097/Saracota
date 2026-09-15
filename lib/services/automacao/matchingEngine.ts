import stringSimilarity from 'string-similarity';
import { ItemProdutoExtraido, buscarEExtrairProdutosFornecedor, buscarProduto, extrairResultados } from './buscarProduto';
import { obterSessaoLogada } from './loginFornecedor';
import { db } from '@/lib/db/client';

export type StatusMatchingItem = 'CONFIRMADO' | 'SIMILAR' | 'NAO_ENCONTRADO';

export interface ItemMatchResultado {
  itemPedido: string;
  status: StatusMatchingItem;
  confianca: number; // 0 - 100%
  produtoEncontrado?: string;
  preco: number;
  quantidade?: number;
  imagem?: string;
  link?: string;
  fornecedorId?: string;
}

export interface ResultadoProcessamentoFornecedor {
  cotacaoId: string;
  fornecedorId: string;
  fornecedorNome?: string;
  sucesso: boolean;
  tempoTotalMs: number;
  itensProcessados: ItemMatchResultado[];
}

// Controls e Locks de concorrência em memória
const execucoesAtivasCotacao = new Set<string>();
const travasPorFornecedor = new Map<string, Promise<void>>();

/**
 * Checa se uma cotação já está em processamento ativamente (em memória ou no banco de dados)
 */
export async function isCotacaoEmProcessamento(cotacaoId: string): Promise<boolean> {
  if (!cotacaoId) return false;
  if (execucoesAtivasCotacao.has(cotacaoId)) return true;

  try {
    const cotacao = await db.cotacoes.getById(cotacaoId);
    const status = (cotacao as any)?.status;
    if (status === 'processando') {
      return true;
    }
  } catch (e) {
    console.warn(`[CONCURRENCY LOCK] Falha ao consultar status da cotação ${cotacaoId}:`, e);
  }

  return false;
}

/**
 * Mutex para execução sequencial garantida por fornecedor (evita logins B2B simultâneos na mesma conta)
 */
async function executarComTravaFornecedor<T>(fornecedorKey: string, fn: () => Promise<T>): Promise<T> {
  const previousLock = travasPorFornecedor.get(fornecedorKey) || Promise.resolve();
  let release: () => void = () => {};
  const currentLock = new Promise<void>((resolve) => { release = resolve; });

  travasPorFornecedor.set(fornecedorKey, previousLock.then(() => currentLock));

  try {
    await previousLock;
    return await fn();
  } finally {
    release();
    if (travasPorFornecedor.get(fornecedorKey) === currentLock) {
      travasPorFornecedor.delete(fornecedorKey);
    }
  }
}

/**
 * 1. Função compararProdutos: Calcula a similaridade textual entre o item pedido e cada resultado extraído
 */
export function compararProdutos(
  itemPedido: string,
  resultadosExtraidos: ItemProdutoExtraido[]
): ItemMatchResultado[] {
  if (!resultadosExtraidos || resultadosExtraidos.length === 0) {
    return [
      {
        itemPedido,
        status: 'NAO_ENCONTRADO',
        confianca: 0,
        preco: 0,
      },
    ];
  }

  const itemPedidoNorm = itemPedido.toLowerCase().trim();

  const resultadosComConfianca = resultadosExtraidos.map((res) => {
    const prodNomeNorm = (res.nome || '').toLowerCase().trim();

    // 1. Similaridade via Dice's Coefficient (string-similarity)
    const diceScore = stringSimilarity.compareTwoStrings(itemPedidoNorm, prodNomeNorm);

    // 2. Token Matching (palavras em comum)
    const tokensPedido = itemPedidoNorm.split(/\s+/).filter((t) => t.length > 1);
    const tokensProd = prodNomeNorm.split(/\s+/).filter((t) => t.length > 1);
    const tokensEmComum = tokensPedido.filter((tp) => tokensProd.some((tPr) => tPr.includes(tp) || tp.includes(tPr)));
    const tokenRatio = tokensPedido.length > 0 ? tokensEmComum.length / tokensPedido.length : 0;

    // Combinação ponderada: 60% string-similarity + 40% token-ratio
    const scoreFinal = diceScore * 0.6 + tokenRatio * 0.4;
    const confianca = Math.min(100, Math.max(0, Math.round(scoreFinal * 100)));

    let status: StatusMatchingItem = 'NAO_ENCONTRADO';
    if (confianca >= 85) {
      status = 'CONFIRMADO';
    } else if (confianca >= 50) {
      status = 'SIMILAR';
    } else {
      status = 'NAO_ENCONTRADO';
    }

    return {
      itemPedido,
      status,
      confianca,
      produtoEncontrado: res.nome,
      preco: res.preco,
      imagem: res.imagem,
      link: res.link,
    };
  });

  // Ordenar da maior confiança para a menor
  resultadosComConfianca.sort((a, b) => b.confianca - a.confianca);
  return resultadosComConfianca;
}

/**
 * 2. Função processarCotacaoFornecedor: Executa login (7.1) + busca (7.2) + comparação (7.3) para um fornecedor
 */
export async function processarCotacaoFornecedor(
  cotacaoId: string,
  fornecedorId: string,
  onProgressMsg?: (msg: string) => Promise<void>
): Promise<ResultadoProcessamentoFornecedor> {
  const startTime = Date.now();
  const itensProcessados: ItemMatchResultado[] = [];

  // 1. Obter a cotação no banco real
  const cotacao = await db.cotacoes.getById(cotacaoId);
  const itensParaCotar = cotacao?.itens && cotacao.itens.length > 0 ? cotacao.itens : [];

  console.log(`[RPA ITEM LOG] CotacaoId: "${cotacaoId}" | Total de itens lidos do banco: ${itensParaCotar.length}`);
  itensParaCotar.forEach((it: any, idx: number) => {
    const name = typeof it === 'string' ? it : it.material || it.nomeOriginal || it.texto || 'Material';
    const qtd = typeof it === 'string' ? 1 : it.quantidade || 1;
    console.log(`  └─ Item ${idx + 1}: "${name}" (Quantidade: ${qtd})`);
  });

  if (itensParaCotar.length === 0) {
    console.error(`[RPA ERROR] Nenhum item cadastrado para a cotação ID "${cotacaoId}". Cotação abortada.`);
    throw new Error(`Nenhum item localizado na cotação ID "${cotacaoId}". Verifique se os produtos foram inseridos no Bloco de Compras.`);
  }

  // Helper para carregar o arquivo de configuração do fornecedor dinamicamente por slug ou ID
  const carregarConfigFornecedor = (fId: string, fNome?: string, cSlug?: string): any | null => {
    const fs = require('fs');
    const path = require('path');

    const normId = (fId || '').toLowerCase();
    const normNome = (fNome || '').toLowerCase();
    const normSlug = (cSlug || '').toLowerCase();

    const candidateSlugs = [
      normSlug,
      normId.includes('construja') || normNome.includes('construja') || normId === 'a1684c4d-d896-4ba9-a591-cda455c5ffe2' ? 'construja' : '',
      normId.includes('construtor') || normNome.includes('construtor') ? 'construtor' : '',
      normId.includes('megaleste') || normNome.includes('megaleste') ? 'megaleste' : '',
      normId.includes('secofair') || normNome.includes('secofair') ? 'secofair' : '',
      normId.includes('cicalfer') || normNome.includes('cicalfer') || normId === '33e03495-100d-45a3-9e34-899de56b0ab1' ? 'cicalfer' : '',
      normId,
    ].filter(Boolean);

    for (const slug of candidateSlugs) {
      const p1 = path.join(process.cwd(), 'core', 'services', 'supplier-quote-engine', 'configs', `${slug}.json`);
      if (fs.existsSync(p1)) {
        try { return JSON.parse(fs.readFileSync(p1, 'utf8')); } catch (e) {}
      }
      const p2 = path.join(process.cwd(), 'config', 'suppliers', `${slug}.json`);
      if (fs.existsSync(p2)) {
        try { return JSON.parse(fs.readFileSync(p2, 'utf8')); } catch (e) {}
      }
    }
    return null;
  };

  // 2. Resolver dados do fornecedor e carregar seu config RPA específico
  const fornDbRecord = await db.fornecedores.getById(fornecedorId);
  const fornecedorNome = fornDbRecord?.nome || fornecedorId;
  const configSlug = (fornDbRecord as any)?.config_slug || (fornDbRecord as any)?.configSlug;
  const rpaAtivo = (fornDbRecord as any)?.rpa_ativo ?? (fornDbRecord as any)?.rpaAtivo;

  const supplierConfig = carregarConfigFornecedor(fornecedorId, fornecedorNome, configSlug);
  const temAutomacaoRpa = Boolean(supplierConfig || rpaAtivo || fornDbRecord?.seletores);

  console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 1: INÍCIO DA EXECUÇÃO] Início da cotação RPA | CotacaoId: "${cotacaoId}" | FornecedorId: "${fornecedorId}" (${fornecedorNome}) | RPA Config: ${supplierConfig ? supplierConfig.slug : fornDbRecord?.seletores ? 'carregado do banco (seletores JSONB)' : 'não localizado'}`);

  if (temAutomacaoRpa) {
    let activeConfig = supplierConfig;

    if (!activeConfig && fornDbRecord?.seletores && typeof fornDbRecord.seletores === 'object') {
      const isConstruja = fornecedorNome.toLowerCase().includes('construja') || (configSlug || '').toLowerCase().includes('construja') || fornecedorId === 'a1684c4d-d896-4ba9-a591-cda455c5ffe2';
      const isCicalfer = fornecedorNome.toLowerCase().includes('cicalfer') || (configSlug || '').toLowerCase().includes('cicalfer') || fornecedorId === '33e03495-100d-45a3-9e34-899de56b0ab1';
      const baseUrl = fornDbRecord.urlPortalB2B || (isConstruja ? 'https://www.construja.com.br/produtos' : 'https://cicalfer.com.br/');
      const cartUrl = isConstruja ? 'https://www.construja.com.br/produtos/carrinho' : 'https://cicalfer.com.br/carrinho';

      const selObj = (fornDbRecord.seletores as any).selectors || fornDbRecord.seletores;

      activeConfig = {
        nome: fornecedorNome,
        slug: configSlug || (isConstruja ? 'construja' : isCicalfer ? 'cicalfer' : fornecedorId),
        url_site: baseUrl,
        base_url: isConstruja ? 'https://www.construja.com.br' : 'https://cicalfer.com.br',
        login_url: baseUrl,
        cart_url: cartUrl,
        selectors: selObj,
        compra_rapida: (fornDbRecord.seletores as any).compra_rapida,
        regras_negocio: (fornDbRecord.seletores as any).regras_negocio,
      };
      console.log(`[${new Date().toISOString()}] [RPA CONFIG DINÂMICO] Configuração montada dinamicamente a partir dos seletores do Supabase para "${fornecedorNome}".`);
    }

    if (!activeConfig) {
      const errMsg = `[ERRO CONFIG RPA] Fornecedor ${fornecedorNome} (${fornecedorId}) não possui arquivo de configuração local (.json) nem seletores no banco de dados. Cotação abortada.`;
      console.error(`[${new Date().toISOString()}] ${errMsg}`);
      if (onProgressMsg) {
        await onProgressMsg(`⚠️ ${errMsg}`);
      }

      const itensFalhos = itensParaCotar.map((it: any) => ({
        itemPedido: typeof it === 'string' ? it : it.material || it.texto || 'Material',
        status: 'NAO_ENCONTRADO' as const,
        confianca: 0,
        preco: 0,
        fornecedorId,
      }));

      await db.cotacoes.salvarResultadosMatching(cotacaoId, fornecedorId, itensFalhos).catch(() => {});

      return {
        cotacaoId,
        fornecedorId,
        fornecedorNome,
        sucesso: false,
        tempoTotalMs: Date.now() - startTime,
        itensProcessados: itensFalhos,
      };
    }

    if (onProgressMsg) {
      await onProgressMsg(`[${fornecedorNome}] 🚀 Iniciando Motor Central de Cotação RPA (${activeConfig.slug || 'custom'})...`);
    }

    try {
      const quoteEngine = require('../../../core/services/supplier-quote-engine');
      const { chromium } = require('playwright');
      const { decryptAES256 } = require('@/lib/security/vault');

      const loginUser = (
        (fornDbRecord as any)?.emailLogin ||
        (fornDbRecord as any)?.login ||
        (fornDbRecord as any)?.email ||
        (fornDbRecord as any)?.login_salvo ||
        (fornDbRecord as any)?.loginSalvo ||
        ''
      ).trim();

      const rawPass = (
        (fornDbRecord as any)?.rawSenhaCriptografada ||
        (fornDbRecord as any)?.senhaLogin ||
        (fornDbRecord as any)?.senha_login ||
        (fornDbRecord as any)?.senha_criptografada ||
        (fornDbRecord as any)?.senhaCriptografada ||
        ''
      ).trim();

      const decryptedPass = rawPass ? decryptAES256(rawPass).trim() : '';
      const passHash = require('crypto').createHash('sha256').update(decryptedPass).digest('hex').substring(0, 10);

      console.log(`[${new Date().toISOString()}] [RPA CREDENCIAIS AUDITORIA] Fornecedor: "${fornecedorNome}" (${fornecedorId}) | Origem: Supabase DB (table fornecedores) | User: "${loginUser}" | PassLength: ${decryptedPass.length} | PassHashPrefix: ${passHash}`);

      if (!loginUser || !decryptedPass || decryptedPass === '[DESCRIPTOGRAFIA_FALHOU]') {
        const errMsg = `[ERRO CREDENCIAIS] Fornecedor ${fornecedorNome} (${fornecedorId}) não possui e-mail/senha cadastrados no banco. Cotação abortada para este fornecedor.`;
        console.error(`[${new Date().toISOString()}] ${errMsg}`);
        if (onProgressMsg) {
          await onProgressMsg(`⚠️ ${errMsg}`);
        }

        const itensFalhos = itensParaCotar.map((it: any) => ({
          itemPedido: typeof it === 'string' ? it : it.material || it.texto || 'Material',
          status: 'NAO_ENCONTRADO' as const,
          confianca: 0,
          preco: 0,
          fornecedorId,
        }));

        await db.cotacoes.salvarResultadosMatching(cotacaoId, fornecedorId, itensFalhos).catch(() => {});

        return {
          cotacaoId,
          fornecedorId,
          fornecedorNome,
          sucesso: false,
          tempoTotalMs: Date.now() - startTime,
          itensProcessados: itensFalhos,
        };
      }

      if (onProgressMsg) {
        await onProgressMsg(`[${fornecedorNome}] 🔑 Autenticando e selecionando Filial B2B...`);
      }

      const browser = await chromium.launch({
        headless: true,
        args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      });

      const page = await context.newPage();

      try {
        await quoteEngine.realizarLogin(page, activeConfig, { user: loginUser, pass: decryptedPass });

        const itensAdicionadosMap: any[] = [];
        let itemIdx = 1;
        for (const itemObj of itensParaCotar) {
          const itemAny = itemObj as any;
          const nomeItem = typeof itemObj === 'string' ? itemObj : itemAny.material || itemAny.nomeOriginal || itemAny.texto || 'Material';
          const qtd = Number(itemAny.quantidade) || 1;

          if (onProgressMsg) {
            await onProgressMsg(`[${fornecedorNome}] 🔍 Cotando e ajustando quantidade em lote: ${nomeItem}...`);
          }

          const addRes = await quoteEngine.adicionarItem(page, activeConfig, { termo: nomeItem, quantidade: qtd, itemIndex: itemIdx++ }).catch((err: any) => ({
            termo: nomeItem,
            tituloProduto: null,
            status: 'FALHA',
            erro: err.message
          }));

          itensAdicionadosMap.push(addRes);
        }

        if (onProgressMsg) {
          await onProgressMsg(`[${fornecedorNome}] 🛒 Lendo dados do carrinho (itemContainer por itemContainer)...`);
        }

        const cartResult = await quoteEngine.extrairCarrinho(page, activeConfig);
        const cartProdutos = cartResult.produtos || cartResult.itens || [];
        const resumo = cartResult.resumo || {};
        const totalCarrinho = resumo.totalPedido || cartResult.totalGeral || 0;
        const cartUrl = cartResult.cartUrl || page.url();

        // Tratamento de Erro: Se a tabela de resumo não for encontrada ou totalPedido for <= 0, abortar cotação do fornecedor
        if (!resumo.resumoTabelaEncontrada || totalCarrinho <= 0) {
          const errResumo = `[ERRO EXTRAÇÃO ${fornecedorNome.toUpperCase()}] Tabela de resumo do pedido ou totalPedido não foi localizada na página do carrinho (${cartUrl}).`;
          console.error(`[${new Date().toISOString()}] ${errResumo}`);
          if (onProgressMsg) {
            await onProgressMsg(`⚠️ ${errResumo}`);
          }
          throw new Error(errResumo);
        }

        // Registrar no log do backend quaisquer erros de extração de itens individuais
        if (cartResult.errosExtracao && cartResult.errosExtracao.length > 0) {
          for (const errItem of cartResult.errosExtracao) {
            console.error(`[${new Date().toISOString()}] ${errItem.mensagem}`);
            if (onProgressMsg) {
              await onProgressMsg(`⚠️ ${errItem.mensagem}`);
            }
          }
        }

        // 3a. Para cada produto pedido: Mapeamento 1-para-1 único com itens do carrinho (evitando duplicações por similaridade)
        const usedCartIndices = new Set<number>();
        let itemIdxLoop = 0;

        for (const itemObj of itensParaCotar) {
          const itemAny = itemObj as any;
          const nomeItem = typeof itemObj === 'string' ? itemObj : itemAny.material || itemAny.nomeOriginal || itemAny.texto || 'Material';
          const addedInfo = itensAdicionadosMap[itemIdxLoop];
          itemIdxLoop++;

          const targetTitle = (addedInfo?.tituloProduto || '').toLowerCase();
          const targetRef = (addedInfo?.tituloProduto || nomeItem).match(/\b\d{4,5}\b/)?.[0] || '';
          const tokens = nomeItem.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);

          let chosenCpIdx = -1;

          // Priority 1: REF único (ex: REF: 11239 vs 11137 vs 13330 vs 13333) nos itens não utilizados
          if (targetRef) {
            chosenCpIdx = cartProdutos.findIndex((cp: any, idx: number) => {
              if (usedCartIndices.has(idx)) return false;
              const pName = (cp.nomeProduto || cp.nome || cp.codigo || '').toLowerCase();
              return pName.includes(targetRef);
            });
          }

          // Priority 2: Título exato capturado durante a navegação real
          if (chosenCpIdx === -1 && targetTitle) {
            chosenCpIdx = cartProdutos.findIndex((cp: any, idx: number) => {
              if (usedCartIndices.has(idx)) return false;
              const pName = (cp.nomeProduto || cp.nome || '').toLowerCase();
              return pName.includes(targetTitle) || targetTitle.includes(pName);
            });
          }

          // Priority 3: Maior pontuação de palavras-chave entre itens não utilizados
          if (chosenCpIdx === -1) {
            let bestScore = -1;
            let bestIdx = -1;
            cartProdutos.forEach((cp: any, idx: number) => {
              if (usedCartIndices.has(idx)) return;
              const pName = (cp.nomeProduto || cp.nome || '').toLowerCase();
              if (pName.includes(nomeItem.toLowerCase()) || nomeItem.toLowerCase().includes(pName)) {
                if (10 > bestScore) {
                  bestScore = 10;
                  bestIdx = idx;
                }
              }
              const matchesCount = tokens.filter((w: string) => pName.includes(w)).length;
              if (matchesCount > bestScore && matchesCount >= 2) {
                bestScore = matchesCount;
                bestIdx = idx;
              }
            });
            if (bestIdx !== -1) {
              chosenCpIdx = bestIdx;
            }
          }

          // Priority 4: Posição equivalente se estiver disponível
          if (chosenCpIdx === -1 && itemIdxLoop - 1 < cartProdutos.length && !usedCartIndices.has(itemIdxLoop - 1)) {
            chosenCpIdx = itemIdxLoop - 1;
          }

          // Priority 5: Primeiro item não utilizado do carrinho
          if (chosenCpIdx === -1) {
            chosenCpIdx = cartProdutos.findIndex((_: any, idx: number) => !usedCartIndices.has(idx));
          }

          let matchedItem: any = null;
          if (chosenCpIdx !== -1) {
            matchedItem = cartProdutos[chosenCpIdx];
            usedCartIndices.add(chosenCpIdx);
          }

          if (matchedItem && (matchedItem.precoUnitario > 0 || matchedItem.preco_unitario > 0 || matchedItem.totalItem > 0)) {
            const nomeFinal = matchedItem.nomeProduto || matchedItem.nome || addedInfo?.tituloProduto;
            const precoUnit = Number(matchedItem.precoUnitario || matchedItem.preco_unitario || (matchedItem.totalItem / matchedItem.quantidade)) || 0;
            const totalItem = Number(matchedItem.totalItem || matchedItem.total || (precoUnit * matchedItem.quantidade)) || 0;

            itensProcessados.push({
              itemPedido: nomeItem,
              status: 'CONFIRMADO',
              confianca: 95,
              produtoEncontrado: nomeFinal,
              preco: precoUnit,
              quantidade: Number(matchedItem.quantidade) || Number(itemAny.quantidade) || 1,
              fornecedorId,
            });

            // 3a. Enviar { nomeProduto, precoUnitario } imediatamente após extrair o par
            if (onProgressMsg) {
              await onProgressMsg(`[${fornecedorNome}] 📦 Par extraído: "${nomeFinal}" ➔ Preço Unitário: R$ ${precoUnit.toFixed(2)} (Total Item: R$ ${totalItem.toFixed(2)})`);
            }
          } else {
            // 4. Sem preencher com R$0,00 ou dado fictício — marcar explicitamente como NAO_ENCONTRADO (FALHA)
            itensProcessados.push({
              itemPedido: nomeItem,
              status: 'NAO_ENCONTRADO',
              confianca: 0,
              preco: 0,
              fornecedorId,
            });
            if (onProgressMsg) {
              await onProgressMsg(`[${fornecedorNome}] ⚠️ [FALHA EXTRAÇÃO] Produto "${nomeItem}" não teve nome/preço associados no carrinho.`);
            }
          }
        }

        // 3b. Enviar { totalItens, despesaAcessoria, totalPedido }
        if (onProgressMsg) {
          await onProgressMsg(`[${fornecedorNome}] 📊 Resumo do Pedido: Total Itens: R$ ${resumo.totalItens.toFixed(2)} | Despesas: R$ ${resumo.despesaAcessoria.toFixed(2)} | Total Pedido: R$ ${resumo.totalPedido.toFixed(2)}`);
        }

        // 3c. Enviar o link direto da página do carrinho (URL do navegador)
        if (onProgressMsg) {
          await onProgressMsg(`[${fornecedorNome}] 🔗 Link direto do carrinho montado: ${cartUrl}`);
        }

        // Persistir URL da sessão / carrinho no banco de dados para acesso rápido do usuário
        await db.cotacoes.salvarBrowserbaseSessionId(cotacaoId, fornecedorId, cartUrl).catch(() => {});

        await db.cotacoes.salvarResultadosMatching(cotacaoId, fornecedorId, itensProcessados);
        console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 9: BANCO CONCLUÍDO] Gravação no banco de dados concluída para cotação "${cotacaoId}" (${itensProcessados.length} item(ns) salvos).`);

        if (onProgressMsg) {
          await onProgressMsg(`[${fornecedorNome}] ✅ Cotação concluída no fornecedor! Total Geral: R$ ${totalCarrinho.toFixed(2)}`);
        }

        return {
          cotacaoId,
          fornecedorId,
          fornecedorNome,
          sucesso: true,
          tempoTotalMs: Date.now() - startTime,
          itensProcessados,
        };
      } finally {
        await browser.close().catch(() => {});
      }
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 10: ERRO FATAL STACK TRACE] Erro na execução RPA da Cicalfer (${fornecedorId}):`, err.stack || err);
      const msgFalha = `[${fornecedorNome}] Falha na cotação RPA: ${err.message}`;
      if (onProgressMsg) {
        await onProgressMsg(msgFalha);
      }

      const itensFalhos = itensParaCotar.map((it: any) => ({
        itemPedido: typeof it === 'string' ? it : it.material || it.texto || 'Material',
        status: 'NAO_ENCONTRADO' as const,
        confianca: 0,
        preco: 0,
        fornecedorId,
      }));

      await db.cotacoes.salvarResultadosMatching(cotacaoId, fornecedorId, itensFalhos).catch(() => {});
      console.log(`[${new Date().toISOString()}] [RPA DIAGNOSTICO - CHECKPOINT 9: BANCO CONCLUÍDO (ERRO)] Gravação de itens com falha concluída no banco de dados.`);

      return {
        cotacaoId,
        fornecedorId,
        fornecedorNome,
        sucesso: false,
        tempoTotalMs: Date.now() - startTime,
        itensProcessados: itensFalhos,
      };
    }
  }

  const sessao = await obterSessaoLogada(fornecedorId);

  if (!sessao.sucesso || !sessao.page || !sessao.browser) {
    const msgFalha = `[${fornecedorNome}] Falha na extração RPA (seletores ausentes ou erro de login): ${sessao.mensagem || 'Seletores não cadastrados no banco de dados'}`;
    if (onProgressMsg) {
      await onProgressMsg(msgFalha);
    }

    const itensFalhos = itensParaCotar.map((it: any) => ({
      itemPedido: it.material || it.texto || 'Material',
      status: 'NAO_ENCONTRADO' as const,
      confianca: 0,
      preco: 0,
      fornecedorId,
    }));

    await db.cotacoes.salvarResultadosMatching(cotacaoId, fornecedorId, itensFalhos).catch(() => {});

    return {
      cotacaoId,
      fornecedorId,
      fornecedorNome,
      sucesso: false,
      tempoTotalMs: Date.now() - startTime,
      itensProcessados: itensFalhos,
    };
  }

  const { page, browser, fornecedor } = sessao;
  const activeSessionId = (sessao as any)?.sessionId;

  // LOG DIAGNÓSTICO IMEDIATO APÓS A SESSÃO SER GERADA NO BROWSERBASE
  if (activeSessionId) {
    console.log(`📌 [SESSION CREATED LOG] cotacaoId: "${cotacaoId}" | fornecedorId: "${fornecedorId}" | sessionId: "${activeSessionId}"`);
    console.log(`💾 [SAVE SESSION START] Salvando sessionId "${activeSessionId}" no banco para a chave "${cotacaoId}_${fornecedorId}"...`);
    await db.cotacoes.salvarBrowserbaseSessionId(cotacaoId, fornecedorId, activeSessionId);
    if (onProgressMsg) {
      await onProgressMsg(`[${fornecedorNome}] 🔌 Conectado à sessão remota Browserbase (${activeSessionId.substring(0, 8)}...)`);
    }
  }

  try {
    // 3. Processar cada item da cotação sequencialmente na mesma sessão
    for (const itemObj of itensParaCotar) {
      const itemAny = itemObj as any;
      const nomeItem = typeof itemObj === 'string' ? itemObj : itemAny.material || itemAny.nomeOriginal || itemAny.texto || 'Material';
      const qtd = Number(itemAny.quantidade) || 1;

      // Emitir mensagem granular de início da busca
      if (onProgressMsg) {
        await onProgressMsg(`[${fornecedorNome}] 🔍 Buscando item no catálogo: ${nomeItem}...`);
      }

      // Busca do produto na página (Prompt 7.2) com suporte ao JSON de seletores
      const buscaRes = await buscarProduto(page, nomeItem, fornecedor?.seletores, fornecedorId, qtd);

      if (buscaRes.sucesso) {
        // Extração dos resultados (Prompt 7.2)
        const resultadosExtraidos = await extrairResultados(page);
        // Comparação de similaridade (Prompt 7.3)
        const resultadosComparados = compararProdutos(nomeItem, resultadosExtraidos);

        // Selecionar o melhor match
        const melhorMatch: ItemMatchResultado = resultadosComparados[0] || {
          itemPedido: nomeItem,
          status: 'NAO_ENCONTRADO' as const,
          confianca: 0,
          preco: 0,
          fornecedorId,
        };

        melhorMatch.fornecedorId = fornecedorId;
        itensProcessados.push(melhorMatch);

        if (melhorMatch.preco > 0 && onProgressMsg) {
          await onProgressMsg(`[${fornecedorNome}] 🏷️ Produto localizado: "${melhorMatch.produtoEncontrado || nomeItem}" — Preço: R$ ${melhorMatch.preco.toFixed(2)}`);
        }
      } else {
        itensProcessados.push({
          itemPedido: nomeItem,
          status: 'NAO_ENCONTRADO',
          confianca: 0,
          preco: 0,
          fornecedorId,
        });
      }

      // Emitir mensagem granular de conclusão do item
      if (onProgressMsg) {
        await onProgressMsg(`[${fornecedorNome}] 🛒 Item processado e adicionado ao carrinho: ${nomeItem}`);
      }
    }

    // 4. Salvar resultados de matching no banco de dados real
    await db.cotacoes.salvarResultadosMatching(cotacaoId, fornecedorId, itensProcessados);

    const activeSessionId = (sessao as any)?.sessionId;
    if (activeSessionId) {
      console.log("[COTACAO] carrinho montado, url atual:", page.url(), "| sessão:", activeSessionId, "| fornecedor:", fornecedorId);
      await db.cotacoes.salvarBrowserbaseSessionId(cotacaoId, fornecedorId, activeSessionId);
    }
  } catch (err: any) {
    console.error(`[RPA Processar] Erro no processamento do fornecedor ${fornecedorId}:`, err);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  return {
    cotacaoId,
    fornecedorId,
    fornecedorNome: fornecedor?.nome,
    sucesso: true,
    tempoTotalMs: Date.now() - startTime,
    itensProcessados,
  };
}

// Estrutura em memória para armazenar o progresso em tempo real de cada cotação no servidor
const statusProgressStore: Record<
  string,
  {
    cotacaoId: string;
    status: 'processando' | 'concluido' | 'aguardando_revisao' | 'erro';
    itensProcessados: number;
    totalItens: number;
    percentualConcluido: number;
    mensagens: string[];
    timestamp: string;
  }
> = {};

/**
 * Retorna o status atual de processamento de uma cotação no servidor (lendo do banco real)
 */
export async function obterStatusCotacao(cotacaoId: string) {
  const progressoDb = await db.cotacoes.obterProgresso(cotacaoId);
  if (progressoDb) {
    return progressoDb;
  }

  // Se ainda não houver registro de progresso, consulta o banco de cotações
  const cotacao = await db.cotacoes.getById(cotacaoId);
  const matchingItens = await db.cotacoes.obterResultadosMatching(cotacaoId);

  const statusStr = (cotacao?.status as any) || '';
  const hasResults = matchingItens.length > 0;
  const isConcluido = statusStr === 'aprovada' || statusStr === 'concluida' || statusStr === 'finalizada' || hasResults;
  const isAguardando = statusStr === 'aguardando_revisao';

  return {
    cotacaoId,
    status: isConcluido ? 'concluido' : isAguardando ? 'aguardando_revisao' : 'processando',
    itensProcessados: matchingItens.length,
    totalItens: cotacao?.itens?.length || matchingItens.length || 1,
    percentualConcluido: isConcluido || isAguardando ? 100 : 15,
    mensagens: [
      `Cotação ${cotacaoId} concluída com sucesso.`,
    ],
    timestamp: new Date().toISOString(),
  };
}

/**
 * 3. Processa todos os fornecedores de uma cotação em background
 */
export async function processarCotacaoTodosFornecedores(cotacaoId: string): Promise<void> {
  // 0. Trava de Concorrência: Impedir execuções paralelas para a mesma cotação
  if (execucoesAtivasCotacao.has(cotacaoId)) {
    console.warn(`[CONCURRENCY LOCK] Disparo bloqueado: a cotação "${cotacaoId}" já possui um processo RPA ativo.`);
    return;
  }

  // Registrar a trava em memória imediatamente
  execucoesAtivasCotacao.add(cotacaoId);

  try {
    const cotacao = await db.cotacoes.getById(cotacaoId);
    const rawFornecedores =
      (cotacao as any)?.fornecedores_selecionados ||
      (cotacao as any)?.fornecedores_ids ||
      (cotacao as any)?.fornecedorIds ||
      ((cotacao as any)?.fornecedor_id ? [(cotacao as any).fornecedor_id] : []);

    let fornecedorIds: string[] = Array.isArray(rawFornecedores)
      ? rawFornecedores.filter(Boolean)
      : rawFornecedores
      ? [String(rawFornecedores)]
      : [];

    if (fornecedorIds.length === 0) {
      console.warn(`[RPA Servidor] Nenhum fornecedor especificado para a cotação ${cotacaoId}. Buscando fornecedores com RPA ativo no banco...`);
      const todosFornecedores = await db.fornecedores.list();
      fornecedorIds = todosFornecedores.filter((f: any) => f.rpa_ativo || f.rpaAtivo).map((f: any) => f.id);
    }

    const totalItensCount = cotacao?.itens?.length || 2;
    const totalGeral = totalItensCount * fornecedorIds.length;

    const mensagensStore = [`Iniciando processamento autônomo no servidor para ${fornecedorIds.length} fornecedor(es)...`];

    // Registrar início no banco de dados
    await db.cotacoes.salvarProgresso(cotacaoId, {
      status: 'processando',
      itensProcessados: 0,
      totalItens: totalGeral,
      percentualConcluido: 15,
      mensagens: mensagensStore,
    });

    console.log(`[RPA Servidor Autônomo] Iniciando cotação ${cotacaoId} para ${fornecedorIds.length} fornecedor(es)...`);

    let contagemItens = 0;
    for (const fId of fornecedorIds) {
      try {
        // Enfileirar execução sequencial atômica por fornecedor (evita 2 logins B2B simultâneos na mesma conta de fornecedor)
        const resForn = await executarComTravaFornecedor(fId, async () => {
          return await processarCotacaoFornecedor(cotacaoId, fId, async (granularMsg) => {
            mensagensStore.push(granularMsg);
            const currentPct = Math.min(90, Math.round(((contagemItens + 0.5) / totalGeral) * 100));
            await db.cotacoes.salvarProgresso(cotacaoId, {
              status: 'processando',
              itensProcessados: contagemItens,
              totalItens: totalGeral,
              percentualConcluido: Math.max(20, currentPct),
              mensagens: [...mensagensStore],
            });
          });
        });

        contagemItens += resForn.itensProcessados.length;

        const pct = Math.min(90, Math.round((contagemItens / totalGeral) * 100));
        mensagensStore.push(`[${resForn.fornecedorNome || fId}] Processamento do fornecedor concluído (${resForn.itensProcessados.length} item(ns)).`);

        await db.cotacoes.salvarProgresso(cotacaoId, {
          status: 'processando',
          itensProcessados: contagemItens,
          totalItens: totalGeral,
          percentualConcluido: Math.max(30, pct),
          mensagens: [...mensagensStore],
        });
      } catch (e: any) {
        console.warn(`[RPA Servidor Autônomo] Falha no fornecedor ${fId}:`, e);
        mensagensStore.push(`Falha no fornecedor ${fId}: ${e.message}`);
      }
    }

    // Obter resultados de matching para definir o status geral da cotação
    const matchingItens = await db.cotacoes.obterResultadosMatching(cotacaoId);
    const temDuvidosos = matchingItens.some(
      (it: any) => it.status === 'SIMILAR' || it.status === 'NAO_ENCONTRADO'
    );

    const novoStatusGeral = temDuvidosos ? 'aguardando_revisao' : 'concluida';
    await db.cotacoes.updateStatus(cotacaoId, novoStatusGeral as any);

    const confirmadosCount = matchingItens.filter((it: any) => it.status === 'CONFIRMADO').length;
    const revisaoCount = matchingItens.filter(
      (it: any) => it.status === 'SIMILAR' || it.status === 'NAO_ENCONTRADO'
    ).length;

    const msgConclusao = `Concluído: ${confirmadosCount} itens confirmados, ${revisaoCount} precisam de revisão.`;
    mensagensStore.push(msgConclusao);

    // Gravar conclusão final de 100% no banco de dados real
    await db.cotacoes.salvarProgresso(cotacaoId, {
      status: temDuvidosos ? 'aguardando_revisao' : 'concluido',
      itensProcessados: matchingItens.length,
      totalItens: matchingItens.length,
      percentualConcluido: 100,
      mensagens: mensagensStore,
    });

    // 4. Gravar notificação persistida no banco do servidor para exibição in-app quando o usuário reabrir
    if (typeof window !== 'undefined') {
      try {
        const notifStr = localStorage.getItem('saracota_notifications_store') || '[]';
        const notifArr = JSON.parse(notifStr);
        notifArr.unshift({
          id: `notif-${Date.now()}`,
          title: 'Cotação Concluída no Servidor! 🚀',
          description: `Cotação ${cotacaoId}: ${confirmadosCount} confirmados, ${revisaoCount} pendentes de revisão.`,
          type: 'success',
          category: 'cotacao',
          read: false,
          created_at: new Date().toISOString(),
        });
        localStorage.setItem('saracota_notifications_store', JSON.stringify(notifArr));
      } catch (e) {
        console.warn('Erro ao salvar notificação persistida:', e);
      }
    }

    console.log(
      `[RPA Servidor Autônomo] Cotação ${cotacaoId} finalizada — ${confirmadosCount} confirmados, ${revisaoCount} em revisão.`
    );
  } finally {
    // Garantir a remoção da trava em memória após término ou erro fatal
    execucoesAtivasCotacao.delete(cotacaoId);
  }
}

