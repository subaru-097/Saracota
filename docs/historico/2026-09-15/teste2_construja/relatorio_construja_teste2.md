# Relatório de Diagnóstico de Autenticação — Fornecedor Construjá (Teste 2)

- **Data de Execução**: 15/09/2026, 12:59:00
- **Fornecedor**: Construjá (`a1684c4d-d896-4ba9-a591-cda455c5ffe2`)
- **URL**: https://www.construja.com.br/
- **Endpoint Chamado**: `POST https://api.construja.com.br/v1/login/b2b`
- **Resultado do Login**: ❌ `HTTP 400 Bad Request — Credenciais inválidas`

---

## 🔬 Diagnóstico Técnico Detalhado

1. **Ação Realizada pelo Robô**:
   - O robô navegou até `https://www.construja.com.br/`.
   - Clicou no botão de aceitar cookies `#botao-aceitar-todos`.
   - Clicou em `button#botao-login`, abrindo o modal de login.
   - Preencheu os seletores `input[name="email"]` (`comercialsantana2021@gmail.com`) e `input#senha` (`871935`).
   - Clicou em `button#btn-entrar`.

2. **Captura da Requisição HTTP na Rede**:
   - O formulário disparou corretamente a requisição `POST` para a API de backend da Construjá:
     - **URL**: `https://api.construja.com.br/v1/login/b2b?`
     - **Payload Enviado**: `{"cpf":"comercialsantana2021@gmail.com","senha":"871935","captcha":null}`

3. **Resposta do Servidor da Construjá**:
   - **Status HTTP**: `400 Bad Request`
   - **Body Retornado**:
     ```json
     {
       "message": "Credenciais inválidas. Restam 4 tentativas antes de sua conta ser temporariamente bloqueada.",
       "error": "Credenciais inválidas. Restam 4 tentativas antes de sua conta ser temporariamente bloqueada."
     }
     ```

4. **Conclusão da Causa Raiz**:
   - O fluxo de automação (clique no modal, preenchimento e clique no botão `button#btn-entrar`) **está 100% correto e aciona o endpoint real da Construjá**.
   - O bloqueio de acesso ao carrinho (`/carrinho` ➔ `?access=denied`) ocorre exclusivamente porque a API da Construjá rejeita as credenciais informadas no banco (`comercialsantana2021@gmail.com` / `871935`) como inválidas.
   - Para que a cotação real com preços e carrinho funcione, o cadastro da Construjá precisa receber o CNPJ/CPF correto ou a senha atualizada da conta B2B da Construjá no Vault.

---

## 📁 Arquivos do Histórico
- `construja.json` (Configuração atualizada com `#botao-aceitar-todos` e `button#btn-entrar`)
- `relatorio_construja_teste2.md`
- Screenshots e HTML Dumps em `scratch/diag_01_login_preenchido.png` e `scratch/diag_02_pos_submit.html`.
