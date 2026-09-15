const fs = require('fs');

const html1 = fs.readFileSync('./scratch/diag_01_login_preenchido.png') ? 'png_exists' : '';
const html = fs.readFileSync('./scratch/diag_02_pos_submit.html', 'utf8');

console.log('--- HTML SNIPPET AROUND FORM / INPUTS ---');
const idx = html.indexOf('name="email"');
if (idx !== -1) {
  console.log(html.substring(idx - 300, idx + 600));
} else {
  console.log('name="email" não encontrado. Buscando input...');
  const idx2 = html.indexOf('id="senha"');
  if (idx2 !== -1) {
    console.log(html.substring(idx2 - 300, idx2 + 600));
  }
}

// Inspect modal container or error elements
const modalContent = html.indexOf('modal-content');
if (modalContent !== -1) {
  console.log('--- MODAL CONTAINER TEXT ---');
  const text = html.substring(modalContent, modalContent + 2000).replace(/<[^>]+>/g, ' ');
  console.log(text.substring(0, 500));
}
