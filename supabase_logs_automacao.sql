-- ==============================================================================
-- SARA COTA SAAS — SCRIPT DE CRIAÇÃO E AJUSTE DA TABELA LOGS_AUTOMACAO
-- Execute este script no SQL Editor do seu projeto Supabase (https://supabase.com)
-- ==============================================================================

-- 1. Garantir a coluna seletores (JSONB) na tabela fornecedores
ALTER TABLE fornecedores 
  ADD COLUMN IF NOT EXISTS seletores JSONB DEFAULT NULL;

-- 2. Garantir/Criar a tabela logs_automacao
CREATE TABLE IF NOT EXISTS logs_automacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL,
  motivo TEXT,
  mensagem TEXT,
  sucesso BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir colunas se a tabela já existia sem motivo
ALTER TABLE logs_automacao ADD COLUMN IF NOT EXISTS motivo TEXT;
ALTER TABLE logs_automacao ADD COLUMN IF NOT EXISTS mensagem TEXT;
ALTER TABLE logs_automacao ADD COLUMN IF NOT EXISTS sucesso BOOLEAN DEFAULT false;

-- 3. Habilitar política RLS pública (elimina erro 42501 de permissão ao gravar logs do robô)
ALTER TABLE logs_automacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todos em logs_automacao" ON logs_automacao;
CREATE POLICY "Permitir todos em logs_automacao" ON logs_automacao FOR ALL USING (true) WITH CHECK (true);
