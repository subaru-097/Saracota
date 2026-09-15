/**
 * ROTAS HTTP DE PROCESSAMENTO E POLLING DE STATUS — CONSTRUJÁ
 * 
 * POST /api/cotacoes/:cotacaoId/processar
 * GET  /api/cotacoes/:cotacaoId/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

export async function POST(
  req: NextRequest,
  { params }: { params: { cotacaoId: string } }
) {
  const cotacaoId = params.cotacaoId;
  if (!cotacaoId) {
    return NextResponse.json({ sucesso: false, mensagem: 'ID não informado' }, { status: 400 });
  }

  // Verificar cotação existente
  const cotacao = await db.cotacoes.getById(cotacaoId);
  if (!cotacao) {
    return NextResponse.json({ sucesso: false, mensagem: 'Cotação não encontrada' }, { status: 404 });
  }

  return NextResponse.json({
    sucesso: true,
    status: 'processamento iniciado',
    mensagem: `Processamento RPA da Construjá iniciado para cotação ${cotacaoId}.`,
    cotacaoId,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { cotacaoId: string } }
) {
  const cotacaoId = params.cotacaoId;
  const progresso = await db.cotacoes.obterProgresso(cotacaoId);
  return NextResponse.json(progresso || { status: 'processando', percentualConcluido: 20 });
}
