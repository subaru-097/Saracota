const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, '..', 'docs', 'historico', '2026-09-15', 'teste3_saracota_construja', 'log_execucao_construja.log');
const content = fs.readFileSync(logPath, 'utf8');

console.log('=== LOG LINES WITH BUSCA / CARRINHO / HTTP RESPONSES ===');
content.split('\n').forEach(line => {
  if (line.includes('busca?') || line.includes('carrinho?') || line.includes('HTTP 200] https://api.construja.com.br')) {
    console.log(line.substring(0, 200));
  }
});
