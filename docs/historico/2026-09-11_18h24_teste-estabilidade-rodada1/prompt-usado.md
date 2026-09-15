CONTEXTO: Já validamos que o motor de cotação (quote-engine-cicalfer.js) passou por um teste com sucesso 100% (3 itens reais, 0 fallback, log em historico/2026-09-11_17h25/). MAS esse sistema JÁ TINHA funcionado antes e regrediu para mock sem ninguém alterar nada. Por isso, um teste único "passando" não é prova suficiente de estabilidade.

TAREFA: Execute o MESMO teste de cotação (Cabo Flex 100M Cobrecom 2,50MM + 2x itens de Ducha Lorenzetti conforme bloco de notas) em 3 RODADAS INDEPENDENTES, uma após a outra, SEM alterar nenhuma linha de código entre elas. Trate cada rodada como uma sessão nova (não reutilize cache, sessão de login ou estado anterior).

Para CADA rodada, crie uma pasta:
historico/YYYY-MM-DD_HHhMM_teste-estabilidade-rodadaN/

Dentro de cada pasta, salve OBRIGATORIAMENTE:
1. prompt-usado.md — o prompt/instrução exata usada na rodada
2. diagnostico-fluxo.md — qual(is) arquivo(s)/função(ões)/rota(s) foram efetivamente executados nesta rodada (nome do arquivo, nome da função, linha aproximada), confirmando que existe apenas UM caminho de código ativo
3. logs/scraping-bruto.log — log crudo da extração
4. logs/validacao-anti-fallback.log — validação confirmando 0 fallback e presença dos 3 itens reais esperados
5. resultado-schema.json — resultado final da cotação no formato do contrato fixo
6. hash-codigo.txt — hash SHA256 dos arquivos centrais
7. prints/ — capturas de tela da UI mostrando cards + modal com os dados reais extraídos

APÓS AS 3 RODADAS: gere um arquivo consolidado COMPARATIVO-3-RODADAS.md.