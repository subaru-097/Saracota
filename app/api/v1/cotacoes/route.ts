import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

/**
 * GET /api/v1/cotacoes
 * Listar todas as cotações ativas
 */
export async function GET() {
  try {
    const cotacoes = await db.cotacoes.list();
    return NextResponse.json({
      data: cotacoes,
      meta: {
        total: cotacoes.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro interno ao listar cotações',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/cotacoes
 * Criar nova cotação vinculando lista de itens + fornecedores selecionados
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itens, fornecedores, nomeObra, obraNome } = body;

    if ((!itens || itens.length === 0) && !body.origemTextoOriginal && !body.projeto) {
      return NextResponse.json(
        {
          error: true,
          message: 'Parâmetros inválidos. Informe a lista de itens.',
          code: 'BAD_REQUEST',
        },
        { status: 400 }
      );
    }

    const novaCotacao = await db.cotacoes.create({
      obraNome: nomeObra || obraNome || body.projeto?.nomeObra || 'Reserva das Palmeiras',
      itens: (itens || []).map((it: any) => ({
        material: typeof it === 'string' ? it : it.texto || it.material?.nome || 'Material',
        quantidade: it.quantidade || 1,
        unidade: it.unidade || 'unidades',
        preco_unitario: it.precoBaseUnitario || 10,
        categoria: it.categoria || 'eletrica',
      })),
      fornecedorIds: fornecedores,
      status: 'pendente',
    });

    return NextResponse.json(
      {
        data: novaCotacao,
        meta: {
          message: `Cotação enviada com sucesso para ${fornecedores?.length || 1} fornecedores!`,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro ao processar criação de cotação',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
