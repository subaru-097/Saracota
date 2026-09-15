const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, '..', 'docs', 'historico', '2026-09-15', 'teste3_saracota_construja', 'log_execucao_construja.log');
const content = fs.readFileSync(logPath, 'utf8');

console.log('=== CART API RESPONSES IN LOG ===');
content.split('\n').forEach(line => {
  if (line.includes('v1/orcamentos/') && line.includes('/carrinho')) {
    console.log(line);
  }
});
