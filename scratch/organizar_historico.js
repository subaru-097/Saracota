const fs = require('fs');
const path = require('path');

const docsHistorico = 'C:\\Users\\User\\Desktop\\Saracota\\docs\\historico';
const oldPrintsDir = path.join(docsHistorico, 'prints');
const targetAnteriorPrints = path.join(docsHistorico, '2026-09-10_anterior', 'prints');
const newExecutionPrints = path.join(docsHistorico, '2026-09-10_20h44', 'prints');
const newExecutionLogs = path.join(docsHistorico, '2026-09-10_20h44', 'logs');

fs.mkdirSync(targetAnteriorPrints, { recursive: true });
fs.mkdirSync(newExecutionPrints, { recursive: true });
fs.mkdirSync(newExecutionLogs, { recursive: true });

if (fs.existsSync(oldPrintsDir)) {
  const files = fs.readdirSync(oldPrintsDir);
  let countMoved = 0;

  for (const file of files) {
    if (file.startsWith('2026-09-10_')) {
      const src = path.join(oldPrintsDir, file);
      const dest = path.join(targetAnteriorPrints, file);
      fs.renameSync(src, dest);
      countMoved++;
    }
  }

  console.log(`Organização concluída! ${countMoved} prints soltos de 2026-09-10 movidos para ${targetAnteriorPrints}`);
}
