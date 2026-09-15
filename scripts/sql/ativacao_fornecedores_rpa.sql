-- ==============================================================================
-- SCRIPT DE ONBOARDING E ATIVAÇÃO DE FORNECEDORES RPA — SARA COTA SAAS
-- Banco de Dados: PostgreSQL / Supabase
-- Execução: Idempotente (UPDATE se existir, INSERT caso ainda não esteja cadastrado)
-- ==============================================================================

-- 1. Garante que as colunas de controle de RPA existam na tabela `fornecedores`
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS rpa_ativo BOOLEAN DEFAULT FALSE;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS config_slug VARCHAR(100);
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS url_portal_b2b VARCHAR(255);
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS email_login VARCHAR(255);
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS senha_criptografada TEXT;

-- ------------------------------------------------------------------------------
-- FORNECEDOR 1: CICALFER
-- ------------------------------------------------------------------------------
UPDATE fornecedores
SET rpa_ativo = TRUE,
    config_slug = 'cicalfer',
    url_portal_b2b = 'https://cicalfer.com.br/',
    categoria = 'Elétrica e Hidráulica'
WHERE nome ILIKE '%cicalfer%' OR id = '33e03495-100d-45a3-9e34-899de56b0ab1';

-- ------------------------------------------------------------------------------
-- FORNECEDOR 2: CONSTRUTOR
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM fornecedores WHERE nome ILIKE '%construtor%') THEN
    UPDATE fornecedores
    SET rpa_ativo = TRUE,
        config_slug = 'construtor',
        url_portal_b2b = 'https://www.brasilconstrutor.com/',
        categoria = 'Materiais de Construção'
    WHERE nome ILIKE '%construtor%';
  ELSE
    INSERT INTO fornecedores (
      id,
      nome,
      categoria,
      score_confiabilidade,
      prazo_medio_dias,
      sla_minutos,
      rpa_ativo,
      config_slug,
      url_portal_b2b,
      email_login
    ) VALUES (
      '8f12a450-7819-4b12-9c31-1002348192ab',
      'Construtor Material de Construção',
      'Materiais de Construção',
      5.0,
      2,
      15,
      TRUE,
      'construtor',
      'https://www.brasilconstrutor.com/',
      'vendas@brasilconstrutor.com'
    );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- FORNECEDOR 3: MEGALESTE
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM fornecedores WHERE nome ILIKE '%megaleste%') THEN
    UPDATE fornecedores
    SET rpa_ativo = TRUE,
        config_slug = 'megaleste',
        url_portal_b2b = 'https://www.megaleste.com.br/',
        categoria = 'Atacado e Construção'
    WHERE nome ILIKE '%megaleste%';
  ELSE
    INSERT INTO fornecedores (
      id,
      nome,
      categoria,
      score_confiabilidade,
      prazo_medio_dias,
      sla_minutos,
      rpa_ativo,
      config_slug,
      url_portal_b2b,
      email_login
    ) VALUES (
      '9b34c120-410a-4290-8e12-3004569123cd',
      'Megaleste Distribuidora de Materiais',
      'Atacado e Construção',
      4.9,
      2,
      15,
      TRUE,
      'megaleste',
      'https://www.megaleste.com.br/',
      'vendas@megaleste.com.br'
    );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- FORNECEDOR 4: SECOFAIR
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM fornecedores WHERE nome ILIKE '%secofair%') THEN
    UPDATE fornecedores
    SET rpa_ativo = TRUE,
        config_slug = 'secofair',
        url_portal_b2b = 'https://www.secofair.com.br/',
        categoria = 'Elétrica e Metais'
    WHERE nome ILIKE '%secofair%';
  ELSE
    INSERT INTO fornecedores (
      id,
      nome,
      categoria,
      score_confiabilidade,
      prazo_medio_dias,
      sla_minutos,
      rpa_ativo,
      config_slug,
      url_portal_b2b,
      email_login
    ) VALUES (
      '5f884210-9e12-4c22-921a-8c5e9b7722bb',
      'Secofair Material Elétrico',
      'Elétrica e Metais',
      4.9,
      2,
      15,
      TRUE,
      'secofair',
      'https://www.secofair.com.br/',
      'vendas@secofair.com.br'
    );
  END IF;
END $$;

-- Confirmar resultado da ativação
SELECT id, nome, rpa_ativo, config_slug, url_portal_b2b FROM fornecedores WHERE rpa_ativo = TRUE;
