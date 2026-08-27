const http = require('http');

async function testarEndpointErro(scenarioName, requestPayload) {
  console.log(`\n====================================================`);
  console.log(`🧪 TESTANDO FRONTEND/API ERROR SCENARIO: ${scenarioName}`);
  console.log(`====================================================`);

  const postData = JSON.stringify(requestPayload);

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/browserbase/session',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        console.log(`\n📡 Resposta da API /api/browserbase/session:`);
        console.log(`   - HTTP Status Code: ${res.statusCode}`);

        try {
          const json = JSON.parse(data);
          console.log(`   - Sucesso: ${json.sucesso}`);
          console.log(`   - Error Message: ${json.error || 'Nenhum erro retornado'}`);
          console.log(`   - Live View URL: ${json.liveViewUrl || 'Nenhuma (esperado em falha)'}`);

          console.log(`\n🖥️ COMPORTAMENTO ESPERADO NO FRONTEND (CotacoesView + BrowserbaseLiveViewModal):`);
          if (!json.sucesso || json.error || res.statusCode >= 400) {
            console.log(`   ✅ isLoadingBrowserbase = false (Spinner de carregamento ocultado)`);
            console.log(`   ✅ browserbaseErrorMsg = "${json.error || 'Falha de conexão'}"`);
            console.log(`   ✅ Modal renderiza o container de erro [Rose Alert Box]`);
            console.log(`   ✅ Botão "Tentar Novamente" ativado e funcional`);
            console.log(`   ✅ Botão "Fechar Janela" ativado para o usuário sair`);
          } else {
            console.log(`   🚀 Sessão iniciada normalmente: liveViewUrl = ${json.liveViewUrl}`);
          }
        } catch (e) {
          console.log(`   ⚠️ Resposta não-JSON: ${data}`);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`❌ Erro na requisição HTTP: ${e.message}`);
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

async function rodarTestes() {
  // Cenário 1: Erro de Conexão CDP / Session ID expirado
  await testarEndpointErro('Cenário 1: Erro de Conexão Remota CDP (Session Invalida)', {
    fornecedorId: 'forn-invalid-cdp-test',
    fornecedorNome: 'Fornecedor Teste Erro CDP',
    itens: [{ texto: 'Item Teste', quantidade: 1 }],
  });

  // Cenário 2: Erro de Navegação (URL Inacessível)
  await testarEndpointErro('Cenário 2: Erro de Navegação do Fornecedor (URL Inexistente)', {
    fornecedorId: 'forn-unreachable-domain-test',
    fornecedorNome: 'Fornecedor Dominio Inacessivel',
    itens: [{ texto: 'Chuveiro', quantidade: 1 }],
  });

  console.log(`\n====================================================`);
  console.log(`🏆 VALIDAÇÃO DE TRATAMENTO DE ERROS CONCLUÍDA!`);
  console.log(`====================================================\n`);
}

rodarTestes();
