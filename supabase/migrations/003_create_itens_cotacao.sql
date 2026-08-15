-- ==============================================================================
-- Migration: 003_create_itens_cotacao.sql
-- Tabela de Itens de Cotação com Chave Estrangeira para Cotações
-- ==============================================================================

CREATE TABLE IF NOT EXISTS itens_cotacao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cotacao_id UUID NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  material VARCHAR(255) NOT NULL,
  quantidade NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unidade VARCHAR(50) NOT NULL DEFAULT 'unidades',
  preco_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  categoria VARCHAR(50),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice de performance para buscar itens de uma cotação específica
CREATE INDEX IF NOT EXISTS idx_itens_cotacao_cotacao_id ON itens_cotacao(cotacao_id);
