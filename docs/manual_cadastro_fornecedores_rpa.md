# Manual Oficial de Onboarding e Cadastro de Fornecedores RPA (Zero Código)

> **Sara Cota SaaS** — Guia oficial para cadastro e ativação de novos fornecedores RPA no sistema integrando 100% via **Supabase**, eliminando a necessidade de alteração de código TypeScript no backend.

---

## 1. Visão Geral da Arquitetura de Cadastro

Com a refatoração do motor de cotação (`lib/services/automacao/matchingEngine.ts`), todos os fornecedores novos ou existentes possuem seus seletores CSS, URLs e credenciais lidos diretamente da tabela `fornecedores` do banco de dados **Supabase**.

Quando uma cotação é iniciada:
1. O backend busca o registro do fornecedor na tabela `fornecedores` por seu `id`.
2. Lê a coluna `config_slug` (ou `configSlug`) e a coluna JSONB `seletores`.
3. Descriptografa a senha contida em `raw_senha_criptografada` via **Vault (AES-256-CBC)**.
4. Monta a configuração do robô Playwright dinamicamente em memória e inicia a navegação de forma 100% autônoma.

---

## 2. Estrutura de Colunas da Tabela `fornecedores` (Supabase)

Para cadastrar um novo fornecedor, os seguintes campos devem ser preenchidos na tabela `fornecedores`:

| Coluna | Tipo | Obrigatório | Exemplo | Descrição |
|---|---|---|---|---|
| `id` | `UUID` | Sim | `gen_random_uuid()` | Identificador único do fornecedor no sistema. |
| `nome` | `VARCHAR(255)` | Sim | `'Cofema Atacado'` | Nome amigável do fornecedor exibido no painel Sara Cota. |
| `config_slug` | `VARCHAR(100)` | Sim | `'cofema'` | Slug em minúsculo, sem acentos nem espaços (ex: `cofema`, `construja`). |
| `url_portal_b2b` | `TEXT` | Sim | `'https://www.cofema.com.br/produtos'` | URL exata da página de catálogo/login B2B do fornecedor. |
| `rpa_ativo` | `BOOLEAN` | Sim | `true` | Define se o robô RPA está ativo para cotação. |
| `email_login` | `TEXT` | Sim | `'comercial@santana.com.br'` | E-mail / usuário de acesso ao portal do fornecedor. |
| `raw_senha_criptografada` | `TEXT` | Sim | `'4f1a...:9c8b...'` | Senha criptografada no padrão Vault AES-256 (`iv:hex_encrypted`). |
| `seletores` | `JSONB` | Sim | `(Ver JSONB abaixo)` | Mapa completo de seletores CSS/XPath e regras de negócio. |

---

## 3. Estrutura Padrão do JSONB `seletores`

O objeto JSONB salvo na coluna `seletores` deve seguir a estrutura minimalista e compatível abaixo:

```json
{
  "nome": "Cofema Atacado",
  "slug": "cofema",
  "url_site": "https://www.cofema.com.br/produtos",
  "selectors": {
    "cookie_accept": "button:has-text(\"Aceitar\"), button:has-text(\"Concordar\"), #lgpd-aceitar",
    "login_trigger": "#botao-login, button:has-text(\"Entrar\"), .btn-login",
    "email_input": "input[name=\"email\"].form-control, input[name=\"email\"]",
    "password_input": "input#senha[name=\"senha\"], input[type=\"password\"]",
    "login_submit": "button#btn-entrar, button[type=\"submit\"]",
    "filial_cards": "button.ModalClienteFilial_optionCard__vj1Sf, #select-filial",
    "filial_confirm": "button:has-text(\"Confirmar seleção\"), button:has-text(\"Confirmar\")",
    "search_input": "input[name=\"search\"], input[type=\"search\"]",
    "quantity_input": "input.QuantidadeMaisMenos_input__grKxO, input[type=\"number\"]",
    "item_container": ".ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*=\"itemContainer\"]",
    "product_card_title": ".ProdutoCompactCarrinho_productTitle__n7FXX, a[href*=\"/produto/\"]",
    "product_title": ".ProdutoCompactCarrinho_productTitle__n7FXX",
    "unit_price": "span.fs-14.fw-bold, .unit-price",
    "abrir_carrinho_button": "#botao-abrir-carrinho, button:has-text(\"Ver carrinho\")",
    "ver_carrinho_button": "button:has-text(\"Ver carrinho\")",
    "resumo_total_pedido": "tr:has-text(\"Total pedido\") td.text-end, .total-pedido"
  },
  "regras_negocio": {
    "metodo_adicao_produto": "ENTER_KEY",
    "formato_preco": "R$0,00 (vírgula decimal)"
  }
}
```

