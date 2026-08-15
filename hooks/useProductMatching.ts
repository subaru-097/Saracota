'use client';

import { useState, useMemo, useEffect } from 'react';
import { Produto, CategoriaProduto } from '@/types';
import { processarMatchingTecnico, MatchResult } from '@/lib/services/matching';
import { db } from '@/lib/db/client';

export function useProductMatching(
  initialQuery: string = '',
  categoriaFilter: CategoriaProduto | 'todos' = 'todos'
) {
  const [query, setQuery] = useState(initialQuery);
  const [categoria, setCategoria] = useState<CategoriaProduto | 'todos'>(categoriaFilter);
  const [produtosBase, setProdutosBase] = useState<Produto[]>([]);

  useEffect(() => {
    async function carregarProdutos() {
      const lista = await db.produtos.list();
      setProdutosBase(lista);
    }
    carregarProdutos();
  }, []);

  const results: MatchResult[] = useMemo(() => {
    const produtosFiltrados = categoria === 'todos'
      ? produtosBase
      : produtosBase.filter((p) => p.categoria === categoria);

    return processarMatchingTecnico(query, undefined, produtosFiltrados);
  }, [query, categoria, produtosBase]);

  return {
    query,
    setQuery,
    categoria,
    setCategoria,
    results,
    totalCount: results.length,
    exactMatchesCount: results.filter((r) => r.matchingStatus === 'exato').length,
  };
}
