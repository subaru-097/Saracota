# Diagnóstico Detalhado da Inserção na Tabela "cotacoes" (Supabase)

**Data/Hora do Diagnóstico:** 14/09/2026 às 15h19  
**Pasta de Evidências:** `docs/historico/Diagnostico Insercao Cotacoes Supabase - 14-09_15h19/`  
**Escopo:** Diagnóstico técnico ponta a ponta sobre onde e por que a inserção na tabela `cotacoes` falha no Supabase. **NENHUMA CORREÇÃO FOI APLICADA**, atendendo estritamente às instruções.

---

## 1. ONDE esse backend roda?
* **Resposta Técnica:** O backend da aplicação Saracota roda em um servidor local **Node.js através das API Routes do Next.js App Router** (`app/api/cotacoes/route.ts` e `app/api/cotacoes/[cotacaoId]/processar/route.ts`).
* **Fluxo de Execução:**
  1. A interface web envia uma requisição `POST /api/cotacoes/[cotacaoId]/processar`.
  2. O servidor Next.js em Node.js intercepta a chamada na API Route `route.ts`.
  3. O Node.js invoca a função `db.cotacoes.create()` do arquivo `lib/db/client.ts` dentro do próprio processo servidor do Node.js.

---

## 2. Qual client do Supabase está sendo usado na inserção — ANON KEY ou SERVICE_ROLE KEY?
* **Resposta Técnica:** O client do Supabase usado na inserção é inicializado **exclusivamente com a ANON KEY** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). A `SERVICE_ROLE_KEY` **NÃO É UTILIZADA**.
* **Código de Inicialização (`lib/db/client.ts`, linhas 8-22):**
```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { API_CONFIG } from '@/lib/config/api';

const SUPABASE_URL = API_CONFIG.supabaseUrl;
const SUPABASE_ANON_KEY = API_CONFIG.supabaseAnonKey;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
```
* **Leitura da Variável (`lib/config/api.ts`, linhas 30-34):**
```typescript
supabaseUrl:
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',

supabaseAnonKey:
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '',
```

---

## 3. Código EXATO (linha por linha) da função que faz o insert na tabela "cotacoes"
* **Arquivo:** `lib/db/client.ts` (método `create`)
```typescript
    async create(payload: {
      valor_total?: number;
      status?: any;
      fornecedor_id?: string;
      itens?: DBRecordItemCotacao[];
      origem?: string;
      origemTextoOriginal?: string;
      categoriaPrincipal?: string;
      valorTotalProdutos?: number;
      valorTotalST?: number;
      valorTotalGeral?: number;
      economiaEstimadaBRL?: number;
      [key: string]: any;
    }): Promise<Cotacao> {
      if (!(globalThis as any).__saracota_quotes_store) {
        (globalThis as any).__saracota_quotes_store = {};
      }

      // Invalidar cotações anteriores do mesmo usuário ao criar uma nova
      await this.invalidarCotacoesAnteriores();

      const createdId = payload.id || `cot-${Date.now()}`;
      const valTotal = payload.valor_total || payload.valorTotalGeral || 0;

      const formattedItens = (payload.itens || []).map((it: any, idx: number) => ({
        id: it.id || `it-${idx}-${Date.now()}`,
        cotacao_id: createdId,
        material: typeof it === 'string' ? it : (it.material || it.texto || 'Material'),
        quantidade: Number(it.quantidade) || 1,
        unidade: it.unidade || 'un',
        preco_unitario: Number(it.preco_unitario) || 0,
        categoria: it.categoria || 'eletrica',
      }));

      const cotacaoRecordLocal: Cotacao = {
        id: createdId,
        codigoCotacao: `#${createdId.substring(0, 4).toUpperCase()}`,
        projeto: {
          id: 'proj-1',
          clienteId: 'cli-1',
          nomeObra: payload.obraNome || 'Reserva das Palmeiras',
          ufDestino: 'SP',
        },
        status: 'em_analise',
        origem: (payload.origem as any) || 'texto',
        origemTextoOriginal: payload.origemTextoOriginal,
        categoriaPrincipal: (payload.categoriaPrincipal as any) || 'eletrica',
        dataCriacao: new Date().toLocaleDateString('pt-BR'),
        itens: formattedItens as any,
        fornecedoresParticipantesCount: payload.fornecedorIds?.length || 1,
        fornecedor_id: payload.fornecedor_id || payload.fornecedorIds?.[0],
        fornecedorIds: payload.fornecedorIds || (payload.fornecedor_id ? [payload.fornecedor_id] : ['33e03495-100d-45a3-9e34-899de56b0ab1']),
        valorTotalProdutos: payload.valorTotalProdutos || valTotal * 0.9,
        valorTotalST: payload.valorTotalST || valTotal * 0.1,
        valorTotalGeral: valTotal,
        economiaEstimadaBRL: payload.economiaEstimadaBRL || valTotal * 0.12,
        melhorFornecedorNome: 'Lojista Credenciado',
      } as any;

      (globalThis as any).__saracota_quotes_store[createdId] = cotacaoRecordLocal;

      if (supabase) {
        try {
          const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
          const cotacaoRecordDb: any = {
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
            console.warn('[DB WARNING] Inserção de cotação no Supabase falhou (usando armazenamento em memória local):', cotErr.message);
          } else if (cotData) {
            cotacaoRecordLocal.id = cotData.id;
            (globalThis as any).__saracota_quotes_store[cotData.id] = cotacaoRecordLocal;

            if (formattedItens.length > 0) {
              const itensRecords = formattedItens.map((it) => ({
                cotacao_id: cotData.id,
                material: it.material,
                quantidade: it.quantidade,
                unidade: it.unidade,
                preco_unitario: it.preco_unitario,
                categoria: it.categoria || 'eletrica',
              }));

              await (supabase.from('itens_cotacao').insert(itensRecords) as any).catch((e: any) => {
                console.warn('[DB WARNING] Inserção de itens no Supabase falhou:', e.message);
              });
            }
          }
        } catch (e: any) {
          console.warn('[DB WARNING] Exceção ao gravar cotação no Supabase:', e.message);
        }
      }

      return cotacaoRecordLocal;
    }
