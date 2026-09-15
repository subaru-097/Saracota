/**
 * CÓDIGO EXATO (LINHA POR LINHA) DA FUNÇÃO QUE FAZ O INSERT EM "cotacoes"
 * Arquivo: lib/db/client.ts (Linhas 230 a 336)
 */

async function create(payload: {
  valor_total?: number;
  status?: any;
  fornecedor_id?: string;
  itens?: DBRecordItemCotacao[];
  origem?: string;
  origemTextoOriginal?: string;
  categoriaPrincipal?: string;
  valorTotalProdutos?: number;
  valorTotalST?: number;
  valorTotalGeral?: number;
  economiaEstimadaBRL?: number;
  [key: string]: any;
}): Promise<Cotacao> {
  if (!(globalThis as any).__saracota_quotes_store) {
    (globalThis as any).__saracota_quotes_store = {};
  }

  // Invalidar cotações anteriores do mesmo usuário ao criar uma nova
  await this.invalidarCotacoesAnteriores();

  const createdId = payload.id || `cot-${Date.now()}`;
  const valTotal = payload.valor_total || payload.valorTotalGeral || 0;

  const formattedItens = (payload.itens || []).map((it: any, idx: number) => ({
    id: it.id || `it-${idx}-${Date.now()}`,
    cotacao_id: createdId,
    material: typeof it === 'string' ? it : (it.material || it.texto || 'Material'),
    quantidade: Number(it.quantidade) || 1,
    unidade: it.unidade || 'un',
    preco_unitario: Number(it.preco_unitario) || 0,
    categoria: it.categoria || 'eletrica',
  }));

  const cotacaoRecordLocal: Cotacao = {
    id: createdId,
    codigoCotacao: `#${createdId.substring(0, 4).toUpperCase()}`,
    projeto: {
      id: 'proj-1',
      clienteId: 'cli-1',
      nomeObra: payload.obraNome || 'Reserva das Palmeiras',
      ufDestino: 'SP',
    },
    status: 'em_analise',
    origem: (payload.origem as any) || 'texto',
    origemTextoOriginal: payload.origemTextoOriginal,
    categoriaPrincipal: (payload.categoriaPrincipal as any) || 'eletrica',
    dataCriacao: new Date().toLocaleDateString('pt-BR'),
    itens: formattedItens as any,
    fornecedoresParticipantesCount: payload.fornecedorIds?.length || 1,
    fornecedor_id: payload.fornecedor_id || payload.fornecedorIds?.[0],
    fornecedorIds: payload.fornecedorIds || (payload.fornecedor_id ? [payload.fornecedor_id] : ['33e03495-100d-45a3-9e34-899de56b0ab1']),
    valorTotalProdutos: payload.valorTotalProdutos || valTotal * 0.9,
    valorTotalST: payload.valorTotalST || valTotal * 0.1,
    valorTotalGeral: valTotal,
    economiaEstimadaBRL: payload.economiaEstimadaBRL || valTotal * 0.12,
    melhorFornecedorNome: 'Lojista Credenciado',
  } as any;

  (globalThis as any).__saracota_quotes_store[createdId] = cotacaoRecordLocal;

  if (supabase) {
    try {
      const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const cotacaoRecordDb: any = {
        status: payload.status === 'rascunho' ? 'rascunho' : 'pendente',
        valor_total: valTotal,
      };

      if (payload.id && isUuid(payload.id)) {
        cotacaoRecordDb.id = payload.id;
      }

      // CHAMADA DE INSERÇÃO NO SUPABASE
      const { data: cotData, error: cotErr } = await supabase
        .from('cotacoes')
        .insert([cotacaoRecordDb])
        .select()
        .single();

      if (cotErr) {
        console.warn('[DB WARNING] Inserção de cotação no Supabase falhou (usando armazenamento em memória local):', cotErr.message);
      } else if (cotData) {
        cotacaoRecordLocal.id = cotData.id;
        (globalThis as any).__saracota_quotes_store[cotData.id] = cotacaoRecordLocal;

        if (formattedItens.length > 0) {
          const itensRecords = formattedItens.map((it) => ({
            cotacao_id: cotData.id,
            material: it.material,
            quantidade: it.quantidade,
            unidade: it.unidade,
            preco_unitario: it.preco_unitario,
            categoria: it.categoria || 'eletrica',
          }));

          await (supabase.from('itens_cotacao').insert(itensRecords) as any).catch((e: any) => {
            console.warn('[DB WARNING] Inserção de itens no Supabase falhou:', e.message);
          });
        }
      }
    } catch (e: any) {
      console.warn('[DB WARNING] Exceção ao gravar cotação no Supabase:', e.message);
    }
  }

  return cotacaoRecordLocal;
}
