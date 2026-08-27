-- ==============================================================================
-- TABELA DE SESSÕES BROWSERBASE POR COTACAO E FORNECEDOR (CHAVE COMPOSTA)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS cotacao_fornecedor_sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id TEXT NOT NULL,
  fornecedor_id TEXT NOT NULL,
  browserbase_session_id TEXT NOT NULL,
  status TEXT DEFAULT 'carrinho_pronto',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unq_cotacao_fornecedor UNIQUE(cotacao_id, fornecedor_id)
);

-- Habilitar RLS com permissão total
ALTER TABLE cotacao_fornecedor_sessoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todos em cotacao_fornecedor_sessoes" ON cotacao_fornecedor_sessoes;
CREATE POLICY "Permitir todos em cotacao_fornecedor_sessoes" ON cotacao_fornecedor_sessoes FOR ALL USING (true) WITH CHECK (true);