```

---

## 4. Teste de Insert Real e Log de Erro COMPLETO

Executamos um teste de inserção real direto no Supabase.

### Erro Real Retornado pelo Supabase (com o payload usado hoje na função `create`):
```json
{
  "code": "23502",
  "details": null,
  "hint": null,
  "message": "null value in column \"user_id\" of relation \"cotacoes\" violates not-null constraint"
}
```

### Análise Encadeada dos Erros do Schema da Tabela `cotacoes`:
1. **Falta de `user_id`:** O objeto enviado pela aplicação (`{ status: 'pendente', valor_total: 100 }`) omite `user_id`, violando a restrição `NOT NULL` do PostgreSQL.
2. **Falta de `fornecedores_selecionados`:** Ao preencher `user_id`, a tabela exige a coluna `fornecedores_selecionados` (restrição `NOT NULL`).
3. **Falta de `itens`:** A tabela exige a coluna `itens` (restrição `NOT NULL`).
4. **Foreign Key `cotacoes_user_id_fkey`:** Se for passado um UUID fictício para `user_id`, o PostgreSQL rejeita com código `23503` (`insert or update on table "cotacoes" violates foreign key constraint "cotacoes_user_id_fkey"`).

---

## 5. Confirmação de try/catch "engolindo" o erro silenciosamente

**SIM, CONFIRMADO.** Existe um bloco try/catch com `console.warn` que impede o erro de subir até a interface ou interromper a execução:

* **Trecho do Código (`lib/db/client.ts`, linhas 309-332):**
```typescript
if (cotErr) {
  console.warn('[DB WARNING] Inserção de cotação no Supabase falhou (usando armazenamento em memória local):', cotErr.message);
} else if (cotData) {
  // ...
}
} catch (e: any) {
  console.warn('[DB WARNING] Exceção ao gravar cotação no Supabase:', e.message);
}
return cotacaoRecordLocal;
```
* **Impacto:** O erro do Supabase é logado como um mero aviso (`console.warn`) no terminal do servidor, o código faz fallback para a memória RAM local (`globalThis.__saracota_quotes_store`) e a função retorna como se a inserção tivesse tido sucesso total. Por isso, a API Route responde `200 OK` / `201 Created` para o frontend e o erro fica oculto.

---

## 6. Onde estão definidas as variáveis de ambiente e verificação da SERVICE_ROLE KEY

* **Leitura dos Arquivos `.env.local` e `.env`:**
  - `.env.local`:
    - `NEXT_PUBLIC_SUPABASE_URL=https://ulvsfwgrhgfvpghmfvnx.supabase.co`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_RiqXdAtpR7-aKNhbbSQ5Fg_W8KNim4v`
  - `.env`:
    - `SUPABASE_URL=https://ulvsfwgrhgfvpghmfvnx.supabase.co`
    - `SUPABASE_ANON_KEY=sb_publishable_RiqXdAtpR7-aKNhbbSQ5Fg_W8KNim4v`

* **Verificação da `SUPABASE_SERVICE_ROLE_KEY`:**
  - **NÃO EXISTE.** A chave `SUPABASE_SERVICE_ROLE_KEY` **não está configurada** em nenhum arquivo de variáveis de ambiente do projeto.
  - **Consequência Directa:** O backend não possui a chave administrativa de serviço que ignora RLS. Qualquer escrita tenta ser feita via `ANON_KEY`.

---

## 7. Matriz Resumo das Evidências

| Item Pergunta | Diagnóstico Constatado | Evidência Técnica |
| :--- | :--- | :--- |
| **1. Backend** | Node.js local / Next.js Serverless API Route | `app/api/cotacoes/[cotacaoId]/processar/route.ts` |
| **2. Key do Supabase** | Apenas `ANON KEY` pública usada | `lib/db/client.ts` linha 21 (`createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`) |
| **3. Função Create** | Função `create()` constrói objeto sem `user_id` e sem colunas obrigatórias | `lib/db/client.ts` linha 294 (`const cotacaoRecordDb = { status, valor_total }`) |
| **4. Log de Erro Real** | Erro 23502 (`null value in column "user_id"...`) | Retorno bruto do PostgreSQL/Supabase salvo em `03-logs-erro-insert-real.txt` |
| **5. Try/Catch Silencioso** | Sim. `cotErr` gera apenas `console.warn` e retorna registro local da RAM | `lib/db/client.ts` linha 310 (`console.warn('[DB WARNING] ...')`) |
| **6. Service Role Key** | `SUPABASE_SERVICE_ROLE_KEY` Ausente (`undefined`) | `.env` e `.env.local` inspecionados (apenas `ANON_KEY` existe) |
