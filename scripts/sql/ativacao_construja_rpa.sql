-- ==============================================================================
-- SCRIPT DE ATIVAÇÃO DE FORNECEDOR RPA: CONSTRUJÁ
-- Banco de Dados: PostgreSQL / Supabase
-- Padrão: Mesmo padrão utilizado para a Cicalfer
-- ==============================================================================

-- 1. Garante a existência das colunas para controle de automação RPA na tabela `fornecedores`
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS rpa_ativo BOOLEAN DEFAULT FALSE;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS config_slug VARCHAR(100);

-- 2. Ativa o fornecedor Construjá (ID: a1684c4d-d896-4ba9-a591-cda455c5ffe2)
UPDATE fornecedores
SET rpa_ativo = TRUE,
    config_slug = 'construja'
WHERE id = 'a1684c4d-d896-4ba9-a591-cda455c5ffe2'
   OR nome ILIKE '%construja%'
   OR nome ILIKE '%construjá%';

-- 3. Consulta de confirmação do resultado
SELECT 
  id, 
  nome, 
  status, 
  rpa_ativo, 
  config_slug, 
  login_salvo, 
  senha_criptografada IS NOT NULL AS possui_senha_vault
FROM fornecedores
WHERE id = 'a1684c4d-d896-4ba9-a591-cda455c5ffe2'
   OR nome ILIKE '%construja%'
   OR nome ILIKE '%construjá%';
