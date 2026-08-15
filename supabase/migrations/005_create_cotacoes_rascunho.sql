-- Migration: 005_create_cotacoes_rascunho.sql
-- Tabela para persistência de rascunhos estilo Bloco de Notas / Lista de Compras
-- com expiração automática em 14 dias (2 semanas) a partir da última edição.

CREATE TABLE IF NOT EXISTS cotacoes_rascunho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id TEXT NOT NULL,
  obra_nome TEXT NOT NULL DEFAULT 'Reserva das Palmeiras',
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'rascunho', -- 'rascunho' | 'finalizada' | 'cancelada'
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_edicao_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days')
);

-- Índices para otimização de busca e job de limpeza
CREATE INDEX IF NOT EXISTS idx_rascunhos_usuario_status ON cotacoes_rascunho(usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_rascunhos_expira_em ON cotacoes_rascunho(expira_em);

-- Função de Limpeza Automática de Rascunhos com mais de 14 dias sem edição
CREATE OR REPLACE FUNCTION expurgar_rascunhos_expirados()
RETURNS INTEGER AS $$
DECLARE
  qtd_removidos INTEGER;
BEGIN
  DELETE FROM cotacoes_rascunho
  WHERE status = 'rascunho'
    AND (expira_em < NOW() OR ultima_edicao_em < (NOW() - INTERVAL '14 days'));
    
  GET DIAGNOSTICS qtd_removidos = ROW_COUNT;
  RETURN qtd_removidos;
END;
$$ LANGUAGE plpgsql;
