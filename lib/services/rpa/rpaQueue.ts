import { RPAEngine } from './rpaEngine';
import { RPAExecutionOptions, RPALoginResult } from './rpaTypes';

export class RPAQueue {
  /**
   * Executa a automação de login em paralelo ou em fila para múltiplos fornecedores
   */
  static async processMultipleSuppliers(
    fornecedores: Array<{
      id: string;
      nome: string;
      urlPortalB2B?: string;
      login?: string;
      senhaCriptografada?: string;
      senhaPlana?: string;
    }>,
    options: RPAExecutionOptions = {}
  ): Promise<RPALoginResult[]> {
    console.log(`[RPA Queue] Iniciando lote de automação para ${fornecedores.length} fornecedor(es)...`);

    // Execução paralela resiliente com Promise.allSettled (um fornecedor falhar não derruba os outros)
    const promises = fornecedores.map((forn) =>
      RPAEngine.testSupplierLogin(forn, options).catch((err) => ({
        supplierId: forn.id,
        supplierName: forn.nome,
        success: false,
        status: 'error' as const,
        executionTimeMs: 0,
        logs: [
          {
            timestamp: new Date().toLocaleTimeString('pt-BR'),
            level: 'error' as const,
            step: 'EXCEPTION',
            message: err.message || 'Exceção não tratada na automação RPA.',
          },
        ],
        errorMsg: err.message || 'Erro inesperado na automação RPA.',
        requiresManualQuotation: true,
        manualActionSuggestion: `Realize a cotação manual via WhatsApp para o fornecedor ${forn.nome}.`,
      }))
    );

    const settledResults = await Promise.allSettled(promises);

    const finalResults: RPALoginResult[] = [];
    for (const res of settledResults) {
      if (res.status === 'fulfilled') {
        finalResults.push(res.value);
      }
    }

    return finalResults;
  }
}
