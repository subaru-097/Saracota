import { NextRequest, NextResponse } from 'next/server';
import { RPAEngine } from '@/lib/services/rpa/rpaEngine';
import { RPAQueue } from '@/lib/services/rpa/rpaQueue';
import { db } from '@/lib/db/client';

/**
 * POST /api/v1/rpa/login
 * Disparar automação RPA de login para 1 ou múltiplos fornecedores
 */
export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
    const { supplierId, supplierIds, headless = true } = body;

    // 1. Caso unitário: Testar login de 1 fornecedor específico
    if (supplierId) {
      const fornecedoresList = await db.fornecedores.list();
      const forn = fornecedoresList.find((f) => f.id === supplierId);

      if (!forn) {
        return NextResponse.json({
          data: {
            supplierId: supplierId,
            supplierName: `Fornecedor ID ${supplierId}`,
            success: false,
            status: 'failed_offline',
            categoryLabel: 'Elemento não encontrado',
            errorCode: 'ERR_SUPPLIER_NOT_FOUND',
            timestamp: new Date().toISOString(),
            executionTimeMs: 0,
            logs: [
              {
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                level: 'error',
                step: 'INIT_SEARCH',
                message: `Fornecedor ID "${supplierId}" não foi encontrado na base de dados.`,
              },
            ],
            errorMsg: `Fornecedor ID "${supplierId}" não encontrado no banco real.`,
            stackTrace: `Error: ERR_SUPPLIER_NOT_FOUND\n  at route.ts:20 (Supplier ID "${supplierId}" not found)`,
            requiresManualQuotation: true,
            manualActionSuggestion: `Cadastre o fornecedor no painel antes de executar o teste de login RPA.`,
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      const result = await RPAEngine.testSupplierLogin(
        {
          id: forn.id,
          nome: forn.nome,
          urlPortalB2B: forn.urlPortalB2B,
          login: forn.login,
          email: forn.email,
          cnpj: forn.cnpj,
          loginType: forn.loginType,
          triggerSelector: forn.triggerSelector,
          senhaCriptografada: forn.senhaCriptografada,
          rawSenhaCriptografada: (forn as any).rawSenhaCriptografada || (forn as any).senhaLogin,
          seletores: forn.seletores,
        },
        { headless }
      );

      return NextResponse.json({
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    // 2. Caso em lote: Executar automação para múltiplos fornecedores em fila/paralelo
    if (supplierIds && Array.isArray(supplierIds) && supplierIds.length > 0) {
      const fornecedoresList = await db.fornecedores.list();
      const selecionados = fornecedoresList.filter((f) => supplierIds.includes(f.id));

      const batchResults = await RPAQueue.processMultipleSuppliers(
        selecionados.map((f) => ({
          id: f.id,
          nome: f.nome,
          urlPortalB2B: f.urlPortalB2B,
          login: f.login,
          senhaCriptografada: f.senhaCriptografada,
        })),
        { headless }
      );

      return NextResponse.json({
        data: batchResults,
        meta: {
          totalProcessed: batchResults.length,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({
      data: {
        supplierId: 'desconhecido',
        supplierName: 'Parâmetro Ausente',
        success: false,
        status: 'error',
        categoryLabel: 'URL inválida',
        errorCode: 'ERR_INVALID_URL',
        timestamp: new Date().toISOString(),
        executionTimeMs: 0,
        logs: [
          {
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            level: 'error',
            step: 'BAD_REQUEST',
            message: 'Informe o ID do fornecedor (supplierId) ou uma lista (supplierIds).',
          },
        ],
        errorMsg: 'Informe o ID do fornecedor (supplierId) ou uma lista de fornecedores (supplierIds).',
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      data: {
        supplierId: body?.supplierId || 'desconhecido',
        supplierName: 'Servidor RPA',
        success: false,
        status: 'error',
        categoryLabel: 'Erro desconhecido',
        errorCode: 'ERR_UNHANDLED_EXCEPTION',
        timestamp: new Date().toISOString(),
        executionTimeMs: 0,
        logs: [
          {
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            level: 'error',
            step: 'API_EXCEPTION',
            message: error.message || 'Exceção interna ao processar requisição RPA.',
          },
        ],
        errorMsg: error.message || 'Erro interno ao processar requisição RPA de login.',
        stackTrace: error.stack || String(error),
      },
    });
  }
}
