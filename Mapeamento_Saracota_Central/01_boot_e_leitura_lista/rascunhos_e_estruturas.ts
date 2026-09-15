/**
 * ETAPA 1 & 2: ESTRUTURA DE DADOS DOS ITENS E RASCUNHO — SARA COTA
 * 
 * Contém os tipos TypeScript e interfaces que definem a lista de itens,
 * fornecedores cotados e histórico no sistema.
 */

export interface ItemRascunho {
  id: string;
  texto: string;                 // Nome/Descrição do produto digitado ou falado pelo usuário
  quantidade: number;            // Quantidade solicitada
  unidade?: string;              // Ex: 'un', 'm', 'cx', 'kg'
  origem: 'texto' | 'voz' | 'pdf';
  criadoEm: string;
  precoEstimadoUnitario?: number;
}

export interface ItemCotadoDetalhado {
  itemId: string;
  nomeSolicitado: string;
  nomeEncontrado: string;
  referencia?: string;
  quantidade: number;
  unidade?: string;
  precoUnitario: number;
  subtotalComSt: number;
  status: 'encontrado' | 'nao_encontrado' | 'similar';
  produtoAlternativoSugestao?: string;
}

export interface FornecedorCotado {
  id: string;
  nome: string;
  score?: number;
  fatorPreco?: number;
  prazoDias?: number;
  matchingStatus?: 'exato' | 'parcial' | 'pendente';
  valorProdutos: number;
  valorST?: number;
  valorTotalGeral: number;
  urlCarrinhoDireto?: string;    // Link para redirecionamento direto do carrinho
  itensCotados: ItemCotadoDetalhado[];
}

export interface CotacaoSession {
  id: string;
  codigoCotacao: string;
  obra: string;
  status: 'rascunho' | 'processando' | 'aguardando_revisao' | 'concluido';
  fornecedores: FornecedorCotado[];
  itens: ItemRascunho[];
  valorTotalGeral: number;
}
