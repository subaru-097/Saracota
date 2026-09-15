const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { db } = require('../lib/db/client');
const { decryptAES256 } = require('../lib/security/vault');
const quoteEngine = require('../core/services/supplier-quote-engine');
const cicalferConfig = require('../config/suppliers/cicalfer.json');

(async () => {
  console.log('================================================================');
  console.log('🧪 TESTE DINÂMICO COM LISTA DE PRODUTOS ALTERADA (DIFERENTE)');
  console.log('================================================================');

  const fornDbRecord = await db.fornecedores.getById('33e03495-100d-45a3-9e34-899de56b0ab1');
  const loginUser = (fornDbRecord?.emailLogin || fornDbRecord?.login || fornDbRecord?.email || 'santanacomercial2021@gmail.com').trim();
  const rawPass = (fornDbRecord?.rawSenhaCriptografada || fornDbRecord?.senhaLogin || '').trim();
  const decryptedPass = rawPass ? decryptAES256(rawPass).trim() : 'password123';

  // LISTA ALTERADA (Item #4 trocado por "3 x DISCO DE CORTE CONTINUO 110X20MM IRWIN")
  const itensCotacao = [
    { termoOriginal: '2 x CABO FLEX 100M COBRECOM 2,50MM', quantidade: 2, num: 1 },
    { termoOriginal: '5 x DUCHA LORENZETTI BELLA DUCHA 127V', quantidade: 5, num: 2 },
    { termoOriginal: '5 x CARRINHO DE MÃO ESFERA EXTRA FORTE 60 LTS', quantidade: 5, num: 3 },
    { termoOriginal: '3 x DISCO DE CORTE CONTINUO 110X20MM IRWIN', quantidade: 3, num: 4 }
  ];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

  try {
    await quoteEngine.realizarLogin(page, cicalferConfig, { user: loginUser, pass: decryptedPass });

    for (const item of itensCotacao) {
      console.log(`\nCotando Item ${item.num}/4: "${item.termoOriginal}" (Qtd: ${item.quantidade})...`);
      await quoteEngine.adicionarItem(page, cicalferConfig, {
        termo: item.termoOriginal,
        quantidade: item.quantidade,
        itemIndex: item.num
      }).catch(e => console.error('Erro ao adicionar item:', e));
    }

    console.log('\nNavegando para o carrinho...');
    const cartData = await quoteEngine.extrairCarrinho(page, cicalferConfig);
    const prods = cartData.produtos || [];

    function encontrarMelhorCorrespondencia(termoItem, listaProdutosDOM) {
      const stopWords = ['com', 'para', 'de', 'da', 'do', 'em', '127v', '220v', 'ref', 'mm', 'm', 'lts', 'ch', 'un', 'cx', 'kg'];
      const cleanTerm = termoItem
        .replace(/^\s*\d+\s*(?:x|uni|un|pçs|pcs|cx|caixa|m|metro|kg)?\s*/i, '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const termTokens = cleanTerm
        .split(/[\s,/-]+/)
        .filter(w => w.length >= 3 && !stopWords.includes(w));

      let bestMatch = null;
      let maxScore = 0;

      for (const prod of listaProdutosDOM) {
        const prodNorm = prod.nomeProduto
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');

        let score = 0;
        for (const token of termTokens) {
          if (prodNorm.includes(token)) {
            score++;
          }
        }

        if (score > maxScore) {
          maxScore = score;
          bestMatch = prod;
        }
      }

      return maxScore > 0 ? bestMatch : null;
    }

    const resultadosProcessados = [];
    itensCotacao.forEach((itemPed) => {
      const matchFound = encontrarMelhorCorrespondencia(itemPed.termoOriginal, prods);

      if (matchFound && matchFound.precoUnitario > 0) {
        const itemTotal = matchFound.precoUnitario * itemPed.quantidade;
        resultadosProcessados.push({
          itemPedido: itemPed.termoOriginal,
          nomeExatoSite: matchFound.nomeProduto,
          codigoRef: matchFound.codigoBadge || matchFound.codigoProduto || 'N/A',
          precoUnitario: matchFound.precoUnitario,
          quantidade: itemPed.quantidade,
          precoTotal: itemTotal,
          status: 'ENCONTRADO'
        });
      } else {
        resultadosProcessados.push({
          itemPedido: itemPed.termoOriginal,
          nomeExatoSite: 'Não localizado no carrinho',
          codigoRef: 'N/A',
          precoUnitario: 0,
          quantidade: itemPed.quantidade,
          precoTotal: 0,
          status: 'FALHA'
        });
      }
    });

    const totalPedidoGeral = resultadosProcessados.reduce((acc, r) => acc + r.precoTotal, 0);

    console.log('\n================================================================');
    console.log('📊 TABELA COMPARATIVA DYNÂMICA GERADA PARA A NOVA LISTA:');
    console.log('================================================================');
    resultadosProcessados.forEach((r, i) => {
      console.log(`${i+1}. Solicitado: "${r.itemPedido}" | Encontrado: "${r.nomeExatoSite}" | REF: ${r.codigoRef} | Unit: R$ ${r.precoUnitario.toFixed(2)} | Qtd: ${r.quantidade} | Total: R$ ${r.precoTotal.toFixed(2)} | Status: ${r.status}`);
    });
    console.log('================================================================');
    console.log(`VALOR TOTAL GERAL DO PEDIDO: R$ ${totalPedidoGeral.toFixed(2)}`);
    console.log('================================================================');

  } catch (err) {
    console.error('Erro no teste dinamico:', err);
  } finally {
    await browser.close();
  }
})();
