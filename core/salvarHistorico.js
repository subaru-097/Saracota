const supabase = require('../config/supabase');
const crypto = require('crypto');

async function salvarHistorico(usuarioId, resultados) {
  const cotacaoGrupoId = crypto.randomUUID();

  const registros = resultados.map((r) => ({
    usuario_id: usuarioId,
    cotacao_grupo_id: cotacaoGrupoId,
    fornecedor: r.fornecedor,
    produto: r.produto,
    quantidade: r.quantidade,
    preco: r.preco,
    prazo: r.prazo,
    forma_pagamento: r.formaPagamento,
  }));

  const { data, error } = await supabase.from('cotacoes').insert(registros);
  if (error) throw error;
  return data;
}

module.exports = { salvarHistorico };
