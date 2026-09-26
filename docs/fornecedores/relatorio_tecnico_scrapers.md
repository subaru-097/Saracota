# Relatório Técnico Oficial: Fluxo de Raspagem de Fornecedores (Template Reutilizável)

> **Sara Cota SaaS** — Guia técnico e especificação de engenharia dos robôs de raspagem (scrapers) e cotação para os fornecedores **Cicalfer** e **Cofema**.
> Este documento serve de modelo padrão (template) para os próximos fornecedores a serem cadastrados (**Construgem, Megalast, Mercadologista, Negrão** e outros).

---

## 1. Modelo de Referência para Raspagem de Fornecedores (Cheat Sheet)

| Componente | Cicalfer | Cofema | Padrão para Novos Fornecedores |
| :--- | :--- | :--- | :--- |
| **Tipo de Autenticação** | API REST JWT (`/v1/login/b2b`) + Redux State | Login Form HTML + Redux Cookie Session | Inspecionar se existe API REST `/v1/login` ou form HTML. |
| **Seleção de Filial** | Modal B2B (`.ModalClienteFilial`) | Modal B2B / Cookie de Região | Sempre selecionar filial **ENTREGA** antes de cotar. |
| **Navegação de Catálogo** | Endpoint API `GET /v1/busca?page=X` | Navegação DOM SPA / Infinite Scroll | Usar API REST sempre que possível; fallback para Playwright com scroll. |
| **Paginação / Lazy Loading** | `paginator.last_page` (JSON) | Infinite Scroll + Meta `"X produtos encontrados"` | Validar total coletado no DOM contra o texto do cabeçalho. |
| **Deduplicação** | SKU `REF-{id}` (API) | Regex `/produto\/(\d+)-/` -> ID `COF-{id}` | Usar ID numérico extraído do href como chave única. |
| **Extração de Preço Real** | Login B2B + Seleção Filial + `/carrinho` | Login B2B + Seleção Filial + `/carrinho` | Preço final **SEMPRE** via carrinho autenticado ou API logada. |

---

## 2. Documentação Técnica: CICALFER

### 2.1 Autenticação e Credenciais
- **URL Base**: `https://cicalfer.com.br/`
- **Endpoint de Login**: `POST https://api.cicalfer.com.br/v1/login/b2b`
- **Payload de Login**:
  ```json
  {
    "cpf": "email_ou_cnpj_login",
    "senha": "raw_senha_descriptografada",
    "captcha": null
  }
  ```
- **Tipo de Autenticação**: JWT Bearer Token (`token`) enviado nos cabeçalhos HTTP `authorization: Bearer {token}`, acompanhado dos headers `app: VCOM`, `cliente-id: {id}` e `filial-id: {filial}`.
- **Armazenamento no Vault**: A senha é criptografada no Supabase via **AES-256-CBC** (`raw_senha_criptografada`).

### 2.2 Seleção de Filial e Tabela de Preço
- **Elemento Modal**: `div.ModalClienteFilial_optionCard__vj1Sf, div:has-text("ENTREGA")`
- **Regra**: Clicar na filial de destino contendo a palavra-chave `"ENTREGA"` (`idFil: "001"`, `tabelaPreco: "1000 - MATCON - ENTREGA"`).
- **Confirmação**: Botão `button:has-text("Confirmar seleção")`.

### 2.3 Estrutura de Navegação e Paginação
- **Endpoint de Busca de Catálogo**: `GET https://api.cicalfer.com.br/v1/busca?page={page}`
- **Estrutura da Resposta (JSON)**:
  ```json
  {
    "paginator": {
      "total": 1901,
      "per_page": 20,
      "current_page": 1,
      "last_page": 96
    },
    "itens": [ ... ]
  }
  ```
- **Mapeamento de Categorias Pai**:
  - `00001003`: ELETRICA
  - `00001005`: HIDRAULICA
  - `00001006`: PINTURA
  - `00001008`: FERRAMENTAS
  - `00001004`: FERRAGENS
- **Subcategorias no DOM**: Seletor `div[id^="dimensao-"] span.font-size-14.fw-medium.text-uppercase.text-start`.

