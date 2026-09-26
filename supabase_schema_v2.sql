-- ==========================================
-- SARACOTA DATABASE SCHEMA V2
-- Tabelas para Catalogo Canonico, Matching 3 Niveis,
-- Normalizacao de Precos, Pendencias e Feature Flags
-- ==========================================

-- 1. Produtos Canonicos (Catalogo Mestre da Saratoga)
CREATE TABLE IF NOT EXISTS produtos_canonicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_limpo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  atributos_padrao_json JSONB DEFAULT '{}'::jsonb,
  unidade_base TEXT NOT NULL DEFAULT 'unidade', -- ex: 'metro', 'unidade', 'kg', 'litro'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para busca por categoria e nome
CREATE INDEX IF NOT EXISTS idx_produtos_canonicos_categoria ON produtos_canonicos(categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_canonicos_nome_limpo ON produtos_canonicos(nome_limpo);

-- 2. Sinonimos por Fornecedor (Tabela Depara - Nivel 1 do Matching)
CREATE TABLE IF NOT EXISTS sinonimos_por_fornecedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  nome_bruto_fornecedor TEXT NOT NULL,
  nome_limpo_hash TEXT,
  produto_canonico_id UUID NOT NULL REFERENCES produtos_canonicos(id) ON DELETE CASCADE,
  criado_por_usuario BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fornecedor_id, nome_bruto_fornecedor)
);

CREATE INDEX IF NOT EXISTS idx_sinonimos_fornecedor_nome ON sinonimos_por_fornecedor(fornecedor_id, nome_bruto_fornecedor);

-- 3. Precos Normalizados por Unidade-Base
CREATE TABLE IF NOT EXISTS precos_normalizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  produto_canonico_id UUID REFERENCES produtos_canonicos(id) ON DELETE SET NULL,
  sku_fornecedor TEXT NOT NULL,
  nome_original TEXT NOT NULL,
  categoria_site TEXT,
  preco_original NUMERIC(10,2) NOT NULL,
  unidade_original TEXT NOT NULL,
  fator_conversao_base NUMERIC(10,4) NOT NULL DEFAULT 1.0,
  preco_unitario_base NUMERIC(10,4) NOT NULL,
  unidade_base TEXT NOT NULL DEFAULT 'unidade',
  url_produto TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fornecedor_id, sku_fornecedor)
);

CREATE INDEX IF NOT EXISTS idx_precos_normalizados_canonico ON precos_normalizados(produto_canonico_id);

-- 4. Itens Pendentes de Revisao (Fila de Nivel 3)
CREATE TABLE IF NOT EXISTS itens_pendentes_revisao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id UUID REFERENCES cotacoes(id) ON DELETE CASCADE,
  item_lista_id UUID REFERENCES itens_lista(id) ON DELETE CASCADE,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE CASCADE,
  nome_bruto TEXT NOT NULL,
  categoria TEXT,
  candidatos_json JSONB DEFAULT '[]'::jsonb, -- sugestoes de produtos canonicos calculados no Nivel 2
  status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'vinculado', 'ignorado'
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  resolvido_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_itens_pendentes_status ON itens_pendentes_revisao(status);

-- 5. Feature Flags por Cliente
CREATE TABLE IF NOT EXISTS configuracoes_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL UNIQUE REFERENCES clientes(id) ON DELETE CASCADE,
  auto_substituir_equivalente BOOLEAN NOT NULL DEFAULT TRUE,
  aceitar_embalagem_multipla BOOLEAN NOT NULL DEFAULT TRUE,
  permitir_matching_semantico_nivel2 BOOLEAN NOT NULL DEFAULT TRUE,
  notificar_pendencia_whatsapp BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
