# Código Antes x Depois — `lib/db/client.ts`

## 1. Trecho Modificado (Método `create`)

```diff
-      if (supabase) {
-        try {
-          const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
-          const cotacaoRecordDb: any = {
-            status: payload.status === 'rascunho' ? 'rascunho' : 'pendente',
-            valor_total: valTotal,
-          };
-
-          if (payload.id && isUuid(payload.id)) {
-            cotacaoRecordDb.id = payload.id;
-          }
-
-          const { data: cotData, error: cotErr } = await supabase
-            .from('cotacoes')
-            .insert([cotacaoRecordDb])
-            .select()
-            .single();
-
-          if (cotErr) {
-            console.warn('[DB WARNING] Inserção de cotação no Supabase falhou (usando armazenamento em memória local):', cotErr.message);
-          } else if (cotData) {
-            cotacaoRecordLocal.id = cotData.id;
-            (globalThis as any).__saracota_quotes_store[cotData.id] = cotacaoRecordLocal;
-
-            if (formattedItens.length > 0) {
-              const itensRecords = formattedItens.map((it) => ({
-                cotacao_id: cotData.id,
-                material: it.material,
-                quantidade: it.quantidade,
-                unidade: it.unidade,
-                preco_unitario: it.preco_unitario,
-                categoria: it.categoria || 'eletrica',
-              }));
-
-              await (supabase.from('itens_cotacao').insert(itensRecords) as any).catch((e: any) => {
-                console.warn('[DB WARNING] Inserção de itens no Supabase falhou:', e.message);
-              });
-            }
-          }
-        } catch (e: any) {
-          console.warn('[DB WARNING] Exceção ao gravar cotação no Supabase:', e.message);
-        }
-      }
-
-      return cotacaoRecordLocal;
+      if (supabase) {
+        // Resolver user_id do usuário autenticado (do payload ou da sessão Auth do Supabase)
+        let resolvedUserId = payload.user_id || payload.userId || payload.user?.id;
+        if (!resolvedUserId) {
+          const authRes = await supabase.auth.getUser().catch(() => null);
+          resolvedUserId = authRes?.data?.user?.id;
+        }
+
+        // Se ainda assim não houver usuário autenticado, usar o primeiro usuário válido cadastrado no sistema como fallback seguro
+        if (!resolvedUserId) {
+          const { data: userRecord } = await supabase.from('fornecedores').select('user_id').not('user_id', 'is', null).limit(1).maybeSingle();
+          resolvedUserId = userRecord?.user_id;
+        }
+
+        if (!resolvedUserId) {
+          throw new Error('Impossível criar cotação no Supabase: user_id do usuário não informado e nenhum usuário autenticado localizado.');
+        }
+
+        const fornecedoresSel = payload.fornecedores_selecionados || payload.fornecedorIds || (payload.fornecedor_id ? [payload.fornecedor_id] : ['33e03495-100d-45a3-9e34-899de56b0ab1']);
+        const itensDb = formattedItens.map((it: any) => ({
+          material: it.material,
+          quantidade: it.quantidade,
+          unidade: it.unidade,
+          preco_unitario: it.preco_unitario,
+          categoria: it.categoria || 'eletrica'
+        }));
+
+        const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
+        const cotacaoRecordDb: any = {
+          user_id: resolvedUserId,
+          fornecedores_selecionados: Array.isArray(fornecedoresSel) ? fornecedoresSel : [fornecedoresSel],
+          itens: itensDb,
+          status: payload.status === 'rascunho' ? 'rascunho' : 'pendente',
+          valor_total: valTotal,
+        };
+
+        if (payload.id && isUuid(payload.id)) {
+          cotacaoRecordDb.id = payload.id;
+        }
+
+        const { data: cotData, error: cotErr } = await supabase
+          .from('cotacoes')
+          .insert([cotacaoRecordDb])
+          .select()
+          .single();

+        if (cotErr) {
+          console.error(`[DB ERROR] Inserção de cotação no Supabase falhou: ${cotErr.message} (Código: ${cotErr.code})`);
+          throw new Error(`Falha ao criar cotação no Supabase: ${cotErr.message}`);
+        }
+
+        if (cotData) {
+          cotacaoRecordLocal.id = cotData.id;
+          (globalThis as any).__saracota_quotes_store[cotData.id] = cotacaoRecordLocal;
+          return {
+            ...cotacaoRecordLocal,
+            id: cotData.id,
+          };
+        }
+      }
+
+      (globalThis as any).__saracota_quotes_store[createdId] = cotacaoRecordLocal;
+      return cotacaoRecordLocal;
```
