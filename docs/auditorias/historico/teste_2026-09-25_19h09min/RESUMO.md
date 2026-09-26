# Relatório do Teste Real de Cotação E2E - Mercadão Lojista

**Data/Hora do Teste:** 2026-09-25 19:12 (Horário Real)  
**Pasta de Evidências:** `docs/auditorias/historico/teste_2026-09-25_19h09min/`  
**Status Final:** **SUCESSO 100% (SUCESSO)**

---

## 1. Parâmetros de Entrada & Produto Mapeado
- **Fornecedor:** Mercadão Lojista (`https://www.mercadaolojista.com.br/`)
- **Produto Solicitado:** Chave Combinada 27mm
- **Quantidade Solicitada:** 15 unidades

---

## 2. Dados Reais Extraídos do Portal do Fornecedor

| Parâmetro | Valor Extraído (Real) | Origem DOM / JS |
| :--- | :--- | :--- |
| **Nome do Produto** | `Chave Combinada 27mm - TAFORT` | `.produto-info a` / `var cart` (`item_name`) |
| **SKU do Produto** | `7149` | `var cart` (`item_sku`) |
| **ID do Item** | `348260984` | `var cart` (`item_id`) |
| **Preço Unitário** | **R$ 23,99** | `td.col-item-unit-price` (`data-item-unit-valor="23.99"`) |
| **Quantidade Atualizada** | **15 unidades** | `input.input-mini[name="quantidade"]` |
| **Subtotal da Linha (Calculado)** | **R$ 359,85** (15 × R$ 23,99) | Validação exata $15 \times 23.99 = 359.85$ |
| **Subtotal do Carrinho (Site)** | **R$ 359,85** | `strong.valor-subtotal` (`data-subtotal-valor="359.85"`) |
| **Total do Pedido (Site)** | **R$ 359,85** | `strong.valor-total` (`data-total-valor="359.85"`) |

---

## 3. Variável JS Bruta Extraída (`var cart` do Modal Fancybox)
```json
{
  "currency": "BRL",
  "id": "e949e9f38cd33253bded1d43b93c195d",
  "value": 23.99,
  "coupon": "",
  "items": [
    {
      "item_id": "348260984",
      "item_sku": "7149",
      "item_name": "Chave Combinada 27mm - TAFORT",
      "price": 23.99,
      "quantity": 1
    }
  ]
}
```

---

## 4. Registro de Evidências (Screenshots Salvos)
1. `01_login_mercadao.png`: Tela de login com e-mail `santanacomercial2021@gmail.com` preenchido.
2. `02_busca_produto.png`: Resultados da busca pelo termo "chave combinada".
3. `03_card_produto_correto.png`: Destaque e scroll para o card exato `Chave Combinada 27mm - TAFORT` (Index 3 entre 40 variações).
4. `04_modal_adicao_carrinho.png`: Modal fancybox de confirmação de adição ao carrinho.
5. `05_carrinho_quantidade_atualizada.png`: Página do carrinho com quantidade atualizada para 15 unidades.
6. `06_valores_extraidos.png`: Leitura dos atributos do DOM com Preço Unitário (R$ 23,99) e Totais (R$ 359,85).
7. `07_dados_inseridos_saracota.png`: Registro e persistência da cotação na plataforma Sara Cota (ID: `964ce43c-49e8-4781-85a4-2f87e6bc5e20`).

---

## 5. Conclusão
O fornecedor **Mercadão Lojista** está 100% validado para uso em produção, com seletores de login, busca com filtro de variação exata por milimetragem, extração de carrinho e repasse de valores operando com perfeição e dados 100% reais sem simulação.
