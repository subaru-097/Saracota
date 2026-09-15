const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'docs', 'historico', '2026-09-15', 'teste3_saracota_construja');

console.log('=== AUDITORIA PROFUNDA DOS HTMLS E LOGS DO TESTE 3 ===\n');

// 1. Audit 01_saracota_home.html
const h1 = fs.readFileSync(path.join(dir, '01_saracota_home.html'), 'utf8');
console.log('1. 01_saracota_home.html size:', h1.length, 'bytes');
console.log('   First 5 lines:\n' + h1.split('\n').slice(0, 5).join('\n'));

// 2. Audit 01_modal_login.html
const h2 = fs.readFileSync(path.join(dir, '01_modal_login.html'), 'utf8');
console.log('\n2. 01_modal_login.html size:', h2.length, 'bytes');
console.log('   First 5 lines:\n' + h2.split('\n').slice(0, 5).join('\n'));

// 3. Audit 02_pos_login.html
const h3 = fs.readFileSync(path.join(dir, '02_pos_login.html'), 'utf8');
console.log('\n3. 02_pos_login.html size:', h3.length, 'bytes');
console.log('   First 5 lines:\n' + h3.split('\n').slice(0, 5).join('\n'));

// 4. Audit 03_pagina_carrinho.html
const h4 = fs.readFileSync(path.join(dir, '03_pagina_carrinho.html'), 'utf8');
console.log('\n4. 03_pagina_carrinho.html size:', h4.length, 'bytes');
console.log('   First 10 lines:\n' + h4.split('\n').slice(0, 10).join('\n'));

// Look for product names or prices in cart html using regex
const titlesInCart = h4.match(/<[^>]*productTitle[^>]*>([^<]+)/gi) || h4.match(/ProdutoCompactCarrinho[^>]*>([^<]+)/gi) || [];
console.log('   Titles matched in cart HTML:', titlesInCart);

// Check all occurrences of text inside spans or tds or divs in cart html
const r1 = h4.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
console.log('   Sample text in cart HTML (500 chars):', r1.substring(0, 600));

// 5. Audit log_execucao_construja.log
const logTxt = fs.readFileSync(path.join(dir, 'log_execucao_construja.log'), 'utf8');
console.log('\n5. log_execucao_construja.log analysis:');
logTxt.split('\n').forEach(line => {
  if (
    line.includes('Matching') || 
    line.includes('Total') || 
    line.includes('preço') || 
    line.includes('preco') || 
    line.includes('ADICIONADO') || 
    line.includes('Buscando') ||
    line.includes('17.32') ||
    line.includes('51.96') ||
    line.includes('TEK')
  ) {
    console.log('   LOG LINE:', line);
  }
});
