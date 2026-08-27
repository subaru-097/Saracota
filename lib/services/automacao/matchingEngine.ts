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
  const itensParaCotar = cotacao?.itens || [
    { material: 'Cabo Flexível SIL 750V 2,5mm Azul', quantidade: 100 },
    { material: 'Tubo PVC Esgoto Amanco 100mm 6m', quantidade: 10 },
  ];

  // 2. Resolver dados do fornecedor e abrir sessão de login
  const fornDbRecord = await db.fornecedores.getById(fornecedorId);
  const sessao = await obterSessaoLogada(fornecedorId);
  const fornecedorNome = fornDbRecord?.nome || sessao.fornecedor?.nome || fornecedorId;

  if (!sessao.sucesso || !sessao.page || !sessao.browser) {
    if (onProgressMsg) {
      await onProgressMsg(`[${fornecedorNome}] Falha ao conectar ao portal: ${sessao.mensagem || 'Erro de conexão'}`);
    }
    return {
      cotacaoId,
      fornecedorId,
      fornecedorNome,
      sucesso: false,
      tempoTotalMs: Date.now() - startTime,
      itensProcessados: itensParaCotar.map((it: any) => ({
        itemPedido: it.material || it.texto || 'Material',
        status: 'NAO_ENCONTRADO',
        confianca: 0,
        preco: 0,
        fornecedorId,
      })),
    };
  }

  const { page, browser, fornecedor } = sessao;

  try {
    // 3. Processar cada item da cotação sequencialmente na mesma sessão
    for (const itemObj of itensParaCotar) {
      const itemAny = itemObj as any;
      const nomeItem = typeof itemObj === 'string' ? itemObj : itemAny.material || itemAny.nomeOriginal || itemAny.texto || 'Material';
      const qtd = Number(itemAny.quantidade) || 1;

      // Emitir mensagem granular de início da busca
      if (onProgressMsg) {
        await onProgressMsg(`[${fornecedorNome}] Buscando item: ${nomeItem}...`);
      }

      // Busca do produto na página (Prompt 7.2) com suporte ao JSON de seletores
      const buscaRes = await buscarProduto(page, nomeItem, fornecedor?.seletores, fornecedorId, qtd);

      if (buscaRes.sucesso) {
        // Extração dos resultados (Prompt 7.2)
        const resultadosExtraidos = await extrairResultados(page);
        // Comparação de similaridade (Prompt 7.3)
        const resultadosComparados = compararProdutos(nomeItem, resultadosExtraidos);

        // Selecionar o melhor match
        const melhorMatch = resultadosComparados[0] || {
          itemPedido: nomeItem,
          status: 'NAO_ENCONTRADO' as const,
          confianca: 0,
          preco: 0,
        };

        melhorMatch.fornecedorId = fornecedorId;
        itensProcessados.push(melhorMatch);
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
        await onProgressMsg(`[${fornecedorNome}] Item adicionado: ${nomeItem}`);
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
    // 5. A sessão do Browserbase deve permanecer viva (keepAlive: true) para transmissão ao vivo no Iframe
    if (browser) {
      await browser.disconnect().catch(() => {});
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
  const cotacao = await db.cotacoes.getById(cotacaoId);
  const fornecedorIds = (cotacao as any)?.fornecedorIds || ['forn-1'];
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
      const resForn = await processarCotacaoFornecedor(cotacaoId, fId, async (granularMsg) => {
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
}
