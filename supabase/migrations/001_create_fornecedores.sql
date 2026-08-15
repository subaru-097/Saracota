-- ==============================================================================
-- Migration: 001_create_fornecedores.sql
-- Tabela de Fornecedores / Lojistas Credenciados
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS fornecedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  categoria VARCHAR(100) NOT NULL DEFAULT 'Geral',
  score_confiabilidade NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
  prazo_medio_dias INTEGER NOT NULL DEFAULT 2,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
