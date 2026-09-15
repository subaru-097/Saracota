# Relatório de Diagnóstico Técnico — Teste 11 (Construjá Solo na SaraCota)

**Data/Hora:** 15/09/2026 16:43  
**Pasta de Destino:** `historicos/2026-09-15/teste11_saracota_construja/`  
**Ambiente de Execução:** SaraCota Real (`http://localhost:3000/cotacoes`) via Playwright + Engine de Servidor Node.js

---

## 1. Resumo Executivo e Status do Robô da Construjá

- **Status do Robô da Construjá:** **IMPLEMENTADO NO BANCO, PORÉM BLOQUEADO NO CARREGADOR DE CONFIGURAÇÃO DE BACKEND.**
- **Evidência Definitiva:** O robô genérico Playwright (`core/services/supplier-quote-engine`) é capaz de cotar a Construjá, e os seletores testados da Construjá estão cadastrados no campo `seletores` (JSONB) da tabela `fornecedores` no Supabase.
- **Por que falhava na SaraCota:** Quando o backend dispara `processarCotacaoFornecedor` para a Construjá, a função `carregarConfigFornecedor` busca um arquivo físico em disco (`core/services/supplier-quote-engine/configs/construja.json`). Como esse arquivo local não existia (pois os seletores estavam apenas no Supabase), a função retornava `null`. Em seguida, a linha 206 do `matchingEngine.ts` aplicava um fallback forçado chamando `require('.../configs/cicalfer.json')`. O sistema tentava então autenticar no site da Construjá usando os seletores de login e busca da **Cicalfer**, o que causava falha imediata de login/busca e gerava itens com status `NAO_ENCONTRADO` e valor `R$ 0,00`.

---

## 2. Linha do Tempo da Execução Real (Timestamps Brutos)

| Timestamp (UTC) | Passo do Teste | Ação / Evento Registrado | Evidência de Print / Log |
| :--- | :--- | :--- | :--- |
| `19:41:54.624Z` | Passo 1 | Navegação para `http://localhost:3000/cotacoes` com sessão de dev. | `execucao_detalhada.log` L4 |
| `19:41:58.357Z` | Seleção de Tela | Alternância para a sub-aba "Bloco de Notas". | `execucao_detalhada.log` L17 |
| `19:41:59.412Z` | Inserção Item 1 | Adicionado: `3x Caixa d'Água Fortlev 310L`. | `execucao_detalhada.log` L18 |
| `19:42:00.244Z` | Inserção Item 2 | Adicionado: `6x Ducha Lorenzetti Bella Ducha 127V`. | `execucao_detalhada.log` L20 |
| `19:42:01.067Z` | Disparo Modal | Clique em "Cotar com Fornecedores". | `execucao_detalhada.log` L22 |
| `19:42:02.475Z` | Seleção Exclusiva | Desmarcados outros lojistas e marcado **APENAS Construjá**. | `00_modal_apenas_construja.png` |
| `19:42:03.083Z` | Confirmação | Clique no botão `Cotar (1)` no modal. | `01_apos_clicar_cotar.png` |
| `19:42:03.368Z` | Requisição API | `POST /api/cotacoes/[id]/processar` enviado para a Construjá (`a1684c4d-d896-4ba9-a591-cda455c5ffe2`). | `execucao_detalhada.log` L33 |
| `19:42:03.590Z` | Resposta Server | HTTP 200: `status: "processamento iniciado"`. | `execucao_detalhada.log` L37 |
| `19:42:06.619Z` | Polling Backend | Server inicia robô: `"[Construjá] 🚀 Iniciando Motor Central de Cotação RPA..."`. | `execucao_detalhada.log` L41 |
| `19:42:18.617Z` | Execução Robô | Server loga: `"[Construjá] 🔍 Cotando e ajustando quantidade em lote..."`. | `execucao_detalhada.log` L54 |
| `19:42:29.771Z` | Resultado Final | Finalização da cotação e renderização do card da Construjá na SaraCota. | `04_resultado_final.png` |

---

## 3. Prova Concreta da Causa Raíz (Logs do Servidor + Consulta ao Banco)

### Evidência 1: Leitura dos Resultados Gravados no Banco de Dados
Ao consultar a tabela `matching_resultados` gerada durante este teste para a cotação da Construjá:
```json
[
  {
    "itemPedido": "6x Ducha Lorenzetti Bella Ducha 127V",
    "status": "NAO_ENCONTRADO",
    "confianca": 95,
    "produtoEncontrado": "6x Ducha Lorenzetti Bella Ducha 127V",
    "preco": 0,
    "quantidade": 1,
    "fornecedorId": "a1684c4d-d896-4ba9-a591-cda455c5ffe2",
    "fornecedorNome": "Cicalfer Material Elétrico"
  }
]
```
Note que `fornecedorId` era o ID da Construjá (`a1684c4d...`), porém `fornecedorNome` foi gravado como `"Cicalfer Material Elétrico"`. Isso comprova que o robô da Construjá utilizou o config da Cicalfer por engano!

