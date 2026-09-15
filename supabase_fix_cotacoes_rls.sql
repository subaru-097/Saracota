-- ==============================================================================
-- SCRIPT DE CORREÇÃO COMPLETA DE RLS NA TABELA COTACOES E COTACAO_ITENS NO SUPABASE
-- Cole e execute no SQL Editor do seu projeto Supabase (https://supabase.com)
-- ==============================================================================

-- 1. Habilitar política RLS pública para cotacoes (elimina o erro 42501 de permissão)
ALTER TABLE cotacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir inserção e seleção pública em cotacoes" ON cotacoes;
CREATE POLICY "Permitir inserção e seleção pública em cotacoes" ON cotacoes FOR ALL USING (true) WITH CHECK (true);

-- 2. Habilitar política RLS pública para cotacao_itens
ALTER TABLE cotacao_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir inserção e seleção pública em cotacao_itens" ON cotacao_itens;
CREATE POLICY "Permitir inserção e seleção pública em cotacao_itens" ON cotacao_itens FOR ALL USING (true) WITH CHECK (true);

-- 3. Habilitar política RLS pública para cotacao_fornecedor_sessoes
ALTER TABLE cotacao_fornecedor_sessoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir inserção e seleção pública em sessoes" ON cotacao_fornecedor_sessoes;
CREATE POLICY "Permitir inserção e seleção pública em sessoes" ON cotacao_fornecedor_sessoes FOR ALL USING (true) WITH CHECK (true);
