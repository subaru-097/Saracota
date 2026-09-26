# 🔍 Relatório Técnico de Diagnóstico de Erros e Divergências — Cotação Cofema

- **Data do Diagnóstico**: 17/09/2026
- **Ambiente de Teste**: Portal B2B Cofema Atacadista (`https://www.cofema.com.br/`)
- **Sessão Autenticada**: CNPJ `43.313.798/0001-34` (Filial Sumaré / Usuário MARIA)
- **Histórico Auditado**: `historicos/2026-09-17/teste1_cofema_real/`
- **Documento de Origem**: Audit dos screenshots (`01` a `07`), `execucao_detalhada.log` e `payload_final_cofema.json`

---

## 1. 📌 Resumo Executivo das Inconsistências

Na execução do teste real de cotação para os 5 itens no portal Cofema, o fluxo automatizado concluiu o login, busca, adição de itens e navegação até o carrinho final. Contudo, uma auditoria detalhada revelou **três categorias principais de divergências graves**:

1. **Troca e Poluição de Produtos no Payload/Carrinho (Item 5 e Demais Itens)**:
   - O Item 5 (*CONDUITE CORR AM FORTLEV 25MM 50M*) foi buscado como `"CONDUITE 25MM"`. No entanto, no `payload_final_cofema.json`, ele foi gravado com o SKU `406043` (*ALICATE BOMBA DAGUA PERKON 12"*).
   - Praticamente todos os itens do `payload_final_cofema.json` tiveram seus nomes gravados como `"Preço unit."` e seus SKUs apontando para produtos do painel lateral do carrinho (como SKU `300497`, SKU `74179`, SKU `406043`), em vez dos produtos pesquisados na grade principal.

2. **Divergência de Embalagem / Múltiplos Mínimos de Venda (Unidade vs Caixa/Pack)**:
   - Produtos como *BIANCO 900G* (SKU `410409`), *MAXI DUCHA* (SKU `149853`) e *ALICATE BOMBA PERKON* (SKU `406042`) possuem embalagens fechadas com múltiplos mínimos (ex: caixa com 6 un, pack com 21 un).
   - O portal Cofema impõe a compra em caixas/packs fechados. A automação tentou solicitar unidades avulsas (ex: 4 un ou 7 un), mas o portal forçou o arredondamento/múltiplo da embalagem (ex: 6 un ou 21 un), gerando divergência entre a quantidade solicitada e a quantidade faturada.

3. **Acúmulo/Concatenação de Digitação nos Inputs de Quantidade**:
   - Para o Item 4 (*ALICATE BOMBA*), a automação tentou digitar `12`. Devido ao valor pré-existente no campo (`1`) e à falta de limpeza adequada do input no React/Next.js, o valor no input tornou-se `112`, resultando em um acréscimo gigante no valor total do carrinho (**R$ 3.806,88** apenas neste item).

---

## 2. 🕵️ Causa Raiz Detalhada (Análise de Código e DOM)

### 🚨 Causa Raiz 1: Seletor Não Escopado Poluído pelo Painel Lateral do Carrinho (Cart Drawer)
- **Localização no Código**: `scratch/test_cofema_real_final.js`, linhas 156 e 194.
- **Trecho Problemático**:
  ```javascript
  const cards = Array.from(document.querySelectorAll('div.grid > div, div[class*="grid"] > div, div.group.relative, div[class*="border"]'));
  ```
- **Mecanismo da Falha**:
  - No portal Cofema (desenvolvido em Next.js / Tailwind CSS / Radix UI), quando um item é adicionado ao carrinho, a gaveta lateral do carrinho (`fixed top-0 right-0 ... z-[99999]`) é aberta ou mantida no DOM.
  - As linhas da gaveta do carrinho usam a classe `div[class*="border"]` e contêm elementos com `SKU:` e `R$`.
  - Como o seletor `document.querySelectorAll` utilizava `div[class*="border"]` sem escopamento estrito (sem prefixar com `main` ou container de resultados da busca), a função `page.evaluate()` capturou o **primeiro elemento correspondente no DOM**, que pertencia à **gaveta do carrinho lateral**, e não à grade principal de resultados da busca.
  - Consequentemente, para o Item 5 (Conduíte), a automação leu os dados do *Alicate Perkon 12"* (`SKU 406043`) que estava visível na gaveta do carrinho, registrando-o incorretamente no payload JSON.

---

### 🚨 Causa Raiz 2: Falha no Matching Semântico e Falta de Validação de Marca / Atributos
- **Localização no Código**: `scratch/test_cofema_real_final.js`, linhas 157-180.
- **Mecanismo da Falha**:
  - Para o Item 5, a busca solicitou a marca **FORTLEV** (`CONDUITE CORR AM FORTLEV 25MM 50M`).
  - No catálogo da Cofema para a filial Sumaré, os conduítes 25mm 50m disponíveis eram das marcas **TIGRE** (`SKU 74179` e `SKU 415494`) e **ADTEX** (`SKU 121991`). A marca Fortlev não existia no catálogo para essa especificação.
  - A automação atual não implementa cálculo de score de similaridade semântica (Jaccard/Levenshtein/Dice coefficient) para validar se o produto retornado possui a mesma marca/especificação antes de adicionar ao carrinho. O script aceitou o 1º resultado da busca sem alertar sobre a divergência de marca (Fortlev ➔ Tigre).

---

### 🚨 Causa Raiz 3: Incompatibilidade de Unidade de Venda (Unidade vs Caixa/Pack Múltiplo)
- **Localização no Código**: `scratch/test_cofema_real_final.js`, linhas 187-191.
- **Mecanismo da Falha**:
  - No portal Cofema B2B, a precificação exibe:
    - O valor unitário com desconto da campanha (ex: `R$ 74,72` por unidade).
    - O múltiplo de venda da embalagem (ex: `Abre 6 un.`, `Abre 21 un.`, `Não Abre 1 un.`).
    - O valor total da embalagem / pedido mínimo.
  - A extração por Expressão Regular `priceStr.replace(...).match(/[\d\.]+/)` capturou o primeiro valor numérico da linha de preço. Em cartões com descontos de campanha (#8213 15% Off), existiam múltiplos valores na mesma linha (`R$ 74,72`, `R$ 87,90`, `R$ 1.758,00 / R$ 0,00`).
  - O script capturou em alguns momentos o preço total do lote/pack (ex: `R$ 1.499,25` para o fardo de conduíte) e o multiplicou novamente pela quantidade pedida no script (`8995.50`), gerando uma supervalorização artificial da cotação.

---

### 🚨 Causa Raiz 4: Concatenação Indevida nos Inputs de Quantidade (React Controlled Inputs)
- **Localização no Código**: `scratch/test_cofema_real_final.js`, linhas 195-199.
- **Trecho Problemático**:
  ```javascript
  await qtyInput.fill('');
  await qtyInput.type(String(item.quantidade));
  ```
- **Mecanismo da Falha**:
  - Os inputs numéricos do portal Cofema utilizam componentes controlados do React (`onChange` / `value`).
  - O método `.fill('')` não dispara o evento `change` do React de forma completa para resetar o estado do componente. Quando `.type('12')` foi executado com o valor padrão `1` no campo, a digitação concatenou os caracteres, resultando no valor `112`.
  - Isso fez com que o Item 4 tivesse 112 unidades adicionadas ao carrinho (totalizando R$ 3.806,88).

---

## 3. 📊 Tabela Comparativa Detalhada: Item a Item

| # | Item Solicitado | Termo de Busca | Item Encontrado no Portal | SKU Real | Qtd Pedida | Qtd no Carrinho Real | Preço Unit. Real | Preço no Payload JSON | Total Efetivo Carrinho | Causa Provável da Divergência |
|---|---|---|---|---|---|---|---|---|---|---|
| **1** | `6x DUCHA LORENZETTI BELLA DUCHA 127V` | `BELLA DUCHA 127V` | DUCHA LORENZ.BELLA DUCHA 5500W 4T 127V BR | `300497` | 6 un. | 22 un. | R$ 74,72 | R$ 1.499,25 | R$ 1.643,84 | 1) Busca retornou Resistência (`401301`) e Ducha (`300497`);<br>2) Input concatenou para 22 un.;<br>3) Payload leu SKU `74179` da gaveta do carrinho. |
| **2** | `4x BIANCO 900G` | `BIANCO 900G` | OTTO B. BIANCO 900G SACHE | `410409` | 4 un. | 6 un. *(cx)* | R$ 57,32 *(R$ 343,91 cx)* | R$ 74,72 | R$ 343,91 | 1) Cofema vende em caixa fechada com 6 un. (múltiplo mínimo);<br>2) Sistema converteu 4 un. para 1 caixa de 6 un.;<br>3) Payload gravou SKU `300497` da gaveta do carrinho. |
| **3** | `7x DUCHA LORENZETTI MAXI DUCHA 127V` | `MAXI DUCHA 127V` | DUCHA LORENZ.MAXI-DUCHA 3T 127V 5500W | `149853` | 7 un. | 21 un. *(pack)* | R$ 60,48 *(R$ 1.270,16 pack)* | R$ 74,72 | R$ 1.270,16 | 1) Venda exclusiva em pack fechado de 21 un.;<br>2) Portal ajustou a quantidade para o múltiplo de 21 un.;<br>3) Payload gravou SKU incorreto `300497` da gaveta do carrinho. |
| **4** | `12x ALICATE BOMBA D AGUA MTX 10` | `ALICATE BOMBA` | ALICATE BOMBA DAGUA PERKON 10" 1013 | `406042` | 12 un. | 112 un. | R$ 33,99 | R$ 74,72 | R$ 3.806,88 | 1) Marca MTX indisponível no catálogo (substituída por Perkon por falta de matching);<br>2) Input concatenou `12` para `112` un.;<br>3) Payload leu SKU `300497`. |
| **5** | `5x CONDUITE CORR AM FORTLEV 25MM 50M` | `CONDUITE 25MM` | CONDUITE CORRUGADO AMARELO TIGRE 3/4X50M | `74179` | 5 un. | 15 un. | R$ 99,95 | R$ 54,90 *(SKU 406043)* | R$ 1.499,25 | 1) Marca Fortlev indisponível (Tigre retornada);<br>2) Payload leu SKU `406043` (*Alicate 12"*) da gaveta do carrinho lateral;<br>3) No portal, Tigre 15 un. permaneceu no carrinho. |

---

## 4. 📝 Recomendações Técnicas para a Etapa de Correção (Futura)

1. **Escopamento Estrito dos Seletores da Grade de Busca**:
   - Alterar todos os seletores de resultados para `main section div.grid` ou bloquear/fechar a gaveta do carrinho lateral durante o fluxo de busca.
2. **Matching Semântico e Score de Equivalência**:
   - Integrar o motor de matching (`matchingEngine.ts`) para comparar o título retornado contra a marca e termos do pedido original, rejeitando itens de marcas diferentes ou categorias distintas (ex: rejeitar *Resistência* quando for pedido *Ducha*).
3. **Limpeza Segura de Inputs React (Select All + Backspace)**:
   - Em vez de apenas `.fill('')`, utilizar `input.click()`, `keyboard.press('Control+A')`, `keyboard.press('Backspace')` para garantir que o estado do React seja limpo.
4. **Tratamento de Múltiplos Mínimos e Unidades de Embalagem**:
   - Extrair a informação de múltiplo de venda (`Abre X un.` ou `Não Abre X un.`) e calcular o número de caixas/unidades exatas necessárias para atender à quantidade mínima solicitada.
