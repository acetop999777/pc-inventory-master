set -euo pipefail
cd ~/pc-inventory-master

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "ERROR: need docker compose v2 or docker-compose v1" >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
import re

p = Path("client/src/presentation/modules/Inventory/InventoryHub.tsx")
txt = p.read_text(encoding="utf-8")

# 找到当前 “Avg Cost” 纯文本显示块并替换成 InlineEditor（和 name 一样的交互）
pattern = re.compile(
    r"""
    <div\s+className="col-span-2\s+text-right\s+font-mono\s+text-slate-600\s+font-bold">\s*
    \$\{Number\(i\.cost\s*\?\?\s*0\)\}\s*
    </div>
    """,
    re.VERBOSE
)

replacement = r"""
            <div className="col-span-2 text-right font-mono text-slate-600 font-bold">
              <div className="flex justify-end items-center gap-1">
                <span className="text-slate-400">$</span>
                <div className="min-w-[88px] text-right">
                  <InlineEditor
                    type="number"
                    value={Number(i.cost ?? 0)}
                    onChange={(v) => updateItem(i, { cost: Number(v) })}
                  />
                </div>
              </div>
            </div>
""".rstrip()

new_txt, n = pattern.subn(replacement, txt, count=1)
if n != 1:
    raise SystemExit("ERROR: Could not find the Avg Cost display block to patch (file changed?).")

p.write_text(new_txt, encoding="utf-8")
print("patched:", p)
PY

git add client/src/presentation/modules/Inventory/InventoryHub.tsx
git commit -m "phase4.4: inline edit Avg Cost (WAC) like component name (autosave)" || true

TAG="phase4_4-$(date +%Y%m%d)"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  TAG="${TAG}b"
fi
git tag -a "$TAG" -m "phase4.4: inline edit WAC"

$DC build --no-cache client
$DC up -d
./scripts/smoke.sh
