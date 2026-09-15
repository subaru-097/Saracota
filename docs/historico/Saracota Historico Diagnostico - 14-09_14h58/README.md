# Diagnóstico do Pipeline Cicalfer → Saracota (Persistência do Carrinho)

**Data/Hora do Diagnóstico:** 14/09/2026 às 14h58  
**Pasta de Evidências:** `docs/historico/Saracota Historico Diagnostico - 14-09_14h58/`  
**Escopo:** Mapeamento ponta a ponta sem aplicação de correções no código, identificando onde a corrente quebra.

---

## 1. Resumo da Execução e Testes Realizados

1. **Acesso e Extração do Carrinho Cicalfer:**
   * Efetuado login no portal Cicalfer (`santanacomercial2021@gmail.com`).
   * Adicionados os 5 produtos no carrinho:
     - 5 unidades — `CAIXA D AGUA FECHADA FORTLEV 310L REF: 10263` (Unit: R$ 438,03 | Subtotal: R$ 2.190,15)
     - 5 unidades — `DUCHA LORENZETTI MAXI DUCHA 127V 5500W REF: 11137` (Unit: R$ 83,44 | Subtotal: R$ 417,20)
     - 10 unidades — `BIANCO OTTO 900G REF: OTTO010` (Unit: R$ 31,35 | Subtotal: R$ 313,50)
     - 5 unidades — `ALICATE BOMBA D AGUA MTX 10 REF: 13330` (Unit: R$ 33,80 | Subtotal: R$ 169,00)
     - 2 unidades — `DUCHA LORENZETTI BELLA DUCHA 127V 5500W REF: 11239` (Unit: R$ 77,80 | Subtotal: R$ 155,60)
   * **Total Geral do Carrinho:** **R$ 3.245,45** *(Produtos)* + despesas adicionais.
   * **JSON Bruto Capturado:** Salvo em `01-json-extraido.json`.
   * **Print do Carrinho:** Salvo em `prints/01-carrinho-cicalfer.png`.

2. **Tentativa de Persistência no Banco de Dados (Supabase):**
   * Executada a função `db.cotacoes.create()` e `db.cotacoes.salvarResultadosMatching()`.
   * Capturados os retornos do Supabase em `03-logs-supabase.txt`.

3. **Verificação no Frontend da Saracota ("Resultado Banco Real"):**
   * Acessada a interface Saracota em `http://localhost:3000/cotacoes`.
   * Capturada a tela de resultados em `prints/04-saracota-resultado-banco-real.png`.

---

## 2. Onde Exatamente a Corrente Quebra (Análise de Causa Raiz)

A corrente de dados quebra em **3 PONTOS CRÍTICOS**:

### PONTO DE QUEBRA #1: Bloqueio de RLS (Row Level Security) na Tabela Mestre `cotacoes`
* **Local:** `lib/db/client.ts` -> `create()` -> `supabase.from('cotacoes').insert([cotacaoRecordDb])`.
* **Erro Retornado pelo Supabase:**
  `[WARN] [DB WARNING] Inserção de cotação no Supabase falhou (usando armazenamento em memória local): new row violates row-level security policy for table "cotacoes"`
* **Causa:** O cliente Supabase anônimo/backend da API roda sem o cabeçalho de autenticação JWT de um usuário autenticado no Supabase Auth. A política RLS da tabela `cotacoes` impede a inserção de novas linhas por usuários sem privilégio.
* **Efeito Colateral:** O registro mestre da cotação **NÃO É INSERIDO** na tabela `cotacoes` do PostgreSQL no Supabase. O código faz fallback para `globalThis.__saracota_quotes_store`, salvando apenas na memória RAM local da instância Node.js.

### PONTO DE QUEBRA #2: Erro de Schema Cache e Falha de Inserção da URL do Carrinho
* **Local:** `lib/db/client.ts` -> `salvarBrowserbaseSessionId()`.
* **Erro Retornado pelo Supabase:**
  `[WARN] ⚠️ [SUPABASE UPDATE WARN cotacoes]: Could not find the 'browserbase_session_id' column of 'cotacoes' in the schema cache`
