---
name: sara-database-schema
description: Modelo de dados oficial da Sara Cota. Use sempre que criar, alterar ou consultar tabelas do banco.
---

# Database Schema

- Tabela clientes (id, nome, cnpj, uf, created_at)
- Tabela projetos (id, cliente_id, nome_obra, uf)
- Tabela fornecedores (id, cliente_id, nome, url_login, sessao_criptografada, uf, score_confiabilidade)
- Tabela listas (id, projeto_id, status, origem [texto|audio], created_at)
- Tabela itens_lista (id, lista_id, texto_original, categoria, atributos_json, quantidade, unidade)
- Tabela cotacoes (id, lista_id, fornecedor_id, valor_total, imposto_total, prazo_entrega, status, created_at)
- Tabela itens_cotacao (id, cotacao_id, item_lista_id, produto_encontrado, match_tipo [exato|similar|indisponivel], preco_unitario, unidade_fornecedor)
- Tabela historico_cotacao_resumo (id, cliente_id, item_categoria, fornecedor_id, preco_medio, data) -- dados agregados que sobrevivem após limpeza

## Regras
- Toda tabela sensível (sessão de fornecedor) deve ser criptografada em repouso (AES-256)
- Job de limpeza (cron) deve apagar registros detalhados de cotacoes/itens_cotacao com mais de 3 semanas, preservando apenas o resumo agregado
