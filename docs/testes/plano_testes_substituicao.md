# Plano de Testes Oficial: Motor de Substituição Automática de Produtos

> **Sara Cota SaaS** — Suíte de testes automatizados, validação de regras de substituição, limites de tolerância e cobertura de regressão antes do deploy em produção.

---

## 1. Escopo e Objetivos de Teste

Garantir que a funcionalidade de **substituição automática de produtos**:
1. Nunca substitua por um produto de especificação técnica diferente (ex: proibir trocar bitola 2.5mm por 4.0mm).
2. Respeite as travas de tolerância de preço (`±15%`).
3. Gere relatórios de transparência com justificativas claras para o cliente.
4. Respeite a flag individual do cliente (`substituicao_automatica_ativa = false`).

---

## 2. Casos de Teste Automatizados (Suíte de Unidade e Integração)

### CT-01: Substituição Válida de Marca Equivalente (Sucesso)
- **Entrada**: Pedido *"Conduíte Corrugado Tigre 25mm 50m"*.
- **Cenário**: Fornecedor Cicalfer não possui a marca *Tigre*, mas possui *Krona* 25mm 50m por R$ 48,50 (Preço ref: R$ 50,00).
- **Resultado Esperado**: Substituição aprovada. `status = "SUBSTITUIDO"`, marca `Krona`, justificativa gerada.

### CT-02: Rejeição por Divergência de Bitola/Medida (Falha Esperada)
- **Entrada**: Pedido *"Cabo Flexível Cobercom 2,50mm 100m"*.
- **Cenário**: Fornecedor não possui cabo 2,50mm de nenhuma marca, mas possui cabo 4,00mm.
- **Resultado Esperado**: Substituição **REJEITADA**. Item marcado como `NAO_ENCONTRADO` (preço R$ 0,00). Motivo: *"Bitola incompatível (2.5mm vs 4.0mm)"*.

### CT-03: Rejeição por Variação Excessiva de Preço (Tolerância > 15%)
- **Entrada**: Pedido *"Ducha Lorenzetti Bella Ducha 127V 5500W"* (Ref: R$ 84,00).
- **Cenário**: Única ducha disponível no fornecedor é um modelo digital de luxo de R$ 280,00 (+233%).
- **Resultado Esperado**: Substituição **REJEITADA**. Preço excede a tolerância de `+15%`.

### CT-04: Respeito à Flag do Cliente (`substituicao_automatica_ativa = false`)
- **Entrada**: Pedido *"Abraçadeira Nylon Tigre 200mm"*.
- **Cenário**: Cliente com `substituicao_automatica_ativa = false`. Fornecedor só tem marca JNG.
- **Resultado Esperado**: Substituição **PULADA**. Item marcado como `NAO_ENCONTRADO`.

### CT-05: Regressão de Conversão de Quantidades em Lote
- **Entrada**: Pedido *"100m Cabo Flexível 2,5mm"*.
- **Cenário**: Fornecedor vende apenas em rolos fechados de 100m (`RL EMB: 1`).
- **Resultado Esperado**: Quantidade mantida em 1 Rolo de 100m, sem multiplicar indevidamente.

---

## 3. Script de Execução de Testes via CLI (`npx tsx`)

Para rodar a suíte de testes de substituição antes de cada release:

```bash
npx tsx scripts/testes-manuais/test_substituicao_engine.ts
```

### Estrutura do Test Runner

```typescript
import { validarEExecutarSubstituicao } from '../lib/services/automacao/substituicaoEngine';

async function runSubstitutionTests() {
  console.log('🧪 INICIANDO SUÍTE DE TESTES DO MOTOR DE SUBSTITUIÇÃO AUTOMÁTICA...\n');

  // CT-01
  const ct1 = await validarEExecutarSubstituicao({
    itemSolicitado: { nome: 'Conduite Tigre 25mm 50m', categoria: 'ELETRICA', diametro: '25mm' },
    candidatosFornecedor: [{ nome: 'Conduite Krona 25mm 50m', preco: 48.5, diametro: '25mm' }],
    clienteConfig: { substituicaoAtiva: true }
  });
  console.assert(ct1.sucesso === true, 'CT-01 Falhou');

  // CT-02
  const ct2 = await validarEExecutarSubstituicao({
    itemSolicitado: { nome: 'Cabo Flex 2.5mm', categoria: 'ELETRICA', bitola: '2.5mm' },
    candidatosFornecedor: [{ nome: 'Cabo Flex 4.0mm', preco: 380.0, bitola: '4.0mm' }],
    clienteConfig: { substituicaoAtiva: true }
  });
  console.assert(ct2.sucesso === false, 'CT-02 Falhou (Deveria rejeitar bitola diferente)');

  console.log('\n✅ TODOS OS TESTES PASSARAM COM SUCESSO!');
}

runSubstitutionTests();
```
