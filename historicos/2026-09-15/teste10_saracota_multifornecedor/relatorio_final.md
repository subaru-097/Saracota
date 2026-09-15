# Relatório de Diagnóstico Técnico — Bug de Cotação Multi-Fornecedor (SaraCota)
**Data/Hora:** 15/09/2026 16:16  
**Pasta de Destino:** `historicos/2026-09-15/teste10_saracota_multifornecedor/`  
**Modo:** SOMENTE DIAGNÓSTICO (Nenhum código foi alterado nesta etapa).

---

## 1. Linha do Tempo Exata do Teste (Timestamps Brutos)

| Timestamp (UTC) | Etapa do Teste | Evento / Ação Observada | Evidência / Log |
| :--- | :--- | :--- | :--- |
| `19:13:16.080Z` | Preparação | Navegação para `http://localhost:3000/cotacoes` com sessão de desenvolvimento injetada. | `execucao_detalhada.log` L4 |
| `19:13:18.961Z` | Seleção de Tela | Alternância para a sub-aba "Bloco de Notas". | `execucao_detalhada.log` L17 |
| `19:13:20.014Z` | Inserção de Itens | Inserção do Item 1: `3x CAIXA DA AGUA FORTLEV 310L`. | `execucao_detalhada.log` L19 |
| `19:13:20.842Z` | Inserção de Itens | Inserção do Item 2: `6x DUCHA LORENZETTI BELLA DUCHA 127V`. | `execucao_detalhada.log` L21 |
| `19:13:21.664Z` | Disparo UI | Clique em "Cotar com Fornecedores". Abertura do modal de seleção. | `execucao_detalhada.log` L23 |
| `19:13:22.734Z` | Configuração Modal | Pré-seleção dos fornecedores com RPA Ativo (**Cicalfer** + **Construjá**). | `00_modal_fornecedores_selecionados.png` |
| `19:14:46.492Z` | Confirmação | Clique no botão `Cotar (2)` no modal de seleção. | `01_apos_clicar_cotar.png` |
| `19:14:46.689Z` | Requisição POST | `POST /api/cotacoes/[id]/processar` enviado com `fornecedorIds: ["33e03495...", "a1684c4d..."]`. | `execucao_detalhada.log` L36 |
| `19:14:46.908Z` | Resposta Backend | `POST 200 OK`: `status: "processamento iniciado"`. | `execucao_detalhada.log` L38 |
| `19:14:49.912Z` | Polling Status | `GET /api/cotacoes/[id]/status` retorna `mensagens: ["Iniciando processamento autônomo no servidor para 1 fornecedor(es)...", "[Cicalfer] 🚀 Iniciando Motor Central..."]`. | `execucao_detalhada.log` L42 |
| `19:15:12.132Z` | Tela de Resultado | Interface abre a sub-aba `Resultado Banco Real`, exibindo **Cicalfer** e **Construjá** ambos com `R$ 0,00`. | `04_resultado_final.png` |

---

## 2. Confirmação do Status de Execução Real por Fornecedor

| Fornecedor | ID no Supabase | Scraping Real Executado? | Detalhes do Comportamento Observado |
| :--- | :--- | :---: | :--- |
| **Cicalfer** | `33e03495-100d-45a3-9e34-899de56b0ab1` | **SIM (100%)** | O backend instanciou o robô Playwright da Cicalfer, realizou login no portal B2B, mas como a busca não localizou os produtos exatos `CAIXA DA AGUA FORTLEV` no catálogo da Cicalfer, a cotação retornou status `NAO_ENCONTRADO` (Preço `R$ 0,00`). |
| **Construjá** | `a1684c4d-d896-4ba9-a591-cda455c5ffe2` | **NÃO (0%)** | O robô da Construjá **NUNCA foi instanciado pelo servidor**. O backend ignorou a solicitação da Construjá devido a uma incompatibilidade na leitura dos fornecedores do banco de dados e gerou um card simulado com `R$ 0,00` no frontend. |

---

## 3. Análise Detalhada das Causas Raízes (Com Mapeamento de Código)

