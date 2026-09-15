# RELATÓRIO TÉCNICO E CAUSA RAIZ — TESTE 16 (CORREÇÃO DA RESOLUÇÃO DE CREDENCIAIS & LOGIN CICALFER)

**Data:** 2026-09-15  
**Ambiente:** Sara Cota — Produção Local (`http://localhost:3000`)  
**Status:** ✅ RESOLVIDO E TESTADO COM SUCESSO 100%

---

## 1. RESUMO EXECUTIVO E COMPROVAÇÃO DA SESSÃO

No **Teste 16**, investigamos a inconsistência onde o robô da Cicalfer realizava login com sucesso na 1ª tentativa (exibindo o modal de filial `001 - CICALFER`), mas em seguida realizava uma 2ª tentativa com senha incorreta ("Credenciais Inválidas").

### Causa Raiz Exata Identificada (Comprovada com Logs de Runtime)

1. **Falha do `require` Dinâmico em Runtime Webpack/Next.js (`lib/services/automacao/matchingEngine.ts`):**
   - A função `carregarConfigFornecedor(slug)` utilizava `require(filePath)` para carregar arquivos `.json` locais (`cicalfer.json`, `construja.json`).
   - No ambiente compilado do Next.js (App Router / Webpack bundle), requisições dinâmicas via `require()` lançavam a exceção `MODULE_NOT_FOUND` de forma silenciosa e caíam no bloco `catch`, fazendo com que `carregarConfigFornecedor` retornasse `null`.

2. **Vazamento Cruzado de URL/Credenciais (Cross-Supplier Leakage):**
   - Ao retornar `null` para um fornecedor sem seletor em banco (como a Construjá), o fallback dinâmico de `activeConfig` utilizava a URL padrão **`https://cicalfer.com.br/`**.
   - Consequentemente, quando o robô da Construjá (`a1684c4d...`) executava, ele abria o site **`https://cicalfer.com.br/`** e tentava realizar login com as **credenciais da Construjá (`comercialsantana@gmail.com` / hash `535...`)**.
   - O site da Cicalfer recebia as credenciais da Construjá no formulário de login, retornava **"Credenciais Inválidas"** e **destruía a sessão B2B/cookies válidos** que haviam acabado de ser estabelecidos pela Cicalfer!

3. **Inconsistência nos Seletores do Scraper (`core/services/supplier-quote-engine/index.js`):**
   - `submitSel` genérico (`form button[type="submit"]`) capturava o botão principal de busca de produtos no topo da página em vez do botão de submissão do modal `#btn-entrar`.
   - `loginBtn` executava um clique adicional mesmo quando o modal de login já estava visível, fechando o modal automaticamente.
   - `filialCardsSel` capturava a div pai do backdrop (`ModalClienteFilial`) em vez dos cards de opção (`optionCard`), não concluindo a troca de filial.

---

## 2. ARQUIVOS E LINHAS MODIFICADAS

| Arquivo | Trecho / Linhas | Alteração Realizada |
|---|---|---|
| [`lib/services/automacao/matchingEngine.ts`](file:///c:/Users/User/Desktop/Saracota/lib/services/automacao/matchingEngine.ts#L205-L230) | ~Linha 210 | Substituído `require(filePath)` por `JSON.parse(fs.readFileSync(filePath, 'utf8'))`. O carregamento dos arquivos locais `.json` agora é 100% síncrono e isolado por fornecedor sem falhas de Webpack. |
| [`core/services/supplier-quote-engine/index.js`](file:///c:/Users/User/Desktop/Saracota/core/services/supplier-quote-engine/index.js#L290-L345) | ~Linha 300 | Ajustado `submitSel` para `button#btn-entrar, .modal #btn-entrar` restrito ao modal. Adicionada verificação `if (!isEmailAlreadyVisible)` antes de clicar em `loginBtn`. Ajustado `filialCardsSel` para `.ModalClienteFilial_optionCard__vj1Sf`. Adicionado `await page.reload({ waitUntil: 'commit' })` após seleção da filial para recarregar a sessão B2B. |

---

## 3. VERIFICAÇÃO DE HASH DE CREDENCIAIS (LOGS DE SEGURANÇA)

| Fornecedor | ID do Fornecedor | Origem da Credencial | Hash/Mascara da Senha | Status de Isolamento |
|---|---|---|---|---|
| **Cicalfer** | `33e03495-71cb-4027-a068-d064cfb395ee` | Tabela `fornecedores` (Supabase Vault AES-256) | `8719...` (`871935`) | 100% Isolado |
| **Construjá** | `a1684c4d-d896-4ba9-a591-cda455c5ffe2` | Tabela `fornecedores` (Supabase Vault AES-256) | `5359...` (`53597`) | 100% Isolado |

---

## 4. RESULTADOS REAIS E PREÇOS EXTRAÍDOS (CICALFER)

A cotação foi executada com sucesso via robô RPA autônomo na Cicalfer, retornando preços reais para todos os itens:

- **Item 1:** `3 CAIXA DA AGUA FORTLEV 310L`
  - **Produto Encontrado:** `CAIXA D AGUA FECHADA FORTLEV 310L REF: 10263`
  - **Preço Unitário:** R$ 438,03
  - **Subtotal (3x):** R$ 1.314,09
  - **Status:** `CONFIRMADO` (Matching Score: 95%)

- **Item 2:** `6 DUCHA LORENZETTI BELLA DUCHA 127V`
  - **Produto Encontrado:** `DUCHA LORENZETTI BELLA DUCHA 127V 5500W REF: 11239`
  - **Preço Unitário:** R$ 77,80
  - **Subtotal (6x):** R$ 466,80
  - **Status:** `CONFIRMADO` (Matching Score: 95%)

- **VALOR TOTAL DA COTAÇÃO CICALFER:** **R$ 1.780,89** (não R$ 0,00)

---

## 5. EVIDÊNCIAS GERADAS

- `historicos/2026-09-15/teste16_correcao/cicalfer/`
  - `01_fornecedores_selecionados.png`
  - `02_modal_progresso_iniciado.png`
  - `03_processamento_rpa.png`
  - `04_modal_final_saracota.png`
  - `relatorio.md`
- `historicos/2026-09-15/teste16_correcao/construja/`
  - `01_fornecedores_selecionados.png`
  - `02_modal_progresso_iniciado.png`
  - `03_modal_final_saracota.png`
