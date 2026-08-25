import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

/**
 * POST /api/cotacoes & GET /api/cotacoes (Alias para compatibilidade)
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itens, fornecedores, nomeObra, obraNome } = body;

    if ((!itens || itens.length === 0) && !body.origemTextoOriginal) {
      return NextResponse.json(
        {
          error: true,
          message: 'Adicione ao menos 1 item na lista antes de enviar a cotação.',
          code: 'BAD_REQUEST',
        },
        { status: 400 }
      );
    }

    if (!fornecedores || fornecedores.length === 0) {
      return NextResponse.json(
        {
          error: true,
          message: 'Selecione ao menos 1 fornecedor para solicitar cotação.',
          code: 'BAD_REQUEST',
        },
        { status: 400 }
      );
    }

    const novaCotacao = await db.cotacoes.create({
      obraNome: nomeObra || obraNome || 'Reserva das Palmeiras',
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
          message: `Cotação enviada com sucesso para ${fornecedores.length} fornecedores!`,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro ao processar envio de cotação',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
