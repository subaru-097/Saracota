# Código Alterado (Antes x Depois)

## 1. `lib/db/client.ts` — Função `list()`

### ANTES:
```typescript
async list(): Promise<Cotacao[]> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('cotacoes')
        .select(`
          *,
          fornecedores(*),
          itens_cotacao(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Erro ao listar cotações no Supabase, usando memória:', error);
      } else if (data) {
        return data as any[];
      }
    } catch (e) {
      console.warn('Falha na requisição list cotações:', e);
    }
  }

  return memoryDb.cotacoes;
}
```

### DEPOIS:
```typescript
async list(): Promise<Cotacao[]> {
  if (isSupabaseConfigured() && supabase) {
    try {
      // 1. Tentar JOIN nativo via Embedded Select (se chave estrangeira estiver declarada no schema)
      const { data, error } = await supabase
        .from('cotacoes')
        .select(`
          *,
          itens_cotacao_fornecedor(*),
          cotacao_fornecedor_sessoes(*)
        `)
        .order('criado_em', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as any[];
      }

      // 2. Fallback resiliente multi-tabela (se JOIN de relacionamento não estiver cached no PostgREST)
      const { data: cotacoesData, error: cotError } = await supabase
        .from('cotacoes')
        .select('*')
        .order('criado_em', { ascending: false });

      if (!cotError && cotacoesData && cotacoesData.length > 0) {
        const cotacaoIds = cotacoesData.map((c: any) => c.id);

        const { data: itensData } = await supabase
          .from('cotacao_itens')
          .select('*')
          .in('cotacao_id', cotacaoIds);

        const { data: sessoesData } = await supabase
          .from('cotacao_fornecedor_sessoes')
          .select('*')
          .in('cotacao_id', cotacaoIds);

        const cotacoesCompletas = cotacoesData.map((c: any) => {
          const itensRelacionados = (itensData || []).filter((i: any) => i.cotacao_id === c.id);
          const sessoesRelacionadas = (sessoesData || []).filter((s: any) => s.cotacao_id === c.id);

          return {
            ...c,
            itens_cotacao_fornecedor: itensRelacionados,
            cotacao_fornecedor_sessoes: sessoesRelacionadas,
            itens_cotacao: itensRelacionados,
          };
        });

        return cotacoesCompletas as any[];
      }
    } catch (e) {
      console.warn('Falha na requisição list cotações:', e);
    }
  }

  return memoryDb.cotacoes;
}
```

---

## 2. `context/CotacoesContext.tsx` — Função `carregarCotacoesDoBanco`

### ANTES:
```typescript
const carregarCotacoesDoBanco = useCallback(async () => {
  setIsLoadingCotacoes(true);
  setErrorCotacoes(null);
  try {
    const cotacoesBanco = await db.cotacoes.list();

    const cotacoesMapeadas = (cotacoesBanco || []).map((cotDb: any, idx: number) => {
      const fornList = [
        {
          id: '33e03495-100d-45a3-9e34-899de56b0ab1',
          nome: 'Lojista Credenciado',
          score: 4.9,
          fatorPreco: 0.92,
          prazoDias: 2,
          matchingStatus: 'exato',
          valorProdutos: Number((cotDb.valor_total || 2500) * 0.92),
          valorST: 4.90,
          valorTotalGeral: cotDb.valor_total || 2500,
          urlCarrinhoDireto: 'https://cicalfer.com.br/carrinho',
          itensCotados: [],
        }
      ];
      // ... mock values e score 4.9 ...
    });

    setCotacoesAtivas(cotacoesMapeadas);
  } catch (err: any) {
    setErrorCotacoes(err.message || 'Falha ao carregar cotações.');
  } finally {
    setIsLoadingCotacoes(false);
  }
}, []);
```

### DEPOIS:
```typescript
const carregarCotacoesDoBanco = useCallback(async () => {
  setIsLoadingCotacoes(true);
  setErrorCotacoes(null);
  try {
    const cotacoesBanco = await db.cotacoes.list();

    const cotacoesMapeadas = (cotacoesBanco || []).map((cotDb: any, idx: number) => {
      const rawItensFornecedor = cotDb.itens_cotacao_fornecedor || cotDb.cotacao_itens || cotDb.itens_cotacao || [];
      const rawSessoesFornecedor = cotDb.cotacao_fornecedor_sessoes || [];

      const itensMapeados = rawItensFornecedor.map((itemDb: any, itemIdx: number) => {
        const precoUnit = Number(itemDb.preco || itemDb.preco_unitario || itemDb.unit_price) || 0;
        const qtd = Number(itemDb.quantidade || itemDb.qtd) || 1;
        const subtotal = Number(itemDb.total_item || itemDb.subtotal || (precoUnit * qtd)) || 0;
        const nomeProd = itemDb.produto_encontrado || itemDb.produtoEncontrado || itemDb.item_pedido || itemDb.material || `Item ${itemIdx + 1}`;
        const nomePed = itemDb.item_pedido || itemDb.itemPedido || itemDb.material || nomeProd;
        const statusItem = (itemDb.status === 'CONFIRMADO' || itemDb.status === 'encontrado') ? 'encontrado' : 'nao_encontrado';

        return {
          itemId: itemDb.id || `item-${itemIdx}`,
          nomeSolicitado: nomePed,
          nomeEncontrado: nomeProd,
          quantidade: qtd,
          unidade: itemDb.unidade || 'un',
          precoUnitario: precoUnit,
          subtotalComSt: Number(subtotal.toFixed(2)),
          status: statusItem,
          link: itemDb.link || rawSessoesFornecedor[0]?.session_id || 'https://cicalfer.com.br/carrinho',
        };
      });

      const totalProdutos = itensMapeados.reduce((acc: number, item: any) => acc + (item.subtotalComSt || 0), 0);
      const sessaoAtiva = rawSessoesFornecedor[0];
      const urlCarrinho = sessaoAtiva?.session_id || sessaoAtiva?.url || 'https://cicalfer.com.br/carrinho';
      const totalPedidoCalc = Number(cotDb.valor_total || totalProdutos) || 0;
      const despesaSTCalc = Number(cotDb.valor_st || (totalPedidoCalc > totalProdutos ? totalPedidoCalc - totalProdutos : 0)) || 0;

      const fornList = [
        {
          id: cotDb.fornecedor_id || '33e03495-100d-45a3-9e34-899de56b0ab1',
          nome: 'Cicalfer Material Elétrico',
          prazoDias: 1,
          matchingStatus: 'exato',
          valorProdutos: Number(totalProdutos.toFixed(2)),
          valorST: Number(despesaSTCalc.toFixed(2)),
          valorTotalGeral: Number(totalPedidoCalc.toFixed(2)),
          urlCarrinhoDireto: urlCarrinho,
          itensCotados: itensMapeados,
        }
      ];

      const codigoExibicao = cotDb.id ? `#${cotDb.id.substring(0, 4).toUpperCase()}` : `#${String(5190 + idx)}`;

      return {
        id: cotDb.id || `cot-db-${idx}`,
        codigo: codigoExibicao,
        obra: cotDb.obra_nome || cotDb.obra || 'Reserva das Palmeiras',
        dataCriacao: cotDb.criado_em ? new Date(cotDb.criado_em).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
        status: cotDb.status === 'concluido' ? 'concluido' : 'aguardando_revisao',
        valorTotalGeral: Number(totalPedidoCalc.toFixed(2)),
        itens: itensMapeados.map((it: any) => ({
          id: it.itemId,
          texto: `${it.quantidade}x ${it.nomeSolicitado}`,
          quantidade: it.quantidade,
          origem: 'texto' as const,
          criadoEm: '15:30',
        })),
        fornecedores: fornList,
      };
    });

    setCotacoesAtivas(cotacoesMapeadas);
    if (cotacoesMapeadas.length > 0) {
      setCotacaoSelecionadaParaResultado(cotacoesMapeadas[0]);
    }
  } catch (err: any) {
    setErrorCotacoes(err.message || 'Falha ao carregar cotações.');
  } font-light {
    setIsLoadingCotacoes(false);
  }
}, []);
```
