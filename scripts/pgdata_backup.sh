#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p backups

# 尽量自动推导 compose project name -> volume 名
PROJECT="$(docker compose config --format json 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin).get("name",""))' || true)"
VOL="${PROJECT}_pgdata"

if ! docker volume inspect "$VOL" >/dev/null 2>&1; then
  # fallback：找 *_pgdata
  VOL="$(docker volume ls --format '{{.Name}}' | grep -E '_pgdata$' | head -n 1 || true)"
fi

if [[ -z "${VOL:-}" ]]; then
  echo "[pgdata] ERROR: cannot find pgdata volume"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
OUT="backups/pgdata_${TS}.tgz"

echo "[pgdata] volume=$VOL -> $OUT"

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v "$VOL":/var/lib/postgresql/data:ro \
  -v "$PWD/backups":/backup \
  alpine sh -lc "cd /var/lib/postgresql/data && tar czf /backup/pgdata_${TS}.tgz ."

ls -lh "$OUT"
echo "[pgdata] ✅ done"
