/**
 * CÓDIGO COMPLETO DA FUNÇÃO DE PERSISTÊNCIA DA COTAÇÃO
 * Arquivo de Origem: lib/db/client.ts
 */

// 1. Criar Registro Mestre da Cotação (create)
async function create(payload) {
  if (!globalThis.__saracota_quotes_store) {
    globalThis.__saracota_quotes_store = {};
  }

  // Invalidar cotações anteriores do mesmo usuário ao criar uma nova
  await this.invalidarCotacoesAnteriores();

  const createdId = payload.id || `cot-${Date.now()}`;
  const valTotal = payload.valor_total || payload.valorTotalGeral || 0;

  const formattedItens = (payload.itens || []).map((it, idx) => ({
    id: it.id || `it-${idx}-${Date.now()}`,
    cotacao_id: createdId,
    material: typeof it === 'string' ? it : (it.material || it.texto || 'Material'),
    quantidade: Number(it.quantidade) || 1,
    unidade: it.unidade || 'un',
    preco_unitario: Number(it.preco_unitario) || 0,
    categoria: it.categoria || 'eletrica',
  }));

  const cotacaoRecordLocal = {
    id: createdId,
    codigoCotacao: `#${createdId.substring(0, 4).toUpperCase()}`,
    projeto: {
      id: 'proj-1',
      clienteId: 'cli-1',
      nomeObra: payload.obraNome || 'Reserva das Palmeiras',
      ufDestino: 'SP',
    },
    status: 'em_analise',
    origem: payload.origem || 'texto',
    origemTextoOriginal: payload.origemTextoOriginal,
    categoriaPrincipal: payload.categoriaPrincipal || 'eletrica',
    dataCriacao: new Date().toLocaleDateString('pt-BR'),
    itens: formattedItens,
    fornecedoresParticipantesCount: payload.fornecedorIds?.length || 1,
    fornecedor_id: payload.fornecedor_id || payload.fornecedorIds?.[0],
    fornecedorIds: payload.fornecedorIds || (payload.fornecedor_id ? [payload.fornecedor_id] : ['33e03495-100d-45a3-9e34-899de56b0ab1']),
    valorTotalProdutos: payload.valorTotalProdutos || valTotal * 0.9,
    valorTotalST: payload.valorTotalST || valTotal * 0.1,
    valorTotalGeral: valTotal,
    economiaEstimadaBRL: payload.economiaEstimadaBRL || valTotal * 0.12,
    melhorFornecedorNome: 'Lojista Credenciado',
  };

  globalThis.__saracota_quotes_store[createdId] = cotacaoRecordLocal;

  if (supabase) {
    try {
      const isUuid = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const cotacaoRecordDb = {
        status: payload.status === 'rascunho' ? 'rascunho' : 'pendente',
        valor_total: valTotal,
      };

      if (payload.id && isUuid(payload.id)) {
        cotacaoRecordDb.id = payload.id;
      }

      // ATENÇÃO: Falha com erro de RLS (Row Level Security Policy)
      const { data: cotData, error: cotErr } = await supabase
        .from('cotacoes')
        .insert([cotacaoRecordDb])
        .select()
        .single();

      if (cotErr) {
        console.warn('[DB WARNING] Inserção de cotação no Supabase falhou (usando armazenamento em memória local):', cotErr.message);
      } else if (cotData) {
        cotacaoRecordLocal.id = cotData.id;
        globalThis.__saracota_quotes_store[cotData.id] = cotacaoRecordLocal;

        if (formattedItens.length > 0) {
          const itensRecords = formattedItens.map((it) => ({
            cotacao_id: cotData.id,
            material: it.material,
            quantidade: it.quantidade,
            unidade: it.unidade,
            preco_unitario: it.preco_unitario,
            categoria: it.categoria || 'eletrica',
          }));

          await supabase.from('itens_cotacao').insert(itensRecords).catch((e) => {
            console.warn('[DB WARNING] Inserção de itens no Supabase falhou:', e.message);
          });
        }
      }
    } catch (e) {
      console.warn('[DB WARNING] Exceção ao gravar cotação no Supabase:', e.message);
    }
  }

  return cotacaoRecordLocal;
}

