import { supabase } from '@/lib/db/client';

export interface ParametrosLogAutomacao {
  fornecedorId: string;
  etapa: string;
  motivo: string;
  mensagem?: string;
  sucesso?: boolean;
}

/**
  * Registra uma falha ou evento da automação RPA na tabela `logs_automacao` no Supabase.
  * Trata falhas de RLS ou colunas inexistentes com resiliência para não interromper a execução do robô.
  */
export async function registrarLogAutomacao(params: ParametrosLogAutomacao): Promise<boolean> {
  const { fornecedorId, etapa, motivo, mensagem, sucesso = false } = params;

  console.error(`❌ [RPA LOG AUTOMACAO] Fornecedor ID: ${fornecedorId} | Etapa: ${etapa} | Motivo: ${motivo} | Detalhes: ${mensagem || 'Nenhum'}`);

  if (!supabase) {
    console.warn('[RPA LOG AUTOMACAO] Supabase não está configurado. Log gravado apenas no console.');
    return false;
  }

  try {
    const payload: any = {
      fornecedor_id: fornecedorId,
      etapa,
      motivo,
      mensagem: mensagem || `${etapa}: ${motivo}`,
      sucesso,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('logs_automacao').insert([payload]);

    if (error) {
      if (error.code === 'PGRST204') {
        // Fallback: se a coluna 'motivo' não existir na tabela do Supabase, insere sem essa coluna
        delete payload.motivo;
        payload.mensagem = `[Motivo: ${motivo}] ${mensagem || ''}`;
        const { error: retryError } = await supabase.from('logs_automacao').insert([payload]);
        if (retryError) {
          console.warn('[RPA LOG AUTOMACAO] Erro no retry do insert:', retryError.message);
          return false;
        }
      } else {
        console.warn('[RPA LOG AUTOMACAO] Erro ao inserir no Supabase:', error.message);
        return false;
      }
    }

    console.log(`✅ [RPA LOG AUTOMACAO] Log registrado no Supabase para etapa "${etapa}".`);
    return true;
  } catch (err: any) {
    console.warn('[RPA LOG AUTOMACAO] Exceção ao tentar gravar log no Supabase:', err?.message || err);
    return false;
  }
}
