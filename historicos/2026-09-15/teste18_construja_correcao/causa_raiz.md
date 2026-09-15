# CAUSA RAIZ TÉCNICA — TESTE 18 (ROBÔ CONSTRUJÁ)

**Data:** 2026-09-15  
**Componente:** Motor RPA / Automação Construjá (`core/services/supplier-quote-engine/configs/construja.json` & Supabase `seletores`)

---

## 1. IDENTIFICAÇÃO DA CAUSA RAIZ

Na execução anterior (Teste 17), o robô da Construjá pultava as etapas iniciais de aceite de cookies, abertura do modal de login e preenchimento de credenciais, indo direto para a busca de produtos sem autenticação.

A investigação detalhada dos arquivos e seletores revelou as duas causas raízes exatas:

### Causa Raiz 1: Ausência do Seletor `cookie_accept` em `construja.json`
- O arquivo `construja.json` e o registro no Supabase possuíam seletores para `login_trigger`, `email_input`, `password_input` e `login_submit`, porém **NÃO possuíam o seletor `cookie_accept`** definido.
- Em navegadores em modo headless/novo contexto, o portal `construja.com.br` exibe um banner/modal bloqueante de LGPD/Cookies ("Aceitar").
- Como `sel.cookie_accept` era `undefined`, a função `realizarLogin` em `index.js` tentava clicar diretamente no botão de login (`#botao-login`), mas a camada transparente/backdrop do banner de cookies interceptava ou bloqueava a interação, impedindo a abertura do modal de login.

### Causa Raiz 2: URL de Carrinho Inexistente (`cart_url: ".../produtos/carrinho"`)
- A configuração definia `cart_url` como `"https://www.construja.com.br/produtos/carrinho"`.
- No portal Construjá, o carrinho **NÃO é uma página separada nessa URL** — a navegação para essa URL retorna uma página de erro HTTP 404 ("Ops! Algo deu errado. A página que você está tentando acessar não foi encontrada").
- Ao tentar navegar para essa URL 404 durante a etapa de extração, a sessão do carrinho era perdida no browser e a extração retornava `R$ 0,00` (zero itens).
- O carrinho real da Construjá é uma **gaveta slide-over / drawer modal** acionada na própria página de produtos através do botão `#botao-abrir-carrinho`.

---

## 2. IMPACTO E CONFIRMAÇÃO DA CAUSA

- Ao adicionar `"cookie_accept"` no mapeamento do fornecedor e direcionar o carrinho para o modal interno (`#botao-abrir-carrinho`), o robô passou a:
  1. Detectar e aceitar o banner de cookies instantaneamente.
  2. Clicar no `#botao-login` e abrir o modal.
  3. Preencher e-mail (`comercialsantana@gmail.com`) e senha (`53597`).
  4. Confirmar a sessão logada.
  5. Adicionar itens e extrair os valores numéricos reais sem cair na tela de erro 404.
