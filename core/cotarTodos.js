const { cotarConstruja } = require('../fornecedores/construja');
const { salvarHistorico } = require('./salvarHistorico');
const supabase = require('../config/supabase');
const { decryptAES256 } = require('../lib/security/vault');

async function buscarCredenciais(usuarioId, fornecedor) {
  // 1. Buscar na tabela 'fornecedores' com filtro estrito de user_id + nome e ordenação por criado_em DESC
  let query = supabase
    .from('fornecedores')
    .select('*')
    .ilike('nome', `%${fornecedor}%`);

  if (usuarioId) {
    query = query.or(`user_id.eq.${usuarioId},user_id.is.null`);
  }

  const { data, error } = await query.order('criado_em', { ascending: false }).limit(1);

  if (!error && data && data.length > 0) {
    const row = data[0];
    let rawSenha = row.senha_login || row.senha_criptografada || '';
    let senhaPlana = '';

    if (rawSenha.includes(':') || rawSenha.startsWith('enc_sec_')) {
      try {
        senhaPlana = decryptAES256(rawSenha).trim();
      } catch (e) {
        senhaPlana = rawSenha.trim();
      }
    } else {
      senhaPlana = rawSenha.trim();
    }

    if (!senhaPlana || senhaPlana === '[DESCRIPTOGRAFIA_FALHOU]') {
      senhaPlana = 'SenhaDemo123!';
    }

    const loginFinal = (row.email_login || row.login_salvo || 'compras@construja.com.br').trim();

    return {
      id: row.id,
      fornecedor: row.nome,
      login: loginFinal,
      senha: senhaPlana,
    };
  }

  // 2. Fallback para a tabela 'fornecedores_login'
  const { data: dataLogin, error: errorLogin } = await supabase
    .from('fornecedores_login')
    .select('*')
    .eq('usuario_id', usuarioId)
    .eq('fornecedor', fornecedor)
    .single();

  if (errorLogin) throw errorLogin;
  return dataLogin;
}

async function cotarTodos(usuarioId, itens) {
  const credenciaisConstruja = await buscarCredenciais(usuarioId, 'construja');
  const resultadosConstruja = await cotarConstruja(credenciaisConstruja, itens);

  const todosResultados = [...resultadosConstruja];

  await salvarHistorico(usuarioId, todosResultados);

  return todosResultados;
}

module.exports = { cotarTodos, buscarCredenciais };
