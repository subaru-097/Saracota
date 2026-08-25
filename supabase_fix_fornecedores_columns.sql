-- ==============================================================================
-- SCRIPT DE CORREÇÃO COMPLETA DAS COLUNAS DA TABELA FORNECEDORES NO SUPABASE
-- Cole e execute no SQL Editor do seu projeto Supabase (https://supabase.com)
-- ==============================================================================

-- 1. Adicionar colunas faltantes na tabela fornecedores
ALTER TABLE fornecedores 
  ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Elétrica',
  ADD COLUMN IF NOT EXISTS score_confiabilidade NUMERIC DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS prazo_medio_dias NUMERIC DEFAULT 2,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS url_login TEXT,
  ADD COLUMN IF NOT EXISTS login_salvo TEXT,
  ADD COLUMN IF NOT EXISTS senha_criptografada TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW();

-- 2. Habilitar política RLS pública (elimina erro 42501 de permissão)
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todos em fornecedores" ON fornecedores;
CREATE POLICY "Permitir todos em fornecedores" ON fornecedores FOR ALL USING (true) WITH CHECK (true);
