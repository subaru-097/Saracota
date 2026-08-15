import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

/**
 * GET /api/v1/tax-rules
 * Consultar tabela oficial tax_rules de alíquotas ICMS-ST
 */
export async function GET() {
  try {
    const rules = await db.taxRules.list();
    return NextResponse.json({
      data: rules,
      meta: {
        total: rules.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: error.message || 'Erro ao consultar regras tributárias',
        code: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
