# Análise de Divergência — Cotação Cicalfer

## Comparativo de Resultados

| Métrica | Resultado Esperado | Resultado Obtido Após Correção | Status |
| :--- | :--- | :--- | :--- |
| **Quantidade de Itens** | 3 itens | 3 itens | ✅ **100% IGUAL** |
| **Valor Total Geral** | R$ 1.479,04 | R$ 1.479,04 | ✅ **100% IGUAL** |

---

## Detalhamento dos 3 Itens Extraídos

1. **CABO FLEX 100M COBRECOM 2,50MM AM REF: 10672**
   - Quantidade pedida: 5
   - Preço Unitário: R$ 235,16
   - Subtotal: R$ 1.175,80

2. **BROXA ROMA RETANGULAR 15,5 X 5,5CM REF: 11992**
   - Quantidade pedida: 12 (lote de 12 em 12)
   - Preço Unitário: R$ 4,71
   - Subtotal: R$ 56,52

3. **ALICATE BICO CHATO MTX 6 REF: 13329**
   - Quantidade pedida: 12 (lote unitário)
   - Preço Unitário: R$ 20,56
   - Subtotal: R$ 246,72

---

## Análise da Solução Implementada

1. **Eliminação do Seletor Genérico:**
   - O uso de `document.querySelectorAll('div, tr')` foi totalmente removido do fluxo de extração.
2. **Ancoragem nos Inputs de Quantidade:**
   - A extração passou a se ancorar nos elementos `input.QuantidadeMaisMenos_input__grKxO` dos itens reais.
   - Para cada input, o script sobe até o card pai via `.closest('[class*="itemContainer"], [class*="ProdutoCompactCarrinho"]')`, garantindo que apenas dados daquele item sejam lidos.
3. **Normalização Estrita de Preços (BRL):**
   - Implementada a função `parsePrecoBRL` que remove o prefixo `R$`, espaços normais e não-quebráveis (`\u00A0`), converte o separador de milhar/decimal e valida como número.
4. **Filtro de Formulários sem Preço:**
   - Adicionado descarte de inputs com preço unitário e totalzerados (ex: formulário de busca rápida de topo).
5. **Aguardar Estabilização de Hidratação do React:**
   - Adicionado polling que aguarda que a contagem de inputs de quantidade permaneça estável entre duas leituras antes de realizar a extração final.
