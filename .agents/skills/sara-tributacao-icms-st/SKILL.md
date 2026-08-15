---
name: sara-tributacao-icms-st
description: Regras de cálculo de ICMS-ST (Substituição Tributária) por estado e NCM. Use sempre que implementar ou alterar lógica de impostos.
---

# Tributação ICMS-ST

## Regras
- Sempre considerar três variáveis: UF do fornecedor, UF do cliente/projeto, NCM do item
- Nunca hardcodar alíquota no código. Sempre buscar de uma tabela tax_rules (ncm, uf_origem, uf_destino, aliquota_icms, mva_st)
- Cálculo do imposto tributado deve ser exposto separadamente do valor do produto no relatório de cotação
- Caso o NCM do item não seja identificado, marcar cotação com flag "imposto_estimado": true e avisar o cliente na interface
- Deixar preparado para, no futuro, plugar API externa de tabela tributária sem precisar reescrever a lógica principal
