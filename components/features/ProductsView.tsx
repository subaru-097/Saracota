'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrencyBRL } from '@/lib/utils';
import { useProductMatching } from '@/hooks/useProductMatching';
import { CategoriaProduto } from '@/types';
import { Search, Zap, SlidersHorizontal, Plus, ArrowRightLeft, Sparkles } from 'lucide-react';

export const ProductsView: React.FC = () => {
  const { query, setQuery, categoria, setCategoria, results, exactMatchesCount } = useProductMatching();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sara-border">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light border border-brand/30 text-brand text-xs font-mono mb-2">
            <Zap className="w-3.5 h-3.5" />
            Normalização & Atributos Técnicos (sara-matching-produtos)
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content-primary">
            Catálogo de Materiais
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary font-light mt-1">
            Pesquise itens por bitola, diâmetro, voltagem ou NCM fiscal para padronização.
          </p>
        </div>

        <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4 text-black" />}>
          Cadastrar Novo Material
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-8">
          <Input
            placeholder="Pesquisar por nome, NCM, SKU ou bitola (ex: 2.5mm, 100mm, 750V)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-content-tertiary" />}
          />
        </div>
        <div className="sm:col-span-4">
          <Select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaProduto | 'todos')}
            leftIcon={<SlidersHorizontal className="w-4 h-4 text-content-tertiary" />}
          >
            <option value="todos">Todas as Categorias</option>
            <option value="eletrica">Elétrica & Fiação</option>
            <option value="hidraulica">Tubos & Hidráulica</option>
            <option value="estrutura">Estrutura & Cimento</option>
          </Select>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-sara-surface border border-sara-border text-xs font-mono">
        <span className="text-content-secondary">
          Resultados do Matching: <strong className="text-brand">{results.length} materiais encontrados</strong>
        </span>
        <Badge variant="emerald" size="sm">
          {exactMatchesCount} Match Exato
        </Badge>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map(({ produto, matchingStatus, motivoDiferenca }) => (
          <Card key={produto.id} variant="default" className="hover:border-brand/40 transition-colors">
            <CardHeader className="pb-3 border-b border-sara-border">
              <div className="flex items-center justify-between">
                <Badge variant={produto.categoria === 'eletrica' ? 'cyan' : 'brand'} size="sm">
                  {produto.categoria.toUpperCase()}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Badge variant={matchingStatus === 'exato' ? 'emerald' : 'brand'} size="sm">
                    {matchingStatus === 'exato' ? 'Match Exato' : 'Match Similar'}
                  </Badge>
                  <span className="text-[11px] font-mono text-content-tertiary">
                    SKU: {produto.sku}
                  </span>
                </div>
              </div>

              <CardTitle className="text-base mt-1">{produto.nome}</CardTitle>
              <CardDescription className="font-mono">
                NCM: {produto.ncm}
              </CardDescription>

              {motivoDiferenca && (
                <span className="text-[10px] font-mono text-amber-400 block pt-1">
                  Nota: {motivoDiferenca}
                </span>
              )}
            </CardHeader>

            <CardContent className="pt-3 space-y-3 text-xs">
              {/* Technical Attributes Grid */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-content-tertiary block">
                  Atributos Técnicos Extraídos:
                </span>
                <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                  {Object.entries(produto.atributos).map(([key, val]) => (
                    <span
                      key={key}
                      className="px-2 py-0.5 rounded bg-sara-elevated border border-sara-border text-content-secondary"
                    >
                      <strong className="text-content-primary capitalize">{key}:</strong> {val}
                    </span>
                  ))}
                </div>
              </div>

              {/* Unit Conversions Supported */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-mono uppercase text-content-tertiary flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3 text-brand" /> Conversão de Unidades Suportada:
                </span>
                <div className="flex flex-wrap gap-1">
                  {produto.unidadesDisponiveis.map((fmt) => (
                    <span
                      key={fmt}
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-brand-light text-brand border border-brand/20"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>

              {/* Price Indicator */}
              <div className="pt-2 border-t border-sara-border flex items-center justify-between font-mono">
                <span className="text-content-tertiary text-xs">Preço Médio de Referência:</span>
                <span className="text-base font-bold text-brand">
                  {formatCurrencyBRL(produto.precoMedioReferencia)} /{produto.unidadeBase}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
