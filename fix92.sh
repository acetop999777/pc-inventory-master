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

p = Path("client/src/AppLegacy.tsx")
s = p.read_text(encoding="utf-8")

bad = "const savedTimerRef = useRef<any>(nulls=null as any);"
good = "const savedTimerRef = useRef<any>(null);"

if bad not in s:
    # 更宽松：把 useRef<any>(nulls=...) 修掉
    s2 = s.replace("useRef<any>(nulls=null as any)", "useRef<any>(null)")
else:
    s2 = s.replace(bad, good)

if s2 == s:
    raise SystemExit("ERROR: pattern not found; file may differ.")

p.write_text(s2, encoding="utf-8")
print("patched", p)
PY

git add client/src/AppLegacy.tsx
git commit -m "phase5.1a: fix AppLegacy savedTimerRef typo" || true

TAG="phase5_1a-$(date +%Y%m%d)"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  TAG="${TAG}b"
fi
git tag -a "$TAG" -m "phase5.1a: fix TS2304"

$DC build --no-cache client
$DC up -d
./scripts/smoke.sh
