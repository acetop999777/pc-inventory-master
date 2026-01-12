set -euo pipefail
cd ~/pc-inventory-master

node <<'NODE'
const fs = require('fs');

const candidates = ['client/src/index.tsx', 'client/src/index.ts', 'client/src/index.jsx', 'client/src/index.js'];
const existing = candidates.filter(p => fs.existsSync(p));

if (existing.length === 0) {
  console.log('No index entry found in common paths; skipping.');
  process.exit(0);
}

for (const p of existing) {
  let s = fs.readFileSync(p, 'utf8');

  // 常见：import App from './AppLegacy' 或 './App'
  s = s.replace(/from\s+['"]\.\/AppLegacy['"]/g, `from './AppRouter'`);
  s = s.replace(/from\s+['"]\.\/AppLegacy\.tsx['"]/g, `from './AppRouter'`);

  // 若你入口里是 import App from './App'; 且 App.tsx re-export legacy，这一步不动它
  fs.writeFileSync(p, s);
  console.log('Updated:', p);
}
NODE

