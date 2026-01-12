set -euo pipefail
cd ~/pc-inventory-master

node <<'NODE'
const fs = require('fs');

const p = 'client/src/features/clients/ClientsRoutes.tsx';
let s = fs.readFileSync(p, 'utf8');

// 替换 onBack：从 guard.run(() => { cleanup; nav('/clients') })
// 改为 guard.run(() => nav('/clients'), () => cleanup)
s = s.replace(
  /const onBack = useCallback\(\(\) => \{\s*void guard\.run\(\(\) => \{\s*\/\/[\s\S]*?nav\('\/clients'\);\s*\}\);\s*\},\s*\[([\s\S]*?)\]\s*\);\s*/m,
  `const onBack = useCallback(() => {
    void guard.run(
      () => nav('/clients'),
      () => {
        // 若 draft 没成功落库，允许离开时才丢弃（不产生幽灵记录）
        if (clientId && draft && !clients.some((c) => c.id === clientId)) clearDraft(clientId);
      }
    );
  }, [$1]);
`
);

fs.writeFileSync(p, s);
console.log('OK: updated', p);
NODE