### Evidência 2: Trecho de Código do Injetor de Configuração em `lib/services/automacao/matchingEngine.ts`
Em [`lib/services/automacao/matchingEngine.ts`](file:///c:/Users/User/Desktop/Saracota/lib/services/automacao/matchingEngine.ts#L181-L207):
```typescript
// 1. carregarConfigFornecedor só busca arquivos locais .json
for (const slug of candidateSlugs) {
  const p1 = path.join(process.cwd(), 'core', 'services', 'supplier-quote-engine', 'configs', `${slug}.json`);
  if (fs.existsSync(p1)) {
    try { return require(p1); } catch (e) {}
  }
}
// 2. Como construja.json não existe em disco, retorna null
const supplierConfig = carregarConfigFornecedor(fornecedorId, fornecedorNome, configSlug);

// 3. Linha 206: Como supplierConfig é null, o fallback FORÇA cicalfer.json!
const activeConfig = supplierConfig || require('../../../core/services/supplier-quote-engine/configs/cicalfer.json');
```

---

## 4. Estrutura de Prints e Logs Gerados no Teste

Todos os arquivos de prova estão salvos na pasta [`historicos/2026-09-15/teste11_saracota_construja/`](file:///c:/Users/User/Desktop/Saracota/historicos/2026-09-15/teste11_saracota_construja/):

- **[`prints/00_modal_apenas_construja.png`](file:///c:/Users/User/Desktop/Saracota/historicos/2026-09-15/teste11_saracota_construja/prints/00_modal_apenas_construja.png):** Modal de seleção com apenas o checkbox da Construjá selecionado.
- **[`prints/01_apos_clicar_cotar.png`](file:///c:/Users/User/Desktop/Saracota/historicos/2026-09-15/teste11_saracota_construja/prints/01_apos_clicar_cotar.png):** Tela no instante exato do clique em "Cotar (1)".
- **[`prints/02_redirecionamento_ou_progresso.png`](file:///c:/Users/User/Desktop/Saracota/historicos/2026-09-15/teste11_saracota_construja/prints/02_redirecionamento_ou_progresso.png):** Transição de tela 2s após o clique.
- **[`prints/03_progresso_intermediario.png`](file:///c:/Users/User/Desktop/Saracota/historicos/2026-09-15/teste11_saracota_construja/prints/03_progresso_intermediario.png):** Estado do modal de progresso em tempo real enquanto o backend tentava executar.
- **[`prints/04_resultado_final.png`](file:///c:/Users/User/Desktop/Saracota/historicos/2026-09-15/teste11_saracota_construja/prints/04_resultado_final.png):** Card final exibido no SaraCota para a Construjá.
- **[`execucao_detalhada.log`](file:///c:/Users/User/Desktop/Saracota/historicos/2026-09-15/teste11_saracota_construja/execucao_detalhada.log):** Log de rede HTTP (POST e GET polling) e console do navegador.
- **[`diagnostico_duplicacao.log`](file:///c:/Users/User/Desktop/Saracota/historicos/2026-09-15/teste11_saracota_construja/diagnostico_duplicacao.log):** Extração bruta do DOM dos cards renderizados.
- **[`resultado_saracota.json`](file:///c:/Users/User/Desktop/Saracota/historicos/2026-09-15/teste11_saracota_construja/resultado_saracota.json):** Snapshot estruturado dos cards retornados.

---

## 5. Recomendação Técnica de Correção

Para que a Construjá (e qualquer fornecedor futuro cadastrado via banco) execute 100% com seus seletores reais sem depender de hardcode:

1. **Construção Dinâmica de `activeConfig` a partir do Banco:**  
   Em [`lib/services/automacao/matchingEngine.ts`](file:///c:/Users/User/Desktop/Saracota/lib/services/automacao/matchingEngine.ts#L205-L208), ajustar a inicialização do `activeConfig`:
   ```typescript
   // Se não houver arquivo .json local, montar o objeto de configuração dinamicamente usando fornDbRecord.seletores do Supabase
   const activeConfig = supplierConfig || (fornDbRecord?.seletores ? {
     id: fornecedorId,
     name: fornecedorNome,
     slug: configSlug || 'construja',
     baseUrl: fornDbRecord.urlPortalB2B || 'https://www.construja.com.br/produtos',
     loginUrl: fornDbRecord.urlPortalB2B || 'https://www.construja.com.br/produtos',
     cartUrl: 'https://www.construja.com.br/carrinho',
     selectors: fornDbRecord.seletores,
   } : null);
   ```
2. **Criar o arquivo local `construja.json` (Opcional/Segurança):**  
   Criar o arquivo `core/services/supplier-quote-engine/configs/construja.json` contendo os seletores oficiais da Construjá para garantir retrocompatibilidade com o carregador de arquivos locais.