### 2.4 Extração do Carrinho para Preço Real B2B
- **Adição ao Carrinho**: Digitar a quantidade no campo `input.QuantidadeMaisMenos_input__grKxO` e disparar a tecla `ENTER`.
- **Página do Carrinho**: `https://cicalfer.com.br/carrinho`
- **Seletores de Extração de Dados**:
  - Container de Item: `.ProdutoCompactCarrinho_itemContainer__Eaq76`
  - Título do Produto: `.ProdutoCompactCarrinho_productTitle__n7FXX`
  - Código Badge: `.Badge_badgeContainer__E12a6` (`#10600`)
  - Preço Unitário: `span.fs-14.fw-bold` (Formato: `R$ 7,72`)
  - Subtotal / Total Pedido: `tr:has-text("Total pedido") td.text-end`

---

## 3. Documentação Técnica: COFEMA

### 3.1 Autenticação e Credenciais
- **URL Base**: `https://www.cofema.com.br/`
- **Gatilho de Login**: `button#botao-login` ou `.btn-login`
- **Campos do Formulário**:
  - E-mail: `input[name="email"].form-control`
  - Senha: `input#senha[name="senha"]`
  - Submissão: `button#btn-entrar`
- **Tipo de Autenticação**: Sessão reidratada via Cookies HTTP-Only + Redux Store (`persist:auth`).

### 3.2 Seleção de Filial e Região
- **Modal de Região**: `.ModalClienteFilial_optionCard__vj1Sf`
- **Confirmação**: `button:has-text("Confirmar seleção")`
- **Desvio de Popups**: Auto-click no botão `button.shepherd-button, button:has-text("Entendi")` para evitar bloqueios de onboarding visual.

### 3.3 Estrutura de Navegação, Seletores e Deduplicação do Catálogo Cofema

#### A. Estrutura Geral das Seções
- **Formato**: A home e as páginas principais organizam produtos por seções de carrossel/grid (ex: *Promoções*, *Elétrica*, *Ferragens*, *Hidráulica*, *Pintura*, *Segurança*, etc.).

#### B. Seletor de Categoria / Seção
- **HTML**: `<h3 class="text-2xl sm:text-xl font-bold text-foreground leading-tight">Ferragens</h3>`
- **Seletor**: `h3.text-2xl.sm\:text-xl.font-bold.text-foreground, h3`
- **Extração**: Nome do segmento/categoria (ex: `FERRAGENS`, `ELÉTRICA`, `HIDRÁULICA`).

#### C. Botão "Ver todos"
- **HTML**: `<button class="... text-muted-foreground hover:text-foreground ...">Ver todos<svg .../></button>`
- **Seletor**: `button:has-text("Ver todos")` (dentro do container da seção).
- **Ação**: Clique real no Playwright (`btn.click({ force: true })`) acompanhado de `page.waitForNavigation()` para capturar a URL de listagem completa e navegar pelas subcategorias.

#### D. Link do Produto, Nome e Chave Única de Deduplicação
- **HTML**:
  ```html
  <a class="absolute inset-0 z-[1] touch-manipulation rounded-t-lg"
     aria-label="Ver produto DISCO DE CORTE PARA FERRO NORTON 302 CLASSIC 12X1 66252842718"
     href="/page/produto/405781-disco-de-corte-para-ferro-norton-302-classic-12x1-66252842718">
  </a>
  ```
- **Seletor**: `a[aria-label^="Ver produto"]`
- **Campos Extraídos**:
  - `aria-label` → Nome limpo e completo do produto sem corte de texto visível (ex: `"DISCO DE CORTE PARA FERRO NORTON 302 CLASSIC 12X1 66252842718"`).
  - `href` → URL relativa do produto (`/page/produto/405781-disco-de-corte-...`).
  - `ID Numérico do Produto`: Extraído via regex no `href`: `/produto\/(\d+)-/` → grupo 1 (ex: `405781`).
- **Estratégia de Persistência e Dedupe**: O ID numérico (`405781`) é a chave única no mapa de deduplicação (SKU `COF-405781`), garantindo que se o mesmo item aparecer nas seções "Promoções" e "Ferragens", ele seja armazenado apenas uma única vez sem duplicar o catálogo.

---

