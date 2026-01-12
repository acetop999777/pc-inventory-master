set -euo pipefail
cd ~/pc-inventory-master

mkdir -p ops/patches

# 1) 探测 FinancialCard 实际位置
UI1="$(git ls-files 'client/src/components/ui/FinancialCard.*' | head -n 1 || true)"
UI2="$(git ls-files 'client/src/presentation/components/ui/FinancialCard.*' | head -n 1 || true)"

if [ -n "$UI1" ]; then
  export TARGET_PREFIX="../../../../components/ui/"
  echo "Detected UI root: client/src/components/ui (e.g. $UI1)"
elif [ -n "$UI2" ]; then
  export TARGET_PREFIX="../../../../presentation/components/ui/"
  echo "Detected UI root: client/src/presentation/components/ui (e.g. $UI2)"
else
  echo "ERROR: cannot find FinancialCard under client/src/components/ui or client/src/presentation/components/ui"
  echo "Hint: run: git ls-files | grep -i FinancialCard"
  exit 1
fi

# 2) 批量替换 editor 下的相对 import
node <<'NODE'
const fs = require('fs');
const path = require('path');

const root = 'client/src/features/clients/editor';
const to = process.env.TARGET_PREFIX;

if (!to) {
  console.error('ERROR: TARGET_PREFIX env is missing');
  process.exit(1);
}

const toNoSlash = to.endsWith('/') ? to.slice(0, -1) : to;

const fromWithSlash
