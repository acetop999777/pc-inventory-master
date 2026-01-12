set -euo pipefail
cd ~/pc-inventory-master 2>/dev/null || cd "$PWD"

mkdir -p ops/patches

cat > ops/patches/phase2_api_base_same_origin.diff <<'PATCH'
diff --git a/client/src/utils.ts b/client/src/utils.ts
index e596c3b..4f8509e 100644
--- a/client/src/utils.ts
+++ b/client/src/utils.ts
@@ -1,6 +1,6 @@
 import { InventoryItem } from './types';
 
-export const API_BASE = `http://${window.location.hostname}:5001/api`;
+export const API_BASE = '/api';
 export const generateId = (): string => Math.random().toString(36).substr(2, 9);
 export const formatMoney = (n: number | undefined): string => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
 
PATCH

git apply ops/patches/phase2_api_base_same_origin.diff
git add -A
git commit -m "client: use same-origin /api (nginx proxy) instead of direct :5001"
git tag -a "phase2_api_base_same_origin" -m "Client API_BASE is now same-origin /api via nginx proxy"

./scripts/smoke.sh
