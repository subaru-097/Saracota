import { NextRequest, NextResponse } from 'next/server';
import { buscarEExtrairProdutosFornecedor } from '@/lib/services/automacao/buscarProduto';

/**
 * POST /api/automacao/testar-busca
 * Endpoint de teste manual para busca de produtos e extração de resultados (Prompt 11)
 * Body: { fornecedorId: string, nomeItem: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { fornecedorId, nomeItem } = body;

    if (!fornecedorId || !nomeItem) {
      return NextResponse.json(
        {
          sucesso: false,
          status: 'CAMPO_BUSCA_NAO_ENCONTRADO',
          mensagem: 'Parâmetros inválidos. Envie { fornecedorId: "...", nomeItem: "..." } no corpo da requisição.',
          totalResultados: 0,
          resultados: [],
        },
        { status: 400 }
      );
    }

    const resultado = await buscarEExtrairProdutosFornecedor(fornecedorId, nomeItem);

    return NextResponse.json(resultado, {
      status: resultado.sucesso ? 200 : 400,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        sucesso: false,
        status: 'TIMEOUT',
        mensagem: error.message || 'Erro interno ao processar automação de busca de produto.',
        totalResultados: 0,
        resultados: [],
      },
      { status: 500 }
    );
  }
}
