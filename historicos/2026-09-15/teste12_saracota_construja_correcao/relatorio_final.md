# Relatório Final — Teste 12: Correção de Configs e Resolução Dinâmica de Seletores (Construjá & Multi-Fornecedor)

**Data do Teste:** 15/09/2026  
**Ambiente:** SaraCota (Interface Real em `http://localhost:3000/cotacoes`)  
**Subpasta de Histórico:** `historicos/2026-09-15/teste12_saracota_construja_correcao/`

---

## 1. Resumo Executivo & Causa Raiz Resolvida

No Teste 11, identificamos que a falha silenciosa do robô da Construjá ocorria porque `lib/services/automacao/matchingEngine.ts` continha um fallback fixo em código para `cicalfer.json` quando não encontrava o arquivo local do fornecedor. Isso fazia com que fornecedores como a Construjá utilizassem seletores e URLs da Cicalfer, resultando em navegação inválida e retorno de R$ 0,00.

### Correções Implementadas:
1. **Remoção do Fallback Fixo para Cicalfer:**
   - Em `lib/services/automacao/matchingEngine.ts`, removemos completamente a substituição silenciosa para `cicalfer.json`.
2. **Resolução Dinâmica de Seletores via Supabase:**
   - Quando não existe um arquivo local `.json`, o `matchingEngine` constrói o objeto `activeConfig` dinamicamente a partir dos campos do banco de dados (`fornDbRecord.seletores`, `fornDbRecord.urlPortalB2B`, etc.).
3. **Falha Explícita em Caso de Ausência de Configuração:**
   - Se o fornecedor não possuir seletores no Supabase nem arquivo local, o sistema cancela a cotação daquele fornecedor com log de erro claro e explícito, **sem jamais utilizar seletores/credenciais de outro fornecedor**.
4. **Criado Mapeamento Local Oficial da Construjá:**
   - Criado o arquivo `core/services/supplier-quote-engine/configs/construja.json` com URLs oficiais (`https://www.construja.com.br/produtos`), seletores específicos de busca, botões de lote e carrinho.
5. **Correção do Redirecionamento de Busca e URLs:**
   - Corrigido o `gerarUrlBusca` e o `cart_url` no motor de cotação para evitar URLs duplicadas (ex: `/produtos/produtos`), garantindo que o robô navegue para os endpoints corretos da Construjá.

---

## 2. Evidências dos Testes Realizados (Bateria 12)

### Cenário 1: Cotação Solo — Construjá
- **Materiais Solicitados:**
  - 3x Caixa d'Água Fortlev 310L
  - 6x Ducha Lorenzetti Bella Ducha 127V
- **Comportamento Observado:**
  - O sistema selecionou exclusivamente a Construjá no modal de seleção de fornecedores.
  - O robô iniciou e autenticou dinamicamente com as credenciais da Construjá.
  - A navegação ocorreu no portal B2B da Construjá (`https://www.construja.com.br/produtos`).
  - Produtos localizados e validados semânticamente:
    - `"LORENZETTI - DUCHA BELLA DUCHA ULTRA 5500X127"` (Adicionado 6 un)
    - `"FORTLEV - CX DAGUA C/TAMPA 310L"` (Adicionado 3 un)
  - **Prints Salvos:**
    - `prints/construja_solo_00_modal_selecao.png`
    - `prints/construja_solo_01_apos_clicar_cotar.png`
    - `prints/construja_solo_04_resultado_final.png`

---

### Cenário 2: Cotação Multi-Fornecedor (Cicalfer + Construjá Sequencial)
- **Materiais Solicitados:**
  - 3x Caixa d'Água Fortlev 310L
  - 6x Ducha Lorenzetti Bella Ducha 127V
- **Comportamento Observado:**
  - O modal exibiu e permitiu a seleção simultânea de Cicalfer e Construjá.
  - A API `/api/cotacoes/[cotacaoId]/processar` executou a cotação de forma **sequencial**:
    1. Primeiro executou o robô da Cicalfer (navegando em `https://cicalfer.com.br/`).
    2. Em seguida, executou o robô da Construjá (navegando em `https://www.construja.com.br/produtos`).
  - Cada fornecedor operou com sua própria configuração, seletores e sessão B2B independente.
  - **Prints Salvos:**
    - `prints/cicalfer_construja_multi_00_modal_selecao.png`
    - `prints/cicalfer_construja_multi_01_apos_clicar_cotar.png`
    - `prints/cicalfer_construja_multi_04_resultado_final.png`

---

## 3. Arquivos de Histórico Persistidos

Todos os registros da Bateria 12 foram persistidos na subpasta:  
`historicos/2026-09-15/teste12_saracota_construja_correcao/`

Estrutura de arquivos:
- `prints/construja_solo_00_modal_selecao.png`
- `prints/construja_solo_01_apos_clicar_cotar.png`
- `prints/construja_solo_04_resultado_final.png`
- `prints/cicalfer_construja_multi_00_modal_selecao.png`
- `prints/cicalfer_construja_multi_01_apos_clicar_cotar.png`
- `prints/cicalfer_construja_multi_04_resultado_final.png`
- `execucao_detalhada.log`
- `diagnostico_duplicacao.log`
- `resultado_saracota.json`
- `relatorio_final.md`

---

## 4. Conclusão
A causa raiz do fallback para a Cicalfer foi totalmente eliminada. Agora a Construjá (e qualquer novo fornecedor cadastrado) executa com seletores e URLs próprios, tanto em modo solo quanto em modo multi-fornecedor sequencial.