### 3.1 Ausência de Feedback Visual e Redirecionamento Prematuro
- **Sintoma:** O modal de progresso em tempo real fecha quase imediatamente e a UI transita para a tela de resultado ("Resultado Banco Real") exibindo `R$ 0,00` antes de qualquer extração terminar.
- **Causa Raiz 1 (Mapeamento Inicial Incompleto):**  
  Em [`components/features/CotacoesView.tsx`](file:///c:/Users/User/Desktop/Saracota/components/features/CotacoesView.tsx#L341-L344), logo ao clicar em "Cotar", o código chama `enviarCotacaoComFornecedores(...)`, que cria objetos iniciais de fornecedores com status `"processando"` e `valorTotalGeral: 0`. 
- **Causa Raiz 2 (Mapeamento Fixo no Fechamento do Polling):**  
  Em [`components/features/CotacoesView.tsx`](file:///c:/Users/User/Desktop/Saracota/components/features/CotacoesView.tsx#L474-L532), quando o polling conclui ou é interrompido, a função `handleConfirmEnviarCotacaoFornecedores` itera sobre `selectedSupplierIds` e tenta mapear `matchingResults`. Quando `matchingResults` está vazio ou falha, o frontend constrói objetos mock com status `'encontrado'` e `precoUnitario: 0`, definindo `setSubAba('resultado')` (Linha 610) e forçando a exibição da tela final.
- **Causa Raiz 3 (Redirecionamento Automático na Inicialização):**  
  Em [`components/features/CotacoesView.tsx`](file:///c:/Users/User/Desktop/Saracota/components/features/CotacoesView.tsx#L178-L182), se houver qualquer cotação ativa cadastrada no estado do contexto, o `useEffect` troca o estado para `subAba = 'resultado'`, ocultando a aba de entrada ("Bloco de Notas").

### 3.2 Resultados Idênticos entre Fornecedores (Cicalfer e Construjá exibindo R$ 0,00 e dados espelhados)
- **Sintoma:** Construjá aparece com status `MATCH EXATO`, `Score ★ 4.8`, `Prazo 2 dias`, `Whats (11) 98765-4321` e total `R$ 0,00` — exatamente igual ao card da Cicalfer.
- **Causa Raiz 1 (Dessincronia de Nomes de Colunas no Banco):**  
  No backend [`lib/db/client.ts`](file:///c:/Users/User/Desktop/Saracota/lib/db/client.ts#L249-L252), a atualização da cotação no Supabase grava o array de IDs selecionados na coluna `fornecedores_selecionados`.  
  Porém, no orquestrador de backend [`lib/services/automacao/matchingEngine.ts`](file:///c:/Users/User/Desktop/Saracota/lib/services/automacao/matchingEngine.ts#L680-L684), o servidor tenta ler `(cotacao as any)?.fornecedorIds` (camelCase) ou `(cotacao as any)?.fornecedor_id` (singular). Como a propriedade `fornecedores_selecionados` não é lida pelo `matchingEngine.ts`, ambas retornam `undefined`.
- **Causa Raiz 2 (Fallback Hardcoded para Cicalfer no Backend):**  
  Como `fornecedorIds` fica `undefined`, o `matchingEngine.ts` executa a linha 684:
  ```typescript
  const fornecedorIds: string[] =
    (cotacao as any)?.fornecedorIds ||
    ((cotacao as any)?.fornecedor_id
      ? [(cotacao as any).fornecedor_id]
      : ['33e03495-100d-45a3-9e34-899de56b0ab1']); // FALLBACK FIXO PARA CICALFER!
  ```
  Isso faz com que o robô do servidor execute **SEMPRE E APENAS a Cicalfer**, mesmo quando o usuário selecionou Construjá ou múltiplos fornecedores!
- **Causa Raiz 3 (Mapeamento Promíscuo de Resultados no Frontend):**  
  No frontend [`components/features/CotacoesView.tsx`](file:///c:/Users/User/Desktop/Saracota/components/features/CotacoesView.tsx#L474-L480), ao formatar o resultado para exibir os cards dos fornecedores na tela:
  ```typescript
  const fornList = selectedSupplierIds.map((fId) => {
    const fName = fId.toLowerCase().includes('cicalfer') || fId === '33e03495-100d-45a3-9e34-899de56b0ab1' ? 'Cicalfer' : 'Lojista Credenciado';
    
    const matchingForForn = matchingResults.length > 0
      ? matchingResults.filter((r: any) => r.fornecedorId === fId || !r.fornecedorId || matchingResults.length <= 5)
      : [];
  ```
  O filtro `matchingResults.length <= 5` faz com que os resultados de 1 fornecedor sejam associados a TODOS os fornecedores da lista! Além disso, a URL do carrinho era forçada para a Cicalfer ([Linha 529](file:///c:/Users/User/Desktop/Saracota/components/features/CotacoesView.tsx#L529)).

### 3.3 Regressão vs. Comportamento Anterior
- **No Teste 9 (Single Construjá):**  
  A execução isolada no motor generico em `core/services/supplier-quote-engine/index.js` via script direto executava o robô real da Construjá e logava cada clique no DOM.
- **No Teste 10 (Servidor Next.js Multi-Fornecedor):**  
  Ao passar pela rota da API `/api/cotacoes/[id]/processar`, a dessincronia no nome da coluna (`fornecedores_selecionados` vs `fornecedorIds`) ativou o fallback de segurança para Cicalfer, impedindo que o motor da Construjá fosse chamado.
- **Concorrência e Laço de Execução:**  
  Em [`matchingEngine.ts`](file:///c:/Users/User/Desktop/Saracota/lib/services/automacao/matchingEngine.ts#L702-L717), a iteração pelos fornecedores é feita via laço `for (const fId of fornecedorIds)` com a trava `executarComTravaFornecedor(fId, ...)` de forma sequencial. A fila sequencial funcionaria corretamente se o array de `fornecedorIds` não estivesse sendo truncado para apenas `['33e03495...']`.

### 3.4 Teste de Controle (Single-Supplier Control Test)
- **Procedimento:** Executou-se a cotação selecionando EXCLUSIVAMENTE o fornecedor **Construjá** (`a1684c4d-d896-4ba9-a591-cda455c5ffe2`).
- **Resultado Observado:** O backend retornou:
  `[STATUS SINGLE Construjá] msgs: ["Iniciando processamento autônomo no servidor para 1 fornecedor(es)...", "[Cicalfer] 🚀 Iniciando Motor Central de Cotação RPA..."]`
- **Conclusão:** O bug de "executar Cicalfer e gerar R$ 0,00" **OCORRE IGUALMENTE NO MODO SINGLE E MULTI-FORNECEDOR**, confirmando que a causa é a falha na leitura da coluna `fornecedores_selecionados` no `matchingEngine.ts`.

---

## 4. Resumo das Linhas de Código Críticas a Corrigir no Futuro

1. **`lib/services/automacao/matchingEngine.ts` (Linha ~680–685):**  
   Corrigir a extração dos IDs de fornecedores do objeto `cotacao` para ler `cotacao.fornecedores_selecionados || cotacao.fornecedorIds || cotacao.fornecedor_id`.
2. **`app/api/cotacoes/[cotacaoId]/processar/route.ts` (Linha ~71–77):**  
   Garantir que a atualização grave `fornecedores_selecionados` e `fornecedorIds` de forma consistente.
3. **`components/features/CotacoesView.tsx` (Linha ~474–532):**  
   Remover o filtro promíscuo `matchingResults.length <= 5` e a atribuição hardcoded `fName` / `urlCarrinhoDireto` da Cicalfer, garantindo filtragem estrita por `fornecedorId`.
4. **`components/features/CotacoesView.tsx` (Linha ~400–430):**  
   Ajustar a atualização das mensagens de log no modal para vincular cada mensagem do backend ao seu respectivo fornecedor.

---

## 5. Próximos Passos (Recomendação para Prompt de Correção)

Quando for solicitada a etapa de correção, o prompt futuro deve orientar:
1. Normalizar o schema/interfaces de `Cotacao` para usar `fornecedores_selecionados: string[]` em todas as rotas e services backend.
2. Atualizar a função `processarCotacaoTodosFornecedores` em `matchingEngine.ts` para iterar de forma transparente sobre o array `fornecedores_selecionados`.
3. Refatorar o renderizador de resultado em `CotacoesView.tsx` para mapear dinamicamente nome, score, WhatsApp, itens e total de cada fornecedor individualmente a partir das respostas do banco.