### 3.4 Padrão Obrigatório: Infinite Scroll com Validação de Meta ("X produtos encontrados") e Unicidade por ID

Para qualquer fornecedor que utilize **Infinite Scroll / Lazy Loading** (como a Cofema), o robô de raspagem **NUNCA** pode parar na primeira renderização visível (ex: 40 produtos). O robô deve implementar obrigatoriamente a seguinte arquitetura de 6 etapas:

1. **Sessão Stealth & Bypass WAF (Cloudflare/Captcha)**:
   - Inicializar o navegador Playwright com canal `chrome` (`channel: 'chrome'`) ou Chromium stealth com as flags `--disable-blink-features=AutomationControlled`.
   - Injetar `addInitScript` mascarando `navigator.webdriver = undefined`.
   - Acessar primeiro a home (`https://www.cofema.com.br/`) para carregar os cookies de sessão de WAF antes de navegar para páginas de categoria.

2. **Captura da Meta de Validação (`totalEsperado`)**:
   - Ao entrar na página de uma categoria, extrair o texto de contagem total do cabeçalho (ex: `<h3>Elétrica</h3><p>7974 produtos encontrados</p>`).
   - Regex: `/(\d+)\s*produtos\s*encontrados/i`.
   - Guardar `totalEsperado = 7974`.

3. **Loop de Scroll Incremental com Rotação de Rolar/Arrastar**:
   - Contar elementos `a[aria-label^="Ver produto"]` no DOM no momento.
   - Executar rolagem incremental usando `page.mouse.wheel(0, 3000)` combinado com `window.scrollTo(0, document.body.scrollHeight)`.
   - Aguardar intervalo de renderização (1000ms a 1500ms) para lazy loading de novos lotes de 40 produtos.
   - Recontar elementos no DOM e chavear produtos únicos via ID numérico `COF-{id}`.
   - Se o DOM estagnar, executar ação de desentalhe (scroll back 600px e descer novamente).

4. **Trava de Segurança (Timeout & Rounds)**:
   - Limite máximo de **6 minutos por categoria** ou **600 rodadas de scroll** para evitar loops infinitos caso haja falha visual no site.

5. **Validação de Cobertura (% Coletado vs Esperado) e Checagem de Unicidade**:
   - Calcular: `coberturaPercent = (totalColetado / totalEsperado) * 100`.
   - **Regra de Sucesso**: Se `coberturaPercent >= 95%` **OU** `totalColetado >= totalEsperado`: Marca status **`COMPLETO`**.
   - Se `totalColetado < totalEsperado` e `coberturaPercent < 95%`: Marca status **`INCOMPLETO`** com aviso no relatório.
   - **Checagem de Unicidade por ID**: Validar que o total de SKUs coletados é 100% único via contagem por ID numérico (`COF-{id}`). Se `IDs únicos == totalColetado`, confirma ausência de duplicação por scroll reordenado.

6. **Relatório Final Comparativo Estruturado**:
   ```
   CATEGORIA                   | ESPERADO | COLETADO | ÚNICOS ID | COBERTURA | STATUS
   --------------------------------------------------------------------------------
   Promoções                   |      194 |      194 |       194 |      100% | ✅ COMPLETO
   Outlet                      |       55 |       55 |        55 |      100% | ✅ COMPLETO
   Elétrica                    |     7974 |     7974 |      7974 |      100% | ✅ COMPLETO
   Ferragens                   |     3420 |     3420 |      3420 |      100% | ✅ COMPLETO
   Hidráulica                  |     2150 |     2150 |      2150 |      100% | ✅ COMPLETO
   ```

---

## 4. Guia Rápido de Template para Novos Fornecedores (Construgem, Megalast, etc.)

Para cadastrar um novo fornecedor em menos de 1 hora:
1. Inspecione o fluxo de login com F12 no Chrome.
2. Identifique se os preços de catálogo vêm via API REST ou DOM renderizado.
3. Crie a entrada na tabela `fornecedores` no Supabase preenchendo os seletores CSS no JSONB.
4. Criptografe a senha no Vault via `encryptAES256`.
5. Execute a rotina de raspagem completa salvando em `catalogos/{slug}/produtos_brutos.json` com checkpoint, deduplicação por ID e validação de meta por categoria.
