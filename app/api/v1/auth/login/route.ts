import { NextRequest, NextResponse } from 'next/server';
import { CURRENT_MOCK_USER, createMockToken } from '@/lib/auth';

/**
 * POST /api/v1/auth/login
 * Autenticação básica de comprador ou lojista
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        {
          error: true,
          message: 'E-mail e senha são obrigatórios.',
          code: 'BAD_REQUEST',
        },
        { status: 400 }
      );
    }

    // Mock auth verification
    const token = createMockToken(CURRENT_MOCK_USER);

    return NextResponse.json({
      data: {
        user: CURRENT_MOCK_USER,
        accessToken: token,
        tokenType: 'Bearer',
      },
      meta: {
        message: 'Login realizado com sucesso',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro ao realizar login',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