* **Causa:** O código tenta fazer `.update({ browserbase_session_id: cartUrl })` na tabela `cotacoes`. No schema atual ou no cache do Supabase Client, a coluna `browserbase_session_id` não é reconhecida na tabela `cotacoes`.
* **O que Funcionou:** A tabela isolada `cotacao_fornecedor_sessoes` recebeu o `upsert` com sucesso (`✅ [SUPABASE SUCCESS UPSERT]`).

### PONTO DE QUEBRA #3: Incompatibilidade de Query / Fetch no Frontend (`CotacoesContext.tsx`)
* **Local:** `context/CotacoesContext.tsx` -> `carregarCotacoesDoBanco()`.
* **O que acontece:**
  1. O frontend chama `db.cotacoes.list()`, que executa:
     `supabase.from('cotacoes').select('*, fornecedores:fornecedor_id(*), itens:itens_cotacao(*)')`
  2. Como a tabela `cotacoes` no Supabase não recebeu o registro devido ao bloqueio RLS (Ponto #1), a consulta do frontend retorna array vazio ou registros antigos.
  3. Além disso, o `CotacoesContext.tsx` **NÃO FAZ QUERY** nas tabelas `itens_cotacao_fornecedor` ou `cotacao_fornecedor_sessoes` onde o robô RPA salva os preços reais e links dos 5 itens cotados.
  4. No mapeamento do frontend, os fornecedores são fixados em um único fornecedor mock genérico (`fornecedores: [{ nome: 'Lojista Credenciado' }]`), sem extrair os itens cotados individualmente da cotação do Cicalfer.

---

## 3. Matriz de Diagnóstico e Evidências

| Componente | Ação Executada | Resultado | Onde Quebra / Motivo | Arquivo de Prova |
| :--- | :--- | :--- | :--- | :--- |
| **Extração Cicalfer** | `extrairCarrinho()` | `SUCESSO` | Extraiu 5 itens (R$ 3.245,45) | `01-json-extraido.json` / `prints/01-carrinho-cicalfer.png` |
| **Inserção Cotação Mestre** | `db.cotacoes.create()` | `FALHA (Supabase)` / `SUCESSO (Memória)` | RLS (`new row violates row-level security policy`) | `03-logs-supabase.txt` |
| **Inserção Itens Matching** | `salvarResultadosMatching()` | `PARCIAL` | Salva em `cotacao_itens` se solto, mas sem pai na tabela `cotacoes` | `02-codigo-persistencia.js` |
| **Sessão do Carrinho** | `salvarBrowserbaseSessionId()` | `SUCESSO (cotacao_fornecedor_sessoes)` | Salvo em `cotacao_fornecedor_sessoes`. Falha apenas na coluna legada em `cotacoes` | `03-logs-supabase.txt` |
| **Leitura no Frontend** | `carregarCotacoesDoBanco()` | `FALHA` | Consulta apenas `cotacoes` (que falhou na gravação) e não consulta `itens_cotacao_fornecedor` | `04-codigo-leitura-frontend.js` / `prints/04-saracota-resultado-banco-real.png` |

---

## 4. Conclusão do Diagnóstico

A informação extraída do carrinho do Cicalfer **NÃO CHEGA** até o modal da Saracota pelos seguintes motivos documentados:

1. **Permissão de Banco (RLS):** A gravação do registro da cotação falha no Supabase por política de segurança RLS não liberada para inserções de API sem sessão de usuário.
2. **Desconexão de Leitura do Frontend:** O componente do frontend (`CotacoesContext.tsx`) busca cotações apenas na tabela `cotacoes` e não realiza a junção de dados com `itens_cotacao_fornecedor` ou `cotacao_fornecedor_sessoes`.
3. **Mapeamento Genérico:** O contexto do frontend renderiza fornecedores com valores estáticos/mock e não consome os itens cotados individualmente retornados pelo motor RPA.
