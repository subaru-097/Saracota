-- ==============================================================================
-- Migration: 004_seed_test_data.sql
-- Script de Seed (Dados de Teste) para Validação das Tabelas e Relacionamentos
-- ==============================================================================

-- 1. Inserir Fornecedores de Teste
INSERT INTO fornecedores (id, nome, categoria, score_confiabilidade, prazo_medio_dias)
VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Elétrica São Paulo', 'Elétrica & Fiação', 4.90, 1),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Hidráulica & Elétrica Central', 'Tubos & Hidráulica', 4.70, 2),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Lojista Comercial ABC', 'Cimento & Ferragens', 4.20, 4)
ON CONFLICT (id) DO NOTHING;

-- 2. Inserir Cotação de Teste vinculada a um fornecedor
INSERT INTO cotacoes (id, data_criacao, status, valor_total, fornecedor_id)
VALUES 
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', CURRENT_TIMESTAMP, 'aprovada', 4661.00, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
ON CONFLICT (id) DO NOTHING;

-- 3. Inserir Itens da Cotação de Teste vinculados à cotação
INSERT INTO itens_cotacao (id, cotacao_id, material, quantidade, unidade, preco_unitario, categoria)
VALUES 
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Cabo Flexível SIL 750V 2,5mm² Azul', 500, 'metros', 2.85, 'eletrica'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Tubo PVC Esgoto Amanco 100mm 6m', 40, 'varas', 68.90, 'hidraulica')
ON CONFLICT (id) DO NOTHING;
