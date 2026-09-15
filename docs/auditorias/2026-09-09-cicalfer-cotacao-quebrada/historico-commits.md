# Histórico de Commits Recentes do Motor de Cotação

Módulos monitorados:
- `core/services/supplier-quote-engine`
- `config/suppliers/cicalfer.json`

---

### Commits Principais

1. **`6dba164`** - *feat: implement cotacao_fornecedor_sessoes table structure with composite key (cotacao_id, fornecedor_id) upsert and query*
   - Adicionada estrutura de persistência para sessões ativas por fornecedor e cotação.

2. **`2babf4c`** - *logging: add immediate logs for session creation and explicit Supabase save status*
   - Logs adicionados para rastrear status de gravação.

3. **`3e71b81`** - *fix: scope browserbase_session_id by (cotacaoId, fornecedorId) and add explicit Supabase update error logging*
   - Correção de escopo de sessão.

4. **`9e658b6`** - *fix: implement all 7 PASSO 2 rules (single session creation, disconnect only, Supabase session persistence, route reuse, structured logs, key=liveViewUrl iframe, no fallback URLs)*
   - Regras de persistência e reutilização de rota.

5. **`0e5ffe9`** - *fix: remove premature return in session reuse to ensure CDP connection and page.goto navigation runs for every session*
   - Garantia de execução de navegação CDP em reuso.

---
