const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'docs', 'historico', '2026-09-15', 'teste3_saracota_construja');

const files = fs.readdirSync(dir);

console.log('=== TAREFA 1: LISTAGEM E VERIFICAÇÃO FÍSICA DE TODOS OS ARQUIVOS ===\n');

files.sort().forEach(file => {
  const fullPath = path.join(dir, file);
  const stat = fs.statSync(fullPath);
  console.log(`File: ${file.padEnd(35)} | Size: ${String(stat.size).padStart(8)} bytes | Modified: ${stat.mtime.toISOString()}`);
});

console.log('\n=== VERIFICAÇÃO DE INTEGRIDADE DOS PRINTS PNG ===\n');
files.filter(f => f.endsWith('.png')).sort().forEach(file => {
  const fullPath = path.join(dir, file);
  const buf = fs.readFileSync(fullPath);
  // PNG Header check: 89 50 4E 47 0D 0A 1A 0A
  const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  console.log(`Print PNG: ${file.padEnd(35)} | Valid PNG Header: ${isPng} | Size: ${buf.length} bytes`);
});

console.log('\n=== AUDITORIA DOS CONTEÚDOS DOS HTMLS (PRIMEIRAS 20 LINHAS) ===\n');
files.filter(f => f.endsWith('.html')).sort().forEach(file => {
  const fullPath = path.join(dir, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n').slice(0, 20).join('\n');
  console.log(`--- [HTML] ${file} (${content.length} bytes) ---`);
  console.log(lines);
  console.log('--------------------------------------------------\n');
});
