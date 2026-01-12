set -euo pipefail
cd ~/pc-inventory-master

mkdir -p ops/patches

# 1) 探测 FinancialCard 实际位置（两种常见布局：src/components 或 src/presentation/components）
UI1="$(git ls-files 'client/src/components/ui/FinancialCard.*' | head -n 1 || true)"
UI2="$(git ls-files 'client/src/presentation/components/ui/FinancialCard.*' | head -n 1 || true)"

if [ -n "$UI1" ]; then
  TARGET_PREFIX="../../../../components/ui/"
  echo "Detected UI root: client/src/components/ui (e.g. $UI1)"
elif [ -n "$UI2" ]; then
  TARGET_PREFIX="../../../../presentation/components/ui/"
  echo "Detected UI root: client/src/presentation/components/ui (e.g. $UI2)"
else
  echo "ERROR: cannot find FinancialCard under client/src/components/ui or client/src/presentation/components/ui"
  echo "Hint: run: git ls-files | grep -i FinancialCard"
  exit 1
fi

# 2) 批量替换：把 features/clients/editor 下面所有 '../../../components/ui/' 改成正确前缀
#    （只改 ui 这一条路径，避免误伤其它 components）
node <<'NODE'
const fs = require('fs');
const path = require('path');

const root = 'client/src/features/clients/editor';
const fromA = "../../../components/ui/";
const fromB = "../../../components/ui"; // 兼容极端写法
const to = process.env.TARGET_PREFIX;

function walk(dir, out=[]) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(root);
let changed = 0;

for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const before = s;

  // 同时处理单引号/双引号/无 trailing slash 的情况
  s = s.replaceAll(fromA, to);
  s = s.replaceAll(fromB + "'", to.replace(/\/$/, "") + "'");
  s = s.replaceAll(fromB + '"', to.replace(/\/$/, "") + '"');

  if (s !== before) {
    fs.writeFileSync(f, s);
    changed++;
  }
}

console.log(`Updated ${changed} files under ${root}`);
NODE
# 传入 env 给 node
TARGET_PREFIX="$TARGET_PREFIX" node -e "process.exit(0)" >/dev/null 2>&1 || true

# 3) 记录补丁（便于审阅/回滚对比）
git diff > ops/patches/phase6_2_1_fix_editor_ui_imports.diff || true
echo "Patch saved: ops/patches/phase6_2_1_fix_editor_ui_imports.diff"

# 4) 重建 + smoke
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
$DC up -d --build
./scripts/smoke.sh
