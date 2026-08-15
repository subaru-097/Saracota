---
name: sara-matching-produtos
description: Lógica de extração de atributos técnicos e matching de produtos entre pedido do cliente e catálogo do fornecedor. Use sempre que trabalhar em normalização, comparação ou busca de produtos.
---

# Matching de Produtos

## Regras
- Cada item da lista deve ser processado por LLM para extrair atributos estruturados: categoria, marca, medida/bitola, voltagem/amperagem, material, norma técnica (quando aplicável)
- Nunca fazer matching apenas por similaridade textual pura quando existir atributo técnico crítico (ex: amperagem, diâmetro, rosca) — esses precisam ser iguais ou compatíveis, não apenas "parecidos"
- Usar embeddings (pgvector ou serviço externo) apenas como fallback para busca semântica quando atributos estruturados não resolverem o match
- Resultado do matching deve ser classificado em: exato, similar (com motivo da diferença explicitado, ex: "marca diferente"), ou indisponível
- Nunca substituir produto automaticamente sem sinalizar claramente ao cliente que houve substituição
- Implementar conversão de unidades (metro, rolo, barra, saco, litro, galão, unidade) antes de comparar preços entre fornecedores que vendem em formatos diferentes
