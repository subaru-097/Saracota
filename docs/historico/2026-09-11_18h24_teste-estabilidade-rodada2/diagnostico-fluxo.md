# Diagnóstico de Fluxo de Execução — Rodada 2

## Confirmação de Rota Única Ativa (Sem Concorrência de Mocks)

Auditamos o caminho de código efetivamente percorrido durante a cotação da **Rodada 2**:

### 1. Ponto de Entrada API (Endpoint REST HTTP)
- **Arquivo**: [`app/api/cotacoes/processar/route.ts`](file:///c:/Users/User/Desktop/Saracota/app/api/cotacoes/processar/route.ts#L8-L35)
- **Função**: `POST(req: NextRequest)`
- **Ação**: Recebe o `cotacaoId` da UI e dispara em segundo plano o processamento real `processarCotacaoTodosFornecedores(cotacaoId)`.

### 2. Motor de Orquestração e Matching Engine
- **Arquivo**: [`lib/services/automacao/matchingEngine.ts`](file:///c:/Users/User/Desktop/Saracota/lib/services/automacao/matchingEngine.ts#L92-L248)
- **Função**: `processarCotacaoFornecedor(cotacaoId, fornecedorId)`
- **Ação**: 
  - Lê a cotação no PostgreSQL via `db.cotacoes.getById(cotacaoId)`.
  - Identifica o fornecedor como Cicalfer (ID `33e03495-100d-45a3-9e34-899de56b0ab1`).
  - Carrega as credenciais reais de login da Cicalfer descriptografadas via `decryptAES256`.
  - Instancia o navegador autônomo Playwright (Chromium headless) e executa o login real no portal B2B da Cicalfer.

### 3. Motor Central de Automação RPA (Scraper B2B)
- **Arquivo**: [`core/services/supplier-quote-engine/index.js`](file:///c:/Users/User/Desktop/Saracota/core/services/supplier-quote-engine/index.js#L60-L450)
- **Configuração**: [`config/suppliers/cicalfer.json`](file:///c:/Users/User/Desktop/Saracota/config/suppliers/cicalfer.json)
- **Funções Efetivamente Executadas**:
  - `realizarLogin(page, config, credentials)` (linhas 60-140): Seleção de filial B2B e login autenticado.
  - `adicionarItem(page, config, item)` (linhas 150-320): Busca e inclusão dos 3 itens reais no carrinho B2B com cálculo de lote em embalagem.
  - `extrairCarrinho(page, config)` (linhas 330-450): Leitura da tabela DOM do carrinho (`itemContainer`), extração de nomes comerciais oficiais do site, quantidades e totais.

### 4. Persistência de Resultados
- **Arquivo**: [`lib/db/client.ts`](file:///c:/Users/User/Desktop/Saracota/lib/db/client.ts#L180-L220)
- **Função**: `db.cotacoes.salvarResultadosMatching(cotacaoId, fornecedorId, resultados)`
- **Ação**: Persiste o matching no Supabase/PostgreSQL com os produtos extraídos diretamente do site do fornecedor.

> [!NOTE]
> **GARANTIA DE ROTA ÚNICA**: Não há rotas concorrentes com fallback/mock ativas. Todos os fallbacks de itens fixos (`itensDraft` de Broxa e Alicate) foram 100% removidos.
