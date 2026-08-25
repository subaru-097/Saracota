-- ==============================================================================
-- Migration: 005_add_login_credentials_to_fornecedores.sql
-- Adiciona colunas de credenciais de login (email_login, senha_login)
-- ==============================================================================

ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS email_login TEXT,
  ADD COLUMN IF NOT EXISTS senha_login TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT '61ab64e4-c2cb-46df-bb14-6cc326293085';

-- Copiar valores existentes de login_salvo e senha_criptografada se houver
UPDATE fornecedores 
  SET email_login = COALESCE(email_login, login_salvo),
      senha_login = COALESCE(senha_login, senha_criptografada)
  WHERE email_login IS NULL OR senha_login IS NULL;
