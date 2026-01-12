set -euo pipefail
cd ~/pc-inventory-master

node <<'NODE'
const fs = require('fs');

const p = 'client/src/features/clients/ClientDetailPage.tsx';
let s = fs.readFileSync(p, 'utf8');

// 1) 删除旧的 5 行 import（来自 presentation/modules/ClientEditor/components）
s = s.replace(
  /\nimport \{ IdentityCard \} from ['"]\.\.\/\.\.\/presentation\/modules\/ClientEditor\/components\/IdentityCard['"];\s*/g,
  '\n'
);
s = s.replace(
  /\nimport \{ LogisticsCard \} from ['"]\.\.\/\.\.\/presentation\/modules\/ClientEditor\/components\/LogisticsCard['"];\s*/g,
  '\n'
);
s = s.replace(
  /\nimport \{ FinancialsCard \} from ['"]\.\.\/\.\.\/presentation\/modules\/ClientEditor\/components\/FinancialsCard['"];\s*/g,
  '\n'
);
s = s.replace(
  /\nimport \{ NotesCard \} from ['"]\.\.\/\.\.\/presentation\/modules\/ClientEditor\/components\/NotesCard['"];\s*/g,
  '\n'
);
s = s.replace(
  /\nimport \{ SpecsTable \} from ['"]\.\.\/\.\.\/presentation\/modules\/ClientEditor\/components\/SpecsTable['"];\s*/g,
  '\n'
);

// 2) 插入新的聚合 import（如果还不存在）
const needle = "from './editor'";
if (!s.includes(needle)) {
  // 放在 InventoryItem import 后面比较稳
  s = s.replace(
    /import \{ InventoryItem \} from ['"]\.\.\/\.\.\/types['"];?\n/,
    (m) => m + "\nimport { IdentityCard, LogisticsCard, FinancialsCard, NotesCard, SpecsTable } from './editor';\n"
  );
}

fs.writeFileSync(p, s);
console.log('OK: updated', p);
NODE
