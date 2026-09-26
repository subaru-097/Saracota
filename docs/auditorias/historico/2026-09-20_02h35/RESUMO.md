# 📋 Relatório de Auditoria e Diagnóstico de Causa Raiz: Cotação B2B Cofema (Sessão Pós-Correção com Zero Cache)

**Data/Hora da Auditoria**: 2026-09-20 02h35  
**Fornecedor**: Cofema Atacadista B2B (`752e18bd-4f41-414a-8f66-0d8f538de99e`)  
**Produto Alvo**: DUCHA LORENZETTI BELLA DUCHA 6800W 4T 220V BRANCA (SKU: `300500`)  
**Quantidade Solicitada**: 5 unidades  
**Total Geral Final Calculado**: **R$ 439,50** (5x R$ 87,90)  

---

## 🔍 1. Explicativa Direta da Divergência no Print Antigo vs Novo

1. **Por que o print antigo mostrava R$ 0,00?**
   - Na chamada `quoteEngine.adicionarItem` dentro do loop em `matchingEngine.ts`, o objeto `{ termo: nomeItem, quantidade: qtd }` era passado sem repassar os atributos do produto pedido (falhava a propriedade `skuFornecedor`).
   - Por não receber a SKU `300500`, a busca Cofema fazia uma pesquisa textual por `"DUCHA LORENZETTI BELLA"`, que trazia a ducha 127V em 1º lugar no portal Cofema.
   - O matcher rejeitava o modelo 127V devido à trava de voltagem (220V ≠ 127V). Sem SKU para buscar direto o 220V, a cotação retornava 0 itens adicionados e disparava a trava de erro de integridade com R$ 0,00.

