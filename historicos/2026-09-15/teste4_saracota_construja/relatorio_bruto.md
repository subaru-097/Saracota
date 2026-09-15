# Relatório Bruto de Diagnóstico E2E — Teste 4 (Construjá)

- **Data/Hora de Execução**: 15/09/2026, 14:07:31
- **Objetivo**: Diagnóstico bruto sem correções prévias e sem fallbacks inventados.
- **Ambiente**: Browser Real Chromium Playwright (Autenticação B2B Construjá).

---

## 📌 Resumo do Estado da Sessão (Checkpoints)
1. **Checkpoint (a) - Pós Login**: Cookies gravados e resposta HTTP 200 recebida da API B2B.
2. **Checkpoint (b) - Antes da Busca**: Estado de `localStorage` e cookies registrado em `estado_sessao.log`.
3. **Checkpoint (c) - Após 1ª Navegação (`/produtos?busca=...`)**: Registrado em `estado_sessao.log` para verificar se a sessão JWT foi mantida ou descartada pelo frontend Next.js.

---

## 📊 Tabela de Comportamento Bruto Observado (9 Itens)

| # | Item Solicidado | Qtd | Produto Retornado no DOM | Comportamento / Estado Observado |
| :---: | :--- | :---: | :--- | :--- |
| 1 | CAIXA DA AGUA FECHADA FORTLEV 310L | 3 | N/A | NENHUM PRODUTO ENCONTRADO NO CATÁLOGO |
| 2 | DUCHA LORENZETTI BELLA DUCHA 127V | 6 | #127207EMB: 1Emb. Venda:22 Master:22PÇLORENZETTI - DUCHA BELLA DUCHA ULTRA 5500X127Faça login ou cad | PREÇO VISÍVEL EM TELA: "Pagamento" |
| 3 | BIANCO 900G | 4 | N/A | NENHUM PRODUTO ENCONTRADO NO CATÁLOGO |
| 4 | DUCHA LORENZETTI MAXI DUCHA 127V | 7 | #127130EMB: 1Emb. Venda:21 Master:21 CXLORENZETTI - DUCHA MAXI DUCHA ULTRA 5500X127Faça login ou cad | PREÇO VISÍVEL EM TELA: "Pagamento" |
| 5 | ALICATE BOMBA D AGUA MTX 10 | 12 | N/A | NENHUM PRODUTO ENCONTRADO NO CATÁLOGO |
| 6 | CONDUITE CORR AM FORTLEV 25MM 50M | 5 | N/A | NENHUM PRODUTO ENCONTRADO NO CATÁLOGO |
| 7 | ALICATE PRESSAO CURVO MTX 10 | 2 | #180197EMB: 1Emb. Venda:48 Master:48 UNEDA - ALICATE PRESSAO CURVO 10 5ROFaça login ou cadastre-se p | PREÇO VISÍVEL EM TELA: "Pagamento" |
| 8 | APLICADOR SILICONE REFOR SPARTA | 5 | N/A | NENHUM PRODUTO ENCONTRADO NO CATÁLOGO |
| 9 | BROCA CHATA MADEIRA IRWIN 1/2 | 7 | #17094EMB: 1Emb. Venda:6 Master:1 UNIRWIN - BROCA CHATA E 1/2 PROFaça login ou cadastre-se para ver  | PREÇO VISÍVEL EM TELA: "Pagamento" |

---

## 📁 Lista dos 6 Artefatos Gerados no Teste 4
1. `execucao_detalhada.log` — Log passo a passo com timestamps e URLs.
2. `estado_sessao.log` — Dumps de cookies e `localStorage` nos checkpoints (a, b, c).
3. `prints/` — Screenshots reais de login, buscas dos 9 itens e carrinho.
4. `html_dumps/` — HTMLs completos da home, buscas dos 9 itens e carrinho.
5. `diagnostico_seletores.log` — Validação de presença e contagem de cada seletor.
6. `relatorio_bruto.md` — Este relatório cronológico e factual.
