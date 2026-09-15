# Padrão de Integração de Fornecedores B2B — Sara Cota SaaS

Este documento descreve o padrão arquitetural e operacional para automação de cotações B2B (RPA / Playwright) no sistema **Sara Cota**.

---

## 🏛️ Arquitetura do Sistema de Cotação

O sistema de cotações é composto por três camadas desacopladas:

1. **Motor Central Genérico (`core/services/supplier-quote-engine/index.js`)**:
   - Contém toda a lógica reutilizável de navegação, cálculo de lote por proximidade, tratamento de modais de alteração de orçamento, adição sequencial de múltiplos itens e persistência de dados no Supabase.

2. **Arquivos de Configuração de Fornecedor (`config/suppliers/<fornecedor_id>.json`)**:
   - Contêm exclusivamente os dados declarativos específicos de cada fornecedor: URLs, seletores CSS/XPath, palavras-chave de lote, seletores de filiais e textos de confirmação de modais.

3. **Camada de Persistência Sara Cota (Supabase)**:
   - Registra o resultado oficial da cotação nas tabelas `cotacoes` e `itens_cotacao`, vinculando o ID do fornecedor, o valor total e o detalhamento por item.

---

## 🔄 Fluxo Padronizado em 5 Etapas

```mermaid
flowchart TD
    A[Início do Job de Cotação] --> B[1. Autenticação & Filial]
    B --> C[2. Busca de Produto]
    C --> D[3. Leitura de Lote & Arredondamento por Proximidade]
    D --> E[4. Inserção de Qtd & Trata Modais "Confirmar"]
    E --> F{Mais itens na lista?}
    F -- SIM --> C
    F -- NÃO --> G[5. Extração do Carrinho & Persistência no Supabase]
```

### Etapa 1 — Autenticação & Seleção de Contexto (Filial)
- Leitura das credenciais cadastradas na tabela `fornecedores` no Supabase (descriptografia via AES-256).
- Acesso à URL oficial do fornecedor, preenchimento do formulário de login e aceite de cookies.
- Desambiguação de filial B2B (ex: seleção do card `ENTREGA` / `Tabela 1000`) e recarga de página para reidratação dos cookies de sessão B2B.

### Etapa 2 — Busca & Arredondamento por Proximidade de Lote
- O motor realiza a busca do produto via código de referência (REF) ou termo descritivo.
- Leitura automática da informação de embalagem no card do produto (textos como `"VENDE DE X EM X"` ou `"EMB: X"`).
- **Fórmula de Arredondamento por Proximidade:**
  $$M_{\text{baixo}} = \max\left(\left\lfloor \frac{Q}{X} \right\rfloor \times X, X\right)$$
  $$M_{\text{alto}} = M_{\text{baixo}} + X$$
  $$\text{dist}_{\text{baixo}} = |Q - M_{\text{baixo}}|$$
  $$\text{dist}_{\text{alto}} = |M_{\text{alto}} - Q|$$
  $$Q_{\text{final}} = \begin{cases} M_{\text{baixo}} & \text{se } \text{dist}_{\text{baixo}} < \text{dist}_{\text{alto}} \\ M_{\text{alto}} & \text{se } \text{dist}_{\text{alto}} \le \text{dist}_{\text{baixo}} \end{cases}$$

- **Exemplo Prático (Broxa Roma REF: 11992, EMB: 12):**
  - Cliente solicitou: $Q = 13$ unidades.
  - Lote: $X = 12$.
  - Múltiplos: $M_{\text{baixo}} = 12$, $M_{\text{alto}} = 24$.
  - Distâncias: $|13 - 12| = 1$ vs $|24 - 13| = 11$.
  - Quantidade final ajustada: **12 unidades** (distância 1 vs 11).

- **Log Obrigatório Registrado:**
  > `"Cliente pediu 13, lote de 12 em 12, mais próximo é 12 (distâncias: baixo=1, alto=11) → quantidade ajustada para 12."`

### Etapa 3 — Inserção de Quantidade & Resposta a Modais
- Preenchimento do valor $Q_{\text{final}}$ no input do produto e disparo de `blur` para recálculo do subtotal.
- Submissão via Enter ou botão de adição.
- **Regra de Modais de Orçamento:** Caso surja o modal perguntando *"Deseja manter o orçamento aberto?"* ou *"Confirmar alteração"*, o robô intercepta e clica automaticamente em **`Confirmar`** para não resetar nem perder o carrinho ativo.

### Etapa 4 — Adição Sequencial de Múltiplos Itens
- Repetição iterativa das Etapas 2 e 3 na mesma sessão de navegador, permitindo a montagem de orçamentos completos de múltiplos itens sem deslogar.

### Etapa 5 — Extração do Carrinho & Persistência na Sara Cota
- Navegação para a URL do carrinho (`/carrinho`).
- Extração estruturada dos dados: nome do produto, quantidade final, preço unitário e valor total.
- Gravação direta no Supabase:
  - Registro principal na tabela **`cotacoes`** (`fornecedor_id`, `status: "concluida"`, `valor_total`).
  - Registros de itens na tabela **`itens_cotacao`** (`cotacao_id`, `material`, `quantidade`, `preco_unitario`).

---

## 🛠️ Guia para Cadastrar Novo Fornecedor (ex: Construgama)

Para adicionar suporte a um novo fornecedor utilizando o mesmo motor central:

1. **Criar o arquivo de configuração `config/suppliers/construgama.json`**:
   ```json
   {
     "id": "construgama",
     "nome": "Construgama",
     "url_site": "https://www.construgama.com.br/",
     "selectors": {
       "cookie_accept": "button#accept-cookies",
       "login_trigger": "a:has-text(\"Entrar\")",
       "email_input": "input[name=\"email\"]",
       "password_input": "input[name=\"password\"]",
       "login_submit": "button[type=\"submit\"]",
       "search_input": "input[name=\"q\"]",
       "search_button": "button[type=\"submit\"]",
       "quantity_input": "input[name=\"qty\"]",
       "modal_confirm_alteration": "div.modal-confirm",
       "modal_confirm_button": "button.btn-confirm",
       "cart_url": "https://www.construgama.com.br/carrinho"
     },
     "default_filial_keyword": "ENTREGA"
   }
   ```

2. **Executar o motor central passando a nova config**:
   ```javascript
   const quoteEngine = require('./core/services/supplier-quote-engine');
   const construgamaConfig = require('./config/suppliers/construgama.json');

   // Executa o mesmo fluxo reutilizável
   await quoteEngine.realizarLogin(page, construgamaConfig, credentials);
   ```

---

## 📌 Referência de Implementação Validada
- **Módulo Central:** [`core/services/supplier-quote-engine/index.js`](file:///c:/Users/User/Desktop/Saracota/core/services/supplier-quote-engine/index.js)
- **Configuração do Cicalfer:** [`config/suppliers/cicalfer.json`](file:///c:/Users/User/Desktop/Saracota/config/suppliers/cicalfer.json)
- **Script de Execução Integration:** [`scripts/run_supplier_quote.js`](file:///c:/Users/User/Desktop/Saracota/scripts/run_supplier_quote.js)
