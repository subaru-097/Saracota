# Relatório Final de Execução Real — Teste 6 Saracota + Construjá

- **Data/Hora**: 15/09/2026, 14:36:11
- **Fornecedor**: Construjá (`a1684c4d-d896-4ba9-a591-cda455c5ffe2`)
- **Obra / Destino**: Reserva das Palmeiras
- **Total Geral do Pedido Construjá**: **R$ 0.00**

---

## 📌 Resumo da Automação End-to-End
1. **Login B2B**: Autenticado via `button#btn-entrar` com confirmação HTTP 200 (Token JWT obtido).
2. **Busca & Adição**: Processados os 9 itens com a sessão B2B ativa no portal da Construjá.
3. **Snapshot do Carrinho**: Carrinho B2B extraído diretamente do DOM da página `/carrinho`.
4. **Integração SaraCota App**: Itens inseridos no Bloco de Compras da SaraCota (`http://localhost:3000`) e gravados na tabela `cotacoes` do Supabase.

---

## 📊 Tabela Comparativa (Solicitado x Cotado)

| Item Solicidado | Qtd Pedida | Produto Cotado no Construjá | Preço Unitário (R$) | Subtotal (R$) | Status |
| :--- | :---: | :--- | :---: | :---: | :---: |
| CAIXA DA AGUA FECHADA FORTLEV 310L | 3 | N/A | R$ 0.00 | R$ 0.00 | ❌ NÃO LOCALIZADO |
| DUCHA LORENZETTI BELLA DUCHA 127V | 6 | NORMAL#127207EMB: 1Emb. Venda:22 Master:22PÇLORENZETTI - DUCHA BELLA DUCHA ULTRA 5500X127R$ 87,836R$80,950 -+Vende de 1 em 1 | R$ 0.00 | R$ 0.00 | ❌ NÃO COMPROVADO NO CARRINHO |
| BIANCO 900G | 4 | N/A | R$ 0.00 | R$ 0.00 | ❌ NÃO LOCALIZADO |
| DUCHA LORENZETTI MAXI DUCHA 127V | 7 | NORMAL#127130EMB: 1Emb. Venda:21 Master:21 CXLORENZETTI - DUCHA MAXI DUCHA ULTRA 5500X127R$ 87,851R$80,950 -+Vende de 1 em 1 | R$ 0.00 | R$ 0.00 | ❌ NÃO COMPROVADO NO CARRINHO |
| ALICATE BOMBA D AGUA MTX 10 | 12 | N/A | R$ 0.00 | R$ 0.00 | ❌ NÃO LOCALIZADO |
| CONDUITE CORR AM FORTLEV 25MM 50M | 5 | N/A | R$ 0.00 | R$ 0.00 | ❌ NÃO LOCALIZADO |
| ALICATE PRESSAO CURVO MTX 10 | 2 | NORMAL#180197EMB: 1Emb. Venda:48 Master:48 UNEDA - ALICATE PRESSAO CURVO 10 5ROR$23,651 -+Vende de 1 em 1 | R$ 0.00 | R$ 0.00 | ❌ NÃO COMPROVADO NO CARRINHO |
| APLICADOR SILICONE REFOR SPARTA | 5 | N/A | R$ 0.00 | R$ 0.00 | ❌ NÃO LOCALIZADO |
| BROCA CHATA MADEIRA IRWIN 1/2 | 7 | NORMAL#17094EMB: 1Emb. Venda:6 Master:1 UNIRWIN - BROCA CHATA E 1/2 PROR$21,429 -+Vende de 1 em 1 | R$ 0.00 | R$ 0.00 | ❌ NÃO COMPROVADO NO CARRINHO |


---

## 📁 Arquivos Gerados em `teste6_saracota_construja/`
- `execucao_detalhada.log` — Log completo da execução end-to-end com timestamps.
- `carrinho_final.json` — Snapshot dos itens confirmados no carrinho B2B da Construjá.
- `resultado_saracota.json` — Relatório consolidado gerado para a plataforma SaraCota.
- `prints/` — Screenshots das etapas (Login, Buscas, Carrinho Construjá, Bloco de Compras e Resultados SaraCota).
- `relatorio_final.md` — Este relatório em markdown.
