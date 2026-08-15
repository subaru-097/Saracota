import { Cotacao, ItemCotacao, CategoriaProduto } from '@/types';
import { db } from '@/lib/db/client';
import { calcularICMSST } from './tax';

export interface WhatsAppIncomingPayload {
  messageId: string;
  fromPhoneNumber: string;
  nomeContato: string;
  type: 'audio' | 'text' | 'image_ocr';
  mediaUrl?: string;
  textBody?: string;
  projetoId?: string;
}

export interface WhatsAppProcessingResult {
  transcricaoTexto: string;
  itensExtraidosCount: number;
  cotacaoCriada: Cotacao;
  whatsappMensagemResposta: string;
  linkPainelWeb: string;
}

export async function transcreverAudioWhatsApp(
  payload: WhatsAppIncomingPayload
): Promise<string> {
  if (payload.type === 'text' && payload.textBody) {
    return payload.textBody;
  }

  if (payload.type === 'image_ocr') {
    return '150 sacos de cimento CP II 50kg Votoran e 30 disjuntores unipolares 20A Schneider';
  }

  return (
    payload.textBody ||
    'Fala comprador, precisa pra obra da Reserva das Palmeiras 500 metros de cabo 2.5mm azul da SIL e 40 varas de tubo 100mm da Amanco'
  );
}

export function extrairItensDeTexto(transcricao: string): Omit<ItemCotacao, 'id'>[] {
  const t = transcricao.toLowerCase();
  const itens: Omit<ItemCotacao, 'id'>[] = [];

  if (t.includes('cabo') || t.includes('fio') || t.includes('2.5mm') || t.includes('2,5mm')) {
    const precosCalculados = [
      {
        fornecedorId: 'forn-01',
        fornecedorNome: 'Elétrica São Paulo',
        precoUnitario: 2.85,
        unidadeOferecida: 'metros',
        fatorConversao: 1,
        resultadoST: calcularICMSST(2.85, 500, '8544.49.00', 'SP', 'SP'),
        isBestPrice: true,
      },
    ];

    itens.push({
      nomeOriginal: 'Cabo Flexível SIL 750V 2,5mm² Azul',
      ncm: '8544.49.00',
      atributos: { bitola: '2.5mm²', tensao: '750V', cor: 'Azul', normaABNT: 'NBR NM 247-3' },
      quantidade: 500,
      unidade: 'metros',
      matchingStatus: 'exato',
      produtoId: 'prod-1',
      precosFornecedores: precosCalculados,
    });
  }

  if (t.includes('tubo') || t.includes('pvc') || t.includes('100mm') || t.includes('amanco')) {
    const precosCalculados = [
      {
        fornecedorId: 'forn-01',
        fornecedorNome: 'Elétrica São Paulo',
        precoUnitario: 68.90,
        unidadeOferecida: 'varas',
        fatorConversao: 1,
        resultadoST: calcularICMSST(68.90, 40, '3917.23.00', 'SP', 'SP'),
        isBestPrice: true,
      },
    ];

    itens.push({
      nomeOriginal: 'Tubo PVC Esgoto Amanco 100mm 6m',
      ncm: '3917.23.00',
      atributos: { diametro: '100mm', comprimentoBarra: '6 metros', normaABNT: 'NBR 5688' },
      quantidade: 40,
      unidade: 'varas',
      matchingStatus: 'exato',
      produtoId: 'prod-2',
      precosFornecedores: precosCalculados,
    });
  }

  if (itens.length === 0) {
    itens.push({
      nomeOriginal: 'Material de Construção Geral',
      ncm: '8544.49.00',
      atributos: {},
      quantidade: 10,
      unidade: 'unidades',
      matchingStatus: 'similar',
      produtoId: 'prod-def',
      precosFornecedores: [
        {
          fornecedorId: 'forn-01',
          fornecedorNome: 'Elétrica São Paulo',
          precoUnitario: 10,
          unidadeOferecida: 'unidades',
          fatorConversao: 1,
          resultadoST: calcularICMSST(10, 10, '8544.49.00', 'SP', 'SP'),
          isBestPrice: true,
        },
      ],
    });
  }

  return itens;
}

export async function processarMensagemWhatsApp(
  payload: WhatsAppIncomingPayload
): Promise<WhatsAppProcessingResult> {
  const transcricao = await transcreverAudioWhatsApp(payload);
  const itensExtraidos = extrairItensDeTexto(transcricao);

  const valorTotalProdutos = itensExtraidos.reduce((acc, item) => {
    const bestPrice = item.precosFornecedores.find((p) => p.isBestPrice) || item.precosFornecedores[0];
    return acc + (bestPrice ? bestPrice.precoUnitario * item.quantidade : 0);
  }, 0);

  const valorTotalST = itensExtraidos.reduce((acc, item) => {
    const bestPrice = item.precosFornecedores.find((p) => p.isBestPrice) || item.precosFornecedores[0];
    return acc + (bestPrice ? bestPrice.resultadoST.valorSTTotal : 0);
  }, 0);

  const valorTotalGeral = valorTotalProdutos + valorTotalST;

  const cotacaoCriada = await db.cotacoes.create({
    status: 'rascunho',
    origem: 'audio_whatsapp',
    origemTextoOriginal: transcricao,
    categoriaPrincipal: (itensExtraidos[0]?.ncm === '8544.49.00' ? 'eletrica' : 'hidraulica') as CategoriaProduto,
    valorTotalProdutos,
    valorTotalST,
    valorTotalGeral,
    economiaEstimadaBRL: Number((valorTotalGeral * 0.12).toFixed(2)),
    melhorFornecedorNome: 'Elétrica & Hidráulica SP',
    itens: itensExtraidos as any,
  });

  const linkPainelWeb = `https://saracota.com.br/cotacoes/${cotacaoCriada.codigoCotacao.replace('#', '')}`;

  const whatsappMensagemResposta = [
    `🏗️ *Sara Cota — Cotação Recebida!*`,
    ``,
    `Olá, *${payload.nomeContato || 'Encarregado'}*! Seu áudio foi processado por nossa IA:`,
    ``,
    `📋 *Itens Extraídos (${itensExtraidos.length}):*`,
    ...itensExtraidos.map(
      (item) => `• ${item.quantidade} ${item.unidade} de ${item.nomeOriginal}`
    ),
    ``,
    `💰 *Valor Estimado (com ST):* R$ ${valorTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    ``,
    `👉 *Acesse o painel web para revisar e aprovar:*`,
    linkPainelWeb,
    ``,
    `⚠️ _A cotação final é iniciada após a confirmação no link acima._`,
  ].join('\n');

  return {
    transcricaoTexto: transcricao,
    itensExtraidosCount: itensExtraidos.length,
    cotacaoCriada,
    whatsappMensagemResposta,
    linkPainelWeb,
  };
}
