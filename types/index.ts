/**
 * Sara Cota SaaS - Domain Data Models & Types
 * Conforme convenções de backend (sara-backend-conventions) e schema de banco (sara-database-schema)
 */

export type UF = 'SP' | 'MG' | 'RJ' | 'PR' | 'SC' | 'RS' | 'BA' | 'GO' | 'DF';

export type MatchingType = 'exato' | 'similar' | 'indisponivel';

export type StatusCotacao = 'rascunho' | 'aguardando_fornecedores' | 'em_analise' | 'aprovada' | 'finalizada' | 'recusada';

export type CategoriaProduto = 'eletrica' | 'hidraulica' | 'estrutura' | 'acabamento' | 'ferragens';

export type UserRole = 'proprietario' | 'colaborador';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  cargo: 'comprador' | 'engenheiro' | 'encarregado' | 'proprietario';
  clienteId: string;
  avatarUrl?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  cnpj: string;
  ufPadrao: UF;
  regimeTributario: 'simples' | 'presumido' | 'real';
}

export interface Projeto {
  id: string;
  clienteId: string;
  nomeObra: string;
  ufDestino: UF;
  endereco?: string;
  encarregadoNome?: string;
}

export interface Fornecedor {
  id: string;
  clienteId?: string;
  nome: string;
  categoria?: string;
  cnpj?: string;
  uf: UF;
  scoreConfiabilidade: number; // 0.0 - 5.0
  slaMinutos: number;
  acordoST: string;
  especialidades: string[];
  verificado: boolean;
  cotacoesAtendidasCount: number;
  conectado?: boolean;
  whatsapp?: string;
}

export interface AtributosTecnicos {
  bitola?: string;        // ex: "2.5mm²"
  tensao?: string;        // ex: "750V"
  diametro?: string;      // ex: "100mm"
  pressao?: string;       // ex: "10bar"
  cor?: string;           // ex: "Azul"
  normaABNT?: string;     // ex: "NBR NM 247-3"
  marcaRecomendada?: string;
  comprimentoBarra?: string; // ex: "6 metros"
}

export interface Produto {
  id: string;
  nome: string;
  categoria: CategoriaProduto;
  ncm: string;
  sku: string;
  atributos: AtributosTecnicos;
  unidadesDisponiveis: string[]; // ex: ["Metro (m)", "Rolo 100m"]
  fatorConversaoMetro?: number;  // ex: 1 rolo = 100m
  precoMedioReferencia: number;
  unidadeBase: string;
}

export interface RegraTributaria {
  id: string;
  ncm: string;
  ufOrigem: UF;
  ufDestino: UF;
  aliquotaIcmsOrigem: number;   // ex: 0.12 (12%)
  aliquotaIcmsDestino: number;  // ex: 0.18 (18%)
  mvaST: number;                // ex: 0.45 (45% Margem de Valor Agregado)
  isencaoProtocolo?: string;   // ex: "Protocolo ICMS 41/2008"
  protocoloIsencao?: string;
  impostoEstimado?: boolean;
}

export interface ResultadoICMSST {
  valorSTUnitario: number;
  valorSTTotal: number;
  aliquotaEfetivaPercent: number;
  baseCalculoST: number;
  isTaxEstimated: boolean;
  protocoloIsencao?: string;
}

export interface ItemCotacaoFornecedorPreco {
  fornecedorId: string;
  fornecedorNome: string;
  precoUnitario: number;
  unidadeOferecida: string;
  fatorConversao: number; // ex: 1 se for unidade base
  resultadoST: ResultadoICMSST;
  isBestPrice?: boolean;
  whatsapp?: string;
}

export interface ItemCotacao {
  id: string;
  cotacaoId?: string;
  nomeOriginal: string;
  ncm: string;
  atributos: AtributosTecnicos;
  quantidade: number;
  unidade: string;
  matchingStatus: MatchingType;
  matchingNote?: string;
  produtoId?: string;
  precosFornecedores: ItemCotacaoFornecedorPreco[];
}

export interface Cotacao {
  id: string;
  codigoCotacao: string; // ex: "#8492"
  projeto: Projeto;
  status: StatusCotacao;
  origem: 'texto' | 'audio_whatsapp' | 'manual';
  origemTextoOriginal?: string;
  categoriaPrincipal: CategoriaProduto;
  dataCriacao: string; // ISO string ou formatada
  itens: ItemCotacao[];
  fornecedoresParticipantesCount: number;
  valorTotalProdutos: number;
  valorTotalST: number;
  valorTotalGeral: number;
  economiaEstimadaBRL: number;
  melhorFornecedorNome?: string;
}

export interface ProductMatchingQuery {
  textoOuSKU: string;
  categoriaFilter?: CategoriaProduto | 'todos';
  ufOrigem?: UF;
  ufDestino?: UF;
}

/**
 * Rascunho de Cotação Estilo Bloco de Notas / Lista de Compras (Prompt 6)
 * Suporte a Voz + Texto, Autosave e Expiração de 14 Dias.
 */
export interface ItemRascunho {
  id: string;
  texto: string;
  origem: 'voz' | 'texto';
  criadoEm: string;
  editadoEm?: string;
}

export interface CotacaoRascunho {
  id: string;
  usuarioId: string;
  obraNome: string;
  status: 'rascunho' | 'finalizada' | 'cancelada';
  itens: ItemRascunho[];
  criadoEm: string;
  ultimaEdicaoEm: string;
  expiraEm: string;
}
