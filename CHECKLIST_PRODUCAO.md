# Checklist de Produção & Guia de Deploy — Sara Cota SaaS

Este documento reúne todas as verificações essenciais, otimizações de performance e instruções para publicação em produção da plataforma **Sara Cota SaaS**.

---

## ✅ 1. Suíte de Testes Unitários

Antes de cada deploy, execute a suíte de testes unitários para validar os motores de decisão:

```bash
# Executar testes unitários do motor tributário e matching
npx ts-node scripts/test-runner.ts
```

### Testes Incluídos:
- [x] **Motor ICMS-ST ([`tests/tax.test.ts`](file:///c:/Users/User/Desktop/Saracota/tests/tax.test.ts)):**
  - Apuração MVA Interestadual SP → SP e SP → MG.
  - Validação de isenção tributária para cimento e venda direta de indústria.
  - Alerta de `impostoEstimado: true` para NCMs variáveis ou não catalogadas.
- [x] **Motor de Matching Técnico ([`tests/matching.test.ts`](file:///c:/Users/User/Desktop/Saracota/tests/matching.test.ts)):**
  - Distância de Levenshtein e algoritmo de similaridade fuzzy (0-100%).
  - Matching por atributos estritos (Bitola `2.5mm²`, Tensão `750V`, Diâmetro `100mm`).
  - Conversão de unidades industriais (ex: 5 Rolos de 100m = 500m).

---

## ⚡ 2. Otimizações de Performance Aplicadas

- [x] **Memoização de Cálculos Pesados:** Utilização de `useMemo` na apuração da Matriz Comparativa e nos resultados de matching em [`QuotesView.tsx`](file:///c:/Users/User/Desktop/Saracota/components/features/QuotesView.tsx) e [`ProductsView.tsx`](file:///c:/Users/User/Desktop/Saracota/components/features/ProductsView.tsx).
- [x] **Otimização do Next.js ([`next.config.js`](file:///c:/Users/User/Desktop/Saracota/next.config.js)):**
  - Minificação SWC nativa ativa.
  - Remoção automática de `console.log` em builds de produção.
  - Suporte a imagens em formatos modernos `AVIF` e `WebP`.
  - Headers HTTP de segurança (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).

---

## 🔒 3. Variáveis de Ambiente & Segurança

Garanta que as seguintes variáveis estejam configuradas no painel do provedor (ex: Vercel Project Settings -> Environment Variables):

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública anônima do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta de serviço (apenas server-side) |
| `WHATSAPP_API_TOKEN` | Token do provedor da API do WhatsApp |
| `NEXT_PUBLIC_APP_URL` | URL oficial do app (`https://saracota.com.br`) |

---

## 🗄️ 4. Execução de Migrations no Banco de Dados

1. Acesse o SQL Editor no painel do Supabase / Postgres.
2. Execute o conteúdo do arquivo [`lib/db/schema.sql`](file:///c:/Users/User/Desktop/Saracota/lib/db/schema.sql) para criar as 8 tabelas oficiais e índices.

---

## 🚀 5. Passos para Deploy na Vercel

```bash
# 1. Instalar Vercel CLI (opcional)
npm i -g vercel

# 2. Conectar e publicar em produção
vercel --prod
```

### Configuração Automática ([`vercel.json`](file:///c:/Users/User/Desktop/Saracota/vercel.json)):
- **Framework:** Next.js
- **Região do Servidor:** `gru1` (São Paulo, Brasil) para menor latência em chamadas de lojistas e compradores locais.
