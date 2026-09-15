/**
 * ETAPA 6: RETORNO DOS DADOS PARA A SARACOTA — ENDPOINTS E POLLING
 * 
 * Trechos extraídos de:
 * - app/api/cotacoes/[cotacaoId]/processar/route.ts
 * - app/api/cotacoes/[cotacaoId]/status/route.ts
 * 
 * Responsável por receber o disparo da cotação, gerenciar execuções em background
 * e responder requisições de polling sobre o status da automação.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processarCotacaoTodosFornecedores, isCotacaoEmProcessamento, obterStatusCotacao } from '@/lib/services/automacao/matchingEngine';

export const maxDuration = 300; // Timeout de 5 minutos

/**
 * 1. POST /api/cotacoes/:cotacaoId/processar
 * Dispara o robô Playwright RPA em background no Node.js server
 */
export async function POST_processar(
  req: NextRequest,
  cotacaoId: string
) {
  try {
    if (!cotacaoId) {
      return NextResponse.json(
        { sucesso: false, mensagem: 'ID da cotação obrigatório na URL.' },
        { status: 400 }
      );
    }

    // Trava de Concorrência: Evita disparos duplicados para a mesma cotação
    if (await isCotacaoEmProcessamento(cotacaoId)) {
      return NextResponse.json(
        { sucesso: false, status: 'CONFLITO', mensagem: 'Cotação já em processamento.' },
        { status: 409 }
      );
    }

    let body: any = {};
    try { body = await req.json(); } catch (e) {}

    const { db } = await import('@/lib/db/client');
    const cotacaoExistente = await db.cotacoes.getById(cotacaoId);
    if (!cotacaoExistente) {
      return NextResponse.json(
        { sucesso: false, mensagem: `Cotação ${cotacaoId} não encontrada.` },
        { status: 404 }
      );
    }

    // Disparar o processamento em background sem travar a requisição HTTP do cliente
    processarCotacaoTodosFornecedores(cotacaoId).catch((err) => {
      console.error(`Erro fatal no processamento assíncrono da cotação ${cotacaoId}:`, err);
    });

    // Retornar resposta imediata ao frontend
    return NextResponse.json({
      sucesso: true,
      status: 'processamento iniciado',
      cotacaoId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { sucesso: false, mensagem: error.message || 'Erro ao iniciar cotação.' },
      { status: 500 }
    );
  }
}

/**
 * 2. GET /api/cotacoes/:cotacaoId/status
 * Endpoint de Polling para o frontend acompanhar o progresso em tempo real
 */
export async function GET_status(
  req: NextRequest,
  cotacaoId: string
) {
  try {
    const statusData = await obterStatusCotacao(cotacaoId);
    return NextResponse.json({
      sucesso: true,
      ...statusData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { sucesso: false, mensagem: error.message || 'Erro ao consultar status.' },
      { status: 500 }
    );
  }
}
