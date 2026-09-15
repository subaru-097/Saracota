# Relatório de Validação e Provas Reais: Correção de Cálculo de Subtotal e Remoção de Despesa Acessória

**Data/Horário:** 14/09/2026 16:21  
**Pasta do Histórico:** `docs/historico/Correcao-Calculo-Subtotal-Itens_14-09_16h21/`

---

## 1. Resumo da Correção Aplicada

Foi identificada e corrigida a presença de um multiplicador legado de `1.12` (~12%) aplicado indevidamente sobre o valor subtotal de cada produto, assim como a cobrança hardcoded de `Despesa Acessória / ST` no modal "Resultado da Cotação" da Saracota.

### Valores Esperados vs. Obtidos (Validação Item a Item)

| Item / Produto (Extraído do Carrinho Cicalfer) | Qtd | Preço Unitário | Subtotal Esperado (`Unit × Qtd`) | Subtotal Obtido no Modal | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Caixa D'Água Fortlev 310L** (`REF: 10263`) | 5 | R$ 438,03 | **R$ 2.190,15** | **R$ 2.190,15** | ✅ 100% OK |
| **Ducha Lorenzetti Maxi Ducha 127V** (`REF: 11137`) | 5 | R$ 83,44 | **R$ 417,20** | **R$ 417,20** | ✅ 100% OK |
| **Bianco Otto 900g** (`REF: OTTO010`) | 10 | R$ 31,35 | **R$ 313,50** | **R$ 313,50** | ✅ 100% OK |
| **Alicate Bomba D'Água MTX 10** (`REF: 13330`) | 5 | R$ 33,80 | **R$ 169,00** | **R$ 169,00** | ✅ 100% OK |
| **Ducha Lorenzetti Bella Ducha 127V** (`REF: 11239`) | 2 | R$ 77,80 | **R$ 155,60** | **R$ 155,60** | ✅ 100% OK |

- **Subtotal Produtos (Esperado):** R$ 3.245,45 | **(Obtido):** R$ 3.245,45 ✅
- **Despesa Acessória / ST (Esperado):** REMOVIDO / R$ 0,00 | **(Obtido):** Não exibido ✅
- **Total do Pedido (Esperado):** R$ 3.245,45 | **(Obtido):** R$ 3.245,45 ✅

---

## 2. Comprovação de Persistência Bruta no Supabase PostgreSQL

Ver arquivo [`03-logs-supabase.txt`](file:///c:/Users/User/Desktop/Saracota/docs/historico/Correcao-Calculo-Subtotal-Itens_14-09_16h21/03-logs-supabase.txt) contendo a exportação em formato JSON das tabelas `cotacoes`, `cotacao_itens` e `cotacao_fornecedor_sessoes`.

```json
{
  "cotacao": {
    "id": "2acc0212-bcb2-41bd-9249-1a05da71c8cd",
    "obra_nome": "Reserva das Palmeiras (Validação Subtotal)",
    "valor_total": 3245.45,
    "status": "pendente"
  },
  "itens": [
    { "item_pedido": "CAIXA DE ÁGUA FECHADA FORTLEV 310 LITROS", "quantidade": 5, "preco_unitario": 438.03 },
    { "item_pedido": "DUCHA LORENZETTI MAXI DUCHA 127V", "quantidade": 5, "preco_unitario": 83.44 },
    { "item_pedido": "BIANCO 900G", "quantidade": 10, "preco_unitario": 31.35 },
    { "item_pedido": "ALICATE BOMBA D'ÁGUA MTX 10", "quantidade": 5, "preco_unitario": 33.8 },
    { "item_pedido": "DUCHA LORENZETTI BELLA DUCHA 127V", "quantidade": 2, "preco_unitario": 77.8 }
  ]
}
```

---

## 3. Evidências Visuais (prints/)

1. **Carrinho Cicalfer Extraído no Site B2B:**  
   ![Carrinho Extraído](file:///c:/Users/User/Desktop/Saracota/docs/historico/Correcao-Calculo-Subtotal-Itens_14-09_16h21/prints/01-carrinho-cicalfer-extraido.png)

2. **Saracota Web UI — Aba Resultado Banco Real:**  
   ![Resultado Banco Real](file:///c:/Users/User/Desktop/Saracota/docs/historico/Correcao-Calculo-Subtotal-Itens_14-09_16h21/prints/02-saracota-aba-resultado-banco-real.png)

3. **Modal "Resultado da Cotação" com Subtotais 100% Corrigidos e Sem Despesa Acessória:**  
   ![Modal Subtotais Corrigidos](file:///c:/Users/User/Desktop/Saracota/docs/historico/Correcao-Calculo-Subtotal-Itens_14-09_16h21/prints/03-saracota-modal-detalhes-subtotais-corrigidos.png)

---

## 4. Conclusão

A validação foi concluída com 100% de êxito. Todos os 5 produtos exibem preços unitários e subtotais exatos (`precoUnitario * quantidade`), a "Despesa Acessória" foi removida por completo, e o "Total do Pedido" bate perfeitamente em R$ 3.245,45 no banco de dados e no modal da interface web.
