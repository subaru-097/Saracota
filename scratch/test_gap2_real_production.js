require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { Browserbase } = require('@browserbasehq/sdk');
const path = require('path');
const fs = require('fs');

async function executarValidacaoGap2ProducaoReal() {
  console.log('================================================================');
  console.log('🔥 VALIDAÇÃO COMPLEMENTAR DO GAP 2 EM PRODUÇÃO REAL (BROWSERBASE SDK)');
  console.log('================================================================\n');

  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;

  // ----------------------------------------------------------------
  // PASSO 0 — VERIFICAÇÃO DE PRÉ-REQUISITO DA CHAVE REAL
  // ----------------------------------------------------------------
  console.log('--- PASSO 0: Verificação de Autenticação da BROWSERBASE_API_KEY ---');
  console.log('   - API Key   :', apiKey ? `${apiKey.substring(0, 12)}...` : 'AUSENTE');
  console.log('   - Project ID:', projectId || 'AUSENTE');

  if (!apiKey || apiKey === 'demo-browserbase-api-key') {
    console.error('❌ [PASSO 0 FALHA]: Chave real não localizada.');
    process.exit(1);
  }

  const bb = new Browserbase({ apiKey });

  try {
    const listInitial = await bb.sessions.list();
    console.log('✅ [PASSO 0 SUCESSO]: Autenticação na API do Browserbase bem-sucedida!');
    console.log('   - Total de sessões encontradas na conta:', Array.isArray(listInitial) ? listInitial.length : 0);
  } catch (authErr) {
    console.error('❌ [PASSO 0 FALHA AUTENTICAÇÃO]: Erro na API do Browserbase:', authErr.message);
    process.exit(1);
  }

  // Importar o serviço do projeto
  const { BrowserbaseService } = require('../lib/services/automacao/browserbaseService');

  const fornConstruja = { id: 'a1684c4d-d896-4ba9-a591-cda455c5ffe2', nome: 'Construjá' };
  const fornCicalfer = { id: '33e03495-100d-45a3-9e34-899de56b0ab1', nome: 'Cicalfer' };

  // ----------------------------------------------------------------
  // PASSO 1 — REPRODUÇÃO REAL DO CONFLITO
  // ----------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('--- PASSO 1: Criando 1ª sessão remota real para Construjá ---');
  console.log('----------------------------------------------------------------');

  let sessaoConstruja = null;
  try {
    sessaoConstruja = await BrowserbaseService.criarEMontarSessaoRemota({
      fornecedorId: fornConstruja.id,
      fornecedorUrl: 'https://www.construja.com.br/produtos',
      itens: []
    });
    console.log('✅ 1. Sessão Remota Construjá Criada com Sucesso:');
    console.log('   - Session ID:', sessaoConstruja.sessionId);
    console.log('   - Live View URL:', sessaoConstruja.liveViewUrl);
  } catch (err1) {
    console.error('❌ Erro ao criar sessão da Construjá:', err1.message);
    process.exit(1);
  }

  // Verificar sessões RUNNING ativas na conta Browserbase no momento
  console.log('\n📡 Consultando `bb.sessions.list({ status: "RUNNING" })` na API do Browserbase...');
  const activeList1 = await bb.sessions.list({ status: 'RUNNING' });
  const runningList1 = (activeList1 || []).filter((s) => s.status === 'RUNNING');
  console.log('📋 Sessões em estado RUNNING na nuvem no momento:', runningList1.map((s) => ({ id: s.id, status: s.status, createdAt: s.createdAt })));

  console.log('\n----------------------------------------------------------------');
  console.log('--- PASSO 1.2: Sem fechar a Construjá, disparando sessão para Cicalfer ---');
  console.log('----------------------------------------------------------------');

  let sessaoCicalfer = null;
  try {
    sessaoCicalfer = await BrowserbaseService.criarEMontarSessaoRemota({
      fornecedorId: fornCicalfer.id,
      fornecedorUrl: 'https://cicalfer.com.br/',
      itens: []
    });
    console.log('✅ 2. Sessão Remota Cicalfer Criada / Reutilizada:');
    console.log('   - Session ID:', sessaoCicalfer.sessionId);
    console.log('   - Live View URL:', sessaoCicalfer.liveViewUrl);
  } catch (err2) {
    console.error('❌ Erro ao criar sessão da Cicalfer:', err2.message);
  }

  // ----------------------------------------------------------------
  // PASSO 2 — CONFIRMAÇÃO DO EFEITO COLATERAL E COMPARATIVO DE SESSION IDs
  // ----------------------------------------------------------------
  console.log('\n================================================================');
  console.log('📊 PASSO 2: COMPARATIVO EMPÍRICO DE SESSION IDs DA API BROWSERBASE');
  console.log('================================================================');
  console.log('   - Session ID Construjá:', sessaoConstruja?.sessionId);
  console.log('   - Session ID Cicalfer :', sessaoCicalfer?.sessionId);

  const idsIguais = sessaoConstruja?.sessionId === sessaoCicalfer?.sessionId;

  if (idsIguais) {
    console.log('\n🚨 [GAP 2 CONFIRMADO EM PRODUÇÃO REAL!]');
    console.log('   - Ambas as chamadas retornaram EXATAMENTE O MESMO sessionId:', sessaoConstruja?.sessionId);
    console.log('   - MOTIVO DA EVIDÊNCIA: A chamada da Cicalfer consultou `bb.sessions.list({ status: "RUNNING" })`, encontrou a sessão ativa da Construjá em `runningList[0]` e INTERCEPTOU/SOBRESCREVEU a aba com `page.goto("https://cicalfer.com.br")`!');
  } else {
    console.log('\n💡 [RESULTADO]: Os Session IDs foram diferentes:');
    console.log('   - Construja:', sessaoConstruja?.sessionId);
    console.log('   - Cicalfer :', sessaoCicalfer?.sessionId);
  }

  console.log('\n================================================================');
  console.log('🏁 TESTE CONCLUÍDO');
  console.log('================================================================');
}

executarValidacaoGap2ProducaoReal().catch(console.error);
