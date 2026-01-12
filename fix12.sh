set -euo pipefail
cd ~/pc-inventory-master 2>/dev/null || cd "$PWD"

# 建议：确保工作区干净（不强制，但强烈建议）
git status --porcelain

BASE_TAG="baseline_$(date +%Y%m%d_%H%M%S)"
git tag -a "$BASE_TAG" -m "Baseline before patch-driven refactor"

# 你项目里已经有 scripts/smoke.sh
chmod +x ./scripts/smoke.sh
./scripts/smoke.sh

echo "✅ baseline tag: $BASE_TAG"
