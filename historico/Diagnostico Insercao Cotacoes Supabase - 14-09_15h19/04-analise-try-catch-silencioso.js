/**
 * ANÁLISE DO TRY/CATCH SILENCIOSO QUE "ENGOLIA" O ERRO
 * Arquivo: lib/db/client.ts (Linhas 309 a 332)
 */

// 1. Chamada de inserção no Supabase
const { data: cotData, error: cotErr } = await supabase
  .from('cotacoes')
  .insert([cotacaoRecordDb])
  .select()
  .single();

// 2. Tratamento do Erro:
if (cotErr) {
  // Apenas faz console.warn e NÃO lança erro (sem throw)
  console.warn('[DB WARNING] Inserção de cotação no Supabase falhou (usando armazenamento em memória local):', cotErr.message);
} else if (cotData) {
  // Caso de sucesso...
}

// 3. Catch Genérico Exceção:
} catch (e: any) {
  // Apenas faz console.warn e NÃO lança erro (sem throw)
  console.warn('[DB WARNING] Exceção ao gravar cotação no Supabase:', e.message);
}

// 4. Retorno Final da Função:
// A função SEMPRE retorna o objeto local simulado em memória Node (globalThis.__saracota_quotes_store)
return cotacaoRecordLocal;
