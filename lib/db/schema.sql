-- ==============================================================================
-- SARA COTA SAAS - SCHEMA DO BANCO DE DADOS POSTGRESQL / SUPABASE
-- Conforme especificação em sara-database-schema e sara-backend-conventions
-- ==============================================================================

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA CLIENTES (Multi-tenant)
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(20) UNIQUE NOT NULL,
  uf_padrao VARCHAR(2) NOT NULL DEFAULT 'SP',
  regime_tributario VARCHAR(50) NOT NULL DEFAULT 'simples', -- 'simples' | 'presumido' | 'real'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA PROJETOS / OBRAS
CREATE TABLE IF NOT EXISTS projetos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome_obra VARCHAR(255) NOT NULL,
  uf_destino VARCHAR(2) NOT NULL DEFAULT 'SP',
  endereco TEXT,
  encarregado_nome VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA FORNECEDORES / LOJISTAS
CREATE TABLE IF NOT EXISTS fornecedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(20),
  url_login VARCHAR(512),
  sessao_criptografada TEXT, -- Criptografado em repouso AES-256
  uf VARCHAR(2) NOT NULL DEFAULT 'SP',
  score_confiabilidade NUMERIC(3, 2) DEFAULT 5.00,
  sla_minutos INTEGER DEFAULT 15,
  acordo_st VARCHAR(255),
  especialidades JSONB DEFAULT '[]'::jsonb,
  verificado BOOLEAN DEFAULT true,
  cotacoes_atendidas_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABELA PRODUTOS / CATÁLOGO TÉCNICO
CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  categoria VARCHAR(50) NOT NULL, -- 'eletrica' | 'hidraulica' | 'estrutura' | 'acabamento' | 'ferragens'
  ncm VARCHAR(20) NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  atributos_json JSONB DEFAULT '{}'::jsonb,
  unidades_disponiveis_json JSONB DEFAULT '[]'::jsonb,
  fator_conversao_metro NUMERIC(10, 2) DEFAULT 1,
  preco_medio_referencia NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  unidade_base VARCHAR(50) NOT NULL DEFAULT 'unidades',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABELA TAX_RULES (REGRAS FISCAIS ICMS-ST)
CREATE TABLE IF NOT EXISTS tax_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ncm VARCHAR(20) NOT NULL,
  uf_origem VARCHAR(2) NOT NULL,
  uf_destino VARCHAR(2) NOT NULL,
  aliquota_icms_origem NUMERIC(5, 4) NOT NULL DEFAULT 0.12,
  aliquota_icms_destino NUMERIC(5, 4) NOT NULL DEFAULT 0.18,
  mva_st NUMERIC(5, 4) NOT NULL DEFAULT 0.40,
  isencao_protocolo VARCHAR(255),
  imposto_estimado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_ncm_uf UNIQUE(ncm, uf_origem, uf_destino)
);

-- 6. TABELA COTACOES / LISTAS
CREATE TABLE IF NOT EXISTS cotacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_cotacao VARCHAR(50) NOT NULL UNIQUE,
  projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'em_analise', -- 'rascunho' | 'aguardando_fornecedores' | 'em_analise' | 'aprovada' | 'finalizada'
  origem VARCHAR(50) NOT NULL DEFAULT 'texto', -- 'texto' | 'audio_whatsapp' | 'manual'
  origem_texto_original TEXT,
  categoria_principal VARCHAR(50) NOT NULL DEFAULT 'eletrica',
  fornecedores_participantes_count INTEGER DEFAULT 0,
  valor_total_produtos NUMERIC(12, 2) DEFAULT 0.00,
  valor_total_st NUMERIC(12, 2) DEFAULT 0.00,
  valor_total_geral NUMERIC(12, 2) DEFAULT 0.00,
  economia_estimada_brl NUMERIC(12, 2) DEFAULT 0.00,
  melhor_fornecedor_nome VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABELA ITENS_COTACAO
CREATE TABLE IF NOT EXISTS itens_cotacao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cotacao_id UUID NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  nome_original VARCHAR(255) NOT NULL,
  ncm VARCHAR(20) NOT NULL,
  atributos_json JSONB DEFAULT '{}'::jsonb,
  quantidade NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unidade VARCHAR(50) NOT NULL DEFAULT 'unidades',
  matching_status VARCHAR(50) NOT NULL DEFAULT 'exato', -- 'exato' | 'similar' | 'indisponivel'
  matching_note TEXT,
  produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
  precos_fornecedores_json JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABELA USUARIOS & AUTH
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nome VARCHAR(255) NOT NULL,
  cargo VARCHAR(50) NOT NULL DEFAULT 'comprador', -- 'comprador' | 'engenheiro' | 'encarregado' | 'administrador'
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_cotacoes_projeto ON cotacoes(projeto_id);
CREATE INDEX IF NOT EXISTS idx_itens_cotacao_cotacao ON itens_cotacao(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_tax_rules_ncm_uf ON tax_rules(ncm, uf_origem, uf_destino);
CREATE INDEX IF NOT EXISTS idx_produtos_sku ON produtos(sku);
