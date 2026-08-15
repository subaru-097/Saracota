-- ==============================================================================
-- Migration: 002_create_cotacoes.sql
-- Tabela de Cotações com Chave Estrangeira para Fornecedores e Índices de Performance
-- ==============================================================================

CREATE TABLE IF NOT EXISTS cotacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'pendente', -- 'pendente' | 'aprovada' | 'recusada'
  valor_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices de performance para otimização de busca por status e data
CREATE INDEX IF NOT EXISTS idx_cotacoes_status ON cotacoes(status);
CREATE INDEX IF NOT EXISTS idx_cotacoes_data_criacao ON cotacoes(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_cotacoes_fornecedor_id ON cotacoes(fornecedor_id);
