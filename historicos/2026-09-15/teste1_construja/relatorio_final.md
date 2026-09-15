# Relatório de Execução Real — Teste 1 Construjá (Supabase-Driven)

- **Data de Execução**: 15/09/2026, 13:57:10
- **Fonte de Seletores**: Supabase DB (`fornecedores.seletores` row ID `a1684c4d-d896-4ba9-a591-cda455c5ffe2`)
- **Método de Adição ao Carrinho**: `ENTER_KEY` (Preenchimento de quantidade + Pressionamento de ENTER)
- **Total Geral do Carrinho**: **R$ 0.00**

---

## 📌 Diferenças Críticas Validadas
1. **Seletores do Supabase**: Lidos dinamicamente da coluna JSONB do banco.
2. **Sem Seleção de Filial**: Etapa de filial ignorada (não aplicável no portal Construjá).
3. **Sem Regra de Lote**: Validação de "VENDE DE X EM X" desativada.
4. **Limpeza do Carrinho**: Carrinho zerado antes da adição dos 9 itens para evitar contaminação por itens residuais.
5. **Sem Fallback Silencioso**: Sem atribuição artificial de preços a produtos não correspondidos.

---

## 📊 Tabela Comparativa (Solicitado x Cotado)

| Item Solicidado | Qtd Pedida | Produto Efetivamente Cotado | Preço Unitário (R$) | Subtotal (R$) | Status |
| :--- | :---: | :--- | :---: | :---: | :---: |
| CAIXA DA AGUA FECHADA FORTLEV 310L | 3 | N/A | R$ 0.00 | R$ 0.00 | ❌ NÃO LOCALIZADO |
| DUCHA LORENZETTI BELLA DUCHA 127V | 6 | #127207EMB: 1Emb. Venda:22 Master:22PÇLORENZETTI - DUCHA BELLA DUCHA ULTRA 5500X127Faça login ou cadastre-se para ver os preços | R$ 0.00 | R$ 0.00 | ❌ NÃO COMPROVADO NO CARRINHO |
| BIANCO 900G | 4 | N/A | R$ 0.00 | R$ 0.00 | ❌ NÃO LOCALIZADO |
| DUCHA LORENZETTI MAXI DUCHA 127V | 7 | #127130EMB: 1Emb. Venda:21 Master:21 CXLORENZETTI - DUCHA MAXI DUCHA ULTRA 5500X127Faça login ou cadastre-se para ver os preços | R$ 0.00 | R$ 0.00 | ❌ NÃO COMPROVADO NO CARRINHO |
| ALICATE BOMBA D AGUA MTX 10 | 12 | N/A | R$ 0.00 | R$ 0.00 | ❌ NÃO LOCALIZADO |
| CONDUITE CORR AM FORTLEV 25MM 50M | 5 | N/A | R$ 0.00 | R$ 0.00 | ❌ NÃO LOCALIZADO |
| ALICATE PRESSAO CURVO MTX 10 | 2 | #180197EMB: 1Emb. Venda:48 Master:48 UNEDA - ALICATE PRESSAO CURVO 10 5ROFaça login ou cadastre-se para ver os preços | R$ 0.00 | R$ 0.00 | ❌ NÃO COMPROVADO NO CARRINHO |
| APLICADOR SILICONE REFOR SPARTA | 5 | N/A | R$ 0.00 | R$ 0.00 | ❌ NÃO LOCALIZADO |
| BROCA CHATA MADEIRA IRWIN 1/2 | 7 | #17094EMB: 1Emb. Venda:6 Master:1 UNIRWIN - BROCA CHATA E 1/2 PROFaça login ou cadastre-se para ver os preços | R$ 0.00 | R$ 0.00 | ❌ NÃO COMPROVADO NO CARRINHO |


---

## 📁 Arquivos Salvos na Pasta do Histórico
- `execucao.log` — Log completo com timestamps de execução e requisições HTTP.
- `payload_final.json` — Estrutura de dados enviada ao banco de dados.
- `01_modal_cotacao_vazio.png` até `10_saracota_cotacao_retornada.png` — Prints provando cada etapa da automação.
- Dumps de HTML: `01_saracota_home.html`, `01_modal_login.html`, `02_pos_login.html`, `03_pagina_carrinho.html`.
