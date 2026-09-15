const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'historicos', '2026-09-15', 'teste5_saracota_construja', 'html_dumps', '02_busca_item_02.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('=== INSPEÇÃO DO CARD DE PRODUTO DO CONSTRUJÁ ===\n');

// Find inputs in search page
const inputs = html.match(/<input[^>]*>/gi) || [];
console.log(`Encontrados ${inputs.length} elementos <input>:`);
inputs.forEach(inp => {
  if (inp.includes('Quantidade') || inp.includes('number') || inp.includes('grKxO') || inp.includes('value')) {
    console.log('INPUT:', inp);
  }
});

// Find buttons inside cards or near prices
const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/gi) || [];
console.log(`\nEncontrados ${buttons.length} elementos <button>:`);
buttons.forEach(btn => {
  if (btn.includes('Comprar') || btn.includes('Adicionar') || btn.includes('carrinho') || btn.includes('btn-adicionar') || btn.includes('+')) {
    console.log('BUTTON:', btn.substring(0, 250));
  }
});