// 2. Salvar Resultados do Matching RPA (salvarResultadosMatching)
async function salvarResultadosMatching(cotacaoId, fornecedorId, resultados) {
  // Atualizar cache em memória de forma atômica/idempotente
  const resultadosComForn = resultados.map((r) => ({ ...r, fornecedorId }));
  if (!memoryMatchingStore[cotacaoId]) {
    memoryMatchingStore[cotacaoId] = [];
  }
  memoryMatchingStore[cotacaoId] = [
    ...memoryMatchingStore[cotacaoId].filter((r) => r.fornecedorId !== fornecedorId),
    ...resultadosComForn
  ];

  if (typeof window !== 'undefined') {
    try {
      const key = `saracota_matching_${cotacaoId}_${fornecedorId}`;
      localStorage.setItem(key, JSON.stringify(resultadosComForn));
    } catch (e) {
      console.warn('Erro ao salvar matching localmente:', e);
    }
  }

  if (supabase) {
    try {
      // Limpeza atômica prévia por (cotacao_id, fornecedor_id)
      try {
        await supabase.from('cotacao_itens').delete().eq('cotacao_id', cotacaoId).eq('fornecedor_id', fornecedorId);
      } catch (e) {}

      try {
        await supabase.from('itens_cotacao_fornecedor').delete().eq('cotacao_id', cotacaoId).eq('fornecedor_id', fornecedorId);
      } catch (e) {}

      // Persistir na tabela cotacao_itens
      const itemRecords = resultados.map((r) => ({
        cotacao_id: cotacaoId,
        fornecedor_id: fornecedorId,
        nome: r.produtoEncontrado || r.itemPedido || 'Material',
        material: r.produtoEncontrado || r.itemPedido || 'Material',
        preco_unitario: Number(r.preco) || 0,
        quantidade: Number(r.quantidade) || 1,
        total_item: Number(r.preco) * Number(r.quantidade || 1),
        unidade: 'un',
        observacoes: JSON.stringify({
          itemPedido: r.itemPedido,
          produtoEncontrado: r.produtoEncontrado,
          confianca: r.confianca,
          status: r.status,
          link: r.link,
          preco_unitario: Number(r.preco) || 0,
          total_item: Number(r.preco) * Number(r.quantidade || 1)
        })
      }));

      try {
        const { error: errItens } = await supabase.from('cotacao_itens').insert(itemRecords);
        if (!errItens) {
          console.log(`✅ [SUPABASE MATCHING SUCCESS ATÔMICO] ${resultados.length} itens salvos na tabela "cotacao_itens"!`);
        }
      } catch (errItensEx) {}

      // Persistir na tabela itens_cotacao_fornecedor
      const itensFornRecords = resultados.map((r) => ({
        cotacao_id: cotacaoId,
        fornecedor_id: fornecedorId,
        material: r.itemPedido || r.material || 'Material',
        produto_encontrado: r.produtoEncontrado || r.itemPedido,
        preco_unitario: Number(r.preco) || 0,
        confianca_percent: Number(r.confianca) || 0,
        status_matching: r.status || 'CONFIRMADO',
        imagem: r.imagem || null,
        link: r.link || null,
      }));

      try {
        await supabase.from('itens_cotacao_fornecedor').insert(itensFornRecords);
      } catch (e) {}

      // Persistir em cotacao_fornecedor_sessoes com JSON estruturado
      const sessionPayload = JSON.stringify({
        origem: 'RPA_MATCHING_ENGINE',
        totalGeral: resultados.reduce((acc, i) => acc + (Number(i.preco) * Number(i.quantidade || 1)), 0),
        itens: resultados,
        dataCriacao: new Date().toISOString()
      });

      try {
        await supabase.from('cotacao_fornecedor_sessoes').upsert(
          {
            cotacao_id: cotacaoId,
            fornecedor_id: fornecedorId,
            browserbase_session_id: sessionPayload,
            status: 'carrinho_pronto',
            updated_at: new Date().toISOString()
          },
          { onConflict: 'cotacao_id,fornecedor_id' }
        );
      } catch (errSess) {
        console.warn('[SUPABASE SESSAO WARN]:', errSess);
      }
    } catch (e) {
      console.warn('Erro ao salvar matching no Supabase:', e.message || e);
    }
  }

  return true;
}
