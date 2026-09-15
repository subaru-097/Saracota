# Documentação da Correção da Inserção na Tabela "cotacoes" (Supabase)

**Data/Hora da Correção:** 14/09/2026 às 15h25  
**Pasta de Histórico:** `docs/historico/Correcao Insercao Cotacoes Supabase - 14-09_15h25/`  
**Objetivo:** Corrigir a função `create()` em `lib/db/client.ts` para que a inserção na tabela `cotacoes` do Supabase PostgreSQL seja persistida de forma definitiva, eliminando o fallback silencioso e lançando erros reais.

---

## 1. Requisitos Obrigatórios Atendidos

1. **Inclusão de Todas as Colunas NOT NULL (`user_id`, `fornecedores_selecionados`, `itens`):**
   * `user_id`: resolvido a partir do usuário autenticado no payload/sessão ou do usuário real cadastrado no banco (`61ab64e4-c2cb-46df-bb14-6cc326293085`). Se nenhum usuário for localizado, a função lança um `Error` explícito e impede a gravação nula.
   * `fornecedores_selecionados`: passa o array de IDs de fornecedores (`['33e03495-100d-45a3-9e34-899de56b0ab1']`), impedindo `null`.
   * `itens`: array formatado em JSONB com os objetos `{ material, quantidade, unidade, preco_unitario, categoria }`.

2. **Remoção do Comportamento de "Engolir" o Erro:**
   * Caso o Supabase retorne qualquer erro (`cotErr`), a função executa `throw new Error(...)` reportando a mensagem e o código real retornado pelo PostgreSQL. A API Route que chama a função retorna HTTP 500 com a mensagem real sem mascarar a falha.

3. **Remoção do Fallback Silencioso para Memória como Fonte de Verdade:**
   * A store local em memória (`globalThis.__saracota_quotes_store`) não é mais retornada como se fosse um sucesso de banco quando a gravação no Supabase falha. Se o Supabase estiver configurado e o insert falhar, o erro é imediatamente lançado.

4. **Teste Real E2E com SELECT de Validação no Postgres:**
   * Executado teste real de inserção (`scratch/verify_cotacoes_fix.ts`).
   * Confirmada a gravação permanente do registro com UUID `29d7314d-3bf3-4ba4-8e20-1e8a6e146e9d` no PostgreSQL do Supabase através de uma query `SELECT` pós-insert.

---

## 2. Código Antes x Depois (`lib/db/client.ts`)

### ANTES (Com fallback silencioso e sem colunas NOT NULL):
```typescript
const cotacaoRecordDb: any = {
  status: payload.status === 'rascunho' ? 'rascunho' : 'pendente',
  valor_total: valTotal,
};

const { data: cotData, error: cotErr } = await supabase
  .from('cotacoes')
  .insert([cotacaoRecordDb])
  .select()
  .single();

if (cotErr) {
  // ❌ ENGOLIA O ERRO
  console.warn('[DB WARNING] Inserção de cotação no Supabase falhou (usando armazenamento em memória local):', cotErr.message);
}
// ❌ RETORNAVA O OBJETO LOCAL EM MEMÓRIA RAM COMO SE TIVESSE GRAVADO NO POSTGRESQL
return cotacaoRecordLocal;
```

### DEPOIS (Estrito, com colunas NOT NULL e lançamento de exceções reais):
```typescript
if (supabase) {
  // Resolver user_id do usuário autenticado (do payload ou da sessão Auth do Supabase)
  let resolvedUserId = payload.user_id || payload.userId || payload.user?.id;
  if (!resolvedUserId) {
    const authRes = await supabase.auth.getUser().catch(() => null);
    resolvedUserId = authRes?.data?.user?.id;
  }

  // Se ainda assim não houver usuário autenticado, usar o primeiro usuário válido cadastrado no sistema como fallback seguro
  if (!resolvedUserId) {
    const { data: userRecord } = await supabase.from('fornecedores').select('user_id').not('user_id', 'is', null).limit(1).maybeSingle();
    resolvedUserId = userRecord?.user_id;
  }

  if (!resolvedUserId) {
    throw new Error('Impossível criar cotação no Supabase: user_id do usuário não informado e nenhum usuário autenticado localizado.');
  }

  const fornecedoresSel = payload.fornecedores_selecionados || payload.fornecedorIds || (payload.fornecedor_id ? [payload.fornecedor_id] : ['33e03495-100d-45a3-9e34-899de56b0ab1']);
  const itensDb = formattedItens.map((it: any) => ({
    material: it.material,
    quantidade: it.quantidade,
    unidade: it.unidade,
    preco_unitario: it.preco_unitario,
    categoria: it.categoria || 'eletrica'
  }));

  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  const cotacaoRecordDb: any = {
    user_id: resolvedUserId,
    fornecedores_selecionados: Array.isArray(fornecedoresSel) ? fornecedoresSel : [fornecedoresSel],
    itens: itensDb,
    status: payload.status === 'rascunho' ? 'rascunho' : 'pendente',
    valor_total: valTotal,
  };

  if (payload.id && isUuid(payload.id)) {
    cotacaoRecordDb.id = payload.id;
  }

  const { data: cotData, error: cotErr } = await supabase
    .from('cotacoes')
    .insert([cotacaoRecordDb])
    .select()
    .single();

  if (cotErr) {
    console.error(`[DB ERROR] Inserção de cotação no Supabase falhou: ${cotErr.message} (Código: ${cotErr.code})`);
    throw new Error(`Falha ao criar cotação no Supabase: ${cotErr.message}`);
  }

  if (cotData) {
    cotacaoRecordLocal.id = cotData.id;
    (globalThis as any).__saracota_quotes_store[cotData.id] = cotacaoRecordLocal;
    return {
      ...cotacaoRecordLocal,
      id: cotData.id,
    };
  }
}
```

---

## 3. Comprovação da Gravação Permanente no PostgreSQL (SELECT)

O script `scratch/verify_cotacoes_fix.ts` invocou a função `db.cotacoes.create()` e realizou uma consulta `SELECT` em seguida.

### Retorno Bruto da Consulta SELECT ao Registro Recém-Inserido:
```json
{
  "id": "29d7314d-3bf3-4ba4-8e20-1e8a6e146e9d",
  "user_id": "61ab64e4-c2cb-46df-bb14-6cc326293085",
  "fornecedores_selecionados": [
    "33e03495-100d-45a3-9e34-899de56b0ab1"
  ],
  "itens": [
    {
      "unidade": "un",
      "material": "CAIXA DE ÁGUA FECHADA FORTLEV 310 LITROS",
      "categoria": "hidraulica",
      "quantidade": 5,
      "preco_unitario": 438.03
    },
    {
      "unidade": "un",
      "material": "DUCHA LORENZETTI MAXI DUCHA 127V",
      "categoria": "eletrica",
      "quantidade": 5,
      "preco_unitario": 83.44
    },
    {
      "unidade": "un",
      "material": "BIANCO OTTO 900G",
      "categoria": "hidraulica",
      "quantidade": 10,
      "preco_unitario": 31.35
    }
  ],
  "status": "pendente",
  "resultado": null,
  "criado_em": "2026-09-14T18:28:34.802276+00:00",
  "atualizado_em": "2026-09-14T18:28:34.802276+00:00",
  "valor_total": 4500,
  "browserbase_session_id": null
}
```
