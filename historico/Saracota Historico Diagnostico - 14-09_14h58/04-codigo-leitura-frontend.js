/**
 * CÓDIGO DA LEITURA DE RESULTADOS NO FRONTEND SARACOTA
 * Arquivo de Origem: context/CotacoesContext.tsx e components/features/CotacoesView.tsx
 */

// 1. Função de Leitura das Cotações no Banco de Dados (context/CotacoesContext.tsx)
const carregarCotacoesDoBanco = useCallback(async () => {
  setIsLoadingCotacoes(true);
  setErrorCotacoes(null);
  try {
    // Busca registros da tabela "cotacoes"
    const listaDb = await db.cotacoes.list();
    
    // Mapeamento simples sem fazer JOIN completo com itens_cotacao_fornecedor ou cotacao_fornecedor_sessoes
    const cotacoesFormatadas = listaDb.map((c) => ({
      id: c.id,
      codigo: c.codigoCotacao,
      obra: c.projeto?.nomeObra || 'Reserva das Palmeiras',
      categoriaPrincipal: c.categoriaPrincipal || 'eletrica',
      dataCriacao: c.dataCriacao || 'Hoje',
      status: c.status === 'aprovada' ? 'aprovada' : c.status === 'recusada' ? 'recusada' : 'em_analise',
      itens: (c.itens || []).map((it) => ({
        id: it.id,
        material: {
          id: it.produtoId || 'mat-1',
          nome: it.nomeOriginal,
          ncm: it.ncm || '8544.49.00',
          categoria: 'eletrica',
          precoBaseUnitario: it.precosFornecedores?.[0]?.precoUnitario || 10,
          unidade: it.unidade || 'unidades',
          icmsStPercent: 12,
        },
        quantidade: it.quantidade,
      })),
      fornecedores: [
        {
          id: 'forn-1',
          nome: c.melhorFornecedorNome || 'Lojista Credenciado',
          score: 4.9,
          fatorPreco: 0.92,
          prazoDias: 1,
          matchingStatus: 'exato',
          valorProdutos: c.valorTotalProdutos,
          valorST: c.valorTotalST,
          valorTotalGeral: c.valorTotalGeral,
          isVencedor: true,
        },
      ],
      fornecedorVencedorNome: c.melhorFornecedorNome || 'Lojista Credenciado',
      valorTotalGeral: c.valorTotalGeral,
      valorTotalSTTotal: c.valorTotalST,
      economiaEstimadaBRL: c.economiaEstimadaBRL,
    }));

    setCotacoesAtivas(cotacoesFormatadas);
    if (cotacoesFormatadas.length > 0) {
      setCotacaoSelecionadaParaResultado(cotacoesFormatadas[0]);
    }
  } catch (err) {
    setErrorCotacoes(err.message || 'Erro ao carregar cotações do banco de dados.');
  } finally {
    setIsLoadingCotacoes(false);
  }
}, []);

// 2. Método list() em lib/db/client.ts que busca registros de "cotacoes"
async function list() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('cotacoes')
    .select('*, fornecedores:fornecedor_id(*), itens:itens_cotacao(*)')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data;
}
