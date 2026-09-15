/**
 * ESTRUTURAS DE DADOS DE ENTRADA DO BLOCO DE COMPRAS DA SARA COTA
 */

export interface ItemRascunhoConstruja {
  id: string;
  texto: string;          // Exemplo genérico: "Quantidade x Nome do Produto"
  quantidade: number;     // Ex: 3
  unidade?: string;       // Ex: "un", "cx", "m"
  origem: 'texto' | 'voz' | 'pdf';
  criadoEm: string;
}

export interface PayloadEnvioConstruja {
  cotacaoId: string;
  obraNome: string;
  fornecedorId: string;   // "a1684c4d-d896-4ba9-a591-cda455c5ffe2"
  itens: ItemRascunhoConstruja[];
}
