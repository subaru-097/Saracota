-- ==============================================================================
-- SARA COTA SAAS — SCRIPT OFICIAL DE CRIAÇÃO DAS TABELAS DO BANCO SUPABASE
-- Execute este script no SQL Editor do seu projeto Supabase (https://supabase.com)
-- ==============================================================================

-- 1. TABELA DE FORNECEDORES
CREATE TABLE IF NOT EXISTS fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT DEFAULT 'Elétrica',
  score_confiabilidade NUMERIC DEFAULT 5.0,
  prazo_medio_dias NUMERIC DEFAULT 2,
  whatsapp TEXT,
  url_login TEXT,
  login_salvo TEXT,
  senha_criptografada TEXT,
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE COTAÇÕES
CREATE TABLE IF NOT EXISTS cotacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'pendente',
  valor_total NUMERIC DEFAULT 0,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  data_criacao TIMESTAMPTZ DEFAULT NOW(),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE ITENS DA COTAÇÃO
CREATE TABLE IF NOT EXISTS itens_cotacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id UUID REFERENCES cotacoes(id) ON DELETE CASCADE,
  material TEXT NOT NULL,
  quantidade NUMERIC DEFAULT 1,
  unidade TEXT DEFAULT 'un',
  preco_unitario NUMERIC DEFAULT 0,
  categoria TEXT DEFAULT 'eletrica',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA DE RASCUNHOS DE COTAÇÃO (BLOCO DE NOTAS / VOZ)
CREATE TABLE IF NOT EXISTS cotacoes_rascunho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id TEXT NOT NULL,
  obra_nome TEXT DEFAULT 'Reserva das Palmeiras',
  itens JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'rascunho',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  ultima_edicao_em TIMESTAMPTZ DEFAULT NOW(),
  expira_em TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days')
);

-- 5. TABELA DE RESULTADOS DE MATCHING DE FORNECEDOR
CREATE TABLE IF NOT EXISTS itens_cotacao_fornecedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id UUID REFERENCES cotacoes(id) ON DELETE CASCADE,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE CASCADE,
  material TEXT NOT NULL,
  produto_encontrado TEXT,
  preco_unitario NUMERIC DEFAULT 0,
  confianca_percent NUMERIC DEFAULT 0,
  status_matching TEXT DEFAULT 'CONFIRMADO',
  imagem TEXT,
  link TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- REGRAS DE SEGURANÇA (RLS - ROW LEVEL SECURITY) COM ACESSO PÚBLICO ANÔNIMO
-- ==============================================================================

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todos em fornecedores" ON fornecedores;
CREATE POLICY "Permitir todos em fornecedores" ON fornecedores FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE cotacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todos em cotacoes" ON cotacoes;
CREATE POLICY "Permitir todos em cotacoes" ON cotacoes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE itens_cotacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todos em itens_cotacao" ON itens_cotacao;
CREATE POLICY "Permitir todos em itens_cotacao" ON itens_cotacao FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE cotacoes_rascunho ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todos em cotacoes_rascunho" ON cotacoes_rascunho;
CREATE POLICY "Permitir todos em cotacoes_rascunho" ON cotacoes_rascunho FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE itens_cotacao_fornecedor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todos em itens_cotacao_fornecedor" ON itens_cotacao_fornecedor;
CREATE POLICY "Permitir todos em itens_cotacao_fornecedor" ON itens_cotacao_fornecedor FOR ALL USING (true) WITH CHECK (true);
