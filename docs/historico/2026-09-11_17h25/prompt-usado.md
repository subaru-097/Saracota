ORGANIZAÇÃO DE HISTÓRICO + TESTE REAL (SEM FALLBACK)

1. ORGANIZAÇÃO DE PASTAS (a partir de agora, obrigatório)
   Dentro de historico/prints, pare de salvar tudo solto. A partir deste momento, TODA nova execução de teste/diagnóstico deve criar uma subpasta própria, com o padrão:

   historico/AAAA-MM-DD_HHhMM/
      ├── prints/         (todos os screenshots dessa execução)
      ├── logs/           (logs de terminal, txt)
      └── prompt-usado.md (cópia do prompt que originou esse teste)

   Exemplo: historico/2026-09-10_20h42/prints/01_login.png

   Migre os arquivos soltos que já existem em historico/prints (os que estão com prefixo de data 2026-09-10_*) para a subpasta correspondente do dia, mantendo apenas os mais antigos genéricos (sem data) na raiz como "referência legada", se quiser preservar.

2. DOCUMENTAÇÃO DO PROMPT
   Toda vez que eu enviar um prompt de teste, salve uma cópia dele em prompt-usado.md dentro da subpasta criada para aquela execução, antes de começar a rodar.

3. CORREÇÃO CRÍTICA — TESTE AINDA USA FALLBACK
   O log da última execução mostra os itens CABO FLEX, BROXA ROMA RETANGULAR e ALICATE BICO CHATO MTX 6 — esses NÃO são os produtos reais que o Vinicius vai digitar. Isso confirma que o fallback fixo ainda está ativo.

   Ação obrigatória antes do próximo teste:
   - Localizar e remover TODO fallback fixo de itens no código (matchingEngine, mocks, stores em memória).
   - Limpar/expirar cotações antigas no banco.
   - Repetir o teste digitando manualmente, via browser, dentro do Bloco de Compras Inteligente da Saracota, os produtos reais:
     • 2 uni CABO FLEX 100M COBRECOM 2,50MM
     • 5 uni DUCHA LORENZETTI BELLA DUCHA 127V
     • 7 uni DUCHA LORENZETTI TOP JET MULTI 127V
   - Fornecedor: apenas Cicalfer (corrigir cadastro se a URL/DNS estiver quebrada — é cicalfer.com.br, não secofair).

Salve todos os prints e logs desse novo teste na subpasta historico/2026-09-11_17h25/ conforme especificado no item 1, e me envie o log final confirmando que os 3 itens exibidos no Modal Detalhado são os produtos reais acima (não os de fallback).
