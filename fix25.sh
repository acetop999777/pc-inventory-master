set -euo pipefail
cd ~/pc-inventory-master

# 用 node 做一次“安全替换式”落地，避免手打出错
node <<'NODE'
const fs = require('fs');

const path = 'client/src/AppLegacy.tsx';
let s = fs.readFileSync(path, 'utf8');

// 1) 增加 imports（如果已存在就不重复加）
function ensureImport(needle, line) {
  if (s.includes(needle)) return;
  const idx = s.indexOf("import { MainLayout");
  if (idx === -1) throw new Error("Cannot find import anchor: MainLayout");
  const before = s.slice(0, idx);
  const after = s.slice(idx);
  s = before + line + "\n" + after;
}

ensureImport("ClientsListPage", "import { ClientsListPage } from './features/clients/ClientsListPage';");
ensureImport("ClientDetailPage", "import { ClientDetailPage } from './features/clients/ClientDetailPage';");

// 2) 用页面组件替换 renderContent 里 clients/list & clients/detail 的 JSX
//    （采用定界替换：找到 ClientHub(...) 和 detail 那段结构）
s = s.replace(
  /return\s*\(\s*<ClientHub[\s\S]*?\/>\s*\);\s*\}/m,
  "return (\n          <ClientsListPage\n            clients={clients}\n            onSelectClient={handleSelectClient}\n            onNewClient={handleNewClient}\n            onDeleteClient={handleDeleteClient}\n          />\n        );\n      }\n"
);

// detail：用 ClientDetailPage 替换（保留 activeClient null 的 Loading 分支）
s = s.replace(
  /if\s*\(subView\s*===\s*'detail'\)\s*\{\s*if\s*\(!activeClient\)\s*return\s*<div className="p-10">Loading\.\.\.<\/div>;\s*[\s\S]*?return\s*\(\s*<div className="min-h-screen[\s\S]*?\)\s*;\s*\}\s*\}/m,
  "if (subView === 'detail') {\n        if (!activeClient) return <div className=\"p-10\">Loading...</div>;\n\n        return (\n          <ClientDetailPage\n            activeClient={activeClient}\n            inventory={inventory}\n            financials={financials}\n            statusSteps={STATUS_STEPS}\n            busy={busy}\n            hasError={hasError}\n            flashSaved={flashSaved}\n            onRetry={() => void retryActive()}\n            onUpdateField={handleUpdateField}\n            onBack={() =>\n              void flushAndGo(() => {\n                setSubView('list');\n                setActiveClientId(null);\n                setDraftClient(null);\n              })\n            }\n          />\n        );\n      }\n"
);

fs.writeFileSync(path, s);
console.log("OK: updated", path);
NODE
