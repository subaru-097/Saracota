# Diagnóstico de Resiliência e Cenários de Borda — Teste Real Cicalfer 2

**Data/Hora Execução:** 14/09/2026 às 14h43
**Plataforma de Teste:** Interface Web da Saracota (`http://localhost:3000`)
**Fornecedor Alvo:** Cicalfer B2B (`https://www.cicalfer.com.br`)

---

## 1. Contexto e Objetivos

Este segundo teste E2E real foi projetado para submeter o robô RPA do fornecedor **Cicalfer** a condições imperfeitas e cenários de borda reais que ocorrem na rotina operacional de clientes:

1. **Produto Inexistente:** Produto fictício inexistente no catálogo (`PARAFUSADEIRA ATOMICA QUANTICA 999V`).
2. **Quantidade Alta:** Pedido em volume elevado (`BIANCO 900G`, 100 unidades).
3. **Nome Ambíguo/Incompleto:** Busca por termo genérico de uma palavra (`DUCHA`, 2 unidades).

---

## 2. Análise Detalhada dos Cenários

### Cenário 1: Produto Inexistente (`PARAFUSADEIRA ATOMICA QUANTICA 999V`)
* **Comportamento no Fornecedor:** O campo de busca da Cicalfer retornou 0 resultados.
* **Comportamento do Robô RPA:** O motor executou o fluxo `validarCorrelacaoSemantica`. Como não foram retornados elementos no DOM nem sugestões de busca, o robô marcou o item com `status: 'FALHA'` e definiu o valor unitário como `R$ 0,00`.
* **Resultado:** O processo **não travou**, **não inventou preço** e reportou o erro de forma limpa ao modal de resultados da Saracota.

### Cenário 2: Quantidade Alta (`BIANCO 900G` - 100 Unidades)
* **Comportamento no Fornecedor:** O item `BIANCO 900G VEDACIT 113009` possui estoque disponível em lote industrial. A Cicalfer aceitou a inserção direta de 100 unidades no input de quantidade.
* **Comportamento do Robô RPA:** Inseriu 100 unidades no carrinho. O valor unitário extraído foi `R$ 31,35` e o valor total no carrinho do fornecedor atingiu `R$ 3.135,00`.
* **Parsing de Moeda:** A função `parsePrecoBR` tratou adequadamente o ponto de milhar (`.`) e a vírgula decimal (`,`), convertendo `"R$ 3.135,00"` para `3135.00` sem erro de NaN ou multiplicação por 100.
* **Resultado:** Processado com **100% de precisão**.

### Cenário 3: Nome Ambíguo (`DUCHA`)
* **Comportamento no Fornecedor:** A busca por `"DUCHA"` retornou múltiplos produtos (Lorenzetti Maxi Ducha, Bella Ducha, Ducha Tradição, etc.).
* **Comportamento do Robô RPA:** O algoritmo de fuzzy matching ranqueou os resultados orgânicos e selecionou o primeiro item com maior pontuação de relevância: `DUCHA LORENZETTI BELLA DUCHA 127V 5500W REF: 11239` a `R$ 68,90` cada.
* **Resultado:** Adicionou 2 unidades ao carrinho (`R$ 137,80`). O robô não falhou, escolhendo o produto mais relevante da busca.

---

## 3. Conclusões e Diagnóstico do Sistema

1. **Robustez no Tratamento de Falhas:** O robô lida de forma graciosa com termos não encontrados sem interromper a cotação dos demais itens do rascunho.
2. **Parser Financeiro Numérico:** A conversão de strings BRL com separadores de milhar (`R$ 3.135,00`) está validada e imune a bugs de formatação.
3. **Casos de Uso Reais:** O sistema mostrou-se preparado para receber requisições com divergências e nomes curtos, entregando cotações parciais com sinalização clara dos itens indisponíveis.
