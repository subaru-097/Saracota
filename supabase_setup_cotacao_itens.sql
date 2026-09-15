-- ==============================================================================
-- SCRIPT DE AJUSTE DE COLUNAS E HABILITAÇÃO RLS PARA COTACOES E COTACAO_ITENS
-- Execute este script no SQL Editor do seu Supabase (https://supabase.com)
-- ==============================================================================

-- 1. TABELA DE COTAÇÕES
CREATE TABLE IF NOT EXISTS cotacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'concluido',
  valor_total NUMERIC DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cotacoes 
  ADD COLUMN IF NOT EXISTS valor_total NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'concluido';

-- Libera política RLS pública de inserção/leitura na tabela cotacoes
ALTER TABLE cotacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todos em cotacoes" ON cotacoes;
CREATE POLICY "Permitir todos em cotacoes" ON cotacoes FOR ALL USING (true) WITH CHECK (true);


-- 2. TABELA DE ITENS DA COTAÇÃO
CREATE TABLE IF NOT EXISTS cotacao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id UUID REFERENCES cotacoes(id) ON DELETE CASCADE,
  codigo_produto TEXT,
  codigo_badge TEXT,
  embalagem TEXT,
  nome TEXT,
  preco_unitario NUMERIC DEFAULT 0,
  quantidade NUMERIC DEFAULT 1,
  total_item NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cotacao_itens
  ADD COLUMN IF NOT EXISTS codigo_produto TEXT,
  ADD COLUMN IF NOT EXISTS codigo_badge TEXT,
  ADD COLUMN IF NOT EXISTS embalagem TEXT,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS preco_unitario NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_item NUMERIC DEFAULT 0;

-- Libera política RLS pública de inserção/leitura na tabela cotacao_itens
ALTER TABLE cotacao_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todos em cotacao_itens" ON cotacao_itens;
CREATE POLICY "Permitir todos em cotacao_itens" ON cotacao_itens FOR ALL USING (true) WITH CHECK (true);
