const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'historicos', '2026-09-15', 'teste4_saracota_construja', 'html_dumps', '01_home_pos_login.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('=== INSPEÇÃO DO DOM DO MODAL DE LOGIN DA CONSTRUJÁ ===\n');

// 1. Search for buttons
const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/gi) || [];
console.log(`Encontrados ${buttons.length} elementos <button>:`);
buttons.forEach((b, idx) => {
  if (b.includes('Entrar') || b.includes('submit') || b.includes('btn') || b.includes('login') || b.includes('button')) {
    console.log(`\n[Button #${idx + 1}]`);
    console.log(b.substring(0, 300));
  }
});

// 2. Search for submit elements or form buttons
const submitMatches = html.match(/<[^>]+type=["']submit["'][^>]*>/gi) || [];
console.log(`\nElementos com type="submit":`, submitMatches);

// 3. Search for elements with "btn-entrar" or "btn"
const btnMatches = html.match(/<[^>]+id=["']?btn[^"'>\s]+["']?[^>]*>/gi) || [];
console.log(`\nElementos com ID contendo "btn":`, btnMatches);
