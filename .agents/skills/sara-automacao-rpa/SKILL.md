---
name: sara-automacao-rpa
description: Convenções para scripts de automação (extensão Chrome / Playwright) que fazem login e cotação nos sites dos fornecedores. Use sempre que criar ou modificar lógica de RPA/scraping.
---

# Automação RPA

## Regras
- Sessões de login de fornecedores devem ser armazenadas criptografadas, nunca senha em texto puro
- Cada fornecedor deve ter um "adapter" próprio (classe/módulo) que implementa uma interface comum: login(), buscarProduto(item), adicionarAoCarrinho(produto), obterResumo()
- Tratar timeouts e falhas de forma resiliente: se um fornecedor falhar, a cotação dos outros deve continuar normalmente (falha isolada, nunca bloqueia o job todo)
- Toda automação deve rodar como job assíncrono na fila, nunca bloquear requisição HTTP
- Ao final da cotação, manter a aba/sessão aberta no ponto exato do carrinho montado, para o cliente poder finalizar manualmente ao "fechar cotação"
- Fechamento automático de abas apenas após 2 horas do término da cotação (job agendado)