2. **O que foi corrigido no código para a execução nova de R$ 439,50?**
   - **[`matchingEngine.ts`](file:///c:/Users/User/Desktop/Saracota/lib/services/automacao/matchingEngine.ts#L379)**: Atualizada a chamada para `{ ...itemAny, termo: nomeItem, quantidade: qtd }`, repassando a SKU `300500`.
   - **[`cofemaExtractor.js`](file:///c:/Users/User/Desktop/Saracota/core/services/supplier-quote-engine/cofemaExtractor.js#L140)**: Adicionado `itemObjContext.skuFornecedor` para ler o código direto do objeto de item do banco.
   - **Resultado**: O robô buscou direto por SKU `300500`, encontrou o produto 220V exato por R$ 87,90, ajustou a quantidade para 5 un. e concluiu a cotação com sucesso em **R$ 439,50**.

---

## 📸 2. Evidências Visuais da Execução Nova (Pós-Correção)

1. **Print 1 - Confirmação de Reset de Cache e Limpeza do Carrinho**:
   - [`01_carrinho_limpo_pre_cotacao.png`](file:///c:/Users/User/Desktop/Saracota/docs/auditorias/historico/2026-09-20_02h35/prints/01_carrinho_limpo_pre_cotacao.png)
   - **Validação**: Esvaziamento confirmado no portal antes da cotação com log timestamp `[2026-09-20T05:36:29.220Z] [CofemaExtractor] Carrinho B2B esvaziado com sucesso.`

2. **Print 2 - Preenchimento da Quantidade no Card**:
   - [`02_preenchimento_quantidade_card.png`](file:///c:/Users/User/Desktop/Saracota/docs/auditorias/historico/2026-09-20_02h35/prints/02_preenchimento_quantidade_card.png)
   - **Validação**: SKU `300500` localizado por R$ 87,90, com preenchimento exato de **5 unidades** (`qAjustada: 5`).

3. **Print 3 - Carrinho Real no Portal Cofema**:
   - [`03_carrinho_real_portal_cofema.png`](file:///c:/Users/User/Desktop/Saracota/docs/auditorias/historico/2026-09-20_02h35/prints/03_carrinho_real_portal_cofema.png)
   - **Validação**: Carrinho real contendo 5 unidades da Ducha Lorenzetti 220V.

4. **Print 4 - Modal de Resumo Nova Execução (CONCLUÍDA • R$ 439,50)**:
   - [`04_modal_resumo_frontend.png`](file:///c:/Users/User/Desktop/Saracota/docs/auditorias/historico/2026-09-20_02h35/prints/04_modal_resumo_frontend.png)
   - **Validação**: Modal exibe status **CONCLUÍDA**, Total Geral **R$ 439,50**, Itens Processados: 1, Status Item: CONFIRMADO.

---

## 📜 3. Código Completo de `salvarResultadosMatching` em `lib/db/client.ts`

```typescript
    async salvarResultadosMatching(
      cotacaoId: string,
      fornecedorId: string,
      resultados: any[]
    ): Promise<boolean> {
      // 0. Atualizar cache em memória de forma atômica/idempotente
      const resultadosComForn = resultados.map((r) => ({ ...r, fornecedorId }));
      if (!memoryMatchingStore[cotacaoId]) {
        memoryMatchingStore[cotacaoId] = [];
      }
      memoryMatchingStore[cotacaoId] = [
        ...memoryMatchingStore[cotacaoId].filter((r: any) => r.fornecedorId !== fornecedorId),
        ...resultadosComForn
      ];

      if (typeof window !== 'undefined') {
        try {
          const key = `saracota_matching_${cotacaoId}_${fornecedorId}`;
          localStorage.setItem(key, JSON.stringify(resultadosComForn));
        } catch (e) {
          console.warn('Erro ao salvar matching localmente:', e);
        }
      }

      if (supabase) {
        try {
          // 1. Limpeza atômica prévia por (cotacao_id, fornecedor_id) para garantir idempotência total no Supabase
          try {
            await supabase
              .from('cotacao_itens')
              .delete()
              .eq('cotacao_id', cotacaoId)
              .eq('fornecedor_id', fornecedorId);
          } catch (e) {}

          try {
            await supabase
              .from('itens_cotacao_fornecedor')
              .delete()
              .eq('cotacao_id', cotacaoId)
              .eq('fornecedor_id', fornecedorId);
          } catch (e) {}

          // 1. Persistir na tabela cotacao_itens (ou itens_cotacao)
          const itemRecords = resultados.map((r) => ({
            cotacao_id: cotacaoId,
            fornecedor_id: fornecedorId,
            nome: r.produtoEncontrado || r.itemPedido || 'Material',
            material: r.produtoEncontrado || r.itemPedido || 'Material',
            preco_unitario: Number(r.preco) || 0,
            quantidade: Number(r.quantidade) || 1,
            total_item: Number(r.preco) * Number(r.quantidade || 1),
            unidade: 'un',
            observacoes: JSON.stringify({
              itemPedido: r.itemPedido,
              produtoEncontrado: r.produtoEncontrado,
              confianca: r.confianca,
              status: r.status,
              link: r.link,
              preco_unitario: Number(r.preco) || 0,
              total_item: Number(r.preco) * Number(r.quantidade || 1)
            })
          }));

          try {
            const { error: errItens } = await supabase.from('cotacao_itens').insert(itemRecords);
            if (!errItens) {
              console.log(`✅ [SUPABASE MATCHING SUCCESS ATÔMICO] ${resultados.length} itens salvos na tabela "cotacao_itens"!`);
            }
          } catch (errItensEx) {}

          // 1b. Persistir também na tabela itens_cotacao_fornecedor se existir
          const itensFornRecords = resultados.map((r) => ({
            cotacao_id: cotacaoId,
            fornecedor_id: fornecedorId,
            material: r.itemPedido || r.material || 'Material',
            produto_encontrado: r.produtoEncontrado || r.itemPedido,
            preco_unitario: Number(r.preco) || 0,
            confianca_percent: Number(r.confianca) || 0,
            status_matching: r.status || 'CONFIRMADO',
            imagem: r.imagem || null,
            link: r.link || null,
          }));

          try {
            await supabase.from('itens_cotacao_fornecedor').insert(itensFornRecords);
          } catch (e) {}

          // 2. Persistir em cotacao_fornecedor_sessoes com JSON estruturado
          const totalGeralCalculado = resultados.reduce((acc, i) => acc + (Number(i.preco) * Number(i.quantidade || 1)), 0);
          const possuiFalhas = resultados.length === 0 || resultados.some((i) => i.status !== 'CONFIRMADO' || !i.preco || i.preco <= 0);
          const statusSessao = possuiFalhas ? 'erro_integridade' : 'carrinho_pronto';

          const sessionPayload = JSON.stringify({
            origem: 'RPA_MATCHING_ENGINE',
            totalGeral: possuiFalhas ? 0 : totalGeralCalculado,
            itens: resultados,
            status: statusSessao,
            dataCriacao: new Date().toISOString()
          });

          try {
            await supabase.from('cotacao_fornecedor_sessoes').upsert(
              {
                cotacao_id: cotacaoId,
                fornecedor_id: fornecedorId,
                browserbase_session_id: sessionPayload,
                status: statusSessao,
                updated_at: new Date().toISOString()
              },
              { onConflict: 'cotacao_id,fornecedor_id' }
            );
          } catch (errSess) {
            console.warn('[SUPABASE SESSAO WARN]:', errSess);
          }

          try {
            if (totalGeralCalculado > 0 && !possuiFalhas) {
              await supabase.from('cotacoes').update({ valor_total: totalGeralCalculado }).eq('id', cotacaoId);
            }
          } catch (e) {}

          return true;
        } catch (err) {
          console.error('[SUPABASE MATCHING ERROR]:', err);
          return false;
        }
      }

      return true;
    }
```

---

## 🧹 4. Confirmação do Reset de Cache com Timestamp

Log extraído de [`execucao_completa_raw.log`](file:///c:/Users/User/Desktop/Saracota/docs/auditorias/historico/2026-09-20_02h35/logs/execucao_completa_raw.log):

```log
[2026-09-20T05:36:04.235Z] === INICIANDO AUDITORIA AO VIVO E EM TEMPO REAL (PÓS-CORREÇÃO DE SKU): COFEMA B2B ===
[DB DAL] Transientes e caches em memória resetados com sucesso (resetMemoryStore).
[2026-09-20T05:36:04.236Z] 1. Memory store e caches resetados (Stateless Check).
...
[DB DAL] Transientes e caches em memória resetados com sucesso (resetMemoryStore).
[2026-09-20T05:37:29.163Z] 9. Reset final de transientes e caches executado com sucesso.
```
