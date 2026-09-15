import { NextRequest, NextResponse } from 'next/server';
import { processarCotacaoTodosFornecedores, isCotacaoEmProcessamento } from '@/lib/services/automacao/matchingEngine';

// Configuração explícita do timeout máximo da API Route no Next.js App Router (300 segundos = 5 minutos)
export const maxDuration = 300;

/**
 * POST /api/cotacoes/:cotacaoId/processar
 * Dispara a automação RPA (Login + Busca + Matching) para todos os fornecedores vinculados em background
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { cotacaoId: string } }
) {
  const tsStart = new Date().toISOString();
  try {
    const cotacaoId = params.cotacaoId;

    console.log(`[${tsStart}] [API ROUTE /api/cotacoes/${cotacaoId}/processar] Requisição POST recebida. Disparando tarefa assíncrona de RPA no Node.js server...`);

    if (!cotacaoId) {
      return NextResponse.json(
        {
          sucesso: false,
          status: 'ERRO',
          mensagem: 'Informe o ID da cotação na URL.',
        },
        { status: 400 }
      );
    }

    // Trava de Concorrência: Verificar se a cotação já está rodando
    if (await isCotacaoEmProcessamento(cotacaoId)) {
      console.warn(`[${tsStart}] [API ROUTE 409 CONFLICT] A cotação ${cotacaoId} já está em processamento. Rejeitando segundo disparo.`);
      return NextResponse.json(
        {
          sucesso: false,
          status: 'CONFLITO',
          mensagem: `A cotação ${cotacaoId} já está em processamento por outro processo.`,
          cotacaoId,
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {}

    const { db } = await import('@/lib/db/client');

    // Confirme que o cotacaoId sempre existe antes do update (se não existir, logar erro claro, não criar um novo registro)
    const cotacaoExistente = await db.cotacoes.getById(cotacaoId);
    if (!cotacaoExistente) {
      console.error(`[${tsStart}] [API ROUTE ERROR] Cotação ID '${cotacaoId}' não encontrada no sistema. Abortando processamento.`);
      return NextResponse.json(
        {
          sucesso: false,
          status: 'NAO_ENCONTRADA',
          mensagem: `Cotação com ID '${cotacaoId}' não foi encontrada no banco de dados.`,
          cotacaoId,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Se a cotação existe e itens foram enviados na requisição, atualizar o registro já existente
    if (body.itens && Array.isArray(body.itens) && body.itens.length > 0) {
      const fIds = body.fornecedorIds || [];
      await db.cotacoes.update(cotacaoId, {
        itens: body.itens,
        fornecedorIds: fIds,
        fornecedores_selecionados: fIds,
        fornecedor_id: fIds[0] || undefined,
      });
    }

    // Disparar o processamento assíncrono em background sem travar a requisição HTTP
    processarCotacaoTodosFornecedores(cotacaoId).catch((err) => {
      console.error(`[${new Date().toISOString()}] [API Background Error] Erro fatal no processamento assíncrono da cotação ${cotacaoId}:`, err.stack || err);
    });

    // Retorna a resposta imediatamente para o cliente
    return NextResponse.json({
      sucesso: true,
      status: 'processamento iniciado',
      mensagem: `Processamento de cotação com robôs RPA iniciado em segundo plano para a cotação ${cotacaoId}.`,
      cotacaoId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] [API ROUTE ERROR] Erro na rota POST /api/cotacoes/processar:`, error.stack || error);
    return NextResponse.json(
      {
        sucesso: false,
        status: 'ERRO',
        mensagem: error.message || 'Erro ao iniciar o processamento da cotação.',
      },
      { status: 500 }
    );
  }
}