---

## 4. Passo a Passo de Onboarding de Novo Fornecedor (Ex: Cofema)

### Passo 1 — Inspecionar Elementos do Site no Navegador (F12)
1. Acesse o site do fornecedor (ex: `https://www.cofema.com.br/produtos`).
2. Pressione `F12` (Developer Tools) no Chrome ou Edge.
3. Utilize a ferramenta **Inspect** (`Ctrl + Shift + C`) para identificar as IDs e classes CSS dos seguintes elementos essenciais:
   - **Botão Aceitar Cookies**: Ex: `button:has-text("Aceitar")` ou `#lgpd-aceitar`.
   - **Gatilho de Login**: Botão que abre a tela/modal de login. Ex: `#botao-login`.
   - **Campos de Login**: Input de e-mail (`input[name="email"]`) e senha (`input[type="password"]`).
   - **Botão Entrar**: Botão de submissão do formulário. Ex: `button#btn-entrar`.
   - **Campo de Pesquisa de Produto**: Input da barra de busca. Ex: `input[name="search"]`.
   - **Campo de Quantidade de Produto**: Input onde digita a quantidade desejada. Ex: `input.QuantidadeMaisMenos_input__grKxO`.
   - **Gaveta / Tabela do Carrinho**: Container que agrupa cada item no carrinho. Ex: `.ProdutoCompactCarrinho_itemContainer__Eaq76`.
   - **Título do Produto & Preço Unitário**: Classes que contêm o nome e o preço no carrinho. Ex: `.productTitle` e `span.fs-14.fw-bold`.
   - **Total Geral do Pedido**: Célula/elemento contendo o valor total. Ex: `tr:has-text("Total pedido") td.text-end`.

---

### Passo 2 — Criptografar a Senha de Acesso no Vault AES-256
Para armazenar a senha de forma segura, utilize a função `encryptAES256` do módulo `lib/security/vault.ts` (ou execute um script rápido via Node.js):

```javascript
const { encryptAES256 } = require('./lib/security/vault');
const senhaCriptografada = encryptAES256("SenhaDoFornecedor123");
console.log(senhaCriptografada);
// Saída: "a1b2c3d4e5f6...:7890abcdef..."
```

---

### Passo 3 — Executar o SQL de Cadastro no Supabase

Cole e execute a SQL abaixo no Editor SQL do Supabase (ajustando os seletores e credenciais para o fornecedor desejado):

```sql
INSERT INTO fornecedores (
  id,
  nome,
  config_slug,
  url_portal_b2b,
  rpa_ativo,
  email_login,
  raw_senha_criptografada,
  seletores,
  created_at
) VALUES (
  gen_random_uuid(),
  'Cofema Atacado',
  'cofema',
  'https://www.cofema.com.br/produtos',
  TRUE,
  'comercialsantana@gmail.com',
  'SUA_SENHA_CRIPTOGRAFADA_AQUI',
  '{
    "nome": "Cofema Atacado",
    "slug": "cofema",
    "url_site": "https://www.cofema.com.br/produtos",
    "selectors": {
      "cookie_accept": "button:has-text(\"Aceitar\"), #lgpd-aceitar",
      "login_trigger": "#botao-login",
      "email_input": "input[name=\"email\"].form-control",
      "password_input": "input#senha[name=\"senha\"]",
      "login_submit": "button#btn-entrar",
      "search_input": "input[name=\"search\"]",
      "quantity_input": "input.QuantidadeMaisMenos_input__grKxO",
      "item_container": ".ProdutoCompactCarrinho_itemContainer__Eaq76",
      "product_title": ".ProdutoCompactCarrinho_productTitle__n7FXX",
      "unit_price": "span.fs-14.fw-bold",
      "abrir_carrinho_button": "#botao-abrir-carrinho",
      "resumo_total_pedido": "tr:has-text(\"Total pedido\") td.text-end"
    },
    "regras_negocio": {
      "metodo_adicao_produto": "ENTER_KEY",
      "formato_preco": "R$0,00 (vírgula decimal)"
    }
  }'::jsonb,
  NOW()
);
```

---

### Passo 4 — Validação Sem Necessidade de Deploy
Assim que o registro é gravado no Supabase:
- O fornecedor aparecerá automaticamente na lista de fornecedores disponíveis no painel Sara Cota.
- Ao disparar uma cotação para a Cofema, o backend lerá o `config_slug` (`'cofema'`), carregará a URL e seletores diretamente do Supabase e executará o robô autonomamente sem necessidade de build ou deploy de novo código TypeScript!
