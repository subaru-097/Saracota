-- Migration 006: Adiciona campos de cookie/LGPD para fornecedores
-- Tabela: fornecedores

ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS requires_cookie_dismissal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cookie_selector_hint TEXT;

-- Atualizar registro do fornecedor Construjá com consentimento ativo
UPDATE fornecedores
SET requires_cookie_dismissal = true,
    cookie_selector_hint = 'button:has-text("Aceitar todos")'
WHERE nome ILIKE '%construja%' OR nome ILIKE '%construjá%';
